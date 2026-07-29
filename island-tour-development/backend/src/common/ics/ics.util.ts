/**
 * RFC 5545 (iCalendar) writer - the single implementation for every calendar the
 * platform emits: the traveller's one-shot "add to calendar" attachment and the
 * operator's subscribable export feeds.
 *
 * Hand-rolled rather than a dependency because we only ever WRITE, and writing is
 * the easy half of the format. Its genuine traps are few and all handled here:
 * CRLF endings, text escaping, 75-OCTET folding, and UTC-only timestamps. (Reading
 * iCal is the opposite - RRULE, VTIMEZONE and exclusive DTEND make a parser a
 * library-sized job. Do not extend this file into one.)
 */

/** `20260522T080000Z` - the only date form a floating-free VEVENT needs. */
export function icsStamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
}

/**
 * Escape per RFC 5545 §3.3.11. Order matters: backslash first, or the escapes we
 * add below would themselves be escaped.
 */
export function escapeText(value: string): string {
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
export function fold(line: string): string {
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
 * VEVENT STATUS values we emit. `CANCELLED` matters more than it looks: a
 * subscriber that has already seen an event keeps it forever if we simply stop
 * including it, so a cancelled booking must be published AS cancelled rather
 * than dropped from the feed.
 */
export type IcsEventStatus = 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';

export interface IcsEvent {
  /** Stable across regenerations - a changed UID duplicates the event instead of updating it. */
  uid: string;
  /** REAL UTC instants (see `localWallClockToUtc`), never local wall-clock. */
  startUtc: Date;
  endUtc: Date;
  summary: string;
  description?: string | null;
  location?: string | null;
  status?: IcsEventStatus;
  /**
   * Bumped whenever the event's details change, so clients treat a re-fetch as an
   * update. Feeds derive it from the row's `updatedAt`; callers that emit an event
   * exactly once may omit it.
   */
  sequence?: number;
  /** The row's own last-write time, distinct from DTSTAMP (the generation time). */
  lastModifiedUtc?: Date | null;
}

export interface IcsCalendarOptions {
  /** Shown as the calendar's name in Google/Apple once subscribed (X-WR-CALNAME). */
  name?: string;
  /** Hint to subscribers for how often to poll. ISO 8601 duration, e.g. `PT1H`. */
  refreshInterval?: string;
  /** `PUBLISH` for a feed or a plain attachment; `REQUEST` would imply an invitation. */
  method?: 'PUBLISH' | 'REQUEST';
  /**
   * Overrides DTSTAMP, which otherwise defaults to "now".
   *
   * A subscribable feed MUST pass this, set to the last write time of the data it
   * renders. DTSTAMP is the only field that changes on an otherwise identical
   * regeneration, so leaving it as "now" makes every poll produce a different body,
   * which makes the ETag different, which means a conditional GET can never return
   * 304 and every client re-downloads the whole calendar forever. Pinning it to the
   * data's own mtime is both RFC-legal for METHOD:PUBLISH ("when the information was
   * created") and what makes caching work.
   */
  dtstamp?: Date;
}

/**
 * A complete VCALENDAR document. Emitting zero events is legal and is the correct
 * response for an operator with nothing scheduled - a subscriber must get an empty
 * calendar, not an error.
 */
export function buildCalendar(
  events: IcsEvent[],
  options: IcsCalendarOptions = {},
): string {
  // DTSTAMP is the GENERATION time, not the event time. One value is shared across
  // the whole document; feeds override it with the data's mtime so an unchanged feed
  // renders byte-identically (see `dtstamp`).
  const stamp = icsStamp(options.dtstamp ?? new Date());

  const lines: (string | null)[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Island Tours//Booking//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${options.method ?? 'PUBLISH'}`,
    options.name ? `X-WR-CALNAME:${escapeText(options.name)}` : null,
    options.refreshInterval
      ? `REFRESH-INTERVAL;VALUE=DURATION:${options.refreshInterval}`
      : null,
    // The pre-RFC-7986 spelling; Outlook and several older clients only honour this one.
    options.refreshInterval
      ? `X-PUBLISHED-TTL:${options.refreshInterval}`
      : null,
  ];

  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsStamp(event.startUtc)}`,
      `DTEND:${icsStamp(event.endUtc)}`,
      `SUMMARY:${escapeText(event.summary)}`,
      event.location ? `LOCATION:${escapeText(event.location)}` : null,
      event.description ? `DESCRIPTION:${escapeText(event.description)}` : null,
      event.lastModifiedUtc
        ? `LAST-MODIFIED:${icsStamp(event.lastModifiedUtc)}`
        : null,
      event.sequence !== undefined ? `SEQUENCE:${event.sequence}` : null,
      `STATUS:${event.status ?? 'CONFIRMED'}`,
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');

  // CRLF is mandatory (RFC 5545 §3.1); Outlook rejects bare LF outright.
  return (
    lines
      .filter((l): l is string => l !== null)
      .map(fold)
      .join('\r\n') + '\r\n'
  );
}

/**
 * `SEQUENCE` must be a non-negative integer that only ever grows for a given UID.
 * Unix SECONDS of the row's last write satisfies both and needs no counter column;
 * it stays inside a signed 32-bit int until 2038, which is the range every client
 * actually implements.
 */
export function sequenceFrom(updatedAt: Date): number {
  return Math.floor(updatedAt.getTime() / 1000);
}
