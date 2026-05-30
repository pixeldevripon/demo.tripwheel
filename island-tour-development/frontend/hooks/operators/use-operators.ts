'use client';

import { useQuery } from '@tanstack/react-query';
import { operatorsApi } from '@/lib/api/operators';

export const operatorKeys = {
  search: (q: string) => ['operators', 'search', q] as const,
};

export function useOperatorSearch(q: string, enabled = true) {
  return useQuery({
    queryKey: operatorKeys.search(q),
    queryFn: () => operatorsApi.search(q, 30),
    enabled: enabled,
    staleTime: 30_000,
  });
}
