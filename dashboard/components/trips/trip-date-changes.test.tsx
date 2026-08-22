import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TripDateChanges } from '@/components/trips/trip-date-changes'
import type { TourException } from '@/types/trip'

const useExceptionsMock = vi.fn()
vi.mock('@/hooks/trips/use-trips', () => ({
  useExceptions: (...args: unknown[]) => useExceptionsMock(...args),
  useRemoveException: () => ({ mutate: vi.fn(), isPending: false }),
}))

function exception(over: Partial<TourException> = {}): TourException {
  return {
    id: 'x1',
    tourId: 't1',
    date: '2099-06-10',
    startTime: null,
    type: 'CLOSE_DATE',
    capacity: null,
    note: null,
    closureReason: null,
    createdAt: '2026-08-10T14:00:00.000Z',
    createdByName: 'Maria',
    createdBySide: 'OPERATOR',
    retiredAt: null,
    retiredByName: null,
    retiredBySide: null,
    ...over,
  }
}

function renderRegister(rows: TourException[]) {
  useExceptionsMock.mockReturnValue({ data: rows, isLoading: false })
  render(<TripDateChanges tripId="t1" timeZone="America/Curacao" />)
}

describe('TripDateChanges register (MCK-16 changes 5 + 10)', () => {
  it('the closure reason rides the action label', () => {
    renderRegister([
      exception({ closureReason: 'NOT_RUNNING' }),
      exception({
        id: 'x2',
        type: 'CLOSE_SLOT',
        startTime: '07:00',
        closureReason: 'SOLD_OUT',
      }),
    ])
    expect(screen.getByText(/Whole day closed · Not running/)).toBeInTheDocument()
    expect(screen.getByText(/07:00 departure closed · Sold out/)).toBeInTheDocument()
  })

  it('a legacy reasonless closure stays a plain "closed"', () => {
    renderRegister([exception()])
    expect(screen.getByText(/Whole day closed/)).toBeInTheDocument()
    expect(screen.queryByText(/Whole day closed ·/)).toBeNull()
  })

  it('a platform closure names Island Tours on the audit line', () => {
    renderRegister([
      exception({ createdByName: 'Andres', createdBySide: 'PLATFORM' }),
    ])
    expect(screen.getByText(/By Andres \(Island Tours\)/)).toBeInTheDocument()
  })

  it('a retired row shows the reopen audit line and loses its Reopen button', () => {
    renderRegister([
      exception({
        id: 'retired',
        retiredAt: '2026-08-11T09:00:00.000Z',
        retiredByName: 'Yuri',
        retiredBySide: 'OPERATOR',
      }),
      exception({ id: 'active', date: '2099-06-11' }),
    ])
    expect(screen.getByText(/Reopened by Yuri/)).toBeInTheDocument()
    // Only the still-in-force future closure offers an undo.
    expect(screen.getAllByRole('button', { name: /Reopen/ })).toHaveLength(1)
  })

  it('an ADD_SLOT retirement reads "Removed", not "Reopened"', () => {
    renderRegister([
      exception({
        type: 'ADD_SLOT',
        startTime: '14:30',
        retiredAt: '2026-08-11T09:00:00.000Z',
        retiredByName: null,
        retiredBySide: 'OPERATOR',
      }),
    ])
    expect(screen.getByText(/Removed by your team/)).toBeInTheDocument()
  })
})
