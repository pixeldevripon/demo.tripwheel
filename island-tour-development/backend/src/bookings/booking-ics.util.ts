/**
 * Minimal RFC 5545 VEVENT builder for the confirmation email's "Add to calendar".
 *
 * Hand-rolled rather than a dependency: we emit exactly one all-defaults event, and
 * the format's genuine traps are few and handled below (CRLF, escaping, 75-octet
 * folding, UTC stamps).
 */

export type BookingIcsInput = {
  /** Stable UID - the booking's public ref, so re-adding updates rather than duplicates. */
  publicRef: string;
  tourName: string;
  operatorName: string | null;
  /** REAL UTC instants. Null start = no calendar file can be built. */
  startUtc: Date | null;
  endUtc: Date | null;
  location: string | null;
  description: string | null;
  displayRef: string;
};

/** `20260522T080000Z` - the only date form a floating-free VEVENT needs. */
function icsStamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
}

/**
 * Escape per RFC 5545 §3.3.11. Order matters: backslash first, or the escapes we
 * add below would themselves be escaped.
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Fold to 75 OCTETS per line (RFC 5545 §3.1) - octets, not characters, so a tour
 * name with an accent or CJK cannot push a line over and corrupt the file. Split
 * points are chosen on the encoded buffer and never inside a multi-byte sequence.
 */
function fold(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let cursor = 0;
  let limit = 75;
  while (cursor < bytes.length) {
    let end = Math.min(cursor + limit, bytes.length);
    // Back off to a UTF-8 boundary: continuation bytes are 10xxxxxx.
    while (end > cursor && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
      end--;
    }
    parts.push(bytes.subarray(cursor, end).toString('utf8'));
    cursor = end;
    limit = 74; // continuation lines carry a leading space
  }
  return parts.join('\r\n ');
}

/**
 * A single-event calendar for a booking, or `null` when the booking has no
 * resolvable absolute start (pre-snapshot bookings with no timezone) - callers
 * should 404 rather than emit a calendar pinned to the wrong moment.
 */
export function buildBookingIcs(input: BookingIcsInput): string | null {
  if (!input.startUtc) return null;

  // A tour with no duration still needs an end; a zero-length event renders oddly
  // in most clients, so default to an hour.
  const end = input.endUtc ?? new Date(input.startUtc.getTime() + 3_600_000);

  const summary = input.operatorName
    ? `${input.tourName} (${input.operatorName})`
    : input.tourName;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Island Tours//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${input.publicRef}@island.tours`,
    // DTSTAMP must be the generation time, not the event time.
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(input.startUtc)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${escapeText(summary)}`,
    input.location ? `LOCATION:${escapeText(input.location)}` : null,
    `DESCRIPTION:${escapeText(input.description ?? `Booking reference: ${input.displayRef}`)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter((l): l is string => l !== null);

  // CRLF is mandatory (RFC 5545 §3.1); Outlook rejects bare LF outright.
  return lines.map(fold).join('\r\n') + '\r\n';
}
