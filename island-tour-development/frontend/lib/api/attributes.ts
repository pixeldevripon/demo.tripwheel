import type {
  AttributeDefinition,
  AttributeDefinitionQuery,
  CreateAttributeDefinitionPayload,
  SetTourAttributesPayload,
  TourAttribute,
  UpdateAttributeDefinitionPayload,
} from '@/types/attribute';

import { apiFetch } from './fetch';

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

export const attributesApi = {
  // ── Dictionary ──
  list(query: AttributeDefinitionQuery = {}): Promise<AttributeDefinition[]> {
    return apiFetch<AttributeDefinition[]>(
      `/attributes${buildQuery(query as Record<string, string | number | boolean | undefined | null>)}`,
    );
  },
  getByKey(key: string): Promise<AttributeDefinition> {
    return apiFetch<AttributeDefinition>(`/attributes/${key}`);
  },
  create(payload: CreateAttributeDefinitionPayload): Promise<AttributeDefinition> {
    return apiFetch<AttributeDefinition>('/attributes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  update(key: string, payload: UpdateAttributeDefinitionPayload): Promise<AttributeDefinition> {
    return apiFetch<AttributeDefinition>(`/attributes/${key}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  deactivate(key: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/attributes/${key}`, { method: 'DELETE' });
  },

  // ── Per-tour values ── (backend controller is `tours/:tourId/attributes`)
  getForTrip(tripId: string): Promise<TourAttribute[]> {
    return apiFetch<TourAttribute[]>(`/tours/${tripId}/attributes`);
  },
  setForTrip(tripId: string, payload: SetTourAttributesPayload): Promise<TourAttribute[]> {
    return apiFetch<TourAttribute[]>(`/tours/${tripId}/attributes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  removeForTrip(tripId: string, key: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/tours/${tripId}/attributes/${key}`, {
      method: 'DELETE',
    });
  },
};
