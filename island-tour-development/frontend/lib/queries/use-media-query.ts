'use client';

/**
 * TanStack Query hooks for the media gallery.
 *
 * Key behaviours:
 *  - `refetchOnWindowFocus: true`  → gallery auto-refreshes when user returns to tab
 *  - `staleTime: 30s`              → avoids excessive re-fetches while actively using the page
 *  - Mutations auto-invalidate the media list query on success
 */

import { bulkDeleteMedia, deleteMedia, getAllMedia } from '@/app/_actions/mediaActions';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { MediaItem } from '@/components/dashboard/media/media-item';

/* ─── Query key factory ──────────────────────────────────────────────────── */

export const mediaKeys = {
    all: ['media'] as const,
    list: (query?: string) => [...mediaKeys.all, 'list', query ?? ''] as const,
};

/* ─── Fetch hook ─────────────────────────────────────────────────────────── */

/**
 * Fetches the user's media library.
 *
 * `refetchOnWindowFocus` is intentionally `true` (TanStack Query default) so
 * that when a user leaves the media tab (e.g. to drag a file in Finder) and
 * returns, the gallery is re-synced automatically.
 */
export function useMediaList(queryString = 'limit=100&page=1', initialData?: MediaItem[]) {
    return useQuery({
        queryKey: mediaKeys.list(queryString),
        queryFn: async () => {
            const res = await getAllMedia(queryString);
            if (!res?.success) {
                throw new Error(res?.error ?? 'Failed to fetch media');
            }
            return (res.result?.media ?? []) as MediaItem[];
        },
        // Seed with SSR data so first paint is instant
        initialData: initialData?.length ? initialData : undefined,
        // Mark SSR data as immediately stale so a background refetch runs on mount
        initialDataUpdatedAt: initialData?.length ? 0 : undefined,
        staleTime: 30 * 1000,
        // THE KEY FIX: when user switches back to this tab, gallery re-syncs automatically
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
    });
}

/* ─── Delete mutation ────────────────────────────────────────────────────── */

export function useDeleteMedia() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteMedia(id),
        onSuccess: (result) => {
            if (result?.success) {
                // Invalidate so the list refetches with the item removed
                queryClient.invalidateQueries({ queryKey: mediaKeys.all });
                toast.success('Media deleted successfully');
            } else {
                toast.error(result?.error ?? 'Delete failed');
            }
        },
        onError: () => {
            toast.error('An unexpected error occurred');
        },
    });
}

/* ─── Bulk-delete mutation ───────────────────────────────────────────────── */

export function useBulkDeleteMedia() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (ids: string[]) => bulkDeleteMedia(ids),
        onSuccess: (result) => {
            if (result?.success) {
                queryClient.invalidateQueries({ queryKey: mediaKeys.all });
                const count = result.result?.count ?? 0;
                toast.success(`${count} media file${count !== 1 ? 's' : ''} deleted`);
            } else {
                toast.error(result?.error ?? 'Bulk delete failed');
            }
        },
        onError: () => {
            toast.error('An unexpected error occurred');
        },
    });
}

/* ─── Utility: add newly uploaded items into the cache directly ──────────── */

/**
 * Call this after a successful upload to insert the new items at the top of
 * the cache — no extra network round-trip required.
 */
export function prependMediaToCache(
    queryClient: ReturnType<typeof useQueryClient>,
    items: MediaItem[]
) {
    queryClient.setQueryData<MediaItem[]>(
        mediaKeys.list('limit=100&page=1'),
        (old) => [...items, ...(old ?? [])]
    );
}
