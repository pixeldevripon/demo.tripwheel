'use client';

import Image from 'next/image';
import { BandStepperRow } from './band-stepper-row';
import { useBooking } from '@/hooks/tours/use-booking';
import { Collapse } from './collapse';

/**
 * Standalone spectators block (Figma nodes 49212:8174 / 49212:8187). Surfaces
 * once the traveller count is touched: a Yes/No choice, then (on "Yes") the
 * spectator steppers + an Apply action. On "Yes" it stays open; on "Apply"/"No"
 * it folds away and the chosen spectators move into the traveller panel / totals.
 */
export function SpectatorsPanel() {
    const {
        dict,
        money,
        hasSpectators,
        travelerTouched,
        editingParty,
        spectatorsApplied,
        spectatorsOn,
        setSpectatorsOn,
        setSpectatorsApplied,
        spectatorBands,
        clearSpectatorCounts,
    } = useBooking();

    return (
        <Collapse
            open={
                hasSpectators &&
                travelerTouched &&
                editingParty &&
                !spectatorsApplied
            }>
            <div className='flex flex-col gap-6 rounded-[8px] bg-it-white px-4 py-6.5'>
                {spectatorsOn ? (
                    <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                        {dict.bringingSpectators}
                    </span>
                ) : (
                    <div className='flex flex-col gap-3.5'>
                        <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                            {dict.bringingSpectators}
                        </span>
                        <div className='flex items-center justify-between gap-2'>
                            {spectatorBands.map((band, i) => (
                                <span
                                    key={band.id}
                                    className='flex items-center gap-2 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                    {i > 0 && (
                                        <span className='size-1 shrink-0 rounded-full bg-[#d9d9d9]' />
                                    )}
                                    {`${band.label.split(' (')[0]} ${money(
                                        band.price
                                    )}`}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <div className='grid grid-cols-2 gap-2'>
                    {[
                        { on: false, label: dict.no },
                        { on: true, label: dict.yes },
                    ].map(opt => {
                        // Only "Yes" ever shows as active; "No" dismisses the
                        // block rather than staying lit.
                        const active = opt.on && spectatorsOn;
                        return (
                            <button
                                key={opt.label}
                                type='button'
                                onClick={() => {
                                    if (opt.on) {
                                        setSpectatorsOn(true);
                                        return;
                                    }
                                    // "No": clear spectators and remove the block.
                                    setSpectatorsOn(false);
                                    clearSpectatorCounts();
                                    setSpectatorsApplied(true);
                                }}
                                className={`cursor-pointer rounded-[8px] bg-it-surface px-4 py-2 text-center font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading transition-colors ${
                                    active
                                        ? 'border border-it-primary'
                                        : 'border border-transparent'
                                }`}>
                                {opt.label}
                            </button>
                        );
                    })}
                </div>

                <Collapse open={spectatorsOn}>
                    <div className='flex flex-col gap-3.5'>
                        <div className='h-px w-full bg-it-heading/10' />
                        {spectatorBands.map(band => (
                            <BandStepperRow key={band.id} band={band} min={0} />
                        ))}
                        <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                            {dict.spectatorNote}
                        </span>
                    </div>
                </Collapse>

                {/* Apply only surfaces once "Yes" is chosen. */}
                {spectatorsOn && (
                    <button
                        type='button'
                        onClick={() => setSpectatorsApplied(true)}
                        className='flex cursor-pointer items-center gap-2.5 self-center border-none bg-transparent font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-primary'>
                        {dict.apply}
                        <Image
                            src='/icons/cta-arrow-right.svg'
                            alt=''
                            width={20}
                            height={20}
                            className='size-5 shrink-0'
                        />
                    </button>
                )}
            </div>
        </Collapse>
    );
}
