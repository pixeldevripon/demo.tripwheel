import type { Locale } from '@/lib/constants/locales';
export type { Locale } from '@/lib/constants/locales';

export interface Category {
  id: string;
  name: string;
  slug: string;
  heroImage: string | null;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  metaTitleTemplate: string | null;
  metaDescriptionTemplate: string | null;
  parentCategoryId: string | null;
  isSeeded: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Returned by the destination-scoped, tour-gated endpoints. */
export interface CategoryByDestination extends CategoryLocalized {
  publishedTourCount: number;
}

export interface CategoryDetailByDestination extends CategoryDetail {
  publishedTourCount: number;
}

export interface CategoryLocalized extends Category {
  locale: Locale;
  isMachineTranslated: boolean;
}

export interface CategoryDetail extends CategoryLocalized {
  overview: string | null;
  h1Override: string | null;
  breadcrumbLabel: string | null;
}

export interface PaginatedCategories {
  total: number;
  page: number;
  limit: number;
  data: CategoryLocalized[];
}

export interface CategoryTranslation {
  locale: Locale;
  name: string | null;
  overview: string | null;
  h1Override: string | null;
  breadcrumbLabel: string | null;
  isMachineTranslated: boolean;
}

export interface CategoryPageContent {
  locale: Locale;
  aboutText: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
}

export interface CategoryFaq {
  id: string;
  question: string;
  answer: string;
  displayOrder: number;
  isActive: boolean;
  locale: Locale;
}

export interface CategoriesQueryParams {
  page?: number;
  limit?: number;
  locale?: Locale;
  isActive?: boolean;
}

export interface CreateCategoryPayload {
  name: string;
  slug?: string;
  heroImage?: string | null;
  description?: string | null;
  icon?: string | null;
  sortOrder?: number;
  metaTitleTemplate?: string | null;
  metaDescriptionTemplate?: string | null;
  parentCategoryId?: string | null;
}

export interface UpdateCategoryPayload {
  name?: string;
  heroImage?: string | null;
  description?: string | null;
  icon?: string | null;
  sortOrder?: number;
  metaTitleTemplate?: string | null;
  metaDescriptionTemplate?: string | null;
  parentCategoryId?: string | null;
  isActive?: boolean;
}

export interface CategoryTranslationFields {
  name?: string | null;
  overview?: string | null;
  h1Override?: string | null;
  breadcrumbLabel?: string | null;
}

export interface UpsertCategoryTranslationPayload {
  fields: CategoryTranslationFields;
  isMachineTranslated?: boolean;
}

export interface UpsertCategoryPageContentPayload {
  aboutText?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

export interface CreateCategoryFaqPayload {
  question: string;
  answer: string;
  displayOrder?: number;
  locale: Locale;
}

export interface UpdateCategoryFaqPayload {
  question?: string;
  answer?: string;
  displayOrder?: number;
  isActive?: boolean;
}
