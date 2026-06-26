import type {
  ApproveSpotlightPayload,
  ChangeTierPayload,
  CreateSpotlightRequestPayload,
  RejectSpotlightPayload,
  SpotlightQueue,
  SpotlightQueueParams,
  SpotlightRequest,
  TierChangeResponse,
  TourSpotlightHistory,
} from '@/types/tier';

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

function buildQuery(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v);
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

export const tiersApi = {
  // ── Operator (EDIT_TRIP) ──────────────────────────────────────────────────────
  changeTier(tourId: string, payload: ChangeTierPayload): Promise<TierChangeResponse> {
    return apiFetch<TierChangeResponse>(`/tiers/tours/${tourId}/tier`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  requestSpotlight(tourId: string, payload: CreateSpotlightRequestPayload): Promise<SpotlightRequest> {
    return apiFetch<SpotlightRequest>(`/tiers/tours/${tourId}/spotlight`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getTourSpotlight(tourId: string): Promise<TourSpotlightHistory> {
    return apiFetch<TourSpotlightHistory>(`/tiers/tours/${tourId}/spotlight`);
  },

  // ── Admin (APPROVE_SPOTLIGHT) ─────────────────────────────────────────────────
  getSpotlightQueue(params: SpotlightQueueParams = {}): Promise<SpotlightQueue> {
    return apiFetch<SpotlightQueue>(
      `/tiers/admin/spotlight${buildQuery({ destinationId: params.destinationId, status: params.status })}`
    );
  },

  approveSpotlight(id: string, payload: ApproveSpotlightPayload): Promise<SpotlightRequest> {
    return apiFetch<SpotlightRequest>(`/tiers/admin/spotlight/${id}/approve`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  rejectSpotlight(id: string, payload: RejectSpotlightPayload): Promise<SpotlightRequest> {
    return apiFetch<SpotlightRequest>(`/tiers/admin/spotlight/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};
