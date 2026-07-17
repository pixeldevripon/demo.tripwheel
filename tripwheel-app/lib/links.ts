/**
 * Deployment wiring for the marketing site - every cross-service URL comes
 * through env vars so each environment (local / preview / production) can
 * point wherever it needs.
 *
 * - SITE_URL       this site's own canonical origin. Feeds metadata, the
 *                  sitemap, and JSON-LD, which all need absolute URLs.
 * - API_URL        the better-auth backend (api.tripwheel.app). The login
 *                  form authenticates directly against it.
 * - DASHBOARD_URL  the operator dashboard (dashboard.tripwheel.app). A
 *                  successful login lands there; the session cookie is
 *                  shared via the backend's cross-subdomain cookie config.
 */
export const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tripwheel.app';

export const API_URL =
    process.env.NEXT_PUBLIC_API_URL ?? 'https://api.tripwheel.app';

export const DASHBOARD_URL =
    process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'https://dashboard.tripwheel.app';
