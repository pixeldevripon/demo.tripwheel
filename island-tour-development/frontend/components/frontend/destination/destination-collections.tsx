/**
 * DestinationCollections - renders a list of collections on the destination page.
 * Mirrors the DestinationListings component.
 */

import { type Locale } from '@/lib/constants/locales';
import type { CollectionLocalized } from '@/types/collection';
import { CollectionCard } from '../collection-card';
import { Reveal } from '../reveal';

export interface DestinationCollectionsDict {
    title: string;
    explore: string;
}

interface DestinationCollectionsProps {
    dict: DestinationCollectionsDict;
    collections: CollectionLocalized[];
    destinationSlug: string;
    locale: Locale;
}

export function DestinationCollections({
    dict,
    collections,
    destinationSlug,
    locale,
}: DestinationCollectionsProps) {
    if (collections.length === 0) return null;

    return (
        <section id="collections" className='bg-it-white pt-11 md:pt-14'>
            <div className='it-container'>
                <Reveal className='flex flex-col gap-5'>
                    {/* ── Section heading (design v2 sechead) ───────────────── */}
                    <h2 className='m-0 text-[clamp(22px,2.6vw,30px)] leading-[1.1] tracking-[-0.015em] text-it-ink'>
                        {dict.title}
                    </h2>

                    {/* ── Collections ────────────────────────────────────────────────
                        Mobile: horizontal swipe carousel of compact cards.
                        sm+: standard 2 × 3 grid. */}
                    <div className='-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:grid lg:snap-none lg:grid-cols-3 lg:gap-x-6 lg:gap-y-10 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden'>
                        {collections.map(collection => (
                            <Reveal
                                key={collection.id}
                                width='auto'
                                listItem
                                className='w-[82vw] min-[480px]:w-[64vw] sm:w-[42vw] shrink-0 snap-start lg:w-auto'>
                                <CollectionCard
                                    collection={collection}
                                    locale={locale}
                                    destinationSlug={destinationSlug}
                                    dict={{ explore: dict.explore }}
                                />
                            </Reveal>
                        ))}
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

