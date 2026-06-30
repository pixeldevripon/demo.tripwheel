// DEMO SEED — bookings (across the full lifecycle) + their unit items, add-ons,
// and payments. Pricing mirrors src/bookings/booking-pricing.util.ts exactly:
// deposit/balance split by payment model, EUR-normalized commission snapshot
// (never null on confirmed/redeemed — master rule #22).

import { randomUUID } from 'node:crypto';
import {
  AddOnUnit,
  AgeBandType,
  BandParticipation,
  BookingStatus,
  CancellationRefund,
  CancelledBy,
  Currency,
  DepartureStatus,
  PaymentKind,
  PaymentModel,
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import {
  D,
  DEMO_TOUR_REF,
  dateAt,
  eurFxRate,
  intBetween,
  log,
  makeDisplayRef,
  money,
  pick,
  prisma,
  rng,
  section,
} from './_shared';
import { loadDemoTravelers } from './users-operators';
import { SHOWCASE_MOST_POPULAR, SHOWCASE_NEW } from './tours';

// ── Pricing (mirror computeBookingPricing) ───────────────────────────────────────
interface Line { ageBandId: string; quantity: number; priceRetail: Prisma.Decimal }
interface AddOnLine { addOnId: string; name: string; unit: AddOnUnit; quantity: number; unitPrice: Prisma.Decimal }

function computePricing(input: {
  lines: Line[];
  addOns: AddOnLine[];
  currency: Currency;
  paymentModel: PaymentModel;
  depositPct: Prisma.Decimal;
  commissionTier: Prisma.Decimal;
  discount?: Prisma.Decimal;
}) {
  const { lines, addOns, currency, paymentModel, depositPct, commissionTier } = input;
  const pax = lines.reduce((s, l) => s + l.quantity, 0);

  let unitsRetail = D(0);
  for (const l of lines) unitsRetail = unitsRetail.plus(l.priceRetail.times(l.quantity));

  const expandedAddOns = addOns.map((a) => {
    const multiplier = a.unit === AddOnUnit.PER_PERSON ? a.quantity * pax : a.quantity;
    return { ...a, totalPrice: money(a.unitPrice.times(multiplier)) };
  });
  const addOnsRetail = expandedAddOns.reduce((s, a) => s.plus(a.totalPrice), D(0));

  const discount = input.discount ?? D(0);
  const totalRetail = money(unitsRetail.plus(addOnsRetail).minus(discount));

  let depositAmount: Prisma.Decimal;
  let balanceAmount: Prisma.Decimal;
  switch (paymentModel) {
    case PaymentModel.PAID_IN_FULL:
      depositAmount = totalRetail;
      balanceAmount = money(0);
      break;
    case PaymentModel.OPERATOR_LINK:
      depositAmount = money(totalRetail.times(depositPct).dividedBy(100));
      balanceAmount = money(totalRetail.minus(depositAmount));
      break;
    default: // ON_ARRIVAL | OPERATOR_FULL
      depositAmount = money(0);
      balanceAmount = totalRetail;
  }

  const commissionRate = commissionTier.dividedBy(100).toDecimalPlaces(4);
  const fxRateToEur = eurFxRate(currency);
  const totalEur = money(totalRetail.times(fxRateToEur));
  const commissionAmount = money(totalEur.times(commissionRate));

  return { pax, totalRetail, depositAmount, balanceAmount, commissionRate, commissionAmount, totalEur, fxRateToEur, expandedAddOns };
}

function hhmm(time: Date): string {
  return `${String(time.getUTCHours()).padStart(2, '0')}:${String(time.getUTCMinutes()).padStart(2, '0')}`;
}

const PAX_PATTERNS: AgeBandType[][] = [
  [AgeBandType.ADULT, AgeBandType.ADULT],
  [AgeBandType.ADULT, AgeBandType.ADULT, AgeBandType.CHILD],
  [AgeBandType.ADULT],
  [AgeBandType.ADULT, AgeBandType.ADULT, AgeBandType.CHILD, AgeBandType.CHILD],
  [AgeBandType.ADULT, AgeBandType.ADULT, AgeBandType.SENIOR],
];

const UTM_SOURCES = ['google', 'meta', 'newsletter', 'tripadvisor', null];

export async function seedBookingsAndPayments(): Promise<void> {
  section('Bookings + payments');

  const travelers = await loadDemoTravelers();
  if (travelers.length === 0) {
    log('No demo travelers — skipping bookings.');
    return;
  }
  const alreadySeeded = await prisma.booking.count({ where: { tour: { reference: DEMO_TOUR_REF } } });
  if (alreadySeeded > 0) {
    log(`Bookings already seeded (${alreadySeeded}) — skipping (run :clean first to rebuild).`);
    return;
  }

  const tours = await prisma.tour.findMany({
    where: { reference: DEMO_TOUR_REF },
    select: {
      id: true,
      slug: true,
      operatorId: true,
      defaultCurrency: true,
      paymentModel: true,
      depositPct: true,
      commissionTier: true,
      durationMinutesTo: true,
      durationMinutesFrom: true,
      pickupModel: true,
      destination: { select: { slug: true, name: true } },
      ageBands: { select: { id: true, bandType: true, price: true, label: true } },
      addOns: { select: { id: true, name: true, unit: true, price: true } },
      pickupLocations: { select: { id: true, address: true }, take: 1 },
    },
  });

  let bookingCount = 0;
  let paymentCount = 0;
  const perOperator = new Map<string, { total: number; cancelled: number }>();

  for (const [tIdx, tour] of tours.entries()) {
    const r = rng(1000 + tIdx);
    const adultBand = tour.ageBands.find((b) => b.bandType === AgeBandType.ADULT) ?? tour.ageBands[0];
    if (!adultBand) continue;

    // Past departures (for completed bookings) and future departures (upcoming/on-hold).
    const today0 = new Date();
    const [pastDeps, futureDeps] = await Promise.all([
      prisma.departure.findMany({ where: { tourId: tour.id, date: { lt: today0 } }, orderBy: { date: 'desc' }, take: 10, select: { id: true, date: true, startTime: true, capacity: true, bookedCount: true } }),
      prisma.departure.findMany({ where: { tourId: tour.id, date: { gte: today0 } }, orderBy: { date: 'asc' }, take: 10, select: { id: true, date: true, startTime: true, capacity: true, bookedCount: true } }),
    ]);

    // Plan: 4 past REDEEMED (reviewable), 1 upcoming CONFIRMED, 1 ON_HOLD,
    // plus a CANCELLED on every 2nd tour and an EXPIRED on every 3rd.
    type Plan = { status: BookingStatus; when: 'past' | 'future' };
    const plans: Plan[] = [
      { status: BookingStatus.REDEEMED, when: 'past' },
      { status: BookingStatus.REDEEMED, when: 'past' },
      { status: BookingStatus.REDEEMED, when: 'past' },
      { status: BookingStatus.REDEEMED, when: 'past' },
      { status: BookingStatus.CONFIRMED, when: 'future' },
      { status: BookingStatus.ON_HOLD, when: 'future' },
    ];
    if (tIdx % 2 === 0) plans.push({ status: BookingStatus.CANCELLED, when: 'past' });
    if (tIdx % 3 === 0) plans.push({ status: BookingStatus.EXPIRED, when: 'future' });

    // Badge showcase (master §3.6): a NEW tour must have ZERO reviews, so it gets no
    // bookings; a MOST_POPULAR tour needs >= 10 reviews, so it gets ~14 redeemed
    // (one review each, minus a couple held back by moderation in seedReviews).
    if (SHOWCASE_NEW.has(tour.slug)) {
      plans.length = 0;
    } else if (SHOWCASE_MOST_POPULAR.has(tour.slug)) {
      for (let k = 0; k < 10; k++) plans.push({ status: BookingStatus.REDEEMED, when: 'past' });
    }

    let pastCursor = 0;
    let futureCursor = 0;

    for (const [bIdx, plan] of plans.entries()) {
      const depPool = plan.when === 'past' ? pastDeps : futureDeps;
      if (depPool.length === 0) continue;
      const dep = plan.when === 'past' ? depPool[pastCursor++ % depPool.length] : depPool[futureCursor++ % depPool.length];
      const traveler = pick(travelers, r());
      const [firstName, ...rest] = (traveler.name ?? 'Guest Traveler').split(' ');
      const lastName = rest.join(' ') || 'Traveler';

      // Build lines from a pax pattern, restricted to bands the tour actually has.
      const pattern = pick(PAX_PATTERNS, r());
      const counts = new Map<string, { band: typeof adultBand; qty: number }>();
      for (const bt of pattern) {
        const band = tour.ageBands.find((b) => b.bandType === bt) ?? adultBand;
        const cur = counts.get(band.id);
        if (cur) cur.qty++;
        else counts.set(band.id, { band, qty: 1 });
      }
      const lines: Line[] = [...counts.values()].map((c) => ({ ageBandId: c.band.id, quantity: c.qty, priceRetail: c.band.price }));
      const seats = lines.reduce((s, l) => s + l.quantity, 0);

      // Optional single add-on.
      const addOns: AddOnLine[] = [];
      if (tour.addOns.length && r() > 0.5) {
        const a = pick(tour.addOns, r());
        addOns.push({ addOnId: a.id, name: a.name, unit: a.unit, quantity: 1, unitPrice: a.price });
      }

      // Optional coupon (10% off) on some bookings.
      const useCoupon = r() > 0.8;
      const subtotalForDiscount = lines.reduce((s, l) => s.plus(l.priceRetail.times(l.quantity)), D(0));
      const discount = useCoupon ? money(subtotalForDiscount.times(0.1)) : D(0);

      const pricing = computePricing({
        lines,
        addOns,
        currency: tour.defaultCurrency,
        paymentModel: tour.paymentModel,
        depositPct: tour.depositPct,
        commissionTier: tour.commissionTier,
        discount,
      });

      const id = randomUUID();
      const localDate = dep.date;
      const startStr = hhmm(dep.startTime);
      const startDateTime = dateAt(localDate, startStr);
      const durTo = tour.durationMinutesTo ?? tour.durationMinutesFrom ?? 120;
      const endDateTime = new Date(startDateTime.getTime() + durTo * 60_000);
      const year = localDate.getUTCFullYear();

      const isConfirmedLike = plan.status === BookingStatus.CONFIRMED || plan.status === BookingStatus.REDEEMED;
      const isCancelled = plan.status === BookingStatus.CANCELLED;
      const usesCardPayment = tour.paymentModel === PaymentModel.PAID_IN_FULL || tour.paymentModel === PaymentModel.OPERATOR_LINK;

      const confirmedAt = plan.when === 'past' ? new Date(startDateTime.getTime() - 3 * 86_400_000) : new Date(today0.getTime() - intBetween(r(), 1, 10) * 86_400_000);

      const utm = pick(UTM_SOURCES, r());

      const booking = await prisma.booking.create({
        data: {
          id,
          tourId: tour.id,
          departureId: dep.id,
          operatorId: tour.operatorId,
          userId: traveler.id,
          displayRef: makeDisplayRef(id, year),
          supplierReference: `SUP-${tour.slug.slice(0, 6).toUpperCase()}-${bIdx + 1}`,
          status: plan.status,
          paymentModel: tour.paymentModel,
          currency: tour.defaultCurrency,
          localDate,
          startTime: startStr,
          tourStartDateTime: startDateTime,
          tourEndDateTime: endDateTime,
          pickupRequested: tour.pickupModel !== 'NONE' && r() > 0.5,
          pickupLocationId: tour.pickupLocations[0]?.id ?? null,
          pickupAddress: tour.pickupLocations[0]?.address ?? null,
          totalRetail: pricing.totalRetail,
          commissionRate: pricing.commissionRate,
          commissionAmount: pricing.commissionAmount,
          depositAmount: pricing.depositAmount,
          balanceAmount: pricing.balanceAmount,
          taxes: [],
          couponCode: useCoupon ? 'ISLAND10' : null,
          discountAmount: useCoupon ? discount : null,
          totalEur: pricing.totalEur,
          fxRateToEur: pricing.fxRateToEur,
          contactFirstName: firstName,
          contactLastName: lastName,
          contactFullName: traveler.name,
          contactEmail: traveler.email,
          contactPhone: '+10000000000',
          contactCountry: traveler.location ?? 'Netherlands',
          contactLocales: ['en'],
          notes: r() > 0.7 ? 'Celebrating an anniversary — any extra touches appreciated!' : null,
          newsletterOptIn: r() > 0.5,
          utmSource: utm ?? undefined,
          utmMedium: utm ? 'cpc' : undefined,
          utmCampaign: utm ? 'summer-2026' : undefined,
          island: tour.destination.slug,
          customerLocale: 'en',
          conversionFiredAt: isConfirmedLike ? confirmedAt : null,
          utcConfirmedAt: isConfirmedLike ? confirmedAt : null,
          utcRedeemedAt: plan.status === BookingStatus.REDEEMED ? new Date(endDateTime.getTime() + 3_600_000) : null,
          utcExpiresAt: plan.status === BookingStatus.ON_HOLD ? new Date(today0.getTime() + 30 * 60_000) : null,
          utcCancelledAt: isCancelled ? new Date(confirmedAt.getTime() + 86_400_000) : null,
          cancellationRefund: isCancelled ? CancellationRefund.FULL : null,
          cancelledBy: isCancelled ? CancelledBy.CUSTOMER : null,
          cancellationReason: isCancelled ? 'Change of travel plans' : null,
          billingCountry: usesCardPayment && isConfirmedLike ? (traveler.location ?? 'Netherlands') : null,
          paymentMethodBrand: usesCardPayment && isConfirmedLike ? 'visa' : null,
          paymentMethodLast4: usesCardPayment && isConfirmedLike ? '4242' : null,
          unitItems: {
            create: lines.flatMap((l) =>
              Array.from({ length: l.quantity }, () => ({
                status: plan.status,
                ageBandId: l.ageBandId,
                priceRetail: l.priceRetail,
                contactFirstName: firstName,
                contactLastName: lastName,
                ticketCode: plan.status === BookingStatus.REDEEMED ? `TKT-${randomUUID().slice(0, 8).toUpperCase()}` : null,
                utcRedeemedAt: plan.status === BookingStatus.REDEEMED ? new Date(endDateTime.getTime() + 3_600_000) : null,
              })),
            ),
          },
          addOns: {
            create: pricing.expandedAddOns.map((a) => ({ addOnId: a.addOnId, name: a.name, unit: a.unit, quantity: a.quantity, unitPrice: a.unitPrice, totalPrice: a.totalPrice })),
          },
        },
        select: { id: true },
      });
      bookingCount++;

      // Seats consume departure capacity for live holds/confirmations/redemptions.
      if (plan.status === BookingStatus.ON_HOLD || isConfirmedLike) {
        const newBooked = dep.bookedCount + seats;
        await prisma.departure.update({
          where: { id: dep.id },
          data: {
            bookedCount: { increment: seats },
            status: newBooked >= dep.capacity ? DepartureStatus.SOLD_OUT : undefined,
            soldOutAt: newBooked >= dep.capacity ? new Date() : undefined,
          },
        });
        dep.bookedCount = newBooked;
      }

      // ── Payments ──
      if (isConfirmedLike) {
        if (tour.paymentModel === PaymentModel.PAID_IN_FULL) {
          await prisma.payment.create({ data: { bookingId: booking.id, provider: PaymentProvider.STRIPE, kind: PaymentKind.FULL, status: PaymentStatus.SUCCEEDED, amount: pricing.totalRetail, currency: tour.defaultCurrency, intentId: `pi_demo_${booking.id.slice(0, 12)}`, chargeId: `ch_demo_${booking.id.slice(0, 12)}`, methodType: 'card' } });
          paymentCount++;
        } else if (tour.paymentModel === PaymentModel.OPERATOR_LINK) {
          await prisma.payment.create({ data: { bookingId: booking.id, provider: PaymentProvider.STRIPE, kind: PaymentKind.DEPOSIT, status: PaymentStatus.SUCCEEDED, amount: pricing.depositAmount, currency: tour.defaultCurrency, intentId: `pi_demo_${booking.id.slice(0, 12)}`, chargeId: `ch_demo_${booking.id.slice(0, 12)}`, methodType: 'card' } });
          paymentCount++;
        }
        // ON_ARRIVAL / OPERATOR_FULL: no platform payment.
      } else if (isCancelled && usesCardPayment) {
        const refundBase = tour.paymentModel === PaymentModel.PAID_IN_FULL ? pricing.totalRetail : pricing.depositAmount;
        await prisma.payment.create({ data: { bookingId: booking.id, provider: PaymentProvider.STRIPE, kind: PaymentKind.FULL, status: PaymentStatus.REFUNDED, amount: refundBase, currency: tour.defaultCurrency, intentId: `pi_demo_${booking.id.slice(0, 12)}`, chargeId: `ch_demo_${booking.id.slice(0, 12)}`, methodType: 'card' } });
        await prisma.payment.create({ data: { bookingId: booking.id, provider: PaymentProvider.STRIPE, kind: PaymentKind.REFUND, status: PaymentStatus.REFUNDED, amount: refundBase, currency: tour.defaultCurrency, refundId: `re_demo_${booking.id.slice(0, 12)}`, methodType: 'card' } });
        paymentCount += 2;
      }

      // Operator booking tallies.
      const agg = perOperator.get(tour.operatorId) ?? { total: 0, cancelled: 0 };
      if (!isCancelled && plan.status !== BookingStatus.EXPIRED) agg.total++;
      if (isCancelled) agg.cancelled++;
      perOperator.set(tour.operatorId, agg);
    }

    // CRO counters on the tour.
    const liveCount = await prisma.booking.count({ where: { tourId: tour.id, status: { in: [BookingStatus.CONFIRMED, BookingStatus.REDEEMED] } } });
    const last = await prisma.booking.findFirst({ where: { tourId: tour.id }, orderBy: { createdAt: 'desc' }, select: { utcConfirmedAt: true, createdAt: true } });
    await prisma.tour.update({ where: { id: tour.id }, data: { bookingCount: liveCount, lastBookedAt: last?.utcConfirmedAt ?? last?.createdAt ?? null } });
  }

  // Operator aggregates.
  for (const [operatorId, agg] of perOperator) {
    const denom = agg.total + agg.cancelled;
    const rate = denom > 0 ? money((agg.cancelled / denom) * 100) : money(0);
    await prisma.operator.update({ where: { id: operatorId }, data: { totalBookings: agg.total, cancellationRate90d: rate } });
  }

  // A couple of idempotent webhook ledger rows (provider replay no-ops).
  await prisma.stripeWebhookEvent.upsert({
    where: { id: 'evt_demo_payment_intent_succeeded' },
    update: {},
    create: { id: 'evt_demo_payment_intent_succeeded', type: 'payment_intent.succeeded', processedAt: new Date(), payload: { demo: true, object: 'event' } },
  });
  await prisma.mollieWebhookEvent.upsert({
    where: { id: 'tr_demo_payment' },
    update: {},
    create: { id: 'tr_demo_payment', type: 'payment', processedAt: new Date(), payload: { demo: true, id: 'tr_demo_payment' } },
  });

  log(`Bookings: ${bookingCount} created; Payments: ${paymentCount} + 2 webhook ledger rows.`);
}
