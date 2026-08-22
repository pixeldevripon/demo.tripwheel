/**
 * Attributes dictionary E2E tests
 *
 * Covers /attributes (list) and /attributes/new (create),
 * and /attributes/:key/edit (edit).
 *
 *  1. List page
 *     - Page loads with heading
 *     - Renders attribute rows from the API
 *     - "Add Attribute" button navigates to /new
 *     - Edit icon link navigates to the edit page
 *     - Deactivate button opens AlertDialog; confirming calls DELETE and shows toast
 *     - Deactivate dialog cancel closes without mutating
 *
 *  2. Create form (/attributes/new)
 *     - Key input is rendered (snake_case identifier)
 *     - Display Name input is rendered
 *     - Data Type select is rendered with ENUM option visible
 *     - Key validation: invalid format shows error
 *     - Allowed Values field appears when Data Type is ENUM
 *     - Allowed Values field disappears when Data Type is TEXT
 *     - Submitting with ENUM type and no allowed values shows toast error
 *     - Applies To Categories multi-select is rendered
 *     - Filterable and Sortable checkboxes are rendered
 *     - Happy path: valid form submits via POST and navigates back to /attributes
 *
 *  3. Edit form (/attributes/:key/edit)
 *     - Key field is read-only
 *     - Display Name is pre-filled
 *     - Data Type is pre-filled
 *     - Saving calls PATCH and shows success toast
 *
 * API calls are intercepted - no live backend required.
 * Auth is provided by the global storageState from e2e/auth.setup.ts.
 */

import { test, expect } from '../fixtures/index';

test.setTimeout(30_000);

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const MOCK_ATTRIBUTES = [
  {
    id: 'attr-1',
    key: 'boat_type',
    displayName: 'Boat Type',
    dataType: 'ENUM',
    allowedValues: ['catamaran', 'yacht', 'speedboat'],
    appliesToCategories: [],
    isFilterable: true,
    isSortable: false,
    filterDisplayType: null,
    sortOrder: 0,
    isActive: true,
  },
  {
    id: 'attr-2',
    key: 'duration_category',
    displayName: 'Duration Category',
    dataType: 'ENUM',
    allowedValues: ['half-day', 'full-day'],
    appliesToCategories: ['boat-tours'],
    isFilterable: true,
    isSortable: true,
    filterDisplayType: 'RADIO',
    sortOrder: 1,
    isActive: true,
  },
];

const MOCK_CATEGORIES = [
  { id: 'cat-1', name: 'Boat Tours', slug: 'boat-tours', isActive: true },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type PW = import('@playwright/test').Page;

async function mockAttributesList(page: PW) {
  await page.route('**/api/v1/attributes**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ATTRIBUTES),
      });
    } else {
      route.continue();
    }
  });
}

async function mockActiveCategories(page: PW) {
  await page.route('**/api/v1/categories/active**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_CATEGORIES),
      });
    } else {
      route.continue();
    }
  });
}

// ---------------------------------------------------------------------------
// 1. List page
// ---------------------------------------------------------------------------

test.describe('Attributes - list page (/attributes)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAttributesList(page);
    await page.goto('/attributes');
    await page.waitForSelector('table', { timeout: 15_000 });
  });

  test('renders attribute rows from the API', async ({ page }) => {
    await expect(page.getByText('boat_type')).toBeVisible();
    await expect(page.getByText('duration_category')).toBeVisible();
  });

  test('"Global" scope shown for attributes with empty appliesToCategories', async ({ page }) => {
    await expect(page.getByText('Global')).toBeVisible();
  });

  test('"Add Attribute" button is visible and navigates to /new', async ({ page }) => {
    await page.getByRole('link', { name: /add attribute/i }).click();
    await expect(page).toHaveURL(/\/attributes\/new/, { timeout: 5_000 });
  });

  test('edit icon link navigates to the attribute edit page', async ({ page }) => {
    // The pencil link for the first attribute should navigate to /boat_type/edit
    const editLink = page.getByRole('link', { name: '' }).filter({ has: page.locator('svg') }).first();
    await editLink.click();
    await expect(page).toHaveURL(/\/attributes\/boat_type\/edit/, { timeout: 5_000 });
  });

  test('deactivate button opens AlertDialog with attribute name', async ({ page }) => {
    // The trash icon button on the first active attribute
    const trashButtons = page.getByRole('button').filter({ has: page.locator('svg') });
    await trashButtons.last().click();

    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/deactivate attribute/i)).toBeVisible();
  });

  test('deactivate dialog shows the attribute display name and key', async ({ page }) => {
    const trashButtons = page.getByRole('button').filter({ has: page.locator('svg') });
    await trashButtons.last().click();

    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5_000 });
    // AlertDialogDescription contains the displayName and key
    await expect(page.getByText(/boat_type/i)).toBeVisible();
  });

  test('confirming deactivation calls DELETE and shows success toast', async ({ page }) => {
    let deleteCalled = false;
    await page.route('**/api/v1/attributes/duration_category', (route) => {
      if (route.request().method() === 'DELETE') {
        deleteCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Deactivated' }),
        });
      } else {
        route.continue();
      }
    });

    // Click the last trash button (duration_category is second row)
    const trashButtons = page.getByRole('button').filter({ has: page.locator('svg') });
    await trashButtons.last().click();

    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /^deactivate$/i }).click();

    await expect(page.getByText(/attribute deactivated/i)).toBeVisible({ timeout: 5_000 });
    expect(deleteCalled).toBe(true);
  });

  test('deactivate dialog cancel closes without calling DELETE', async ({ page }) => {
    let deleteCalled = false;
    await page.route('**/api/v1/attributes/**', (route) => {
      if (route.request().method() === 'DELETE') deleteCalled = true;
      route.continue();
    });

    const trashButtons = page.getByRole('button').filter({ has: page.locator('svg') });
    await trashButtons.last().click();

    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /cancel/i }).click();

    await expect(page.getByRole('alertdialog')).not.toBeVisible({ timeout: 3_000 });
    expect(deleteCalled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Create form (/attributes/new)
// ---------------------------------------------------------------------------

test.describe('Attributes - create form (/attributes/new)', () => {
  test.beforeEach(async ({ page }) => {
    await mockActiveCategories(page);
    await page.goto('/attributes/new');
    await page.waitForSelector('form', { timeout: 15_000 });
  });

  test('Data Type select contains ENUM option', async ({ page }) => {
    await page.getByRole('combobox').first().click();
    await expect(page.getByRole('option', { name: /^enum$/i })).toBeVisible({ timeout: 5_000 });
  });

  test('key validation: invalid format (camelCase) shows error', async ({ page }) => {
    await page.locator('input[name="key"]').fill('boatType');
    await page.locator('input[name="displayName"]').fill('Boat Type');
    await page.getByRole('button', { name: /create attribute/i }).click();
    await expect(page.getByText(/snake_case/i)).toBeVisible();
  });

  test('key validation: uppercase letters show error', async ({ page }) => {
    await page.locator('input[name="key"]').fill('Boat_type');
    await page.locator('input[name="displayName"]').fill('Boat Type');
    await page.getByRole('button', { name: /create attribute/i }).click();
    await expect(page.getByText(/snake_case/i)).toBeVisible();
  });

  test('Allowed Values field appears when Data Type is ENUM (default)', async ({ page }) => {
    // ENUM is the default data type - Allowed Values should already be visible
    await expect(page.locator('input[name="allowedValues"]')).toBeVisible();
  });

  test('Allowed Values field disappears when Data Type is TEXT', async ({ page }) => {
    // Change data type to TEXT
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: /^text$/i }).click();

    await expect(page.locator('input[name="allowedValues"]')).not.toBeVisible({ timeout: 3_000 });
  });

  test('submitting ENUM type with no allowed values shows toast error', async ({ page }) => {
    await page.locator('input[name="key"]').fill('boat_type');
    await page.locator('input[name="displayName"]').fill('Boat Type');
    // Allowed Values left empty; data type stays ENUM
    await page.getByRole('button', { name: /create attribute/i }).click();
    await expect(page.getByText(/allowed values are required for enum/i)).toBeVisible({ timeout: 5_000 });
  });

  test('happy path: valid form submits via POST and navigates back to /attributes', async ({ page }) => {
    await page.route('**/api/v1/attributes', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'attr-new',
            key: 'boat_type',
            displayName: 'Boat Type',
            dataType: 'ENUM',
            allowedValues: ['catamaran', 'yacht'],
            appliesToCategories: [],
            isFilterable: true,
            isSortable: false,
            filterDisplayType: null,
            sortOrder: 0,
            isActive: true,
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.locator('input[name="key"]').fill('boat_type');
    await page.locator('input[name="displayName"]').fill('Boat Type');
    await page.locator('input[name="allowedValues"]').fill('catamaran, yacht');

    await page.getByRole('button', { name: /create attribute/i }).click();

    await expect(page.getByText(/attribute created/i)).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/attributes$/, { timeout: 8_000 });
  });
});

// ---------------------------------------------------------------------------
// 3. Edit form (/attributes/:key/edit)
// ---------------------------------------------------------------------------

test.describe('Attributes - edit form (/attributes/boat_type/edit)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/attributes/boat_type', (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_ATTRIBUTES[0]),
        });
      } else if (method === 'PATCH') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...MOCK_ATTRIBUTES[0], displayName: 'Boat Category' }),
        });
      } else {
        route.continue();
      }
    });

    await mockActiveCategories(page);
    await mockAttributesList(page);

    await page.goto('/attributes/boat_type/edit');
    await page.waitForSelector('form', { timeout: 15_000 });
  });

  test('Key field is read-only (not editable) on edit form', async ({ page }) => {
    // In edit mode, the key is rendered as a readonly Input (not the register'd input)
    const keyInput = page.locator('input[readonly]').first();
    await expect(keyInput).toBeVisible();
    await expect(keyInput).toHaveValue('boat_type');
  });

  test('"Key cannot be changed." description is shown', async ({ page }) => {
    await expect(page.getByText(/key cannot be changed/i)).toBeVisible();
  });

  test('Display Name is pre-filled from API', async ({ page }) => {
    await expect(page.locator('input[name="displayName"]')).toHaveValue('Boat Type');
  });

  test('Allowed Values field is pre-filled from API', async ({ page }) => {
    // ENUM type, allowedValues = ['catamaran', 'yacht', 'speedboat']
    await expect(page.locator('input[name="allowedValues"]')).toHaveValue(/catamaran/);
  });

  test('updating Display Name and saving calls PATCH and shows success toast', async ({ page }) => {
    let patchCalled = false;
    await page.route('**/api/v1/attributes/boat_type', (route) => {
      if (route.request().method() === 'PATCH') {
        patchCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...MOCK_ATTRIBUTES[0], displayName: 'Boat Category' }),
        });
      } else if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ATTRIBUTES[0]) });
      } else {
        route.continue();
      }
    });

    await page.locator('input[name="displayName"]').fill('Boat Category');
    await page.getByRole('button', { name: /save changes/i }).click();

    await expect(page.getByText(/attribute updated/i)).toBeVisible({ timeout: 5_000 });
    expect(patchCalled).toBe(true);
  });
});
