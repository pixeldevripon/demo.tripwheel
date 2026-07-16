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
  images: { url: string; altText: string | null }[];
}

export interface SearchResults {
  total: number;
  page: number;
  limit: number;
  query: string;
  data: SearchHit[];
}
