/**
 * The confirmation email's "Add to calendar" file - one booking, one VEVENT.
 *
 * The RFC 5545 mechanics (CRLF, escaping, 75-octet folding, UTC stamps) live in
 * `@/common/ics/ics.util`, shared with the operator export feeds. This module is
 * only the booking-shaped projection onto that writer.
 */

import { buildCalendar } from '@/common/ics/ics.util';

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

/** A tour with no duration still needs an end; a zero-length event renders oddly. */
const DEFAULT_DURATION_MS = 3_600_000;

/**
 * A single-event calendar for a booking, or `null` when the booking has no
 * resolvable absolute start (pre-snapshot bookings with no timezone) - callers
 * should 404 rather than emit a calendar pinned to the wrong moment.
 */
export function buildBookingIcs(input: BookingIcsInput): string | null {
  if (!input.startUtc) return null;

  const summary = input.operatorName
    ? `${input.tourName} (${input.operatorName})`
    : input.tourName;

  return buildCalendar([
    {
      uid: `${input.publicRef}@island.tours`,
      startUtc: input.startUtc,
      endUtc:
        input.endUtc ??
        new Date(input.startUtc.getTime() + DEFAULT_DURATION_MS),
      summary,
      location: input.location,
      description:
        input.description ?? `Booking reference: ${input.displayRef}`,
      status: 'CONFIRMED',
    },
  ]);
}
