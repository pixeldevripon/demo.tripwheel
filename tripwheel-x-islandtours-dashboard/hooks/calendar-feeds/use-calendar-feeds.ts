'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { calendarFeedsApi } from '@/lib/api/calendar-feeds';
import type {
  CalendarFeed,
  CreateCalendarFeedPayload,
} from '@/types/calendar-feed';

export const calendarFeedKeys = {
  all: ['calendar-feeds'] as const,
  list: () => [...calendarFeedKeys.all, 'list'] as const,
};

const onError = (err: Error) =>
  toast.error(err.message || 'Calendar feed request failed');

/**
 * Fold a mutation's returned feed into the cached list.
 *
 * Create and rotate both answer with the COMPLETE feed, URL included, so the new
 * link is already in hand the moment the mutation resolves. Writing it here means
 * the row renders from the write's own response instead of waiting on the
 * follow-up list read - and keeps rendering if that read fails, which is the
 * difference between "here is your link" and the operator pressing Create,
 * getting a success toast, and landing back on the same Create button.
 *
 * One feed per kind is a backend invariant (`operatorId_kind` is unique and
 * create is idempotent per kind), so replacing by kind cannot drop a sibling.
 */
function upsertFeed(
  prev: CalendarFeed[] | undefined,
  feed: CalendarFeed,
): CalendarFeed[] {
  if (!prev) return [feed];
  const i = prev.findIndex((f) => f.kind === feed.kind);
  if (i === -1) return [...prev, feed];
  const next = [...prev];
  next[i] = feed;
  return next;
}

export function useCalendarFeeds() {
  return useQuery({
    queryKey: calendarFeedKeys.list(),
    queryFn: calendarFeedsApi.list,
  });
}

export function useCreateCalendarFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCalendarFeedPayload) =>
      calendarFeedsApi.create(payload),
    onSuccess: (created) => {
      qc.setQueryData<CalendarFeed[]>(calendarFeedKeys.list(), (prev) =>
        upsertFeed(prev, created),
      );
      qc.invalidateQueries({ queryKey: calendarFeedKeys.all });
      toast.success('Calendar feed ready');
    },
    onError,
  });
}

export function useRotateCalendarFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => calendarFeedsApi.rotate(id),
    onSuccess: (rotated) => {
      qc.setQueryData<CalendarFeed[]>(calendarFeedKeys.list(), (prev) =>
        upsertFeed(prev, rotated),
      );
      qc.invalidateQueries({ queryKey: calendarFeedKeys.all });
      toast.success('New link generated - re-add it on every device');
    },
    onError,
  });
}

export function useRevokeCalendarFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => calendarFeedsApi.revoke(id),
    // DELETE answers with no body, so there is nothing to fold in - drop the row
    // by id instead, for the same reason the other two seed theirs: the write
    // succeeded, and the screen should say so without a second round trip.
    onSuccess: (_void, id) => {
      qc.setQueryData<CalendarFeed[]>(calendarFeedKeys.list(), (prev) =>
        prev?.filter((f) => f.id !== id),
      );
      qc.invalidateQueries({ queryKey: calendarFeedKeys.all });
      toast.success('Calendar feed turned off');
    },
    onError,
  });
}
