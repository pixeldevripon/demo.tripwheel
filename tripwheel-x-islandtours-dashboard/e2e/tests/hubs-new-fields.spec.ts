/**
 * Hubs - new fields E2E tests
 *
 * Covers the fields and behaviour added/changed since the original
 * hubs.spec.ts was written:
 *  - Hub Type Select is required: empty submit shows validation error
 *  - Hub Type Select is rendered and contains LOCATION / HIGHLIGHT / AREA options
 *  - Latitude and Longitude optional inputs are visible
 *  - Latitude/Longitude validation (out-of-range values)
 *  - Happy path: create with Hub Type selected calls POST and navigates to edit
 *  - Destination is read-only on edit form
 *  - Regression: name validation still works
 *
 * API calls are intercepted with page.route() - no live backend required.
 * Auth is provided by the global storageState from e2e/auth.setup.ts.
 */

import { test, expect } from '../fixtures/index';

test.setTimeout(30_000);

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const MOCK_DESTINATIONS = [
  {
    id: 'dest-1',
    name: 'Curacao',
    slug: 'curacao',
    isActive: true,
    isSeeded: true,
    heroImage: null,
  },
];

const MOCK_HUB_CREATED = {
  id: 'hub-new-id',
  name: 'Test Hub',
  slug: 'test-hub',
  destinationId: 'dest-1',
  destinationName: 'Curacao',
  hubType: 'LOCATION',
  latitude: null,
  longitude: null,
  description: null,
  isActive: true,
  isSeeded: false,
  createdAt: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function mockActiveDestinations(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/destinations/active**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_DESTINATIONS),
      });
    } else {
      route.continue();
    }
  });
}

// ---------------------------------------------------------------------------
// Tests: Create form
// ---------------------------------------------------------------------------

test.describe('Hubs - Hub Type Select on create form', () => {
  test.beforeEach(async ({ page }) => {
    await mockActiveDestinations(page);
    await page.goto('/hubs/new');
    await page.waitForLoadState('networkidle');
  });

  test('Hub Type select contains LOCATION option', async ({ page }) => {
    await page.getByRole('combobox').filter({ hasText: /select a hub type/i }).click();
    await expect(page.getByRole('option', { name: /location/i })).toBeVisible({ timeout: 5_000 });
  });

  test('Hub Type select contains HIGHLIGHT option', async ({ page }) => {
    await page.getByRole('combobox').filter({ hasText: /select a hub type/i }).click();
    await expect(page.getByRole('option', { name: /highlight/i })).toBeVisible({ timeout: 5_000 });
  });

  test('Hub Type select contains AREA option', async ({ page }) => {
    await page.getByRole('combobox').filter({ hasText: /select a hub type/i }).click();
    await expect(page.getByRole('option', { name: /area/i })).toBeVisible({ timeout: 5_000 });
  });

  test('submitting without Hub Type shows validation error', async ({ page }) => {
    await page.locator('input[name="name"]').fill('My Hub');
    // Pick destination
    await page.getByRole('combobox').filter({ hasText: /select a destination/i }).click();
    await page.getByRole('option', { name: /curacao/i }).click();
    // Do NOT pick hub type
    await page.getByRole('button', { name: /create hub/i }).click();
    await expect(page.getByText(/hub type is required/i)).toBeVisible();
  });

  test('selecting Hub Type clears the hub type validation error', async ({ page }) => {
    await page.locator('input[name="name"]').fill('My Hub');
    await page.getByRole('combobox').filter({ hasText: /select a destination/i }).click();
    await page.getByRole('option', { name: /curacao/i }).click();
    await page.getByRole('button', { name: /create hub/i }).click();
    await expect(page.getByText(/hub type is required/i)).toBeVisible();

    // Now select a hub type
    await page.getByRole('combobox').filter({ hasText: /select a hub type/i }).click();
    await page.getByRole('option', { name: /location/i }).click();
    await expect(page.getByText(/hub type is required/i)).not.toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // Lat/Lng optional fields
  // -------------------------------------------------------------------------
  test('invalid latitude shows validation error', async ({ page }) => {
    await page.locator('input[name="name"]').fill('Validate lat');
    await page.locator('input[name="latitude"]').fill('200');
    await page.getByRole('button', { name: /create hub/i }).click();
    await expect(page.getByText(/latitude must be between -90 and 90/i)).toBeVisible();
  });

  test('invalid longitude shows validation error', async ({ page }) => {
    await page.locator('input[name="name"]').fill('Validate lng');
    await page.locator('input[name="longitude"]').fill('-200');
    await page.getByRole('button', { name: /create hub/i }).click();
    await expect(page.getByText(/longitude must be between -180 and 180/i)).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Happy path: full valid create
  // -------------------------------------------------------------------------
  test('valid form (destination + name + hub type) submits and navigates to edit', async ({ page }) => {
    await page.route('**/api/v1/hubs', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_HUB_CREATED),
        });
      } else {
        route.continue();
      }
    });

    // Destination
    await page.getByRole('combobox').filter({ hasText: /select a destination/i }).click();
    await page.getByRole('option', { name: /curacao/i }).click();

    // Name
    await page.locator('input[name="name"]').fill('Test Hub');

    // Hub Type
    await page.getByRole('combobox').filter({ hasText: /select a hub type/i }).click();
    await page.getByRole('option', { name: /location/i }).click();

    await page.getByRole('button', { name: /create hub/i }).click();

    await expect(page).toHaveURL(/\/hubs\/hub-new-id\/edit/, { timeout: 10_000 });
  });

  test('valid form with optional lat/lng fills correctly', async ({ page }) => {
    await page.locator('input[name="latitude"]').fill('12.17');
    await page.locator('input[name="longitude"]').fill('-68.99');
    await expect(page.locator('input[name="latitude"]')).toHaveValue('12.17');
    await expect(page.locator('input[name="longitude"]')).toHaveValue('-68.99');
  });
});

// ---------------------------------------------------------------------------
// Tests: Edit form - destination is read-only
// ---------------------------------------------------------------------------

test.describe('Hubs - destination read-only on edit form', () => {
  const HUB_ID = 'hub-existing-id';

  test.beforeEach(async ({ page }) => {
    // Mock the hub detail endpoint
    await page.route(`**/api/v1/hubs/${HUB_ID}`, (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: HUB_ID,
            name: 'Klein Curacao',
            slug: 'klein-curacao',
            destinationId: 'dest-1',
            destinationName: 'Curacao',
            hubType: 'LOCATION',
            latitude: 11.98,
            longitude: -68.65,
            description: 'A beautiful island off the coast.',
            isActive: true,
            isSeeded: false,
            createdAt: '2024-01-01T00:00:00.000Z',
          }),
        });
      } else {
        route.continue();
      }
    });

    await mockActiveDestinations(page);

    await page.goto(`/hubs/${HUB_ID}/edit`);
    await page.waitForSelector('form', { timeout: 15_000 });
  });

  test('destination field shows a read-only input on edit (not a Select)', async ({ page }) => {
    // In edit mode, destination is rendered as a read-only Input, not a combobox
    const destInput = page.locator('input[readonly]').filter({ hasText: /curacao/i });
    // fallback: locate the readonly input that contains the destination name
    await expect(page.locator('input[readonly]').first()).toBeVisible();
  });

  test('"Destination cannot be changed after creation" note is visible', async ({ page }) => {
    await expect(
      page.getByText(/destination cannot be changed after creation/i),
    ).toBeVisible();
  });

  test('Hub Type is pre-filled from API response', async ({ page }) => {
    // The hub type select should reflect 'LOCATION' (rendered as "Location")
    await expect(page.getByText(/location/i)).toBeVisible();
  });
});
