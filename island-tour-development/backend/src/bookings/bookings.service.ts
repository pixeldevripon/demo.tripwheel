import { randomInt, randomUUID } from 'crypto';
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
  type Booking,
  BookingStatus,
  type BookingUnitItem,
  CancellationRefund,
  CancelledBy,
  Currency,
  DepartureStatus,
  InboxEvent,
  Locale,
  PaymentKind,
  PaymentModel,
  PaymentProvider,
  PaymentStatus,
  Permission,
  PickupModel,
  PricingModel,
  Prisma,
  RecommendationPlacement,
  Role,
  SettlementStatus,
  TourBookingType,
  TourStatus,
  WholeUnitType,
} from '@prisma/client';
import { StaffPermissionsService } from '@/staff/staff-permissions.service';
import { settlementMethodFor } from '@/settlements/dto/settlement.dto';
import { MollieService } from '@/payments/mollie.service';
import { StripeService } from '@/payments/stripe.service';
import { UnrecoverableError } from 'bullmq';
import { PrismaService } from '@/prisma/prisma.service';
import { MailService } from '@/mail/mail.service';
import { emailSafeLogoUrl } from '@/mail/email-logo.util';
import {
  hashLoginCode,
  issueBookingSession,
  issueTravelerHistorySession,
  issueTravelerSession,
  loginCodeMatches,
  maskEmail,
  sessionHistoryEmail,
  sessionOwnsBooking,
  verifyTravelerSession,
} from './traveler-session.util';
import { CustomerProvisioningService } from '@/customers/customer-provisioning.service';
import {
  LookupRateLimiter,
  TargetRateLimiter,
  type TargetWindow,
} from './lookup-rate-limiter';
import { TrackingService } from '@/tracking/tracking.service';
import { computeHashedPii, toGoogleUserData } from '@/tracking/pii-hash.util';
import { InboxService } from '@/inbox/inbox.service';
import { RecommendationsService } from '@/recommendations/recommendations.service';
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
import { FxRatesService, retailWhole } from '@/fx/fx-rates.service';
import type { FxQuote } from '@/fx/fx-provider.interface';
import {
  addOnQuantityCap,
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
  pickTourLocation,
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
  ReportCancellationDto,
  RequestTravellerCodeDto,
  RequestTravellerCodeResponseDto,
  ReserveBookingDto,
  TravellerListQueryDto,
  UpdateBookingDto,
  VerifyTravellerCodeDto,
  VerifyTravellerCodeResponseDto,
} from './dto/booking.dto';
import { deriveBookingDisplayStatus } from './dto/booking.dto';
import { deriveRefundState } from './refund-state.util';
import {
  mapMollieRefundStatus,
  mapStripeRefundStatus,
} from '@/payments/refund-status.util';

/**
 * Everything a list row needs beyond the booking columns themselves, shared by
 * the dashboard list and the traveller account list so the two can never
 * disagree about payment state, settlement, or review eligibility. Each caller
 * adds its own `tour` select on top (the traveller list also joins the
 * destination, for the thank-you deep link).
 */
const BOOKING_LIST_INCLUDE = {
  unitItems: true,
  payments: { select: { kind: true, status: true, amount: true } },
  settlement: { select: { status: true, paymentModel: true } },
  // Review state is selected unconditionally (one join either way) but
  // PROJECTED only on self-scoped reads - reviewToken is a write credential.
  review: { select: { id: true } },
  reviewInvitation: {
    select: { token: true, revokedAt: true, completedAt: true },
  },
} as const;

const DEFAULT_HOLD_MINUTES = 30;
/**
 * Absolute ceiling on how long a booking may stay ON_HOLD, measured from
 * `createdAt` and independent of how many times `extend()` is called.
 *
 * A hold claims real inventory - and a PRIVATE + UNIT charter claims the WHOLE
 * departure - so an unbounded extend loop is a free, unauthenticated way to
 * keep a departure off sale forever. `extend()` is `@Public()` by necessity
 * (pre-payment there is no session to prove ownership with; the raw booking id
 * IS the short-lived secret), so a per-call check cannot help. This ceiling is
 * what actually bounds it: 4x the default hold, far beyond any real checkout.
 */
const MAX_HOLD_LIFETIME_MINUTES = 120;
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
    private readonly staffPermissions: StaffPermissionsService,
    private readonly inbox: InboxService,
    private readonly recommendations: RecommendationsService,
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
    // All three depend only on values already in hand (the tour's currency, the
    // booking currency, the tour id) - none consumes another's result - so they
    // overlap instead of serializing. This runs on EVERY quote as well as every
    // reserve, i.e. every time the booking widget refreshes a price, so the two
    // round trips saved here are paid back on every stepper tick.
    const [sourceRate, eurRate, effectiveRate] = await Promise.all([
      this.fx.getRate(sourceCurrency, bookingCurrency),
      this.fx.getRate(bookingCurrency, Currency.EUR),
      // Effective commission (tier + any ACTIVE Spotlight), as a percentage.
      this.tiers.effectiveCommissionRate(ctx.tourId, now),
    ]);
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

    // Per-DEPARTURE cap on NEW holds (the idempotent replay above never reaches
    // it, so a retried Continue is free). Reserve is `@Public` and its only
    // other bound is the per-IP throttle, which a multi-IP caller sidesteps and
    // a trusted first-party origin is exempt from - so this is what actually
    // bounds hold churn against one departure. Capacity already caps how many
    // seats can be held at once; this stops the rapid create/expire/re-create
    // loop that would keep a popular departure looking sold out.
    // 60/min is far above any real pattern (a departure sees a handful of
    // reserves per minute even at peak), so it cannot reject a real traveller.
    this.targetLimiter.consume(
      'reserve',
      dto.departureId,
      [{ max: 60, windowMs: 60_000 }],
      'This departure is receiving too many booking attempts. Please wait a moment and try again.',
    );

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

    // Allocated OUTSIDE the transaction: a 5-char code can collide, and a
    // P2002 inside the txn would abort the whole seat claim. The pre-check
    // makes a race practically impossible (two identical codes minted in the
    // same instant); the @unique column stays the final arbiter.
    const displayRef = await this.allocateDisplayRef(localStart);

    const created = await this.prisma.$transaction(async (tx) => {
      const status = operatorFull
        ? BookingStatus.CONFIRMED
        : BookingStatus.ON_HOLD;
      // Insert FIRST, claim LAST. The booking rows don't depend on the claim
      // result, and their FK to `departures` takes FOR KEY SHARE, which does
      // NOT conflict with the claim's row lock - so the multi-row insert runs
      // off the contended row's lock window. Rivals on a hot departure then
      // wait only for the claim UPDATE + commit, not for this insert. A losing
      // claim below rolls the booking rows back with the transaction.
      const booking = await tx.booking.create({
        data: {
          id,
          tourId: dto.tourId,
          departureId: dto.departureId,
          operatorId: ctx.tour.operatorId,
          userId: userId ?? null,
          displayRef,
          status,
          paymentModel: ctx.tour.paymentModel,
          currency: bookingCurrency,
          localDate: ctx.departure.date,
          startTime: timeOfDay(ctx.departure.startTime),
          tourStartDateTime: localStart,
          tourEndDateTime,
          tourTimeZone: ctx.tour.timeZone,
          // Denormalized destination SLUG - it builds the TYP deep link
          // (`/{island}/thank-you/{publicRef}`) and the page 404s on any
          // mismatch, so the fallback must be slug-shaped too. `destination`
          // is a required relation that `loadContext` always selects, so this
          // only guards the impossible case; it used to read 'Curaçao', a
          // display NAME, which would have 404'd that booking's TYP forever.
          island: ctx.tour.destination?.slug ?? 'curacao',
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

      // Atomic guarded seat claim - the overbooking backstop (master §5), as
      // the FINAL statement so the hot-row lock is held for ~one statement +
      // commit. The guard compares live columns in SQL, so a concurrent
      // capacity edit is honoured too (no frozen pre-read).
      const claimed = await this.claimSeats(tx, {
        departureId: dto.departureId,
        tourId: dto.tourId,
        seats,
        exclusive,
      });
      if (!claimed) {
        throw new UnprocessableEntityException(
          exclusive
            ? 'This departure is no longer available for a private charter'
            : 'Not enough availability for this departure',
        );
      }
      return booking;
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

    /**
     * The same conversion, rounded the way a traveller sees money everywhere else
     * on the platform: a whole currency unit, always up (`retailWhole`).
     *
     * Used for the BREAKDOWN below and nothing else. These lines are the
     * human-readable explanation of the price - the charged figures
     * (`totalRetail`, `depositAmount`, `balanceAmount`, the commission) come from
     * `pricing` and are untouched by this. Left at 2dp, the widget rendered
     * "Adult x 1 x 127,88 EUR" directly beneath its own "128 EUR" total, which is
     * the same price contradicting itself twice in one card (Pastel #41).
     *
     * A line total is ceiled from the true amount rather than as
     * `ceil(unit) x quantity`, so what the rows add up to still reconciles with
     * the total the traveller is charged.
     */
    const toBookingWhole = (v: Prisma.Decimal) => retailWhole(toBooking(v));

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
          ? toBookingWhole(ctx.tour.basePrice)
          : retailWhole(charterSubtotal)
        ).toString(),
        lineTotal: retailWhole(charterSubtotal).toString(),
      });
    } else {
      for (const l of ctx.lines) {
        lines.push({
          kind: 'participant',
          ageBandId: l.ageBandId,
          label: l.label ?? 'Participant',
          quantity: l.quantity,
          unitPrice: toBookingWhole(l.priceRetail).toString(),
          // unit x quantity, NOT a ceil of the true line total: the money math
          // now sums whole unit prices too, so this is what actually rides in
          // `totalRetail` and the rows add up to the total on screen.
          lineTotal: toBookingWhole(l.priceRetail).times(l.quantity).toString(),
        });
      }
    }
    for (const a of pricing.addOns) {
      lines.push({
        kind: 'addon',
        ageBandId: null,
        label: a.name,
        quantity: a.quantity,
        unitPrice: retailWhole(a.unitPrice).toString(),
        lineTotal: retailWhole(a.totalPrice).toString(),
      });
    }
    // Priced pickup zone (master 5.8): per-person price × pax, PAID_ADDON model only.
    if (pricing.pickup) {
      lines.push({
        kind: 'pickup',
        ageBandId: null,
        label: ctx.pickupSnapshot.name ?? 'Pickup',
        quantity: pricing.pax,
        unitPrice: retailWhole(pricing.pickup.unitPrice).toString(),
        lineTotal: retailWhole(pricing.pickup.totalPrice).toString(),
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
      // The commission snapshot is PLATFORM-internal and this route is
      // @Public - an anonymous caller pricing a tour must never learn Island
      // Tours' take. Nulled, not omitted, so the DTO shape never varies (the
      // stored booking keeps the real snapshot; only this quote hides it).
      commissionRate: null,
      commissionAmount: null,
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
          // Existence check only (the claim's guard reads live capacity in
          // SQL) - kept so a deleted departure logs 'departure gone', not
          // 'sold out'.
          const dep = await tx.departure.findUnique({
            where: { id: booking.departureId },
            select: { id: true },
          });
          if (!dep) throw new HoldRecoveryAbort('departure gone');
          // Same guarded seat-claim as reserve (master §5): exclusive charter
          // takes the whole still-empty departure; else a conditional
          // count-up. Status flip + soldOutAt stamp are fused into the claim.
          const claimed = await this.claimSeats(tx, {
            departureId: booking.departureId,
            tourId: booking.tourId,
            seats,
            exclusive: booking.exclusiveDeparture,
          });
          if (!claimed) throw new HoldRecoveryAbort('sold out');
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
    // and the webhook race. B6 (§5.2 transactional outbox): the WINNER commits
    // the `booking.confirmed` domain event in the SAME transaction as the
    // guard, so the confirmation email / operator notice / CAPI conversion /
    // pre-tour reminder can never be lost between commit and enqueue - the
    // relay publishes the row to the durable queue with retry + backoff.
    const firedAt = new Date();
    const count = await this.prisma.$transaction(async (tx) => {
      const res = await tx.booking.updateMany({
        where: { id: booking.id, conversionFiredAt: null },
        data: {
          fxRateToEur: fxRate,
          totalEur,
          commissionAmount,
          conversionFiredAt: firedAt,
          ...fxAudit,
        },
      });
      if (res.count === 1) {
        await tx.outboxEvent.create({
          data: {
            aggregate: 'booking',
            aggregateId: booking.id,
            type: 'booking.confirmed',
            payload: {
              bookingId: booking.id,
              publicRef: booking.publicRef,
              paymentModel: booking.paymentModel,
              tourStartDateTime: booking.tourStartDateTime
                ? booking.tourStartDateTime.toISOString()
                : null,
            },
          },
        });
      }
      return res.count;
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

    // Operator-payout ledger (master SETTLEMENT-AND-PAYOUTS §2): one row per
    // confirmed paid_in_full booking, in EUR (writeSettlement no-ops on the
    // self-settling models). Needs a non-null commission to compute the payout;
    // a null commission is the corruption case above (logged), so skip the row too.
    if (commissionAmount != null) {
      await this.writeSettlement(updated, totalEur, commissionAmount);
    }

    // Founder (2026-07-25): confirm-time EMAILS send INLINE so they land the
    // moment the booking confirms - the queued jobs (enqueued via the outbox
    // row committed above) remain the DURABLE RETRY BACKSTOP. The shared guard
    // columns make the two compose: a successful inline send stamps the guard,
    // so the later job no-ops; a failed inline send leaves it null, so the job
    // retries with backoff. CAPI + the pre-tour reminder stay queue-only.
    try {
      await this.runConfirmationEmailJob(updated.id);
    } catch {
      // Logged inside; the queued job retries with backoff.
    }
    try {
      await this.runOperatorNoticeJob(updated.id);
    } catch {
      // Logged inside; the queued job retries with backoff.
    }

    // Customer account provisioning (welcome email + booking backfill-link).
    // Winner branch only, so it fires once per booking; fire-and-forget - it
    // must never fail or slow the confirmation. OPERATOR_FULL bookings have no
    // contact yet here (provisioning no-ops) and are covered by update().
    void this.customerProvisioning.provisionForBooking(updated);
    return updated;
  }

  // ════════════════════════════════════════════════════════════════════════
  // B6 queued-job consumers (PlatformJobsProcessor entry points)
  // ════════════════════════════════════════════════════════════════════════
  // Every method is IDEMPOTENT (EVENT-DRIVEN-AND-QUEUES §5.1): it reloads the
  // booking, re-validates state (the booking may have been cancelled between
  // enqueue and run), checks its own DB guard column, acts, then stamps the
  // guard. A throw makes BullMQ retry with backoff; a clean return completes.

  /** Traveller confirmation email - guard: `utcConfirmationEmailSentAt`. */
  async runConfirmationEmailJob(bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { unitItems: true },
    });
    if (!booking) return;
    if (booking.utcConfirmationEmailSentAt) return; // already sent
    // Re-validate: REDEEMED still deserves its email (confirmed then walked in);
    // a cancelled/expired booking must not receive a confirmation.
    if (
      booking.status !== BookingStatus.CONFIRMED &&
      booking.status !== BookingStatus.REDEEMED
    ) {
      this.logger.warn(
        `Confirmation email skipped for ${booking.displayRef} (status ${booking.status})`,
      );
      return;
    }
    await this.sendConfirmationEmail(booking, { rethrow: true });
    await this.prisma.booking.updateMany({
      where: { id: bookingId, utcConfirmationEmailSentAt: null },
      data: { utcConfirmationEmailSentAt: new Date() },
    });
  }

  /** Operator "Booking Received" notice - guard: `utcOperatorNoticeSentAt`. */
  async runOperatorNoticeJob(bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { unitItems: true },
    });
    if (!booking) return;
    if (booking.utcOperatorNoticeSentAt) return; // already sent
    if (
      booking.status !== BookingStatus.CONFIRMED &&
      booking.status !== BookingStatus.REDEEMED
    ) {
      this.logger.warn(
        `Operator notice skipped for ${booking.displayRef} (status ${booking.status})`,
      );
      return;
    }
    await this.sendOperatorNotification(booking, { rethrow: true });
    // The bell, alongside the email. Hooked HERE rather than at confirm time
    // because this job is already the once-per-booking operator touchpoint and
    // is guarded by `utcOperatorNoticeSentAt`; the inbox dedupeKey makes it
    // idempotent a second time over.
    this.inbox.notify({
      event: InboxEvent.BOOKING_CONFIRMED,
      operatorId: booking.operatorId,
      title: `New booking ${booking.displayRef}`,
      body: `${dateKey(booking.localDate)}${booking.startTime ? ` at ${booking.startTime}` : ''}`,
      url: `/bookings?ref=${booking.displayRef}`,
      entityType: 'booking',
      entityId: booking.id,
      // No actor: the traveller who booked has no dashboard account to exclude.
    });
    await this.prisma.booking.updateMany({
      where: { id: bookingId, utcOperatorNoticeSentAt: null },
      data: { utcOperatorNoticeSentAt: new Date() },
    });
  }

  /**
   * Server-side CAPI conversion. No guard column: Meta dedups by event id
   * (`publicRef` - the same id the browser push carries), so a redelivery is
   * absorbed at the destination. A confirmed booking with a null commission is
   * data corruption (master §8/rule #22): fail UNRECOVERABLY so the job lands
   * in the failed set loudly instead of retrying a value that cannot heal.
   */
  async runCapiConversionJob(bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { unitItems: true },
    });
    if (!booking) return;
    if (
      booking.status !== BookingStatus.CONFIRMED &&
      booking.status !== BookingStatus.REDEEMED
    ) {
      this.logger.warn(
        `CAPI conversion skipped for ${booking.displayRef} (status ${booking.status})`,
      );
      return;
    }
    if (booking.commissionAmount == null) {
      this.logger.error(
        `Booking ${booking.displayRef} confirmed with null commissionAmount - conversion NOT fired (data corruption)`,
      );
      throw new UnrecoverableError(
        `null commissionAmount on ${booking.displayRef}`,
      );
    }
    const tour = await this.prisma.tour.findUnique({
      where: { id: booking.tourId },
      select: { name: true },
    });
    await this.fireConversion(
      booking,
      tour?.name ?? null,
      booking.commissionAmount,
    );
  }

  /**
   * Pre-tour reminder (24h before start) - guard: `utcReminderSentAt`.
   * CONTENT IS PENDING A FOUNDER DECISION (D3): the delayed job plumbing ships
   * with B6 so future bookings are already scheduled; until the template lands
   * this logs and leaves the guard null (so shipping content later picks up
   * any booking whose reminder has not fired yet).
   */
  async runPreTourReminderJob(bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        displayRef: true,
        status: true,
        utcReminderSentAt: true,
      },
    });
    if (!booking) return;
    if (booking.utcReminderSentAt) return;
    if (booking.status !== BookingStatus.CONFIRMED) return; // cancelled/expired since
    this.logger.log(
      `Pre-tour reminder due for ${booking.displayRef} - template pending founder decision, nothing sent`,
    );
  }

  /**
   * Durable refund retry: re-invokes the idempotent executor (skips when a
   * settled REFUNDED or in-flight PROCESSING refund already exists; a FAILED
   * attempt retries with a fresh idempotency key). A throw retries with backoff.
   */
  async runRefundJob(bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, displayRef: true, cancellationRefund: true },
    });
    if (!booking) return;
    if (booking.cancellationRefund !== CancellationRefund.FULL) return;
    await this.executeRefund(booking.id, booking.displayRef);
  }

  /**
   * Write the operator-payout ledger row (master SETTLEMENT-AND-PAYOUTS §2;
   * founder decision 2026-07-26). ONLY `paid_in_full` bookings get a row - the
   * one model where Island Tours collects the operator's money at checkout and
   * owes them the net afterwards. Deposit models are self-settling (the deposit
   * IS the commission - nothing to move) and operator_full takes no platform
   * money at all, so recording them only adds ambiguous noise to the ledger.
   * All amounts EUR: `amountCollected` = the full total IT took at checkout,
   * `commissionOwed` = IT's cut, `netPosition` = the payout owed the operator.
   *
   * Idempotent (unique `bookingId`; never overwrites an existing row) and best-effort:
   * a ledger write must NEVER fail a confirmation whose money is already captured -
   * a miss logs loudly for backfill (durability comes with the outbox in B6).
   */
  private async writeSettlement(
    booking: BookingWithItems,
    totalEur: Prisma.Decimal,
    commissionEur: Prisma.Decimal,
  ): Promise<void> {
    if (booking.paymentModel !== PaymentModel.PAID_IN_FULL) return;
    try {
      const collected = totalEur;
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
    { rethrow = false }: { rethrow?: boolean } = {},
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
      if (rethrow) throw err;
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

    const [related, featuredRecs] = await Promise.all([
      this.loadRelatedTours(tour.destinationId, booking.tourId),
      // The recommendations placed on the confirmation email (up to a few), drawn
      // from the same admin-managed library as the thank-you-page cards. An empty
      // list hides the whole block.
      this.recommendations.getFeatured(
        locale,
        RecommendationPlacement.CONFIRMATION_EMAIL,
      ),
    ]);

    const pickLocation = (type: string): string | null =>
      pickTourLocation(tour.locations, type, locale);

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
      // Up to a few cards; an empty list hides the email's recommendation block.
      recommendations: featuredRecs.map((r) => ({
        title: r.title ?? '',
        imageUrl: r.imageUrl ?? '',
        linkUrl: r.linkUrl ?? '',
        external: r.external,
        ctaLabel: r.ctaLabel,
        rating: r.rating,
        priceAmount: r.priceAmount,
        currency: r.currency,
      })),
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
    // A pending cancellation request leaves `status` CONFIRMED, but re-sending
    // "You're booked!" while the traveller is waiting on a cancellation reads
    // as the platform ignoring the request (user-reported bug 2026-07-30).
    if (
      booking.utcCancellationRequestedAt !== null &&
      booking.utcCancelledAt === null
    ) {
      throw new ConflictException(
        'A cancellation request is pending on this booking',
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
   * Traveller-initiated WITHDRAWAL of a pending cancellation request (QA
   * report 2026-08-01: once requested there was no way back for the guest).
   * Clears the request stamp so the booking simply stands again - and so a
   * later, genuine request re-stamps a fresh eligibility instant. Only works
   * while the request is still pending: once an admin executed the
   * cancellation, restoring is an admin action (`restore`), because money may
   * already have moved.
   *
   * Same ownership gate as the request itself, and the admin is told in the
   * same channels the request used - otherwise they might execute a
   * cancellation the traveller no longer wants.
   */
  async withdrawCancellationRequest(
    publicRef: string,
    sessionToken?: string | null,
  ): Promise<{ withdrawn: boolean }> {
    const booking = await this.prisma.booking.findUnique({
      where: { publicRef },
      select: CANCELLATION_REQUEST_SELECT,
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (
      !sessionOwnsBooking(verifyTravelerSession(sessionToken), {
        id: booking.id,
        contactEmail: booking.contactEmail,
      })
    ) {
      throw new UnauthorizedException(
        'Verify with your email and booking reference to withdraw a cancellation request',
      );
    }

    // Same per-booking cap as the request: bounds mailbox noise from loops.
    this.targetLimiter.consume('cancel-withdraw', booking.publicRef, [
      { max: 5, windowMs: 60 * 60 * 1000 },
    ]);

    if (booking.status === BookingStatus.CANCELLED) {
      throw new ConflictException(
        'This booking was already cancelled - contact us and we can restore it for you',
      );
    }
    // Nothing pending: the goal state ("no open request") is already true, so
    // a repeat submit is a quiet success rather than an error.
    if (!booking.utcCancellationRequestedAt) return { withdrawn: true };

    // Guarded consume (security review 2026-08-01): of two racing withdraws
    // (double-click) only one matches the still-set stamp; the loser is a
    // quiet success WITHOUT notices, so one logical action can never send the
    // admin/traveller/operator trio twice.
    const consumed = await this.prisma.booking.updateMany({
      where: {
        id: booking.id,
        utcCancellationRequestedAt: { not: null },
      },
      data: { utcCancellationRequestedAt: null },
    });
    if (consumed.count === 0) return { withdrawn: true };

    await this.sendCancellationWithdrawnNotices(booking);

    this.inbox.notify({
      event: InboxEvent.BOOKING_CANCELLATION_WITHDRAWN,
      operatorId: booking.operatorId,
      title: `Cancellation request withdrawn: ${booking.displayRef}`,
      body: 'The traveller kept their booking - nothing to process.',
      url: `/bookings?ref=${booking.displayRef}`,
      entityType: 'booking',
      entityId: booking.id,
    });

    this.logger.log(`Cancellation request withdrawn for ${booking.displayRef}`);
    return { withdrawn: true };
  }

  /**
   * Admin + traveller ack + operator notice for a withdrawn cancellation
   * request - the exact audience the request itself notified, so nobody is
   * left acting on a request that no longer exists. Best-effort: the stamp is
   * already cleared, and the dashboard worklist reads the stamp, so a dead
   * mailbox here cannot cause a wrong cancellation.
   */
  private async sendCancellationWithdrawnNotices(
    booking: CancellationRequestBooking,
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

    // The admin FIRST - they are the one who might still execute the request.
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const ctx: EmailTemplateContext = {
        ...shared,
        dateLong: formatDateLong(
          booking.tourStartDateTime ?? booking.localDate,
          Locale.en,
        ),
        noticeTitle: 'Cancellation request withdrawn.',
        noticeParagraphs: [
          `${guestName} withdrew their cancellation request for booking ${booking.displayRef} (${tourName}).`,
          'The booking stands - do not process the earlier request.',
        ],
        ctaUrl: `${dashBase}/bookings`,
        ctaLabel: 'View booking in the dashboard',
      };
      try {
        await this.mail.sendBookingNoticeEmail(
          adminEmail,
          `Cancellation request withdrawn - ${booking.displayRef}`,
          ctx,
          buildNoticeText(ctx),
        );
      } catch (err) {
        this.logger.error(
          `Withdrawal notice to admin failed for ${booking.displayRef}`,
          err as Error,
        );
      }
    }

    // Traveller ack, in their locale.
    if (booking.contactEmail) {
      const locale = toLocale(booking.customerLocale);
      const ctx: EmailTemplateContext = {
        ...shared,
        dateLong: formatDateLong(
          booking.tourStartDateTime ?? booking.localDate,
          locale,
        ),
        noticeTitle: 'Your booking stands.',
        noticeParagraphs: [
          'We cancelled your cancellation request - your booking is unchanged and your spot is still yours.',
          'Change your plans again? You can request a cancellation from your booking page at any time within your free-cancellation window.',
        ],
        ctaUrl: `${siteBase}/${booking.island}/thank-you/${booking.publicRef}`,
        ctaLabel: 'View your booking',
      };
      try {
        await this.mail.sendBookingNoticeEmail(
          booking.contactEmail,
          `Your booking stands - ${booking.displayRef}`,
          ctx,
          buildNoticeText(ctx),
        );
      } catch (err) {
        this.logger.error(
          `Withdrawal ack to traveller failed for ${booking.displayRef}`,
          err as Error,
        );
      }
    }

    // Operator heads-up (company inbox first, same as the request notice).
    const operatorEmail =
      operator?.companyInfo?.companyEmail ?? operator?.contactEmail ?? null;
    if (operatorEmail) {
      const ctx: EmailTemplateContext = {
        ...shared,
        dateLong: formatDateLong(
          booking.tourStartDateTime ?? booking.localDate,
          Locale.en,
        ),
        noticeTitle: 'Cancellation request withdrawn.',
        noticeParagraphs: [
          `${guestName} withdrew the cancellation request for booking ${booking.displayRef} (${tourName}).`,
          'The booking stands as confirmed - no action needed.',
        ],
        ctaUrl: `${dashBase}/bookings`,
        ctaLabel: 'View booking in your dashboard',
      };
      try {
        await this.mail.sendBookingNoticeEmail(
          operatorEmail,
          `Cancellation request withdrawn - ${booking.displayRef}: ${tourName}`,
          ctx,
          buildNoticeText(ctx),
        );
      } catch (err) {
        this.logger.error(
          `Withdrawal notice to operator failed for ${booking.displayRef}`,
          err as Error,
        );
      }
    }
  }

  /**
   * The ownership-gate-free core of a cancellation request: per-booking cap,
   * status check, first-request stamp, admin email, traveller/operator
   * notices. The caller MUST have proven ownership already - today that means
   * an owning traveler HMAC session (`requestCancellation`). Kept separate
   * from that gate so a second entry point cannot skip these steps.
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

    this.inbox.notify({
      event: InboxEvent.BOOKING_CANCELLATION_REQUESTED,
      operatorId: booking.operatorId,
      title: `Cancellation requested: ${booking.displayRef}`,
      body: reason?.trim() || 'No reason given.',
      url: `/bookings?ref=${booking.displayRef}`,
      entityType: 'booking',
      entityId: booking.id,
      // The traveller is not a dashboard user, so there is no actor to exclude.
    });

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
          'Sign in with an admin account to cancel a confirmed booking',
        );
      }
      if (actor.role !== Role.ADMIN) {
        // Conflict #2 (access-roles matrix): cancelling a confirmed booking
        // executes a refund - real money moves. Operators (and platform
        // staff below admin) REPORT the cancellation; only an admin executes
        // it. MANAGE_BOOKINGS is admin-only (ceiling-excluded), and this
        // route is @Public for the hold path, so the role is checked here in
        // the service rather than by the permissions guard. Foreign bookings
        // still 404 first (assertOwnsBooking) - no existence oracle.
        await this.assertOwnsBooking(booking, actor);
        throw new ForbiddenException(
          'Cancelling a confirmed booking moves real money. Use "Report cancellation" instead - Island Tours executes the cancellation and refund.',
        );
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
    // An operator-reported cancellation ALWAYS refunds in full - the operator
    // pulled the tour, so the traveler's window verdict is irrelevant.
    // Enforced server-side; never rely on the dashboard remembering to send
    // `force: true`.
    const refund = booking.utcOperatorCancellationReportedAt
      ? CancellationRefund.FULL
      : await this.computeRefund(booking, dto.force ?? false, requestedAt);
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
      // B6 durable refund retry: a FULL-refund cancellation commits its
      // `booking.refund-owed` event with the cancellation itself, so the
      // refund is retried with backoff even if the inline attempt below dies
      // with the process (executeRefund is idempotent - the job re-invokes it).
      if (!heldOnly && refund === CancellationRefund.FULL) {
        await tx.outboxEvent.create({
          data: {
            aggregate: 'booking',
            aggregateId: booking.id,
            type: 'booking.refund-owed',
            payload: { bookingId: booking.id },
          },
        });
      }
      return tx.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CANCELLED,
          utcCancelledAt: new Date(),
          utcCancellationRequestedAt: requestedAt,
          cancellationRefund: refund,
          // An admin executing an operator's cancellation report stamps
          // OPERATOR - the cancellation originated with the operator, so the
          // eligibility metric (cancellation_rate_90d counts OPERATOR rows)
          // must attribute it to them, not to the admin who pressed the
          // button.
          cancelledBy: booking.utcOperatorCancellationReportedAt
            ? CancelledBy.OPERATOR
            : actorToCancelledBy(actor?.role),
          cancellationReason:
            dto.reason ?? booking.operatorCancellationReason ?? null,
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
      // Same condition as the emails, for the same reason: releasing an
      // abandoned checkout hold is inventory housekeeping, not news.
      this.inbox.notify({
        event: InboxEvent.BOOKING_CANCELLED,
        operatorId: updated.operatorId,
        title: `Booking ${updated.displayRef} was cancelled`,
        body: `Seats are back in inventory.${refund === CancellationRefund.FULL ? ' The traveller is being refunded in full.' : ''}`,
        url: `/bookings?ref=${updated.displayRef}`,
        entityType: 'booking',
        entityId: updated.id,
        actorUserId: actor?.id ?? null,
      });
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
  // Restore - reverse a mistaken cancellation (QA report 2026-08-01)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Admin-only reversal of an executed cancellation: re-takes the seats,
   * flips the booking (and its unit items) back to CONFIRMED, clears every
   * cancellation stamp, reinstates the settlement obligation and re-sends the
   * confirmation email. Exists because a cancellation can be executed by
   * mistake (traveller-reported) and "rebook and repay" is not an answer when
   * the traveller's money never moved.
   *
   * Hard refusals - each names the state that makes a restore wrong:
   * - money already went back (a REFUND payment settled or in flight): the
   *   paid amounts on the booking would be a lie. Rebook instead.
   * - the departure already ran, or was itself cancelled: there is nothing to
   *   restore the seats INTO.
   * - the seats were resold meanwhile: restoring would overbook the boat.
   * - a forfeited booking: forfeit is its own terminal path (kept commission,
   *   different money story) - never quietly reversible.
   */
  async restore(id: string, actor: { id: string; role: Role }) {
    const booking = await this.loadOr404(id);

    // Same conflict-#2 boundary as executing the cancellation: only an admin
    // reverses one. (The route also carries MANAGE_BOOKINGS; this guard keeps
    // a second entry point from ever skipping it.)
    if (actor.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Only an Island Tours admin can restore a cancelled booking',
      );
    }

    // Idempotent: restoring a booking that is already back (or never left)
    // returns its current state - a double-click must not error.
    if (booking.status === BookingStatus.CONFIRMED) {
      return mapBookingForActor(booking, actor);
    }
    if (booking.status !== BookingStatus.CANCELLED) {
      throw new ConflictException(`Cannot restore a ${booking.status} booking`);
    }
    if (booking.utcConfirmedAt === null) {
      throw new ConflictException(
        'This booking never confirmed - it was a checkout hold, there is nothing to restore',
      );
    }
    if (booking.utcForfeitedAt !== null) {
      throw new ConflictException(
        'A forfeited booking cannot be restored - the deposit was kept under the non-payment policy',
      );
    }
    if (hasDeparted(booking)) {
      throw new ConflictException(
        'This departure has already run - there is nothing to restore the booking into',
      );
    }
    // A settled or in-flight refund means the traveller's money is on its way
    // back - restoring would advertise a paid booking that is not paid.
    const refunded = await this.prisma.payment.findFirst({
      where: {
        bookingId: booking.id,
        kind: PaymentKind.REFUND,
        status: {
          in: [
            PaymentStatus.REFUNDED,
            PaymentStatus.SUCCEEDED,
            PaymentStatus.PROCESSING,
          ],
        },
      },
      select: { id: true },
    });
    if (refunded) {
      throw new ConflictException(
        'The traveller was already refunded - a restored booking would claim money we returned. Ask them to rebook instead.',
      );
    }

    const seats = booking.unitItems.length;
    const updated = await this.prisma.$transaction(async (tx) => {
      // The concurrency gate, FIRST (security review 2026-08-01): the WHERE
      // re-evaluates status under the row lock, so of two racing restores
      // (dashboard double-click) exactly one flips CANCELLED -> CONFIRMED;
      // the loser matches 0 rows and aborts BEFORE touching seats - without
      // this both would pass the pre-transaction status check and the
      // departure would absorb the same booking's seats twice.
      const flipped = await tx.booking.updateMany({
        where: { id: booking.id, status: BookingStatus.CANCELLED },
        data: {
          status: BookingStatus.CONFIRMED,
          utcCancelledAt: null,
          utcCancellationRequestedAt: null,
          cancellationRefund: null,
          cancellationReason: null,
          cancelledBy: null,
          utcOperatorCancellationReportedAt: null,
          operatorCancellationReason: null,
        },
      });
      if (flipped.count === 0) {
        throw new ConflictException('This booking was already restored');
      }
      if (booking.departureId) {
        // Pre-check kept for its DISTINCT error: a cancelled/deleted departure
        // is a dead end ("cannot be restored into it"), not a seat shortage.
        const dep = await tx.departure.findUnique({
          where: { id: booking.departureId },
          select: { status: true },
        });
        if (!dep || dep.status === DepartureStatus.CANCELLED) {
          throw new ConflictException(
            'This departure was cancelled - the booking cannot be restored into it',
          );
        }
        // Guarded seat re-claim, mirroring the reserve-time claim: the guard
        // re-evaluates fill (and capacity) under concurrency, so a restore can
        // never overbook seats that were resold after the cancellation.
        // `intoSticky`: unlike reserve it accepts a SOLD_OUT/CLOSED departure
        // (sticky states stop NEW sales, not the return of a seat that was
        // wrongly released) - only a CANCELLED departure is a dead end.
        const claimed = await this.claimSeats(tx, {
          departureId: booking.departureId,
          tourId: booking.tourId,
          seats,
          exclusive: booking.exclusiveDeparture,
          intoSticky: true,
        });
        if (!claimed) {
          throw new ConflictException(
            booking.exclusiveDeparture
              ? 'The departure was rebooked after the cancellation - the private charter cannot be restored'
              : 'Not enough seats left on this departure to restore the booking',
          );
        }
      }
      await tx.bookingUnitItem.updateMany({
        where: { bookingId: booking.id },
        data: { status: BookingStatus.CONFIRMED },
      });
      // The guarded flip above already wrote every field - this is just the
      // fresh row for the return value and the notices.
      return tx.booking.findUniqueOrThrow({
        where: { id: booking.id },
        include: { unitItems: true },
      });
    });

    this.logger.log(`Booking ${updated.displayRef} restored by admin`);

    // Reinstate the settlement obligation the cancellation reversed - the
    // booking delivers again, so the operator payout is owed again.
    await this.reinstateSettlement(updated.id);

    // The traveller was told "cancellation confirmed" - the confirmation
    // email going out again is the counter-notice that their spot is back.
    // Best-effort like the confirm-time send: the restore itself committed.
    await this.sendConfirmationEmail(updated);

    this.inbox.notify({
      event: InboxEvent.BOOKING_RESTORED,
      operatorId: updated.operatorId,
      title: `Booking ${updated.displayRef} was restored`,
      body: 'The cancellation was reversed - the seats are booked again and the traveller has been re-sent their confirmation.',
      url: `/bookings?ref=${updated.displayRef}`,
      entityType: 'booking',
      entityId: updated.id,
      actorUserId: actor.id,
    });

    // Seats re-taken + status changed: same availability/materialization fan-out
    // as the cancellation that released them.
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
   * Undo `reverseSettlement` for a restored booking: a REVERSED row returns to
   * RECORDED with its net obligation recomputed from the untouched historical
   * amounts. A PAID_OUT row is left alone (that money moved; clawback logic
   * does not belong here). Best-effort, like its counterpart.
   */
  private async reinstateSettlement(bookingId: string): Promise<void> {
    try {
      const row = await this.prisma.settlement.findUnique({
        where: { bookingId },
        select: {
          status: true,
          amountCollected: true,
          commissionOwed: true,
        },
      });
      if (!row || row.status !== SettlementStatus.REVERSED) return;
      await this.prisma.settlement.update({
        where: { bookingId },
        data: {
          status: SettlementStatus.RECORDED,
          netPosition: row.amountCollected
            .minus(row.commissionOwed)
            .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
        },
      });
    } catch (err) {
      this.logger.error(
        `Settlement reinstatement failed for booking ${bookingId} - backfill needed`,
        err as Error,
      );
    }
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
  /**
   * Ownership gate shared by every operator-facing booking action: platform
   * roles pass, an operator must own the booking. Throws 404 (never 403) for
   * a foreign booking - existence is never confirmed to non-owners.
   */
  private async assertOwnsBooking(
    booking: { operatorId: string },
    actor: { id: string; role: Role },
  ): Promise<void> {
    if (
      !isPlatformWideBookingRole(actor.role) &&
      booking.operatorId !==
        (await resolveOperatorId(this.prisma, actor.id, actor.role))
    ) {
      throw new NotFoundException('Booking not found');
    }
  }

  async reportNonPayment(id: string, actor: { id: string; role: Role }) {
    const booking = await this.loadOr404(id);
    await this.assertOwnsBooking(booking, actor);

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
    this.inbox.notify({
      event: InboxEvent.BOOKING_OPERATOR_REPORTED_NON_PAYMENT,
      operatorId: updated.operatorId,
      title: `Non-payment reported: ${updated.displayRef}`,
      body: 'The operator says the balance was never paid. Confirm before any forfeit - the money move is ours.',
      url: `/bookings?ref=${updated.displayRef}`,
      entityType: 'booking',
      entityId: updated.id,
      actorUserId: actor.id,
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
  // Operator cancellation report (access-roles matrix conflict #2)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Operator reports they must cancel a confirmed booking (boat broke, tour
   * can't run). This is only a REPORT - the operator never executes the
   * refund. It stamps `utcOperatorCancellationReportedAt` (idempotent),
   * emails the admin worklist, and holds the settlement payout until the
   * admin either cancels the booking (full refund, `cancelledBy: OPERATOR`)
   * or dismisses the report. Admins may report on the operator's behalf.
   */
  async reportCancellation(
    id: string,
    dto: ReportCancellationDto,
    actor: { id: string; role: Role },
  ) {
    const booking = await this.loadOr404(id);
    await this.assertOwnsBooking(booking, actor);

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException(
        `Cannot report a cancellation on a ${booking.status} booking`,
      );
    }
    if (booking.utcOperatorCancellationReportedAt) {
      return mapBookingForActor(booking, actor); // already reported - idempotent
    }

    // Per-OPERATOR cap (same limiter the traveler request flow uses): each
    // FIRST report emails the admin, so bound how fast one operator can
    // flood the worklist across their bookings.
    this.targetLimiter.consume('op-cancel-report', booking.operatorId, [
      { max: 10, windowMs: 60 * 60 * 1000 },
    ]);

    // The report MUST reach a human - it exists to put the refund on the
    // admin worklist. Same posture as the traveler request flow.
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      this.logger.error(
        'ADMIN_EMAIL is not configured - operator cancellation reports cannot reach anyone',
      );
      throw new ServiceUnavailableException(
        'Cancellation reports are temporarily unavailable - contact Island Tours directly',
      );
    }

    const reason = dto.reason?.trim() || null;
    // Race-safe stamp: two concurrent first-reports must produce ONE email.
    // The conditional updateMany makes the loser a no-op (count 0).
    const { count } = await this.prisma.booking.updateMany({
      where: { id: booking.id, utcOperatorCancellationReportedAt: null },
      data: {
        utcOperatorCancellationReportedAt: new Date(),
        operatorCancellationReason: reason,
      },
    });
    const updated = await this.loadOr404(booking.id);
    if (count === 0) {
      return mapBookingForActor(updated, actor); // lost the race - already reported
    }

    const [operator, tour] = await Promise.all([
      this.prisma.operator.findUnique({
        where: { id: booking.operatorId },
        select: { companyInfo: { select: { companyName: true } } },
      }),
      this.prisma.tour.findUnique({
        where: { id: booking.tourId },
        select: { name: true },
      }),
    ]);
    await this.mail.sendCancellationRequestEmail(adminEmail, {
      displayRef: booking.displayRef,
      tourName: tour?.name ?? 'Unknown tour',
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
      reason,
      dashboardUrl: `${dashboardAppBase()}/bookings`,
      source: 'operator',
      reporterName: operator?.companyInfo?.companyName ?? 'The operator',
    });

    this.inbox.notify({
      event: InboxEvent.BOOKING_OPERATOR_REPORTED_CANCELLATION,
      operatorId: updated.operatorId,
      title: `Operator cancelled ${updated.displayRef}`,
      body: `${operator?.companyInfo?.companyName ?? 'The operator'} reports they must cancel. A full refund is ours to execute.`,
      url: `/bookings?ref=${updated.displayRef}`,
      entityType: 'booking',
      entityId: updated.id,
      actorUserId: actor.id,
    });

    this.logger.warn(
      `Operator cancellation reported for booking ${updated.displayRef} (awaiting admin execution)`,
    );
    return mapBookingForActor(updated, actor);
  }

  /**
   * Admin dismisses an operator cancellation report (mistake, or the tour
   * runs after all): clears the stamp so the booking reads CONFIRMED again
   * and the settlement payout hold lifts.
   */
  async dismissCancellationReport(
    id: string,
    actor: { id: string; role: Role },
  ) {
    const booking = await this.loadOr404(id);
    if (!booking.utcOperatorCancellationReportedAt) {
      return mapBookingForActor(booking, actor); // nothing to dismiss
    }
    if (booking.status === BookingStatus.CANCELLED) {
      throw new ConflictException(
        'This booking is already cancelled - the report is settled, not dismissible',
      );
    }
    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        utcOperatorCancellationReportedAt: null,
        operatorCancellationReason: null,
      },
      include: { unitItems: true },
    });
    this.logger.log(
      `Operator cancellation report dismissed for booking ${updated.displayRef}`,
    );
    return mapBookingForActor(updated, actor);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Extend / Update
  // ════════════════════════════════════════════════════════════════════════

  async extend(id: string, dto: ExtendBookingDto) {
    // Per-BOOKING cap on top of the per-IP throttle. The global tier (3000/hr)
    // is nowhere near tight enough to stop one call every 25 minutes forever,
    // and a multi-IP caller sidesteps per-IP limits entirely.
    this.targetLimiter.consume(
      'extend',
      id,
      [{ max: 6, windowMs: 60 * 60 * 1000 }],
      'This booking has been extended too many times. Please complete it or start a new one.',
    );
    const booking = await this.loadOr404(id);
    if (booking.status !== BookingStatus.ON_HOLD) {
      throw new ConflictException('Only an on-hold booking can be extended');
    }

    // The hold may never outlive MAX_HOLD_LIFETIME_MINUTES from creation, no
    // matter how many times it is extended - otherwise the seats (or the whole
    // departure, for a PRIVATE charter) are locked indefinitely for free.
    const ceilingMs =
      booking.createdAt.getTime() + MAX_HOLD_LIFETIME_MINUTES * 60_000;
    if (Date.now() >= ceilingMs) {
      throw new ConflictException(
        'This booking has been held too long and can no longer be extended',
      );
    }
    const requestedMs =
      Date.now() + (dto.expirationMinutes ?? DEFAULT_HOLD_MINUTES) * 60_000;

    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        // Clamped: an extension can shorten the gap to the ceiling but never
        // push past it.
        utcExpiresAt: new Date(Math.min(requestedMs, ceilingMs)),
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
    // Pickup and notes demand the SAME proof as contact. The block below
    // deliberately re-snapshots the pickup address and window onto the booking
    // (guide §17), so an unproven edit tells a paying traveler the wrong place
    // and the wrong time - and `id` rides in the PATCH URL path, which reaches
    // server logs, APM traces and Referer headers far more readily than a
    // header-only credential. ON_HOLD stays open either way: pre-payment the
    // raw id is a short-lived secret held only by the reserving client, and
    // checkout sets both contact and pickup then.
    const touchesItinerary =
      dto.pickupLocationId !== undefined ||
      dto.pickupRequested !== undefined ||
      dto.notes !== undefined;
    if (
      (dto.contact || touchesItinerary) &&
      booking.status === BookingStatus.CONFIRMED &&
      !sessionOwnsBooking(verifyTravelerSession(sessionToken), {
        id: booking.id,
        contactEmail: booking.contactEmail,
      })
    ) {
      throw new UnauthorizedException(
        dto.contact
          ? 'Verify with your email and booking reference to change contact details'
          : 'Verify with your email and booking reference to change pickup details',
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

  /**
   * Conflict #7: does this actor see money + traveler contact on booking
   * rows, or the manifest projection? Read from the EFFECTIVE permission set
   * (a designation can withhold VIEW_BOOKING_FINANCIALS from a field-staff
   * seat while still granting VIEW_BOOKINGS), never the static role table.
   */
  private async canSeeBookingFinancials(actor: {
    id: string;
    role: Role;
  }): Promise<boolean> {
    const effective = await this.staffPermissions.getEffectivePermissions({
      id: actor.id,
      role: actor.role,
    });
    return effective.includes(Permission.VIEW_BOOKING_FINANCIALS);
  }

  /**
   * A traveler ALWAYS sees the money on their own purchase - the manifest
   * rule is about seats looking at other people's bookings, never about
   * someone reading their own receipt.
   *
   * Deliberately keyed on row ownership rather than on granting
   * VIEW_BOOKING_FINANCIALS to Role.USER: the effective-permission engine
   * unions the customer hat into a staff/operator seat that has ever booked
   * a tour, so the role grant would hand every such seat the financials it
   * was just denied.
   */
  private async seesFinancialsFor(
    booking: { userId: string | null },
    actor: { id: string; role: Role },
  ): Promise<boolean> {
    if (booking.userId && booking.userId === actor.id) return true;
    return this.canSeeBookingFinancials(actor);
  }

  async getById(id: string, actor: { id: string; role: Role }) {
    const booking = await this.loadOr404(id);
    await this.assertCanView(booking, actor);
    const payload = stripCommissionForNonPlatform(
      mapBooking(booking),
      actor.role,
    );
    return (await this.seesFinancialsFor(booking, actor))
      ? payload
      : applyManifestProjection(payload);
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
      // `sent: false` mirrors the traveller OTP door (founder 2026-07-31):
      // the honest "no account under this email" UX over the always-positive
      // anti-enumeration lock. Throttles above bound probing.
      this.logger.log(
        'Reference recovery requested for an email with no bookings',
      );
      return { sent: false };
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
   * One payment as a RECEIPT payload (review 9a - account area "invoices").
   *
   * Deliberately a receipt, not a tax invoice: no VAT breakdown exists on the
   * platform's data model, so calling it an invoice would overclaim. Scoped by
   * the HISTORY session like every account read; carries the payer NAME (the
   * one traveller payload that does - a receipt without a name is useless as
   * proof of payment, and the caller IS that person).
   */
  async getTravellerReceipt(paymentId: string, sessionToken?: string) {
    const email = this.requireTravellerEmail(sessionToken);
    const p = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        booking: { contactEmail: { equals: email, mode: 'insensitive' } },
      },
      select: {
        id: true,
        kind: true,
        status: true,
        amount: true,
        currency: true,
        createdAt: true,
        methodType: true,
        booking: {
          select: {
            displayRef: true,
            publicRef: true,
            localDate: true,
            startTime: true,
            contactFullName: true,
            contactFirstName: true,
            contactLastName: true,
            paymentMethodBrand: true,
            paymentMethodLast4: true,
            paymentModel: true,
            totalRetail: true,
            depositAmount: true,
            balanceAmount: true,
            pickupAddress: true,
            pickupTotalPrice: true,
            // Line items: the immutable per-guest and add-on snapshots, so
            // the receipt documents what was actually sold (invoice look).
            unitItems: { select: { ageBandId: true, priceRetail: true } },
            addOns: {
              select: {
                name: true,
                quantity: true,
                unitPrice: true,
                totalPrice: true,
              },
            },
            tour: {
              select: {
                name: true,
                destination: { select: { name: true, slug: true } },
                ageBands: {
                  select: { id: true, label: true, participation: true },
                },
              },
            },
            operator: {
              select: { companyInfo: { select: { companyName: true } } },
            },
          },
        },
      },
    });
    if (!p) throw new NotFoundException('Payment not found');

    const payerName =
      p.booking.contactFullName ??
      ([p.booking.contactFirstName, p.booking.contactLastName]
        .filter(Boolean)
        .join(' ') ||
        null);

    // Group the per-guest snapshots into priced party lines ("2 x Adult at
    // $99"), the same banding rule the TYP uses; UNIT-priced tours carry no
    // age bands and collapse into one "Guest" line. Spectator bands (Figma
    // "Bringing Spectators?") share a LABEL with their participant twin -
    // "Adult (18+)" exists twice - so the participation flag rides along and
    // the client marks those lines, or the breakdown reads as a duplicate.
    const bands = new Map(
      (p.booking.tour?.ageBands ?? []).map((b) => [
        b.id,
        { label: b.label, spectator: b.participation === 'SPECTATOR' },
      ]),
    );
    const partyLines = new Map<
      string,
      {
        label: string;
        spectator: boolean;
        quantity: number;
        unitPrice: string;
        lineTotal: number;
      }
    >();
    for (const item of p.booking.unitItems) {
      const bandId = item.ageBandId ?? '';
      // Grouped by band AND unit price: mixed prices inside one band (or two
      // bands sharing a label) must stay separate lines, or qty x unit price
      // stops equalling the line amount - the one arithmetic a reader checks.
      const key = `${bandId}|${item.priceRetail.toString()}`;
      const existing = partyLines.get(key);
      if (existing) {
        existing.quantity += 1;
        existing.lineTotal += Number(item.priceRetail);
      } else {
        const band = bandId ? bands.get(bandId) : undefined;
        partyLines.set(key, {
          label: bandId ? (band?.label ?? 'Traveler') : 'Guest',
          spectator: band?.spectator ?? false,
          quantity: 1,
          unitPrice: item.priceRetail.toString(),
          lineTotal: Number(item.priceRetail),
        });
      }
    }

    return {
      id: p.id,
      kind: p.kind,
      status: p.status,
      amount: p.amount.toString(),
      currency: p.currency,
      createdAt: p.createdAt.toISOString(),
      methodType: p.methodType,
      methodBrand: p.booking.paymentMethodBrand,
      methodLast4: p.booking.paymentMethodLast4,
      payerName,
      bookingDisplayRef: p.booking.displayRef,
      bookingPublicRef: p.booking.publicRef,
      bookingLocalDate: dateKey(p.booking.localDate),
      startTime: p.booking.startTime,
      tourName: p.booking.tour?.name ?? null,
      destinationName: p.booking.tour?.destination?.name ?? null,
      destinationSlug: p.booking.tour?.destination?.slug ?? null,
      operatorName: p.booking.operator?.companyInfo?.companyName ?? null,
      // Invoice body: what was sold and what the booking's money looks like.
      paymentModel: p.booking.paymentModel,
      totalRetail: p.booking.totalRetail.toString(),
      depositAmount: p.booking.depositAmount.toString(),
      balanceAmount: p.booking.balanceAmount.toString(),
      party: [...partyLines.values()].map((l) => ({
        label: l.label,
        spectator: l.spectator,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal.toFixed(2),
      })),
      addOns: p.booking.addOns.map((a) => ({
        name: a.name,
        quantity: a.quantity,
        unitPrice: a.unitPrice.toString(),
        totalPrice: a.totalPrice.toString(),
      })),
      pickup:
        p.booking.pickupTotalPrice && !p.booking.pickupTotalPrice.isZero()
          ? {
              address: p.booking.pickupAddress,
              totalPrice: p.booking.pickupTotalPrice.toString(),
            }
          : null,
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Traveller account area (/{locale}/traveller) - OTP login + history reads
  // ════════════════════════════════════════════════════════════════════════
  //
  // WHY A SEPARATE LOGIN FROM `/bookings`. The pair lookup proves possession of
  // ONE confirmation email - which routinely gets forwarded to travel
  // companions - so it is the right credential for one booking and the wrong
  // one for a person's entire booking + payment history. The account area
  // therefore requires live inbox OWNERSHIP: a one-time code, redeemed for a
  // HISTORY-scoped session (traveler-session.util.ts). A pair-login or
  // checkout token is rejected by every read below.

  /** One-time login codes live 10 minutes; a stale row is useless after that. */
  private static readonly LOGIN_CODE_TTL_MS = 10 * 60 * 1000;
  /** Guesses allowed against a single code before it is burned. */
  private static readonly LOGIN_CODE_MAX_ATTEMPTS = 5;
  /**
   * Guess budget per EMAIL, independent of both the per-code cap and the
   * per-IP throttle (pentest 2026-08-01: the per-IP tiers reset in seconds, so
   * a caller who simply paces requests - or spreads them over a handful of IPs
   * - never hits a wall). Sized well above legitimate use: the request side
   * only mints 5 codes per inbox per day and each allows 5 tries, so a real
   * traveller can never reach these numbers by mistyping.
   */
  private static readonly LOGIN_VERIFY_WINDOWS: TargetWindow[] = [
    { max: 12, windowMs: 15 * 60 * 1000 },
    { max: 30, windowMs: 24 * 60 * 60 * 1000 },
  ];

  /**
   * Email a one-time login code for the traveller account area.
   *
   * Enumeration-proof exactly like {@link recoverReference}: always resolves
   * `{ sent: true }`, mails only when the address actually has bookings, and
   * sends fire-and-forget so response timing does not leak whether mail went
   * out. The code itself is never stored - only a keyed HMAC (rule: a DB dump
   * alone must not be enough to log in as a traveller).
   */
  async requestTravellerLoginCode(
    dto: RequestTravellerCodeDto,
  ): Promise<RequestTravellerCodeResponseDto> {
    const email = dto.email.trim().toLowerCase();

    // Opportunistic cleanup instead of a cron: rows are worthless once they
    // have been expired for a day, and this is the only writer.
    void this.prisma.travelerLoginCode
      .deleteMany({
        where: {
          expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      })
      .catch((err: Error) => {
        this.logger.error('Traveller login code cleanup failed', err);
      });

    // Existence + the address to send to, nothing more. The sign-in code email
    // says nothing about any particular booking, so the tour name, dates and
    // reference this used to load were all read straight into the bin.
    //
    // Checked BEFORE the per-email limiter on purpose: an unknown email must
    // answer `sent: false` CONSISTENTLY. When the limiter ran first, the
    // second click inside its 60s window 429ed before this lookup, and the
    // login card reads 429 as "a code was already sent - go enter it", so an
    // address with no bookings advanced to a code screen that could never
    // succeed. Unknown-email probing stays bounded by the per-IP throttle,
    // and nothing is ever sent for it, so the mail-bomb caps below have
    // nothing to protect on this path.
    const booking = await this.prisma.booking.findFirst({
      where: { contactEmail: { equals: email, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
      select: { contactEmail: true },
    });
    if (!booking) {
      // `sent: false` is DELIBERATE enumeration: the founder chose the honest
      // "we can't find bookings under this email" UX over the always-positive
      // lock (login spec 5.9) on 2026-07-30. The per-IP throttle bounds
      // probing. Revert = return { sent: true }.
      this.logger.log('Traveller login code requested for an unknown email');
      return { sent: false };
    }

    // Per-TARGET caps (the per-IP throttle alone cannot stop a distributed
    // mail-bomb of one inbox), mirroring the recover-reference limits. Only
    // real inboxes ever consume a slot - see the ordering note above.
    //
    // The re-thrown 429 carries `reason: 'otp-pending'` so the login card can
    // tell "a code for this inbox is already live - go enter it" apart from
    // the GENERIC per-IP 429 the ThrottlerGuard throws before this handler
    // ever runs. The guard's 429 proves nothing about the email (it fires for
    // unknown addresses too), so the client must never advance on it - and
    // because this marker is only reachable AFTER the existence check above,
    // advancing on it is always correct.
    try {
      this.targetLimiter.consume(
        'traveller-otp',
        email,
        [
          { max: 1, windowMs: 60 * 1000 },
          { max: 5, windowMs: 24 * 60 * 60 * 1000 },
        ],
        'A sign-in code was requested for this email very recently. Check your inbox, or wait a minute and try again.',
      );
    } catch (err) {
      if (
        err instanceof HttpException &&
        err.getStatus() === HttpStatus.TOO_MANY_REQUESTS
      ) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: err.message,
            reason: 'otp-pending',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw err;
    }

    // Only the newest code may ever be live: requesting a second one
    // invalidates the first, so a code seen over someone's shoulder dies the
    // moment the traveller asks for another.
    await this.prisma.travelerLoginCode.updateMany({
      where: { email, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.prisma.travelerLoginCode.create({
      data: {
        email,
        codeHash: hashLoginCode(email, code),
        expiresAt: new Date(Date.now() + BookingsService.LOGIN_CODE_TTL_MS),
      },
    });

    // DEV ONLY: demo traveller inboxes (@demo.islandtours.test) are not real
    // mailboxes, so the code is surfaced in the server log for local testing.
    // Hard-gated on NODE_ENV - an OTP in a shipped production log line is a
    // leaked credential (logs outlive the 10-minute code and get aggregated).
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`[DEV ONLY] Traveller login code for ${email}: ${code}`);
    }

    // A credential email, so it goes out on the AUTH shell rather than the
    // booking-notice one: this message is about signing in, and the notice
    // shell wrapped the code in a tour name and departure date that have
    // nothing to do with it. The dedicated template leads with the code.
    void this.mail
      .sendTravellerLoginCodeEmail(
        booking.contactEmail ?? email,
        code,
        `${BookingsService.LOGIN_CODE_TTL_MS / 60_000} minutes`,
      )
      .catch((err: Error) => {
        this.logger.error('Traveller login code email failed', err);
      });

    return { sent: true };
  }

  /**
   * Redeem a one-time code for a HISTORY-scoped traveler session.
   *
   * Every failure - unknown email, no live code, wrong code, expired,
   * already used, out of attempts - throws the SAME generic 401, so the
   * endpoint never tells an attacker which part they got right.
   */
  async verifyTravellerLoginCode(
    dto: VerifyTravellerCodeDto,
  ): Promise<VerifyTravellerCodeResponseDto> {
    const email = dto.email.trim().toLowerCase();
    const invalid = () => new UnauthorizedException('Invalid or expired code');

    // Per-EMAIL guess budget, spent BEFORE anything is read. Two holes it
    // closes (pentest 2026-08-01):
    //
    // 1. The per-IP throttle is not a lockout. Its windows reset in seconds,
    //    so guessing slowly - or from a second IP - never gets blocked. This
    //    cap follows the TARGET, so it holds however the traffic is spread.
    // 2. When no code is live the method used to return a free 401 forever:
    //    no row meant no attempt counter, so the endpoint answered an
    //    unlimited number of guesses at zero cost. Charging here first makes
    //    every call cost something, including that path.
    //
    // Deliberately counts attempts, not failures: a success ends the flow, so
    // the two are the same for anyone who is not guessing.
    try {
      this.targetLimiter.consume(
        'traveller-otp-verify',
        email,
        BookingsService.LOGIN_VERIFY_WINDOWS,
        'Too many sign-in attempts for this email. Please wait a few minutes and try again.',
      );
    } catch (err) {
      if (
        err instanceof HttpException &&
        err.getStatus() === HttpStatus.TOO_MANY_REQUESTS
      ) {
        // The client treats EVERY 429 here as "stop guessing" (the per-IP
        // guard's 429 means the same thing on this step), so the marker is
        // for the API and the logs: it separates a target that is locked out
        // from a client that is simply going too fast.
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: err.message,
            reason: 'too-many-attempts',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw err;
    }

    const row = await this.prisma.travelerLoginCode.findFirst({
      where: { email, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) throw invalid();

    // Take a guess ATOMICALLY. The cap has to be evaluated by the write, not
    // against the snapshot above: parallel submissions all read the same
    // `attempts` value, so a stale `row.attempts >= MAX` check let a burst of
    // N concurrent requests each spend a try on a code that was only ever
    // allowed 5 - the whole per-code cap collapsed under concurrency. Postgres
    // serializes the row lock, so exactly MAX of any burst can match.
    const { count: consumedAttempt } =
      await this.prisma.travelerLoginCode.updateMany({
        where: {
          id: row.id,
          consumedAt: null,
          attempts: { lt: BookingsService.LOGIN_CODE_MAX_ATTEMPTS },
        },
        data: { attempts: { increment: 1 } },
      });
    if (consumedAttempt !== 1) {
      // Out of tries (or redeemed by a racing request) - burn what is left.
      await this.prisma.travelerLoginCode.updateMany({
        where: { id: row.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      throw invalid();
    }

    if (!loginCodeMatches(email, dto.code, row.codeHash)) throw invalid();

    // Redeem atomically: the read above is a snapshot, so two concurrent
    // submissions of the same correct code would otherwise both pass the
    // `consumedAt: null` check and mint two sessions. Only the caller whose
    // guarded write matches gets the token.
    const { count } = await this.prisma.travelerLoginCode.updateMany({
      where: { id: row.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (count !== 1) throw invalid();

    this.logger.log('Traveller account session issued via login code');
    return { sessionToken: issueTravelerHistorySession(email) };
  }

  /**
   * The gate every traveller account read shares: the session email, but ONLY
   * for a HISTORY-scoped token. Pair-login and checkout tokens land here with
   * a valid signature and still get 401 - they proved something weaker.
   */
  private requireTravellerEmail(sessionToken?: string): string {
    const email = sessionHistoryEmail(verifyTravelerSession(sessionToken));
    if (!email) {
      throw new UnauthorizedException(
        'Sign in with an email code to view your bookings',
      );
    }
    return email;
  }

  /**
   * Traveller account bookings list. Scoped by contactEmail (not userId): the
   * account area is keyed on the inbox that received the confirmations, so it
   * works for guest bookings made before any account existed.
   */
  async listTravellerBookings(
    query: TravellerListQueryDto,
    sessionToken?: string,
  ) {
    const email = this.requireTravellerEmail(sessionToken);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    // Meeting-point text is CONTENT, not UI copy, so it localizes like the
    // confirmation email does: preferred locale first, English fallback.
    const locale = query.locale ?? Locale.en;
    const where: Prisma.BookingWhereInput = {
      contactEmail: { equals: email, mode: 'insensitive' },
    };

    const [total, rows] = await Promise.all([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        include: {
          ...BOOKING_LIST_INCLUDE,
          // The account card renders the confirmation email's logistics block
          // (meeting point / pickup, be-ready buffer, duration), so it selects
          // the same tour facts the email context does - one source of truth
          // for "where do I show up".
          tour: {
            select: {
              name: true,
              slug: true,
              cancellationHours: true,
              durationMinutesFrom: true,
              checkInMinutesBefore: true,
              meetingPointLat: true,
              meetingPointLng: true,
              destination: { select: { slug: true, name: true } },
              images: {
                where: { isHero: true },
                select: { url: true },
                take: 1,
              },
              translations: {
                where: { locale: { in: [locale, Locale.en] } },
                select: { locale: true, meetingPointText: true },
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
          },
          // The per-booking support row (review 5.8): operator first, WhatsApp
          // fallback. Same fallback chain as the TYP and the email - OCTO
          // supplier contact wins, company profile fills in.
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
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      total,
      page,
      limit,
      data: rows.map((row) => ({
        ...mapTravellerBookingItem(row, locale),
        review: this.reviewStateForRow(row),
      })),
    };
  }

  /**
   * Checkout prefill for a signed-in traveller (test report 2026-08-01 §1): the
   * contact block off their most recent booking, so a returning traveller does
   * not retype their own name and phone on every trip.
   *
   * `email` is the SESSION email, never the stored contactEmail - the two are
   * the same by definition here (the list is scoped by contact email), and
   * returning the proven one keeps checkout's locked email field honest even if
   * an older booking carries a different casing.
   *
   * Same HISTORY-scoped gate as the rest of the account area: a pair-login or
   * checkout token proves inbox knowledge, not ownership, and must not be able
   * to read a stranger's name and phone number back out.
   */
  async getTravellerContact(sessionToken?: string) {
    const email = this.requireTravellerEmail(sessionToken);
    const last = await this.prisma.booking.findFirst({
      where: { contactEmail: { equals: email, mode: 'insensitive' } },
      // Latest wins: a traveller who moved country or changed number expects
      // the details they used most recently, not their first ever booking.
      orderBy: { createdAt: 'desc' },
      select: {
        contactFirstName: true,
        contactLastName: true,
        contactPhone: true,
        contactCountry: true,
      },
    });
    return {
      hasHistory: last !== null,
      email,
      firstName: last?.contactFirstName ?? null,
      lastName: last?.contactLastName ?? null,
      phone: last?.contactPhone ?? null,
      country: last?.contactCountry ?? null,
    };
  }

  /**
   * Traveller account stat row - same shape and live-ledger math as the
   * customer dashboard summary, scoped by contactEmail instead of userId.
   */
  async getTravellerSummary(sessionToken?: string) {
    const email = this.requireTravellerEmail(sessionToken);
    return this.summarizeBookings(
      { contactEmail: { equals: email, mode: 'insensitive' } },
      { booking: { contactEmail: { equals: email, mode: 'insensitive' } } },
    );
  }

  /**
   * Traveller payment history: every charge and refund on the caller's own
   * bookings. Deliberately narrower than the dashboard payments list - no
   * provider intent ids, no settlement/payout context, no contact fields.
   */
  async listTravellerPayments(
    query: TravellerListQueryDto,
    sessionToken?: string,
  ) {
    const email = this.requireTravellerEmail(sessionToken);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.PaymentWhereInput = {
      booking: { contactEmail: { equals: email, mode: 'insensitive' } },
    };

    // Ledger subtotal chips (review 5.7): per-currency, NEVER cross-currency
    // sums. Same two-status charge rule as summarizeBookings (a settled refund
    // flips both legs to REFUNDED); an in-flight refund is PROCESSING - the
    // "on its way" bucket, kept separate so the chip shows progress.
    const sumByCurrency = (
      rows: { currency: string; _sum: { amount: Prisma.Decimal | null } }[],
    ) =>
      rows
        .filter((r) => r._sum.amount && !r._sum.amount.isZero())
        .map((r) => ({
          currency: r.currency,
          amount: (r._sum.amount ?? new Prisma.Decimal(0)).toString(),
        }));

    const [total, paidBy, refundedBy, refundPendingBy, rows] =
      await Promise.all([
        this.prisma.payment.count({ where }),
        this.prisma.payment.groupBy({
          by: ['currency'],
          where: {
            ...where,
            kind: { not: PaymentKind.REFUND },
            status: { in: [PaymentStatus.SUCCEEDED, PaymentStatus.REFUNDED] },
          },
          _sum: { amount: true },
        }),
        this.prisma.payment.groupBy({
          by: ['currency'],
          where: {
            ...where,
            kind: PaymentKind.REFUND,
            status: { in: [PaymentStatus.SUCCEEDED, PaymentStatus.REFUNDED] },
          },
          _sum: { amount: true },
        }),
        this.prisma.payment.groupBy({
          by: ['currency'],
          where: {
            ...where,
            kind: PaymentKind.REFUND,
            status: PaymentStatus.PROCESSING,
          },
          _sum: { amount: true },
        }),
        this.prisma.payment.findMany({
          where,
          select: {
            id: true,
            kind: true,
            status: true,
            provider: true,
            methodType: true,
            amount: true,
            currency: true,
            createdAt: true,
            booking: {
              select: {
                displayRef: true,
                publicRef: true,
                localDate: true,
                // Card recognition (review F14): brand + last4 beat a generic
                // "card" at preventing "what is this charge?" chargebacks.
                paymentMethodBrand: true,
                paymentMethodLast4: true,
                tour: {
                  select: {
                    name: true,
                    destination: { select: { slug: true } },
                  },
                },
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
      totals: {
        paid: sumByCurrency(paidBy),
        refunded: sumByCurrency(refundedBy),
        refundPending: sumByCurrency(refundPendingBy),
      },
      data: rows.map((p) => ({
        id: p.id,
        kind: p.kind,
        status: p.status,
        provider: p.provider,
        methodType: p.methodType,
        methodBrand: p.booking.paymentMethodBrand,
        methodLast4: p.booking.paymentMethodLast4,
        amount: p.amount.toString(),
        currency: p.currency,
        createdAt: p.createdAt.toISOString(),
        bookingDisplayRef: p.booking.displayRef,
        bookingPublicRef: p.booking.publicRef,
        destinationSlug: p.booking.tour?.destination?.slug ?? null,
        tourName: p.booking.tour?.name ?? null,
        bookingLocalDate: dateKey(p.booking.localDate),
      })),
    };
  }

  // ── Self-service date change (review 10.4, promoted from V2 2026-07-30) ──
  //
  // DIRECT swap, not a request queue: inside the free-cancellation window the
  // traveller can already cancel for a FULL refund and rebook, so moving the
  // booking grants nothing they don't have - it just removes the ops loop.
  // Outside the window the endpoints refuse, same judgement rule as
  // cancellation (wall-clock start minus cancellation_hours).

  /** Everything the date-change guards need to say yes or no. */
  private static readonly DATE_CHANGE_SELECT = {
    id: true,
    publicRef: true,
    displayRef: true,
    contactEmail: true,
    contactFullName: true,
    contactFirstName: true,
    contactLastName: true,
    customerLocale: true,
    status: true,
    tourId: true,
    departureId: true,
    operatorId: true,
    island: true,
    exclusiveDeparture: true,
    localDate: true,
    startTime: true,
    tourStartDateTime: true,
    utcCancellationRequestedAt: true,
    utcCancelledAt: true,
    unitItems: { select: { id: true } },
    tour: {
      select: {
        name: true,
        cancellationHours: true,
        durationMinutesFrom: true,
      },
    },
  } satisfies Prisma.BookingSelect;

  /**
   * Shared guard: the caller owns the booking (traveler HMAC session), the
   * booking is CONFIRMED with no pending cancellation request, and the free
   * window is still open. Throws the precise refusal otherwise.
   */
  private assertDateChangeAllowed(
    booking: Prisma.BookingGetPayload<{
      select: typeof BookingsService.DATE_CHANGE_SELECT;
    }>,
    sessionToken?: string | null,
  ): void {
    if (
      !sessionOwnsBooking(verifyTravelerSession(sessionToken), {
        id: booking.id,
        contactEmail: booking.contactEmail,
      })
    ) {
      throw new UnauthorizedException(
        'Verify with your email and booking reference to change the date',
      );
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException('Only a confirmed booking can change date');
    }
    if (
      booking.utcCancellationRequestedAt !== null &&
      booking.utcCancelledAt === null
    ) {
      throw new ConflictException(
        'A cancellation request is pending on this booking',
      );
    }
    // Same wall-clock judgement as cancellation eligibility: start minus
    // cancellation_hours, compared as the platform-wide Z-labelled convention.
    const start =
      booking.tourStartDateTime ??
      new Date(
        `${dateKey(booking.localDate)}T${booking.startTime ?? '00:00'}:00.000Z`,
      );
    const hoursUntil = (start.getTime() - Date.now()) / 3_600_000;
    if (hoursUntil < booking.tour.cancellationHours) {
      throw new ConflictException(
        'The free-change window has closed for this booking',
      );
    }
  }

  /**
   * GET typ/:publicRef/date-change-options - the next OPEN departures of the
   * SAME tour with room for this party (whole-unit free for exclusive
   * charters). Purpose-built so the account card renders a plain select
   * instead of the whole booking-widget calendar.
   */
  async getDateChangeOptions(publicRef: string, sessionToken?: string | null) {
    const booking = await this.prisma.booking.findUnique({
      where: { publicRef },
      select: BookingsService.DATE_CHANGE_SELECT,
    });
    if (!booking) throw new NotFoundException('Booking not found');
    this.assertDateChangeAllowed(booking, sessionToken);

    const seats = booking.unitItems.length;
    const departures = await this.prisma.departure.findMany({
      where: {
        tourId: booking.tourId,
        id: { not: booking.departureId ?? undefined },
        status: DepartureStatus.OPEN,
        // Future dates only - a same-day move cuts into the operator's
        // no-show handling and the arrival buffer.
        date: { gt: new Date() },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      take: 60,
      select: {
        id: true,
        date: true,
        startTime: true,
        capacity: true,
        bookedCount: true,
      },
    });

    return {
      options: departures
        .filter((d) =>
          booking.exclusiveDeparture
            ? d.bookedCount === 0
            : d.capacity - d.bookedCount >= seats,
        )
        .slice(0, 30)
        .map((d) => ({
          departureId: d.id,
          date: dateKey(d.date),
          startTime: timeOfDay(d.startTime),
          seatsLeft: d.capacity - d.bookedCount,
        })),
    };
  }

  /**
   * POST typ/:publicRef/date-change - atomically move the booking to another
   * departure of the same tour: guarded claim on the new one (the same
   * overbooking backstop reserve uses), release on the old one, snapshot
   * times updated. Prices and commission are untouched - same tour, and
   * snapshots are never retroactive (rule #21 family).
   */
  async changeDate(
    publicRef: string,
    departureId: string,
    sessionToken?: string | null,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { publicRef },
      select: BookingsService.DATE_CHANGE_SELECT,
    });
    if (!booking) throw new NotFoundException('Booking not found');
    this.assertDateChangeAllowed(booking, sessionToken);

    // Flip-flop guard: three moves a day is a traveller planning; more is a
    // script (and an inventory nuisance for the operator).
    this.targetLimiter.consume('date-change', publicRef, [
      { max: 3, windowMs: 24 * 60 * 60 * 1000 },
    ]);

    if (departureId === booking.departureId) {
      throw new ConflictException('The booking is already on that departure');
    }
    const seats = booking.unitItems.length;
    const oldDate = booking.tourStartDateTime ?? booking.localDate;
    const oldDepartureId = booking.departureId;

    const moved = await this.prisma.$transaction(async (tx) => {
      // Read kept for the wrong-tour 404 and the date/startTime the booking
      // update below snapshots; the claim's guard reads live capacity in SQL.
      const dep = await tx.departure.findUnique({
        where: { id: departureId },
        select: {
          id: true,
          tourId: true,
          date: true,
          startTime: true,
        },
      });
      if (!dep || dep.tourId !== booking.tourId) {
        throw new NotFoundException('Departure not found for this tour');
      }

      const claimed = await this.claimSeats(tx, {
        departureId,
        tourId: booking.tourId,
        seats,
        exclusive: booking.exclusiveDeparture,
      });
      if (!claimed) {
        throw new UnprocessableEntityException(
          'That departure is no longer available',
        );
      }
      if (oldDepartureId) {
        await this.releaseSeats(
          tx,
          oldDepartureId,
          seats,
          booking.exclusiveDeparture,
        );
      }

      const localStart = combineDateTime(dep.date, dep.startTime);
      return tx.booking.update({
        where: { id: booking.id },
        data: {
          departureId,
          localDate: dep.date,
          startTime: timeOfDay(dep.startTime),
          tourStartDateTime: localStart,
          tourEndDateTime:
            booking.tour.durationMinutesFrom != null
              ? new Date(
                  localStart.getTime() +
                    booking.tour.durationMinutesFrom * 60_000,
                )
              : null,
        },
        select: {
          publicRef: true,
          displayRef: true,
          tourId: true,
          operatorId: true,
          localDate: true,
          startTime: true,
          tourStartDateTime: true,
        },
      });
    });

    this.logger.log(
      `Booking ${booking.displayRef} moved to ${dateKey(moved.localDate)} ${moved.startTime ?? ''} (self-service date change)`,
    );

    // Inventory changed on BOTH days - the availability webhook keys on
    // (tourId, localDate), so emit one event per affected day.
    this.emitBookingEvents({
      tourId: moved.tourId,
      localDate: booking.localDate,
      operatorId: moved.operatorId,
      publicRef: moved.publicRef,
    });
    this.emitBookingEvents({
      tourId: moved.tourId,
      localDate: moved.localDate,
      operatorId: moved.operatorId,
      publicRef: moved.publicRef,
    });

    // Best-effort notices AFTER the move is committed: a dead mailbox must
    // never read as a failed date change.
    void this.sendDateChangeNotices(booking, oldDate, moved).catch(
      (err: Error) =>
        this.logger.error(
          `Date-change notices failed for ${booking.displayRef}`,
          err,
        ),
    );

    return {
      changed: true,
      localDate: dateKey(moved.localDate),
      startTime: moved.startTime,
    };
  }

  /** Traveller confirmation + operator heads-up on the shared notice shell. */
  private async sendDateChangeNotices(
    booking: Prisma.BookingGetPayload<{
      select: typeof BookingsService.DATE_CHANGE_SELECT;
    }>,
    oldDate: Date,
    moved: {
      localDate: Date;
      startTime: string | null;
      tourStartDateTime: Date | null;
      publicRef: string;
    },
  ): Promise<void> {
    const [operator, site] = await Promise.all([
      this.prisma.operator.findUnique({
        where: { id: booking.operatorId },
        select: {
          contactEmail: true,
          companyInfo: { select: { companyEmail: true } },
        },
      }),
      this.prisma.siteInfo.findFirst({ select: { logo: true } }),
    ]);

    const tourName = booking.tour?.name ?? 'Your tour';
    const newDate = moved.tourStartDateTime ?? moved.localDate;
    const shared = {
      emailIconBase: emailIconBase(),
      siteLogoUrl: emailSafeLogoUrl(site?.logo) ?? '',
      bookingRef: booking.displayRef,
      tourName,
      startTime: moved.startTime ?? '',
    };

    if (booking.contactEmail) {
      const locale = toLocale(booking.customerLocale);
      const ctx: EmailTemplateContext = {
        ...shared,
        dateLong: formatDateLong(newDate, locale),
        noticeTitle: 'Your trip has a new date.',
        noticeParagraphs: [
          `Done - ${tourName} now departs ${formatDateLong(newDate, locale)} at ${moved.startTime ?? ''}. This email is your updated confirmation; the reference stays the same.`,
          `Your previous date (${formatDateLong(oldDate, locale)}) is released. Payments and the free-cancellation window follow the new date automatically.`,
        ],
        ctaUrl: `${islandToursBase()}/${booking.island}/thank-you/${booking.publicRef}`,
        ctaLabel: 'View your booking',
      };
      await this.mail.sendBookingNoticeEmail(
        booking.contactEmail,
        `New date for your trip - ${booking.displayRef}`,
        ctx,
        buildNoticeText(ctx),
      );
    }

    const operatorEmail =
      operator?.companyInfo?.companyEmail ?? operator?.contactEmail ?? null;
    if (operatorEmail) {
      const guestName =
        booking.contactFullName ??
        ([booking.contactFirstName, booking.contactLastName]
          .filter(Boolean)
          .join(' ') ||
          'The traveller');
      const ctx: EmailTemplateContext = {
        ...shared,
        dateLong: formatDateLong(newDate, Locale.en),
        noticeTitle: 'Booking moved to a new date.',
        noticeParagraphs: [
          `${guestName} moved booking ${booking.displayRef} for ${tourName} from ${formatDateLong(oldDate, Locale.en)} to ${formatDateLong(newDate, Locale.en)} at ${moved.startTime ?? ''}.`,
          'Seats were released on the old departure and claimed on the new one automatically. No action needed.',
        ],
        ctaUrl: `${dashboardAppBase()}/bookings`,
        ctaLabel: 'View booking in your dashboard',
      };
      await this.mail.sendBookingNoticeEmail(
        operatorEmail,
        `Booking moved - ${booking.displayRef}: ${tourName}`,
        ctx,
        buildNoticeText(ctx),
      );
    }
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
      // WITHHELD unverified (pentest 2026-08-01). The reference is not a tour
      // fact, it is the identifier a traveller quotes to support - so handing
      // it to anyone holding a forwarded link turns a read-only capability
      // into the makings of an impersonation ("hi, it's IT-2026-MADK2, please
      // refund me"). It is also half of the `/bookings` pair login. Nobody who
      // cannot prove ownership has a use for it: the owner already has it in
      // their confirmation email.
      displayRef: verified ? booking.displayRef : null,
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

    // Conflict #7: resolved ONCE per call - it shapes both the search clause
    // below and the row projection at the end (one permission read per page,
    // never per row). A self-scoped list is the caller's own receipts, which
    // always carry the money.
    const seesFinancials =
      selfScoped || (await this.canSeeBookingFinancials(actor));

    if (query.tourId) where.tourId = query.tourId;
    // Status filter accepts DERIVED display statuses too (the chips the table
    // shows), translated to their defining predicates; raw enum values pass
    // through unchanged (so CANCELLED still includes forfeited rows - the
    // derived options are refinements, not a partition).
    if (query.status === 'FORFEITED') {
      where.status = BookingStatus.CANCELLED;
      where.utcForfeitedAt = { not: null };
    } else if (query.status === 'NON_PAYMENT_REPORTED') {
      where.status = BookingStatus.CONFIRMED;
      where.utcNonPaymentReportedAt = { not: null };
      where.utcForfeitedAt = null;
    } else if (query.status === 'CANCELLATION_REQUESTED') {
      where.status = BookingStatus.CONFIRMED;
      where.utcCancellationRequestedAt = { not: null };
      where.utcCancelledAt = null;
    } else if (query.status === 'OPERATOR_CANCELLATION_REPORTED') {
      where.status = BookingStatus.CONFIRMED;
      where.utcOperatorCancellationReportedAt = { not: null };
      where.utcCancelledAt = null;
    } else if (query.status) {
      where.status = query.status;
    }
    if (query.paymentModel) where.paymentModel = query.paymentModel;
    if (query.cancellationRequested)
      where.utcCancellationRequestedAt = { not: null };
    if (query.search?.trim()) {
      const q = query.search.trim();
      // Conflict #7: a manifest seat never sees contactEmail, so letting it
      // SEARCH on email would turn the list into an existence oracle ("has
      // this address ever booked?") - worse for a platform-wide seat, whose
      // query is not operator-scoped. Reference + name only in that case.
      where.OR = [
        { displayRef: { contains: q, mode: 'insensitive' } },
        { publicRef: { contains: q, mode: 'insensitive' } },
        { contactFullName: { contains: q, mode: 'insensitive' } },
        ...(seesFinancials
          ? [{ contactEmail: { contains: q, mode: 'insensitive' as const } }]
          : []),
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
          ...BOOKING_LIST_INCLUDE,
          tour: { select: { name: true, cancellationHours: true } },
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
        const full = stripCommissionForNonPlatform(
          mapBookingListItem(row),
          actor.role,
        );
        const item = seesFinancials ? full : applyManifestProjection(full);
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

  // getCustomerSummary() lived here until 2026-07-28 - it backed the deleted
  // dashboard /account stat row. `getTravellerSummary` is its live successor
  // and shares the same `summarizeBookings` math.

  /**
   * Shared stat-row math for both self-service surfaces - the dashboard
   * customer summary (scoped by userId) and the traveller account area
   * (scoped by contactEmail). One implementation on purpose: two copies would
   * drift the moment either definition of "spend" changed.
   */
  private async summarizeBookings(
    bookingScope: Prisma.BookingWhereInput,
    paymentBookingScope: Prisma.PaymentWhereInput,
  ) {
    // Same two-status rule as derivePaymentState: when a refund settles, the
    // REFUND row and the original charge both flip to REFUNDED, so counting
    // only SUCCEEDED would drop the pair. Usually that nets out to the same
    // number - but the legs can settle out of lockstep (reconcileRefundRow
    // skips the charge flip when the row has no intentId), and then the
    // one-status read silently overcounts spend the traveller got back.
    const paymentScope: Prisma.PaymentWhereInput = {
      ...paymentBookingScope,
      status: { in: [PaymentStatus.SUCCEEDED, PaymentStatus.REFUNDED] },
    };
    const [bookingsCount, upcomingCount, paid, refunded] = await Promise.all([
      this.prisma.booking.count({
        where: {
          ...bookingScope,
          status: { in: [...ACTIVE_BOOKING_STATUSES] },
        },
      }),
      this.prisma.booking.count({
        where: {
          ...bookingScope,
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

  /**
   * A free E.8 display reference (IT-{year}-XXXXX). 30^5 combinations, so a
   * clash with an existing row is unlikely but real at scale - regenerate on
   * hit rather than widening the format. Five misses in a row means ~24M
   * bookings in one trip year; treat that as an operational error.
   */
  private async allocateDisplayRef(localStart: Date): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = makeDisplayRef(localStart);
      const clash = await this.prisma.booking.findUnique({
        where: { displayRef: candidate },
        select: { id: true },
      });
      if (!clash) return candidate;
    }
    throw new ConflictException('Could not allocate a booking reference');
  }

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
    // The departure lookup keys off `dto` alone, so it overlaps the tour read
    // rather than waiting behind it. The guards below stay in their original
    // order, so the error precedence a caller sees is unchanged (missing tour,
    // then unsupported payment model, then invalid departure) - only the two
    // round trips are collapsed into one.
    const [tour, departure] = await Promise.all([
      this.prisma.tour.findUnique({
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
      }),
      this.prisma.departure.findFirst({
        where: { id: dto.departureId, tourId: dto.tourId },
        select: {
          id: true,
          date: true,
          startTime: true,
          capacity: true,
          bookedCount: true,
        },
      }),
    ]);
    if (!tour) throw new NotFoundException('Tour not found');

    // OPERATOR_FULL was dropped for v1 (founder, 2026-07-15): it takes no payment and
    // would create a confirmed, unpaid booking - an operator could bypass payment
    // entirely. Reject it here so neither reserve nor quote can proceed (flaw #6).
    if (tour.paymentModel === PaymentModel.OPERATOR_FULL) {
      throw new UnprocessableEntityException(
        'This tour is not bookable online (unsupported payment model)',
      );
    }

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
      return {
        addOnId: row.id,
        name: row.name,
        unit: row.unit,
        quantity: a.quantity,
        unitPrice: row.price,
        maxQuantity: row.maxQuantity,
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

    // Add-on ceilings (master E.3; Pastel #58). The quantity counts UNITS and the
    // unit is whatever the price line says, so the ceiling is unit-aware: a
    // per-person extra stops at the paying travellers, a per-booking extra stops
    // at one, and the operator's own maxQuantity can only lower either. The
    // widget's stepper caps at exactly this number, so anything above it is a
    // forged payload.
    //
    // Paying travellers, not seats: a free band (infants) rides along and counts
    // toward capacity, but is not somebody you buy an open bar for. On a charter
    // every guest is covered by the price paid, so all of them count.
    const payingPax = ctx.isUnit
      ? ctx.guests
      : ctx.lines.reduce(
          (n, l) => (l.priceRetail.greaterThan(0) ? n + l.quantity : n),
          0,
        );
    for (const line of ctx.addOnLines) {
      const cap = addOnQuantityCap(
        line.unit,
        line.maxQuantity ?? Number.MAX_SAFE_INTEGER,
        payingPax,
      );
      if (line.quantity > cap) {
        throw new UnprocessableEntityException(
          `Maximum quantity for "${line.name}" is ${cap}`,
        );
      }
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
      // An absolute write is already idempotent under concurrency.
      await tx.departure.update({
        where: { id: departureId },
        data: { bookedCount: 0 },
      });
    } else {
      // Atomic clamped decrement IN SQL. The previous read-modify-write lost
      // decrements when two releases raced (sweeper vs. cancel): both read the
      // same bookedCount, both wrote from that snapshot, and the later commit
      // erased the earlier release - seats leaked until an admin noticed.
      // GREATEST re-evaluates against the current row under the row lock, so
      // concurrent releases compose and the count can never go negative.
      await tx.$executeRaw`
        UPDATE "departures"
        SET "bookedCount" = GREATEST("bookedCount" - ${seats}, 0)
        WHERE "id" = ${departureId}`;
    }
    await this.recomputeStoredStatus(tx, departureId);
  }

  /**
   * Atomic seat claim - THE overbooking backstop (master §5, invariant 6).
   * Capacity check + increment + SOLD_OUT flip + `soldOutAt` stamp in ONE
   * guarded UPDATE, so the contended departure row is held for a single
   * statement.
   *
   * Raw SQL because the guard compares two columns
   * (`bookedCount + seats <= capacity`), which Prisma's `where` cannot
   * express - the old shape computed `capacity - seats` in JS from a pre-read,
   * and under READ COMMITTED that frozen capacity snapshot missed a concurrent
   * capacity reduction. In-SQL comparison always evaluates the newest row.
   *
   * Postgres enum literals are the MAPPED (lowercase) values of
   * `departure_status`; booking statuses are a different type (UPPERCASE) -
   * do not mix them up.
   *
   * @param intoSticky Restore-only: accept a SOLD_OUT/CLOSED departure (sticky
   *   states stop NEW sales, not the return of a seat that was wrongly
   *   released - only CANCELLED is a dead end). Status is then re-derived from
   *   the new fill with CLOSED kept sticky, exactly as `recomputeStoredStatus`
   *   used to do after the claim.
   * @returns false when the claim lost (sold out, closed, or wrong tour/id).
   */
  private async claimSeats(
    tx: Prisma.TransactionClient,
    args: {
      departureId: string;
      tourId: string;
      seats: number;
      exclusive: boolean;
      intoSticky?: boolean;
    },
  ): Promise<boolean> {
    const { departureId, tourId, seats, exclusive, intoSticky } = args;
    let claimed: number;
    if (exclusive) {
      // Exclusive charter (D5): only a still-empty departure can be taken;
      // claim the WHOLE unit so no one else can book it. A capacity-0
      // departure flips straight to sold_out with 0 - same as the old
      // recompute semantics.
      claimed = intoSticky
        ? await tx.$executeRaw`
            UPDATE "departures"
            SET "bookedCount" = "capacity",
                "status" = CASE WHEN "status" = 'closed'::"departure_status"
                                THEN "status"
                                ELSE 'sold_out'::"departure_status" END,
                "soldOutAt" = CASE WHEN "status" = 'closed'::"departure_status"
                                   THEN "soldOutAt"
                                   ELSE COALESCE("soldOutAt", now()) END
            WHERE "id" = ${departureId} AND "tourId" = ${tourId}
              AND "status" <> 'cancelled'::"departure_status"
              AND "bookedCount" = 0`
        : await tx.$executeRaw`
            UPDATE "departures"
            SET "bookedCount" = "capacity",
                "status"      = 'sold_out'::"departure_status",
                "soldOutAt"   = COALESCE("soldOutAt", now())
            WHERE "id" = ${departureId} AND "tourId" = ${tourId}
              AND "status" = 'open'::"departure_status"
              AND "bookedCount" = 0`;
    } else {
      // Shared / per-person: guarded count-up; claims only if seats remain.
      // `>=` in the CASE is deliberate belt-and-braces: with the guard in the
      // same WHERE, equality is the only reachable branch.
      claimed = intoSticky
        ? await tx.$executeRaw`
            UPDATE "departures"
            SET "bookedCount" = "bookedCount" + ${seats},
                "status" = CASE
                  WHEN "status" = 'closed'::"departure_status" THEN "status"
                  WHEN "bookedCount" + ${seats} >= "capacity"
                    THEN 'sold_out'::"departure_status"
                  ELSE 'open'::"departure_status" END,
                "soldOutAt" = CASE
                  WHEN "status" <> 'closed'::"departure_status"
                   AND "bookedCount" + ${seats} >= "capacity"
                    THEN COALESCE("soldOutAt", now())
                  ELSE "soldOutAt" END
            WHERE "id" = ${departureId} AND "tourId" = ${tourId}
              AND "status" <> 'cancelled'::"departure_status"
              AND "bookedCount" + ${seats} <= "capacity"`
        : await tx.$executeRaw`
            UPDATE "departures"
            SET "bookedCount" = "bookedCount" + ${seats},
                "status" = CASE WHEN "bookedCount" + ${seats} >= "capacity"
                                THEN 'sold_out'::"departure_status"
                                ELSE "status" END,
                "soldOutAt" = CASE WHEN "bookedCount" + ${seats} >= "capacity"
                                   THEN COALESCE("soldOutAt", now())
                                   ELSE "soldOutAt" END
            WHERE "id" = ${departureId} AND "tourId" = ${tourId}
              AND "status" = 'open'::"departure_status"
              AND "bookedCount" + ${seats} <= "capacity"`;
    }
    return claimed === 1;
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
   * - IDEMPOTENT: skips if a settled (REFUNDED) or in-flight (PROCESSING)
   *   REFUND row already exists, and passes a stable PSP idempotency key so a
   *   retry never double-refunds.
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
      // (SUCCEEDED kept for rows written before refunds settled to REFUNDED.)
      const already = await this.prisma.payment.findFirst({
        where: {
          bookingId,
          kind: PaymentKind.REFUND,
          status: {
            in: [
              PaymentStatus.REFUNDED,
              PaymentStatus.SUCCEEDED,
              PaymentStatus.PROCESSING,
            ],
          },
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
      // Money actually moved back (sync card refunds): the ORIGINAL charge row
      // flips to REFUNDED too, so the payments list never shows a green
      // "Succeeded" charge on a refunded booking. Async refunds (PROCESSING)
      // flip it later in reconcileRefundRow, at the settle point.
      if (rowStatus === PaymentStatus.REFUNDED) {
        await this.prisma.payment.updateMany({
          where: {
            bookingId,
            kind: { not: PaymentKind.REFUND },
            intentId: charge.intentId,
            status: PaymentStatus.SUCCEEDED,
          },
          data: { status: PaymentStatus.REFUNDED },
        });
      }
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
/**
 * E.8 display_ref alphabet (review F11): Crockford-style, so a reference read
 * over the phone or typed at check-in can't be tripped by 0/O, 1/I/L or U/V.
 * The ref is a login + check-in credential (LD4), not just a label.
 */
const DISPLAY_REF_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const DISPLAY_REF_LENGTH = 5;

/** IT-{tripYear}-XXXXX, crypto-random. Uniqueness is the CALLER's job
 * (`allocateDisplayRef` pre-checks against the @unique column). */
function makeDisplayRef(localStart: Date): string {
  const year = dateKey(localStart).slice(0, 4);
  let code = '';
  for (let i = 0; i < DISPLAY_REF_LENGTH; i++) {
    code += DISPLAY_REF_ALPHABET[randomInt(DISPLAY_REF_ALPHABET.length)];
  }
  return `IT-${year}-${code}`;
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
    // REFUNDED counts on both legs (refunded original = was paid; settled
    // REFUND row = money returned) so the net stays right after the flip.
    if (
      p.status !== PaymentStatus.SUCCEEDED &&
      p.status !== PaymentStatus.REFUNDED
    )
      continue;
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
    // Day-of-tour operational facts. These ARE the manifest (conflict #7):
    // a guide needs to call a late guest, know where to collect them and
    // what they asked for - none of it is money or marketing PII.
    contactPhone: b.contactPhone,
    notes: b.notes,
    pickupAddress: b.pickupAddress,
    pickupWindowStart: b.pickupWindowStart,
    pickupWindowEnd: b.pickupWindowEnd,
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
    // Operator cancellation report (conflict #2) - drives the dashboard's
    // report/execute/dismiss row actions.
    utcOperatorCancellationReportedAt: b.utcOperatorCancellationReportedAt
      ? b.utcOperatorCancellationReportedAt.toISOString()
      : null,
    operatorCancellationReason: b.operatorCancellationReason ?? null,
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
    // Status only exists for paid_in_full bookings (the payout ledger); the
    // METHOD is derived from the booking's own payment model so deposit-model
    // rows still read "Self-settling" instead of a bare dash.
    settlementStatus: b.settlement?.status ?? null,
    settlementMethod: settlementMethodFor(b.paymentModel),
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
 * Traveller account row (/{locale}/traveller). Starts from the dashboard row
 * so the two can never disagree about payment state or the cancellation
 * verdict, then removes everything that is not the traveller's business:
 *
 * - settlement status/method/held - operator PAYOUT context, not the guest's,
 * - the ops lifecycle timestamps (non-payment report, forfeit, operator
 *   cancellation report + reason) - internal workflow the guest sees only as
 *   its outcome,
 * - contactFullName/contactEmail - the caller IS that contact; echoing the
 *   PII back adds nothing and widens what a stolen session leaks,
 * - commission - nulled for every non-platform reader (rule #22 context).
 *
 * Adds `destinationSlug`, which the dashboard row does not carry, because
 * every card deep-links to `/{destinationSlug}/thank-you/{publicRef}`.
 */
function mapTravellerBookingItem(
  b: BookingWithItems & {
    tour: {
      name: string;
      slug: string;
      cancellationHours: number;
      durationMinutesFrom: number | null;
      checkInMinutesBefore: number | null;
      meetingPointLat: number | null;
      meetingPointLng: number | null;
      destination: { slug: string; name: string } | null;
      images: { url: string }[];
      translations: { locale: Locale; meetingPointText: string | null }[];
      locations: {
        types: string[];
        streetAddress: string | null;
        translations: { locale: Locale; title: string | null }[];
      }[];
    };
    operator: {
      contactEmail: string | null;
      contactPhone: string | null;
      companyInfo: {
        companyName: string | null;
        companyEmail: string | null;
        companyPhone: string | null;
      } | null;
    } | null;
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
  locale: Locale,
) {
  const {
    settlementStatus: _settlementStatus,
    settlementMethod: _settlementMethod,
    settlementHeld: _settlementHeld,
    contactFullName: _contactFullName,
    contactEmail: _contactEmail,
    utcNonPaymentReportedAt: _utcNonPaymentReportedAt,
    utcForfeitedAt: _utcForfeitedAt,
    utcOperatorCancellationReportedAt: _utcOperatorCancellationReportedAt,
    operatorCancellationReason: _operatorCancellationReason,
    ...traveller
  } = mapBookingListItem(b);

  // Same priority the confirmation email uses (assembleConfirmationContext):
  // the START location's localized title, else the tour's meeting-point text.
  // The two surfaces must name the same place - shared helper, not a copy.
  const meetingPoint =
    pickTourLocation(b.tour.locations, 'START', locale) ??
    preferLocale(b.tour.translations, locale)?.meetingPointText ??
    null;

  return {
    ...traveller,
    commissionRate: null,
    commissionAmount: null,
    destinationSlug: b.tour.destination?.slug ?? null,
    destinationName: b.tour.destination?.name ?? null,
    tourSlug: b.tour.slug,
    tourImageUrl: b.tour.images[0]?.url ?? null,
    durationMinutesFrom: b.tour.durationMinutesFrom,
    // "Be there N minutes early" (master 4.4): the pickup point's own lead
    // time when this booking has a pickup, else the tour's check-in buffer.
    // The `?? 15` floor matches the confirmation email (arrivalBufferMin) -
    // the account card and the email must give the same instruction.
    arrivalBufferMinutes:
      (b.pickupRequested && b.pickupAddress
        ? b.pickupMinutesPrior
        : b.tour.checkInMinutesBefore) ?? 15,
    meetingPoint,
    meetingPointLat: b.tour.meetingPointLat,
    meetingPointLng: b.tour.meetingPointLng,
    onArrivalPayment: b.onArrivalPayment,
    // Support row (review 5.8): the operator NAME + direct contacts. This list
    // is self-scoped by the HISTORY session - the same proof the TYP requires
    // before it reveals these fields to a verified viewer.
    operator: {
      name: b.operator?.companyInfo?.companyName ?? null,
      email:
        b.operator?.contactEmail ??
        b.operator?.companyInfo?.companyEmail ??
        null,
      phone:
        b.operator?.contactPhone ??
        b.operator?.companyInfo?.companyPhone ??
        null,
    },
  };
}

/**
 * The MANIFEST projection (access-roles matrix conflict #7): what a
 * guide-level seat may see on a booking row - who is coming, when, where,
 * and how to reach them on the day. Everything that is money or marketing
 * PII is nulled: amounts, payment/refund/settlement state, and the
 * traveler's email. The phone stays - a guide needs to call a late guest.
 *
 * Nulled, never omitted, so the response shape (and therefore the DTO and
 * every dashboard column) is identical for every caller; the UI hides the
 * columns whose values are absent.
 */
const MANIFEST_NULLED_FIELDS = [
  'totalRetail',
  'depositAmount',
  'balanceAmount',
  'commissionRate',
  'commissionAmount',
  'paidAmount',
  'contactEmail',
  'settlementStatus',
  'settlementMethod',
  'refundStatus',
  // The raw settled verdict (NONE/PARTIAL/FULL), distinct from the derived
  // refundStatus above - both are refund state.
  'cancellationRefund',
] as const;

function applyManifestProjection<T extends Record<string, unknown>>(
  payload: T,
): T {
  const projected: Record<string, unknown> = { ...payload };
  for (const field of MANIFEST_NULLED_FIELDS) {
    if (field in projected) projected[field] = null;
  }
  // Per-traveler prices are money too - the row total is not the only leak.
  // The line itself stays (the guide needs the party composition).
  if (Array.isArray(projected.unitItems)) {
    projected.unitItems = (
      projected.unitItems as { priceRetail?: unknown }[]
    ).map((item) => ({ ...item, priceRetail: null }));
  }
  // Payment state is a money signal too - collapse it rather than null it,
  // so the field keeps its enum shape for the DTO.
  if ('paymentStatus' in projected) projected.paymentStatus = null;
  if ('settlementHeld' in projected) projected.settlementHeld = false;
  return projected as T;
}

/**
 * The commission snapshot is PLATFORM-internal context: customers never see
 * the platform's take on their own purchase, and operators never see it in
 * the portal either (access-roles matrix, Bookings notes - commission fields
 * are never rendered to operators; their money view is payment state +
 * settlements). Only platform-wide roles (ADMIN/STAFF/EDITOR) keep the
 * fields. Nulled, not omitted, so the response shape stays DTO-stable.
 */
function stripCommissionForNonPlatform<
  T extends { commissionRate: string | null; commissionAmount: string | null },
>(payload: T, role: Role): T {
  if (isPlatformWideBookingRole(role)) return payload;
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
 * Commission is visible only to an authenticated PLATFORM actor (admin/staff
 * dashboards). Anonymous callers, customers and operators get the commission-
 * nulled payload (same withholding rule as stripCommissionForNonPlatform).
 */
function mapBookingForActor(
  b: BookingWithItems,
  actor?: { id: string; role: Role },
) {
  return !actor || !isPlatformWideBookingRole(actor.role)
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
