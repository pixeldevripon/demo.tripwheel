import Image from 'next/image';
import { Reveal } from '../reveal';
import { MobileCarousel } from './trust-strip-carousel';

// Icons stay in the component; the copy comes from the dictionary (same order).
export const icons = [
    '/icons/trust-wallet.svg',
    '/icons/trust-clock.svg',
    '/icons/trust-chat.svg',
];

export type TrustItem = { title: string; body: string };

/** Single trust item - shared by the desktop row and the mobile carousel. */
export function TrustCard({ icon, item }: { icon: string; item: TrustItem }) {
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

export function TrustStrip({ items }: { items: TrustItem[] }) {
    return (
        <section className='bg-it-white pt-8 pb-2 md:pt-32.5 md:pb-0'>
            <div className='it-container'>
                {/* Desktop - 3 in a row */}
                <div className='hidden md:flex md:flex-row md:items-start gap-6'>
                    {items.map((item, i) => (
                        <Reveal
                            key={item.title}
                            delay={0}
                            listItem
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
