import Image from 'next/image';
import { Reveal } from '../reveal';

export type CategoryTrustDict = {
    builtByLocals: string;
    freeCancellation: string;
    whatsapp: string;
    deposit: string;
};

// Fixed display order. All four items share the one orange check icon
// (exported from Figma - fill #E8611A baked in).
const ORDER: (keyof CategoryTrustDict)[] = [
    'builtByLocals',
    'freeCancellation',
    'whatsapp',
    'deposit',
];

/**
 * Category-page inline trust strip (Figma node 47171:4311 desktop / 48540:18147
 * mobile). One row of four check-icon items above a hairline divider.
 *   - Mobile: items stacked vertically (8px), 14px medium text, 24px to divider.
 *   - md+: items justified across the row, 16px regular text, 40px to divider.
 */
export function CategoryTrustStrip({ dict }: { dict: CategoryTrustDict }) {
    return (
        <Reveal className='flex flex-col gap-6 md:gap-10'>
            <ul className='m-0 flex list-none flex-col gap-2 p-0 md:flex-row md:items-center md:justify-between md:gap-2'>
                {ORDER.map(key => (
                    <li key={key}>
                        <Reveal
                            width='auto'
                            listItem
                            className='flex items-center gap-2'>
                            <Image
                                src='/icons/trust-check.svg'
                                alt=''
                                width={24}
                                height={24}
                                className='size-6 shrink-0'
                            />
                            <span className='font-medium text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading md:text-[16px] md:font-normal'>
                                {dict[key]}
                            </span>
                        </Reveal>
                    </li>
                ))}
            </ul>
            <div className='h-px w-full bg-it-heading/10' aria-hidden='true' />
        </Reveal>
    );
}
