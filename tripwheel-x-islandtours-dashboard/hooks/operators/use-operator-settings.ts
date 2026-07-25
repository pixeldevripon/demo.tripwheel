'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { operatorSettingsApi } from '@/lib/api/operator-settings';
import type {
  UpdateOperatorCompanyInfoPayload,
  UpdateOperatorMollieConfigPayload,
  UpdateOperatorPaymentProviderPayload,
  UpdateOperatorStripeConfigPayload,
} from '@/types/operator-settings';

export const operatorSettingsKeys = {
  all: ['operator-settings'] as const,
  company: (id: string) => [...operatorSettingsKeys.all, 'company', id] as const,
  stripe: (id: string) => [...operatorSettingsKeys.all, 'stripe', id] as const,
  provider: (id: string) => [...operatorSettingsKeys.all, 'provider', id] as const,
  mollie: (id: string) => [...operatorSettingsKeys.all, 'mollie', id] as const,
};

const onError = (err: Error) => toast.error(err.message || 'Failed to save settings');
const saved = () => toast.success('Settings saved');

// ── Company Information ─────────────────────────────────────────────────────
export function useOperatorCompanyInfo(operatorId: string | undefined) {
  return useQuery({
    queryKey: operatorSettingsKeys.company(operatorId ?? ''),
    queryFn: () => operatorSettingsApi.getCompanyInfo(operatorId!),
    enabled: !!operatorId,
  });
}
export function useUpdateOperatorCompanyInfo(operatorId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateOperatorCompanyInfoPayload) =>
      operatorSettingsApi.updateCompanyInfo(operatorId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: operatorSettingsKeys.company(operatorId) });
      saved();
    },
    onError,
  });
}

// ── Payments: active provider (single switch) ──────────────────────────────
export function useOperatorPaymentProvider(operatorId: string | undefined) {
  return useQuery({
    queryKey: operatorSettingsKeys.provider(operatorId ?? ''),
    queryFn: () => operatorSettingsApi.getPaymentProvider(operatorId!),
    enabled: !!operatorId,
  });
}
export function useUpdateOperatorPaymentProvider(operatorId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateOperatorPaymentProviderPayload) =>
      operatorSettingsApi.updatePaymentProvider(operatorId, payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: operatorSettingsKeys.provider(operatorId) });
      // isActive flags on both configs are synced server-side by the switch.
      qc.invalidateQueries({ queryKey: operatorSettingsKeys.stripe(operatorId) });
      qc.invalidateQueries({ queryKey: operatorSettingsKeys.mollie(operatorId) });
      toast.success(`Payouts will be sent through ${data.activeProvider === 'MOLLIE' ? 'Mollie' : 'Stripe'}`);
    },
    onError,
  });
}

// ── Payments: Stripe ───────────────────────────────────────────────────────
export function useOperatorStripeConfig(operatorId: string | undefined) {
  return useQuery({
    queryKey: operatorSettingsKeys.stripe(operatorId ?? ''),
    queryFn: () => operatorSettingsApi.getStripeConfig(operatorId!),
    enabled: !!operatorId,
  });
}
export function useUpdateOperatorStripeConfig(operatorId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateOperatorStripeConfigPayload) =>
      operatorSettingsApi.updateStripeConfig(operatorId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: operatorSettingsKeys.stripe(operatorId) });
      saved();
    },
    onError,
  });
}

// ── Payments: Mollie ───────────────────────────────────────────────────────
export function useOperatorMollieConfig(operatorId: string | undefined) {
  return useQuery({
    queryKey: operatorSettingsKeys.mollie(operatorId ?? ''),
    queryFn: () => operatorSettingsApi.getMollieConfig(operatorId!),
    enabled: !!operatorId,
  });
}
export function useUpdateOperatorMollieConfig(operatorId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateOperatorMollieConfigPayload) =>
      operatorSettingsApi.updateMollieConfig(operatorId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: operatorSettingsKeys.mollie(operatorId) });
      saved();
    },
    onError,
  });
}
