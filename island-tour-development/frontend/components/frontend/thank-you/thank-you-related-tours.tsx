import { MotionLink } from '@/components/frontend/motion-link';
import { Reveal } from '@/components/frontend/reveal';
import { ScrollHintRow } from '@/components/frontend/scroll-hint';
import {
    TourCard,
    type TourCardDict,
    type TourListing,
} from '@/components/frontend/tour-card';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { springPop } from '@/lib/motion';

type ThankYouDict = Dictionary['thankYou'];

/**
 * "Islanders also love..." cross-sell (design v2 .upsell): locked H2 +
 * sub-line, then three shared <TourCard>s - whole card clickable, no per-card
 * CTA. Desktop is a 3-up grid; mobile is a horizontal swipe with 1.5 cards
 * visible (64% snap items). A plain deep-orange text link recovers to the
 * full listing.
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
        <section className='bg-it-white pt-14 pb-0'>
            <div className='it-wrap flex flex-col'>
                <Reveal>
                    <h2 className='m-0 font-it-display text-[clamp(20px,2.4vw,26px)] leading-[1.2] tracking-[-0.012em] text-it-heading font-medium'>
                        {dict.relatedTitle}
                    </h2>
                    <p className='m-0 mt-1.5 text-[16px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                        {dict.relatedSubtitle}
                    </p>
                </Reveal>
                {/* Mobile swipe row announces itself once via the sitewide
                    scroll hint (mck-16 §4.8); the sm+ grid has no overflow,
                    so the hint self-skips there. */}
                <ScrollHintRow className='mt-[22px] flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:snap-none sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:pb-0'>
                    {tours.map(tour => (
                        <Reveal
                            key={tour.id}
                            width='auto'
                            listItem
                            className='w-[64%] flex-none snap-start sm:w-auto'>
                            <TourCard tour={tour} dict={cardDict} />
                        </Reveal>
                    ))}
                </ScrollHintRow>
                <Reveal className='mt-6'>
                    <MotionLink
                        href={toursHref}
                        whileTap={{ scale: 0.97 }}
                        transition={springPop}
                        className='inline-block text-[14.5px] font-medium leading-[1.6] text-it-primary-hover underline underline-offset-[3px] transition-colors duration-300 hover:text-it-primary'>
                        {dict.browsePicks} →
                    </MotionLink>
                </Reveal>
            </div>
        </section>
    );
}

