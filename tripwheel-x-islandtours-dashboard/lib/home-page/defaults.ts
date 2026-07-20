/**
 * The copy the public site ships with, shown in the editor as the placeholder
 * for an empty field.
 *
 * WHY THIS EXISTS: every homepage field is nullable, and null means "render the
 * built-in dictionary default". Without showing that default, an empty input
 * reads as "this section is blank" when the site is actually rendering real
 * copy - the single most confusing thing about a fallback-based CMS. Showing it
 * turns empty state into an explanation instead of a worry.
 *
 * DUPLICATED ON PURPOSE, and the only cross-repo duplication in this feature:
 * the source is the public site's i18n dictionary
 * (`island-tour-development/frontend/lib/i18n/dictionaries/en.json` -> `home`),
 * which this app cannot import. It is display-only - nothing here is ever sent
 * to the API, so drift costs an out-of-date hint, never wrong data. Re-sync if
 * the dictionary copy changes.
 */
export const HOMEPAGE_DEFAULTS = {
  heroTitle: "We didn't discover the Caribbean. We grew up in it.",
  heroSubtitle: 'Chosen by locals. Made for travelers.',
  experiencesTitle: 'Top island experiences',
  editorialTitleLine1: 'One island',
  editorialTitleLine2: 'Endless adventures',
  editorialBody:
    "We grew up on this island. These are the tours we'd book for our own friends.",
  editorialCta: 'Explore Curaçao',
  faqTitle: 'Need help before booking?',
  faqSubtitle:
    "We're locals. We grew up here, we know these tours, and we want you to have the best time on these islands.",
} as const;

export type HomepageDefaultKey = keyof typeof HOMEPAGE_DEFAULTS;

/**
 * The description under a homepage field: where the text appears, plus - while
 * the field is empty - the fact that the site is still rendering shipped copy
 * rather than nothing. Without the second half, an empty input on a
 * fallback-based CMS reads as a missing section.
 */
export function describeField(
  where: string,
  value: string,
  fallback?: string,
): string {
  const usingDefault = !value.trim() && Boolean(fallback);
  return usingDefault
    ? `${where} Currently showing the built-in default.`
    : where;
}

/**
 * The bundled hero photo, shipped in the public site's `public/images/`. Shown
 * as a caption under an empty hero-image picker so an admin knows the homepage
 * is not missing an image.
 */
export const DEFAULT_HERO_IMAGE_LABEL = 'kc-powerboat.jpg (shipped with the site)';

/** The carousel's slide geometry assumes a small curated set. */
export const RECOMMENDED_MAX_EXPERIENCES = 5;

/**
 * Below this the public site ignores curation entirely and renders its bundled
 * deck - three copies of the card list drive the loop, so one or two real cards
 * read as an obvious repeat. Mirrors MIN_CURATED_CARDS on the public site.
 */
export const MIN_CURATED_EXPERIENCES = 3;
