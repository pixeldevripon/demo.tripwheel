import { MotionLink } from '@/components/frontend/motion-link';
import { Reveal } from '@/components/frontend/reveal';
import {
    TourCard,
    type TourCardDict,
    type TourListing,
} from '@/components/frontend/tour-card';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { springPop } from '@/lib/motion';

type ThankYouDict = Dictionary['thankYou'];

/**
 * "Islanders also love..." cross-sell (Figma 47745-11818): the shared
 * <TourCard> grid plus a centered "browse top picks" link sitting on a
 * divider line.
 */
export function ThankYouRelatedTours({
    tours,
    dict,
    cardDict,
    toursHref,
}: {
    tours: TourListing[];
    dict: ThankYouDict;
    cardDict: TourCardDict;
    toursHref: string;
}) {
    if (tours.length === 0) return null;

    return (
        <section className='it-section bg-it-white'>
            <div className='it-container flex flex-col gap-14'>
                <div className='flex flex-col gap-12'>
                    <Reveal className='flex flex-col gap-2'>
                        <h2 className='m-0 font-medium text-[28px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                            {dict.relatedTitle}
                        </h2>
                        <p className='m-0 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                            {dict.relatedSubtitle}
                        </p>
                    </Reveal>
                    <div className='grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4'>
                        {tours.map(tour => (
                            <Reveal key={tour.id} listItem>
                                <TourCard tour={tour} dict={cardDict} />
                            </Reveal>
                        ))}
                    </div>
                </div>
                <Reveal className='relative flex h-[46px] items-center justify-center'>
                    <span className='absolute inset-x-0 top-1/2 h-px bg-it-heading/10' />
                    <MotionLink
                        href={toursHref}
                        whileTap={{ scale: 0.97 }}
                        transition={springPop}
                        className='relative block bg-it-white p-2.5 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-primary transition-colors duration-300 hover:text-it-primary-hover'>
                        {dict.browsePicks}
                    </MotionLink>
                </Reveal>
            </div>
        </section>
    );
}
