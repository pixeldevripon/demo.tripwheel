/**
 * Slugs that are static top-level routes on the public site
 * (/[locale]/<slug>), sitting at the same path level as destination slugs.
 * The six legal pages are reserved per the legal handover README
 * (frontend/public/Legal Pages/00-README-for-dev): a destination with one of
 * these slugs would be unreachable, because static Next.js routes always win
 * over the dynamic [destination] route.
 */
export const RESERVED_GLOBAL_SLUGS: ReadonlySet<string> = new Set([
  // Legal pages (handover README).
  'legal-notice',
  'terms',
  'cancellation-policy',
  'privacy-policy',
  'cookie-policy',
  'manage-cookies',
  // Existing static routes on the public site.
  'search',
  'wishlist',
  'cancel',
]);

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
