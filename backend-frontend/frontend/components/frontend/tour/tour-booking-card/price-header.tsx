'use client';

import { useBooking } from '@/hooks/tours/use-booking';
import { bookingUnitLabel } from '@/lib/tours/booking';

/**
 * Price headline at the top of the card. PER_PERSON tours show "From {price} per
 * person"; UNIT (whole-unit / charter) tours show "From {basePrice} per {unit}"
 * (per group / boat / vehicle / aircraft / package) plus a sub-line stating the
 * included-guest coverage and the per-extra-guest surcharge (master §3.2).
 */
export function PriceHeader() {
    const { dict, data, money } = useBooking();
    const isUnit = data.pricingModel === 'UNIT';

    // Unit-type-aware suffix ("per person" / "per boat" / ...). Shared with the
    // mobile sticky bar, which repeats this headline once the card scrolls away.
    const unitLabel = bookingUnitLabel(data, dict);

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

    // Figma 48256:16637 draws this as a white band ruled off from a #f8f8f8
    // card body. The card is WHITE (founder, 2026-08-18 - the grey fill was
    // tried and reverted), so both the band and the rule are dropped: on a
    // white card the band is invisible and the rule is just a fence between
    // the price and the fields it belongs with.
    //
    // The TYPE is Figma's, a step down: 24/28/24 becomes 20/24/20, matching
    // the reduction the rest of the tour page took the same day.
    return (
        <div className='flex flex-col gap-0.5 px-4 pt-4'>
            <div className='flex flex-wrap items-baseline gap-x-1 text-[18px] leading-[1.2] tracking-[-0.012em] text-it-heading lg:text-[20px]'>
                <span>{dict.from}</span>
                <b className='text-[20px] font-bold leading-[1.4] tracking-[-0.012em] text-it-heading tabular-nums lg:text-[26px]'>
                    {money(data.priceFrom)}
                </b>
                <span>{unitLabel}</span>
            </div>
            {subLine && (
                <span className='text-[13px] leading-[1.5] text-it-text-muted tracking-[-0.012em]'>
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
