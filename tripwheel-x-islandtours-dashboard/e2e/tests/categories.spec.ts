/**
 * Categories E2E tests
 *
 * Covers:
 *  - List page load and heading visibility
 *  - Navigation to the create-new page
 *  - Client-side form validation on empty submit
 *  - Row-actions dropdown (View, Edit, Quick Edit, Manage Translations items)
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

const MOCK_CATEGORIES = [
  {
    id: 'cat-id-1',
    name: 'Test Category',
    slug: 'test-category',
    isActive: true,
    isSeeded: false,
    heroImage: null,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'cat-id-2',
    name: 'Another Category',
    slug: 'another-category',
    isActive: true,
    isSeeded: false,
    heroImage: null,
    createdAt: '2024-01-02T00:00:00.000Z',
  },
];

const MOCK_LIST_RESPONSE = {
  data: MOCK_CATEGORIES,
  total: 2,
  page: 1,
  limit: 20,
};

// ---------------------------------------------------------------------------
// Helper: intercept the list API
// ---------------------------------------------------------------------------

async function mockCategoriesList(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/categories**', (route) => {
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Categories module', () => {
  test.beforeEach(async ({ page }) => {
    await mockCategoriesList(page);
    await page.goto('/categories');
    await page.waitForSelector('table', { timeout: 15_000 });
  });

  // -------------------------------------------------------------------------
  // 1. List page loads
  // -------------------------------------------------------------------------
  test('list page renders rows from the API response', async ({ page }) => {
    await expect(page.getByText('Test Category')).toBeVisible();
    await expect(page.getByText('Another Category')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 2. Navigation to create page
  // -------------------------------------------------------------------------
  test('navigates to create page when Add Category is clicked', async ({ page }) => {
    await page.getByRole('link', { name: /add category/i }).click();
    await expect(page).toHaveURL(/\/categories\/new/);
    await expect(page.getByRole('button', { name: /create category/i })).toBeVisible();
  });

  test('create page renders the Name and Slug fields', async ({ page }) => {
    await page.goto('/categories/new');
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="slug"]')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 3. Form validation - empty submit
  // -------------------------------------------------------------------------
  test('shows validation error when form is submitted empty', async ({ page }) => {
    await page.goto('/categories/new');
    await page.getByRole('button', { name: /create category/i }).click();
    await expect(page.getByText(/name must be at least 2 characters/i)).toBeVisible();
  });

  test('slug auto-generates from name', async ({ page }) => {
    await page.goto('/categories/new');
    await page.locator('input[name="name"]').fill('Boat Tours');
    await expect(page.locator('input[name="slug"]')).toHaveValue('boat-tours');
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

  test('row-actions menu shows Manage Translations item', async ({ page }) => {
    await page.getByRole('button', { name: /open menu/i }).first().click();
    await expect(page.getByRole('menuitem', { name: /manage translations/i })).toBeVisible();
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
    await page.route(`**/api/v1/categories/${MOCK_CATEGORIES[0].id}`, (route) => {
      if (route.request().method() === 'PATCH') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...MOCK_CATEGORIES[0], isActive: false }),
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
    await page.route(`**/api/v1/categories/${MOCK_CATEGORIES[0].id}`, (route) => {
      const method = route.request().method();
      if (method === 'DELETE' || method === 'PATCH') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...MOCK_CATEGORIES[0], isActive: false }),
        });
      } else {
        route.continue();
      }
    });

    await page.getByRole('button', { name: /open menu/i }).first().click();
    await page.getByRole('menuitem', { name: /delete/i }).click();

    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(page.getByText(/deactivate category/i)).toBeVisible();

    await page.getByRole('button', { name: /^deactivate$/i }).click();

    await expect(page.getByRole('alertdialog')).not.toBeVisible({ timeout: 5_000 });
  });

  test('delete dialog cancel button closes without mutating', async ({ page }) => {
    let mutationCalled = false;
    await page.route(`**/api/v1/categories/${MOCK_CATEGORIES[0].id}`, (route) => {
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
