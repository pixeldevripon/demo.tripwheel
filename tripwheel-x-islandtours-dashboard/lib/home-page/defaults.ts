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
 * Consumed as the `placeholder` of each HOMEPAGE_FIELDS entry
 * (`lib/translatable-schema.ts`), so the editor and the Translation Console
 * both show it without either of them special-casing the homepage.
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
 * The bundled hero photo, shipped in the public site's `public/images/`. Shown
 * as a caption under an empty hero-image picker so an admin knows the homepage
 * is not missing an image.
 */
export const DEFAULT_HERO_IMAGE_LABEL = 'kc-powerboat.jpg (shipped with the site)';

/** The carousel's slide geometry assumes a small curated set. */
export const RECOMMENDED_MAX_EXPERIENCES = 8;

/**
 * Below this the public site keeps the whole section off the homepage - there
 * is no bundled fallback deck (founder, 2026-08-04: only DB-curated cards).
 * The site's desktop rail shows FIVE cards at once and the loop track is
 * copies of the card cycle, so a cycle shorter than the visible five puts the
 * same card on screen twice at the same time. Five distinct cards fill the
 * rail exactly; six-plus just deepens the rotation. Mirrors MIN_CURATED_CARDS
 * on the public site (components/frontend/home/top-experiences.tsx) - change
 * both together.
 */
export const MIN_CURATED_EXPERIENCES = 5;
