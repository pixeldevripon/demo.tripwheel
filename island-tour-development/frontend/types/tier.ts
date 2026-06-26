// Commission tier + Destination Spotlight types — mirror the backend `tiers` module
// (`/api/v1/tiers`). TierKey/EligibilityState enums live in `types/trip.ts`.
import type { TierKey } from '@/types/trip';
export type { TierKey, EligibilityState } from '@/types/trip';

// ── Tier metadata (mirrors backend TIER_MAP in tiers.service.ts) ─────────────────
export const TIER_KEY_VALUES: TierKey[] = ['premium', 'featured', 'boosted', 'organic', 'standard'];

export const TIER_META: Record<TierKey, { label: string; commission: number; rank: number }> = {
  premium: { label: 'Premium', commission: 30.0, rank: 1 },
  featured: { label: 'Featured', commission: 27.5, rank: 2 },
  boosted: { label: 'Boosted', commission: 25.0, rank: 3 },
  organic: { label: 'Organic', commission: 22.5, rank: 4 },
  standard: { label: 'Standard', commission: 20.0, rank: 5 },
};

export const SPOTLIGHT_COMMISSION_PCT = 35.0;
export const SPOTLIGHT_MIN_REVIEWS = 10;
export const SPOTLIGHT_MIN_RATING = 4.5;
export const SPOTLIGHT_MAX_ACTIVE_PER_DESTINATION = 3;
export const TIER_LOCK_DAYS = 30;

// ── Tier change (PATCH /tiers/tours/:tourId/tier) ─────────────────────────────────
export interface ChangeTierPayload {
  tierKey: TierKey;
}

export interface TierChangeResponse {
  tourId: string;
  tierKey: TierKey;
  commissionTier: number;
  tierRank: number;
  tierLockedUntil: string | null;
}

// ── Spotlight ─────────────────────────────────────────────────────────────────
export type SpotlightStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'EXPIRED';

export const SPOTLIGHT_STATUS_VALUES: SpotlightStatus[] = [
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'ACTIVE',
  'EXPIRED',
];

export const SPOTLIGHT_STATUS_LABELS: Record<SpotlightStatus, string> = {
  REQUESTED: 'Requested',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  ACTIVE: 'Active',
  EXPIRED: 'Expired',
};

export interface SpotlightRequest {
  id: string;
  tourId: string;
  operatorId: string;
  destinationId: string;
  status: SpotlightStatus;
  requestedAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  startsAt: string | null;
  endsAt: string | null;
  note: string | null;
  requestedStartsAt: string | null;
  requestedDurationDays: number | null;
  rejectionReason: string | null;
  requestedBy: string | null;
}

// Operator request (POST /tiers/tours/:tourId/spotlight)
export interface CreateSpotlightRequestPayload {
  requestedStartsAt?: string;
  requestedDurationDays?: number;
}

// GET /tiers/tours/:tourId/spotlight
export interface TourSpotlightHistory {
  current: SpotlightRequest | null;
  history: SpotlightRequest[];
}

// Admin queue (GET /tiers/admin/spotlight)
export interface SpotlightQueueParams {
  destinationId?: string;
  status?: SpotlightStatus;
}

export interface SpotlightQueue {
  activeCount: number;
  data: SpotlightRequest[];
}

// Admin approve / reject
export interface ApproveSpotlightPayload {
  startsAt: string;
  endsAt: string;
  note?: string;
}

export interface RejectSpotlightPayload {
  rejectionReason: string;
}
