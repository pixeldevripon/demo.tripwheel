'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { partnersApi } from '@/lib/api/partners';
import type {
  CreatePartnerAccountPayload,
  MintPartnerApiKeyPayload,
  UpdateOperatorDistributionPayload,
  UpdatePartnerAccountPayload,
} from '@/types/partner';

export const partnerKeys = {
  all: ['partners'] as const,
  list: (params?: Record<string, unknown>) =>
    [...partnerKeys.all, 'list', params ?? {}] as const,
  detail: (id: string) => [...partnerKeys.all, 'detail', id] as const,
  distribution: () => [...partnerKeys.all, 'distribution'] as const,
  operatorDistribution: (operatorId: string) =>
    [...partnerKeys.all, 'distribution', operatorId] as const,
};

const onError = (err: Error) => toast.error(err.message || 'Request failed');

// ── Admin: accounts ─────────────────────────────────────────────────────────

export function usePartners(params?: {
  page?: number;
  limit?: number;
  operatorId?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: partnerKeys.list(params),
    queryFn: () => partnersApi.list(params),
  });
}

export function usePartner(id: string | undefined) {
  return useQuery({
    queryKey: partnerKeys.detail(id ?? ''),
    queryFn: () => partnersApi.get(id as string),
    enabled: Boolean(id),
  });
}

export function useCreatePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePartnerAccountPayload) =>
      partnersApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: partnerKeys.all });
      toast.success('Partner created - mint a test key to get them started');
    },
    onError,
  });
}

export function useUpdatePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdatePartnerAccountPayload;
    }) => partnersApi.update(id, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: partnerKeys.all });
      toast.success(
        vars.payload.isActive === false
          ? 'Partner deactivated - every key under it stopped working'
          : 'Partner updated',
      );
    },
    onError,
  });
}

// ── Admin: keys ─────────────────────────────────────────────────────────────

/**
 * Mints a key.
 *
 * The plaintext comes back in `data` and is deliberately NOT written into any query cache:
 * the caller holds it in component state for as long as the reveal dialog is open, and it
 * is gone the moment that unmounts. That is the whole contract - one look, then never again.
 */
export function useMintPartnerKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      partnerId,
      payload,
    }: {
      partnerId: string;
      payload: MintPartnerApiKeyPayload;
    }) => partnersApi.mintKey(partnerId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: partnerKeys.all });
    },
    onError,
  });
}

export function useRevokePartnerKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      partnerId,
      keyId,
    }: {
      partnerId: string;
      keyId: string;
    }) => partnersApi.revokeKey(partnerId, keyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: partnerKeys.all });
      toast.success('Key revoked - it stops working on the next request');
    },
    onError,
  });
}

// ── Admin: operator commercial terms ────────────────────────────────────────

export function useOperatorDistribution(operatorId: string | undefined) {
  return useQuery({
    queryKey: partnerKeys.operatorDistribution(operatorId ?? ''),
    queryFn: () => partnersApi.getOperatorDistribution(operatorId as string),
    enabled: Boolean(operatorId),
  });
}

export function useSetOperatorDistribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      operatorId,
      payload,
    }: {
      operatorId: string;
      payload: UpdateOperatorDistributionPayload;
    }) => partnersApi.setOperatorDistribution(operatorId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: partnerKeys.all });
      toast.success('Distribution terms saved');
    },
    onError,
  });
}

// ── Operator self-service ───────────────────────────────────────────────────

export function useOwnDistribution() {
  return useQuery({
    queryKey: partnerKeys.distribution(),
    queryFn: partnersApi.getOwnDistribution,
  });
}

export function useToggleOwnDistribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => partnersApi.toggleOwnDistribution(enabled),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: partnerKeys.all });
      toast.success(
        data.distributionEnabled
          ? 'Distribution is on - connected channels can now sell your tours'
          : 'Distribution is off - channels can no longer see your tours',
      );
    },
    onError,
  });
}
