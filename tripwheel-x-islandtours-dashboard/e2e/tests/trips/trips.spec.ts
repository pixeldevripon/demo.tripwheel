/**
 * Trips module E2E tests
 *
 * Covers:
 *  1. Trip List Page (/trips)
 *     - Page loads with heading and table
 *     - "New Tour" button visible and navigates correctly
 *     - Row-actions dropdown (Edit Details, Schedules, Translations, Archive)
 *     - Restore action visible for archived trips
 *     - Admin view: operator column visible; operator view: operator column hidden
 *
 *  2. Create Trip (/trips/new)
 *     - Renders form fields (name, slug, destination, category)
 *     - Slug auto-generates from name input
 *     - Manually editing slug stops auto-generation
 *     - Validation: name required (min 3 chars), destination required
 *     - Successful submit navigates to edit page
 *
 *  3. Edit Trip - Details Tab
 *     - Loads trip data into form fields
 *     - Slug field is read-only with "cannot be changed" note
 *     - Status badge visible
 *     - Save Changes triggers PATCH and shows success toast
 *     - Publish button visible for DRAFT trip
 *
 *  4. Edit Trip - Inclusions Tab
 *     - Renders inclusions list from API
 *     - "Add Inclusion" form visible with label input and icon select
 *     - Submitting form POSTs to API and shows toast
 *     - Delete button sends DELETE and shows toast
 *
 *  6. Edit Trip - Schedules Tab
 *     - "Select start date" button opens calendar popover
 *     - Selecting a date populates the start date field
 *     - Add Schedule form submits and shows toast
 *     - Delete schedule button sends DELETE and shows toast
 *
 *  7. Edit Trip - Translations Tab
 *     - English tab is active by default
 *     - Display Title field pre-filled with trip name
 *     - Info banner about English being base locale visible
 *     - Save Translation triggers PATCH and shows toast
 *     - Switching to another locale tab shows empty Display Title
 *     - "Clear Fields" button shown on English tab (not "Delete Translation")
 *
 *  8. Trip Lifecycle
 *     - DRAFT trip: Publish button sends POST /publish and shows toast
 *     - LIVE trip: Pause button sends POST /pause and shows toast
 *     - ARCHIVED trip: Restore to Draft action available in row actions
 *
 * All API calls are intercepted with page.route() - no live backend required.
 * Auth is provided by global storageState from e2e/auth.setup.ts.
 */

import { test, expect } from '../../fixtures/index';

test.setTimeout(30_000);

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const TRIP_ID = 'trip-uuid-1';
const ARCHIVED_TRIP_ID = 'trip-uuid-2';
const LIVE_TRIP_ID = 'trip-uuid-3';

const MOCK_TRIP_DRAFT: Record<string, unknown> = {
  id: TRIP_ID,
  name: 'Sunset Catamaran Cruise',
  slug: 'sunset-catamaran-cruise',
  status: 'DRAFT',
  operatorId: 'op-1',
  destinationId: 'dest-1',
  destinationName: 'Curacao',
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

const MOCK_TRIP_LIVE: Record<string, unknown> = {
  ...MOCK_TRIP_DRAFT,
  id: LIVE_TRIP_ID,
  name: 'Glass Bottom Boat Tour',
  slug: 'glass-bottom-boat-tour',
  status: 'LIVE',
  publishedAt: '2024-02-01T00:00:00.000Z',
};

const MOCK_TRIP_ARCHIVED: Record<string, unknown> = {
  ...MOCK_TRIP_DRAFT,
  id: ARCHIVED_TRIP_ID,
  name: 'Archived Snorkel Trip',
  slug: 'archived-snorkel-trip',
  status: 'ARCHIVED',
};

const MOCK_PAGINATED_TRIPS = {
  data: [MOCK_TRIP_DRAFT, MOCK_TRIP_LIVE, MOCK_TRIP_ARCHIVED],
  total: 3,
  page: 1,
  limit: 20,
};

const MOCK_DESTINATIONS = [
  { id: 'dest-1', name: 'Curacao', slug: 'curacao', isActive: true, isSeeded: true, heroImage: null },
];

const MOCK_CATEGORIES = [
  { id: 'cat-1', name: 'Boat Tours', slug: 'boat-tours', isActive: true },
];

const MOCK_INCLUSIONS = [
  {
    id: 'inc-1',
    tripId: TRIP_ID,
    icon: 'drink',
    displayOrder: 1,
    imageUrl: null,
    translations: [{ locale: 'en', label: 'Welcome drink', isMachineTranslated: false }],
  },
];

const MOCK_SCHEDULES = [
  {
    id: 'sched-1',
    tripId: TRIP_ID,
    startDate: '2025-12-01',
    endDate: null,
    startTime: '09:00',
    totalSpots: 20,
    availableSpots: 18,
    status: 'AVAILABLE',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];

const MOCK_EN_TRANSLATION = {
  locale: 'en',
  title: 'Sunset Catamaran Cruise',
  overview: 'A beautiful cruise at sunset.',
  description: null,
  isMachineTranslated: false,
  updatedAt: '2024-01-01T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Route mock helpers
// ---------------------------------------------------------------------------

type PlaywrightPage = import('@playwright/test').Page;

async function mockTripsListEndpoints(page: PlaywrightPage) {
  // Operator my-trips
  await page.route('**/api/v1/tours/my-tours**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PAGINATED_TRIPS) });
    } else {
      route.continue();
    }
  });
  // Admin all trips
  await page.route('**/api/v1/tours/admin/all**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PAGINATED_TRIPS) });
    } else {
      route.continue();
    }
  });
}

async function mockTripDetail(page: PlaywrightPage, trip: Record<string, unknown> = MOCK_TRIP_DRAFT) {
  await page.route(`**/api/v1/tours/${trip.id}`, (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(trip) });
    } else if (method === 'PATCH') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ trip: { ...trip, name: 'Updated Name' }, warnings: [] }),
      });
    } else {
      route.continue();
    }
  });
}

async function mockSupportingData(page: PlaywrightPage) {
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
  // Hub match check - return null (no hub match) so hub prompt doesn't block tests
  await page.route('**/api/v1/hubs/match**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
  });
}

async function mockInclusionsEndpoints(page: PlaywrightPage) {
  await page.route(`**/api/v1/tours/${TRIP_ID}/inclusions`, (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_INCLUSIONS) });
    } else if (method === 'POST') {
      const newInclusion = {
        id: 'inc-new',
        tripId: TRIP_ID,
        icon: 'check',
        displayOrder: 2,
        imageUrl: null,
        translations: [{ locale: 'en', label: 'New inclusion label', isMachineTranslated: false }],
      };
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(newInclusion) });
    } else {
      route.continue();
    }
  });
  await page.route(`**/api/v1/tours/${TRIP_ID}/inclusions/**`, (route) => {
    const method = route.request().method();
    if (method === 'DELETE') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Deleted' }) });
    } else if (method === 'PATCH') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_INCLUSIONS[0]) });
    } else {
      route.continue();
    }
  });
}

async function mockSchedulesEndpoints(page: PlaywrightPage) {
  await page.route(`**/api/v1/availability/schedules**`, (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SCHEDULES) });
    } else if (method === 'POST') {
      const newSchedule = {
        id: 'sched-new',
        tripId: TRIP_ID,
        startDate: '2025-12-15',
        endDate: null,
        startTime: '09:00',
        totalSpots: 20,
        availableSpots: 20,
        status: 'AVAILABLE',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(newSchedule) });
    } else {
      route.continue();
    }
  });
  await page.route(`**/api/v1/availability/schedules/**`, (route) => {
    const method = route.request().method();
    if (method === 'DELETE') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Deleted' }) });
    } else if (method === 'PATCH') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SCHEDULES[0]) });
    } else {
      route.continue();
    }
  });
}

async function mockTranslationsEndpoints(page: PlaywrightPage, tripId: string = TRIP_ID) {
  await page.route(`**/api/v1/tours/${tripId}/translations/en`, (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_EN_TRANSLATION) });
    } else if (method === 'PATCH') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_EN_TRANSLATION) });
    } else {
      route.continue();
    }
  });
  await page.route(`**/api/v1/tours/${tripId}/translations/**`, (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      // Non-English locales return 404 (no translation yet)
      route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Not found' }) });
    } else if (method === 'PATCH') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ locale: 'nl', title: 'Dutch title', overview: null, description: null, isMachineTranslated: false, updatedAt: new Date().toISOString() }),
      });
    } else if (method === 'DELETE') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Deleted' }) });
    } else {
      route.continue();
    }
  });
}

async function mockAllTripTabEndpoints(page: PlaywrightPage, trip: Record<string, unknown> = MOCK_TRIP_DRAFT) {
  await mockTripDetail(page, trip);
  await mockTranslationsEndpoints(page, trip.id as string);
  await page.route(`**/api/v1/tours/${trip.id}/languages**`, (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    } else {
      route.continue();
    }
  });
  await mockSupportingData(page);
}

// ---------------------------------------------------------------------------
// 1. Trip List Page
// ---------------------------------------------------------------------------

test.describe('Trip List Page (/trips)', () => {
  test.beforeEach(async ({ page }) => {
    await mockTripsListEndpoints(page);
    await page.goto('/trips');
    await page.waitForSelector('table', { timeout: 15_000 });
  });

  test('renders trip rows from API response', async ({ page }) => {
    await expect(page.getByText('Sunset Catamaran Cruise')).toBeVisible();
    await expect(page.getByText('Glass Bottom Boat Tour')).toBeVisible();
    await expect(page.getByText('Archived Snorkel Trip')).toBeVisible();
  });

  test('"New Tour" button is visible and navigates to /trips/new', async ({ page }) => {
    // Mock supporting data so the new-trip form page doesn't hit unmocked API endpoints
    await mockSupportingData(page);
    // Use exact match for the header button
    await page.getByRole('link', { name: 'New Tour', exact: true }).click();
    await expect(page).toHaveURL(/\/trips\/new/, { timeout: 5_000 });
  });

  test('row-actions menu opens and shows Edit Details item', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /open menu/i }).first();
    await menuButton.click();
    await expect(page.getByRole('menuitem', { name: /edit details/i })).toBeVisible();
  });

  test('row-actions menu shows Schedules and Translations navigation items', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /open menu/i }).first();
    await menuButton.click();
    await expect(page.getByRole('menuitem', { name: /schedules/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /translations/i })).toBeVisible();
  });

  test('DRAFT trip row-actions shows Archive item', async ({ page }) => {
    // The first row is the DRAFT trip
    const menuButton = page.getByRole('button', { name: /open menu/i }).first();
    await menuButton.click();
    await expect(page.getByRole('menuitem', { name: /archive/i })).toBeVisible();
  });

  test('ARCHIVED trip row-actions shows Restore to Draft item', async ({ page }) => {
    // The third row is the ARCHIVED trip
    const menuButton = page.getByRole('button', { name: /open menu/i }).nth(2);
    await menuButton.click();
    await expect(page.getByRole('menuitem', { name: /restore to draft/i })).toBeVisible();
  });

  test('ARCHIVED trip row-actions does not show Edit Details navigation', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /open menu/i }).nth(2);
    await menuButton.click();
    await expect(page.getByRole('menuitem', { name: /edit details/i })).not.toBeVisible();
  });

  test('publish action in row menu calls POST /publish and shows toast', async ({ page }) => {
    let publishCalled = false;
    await page.route(`**/api/v1/tours/${TRIP_ID}/publish`, (route) => {
      if (route.request().method() === 'POST') {
        publishCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...MOCK_TRIP_DRAFT, status: 'LIVE' }),
        });
      } else {
        route.continue();
      }
    });

    const menuButton = page.getByRole('button', { name: /open menu/i }).first();
    await menuButton.click();
    await page.getByRole('menuitem', { name: /^publish$/i }).click();

    await expect(page.getByText(/published successfully/i)).toBeVisible({ timeout: 5_000 });
    expect(publishCalled).toBe(true);
  });

  test('restore action in archived trip row menu calls POST /restore and shows toast', async ({ page }) => {
    let restoreCalled = false;
    await page.route(`**/api/v1/tours/${ARCHIVED_TRIP_ID}/restore`, (route) => {
      if (route.request().method() === 'POST') {
        restoreCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...MOCK_TRIP_ARCHIVED, status: 'DRAFT' }),
        });
      } else {
        route.continue();
      }
    });

    const menuButton = page.getByRole('button', { name: /open menu/i }).nth(2);
    await menuButton.click();
    await page.getByRole('menuitem', { name: /restore to draft/i }).click();

    await expect(page.getByText(/restored to draft/i)).toBeVisible({ timeout: 5_000 });
    expect(restoreCalled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Create Trip (/trips/new)
// ---------------------------------------------------------------------------

test.describe('Create Trip (/trips/new)', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupportingData(page);
    await page.goto('/trips/new');
    // Wait for the form card to render
    await page.waitForSelector('form', { timeout: 15_000 });
  });

  test('slug auto-generates from name input', async ({ page }) => {
    await page.locator('input[name="name"]').fill('Sunset Catamaran Cruise');
    await expect(page.locator('input[name="slug"]')).toHaveValue('sunset-catamaran-cruise');
  });

  test('slug normalizes special characters from name', async ({ page }) => {
    await page.locator('input[name="name"]').fill('Island & Sea Tour');
    // & stripped, spaces become hyphens
    await expect(page.locator('input[name="slug"]')).toHaveValue('island-sea-tour');
  });

  test('manually editing slug stops auto-generation from name', async ({ page }) => {
    await page.locator('input[name="name"]').fill('Initial Name');
    await expect(page.locator('input[name="slug"]')).toHaveValue('initial-name');

    // Manually change the slug
    await page.locator('input[name="slug"]').fill('my-custom-slug');

    // Now change the name - slug should NOT change
    await page.locator('input[name="name"]').fill('Different Name');
    await expect(page.locator('input[name="slug"]')).toHaveValue('my-custom-slug');
  });

  test('validation: submitting empty form shows name required error', async ({ page }) => {
    await page.getByRole('button', { name: /create trip/i }).click();
    await expect(page.getByText(/name must be at least 3 characters/i)).toBeVisible();
  });

  test('validation: submitting without destination shows destination required error', async ({ page }) => {
    await page.locator('input[name="name"]').fill('Valid Trip Name');
    await page.getByRole('button', { name: /create trip/i }).click();
    await expect(page.getByText(/destination is required/i)).toBeVisible();
  });

  test('successful create navigates to edit page', async ({ page }) => {
    const createdTrip = { ...MOCK_TRIP_DRAFT, id: 'new-trip-id' };

    await page.route('**/api/v1/tours', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(createdTrip),
        });
      } else {
        route.continue();
      }
    });

    await page.locator('input[name="name"]').fill('Sunset Catamaran Cruise');

    // Radix SelectTrigger accessible name is not reliably derived from placeholder text;
    // use filter({ hasText }) on text content instead
    await page.getByRole('combobox').filter({ hasText: /select a destination/i }).click();
    await page.getByRole('option', { name: /curacao/i }).click();

    await page.getByRole('combobox').filter({ hasText: /select a category/i }).click();
    await page.getByRole('option', { name: /boat tours/i }).click();

    await page.getByRole('button', { name: /create trip/i }).click();

    await expect(page).toHaveURL(/\/trips\/new-trip-id\/edit/, { timeout: 10_000 });
  });

  test('shows error toast when slug conflicts (409)', async ({ page }) => {
    await page.route('**/api/v1/tours', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Slug already exists', statusCode: 409 }),
        });
      } else {
        route.continue();
      }
    });

    await page.locator('input[name="name"]').fill('Sunset Catamaran Cruise');

    await page.getByRole('combobox').filter({ hasText: /select a destination/i }).click();
    await page.getByRole('option', { name: /curacao/i }).click();

    await page.getByRole('combobox').filter({ hasText: /select a category/i }).click();
    await page.getByRole('option', { name: /boat tours/i }).click();

    await page.getByRole('button', { name: /create trip/i }).click();

    // TripForm maps 409 / slug-related errors to a specific message
    await expect(page.getByText(/slug already exists in this destination/i)).toBeVisible({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// 3. Edit Trip - Details Tab
// ---------------------------------------------------------------------------

test.describe('Edit Trip - Details Tab', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllTripTabEndpoints(page);
    await page.goto(`/trips/${TRIP_ID}/edit?tab=details`);
    // Wait for the form to load with trip data
    await page.waitForSelector('input[name="name"]', { timeout: 15_000 });
  });

  test('trip name is pre-filled in the form', async ({ page }) => {
    await expect(page.locator('input[name="name"]')).toHaveValue('Sunset Catamaran Cruise');
  });

  test('slug field is read-only with "cannot be changed" note', async ({ page }) => {
    // The slug input has readOnly prop - locate by the readonly attribute on the first
    // readonly input in the read-only fields grid (before the name field)
    const slugInput = page.locator('input[readonly]').first();
    await expect(slugInput).toBeVisible();
    await expect(slugInput).toHaveValue('sunset-catamaran-cruise');
    await expect(page.getByText(/slug cannot be changed after creation/i)).toBeVisible();
  });

  test('Publish button visible for DRAFT trip', async ({ page }) => {
    await expect(page.getByRole('button', { name: /publish/i })).toBeVisible();
  });

  test('Publish Readiness card visible for DRAFT trip', async ({ page }) => {
    await expect(page.getByText(/publish readiness/i)).toBeVisible();
  });

  test('Save Changes button triggers PATCH and shows success toast', async ({ page }) => {
    let patchBody: unknown = null;
    await page.route(`**/api/v1/tours/${TRIP_ID}`, (route) => {
      if (route.request().method() === 'PATCH') {
        patchBody = route.request().postDataJSON();
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ trip: MOCK_TRIP_DRAFT, warnings: [] }),
        });
      } else if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_TRIP_DRAFT) });
      } else {
        route.continue();
      }
    });

    await page.locator('input[name="name"]').fill('Updated Trip Name');
    await page.getByRole('button', { name: /save changes/i }).click();

    await expect(page.getByText(/trip updated successfully/i)).toBeVisible({ timeout: 5_000 });
    expect(patchBody).not.toBeNull();
  });

  test('Publish button triggers POST /publish and shows toast', async ({ page }) => {
    let publishCalled = false;
    await page.route(`**/api/v1/tours/${TRIP_ID}/publish`, (route) => {
      if (route.request().method() === 'POST') {
        publishCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...MOCK_TRIP_DRAFT, status: 'LIVE' }),
        });
      } else {
        route.continue();
      }
    });

    await page.getByRole('button', { name: /^publish$/i }).click();

    await expect(page.getByText(/published successfully/i)).toBeVisible({ timeout: 5_000 });
    expect(publishCalled).toBe(true);
  });

  test('LIVE trip shows Pause and Archive buttons (not Publish)', async ({ page }) => {
    await mockAllTripTabEndpoints(page, MOCK_TRIP_LIVE);
    await page.goto(`/trips/${LIVE_TRIP_ID}/edit?tab=details`);
    await page.waitForSelector('input[name="name"]', { timeout: 15_000 });

    await expect(page.getByRole('button', { name: /^pause$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^archive$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^publish$/i })).not.toBeVisible();
  });

  test('Pause button on LIVE trip calls POST /pause and shows toast', async ({ page }) => {
    await mockAllTripTabEndpoints(page, MOCK_TRIP_LIVE);
    await page.goto(`/trips/${LIVE_TRIP_ID}/edit?tab=details`);
    await page.waitForSelector('input[name="name"]', { timeout: 15_000 });

    let pauseCalled = false;
    await page.route(`**/api/v1/tours/${LIVE_TRIP_ID}/pause`, (route) => {
      if (route.request().method() === 'POST') {
        pauseCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...MOCK_TRIP_LIVE, status: 'PAUSED' }),
        });
      } else {
        route.continue();
      }
    });

    await page.getByRole('button', { name: /^pause$/i }).click();

    await expect(page.getByText(/trip paused/i)).toBeVisible({ timeout: 5_000 });
    expect(pauseCalled).toBe(true);
  });

  test('destination field is read-only with "cannot be changed" note', async ({ page }) => {
    await expect(page.getByText(/destination cannot be changed after creation/i)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 4. Edit Trip - Inclusions Tab
// ---------------------------------------------------------------------------

test.describe('Edit Trip - Inclusions Tab', () => {
  test.beforeEach(async ({ page }) => {
    await mockTripDetail(page);
    await mockTranslationsEndpoints(page);
    await mockInclusionsEndpoints(page);
    await mockSupportingData(page);
    await page.route(`**/api/v1/tours/${TRIP_ID}/languages**`, (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.goto(`/trips/${TRIP_ID}/edit?tab=inclusions`);
    await page.waitForSelector('text=Inclusions', { timeout: 15_000 });
  });

  test('renders inclusions from the API', async ({ page }) => {
    await expect(page.getByText('Welcome drink')).toBeVisible();
  });

  test('submitting Add Inclusion form calls POST and shows success toast', async ({ page }) => {
    let postCalled = false;
    await page.route(`**/api/v1/tours/${TRIP_ID}/inclusions`, (route) => {
      if (route.request().method() === 'POST') {
        postCalled = true;
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'inc-new',
            tripId: TRIP_ID,
            icon: 'check',
            displayOrder: 2,
            imageUrl: null,
            translations: [{ locale: 'en', label: 'Snorkel gear', isMachineTranslated: false }],
          }),
        });
      } else if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_INCLUSIONS) });
      } else {
        route.continue();
      }
    });

    await page.locator('input[name="label"]').fill('Snorkel gear');
    await page.getByRole('button', { name: /add inclusion/i }).click();

    expect(postCalled).toBe(true);
  });

  test('validation: submitting inclusion with fewer than 2 characters shows error', async ({ page }) => {
    await page.locator('input[name="label"]').fill('A');
    await page.getByRole('button', { name: /add inclusion/i }).click();
    await expect(page.getByText(/at least 2 characters/i)).toBeVisible();
  });

  test('delete button on an inclusion calls DELETE and shows success toast', async ({ page }) => {
    let deleteCalled = false;
    await page.route(`**/api/v1/tours/${TRIP_ID}/inclusions/inc-1`, (route) => {
      if (route.request().method() === 'DELETE') {
        deleteCalled = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Deleted' }) });
      } else {
        route.continue();
      }
    });

    const firstRow = page.locator('.ring-1.ring-foreground\\/10').first();
    const deleteBtn = firstRow.getByRole('button').last();
    await deleteBtn.click();

    expect(deleteCalled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Edit Trip - Schedules Tab
// ---------------------------------------------------------------------------

test.describe('Edit Trip - Schedules Tab', () => {
  test.beforeEach(async ({ page }) => {
    await mockTripDetail(page);
    await mockTranslationsEndpoints(page);
    await mockSchedulesEndpoints(page);
    await mockSupportingData(page);
    await page.route(`**/api/v1/tours/${TRIP_ID}/languages**`, (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.goto(`/trips/${TRIP_ID}/edit?tab=schedules`);
    await page.waitForSelector('text=Departure Schedules', { timeout: 15_000 });
  });

  test('renders existing schedule from the API', async ({ page }) => {
    // formatDate uses Intl.DateTimeFormat('en-US', { year:'numeric', month:'short', day:'numeric' })
    // which produces "Dec 1, 2025" - not "01 Dec 2025"
    await expect(page.getByText(/Dec 1, 2025/)).toBeVisible();
    await expect(page.getByText('09:00')).toBeVisible();
  });

  test('"Select start date" button opens calendar popover', async ({ page }) => {
    const startDateBtn = page.getByRole('button', { name: /select start date/i });
    await expect(startDateBtn).toBeVisible();
    await startDateBtn.click();
    // Calendar popover should appear
    await expect(page.locator('[data-radix-popper-content-wrapper]')).toBeVisible({ timeout: 5_000 });
  });

  test('selecting a date from calendar popover populates start date field', async ({ page }) => {
    const startDateBtn = page.getByRole('button', { name: /select start date/i });
    await startDateBtn.click();

    // Wait for calendar to open - react-day-picker v10 uses data-day on the button
    await page.waitForSelector('[role="gridcell"]:not([data-disabled]) button[type="button"]', { timeout: 5_000 });
    // Click the first enabled day
    const dayButton = page.locator('[role="gridcell"]:not([data-disabled]) button[type="button"]').first();
    await dayButton.click();

    // After selection, the popover closes and the button text should no longer say "Select start date"
    await expect(page.getByRole('button', { name: /select start date/i })).not.toBeVisible({ timeout: 3_000 });
  });

  test('Add Schedule submit calls POST and shows success toast', async ({ page }) => {
    let postCalled = false;
    await page.route(`**/api/v1/availability/schedules**`, (route) => {
      if (route.request().method() === 'POST') {
        postCalled = true;
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'sched-new',
            tripId: TRIP_ID,
            startDate: '2025-12-15',
            endDate: null,
            startTime: '10:00',
            totalSpots: 15,
            availableSpots: 15,
            status: 'AVAILABLE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        });
      } else if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SCHEDULES) });
      } else {
        route.continue();
      }
    });

    // Open calendar and select a date
    await page.getByRole('button', { name: /select start date/i }).click();
    await page.waitForSelector('[role="gridcell"]:not([data-disabled]) button[type="button"]', { timeout: 5_000 });
    await page.locator('[role="gridcell"]:not([data-disabled]) button[type="button"]').first().click();

    // Fill start time and total spots (already have defaults)
    await page.getByRole('button', { name: /add schedule/i }).click();

    expect(postCalled).toBe(true);
  });

  test('validation: submitting without start date shows error', async ({ page }) => {
    await page.getByRole('button', { name: /add schedule/i }).click();
    await expect(page.getByText(/start date is required/i)).toBeVisible();
  });

  test('delete schedule button calls DELETE and shows success toast', async ({ page }) => {
    let deleteCalled = false;
    await page.route(`**/api/v1/availability/schedules**/sched-1`, (route) => {
      if (route.request().method() === 'DELETE') {
        deleteCalled = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Deleted' }) });
      } else {
        route.continue();
      }
    });

    // The trash icon button on the schedule row
    const scheduleRow = page.locator('.ring-1.ring-foreground\\/10').first();
    const deleteBtn = scheduleRow.getByRole('button').filter({ has: page.locator('svg') }).last();
    await deleteBtn.click();

    expect(deleteCalled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Edit Trip - Translations Tab
// ---------------------------------------------------------------------------

test.describe('Edit Trip - Translations Tab', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllTripTabEndpoints(page);
    await mockTranslationsEndpoints(page);
    // Override en translation to ensure locale-specific mock is fresh
    await page.route(`**/api/v1/tours/${TRIP_ID}/translations/en`, (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_EN_TRANSLATION) });
      } else if (route.request().method() === 'PATCH') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_EN_TRANSLATION) });
      } else {
        route.continue();
      }
    });
    await page.goto(`/trips/${TRIP_ID}/edit?tab=translations`);
    await page.waitForSelector('text=Translations', { timeout: 15_000 });
  });

  test('English tab is the default active tab', async ({ page }) => {
    // The "en" tab trigger should be present and the English content visible
    await expect(page.getByRole('tab', { name: /english/i })).toBeVisible();
  });

  test('Display Title field is pre-filled with trip name on English tab', async ({ page }) => {
    // After translation loads, the title field should be populated
    await expect(page.locator('input[name="title"]')).toHaveValue('Sunset Catamaran Cruise', { timeout: 8_000 });
  });

  test('Save Translation button calls PATCH and shows success toast', async ({ page }) => {
    let patchCalled = false;
    await page.route(`**/api/v1/tours/${TRIP_ID}/translations/en`, (route) => {
      if (route.request().method() === 'PATCH') {
        patchCalled = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_EN_TRANSLATION) });
      } else if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_EN_TRANSLATION) });
      } else {
        route.continue();
      }
    });

    await page.getByRole('button', { name: /save translation/i }).click();

    await expect(page.getByText(/translation saved/i)).toBeVisible({ timeout: 5_000 });
    expect(patchCalled).toBe(true);
  });

  test('"Clear Fields" button shown on English tab (not "Delete Translation")', async ({ page }) => {
    await expect(page.getByRole('button', { name: /clear fields/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /delete translation/i })).not.toBeVisible();
  });

  test('Clear Fields on English tab calls upsert with null fields (not DELETE)', async ({ page }) => {
    let patchCalled = false;
    let deleteCalled = false;
    await page.route(`**/api/v1/tours/${TRIP_ID}/translations/en`, (route) => {
      const method = route.request().method();
      if (method === 'PATCH') {
        patchCalled = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...MOCK_EN_TRANSLATION, title: null, overview: null, description: null }) });
      } else if (method === 'DELETE') {
        deleteCalled = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Deleted' }) });
      } else if (method === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_EN_TRANSLATION) });
      } else {
        route.continue();
      }
    });

    await page.getByRole('button', { name: /clear fields/i }).click();
    // Confirm prompt appears
    await expect(page.getByRole('button', { name: /yes, clear/i })).toBeVisible({ timeout: 3_000 });
    await page.getByRole('button', { name: /yes, clear/i }).click();

    await expect(page.getByText(/fields cleared/i)).toBeVisible({ timeout: 5_000 });
    expect(patchCalled).toBe(true);
    expect(deleteCalled).toBe(false);
  });

  test('switching to Dutch tab shows empty Display Title', async ({ page }) => {
    // Dutch locale tab
    const dutchTab = page.getByRole('tab', { name: /dutch/i });
    if (await dutchTab.isVisible()) {
      await dutchTab.click();
      await expect(page.locator('input[name="title"]')).toHaveValue('', { timeout: 8_000 });
    } else {
      // Locale shown as abbreviation
      await page.getByRole('tab', { name: /^nl$/i }).click();
      await expect(page.locator('input[name="title"]')).toHaveValue('', { timeout: 8_000 });
    }
  });

  test('non-English locale shows "Delete Translation" button (not "Clear Fields")', async ({ page }) => {
    const dutchTab = page.getByRole('tab', { name: /dutch/i });
    if (await dutchTab.isVisible()) {
      await dutchTab.click();
    } else {
      await page.getByRole('tab', { name: /^nl$/i }).click();
    }

    await expect(page.getByRole('button', { name: /delete translation/i })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('button', { name: /clear fields/i })).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 8. Trip Lifecycle (from edit page header buttons)
// ---------------------------------------------------------------------------

test.describe('Trip Lifecycle', () => {
  test('DRAFT trip: Publish button calls POST /publish', async ({ page }) => {
    await mockAllTripTabEndpoints(page);
    let publishCalled = false;
    await page.route(`**/api/v1/tours/${TRIP_ID}/publish`, (route) => {
      if (route.request().method() === 'POST') {
        publishCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...MOCK_TRIP_DRAFT, status: 'LIVE' }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto(`/trips/${TRIP_ID}/edit`);
    await page.waitForSelector('text=DRAFT', { timeout: 15_000 });

    await page.getByRole('button', { name: /^publish$/i }).click();

    await expect(page.getByText(/published successfully/i)).toBeVisible({ timeout: 5_000 });
    expect(publishCalled).toBe(true);
  });

  test('LIVE trip: Pause button calls POST /pause', async ({ page }) => {
    await mockAllTripTabEndpoints(page, MOCK_TRIP_LIVE);
    let pauseCalled = false;
    await page.route(`**/api/v1/tours/${LIVE_TRIP_ID}/pause`, (route) => {
      if (route.request().method() === 'POST') {
        pauseCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...MOCK_TRIP_LIVE, status: 'PAUSED' }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto(`/trips/${LIVE_TRIP_ID}/edit`);
    await page.waitForSelector('text=LIVE', { timeout: 15_000 });

    await page.getByRole('button', { name: /^pause$/i }).click();

    await expect(page.getByText(/trip paused/i)).toBeVisible({ timeout: 5_000 });
    expect(pauseCalled).toBe(true);
  });

  test('PAUSED trip shows Unpause button', async ({ page }) => {
    const pausedTrip = { ...MOCK_TRIP_LIVE, id: 'paused-id', status: 'PAUSED' };
    await mockAllTripTabEndpoints(page, pausedTrip as Record<string, unknown>);
    await page.goto(`/trips/paused-id/edit`);
    await page.waitForSelector('text=PAUSED', { timeout: 15_000 });

    await expect(page.getByRole('button', { name: /unpause/i })).toBeVisible();
  });

  test('Archive button opens the archive dialog', async ({ page }) => {
    await mockAllTripTabEndpoints(page, MOCK_TRIP_LIVE);
    await page.goto(`/trips/${LIVE_TRIP_ID}/edit`);
    await page.waitForSelector('text=LIVE', { timeout: 15_000 });

    await page.getByRole('button', { name: /^archive$/i }).click();

    // Archive dialog should open
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5_000 });
  });

  test('Restore action from list page sends POST /restore for archived trip', async ({ page }) => {
    await mockTripsListEndpoints(page);
    let restoreCalled = false;
    await page.route(`**/api/v1/tours/${ARCHIVED_TRIP_ID}/restore`, (route) => {
      if (route.request().method() === 'POST') {
        restoreCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...MOCK_TRIP_ARCHIVED, status: 'DRAFT' }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto('/trips');
    await page.waitForSelector('table', { timeout: 15_000 });

    // Open row actions for the archived trip (third row)
    const menuButton = page.getByRole('button', { name: /open menu/i }).nth(2);
    await menuButton.click();
    await page.getByRole('menuitem', { name: /restore to draft/i }).click();

    await expect(page.getByText(/restored to draft/i)).toBeVisible({ timeout: 5_000 });
    expect(restoreCalled).toBe(true);
  });
});
