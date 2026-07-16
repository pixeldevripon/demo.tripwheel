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

// ─── The tag contract ────────────────────────────────────────────────────────

/**
 * Every tag this app's `'use cache'` layer is allowed to be busted with.
 *
 * THIS IS A CONTRACT WITH THE DASHBOARD REPO, and nothing mechanically enforces
 * it - the producer (`lib/api/cache-revalidation.ts`, over there) and the
 * consumer (`lib/api/public/*` `cacheTag(...)` calls, over here) are compiled
 * separately.
 *
 * That is exactly why unknown tags are REJECTED rather than ignored. If this app
 * renamed `site-info` to `site` and accepted anything, the dashboard would keep
 * POSTing `site-info`, we would keep returning 200, and the footer would serve a
 * stale logo until the `cacheLife` expired - forever green, permanently wrong.
 * The 400 turns that silent staleness into a loud failure on the FIRST write
 * after the drift. It costs one Set lookup.
 *
 * So: if you rename or remove a tag in `lib/api/public/*`, change it here AND in
 * the dashboard repo, or the next deploy starts 400ing.
 */
const COARSE_TAGS = new Set([
    'tours',
    'search',
    'hubs',
    'categories',
    'collections',
    'destinations',
    'reviews',
    'slug-registry',
    'site-info',
    // Vestigial, and knowingly kept. Nothing in this app is tagged
    // `user-profile`: it belonged to the dashboard's `getUserProfile`, which was
    // deliberately moved off `'use cache'` onto React `cache()` (caching a
    // transient auth failure would bounce a logged-in user to /login). The
    // dashboard still maps `/users/me` and `/settings/*` writes to it, so it
    // still arrives here - and busting it has been a no-op since long before the
    // split. Listed so the drift guard does not 400 a harmless legacy tag.
    // Remove from BOTH repos together, or not at all.
    'user-profile',
]);

/**
 * Prefixes of per-entity tags (`tour:<uuid>`), so one edit regenerates only that
 * entity's page instead of every page of its type.
 *
 * `slug:<destinationSlug>:<slug>` (lib/api/slug-registry.ts) is deliberately
 * ABSENT: it has three segments, and the dashboard never sends it - a slug
 * change arrives as the coarse `slug-registry`. Adding it here would mean
 * loosening the two-segment rule below for a tag no caller produces.
 */
const GRANULAR_PREFIXES = new Set([
    'tour',
    'destination',
    'hub',
    'category',
    'collection',
    'operator',
]);

/** A batch large enough to be a bug, not a workload (the widest mapping emits 4). */
const MAX_TAGS = 32;

function isKnownTag(tag: string): boolean {
    if (COARSE_TAGS.has(tag)) return true;

    // Exactly `<prefix>:<id>`, both halves non-empty. `split` with no limit means
    // `tour:a:b` yields 3 parts and is correctly rejected.
    const parts = tag.split(':');
    return (
        parts.length === 2 &&
        GRANULAR_PREFIXES.has(parts[0]) &&
        parts[1].length > 0
    );
}

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
        tags.length > MAX_TAGS ||
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
    const unknown = (tags as string[]).filter(t => !isKnownTag(t));
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
