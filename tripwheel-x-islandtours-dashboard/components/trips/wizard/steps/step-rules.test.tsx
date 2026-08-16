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

const mutateAsync = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/trips/use-trips', () => ({
  useUpdateTrip: () => ({ mutateAsync, isPending: false }),
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

// The wizard footer owns the Save button; the step hands its SUBMIT to
// useStepCommit. Capture it so the payload-shape test can invoke a real save.
const commitRef = vi.hoisted(() => ({
  current: null as null | (() => Promise<boolean>),
}))
vi.mock('@/components/trips/wizard/use-step-commit', () => ({
  useStepCommit: (
    _step: string,
    opts: { submit: () => Promise<boolean> },
  ) => {
    commitRef.current = opts.submit
  },
}))
vi.mock('@/contexts/role-context', () => ({
  useRole: () => ({ role: 'ADMIN', can: () => true, canAny: () => true }),
}))

function trip(over: Partial<TripListItem> = {}): TripListItem {
  return {
    id: 't1',
    status: 'DRAFT',
    // The pass-through payload rebuilds the full trip-core body from these -
    // the payload-shape test runs a REAL submit, so they must exist.
    slug: 'powerboat-adventure',
    categoryIds: ['cat-1'],
    primaryCategoryId: 'cat-1',
    hubIds: [],
    pickupModel: 'NONE',
    pickupRequired: false,
    deliveryFormats: [],
    deliveryMethods: [],
    minPartySize: 1,
    maxPartySize: 10,
    bookingType: 'SHARED',
    operatorTermsKind: null,
    acknowledgmentItems: null,
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

/**
 * Pastel #80 · the operator-conditions gate enters the wizard here: the
 * operator picks the flavor and owns the per-tour confirm-list; on a LIVE
 * tour the backend HOLDS the change for review (the step only sends it).
 */
describe('StepRules — Operator conditions (client review comment 80)', () => {
  it('renders the section with None as the resting summary', () => {
    render(<StepRules trip={trip()} />)
    expect(screen.getByText('Operator conditions')).toBeInTheDocument()
    expect(screen.getByText('None')).toBeInTheDocument()
    // Ungated tour: no facts editor on screen.
    expect(screen.queryByText('Facts travellers confirm')).toBeNull()
  })

  it('an acknowledgment tour reads back its flavor and facts', () => {
    render(
      <StepRules
        trip={trip({
          operatorTermsKind: 'ACKNOWLEDGMENT',
          acknowledgmentItems: {
            en: ['Everyone in my group can swim.', 'Nobody is pregnant.'],
          },
        })}
      />,
    )
    expect(
      screen.getByText('Participation confirm-list'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Everyone in my group can swim.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Nobody is pregnant.')).toBeInTheDocument()
  })

  it('the PATCH sends kind+facts as one unit, and NONE clears without items', async () => {
    // The omission-vs-empty-array distinction is load-bearing: an []
    // alongside a non-ACKNOWLEDGMENT kind would trip the backend's
    // 2-6-facts bound on saves that never touched the gate.
    mutateAsync.mockResolvedValue({})

    const { unmount } = render(
      <StepRules
        trip={trip({
          operatorTermsKind: 'ACKNOWLEDGMENT',
          acknowledgmentItems: {
            en: ['Everyone in my group can swim.', '  Nobody is pregnant. '],
          },
        })}
      />,
    )
    await commitRef.current?.()
    const ackPayload = mutateAsync.mock.calls.at(-1)?.[0]?.payload
    expect(ackPayload.operatorTermsKind).toBe('ACKNOWLEDGMENT')
    // Trimmed, blanks dropped.
    expect(ackPayload.acknowledgmentItems).toEqual([
      'Everyone in my group can swim.',
      'Nobody is pregnant.',
    ])
    unmount()

    render(<StepRules trip={trip()} />)
    await commitRef.current?.()
    const nonePayload = mutateAsync.mock.calls.at(-1)?.[0]?.payload
    expect(nonePayload.operatorTermsKind).toBeNull()
    expect('acknowledgmentItems' in nonePayload).toBe(false)
  })

  it('a live tour says a change here goes to review first', () => {
    // ACKNOWLEDGMENT fixture: the consequence line is kind-independent, and
    // the DOCUMENT flavor would mount the TipTap editor (Tooltip toolbar),
    // which happy-dom cannot host without a provider tree.
    render(
      <StepRules
        trip={trip({
          status: 'LIVE',
          operatorTermsKind: 'ACKNOWLEDGMENT',
          acknowledgmentItems: { en: ['a', 'b'] },
        })}
      />,
    )
    expect(
      screen.getByText(/goes to\s+Island Tours for review/),
    ).toBeInTheDocument()
  })
})

describe('StepRules — Instant confirmation (client review comment 22)', () => {
  // The toggle let an operator untick a promise every consumer surface makes
  // ("Confirmed in seconds"), with no request-to-book flow behind the off
  // state. It is removed, not hidden - the backend also rejects the key.
  it('no longer renders the toggle - every tour is instant confirmation', () => {
    render(<StepRules trip={trip()} />)
    expect(screen.queryByText('Instant confirmation')).not.toBeInTheDocument()
    expect(
      screen.queryByText(
        'Bookings are confirmed immediately, with no manual approval from you.',
      ),
    ).not.toBeInTheDocument()
  })
})

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
