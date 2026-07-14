'use client';

import { useBooking } from '@/hooks/tours/use-booking';

/** "From {price} per person" headline row at the top of the card. */
export function PriceHeader() {
    const { dict, data, money } = useBooking();
    return (
        <div className='flex items-baseline gap-1 border-b border-it-heading/10 px-4 py-4 text-it-heading'>
            <span className='text-[24px] leading-[1.2] tracking-[-0.012em]'>
                {dict.from}
            </span>
            <span className='font-bold text-[28px] leading-[1.4] tracking-[-0.012em]'>
                {money(data.priceFrom)}
            </span>
            <span className='text-[24px] leading-[1.2] tracking-[-0.012em]'>
                {dict.perPerson}
            </span>
        </div>
    );
}
