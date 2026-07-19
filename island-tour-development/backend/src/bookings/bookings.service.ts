import { randomUUID } from 'crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  BookingStatus,
  CancellationRefund,
  CancelledBy,
  Currency,
  DepartureStatus,
  Locale,
  PaymentModel,
  PricingModel,
  Prisma,
  Role,
  TourBookingType,
  TourStatus,
  WholeUnitType,
  type Booking,
  type BookingUnitItem,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { MailService } from '@/mail/mail.service';
import { emailSafeLogoUrl } from '@/mail/email-logo.util';
import { TrackingService } from '@/tracking/tracking.service';
import { NotificationsService } from '@/notifications/notifications.service';
import {
  dashboardAppBase,
  islandToursBase,
} from '@/common/utils/app-urls.util';
import { resolveOperatorId } from '@/common/utils/operator.util';
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

const DEFAULT_HOLD_MINUTES = 30;
/** Quote validity window (guide §20.4: 10-15 min is enough). */
const QUOTE_TTL_MINUTES = 15;

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
  address: string | null;
  minutesPrior: number | null;
  windowStart: string | null;
  windowEnd: string | null;
};

/** No pickup selected: meet-on-site, so every pickup column stays null. */
const EMPTY_PICKUP: PickupSnapshot = {
  address: null,
  minutesPrior: null,
  windowStart: null,
  windowEnd: null,
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

  async reserve(dto: ReserveBookingDto, userId?: string) {
    const id = dto.id ?? randomUUID();

    // Idempotency: a retried create with the same id returns the existing booking.
    const prior = await this.prisma.booking.findUnique({
      where: { id },
      include: { unitItems: true },
    });
    if (prior) return mapBooking(prior);

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
          // Only ON_ARRIVAL bookings collect on site, so the terms are meaningless
          // (and misleading in the email) on any other model.
          onArrivalPayment:
            ctx.tour.paymentModel === PaymentModel.ON_ARRIVAL
              ? ctx.tour.onArrivalPayment
              : null,
          notes: dto.notes ?? null,
          newsletterOptIn: dto.newsletterOptIn ?? false,
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
      return mapBooking(finalized);
    }
    return mapBooking(created);
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
    if (booking.status === BookingStatus.CONFIRMED) return mapBooking(booking);
    if (booking.status !== BookingStatus.ON_HOLD) {
      throw new ConflictException(`Cannot confirm a ${booking.status} booking`);
    }
    if (booking.utcExpiresAt && booking.utcExpiresAt < new Date()) {
      throw new UnprocessableEntityException('Reservation hold has expired');
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
    return mapBooking(finalized);
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
  ): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { unitItems: true },
    });
    if (!booking) {
      this.logger.error(`confirmFromPayment: booking ${bookingId} not found`);
      return;
    }

    let current = booking;
    const transitioned = booking.status === BookingStatus.ON_HOLD;
    if (booking.status === BookingStatus.ON_HOLD) {
      current = await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CONFIRMED,
          utcConfirmedAt: booking.utcConfirmedAt ?? new Date(),
          billingCountry: billing?.country ?? booking.billingCountry,
          billingPostalCode: billing?.postalCode ?? booking.billingPostalCode,
          billingCity: billing?.city ?? booking.billingCity,
          paymentMethodLast4: billing?.last4 ?? booking.paymentMethodLast4,
          paymentMethodBrand: billing?.brand ?? booking.paymentMethodBrand,
        },
        include: { unitItems: true },
      });
      this.logger.log(`Booking ${current.displayRef} confirmed via payment`);
    } else if (billing) {
      current = await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          billingCountry: billing.country ?? booking.billingCountry,
          billingPostalCode: billing.postalCode ?? booking.billingPostalCode,
          billingCity: billing.city ?? booking.billingCity,
          paymentMethodLast4: billing.last4 ?? booking.paymentMethodLast4,
          paymentMethodBrand: billing.brand ?? booking.paymentMethodBrand,
        },
        include: { unitItems: true },
      });
    }

    const finalized = await this.finalizeConfirmation(current);
    if (transitioned) {
      // Status changed via payment; seats unchanged (already held at reserve).
      this.emitBookingEvents(finalized, { availability: false });
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
  ): Promise<BookingWithItems> {
    if (booking.conversionFiredAt) return booking; // already fired - idempotent

    // EUR-normalize the commission snapshot (rule #22 / master G3).
    const fxRate = booking.fxRateToEur ?? eurFxRate(booking.currency);
    const totalEur =
      booking.totalEur ??
      booking.totalRetail
        .mul(fxRate)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const commissionAmount =
      booking.commissionAmount ??
      (booking.commissionRate
        ? totalEur
            .mul(booking.commissionRate)
            .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
        : null);

    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        fxRateToEur: fxRate,
        totalEur,
        commissionAmount,
        conversionFiredAt: new Date(),
      },
      include: { unitItems: true },
    });

    // Conversion value MUST be a non-null EUR commission (rule #22). Otherwise it is
    // data corruption - log loudly and do NOT fire a conversion with a bad value.
    if (commissionAmount == null) {
      this.logger.error(
        `Booking ${updated.displayRef} confirmed with null commissionAmount - conversion NOT fired (data corruption)`,
      );
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
    return updated;
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
  ): Promise<{ requested: boolean }> {
    const booking = await this.prisma.booking.findUnique({
      where: { publicRef },
      select: {
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
        totalRetail: true,
        currency: true,
        paymentModel: true,
        operatorId: true,
        island: true,
        tour: { select: { name: true } },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException(
        'Only a confirmed booking can request cancellation',
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
        pickupAddress: true,
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

    const ics = buildBookingIcs({
      publicRef: booking.publicRef,
      displayRef: booking.displayRef,
      tourName: booking.tour?.name ?? 'Your tour',
      operatorName: booking.operator?.companyInfo?.companyName ?? null,
      startUtc: toUtc(booking.tourStartDateTime),
      endUtc: toUtc(booking.tourEndDateTime),
      location: booking.pickupAddress,
      description: `Booking reference: ${booking.displayRef}`,
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
      country: booking.contactCountry,
      postalCode: booking.contactPostalCode,
      clickId: booking.fbclid,
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
    if (booking.status === BookingStatus.CANCELLED) return mapBooking(booking);
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
    // Seats released back to inventory + booking status changed.
    this.emitBookingEvents(updated, { availability: !!booking.departureId });
    return mapBooking(updated);
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
    return mapBooking(updated);
  }

  async update(id: string, dto: UpdateBookingDto) {
    const booking = await this.loadOr404(id);
    if (
      booking.status !== BookingStatus.ON_HOLD &&
      booking.status !== BookingStatus.CONFIRMED
    ) {
      throw new ConflictException(`Cannot modify a ${booking.status} booking`);
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
    return mapBooking(updated);
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
    return mapBooking(booking);
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
  ): Promise<BookingLookupResponseDto> {
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
      throw new NotFoundException(
        'No booking matches that email and reference',
      );
    }

    return {
      publicRef: booking.publicRef,
      displayRef: booking.displayRef,
      destinationSlug: booking.tour.destination?.slug ?? null,
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
  async getThankYou(publicRef: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { publicRef },
      include: {
        unitItems: { select: { id: true, ageBandId: true } },
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

    const confirmed = booking.status === BookingStatus.CONFIRMED;
    const conversion =
      confirmed && booking.commissionAmount != null
        ? {
            event: 'Purchase',
            eventId: booking.publicRef,
            currency: 'EUR',
            value: booking.commissionAmount.toString(),
            contentId: booking.tourId,
            contentName: booking.tour?.name ?? null,
          }
        : null;

    if (confirmed && conversion == null) {
      this.logger.error(
        `TYP for ${booking.displayRef}: confirmed booking has null commissionAmount - no conversion`,
      );
    }

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

    return {
      guestFirstName: booking.contactFirstName,
      guestLastName: booking.contactLastName,
      guestFullName:
        booking.contactFullName ??
        ([booking.contactFirstName, booking.contactLastName]
          .filter(Boolean)
          .join(' ') ||
          null),
      contactPhone: booking.contactPhone,
      pickupRequested: booking.pickupRequested,
      party,
      depositAmount: booking.depositAmount.toString(),
      balanceAmount: booking.balanceAmount.toString(),
      paymentModel: booking.paymentModel,
      paymentMethodBrand: booking.paymentMethodBrand,
      paymentMethodLast4: booking.paymentMethodLast4,
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
      // OCTO supplier contact wins; the company profile is the fallback.
      operator: {
        name: booking.operator?.companyInfo?.companyName ?? null,
        email:
          booking.operator?.contactEmail ??
          booking.operator?.companyInfo?.companyEmail ??
          null,
        phone:
          booking.operator?.contactPhone ??
          booking.operator?.companyInfo?.companyPhone ??
          null,
      },
      publicRef: booking.publicRef,
      displayRef: booking.displayRef,
      status: booking.status,
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
      pickupAddress: booking.pickupAddress,
      partySize: booking.unitItems.length,
      currency: booking.currency,
      totalRetail: booking.totalRetail.toString(),
      contactEmail: booking.contactEmail,
      conversion,
    };
  }

  async list(query: ListBookingsQueryDto, actor: { id: string; role: Role }) {
    assertDateRangeOrder(query.from, query.to);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.BookingWhereInput = {};

    if (actor.role === Role.ADMIN) {
      // no scope restriction
    } else if (actor.role === Role.TOUR_OPERATOR) {
      where.operatorId = await resolveOperatorId(
        this.prisma,
        actor.id,
        actor.role,
      );
    } else {
      where.userId = actor.id;
    }

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
    return { total, page, limit, data: rows.map(mapBookingListItem) };
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
    if (actor.role === Role.ADMIN) return;
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
          minutesPrior: true,
          windowStart: true,
          windowEnd: true,
        },
      });
      if (!pickup || pickup.tourId !== dto.tourId) {
        throw new UnprocessableEntityException('Invalid pickupLocationId');
      }
      pickupSnapshot = {
        address: pickup.address ?? pickup.name,
        minutesPrior: pickup.minutesPrior,
        windowStart: pickup.windowStart,
        windowEnd: pickup.windowEnd,
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
      select: { id: true, name: true, unit: true, price: true },
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
function mapBookingListItem(
  b: BookingWithItems & {
    tour: { name: string; cancellationHours: number };
  },
) {
  const deadline = b.tourStartDateTime
    ? new Date(
        b.tourStartDateTime.getTime() - b.tour.cancellationHours * 3_600_000,
      )
    : null;
  return {
    ...mapBooking(b),
    tourName: b.tour.name,
    contactFullName: b.contactFullName,
    contactEmail: b.contactEmail,
    partySize: b.unitItems.length,
    createdAt: b.createdAt.toISOString(),
    utcCancellationRequestedAt: b.utcCancellationRequestedAt
      ? b.utcCancellationRequestedAt.toISOString()
      : null,
    freeCancelDeadline: deadline ? deadline.toISOString() : null,
    requestedInFreeWindow:
      b.utcCancellationRequestedAt && deadline
        ? b.utcCancellationRequestedAt.getTime() <= deadline.getTime()
        : null,
  };
}

function mapBooking(b: BookingWithItems) {
  return {
    id: b.id,
    displayRef: b.displayRef,
    publicRef: b.publicRef,
    tourId: b.tourId,
    departureId: b.departureId,
    status: b.status,
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
