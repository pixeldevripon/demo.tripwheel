import { CheckoutClient } from '@/components/frontend/checkout/checkout-client';
import type { CheckoutPickupOption } from '@/components/frontend/checkout/checkout-form';
import { CheckoutSummary } from '@/components/frontend/checkout/checkout-summary';
import { CheckoutPageSkeleton } from '@/components/frontend/skeletons/checkout-page-skeleton';
import { getActiveDestinations } from '@/lib/api/public';
import { getDestinationTours, getTourBySlug } from '@/lib/api/public/tours';
import {
    buildBookingSelection,
    buildPartyLabel,
    computeCheckoutTotals,
    formatCheckoutMoney,
    fromDateParam,
    parseCheckoutSelection,
    shortBandLabel,
} from '@/lib/checkout/checkout';
import { getServerCurrency } from '@/lib/currency/server';
import {
    isCurrency,
    isLocale,
    localizeHref,
    type Locale,
} from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { buildTourBookingData } from '@/lib/tours/booking';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

type PageParams = { locale: string; destination: string; slug: string };
type PageSearch = Record<string, string | string[] | undefined>;

/** Checkout is a transactional surface - keep it out of the index (master §5.8). */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Prerender one shell per active destination (its first LIVE tour). Cache
 * Components requires at least one generateStaticParams entry - without it the
 * route has no prerendered shell and every layout await surfaces as a
 * request-time Blocking Route error. All other tours render on demand (default
 * `dynamicParams`), streaming behind the route's skeleton.
 */
export async function generateStaticParams() {
    try {
        const destinations = await getActiveDestinations();
        if (destinations && destinations.length > 0) {
            const combos = await Promise.all(
                destinations.map(async d => {
                    const { data } = await getDestinationTours({
                        destinationId: d.id,
                        limit: 1,
                    });
                    return data.map(t => ({
                        destination: d.slug,
                        slug: t.slug,
                    }));
                })
            );
            const flat = combos.flat();
            if (flat.length > 0) return flat;
        }
    } catch {
        // backend unavailable at build - fall through to the demo-seed tour
    }
    return [
        { destination: 'curacao', slug: 'klein-curacao-super-yacht-beach-house' },
    ];
}

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
 * Streamed checkout body. `searchParams` (the widget's selection, incl. the
 * quoted `currency`) is request-time data, so it is awaited only here - inside the
 * page's `<Suspense>` boundary. Because this component is already dynamic, it also
 * resolves the shopper currency and fetches the tour WITH it (so the summary is
 * priced in the shopper currency), which the cached shell pass could not do
 * without tripping the blocking-route error.
 */
async function CheckoutBody({
    locale,
    destination,
    slug,
    tourHref,
    searchParams,
    dict,
}: {
    locale: Locale;
    destination: string;
    slug: string;
    tourHref: string;
    searchParams: Promise<PageSearch>;
    dict: Awaited<ReturnType<typeof getDictionary>>['checkout'];
}) {
    const sp = await searchParams;
    const selection = parseCheckoutSelection(sp);

    // Price in the currency the widget quoted (URL), else the shopper cookie - both
    // safe here since this body is already dynamic. The reserve will submit
    // selection.quoteId / selection.departureId once the booking POST is wired.
    const currency = isCurrency(selection.currency)
        ? selection.currency
        : await getServerCurrency(locale);
    const detail = await getTourBySlug({
        slug,
        destinationSlug: destination,
        locale,
        currency,
    });
    if (!detail) notFound();

    const title = detail.translation?.title ?? detail.name;
    const heroImage =
        detail.images.find(img => img.isHero)?.url ??
        detail.images[0]?.url ??
        null;
    // Currency-aware pricing - mirrors the booking widget (same converted money).
    const data = buildTourBookingData(detail);

    // Pickup dropdown (master 5.8): zones only when the tour offers pickup at
    // all; PAID_ADDON zone prices are already converted by buildTourBookingData.
    const pickupOptions: CheckoutPickupOption[] =
        data.pickupModel === 'NONE' ? [] : data.pickupOptions;
    // "(From $X p.p.)" label suffix = the cheapest priced zone (paid model only,
    // no $0.00 decimals - formatCheckoutMoney keeps whole amounts bare).
    const pricedZones = pickupOptions
        .map(p => p.price)
        .filter((p): p is number => p != null && p > 0);
    const pickupFromLabel =
        pricedZones.length > 0
            ? dict.pickupFrom.replace(
                  '{price}',
                  formatCheckoutMoney(
                      Math.min(...pricedZones),
                      data.currencySymbol,
                      locale
                  )
              )
            : null;

    // Optional extras chosen in the widget (URL `addons=id:qty`), validated
    // against the tour's live add-on set (a stale id must not reach reserve).
    const addOns = Object.entries(selection.addOns)
        .filter(([id]) => data.addOns.some(a => a.id === id))
        .map(([addOnId, quantity]) => ({ addOnId, quantity }));

    const totals = computeCheckoutTotals(data, selection.counts, {
        addOns: selection.addOns,
    });
    // Per-line breakdown for the summary (same "label x qty x unit" shape the
    // widget shows under "Show details"); a pickup re-quote swaps in live lines.
    const fmt = (n: number) =>
        formatCheckoutMoney(n, data.currencySymbol, locale);
    const breakdownRows = [
        // UNIT charters (and free bands) have no meaningful per-seat price -
        // drop the "x $0" tail instead of printing it.
        ...totals.lineItems.map(row => ({
            id: `band-${row.band.id}`,
            label:
                row.band.price > 0
                    ? `${shortBandLabel(row.band)} x ${row.count} x ${fmt(row.band.price)}`
                    : `${shortBandLabel(row.band)} x ${row.count}`,
            amount: row.lineTotal,
        })),
        ...data.addOns.flatMap(addOn => {
            const qty = selection.addOns[addOn.id] ?? 0;
            if (qty <= 0) return [];
            const units =
                addOn.unit === 'PER_PERSON' ? qty * totals.partySize : qty;
            return [
                {
                    id: `addon-${addOn.id}`,
                    label: `${addOn.name} x ${units} x ${fmt(addOn.price)}`,
                    amount: Math.round(units * addOn.price * 100) / 100,
                },
            ];
        }),
    ];
    // Party payload for the reserve call (items/guests), or null if the URL
    // selection can't be reserved (synthetic-only bands / empty).
    const reserveSelection = buildBookingSelection(data, selection.counts);

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
            pickupFromLabel={pickupFromLabel}
            pickupRequired={data.pickupRequired}
            totals={totals}
            currencySymbol={data.currencySymbol}
            tourId={detail.id}
            departureId={selection.departureId}
            currency={currency}
            quoteId={selection.quoteId}
            reserveSelection={reserveSelection}
            addOns={addOns}
            destination={destination}
            slug={slug}
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
                    breakdownRows={breakdownRows}
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
 * page awaits only the cached dictionary at top level; `searchParams` is
 * forwarded as an un-awaited Promise into the Suspense-wrapped `CheckoutBody`,
 * whose `CheckoutPageSkeleton` fallback mirrors the layout 1:1 (and doubles as
 * the route `loading.tsx`). The currency-aware tour fetch lives inside that body
 * (it depends on the shopper currency, resolved from the URL/cookie).
 *
 * Pricing mirrors the booking widget (currency-aware `buildTourBookingData`), so
 * the numbers carry through from the card unchanged. The widget's `quoteId` /
 * `departureId` ride in the URL for the live booking submission that lands with
 * the payments module (BOOKING-FLOW-DESIGN-GUIDE §21.6).
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

    const dict = await getDictionary(locale);
    const tourHref = localizeHref(locale, `/${destination}/${slug}`);

    return (
        <section className='it-section !pt-0 bg-white'>
            <Suspense fallback={<CheckoutPageSkeleton />}>
                <CheckoutBody
                    locale={locale}
                    destination={destination}
                    slug={slug}
                    tourHref={tourHref}
                    searchParams={searchParams}
                    dict={dict.checkout}
                />
            </Suspense>
        </section>
    );
}
