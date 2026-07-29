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
 * This API's own public origin - for URLs that third parties fetch back FROM us
 * (PSP webhooks, subscribable calendar feeds), which must therefore be reachable
 * from the internet rather than from inside the cluster. PUBLIC_API_URL wins;
 * BETTER_AUTH_URL is the same origin in every normal deployment.
 */
export function publicApiBase(): string {
  return clean(
    process.env.PUBLIC_API_URL ??
      process.env.BETTER_AUTH_URL ??
      'http://localhost:5050',
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
