/**
 * Demand signal - master §3.7 "Demand signaling: one trigger" (confirmed
 * June 10, 2026). ONE algorithm powers both the listing-card "Likely to sell out"
 * badge and the tour-page demand card. All three conditions must hold, evaluated
 * daily:
 *
 *   1. tour_age_days >= 90
 *   2. recent_sellouts >= 3 in the past 60 days   (departures.sold_out_at, E.9)
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
import { DepartureStatus } from '@prisma/client';

import type { PrismaService } from '@/prisma/prisma.service';

export const DEMAND_MIN_AGE_DAYS = 90;
export const DEMAND_MIN_SELLOUTS_60D = 3;
export const DEMAND_SELLOUT_WINDOW_DAYS = 60;
export const DEMAND_AVAILABILITY_WINDOW_DAYS = 30;
export const DEMAND_MAX_AVAILABILITY_RATIO = 0.4;

const DAY_MS = 86_400_000;

/** Midnight UTC of `d` - departures are stored as `@db.Date`. */
function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Returns the COMPUTED §3.7 demand signal for a tour (ignores the manual
 * override - the caller applies `override ?? computed`). A minimal Prisma client
 * surface is accepted so both the NestJS service and the standalone demo seed can
 * pass their own instance.
 */
export async function evaluateLikelyToSellOut(
  prisma: Pick<PrismaService, 'tour' | 'departure'>,
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

  // 2. >= 3 sellouts in the past 60 days (departures stamped sold_out_at).
  const windowStart = new Date(now.getTime() - DEMAND_SELLOUT_WINDOW_DAYS * DAY_MS);
  const recentSellouts = await prisma.departure.count({
    where: { tourId, soldOutAt: { gte: windowStart, lte: now } },
  });
  if (recentSellouts < DEMAND_MIN_SELLOUTS_60D) return false;

  // 3. Upcoming availability ratio < 0.40 over the next 30 days. Ratio = remaining
  //    seats / total capacity across non-cancelled departures in the window.
  const today = startOfUtcDay(now);
  const horizon = new Date(today.getTime() + DEMAND_AVAILABILITY_WINDOW_DAYS * DAY_MS);
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
