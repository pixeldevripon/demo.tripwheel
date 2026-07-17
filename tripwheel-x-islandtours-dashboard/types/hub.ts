import type { Locale } from '@/types/locale';
import type { Money } from '@/types/money';
import type { HubPickType, HubSectionType, HubStatus, HubType } from '@/types/enums';
export type { Locale } from '@/types/locale';
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
  /** Optional illustrative image (Discover / editorial cards). */
  image: string | null;
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
  // Enriched card fields (present on the public render + admin read-back). Prices
  // are raw Decimal, serialized as string|number (mirrors the /tours card).
  heroImage?: string | null;
  heroImageAlt?: string | null;
  /** Hero-first (capped) image set for the card hover-carousel. */
  images?: { url: string; altText: string | null }[];
  priceFrom?: number | string | null;
  basePrice?: number | string | null;
  currency?: string;
  /** Converted display prices when `?currency` was requested (guide §20.9). */
  money?: Money;
  pricingModel?: string;
  unitType?: string | null;
  rating?: number | null;
  reviewCount?: number;
  durationMinutesFrom?: number | null;
  durationMinutesTo?: number | null;
  bookingCount?: number;
  /** boat_type attribute value (for the pick card), e.g. "yacht". */
  boatType?: string | null;
}

export interface HubOurPick {
  id: string;
  pickType: HubPickType;
  description: string;
  displayOrder: number;
  tour: OurPickTourSummary;
}

export interface OurPickTranslationInput {
  locale: Locale;
  description: string;
}

export interface HubOurPickInput {
  tourId: string;
  pickType: HubPickType;
  description: string;
  displayOrder?: number;
  /** Per-locale blurb translations (non-en); en lives in `description`. */
  translations?: OurPickTranslationInput[];
}

/** Admin read-back for the Our Picks editor: base blurb + all stored translations. */
export interface HubOurPickForEdit {
  id: string;
  tourId: string;
  tourName: string;
  pickType: HubPickType;
  displayOrder: number;
  description: string;
  translations: { locale: Locale; description: string }[];
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

export interface ComparisonStandoutTranslationInput {
  locale: Locale;
  standoutNote: string;
}

export interface ComparisonGroupNameTranslationInput {
  locale: Locale;
  groupName: string;
}

export interface ComparisonTourInput {
  tourId: string;
  standoutNote?: string;
  displayOrder?: number;
  translations?: ComparisonStandoutTranslationInput[];
}

export interface ComparisonGroupInput {
  groupName: string;
  displayOrder?: number;
  translations?: ComparisonGroupNameTranslationInput[];
  tours: ComparisonTourInput[];
}

export interface SetComparisonPayload {
  groups: ComparisonGroupInput[];
}

export interface SetComparisonResponse {
  count: number;
  groups: ComparisonGroupItem[];
}

// Admin all-locale read-back for the comparison editor tabs.
export interface ComparisonTourForEdit {
  id: string;
  tourId: string;
  tourName: string;
  standoutNote: string | null;
  displayOrder: number;
  translations: ComparisonStandoutTranslationInput[];
}

export interface ComparisonGroupForEdit {
  id: string;
  groupName: string;
  displayOrder: number;
  translations: ComparisonGroupNameTranslationInput[];
  tours: ComparisonTourForEdit[];
}

// ── Public render payload (GET /hubs/render/:slug) ─────────────────────────────
// Published-only aggregate for the public hub page (master 5.5). Editorial fields
// fall back to English on the backend.

/** A content-section block resolved for one locale (Discover / Local Tip / Fast Fact). */
export interface HubRenderSection {
  locale: Locale;
  sectionType: HubSectionType;
  heading: string;
  body: string;
  image: string | null;
  displayOrder: number;
}

/** At-a-glance hero pills, computed from the hub's live tour set. */
export interface HubHeroStats {
  durationMinutesFrom: number | null;
  durationMinutesTo: number | null;
  priceFrom: number | null;
  /** Distinct ACTIVE departure weekdays across the hub (0-7); 7 = daily. */
  frequencyDays: number;
  /** Most common amenity attribute key for the hero inclusion pill (e.g. 'bbq_included'); null when none. */
  inclusion: string | null;
}

export interface HubRenderHero {
  heroImage: string | null;
  h1: string;
  heroTagline: string | null;
  fastFacts: HubRenderSection[];
  stats: HubHeroStats;
}

export interface HubRenderOurPick {
  id: string;
  pickType: HubPickType;
  description: string;
  displayOrder: number;
  tour: OurPickTourSummary;
}

/** One auto-derived comparison cell, index-aligned to the group's tour columns. */
export interface HubComparisonCell {
  parts: string[];
  /** BOOLEAN attributes only (true/false); null for non-boolean or blank cells. */
  check: boolean | null;
}

/** One auto-derived comparison row (frozen first column = `label`). */
export interface HubComparisonRow {
  key: string;
  label: string;
  dataType: string;
  cells: HubComparisonCell[];
}

export interface HubRenderComparisonGroup {
  id: string;
  groupName: string;
  displayOrder: number;
  tours: ComparisonTourItem[];
  rows: HubComparisonRow[];
}

export interface HubRenderFaq {
  id: string;
  question: string;
  answer: string;
  displayOrder: number;
}

export interface HubRelated {
  id: string;
  slug: string;
  name: string;
  heroImage: string | null;
}

export interface HubRender {
  id: string;
  slug: string;
  name: string;
  locale: Locale;
  hubType: HubType | null;
  breadcrumbLabel: string | null;
  hero: HubRenderHero;
  editorialLead: string | null;
  /** Discover section intro/subtitle (EDITORIAL content section); null falls back to a static string. */
  discoverIntro: string | null;
  /** First-timer green-check takeaways (HIGHLIGHT content sections, in order). */
  highlights: string[];
  ourPicks: HubRenderOurPick[];
  comparisonGroups: HubRenderComparisonGroup[];
  discover: HubRenderSection[];
  localTips: HubRenderSection[];
  faqs: HubRenderFaq[];
  relatedHubs: HubRelated[];
  /** Category slugs this hub covers; excluded from the "Also worth" grid. */
  allowedCategorySlugs: string[];
}
