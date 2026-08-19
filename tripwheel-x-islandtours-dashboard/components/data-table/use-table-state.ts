'use client';

import * as React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * URL-synced list state: page, limit, debounced search, named filters (R10,
 * 05 §7). One instance per list screen - this retires the identical
 * useState + 500ms-debounce machines that were hand-written in every
 * *-list-view.
 *
 * The URL is the source of truth (?page=2&limit=20&q=beach&status=LIVE), so
 * reload, back-button and shared links all restore the exact view. Writes use
 * router.replace with scroll:false - list paging must not create history
 * entries or jump the page.
 */

const RESERVED = ['page', 'limit', 'q'] as const;

export interface TableState {
    page: number;
    limit: number;
    /** Raw input value - bind this to the search box. */
    search: string;
    /** Debounced (400ms) - put THIS in query params. */
    debouncedSearch: string;
    /** Named domain filters (status, destinationId, ...). */
    filters: Record<string, string | undefined>;
    setPage: (page: number) => void;
    setLimit: (limit: number) => void;
    setSearch: (value: string) => void;
    /** Setting a filter resets to page 1. `undefined` clears the key. */
    setFilter: (key: string, value: string | undefined) => void;
    /**
     * Set SEVERAL filters in one URL write. Two same-tick setFilter calls
     * clobber each other - each builds its params from the render-time
     * searchParams snapshot, so the second write starts without the first's
     * key and silently reverts it (the /trips status filter bug). Any
     * handler that must touch two keys at once goes through this.
     */
    setFilters: (patch: Record<string, string | undefined>) => void;
}

export function useTableState(options?: { defaultLimit?: number }): TableState {
    const defaultLimit = options?.defaultLimit ?? 20;
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.max(1, Number(searchParams.get('limit')) || defaultLimit);
    const urlSearch = searchParams.get('q') ?? '';

    const filters = React.useMemo(() => {
        const out: Record<string, string | undefined> = {};
        searchParams.forEach((value, key) => {
            if (!(RESERVED as readonly string[]).includes(key)) out[key] = value;
        });
        return out;
    }, [searchParams]);

    // The input is local state (typing must not lag on route updates); the URL
    // carries only the debounced value.
    const [search, setSearchState] = React.useState(urlSearch);

    const write = React.useCallback(
        (mutate: (params: URLSearchParams) => void) => {
            const params = new URLSearchParams(searchParams.toString());
            mutate(params);
            const qs = params.toString();
            // SHALLOW on purpose: every list here is client-fetched (TanStack),
            // so router.replace's RSC round-trip on each filter/page/search
            // write was pure overhead - it dominated the perceived filter
            // latency (user report 2026-08-15). The native History API keeps
            // useSearchParams/usePathname in sync (Next 14.1+), and no list
            // page reads searchParams on the server.
            window.history.replaceState(
                null,
                '',
                qs ? `${pathname}?${qs}` : pathname,
            );
        },
        [pathname, searchParams],
    );

    const setPage = React.useCallback(
        (next: number) =>
            write((p) => {
                if (next <= 1) p.delete('page');
                else p.set('page', String(next));
            }),
        [write],
    );

    const setLimit = React.useCallback(
        (next: number) =>
            write((p) => {
                if (next === defaultLimit) p.delete('limit');
                else p.set('limit', String(next));
                p.delete('page');
            }),
        [write, defaultLimit],
    );

    const setFilters = React.useCallback(
        (patch: Record<string, string | undefined>) =>
            write((p) => {
                for (const [key, value] of Object.entries(patch)) {
                    if (value == null || value === '') p.delete(key);
                    else p.set(key, value);
                }
                p.delete('page');
            }),
        [write],
    );

    const setFilter = React.useCallback(
        (key: string, value: string | undefined) => setFilters({ [key]: value }),
        [setFilters],
    );

    // Debounce the typed value into the URL.
    React.useEffect(() => {
        if (search === urlSearch) return;
        const t = setTimeout(() => {
            write((p) => {
                if (search) p.set('q', search);
                else p.delete('q');
                p.delete('page');
            });
        }, 400);
        return () => clearTimeout(t);
        // urlSearch deliberately not a dep: it changes BECAUSE of this write.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, write]);

    return {
        page,
        limit,
        search,
        debouncedSearch: urlSearch,
        filters,
        setPage,
        setLimit,
        setSearch: setSearchState,
        setFilter,
        setFilters,
    };
}
