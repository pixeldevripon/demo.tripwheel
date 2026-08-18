import type { CheckoutTotals } from '@/lib/checkout/checkout';
import type { Currency, Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import Image from 'next/image';
import Link from 'next/link';
import {
    CheckoutLiveAmount,
    CheckoutSummaryPickupRow,
    CheckoutSummaryTotals,
    type CheckoutBreakdownRow,
} from './checkout-pickup-label';

type CheckoutDict = Dictionary['checkout'];

interface CheckoutSummaryProps {
    dict: CheckoutDict;
    locale: Locale;
    /** Tour URL to return to (edit pencil) - the availability widget. */
    tourHref: string;
    tourTitle: string;
    /** Hero image URL for the thumbnail, or null for the grey placeholder. */
    tourImage: string | null;
    /** Localized "Tue 28 May", or null when no date is selected. */
    dateLabel: string | null;
    /** Localized "8:00 AM", or null when no time is selected. */
    timeLabel: string | null;
    /** Aggregated party line, e.g. "2 Adult, 1 Child". */
    partyLabel: string;
    /** Pickup state - "No pickup" or the chosen location name. */
    pickupLabel: string;
    cancellationHours: number;
    totals: CheckoutTotals;
    /** Server-derived per-line breakdown (participants + extras) for the URL
     *  selection; a pickup re-quote swaps in the live lines. */
    breakdownRows?: CheckoutBreakdownRow[];
    currency: Currency;
}

const rowText = 'text-[13.5px] leading-[1.6] text-it-heading';

/** A left-icon + label detail row inside the summary card (icon 24, gap 10). */
function SummaryRow({
    icon,
    label,
    value,
    className,
}: {
    icon: string;
    label: string;
    value?: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={`flex items-center justify-between gap-2.5 ${className ?? ''}`}>
            <span className={`flex items-center gap-2.5 ${rowText}`}>
                <Image
                    src={icon}
                    alt=''
                    width={24}
                    height={24}
                    className='size-4 shrink-0'
                />
                {label}
            </span>
            {value && (
                <span className={`${rowText} font-bold tabular-nums`}>
                    {value}
                </span>
            )}
        </div>
    );
}

/**
 * Persistent booking summary alongside the checkout phases (Figma node
 * 48208:20924). Presentational + server-rendered: it mirrors the selection the
 * traveller made in the widget (date, time, party, pickup) and the price split,
 * with the edit pencil returning them to the availability widget.
 *
 * Zero-amount money rows are hidden (master §5.8 / conflict log 82):
 * `operator_full` shows Total + Balance later, `paid_in_full` shows Total + Pay
 * today, deposit models show all three.
 */
export function CheckoutSummary({
    dict,
    locale,
    tourHref,
    tourTitle,
    tourImage,
    dateLabel,
    timeLabel,
    partyLabel,
    pickupLabel,
    cancellationHours,
    totals,
    breakdownRows,
    currency,
}: CheckoutSummaryProps) {
    return (
        <div className='flex flex-col gap-4 rounded-it-lg border border-it-divider bg-it-white p-5 shadow-it-sm'>
            {/* Header */}
            <div className='flex flex-col gap-4'>
                <div className='flex items-start justify-between gap-4'>
                    <span className='font-it-display text-[16px] font-medium leading-[1.4] tracking-[-0.012em] text-it-heading'>
                        {dict.bookingSummary}
                    </span>
                    <Link
                        href={tourHref}
                        aria-label={dict.edit}
                        className='shrink-0'>
                        <Image
                            src='/icons/checkout/edit.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-[15px] shrink-0'
                        />
                    </Link>
                </div>
                <div className='h-px w-full bg-it-divider' />
            </div>

            <div className='flex flex-col gap-3'>
                {/* Tour thumbnail + title */}
                <div className='flex items-center gap-4'>
                    <div className='relative size-[60px] shrink-0 overflow-hidden rounded-it-sm bg-it-bg'>
                        {tourImage && (
                            <Image
                                src={tourImage}
                                alt=''
                                fill
                                sizes='60px'
                                className='object-cover'
                            />
                        )}
                    </div>
                    <span className='text-[13px] font-medium leading-[1.4] text-it-heading'>
                        {tourTitle}
                    </span>
                </div>

                {/* Detail card */}
                <div className='flex flex-col gap-0.5 border-t border-it-divider pt-3'>
                    {dateLabel && (
                        <SummaryRow
                            icon='/icons/booking-calendar.svg'
                            label={dateLabel}
                        />
                    )}
                    {timeLabel && (
                        <SummaryRow icon='/icons/clock.svg' label={timeLabel} />
                    )}
                    <SummaryRow
                        className='py-1'
                        icon='/icons/booking-travelers.svg'
                        label={partyLabel}
                        value={
                            <CheckoutLiveAmount
                                kind='total'
                                fallback={totals.total}
                                currency={currency}
                                locale={locale}
                            />
                        }
                    />
                    {/* Live: reflects the pickup chosen in the checkout form via
                        PickupLabelProvider; this server prop is only the initial
                        fallback ("No pickup"). */}
                    <CheckoutSummaryPickupRow fallback={pickupLabel} />

                    <div className='h-px w-full bg-it-divider' />

                    <div className='flex items-center gap-2 text-[13px] font-medium leading-[1.6] text-it-green-text'>
                        <Image
                            src='/icons/booking-check.svg'
                            alt=''
                            width={20}
                            height={20}
                            className='size-4 shrink-0'
                        />
                        {dict.freeCancellation.replace(
                            '{hours}',
                            String(cancellationHours)
                        )}
                    </div>

                    <div className='h-px w-full bg-it-divider' />

                    <div className='flex flex-col gap-2'>
                        {/* Live: a priced pickup chosen in the form re-quotes
                            and updates these rows; the server totals are only
                            the initial fallback. */}
                        <CheckoutSummaryTotals
                            fallback={{
                                total: totals.total,
                                payToday: totals.payToday,
                                balanceLater: totals.balanceLater,
                            }}
                            fallbackLines={breakdownRows}
                            labels={{
                                total: dict.total,
                                payToday: dict.payToday,
                                balanceLater: dict.balanceLater,
                            }}
                            currency={currency}
                            locale={locale}
                        />
                        <span className='text-[12px] leading-[1.6] text-it-text-muted'>
                            {dict.taxesIncluded}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

