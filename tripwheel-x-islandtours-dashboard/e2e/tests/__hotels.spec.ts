/**
 * TEMPORARY verification spec for the Hotels list module. Prefixed `__` like the
 * other throwaway probes: it drives the REAL backend, because the things being
 * proved are exactly the wiring and the guard.
 */
import { expect, test } from '@playwright/test';

test.describe('Hotels', () => {
    test('lists the seeded hotel and says which one is live', async ({
        page,
    }) => {
        await page.goto('/hotels');

        await expect(
            page.getByRole('heading', { name: 'Hotels' }),
        ).toBeVisible();
        await expect(page.locator('body')).toContainText(
            'Palm Suite Apartment',
            { timeout: 20_000 },
        );
        // The banner names the promoted hotel rather than making an admin read
        // four status badges to answer the only question they came with.
        await expect(page.locator('body')).toContainText(
            'is showing on the thank-you page',
        );
        await expect(page.locator('body')).toContainText('On the site');
        // The new columns: a photo thumbnail and the sleeps count. No "Order"
        // column - it read as orders/bookings, which the booking site owns.
        await expect(page.locator('table img').first()).toBeVisible();
        await expect(page.locator('table')).toContainText('Sleeps');
        await expect(page.locator('table thead')).not.toContainText('Order');

        await page.screenshot({
            path: 'e2e/__shots/hotels-list.png',
            fullPage: true,
        });
    });

    /**
     * THE SEED PROTECTION. `isSeeded` rows are refused by the API with a 403;
     * the row action is disabled so an admin never clicks into that error.
     */
    test('offers no Delete on the seeded hotel', async ({ page }) => {
        await page.goto('/hotels');
        await expect(page.locator('body')).toContainText(
            'Palm Suite Apartment',
            { timeout: 20_000 },
        );

        await page.getByRole('button', { name: 'Open menu' }).first().click();
        // The external listing is the only "view" there is: the card renders on
        // a thank-you page nobody can reach without a real booking reference.
        await expect(
            page.getByRole('menuitem', { name: 'View listing' }),
        ).toBeVisible();
        const del = page.getByRole('menuitem', { name: 'Delete' });
        await expect(del).toBeVisible();
        await expect(del).toHaveAttribute('data-disabled', '');
    });

    test('opens the editor with both tabs', async ({ page }) => {
        await page.goto('/hotels');
        await page
            .getByRole('link', { name: 'Palm Suite Apartment' })
            .click({ timeout: 20_000 });

        await page.waitForURL(/\/hotels\/[0-9a-f-]+\/edit/);
        await expect(page.getByRole('tab', { name: 'Details' })).toBeVisible();
        await expect(page.getByRole('tab', { name: 'Content' })).toBeVisible();
        // The record's own facts are on Details.
        await expect(page.locator('body')).toContainText('Booking link');
        await expect(page.locator('body')).toContainText('Price per night');

        await page.screenshot({
            path: 'e2e/__shots/hotel-edit.png',
            fullPage: true,
        });

        // The per-locale copy is on Content, with the eyebrow and button text
        // carrying REAL values now rather than showing as empty placeholders.
        await page.getByRole('tab', { name: 'Content' }).click();
        await expect(page.locator('body')).toContainText('Hotel name');
        await expect(page.locator('body')).toContainText('Short pitch');
        await expect(page.locator('input[name="eyebrow"]')).toHaveValue(
            'OUR APARTMENT',
        );
        await expect(page.locator('input[name="ctaLabel"]')).toHaveValue(
            'See availability on Airbnb',
        );

        await page.screenshot({
            path: 'e2e/__shots/hotel-content.png',
            fullPage: true,
        });
    });

    test('the create form asks only for a name', async ({ page }) => {
        await page.goto('/hotels/new');

        await expect(
            page.getByRole('heading', { name: 'New Hotel' }),
        ).toBeVisible();
        await expect(page.locator('body')).toContainText('Name');
        await expect(
            page.getByRole('button', { name: 'Create Hotel' }),
        ).toBeVisible();
    });
});
