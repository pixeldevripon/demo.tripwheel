/**
 * Environment-neutral traveler-session constants - importable from client
 * code (lib/api/bookings.ts) and server-only code (lib/api/public/bookings.ts)
 * alike. Mirrors the backend's TRAVELER_SESSION_HEADER
 * (backend/src/bookings/traveler-session.util.ts) - keep in sync.
 */
export const TRAVELER_SESSION_HEADER = 'x-traveler-session';
