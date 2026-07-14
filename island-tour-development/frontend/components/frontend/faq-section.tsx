import Image from 'next/image';
import { springPop } from '@/lib/motion';
import { FaqAccordion } from './faq-accordion';
import { MotionA } from './motion-primitives';
import { Reveal } from './reveal';

type FaqDict = {
    title: string;
    subtitle: string;
    whatsapp: string;
    guarantees: string[];
    items: { q: string; a: string }[];
};

const payments = [
    { src: '/icons/payments/pay-1.svg', alt: 'Visa' },
    { src: '/icons/payments/pay-2.svg', alt: 'MasterCard' },
    { src: '/icons/payments/pay-3.svg', alt: 'PayPal' },
    { src: '/icons/payments/pay-4.svg', alt: 'iDEAL' },
    { src: '/icons/payments/pay-5.svg', alt: 'Apple Pay' },
    { src: '/icons/payments/pay-6.svg', alt: 'Google Pay' },
    { src: '/icons/payments/pay-7.svg', alt: 'Klarna' },
    { src: '/icons/payments/pay-8.svg', alt: 'American Express' },
];

export function FaqSection({
    dict,
    minimal = false,
}: {
    dict: FaqDict;
    minimal?: boolean;
}) {
    return (
        <section className='it-section max-md:pb-[32px]! bg-it-surface'>
            <div className='it-container'>
                <Reveal
                    className={`flex flex-col lg:flex-row lg:gap-[118px] ${minimal ? 'gap-4' : 'gap-12'}`}>
                    {/* Minimal (category page, Figma 47070:2456): title only on the left. */}
                    {minimal ? (
                        <div className='lg:w-113 lg:shrink-0'>
                            <h2 className='m-0 font-medium text-[24px] lg:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-ink'>
                                {dict.title}
                            </h2>
                        </div>
                    ) : (
                        /* Left - help, WhatsApp, guarantees, payments.
                        On mobile this block sits above the accordion (matches Figma). */
                        <div className='flex flex-col gap-8 lg:w-115 lg:gap-14'>
                            <div className='flex flex-col gap-12 lg:gap-14'>
                                {/* Heading */}
                                <div className='flex flex-col gap-4 lg:gap-6'>
                                    <h2 className='m-0 font-medium text-[32px] lg:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-ink'>
                                        {dict.title}
                                    </h2>
                                    <p className='m-0 max-w-[452px] text-[14px] lg:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                        {dict.subtitle}
                                    </p>
                                </div>

                                {/* WhatsApp + guarantees */}
                                <div className='flex flex-col gap-6'>
                                    <div className='flex items-center gap-2'>
                                        {/* Rounding lives on the wrapper: a border-radius
                                            applied directly to a <video> clips its GPU layer
                                            with a hard, aliased edge. The wrapper's clip is
                                            antialiased, so the circle stays smooth. */}
                                        <div className='size-12.5 shrink-0 overflow-hidden rounded-full transform-[translateZ(0)] lg:size-16'>
                                            <video
                                                src='/videos/experiences/catamaran-trip.mp4'
                                                poster='/images/home-page/faq/host-avatar.png'
                                                aria-label='Your local host'
                                                autoPlay
                                                loop
                                                muted
                                                playsInline
                                                className='size-full object-cover'
                                            />
                                        </div>
                                        <MotionA
                                            href='#'
                                            className='flex items-center gap-2.5 rounded-it-full bg-it-green px-10 py-3 no-underline lg:py-[19px] hover:bg-it-green/90 transition-colors'
                                            whileTap={{ scale: 0.98 }}
                                            transition={springPop}>
                                            <Image
                                                src='/icons/whatsapp.svg'
                                                alt=''
                                                width={24}
                                                height={24}
                                                className='size-6'
                                            />
                                            <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-white'>
                                                {dict.whatsapp}
                                            </span>
                                        </MotionA>
                                    </div>

                                    <ul className='m-0 flex list-none flex-col gap-2 p-0'>
                                        {dict.guarantees.map(g => (
                                            <li
                                                key={g}
                                                className='flex items-center gap-2'>
                                                <Image
                                                    src='/icons/check-green.svg'
                                                    alt=''
                                                    width={24}
                                                    height={24}
                                                    className='size-6 shrink-0'
                                                />
                                                <span className='font-medium text-[14px] lg:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                                    {g}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Payment badges - uniform 64×36 (mobile) / 73×40 (desktop) boxes, packed */}
                            <div className='grid w-64 grid-cols-4 gap-y-2 lg:w-73'>
                                {payments.map(p => (
                                    <span
                                        key={p.alt}
                                        className='flex items-center justify-center'>
                                        <Image
                                            src={p.src}
                                            alt={p.alt}
                                            width={73}
                                            height={40}
                                            className='w-16 h-auto object-contain lg:w-18.25'
                                        />
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Right - accordion (the interactive client leaf) */}
                    <FaqAccordion items={dict.items} />
                </Reveal>
            </div>
        </section>
    );
}

