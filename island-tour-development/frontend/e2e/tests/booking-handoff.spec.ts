/**
 * Booking hand-off E2E - the `/checkout/processing` hop and the thank-you page.
 *
 * ## These are regression tests for real production defects (2026-07-29)
 *  1. The processing -> TYP hand-off blanked. Root cause was the Vercel
 *     RSC-variant bug: a client-router flight request for a NON-prerendered path
 *     is answered with the HTML document, so the router discarded ~180 KB,
 *     aborted and hard-navigated anyway. The TYP can NEVER be prerendered
 *     (`publicRef` is an unguessable runtime token), so the hop is now a
 *     deliberate document navigation via `lib/checkout/leave-to.ts`.
 *  2. The TYP intermittently rendered the generic error boundary, because
 *     `publicGetStrict` throws on any non-2xx/404 and nothing caught it.
 *  3. A booking whose `island` was a display NAME rather than a slug 404'd its
 *     own thank-you page forever, because the page compares the two.
 *
 * ## What runs without a PSP
 * All of it. These specs reserve a real booking through the API instead of
 * paying for one - the charge was never what broke here, and requiring Stripe
 * keys would have meant this file simply did not run on most machines.
 *
 * The reserved bookings stay ON_HOLD and expire on their own via the hold
 * sweeper, so there is nothing to clean up.
 */
import { expect, test } from '@playwright/test';
import {
    attachContact,
    findBookableTour,
    reserveBooking,
    type BookableFixture,
} from '../helpers/booking';

let fixture: BookableFixture | null = null;

test.beforeAll(async ({ request }) => {
    fixture = await findBookableTour(request);
});

test.beforeEach(() => {
    test.skip(
        !fixture,
        'No bookable departure in the next 90 days - seed the demo data first.',
    );
});

test.describe('processing hop', () => {
    test('redirects to the tours list when there is no booking ref', async ({
        page,
    }) => {
        // Nothing to poll for. A traveller must not be parked on a spinner that
        // can never resolve.
        await page.goto(
            `/en/${fixture!.destinationSlug}/${fixture!.tourSlug}/checkout/processing`,
        );

        await expect(page).toHaveURL(
            new RegExp(`/en/${fixture!.destinationSlug}/tours`),
        );
    });

    test('shows the confirming state and never strands the traveller', async ({
        page,
        request,
    }) => {
        const booking = await reserveBooking(request, fixture!);

        await page.goto(
            `/en/${fixture!.destinationSlug}/${fixture!.tourSlug}/checkout/processing` +
                `?ref=${encodeURIComponent(booking.publicRef)}&tour=${fixture!.tourId}`,
        );

        // The booking is ON_HOLD and unpaid, so settle cannot confirm it - this
        // is the polling path. It must show progress, not a blank page.
        await expect(
            page.getByRole('heading', { name: 'Confirming your booking' }),
        ).toBeVisible();

        // ~20s of polling, then the manual escape hatch appears. Without it the
        // traveller would sit on an infinite spinner after a real charge.
        await expect(
            page.getByRole('link', { name: 'View my booking' }),
        ).toBeVisible({ timeout: 60_000 });
    });

    test('sends a failed redirect-return back to checkout, not onward', async ({
        page,
        request,
    }) => {
        // Stripe appends redirect_status to its return_url. A failed hop is
        // known BEFORE any backend call - money never moved, so the traveller
        // goes back to retry rather than to a thank-you page for a booking that
        // was never paid for.
        const booking = await reserveBooking(request, fixture!);

        await page.goto(
            `/en/${fixture!.destinationSlug}/${fixture!.tourSlug}/checkout/processing` +
                `?ref=${encodeURIComponent(booking.publicRef)}&redirect_status=failed`,
        );

        await expect(page).toHaveURL(/checkout\?.*payment=failed|checkout\?payment=failed/);
        await expect(
            page.getByText(/payment couldn't be completed/i),
        ).toBeVisible();
    });
});

/**
 * The 404 screen's giant "404" glyph (`not-found-screen.tsx`) - a literal, not
 * dictionary copy, so it is stable across all seven locales.
 *
 * ## Why these assert on CONTENT, not on the HTTP status
 * The TYP resolves its booking inside a streamed `<Suspense>` boundary, so the
 * 200 shell is already flushed by the time `notFound()` runs - the status can no
 * longer change and every one of these responses is a 200 carrying not-found UI.
 * That is inherent to this route's PPR shape, and harmless here because the TYP
 * is `noindex` either way, but it means a status assertion would be testing the
 * framework's flush order rather than the product. (Verified against the running
 * app, not assumed.)
 */
async function expectNotFoundScreen(page: import('@playwright/test').Page) {
    await expect(page.getByText('404', { exact: true }).first()).toBeVisible({
        timeout: 30_000,
    });
}

test.describe('thank-you page', () => {
    test('shows the 404 screen for an unknown public ref', async ({ page }) => {
        await page.goto(
            `/${fixture!.destinationSlug}/thank-you/pr-does-not-exist-e2e`,
        );
        await expectNotFoundScreen(page);
    });

    test('renders a real booking at its locale-less URL', async ({
        page,
        request,
    }) => {
        // The TYP is the one public route with NO locale prefix, served through
        // the proxy rewrite. Reaching it by that URL is the contract the
        // confirmation email depends on.
        const booking = await reserveBooking(request, fixture!);
        await attachContact(request, booking.id);

        await page.goto(
            `/${fixture!.destinationSlug}/thank-you/${booking.publicRef}`,
        );

        // Asserted on the body's TEXT rather than a visible locator: React's
        // streaming SSR parks a second, hidden copy of late-arriving Suspense
        // content in the DOM, so `getByText(...)` resolves to a 0x0 hidden node
        // and fails as "hidden" while the page looks perfect in a browser (the
        // same trap `tour-reviews.spec.ts` documents at length).
        await expect(page.locator('body')).toContainText(booking.displayRef, {
            timeout: 30_000,
        });
    });

    test('shows the 404 screen when the URL destination is not the booking own', async ({
        page,
        request,
    }) => {
        // Guards the `island` comparison. A booking stamped with a value that is
        // not its destination SLUG - which is exactly what the `'Curaçao'`
        // default produced - makes this page unreachable forever. Proving the
        // mismatch is rejected is what makes the backfill's correctness
        // observable from outside the database.
        const booking = await reserveBooking(request, fixture!);

        await page.goto(
            `/not-this-destination/thank-you/${booking.publicRef}`,
        );
        await expectNotFoundScreen(page);
    });

    test('is served as a flight payload, not an HTML document, on client nav', async ({
        page,
        request,
    }) => {
        // THE regression test for the hand-off blank. If a client-router RSC
        // request for this route is answered with `text/html`, the router cannot
        // parse it, aborts and hard-navigates - which is what produced the
        // blank-then-skeleton flash. We assert on the response the router would
        // actually receive.
        //
        // HONEST SCOPE: the bug is Vercel-only - a local `next dev`/`next start`
        // always answers correctly, so against the default localhost baseURL
        // this test PASSES unconditionally and proves nothing. It only has teeth
        // pointed at a real deployment (`PLAYWRIGHT_BASE_URL=https://<preview>`).
        // Recorded as an annotation rather than left to look like coverage it
        // does not provide; the day it fails there, `leave-to.ts` is still
        // required, and the day it passes there, that workaround can be reverted.
        const baseURL = test.info().project.use.baseURL ?? '';
        if (/localhost|127\.0\.0\.1/.test(baseURL)) {
            test.info().annotations.push({
                type: 'informational',
                description:
                    'Vercel-only bug: passes trivially against localhost. Run with ' +
                    'PLAYWRIGHT_BASE_URL set to a deployed origin for this to mean anything.',
            });
        }

        const booking = await reserveBooking(request, fixture!);

        const res = await request.get(
            `/${fixture!.destinationSlug}/thank-you/${booking.publicRef}?_rsc=e2e`,
            { headers: { RSC: '1' } },
        );

        const contentType = res.headers()['content-type'] ?? '';
        expect(
            contentType,
            'A non-prerendered route answering an RSC request with text/html is the ' +
                'Vercel RSC-variant bug - client navigation to the TYP will hard-reload. ' +
                'See lib/checkout/leave-to.ts.',
        ).toContain('text/x-component');
    });
});
