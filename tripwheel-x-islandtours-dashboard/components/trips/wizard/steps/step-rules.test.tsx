import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StepRules } from '@/components/trips/wizard/steps/step-rules'
import type { PaymentModel, TripListItem } from '@/types/trip'

// Radix Select drives its popup off pointer capture and scrolls the active item
// into view; happy-dom implements neither, so opening one throws without these.
// Kept local rather than in vitest.setup.ts - only this file opens a Select.
beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.setPointerCapture ??= () => {}
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
})

vi.mock('@/hooks/trips/use-trips', () => ({
  useUpdateTrip: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
// Sections render open, so the Payment fields are in the tree without a click.
vi.mock('@/components/trips/wizard/wizard-context', () => ({
  useWizard: () => ({
    step: 'rules',
    setStepError: vi.fn(),
    registerCommit: () => () => {},
    isSectionOpen: () => true,
    setSectionOpen: vi.fn(),
    revealSection: vi.fn(),
  }),
}))
vi.mock('@/contexts/role-context', () => ({
  useRole: () => ({ role: 'ADMIN', can: () => true, canAny: () => true }),
}))

function trip(over: Partial<TripListItem> = {}): TripListItem {
  return {
    id: 't1',
    status: 'DRAFT',
    minPartySize: 1,
    maxPartySize: 10,
    bookingType: 'SHARED',
    instantConfirmation: true,
    bookingCutoffMinutes: 120,
    checkInMinutesBefore: 15,
    cancellationHours: 48,
    paymentModel: 'ON_ARRIVAL',
    onArrivalPayment: 'CARD_OR_CASH',
    minAgeYears: null,
    fitnessLevel: null,
    weatherDependent: false,
    wheelchairAccessible: false,
    familyFriendly: false,
    suitableForBeginners: false,
    ...over,
  } as TripListItem
}

// Several steps carry a Select, so scope by the section's own stable handle
// rather than by label - "Payment model" is the first combobox inside it.
async function openPaymentModel() {
  const user = userEvent.setup()
  const { container } = render(<StepRules trip={trip()} />)
  const section = container.querySelector<HTMLElement>(
    '[data-wizard-section="payment"]',
  )!
  await user.click(within(section).getAllByRole('combobox')[0])
}

describe('StepRules — Payment model (client review comment 21)', () => {
  it('describes ON_ARRIVAL as a deposit model, not payment in full', () => {
    render(<StepRules trip={trip()} />)
    expect(
      screen.getByText(
        'The traveller pays a deposit to Island Tours now and settles the balance with you on arrival.',
      ),
    ).toBeInTheDocument()
    // The line the client flagged: it contradicted both the commercial model
    // and the "what you accept on site" field directly below it.
    expect(
      screen.queryByText('The traveller pays you in full when they arrive.'),
    ).not.toBeInTheDocument()
  })

  it('still offers to settle that balance by card or cash on site', () => {
    render(<StepRules trip={trip()} />)
    expect(
      screen.getByText('Travellers can settle the balance either way.'),
    ).toBeInTheDocument()
  })

  it('lists all four payment models, not three', async () => {
    await openPaymentModel()
    expect(screen.getAllByRole('option').map(o => o.textContent?.trim())).toEqual([
      'Operator link (deposit)',
      'Pay on arrival',
      'Paid in full',
      'No platform payment (not yet available)',
    ])
  })

  // The backend refuses to reserve or quote an OPERATOR_FULL tour (422,
  // dropped for v1) - selecting it would publish a tour nobody can book.
  it('shows the fourth model but will not let it be selected', async () => {
    await openPaymentModel()
    expect(
      screen.getByRole('option', {
        name: 'No platform payment (not yet available)',
      }),
    ).toHaveAttribute('data-disabled')
  })

  // Before the option existed at all, a tour already on this model rendered a
  // blank trigger and a blank section summary, with nothing saying why.
  it('a tour already on the fourth model reads back, and says it cannot sell', () => {
    render(
      <StepRules
        trip={trip({ paymentModel: 'OPERATOR_FULL' as PaymentModel })}
      />,
    )
    expect(
      screen.getByText('No platform payment (not yet available)'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Island Tours cannot take bookings for a tour on this model/),
    ).toBeInTheDocument()
  })
})
