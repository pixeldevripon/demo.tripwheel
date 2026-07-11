'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hubsApi } from '@/lib/api/hubs';
import type {
  CreateHubPayload,
  CreateHubFaqPayload,
  HubsQueryParams,
  Locale,
  UpdateHubPayload,
  UpdateHubFaqPayload,
  UpsertHubPageContentPayload,
  UpsertHubTranslationPayload,
  ReplaceContentSectionsPayload,
  SetOurPicksPayload,
  SetComparisonPayload,
} from '@/types/hub';

export const hubKeys = {
  all: ['hubs'] as const,
  lists: () => [...hubKeys.all, 'list'] as const,
  list: (params: HubsQueryParams) => [...hubKeys.lists(), params] as const,
  active: (destinationId?: string) => [...hubKeys.all, 'active', destinationId] as const,
  details: () => [...hubKeys.all, 'detail'] as const,
  detail: (id: string, locale?: Locale) => [...hubKeys.details(), id, locale] as const,
  translations: (id: string) => [...hubKeys.all, 'translations', id] as const,
  translationByLocale: (id: string, locale: Locale) => [...hubKeys.translations(id), locale] as const,
  pageContent: (id: string, locale?: Locale) => [...hubKeys.all, 'page-content', id, locale] as const,
  faqs: (id: string, locale?: Locale) => [...hubKeys.all, 'faqs', id, locale] as const,
  allowedCategories: (id: string) => [...hubKeys.all, 'allowed-categories', id] as const,
  contentSections: (id: string, locale?: Locale) =>
    [...hubKeys.all, 'content-sections', id, locale] as const,
  ourPicks: (id: string, locale?: Locale) => [...hubKeys.all, 'our-picks', id, locale] as const,
  ourPicksEdit: (id: string) => [...hubKeys.all, 'our-picks-edit', id] as const,
  comparison: (id: string, locale?: Locale) => [...hubKeys.all, 'comparison', id, locale] as const,
  comparisonEdit: (id: string) => [...hubKeys.all, 'comparison-edit', id] as const,
};

export function useHubs(params: HubsQueryParams = {}) {
  return useQuery({
    queryKey: hubKeys.list(params),
    queryFn: () => hubsApi.getAll(params),
    placeholderData: keepPreviousData,
  });
}

export function useActiveHubs(destinationId?: string) {
  return useQuery({
    queryKey: hubKeys.active(destinationId),
    queryFn: () => hubsApi.getActive(destinationId),
  });
}

export function useHub(id: string, locale?: Locale) {
  return useQuery({
    queryKey: hubKeys.detail(id, locale),
    queryFn: () => hubsApi.getById(id, locale),
    enabled: !!id,
  });
}

export function useHubTranslations(id: string) {
  return useQuery({
    queryKey: hubKeys.translations(id),
    queryFn: () => hubsApi.getTranslations(id),
    enabled: !!id,
  });
}

export function useHubTranslationByLocale(id: string, locale: Locale) {
  return useQuery({
    queryKey: hubKeys.translationByLocale(id, locale),
    queryFn: () => hubsApi.getTranslationByLocale(id, locale),
    enabled: !!id,
  });
}

export function useHubPageContent(id: string, locale?: Locale) {
  return useQuery({
    queryKey: hubKeys.pageContent(id, locale),
    queryFn: () => hubsApi.getPageContent(id, locale),
    enabled: !!id,
  });
}

export function useHubFaqs(id: string, locale?: Locale) {
  return useQuery({
    queryKey: hubKeys.faqs(id, locale),
    queryFn: () => hubsApi.getFaqs(id, locale),
    enabled: !!id,
  });
}

export function useHubAllowedCategories(id: string) {
  return useQuery({
    queryKey: hubKeys.allowedCategories(id),
    queryFn: () => hubsApi.getAllowedCategories(id),
    enabled: !!id,
  });
}

export function useHubMatchForCategory(destinationId?: string, categoryId?: string) {
  return useQuery({
    queryKey: ['hub-match', destinationId, categoryId] as const,
    enabled: !!destinationId && !!categoryId,
    queryFn: async () => {
      const hubs = await hubsApi.getActive(destinationId!);
      if (!hubs.length) return null;
      const results = await Promise.all(
        hubs.map(async (hub) => {
          const cats = await hubsApi.getAllowedCategories(hub.id);
          return { hub, cats };
        })
      );
      const match = results.find(({ cats }) =>
        cats.some((ac) => ac.categoryId === categoryId)
      );
      return match?.hub ?? null;
    },
  });
}

export function useCreateHub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateHubPayload) => hubsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hubKeys.all });
    },
  });
}

export function useUpdateHub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateHubPayload }) =>
      hubsApi.update(id, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: hubKeys.all });
      queryClient.invalidateQueries({ queryKey: hubKeys.detail(data.id) });
    },
  });
}

export function useDeleteHub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hubsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hubKeys.all });
    },
  });
}

export function useUpsertHubTranslation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      locale,
      payload,
    }: {
      id: string;
      locale: Locale;
      payload: UpsertHubTranslationPayload;
    }) => hubsApi.upsertTranslation(id, locale, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: hubKeys.translations(variables.id) });
      queryClient.invalidateQueries({ queryKey: hubKeys.detail(variables.id) });
    },
  });
}

export function useDeleteHubTranslation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, locale }: { id: string; locale: Locale }) =>
      hubsApi.deleteTranslation(id, locale),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: hubKeys.translations(variables.id) });
      queryClient.invalidateQueries({ queryKey: hubKeys.detail(variables.id) });
    },
  });
}

export function useUpsertHubPageContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      locale,
      payload,
    }: {
      id: string;
      locale: Locale;
      payload: UpsertHubPageContentPayload;
    }) => hubsApi.upsertPageContent(id, locale, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: hubKeys.pageContent(variables.id) });
    },
  });
}

export function useCreateHubFaq() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateHubFaqPayload }) =>
      hubsApi.createFaq(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: hubKeys.faqs(variables.id) });
    },
  });
}

export function useUpdateHubFaq() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      faqId,
      payload,
    }: {
      id: string;
      faqId: string;
      payload: UpdateHubFaqPayload;
    }) => hubsApi.updateFaq(id, faqId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: hubKeys.faqs(variables.id) });
    },
  });
}

export function useDeleteHubFaq() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, faqId }: { id: string; faqId: string }) =>
      hubsApi.deleteFaq(id, faqId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: hubKeys.faqs(variables.id) });
    },
  });
}

export function useAddHubAllowedCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId: string }) =>
      hubsApi.addAllowedCategory(id, categoryId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: hubKeys.allowedCategories(variables.id) });
      queryClient.invalidateQueries({ queryKey: hubKeys.detail(variables.id) });
    },
  });
}

export function useRemoveHubAllowedCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId: string }) =>
      hubsApi.removeAllowedCategory(id, categoryId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: hubKeys.allowedCategories(variables.id) });
      queryClient.invalidateQueries({ queryKey: hubKeys.detail(variables.id) });
    },
  });
}

// ── Content sections ────────────────────────────────────────────────────────────

export function useHubContentSections(id: string, locale?: Locale) {
  return useQuery({
    queryKey: hubKeys.contentSections(id, locale),
    queryFn: () => hubsApi.getContentSections(id, locale),
    enabled: !!id,
  });
}

export function useReplaceHubContentSections() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReplaceContentSectionsPayload }) =>
      hubsApi.replaceContentSections(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: hubKeys.contentSections(variables.id) });
    },
  });
}

// ── Our Picks ─────────────────────────────────────────────────────────────────

export function useHubOurPicks(id: string, locale?: Locale) {
  return useQuery({
    queryKey: hubKeys.ourPicks(id, locale),
    queryFn: () => hubsApi.getOurPicks(id, locale),
    enabled: !!id,
  });
}

/** All-locale read-back for the Our Picks editor tabs. */
export function useHubOurPicksForEdit(id: string) {
  return useQuery({
    queryKey: hubKeys.ourPicksEdit(id),
    queryFn: () => hubsApi.getOurPicksForEdit(id),
    enabled: !!id,
  });
}

export function useSetHubOurPicks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SetOurPicksPayload }) =>
      hubsApi.setOurPicks(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: hubKeys.ourPicks(variables.id) });
      queryClient.invalidateQueries({ queryKey: hubKeys.ourPicksEdit(variables.id) });
    },
  });
}

// ── Comparison ──────────────────────────────────────────────────────────────

export function useHubComparison(id: string, locale?: Locale) {
  return useQuery({
    queryKey: hubKeys.comparison(id, locale),
    queryFn: () => hubsApi.getComparison(id, locale),
    enabled: !!id,
  });
}

/** All-locale read-back for the comparison editor tabs. */
export function useHubComparisonForEdit(id: string) {
  return useQuery({
    queryKey: hubKeys.comparisonEdit(id),
    queryFn: () => hubsApi.getComparisonForEdit(id),
    enabled: !!id,
  });
}

export function useSetHubComparison() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SetComparisonPayload }) =>
      hubsApi.setComparison(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: hubKeys.comparison(variables.id) });
      queryClient.invalidateQueries({ queryKey: hubKeys.comparisonEdit(variables.id) });
    },
  });
}
