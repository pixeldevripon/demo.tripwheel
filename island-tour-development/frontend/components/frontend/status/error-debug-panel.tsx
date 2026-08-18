'use client';

import { useEffect, useState } from 'react';

/**
 * TEMPORARY DIAGNOSTIC (2026-07-29). Remove this file, its two render sites
 * (`error-screen.tsx`, `app/global-error.tsx`), `instrumentation.ts`,
 * `lib/debug/server-error-log.ts` and `app/api/debug/errors/route.ts` once the
 * intermittent production error is identified and fixed.
 *
 * Shows what actually failed, on the page, in the words the server used.
 *
 * Two halves, because a public-site error has two possible origins and they
 * surface completely differently:
 *
 *   - CLIENT error (a component threw in the browser): `error.message` and
 *     `error.stack` are real and complete. Rendered directly.
 *   - SERVER error (a Server Component, loader or Server Action threw): React
 *     strips the message in a production build, so all that crosses the wire is
 *     `error.digest`. The real message is fetched back from the temporary debug
 *     endpoint, which reads it from the `onRequestError` capture buffer.
 *
 * Rendering is gated by the caller on `NEXT_PUBLIC_ERROR_DEBUG === '1'`, and the
 * endpoint independently 404s without the same flag - so a stale build cannot
 * leak stacks on its own.
 */

type ServerEntry = {
    at: string;
    digest?: string;
    name: string;
    message: string;
    stack?: string;
    cause?: string;
    path?: string;
    method?: string;
    routePath?: string;
    routeType?: string;
    renderSource?: string;
    revalidateReason?: string;
};

/** Single switch for the whole diagnostic. Also gates the debug endpoint. */
export const errorDebugEnabled = process.env.NEXT_PUBLIC_ERROR_DEBUG === '1';

export function ErrorDebugPanel({
    error,
}: {
    error: Error & { digest?: string };
}) {
    const [server, setServer] = useState<ServerEntry[] | null>(null);
    const [lookup, setLookup] = useState<
        'idle' | 'loading' | 'done' | 'failed'
    >('idle');

    const digest = error.digest;

    useEffect(() => {
        if (!digest) return;
        const controller = new AbortController();
        setLookup('loading');
        fetch(`/api/debug/errors?digest=${encodeURIComponent(digest)}`, {
            signal: controller.signal,
            cache: 'no-store',
        })
            .then(res => (res.ok ? res.json() : Promise.reject(res.status)))
            .then((body: { entries?: ServerEntry[] }) => {
                setServer(body.entries ?? []);
                setLookup('done');
            })
            .catch(() => {
                if (controller.signal.aborted) return;
                setLookup('failed');
            });
        return () => controller.abort();
    }, [digest]);

    const report = [
        `digest: ${digest ?? '(none - client-side error)'}`,
        `url: ${typeof window === 'undefined' ? '' : window.location.href}`,
        `client: ${error.name}: ${error.message}`,
        error.stack ? `client stack:\n${error.stack}` : '',
        server?.length
            ? `server:\n${JSON.stringify(server, null, 2)}`
            : `server: ${lookupNote(lookup, digest)}`,
    ]
        .filter(Boolean)
        .join('\n\n');

    return (
        <div className='w-full max-w-3xl text-left'>
            <div className='mb-3 flex items-center justify-between gap-4'>
                <span className='text-[13px] font-medium leading-none tracking-[-0.012em] text-it-error'>
                    Debug details (temporary - NEXT_PUBLIC_ERROR_DEBUG)
                </span>
                <button
                    type='button'
                    onClick={() => navigator.clipboard?.writeText(report)}
                    className='shrink-0 cursor-pointer rounded-it-full border border-it-border-subtle bg-transparent px-4 py-2 text-[13px] leading-none tracking-[-0.012em] text-it-ink-secondary transition-colors duration-300 hover:bg-it-surface'>
                    Copy report
                </button>
            </div>

            <dl className='m-0 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-[13px] leading-[1.6] tracking-[-0.012em]'>
                <Row label='Digest' value={digest ?? '(none)'} />
                <Row label='Client' value={`${error.name}: ${error.message}`} />
                {server?.[0] && (
                    <>
                        <Row label='Server' value={detailLine(server[0])} />
                        <Row
                            label='Route'
                            value={`${server[0].routePath ?? '?'} (${
                                server[0].routeType ?? '?'
                            } / ${server[0].renderSource ?? '?'})`}
                        />
                        <Row label='Path' value={server[0].path ?? '?'} />
                    </>
                )}
                {!server?.length && digest && (
                    <Row label='Server' value={lookupNote(lookup, digest)} />
                )}
            </dl>

            {/* Stacks are the long part - scrollable, monospace, never allowed to
                widen the page (the sitewide rule: wide content scrolls inside
                its own container, the body never scrolls sideways). */}
            {(server?.[0]?.stack || error.stack) && (
                <pre className='mt-4 max-h-80 overflow-auto rounded-[12px] bg-it-surface p-4 text-[12px] leading-normal whitespace-pre text-it-ink-secondary tracking-[-0.012em]'>
                    {server?.[0]?.stack ?? error.stack}
                </pre>
            )}
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <>
            <dt className='m-0 text-it-text-muted tracking-[-0.012em]'>{label}</dt>
            <dd className='m-0 wrap-break-word text-it-heading tracking-[-0.012em]'>{value}</dd>
        </>
    );
}

function detailLine(entry: ServerEntry): string {
    const base = `${entry.name}: ${entry.message}`;
    return entry.cause ? `${base} (cause: ${entry.cause})` : base;
}

/**
 * A miss is not the same as "nothing was recorded". The buffer is process-local,
 * so a lookup that lands on a different server instance than the one that threw
 * returns zero rows even though the error was captured - and logged. Say which
 * case this is so the next step is obvious.
 */
function lookupNote(
    lookup: 'idle' | 'loading' | 'done' | 'failed',
    digest: string | undefined
): string {
    if (!digest) return 'client-side error - no server entry expected';
    if (lookup === 'loading') return 'looking up...';
    if (lookup === 'failed')
        return 'lookup unavailable (endpoint off?) - grep the frontend log for [server-error]';
    return 'not in this instance buffer - grep the frontend log for the digest above';
}

