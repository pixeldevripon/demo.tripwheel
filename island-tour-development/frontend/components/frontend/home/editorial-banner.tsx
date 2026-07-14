import { ArrowRight } from 'lucide-react';
import { springPop } from '@/lib/motion';
import { MotionSpan } from '../motion-primitives';
import { MotionLink } from '../motion-link';
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
}: {
    dict: EditorialDict;
    // Destination the banner is themed to (the copy names the launch island);
    // resolved in the page so this stays presentational.
    ctaHref: string;
}) {
    return (
        <section className='it-section bg-it-white overflow-x-clip'>
            <div className='it-container'>
                <Reveal className='relative lg:h-[452px]'>
                    {/* Backdrop - orange washing to white: downward on mobile, rightward on desktop. */}
                    <div className='absolute inset-0 overflow-hidden rounded-[12px] bg-it-white [background-image:var(--it-editorial-gradient-v)] lg:rounded-3xl lg:[background-image:var(--it-editorial-gradient)]' />

                    {/* Mobile/tablet: stacked column · Desktop: full-height positioning context for the absolute copy + fan */}
                    <div className='relative flex flex-col gap-8 px-6 py-10 sm:px-10 sm:py-12 lg:block lg:h-full lg:p-0'>
                        {/* Editorial copy */}
                        <div className='flex flex-col gap-6 sm:gap-8 lg:absolute lg:inset-y-16 lg:left-16 lg:w-115 lg:justify-between lg:gap-0'>
                            <div className='flex flex-col gap-4'>
                                <h2 className='m-0 flex flex-col gap-2 font-medium text-[32px] leading-[1.2] tracking-[-0.012em] text-it-white sm:text-[40px]'>
                                    <span>{dict.titleLine1}</span>
                                    <span>{dict.titleLine2}</span>
                                </h2>
                                <p className='m-0 max-w-[441px] text-[14px] sm:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-white/80'>
                                    {dict.body}
                                </p>
                            </div>

                            <MotionLink
                                href={ctaHref}
                                className='flex w-full items-center justify-center gap-2.5 rounded-it-full bg-it-white px-12 py-[19px] no-underline cursor-pointer border-none transition-opacity hover:opacity-90 sm:w-auto lg:w-full'
                                initial='rest'
                                animate='rest'
                                whileTap='tap'
                                variants={{ rest: { scale: 1 }, tap: { scale: 0.99 } }}
                                transition={springPop}
                            >
                                <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-primary'>
                                    {dict.cta}
                                </span>
                                <MotionSpan
                                    className='inline-flex'
                                    variants={{ rest: { x: 0 }, tap: { x: 6 } }}
                                    transition={springPop}
                                >
                                    <ArrowRight className='size-6 text-it-primary' strokeWidth={1.5} />
                                </MotionSpan>
                            </MotionLink>
                        </div>

                        {/* Category cards - fanned deck (2nd row on mobile, right side on
                            desktop). Click brings a card to the front - the client leaf. */}
                        <EditorialCardFan labels={dict.categories} />
                    </div>
                </Reveal>
            </div>
        </section>
    );
}
