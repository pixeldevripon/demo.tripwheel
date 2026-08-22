import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { TravellerReceiptSkeleton } from '@/components/frontend/skeletons/traveller-receipt-skeleton';
import {
    formatDay,
    lookupLabel,
    money,
    paymentMethodLabel,
} from '@/components/frontend/traveller/traveller-format';
import { TravellerReceiptPrintButton } from '@/components/frontend/traveller/traveller-receipt-actions';
import { getPublicSiteInfo } from '@/lib/api/public/settings';
import { getTravellerReceipt } from '@/lib/api/public/traveller';
import {
    ALL_LOCALES,
    DEFAULT_LOCALE,
    isLocale,
    localizeHref,
    type Locale,
} from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getTravelerSessionToken } from '@/lib/traveler-session.server';

/**
 * Printable payment receipt - `/{locale}/traveller/receipt/{paymentId}`
 * (review 9a). Lives in the SHARED site layout (founder 2026-07-30) so the
 * navbar and footer frame it on screen; a page-scoped print rule hides that
 * chrome, and "Save as PDF" in the browser's print dialog ships the feature
 * without a PDF pipeline.
 *
 * Styled as an invoice-shaped document - logo, receipt number, meta grid,
 * priced line items (party, add-ons, pickup), booking totals, this payment -
 * but deliberately CALLED a receipt: the platform holds no VAT breakdown,
 * so claiming "invoice" would overclaim.
 */

export const metadata: Metadata = {
    title: 'Receipt | Island Tours',
    robots: { index: false, follow: false },
};

/** Prerender a shell per locale (Cache Components needs >= 1 entry). */
export function generateStaticParams() {
    return ALL_LOCALES.map(locale => ({ locale, paymentId: 'receipt' }));
}

export default async function TravellerReceiptPage({
    params,
}: {
    params: Promise<{ locale: string; paymentId: string }>;
}) {
    const { locale: rawLocale, paymentId: rawPaymentId } = await params;
    const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
    // Next hands dynamic params still PERCENT-ENCODED (verified empirically:
    // /receipt/abc%3ADEPOSIT arrives as "abc%3ADEPOSIT"). Without this decode,
    // ids containing reserved characters - e.g. legacy production payments
    // with "<id>:DEPOSIT" composite ids - get double-encoded on the backend
    // call and 404 even though the row exists. Plain cuids pass unchanged.
    const paymentId = decodeURIComponent(rawPaymentId);

    return (
        // Same receipt-shaped skeleton as the route's loading.tsx, so the
        // placeholder never changes shape between the navigation phase and
        // the data-streaming phase.
        <Suspense fallback={<TravellerReceiptSkeleton />}>
            <ReceiptBody locale={locale} paymentId={paymentId} />
        </Suspense>
    );
}

async function ReceiptBody({
    locale,
    paymentId,
}: {
    locale: Locale;
    paymentId: string;
}) {
    // Per-traveller data: opt out of the prerendered shell before reading the
    // session cookie; nothing below is ever cached.
    await connection();
    const [dict, siteInfo, sessionToken] = await Promise.all([
        getDictionary(locale),
        getPublicSiteInfo(),
        getTravelerSessionToken(),
    ]);
    const t = dict.traveller;

    // No/expired session -> the account page renders its login card. Only an
    // unknown or foreign payment id is a genuine 404 (e.g. a Receipt link
    // from before a demo re-seed, whose payment rows no longer exist).
    if (!sessionToken) redirect(localizeHref(locale, '/traveller'));
    const result = await getTravellerReceipt(sessionToken, paymentId);
    if (result.kind === 'unauthorized') {
        redirect(localizeHref(locale, '/traveller'));
    }
    if (result.kind === 'not-found') notFound();
    const receipt = result.receipt;

    const isRefund = receipt.kind === 'REFUND';
    const fmt = (amount: string | number) =>
        money(amount, receipt.currency, locale);
    const method = paymentMethodLabel(
        receipt.methodBrand,
        receipt.methodLast4,
        receipt.methodType
    );

    return (
        <section className='bg-it-surface py-10 md:py-14 print:bg-it-white print:py-0'>
            {/* Page-scoped print rule: the shared navbar/footer stay on
                screen but never on paper - the printout is the document. */}
            <style>{`@media print { header, footer, [data-print-hide] { display: none !important } }`}</style>
            <div className='mx-auto w-full max-w-195 px-4 print:max-w-none print:px-0'>
                <div className='rounded-[16px] border border-it-heading/10 bg-it-white p-7 sm:p-10 print:rounded-none print:border-none print:p-0'>
                    {/* ── Document head: logo | RECEIPT + number + date ── */}
                    <div className='flex flex-wrap items-start justify-between gap-6'>
                        <Image
                            src={siteInfo.logo || '/logo/logo.png'}
                            alt={siteInfo.siteName || 'Island Tours'}
                            width={68}
                            height={50}
                            className='h-10 w-auto object-contain'
                        />
                        <div className='text-right'>
                            <p className='m-0 text-[18px] font-medium tracking-[0.14em] text-it-heading uppercase'>
                                {t.receiptTitle}
                            </p>
                            <p className='mt-1.5 mb-0 font-mono text-[12px] text-it-text-muted tracking-[-0.012em]'>
                                {t.receiptNumber}{' '}
                                {receipt.id.slice(0, 8).toUpperCase()}
                            </p>
                            <p className='mt-0.5 mb-0 font-mono text-[12px] text-it-text-muted tracking-[-0.012em]'>
                                {formatDay(receipt.createdAt, locale)}
                            </p>
                        </div>
                    </div>

                    {/* ── Meta grid: issued to | the booking ── */}
                    <div className='mt-9 grid gap-8 border-t border-it-heading/10 pt-7 sm:grid-cols-2'>
                        <div>
                            <MicroLabel>{t.receiptIssuedTo}</MicroLabel>
                            {receipt.payerName && (
                                <p className='mt-1.5 mb-0 text-[13px] font-medium'>
                                    {receipt.payerName}
                                </p>
                            )}
                            {method && (
                                <p className='mt-0.5 mb-0 font-mono text-[12px] text-it-text-muted tracking-[-0.012em]'>
                                    {method}
                                </p>
                            )}
                        </div>
                        <div className='sm:text-right'>
                            <MicroLabel>{t.receiptTour}</MicroLabel>
                            <p className='mt-1.5 mb-0 text-[13px] font-medium'>
                                {receipt.tourName}
                                {receipt.destinationName
                                    ? ` · ${receipt.destinationName}`
                                    : ''}
                            </p>
                            <p className='mt-0.5 mb-0 text-[12px] leading-[1.7] text-it-text-muted tracking-[-0.012em]'>
                                {t.receiptTripDate}{' '}
                                {[
                                    formatDay(receipt.bookingLocalDate, locale),
                                    receipt.startTime,
                                ]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </p>
                            {receipt.operatorName && (
                                <p className='m-0 text-[12px] leading-[1.7] text-it-text-muted tracking-[-0.012em]'>
                                    {t.receiptOperator} {receipt.operatorName}
                                </p>
                            )}
                            <p className='m-0 font-mono text-[12px] leading-[1.7] text-it-text-muted tracking-[-0.012em]'>
                                {receipt.bookingDisplayRef}
                            </p>
                        </div>
                    </div>

                    {/* ── Line items ── */}
                    <table className='mt-9 w-full border-collapse'>
                        <thead>
                            <tr className='border-b-[1.5px] border-it-heading/60'>
                                <Th align='left'>{t.receiptDescription}</Th>
                                <Th align='right'>{t.receiptQty}</Th>
                                <Th align='right'>{t.receiptUnitPrice}</Th>
                                <Th align='right'>{t.receiptLineAmount}</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Index keys on purpose: labels are NOT unique
                                (two bands can share "Adult (18+)"), and the
                                list is a static server render - never
                                reordered client-side. */}
                            {receipt.party.map((line, i) => (
                                <ItemRow
                                    key={`party-${i}`}
                                    // Spectator bands share the participant
                                    // band's label ("Adult (18+)" twice), so
                                    // the flag is the only thing telling the
                                    // two lines apart.
                                    name={
                                        line.spectator
                                            ? `${line.label} · ${t.receiptSpectator}`
                                            : line.label
                                    }
                                    qty={line.quantity}
                                    unit={fmt(line.unitPrice)}
                                    amount={fmt(line.lineTotal)}
                                />
                            ))}
                            {receipt.addOns.map((addOn, i) => (
                                <ItemRow
                                    key={`addon-${i}`}
                                    name={addOn.name}
                                    qty={addOn.quantity}
                                    unit={fmt(addOn.unitPrice)}
                                    amount={fmt(addOn.totalPrice)}
                                />
                            ))}
                            {receipt.pickup && (
                                <ItemRow
                                    name={`${t.receiptPickup}${receipt.pickup.address ? ` · ${receipt.pickup.address}` : ''}`}
                                    qty={1}
                                    unit={fmt(receipt.pickup.totalPrice)}
                                    amount={fmt(receipt.pickup.totalPrice)}
                                />
                            )}
                        </tbody>
                    </table>

                    {/* ── Totals ── */}
                    <div className='mt-5 ml-auto w-full max-w-[320px]'>
                        <TotalRow
                            label={t.receiptTripTotal}
                            value={fmt(receipt.totalRetail)}
                        />
                        {/* Deposit/balance rows only exist on deposit models -
                            on paid_in_full the deposit IS the total, and
                            restating it reads as a second charge. */}
                        {receipt.paymentModel !== 'PAID_IN_FULL' &&
                            Number(receipt.depositAmount) > 0 && (
                                <TotalRow
                                    label={t.receiptDepositPaid}
                                    value={fmt(receipt.depositAmount)}
                                />
                            )}
                        {receipt.paymentModel !== 'PAID_IN_FULL' &&
                            Number(receipt.balanceAmount) > 0 && (
                                <TotalRow
                                    label={t.receiptRemaining}
                                    value={fmt(receipt.balanceAmount)}
                                />
                            )}
                        <div className='mt-2.5 flex items-baseline justify-between gap-6 border-t-[1.5px] border-it-heading/60 pt-2.5'>
                            <span className='text-[12px] font-medium tracking-[0.08em] text-it-heading uppercase'>
                                {isRefund
                                    ? t.receiptThisRefund
                                    : t.receiptThisPayment}
                            </span>
                            <span
                                className={`font-mono text-[20px] font-medium tracking-[-0.01em] ${
                                    isRefund
                                        ? 'text-it-green tracking-[-0.012em]'
                                        : ''
                                }`}>
                                {isRefund
                                    ? `+ ${fmt(receipt.amount)}`
                                    : fmt(receipt.amount)}
                            </span>
                        </div>
                        <p className='mt-1 mb-0 text-right text-[12px] text-it-text-muted tracking-[-0.012em]'>
                            {lookupLabel(t.paymentKind, receipt.kind)}
                            {'  ·  '}
                            {lookupLabel(t.paymentStatus, receipt.status)}
                        </p>
                    </div>

                    {/* ── Notes ── */}
                    <div className='mt-9 border-t border-it-heading/10 pt-5'>
                        <p className='m-0 text-[12px] leading-[1.7] text-it-text-muted tracking-[-0.012em]'>
                            {t.statementNote}
                        </p>
                        <p className='mt-1.5 mb-0 text-[12px] leading-[1.7] text-it-text-muted tracking-[-0.012em]'>
                            {t.receiptNotInvoice}
                        </p>
                    </div>
                </div>

                <div
                    data-print-hide
                    className='mt-5 flex flex-wrap items-center justify-between gap-3 print:hidden'>
                    <Link
                        href={`${localizeHref(locale, '/traveller')}?tab=payments`}
                        className='text-[13px] font-medium text-it-heading no-underline transition-colors hover:text-it-primary tracking-[-0.012em]'>
                        {t.receiptBack}
                    </Link>
                    <TravellerReceiptPrintButton label={t.receiptPrint} />
                </div>
            </div>
        </section>
    );
}

function MicroLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className='m-0 text-[12px] font-medium tracking-[0.12em] text-it-text-muted uppercase'>
            {children}
        </p>
    );
}

function Th({
    align,
    children,
}: {
    align: 'left' | 'right';
    children: React.ReactNode;
}) {
    return (
        <th
            className={`pb-2 text-[12px] font-medium tracking-[0.12em] text-it-text-muted uppercase ${
                align === 'right' ? 'text-right' : 'text-left'
            }`}>
            {children}
        </th>
    );
}

function ItemRow({
    name,
    qty,
    unit,
    amount,
}: {
    name: string;
    qty: number;
    unit: string;
    amount: string;
}) {
    return (
        <tr className='border-b border-it-heading/10'>
            <td className='py-3 pr-4 text-[13px] leading-[1.5]'>
                {name}
            </td>
            <td className='py-3 pl-4 text-right font-mono text-[12px]'>
                {qty}
            </td>
            <td className='py-3 pl-4 text-right font-mono text-[12px]'>
                {unit}
            </td>
            <td className='py-3 pl-4 text-right font-mono text-[12px] font-medium'>
                {amount}
            </td>
        </tr>
    );
}

function TotalRow({ label, value }: { label: string; value: string }) {
    return (
        <div className='flex items-baseline justify-between gap-6 py-1'>
            <span className='text-[12px] text-it-text-muted tracking-[-0.012em]'>{label}</span>
            <span className='font-mono text-[12px]'>
                {value}
            </span>
        </div>
    );
}


