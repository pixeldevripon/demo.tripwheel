import { randomUUID } from 'crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  BookingStatus,
  CancellationRefund,
  CancelledBy,
  Currency,
  DepartureStatus,
  PaymentModel,
  PricingModel,
  Prisma,
  Role,
  TourBookingType,
  WholeUnitType,
  type Booking,
  type BookingUnitItem,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { MailService } from '@/mail/mail.service';
import { TrackingService } from '@/tracking/tracking.service';
import { NotificationsService } from '@/notifications/notifications.service';
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
import type {
  BookingQuoteResponseDto,
  CancelBookingDto,
  ConfirmBookingDto,
  ExtendBookingDto,
  ListBookingsQueryDto,
  QuoteBookingDto,
  QuoteLineDto,
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
          pickupAddress: ctx.pickupAddress,
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

    await this.sendConfirmationEmail(updated, tour?.name ?? 'Your tour');
    if (commissionAmount != null) {
      await this.fireConversion(updated, tour?.name ?? null, commissionAmount);
    }
    return updated;
  }

  private async sendConfirmationEmail(
    booking: BookingWithItems,
    tourTitle: string,
  ): Promise<void> {
    if (!booking.contactEmail) return; // no recipient yet (e.g. OPERATOR_FULL before contact)
    const manageUrl =
      process.env.FRONTEND_URL && booking.island
        ? `${process.env.FRONTEND_URL}/${booking.island}/thank-you/${booking.publicRef}`
        : null;
    try {
      await this.mail.sendBookingConfirmationEmail(booking.contactEmail, {
        customerName: booking.contactFirstName,
        displayRef: booking.displayRef,
        tourTitle,
        localDate: dateKey(booking.localDate),
        startTime: booking.startTime,
        partySize: booking.unitItems.length,
        currency: booking.currency,
        totalRetail: booking.totalRetail.toString(),
        // OPERATOR_FULL takes no online payment (deposit shown as null); every other
        // model (incl. ON_ARRIVAL, now a deposit model) captures a deposit up front.
        depositPaid:
          booking.paymentModel === PaymentModel.OPERATOR_FULL
            ? null
            : booking.depositAmount.toString(),
        balanceDue: booking.balanceAmount.toString(),
        manageUrl,
      });
    } catch (err) {
      this.logger.error(
        `Confirmation email failed for ${booking.displayRef}`,
        err as Error,
      );
    }
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
   * Thank-you-page payload, keyed on the unguessable `publicRef` (the TYP token, so
   * this is public). Emits the `booking_complete` conversion object **only** for a
   * confirmed booking with a non-null EUR commission - otherwise `conversion: null`
   * so the frontend renders an error and fires nothing (rule #22).
   */
  async getThankYou(publicRef: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { publicRef },
      include: {
        unitItems: { select: { id: true } },
        tour: { select: { name: true } },
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

    return {
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
        include: { unitItems: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { total, page, limit, data: rows.map(mapBooking) };
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

    // Snapshot the selected pickup point address (booking immutability — the
    // PickupLocation row can change after booking). master E.8 `pickup_address`.
    let pickupAddress: string | null = null;
    if (dto.pickupLocationId) {
      const pickup = await this.prisma.pickupLocation.findUnique({
        where: { id: dto.pickupLocationId },
        select: { tourId: true, name: true, address: true },
      });
      if (!pickup || pickup.tourId !== dto.tourId) {
        throw new UnprocessableEntityException('Invalid pickupLocationId');
      }
      pickupAddress = pickup.address ?? pickup.name;
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
        pickupAddress,
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
      pickupAddress,
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
