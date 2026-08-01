'use client';

import { useBooking } from '@/hooks/tours/use-booking';
import { springPop } from '@/lib/motion';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { BandStepperRow } from './band-stepper-row';
import { Collapse } from './collapse';
import { PriceSummary } from './price-summary';
import { Stepper } from './stepper';

/**
 * The traveller card: a header row (count + inline stepper for Pattern A, or a
 * chevron that expands the age-band steppers for Pattern B), the expandable body
 * of participant steppers (with any applied spectator steppers folded in), and
 * the price summary that takes over the same card once the party is confirmed.
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
    } = useBooking();

    // UNIT (charter) tours count "guests"; everything else counts "travelers".
    const travelersLabel = (isUnit ? dict.guests : dict.travelers).replace(
        '{count}',
        String(travelerCount)
    );

    const headerLabel = (
        <span className='flex items-center gap-2.5 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
            <Image
                src='/icons/booking-travelers.svg'
                alt=''
                width={24}
                height={24}
                className='size-6 shrink-0'
            />
            {travelersLabel}
        </span>
    );

    return (
        <div className='rounded-it-sm border border-it-border bg-it-white transition-colors duration-(--it-duration-xs)'>
            {/* Header row. Pattern B (chevron): the WHOLE row is the toggle -
                clicking anywhere on it opens the steppers, not just the small
                chevron. Pattern A keeps the plain row (it holds the inline
                stepper, which is the interaction). */}
            {headerHasChevron ? (
                <motion.button
                    type='button'
                    aria-expanded={partyOpen}
                    onClick={() => togglePartyOpen()}
                    whileTap={{ scale: 0.99 }}
                    transition={springPop}
                    className='flex w-full cursor-pointer items-center justify-between gap-2.5 border-none bg-transparent px-[13px] py-[11px] text-left'>
                    {headerLabel}
                    <Image
                        src='/icons/booking-chevron-down.svg'
                        alt=''
                        width={20}
                        height={20}
                        className={`size-5 shrink-0 transition-transform duration-300 ${
                            partyOpen ? 'rotate-180' : ''
                        }`}
                    />
                </motion.button>
            ) : (
                <div className='flex items-center justify-between gap-2.5 px-4 py-4'>
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

            {/* Body: party steppers */}
            <Collapse open={showPartyBody}>
                <div className='flex flex-col gap-3.5 px-4 pb-4'>
                    <div className='h-px w-full bg-it-heading/10' />
                    {participantBands.map(band => (
                        <BandStepperRow
                            key={band.id}
                            band={band}
                            min={partyMin(band)}
                        />
                    ))}

                    {/* Once spectators are applied, their steppers fold in here
                        below a separator. */}
                    {spectatorsApplied && spectatorsOn && (
                        <>
                            <div className='h-px w-full bg-it-heading/10' />
                            <span className='font-normal text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                {dict.spectators}
                            </span>
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

            {/* Body: price breakdown + totals (once ready). */}
            <PriceSummary />
        </div>
    );
}

