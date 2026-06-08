import type {
  AttributeDefinition,
  AttributeDefinitionQuery,
  CreateAttributeDefinitionPayload,
  SetTourAttributesPayload,
  TourAttribute,
  UpdateAttributeDefinitionPayload,
} from '@/types/attribute';

const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050'}/api/v1`;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body?.message) message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

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

  // ── Per-tour values ──
  getForTrip(tripId: string): Promise<TourAttribute[]> {
    return apiFetch<TourAttribute[]>(`/trips/${tripId}/attributes`);
  },
  setForTrip(tripId: string, payload: SetTourAttributesPayload): Promise<TourAttribute[]> {
    return apiFetch<TourAttribute[]>(`/trips/${tripId}/attributes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  removeForTrip(tripId: string, key: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/trips/${tripId}/attributes/${key}`, {
      method: 'DELETE',
    });
  },
};
