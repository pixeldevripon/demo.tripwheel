import { Info } from 'lucide-react';
import Link from 'next/link';

import { localizeHref, type Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type {
    TravellerLedgerTotals,
    TravellerPayment,
} from '@/lib/api/public/traveller';

import { paymentTone, TravellerChip } from './traveller-chip';
import { formatDay, lookupLabel, money } from './traveller-format';

/**
 * The payments ledger (review 5.7): every charge and refund on the traveller's
 * bookings, IT-side money only - balances paid to an operator directly never
 * show here (6.2). Topped by the Site Bar B.V. statement-recognition line (the
 * single biggest "what is this charge?" chargeback preventer, conflict 94) and
 * the per-currency subtotal chips - amounts listed side by side, NEVER summed
 * across currencies.
 *
 * Rows: bold type + tour, date line ("Requested/Refunded {date}" on refunds,
 * "trip {date}" on charges), reference; right column amount ("+" green for
 * refunds), state chip (progress, not promises - "On its way" until the PSP
 * webhook says the money moved), brand + last4 (F14).
 */
export function TravellerPaymentsList({
    payments,
    totals,
    dict,
    locale,
}: {
    payments: TravellerPayment[];
    totals: TravellerLedgerTotals | null;
    dict: Dictionary['traveller'];
    locale: Locale;
}) {
    // Receipts only for money that actually moved (review 9a): a settled
    // charge, or an executed refund.
    const hasReceipt = (p: TravellerPayment) =>
        p.status === 'SUCCEEDED' || p.status === 'REFUNDED';
    const joinAmounts = (
        buckets: { currency: string; amount: string }[],
        suffix?: string
    ) =>
        buckets
            .map(b => {
                const amount = money(b.amount, b.currency, locale);
                return suffix ? suffix.replace('{amount}', amount) : amount;
            })
            .join(' · ');

    const paidChip = totals?.paid.length
        ? dict.ledgerPaid.replace('{amounts}', joinAmounts(totals.paid))
        : null;
    const refundedParts = totals
        ? [
              joinAmounts(totals.refunded),
              joinAmounts(totals.refundPending, dict.ledgerOnItsWay),
          ].filter(Boolean)
        : [];
    const refundedChip = refundedParts.length
        ? dict.ledgerRefunded.replace('{amounts}', refundedParts.join(' · '))
        : null;

    return (
        <div className='flex flex-col gap-3'>
            <div className='flex items-start gap-2.5 rounded-[12px] border border-it-heading/10 bg-it-white px-4 py-3 text-[13px] leading-[1.6] text-it-text-muted'>
                <Info
                    aria-hidden
                    className='mt-0.5 size-4 shrink-0'
                    strokeWidth={2}
                />
                <span>{dict.statementNote}</span>
            </div>

            {(paidChip || refundedChip) && (
                <div className='flex flex-wrap gap-2'>
                    {paidChip && <TotalChip>{paidChip}</TotalChip>}
                    {refundedChip && <TotalChip>{refundedChip}</TotalChip>}
                </div>
            )}

            <ul className='m-0 flex list-none flex-col gap-3 p-0'>
                {payments.map(payment => {
                    const isRefund = payment.kind === 'REFUND';
                    const refundSettled =
                        payment.status === 'SUCCEEDED' ||
                        payment.status === 'REFUNDED';
                    const amount = money(
                        payment.amount,
                        payment.currency,
                        locale
                    );
                    const kindLabel =
                        dict.paymentKind[payment.kind] ?? payment.kind;
                    const statusLabel = isRefund
                        ? refundSettled
                            ? dict.refundedChip
                            : dict.refundOnWayChip
                        : lookupLabel(dict.paymentStatus, payment.status);
                    const dateLine = isRefund
                        ? `${(refundSettled
                              ? dict.refundRefundedOn
                              : dict.refundRequestedOn
                          ).replace(
                              '{date}',
                              formatDay(payment.createdAt, locale)
                          )}  ·  ${dict.toOriginalMethod}`
                        : `${formatDay(payment.createdAt, locale)}  ·  ${dict.travelDate.replace(
                              '{date}',
                              formatDay(payment.bookingLocalDate, locale)
                          )}`;
                    const method = payment.methodBrand
                        ? `${capitalize(payment.methodBrand)}${payment.methodLast4 ? ` ·· ${payment.methodLast4}` : ''}`
                        : payment.methodType
                          ? capitalize(payment.methodType)
                          : null;
                    const manageHref = payment.destinationSlug
                        ? `/${payment.destinationSlug}/thank-you/${payment.bookingPublicRef}`
                        : null;

                    return (
                        <li
                            key={payment.id}
                            className='rounded-[16px] border border-it-heading/10 bg-it-white p-5 sm:px-6'>
                            <div className='flex flex-wrap items-start justify-between gap-x-4 gap-y-3'>
                                <div className='min-w-0 flex-1'>
                                    <strong className='block text-[16px] leading-[1.5] tracking-[-0.012em] font-semibold text-it-heading'>
                                        {kindLabel}
                                        {payment.tourName && (
                                            <span className='font-normal text-it-text-muted'>
                                                {'  ·  '}
                                                {payment.tourName}
                                            </span>
                                        )}
                                    </strong>
                                    <span className='mt-1 block text-[14px] leading-[1.6] text-it-text-muted'>
                                        {dateLine}
                                    </span>
                                    <span className='mt-1 flex flex-wrap items-center gap-x-3 font-mono text-[13px] text-it-text-muted'>
                                        {manageHref ? (
                                            <Link
                                                href={manageHref}
                                                className='no-underline transition-colors hover:text-it-primary'>
                                                {payment.bookingDisplayRef}
                                            </Link>
                                        ) : (
                                            payment.bookingDisplayRef
                                        )}
                                        {hasReceipt(payment) && (
                                            <Link
                                                href={localizeHref(
                                                    locale,
                                                    `/traveller/receipt/${payment.id}`
                                                )}
                                                className='font-sans font-medium text-it-primary no-underline transition-opacity hover:opacity-80'>
                                                {dict.receiptLink}
                                            </Link>
                                        )}
                                    </span>
                                </div>
                                <div className='flex shrink-0 flex-col items-end gap-1.5'>
                                    <strong
                                        className={`block font-medium text-[20px] leading-[1.3] tracking-[-0.012em] ${
                                            isRefund
                                                ? 'text-it-green'
                                                : 'text-it-heading'
                                        }`}>
                                        {isRefund ? `+ ${amount}` : amount}
                                    </strong>
                                    <TravellerChip
                                        label={statusLabel}
                                        tone={
                                            isRefund && !refundSettled
                                                ? 'pending'
                                                : paymentTone(payment.status)
                                        }
                                    />
                                    {!isRefund && method && (
                                        <span className='block text-[13px] text-it-text-muted'>
                                            {method}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

function TotalChip({ children }: { children: string }) {
    return (
        <span className='inline-flex items-center rounded-full border border-it-heading/15 bg-it-white px-3.5 py-1.5 text-[13px] font-medium text-it-heading'>
            {children}
        </span>
    );
}

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}
