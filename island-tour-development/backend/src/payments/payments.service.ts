import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type Stripe from 'stripe';
import {
  MollieApiError,
  type Payment as MolliePayment,
} from '@mollie/api-client';
import {
  BookingStatus,
  Currency,
  PaymentKind,
  PaymentModel,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  Role,
  SettlementStatus,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { BookingsService, type ChargeFx } from '@/bookings/bookings.service';
import { TargetRateLimiter } from '@/bookings/lookup-rate-limiter';
import {
  isPlatformWideBookingRole,
  resolveOperatorId,
} from '@/common/utils/operator.util';
import { assertDateRangeOrder } from '@/common/utils/date-range.util';
import { dateKey } from '@/common/utils/timezone.util';
import { parseCorsOrigins } from '@/common/utils/parse-cors-origins';
import { settlementMethodFor } from '@/settlements/dto/settlement.dto';
import {
  mapMollieRefundStatus,
  mapStripeRefundStatus,
} from './refund-status.util';
import { MollieService } from './mollie.service';
import { StripeService, toMinorUnits } from './stripe.service';
import type {
  CreatePaymentIntentDto,
  ListPaymentsQueryDto,
  PaymentIntentResponseDto,
} from './dto/payment.dto';

/**
 * Payments - Stripe/Mollie charges per booking + idempotent webhook settlement.
 * The admin-selected `payment_settings.activeProvider` decides which PSP takes
 * NEW charges (Stripe = inline Elements, Mollie = hosted redirect); existing
 * payments always route by their OWN provider.
 *
 * The platform collects only its slice up front (master rule #21):
 * - OPERATOR_LINK / ON_ARRIVAL → deposit (`depositAmount`); operator collects the
 *   balance (payment link vs on-site/cash on arrival). Both are deposit models.
 * - PAID_IN_FULL  → the whole `totalRetail`.
 * - OPERATOR_FULL → no charge (paymentRequired = false; dropped for v1 at reserve).
 *
 * A booking is truly CONFIRMED when its charge succeeds: the webhook calls
 * `BookingsService.confirmFromPayment`, which fires the EUR conversion (rule #22).
 * Stripe webhooks are signature-verified and idempotent via `stripe_webhook_events`;
 * Mollie webhooks are verified by RE-FETCHING the payment (they carry only an id)
 * and are idempotent via state-guarded transitions, not the event ledger.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly mollie: MollieService,
    private readonly bookings: BookingsService,
    private readonly targetLimiter: TargetRateLimiter,
  ) {}

  /**
   * The admin-selected checkout PSP (payment_settings singleton). Only intent
   * CREATION branches on this - webhooks and refunds always route by the
   * Payment ROW's provider, so a switch is never retroactive.
   */
  private async activeProvider(): Promise<PaymentProvider> {
    const row = await this.prisma.paymentSettings.findUnique({
      where: { id: 'default' },
      select: { activeProvider: true },
    });
    return row?.activeProvider ?? PaymentProvider.STRIPE;
  }

  // ── Dashboard payments list ──────────────────────────────────────────────────

  /**
   * Paginated payments for the dashboard Payments table. ADMIN sees every
   * payment; TOUR_OPERATOR only payments on bookings of their own tours (scoped
   * via `booking.operatorId`, mirroring `BookingsService.list`); USER
   * (customers) only payments on their OWN bookings (`booking.userId`). That
   * last branch is a scoping GUARD, not a live surface: travellers read their
   * payments through the public `/bookings/traveller/payments` route now, and
   * cannot sign in here at all. It stays so a stray USER session self-scopes
   * rather than falling through to operator resolution.
   */
  async list(query: ListPaymentsQueryDto, actor: { id: string; role: Role }) {
    assertDateRangeOrder(query.from, query.to);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.PaymentWhereInput = {};
    if (actor.role === Role.USER) {
      where.booking = { userId: actor.id };
    } else if (!isPlatformWideBookingRole(actor.role)) {
      // Platform-wide roles (ADMIN/STAFF/EDITOR) have no operator record to
      // resolve; routing them through resolution would 400 them out of data
      // the VIEW_PAYMENTS grant already entitles them to.
      where.booking = {
        operatorId: await resolveOperatorId(this.prisma, actor.id, actor.role),
      };
    }
    if (query.status) where.status = query.status;
    if (query.kind) where.kind = query.kind;
    if (query.provider) where.provider = query.provider;
    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { intentId: { contains: q, mode: 'insensitive' } },
        { booking: { displayRef: { contains: q, mode: 'insensitive' } } },
        { booking: { publicRef: { contains: q, mode: 'insensitive' } } },
        { booking: { contactFullName: { contains: q, mode: 'insensitive' } } },
        { booking: { contactEmail: { contains: q, mode: 'insensitive' } } },
        { booking: { tour: { name: { contains: q, mode: 'insensitive' } } } },
      ];
    }
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from)
        where.createdAt.gte = new Date(`${query.from}T00:00:00.000Z`);
      if (query.to) where.createdAt.lte = new Date(`${query.to}T23:59:59.999Z`);
    }

    const [total, rows] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        select: {
          id: true,
          bookingId: true,
          provider: true,
          kind: true,
          status: true,
          amount: true,
          currency: true,
          intentId: true,
          methodType: true,
          createdAt: true,
          updatedAt: true,
          booking: {
            select: {
              displayRef: true,
              publicRef: true,
              contactFullName: true,
              localDate: true,
              paymentModel: true,
              status: true,
              utcCancellationRequestedAt: true,
              utcCancelledAt: true,
              tour: { select: { name: true } },
              settlement: { select: { status: true, paymentModel: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      total,
      page,
      limit,
      data: rows.map((p) => ({
        id: p.id,
        bookingId: p.bookingId,
        provider: p.provider,
        kind: p.kind,
        status: p.status,
        amount: p.amount.toString(),
        currency: p.currency,
        intentId: p.intentId,
        methodType: p.methodType,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        bookingDisplayRef: p.booking.displayRef,
        bookingPublicRef: p.booking.publicRef,
        tourName: p.booking.tour.name,
        contactFullName: p.booking.contactFullName,
        bookingLocalDate: dateKey(p.booking.localDate),
        paymentModel: p.booking.paymentModel,
        settlementStatus: p.booking.settlement?.status ?? null,
        settlementMethod: settlementMethodFor(p.booking.paymentModel),
        // Payout HELD by a pending cancellation request - same predicate as the
        // Settlements page, so the badge reads "On hold" wherever it shows.
        settlementHeld:
          p.booking.settlement?.status === SettlementStatus.RECORDED &&
          p.booking.settlement.paymentModel === PaymentModel.PAID_IN_FULL &&
          p.booking.status === BookingStatus.CONFIRMED &&
          p.booking.utcCancellationRequestedAt != null &&
          p.booking.utcCancelledAt == null,
      })),
    };
  }

  // ── Create / fetch the up-front PaymentIntent ────────────────────────────────

  async createIntentForBooking(
    bookingId: string,
    dto?: CreatePaymentIntentDto,
  ): Promise<PaymentIntentResponseDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        displayRef: true,
        status: true,
        paymentModel: true,
        currency: true,
        depositAmount: true,
        totalRetail: true,
        tourId: true,
        customerLocale: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.EXPIRED
    ) {
      throw new BadRequestException(
        `Cannot pay for a ${booking.status} booking`,
      );
    }

    const charge = chargeFor(
      booking.paymentModel,
      booking.depositAmount,
      booking.totalRetail,
    );
    if (!charge || charge.amount.lte(0)) {
      return { paymentRequired: false }; // OPERATOR_FULL / nothing due
    }

    // The admin-selected PSP takes the charge; everything downstream (webhook,
    // settle, refund) routes by the Payment row's provider, never this switch.
    if ((await this.activeProvider()) === PaymentProvider.MOLLIE) {
      return this.createMollieCheckout(booking, charge, dto);
    }
    return this.createStripeIntent(booking, charge);
  }

  /** Stripe leg: inline Elements - returns a client secret for Stripe.js. */
  private async createStripeIntent(
    booking: ChargeableBooking,
    charge: { amount: Prisma.Decimal; kind: PaymentKind },
  ): Promise<PaymentIntentResponseDto> {
    if (!(await this.stripe.isConfigured())) {
      throw new ServiceUnavailableException('Payments are not configured');
    }

    // Idempotent: the same (booking, kind) always maps to one PaymentIntent.
    const idempotencyKey = `pi_${booking.id}_${charge.kind}`;
    // Automatic payment methods: Stripe enables only methods that are BOTH activated
    // on the account AND compatible with this currency - so it can't hit the
    // currency/method conflicts an explicit list does (e.g. Klarna is USD-only and
    // would reject an EUR intent). Card is collected inline via Card Elements +
    // confirmCardPayment (no Stripe UI); PayPal/iDEAL confirm client-side and
    // redirect. We return `paymentMethodTypes` so the checkout only offers eligible
    // methods (the rest are hidden/disabled with a hint).
    const intent = await this.stripe.createPaymentIntent({
      amount: toMinorUnits(charge.amount),
      currency: booking.currency,
      idempotencyKey,
      metadata: {
        bookingId: booking.id,
        displayRef: booking.displayRef,
        kind: charge.kind,
      },
    });

    await this.upsertChargeRow(booking, charge, {
      provider: PaymentProvider.STRIPE,
      intentId: intent.id,
      status: mapIntentStatus(intent.status),
    });

    return {
      paymentRequired: true,
      provider: PaymentProvider.STRIPE,
      clientSecret: intent.client_secret ?? undefined,
      publishableKey: (await this.stripe.publishableKey()) ?? undefined,
      amount: charge.amount.toString(),
      currency: booking.currency,
      kind: charge.kind,
      status: mapIntentStatus(intent.status),
      // Eligible methods for this booking (account-activated + currency-compatible).
      // The checkout offers only these; card is confirmed inline, PayPal/iDEAL redirect.
      paymentMethodTypes: intent.payment_method_types ?? [],
    };
  }

  /**
   * Mollie leg - TWO-PHASE:
   *
   * Phase 1 (no `returnUrl`): SETUP. No Mollie payment is created yet - the
   * response carries the Components profile (profileId/testmode) so the
   * checkout can render the INLINE card form (mollie.js tokenization). With no
   * profileId configured the frontend falls straight through to phase 2.
   *
   * Phase 2 (`returnUrl` present): CREATE. With a `cardToken` the payment is a
   * `creditcard` charge for the card typed on OUR page and the returned
   * checkout URL is only the 3DS hop; without one it is the hosted page
   * (method selection on Mollie's side). Either way the traveller lands back
   * on `returnUrl` (the processing page) where settle-on-return + polling take
   * over; the webhook stays the backstop exactly like Stripe.
   */
  private async createMollieCheckout(
    booking: ChargeableBooking,
    charge: { amount: Prisma.Decimal; kind: PaymentKind },
    dto?: CreatePaymentIntentDto,
  ): Promise<PaymentIntentResponseDto> {
    if (!(await this.mollie.isConfigured())) {
      throw new ServiceUnavailableException('Payments are not configured');
    }

    // ── Phase 1: setup for the payment step (no money movement) ──────────────
    if (!dto?.returnUrl) {
      const profile = await this.mollie.componentsProfile();
      return {
        paymentRequired: true,
        provider: PaymentProvider.MOLLIE,
        profileId: profile.profileId ?? undefined,
        testmode: profile.testmode,
        amount: charge.amount.toString(),
        currency: booking.currency,
        kind: charge.kind,
        status: PaymentStatus.REQUIRES_PAYMENT,
        paymentMethodTypes: await this.mollie.paymentMethods(),
      };
    }

    // ── Phase 2: create the payment ──────────────────────────────────────────
    const redirectUrl = assertAllowedRedirect(dto.returnUrl);
    const cancelUrl = dto.cancelUrl
      ? assertAllowedRedirect(dto.cancelUrl)
      : undefined;

    const rowId = paymentRowId(booking.id, charge.kind);
    const existing = await this.prisma.payment.findUnique({
      where: { id: rowId },
      select: { provider: true, intentId: true },
    });

    // Reuse a still-open Mollie payment (retried Continue, edit round): the
    // hosted checkout URL stays valid while the payment is `open`. A paid one
    // returns SUCCEEDED with no URL - the browser goes straight to processing.
    // NEVER reuse when a cardToken arrives: the token belongs to the card just
    // typed, and an old open payment would 3DS-authenticate the WRONG card.
    if (existing?.provider === PaymentProvider.MOLLIE && existing.intentId) {
      try {
        const current = await this.mollie.getPayment(existing.intentId);
        if (current.status === 'paid') {
          return this.mollieResponse(booking, charge, current, undefined);
        }
        const checkoutUrl = current._links.checkout?.href;
        if (!dto.cardToken && current.status === 'open' && checkoutUrl) {
          return this.mollieResponse(booking, charge, current, checkoutUrl);
        }
        // failed / canceled / expired / token supplied → create a fresh payment.
      } catch (err) {
        this.logger.warn(
          `Could not re-fetch Mollie payment ${existing.intentId} - creating a fresh one (${(err as Error).message})`,
        );
      }
    }

    // A replacement for a prior payment must NOT reuse the first attempt's
    // idempotency key - Mollie would replay the old payment from its cache.
    const idempotencyKey = existing?.intentId
      ? `mp_${booking.id}_${charge.kind}_${Date.now()}`
      : `mp_${booking.id}_${charge.kind}`;

    const payment = await this.mollie.createPayment({
      amount: charge.amount,
      currency: booking.currency,
      description: `Island Tours booking ${booking.displayRef}`,
      redirectUrl,
      cancelUrl,
      webhookUrl: mollieWebhookUrl(),
      idempotencyKey,
      metadata: {
        bookingId: booking.id,
        displayRef: booking.displayRef,
        kind: charge.kind,
      },
      locale: booking.customerLocale,
      cardToken: dto.cardToken,
    });

    const checkoutUrl = payment._links.checkout?.href;
    if (!checkoutUrl) {
      // A tokenized card payment can come back with NO checkout link when 3DS
      // is frictionless-approved instantly; paid/pending is fine (the browser
      // heads to processing). Otherwise it is unactionable for the traveller.
      if (payment.status === 'paid' || payment.status === 'pending') {
        return this.mollieResponse(booking, charge, payment, undefined);
      }
      throw new ServiceUnavailableException('Payments are not available');
    }
    return this.mollieResponse(booking, charge, payment, checkoutUrl);
  }

  /** Persist the charge row + build the intent response for a Mollie payment. */
  private async mollieResponse(
    booking: ChargeableBooking,
    charge: { amount: Prisma.Decimal; kind: PaymentKind },
    payment: MolliePayment,
    checkoutUrl: string | undefined,
  ): Promise<PaymentIntentResponseDto> {
    const status = mapMolliePaymentStatus(payment.status);
    await this.upsertChargeRow(booking, charge, {
      provider: PaymentProvider.MOLLIE,
      intentId: payment.id,
      status,
    });
    return {
      paymentRequired: true,
      provider: PaymentProvider.MOLLIE,
      checkoutUrl,
      amount: charge.amount.toString(),
      currency: booking.currency,
      kind: charge.kind,
      status,
      // Admin-enabled Mollie methods (display only - Mollie's hosted page is
      // the eligibility truth and shows exactly what this payment can use).
      paymentMethodTypes: await this.mollie.paymentMethods(),
    };
  }

  /** Deterministic (booking, kind) charge row, stamped with its provider. */
  private async upsertChargeRow(
    booking: ChargeableBooking,
    charge: { amount: Prisma.Decimal; kind: PaymentKind },
    data: {
      provider: PaymentProvider;
      intentId: string;
      status: PaymentStatus;
    },
  ): Promise<void> {
    await this.prisma.payment.upsert({
      where: { id: paymentRowId(booking.id, charge.kind) },
      create: {
        id: paymentRowId(booking.id, charge.kind),
        bookingId: booking.id,
        kind: charge.kind,
        amount: charge.amount,
        currency: booking.currency,
        ...data,
      },
      update: {
        amount: charge.amount,
        ...data,
      },
    });
  }

  // ── Webhook settlement ───────────────────────────────────────────────────────

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    let event: Stripe.Event;
    try {
      event = await this.stripe.constructEvent(rawBody, signature);
    } catch (err) {
      this.logger.error(
        `Stripe webhook signature verification failed: ${(err as Error).message}`,
      );
      throw new BadRequestException('Invalid webhook signature');
    }

    // Idempotency ledger - a redelivered event id is recorded once and skipped.
    try {
      await this.prisma.stripeWebhookEvent.create({
        data: {
          id: event.id,
          type: event.type,
          payload: event as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        this.logger.log(
          `Stripe event ${event.id} already processed - skipping`,
        );
        return;
      }
      throw err;
    }

    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.onIntentSucceeded(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.onIntentFailed(event.data.object);
          break;
        // Async refund lifecycle: bank-debit refunds (iDEAL/SEPA) are created
        // `pending` and only settle - or fail - later. These events reconcile
        // the REFUND Payment row executeRefund wrote at create time.
        case 'refund.updated':
        case 'refund.failed':
          await this.onRefundEvent(event.data.object);
          break;
        default:
          this.logger.debug(`Unhandled Stripe event type ${event.type}`);
      }
      await this.prisma.stripeWebhookEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date() },
      });
    } catch (err) {
      this.logger.error(
        `Error processing Stripe event ${event.id}`,
        err as Error,
      );
      throw err; // leave processedAt null so Stripe retries
    }
  }

  // ── Mollie webhook settlement (fetch + reconcile) ────────────────────────────

  /**
   * Reconcile a Mollie webhook delivery. Mollie posts only a payment id and no
   * signature - re-fetching the payment with OUR API key is the verification
   * (a forged id either 404s or returns its true state; nothing in the request
   * body is ever trusted).
   *
   * UNLIKE Stripe event ids, Mollie re-posts the SAME payment id on every
   * status change (paid now, refund settled days later) - so a seen id must
   * NOT short-circuit. The ledger records deliveries for observability, and
   * idempotency lives where it already does for Stripe: the state-guarded
   * transitions (`confirmFromPayment`'s atomic ON_HOLD gate, the refund
   * transition rules). Re-running a reconcile is always a no-op.
   */
  async handleMollieWebhook(paymentId: string): Promise<void> {
    if (!paymentId) throw new BadRequestException('Missing Mollie payment id');

    // Ledger row per payment id: re-delivery re-opens it (processedAt null)
    // and reconciliation re-runs - never skipped.
    await this.prisma.mollieWebhookEvent.upsert({
      where: { id: paymentId },
      create: { id: paymentId, type: 'payment', payload: { id: paymentId } },
      update: { processedAt: null },
    });

    try {
      await this.reconcileMolliePayment(paymentId);
      await this.prisma.mollieWebhookEvent.update({
        where: { id: paymentId },
        data: { processedAt: new Date() },
      });
    } catch (err) {
      this.logger.error(
        `Error processing Mollie webhook for payment ${paymentId}`,
        err as Error,
      );
      throw err; // 500 → Mollie retries with backoff
    }
  }

  /** Fetch the payment from Mollie and apply its state. */
  private async reconcileMolliePayment(paymentId: string): Promise<void> {
    if (!(await this.mollie.isConfigured())) {
      this.logger.warn(
        `Mollie webhook for ${paymentId} ignored - Mollie is not configured`,
      );
      return;
    }
    let payment: MolliePayment;
    try {
      payment = await this.mollie.getPayment(paymentId);
    } catch (err) {
      if (err instanceof MollieApiError && err.statusCode === 404) {
        // Unknown/foreign id (or a probe) - nothing of ours to reconcile.
        this.logger.warn(`Mollie payment ${paymentId} not found - ignoring`);
        return;
      }
      throw err; // transient API failure → rethrow so Mollie redelivers
    }
    await this.applyMolliePayment(payment);
  }

  /**
   * Apply a fetched Mollie payment onto our ledger - shared by the webhook and
   * settle-on-return, mirroring how both Stripe paths funnel through
   * `onIntentSucceeded`. Also reconciles the payment's EMBEDDED refunds: Mollie
   * has no separate refund events, the payment id is re-posted when a refund
   * settles or fails.
   */
  private async applyMolliePayment(payment: MolliePayment): Promise<void> {
    const bookingId = (payment.metadata as Record<string, string> | null)
      ?.bookingId;

    if (payment.status === 'paid') {
      await this.prisma.payment.updateMany({
        // Never resurrect a refunded charge: Mollie re-posts the payment id
        // when a refund settles, and the payment still reads `paid`.
        where: {
          intentId: payment.id,
          kind: { not: PaymentKind.REFUND },
          status: { not: PaymentStatus.REFUNDED },
        },
        data: {
          status: PaymentStatus.SUCCEEDED,
          ...(payment.method ? { methodType: payment.method } : {}),
        },
      });
      if (!bookingId) {
        this.logger.error(
          `Mollie payment ${payment.id} is paid without a bookingId in metadata`,
        );
      } else {
        await this.bookings.confirmFromPayment(
          bookingId,
          mollieBillingSnapshot(payment),
          mollieChargeFx(payment),
        );
      }
    } else if (
      payment.status === 'failed' ||
      payment.status === 'canceled' ||
      payment.status === 'expired'
    ) {
      // Booking stays ON_HOLD (retry or hold-expiry sweeper decides its fate) -
      // identical to a failed Stripe intent.
      await this.prisma.payment.updateMany({
        where: { intentId: payment.id, kind: { not: PaymentKind.REFUND } },
        data: { status: PaymentStatus.FAILED },
      });
      this.logger.warn(
        `Mollie payment ${payment.id} ${payment.status} for booking ${bookingId ?? 'unknown'}`,
      );
    }

    for (const refund of payment._embedded?.refunds ?? []) {
      await this.reconcileRefundRow(
        refund.id,
        mapMollieRefundStatus(refund.status),
        'Mollie',
      );
    }
  }

  // ── Synchronous settle-on-return (webhook stays the backstop) ────────────────

  /**
   * Confirm a booking straight away from the browser's return, instead of
   * waiting for the async `payment_intent.succeeded` webhook (which can lag
   * seconds-to-minutes, especially in dev). Keyed on the unguessable booking
   * id; NEVER trusts the client's word - it re-reads the PaymentIntent from
   * Stripe and only settles when Stripe itself reports `succeeded`. Idempotent
   * and safe to race the webhook: both funnel through the same
   * `onIntentSucceeded` -> `confirmFromPayment`, which no-ops once confirmed.
   *
   * Returns the current booking status so the processing page can redirect the
   * instant it reads CONFIRMED, with the card/billing snapshot already saved.
   */
  async settleFromReturn(publicRef: string): Promise<{
    status: BookingStatus;
    publicRef: string;
    paymentFailed: boolean;
  }> {
    // Per-TARGET cap (mirrors resendConfirmation / requestCancellation): the
    // per-IP throttle alone can't stop a multi-IP caller hammering ONE booking's
    // settle, which would spray the shared Stripe API. 5 per publicRef / minute.
    this.targetLimiter.consume('settle', publicRef, [
      { max: 5, windowMs: 60_000 },
    ]);

    const booking = await this.prisma.booking.findUnique({
      where: { publicRef },
      select: { id: true, status: true, publicRef: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    // Already settled (webhook won the race, or a repeat call) - nothing to do.
    if (booking.status !== BookingStatus.ON_HOLD) {
      return {
        status: booking.status,
        publicRef: booking.publicRef,
        paymentFailed: false,
      };
    }

    const payment = await this.prisma.payment.findFirst({
      where: { bookingId: booking.id, kind: { not: PaymentKind.REFUND } },
      orderBy: { createdAt: 'desc' },
      select: { intentId: true, provider: true, status: true },
    });
    // The webhook may have marked the charge FAILED before we got here; a live
    // PSP read below refines this (a retried charge can have succeeded since).
    let paymentFailed = payment?.status === PaymentStatus.FAILED;
    if (payment?.intentId) {
      try {
        // Route by the ROW's provider (never the settings switch): the charge
        // belongs to whichever PSP created it, even after an admin switch.
        if (payment.provider === PaymentProvider.MOLLIE) {
          const molliePayment = await this.mollie.getPayment(payment.intentId);
          await this.applyMolliePayment(molliePayment);
          paymentFailed =
            molliePayment.status === 'failed' ||
            molliePayment.status === 'canceled' ||
            molliePayment.status === 'expired';
        } else {
          const intent = await this.stripe.retrievePaymentIntent(
            payment.intentId,
          );
          if (intent.status === 'succeeded') {
            await this.onIntentSucceeded(intent);
            paymentFailed = false;
          } else {
            // A failed redirect-return leaves the intent back at
            // requires_payment_method WITH a last_payment_error; canceled is
            // terminal. Both mean "this attempt did not pay" - the processing
            // page sends the traveller back to the checkout to retry.
            paymentFailed =
              intent.status === 'canceled' ||
              Boolean(intent.last_payment_error);
          }
        }
      } catch (err) {
        // Best-effort: a PSP hiccup here just falls back to the webhook +
        // the processing page's polling. Never surface a 500 to the traveller.
        this.logger.warn(
          `settleFromReturn: could not settle ${booking.id} now - ${(err as Error).message}`,
        );
      }
    }

    const fresh = await this.prisma.booking.findUnique({
      where: { id: booking.id },
      select: { status: true, publicRef: true },
    });
    const status = fresh?.status ?? booking.status;
    return {
      status,
      publicRef: fresh?.publicRef ?? booking.publicRef,
      // A confirmed booking can never read as failed, whatever the row said.
      paymentFailed: status === BookingStatus.CONFIRMED ? false : paymentFailed,
    };
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async onIntentSucceeded(intent: Stripe.PaymentIntent): Promise<void> {
    const bookingId = intent.metadata?.bookingId;
    const charge = await this.resolveCharge(intent);

    // Which method the customer used (card / paypal / apple_pay / google_pay) — Figma.
    const methodType =
      charge?.payment_method_details?.type ??
      (typeof intent.payment_method === 'object'
        ? (intent.payment_method?.type ?? null)
        : null);

    await this.prisma.payment.updateMany({
      // REFUND rows share the charge's intentId (B5) and a refunded charge must
      // never be resurrected to SUCCEEDED by a late/duplicate delivery.
      where: {
        intentId: intent.id,
        kind: { not: PaymentKind.REFUND },
        status: { not: PaymentStatus.REFUNDED },
      },
      data: {
        status: PaymentStatus.SUCCEEDED,
        chargeId:
          typeof intent.latest_charge === 'string'
            ? intent.latest_charge
            : charge?.id,
        ...(methodType ? { methodType } : {}),
      },
    });

    if (!bookingId) {
      this.logger.error(
        `PaymentIntent ${intent.id} succeeded without a bookingId in metadata`,
      );
      return;
    }

    const billing = charge
      ? {
          country: charge.billing_details?.address?.country ?? null,
          postalCode: charge.billing_details?.address?.postal_code ?? null,
          city: charge.billing_details?.address?.city ?? null,
          last4: charge.payment_method_details?.card?.last4 ?? null,
          brand: charge.payment_method_details?.card?.brand ?? null,
        }
      : undefined;

    await this.bookings.confirmFromPayment(
      bookingId,
      billing,
      charge ? stripeChargeFx(charge) : undefined,
    );
  }

  /**
   * The charge behind a succeeded intent. Webhook payloads are never expanded, so
   * `latest_charge` arrives as a string id and the legacy `charges.data[0]` list is
   * gone on current API versions - without fetching, the card/billing snapshot would
   * silently stay null on every booking. Never throws: a failed lookup only costs the
   * snapshot, and must not block the confirmation.
   */
  private async resolveCharge(
    intent: Stripe.PaymentIntent,
  ): Promise<Stripe.Charge | undefined> {
    const expanded = expandedCharge(intent);
    if (expanded) return expanded;

    const chargeId =
      typeof intent.latest_charge === 'string' ? intent.latest_charge : null;
    if (!chargeId) return undefined;

    try {
      return await this.stripe.retrieveCharge(chargeId);
    } catch (err) {
      this.logger.error(
        `Could not retrieve charge ${chargeId} for intent ${intent.id} - card/billing snapshot skipped`,
        err as Error,
      );
      return undefined;
    }
  }

  private async onIntentFailed(intent: Stripe.PaymentIntent): Promise<void> {
    await this.prisma.payment.updateMany({
      // REFUND rows share the charge's intentId (B5) - an intent-level failure
      // event must never re-stamp a refund row; refunds have their own events.
      where: { intentId: intent.id, kind: { not: PaymentKind.REFUND } },
      data: { status: PaymentStatus.FAILED },
    });
    this.logger.warn(
      `PaymentIntent ${intent.id} failed for booking ${intent.metadata?.bookingId ?? 'unknown'}`,
    );
  }

  /**
   * Reconcile an async refund outcome onto the REFUND `Payment` row that
   * `executeRefund` wrote at create time (keyed by `refundId`).
   *
   * Cards refund synchronously, but bank-debit methods (iDEAL/SEPA/ACH) create
   * the refund `pending` (row = PROCESSING) and settle - or fail - later; this
   * is the settle point. Transition rules keep out-of-order deliveries safe:
   *   - -> REFUNDED (settled) only from PROCESSING (never resurrect a FAILED
   *     refund)
   *   - -> FAILED from PROCESSING or REFUNDED (Stripe can fail a bank refund
   *     days after reporting success)
   *   - a `pending` update carries no new information - ignored
   * A failure is LOUD: the traveller was already told their money is coming,
   * and `refundStatus` flips back to "Refund pending" for the ops queue
   * (re-running the cancel action retries with a fresh idempotency key).
   */
  private async onRefundEvent(refund: Stripe.Refund): Promise<void> {
    await this.reconcileRefundRow(
      refund.id,
      mapStripeRefundStatus(refund.status),
      'Stripe',
    );
  }

  /**
   * Provider-agnostic refund reconciliation onto the REFUND `Payment` row that
   * `executeRefund` wrote at create time (keyed by `refundId`). Transition
   * rules keep out-of-order deliveries safe:
   *   - -> REFUNDED (settled) only from PROCESSING (never resurrect a FAILED
   *     refund)
   *   - -> FAILED from PROCESSING or REFUNDED (a PSP can fail a bank refund
   *     days after reporting success; SUCCEEDED kept for legacy rows)
   *   - a pending update carries no new information - ignored
   * On settle, the ORIGINAL charge row flips to REFUNDED too (and back to
   * SUCCEEDED on a late failure), so the payments list always tells one story.
   * A failure is LOUD: the traveller was already told their money is coming,
   * and `refundStatus` flips back to "Refund pending" for the ops queue
   * (re-running the cancel action retries with a fresh idempotency key).
   */
  private async reconcileRefundRow(
    refundId: string,
    next: PaymentStatus,
    providerLabel: string,
  ): Promise<void> {
    const allowedFrom: PaymentStatus[] =
      next === PaymentStatus.REFUNDED
        ? [PaymentStatus.PROCESSING]
        : next === PaymentStatus.FAILED
          ? [
              PaymentStatus.PROCESSING,
              PaymentStatus.REFUNDED,
              PaymentStatus.SUCCEEDED,
            ]
          : [];
    if (allowedFrom.length === 0) return;

    // Read the row first: the original-charge flip below needs its booking +
    // intent, and updateMany returns only a count.
    const row = await this.prisma.payment.findFirst({
      where: {
        refundId,
        kind: PaymentKind.REFUND,
        status: { in: allowedFrom },
      },
      select: { id: true, bookingId: true, intentId: true },
    });
    if (!row) return; // not ours, or already reconciled

    const { count } = await this.prisma.payment.updateMany({
      where: { id: row.id, status: { in: allowedFrom } },
      data: { status: next },
    });
    if (count === 0) return; // lost a race with a concurrent delivery

    // Keep the ORIGINAL charge row's story in sync with the refund outcome.
    if (row.intentId) {
      if (next === PaymentStatus.REFUNDED) {
        await this.prisma.payment.updateMany({
          where: {
            bookingId: row.bookingId,
            kind: { not: PaymentKind.REFUND },
            intentId: row.intentId,
            status: PaymentStatus.SUCCEEDED,
          },
          data: { status: PaymentStatus.REFUNDED },
        });
      } else {
        // Late failure: the money never left after all - the charge stands.
        await this.prisma.payment.updateMany({
          where: {
            bookingId: row.bookingId,
            kind: { not: PaymentKind.REFUND },
            intentId: row.intentId,
            status: PaymentStatus.REFUNDED,
          },
          data: { status: PaymentStatus.SUCCEEDED },
        });
      }
    }

    if (next === PaymentStatus.FAILED) {
      this.logger.error(
        `${providerLabel} refund ${refundId} FAILED after creation - the traveller has NOT received their money; re-run the cancellation action to retry (manual follow-up)`,
      );
    } else {
      this.logger.log(`${providerLabel} refund ${refundId} settled -> ${next}`);
    }
  }
}

// ── pure helpers ────────────────────────────────────────────────────────────

/** The booking slice both charge legs need (loaded once in createIntentForBooking). */
interface ChargeableBooking {
  id: string;
  displayRef: string;
  currency: Currency;
  customerLocale: string | null;
}

function chargeFor(
  model: PaymentModel,
  deposit: Prisma.Decimal,
  total: Prisma.Decimal,
): { amount: Prisma.Decimal; kind: PaymentKind } | null {
  switch (model) {
    case PaymentModel.OPERATOR_LINK:
    case PaymentModel.ON_ARRIVAL:
      // Deposit models: platform captures the deposit; operator collects the balance
      // (payment link vs on-site). ON_ARRIVAL is a deposit model (guide §20.7).
      return { amount: deposit, kind: PaymentKind.DEPOSIT };
    case PaymentModel.PAID_IN_FULL:
      return { amount: total, kind: PaymentKind.FULL };
    case PaymentModel.OPERATOR_FULL:
      return null;
  }
}

/** Deterministic Payment row id so create-intent is idempotent per (booking, kind). */
function paymentRowId(bookingId: string, kind: PaymentKind): string {
  return `${bookingId}:${kind}`;
}

function mapIntentStatus(
  status: Stripe.PaymentIntent['status'],
): PaymentStatus {
  switch (status) {
    case 'succeeded':
      return PaymentStatus.SUCCEEDED;
    case 'processing':
      return PaymentStatus.PROCESSING;
    case 'canceled':
      return PaymentStatus.FAILED;
    default:
      return PaymentStatus.REQUIRES_PAYMENT;
  }
}

/** The charge embedded in the intent, when the webhook payload expands it. */
function expandedCharge(
  intent: Stripe.PaymentIntent,
): Stripe.Charge | undefined {
  const latest = intent.latest_charge;
  if (latest && typeof latest === 'object') return latest;
  const charges = (
    intent as unknown as { charges?: { data?: Stripe.Charge[] } }
  ).charges;
  return charges?.data?.[0];
}

/** Mollie payment status → our PaymentStatus (same contract as mapIntentStatus). */
function mapMolliePaymentStatus(status: string): PaymentStatus {
  switch (status) {
    case 'paid':
      return PaymentStatus.SUCCEEDED;
    case 'pending':
    case 'authorized':
      return PaymentStatus.PROCESSING;
    case 'failed':
    case 'canceled':
    case 'expired':
      return PaymentStatus.FAILED;
    default:
      return PaymentStatus.REQUIRES_PAYMENT; // 'open'
  }
}

/**
 * Stripe's ACTUAL charge conversion (task #28 / 5C): the balance transaction's
 * `exchange_rate` is the presentment->settlement rate the money moved at, so
 * when the account settles in EUR it IS the true bookingCurrency -> EUR rate.
 * Returns undefined when the settlement is not EUR (a non-EUR Stripe account -
 * the rate would convert to the wrong currency), when no conversion happened
 * (EUR-charged on an EUR account: `exchange_rate` is null), or when the
 * balance transaction is not expanded/created yet - all of which fall back to
 * the ECB snapshot in `finalizeConfirmation`.
 */
function stripeChargeFx(charge: Stripe.Charge): ChargeFx | undefined {
  const bt = charge.balance_transaction;
  if (!bt || typeof bt !== 'object') return undefined;
  if (bt.currency !== 'eur') return undefined;
  if (typeof bt.exchange_rate !== 'number' || !(bt.exchange_rate > 0)) {
    return undefined;
  }
  return {
    rateToEur: new Prisma.Decimal(bt.exchange_rate),
    provider: 'stripe',
    asOf: new Date(bt.created * 1000),
  };
}

/**
 * Mollie's ACTUAL charge conversion (task #28 / 5C): `settlementAmount` is the
 * charge converted to the account's settlement currency, so for an EUR-settled
 * account `settlementAmount.value / amount.value` is the true bookingCurrency
 * -> EUR rate. Returns undefined for EUR-charged payments (no conversion),
 * non-EUR settlement, or when Mollie omits the field (e.g. PayPal-settled
 * amounts) - falling back to the ECB snapshot in `finalizeConfirmation`.
 */
function mollieChargeFx(payment: MolliePayment): ChargeFx | undefined {
  const settlement = payment.settlementAmount;
  if (!settlement || settlement.currency !== 'EUR') return undefined;
  if (payment.amount.currency === 'EUR') return undefined;
  const charged = new Prisma.Decimal(payment.amount.value);
  const settled = new Prisma.Decimal(settlement.value);
  if (!charged.gt(0) || !settled.gt(0)) return undefined;
  return {
    rateToEur: settled.div(charged),
    provider: 'mollie',
    asOf: payment.paidAt ? new Date(payment.paidAt) : new Date(),
  };
}

/**
 * Card/billing snapshot from a paid Mollie payment (best-effort, like the
 * Stripe charge lookup). Card payments expose label/last4/issuing country in
 * `details`; other methods just skip the snapshot.
 */
function mollieBillingSnapshot(payment: MolliePayment):
  | {
      country: string | null;
      postalCode: string | null;
      city: string | null;
      last4: string | null;
      brand: string | null;
    }
  | undefined {
  const details = payment.details as {
    cardNumber?: string | null;
    cardLabel?: string | null;
    cardCountryCode?: string | null;
  } | null;
  if (!details) return undefined;
  const last4 = details.cardNumber ? details.cardNumber.slice(-4) : null;
  const brand = details.cardLabel ?? null;
  const country = details.cardCountryCode ?? null;
  if (!last4 && !brand && !country) return undefined;
  return { country, postalCode: null, city: null, last4, brand };
}

/**
 * Validate a client-supplied redirect target against the CORS allow-list: the
 * traveller is SENT to this URL by Mollie after paying, so an arbitrary value
 * would let a crafted intent call bounce them to a hostile page. With
 * CORS_ORIGINS unset the list defaults to http://localhost:3000 (dev).
 */
function assertAllowedRedirect(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestException('Invalid return URL');
  }
  // Fails CLOSED, matching the CORS origin callback in main.ts. The guard used
  // to be `allowed.length > 0 && !allowed.includes(...)`, which silently
  // skipped the check entirely whenever the allow-list came back empty -
  // `parseCorsOrigins` only defaults when CORS_ORIGINS is UNDEFINED, so an
  // explicit `CORS_ORIGINS=''` in an env file turned this into an open
  // redirect: reserving a booking is public, so anyone could then pass their
  // own `returnUrl` and have Mollie deliver the traveller to it after paying.
  const allowed = parseCorsOrigins(process.env.CORS_ORIGINS);
  if (!allowed.includes(parsed.origin)) {
    throw new BadRequestException('Return URL origin is not allowed');
  }
  return parsed.toString();
}

/**
 * The public URL Mollie should POST payment ids to, or undefined when the API
 * has no publicly reachable https origin (local dev) - Mollie can't call
 * localhost, so dev settles via the on-return path, same as Stripe's dev story.
 */
function mollieWebhookUrl(): string | undefined {
  const base = (process.env.PUBLIC_API_URL ?? process.env.BETTER_AUTH_URL ?? '')
    .trim()
    .replace(/\/+$/, '');
  if (!/^https:\/\//.test(base)) return undefined;
  if (/localhost|127\.0\.0\.1/.test(base)) return undefined;
  return `${base}/api/v1/payments/webhook/mollie`;
}
