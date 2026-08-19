import type {
  OperatorCompanyInfo,
  OperatorMollieConfig,
  OperatorPaymentProvider,
  OperatorStripeConfig,
  UpdateOperatorCompanyInfoPayload,
  UpdateOperatorMollieConfigPayload,
  UpdateOperatorPaymentProviderPayload,
  UpdateOperatorStripeConfigPayload,
} from '@/types/operator-settings';
import { apiFetch } from './fetch';

/**
 * Operator-scoped settings. Every call is for the operator's OWN id; the backend
 * enforces ownership (assertOwnerOrAdmin) so an operator can never read or write
 * another operator's configuration. GET endpoints return null when unconfigured.
 *
 * ## Why the nullable getters end in `?? null`
 *
 * Those endpoints return `prisma.findUnique(...)` directly, and Nest serialises
 * a returned `null` as an EMPTY 200 body - not the four bytes `null`. `apiFetch`
 * maps an empty body to `undefined` (correct for the 204/empty-DELETE replies it
 * also has to handle), which TanStack Query rejects outright: "Query data cannot
 * be undefined". So an operator who has never filled in their company details
 * blows up the query instead of getting the empty form.
 *
 * `apiFetch` cannot fix this itself - it has no way to tell "no row" from "no
 * content". Normalising here, where the `| null` contract is declared, is the
 * narrow fix.
 */
export const operatorSettingsApi = {
  // ── Company Information ─────────────────────────────────────────────────────
  async getCompanyInfo(operatorId: string): Promise<OperatorCompanyInfo | null> {
    return (
      (await apiFetch<OperatorCompanyInfo | null>(
        `/operators/${operatorId}/company-info`,
      )) ?? null
    );
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

  // ── Payments: active provider (single switch) ──────────────────────────────
  getPaymentProvider(operatorId: string): Promise<OperatorPaymentProvider> {
    return apiFetch<OperatorPaymentProvider>(`/operators/${operatorId}/payment-provider`);
  },
  updatePaymentProvider(
    operatorId: string,
    payload: UpdateOperatorPaymentProviderPayload,
  ): Promise<OperatorPaymentProvider> {
    return apiFetch<OperatorPaymentProvider>(`/operators/${operatorId}/payment-provider`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  // ── Payments: Stripe ───────────────────────────────────────────────────────
  async getStripeConfig(operatorId: string): Promise<OperatorStripeConfig | null> {
    return (
      (await apiFetch<OperatorStripeConfig | null>(
        `/operators/${operatorId}/stripe-config`,
      )) ?? null
    );
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
  async getMollieConfig(operatorId: string): Promise<OperatorMollieConfig | null> {
    return (
      (await apiFetch<OperatorMollieConfig | null>(
        `/operators/${operatorId}/mollie-config`,
      )) ?? null
    );
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
