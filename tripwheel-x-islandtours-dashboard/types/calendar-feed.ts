/**
 * Calendar export feeds - the subscribe URLs an operator adds to Google, Apple or
 * Outlook Calendar. Mirrors backend `src/calendar-feeds/dto/calendar-feed.dto.ts`.
 *
 * Export only: subscribing never writes back to availability.
 */

export const CalendarFeedKind = {
  /** One event per booking. Carries traveller names - treat the URL as a secret. */
  BOOKINGS: 'BOOKINGS',
  /** One event per departure with its fill. No traveller data; safe to share with a guide. */
  DEPARTURES: 'DEPARTURES',
  /**
   * For an OTA. Scoped to ONE tour, zero traveller data, contiguous all-day
   * ranges. The only kind that may be given to a sales channel.
   */
  CHANNEL: 'CHANNEL',
} as const;

export type CalendarFeedKind =
  (typeof CalendarFeedKind)[keyof typeof CalendarFeedKind];

export interface CalendarFeed {
  id: string;
  kind: CalendarFeedKind;
  /** Set only for CHANNEL, which is scoped to one tour. */
  tourId: string | null;
  label: string | null;
  /** The full subscribe URL, token included. */
  url: string;
  lastFetchedAt: string | null;
  fetchCount: number;
  createdAt: string;
}

export interface CreateCalendarFeedPayload {
  kind: CalendarFeedKind;
  label?: string;
  /** Required for CHANNEL, which is per tour. Ignored otherwise. */
  tourId?: string;
}
