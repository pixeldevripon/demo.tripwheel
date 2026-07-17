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
 * The tour header's Save / Share pair - the header's only interactive portion,
 * isolated as the client leaf (the header itself stays a server component).
 *
 * Save toggles the wishlist (guests are routed to /login by the provider) and
 * fills the heart while saved. Share opens the native share sheet where the
 * browser has one; otherwise it copies the URL and swaps the label to a brief
 * "Link copied" confirmation.
 */
export function TourHeaderActions({
    tourId,
    title,
    dict,
}: {
    tourId: string;
    /** Tour title - the share sheet's headline. */
    title: string;
    dict: TourHeaderActionsDict;
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

    // Plain text buttons: no pill, background, or container border - icon + label
    // with an underline (border-bottom) under the label only.
    const actionClass =
        'inline-flex cursor-pointer items-center gap-2 border-none bg-transparent p-0 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading transition-colors duration-300 hover:text-it-primary';
    const actionLabel = 'underline decoration-1.5 underline-offset-2';

    return (
        <div className='flex shrink-0 items-center gap-6'>
            <motion.button
                type='button'
                aria-pressed={saved}
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
                    className='size-6 shrink-0'
                />
                <span className={actionLabel}>{dict.save}</span>
            </motion.button>
            <motion.button
                type='button'
                onClick={share}
                whileTap={{ scale: 0.97 }}
                transition={springPop}
                className={actionClass}>
                <Image
                    src='/icons/share-outline.svg'
                    alt=''
                    width={24}
                    height={24}
                    className='size-6 shrink-0'
                />
                <AnimatePresence mode='wait' initial={false}>
                    <motion.span
                        key={copied ? 'copied' : 'share'}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={swapFade}
                        className={actionLabel}>
                        {copied ? dict.linkCopied : dict.share}
                    </motion.span>
                </AnimatePresence>
            </motion.button>
        </div>
    );
}
