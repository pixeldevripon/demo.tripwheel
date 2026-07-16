import type {
  CreateOperatorPayload,
  OperatorDetail,
  OperatorListItem,
  OperatorsQueryParams,
  PaginatedOperators,
  UpdateOperatorPayload,
} from '@/types/operator';
import { apiFetch, buildQuery } from './fetch';

/** Backwards-compatible alias - the trips operator filter imports this name. */
export type OperatorSearchItem = OperatorListItem;
export type { PaginatedOperators };

export const operatorsApi = {
  getAll(params: OperatorsQueryParams = {}): Promise<PaginatedOperators> {
    const query = buildQuery(params as Record<string, string | number | boolean | undefined | null>);
    return apiFetch<PaginatedOperators>(`/operators${query}`);
  },

  search(search: string, limit = 20): Promise<PaginatedOperators> {
    return operatorsApi.getAll({ search, limit });
  },

  getById(id: string): Promise<OperatorDetail> {
    return apiFetch<OperatorDetail>(`/operators/${id}`);
  },

  create(payload: CreateOperatorPayload): Promise<OperatorDetail> {
    return apiFetch<OperatorDetail>('/operators', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update(id: string, payload: UpdateOperatorPayload): Promise<OperatorDetail> {
    return apiFetch<OperatorDetail>(`/operators/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  delete(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/operators/${id}`, { method: 'DELETE' });
  },
};
