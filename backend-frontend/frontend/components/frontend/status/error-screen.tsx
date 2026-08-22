'use client';

import { motion } from 'framer-motion';
import { RotateCw, TriangleAlert } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { MotionLink } from '@/components/frontend/motion-link';
import {
    ErrorDebugPanel,
    errorDebugEnabled,
} from '@/components/frontend/status/error-debug-panel';
import {
    StatusScreen,
    statusPrimaryClass,
    statusSecondaryClass,
} from '@/components/frontend/status/status-screen';
import { isLocale, localizeHref } from '@/lib/constants/locales';
import { getStatusCopy, localeFromPathname } from '@/lib/i18n/status-copy';
import { springPop } from '@/lib/motion';

/**
 * The error screen behind every `error.tsx` boundary on the public site.
 *
 * The traveler gets one thing: an action that might actually work. Retry
 * re-renders the segment, and a flaky upstream call usually succeeds on the
 * second pass. Nothing diagnostic reaches the page - not `error.message` (a
 * generic string on the server, stack-shaped noise on the client) and not
 * `error.digest`. The digest still goes to the console here and is already in
 * the server log under the same value, so an outage stays traceable without
 * putting a support code in front of someone who just wants to book a tour.
 *
 * TEMPORARY EXCEPTION (2026-07-29): with `NEXT_PUBLIC_ERROR_DEBUG=1` the screen
 * also renders <ErrorDebugPanel> under the actions, which DOES put the message
 * and stack on the page. That flag exists to chase the intermittent production
 * failure on the tour / checkout / payment pages and must be unset again - along
 * with the panel and its endpoint - once the cause is fixed.
 */
export function ErrorScreen({
    error,
    retry,
    fill = 'section',
}: {
    error: Error & { digest?: string };
    /** `unstable_retry` from the boundary - re-fetches and re-renders. */
    retry: () => void;
    fill?: 'section' | 'viewport';
}) {
    const pathname = usePathname();
    const locale = localeFromPathname(pathname);
    const copy = getStatusCopy(locale).error;

    // Same rule as the 404: localized href inside the locale tree, bare path
    // outside it so the proxy resolves the visitor's locale.
    const homeHref = isLocale(pathname?.split('/')[1])
        ? localizeHref(locale, '/')
        : '/';

    useEffect(() => {
        // The browser console is the only place a client-side render failure is
        // visible; server errors are already logged with this same digest.
        console.error(error);
    }, [error]);

    return (
        <StatusScreen
            tone='amber'
            fill={fill}
            icon={
                <TriangleAlert
                    className='size-10 md:size-11'
                    strokeWidth={1.5}
                />
            }
            eyebrow={copy.eyebrow}
            title={copy.title}
            description={copy.description}
            actions={
                <>
                    <motion.button
                        type='button'
                        onClick={retry}
                        whileTap={{ scale: 0.98 }}
                        transition={springPop}
                        className={statusPrimaryClass}>
                        <RotateCw className='size-5' strokeWidth={1.75} />
                        {copy.primaryCta}
                    </motion.button>
                    <MotionLink
                        href={homeHref}
                        whileTap={{ scale: 0.98 }}
                        transition={springPop}
                        className={statusSecondaryClass}>
                        {copy.secondaryCta}
                    </MotionLink>
                </>
            }
            footer={
                errorDebugEnabled ? (
                    <ErrorDebugPanel error={error} />
                ) : undefined
            }
        />
    );
}
