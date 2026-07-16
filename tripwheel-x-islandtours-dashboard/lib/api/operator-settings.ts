import type {
  OperatorCompanyInfo,
  OperatorMollieConfig,
  OperatorStripeConfig,
  UpdateOperatorCompanyInfoPayload,
  UpdateOperatorMollieConfigPayload,
  UpdateOperatorStripeConfigPayload,
} from '@/types/operator-settings';
import { apiFetch } from './fetch';

/**
 * Operator-scoped settings. Every call is for the operator's OWN id; the backend
 * enforces ownership (assertOwnerOrAdmin) so an operator can never read or write
 * another operator's configuration. GET endpoints return null when unconfigured.
 */
export const operatorSettingsApi = {
  // ── Company Information ─────────────────────────────────────────────────────
  getCompanyInfo(operatorId: string): Promise<OperatorCompanyInfo | null> {
    return apiFetch<OperatorCompanyInfo | null>(`/operators/${operatorId}/company-info`);
  },
  updateCompanyInfo(
    operatorId: string,
    payload: UpdateOperatorCompanyInfoPayload,
  ): Promise<OperatorCompanyInfo> {
    return apiFetch<OperatorCompanyInfo>(`/operators/${operatorId}/company-info`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  // ── Payments: Stripe ───────────────────────────────────────────────────────
  getStripeConfig(operatorId: string): Promise<OperatorStripeConfig | null> {
    return apiFetch<OperatorStripeConfig | null>(`/operators/${operatorId}/stripe-config`);
  },
  updateStripeConfig(
    operatorId: string,
    payload: UpdateOperatorStripeConfigPayload,
  ): Promise<OperatorStripeConfig> {
    return apiFetch<OperatorStripeConfig>(`/operators/${operatorId}/stripe-config`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  // ── Payments: Mollie ───────────────────────────────────────────────────────
  getMollieConfig(operatorId: string): Promise<OperatorMollieConfig | null> {
    return apiFetch<OperatorMollieConfig | null>(`/operators/${operatorId}/mollie-config`);
  },
  updateMollieConfig(
    operatorId: string,
    payload: UpdateOperatorMollieConfigPayload,
  ): Promise<OperatorMollieConfig> {
    return apiFetch<OperatorMollieConfig>(`/operators/${operatorId}/mollie-config`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};
