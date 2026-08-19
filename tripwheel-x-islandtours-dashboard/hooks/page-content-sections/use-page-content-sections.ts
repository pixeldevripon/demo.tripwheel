'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pageContentSectionsApi } from '@/lib/api/page-content-sections';
import type { Locale } from '@/lib/constants/locales';
import type {
  CreatePageContentSectionPayload,
  UpdatePageContentSectionPayload,
  UpsertPageContentSectionTranslationPayload,
} from '@/types/page-content-section';

export const pageContentSectionKeys = {
  all: (basePath: string, id: string) => ['page-content-sections', basePath, id] as const,
};

export function usePageContentSections(basePath: string, id: string) {
  return useQuery({
    queryKey: pageContentSectionKeys.all(basePath, id),
    queryFn: () => pageContentSectionsApi.list(basePath, id),
    enabled: !!id,
  });
}

export function useCreatePageContentSection(basePath: string, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePageContentSectionPayload) =>
      pageContentSectionsApi.create(basePath, id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageContentSectionKeys.all(basePath, id) });
    },
  });
}

export function useUpdatePageContentSection(basePath: string, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      groupId,
      payload,
    }: {
      groupId: string;
      payload: UpdatePageContentSectionPayload;
    }) => pageContentSectionsApi.update(basePath, id, groupId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageContentSectionKeys.all(basePath, id) });
    },
  });
}

export function useDeletePageContentSection(basePath: string, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => pageContentSectionsApi.remove(basePath, id, groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageContentSectionKeys.all(basePath, id) });
    },
  });
}

/** Clear ONE locale (row delete) - the public page falls back to English. */
export function useDeletePageContentSectionTranslation(basePath: string, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, locale }: { groupId: string; locale: Locale }) =>
      pageContentSectionsApi.deleteTranslation(basePath, id, groupId, locale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageContentSectionKeys.all(basePath, id) });
    },
  });
}

export function useUpsertPageContentSectionTranslation(basePath: string, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      groupId,
      locale,
      payload,
    }: {
      groupId: string;
      locale: Locale;
      payload: UpsertPageContentSectionTranslationPayload;
    }) => pageContentSectionsApi.upsertTranslation(basePath, id, groupId, locale, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageContentSectionKeys.all(basePath, id) });
    },
  });
}
