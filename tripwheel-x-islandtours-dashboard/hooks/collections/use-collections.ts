'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { collectionsApi } from '@/lib/api/collections';
import type {
  CreateCollectionFaqPayload,
  CreateCollectionPayload,
  Locale,
  ReplaceCollectionToursPayload,
  UpdateCollectionFaqPayload,
  UpdateCollectionPayload,
  UpsertCollectionPageContentPayload,
  UpsertCollectionTourRationalePayload,
  UpsertCollectionTranslationPayload,
} from '@/types/collection';
import type { CollectionStatus } from '@/types/enums';

export const collectionKeys = {
  all: ['collections'] as const,
  byDestination: (destinationSlug: string) => [...collectionKeys.all, 'admin', destinationSlug] as const,
  detail: (id: string) => [...collectionKeys.all, 'detail', id] as const,
  translations: (id: string) => [...collectionKeys.all, 'translations', id] as const,
  translationByLocale: (id: string, locale: Locale) =>
    [...collectionKeys.translations(id), locale] as const,
  pageContent: (id: string, locale?: Locale) =>
    [...collectionKeys.all, 'page-content', id, locale] as const,
  faqs: (id: string, locale?: Locale) => [...collectionKeys.all, 'faqs', id, locale] as const,
  toursForEdit: (id: string) => [...collectionKeys.all, 'tours-edit', id] as const,
  // Child of detail(id) so invalidating the detail (e.g. after a filterQuery save)
  // also refreshes the resolved-tours preview.
  resolvedTours: (id: string) => [...collectionKeys.detail(id), 'resolved'] as const,
};

/** Pass the `'all'` sentinel to list collections across every island. */
export function useCollectionsByDestination(destinationSlug: string | undefined) {
  return useQuery({
    queryKey: collectionKeys.byDestination(destinationSlug ?? ''),
    queryFn: () =>
      collectionsApi.getAllAdmin(
        destinationSlug === 'all' ? undefined : destinationSlug,
      ),
    enabled: !!destinationSlug,
    placeholderData: keepPreviousData,
  });
}

export function useCollection(id: string) {
  return useQuery({
    queryKey: collectionKeys.detail(id),
    queryFn: () => collectionsApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCollectionPayload) => collectionsApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: collectionKeys.all }),
  });
}

export function useUpdateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCollectionPayload }) =>
      collectionsApi.update(id, payload),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: collectionKeys.all });
      qc.invalidateQueries({ queryKey: collectionKeys.detail(vars.id) });
    },
  });
}

export function useDeleteCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => collectionsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: collectionKeys.all }),
  });
}

export function useForceDeleteCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => collectionsApi.forceDelete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: collectionKeys.all }),
  });
}

// Translations
export function useCollectionTranslations(id: string) {
  return useQuery({
    queryKey: collectionKeys.translations(id),
    queryFn: () => collectionsApi.getTranslations(id),
    enabled: !!id,
  });
}

export function useCollectionTranslationByLocale(id: string, locale: Locale) {
  return useQuery({
    queryKey: collectionKeys.translationByLocale(id, locale),
    queryFn: () => collectionsApi.getTranslationByLocale(id, locale),
    enabled: !!id,
  });
}

export function useUpsertCollectionTranslation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      locale,
      payload,
    }: {
      id: string;
      locale: Locale;
      payload: UpsertCollectionTranslationPayload;
    }) => collectionsApi.upsertTranslation(id, locale, payload),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: collectionKeys.translations(vars.id) });
      qc.invalidateQueries({ queryKey: collectionKeys.detail(vars.id) });
    },
  });
}

export function useDeleteCollectionTranslation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, locale }: { id: string; locale: Locale }) =>
      collectionsApi.deleteTranslation(id, locale),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: collectionKeys.translations(vars.id) });
      qc.invalidateQueries({ queryKey: collectionKeys.detail(vars.id) });
    },
  });
}

// Page content
export function useCollectionPageContent(id: string, locale?: Locale) {
  return useQuery({
    queryKey: collectionKeys.pageContent(id, locale),
    queryFn: () => collectionsApi.getPageContent(id, locale),
    enabled: !!id,
  });
}

export function useUpsertCollectionPageContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      locale,
      payload,
    }: {
      id: string;
      locale: Locale;
      payload: UpsertCollectionPageContentPayload;
    }) => collectionsApi.upsertPageContent(id, locale, payload),
    onSuccess: (_d, vars) => {
      // Prefix-match all locales (the cached key includes the specific locale).
      qc.invalidateQueries({ queryKey: [...collectionKeys.all, 'page-content', vars.id] });
    },
  });
}

// FAQs
export function useCollectionFaqs(id: string, locale?: Locale) {
  return useQuery({
    queryKey: collectionKeys.faqs(id, locale),
    queryFn: () => collectionsApi.getFaqs(id, locale),
    enabled: !!id,
  });
}

export function useCreateCollectionFaq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateCollectionFaqPayload }) =>
      collectionsApi.createFaq(id, payload),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: collectionKeys.faqs(vars.id) });
    },
  });
}

export function useUpdateCollectionFaq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      faqId,
      payload,
    }: {
      id: string;
      faqId: string;
      payload: UpdateCollectionFaqPayload;
    }) => collectionsApi.updateFaq(id, faqId, payload),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: collectionKeys.faqs(vars.id) });
    },
  });
}

export function useDeleteCollectionFaq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, faqId }: { id: string; faqId: string }) =>
      collectionsApi.deleteFaq(id, faqId),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: collectionKeys.faqs(vars.id) });
    },
  });
}

// Status lifecycle
export function useUpdateCollectionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: CollectionStatus }) =>
      collectionsApi.updateStatus(id, status),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: collectionKeys.all });
      qc.invalidateQueries({ queryKey: collectionKeys.detail(vars.id) });
    },
  });
}

// Ordered MANUAL membership + per-locale rationales (admin Tours editor read-back).
export function useCollectionToursForEdit(id: string) {
  return useQuery({
    queryKey: collectionKeys.toursForEdit(id),
    queryFn: () => collectionsApi.getToursForEdit(id),
    enabled: !!id,
  });
}

// Admin preview of the tours a DYNAMIC collection resolves to (from its saved filter).
export function useCollectionResolvedTours(id: string, enabled = true) {
  return useQuery({
    queryKey: collectionKeys.resolvedTours(id),
    queryFn: () => collectionsApi.getResolvedTours(id),
    enabled: !!id && enabled,
  });
}

// MANUAL membership (replace-all). Invalidates the detail + editor read-back so the
// ordered tourIds and rationales refresh.
export function useReplaceCollectionTours() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReplaceCollectionToursPayload }) =>
      collectionsApi.replaceTours(id, payload),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: collectionKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: collectionKeys.toursForEdit(vars.id) });
    },
  });
}

// Per-tour, per-locale rationale. Invalidates the editor read-back so translations refresh.
export function useUpsertCollectionTourRationale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      tourId,
      locale,
      payload,
    }: {
      id: string;
      tourId: string;
      locale: Locale;
      payload: UpsertCollectionTourRationalePayload;
    }) => collectionsApi.upsertTourRationale(id, tourId, locale, payload),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: collectionKeys.toursForEdit(vars.id) });
    },
  });
}
