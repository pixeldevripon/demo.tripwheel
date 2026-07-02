'use client';

import { useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { smoothScrollToId } from '@/lib/motion/smooth-scroll';

/**
 * An in-page anchor (`#targetId`) that scrolls with the shared Framer Motion
 * easing instead of a native jump. Reusable for any same-page hash link. Falls
 * back to the browser's default jump if the target isn't in the DOM, and honors
 * `prefers-reduced-motion`. `offset` clears any sticky navbar / tab bar.
 */
export function SmoothScrollLink({
    targetId,
    offset = 0,
    className,
    children,
}: {
    targetId: string;
    offset?: number;
    className?: string;
    children: ReactNode;
}) {
    const reduce = useReducedMotion();

    function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
        if (!document.getElementById(targetId)) return; // let the default hash jump run
        e.preventDefault();
        smoothScrollToId(targetId, offset, !!reduce);
        history.replaceState(null, '', `#${targetId}`);
    }

    return (
        <a href={`#${targetId}`} onClick={handleClick} className={className}>
            {children}
        </a>
    );
}
