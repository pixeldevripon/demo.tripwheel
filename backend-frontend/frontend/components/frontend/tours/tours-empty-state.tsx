'use client';

import { crossFade, springPop } from '@/lib/motion';
import { motion } from 'framer-motion';
import { SearchX } from 'lucide-react';

export type ToursEmptyStateDict = {
    title: string;
    description: string;
    /** Label for the clear-filters action (omit the button by not passing onClear). */
    clearLabel: string;
};

/**
 * Reusable empty-filtering-result screen for tour listings (All Tours page +
 * category page). Shown by <ToursListing> when a filtered query returns zero
 * tours. Presentational: pass `onClear` to reveal a "clear all filters" action.
 */
export function ToursEmptyState({
    dict,
    onClear,
}: {
    dict: ToursEmptyStateDict;
    onClear?: () => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={crossFade}
            className='flex flex-col items-center justify-center gap-4 px-6 py-16 text-center md:py-24'>
            <span className='grid size-16 place-items-center rounded-it-full bg-it-surface text-it-text-muted md:size-20 tracking-[-0.012em]'>
                <SearchX className='size-7 md:size-8' strokeWidth={1.5} />
            </span>

            <div className='flex max-w-125 flex-col gap-2'>
                <h3 className='m-0 font-medium text-[14.5px] md:text-[18px] leading-[1.3] tracking-[-0.012em] text-it-heading'>
                    {dict.title}
                </h3>
                <p className='m-0 it-text text-it-text-muted'>
                    {dict.description}
                </p>
            </div>

            {onClear && (
                <motion.button
                    type='button'
                    onClick={onClear}
                    whileTap={{ scale: 0.97 }}
                    transition={springPop}
                    className='mt-1 cursor-pointer border-none bg-transparent p-0 it-text  font-medium text-it-primary underline underline-offset-2 transition-colors duration-300 hover:text-it-primary-hover'>
                    {dict.clearLabel}
                </motion.button>
            )}
        </motion.div>
    );
}

