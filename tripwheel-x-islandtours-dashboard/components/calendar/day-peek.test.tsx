import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DayPeek } from '@/components/calendar/day-peek'
import type { OverviewDeparture } from '@/types/trip'

vi.mock('@/hooks/trips/use-trips', () => ({
  useCreateException: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveException: () => ({ mutate: vi.fn(), isPending: false }),
}))

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

const peekHeading = () => screen.queryByText('Friday, 16 October')

async function openPeek(user: ReturnType<typeof userEvent.setup>) {
  render(
    <DayPeek
      date='2026-10-16'
      departures={[DEPARTURE]}
      operatorNameById={new Map()}
      isAdmin={false}>
      <button type='button'>1 departure on 2026-10-16</button>
    </DayPeek>,
  )
  await user.click(
    screen.getByRole('button', { name: '1 departure on 2026-10-16' }),
  )
  await screen.findByText('Friday, 16 October')
}

beforeEach(() => {
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

describe('DayPeek (pastel 9)', () => {
  it('carries its own X, which dismisses the day card', async () => {
    const user = userEvent.setup()
    await openPeek(user)

    await user.click(screen.getByRole('button', { name: 'Close this panel' }))

    expect(peekHeading()).toBeNull()
  })

  it("a chip card's X closes only that card - the peek under it stays open", async () => {
    const user = userEvent.setup()
    await openPeek(user)

    await user.click(screen.getByRole('button', { name: /Sunset Sail/ }))
    // Two panels are now stacked, so two Xs: the peek's and the card's.
    expect(
      await screen.findAllByRole('button', { name: 'Close this panel' }),
    ).toHaveLength(2)

    // The card's own X - the one in the panel that holds Stop sales.
    const card = screen
      .getByRole('button', { name: 'Stop sales' })
      .closest("[data-slot='popover-content']") as HTMLElement
    await user.click(
      within(card).getByRole('button', { name: 'Close this panel' }),
    )

    expect(screen.queryByRole('button', { name: 'Stop sales' })).toBeNull()
    expect(peekHeading()).toBeInTheDocument()
  })
})
