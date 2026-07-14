'use client';

import Image from 'next/image';
import { useBooking } from '@/hooks/tours/use-booking';

/** "Likely to sell out" notice card beneath the booking card. */
export function SellOutNotice() {
    const { dict } = useBooking();
    return (
        <div className='flex items-start gap-1 rounded-[16px] bg-it-surface p-4'>
            <Image
                src='/icons/sell-out.svg'
                alt=''
                width={24}
                height={24}
                className='size-6 shrink-0'
            />
            <div className='flex flex-col gap-1'>
                <span className='font-medium text-[18px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                    {dict.sellOutTitle}
                </span>
                <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                    {dict.sellOutSubtitle}
                </span>
            </div>
        </div>
    );
}
