import { CheckoutProcessing } from '@/components/frontend/checkout/checkout-processing';
import { checkoutShellParams } from '@/lib/checkout/prerender-params';
import { ThankYouSummarySkeleton } from '@/components/frontend/skeletons/thank-you-page-skeleton';
import { isLocale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

type PageParams = { locale: string; destination: string; slug: string };
type PageSearch = Record<string, string | string[] | undefined>;

/** The processing hop is transactional - never indexed. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Prerender one shell per active destination (its first LIVE tour), mirroring the
 * checkout route. Cache Components requires at least one generateStaticParams
 * entry, else every layout await becomes a request-time Blocking Route error.
 */
export const generateStaticParams = checkoutShellParams;

/** Read `ref` (the booking public ref) - request-time, so awaited in Suspense. */
async function ProcessingBody({
    locale,
    destination,
    slug,
    searchParams,
    dict,
}: {
    locale: string;
    destination: string;
    slug: string;
    searchParams: Promise<PageSearch>;
    dict: Awaited<ReturnType<typeof getDictionary>>['checkout'];
}) {
    const sp = await searchParams;
    const raw = sp.ref;
    const publicRef = (Array.isArray(raw) ? raw[0] : raw) ?? null;
    // No booking ref - nothing to poll; send them back to browse.
    if (!publicRef) redirect(`/${locale}/${destination}/tours`);
    const rawTour = sp.tour;
    const tourId = (Array.isArray(rawTour) ? rawTour[0] : rawTour) ?? null;

    // TYP is the one locale-less route (served via the proxy rewrite).
    const typHref = `/${destination}/thank-you/${encodeURIComponent(publicRef)}`;
    // FAILED-payment landing (bare fallback; the saved per-tour URL wins).
    const checkoutHref = `/${locale}/${destination}/${slug}/checkout`;

    return (
        <CheckoutProcessing
            publicRef={publicRef}
            tourId={tourId}
            typHref={typHref}
            checkoutHref={checkoutHref}
            dict={{
                title: dict.processingTitle,
                subtitle: dict.processingSubtitle,
                stillWorking: dict.processingStillWorking,
                viewBooking: dict.processingViewBooking,
            }}
        />
    );
}

/**
 * Payment processing hop - `/{locale}/{destination}/{slug}/checkout/processing`.
 * After the Stripe charge, the booking confirms asynchronously via the payment
 * webhook; this page polls until it reads CONFIRMED, then replaces to the TYP.
 *
 * Rendering follows the review policy: the page awaits only the cached dictionary
 * at top level; `searchParams` (the booking ref) streams inside `<Suspense>`.
 */
export default async function ProcessingPage({
    params,
    searchParams,
}: {
    params: Promise<PageParams>;
    searchParams: Promise<PageSearch>;
}) {
    const { locale, destination, slug } = await params;
    if (!isLocale(locale)) notFound();
    const dict = await getDictionary(locale);

    return (
        <>
            <section className='it-section bg-it-white'>
                <Suspense
                    fallback={
                        // Same height as the resolved poller block, so the ref
                        // streaming in doesn't nudge the summary band below.
                        <div className='flex min-h-[136px] items-center justify-center'>
                            <span className='size-12 shrink-0 animate-spin rounded-full border-4 border-it-border border-t-it-primary' />
                        </div>
                    }>
                    <ProcessingBody
                        locale={locale}
                        destination={destination}
                        slug={slug}
                        searchParams={searchParams}
                        dict={dict.checkout}
                    />
                </Suspense>
            </section>
            {/* The summary the TYP is about to render, held as a shimmer while
                we poll - so the wait shows the shape of what's coming instead of
                empty white. It is the TYP skeleton's own band, byte for byte, and
                the TYP shows that band again as its Suspense fallback: across the
                redirect the strip simply stays put while the block above it swaps
                from spinner to hero, then fills with the real booking. */}
            <ThankYouSummarySkeleton />
        </>
    );
}
