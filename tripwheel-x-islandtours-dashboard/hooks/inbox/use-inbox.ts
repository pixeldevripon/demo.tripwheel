'use client';

import {
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query';

import { inboxApi } from '@/lib/api/inbox';
import type {
    ClearInboxPayload,
    InboxCategory,
    InboxListParams,
    InboxSummary,
    MarkInboxReadPayload,
} from '@/types/inbox';

export const inboxKeys = {
    all: ['inbox'] as const,
    summary: () => [...inboxKeys.all, 'summary'] as const,
    list: (params: InboxListParams) =>
        [...inboxKeys.all, 'list', params] as const,
};

/** How often the badge refreshes when a tab is open and focused. */
const SUMMARY_POLL_MS = 60_000;

/**
 * The bell count AND every sidebar badge, from one query.
 *
 * Polled rather than pushed: the stack has no SSE or WebSocket transport today,
 * and one indexed aggregate a minute is cheaper than introducing connection
 * management for it. `refetchOnWindowFocus` covers the case that actually
 * matters - coming back to the tab after doing something elsewhere - so the
 * interval only has to catch the idle case.
 *
 * The API shape is deliberately the same one an SSE stream would push, so
 * swapping the transport later touches this hook and nothing else.
 */
export function useInboxSummary(enabled = true) {
    return useQuery<InboxSummary>({
        queryKey: inboxKeys.summary(),
        queryFn: () => inboxApi.summary(),
        enabled,
        refetchInterval: SUMMARY_POLL_MS,
        refetchOnWindowFocus: true,
        // A stale badge for a few seconds is fine; a badge that refetches on
        // every component mount is not.
        staleTime: 15_000,
    });
}

/**
 * The list behind the bell. Fetched only when the popover opens (`enabled`),
 * so a dashboard left open all day pays for the summary and nothing else.
 */
export function useInboxList(
    params: Omit<InboxListParams, 'cursor'> = {},
    enabled = true,
) {
    return useInfiniteQuery({
        queryKey: inboxKeys.list(params),
        queryFn: ({ pageParam }) =>
            inboxApi.list({ ...params, cursor: pageParam as string | undefined }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: last => last.nextCursor ?? undefined,
        enabled,
    });
}

/**
 * Mark read, with an optimistic count.
 *
 * The optimism is on the SUMMARY only - the number the user is looking at when
 * they click. Rolling back a wrong list is messy; rolling back a count is one
 * value, and a failed request restores it exactly.
 */
export function useMarkInboxRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: MarkInboxReadPayload) =>
            inboxApi.markRead(payload),
        onMutate: async (payload) => {
            await queryClient.cancelQueries({ queryKey: inboxKeys.summary() });
            const previous = queryClient.getQueryData<InboxSummary>(
                inboxKeys.summary(),
            );
            if (previous) {
                queryClient.setQueryData<InboxSummary>(
                    inboxKeys.summary(),
                    optimisticSummary(previous, payload),
                );
            }
            return { previous };
        },
        onError: (_err, _payload, context) => {
            if (context?.previous) {
                queryClient.setQueryData(inboxKeys.summary(), context.previous);
            }
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: inboxKeys.all });
        },
    });
}

/**
 * What the summary looks like after this mark-read lands.
 *
 * `ids` cannot be resolved to categories from the summary alone, so that case
 * falls through to the refetch in `onSettled` rather than guessing - a badge
 * that flickers down and back up is worse than one that updates a beat late.
 */
function optimisticSummary(
    previous: InboxSummary,
    payload: MarkInboxReadPayload,
): InboxSummary {
    if (payload.all) {
        return { ...previous, unread: 0, byCategory: {} };
    }
    if (payload.category) {
        const cleared = previous.byCategory[payload.category] ?? 0;
        const byCategory: Partial<Record<InboxCategory, number>> = {
            ...previous.byCategory,
        };
        delete byCategory[payload.category];
        return {
            ...previous,
            unread: Math.max(0, previous.unread - cleared),
            byCategory,
        };
    }
    return previous;
}

/**
 * Delete notifications - the row's dismiss control and "Clear all".
 *
 * No optimism here, unlike mark-read. A clear removes rows from a list that is
 * on screen; rolling that back after a failed request means putting rows back
 * in the right order, and getting it subtly wrong is worse than the quarter
 * second the refetch costs.
 */
export function useClearInbox() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: ClearInboxPayload) => inboxApi.clear(payload),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: inboxKeys.all });
        },
    });
}

/** Dismiss one notification. */
export function useRemoveInboxNotification() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => inboxApi.remove(id),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: inboxKeys.all });
        },
    });
}
