/**
 * Collections E2E tests
 *
 * Covers /collections (list) and /collections/new (create),
 * plus the edit view sub-tabs.
 *
 *  1. List page (/collections)
 *     - Page loads with "Collections" heading
 *     - Destination picker select is rendered
 *     - Renders collection rows after destination is selected
 *     - "Add Collection" button navigates to /new
 *     - Edit icon link navigates to the edit page
 *     - Deactivate button opens AlertDialog; confirming calls DELETE and shows toast
 *     - Deactivate dialog cancel closes without mutating
 *
 *  2. Create form - MANUAL (/collections/new)
 *     - Destination Select is required: empty submit shows error
 *     - Name input is rendered
 *     - Slug auto-generates from name
 *     - Collection Type select defaults to "Manual"
 *     - Category-slug warning banner appears when slug matches a category slug
 *     - Create button is disabled when slug matches category slug
 *     - Tours multi-select is disabled until destination is chosen
 *     - Selecting destination enables the tours multi-select
 *     - MANUAL type with no tours selected shows toast error
 *     - Happy path: valid MANUAL form submits via POST and navigates to /collections
 *
 *  3. Create form - DYNAMIC
 *     - Switching type to DYNAMIC shows Filter Query section
 *     - Filter Query section has Category select, Min/Max Price, Duration, Rating
 *     - Happy path: valid DYNAMIC form submits via POST
 *
 *  4. Edit view sub-tabs
 *     - Edit page renders Translations tab
 *     - Edit page renders Page Content tab
 *     - Edit page renders FAQ tab
 *
 * API calls are intercepted - no live backend required.
 * Auth is provided by the global storageState from e2e/auth.setup.ts.
 */

import { test, expect } from '../fixtures/index';

test.setTimeout(30_000);

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const COLLECTION_ID = 'col-id-1';

const MOCK_DESTINATIONS = [
  { id: 'dest-1', name: 'Curacao', slug: 'curacao', isActive: true, isSeeded: true, heroImage: null },
];

const MOCK_CATEGORIES = [
  { id: 'cat-1', name: 'Boat Tours', slug: 'boat-tours', isActive: true },
];

const MOCK_TRIPS = {
  data: [
    { id: 'trip-1', name: 'Sunset Cruise', slug: 'sunset-cruise', destinationId: 'dest-1', status: 'LIVE' },
    { id: 'trip-2', name: 'Glass Bottom Boat', slug: 'glass-bottom-boat', destinationId: 'dest-1', status: 'LIVE' },
  ],
  total: 2,
  page: 1,
  limit: 100,
};

const MOCK_COLLECTIONS = [
  {
    id: COLLECTION_ID,
    name: 'Best Boat Trips',
    slug: 'best-boat-trips',
    destinationId: 'dest-1',
    destinationSlug: 'curacao',
    collectionType: 'MANUAL',
    tourIds: ['trip-1'],
    heroImage: null,
    sortOrder: 'recommended',
    filterQuery: null,
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'col-id-2',
    name: 'Dynamic Snorkel Tours',
    slug: 'dynamic-snorkel-tours',
    destinationId: 'dest-1',
    destinationSlug: 'curacao',
    collectionType: 'DYNAMIC',
    tourIds: [],
    heroImage: null,
    sortOrder: 'recommended',
    filterQuery: { categoryId: 'cat-1' },
    isActive: true,
    createdAt: '2024-01-02T00:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type PW = import('@playwright/test').Page;

async function mockActiveDestinations(page: PW) {
  await page.route('**/api/v1/destinations/active**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_DESTINATIONS) });
    } else {
      route.continue();
    }
  });
}

async function mockActiveCategories(page: PW) {
  await page.route('**/api/v1/categories/active**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CATEGORIES) });
    } else {
      route.continue();
    }
  });
}

async function mockAdminTrips(page: PW) {
  await page.route('**/api/v1/tours/admin/all**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_TRIPS) });
    } else {
      route.continue();
    }
  });
}

async function mockCollectionsByDestination(page: PW) {
  await page.route('**/api/v1/collections/admin/all**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_COLLECTIONS) });
    } else {
      route.continue();
    }
  });
}

async function mockCollectionDetail(page: PW) {
  await page.route(`**/api/v1/collections/${COLLECTION_ID}`, (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_COLLECTIONS[0]) });
    } else if (method === 'PATCH') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_COLLECTIONS[0]) });
    } else {
      route.continue();
    }
  });
}

// ---------------------------------------------------------------------------
// 1. List page
// ---------------------------------------------------------------------------

test.describe('Collections - list page (/collections)', () => {
  test.beforeEach(async ({ page }) => {
    await mockActiveDestinations(page);
    await mockCollectionsByDestination(page);
    await page.goto('/collections');
    await page.waitForLoadState('networkidle');
  });

  test('renders collection rows from the API', async ({ page }) => {
    await expect(page.getByText('Best Boat Trips')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('Dynamic Snorkel Tours')).toBeVisible({ timeout: 8_000 });
  });

  test('"Add Collection" button is visible and navigates to /new', async ({ page }) => {
    await page.getByRole('link', { name: /add collection/i }).click();
    await expect(page).toHaveURL(/\/collections\/new/, { timeout: 5_000 });
  });

  test('edit icon navigates to the collection edit page', async ({ page }) => {
    const editLink = page.getByRole('link', { name: '' }).filter({ has: page.locator('svg') }).first();
    await editLink.click();
    await expect(page).toHaveURL(/\/collections\/col-id-1\/edit/, { timeout: 5_000 });
  });

  test('deactivate button opens AlertDialog', async ({ page }) => {
    const trashButtons = page.getByRole('button').filter({ has: page.locator('svg') });
    await trashButtons.last().click();
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/deactivate collection/i)).toBeVisible();
  });

  test('confirming deactivation calls DELETE and shows toast', async ({ page }) => {
    let deleteCalled = false;
    await page.route(`**/api/v1/collections/${COLLECTION_ID}`, (route) => {
      if (route.request().method() === 'DELETE') {
        deleteCalled = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Deactivated' }) });
      } else {
        route.continue();
      }
    });

    const trashButtons = page.getByRole('button').filter({ has: page.locator('svg') });
    await trashButtons.first().click();

    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /^deactivate$/i }).click();

    await expect(page.getByText(/collection deactivated/i)).toBeVisible({ timeout: 5_000 });
    expect(deleteCalled).toBe(true);
  });

  test('deactivate dialog cancel closes without mutating', async ({ page }) => {
    let deleteCalled = false;
    await page.route('**/api/v1/collections/**', (route) => {
      if (route.request().method() === 'DELETE') deleteCalled = true;
      route.continue();
    });

    const trashButtons = page.getByRole('button').filter({ has: page.locator('svg') });
    await trashButtons.first().click();

    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByRole('alertdialog')).not.toBeVisible({ timeout: 3_000 });
    expect(deleteCalled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Create form - MANUAL type
// ---------------------------------------------------------------------------

test.describe('Collections - create form MANUAL type (/collections/new)', () => {
  test.beforeEach(async ({ page }) => {
    await mockActiveDestinations(page);
    await mockActiveCategories(page);
    await mockAdminTrips(page);
    await page.goto('/collections/new');
    await page.waitForSelector('form', { timeout: 15_000 });
    await page.waitForLoadState('networkidle');
  });

  test('submitting without destination shows "Destination is required" error', async ({ page }) => {
    await page.locator('input[name="name"]').fill('My Collection');
    await page.getByRole('button', { name: /create collection/i }).click();
    await expect(page.getByText(/destination is required/i)).toBeVisible();
  });

  test('slug auto-generates from name', async ({ page }) => {
    await page.locator('input[name="name"]').fill('Best Boat Trips');
    await expect(page.locator('input[name="slug"]')).toHaveValue('best-boat-trips');
  });

  test('Collection Type select defaults to MANUAL', async ({ page }) => {
    // The select should show "Manual" as the selected value
    await expect(page.getByText(/manual/i).first()).toBeVisible();
  });

  test('category-slug warning banner appears when slug matches a category slug', async ({ page }) => {
    // 'boat-tours' is a category slug in MOCK_CATEGORIES
    await page.locator('input[name="name"]').fill('Boat Tours');
    // slug auto-generates to 'boat-tours' - matches a category slug
    await expect(page.locator('input[name="slug"]')).toHaveValue('boat-tours');
    await expect(page.getByText(/this slug matches a category slug/i)).toBeVisible({ timeout: 5_000 });
  });

  test('Create button is disabled when slug matches category slug', async ({ page }) => {
    await page.locator('input[name="name"]').fill('Boat Tours');
    await expect(page.locator('input[name="slug"]')).toHaveValue('boat-tours');
    await expect(page.getByRole('button', { name: /create collection/i })).toBeDisabled({ timeout: 5_000 });
  });

  test('Tours multi-select placeholder shows "Select a destination first" before destination chosen', async ({ page }) => {
    await expect(page.getByText(/select a destination first/i)).toBeVisible();
  });

  test('selecting destination enables the Tours multi-select', async ({ page }) => {
    await page.getByRole('combobox').filter({ hasText: /select a destination/i }).click();
    await page.getByRole('option', { name: /curacao/i }).click();
    // After selecting destination, placeholder should change
    await expect(page.getByText(/select tours/i)).toBeVisible({ timeout: 5_000 });
  });

  test('submitting MANUAL type with no tours selected shows toast error', async ({ page }) => {
    await page.getByRole('combobox').filter({ hasText: /select a destination/i }).click();
    await page.getByRole('option', { name: /curacao/i }).click();

    await page.locator('input[name="name"]').fill('My Manual Collection');
    // Do not select any tours
    await page.getByRole('button', { name: /create collection/i }).click();

    await expect(page.getByText(/manual collection needs at least one tour/i)).toBeVisible({ timeout: 5_000 });
  });

  test('happy path: valid MANUAL form submits via POST and navigates to /collections', async ({ page }) => {
    await page.route('**/api/v1/collections', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ ...MOCK_COLLECTIONS[0], id: 'new-col-id' }),
        });
      } else {
        route.continue();
      }
    });

    // Pick destination
    await page.getByRole('combobox').filter({ hasText: /select a destination/i }).click();
    await page.getByRole('option', { name: /curacao/i }).click();

    // Fill name
    await page.locator('input[name="name"]').fill('New Collection');

    // Select a tour from the multi-select
    await page.getByText(/select tours/i).click();
    await page.getByRole('option', { name: /sunset cruise/i }).click();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /create collection/i }).click();

    await expect(page.getByText(/collection created/i)).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/collections$/, { timeout: 8_000 });
  });
});

// ---------------------------------------------------------------------------
// 3. Create form - DYNAMIC type
// ---------------------------------------------------------------------------

test.describe('Collections - create form DYNAMIC type', () => {
  test.beforeEach(async ({ page }) => {
    await mockActiveDestinations(page);
    await mockActiveCategories(page);
    await mockAdminTrips(page);
    await page.goto('/collections/new');
    await page.waitForSelector('form', { timeout: 15_000 });
    await page.waitForLoadState('networkidle');

    // Switch collection type to DYNAMIC
    await page.getByRole('combobox').filter({ hasText: /manual/i }).click();
    await page.getByRole('option', { name: /dynamic/i }).click();
  });

  test('switching to DYNAMIC shows Filter Query section', async ({ page }) => {
    await expect(page.getByText(/filter query/i)).toBeVisible({ timeout: 5_000 });
  });

  test('Filter Query section has Category select', async ({ page }) => {
    await expect(page.getByText(/^category$/i)).toBeVisible({ timeout: 5_000 });
  });

  test('Filter Query section has Min Price input', async ({ page }) => {
    await expect(page.locator('input[name="minPrice"]')).toBeVisible();
  });

  test('Filter Query section has Max Price input', async ({ page }) => {
    await expect(page.locator('input[name="maxPrice"]')).toBeVisible();
  });

  test('Filter Query section has Min Duration input', async ({ page }) => {
    await expect(page.locator('input[name="durationMin"]')).toBeVisible();
  });

  test('Filter Query section has Max Duration input', async ({ page }) => {
    await expect(page.locator('input[name="durationMax"]')).toBeVisible();
  });

  test('Filter Query section has Min Rating input', async ({ page }) => {
    await expect(page.locator('input[name="ratingMin"]')).toBeVisible();
  });

  test('happy path: valid DYNAMIC form submits via POST and navigates to /collections', async ({ page }) => {
    await page.route('**/api/v1/collections', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ ...MOCK_COLLECTIONS[1], id: 'dynamic-col-id' }),
        });
      } else {
        route.continue();
      }
    });

    // Pick destination
    await page.getByRole('combobox').filter({ hasText: /select a destination/i }).click();
    await page.getByRole('option', { name: /curacao/i }).click();

    // Fill name
    await page.locator('input[name="name"]').fill('Dynamic Snorkel Tours');

    // Set a min price filter
    await page.locator('input[name="minPrice"]').fill('20');

    await page.getByRole('button', { name: /create collection/i }).click();

    await expect(page.getByText(/collection created/i)).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/collections$/, { timeout: 8_000 });
  });
});

// ---------------------------------------------------------------------------
// 4. Edit view sub-tabs
// ---------------------------------------------------------------------------

test.describe('Collections - edit view sub-tabs', () => {
  test.beforeEach(async ({ page }) => {
    await mockActiveDestinations(page);
    await mockActiveCategories(page);
    await mockAdminTrips(page);
    await mockCollectionDetail(page);

    // Mock translations
    await page.route(`**/api/v1/collections/${COLLECTION_ID}/translations**`, (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      } else {
        route.continue();
      }
    });

    // Mock page content
    await page.route(`**/api/v1/collections/${COLLECTION_ID}/page-content**`, (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ locale: 'en', overview: null, content: null }),
        });
      } else {
        route.continue();
      }
    });

    // Mock FAQs
    await page.route(`**/api/v1/collections/${COLLECTION_ID}/faqs**`, (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      } else {
        route.continue();
      }
    });

    await page.goto(`/collections/${COLLECTION_ID}/edit`);
    await page.waitForSelector('form', { timeout: 15_000 });
  });

  test('edit form renders name pre-filled from API', async ({ page }) => {
    await expect(page.locator('input[name="name"]')).toHaveValue('Best Boat Trips', { timeout: 8_000 });
  });

  test('slug is read-only on edit form', async ({ page }) => {
    const slugInput = page.locator('input[readonly]');
    await expect(slugInput).toBeVisible();
    await expect(slugInput).toHaveValue('best-boat-trips');
  });

  test('"Slug cannot be changed after creation" note is visible', async ({ page }) => {
    await expect(page.getByText(/slug cannot be changed after creation/i)).toBeVisible();
  });

  test('collection type is read-only on edit form', async ({ page }) => {
    // In edit mode the type is a readonly Input
    await expect(page.getByText(/type cannot be changed after creation/i)).toBeVisible();
  });

  test('navigating to Translations page renders the translations view', async ({ page }) => {
    await page.getByRole('link', { name: /translations/i }).click();
    await expect(page).toHaveURL(new RegExp(`/collections/${COLLECTION_ID}/translations`), { timeout: 5_000 });
  });

  test('navigating to Page Content page renders the page-content view', async ({ page }) => {
    await page.getByRole('link', { name: /page content/i }).click();
    await expect(page).toHaveURL(new RegExp(`/collections/${COLLECTION_ID}/page-content`), { timeout: 5_000 });
  });

  test('navigating to FAQs page renders the faqs view', async ({ page }) => {
    await page.getByRole('link', { name: /faqs/i }).click();
    await expect(page).toHaveURL(new RegExp(`/collections/${COLLECTION_ID}/faqs`), { timeout: 5_000 });
  });
});
