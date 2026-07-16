'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { faqGroupsApi } from '@/lib/api/faq-groups';
import type { Locale } from '@/lib/constants/locales';
import type {
  CreateFaqGroupPayload,
  UpdateFaqGroupPayload,
  UpsertFaqTranslationPayload,
} from '@/types/faq';

export const faqGroupKeys = {
  all: (basePath: string, id: string) => ['faq-groups', basePath, id] as const,
};

export function useFaqGroups(basePath: string, id: string) {
  return useQuery({
    queryKey: faqGroupKeys.all(basePath, id),
    queryFn: () => faqGroupsApi.list(basePath, id),
    enabled: !!id,
  });
}

export function useCreateFaqGroup(basePath: string, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateFaqGroupPayload) =>
      faqGroupsApi.create(basePath, id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: faqGroupKeys.all(basePath, id) });
    },
  });
}

export function useUpdateFaqGroup(basePath: string, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, payload }: { groupId: string; payload: UpdateFaqGroupPayload }) =>
      faqGroupsApi.update(basePath, id, groupId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: faqGroupKeys.all(basePath, id) });
    },
  });
}

export function useDeleteFaqGroup(basePath: string, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => faqGroupsApi.remove(basePath, id, groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: faqGroupKeys.all(basePath, id) });
    },
  });
}

export function useUpsertFaqTranslation(basePath: string, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      groupId,
      locale,
      payload,
    }: {
      groupId: string;
      locale: Locale;
      payload: UpsertFaqTranslationPayload;
    }) => faqGroupsApi.upsertTranslation(basePath, id, groupId, locale, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: faqGroupKeys.all(basePath, id) });
    },
  });
}
