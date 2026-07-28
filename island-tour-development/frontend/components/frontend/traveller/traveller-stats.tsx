import type { Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { TravellerSummary } from '@/lib/api/public/traveller';

import { money } from './traveller-format';

/**
 * The account stat row. `totalSpend` arrives per currency and is listed side
 * by side - EUR and USD are never added together, and there is no global
 * currency to convert into (this is what was actually charged).
 */
export function TravellerStats({
    summary,
    dict,
    locale,
}: {
    summary: TravellerSummary;
    dict: Dictionary['traveller'];
    locale: Locale;
}) {
    const spend = summary.totalSpend.length
        ? summary.totalSpend
              .map(s => money(s.amount, s.currency, locale))
              .join('  +  ')
        : money(0, 'EUR', locale);

    const tiles = [
        { label: dict.statsTrips, value: String(summary.bookingsCount) },
        { label: dict.statsUpcoming, value: String(summary.upcomingCount) },
        { label: dict.statsSpent, value: spend },
    ];

    return (
        <dl className='m-0 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4'>
            {tiles.map(tile => (
                <div
                    key={tile.label}
                    className='rounded-[16px] border border-it-heading/10 bg-it-surface px-5 py-4'>
                    <dt className='text-[13.5px] leading-[1.6] text-it-text-muted'>
                        {tile.label}
                    </dt>
                    <dd className='m-0 mt-1 font-medium text-[26px] leading-[1.3] tracking-[-0.012em] text-it-heading'>
                        {tile.value}
                    </dd>
                </div>
            ))}
        </dl>
    );
}
