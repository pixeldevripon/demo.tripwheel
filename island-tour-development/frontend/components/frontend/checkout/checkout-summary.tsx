import {
    formatCheckoutMoney,
    type CheckoutTotals,
} from '@/lib/checkout/checkout';
import type { Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import Image from 'next/image';
import Link from 'next/link';

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
    currencySymbol: string;
}

const rowText = 'text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading';

/** A left-icon + label detail row inside the summary card (icon 24, gap 10). */
function SummaryRow({
    icon,
    label,
    value,
    className,
}: {
    icon: string;
    label: string;
    value?: string;
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
                    className='size-6 shrink-0'
                />
                {label}
            </span>
            {value && <span className={rowText}>{value}</span>}
        </div>
    );
}

/** A Total / Pay today / Balance later money row. */
function TotalRow({ label, value }: { label: string; value: string }) {
    return (
        <div className={`flex items-center justify-between gap-1 ${rowText}`}>
            <span>{label}</span>
            <span>{value}</span>
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
    currencySymbol,
}: CheckoutSummaryProps) {
    const money = (n: number) => formatCheckoutMoney(n, currencySymbol, locale);
    const showPayToday = totals.payToday > 0;
    const showBalance = totals.balanceLater > 0;

    return (
        <div className='flex flex-col gap-6 rounded-[16px] bg-it-surface p-4'>
            {/* Header */}
            <div className='flex flex-col gap-4'>
                <div className='flex items-start justify-between gap-4'>
                    <span className='font-medium text-[18px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
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
                            className='size-6 shrink-0'
                        />
                    </Link>
                </div>
                <div className='h-px w-full bg-it-heading/10' />
            </div>

            <div className='flex flex-col gap-3'>
                {/* Tour thumbnail + title */}
                <div className='flex items-center gap-4'>
                    <div className='relative h-[76px] w-[112px] shrink-0 overflow-hidden rounded-[8px] bg-[#ededed]'>
                        {tourImage && (
                            <Image
                                src={tourImage}
                                alt=''
                                fill
                                sizes='112px'
                                className='object-cover'
                            />
                        )}
                    </div>
                    <span className={rowText}>{tourTitle}</span>
                </div>

                {/* Detail card */}
                <div className='flex flex-col gap-3.5 rounded-[8px] bg-it-white px-4 py-[26px]'>
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
                        value={money(totals.total)}
                    />
                    <SummaryRow
                        icon='/icons/checkout/location.svg'
                        label={pickupLabel}
                    />

                    <div className='h-px w-full bg-it-heading/10' />

                    <div className={`flex items-center gap-2 ${rowText}`}>
                        <Image
                            src='/icons/booking-check.svg'
                            alt=''
                            width={20}
                            height={20}
                            className='size-5 shrink-0'
                        />
                        {dict.freeCancellation.replace(
                            '{hours}',
                            String(cancellationHours),
                        )}
                    </div>

                    <div className='h-px w-full bg-it-heading/10' />

                    <div className='flex flex-col gap-2'>
                        <TotalRow
                            label={dict.total}
                            value={money(totals.total)}
                        />
                        {showPayToday && (
                            <TotalRow
                                label={dict.payToday}
                                value={money(totals.payToday)}
                            />
                        )}
                        {showBalance && (
                            <TotalRow
                                label={dict.balanceLater}
                                value={money(totals.balanceLater)}
                            />
                        )}
                        <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading/50'>
                            {dict.taxesIncluded}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
