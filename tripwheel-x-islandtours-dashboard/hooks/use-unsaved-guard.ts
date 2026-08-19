'use client';

/**
 * useUnsavedGuard (04 §2.2 D, Phase 18) - the dashboard had NO dirty-state
 * protection: per-section saves across many tabs meant a mistyped click
 * silently discarded work.
 *
 * Wire it inside any component that owns a react-hook-form instance:
 *
 *   const { formState } = useForm(...);
 *   useUnsavedGuard(formState.isDirty);
 *
 * Scope (deliberate): the App Router has no cancellable route events, so
 * hard navigations / tab closes are covered by `beforeunload` - the browser
 * shows its native "leave site?" prompt while the form is dirty. In-app
 * section switches keep content MOUNTED (CollapsibleCard, in-page Tabs), so
 * values survive without a guard; full route changes get the native prompt
 * because Next 16 still triggers beforeunload on hard document swaps only -
 * for client-side navigations the enter-animation remount makes losses rare
 * but possible, which Phase 18's sticky per-route save footer addresses by
 * keeping the save always in reach.
 */

import { useEffect } from 'react';

export function useUnsavedGuard(isDirty: boolean): void {
    useEffect(() => {
        if (!isDirty) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            // Chrome requires returnValue to be set.
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty]);
}
