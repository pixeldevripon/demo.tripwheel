import { createHash } from 'node:crypto';
import ICAL from 'ical.js';
import { localWallClockToUtc } from '@/common/utils/timezone.util';

/**
 * Turns a third-party `.ics` document into the busy intervals it describes.
 *
 * ## This is a READER, and reading iCal is the hard half
 * Writing the format is a page of string building (`@/common/ics/ics.util.ts`).
 * Reading it means RRULE expansion, EXDATE and RDATE, RECURRENCE-ID overrides,
 * VTIMEZONE definitions, folded lines, LF-only files and Latin-1 bodies - which
 * is why this delegates to `ical.js` (Mozilla's, the one Thunderbird uses)
 * rather than growing our writer into a parser.
 *
 * ## Two traps that bite everyone
 * 1. **All-day `DTEND` is EXCLUSIVE.** `20260814 → 20260818` covers the 14th to
 *    the **17th**. Off-by-one here silently blocks a day the operator can sell.
 * 2. **Never call `toJSDate()` on an all-day value.** ical.js resolves it against
 *    the SERVER's local timezone, so on a UTC+6 box `20260814` comes back as
 *    `2026-08-13T18:00Z` - the wrong calendar day. An all-day event is a literal
 *    calendar date with no instant attached, which is exactly what every OTA
 *    means by it, so we read `.year/.month/.day` verbatim.
 *
 * Nothing here touches the database or knows what a departure is. It answers one
 * question - "when does this feed say the operator is busy?" - and the mapper
 * decides what that does to inventory.
 */

const LIMITS = {
  /** Beyond this the feed is publishing years of history; take the nearest ones. */
  maxEvents: 5_000,
  /** An unbounded RRULE would otherwise expand forever. */
  maxInstancesPerRule: 200,
  /** A multi-year single event almost always means a broken feed, not a real block. */
  maxSpanDays: 730,
} as const;

/** Why an individual event was dropped. Counted and reported, never fatal. */
export type SkipReason =
  | 'cancelled'
  | 'transparent'
  | 'no-dtstart'
  | 'end-before-start'
  | 'outside-horizon'
  | 'too-long'
  | 'unparseable';

/**
 * One interval the external calendar marks as occupied.
 *
 * All-day and timed blocks are deliberately NOT normalised into one shape: an
 * all-day block is a pair of calendar dates with no timezone, a timed block is a
 * real instant. Flattening them would force a timezone guess here, where there
 * is least information to make it with.
 */
export interface BusyBlock {
  externalUid: string;
  summary: string | null;
  isAllDay: boolean;
  /** All-day only. `YYYY-MM-DD`, and **inclusive** - the exclusive DTEND is already resolved. */
  startDateKey: string;
  endDateKey: string;
  /** Timed only. A real instant. */
  startUtc: Date | null;
  endUtc: Date | null;
  /** Raw RRULE of the master event, kept for the audit trail. */
  recurrenceRule: string | null;
  isRecurrenceInstance: boolean;
}

export interface IcalParseSuccess {
  ok: true;
  blocks: BusyBlock[];
  /** VEVENTs seen before expansion, for the sync log. */
  eventsFound: number;
  skipped: Partial<Record<SkipReason, number>>;
  /** True when a cap was hit, so the run is logged as PARTIAL rather than SUCCESS. */
  truncated: boolean;
  calendarName: string | null;
}

export interface IcalParseFailure {
  ok: false;
  code: 'NOT_A_CALENDAR' | 'MALFORMED_ICS' | 'TRUNCATED_FEED';
  message: string;
  transient: boolean;
}

export type IcalParseResult = IcalParseSuccess | IcalParseFailure;

export interface IcalParseOptions {
  /**
   * Zone for FLOATING times - values with neither `Z` nor a resolvable `TZID`.
   * The tour's own timezone, per the PRD's TZID → X-WR-TIMEZONE → listing order.
   */
  fallbackTimeZone: string;
  /** Events entirely outside this window are dropped silently, not counted as errors. */
  horizonStart: Date;
  horizonEnd: Date;
}

// ── date helpers ─────────────────────────────────────────────────────────────

const dateKey = (year: number, month: number, day: number): string =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const keyOfTime = (time: ICAL.Time): string =>
  dateKey(time.year, time.month, time.day);

/** `YYYY-MM-DD` → midnight-UTC Date, purely for ordering and horizon compares. */
const keyToDate = (key: string): Date => new Date(`${key}T00:00:00.000Z`);

const addDays = (key: string, days: number): string => {
  const d = keyToDate(key);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * A real UTC instant for a timed value.
 *
 * `toJSDate()` is right when the value carries a zone (a `Z` suffix, or a `TZID`
 * whose VTIMEZONE we registered below). When it is FLOATING, ical.js falls back
 * to the server's local timezone - which is an accident of deployment - so we
 * re-anchor the wall-clock components in the tour's zone instead.
 */
function toUtcInstant(time: ICAL.Time, fallbackTimeZone: string): Date {
  const tzid = time.zone?.tzid;
  if (tzid && tzid !== 'floating') return time.toJSDate();

  const wallClock = new Date(
    Date.UTC(
      time.year,
      time.month - 1,
      time.day,
      time.hour,
      time.minute,
      time.second,
    ),
  );
  return localWallClockToUtc(wallClock, fallbackTimeZone);
}

// ── pre-flight on the raw body ───────────────────────────────────────────────

/**
 * Cheap structural checks before handing anything to the parser.
 *
 * The `END:VCALENDAR` check earns its keep: a body that stops early parses into
 * a VALID but SHORTER calendar, which is indistinguishable from a feed whose
 * later bookings were all cancelled. Applying that would release dates the
 * operator has actually sold, so a truncated download is rejected outright and
 * classed transient so the next poll retries it.
 */
function preflight(body: string): IcalParseFailure | null {
  const text = body.replace(/^\uFEFF/, '').trim();

  if (!/^BEGIN:VCALENDAR/i.test(text)) {
    return {
      ok: false,
      code: 'NOT_A_CALENDAR',
      message:
        'This is not a calendar feed. You may have copied the page address instead of the export link.',
      transient: false,
    };
  }
  if (!/END:VCALENDAR\s*$/i.test(text)) {
    return {
      ok: false,
      code: 'TRUNCATED_FEED',
      message: 'The calendar download was incomplete. We will try again.',
      transient: true,
    };
  }
  return null;
}

// ── main ─────────────────────────────────────────────────────────────────────

export function parseBusyBlocks(
  body: string,
  options: IcalParseOptions,
): IcalParseResult {
  const failed = preflight(body);
  if (failed) return failed;

  let calendar: ICAL.Component;
  try {
    calendar = new ICAL.Component(ICAL.parse(body.replace(/^\uFEFF/, '')));
  } catch {
    return {
      ok: false,
      code: 'MALFORMED_ICS',
      message: 'We could not read this calendar file.',
      transient: false,
    };
  }

  const skipped: Partial<Record<SkipReason, number>> = {};
  const skip = (reason: SkipReason) => {
    skipped[reason] = (skipped[reason] ?? 0) + 1;
  };

  // VTIMEZONE definitions are registered GLOBALLY in ical.js, so two feeds
  // disagreeing about one TZID would contaminate each other. Register only what
  // this document defines and was not already known, then undo it in `finally`.
  const registered: string[] = [];
  for (const vtimezone of calendar.getAllSubcomponents('vtimezone')) {
    try {
      const zone = new ICAL.Timezone(vtimezone);
      if (zone.tzid && !ICAL.TimezoneService.has(zone.tzid)) {
        // Timezone first, optional name second - the reverse order silently
        // registers nothing useful and leaves every TZID value floating.
        ICAL.TimezoneService.register(zone);
        registered.push(zone.tzid);
      }
    } catch {
      // A broken VTIMEZONE is not worth failing the feed for; its events fall
      // back to the tour timezone like any other floating value.
    }
  }

  try {
    const vevents = calendar.getAllSubcomponents('vevent');
    const blocks = collectBlocks(vevents, options, skip);

    // Collection stops AT the cap (see `push`), so hitting it exactly is the
    // signal that a feed had more to give. Ordering is by date for the
    // caller's benefit; it can no longer choose the globally-earliest events,
    // because knowing which those are would mean expanding everything first -
    // precisely the work the cap exists to avoid. The horizon bound already
    // confines blocks to the window that matters.
    blocks.sort((a, b) => a.startDateKey.localeCompare(b.startDateKey));
    const truncated = blocks.length >= LIMITS.maxEvents;

    return {
      ok: true,
      blocks,
      eventsFound: vevents.length,
      skipped,
      truncated,
      calendarName:
        (calendar.getFirstPropertyValue('x-wr-calname') as string | null) ??
        null,
    };
  } finally {
    for (const tzid of registered) ICAL.TimezoneService.remove(tzid);
  }
}

/** Group by UID, attach RECURRENCE-ID overrides, then expand each master. */
function collectBlocks(
  vevents: ICAL.Component[],
  options: IcalParseOptions,
  skip: (reason: SkipReason) => void,
): BusyBlock[] {
  const byUid = new Map<
    string,
    { master?: ICAL.Event; exceptions: ICAL.Event[] }
  >();
  const anonymous: ICAL.Event[] = [];

  for (const vevent of vevents) {
    let event: ICAL.Event;
    try {
      event = new ICAL.Event(vevent);
    } catch {
      skip('unparseable');
      continue;
    }
    if (!event.uid) {
      anonymous.push(event);
      continue;
    }
    const entry = byUid.get(event.uid) ?? { exceptions: [] };
    if (event.isRecurrenceException()) entry.exceptions.push(event);
    else entry.master = event; // last one wins if a feed repeats a UID
    byUid.set(event.uid, entry);
  }

  const blocks: BusyBlock[] = [];
  const seen = new Set<string>();

  /**
   * Returns `false` once the cap is reached, which every caller treats as
   * "stop expanding".
   *
   * The cap MUST be enforced here rather than by slicing the finished array.
   * Each VEVENT can expand to `maxInstancesPerRule` occurrences, so a feed of
   * tens of thousands of tiny recurring events multiplies into millions of
   * blocks - built synchronously, with nothing awaiting, on the thread serving
   * requests. Capping afterwards means paying that cost in full and then
   * throwing the result away; capping here means never paying it.
   */
  const push = (block: BusyBlock): boolean => {
    if (blocks.length >= LIMITS.maxEvents) return false;
    const key = `${block.externalUid}|${block.startDateKey}`;
    if (seen.has(key)) return true; // a feed repeating one occurrence is not two blocks
    seen.add(key);
    blocks.push(block);
    return true;
  };
  const atCap = () => blocks.length >= LIMITS.maxEvents;

  for (const { master, exceptions } of byUid.values()) {
    if (atCap()) break;
    if (!master) {
      // Overrides with no master: nothing to expand, treat each as a one-off.
      for (const orphan of exceptions) {
        if (atCap()) break;
        emitSingle(orphan, options, skip, push, true);
      }
      continue;
    }
    // Lets getOccurrenceDetails() return the OVERRIDDEN times for a moved or
    // re-timed occurrence instead of the ones the RRULE would have generated.
    for (const exception of exceptions) master.relateException(exception);

    if (master.isRecurring()) emitRecurring(master, options, skip, push);
    else emitSingle(master, options, skip, push, false);
  }

  for (const event of anonymous) {
    if (atCap()) break;
    emitSingle(event, options, skip, push, false);
  }

  return blocks;
}

/** Shared per-event gate: cancelled, transparent, and a usable DTSTART. */
function usable(
  event: ICAL.Event,
  skip: (reason: SkipReason) => void,
): boolean {
  const status = event.component.getFirstPropertyValue('status');
  if (typeof status === 'string' && status.toUpperCase() === 'CANCELLED') {
    skip('cancelled');
    return false;
  }
  // TRANSPARENT means "this does not consume time" - a reminder, not a booking.
  const transp = event.component.getFirstPropertyValue('transp');
  if (typeof transp === 'string' && transp.toUpperCase() === 'TRANSPARENT') {
    skip('transparent');
    return false;
  }
  if (!event.startDate) {
    skip('no-dtstart');
    return false;
  }
  return true;
}

function emitSingle(
  event: ICAL.Event,
  options: IcalParseOptions,
  skip: (reason: SkipReason) => void,
  push: (block: BusyBlock) => boolean,
  isRecurrenceInstance: boolean,
): void {
  if (!usable(event, skip)) return;
  const block = buildBlock(
    event.startDate,
    event.endDate,
    event.uid,
    event.summary,
    event.component.getFirstPropertyValue('rrule')?.toString() ?? null,
    isRecurrenceInstance,
    options,
    skip,
  );
  if (block) push(block);
}

function emitRecurring(
  master: ICAL.Event,
  options: IcalParseOptions,
  skip: (reason: SkipReason) => void,
  push: (block: BusyBlock) => boolean,
): void {
  const dtstart = master.component.getFirstPropertyValue('dtstart');
  if (!dtstart) {
    skip('no-dtstart');
    return;
  }
  if (!usable(master, skip)) return;

  const rrule =
    master.component.getFirstPropertyValue('rrule')?.toString() ?? null;
  let expansion: ICAL.RecurExpansion;
  try {
    expansion = new ICAL.RecurExpansion({
      component: master.component,
      dtstart: dtstart as ICAL.Time,
    });
  } catch {
    skip('unparseable');
    return;
  }

  // Expansion always starts at the first occurrence, so an old weekly rule burns
  // iterations before reaching the horizon - hence a hard instance cap as well
  // as the date bound. An infinite rule would otherwise never terminate.
  let emitted = 0;
  for (let i = 0; i < LIMITS.maxInstancesPerRule; i++) {
    const next = expansion.next();
    if (!next) break;

    // EXDATE and RDATE are already applied by RecurExpansion.
    const details = master.getOccurrenceDetails(next);
    const block = buildBlock(
      details.startDate,
      details.endDate,
      master.uid,
      details.item.summary ?? master.summary,
      rrule,
      true,
      options,
      // Occurrences before the horizon are normal for an old rule, not errors.
      () => undefined,
    );
    if (block) {
      // At the cap: stop expanding THIS rule too, not just this occurrence.
      if (!push(block)) break;
      emitted++;
    }
    if (keyToDate(keyOfTime(next)) > options.horizonEnd) break;
  }
  if (emitted === 0) skip('outside-horizon');
}

/** The one place exclusive-DTEND, span limits and the horizon are applied. */
function buildBlock(
  start: ICAL.Time,
  end: ICAL.Time | null,
  uid: string | null,
  summary: string | null,
  recurrenceRule: string | null,
  isRecurrenceInstance: boolean,
  options: IcalParseOptions,
  skip: (reason: SkipReason) => void,
): BusyBlock | null {
  const isAllDay = start.isDate;
  const startKey = keyOfTime(start);

  let endKey: string;
  if (isAllDay) {
    if (!end) {
      // No DTEND and no DURATION: RFC's default for a DATE value is one day.
      endKey = startKey;
    } else {
      const rawEnd = keyOfTime(end);
      // DTEND is EXCLUSIVE, so the last busy day is the one before it. Feeds
      // that get this wrong publish DTSTART == DTEND for a single day; treating
      // that literally would produce a zero-day block and silently drop it.
      endKey = rawEnd <= startKey ? startKey : addDays(rawEnd, -1);
    }
  } else {
    endKey = end ? keyOfTime(end) : startKey;
  }

  if (endKey < startKey) {
    skip('end-before-start');
    return null;
  }

  const spanDays =
    (keyToDate(endKey).getTime() - keyToDate(startKey).getTime()) / 86_400_000;
  if (spanDays > LIMITS.maxSpanDays) {
    skip('too-long');
    return null;
  }

  // Overlap, not containment: an event straddling the horizon edge still blocks
  // the part inside it.
  if (
    keyToDate(endKey) < options.horizonStart ||
    keyToDate(startKey) > options.horizonEnd
  ) {
    skip('outside-horizon');
    return null;
  }

  const startUtc = isAllDay
    ? null
    : toUtcInstant(start, options.fallbackTimeZone);
  const endUtc =
    isAllDay || !end ? null : toUtcInstant(end, options.fallbackTimeZone);

  return {
    // A feed with no UID still needs a stable identity across polls, or every
    // sync would look like "everything removed, everything re-added".
    externalUid: uid ?? synthesizeUid(startKey, endKey, summary),
    summary: summary ?? null,
    isAllDay,
    startDateKey: startKey,
    endDateKey: endKey,
    startUtc,
    endUtc,
    recurrenceRule,
    isRecurrenceInstance,
  };
}

function synthesizeUid(
  startKey: string,
  endKey: string,
  summary: string | null,
): string {
  const digest = createHash('sha256')
    .update(`${startKey}|${endKey}|${summary ?? ''}`)
    .digest('hex')
    .slice(0, 32);
  return `synthetic-${digest}`;
}
