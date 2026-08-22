/**
 * Shared helpers for the checkout / processing / thank-you E2E specs.
 *
 * ## Everything here talks to the REAL backend
 * These specs exist because three production bugs shipped through a flow that
 * had no end-to-end coverage at all. Mocking the API would only prove the
 * components render whatever they are handed - which was never the failure. So
 * the fixtures are DISCOVERED from the running backend (a live destination, a
 * live tour, a real bookable departure) rather than hard-coded, and the booking
 * they exercise is a real reserved booking.
 *
 * ## Nothing here is hard-coded to a seed slug
 * `tour-reviews.spec.ts` records that pinning specs to seeded slugs has already
 * broken once when the demo seed shifted. Discovery costs a few requests and
 * removes that whole class of rot.
 */
import type { APIRequestContext } from '@playwright/test';

export const BACKEND_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050';
const API = `${BACKEND_URL}/api/v1`;

/** A live tour with a bookable departure - everything a checkout URL needs. */
export interface BookableFixture {
    destinationSlug: string;
    tourSlug: string;
    tourId: string;
    departureId: string;
    /** `yyyy-MM-dd`, the departure's local date. */
    date: string;
    /** `HH:MM`. */
    time: string;
    /** Age band to buy one seat of. */
    ageBandId: string;
    currency: string;
}

interface DestinationRow {
    id: string;
    slug: string;
}
interface TourRow {
    id: string;
    slug: string;
    defaultCurrency?: string;
}

/** `yyyy-MM-dd` for `daysFromNow` days ahead, in UTC (the API's date space). */
function isoDate(daysFromNow: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + daysFromNow);
    return d.toISOString().slice(0, 10);
}

async function getJson<T>(
    request: APIRequestContext,
    path: string,
): Promise<T | null> {
    const res = await request.get(`${API}${path}`);
    if (!res.ok()) return null;
    return (await res.json()) as T;
}

/**
 * Find any tour that can actually be booked in the next 90 days.
 *
 * Returns null when the dataset has none - the caller then SKIPS rather than
 * fails, because "no bookable departure was seeded" is an environment gap, not
 * a product regression, and a red suite that means the latter would train
 * people to ignore it.
 */
export async function findBookableTour(
    request: APIRequestContext,
): Promise<BookableFixture | null> {
    const destinations =
        (await getJson<DestinationRow[]>(request, '/destinations/active')) ?? [];

    for (const destination of destinations) {
        const listing = await getJson<{ data: TourRow[] }>(
            request,
            `/tours?destinationId=${destination.id}&limit=20`,
        );
        for (const tour of listing?.data ?? []) {
            const res = await request.post(`${API}/availability/check`, {
                data: {
                    tourId: tour.id,
                    dateFrom: isoDate(1),
                    dateTo: isoDate(90),
                },
            });
            if (!res.ok()) continue;
            const departures = (await res.json()) as {
                id: string;
                date: string;
                startTime: string;
                available: boolean;
            }[];
            const departure = departures.find((d) => d.available);
            if (!departure) continue;

            // The detail payload carries the age bands the checkout prices by.
            // Prefer the DEFAULT band - that is the one the widget preselects,
            // so the URL this builds matches what a real traveller would send.
            const detail = await getJson<{
                id: string;
                slug: string;
                defaultCurrency: string;
                ageBands?: {
                    id: string;
                    isDefault?: boolean;
                    participation?: string;
                }[];
            }>(
                request,
                `/tours/slug/${tour.slug}?destinationSlug=${destination.slug}`,
            );
            const bands = (detail?.ageBands ?? []).filter(
                (b) => b.participation !== 'SPECTATOR',
            );
            const ageBandId = (bands.find((b) => b.isDefault) ?? bands[0])?.id;
            if (!ageBandId) continue;

            return {
                destinationSlug: destination.slug,
                tourSlug: tour.slug,
                tourId: tour.id,
                departureId: departure.id,
                date: departure.date.slice(0, 10),
                time: departure.startTime.slice(0, 5),
                ageBandId,
                currency: detail?.defaultCurrency ?? 'USD',
            };
        }
    }
    return null;
}

/**
 * The checkout URL the booking widget would produce for one seat.
 *
 * Mirrors `parseCheckoutSelection` (`lib/checkout/checkout.ts`) exactly - if
 * that contract changes, these specs must change with it, which is the point.
 */
export function checkoutUrl(
    fixture: BookableFixture,
    locale = 'en',
    extra: Record<string, string> = {},
): string {
    const params = new URLSearchParams({
        date: fixture.date,
        time: fixture.time,
        party: `${fixture.ageBandId}:1`,
        departure: fixture.departureId,
        currency: fixture.currency,
        ...extra,
    });
    return `/${locale}/${fixture.destinationSlug}/${fixture.tourSlug}/checkout?${params}`;
}

/** What the backend's PSP can actually do right now. */
export interface PaymentSetup {
    /** False when no PSP key is present - the card step cannot be reached. */
    configured: boolean;
    /**
     * True only for a Stripe TEST publishable key (`pk_test_`). The pay-through
     * spec is gated on this: it submits a card and creates a real charge, which
     * must never run against a live key by accident.
     */
    stripeTestMode: boolean;
    provider: string | null;
}

/**
 * Ask the backend what it can do, by creating one throwaway intent.
 *
 * Deliberately probed rather than read from config: the keys live encrypted in
 * `payment_settings`, not in env, so guessing at column names gets it wrong
 * (that mistake was made once already while writing these specs). The endpoint's
 * own answer is the only trustworthy signal.
 */
export async function getPaymentSetup(
    request: APIRequestContext,
    fixture: BookableFixture,
): Promise<PaymentSetup> {
    const unavailable: PaymentSetup = {
        configured: false,
        stripeTestMode: false,
        provider: null,
    };
    let booking: ReservedBooking;
    try {
        booking = await reserveBooking(request, fixture);
    } catch {
        // Cannot probe without a booking; the specs' own reserve will report
        // the real reason far more usefully than a skip message would.
        return unavailable;
    }

    const res = await request.post(
        `${API}/payments/bookings/${booking.id}/intent`,
        { data: {} },
    );
    // 503 "Payments are not configured" is the documented unconfigured answer.
    if (res.status() === 503 || !res.ok()) return unavailable;

    const body = (await res.json()) as {
        provider?: string;
        publishableKey?: string;
    };
    return {
        configured: true,
        provider: body.provider ?? null,
        stripeTestMode: Boolean(body.publishableKey?.startsWith('pk_test_')),
    };
}

export interface ReservedBooking {
    id: string;
    publicRef: string;
    displayRef: string;
    status: string;
}

/** Currently-bookable departure ids for a tour, soonest first. */
async function availableDepartureIds(
    request: APIRequestContext,
    tourId: string,
): Promise<string[]> {
    const res = await request.post(`${API}/availability/check`, {
        data: { tourId, dateFrom: isoDate(1), dateTo: isoDate(90) },
    });
    if (!res.ok()) return [];
    const departures = (await res.json()) as {
        id: string;
        available: boolean;
    }[];
    return departures.filter((d) => d.available).map((d) => d.id);
}

/**
 * Reserve a real booking straight through the API.
 *
 * Used to build a booking the TYP/processing specs can render WITHOUT paying for
 * one - the hand-off bugs these specs guard had nothing to do with the charge.
 *
 * ## Why it rolls onto another departure
 * These reserves hold REAL seats. A suite run (times `--repeat-each`) puts
 * dozens of ON_HOLD bookings on one departure, and capacity is finite - so the
 * fixture's departure genuinely sells out mid-run and every later reserve fails.
 * That produced exactly this flake before the fallback existed. On failure we
 * re-resolve the tour's currently-available departures and retry, then stick
 * with whichever worked so the next call starts there.
 *
 * THROWS (with the backend's own message) rather than returning null when no
 * departure will take the booking: a bare null surfaced as
 * `expect(booking).not.toBeNull()` with no hint of why, which is the least
 * useful failure a suite can produce.
 */
export async function reserveBooking(
    request: APIRequestContext,
    fixture: BookableFixture,
): Promise<ReservedBooking> {
    const attempt = async (departureId: string) =>
        request.post(`${API}/bookings`, {
            data: {
                tourId: fixture.tourId,
                departureId,
                currency: fixture.currency,
                items: [{ ageBandId: fixture.ageBandId, quantity: 1 }],
                pickupRequested: false,
            },
        });

    const tried = new Set<string>();
    let lastError = 'no departure was tried';

    for (const departureId of [
        fixture.departureId,
        ...(await availableDepartureIds(request, fixture.tourId)),
    ]) {
        if (tried.has(departureId)) continue;
        tried.add(departureId);

        const res = await attempt(departureId);
        if (res.ok()) {
            // Stick with a departure that still has room.
            fixture.departureId = departureId;
            return (await res.json()) as ReservedBooking;
        }
        lastError = `HTTP ${res.status()} ${(await res.text()).slice(0, 200)}`;
    }

    throw new Error(
        `Could not reserve on tour ${fixture.tourId} - tried ${tried.size} ` +
            `departure(s), last error: ${lastError}. If this says sold out, the ` +
            `suite has filled the seeded departures with its own holds; they ` +
            `expire via the hold sweeper, or re-seed the demo data.`,
    );
}

/** Attach contact details, as the checkout's Continue step does. */
export async function attachContact(
    request: APIRequestContext,
    bookingId: string,
    email = `e2e+${Date.now()}@example.test`,
): Promise<{ sessionToken?: string } | null> {
    const res = await request.patch(`${API}/bookings/${bookingId}`, {
        data: {
            contact: {
                firstName: 'E2E',
                lastName: 'Traveller',
                email,
                country: 'NL',
                locales: ['en'],
            },
        },
    });
    if (!res.ok()) return null;
    return (await res.json()) as { sessionToken?: string };
}
