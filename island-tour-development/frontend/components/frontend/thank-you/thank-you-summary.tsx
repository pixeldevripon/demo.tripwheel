import { Reveal } from '@/components/frontend/reveal';
import { formatMoney } from '@/lib/currency/current';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/constants/locales';
import type { ThankYouBooking } from '@/lib/thank-you/thank-you';
import Image from 'next/image';
import type { ReactNode } from 'react';

type ThankYouDict = Dictionary['thankYou'];

const rowValue =
    'text-right text-[14px] font-bold leading-[1.6] text-it-ink';
const rowLabel =
    'text-[14px] font-semibold leading-[1.6] text-it-text-muted';
/** Highlighted, tappable contact value (mailto/tel/map) - Figma 47744-9211. */
const rowLink =
    'text-it-primary underline underline-offset-2 transition-opacity hover:opacity-80';

/** Google Maps search link for a meeting-point address. */
const mapUrl = (query: string) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

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
            className={`flex h-6 shrink-0 items-center justify-center rounded-full px-2.5 text-[12.5px] font-bold leading-none ${
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
    locale,
    cancelHref,
}: {
    booking: ThankYouBooking;
    dict: ThankYouDict;
    /** Drives currency grouping/decimals - see `money` below. */
    locale: Locale;
    /** Management view only: renders a "Need to cancel?" link by the free-cancel row. */
    cancelHref?: string;
}) {
    const { payment } = booking;
    // The canonical formatter (guide §21.1), same as checkout. Concatenating
    // `currencySymbol + n` skipped thousands grouping and fixed decimals, so a
    // 1750 total rendered as "$1750" on the page a customer sees right after
    // paying - while every other surface showed "$1,750.00".
    const money = (n: number) => formatMoney(n, payment.currency, locale);
    // Identity rows (pickup, operator contact, guest lead) come back empty/null
    // on the unverified payload; each is rendered only when it has a value, so
    // the shared-link view shows non-identifying tour facts only.

    return (
        <section className='bg-it-bg py-[52px]'>
            <div className='it-container flex flex-col gap-6'>
                <Reveal>
                    <h2 className='m-0 font-it-display text-[clamp(21px,2.5vw,28px)] font-bold leading-[1.2] tracking-[-0.015em] text-it-ink'>
                        {dict.summaryTitle}
                    </h2>
                </Reveal>
                <div className='grid gap-6 lg:grid-cols-2'>
                    <Reveal>
                        <div className='flex h-full flex-col gap-3 rounded-it-lg border border-it-divider bg-it-white px-[26px] py-[22px] shadow-it-sm'>
                            <h3 className='m-0 text-[11.5px] font-bold uppercase tracking-[0.12em] text-it-text-muted'>
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
                                {booking.pickupLabel && (
                                    <DetailRow
                                        icon='/icons/thank-you/detail-location.svg'
                                        label={dict.pickup}>
                                        {booking.pickupMapQuery ? (
                                            <a
                                                href={mapUrl(booking.pickupMapQuery)}
                                                target='_blank'
                                                rel='noopener noreferrer'
                                                className={rowLink}>
                                                {booking.pickupLabel}
                                            </a>
                                        ) : (
                                            booking.pickupLabel
                                        )}
                                    </DetailRow>
                                )}
                                <DetailRow
                                    icon='/icons/thank-you/detail-cancel.svg'
                                    label={dict.freeCancel}>
                                    <span className='flex flex-col items-end gap-0.5'>
                                        {dict.beforeDate.replace(
                                            '{date}',
                                            booking.freeCancelBeforeLabel,
                                        )}
                                        {cancelHref && (
                                            <a
                                                href={cancelHref}
                                                className='text-[13px] leading-[1.4] tracking-[-0.012em] text-it-primary underline underline-offset-2 transition-opacity hover:opacity-80'>
                                                {dict.needToCancel}
                                            </a>
                                        )}
                                    </span>
                                </DetailRow>
                                <DetailRow
                                    icon='/icons/thank-you/detail-trip.svg'
                                    label={dict.trip}>
                                    {booking.operatorName}
                                </DetailRow>
                                {booking.operatorEmail && (
                                    <DetailRow
                                        icon='/icons/thank-you/detail-sms.svg'
                                        label={dict.email}>
                                        <a
                                            href={`mailto:${booking.operatorEmail}`}
                                            className={rowLink}>
                                            {booking.operatorEmail}
                                        </a>
                                    </DetailRow>
                                )}
                                {booking.operatorPhone && (
                                    <DetailRow
                                        icon='/icons/thank-you/detail-call.svg'
                                        label={dict.phoneNumber}>
                                        <a
                                            href={`tel:${booking.operatorPhone.replace(/\s/g, '')}`}
                                            className={rowLink}>
                                            {booking.operatorPhone}
                                        </a>
                                    </DetailRow>
                                )}
                                <DetailRow
                                    icon='/icons/thank-you/detail-travelers.svg'
                                    label={dict.traveler}>
                                    {booking.partyLabel}
                                </DetailRow>
                                {booking.extras.length > 0 && (
                                    // Same plus-tier icon as the trip row: there is
                                    // no dedicated Figma "extras" glyph yet - swap
                                    // it in when one exists.
                                    <DetailRow
                                        icon='/icons/thank-you/detail-trip.svg'
                                        label={dict.extras}>
                                        <span className='flex flex-col items-end gap-0.5'>
                                            {booking.extras.map(line => (
                                                <span key={line}>{line}</span>
                                            ))}
                                        </span>
                                    </DetailRow>
                                )}
                                {booking.guestLead && (
                                    <DetailRow
                                        icon='/icons/thank-you/detail-profile.svg'
                                        label={dict.guestLead}>
                                        {booking.guestLead}
                                    </DetailRow>
                                )}
                            </div>
                        </div>
                    </Reveal>
                    <Reveal delay={0.3}>
                        <div className='flex h-full flex-col gap-3 rounded-it-lg border border-it-divider bg-it-white px-[26px] py-[22px] shadow-it-sm'>
                            <h3 className='m-0 text-[11.5px] font-bold uppercase tracking-[0.12em] text-it-text-muted'>
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
                                            {/* Withheld in masked mode (unverified viewer) - hide the row, no blank line. */}
                                            {payment.cardLabel && (
                                                <span className={rowValue}>
                                                    {payment.cardLabel}
                                                </span>
                                            )}
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
                                        {/* Master B.85: an operator_link balance runs on the
                                            operator's own rails, so every surface stays NEUTRAL
                                            about it - we cannot verify how they collect. A
                                            "Card payment only" line used to sit here; it was
                                            hardcoded, in no spec, and simply a guess. The
                                            card/cash statement is only legitimate on on_arrival,
                                            where Tour.onArrivalPayment actually tells us. */}
                                        <div className='flex justify-between gap-4'>
                                            <span className={rowLabel}>{dict.payBefore}</span>
                                            <span className='text-right text-[16px] leading-[1.6] tracking-[-0.012em] text-it-primary'>
                                                {payment.payBeforeLabel}
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
