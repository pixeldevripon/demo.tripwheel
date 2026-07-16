'use server';

/**
 * Ships cache-tag invalidations to the public site.
 *
 * This used to call `updateTag(tag)` directly, which worked because the
 * dashboard and the public site were ONE Next process sharing ONE cache. They
 * are now two apps: `updateTag` here would mutate the dashboard's own cache,
 * which holds nothing (the dashboard does not use `'use cache'`). It would
 * succeed, do nothing, and the public site would serve stale pages until the
 * `cacheLife` expired - no error, no build break, no test failure. That silence
 * is the single worst failure mode in the whole extraction, and it is why this
 * file is now a transport instead of a cache call.
 *
 * See `technical-doc/dashboard-extraction/02B-CACHE-REVALIDATION-SPEC.md`.
 *
 * WHY THIS IS STILL A SERVER ACTION, now that `updateTag` is gone: because
 * `REVALIDATE_SECRET` must never reach the browser. Posting the public endpoint
 * straight from the client would ship the secret in JS and need CORS on a
 * cache-control endpoint. The Server Action seam already existed for an
 * unrelated reason; it now earns its keep for a better one.
 *
 * DEBT, stated plainly: this file means the dashboard knows the public site
 * exists and knows its cache-tag vocabulary - a coupling between two services
 * that are supposed to be independent. The right answer is for the backend to
 * emit these from its outbox (it knows what actually changed, it covers writes
 * that never touch this dashboard, and BullMQ would make them durable). This is
 * a stepping stone to that, not the destination (02B §8).
 */

// The tag vocabulary is the cross-repo contract and lives in `lib/cache-tags.ts`,
// byte-identical to the public repo's copy at the same path. It is imported
// rather than declared here for two reasons: a `'use server'` file is the wrong
// home for a shared type, and the public site must be able to validate against
// the same list it is being sent.
import type { CacheTag } from '@/lib/cache-tags';

// Same backoff vocabulary as `lib/api/fetch.ts`, deliberately: one retry shape
// for the whole codebase.
const RETRY_BACKOFF_MS = [300, 800];

// Bound the Server Action. The write already succeeded; nothing downstream is
// waiting on this, but an unbounded fetch would pin a server task on a hung
// public site.
const TIMEOUT_MS = 3000;

const sleep = (base: number) =>
    new Promise<void>(resolve =>
        setTimeout(resolve, base + Math.floor(Math.random() * base))
    );

/** So an unconfigured environment says so once, rather than on every write. */
let warnedUnconfigured = false;

/**
 * Bust the given cache tags on the public site.
 *
 * NEVER THROWS, AND CALLERS MUST NOT AWAIT IT for correctness. The operator's
 * write has already succeeded by the time this runs; a revalidation problem is
 * OUR problem, not theirs, and it must never fail or slow down a save. If the
 * public site is down, the save still lands, at full speed.
 *
 * What it must NOT do is fail quietly - the old code was
 * `.catch(() => {})`, which was defensible when this was a local function call
 * that essentially could not fail. Across a network it can fail from DNS, TLS, a
 * public-site deploy, a rotated secret, tag drift, a timeout, or a 5xx, and
 * every one of those means the public site is silently serving stale content.
 * So: transient failures retry, permanent ones do not, and everything that
 * survives lands in `console.error` for the log drain to alert on.
 */
export async function revalidateCacheTags(tags: CacheTag[]): Promise<void> {
    if (!tags.length) return;

    const target = process.env.REVALIDATE_TARGET_URL;
    const secret = process.env.REVALIDATE_SECRET;

    // Unconfigured is a legitimate state (local dev without a public site
    // running), so skip rather than throw - but say so once, so a production
    // deploy that forgot the env var is loud instead of mysteriously stale.
    if (!target || !secret) {
        if (!warnedUnconfigured) {
            warnedUnconfigured = true;
            console.warn(
                '[revalidate] REVALIDATE_TARGET_URL/REVALIDATE_SECRET not set - public cache revalidation is DISABLED for this process. Dashboard writes will not bust the public site.'
            );
        }
        return;
    }

    for (let attempt = 0; ; attempt++) {
        let transient: string;

        try {
            const res = await fetch(target, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-revalidate-secret': secret,
                },
                body: JSON.stringify({ tags }),
                signal: AbortSignal.timeout(TIMEOUT_MS),
                cache: 'no-store',
            });

            if (res.ok) return;

            // 400 and 401 are permanent and retrying them only spams a broken
            // deploy: 400 means the tag vocabularies have drifted (a code bug
            // that needs both repos changed), 401 means the secret does not
            // match (a config bug). Both need a human, not a second attempt.
            if (res.status === 400 || res.status === 401) {
                const detail = await res.text().catch(() => '');
                console.error(
                    `[revalidate] permanent failure (${res.status}) - the public site is now STALE for these tags and no retry will fix it. ${
                        res.status === 401
                            ? 'REVALIDATE_SECRET does not match the public site.'
                            : 'Tag vocabulary has drifted from the public repo.'
                    }`,
                    { status: res.status, tags, detail: detail.slice(0, 500) }
                );
                return;
            }

            transient = `HTTP ${res.status}`;
        } catch (err) {
            // Network, DNS, TLS, or the 3s timeout.
            transient = err instanceof Error ? err.message : String(err);
        }

        if (attempt >= RETRY_BACKOFF_MS.length) {
            console.error(
                `[revalidate] giving up after ${RETRY_BACKOFF_MS.length + 1} attempts - the public site is now STALE for these tags until their cacheLife expires.`,
                { tags, lastError: transient }
            );
            return;
        }

        await sleep(RETRY_BACKOFF_MS[attempt]);
    }
}
