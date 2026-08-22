'use client';

import { Alert02Icon, RefreshIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Link from 'next/link';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

/**
 * The dashboard's error boundary.
 *
 * Until this file existed there was NONE - not here, not at the root - so any
 * unhandled error anywhere in the dashboard fell through to Next's built-in
 * screen: "This page couldn't load. Reload to try again, or go back." on an
 * otherwise blank page, with the sidebar gone and no clue what failed.
 *
 * An operator hit it while creating a tour and reported the wizard as broken
 * (operator test report 2026-08-01 §01). The compounding part was the advice:
 * "Reload" re-requests the CURRENT url, and several dashboard routes are bare
 * (`/trips/{id}` redirects without a `?step=`), so reloading did not return
 * them to where they were - it dropped them somewhere else entirely and looked
 * like the app had thrown their work away.
 *
 * Being a segment boundary rather than a root one, this keeps the shell: the
 * sidebar, search and account menu stay usable, so a failed page is one broken
 * page instead of a broken product. `reset()` re-renders the segment without a
 * full document load, which recovers a transient failure (an expired token
 * refreshed in the background, a backend blip) with the client cache intact.
 *
 * The digest is shown deliberately. It is the only handle support has on a
 * server-side error - the message itself is redacted in production - and an
 * operator who can read it out is worth more than a tidier screen.
 */
export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Boundaries swallow the error, so without this it never reaches the
        // console of the person who can actually reproduce it.
        console.error('[dashboard] unhandled error:', error);
    }, [error]);

    return (
        <div className="flex min-h-[60vh] w-full items-center justify-center">
            <div className="w-full max-w-md text-center">
                <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-surface-inset text-content-muted">
                    <HugeiconsIcon icon={Alert02Icon} className="size-5" />
                </span>

                <h1 className="text-lg font-medium text-content">
                    This page didn&apos;t load
                </h1>
                <p className="mt-2 text-sm text-content-muted">
                    Something failed while loading this screen. Nothing you had
                    already saved is affected - try again, or head back and come
                    at it from the list.
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                    <Button size="sm" onClick={reset}>
                        <HugeiconsIcon icon={RefreshIcon} className="size-3.5" />
                        Try again
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                        <Link href="/">Back to overview</Link>
                    </Button>
                </div>

                {error.digest && (
                    <p className="mt-6 font-mono text-2xs text-content-subtle">
                        Reference: {error.digest}
                    </p>
                )}
            </div>
        </div>
    );
}
