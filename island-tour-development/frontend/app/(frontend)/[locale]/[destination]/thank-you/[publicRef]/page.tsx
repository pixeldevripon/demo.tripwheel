import { ThankYouApartmentPromo } from '@/components/frontend/thank-you/thank-you-apartment';
import { ThankYouHero } from '@/components/frontend/thank-you/thank-you-hero';
import { ThankYouNextSteps } from '@/components/frontend/thank-you/thank-you-next-steps';
import { ThankYouQuestion } from '@/components/frontend/thank-you/thank-you-question';
import { ThankYouRelatedTours } from '@/components/frontend/thank-you/thank-you-related-tours';
import { ThankYouSummary } from '@/components/frontend/thank-you/thank-you-summary';
import { ThankYouVerifyNotice } from '@/components/frontend/thank-you/thank-you-verify-notice';
import { ConversionPush } from '@/components/frontend/thank-you/conversion-push';
import { BookingManageHeader } from '@/components/frontend/thank-you/booking-manage-header';
import { ThankYouPageSkeleton } from '@/components/frontend/skeletons/thank-you-page-skeleton';
import { getActiveDestinations } from '@/lib/api/public';
import { claimConversionPush } from '@/lib/api/public/bookings';
import {
    DEFAULT_LOCALE,
    isLocale,
    localizeHref,
    type Locale,
} from '@/lib/constants/locales';
import { getDictionary, type Dictionary } from '@/lib/i18n/dictionaries';
import {
    DEMO_PUBLIC_REF,
    getThankYouBooking,
    getThankYouRelatedTours,
} from '@/lib/thank-you/thank-you';
import {
    getTravelerSessionToken,
    isJustBooked,
} from '@/lib/traveler-session.server';
import { searchHitToListing } from '@/lib/tours/listing';
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
    locale,
    dict,
}: {
    destination: string;
    publicRef: string;
    toursHref: string;
    locale: Locale;
    dict: Dictionary;
}) {
    await connection();
    // The HttpOnly traveler session (set by checkout or the /bookings login)
    // unlocks the unmasked payload; a bare shared link renders masked with a
    // "verify it's you" card instead of the manage actions.
    const sessionToken = await getTravelerSessionToken();
    const booking = await getThankYouBooking(publicRef, locale, sessionToken);
    if (!booking || booking.destinationSlug !== destination) notFound();

    // Three presentations of the same booking:
    //  - masked:       unverified shared link - non-identifying facts + verify card
    //  - celebratory:  the ONE-TIME "you're booked!" moment right after checkout
    //  - management:   a later verified visit (via /bookings) - calm "manage" view
    const justBooked = await isJustBooked(publicRef);
    const mode: 'masked' | 'celebratory' | 'management' = !booking.verified
        ? 'masked'
        : justBooked
          ? 'celebratory'
          : 'management';
    // Cancel is the locale-less /cancel/{publicRef} (proxy rewrite), NOT under
    // the destination segment like the TYP - the confirmation email links it too.
    const cancelHref = `/cancel/${booking.publicRef}`;

    // booking_complete conversion (master 8.2, rule #22): claim the one-time push
    // server-side, mark-first. The backend hands back the payload ONLY to the first
    // verified render of a CONFIRMED booking with a non-null EUR commission, and
    // null on every later call (refresh / second tab / shared link / not-yet-
    // confirmed). Gated on `verified` so a bare link never even asks. The value is
    // the EUR commission; a confirmed booking with null commission fires nothing.
    const conversion = booking.verified
        ? await claimConversionPush(publicRef, sessionToken)
        : null;

    // Cross-sell + apartment upsell belong to the celebratory moment only; the
    // management/masked views are utilitarian, so skip the fetch there entirely.
    const relatedHits =
        mode === 'celebratory'
            ? await getThankYouRelatedTours({
                  destinationSlug: booking.destinationSlug,
                  excludeTourId: booking.tourId,
                  locale,
              })
            : [];

    const { title, seeAll, seeAllCount, ...cardDict } = dict.destination.listings;

    return (
        <>
            {/* One-time booking_complete dataLayer push (renders nothing). Payload
                is non-null only on the mark-first winning render; a no-op when
                tracking is disabled. */}
            <ConversionPush conversion={conversion} />
            {mode === 'celebratory' && (
                <ThankYouHero booking={booking} dict={dict.thankYou} />
            )}
            {mode === 'management' && (
                <BookingManageHeader
                    booking={booking}
                    cancelHref={cancelHref}
                    reviewHref={`/${locale}/review/${booking.reviewToken ?? ''}`}
                    dict={dict.thankYou}
                />
            )}
            {mode === 'masked' && (
                <ThankYouVerifyNotice locale={locale} dict={dict.thankYou} />
            )}
            <ThankYouSummary
                booking={booking}
                dict={dict.thankYou}
                locale={locale}
                // Same server verdict the header button uses. This link used
                // to check only the mode, so it stayed visible on an already-
                // requested or cancelled booking while the header button had
                // correctly hidden itself.
                cancelHref={
                    mode === 'management' && booking.canCancel
                        ? cancelHref
                        : undefined
                }
            />
            {mode !== 'masked' && (
                <ThankYouNextSteps
                    booking={booking}
                    dict={dict.thankYou}
                    flushBottom={mode === 'celebratory'}
                />
            )}
            {mode === 'celebratory' && (
                <>
                    <ThankYouRelatedTours
                        tours={relatedHits.map(hit =>
                            searchHitToListing(hit, locale, dict.search),
                        )}
                        dict={dict.thankYou}
                        cardDict={cardDict}
                        toursHref={toursHref}
                    />
                    <ThankYouApartmentPromo
                        apartment={booking.apartment}
                        dict={dict.thankYou}
                    />
                </>
            )}
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
                locale={locale}
                dict={dict}
            />
        </Suspense>
    );
}
