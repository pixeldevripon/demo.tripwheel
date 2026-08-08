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
 * a card now appears only when the tour has earned it.
 *
 * The stack once held two more cards, both removed by the client (Pastel
 * #52/#53): Instant confirmation, which repeated a page-level claim the trust
 * strip already makes and which LD5 names as an exclusion, and the Sponsored
 * disclosure, which belongs beside a ranked position and has none here. The
 * slot is the demand card's; see `deriveBookingNotices`.
 */

/** Icon + copy per notice. Both read from the shared booking dict. */
const NOTICE_ICON: Record<BookingNoticeKind, { src: string; size: number }> = {
    // The flame, unchanged.
    likelyToSellOut: { src: '/icons/sell-out.svg', size: 24 },
    // Same flame as the sell-out card (user decision 2026-07-21). It was
    // `star-listings.svg`, whose 16px intrinsic export looked thin scaled up to
    // the 24px the other notices sit at. Keep both pointing here until a
    // dedicated 24px Figma icon exists.
    mostPopular: { src: '/icons/sell-out.svg', size: 24 },
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
    }[kind];

    return (
        // White card, brand-orange border at 30% - master §5.7 locks this for
        // the demand card: never red, never animated, and a plain <div> because
        // it is not clickable in v1.
        //
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
    // Returning null rather than an empty stack: the parent lays these out with
    // `gap-3.5`, which an empty child still collects as a dead band under the
    // card.
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
