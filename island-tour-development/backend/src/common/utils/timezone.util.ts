/**
 * Local-time helpers for availability.
 *
 * ## Model: everything is destination-local time
 * The platform operates in the destination's local time. A `Departure.localDateTimeStart`
 * stores the **local wall-clock** instant (e.g. 09:00 on the island), represented as a
 * `Z`-labelled `Date` so it round-trips byte-for-byte regardless of the server's clock —
 * `2026-07-01T09:00` ⇒ `2026-07-01T09:00:00.000Z`. We do NOT convert departure times to
 * UTC. The only place the real timezone offset is needed is turning the server's "now"
 * into a local "now" so cutoff comparisons stay in the same frame.
 */

/**
 * The offset (in milliseconds) of `timeZone` at the given absolute instant, i.e.
 * `localWallClock - utc`. Negative west of UTC. AST (e.g. Curaçao) → -4h → -14400000.
 * Uses the ICU data bundled with Node's `Intl`.
 */
export function timeZoneOffsetMs(timeZone: string, instant: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) map[p.type] = p.value;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * A local wall-clock time as a `Z`-labelled `Date` (the storage form for departures).
 * No timezone conversion — the components are taken verbatim as local time.
 */
export function localWallTime(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
}

/**
 * "Now" expressed in `timeZone`'s local wall-clock, as a `Z`-labelled `Date` — so it
 * can be compared directly against stored local departure/cutoff times.
 */
export function localNow(timeZone: string, instant: Date = new Date()): Date {
  return new Date(instant.getTime() + timeZoneOffsetMs(timeZone, instant));
}

/** Parse `"HH:MM"` → `{ hour, minute }`; throws on malformed input. */
export function parseHhMm(value: string): { hour: number; minute: number } {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) throw new Error(`Invalid time "${value}" (expected HH:MM)`);
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) throw new Error(`Invalid time "${value}"`);
  return { hour, minute };
}

/** `YYYY-MM-DD` key for a (local, `Z`-labelled) date. */
export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
