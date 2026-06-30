import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  BookingStatus,
  PaymentKind,
  PaymentModel,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PaymentsService } from './payments.service';

const D = (v: string | number) => new Prisma.Decimal(v);

function mockPrisma() {
  return {
    booking: { findUnique: jest.fn() },
    payment: { upsert: jest.fn(), updateMany: jest.fn() },
    stripeWebhookEvent: { create: jest.fn(), update: jest.fn() },
    mollieWebhookEvent: { create: jest.fn(), update: jest.fn() },
  } as any;
}

function booking(over: Record<string, unknown> = {}) {
  return {
    id: 'b1',
    displayRef: 'IT-2026-AAAA',
    status: BookingStatus.ON_HOLD,
    paymentModel: PaymentModel.OPERATOR_LINK,
    currency: 'EUR',
    depositAmount: D('41.99'),
    totalRetail: D('209.97'),
    tourId: 't1',
    ...over,
  };
}

describe('PaymentsService', () => {
  let prisma: any;
  let stripe: any;
  let bookings: any;
  let svc: PaymentsService;

  beforeEach(() => {
    prisma = mockPrisma();
    stripe = {
      isConfigured: jest.fn().mockResolvedValue(true),
      createPaymentIntent: jest.fn().mockResolvedValue({
        id: 'pi_1',
        client_secret: 'pi_1_secret',
        status: 'requires_payment_method',
      }),
      paymentMethods: jest.fn().mockResolvedValue([]),
      publishableKey: jest.fn().mockResolvedValue('pk_test_123'),
      constructEvent: jest.fn(),
    };
    bookings = { confirmFromPayment: jest.fn().mockResolvedValue(undefined) };
    svc = new PaymentsService(prisma, stripe, bookings);
  });

  describe('createIntentForBooking', () => {
    it('charges the deposit (minor units) for OPERATOR_LINK', async () => {
      prisma.booking.findUnique.mockResolvedValue(booking());
      const res = await svc.createIntentForBooking('b1');

      expect(stripe.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 4199, currency: 'EUR' }),
      );
      expect(res).toMatchObject({
        paymentRequired: true,
        clientSecret: 'pi_1_secret',
        publishableKey: 'pk_test_123',
        kind: PaymentKind.DEPOSIT,
        amount: '41.99',
      });
      expect(prisma.payment.upsert).toHaveBeenCalled();
    });

    it('charges the full total for PAID_IN_FULL', async () => {
      prisma.booking.findUnique.mockResolvedValue(
        booking({ paymentModel: PaymentModel.PAID_IN_FULL }),
      );
      await svc.createIntentForBooking('b1');
      expect(stripe.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 20997 }),
      );
    });

    it('requires no payment for ON_ARRIVAL / OPERATOR_FULL', async () => {
      for (const pm of [PaymentModel.ON_ARRIVAL, PaymentModel.OPERATOR_FULL]) {
        prisma.booking.findUnique.mockResolvedValue(
          booking({ paymentModel: pm }),
        );
        const res = await svc.createIntentForBooking('b1');
        expect(res.paymentRequired).toBe(false);
      }
      expect(stripe.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('rejects when Stripe is not configured', async () => {
      prisma.booking.findUnique.mockResolvedValue(booking());
      stripe.isConfigured.mockResolvedValue(false);
      await expect(svc.createIntentForBooking('b1')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('rejects paying for a cancelled booking', async () => {
      prisma.booking.findUnique.mockResolvedValue(
        booking({ status: BookingStatus.CANCELLED }),
      );
      await expect(svc.createIntentForBooking('b1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('handleWebhook', () => {
    const rawBody = Buffer.from('{}');

    it('settles the booking on payment_intent.succeeded', async () => {
      stripe.constructEvent.mockResolvedValue({
        id: 'evt_1',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_1',
            metadata: { bookingId: 'b1' },
            latest_charge: 'ch_1',
          },
        },
      });
      prisma.stripeWebhookEvent.create.mockResolvedValue({});

      await svc.handleWebhook(rawBody, 'sig');

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.SUCCEEDED }),
        }),
      );
      expect(bookings.confirmFromPayment).toHaveBeenCalledWith('b1', undefined);
      expect(prisma.stripeWebhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'evt_1' } }),
      );
    });

    it('is idempotent - a redelivered event is skipped', async () => {
      stripe.constructEvent.mockResolvedValue({
        id: 'evt_1',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_1', metadata: { bookingId: 'b1' } } },
      });
      prisma.stripeWebhookEvent.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'x',
        }),
      );

      await svc.handleWebhook(rawBody, 'sig');
      expect(bookings.confirmFromPayment).not.toHaveBeenCalled();
    });

    it('marks the payment FAILED on payment_intent.payment_failed', async () => {
      stripe.constructEvent.mockResolvedValue({
        id: 'evt_2',
        type: 'payment_intent.payment_failed',
        data: { object: { id: 'pi_1', metadata: { bookingId: 'b1' } } },
      });
      prisma.stripeWebhookEvent.create.mockResolvedValue({});

      await svc.handleWebhook(rawBody, 'sig');
      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: PaymentStatus.FAILED } }),
      );
      expect(bookings.confirmFromPayment).not.toHaveBeenCalled();
    });

    it('rejects an invalid signature', async () => {
      stripe.constructEvent.mockRejectedValue(new Error('bad sig'));
      await expect(svc.handleWebhook(rawBody, 'sig')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.stripeWebhookEvent.create).not.toHaveBeenCalled();
    });
  });

  describe('handleMollieWebhook', () => {
    it('records the event idempotently and marks it processed', async () => {
      prisma.mollieWebhookEvent.create.mockResolvedValue({});
      await svc.handleMollieWebhook('tr_abc');
      expect(prisma.mollieWebhookEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ id: 'tr_abc' }),
        }),
      );
      expect(prisma.mollieWebhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'tr_abc' } }),
      );
    });

    it('is a no-op on redelivery (duplicate id)', async () => {
      prisma.mollieWebhookEvent.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'x',
        }),
      );
      await svc.handleMollieWebhook('tr_abc');
      expect(prisma.mollieWebhookEvent.update).not.toHaveBeenCalled();
    });

    it('rejects a missing payment id', async () => {
      await expect(svc.handleMollieWebhook('')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
