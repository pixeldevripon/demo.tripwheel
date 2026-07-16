export const OPERATOR_VERIFICATION_STATUS_VALUES = [
  'UNVERIFIED',
  'PENDING',
  'VERIFIED',
  'REJECTED',
] as const;

export type OperatorVerificationStatus =
  (typeof OPERATOR_VERIFICATION_STATUS_VALUES)[number];

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
}

export interface CreateOperatorPayload {
  name: string;
  email: string;
  isActive?: boolean;
}

export interface UpdateOperatorPayload {
  isActive?: boolean;
  verificationStatus?: OperatorVerificationStatus;
  contactEmail?: string | null;
  contactPhone?: string | null;
}
