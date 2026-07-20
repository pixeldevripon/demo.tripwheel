// Mock the Better Auth singleton so the ESM `better-auth` package is never
// loaded in the unit test (reached transitively via BookingsService ->
// CustomerProvisioningService; same approach as staff/operators specs).
jest.mock('@/auth/auth.instance', () => ({
  auth: {
    $context: Promise.resolve({
      password: { hash: jest.fn() },
      internalAdapter: {
        createUser: jest.fn(),
        linkAccount: jest.fn(),
        deleteUser: jest.fn(),
      },
    }),
    api: { requestPasswordReset: jest.fn() },
  },
}));

import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  BookingStatus,
  PaymentKind,
  PaymentModel,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { PaymentsService } from './payments.service';

const D = (v: string | number) => new Prisma.Decimal(v);

function mockPrisma() {
  return {
    booking: { findUnique: jest.fn() },
    payment: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    operator: { findUnique: jest.fn() },
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
  let targetLimiter: any;
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
      retrievePaymentIntent: jest.fn(),
      // Webhooks never expand nested objects, so the card/billing snapshot has to
      // fetch the charge behind `latest_charge`.
      retrieveCharge: jest.fn().mockResolvedValue({
        id: 'ch_1',
        billing_details: {
          address: { country: 'CW', postal_code: '0000', city: 'Willemstad' },
        },
        payment_method_details: {
          type: 'card',
          card: { last4: '4242', brand: 'visa' },
        },
      }),
    };
    bookings = { confirmFromPayment: jest.fn().mockResolvedValue(undefined) };
    targetLimiter = { consume: jest.fn() };
    svc = new PaymentsService(prisma, stripe, bookings, targetLimiter);
  });

  // Dashboard payments table (DASH2): scoping + row mapping.
  describe('list (dashboard)', () => {
    const paymentRow = (over: Record<string, unknown> = {}) => ({
      id: 'pay1',
      bookingId: 'b1',
      provider: PaymentProvider.STRIPE,
      kind: PaymentKind.DEPOSIT,
      status: PaymentStatus.SUCCEEDED,
      amount: D('41.99'),
      currency: 'EUR',
      intentId: 'pi_1',
      methodType: 'card',
      createdAt: new Date('2030-06-01T10:00:00.000Z'),
      updatedAt: new Date('2030-06-01T10:05:00.000Z'),
      booking: {
        displayRef: 'IT-2026-AAAA',
        publicRef: 'pub-1',
        contactFullName: 'Jane Doe',
        localDate: new Date('2030-06-05T00:00:00.000Z'),
        paymentModel: PaymentModel.OPERATOR_LINK,
        tour: { name: 'Klein Curacao Day Trip' },
      },
      ...over,
    });

    it('maps the row with booking context (admin, no scope filter)', async () => {
      prisma.payment.count.mockResolvedValue(1);
      prisma.payment.findMany.mockResolvedValue([paymentRow()]);
      const res = await svc.list({}, { id: 'admin-1', role: Role.ADMIN });
      expect(res.total).toBe(1);
      const row = res.data[0];
      expect(row.amount).toBe('41.99');
      expect(row.bookingDisplayRef).toBe('IT-2026-AAAA');
      expect(row.tourName).toBe('Klein Curacao Day Trip');
      expect(row.bookingLocalDate).toBe('2030-06-05');
      const args = prisma.payment.findMany.mock.calls.at(-1)[0];
      expect(args.where.booking).toBeUndefined();
    });

    it('scopes TOUR_OPERATOR to payments on their own tours', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-9' });
      prisma.payment.count.mockResolvedValue(0);
      prisma.payment.findMany.mockResolvedValue([]);
      await svc.list({}, { id: 'user-9', role: Role.TOUR_OPERATOR });
      const args = prisma.payment.findMany.mock.calls.at(-1)[0];
      expect(args.where.booking).toEqual({ operatorId: 'op-9' });
    });

    it('scopes USER (customer) to payments on their OWN bookings, never operator resolution', async () => {
      prisma.payment.count.mockResolvedValue(0);
      prisma.payment.findMany.mockResolvedValue([]);
      await svc.list({}, { id: 'cust-1', role: Role.USER });
      const args = prisma.payment.findMany.mock.calls.at(-1)[0];
      expect(args.where.booking).toEqual({ userId: 'cust-1' });
      // A customer must never hit resolveOperatorId (it would 4xx them).
      expect(prisma.operator.findUnique).not.toHaveBeenCalled();
    });

    it('applies status/kind/search/date filters', async () => {
      prisma.payment.count.mockResolvedValue(0);
      prisma.payment.findMany.mockResolvedValue([]);
      await svc.list(
        {
          status: PaymentStatus.FAILED,
          kind: PaymentKind.DEPOSIT,
          search: 'pi_1',
          from: '2030-06-01',
          to: '2030-06-30',
        },
        { id: 'admin-1', role: Role.ADMIN },
      );
      const args = prisma.payment.findMany.mock.calls.at(-1)[0];
      expect(args.where.status).toBe(PaymentStatus.FAILED);
      expect(args.where.kind).toBe(PaymentKind.DEPOSIT);
      expect(args.where.OR).toEqual(
        expect.arrayContaining([
          { intentId: { contains: 'pi_1', mode: 'insensitive' } },
        ]),
      );
      expect(args.where.createdAt.gte).toEqual(
        new Date('2030-06-01T00:00:00.000Z'),
      );
      expect(args.where.createdAt.lte).toEqual(
        new Date('2030-06-30T23:59:59.999Z'),
      );
    });
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

    it('charges in the Booking currency, not the tour currency (§20.7)', async () => {
      // A USD-charged booking must create a USD PaymentIntent (guide §20.7).
      prisma.booking.findUnique.mockResolvedValue(booking({ currency: 'USD' }));
      await svc.createIntentForBooking('b1');
      expect(stripe.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'USD' }),
      );
    });

    it('charges the deposit for ON_ARRIVAL (deposit model, guide §20.7)', async () => {
      prisma.booking.findUnique.mockResolvedValue(
        booking({ paymentModel: PaymentModel.ON_ARRIVAL }),
      );
      const res = await svc.createIntentForBooking('b1');
      expect(res.paymentRequired).toBe(true);
      expect(stripe.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 4199 }), // deposit 41.99
      );
    });

    it('requires no payment for OPERATOR_FULL', async () => {
      prisma.booking.findUnique.mockResolvedValue(
        booking({ paymentModel: PaymentModel.OPERATOR_FULL }),
      );
      const res = await svc.createIntentForBooking('b1');
      expect(res.paymentRequired).toBe(false);
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
      // The webhook sends `latest_charge` as a plain string, so the charge must be
      // fetched - otherwise the card/billing snapshot silently stays null.
      expect(stripe.retrieveCharge).toHaveBeenCalledWith('ch_1');
      expect(bookings.confirmFromPayment).toHaveBeenCalledWith('b1', {
        country: 'CW',
        postalCode: '0000',
        city: 'Willemstad',
        last4: '4242',
        brand: 'visa',
      });
      expect(prisma.stripeWebhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'evt_1' } }),
      );
    });

    it('uses the charge already expanded on the intent without re-fetching', async () => {
      stripe.constructEvent.mockResolvedValue({
        id: 'evt_1',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_1',
            metadata: { bookingId: 'b1' },
            latest_charge: {
              id: 'ch_1',
              billing_details: { address: { country: 'NL' } },
              payment_method_details: {
                type: 'card',
                card: { last4: '1111', brand: 'mastercard' },
              },
            },
          },
        },
      });
      prisma.stripeWebhookEvent.create.mockResolvedValue({});

      await svc.handleWebhook(rawBody, 'sig');

      expect(stripe.retrieveCharge).not.toHaveBeenCalled();
      expect(bookings.confirmFromPayment).toHaveBeenCalledWith(
        'b1',
        expect.objectContaining({ last4: '1111', brand: 'mastercard' }),
      );
    });

    it('still confirms when the charge lookup fails (snapshot is best-effort)', async () => {
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
      stripe.retrieveCharge.mockRejectedValue(new Error('stripe down'));

      await svc.handleWebhook(rawBody, 'sig');

      // A missing snapshot must never block the booking confirmation.
      expect(bookings.confirmFromPayment).toHaveBeenCalledWith('b1', undefined);
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

  describe('settleFromReturn (synchronous confirm-on-return)', () => {
    it('confirms immediately when Stripe reports the intent succeeded', async () => {
      prisma.booking.findUnique
        .mockResolvedValueOnce({
          id: 'b1',
          status: BookingStatus.ON_HOLD,
          publicRef: 'pub-1',
        })
        .mockResolvedValueOnce({
          status: BookingStatus.CONFIRMED,
          publicRef: 'pub-1',
        });
      prisma.payment.findFirst.mockResolvedValue({ intentId: 'pi_1' });
      stripe.retrievePaymentIntent.mockResolvedValue({
        id: 'pi_1',
        status: 'succeeded',
        metadata: { bookingId: 'b1' },
        latest_charge: 'ch_1',
      });

      const res = await svc.settleFromReturn('pub-1');

      expect(stripe.retrievePaymentIntent).toHaveBeenCalledWith('pi_1');
      expect(bookings.confirmFromPayment).toHaveBeenCalledWith(
        'b1',
        expect.objectContaining({ last4: '4242', brand: 'visa' }),
      );
      expect(res).toEqual({
        status: BookingStatus.CONFIRMED,
        publicRef: 'pub-1',
      });
    });

    it('is a no-op once the booking is already CONFIRMED (webhook won the race)', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: 'b1',
        status: BookingStatus.CONFIRMED,
        publicRef: 'pub-1',
      });

      const res = await svc.settleFromReturn('pub-1');

      expect(stripe.retrievePaymentIntent).not.toHaveBeenCalled();
      expect(bookings.confirmFromPayment).not.toHaveBeenCalled();
      expect(res.status).toBe(BookingStatus.CONFIRMED);
    });

    it('does NOT confirm when the intent has not succeeded yet', async () => {
      prisma.booking.findUnique
        .mockResolvedValueOnce({
          id: 'b1',
          status: BookingStatus.ON_HOLD,
          publicRef: 'pub-1',
        })
        .mockResolvedValueOnce({
          status: BookingStatus.ON_HOLD,
          publicRef: 'pub-1',
        });
      prisma.payment.findFirst.mockResolvedValue({ intentId: 'pi_1' });
      stripe.retrievePaymentIntent.mockResolvedValue({
        id: 'pi_1',
        status: 'processing',
        metadata: { bookingId: 'b1' },
      });

      const res = await svc.settleFromReturn('pub-1');

      expect(bookings.confirmFromPayment).not.toHaveBeenCalled();
      expect(res.status).toBe(BookingStatus.ON_HOLD);
    });

    it('swallows a Stripe error and returns the unchanged status (webhook backstop)', async () => {
      prisma.booking.findUnique
        .mockResolvedValueOnce({
          id: 'b1',
          status: BookingStatus.ON_HOLD,
          publicRef: 'pub-1',
        })
        .mockResolvedValueOnce({
          status: BookingStatus.ON_HOLD,
          publicRef: 'pub-1',
        });
      prisma.payment.findFirst.mockResolvedValue({ intentId: 'pi_1' });
      stripe.retrievePaymentIntent.mockRejectedValue(new Error('stripe down'));

      const res = await svc.settleFromReturn('pub-1');

      expect(res.status).toBe(BookingStatus.ON_HOLD);
      expect(bookings.confirmFromPayment).not.toHaveBeenCalled();
    });

    it('404s an unknown publicRef', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      await expect(svc.settleFromReturn('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('applies the per-target rate limit before touching Stripe', async () => {
      const limitErr = new Error('too many');
      targetLimiter.consume.mockImplementation(() => {
        throw limitErr;
      });
      await expect(svc.settleFromReturn('pub-1')).rejects.toBe(limitErr);
      expect(targetLimiter.consume).toHaveBeenCalledWith(
        'settle',
        'pub-1',
        expect.any(Array),
      );
      expect(prisma.booking.findUnique).not.toHaveBeenCalled();
      expect(stripe.retrievePaymentIntent).not.toHaveBeenCalled();
    });
  });
});
