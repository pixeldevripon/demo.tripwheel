import { Reveal } from '@/components/frontend/reveal';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { ThankYouBooking } from '@/lib/thank-you/thank-you';
import Image from 'next/image';
import type { ReactNode } from 'react';

type ThankYouDict = Dictionary['thankYou'];

const rowValue =
    'text-right text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading';
const rowLabel =
    'text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted';

/** Icon + muted label | right-aligned value (TOUR DETAILS rows). */
function DetailRow({
    icon,
    label,
    children,
}: {
    icon: string;
    label: string;
    children: ReactNode;
}) {
    return (
        <div className='flex items-center justify-between gap-4'>
            <span className='flex shrink-0 items-center gap-2.5'>
                <Image src={icon} alt='' width={24} height={24} className='size-6' />
                <span className={rowLabel}>{label}</span>
            </span>
            <span className={`min-w-0 ${rowValue}`}>{children}</span>
        </div>
    );
}

/** Percentage status chip (green = paid, orange = unpaid). */
function PctChip({ tone, children }: { tone: 'paid' | 'unpaid'; children: ReactNode }) {
    return (
        <span
            className={`flex h-6 w-[92px] shrink-0 items-center justify-center rounded-full text-[14px] leading-[1.6] tracking-[-0.012em] ${
                tone === 'paid'
                    ? 'bg-it-green/8 text-it-green'
                    : 'bg-it-primary/8 text-it-primary'
            }`}>
            {children}
        </span>
    );
}

/**
 * "Your booking summary" section (Figma 47744-9211): TOUR DETAILS and PAYMENT
 * cards side by side on the surface band. Zero-amount money rows are hidden
 * (BOOKING-FLOW-DESIGN-GUIDE.md §13 rule applied to the TYP as well).
 */
export function ThankYouSummary({
    booking,
    dict,
}: {
    booking: ThankYouBooking;
    dict: ThankYouDict;
}) {
    const { payment } = booking;
    const money = (n: number) => `${payment.currencySymbol}${n}`;

    return (
        <section className='it-section bg-it-surface'>
            <div className='it-container flex flex-col gap-6'>
                <Reveal>
                    <h2 className='m-0 font-medium text-[28px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                        {dict.summaryTitle}
                    </h2>
                </Reveal>
                <div className='grid gap-6 lg:grid-cols-2'>
                    <Reveal>
                        <div className='flex h-full flex-col gap-8 rounded-[16px] border border-it-heading/10 bg-it-white p-6'>
                            <h3 className='m-0 font-medium text-[20px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                {dict.tourDetails}
                            </h3>
                            <div className='flex flex-col gap-3.5'>
                                <DetailRow
                                    icon='/icons/thank-you/detail-calendar.svg'
                                    label={dict.dateTime}>
                                    <span className='flex items-center gap-4'>
                                        {booking.dateLabel}
                                        <span className='size-1.5 shrink-0 rounded-full bg-it-heading/20' />
                                        {booking.timeRangeLabel}
                                    </span>
                                </DetailRow>
                                <DetailRow
                                    icon='/icons/thank-you/detail-clock.svg'
                                    label={dict.duration}>
                                    {booking.durationLabel}
                                </DetailRow>
                                <DetailRow
                                    icon='/icons/thank-you/detail-location.svg'
                                    label={dict.pickup}>
                                    {booking.pickupLabel}
                                </DetailRow>
                                <DetailRow
                                    icon='/icons/thank-you/detail-cancel.svg'
                                    label={dict.freeCancel}>
                                    {dict.beforeDate.replace(
                                        '{date}',
                                        booking.freeCancelBeforeLabel,
                                    )}
                                </DetailRow>
                                <DetailRow
                                    icon='/icons/thank-you/detail-trip.svg'
                                    label={dict.trip}>
                                    {booking.operatorName}
                                </DetailRow>
                                <DetailRow
                                    icon='/icons/thank-you/detail-sms.svg'
                                    label={dict.email}>
                                    {booking.operatorEmail}
                                </DetailRow>
                                <DetailRow
                                    icon='/icons/thank-you/detail-call.svg'
                                    label={dict.phoneNumber}>
                                    {booking.operatorPhone}
                                </DetailRow>
                                <DetailRow
                                    icon='/icons/thank-you/detail-travelers.svg'
                                    label={dict.traveler}>
                                    {booking.partyLabel}
                                </DetailRow>
                                <DetailRow
                                    icon='/icons/thank-you/detail-profile.svg'
                                    label={dict.guestLead}>
                                    {booking.guestLead}
                                </DetailRow>
                            </div>
                        </div>
                    </Reveal>
                    <Reveal delay={0.3}>
                        <div className='flex h-full flex-col gap-8 rounded-[16px] border border-it-heading/10 bg-it-white p-6'>
                            <h3 className='m-0 font-medium text-[20px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                {dict.paymentTitle}
                            </h3>
                            <div className='flex flex-col gap-3.5'>
                                {payment.depositPaid > 0 && (
                                    <div className='flex justify-between gap-4'>
                                        <span className={rowLabel}>{dict.depositPaid}</span>
                                        <span className='flex flex-col items-end gap-2'>
                                            <span className='flex items-center gap-2'>
                                                <span className={rowValue}>
                                                    {money(payment.depositPaid)}
                                                </span>
                                                <PctChip tone='paid'>
                                                    {dict.percentPaid.replace(
                                                        '{pct}',
                                                        String(payment.depositPct),
                                                    )}
                                                </PctChip>
                                            </span>
                                            <span className={rowValue}>
                                                {payment.cardLabel}
                                            </span>
                                        </span>
                                    </div>
                                )}
                                {payment.balance > 0 && (
                                    <>
                                        <div className='flex justify-between gap-4'>
                                            <span className={rowLabel}>
                                                {dict.remainingBalance}
                                            </span>
                                            <span className='flex flex-col items-end gap-2'>
                                                <span className='flex items-center gap-2'>
                                                    <span className={rowValue}>
                                                        {money(payment.balance)}
                                                    </span>
                                                    <PctChip tone='unpaid'>
                                                        {dict.percentUnpaid.replace(
                                                            '{pct}',
                                                            String(payment.balancePct),
                                                        )}
                                                    </PctChip>
                                                </span>
                                                <span className={rowValue}>
                                                    {dict.operatorLinkNote.replace(
                                                        '{operator}',
                                                        booking.operatorShortName,
                                                    )}
                                                </span>
                                            </span>
                                        </div>
                                        <div className='flex justify-between gap-4'>
                                            <span className={rowLabel}>{dict.payBefore}</span>
                                            <span className='flex flex-col items-end gap-[5px]'>
                                                <span className='text-right text-[16px] leading-[1.6] tracking-[-0.012em] text-it-primary'>
                                                    {payment.payBeforeLabel}
                                                </span>
                                                <span className={rowValue}>
                                                    {dict.cardOnly}
                                                </span>
                                            </span>
                                        </div>
                                    </>
                                )}
                                <div className='h-px bg-it-heading/10' />
                                <div className='flex items-center justify-between gap-1'>
                                    <span className={rowLabel}>{dict.total}</span>
                                    <span className={rowValue}>{money(payment.total)}</span>
                                </div>
                                <div className='flex items-center justify-between gap-1'>
                                    <span className={rowLabel}>{dict.ref}</span>
                                    <span className={rowValue}>{booking.displayRef}</span>
                                </div>
                            </div>
                        </div>
                    </Reveal>
                </div>
            </div>
        </section>
    );
}
