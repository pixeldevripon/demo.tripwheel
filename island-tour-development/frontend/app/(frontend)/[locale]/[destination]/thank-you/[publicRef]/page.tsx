import { ThankYouApartmentPromo } from '@/components/frontend/thank-you/thank-you-apartment';
import { ThankYouHero } from '@/components/frontend/thank-you/thank-you-hero';
import { ThankYouNextSteps } from '@/components/frontend/thank-you/thank-you-next-steps';
import { ThankYouQuestion } from '@/components/frontend/thank-you/thank-you-question';
import { ThankYouRelatedTours } from '@/components/frontend/thank-you/thank-you-related-tours';
import { ThankYouSummary } from '@/components/frontend/thank-you/thank-you-summary';
import { ThankYouPageSkeleton } from '@/components/skelitons/thank-you-page-skeleton';
import { getActiveDestinations } from '@/lib/api/public';
import { DEFAULT_LOCALE, isLocale, localizeHref } from '@/lib/constants/locales';
import { getDictionary, type Dictionary } from '@/lib/i18n/dictionaries';
import { DEMO_PUBLIC_REF, getThankYouBooking } from '@/lib/thank-you/thank-you';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';

type PageParams = { locale: string; destination: string; publicRef: string };

// Fallback slugs for static generation if the backend is unreachable at build
// (Cache Components requires generateStaticParams to return at least one entry,
// otherwise the route has no prerendered shell and every layout await becomes a
// request-time Blocking Route error).
const LAUNCH_DESTINATION_SLUGS = [
    'curacao',
    'aruba',
    'sint-maarten',
    'saint-lucia',
    'bahamas',
];

/**
 * Prerender one shell per active destination. `publicRef` values are
 * unguessable runtime tokens, so the demo ref stands in - real refs render on
 * demand (default `dynamicParams`) and the streamed body never prerenders
 * anyway (`connection()` gates it).
 */
export async function generateStaticParams() {
    try {
        const destinations = await getActiveDestinations();
        if (destinations && destinations.length > 0) {
            return destinations.map(d => ({
                destination: d.slug,
                publicRef: DEMO_PUBLIC_REF,
            }));
        }
    } catch {
        // backend unavailable at build - fall through to launch slugs
    }
    return LAUNCH_DESTINATION_SLUGS.map(destination => ({
        destination,
        publicRef: DEMO_PUBLIC_REF,
    }));
}

/**
 * The TYP is keyed by an unguessable token and personal - never indexed
 * (master API conventions; BOOKING-FLOW-DESIGN-GUIDE.md §12).
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Streamed TYP body. The booking lookup is per-traveller request-time data
 * (uncached by design), so it happens only here - inside the page's
 * `<Suspense>` boundary, after `connection()` - keeping the route free of the
 * blocking-route error.
 */
async function ThankYouBody({
    destination,
    publicRef,
    toursHref,
    dict,
}: {
    destination: string;
    publicRef: string;
    toursHref: string;
    dict: Dictionary;
}) {
    await connection();
    const booking = await getThankYouBooking(publicRef);
    if (!booking || booking.destinationSlug !== destination) notFound();

    // Critical rule 22 (for the pending tracking module): conversion value is
    // `commission_amount` in EUR, never GMV, and only when status is CONFIRMED
    // with a non-null `commissionAmountEur` - a confirmed booking with null
    // commission is data corruption and must fire NO conversion.

    const { title, seeAll, seeAllCount, ...cardDict } = dict.destination.listings;

    return (
        <>
            <ThankYouHero booking={booking} dict={dict.thankYou} />
            <ThankYouSummary booking={booking} dict={dict.thankYou} />
            <ThankYouNextSteps booking={booking} dict={dict.thankYou} />
            <ThankYouRelatedTours
                tours={booking.relatedTours}
                dict={dict.thankYou}
                cardDict={cardDict}
                toursHref={toursHref}
            />
            <ThankYouApartmentPromo
                apartment={booking.apartment}
                dict={dict.thankYou}
            />
            <ThankYouQuestion booking={booking} dict={dict.thankYou} />
        </>
    );
}

/**
 * Thank-you page - public URL `/{destination}/thank-you/{public_ref}` with NO
 * locale prefix (the only such route; a `beforeFiles` rewrite in
 * `next.config.ts` maps it onto this `[locale]` tree as English). Figma
 * 47744-9184: hero, booking summary, next steps, cross-sell, apartment promo,
 * support card.
 *
 * Rendering follows RENDERING-REVALIDATION-REVIEW.md: the page awaits only the
 * cached `getDictionary` at top level; the uncached booking lookup streams
 * inside `<Suspense>` behind the 1:1 `ThankYouPageSkeleton` (also the route
 * `loading.tsx`).
 */
export default async function ThankYouPage({
    params,
}: {
    params: Promise<PageParams>;
}) {
    const { locale: rawLocale, destination, publicRef } = await params;
    const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
    const dict = await getDictionary(locale);
    const toursHref = localizeHref(locale, `/${destination}/tours`);

    return (
        <Suspense fallback={<ThankYouPageSkeleton />}>
            <ThankYouBody
                destination={destination}
                publicRef={publicRef}
                toursHref={toursHref}
                dict={dict}
            />
        </Suspense>
    );
}
