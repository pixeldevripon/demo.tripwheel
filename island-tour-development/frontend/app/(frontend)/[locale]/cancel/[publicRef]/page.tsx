import { CancelRequestCard } from '@/components/frontend/cancel/cancel-request-card';
import { MountReveal } from '@/components/frontend/mount-reveal';
import { isLocale, type Locale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { DEMO_PUBLIC_REF, getThankYouBooking } from '@/lib/thank-you/thank-you';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';

type PageParams = { locale: string; publicRef: string };

/**
 * Cancellation-request page (master 6.4/C1 + the email wireframe's "Cancel
 * confirmation modal"). Linked from the confirmation email as the locale-less
 * /cancel/{publicRef} (proxy rewrite, like the TYP); it only ever sends a
 * request to the admin - it never cancels on click.
 */

// Cache Components requires at least one prerendered entry per dynamic route;
// real refs are unguessable runtime tokens, so the demo ref stands in.
export function generateStaticParams() {
    return [{ publicRef: DEMO_PUBLIC_REF }];
}

/** Tokenized and personal - never indexed (same rule as the TYP). */
export const metadata: Metadata = { robots: { index: false, follow: false } };

async function CancelBody({
    publicRef,
    locale,
}: {
    publicRef: string;
    locale: Locale;
}) {
    await connection();
    const [dict, booking] = await Promise.all([
        getDictionary(locale),
        getThankYouBooking(publicRef, locale),
    ]);
    if (!booking) notFound();

    const thankYouHref = `/${booking.destinationSlug}/thank-you/${booking.publicRef}`;
    const cd = dict.cancelBooking;

    // Master 6.4 page copy: "Cancel {tour}, {date}?"
    const title = cd.title
        .replace('{tour}', booking.tourTitle)
        .replace('{date}', booking.dateLabel);

    // A cancelled/expired booking has nothing to cancel - say so instead of
    // rendering a form whose submit can only 409.
    if (booking.status !== 'CONFIRMED') {
        return (
            <div className='w-full max-w-107.5 rounded-[16px] bg-it-white p-6 shadow-[0_26px_70px_-20px_rgba(0,0,0,0.25)]'>
                <span className='font-medium text-[18px] leading-[1.4] tracking-[-0.012em] text-it-heading'>
                    {booking.tourTitle}
                </span>
                <p className='mt-2.5 mb-0 text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                    {cd.notActive}
                </p>
            </div>
        );
    }

    // Free-cancellation window check, judged NOW for display - the backend
    // stamps the authoritative request instant (master 6.4: the deadline is
    // judged on the request timestamp, not the admin action).
    const deadline = booking.freeCancelDeadlineUtc
        ? new Date(booking.freeCancelDeadlineUtc)
        : null;
    // eslint-disable-next-line react-hooks/purity -- request-time render (gated by connection() above); comparing against "now" IS the feature
    const inWindow = !deadline || Date.now() < deadline.getTime();

    // After the window the locked copy applies: no refund, no change - so no
    // request form either (master trust-modal copy, verbatim).
    if (!inWindow) {
        return (
            <div className='w-full max-w-107.5 rounded-[16px] bg-it-white p-6 shadow-[0_26px_70px_-20px_rgba(0,0,0,0.25)]'>
                <span className='font-medium text-[18px] leading-[1.4] tracking-[-0.012em] text-it-heading'>
                    {title}
                </span>
                <p className='mt-2.5 mb-0 text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                    {cd.afterWindow.replace(
                        '{hours}',
                        String(booking.cancellationHours),
                    )}
                </p>
                <Link
                    href={thankYouHref}
                    className='mt-4 inline-block w-fit rounded-[10px] border-[1.5px] border-it-heading/20 px-4.5 py-2.75 text-[14px] font-medium leading-[1.2] text-it-heading no-underline transition-colors duration-300 hover:border-it-heading/40'>
                    {cd.keep}
                </Link>
            </div>
        );
    }

    // "Refund ${deposit}" renders only when something was actually paid to
    // Island Tours (C23) - what we charged is what we refund.
    const paid = booking.payment.depositPaid;
    const refundLabel =
        paid > 0
            ? cd.refund.replace(
                  '{amount}',
                  `${booking.payment.currencySymbol}${paid}`,
              )
            : null;

    return (
        <MountReveal>
            <CancelRequestCard
                dict={cd}
                publicRef={booking.publicRef}
                title={title}
                displayRef={booking.displayRef}
                refundLabel={refundLabel}
                thankYouHref={thankYouHref}
            />
        </MountReveal>
    );
}

function CancelCardSkeleton() {
    return (
        <div className='w-full max-w-107.5 animate-pulse rounded-[16px] bg-it-white p-6'>
            <div className='h-6 w-3/4 rounded-[6px] bg-it-border' />
            <div className='mt-3 h-4 w-1/2 rounded-[6px] bg-it-border' />
            <div className='mt-4 h-20 w-full rounded-[10px] bg-it-border' />
            <div className='mt-4 flex gap-2.5'>
                <div className='h-11 w-40 rounded-[10px] bg-it-border' />
                <div className='h-11 w-36 rounded-[10px] bg-it-border' />
            </div>
        </div>
    );
}

export default async function CancelPage({
    params,
}: {
    params: Promise<PageParams>;
}) {
    const { locale: rawLocale, publicRef } = await params;
    if (!isLocale(rawLocale)) notFound();
    const locale: Locale = rawLocale;

    return (
        <section className='it-section flex min-h-[70vh] items-center justify-center bg-it-surface'>
            <div className='it-container flex justify-center'>
                <Suspense fallback={<CancelCardSkeleton />}>
                    <CancelBody publicRef={publicRef} locale={locale} />
                </Suspense>
            </div>
        </section>
    );
}
