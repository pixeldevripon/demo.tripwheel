'use client';

import {
    createContext,
    useContext,
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
 *
 * Backs the SEARCH results page too (Pastel #44), which mounts the same toolbar
 * and so needs the same transition context - hence the optional `header` slot
 * for the "N results for X" line that sits above the sticky band there.
 */
export function ToursBrowser({
    header,
    toolbar,
    results,
}: {
    /** Optional block ABOVE the sticky toolbar; supplies its own container. */
    header?: ReactNode;
    toolbar: ReactNode;
    results: ReactNode;
}) {
    const [isPending, startTransition] = useTransition();
    const startNav = (fn: () => void) => startTransition(fn);
    const busy = isPending;

    return (
        <ToursNavContext.Provider value={{ startNav, isPending }}>
            {header}
            {/* The toolbar renders its own full-width sticky band + container
                rows (design v2 .frow/.gridhead); the results grid gets the
                container here. */}
            {toolbar}
            <div
                aria-busy={busy}
                className={`it-container transition-opacity duration-200 ${
                    busy ? 'pointer-events-none opacity-50' : 'opacity-100'
                }`}>
                {results}
            </div>
        </ToursNavContext.Provider>
    );
}
