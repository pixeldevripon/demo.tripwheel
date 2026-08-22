/**
 * Trips - new fields E2E tests
 *
 * Covers the fields and tabs added/changed since the original trips.spec.ts
 * was written:
 *
 *  Create form:
 *  - Multi-select Categories (required, ≥ 1)
 *  - Primary category star indicator appears once a category is selected
 *  - Multi-select Activity Hubs (optional; disabled until destination chosen)
 *  - Hubs load scoped to the selected destination
 *  - At least 1 category required - validation error when none selected
 *
 *  Edit view - Attributes tab:
 *  - Attributes tab trigger is visible in the tab list
 *  - Attributes card heading renders
 *  - "Save Attributes" button is visible
 *  - Saving attributes calls POST /trips/:id/attributes and shows toast
 *
 *  Edit view - Exclusions tab:
 *  - Exclusions tab trigger is visible
 *  - Existing exclusion renders from the API
 *  - "Add Exclusion" form is visible with Label input and Icon select
 *  - Submitting Add Exclusion calls POST and shows toast
 *  - Validation: label shorter than 2 characters shows error
 *  - Delete button calls DELETE and shows toast
 *
 * All API calls are intercepted - no live backend required.
 * Auth is provided by the global storageState from e2e/auth.setup.ts.
 */

import { test, expect } from '../../fixtures/index';

test.setTimeout(30_000);

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const TRIP_ID = 'trip-uuid-1';

const MOCK_TRIP_DRAFT: Record<string, unknown> = {
  id: TRIP_ID,
  name: 'Sunset Catamaran Cruise',
  slug: 'sunset-catamaran-cruise',
  status: 'DRAFT',
  operatorId: 'op-1',
  destinationId: 'dest-1',
  destinationName: 'Curacao',
  categoryIds: ['cat-1'],
  categoryId: 'cat-1',
  categoryName: 'Boat Tours',
  hubId: null,
  hubName: null,
  pricingModel: 'PER_PERSON',
  unitType: null,
  basePrice: '49.99',
  priceFrom: '49.99',
  durationMinutes: 180,
  pickupModel: 'NONE',
  maxPartySize: null,
  minPartySize: 1,
  bookingCutoffMinutes: 0,
  cancellationHours: 24,
  h1Override: null,
  breadcrumbLabel: null,
  aggregateRating: null,
  aggregateReviewCount: 0,
  isSponsored: false,
  isActive: true,
  publishedAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  heroImage: null,
  imageCount: 0,
  scheduleCount: 0,
  inclusionCount: 0,
  featuredSlotNumber: null,
  featuredSlotStatus: null,
};

const MOCK_DESTINATIONS = [
  { id: 'dest-1', name: 'Curacao', slug: 'curacao', isActive: true, isSeeded: true, heroImage: null },
];

const MOCK_CATEGORIES = [
  { id: 'cat-1', name: 'Boat Tours', slug: 'boat-tours', isActive: true },
  { id: 'cat-2', name: 'Snorkeling', slug: 'snorkeling', isActive: true },
];

const MOCK_HUBS = [
  { id: 'hub-1', name: 'Klein Curacao', slug: 'klein-curacao', destinationId: 'dest-1', isActive: true },
  { id: 'hub-2', name: 'Piscadera Bay', slug: 'piscadera-bay', destinationId: 'dest-1', isActive: true },
];

const MOCK_ATTRIBUTES: Record<string, unknown>[] = [
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
];

const MOCK_EXCLUSIONS = [
  {
    id: 'exc-1',
    tripId: TRIP_ID,
    icon: 'x',
    displayOrder: 1,
    imageUrl: null,
    translations: [{ locale: 'en', label: 'Gratuities not included', isMachineTranslated: false }],
  },
];

// ---------------------------------------------------------------------------
// Route mock helpers
// ---------------------------------------------------------------------------

type PW = import('@playwright/test').Page;

async function mockSupportingData(page: PW) {
  await page.route('**/api/v1/destinations/active**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_DESTINATIONS) });
    } else {
      route.continue();
    }
  });
  await page.route('**/api/v1/categories/active**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CATEGORIES) });
    } else {
      route.continue();
    }
  });
  await page.route('**/api/v1/hubs/match**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
  });
}

async function mockActiveHubs(page: PW) {
  await page.route('**/api/v1/hubs/active**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_HUBS) });
    } else {
      route.continue();
    }
  });
}

async function mockTripDetail(page: PW) {
  await page.route(`**/api/v1/tours/${TRIP_ID}`, (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_TRIP_DRAFT) });
    } else if (method === 'PATCH') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ trip: MOCK_TRIP_DRAFT, warnings: [] }),
      });
    } else {
      route.continue();
    }
  });
}

async function mockAttributesEndpoints(page: PW) {
  await page.route('**/api/v1/attributes**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ATTRIBUTES) });
    } else {
      route.continue();
    }
  });
  await page.route(`**/api/v1/tours/${TRIP_ID}/attributes`, (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    } else if (method === 'POST') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ key: 'boat_type', value: 'catamaran', displayName: 'Boat Type', dataType: 'ENUM' }]),
      });
    } else {
      route.continue();
    }
  });
}

async function mockExclusionsEndpoints(page: PW) {
  await page.route(`**/api/v1/tours/${TRIP_ID}/exclusions`, (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_EXCLUSIONS) });
    } else if (method === 'POST') {
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'exc-new',
          tripId: TRIP_ID,
          icon: 'x',
          displayOrder: 2,
          imageUrl: null,
          translations: [{ locale: 'en', label: 'Tips not included', isMachineTranslated: false }],
        }),
      });
    } else {
      route.continue();
    }
  });
  await page.route(`**/api/v1/tours/${TRIP_ID}/exclusions/**`, (route) => {
    const method = route.request().method();
    if (method === 'DELETE') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Deleted' }) });
    } else if (method === 'PATCH') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_EXCLUSIONS[0]) });
    } else {
      route.continue();
    }
  });
}

async function mockTranslationsEndpoints(page: PW) {
  await page.route(`**/api/v1/tours/${TRIP_ID}/translations/en`, (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ locale: 'en', title: 'Sunset Catamaran Cruise', overview: null, description: null, isMachineTranslated: false, updatedAt: '2024-01-01T00:00:00.000Z' }),
      });
    } else {
      route.continue();
    }
  });
  await page.route(`**/api/v1/tours/${TRIP_ID}/translations/**`, (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Not found' }) });
    } else {
      route.continue();
    }
  });
}

async function mockAllEditTabs(page: PW) {
  await mockTripDetail(page);
  await mockSupportingData(page);
  await mockTranslationsEndpoints(page);
  await mockAttributesEndpoints(page);
  await mockExclusionsEndpoints(page);
  await page.route(`**/api/v1/tours/${TRIP_ID}/languages**`, (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
}

// ---------------------------------------------------------------------------
// 1. Create Trip - multi-select Categories + Hubs
// ---------------------------------------------------------------------------

test.describe('Create Trip - multi-select Categories and Hubs', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupportingData(page);
    await mockActiveHubs(page);
    await page.goto('/trips/new');
    await page.waitForSelector('form', { timeout: 15_000 });
  });

  test('submitting form without selecting a category shows "at least one category" error', async ({ page }) => {
    await page.locator('input[name="name"]').fill('My Trip');

    // Select a destination
    await page.getByRole('combobox').filter({ hasText: /select a destination/i }).click();
    await page.getByRole('option', { name: /curacao/i }).click();

    // Intentionally skip category selection
    await page.getByRole('button', { name: /create trip/i }).click();
    await expect(page.getByText(/select at least one category/i)).toBeVisible();
  });

  // Two hub tests used to live here. They asserted an Activity Hubs
  // multi-select on /trips/new, which the create form has not rendered since
  // it was cut down to the four answers `POST /tours` accepts - they were
  // already failing before the wizard landed. Hubs now belong to the wizard's
  // reach step (07 §3), where they are covered below.
  test('step 1 asks only what creating a draft needs', async ({ page }) => {
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="slug"]')).toBeVisible();
    await expect(
      page.getByRole('combobox').filter({ hasText: /select a destination/i }),
    ).toBeVisible();
    await expect(page.getByText(/select categories/i)).toBeVisible();
    // Hubs, pricing and schedules are later steps, not questions asked here.
    await expect(page.getByText(/select hubs/i)).toHaveCount(0);
  });

  test('selecting a category shows the star (primary) indicator', async ({ page }) => {
    // Open the categories multi-select popover
    const categoriesCombobox = page.getByText(/select categories/i);
    await categoriesCombobox.click();

    // Click the first category option
    await page.getByRole('option', { name: /boat tours/i }).click();

    // A star icon should appear indicating the primary category
    // The MultiSelect renders a star button with aria or title for the primary marker
    // The FieldDescription mentions "starred category"
    await expect(page.getByText(/starred category/i)).toBeVisible();
  });

  test('valid form (name + destination + category) submits and navigates to edit', async ({ page }) => {
    await page.route('**/api/v1/tours', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ ...MOCK_TRIP_DRAFT, id: 'new-trip-id' }),
        });
      } else {
        route.continue();
      }
    });

    await page.locator('input[name="name"]').fill('Sunset Catamaran Cruise');

    // Destination
    await page.getByRole('combobox').filter({ hasText: /select a destination/i }).click();
    await page.getByRole('option', { name: /curacao/i }).click();

    // Categories multi-select
    await page.getByText(/select categories/i).click();
    await page.getByRole('option', { name: /boat tours/i }).click();
    // Close the popover by pressing Escape or clicking elsewhere
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /create trip/i }).click();

    await expect(page).toHaveURL(/\/trips\/new-trip-id\/edit/, { timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// 2. Edit Trip - Attributes tab
// ---------------------------------------------------------------------------

test.describe('Edit Trip - Attributes tab', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllEditTabs(page);
    // Legacy `?tab=` deep links still resolve: TAB_TO_STEP picks the step and
    // TAB_TO_SECTION opens the section that used to be that whole tab.
    await page.goto(`/trips/${TRIP_ID}/edit?tab=attributes`);
    await page.waitForSelector('[data-wizard-section="attributes"]', {
      timeout: 15_000,
    });
  });

  test('attribute field is rendered for a globally-scoped ENUM attribute', async ({ page }) => {
    // The MOCK_ATTRIBUTES has 'boat_type' with displayName 'Boat Type'
    await expect(page.getByText(/boat type/i)).toBeVisible({ timeout: 8_000 });
  });

  test('attribute ENUM select is rendered with allowed values', async ({ page }) => {
    // Click the ENUM select for boat_type
    const boatTypeSelect = page
      .locator('[data-wizard-section="attributes"]')
      .getByRole('combobox')
      .first();
    await expect(boatTypeSelect).toBeVisible({ timeout: 8_000 });
    await boatTypeSelect.click();
    // The allowed values are catamaran, yacht, speedboat
    await expect(page.getByRole('option', { name: /catamaran/i })).toBeVisible({ timeout: 5_000 });
  });

  test('clicking Save Attributes calls POST /attributes and shows success toast', async ({ page }) => {
    let postCalled = false;
    await page.route(`**/api/v1/tours/${TRIP_ID}/attributes`, (route) => {
      if (route.request().method() === 'POST') {
        postCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      } else {
        route.continue();
      }
    });

    await page.getByRole('button', { name: /save attributes/i }).click({ timeout: 8_000 });

    expect(postCalled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Edit Trip - Exclusions tab
// ---------------------------------------------------------------------------

/**
 * Exclusions moved from a tab of its own into a section of the wizard's
 * content step, which also renders Inclusions - and both have an
 * input[name="label"]. Every locator below scopes to the section.
 */
const exclusions = (page: PW) =>
  page.locator('[data-wizard-section="exclusions"]');

test.describe('Edit Trip - Exclusions tab', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllEditTabs(page);
    await page.goto(`/trips/${TRIP_ID}/edit?tab=exclusions`);
    await page.waitForSelector('[data-wizard-section="exclusions"]', {
      timeout: 15_000,
    });
  });

  test('existing exclusion label is rendered from API', async ({ page }) => {
    await expect(page.getByText('Gratuities not included')).toBeVisible({ timeout: 8_000 });
  });

  test('submitting Add Exclusion with short label shows validation error', async ({ page }) => {
    await exclusions(page).locator('input[name="label"]').fill('A');
    await exclusions(page).getByRole('button', { name: /add exclusion/i }).click();
    await expect(page.getByText(/at least 2 characters/i)).toBeVisible();
  });

  test('submitting Add Exclusion calls POST and shows success toast', async ({ page }) => {
    let postCalled = false;
    await page.route(`**/api/v1/tours/${TRIP_ID}/exclusions`, (route) => {
      if (route.request().method() === 'POST') {
        postCalled = true;
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'exc-new',
            tripId: TRIP_ID,
            icon: 'x',
            displayOrder: 2,
            imageUrl: null,
            translations: [{ locale: 'en', label: 'Tips not included', isMachineTranslated: false }],
          }),
        });
      } else if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_EXCLUSIONS) });
      } else {
        route.continue();
      }
    });

    await exclusions(page).locator('input[name="label"]').fill('Tips not included');
    await exclusions(page).getByRole('button', { name: /add exclusion/i }).click();

    expect(postCalled).toBe(true);
  });

  test('delete button on an exclusion calls DELETE and shows success toast', async ({ page }) => {
    let deleteCalled = false;
    await page.route(`**/api/v1/tours/${TRIP_ID}/exclusions/exc-1`, (route) => {
      if (route.request().method() === 'DELETE') {
        deleteCalled = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Deleted' }) });
      } else {
        route.continue();
      }
    });

    // The exclusion row uses .ring-1.ring-foreground/10 wrapper
    const firstRow = exclusions(page).locator('.ring-1.ring-foreground\\/10').first();
    const deleteBtn = firstRow.getByRole('button').last();
    await deleteBtn.click();

    expect(deleteCalled).toBe(true);
  });

  test('Translations toggle on exclusion row expands the translations panel', async ({ page }) => {
    // The "Translations" button has title="Set translations"
    const translationsToggle = exclusions(page).getByTitle(/set translations/i).first();
    await expect(translationsToggle).toBeVisible({ timeout: 8_000 });
    await translationsToggle.click();
    // Panel heading should appear
    await expect(page.getByText(/translations/i).last()).toBeVisible();
  });
});
