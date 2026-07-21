import { cacheLife } from 'next/cache';

/**
 * Current year, read inside a Cache Component so prerendering stays static
 * (Next 16 forbids a bare `new Date()` on a prerendered path). Refreshes daily,
 * so any year-stamped copy rolls over within a day of the new year.
 *
 * Shared by the All Tours heading and that page's `<title>`, which must agree -
 * two independent `new Date()` calls could straddle midnight on 31 December.
 */
export async function getCurrentYear(): Promise<number> {
    'use cache';
    cacheLife('days');
    return new Date().getFullYear();
}
