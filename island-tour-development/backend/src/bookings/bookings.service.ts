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
  AvailabilityStatus,
  BookingStatus,
  CancellationRefund,
  CancelledBy,
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
import { dateKey, localNow } from '@/common/utils/timezone.util';
import { eurFxRate } from '@/common/utils/fx.util';
import { computeAvailabilityStatus } from '@/availability/availability-status.util';
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
const BOOKABLE = [
  AvailabilityStatus.AVAILABLE,
  AvailabilityStatus.LIMITED,
  AvailabilityStatus.FREESALE,
];

type BookingWithItems = Booking & { unitItems: BookingUnitItem[] };

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly tracking: TrackingService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Fire the inventory + booking-status webhooks for a booking (fire-and-forget). */
  private emitBookingEvents(
    booking: Pick<
      Booking,
      'tourId' | 'optionId' | 'localDate' | 'operatorId' | 'publicRef'
    >,
    opts: { availability: boolean } = { availability: true },
  ): void {
    // A side-effect must never break the originating write — never let it throw.
    try {
      if (opts.availability) {
        this.notifications.emitAvailabilityUpdate({
          tourId: booking.tourId,
          optionId: booking.optionId,
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
  // Reserve (OCTO step 1) — atomic seat claim → ON_HOLD (or CONFIRMED for OPERATOR_FULL)
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
    if (now >= ctx.departure.utcCutoffAt) {
      throw new UnprocessableEntityException('Booking cutoff has passed for this departure');
    }

    const pricing = computeBookingPricing({
      lines: ctx.lines,
      addOns: ctx.addOnLines,
      currency: ctx.tour.defaultCurrency,
      paymentModel: ctx.tour.paymentModel,
      depositPct: ctx.tour.depositPct,
      commissionTier: ctx.tour.commissionTier,
    });
    const seats = pricing.pax;

    const operatorFull = ctx.tour.paymentModel === PaymentModel.OPERATOR_FULL;
    const localStart = ctx.departure.localDateTimeStart;

    const created = await this.prisma.$transaction(async (tx) => {
      // Atomic conditional decrement — the overbooking guard (master A1).
      const claim = await tx.departure.updateMany({
        where: {
          id: dto.departureId,
          tourId: dto.tourId,
          optionId: dto.optionId,
          status: { in: BOOKABLE },
          vacancies: { gte: seats },
        },
        data: { vacancies: { decrement: seats } },
      });
      if (claim.count === 0) {
        throw new UnprocessableEntityException('Not enough availability for this departure');
      }
      await this.recomputeDepartureStatus(tx, dto.departureId, now);

      const status = operatorFull ? BookingStatus.CONFIRMED : BookingStatus.ON_HOLD;
      return tx.booking.create({
        data: {
          id,
          tourId: dto.tourId,
          optionId: dto.optionId,
          departureId: dto.departureId,
          operatorId: ctx.tour.operatorId,
          userId: userId ?? null,
          displayRef: makeDisplayRef(id, localStart),
          status,
          paymentModel: ctx.tour.paymentModel,
          currency: ctx.tour.defaultCurrency,
          localDate: new Date(`${dateKey(localStart)}T00:00:00.000Z`),
          startTime: hhmm(localStart),
          island: ctx.tour.destination?.slug ?? null,
          utcExpiresAt: operatorFull
            ? null
            : new Date(Date.now() + (dto.expirationMinutes ?? DEFAULT_HOLD_MINUTES) * 60_000),
          utcConfirmedAt: operatorFull ? new Date() : null,
          pickupRequested: dto.pickupRequested ?? false,
          pickupLocationId: dto.pickupLocationId ?? null,
          notes: dto.notes ?? null,
          totalRetail: pricing.totalRetail,
          totalNet: pricing.totalNet,
          depositAmount: pricing.depositAmount,
          balanceAmount: pricing.balanceAmount,
          commissionRate: pricing.commissionRate,
          commissionAmount: pricing.commissionAmount,
          totalEur: pricing.totalEur,
          fxRateToEur: pricing.fxRateToEur,
          unitItems: {
            create: pricing.unitItems.map((u) => ({
              unitId: u.unitId,
              status,
              priceRetail: u.priceRetail,
              priceNet: u.priceNet,
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
  // Confirm (OCTO step 2) — ON_HOLD → CONFIRMED (payment lands in Phase 6)
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
  // Payment-driven confirmation — called by the Stripe webhook on success
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Settle a booking once its platform charge has succeeded. Transitions an
   * on-hold booking to CONFIRMED (a no-op if already confirmed), snapshots the
   * payment-method billing details (master G5), and finalizes the conversion.
   * Idempotent — safe for webhook redelivery.
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
  // Conversion finalization — EUR commission backfill + email + CAPI (fire once)
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
    if (booking.conversionFiredAt) return booking; // already fired — idempotent

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
    // data corruption — log loudly and do NOT fire a conversion with a bad value.
    if (commissionAmount == null) {
      this.logger.error(
        `Booking ${updated.displayRef} confirmed with null commissionAmount — conversion NOT fired (data corruption)`,
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
  // Cancel — release seats atomically + compute refund from the cancellation window
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
        await tx.departure.updateMany({
          where: { id: booking.departureId },
          data: { vacancies: { increment: seats } },
        });
        const tz = await this.tourTimeZone(tx, booking.tourId);
        await this.recomputeDepartureStatus(tx, booking.departureId, localNow(tz));
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
  // Hold-expiry sweeper — releases seats for lapsed ON_HOLD reservations
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
        optionId: true,
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
            await tx.departure.updateMany({
              where: { id: b.departureId },
              data: { vacancies: { increment: b._count.unitItems } },
            });
            const tz = await this.tourTimeZone(tx, b.tourId);
            await this.recomputeDepartureStatus(tx, b.departureId, localNow(tz));
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
   * confirmed booking with a non-null EUR commission — otherwise `conversion: null`
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
        `TYP for ${booking.displayRef}: confirmed booking has null commissionAmount — no conversion`,
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
        defaultCurrency: true,
        paymentModel: true,
        depositPct: true,
        commissionTier: true,
        minPartySize: true,
        maxPartySize: true,
        destination: { select: { slug: true } },
      },
    });
    if (!tour) throw new NotFoundException('Tour not found');

    const option = await this.prisma.tourOption.findFirst({
      where: { id: dto.optionId, tourId: dto.tourId, isActive: true },
      select: { id: true, minUnits: true, maxUnits: true },
    });
    if (!option) throw new UnprocessableEntityException('Invalid optionId for this tour');

    const departure = await this.prisma.departure.findFirst({
      where: { id: dto.departureId, tourId: dto.tourId, optionId: dto.optionId },
      select: { id: true, localDateTimeStart: true, utcCutoffAt: true },
    });
    if (!departure) throw new UnprocessableEntityException('Invalid departureId');

    const units = await this.prisma.tourUnit.findMany({
      where: { optionId: dto.optionId },
      select: {
        id: true,
        type: true,
        minQuantity: true,
        maxQuantity: true,
        accompaniedBy: true,
        priceRetail: true,
        priceNet: true,
      },
    });
    const unitsById = new Map(units.map((u) => [u.id, u]));

    const lines: PriceLineInput[] = dto.items.map((item) => {
      const unit = unitsById.get(item.unitId);
      if (!unit) throw new UnprocessableEntityException(`Invalid unitId ${item.unitId}`);
      return {
        unitId: unit.id,
        quantity: item.quantity,
        priceRetail: unit.priceRetail,
        priceNet: unit.priceNet,
      };
    });

    const addOnLines = await this.loadAddOns(dto);

    return { tour, option, departure, unitsById, lines, addOnLines };
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
    const minUnits = ctx.option.minUnits ?? ctx.tour.minPartySize;
    const maxUnits = ctx.option.maxUnits ?? ctx.tour.maxPartySize;
    if (seats < minUnits) {
      throw new UnprocessableEntityException(`Minimum party size is ${minUnits}`);
    }
    if (maxUnits != null && seats > maxUnits) {
      throw new UnprocessableEntityException(`Maximum party size is ${maxUnits}`);
    }

    const presentTypes = new Set(
      dto.items.map((i) => ctx.unitsById.get(i.unitId)?.type),
    );
    for (const item of dto.items) {
      const unit = ctx.unitsById.get(item.unitId);
      if (!unit) continue; // already validated in loadContext
      if (unit.minQuantity != null && item.quantity < unit.minQuantity) {
        throw new UnprocessableEntityException(
          `${unit.type}: minimum quantity is ${unit.minQuantity}`,
        );
      }
      if (unit.maxQuantity != null && item.quantity > unit.maxQuantity) {
        throw new UnprocessableEntityException(
          `${unit.type}: maximum quantity is ${unit.maxQuantity}`,
        );
      }
      for (const required of unit.accompaniedBy) {
        if (!presentTypes.has(required as never)) {
          throw new UnprocessableEntityException(
            `${unit.type} must be accompanied by ${required}`,
          );
        }
      }
    }
  }

  /** Recompute a departure's status after an inventory change (skip sticky overrides). */
  private async recomputeDepartureStatus(
    tx: Prisma.TransactionClient,
    departureId: string,
    now: Date,
  ): Promise<void> {
    const dep = await tx.departure.findUnique({
      where: { id: departureId },
      select: { vacancies: true, capacity: true, utcCutoffAt: true, status: true },
    });
    if (!dep) return;
    if (
      dep.status === AvailabilityStatus.FREESALE ||
      dep.status === AvailabilityStatus.CLOSED
    ) {
      return; // sticky operator overrides
    }
    const status = computeAvailabilityStatus({
      vacancies: dep.vacancies,
      capacity: dep.capacity,
      utcCutoffAt: dep.utcCutoffAt,
      now,
    });
    await tx.departure.update({
      where: { id: departureId },
      data: {
        status,
        ...(status === AvailabilityStatus.SOLD_OUT && { soldOutAt: new Date() }),
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

  private async tourTimeZone(
    tx: Prisma.TransactionClient,
    tourId: string,
  ): Promise<string> {
    const tour = await tx.tour.findUnique({
      where: { id: tourId },
      select: { timeZone: true },
    });
    return tour?.timeZone ?? 'America/Curacao';
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Pure mapping helpers
// ════════════════════════════════════════════════════════════════════════════

function dec(value: Prisma.Decimal | null): string | null {
  return value ? value.toString() : null;
}
function hhmm(date: Date): string {
  return date.toISOString().slice(11, 16);
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
    optionId: b.optionId,
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
      unitId: u.unitId,
      status: u.status,
      priceRetail: u.priceRetail.toString(),
    })),
  };
}
