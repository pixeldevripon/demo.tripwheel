'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { pagesApi } from '@/lib/api/pages';
import type { Locale } from '@/lib/constants/locales';
import type {
  CreatePagePayload,
  PageStatus,
  UpdatePagePayload,
  UpsertPageTranslationPayload,
} from '@/types/pages';

export const pageKeys = {
  all: () => ['pages'] as const,
  list: () => ['pages', 'list'] as const,
  detail: (id: string) => ['pages', 'detail', id] as const,
};

export function usePages() {
  return useQuery({
    queryKey: pageKeys.list(),
    queryFn: () => pagesApi.list(),
  });
}

export function usePage(id: string) {
  return useQuery({
    queryKey: pageKeys.detail(id),
    queryFn: () => pagesApi.get(id),
    enabled: !!id,
  });
}

export function useCreatePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePagePayload) => pagesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.all() });
    },
  });
}

export function useUpdatePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePagePayload }) =>
      pagesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.all() });
    },
  });
}

export function useUpdatePageStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: PageStatus }) =>
      pagesApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.all() });
    },
  });
}

export function useDeletePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pagesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.all() });
    },
  });
}

export function useUpsertPageTranslation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      locale,
      payload,
    }: {
      id: string;
      locale: Locale;
      payload: UpsertPageTranslationPayload;
    }) => pagesApi.upsertTranslation(id, locale, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.all() });
    },
  });
}
