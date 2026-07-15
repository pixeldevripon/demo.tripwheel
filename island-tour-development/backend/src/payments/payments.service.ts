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
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { BookingsService } from '@/bookings/bookings.service';
import { StripeService, toMinorUnits } from './stripe.service';
import type { PaymentIntentResponseDto } from './dto/payment.dto';

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
    const intent = await this.stripe.createPaymentIntent({
      amount: toMinorUnits(charge.amount),
      currency: booking.currency,
      idempotencyKey,
      metadata: {
        bookingId: booking.id,
        displayRef: booking.displayRef,
        kind: charge.kind,
      },
      methods: await this.stripe.paymentMethods(),
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
    const charge = expandedCharge(intent);

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
