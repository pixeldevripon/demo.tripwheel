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
        /* pb closes the white zone: with the Instagram feed disabled this is
           the last white section, and the cards sat flush against the grey FAQ
           band. When the feed IS on, it drops its own pt via the #collections+
           sibling variant, so the gap never doubles. */
        <section id="collections" className='bg-it-white pt-11 pb-11 md:pt-14 md:pb-16'>
            <div className='it-container'>
                <Reveal className='flex flex-col gap-5'>
                    {/* ── Section heading (design v2 sechead) ───────────────── */}
                    <h2 className='m-0 text-[clamp(22px,2.6vw,30px)] leading-[1.1] tracking-[-0.015em] text-it-ink'>
                        {dict.title}
                    </h2>

                    {/* ── Collections ────────────────────────────────────────────────
                        Mobile: stacked list (same rhythm as the tour grid).
                        sm: 2-col · lg: 4-col grid. */}
                    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 lg:gap-x-4 lg:gap-y-5'>
                        {collections.map(collection => (
                            <Reveal
                                key={collection.id}
                                width='auto'
                                listItem>
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

