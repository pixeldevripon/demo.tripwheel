import type { Locale } from '@/lib/constants/locales';
import type { Currency, Region } from '@/types/enums';
export type { Locale } from '@/lib/constants/locales';
export type { Region, Currency } from '@/types/enums';

export interface Destination {
  id: string;
  name: string;
  slug: string;
  heroImage: string | null;
  region: Region | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  currency: Currency | null;
  language: string | null;
  galleryImages: string[];
  ogImage: string | null;
  parentDestinationId: string | null;
  isSeeded: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DestinationLocalized extends Destination {
  locale: Locale;
  isMachineTranslated: boolean;
}

// Returned by GET /destinations/active - adds the live (published) tour count.
export interface DestinationActive extends DestinationLocalized {
  tourCount: number;
}

export interface DestinationDetail extends DestinationLocalized {
  overview: string | null;
  h1Override: string | null;
  breadcrumbLabel: string | null;
}

export interface PaginatedDestinations {
  total: number;
  page: number;
  limit: number;
  data: DestinationLocalized[];
}

export interface DestinationTranslation {
  locale: Locale;
  name: string | null;
  overview: string | null;
  h1Override: string | null;
  breadcrumbLabel: string | null;
  isMachineTranslated: boolean;
}

export interface DestinationPageContent {
  locale: Locale;
  aboutText: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
}

export interface DestinationFaq {
  id: string;
  question: string;
  answer: string;
  displayOrder: number;
  isActive: boolean;
  locale: Locale;
}

export interface DestinationsQueryParams {
  page?: number;
  limit?: number;
  locale?: Locale;
  isActive?: boolean;
}

export interface CreateDestinationPayload {
  name: string;
  slug?: string;
  heroImage?: string | null;
  region: Region;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  currency?: Currency | null;
  language?: string | null;
  galleryImages?: string[];
  ogImage?: string | null;
  parentDestinationId?: string | null;
}

export interface UpdateDestinationPayload {
  name?: string;
  heroImage?: string | null;
  region?: Region;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  currency?: Currency | null;
  language?: string | null;
  galleryImages?: string[];
  ogImage?: string | null;
  isActive?: boolean;
}

export interface TranslationFields {
  name?: string | null;
  overview?: string | null;
  h1Override?: string | null;
  breadcrumbLabel?: string | null;
}

export interface UpsertTranslationPayload {
  fields: TranslationFields;
  isMachineTranslated?: boolean;
}

export interface UpsertPageContentPayload {
  aboutText?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

export interface CreateFaqPayload {
  question: string;
  answer: string;
  displayOrder?: number;
  locale: Locale;
}

export interface UpdateFaqPayload {
  question?: string;
  answer?: string;
  displayOrder?: number;
  isActive?: boolean;
}
