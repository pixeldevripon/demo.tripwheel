import { isKnownCacheTag, MAX_TAGS_PER_BATCH } from '@/lib/cache-tags';
import { timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Cross-app cache invalidation endpoint.
 *
 * The dashboard lives in its own repo and its own Next process, so its
 * `updateTag` calls mutate ITS cache - which holds nothing. This endpoint is how
 * a dashboard write reaches THIS app's `'use cache'` entries: the dashboard's
 * Server Action POSTs the tags it just invalidated, and we bust them here.
 *
 * See `technical-doc/dashboard-extraction/02B-CACHE-REVALIDATION-SPEC.md`.
 *
 * The caller is server-to-server ONLY (never a browser): `REVALIDATE_SECRET`
 * would otherwise ship in client JS, and this would need CORS on a
 * cache-control endpoint. There is deliberately no CORS handling here.
 *
 * NOTE ON THE LONG GAME: the dashboard is the wrong announcer - it
 * reverse-engineers "what changed" from the URL path it just called, and it only
 * knows about writes that went through its own browser. Backend-originated
 * writes (BullMQ nightly jobs, Stripe webhooks flipping `isBookable`) never
 * reach this endpoint. The fix is for the backend to emit these from its
 * existing outbox, at which point THIS FILE DOES NOT CHANGE - only the caller
 * does (02B §8). Keep it caller-agnostic.
 */

// RUNTIME: Node, which is the default - do NOT add `export const runtime =
// 'nodejs'` to pin it. `cacheComponents: true` rejects the route segment config
// outright ("Route segment config \"runtime\" is not compatible with
// nextConfig.cacheComponents"), and it fails the BUILD, not the typecheck.
//
// The constraint is real even though the config is not: `timingSafeEqual` comes
// from `node:crypto` and does not exist on the edge runtime. So this route must
// never be moved to edge - it just has to stay on the default rather than say so.

// THE TAG VOCABULARY LIVES IN `lib/cache-tags.ts`, which is byte-identical to the
// dashboard repo's copy at the same path - that file is the contract, and `diff`
// between the two repos is the check. Do not re-declare tag names here.

// ─── Auth ────────────────────────────────────────────────────────────────────

/**
 * Constant-time secret check.
 *
 * `REVALIDATE_SECRET` accepts a COMMA-SEPARATED LIST so rotation is two ordinary
 * deploys (add the new secret here -> switch the dashboard over -> drop the old
 * one) instead of a synchronized flag-day where a missed beat means silent
 * staleness. Cheap to build in now, painful to retrofit later.
 *
 * A plain `===` on a secret leaks its length and matching prefix through timing.
 * `timingSafeEqual` throws on length-mismatched buffers, so length is compared
 * first - that does leak length, which is unavoidable and not worth defending.
 * What matters is that we never early-return on CONTENT: the loop runs every
 * candidate to completion rather than breaking on the first match.
 */
function isAuthorized(provided: string | null): boolean {
    if (!provided) return false;

    const configured = (process.env.REVALIDATE_SECRET ?? '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

    if (configured.length === 0) return false;

    const providedBuf = Buffer.from(provided);
    let matched = false;

    for (const candidate of configured) {
        const candidateBuf = Buffer.from(candidate);
        if (
            candidateBuf.length === providedBuf.length &&
            timingSafeEqual(candidateBuf, providedBuf)
        ) {
            matched = true; // No `break`: keep the work constant across candidates.
        }
    }

    return matched;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

/** Never cached, never crawled. */
const NO_STORE = {
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex',
} as const;

export async function POST(request: NextRequest) {
    if (!isAuthorized(request.headers.get('x-revalidate-secret'))) {
        // No detail: a caller who cannot authenticate learns nothing about why.
        return NextResponse.json(
            { error: 'unauthorized' },
            { status: 401, headers: NO_STORE }
        );
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: 'invalid_body' },
            { status: 400, headers: NO_STORE }
        );
    }

    const tags = (body as { tags?: unknown })?.tags;

    if (
        !Array.isArray(tags) ||
        tags.length === 0 ||
        tags.length > MAX_TAGS_PER_BATCH ||
        !tags.every(t => typeof t === 'string')
    ) {
        return NextResponse.json(
            { error: 'invalid_body' },
            { status: 400, headers: NO_STORE }
        );
    }

    // Reject the batch WHOLLY on any unknown tag, revalidating nothing. A partial
    // success would hand the caller a 200 it would read as "all done", and the
    // tags that silently did not apply are precisely the ones drifting.
    const unknown = (tags as string[]).filter(t => !isKnownCacheTag(t));
    if (unknown.length > 0) {
        console.error(
            '[revalidate] rejected batch: unknown tags (the dashboard and this app have drifted)',
            { unknown, batch: tags }
        );
        return NextResponse.json(
            { error: 'unknown_tag', tags: unknown },
            { status: 400, headers: NO_STORE }
        );
    }

    for (const tag of tags as string[]) {
        // `{ expire: 0 }`, NOT `updateTag` and NOT a bare `revalidateTag(tag)`.
        //
        // - `updateTag` THROWS here. It is Server-Action-only and explicitly
        //   rejects route handlers (next/dist/.../revalidate.js: `workStore.page
        //   .endsWith('/route')` -> error E872). A naive port of the dashboard's
        //   Server Action into this file fails on every call.
        // - A bare `revalidateTag(tag)` is deprecated in Next 16: it warns on
        //   every invocation, which would bury the failure logs this design
        //   depends on, and `profile` is a required parameter in the 16.2.4
        //   types, so it no longer even compiles.
        // - `{ expire: 0 }` reaches the same branch as both (`if (!profile ||
        //   cacheLife?.expire === 0)`), so semantics are IMMEDIATE expiry -
        //   identical to the `updateTag` this replaces, which is the whole point:
        //   the operator publishes, clicks "View on site", and sees it.
        //
        // Do NOT "upgrade" this to the `'max'` profile to silence anything.
        // `'max'` is stale-while-revalidate: it serves the pre-publish page once.
        // That is a real behavior change and it is deliberately deferred (02B
        // §4.2, §6A.4) until it can be measured, not guessed at.
        revalidateTag(tag, { expire: 0 });
    }

    return NextResponse.json({ revalidated: tags }, { headers: NO_STORE });
}

// GET/PUT/DELETE fall through to Next's automatic 405 - there is no handler to
// export for them.
