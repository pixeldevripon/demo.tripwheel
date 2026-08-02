import type {
    CalendarSubscription,
    CreateCalendarSubscriptionPayload,
    DisconnectResult,
    PaginatedSyncLogs,
    SyncRunResult,
    UpdateCalendarSubscriptionPayload,
    ValidateFeedResult,
} from '@/types/calendar-subscription';
import { apiFetch } from './fetch';

/**
 * Inbound calendar connections, scoped to one tour.
 *
 * The backend enforces ownership on every call (the caller's operator must own
 * the tour), so nothing here passes an operatorId.
 */
export const calendarSubscriptionsApi = {
    list(tourId: string): Promise<CalendarSubscription[]> {
        return apiFetch<CalendarSubscription[]>(
            `/calendar-subscriptions?tourId=${encodeURIComponent(tourId)}`,
        );
    },

    /**
     * Dry run: fetches and parses the feed and writes nothing.
     *
     * Always resolves - `valid` carries the verdict - so the form can show a
     * specific reason and hint instead of a generic failure.
     */
    validate(tourId: string, url: string): Promise<ValidateFeedResult> {
        return apiFetch<ValidateFeedResult>('/calendar-subscriptions/validate', {
            method: 'POST',
            body: JSON.stringify({ tourId, url }),
        });
    },

    create(
        payload: CreateCalendarSubscriptionPayload,
    ): Promise<CalendarSubscription> {
        return apiFetch<CalendarSubscription>('/calendar-subscriptions', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    update(
        id: string,
        payload: UpdateCalendarSubscriptionPayload,
    ): Promise<CalendarSubscription> {
        return apiFetch<CalendarSubscription>(`/calendar-subscriptions/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        });
    },

    /** Run history, newest first. Answers "why did my dates change". */
    syncLogs(id: string, limit = 10): Promise<PaginatedSyncLogs> {
        return apiFetch<PaginatedSyncLogs>(
            `/calendar-subscriptions/${id}/sync-logs?limit=${limit}`,
        );
    },

    syncNow(id: string): Promise<SyncRunResult> {
        return apiFetch<SyncRunResult>(`/calendar-subscriptions/${id}/sync`, {
            method: 'POST',
        });
    },

    /**
     * `releaseDates` defaults to false, matching the backend: a channel that
     * stopped syncing is not a channel whose dates became free.
     */
    disconnect(id: string, releaseDates: boolean): Promise<DisconnectResult> {
        return apiFetch<DisconnectResult>(`/calendar-subscriptions/${id}`, {
            method: 'DELETE',
            body: JSON.stringify({ releaseDates }),
        });
    },
};
