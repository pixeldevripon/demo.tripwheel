import Image from 'next/image';
import { Reveal } from './reveal';

const items = [
    {
        icon: '/icons/trust-wallet.svg',
        title: 'Pay as little as 20% today',
        body: 'Secure your spot now, pay the rest later',
    },
    {
        icon: '/icons/trust-clock.svg',
        title: 'Plans change. No problem',
        body: 'Most tours fully refundable — cancel up to 24h before',
    },
    {
        icon: '/icons/trust-chat.svg',
        title: 'Help when you need it',
        body: 'Chat 24/7 · WhatsApp anytime',
    },
];

export function TrustStrip() {
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
                                src={item.icon}
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
