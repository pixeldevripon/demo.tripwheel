import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RejectChangesDialog } from '@/components/trips/lifecycle/reject-changes-dialog'

// Radix Dialog uses pointer APIs happy-dom doesn't fully implement.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.scrollIntoView = () => {}
})

describe('RejectChangesDialog (code-review M4)', () => {
  it('renders the trip name in the title', () => {
    render(
      <RejectChangesDialog tripName="Sunset Sail" open onOpenChange={() => {}} isPending={false} onConfirm={() => {}} />,
    )
    expect(screen.getByText(/Request changes on/)).toHaveTextContent('Sunset Sail')
  })

  it('keeps "Request changes" disabled until the note is >= 5 non-space chars', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <RejectChangesDialog tripName="X" open onOpenChange={() => {}} isPending={false} onConfirm={onConfirm} />,
    )
    const confirm = screen.getByRole('button', { name: 'Request changes' })
    expect(confirm).toBeDisabled()

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, '   ') // whitespace only → still disabled
    expect(confirm).toBeDisabled()

    await user.type(textarea, 'fix the hero image')
    expect(confirm).toBeEnabled()
  })

  it('calls onConfirm with the trimmed note', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <RejectChangesDialog tripName="X" open onOpenChange={() => {}} isPending={false} onConfirm={onConfirm} />,
    )
    await user.type(screen.getByRole('textbox'), '  please fix  ')
    await user.click(screen.getByRole('button', { name: 'Request changes' }))
    expect(onConfirm).toHaveBeenCalledWith('please fix')
  })

  it('disables both buttons while pending', () => {
    render(
      <RejectChangesDialog tripName="X" open onOpenChange={() => {}} isPending onConfirm={() => {}} />,
    )
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Request changes' })).toBeDisabled()
  })

  it('resets the note when reopened (calls onOpenChange(false) on Back)', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <RejectChangesDialog tripName="X" open onOpenChange={onOpenChange} isPending={false} onConfirm={() => {}} />,
    )
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })
})
