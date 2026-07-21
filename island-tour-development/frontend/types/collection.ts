import type { Locale } from '@/lib/constants/locales';
import type { Money } from '@/types/money';
import type { CollectionDisplayStyle, CollectionStatus, CollectionType } from '@/types/enums';
import type { ResolvedPageContent } from '@/types/page-content';
export type { Locale } from '@/lib/constants/locales';
export type { CollectionDisplayStyle, CollectionStatus, CollectionType } from '@/types/enums';

/**
 * Saved filter for a DYNAMIC collection. Every key maps 1:1 to a backend
 * `TourQueryDto` field consumed by the tour-listing engine when the collection is
 * resolved. Kept in sync with the backend `CollectionFilterQueryDto`.
 */
export interface CollectionFilterQuery {
  categoryId?: string;
  categoryIds?: string[];
  hubId?: string;
  minPrice?: number;
  maxPrice?: number;
  durationMin?: number;
  durationMax?: number;
  ratingMin?: number;
  cancellationMaxHours?: number;
  pickupAvailable?: boolean;
  isLocalsFavourite?: boolean;
  pricingModel?: 'PER_PERSON' | 'UNIT';
  /** Dictionary attribute filters: OR within a key, AND across keys. */
  attributes?: Record<string, string | string[]>;
}

export interface Collection {
  id: string;
  destinationId: string;
  name: string;
  slug: string;
  collectionType: CollectionType;
  status: CollectionStatus;
  displayStyle: CollectionDisplayStyle;
  tourIds: string[] | null; // null/empty for DYNAMIC collections
  filterQuery: CollectionFilterQuery | null;
  heroImage: string | null;
  ogImage: string | null;
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

/** A resolved tour card in the public collection render (subset of the tour shape). */
export interface CollectionRenderTour {
  id: string;
  slug: string;
  name: string;
  priceFrom: number | string | null;
  basePrice?: number | string | null;
  /** Converted display prices when `?currency` was requested (guide §20.9). */
  money?: Money;
  aggregateRating: number | null;
  aggregateReviewCount: number;
  bookingCount?: number;
  durationMinutesFrom: number | null;
  durationMinutesTo: number | null;
  pickupModel: string;
  pricingModel: string;
  cancellationHours: number | null;
  /** Server-derived badge (master §3.6); absent for MANUAL membership cards. */
  badge?: 'new' | 'likelyToSellOut' | 'mostPopular' | 'sponsored' | null;
  /** ACTIVE Destination Spotlight placement (drives the highlighted card). */
  isSponsored?: boolean;
  images?: { url: string }[];
  /** MANUAL only: the per-tour rationale for the requested locale (falls back to en). */
  rationale?: string | null;
  /** DYNAMIC: the tour's own localized overview, used as the card blurb (Option 1). */
  overview?: string | null;
}

export interface CollectionRelated {
  id: string;
  name: string;
  slug: string;
  heroImage: string | null;
}

/** Full §10 render payload for a PUBLISHED collection page (GET /collections/render/:slug). */
export interface CollectionRender extends CollectionLocalized {
  overview: string | null;
  h1Override: string | null;
  breadcrumbLabel: string | null;
  curationNote: string | null;
  eyebrowLabel: string | null;
  /**
   * Authored About + SEO copy, already resolved locale → English by the backend.
   *
   * Optional because this payload is cached for days: during a rollout the cache
   * still holds entries written by a backend that predates the field, and a
   * non-optional read would throw inside `generateMetadata` for every one of
   * them. Guard it until those entries have aged out.
   */
  pageContent?: ResolvedPageContent;
  tours: CollectionRenderTour[];
  fastStats: { tourCount: number; fromPrice: number | null };
  faqs: CollectionFaq[];
  relatedCollections: CollectionRelated[];
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
  filterQuery?: CollectionFilterQuery;
  heroImage?: string | null;
  ogImage?: string | null;
  sortOrder?: string;
  status?: CollectionStatus;
  displayStyle?: CollectionDisplayStyle;
}

export interface UpdateCollectionPayload {
  name?: string;
  slug?: string;
  tourIds?: string[];
  filterQuery?: CollectionFilterQuery;
  heroImage?: string | null;
  ogImage?: string | null;
  sortOrder?: string;
  displayStyle?: CollectionDisplayStyle;
  isActive?: boolean;
}

// Translation / page-content / FAQ payloads (mirror Category)
export interface CollectionTranslationFields {
  name?: string | null;
  overview?: string | null;
  curationNote?: string | null;
  eyebrowLabel?: string | null;
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
  curationNote: string | null;
  eyebrowLabel: string | null;
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

// ── Status lifecycle ────────────────────────────────────────────────────────────
export interface UpdateCollectionStatusPayload {
  status: CollectionStatus;
}

// ── MANUAL membership (replace-all PUT) ───────────────────────────────────────────
export interface CollectionTourMember {
  tourId: string;
  position: number;
}

export interface ReplaceCollectionToursPayload {
  tours: CollectionTourMember[];
}

/** Response row from PUT /collections/:id/tours. */
export interface CollectionTourEntry {
  id: string;
  tourId: string;
  position: number;
}

/**
 * Read-back row from GET /collections/:id/tours (admin Tours editor): the ordered
 * MANUAL membership with each member's name and its per-locale rationales.
 */
export interface CollectionTourForEdit {
  tourId: string;
  position: number;
  name: string | null;
  rationales: Partial<Record<Locale, string>>;
}

// ── Per-tour, per-locale rationale (≤20 words) ────────────────────────────────────
export interface UpsertCollectionTourRationalePayload {
  rationale: string;
}

export interface CollectionTourRationale {
  id: string;
  tourId: string;
  locale: Locale;
  rationale: string;
}
