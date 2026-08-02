import { BACKEND_API_BASE } from '@/lib/api/backend-url';

/**
 * Path-segment safety for backend URLs.
 *
 * ## The bug this exists to make unrepeatable
 * Next decodes dynamic route params before handing them to a page, and does NOT
 * strip dot segments. So `GET /en/%2E%2E%2F%2E%2E%2Ftours` yields
 * `params.destination === '../../tours'`. Interpolated raw into a backend path
 * that becomes `/destinations/slug/../../tours`, and the WHATWG URL parser
 * inside `fetch` RESOLVES it - relocating the request to
 * `http://backend/api/v1/tours`. With enough segments it leaves `/api/v1`
 * altogether and reaches `/api/auth/*`.
 *
 * That request goes out from the SSR origin carrying `x-internal-api-key`, so an
 * anonymous visitor could aim a trusted-origin, throttle-exempt call at an
 * endpoint of their choosing - path AND query, since the segment is appended
 * before `buildQuery`. It grants no data today (the key only exempts throttling,
 * and only on routes without their own `@Throttle`), but it falsifies the
 * premise the whole trusted-origin design rests on: that this caller is our own
 * infrastructure.
 *
 * ## Two layers, deliberately
 * `seg()` encodes at the call site - the actual fix. `assertBackendUrl()` is the
 * backstop for the next path that forgets, because "remember to encode" has
 * already failed once across ~15 call sites while `pages.ts` and the booking
 * readers got it right.
 */

/**
 * One URL path segment. Encodes `/`, `.`, `%` and everything else that could
 * change the shape of the path rather than just its content.
 *
 * Use for EVERY interpolated segment, including ids that "come from the
 * database" - a value's provenance is not visible at the call site, and the
 * cost of encoding a uuid is nothing.
 */
export function seg(value: string | number): string {
    return encodeURIComponent(String(value));
}

/**
 * Assert a built backend URL still points inside the API base.
 *
 * Throws rather than returning a boolean: a path that escaped its base is a
 * programming error, and the correct behaviour is to fail the request loudly,
 * not to fall back to a "safe default" that silently serves the wrong entity.
 */
export function assertBackendUrl(path: string): string {
    // Reject dot segments OUTRIGHT, before resolving.
    //
    // Checking only "does the resolved URL still start with the base" is not
    // enough, and that weaker form is the obvious mistake: `/destinations/slug/
    // ../../tours` resolves to `<base>/tours`, which passes a prefix test while
    // being exactly the attack - the caller asked for a destination and the
    // network layer fetched the tours list. What matters is not where the path
    // lands but that the CALLER did not choose it.
    //
    // No legitimate backend path contains `.` or `..` as a segment, so this
    // costs nothing and catches lateral relocation as well as escape.
    if (/(^|\/)\.\.?(\/|$)/.test(path.split('?')[0])) {
        throw new Error(
            `Refusing to fetch a backend path containing a dot segment: ${path}`
        );
    }
    const url = `${BACKEND_API_BASE}${path}`;
    // Belt and braces: `new URL` performs the same resolution `fetch` would, so
    // this compares what the network layer will ACTUALLY request - covering any
    // other way a path could climb out (encoded separators a future runtime
    // decodes, a leading `//host`, a backslash).
    if (!new URL(url).toString().startsWith(`${BACKEND_API_BASE}/`)) {
        throw new Error(
            `Refusing to fetch a backend path that escapes ${BACKEND_API_BASE}: ${path}`
        );
    }
    return url;
}
