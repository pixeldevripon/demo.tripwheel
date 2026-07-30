/**
 * The hotel card's CHROME labels as the public site ships them, shown in the
 * editor as the placeholder for an empty field.
 *
 * WHY ONLY TWO: a hotel's own facts (name, area, pitch, photo, price) have no
 * bundled default - we ship no default hotel, so a blank one of those means the
 * card is missing information, not that it is falling back. The eyebrow
 * and the CTA text are different: they are ours, already translated into all 7
 * locales in the site's dictionary, and a blank field there really does render
 * these strings. Showing them turns "this looks unset" into "this is what the
 * site is showing".
 *
 * DUPLICATED ON PURPOSE, exactly like HOMEPAGE_DEFAULTS: the source is the public
 * site's i18n dictionary
 * (`island-tour-development/frontend/lib/i18n/dictionaries/en.json` -> `thankYou`
 * -> `aptEyebrow` / `aptCta`), which this app cannot import. Display-only -
 * nothing here is ever sent to the API, so drift costs an out-of-date hint, never
 * wrong data.
 */
export const HOTEL_DEFAULTS = {
  // No emoji: the palm that opens this line on the card is rendered by the card
  // itself, in every language, so it is never part of the text an admin types.
  eyebrow: 'OUR APARTMENT',
  ctaLabel: 'See availability on Airbnb',
} as const;
