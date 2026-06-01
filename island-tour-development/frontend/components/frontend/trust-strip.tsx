import Image from 'next/image';
import { Reveal } from './reveal';

// Icons stay in the component; the copy comes from the dictionary (same order).
const icons = [
    '/icons/trust-wallet.svg',
    '/icons/trust-clock.svg',
    '/icons/trust-chat.svg',
];

export function TrustStrip({
    items,
}: {
    items: { title: string; body: string }[];
}) {
    return (
        <section className='bg-it-white pt-32.5'>
            <div className='it-container'>
                <div className='flex flex-col md:flex-row md:items-start gap-12 md:gap-6'>
                    {items.map((item, i) => (
                        <Reveal
                            key={item.title}
                            delay={i * 0.12}
                            className='flex-1 flex flex-col items-center gap-6 text-center'
                        >
                            <Image
                                src={icons[i]}
                                alt=''
                                width={40}
                                height={40}
                                className='size-10'
                            />
                            <div className='flex flex-col items-center gap-1 max-w-73.25'>
                                <h3 className='m-0 font-medium text-[20px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                    {item.title}
                                </h3>
                                <p className='m-0 text-base leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                    {item.body}
                                </p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}
