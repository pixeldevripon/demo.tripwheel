import {
  AvailabilityExceptionType,
  CalendarConflictResolution,
  CalendarImportMode,
} from '@prisma/client';
import {
  combineDateTime,
  dateKey,
  dayDate,
  localNow,
  localWallClockToUtc,
  timeOfDay,
} from '@/common/utils/timezone.util';
import type { BusyBlock } from './ical-parser.util';

/**
 * Decides what a feed's busy intervals actually DO to our inventory.
 *
 * ## The rule this module exists to enforce
 * An imported block becomes a **stop-sell exception and nothing else**. It never
 * becomes a booking, never changes capacity, never writes a departure row.
 * `departures` stays the single source of truth (spec non-negotiable 1); the
 * materializer projects these exceptions, exactly as it does an operator's own.
 *
 * ## Why the operator picks the mode
 * iCal carries **no seat count**. An external "Busy" event says the listing is
 * unavailable - it cannot say "one of sixty seats sold". So on a 60-seat
 * catamaran, closing the whole day because Airbnb sold a seat is simply wrong,
 * while on a whole-boat charter it is exactly right. Only the operator knows
 * which of their tours is which, so the mode is theirs to choose per connection
 * and `WARN_ONLY` is the default.
 */

/** A stop-sell row we want to exist, before it is diffed against what already does. */
export interface DesiredBlock {
  /** `@db.Date` storage form. */
  date: Date;
  /** `'HH:MM'` for a slot close, null for a whole-date close. */
  startTime: string | null;
  type: AvailabilityExceptionType;
  externalUid: string;
  /** `'HH:MM'` or `'*'` - the discriminator that makes the unique index work. */
  slotKey: string;
  note: string;
}

/** An imported block landing on a departure that already has bookings. */
export interface MappedConflict {
  departureId: string;
  conflictDate: Date;
  startTime: string | null;
  bookedCount: number;
  capacity: number;
  resolution: CalendarConflictResolution;
}

export interface MapResult {
  desired: DesiredBlock[];
  conflicts: MappedConflict[];
  /**
   * What a non-writing mode WOULD have closed. The whole output of `WARN_ONLY`
   * and `IGNORE` is the sync log, so without these two numbers those modes look
   * identical to "nothing happened".
   */
  wouldBlockDates: number;
  wouldBlockSlots: number;
}

export interface MapperTour {
  timeZone: string;
  /** Longest advertised duration; the tour's real occupancy window per departure. */
  durationMinutes: number;
}

/** The departure fields overlap detection needs. */
export interface MapperDeparture {
  id: string;
  date: Date;
  startTime: Date;
  capacity: number;
  bookedCount: number;
}

export interface MapInput {
  blocks: BusyBlock[];
  tour: MapperTour;
  /** Departures already materialized in the sync horizon. */
  departures: MapperDeparture[];
  mode: CalendarImportMode;
  /** Shown in the agenda so a closed day says WHERE it came from. */
  sourceLabel: string;
}

const MS_PER_DAY = 86_400_000;

/** Inclusive list of `YYYY-MM-DD` keys from start to end. */
function dateKeysBetween(startKey: string, endKey: string): string[] {
  const keys: string[] = [];
  for (
    let d = new Date(`${startKey}T00:00:00.000Z`);
    dateKey(d) <= endKey;
    d = new Date(d.getTime() + MS_PER_DAY)
  ) {
    keys.push(dateKey(d));
  }
  return keys;
}

/**
 * The real UTC interval a busy block occupies.
 *
 * An all-day block has no instant of its own - it is a pair of calendar dates -
 * so it becomes local midnight to local midnight after the last covered day,
 * resolved in the TOUR's timezone. That is what makes "Airbnb says the 14th" mean
 * the 14th on the island rather than the 14th wherever our server happens to run.
 */
function blockInterval(
  block: BusyBlock,
  timeZone: string,
): { startUtc: Date; endUtc: Date } {
  if (!block.isAllDay && block.startUtc && block.endUtc) {
    return { startUtc: block.startUtc, endUtc: block.endUtc };
  }
  const startLocal = dayDate(block.startDateKey);
  const endLocalExclusive = new Date(
    dayDate(block.endDateKey).getTime() + MS_PER_DAY,
  );
  return {
    startUtc: localWallClockToUtc(startLocal, timeZone),
    endUtc: localWallClockToUtc(endLocalExclusive, timeZone),
  };
}

/** Local calendar days a block touches, in the tour's timezone. */
function coveredDateKeys(block: BusyBlock, timeZone: string): string[] {
  if (block.isAllDay || !block.startUtc || !block.endUtc) {
    return dateKeysBetween(block.startDateKey, block.endDateKey);
  }
  const startLocal = localNow(timeZone, block.startUtc);
  // One millisecond back, so a block ending exactly at local midnight does not
  // claim the following day.
  const endLocal = localNow(timeZone, new Date(block.endUtc.getTime() - 1));
  const endKey =
    endLocal >= startLocal ? dateKey(endLocal) : dateKey(startLocal);
  return dateKeysBetween(dateKey(startLocal), endKey);
}

export function mapBlocksToExceptions(input: MapInput): MapResult {
  const { blocks, tour, departures, mode, sourceLabel } = input;

  // Ignore is a dry run in the strictest sense: it reads the feed and reports,
  // and touches neither availability nor the conflict queue.
  const writesBlocks =
    mode === CalendarImportMode.CLOSE_DATES ||
    mode === CalendarImportMode.CLOSE_SLOTS;

  const departuresByDate = new Map<string, MapperDeparture[]>();
  for (const departure of departures) {
    const key = dateKey(departure.date);
    const list = departuresByDate.get(key) ?? [];
    list.push(departure);
    departuresByDate.set(key, list);
  }

  const desired = new Map<string, DesiredBlock>();
  const conflicts = new Map<string, MappedConflict>();
  let wouldBlockDates = 0;
  let wouldBlockSlots = 0;

  for (const block of blocks) {
    const note = block.summary
      ? `${sourceLabel}: ${block.summary}`
      : `Imported from ${sourceLabel}`;
    const dateKeys = coveredDateKeys(block, tour.timeZone);
    const interval = blockInterval(block, tour.timeZone);

    wouldBlockDates += dateKeys.length;

    // Which departures this block actually collides with. For an all-day block
    // the interval spans the whole day, so every departure on it overlaps.
    const hit: MapperDeparture[] = [];
    for (const key of dateKeys) {
      for (const departure of departuresByDate.get(key) ?? []) {
        const localStart = combineDateTime(departure.date, departure.startTime);
        const startUtc = localWallClockToUtc(localStart, tour.timeZone);
        const endUtc = new Date(
          startUtc.getTime() + tour.durationMinutes * 60_000,
        );
        // Half-open on both sides: a departure ending exactly when the block
        // starts does not overlap it.
        if (startUtc < interval.endUtc && endUtc > interval.startUtc) {
          hit.push(departure);
        }
      }
    }
    wouldBlockSlots += hit.length;

    if (writesBlocks) {
      if (mode === CalendarImportMode.CLOSE_DATES) {
        for (const key of dateKeys) {
          // '*' rather than null: the unique index includes slotKey, and Postgres
          // treats NULLs as distinct, so two racing syncs could write this twice.
          const id = `${block.externalUid}|${key}|*`;
          desired.set(id, {
            date: dayDate(key),
            startTime: null,
            type: AvailabilityExceptionType.CLOSE_DATE,
            externalUid: block.externalUid,
            slotKey: '*',
            note,
          });
        }
      } else {
        for (const departure of hit) {
          const slot = timeOfDay(departure.startTime);
          const key = dateKey(departure.date);
          const id = `${block.externalUid}|${key}|${slot}`;
          desired.set(id, {
            date: departure.date,
            startTime: slot,
            type: AvailabilityExceptionType.CLOSE_SLOT,
            externalUid: block.externalUid,
            slotKey: slot,
            note,
          });
        }
      }
    }

    // A conflict is an overlap with a departure that already SOLD something -
    // that is the double-booking risk. An overlap with an empty departure is
    // just a stop-sell and needs no alarm.
    //
    // What counts as "affected" has to match what actually gets CLOSED, not
    // what overlaps the block's clock time. In CLOSE_DATES the exception has
    // `startTime: null`, which the materializer applies to EVERY departure that
    // day - so a timed busy block (a partial-day Google event) closes the 15:00
    // departure even though it only overlaps the morning. Scoping conflicts to
    // `hit` there would shut a booked departure and tell nobody.
    const closesWholeDay =
      writesBlocks && mode === CalendarImportMode.CLOSE_DATES;
    const affected = closesWholeDay
      ? dateKeys.flatMap((key) => departuresByDate.get(key) ?? [])
      : hit;

    if (mode !== CalendarImportMode.IGNORE) {
      for (const departure of affected) {
        if (departure.bookedCount <= 0) continue;
        conflicts.set(departure.id, {
          departureId: departure.id,
          conflictDate: departure.date,
          startTime: timeOfDay(departure.startTime),
          bookedCount: departure.bookedCount,
          capacity: departure.capacity,
          // Closing never cancels a booking - existing travellers keep their
          // seats, only NEW sales stop. WARN_ONLY leaves it open entirely.
          resolution: writesBlocks
            ? CalendarConflictResolution.BLOCKED
            : CalendarConflictResolution.KEPT_OPEN,
        });
      }
    }
  }

  return {
    desired: [...desired.values()],
    conflicts: [...conflicts.values()],
    wouldBlockDates,
    wouldBlockSlots,
  };
}

/** Longest advertised duration, or an hour when the tour records none. */
export function resolveDurationMinutes(tour: {
  durationMinutesTo: number | null;
  durationMinutesFrom: number | null;
}): number {
  return tour.durationMinutesTo ?? tour.durationMinutesFrom ?? 60;
}
