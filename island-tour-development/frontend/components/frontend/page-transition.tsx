'use client';

import { isLocale } from '@/lib/constants/locales';
import { pageEnter } from '@/lib/motion';
import { motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

/**
 * Sitewide page-enter transition (the checkout -> thank-you feel on every
 * navigation). An enter-only motion.div keyed by pathname - NEVER
 * `AnimatePresence mode='wait'` around App Router children, which throws
 * "Rendered more hooks than during the previous render".
 *
 * The first paint is deliberately NOT animated (`initial: false` until
 * mounted): the prerendered shell must stay visible without JS, so only
 * client-side navigations play the fade + lift. Uses the canonical
 * `pageEnter` + y 16 language from `@/lib/motion`; respects reduced motion.
 */

/**
 * Transition key = the pathname WITHOUT its locale segment. A locale switch
 * (`/en/curacao` -> `/nl/curacao`) is the same page in another language, so it
 * must swap content in place - replaying the enter lift while the reader sits
 * mid-page (e.g. at the footer selector) makes the whole page travel bottom
 * to top. Real page navigations still change the key and animate.
 */
function transitionKey(pathname: string): string {
    const segments = pathname.split('/');
    if (isLocale(segments[1])) segments.splice(1, 1);
    return segments.join('/') || '/';
}

export function PageTransition({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const reduceMotion = useReducedMotion();

    // False during SSR + first client render, so the initial page load renders
    // plain visible HTML; true from then on, so route changes animate.
    const [ready, setReady] = useState(false);
    useEffect(() => setReady(true), []);

    return (
        <motion.div
            key={transitionKey(pathname)}
            initial={ready && !reduceMotion ? { opacity: 0, y: 16 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={pageEnter}>
            {children}
        </motion.div>
    );
}
