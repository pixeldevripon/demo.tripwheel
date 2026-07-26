/**
 * Slugs that are static top-level routes on the public site
 * (/[locale]/<slug>), sitting at the same path level as destination slugs.
 * The six legal pages are reserved per the legal handover README
 * (frontend/public/Legal Pages/00-README-for-dev): a destination with one of
 * these slugs would be unreachable, because static Next.js routes always win
 * over the dynamic [destination] route.
 */
export const RESERVED_GLOBAL_SLUGS: ReadonlySet<string> = new Set([
  // Legal pages (handover README). These are Page rows since the Pages system
  // landed, but they stay reserved: a destination with one of these slugs
  // would shadow (or be shadowed by) the page at the same path level.
  'legal-notice',
  'terms',
  'cancellation-policy',
  'privacy-policy',
  'cookie-policy',
  'manage-cookies',
  'reviews-policy',
  // Existing static routes on the public site.
  'search',
  'wishlist',
  'cancel',
  'review',
]);

/**
 * Slugs a PAGE may not take: the top-level routes that remain hard-coded even
 * after the legal pages became Page rows. Deliberately a SUBSET of
 * RESERVED_GLOBAL_SLUGS — the legal slugs are absent because they now ARE
 * pages (the seed creates them), while these five stay real code
 * (search/wishlist/cancel/review are apps, manage-cookies embeds the Cookiebot
 * dialog button). Destinations still validate against the full set above,
 * plus a live lookup against existing Page slugs.
 */
export const RESERVED_PAGE_SLUGS: ReadonlySet<string> = new Set([
  'search',
  'wishlist',
  'cancel',
  'review',
  'manage-cookies',
]);

/**
 * Normalise a PAGE permalink path: one or more slug segments separated by
 * `/` (WordPress-style nesting - `terms`, `legal/terms`,
 * `help/booking/how-to-pay`). Each segment goes through `generateSlug`;
 * empty segments (double slashes, leading/trailing) collapse away. Returns
 * '' when nothing survives.
 */
export function normalizePagePath(input: string): string {
  return input
    .split('/')
    .map((segment) => generateSlug(segment))
    .filter((segment) => segment.length > 0)
    .join('/');
}

export function generateSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics: Curaçao → curacao
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
