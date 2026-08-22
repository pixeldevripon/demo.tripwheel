'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { destinationsApi } from '@/lib/api/destinations';
import type {
  CreateDestinationPayload,
  CreateFaqPayload,
  DestinationsQueryParams,
  Locale,
  PopularLinkInput,
  PopularLinkPlacement,
  UpdateDestinationPayload,
  UpdateFaqPayload,
  UpsertPageContentPayload,
  UpsertTranslationPayload,
} from '@/types/destination';

export const destinationKeys = {
  all: ['destinations'] as const,
  lists: () => [...destinationKeys.all, 'list'] as const,
  list: (params: DestinationsQueryParams) => [...destinationKeys.lists(), params] as const,
  active: (locale?: Locale) => [...destinationKeys.all, 'active', locale] as const,
  details: () => [...destinationKeys.all, 'detail'] as const,
  detail: (id: string, locale?: Locale) => [...destinationKeys.details(), id, locale] as const,
  translations: (id: string) => [...destinationKeys.all, 'translations', id] as const,
  translationByLocale: (id: string, locale: Locale) => [...destinationKeys.translations(id), locale] as const,
  pageContent: (id: string, locale?: Locale) => [...destinationKeys.all, 'page-content', id, locale] as const,
  faqs: (id: string, locale?: Locale) => [...destinationKeys.all, 'faqs', id, locale] as const,
  popularLinks: (id: string, placement: PopularLinkPlacement) =>
    [...destinationKeys.all, 'popular-links', id, placement] as const,
};

export function useDestinations(params: DestinationsQueryParams = {}, enabled = true) {
  return useQuery({
    queryKey: destinationKeys.list(params),
    queryFn: () => destinationsApi.getAll(params),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useActiveDestinations(locale?: Locale) {
  return useQuery({
    queryKey: destinationKeys.active(locale),
    queryFn: () => destinationsApi.getActive(locale),
  });
}

export function useDestination(id: string, locale?: Locale) {
  return useQuery({
    queryKey: destinationKeys.detail(id, locale),
    queryFn: () => destinationsApi.getById(id, locale),
    enabled: !!id,
  });
}

export function useDestinationTranslations(id: string) {
  return useQuery({
    queryKey: destinationKeys.translations(id),
    queryFn: () => destinationsApi.getTranslations(id),
    enabled: !!id,
  });
}

export function useDestinationTranslationByLocale(id: string, locale: Locale) {
  return useQuery({
    queryKey: destinationKeys.translationByLocale(id, locale),
    queryFn: () => destinationsApi.getTranslationByLocale(id, locale),
    enabled: !!id,
  });
}

export function useDestinationPageContent(id: string, locale?: Locale) {
  return useQuery({
    queryKey: destinationKeys.pageContent(id, locale),
    queryFn: () => destinationsApi.getPageContent(id, locale),
    enabled: !!id,
  });
}

export function useDestinationFaqs(id: string, locale?: Locale) {
  return useQuery({
    queryKey: destinationKeys.faqs(id, locale),
    queryFn: () => destinationsApi.getFaqs(id, locale),
    enabled: !!id,
  });
}

export function useCreateDestination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDestinationPayload) => destinationsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: destinationKeys.all });
    },
  });
}

export function useUpdateDestination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateDestinationPayload }) =>
      destinationsApi.update(id, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: destinationKeys.all });
      queryClient.invalidateQueries({ queryKey: destinationKeys.detail(data.id) });
    },
  });
}

export function useDeleteDestination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => destinationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: destinationKeys.all });
    },
  });
}

export function useForceDeleteDestination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => destinationsApi.forceDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: destinationKeys.all });
    },
  });
}

export function useUpsertTranslation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      locale,
      payload,
    }: {
      id: string;
      locale: Locale;
      payload: UpsertTranslationPayload;
    }) => destinationsApi.upsertTranslation(id, locale, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: destinationKeys.translations(variables.id) });
      queryClient.invalidateQueries({ queryKey: destinationKeys.detail(variables.id) });
    },
  });
}

export function useDeleteTranslation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, locale }: { id: string; locale: Locale }) =>
      destinationsApi.deleteTranslation(id, locale),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: destinationKeys.translations(variables.id) });
      queryClient.invalidateQueries({ queryKey: destinationKeys.detail(variables.id) });
    },
  });
}

export function useUpsertPageContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      locale,
      payload,
    }: {
      id: string;
      locale: Locale;
      payload: UpsertPageContentPayload;
    }) => destinationsApi.upsertPageContent(id, locale, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: destinationKeys.pageContent(variables.id) });
    },
  });
}

export function useCreateFaq() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateFaqPayload }) =>
      destinationsApi.createFaq(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: destinationKeys.faqs(variables.id) });
    },
  });
}

export function useUpdateFaq() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      faqId,
      payload,
    }: {
      id: string;
      faqId: string;
      payload: UpdateFaqPayload;
    }) => destinationsApi.updateFaq(id, faqId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: destinationKeys.faqs(variables.id) });
    },
  });
}

export function useDeleteFaq() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, faqId }: { id: string; faqId: string }) =>
      destinationsApi.deleteFaq(id, faqId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: destinationKeys.faqs(variables.id) });
    },
  });
}

/**
 * One of the island's curated lists, raw and ungated (admin view). The
 * placement is part of the query key: the two lists are separate data and must
 * not share a cache entry.
 */
export function useDestinationPopularLinks(
  id: string,
  placement: PopularLinkPlacement = 'HERO_POPULAR',
) {
  return useQuery({
    queryKey: destinationKeys.popularLinks(id, placement),
    queryFn: () => destinationsApi.getPopularLinks(id, placement),
    enabled: !!id,
  });
}

/**
 * Replace one whole curated list in a single save.
 *
 * Seeds the query cache from the response instead of only invalidating, so the
 * section shows what the server actually stored (slot order is assigned there
 * from array position) rather than briefly re-rendering the pre-save order.
 */
export function useReplaceDestinationPopularLinks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      links,
      placement = 'HERO_POPULAR',
    }: {
      id: string;
      links: PopularLinkInput[];
      placement?: PopularLinkPlacement;
    }) => destinationsApi.replacePopularLinks(id, links, placement),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(
        destinationKeys.popularLinks(variables.id, variables.placement ?? 'HERO_POPULAR'),
        data,
      );
    },
  });
}
