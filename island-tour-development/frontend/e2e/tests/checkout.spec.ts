/**
 * Checkout page E2E - `/{locale}/{destination}/{slug}/checkout`.
 *
 * ## Why this file exists
 * Three defects shipped to production through this flow (laggy PSP card fields,
 * a blank flash on the processing hand-off, an intermittent thank-you error) and
 * it had NO end-to-end coverage at all. Unit tests could not have caught any of
 * them: each was an interaction between real routing, real streaming and a real
 * backend.
 *
 * ## What is covered, stated honestly
 * Nothing is mocked. The contact step runs everywhere. The payment step needs a
 * PSP (Stripe/Mollie keys live encrypted in `payment_settings`, NOT in env), so
 * it SKIPS with a stated reason when `POST /payments/bookings/:id/intent`
 * answers 503, and runs for real when a key is present. The final pay-through
 * test submits a card and creates a REAL charge, so it is gated more tightly
 * still - on a `pk_test_` publishable key - and can never fire against a live
 * key by accident.
 *
 * Do not infer the PSP's state from config files; probe the endpoint. Guessing
 * at the `payment_settings` column names while writing these specs produced a
 * confident, wrong "no PSP configured" - the endpoint's own answer is the only
 * trustworthy signal (`getPaymentSetup`).
 *
 * Fixtures are DISCOVERED from the running backend, never pinned to a seed slug
 * (see `e2e/helpers/booking.ts` for why).
 */
import { expect, test, type Page } from '@playwright/test';
import {
    checkoutUrl,
    findBookableTour,
    getPaymentSetup,
    type BookableFixture,
    type PaymentSetup,
} from '../helpers/booking';

let fixture: BookableFixture | null = null;
let payments: PaymentSetup = {
    configured: false,
    stripeTestMode: false,
    provider: null,
};

test.beforeAll(async ({ request }) => {
    fixture = await findBookableTour(request);
    if (fixture) payments = await getPaymentSetup(request, fixture);
});

/**
 * Open the checkout and wait until the contact form is actually HYDRATED.
 *
 * Typing before hydration silently loses the input: the value lands in the DOM,
 * then React hydrates the controlled inputs back to their (empty) state, and
 * Continue submits a blank form. That produced a real intermittent failure here
 * - "This field is required" on three fields that had just been filled.
 *
 * `CheckoutForm` writes `it-checkout-return:{tourId}` to sessionStorage in a
 * mount effect, so that key appearing is proof this specific component has
 * hydrated - a far tighter signal than `networkidle`, which says nothing about
 * React.
 */
async function openCheckout(
    page: Page,
    fixture: BookableFixture,
    extra: Record<string, string> = {},
): Promise<void> {
    await page.goto(checkoutUrl(fixture, 'en', extra));
    await page.waitForFunction(
        (tourId) =>
            window.sessionStorage.getItem(`it-checkout-return:${tourId}`) !==
            null,
        fixture.tourId,
        { timeout: 30_000 },
    );
}

/**
 * Complete the contact step with valid details and wait for Payment to open.
 *
 * First/last name, not "Full name": the form split the name in two (dev spec §2
 * - split names raise the Enhanced Conversions match rate 20-40%) and this
 * helper was never updated, so every test that calls it - including the two
 * payment-step ones and the pay-through - had been failing on a selector that
 * matches nothing. Found while verifying Pastel 82.
 */
async function completeContactStep(page: Page): Promise<void> {
    await page.getByLabel(/first name/i).fill('E2E');
    await page.getByLabel(/last name/i).fill('Traveller');
    await page
        .getByLabel(/email address/i)
        .fill(`e2e+${Date.now()}@example.test`);
    await page.getByLabel(/phone number/i).fill('612345678');
    await page.getByRole('button', { name: /^continue$/i }).click();
    // Contact collapses to its done-summary row (green check + Edit).
    await expect(page.getByRole('button', { name: /^edit$/i })).toBeVisible({
        timeout: 30_000,
    });
}

test.beforeEach(() => {
    // An environment without a bookable departure is a data gap, not a
    // regression - fail loudly as a SKIP rather than a misleading red.
    test.skip(
        !fixture,
        'No bookable departure in the next 90 days - seed the demo data first.',
    );
});

test.describe('checkout - contact step', () => {
    test('renders the contact form with the booking summary alongside', async ({
        page,
    }) => {
        await openCheckout(page, fixture!);

        await expect(
            page.getByRole('heading', { name: 'Confirming your booking' }),
        ).toHaveCount(0);
        await expect(page.getByText('Contact details')).toBeVisible();
        await expect(page.getByLabel(/first name/i)).toBeVisible();
        await expect(page.getByLabel(/last name/i)).toBeVisible();
        await expect(page.getByLabel(/email address/i)).toBeVisible();
        await expect(page.getByLabel(/phone number/i)).toBeVisible();
        // The summary is server-rendered beside the form; the tour name is the
        // cheapest stable proof it resolved the selection rather than 404ing.
        await expect(page.getByRole('link', { name: /back to tour/i })).toBeVisible();
    });

    test('blocks Continue until the required fields are filled', async ({
        page,
    }) => {
        await openCheckout(page, fixture!);

        await page.getByRole('button', { name: /^continue$/i }).click();

        // One message per empty required field - and critically, still on the
        // contact step: an empty form must never reserve a booking.
        await expect(
            page.getByText('This field is required').first(),
        ).toBeVisible();
        await expect(page.getByText('Contact details')).toBeVisible();
    });

    test('rejects a malformed email', async ({ page }) => {
        await openCheckout(page, fixture!);

        await page.getByLabel(/first name/i).fill('E2E');
        await page.getByLabel(/last name/i).fill('Traveller');
        await page.getByLabel(/email address/i).fill('not-an-email');
        await page.getByLabel(/phone number/i).fill('612345678');
        await page.getByRole('button', { name: /^continue$/i }).click();

        await expect(
            page.getByText('Enter a valid email address'),
        ).toBeVisible();
    });

    test('shows the retry banner when returning with ?payment=failed', async ({
        page,
    }) => {
        // The processing page bounces a FAILED charge back here. The traveller's
        // money did not move, and they must be told so before re-entering
        // anything - this banner regressing would be silent.
        await openCheckout(page, fixture!, { payment: 'failed' });

        await expect(
            page.getByText(/payment couldn't be completed/i),
        ).toBeVisible();
    });
});

test.describe('checkout - payment step', () => {
    test.beforeEach(() => {
        test.skip(
            !payments.configured,
            'No PSP configured (payment_settings has no Stripe/Mollie key) - ' +
                'the card step cannot be reached. Add Stripe test keys to run this.',
        );
    });

    test('reserves the booking and reveals the card fields', async ({
        page,
    }) => {
        await openCheckout(page, fixture!);

        // Payment is gated until contact completes - the accordion says so.
        await expect(page.getByText('Complete Contact first')).toBeVisible();

        await completeContactStep(page);
        await expect(page.getByText('Complete Contact first')).toHaveCount(0);

        // The PSP card fields are cross-origin iframes. Asserting the iframe is
        // ATTACHED (not just that a label rendered) is what proves the mount
        // container was usable - the exact thing that broke when they were
        // mounted into a zero-height, clipped, still-animating box.
        const cardFrame = page.locator(
            'iframe[name^="__privateStripeFrame"], iframe[src*="mollie"]',
        );
        await expect(cardFrame.first()).toBeAttached({ timeout: 30_000 });
    });

    test('Edit re-opens contact without destroying the payment step', async ({
        page,
    }) => {
        // The accordion deliberately keeps the PSP fields MOUNTED across an edit
        // round trip so entries survive. Re-mounting them would also re-create
        // the iframes inside a collapsing box - the original bug.
        await openCheckout(page, fixture!);
        await completeContactStep(page);

        const cardFrame = page
            .locator('iframe[name^="__privateStripeFrame"], iframe[src*="mollie"]')
            .first();
        await expect(cardFrame).toBeAttached();

        await page.getByRole('button', { name: /^edit$/i }).click();
        await expect(page.getByLabel(/first name/i)).toBeVisible();
        // Still attached - collapsed, never unmounted.
        await expect(cardFrame).toBeAttached();
    });
});

test.describe('checkout - pay through to the thank-you page', () => {
    test.beforeEach(() => {
        // Gated on TEST MODE specifically, not merely "configured": this test
        // submits a card and creates a real charge. It must never run against a
        // live key by accident.
        test.skip(
            !payments.stripeTestMode,
            'Requires Stripe TEST keys (pk_test_...) - this test creates a real charge.',
        );
    });

    test('a card payment lands on the confirmed thank-you page', async ({
        page,
    }) => {
        // The whole reported defect path in one test: pay -> processing hop ->
        // thank-you. Every one of the three production bugs lived somewhere on
        // this line, and nothing covered it end to end.
        test.setTimeout(120_000);

        await openCheckout(page, fixture!);
        await completeContactStep(page);

        // Stripe splits the card into one iframe per Element; the `title`
        // attributes are Stripe's own stable, documented handles.
        await page
            .frameLocator('iframe[title="Secure card number input frame"]')
            .locator('input[name="cardnumber"]')
            .fill('4242424242424242');
        await page
            .frameLocator('iframe[title="Secure expiration date input frame"]')
            .locator('input[name="exp-date"]')
            .fill('12' + String(new Date().getFullYear() + 3).slice(-2));
        await page
            .frameLocator('iframe[title="Secure CVC input frame"]')
            .locator('input[name="cvc"]')
            .fill('123');

        // The only field of our own, outside the iframes. There is deliberately
        // no postal code input - Pastel 82 - and no Stripe one either: the split
        // Elements cannot render a postal field and Stripe ships no standalone
        // postal Element (verified against the `StripeElementType` union in
        // @stripe/stripe-js 9.x, which has no `postalCode` member).
        await page.getByLabel(/name on card/i).fill('E2E Traveller');
        await expect(page.getByLabel(/postal code/i)).toHaveCount(0);

        // Watch for a throttled settle BEFORE clicking, so the race below can
        // tell "the hand-off is broken" apart from "this environment is out of
        // settle budget" - see the skip note under the race.
        const settleThrottled = page
            .waitForResponse(
                (r) => r.url().includes('/settle') && r.status() === 429,
                { timeout: 90_000 },
            )
            .then(() => 'throttled' as const)
            .catch(() => null);

        await page.getByRole('button', { name: /reserve my spot/i }).click();

        // The processing hop settles synchronously, then hands off to the TYP.
        // Asserting the URL rather than the spinner: the hop is fast when settle
        // wins on the first tick, so racing the spinner would be flaky - the
        // destination is the contract that matters.
        const arrived = page
            .waitForURL(/\/thank-you\//, { timeout: 90_000 })
            .then(() => 'arrived' as const)
            .catch(() => null);

        const outcome = await Promise.race([arrived, settleThrottled]);

        // `POST /payments/typ/:publicRef/settle` is capped at 20/HOUR PER IP
        // (payments.controller.ts) because every call costs a live Stripe API
        // hit. A real traveller settles once per booking and never approaches
        // it; a suite run from one IP does - this test alone spends one, and
        // every processing-page load in `booking-handoff.spec.ts` spends
        // another. Without this branch that shows up as an opaque 90s
        // `waitForURL` timeout that reads like a broken hand-off.
        test.skip(
            outcome === 'throttled',
            'settle is throttled (20/hr per IP, spent by earlier runs) - the ' +
                'booking cannot confirm right now. Wait for the window to roll over.',
        );
        expect(
            outcome,
            'The charge succeeded but the processing hop never reached the ' +
                'thank-you page - this is the hand-off regression these specs guard.',
        ).toBe('arrived');

        // Confirmed, and rendered for the fresh booker - not the masked
        // shared-link view, because checkout parked the traveler session cookie
        // before the hand-off.
        await expect(page.locator('body')).toContainText(/IT-\d{4}-[A-Z0-9]+/, {
            timeout: 30_000,
        });
        // The 404 screen must NOT be what we landed on - this is the assertion
        // that would have caught the `island` slug mismatch reaching production.
        await expect(page.getByText('404', { exact: true })).toHaveCount(0);
    });
});
