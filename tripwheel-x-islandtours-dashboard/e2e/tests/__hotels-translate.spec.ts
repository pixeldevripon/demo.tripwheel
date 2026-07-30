/**
 * TEMPORARY probe: "Translate with AI" on a hotel.
 *
 * It was answering `Cannot POST /api/v1/hotel/translations/es/generate` - the
 * dashboard still built the SINGLETON path after hotels became a list. Nothing
 * catches that but a real click: the path is assembled from a string map, so it
 * type-checks perfectly while pointing at a route that does not exist.
 *
 * Also guards the field counter, which padded every hotel with three
 * page-content fields it does not have ("0 / 8" for five fields).
 */
import { expect, test } from '@playwright/test';

async function openSpanishWorkspace(page: import('@playwright/test').Page) {
    await page.goto('/translations');
    await page.getByRole('tab', { name: 'Hotels' }).click();
    await page
        .getByRole('link', { name: 'Palm Suite Apartment' })
        .first()
        .click({ timeout: 20_000 });
    await page.getByRole('link', { name: /Spanish/ }).click();
    await page.waitForURL(/hotel\/.+\/es/);
}

test('counts only the fields a hotel actually has', async ({ page }) => {
    await openSpanishWorkspace(page);
    // Five copy fields, not eight: a hotel has no page-content record.
    await expect(page.locator('body')).toContainText('/ 5 fields');
});

test('Translate with AI reaches the backend and fills the locale', async ({
    page,
}) => {
    // A real provider round trip for five fields; the default 30s is not enough.
    test.setTimeout(120_000);
    await openSpanishWorkspace(page);

    const generate = page.waitForResponse(
        r => r.url().includes('/translations/es/generate'),
        { timeout: 90_000 },
    );
    await page.getByRole('button', { name: 'Translate with AI' }).click();
    // The button only opens a confirmation - it re-translates hand-written rows,
    // so it is deliberately behind an explicit yes.
    await page.getByRole('button', { name: 'Translate everything' }).click();
    const res = await generate;

    // THE REGRESSION was a 404 on the singleton-shaped path. Assert the URL
    // shape, so a future singleton-shaped path fails here rather than in
    // production.
    expect(res.url()).toContain('/hotels/');
    expect(res.url()).not.toContain('/hotel/translations');

    // 201 = translated. 503 = the route, the permission, the entity lookup and
    // the unit collection ALL worked and the external provider refused us -
    // which is a platform-wide config problem (the stored OpenRouter key), not
    // a hotel one, and is why this is not asserted as 201. A 404 here is the
    // bug this spec exists for.
    expect([201, 503]).toContain(res.status());

    const body = await res.text();
    if (res.status() === 503) {
        expect(body).toContain('AI translation failed');
        test.info().annotations.push({
            type: 'skipped-assertion',
            description:
                'Provider unconfigured - the translated values were not checked.',
        });
        return;
    }

    // Something actually landed in the Spanish column.
    await expect(page.locator('input[name="title"]')).not.toHaveValue('', {
        timeout: 30_000,
    });
});
