/**
 * The four import modes, which are the whole product decision of this feature.
 *
 * The founding constraint: iCal carries NO seat count. An external "Busy" event
 * means "the listing is unavailable", never "one of sixty seats sold". These
 * tests pin what each mode does with that ambiguity.
 */
import {
  AvailabilityExceptionType,
  CalendarConflictResolution,
  CalendarImportMode,
} from '@prisma/client';
import {
  mapBlocksToExceptions,
  resolveDurationMinutes,
  type MapInput,
  type MapperDeparture,
} from './block-mapper.util';
import type { BusyBlock } from './ical-parser.util';

const TZ = 'America/Curacao'; // UTC-4, no DST

const allDayBlock = (over: Partial<BusyBlock> = {}): BusyBlock => ({
  externalUid: 'ext-1',
  summary: 'Reserved',
  isAllDay: true,
  startDateKey: '2026-08-14',
  endDateKey: '2026-08-14',
  startUtc: null,
  endUtc: null,
  recurrenceRule: null,
  isRecurrenceInstance: false,
  ...over,
});

const timedBlock = (over: Partial<BusyBlock> = {}): BusyBlock => ({
  externalUid: 'ext-timed',
  summary: 'Charter',
  isAllDay: false,
  startDateKey: '2026-08-14',
  endDateKey: '2026-08-14',
  // 09:00-12:00 local (UTC-4)
  startUtc: new Date('2026-08-14T13:00:00.000Z'),
  endUtc: new Date('2026-08-14T16:00:00.000Z'),
  recurrenceRule: null,
  isRecurrenceInstance: false,
  ...over,
});

const time = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, h, m, 0));
};

const departure = (
  id: string,
  date: string,
  startTime: string,
  over: Partial<MapperDeparture> = {},
): MapperDeparture => ({
  id,
  date: new Date(`${date}T00:00:00.000Z`),
  startTime: time(startTime),
  capacity: 60,
  bookedCount: 0,
  ...over,
});

const run = (
  over: Partial<MapInput>,
): ReturnType<typeof mapBlocksToExceptions> =>
  mapBlocksToExceptions({
    blocks: [allDayBlock()],
    tour: { timeZone: TZ, durationMinutes: 480 },
    departures: [],
    mode: CalendarImportMode.CLOSE_DATES,
    sourceLabel: 'Airbnb',
    ...over,
  });

describe('CLOSE_DATES', () => {
  it('closes every day an all-day block covers', () => {
    const { desired } = run({
      blocks: [
        allDayBlock({ startDateKey: '2026-08-14', endDateKey: '2026-08-16' }),
      ],
    });
    expect(desired).toHaveLength(3);
    expect(desired.map((d) => d.date.toISOString().slice(0, 10))).toEqual([
      '2026-08-14',
      '2026-08-15',
      '2026-08-16',
    ]);
    expect(
      desired.every((d) => d.type === AvailabilityExceptionType.CLOSE_DATE),
    ).toBe(true);
    expect(desired.every((d) => d.startTime === null)).toBe(true);
  });

  // Postgres treats NULLs as distinct, so a null slotKey would let two racing
  // syncs write the same whole-date block twice.
  it("uses '*' as the slot key so the unique index can hold", () => {
    const { desired } = run({});
    expect(desired[0].slotKey).toBe('*');
  });

  it('names the source in the note so the agenda can say where it came from', () => {
    expect(run({}).desired[0].note).toBe('Airbnb: Reserved');
    expect(
      run({ blocks: [allDayBlock({ summary: null })] }).desired[0].note,
    ).toBe('Imported from Airbnb');
  });

  it('closes dates even when no departure exists there yet', () => {
    // A date-level close also catches departures materialized later, which a
    // slot-level close cannot.
    const { desired } = run({ departures: [] });
    expect(desired).toHaveLength(1);
  });
});

describe('CLOSE_SLOTS', () => {
  const mode = CalendarImportMode.CLOSE_SLOTS;

  it('closes only the departures the block actually overlaps', () => {
    const { desired } = run({
      mode,
      blocks: [timedBlock()], // 09:00-12:00 local
      tour: { timeZone: TZ, durationMinutes: 120 },
      departures: [
        departure('d-am', '2026-08-14', '09:00'), // overlaps
        departure('d-pm', '2026-08-14', '15:00'), // does not
      ],
    });
    expect(desired).toHaveLength(1);
    expect(desired[0].startTime).toBe('09:00');
    expect(desired[0].type).toBe(AvailabilityExceptionType.CLOSE_SLOT);
    expect(desired[0].slotKey).toBe('09:00');
  });

  // A long tour that STARTS before the block can still run into it.
  it('counts a departure whose duration runs into the block', () => {
    const { desired } = run({
      mode,
      blocks: [timedBlock()], // 09:00-12:00 local
      tour: { timeZone: TZ, durationMinutes: 480 }, // 8 hours
      departures: [departure('d-early', '2026-08-14', '06:00')], // 06:00-14:00
    });
    expect(desired).toHaveLength(1);
    expect(desired[0].startTime).toBe('06:00');
  });

  // Half-open on both ends: touching at the boundary is not an overlap.
  it('leaves a departure that merely abuts the block', () => {
    const { desired } = run({
      mode,
      blocks: [timedBlock()], // 09:00-12:00 local
      tour: { timeZone: TZ, durationMinutes: 120 },
      departures: [departure('d-after', '2026-08-14', '12:00')], // starts as it ends
    });
    expect(desired).toHaveLength(0);
  });

  it('closes every departure on the day for an all-day block', () => {
    const { desired } = run({
      mode,
      blocks: [allDayBlock()],
      departures: [
        departure('d1', '2026-08-14', '08:00'),
        departure('d2', '2026-08-14', '14:00'),
        departure('d3', '2026-08-15', '08:00'), // different day
      ],
    });
    expect(desired.map((d) => d.startTime).sort()).toEqual(['08:00', '14:00']);
  });
});

describe('WARN_ONLY', () => {
  const mode = CalendarImportMode.WARN_ONLY;

  // The reason this is the default: on a 60-seat catamaran, one external booking
  // must not close a departure that is 59/60 empty.
  it('writes no blocks at all', () => {
    const { desired } = run({
      mode,
      blocks: [
        allDayBlock({ startDateKey: '2026-08-14', endDateKey: '2026-08-20' }),
      ],
      departures: [departure('d1', '2026-08-14', '08:00', { bookedCount: 1 })],
    });
    expect(desired).toHaveLength(0);
  });

  it('still reports what it would have closed, or the run looks like a no-op', () => {
    const result = run({
      mode,
      blocks: [
        allDayBlock({ startDateKey: '2026-08-14', endDateKey: '2026-08-16' }),
      ],
      departures: [
        departure('d1', '2026-08-14', '08:00'),
        departure('d2', '2026-08-15', '08:00'),
      ],
    });
    expect(result.wouldBlockDates).toBe(3);
    expect(result.wouldBlockSlots).toBe(2);
  });

  it('records the conflict as KEPT_OPEN', () => {
    const { conflicts } = run({
      mode,
      blocks: [allDayBlock()],
      departures: [
        departure('d-booked', '2026-08-14', '08:00', {
          bookedCount: 4,
          capacity: 60,
        }),
      ],
    });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].resolution).toBe(CalendarConflictResolution.KEPT_OPEN);
    expect(conflicts[0].bookedCount).toBe(4);
    expect(conflicts[0].capacity).toBe(60);
  });
});

describe('IGNORE', () => {
  const mode = CalendarImportMode.IGNORE;

  it('is a true dry run - no blocks and no conflict rows', () => {
    const result = run({
      mode,
      blocks: [allDayBlock()],
      departures: [departure('d1', '2026-08-14', '08:00', { bookedCount: 4 })],
    });
    expect(result.desired).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
  });

  it('still reports the counts so the operator can preview the impact', () => {
    const result = run({
      mode,
      blocks: [
        allDayBlock({ startDateKey: '2026-08-14', endDateKey: '2026-08-15' }),
      ],
      departures: [departure('d1', '2026-08-14', '08:00')],
    });
    expect(result.wouldBlockDates).toBe(2);
    expect(result.wouldBlockSlots).toBe(1);
  });
});

describe('conflicts', () => {
  // An overlap with an empty departure is an ordinary stop-sell, not an alarm.
  it('are raised only for departures that already sold something', () => {
    const { conflicts } = run({
      blocks: [allDayBlock()],
      departures: [
        departure('empty', '2026-08-14', '08:00', { bookedCount: 0 }),
        departure('sold', '2026-08-14', '14:00', { bookedCount: 2 }),
      ],
    });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].departureId).toBe('sold');
  });

  // Closing stops NEW sales; travellers already booked keep their seats.
  it('are marked BLOCKED when the mode does close', () => {
    const { conflicts } = run({
      mode: CalendarImportMode.CLOSE_DATES,
      blocks: [allDayBlock()],
      departures: [
        departure('sold', '2026-08-14', '08:00', { bookedCount: 2 }),
      ],
    });
    expect(conflicts[0].resolution).toBe(CalendarConflictResolution.BLOCKED);
  });

  /**
   * A timed block under CLOSE_DATES: the busy window is 09:00-12:00 but the
   * exception closes the WHOLE day, so the 15:00 departure is shut even though
   * nothing overlaps it. Scoping conflicts to the time-overlapping set would
   * close a departure with two seats sold and raise no alarm at all - silence
   * exactly where the operator most needs telling.
   */
  it('cover every departure the whole-day close actually shuts', () => {
    const { conflicts } = run({
      mode: CalendarImportMode.CLOSE_DATES,
      blocks: [timedBlock()], // 09:00-12:00 local
      departures: [
        departure('morning', '2026-08-14', '09:00', { bookedCount: 1 }),
        departure('afternoon', '2026-08-14', '15:00', { bookedCount: 2 }),
      ],
    });
    expect(conflicts.map((c) => c.departureId).sort()).toEqual([
      'afternoon',
      'morning',
    ]);
    expect(conflicts.every((c) => c.resolution === 'BLOCKED')).toBe(true);
  });

  // The mirror image: CLOSE_SLOTS only shuts what it overlaps, so the
  // non-overlapping departure stays open and must NOT be reported as blocked.
  it('stay scoped to the overlap when only matching slots close', () => {
    const { conflicts } = run({
      mode: CalendarImportMode.CLOSE_SLOTS,
      blocks: [timedBlock()], // 09:00-12:00 local
      departures: [
        departure('morning', '2026-08-14', '09:00', { bookedCount: 1 }),
        departure('afternoon', '2026-08-14', '15:00', { bookedCount: 2 }),
      ],
    });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].departureId).toBe('morning');
  });

  it('report one row per departure even when several blocks hit it', () => {
    const { conflicts } = run({
      blocks: [
        allDayBlock({ externalUid: 'a' }),
        allDayBlock({ externalUid: 'b' }),
      ],
      departures: [
        departure('sold', '2026-08-14', '08:00', { bookedCount: 2 }),
      ],
    });
    expect(conflicts).toHaveLength(1);
  });
});

describe('timezone handling', () => {
  // The block belongs to the island's calendar, not the server's.
  it('resolves an all-day block against the tour timezone', () => {
    const { desired } = run({
      blocks: [allDayBlock()],
      tour: { timeZone: 'Pacific/Kiritimati', durationMinutes: 480 },
    });
    expect(desired[0].date.toISOString().slice(0, 10)).toBe('2026-08-14');
  });

  // 23:00-01:00 local crosses midnight and must close both calendar days.
  it('covers both days when a timed block crosses local midnight', () => {
    const { desired } = run({
      blocks: [
        timedBlock({
          startUtc: new Date('2026-08-15T03:00:00.000Z'), // 23:00 on the 14th local
          endUtc: new Date('2026-08-15T05:00:00.000Z'), // 01:00 on the 15th local
        }),
      ],
    });
    expect(desired.map((d) => d.date.toISOString().slice(0, 10))).toEqual([
      '2026-08-14',
      '2026-08-15',
    ]);
  });

  it('does not claim the next day when a block ends exactly at local midnight', () => {
    const { desired } = run({
      blocks: [
        timedBlock({
          startUtc: new Date('2026-08-14T20:00:00.000Z'), // 16:00 local
          endUtc: new Date('2026-08-15T04:00:00.000Z'), // 00:00 local on the 15th
        }),
      ],
    });
    expect(desired).toHaveLength(1);
    expect(desired[0].date.toISOString().slice(0, 10)).toBe('2026-08-14');
  });
});

describe('deduplication', () => {
  it('collapses two blocks closing the same date', () => {
    const { desired } = run({
      blocks: [
        allDayBlock({
          externalUid: 'same',
          startDateKey: '2026-08-14',
          endDateKey: '2026-08-15',
        }),
        allDayBlock({
          externalUid: 'same',
          startDateKey: '2026-08-15',
          endDateKey: '2026-08-16',
        }),
      ],
    });
    expect(desired).toHaveLength(3); // 14, 15, 16 - not 4
  });

  // Two different reservations covering one date are two rows, because removing
  // one upstream must not release a date the other still holds.
  it('keeps separate rows for different source events on one date', () => {
    const { desired } = run({
      blocks: [
        allDayBlock({ externalUid: 'a' }),
        allDayBlock({ externalUid: 'b' }),
      ],
    });
    expect(desired).toHaveLength(2);
    expect(desired.map((d) => d.externalUid).sort()).toEqual(['a', 'b']);
  });
});

describe('resolveDurationMinutes', () => {
  it('prefers the longest advertised duration', () => {
    expect(
      resolveDurationMinutes({
        durationMinutesTo: 480,
        durationMinutesFrom: 420,
      }),
    ).toBe(480);
  });

  it('falls back to the shorter one, then to an hour', () => {
    expect(
      resolveDurationMinutes({
        durationMinutesTo: null,
        durationMinutesFrom: 420,
      }),
    ).toBe(420);
    expect(
      resolveDurationMinutes({
        durationMinutesTo: null,
        durationMinutesFrom: null,
      }),
    ).toBe(60);
  });
});
