'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mediaApi } from '@/lib/api/media';
import type { MediaItem } from '@/types/media';
import { toast } from 'sonner';

export const mediaKeys = {
  all: ['media'] as const,
  list: (query?: string) => [...mediaKeys.all, 'list', query ?? ''] as const,
};

export function useMediaList(queryString = 'limit=100&page=1', initialData?: MediaItem[]) {
  return useQuery({
    queryKey: mediaKeys.list(queryString),
    queryFn: () => mediaApi.getAll(queryString),
    // Seed with SSR data so first paint is instant
    initialData: initialData?.length ? initialData : undefined,
    // Mark SSR data as immediately stale so a background refetch runs on mount
    initialDataUpdatedAt: initialData?.length ? 0 : undefined,
    staleTime: 30 * 1000,
    // When user switches back to this tab, gallery re-syncs automatically
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useDeleteMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => mediaApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mediaKeys.all });
      toast.success('Media deleted successfully');
    },
    onError: (err: Error) => {
      queryClient.invalidateQueries({ queryKey: mediaKeys.all });
      toast.error(err.message || 'Delete failed');
    },
  });
}

export function useBulkDeleteMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => mediaApi.bulkDelete(ids),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: mediaKeys.all });
      const count = data.deleted ?? 0;
      toast.success(`${count} media file${count !== 1 ? 's' : ''} deleted`);
    },
    onError: (err: Error) => {
      queryClient.invalidateQueries({ queryKey: mediaKeys.all });
      toast.error(err.message || 'Bulk delete failed');
    },
  });
}

export function prependMediaToCache(
  queryClient: ReturnType<typeof useQueryClient>,
  items: MediaItem[]
) {
  queryClient.setQueryData<MediaItem[]>(
    mediaKeys.list('limit=100&page=1'),
    (old) => [...items, ...(old ?? [])]
  );
}
