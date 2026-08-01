/**
 * Collection card - the design v2 card contract (same anatomy as TourCard but
 * without pricing/duration): flat bordered card, 12px radius, 2px hover lift
 * with the card-hover shadow, photo scrim, 260ms photo zoom. On mobile it
 * renders as the compact horizontal row card (image 40 / content 60), same as
 * the tour list rows.
 */

import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { CollectionLocalized } from '@/types/collection';
import { localizeHref, type Locale } from '@/lib/constants/locales';

export interface CollectionCardProps {
    collection: CollectionLocalized;
    locale: Locale;
    destinationSlug: string;
    dict: { explore: string };
    className?: string;
}

export function CollectionCard({
    collection,
    locale,
    destinationSlug,
    dict,
    className = '',
}: CollectionCardProps) {
    const href = localizeHref(locale, `/${destinationSlug}/${collection.slug}`);
    const activeImage = collection.heroImage || '';

    return (
        <Link
            href={href}
            aria-label={collection.name}
            className='block h-full rounded-it-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-it-primary'>
            <article
                className={cn(
                    '@container group flex h-full flex-col overflow-hidden rounded-it-md border border-transparent bg-it-white will-change-transform transition-all duration-(--it-duration-md) ease-(--it-ease) hover:-translate-y-0.5 hover:shadow-it-card-hover hover:border-it-card-hover-border',
                    'max-sm:flex-row max-sm:border-it-divider',
                    className,
                )}>
                {/* ── Image area ─────────────────────────────────────────── */}
                <div className='relative aspect-3/2 w-full shrink-0 overflow-hidden rounded-t-[12px] bg-it-bg [&_img]:transition-transform [&_img]:duration-(--it-duration-md) [&_img]:ease-(--it-ease) group-hover:[&_img]:scale-[1.03] max-sm:w-2/5 max-sm:aspect-auto max-sm:rounded-l-[12px] max-sm:rounded-tr-none'>
                    {activeImage && (
                        <Image
                            src={activeImage}
                            alt={collection.name}
                            fill
                            sizes='(max-width: 640px) 40vw, (max-width: 1024px) 50vw, 384px'
                            className='object-cover'
                        />
                    )}
                    {/* Soft bottom scrim over the photo edge (design v2). */}
                    <div className='pointer-events-none absolute inset-0 z-1 bg-[image:var(--it-scrim-tile)]' />
                </div>

                {/* ── Card info ──────────────────────────────────────────── */}
                <div className='flex flex-1 min-w-0 flex-col gap-1 px-3 pt-2.5 pb-3 @[220px]:px-3.5 @[220px]:pt-3 @[220px]:pb-3.5'>
                    <h3 className='m-0 font-it-body font-bold text-[13px] @[220px]:text-[15.5px] leading-[1.3] tracking-[-0.005em] text-it-ink line-clamp-2'>
                        {collection.name}
                    </h3>

                    {/* Explore indicator - pinned to the card foot. */}
                    <div className='mt-auto flex items-center gap-1 pt-2'>
                        <span className='text-[12px] @[220px]:text-[12.5px] font-bold leading-[1.6] text-it-primary-hover'>
                            {dict.explore}
                        </span>
                        <Image
                            src='/icons/cta-arrow-right.svg'
                            alt=''
                            width={16}
                            height={16}
                            className='size-3 @[220px]:size-3.5 transition-transform duration-(--it-duration-xs) ease-(--it-ease) group-hover:translate-x-0.5'
                            aria-hidden='true'
                        />
                    </div>
                </div>
            </article>
        </Link>
    );
}
