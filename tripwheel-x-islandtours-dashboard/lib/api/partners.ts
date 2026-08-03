import type {
  CreatePartnerAccountPayload,
  MintedPartnerApiKey,
  MintPartnerApiKeyPayload,
  OperatorDistribution,
  PaginatedPartners,
  PartnerAccount,
  PartnerApiKey,
  UpdateOperatorDistributionPayload,
  UpdatePartnerAccountPayload,
} from '@/types/partner';
import { apiFetch } from './fetch';

/**
 * Distribution partner administration.
 *
 * Two audiences with deliberately asymmetric power. Admins (`MANAGE_PARTNERS`) create
 * channel accounts, mint and revoke keys, and set an operator's rate. Operators can read
 * their own distribution state and switch it OFF - never mint, never set their own rate,
 * never see another operator's partners. The operator always holds the veto, never the pen.
 */
export const partnersApi = {
  // ── Admin: accounts ───────────────────────────────────────────────────────
  list(params?: {
    page?: number;
    limit?: number;
    operatorId?: string;
    search?: string;
  }): Promise<PaginatedPartners> {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.operatorId) qs.set('operatorId', params.operatorId);
    if (params?.search) qs.set('search', params.search);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<PaginatedPartners>(`/partners${suffix}`);
  },

  get(id: string): Promise<PartnerAccount> {
    return apiFetch<PartnerAccount>(`/partners/${id}`);
  },

  create(payload: CreatePartnerAccountPayload): Promise<PartnerAccount> {
    return apiFetch<PartnerAccount>('/partners', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update(
    id: string,
    payload: UpdatePartnerAccountPayload,
  ): Promise<PartnerAccount> {
    return apiFetch<PartnerAccount>(`/partners/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  // ── Admin: keys ───────────────────────────────────────────────────────────

  /**
   * Returns the key plaintext. THE ONLY TIME it is ever available.
   *
   * The caller must show it once and discard it. Do not put the result in a long-lived
   * query cache, and do not log it.
   */
  mintKey(
    partnerId: string,
    payload: MintPartnerApiKeyPayload,
  ): Promise<MintedPartnerApiKey> {
    return apiFetch<MintedPartnerApiKey>(`/partners/${partnerId}/keys`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** POST, not DELETE: the row is kept so the hash can never be re-minted for someone else. */
  revokeKey(partnerId: string, keyId: string): Promise<PartnerApiKey> {
    return apiFetch<PartnerApiKey>(
      `/partners/${partnerId}/keys/${keyId}/revoke`,
      { method: 'POST' },
    );
  },

  // ── Admin: operator commercial terms ──────────────────────────────────────
  getOperatorDistribution(operatorId: string): Promise<OperatorDistribution> {
    return apiFetch<OperatorDistribution>(
      `/partners/operators/${operatorId}/distribution`,
    );
  },

  setOperatorDistribution(
    operatorId: string,
    payload: UpdateOperatorDistributionPayload,
  ): Promise<OperatorDistribution> {
    return apiFetch<OperatorDistribution>(
      `/partners/operators/${operatorId}/distribution`,
      { method: 'PATCH', body: JSON.stringify(payload) },
    );
  },

  // ── Operator self-service ─────────────────────────────────────────────────
  // Implicitly scoped to the caller's own operator: the backend resolves it from the
  // session, so there is no operatorId on the wire and one operator can never address
  // another's distribution.
  getOwnDistribution(): Promise<OperatorDistribution> {
    return apiFetch<OperatorDistribution>('/partners/distribution');
  },

  toggleOwnDistribution(
    distributionEnabled: boolean,
  ): Promise<OperatorDistribution> {
    return apiFetch<OperatorDistribution>('/partners/distribution', {
      method: 'PATCH',
      body: JSON.stringify({ distributionEnabled }),
    });
  },
};
