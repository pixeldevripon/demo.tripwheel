import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { isSameOrigin } from '@/lib/api/same-origin';
import { readServerErrors } from '@/lib/debug/server-error-log';

/**
 * TEMPORARY DIAGNOSTIC ENDPOINT (2026-07-29). Delete this route, together with
 * `lib/debug/server-error-log.ts`, `instrumentation.ts` and the debug panel in
 * `components/frontend/status/error-debug-panel.tsx`, once the intermittent
 * production error is fixed.
 *
 * Hands back the server-side detail (message, stack, route, render pass) for an
 * error the browser only knows by its `digest`, so the error screen can show the
 * actual cause instead of the generic copy.
 *
 * OFF BY DEFAULT AND OFF UNLESS ASKED FOR. Without `NEXT_PUBLIC_ERROR_DEBUG=1`
 * this route answers 404 - identical to not existing - because a stack trace is
 * an internal-structure leak (file paths, module names, sometimes a query
 * string). The flag is the single switch for the whole diagnostic: the same one
 * gates the on-page panel, so turning it off in the deploy environment removes
 * the feature without a code change.
 */

// No `export const runtime` / `dynamic` here: `cacheComponents: true` REJECTS
// route segment config at build time (not typecheck time). A route handler that
// reads searchParams is uncached anyway.

export function GET(request: NextRequest) {
    if (process.env.NEXT_PUBLIC_ERROR_DEBUG !== '1') {
        return new NextResponse(null, { status: 404 });
    }

    // Same-origin only. This is a GET, so it is not a CSRF target - the point is
    // that a third-party page (or a bare curl from a scanner) should not be able
    // to read the buffer just because the flag got left on after an incident.
    if (!isSameOrigin(request)) {
        return new NextResponse(null, { status: 403 });
    }

    const digest = request.nextUrl.searchParams.get('digest') ?? undefined;

    // A DIGEST IS REQUIRED. Without one `readServerErrors` returns the whole
    // ring buffer - the last 50 errors from EVERY visitor on this instance -
    // and each entry carries the request URL *with its path*. On this site those
    // paths are credentials: `/{locale}/review/<token>` is a write token (it
    // authorizes submitting a review as that guest), and `/cancel/<publicRef>`,
    // `.../thank-you/<publicRef>` and `/traveller/receipt/<paymentId>` are
    // booking view capabilities. Polling this endpoint would harvest them.
    //
    // Nothing legitimate is lost: the only consumer, `error-debug-panel.tsx`,
    // returns early when it has no digest and always sends one. The bulk read
    // was pure attack surface.
    if (!digest) {
        return NextResponse.json(
            { error: 'digest_required' },
            { status: 400, headers: { 'Cache-Control': 'no-store' } },
        );
    }

    const entries = readServerErrors(digest);

    return NextResponse.json(
        {
            // A miss is meaningful, not empty: the request that threw may have
            // been served by a different instance than this lookup landed on, so
            // the caller should fall back to the stdout log rather than conclude
            // nothing was recorded.
            matched: entries.length,
            entries: entries.slice(0, 10),
        },
        { headers: { 'Cache-Control': 'no-store' } },
    );
}
