'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { Reveal } from './reveal';

// Icons stay in the component; the copy comes from the dictionary (same order).
const icons = [
    '/icons/trust-wallet.svg',
    '/icons/trust-clock.svg',
    '/icons/trust-chat.svg',
];

type TrustItem = { title: string; body: string };

/** Single trust item - shared by the desktop row and the mobile carousel. */
function TrustCard({ icon, item }: { icon: string; item: TrustItem }) {
    return (
        <div className='flex flex-col items-center gap-6 text-center'>
            <Image
                src={icon}
                alt=''
                width={40}
                height={40}
                className='size-8 md:size-10'
            />
            <div className='flex flex-col items-center gap-0.5 md:gap-1 max-w-73.25'>
                <h3 className='m-0 font-medium text-[18px] md:text-[20px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                    {item.title}
                </h3>
                <p className='m-0 text-sm md:text-base leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                    {item.body}
                </p>
            </div>
        </div>
    );
}

/** Mobile only - one item at a time, swipeable + autoplay, with 3 progress segments. */
function MobileCarousel({ items }: { items: TrustItem[] }) {
    const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'center' }, [
        Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true }),
    ]);
    const [selected, setSelected] = useState(0);

    useEffect(() => {
        if (!emblaApi) return;
        const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
        onSelect();
        emblaApi.on('select', onSelect);
        emblaApi.on('reInit', onSelect);
        return () => {
            emblaApi.off('select', onSelect);
            emblaApi.off('reInit', onSelect);
        };
    }, [emblaApi]);

    return (
        <div className='flex flex-col items-center gap-10'>
            <div className='w-full overflow-hidden' ref={emblaRef}>
                <div className='flex'>
                    {items.map((item, i) => (
                        <div key={item.title} className='min-w-0 flex-[0_0_100%] px-4'>
                            <TrustCard icon={icons[i]} item={item} />
                        </div>
                    ))}
                </div>
            </div>

            {/* Progress segments */}
            <div className='flex items-center gap-1'>
                {items.map((item, i) => (
                    <button
                        key={item.title}
                        type='button'
                        aria-label={`Go to ${item.title}`}
                        aria-current={i === selected}
                        onClick={() => emblaApi?.scrollTo(i)}
                        className={`h-1 w-12.5 cursor-pointer border-none transition-colors ${i === selected ? 'bg-it-border' : 'bg-it-bg'}`}
                    />
                ))}
            </div>
        </div>
    );
}

export function TrustStrip({ items }: { items: TrustItem[] }) {
    return (
        <section className='bg-it-white pt-8 pb-2 md:pt-32.5 md:pb-0'>
            <div className='it-container'>
                {/* Desktop - 3 in a row */}
                <div className='hidden md:flex md:flex-row md:items-start gap-6'>
                    {items.map((item, i) => (
                        <Reveal
                            key={item.title}
                            delay={i * 0.12}
                            className='flex-1'>
                            <TrustCard icon={icons[i]} item={item} />
                        </Reveal>
                    ))}
                </div>

                {/* Mobile - single-item carousel */}
                <div className='md:hidden'>
                    <MobileCarousel items={items} />
                </div>
            </div>
        </section>
    );
}
