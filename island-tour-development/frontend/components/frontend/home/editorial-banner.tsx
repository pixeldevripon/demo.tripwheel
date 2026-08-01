import { springPop } from '@/lib/motion';
import { ArrowRight } from 'lucide-react';
import { MotionLink } from '../motion-link';
import { MotionSpan } from '../motion-primitives';
import { Reveal } from '../reveal';
import { EditorialCardFan } from './editorial-card-fan';

type CategoryKey = 'buggy' | 'snorkel' | 'catamaran';

type EditorialDict = {
    titleLine1: string;
    titleLine2: string;
    body: string;
    cta: string;
    categories: Record<CategoryKey, string>;
};

export function EditorialBanner({
    dict,
    ctaHref,
    cards,
}: {
    dict: EditorialDict;
    // Destination the banner is themed to (the copy names the launch island);
    // resolved in the page so this stays presentational.
    ctaHref: string;
    /**
     * Admin-configured fan cards (photo, island name, link); short or absent
     * keeps the bundled photos and labels.
     */
    cards?: { image: string; name: string | null; href: string | null }[];
}) {
    return (
        <section className='it-section bg-it-white overflow-x-clip'>
            <div className='it-container'>
                <Reveal className='relative lg:min-h-[372px]'>
                    {/* Backdrop - the mockup .edfig band: deep orange washing to
                        white toward the fan on desktop, solid wash on mobile. */}
                    <div className='absolute inset-0 overflow-hidden rounded-it-xl [background-image:var(--it-editorial-gradient-v)] lg:[background-image:var(--it-editorial-gradient)]' />

                    {/* Mobile/tablet: stacked column · Desktop: full-height positioning context for the absolute copy + fan */}
                    <div className='relative flex flex-col gap-6 px-6 py-10 sm:px-10 sm:py-12 lg:block lg:min-h-[372px] lg:p-0'>
                        {/* Editorial copy (mockup .edfig .txt) */}
                        <div className='flex flex-col lg:absolute lg:left-[60px] lg:top-1/2 lg:-translate-y-1/2 lg:max-w-[432px]'>
                            <h2 className='m-0 font-it-display font-medium text-[clamp(26px,3.3vw,40px)] leading-[1.05] tracking-[-0.02em] text-it-white'>
                                <span className='block'>{dict.titleLine1}</span>
                                <span className='block text-it-editorial-accent'>
                                    {dict.titleLine2}
                                </span>
                            </h2>
                            <p className='m-0 mt-3.5 max-w-[400px] text-[15px] leading-[1.55] text-it-white/90'>
                                {dict.body}
                            </p>

                            <MotionLink
                                href={ctaHref}
                                className='mt-[26px] inline-flex w-fit items-center gap-2 rounded-it-full bg-it-white px-6 py-[13px] no-underline cursor-pointer border-none shadow-[0_8px_20px_rgba(0,0,0,0.16)] transition-opacity hover:opacity-90'
                                initial='rest'
                                animate='rest'
                                whileTap='tap'
                                variants={{
                                    rest: { scale: 1 },
                                    tap: { scale: 0.99 },
                                }}
                                transition={springPop}>
                                <span className='font-normal text-[14.5px] leading-[1.6] text-it-primary-hover'>
                                    {dict.cta}
                                </span>
                                <MotionSpan
                                    className='inline-flex'
                                    variants={{ rest: { x: 0 }, tap: { x: 6 } }}
                                    transition={springPop}>
                                    <ArrowRight
                                        className='size-4 text-it-primary-hover'
                                        strokeWidth={2.2}
                                    />
                                </MotionSpan>
                            </MotionLink>
                        </div>

                        {/* Category cards - fanned deck (2nd row on mobile, right side on
                            desktop). Click brings a card to the front - the client leaf. */}
                        <EditorialCardFan
                            labels={dict.categories}
                            cards={cards}
                        />
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

