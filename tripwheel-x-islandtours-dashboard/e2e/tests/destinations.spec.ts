/**
 * Destinations E2E tests
 *
 * Covers:
 *  - List page load and heading visibility
 *  - Navigation to the create-new page
 *  - Client-side form validation on empty submit
 *  - Row-actions dropdown (View, Edit, Quick Edit items)
 *  - Toggle active/inactive via dropdown (PATCH mock)
 *  - Delete flow: open dialog, confirm, dialog closes (DELETE mock)
 *
 * All list/mutation API calls are intercepted with page.route() so tests run
 * without a live backend. Auth is provided by the global storageState set up
 * in e2e/auth.setup.ts.
 */

import { test, expect } from '../fixtures/index';

test.setTimeout(30_000);

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const MOCK_DESTINATIONS = [
  {
    id: 'test-id-1',
    name: 'Test Destination',
    slug: 'test-destination',
    isActive: true,
    isSeeded: false,
    heroImage: null,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'test-id-2',
    name: 'Another Destination',
    slug: 'another-destination',
    isActive: true,
    isSeeded: false,
    heroImage: null,
    createdAt: '2024-01-02T00:00:00.000Z',
  },
];

const MOCK_LIST_RESPONSE = {
  data: MOCK_DESTINATIONS,
  total: 2,
  page: 1,
  limit: 20,
};

// ---------------------------------------------------------------------------
// Helper: intercept the list API
// ---------------------------------------------------------------------------

async function mockDestinationsList(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/destinations**', (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_LIST_RESPONSE),
      });
    } else {
      route.continue();
    }
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Destinations module', () => {
  test.beforeEach(async ({ page }) => {
    await mockDestinationsList(page);
    await page.goto('/destinations');
    // Wait for the table to render at least one row
    await page.waitForSelector('table', { timeout: 15_000 });
  });

  // -------------------------------------------------------------------------
  // 1. List page loads
  // -------------------------------------------------------------------------
  test('list page renders rows from the API response', async ({ page }) => {
    await expect(page.getByText('Test Destination')).toBeVisible();
    await expect(page.getByText('Another Destination')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 2. Navigation to create page
  // -------------------------------------------------------------------------
  test('navigates to create page when Add Destination is clicked', async ({ page }) => {
    // Two "Add Destination" links exist (sidebar + main content); last() targets the page button
    await page.getByRole('link', { name: /add destination/i }).last().click();
    await expect(page).toHaveURL(/\/destinations\/new/);
    await expect(page.getByRole('button', { name: /create destination/i })).toBeVisible();
  });

  test('create page renders the Name and Slug fields', async ({ page }) => {
    await page.goto('/destinations/new');
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="slug"]')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 3. Form validation - empty submit
  // -------------------------------------------------------------------------
  test('shows validation error when form is submitted empty', async ({ page }) => {
    await page.goto('/destinations/new');
    await page.getByRole('button', { name: /create destination/i }).click();
    await expect(page.getByText(/name must be at least 2 characters/i)).toBeVisible();
  });

  test('slug field auto-generates from name and clears error', async ({ page }) => {
    await page.goto('/destinations/new');
    await page.locator('input[name="name"]').fill('My Test Dest');
    // Slug should auto-generate from name
    await expect(page.locator('input[name="slug"]')).toHaveValue('my-test-dest');
  });

  // -------------------------------------------------------------------------
  // 4. Row-actions dropdown
  // -------------------------------------------------------------------------
  test('opens row-actions menu and shows expected items', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /open menu/i }).first();
    await menuButton.click();

    await expect(page.getByRole('menuitem', { name: /view/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /quick edit/i })).toBeVisible();
  });

  test('row-actions menu shows Manage Translations item', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /open menu/i }).first();
    await menuButton.click();
    await expect(page.getByRole('menuitem', { name: /manage translations/i })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 5. Toggle active/inactive
  // -------------------------------------------------------------------------
  test('clicking Deactivate in dropdown triggers PATCH and shows toast', async ({ page }) => {
    // Mock the PATCH call for the first destination
    await page.route(`**/api/v1/destinations/${MOCK_DESTINATIONS[0].id}`, (route) => {
      if (route.request().method() === 'PATCH') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...MOCK_DESTINATIONS[0], isActive: false }),
        });
      } else {
        route.continue();
      }
    });

    const menuButton = page.getByRole('button', { name: /open menu/i }).first();
    await menuButton.click();

    await page.getByRole('menuitem', { name: /deactivate/i }).click();

    // Toast should confirm the action
    await expect(page.getByText(/deactivated successfully/i)).toBeVisible({ timeout: 5_000 });
  });

  // -------------------------------------------------------------------------
  // 6. Delete flow
  // -------------------------------------------------------------------------
  test('delete flow: opens dialog, confirms, dialog closes', async ({ page }) => {
    // Mock the DELETE (soft-delete / PATCH isActive=false) call
    await page.route(`**/api/v1/destinations/${MOCK_DESTINATIONS[0].id}`, (route) => {
      const method = route.request().method();
      if (method === 'DELETE' || method === 'PATCH') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...MOCK_DESTINATIONS[0], isActive: false }),
        });
      } else {
        route.continue();
      }
    });

    const menuButton = page.getByRole('button', { name: /open menu/i }).first();
    await menuButton.click();

    await page.getByRole('menuitem', { name: /delete/i }).click();

    // AlertDialog should appear with the correct title
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(page.getByText(/deactivate destination/i)).toBeVisible();

    // Confirm deactivation
    await page.getByRole('button', { name: /^deactivate$/i }).click();

    // Dialog should close (no longer visible)
    await expect(page.getByRole('alertdialog')).not.toBeVisible({ timeout: 5_000 });
  });

  test('delete dialog cancel button closes the dialog without mutating', async ({ page }) => {
    let patchCalled = false;
    await page.route(`**/api/v1/destinations/${MOCK_DESTINATIONS[0].id}`, (route) => {
      if (route.request().method() === 'PATCH') {
        patchCalled = true;
      }
      route.continue();
    });

    const menuButton = page.getByRole('button', { name: /open menu/i }).first();
    await menuButton.click();
    await page.getByRole('menuitem', { name: /delete/i }).click();

    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByRole('alertdialog')).not.toBeVisible({ timeout: 5_000 });
    expect(patchCalled).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 7. Quick Edit dialog
  // -------------------------------------------------------------------------
  test('Quick Edit opens a dialog with a Save Changes button', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /open menu/i }).first();
    await menuButton.click();
    await page.getByRole('menuitem', { name: /quick edit/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: /save changes/i })).toBeVisible();
  });
});
