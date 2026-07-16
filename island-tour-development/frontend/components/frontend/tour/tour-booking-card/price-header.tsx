'use client';

import { useBooking } from '@/hooks/tours/use-booking';
import { priceUnitLabel } from '@/lib/tours/pricing-label';

/**
 * Price headline at the top of the card. PER_PERSON tours show "From {price} per
 * person"; UNIT (whole-unit / charter) tours show "From {basePrice} per {unit}"
 * (per group / boat / vehicle / aircraft / package) plus a sub-line stating the
 * included-guest coverage and the per-extra-guest surcharge (master §3.2).
 */
export function PriceHeader() {
    const { dict, data, money } = useBooking();
    const isUnit = data.pricingModel === 'UNIT';

    // Unit-type-aware suffix ("per person" / "per boat" / ...).
    const unitLabel = priceUnitLabel(
        { pricingModel: data.pricingModel, wholeUnitType: data.wholeUnitType },
        {
            per: dict.perPerson,
            perGroup: dict.perGroup,
            perBoat: dict.perBoat,
            perVehicle: dict.perVehicle,
            perAircraft: dict.perAircraft,
            perPackage: dict.perPackage,
        }
    );

    // UNIT sub-line: "Up to N guests" + "+{price} per extra guest" when a
    // surcharge applies.
    const includes =
        isUnit && data.unitIncludedGuests != null
            ? dict.unitIncludes.replace(
                  '{count}',
                  String(data.unitIncludedGuests)
              )
            : null;
    const extra =
        isUnit && data.extraPersonPrice > 0
            ? dict.unitExtra.replace('{price}', money(data.extraPersonPrice))
            : null;
    const subLine = [includes, extra].filter(Boolean).join(' · ');

    // Copy-only badge for a private charter (D3): a unit-priced PRIVATE booking takes
    // the whole departure, so the traveler gets exclusive use.
    const isPrivateCharter = isUnit && data.bookingType === 'PRIVATE';

    return (
        <div className='flex flex-col gap-1 border-b border-it-heading/10 px-4 py-4 text-it-heading'>
            <div className='flex items-baseline gap-1'>
                <span className='text-[24px] leading-[1.2] tracking-[-0.012em]'>
                    {dict.from}
                </span>
                <span className='font-bold text-[28px] leading-[1.4] tracking-[-0.012em]'>
                    {money(data.priceFrom)}
                </span>
                <span className='text-[24px] leading-[1.2] tracking-[-0.012em]'>
                    {unitLabel}
                </span>
            </div>
            {subLine && (
                <span className='text-[14px] leading-[1.5] tracking-[-0.012em] text-it-ink-muted'>
                    {subLine}
                </span>
            )}
            {isPrivateCharter && (
                <span className='mt-1 inline-flex w-fit items-center rounded-it-full bg-it-primary/10 px-3 py-1 font-medium text-[12px] leading-[1.4] tracking-[-0.012em] text-it-primary'>
                    {dict.privateCharter}
                </span>
            )}
        </div>
    );
}
