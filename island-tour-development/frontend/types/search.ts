/**
 * Search result shapes, shared by the server-side cached loader
 * (`lib/api/public/search.ts`) and the client typeahead (`lib/api/search.ts`).
 * Neutral (no runtime imports) so it is safe in both server and client bundles.
 */

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
  pricingModel: string;
  durationMinutesFrom: number | null;
  durationMinutesTo: number | null;
  pickupModel: string;
  cancellationHours: number | null;
  aggregateRating: number | null;
  aggregateReviewCount: number;
  isLocalsFavourite: boolean;
  images: { url: string; altText: string | null }[];
}

export interface SearchResults {
  total: number;
  page: number;
  limit: number;
  query: string;
  data: SearchHit[];
}
