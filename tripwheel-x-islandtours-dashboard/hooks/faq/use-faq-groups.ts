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
  // `basePath` widened to allow undefined (FAQ-less surfaces pass none) and
  // normalized here so the key shape stays a stable string triple.
  all: (basePath: string | undefined, id: string) =>
    ['faq-groups', basePath ?? '', id] as const,
};

/**
 * `basePath` is OPTIONAL so a surface with no FAQs at all can share the entity
 * components without faking an endpoint. The apartment promo is the case: it has
 * no questions attached to it, and passing a path would fire a request at a route
 * the backend does not serve.
 */
export function useFaqGroups(basePath: string | undefined, id: string) {
  return useQuery({
    queryKey: faqGroupKeys.all(basePath, id),
    queryFn: () => faqGroupsApi.list(basePath!, id),
    enabled: !!id && !!basePath,
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

/** Clear ONE locale (row delete) - the public page falls back to English. */
export function useDeleteFaqTranslation(basePath: string, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, locale }: { groupId: string; locale: Locale }) =>
      faqGroupsApi.deleteTranslation(basePath, id, groupId, locale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: faqGroupKeys.all(basePath, id) });
    },
  });
}

/** `basePath` optional for the same reason as `useFaqGroups`: FAQ-less surfaces.
 *  With none there are no FAQ rows to submit, so the mutation is never fired. */
export function useUpsertFaqTranslation(basePath: string | undefined, id: string) {
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
    }) => faqGroupsApi.upsertTranslation(basePath!, id, groupId, locale, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: faqGroupKeys.all(basePath, id) });
    },
  });
}
