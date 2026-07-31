'use client';

import { useQuery } from '@tanstack/react-query';

import { collectionsApi } from '@/lib/api/collections';
import { destinationsApi } from '@/lib/api/destinations';
import { hubsApi } from '@/lib/api/hubs';
import { tripsApi } from '@/lib/api/trips';
import type { RecommendationRefType } from '@/types/recommendation';

/** A pickable internal entity: just the id and its display name. */
export interface RefOption {
  id: string;
  name: string;
}

// Only a picker's worth of rows - the combobox filters client-side, so one
// generous page beats paging through the whole catalogue.
const REF_LIMIT = 100;

/**
 * The options for the INTERNAL entity picker, scoped to the chosen `refType`.
 *
 * All four queries are declared unconditionally (hooks cannot branch on type)
 * but only the matching one is enabled, and only while `enabled` (the popover is
 * open). Each maps its list endpoint down to `{ id, name }`.
 */
export function useRefOptions(
  refType: RecommendationRefType | null,
  enabled: boolean,
): { options: RefOption[]; isLoading: boolean } {
  const on = (t: RecommendationRefType) => enabled && refType === t;

  const tours = useQuery({
    queryKey: ['recommendation-refs', 'tour'],
    queryFn: () => tripsApi.getAdminTrips({ limit: REF_LIMIT }),
    enabled: on('TOUR'),
  });

  const destinations = useQuery({
    queryKey: ['recommendation-refs', 'destination'],
    queryFn: () => destinationsApi.getAll({ limit: REF_LIMIT }),
    enabled: on('DESTINATION'),
  });

  const hubs = useQuery({
    queryKey: ['recommendation-refs', 'hub'],
    queryFn: () => hubsApi.getAll({ limit: REF_LIMIT }),
    enabled: on('HUB'),
  });

  const collections = useQuery({
    queryKey: ['recommendation-refs', 'collection'],
    // No slug - list every collection across all islands.
    queryFn: () => collectionsApi.getAllAdmin(),
    enabled: on('COLLECTION'),
  });

  switch (refType) {
    case 'TOUR':
      return {
        options: (tours.data?.data ?? []).map((t) => ({
          id: t.id,
          name: t.name,
        })),
        isLoading: tours.isLoading,
      };
    case 'DESTINATION':
      return {
        options: (destinations.data?.data ?? []).map((d) => ({
          id: d.id,
          name: d.name,
        })),
        isLoading: destinations.isLoading,
      };
    case 'HUB':
      return {
        options: (hubs.data?.data ?? []).map((h) => ({
          id: h.id,
          name: h.name,
        })),
        isLoading: hubs.isLoading,
      };
    case 'COLLECTION':
      return {
        options: (collections.data ?? []).map((c) => ({
          id: c.id,
          name: c.name,
        })),
        isLoading: collections.isLoading,
      };
    default:
      return { options: [], isLoading: false };
  }
}
