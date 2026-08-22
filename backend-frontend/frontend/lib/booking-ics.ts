import { BACKEND_API_BASE } from '@/lib/api/backend-url';

/**
 * The backend's tokenized public `.ics` download for a booking - the same link
 * the confirmation email carries.
 *
 * Lives here rather than in `lib/thank-you/thank-you.ts` (which owns the TYP's
 * own `buildIcsUrl`) because that module transitively imports `server-only`
 * through `lib/api/public/bookings`, so a client component cannot reach it. The
 * traveller account hero is a client component and was therefore rebuilding
 * this URL by hand - including its own `process.env` read, which is the one
 * place in the repo a component knew the backend's origin.
 *
 * `encodeURIComponent` on the ref is the reason to share it: the hand-rolled
 * copy did not have it.
 */
export function bookingIcsUrl(publicRef: string): string {
    return `${BACKEND_API_BASE}/bookings/typ/${encodeURIComponent(publicRef)}/calendar.ics`;
}
