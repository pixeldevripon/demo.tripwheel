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
            className='inline-flex cursor-pointer items-center gap-2 rounded-it-full bg-it-white px-3 py-2.5 transition-opacity hover:opacity-90 active:opacity-75 xl:px-4 xl:py-3'>
            <Image
                src='/icons/share-outline.svg'
                alt=''
                width={24}
                height={24}
                className='size-5 shrink-0 xl:size-6'
            />
            <span className='font-medium text-[14px] xl:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                {label}
            </span>
        </button>
    );
}
