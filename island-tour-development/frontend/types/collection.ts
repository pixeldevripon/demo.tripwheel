import type { Locale } from '@/lib/constants/locales';
import type { CollectionType } from '@/types/enums';
export type { Locale } from '@/lib/constants/locales';
export type { CollectionType } from '@/types/enums';

export interface Collection {
  id: string;
  destinationId: string;
  name: string;
  slug: string;
  collectionType: CollectionType;
  tourIds: string[];
  filterQuery: Record<string, unknown> | null;
  heroImage: string | null;
  sortOrder: string;
  isActive: boolean;
  isSeeded: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionLocalized extends Collection {
  locale: Locale;
  isMachineTranslated: boolean;
}

export interface CollectionDetail extends CollectionLocalized {
  overview: string | null;
  h1Override: string | null;
  breadcrumbLabel: string | null;
  tours: unknown[];
}

export interface CollectionsQueryParams {
  destinationSlug: string;
  locale?: Locale;
}

export interface CreateCollectionPayload {
  destinationId: string;
  name: string;
  slug?: string;
  collectionType: CollectionType;
  tourIds?: string[];
  filterQuery?: Record<string, unknown>;
  heroImage?: string | null;
  sortOrder?: string;
}

export interface UpdateCollectionPayload {
  name?: string;
  tourIds?: string[];
  filterQuery?: Record<string, unknown>;
  heroImage?: string | null;
  sortOrder?: string;
  isActive?: boolean;
}

// Translation / page-content / FAQ payloads (mirror Category)
export interface CollectionTranslationFields {
  name?: string | null;
  overview?: string | null;
  h1Override?: string | null;
  breadcrumbLabel?: string | null;
}

export interface UpsertCollectionTranslationPayload {
  fields: CollectionTranslationFields;
  isMachineTranslated?: boolean;
}

export interface CollectionTranslation {
  locale: Locale;
  name: string | null;
  overview: string | null;
  h1Override: string | null;
  breadcrumbLabel: string | null;
  isMachineTranslated: boolean;
}

export interface CollectionPageContent {
  locale: Locale;
  aboutText: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
}

export interface CollectionFaq {
  id: string;
  question: string;
  answer: string;
  displayOrder: number;
  isActive: boolean;
  locale: Locale;
}

export interface UpsertCollectionPageContentPayload {
  aboutText?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

export interface CreateCollectionFaqPayload {
  question: string;
  answer: string;
  displayOrder?: number;
  locale: Locale;
}

export interface UpdateCollectionFaqPayload {
  question?: string;
  answer?: string;
  displayOrder?: number;
  isActive?: boolean;
}
