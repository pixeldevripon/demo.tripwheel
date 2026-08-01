import {
    Bar,
    DESTINATION_CARD_CELL,
    COLLECTION_CARD_CELL,
    COLLECTION_RAIL,
    DESTINATION_RAIL,
} from './skeleton-bar';
import { CollectionCardSkeleton } from './collection-card-skeleton';
import { TourCardSkeleton } from './tour-card-skeleton';

/** Hero band + "Explore by type" row (mirrors DestinationHero + DestinationExploreTypes). */
export function DestinationHeroSkeleton() {
    return (
        <>
            {/* Hero: heading group (title + subtitle) + split search box + activities line. */}
            {/* Flat bg-it-hero-bg only - the real hero has no gradient, so the
                skeleton must not flash one during reload. */}
            <section className='relative z-20 flex h-[clamp(440px,66vh,560px)] items-end justify-center bg-it-hero-bg pb-11 md:h-[clamp(480px,62vh,640px)] md:items-center md:pb-0'>
                <div className='it-container flex w-full justify-center'>
                    <div className='flex w-full max-w-[680px] flex-col items-center gap-7'>
                        <div className='flex w-full flex-col items-center gap-3'>
                            <Bar className='h-9 w-3/4 max-w-md md:h-11' />
                            <Bar className='h-5 w-2/3 max-w-sm rounded-it-sm' />
                        </div>
                        <div className='flex w-full flex-col items-center gap-4'>
                            <Bar className='h-[62px] w-full rounded-it-lg' />
                            <Bar className='h-4 w-64 max-w-full rounded-it-sm' />
                        </div>
                    </div>
                </div>
            </section>
            {/* Explore by type: section head + rail of 196px tiles (design v2
                .catskl: one solid block per tile, aspect 4/4.4). */}
            <section className='bg-it-white pt-11 md:pt-14'>
                <div className='it-container flex flex-col gap-5'>
                    <div className='flex flex-col gap-2'>
                        <Bar className='h-3 w-24 rounded-it-xs' />
                        <Bar className='h-8 w-56' />
                    </div>
                    <div className='flex gap-3.5 overflow-hidden px-1 py-1'>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Bar
                                key={i}
                                className='w-[38vw] sm:w-[196px] aspect-[4/4.4] shrink-0'
                            />
                        ))}
                    </div>
                </div>
            </section>
        </>
    );
}

/**
 * "Locals' favorites" section (mirrors DestinationListings): heading, the
 * mobile-carousel / lg-grid of 6 `TourCardSkeleton`s in the real rail, and the
 * centered "Browse all" CTA that floats on a divider line.
 */
export function DestinationFavouritesSkeleton() {
    return (
        <section className='bg-it-white pt-11 md:pt-14'>
            <div className='it-container'>
                <div className='flex flex-col gap-5'>
                    <div className='flex flex-col gap-2'>
                        <Bar className='h-3 w-52 rounded-it-xs' />
                        <Bar className='h-8 w-56 max-w-full' />
                    </div>

                    <div className={DESTINATION_RAIL}>
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className={DESTINATION_CARD_CELL}>
                                <TourCardSkeleton />
                            </div>
                        ))}
                    </div>

                    {/* See-all CTA block. */}
                    <div className='mt-2 flex justify-center'>
                        <Bar className='h-13 w-72 rounded-it-sm max-sm:w-full' />
                    </div>
                </div>
            </div>
        </section>
    );
}

/**
 * Collections section (mirrors DestinationCollections): `!pt-0`, heading, and
 * the mobile-carousel / lg-grid of 6 `CollectionCardSkeleton`s in the real rail.
 * No "Browse all" CTA (the real section has none).
 */
export function DestinationCollectionsSkeleton() {
    return (
        <section className='bg-it-white pt-11 md:pt-14'>
            <div className='it-container'>
                <div className='flex flex-col gap-5'>
                    <Bar className='h-8 w-56 max-w-full' />

                    <div className={COLLECTION_RAIL}>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className={COLLECTION_CARD_CELL}>
                                <CollectionCardSkeleton />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

/** About editorial block (mirrors DestinationAbout: kicker + prose + 3 cols). */
export function DestinationAboutSkeleton() {
    return (
        <section className='bg-it-white py-11 md:pt-14 md:pb-20'>
            <div className='it-container flex flex-col gap-5'>
                <Bar className='h-3 w-44 rounded-it-xs' />
                <div className='flex flex-col gap-2.5'>
                    <Bar className='h-4 w-full rounded-it-sm' />
                    <Bar className='h-4 w-4/5 rounded-it-sm' />
                </div>
                <div className='grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8'>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Bar key={i} className='h-56 w-full' />
                    ))}
                </div>
            </div>
        </section>
    );
}

/**
 * Full destination-page skeleton for the route's `loading.tsx` - composes the
 * section skeletons in page order so the initial load mirrors the real page and
 * hands off seamlessly to the fully-rendered (cached-static) page.
 */
export function DestinationPageSkeleton() {
    return (
        <>
            <DestinationHeroSkeleton />
            <DestinationFavouritesSkeleton />
            <DestinationCollectionsSkeleton />
            <DestinationAboutSkeleton />
        </>
    );
}
