import type { Locale } from '@/lib/constants/locales';
import type { HubPickType, HubSectionType, HubStatus, HubType } from '@/types/enums';
export type { Locale } from '@/lib/constants/locales';
export type { HubPickType, HubSectionType, HubStatus, HubType } from '@/types/enums';

export interface Hub {
  id: string;
  destinationId: string;
  name: string;
  slug: string;
  description: string | null;
  hubType: HubType | null;
  heroImage: string | null;
  ogImage: string | null;
  status: HubStatus;
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

/** Returned by the destination-scoped, tour-gated public endpoint. */
export interface HubByDestination extends HubLocalized {
  publishedTourCount: number;
}

export interface HubDetail extends HubLocalized {
  overview: string | null;
  h1Override: string | null;
  heroTagline: string | null;
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
  heroTagline: string | null;
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
  heroImage?: string | null;
  ogImage?: string | null;
  status?: HubStatus;
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
  heroImage?: string | null;
  ogImage?: string | null;
  status?: HubStatus;
  latitude?: number | null;
  longitude?: number | null;
  isActive?: boolean;
}

export interface UpsertHubTranslationPayload {
  fields: {
    name?: string | null;
    overview?: string | null;
    heroTagline?: string | null;
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

// ── Content sections (Discover / Local Tips / Fast Facts / Editorial) ──────────
// GET returns every locale (each row carries its own `locale`), so the editor can
// round-trip the full set. PUT replaces all rows for the hub.

export interface HubContentSection {
  locale: Locale;
  sectionType: HubSectionType;
  heading: string;
  body: string;
  displayOrder: number;
}

export type HubContentSectionInput = HubContentSection;

export interface ReplaceContentSectionsPayload {
  sections: HubContentSectionInput[];
}

export interface ReplaceContentSectionsResponse {
  count: number;
  sections: HubContentSection[];
}

// ── Our Picks ──────────────────────────────────────────────────────────────────
// GET resolves `description` to the requested locale (en fallback) and does NOT
// return the per-locale translation array, so the dashboard manages base (en)
// content only. PUT replaces all picks; `translations` is omitted by the dashboard.

export interface OurPickTourSummary {
  id: string;
  slug: string;
  title: string;
}

export interface HubOurPick {
  id: string;
  pickType: HubPickType;
  description: string;
  displayOrder: number;
  tour: OurPickTourSummary;
}

export interface HubOurPickInput {
  tourId: string;
  pickType: HubPickType;
  description: string;
  displayOrder?: number;
}

export interface SetOurPicksPayload {
  picks: HubOurPickInput[];
}

export interface SetOurPicksResponse {
  count: number;
  ourPicks: HubOurPick[];
}

// ── Comparison ───────────────────────────────────────────────────────────────
// Same locale constraint as Our Picks: GET resolves `groupName`/`standoutNote`
// to the requested locale (en fallback) without the translation arrays, so the
// dashboard edits base (en) content only. PUT replaces all groups + tour columns.

export interface ComparisonTourItem {
  id: string;
  displayOrder: number;
  standoutNote: string | null;
  tour: OurPickTourSummary;
}

export interface ComparisonGroupItem {
  id: string;
  groupName: string;
  displayOrder: number;
  tours: ComparisonTourItem[];
}

export interface ComparisonTourInput {
  tourId: string;
  standoutNote?: string;
  displayOrder?: number;
}

export interface ComparisonGroupInput {
  groupName: string;
  displayOrder?: number;
  tours: ComparisonTourInput[];
}

export interface SetComparisonPayload {
  groups: ComparisonGroupInput[];
}

export interface SetComparisonResponse {
  count: number;
  groups: ComparisonGroupItem[];
}
