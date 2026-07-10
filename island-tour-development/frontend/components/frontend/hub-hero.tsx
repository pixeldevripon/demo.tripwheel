'use client';

import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Fragment, useState } from 'react';
import { useOptionalHubDate } from './hub-date-context';

type HubHeroDict = {
    tagline: string;
    selectDate: string;
    checkAvailability: string;
};

/** One representative meta chip - icon (white SVG) + short label. */
export type HubHeroMeta = { icon: string; label: string };

/**
 * Activity Hub hero (Figma node 48024:11158 desktop / 48539:16615 mobile). A
 * full-bleed image band with a centered title + italic tagline, a translucent
 * "meta pills" row summarising the typical trip (duration · price · inclusion ·
 * frequency), and a date + Check Availability bar.
 *
 * Differs from <DestinationHero>: no search field - the hub headlines a single
 * experience, so the bar is date-first and the pills carry the at-a-glance facts.
 * Uses the deep-ocean `--it-hub-hero-gradient` (not the light hero gradient) so
 * the white text and white pill border stay legible.
 */
export function HubHero({
    title,
    tagline,
    meta,
    image,
    dict,
    onCheckAvailability,
    scrollTargetId = 'hub-section-trips',
}: {
    title: string;
    /** Hub-specific tagline; falls back to the dictionary line when empty. */
    tagline?: string | null;
    meta: HubHeroMeta[];
    /** Background photo - falls back to the deep-ocean hero gradient. */
    image?: string | null;
    dict: HubHeroDict;
    /**
     * Custom handler for the Check Availability button. When omitted, the button
     * smooth-scrolls to `scrollTargetId` (the trips listing) - a hub headlines a
     * set of experiences rather than one bookable tour, so "check availability"
     * means "jump to the experiences you can book".
     */
    onCheckAvailability?: (date: Date | undefined) => void;
    /** Element id to scroll to when no `onCheckAvailability` is supplied. */
    scrollTargetId?: string;
}) {
    // Single source of truth shared with the trips panels: a date picked here
    // auto-selects in their filters. Falls back to local state when standalone.
    const shared = useOptionalHubDate();
    const [localDate, setLocalDate] = useState<Date | undefined>(undefined);
    const date = shared ? shared.date : localDate;
    const setDate = shared ? shared.setDate : setLocalDate;
    const [dateOpen, setDateOpen] = useState(false);

    const handleCheckAvailability = () => {
        if (onCheckAvailability) {
            onCheckAvailability(date);
            return;
        }
        // The trips section is streamed in below (Suspense); resolve by id at
        // click time. `scroll-mt-*` on the target keeps it clear of the navbar.
        document
            .getElementById(scrollTargetId)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        // Figma: 465px (mobile) / 533px (desktop) band. Content is bottom-anchored
        // (not centered) - 49px bottom gap on mobile, 100px on desktop - which
        // reproduces the exact 152/154px top gaps at each breakpoint.
        <section className='relative flex min-h-116.25 md:min-h-133.25 items-end justify-center overflow-hidden bg-it-hub-hero-bg [background-image:var(--it-hub-hero-gradient)] pb-12.25 md:pb-25'>
            {image && (
                <Image
                    src={image}
                    alt={title}
                    fill
                    priority
                    className='object-cover'
                />
            )}

            <div className='it-container relative z-10 flex w-full justify-center'>
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                        duration: 0.6,
                        ease: [0.21, 0.47, 0.32, 0.98],
                    }}
                    className='flex w-full max-w-172.25 flex-col items-center gap-10'>
                    {/* Title + italic tagline - gap 4 */}
                    <div className='flex flex-col items-center gap-1 text-center'>
                        <h1 className='m-0 font-it-body font-medium text-[32px] md:text-[48px] leading-[1.2] tracking-[-0.012em] text-it-white'>
                            {title}
                        </h1>
                        <p className='m-0 text-[16px] md:text-[18px] italic leading-[1.6] tracking-[-0.012em] text-it-white'>
                            {tagline || dict.tagline}
                        </p>
                    </div>

                    {/* Search group - pills + date bar. Mobile gap 16, desktop gap 12. */}
                    <div className='flex w-full flex-col items-center gap-4 md:gap-3'>
                        {/* Meta pills - translucent, white 1px border, radius 10.
                            Mobile wraps to 2×2 (max-width forces the wrap, so the
                            divider after pill #1 falls to the start of row 2 - exactly
                            the Figma mobile layout); desktop is a single row. */}
                        {meta.length > 0 && (
                            <ul className='m-0 flex w-fit max-w-66 flex-wrap items-center justify-center gap-2 rounded-[10px] border border-white px-3 py-2 md:max-w-none md:gap-x-4 md:px-5.5 md:py-3'>
                                {meta.map((item, i) => (
                                    <Fragment key={item.label}>
                                        {i > 0 && (
                                            <li
                                                aria-hidden='true'
                                                className='h-4.5 w-px shrink-0 bg-white'
                                            />
                                        )}
                                        <li className='flex items-center gap-2'>
                                            <Image
                                                src={item.icon}
                                                alt=''
                                                width={24}
                                                height={24}
                                                className='size-5 shrink-0 md:size-6'
                                            />
                                            <span className='whitespace-nowrap text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-white'>
                                                {item.label}
                                            </span>
                                        </li>
                                    </Fragment>
                                ))}
                            </ul>
                        )}

                        {/* Date + Check Availability bar - white, borderless, radius full */}
                        <div className='flex w-full items-center justify-between gap-2 rounded-it-full bg-it-white py-2.5 pl-5 pr-2.5 md:py-3 md:pl-9 md:pr-2.5'>
                            <Popover open={dateOpen} onOpenChange={setDateOpen}>
                                <PopoverTrigger asChild>
                                    <button
                                        type='button'
                                        aria-label={dict.selectDate}
                                        className={`flex shrink-0 cursor-pointer items-center whitespace-nowrap border-none bg-transparent p-0 text-left text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] ${date ? 'text-it-heading' : 'text-it-text-muted'}`}>
                                        {date
                                            ? format(date, 'd MMM yyyy')
                                            : dict.selectDate}
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent
                                    align='start'
                                    sideOffset={28}
                                    className='w-auto rounded-[8px] bg-it-white p-0 text-it-heading'>
                                    <Calendar
                                        mode='single'
                                        selected={date}
                                        onSelect={selected => {
                                            setDate(selected);
                                            setDateOpen(false);
                                        }}
                                        disabled={{ before: new Date() }}
                                        autoFocus
                                        className='bg-it-white [--cell-radius:8px]'
                                    />
                                </PopoverContent>
                            </Popover>

                            <motion.button
                                type='button'
                                onClick={handleCheckAvailability}
                                whileHover={{ scale: 1 }}
                                whileTap={{ scale: 0.99 }}
                                transition={{
                                    type: 'spring',
                                    stiffness: 400,
                                    damping: 17,
                                }}
                                className='grid h-10 min-w-37 shrink-0 cursor-pointer place-items-center rounded-it-full border-none bg-it-primary px-5 font-medium text-[14px] md:h-12 md:min-w-45 md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-white'>
                                {dict.checkAvailability}
                            </motion.button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

