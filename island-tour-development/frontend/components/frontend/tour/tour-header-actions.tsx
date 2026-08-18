'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useRef, useState } from 'react';

import { useWishlist } from '@/components/frontend/wishlist-provider';
import { springPop, swapFade } from '@/lib/motion';

export type TourHeaderActionsDict = {
    save: string;
    share: string;
    linkCopied: string;
};

/**
 * The tour's Save / Share pair, in one of two placements:
 *
 * - `pill` (desktop): labelled white pills at the right end of the header row.
 * - `overlay` (mobile): small icon-only discs over the top-right of the hero
 *   photo, where they cost no vertical space of their own (Pastel #36).
 *
 * Save toggles the wishlist (guests are routed to /login by the provider) and
 * fills the heart while saved. Share opens the native share sheet where the
 * browser has one; otherwise it copies the URL and confirms briefly - as a
 * label swap on the pills, and as a check glyph on the discs, which have no
 * label to swap.
 */
export function TourHeaderActions({
    tourId,
    title,
    dict,
    variant = 'pill',
}: {
    tourId: string;
    /** Tour title - the share sheet's headline. */
    title: string;
    dict: TourHeaderActionsDict;
    variant?: 'pill' | 'overlay';
}) {
    const { isSaved, toggle } = useWishlist();
    const saved = isSaved(tourId);
    const [copied, setCopied] = useState(false);
    const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    async function share() {
        const url = window.location.href;
        if (typeof navigator.share === 'function') {
            try {
                await navigator.share({ title, url });
            } catch {
                // Dismissing the sheet rejects with AbortError - not an error.
            }
            return;
        }
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            if (copiedTimer.current) clearTimeout(copiedTimer.current);
            copiedTimer.current = setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard denied (unlikely) - nothing sensible to do.
        }
    }

    const overlay = variant === 'overlay';

    // Design v2 .wtool pills: bordered white pills, 13px bold, paper hover.
    //
    // The overlay discs are 34px of visible white on the photo, with the touch
    // target taken back out to 44px by an invisible `before:` box (-5px on each
    // side). Sizing the disc itself at 44px to satisfy the target floor made
    // two chrome-heavy circles sit on the hero; the tap area is not the thing
    // that has to be seen. They carry no border - white on a photo is contrast
    // enough.
    const actionClass = overlay
        ? 'relative grid size-[34px] cursor-pointer place-items-center rounded-it-full border-none bg-it-white/94 shadow-it-sm backdrop-blur-[2px] before:absolute before:-inset-[5px] before:content-[""]'
        : 'inline-flex cursor-pointer items-center gap-[7px] rounded-it-full border border-it-border bg-it-white px-3.5 py-2 text-[13px] font-medium leading-[1.2] text-it-ink transition-colors duration-(--it-duration-xs) ease-(--it-ease) hover:bg-it-bg';
    const iconClass = overlay ? 'size-[15px] shrink-0' : 'size-4 shrink-0';

    return (
        <div className='flex shrink-0 items-center justify-end gap-2'>
            <motion.button
                type='button'
                aria-pressed={saved}
                aria-label={overlay ? dict.save : undefined}
                onClick={() => toggle(tourId)}
                whileTap={{ scale: 0.97 }}
                transition={springPop}
                className={actionClass}>
                <Image
                    src={
                        saved
                            ? '/icons/heart-filled.svg'
                            : '/icons/heart-outline.svg'
                    }
                    alt=''
                    width={24}
                    height={24}
                    className={iconClass}
                />
                {!overlay && <span>{dict.save}</span>}
            </motion.button>
            <motion.button
                type='button'
                onClick={share}
                aria-label={overlay ? dict.share : undefined}
                whileTap={{ scale: 0.97 }}
                transition={springPop}
                className={actionClass}>
                {overlay ? (
                    // No label to swap, so the confirmation is the glyph: the
                    // share arrow becomes a check for the same 2s.
                    <AnimatePresence mode='wait' initial={false}>
                        <motion.span
                            key={copied ? 'copied' : 'share'}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={swapFade}
                            className='grid place-items-center'>
                            <Image
                                src={
                                    copied
                                        ? '/icons/filters/check-deep.svg'
                                        : '/icons/share-outline.svg'
                                }
                                alt=''
                                width={24}
                                height={24}
                                className={iconClass}
                            />
                        </motion.span>
                    </AnimatePresence>
                ) : (
                    <>
                        <Image
                            src='/icons/share-outline.svg'
                            alt=''
                            width={24}
                            height={24}
                            className={iconClass}
                        />
                        <AnimatePresence mode='wait' initial={false}>
                            <motion.span
                                key={copied ? 'copied' : 'share'}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={swapFade}>
                                {copied ? dict.linkCopied : dict.share}
                            </motion.span>
                        </AnimatePresence>
                    </>
                )}
            </motion.button>
        </div>
    );
}
