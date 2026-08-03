/**
 * Distribution partners - the third-party channels (OTAs, resellers, channel managers)
 * that consume our OCTO API. Mirrors backend `src/partners/dto/partner.dto.ts`.
 *
 * The key concept to hold on to: a partner API key does three jobs at once. It says WHO is
 * calling, WHICH operator's inventory they may see, and WHETHER they are in test or live.
 * That is why the UI treats scope and environment as first-class rather than as settings.
 */

/** Which inventory a partner account can see. */
export const PartnerCatalogScope = {
  /** One operator's tours. The normal case. */
  SINGLE_OPERATOR: 'SINGLE_OPERATOR',
  /** The whole marketplace. The exception, for a channel syndicating everything. */
  WHOLE_PLATFORM: 'WHOLE_PLATFORM',
} as const;

export type PartnerCatalogScope =
  (typeof PartnerCatalogScope)[keyof typeof PartnerCatalogScope];

/**
 * Live or test. Bound to the KEY, never to a request header - a test key cannot touch
 * live capacity or money, and no header can promote it.
 */
export const PartnerEnv = {
  TEST: 'TEST',
  LIVE: 'LIVE',
} as const;

export type PartnerEnv = (typeof PartnerEnv)[keyof typeof PartnerEnv];

/** What a key is allowed to do. A key with none can do nothing. */
export const PartnerScope = {
  CATALOG_READ: 'CATALOG_READ',
  AVAILABILITY_READ: 'AVAILABILITY_READ',
  BOOKINGS_WRITE: 'BOOKINGS_WRITE',
} as const;

export type PartnerScope = (typeof PartnerScope)[keyof typeof PartnerScope];

export const PARTNER_SCOPE_LABELS: Record<PartnerScope, string> = {
  CATALOG_READ: 'Read the catalog',
  AVAILABILITY_READ: 'Check availability',
  BOOKINGS_WRITE: 'Create bookings',
};

export interface PartnerApiKey {
  id: string;
  /** Display-safe fragment, e.g. `itk_live_a1b2`. The full key is never returned again. */
  keyPrefix: string;
  label: string | null;
  environment: PartnerEnv;
  scopes: PartnerScope[];
  /** EMPTY MEANS ANY ADDRESS, never "deny all". */
  ipAllowlist: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  /** Computed by the backend so the UI never re-derives it and drifts from the guard. */
  isLive: boolean;
  createdAt: string;
}

/**
 * The mint response. `plaintext` exists in exactly one HTTP response, ever.
 *
 * It must be shown once and never written to localStorage, a query cache that outlives the
 * dialog, or anywhere else it could be recovered. A lost key is revoked and re-minted.
 */
export interface MintedPartnerApiKey extends PartnerApiKey {
  plaintext: string;
}

export interface PartnerAccount {
  id: string;
  name: string;
  slug: string;
  contactEmail: string | null;
  catalogScope: PartnerCatalogScope;
  operatorId: string | null;
  operatorName: string | null;
  isActive: boolean;
  notes: string | null;
  apiKeys: PartnerApiKey[];
  createdAt: string;
  updatedAt: string;
}

/** What an operator sees and controls about their own distribution. */
export interface OperatorDistribution {
  /** The operator's own kill switch. False = no channel can read their inventory. */
  distributionEnabled: boolean;
  /** Percentage of retail given up on a channel booking. Platform-set, read-only here. */
  distributionRatePct: number | null;
  distributionAgreedAt: string | null;
  /** The OCTO Supplier id partners see. Required before distribution can be switched on. */
  slug: string | null;
  profileComplete: boolean;
  missingFields: string[];
  connectedChannels: string[];
}

export interface CreatePartnerAccountPayload {
  name: string;
  slug?: string;
  contactEmail?: string;
  catalogScope: PartnerCatalogScope;
  operatorId?: string;
  notes?: string;
}

export interface UpdatePartnerAccountPayload {
  name?: string;
  contactEmail?: string;
  isActive?: boolean;
  notes?: string;
}

export interface MintPartnerApiKeyPayload {
  environment: PartnerEnv;
  scopes: PartnerScope[];
  label?: string;
  ipAllowlist?: string[];
  expiresAt?: string;
}

export interface UpdateOperatorDistributionPayload {
  distributionRatePct?: number;
  slug?: string;
}

export interface PaginatedPartners {
  total: number;
  page: number;
  limit: number;
  data: PartnerAccount[];
}
