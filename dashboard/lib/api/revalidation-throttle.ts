/**
 * Collapses bursts of identical revalidations into one call per window.
 *
 * The dashboard saves per-row and per-tab, so one operator task is a burst of
 * writes that all map to the SAME two or three tags. Measured: saving a 7-day x
 * 3-time schedule is 21 sequential POSTs, all of them `tours` + `search`.
 * Translating one tour into six locales is ~120 saves, all of them `tour:<id>` +
 * `tours` + `search`. In-process that was merely wasteful; across a network each
 * one is an HTTP round trip AND a public-side `revalidateTag` that invalidates
 * every cached entry carrying that tag - and `tours`/`search` span 7 locales x 2
 * currencies x N destinations. So ~120 saves would blow away the entire public
 * tour surface ~120 times, and every visitor landing in that window pays a
 * regeneration.
 *
 * See 02B §6A.3.
 *
 * THE REAL FIX IS UPSTREAM. This is a workaround for a save model the redesign
 * is already deleting: the Translation Console turns ~120 saves into 6, and the
 * bulk schedule/reorder endpoints turn 21 into 1. Those remove ~95% of the
 * volume at source without touching this file. Do not build anything more
 * elaborate here - when the save model lands, this gets quieter on its own.
 *
 * WHY LEADING **AND** TRAILING, not a plain debounce: a debounce would delay
 * every revalidation, including the single isolated save - which is the common
 * case and the one with a human watching. The operator saves, clicks "View on
 * site", and must see the change. So the leading edge fires immediately and only
 * genuine bursts get coalesced. That is the no-regression guarantee.
 */
import { revalidateCacheTags } from '@/app/_actions/revalidate';
import type { CacheTag } from '@/lib/cache-tags';

/**
 * Short enough to be invisible against the human hop to the public site, long
 * enough to swallow a tight save loop. Also bounds the trailing-flush loss
 * window (see `flushAll`).
 */
const WINDOW_MS = 1000;

interface Bucket {
    timer: ReturnType<typeof setTimeout> | null;
    /** Tags that arrived during the open window, awaiting the trailing flush. */
    pending: Set<CacheTag> | null;
}

/**
 * Keyed by tag SET, not by entity or path: two writes coalesce only if they bust
 * exactly the same things. Editing tour A and tour B at once keeps two buckets,
 * so neither delays the other.
 */
const buckets = new Map<string, Bucket>();

const keyFor = (tags: CacheTag[]) => [...tags].sort().join('|');

function fire(tags: CacheTag[]): void {
    // The Server Action itself never throws (it handles its own transport
    // failures). This catch is for the browser->server RPC hop: a dropped
    // connection or a page unloading mid-flight. Log it rather than swallow it -
    // a lost revalidation means the public site stays stale, and the entire
    // point of this design is that such a thing is never silent.
    void revalidateCacheTags(tags).catch((err: unknown) => {
        console.error(
            '[revalidate] could not reach the revalidation action - the public site may be STALE for these tags',
            { tags, error: err }
        );
    });
}

/**
 * Queue a tag set for revalidation, coalescing it with any burst in flight.
 *
 * Fire-and-forget by contract: never awaits, never throws, never blocks the
 * write that triggered it.
 */
export function enqueueRevalidation(tags: CacheTag[]): void {
    if (!tags.length) return;

    const key = keyFor(tags);
    const bucket = buckets.get(key);

    // Leading edge: nothing in flight for this tag set, so go now.
    if (!bucket) {
        fire(tags);
        const opened: Bucket = { timer: null, pending: null };
        buckets.set(key, opened);
        opened.timer = setTimeout(() => onWindowEnd(key), WINDOW_MS);
        return;
    }

    // Inside an open window: accumulate. The Set de-duplicates, which in the
    // common burst means every write after the first adds nothing at all.
    bucket.pending ??= new Set();
    for (const tag of tags) bucket.pending.add(tag);
}

/**
 * Window elapsed. Flush anything that accumulated and re-arm; if the window was
 * quiet, close the bucket so the next write is a leading edge again (instant).
 */
function onWindowEnd(key: string): void {
    const bucket = buckets.get(key);
    if (!bucket) return;

    if (bucket.pending?.size) {
        const tags = [...bucket.pending];
        bucket.pending = null;
        fire(tags);
        // Re-arm rather than close: the burst is still going, and this is what
        // caps a long one at roughly one call per window instead of letting the
        // next write start a fresh leading edge immediately.
        bucket.timer = setTimeout(() => onWindowEnd(key), WINDOW_MS);
        return;
    }

    bucket.timer = null;
    buckets.delete(key);
}

/**
 * Best-effort rescue when the tab is going away mid-window.
 *
 * HONEST LIMIT: this is not guaranteed. The browser may kill the page before the
 * Server Action RPC leaves, and there is no fallback -
 * `navigator.sendBeacon` cannot invoke a Server Action, and pointing it at the
 * public endpoint directly would ship REVALIDATE_SECRET to the browser, which is
 * the whole reason that endpoint is server-to-server. So a trailing flush lost to
 * a tab close is lost, and the tag stays stale until its `cacheLife` expires.
 * Keeping the window at ~1s is what bounds that exposure.
 */
function flushAll(): void {
    for (const [key, bucket] of buckets) {
        if (bucket.timer) clearTimeout(bucket.timer);
        if (bucket.pending?.size) fire([...bucket.pending]);
        buckets.delete(key);
    }
}

if (typeof window !== 'undefined') {
    // `pagehide` over `unload`: it is the one that fires reliably on mobile and
    // does not disqualify the page from the bfcache.
    window.addEventListener('pagehide', flushAll);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushAll();
    });
}
