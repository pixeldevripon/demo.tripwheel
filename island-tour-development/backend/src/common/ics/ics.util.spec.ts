/**
 * Unit tests for the shared RFC 5545 writer. The single-booking projection has its
 * own spec (`bookings/booking-ics.util.spec.ts`); this covers the multi-event and
 * feed-specific behaviour that the export calendars depend on.
 */
import { buildCalendar, sequenceFrom, type IcsEvent } from './ics.util';

function event(over: Partial<IcsEvent> = {}): IcsEvent {
  return {
    uid: 'e1@island.tours',
    startUtc: new Date(Date.UTC(2026, 4, 22, 12, 0)),
    endUtc: new Date(Date.UTC(2026, 4, 22, 21, 0)),
    summary: 'Klein Curacao Day Trip - 4 guests',
    ...over,
  };
}

describe('buildCalendar', () => {
  it('emits one VEVENT per event, in order', () => {
    const ics = buildCalendar([
      event({ uid: 'a@island.tours' }),
      event({ uid: 'b@island.tours' }),
      event({ uid: 'c@island.tours' }),
    ]);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(ics.match(/END:VEVENT/g)).toHaveLength(3);
    expect(ics.indexOf('UID:a@')).toBeLessThan(ics.indexOf('UID:b@'));
    expect(ics.indexOf('UID:b@')).toBeLessThan(ics.indexOf('UID:c@'));
  });

  // An empty calendar is the right answer for an operator with nothing booked -
  // a subscriber must get a valid document, not an error.
  it('emits a valid empty calendar', () => {
    const ics = buildCalendar([]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  it('uses CRLF endings throughout', () => {
    const ics = buildCalendar([event()]);
    expect(ics).toMatch(/\r\n$/);
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });

  /**
   * The whole reason conditional GET works. If DTSTAMP defaulted to "now" on a feed,
   * every poll would produce a different body and therefore a different ETag, and no
   * client would ever get a 304.
   */
  describe('dtstamp', () => {
    it('renders byte-identically for identical data', () => {
      const stamp = new Date(Date.UTC(2026, 4, 1, 8, 30));
      const first = buildCalendar([event()], { dtstamp: stamp });
      const second = buildCalendar([event()], { dtstamp: stamp });
      expect(first).toBe(second);
      expect(first).toContain('DTSTAMP:20260501T083000Z');
    });

    it('falls back to generation time when not pinned', () => {
      const ics = buildCalendar([event()]);
      expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
    });
  });

  describe('feed headers', () => {
    it('names the calendar and advertises a refresh interval in both spellings', () => {
      const ics = buildCalendar([], {
        name: 'Miss Ann Boat Trips - Bookings',
        refreshInterval: 'PT1H',
      });
      expect(ics).toContain('X-WR-CALNAME:Miss Ann Boat Trips - Bookings');
      expect(ics).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT1H');
      // Outlook and older clients only honour the legacy property.
      expect(ics).toContain('X-PUBLISHED-TTL:PT1H');
    });

    it('omits the optional headers entirely rather than emitting empty ones', () => {
      const ics = buildCalendar([event()]);
      expect(ics).not.toContain('X-WR-CALNAME');
      expect(ics).not.toContain('REFRESH-INTERVAL');
    });
  });

  describe('per-event fields', () => {
    it('publishes a cancellation as STATUS:CANCELLED', () => {
      const ics = buildCalendar([event({ status: 'CANCELLED' })]);
      expect(ics).toContain('STATUS:CANCELLED');
    });

    it('defaults to CONFIRMED', () => {
      expect(buildCalendar([event()])).toContain('STATUS:CONFIRMED');
    });

    it('emits SEQUENCE and LAST-MODIFIED when supplied', () => {
      const updatedAt = new Date(Date.UTC(2026, 4, 2, 9, 15));
      const ics = buildCalendar([
        event({
          sequence: sequenceFrom(updatedAt),
          lastModifiedUtc: updatedAt,
        }),
      ]);
      expect(ics).toContain(`SEQUENCE:${sequenceFrom(updatedAt)}`);
      expect(ics).toContain('LAST-MODIFIED:20260502T091500Z');
    });

    it('omits SEQUENCE when the caller has no version to report', () => {
      expect(buildCalendar([event()])).not.toContain('SEQUENCE:');
    });

    it('escapes text in every field, not just the summary', () => {
      const ics = buildCalendar([
        event({
          summary: 'Snorkel, Swim; Dive',
          description: 'Ref: IT-1\nGuests: 2',
          location: 'Pier 1, Willemstad',
        }),
      ]);
      expect(ics).toContain('SUMMARY:Snorkel\\, Swim\\; Dive');
      expect(ics).toContain('DESCRIPTION:Ref: IT-1\\nGuests: 2');
      expect(ics).toContain('LOCATION:Pier 1\\, Willemstad');
    });

    // Folding is defined in OCTETS, so multi-byte text is the real test.
    it('folds every line to 75 octets without splitting a character', () => {
      const ics = buildCalendar([
        event({
          summary: '克莱恩库拉索岛一日游'.repeat(12),
          description: 'A'.repeat(300),
        }),
      ]);
      expect(ics).not.toContain('�');
      for (const line of ics.split('\r\n')) {
        expect(Buffer.from(line, 'utf8').length).toBeLessThanOrEqual(75);
      }
    });
  });
});

describe('sequenceFrom', () => {
  it('is non-negative and grows with the write time', () => {
    const earlier = sequenceFrom(new Date(Date.UTC(2026, 0, 1)));
    const later = sequenceFrom(new Date(Date.UTC(2026, 0, 2)));
    expect(earlier).toBeGreaterThan(0);
    expect(later).toBeGreaterThan(earlier);
    expect(Number.isInteger(later)).toBe(true);
  });
});
