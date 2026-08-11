export const OPERATOR_VERIFICATION_STATUS_VALUES = [
  'UNVERIFIED',
  'PENDING',
  'VERIFIED',
  'REJECTED',
] as const;

export type OperatorVerificationStatus =
  (typeof OPERATOR_VERIFICATION_STATUS_VALUES)[number];

/**
 * The only two decisions `POST /operators/:id/verification` accepts for a
 * PENDING operator. VERIFIED fires the OB-2A "You're approved" email;
 * REJECTED sends nothing.
 */
export type VerificationDecision = 'VERIFIED' | 'REJECTED';

export interface OperatorUserSummary {
  id: string;
  name: string;
  email: string;
}

/** Row shape returned by the paginated list endpoint (`GET /operators`). */
export interface OperatorListItem {
  id: string;
  isActive: boolean;
  verificationStatus: OperatorVerificationStatus;
  /** Stamped by the approve/reject decision; null while UNVERIFIED/PENDING. */
  verificationDecidedAt: string | null;
  /** Stamped once by the operator's first tour publish; null before that. */
  firstTourLiveAt: string | null;
  /** Derived count of tours EVER submitted for review (survives publish). */
  toursSubmitted: number;
  createdAt: string;
  updatedAt: string;
  user: OperatorUserSummary;
  companyInfo: { companyName: string | null } | null;
}

export interface PaginatedOperators {
  total: number;
  page: number;
  limit: number;
  data: OperatorListItem[];
}

/** Full detail returned by `GET /operators/:id`. */
export interface OperatorDetail {
  id: string;
  userId: string;
  isActive: boolean;
  verificationStatus: OperatorVerificationStatus;
  verificationDecidedAt: string | null;
  firstTourLiveAt: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  aggregateRating: number | null;
  aggregateReviewCount: number;
  totalBookings: number;
  cancellationRate90d: string | number;
  forceMajeurePardons: number;
  createdAt: string;
  updatedAt: string;
  user: OperatorUserSummary;
  companyInfo: { companyName: string | null } | null;
}

/** Resolves the label to show for an operator: business name if set, else contact name. */
export function getOperatorDisplayName(op: {
  user: { name: string };
  companyInfo: { companyName: string | null } | null;
}): string {
  return op.companyInfo?.companyName?.trim() || op.user.name;
}

export interface OperatorsQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  verificationStatus?: OperatorVerificationStatus;
}

export interface CreateOperatorPayload {
  name: string;
  email: string;
  isActive?: boolean;
}

/**
 * `verificationStatus` is deliberately ABSENT: the backend's
 * `UpdateOperatorDto` no longer whitelists it (WP-C), so a PATCH carrying it
 * 400s. Status changes go through `operatorsApi.decideVerification` only.
 */
export interface UpdateOperatorPayload {
  isActive?: boolean;
  contactEmail?: string | null;
  contactPhone?: string | null;
}
