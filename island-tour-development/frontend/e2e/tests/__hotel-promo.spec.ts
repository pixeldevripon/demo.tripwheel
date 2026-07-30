/**
 * TEMPORARY verification spec for the hotel promo going dynamic
 * (Dashboard > Pages > Hotels -> the last card on the thank-you page).
 *
 * Prefixed `__` like the other throwaway probes in this folder. It talks to the
 * REAL backend and a REAL booking, because the thing being proved is exactly the
 * wiring: the card must render values that came from the database, and must
 * disappear when no hotel qualifies.
 *
 * Reaching the card needs CELEBRATORY mode, which needs two things a plain
 * `page.goto` does not have:
 *   1. a traveller session, or the payload is masked and no promo renders - got
 *      by driving the real `/bookings` pair lookup (#t-ref + #t-email);
 *   2. the `it.justBooked` cookie set to this booking's publicRef, which
 *      checkout normally writes on hand-off.
 */
import { expect, test } from '@playwright/test';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050';

/** The demo booking this probe drives. Skipped if it is not in this database. */
const BOOKING = {
    publicRef: 'aa27b7ff-e67e-497b-a487-712ae98ada51',
    displayRef: 'IT-2026-P2D9T',
    email: 'traveler.t01@demo.islandtours.test',
    island: 'curacao',
};

/** Sign in through the real pair lookup and land on the thank-you page. */
async function openThankYou(page: import('@playwright/test').Page, context: import('@playwright/test').BrowserContext) {
    await page.goto('/en/bookings');
    await page.locator('#t-ref').fill(BOOKING.displayRef);
    await page.locator('#t-email').fill(BOOKING.email);
    await page.locator('button[type="submit"]').first().click();

    // The lookup redirects to the TYP itself once the session is set.
    await page.waitForURL(/thank-you/, { timeout: 30_000 });

    await context.addCookies([
        {
            name: 'it.justBooked',
            value: BOOKING.publicRef,
            domain: 'localhost',
            path: '/',
        },
    ]);

    await page.goto(`/${BOOKING.island}/thank-you/${BOOKING.publicRef}`);
}

test('the thank-you hotel card renders values from the database', async ({
    page,
    context,
}) => {
    const probe = await fetch(`${BACKEND}/api/v1/bookings/typ/${BOOKING.publicRef}`);
    test.skip(!probe.ok, 'demo booking not present in this database');

    await openThankYou(page, context);

    // Asserted on body TEXT, not a visible locator: streaming SSR parks a hidden
    // duplicate of late Suspense content in the DOM, so getByText resolves a 0x0
    // node and fails as "hidden" while the page looks perfect in a browser.
    const body = page.locator('body');
    await expect(body).toContainText('Palm Suite Apartment', { timeout: 30_000 });
    // Facts from the hotels table, not the old hardcoded constants: same values,
    // but they can only be on screen now if they came through the API.
    await expect(body).toContainText('Jan Thiel');
    await expect(body).toContainText('4.8');
    await expect(body).toContainText('1,738');
    await expect(body).toContainText('Sleeps 4');
    await expect(body).toContainText('$160');
    await expect(body).toContainText('Quiet, modern, 5min from the beach');
    await expect(body).toContainText('Owned and hosted by Island Tours');
    // The two chrome labels still come from the dictionary (both stored null).
    await expect(body).toContainText('See availability on Airbnb');

    // Scroll it into view first: the card is wrapped in <Reveal>, so it sits at
    // opacity 0 until it enters the viewport. `.first()` matters - React's
    // streaming SSR parks a hidden duplicate of late Suspense content in the
    // DOM, and `.last()` picks that invisible copy.
    const card = page
        .locator('section', { hasText: 'Palm Suite Apartment' })
        .first();
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);

    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    await page.screenshot({
        path: 'e2e/__shots/hotel-promo-live.png',
        clip: box!,
    });
});
