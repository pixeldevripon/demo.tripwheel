/**
 * The backend API origin, in ONE place.
 *
 * This exact expression was spelled out twelve times across `lib/` and
 * `app/api/` - and once, wrongly, inside a component. Twelve copies of one
 * env-var name and one fallback port is twelve chances for a rename to be
 * applied eleven times.
 *
 * Environment-neutral: `NEXT_PUBLIC_BACKEND_URL` is inlined at build time and
 * is genuinely public (it is the address the browser talks to), so this is
 * importable from Server Components, Route Handlers and client components
 * alike. It holds no secret - the internal key lives in
 * `lib/api/public/fetch.ts` and `lib/api/visitor-throttle.ts`, both server-only.
 */
export const BACKEND_API_BASE = `${
    process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050'
}/api/v1`;
