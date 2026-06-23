import type { Locale } from '@/lib/constants/locales';
import type { HubType } from '@/types/enums';
export type { Locale } from '@/lib/constants/locales';
export type { HubType } from '@/types/enums';

export interface Hub {
  id: string;
  destinationId: string;
  name: string;
  slug: string;
  description: string | null;
  hubType: HubType | null;
  latitude: number | null;
  longitude: number | null;
  isSeeded: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HubLocalized extends Hub {
  locale: Locale;
  isMachineTranslated: boolean;
}

export interface HubDetail extends HubLocalized {
  overview: string | null;
  h1Override: string | null;
  breadcrumbLabel: string | null;
  allowedCategories: HubAllowedCategory[];
}

export interface HubAllowedCategory {
  id: string;
  categoryId: string;
  category: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface PaginatedHubs {
  total: number;
  page: number;
  limit: number;
  data: HubLocalized[];
}

export interface HubTranslation {
  locale: Locale;
  name: string | null;
  overview: string | null;
  h1Override: string | null;
  breadcrumbLabel: string | null;
  isMachineTranslated: boolean;
}

export interface HubPageContent {
  locale: Locale;
  aboutText: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
}

export interface HubFaq {
  id: string;
  question: string;
  answer: string;
  displayOrder: number;
  isActive: boolean;
  locale: Locale;
}

export interface HubsQueryParams {
  page?: number;
  limit?: number;
  locale?: Locale;
  isActive?: boolean;
  destinationId?: string;
}

export interface CreateHubPayload {
  destinationId: string;
  name: string;
  description?: string | null;
  hubType: HubType;
  latitude?: number | null;
  longitude?: number | null;
  allowedCategoryIds?: string[];
}

export interface UpdateHubPayload {
  name?: string;
  /**
   * Hub slug rename. The backend re-points the hub's slug_registry row, writes an
   * automatic 301 redirect, and protects the old slug with a 90-day reuse cooldown.
   * Omit to leave unchanged. (Hub create has no slug field - it is auto-generated.)
   */
  slug?: string;
  description?: string | null;
  hubType?: HubType;
  latitude?: number | null;
  longitude?: number | null;
  isActive?: boolean;
}

export interface UpsertHubTranslationPayload {
  fields: {
    name?: string | null;
    overview?: string | null;
    h1Override?: string | null;
    breadcrumbLabel?: string | null;
  };
  isMachineTranslated?: boolean;
}

export interface UpsertHubPageContentPayload {
  aboutText?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

export interface CreateHubFaqPayload {
  question: string;
  answer: string;
  displayOrder?: number;
  locale: Locale;
}

export interface UpdateHubFaqPayload {
  question?: string;
  answer?: string;
  displayOrder?: number;
  isActive?: boolean;
}
