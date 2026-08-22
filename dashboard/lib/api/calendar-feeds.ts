import type {
  CalendarFeed,
  CreateCalendarFeedPayload,
} from '@/types/calendar-feed';
import { apiFetch } from './fetch';

/**
 * Calendar export feeds. Every call is implicitly scoped to the caller's own
 * operator - the backend resolves it from the session and there is no operatorId
 * on the wire, so one operator can never address another's feeds.
 */
export const calendarFeedsApi = {
  list(): Promise<CalendarFeed[]> {
    return apiFetch<CalendarFeed[]>('/calendar-feeds');
  },

  /** Idempotent per kind: returns the existing feed rather than minting a second. */
  create(payload: CreateCalendarFeedPayload): Promise<CalendarFeed> {
    return apiFetch<CalendarFeed>('/calendar-feeds', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** New token. Every device already subscribed to the old URL stops updating. */
  rotate(id: string): Promise<CalendarFeed> {
    return apiFetch<CalendarFeed>(`/calendar-feeds/${id}/rotate`, {
      method: 'POST',
    });
  },

  revoke(id: string): Promise<void> {
    return apiFetch<void>(`/calendar-feeds/${id}`, { method: 'DELETE' });
  },
};
