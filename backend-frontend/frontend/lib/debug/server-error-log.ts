/**
 * NO `import 'server-only'` HERE, deliberately. Next.js aliases that module per
 * bundler layer - it is a no-op in the RSC layer and a hard throw everywhere
 * else - and `instrumentation.ts`, this file's only writer, is NOT in the RSC
 * layer. Importing it would break the instrumentation build. Nothing client-side
 * imports this module; the browser reaches it only through the route handler.
 */

/**
 * TEMPORARY DIAGNOSTIC (2026-07-29). Remove once the intermittent production
 * error boundary on the tour / checkout / payment pages is identified and fixed.
 *
 * The problem this solves: in a production build React strips the message off
 * every Server Component error before it reaches the browser, so `error.message`
 * in `error.tsx` reads "An error occurred in the Server Components render. The
 * specific message is omitted in production builds..." and nothing else. All
 * that survives the wire is `error.digest`. That is why the failure "sometimes
 * on the tour page, sometimes on checkout" has been impossible to place - the
 * page shows a generic screen and the BACKEND log (which is what has been
 * inspected so far) never sees it, because the throw happens in the Next.js
 * server, not in NestJS.
 *
 * So we capture the real error where it still exists - `instrumentation.ts`'s
 * `onRequestError`, which Next calls with the unstripped error - and do two
 * things with it:
 *
 *   1. Log ONE structured line to stdout, keyed by the same digest the browser
 *      shows. That alone makes the frontend runtime log greppable by digest.
 *   2. Keep the last {@link CAPACITY} entries in memory so the temporary
 *      `/api/debug/errors` endpoint can hand the full message and stack back to
 *      the error screen, which is where they are actually being looked for.
 *
 * The buffer is process-local and deliberately not persisted: a serverless
 * instance that recycles loses its entries, and a lookup that lands on a
 * different instance misses. That is acceptable for a diagnostic - the stdout
 * line in (1) is the reliable half, the in-page detail in (2) is the fast half.
 */

/** Ring size. Enough to cover a burst; small enough to never matter for memory. */
const CAPACITY = 50;

/** Stack lines kept per entry - enough to reach our own frames past React's. */
const STACK_LINES = 24;

export type ServerErrorEntry = {
    /** ISO timestamp of capture. */
    at: string;
    /** The same value the browser shows as `error.digest`. The join key. */
    digest?: string;
    name: string;
    message: string;
    stack?: string;
    /** `err.cause` flattened to a string - our fetch layer chains through it. */
    cause?: string;
    /** Request URL path, e.g. `/en/curacao/klein-curacao/checkout?quote=...`. */
    path?: string;
    method?: string;
    /** Route FILE path, e.g. `/[locale]/[destination]/[slug]/checkout`. */
    routePath?: string;
    /** `render` | `route` | `action` | `proxy`. */
    routeType?: string;
    /** Which render pass threw - RSC, the RSC payload, or the HTML pass. */
    renderSource?: string;
    /** `on-demand` | `stale` | undefined. Tells a cache refresh from a live hit. */
    revalidateReason?: string;
};

// Pinned to globalThis, not a module-level `let`. Next.js can evaluate a module
// more than once per process (separate server/client graphs, dev HMR), and two
// copies of the buffer means the endpoint reads an array the instrumentation
// hook never wrote to.
const store = globalThis as typeof globalThis & {
    __islandServerErrors?: ServerErrorEntry[];
};
store.__islandServerErrors ??= [];

function trimStack(stack: string | undefined): string | undefined {
    if (!stack) return undefined;
    return stack.split('\n').slice(0, STACK_LINES).join('\n');
}

function describeCause(cause: unknown): string | undefined {
    if (cause == null) return undefined;
    if (cause instanceof Error) return `${cause.name}: ${cause.message}`;
    if (typeof cause === 'string') return cause;
    try {
        return JSON.stringify(cause);
    } catch {
        return String(cause);
    }
}

/**
 * Record one server-side error. Called only from `instrumentation.ts`.
 *
 * Never throws: an observability hook that can itself fail turns one broken
 * request into two, and Next.js would then log OUR error instead of the real
 * one.
 */
export function recordServerError(
    err: unknown,
    request?: { path?: string; method?: string },
    context?: {
        routePath?: string;
        routeType?: string;
        renderSource?: string;
        revalidateReason?: string;
    },
): void {
    try {
        const error =
            err instanceof Error ? err : new Error(String(err ?? 'unknown'));
        const entry: ServerErrorEntry = {
            at: new Date().toISOString(),
            digest: (error as { digest?: string }).digest,
            name: error.name,
            message: error.message,
            stack: trimStack(error.stack),
            cause: describeCause((error as { cause?: unknown }).cause),
            path: request?.path,
            method: request?.method,
            routePath: context?.routePath,
            routeType: context?.routeType,
            renderSource: context?.renderSource,
            revalidateReason: context?.revalidateReason,
        };

        const buffer = store.__islandServerErrors!;
        buffer.push(entry);
        if (buffer.length > CAPACITY) buffer.splice(0, buffer.length - CAPACITY);

        // One line, one object - so it survives log aggregators intact and can
        // be grepped by the digest the traveler reports.
        console.error('[server-error]', JSON.stringify(entry));
    } catch {
        // Diagnostics must never mask the failure they are diagnosing.
    }
}

/**
 * Read back captured errors, newest first. With a `digest` it returns only the
 * matching entries, which is how the error screen resolves the one error the
 * traveler is currently looking at.
 */
export function readServerErrors(digest?: string): ServerErrorEntry[] {
    const buffer = [...(store.__islandServerErrors ?? [])].reverse();
    if (!digest) return buffer;
    return buffer.filter(entry => entry.digest === digest);
}
