/**
 * Parser tests built from the shapes real channels emit, including the ugly ones.
 *
 * The PRD asks for exactly this: "capture real feeds from every supported channel
 * ... include the ugly ones: missing VERSION, LF-only line endings, inclusive
 * DTEND, reused UID, cancelled events". Every case below is a regression test for
 * something that silently blocks or unblocks a date an operator can sell.
 */
import { parseBusyBlocks, type IcalParseSuccess } from './ical-parser.util';

const OPTIONS = {
  fallbackTimeZone: 'America/Curacao',
  horizonStart: new Date('2026-01-01T00:00:00.000Z'),
  horizonEnd: new Date('2027-12-31T00:00:00.000Z'),
};

/** Assemble a VCALENDAR with CRLF, the way a real feed arrives. */
const ics = (...lines: string[]) =>
  [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//test//EN',
    ...lines,
    'END:VCALENDAR',
  ].join('\r\n');

const vevent = (...lines: string[]) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'];

const ok = (body: string, options = OPTIONS): IcalParseSuccess => {
  const result = parseBusyBlocks(body, options);
  if (!result.ok) throw new Error(`expected success, got ${result.code}`);
  return result;
};

describe('parseBusyBlocks', () => {
  describe('the exclusive DTEND rule', () => {
    // The single most common bug in iCal integrations. 14→18 is FOUR nights:
    // the 14th, 15th, 16th and 17th. The 18th is checkout, and is bookable.
    it('treats an all-day DTEND as exclusive', () => {
      const { blocks } = ok(
        ics(
          ...vevent(
            'UID:booking-48219@airbnb.com',
            'DTSTART;VALUE=DATE:20260814',
            'DTEND;VALUE=DATE:20260818',
            'SUMMARY:Reserved',
          ),
        ),
      );
      expect(blocks).toHaveLength(1);
      expect(blocks[0].startDateKey).toBe('2026-08-14');
      expect(blocks[0].endDateKey).toBe('2026-08-17');
      expect(blocks[0].isAllDay).toBe(true);
    });

    // Some feeds publish an INCLUSIVE end. Applying the exclusive rule literally
    // would give a zero-day block and drop it, quietly losing a real booking.
    it('reads DTSTART == DTEND as one blocked day, not zero', () => {
      const { blocks } = ok(
        ics(
          ...vevent(
            'UID:same-day',
            'DTSTART;VALUE=DATE:20260601',
            'DTEND;VALUE=DATE:20260601',
          ),
        ),
      );
      expect(blocks).toHaveLength(1);
      expect(blocks[0].startDateKey).toBe('2026-06-01');
      expect(blocks[0].endDateKey).toBe('2026-06-01');
    });

    it('defaults a DTEND-less all-day event to a single day', () => {
      const { blocks } = ok(
        ics(...vevent('UID:no-end', 'DTSTART;VALUE=DATE:20260601')),
      );
      expect(blocks[0].endDateKey).toBe('2026-06-01');
    });
  });

  describe('all-day dates never pass through a timezone', () => {
    // ical.js resolves an all-day value against the SERVER's local zone, so on a
    // UTC+6 box `20260814` becomes 2026-08-13T18:00Z - the wrong calendar day.
    // Reading the components verbatim is what keeps this stable wherever we run.
    it('keeps the literal calendar date regardless of server or tour zone', () => {
      const body = ics(
        ...vevent(
          'UID:tz-proof',
          'DTSTART;VALUE=DATE:20260814',
          'DTEND;VALUE=DATE:20260815',
        ),
      );
      for (const zone of [
        'America/Curacao',
        'Asia/Dhaka',
        'Pacific/Kiritimati',
      ]) {
        const { blocks } = ok(body, { ...OPTIONS, fallbackTimeZone: zone });
        expect(blocks[0].startDateKey).toBe('2026-08-14');
      }
    });

    it('carries no instant for an all-day block', () => {
      const { blocks } = ok(
        ics(
          ...vevent(
            'UID:x',
            'DTSTART;VALUE=DATE:20260814',
            'DTEND;VALUE=DATE:20260815',
          ),
        ),
      );
      expect(blocks[0].startUtc).toBeNull();
      expect(blocks[0].endUtc).toBeNull();
    });
  });

  describe('timed events', () => {
    it('honours a Z suffix as a real instant', () => {
      const { blocks } = ok(
        ics(
          ...vevent(
            'UID:utc',
            'DTSTART:20260901T090000Z',
            'DTEND:20260901T170000Z',
          ),
        ),
      );
      expect(blocks[0].isAllDay).toBe(false);
      expect(blocks[0].startUtc?.toISOString()).toBe(
        '2026-09-01T09:00:00.000Z',
      );
    });

    // A floating value has no zone at all. Resolving it against the server's
    // local time would make imports depend on where the container runs.
    it('anchors a floating time in the tour timezone, not the server', () => {
      const body = ics(
        ...vevent(
          'UID:floating',
          'DTSTART:20260901T090000',
          'DTEND:20260901T170000',
        ),
      );
      const { blocks } = ok(body); // America/Curacao is UTC-4
      expect(blocks[0].startUtc?.toISOString()).toBe(
        '2026-09-01T13:00:00.000Z',
      );

      const dhaka = ok(body, { ...OPTIONS, fallbackTimeZone: 'Asia/Dhaka' }); // UTC+6
      expect(dhaka.blocks[0].startUtc?.toISOString()).toBe(
        '2026-09-01T03:00:00.000Z',
      );
    });

    it('resolves a TZID when the feed defines its VTIMEZONE', () => {
      const { blocks } = ok(
        ics(
          'BEGIN:VTIMEZONE',
          'TZID:America/Curacao',
          'BEGIN:STANDARD',
          'DTSTART:19700101T000000',
          'TZOFFSETFROM:-0400',
          'TZOFFSETTO:-0400',
          'TZNAME:AST',
          'END:STANDARD',
          'END:VTIMEZONE',
          ...vevent(
            'UID:tzid',
            'DTSTART;TZID=America/Curacao:20260901T090000',
            'DTEND;TZID=America/Curacao:20260901T170000',
          ),
        ),
      );
      expect(blocks[0].startUtc?.toISOString()).toBe(
        '2026-09-01T13:00:00.000Z',
      );
    });
  });

  describe('events that must be ignored', () => {
    it('drops STATUS:CANCELLED', () => {
      const result = ok(
        ics(
          ...vevent(
            'UID:cancelled',
            'DTSTART;VALUE=DATE:20260601',
            'DTEND;VALUE=DATE:20260602',
            'STATUS:CANCELLED',
          ),
        ),
      );
      expect(result.blocks).toHaveLength(0);
      expect(result.skipped.cancelled).toBe(1);
    });

    // TRANSPARENT means the event does not consume time - a reminder, not a booking.
    it('drops TRANSP:TRANSPARENT', () => {
      const result = ok(
        ics(
          ...vevent(
            'UID:free',
            'DTSTART;VALUE=DATE:20260601',
            'DTEND;VALUE=DATE:20260602',
            'TRANSP:TRANSPARENT',
          ),
        ),
      );
      expect(result.blocks).toHaveLength(0);
      expect(result.skipped.transparent).toBe(1);
    });

    it('drops events wholly outside the horizon without calling them errors', () => {
      const result = ok(
        ics(
          ...vevent(
            'UID:ancient',
            'DTSTART;VALUE=DATE:20200101',
            'DTEND;VALUE=DATE:20200105',
          ),
        ),
      );
      expect(result.blocks).toHaveLength(0);
      expect(result.skipped['outside-horizon']).toBe(1);
    });

    // A multi-year single event is a broken feed, not a real block - importing it
    // would close the tour for two years.
    it('drops an implausibly long event', () => {
      const result = ok(
        ics(
          ...vevent(
            'UID:forever',
            'DTSTART;VALUE=DATE:20260101',
            'DTEND;VALUE=DATE:20290101',
          ),
        ),
      );
      expect(result.blocks).toHaveLength(0);
      expect(result.skipped['too-long']).toBe(1);
    });

    it('keeps an event that merely straddles the horizon edge', () => {
      const { blocks } = ok(
        ics(
          ...vevent(
            'UID:edge',
            'DTSTART;VALUE=DATE:20251228',
            'DTEND;VALUE=DATE:20260105',
          ),
        ),
      );
      expect(blocks).toHaveLength(1);
    });

    it('keeps going when one event is unusable', () => {
      const result = ok(
        ics(
          ...vevent('UID:bad', 'SUMMARY:no dtstart at all'),
          ...vevent(
            'UID:good',
            'DTSTART;VALUE=DATE:20260601',
            'DTEND;VALUE=DATE:20260602',
          ),
        ),
      );
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].externalUid).toBe('good');
    });
  });

  describe('recurrence', () => {
    it('expands an RRULE into one block per occurrence', () => {
      const { blocks } = ok(
        ics(
          ...vevent(
            'UID:weekly',
            'DTSTART;VALUE=DATE:20260105',
            'DTEND;VALUE=DATE:20260106',
            'RRULE:FREQ=WEEKLY;COUNT=3',
          ),
        ),
      );
      expect(blocks.map((b) => b.startDateKey)).toEqual([
        '2026-01-05',
        '2026-01-12',
        '2026-01-19',
      ]);
      expect(blocks.every((b) => b.isRecurrenceInstance)).toBe(true);
      expect(blocks.every((b) => b.externalUid === 'weekly')).toBe(true);
    });

    it('honours EXDATE', () => {
      const { blocks } = ok(
        ics(
          ...vevent(
            'UID:weekly-gap',
            'DTSTART;VALUE=DATE:20260105',
            'DTEND;VALUE=DATE:20260106',
            'RRULE:FREQ=WEEKLY;COUNT=3',
            'EXDATE;VALUE=DATE:20260112',
          ),
        ),
      );
      expect(blocks.map((b) => b.startDateKey)).toEqual([
        '2026-01-05',
        '2026-01-19',
      ]);
    });

    // A moved occurrence must replace the generated one, not sit beside it.
    it('lets a RECURRENCE-ID override replace its occurrence', () => {
      const { blocks } = ok(
        ics(
          ...vevent(
            'UID:series',
            'DTSTART;VALUE=DATE:20260105',
            'DTEND;VALUE=DATE:20260106',
            'RRULE:FREQ=WEEKLY;COUNT=3',
            'SUMMARY:Master',
          ),
          ...vevent(
            'UID:series',
            'RECURRENCE-ID;VALUE=DATE:20260112',
            'DTSTART;VALUE=DATE:20260113',
            'DTEND;VALUE=DATE:20260115',
            'SUMMARY:Moved',
          ),
        ),
      );
      const moved = blocks.find((b) => b.summary === 'Moved');
      expect(moved).toBeDefined();
      expect(moved?.startDateKey).toBe('2026-01-13');
      expect(moved?.endDateKey).toBe('2026-01-14'); // 15th is exclusive
      expect(blocks.some((b) => b.startDateKey === '2026-01-12')).toBe(false);
    });

    it('caps an unbounded rule instead of expanding forever', () => {
      const { blocks } = ok(
        ics(
          ...vevent(
            'UID:endless',
            'DTSTART;VALUE=DATE:20260105',
            'DTEND;VALUE=DATE:20260106',
            'RRULE:FREQ=DAILY', // no COUNT, no UNTIL
          ),
        ),
      );
      expect(blocks.length).toBeGreaterThan(0);
      expect(blocks.length).toBeLessThanOrEqual(200);
    });
  });

  describe('identity', () => {
    // Without a stable UID every poll reads as "everything removed, everything
    // re-added", which would churn the operator's availability on every sync.
    it('synthesizes a deterministic UID when the feed omits one', () => {
      const body = ics(
        ...vevent(
          'DTSTART;VALUE=DATE:20260601',
          'DTEND;VALUE=DATE:20260603',
          'SUMMARY:Busy',
        ),
      );
      const first = ok(body).blocks[0].externalUid;
      const second = ok(body).blocks[0].externalUid;
      expect(first).toBe(second);
      expect(first).toMatch(/^synthetic-[0-9a-f]{32}$/);
    });

    it('collapses a duplicated occurrence rather than blocking it twice', () => {
      const { blocks } = ok(
        ics(
          ...vevent(
            'UID:dupe',
            'DTSTART;VALUE=DATE:20260601',
            'DTEND;VALUE=DATE:20260602',
          ),
          ...vevent(
            'UID:dupe',
            'DTSTART;VALUE=DATE:20260601',
            'DTEND;VALUE=DATE:20260602',
          ),
        ),
      );
      expect(blocks).toHaveLength(1);
    });
  });

  describe('tolerating real-world feeds', () => {
    it('accepts LF-only line endings and a missing VERSION', () => {
      const body =
        'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:lf\nDTSTART;VALUE=DATE:20260601\nDTEND;VALUE=DATE:20260602\nEND:VEVENT\nEND:VCALENDAR';
      expect(ok(body).blocks).toHaveLength(1);
    });

    it('unfolds a wrapped line', () => {
      const { blocks } = ok(
        ics(
          'BEGIN:VEVENT',
          'UID:folded',
          'DTSTART;VALUE=DATE:20260601',
          'DTEND;VALUE=DATE:20260602',
          'SUMMARY:A long summary that has been',
          '  folded across two lines',
          'END:VEVENT',
        ),
      );
      expect(blocks[0].summary).toBe(
        'A long summary that has been folded across two lines',
      );
    });

    it('reads the calendar name when present', () => {
      const result = ok(
        ics(
          'X-WR-CALNAME:Airbnb (Klein Curacao)',
          ...vevent(
            'UID:n',
            'DTSTART;VALUE=DATE:20260601',
            'DTEND;VALUE=DATE:20260602',
          ),
        ),
      );
      expect(result.calendarName).toBe('Airbnb (Klein Curacao)');
    });

    it('accepts a valid but empty calendar', () => {
      const result = ok(ics());
      expect(result.blocks).toHaveLength(0);
      expect(result.eventsFound).toBe(0);
    });
  });

  describe('rejections', () => {
    it('refuses an HTML page as permanent', () => {
      const result = parseBusyBlocks(
        '<!doctype html><html>login</html>',
        OPTIONS,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe('NOT_A_CALENDAR');
      expect(result.transient).toBe(false);
      expect(result.message).toContain('page address');
    });

    // A body that stops early parses into a valid but SHORTER calendar, which is
    // indistinguishable from "all the later bookings were cancelled". Applying it
    // would release dates the operator has actually sold.
    it('refuses a truncated body as TRANSIENT so the next poll retries', () => {
      const result = parseBusyBlocks(
        'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:cut\r\nDTSTART;VALUE=DATE:20260601',
        OPTIONS,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe('TRUNCATED_FEED');
      expect(result.transient).toBe(true);
    });

    it('refuses unparseable content that still has the wrapper', () => {
      const result = parseBusyBlocks(
        'BEGIN:VCALENDAR\r\n  garbage \r\nEND:VCALENDAR',
        OPTIONS,
      );
      if (result.ok) {
        // Tolerated as an empty calendar is also acceptable - what must never
        // happen is inventing blocks out of noise.
        expect(result.blocks).toHaveLength(0);
      } else {
        expect(result.code).toBe('MALFORMED_ICS');
      }
    });
  });

  /**
   * The cap is a DoS control, not a tidiness one.
   *
   * Parsing runs synchronously on the thread serving requests (`validate` and
   * the manual sync button both call it inline), and every VEVENT can expand to
   * `maxInstancesPerRule` occurrences. A feed of many small recurring events
   * therefore multiplies, and a cap applied by slicing the FINISHED array pays
   * the whole cost before discarding it. These tests pin the early exit.
   */
  describe('the event cap bounds work, not just output', () => {
    // 2,000 rules x 200 instances = 400,000 blocks if expansion runs to
    // completion. The cap is 5,000. Without the early exit this test takes
    // orders of magnitude longer and allocates ~80x more.
    const hostileFeed = ics(
      ...Array.from({ length: 2_000 }, (_, i) =>
        vevent(
          `UID:flood-${i}@evil.test`,
          'DTSTART;VALUE=DATE:20260101',
          'DTEND;VALUE=DATE:20260102',
          'RRULE:FREQ=DAILY;COUNT=200',
        ),
      ).flat(),
    );

    it('stops collecting at the cap and says so', () => {
      const result = ok(hostileFeed);
      expect(result.blocks.length).toBeLessThanOrEqual(5_000);
      expect(result.truncated).toBe(true);
    });

    it('finishes fast enough to prove expansion actually stopped', () => {
      const started = process.hrtime.bigint();
      ok(hostileFeed);
      const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
      // Generous: the point is that this cannot be the ~400k-block path, which
      // is slower by orders of magnitude, not to assert a precise budget.
      expect(elapsedMs).toBeLessThan(5_000);
    });

    it('still returns every block when a feed is under the cap', () => {
      const result = ok(
        ics(
          ...vevent(
            'UID:normal@airbnb.com',
            'DTSTART;VALUE=DATE:20260814',
            'DTEND;VALUE=DATE:20260816',
          ),
        ),
      );
      expect(result.truncated).toBe(false);
      expect(result.blocks).toHaveLength(1);
    });
  });
});
