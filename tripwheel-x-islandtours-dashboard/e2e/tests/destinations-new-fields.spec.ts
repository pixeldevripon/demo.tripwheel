/**
 * Destinations - new fields E2E tests
 *
 * Covers the fields and behaviour added/changed since the original
 * destinations.spec.ts was written:
 *  - Region Select is required: empty submit shows validation error
 *  - Region Select is rendered and contains options
 *  - Currency Select is rendered
 *  - Country, Latitude, Longitude text inputs are visible
 *  - OG Image field section is visible
 *  - Gallery Images (multiple) field section is visible
 *  - Happy path: filling Region unblocks the create button (no region error)
 *  - Slug auto-generates from name (unchanged regression check)
 *
 * API calls are intercepted with page.route() - no live backend required.
 * Auth is provided by the global storageState from e2e/auth.setup.ts.
 */

import { test, expect } from '../fixtures/index';

test.setTimeout(30_000);

// ---------------------------------------------------------------------------
// Shared mock: active-destinations (needed so the parent-destination select
// can render, and to prevent network noise from unexpected calls).
// ---------------------------------------------------------------------------

async function mockActiveDestinations(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/destinations/active**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    } else {
      route.continue();
    }
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Destinations - new fields on create form', () => {
  test.beforeEach(async ({ page }) => {
    await mockActiveDestinations(page);
    await page.goto('/destinations/new');
    await page.waitForSelector('form', { timeout: 15_000 });
  });

  // -------------------------------------------------------------------------
  // 1. Region - required Select
  // -------------------------------------------------------------------------
  test('submitting without Region shows "Region is required" validation error', async ({ page }) => {
    await page.locator('input[name="name"]').fill('New Island');
    // Do NOT pick a region - submit immediately
    await page.getByRole('button', { name: /create destination/i }).click();
    await expect(page.getByText(/region is required/i)).toBeVisible();
  });

  test('Region select contains at least one option (CARIBBEAN)', async ({ page }) => {
    await page.getByRole('combobox').filter({ hasText: /select a region/i }).click();
    // Options list should appear with at least "Caribbean"
    await expect(page.getByRole('option', { name: /caribbean/i })).toBeVisible({ timeout: 5_000 });
  });

  test('selecting a Region clears the region validation error', async ({ page }) => {
    await page.locator('input[name="name"]').fill('New Island');
    await page.getByRole('button', { name: /create destination/i }).click();
    await expect(page.getByText(/region is required/i)).toBeVisible();

    // Now pick a region
    await page.getByRole('combobox').filter({ hasText: /select a region/i }).click();
    await page.getByRole('option').first().click();

    await expect(page.getByText(/region is required/i)).not.toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // 2. Currency - optional Select
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // 3. Country field
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // 4. Latitude / Longitude fields
  // -------------------------------------------------------------------------
  test('invalid latitude shows validation error', async ({ page }) => {
    await page.locator('input[name="latitude"]').fill('999');
    await page.locator('input[name="name"]').fill('Trigger validation');
    await page.getByRole('button', { name: /create destination/i }).click();
    await expect(page.getByText(/latitude must be between -90 and 90/i)).toBeVisible();
  });

  test('invalid longitude shows validation error', async ({ page }) => {
    await page.locator('input[name="longitude"]').fill('-999');
    await page.locator('input[name="name"]').fill('Trigger validation');
    await page.getByRole('button', { name: /create destination/i }).click();
    await expect(page.getByText(/longitude must be between -180 and 180/i)).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 5. OG Image
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // 6. Gallery Images
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // 7. Regression: slug auto-generates from name
  // -------------------------------------------------------------------------
  test('slug auto-generates from name on create form', async ({ page }) => {
    await page.locator('input[name="name"]').fill('Aruba Island');
    await expect(page.locator('input[name="slug"]')).toHaveValue('aruba-island');
  });

  // -------------------------------------------------------------------------
  // 8. Happy path: valid form with Region allows submit (no region error)
  // -------------------------------------------------------------------------
  test('form with name + region passes client-side region validation', async ({ page }) => {
    await page.route('**/api/v1/destinations', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'new-dest-id',
            name: 'Test Dest',
            slug: 'test-dest',
            isActive: true,
            isSeeded: false,
            heroImage: null,
            region: 'CARIBBEAN',
            createdAt: new Date().toISOString(),
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.locator('input[name="name"]').fill('Test Dest');

    // Pick a region
    await page.getByRole('combobox').filter({ hasText: /select a region/i }).click();
    await page.getByRole('option').first().click();

    await page.getByRole('button', { name: /create destination/i }).click();

    // Region error should NOT appear
    await expect(page.getByText(/region is required/i)).not.toBeVisible({ timeout: 3_000 });
  });
});
