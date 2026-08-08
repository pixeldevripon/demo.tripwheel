'use client';

import Image from 'next/image';

/**
 * Share control for the collection hero (Figma node 47433:2069 - the white pill).
 * Uses the Web Share API when available (mobile / supported browsers) and falls
 * back to copying the current URL to the clipboard.
 *
 * Isolated as the single `'use client'` leaf so <CollectionHero> can stay a pure
 * Server Component.
 */
export function CollectionShareButton({ label }: { label: string }) {
    const handleShare = () => {
        if (typeof window === 'undefined') return;
        const url = window.location.href;
        if (navigator.share) {
            navigator.share({ title: document.title, url }).catch(() => null);
        } else {
            navigator.clipboard?.writeText(url).catch(() => null);
        }
    };

    return (
        <button
            type='button'
            onClick={handleShare}
            aria-label={label}
            className='inline-flex cursor-pointer items-center gap-[7px] rounded-it-full border border-it-border bg-it-white/92 px-[15px] py-[9px] shadow-it-sm transition-transform duration-(--it-duration-xs) ease-(--it-ease) hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-it-primary'>
            <Image
                src='/icons/share-outline.svg'
                alt=''
                width={24}
                height={24}
                className='size-[15px] shrink-0'
            />
            <span className='text-[13px] font-bold leading-[1.4] text-it-ink'>
                {label}
            </span>
        </button>
    );
}

