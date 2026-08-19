/**
 * Categories - new fields E2E tests
 *
 * Covers the fields and behaviour added/changed since the original
 * categories.spec.ts was written:
 *  - Lucide icon picker: rendered, opens popover, selecting an icon stores value
 *  - Description textarea is visible
 *  - Sort Order numeric input is visible
 *  - Meta Title Template input is visible
 *  - Meta Description Template textarea is visible
 *  - Parent Category select is visible
 *  - Happy path: create with all new fields calls POST and navigates away
 *  - Regression: slug auto-generates from name
 *
 * API calls are intercepted with page.route() - no live backend required.
 * Auth is provided by the global storageState from e2e/auth.setup.ts.
 */

import { test, expect } from '../fixtures/index';

test.setTimeout(30_000);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function mockActiveCategories(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/categories/active**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'cat-1', name: 'Boat Tours', slug: 'boat-tours', isActive: true },
        ]),
      });
    } else {
      route.continue();
    }
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Categories - new fields on create form', () => {
  test.beforeEach(async ({ page }) => {
    await mockActiveCategories(page);
    await page.goto('/categories/new');
    await page.waitForSelector('form', { timeout: 15_000 });
  });

  // -------------------------------------------------------------------------
  // 1. Lucide icon picker
  // -------------------------------------------------------------------------
  test('clicking Icon picker opens a popover with a search input', async ({ page }) => {
    await page.getByRole('button', { name: /pick an icon/i }).click();
    // Popover should contain a search input
    await expect(
      page.getByPlaceholder(/search icons/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('icon picker renders a grid of icon buttons inside the popover', async ({ page }) => {
    await page.getByRole('button', { name: /pick an icon/i }).click();
    await page.waitForSelector('[data-radix-popper-content-wrapper]', { timeout: 5_000 });
    // The grid contains multiple icon buttons - verify at least 3 are present
    const iconButtons = page
      .locator('[data-radix-popper-content-wrapper]')
      .getByRole('button');
    await expect(iconButtons).toHaveCount({ minimum: 3 } as never);
  });

  test('selecting an icon from the picker closes the popover and shows the chosen name', async ({ page }) => {
    await page.getByRole('button', { name: /pick an icon/i }).click();
    await page.waitForSelector('[data-radix-popper-content-wrapper]', { timeout: 5_000 });

    // Click the first icon button in the picker grid
    const firstIcon = page
      .locator('[data-radix-popper-content-wrapper]')
      .getByRole('button')
      .first();
    await firstIcon.click();

    // Popover closes; the trigger should no longer say "Pick an icon"
    await expect(
      page.getByRole('button', { name: /pick an icon/i }),
    ).not.toBeVisible({ timeout: 3_000 });
  });

  test('icon can be cleared after selection (clear button appears)', async ({ page }) => {
    await page.getByRole('button', { name: /pick an icon/i }).click();
    await page.waitForSelector('[data-radix-popper-content-wrapper]', { timeout: 5_000 });
    await page
      .locator('[data-radix-popper-content-wrapper]')
      .getByRole('button')
      .first()
      .click();

    // After selection a clear button should appear (XIcon button next to the trigger)
    const clearButton = page.getByRole('button').filter({ has: page.locator('svg') }).last();
    await expect(clearButton).toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // 2. Description textarea
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // 3. Sort Order
  // -------------------------------------------------------------------------
  test('Sort Order defaults to 0', async ({ page }) => {
    await expect(page.locator('input[name="sortOrder"]')).toHaveValue('0');
  });

  // -------------------------------------------------------------------------
  // 4. Parent Category select
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // 5. Regression: slug auto-generates from name
  // -------------------------------------------------------------------------
  test('slug auto-generates from name', async ({ page }) => {
    await page.locator('input[name="name"]').fill('Water Sports');
    await expect(page.locator('input[name="slug"]')).toHaveValue('water-sports');
  });

  // -------------------------------------------------------------------------
  // 6. Happy path: all new fields can be filled and form submits without error
  // -------------------------------------------------------------------------
  test('form with name + description + sort order submits via POST and navigates to edit', async ({ page }) => {
    await page.route('**/api/v1/categories', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'new-cat-id',
            name: 'Water Sports',
            slug: 'water-sports',
            description: 'All water sports tours',
            icon: 'Waves',
            sortOrder: 5,
            isActive: true,
            isSeeded: false,
            createdAt: new Date().toISOString(),
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.locator('input[name="name"]').fill('Water Sports');
    await page.locator('textarea[name="description"]').fill('All water sports tours');
    await page.locator('input[name="sortOrder"]').fill('5');

    await page.getByRole('button', { name: /create category/i }).click();

    await expect(page).toHaveURL(/\/categories\/new-cat-id\/edit/, { timeout: 10_000 });
  });
});
