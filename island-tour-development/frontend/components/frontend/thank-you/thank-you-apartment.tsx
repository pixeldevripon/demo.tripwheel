import { MotionA } from '@/components/frontend/motion-primitives';
import { Reveal } from '@/components/frontend/reveal';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { springPop } from '@/lib/motion';
import type { ThankYouApartment } from '@/lib/thank-you/thank-you';
import Image from 'next/image';

type ThankYouDict = Dictionary['thankYou'];

const metaText = 'text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading/70';
const dot = <span className='size-1 shrink-0 rounded-full bg-it-heading/20' />;

/**
 * "Our apartment" promo card (Figma 47745-12127): photo half + details half
 * with the outline Airbnb CTA. Content is booking-payload driven so the promo
 * can later rotate per destination.
 */
export function ThankYouApartmentPromo({
    apartment,
    dict,
}: {
    apartment: ThankYouApartment;
    dict: ThankYouDict;
}) {
    return (
        <section className='it-section !pt-0 bg-it-white'>
            <div className='it-container'>
                <Reveal>
                    <div className='grid overflow-hidden rounded-[16px] border border-it-heading/10 bg-it-surface lg:grid-cols-2'>
                        <div className='relative h-[240px] bg-it-border lg:h-auto lg:min-h-[379px]'>
                            <Image
                                src={apartment.image}
                                alt={apartment.name}
                                fill
                                sizes='(min-width: 1024px) 588px, 100vw'
                                className='object-cover'
                            />
                        </div>
                        <div className='flex flex-col justify-between gap-6 p-6 lg:py-8 lg:pl-[42px] lg:pr-[22px]'>
                            <div className='flex flex-col gap-6'>
                                <div className='flex items-center gap-4'>
                                    <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-[#858585]'>
                                        {dict.aptEyebrow}
                                    </span>
                                    {dot}
                                    <span className={metaText}>
                                        {apartment.eyebrowArea}
                                    </span>
                                </div>
                                <div className='flex flex-col gap-5'>
                                    <div className='flex flex-col gap-1'>
                                        <h3 className='m-0 font-medium text-[24px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                                            {apartment.name}
                                        </h3>
                                        <div className='flex flex-wrap items-center gap-4'>
                                            <span className='flex items-center gap-2'>
                                                <Image
                                                    src='/icons/star-listings.svg'
                                                    alt=''
                                                    width={16}
                                                    height={16}
                                                    className='size-4'
                                                />
                                                <span className={metaText}>
                                                    {apartment.rating} (
                                                    {apartment.reviewCount.toLocaleString(
                                                        'en-US',
                                                    )}
                                                    )
                                                </span>
                                            </span>
                                            {dot}
                                            <span className={metaText}>
                                                {dict.sleeps.replace(
                                                    '{count}',
                                                    String(apartment.sleeps),
                                                )}
                                            </span>
                                            {dot}
                                            <span className='flex items-baseline gap-1'>
                                                <span className={metaText}>
                                                    {dict.from}
                                                </span>
                                                <span className='font-medium text-[18px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                                    ${apartment.pricePerNight}
                                                </span>
                                                <span className={metaText}>
                                                    {dict.perNight}
                                                </span>
                                            </span>
                                        </div>
                                    </div>
                                    <div className='flex flex-col'>
                                        {apartment.descriptionLines.map(line => (
                                            <p
                                                key={line}
                                                className='m-0 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                                {line}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <MotionA
                                href={apartment.airbnbUrl}
                                target='_blank'
                                rel='noopener noreferrer'
                                whileTap={{ scale: 0.98 }}
                                transition={springPop}
                                className='flex h-12 w-full max-w-[340px] items-center justify-center rounded-full border border-it-primary font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-primary transition-colors hover:bg-it-primary/5'>
                                {dict.aptCta}
                            </MotionA>
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}
