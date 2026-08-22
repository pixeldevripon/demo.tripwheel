import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AvailabilityAgenda } from '@/components/availability/availability-agenda'
import { shiftDateKey } from '@/lib/trips/availability'
import type { AgendaResponse } from '@/types/trip'

const useAgendaMock = vi.fn()

vi.mock('@/hooks/trips/use-trips', () => ({
  useAgenda: (...args: unknown[]) => useAgendaMock(...args),
  useCloseAgendaDay: () => ({ mutate: vi.fn(), isPending: false }),
  useConfirmAvailability: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateException: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveException: () => ({ mutate: vi.fn(), isPending: false }),
  useReopenRange: () => ({ mutateAsync: vi.fn() }),
}))

// The island's today, as the default (from=undefined) window reports it.
const TODAY = '2026-10-16'

function agendaData(from: string, days = 7): AgendaResponse {
  return {
    days: Array.from({ length: days }, (_, i) => ({
      date: shiftDateKey(from, i),
      departures: [],
    })),
    tours: [{ id: 't1', name: 'Sunset Sail', timeZone: 'America/Curacao' }],
    lastConfirmedAt: null,
  }
}

/** The `from` argument of the most recent useAgenda call - what the window
 *  actually asked the API for. */
const lastFrom = () =>
  useAgendaMock.mock.calls[useAgendaMock.mock.calls.length - 1][0]

beforeEach(() => {
  useAgendaMock.mockReset()
  // The window start the component asks for is echoed back as the data, the
  // way the real endpoint behaves (from + days, no offset).
  useAgendaMock.mockImplementation((from?: string, days?: number) => ({
    data: agendaData(from ?? TODAY, days ?? 7),
    isLoading: false,
    isFetching: false,
  }))
  // happy-dom has no layout, so scrollIntoView is not implemented.
  Element.prototype.scrollIntoView = vi.fn()
})

describe('AvailabilityAgenda window (client review comment 11)', () => {
  it('opens on the island today and asks for seven days', () => {
    render(<AvailabilityAgenda />)
    expect(lastFrom()).toBeUndefined() // the default window = island today
    expect(useAgendaMock.mock.calls[0][1]).toBe(7)
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument()
  })

  it('the forward arrow starts the list a week on, still seven days', async () => {
    const user = userEvent.setup()
    render(<AvailabilityAgenda />)
    await user.click(screen.getByRole('button', { name: 'Next week' }))
    expect(lastFrom()).toBe('2026-10-23')
    expect(useAgendaMock.mock.calls[useAgendaMock.mock.calls.length - 1][1]).toBe(7)
  })

  it('Back is inert on today, then walks the window home again', async () => {
    const user = userEvent.setup()
    render(<AvailabilityAgenda />)
    const back = () => screen.getByRole('button', { name: 'Previous week' })
    expect(back()).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Next week' }))
    expect(back()).toBeEnabled()
    await user.click(back())
    // Home is the DEFAULT window (from omitted), not a hardcoded today - the
    // island clock has to keep owning what "today" means.
    expect(lastFrom()).toBeUndefined()
  })

  it('Today returns to the default window from anywhere', async () => {
    const user = userEvent.setup()
    render(<AvailabilityAgenda />)
    await user.click(screen.getByRole('button', { name: 'Next week' }))
    await user.click(screen.getByRole('button', { name: 'Next week' }))
    expect(lastFrom()).toBe('2026-10-30')
    await user.click(screen.getByRole('button', { name: 'Today' }))
    expect(lastFrom()).toBeUndefined()
  })

  it('picking a day INSIDE the loaded window still moves the window to it', async () => {
    const user = userEvent.setup()
    render(<AvailabilityAgenda />)
    // The reported bug: Sun 18 Oct is day three of the open window, so the
    // old code kept the window on the 16th and only scrolled - the picked day
    // sat third and the list read as starting two days early.
    await user.click(screen.getByRole('button', { name: 'Pick a date' }))
    await user.click(
      await screen.findByRole('button', { name: /October 18th, 2026/ })
    )
    expect(lastFrom()).toBe('2026-10-18')
  })

  it('the picker refuses the past - the agenda only looks forward', async () => {
    const user = userEvent.setup()
    render(<AvailabilityAgenda />)
    await user.click(screen.getByRole('button', { name: 'Pick a date' }))
    expect(
      await screen.findByRole('button', { name: /October 15th, 2026/ })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: /October 16th, 2026, selected/ })
    ).toBeEnabled()
  })

  it('after a jump the picked day is the FIRST group in the list', async () => {
    const user = userEvent.setup()
    render(<AvailabilityAgenda />)
    await user.click(screen.getByRole('button', { name: 'Next week' }))
    const headings = screen.getAllByRole('heading', { level: 2 })
    expect(headings[0]).toHaveTextContent('23 Oct')
  })
})
