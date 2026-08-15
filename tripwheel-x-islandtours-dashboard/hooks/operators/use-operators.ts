'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { operatorsApi } from '@/lib/api/operators';
import { emailKeys } from '@/hooks/emails/use-operator-emails';
import type {
  CreateOperatorPayload,
  OperatorsQueryParams,
  UpdateOperatorPayload,
  VerificationDecision,
} from '@/types/operator';

export const operatorKeys = {
  all: ['operators'] as const,
  lists: () => [...operatorKeys.all, 'list'] as const,
  list: (params: OperatorsQueryParams) => [...operatorKeys.lists(), params] as const,
  search: (q: string, destinationId?: string) =>
    [...operatorKeys.all, 'search', q, destinationId ?? 'all'] as const,
  details: () => [...operatorKeys.all, 'detail'] as const,
  detail: (id: string) => [...operatorKeys.details(), id] as const,
};

export function useOperators(params: OperatorsQueryParams = {}) {
  return useQuery({
    queryKey: operatorKeys.list(params),
    queryFn: () => operatorsApi.getAll(params),
    // Keep prior results visible during a new page/search fetch so the toolbar
    // and focused search input never unmount into a skeleton.
    placeholderData: keepPreviousData,
  });
}

export function useOperatorSearch(
  q: string,
  enabled = true,
  destinationId?: string,
) {
  return useQuery({
    queryKey: operatorKeys.search(q, destinationId),
    queryFn: () => operatorsApi.search(q, 30, destinationId),
    enabled,
    staleTime: 30_000,
  });
}

export function useOperator(id: string) {
  return useQuery({
    queryKey: operatorKeys.detail(id),
    queryFn: () => operatorsApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateOperator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOperatorPayload) => operatorsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: operatorKeys.all });
    },
  });
}

export function useUpdateOperator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateOperatorPayload }) =>
      operatorsApi.update(id, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: operatorKeys.all });
      queryClient.invalidateQueries({ queryKey: operatorKeys.detail(data.id) });
    },
  });
}

/**
 * Approve/reject a PENDING operator via `POST /operators/:id/verification` -
 * the only sanctioned `verificationStatus` writer (WP-C). Invalidates every
 * operator query (queue, list, detail) so the row leaves the PENDING queue at
 * once. Success/error toasts live with the confirm dialogs, which own the
 * decision-specific copy.
 */
export function useDecideVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      decision,
    }: {
      id: string;
      decision: VerificationDecision;
    }) => operatorsApi.decideVerification(id, decision),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: operatorKeys.all });
      // Approval fires OB-2A backend-side; without this the mounted (or
      // 30s-stale-cached) email timeline never shows the row the admin was
      // just told about (review finding 1 on PR #56).
      queryClient.invalidateQueries({ queryKey: emailKeys.operator(id) });
    },
  });
}

export function useDeleteOperator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => operatorsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: operatorKeys.all });
    },
  });
}
