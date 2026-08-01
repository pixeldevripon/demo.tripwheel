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
        // Design v2 (5.6): the intro is BODY text tight under the banner, then
        // the curated grid - 3-column LOCK (collections never go 4-up), no
        // sort, no filters, no peach: the editorial order is the product and
        // the rank circle is the signal.
        <section className='bg-it-white pb-4'>
            <div className='it-container'>
                <Reveal className='flex flex-col'>
                    <p className='m-0 max-w-[660px] pt-[34px] pb-3.5 text-[18px] leading-[1.6] text-it-ink text-pretty'>
                        {intro}
                    </p>

                    <div className='mt-[26px] grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-x-[18px] sm:gap-y-[22px]'>
                        {tours.map(tour => (
                            <MountReveal key={tour.id} listItem>
                                <TourCard tour={tour} dict={dict} mobileRow />
                            </MountReveal>
                        ))}
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

