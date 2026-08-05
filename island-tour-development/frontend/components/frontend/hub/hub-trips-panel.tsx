'use client';

import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { filterToursAvailableOnDate } from '@/lib/api/availability';
import { crossFade, springPop } from '@/lib/motion';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Reveal } from '../reveal';
import { useOptionalHubDate } from './hub-date-context';
import { HubPicks, type HubPicksData } from './hub-picks';
import {
    HubTourCard,
    type HubTour,
    type HubTourCardDict,
} from './hub-tour-card';

/** One card group inside a panel - an optional title (e.g. "Day charters (11)") + its tours. */
export type HubCardGroup = { title?: string; tours: HubTour[] };

/** A scroll-nav section's content - heading, subtitle, card groups, and an optional picks block. */
export type HubTripsPanelData = {
    title: string;
    subtitle: string;
    groups: HubCardGroup[];
    /** Optional editorial "top picks" block appended after the groups. */
    picks?: HubPicksData;
};

/** Copy for the date-availability filter (checking / empty / reset). */
export type HubTripsFilterDict = {
    checking: string;
    noneOnDate: string;
    showAllDates: string;
};

const GRID =
    'grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-x-[18px] sm:gap-y-[22px]';

/**
 * One panel of the hub trips/charters listing - a heading + its own date chip,
 * then either a single ungrouped grid ("Trips", node 48024:11222) or titled
 * groups separated by dividers ("Private charters", node 48024:11455).
 */
export function HubTripsPanel({
    panel,
    selectDate,
    filter,
    card,
}: {
    panel: HubTripsPanelData;
    selectDate: string;
    filter: HubTripsFilterDict;
    card: HubTourCardDict;
}) {
    // Shared with the hero (and sibling panels): a date picked anywhere selects
    // here too. Falls back to local state when standalone.
    const shared = useOptionalHubDate();
    const [localDate, setLocalDate] = useState<Date | undefined>(undefined);
    const date = shared ? shared.date : localDate;
    const setDate = shared ? shared.setDate : setLocalDate;
    const [dateOpen, setDateOpen] = useState(false);
    // Set of tour ids with a bookable departure on `date`; null = no date filter.
    const [availableIds, setAvailableIds] = useState<Set<string> | null>(null);
    const [checking, setChecking] = useState(false);

    // Keyed by VALUE (joined ids), not array identity: an RSC refresh streams
    // new props objects for the same data, and an identity-keyed effect would
    // re-fire the whole availability sweep on every refresh.
    const tourIdsKey = panel.groups
        .flatMap(g => g.tours.map(t => t.id))
        .join(',');
    const allTourIds = useMemo(
        () => (tourIdsKey ? tourIdsKey.split(',') : []),
        [tourIdsKey]
    );

    // When a date is picked, ask the backend which of this panel's tours run that
    // day and narrow the grid to them. Clearing the date drops the filter. Each
    // date change aborts the previous in-flight batch and ignores its result.
    useEffect(() => {
        if (!date) {
            setAvailableIds(null);
            setChecking(false);
            return;
        }
        const iso = format(date, 'yyyy-MM-dd');
        const controller = new AbortController();
        let cancelled = false;
        setChecking(true);
        filterToursAvailableOnDate(allTourIds, iso, controller.signal)
            .then(ids => {
                if (cancelled) return;
                setAvailableIds(ids);
                setChecking(false);
            })
            .catch(() => {
                if (cancelled) return;
                // Hard failure: abandon the filter rather than blank the grid.
                setAvailableIds(null);
                setChecking(false);
            });
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [date, allTourIds]);

    /*
     * Narrow to the day's tours AND carry that day onto each card's link. The
     * hub's date lives in React state rather than the URL, so without this the
     * traveller filters to the 27th, opens a card, and is asked for a date
     * again on a page that has no idea one was ever chosen.
     */
    const isoDate = date ? format(date, 'yyyy-MM-dd') : null;
    const filterTours = (tours: HubTour[]) => {
        const kept = availableIds
            ? tours.filter(t => availableIds.has(t.id))
            : tours;
        if (!isoDate) return kept;
        return kept.map(t =>
            t.href ? { ...t, href: `${t.href}?date=${isoDate}` } : t
        );
    };

    const filteredGroups = panel.groups.map(g => ({
        ...g,
        tours: filterTours(g.tours),
    }));
    const isEmpty =
        availableIds != null &&
        !checking &&
        filteredGroups.every(g => g.tours.length === 0);

    const grouped = panel.groups.some(g => g.title);

    return (
        <div
            className={`flex flex-col ${grouped ? 'gap-8 md:gap-12' : 'gap-6 md:gap-10'}`}>
            {/* Heading + date chip */}
            <Reveal className='flex flex-col gap-4 md:gap-6'>
                <div className='flex flex-col gap-1'>
                    <h2 className='m-0 font-it-display text-[clamp(22px,2.8vw,30px)] font-bold leading-[1.2] tracking-[-0.015em] text-it-ink'>
                        {panel.title}
                    </h2>
                    <p className='m-0 text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                        {panel.subtitle}
                    </p>
                </div>

                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                    <div className='inline-flex h-10 w-fit items-center gap-2 rounded-it-full border hover:bg-it-surface transition-colors duration-500 border-it-heading-subtle px-3 py-2 md:h-12.5 md:px-6 md:py-3'>
                        <PopoverTrigger asChild>
                            <motion.button
                                type='button'
                                transition={springPop}
                                className='flex cursor-pointer items-center gap-2 border-none bg-transparent p-0'>
                                <Image
                                    src='/icons/filters/calendar.svg'
                                    alt=''
                                    width={24}
                                    height={24}
                                    className='size-5 shrink-0 md:size-6'
                                />
                                <span className='whitespace-nowrap text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                    {date
                                        ? format(date, 'd MMM yyyy')
                                        : selectDate}
                                </span>
                            </motion.button>
                        </PopoverTrigger>
                        {date && (
                            <motion.button
                                type='button'
                                onClick={() => setDate(undefined)}
                                aria-label='Clear date'
                                whileTap={{ scale: 0.9 }}
                                transition={springPop}
                                className='flex shrink-0 cursor-pointer border-none bg-transparent p-0'>
                                <Image
                                    src='/icons/filters/close-circle-muted.svg'
                                    alt=''
                                    width={24}
                                    height={24}
                                    className='size-6'
                                />
                            </motion.button>
                        )}
                    </div>
                    <PopoverContent
                        align='start'
                        sideOffset={12}
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

                {checking && (
                    <p className='m-0 flex items-center gap-2 text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                        <span
                            className='size-4 shrink-0 animate-spin rounded-full border-2 border-it-heading/20 border-t-it-heading'
                            aria-hidden='true'
                        />
                        {filter.checking}
                    </p>
                )}
            </Reveal>

            {/* Card groups - single ungrouped grid, or titled groups separated by
                dividers (Figma "Private charters"). Narrowed to `filteredGroups`
                when a date is picked; dimmed while a check is in flight; replaced
                by an empty state when nothing runs on the chosen day. */}
            {isEmpty ? (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={crossFade}
                    className='flex flex-col items-start gap-4 py-6 md:py-10'>
                    <p className='m-0 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                        {filter.noneOnDate}
                    </p>
                    <motion.button
                        type='button'
                        onClick={() => setDate(undefined)}
                        whileTap={{ scale: 0.99 }}
                        transition={springPop}
                        className='cursor-pointer rounded-it-full border border-it-heading bg-transparent px-5 py-2 text-[14px] font-normal leading-[1.6] tracking-[-0.012em] text-it-heading transition-colors duration-300 hover:bg-it-heading/5'>
                        {filter.showAllDates}
                    </motion.button>
                </motion.div>
            ) : (
                <div
                    className={`flex flex-col transition-opacity duration-300 ${grouped ? 'gap-8 md:gap-12' : ''} ${checking ? 'opacity-60' : ''}`}>
                    {grouped
                        ? filteredGroups.map((group, gi) => (
                              <Fragment key={group.title ?? gi}>
                                  <div
                                      className='h-px w-full bg-it-heading/10'
                                      aria-hidden='true'
                                  />
                                  <div className='flex flex-col gap-6'>
                                      {group.title && (
                                          <Reveal>
                                              <h3 className='m-0 mt-4 border-t border-it-divider pt-[22px] text-[13px] font-bold uppercase tracking-[0.06em] text-it-ink'>
                                                  {group.title}
                                              </h3>
                                          </Reveal>
                                      )}
                                      <div className={GRID}>
                                          {group.tours.map((tour, i) => (
                                              <Reveal key={tour.id} listItem>
                                                  <HubTourCard
                                                      tour={tour}
                                                      dict={card}
                                                      // First card of the panel
                                                      // (first group only).
                                                      highlighted={
                                                          gi === 0 && i === 0
                                                      }
                                                  />
                                              </Reveal>
                                          ))}
                                      </div>
                                  </div>
                              </Fragment>
                          ))
                        : filteredGroups[0] && (
                              <div className={GRID}>
                                  {filteredGroups[0].tours.map((tour, i) => (
                                      <Reveal key={tour.id} listItem>
                                          <HubTourCard
                                              tour={tour}
                                              dict={card}
                                              highlighted={i === 0}
                                          />
                                      </Reveal>
                                  ))}
                              </div>
                          )}
                </div>
            )}

            {/* Editorial top-picks block (Private charters). Extra top spacing
                separates it from the grids above. */}
            {panel.picks && (
                <div className='pt-4 md:pt-8'>
                    <HubPicks data={panel.picks} />
                </div>
            )}
        </div>
    );
}

