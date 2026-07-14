'use client';

import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { springPop } from '@/lib/motion';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useState } from 'react';

/**
 * Compact date pill used in the All-Tours header on mobile (the Figma frame
 * relocates the date control up beside the "{n} tours available" line). The
 * desktop layout keeps its own date pill inside the toolbar, so this instance
 * is rendered `md:hidden` - independent state is fine since only one shows per
 * breakpoint.
 */
export function ToursDatePill({
    selectDateLabel,
    className = '',
}: {
    selectDateLabel: string;
    className?: string;
}) {
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <motion.button
                    type='button'
                    aria-label={selectDateLabel}
                    transition={springPop}
                    className={`flex h-9.5 shrink-0 items-center gap-2 rounded-it-full border bg-it-white px-3 py-2 text-[14px] leading-[1.6] tracking-[-0.012em] transition-colors ${
                        date
                            ? 'border-it-heading bg-it-surface text-it-heading'
                            : 'border-it-heading/15 text-it-heading hover:bg-it-surface'
                    } ${className}`}>
                    <Image
                        src='/icons/filters/calendar.svg'
                        alt=''
                        width={20}
                        height={20}
                        className='size-5 shrink-0'
                    />
                    {date ? format(date, 'd MMM') : selectDateLabel}
                </motion.button>
            </PopoverTrigger>
            <PopoverContent
                align='end'
                sideOffset={12}
                className='w-auto rounded-[10px] border-none bg-it-white p-0 text-it-heading shadow-[5px_10px_24px_-4px_rgba(0,0,0,0.16)] duration-300 ease-[cubic-bezier(0.21,0.47,0.32,0.98)]'>
                <Calendar
                    mode='single'
                    selected={date}
                    onSelect={selected => {
                        setDate(selected);
                        setOpen(false);
                    }}
                    disabled={{ before: new Date() }}
                    autoFocus
                    className='bg-it-white [--cell-radius:8px]'
                />
            </PopoverContent>
        </Popover>
    );
}

