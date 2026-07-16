import { buildBookingIcs, type BookingIcsInput } from './booking-ics.util';

function input(over: Partial<BookingIcsInput> = {}): BookingIcsInput {
  return {
    publicRef: 'pub-1',
    displayRef: 'IT-2026-04821',
    tourName: 'Klein Curacao Day Trip',
    operatorName: 'Miss Ann Boat Trips',
    startUtc: new Date(Date.UTC(2026, 4, 22, 12, 0)),
    endUtc: new Date(Date.UTC(2026, 4, 22, 21, 0)),
    location: 'Sint Annabaai Pier',
    description: 'Booking reference: IT-2026-04821',
    ...over,
  };
}

describe('buildBookingIcs', () => {
  it('emits a single well-formed VEVENT in UTC', () => {
    const ics = buildBookingIcs(input()) as string;
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('DTSTART:20260522T120000Z');
    expect(ics).toContain('DTEND:20260522T210000Z');
    expect(ics).toContain('UID:pub-1@island.tours');
    expect(ics).toContain('STATUS:CONFIRMED');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain('END:VCALENDAR');
  });

  // RFC 5545 §3.1 mandates CRLF; Outlook rejects bare LF outright.
  it('uses CRLF line endings everywhere', () => {
    const ics = buildBookingIcs(input()) as string;
    expect(ics).toMatch(/\r\n$/);
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('escapes commas, semicolons and newlines in text values', () => {
    const ics = buildBookingIcs(
      input({
        operatorName: null,
        tourName: 'Snorkel, Swim; Dive',
        location: 'Pier 1\nWillemstad',
      }),
    ) as string;
    expect(ics).toContain('SUMMARY:Snorkel\\, Swim\\; Dive');
    expect(ics).toContain('LOCATION:Pier 1\\nWillemstad');
  });

  it('escapes backslashes without double-escaping the escapes it adds', () => {
    const ics = buildBookingIcs(
      input({ operatorName: null, tourName: 'A\\B,C' }),
    ) as string;
    expect(ics).toContain('SUMMARY:A\\\\B\\,C');
  });

  // Folding is defined in OCTETS, so an accented or CJK name is the real test.
  describe('line folding (75 octets)', () => {
    it('folds a long line with a leading space on continuations', () => {
      const ics = buildBookingIcs(
        input({ operatorName: null, tourName: 'A'.repeat(200) }),
      ) as string;
      for (const line of ics.split('\r\n')) {
        expect(Buffer.from(line, 'utf8').length).toBeLessThanOrEqual(75);
      }
      expect(ics).toContain('\r\n ');
    });

    it('never splits a multi-byte character across a fold', () => {
      const ics = buildBookingIcs(
        input({
          operatorName: null,
          tourName: '克莱恩库拉索岛一日游'.repeat(12),
        }),
      ) as string;
      // A split mid-sequence would surface as U+FFFD after the round trip.
      expect(ics).not.toContain('�');
      for (const line of ics.split('\r\n')) {
        expect(Buffer.from(line, 'utf8').length).toBeLessThanOrEqual(75);
      }
    });
  });

  it('defaults to a one-hour event when the tour has no end', () => {
    const ics = buildBookingIcs(input({ endUtc: null })) as string;
    expect(ics).toContain('DTEND:20260522T130000Z');
  });

  it('omits LOCATION rather than emitting an empty one', () => {
    const ics = buildBookingIcs(input({ location: null })) as string;
    expect(ics).not.toContain('LOCATION:');
  });

  it('returns null when there is no start instant to pin the event to', () => {
    expect(buildBookingIcs(input({ startUtc: null }))).toBeNull();
  });
});
