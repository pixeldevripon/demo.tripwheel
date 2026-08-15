import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StepBasics } from '@/components/trips/wizard/steps/step-basics'
import type { TripListItem } from '@/types/trip'

const useActiveHubsMock = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }))
vi.mock('@/hooks/categories/use-categories', () => ({
  useActiveCategories: () => ({ data: [{ id: 'c1', name: 'Boat trips' }] }),
}))
vi.mock('@/hooks/destinations/use-destinations', () => ({
  useActiveDestinations: () => ({
    data: [{ id: 'd1', name: 'Curacao', slug: 'curacao' }],
  }),
}))
vi.mock('@/hooks/hubs/use-hubs', () => ({
  useActiveHubs: (...args: unknown[]) => useActiveHubsMock(...args),
}))
vi.mock('@/hooks/trips/use-trips', () => ({
  useCreateTrip: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTrip: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/components/trips/wizard/wizard-context', () => ({
  useWizard: () => ({ setStepError: vi.fn(), registerCommit: () => () => {} }),
}))

// A LIVE tour on Curacao, attached to one hub.
function trip(over: Partial<TripListItem> = {}): TripListItem {
  return {
    id: 't1',
    name: 'Sunset Catamaran Cruise',
    slug: 'sunset-catamaran-cruise',
    status: 'DRAFT',
    destinationId: 'd1',
    destinationName: 'Curacao',
    categoryIds: ['c1'],
    primaryCategoryId: 'c1',
    hubIds: [],
    ...over,
  } as TripListItem
}

beforeEach(() => {
  useActiveHubsMock.mockReset()
  useActiveHubsMock.mockReturnValue({
    data: [{ id: 'h1', name: 'Klein Curacao' }],
  })
})

describe('StepBasics — Tour title (client review comments 14 + 15)', () => {
  it('carries the agreed helper copy verbatim', () => {
    render(<StepBasics trip={trip()} />)
    expect(
      screen.getByText(
        'What travellers see on the card and the booking page. Leave the island name out, we add it automatically. Title Case, 35 to 60 characters.',
      ),
    ).toBeInTheDocument()
  })

  it('previews the H1 with the destination when the tour has no hub', () => {
    render(<StepBasics trip={trip()} />)
    expect(
      screen.getByText('Curacao:', { exact: false, selector: 'span' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Sunset Catamaran Cruise')).toBeInTheDocument()
  })

  it('the hub wins over the destination, as it does on the public page', () => {
    render(<StepBasics trip={trip({ hubIds: ['h1'] })} />)
    expect(
      screen.getByText('Klein Curacao:', { exact: false, selector: 'span' }),
    ).toBeInTheDocument()
  })

  it('shows the duplication the preview exists to catch', async () => {
    const user = userEvent.setup()
    render(<StepBasics trip={trip({ hubIds: ['h1'], name: '' })} />)
    const title = screen.getByPlaceholderText('Sunset Catamaran Cruise')
    await user.type(title, 'Full day jetski tour to Klein Curacao')
    // The composed line says the island twice - which is the whole point.
    expect(
      screen.getByText('Full day jetski tour to Klein Curacao', {
        selector: 'span',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Klein Curacao:', { exact: false, selector: 'span' }),
    ).toBeInTheDocument()
  })

  it('counts the title against 35-60 and flags each side', async () => {
    const user = userEvent.setup()
    render(<StepBasics trip={trip({ name: '' })} />)
    const title = screen.getByPlaceholderText('Sunset Catamaran Cruise')

    await user.type(title, 'Short one')
    expect(screen.getByText('9 / 35-60 · short')).toBeInTheDocument()

    await user.clear(title)
    await user.type(title, 'x'.repeat(42))
    expect(screen.getByText('42 / 35-60')).toBeInTheDocument()

    await user.clear(title)
    await user.type(title, 'x'.repeat(61))
    expect(screen.getByText('61 / 35-60 · long')).toBeInTheDocument()
  })

  it('the counter is quiet on an empty field', () => {
    render(<StepBasics trip={trip({ name: '' })} />)
    expect(screen.queryByText(/\/ 35-60/)).not.toBeInTheDocument()
  })
})
