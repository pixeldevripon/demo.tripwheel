/**
 * Demand signal - master §3.7 "Demand signaling: one trigger" (confirmed
 * June 10, 2026). ONE algorithm powers both the listing-card "Likely to sell out"
 * badge and the tour-page demand card. All three conditions must hold, evaluated
 * daily:
 *
 *   1. tour_age_days >= 90
 *   2. recent_sellouts >= 3 in the past 60 days   (departures.sold_out_at, E.9,
 *      plus operator date closures - one event per bulk blackout)
 *   3. upcoming_availability_ratio < 0.40 over the next 30 days
 *
 * A manual CMS override (`tour.likelyToSellOutOverride`) exists for the launch
 * phase (no tour has 90 days of history at launch) and wins over the computed
 * value; it is removed once organic data accrues. Expected coverage ~5-10% of
 * catalog - selectivity is the feature.
 *
 * This module is the single source of truth: the production recompute job
 * (ToursService.recomputeLikelyToSellOut) and the demo seed both call
 * `evaluateLikelyToSellOut`, so they can never drift.
 *
 * Companion doc: technical-doc/03-implementation/TOUR-BADGES.md.
 */
import {
  AvailabilityExceptionType,
  ClosureReason,
  DepartureStatus,
} from '@prisma/client';

import type { PrismaService } from '@/prisma/prisma.service';

export const DEMAND_MIN_AGE_DAYS = 90;
export const DEMAND_MIN_SELLOUTS_60D = 3;
export const DEMAND_SELLOUT_WINDOW_DAYS = 60;
export const DEMAND_AVAILABILITY_WINDOW_DAYS = 30;
export const DEMAND_MAX_AVAILABILITY_RATIO = 0.4;

const DAY_MS = 86_400_000;

/** Midnight UTC of `d` - departures are stored as `@db.Date`. */
function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

/** The Prisma surface `evaluateLikelyToSellOut` needs - small enough that both
 *  the NestJS service and the standalone demo seed can pass their own client. */
type DemandPrisma = Pick<
  PrismaService,
  'tour' | 'departure' | 'availabilityException'
>;

/**
 * Sell-out EVENTS for a tour in the window. A departure counts in two cases,
 * and both feed the same number (client clarification, Aug 7 2026):
 *
 *  1. it fills to capacity with us - `departures.sold_out_at`;
 *  2. the operator closes the date AND SAYS IT SOLD OUT, which is how a sell-out
 *     on the operator's own channels reaches us - a whole-day CLOSE_DATE
 *     exception carrying `closureReason: SOLD_OUT`.
 *
 * A "Not running" close is evidence of a day off, weather or maintenance -
 * the opposite of demand - so it does not count (mck-15 §4: "An
 * operator-marked sold out counts; a Not running does not"). Neither does a
 * closure written before reasons existed: an unexplained close cannot be read
 * as a sell-out without inventing the operator's intent, and the alternative -
 * counting them all - is what puts a scarcity badge on a tour that shut for a
 * fortnight's maintenance.
 *
 * A bulk blackout is ONE operator action however many dates it spans, so rows
 * sharing a `closureBatchId` collapse to a single event. Counting per closed
 * date would let one two-week haul-out clear the 3-event bar by itself and put
 * a scarcity badge on a tour that is not scarce at all.
 *
 * The closure is counted at the moment the operator acted (`createdAt`), not by
 * the date closed: that mirrors `soldOutAt`, and a closure written for a date
 * six months out is still evidence about demand today.
 */
async function countRecentSellouts(
  prisma: DemandPrisma,
  tourId: string,
  windowStart: Date,
  now: Date,
): Promise<number> {
  const [filledWithUs, closures] = await Promise.all([
    prisma.departure.count({
      where: { tourId, soldOutAt: { gte: windowStart, lte: now } },
    }),
    prisma.availabilityException.findMany({
      where: {
        tourId,
        type: AvailabilityExceptionType.CLOSE_DATE,
        closureReason: ClosureReason.SOLD_OUT,
        createdAt: { gte: windowStart, lte: now },
      },
      select: { id: true, closureBatchId: true },
    }),
  ]);
  // A null batch id is a one-date closure - its own event, so it keys on the
  // row id and can never merge with another.
  const closureEvents = new Set(closures.map((c) => c.closureBatchId ?? c.id))
    .size;
  return filledWithUs + closureEvents;
}

/**
 * Returns the COMPUTED §3.7 demand signal for a tour (ignores the manual
 * override - the caller applies `override ?? computed`). A minimal Prisma client
 * surface is accepted so both the NestJS service and the standalone demo seed can
 * pass their own instance.
 */
export async function evaluateLikelyToSellOut(
  prisma: DemandPrisma,
  tourId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const tour = await prisma.tour.findUnique({
    where: { id: tourId },
    select: { firstPublishedAt: true, publishedAt: true },
  });
  if (!tour) return false;

  // 1. Tour age >= 90 days (first publish is the true age; fall back to publishedAt).
  const since = tour.firstPublishedAt ?? tour.publishedAt;
  if (!since) return false;
  const ageDays = (now.getTime() - since.getTime()) / DAY_MS;
  if (ageDays < DEMAND_MIN_AGE_DAYS) return false;

  // 2. >= 3 sellouts in the past 60 days - departures that filled with us, plus
  //    operator date closures (one per bulk blackout). See countRecentSellouts.
  const windowStart = new Date(
    now.getTime() - DEMAND_SELLOUT_WINDOW_DAYS * DAY_MS,
  );
  const recentSellouts = await countRecentSellouts(
    prisma,
    tourId,
    windowStart,
    now,
  );
  if (recentSellouts < DEMAND_MIN_SELLOUTS_60D) return false;

  // 3. Upcoming availability ratio < 0.40 over the next 30 days. Ratio = remaining
  //    seats / total capacity across REAL DEPARTURES in the window - never
  //    calendar days, so a tour that sails three days a week is not judged on
  //    the four it does not sail.
  const today = startOfUtcDay(now);
  const horizon = new Date(
    today.getTime() + DEMAND_AVAILABILITY_WINDOW_DAYS * DAY_MS,
  );
  const upcoming = await prisma.departure.findMany({
    where: {
      tourId,
      date: { gte: today, lte: horizon },
      status: { not: DepartureStatus.CANCELLED },
    },
    select: { capacity: true, bookedCount: true },
  });
  if (upcoming.length === 0) return false; // no schedule ahead - not a sellout signal

  let totalCapacity = 0;
  let remaining = 0;
  for (const d of upcoming) {
    totalCapacity += d.capacity;
    remaining += Math.max(0, d.capacity - d.bookedCount);
  }
  if (totalCapacity === 0) return false;
  const availabilityRatio = remaining / totalCapacity;

  return availabilityRatio < DEMAND_MAX_AVAILABILITY_RATIO;
}
