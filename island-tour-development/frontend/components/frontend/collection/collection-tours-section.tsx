import { MountReveal } from '../mount-reveal';
import { Reveal } from '../reveal';
import { TourCard, type TourCardDict, type TourListing } from '../tour-card';

interface CollectionToursSectionProps {
    /** Editorial lead-in paragraph (SEO copy above the ranked grid). */
    intro: string;
    /** Ranked tours - each carries a `rank` so <TourCard> renders the ranked variant. */
    tours: TourListing[];
    dict: TourCardDict;
}

/**
 * Collection ranked-tour grid (Figma node 47433:2088). An intro paragraph, a
 * hairline divider, then the ranked <TourCard>s in the same responsive grid as
 * the All Tours listing page (2-col on mobile, 3-col from lg). Pure Server
 * Component - the interactive card leaf is <TourCard>.
 */
export function CollectionToursSection({
    intro,
    tours,
    dict,
}: CollectionToursSectionProps) {
    return (
        <section className='it-section bg-it-white pt-15!'>
            <div className='it-container'>
                <Reveal className='flex flex-col gap-10'>
                    <p className='m-0 max-w-278 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                        {intro}
                    </p>

                    <div
                        aria-hidden='true'
                        className='h-px w-full bg-it-heading/10'
                    />

                    {/* Sitewide tour grid: 2-col mobile, 3-col sm, 4-col lg. */}
                    <div className='grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4'>
                        {tours.map((tour, i) => (
                            <MountReveal key={tour.id} listItem>
                                <TourCard
                                    tour={tour}
                                    dict={dict}
                                    highlighted={i === 0}
                                />
                            </MountReveal>
                        ))}
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

