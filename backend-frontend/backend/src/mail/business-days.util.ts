/**
 * Business-day math for the INT1R pending reminder (checklist D-18): an
 * operator is "pending more than 2 business days" when its `createdAt` is on
 * or before `subtractBusinessDays(now, 2)` — weekends (Sat/Sun) don't count,
 * in the platform's home timezone (America/Curacao, fixed UTC-4, same zone as
 * the lifecycle send window).
 *
 * Built on `localNow()`/`localWallClockToUtc()` like send-window.util.ts — no
 * hand-rolled timezone math. The subtraction form is used (rather than
 * per-row `addBusinessDays(createdAt, n)`) because the sweep compares ONE
 * cutoff against a column in SQL; both walks step whole local days, so
 * `addBusinessDays(t, n) <= now ⟺ t <= subtractBusinessDays(now, n)`.
 */
import { localNow, localWallClockToUtc } from '@/common/utils/timezone.util';
import { LIFECYCLE_WINDOW_TZ } from './send-window.util';

/** Saturday(6) / Sunday(0) in JS `getUTCDay()` numbering. */
function isWeekend(zLabelledLocal: Date): boolean {
  const day = zLabelledLocal.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * The absolute UTC instant `businessDays` business days BEFORE `now`, keeping
 * the wall-clock time of day: each step walks back one calendar day and only
 * counts days that land on Mon–Fri (Curaçao local). A `now` already on a
 * weekend contributes nothing itself — the walk simply continues through it.
 *
 * Examples (all Curaçao local): Wed 15:00 - 2bd = Mon 15:00 ·
 * Mon 09:00 - 2bd = Thu 09:00 · Sun 12:00 - 2bd = Thu 12:00.
 */
export function subtractBusinessDays(
  now: Date,
  businessDays: number,
  timeZone: string = LIFECYCLE_WINDOW_TZ,
): Date {
  const local = localNow(timeZone, now);
  let remaining = businessDays;
  while (remaining > 0) {
    local.setUTCDate(local.getUTCDate() - 1);
    if (!isWeekend(local)) remaining--;
  }
  return localWallClockToUtc(local, timeZone);
}
