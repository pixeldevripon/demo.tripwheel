import {
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseMutationResult,
} from '@tanstack/react-query';

/**
 * Factory for the trip mutation hooks.
 *
 * Removes the copy-pasted `useQueryClient` + `useMutation` + `invalidateQueries`
 * boilerplate that was duplicated across ~40 hooks (code-review M1). Behaviour is
 * preserved EXACTLY: each hook supplies its own invalidation key list, and those
 * lists are kept verbatim from the originals. The known inconsistencies between
 * hooks (M2 — e.g. some update* hooks don't invalidate detail) are intentionally
 * NOT "fixed" here; that would change refetch behaviour and belongs in a separate,
 * consent-gated change.
 *
 * `invalidate` is optional so a hook with no onSuccess (e.g. useConfirmAvailability)
 * maps cleanly to `undefined`.
 */
export function useTripMutation<TVars, TData>(
  mutationFn: (vars: TVars) => Promise<TData>,
  invalidate?: (vars: TVars) => readonly QueryKey[],
): UseMutationResult<TData, Error, TVars> {
  const queryClient = useQueryClient();
  return useMutation<TData, Error, TVars>({
    mutationFn,
    onSuccess: invalidate
      ? (_data, vars) => {
          for (const queryKey of invalidate(vars)) {
            queryClient.invalidateQueries({ queryKey });
          }
        }
      : undefined,
  });
}
