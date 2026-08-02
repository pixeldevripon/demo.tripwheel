import { describe, it, expect, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { useTripMutation } from '@/hooks/trips/use-trip-mutation'

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
}

describe('useTripMutation (code-review M1)', () => {
  it('invalidates exactly the keys the hook declares, derived from variables', async () => {
    const client = new QueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    const apiFn = vi.fn(async (_v: { id: string }) => ({ ok: true }))

    const { result } = renderHook(
      () =>
        useTripMutation(apiFn, ({ id }) => [
          ['trips'],
          ['trips', 'detail', id],
        ]),
      { wrapper: wrapper(client) },
    )

    await act(async () => {
      await result.current.mutateAsync({ id: 'abc' })
    })

    // TanStack calls mutationFn(vars, context); assert the first arg only.
    expect(apiFn.mock.calls[0][0]).toEqual({ id: 'abc' })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['trips'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['trips', 'detail', 'abc'] })
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('does not invalidate on error', async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })
    const spy = vi.spyOn(client, 'invalidateQueries')
    const apiFn = vi.fn(async () => {
      throw new Error('boom')
    })

    const { result } = renderHook(
      () => useTripMutation(apiFn, () => [['trips']]),
      { wrapper: wrapper(client) },
    )

    await act(async () => {
      await result.current.mutateAsync(undefined).catch(() => {})
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(spy).not.toHaveBeenCalled()
  })

  it('no invalidate callback → no invalidation (e.g. confirm-availability)', async () => {
    const client = new QueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    const apiFn = vi.fn(async () => undefined)

    const { result } = renderHook(() => useTripMutation(apiFn), {
      wrapper: wrapper(client),
    })
    await act(async () => {
      await result.current.mutateAsync(undefined)
    })
    expect(apiFn).toHaveBeenCalled()
    expect(spy).not.toHaveBeenCalled()
  })
})
