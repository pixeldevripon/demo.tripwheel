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
import { Fragment, useState } from 'react';
import { useOptionalHubDate } from './hub-date-context';
import { MountReveal } from '../mount-reveal';

type HubHeroDict = {
    tagline: string;
    selectDate: string;
    clearDate: string;
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
        <section className='relative flex h-136.75 md:h-150 2xl:h-180 items-end justify-center overflow-hidden bg-it-hero-bg  pb-12.25 md:pb-25'>
            {image && (
                <>
                    <Image
                        src={image}
                        alt={title}
                        fill
                        priority
                        className='object-cover'
                    />
                    {/* Legibility overlay over the photo */}
                    <div className='absolute inset-0 bg-black/50' />
                </>
            )}

            <div className='it-container relative z-10 flex w-full justify-center'>
                {/* Smooth hero entry: the hub page arrives via the entity
                    route's loading.tsx (streamed, inserted post-paint), so
                    mount animations are the right pattern here. The three hero
                    blocks cascade - title, meta pills, date bar. */}
                <div className='flex w-full max-w-172.25 flex-col items-center gap-10'>
                    {/* Title + italic tagline - gap 4 */}
                    <MountReveal className='flex flex-col items-center gap-1 text-center'>
                        <h1 className='m-0 font-it-body font-medium text-[32px] md:text-[48px] leading-[1.2] tracking-[-0.012em] text-it-primary-fg'>
                            {title}
                        </h1>
                        <p className='m-0 text-[16px] md:text-[18px] italic leading-[1.6] tracking-[-0.012em] text-it-primary-subtle'>
                            {tagline || dict.tagline}
                        </p>
                    </MountReveal>

                    {/* Search group - pills + date bar. Mobile gap 16, desktop gap 12. */}
                    <div className='flex w-full flex-col items-center gap-4 md:gap-3'>
                        {/* Meta pills - translucent, white 1px border, radius 10.
                            Mobile wraps to 2×2 (max-width forces the wrap, so the
                            divider after pill #1 falls to the start of row 2 - exactly
                            the Figma mobile layout); desktop is a single row. */}
                        {meta.length > 0 && (
                            <MountReveal delay={0.12} yOffset={14}>
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
                                            <span className='whitespace-nowrap text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-primary-fg'>
                                                {item.label}
                                            </span>
                                        </li>
                                    </Fragment>
                                ))}
                            </ul>
                            </MountReveal>
                        )}

                        {/* Date + Check Availability bar - white, borderless, radius full */}
                        <MountReveal
                            delay={0.24}
                            yOffset={14}
                            className='w-full'>
                        <div className='flex w-full items-center justify-between gap-2 rounded-it-full bg-it-white py-2.5 pl-5 pr-2.5 md:py-3 md:pl-9 md:pr-2.5'>
                            <Popover open={dateOpen} onOpenChange={setDateOpen}>
                                {/* Clear control as a SIBLING of the trigger -
                                    a button's descendants are presentational
                                    to the accessibility tree, so a nested
                                    control would be unreachable. */}
                                <div className='flex min-w-0 shrink items-center gap-1.5'>
                                    <PopoverTrigger asChild>
                                        <motion.button
                                            type='button'
                                            aria-label={dict.selectDate}
                                            className={`flex shrink-0 cursor-pointer items-center whitespace-nowrap border-none bg-transparent p-0 text-left text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] transition-colors duration-300 ${date ? 'text-it-heading' : 'text-it-text-muted'}`}>
                                            {date
                                                ? format(date, 'd MMM yyyy')
                                                : dict.selectDate}
                                        </motion.button>
                                    </PopoverTrigger>
                                    {date && (
                                        <motion.button
                                            type='button'
                                            aria-label={dict.clearDate}
                                            whileTap={{ scale: 0.9 }}
                                            transition={springPop}
                                            onClick={() => setDate(undefined)}
                                            className='grid shrink-0 cursor-pointer place-items-center border-none bg-transparent p-0'>
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
                                    align='start'
                                    sideOffset={28}
                                    className='w-auto rounded-[8px] bg-it-white p-0 text-it-heading duration-300 ease-[cubic-bezier(0.21,0.47,0.32,0.98)]'>
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
                                whileTap={{ scale: 0.98 }}
                                transition={springPop}
                                className='grid h-10 min-w-37 shrink-0 cursor-pointer place-items-center rounded-it-full border-none bg-it-primary px-5 font-medium text-[14px] md:h-12 md:min-w-45 md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-white transition-colors duration-300 hover:bg-it-primary-hover'>
                                {dict.checkAvailability}
                            </motion.button>
                        </div>
                        </MountReveal>
                    </div>
                </div>
            </div>
        </section>
    );
}

