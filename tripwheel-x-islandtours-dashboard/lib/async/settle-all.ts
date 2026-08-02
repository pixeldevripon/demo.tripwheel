/**
 * Run an async `op` over every item concurrently and report what actually
 * happened — the honest replacement for `items.forEach(fireAndForget)` followed
 * by an unconditional success toast.
 *
 * Several trips flows (bulk delete, image reorder, multi-row schedule create)
 * kicked off N independent mutations and then reported success synchronously,
 * before any settled — so a total server failure still showed "N done", and a
 * partial failure left the server half-changed while the UI claimed success.
 * `settleAll` waits for all of them and returns the split so the caller can toast
 * the real counts and reconcile. (code-review M3/H2/M10.)
 *
 * Never rejects: every rejection is captured in `failed`.
 */
export interface SettleAllResult<T> {
  succeeded: T[]
  failed: { item: T; error: unknown }[]
}

export async function settleAll<T>(
  items: readonly T[],
  op: (item: T, index: number) => Promise<unknown>,
): Promise<SettleAllResult<T>> {
  const results = await Promise.allSettled(items.map((item, i) => op(item, i)))
  const succeeded: T[] = []
  const failed: { item: T; error: unknown }[] = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') succeeded.push(items[i])
    else failed.push({ item: items[i], error: r.reason })
  })
  return { succeeded, failed }
}
