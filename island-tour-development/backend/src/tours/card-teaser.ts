/**
 * The card teaser - the text of the carousel's description slide (S4j).
 *
 * Shared by every service that shapes public tour cards (ToursService,
 * WishlistService), the same way `tour-badge.ts` shares the badge derivation:
 * one rule, applied wherever a card payload is built, so no surface can ship
 * a different teaser for the same tour.
 */

/**
 * The operator's `shortDescription` when set, else the `overview` cut down to
 * the same ≤160-char budget the shortDescription DTO enforces - so a tour
 * whose operator never filled the teaser still gets a description slide, and
 * no card payload ever ships a 200-word paragraph.
 */
export function cardTeaser(
  t: { shortDescription?: string | null; overview?: string | null } | undefined,
): string | null {
  const short = t?.shortDescription?.trim();
  if (short) return short;
  const overview = t?.overview?.trim();
  if (!overview) return null;
  if (overview.length <= 160) return overview;
  // Cut at a word boundary where the text has words (zh has no spaces - there
  // the plain cut is the boundary).
  const cut = overview.slice(0, 159);
  const atWord = cut.slice(0, Math.max(0, cut.lastIndexOf(' ')));
  return `${(atWord || cut).trimEnd()}…`;
}

/** The locale-scoped translation fields {@link cardTeaser} derives from. */
export const cardTeaserTranslationSelect = {
  shortDescription: true,
  overview: true,
} as const;
