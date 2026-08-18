'use client';

import { MotionLink } from '@/components/frontend/motion-link';
import { MountReveal } from '@/components/frontend/mount-reveal';
import { useBooking } from '@/hooks/tours/use-booking';
import {
    getDeadEndAlternatives,
    type TourAlternative,
} from '@/lib/api/tours-alternatives';
import { isLocale, localizeHref, type Locale } from '@/lib/constants/locales';
import { resolveDisplayPrice } from '@/lib/currency/current';
import { springPop } from '@/lib/motion';
import { pushAvailabilityDeadEnd } from '@/lib/tracking/availability-dead-end';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { formatSelectedDate } from './lib/booking.utils';

/**
 * All-sold-out recovery (AVAILABILITY-AND-DEPARTURES.md §8).
 *
 * When the tour has no open departure in the next 30 days, the widget stops
 * presenting a calendar the traveller cannot use and offers 2-3 same-category
 * tours in the same destination that still have room this week. The headline is
 * LOCKED copy from the spec - it is a promise about what the rows below it are,
 * so it is a dictionary string in all 7 locales, never per-tour prose.
 *
 * `notify-me` is v2 (conflict log 77). v1 recovers through alternatives only,
 * which is why there is no email capture here and no `availability_notifications`
 * table behind it.
 */
export function AvailabilityDeadEnd() {
    const { dict, locale, tourId, tourSlug, destinationSlug, currency } =
        useBooking();
    const [alternatives, setAlternatives] = useState<TourAlternative[] | null>(
        null
    );

    const tourLocale: Locale = isLocale(locale) ? locale : 'en';

    useEffect(() => {
        if (!tourId) return;
        const controller = new AbortController();
        getDeadEndAlternatives(tourId, tourLocale, currency, controller.signal)
            .then(setAlternatives)
            .catch(() => {
                if (controller.signal.aborted) return;
                // A failed recovery is still a dead end - fall through to the
                // headline-only state rather than showing an error the traveller
                // can do nothing about.
                setAlternatives([]);
            });
        return () => controller.abort();
    }, [tourId, tourLocale, currency]);

    // Silent monitoring event, fired once the recovery has resolved so the
    // payload can carry how many alternatives the destination actually had.
    // Zero is the interesting case and must still be reported.
    useEffect(() => {
        if (!tourId || alternatives == null) return;
        pushAvailabilityDeadEnd({
            tourId,
            tourSlug,
            destinationSlug,
            alternativeCount: alternatives.length,
        });
    }, [tourId, tourSlug, destinationSlug, alternatives]);

    return (
        <div className='flex flex-col gap-3 pb-4'>
            <div className='flex flex-col gap-1'>
                <span className='font-medium text-[16.5px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                    {dict.deadEndTitle}
                </span>
                <span className='text-[14.5px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                    {dict.deadEndSubtitle}
                </span>
            </div>

            {alternatives == null ? (
                // Three placeholder rows at the real row height, so the card
                // does not jump when the fetch lands.
                <div aria-busy className='flex animate-pulse flex-col gap-2'>
                    {[0, 1, 2].map(i => (
                        <div
                            key={i}
                            className='h-[72px] rounded-[12px] bg-it-white'
                        />
                    ))}
                </div>
            ) : alternatives.length === 0 ? (
                <span className='text-[14.5px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                    {dict.deadEndNoAlternatives}
                </span>
            ) : (
                <ul className='m-0 flex list-none flex-col gap-2 p-0'>
                    {alternatives.map(alt => (
                        <AlternativeRow
                            key={alt.id}
                            alt={alt}
                            locale={tourLocale}
                            nextLabel={dict.deadEndNext}
                        />
                    ))}
                </ul>
            )}
        </div>
    );
}

/**
 * One alternative: thumbnail, title, a meta line (rating + the date it is next
 * open), and its price.
 */
function AlternativeRow({
    alt,
    locale,
    nextLabel,
}: {
    alt: TourAlternative;
    locale: Locale;
    nextLabel: string;
}) {
    const { priceDisplay } = resolveDisplayPrice(alt, locale);
    // `yyyy-MM-dd` is a plain calendar date with no zone - parse it as local
    // parts so it never renders as the previous day west of UTC.
    const next = alt.nextAvailableDate
        ? formatSelectedDate(
              (([y, m, d]) => new Date(y, m - 1, d))(
                  alt.nextAvailableDate.split('-').map(Number) as [
                      number,
                      number,
                      number,
                  ]
              ),
              locale
          )
        : null;

    // A tour with no reviews yet shows no rating at all - "0.0 (0)" reads as a
    // bad score rather than as an absent one.
    const isRated = alt.aggregateRating != null && alt.aggregateReviewCount > 0;

    const href = alt.destinationSlug
        ? localizeHref(locale, `/${alt.destinationSlug}/${alt.slug}`)
        : null;
    if (!href) return null;

    return (
        <li>
            {/* MountReveal (not Reveal): the rows are inserted after the fetch
                lands, already inside the viewport, where a scroll-triggered
                reveal can miss its trigger and leave them invisible.
                `listItem` so all three share ONE delay instead of cascading by
                index, and phones render them statically. It nests INSIDE the
                <li> - a wrapper div between <ul> and <li> is invalid markup. */}
            <MountReveal listItem yOffset={8} duration={0.35}>
                <MotionLink
                    href={href}
                    whileTap={{ scale: 0.98 }}
                    transition={springPop}
                    className='flex items-center gap-3 rounded-[12px] bg-it-white p-2 no-underline transition-colors duration-300 hover:bg-it-surface'>
                    <span className='relative size-14 shrink-0 overflow-hidden rounded-[8px] bg-it-border'>
                        {alt.images[0]?.url && (
                            <Image
                                src={alt.images[0].url}
                                alt=''
                                fill
                                sizes='56px'
                                className='object-cover'
                            />
                        )}
                    </span>
                    <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
                        <span className='truncate font-medium text-[14px] leading-[1.4] tracking-[-0.012em] text-it-heading'>
                            {alt.title}
                        </span>
                        {/* Meta line: rating first (it is what makes an
                            alternative worth switching to), then the date it is
                            next open (which is why it is offered at all). */}
                        <span className='flex min-w-0 items-center gap-1.5 text-[12px] leading-[1.4] tracking-[-0.012em] text-it-text-muted'>
                            {isRated && (
                                <>
                                    <span className='flex shrink-0 items-center gap-1'>
                                        <Image
                                            src='/icons/star-listings.svg'
                                            alt=''
                                            width={16}
                                            height={16}
                                            className='size-3.5 shrink-0'
                                            // Card chrome in the sticky rail -
                                            // it must not queue behind the
                                            // page's lazy images.
                                            loading='eager'
                                        />
                                        <span className='text-it-heading/70 tracking-[-0.012em]'>
                                            {alt.aggregateRating?.toFixed(1)}
                                        </span>
                                        <span className='text-it-heading/50 tracking-[-0.012em]'>
                                            (
                                            {new Intl.NumberFormat(
                                                locale
                                            ).format(alt.aggregateReviewCount)}
                                            )
                                        </span>
                                    </span>
                                    {next && (
                                        <span
                                            aria-hidden
                                            className='shrink-0 text-it-heading/30 tracking-[-0.012em]'>
                                            &middot;
                                        </span>
                                    )}
                                </>
                            )}
                            {next && (
                                <span className='truncate'>
                                    {nextLabel.replace('{date}', next)}
                                </span>
                            )}
                        </span>
                    </span>
                    <span className='shrink-0 font-medium text-[14px] leading-[1.4] tracking-[-0.012em] text-it-heading'>
                        {priceDisplay}
                    </span>
                </MotionLink>
            </MountReveal>
        </li>
    );
}

