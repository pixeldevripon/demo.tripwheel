// DEMO SEED - "Likely to sell out" demand-signal showcase (master §3.7).
//
// For each SHOWCASE_LIKELY_TO_SELL_OUT tour (one per live destination) this makes
// the GENUINE §3.7 conditions true, then runs the real evaluator
// (src/tours/demand-signal.ts - the same code the production recompute job uses)
// and writes the result to tour.likelyToSellOut. Nothing is forced: the badge
// lights up only because the data actually satisfies all three conditions:
//   1. tour age >= 90 days   (blueprint publishedDaysAgo: -100)
//   2. >= 3 sellouts in 60d  (3 past SOLD_OUT departures stamped soldOutAt)
//   3. < 40% availability over the next 30 days (upcoming departures fully booked)

import { DepartureSource, DepartureStatus } from '@prisma/client';

import { evaluateLikelyToSellOut } from '@/tours/demand-signal';

import { DEMO_TOUR_REF, dayOffset, log, prisma, section, timeOf, today } from './_shared';
import { SHOWCASE_LIKELY_TO_SELL_OUT } from './tours';

export async function seedDemandShowcase(): Promise<void> {
  section('Demand signal showcase (§3.7 "Likely to sell out")');

  const tours = await prisma.tour.findMany({
    where: { reference: DEMO_TOUR_REF, slug: { in: [...SHOWCASE_LIKELY_TO_SELL_OUT] } },
    select: { id: true, slug: true, startTimes: true, maxPartySize: true },
  });

  let flagged = 0;
  for (const tour of tours) {
    const cap = tour.maxPartySize ?? 20;
    const startStr = tour.startTimes[0] ?? '09:00';
    const startTime = timeOf(startStr);

    // 1+2. Three SOLD_OUT departures in the past 60 days (the sellout events).
    await prisma.departure.createMany({
      data: [-15, -35, -52].map((offset) => ({
        tourId: tour.id,
        date: dayOffset(offset),
        startTime,
        capacity: cap,
        bookedCount: cap,
        status: DepartureStatus.SOLD_OUT,
        soldOutAt: dayOffset(offset),
        source: DepartureSource.SCHEDULE,
      })),
      skipDuplicates: true,
    });

    // 3. Drive next-30-day availability to ~0 by filling every upcoming departure.
    const upcoming = await prisma.departure.findMany({
      where: { tourId: tour.id, date: { gte: today(), lte: dayOffset(30) } },
      select: { id: true, capacity: true },
    });
    for (const dep of upcoming) {
      await prisma.departure.update({
        where: { id: dep.id },
        data: { bookedCount: dep.capacity, status: DepartureStatus.SOLD_OUT, soldOutAt: today() },
      });
    }

    // Run the REAL evaluator and persist the computed signal (no manual override).
    const computed = await evaluateLikelyToSellOut(prisma, tour.id);
    await prisma.tour.update({ where: { id: tour.id }, data: { likelyToSellOut: computed } });
    if (computed) flagged++;
    log(`${tour.slug}: ${upcoming.length} upcoming departure(s) filled, likelyToSellOut=${computed}`);
  }

  log(`Demand showcase: ${flagged}/${tours.length} tour(s) now flagged "Likely to sell out".`);
}
