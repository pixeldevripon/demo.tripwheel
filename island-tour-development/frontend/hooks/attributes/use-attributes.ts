'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { attributesApi } from '@/lib/api/attributes';
import type {
  AttributeDefinitionQuery,
  CreateAttributeDefinitionPayload,
  SetTourAttributesPayload,
  UpdateAttributeDefinitionPayload,
} from '@/types/attribute';

export const attributeKeys = {
  all: ['attributes'] as const,
  lists: () => [...attributeKeys.all, 'list'] as const,
  list: (query: AttributeDefinitionQuery) => [...attributeKeys.lists(), query] as const,
  detail: (key: string) => [...attributeKeys.all, 'detail', key] as const,
  forTrip: (tripId: string) => ['trips', tripId, 'attributes'] as const,
};

export function useAttributes(query: AttributeDefinitionQuery = {}) {
  return useQuery({
    queryKey: attributeKeys.list(query),
    queryFn: () => attributesApi.list(query),
    placeholderData: keepPreviousData,
  });
}

export function useAttribute(key: string) {
  return useQuery({
    queryKey: attributeKeys.detail(key),
    queryFn: () => attributesApi.getByKey(key),
    enabled: !!key,
  });
}

export function useCreateAttribute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAttributeDefinitionPayload) => attributesApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: attributeKeys.all }),
  });
}

export function useUpdateAttribute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, payload }: { key: string; payload: UpdateAttributeDefinitionPayload }) =>
      attributesApi.update(key, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: attributeKeys.all });
      qc.invalidateQueries({ queryKey: attributeKeys.detail(vars.key) });
    },
  });
}

export function useDeactivateAttribute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => attributesApi.deactivate(key),
    onSuccess: () => qc.invalidateQueries({ queryKey: attributeKeys.all }),
  });
}

// ── Per-tour values ──

export function useTripAttributes(tripId: string) {
  return useQuery({
    queryKey: attributeKeys.forTrip(tripId),
    queryFn: () => attributesApi.getForTrip(tripId),
    enabled: !!tripId,
  });
}

export function useSetTripAttributes(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SetTourAttributesPayload) => attributesApi.setForTrip(tripId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: attributeKeys.forTrip(tripId) }),
  });
}

export function useRemoveTripAttribute(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => attributesApi.removeForTrip(tripId, key),
    onSuccess: () => qc.invalidateQueries({ queryKey: attributeKeys.forTrip(tripId) }),
  });
}
