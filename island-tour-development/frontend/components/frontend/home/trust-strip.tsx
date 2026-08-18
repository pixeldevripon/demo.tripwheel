import Image from 'next/image';
import { Reveal } from '../reveal';

// Icons stay in the component; the copy comes from the dictionary (same order).
// Design v2 microbar set: lock (deposit) · check (free cancel) · chat (locals).
const icons = [
    '/icons/trust-lock.svg',
    '/icons/trust-check.svg',
    '/icons/trust-chat.svg',
];

export type TrustItem = { title: string; body: string };

/** Single microbar cell - icon in a 40px peach tile, copy stacked right. */
function TrustCard({ icon, item }: { icon: string; item: TrustItem }) {
    return (
        <div className='flex items-start gap-3.5 text-left'>
            <div className='flex size-10 shrink-0 items-center justify-center rounded-it-md bg-it-peach'>
                <Image
                    src={icon}
                    alt=''
                    width={40}
                    height={40}
                    className='size-5'
                />
            </div>
            <div className='flex flex-col'>
                <h3 className='m-0 text-[16.5px] md:text-[18px] leading-[1.6] tracking-[-0.012em] text-it-heading font-medium'>
                    {item.title}
                </h3>
                <p className='m-0 text-[13px] md:text-[14.5px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                    {item.body}
                </p>
            </div>
        </div>
    );
}

export function TrustStrip({ items }: { items: TrustItem[] }) {
    return (
        <section className='bg-it-white pt-7 md:pt-10'>
            <div className='it-container'>
                {/* 3 in a row on desktop; stacked cells on mobile (design v2
                    microbar - no carousel). */}
                <div className='grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-[26px] py-0.5 md:py-1.5'>
                    {items.map((item, i) => (
                        <Reveal key={item.title} delay={0} listItem>
                            <TrustCard icon={icons[i]} item={item} />
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}

