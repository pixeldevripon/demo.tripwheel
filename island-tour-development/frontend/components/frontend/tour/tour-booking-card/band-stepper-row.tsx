'use client';

import type { BookingBand } from '@/lib/tours/booking';
import { useBooking } from '@/hooks/tours/use-booking';
import { Stepper } from './stepper';

/**
 * One priced band row: label + per-person price on the left, a count stepper on
 * the right. Shared by the traveller panel, the folded-in spectator rows, and
 * the standalone spectators panel - only the `min` floor differs per caller.
 */
export function BandStepperRow({
    band,
    min,
}: {
    band: BookingBand;
    min: number;
}) {
    const { counts, effectiveMax, bandLabel, bandPriceLabel, setBandCount } =
        useBooking();
    // "Adult (Age 13+)" - the operator's noun, the localized age qualifier.
    const label = bandLabel(band);
    return (
        // `.trav .row` (mck-15): 9px of vertical room and a hairline between
        // rows, none after the last. The divider is what makes three bands read
        // as a list rather than as three floating pairs.
        <div className='flex items-center justify-between gap-1 border-b border-it-divider py-[9px] last:border-b-0'>
            <span className='flex flex-col'>
                <span className='text-[14px] font-semibold leading-[1.6] text-it-ink'>
                    {label}
                </span>
                <span className='text-[12px] leading-[1.6] text-it-text-muted'>
                    {bandPriceLabel(band)}
                </span>
            </span>
            <Stepper
                value={counts[band.id] ?? 0}
                min={min}
                max={effectiveMax}
                decLabel={`− ${label}`}
                incLabel={`+ ${label}`}
                onChange={n => setBandCount(band, n)}
            />
        </div>
    );
}
