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

import { apiFetch } from './fetch';

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
