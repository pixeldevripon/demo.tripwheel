import { Reveal } from '@/components/frontend/reveal';
import type { Locale } from '@/lib/constants/locales';
import { formatMoney } from '@/lib/currency/current';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { ThankYouBooking } from '@/lib/thank-you/thank-you';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { renderTemplate } from './render-template';

type ThankYouDict = Dictionary['thankYou'];

/* Design v2 .brow2: hairline-divided rows, muted icon label left, bold value
   right. The LAST row drops its divider via `last:`. */
const rowClass =
    'flex items-start justify-between gap-[18px] border-b border-it-divider py-[11px] text-[14px] leading-[1.6] last:border-b-0';
const labelClass =
    'flex flex-none items-center gap-[9px] font-semibold text-it-text-muted';
const valueClass = 'min-w-0 text-right font-medium text-it-ink';
/** Faint sub-line under a value (time range, card used). */
const subClass =
    'mt-[3px] block text-[12px] font-medium leading-[1.5] text-it-ink-muted';
/** Tappable contact value (mailto/tel/map) - deep-orange underlined. */
const rowLink =
    'break-words font-semibold text-it-primary-hover underline underline-offset-2 transition-opacity hover:opacity-80';

/** Google Maps search link for a meeting-point address. */
const mapUrl = (query: string) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

/** Icon + muted label | right-aligned bold value, on a hairline row. */
function DetailRow({
    icon,
    label,
    sub,
    children,
}: {
    icon: string;
    label: string;
    /** Faint 12px line under the value. */
    sub?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className={rowClass}>
            <span className={labelClass}>
                <Image
                    src={icon}
                    alt=''
                    width={24}
                    height={24}
                    className='size-4'
                />
                {label}
            </span>
            <span className={valueClass}>
                {children}
                {sub && <small className={subClass}>{sub}</small>}
            </span>
        </div>
    );
}

/**
 * "Your booking summary" section (design v2 .bookband): TOUR DETAILS and
 * PAYMENT cards side by side on the paper band, both built from hairline
 * `.brow2` rows. Zero-amount money rows are hidden
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
    const paidInFull = payment.depositPaid > 0 && payment.balance <= 0;

    const cardClass =
        'rounded-it-lg border border-it-divider bg-it-white px-5 py-[22px] shadow-it-sm md:px-[26px]';
    const cardHead =
        'm-0 mb-3 text-[11.5px] font-medium uppercase tracking-[0.12em] text-it-text-muted';

    return (
        <section className='bg-it-bg py-[52px]'>
            <div className='it-wrap flex flex-col'>
                <Reveal>
                    <h2 className='m-0 mb-[22px] font-it-display text-[clamp(21px,2.5vw,28px)] leading-[1.2] tracking-[-0.012em] text-it-ink'>
                        {dict.summaryTitle}
                    </h2>
                </Reveal>
                <div className='grid items-start gap-2 md:grid-cols-2 md:gap-5'>
                    <Reveal>
                        <div className={cardClass}>
                            <h3 className={cardHead}>{dict.tourDetails}</h3>
                            <div className='flex flex-col'>
                                <DetailRow
                                    icon='/icons/thank-you/detail-calendar.svg'
                                    label={dict.dateTime}
                                    sub={booking.timeRangeLabel}>
                                    {booking.dateLabel}
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
                                                href={mapUrl(
                                                    booking.pickupMapQuery
                                                )}
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
                                    label={dict.freeCancel}
                                    sub={
                                        cancelHref ? (
                                            <a
                                                href={cancelHref}
                                                className='font-semibold text-it-primary-hover underline underline-offset-2 transition-opacity hover:opacity-80'>
                                                {dict.needToCancel}
                                            </a>
                                        ) : undefined
                                    }>
                                    {dict.beforeDate.replace(
                                        '{date}',
                                        booking.freeCancelBeforeLabel
                                    )}
                                </DetailRow>
                                {/* The traveller's OWN facts sit above the
                                    operator's. mck-08 runs the other way round
                                    (operator at rows 5-7, travellers at 8-9),
                                    but the 2026-08-01 test report
                                    (Traveler.2) called out a summary that
                                    opened with somebody else's name, email and
                                    phone. Card STRUCTURE follows the mockup;
                                    only the order inside it does not. */}
                                <DetailRow
                                    icon='/icons/thank-you/detail-travelers.svg'
                                    label={dict.traveler}>
                                    {booking.partyLabel}
                                </DetailRow>
                                {booking.guestLead && (
                                    <DetailRow
                                        icon='/icons/thank-you/detail-profile.svg'
                                        label={dict.guestLead}>
                                        {booking.guestLead}
                                    </DetailRow>
                                )}
                                {booking.extras.length > 0 && (
                                    // Same plus-tier icon as the operator row:
                                    // there is no dedicated Figma "extras" glyph
                                    // yet - swap it in when one exists.
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
                                {/* Operator contact - mockup rows 5-7, back
                                    inside this card. Email and phone are
                                    identity, so they arrive null on the masked
                                    shared-link payload and simply do not render
                                    there; the operator name always does. */}
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
                            </div>
                        </div>
                    </Reveal>
                    <Reveal delay={0.3}>
                        <div className={cardClass}>
                            <h3 className={cardHead}>
                                {dict.paymentTitle}
                            </h3>
                            <div className='flex flex-col'>
                                {paidInFull ? (
                                    <DetailRow
                                        icon='/icons/check-green.svg'
                                        label={dict.paidInFull}>
                                        <span className='tabular-nums'>
                                            {money(payment.depositPaid)}
                                        </span>
                                    </DetailRow>
                                ) : (
                                    payment.depositPaid > 0 && (
                                        <DetailRow
                                            icon='/icons/check-green.svg'
                                            label={dict.depositPaid}
                                            sub={
                                                payment.cardLabel
                                                    ? dict.paidVia
                                                          .replace(
                                                              '{pct}',
                                                              String(
                                                                  payment.depositPct
                                                              )
                                                          )
                                                          .replace(
                                                              '{card}',
                                                              payment.cardLabel
                                                          )
                                                    : `${payment.depositPct}%`
                                            }>
                                            <span className='tabular-nums'>
                                                {money(payment.depositPaid)}
                                            </span>
                                        </DetailRow>
                                    )
                                )}
                                {payment.balance > 0 && (
                                    <>
                                        <DetailRow
                                            icon='/icons/thank-you/pay-balance-soft.svg'
                                            label={dict.remainingBalance}>
                                            <span className='tabular-nums'>
                                                {money(payment.balance)}
                                            </span>
                                        </DetailRow>
                                        <DetailRow
                                            icon='/icons/thank-you/detail-clock.svg'
                                            label={dict.payBefore}>
                                            {payment.payBeforeLabel}
                                        </DetailRow>
                                    </>
                                )}
                                {/* Total: heavier top rule, larger value (.brow2.tot). */}
                                <div className='mt-1 flex items-start justify-between gap-[18px] border-t border-it-border py-[11px] pt-[13px] text-[14px] leading-[1.6]'>
                                    <span className='font-medium text-it-ink'>
                                        {dict.total}
                                    </span>
                                    <span className='text-right text-[16px] font-medium text-it-ink tabular-nums'>
                                        {money(payment.total)}
                                    </span>
                                </div>
                                <div className='flex items-start justify-between gap-[18px] py-[11px] text-[14px] leading-[1.6]'>
                                    <span className={labelClass}>
                                        {dict.ref}
                                    </span>
                                    <code className='text-right font-mono text-[13.5px] font-medium tracking-[0.02em] text-it-ink'>
                                        {booking.displayRef}
                                    </code>
                                </div>
                                {/* Master B.85: an operator_link balance runs on the
                                    operator's own rails, so every surface stays NEUTRAL
                                    about how they collect - no "card only" claims. */}
                                {payment.balance > 0 ? (
                                    <p className='m-0 mt-3.5 text-[12.5px] leading-[1.5] text-it-text-muted'>
                                        {renderTemplate(
                                            dict.operatorLinkNote,
                                            {
                                                operator: (
                                                    <b className='font-medium text-it-ink'>
                                                        {
                                                            booking.operatorShortName
                                                        }
                                                    </b>
                                                ),
                                            }
                                        )}
                                    </p>
                                ) : (
                                    paidInFull && (
                                        <p className='m-0 mt-3.5 text-[12.5px] leading-[1.5] text-it-text-muted'>
                                            {dict.paidFullNote}
                                        </p>
                                    )
                                )}
                            </div>
                        </div>
                    </Reveal>
                </div>
            </div>
        </section>
    );
}

