'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { springPop } from '@/lib/motion';
import { icons, TrustCard, type TrustItem } from './trust-strip';

/** Mobile only - one item at a time, swipeable + autoplay, with 3 progress segments. */
export function MobileCarousel({ items }: { items: TrustItem[] }) {
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
                    <motion.button
                        key={item.title}
                        type='button'
                        aria-label={`Go to ${item.title}`}
                        aria-current={i === selected}
                        onClick={() => emblaApi?.scrollTo(i)}
                        whileTap={{ scale: 0.9 }}
                        transition={springPop}
                        className={`h-1 w-12.5 cursor-pointer border-none transition-colors duration-300 ${i === selected ? 'bg-it-border' : 'bg-it-bg'}`}
                    />
                ))}
            </div>
        </div>
    );
}

