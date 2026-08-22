'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useState } from 'react';

import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import type { Locale } from '@/lib/constants/locales';
import { formatPlural, type PluralForms } from '@/lib/i18n/plural';
import { springPop } from '@/lib/motion';
import { cn } from '@/lib/utils';

export type SavedDateCheckDict = {
    /** The collapsed control: "Check a date". */
    checkDate: string;
    clearDate: string;
    /** Plural forms for the travelers chip. */
    travelers: PluralForms;
    /** aria-label for the travelers stepper's minus / plus. */
    fewerTravelers: string;
    moreTravelers: string;
};

/** Most travelers the chip will count up to - past this it is a group booking. */
export const MAX_TRAVELERS = 12;

/**
 * The party the check assumes before anyone says otherwise.
 *
 * Two, not one: the common case for a tour is a pair, and a check run for one
 * person would call a departure with a single seat left "available" to a
 * couple.
 */
export const DEFAULT_TRAVELERS = 2;

/**
 * "Check a date" (mck-17, flagged v1.1 in the spec and confirmed for this
 * release).
 *
 * One collapsed button that expands into the day and the party the traveller
 * is asking about. It answers a question the saved list otherwise cannot: five
 * tours on a list are not five options if three of them do not run on the
 * Tuesday the traveller is actually free.
 *
 * The party size is part of the question, not decoration: a departure with two
 * seats left is available for two people and sold out for four, and a chip that
 * ignored the count would tell half the travellers the wrong thing.
 */
export function SavedDateCheck({
    locale,
    dict,
    date,
    guests,
    onChange,
}: {
    locale: Locale;
    dict: SavedDateCheckDict;
    /** The day being checked as `yyyy-MM-dd`, or null when none is. */
    date: string | null;
    guests: number;
    onChange: (next: { date: string | null; guests: number }) => void;
}) {
    const [dateOpen, setDateOpen] = useState(false);
    const selected = date ? parseDayKey(date) : undefined;

    return (
        <div className='flex flex-wrap items-center gap-2.5'>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                    <motion.button
                        type='button'
                        whileTap={{ scale: 0.97 }}
                        transition={springPop}
                        className={cn(
                            'inline-flex cursor-pointer items-center gap-[9px] rounded-it-full border px-[18px] py-[11px] text-[12px] font-medium leading-[1.6] transition-colors duration-(--it-duration-xs) ease-(--it-ease) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-it-primary tracking-[-0.012em]',
                            selected
                                ? 'border-it-primary bg-it-primary-subtle text-it-primary-hover tracking-[-0.012em]'
                                : 'border-it-border bg-it-white text-it-heading hover:border-it-ink tracking-[-0.012em]'
                        )}>
                        <Image
                            src='/icons/filters/calendar.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-4 shrink-0'
                        />
                        {selected
                            ? formatCheckDate(selected, locale)
                            : dict.checkDate}
                    </motion.button>
                </PopoverTrigger>
                <PopoverContent
                    align='start'
                    sideOffset={10}
                    className='w-auto rounded-it-lg border-none bg-it-white p-0 text-it-heading shadow-it-lg duration-300 ease-(--it-ease) tracking-[-0.012em]'>
                    <Calendar
                        mode='single'
                        selected={selected}
                        onSelect={next => {
                            onChange({
                                date: next ? toDayKey(next) : null,
                                guests,
                            });
                            setDateOpen(false);
                        }}
                        disabled={{ before: new Date() }}
                        autoFocus
                        className='bg-it-white [--cell-radius:10px]'
                    />
                </PopoverContent>
            </Popover>

            {/* The party and the way out. Both appear only once a day is in
                play - before that there is nothing for them to qualify. */}
            {selected && (
                <>
                    <div className='inline-flex items-center gap-3 rounded-it-full border border-it-primary bg-it-primary-subtle py-[7px] pl-4 pr-[7px] text-[12px] font-medium leading-[1.6] text-it-primary-hover tracking-[-0.012em]'>
                        <span className='tabular-nums'>
                            {formatPlural(dict.travelers, guests, locale)}
                        </span>
                        <span className='inline-flex items-center gap-1'>
                            <StepperButton
                                label={dict.fewerTravelers}
                                disabled={guests <= 1}
                                onClick={() =>
                                    onChange({ date, guests: guests - 1 })
                                }>
                                &minus;
                            </StepperButton>
                            <StepperButton
                                label={dict.moreTravelers}
                                disabled={guests >= MAX_TRAVELERS}
                                onClick={() =>
                                    onChange({ date, guests: guests + 1 })
                                }>
                                +
                            </StepperButton>
                        </span>
                    </div>

                    <button
                        type='button'
                        onClick={() => onChange({ date: null, guests })}
                        className='cursor-pointer border-none bg-transparent text-[12px] font-medium leading-[1.6] text-it-text-muted underline underline-offset-[3px] hover:text-it-heading tracking-[-0.012em]'>
                        {dict.clearDate}
                    </button>
                </>
            )}
        </div>
    );
}

function StepperButton({
    label,
    disabled,
    onClick,
    children,
}: {
    label: string;
    disabled: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <motion.button
            type='button'
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            whileTap={disabled ? undefined : { scale: 0.9 }}
            transition={springPop}
            className='grid size-7 cursor-pointer place-items-center rounded-it-full border border-it-primary/40 bg-it-white text-[13px] font-medium leading-none text-it-primary-hover disabled:cursor-default disabled:opacity-40 tracking-[-0.012em]'>
            {children}
        </motion.button>
    );
}

/**
 * `yyyy-MM-dd` from a local Date, and back.
 *
 * Hand-rolled rather than via `toISOString`, which converts to UTC first: for
 * anyone west of Greenwich that turns "the 15th" into "the 14th" for part of
 * every day, and this string goes straight to an availability query.
 */
export function toDayKey(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

/** Whether `value` is a `yyyy-MM-dd` day key. URL input, so it is not trusted. */
export function isDayKey(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && parseDayKey(value) !== undefined;
}

export function parseDayKey(key: string): Date | undefined {
    const [year, month, day] = key.split('-').map(Number);
    if (!year || !month || !day) return undefined;
    return new Date(year, month - 1, day);
}

/** "Sat, Aug 15" in the traveller's locale. */
export function formatCheckDate(date: Date, locale: Locale): string {
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    }).format(date);
}
