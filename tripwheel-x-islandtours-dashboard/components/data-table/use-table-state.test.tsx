/**
 * The /trips status-filter bug (2026-08-15): two same-tick setFilter calls
 * each build their URLSearchParams from the render-time snapshot, so the
 * second write starts without the first's key and silently reverts it -
 * ?status=DRAFT flashed into the URL and was immediately replaced away.
 * setFilters exists so a handler that must touch two keys writes ONCE.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTableState } from './use-table-state'

let currentSearch = ''

vi.mock('next/navigation', () => ({
  usePathname: () => '/trips',
  useSearchParams: () => new URLSearchParams(currentSearch),
}))

// Writes go through the native History API (shallow - no RSC round trip),
// which Next keeps useSearchParams in sync with.
const replaceMock = vi.spyOn(window.history, 'replaceState')

beforeEach(() => {
  replaceMock.mockReset()
  currentSearch = ''
})

describe('useTableState.setFilters', () => {
  it('writes several keys in ONE router.replace', () => {
    const { result } = renderHook(() => useTableState())
    act(() => {
      result.current.setFilters({ status: 'DRAFT', approvalStatus: undefined })
    })
    expect(replaceMock).toHaveBeenCalledTimes(1)
    expect(replaceMock).toHaveBeenCalledWith(null, '', '/trips?status=DRAFT')
  })

  it('routes a review pick: clears status, sets approvalStatus, atomically', () => {
    currentSearch = 'status=LIVE'
    const { result } = renderHook(() => useTableState())
    act(() => {
      result.current.setFilters({
        status: undefined,
        approvalStatus: 'PENDING',
      })
    })
    expect(replaceMock).toHaveBeenCalledTimes(1)
    expect(replaceMock).toHaveBeenCalledWith(
      null,
      '',
      '/trips?approvalStatus=PENDING',
    )
  })

  it('resets paging on any filter write', () => {
    currentSearch = 'page=3&status=LIVE'
    const { result } = renderHook(() => useTableState())
    act(() => {
      result.current.setFilters({ status: 'PAUSED' })
    })
    expect(replaceMock).toHaveBeenCalledWith(null, '', '/trips?status=PAUSED')
  })

  it('documents the clobber that motivated it: two setFilter calls in one tick lose the first write', () => {
    const { result } = renderHook(() => useTableState())
    act(() => {
      // Both calls read the SAME render-time snapshot ('' - no params), so
      // the second write does not contain the first's key. This is why the
      // status handler must never make two calls.
      result.current.setFilter('status', 'DRAFT')
      result.current.setFilter('approvalStatus', undefined)
    })
    expect(replaceMock).toHaveBeenLastCalledWith(null, '', '/trips')
  })
})
