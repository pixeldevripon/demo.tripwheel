'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { SharePill } from '@/components/frontend/share-pill';
import { WishlistSkeleton } from '@/components/frontend/skeletons/wishlist-skeleton';
import { TourCard, type TourCardDict } from '@/components/frontend/tour-card';
import { useWishlist } from '@/components/frontend/wishlist-provider';
import {
    isBookable,
    wishlistApi,
    type BookableSavedTour,
    type SavedTourCard,
} from '@/lib/api/wishlist';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import { currencyFromCookie, formatPriceFrom } from '@/lib/currency/current';
import { formatPlural, type PluralForms } from '@/lib/i18n/plural';
import {
    searchHitToListing,
    TOUR_CARD_GRID,
    type DurationDict,
} from '@/lib/tours/listing';
import {
    needsResolve,
    parseIdList,
    savedPriceWas,
    soleDestinationSlug,
} from '@/lib/tours/saved-list';

import {
    DEFAULT_TRAVELERS,
    formatCheckDate,
    isDayKey,
    MAX_TRAVELERS,
    parseDayKey,
    SavedDateCheck,
    type SavedDateCheckDict,
} from './saved-date-check';
import { SavedEmailBox, type SavedEmailDict } from './saved-email-box';
import {
    SavedEmptyState,
    type SavedEmptyDestination,
    type SavedEmptyDict,
} from './saved-empty-state';
import {
    SavedUnbookableCard,
    type SavedUnbookableDict,
} from './saved-unbookable-card';

/**
 * The removal collapse. Same curve the booking card's panels use - a card
 * leaving the list is the same motion vocabulary as a section closing.
 */
const CARD_EXIT = { duration: 0.22, ease: [0.4, 0, 0.2, 1] } as const;

export type SavedToursDict = {
    /** H1: "Saved tours". */
    title: string;
    /** "Your picks, side by side. Book when you're ready." */
    subtitle: string;
    /** Shown instead of the subtitle when viewing somebody else's list. */
    sharedNote: string;
    /** "{count} tours" - the meta row's count half. */
    tourCount: PluralForms;
    /** Separator-joined island name; omitted when the list spans islands. */
    deviceLine: string;
    share: string;
    shareCopied: string;
    /** "Available on {date}" / "Closed on {date}" */
    availableOn: string;
    closedOn: string;
    /** "Was {price} when you saved it" */
    priceWas: string;
    /** "{title} removed" + the Undo action on the snackbar. */
    removed: string;
    undo: string;
    /** Confirmation after an emailed list is adopted onto this device. */
    restored: string;
    dateCheck: SavedDateCheckDict;
    email: SavedEmailDict;
    empty: SavedEmptyDict;
    unbookable: SavedUnbookableDict;
};

/**
 * The saved tours page body (mck-17).
 *
 * COOKIE-BASED, no login: the provider owns the saved ids and this view
 * resolves them into cards through the public `/wishlist/resolve` endpoint,
 * newest first.
 *
 * ## Two ways in besides your own list
 *
 * `?list=` renders somebody else's list read-only - the hearts start empty,
 * because none of it is yours until you say so. `?restore=` is the link from
 * the "email me this list" mail: it merges the ids back onto this device and
 * then cleans itself out of the URL, so a shared screenshot of the address bar
 * is not a second copy of the flow.
 *
 * ## The mobile order
 *
 * On a phone the header stacks, so whatever is second in the markup takes the
 * whole width. With the email block there, the first saved card started 600px
 * down a 844px screen - not one card visible on arrival, on the page whose
 * entire job is to show them. `order-*` moves the grid above the email capture
 * below `sm`, which puts the first card at 335px and two cards on the screen.
 */
export function SavedToursView({
    locale,
    dict,
    cardDict,
    durationDict,
    destinations,
}: {
    locale: Locale;
    dict: SavedToursDict;
    cardDict: TourCardDict;
    durationDict: DurationDict;
    /** Empty-state copy for every active island, launch island first. */
    destinations: SavedEmptyDestination[];
}) {
    const {
        ready,
        ids,
        isSaved,
        savedPriceOf,
        toggle,
        remove,
        restore,
        adopt,
    } = useWishlist();

    // A shared list is whatever the URL says; your own is whatever the cookie
    // says. Read once - a shared link that later loses its param would
    // otherwise silently turn into the reader's own list mid-session.
    const [sharedIds, setSharedIds] = useState<string[] | null>(null);
    const [urlRead, setUrlRead] = useState(false);
    const adopted = useRef(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const restoring = parseIdList(params.get('restore'));
        if (restoring.length > 0 && !adopted.current) {
            adopted.current = true;
            adopt(restoring);
            toast.success(dict.restored);
            // Drop the ids from the address bar: the list now lives in the
            // cookie, and a URL that keeps re-adopting on every refresh would
            // resurrect tours the traveller has since removed.
            window.history.replaceState(
                null,
                '',
                localizeHref(locale, '/saved')
            );
        } else {
            const shared = parseIdList(params.get('list'));
            if (shared.length > 0) setSharedIds(shared);
        }

        // Restore a date check from the URL - a reload, the back button, or a
        // return trip from a tour page all land here with the question still
        // attached, and re-asking it would be the site forgetting the answer
        // the traveller just gave it.
        const date = params.get('date');
        if (date && isDayKey(date)) {
            setCheckedDate(date);
            const party = Number(params.get('guests'));
            if (Number.isInteger(party) && party >= 1 && party <= MAX_TRAVELERS) {
                setGuests(party);
            }
        }
        setUrlRead(true);
        // Runs once: `adopt` is stable and the URL is read at mount by design.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const isShared = sharedIds !== null;
    const sourceIds = sharedIds ?? ids;

    const [cards, setCards] = useState<SavedTourCard[]>([]);
    const [loading, setLoading] = useState(true);
    /**
     * The id set the current `cards` were resolved from.
     *
     * It is what makes "re-fetch on an ADDITION, never on a removal" possible.
     * A removal is already handled optimistically by `visible` below, so
     * re-resolving on one would cost a request to render exactly what is
     * already on screen, minus a card.
     */
    const resolved = useRef<Set<string>>(new Set());
    const sourceKey = sourceIds.join(',');

    useEffect(() => {
        if (!ready || !urlRead) return;
        if (sourceIds.length === 0) {
            resolved.current = new Set();
            setCards([]);
            setLoading(false);
            return;
        }

        // Saving a tour from the empty state's suggestion row adds an id we
        // have never resolved. Without this the page kept its empty state
        // while the nav badge counted up and the hearts filled in - the list
        // said "nothing saved yet" about tours it was showing as saved.
        if (!needsResolve(sourceIds, resolved.current)) return;

        let ignore = false;
        // Only the FIRST resolve shows the skeleton. Saving a tour should add a
        // card, not blank the list and rebuild it.
        const firstLoad = resolved.current.size === 0;
        if (firstLoad) setLoading(true);
        const currency = currencyFromCookie(document.cookie, locale);
        wishlistApi
            .resolve(sourceIds, locale, currency)
            .then(rows => {
                if (ignore) return;
                resolved.current = new Set(sourceIds);
                setCards(rows);
            })
            .catch(() => {
                if (!ignore) setCards([]);
            })
            .finally(() => {
                if (!ignore && firstLoad) setLoading(false);
            });
        return () => {
            ignore = true;
        };
        // `sourceKey` stands in for `sourceIds`, which is a new array each
        // render; the guard above decides whether a change is worth a request.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, urlRead, locale, isShared, sourceKey]);

    // ── The date check ──────────────────────────────────────────────────────
    const [checkedDate, setCheckedDate] = useState<string | null>(null);
    const [guests, setGuests] = useState(DEFAULT_TRAVELERS);

    /**
     * The checked date lives in the URL, like every other answer the traveller
     * gives the site (All Tours and search both do this).
     *
     * It buys three things a component-only state cannot: the page survives a
     * reload and the back button, the link is shareable with the question
     * already asked, and the answer is still there after a trip to a tour page
     * and back.
     *
     * `replaceState` rather than the router: this is the same document with an
     * annotation, not a navigation, and pushing would make the back button walk
     * through every guest count the traveller tried.
     */
    useEffect(() => {
        if (!urlRead) return;
        const params = new URLSearchParams(window.location.search);
        if (checkedDate) {
            params.set('date', checkedDate);
            params.set('guests', String(guests));
        } else {
            params.delete('date');
            params.delete('guests');
        }
        const query = params.toString();
        window.history.replaceState(
            null,
            '',
            `${window.location.pathname}${query ? `?${query}` : ''}`
        );
    }, [checkedDate, guests, urlRead]);
    const [availability, setAvailability] = useState<Record<string, boolean>>(
        {}
    );

    const bookableIds = useMemo(
        () => cards.filter(isBookable).map(c => c.id),
        [cards]
    );

    useEffect(() => {
        if (!checkedDate || bookableIds.length === 0) {
            setAvailability({});
            return;
        }
        let ignore = false;
        wishlistApi
            .checkDate(bookableIds, checkedDate, guests)
            .then(result => {
                if (ignore) return;
                setAvailability(
                    Object.fromEntries(
                        result.tours.map(t => [t.tourId, t.available])
                    )
                );
            })
            .catch(() => {
                // A failed check shows no chips rather than wrong ones: an
                // unanswered question is better than a confident wrong answer
                // about whether a tour runs.
                if (!ignore) setAvailability({});
            });
        return () => {
            ignore = true;
        };
    }, [checkedDate, guests, bookableIds]);

    const checkedDateLabel = checkedDate
        ? formatCheckDate(parseDayKey(checkedDate) ?? new Date(), locale)
        : null;

    // ── Removal, with Undo ──────────────────────────────────────────────────
    /**
     * The heart on YOUR list removes, and says so with a way back (mck-17,
     * platform snackbar from §2.2). The card collapses out immediately rather
     * than waiting on the toast: an Undo that has to be used to see anything
     * happen is not an Undo, it is a confirmation dialog.
     */
    function handleRemove(tourId: string) {
        const card = cards.find(c => c.id === tourId);
        const removed = remove(tourId);
        if (!removed) return;
        toast(dict.removed.replace('{title}', card?.title ?? ''), {
            action: {
                label: dict.undo,
                onClick: () => restore(removed),
            },
        });
    }

    // On somebody else's list the heart does the opposite: it keeps the tour.
    // `undefined` hands the card back to the provider's own toggle, which is
    // exactly the save behaviour every other listing surface has.
    const heartHandler = isShared ? undefined : handleRemove;

    // Reflect optimistic removals. On a shared list the viewer's own cookie
    // says nothing about what is on screen, so every card stays.
    const visible = isShared ? cards : cards.filter(c => isSaved(c.id));
    const destinationSlug = soleDestinationSlug(visible);
    const islandName = destinations.find(
        d => d.slug === destinationSlug
    )?.name;

    const shareUrl =
        typeof window === 'undefined'
            ? ''
            : `${window.location.origin}${localizeHref(
                  locale,
                  '/saved'
              )}?list=${visible.map(c => c.id).join(',')}`;

    if (!ready || !urlRead || loading) {
        return (
            <section className='it-section bg-it-white'>
                <div className='it-container'>
                    <WishlistSkeleton />
                </div>
            </section>
        );
    }

    if (visible.length === 0) {
        return (
            <section className='it-section bg-it-white'>
                <div className='it-container'>
                    <SavedEmptyState
                        locale={locale}
                        dict={dict.empty}
                        cardDict={cardDict}
                        destinations={destinations}
                    />
                </div>
            </section>
        );
    }

    return (
        <section className='it-section bg-it-white'>
            {/* The positioning context is this INNER box, not `.it-container`.
                An absolutely positioned child resolves `right-0` against its
                containing block's PADDING edge, so anchoring to the container
                itself put the Share pill out in the gutter - visibly hanging
                off the right of the page on a phone, where the gutter is only
                16px wide. */}
            <div className='it-container'>
                <div className='relative flex flex-col'>
                    {/* Share sits top right of the whole block, above the
                        header on mobile too (mockup `.pageshare`). */}
                    <div className='absolute right-0 top-0 z-5'>
                        <SharePill
                            label={dict.share}
                            copiedLabel={dict.shareCopied}
                            url={shareUrl}
                        />
                    </div>

                    <div className='flex flex-wrap items-start justify-between gap-x-12 gap-y-6 max-sm:contents'>
                        <div className='min-w-[300px] flex-1 basis-[460px] max-sm:order-1 max-sm:basis-auto'>
                        {/* The reserve is on the HEADING, and only below `sm`.
                            On a wide screen the pill sits above the email
                            column, which clears it with its own top margin; it
                            is only on a phone, where the header goes full
                            width, that anything of ours runs under it - and
                            only for the heading's one line. */}
                        <h1 className='m-0 font-it-display text-[clamp(24px,3.45vw,31px)] leading-[1.15] tracking-[-0.012em] text-it-heading max-sm:pr-28 font-medium'>
                            {dict.title}
                        </h1>

                        {isShared ? (
                            <p className='m-0 mt-1.5 text-[14.5px] font-medium leading-[1.4] text-it-heading max-sm:text-[12px] tracking-[-0.012em]'>
                                {dict.sharedNote}
                            </p>
                        ) : (
                            <p className='m-0 mt-1.5 text-[14.5px] font-medium leading-[1.4] text-it-heading max-sm:text-[13.5px] tracking-[-0.012em]'>
                                {dict.subtitle}
                            </p>
                        )}

                        <p className='m-0 mt-3.5 text-[12.5px] font-medium leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                            {formatPlural(
                                dict.tourCount,
                                visible.length,
                                locale
                            )}
                            {islandName ? ` · ${islandName}` : ''}
                        </p>

                        {/* The honest statement of where the list actually
                            lives - and the reason the email box exists. Not
                            shown on a shared list: it is not that reader's
                            device the list is sitting on. */}
                        {!isShared && (
                            <p className='m-0 mt-1.5 max-w-[430px] text-[12px] leading-[1.6] text-it-text-muted/80 tracking-[-0.012em]'>
                                {dict.deviceLine}
                            </p>
                        )}

                        <div className='mt-[18px]'>
                            <SavedDateCheck
                                locale={locale}
                                dict={dict.dateCheck}
                                date={checkedDate}
                                guests={guests}
                                onChange={next => {
                                    setCheckedDate(next.date);
                                    setGuests(next.guests);
                                }}
                            />
                        </div>
                    </div>

                    {/* Email capture. THIRD on a phone (below the grid), beside
                        the header on a wide screen.

                        `sm:mt-[52px]` is the mockup's own `.emailbox` margin,
                        and it is load-bearing rather than decorative: the Share
                        pill is absolutely positioned in this corner, so without
                        it the two overlap. */}
                    {!isShared && (
                        <div className='min-w-[290px] shrink basis-[372px] mt-[26px] sm:mt-[52px] max-sm:order-3 max-sm:basis-auto'>
                            <SavedEmailBox
                                ids={visible.map(c => c.id)}
                                locale={locale}
                                dict={dict.email}
                            />
                        </div>
                    )}
                </div>

                <div className='mt-[26px] max-sm:order-2 max-sm:mt-5'>
                    <div className={TOUR_CARD_GRID}>
                        <AnimatePresence initial={false}>
                            {visible.map(card => (
                                <motion.div
                                    key={card.id}
                                    layout
                                    exit={{ opacity: 0, scale: 0.96 }}
                                    transition={CARD_EXIT}>
                                    {isBookable(card) ? (
                                        <BookableCard
                                            card={card}
                                            locale={locale}
                                            dict={dict}
                                            cardDict={cardDict}
                                            durationDict={durationDict}
                                            checkedDate={checkedDate}
                                            savedPrice={
                                                isShared
                                                    ? null
                                                    : savedPriceOf(card.id)
                                            }
                                            availableLabel={
                                                checkedDateLabel &&
                                                card.id in availability
                                                    ? {
                                                          available:
                                                              availability[
                                                                  card.id
                                                              ],
                                                          label: (availability[
                                                              card.id
                                                          ]
                                                              ? dict.availableOn
                                                              : dict.closedOn
                                                          ).replace(
                                                              '{date}',
                                                              checkedDateLabel
                                                          ),
                                                      }
                                                    : undefined
                                            }
                                            onRemove={heartHandler}
                                        />
                                    ) : (
                                        <SavedUnbookableCard
                                            tour={card}
                                            locale={locale}
                                            dict={dict.unbookable}
                                            onHeart={
                                                heartHandler ??
                                                (id => toggle(id))
                                            }
                                            saved={isShared ? isSaved(card.id) : true}
                                            mobileRow
                                        />
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
                </div>
            </div>
        </section>
    );
}

/** One saved tour that can still be booked. Split out to keep the map readable. */
function BookableCard({
    card,
    locale,
    dict,
    cardDict,
    durationDict,
    checkedDate,
    savedPrice,
    availableLabel,
    onRemove,
}: {
    card: BookableSavedTour;
    locale: Locale;
    dict: SavedToursDict;
    cardDict: TourCardDict;
    durationDict: DurationDict;
    /** Rides onto the card's href so the tour page opens on the same day. */
    checkedDate: string | null;
    savedPrice: { price: number; currency: string } | null;
    availableLabel?: { available: boolean; label: string };
    onRemove?: (tourId: string) => void;
}) {
    // The date rides along on the href: opening a saved tour after checking a
    // day should land on the widget with that day already chosen, not ask the
    // traveller the question they just answered.
    const listing = searchHitToListing(
        card,
        locale,
        durationDict,
        checkedDate ?? undefined
    );
    const was = savedPriceWas(savedPrice, {
        price: listing.price,
        currency: listing.currency,
    });

    return (
        <TourCard
            tour={listing}
            dict={cardDict}
            mobileRow
            onWishlistToggle={onRemove}
            availability={availableLabel}
            priceNote={
                was === null
                    ? undefined
                    : dict.priceWas.replace(
                          '{price}',
                          formatPriceFrom(was, listing.currency, locale)
                      )
            }
        />
    );
}
