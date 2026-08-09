'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

import { localizeHref, type Locale } from '@/lib/constants/locales';
import { springPop } from '@/lib/motion';
import type { UnbookableSavedTour } from '@/lib/api/wishlist';
import { cn } from '@/lib/utils';

export type SavedUnbookableDict = {
    /** "Not bookable right now" */
    notBookable: string;
    /** "See similar tours" */
    seeSimilar: string;
    /** aria-label for the heart, carries {title}. */
    removeFromList: string;
};

/**
 * A saved tour that has stopped being sellable (mck-17).
 *
 * It is DRAWN rather than dropped. The traveller put it on the list, so the
 * traveller decides what leaves it - and a card that quietly disappears reads
 * as a bug in the list rather than as a change at the operator, while taking
 * the one moment we have to offer something like it instead.
 *
 * Dimmed, desaturated and not clickable, because there is nothing on the other
 * end of a click. The heart still works: it is the only control here, and it is
 * the one the traveller needs.
 */
export function SavedUnbookableCard({
    tour,
    locale,
    dict,
    onHeart,
    saved,
    mobileRow = false,
}: {
    tour: UnbookableSavedTour;
    locale: Locale;
    dict: SavedUnbookableDict;
    /** Removes on your own list; saves on somebody else's. */
    onHeart: (tourId: string) => void;
    /** Whether the heart reads as filled - always true on your own list. */
    saved: boolean;
    mobileRow?: boolean;
}) {
    const image = tour.images[0];
    // The nearest similar thing is its own category on its own island; failing
    // that, the island's full list. With neither we show no link at all rather
    // than a dead end dressed as a way out.
    const similarHref = tour.destinationSlug
        ? localizeHref(
              locale,
              tour.primaryCategorySlug
                  ? `/${tour.destinationSlug}/${tour.primaryCategorySlug}`
                  : `/${tour.destinationSlug}/tours`
          )
        : null;

    return (
        <article
            aria-label={tour.title}
            className={cn(
                '@container group flex h-full flex-col overflow-hidden rounded-it-md border border-it-divider bg-it-white opacity-[0.72]',
                mobileRow && 'max-sm:flex-row max-sm:min-h-[170px]'
            )}>
            <div
                className={cn(
                    'relative aspect-3/2 w-full shrink-0 overflow-hidden rounded-t-[12px] bg-it-bg',
                    mobileRow &&
                        'max-sm:w-2/5 max-sm:aspect-auto max-sm:rounded-l-[12px] max-sm:rounded-tr-none'
                )}>
                {image && (
                    <Image
                        src={image.url}
                        alt={image.altText ?? ''}
                        fill
                        sizes='(max-width: 640px) 40vw, (max-width: 1024px) 50vw, 384px'
                        className='object-cover grayscale'
                    />
                )}

                <motion.button
                    type='button'
                    aria-label={dict.removeFromList.replace(
                        '{title}',
                        tour.title
                    )}
                    aria-pressed={saved}
                    onClick={() => onHeart(tour.id)}
                    whileTap={{ scale: 0.9 }}
                    transition={springPop}
                    className={cn(
                        'absolute right-2 top-2 @[220px]:right-2.5 @[220px]:top-2.5 z-10 flex size-6 @[220px]:size-[34px] cursor-pointer items-center justify-center rounded-full border-none bg-it-white/92 shadow-it-sm transition-transform duration-(--it-duration-xs) ease-(--it-ease) hover:scale-[1.08]',
                        mobileRow && 'max-sm:top-auto max-sm:bottom-2'
                    )}>
                    <Image
                        src={saved ? '/icons/heart-filled.svg' : '/icons/heart-outline.svg'}
                        alt=''
                        width={24}
                        height={24}
                        className='size-[13px] @[220px]:size-[17px]'
                        aria-hidden='true'
                    />
                </motion.button>
            </div>

            <div className='flex flex-1 min-w-0 flex-col gap-1 px-3 pt-2.5 pb-3 @[220px]:px-3.5 @[220px]:pt-3 @[220px]:pb-3.5'>
                <h3 className='m-0 font-it-body font-bold text-[13px] @[220px]:text-[15.5px] leading-[1.3] tracking-[-0.005em] text-it-ink line-clamp-2'>
                    {tour.title}
                </h3>
                <p className='m-0 mt-1 text-[13px] font-bold leading-[1.6] text-it-text-muted'>
                    {dict.notBookable}
                </p>
                {similarHref && (
                    <Link
                        href={similarHref}
                        className='mt-1.5 w-fit text-[13px] font-bold leading-[1.6] text-it-primary-hover underline underline-offset-[3px]'>
                        {dict.seeSimilar} &rarr;
                    </Link>
                )}
            </div>
        </article>
    );
}
