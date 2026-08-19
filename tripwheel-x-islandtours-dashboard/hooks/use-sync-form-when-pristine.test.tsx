import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { useSyncFormWhenPristine } from '@/hooks/use-sync-form-when-pristine'

type Trip = { id: string; name: string }

function useHarness(trip: Trip) {
  const form = useForm<{ name: string }>({ defaultValues: { name: trip.name } })
  // Key on the record object itself (like the original `[trip]` effect dep): a
  // refetch that changes any field yields a new object ref and triggers a
  // (guarded) re-sync; unchanged data keeps the same ref via structural sharing.
  useSyncFormWhenPristine(
    form.reset,
    form.formState.isDirty,
    () => ({ name: trip.name }),
    trip,
  )
  return form
}

describe('useSyncFormWhenPristine (code-review C1/H1)', () => {
  it('populates from the record on first render (edit-mode load)', () => {
    const { result } = renderHook(({ trip }) => useHarness(trip), {
      initialProps: { trip: { id: '1', name: 'Alpha' } },
    })
    expect(result.current.getValues('name')).toBe('Alpha')
  })

  it('re-syncs when the record changes AND the form is pristine', () => {
    const { result, rerender } = renderHook(({ trip }) => useHarness(trip), {
      initialProps: { trip: { id: '1', name: 'Alpha' } },
    })
    rerender({ trip: { id: '2', name: 'Bravo' } })
    expect(result.current.getValues('name')).toBe('Bravo')
  })

  it('DOES NOT clobber unsaved edits when a refetch arrives while dirty (the bug)', () => {
    const { result, rerender } = renderHook(({ trip }) => useHarness(trip), {
      initialProps: { trip: { id: '1', name: 'Alpha' } },
    })
    // Operator types (marks the form dirty)
    act(() => {
      result.current.setValue('name', 'operator typed this', { shouldDirty: true })
    })
    expect(result.current.formState.isDirty).toBe(true)

    // A sibling save / window-focus refetch delivers a changed record
    rerender({ trip: { id: '1', name: 'Server Changed Alpha' } })

    // The in-progress edit MUST survive, and the dirty guard stays on
    expect(result.current.getValues('name')).toBe('operator typed this')
    expect(result.current.formState.isDirty).toBe(true)
  })

  it('after the form is reset back to pristine, a later refetch re-syncs again', () => {
    const { result, rerender } = renderHook(({ trip }) => useHarness(trip), {
      initialProps: { trip: { id: '1', name: 'Alpha' } },
    })
    act(() => {
      result.current.setValue('name', 'temp', { shouldDirty: true })
    })
    // Simulate a successful save that resets the form to server truth (pristine)
    act(() => {
      result.current.reset({ name: 'Saved' })
    })
    expect(result.current.formState.isDirty).toBe(false)
    // Next refetch (record id changes) now re-syncs because we're pristine
    rerender({ trip: { id: '3', name: 'Charlie' } })
    expect(result.current.getValues('name')).toBe('Charlie')
  })
})
