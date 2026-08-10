'use client';

/**
 * Shared tour card primitives - reusable across Destination Listings,
 * Search Results, Home Page carousels, and any future tour grid/list.
 *
 * Usage:
 *   import { TourCard, BadgeChip } from '@/components/frontend/tour-card';
 *   import type { TourListing, TourCardDict } from '@/components/frontend/tour-card';
 */

import { useWishlist } from '@/components/frontend/wishlist-provider';
import type { Currency } from '@/lib/constants/locales';
import { springPop } from '@/lib/motion';
import type { PriceUnitKey } from '@/lib/tours/pricing-label';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { TourBadgeChip, type TourBadge } from './tour-badge';
import { TourCardCarousel } from './tour-card-carousel';

// ── Dictionary type ─────────────────────────────────────────────────────────
export type TourCardDict = {
    new: string;
    likelyToSellOut: string;
    mostPopular: string;
    sponsored: string;
    /**
     * Heart aria-labels, carrying `{title}`.
     *
     * They used to be hardcoded English on every card on every surface, in all
     * seven locales - the one piece of card copy a sighted visitor never sees,
     * which is exactly why it survived six languages of review.
     */
    saveAria: string;
    removeAria: string;
    /** Carousel chevron aria-labels (S4j) - "Previous photo" / "Next photo". */
    prevPhotoAria: string;
    nextPhotoAria: string;
    /** The description slide's closing line - "Full details on the tour page". */
    fullDetails: string;
    pickupAvailable: string;
    freeCancellation: string;
    priceVaries: string;
    from: string;
    per: string;
    perGroup: string;
    perBoat: string;
    perVehicle: string;
    perAircraft: string;
    perPackage: string;
};

// ── Data types ──────────────────────────────────────────────────────────────
// Master §3.6 badge set (the single badge in the card's top-left slot). Derived
// by the backend `deriveTourBadge` and passed through unchanged - full logic in
// technical-doc/03-implementation/TOUR-BADGES.md. The type + chip UI live in the
// shared, self-contained `./tour-badge` module (reused by the dashboard).
export type { TourBadge };

export type TourListing = {
    id: string;
    /**
     * Flat tour detail URL (locale-prefixed, e.g. `/en/curacao/{slug}`). When
     * set, the whole card becomes a link to the tour page. Built by the data
     * source (the inner wishlist / gallery controls stop propagation so they
     * never trigger navigation).
     */
    href?: string;
    /** Hero-first image set for the card carousel (quiet dots always, S4j). */
    images: string[];
    /**
     * Card teaser (≤160 chars) - the carousel's description slide (S4j #4).
     * The backend derives it (`shortDescription`, else an overview excerpt);
     * null/absent means the carousel is photos only.
     */
    shortDescription?: string | null;
    badge: TourBadge;
    /** Omit to hide the star-rating row entirely */
    rating?: number;
    reviewCount?: number;
    title: string;
    /**
     * The tour's activity hub, when it has one - rendered as the card's
     * "eyebrow" above the title (master 3.5, "Title and hub context").
     *
     * OMITTED, not falsy-checked, to suppress it: the hub page builds its own
     * listings and simply leaves this unset, because the context is already
     * implicit there. No hub means no eyebrow.
     */
    hub?: { name: string; slug: string } | null;
    /** e.g. "3 hours", "Full day" */
    duration: string;
    pickupAvailable: boolean;
    price: number;
    /** Display currency of `price`/`priceDisplay` (from the backend `money` object). */
    currency: Currency;
    /** Localized formatted "From" price incl. currency symbol, e.g. "$120" / "120 €". */
    priceDisplay: string;
    /** Price-unit i18n key: 'per' (per person) or a per-unit_type key ('perBoat' …). */
    priceUnit: PriceUnitKey;
    priceVaries?: boolean;
    freeCancellation?: boolean;
    /**
     * When set (1-based), the card renders the ranked collection variant
     * (Figma node 47433:2088): a surface card with a numbered badge, a short
     * description line, and a combined "duration · From $price" row. The image
     * carousel and wishlist button are omitted in this variant.
     */
    rank?: number;
    /** Short 1-2 line blurb - shown only in the ranked variant. */
    description?: string;
};

/**
 * The hub "eyebrow" - a small pill naming the tour's activity hub, sitting
 * above the title (master 3.5, "Title and hub context"; LD15).
 *
 * Spec straight from mck-10 `.tc .eyebrow`: white pill, peach hairline, pill
 * radius, 11.5px/700 in the deep CTA orange, with a 12px pin stroked in the CTA
 * orange.
 */
function HubEyebrow({ name }: { name: string }) {
    return (
        <span className='inline-flex w-max items-center gap-[5px] rounded-it-full border border-it-peach-border bg-it-white py-[3px] pl-2 pr-2.5 text-[11.5px] font-bold leading-none text-it-primary-hover shadow-it-sm'>
            <MapPin
                className='size-3 shrink-0 text-it-primary'
                strokeWidth={2}
                aria-hidden='true'
            />
            {name}
        </span>
    );
}

// ── BadgeChip ───────────────────────────────────────────────────────────────
interface BadgeChipProps {
    type: TourBadge;
    dict: Pick<
        TourCardDict,
        'new' | 'likelyToSellOut' | 'mostPopular' | 'sponsored'
    >;
    className?: string;
}

export function BadgeChip({ type, dict, className = '' }: BadgeChipProps) {
    if (!type) return null;
    // Localized label for this badge; the color/shape/sizing live in the shared chip.
    const label =
        type === 'sponsored'
            ? dict.sponsored
            : type === 'new'
              ? dict.new
              : type === 'likelyToSellOut'
                ? dict.likelyToSellOut
                : dict.mostPopular;

    return (
        <TourBadgeChip
            type={type}
            label={label}
            size='responsive'
            className={className}
        />
    );
}

// ── TourCard ────────────────────────────────────────────────────────────────
export interface TourCardProps {
    tour: TourListing;
    dict: TourCardDict;
    className?: string;
    /**
     * Intercept the wishlist heart instead of toggling the store directly.
     *
     * The saved tours page uses it: removing there is not a bare toggle but a
     * collapse plus a snackbar offering Undo, and the page owns both. Every
     * other surface leaves it unset and the heart toggles as it always has.
     */
    onWishlistToggle?: (tourId: string) => void;
    /**
     * A muted line under the price - the saved page's price-integrity note
     * ("Was $79 when you saved it"). Rendered verbatim, no styling opinion
     * beyond muted small text, because mck-17 is explicit that it carries no
     * color and no animation in either direction.
     */
    priceNote?: string;
    /**
     * The date-check answer for this card: whether the tour can be booked on
     * the day the traveller asked about, and the localized label for it.
     * Omitted whenever no date is being checked.
     */
    availability?: { available: boolean; label: string };
    /**
     * Peach card (master §B.63 + design v2 .tc.peach): the warm surface with
     * its hairline border. Position-based, applied by the LISTING (card #1 of
     * All Tours / curated persona lists, default sort only) - never set it
     * from tour data. Since design v2 this renders identically to
     * `highlighted`; both exist so listings keep expressing WHY the card is
     * marked (tint rule vs top placement).
     */
    tinted?: boolean;
    /**
     * Top-placement card (design v2 .tc.peach): the listing passes it for its
     * FIRST card only. Renders the peach surface + peach hairline border.
     */
    highlighted?: boolean;
    /**
     * Eager-load this card's first image as an LCP candidate. POSITION-BASED,
     * like `tinted`/`highlighted`: only the grid knows which cards are above
     * the fold, so only the grid may set it - and only for its first ROW.
     *
     * Defaults to false deliberately. This used to be hardcoded on, so every
     * card on every surface emitted `<link rel=preload fetchpriority=high>` -
     * 12 competing preloads on a listing page, plus below-fold related-tour
     * grids on the tour and thank-you pages. That does not make the real LCP
     * element arrive sooner; it makes it arrive later, by splitting the early
     * connection budget across images nobody is looking at yet.
     */
    priority?: boolean;
    /**
     * Design v2 mobile layout (<sm): a horizontal row card - image 40%,
     * content 60% (mockup 3.5 locked mobile card). Opt-in per LISTING: only
     * grids that stack cards full-width on mobile may set it; carousel
     * surfaces keep the vertical card.
     */
    mobileRow?: boolean;
}

/**
 * Tour card dispatcher. Renders the ranked collection variant when `tour.rank`
 * is set (Figma 47433:2088), otherwise the standard listing card used across
 * Destination Listings, Search, and Home carousels.
 */
export function TourCard(props: TourCardProps) {
    if (props.tour.rank != null) return <RankedTourCard {...props} />;

    return <DefaultTourCard {...props} />;
}

function DefaultTourCard({
    tour,
    dict,
    className = '',
    onWishlistToggle,
    priceNote,
    availability,
    tinted = false,
    highlighted = false,
    priority = false,
    mobileRow = false,
}: TourCardProps) {
    const { isSaved, toggle } = useWishlist();
    const wishlisted = isSaved(tour.id);
    const isRated = tour.rating !== undefined;
    const priceLabel = dict[tour.priceUnit];
    // Design v2 .tc.peach: the highlighted (first) / tinted card sits on the
    // warm peach surface with its hairline border; every other card is white
    // and flat, lifting 2px with the card-hover shadow.
    const peach = highlighted || tinted;

    const card = (
        <article
            aria-label={tour.title}
            className={cn(
                // @container: the card adapts its own typography to its width -
                // compact at ~172px (mobile carousel), full size in wide cells.
                '@container group flex h-full flex-col overflow-hidden rounded-it-md border will-change-transform transition-all duration-(--it-duration-md) ease-(--it-ease) hover:-translate-y-0.5 hover:shadow-it-card-hover',
                peach
                    ? 'bg-it-peach border-it-peach-border'
                    : 'bg-it-white border-transparent hover:border-it-card-hover-border',
                // Uniform row height on mobile lists: shorter cards stretch
                // (the foot stays pinned), so the stack reads as equal rows.
                mobileRow &&
                    'max-sm:flex-row max-sm:border-it-divider max-sm:min-h-[170px]',
                className
            )}>
            {/* ── Image area ──────────────────────────────────────────────── */}
            <div
                className={cn(
                    // Mockup .tc .im: photo eases to 1.03 on card hover (260ms).
                    //
                    // Its own @container, so the badge and the heart size to
                    // the box they actually sit in. They were sizing off the
                    // CARD, which is right everywhere except the mobile row
                    // card - there the image is only 2/5 of the card, so both
                    // took their wide-cell size in a box far too narrow for it
                    // and the badge label got cut ("Likely to sell ou").
                    // Everywhere else the image IS the card's width, so this
                    // changes nothing.
                    '@container relative aspect-3/2 w-full shrink-0 overflow-hidden rounded-t-[12px] bg-it-bg [&_img]:transition-transform [&_img]:duration-(--it-duration-md) [&_img]:ease-(--it-ease) group-hover:[&_img]:scale-[1.03]',
                    mobileRow &&
                        'max-sm:w-2/5 max-sm:aspect-auto max-sm:rounded-l-[12px] max-sm:rounded-tr-none'
                )}>
                {/* The design-v2 bottom scrim rides inside the carousel, per
                    photo, so the description slide's paper surface stays clean. */}
                <TourCardCarousel
                    images={tour.images}
                    alt={tour.title}
                    sizes='(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 384px'
                    priority={priority}
                    prevAria={dict.prevPhotoAria}
                    nextAria={dict.nextPhotoAria}
                    scrim
                    descSlide={
                        tour.shortDescription
                            ? {
                                  title: tour.title,
                                  description: tour.shortDescription,
                                  linkLabel: dict.fullDetails,
                              }
                            : undefined
                    }
                />
                {/* Badge (top-left).
                    The inset tightens on a narrow image (the mobile row card):
                    10px of inset either side is a big share of a ~144px photo,
                    and it was the last few pixels that forced "Likely to sell
                    out" onto a second line. The right padding reserves the
                    heart's corner - except on the mobile row card, where the
                    heart has moved to the bottom and the badge gets the full
                    width of the thumbnail to wrap into. */}
                <div
                    className={cn(
                        'absolute inset-x-2 top-2 @[220px]:inset-x-2.5 @[220px]:top-2.5 z-10 flex items-start pr-7 @[220px]:pr-10',
                        mobileRow && 'max-sm:pr-0'
                    )}>
                    <BadgeChip type={tour.badge} dict={dict} />
                </div>

                {/* Wishlist heart. Top-right normally; BOTTOM-right on the
                    horizontal mobile card, per master §3.5 ("mobile:
                    bottom-right overlay, avoids badge collision") - on a 40%
                    thumbnail the badge and the heart were fighting over the
                    same corner. */}
                <motion.button
                    type='button'
                    aria-label={(wishlisted ? dict.removeAria : dict.saveAria).replace(
                        '{title}',
                        tour.title
                    )}
                    aria-pressed={wishlisted}
                    onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (onWishlistToggle) onWishlistToggle(tour.id);
                        else
                            toggle(tour.id, {
                                price: tour.price,
                                currency: tour.currency,
                            });
                    }}
                    whileTap={{ scale: 0.9 }}
                    transition={springPop}
                    /* Smaller on a narrow image so the badge gets the room
                       instead - the founder chose a spread-out badge over a
                       larger heart here (2026-08-05). It stays 34px in a
                       normal card, where nothing is competing for width.
                       24px on the mobile row card, where the photo is only
                       ~145px wide and a 27px disc read as a paste-on.
                       `before:` keeps a 40px invisible tap target centred on
                       it, so the control shrinks visually without becoming
                       harder to hit - the disc is decoration, the hit area
                       is what a thumb aims at. */
                    className={cn(
                        'absolute right-2 top-2 @[220px]:right-2.5 @[220px]:top-2.5 z-10 flex size-6 @[220px]:size-[34px] shrink-0 items-center justify-center rounded-full bg-it-white/92 shadow-it-sm border-none cursor-pointer transition-transform duration-(--it-duration-xs) ease-(--it-ease) hover:scale-[1.08] before:absolute before:left-1/2 before:top-1/2 before:size-10 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[""] @[220px]:before:hidden',
                        mobileRow && 'max-sm:top-auto max-sm:bottom-2'
                    )}>
                    <Image
                        src={
                            wishlisted
                                ? '/icons/heart-filled.svg'
                                : '/icons/heart-outline.svg'
                        }
                        alt=''
                        width={24}
                        height={24}
                        className='size-[13px] @[220px]:size-[17px]'
                        aria-hidden='true'
                    />
                </motion.button>
            </div>

            {/* ── Card info (design v2 .tc .body) ─────────────────────────── */}
            <div
                className={cn(
                    'flex flex-1 min-w-0 flex-col gap-1 px-3 pt-2.5 pb-3 @[220px]:px-3.5 @[220px]:pt-3 @[220px]:pb-3.5'
                )}>
                {/* Rating + hub row - amber star glyph + soft count, with the
                    hub eyebrow INLINE after the rating (founder, Aug 10 2026;
                    supersedes the own-row layout). The mck-18 §4 rule still
                    holds in the way that matters: the eyebrow is a property of
                    the SURFACE, not of the review count, so an unrated tour
                    with a hub still renders this row with the chip alone -
                    the hub label never comes and goes with the rating. */}
                {(isRated || tour.hub) && (
                    <div className='mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] @[220px]:text-[12.5px] leading-[1.6]'>
                        {isRated && (
                            <span className='inline-flex items-center gap-1.5'>
                                <span className='font-bold text-it-star'>
                                    ★ {tour.rating}
                                </span>
                                <span className='text-it-text-muted tabular-nums'>
                                    ({tour.reviewCount?.toLocaleString()})
                                </span>
                            </span>
                        )}
                        {tour.hub && <HubEyebrow name={tour.hub.name} />}
                    </div>
                )}

                {/* Tour title - the stored title is hub-free (mck-18 §3); the
                    hub context around it is the eyebrow's job. */}
                <h3 className='m-0 font-it-body font-bold text-[13px] @[220px]:text-[15.5px] leading-[1.3] tracking-[-0.005em] text-it-ink line-clamp-2 @[220px]:min-h-[2.6em]'>
{tour.title}
                </h3>

                {/* Meta column: duration, pickup (design v2 .tc .meta) */}
                <div className='flex flex-col items-start gap-[3px] text-[11px] @[220px]:text-[12.5px] leading-[1.6] text-it-text-muted'>
                    <span className='inline-flex items-center gap-1.5'>
                        <Image
                            src='/icons/meta-clock.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-3.5 shrink-0'
                            aria-hidden='true'
                        />
                        {tour.duration}
                    </span>

                    {tour.pickupAvailable && (
                        <span className='inline-flex items-center gap-1.5'>
                            <Image
                                src='/icons/meta-pickup.svg'
                                alt=''
                                width={24}
                                height={24}
                                className='size-3.5 shrink-0'
                                aria-hidden='true'
                            />
                            {dict.pickupAvailable}
                        </span>
                    )}
                </div>

                {/* Date-check answer (mck-17). Sits above the foot so it reads
                    as an answer about the tour rather than about its price. A
                    green tick when the day is bookable; muted and tickless when
                    it is not - a red cross on a card the traveller chose to
                    save would be scolding them for the operator's calendar. */}
                {availability && (
                    <p
                        className={cn(
                            'm-0 mt-2.5 inline-flex items-center gap-[7px] text-[12.5px] font-bold leading-[1.6]',
                            availability.available
                                ? 'text-it-green-text'
                                : 'text-it-ink-muted'
                        )}>
                        {availability.available && (
                            <Image
                                src='/icons/check-green.svg'
                                alt=''
                                width={24}
                                height={24}
                                className='size-[15px] shrink-0'
                                aria-hidden='true'
                            />
                        )}
                        {availability.label}
                    </p>
                )}

                {/* Foot: price + free cancellation (pinned to the bottom) */}
                <div className='mt-auto flex flex-col gap-[3px] pt-2'>
                    <div className='flex items-baseline flex-wrap gap-x-1 text-[11px] @[220px]:text-[12.5px] leading-[1.6] text-it-text-muted'>
                        <span>{dict.from}</span>
                        <span className='font-bold text-[14px] @[220px]:text-[17px] leading-[1.3] tracking-[-0.01em] text-it-ink tabular-nums'>
                            {tour.priceDisplay}
                        </span>
                        <span>{priceLabel}</span>

                        {tour.priceVaries && (
                            <>
                                <span
                                    className='mx-1 size-1 rounded-full bg-it-ink-muted/60 self-center flex-none'
                                    aria-hidden='true'
                                />
                                <span>{dict.priceVaries}</span>
                            </>
                        )}
                    </div>

                    {/* Price integrity (mck-17): what it cost when it was
                        saved, both directions, with no color and no animation.
                        Nothing at all when the price has not moved. */}
                    {priceNote && (
                        <p className='m-0 text-[11px] @[220px]:text-[12.5px] leading-[1.6] text-it-text-muted'>
                            {priceNote}
                        </p>
                    )}

                    {tour.freeCancellation && (
                        <p
                            className={cn(
                                'm-0 inline-flex items-center gap-1.5 text-[11px] @[220px]:text-[12.5px] font-semibold leading-[1.6] text-it-green-text',
                                // Mockup hides the note on the compact mobile
                                // row card - the price line closes the card.
                                mobileRow && 'max-sm:hidden'
                            )}>
                            <Image
                                src='/icons/check-green.svg'
                                alt=''
                                width={24}
                                height={24}
                                className='size-3.5 shrink-0'
                                aria-hidden='true'
                            />
                            {dict.freeCancellation}
                        </p>
                    )}
                </div>
            </div>
        </article>
    );

    // When the data source supplies a detail URL, the whole card links to the
    // tour page. The inner buttons call preventDefault/stopPropagation, so they
    // stay interactive without navigating.
    if (tour.href) {
        return (
            <Link
                href={tour.href}
                aria-label={tour.title}
                className='block h-full rounded-it-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-it-primary'>
                {card}
            </Link>
        );
    }

    return card;
}

// ── RankedTourCard ────────────────────────────────────────────────────────────
/**
 * Ranked collection card (Figma node 47433:2088). A surface (#f8f8f8) card,
 * radius 24, with a numbered badge over the image carousel (quiet dots always,
 * hover/focus arrows - the sitewide S4j rule), then rating, title, a short
 * description, a combined "duration · From $price" row, and a free
 * cancellation note. Carries the same top-right wishlist heart as the
 * standard card (it stops propagation, so the card link never fires).
 */
function RankedTourCard({
    tour,
    dict,
    className = '',
    priority = false,
    mobileRow = false,
}: TourCardProps) {
    const { isSaved, toggle } = useWishlist();
    const wishlisted = isSaved(tour.id);
    const rank = String(tour.rank).padStart(2, '0');
    const isRated = tour.rating !== undefined;

    // Design v2 collection card (5.6): the standard v2 chassis + a 34px orange
    // rank circle on the photo, the italic curation rationale under the title,
    // and a "star · duration" meta line. No peach, no badges - the rank IS the
    // signal.
    const card = (
        <article
            aria-label={tour.title}
            className={cn(
                '@container group flex h-full flex-col overflow-hidden rounded-it-md border border-transparent bg-it-white will-change-transform transition-all duration-(--it-duration-md) ease-(--it-ease) hover:-translate-y-0.5 hover:shadow-it-card-hover hover:border-it-card-hover-border',
                mobileRow &&
                    'max-sm:flex-row max-sm:border-it-divider max-sm:min-h-[170px]',
                className
            )}>
            {/* ── Image area ──────────────────────────────────────────────── */}
            <div
                className={cn(
                    'relative aspect-3/2 w-full shrink-0 overflow-hidden rounded-t-[12px] bg-it-bg [&_img]:transition-transform [&_img]:duration-(--it-duration-md) [&_img]:ease-(--it-ease) group-hover:[&_img]:scale-[1.03]',
                    mobileRow &&
                        'max-sm:w-2/5 max-sm:aspect-auto max-sm:rounded-l-[12px] max-sm:rounded-tr-none'
                )}>
                <TourCardCarousel
                    images={tour.images}
                    alt={tour.title}
                    sizes='(max-width: 640px) 40vw, (max-width: 1024px) 50vw, 384px'
                    priority={priority}
                    prevAria={dict.prevPhotoAria}
                    nextAria={dict.nextPhotoAria}
                    scrim
                    descSlide={
                        tour.shortDescription
                            ? {
                                  title: tour.title,
                                  description: tour.shortDescription,
                                  linkLabel: dict.fullDetails,
                              }
                            : undefined
                    }
                />
                {/* Rank circle (top-left) + Wishlist (top-right) */}
                <div className='absolute inset-x-2.5 top-2.5 z-10 flex items-start justify-between gap-2'>
                    <span className='grid size-[34px] place-items-center rounded-it-full bg-it-primary text-[13px] font-bold text-it-white shadow-it-sm tabular-nums'>
                        {rank}
                    </span>
                    <motion.button
                        type='button'
                        aria-label={(wishlisted
                            ? dict.removeAria
                            : dict.saveAria
                        ).replace('{title}', tour.title)}
                        onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggle(tour.id, {
                                price: tour.price,
                                currency: tour.currency,
                            });
                        }}
                        whileTap={{ scale: 0.9 }}
                        transition={springPop}
                        className='ml-auto flex size-[30px] @[220px]:size-[34px] shrink-0 items-center justify-center rounded-full bg-it-white/92 shadow-it-sm border-none cursor-pointer transition-transform duration-(--it-duration-xs) ease-(--it-ease) hover:scale-[1.08]'>
                        <Image
                            src={
                                wishlisted
                                    ? '/icons/heart-filled.svg'
                                    : '/icons/heart-outline.svg'
                            }
                            alt=''
                            width={24}
                            height={24}
                            className='size-4 @[220px]:size-[17px]'
                            aria-hidden='true'
                        />
                    </motion.button>
                </div>
            </div>

            {/* ── Card info ───────────────────────────────────────────────── */}
            <div className='flex flex-1 min-w-0 flex-col gap-1 px-3 pt-2.5 pb-3 @[220px]:px-3.5 @[220px]:pt-3 @[220px]:pb-3.5'>
                {/* Hub eyebrow - above the title. (The default card inlines it
                    with its rating row; here the rating sits in the meta line
                    below the description, so the chip keeps its own row.) The
                    eyebrow shows on collection pages even when every card
                    shares one hub - suppression is bound to a surface, not to
                    what the other cards are (founder, Aug 6 2026 / mck-18 §2). */}
                {tour.hub && (
                    <div className='mb-0.5 flex'>
                        <HubEyebrow name={tour.hub.name} />
                    </div>
                )}
                <h3 className='m-0 font-it-body font-bold text-[13px] @[220px]:text-[15.5px] leading-[1.3] tracking-[-0.005em] text-it-ink line-clamp-2'>
{tour.title}
                </h3>

                {/* Curation rationale - the required CMS line, italic. */}
                {tour.description && (
                    <p className='m-0 text-[11px] @[220px]:text-[12.5px] italic leading-[1.5] text-it-text-muted line-clamp-2'>
                        {tour.description}
                    </p>
                )}

                {/* Meta: ★ rating (count) · duration */}
                <div className='mt-0.5 flex flex-wrap items-center gap-[5px] text-[11px] @[220px]:text-[12.5px] leading-[1.6] text-it-text-muted'>
                    {isRated && (
                        <>
                            <span className='font-bold text-it-star'>
                                ★ {tour.rating}
                            </span>
                            <span className='tabular-nums'>
                                ({tour.reviewCount?.toLocaleString()})
                            </span>
                            <span className='text-it-ink-muted'>·</span>
                        </>
                    )}
                    <span>{tour.duration}</span>
                </div>

                {tour.freeCancellation && (
                    <span className='mt-0.5 flex items-center gap-1.5 text-[11px] @[220px]:text-[12.5px] font-semibold leading-[1.6] text-it-green-text max-sm:hidden'>
                        <Image
                            src='/icons/trust-check-green.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-[13px] shrink-0'
                            aria-hidden='true'
                        />
                        {dict.freeCancellation}
                    </span>
                )}

                {/* Price - pinned to the card foot. */}
                <div className='mt-auto pt-2 text-[11px] @[220px]:text-[12.5px] leading-[1.6] text-it-text-muted'>
                    {dict.from}
                    <b className='ml-1 text-[14px] @[220px]:text-[17px] font-bold tracking-[-0.01em] text-it-ink tabular-nums'>
                        {tour.priceDisplay}
                    </b>
                </div>
            </div>
        </article>
    );

    if (tour.href) {
        return (
            <Link
                href={tour.href}
                aria-label={tour.title}
                className='block h-full rounded-it-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-it-primary'>
                {card}
            </Link>
        );
    }

    return card;
}

