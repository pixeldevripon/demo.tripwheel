'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '@/lib/api/categories';
import type {
  CategoriesQueryParams,
  CreateCategoryFaqPayload,
  CreateCategoryPayload,
  Locale,
  UpdateCategoryFaqPayload,
  UpdateCategoryPayload,
  UpsertCategoryPageContentPayload,
  UpsertCategoryTranslationPayload,
} from '@/types/category';

export const categoryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryKeys.all, 'list'] as const,
  list: (params: CategoriesQueryParams) => [...categoryKeys.lists(), params] as const,
  active: (locale?: Locale) => [...categoryKeys.all, 'active', locale] as const,
  details: () => [...categoryKeys.all, 'detail'] as const,
  detail: (id: string, locale?: Locale) => [...categoryKeys.details(), id, locale] as const,
  translations: (id: string) => [...categoryKeys.all, 'translations', id] as const,
  translationByLocale: (id: string, locale: Locale) => [...categoryKeys.translations(id), locale] as const,
  pageContent: (id: string, locale?: Locale) => [...categoryKeys.all, 'page-content', id, locale] as const,
  faqs: (id: string, locale?: Locale) => [...categoryKeys.all, 'faqs', id, locale] as const,
};

export function useCategories(params: CategoriesQueryParams = {}) {
  return useQuery({
    queryKey: categoryKeys.list(params),
    queryFn: () => categoriesApi.getAll(params),
  });
}

export function useActiveCategories(locale?: Locale) {
  return useQuery({
    queryKey: categoryKeys.active(locale),
    queryFn: () => categoriesApi.getActive(locale),
  });
}

export function useCategory(id: string, locale?: Locale) {
  return useQuery({
    queryKey: categoryKeys.detail(id, locale),
    queryFn: () => categoriesApi.getById(id, locale),
    enabled: !!id,
  });
}

export function useCategoryTranslations(id: string) {
  return useQuery({
    queryKey: categoryKeys.translations(id),
    queryFn: () => categoriesApi.getTranslations(id),
    enabled: !!id,
  });
}

export function useCategoryTranslationByLocale(id: string, locale: Locale) {
  return useQuery({
    queryKey: categoryKeys.translationByLocale(id, locale),
    queryFn: () => categoriesApi.getTranslationByLocale(id, locale),
    enabled: !!id,
  });
}

export function useCategoryPageContent(id: string, locale?: Locale) {
  return useQuery({
    queryKey: categoryKeys.pageContent(id, locale),
    queryFn: () => categoriesApi.getPageContent(id, locale),
    enabled: !!id,
  });
}

export function useCategoryFaqs(id: string, locale?: Locale) {
  return useQuery({
    queryKey: categoryKeys.faqs(id, locale),
    queryFn: () => categoriesApi.getFaqs(id, locale),
    enabled: !!id,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCategoryPayload) => categoriesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCategoryPayload }) =>
      categoriesApi.update(id, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      queryClient.invalidateQueries({ queryKey: categoryKeys.detail(data.id) });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => categoriesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

export function useForceDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => categoriesApi.forceDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

export function useUpsertCategoryTranslation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      locale,
      payload,
    }: {
      id: string;
      locale: Locale;
      payload: UpsertCategoryTranslationPayload;
    }) => categoriesApi.upsertTranslation(id, locale, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.translations(variables.id) });
      queryClient.invalidateQueries({ queryKey: categoryKeys.detail(variables.id) });
    },
  });
}

export function useDeleteCategoryTranslation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, locale }: { id: string; locale: Locale }) =>
      categoriesApi.deleteTranslation(id, locale),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.translations(variables.id) });
      queryClient.invalidateQueries({ queryKey: categoryKeys.detail(variables.id) });
    },
  });
}

export function useUpsertCategoryPageContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      locale,
      payload,
    }: {
      id: string;
      locale: Locale;
      payload: UpsertCategoryPageContentPayload;
    }) => categoriesApi.upsertPageContent(id, locale, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.pageContent(variables.id) });
    },
  });
}

export function useCreateCategoryFaq() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateCategoryFaqPayload }) =>
      categoriesApi.createFaq(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.faqs(variables.id) });
    },
  });
}

export function useUpdateCategoryFaq() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      faqId,
      payload,
    }: {
      id: string;
      faqId: string;
      payload: UpdateCategoryFaqPayload;
    }) => categoriesApi.updateFaq(id, faqId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.faqs(variables.id) });
    },
  });
}

export function useDeleteCategoryFaq() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, faqId }: { id: string; faqId: string }) =>
      categoriesApi.deleteFaq(id, faqId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.faqs(variables.id) });
    },
  });
}
