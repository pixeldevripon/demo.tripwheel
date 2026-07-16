'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tiersApi } from '@/lib/api/tiers';
import { tripKeys } from '@/hooks/trips/use-trips';
import type {
  ApproveSpotlightPayload,
  ChangeTierPayload,
  CreateSpotlightRequestPayload,
  RejectSpotlightPayload,
  SpotlightQueueParams,
} from '@/types/tier';

export const tierKeys = {
  all: ['tiers'] as const,
  tourSpotlight: (tourId: string) => [...tierKeys.all, 'tour-spotlight', tourId] as const,
  queue: (params: SpotlightQueueParams) => [...tierKeys.all, 'queue', params] as const,
};

// ── Tier ──────────────────────────────────────────────────────────────────────
export function useChangeTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tourId, payload }: { tourId: string; payload: ChangeTierPayload }) =>
      tiersApi.changeTier(tourId, payload),
    onSuccess: (_d, vars) => {
      // The trip detail caches tierKey/commissionTier/tierRank/tierLockedUntil.
      qc.invalidateQueries({ queryKey: tripKeys.detail(vars.tourId) });
      qc.invalidateQueries({ queryKey: tripKeys.all });
    },
  });
}

// ── Spotlight (operator) ────────────────────────────────────────────────────────
export function useTourSpotlight(tourId: string) {
  return useQuery({
    queryKey: tierKeys.tourSpotlight(tourId),
    queryFn: () => tiersApi.getTourSpotlight(tourId),
    enabled: !!tourId,
  });
}

export function useRequestSpotlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tourId, payload }: { tourId: string; payload: CreateSpotlightRequestPayload }) =>
      tiersApi.requestSpotlight(tourId, payload),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: tierKeys.tourSpotlight(vars.tourId) });
    },
  });
}

// ── Spotlight (admin queue) ───────────────────────────────────────────────────
export function useSpotlightQueue(params: SpotlightQueueParams = {}) {
  return useQuery({
    queryKey: tierKeys.queue(params),
    queryFn: () => tiersApi.getSpotlightQueue(params),
    placeholderData: keepPreviousData,
  });
}

export function useApproveSpotlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ApproveSpotlightPayload }) =>
      tiersApi.approveSpotlight(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: tierKeys.all }),
  });
}

export function useRejectSpotlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RejectSpotlightPayload }) =>
      tiersApi.rejectSpotlight(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: tierKeys.all }),
  });
}
