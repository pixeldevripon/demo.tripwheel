import { useEffect } from 'react'
import type { FieldValues, UseFormReset } from 'react-hook-form'

/**
 * Re-sync an RHF form to server-derived values when the source record (`key`)
 * changes — a refetch — but ONLY while the form is pristine.
 *
 * The forms in the tour wizard used to call `reset(toDefaults(trip))` in a
 * `[trip]` effect unconditionally. Because the app refetches on window-focus
 * (30s stale) and sibling child-collection saves invalidate the trip detail,
 * that effect fired while the operator had unsaved edits in a sibling core-field
 * form and `reset()` wiped them — and, worse, flipped `isDirty` back to false so
 * the "unsaved changes" guard went silent and Continue advanced "clean".
 * (code-review C1/H1.)
 *
 * Guarding on `!isDirty` keeps every existing behaviour:
 * - first load / edit-mode population: form is pristine → reset runs (unchanged);
 * - after the operator's own save resets the form: pristine → next refetch
 *   re-syncs to the saved server value (unchanged);
 * - only new case: a refetch that arrives while the form is dirty is ignored,
 *   so in-progress input survives.
 *
 * Keyed on `key` alone (like the original `[trip]`); the dirty flag is read at
 * run time, never a dependency — depending on it would re-run reset on the
 * post-save `true→false` transition with a possibly-stale record.
 */
export function useSyncFormWhenPristine<T extends FieldValues>(
  reset: UseFormReset<T>,
  isDirty: boolean,
  makeValues: () => T,
  key: unknown,
): void {
  useEffect(() => {
    if (!isDirty) reset(makeValues())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
