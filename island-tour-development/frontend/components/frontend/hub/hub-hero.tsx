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
import { MountReveal } from '../mount-reveal';
import { useOptionalHubDate } from './hub-date-context';

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
    imageAlt,
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
    /**
     * Localized alt text from the media library. Resolved by the caller (this is
     * a client component and the loader is server-only) and falls back to the
     * hub title.
     */
    imageAlt?: string | null;
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
        // Design v2 .hubhero: a 400px photo band, content LEFT-aligned and
        // vertically centred, under the side-wash hub scrim.
        <section
            className={`relative flex min-h-[400px] items-center overflow-hidden ${image ? 'bg-it-dark' : 'bg-it-bg'}`}>
            {image && (
                <Image
                    src={image}
                    alt={imageAlt || title}
                    fill
                    priority
                    className='object-cover object-[center_55%]'
                />
            )}
            {image && (
                <div className='absolute inset-0 bg-[image:var(--it-scrim-hub)]' />
            )}

            <div className='it-container relative z-10 w-full py-14'>
                {/* Smooth hero entry: the hub page arrives via the entity
                    route's loading.tsx (streamed, inserted post-paint), so
                    mount animations are the right pattern here. The three hero
                    blocks cascade - title, meta pills, date bar. */}
                <div className='flex w-full flex-col items-start'>
                    {/* Title + tagline */}
                    <MountReveal className='flex flex-col items-start'>
                        <h1
                            className={`m-0 font-it-display text-[clamp(30px,4.4vw,46px)] font-bold leading-[1.05] tracking-[-0.02em] ${image ? 'text-it-white' : 'text-it-ink'}`}>
                            {title}
                        </h1>
                        <p
                            className={`m-0 mt-2.5 text-[16px] font-semibold leading-[1.6] ${image ? 'text-it-white/92' : 'text-it-text-muted'}`}>
                            {tagline || dict.tagline}
                        </p>
                    </MountReveal>

                    {/* Fact line + date row */}
                    <div className='flex w-full flex-col items-start'>
                        {/* Meta pills - translucent, white 1px border, radius 10.
                            Mobile wraps to 2×2 (max-width forces the wrap, so the
                            divider after pill #1 falls to the start of row 2 - exactly
                            the Figma mobile layout); desktop is a single row. */}
                        {meta.length > 0 && (
                            <MountReveal delay={0.12} yOffset={14}>
                                {/* .factline: white facts split by hairline bars
                                on desktop, stacked plain on mobile. */}
                                <ul className='m-0 mt-[18px] flex list-none flex-col items-start gap-[7px] p-0 md:flex-row md:flex-wrap md:items-center md:gap-0'>
                                    {meta.map((item, i) => (
                                        <Fragment key={item.label}>
                                            {i > 0 && (
                                                <li
                                                    aria-hidden='true'
                                                    className={`hidden h-[15px] w-px shrink-0 md:block ${image ? 'bg-it-white/42' : 'bg-it-border'}`}
                                                />
                                            )}
                                            <li className='flex items-center gap-2 py-0.5 md:px-[18px] md:first:pl-0'>
                                                <Image
                                                    src={
                                                        image
                                                            ? item.icon
                                                            : item.icon.replace(
                                                                  '.svg',
                                                                  '-soft.svg'
                                                              )
                                                    }
                                                    alt=''
                                                    width={24}
                                                    height={24}
                                                    className='size-4 shrink-0 opacity-92'
                                                />
                                                <span
                                                    className={`whitespace-nowrap text-[14px] font-semibold leading-[1.6] ${image ? 'text-it-white' : 'text-it-ink'}`}>
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
                            className='w-full max-w-[460px]'>
                            {/* .herodate: white date field + orange Go */}
                            <div className='mt-[22px] flex w-full items-stretch gap-2.5'>
                                <Popover
                                    open={dateOpen}
                                    onOpenChange={setDateOpen}>
                                    {/* Clear control as a SIBLING of the trigger -
                                    a button's descendants are presentational
                                    to the accessibility tree, so a nested
                                    control would be unreachable. */}
                                    <div
                                        className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-it-sm bg-it-white px-4 ${image ? '' : 'border border-it-border'}`}>
                                        <PopoverTrigger asChild>
                                            <motion.button
                                                type='button'
                                                aria-label={dict.selectDate}
                                                className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 whitespace-nowrap border-none bg-transparent py-[13px] pl-0 text-left text-[14.5px] font-semibold leading-[1.6] transition-colors duration-300 ${date ? 'text-it-ink' : 'text-it-text-muted'}`}>
                                                <Image
                                                    src='/icons/calendar-soft.svg'
                                                    alt=''
                                                    width={24}
                                                    height={24}
                                                    className='size-[17px] shrink-0'
                                                />
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
                                                onClick={() =>
                                                    setDate(undefined)
                                                }
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
                                    className='shrink-0 cursor-pointer rounded-it-sm border-none bg-it-primary px-[22px] py-[13px] text-[15px] font-bold leading-[1.6] text-it-white transition-colors duration-(--it-duration-xs) hover:bg-it-primary-hover'>
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

