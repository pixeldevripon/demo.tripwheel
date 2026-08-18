'use client';

import { motion } from 'framer-motion';
import { ChevronRight, Folder, MapPin, Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { createContext, useContext, useEffect, useRef, useState } from 'react';

import {
    isCurrency,
    type Currency,
    type Locale,
} from '@/lib/constants/locales';
import { formatPriceFrom } from '@/lib/currency/current';
import { safeRemoteImage } from '@/lib/images/remote-hosts';
import { dropdownMotion } from '@/lib/motion';
import { formatDuration } from '@/lib/tours/listing';
import type { SearchHit, SearchSuggest } from '@/types/search';

import type { SearchDict } from './lib/navbar.types';

/**
 * Fever-style entity row: soft icon square, bold label, muted subtitle,
 * trailing chevron. Used for the see-all/category/hub shortcuts at the top of
 * the panel.
 */
function EntityRow({
    href,
    onSelect,
    icon,
    image,
    label,
    subtitle,
}: {
    href: string;
    onSelect: () => void;
    /**
     * Glyph rows. Reserved for rows that are not a PLACE - the "see all results
     * for <query>" shortcut. Omit it and the square becomes a PHOTO slot
     * instead - see `image`.
     */
    icon?: React.ReactNode;
    /**
     * The target page's own photo. Passing the prop at all - even as null -
     * makes the square a photo slot: a real photo when there is one, and
     * otherwise the same flat `bg-it-bg` surface every image container on the
     * site falls back to, which is exactly what the navbar Categories dropdown
     * does for a category with no picture. Deliberately NOT a stand-in glyph: a
     * panel of identical grey icons tells the visitor nothing about where each
     * row goes, which is the whole job of the panel. Every destination,
     * category, hub and collection row uses this, typed or not.
     */
    image?: string | null;
    label: React.ReactNode;
    subtitle?: string;
}) {
    // These URLs are admin-entered and arrive from the API, and `next/image`
    // THROWS mid-render on a host it was not configured for. Guarding here
    // covers every caller at once, so one bad row degrades to the flat square
    // instead of taking down the panel.
    const src = safeRemoteImage(image);
    const compact = useContext(CompactRows);
    return (
        <li>
            <Link
                href={href}
                onClick={onSelect}
                className={`flex items-center no-underline transition-colors hover:bg-it-surface ${
                    compact
                        ? 'gap-[11px] px-3.5 py-[7px]'
                        : 'gap-3 px-4 py-2.5'
                }`}>
                <span
                    className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-it-md text-it-heading ${
                        compact ? 'size-[42px]' : 'size-14'
                    } ${icon ? 'bg-it-surface' : 'bg-it-bg'}`}>
                    {src && (
                        <Image
                            src={src}
                            alt=''
                            fill
                            sizes={compact ? '42px' : '56px'}
                            className='object-cover'
                        />
                    )}
                    {icon}
                </span>
                <span className='min-w-0 flex-1'>
                    <span
                        className={`block truncate text-it-heading ${
                            compact
                                ? 'text-[13px] font-medium leading-[1.4] tracking-[-0.012em]'
                                : 'text-[13px] font-medium tracking-[-0.012em]'
                        }`}>
                        {label}
                    </span>
                    {subtitle && (
                        <span className='mt-0.5 block truncate text-[11.5px] text-it-text-muted tracking-[-0.012em]'>
                            {subtitle}
                        </span>
                    )}
                </span>
                <ChevronRight
                    size={16}
                    strokeWidth={1.5}
                    className='shrink-0 text-it-text-muted tracking-[-0.012em]'
                />
            </Link>
        </li>
    );
}

/**
 * Dense rows, for the mobile full-screen layer only (mck-14: 42px thumbnails,
 * 7px/14px padding). Passed by context rather than threaded as a prop through
 * six call sites of `Row`, none of which otherwise care where they are.
 *
 * The dropdown keeps its 56px rows: it shows a handful under a bar with room to
 * spare, while the layer is a full screen of them and the same size there costs
 * two visible results.
 */
const CompactRows = createContext(false);

/** Section header ("Tours in Aruba" / "Beyond Aruba"). */
function SectionHeader({ children }: { children: React.ReactNode }) {
    return (
        <p className='m-0 border-t border-it-border px-4 pt-3.5 pb-1.5 text-[13px] font-medium text-it-heading tracking-[-0.012em]'>
            {children}
        </p>
    );
}

/** Breathing room between the panel's bottom edge and the viewport's. */
const PANEL_BOTTOM_GUTTER = 16;

/**
 * The dropdown shell: chrome, entrance motion, and a scroll area bounded by the
 * space actually left below the panel.
 *
 * A fixed `70vh` was wrong because the panel is anchored under the search bar,
 * not to the viewport - and that bar sits ~40% down the hero. 70vh of panel
 * starting there runs well past the fold, so the last rows and the "see all"
 * link were unreachable without scrolling the PAGE behind an open dropdown.
 * Measuring instead makes the same component behave in the navbar (top of the
 * screen, lots of room) and in a hero (little room) without either being tuned
 * by hand.
 *
 * `visualViewport` over `innerHeight`: when the mobile keyboard opens it is the
 * only one that reports the shrunken area, which is exactly the moment this
 * panel is on screen.
 *
 * There is deliberately NO minimum height. A floor is self-defeating - the one
 * case it triggers in is the one case there is no room, so it re-creates the
 * overflow it was meant to soften. A short panel is honest and still scrolls,
 * and because `scroll` is one of the measured events, scrolling the page to
 * lift the input grows the panel on the way up.
 */
function Panel({
    children,
    inline,
}: {
    children: React.ReactNode;
    /**
     * Render as a plain block in the flow instead of a dropdown anchored under
     * the bar - for the mobile full-screen layer, which owns the scroll itself.
     * Measuring the space "below the panel" is meaningless there: the panel IS
     * the space, and a second scroller inside the layer's scroller is what
     * traps rows behind the keyboard.
     */
    inline?: boolean;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [maxHeight, setMaxHeight] = useState<number | null>(null);

    useEffect(() => {
        const measure = () => {
            const el = ref.current;
            if (!el) return;
            const viewport = window.visualViewport?.height ?? window.innerHeight;
            /*
             * The panel's OWN rect is unusable here: it is mid-entrance-animation
             * on the first measure, and getBoundingClientRect bakes the
             * transform in, so the gutter came out ~10px short. `offsetTop` is
             * layout position and ignores transforms; the offset parent is the
             * search wrapper, which never animates - so this pair is the
             * settled top no matter when it runs.
             */
            const parent = el.offsetParent;
            const top = parent
                ? parent.getBoundingClientRect().top + el.offsetTop
                : el.getBoundingClientRect().top;
            // Never negative: an input scrolled past the fold would otherwise
            // ask for a negative max-height, which browsers ignore - putting
            // the unbounded panel back.
            setMaxHeight(Math.max(0, viewport - top - PANEL_BOTTOM_GUTTER));
        };
        measure();

        // Page scroll moves the panel through the viewport; resize and the
        // visual-viewport events cover rotation and the mobile keyboard.
        window.addEventListener('resize', measure);
        window.addEventListener('scroll', measure, { passive: true });
        window.visualViewport?.addEventListener('resize', measure);
        window.visualViewport?.addEventListener('scroll', measure);
        return () => {
            window.removeEventListener('resize', measure);
            window.removeEventListener('scroll', measure);
            window.visualViewport?.removeEventListener('resize', measure);
            window.visualViewport?.removeEventListener('scroll', measure);
        };
    }, []);

    if (inline) {
        return (
            <CompactRows.Provider value={true}>
                <div className='bg-it-white'>{children}</div>
            </CompactRows.Provider>
        );
    }

    return (
        <motion.div
            ref={ref}
            {...dropdownMotion}
            className='absolute left-0 right-0 top-[calc(100%+8px)] z-50 origin-top overflow-hidden rounded-it-lg border border-it-border-subtle bg-it-white shadow-it-lg'>
            {/* The class is the pre-measurement fallback (first paint, and any
                browser without visualViewport); the measured value overrides it. */}
            <div
                className='max-h-[70vh] overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
                style={maxHeight === null ? undefined : { maxHeight }}>
                {children}
            </div>
        </motion.div>
    );
}

/** A tour hit row - image, context line, title, price line. */
function TourRow({
    hit,
    contextLabel,
    contextKind = 'category',
    locale,
    currency,
    dict,
    href,
    onSelect,
}: {
    hit: SearchHit;
    /** Small muted line above the title (category or destination name). */
    contextLabel: string | null;
    /** What the context line names - picks the icon (folder vs map pin). */
    contextKind?: 'category' | 'destination';
    locale: Locale;
    currency: Currency;
    dict: SearchDict;
    href: string;
    onSelect: () => void;
}) {
    const duration = formatDuration(
        hit.durationMinutesFrom,
        hit.durationMinutesTo,
        dict
    );
    // Same guard as EntityRow - an operator-entered image URL on an unexpected
    // host would otherwise throw inside `next/image` and take the panel down.
    const tourImage = safeRemoteImage(hit.images[0]?.url);
    const meta: React.ReactNode[] = [];
    if (hit.aggregateReviewCount > 0) {
        meta.push(
            <span key='r' className='inline-flex items-center gap-0.5'>
                <Image
                    src='/icons/star-listings.svg'
                    alt=''
                    width={12}
                    height={12}
                    className='size-3'
                />
                {hit.aggregateRating} ({hit.aggregateReviewCount})
            </span>
        );
    }
    if (duration) meta.push(<span key='d'>{duration}</span>);
    if (hit.pickupModel !== 'NONE')
        meta.push(<span key='p'>{dict.pickupAvailable}</span>);

    return (
        <li>
            <Link
                href={href}
                onClick={onSelect}
                className='flex items-center gap-3 px-4 py-2.5 no-underline transition-colors hover:bg-it-surface'>
                {/* 56px, the same square EntityRow uses. ONE thumbnail size for
                    every row in the panel: two sizes put the text column at two
                    different x positions, so the left edge staggered as you
                    scanned down - the squares themselves were never the
                    problem. Unified UP, so no photo got smaller. */}
                <span className='relative size-14 shrink-0 overflow-hidden rounded-it-md bg-it-surface'>
                    {tourImage && (
                        <Image
                            src={tourImage}
                            alt=''
                            fill
                            sizes='56px'
                            className='object-cover'
                        />
                    )}
                </span>
                <span className='min-w-0 flex-1'>
                    {contextLabel && (
                        <span className='flex items-center gap-1 text-[11.5px] text-it-text-muted tracking-[-0.012em]'>
                            {contextKind === 'category' ? (
                                <Folder
                                    size={11}
                                    strokeWidth={1.5}
                                    className='shrink-0'
                                />
                            ) : (
                                <MapPin
                                    size={11}
                                    strokeWidth={1.5}
                                    className='shrink-0'
                                />
                            )}
                            <span className='truncate'>{contextLabel}</span>
                        </span>
                    )}
                    <span className='block truncate text-[13px] font-medium text-it-heading tracking-[-0.012em]'>
                        {hit.title}
                    </span>
                    {meta.length > 0 && (
                        <span className='mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11.5px] text-it-text-muted tracking-[-0.012em]'>
                            {meta.map((node, i) => (
                                <span
                                    key={i}
                                    className='inline-flex items-center gap-1.5 text-[9px] leading-[1.6] tracking-[-0.012em] text-it-heading/70'>
                                    {i > 0 && (
                                        <span className='text-it-heading/30 tracking-[-0.012em]'>
                                            ·
                                        </span>
                                    )}
                                    {node}
                                </span>
                            ))}
                        </span>
                    )}
                    <span className='mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11.5px] tracking-[-0.012em]'>
                        <span className='font-medium text-it-heading tracking-[-0.012em]'>
                            {dict.from}{' '}
                            {formatPriceFrom(
                                hit.money?.priceFrom ??
                                    hit.priceFrom ??
                                    hit.basePrice ??
                                    0,
                                isCurrency(
                                    hit.money?.currency ?? hit.defaultCurrency
                                )
                                    ? (hit.money?.currency ??
                                          (hit.defaultCurrency as Currency))
                                    : currency,
                                locale
                            )}
                        </span>
                        {(hit.cancellationHours ?? 0) > 0 && (
                            <>
                                <span className='text-it-heading/30 tracking-[-0.012em]'>·</span>
                                <span className='text-it-text-muted tracking-[-0.012em]'>
                                    {dict.freeCancellation}
                                </span>
                            </>
                        )}
                    </span>
                </span>
            </Link>
        </li>
    );
}

/**
 * One row of the zero-state panel. `href` is prebuilt by the caller, because
 * hubs, collections and categories share the flat `/{destination}/{slug}`
 * namespace and only the caller knows the island.
 */
export interface SearchZeroStateEntry {
    name: string;
    href: string;
    /** Picks the fallback icon; collections are always `collection`. */
    kind: 'category' | 'hub' | 'collection';
    /** Live tour count, printed as the subtitle. Omitted = no subtitle. */
    tours?: number;
    /** The target page's own photo; falls back to the kind glyph when absent. */
    image?: string | null;
}

/** Grouped starting points shown BEFORE the visitor types anything (master 5.10). */
export interface SearchZeroState {
    categoriesAndHubs: SearchZeroStateEntry[];
    collections: SearchZeroStateEntry[];
    /**
     * The island's top-ranked live tours, rendered through the SAME `TourRow` the
     * typed results use - a visitor who has not typed yet should still be able to
     * recognise a tour by its photo, rating and from-price, and two row designs
     * for one thing is how they drift apart.
     */
    topTours: SearchHit[];
    /**
     * The closing "See all N tours in {island}" link, already worded by the
     * caller: it is the island's OWN see-all sentence (the same string the page
     * prints further down), and only the caller knows the island name. Null when
     * the island has no live tours, which drops the row rather than offering a
     * link to nothing.
     */
    allTours: { label: string; href: string } | null;
}

/**
 * Fever-style typeahead panel: entity shortcuts up top (see-all row, matched
 * categories with tour counts, matched hubs), then "Tours in {island}" hits,
 * then a "Beyond {island}" strip from other destinations. All data + href
 * building is passed in; this only renders.
 *
 * With a query under 2 characters and a `zeroState` supplied, it renders that
 * instead - the panel the visitor who does not yet know what they want gets on
 * focus (master 5.10). Same rows, same panel, different contents: it is an
 * ADDITION to the typed panel, not a second component.
 *
 * The panel root carries `dropdownMotion` ITSELF (callers wrap in
 * AnimatePresence, no extra motion wrapper): animating a positioned element
 * directly avoids the transform-containing-block jump that a static wrapper
 * causes when its transform is removed at animation end.
 */
export function SearchTypeahead({
    suggest,
    loading,
    query,
    locale,
    currency,
    dict,
    islandName,
    searchHref,
    tourHref,
    categoryHref,
    hubHref,
    destinations,
    destinationHref,
    zeroState,
    onSelect,
    inline = false,
}: {
    suggest: SearchSuggest | null;
    loading: boolean;
    query: string;
    locale: Locale;
    /** Shopper display currency (fallback label when a hit carries no `money`). */
    currency: Currency;
    dict: SearchDict;
    /** Active island display name; null = unscoped search. */
    islandName: string | null;
    searchHref: (q: string) => string;
    tourHref: (hit: SearchHit) => string;
    /** Null when no island is active (category pages are destination-scoped). */
    categoryHref: ((slug: string) => string) | null;
    hubHref: (destinationSlug: string, slug: string) => string;
    /**
     * Matched destinations - rendered before every other bucket (homepage hero).
     * `tours` is the island's live tour count, shown as the row's subtitle;
     * `image` is the island's hero photo, same as every other entity row.
     */
    destinations?: {
        name: string;
        slug: string;
        tours?: number;
        image?: string | null;
    }[];
    destinationHref?: (slug: string) => string;
    /**
     * Starting points for an empty query. Omit it and a short query simply
     * shows nothing, which is what the unscoped navbar search still does.
     */
    zeroState?: SearchZeroState;
    onSelect: () => void;
    /**
     * Render in the flow rather than as a dropdown - the mobile search layer
     * (Pastel #57) mounts this same panel full-height inside its own scroller.
     * ONE panel, two shells: building a second one for the layer is exactly
     * what the issue forbids.
     */
    inline?: boolean;
}) {
    const destinationMatches = destinationHref ? (destinations ?? []) : [];
    const hasAnything =
        destinationMatches.length > 0 ||
        (!!suggest &&
            (suggest.tours.length > 0 ||
                suggest.beyondTours.length > 0 ||
                suggest.categories.length > 0 ||
                suggest.hubs.length > 0 ||
                (suggest.collections?.length ?? 0) > 0));

    // Below the 2-character minimum there is nothing to search for yet, so the
    // panel offers somewhere to go instead of an empty box. Checked BEFORE the
    // loading/no-results branches, which are about a query that exists.
    const zeroEntries = zeroState
        ? [...zeroState.categoriesAndHubs, ...zeroState.collections]
        : [];
    if (
        query.trim().length < 2 &&
        (zeroEntries.length > 0 || (zeroState?.topTours.length ?? 0) > 0)
    ) {
        // Groups render in master 5.10's order and each one is skipped when
        // empty, so the FIRST group present owns the panel's top edge - it must
        // not draw the divider SectionHeader puts between groups.
        const groups: { heading: string; entries: SearchZeroStateEntry[] }[] = [
            {
                heading: dict.categoriesAndHubs,
                entries: zeroState!.categoriesAndHubs,
            },
            { heading: dict.collections, entries: zeroState!.collections },
        ].filter(group => group.entries.length > 0);

        return (
            <Panel inline={inline}>
                <>
                    {groups.map(({ heading, entries }, groupIndex) => (
                        <div key={heading}>
                            {groupIndex === 0 ? (
                                <p className='m-0 px-4 pt-3.5 pb-1.5 text-[13px] font-medium text-it-heading tracking-[-0.012em]'>
                                    {heading}
                                </p>
                            ) : (
                                <SectionHeader>{heading}</SectionHeader>
                            )}
                            <ul className='m-0 list-none p-0 pb-1.5'>
                                {entries.map(entry => (
                                    <EntityRow
                                        key={`${entry.kind}-${entry.href}`}
                                        href={entry.href}
                                        onSelect={onSelect}
                                        image={entry.image ?? null}
                                        label={entry.name}
                                        subtitle={
                                            entry.tours == null
                                                ? undefined
                                                : entry.tours === 1
                                                  ? dict.tourCountOne
                                                  : dict.tourCount.replace(
                                                        '{count}',
                                                        String(entry.tours)
                                                    )
                                        }
                                    />
                                ))}
                            </ul>
                        </div>
                    ))}

                    {zeroState!.topTours.length > 0 && (
                        <>
                            {groups.length === 0 ? (
                                <p className='m-0 px-4 pt-3.5 pb-1.5 text-[13px] font-medium text-it-heading tracking-[-0.012em]'>
                                    {dict.topTours}
                                </p>
                            ) : (
                                <SectionHeader>{dict.topTours}</SectionHeader>
                            )}
                            <ul className='m-0 list-none p-0 pb-1.5'>
                                {zeroState!.topTours.map(hit => (
                                    <TourRow
                                        key={hit.id}
                                        hit={hit}
                                        contextLabel={hit.categoryName ?? null}
                                        locale={locale}
                                        currency={currency}
                                        dict={dict}
                                        href={tourHref(hit)}
                                        onSelect={onSelect}
                                    />
                                ))}
                            </ul>
                        </>
                    )}

                    {zeroState!.allTours && (
                        <Link
                            href={zeroState!.allTours.href}
                            onClick={onSelect}
                            className='block border-t border-it-border px-5 py-3 text-center text-[13px] font-medium text-it-primary no-underline transition-colors hover:bg-it-surface tracking-[-0.012em]'>
                            {zeroState!.allTours.label}
                        </Link>
                    )}
                </>
            </Panel>
        );
    }

    return (
        <Panel inline={inline}>
            {loading && !hasAnything ? (
                <p className='m-0 px-5 py-4 text-[13px] text-it-text-muted tracking-[-0.012em]'>
                    {dict.searching}
                </p>
            ) : !hasAnything ? (
                <p className='m-0 px-5 py-4 text-[13px] text-it-text-muted tracking-[-0.012em]'>
                    {dict.noResults.replace('{query}', query)}
                </p>
            ) : (
                <>
                    {/* ── Entity shortcuts ── */}
                    <ul className='m-0 list-none p-0 py-1.5'>
                        {/* Destinations always outrank every other bucket. */}
                        {destinationHref &&
                            destinationMatches.map(d => (
                                <EntityRow
                                    key={d.slug}
                                    href={destinationHref(d.slug)}
                                    onSelect={onSelect}
                                    image={d.image ?? null}
                                    label={d.name}
                                    subtitle={
                                        d.tours == null
                                            ? undefined
                                            : d.tours === 1
                                              ? dict.tourCountOne
                                              : dict.tourCount.replace(
                                                    '{count}',
                                                    String(d.tours)
                                                )
                                    }
                                />
                            ))}
                        {query.trim().length >= 2 && (
                            <EntityRow
                                href={searchHref(query)}
                                onSelect={onSelect}
                                icon={<Search size={18} strokeWidth={1.5} />}
                                label={<>&ldquo;{query}&rdquo;</>}
                                subtitle={dict.seeAllTours}
                            />
                        )}
                        {categoryHref &&
                            (suggest?.categories ?? []).map(cat => (
                                <EntityRow
                                    key={cat.id}
                                    href={categoryHref(cat.slug)}
                                    onSelect={onSelect}
                                    image={cat.image}
                                    label={cat.name}
                                    subtitle={
                                        cat.tourCount === 1
                                            ? dict.tourCountOne
                                            : dict.tourCount.replace(
                                                  '{count}',
                                                  String(cat.tourCount)
                                              )
                                    }
                                />
                            ))}
                        {(suggest?.hubs ?? []).map(hub => (
                            <EntityRow
                                key={hub.id}
                                href={hubHref(hub.destinationSlug, hub.slug)}
                                onSelect={onSelect}
                                image={hub.image}
                                label={hub.name}
                                subtitle={hub.destinationName}
                            />
                        ))}
                        {/* Collections share the hub href shape - one flat
                            `/{destination}/{slug}` namespace covers both. */}
                        {(suggest?.collections ?? []).map(collection => (
                            <EntityRow
                                key={collection.id}
                                href={hubHref(
                                    collection.destinationSlug,
                                    collection.slug
                                )}
                                onSelect={onSelect}
                                image={collection.image}
                                label={collection.name}
                                subtitle={collection.destinationName}
                            />
                        ))}
                    </ul>

                    {/* ── Tours in the active island ── */}
                    {!!suggest && suggest.tours.length > 0 && (
                        <>
                            {islandName && (
                                <SectionHeader>
                                    {dict.toursIn.replace('{name}', islandName)}
                                </SectionHeader>
                            )}
                            <ul className='m-0 list-none p-0 pb-1.5'>
                                {suggest.tours.map(hit => (
                                    <TourRow
                                        key={hit.id}
                                        hit={hit}
                                        contextLabel={hit.categoryName ?? null}
                                        locale={locale}
                                        currency={currency}
                                        dict={dict}
                                        href={tourHref(hit)}
                                        onSelect={onSelect}
                                    />
                                ))}
                            </ul>
                        </>
                    )}

                    {/* ── Beyond the active island ── */}
                    {islandName &&
                        !!suggest &&
                        suggest.beyondTours.length > 0 && (
                            <>
                                <SectionHeader>
                                    {dict.beyond.replace('{name}', islandName)}
                                </SectionHeader>
                                <ul className='m-0 list-none p-0 pb-1.5'>
                                    {suggest.beyondTours.map(hit => (
                                        <TourRow
                                            key={hit.id}
                                            hit={hit}
                                            contextLabel={
                                                hit.destinationName ?? null
                                            }
                                            contextKind='destination'
                                            locale={locale}
                                            currency={currency}
                                            dict={dict}
                                            href={tourHref(hit)}
                                            onSelect={onSelect}
                                        />
                                    ))}
                                </ul>
                            </>
                        )}

                    {!!suggest && suggest.total > 0 && (
                        <Link
                            href={searchHref(query)}
                            onClick={onSelect}
                            className='block border-t border-it-border px-5 py-3 text-center text-[13px] font-medium text-it-primary no-underline transition-colors hover:bg-it-surface tracking-[-0.012em]'>
                            {dict.seeAll.replace(
                                '{count}',
                                String(suggest.total)
                            )}
                        </Link>
                    )}
                </>
            )}
        </Panel>
    );
}

