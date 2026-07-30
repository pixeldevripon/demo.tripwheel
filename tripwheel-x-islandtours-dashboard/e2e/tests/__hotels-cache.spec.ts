/**
 * TEMPORARY probe: does a REAL dashboard edit reach the RENDERED public page?
 *
 * The one thing unit tests cannot cover. The chain under test is the whole
 * cross-repo bridge, end to end:
 *
 *   form save -> apiFetch -> revalidatePublicForPath('/hotels/:id')
 *             -> tagsForMutation -> ['hotels'] -> enqueueRevalidation
 *             -> revalidateCacheTags Server Action
 *             -> POST {public site}/api/revalidate  (x-revalidate-secret)
 *             -> revalidateTag('hotels')
 *             -> getHotelPromo() re-fetches on the next render
 *
 * A break anywhere in it is SILENT: the save succeeds, the dashboard shows the
 * new value, and the public site serves the old one for a full cacheLife('days').
 *
 * WHY A SECOND BROWSER CONTEXT: the card only renders on a thank-you page in
 * CELEBRATORY mode, which needs a traveller session and the `it.justBooked`
 * cookie. Fetching that URL unauthenticated returns the MASKED view, which never
 * renders the promo at all - so a plain `fetch` would "prove" the section was
 * hidden no matter what the cache did.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050';
const PUBLIC_SITE = process.env.PUBLIC_SITE_URL ?? 'http://localhost:3000';

const BOOKING = {
    publicRef: 'aa27b7ff-e67e-497b-a487-712ae98ada51',
    displayRef: 'IT-2026-P2D9T',
    email: 'traveler.t01@demo.islandtours.test',
    island: 'curacao',
};

/** Raw record, to read the starting value and to assert the write landed. */
async function publicCard(): Promise<{ sleeps: number | null }> {
    const res = await fetch(`${BACKEND}/api/v1/hotels/public?locale=en`);
    return res.json();
}

/** A traveller-authenticated page on the public site, parked on the TYP. */
async function travellerPage(context: BrowserContext): Promise<Page> {
    const page = await context.newPage();
    await page.goto(`${PUBLIC_SITE}/en/bookings`);
    await page.locator('#t-ref').fill(BOOKING.displayRef);
    await page.locator('#t-email').fill(BOOKING.email);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL(/thank-you/, { timeout: 30_000 });

    await context.addCookies([
        {
            name: 'it.justBooked',
            value: BOOKING.publicRef,
            domain: 'localhost',
            path: '/',
        },
    ]);
    return page;
}

async function cardText(page: Page): Promise<string> {
    await page.goto(
        `${PUBLIC_SITE}/${BOOKING.island}/thank-you/${BOOKING.publicRef}`,
    );
    await expect(page.locator('body')).toContainText('Palm Suite Apartment', {
        timeout: 30_000,
    });
    return (await page.locator('body').textContent()) ?? '';
}

test('a dashboard edit reaches the rendered public page without waiting out the cache', async ({
    page,
    browser,
}) => {
    const before = await publicCard();
    const start = before.sleeps ?? 4;
    const next = start === 9 ? 8 : 9;

    // A separate, traveller-authenticated context on the public site.
    const publicContext = await browser.newContext();
    const publicPage = await travellerPage(publicContext);

    // WARM the cached page, so there is a real entry to bust. Without this the
    // test would pass on a cold cache and prove nothing.
    expect(await cardText(publicPage)).toContain(`Sleeps ${start}`);

    // ── The dashboard edit ──────────────────────────────────────────────────
    await page.goto('/hotels');
    await page
        .getByRole('link', { name: 'Palm Suite Apartment' })
        .click({ timeout: 20_000 });
    await page.waitForURL(/\/hotels\/[0-9a-f-]+\/edit/);

    const sleeps = page.locator('input[name="sleeps"]');
    await sleeps.fill(String(next));
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Hotel updated successfully.')).toBeVisible({
        timeout: 15_000,
    });

    // Revalidation is fire-and-forget behind a 1s leading/trailing throttle.
    await page.waitForTimeout(3000);

    expect((await publicCard()).sleeps).toBe(next);
    const afterText = await cardText(publicPage);
    expect(afterText).toContain(`Sleeps ${next}`);
    expect(afterText).not.toContain(`Sleeps ${start}`);

    // ── Put it back, proving the bust works in both directions ──────────────
    await sleeps.fill(String(start));
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Hotel updated successfully.')).toBeVisible({
        timeout: 15_000,
    });
    await page.waitForTimeout(3000);

    expect((await publicCard()).sleeps).toBe(start);
    expect(await cardText(publicPage)).toContain(`Sleeps ${start}`);

    await publicContext.close();
});
