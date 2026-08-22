import type { OperatorVerificationStatus } from '@/types/operator';

/** The list's pipeline facets (WP-E E-16). */
export type OperatorFacet = 'zeroTours' | 'firstTourLive';

/**
 * Which verification statuses are filterable (all but UNVERIFIED). The
 * toolbar chips derive from this - one home, so a chip cannot exist without
 * its filter value or vice versa (review finding 5 on PR #56).
 */
export const VERIFICATION_FILTER_VALUES = [
  'PENDING',
  'VERIFIED',
  'REJECTED',
] as const satisfies readonly OperatorVerificationStatus[];
