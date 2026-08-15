import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DepartureChip } from '@/components/calendar/departure-chip'
import type { OverviewDeparture } from '@/types/trip'

const createMutate = vi.fn()
const removeMutate = vi.fn()

vi.mock('@/hooks/trips/use-trips', () => ({
  useCreateException: () => ({ mutate: createMutate, isPending: false }),
  useRemoveException: () => ({ mutate: removeMutate, isPending: false }),
}))

// The card hides what the seat cannot do; this one may stop sales.
vi.mock('@/contexts/role-context', () => ({
  useRole: () => ({
    role: 'OPERATOR',
    surface: 'portal',
    permissions: [],
    can: () => true,
    canAny: () => true,
  }),
}))

const DEPARTURE: OverviewDeparture = {
  id: 'd1',
  tourId: 't1',
  operatorId: 'o1',
  tourName: 'Sunset Sail',
  date: '2026-10-16',
  startTime: '17:30',
  bookedCount: 4,
  capacity: 12,
  status: 'OPEN',
  pricingModel: 'PER_PERSON',
  cutoffPassed: false,
  closure: null,
}

/** Open the management card the way an operator does - by the chip. */
async function openCard(user: ReturnType<typeof userEvent.setup>) {
  render(<DepartureChip dep={DEPARTURE} />)
  await user.click(screen.getByRole('button', { name: /Sunset Sail/ }))
  await screen.findByText('Fri 16 Oct 2026 · 17:30')
}

beforeEach(() => {
  createMutate.mockReset()
  removeMutate.mockReset()
  // Radix's positioning layer measures its content; happy-dom ships neither.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.releasePointerCapture ??= () => {}
})

describe('DepartureChip card (pastel 9)', () => {
  it('every way out of the card is a dismissal, and the sales action says so', async () => {
    const user = userEvent.setup()
    await openCard(user)

    // The X, in the corner, the way the "Close a range" modal has one.
    expect(
      screen.getByRole('button', { name: 'Close this panel' }),
    ).toBeInTheDocument()
    // The client's actual complaint: the only button read "Close" and it
    // stopped sales. Nothing on the card may carry that word again.
    expect(
      screen.getByRole('button', { name: 'Stop sales' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })

  it('the X dismisses the card and writes nothing', async () => {
    const user = userEvent.setup()
    await openCard(user)

    await user.click(screen.getByRole('button', { name: 'Close this panel' }))

    expect(screen.queryByRole('button', { name: 'Stop sales' })).toBeNull()
    // Dismissing is not an availability act - no close, no reopen.
    expect(createMutate).not.toHaveBeenCalled()
    expect(removeMutate).not.toHaveBeenCalled()
  })

  it('Esc dismisses it too, and never as a side effect of stopping sales', async () => {
    const user = userEvent.setup()
    await openCard(user)

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('button', { name: 'Stop sales' })).toBeNull()
    expect(createMutate).not.toHaveBeenCalled()
  })

  it('Stop sales opens the reason question rather than closing on the spot', async () => {
    const user = userEvent.setup()
    await openCard(user)

    await user.click(screen.getByRole('button', { name: 'Stop sales' }))

    // The reason IS the commit (MCK-16 change 1) - still nothing written.
    expect(
      screen.getByText('Why are you closing the 17:30 departure?'),
    ).toBeInTheDocument()
    expect(createMutate).not.toHaveBeenCalled()
    // And the card is still dismissable while the question is up.
    expect(
      screen.getByRole('button', { name: 'Close this panel' }),
    ).toBeInTheDocument()
  })
})
