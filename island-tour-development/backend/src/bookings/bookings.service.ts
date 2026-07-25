import { randomUUID } from 'crypto';
import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  BookingStatus,
  CancellationRefund,
  CancelledBy,
  Currency,
  DepartureStatus,
  Locale,
  PaymentKind,
  PaymentModel,
  PaymentProvider,
  PaymentStatus,
  PickupModel,
  PricingModel,
  Prisma,
  Role,
  SettlementStatus,
  TourBookingType,
  TourStatus,
  WholeUnitType,
  type Booking,
  type BookingUnitItem,
} from '@prisma/client';
import { settlementMethodFor } from '@/settlements/dto/settlement.dto';
import { MollieService } from '@/payments/mollie.service';
import { StripeService } from '@/payments/stripe.service';
import { PrismaService } from '@/prisma/prisma.service';
import { MailService } from '@/mail/mail.service';
import { emailSafeLogoUrl } from '@/mail/email-logo.util';
import {
  issueBookingSession,
  issueTravelerSession,
  maskEmail,
  sessionOwnsBooking,
  verifyTravelerSession,
} from './traveler-session.util';
import { CustomerProvisioningService } from '@/customers/customer-provisioning.service';
import { LookupRateLimiter, TargetRateLimiter } from './lookup-rate-limiter';
import { TrackingService } from '@/tracking/tracking.service';
import { computeHashedPii, toGoogleUserData } from '@/tracking/pii-hash.util';
import { NotificationsService } from '@/notifications/notifications.service';
import {
  dashboardAppBase,
  islandToursBase,
} from '@/common/utils/app-urls.util';
import { ACTIVE_BOOKING_STATUSES } from '@/common/constants/booking-status';
import {
  isPlatformWideBookingRole,
  resolveOperatorId,
} from '@/common/utils/operator.util';
import {
  combineDateTime,
  dateKey,
  localNow,
  localWallClockToUtc,
  timeOfDay,
} from '@/common/utils/timezone.util';
import { eurFxRate } from '@/common/utils/fx.util';
import { assertDateRangeOrder } from '@/common/utils/date-range.util';
import { cutoffReached } from '@/availability/availability-status.util';
import { storedStatusForFill } from '@/availability/availability-status.util';
import { TiersService } from '@/tiers/tiers.service';
import { FxRatesService } from '@/fx/fx-rates.service';
import type { FxQuote } from '@/fx/fx-provider.interface';
import {
  computeBookingPricing,
  type AddOnLineInput,
  type BookingPricing,
  type PriceLineInput,
  type UnitPricingInput,
} from './booking-pricing.util';
import type { EmailTemplateContext } from '@/mail/templates/email-template.renderer';
import {
  buildConfirmationEmailContext,
  buildConfirmationEmailSubject,
  buildConfirmationEmailText,
  buildNoticeText,
  buildOperatorNotificationContext,
  buildOperatorNotificationSubject,
  buildOperatorNotificationText,
  buildPartyLines,
  depositPctOf,
  durationLabel,
  emailIconBase,
  formatDateLong,
  preferLocale,
  toLocale,
  type RelatedTourInput,
} from './booking-email.context';
import { buildBookingIcs } from './booking-ics.util';
import type {
  BookingConversionDto,
  BookingLookupResponseDto,
  BookingQuoteResponseDto,
  CancelBookingDto,
  ConfirmBookingDto,
  ExtendBookingDto,
  ListBookingsQueryDto,
  LookupBookingDto,
  QuoteBookingDto,
  QuoteLineDto,
  RecoverReferenceDto,
  RecoverReferenceResponseDto,
  ReserveBookingDto,
  UpdateBookingDto,
} from './dto/booking.dto';
import { deriveBookingDisplayStatus } from './dto/booking.dto';
import { deriveRefundState } from './refund-state.util';
import {
  mapMollieRefundStatus,
  mapStripeRefundStatus,
} from '@/payments/refund-status.util';

const DEFAULT_HOLD_MINUTES = 30;
/** Quote validity window (guide §20.4: 10-15 min is enough). */
const QUOTE_TTL_MINUTES = 15;

/**
 * Internal control-flow signal for pay-after-expiry recovery: thrown inside the
 * recovery transaction to roll it back for a KNOWN, non-error reason (someone else
 * won the flip, or seats are gone). Caught by `recoverExpiredBooking` -> returns
 * false, distinct from an unexpected DB error.
 */
class HoldRecoveryAbort extends Error {}

/**
 * The PSP's ACTUAL charge conversion for a succeeded payment (task #28 / 5C).
 * Derived from Stripe's `balance_transaction.exchange_rate` or Mollie's
 * `settlementAmount`, and only ever produced when the PSP settled the charge
 * in EUR - so `rateToEur` is the true bookingCurrency -> EUR rate the money
 * moved at. When present, confirmation reconciles the booking's EUR figures
 * (fxRateToEur / totalEur / commissionAmount + the settlement ledger) onto it
 * instead of the ECB rate snapshotted at reserve.
 */
export interface ChargeFx {
  /** bookingCurrency -> EUR rate the PSP actually converted at (positive). */
  rateToEur: Prisma.Decimal;
  /** Which PSP supplied the rate - written to `eurFxProvider` for audit. */
  provider: 'stripe' | 'mollie';
  /** PSP timestamp of the conversion - written to `eurFxProviderAsOf`. */
  asOf: Date;
}

/**
 * Fields the pricing pipeline (`loadContext` / `loadAddOns`) reads from a request.
 * Shared by the authoritative `reserve` write and the read-only `quote` preview.
 */
type PricingInput = Pick<
  ReserveBookingDto,
  | 'tourId'
  | 'departureId'
  | 'items'
  | 'guests'
  | 'travelerAges'
  | 'addOns'
  | 'pickupLocationId'
>;

type BookingWithItems = Booking & { unitItems: BookingUnitItem[] };

/**
 * The selected pickup point, frozen at reserve time. Snapshotted rather than joined
 * live because the confirmation email renders the pickup TIME: a later operator edit
 * to the PickupLocation must never rewrite what a confirmed traveler was told
 * (guide §17, same immutability rule as `payment_model`).
 */
type PickupSnapshot = {
  name: string | null;
  address: string | null;
  minutesPrior: number | null;
  windowStart: string | null;
  windowEnd: string | null;
  /**
   * Per-person zone price in SOURCE (tour) currency - non-null ONLY when the tour's
   * pickupModel = PAID_ADDON and the zone carries a positive price (master 5.8
   * "operator zones with prices"). INCLUDED/free zones never charge.
   */
  unitPrice: Prisma.Decimal | null;
};

/** No pickup selected: meet-on-site, so every pickup column stays null. */
/**
 * Field set every cancellation-request path loads - shared by the public
 * traveler route (publicRef + HMAC session) and the customer dashboard route
 * (booking id + account ownership).
 */
const CANCELLATION_REQUEST_SELECT = {
  id: true,
  displayRef: true,
  publicRef: true,
  status: true,
  utcCancellationRequestedAt: true,
  contactFullName: true,
  contactFirstName: true,
  contactLastName: true,
  contactEmail: true,
  customerLocale: true,
  localDate: true,
  startTime: true,
  tourStartDateTime: true,
  tourTimeZone: true,
  totalRetail: true,
  currency: true,
  paymentModel: true,
  operatorId: true,
  island: true,
  tour: { select: { name: true } },
} satisfies Prisma.BookingSelect;

type CancellationRequestBooking = Prisma.BookingGetPayload<{
  select: typeof CANCELLATION_REQUEST_SELECT;
}>;

/**
 * Widest real UTC offset on earth (UTC+14, Kiritimati). A calendar day D has
 * ended everywhere once `D + 1 day` has passed even in the LAST zone to reach
 * it (UTC-12), i.e. 36h after D 00:00 UTC. Used only for the legacy fallback
 * below, where we know the travel date but not the zone.
 */
const DAY_ENDED_EVERYWHERE_MS = 36 * 3_600_000;

/**
 * Has the trip already started? Answers the one question the cancellation
 * flow turns on - you cannot ask to cancel a trip you have already taken.
 *
 * `tourStartDateTime` is a LOCAL wall-clock snapshot, so it means nothing
 * without `tourTimeZone`; only the pair yields a real instant. Two cases:
 *
 * 1. Start + zone (every booking since the snapshot landed) - exact instant.
 * 2. Travel date only (legacy rows predating the zone snapshot) - deliberately
 *    conservative: the trip counts as departed only once that calendar day has
 *    ended in EVERY timezone. We would rather let a late request through for a
 *    human to judge than refuse a traveller whose trip has not happened yet.
 *
 * `localDate` is NOT NULL in the schema, so there is always a floor to fall
 * back to - no booking is dateless.
 */
function hasDeparted(
  booking: {
    tourStartDateTime: Date | null;
    tourTimeZone: string | null;
    localDate: Date;
  },
  now: Date = new Date(),
): boolean {
  if (booking.tourStartDateTime && booking.tourTimeZone) {
    return (
      localWallClockToUtc(
        booking.tourStartDateTime,
        booking.tourTimeZone,
      ).getTime() <= now.getTime()
    );
  }
  return now.getTime() >= booking.localDate.getTime() + DAY_ENDED_EVERYWHERE_MS;
}

/** Why a booking cannot be put up for cancellation (null = it can). */
export type CancellationBlockedReason =
  | 'ALREADY_REQUESTED'
  | 'NOT_CONFIRMED'
  | 'DEPARTED';

/**
 * Traveller-facing refusal copy, one per blocked reason. Kept beside the
 * predicate so a new reason cannot be added without deciding what the person
 * on the other end is told.
 */
const CANCELLATION_BLOCKED_MESSAGE: Record<CancellationBlockedReason, string> =
  {
    ALREADY_REQUESTED:
      'We have already received your cancellation request and are processing it. We will email you once it is done.',
    NOT_CONFIRMED:
      'Only a confirmed booking can request cancellation - this one is no longer active.',
    DEPARTED:
      'This trip has already departed, so it can no longer be cancelled. Contact us if something went wrong.',
  };

/**
 * THE cancellation-eligibility rule. The server decides this, never the
 * client: the API response carries the verdict so every surface (customer
 * dashboard, TYP cancel page, ops tooling) shows the same answer, and the
 * enforcement in `submitCancellationRequest` is the same predicate - a UI can
 * never offer something the endpoint would then refuse.
 *
 * Order matters: an existing request is the most specific state to report,
 * then an ineligible status, then a departed trip.
 */
function cancellationEligibility(
  booking: {
    status: BookingStatus;
    utcCancellationRequestedAt: Date | null;
    tourStartDateTime: Date | null;
    tourTimeZone: string | null;
    localDate: Date;
  },
  now: Date = new Date(),
): { canRequest: boolean; reason: CancellationBlockedReason | null } {
  if (booking.utcCancellationRequestedAt) {
    return { canRequest: false, reason: 'ALREADY_REQUESTED' };
  }
  if (booking.status !== BookingStatus.CONFIRMED) {
    return { canRequest: false, reason: 'NOT_CONFIRMED' };
  }
  if (hasDeparted(booking, now)) {
    return { canRequest: false, reason: 'DEPARTED' };
  }
  return { canRequest: true, reason: null };
}

const EMPTY_PICKUP: PickupSnapshot = {
  name: null,
  address: null,
  minutesPrior: null,
  windowStart: null,
  windowEnd: null,
  unitPrice: null,
};

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly tracking: TrackingService,
    private readonly notifications: NotificationsService,
    private readonly tiers: TiersService,
    private readonly fx: FxRatesService,
    private readonly lookupLimiter: LookupRateLimiter,
    private readonly targetLimiter: TargetRateLimiter,
    private readonly customerProvisioning: CustomerProvisioningService,
    private readonly stripe: StripeService,
    private readonly mollie: MollieService,
  ) {}

  /**
   * Resolve the FX-aware pricing for a booking context: source (tour) currency, the
   * charged/booking currency (shopper choice, default = source), and the two rates it
   * needs - source→booking and booking→EUR. Both rates come from {@link FxRatesService}
   * (fails closed with 503 if a cross-currency rate is unavailable) and are snapshotted
   * onto the booking so the conversion is auditable and never redone (guide §20.5/§20.8).
   */
  private async resolvePricing(
    ctx: Awaited<ReturnType<BookingsService['loadContext']>>,
    bookingCurrency: Currency,
    now: Date,
  ): Promise<{
    sourceCurrency: Currency;
    bookingCurrency: Currency;
    sourceRate: FxQuote;
    eurRate: FxQuote;
    pricing: BookingPricing;
  }> {
    const sourceCurrency = ctx.tour.defaultCurrency;
    const sourceRate = await this.fx.getRate(sourceCurrency, bookingCurrency);
    const eurRate = await this.fx.getRate(bookingCurrency, Currency.EUR);

    // Effective commission (tier + any ACTIVE Spotlight), as a percentage.
    const effectiveRate = await this.tiers.effectiveCommissionRate(
      ctx.tourId,
      now,
    );
    const effectiveTier = new Prisma.Decimal(effectiveRate)
      .mul(100)
      .toDecimalPlaces(2);

    const pricing = computeBookingPricing({
      lines: ctx.lines,
      unit: ctx.unit,
      addOns: ctx.addOnLines,
      pickup:
        ctx.pickupSnapshot.unitPrice != null
          ? { unitPrice: ctx.pickupSnapshot.unitPrice }
          : null,
      sourceCurrency,
      bookingCurrency,
      sourceFxRateToBooking: sourceRate.rate,
      fxRateToEur: eurRate.rate,
      paymentModel: ctx.tour.paymentModel,
      depositPct: ctx.tour.depositPct,
      commissionTier: effectiveTier,
    });

    return { sourceCurrency, bookingCurrency, sourceRate, eurRate, pricing };
  }

  /** Fire the inventory + booking-status webhooks for a booking (fire-and-forget). */
  private emitBookingEvents(
    booking: Pick<Booking, 'tourId' | 'localDate' | 'operatorId' | 'publicRef'>,
    opts: { availability: boolean } = { availability: true },
  ): void {
    // A side-effect must never break the originating write - never let it throw.
    try {
      if (opts.availability) {
        this.notifications.emitAvailabilityUpdate({
          tourId: booking.tourId,
          localDate: dateKey(booking.localDate),
          operatorId: booking.operatorId,
        });
      }
      this.notifications.emitBookingUpdate({
        uuid: booking.publicRef,
        operatorId: booking.operatorId,
      });
    } catch (err) {
      this.logger.error(
        `Failed to emit booking events for ${booking.publicRef}`,
        err as Error,
      );
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Reserve (OCTO step 1) - atomic seat claim → ON_HOLD (or CONFIRMED for OPERATOR_FULL)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * `actor` is the browser's session user, if any - `reserve` is @Public but
   * AuthGuard still attaches a session when one exists. Only a `Role.USER`
   * session may be stamped as the booking's owner: `booking.userId` means
   * "the customer this booking belongs to" (it drives the customer dashboard,
   * the ownership check on getById, and the cancellation-request gate). An
   * admin or operator who happens to be logged in while testing checkout is
   * NOT the traveller, and recording them as one both hides the booking from
   * the real customer and attributes a stranger's trip to a staff account.
   */
  async reserve(dto: ReserveBookingDto, actor?: { id: string; role: Role }) {
    const userId = actor?.role === Role.USER ? actor.id : undefined;
    const id = dto.id ?? randomUUID();

    // Idempotency: a retried create with the same id returns the existing booking.
    const prior = await this.prisma.booking.findUnique({
      where: { id },
      include: { unitItems: true },
    });
    if (prior) return mapBookingPublic(prior);

    const ctx = await this.loadContext(dto);
    this.validateRestrictions(ctx);

    const now = localNow(ctx.tour.timeZone);
    // Cutoff is computed live (master §4): now >= start - bookingCutoffMinutes → closed.
    // Same arithmetic as public availability and search/listing (shared helper).
    const localStart = combineDateTime(
      ctx.departure.date,
      ctx.departure.startTime,
    );
    if (
      cutoffReached(
        localStart.getTime(),
        now.getTime(),
        ctx.tour.bookingCutoffMinutes,
      )
    ) {
      throw new UnprocessableEntityException(
        'Booking cutoff has passed for this departure',
      );
    }

    // Pickup is a listing requirement on pickupRequired tours (OCTO option flag /
    // master E.3): the traveler must arrange one - either a real zone or the
    // "other location, confirm via WhatsApp" fallback (pickupRequested with no id).
    if (ctx.tour.pickupRequired && !(dto.pickupRequested ?? false)) {
      throw new UnprocessableEntityException(
        'This tour requires a pickup location',
      );
    }

    // FX-aware pricing: charge in the shopper currency (default = tour currency),
    // snapshotting the source-currency quote + both rates. Commission stays EUR
    // (rule #22). The effective commission (tier + any ACTIVE Spotlight) is resolved
    // inside resolvePricing and snapshotted, never retroactive.
    const bookingCurrency = dto.currency ?? ctx.tour.defaultCurrency;
    const { sourceCurrency, sourceRate, eurRate, pricing } =
      await this.resolvePricing(ctx, bookingCurrency, now);
    // Guest headcount (manifest + add-on multiplier). For a private unit charter the
    // inventory claim below takes the WHOLE departure regardless of this count (D5).
    const seats = pricing.pax;

    // Per-seat traveler ages, expanded in the same order as pricing.unitItems.
    const seatAges = ctx.seatAges;

    // UNIT + PRIVATE = exclusive charter: one booking takes the whole departure
    // (master E.3). SHARED unit + all per-person bookings consume the guest headcount.
    const exclusive =
      ctx.isUnit && ctx.tour.bookingType === TourBookingType.PRIVATE;

    // Full local end instant = local start + tour duration (master E.8 TYP time range).
    const tourEndDateTime =
      ctx.tour.durationMinutesFrom != null
        ? new Date(localStart.getTime() + ctx.tour.durationMinutesFrom * 60_000)
        : null;

    const operatorFull = ctx.tour.paymentModel === PaymentModel.OPERATOR_FULL;

    const created = await this.prisma.$transaction(async (tx) => {
      // Fresh capacity read inside the txn - the guard threshold below is a literal,
      // so re-reading here keeps it correct against a concurrent capacity edit.
      const dep = await tx.departure.findUnique({
        where: { id: dto.departureId },
        select: { capacity: true },
      });
      if (!dep) {
        throw new UnprocessableEntityException('Departure not found');
      }
      const capacity = dep.capacity;

      // Atomic guarded seat claim - the overbooking backstop (master §5). A single
      // conditional updateMany (type-safe columns): its WHERE re-evaluates against the
      // current bookedCount under concurrency, so two bookings can't both claim the
      // last seats (the loser matches 0 rows). The OPEN->SOLD_OUT flip + soldOutAt
      // stamp follow via recomputeStoredStatus, which derives status from the new fill.
      const claim = exclusive
        ? // Exclusive charter (D5): only an OPEN, still-empty departure can be taken;
          // claim the WHOLE unit so no one else can book it.
          await tx.departure.updateMany({
            where: {
              id: dto.departureId,
              tourId: dto.tourId,
              status: DepartureStatus.OPEN,
              bookedCount: 0,
            },
            data: { bookedCount: capacity },
          })
        : // Shared / per-person: guarded count-up; claims only if seats remain.
          await tx.departure.updateMany({
            where: {
              id: dto.departureId,
              tourId: dto.tourId,
              status: DepartureStatus.OPEN,
              bookedCount: { lte: capacity - seats },
            },
            data: { bookedCount: { increment: seats } },
          });
      if (claim.count === 0) {
        throw new UnprocessableEntityException(
          exclusive
            ? 'This departure is no longer available for a private charter'
            : 'Not enough availability for this departure',
        );
      }
      // Re-derive OPEN/SOLD_OUT + stamp soldOutAt from the new fill (sticky
      // CLOSED/CANCELLED states are left untouched).
      await this.recomputeStoredStatus(tx, dto.departureId);

      const status = operatorFull
        ? BookingStatus.CONFIRMED
        : BookingStatus.ON_HOLD;
      return tx.booking.create({
        data: {
          id,
          tourId: dto.tourId,
          departureId: dto.departureId,
          operatorId: ctx.tour.operatorId,
          userId: userId ?? null,
          displayRef: makeDisplayRef(id, localStart),
          status,
          paymentModel: ctx.tour.paymentModel,
          currency: bookingCurrency,
          localDate: ctx.departure.date,
          startTime: timeOfDay(ctx.departure.startTime),
          tourStartDateTime: localStart,
          tourEndDateTime,
          tourTimeZone: ctx.tour.timeZone,
          island: ctx.tour.destination?.slug ?? 'Curaçao',
          utcExpiresAt: operatorFull
            ? null
            : new Date(
                Date.now() +
                  (dto.expirationMinutes ?? DEFAULT_HOLD_MINUTES) * 60_000,
              ),
          utcConfirmedAt: operatorFull ? new Date() : null,
          exclusiveDeparture: exclusive,
          pickupRequested: dto.pickupRequested ?? false,
          pickupLocationId: dto.pickupLocationId ?? null,
          pickupAddress: ctx.pickupSnapshot.address,
          pickupMinutesPrior: ctx.pickupSnapshot.minutesPrior,
          pickupWindowStart: ctx.pickupSnapshot.windowStart,
          pickupWindowEnd: ctx.pickupSnapshot.windowEnd,
          // Priced pickup snapshot (booking currency) - already inside totalRetail.
          pickupUnitPrice: pricing.pickup?.unitPrice ?? null,
          pickupTotalPrice: pricing.pickup?.totalPrice ?? null,
          // Only ON_ARRIVAL bookings collect on site, so the terms are meaningless
          // (and misleading in the email) on any other model.
          onArrivalPayment:
            ctx.tour.paymentModel === PaymentModel.ON_ARRIVAL
              ? ctx.tour.onArrivalPayment
              : null,
          notes: dto.notes ?? null,
          newsletterOptIn: dto.newsletterOptIn ?? false,
          // Attribution snapshot (master 8.1.6 / E.8) - written at creation only, so
          // the idempotent re-reserve early-return above never overwrites the original
          // click ids/UTMs. Feeds the booking_complete push (8.3) + later ad adjustments.
          gclid: dto.attribution?.gclid ?? null,
          gbraid: dto.attribution?.gbraid ?? null,
          wbraid: dto.attribution?.wbraid ?? null,
          fbclid: dto.attribution?.fbclid ?? null,
          utmSource: dto.attribution?.utmSource ?? null,
          utmMedium: dto.attribution?.utmMedium ?? null,
          utmCampaign: dto.attribution?.utmCampaign ?? null,
          utmTerm: dto.attribution?.utmTerm ?? null,
          utmContent: dto.attribution?.utmContent ?? null,
          // Discount/coupon deferred (flaw #2): with no server-side coupon-validation
          // engine, a client-supplied discount is untrusted, so we never write one -
          // the full price stays authoritative. Wire this when the coupon engine exists.
          totalRetail: pricing.totalRetail,
          totalNet: pricing.totalNet,
          depositAmount: pricing.depositAmount,
          balanceAmount: pricing.balanceAmount,
          commissionRate: pricing.commissionRate,
          commissionAmount: pricing.commissionAmount,
          totalEur: pricing.totalEur,
          fxRateToEur: pricing.fxRateToEur,
          // Multi-currency source snapshot + FX audit (guide §20.2/§20.8). Rates are
          // frozen here and never refetched at payment/TYP/email/tracking time.
          sourceCurrency,
          sourceTotalRetail: pricing.sourceTotalRetail,
          sourceDepositAmount: pricing.sourceDepositAmount,
          sourceBalanceAmount: pricing.sourceBalanceAmount,
          sourceFxRateToBooking: pricing.sourceFxRateToBooking,
          sourceFxProvider: sourceRate.provider,
          sourceFxProviderAsOf: sourceRate.providerAsOf,
          eurFxProvider: eurRate.provider,
          eurFxProviderAsOf: eurRate.providerAsOf,
          unitItems: {
            create: pricing.unitItems.map((u, idx) => ({
              ageBandId: u.ageBandId,
              status,
              priceRetail: u.priceRetail,
              priceNet: u.priceNet,
              travelerAge: seatAges[idx] ?? null,
            })),
          },
          addOns: {
            create: pricing.addOns.map((a) => ({
              addOnId: a.addOnId,
              name: a.name,
              unit: a.unit,
              quantity: a.quantity,
              unitPrice: a.unitPrice,
              totalPrice: a.totalPrice,
            })),
          },
        },
        include: { unitItems: true },
      });
    });

    this.logger.log(
      `Booking ${created.displayRef} reserved (${created.status}, ${seats} seats) tour ${dto.tourId}`,
    );

    // Seats were claimed → inventory changed; the booking now exists.
    this.emitBookingEvents(created);

    // OPERATOR_FULL is born CONFIRMED with no charge (rule #21) → fire conversion now.
    if (operatorFull) {
      const finalized = await this.finalizeConfirmation(created);
      return mapBookingPublic(finalized);
    }
    return mapBookingPublic(created);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Quote - server-authoritative price preview (no side effects, master §5)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Compute the server-authoritative price for a prospective booking WITHOUT
   * claiming seats or persisting anything (guide §20.4). It reuses the exact
   * pricing pipeline `reserve` uses (`loadContext` + `computeBookingPricing`), so
   * the preview and the eventual write agree; `reserve` still recomputes and is
   * the source of truth (a quote is never trusted for a persisted booking).
   *
   * Priced in the shopper currency (`dto.currency`, default = tour currency): the totals
   * and per-line breakdown are BOOKING currency, with the original tour-currency quote in
   * `source*` and both FX rates snapshotted (fails closed 503 if a cross rate is missing).
   * Discounts/coupons are deferred (flaw #2) until a coupon-validation engine exists.
   */
  async quote(dto: QuoteBookingDto): Promise<BookingQuoteResponseDto> {
    const ctx = await this.loadContext(dto);
    this.validateRestrictions(ctx);

    const now = localNow(ctx.tour.timeZone);
    // Same live cutoff rule as reserve (master §4): quoting a departure that reserve
    // would immediately reject only manufactures a dead-end checkout.
    const localStart = combineDateTime(
      ctx.departure.date,
      ctx.departure.startTime,
    );
    if (
      cutoffReached(
        localStart.getTime(),
        now.getTime(),
        ctx.tour.bookingCutoffMinutes,
      )
    ) {
      throw new UnprocessableEntityException(
        'Booking cutoff has passed for this departure',
      );
    }
    const bookingCurrency = dto.currency ?? ctx.tour.defaultCurrency;
    const { sourceCurrency, sourceRate, pricing } = await this.resolvePricing(
      ctx,
      bookingCurrency,
      now,
    );

    // Convert a source-currency amount into booking currency for the breakdown, using
    // the same per-line rounding as the money math so the lines reconcile to the total.
    const toBooking = (v: Prisma.Decimal) =>
      v.times(sourceRate.rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    // ── Human-readable breakdown in BOOKING currency (participants, then add-ons) ──
    const addOnsTotal = pricing.addOns.reduce(
      (sum, a) => sum.plus(a.totalPrice),
      new Prisma.Decimal(0),
    );
    const lines: QuoteLineDto[] = [];
    if (ctx.isUnit) {
      // The charter subtotal is the whole-unit retail (total minus add-ons).
      const charterSubtotal = pricing.totalRetail.minus(addOnsTotal);
      lines.push({
        kind: 'participant',
        ageBandId: null,
        label: unitCharterLabel(ctx.tour.wholeUnitType),
        quantity: ctx.guests,
        unitPrice: (ctx.tour.basePrice != null
          ? toBooking(ctx.tour.basePrice)
          : charterSubtotal
        ).toString(),
        lineTotal: charterSubtotal.toString(),
      });
    } else {
      for (const l of ctx.lines) {
        const unitPrice = toBooking(l.priceRetail);
        lines.push({
          kind: 'participant',
          ageBandId: l.ageBandId,
          label: l.label ?? 'Participant',
          quantity: l.quantity,
          unitPrice: unitPrice.toString(),
          lineTotal: unitPrice
            .times(l.quantity)
            .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
            .toString(),
        });
      }
    }
    for (const a of pricing.addOns) {
      lines.push({
        kind: 'addon',
        ageBandId: null,
        label: a.name,
        quantity: a.quantity,
        unitPrice: a.unitPrice.toString(),
        lineTotal: a.totalPrice.toString(),
      });
    }
    // Priced pickup zone (master 5.8): per-person price × pax, PAID_ADDON model only.
    if (pricing.pickup) {
      lines.push({
        kind: 'pickup',
        ageBandId: null,
        label: ctx.pickupSnapshot.name ?? 'Pickup',
        quantity: pricing.pax,
        unitPrice: pricing.pickup.unitPrice.toString(),
        lineTotal: pricing.pickup.totalPrice.toString(),
      });
    }

    return {
      quoteId: randomUUID(),
      expiresAt: new Date(
        Date.now() + QUOTE_TTL_MINUTES * 60_000,
      ).toISOString(),
      tourCurrency: sourceCurrency,
      currency: bookingCurrency,
      sourceFxRateToBooking: pricing.sourceFxRateToBooking.toString(),
      fxRateToEur: pricing.fxRateToEur ? pricing.fxRateToEur.toString() : null,
      sourceTotalRetail: pricing.sourceTotalRetail.toString(),
      totalRetail: pricing.totalRetail.toString(),
      sourceDepositAmount: pricing.sourceDepositAmount.toString(),
      depositAmount: pricing.depositAmount.toString(),
      sourceBalanceAmount: pricing.sourceBalanceAmount.toString(),
      balanceAmount: pricing.balanceAmount.toString(),
      commissionRate: pricing.commissionRate.toString(),
      commissionAmount: pricing.commissionAmount
        ? pricing.commissionAmount.toString()
        : null,
      paymentModel: ctx.tour.paymentModel,
      pax: pricing.pax,
      lines,
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Confirm (OCTO step 2) - ON_HOLD → CONFIRMED (payment lands in Phase 6)
  // ════════════════════════════════════════════════════════════════════════

  async confirm(id: string, dto: ConfirmBookingDto) {
    const booking = await this.loadOr404(id);
    if (booking.status === BookingStatus.CONFIRMED) {
      return mapBookingPublic(booking);
    }
    if (booking.status !== BookingStatus.ON_HOLD) {
      throw new ConflictException(`Cannot confirm a ${booking.status} booking`);
    }
    if (booking.utcExpiresAt && booking.utcExpiresAt < new Date()) {
      throw new UnprocessableEntityException('Reservation hold has expired');
    }

    // Money before status (security review 2026-07-20): a booking may only
    // flip to CONFIRMED once the platform has captured what is due at
    // confirmation - the deposit for deposit models, the full total for
    // PAID_IN_FULL. The webhook path (confirmFromPayment) proves this via the
    // succeeded charge itself; this endpoint proves it from the payment
    // ledger, so a raw booking id is no longer a free-confirmation
    // capability. One indexed aggregate - refunds cannot race this into a
    // false positive (a refund implies a prior success).
    const dueNow =
      booking.paymentModel === PaymentModel.PAID_IN_FULL
        ? booking.totalRetail
        : booking.depositAmount;
    if (dueNow.gt(0)) {
      const paid = await this.prisma.payment.aggregate({
        where: {
          bookingId: booking.id,
          status: PaymentStatus.SUCCEEDED,
          kind: { not: PaymentKind.REFUND },
        },
        _sum: { amount: true },
      });
      if ((paid._sum.amount ?? new Prisma.Decimal(0)).lt(dueNow)) {
        throw new HttpException(
          'Booking cannot be confirmed before its payment has succeeded',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.bookingUnitItem.updateMany({
        where: { bookingId: booking.id },
        data: { status: BookingStatus.CONFIRMED },
      });
      return tx.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CONFIRMED,
          utcConfirmedAt: new Date(),
          resellerReference: dto.resellerReference ?? booking.resellerReference,
          notes: dto.notes ?? booking.notes,
          contactFirstName: dto.contact.firstName,
          contactLastName: dto.contact.lastName,
          contactFullName: `${dto.contact.firstName} ${dto.contact.lastName}`,
          contactEmail: dto.contact.email,
          contactPhone: dto.contact.phone ?? null,
          contactPostalCode: dto.contact.postalCode ?? null,
          contactCountry: dto.contact.country ?? null,
          contactLocales: dto.contact.locales ?? [],
        },
        include: { unitItems: true },
      });
    });
    this.logger.log(`Booking ${updated.displayRef} confirmed`);
    const finalized = await this.finalizeConfirmation(updated);
    // Status changed; seats unchanged (already held at reserve).
    this.emitBookingEvents(finalized, { availability: false });
    return mapBookingPublic(finalized);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Payment-driven confirmation - called by the Stripe webhook on success
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Settle a booking once its platform charge has succeeded. Transitions an
   * on-hold booking to CONFIRMED (a no-op if already confirmed), snapshots the
   * payment-method billing details (master G5), and finalizes the conversion.
   * Idempotent - safe for webhook redelivery.
   */
  async confirmFromPayment(
    bookingId: string,
    billing?: {
      country?: string | null;
      postalCode?: string | null;
      city?: string | null;
      last4?: string | null;
      brand?: string | null;
    },
    chargeFx?: ChargeFx,
  ): Promise<void> {
    // `?? undefined` so Prisma SKIPS a field rather than nulling an existing
    // value - a late webhook backfilling the card must not wipe what settle set.
    const billingData = billing
      ? {
          billingCountry: billing.country ?? undefined,
          billingPostalCode: billing.postalCode ?? undefined,
          billingCity: billing.city ?? undefined,
          paymentMethodLast4: billing.last4 ?? undefined,
          paymentMethodBrand: billing.brand ?? undefined,
        }
      : {};

    // ATOMIC transition: `settle` (browser return) and the Stripe webhook can
    // both reach here within the same second. A read-then-write would let both
    // observe ON_HOLD and both send emails / fire the conversion. The guarded
    // `updateMany` lets exactly ONE caller flip the row; `count` tells the
    // winner apart from the loser (mirrors the reserve-step seat-claim guard).
    const { count } = await this.prisma.booking.updateMany({
      where: { id: bookingId, status: BookingStatus.ON_HOLD },
      data: {
        status: BookingStatus.CONFIRMED,
        utcConfirmedAt: new Date(),
        ...billingData,
      },
    });
    let transitioned = count === 1;

    // Loser (or a webhook arriving after settle already confirmed): still
    // backfill the card/billing snapshot onto the confirmed booking, but fire
    // no side effects - the winner owns those.
    if (!transitioned && billing) {
      await this.prisma.booking.updateMany({
        where: { id: bookingId },
        data: billingData,
      });
    }

    let current = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { unitItems: true },
    });
    if (!current) {
      this.logger.error(`confirmFromPayment: booking ${bookingId} not found`);
      return;
    }

    // Pay-after-expiry recovery (task #47): the hold was swept to EXPIRED before
    // this payment landed (a slow async method or a very late webhook). The money
    // is captured, so try to HONOR the booking by re-claiming seats; success
    // confirms it as if it had never lapsed. This is the ONLY confirm path that
    // re-claims inventory (a normal confirm reuses the seats held at reserve).
    let recovered = false;
    if (!transitioned && current.status === BookingStatus.EXPIRED) {
      recovered = await this.recoverExpiredBooking(current, billingData);
      // Reload so `current` reflects the outcome - ours, or a concurrent late
      // payment that recovered/confirmed the same booking first.
      current =
        (await this.prisma.booking.findUnique({
          where: { id: bookingId },
          include: { unitItems: true },
        })) ?? current;
      if (recovered) transitioned = true;
    }

    // Loser billing backfill: only meaningful on an already-CONFIRMED booking (the
    // settle/webhook race). Never resurrect billing onto an EXPIRED/CANCELLED
    // booking. (`?? undefined` still stops a late webhook nulling a saved field.)
    if (
      !transitioned &&
      billing &&
      current.status === BookingStatus.CONFIRMED
    ) {
      await this.prisma.booking.updateMany({
        where: { id: bookingId },
        data: billingData,
      });
    }

    if (transitioned) {
      this.logger.log(`Booking ${current.displayRef} confirmed via payment`);
    }

    // SIDE EFFECTS FIRE ONLY FOR A CONFIRMED BOOKING (the fix). `finalizeConfirmation`
    // is idempotent via `conversionFiredAt`, so a settle/webhook race-loser no-ops
    // here; a booking that could NOT be recovered stays EXPIRED and NEVER finalizes -
    // no false confirmation email, no conversion, no account provisioning.
    if (current.status === BookingStatus.CONFIRMED) {
      const finalized = await this.finalizeConfirmation(current, chargeFx);
      if (transitioned) {
        // Recovery re-claimed seats (availability changed); a plain race-win did
        // not (seats were already held at reserve).
        this.emitBookingEvents(finalized, { availability: recovered });
      }
    } else {
      // Payment captured but the booking is not confirmable (hold lapsed + sold
      // out, or cancelled). Money is owed back - so REFUND it (B5). No confirmation
      // side effects fire (no email/conversion); executeRefund is idempotent and
      // best-effort, and logs loudly if the refund itself fails.
      this.logger.error(
        `confirmFromPayment: booking ${current.displayRef} is ${current.status} but its ` +
          `payment succeeded - refunding (hold lapsed / cancelled). NOT confirming.`,
      );
      await this.executeRefund(current.id, current.displayRef);
    }
  }

  /**
   * Pay-after-expiry recovery. The hold lapsed (swept to EXPIRED) before the
   * payment landed; the money is captured, so try to honor the booking by
   * re-claiming inventory. ATOMIC: flip EXPIRED->CONFIRMED (guarded, one winner),
   * then re-claim seats in the SAME transaction - if seats are gone the whole thing
   * rolls back and the booking stays EXPIRED (the refund path handles the captured
   * payment). Freesale bookings (no departure) simply flip. Returns whether it
   * recovered.
   */
  private async recoverExpiredBooking(
    booking: BookingWithItems,
    billingData: Record<string, unknown>,
  ): Promise<boolean> {
    const seats = booking.unitItems.length;
    try {
      await this.prisma.$transaction(async (tx) => {
        // Guard-flip EXPIRED -> CONFIRMED: exactly one caller wins even if two late
        // payment callbacks race the same expired booking.
        const flip = await tx.booking.updateMany({
          where: { id: booking.id, status: BookingStatus.EXPIRED },
          data: {
            status: BookingStatus.CONFIRMED,
            utcConfirmedAt: new Date(),
            ...billingData,
          },
        });
        if (flip.count === 0) throw new HoldRecoveryAbort('already handled');

        if (booking.departureId) {
          const dep = await tx.departure.findUnique({
            where: { id: booking.departureId },
            select: { capacity: true },
          });
          if (!dep) throw new HoldRecoveryAbort('departure gone');
          // Same guarded seat-claim as reserve (master §5): exclusive charter takes
          // the whole still-empty departure; else a conditional count-up.
          const claim = booking.exclusiveDeparture
            ? await tx.departure.updateMany({
                where: {
                  id: booking.departureId,
                  tourId: booking.tourId,
                  status: DepartureStatus.OPEN,
                  bookedCount: 0,
                },
                data: { bookedCount: dep.capacity },
              })
            : await tx.departure.updateMany({
                where: {
                  id: booking.departureId,
                  tourId: booking.tourId,
                  status: DepartureStatus.OPEN,
                  bookedCount: { lte: dep.capacity - seats },
                },
                data: { bookedCount: { increment: seats } },
              });
          if (claim.count === 0) throw new HoldRecoveryAbort('sold out');
          await this.recomputeStoredStatus(tx, booking.departureId);
        }

        await tx.bookingUnitItem.updateMany({
          where: { bookingId: booking.id },
          data: { status: BookingStatus.CONFIRMED },
        });
      });
      this.logger.warn(
        `Booking ${booking.displayRef} recovered after hold expiry (re-claimed ${seats} seat(s)).`,
      );
      return true;
    } catch (err) {
      if (err instanceof HoldRecoveryAbort) {
        this.logger.warn(
          `Booking ${booking.displayRef} not recovered after expiry (${err.message}); refund owed.`,
        );
        return false;
      }
      this.logger.error(
        `recoverExpiredBooking failed for ${booking.displayRef}`,
        err as Error,
      );
      return false;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Conversion finalization - EUR commission backfill + email + CAPI (fire once)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Run the post-confirmation side effects exactly once per booking: normalize the
   * commission to EUR (rule #22), stamp `conversionFiredAt`, send the confirmation
   * email, and fire the `booking_complete` conversion. Guarded by `conversionFiredAt`
   * so it is idempotent across the confirm endpoint, the payment webhook, and retries.
   */
  private async finalizeConfirmation(
    booking: BookingWithItems,
    chargeFx?: ChargeFx,
  ): Promise<BookingWithItems> {
    if (booking.conversionFiredAt) return booking; // fast path - already fired

    // Charge-rate reconciliation (task #28 / 5C): when the PSP reported its own
    // bookingCurrency -> EUR conversion for this charge, the money actually
    // moved at THAT rate - so the EUR normalization below (and the settlement
    // ledger) uses it instead of the ECB rate snapshotted at reserve. The
    // commission RATE stays the reserve snapshot (never retroactive, rule #7);
    // only its EUR value is re-anchored to the true conversion. EUR-charged
    // bookings never carry a PSP rate (nothing was converted).
    const psp =
      chargeFx &&
      booking.currency !== Currency.EUR &&
      chargeFx.rateToEur.isFinite() &&
      chargeFx.rateToEur.gt(0)
        ? chargeFx
        : null;

    // EUR-normalize the commission snapshot (rule #22 / master G3).
    const fxRate = psp
      ? psp.rateToEur.toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP)
      : (booking.fxRateToEur ?? eurFxRate(booking.currency));
    const totalEur = psp
      ? booking.totalRetail
          .mul(fxRate)
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
      : (booking.totalEur ??
        booking.totalRetail
          .mul(fxRate)
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP));
    const commissionAmount = psp
      ? booking.commissionRate
        ? totalEur
            .mul(booking.commissionRate)
            .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
        : (booking.commissionAmount ?? null)
      : (booking.commissionAmount ??
        (booking.commissionRate
          ? totalEur
              .mul(booking.commissionRate)
              .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
          : null));
    // Audit trail: which source supplied the EUR rate that finalization used.
    const fxAudit = psp
      ? { eurFxProvider: psp.provider, eurFxProviderAsOf: psp.asOf }
      : {};

    // ATOMIC mark-first (rule #22 / master §5.1): the guarded `updateMany` on
    // `conversionFiredAt IS NULL` lets exactly one caller win, even when settle
    // and the webhook race. Only the winner (count === 1) sends emails + fires
    // the conversion; the loser returns without side effects, so a booking
    // never double-emails or double-counts a conversion.
    const firedAt = new Date();
    const { count } = await this.prisma.booking.updateMany({
      where: { id: booking.id, conversionFiredAt: null },
      data: {
        fxRateToEur: fxRate,
        totalEur,
        commissionAmount,
        conversionFiredAt: firedAt,
        ...fxAudit,
      },
    });
    if (count === 0) return booking; // another caller already finalized

    // Merge the just-written fields in-memory (no re-read): downstream email +
    // conversion + event emit need them and we hold the exact values we wrote.
    const updated: BookingWithItems = {
      ...booking,
      fxRateToEur: fxRate,
      totalEur,
      commissionAmount,
      conversionFiredAt: firedAt,
      ...fxAudit,
    };

    // Conversion value MUST be a non-null EUR commission (rule #22). Otherwise it is
    // data corruption - log loudly and do NOT fire a conversion with a bad value.
    if (commissionAmount == null) {
      this.logger.error(
        `Booking ${updated.displayRef} confirmed with null commissionAmount - conversion NOT fired (data corruption)`,
      );
    }

    // Money-movement ledger (master SETTLEMENT-AND-PAYOUTS §2): one row per booking
    // at confirmation, in EUR. Needs a non-null commission to record what IT is owed;
    // a null commission is the corruption case above (logged), so skip the row too.
    if (commissionAmount != null) {
      await this.writeSettlement(updated, totalEur, commissionAmount, fxRate);
    }

    const tour = await this.prisma.tour.findUnique({
      where: { id: updated.tourId },
      select: { name: true, destination: { select: { slug: true } } },
    });

    await this.sendConfirmationEmail(updated);
    await this.sendOperatorNotification(updated);
    if (commissionAmount != null) {
      await this.fireConversion(updated, tour?.name ?? null, commissionAmount);
    }
    // Customer account provisioning (welcome email + booking backfill-link).
    // Winner branch only, so it fires once per booking; fire-and-forget - it
    // must never fail or slow the confirmation. OPERATOR_FULL bookings have no
    // contact yet here (provisioning no-ops) and are covered by update().
    void this.customerProvisioning.provisionForBooking(updated);
    return updated;
  }

  /**
   * Write the one-per-booking settlement ledger row (master SETTLEMENT-AND-PAYOUTS
   * §2). All amounts EUR. `netPosition = amountCollected - commissionOwed`, with the
   * fixed sign: POSITIVE = Island Tours owes the operator (paid_in_full holds the
   * remainder to pay out in B4); NEGATIVE = the operator owes IT (operator_full, v2).
   * Deposit models net ~0 (deposit == commission -> record only). `amountCollected`
   * is what IT actually took at checkout, converted to EUR:
   *   paid_in_full -> the full total; operator_full -> 0; deposit models -> the deposit.
   *
   * Idempotent (unique `bookingId`; never overwrites an existing row) and best-effort:
   * a ledger write must NEVER fail a confirmation whose money is already captured -
   * a miss logs loudly for backfill (durability comes with the outbox in B6).
   */
  private async writeSettlement(
    booking: BookingWithItems,
    totalEur: Prisma.Decimal,
    commissionEur: Prisma.Decimal,
    fxRate: Prisma.Decimal,
  ): Promise<void> {
    try {
      const collected =
        booking.paymentModel === PaymentModel.PAID_IN_FULL
          ? totalEur
          : booking.paymentModel === PaymentModel.OPERATOR_FULL
            ? new Prisma.Decimal(0)
            : booking.depositAmount
                .mul(fxRate)
                .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const netPosition = collected
        .minus(commissionEur)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

      await this.prisma.settlement.upsert({
        where: { bookingId: booking.id },
        create: {
          bookingId: booking.id,
          operatorId: booking.operatorId,
          paymentModel: booking.paymentModel,
          amountCollected: collected,
          commissionOwed: commissionEur,
          netPosition,
          currency: Currency.EUR,
        },
        update: {}, // never overwrite an existing ledger row
      });
    } catch (err) {
      this.logger.error(
        `Settlement ledger write failed for ${booking.displayRef} - backfill needed`,
        err as Error,
      );
    }
  }

  /**
   * Void a booking's settlement when the booking is cancelled. A cancelled
   * booking delivers nothing, so its operator-payout obligation disappears:
   * `status -> REVERSED`, `netPosition -> 0`, `operatorPayout -> null`. This
   * keeps the ledger honest after a refund - otherwise a cancelled paid_in_full
   * booking keeps showing "Recorded / operator payout owed / releases {date}"
   * and inflates the pending-payout summary, even though the money went back to
   * the traveller. `amountCollected`/`commissionOwed` are LEFT as the historical
   * record of what was taken at confirmation (audit trail); only the obligation
   * (net) is zeroed. Idempotent: skips a row already REVERSED or PAID_OUT.
   *
   * v1 note: forfeit (after-window cancel, no refund) also reverses here - the
   * operator gets nothing on a cancelled booking in v1. A forfeit-to-operator
   * split is a deferred D-tail policy. Best-effort: never fails the cancel.
   */
  private async reverseSettlement(bookingId: string): Promise<void> {
    try {
      await this.prisma.settlement.updateMany({
        where: {
          bookingId,
          status: {
            in: [SettlementStatus.RECORDED, SettlementStatus.INVOICED],
          },
        },
        data: {
          status: SettlementStatus.REVERSED,
          netPosition: new Prisma.Decimal(0),
          operatorPayout: null,
        },
      });
    } catch (err) {
      this.logger.error(
        `Settlement reversal failed for booking ${bookingId} - backfill needed`,
        err as Error,
      );
    }
  }

  /**
   * @param rethrow  Confirm-time sends swallow failures on purpose: the money is
   *   already captured, so an email-provider outage must never fail the booking (the
   *   traveler can resend from the TYP). A traveler-initiated resend passes true
   *   - they asked, so tell them the truth instead of showing a false success.
   */
  private async sendConfirmationEmail(
    booking: BookingWithItems,
    { rethrow = false }: { rethrow?: boolean } = {},
  ): Promise<void> {
    if (!booking.contactEmail) return; // no recipient yet (e.g. OPERATOR_FULL before contact)
    try {
      const context = await this.assembleConfirmationContext(booking);
      const subject = buildConfirmationEmailSubject({
        tourName: String(context.tourName ?? 'Your tour'),
        dateShort: String(context.dateShort ?? ''),
        start: booking.tourStartDateTime,
        localNow: localNow(booking.tourTimeZone ?? 'UTC'),
      });
      await this.mail.sendBookingConfirmationEmail(
        booking.contactEmail,
        subject,
        context,
        buildConfirmationEmailText(context),
      );
    } catch (err) {
      this.logger.error(
        `Confirmation email failed for ${booking.displayRef}`,
        err as Error,
      );
      if (rethrow) throw err;
    }
  }

  /**
   * "Booking Received" notification to the tour operator (C7). Fires once per
   * confirmed booking, right after the traveller confirmation.
   *
   * Recipient is the operator's COMPANY email first (founder decision), falling
   * back to the OCTO supplier contact. Failures are swallowed for the same reason
   * confirm-time traveller sends are: the money is captured, so a dead mailbox
   * must never fail the booking - it only logs.
   */
  private async sendOperatorNotification(
    booking: BookingWithItems,
  ): Promise<void> {
    try {
      const operator = await this.prisma.operator.findUnique({
        where: { id: booking.operatorId },
        select: {
          contactEmail: true,
          companyInfo: { select: { companyEmail: true } },
        },
      });
      const to =
        operator?.companyInfo?.companyEmail ?? operator?.contactEmail ?? null;
      if (!to) {
        this.logger.warn(
          `No operator email on file for booking ${booking.displayRef} - operator not notified`,
        );
        return;
      }

      // Operators work in English regardless of the traveller's locale.
      const travellerCtx = await this.assembleConfirmationContext(
        booking,
        Locale.en,
      );
      const context = buildOperatorNotificationContext(travellerCtx, {
        guestName:
          booking.contactFullName ??
          ([booking.contactFirstName, booking.contactLastName]
            .filter(Boolean)
            .join(' ') ||
            null),
        guestEmail: booking.contactEmail,
        guestPhone: booking.contactPhone,
        dashboardUrl: `${dashboardAppBase()}/bookings`,
      });
      await this.mail.sendOperatorBookingReceivedEmail(
        to,
        buildOperatorNotificationSubject(context),
        context,
        buildOperatorNotificationText(context),
      );
    } catch (err) {
      this.logger.error(
        `Operator notification failed for ${booking.displayRef}`,
        err as Error,
      );
    }
  }

  /**
   * Load everything the locked confirmation template needs and fold it into the
   * token context. The assembly itself is a pure function
   * ({@link buildConfirmationEmailContext}) so the wireframe's formatting rules are
   * testable without a database; this method is only the I/O around it.
   */
  private async assembleConfirmationContext(
    booking: BookingWithItems,
    localeOverride?: Locale,
  ): Promise<EmailTemplateContext> {
    // The operator notification reuses this context but formats in English (the
    // dashboard language), regardless of what locale the traveller booked in.
    const locale = localeOverride ?? toLocale(booking.customerLocale);

    const [tour, operator, site] = await Promise.all([
      this.prisma.tour.findUnique({
        where: { id: booking.tourId },
        select: {
          name: true,
          slug: true,
          durationMinutesFrom: true,
          cancellationHours: true,
          checkInMinutesBefore: true,
          meetingPointLat: true,
          meetingPointLng: true,
          destinationId: true,
          destination: { select: { name: true, slug: true } },
          ageBands: { select: { id: true, label: true } },
          images: {
            where: { isHero: true },
            select: { url: true },
            take: 1,
          },
          languages: { select: { language: true } },
          // English is the canonical fallback when a locale has no translation row
          // (master: every content endpoint falls back to en).
          translations: {
            where: { locale: { in: [locale, Locale.en] } },
            select: {
              locale: true,
              whatToBring: true,
              knowBeforeYouGo: true,
              meetingPointText: true,
              operatorNote: true,
            },
          },
          locations: {
            select: {
              types: true,
              streetAddress: true,
              translations: {
                where: { locale: { in: [locale, Locale.en] } },
                select: { locale: true, title: true },
              },
            },
          },
        },
      }),
      this.prisma.operator.findUnique({
        where: { id: booking.operatorId },
        select: {
          contactEmail: true,
          contactPhone: true,
          companyInfo: {
            select: {
              companyName: true,
              companyEmail: true,
              companyPhone: true,
            },
          },
        },
      }),
      this.prisma.siteInfo.findFirst({
        select: {
          logo: true,
          whatsappNumber: true,
          enableWhatsappChat: true,
        },
      }),
    ]);
    if (!tour) throw new NotFoundException('Tour not found');

    const related = await this.loadRelatedTours(
      tour.destinationId,
      booking.tourId,
    );

    const pickLocation = (type: string): string | null => {
      const loc = tour.locations.find((l) => l.types.includes(type));
      if (!loc) return null;
      const title = preferLocale(loc.translations, locale)?.title ?? null;
      return title ?? loc.streetAddress ?? null;
    };

    const translation = preferLocale(tour.translations, locale);
    const meetingPoint =
      pickLocation('START') ?? translation?.meetingPointText ?? null;

    // Free-cancellation deadline = start - cancellationHours, in LOCAL wall-clock
    // space (same rule as the TYP; computed, never stored - guide §14).
    const cancelDeadline = booking.tourStartDateTime
      ? new Date(
          booking.tourStartDateTime.getTime() -
            tour.cancellationHours * 3_600_000,
        )
      : null;

    return buildConfirmationEmailContext({
      booking: {
        displayRef: booking.displayRef,
        publicRef: booking.publicRef,
        island: booking.island,
        currency: booking.currency,
        customerLocale: locale,
        contactFirstName: booking.contactFirstName,
        paymentModel: booking.paymentModel,
        onArrivalPayment: booking.onArrivalPayment,
        depositPct: depositPctOf(
          booking.depositAmount.toString(),
          booking.totalRetail.toString(),
        ),
        depositAmount: booking.depositAmount.toString(),
        balanceAmount: booking.balanceAmount.toString(),
        totalAmount: booking.totalRetail.toString(),
        tourStartDateTime: booking.tourStartDateTime,
        localDate: booking.localDate,
        startTime: booking.startTime,
        pickupRequested: booking.pickupRequested,
        pickupAddress: booking.pickupAddress,
        pickupMinutesPrior: booking.pickupMinutesPrior,
        pickupWindowStart: booking.pickupWindowStart,
        pickupWindowEnd: booking.pickupWindowEnd,
        notes: booking.notes,
        cancelDeadline,
        partyLines: buildPartyLines(
          booking.unitItems,
          new Map(tour.ageBands.map((b) => [b.id, b.label])),
        ),
      },
      tour: {
        name: tour.name,
        slug: tour.slug,
        heroImageUrl: tour.images[0]?.url ?? null,
        durationLabel: durationLabel(tour.durationMinutesFrom),
        languageCodes: tour.languages.map((l) => l.language),
        checkInMinutesBefore: tour.checkInMinutesBefore,
        meetingPoint,
        meetingPointLat: tour.meetingPointLat,
        meetingPointLng: tour.meetingPointLng,
        endPoint: pickLocation('END'),
        whatToBring: translation?.whatToBring ?? [],
        knowBeforeYouGo: translation?.knowBeforeYouGo ?? [],
        operatorNote: translation?.operatorNote ?? null,
      },
      operator: {
        name: operator?.companyInfo?.companyName ?? null,
        email:
          operator?.contactEmail ?? operator?.companyInfo?.companyEmail ?? null,
        phone:
          operator?.contactPhone ?? operator?.companyInfo?.companyPhone ?? null,
      },
      site: {
        logoUrl: site?.logo ?? null,
        whatsappNumber: site?.whatsappNumber ?? null,
        whatsappEnabled: site?.enableWhatsappChat ?? false,
      },
      destination: {
        name: tour.destination.name,
        slug: tour.destination.slug,
      },
      relatedTours: related,
      config: {
        frontendUrl: islandToursBase(),
        // BETTER_AUTH_URL is this API's own public origin (it is what Better Auth
        // builds callback URLs from) and is a REQUIRED env, so it is the one value
        // guaranteed to be right here. PUBLIC_API_URL overrides it if the API is
        // ever fronted by a different host.
        apiUrl:
          process.env.PUBLIC_API_URL ??
          process.env.BETTER_AUTH_URL ??
          'https://api.island.tours',
        emailIconBase: emailIconBase(),
      },
    });
  }

  /**
   * The two "More {island} experiences" cards: same destination, live, bookable,
   * excluding the booked tour, in the master §7.2 canonical order
   * (`tier_rank ASC, quality_score DESC, id ASC`) - the same order the listing uses,
   * so the email never contradicts the site.
   *
   * Scoped by DESTINATION, deliberately not by category (founder, 2026-07-16): the
   * block is "More {island} experiences", so it cross-sells the island rather than
   * more of what the traveller just booked.
   */
  private async loadRelatedTours(
    destinationId: string,
    excludeTourId: string,
  ): Promise<RelatedTourInput[]> {
    const rows = await this.prisma.tour.findMany({
      where: {
        destinationId,
        id: { not: excludeTourId },
        status: TourStatus.LIVE,
        isBookable: true,
      },
      orderBy: [{ tierRank: 'asc' }, { qualityScore: 'desc' }, { id: 'asc' }],
      take: 2,
      select: {
        name: true,
        slug: true,
        priceFrom: true,
        defaultCurrency: true,
        aggregateRating: true,
        images: { where: { isHero: true }, select: { url: true }, take: 1 },
      },
    });

    return rows.map((t) => ({
      name: t.name,
      slug: t.slug,
      imageUrl: t.images[0]?.url ?? null,
      aggregateRating: t.aggregateRating,
      priceFrom: t.priceFrom?.toString() ?? null,
      currency: t.defaultCurrency,
    }));
  }

  /**
   * Resend the confirmation email for a booking, from the thank-you page.
   *
   * Keyed on `publicRef` (the unguessable UUID already in the TYP URL, master
   * rule #7) and NOT on a caller-supplied address: the mail always goes to the
   * `contactEmail` stored on the booking. That is the important property - this
   * route is @Public, so if it accepted a recipient it would be an open relay
   * for spamming arbitrary inboxes. Worst case here is a traveler's own inbox,
   * and the route is throttled hard on top (see the controller).
   *
   * Only CONFIRMED bookings: an ON_HOLD booking has no confirmation to resend,
   * and a CANCELLED one must never re-emit "You're booked".
   */
  async resendConfirmation(publicRef: string): Promise<{ sent: boolean }> {
    // Per-BOOKING cap on top of the per-IP throttle: a multi-IP caller must
    // not be able to spam one traveler's inbox via their leaked TYP link.
    this.targetLimiter.consume('resend', publicRef, [
      { max: 10, windowMs: 60 * 60 * 1000 },
    ]);
    const booking = await this.prisma.booking.findUnique({
      where: { publicRef },
      include: { unitItems: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException(
        'Only a confirmed booking has a confirmation email to resend',
      );
    }
    if (!booking.contactEmail) {
      throw new UnprocessableEntityException(
        'This booking has no contact email on file',
      );
    }

    this.logger.log(`Resending confirmation for ${booking.displayRef}`);
    await this.sendConfirmationEmail(booking, { rethrow: true });
    return { sent: true };
  }

  /**
   * Traveller-initiated cancellation REQUEST from the tokenized /cancel page
   * (master 6.4/C1 + the wireframe's modal): it never cancels anything itself -
   * it emails the Island Tours admin, who processes the refund and confirms by
   * email. Keyed on `publicRef` and @Public for the same reason as the TYP.
   *
   * `utcCancellationRequestedAt` is stamped on the FIRST request and never
   * overwritten: refund eligibility is judged at the moment the traveller asked,
   * not when the admin gets to it (gap #16). A repeat submit re-notifies the
   * admin (throttled at the route) but keeps the original instant.
   *
   * Mail failure THROWS (like the TYP resend): the traveller is on a page waiting
   * for "request sent" - a swallowed failure here would silently lose a refund
   * request, which is the worst possible outcome for trust.
   */
  async requestCancellation(
    publicRef: string,
    reason?: string,
    sessionToken?: string | null,
  ): Promise<{ requested: boolean }> {
    const booking = await this.prisma.booking.findUnique({
      where: { publicRef },
      select: CANCELLATION_REQUEST_SELECT,
    });
    if (!booking) throw new NotFoundException('Booking not found');
    // A cancellation request is a mutation, so link possession is not enough
    // (a leaked TYP URL must never let a stranger cancel someone's trip): the
    // caller must hold a traveler session for the booking's contact email -
    // fresh from checkout or from the /bookings pair login (master 6.4).
    if (
      !sessionOwnsBooking(verifyTravelerSession(sessionToken), {
        id: booking.id,
        contactEmail: booking.contactEmail,
      })
    ) {
      throw new UnauthorizedException(
        'Verify with your email and booking reference to request a cancellation',
      );
    }
    return this.submitCancellationRequest(booking, reason);
  }

  /**
   * Cancellation request from a logged-in CUSTOMER (dashboard /account
   * surface). Same downstream flow as the public traveler request; the gate is
   * the Better Auth session + booking ownership (`booking.userId`) instead of
   * the HMAC traveler session. 404 (not 403) on foreign bookings - do not
   * confirm existence to non-owners.
   */
  async requestCancellationAsCustomer(
    id: string,
    actor: { id: string },
    reason?: string,
  ): Promise<{ requested: boolean }> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      select: { ...CANCELLATION_REQUEST_SELECT, userId: true },
    });
    if (!booking || booking.userId !== actor.id) {
      throw new NotFoundException('Booking not found');
    }
    return this.submitCancellationRequest(booking, reason);
  }

  /**
   * The ownership-gate-free core of a cancellation request: per-booking cap,
   * status check, first-request stamp, admin email, traveller/operator
   * notices. Callers MUST have proven ownership already (traveler HMAC session
   * or customer account ownership).
   */
  private async submitCancellationRequest(
    booking: CancellationRequestBooking,
    reason?: string,
  ): Promise<{ requested: boolean }> {
    // Per-BOOKING cap (after the ownership gate - only the verified owner can
    // even reach this): bounds admin-inbox noise from repeat submits.
    this.targetLimiter.consume('cancel-req', booking.publicRef, [
      { max: 5, windowMs: 60 * 60 * 1000 },
    ]);

    // THE gate: the exact predicate the read paths advertise via
    // `canRequestCancellation`, so a surface can never offer something this
    // endpoint would refuse - and, more importantly, a traveller cannot
    // re-submit past a UI that has hidden the button. A repeat submit used to
    // be waved through as "idempotent", but it is not: every one of them
    // re-sent the admin email, the traveller ack and the operator heads-up, so
    // one booking could spam three mailboxes on a loop.
    const { canRequest, reason: blocked } = cancellationEligibility(booking);
    if (!canRequest) {
      throw new ConflictException(
        CANCELLATION_BLOCKED_MESSAGE[blocked ?? 'NOT_CONFIRMED'],
      );
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      this.logger.error(
        'ADMIN_EMAIL is not configured - cancellation requests cannot reach anyone',
      );
      throw new ServiceUnavailableException(
        'Cancellation requests are temporarily unavailable - contact us on WhatsApp',
      );
    }

    if (!booking.utcCancellationRequestedAt) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { utcCancellationRequestedAt: new Date() },
      });
    }

    await this.mail.sendCancellationRequestEmail(adminEmail, {
      displayRef: booking.displayRef,
      tourName: booking.tour?.name ?? 'Unknown tour',
      dateLabel: `${dateKey(booking.localDate)}${booking.startTime ? ` ${booking.startTime}` : ''}`,
      guestName:
        booking.contactFullName ??
        ([booking.contactFirstName, booking.contactLastName]
          .filter(Boolean)
          .join(' ') ||
          'Unknown'),
      guestEmail: booking.contactEmail ?? 'no email on file',
      totalAmount: `${booking.currency} ${booking.totalRetail.toString()}`,
      paymentModel: booking.paymentModel,
      reason: reason?.trim() || null,
      dashboardUrl: `${dashboardAppBase()}/bookings`,
    });

    // Master 6.4 v1 flow: request -> admin email -> admin marks cancelled ->
    // notifications to BOTH traveller and operator. The founder additionally
    // wants an immediate ack pair at request time: traveller ("we're processing
    // it") + operator heads-up. These are best-effort - the request itself has
    // already reached the admin, so a dead mailbox here must not fail it.
    await this.sendCancellationRequestNotices(booking, reason?.trim() || null);

    this.logger.log(`Cancellation requested for ${booking.displayRef}`);
    return { requested: true };
  }

  /** Traveller ack + operator heads-up for a just-submitted cancellation request. */
  private async sendCancellationRequestNotices(
    booking: {
      displayRef: string;
      publicRef: string;
      operatorId: string;
      island: string;
      contactEmail: string | null;
      contactFullName: string | null;
      contactFirstName: string | null;
      contactLastName: string | null;
      customerLocale: string | null;
      localDate: Date;
      tourStartDateTime: Date | null;
      startTime: string | null;
      tour: { name: string } | null;
    },
    reason: string | null,
  ): Promise<void> {
    const [operator, site] = await Promise.all([
      this.prisma.operator.findUnique({
        where: { id: booking.operatorId },
        select: {
          contactEmail: true,
          companyInfo: { select: { companyEmail: true, companyName: true } },
        },
      }),
      this.prisma.siteInfo.findFirst({ select: { logo: true } }),
    ]);

    // Two audiences, two apps: traveller links go to the public site, the
    // operator's link goes to the dashboard app.
    const siteBase = islandToursBase();
    const dashBase = dashboardAppBase();
    const tourName = booking.tour?.name ?? 'Your tour';
    const guestName =
      booking.contactFullName ??
      ([booking.contactFirstName, booking.contactLastName]
        .filter(Boolean)
        .join(' ') ||
        'The traveller');
    const shared = {
      emailIconBase: emailIconBase(),
      siteLogoUrl: emailSafeLogoUrl(site?.logo) ?? '',
      bookingRef: booking.displayRef,
      tourName,
      startTime: booking.startTime ?? '',
    };

    // Traveller ack, in their locale's date format ("request is under processing").
    if (booking.contactEmail) {
      const locale = toLocale(booking.customerLocale);
      const ctx: EmailTemplateContext = {
        ...shared,
        dateLong: formatDateLong(
          booking.tourStartDateTime ?? booking.localDate,
          locale,
        ),
        noticeTitle: 'We got your cancellation request.',
        noticeParagraphs: [
          'Your request is timestamped from the moment you submitted it, so your free-cancellation terms are judged from then - not from when we process it.',
          "We're processing it now. The amount you paid is refunded to your original payment method. We'll email you to confirm once it's done.",
          'Changed your mind? Just reply to this email before we confirm the cancellation.',
        ],
        ctaUrl: `${siteBase}/${booking.island}/thank-you/${booking.publicRef}`,
        ctaLabel: 'View your booking',
      };
      try {
        await this.mail.sendBookingNoticeEmail(
          booking.contactEmail,
          `We got your cancellation request - ${booking.displayRef}`,
          ctx,
          buildNoticeText(ctx),
        );
      } catch (err) {
        this.logger.error(
          `Cancellation ack to traveller failed for ${booking.displayRef}`,
          err as Error,
        );
      }
    }

    // Operator heads-up (company inbox first, founder decision).
    const operatorEmail =
      operator?.companyInfo?.companyEmail ?? operator?.contactEmail ?? null;
    if (operatorEmail) {
      const ctx: EmailTemplateContext = {
        ...shared,
        dateLong: formatDateLong(
          booking.tourStartDateTime ?? booking.localDate,
          Locale.en,
        ),
        noticeTitle: 'Cancellation requested.',
        noticeParagraphs: [
          `${guestName} asked to cancel booking ${booking.displayRef} for ${tourName}.`,
          ...(reason ? [`Their note: ${reason}`] : []),
          "Island Tours processes the refund and confirms the cancellation. You'll be notified when it is final - no action needed from you yet.",
        ],
        ctaUrl: `${dashBase}/bookings`,
        ctaLabel: 'View booking in your dashboard',
      };
      try {
        await this.mail.sendBookingNoticeEmail(
          operatorEmail,
          `Cancellation requested - ${booking.displayRef}: ${tourName}`,
          ctx,
          buildNoticeText(ctx),
        );
      } catch (err) {
        this.logger.error(
          `Cancellation notice to operator failed for ${booking.displayRef}`,
          err as Error,
        );
      }
    }
  }

  /**
   * Traveller confirmation + operator "it's final" notice, sent once a
   * cancellation has actually been processed. This is the other half of
   * `sendCancellationRequestNotices`: that one promises both audiences a
   * follow-up ("We'll email you to confirm once it's done" / "You'll be
   * notified when it is final"), and this is what keeps the promise.
   *
   * Best-effort throughout: the booking IS cancelled and the seats ARE back in
   * inventory by the time we get here, so a dead mailbox must never surface as
   * a failed cancellation to the admin who processed it.
   */
  private async sendCancellationConfirmedNotices(
    booking: {
      id: string;
      displayRef: string;
      publicRef: string;
      operatorId: string;
      tourId: string;
      island: string;
      contactEmail: string | null;
      contactFullName: string | null;
      contactFirstName: string | null;
      contactLastName: string | null;
      customerLocale: string | null;
      localDate: Date;
      tourStartDateTime: Date | null;
      startTime: string | null;
      currency: string;
      totalRetail: Prisma.Decimal;
    },
    refund: CancellationRefund,
  ): Promise<void> {
    const [operator, site, tour] = await Promise.all([
      this.prisma.operator.findUnique({
        where: { id: booking.operatorId },
        select: {
          contactEmail: true,
          companyInfo: { select: { companyEmail: true, companyName: true } },
        },
      }),
      this.prisma.siteInfo.findFirst({ select: { logo: true } }),
      this.prisma.tour.findUnique({
        where: { id: booking.tourId },
        select: { name: true },
      }),
    ]);

    const siteBase = islandToursBase();
    const dashBase = dashboardAppBase();
    const tourName = tour?.name ?? 'Your tour';
    const guestName =
      booking.contactFullName ??
      ([booking.contactFirstName, booking.contactLastName]
        .filter(Boolean)
        .join(' ') ||
        'The traveller');
    const shared = {
      emailIconBase: emailIconBase(),
      siteLogoUrl: emailSafeLogoUrl(site?.logo) ?? '',
      bookingRef: booking.displayRef,
      tourName,
      startTime: booking.startTime ?? '',
    };

    // What the traveller is told about their money. `cancellationRefund` is
    // the POLICY verdict, not proof a refund has settled, so the copy speaks
    // to what happens next rather than claiming it is already back.
    const refundLine =
      refund === CancellationRefund.FULL
        ? `You cancelled within the free-cancellation window, so the full ${booking.currency} ${booking.totalRetail.toString()} is on its way back to your original payment method within 3 to 5 business days.`
        : refund === CancellationRefund.PARTIAL
          ? 'A partial refund applies under the cancellation terms for this trip. We will email you the exact amount as it is processed.'
          : 'This cancellation falls outside the free-cancellation window for this trip, so no refund is due. If you think something went wrong, just reply to this email.';

    if (booking.contactEmail) {
      const locale = toLocale(booking.customerLocale);
      const ctx: EmailTemplateContext = {
        ...shared,
        dateLong: formatDateLong(
          booking.tourStartDateTime ?? booking.localDate,
          locale,
        ),
        noticeTitle: 'Your booking is cancelled.',
        noticeParagraphs: [
          `We have processed your request and cancelled ${booking.displayRef} for ${tourName}. Your seats have been released.`,
          refundLine,
          'Nothing further is needed from you. Booked by mistake, or want to rebook for another date? Just reply to this email.',
        ],
        ctaUrl: `${siteBase}/${booking.island}/thank-you/${booking.publicRef}`,
        ctaLabel: 'View your booking',
      };
      try {
        await this.mail.sendBookingNoticeEmail(
          booking.contactEmail,
          `Your booking is cancelled - ${booking.displayRef}`,
          ctx,
          buildNoticeText(ctx),
        );
      } catch (err) {
        this.logger.error(
          `Cancellation confirmation to traveller failed for ${booking.displayRef}`,
          err as Error,
        );
      }
    }

    const operatorEmail =
      operator?.companyInfo?.companyEmail ?? operator?.contactEmail ?? null;
    if (operatorEmail) {
      const ctx: EmailTemplateContext = {
        ...shared,
        dateLong: formatDateLong(
          booking.tourStartDateTime ?? booking.localDate,
          Locale.en,
        ),
        noticeTitle: 'Cancellation confirmed.',
        noticeParagraphs: [
          `${guestName}'s booking ${booking.displayRef} for ${tourName} has been cancelled and the seats are back in your availability.`,
          'Island Tours handles the traveller refund - no action needed from you.',
        ],
        ctaUrl: `${dashBase}/bookings`,
        ctaLabel: 'View booking in your dashboard',
      };
      try {
        await this.mail.sendBookingNoticeEmail(
          operatorEmail,
          `Cancellation confirmed - ${booking.displayRef}: ${tourName}`,
          ctx,
          buildNoticeText(ctx),
        );
      } catch (err) {
        this.logger.error(
          `Cancellation confirmation to operator failed for ${booking.displayRef}`,
          err as Error,
        );
      }
    }
  }

  /**
   * The confirmation email's "Add to calendar" target: a one-event .ics for this
   * booking.
   *
   * Keyed on `publicRef` and `@Public` for the same reason as the TYP - the link is
   * clicked from an email client with no session. It exposes only what the email
   * already told the traveler, and the ref is unguessable (master rule #7).
   *
   * Emitted in real UTC (`localWallClockToUtc`): a calendar entry is an absolute
   * moment, and the stored start is local wall clock.
   */
  async getCalendar(publicRef: string): Promise<string> {
    const booking = await this.prisma.booking.findUnique({
      where: { publicRef },
      select: {
        publicRef: true,
        displayRef: true,
        status: true,
        tourStartDateTime: true,
        tourEndDateTime: true,
        tourTimeZone: true,
        tour: { select: { name: true } },
        operator: {
          select: { companyInfo: { select: { companyName: true } } },
        },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    // A cancelled booking must not keep handing out a calendar entry.
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException(
        'Only a confirmed booking has a calendar entry',
      );
    }

    const toUtc = (local: Date | null): Date | null =>
      local && booking.tourTimeZone
        ? localWallClockToUtc(local, booking.tourTimeZone)
        : null;

    // No street address in the ICS: this endpoint is publicRef-keyed with no
    // session (it opens straight from mail clients, which can never carry
    // one), so anything in it is readable by any link-holder. The TYP masks
    // the pickup address for exactly that audience - the calendar entry must
    // not hand it back. The traveler finds pickup details on their (verified)
    // booking page.
    const ics = buildBookingIcs({
      publicRef: booking.publicRef,
      displayRef: booking.displayRef,
      tourName: booking.tour?.name ?? 'Your tour',
      operatorName: booking.operator?.companyInfo?.companyName ?? null,
      startUtc: toUtc(booking.tourStartDateTime),
      endUtc: toUtc(booking.tourEndDateTime),
      location: null,
      description: `Booking reference: ${booking.displayRef}. Pickup and meeting details are on your booking page.`,
    });
    if (!ics) {
      throw new UnprocessableEntityException(
        'This booking has no scheduled start time',
      );
    }
    return ics;
  }

  private async fireConversion(
    booking: BookingWithItems,
    tourName: string | null,
    commissionEur: Prisma.Decimal,
  ): Promise<void> {
    await this.tracking.fireBookingComplete({
      eventId: booking.publicRef,
      commissionEur: commissionEur.toNumber(),
      contentId: booking.tourId,
      contentName: tourName,
      email: booking.contactEmail,
      phone: booking.contactPhone,
      firstName: booking.contactFirstName,
      lastName: booking.contactLastName,
      // Address prefers the Stripe billing snapshot (master 8.3), falling back to
      // the contact fields for models with no card (on_arrival / operator_full).
      city: booking.billingCity,
      postalCode: booking.billingPostalCode ?? booking.contactPostalCode,
      country: booking.billingCountry ?? booking.contactCountry,
      clickId: booking.fbclid,
      // The TYP is where the browser Pixel fires the matching event (same event_id);
      // Meta wants the server event to carry the same source URL for attribution.
      eventSourceUrl: `${islandToursBase()}/${booking.island}/thank-you/${booking.publicRef}`,
      eventTimeSec: Math.floor(
        (booking.utcConfirmedAt ?? new Date()).getTime() / 1000,
      ),
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // Cancel - release seats atomically + compute refund from the cancellation window
  // ════════════════════════════════════════════════════════════════════════

  async cancel(
    id: string,
    dto: CancelBookingDto,
    actor?: { id: string; role: Role },
  ) {
    const booking = await this.loadOr404(id);

    // Authorization (security review 2026-07-20) runs BEFORE the idempotent
    // early-return below - otherwise a raw id alone would both confirm a
    // booking exists and hand back its full payload for anything already
    // cancelled. A booking that never reached CONFIRMED was only ever a hold,
    // so the checkout-abandon release - and its idempotent retry - stays open:
    // the raw id is a short-lived secret held only by the reserving client,
    // and releasing a hold just frees seats. Anything that confirmed moved
    // money and inventory, so it demands an authenticated ops actor: a
    // platform-wide booking role, or the operator who owns the booking.
    // Customers/travelers never cancel directly - they use the
    // cancellation-request flow (an admin processes it).
    const heldOnly =
      booking.status === BookingStatus.ON_HOLD ||
      (booking.status === BookingStatus.CANCELLED &&
        booking.utcConfirmedAt === null);
    if (!heldOnly) {
      if (!actor || actor.role === Role.USER) {
        throw new UnauthorizedException(
          'Sign in with an operator or admin account to cancel a confirmed booking',
        );
      }
      if (
        !isPlatformWideBookingRole(actor.role) &&
        booking.operatorId !==
          (await resolveOperatorId(this.prisma, actor.id, actor.role))
      ) {
        // 404, not 403: never confirm a foreign booking's existence.
        throw new NotFoundException('Booking not found');
      }
    }

    if (booking.status === BookingStatus.CANCELLED) {
      // Idempotent retry hook (pre-B6): if this cancellation owed a FULL refund
      // that never executed (Stripe was down/unconfigured, or the attempt
      // FAILED asynchronously), re-invoking cancel re-attempts it. Safe: the
      // executor skips when a SUCCEEDED or in-flight PROCESSING refund exists.
      if (!heldOnly && booking.cancellationRefund === CancellationRefund.FULL) {
        await this.executeRefund(booking.id, booking.displayRef);
      }
      return mapBookingForActor(booking, actor);
    }
    if (
      booking.status === BookingStatus.EXPIRED ||
      booking.status === BookingStatus.REDEEMED
    ) {
      throw new ConflictException(`Cannot cancel a ${booking.status} booking`);
    }

    // Refund eligibility is judged at the traveler's REQUEST instant (master
    // BOOKING-AND-PAYMENTS §): an explicit dto.requestedAt (admin processing a
    // prior request) wins, else a previously-stamped request time, else now
    // (immediate self-cancel). Admin delay can never shrink the refund window.
    const requestedAt = dto.requestedAt
      ? new Date(dto.requestedAt)
      : (booking.utcCancellationRequestedAt ?? new Date());
    const refund = await this.computeRefund(
      booking,
      dto.force ?? false,
      requestedAt,
    );
    const seats = booking.unitItems.length;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (booking.departureId) {
        await this.releaseSeats(
          tx,
          booking.departureId,
          seats,
          booking.exclusiveDeparture,
        );
      }
      await tx.bookingUnitItem.updateMany({
        where: { bookingId: booking.id },
        data: { status: BookingStatus.CANCELLED },
      });
      return tx.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CANCELLED,
          utcCancelledAt: new Date(),
          utcCancellationRequestedAt: requestedAt,
          cancellationRefund: refund,
          cancelledBy: actorToCancelledBy(actor?.role),
          cancellationReason: dto.reason ?? null,
        },
        include: { unitItems: true },
      });
    });
    this.logger.log(
      `Booking ${updated.displayRef} cancelled (refund ${refund})`,
    );
    // Execute the REAL refund before the confirmation email (which tells the
    // traveler their money is on its way). Only a FULL policy verdict moves money -
    // NONE is out-of-window, nothing due. Refunds the actual captured charge, so it
    // is payment-model-aware (deposit for deposit models, total for paid_in_full).
    if (!heldOnly && refund === CancellationRefund.FULL) {
      await this.executeRefund(updated.id, updated.displayRef);
    }
    // Void the settlement: a cancelled booking owes the operator nothing, so its
    // payout obligation is reversed (net -> 0, never releases). Only confirmed
    // bookings ever had a settlement row; a released (PAID_OUT) one is left alone
    // (the money already moved - that is a clawback, handled manually in v1).
    if (!heldOnly) {
      await this.reverseSettlement(updated.id);
    }
    // Close the loop the request ack opened ("We'll email you to confirm once
    // it's done") - until now nothing was ever sent, so a traveller whose
    // request an admin had processed heard nothing at all. Only for bookings
    // that actually confirmed: releasing an abandoned checkout hold is
    // inventory housekeeping, not something to email anyone about.
    if (!heldOnly) {
      await this.sendCancellationConfirmedNotices(updated, refund);
    }
    // Seats released back to inventory + booking status changed.
    this.emitBookingEvents(updated, { availability: !!booking.departureId });
    // Keep the customer aggregates honest - a cancelled booking leaves the
    // CONFIRMED/REDEEMED set, so recompute the (user x operator) snapshot.
    if (updated.userId) {
      void this.customerProvisioning.recomputeAggregates(
        updated.userId,
        updated.operatorId,
      );
    }
    return mapBookingForActor(updated, actor);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Non-payment forfeit (guide §15, OPERATOR_LINK)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Operator reports the OPERATOR_LINK balance was never paid. This is only a
   * REPORT - nothing is forfeited until an admin confirms (guide §15: never
   * automatic). Stamps `utcNonPaymentReportedAt` once; a repeat report is an
   * idempotent no-op. Admins may report on the operator's behalf.
   */
  async reportNonPayment(id: string, actor: { id: string; role: Role }) {
    const booking = await this.loadOr404(id);

    // Ownership: the reporting operator must own the booking (admins bypass).
    if (
      !isPlatformWideBookingRole(actor.role) &&
      booking.operatorId !==
        (await resolveOperatorId(this.prisma, actor.id, actor.role))
    ) {
      // 404, not 403: never confirm a foreign booking's existence.
      throw new NotFoundException('Booking not found');
    }

    if (booking.paymentModel !== PaymentModel.OPERATOR_LINK) {
      throw new ConflictException(
        'Non-payment reports only apply to operator-link bookings',
      );
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException(
        `Cannot report non-payment on a ${booking.status} booking`,
      );
    }
    if (booking.utcNonPaymentReportedAt) {
      return mapBookingForActor(booking, actor); // already reported - idempotent
    }

    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: { utcNonPaymentReportedAt: new Date() },
      include: { unitItems: true },
    });
    this.logger.log(
      `Non-payment reported for booking ${updated.displayRef} (awaiting admin confirmation)`,
    );
    return mapBookingForActor(updated, actor);
  }

  /**
   * Admin confirms a non-payment report: the deposit is FORFEITED (kept - the
   * commission stays earned, so the settlement is NOT reversed) and the spot is
   * released. The booking terminates as CANCELLED with `utcForfeitedAt` set and
   * an explicit NO-refund verdict. Guide §15: only this confirmation may
   * forfeit; there is no automatic path.
   */
  async confirmForfeit(id: string, actor: { id: string; role: Role }) {
    const booking = await this.loadOr404(id);

    if (!booking.utcNonPaymentReportedAt) {
      throw new ConflictException(
        'No non-payment report exists for this booking',
      );
    }
    if (booking.utcForfeitedAt) {
      return mapBookingForActor(booking, actor); // already forfeited - idempotent
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException(`Cannot forfeit a ${booking.status} booking`);
    }

    const seats = booking.unitItems.length;
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      if (booking.departureId) {
        await this.releaseSeats(
          tx,
          booking.departureId,
          seats,
          booking.exclusiveDeparture,
        );
      }
      await tx.bookingUnitItem.updateMany({
        where: { bookingId: booking.id },
        data: { status: BookingStatus.CANCELLED },
      });
      return tx.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CANCELLED,
          utcCancelledAt: now,
          utcForfeitedAt: now,
          cancellationRefund: CancellationRefund.NONE, // deposit is kept
          cancelledBy: CancelledBy.ADMIN,
          cancellationReason:
            'Balance not paid to operator (deposit forfeited)',
        },
        include: { unitItems: true },
      });
    });
    // NO refund and NO settlement reversal: the deposit (~= commission) stays
    // earned. The settlement self-heal cron excludes forfeited bookings.
    this.logger.warn(
      `Booking ${updated.displayRef} FORFEITED (non-payment confirmed; deposit kept, ${seats} seat(s) released)`,
    );
    // Seats returned to inventory + status changed.
    this.emitBookingEvents(updated, { availability: !!booking.departureId });
    if (updated.userId) {
      void this.customerProvisioning.recomputeAggregates(
        updated.userId,
        updated.operatorId,
      );
    }
    return mapBookingForActor(updated, actor);
  }

  /**
   * Admin dismisses a non-payment report (mistake, or the traveler paid after
   * all): clears the report stamp so the booking reads CONFIRMED again.
   */
  async dismissNonPaymentReport(id: string, actor: { id: string; role: Role }) {
    const booking = await this.loadOr404(id);
    if (!booking.utcNonPaymentReportedAt) {
      return mapBookingForActor(booking, actor); // nothing to dismiss
    }
    if (booking.utcForfeitedAt) {
      throw new ConflictException(
        'This booking is already forfeited - the report cannot be dismissed',
      );
    }
    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: { utcNonPaymentReportedAt: null },
      include: { unitItems: true },
    });
    this.logger.log(
      `Non-payment report dismissed for booking ${updated.displayRef}`,
    );
    return mapBookingForActor(updated, actor);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Extend / Update
  // ════════════════════════════════════════════════════════════════════════

  async extend(id: string, dto: ExtendBookingDto) {
    const booking = await this.loadOr404(id);
    if (booking.status !== BookingStatus.ON_HOLD) {
      throw new ConflictException('Only an on-hold booking can be extended');
    }
    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        utcExpiresAt: new Date(
          Date.now() + (dto.expirationMinutes ?? DEFAULT_HOLD_MINUTES) * 60_000,
        ),
      },
      include: { unitItems: true },
    });
    return mapBookingPublic(updated);
  }

  async update(
    id: string,
    dto: UpdateBookingDto,
    sessionToken?: string | null,
  ) {
    const booking = await this.loadOr404(id);
    if (
      booking.status !== BookingStatus.ON_HOLD &&
      booking.status !== BookingStatus.CONFIRMED
    ) {
      throw new ConflictException(`Cannot modify a ${booking.status} booking`);
    }
    // A CONFIRMED booking's contact is its identity: rewriting it re-routes
    // every future email (and the customer-account link), so it demands
    // ownership proof - a traveler session for this booking (from checkout or
    // the /bookings pair login). ON_HOLD stays open: checkout sets the initial
    // contact pre-payment, when the raw id is a short-lived secret held only
    // by the reserving client (security review 2026-07-20).
    if (
      dto.contact &&
      booking.status === BookingStatus.CONFIRMED &&
      !sessionOwnsBooking(verifyTravelerSession(sessionToken), {
        id: booking.id,
        contactEmail: booking.contactEmail,
      })
    ) {
      throw new UnauthorizedException(
        'Verify with your email and booking reference to change contact details',
      );
    }
    // A post-reserve pickup change must move the SNAPSHOT with it (guide §17) - the
    // confirmation surfaces render the snapshot, so leaving the old zone's address/
    // window behind would tell the traveler the wrong place and time. Money fields
    // (pickupUnitPrice/pickupTotalPrice, totalRetail) stay as charged: repricing a
    // live booking is a support/refund action, never an implicit side effect.
    let pickupResnapshot: Record<string, unknown> = {};
    if (dto.pickupLocationId !== undefined) {
      if (dto.pickupLocationId === null) {
        pickupResnapshot = {
          pickupAddress: null,
          pickupMinutesPrior: null,
          pickupWindowStart: null,
          pickupWindowEnd: null,
        };
      } else {
        const pickup = await this.prisma.pickupLocation.findUnique({
          where: { id: dto.pickupLocationId },
          select: {
            tourId: true,
            name: true,
            address: true,
            isActive: true,
            minutesPrior: true,
            windowStart: true,
            windowEnd: true,
          },
        });
        if (!pickup || pickup.tourId !== booking.tourId || !pickup.isActive) {
          throw new UnprocessableEntityException('Invalid pickupLocationId');
        }
        pickupResnapshot = {
          pickupAddress: pickup.address ?? pickup.name,
          pickupMinutesPrior: pickup.minutesPrior,
          pickupWindowStart: pickup.windowStart,
          pickupWindowEnd: pickup.windowEnd,
        };
      }
    }
    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.pickupRequested !== undefined && {
          pickupRequested: dto.pickupRequested,
        }),
        ...(dto.pickupLocationId !== undefined && {
          pickupLocationId: dto.pickupLocationId,
        }),
        ...pickupResnapshot,
        ...(dto.contact && {
          contactFirstName: dto.contact.firstName,
          contactLastName: dto.contact.lastName,
          contactFullName: `${dto.contact.firstName} ${dto.contact.lastName}`,
          contactEmail: dto.contact.email,
          contactPhone: dto.contact.phone ?? null,
          contactPostalCode: dto.contact.postalCode ?? null,
          contactCountry: dto.contact.country ?? null,
          contactLocales: dto.contact.locales ?? [],
        }),
      },
      include: { unitItems: true },
    });
    const mapped: ReturnType<typeof mapBookingPublic> & {
      sessionToken?: string;
    } = mapBookingPublic(updated);
    // A contact landing on an already-CONFIRMED booking (OPERATOR_FULL is born
    // confirmed before checkout collects the contact) is the second customer-
    // provisioning hook - finalizeConfirmation ran before the email existed.
    // Fire-and-forget; provisioning is idempotent when both hooks run.
    if (dto.contact?.email && updated.status === BookingStatus.CONFIRMED) {
      void this.customerProvisioning.provisionForBooking(updated);
    }
    // Checkout sets the contact here (reserve carries no contact fields): the
    // booker who authored the booking gets a traveler session back, so the TYP
    // renders unmasked without a separate /bookings login. BOOKING-scoped, not
    // email-scoped: the email is CALLER-SUPPLIED and unproven here, so the
    // token must unlock only this one booking - an email-bound token minted
    // from this endpoint would let anyone reserve a throwaway booking, type a
    // victim's email, and unlock the victim's real bookings.
    return dto.contact?.email
      ? { ...mapped, sessionToken: issueBookingSession(updated.id) }
      : mapped;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Hold-expiry sweeper - releases seats for lapsed ON_HOLD reservations
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Move every ON_HOLD booking past its `utcExpiresAt` to EXPIRED and atomically
   * restore the held seats. Idempotent and safe to run repeatedly. The BullMQ
   * repeatable scheduler that drives this lands with the Phase 9 workers module;
   * the (correctness-critical) release logic lives here, fully tested.
   */
  async expireStaleHolds(now: Date = new Date()): Promise<number> {
    const stale = await this.prisma.booking.findMany({
      where: { status: BookingStatus.ON_HOLD, utcExpiresAt: { lt: now } },
      select: {
        id: true,
        departureId: true,
        tourId: true,
        localDate: true,
        operatorId: true,
        publicRef: true,
        exclusiveDeparture: true,
        _count: { select: { unitItems: true } },
      },
    });

    let expired = 0;
    for (const b of stale) {
      try {
        await this.prisma.$transaction(async (tx) => {
          if (b.departureId) {
            await this.releaseSeats(
              tx,
              b.departureId,
              b._count.unitItems,
              b.exclusiveDeparture,
            );
          }
          await tx.bookingUnitItem.updateMany({
            where: { bookingId: b.id },
            data: { status: BookingStatus.EXPIRED },
          });
          await tx.booking.update({
            where: { id: b.id },
            data: { status: BookingStatus.EXPIRED },
          });
        });
        expired++;
        // Seats released back to inventory + booking expired.
        this.emitBookingEvents(b, { availability: !!b.departureId });
      } catch (err) {
        this.logger.error(`Failed to expire booking ${b.id}`, err as Error);
      }
    }
    if (expired) this.logger.log(`Expired ${expired} stale hold(s)`);
    return expired;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Reads (auth-scoped)
  // ════════════════════════════════════════════════════════════════════════

  async getById(id: string, actor: { id: string; role: Role }) {
    const booking = await this.loadOr404(id);
    await this.assertCanView(booking, actor);
    return stripCommissionForCustomer(mapBooking(booking), actor.role);
  }

  /**
   * Traveller booking lookup (the `/bookings` login surface): verifies the
   * email + display-reference pair and returns the TYP coordinates so the
   * frontend can redirect to `/{destinationSlug}/thank-you/{publicRef}`.
   *
   * Enumeration-proof: "email unknown", "reference unknown", and "pair
   * mismatch" all throw the same generic 404, so the endpoint never confirms
   * whether an email has bookings. Matching is case-insensitive on both sides
   * (references are retyped from an email, addresses from memory).
   */
  async lookupBooking(
    dto: LookupBookingDto,
    ip?: string,
  ): Promise<BookingLookupResponseDto> {
    // Per-credential failure caps (login spec) on top of the per-IP throttle;
    // throws 429 with a uniform message when locked out.
    this.lookupLimiter.assertAllowed(dto.email, dto.reference, ip);

    const booking = await this.prisma.booking.findFirst({
      where: {
        displayRef: { equals: dto.reference.trim(), mode: 'insensitive' },
        contactEmail: { equals: dto.email.trim(), mode: 'insensitive' },
      },
      select: {
        publicRef: true,
        displayRef: true,
        tour: { select: { destination: { select: { slug: true } } } },
      },
    });
    if (!booking) {
      this.lookupLimiter.recordFailure(dto.email, dto.reference, ip);
      throw new NotFoundException(
        'No booking matches that email and reference',
      );
    }

    this.lookupLimiter.recordSuccess(dto.email, ip);
    return {
      publicRef: booking.publicRef,
      displayRef: booking.displayRef,
      destinationSlug: booking.tour.destination?.slug ?? null,
      // The verified pair IS the login (master 6.4): hand back a 24h session
      // the frontend stores HttpOnly and replays via X-Traveler-Session.
      sessionToken: issueTravelerSession(dto.email),
    };
  }

  /**
   * "Lost your reference?" recovery for the `/bookings` login surface. Always
   * resolves `{ sent: true }` - whether or not the email has bookings - so the
   * endpoint can never be used to probe which addresses booked with us. When
   * bookings exist, ONE branded notice (shared shell) lists the references of
   * up to the five most recent; the send is fire-and-forget so response timing
   * does not leak whether mail went out.
   */
  async recoverReference(
    dto: RecoverReferenceDto,
  ): Promise<RecoverReferenceResponseDto> {
    const email = dto.email.trim();
    // Login-spec recovery limits per TARGET email (1/min, 5/day) - the per-IP
    // throttle alone cannot stop a distributed mail-bomb of one inbox.
    this.targetLimiter.consume('recover', email, [
      { max: 1, windowMs: 60 * 1000 },
      { max: 5, windowMs: 24 * 60 * 60 * 1000 },
    ]);
    const bookings = await this.prisma.booking.findMany({
      where: { contactEmail: { equals: email, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        displayRef: true,
        publicRef: true,
        contactEmail: true,
        customerLocale: true,
        localDate: true,
        tourStartDateTime: true,
        startTime: true,
        tour: {
          select: { name: true, destination: { select: { slug: true } } },
        },
      },
    });

    if (!bookings.length) {
      this.logger.log(
        'Reference recovery requested for an email with no bookings',
      );
      return { sent: true };
    }

    const [latest] = bookings;
    const site = await this.prisma.siteInfo.findFirst({
      select: { logo: true },
    });
    const base = islandToursBase();
    const locale = toLocale(latest.customerLocale);
    const ctx: EmailTemplateContext = {
      emailIconBase: emailIconBase(),
      siteLogoUrl: emailSafeLogoUrl(site?.logo) ?? '',
      bookingRef: latest.displayRef,
      tourName: latest.tour?.name ?? 'Your tour',
      startTime: latest.startTime ?? '',
      dateLong: formatDateLong(
        latest.tourStartDateTime ?? latest.localDate,
        locale,
      ),
      noticeTitle: 'Your booking reference.',
      noticeParagraphs: [
        bookings.length === 1
          ? `Your booking reference is ${latest.displayRef}.`
          : 'Here are the references for your recent bookings:',
        ...(bookings.length > 1
          ? bookings.map(
              (b) =>
                `${b.displayRef} - ${b.tour?.name ?? 'Tour'} (${formatDateLong(
                  b.tourStartDateTime ?? b.localDate,
                  locale,
                )})`,
            )
          : []),
        `Use it together with this email address at ${base}/bookings to open your booking details.`,
      ],
      ctaUrl: `${base}/${latest.tour?.destination?.slug ?? 'curacao'}/thank-you/${latest.publicRef}`,
      ctaLabel: 'View your latest booking',
    };

    // Send to the STORED address (never echo the caller's casing) and don't
    // await - a failed send is logged, the caller still gets the generic ack.
    void this.mail
      .sendBookingNoticeEmail(
        latest.contactEmail ?? email,
        `Your booking reference - ${latest.displayRef}`,
        ctx,
        buildNoticeText(ctx),
      )
      .catch((err: Error) => {
        this.logger.error(
          `Reference recovery email failed for ${latest.displayRef}`,
          err,
        );
      });

    return { sent: true };
  }

  /**
   * Thank-you-page payload, keyed on the unguessable `publicRef` (the TYP token, so
   * this is public). Emits the `booking_complete` conversion object **only** for a
   * confirmed booking with a non-null EUR commission - otherwise `conversion: null`
   * so the frontend renders an error and fires nothing (rule #22).
   */
  /**
   * Statuses that can produce a review. Mirrors `REVIEWABLE_STATUSES` in
   * ReviewsService - the CTA and the create gate must agree, or the button
   * offers something the API refuses.
   */
  private static readonly REVIEWABLE_BOOKING_STATUSES: BookingStatus[] = [
    BookingStatus.CONFIRMED,
    BookingStatus.REDEEMED,
  ];

  /**
   * Whether this booking can still produce a review, and the token to do it
   * with. Null-safe: a booking with no invitation simply cannot review yet.
   *
   * `canReview` deliberately mirrors the create gate rather than re-deciding it
   * - a CTA that offers something the API then refuses is worse than no CTA.
   */
  private async reviewStateFor(booking: {
    id: string;
    status: BookingStatus;
    localDate: Date;
    tourEndDateTime: Date | null;
    tourTimeZone: string | null;
  }) {
    const [existing, invitation] = await Promise.all([
      this.prisma.review.findUnique({
        where: { bookingId: booking.id },
        select: { id: true },
      }),
      this.prisma.reviewInvitation.findUnique({
        where: { bookingId: booking.id },
        select: { token: true, revokedAt: true, completedAt: true },
      }),
    ]);

    const completed = BookingsService.REVIEWABLE_BOOKING_STATUSES.includes(
      booking.status,
    );
    const end =
      booking.tourEndDateTime ?? new Date(booking.localDate.getTime() + 864e5);
    const finished = end <= new Date();
    const usableToken =
      invitation && !invitation.revokedAt && !invitation.completedAt
        ? invitation.token
        : null;

    return {
      reviewed: Boolean(existing),
      canReview: Boolean(completed && finished && !existing && usableToken),
      reviewToken: existing ? null : usableToken,
    };
  }

  async getThankYou(publicRef: string, sessionToken?: string | null) {
    const booking = await this.prisma.booking.findUnique({
      where: { publicRef },
      include: {
        unitItems: { select: { id: true, ageBandId: true } },
        // Purchased extras (snapshot rows) - the TYP lists them like the party.
        addOns: {
          select: {
            id: true,
            name: true,
            unit: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
          },
        },
        tour: {
          select: {
            name: true,
            durationMinutesFrom: true,
            cancellationHours: true,
            ageBands: { select: { id: true, label: true } },
          },
        },
        operator: {
          select: {
            contactEmail: true,
            contactPhone: true,
            companyInfo: {
              select: {
                companyName: true,
                companyEmail: true,
                companyPhone: true,
              },
            },
          },
        },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    // NOTE: the booking_complete conversion payload is deliberately NOT returned
    // here. This GET is hit on every TYP render AND by the /payment/processing
    // poller, so returning it would let the browser pixel double-fire on refresh
    // (master 8.1 item 5). The single browser push is served, mark-first, by the
    // dedicated `claimConversionPush` (POST typ/:publicRef/conversion) instead.

    // Group the per-traveler unit items into party lines ("2 x Adult"). UNIT-priced
    // tours carry no age bands (ageBandId null) and collapse into one "Guest" line.
    const bandLabels = new Map(
      (booking.tour?.ageBands ?? []).map((b) => [b.id, b.label]),
    );
    const counts = new Map<string, number>();
    for (const item of booking.unitItems) {
      const key = item.ageBandId ?? '';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    // Labels are the SINGULAR unit ('Adult', 'Child', 'Guest') - the client
    // pluralises them against the quantity ("4 guests"). A plural label here
    // renders as "4 guestss".
    const party = [...counts].map(([key, quantity]) => ({
      ageBandId: key || null,
      label: key ? (bandLabels.get(key) ?? 'Traveler') : 'Guest',
      quantity,
    }));

    // Free-cancellation deadline = tour start - cancellationHours. Computed, never
    // stored (guide §14). tourStartDateTime is LOCAL wall-clock, so subtract in local
    // space, then resolve the real instant against the snapshotted zone.
    const cancellationHours = booking.tour?.cancellationHours ?? 48;
    const deadlineLocal = booking.tourStartDateTime
      ? new Date(
          booking.tourStartDateTime.getTime() - cancellationHours * 3_600_000,
        )
      : null;

    // The bare publicRef link is a permanent VIEWING capability (master 8.2),
    // but it is NOT identity: an unverified viewer sees only non-identifying
    // tour facts (date, duration, trip name, free-cancel, party count). Every
    // identifying field - guest name, guest email/phone, the operator's direct
    // support contact, pickup address, card details - is withheld until the
    // session proves ownership (fresh booker via checkout, or the /bookings
    // pair login). Founder decision 2026-07-19.
    const verified = sessionOwnsBooking(verifyTravelerSession(sessionToken), {
      id: booking.id,
      contactEmail: booking.contactEmail,
    });
    const fullName =
      booking.contactFullName ??
      ([booking.contactFirstName, booking.contactLastName]
        .filter(Boolean)
        .join(' ') ||
        null);

    // The TYP used to be blind to cancellation entirely: it could not tell a
    // pending request from a fresh booking, so it kept offering "Cancel
    // booking" to someone who had already asked - and showed nothing at all
    // once an admin had actually cancelled. Ship the same verdict the submit
    // endpoint enforces so the page can never contradict it.
    const { canRequest, reason: cancellationBlockedReason } =
      cancellationEligibility(booking);

    // FE-12: the "leave a review" affordance.
    //
    // Gated behind `verified` like every other identifying field: `publicRef` is
    // unguessable but shareable, and the invitation token is a WRITE credential
    // - anyone holding it can submit a review as this guest. It must never ride
    // on a payload an unverified viewer can fetch.
    const review = verified ? await this.reviewStateFor(booking) : null;

    return {
      verified,
      review,
      cancellationRequestedAt:
        booking.utcCancellationRequestedAt?.toISOString() ?? null,
      cancelledAt: booking.utcCancelledAt?.toISOString() ?? null,
      canRequestCancellation: canRequest,
      cancellationBlockedReason,
      // Guest identity: present only when verified, else null (row hidden).
      guestFirstName: verified ? booking.contactFirstName : null,
      guestLastName: verified ? booking.contactLastName : null,
      guestFullName: verified ? fullName : null,
      contactPhone: verified ? booking.contactPhone : null,
      pickupRequested: booking.pickupRequested,
      party,
      // Purchased extras (immutable BookingAddOn snapshots). Like `party`,
      // these are non-identifying tour facts - visible unverified too.
      addOns: (booking.addOns ?? []).map((a) => ({
        name: a.name,
        unit: a.unit,
        quantity: a.quantity,
        unitPrice: a.unitPrice.toString(),
        totalPrice: a.totalPrice.toString(),
      })),
      depositAmount: booking.depositAmount.toString(),
      balanceAmount: booking.balanceAmount.toString(),
      paymentModel: booking.paymentModel,
      paymentMethodBrand: verified ? booking.paymentMethodBrand : null,
      paymentMethodLast4: verified ? booking.paymentMethodLast4 : null,
      durationMinutes: booking.tour?.durationMinutesFrom ?? null,
      cancellationHours,
      freeCancellationDeadlineLocal: deadlineLocal
        ? deadlineLocal.toISOString().slice(0, 19)
        : null,
      freeCancellationDeadlineUtc:
        deadlineLocal && booking.tourTimeZone
          ? localWallClockToUtc(
              deadlineLocal,
              booking.tourTimeZone,
            ).toISOString()
          : null,
      // OCTO supplier contact wins; the company profile is the fallback. The
      // operator NAME is a public business name (shown even unverified); the
      // direct email/phone are withheld until verified - a shared link must not
      // hand out the operator's support line.
      operator: {
        name: booking.operator?.companyInfo?.companyName ?? null,
        email: verified
          ? (booking.operator?.contactEmail ??
            booking.operator?.companyInfo?.companyEmail ??
            null)
          : null,
        phone: verified
          ? (booking.operator?.contactPhone ??
            booking.operator?.companyInfo?.companyPhone ??
            null)
          : null,
      },
      publicRef: booking.publicRef,
      displayRef: booking.displayRef,
      status: booking.status,
      displayStatus: deriveBookingDisplayStatus(booking),
      tourId: booking.tourId,
      tourName: booking.tour?.name ?? 'Your tour',
      island: booking.island,
      localDate: dateKey(booking.localDate),
      startTime: booking.startTime,
      endTime: booking.tourEndDateTime
        ? timeOfDay(booking.tourEndDateTime)
        : null,
      timeZone: booking.tourTimeZone ?? null,
      // Real UTC instants (integrations/ICS/reminders only) - null for pre-snapshot
      // bookings with no zone, since we cannot resolve an absolute moment then.
      startsAtUtc:
        booking.tourStartDateTime && booking.tourTimeZone
          ? localWallClockToUtc(
              booking.tourStartDateTime,
              booking.tourTimeZone,
            ).toISOString()
          : null,
      endsAtUtc:
        booking.tourEndDateTime && booking.tourTimeZone
          ? localWallClockToUtc(
              booking.tourEndDateTime,
              booking.tourTimeZone,
            ).toISOString()
          : null,
      // The pickup address says where the traveler will physically be - hidden
      // outright for unverified viewers (masking a street address is theater).
      pickupAddress: verified ? booking.pickupAddress : null,
      partySize: booking.unitItems.length,
      currency: booking.currency,
      totalRetail: booking.totalRetail.toString(),
      // The TYP only ever shows the booker's own address masked ("sent to
      // d•••@g•••.com"), and nothing on the page needs it raw, so it is masked
      // HERE - the full guest email never leaves the backend, even to the
      // verified owner's own page (booking screens get screenshotted/shared).
      contactEmail: verified ? maskEmail(booking.contactEmail) : null,
    };
  }

  /**
   * Serve the browser `booking_complete` push payload EXACTLY ONCE per booking
   * (master 8.2), then mark it consumed. The TYP server render calls this before
   * streaming the page; the first caller (mark-first winner) receives the payload
   * to push into the dataLayer, and every later caller - a refresh, a second tab,
   * the celebratory render followed by a later management render, a shared link -
   * receives `{ conversion: null }` and pushes nothing.
   *
   * WHY A DEDICATED ENDPOINT, NOT THE PLAIN GET: the /payment/processing poller
   * hits `GET typ/:publicRef`. Marking-first there would let the poll consume the
   * one push, so the real TYP render would push nothing.
   *
   * WHY A SEPARATE GUARD (`conversionPushedAt`, not `conversionFiredAt`): the
   * server fire (CAPI + confirmation email) already set `conversionFiredAt` at
   * confirm/settle. A browser push gated on it would never fire.
   *
   * VERIFIED-GATED: the conversion value is the commission take-rate (business-
   * sensitive), so a shared publicRef link never fires it. The fresh booker is
   * always verified (checkout set the session before the redirect).
   */
  async claimConversionPush(
    publicRef: string,
    sessionToken?: string | null,
  ): Promise<{ conversion: BookingConversionDto | null }> {
    // Per-target throttle (mirrors resend/settle): the browser calls this once,
    // but a hostile multi-IP caller must not hammer one booking's endpoint.
    this.targetLimiter.consume('conversion-push', publicRef, [
      { max: 5, windowMs: 60_000 },
    ]);

    const booking = await this.prisma.booking.findUnique({
      where: { publicRef },
      select: {
        id: true,
        publicRef: true,
        displayRef: true,
        status: true,
        commissionAmount: true,
        tourId: true,
        contactEmail: true,
        // Hashed server-side for the booking_complete user_data (Enhanced
        // Conversions); raw PII never leaves the backend for tracking.
        contactPhone: true,
        contactFirstName: true,
        contactLastName: true,
        contactPostalCode: true,
        contactCountry: true,
        billingCity: true,
        billingPostalCode: true,
        billingCountry: true,
        tour: { select: { name: true } },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    // Verified owner only - never fire for a bare shared link.
    const verified = sessionOwnsBooking(verifyTravelerSession(sessionToken), {
      id: booking.id,
      contactEmail: booking.contactEmail,
    });
    if (!verified) return { conversion: null };

    // Only a CONFIRMED booking with a non-null EUR commission is a real
    // conversion (rule #22). Neither non-confirmed nor null-commission burns the
    // guard: a not-yet-confirmed race can fire on a later call, and a null
    // commission is data corruption to repair, not to silently swallow forever.
    if (booking.status !== BookingStatus.CONFIRMED) return { conversion: null };
    if (booking.commissionAmount == null) {
      this.logger.error(
        `Conversion push for ${booking.displayRef}: confirmed booking has null commissionAmount - not fired (data corruption)`,
      );
      return { conversion: null };
    }

    // Mark-first: exactly one caller flips `conversionPushedAt` from null and
    // wins the payload; all others get null (master 8.2 idempotency). A push that
    // never executes (tab closed before hydration) is an accepted false negative,
    // never a double fire.
    const { count } = await this.prisma.booking.updateMany({
      where: { id: booking.id, conversionPushedAt: null },
      data: { conversionPushedAt: new Date() },
    });
    if (count === 0) return { conversion: null };

    return { conversion: this.buildConversionPayload(booking) };
  }

  /**
   * The browser `booking_complete` payload for a confirmed booking. `eventId` is
   * the booking `publicRef` - it MUST match the server CAPI `event_id`
   * (`fireConversion`) so Meta deduplicates the browser Pixel against the CAPI
   * event (master 8.1 item 4). `userData` carries the SHA-256 hashed PII for Google
   * Enhanced Conversions, hashed server-side via the SAME pass the CAPI uses
   * (master 8.3) so the raw email/phone never reach the browser.
   */
  private buildConversionPayload(booking: {
    publicRef: string;
    commissionAmount: Prisma.Decimal | null;
    tourId: string;
    tour: { name: string } | null;
    contactEmail: string | null;
    contactPhone: string | null;
    contactFirstName: string | null;
    contactLastName: string | null;
    contactPostalCode: string | null;
    contactCountry: string | null;
    billingCity: string | null;
    billingPostalCode: string | null;
    billingCountry: string | null;
  }): BookingConversionDto | null {
    if (booking.commissionAmount == null) return null;
    const userData = toGoogleUserData(
      computeHashedPii({
        email: booking.contactEmail,
        phone: booking.contactPhone,
        firstName: booking.contactFirstName,
        lastName: booking.contactLastName,
        city: booking.billingCity,
        postalCode: booking.billingPostalCode ?? booking.contactPostalCode,
        country: booking.billingCountry ?? booking.contactCountry,
      }),
    );
    return {
      event: 'Purchase',
      eventId: booking.publicRef,
      currency: 'EUR',
      value: booking.commissionAmount.toString(),
      contentId: booking.tourId,
      contentName: booking.tour?.name ?? null,
      userData: userData ?? null,
    };
  }

  async list(query: ListBookingsQueryDto, actor: { id: string; role: Role }) {
    assertDateRangeOrder(query.from, query.to);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.BookingWhereInput = {};

    if (isPlatformWideBookingRole(actor.role)) {
      // Platform-wide: the route requires VIEW_BOOKINGS, so a STAFF/EDITOR
      // caller here has been explicitly granted booking visibility.
    } else if (actor.role === Role.TOUR_OPERATOR) {
      where.operatorId = await resolveOperatorId(
        this.prisma,
        actor.id,
        actor.role,
      );
    } else {
      where.userId = actor.id;
    }

    // FE-12b. The review affordance is attached ONLY on the self-scoped branch.
    // `reviewToken` is a WRITE credential - an admin or operator listing other
    // people's bookings must never receive one, or the list becomes a way to
    // author reviews as any traveller on the platform.
    const selfScoped =
      !isPlatformWideBookingRole(actor.role) &&
      actor.role !== Role.TOUR_OPERATOR;

    if (query.tourId) where.tourId = query.tourId;
    if (query.status) where.status = query.status;
    if (query.paymentModel) where.paymentModel = query.paymentModel;
    if (query.cancellationRequested)
      where.utcCancellationRequestedAt = { not: null };
    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { displayRef: { contains: q, mode: 'insensitive' } },
        { publicRef: { contains: q, mode: 'insensitive' } },
        { contactFullName: { contains: q, mode: 'insensitive' } },
        { contactEmail: { contains: q, mode: 'insensitive' } },
        { tour: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }
    if (query.from || query.to) {
      where.localDate = {};
      if (query.from)
        where.localDate.gte = new Date(`${query.from}T00:00:00.000Z`);
      if (query.to) where.localDate.lte = new Date(`${query.to}T00:00:00.000Z`);
    }

    const [total, rows] = await Promise.all([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        include: {
          unitItems: true,
          tour: { select: { name: true, cancellationHours: true } },
          payments: { select: { kind: true, status: true, amount: true } },
          settlement: { select: { status: true, paymentModel: true } },
          // FE-12b review state. Selected unconditionally (one join either way)
          // but only PROJECTED on the self-scoped branch below.
          review: { select: { id: true } },
          reviewInvitation: {
            select: { token: true, revokedAt: true, completedAt: true },
          },
        },
        // Cancellation-request queues surface oldest-unprocessed first;
        // everything else reads newest bookings first.
        orderBy: query.cancellationRequested
          ? { utcCancellationRequestedAt: 'asc' }
          : { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      total,
      page,
      limit,
      data: rows.map((row) => {
        const item = stripCommissionForCustomer(
          mapBookingListItem(row),
          actor.role,
        );
        return selfScoped
          ? { ...item, review: this.reviewStateForRow(row) }
          : item;
      }),
    };
  }

  /**
   * Review affordance for one list row, from data already joined in.
   *
   * Mirrors {@link reviewStateFor} but takes the row rather than re-querying -
   * a per-row round trip would be N+1 across a 20-row page. The predicate is
   * kept identical to the create gate on purpose: a CTA that offers a review
   * the API refuses is worse than no CTA.
   */
  private reviewStateForRow(row: {
    status: BookingStatus;
    localDate: Date;
    tourEndDateTime: Date | null;
    review: { id: string } | null;
    reviewInvitation: {
      token: string;
      revokedAt: Date | null;
      completedAt: Date | null;
    } | null;
  }) {
    const completed = BookingsService.REVIEWABLE_BOOKING_STATUSES.includes(
      row.status,
    );
    const end =
      row.tourEndDateTime ?? new Date(row.localDate.getTime() + 864e5);
    const finished = end <= new Date();
    const usableToken =
      row.reviewInvitation &&
      !row.reviewInvitation.revokedAt &&
      !row.reviewInvitation.completedAt
        ? row.reviewInvitation.token
        : null;

    return {
      reviewed: Boolean(row.review),
      canReview: Boolean(completed && finished && !row.review && usableToken),
      reviewToken: row.review ? null : usableToken,
    };
  }

  /**
   * Customer dashboard stat row: how many trips (CONFIRMED + REDEEMED), how
   * many still ahead, and net spend per currency - computed LIVE from the
   * payment ledger (SUCCEEDED non-REFUND minus SUCCEEDED REFUND rows), never
   * from the `customers` aggregate snapshots.
   */
  async getCustomerSummary(actor: { id: string }) {
    const paymentScope = {
      booking: { userId: actor.id },
      status: PaymentStatus.SUCCEEDED,
    };
    const [bookingsCount, upcomingCount, paid, refunded] = await Promise.all([
      this.prisma.booking.count({
        where: {
          userId: actor.id,
          status: { in: [...ACTIVE_BOOKING_STATUSES] },
        },
      }),
      this.prisma.booking.count({
        where: {
          userId: actor.id,
          status: BookingStatus.CONFIRMED,
          tourStartDateTime: { gt: new Date() },
        },
      }),
      this.prisma.payment.groupBy({
        by: ['currency'],
        where: { ...paymentScope, kind: { not: PaymentKind.REFUND } },
        _sum: { amount: true },
      }),
      this.prisma.payment.groupBy({
        by: ['currency'],
        where: { ...paymentScope, kind: PaymentKind.REFUND },
        _sum: { amount: true },
      }),
    ]);

    const byCurrency = new Map<string, Prisma.Decimal>();
    for (const row of paid) {
      byCurrency.set(row.currency, row._sum.amount ?? new Prisma.Decimal(0));
    }
    for (const row of refunded) {
      byCurrency.set(
        row.currency,
        (byCurrency.get(row.currency) ?? new Prisma.Decimal(0)).sub(
          row._sum.amount ?? 0,
        ),
      );
    }
    const totalSpend = [...byCurrency.entries()]
      .filter(([, amount]) => !amount.isZero())
      .map(([currency, amount]) => ({ currency, amount: amount.toString() }));

    return { bookingsCount, upcomingCount, totalSpend };
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async loadOr404(id: string): Promise<BookingWithItems> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { unitItems: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  private async assertCanView(
    booking: Booking,
    actor: { id: string; role: Role },
  ): Promise<void> {
    // Platform staff/editors reach the read routes only through the
    // VIEW_BOOKINGS permission gate (see bookings.controller) - platform-wide
    // read, same as the list scope.
    if (isPlatformWideBookingRole(actor.role)) return;
    if (actor.role === Role.TOUR_OPERATOR) {
      const operatorId = await resolveOperatorId(
        this.prisma,
        actor.id,
        actor.role,
      );
      if (booking.operatorId === operatorId) return;
    }
    if (booking.userId && booking.userId === actor.id) return;
    throw new ForbiddenException('You do not have access to this booking');
  }

  private async loadContext(dto: PricingInput) {
    const tour = await this.prisma.tour.findUnique({
      where: { id: dto.tourId },
      select: {
        operatorId: true,
        timeZone: true,
        bookingCutoffMinutes: true,
        defaultCurrency: true,
        paymentModel: true,
        onArrivalPayment: true,
        depositPct: true,
        commissionTier: true,
        minPartySize: true,
        maxPartySize: true,
        durationMinutesFrom: true,
        minAgeYears: true,
        // Pickup (master 5.8): PAID_ADDON prices the selected zone per person;
        // pickupRequired makes a pickup choice mandatory at reserve.
        pickupModel: true,
        pickupRequired: true,
        // UNIT (whole-unit / charter) pricing + exclusivity (checklist §1.3-1.4)
        pricingModel: true,
        wholeUnitType: true,
        basePrice: true,
        unitIncludedGuests: true,
        extraPersonPrice: true,
        bookingType: true,
        destination: { select: { slug: true } },
      },
    });
    if (!tour) throw new NotFoundException('Tour not found');

    // OPERATOR_FULL was dropped for v1 (founder, 2026-07-15): it takes no payment and
    // would create a confirmed, unpaid booking - an operator could bypass payment
    // entirely. Reject it here so neither reserve nor quote can proceed (flaw #6).
    if (tour.paymentModel === PaymentModel.OPERATOR_FULL) {
      throw new UnprocessableEntityException(
        'This tour is not bookable online (unsupported payment model)',
      );
    }

    const departure = await this.prisma.departure.findFirst({
      where: { id: dto.departureId, tourId: dto.tourId },
      select: {
        id: true,
        date: true,
        startTime: true,
        capacity: true,
        bookedCount: true,
      },
    });
    if (!departure)
      throw new UnprocessableEntityException('Invalid departureId');

    // Snapshot the selected pickup point (booking immutability — the PickupLocation
    // row can change after booking). master E.8 `pickup_address`; the TIMING fields
    // are snapshotted for the same reason (guide §17): the confirmation email renders
    // them, so joining live would retroactively rewrite the pickup time a confirmed
    // traveler was already told.
    let pickupSnapshot: PickupSnapshot = EMPTY_PICKUP;
    if (dto.pickupLocationId) {
      const pickup = await this.prisma.pickupLocation.findUnique({
        where: { id: dto.pickupLocationId },
        select: {
          tourId: true,
          name: true,
          address: true,
          price: true,
          isActive: true,
          minutesPrior: true,
          windowStart: true,
          windowEnd: true,
        },
      });
      if (!pickup || pickup.tourId !== dto.tourId || !pickup.isActive) {
        throw new UnprocessableEntityException('Invalid pickupLocationId');
      }
      pickupSnapshot = {
        name: pickup.name,
        address: pickup.address ?? pickup.name,
        minutesPrior: pickup.minutesPrior,
        windowStart: pickup.windowStart,
        windowEnd: pickup.windowEnd,
        // Zone price only ever charges on the PAID_ADDON pickup model (master 5.8);
        // an INCLUDED tour's zones are free even if a price value is present.
        unitPrice:
          tour.pickupModel === PickupModel.PAID_ADDON &&
          pickup.price != null &&
          pickup.price.greaterThan(0)
            ? pickup.price
            : null,
      };
    }

    const addOnLines = await this.loadAddOns(dto);
    const isUnit = tour.pricingModel === PricingModel.UNIT;

    // ── UNIT (whole-unit / charter): a single guests count, no age bands (D4). ──
    if (isUnit) {
      if (dto.items?.length) {
        throw new UnprocessableEntityException(
          'Unit-priced tours take a single guests count, not age-band items',
        );
      }
      const guests = dto.guests;
      if (guests == null) {
        throw new UnprocessableEntityException(
          'guests is required for a unit-priced tour',
        );
      }
      if (tour.basePrice == null) {
        throw new UnprocessableEntityException(
          'Tour is not bookable: unit price is not configured',
        );
      }
      // Surcharge only applies to GROUP charters (D1a); flat unit types leave the
      // included/extra fields null so the total reduces to a flat basePrice.
      const unit: UnitPricingInput = {
        guests,
        basePrice: tour.basePrice,
        unitIncludedGuests: tour.unitIncludedGuests,
        extraPersonPrice: tour.extraPersonPrice,
        priceNet: null,
      };
      const seatAges = (dto.travelerAges ?? []).slice(0, guests);
      return {
        tourId: dto.tourId,
        tour,
        departure,
        isUnit: true as const,
        guests,
        lines: [] as PriceLineInput[],
        unit,
        seatAges,
        addOnLines,
        pickupSnapshot,
      };
    }

    // ── PER_PERSON: age-band lines. ──
    if (!dto.items?.length) {
      throw new UnprocessableEntityException(
        'items (age-band lines) are required for a per-person tour',
      );
    }
    const ageBands = await this.prisma.tourAgeBand.findMany({
      where: { tourId: dto.tourId },
      select: { id: true, label: true, price: true, priceNet: true },
    });
    const ageBandsById = new Map(ageBands.map((b) => [b.id, b]));

    const lines: PriceLineInput[] = dto.items.map((item) => {
      const band = ageBandsById.get(item.ageBandId);
      if (!band) {
        throw new UnprocessableEntityException(
          `Invalid ageBandId ${item.ageBandId}`,
        );
      }
      return {
        ageBandId: band.id,
        quantity: item.quantity,
        priceRetail: band.price,
        priceNet: band.priceNet,
        label: band.label,
      };
    });

    // Per-seat traveler ages, expanded in dto.items order (one entry per seat).
    const seatAges: (number | null)[] = [];
    for (const item of dto.items) {
      for (let i = 0; i < item.quantity; i++) {
        seatAges.push(item.travelerAge ?? null);
      }
    }
    const guests = lines.reduce((s, l) => s + l.quantity, 0);

    return {
      tourId: dto.tourId,
      tour,
      departure,
      isUnit: false as const,
      guests,
      lines,
      unit: undefined,
      seatAges,
      addOnLines,
      pickupSnapshot,
    };
  }

  private async loadAddOns(dto: PricingInput): Promise<AddOnLineInput[]> {
    if (!dto.addOns?.length) return [];
    const ids = dto.addOns.map((a) => a.addOnId);
    const rows = await this.prisma.tourAddOn.findMany({
      where: { id: { in: ids }, tourId: dto.tourId, isActive: true },
      select: {
        id: true,
        name: true,
        unit: true,
        price: true,
        maxQuantity: true,
      },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return dto.addOns.map((a) => {
      const row = byId.get(a.addOnId);
      if (!row)
        throw new UnprocessableEntityException(`Invalid addOnId ${a.addOnId}`);
      // Operator-set ceiling (master E.3 add_ons; widget checklist §3.5): the client
      // stepper caps at maxQuantity, so anything above it is a forged payload.
      if (a.quantity > row.maxQuantity) {
        throw new UnprocessableEntityException(
          `Maximum quantity for "${row.name}" is ${row.maxQuantity}`,
        );
      }
      return {
        addOnId: row.id,
        name: row.name,
        unit: row.unit,
        quantity: a.quantity,
        unitPrice: row.price,
      };
    });
  }

  private validateRestrictions(
    ctx: Awaited<ReturnType<BookingsService['loadContext']>>,
  ): void {
    // Party-size limits apply to the guest headcount in both models (all bands count
    // toward capacity - master E.9). For UNIT that's `guests`; for PER_PERSON it's the
    // summed line quantities. Both are resolved in loadContext as ctx.guests.
    const seats = ctx.guests;
    const minUnits = ctx.tour.minPartySize;
    const maxUnits = ctx.tour.maxPartySize;
    if (seats < minUnits) {
      throw new UnprocessableEntityException(
        `Minimum party size is ${minUnits}`,
      );
    }
    if (maxUnits != null && seats > maxUnits) {
      throw new UnprocessableEntityException(
        `Maximum party size is ${maxUnits}`,
      );
    }

    // Min-age enforcement (master child ages): reject any supplied traveler age below
    // the tour minimum. Ages are optional, so only enforced when supplied.
    const minAge = ctx.tour.minAgeYears;
    if (minAge != null) {
      for (const age of ctx.seatAges) {
        if (age != null && age < minAge) {
          throw new UnprocessableEntityException(
            `Travelers must be at least ${minAge} years old for this tour`,
          );
        }
      }
    }
  }

  /**
   * Release seats back to a departure (cancel / expiry) and re-derive its stored status.
   * A SOLD_OUT departure with room reopens to OPEN, while CLOSED/CANCELLED stay sticky and
   * `soldOutAt` history is preserved (§3). An `exclusive` (private-unit) booking claimed the
   * WHOLE departure, so releasing it resets the fill to zero (D5); otherwise the guest
   * headcount is counted down, clamped at zero.
   */
  private async releaseSeats(
    tx: Prisma.TransactionClient,
    departureId: string,
    seats: number,
    exclusive = false,
  ): Promise<void> {
    if (exclusive) {
      // Exclusive charter release: the whole unit was claimed, so reset to empty.
      await tx.departure.update({
        where: { id: departureId },
        data: { bookedCount: 0 },
      });
    } else {
      // GREATEST(0, bookedCount - seats): read-modify-write inside the txn so a
      // release can never drive bookedCount negative.
      const dep = await tx.departure.findUnique({
        where: { id: departureId },
        select: { bookedCount: true },
      });
      await tx.departure.update({
        where: { id: departureId },
        data: { bookedCount: Math.max(0, (dep?.bookedCount ?? 0) - seats) },
      });
    }
    await this.recomputeStoredStatus(tx, departureId);
  }

  /** Re-derive OPEN/SOLD_OUT from the fill; leave sticky CLOSED/CANCELLED untouched. */
  private async recomputeStoredStatus(
    tx: Prisma.TransactionClient,
    departureId: string,
  ): Promise<void> {
    const dep = await tx.departure.findUnique({
      where: { id: departureId },
      select: {
        capacity: true,
        bookedCount: true,
        status: true,
        soldOutAt: true,
      },
    });
    if (!dep) return;
    if (
      dep.status === DepartureStatus.CLOSED ||
      dep.status === DepartureStatus.CANCELLED
    ) {
      return; // sticky operator/admin states
    }
    const next = storedStatusForFill(dep.capacity, dep.bookedCount);
    if (next === dep.status) return;
    await tx.departure.update({
      where: { id: departureId },
      data: {
        status: next,
        ...(next === DepartureStatus.SOLD_OUT &&
          dep.soldOutAt == null && {
            soldOutAt: new Date(),
          }),
      },
    });
  }

  /**
   * Execute a REAL Stripe refund for a booking and record a REFUND `Payment` row
   * (master 6.4 / C23). Refunds the actual captured charge, so it is
   * payment-model-aware for free: the deposit for deposit models, the full total
   * for paid_in_full.
   *
   * - IDEMPOTENT: skips if a SUCCEEDED REFUND row already exists, and passes a
   *   stable PSP idempotency key so a retry never double-refunds.
   * - PROVIDER-ROUTED: reverses through whichever PSP took the charge (the
   *   Payment row's provider), regardless of the current settings switch.
   * - CONFIG-GATED: no captured on-platform charge (unpaid / operator_full /
   *   on_arrival balance) or no provider config -> nothing to refund, no-op.
   * - BEST-EFFORT: never throws. The state change that triggered it already
   *   committed (a cancellation, or a pay-after-expiry that can't be honored), so a
   *   PSP hiccup must not roll it back - it logs loudly for manual follow-up.
   *   (Durable retry moves to the outbox in B6.)
   */
  private async executeRefund(
    bookingId: string,
    displayRef: string,
  ): Promise<void> {
    try {
      // Never refund twice - a completed refund AND one still in flight
      // (PROCESSING: bank-debit methods settle asynchronously) both count.
      // A FAILED attempt does NOT block: that is exactly the retry case.
      const already = await this.prisma.payment.findFirst({
        where: {
          bookingId,
          kind: PaymentKind.REFUND,
          status: { in: [PaymentStatus.SUCCEEDED, PaymentStatus.PROCESSING] },
        },
        select: { id: true },
      });
      if (already) return;

      // The captured charge to reverse: the latest SUCCEEDED non-refund payment.
      // Its PROVIDER decides which PSP executes the reversal - never the
      // settings switch, which may have changed since the charge was taken.
      const charge = await this.prisma.payment.findFirst({
        where: {
          bookingId,
          kind: { not: PaymentKind.REFUND },
          status: PaymentStatus.SUCCEEDED,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          amount: true,
          currency: true,
          intentId: true,
          chargeId: true,
          provider: true,
        },
      });
      if (!charge?.intentId) return; // nothing captured on-platform to refund

      const viaMollie = charge.provider === PaymentProvider.MOLLIE;
      const providerConfigured = viaMollie
        ? await this.mollie.isConfigured()
        : await this.stripe.isConfigured();
      if (!providerConfigured) {
        this.logger.warn(
          `Refund for ${displayRef} skipped - ${viaMollie ? 'Mollie' : 'Stripe'} not configured`,
        );
        return;
      }

      // A retry after an async FAILURE must not reuse the original idempotency
      // key - the PSP would replay the first (failed) refund from its cache
      // instead of creating a new one. The key advances per failed attempt.
      const failedAttempts =
        (await this.prisma.payment.count({
          where: {
            bookingId,
            kind: PaymentKind.REFUND,
            status: PaymentStatus.FAILED,
          },
        })) || 0;
      const idempotencyKey =
        failedAttempts === 0
          ? `refund-${bookingId}`
          : `refund-${bookingId}-r${failedAttempts}`;

      // The row carries the PSP's ACTUAL answer, never an assumed success:
      // Stripe cards succeed synchronously but bank methods start `pending`;
      // Mollie refunds are ALWAYS async (`queued`/`pending` first). PROCESSING
      // rows settle later - Stripe via refund.updated/refund.failed events,
      // Mollie via the payment webhook re-fetch (embedded refunds).
      let refundId: string;
      let rowStatus: PaymentStatus;
      if (viaMollie) {
        const refund = await this.mollie.createRefund({
          paymentId: charge.intentId,
          amount: charge.amount, // full refund of the captured amount
          currency: charge.currency,
          description: `Refund for booking ${displayRef}`,
          idempotencyKey,
        });
        refundId = refund.id;
        rowStatus = mapMollieRefundStatus(refund.status);
      } else {
        const refund = await this.stripe.refundIntent(
          charge.intentId,
          idempotencyKey,
        );
        refundId = refund.id;
        rowStatus = mapStripeRefundStatus(refund.status);
      }

      await this.prisma.payment.create({
        data: {
          bookingId,
          kind: PaymentKind.REFUND,
          status: rowStatus,
          amount: charge.amount, // full refund of the captured amount
          currency: charge.currency,
          intentId: charge.intentId,
          chargeId: charge.chargeId,
          refundId,
          provider: charge.provider,
        },
      });
      if (rowStatus === PaymentStatus.FAILED) {
        this.logger.error(
          `Refund for ${displayRef} FAILED at ${viaMollie ? 'Mollie' : 'Stripe'} (${refundId}) - manual follow-up needed`,
        );
      } else {
        this.logger.log(
          `Refund ${rowStatus === PaymentStatus.PROCESSING ? 'initiated (pending settlement)' : 'completed'} for ${displayRef}: ${charge.currency} ${charge.amount.toString()} (${refundId})`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Refund failed for ${displayRef} - manual follow-up needed`,
        err as Error,
      );
    }
  }

  private async computeRefund(
    booking: BookingWithItems,
    force: boolean,
    requestedAt: Date,
  ): Promise<CancellationRefund> {
    if (force) return CancellationRefund.FULL;
    // On-hold bookings never took payment → nothing to refund.
    if (booking.status === BookingStatus.ON_HOLD)
      return CancellationRefund.NONE;

    const tour = await this.prisma.tour.findUnique({
      where: { id: booking.tourId },
      select: { cancellationHours: true, timeZone: true },
    });
    if (!tour) return CancellationRefund.NONE;

    // Judge the window at the REQUEST instant, in the zone snapshotted onto the
    // booking (falling back to the live tour zone for pre-snapshot bookings).
    const now = localNow(booking.tourTimeZone ?? tour.timeZone, requestedAt);
    const departureStart = new Date(
      `${dateKey(booking.localDate)}T${booking.startTime ?? '00:00'}:00.000Z`,
    );
    const hoursUntil = (departureStart.getTime() - now.getTime()) / 3_600_000;
    return hoursUntil >= tour.cancellationHours
      ? CancellationRefund.FULL
      : CancellationRefund.NONE;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Pure mapping helpers
// ════════════════════════════════════════════════════════════════════════════

function dec(value: Prisma.Decimal | null): string | null {
  return value ? value.toString() : null;
}
function makeDisplayRef(id: string, localStart: Date): string {
  const year = dateKey(localStart).slice(0, 4);
  return `IT-${year}-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}
function actorToCancelledBy(role?: Role): CancelledBy {
  if (role === Role.ADMIN) return CancelledBy.ADMIN;
  if (role === Role.TOUR_OPERATOR) return CancelledBy.OPERATOR;
  return CancelledBy.CUSTOMER;
}

/** Fallback English label for a whole-unit charter line in a quote breakdown. */
function unitCharterLabel(type: WholeUnitType | null): string {
  switch (type) {
    case WholeUnitType.GROUP:
      return 'Group charter';
    case WholeUnitType.BOAT:
      return 'Boat charter';
    case WholeUnitType.VEHICLE:
      return 'Vehicle charter';
    case WholeUnitType.AIRCRAFT:
      return 'Aircraft charter';
    case WholeUnitType.PACKAGE:
      return 'Package';
    default:
      return 'Charter';
  }
}

/**
 * Dashboard list row: the booking plus display context (tour name, guest
 * contact, party size, cancellation-request judgement). The free-cancellation
 * deadline is computed (start - cancellationHours, wall clock - guide §14) and
 * the in/out-of-window verdict is judged at the REQUEST instant (C23), so the
 * admin queue shows the refund entitlement without recomputing it client-side.
 */
/**
 * Net paid + a coarse payment state from the payment ledger: SUCCEEDED
 * non-REFUND rows count in, SUCCEEDED REFUND rows count out. Coarse on
 * purpose - the row badge for dashboards (operator AND customer), not an
 * accounting figure.
 */
function derivePaymentState(
  payments: {
    kind: PaymentKind;
    status: PaymentStatus;
    amount: Prisma.Decimal;
  }[],
  totalRetail: Prisma.Decimal,
): { paymentStatus: string; paidAmount: string } {
  let paid = new Prisma.Decimal(0);
  let refunded = new Prisma.Decimal(0);
  for (const p of payments) {
    if (p.status !== PaymentStatus.SUCCEEDED) continue;
    if (p.kind === PaymentKind.REFUND) refunded = refunded.add(p.amount);
    else paid = paid.add(p.amount);
  }
  const net = paid.sub(refunded);
  let paymentStatus: string;
  if (refunded.gt(0)) {
    paymentStatus = net.lte(0) ? 'REFUNDED' : 'PARTIALLY_PAID';
  } else if (totalRetail.lte(0) || net.gte(totalRetail)) {
    // Zero-value bookings owe nothing - settled by definition.
    paymentStatus = 'PAID';
  } else {
    paymentStatus = net.gt(0) ? 'PARTIALLY_PAID' : 'UNPAID';
  }
  return { paymentStatus, paidAmount: net.toString() };
}

function mapBookingListItem(
  b: BookingWithItems & {
    tour: { name: string; cancellationHours: number };
    payments: {
      kind: PaymentKind;
      status: PaymentStatus;
      amount: Prisma.Decimal;
    }[];
    settlement: {
      status: SettlementStatus;
      paymentModel: PaymentModel;
    } | null;
  },
) {
  const deadline = b.tourStartDateTime
    ? new Date(
        b.tourStartDateTime.getTime() - b.tour.cancellationHours * 3_600_000,
      )
    : null;
  const cancellation = cancellationEligibility(b);
  return {
    ...mapBooking(b),
    ...derivePaymentState(b.payments, b.totalRetail),
    tourName: b.tour.name,
    contactFullName: b.contactFullName,
    contactEmail: b.contactEmail,
    partySize: b.unitItems.length,
    createdAt: b.createdAt.toISOString(),
    utcCancellationRequestedAt: b.utcCancellationRequestedAt
      ? b.utcCancellationRequestedAt.toISOString()
      : null,
    // Non-payment forfeit lifecycle (guide s15) - drives the dashboard's
    // report/confirm/dismiss row actions.
    utcNonPaymentReportedAt: b.utcNonPaymentReportedAt
      ? b.utcNonPaymentReportedAt.toISOString()
      : null,
    utcForfeitedAt: b.utcForfeitedAt ? b.utcForfeitedAt.toISOString() : null,
    freeCancelDeadline: deadline ? deadline.toISOString() : null,
    requestedInFreeWindow:
      b.utcCancellationRequestedAt && deadline
        ? b.utcCancellationRequestedAt.getTime() <= deadline.getTime()
        : null,
    // Server-decided so no client has to re-derive it (and get it wrong on a
    // wall-clock start time with no zone). Same predicate the endpoint
    // enforces.
    canRequestCancellation: cancellation.canRequest,
    cancellationBlockedReason: cancellation.reason,
    settlementStatus: b.settlement?.status ?? null,
    settlementMethod: b.settlement
      ? settlementMethodFor(b.settlement.paymentModel)
      : null,
    // Payout HELD by a pending cancellation request - same predicate as the
    // settlements page `payoutHeld`, surfaced here so the Bookings/Cancellation
    // tables show "On hold" wherever the settlement badge shows, not just on the
    // Settlements page.
    settlementHeld:
      b.settlement?.status === SettlementStatus.RECORDED &&
      b.settlement.paymentModel === PaymentModel.PAID_IN_FULL &&
      b.status === BookingStatus.CONFIRMED &&
      b.utcCancellationRequestedAt != null &&
      b.utcCancelledAt == null,
    // TRUE refund state from the ledger - PENDING when a cancel owes a refund
    // that has not actually executed (Stripe off / no real charge), so the UI
    // never claims "refunded" before the money moves.
    refundStatus: deriveRefundState(b.payments, b.status, b.cancellationRefund),
  };
}

/**
 * Customers (Role.USER) never see the platform's take on their own purchase:
 * the commission snapshot is operator/admin context (same withholding rule as
 * the public TYP payload). Fields are nulled, not omitted, so the response
 * shape stays DTO-stable for every role.
 */
function stripCommissionForCustomer<
  T extends { commissionRate: string | null; commissionAmount: string | null },
>(payload: T, role: Role): T {
  if (role !== Role.USER) return payload;
  return { ...payload, commissionRate: null, commissionAmount: null };
}

/**
 * Traveler-facing booking payload. The commission snapshot is platform <->
 * operator context: it must never ride a checkout response, where the caller
 * is whoever holds the booking id (reserve/confirm/extend/update are @Public,
 * as is releasing an on-hold booking). Same withholding rule as the TYP
 * payload and the Role.USER reads - nulled, not omitted, so the response shape
 * never varies by caller.
 */
function mapBookingPublic(b: BookingWithItems) {
  return { ...mapBooking(b), commissionRate: null, commissionAmount: null };
}

/**
 * Commission is visible only to an authenticated ops actor (operator/admin
 * dashboards). Anonymous callers and customers get the traveler payload.
 */
function mapBookingForActor(
  b: BookingWithItems,
  actor?: { id: string; role: Role },
) {
  return !actor || actor.role === Role.USER
    ? mapBookingPublic(b)
    : mapBooking(b);
}

function mapBooking(b: BookingWithItems) {
  return {
    id: b.id,
    displayRef: b.displayRef,
    publicRef: b.publicRef,
    tourId: b.tourId,
    departureId: b.departureId,
    status: b.status,
    displayStatus: deriveBookingDisplayStatus(b),
    freesale: b.freesale,
    utcExpiresAt: b.utcExpiresAt ? b.utcExpiresAt.toISOString() : null,
    utcConfirmedAt: b.utcConfirmedAt ? b.utcConfirmedAt.toISOString() : null,
    localDate: dateKey(b.localDate),
    startTime: b.startTime,
    currency: b.currency,
    totalRetail: b.totalRetail.toString(),
    depositAmount: b.depositAmount.toString(),
    balanceAmount: b.balanceAmount.toString(),
    commissionRate: dec(b.commissionRate),
    commissionAmount: dec(b.commissionAmount),
    paymentModel: b.paymentModel,
    cancellationRefund: b.cancellationRefund,
    unitItems: b.unitItems.map((u) => ({
      id: u.id,
      ageBandId: u.ageBandId,
      status: u.status,
      priceRetail: u.priceRetail.toString(),
    })),
  };
}
