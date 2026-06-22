'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { operatorsApi } from '@/lib/api/operators';
import type {
  CreateOperatorPayload,
  OperatorsQueryParams,
  UpdateOperatorPayload,
} from '@/types/operator';

export const operatorKeys = {
  all: ['operators'] as const,
  lists: () => [...operatorKeys.all, 'list'] as const,
  list: (params: OperatorsQueryParams) => [...operatorKeys.lists(), params] as const,
  search: (q: string) => [...operatorKeys.all, 'search', q] as const,
  details: () => [...operatorKeys.all, 'detail'] as const,
  detail: (id: string) => [...operatorKeys.details(), id] as const,
};

export function useOperators(params: OperatorsQueryParams = {}) {
  return useQuery({
    queryKey: operatorKeys.list(params),
    queryFn: () => operatorsApi.getAll(params),
  });
}

export function useOperatorSearch(q: string, enabled = true) {
  return useQuery({
    queryKey: operatorKeys.search(q),
    queryFn: () => operatorsApi.search(q, 30),
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

export function useDeleteOperator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => operatorsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: operatorKeys.all });
    },
  });
}
