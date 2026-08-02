'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { calendarSubscriptionsApi } from '@/lib/api/calendar-subscriptions';
import { tripKeys } from '@/lib/trips/query-keys';
import type {
    CreateCalendarSubscriptionPayload,
    UpdateCalendarSubscriptionPayload,
} from '@/types/calendar-subscription';

export const calendarSubscriptionKeys = {
    all: ['calendar-subscriptions'] as const,
    byTour: (tourId: string) =>
        [...calendarSubscriptionKeys.all, tourId] as const,
    logs: (id: string) =>
        [...calendarSubscriptionKeys.all, 'logs', id] as const,
};

/** Run history for one connection. Fetched lazily - only when opened. */
export function useCalendarSyncLogs(id: string, enabled: boolean) {
    return useQuery({
        queryKey: calendarSubscriptionKeys.logs(id),
        queryFn: () => calendarSubscriptionsApi.syncLogs(id),
        enabled,
    });
}

const onError = (err: Error) =>
    toast.error(err.message || 'Calendar request failed');

export function useCalendarSubscriptions(tourId: string) {
    return useQuery({
        queryKey: calendarSubscriptionKeys.byTour(tourId),
        queryFn: () => calendarSubscriptionsApi.list(tourId),
        enabled: Boolean(tourId),
    });
}

/**
 * Anything that can change imported blocks has to invalidate the AVAILABILITY
 * views too, not just the connection list.
 *
 * A sync writes stop-sell exceptions and re-projects departures, so the month
 * calendar and the date-changes register are stale the moment it finishes.
 * Refreshing only the connection row would leave the operator looking at a
 * calendar that disagrees with the sync result they just read.
 */
function invalidateTourAvailability(
    queryClient: ReturnType<typeof useQueryClient>,
    tourId: string,
) {
    void queryClient.invalidateQueries({
        queryKey: calendarSubscriptionKeys.byTour(tourId),
    });
    void queryClient.invalidateQueries({
        queryKey: tripKeys.manageCalendarAll(tourId),
    });
    void queryClient.invalidateQueries({
        queryKey: tripKeys.exceptions(tourId),
    });
    // The history panel gains a row on every run, including the ones that
    // changed nothing - that IS the answer to "is it still running?".
    void queryClient.invalidateQueries({
        queryKey: [...calendarSubscriptionKeys.all, 'logs'],
    });
}

export function useValidateCalendarFeed() {
    return useMutation({
        mutationFn: ({ tourId, url }: { tourId: string; url: string }) =>
            calendarSubscriptionsApi.validate(tourId, url),
        // No toast: the verdict renders inline under the field, which is where
        // the operator is already looking.
    });
}

export function useCreateCalendarSubscription(tourId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateCalendarSubscriptionPayload) =>
            calendarSubscriptionsApi.create(payload),
        onSuccess: () => {
            invalidateTourAvailability(queryClient, tourId);
            toast.success('Calendar connected. First sync is running.');
        },
        onError,
    });
}

export function useUpdateCalendarSubscription(tourId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            payload,
        }: {
            id: string;
            payload: UpdateCalendarSubscriptionPayload;
        }) => calendarSubscriptionsApi.update(id, payload),
        onSuccess: () => {
            invalidateTourAvailability(queryClient, tourId);
            toast.success('Calendar updated');
        },
        onError,
    });
}

export function useSyncCalendarNow(tourId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => calendarSubscriptionsApi.syncNow(id),
        onSuccess: (result) => {
            invalidateTourAvailability(queryClient, tourId);

            if (result.errorCode) {
                toast.error(result.errorMessage ?? 'Sync failed');
                return;
            }
            // Report what CHANGED, not that it ran. A sync that did nothing is
            // the common case and should read as reassurance, not as success
            // theatre implying dates moved.
            const moved = result.blocksCreated + result.blocksRemoved;
            toast.success(
                moved === 0
                    ? 'Synced. Nothing changed.'
                    : `Synced. ${result.blocksCreated} date${result.blocksCreated === 1 ? '' : 's'} blocked, ${result.blocksRemoved} freed.`,
            );
        },
        onError,
    });
}

export function useDisconnectCalendar(tourId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            releaseDates,
        }: {
            id: string;
            releaseDates: boolean;
        }) => calendarSubscriptionsApi.disconnect(id, releaseDates),
        onSuccess: (result) => {
            invalidateTourAvailability(queryClient, tourId);
            toast.success(
                result.datesReleased > 0
                    ? `Disconnected. ${result.datesReleased} date${result.datesReleased === 1 ? '' : 's'} are available again.`
                    : `Disconnected. ${result.datesConvertedToManual} date${result.datesConvertedToManual === 1 ? '' : 's'} stay blocked as your own closures.`,
            );
        },
        onError,
    });
}
