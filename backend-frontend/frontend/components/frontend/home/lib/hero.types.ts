/**
 * Minimal destination shape the hero shell + search share.
 *
 * `tours` is the island's LIVE tour count - the same figure the "Explore
 * islands" cards show. The hero search dropdown lists islands with no sense of
 * how much is behind each one, so a shopper picking an island was choosing
 * blind (founder, 2026-08-05).
 *
 * `image` is the island's hero photo, for the dropdown row's square. Nullable -
 * an island with no photo gets the flat fallback surface, not a glyph.
 */
export type HeroDestination = {
    name: string;
    slug: string;
    tours: number;
    image: string | null;
};
