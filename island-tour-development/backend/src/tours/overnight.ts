import { Prisma } from '@prisma/client';

/**
 * Single source of truth for the Day vs Overnight charter classification
 * (the hub page's "Private day charters" / "Private overnight charters" split).
 *
 * Overnight = the operator says guests sleep on board (`sleepAboard`), OR the
 * duration makes sleep unavoidable (>= 16h - no charter runs 16+ hours awake,
 * while genuine day trips top out around 12-14h). The two inputs cover each
 * other's blind spots:
 *  - a <16h sunset-to-sunrise trip (e.g. 19:00-09:00) is only knowable via the
 *    operator flag - no duration threshold classifies it;
 *  - a 16h+ / multi-day charter classifies correctly even if the operator
 *    forgot the flag;
 *  - a 6h night cruise (20:00-02:00) correctly stays a day charter: crossing
 *    midnight is a scheduling coincidence, sleeping aboard is the product.
 *
 * Start times deliberately play no part. The frontend consumes the computed
 * `isOvernight` field from listing payloads and must never re-derive this rule.
 */
export const OVERNIGHT_MIN_MINUTES = 960;

/** The exact Tour columns {@link isOvernightCharter} reads. */
export const overnightSelect = {
  sleepAboard: true,
  durationMinutesFrom: true,
} satisfies Prisma.TourSelect;

/**
 * Both fields are REQUIRED (not optional) so a Prisma `select` that forgets one
 * is a compile error, never a silent "day charter" misclassification.
 */
export function isOvernightCharter(tour: {
  sleepAboard: boolean;
  durationMinutesFrom: number | null;
}): boolean {
  return (
    tour.sleepAboard || (tour.durationMinutesFrom ?? 0) >= OVERNIGHT_MIN_MINUTES
  );
}
