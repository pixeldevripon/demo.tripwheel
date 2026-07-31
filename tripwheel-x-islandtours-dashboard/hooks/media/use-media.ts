'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { mediaApi } from '@/lib/api/media';
import { LOCALE_LABELS } from '@/lib/constants/locales';
import type { Locale } from '@/types/locale';
import type {
  MediaItem,
  MediaListResponse,
  MediaSort,
  MediaTypeFilter,
  UpdateMediaInput,
  UpsertMediaTranslationInput,
} from '@/types/media';
import { DEFAULT_MEDIA_SORT } from '@/types/media';
import { toast } from 'sonner';

export const mediaKeys = {
  all: ['media'] as const,
  // No-arg form is the PREFIX of every sorted/filtered variant - the cache
  // helpers below rely on that to hit all of them via setQueriesData.
  // `untranslated` is part of the key: it changes WHICH rows come back, so
  // leaving it out would serve a filtered page from the unfiltered cache entry
  // (and vice versa) with no refetch.
  infinite: (
    sort?: MediaSort,
    type?: MediaTypeFilter,
    untranslated?: Locale | 'none',
  ) =>
    sort
      ? ([
          ...mediaKeys.all,
          'infinite',
          `${sort.sortBy}-${sort.sortOrder}-${type ?? 'all'}-${untranslated ?? 'none'}`,
        ] as const)
      : ([...mediaKeys.all, 'infinite'] as const),
  translations: (id: string) =>
    [...mediaKeys.all, 'translations', id] as const,
};

export const MEDIA_PAGE_SIZE = 30;

/**
 * Pages through the entire media library (the old useMediaList capped the
 * gallery at the first 100 items and silently hid the rest).
 */
export function useMediaInfinite(
  sort: MediaSort = DEFAULT_MEDIA_SORT,
  type: MediaTypeFilter = 'all',
  untranslated: Locale | 'none' = 'none',
) {
  return useInfiniteQuery({
    queryKey: mediaKeys.infinite(sort, type, untranslated),
    queryFn: ({ pageParam }) =>
      mediaApi.getPage(pageParam, MEDIA_PAGE_SIZE, sort, type, untranslated),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.limit < last.total ? last.page + 1 : undefined,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useUpdateMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateMediaInput }) =>
      mediaApi.update(id, dto),
    onSuccess: (updated) => {
      // Patch the item in place across every loaded sort/filter variant -
      // no refetch, so the viewer stays open with fresh data.
      queryClient.setQueriesData<InfiniteData<MediaListResponse>>(
        { queryKey: mediaKeys.infinite() },
        (old) => {
          if (!old?.pages.length) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: page.data.map((item) =>
                item.id === updated.id ? { ...item, ...updated } : item
              ),
            })),
          };
        }
      );
      toast.success('Media details saved');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to save media details');
    },
  });
}

/**
 * Every stored locale for one asset, for the viewer's locale switcher. Enabled
 * only with an id so the viewer can call it unconditionally.
 */
export function useMediaTranslations(id: string | undefined) {
  return useQuery({
    queryKey: mediaKeys.translations(id ?? ''),
    queryFn: () => mediaApi.getTranslations(id as string),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

/**
 * Save one locale's copy.
 *
 * Invalidates the translations query rather than patching it in place: the
 * server normalizes (trims, and turns a blank into the null that makes the
 * public page fall back to English), so the row it returns is the truth and the
 * form needs to re-seed from it. Patching optimistically would leave the panel
 * showing '' where the server stored null - indistinguishable to the eye, but it
 * makes the next dirty-check lie.
 */
export function useUpsertMediaTranslation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      locale,
      dto,
    }: {
      id: string;
      locale: Locale;
      dto: UpsertMediaTranslationInput;
    }) => mediaApi.upsertTranslation(id, locale, dto),
    onSuccess: (_row, { id, locale }) => {
      queryClient.invalidateQueries({
        queryKey: mediaKeys.translations(id),
      });
      toast.success(`${LOCALE_LABELS[locale]} details saved`);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to save translation');
    },
  });
}

/**
 * The media viewer's "Translate with AI" button: one asset, the locale on
 * screen, synchronous.
 *
 * Its own hook rather than the console's `useGenerateTranslation`, because media
 * is deliberately NOT a Translation-Console entity type - the console is a matrix
 * over every entity of a type and cannot enumerate a library of thousands.
 *
 * Invalidating the translations query is what makes the panel show the result:
 * the AI writes server-side, so without this the fields would sit unchanged and
 * the button would look broken.
 */
export function useGenerateMediaTranslation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      locale,
      force,
    }: {
      id: string;
      locale: Locale;
      force?: boolean;
    }) => mediaApi.generateTranslation(id, locale, force ?? false),
    onSuccess: (result, { id, locale }) => {
      queryClient.invalidateQueries({ queryKey: mediaKeys.translations(id) });

      if (result.reason === 'not_configured') {
        toast.error(
          'AI translation is not configured - add a provider API key in Settings > Integrations.',
        );
        return;
      }
      if (result.written > 0) {
        toast.success(
          `Translated into ${LOCALE_LABELS[locale]} - review before it goes live.`,
        );
      } else if (result.skipped === 0) {
        // written 0 AND skipped 0 means no unit had any source: the asset has no
        // English copy to translate FROM. The service `continue`s past a
        // sourceless unit without counting it as skipped, which is what
        // distinguishes this from the protected-row case below. Saying "a
        // hand-edited row is never overwritten" here (as this used to) names the
        // wrong cause and sends you looking for an edit that does not exist.
        toast.info(
          'Nothing to translate yet - add a title or alt text on the EN tab first.',
        );
      } else {
        // Something WAS considered and deliberately left alone: a human-owned
        // row, or a machine row already built from this exact English source.
        toast.info(
          'Already up to date - a hand-edited row is never overwritten.',
        );
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'AI translation failed');
    },
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

/** Insert freshly uploaded items at the top of the gallery without a refetch.
 *  Prefix-matches every sort/filter variant of the infinite query. */
export function prependMediaToCache(
  queryClient: ReturnType<typeof useQueryClient>,
  items: MediaItem[]
) {
  queryClient.setQueriesData<InfiniteData<MediaListResponse>>(
    { queryKey: mediaKeys.infinite() },
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

/** Optimistically remove items from every loaded gallery page (all variants). */
export function removeMediaFromCache(
  queryClient: ReturnType<typeof useQueryClient>,
  ids: string[]
) {
  queryClient.setQueriesData<InfiniteData<MediaListResponse>>(
    { queryKey: mediaKeys.infinite() },
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
