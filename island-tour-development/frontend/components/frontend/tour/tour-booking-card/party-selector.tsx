'use client';

import { useBooking } from '@/hooks/tours/use-booking';
import { formatPlural } from '@/lib/i18n/plural';
import { springPop } from '@/lib/motion';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { BandStepperRow } from './band-stepper-row';
import { Collapse } from './collapse';
import { Stepper } from './stepper';

/**
 * The traveller card: a header row (count + inline stepper for Pattern A, or a
 * chevron that expands the age-band steppers for Pattern B) and the expandable
 * body of participant steppers, with any applied spectator steppers folded in.
 *
 * The price used to live in here too, so collapsing the party left a box titled
 * "5 travelers" holding a price breakdown (Pastel #58). It is its own block now,
 * below the extras. The header keeps saying "Travelers" with the count; who they
 * are shows up in the breakdown, where it belongs.
 */
export function PartySelector() {
    const {
        dict,
        data,
        isUnit,
        travelerCount,
        headerHasChevron,
        showInlineStepper,
        showPartyBody,
        partyOpen,
        togglePartyOpen,
        participantBands,
        spectatorBands,
        spectatorsApplied,
        spectatorsOn,
        counts,
        effectiveMax,
        partyMin,
        setBandCount,
        locale,
    } = useBooking();

    // UNIT (charter) tours count "guests"; everything else counts "travelers".
    const travelersLabel = formatPlural(
        isUnit ? dict.guests : dict.travelers,
        travelerCount,
        locale
    );

    // `.wfield` content: 17px icon, then the count at 14px semibold.
    const headerLabel = (
        <span className='flex items-center gap-2.5 text-[16px] leading-[1.6] text-it-heading tracking-[-0.012em]'>
            <Image
                src='/icons/booking-travelers.svg'
                alt=''
                width={24}
                height={24}
                className='size-[17px] shrink-0'
            />
            {travelersLabel}
        </span>
    );

    return (
        <div>
            {/* The FIELD (mck-15 `.wfield`), a sibling of the date field in the
                same 8px stack - not a box wrapped around the panel. Pattern B
                (chevron): the WHOLE row is the toggle, not just the small
                chevron. Pattern A keeps the plain row (it holds the inline
                stepper, which is the interaction). */}
            {headerHasChevron ? (
                <motion.button
                    type='button'
                    aria-expanded={partyOpen}
                    onClick={() => togglePartyOpen()}
                    whileTap={{ scale: 0.99 }}
                    transition={springPop}
                    className='flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-it-sm border border-it-border bg-it-white px-[13px] py-[11px] text-left'>
                    {headerLabel}
                    <Image
                        src='/icons/booking-chevron-down.svg'
                        alt=''
                        width={20}
                        height={20}
                        className={`size-[17px] shrink-0 transition-transform duration-300 ${
                            partyOpen ? 'rotate-180' : ''
                        }`}
                    />
                </motion.button>
            ) : (
                <div className='flex items-center justify-between gap-2.5 rounded-it-sm border border-it-border bg-it-white px-[13px] py-[11px]'>
                    {headerLabel}
                    {showInlineStepper && (
                        <Stepper
                            value={counts[participantBands[0].id] ?? 0}
                            min={Math.max(0, Math.min(1, data.minPartySize))}
                            max={effectiveMax}
                            decLabel={`− ${participantBands[0].label}`}
                            incLabel={`+ ${participantBands[0].label}`}
                            onChange={n => setBandCount(participantBands[0], n)}
                        />
                    )}
                </div>
            )}

            {/* The PANEL (`.trav.travinline`): its own bordered box below the
                field, 8px down, with the rows separated by hairlines rather
                than floated on gaps. */}
            <Collapse open={showPartyBody}>
                {/* 10px, the fields'radius - NOT the mockup's own 16px
                    (`.trav` keeps the r-lg it has as a floating popover, and
                    `.travinline` never overrides it). Inline under a 10px
                    field, the softer corner read as a different kind of box;
                    Ripon's call, 2026-08-09. */}
                <div className='mt-2 rounded-it-sm border border-it-border bg-it-white px-3.5 py-0.5'>
                    {participantBands.map(band => (
                        <BandStepperRow
                            key={band.id}
                            band={band}
                            min={partyMin(band)}
                        />
                    ))}

                    {/* Once spectators are applied, their steppers fold in here
                        under their own heading. */}
                    {spectatorsApplied && spectatorsOn && (
                        <>
                            <div className='border-t border-it-divider pt-2.5 text-[12px] font-medium leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                                {dict.spectators}
                            </div>
                            {spectatorBands.map(band => (
                                <BandStepperRow
                                    key={band.id}
                                    band={band}
                                    min={0}
                                />
                            ))}
                        </>
                    )}
                </div>
            </Collapse>
        </div>
    );
}

