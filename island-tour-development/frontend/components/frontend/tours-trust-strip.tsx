import Image from 'next/image';
import { Reveal } from './reveal';

type TrustItem = { title: string; subtitle: string };

export type ToursTrustDict = {
    builtByLocals: TrustItem;
    freeCancellation: TrustItem;
    message: TrustItem;
    pay: TrustItem;
};

// Fixed display order - icon paired with its dictionary key (icons exported from Figma).
const ITEMS: { key: keyof ToursTrustDict; icon: string }[] = [
    { key: 'builtByLocals', icon: '/icons/trust-strip/built-by-locals.svg' },
    { key: 'freeCancellation', icon: '/icons/trust-strip/free-cancellation.svg' },
    { key: 'message', icon: '/icons/trust-strip/message.svg' },
    { key: 'pay', icon: '/icons/trust-strip/wallet.svg' },
];

/**
 * All Tours trust strip ("Trust strip / D", Figma node 47626:9337).
 * Four icon-left, two-line items spaced across a #f8f8f8 band.
 */
export function ToursTrustStrip({ dict }: { dict: ToursTrustDict }) {
    return (
        <section className='bg-it-surface'>
            <div className='it-container'>
                {/* Mobile: 2×2 grid of compact 14px items, 16px row gaps,
                    32px band padding (Figma node 48540:16942).
                    md+: single justified row of 16px items (node 47626:9337). */}
                <Reveal className='grid grid-cols-2 gap-x-4 gap-y-4 py-8 md:flex md:items-center md:justify-between md:gap-x-6 md:py-22.5'>
                    {ITEMS.map(({ key, icon }) => {
                        const item = dict[key];
                        return (
                            <div key={key} className='flex items-start gap-3 md:gap-4'>
                                <Image
                                    src={icon}
                                    alt=''
                                    width={24}
                                    height={24}
                                    className='size-6 shrink-0'
                                />
                                <div className='flex flex-col'>
                                    <span className='font-medium text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                        {item.title}
                                    </span>
                                    <span className='text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                        {item.subtitle}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </Reveal>
            </div>
        </section>
    );
}
