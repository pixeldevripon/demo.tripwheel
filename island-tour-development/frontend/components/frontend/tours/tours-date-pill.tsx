'use client';

import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { springPop } from '@/lib/motion';
import { setListingPending } from '@/lib/tours/listing-pending';
import { format, parse } from 'date-fns';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

/**
 * Compact date pill used in the All-Tours header on mobile (the Figma frame
 * relocates the date control up beside the "{n} tours available" line). The
 * desktop layout keeps its own date pill inside the toolbar, so this instance
 * is rendered `md:hidden`.
 *
 * URL-backed like the toolbar pill: selecting a day navigates with `?date=`
 * (page reset), the X clears it - the two pills stay in sync through the URL.
 * Reads the current value from `window.location` on mount instead of
 * `useSearchParams` so the static-shell header stays prerenderable (same
 * pattern as the /cancel return-to read). The navigation runs in a transition
 * published to the shared listing-pending store, so the results grid dims
 * while the filtered page streams - the same feedback the toolbar gives -
 * even though this pill renders outside <ToursBrowser>.
 */
export function ToursDatePill({
    selectDateLabel,
    clearDateLabel,
    className = '',
}: {
    selectDateLabel: string;
    clearDateLabel: string;
    className?: string;
}) {
    const router = useRouter();
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    // Publish the in-flight state for <ToursBrowser> (a different subtree).
    useEffect(() => {
        setListingPending(isPending);
        return () => setListingPending(false);
    }, [isPending]);

    // Seed from the URL after mount (deep links / back-forward keep the pill
    // truthful; before hydration it just shows the placeholder).
    useEffect(() => {
        const raw = new URLSearchParams(window.location.search).get('date');
        if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            const parsed = parse(raw, 'yyyy-MM-dd', new Date());
            if (!Number.isNaN(parsed.getTime())) setDate(parsed);
        }
    }, []);

    // Rewrite only the date (+ page reset) on the CURRENT query so every other
    // active filter survives; the server refetches the filtered list.
    function navigate(selected: Date | undefined) {
        const sp = new URLSearchParams(window.location.search);
        if (selected) sp.set('date', format(selected, 'yyyy-MM-dd'));
        else sp.delete('date');
        sp.delete('page');
        const qs = sp.toString();
        startTransition(() => {
            router.replace(
                `${window.location.pathname}${qs ? `?${qs}` : ''}`,
                { scroll: false }
            );
        });
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            {/* The clear control must be a SIBLING of the trigger, never a child:
                a button's descendants are presentational in the accessibility
                tree, so a nested control would be unreachable. The wrapper
                carries the exact pill look the trigger used to own. */}
            <div
                className={`flex h-9.5 shrink-0 items-center rounded-it-full border bg-it-white text-[14px] leading-[1.6] tracking-[-0.012em] transition-colors ${
                    date
                        ? 'border-it-heading bg-it-surface text-it-heading'
                        : 'border-it-heading/15 text-it-heading hover:bg-it-surface'
                } ${className}`}>
                <PopoverTrigger asChild>
                    <motion.button
                        type='button'
                        aria-label={selectDateLabel}
                        transition={springPop}
                        className={`flex h-full cursor-pointer items-center gap-2 whitespace-nowrap border-none bg-transparent py-2 pl-3 text-inherit ${date ? 'pr-1' : 'pr-3'}`}>
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
                {date && (
                    <motion.button
                        type='button'
                        aria-label={clearDateLabel}
                        whileTap={{ scale: 0.9 }}
                        transition={springPop}
                        onClick={() => {
                            setDate(undefined);
                            navigate(undefined);
                        }}
                        className='grid h-full shrink-0 cursor-pointer place-items-center border-none bg-transparent pl-0.5 pr-2'>
                        <Image
                            src='/icons/filters/close-circle.svg'
                            alt=''
                            width={20}
                            height={20}
                            className='size-5 shrink-0'
                        />
                    </motion.button>
                )}
            </div>
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
                        navigate(selected);
                    }}
                    disabled={{ before: new Date() }}
                    autoFocus
                    className='bg-it-white [--cell-radius:8px]'
                />
            </PopoverContent>
        </Popover>
    );
}
