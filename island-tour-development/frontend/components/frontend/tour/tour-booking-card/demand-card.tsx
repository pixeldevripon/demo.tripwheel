'use client';

import { useBooking } from '@/hooks/tours/use-booking';
import Image from 'next/image';

/**
 * The demand card - master §5.7, the ONLY thing that renders below the booking
 * widget. Copy, icon and styling are locked there: headline "Likely to sell
 * out", line "Book today to secure your spot.", flame SVG, white card,
 * brand-orange border at 30%, never red, never animated, not clickable in v1.
 *
 * It was `sell-out-notice.tsx`, which rendered unconditionally - every tour page
 * claimed scarcity whether or not the demand signal was true. Then it was
 * `booking-notices.tsx`, a stack of up to four cards. The client emptied the
 * stack back down to this one (Pastel #52/#53):
 *
 *  - Instant confirmation - a page-level claim the All Tours trust strip already
 *    makes as "Confirmed in seconds"; LD5 names it as an exclusion and conflict
 *    log 42 had already rejected it here once.
 *  - Sponsored - discloses a paid POSITION inside a ranked list, and a tour's own
 *    page has no position to disclose. It stays on the listing cards.
 *  - Most popular - a §3.6 LISTING-CARD badge (max one per category), never part
 *    of §5.7. The page already carries the real rating in the meta row, a review
 *    preview module and a full Reviews section, so as a card here it was badge
 *    inflation - the thing pillar 2 (Ethical CRO) exists to prevent.
 *
 * Which leaves the slot doing one job. The gate is `data.showDemandCard`
 * (`likelyToSellOutOverride ?? likelyToSellOut`, master §3.7): ~5-10% of the
 * catalog, and on most tours this renders nothing at all. That is the feature -
 * a card every tour carries stops meaning anything, and on a page where nine
 * boats go to the same island it would show on all nine.
 */
export function DemandCard() {
    const { dict, data } = useBooking();
    if (!data.showDemandCard) return null;

    return (
        // A plain <div>: not clickable in v1, so it must not be a button or a
        // link. `shrink-0` because the rail squeeze belongs to the card above -
        // this holds no interaction and must not lose its second line to it.
        <div className='flex shrink-0 items-start gap-[11px] rounded-it-md border border-it-primary/30 bg-it-white px-4 py-3.5'>
            <Image
                src='/icons/sell-out.svg'
                alt=''
                width={24}
                height={24}
                className='mt-0.5 size-[18px] shrink-0'
                // Booking-card chrome: this sits beside the CTA in the sticky
                // rail and is on screen for the whole scroll, so waiting in the
                // lazy queue behind the page's ~190 images left the card
                // rendering as text with a blank gap where the flame belongs.
                // `eager`, not `priority` - no preload link, so nothing competes
                // with the gallery LCP.
                loading='eager'
            />
            <div className='flex flex-col gap-0.5'>
                <span className='text-[13px] font-medium leading-[1.5] text-it-heading tracking-[-0.012em]'>
                    {dict.sellOutTitle}
                </span>
                <span className='text-[11.5px] leading-[1.5] text-it-text-muted tracking-[-0.012em]'>
                    {dict.sellOutSubtitle}
                </span>
            </div>
        </div>
    );
}
