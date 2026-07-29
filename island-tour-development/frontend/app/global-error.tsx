'use client';

import {
    ErrorDebugPanel,
    errorDebugEnabled,
} from '@/components/frontend/status/error-debug-panel';
import { getStatusCopy } from '@/lib/i18n/status-copy';

import './globals.css';

/**
 * The floor. `global-error.tsx` only renders when the ROOT layout itself throws,
 * which means it replaces that layout entirely - no fonts, no providers, no
 * `.frontend-root` wrapper unless this file supplies them, and no guarantee
 * that anything above it is still working.
 *
 * So it is deliberately the plainest screen on the site: the same tokens, type
 * and pill geometry as <StatusScreen>, hand-written with no motion library, no
 * icon set and no image optimizer in the path - nothing that could fail for the
 * same reason the layout just did. It also cannot know the visitor's locale
 * (there is no router context here), so it speaks English, and "back to home"
 * is a full navigation to `/` that lets the proxy re-resolve their language.
 */
export default function GlobalError({
    error,
    unstable_retry,
}: {
    error: Error & { digest?: string };
    unstable_retry: () => void;
}) {
    const copy = getStatusCopy().error;

    return (
        <html lang='en'>
            <body>
                <title>{copy.title}</title>
                <div className='frontend-root it-status-surface flex min-h-svh items-center'>
                    <div className='it-container flex w-full flex-col items-center py-20 text-center md:py-28'>
                        <div className='relative mb-10 flex size-35 items-center justify-center md:mb-12 md:size-40'>
                            <span
                                aria-hidden
                                className='absolute inset-0 rounded-full border border-dashed border-it-border-subtle'
                            />
                            <span
                                aria-hidden
                                className='absolute top-0 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-it-warning'
                            />
                            <span
                                aria-hidden
                                className='relative block size-22 rounded-full border border-it-warning/15 bg-it-warning-subtle md:size-26'
                            />
                        </div>

                        <span className='mb-5 inline-flex items-center rounded-it-full bg-it-surface px-4 py-2 text-[13px] font-medium leading-none tracking-[-0.012em] text-it-ink-secondary'>
                            {copy.eyebrow}
                        </span>

                        <h1 className='m-0 max-w-175 font-medium text-[32px] md:text-[48px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                            {copy.title}
                        </h1>

                        <p className='m-0 mt-4 max-w-150 text-[16px] md:text-[18px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                            {copy.description}
                        </p>

                        <div className='mt-10 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4'>
                            <button
                                type='button'
                                onClick={() => unstable_retry()}
                                className='inline-flex cursor-pointer items-center justify-center rounded-it-full border-none bg-it-primary px-8 py-[15px] text-[16px] font-medium leading-[1.6] tracking-[-0.012em] text-it-white transition-colors duration-300 hover:bg-it-primary-hover md:px-10'>
                                {copy.primaryCta}
                            </button>
                            <a
                                href='/'
                                className='inline-flex cursor-pointer items-center justify-center rounded-it-full border border-it-ink bg-transparent px-8 py-[15px] text-[16px] font-medium leading-[1.6] tracking-[-0.012em] text-it-ink no-underline transition-colors duration-300 hover:bg-it-ink hover:text-it-white md:px-10'>
                                {copy.secondaryCta}
                            </a>
                        </div>

                        {/* TEMPORARY (2026-07-29) - see error-debug-panel.tsx.
                            Self-contained, so it cannot fail for the same
                            reason the root layout just did. */}
                        {errorDebugEnabled && (
                            <div className='mt-14 flex w-full flex-col items-center border-t border-it-border-subtle pt-10'>
                                <ErrorDebugPanel error={error} />
                            </div>
                        )}
                    </div>
                </div>
            </body>
        </html>
    );
}
