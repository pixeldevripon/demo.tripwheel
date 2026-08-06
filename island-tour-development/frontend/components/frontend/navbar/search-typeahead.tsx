'use client';

import { motion } from 'framer-motion';
import { ChevronRight, Folder, LayoutGrid, MapPin, Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import {
    isCurrency,
    type Currency,
    type Locale,
} from '@/lib/constants/locales';
import { formatPriceFrom } from '@/lib/currency/current';
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
     * Glyph rows (the typed panel). Omit it and the square becomes a PHOTO slot
     * instead - see `image`.
     */
    icon?: React.ReactNode;
    /**
     * The target page's own photo (the zero state). Passing the prop at all -
     * even as null - makes the square a photo slot: a real photo when there is
     * one, and otherwise the same flat `bg-it-bg` surface every image container
     * on the site falls back to, which is exactly what the navbar Categories
     * dropdown does for a category with no picture. Deliberately NOT a stand-in
     * glyph: a panel of identical grey icons tells the visitor nothing about
     * where each row goes, which is the whole job of the zero state.
     */
    image?: string | null;
    label: React.ReactNode;
    subtitle?: string;
}) {
    return (
        <li>
            <Link
                href={href}
                onClick={onSelect}
                className='flex items-center gap-3 px-4 py-2.5 no-underline transition-colors hover:bg-it-surface'>
                <span
                    className={`relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-it-md text-it-heading ${icon ? 'bg-it-surface' : 'bg-it-bg'}`}>
                    {image && (
                        <Image
                            src={image}
                            alt=''
                            fill
                            sizes='44px'
                            className='object-cover'
                        />
                    )}
                    {icon}
                </span>
                <span className='min-w-0 flex-1'>
                    <span className='block truncate text-sm font-normal text-it-ink'>
                        {label}
                    </span>
                    {subtitle && (
                        <span className='mt-0.5 block truncate text-xs text-it-ink-muted'>
                            {subtitle}
                        </span>
                    )}
                </span>
                <ChevronRight
                    size={16}
                    strokeWidth={1.5}
                    className='shrink-0 text-it-ink-muted'
                />
            </Link>
        </li>
    );
}

/** Section header ("Tours in Aruba" / "Beyond Aruba"). */
function SectionHeader({ children }: { children: React.ReactNode }) {
    return (
        <p className='m-0 border-t border-it-border px-4 pt-3.5 pb-1.5 text-sm font-semibold text-it-heading'>
            {children}
        </p>
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
                <span className='relative size-14 shrink-0 overflow-hidden rounded-it-md bg-it-surface'>
                    {hit.images[0]?.url && (
                        <Image
                            src={hit.images[0].url}
                            alt=''
                            fill
                            sizes='56px'
                            className='object-cover'
                        />
                    )}
                </span>
                <span className='min-w-0 flex-1'>
                    {contextLabel && (
                        <span className='flex items-center gap-1 text-xs text-it-ink-muted'>
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
                    <span className='block truncate text-sm font-normal text-it-ink'>
                        {hit.title}
                    </span>
                    {meta.length > 0 && (
                        <span className='mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-it-ink-muted'>
                            {meta.map((node, i) => (
                                <span
                                    key={i}
                                    className='inline-flex items-center gap-1.5'>
                                    {i > 0 && (
                                        <span className='text-it-ink/30'>
                                            ·
                                        </span>
                                    )}
                                    {node}
                                </span>
                            ))}
                        </span>
                    )}
                    <span className='mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs'>
                        <span className='font-normal text-it-ink'>
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
                                <span className='text-it-ink/30'>·</span>
                                <span className='text-it-ink-muted'>
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
     * `tours` is the island's live tour count, shown as the row's subtitle.
     */
    destinations?: { name: string; slug: string; tours?: number }[];
    destinationHref?: (slug: string) => string;
    /**
     * Starting points for an empty query. Omit it and a short query simply
     * shows nothing, which is what the unscoped navbar search still does.
     */
    zeroState?: SearchZeroState;
    onSelect: () => void;
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
            <motion.div
                {...dropdownMotion}
                className='absolute left-0 right-0 top-[calc(100%+8px)] z-50 origin-top overflow-hidden rounded-it-sm border border-it-border-subtle bg-it-white shadow-it-lg'>
                <div className='max-h-[70vh] overflow-y-auto overscroll-contain'>
                    {groups.map(({ heading, entries }, groupIndex) => (
                        <div key={heading}>
                            {groupIndex === 0 ? (
                                <p className='m-0 px-4 pt-3.5 pb-1.5 text-sm font-semibold text-it-heading'>
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
                                <p className='m-0 px-4 pt-3.5 pb-1.5 text-sm font-semibold text-it-heading'>
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
                            className='block border-t border-it-border px-5 py-3 text-center text-sm font-normal text-it-primary no-underline transition-colors hover:bg-it-surface'>
                            {zeroState!.allTours.label}
                        </Link>
                    )}
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            {...dropdownMotion}
            className='absolute left-0 right-0 top-[calc(100%+8px)] z-50 origin-top overflow-hidden rounded-it-sm border border-it-border-subtle bg-it-white shadow-it-lg'>
            {loading && !hasAnything ? (
                <p className='m-0 px-5 py-4 text-sm text-it-ink-muted'>
                    {dict.searching}
                </p>
            ) : !hasAnything ? (
                <p className='m-0 px-5 py-4 text-sm text-it-ink-muted'>
                    {dict.noResults.replace('{query}', query)}
                </p>
            ) : (
                <div className='max-h-[70vh] overflow-y-auto overscroll-contain'>
                    {/* ── Entity shortcuts ── */}
                    <ul className='m-0 list-none p-0 py-1.5'>
                        {/* Destinations always outrank every other bucket. */}
                        {destinationHref &&
                            destinationMatches.map(d => (
                                <EntityRow
                                    key={d.slug}
                                    href={destinationHref(d.slug)}
                                    onSelect={onSelect}
                                    icon={
                                        <MapPin size={18} strokeWidth={1.5} />
                                    }
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
                                    icon={
                                        <LayoutGrid
                                            size={18}
                                            strokeWidth={1.5}
                                        />
                                    }
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
                                icon={<MapPin size={18} strokeWidth={1.5} />}
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
                                icon={<Folder size={18} strokeWidth={1.5} />}
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
                            className='block border-t border-it-border px-5 py-3 text-center text-sm font-normal text-it-primary no-underline transition-colors hover:bg-it-surface'>
                            {dict.seeAll.replace(
                                '{count}',
                                String(suggest.total)
                            )}
                        </Link>
                    )}
                </div>
            )}
        </motion.div>
    );
}

