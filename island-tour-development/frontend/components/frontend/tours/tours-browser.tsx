'use client';

import {
    getListingPending,
    getListingPendingServer,
    subscribeListingPending,
} from '@/lib/tours/listing-pending';
import {
    createContext,
    useContext,
    useSyncExternalStore,
    useTransition,
    type ReactNode,
} from 'react';

/**
 * Shared navigation state for the All Tours / category listing. A filter change
 * is a URL navigation that re-runs the server section and streams a new page;
 * routing it through `startNav` keeps that navigation inside a React transition
 * so the UI never blocks. The toolbar reads `isPending` implicitly (its chips go
 * optimistic), and the grid slot dims while the new results stream in.
 */
interface ToursNav {
    /** Run a URL navigation inside a transition (non-blocking). */
    startNav: (fn: () => void) => void;
    /** True while a filter/sort navigation is streaming the new results. */
    isPending: boolean;
}

const ToursNavContext = createContext<ToursNav | null>(null);

export function useToursNav(): ToursNav {
    const ctx = useContext(ToursNavContext);
    if (!ctx) {
        throw new Error('useToursNav must be used within <ToursBrowser>');
    }
    return ctx;
}

/**
 * Non-throwing variant: returns `null` outside a `<ToursBrowser>`. For the grid,
 * which also renders in local-state placeholder mode (category page) with no
 * provider around it - there it falls back to a plain navigation.
 */
export function useToursNavOptional(): ToursNav | null {
    return useContext(ToursNavContext);
}

/**
 * Client shell wrapping the listing toolbar + grid (both server-rendered and
 * passed in as slots). It owns the navigation transition so clicking a filter
 * feels instant: the toolbar reacts immediately while the `results` slot dims
 * and stays in place until the server streams the filtered page - instead of the
 * whole page freezing on a blocking navigation with no feedback.
 */
export function ToursBrowser({
    toolbar,
    results,
}: {
    toolbar: ReactNode;
    results: ReactNode;
}) {
    const [isPending, startTransition] = useTransition();
    const startNav = (fn: () => void) => startTransition(fn);
    // The mobile date pill lives in the streamed HEADER (outside this subtree),
    // so its refresh transition arrives through the shared store instead of the
    // context - either source dims the results while the new page streams.
    const externalPending = useSyncExternalStore(
        subscribeListingPending,
        getListingPending,
        getListingPendingServer
    );
    const busy = isPending || externalPending;

    return (
        <ToursNavContext.Provider value={{ startNav, isPending }}>
            <div className='flex flex-col gap-8'>
                {toolbar}
                <div
                    aria-busy={busy}
                    className={`transition-opacity duration-200 ${
                        busy ? 'pointer-events-none opacity-50' : 'opacity-100'
                    }`}>
                    {results}
                </div>
            </div>
        </ToursNavContext.Provider>
    );
}
