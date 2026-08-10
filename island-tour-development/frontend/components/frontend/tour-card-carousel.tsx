'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { springPop } from '@/lib/motion';

/**
 * Shared card image carousel - the image area of every tour card variant
 * (shared TourCard, ranked collection card, hub trips card, hub pick card).
 *
 * ONE signifier rule, sitewide (S4j handoff, 2026-08-06; mobile card decision
 * DIT-20). The previous version revealed BOTH the dots and the arrows on
 * hover only, so a card at rest gave no signal that more photos existed - and
 * carousel research is unambiguous that undiscoverable galleries are dead
 * weight. The rule, in two volumes:
 *
 * - REST: the dots are always visible but QUIET - small uniform circles (5px,
 *   6px active), the row at 60% opacity with a soft shadow so it stays
 *   readable on bright water photos. No chevrons at rest.
 * - HOVER, or keyboard focus on a control inside the card: the dots go full
 *   strength and the chevrons fade in (120ms).
 * - Chevrons are position-aware and never wrap: no left arrow on the first
 *   photo, no right arrow on the last slide.
 * - TOUCH (`pointer-coarse`): no chevrons at all. Swipe is the interaction -
 *   the slides live in a native CSS scroll-snap track - and the always-on
 *   quiet dots are the signal that there is more. The card link plus the full
 *   gallery on the tour page is the single-pointer path (WCAG 2.5.1), so the
 *   swipe needs no on-card button alternative.
 * - LAST SLIDE (when the tour has a teaser): the description slide - title,
 *   shortDescription and a "full details" line on the warm peach surface. On
 *   it the dots recolor for the light background (ink idle, CTA-orange
 *   active) and lose the shadow.
 * - Reduced motion: chevron clicks jump instantly instead of smooth-scrolling;
 *   the snap itself is native CSS and stays.
 *
 * No carousel library: the chevrons just drive the same scroll-snap track the
 * finger does, and the scroll offset is the single source of truth for the
 * active index. PHOTOS are capped at MAX_SLIDES; the description slide is
 * additional (5 photos + description = 6 slides). Photos are lazy-loaded
 * (next/image default; only `priority` promotes the first). The chevrons are
 * real buttons with localized
 * aria-labels; the dots are aria-hidden indicators, not controls. Arrow
 * clicks preventDefault + stopPropagation, so a card that is one big link
 * never navigates on carousel interaction.
 *
 * Drop it inside a `relative overflow-hidden` image container (its background
 * is the sitewide image fallback) on a card that carries the `group` class -
 * hover/focus reveal keys off the CARD, matching the listing design.
 */
/*
 * Control sizing.
 *
 * The full-size values are the BASE and the narrow ones are `@max-[219px]`
 * overrides, deliberately that way round. Only some of the cards that use this
 * carousel put an `@container` on the image area; where there is no container
 * to measure, a container query simply never matches - so writing it as
 * "shrink below 220px" leaves those cards exactly as they are, while writing it
 * as "grow above 220px" would have silently shrunk them everywhere.
 *
 * 32px arrows with 16px insets eat 96px of a 144px mobile row-card photo, which
 * is what the founder flagged (2026-08-05). The S4j dots (5/6px circles) are
 * small enough to need no narrow override.
 */
const INSET = 'inset-x-4 @max-[219px]:inset-x-1.5';
const ARROW =
    'pointer-events-auto flex size-8 @max-[219px]:size-[26px] cursor-pointer items-center justify-center rounded-full border-none bg-it-white shadow-it-sm transition-colors duration-300 hover:bg-it-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-it-primary';
const ARROW_ICON = 'size-6 @max-[219px]:size-[18px]';

/** Contract cap: five PHOTOS max, whatever the backend sends. The description
 *  slide rides on top of the cap - it is information, not another photo. */
const MAX_SLIDES = 5;

export function TourCardCarousel({
    images,
    alt,
    sizes,
    priority = false,
    prevAria,
    nextAria,
    descSlide,
    scrim = false,
}: {
    /** Hero-first image URL set (the backend caps it at 5; sliced defensively). */
    images: string[];
    /** Base alt text - the active index is appended for multi-image sets. */
    alt: string;
    /** `next/image` responsive sizes for the card's grid slot. */
    sizes?: string;
    /** Mark the first image as LCP-priority (above-fold carousels). */
    priority?: boolean;
    /** Localized chevron labels (`destination.listings.prevPhotoAria` / `nextPhotoAria`). */
    prevAria: string;
    nextAria: string;
    /**
     * The description slide (S4j / master 3.5: "photos plus a description
     * slide"), rendered LAST: the displayed card title, the tour's
     * `shortDescription` teaser, and the localized "Full details on the tour
     * page" line. Omit it (no teaser in the data) and the carousel is photos
     * only.
     */
    descSlide?: { title: string; description: string; linkLabel: string };
    /**
     * Render the design-v2 bottom scrim (`--it-scrim-tile`) over each PHOTO.
     * Lives here, per slide, rather than as the card's own overlay so the
     * description slide's paper surface stays clean. Off by default - the hub
     * pick card never had a scrim.
     */
    scrim?: boolean;
}) {
    const track = useRef<HTMLDivElement>(null);
    const [index, setIndex] = useState(0);
    const photos = images.slice(0, MAX_SLIDES);
    const count = photos.length + (descSlide ? 1 : 0);
    const many = count > 1;
    /** On the light description slide the dots swap to their ink/orange scheme. */
    const onDesc = descSlide !== undefined && index === count - 1;

    /* The scroll offset is the single source of truth for the active index -
       a swipe and a chevron click land in the same place, so the dots and the
       position-aware chevrons can never disagree with what is on screen. */
    const syncIndex = () => {
        const el = track.current;
        if (!el || el.clientWidth === 0) return;
        setIndex(
            Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth)))
        );
    };

    const step = (dir: 1 | -1) => (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const el = track.current;
        if (!el || el.clientWidth === 0) return;
        /* Read the position from the track, not from state - mid-scroll clicks
           would otherwise step from a stale index. No wrap: the ends clamp. */
        const current = Math.round(el.scrollLeft / el.clientWidth);
        const next = Math.min(count - 1, Math.max(0, current + dir));
        el.scrollTo({
            left: next * el.clientWidth,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                ? 'auto'
                : 'smooth',
        });
    };

    if (photos.length === 0) return null;

    return (
        <>
            {/* Slide track - native scroll-snap, so touch swipes it directly.
                `overscroll-x-contain` keeps an end-of-track swipe from turning
                into the browser's back gesture. */}
            <div
                ref={track}
                onScroll={syncIndex}
                className='absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
                {photos.map((src, i) => (
                    /* `overflow-hidden` is load-bearing: the cards zoom every
                       img to 1.03 on hover (design v2). Unclipped, the scaled
                       photo paints past its slide - the NEXT photo's edge
                       shows as a sliver and the first photo reads as shoved
                       left - and it extends the snap container's scrollable
                       overflow, letting the browser re-snap to a position
                       that is not a slide boundary. Clipped, the transform
                       can never touch the scroll geometry. */
                    <div
                        key={i}
                        className='relative h-full w-full flex-none snap-start overflow-hidden'>
                        <Image
                            src={src}
                            alt={many ? `${alt} - view ${i + 1}` : alt}
                            fill
                            sizes={sizes}
                            className='object-cover'
                            priority={priority && i === 0}
                        />
                        {scrim && (
                            <div className='pointer-events-none absolute inset-0 bg-[image:var(--it-scrim-tile)]' />
                        )}
                    </div>
                ))}
                {descSlide && (
                    <div className='flex h-full w-full flex-none snap-start flex-col justify-center gap-2 overflow-hidden bg-it-peach px-[18px] pb-5 pt-11 @max-[219px]:gap-[5px] @max-[219px]:px-3.5 @max-[219px]:pb-7 @max-[219px]:pt-[34px]'>
                        <p className='m-0 text-[15px] font-bold leading-[1.3] text-it-ink line-clamp-2 @max-[219px]:text-[13px]'>
                            {descSlide.title}
                        </p>
                        <p className='m-0 text-[13px] leading-[1.55] text-it-text-muted line-clamp-3 @max-[219px]:text-[11.5px] @max-[219px]:leading-[1.45]'>
                            {descSlide.description}
                        </p>
                        {/* Deliberately NOT an anchor: the card itself is the
                            one link (S4j #5), this line just says where it goes. */}
                        <p className='m-0 text-[11.5px] font-bold text-it-primary-hover @max-[219px]:text-[10.5px]'>
                            {descSlide.linkLabel}
                        </p>
                    </div>
                )}
            </div>

            {/* Prev/next chevrons - hidden at rest, revealed on card hover or
                keyboard focus within the card (120ms), and not rendered at all
                for touch (`pointer-coarse`), where swipe is the interaction.
                Position-aware: each end renders a spacer instead of an arrow,
                so the survivor keeps its side under `justify-between`. */}
            {many && (
                <div
                    className={`pointer-events-none absolute top-1/2 z-10 flex -translate-y-1/2 items-center justify-between opacity-0 transition-opacity duration-(--it-duration-xs) group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:hidden ${INSET}`}>
                    {index > 0 ? (
                        <motion.button
                            type='button'
                            onClick={step(-1)}
                            aria-label={prevAria}
                            whileTap={{ scale: 0.9 }}
                            transition={springPop}
                            className={ARROW}>
                            <Image
                                src='/icons/arrow-right-listings.svg'
                                alt=''
                                width={24}
                                height={24}
                                className={ARROW_ICON}
                                aria-hidden='true'
                            />
                        </motion.button>
                    ) : (
                        <span aria-hidden='true' />
                    )}
                    {index < count - 1 ? (
                        <motion.button
                            type='button'
                            onClick={step(1)}
                            aria-label={nextAria}
                            whileTap={{ scale: 0.9 }}
                            transition={springPop}
                            className={ARROW}>
                            <Image
                                src='/icons/arrow-right-listings.svg'
                                alt=''
                                className={`rotate-180 ${ARROW_ICON}`}
                                width={24}
                                height={24}
                                aria-hidden='true'
                            />
                        </motion.button>
                    ) : (
                        <span aria-hidden='true' />
                    )}
                </div>
            )}

            {/* Pagination dots - ALWAYS visible: quiet (60% + soft shadow, so
                they read on bright water photos) at rest, full strength on
                hover/focus. On touch this quiet row is the standing signal
                that the photo swipes. S4j geometry: uniform 5px circles, the
                active one 6px - recolored (ink/orange, no shadow) on the light
                description slide. */}
            {many && (
                <div
                    aria-hidden='true'
                    className={`pointer-events-none absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 opacity-60 transition-opacity duration-(--it-duration-xs) group-hover:opacity-100 group-focus-within:opacity-100 ${
                        onDesc ? '' : 'drop-shadow-[0_1px_2px_var(--it-scrim-dark)]'
                    }`}>
                    {Array.from({ length: count }, (_, i) => (
                        <span
                            key={i}
                            className={`rounded-full transition-[width,height,background-color] duration-200 ease-in-out ${
                                i === index
                                    ? `size-1.5 ${onDesc ? 'bg-it-primary-hover' : 'bg-it-white'}`
                                    : `size-1.25 ${onDesc ? 'bg-it-ink/28' : 'bg-it-white/60'}`
                            }`}
                        />
                    ))}
                </div>
            )}
        </>
    );
}
