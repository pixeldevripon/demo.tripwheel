/**
 * Minimal destination shape the hero shell + search share.
 *
 * `tours` is the island's LIVE tour count - the same figure the "Explore
 * islands" cards show. The hero search dropdown lists islands with no sense of
 * how much is behind each one, so a shopper picking an island was choosing
 * blind (founder, 2026-08-05).
 */
export type HeroDestination = { name: string; slug: string; tours: number };
