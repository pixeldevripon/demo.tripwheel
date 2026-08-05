'use client';

import { useBooking } from '@/hooks/tours/use-booking';
import type { BookingNoticeKind } from '@/lib/tours/booking';
import Image from 'next/image';

/**
 * The notice cards stacked beneath the booking card (master §3.6 / §3.7).
 *
 * Was `sell-out-notice.tsx`, which rendered "Likely to sell out"
 * UNCONDITIONALLY - every tour page claimed scarcity whether or not the demand
 * signal was true. The layout is byte-for-byte the original; the change is that
 * a card now appears only when the tour has earned it, and that two more
 * signals can appear in the same shape.
 */

/** Icon + copy per notice. All three read from the shared booking dict. */
const NOTICE_ICON: Record<BookingNoticeKind, { src: string; size: number }> = {
    // The flame, unchanged.
    likelyToSellOut: { src: '/icons/sell-out.svg', size: 24 },
    // Same flame as the sell-out card (user decision 2026-07-21). It was
    // `star-listings.svg`, whose 16px intrinsic export looked thin scaled up to
    // the 24px the other notices sit at. Keep both pointing here until a
    // dedicated 24px Figma icon exists.
    mostPopular: { src: '/icons/sell-out.svg', size: 24 },
    // Instant confirmation (master 6.1). Deliberately NOT a trust-strip line
    // (LD5 locks the strip to exactly two); the green check the trust lines use
    // is the honest glyph for "confirmed the moment payment completes".
    instantConfirmation: { src: '/icons/booking-check.svg', size: 20 },
    // PLACEHOLDER - there is no "sponsored"/disclosure glyph in public/icons/
    // and a Figma icon must never be substituted with a lucide stand-in, so this
    // borrows the closest informational one. Swap in the real export when it
    // exists; nothing else about the card needs to change.
    sponsored: { src: '/icons/tip-bulb.svg', size: 24 },
};

function BookingNotice({ kind }: { kind: BookingNoticeKind }) {
    const { dict } = useBooking();
    const icon = NOTICE_ICON[kind];
    const copy = {
        likelyToSellOut: {
            title: dict.sellOutTitle,
            subtitle: dict.sellOutSubtitle,
        },
        mostPopular: {
            title: dict.mostPopularTitle,
            subtitle: dict.mostPopularSubtitle,
        },
        instantConfirmation: {
            title: dict.instantConfirmationTitle,
            subtitle: dict.instantConfirmationSubtitle,
        },
        sponsored: {
            title: dict.sponsoredTitle,
            subtitle: dict.sponsoredSubtitle,
        },
    }[kind];

    return (
        // `shrink-0`: the strip below scrolls as a whole when the rail is
        // squeezed, so an individual notice must keep its own height rather
        // than squashing its two lines of text.
        <div className='flex shrink-0 items-start gap-[11px] rounded-it-md border border-it-primary/30 bg-it-white px-4 py-3.5'>
            <Image
                src={icon.src}
                alt=''
                width={icon.size}
                height={icon.size}
                className='mt-0.5 size-[18px] shrink-0'
                // Booking-card chrome: these sit beside the CTA in the sticky
                // rail and are on screen for the whole scroll, so waiting in
                // the lazy queue behind the page's ~190 images left the notices
                // rendering as text with a blank gap where the glyph belongs.
                // `eager`, not `priority` - no preload link, so nothing
                // competes with the gallery LCP.
                loading='eager'
            />
            <div className='flex flex-col gap-0.5'>
                <span className='text-[14px] font-bold leading-[1.5] text-it-ink'>
                    {copy.title}
                </span>
                <span className='text-[12.5px] leading-[1.5] text-it-text-muted'>
                    {copy.subtitle}
                </span>
            </div>
        </div>
    );
}

/** Renders nothing when the tour has earned no notices - the common case. */
export function BookingNotices() {
    const { data } = useBooking();
    if (data.notices.length === 0) return null;
    return (
        // `shrink-0`, and deliberately NOT a scroll container. Inside the
        // capped sticky rail the card is the only thing that scrolls: it holds
        // the interaction, so it takes the whole squeeze (down to its own
        // floor). These notices are static reassurance copy - giving them a
        // second scrollbar to reach the last line reads as broken, and clipping
        // them mid-sentence reads worse. They keep their full height and simply
        // sit where they land.
        <div className='flex shrink-0 flex-col gap-3.5'>
            {data.notices.map(kind => (
                <BookingNotice key={kind} kind={kind} />
            ))}
        </div>
    );
}

