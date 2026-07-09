/**
 * Server-side data layer for the public (frontend) site.
 *
 * One file per domain (destinations, tours, categories, …); this barrel
 * re-exports them so callers can `import { getActiveDestinations } from
 * '@/lib/api/public'`. Shared fetch primitives live in `./fetch`.
 */
export * from './categories';
export * from './collections';
export * from './destinations';
export * from './filters';
export * from './hubs';
export * from './search';
export * from './tours';
