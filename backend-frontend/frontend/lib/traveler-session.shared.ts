/**
 * Environment-neutral traveler-session constants - importable from client
 * code (lib/api/bookings.ts) and server-only code (lib/api/public/bookings.ts)
 * alike. Mirrors the backend's TRAVELER_SESSION_HEADER
 * (backend/src/bookings/traveler-session.util.ts) - keep in sync.
 */
export const TRAVELER_SESSION_HEADER = 'x-traveler-session';

/**
 * The shape of a booking's public ref, validated before it is ever interpolated
 * into a backend URL. One definition: it was spelled three times across the
 * traveller proxies under two different names (`PUBLIC_REF_SHAPE` and
 * `TOKEN_SHAPE`), so a tightening would have had to be remembered three times.
 */
export const PUBLIC_REF_SHAPE = /^[A-Za-z0-9-]{1,64}$/;

/**
 * The shape of a departure id. IDENTICAL to `PUBLIC_REF_SHAPE` today, and
 * deliberately its own constant anyway: a departure id is a different kind of
 * value that merely happens to match, and collapsing the two would silently
 * couple them the next time either format changes.
 */
export const DEPARTURE_ID_SHAPE = /^[A-Za-z0-9-]{1,64}$/;
