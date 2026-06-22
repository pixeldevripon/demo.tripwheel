'use client';

import { format } from 'date-fns';
import Image from 'next/image';
import { Fragment, useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { HubTourCard, type HubTour, type HubTourCardDict } from './hub-tour-card';
import { HubPicks, type HubPicksData } from './hub-picks';
import { Reveal } from './reveal';

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

const GRID =
    'grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-10';

/**
 * One panel of the hub trips/charters listing - a heading + its own date chip,
 * then either a single ungrouped grid ("Trips", node 48024:11222) or titled
 * groups separated by dividers ("Private charters", node 48024:11455).
 */
export function HubTripsPanel({
    panel,
    selectDate,
    card,
}: {
    panel: HubTripsPanelData;
    selectDate: string;
    card: HubTourCardDict;
}) {
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [dateOpen, setDateOpen] = useState(false);
    const grouped = panel.groups.some((g) => g.title);

    return (
        <div
            className={`flex flex-col ${grouped ? 'gap-8 md:gap-12' : 'gap-6 md:gap-10'}`}>
            {/* Heading + date chip */}
            <Reveal className='flex flex-col gap-4 md:gap-6'>
                <div className='flex flex-col gap-1'>
                    <h2 className='m-0 font-medium text-[20px] md:text-[32px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                        {panel.title}
                    </h2>
                    <p className='m-0 text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                        {panel.subtitle}
                    </p>
                </div>

                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                    <div className='inline-flex h-10 w-fit items-center gap-2 rounded-it-full border border-it-heading px-3 py-2 md:h-12.5 md:px-6 md:py-3'>
                        <PopoverTrigger asChild>
                            <button
                                type='button'
                                className='flex cursor-pointer items-center gap-2 border-none bg-transparent p-0'>
                                <Image
                                    src='/icons/filters/calendar.svg'
                                    alt=''
                                    width={24}
                                    height={24}
                                    className='size-5 shrink-0 md:size-6'
                                />
                                <span className='whitespace-nowrap text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                    {date ? format(date, 'd MMM yyyy') : selectDate}
                                </span>
                            </button>
                        </PopoverTrigger>
                        {date && (
                            <button
                                type='button'
                                onClick={() => setDate(undefined)}
                                aria-label='Clear date'
                                className='flex shrink-0 cursor-pointer border-none bg-transparent p-0'>
                                <Image
                                    src='/icons/filters/close-circle-muted.svg'
                                    alt=''
                                    width={24}
                                    height={24}
                                    className='size-6'
                                />
                            </button>
                        )}
                    </div>
                    <PopoverContent
                        align='start'
                        sideOffset={12}
                        className='w-auto rounded-[8px] bg-it-white p-0 text-it-heading'>
                        <Calendar
                            mode='single'
                            selected={date}
                            onSelect={(selected) => {
                                setDate(selected);
                                setDateOpen(false);
                            }}
                            disabled={{ before: new Date() }}
                            autoFocus
                            className='bg-it-white [--cell-radius:8px]'
                        />
                    </PopoverContent>
                </Popover>
            </Reveal>

            {/* Card groups - single ungrouped grid, or titled groups separated by
                dividers (Figma "Private charters"). */}
            {grouped
                ? panel.groups.map((group, gi) => (
                      <Fragment key={group.title ?? gi}>
                          <div
                              className='h-px w-full bg-it-heading/10'
                              aria-hidden='true'
                          />
                          <Reveal className='flex flex-col gap-6'>
                              {group.title && (
                                  <h3 className='m-0 font-medium text-[24px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                                      {group.title}
                                  </h3>
                              )}
                              <div className={GRID}>
                                  {group.tours.map((tour) => (
                                      <HubTourCard
                                          key={tour.id}
                                          tour={tour}
                                          dict={card}
                                      />
                                  ))}
                              </div>
                          </Reveal>
                      </Fragment>
                  ))
                : panel.groups[0] && (
                      <Reveal className={GRID}>
                          {panel.groups[0].tours.map((tour) => (
                              <HubTourCard key={tour.id} tour={tour} dict={card} />
                          ))}
                      </Reveal>
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
