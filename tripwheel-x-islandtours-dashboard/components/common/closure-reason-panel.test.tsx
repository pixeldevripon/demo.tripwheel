import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  CLOSURE_REASON_LABEL,
  CLOSURE_REASONS,
  ClosureReasonPanel,
  closureReassurance,
} from '@/components/common/closure-reason-panel'

function renderPanel(over: Partial<Parameters<typeof ClosureReasonPanel>[0]> = {}) {
  const onCommit = vi.fn()
  const onCancel = vi.fn()
  const onNoteChange = vi.fn()
  render(
    <ClosureReasonPanel
      question="Why are you closing the 07:00 departure?"
      reassurance="This only stops new sales. Existing bookings are always kept."
      note=""
      onNoteChange={onNoteChange}
      onCommit={onCommit}
      onCancel={onCancel}
      {...over}
    />,
  )
  return { onCommit, onCancel, onNoteChange }
}

describe('ClosureReasonPanel (MCK-16 change 1)', () => {
  it('offers exactly the two reasons, in the decided order', () => {
    renderPanel()
    const buttons = [
      screen.getByRole('button', { name: 'Sold out' }),
      screen.getByRole('button', { name: 'Not running' }),
    ]
    expect(buttons).toHaveLength(2)
    expect(CLOSURE_REASONS).toEqual(['SOLD_OUT', 'NOT_RUNNING'])
    expect(CLOSURE_REASON_LABEL.SOLD_OUT).toBe('Sold out')
    expect(CLOSURE_REASON_LABEL.NOT_RUNNING).toBe('Not running')
  })

  it('the reason IS the commit - each button commits its enum value', async () => {
    const user = userEvent.setup()
    const { onCommit } = renderPanel()
    await user.click(screen.getByRole('button', { name: 'Sold out' }))
    expect(onCommit).toHaveBeenCalledWith('SOLD_OUT')
    await user.click(screen.getByRole('button', { name: 'Not running' }))
    expect(onCommit).toHaveBeenCalledWith('NOT_RUNNING')
  })

  it('there is no commit path without a reason - the only other button is the way out', async () => {
    const user = userEvent.setup()
    const { onCommit, onCancel } = renderPanel()
    // Every button on the panel is a reason or the cancel; nothing else acts.
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual([
      'Sold out',
      'Not running',
      'Cancel, leave it open',
    ])
    await user.click(screen.getByRole('button', { name: 'Cancel, leave it open' }))
    expect(onCancel).toHaveBeenCalled()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('shows the question, the reassurance and the reason explainer', () => {
    renderPanel({ reassurance: '9 booked guests keep their bookings. Closing only stops new sales.' })
    expect(screen.getByText('Why are you closing the 07:00 departure?')).toBeInTheDocument()
    expect(screen.getByText(/9 booked guests keep their bookings/)).toBeInTheDocument()
    expect(screen.getByText(/Sold out means the trip is full/)).toBeInTheDocument()
  })

  it('threads the note and surfaces errors', async () => {
    const user = userEvent.setup()
    const { onNoteChange } = renderPanel({ error: 'The change failed.' })
    expect(screen.getByText('The change failed.')).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText(/Note \(optional\)/), 'w')
    expect(onNoteChange).toHaveBeenCalledWith('w')
  })

  it('disables every action while busy', () => {
    renderPanel({ busy: true })
    for (const name of ['Sold out', 'Not running', 'Cancel, leave it open']) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
  })
})

describe('closureReassurance (pastel comment 8)', () => {
  it('names the count when the departure has bookings', () => {
    expect(closureReassurance(46)).toBe(
      '46 booked guests keep their bookings. Closing only stops new sales.',
    )
  })

  it('reads as English for a single guest', () => {
    expect(closureReassurance(1)).toBe(
      '1 booked guest keeps their booking. Closing only stops new sales.',
    )
  })

  it('keeps the generic guarantee when nothing is booked', () => {
    const generic = 'This only stops new sales. Existing bookings are always kept.'
    expect(closureReassurance(0)).toBe(generic)
    // A negative count is not reachable from the API, but the line must never
    // render "-1 booked guests" if one ever slips through.
    expect(closureReassurance(-1)).toBe(generic)
  })

  it('the line differs at 0 and at 46 - the whole point of the comment', () => {
    expect(closureReassurance(46)).not.toBe(closureReassurance(0))
  })
})
