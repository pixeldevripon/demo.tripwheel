import { CheckoutClient } from '@/components/frontend/checkout/checkout-client';
import type { CheckoutPickupOption } from '@/components/frontend/checkout/checkout-form';
import { CheckoutSummary } from '@/components/frontend/checkout/checkout-summary';
import { CheckoutPageSkeleton } from '@/components/skelitons/checkout-page-skeleton';
import { getTourBySlug } from '@/lib/api/public/tours';
import {
    buildPartyLabel,
    computeCheckoutTotals,
    fromDateParam,
    parseCheckoutSelection,
} from '@/lib/checkout/checkout';
import { isLocale, localizeHref, type Locale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { DUMMY_BOOKING_DATA } from '@/lib/tours/booking';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

type PageParams = { locale: string; destination: string; slug: string };
type PageSearch = Record<string, string | string[] | undefined>;

/** Checkout is a transactional surface - keep it out of the index (master §5.8). */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Wall-clock "HH:MM" -> localized "8:00 AM" (fixed UTC date, clock only). */
function formatClock(hhmm: string, locale: string): string {
    const [h, m] = hhmm.split(':').map(Number);
    if (Number.isNaN(h)) return hhmm;
    const date = new Date(Date.UTC(2000, 0, 1, h, m || 0));
    return new Intl.DateTimeFormat(locale, {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
    }).format(date);
}

/**
 * Streamed checkout body. `searchParams` (the widget's date / time / party
 * selection) is request-time data, so it is awaited only here - inside the
 * page's `<Suspense>` boundary - keeping the route free of the blocking-route
 * error while the cached tour/dictionary loads stay in the shell pass.
 */
async function CheckoutBody({
    locale,
    tourHref,
    searchParams,
    dict,
    title,
    heroImage,
    pickupOptions,
}: {
    locale: Locale;
    tourHref: string;
    searchParams: Promise<PageSearch>;
    dict: Awaited<ReturnType<typeof getDictionary>>['checkout'];
    title: string;
    heroImage: string | null;
    pickupOptions: CheckoutPickupOption[];
}) {
    const sp = await searchParams;
    const data = DUMMY_BOOKING_DATA;

    const selection = parseCheckoutSelection(sp);
    const totals = computeCheckoutTotals(data, selection.counts);

    const selectedDate = fromDateParam(selection.date);
    const dateLabel = selectedDate
        ? new Intl.DateTimeFormat(locale, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
          }).format(selectedDate)
        : null;
    const timeLabel = selection.time
        ? formatClock(selection.time, locale)
        : null;
    const partyLabel = buildPartyLabel(totals.lineItems);

    return (
        <CheckoutClient
            dict={dict}
            locale={locale}
            tourHref={tourHref}
            pickupOptions={pickupOptions}
            pickupFromLabel={null}
            payToday={totals.payToday}
            currencySymbol={data.currencySymbol}
            summary={
                <CheckoutSummary
                    dict={dict}
                    locale={locale}
                    tourHref={tourHref}
                    tourTitle={title}
                    tourImage={heroImage}
                    dateLabel={dateLabel}
                    timeLabel={timeLabel}
                    partyLabel={partyLabel}
                    pickupLabel={dict.noPickup}
                    cancellationHours={data.cancellationHours}
                    totals={totals}
                    currencySymbol={data.currencySymbol}
                />
            }
        />
    );
}

/**
 * Checkout page - `/{locale}/{destination}/{tour-slug}/checkout`. Two-phase
 * flow (master §5.8): Contact then Payment, with a step indicator and a
 * persistent booking summary alongside. The widget selection (date / time /
 * party) arrives via the query string; pickup, contact, and payment are chosen
 * here.
 *
 * Rendering follows the review policy (RENDERING-REVALIDATION-REVIEW.md): the
 * page awaits only cached loaders (`getTourBySlug`, `getDictionary`) at top
 * level; `searchParams` is forwarded as an un-awaited Promise into the
 * Suspense-wrapped `CheckoutBody`, whose `CheckoutPageSkeleton` fallback
 * mirrors the layout 1:1 (and doubles as the route `loading.tsx`).
 *
 * Pricing mirrors the booking widget (currently `DUMMY_BOOKING_DATA`), so the
 * numbers carry through from the card unchanged; the live tour supplies the
 * title, image, and pickup options. A server-authoritative quote + live booking
 * submission land with the booking/payments module (BOOKING-FLOW-DESIGN-GUIDE).
 */
export default async function CheckoutPage({
    params,
    searchParams,
}: {
    params: Promise<PageParams>;
    searchParams: Promise<PageSearch>;
}) {
    const { locale, destination, slug } = await params;
    if (!isLocale(locale)) notFound();

    const [detail, dict] = await Promise.all([
        getTourBySlug({ slug, destinationSlug: destination, locale }),
        getDictionary(locale),
    ]);
    if (!detail) notFound();

    const title = detail.translation?.title ?? detail.name;
    const heroImage =
        detail.images.find(img => img.isHero)?.url ??
        detail.images[0]?.url ??
        null;
    const tourHref = localizeHref(locale, `/${destination}/${slug}`);

    const pickupOptions: CheckoutPickupOption[] = detail.pickupLocations
        .slice()
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(p => ({ id: p.id, label: p.title || p.name }));

    return (
        <section className='it-section !pt-0 bg-white'>
            <Suspense fallback={<CheckoutPageSkeleton />}>
                <CheckoutBody
                    locale={locale}
                    tourHref={tourHref}
                    searchParams={searchParams}
                    dict={dict.checkout}
                    title={title}
                    heroImage={heroImage}
                    pickupOptions={pickupOptions}
                />
            </Suspense>
        </section>
    );
}
