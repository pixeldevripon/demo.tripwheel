'use client';

// Imported HERE on purpose. `global-error` REPLACES the root layout, so it
// does not inherit the stylesheet that layout imports - without this line the
// classes below would resolve to nothing and the screen would render unstyled.
// It also keeps this file inside the design system (03 §8.2/§8.3: no inline
// styles, no colour literals) rather than hand-rolling a palette.
import './globals.css';

import { useEffect } from 'react';

/**
 * Last-resort boundary: an error thrown by the ROOT layout itself, which the
 * segment boundary in `(app)/error.tsx` sits inside and therefore cannot catch.
 *
 * It replaces the whole document, so it renders its own `<html>`/`<body>` and
 * cannot use the app shell, the theme provider, or anything that expects them.
 *
 * Deliberately plainer than the dashboard boundary: reaching it means the app
 * never mounted, so the only honest offer is to start over. `reset()`
 * re-renders the root, which is the closest thing to that without a hard
 * document load.
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[dashboard] root error:', error);
    }, [error]);

    return (
        <html lang="en">
            <body className="flex min-h-screen items-center justify-center bg-shell-content">
                <main className="max-w-sm p-6 text-center">
                    <h1 className="text-lg font-medium text-content">
                        The dashboard didn&apos;t load
                    </h1>
                    <p className="mt-2 text-sm text-content-muted">
                        Something failed before the app could start. Your data is
                        untouched.
                    </p>
                    <button
                        onClick={reset}
                        className="mt-6 cursor-pointer rounded-md border border-line bg-surface-raised px-4 py-2 text-sm text-content"
                    >
                        Reload
                    </button>
                    {error.digest && (
                        <p className="mt-6 font-mono text-2xs text-content-subtle">
                            Reference: {error.digest}
                        </p>
                    )}
                </main>
            </body>
        </html>
    );
}
