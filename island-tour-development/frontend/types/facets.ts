/**
 * Faceted-filter shapes returned by the public `GET /filters/:dest` (destination-
 * wide) and `GET /filters/:dest/:cat` (category-scoped) endpoints. Powers the
 * All Tours / category page filter modal: dynamic price bounds + attribute
 * sections with per-value counts.
 */

export interface AttributeFacetValue {
  value: string;
  count: number;
}

export interface AttributeFacet {
  key: string;
  displayName: string;
  dataType: string;
  filterDisplayType: string | null;
  isSortable: boolean;
  sortOrder: number;
  values: AttributeFacetValue[];
}

export interface TourFacets {
  destination: string;
  /** null for the destination-wide variant. */
  category: string | null;
  total: number;
  priceRange: { min: number; max: number } | null;
  durationRange: { min: number; max: number } | null;
  filters: AttributeFacet[];
}
