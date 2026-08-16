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
  UnprocessableEntityException,
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
    mollieWebhookEvent: { upsert: jest.fn(), update: jest.fn() },
    // No row → activeProvider falls back to STRIPE (the default).
    paymentSettings: { findUnique: jest.fn().mockResolvedValue(null) },
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
  let mollie: any;
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
    mollie = {
      isConfigured: jest.fn().mockResolvedValue(true),
      paymentMethods: jest.fn().mockResolvedValue([]),
      componentsProfile: jest
        .fn()
        .mockResolvedValue({ profileId: 'pfl_test', testmode: true }),
      createPayment: jest.fn(),
      getPayment: jest.fn(),
      createRefund: jest.fn(),
    };
    bookings = { confirmFromPayment: jest.fn().mockResolvedValue(undefined) };
    targetLimiter = { consume: jest.fn() };
    svc = new PaymentsService(prisma, stripe, mollie, bookings, targetLimiter);
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

    // Operator-conditions gate (Pastel #80 / MCK-20): the intent endpoint is
    // the enforcing half of the checkout checkbox - a flagged tour's booking
    // takes no intent until acceptance evidence is on the record.
    it('refuses a flagged tour without acceptance evidence (Pastel #80)', async () => {
      prisma.booking.findUnique.mockResolvedValue(
        booking({
          tour: { operatorTermsKind: 'DOCUMENT' },
          operatorTermsAcceptedAt: null,
        }),
      );
      await expect(svc.createIntentForBooking('b1')).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(stripe.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('charges a flagged tour once acceptance is stamped', async () => {
      prisma.booking.findUnique.mockResolvedValue(
        booking({
          tour: { operatorTermsKind: 'ACKNOWLEDGMENT' },
          operatorTermsAcceptedAt: new Date('2030-06-01T09:00:00.000Z'),
        }),
      );
      const res = await svc.createIntentForBooking('b1');
      expect(res).toMatchObject({ paymentRequired: true });
    });

    it('an ungated tour needs no acceptance (the whole-catalog default)', async () => {
      prisma.booking.findUnique.mockResolvedValue(booking());
      const res = await svc.createIntentForBooking('b1');
      expect(res).toMatchObject({ paymentRequired: true });
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

  describe('createIntentForBooking (Mollie active)', () => {
    // With CORS_ORIGINS unset the allow-list defaults to http://localhost:3000.
    const returnUrl =
      'http://localhost:3000/curacao/t/checkout/processing?ref=p1';

    beforeEach(() => {
      prisma.paymentSettings.findUnique.mockResolvedValue({
        activeProvider: PaymentProvider.MOLLIE,
      });
      prisma.payment.findUnique = jest.fn().mockResolvedValue(null);
      mollie.createPayment.mockResolvedValue({
        id: 'tr_new',
        status: 'open',
        _links: { checkout: { href: 'https://mollie.test/checkout/tr_new' } },
      });
    });

    it('creates a hosted-checkout payment and returns its redirect URL', async () => {
      prisma.booking.findUnique.mockResolvedValue(booking());

      const res = await svc.createIntentForBooking('b1', { returnUrl });

      // Decimal string amount in the BOOKING currency, never minor units.
      expect(mollie.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'EUR',
          redirectUrl: returnUrl,
          metadata: expect.objectContaining({ bookingId: 'b1' }),
        }),
      );
      expect(
        (
          mollie.createPayment.mock.calls[0][0].amount as Prisma.Decimal
        ).toFixed(2),
      ).toBe('41.99');
      expect(res).toMatchObject({
        paymentRequired: true,
        provider: PaymentProvider.MOLLIE,
        checkoutUrl: 'https://mollie.test/checkout/tr_new',
        kind: PaymentKind.DEPOSIT,
        amount: '41.99',
      });
      expect(res.clientSecret).toBeUndefined();
      // The charge row is stamped MOLLIE so webhook/refund route by the row.
      expect(prisma.payment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            provider: PaymentProvider.MOLLIE,
            intentId: 'tr_new',
          }),
        }),
      );
      expect(stripe.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('reuses a still-open Mollie payment instead of creating a new one', async () => {
      prisma.booking.findUnique.mockResolvedValue(booking());
      prisma.payment.findUnique = jest.fn().mockResolvedValue({
        provider: PaymentProvider.MOLLIE,
        intentId: 'tr_old',
      });
      mollie.getPayment.mockResolvedValue({
        id: 'tr_old',
        status: 'open',
        _links: { checkout: { href: 'https://mollie.test/checkout/tr_old' } },
      });

      const res = await svc.createIntentForBooking('b1', { returnUrl });

      expect(res.checkoutUrl).toBe('https://mollie.test/checkout/tr_old');
      expect(mollie.createPayment).not.toHaveBeenCalled();
    });

    it('returns SUCCEEDED with no checkout URL when the payment is already paid', async () => {
      prisma.booking.findUnique.mockResolvedValue(booking());
      prisma.payment.findUnique = jest.fn().mockResolvedValue({
        provider: PaymentProvider.MOLLIE,
        intentId: 'tr_old',
      });
      mollie.getPayment.mockResolvedValue({
        id: 'tr_old',
        status: 'paid',
        _links: {},
      });

      const res = await svc.createIntentForBooking('b1', { returnUrl });

      expect(res.status).toBe(PaymentStatus.SUCCEEDED);
      expect(res.checkoutUrl).toBeUndefined();
      expect(mollie.createPayment).not.toHaveBeenCalled();
    });

    it('replaces a dead (expired) payment with a FRESH idempotency key', async () => {
      prisma.booking.findUnique.mockResolvedValue(booking());
      prisma.payment.findUnique = jest.fn().mockResolvedValue({
        provider: PaymentProvider.MOLLIE,
        intentId: 'tr_dead',
      });
      mollie.getPayment.mockResolvedValue({
        id: 'tr_dead',
        status: 'expired',
        _links: {},
      });

      await svc.createIntentForBooking('b1', { returnUrl });

      const key = mollie.createPayment.mock.calls[0][0]
        .idempotencyKey as string;
      expect(key).not.toBe('mp_b1_DEPOSIT'); // never replay the dead payment
      expect(key.startsWith('mp_b1_DEPOSIT_')).toBe(true);
    });

    it('phase 1 (no returnUrl) returns Components setup WITHOUT creating a payment', async () => {
      prisma.booking.findUnique.mockResolvedValue(booking());

      const res = await svc.createIntentForBooking('b1');

      expect(res).toMatchObject({
        paymentRequired: true,
        provider: PaymentProvider.MOLLIE,
        profileId: 'pfl_test',
        testmode: true,
        amount: '41.99',
        status: PaymentStatus.REQUIRES_PAYMENT,
      });
      expect(res.checkoutUrl).toBeUndefined();
      expect(mollie.createPayment).not.toHaveBeenCalled();
      expect(prisma.payment.upsert).not.toHaveBeenCalled();
    });

    it('phase 1 omits profileId when Components are not configured (hosted fallback)', async () => {
      prisma.booking.findUnique.mockResolvedValue(booking());
      mollie.componentsProfile.mockResolvedValue({
        profileId: null,
        testmode: false,
      });

      const res = await svc.createIntentForBooking('b1');

      expect(res.provider).toBe(PaymentProvider.MOLLIE);
      expect(res.profileId).toBeUndefined();
    });

    it('passes the Components cardToken through and NEVER reuses an old open payment for it', async () => {
      prisma.booking.findUnique.mockResolvedValue(booking());
      prisma.payment.findUnique = jest.fn().mockResolvedValue({
        provider: PaymentProvider.MOLLIE,
        intentId: 'tr_old',
      });
      // Old payment is still open - but the token belongs to the card just
      // typed, so a fresh creditcard payment must be created anyway.
      mollie.getPayment.mockResolvedValue({
        id: 'tr_old',
        status: 'open',
        _links: { checkout: { href: 'https://mollie.test/checkout/tr_old' } },
      });
      mollie.createPayment.mockResolvedValue({
        id: 'tr_card',
        status: 'open',
        _links: { checkout: { href: 'https://mollie.test/3ds/tr_card' } },
      });

      const res = await svc.createIntentForBooking('b1', {
        returnUrl,
        cardToken: 'tkn_abc',
      });

      expect(mollie.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({ cardToken: 'tkn_abc' }),
      );
      expect(res.checkoutUrl).toBe('https://mollie.test/3ds/tr_card');
    });

    it('accepts a tokenized payment with NO checkout link when 3DS was frictionless (paid)', async () => {
      prisma.booking.findUnique.mockResolvedValue(booking());
      mollie.createPayment.mockResolvedValue({
        id: 'tr_instant',
        status: 'paid',
        _links: {},
      });

      const res = await svc.createIntentForBooking('b1', {
        returnUrl,
        cardToken: 'tkn_abc',
      });

      expect(res.status).toBe(PaymentStatus.SUCCEEDED);
      expect(res.checkoutUrl).toBeUndefined();
    });

    it('rejects a returnUrl outside the CORS allow-list (open-redirect guard)', async () => {
      prisma.booking.findUnique.mockResolvedValue(booking());
      await expect(
        svc.createIntentForBooking('b1', {
          returnUrl: 'https://evil.example/phish',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when Mollie is not configured', async () => {
      prisma.booking.findUnique.mockResolvedValue(booking());
      mollie.isConfigured.mockResolvedValue(false);
      await expect(
        svc.createIntentForBooking('b1', { returnUrl }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('still requires no payment for OPERATOR_FULL', async () => {
      prisma.booking.findUnique.mockResolvedValue(
        booking({ paymentModel: PaymentModel.OPERATOR_FULL }),
      );
      const res = await svc.createIntentForBooking('b1', { returnUrl });
      expect(res.paymentRequired).toBe(false);
      expect(mollie.createPayment).not.toHaveBeenCalled();
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
      expect(bookings.confirmFromPayment).toHaveBeenCalledWith(
        'b1',
        {
          country: 'CW',
          postalCode: '0000',
          city: 'Willemstad',
          last4: '4242',
          brand: 'visa',
        },
        undefined,
      );
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
        undefined,
      );
    });

    it('derives the charge FX from an EUR balance transaction (5C reconciliation)', async () => {
      stripe.constructEvent.mockResolvedValue({
        id: 'evt_fx',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_1',
            metadata: { bookingId: 'b1' },
            latest_charge: {
              id: 'ch_1',
              billing_details: {},
              payment_method_details: { type: 'card', card: {} },
              // Stripe's ACTUAL presentment->settlement conversion (USD charge
              // on an EUR-settled account).
              balance_transaction: {
                currency: 'eur',
                exchange_rate: 0.9134,
                created: 1_753_437_600,
              },
            },
          },
        },
      });
      prisma.stripeWebhookEvent.create.mockResolvedValue({});

      await svc.handleWebhook(rawBody, 'sig');

      expect(bookings.confirmFromPayment).toHaveBeenCalledWith(
        'b1',
        expect.anything(),
        {
          rateToEur: new Prisma.Decimal(0.9134),
          provider: 'stripe',
          asOf: new Date(1_753_437_600 * 1000),
        },
      );
    });

    it('passes NO charge FX when Stripe settles in a non-EUR currency', async () => {
      stripe.constructEvent.mockResolvedValue({
        id: 'evt_fx2',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_1',
            metadata: { bookingId: 'b1' },
            latest_charge: {
              id: 'ch_1',
              billing_details: {},
              payment_method_details: { type: 'card', card: {} },
              // A USD-settled account: the rate converts to the WRONG currency
              // for our EUR normalization - must fall back to the ECB snapshot.
              balance_transaction: {
                currency: 'usd',
                exchange_rate: 1.0812,
                created: 1_753_437_600,
              },
            },
          },
        },
      });
      prisma.stripeWebhookEvent.create.mockResolvedValue({});

      await svc.handleWebhook(rawBody, 'sig');

      expect(bookings.confirmFromPayment).toHaveBeenCalledWith(
        'b1',
        expect.anything(),
        undefined,
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
      expect(bookings.confirmFromPayment).toHaveBeenCalledWith(
        'b1',
        undefined,
        undefined,
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

    // Async refund lifecycle (B5 hardening): executeRefund records bank-method
    // refunds as PROCESSING; these events are where they settle or fail.
    it('reconciles an in-flight refund to REFUNDED on refund.updated (+ flips the original charge)', async () => {
      stripe.constructEvent.mockResolvedValue({
        id: 'evt_r1',
        type: 'refund.updated',
        data: { object: { id: 're_1', status: 'succeeded' } },
      });
      prisma.stripeWebhookEvent.create.mockResolvedValue({});
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay_r1',
        bookingId: 'b1',
        intentId: 'pi_1',
      });
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });

      await svc.handleWebhook(rawBody, 'sig');

      // Only an in-flight row settles; a FAILED refund never resurrects.
      expect(prisma.payment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            refundId: 're_1',
            kind: PaymentKind.REFUND,
            status: { in: [PaymentStatus.PROCESSING] },
          },
        }),
      );
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { id: 'pay_r1', status: { in: [PaymentStatus.PROCESSING] } },
        data: { status: PaymentStatus.REFUNDED },
      });
      // The ORIGINAL charge row flips to REFUNDED at the same settle point.
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: {
          bookingId: 'b1',
          kind: { not: PaymentKind.REFUND },
          intentId: 'pi_1',
          status: PaymentStatus.SUCCEEDED,
        },
        data: { status: PaymentStatus.REFUNDED },
      });
    });

    it('flips a refund to FAILED on refund.failed - even after settling (late bank failure)', async () => {
      stripe.constructEvent.mockResolvedValue({
        id: 'evt_r2',
        type: 'refund.failed',
        data: { object: { id: 're_1', status: 'failed' } },
      });
      prisma.stripeWebhookEvent.create.mockResolvedValue({});
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay_r1',
        bookingId: 'b1',
        intentId: 'pi_1',
      });
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });

      await svc.handleWebhook(rawBody, 'sig');

      const failFrom = [
        PaymentStatus.PROCESSING,
        PaymentStatus.REFUNDED,
        PaymentStatus.SUCCEEDED,
      ];
      expect(prisma.payment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            refundId: 're_1',
            kind: PaymentKind.REFUND,
            status: { in: failFrom },
          },
        }),
      );
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { id: 'pay_r1', status: { in: failFrom } },
        data: { status: PaymentStatus.FAILED },
      });
      // The money never left after all - the original charge stands again.
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: {
          bookingId: 'b1',
          kind: { not: PaymentKind.REFUND },
          intentId: 'pi_1',
          status: PaymentStatus.REFUNDED,
        },
        data: { status: PaymentStatus.SUCCEEDED },
      });
    });

    it('ignores a still-pending refund.updated (no new information)', async () => {
      stripe.constructEvent.mockResolvedValue({
        id: 'evt_r3',
        type: 'refund.updated',
        data: { object: { id: 're_1', status: 'pending' } },
      });
      prisma.stripeWebhookEvent.create.mockResolvedValue({});

      await svc.handleWebhook(rawBody, 'sig');

      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('handleMollieWebhook', () => {
    /** A fetched Mollie payment (the webhook only delivers the id). */
    const molliePayment = (over: Record<string, unknown> = {}) => ({
      id: 'tr_abc',
      status: 'paid',
      method: 'creditcard',
      metadata: {
        bookingId: 'b1',
        displayRef: 'IT-2026-AAAA',
        kind: 'DEPOSIT',
      },
      details: {
        cardNumber: '4242',
        cardLabel: 'Visa',
        cardCountryCode: 'NL',
      },
      _embedded: { refunds: [] },
      _links: {},
      ...over,
    });

    beforeEach(() => {
      prisma.mollieWebhookEvent.upsert.mockResolvedValue({});
      prisma.mollieWebhookEvent.update.mockResolvedValue({});
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    });

    it('fetches the payment, marks it SUCCEEDED, and confirms the booking (paid)', async () => {
      mollie.getPayment.mockResolvedValue(molliePayment());

      await svc.handleMollieWebhook('tr_abc');

      // Verification = fetching with OUR key; the request body is never trusted.
      expect(mollie.getPayment).toHaveBeenCalledWith('tr_abc');
      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            intentId: 'tr_abc',
            kind: { not: PaymentKind.REFUND },
            // A refunded charge is never resurrected by a re-posted `paid`.
            status: { not: PaymentStatus.REFUNDED },
          },
          data: expect.objectContaining({
            status: PaymentStatus.SUCCEEDED,
            methodType: 'creditcard',
          }),
        }),
      );
      // Card/billing snapshot from the Mollie card details.
      expect(bookings.confirmFromPayment).toHaveBeenCalledWith(
        'b1',
        {
          country: 'NL',
          postalCode: null,
          city: null,
          last4: '4242',
          brand: 'Visa',
        },
        undefined,
      );
      expect(prisma.mollieWebhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'tr_abc' } }),
      );
    });

    it('derives the charge FX from settlementAmount (5C reconciliation)', async () => {
      mollie.getPayment.mockResolvedValue(
        molliePayment({
          amount: { value: '100.00', currency: 'USD' },
          // Mollie's actual conversion to the EUR-settled account.
          settlementAmount: { value: '91.34', currency: 'EUR' },
          paidAt: '2026-07-25T10:00:00+00:00',
        }),
      );

      await svc.handleMollieWebhook('tr_abc');

      expect(bookings.confirmFromPayment).toHaveBeenCalledWith(
        'b1',
        expect.anything(),
        {
          rateToEur: new Prisma.Decimal('91.34').div('100.00'),
          provider: 'mollie',
          asOf: new Date('2026-07-25T10:00:00+00:00'),
        },
      );
    });

    it('passes NO charge FX for an EUR-charged payment (nothing was converted)', async () => {
      mollie.getPayment.mockResolvedValue(
        molliePayment({
          amount: { value: '50.00', currency: 'EUR' },
          settlementAmount: { value: '50.00', currency: 'EUR' },
        }),
      );

      await svc.handleMollieWebhook('tr_abc');

      expect(bookings.confirmFromPayment).toHaveBeenCalledWith(
        'b1',
        expect.anything(),
        undefined,
      );
    });

    it('re-processes a redelivered id (Mollie re-posts the SAME id on later transitions)', async () => {
      mollie.getPayment.mockResolvedValue(molliePayment());

      await svc.handleMollieWebhook('tr_abc');
      await svc.handleMollieWebhook('tr_abc');

      // No P2002 short-circuit: both deliveries reconcile.
      expect(mollie.getPayment).toHaveBeenCalledTimes(2);
      expect(prisma.mollieWebhookEvent.upsert).toHaveBeenCalledTimes(2);
    });

    it('marks the charge FAILED on failed/canceled/expired and does NOT confirm', async () => {
      mollie.getPayment.mockResolvedValue(molliePayment({ status: 'expired' }));

      await svc.handleMollieWebhook('tr_abc');

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: PaymentStatus.FAILED },
        }),
      );
      expect(bookings.confirmFromPayment).not.toHaveBeenCalled();
    });

    it('reconciles embedded refunds (settled bank refund -> REFUNDED row)', async () => {
      mollie.getPayment.mockResolvedValue(
        molliePayment({
          _embedded: {
            refunds: [{ id: 're_m1', status: 'refunded' }],
          },
        }),
      );
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay_m1',
        bookingId: 'b1',
        intentId: 'tr_abc',
      });

      await svc.handleMollieWebhook('tr_abc');

      expect(prisma.payment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            refundId: 're_m1',
            kind: PaymentKind.REFUND,
            status: { in: [PaymentStatus.PROCESSING] },
          }),
        }),
      );
      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay_m1', status: { in: [PaymentStatus.PROCESSING] } },
          data: { status: PaymentStatus.REFUNDED },
        }),
      );
    });

    it('ignores an unknown payment id (fetch 404) but still marks the event processed', async () => {
      const { MollieApiError } = jest.requireActual('@mollie/api-client');
      const notFound = Object.assign(
        Object.create(MollieApiError.prototype) as Error,
        { message: 'not found', statusCode: 404 },
      );
      mollie.getPayment.mockRejectedValue(notFound);

      await svc.handleMollieWebhook('tr_forged');

      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
      expect(bookings.confirmFromPayment).not.toHaveBeenCalled();
      expect(prisma.mollieWebhookEvent.update).toHaveBeenCalled();
    });

    it('rethrows a transient fetch failure so Mollie redelivers (processedAt stays null)', async () => {
      mollie.getPayment.mockRejectedValue(new Error('mollie down'));

      await expect(svc.handleMollieWebhook('tr_abc')).rejects.toThrow(
        'mollie down',
      );
      expect(prisma.mollieWebhookEvent.update).not.toHaveBeenCalled();
    });

    it('is a safe no-op when Mollie is not configured', async () => {
      mollie.isConfigured.mockResolvedValue(false);

      await svc.handleMollieWebhook('tr_abc');

      expect(mollie.getPayment).not.toHaveBeenCalled();
      expect(prisma.mollieWebhookEvent.update).toHaveBeenCalled();
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
        undefined,
      );
      expect(res).toEqual({
        status: BookingStatus.CONFIRMED,
        publicRef: 'pub-1',
        paymentFailed: false,
      });
    });

    it('flags paymentFailed when the Mollie payment failed (traveller returns to checkout)', async () => {
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
      prisma.payment.findFirst.mockResolvedValue({
        intentId: 'tr_1',
        provider: PaymentProvider.MOLLIE,
        status: PaymentStatus.REQUIRES_PAYMENT,
      });
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });
      mollie.getPayment.mockResolvedValue({
        id: 'tr_1',
        status: 'failed',
        metadata: { bookingId: 'b1' },
        details: null,
        _embedded: { refunds: [] },
      });

      const res = await svc.settleFromReturn('pub-1');

      expect(res.paymentFailed).toBe(true);
      expect(res.status).toBe(BookingStatus.ON_HOLD);
      expect(bookings.confirmFromPayment).not.toHaveBeenCalled();
    });

    it('flags paymentFailed when the Stripe intent carries a last_payment_error', async () => {
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
      prisma.payment.findFirst.mockResolvedValue({
        intentId: 'pi_1',
        provider: PaymentProvider.STRIPE,
        status: PaymentStatus.REQUIRES_PAYMENT,
      });
      stripe.retrievePaymentIntent.mockResolvedValue({
        id: 'pi_1',
        // A failed redirect-return: back at requires_payment_method WITH the error.
        status: 'requires_payment_method',
        last_payment_error: { code: 'payment_intent_authentication_failure' },
        metadata: { bookingId: 'b1' },
      });

      const res = await svc.settleFromReturn('pub-1');

      expect(res.paymentFailed).toBe(true);
      expect(bookings.confirmFromPayment).not.toHaveBeenCalled();
    });

    it('does NOT flag a fresh unconfirmed intent as failed (no error yet)', async () => {
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
      prisma.payment.findFirst.mockResolvedValue({
        intentId: 'pi_1',
        provider: PaymentProvider.STRIPE,
        status: PaymentStatus.REQUIRES_PAYMENT,
      });
      stripe.retrievePaymentIntent.mockResolvedValue({
        id: 'pi_1',
        status: 'requires_payment_method',
        last_payment_error: null,
        metadata: { bookingId: 'b1' },
      });

      const res = await svc.settleFromReturn('pub-1');

      expect(res.paymentFailed).toBe(false);
    });

    it('settles a MOLLIE charge by re-fetching the Mollie payment (routes by the row provider)', async () => {
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
      prisma.payment.findFirst.mockResolvedValue({
        intentId: 'tr_1',
        provider: PaymentProvider.MOLLIE,
      });
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });
      mollie.getPayment.mockResolvedValue({
        id: 'tr_1',
        status: 'paid',
        method: 'ideal',
        metadata: { bookingId: 'b1' },
        details: null,
        _embedded: { refunds: [] },
      });

      const res = await svc.settleFromReturn('pub-1');

      expect(mollie.getPayment).toHaveBeenCalledWith('tr_1');
      expect(stripe.retrievePaymentIntent).not.toHaveBeenCalled();
      expect(bookings.confirmFromPayment).toHaveBeenCalledWith(
        'b1',
        undefined,
        undefined,
      );
      expect(res.status).toBe(BookingStatus.CONFIRMED);
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
