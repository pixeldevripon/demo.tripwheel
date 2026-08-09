'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { springPop, swapFade } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * The white share pill (Figma node 47433:2069). Uses the Web Share API where
 * the browser has one and falls back to copying the URL to the clipboard.
 *
 * The fallback CONFIRMS, which it did not before: a copy is invisible, so a
 * silent one is indistinguishable from a dead button - and on a desktop browser
 * with no share sheet, the silent copy was the whole experience. The label
 * swaps to "Link copied" for two seconds, matching the tour page's share pill.
 *
 * `url` exists because not every share is a share of the current page: the
 * saved tours page hands out a link carrying its ids, so the recipient gets the
 * list rather than their own empty one.
 */
export function SharePill({
    label,
    copiedLabel,
    url,
    className,
}: {
    label: string;
    /** Shown for two seconds after the URL lands on the clipboard. */
    copiedLabel: string;
    /** What to share. Defaults to the current page. */
    url?: string;
    className?: string;
}) {
    const [copied, setCopied] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // The timeout outlives the component if the route changes inside its two
    // seconds - clear it rather than setting state on an unmounted tree.
    useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current);
        },
        []
    );

    async function handleShare() {
        const target = url ?? window.location.href;
        if (typeof navigator.share === 'function') {
            try {
                await navigator.share({ title: document.title, url: target });
            } catch {
                // Dismissing the sheet rejects with AbortError - not an error.
            }
            return;
        }
        try {
            await navigator.clipboard.writeText(target);
            setCopied(true);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard denied (unlikely) - nothing sensible to do.
        }
    }

    return (
        <motion.button
            type='button'
            onClick={handleShare}
            aria-label={label}
            whileTap={{ scale: 0.97 }}
            transition={springPop}
            className={cn(
                'inline-flex cursor-pointer items-center gap-[7px] rounded-it-full border border-it-border bg-it-white/92 px-[15px] py-[9px] shadow-it-sm transition-transform duration-(--it-duration-xs) ease-(--it-ease) hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-it-primary',
                className
            )}>
            <Image
                src='/icons/share-outline.svg'
                alt=''
                width={24}
                height={24}
                className='size-[15px] shrink-0'
            />
            <AnimatePresence mode='wait' initial={false}>
                <motion.span
                    key={copied ? 'copied' : 'share'}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={swapFade}
                    className='text-[13px] font-bold leading-[1.4] text-it-ink'>
                    {copied ? copiedLabel : label}
                </motion.span>
            </AnimatePresence>
        </motion.button>
    );
}
