import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type Stripe from 'stripe';
import {
  BookingStatus,
  PaymentKind,
  PaymentModel,
  PaymentStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { BookingsService } from '@/bookings/bookings.service';
import { resolveOperatorId } from '@/common/utils/operator.util';
import { assertDateRangeOrder } from '@/common/utils/date-range.util';
import { dateKey } from '@/common/utils/timezone.util';
import { StripeService, toMinorUnits } from './stripe.service';
import type {
  ListPaymentsQueryDto,
  PaymentIntentResponseDto,
} from './dto/payment.dto';

/**
 * Payments - Stripe charges per booking + idempotent webhook settlement.
 *
 * The platform collects only its slice up front (master rule #21):
 * - OPERATOR_LINK / ON_ARRIVAL → deposit (`depositAmount`); operator collects the
 *   balance (payment link vs on-site/cash on arrival). Both are deposit models.
 * - PAID_IN_FULL  → the whole `totalRetail`.
 * - OPERATOR_FULL → no charge (paymentRequired = false; dropped for v1 at reserve).
 *
 * A booking is truly CONFIRMED when its charge succeeds: the webhook calls
 * `BookingsService.confirmFromPayment`, which fires the EUR conversion (rule #22).
 * Webhooks are signature-verified and idempotent via `stripe_webhook_events`.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly bookings: BookingsService,
  ) {}

  // ── Dashboard payments list ──────────────────────────────────────────────────

  /**
   * Paginated payments for the dashboard Payments table. ADMIN sees every
   * payment; TOUR_OPERATOR only payments on bookings of their own tours (scoped
   * via `booking.operatorId`, mirroring `BookingsService.list`). The route is
   * permission-gated (`VIEW_PAYMENTS`), so plain USERs never reach this.
   */
  async list(query: ListPaymentsQueryDto, actor: { id: string; role: Role }) {
    assertDateRangeOrder(query.from, query.to);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.PaymentWhereInput = {};
    if (actor.role !== Role.ADMIN) {
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
              tour: { select: { name: true } },
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
      })),
    };
  }

  // ── Create / fetch the up-front PaymentIntent ────────────────────────────────

  async createIntentForBooking(
    bookingId: string,
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

    await this.prisma.payment.upsert({
      where: { id: paymentRowId(booking.id, charge.kind) },
      create: {
        id: paymentRowId(booking.id, charge.kind),
        bookingId: booking.id,
        kind: charge.kind,
        status: mapIntentStatus(intent.status),
        amount: charge.amount,
        currency: booking.currency,
        intentId: intent.id,
      },
      update: {
        status: mapIntentStatus(intent.status),
        amount: charge.amount,
        intentId: intent.id,
      },
    });

    return {
      paymentRequired: true,
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

  // ── Mollie webhook settlement (idempotent ledger, mirrors Stripe) ────────────

  /**
   * Record a Mollie webhook delivery idempotently. Mollie posts only a payment id;
   * the ledger row (keyed by that id) makes redelivery a no-op — mirroring the Stripe
   * `stripe_webhook_events` guard (master rule #15).
   *
   * TODO(payments): full reconciliation — fetch the Mollie payment by id, map its
   * status, update the matching `Payment` row, and call `confirmFromPayment` on
   * success (parallel to `onIntentSucceeded`). Wiring the Mollie API client lands
   * with the Mollie checkout flow.
   */
  async handleMollieWebhook(paymentId: string): Promise<void> {
    if (!paymentId) throw new BadRequestException('Missing Mollie payment id');

    try {
      await this.prisma.mollieWebhookEvent.create({
        data: {
          id: paymentId,
          type: 'payment',
          payload: { id: paymentId },
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        this.logger.log(
          `Mollie payment ${paymentId} already processed - skipping`,
        );
        return;
      }
      throw err;
    }

    // No-op for now beyond recording; mark processed so it is not re-handled.
    await this.prisma.mollieWebhookEvent.update({
      where: { id: paymentId },
      data: { processedAt: new Date() },
    });
    this.logger.log(
      `Mollie webhook recorded for payment ${paymentId} (reconciliation pending)`,
    );
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
      where: { intentId: intent.id },
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

    await this.bookings.confirmFromPayment(bookingId, billing);
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
      where: { intentId: intent.id },
      data: { status: PaymentStatus.FAILED },
    });
    this.logger.warn(
      `PaymentIntent ${intent.id} failed for booking ${intent.metadata?.bookingId ?? 'unknown'}`,
    );
  }
}

// ── pure helpers ────────────────────────────────────────────────────────────

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
