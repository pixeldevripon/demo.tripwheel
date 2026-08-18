import { ArrowRight } from 'lucide-react';
import Image from 'next/image';

import { springPop } from '@/lib/motion';

import { MotionLink } from '../motion-link';
import { MotionSpan } from '../motion-primitives';
import { Reveal } from '../reveal';

/** Same bundled photo the hero falls back to - the card is a photo surface. */
const FALLBACK_IMAGE = '/images/kc-powerboat.jpg';

/**
 * Dark photo CTA card before the footer (design v2 .ctacard): rounded photo
 * with a dark wash, display headline, one orange CTA. The button reuses the
 * editorial island CTA (label + href) so it always points at the same island
 * the banner promotes.
 */
export function CtaCard({
    dict,
    cta,
    ctaHref,
    image,
}: {
    dict: { title: string; body: string };
    /** Localized button label (the editorial "Explore {island}" string). */
    cta: string;
    ctaHref: string;
    /** Admin hero photo; null keeps the bundled default. */
    image?: string | null;
}) {
    return (
        <section className='it-section bg-it-white'>
            <div className='it-container'>
                <Reveal className='relative flex min-h-[300px] items-center justify-center overflow-hidden rounded-it-lg text-center'>
                    <Image
                        src={image || FALLBACK_IMAGE}
                        alt=''
                        fill
                        sizes='(max-width: 1280px) 100vw, 1152px'
                        className='object-cover object-[50%_55%]'
                    />
                    {/* Dark wash so the on-photo copy stays readable. */}
                    <div className='absolute inset-0 bg-[linear-gradient(0deg,rgba(35,32,27,0.72)_0%,rgba(35,32,27,0.46)_100%)]' />

                    <div className='relative z-2 px-6 py-14 md:px-8 md:py-16 text-it-white tracking-[-0.012em]'>
                        <h2 className='m-0 text-[clamp(24px,3vw,34px)] leading-[1.15] tracking-[-0.012em] text-it-white font-medium'>
                            {dict.title}
                        </h2>
                        <p className='m-0 mt-2.5 text-[15px] leading-[1.6] text-it-footer-muted tracking-[-0.012em]'>
                            {dict.body}
                        </p>
                        <MotionLink
                            href={ctaHref}
                            className='mt-6 inline-flex items-center gap-2 rounded-it-sm bg-it-primary px-7 py-3.5 no-underline cursor-pointer border-none text-[17px] md:text-[19px] font-medium text-it-white transition-colors hover:bg-it-primary-hover tracking-[-0.012em]'
                            initial='rest'
                            animate='rest'
                            whileTap='tap'
                            variants={{
                                rest: { scale: 1 },
                                tap: { scale: 0.98 },
                            }}
                            transition={springPop}>
                            {cta}
                            <MotionSpan
                                className='inline-flex'
                                variants={{ rest: { x: 0 }, tap: { x: 5 } }}
                                transition={springPop}>
                                <ArrowRight
                                    className='size-4.5 text-it-white tracking-[-0.012em]'
                                    strokeWidth={2}
                                />
                            </MotionSpan>
                        </MotionLink>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

