'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { mediaApi } from '@/lib/api/media';
import type { MediaItem, MediaListResponse } from '@/types/media';
import { toast } from 'sonner';

export const mediaKeys = {
  all: ['media'] as const,
  infinite: () => [...mediaKeys.all, 'infinite'] as const,
};

export const MEDIA_PAGE_SIZE = 50;

/**
 * Pages through the entire media library (the old useMediaList capped the
 * gallery at the first 100 items and silently hid the rest).
 */
export function useMediaInfinite() {
  return useInfiniteQuery({
    queryKey: mediaKeys.infinite(),
    queryFn: ({ pageParam }) => mediaApi.getPage(pageParam, MEDIA_PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.limit < last.total ? last.page + 1 : undefined,
    staleTime: 30 * 1000,
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

/** Insert freshly uploaded items at the top of the gallery without a refetch. */
export function prependMediaToCache(
  queryClient: ReturnType<typeof useQueryClient>,
  items: MediaItem[]
) {
  queryClient.setQueryData<InfiniteData<MediaListResponse>>(
    mediaKeys.infinite(),
    (old) => {
      if (!old?.pages.length) return old;
      const [first, ...rest] = old.pages;
      return {
        ...old,
        pages: [
          { ...first, data: [...items, ...first.data], total: first.total + items.length },
          ...rest,
        ],
      };
    }
  );
}

/** Optimistically remove items from every loaded gallery page. */
export function removeMediaFromCache(
  queryClient: ReturnType<typeof useQueryClient>,
  ids: string[]
) {
  queryClient.setQueryData<InfiniteData<MediaListResponse>>(
    mediaKeys.infinite(),
    (old) => {
      if (!old?.pages.length) return old;
      return {
        ...old,
        pages: old.pages.map((page) => {
          const kept = page.data.filter((item) => !ids.includes(item.id));
          return { ...page, data: kept, total: Math.max(0, page.total - (page.data.length - kept.length)) };
        }),
      };
    }
  );
}
