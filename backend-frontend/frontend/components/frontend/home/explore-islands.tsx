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
    dict: { title: string; subtitle?: string; tours: string; seeMore: string };
    locale: Locale;
    islands: Island[];
}) {
    if (islands.length === 0) return null;

    return (
        <section className='it-section bg-it-white sm:pt-0!'>
            <div className='it-container'>
                <Reveal className='flex flex-col gap-[18px]'>
                    <div className='flex flex-col gap-1.5'>
                        <h2 className='m-0 text-[26px] md:text-[26px] leading-[1.2] tracking-[-0.012em] text-it-heading font-medium'>
                            {dict.title}
                        </h2>
                        {dict.subtitle && (
                            <p className='m-0 max-w-[560px] text-[13px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                                {dict.subtitle}
                            </p>
                        )}
                    </div>

                    {/* Island tiles - photo card with meta block (design v2) */}
                    <div className='grid gap-5 md:grid-cols-3'>
                        {islands.map(island => (
                            <Reveal key={island.slug} width='auto' listItem>
                                <MotionLink
                                    href={localizeHref(
                                        locale,
                                        `/${island.slug}`
                                    )}
                                    whileTap={{ scale: 0.99 }}
                                    transition={springPop}
                                    className='group block overflow-hidden rounded-it-md border border-it-divider bg-it-white no-underline transition-[box-shadow,border-color] duration-(--it-duration-sm) ease-(--it-ease) hover:border-it-card-hover-border hover:shadow-it-card-hover'>
                                    <div className='relative aspect-video md:aspect-3/2 overflow-hidden bg-it-bg'>
                                        {island.image && (
                                            <>
                                                <Image
                                                    src={island.image}
                                                    alt={island.name}
                                                    fill
                                                    sizes='(max-width: 768px) 100vw, 384px'
                                                    className='object-cover transition-transform duration-(--it-duration-lg) ease-(--it-ease) group-hover:scale-[1.03]'
                                                />
                                                {/* Soft bottom scrim over the
                                                    photo edge - photo only;
                                                    the fallback stays flat. */}
                                                <div className='pointer-events-none absolute inset-0 bg-[image:var(--it-scrim-tile)]' />
                                            </>
                                        )}
                                    </div>

                                    <div className='flex flex-col px-4 pt-3.5 pb-4'>
                                        <span className='font-medium text-[14.5px] md:text-[20px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                                            {island.name}
                                        </span>
                                        <span className='text-[12px] md:text-[13px] leading-[1.6] text-it-white/70 tabular-nums tracking-[-0.012em]'>
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

