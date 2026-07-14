'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

import { dropdownMotion } from '@/lib/motion';
import { formatDuration } from '@/lib/tours/listing';
import type { SearchHit } from '@/types/search';

import type { SearchDict } from './lib/navbar.types';

const currencySymbol = (code: string): string =>
    code === 'EUR' ? '€' : code === 'GBP' ? '£' : '$';

/**
 * Presentational typeahead panel - the live preview of matching tours shown
 * under the search field (shared by the desktop pill and the mobile overlay).
 * All data + href building is passed in; this only renders.
 *
 * The panel root carries `dropdownMotion` ITSELF (callers wrap in
 * AnimatePresence, no extra motion wrapper): animating a positioned element
 * directly avoids the transform-containing-block jump that a static wrapper
 * causes when its transform is removed at animation end.
 */
export function SearchTypeahead({
    hits,
    total,
    loading,
    query,
    dict,
    searchHref,
    tourHref,
    onSelect,
}: {
    hits: SearchHit[];
    total: number;
    loading: boolean;
    query: string;
    dict: SearchDict;
    searchHref: (q: string) => string;
    tourHref: (hit: SearchHit) => string;
    onSelect: () => void;
}) {
    return (
        <motion.div
            {...dropdownMotion}
            className='absolute left-0 right-0 top-[calc(100%+8px)] z-50 origin-top overflow-hidden rounded-it-lg border border-it-border bg-it-white shadow-it-lg'>
            {loading && hits.length === 0 ? (
                <p className='m-0 px-5 py-4 text-sm text-it-ink-muted'>
                    {dict.searching}
                </p>
            ) : hits.length === 0 ? (
                <p className='m-0 px-5 py-4 text-sm text-it-ink-muted'>
                    {dict.noResults.replace('{query}', query)}
                </p>
            ) : (
                <>
                    <ul className='m-0 list-none p-0'>
                        {hits.map(hit => {
                            const duration = formatDuration(
                                hit.durationMinutesFrom,
                                hit.durationMinutesTo,
                                dict
                            );
                            const meta: React.ReactNode[] = [];
                            if (hit.aggregateReviewCount > 0) {
                                meta.push(
                                    <span
                                        key='r'
                                        className='inline-flex items-center gap-0.5'>
                                        <Image
                                            src='/icons/star-listings.svg'
                                            alt=''
                                            width={12}
                                            height={12}
                                            className='size-3'
                                        />
                                        {hit.aggregateRating} (
                                        {hit.aggregateReviewCount})
                                    </span>
                                );
                            }
                            if (duration)
                                meta.push(<span key='d'>{duration}</span>);
                            if (hit.pickupModel !== 'NONE')
                                meta.push(
                                    <span key='p'>{dict.pickupAvailable}</span>
                                );
                            return (
                                <li key={hit.id}>
                                    <Link
                                        href={tourHref(hit)}
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
                                            <span className='block truncate text-sm font-medium text-it-ink'>
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
                                                <span className='font-medium text-it-ink'>
                                                    {dict.from}{' '}
                                                    {currencySymbol(
                                                        hit.defaultCurrency
                                                    )}
                                                    {Math.round(
                                                        Number(
                                                            hit.priceFrom ??
                                                                hit.basePrice ??
                                                                0
                                                        )
                                                    )}
                                                </span>
                                                {(hit.cancellationHours ?? 0) >
                                                    0 && (
                                                    <>
                                                        <span className='text-it-ink/30'>
                                                            ·
                                                        </span>
                                                        <span className='text-it-ink-muted'>
                                                            {
                                                                dict.freeCancellation
                                                            }
                                                        </span>
                                                    </>
                                                )}
                                            </span>
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                    <Link
                        href={searchHref(query)}
                        onClick={onSelect}
                        className='block border-t border-it-border px-5 py-3 text-center text-sm font-medium text-it-primary no-underline transition-colors hover:bg-it-surface'>
                        {dict.seeAll.replace('{count}', String(total))}
                    </Link>
                </>
            )}
        </motion.div>
    );
}
