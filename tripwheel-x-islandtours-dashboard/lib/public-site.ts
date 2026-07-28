/**
 * Absolute URLs into the public Island Tours site.
 *
 * ## Why this exists rather than an inline `process.env` read
 * `NEXT_PUBLIC_SITE_URL` looks like the obvious name and is a GHOST - the
 * extraction spec records that nothing reads it, and it is absent from
 * `.env.local`. Reading it yields the localhost fallback in every environment,
 * which is invisible in dev and broken in production. `NEXT_PUBLIC_FACING_APP_URL`
 * is the variable that is actually set, and is what the profile dropdown's
 * "view site" link already uses.
 *
 * Centralised so the next feature that needs a public link cannot re-guess.
 */
const PUBLIC_SITE_URL =
  process.env.NEXT_PUBLIC_FACING_APP_URL ?? 'http://localhost:3000';

/**
 * The review page for an invitation token.
 *
 * The token IS the credential, so this link is only ever built from the
 * self-scoped `review` block the backend attaches to a customer's OWN bookings.
 */
export function reviewUrl(token: string, locale = 'en'): string {
  return `${PUBLIC_SITE_URL}/${locale}/review/${token}`;
}

/** A published Page's live URL (`/{locale}/{slug}` - the permalink). */
export function pageUrl(slug: string, locale = 'en'): string {
  return `${PUBLIC_SITE_URL}/${locale}/${slug}`;
}

/**
 * The traveller account area on the public site.
 *
 * Travellers used to sign in here, at `/account`. That door was removed on
 * 2026-07-28: they are passwordless again and manage their own bookings and
 * payments on the public site instead. Anything in this app that needs to send
 * a traveller somewhere must send them there.
 */
export function travellerAccountUrl(locale = 'en'): string {
  return `${PUBLIC_SITE_URL}/${locale}/traveller`;
}
