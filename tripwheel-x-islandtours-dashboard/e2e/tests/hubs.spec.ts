/**
 * Hubs E2E tests
 *
 * Covers:
 *  - List page load and heading visibility
 *  - Navigation to the create-new page
 *  - Client-side form validation on empty submit (name + destination required)
 *  - Row-actions dropdown (View, Edit, Quick Edit, Manage Translations items)
 *  - Hubs-specific: Allowed Categories item in dropdown
 *  - Toggle active/inactive via dropdown (PATCH mock)
 *  - Delete flow: open dialog, confirm, dialog closes (DELETE mock)
 *
 * All list/mutation API calls are intercepted with page.route() so tests run
 * without a live backend. The active-destinations endpoint is also mocked so
 * the HubForm destination select can render. Auth is provided by the global
 * storageState set up in e2e/auth.setup.ts.
 */

import { test, expect } from '../fixtures/index';

test.setTimeout(30_000);

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const MOCK_HUBS = [
  {
    id: 'hub-id-1',
    name: 'Test Hub',
    slug: 'test-hub',
    isActive: true,
    isSeeded: false,
    destinationId: 'dest-1',
    destinationName: 'Curacao',
    description: null,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'hub-id-2',
    name: 'Another Hub',
    slug: 'another-hub',
    isActive: true,
    isSeeded: false,
    destinationId: 'dest-1',
    destinationName: 'Curacao',
    description: null,
    createdAt: '2024-01-02T00:00:00.000Z',
  },
];

const MOCK_LIST_RESPONSE = {
  data: MOCK_HUBS,
  total: 2,
  page: 1,
  limit: 20,
};

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function mockHubsList(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/hubs**', (route) => {
    if (route.request().method() === 'GET') {
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

async function mockActiveDestinations(page: import('@playwright/test').Page) {
  // useActiveDestinations calls /api/v1/destinations/active which returns a plain array
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
// Tests
// ---------------------------------------------------------------------------

test.describe('Hubs module', () => {
  test.beforeEach(async ({ page }) => {
    await mockHubsList(page);
    await page.goto('/hubs');
    await page.waitForSelector('table', { timeout: 15_000 });
  });

  // -------------------------------------------------------------------------
  // 1. List page loads
  // -------------------------------------------------------------------------
  test('list page renders rows from the API response', async ({ page }) => {
    await expect(page.getByText('Test Hub')).toBeVisible();
    await expect(page.getByText('Another Hub')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 2. Navigation to create page
  // -------------------------------------------------------------------------
  test('navigates to create page when Add Hub is clicked', async ({ page }) => {
    await mockActiveDestinations(page);
    await page.getByRole('link', { name: /add hub/i }).click();
    await expect(page).toHaveURL(/\/hubs\/new/);
    await expect(page.getByRole('button', { name: /create hub/i })).toBeVisible();
  });

  test('create page renders the Name and Description fields', async ({ page }) => {
    await mockActiveDestinations(page);
    await page.goto('/hubs/new');
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('textarea[name="description"]')).toBeVisible();
  });

  test('create page renders the Destination select', async ({ page }) => {
    await mockActiveDestinations(page);
    await page.goto('/hubs/new');
    // Wait for the destinations to load so the Select replaces the Skeleton
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('combobox')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 3. Form validation - empty submit
  // -------------------------------------------------------------------------
  test('shows validation error when form submitted without destination', async ({ page }) => {
    await mockActiveDestinations(page);
    await page.goto('/hubs/new');
    // Wait for destinations to finish loading so the form is stable before clicking
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /create hub/i }).click();
    await expect(page.getByText(/destination is required/i)).toBeVisible();
  });

  test('shows name validation error when form submitted empty', async ({ page }) => {
    await mockActiveDestinations(page);
    await page.goto('/hubs/new');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /create hub/i }).click();
    await expect(page.getByText(/name must be at least 2 characters/i)).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 4. Row-actions dropdown
  // -------------------------------------------------------------------------
  test('opens row-actions menu and shows expected items', async ({ page }) => {
    await page.getByRole('button', { name: /open menu/i }).first().click();

    await expect(page.getByRole('menuitem', { name: /^view$/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /^edit$/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /quick edit/i })).toBeVisible();
  });

  test('row-actions menu shows Manage Translations and Allowed Categories items', async ({ page }) => {
    await page.getByRole('button', { name: /open menu/i }).first().click();

    await expect(page.getByRole('menuitem', { name: /manage translations/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /allowed categories/i })).toBeVisible();
  });

  test('row-actions menu shows Page Content and Manage FAQs items', async ({ page }) => {
    await page.getByRole('button', { name: /open menu/i }).first().click();

    await expect(page.getByRole('menuitem', { name: /page content/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /manage faqs/i })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 5. Toggle active/inactive
  // -------------------------------------------------------------------------
  test('clicking Deactivate in dropdown triggers PATCH and shows toast', async ({ page }) => {
    await page.route(`**/api/v1/hubs/${MOCK_HUBS[0].id}`, (route) => {
      if (route.request().method() === 'PATCH') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...MOCK_HUBS[0], isActive: false }),
        });
      } else {
        route.continue();
      }
    });

    await page.getByRole('button', { name: /open menu/i }).first().click();
    await page.getByRole('menuitem', { name: /deactivate/i }).click();

    await expect(page.getByText(/deactivated successfully/i)).toBeVisible({ timeout: 5_000 });
  });

  // -------------------------------------------------------------------------
  // 6. Delete flow
  // -------------------------------------------------------------------------
  test('delete flow: opens dialog, confirms, dialog closes', async ({ page }) => {
    await page.route(`**/api/v1/hubs/${MOCK_HUBS[0].id}`, (route) => {
      const method = route.request().method();
      if (method === 'DELETE' || method === 'PATCH') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...MOCK_HUBS[0], isActive: false }),
        });
      } else {
        route.continue();
      }
    });

    await page.getByRole('button', { name: /open menu/i }).first().click();
    await page.getByRole('menuitem', { name: /delete/i }).click();

    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(page.getByText(/deactivate hub/i)).toBeVisible();

    await page.getByRole('button', { name: /^deactivate$/i }).click();

    await expect(page.getByRole('alertdialog')).not.toBeVisible({ timeout: 5_000 });
  });

  test('delete dialog cancel button closes without mutating', async ({ page }) => {
    let mutationCalled = false;
    await page.route(`**/api/v1/hubs/${MOCK_HUBS[0].id}`, (route) => {
      if (['PATCH', 'DELETE'].includes(route.request().method())) {
        mutationCalled = true;
      }
      route.continue();
    });

    await page.getByRole('button', { name: /open menu/i }).first().click();
    await page.getByRole('menuitem', { name: /delete/i }).click();

    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByRole('alertdialog')).not.toBeVisible({ timeout: 5_000 });
    expect(mutationCalled).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 7. Quick Edit dialog
  // -------------------------------------------------------------------------
  test('Quick Edit opens a dialog with a Save Changes button', async ({ page }) => {
    await page.getByRole('button', { name: /open menu/i }).first().click();
    await page.getByRole('menuitem', { name: /quick edit/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: /save changes/i })).toBeVisible();
  });
});
