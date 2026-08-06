import { Reveal } from '../reveal';
import { TourCard, type TourCardDict, type TourListing } from '../tour-card';

/**
 * Related-tours block on the tour detail page (Figma node 47936:3964) - used for
 * both "More {category} in {destination}" and "More to explore in
 * {destination}". A heading over a grid of the shared <TourCard>, with the same
 * responsive grid as the All Tours listing (2-col mobile, 3-col from lg).
 */
export function TourRelatedSection({
    title,
    tours,
    dict,
}: {
    title: string;
    tours: TourListing[];
    dict: TourCardDict;
}) {
    if (tours.length === 0) return null;

    return (
        <div className='flex flex-col gap-3.5'>
            <Reveal>
                <h2 className='m-0 font-it-display text-[20px] font-bold leading-[1.2] tracking-[-0.012em] text-it-ink'>
                    {title}
                </h2>
            </Reveal>
            {/* v2 .relgrid: three columns, stacked row cards on mobile. */}
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4'>
                {tours.map(tour => (
                    <Reveal key={tour.id} listItem>
                        <TourCard tour={tour} dict={dict} mobileRow />
                    </Reveal>
                ))}
            </div>
        </div>
    );
}
