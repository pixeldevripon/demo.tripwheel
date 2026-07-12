'use client';

import { createContext, useContext, useTransition, type ReactNode } from 'react';

/**
 * Shared navigation state for the search results page. A pagination change
 * is a URL navigation that re-runs the server section and streams a new page;
 * routing it through `startNav` keeps that navigation inside a React transition
 * so the UI never blocks. The results slot dims while the new results stream in.
 */
interface SearchNav {
    /** Run a URL navigation inside a transition (non-blocking). */
    startNav: (fn: () => void) => void;
    /** True while a navigation is streaming the new results. */
    isPending: boolean;
}

const SearchNavContext = createContext<SearchNav | null>(null);

export function useSearchNavOptional(): SearchNav | null {
    return useContext(SearchNavContext);
}

/**
 * Client shell wrapping the search header and grid. It owns the navigation
 * transition so clicking pagination feels instant: the grid slot dims
 * and stays in place until the server streams the filtered page - instead of the
 * whole page freezing on a blocking navigation with no feedback.
 */
export function SearchBrowser({
    header,
    results,
}: {
    header: ReactNode;
    results: ReactNode;
}) {
    const [isPending, startTransition] = useTransition();
    const startNav = (fn: () => void) => startTransition(fn);

    return (
        <SearchNavContext.Provider value={{ startNav, isPending }}>
            {header}
            <div
                aria-busy={isPending}
                className={`transition-opacity duration-200 ${
                    isPending ? 'pointer-events-none opacity-50' : 'opacity-100'
                }`}>
                {results}
            </div>
        </SearchNavContext.Provider>
    );
}
