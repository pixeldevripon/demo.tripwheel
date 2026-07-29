'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { calendarFeedsApi } from '@/lib/api/calendar-feeds';
import type { CreateCalendarFeedPayload } from '@/types/calendar-feed';

export const calendarFeedKeys = {
  all: ['calendar-feeds'] as const,
  list: () => [...calendarFeedKeys.all, 'list'] as const,
};

const onError = (err: Error) =>
  toast.error(err.message || 'Calendar feed request failed');

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
    onSuccess: () => {
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
    onSuccess: () => {
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calendarFeedKeys.all });
      toast.success('Calendar feed turned off');
    },
    onError,
  });
}
