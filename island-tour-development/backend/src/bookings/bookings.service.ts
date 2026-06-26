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
  DepartureStatus,
  PaymentModel,
  Prisma,
  Role,
  type Booking,
  type BookingUnitItem,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { MailService } from '@/mail/mail.service';
import { TrackingService } from '@/tracking/tracking.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { resolveOperatorId } from '@/common/utils/operator.util';
import { combineDateTime, dateKey, localNow, timeOfDay } from '@/common/utils/timezone.util';
import { eurFxRate } from '@/common/utils/fx.util';
import { storedStatusForFill } from '@/availability/availability-status.util';
import { TiersService } from '@/tiers/tiers.service';
import {
  computeBookingPricing,
  type AddOnLineInput,
  type PriceLineInput,
} from './booking-pricing.util';
import type {
  CancelBookingDto,
  ConfirmBookingDto,
  ExtendBookingDto,
  ListBookingsQueryDto,
  ReserveBookingDto,
  UpdateBookingDto,
} from './dto/booking.dto';

const DEFAULT_HOLD_MINUTES = 30;

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
  ) {}

  /** Fire the inventory + booking-status webhooks for a booking (fire-and-forget). */
  private emitBookingEvents(
    booking: Pick<
      Booking,
      'tourId' | 'localDate' | 'operatorId' | 'publicRef'
    >,
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
    this.validateRestrictions(ctx, dto);

    const now = localNow(ctx.tour.timeZone);
    // Cutoff is computed live (master §4): now >= start - bookingCutoffMinutes → closed.
    const localStart = combineDateTime(ctx.departure.date, ctx.departure.startTime);
    const cutoffAt = new Date(
      localStart.getTime() - ctx.tour.bookingCutoffMinutes * 60_000,
    );
    if (now >= cutoffAt) {
      throw new UnprocessableEntityException('Booking cutoff has passed for this departure');
    }

    // Effective commission: an ACTIVE Destination Spotlight overlays 35% over the tour's
    // tier rate (SPOTLIGHT-DATA.md §3). effectiveCommissionRate returns a fraction; the
    // pricing util expects a percentage. Snapshotted onto the booking, never retroactive.
    const effectiveRate = await this.tiers.effectiveCommissionRate(dto.tourId, now);
    const effectiveTier = new Prisma.Decimal(effectiveRate)
      .mul(100)
      .toDecimalPlaces(2);

    const pricing = computeBookingPricing({
      lines: ctx.lines,
      addOns: ctx.addOnLines,
      currency: ctx.tour.defaultCurrency,
      paymentModel: ctx.tour.paymentModel,
      depositPct: ctx.tour.depositPct,
      commissionTier: effectiveTier,
    });
    const seats = pricing.pax;

    // Per-seat traveler ages, expanded in the same order as pricing.unitItems
    // (one entry per seat, grouped by dto.items order). master child ages.
    const seatAges: (number | null)[] = [];
    for (const item of dto.items) {
      for (let i = 0; i < item.quantity; i++) {
        seatAges.push(item.travelerAge ?? null);
      }
    }

    // Full local end instant = local start + tour duration (master E.8 TYP time range).
    const tourEndDateTime =
      ctx.tour.durationMinutesFrom != null
        ? new Date(localStart.getTime() + ctx.tour.durationMinutesFrom * 60_000)
        : null;

    const operatorFull = ctx.tour.paymentModel === PaymentModel.OPERATOR_FULL;

    const created = await this.prisma.$transaction(async (tx) => {
      // Atomic guarded count-up - the overbooking backstop (master §5). Claims only an
      // OPEN departure with room, and flips it to SOLD_OUT (stamping soldOutAt) when full.
      const claimed = await tx.$executeRaw`
        UPDATE departures
           SET booked_count = booked_count + ${seats},
               status = CASE WHEN booked_count + ${seats} >= capacity
                             THEN 'sold_out'::departure_status ELSE status END,
               sold_out_at = CASE WHEN booked_count + ${seats} >= capacity AND sold_out_at IS NULL
                                  THEN now() ELSE sold_out_at END,
               updated_at = now()
         WHERE id = ${dto.departureId}
           AND tour_id = ${dto.tourId}
           AND status = 'open'::departure_status
           AND booked_count + ${seats} <= capacity`;
      if (claimed === 0) {
        throw new UnprocessableEntityException('Not enough availability for this departure');
      }

      const status = operatorFull ? BookingStatus.CONFIRMED : BookingStatus.ON_HOLD;
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
          currency: ctx.tour.defaultCurrency,
          localDate: ctx.departure.date,
          startTime: timeOfDay(ctx.departure.startTime),
          tourStartDateTime: localStart,
          tourEndDateTime,
          island: ctx.tour.destination?.slug ?? 'Curaçao',
          utcExpiresAt: operatorFull
            ? null
            : new Date(Date.now() + (dto.expirationMinutes ?? DEFAULT_HOLD_MINUTES) * 60_000),
          utcConfirmedAt: operatorFull ? new Date() : null,
          pickupRequested: dto.pickupRequested ?? false,
          pickupLocationId: dto.pickupLocationId ?? null,
          pickupAddress: ctx.pickupAddress,
          notes: dto.notes ?? null,
          newsletterOptIn: dto.newsletterOptIn ?? false,
          couponCode: dto.couponCode ?? null,
          discountAmount: dto.discountAmount != null ? new Prisma.Decimal(dto.discountAmount) : null,
          totalRetail: pricing.totalRetail,
          totalNet: pricing.totalNet,
          depositAmount: pricing.depositAmount,
          balanceAmount: pricing.balanceAmount,
          commissionRate: pricing.commissionRate,
          commissionAmount: pricing.commissionAmount,
          totalEur: pricing.totalEur,
          fxRateToEur: pricing.fxRateToEur,
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
      booking.totalRetail.mul(fxRate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const commissionAmount =
      booking.commissionAmount ??
      (booking.commissionRate
        ? totalEur.mul(booking.commissionRate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
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
        depositPaid:
          booking.paymentModel === PaymentModel.ON_ARRIVAL ||
          booking.paymentModel === PaymentModel.OPERATOR_FULL
            ? null
            : booking.depositAmount.toString(),
        balanceDue: booking.balanceAmount.toString(),
        manageUrl,
      });
    } catch (err) {
      this.logger.error(`Confirmation email failed for ${booking.displayRef}`, err as Error);
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
      eventTimeSec: Math.floor((booking.utcConfirmedAt ?? new Date()).getTime() / 1000),
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // Cancel - release seats atomically + compute refund from the cancellation window
  // ════════════════════════════════════════════════════════════════════════

  async cancel(id: string, dto: CancelBookingDto, actor?: { id: string; role: Role }) {
    const booking = await this.loadOr404(id);
    if (booking.status === BookingStatus.CANCELLED) return mapBooking(booking);
    if (
      booking.status === BookingStatus.EXPIRED ||
      booking.status === BookingStatus.REDEEMED
    ) {
      throw new ConflictException(`Cannot cancel a ${booking.status} booking`);
    }

    const refund = await this.computeRefund(booking, dto.force ?? false);
    const seats = booking.unitItems.length;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (booking.departureId) {
        await this.releaseSeats(tx, booking.departureId, seats);
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
          cancellationRefund: refund,
          cancelledBy: actorToCancelledBy(actor?.role),
          cancellationReason: dto.reason ?? null,
        },
        include: { unitItems: true },
      });
    });
    this.logger.log(`Booking ${updated.displayRef} cancelled (refund ${refund})`);
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
        _count: { select: { unitItems: true } },
      },
    });

    let expired = 0;
    for (const b of stale) {
      try {
        await this.prisma.$transaction(async (tx) => {
          if (b.departureId) {
            await this.releaseSeats(tx, b.departureId, b._count.unitItems);
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
      tourStartDateTime: booking.tourStartDateTime
        ? booking.tourStartDateTime.toISOString()
        : null,
      tourEndDateTime: booking.tourEndDateTime
        ? booking.tourEndDateTime.toISOString()
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
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.BookingWhereInput = {};

    if (actor.role === Role.ADMIN) {
      // no scope restriction
    } else if (actor.role === Role.TOUR_OPERATOR) {
      where.operatorId = await resolveOperatorId(this.prisma, actor.id, actor.role);
    } else {
      where.userId = actor.id;
    }

    if (query.tourId) where.tourId = query.tourId;
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.localDate = {};
      if (query.from) where.localDate.gte = new Date(`${query.from}T00:00:00.000Z`);
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
      const operatorId = await resolveOperatorId(this.prisma, actor.id, actor.role);
      if (booking.operatorId === operatorId) return;
    }
    if (booking.userId && booking.userId === actor.id) return;
    throw new ForbiddenException('You do not have access to this booking');
  }

  private async loadContext(dto: ReserveBookingDto) {
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
        destination: { select: { slug: true } },
      },
    });
    if (!tour) throw new NotFoundException('Tour not found');

    const departure = await this.prisma.departure.findFirst({
      where: { id: dto.departureId, tourId: dto.tourId },
      select: { id: true, date: true, startTime: true },
    });
    if (!departure) throw new UnprocessableEntityException('Invalid departureId');

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

    const ageBands = await this.prisma.tourAgeBand.findMany({
      where: { tourId: dto.tourId },
      select: { id: true, label: true, price: true, priceNet: true },
    });
    const ageBandsById = new Map(ageBands.map((b) => [b.id, b]));

    const lines: PriceLineInput[] = dto.items.map((item) => {
      const band = ageBandsById.get(item.ageBandId);
      if (!band) {
        throw new UnprocessableEntityException(`Invalid ageBandId ${item.ageBandId}`);
      }
      return {
        ageBandId: band.id,
        quantity: item.quantity,
        priceRetail: band.price,
        priceNet: band.priceNet,
      };
    });

    const addOnLines = await this.loadAddOns(dto);

    return { tour, departure, ageBandsById, lines, addOnLines, pickupAddress };
  }

  private async loadAddOns(dto: ReserveBookingDto): Promise<AddOnLineInput[]> {
    if (!dto.addOns?.length) return [];
    const ids = dto.addOns.map((a) => a.addOnId);
    const rows = await this.prisma.tourAddOn.findMany({
      where: { id: { in: ids }, tourId: dto.tourId, isActive: true },
      select: { id: true, name: true, unit: true, price: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return dto.addOns.map((a) => {
      const row = byId.get(a.addOnId);
      if (!row) throw new UnprocessableEntityException(`Invalid addOnId ${a.addOnId}`);
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
    dto: ReserveBookingDto,
  ): void {
    const seats = dto.items.reduce((s, i) => s + i.quantity, 0);
    const minUnits = ctx.tour.minPartySize;
    const maxUnits = ctx.tour.maxPartySize;
    if (seats < minUnits) {
      throw new UnprocessableEntityException(`Minimum party size is ${minUnits}`);
    }
    if (maxUnits != null && seats > maxUnits) {
      throw new UnprocessableEntityException(`Maximum party size is ${maxUnits}`);
    }

    // Min-age enforcement (master child ages): reject any supplied traveler age below
    // the tour minimum. Ages are optional, so only enforced when both sides are present.
    const minAge = ctx.tour.minAgeYears;
    if (minAge != null) {
      for (const item of dto.items) {
        if (item.travelerAge != null && item.travelerAge < minAge) {
          throw new UnprocessableEntityException(
            `Travelers must be at least ${minAge} years old for this tour`,
          );
        }
      }
    }
  }

  /**
   * Release `seats` back to a departure (cancel / expiry) and re-derive its stored
   * status. The count-down is clamped at zero; a SOLD_OUT departure with room reopens to
   * OPEN, while CLOSED/CANCELLED stay sticky and `soldOutAt` history is preserved (§3).
   */
  private async releaseSeats(
    tx: Prisma.TransactionClient,
    departureId: string,
    seats: number,
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE departures
         SET booked_count = GREATEST(0, booked_count - ${seats}), updated_at = now()
       WHERE id = ${departureId}`;
    await this.recomputeStoredStatus(tx, departureId);
  }

  /** Re-derive OPEN/SOLD_OUT from the fill; leave sticky CLOSED/CANCELLED untouched. */
  private async recomputeStoredStatus(
    tx: Prisma.TransactionClient,
    departureId: string,
  ): Promise<void> {
    const dep = await tx.departure.findUnique({
      where: { id: departureId },
      select: { capacity: true, bookedCount: true, status: true, soldOutAt: true },
    });
    if (!dep) return;
    if (dep.status === DepartureStatus.CLOSED || dep.status === DepartureStatus.CANCELLED) {
      return; // sticky operator/admin states
    }
    const next = storedStatusForFill(dep.capacity, dep.bookedCount);
    if (next === dep.status) return;
    await tx.departure.update({
      where: { id: departureId },
      data: {
        status: next,
        ...(next === DepartureStatus.SOLD_OUT && dep.soldOutAt == null && {
          soldOutAt: new Date(),
        }),
      },
    });
  }

  private async computeRefund(
    booking: BookingWithItems,
    force: boolean,
  ): Promise<CancellationRefund> {
    if (force) return CancellationRefund.FULL;
    // On-hold bookings never took payment → nothing to refund.
    if (booking.status === BookingStatus.ON_HOLD) return CancellationRefund.NONE;

    const tour = await this.prisma.tour.findUnique({
      where: { id: booking.tourId },
      select: { cancellationHours: true, timeZone: true },
    });
    if (!tour) return CancellationRefund.NONE;

    const now = localNow(tour.timeZone);
    const departureStart = new Date(
      `${dateKey(booking.localDate)}T${(booking.startTime ?? '00:00')}:00.000Z`,
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
