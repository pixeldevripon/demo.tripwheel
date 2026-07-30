import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';

import {
    formatDay,
    lookupLabel,
    money,
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
 * (review 9a). Lives in the (login) route group ON PURPOSE: its bare layout
 * means the browser's print dialog captures the receipt alone, no navbar or
 * footer, and "Save as PDF" ships the feature without a PDF pipeline.
 *
 * A receipt, deliberately not a tax invoice - the platform holds no VAT
 * breakdown, and the payload says exactly what was paid to Island Tours.
 * Session-gated like the account page; anything short of a valid HISTORY
 * session (or a foreign payment id) lands back on `/traveller`.
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
    const { locale: rawLocale, paymentId } = await params;
    const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

    return (
        <Suspense
            fallback={
                <div className='min-h-screen bg-it-surface' aria-busy='true' />
            }>
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
    const amount = money(receipt.amount, receipt.currency, locale);
    const method = receipt.methodBrand
        ? `${capitalize(receipt.methodBrand)}${receipt.methodLast4 ? ` ·· ${receipt.methodLast4}` : ''}`
        : receipt.methodType
          ? capitalize(receipt.methodType)
          : null;

    return (
        <main className='min-h-screen bg-it-surface px-4 py-10 print:bg-it-white print:p-0'>
            <div className='mx-auto w-full max-w-[640px]'>
                <div className='rounded-[16px] border border-it-heading/10 bg-it-white p-7 sm:p-9 print:border-none'>
                    <div className='flex flex-wrap items-baseline justify-between gap-2'>
                        <strong className='font-semibold text-[18px] tracking-[-0.012em] text-it-heading'>
                            {siteInfo.siteName || 'Island Tours'}
                        </strong>
                        <span className='text-[13px] font-semibold tracking-[0.06em] text-it-text-muted uppercase'>
                            {t.receiptTitle}
                        </span>
                    </div>

                    <div className='mt-7'>
                        <span className='block text-[13.5px] text-it-text-muted'>
                            {lookupLabel(t.paymentKind, receipt.kind)}
                            {'  ·  '}
                            {lookupLabel(t.paymentStatus, receipt.status)}
                        </span>
                        <strong
                            className={`mt-1 block font-medium text-[34px] leading-[1.2] tracking-[-0.012em] ${
                                isRefund ? 'text-it-green' : 'text-it-heading'
                            }`}>
                            {isRefund ? `+ ${amount}` : amount}
                        </strong>
                    </div>

                    <dl className='mt-7 flex flex-col gap-3 border-t border-it-heading/10 pt-6'>
                        {receipt.payerName && (
                            <Row label={t.receiptIssuedTo}>
                                {receipt.payerName}
                            </Row>
                        )}
                        <Row label={t.receiptPaymentDate}>
                            {formatDay(receipt.createdAt, locale)}
                        </Row>
                        {method && (
                            <Row label={t.receiptMethod}>{method}</Row>
                        )}
                        {receipt.tourName && (
                            <Row label={t.receiptTour}>
                                {receipt.tourName}
                                {receipt.destinationName
                                    ? ` · ${receipt.destinationName}`
                                    : ''}
                            </Row>
                        )}
                        <Row label={t.receiptTripDate}>
                            {[
                                formatDay(receipt.bookingLocalDate, locale),
                                receipt.startTime,
                            ]
                                .filter(Boolean)
                                .join(' · ')}
                        </Row>
                        {receipt.operatorName && (
                            <Row label={t.receiptOperator}>
                                {receipt.operatorName}
                            </Row>
                        )}
                        <Row label={t.receiptReference}>
                            <span className='font-mono'>
                                {receipt.bookingDisplayRef}
                            </span>
                        </Row>
                    </dl>

                    <p className='mt-6 mb-0 border-t border-it-heading/10 pt-5 text-[12.5px] leading-[1.6] text-it-text-muted'>
                        {t.statementNote}
                    </p>
                    <p className='mt-2 mb-0 text-[12.5px] leading-[1.6] text-it-text-muted'>
                        {t.receiptNotInvoice}
                    </p>
                </div>

                <div className='mt-5 flex flex-wrap items-center justify-between gap-3 print:hidden'>
                    <Link
                        href={`${localizeHref(locale, '/traveller')}?tab=payments`}
                        className='text-[14px] font-medium text-it-heading no-underline transition-colors hover:text-it-primary'>
                        {t.receiptBack}
                    </Link>
                    <TravellerReceiptPrintButton label={t.receiptPrint} />
                </div>
            </div>
        </main>
    );
}

function Row({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className='flex items-baseline justify-between gap-6'>
            <dt className='shrink-0 text-[14px] leading-[1.6] text-it-text-muted'>
                {label}
            </dt>
            <dd className='m-0 text-right text-[14px] leading-[1.6] text-it-heading'>
                {children}
            </dd>
        </div>
    );
}

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}
