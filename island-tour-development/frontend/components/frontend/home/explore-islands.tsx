import { localizeHref, type Locale } from '@/lib/constants/locales';
import { springPop } from '@/lib/motion';
import Image from 'next/image';
import { MotionLink } from '../motion-link';
import { Reveal } from '../reveal';

// Live destinations, mapped from getActiveDestinations in the page. A missing
// hero image falls back to the card's grey `bg-it-border` (the sitewide image
// fallback), not a stand-in photo.
type Island = {
    name: string;
    slug: string;
    tours: number;
    image: string | null;
};

export function ExploreIslands({
    dict,
    locale,
    islands,
}: {
    dict: { title: string; tours: string; seeMore: string };
    locale: Locale;
    islands: Island[];
}) {
    if (islands.length === 0) return null;

    return (
        <section className='it-section bg-it-white'>
            <div className='it-container'>
                <Reveal className='flex flex-col gap-6 md:gap-12'>
                    <h2 className='m-0 font-medium text-[32px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                        {dict.title}
                    </h2>

                    {/* Peek scroller - bleeds to the right container edge */}
                    <div className='it-scroll-x overflow-y-hidden gap-4 md:gap-6 pb-1 -mr-4 md:-mr-8 xl:-mr-30'>
                        {islands.map(island => (
                            <Reveal
                                key={island.slug}
                                width='auto'
                                listItem
                                className='shrink-0'>
                                <MotionLink
                                    href={localizeHref(
                                        locale,
                                        `/${island.slug}`
                                    )}
                                    whileTap={{ scale: 0.99 }}
                                    transition={springPop}
                                    className='group relative block h-51 w-40.5 shrink-0 overflow-hidden rounded-it-lg bg-it-border md:h-90.25 md:w-96'>
                                    {island.image && (
                                        <Image
                                            src={island.image}
                                            alt={island.name}
                                            fill
                                            sizes='(max-width: 768px) 162px, 384px'
                                            className='object-cover transition-transform duration-500 ease-out group-hover:scale-105'
                                        />
                                    )}

                                    {/* Bottom gradient scrim - transparent → #1a1a1a */}
                                    <div className='pointer-events-none absolute inset-x-0 bottom-0 h-28.25 bg-linear-to-b from-transparent to-it-ink md:h-61.75' />

                                    <div className='absolute bottom-4 left-4 flex flex-col gap-0.5 md:bottom-6 md:left-6 md:gap-2'>
                                        <span className='font-medium text-[18px] md:text-[24px] leading-[1.2] tracking-[-0.012em] text-it-white'>
                                            {island.name}
                                        </span>
                                        <span className='text-[12px] md:text-[14px] leading-[1.6] tracking-[-0.012em] text-it-white/70'>
                                            {island.tours} {dict.tours}
                                        </span>
                                    </div>
                                </MotionLink>
                            </Reveal>
                        ))}
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

