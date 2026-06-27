import { Reveal } from './reveal';
import { TourCard, type TourCardDict, type TourListing } from './tour-card';

/**
 * Related-tours block on the tour detail page (Figma node 47936:3964) - used for
 * both "More {category} tours in {destination}" and "More to explore in
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
        <Reveal className='flex flex-col gap-6 md:gap-12'>
            <h2 className='m-0 font-medium text-[28px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                {title}
            </h2>
            <div className='grid grid-cols-2 gap-x-4 gap-y-4 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3'>
                {tours.map(tour => (
                    <TourCard key={tour.id} tour={tour} dict={dict} />
                ))}
            </div>
        </Reveal>
    );
}
