/**
 * Cross-app base URLs for links the backend embeds in emails. The platform is
 * three apps now: the public traveller site (ISLAND_TOURS_URL), the operator
 * dashboard app (PORTAL_URL, which includes its /portal login path), and this
 * API (BETTER_AUTH_URL / PUBLIC_API_URL). Values are trimmed and stripped of
 * trailing junk - they land verbatim in emailed links, where a stray "/",
 * ".", or space breaks them.
 */
const clean = (value: string): string => value.trim().replace(/[/.\s]+$/, '');

/**
 * Public traveller site - TYP links, the /bookings account line, cancel page.
 * Falls back to FRONTEND_URL (the pre-split name) then the dev default.
 */
export function islandToursBase(): string {
  return clean(
    process.env.ISLAND_TOURS_URL ??
      process.env.FRONTEND_URL ??
      'http://localhost:3000',
  );
}

/**
 * Operator dashboard app ROOT (PORTAL_URL minus its /portal path) - operator
 * email links like /dashboard/bookings.
 */
export function dashboardAppBase(): string {
  return clean(
    process.env.PORTAL_URL ?? 'http://localhost:3001/portal',
  ).replace(/\/portal$/, '');
}
