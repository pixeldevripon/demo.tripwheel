/**
 * Search result shapes, shared by the server-side cached loader
 * (`lib/api/public/search.ts`) and the client typeahead (`lib/api/search.ts`).
 * Neutral (no runtime imports) so it is safe in both server and client bundles.
 */
import type { Money } from './money';

/** A single search hit — enough to render a card and link to the flat tour URL. */
export interface SearchHit {
  id: string;
  /** Localized title (falls back to the canonical name). */
  title: string;
  /**
   * Localized card teaser (≤160 chars) - the carousel description slide
   * (S4j). The backend falls back to a truncated overview excerpt when the
   * operator left `shortDescription` empty; null when neither exists.
   */
  shortDescription?: string | null;
  /** Canonical English name. */
  name: string;
  slug: string;
  /** Destination slug for the flat URL `/{locale}/{destinationSlug}/{slug}`. */
  destinationSlug: string | null;
  priceFrom: string | null;
  basePrice: string | null;
  defaultCurrency: string;
  /** Converted display prices when `?currency` was requested (guide §20.9). */
  money?: Money;
  pricingModel: string;
  /** Whole-unit type when pricingModel = UNIT (boat/vehicle/…); else null. */
  wholeUnitType?: string | null;
  /** UNIT pricing: travelers covered by basePrice ("/10 people"); null for PER_PERSON. */
  unitIncludedGuests?: number | null;
  /** UNIT pricing: surcharge per traveler beyond unitIncludedGuests; null for PER_PERSON. */
  extraPersonPrice?: string | null;
  minPartySize?: number;
  maxPartySize?: number | null;
  durationMinutesFrom: number | null;
  durationMinutesTo: number | null;
  /**
   * Backend-computed Day/Overnight charter verdict (operator `sleepAboard` flag
   * OR duration >= 16h). The hub page partitions its charter groups on this -
   * never re-derive it client-side from duration.
   */
  isOvernight?: boolean;
  /** Activity hubs this tour belongs to (0 or more). The first drives the card's hub eyebrow. */
  hubs?: { id: string; name: string; slug: string }[];
  pickupModel: string;
  cancellationHours: number | null;
  familyFriendly?: boolean;
  /** Resolved attribute values for the card chip row (listing endpoint only). */
  attributes?: { key: string; value: string; dataType: string }[];
  aggregateRating: number | null;
  aggregateReviewCount: number;
  isLocalsFavourite: boolean;
  /** Listing badge (master §3.6/§3.7), at most one by priority; null = none. */
  badge: 'sponsored' | 'likelyToSellOut' | 'mostPopular' | 'new' | null;
  /**
   * ACTIVE Destination Spotlight placement (max 3/destination). Distinct from
   * the Sponsored BADGE (which also covers paid tiers as a fallback label):
   * only the spotlight placement gets the pre-highlighted card treatment.
   */
  isSponsored: boolean;
  images: { url: string; altText: string | null }[];
  /** Localized primary-category name - context label on typeahead rows. */
  categoryName?: string | null;
  categorySlug?: string | null;
  /**
   * Primary category ID (listing endpoint only - the search endpoint resolves
   * the NAME instead). Lets a caller that already holds the island's categories
   * print the same context label without a second request.
   */
  primaryCategoryId?: string | null;
  /** Destination display name (suggest endpoint only - "Beyond X" rows). */
  destinationName?: string | null;
}

// ── Typeahead suggestions (GET /search/suggest) ─────────────────────────────

/**
 * The target page's own hero photo, on every entity bucket. Nullable - a page
 * with no photo renders the flat fallback surface, never a stand-in glyph.
 */
export interface SuggestCategory {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  tourCount: number;
}

export interface SuggestHub {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  destinationSlug: string;
  destinationName: string;
}

/**
 * A matched collection. Shares the hub shape because both resolve through the
 * flat `/{destination}/{slug}` namespace and both need their island named when
 * the search is unscoped.
 */
export interface SuggestCollection {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  destinationSlug: string;
  destinationName: string;
}

export interface SearchSuggest {
  query: string;
  /** Scoped total for the "see all N results" footer. */
  total: number;
  categories: SuggestCategory[];
  hubs: SuggestHub[];
  collections: SuggestCollection[];
  tours: SearchHit[];
  beyondTours: SearchHit[];
}

export interface SearchResults {
  total: number;
  page: number;
  limit: number;
  query: string;
  data: SearchHit[];
}
