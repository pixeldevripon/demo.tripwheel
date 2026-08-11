/**
 * Lifecycle send window (EMAIL-IMPLEMENTATION-PLAN.md §2.8).
 *
 * Operator lifecycle nudges (OB-3/4/6/7/8) go out Tue–Thu 09:00–11:00
 * **America/Curacao** — mid-morning on the island the platform operates from,
 * never Monday chaos or Friday wind-down. Traveller marketing (MK-1) shares
 * the HOURS but not the weekdays — see `isMarketingMorningWindowOpen`. Built on
 * `localNow()` from the shared timezone util so no timezone math is
 * hand-rolled here; Curaçao is fixed UTC-4 with no DST (asserted in the
 * spec), so the window is the same absolute UTC hours year-round.
 *
 * WP-H: weekdays and hours are dashboard-editable (`EmailSettings`), so both
 * predicates take an optional config resolved per sweep tick by
 * `EmailSettingsService`; the built-ins above stay the defaults and the
 * behaviour without a config argument is byte-identical to pre-WP-H.
 *
 * BK-3's "around 10:00 tour-local" window is a DIFFERENT rule and stays where
 * it is (review-requests.service.ts) — that one is per-booking tour-local,
 * this one is platform-local.
 */
import { localNow, localWallClockToUtc } from '@/common/utils/timezone.util';

/** The platform's home timezone — fixed UTC-4, no DST. */
export const LIFECYCLE_WINDOW_TZ = 'America/Curacao';

/** Window opens at 09:00 local, inclusive. */
export const WINDOW_OPEN_HOUR = 9;
/** Window closes at 11:00 local, exclusive (10:59 is in, 11:00 is out). */
export const WINDOW_CLOSE_HOUR = 11;

/**
 * Weekdays the window opens on: Tuesday(2)–Thursday(4) in JS `getUTCDay()`
 * numbering (Sunday = 0). Applied to the Z-labelled local wall-clock date.
 */
const OPEN_WEEKDAYS: ReadonlySet<number> = new Set([2, 3, 4]);

/** The lifecycle window knobs the dashboard may override (WP-H). */
export interface LifecycleWindowConfig {
  /** JS `getUTCDay()` numbers (Sunday = 0). Must be non-empty. */
  weekdays: ReadonlySet<number>;
  /** Opening local hour, inclusive (0–23). */
  startHour: number;
  /** Closing local hour, exclusive (must be > startHour). */
  endHour: number;
}

/** The marketing window shares only the HOURS (any weekday). */
export type MorningWindowConfig = Pick<
  LifecycleWindowConfig,
  'startHour' | 'endHour'
>;

/** The built-in window — what runs when no dashboard override is stored. */
export const DEFAULT_LIFECYCLE_WINDOW: LifecycleWindowConfig = {
  weekdays: OPEN_WEEKDAYS,
  startHour: WINDOW_OPEN_HOUR,
  endHour: WINDOW_CLOSE_HOUR,
};

/** csv day-name → JS `getUTCDay()` number (the `windowWeekdays` storage form). */
const DAY_INDEX: Readonly<Record<string, number>> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

/**
 * Parse the stored `windowWeekdays` csv ("tue,wed,thu") into JS day numbers.
 * Unknown tokens are ignored; an empty result falls back to the built-in set
 * (an empty window would silently stop every nudge forever — the PATCH DTO
 * rejects it, this is the belt to that suspender).
 */
export function parseWindowWeekdays(csv: string): ReadonlySet<number> {
  const days = new Set<number>();
  for (const raw of csv.split(',')) {
    const idx = DAY_INDEX[raw.trim().toLowerCase()];
    if (idx !== undefined) days.add(idx);
  }
  return days.size > 0 ? days : OPEN_WEEKDAYS;
}

/**
 * Is the lifecycle send window open at `now` (an absolute UTC instant,
 * default: the real now)? `config` comes from the resolved email settings;
 * omitted = the built-in Tue–Thu 09:00–11:00.
 */
export function isLifecycleWindowOpen(
  now: Date = new Date(),
  config: LifecycleWindowConfig = DEFAULT_LIFECYCLE_WINDOW,
): boolean {
  const local = localNow(LIFECYCLE_WINDOW_TZ, now);
  if (!config.weekdays.has(local.getUTCDay())) return false;
  const hour = local.getUTCHours();
  return hour >= config.startHour && hour < config.endHour;
}

/**
 * Is the MARKETING morning window open at `now`?
 *
 * MK-1 (WP-G) goes out "Curaçao morning" per the funnel wireframe — the same
 * 09:00–11:00 America/Curacao hours as the lifecycle window, but on ANY day
 * of the week: the trigger is `tour_end + 72h`, so pinning it to Tue–Thu
 * would slide a Friday-due email three days and mail travellers who have
 * already flown home. Deliberately a SEPARATE helper rather than a flag on
 * `isLifecycleWindowOpen` — the two windows are different rules that happen
 * to share hours (and, per WP-H, the same dashboard-configured hour pair),
 * and coupling them would let a lifecycle change silently move marketing
 * sends.
 */
export function isMarketingMorningWindowOpen(
  now: Date = new Date(),
  config: MorningWindowConfig = DEFAULT_LIFECYCLE_WINDOW,
): boolean {
  const hour = localNow(LIFECYCLE_WINDOW_TZ, now).getUTCHours();
  return hour >= config.startHour && hour < config.endHour;
}

/**
 * The next instant (real UTC) the lifecycle window is open, for logging and
 * dashboards — NOT for scheduling (the 15-minute sweep just re-checks
 * `isLifecycleWindowOpen` each tick). Returns `now` itself when the window
 * is already open.
 */
export function nextLifecycleWindow(
  now: Date = new Date(),
  config: LifecycleWindowConfig = DEFAULT_LIFECYCLE_WINDOW,
): Date {
  if (isLifecycleWindowOpen(now, config)) return now;

  const local = localNow(LIFECYCLE_WINDOW_TZ, now);
  // Candidate: today at the opening hour local (still ahead if we are before
  // the window on an open weekday); otherwise walk forward day by day to the
  // next open weekday's opening hour. At most 7 iterations.
  const candidate = new Date(local.getTime());
  candidate.setUTCHours(config.startHour, 0, 0, 0);
  if (candidate <= local || !config.weekdays.has(candidate.getUTCDay())) {
    do {
      candidate.setUTCDate(candidate.getUTCDate() + 1);
    } while (!config.weekdays.has(candidate.getUTCDay()));
    candidate.setUTCHours(config.startHour, 0, 0, 0);
  }
  return localWallClockToUtc(candidate, LIFECYCLE_WINDOW_TZ);
}
