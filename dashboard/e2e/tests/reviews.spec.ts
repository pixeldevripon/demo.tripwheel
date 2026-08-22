/**
 * Reviews moderation queue E2E tests
 *
 * Covers:
 *  - Queue opens on PENDING, with the full history one dropdown away
 *  - Approve / Hold / Reject from the row actions
 *  - Reject enforces a documented policy ground before it will submit
 *  - "Negative" is NOT among the rejection grounds (compliance, not styling)
 *  - Bulk approve
 *  - RBAC: an operator sees no approve/reject affordance at all
 *  - Pending badge reflects the real count
 *
 * All API calls are intercepted with `page.route()` so the suite runs without a
 * live backend, matching the convention in the other specs here. Auth comes from
 * the global storageState in `e2e/auth.setup.ts`.
 */

import { test, expect } from '../fixtures/index';

test.setTimeout(30_000);

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

function review(over: Record<string, unknown> = {}) {
  return {
    id: 'rev-1',
    tourId: 'tour-1',
    operatorId: 'op-1',
    rating: 5,
    ratingValue: null,
    ratingGuide: null,
    ratingSafety: null,
    title: 'Unforgettable day',
    comment: 'The crew were wonderful and the water was crystal clear.',
    locale: 'en',
    reviewerInitial: 'Ada B.',
    reviewerCountry: 'NL',
    reviewerType: 'COUPLE',
    travelMonth: 3,
    travelYear: 2026,
    photos: [],
    themeTags: [],
    helpfulCount: 0,
    source: 'NATIVE',
    isVerified: true,
    moderationStatus: 'PENDING',
    responseText: null,
    responseAuthor: null,
    responseAt: null,
    createdAt: '2026-03-12T10:00:00.000Z',
    tourTitle: 'Sunset Catamaran Cruise',
    operatorName: 'Blue Bay Charters',
    bookingRef: 'IT-2026-00042',
    isFeatured: false,
    rejectionReason: null,
    openFlagCount: 0,
    ...over,
  };
}

const PENDING_LIST = {
  total: 2,
  page: 1,
  limit: 20,
  data: [
    review(),
    review({ id: 'rev-2', rating: 2, reviewerInitial: 'Bob C.' }),
  ],
};

/** Captures the moderation calls a test made, so intent can be asserted. */
type Captured = { url: string; body: unknown }[];

async function mockReviewsApi(page: any, captured: Captured) {
  // List (both admin and operator scopes).
  await page.route('**/api/v1/reviews/admin**', async (route: any) => {
    await route.fulfill({ json: PENDING_LIST });
  });
  await page.route('**/api/v1/reviews/operator**', async (route: any) => {
    await route.fulfill({ json: PENDING_LIST });
  });
  // Moderation writes.
  await page.route('**/api/v1/reviews/bulk-moderate**', async (route: any) => {
    captured.push({
      url: route.request().url(),
      body: route.request().postDataJSON(),
    });
    await route.fulfill({ json: { updated: 2 } });
  });
  await page.route('**/api/v1/reviews/*/moderate**', async (route: any) => {
    captured.push({
      url: route.request().url(),
      body: route.request().postDataJSON(),
    });
    await route.fulfill({ json: review({ moderationStatus: 'APPROVED' }) });
  });
  // Anything else under /reviews that a page might touch.
  await page.route('**/api/v1/reviews/*/history**', async (route: any) => {
    await route.fulfill({ json: [] });
  });
}

test.describe('Reviews moderation queue', () => {
  let captured: Captured;

  test.beforeEach(async ({ page }) => {
    captured = [];
    await mockReviewsApi(page, captured);
  });

  test('opens on the pending queue', async ({ page }) => {
    await page.goto('/reviews');
    await expect(
      page.getByRole('heading', { name: /reviews/i }).first(),
    ).toBeVisible();
    // The rows the queue opened with.
    await expect(page.getByText('Ada B.').first()).toBeVisible();
  });

  test('history is one dropdown away, not unreachable', async ({ page }) => {
    await page.goto('/reviews');
    await expect(page.getByText('Ada B.').first()).toBeVisible();

    // A status filter exists and offers the decided states, so the queue is a
    // default view rather than a hard exclusion.
    const statusFilter = page
      .getByRole('combobox')
      .filter({ hasText: /pending|status/i })
      .first();
    await expect(statusFilter).toBeVisible();
    await statusFilter.click();
    await expect(
      page.getByRole('option', { name: /approved/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole('option', { name: /rejected/i }).first(),
    ).toBeVisible();
  });

  test('"All statuses" actually widens the list, not just the dropdown', async ({
    page,
  }) => {
    // Regression: the control sent `undefined` for "all", the list view read
    // that as "unset" and re-applied its PENDING default, so history was
    // unreachable while the dropdown happily showed every option. The old test
    // asserted the OPTIONS existed and passed throughout.
    let lastStatus: string | null | undefined = 'unset';
    await page.route('**/api/v1/reviews/admin**', async (route: any) => {
      lastStatus = new URL(route.request().url()).searchParams.get('status');
      await route.fulfill({ json: PENDING_LIST });
    });

    await page.goto('/reviews');
    await expect(page.getByText('Ada B.').first()).toBeVisible();
    expect(lastStatus).toBe('PENDING');

    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: /all statuses/i }).click();

    // No `status` param at all == every status. Anything else means the filter
    // silently narrowed the queue again.
    await expect.poll(() => lastStatus).toBeNull();
  });

  test('rejecting requires a documented policy ground', async ({ page }) => {
    await page.goto('/reviews');
    await expect(page.getByText('Ada B.').first()).toBeVisible();

    await page.getByRole('button', { name: /open menu|actions/i }).first().click();
    await page.getByRole('menuitem', { name: /^reject$/i }).click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();

    // Submitting with no ground selected must not fire the request.
    await dialog.getByRole('button', { name: /^reject$/i }).click();
    expect(captured.filter((c) => c.url.includes('/moderate'))).toHaveLength(0);
  });

  test('"negative" is not an available rejection ground', async ({ page }) => {
    await page.goto('/reviews');
    await expect(page.getByText('Ada B.').first()).toBeVisible();

    await page.getByRole('button', { name: /open menu|actions/i }).first().click();
    await page.getByRole('menuitem', { name: /^reject$/i }).click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    // Compliance, not copy: a moderator must not be ABLE to reject a review for
    // being unflattering, so the option cannot exist in the UI at all.
    await expect(dialog.getByText(/negative/i)).toHaveCount(0);
  });

  test('approve from the row actions calls moderate with APPROVED', async ({
    page,
  }) => {
    await page.goto('/reviews');
    await expect(page.getByText('Ada B.').first()).toBeVisible();

    await page.getByRole('button', { name: /open menu|actions/i }).first().click();
    await page.getByRole('menuitem', { name: /^approve$/i }).click();

    // Approve confirms in an AlertDialog before it fires.
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /^approve$/i }).click();

    await expect
      .poll(() => captured.filter((c) => c.url.includes('/moderate')).length)
      .toBeGreaterThan(0);
    const call = captured.find((c) => c.url.includes('/moderate'));
    expect((call?.body as any)?.status).toBe('APPROVED');
  });

  test('bulk approve sends every selected id', async ({ page }) => {
    await page.goto('/reviews');
    await expect(page.getByText('Ada B.').first()).toBeVisible();

    // Select-all checkbox in the header row.
    const selectAll = page.getByRole('checkbox').first();
    await selectAll.check();

    await page.getByRole('button', { name: /approve selected/i }).click();

    await expect
      .poll(() => captured.filter((c) => c.url.includes('bulk-moderate')).length)
      .toBeGreaterThan(0);
    const call = captured.find((c) => c.url.includes('bulk-moderate'));
    expect((call?.body as any)?.status).toBe('APPROVED');
    expect((call?.body as any)?.ids).toEqual(
      expect.arrayContaining(['rev-1', 'rev-2']),
    );
  });

  test('the pending badge shows the real count', async ({ page }) => {
    await page.goto('/reviews');
    await expect(page.getByText('Ada B.').first()).toBeVisible();

    // The badge reads the same `/reviews/admin` endpoint as the table (status
    // PENDING, limit 1) and renders its `total` - so 2, matching the mock.
    // Matched on the sidebar link itself, since a bare "2" would match half the
    // page and the sidebar carries no `navigation` role to scope by.
    await expect(
      page.getByRole('link', { name: /^Reviews/ }).first(),
    ).toContainText('2');
  });
});

/**
 * Operator RBAC.
 *
 * Needs its own browser context: the suite-wide `storageState` is an ADMIN
 * session, and the whole point here is what a TOUR_OPERATOR does NOT see.
 * Signs in against the real backend with the demo operator account, so the role
 * comes from a genuine session rather than a stubbed context.
 *
 * The rule being checked is "gated actions are ABSENT, never disabled" - a
 * greyed-out Approve button still tells an operator the control exists and
 * invites them to ask for it.
 */
test.describe('Reviews queue - operator', () => {
  const OPERATOR_EMAIL =
    process.env.TEST_OPERATOR_EMAIL ??
    'op.dushi-watersports@demo.islandtours.test';
  const OPERATOR_PASSWORD = process.env.DEMO_PASSWORD ?? 'DemoPass123!';

  test('an operator sees no approve / hold / reject affordance', async ({
    browser,
    playwright,
  }) => {
    const api = await playwright.request.newContext();
    const signIn = await api.post(
      'http://localhost:5050/api/auth/sign-in/email',
      {
        data: { email: OPERATOR_EMAIL, password: OPERATOR_PASSWORD },
        // Better Auth rejects a null Origin (MISSING_OR_NULL_ORIGIN). The
        // dashboard's own origin is in CORS_ORIGINS, so send it explicitly -
        // an APIRequestContext does not set one on its own.
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3001',
        },
      },
    );
    test.skip(
      !signIn.ok(),
      `Demo operator ${OPERATOR_EMAIL} is not signed-in-able (run pnpm prisma:seed:demo)`,
    );
    const storageState = await api.storageState();
    await api.dispose();

    const context = await browser.newContext({ storageState });
    const page = await context.newPage();
    const captured: Captured = [];
    await mockReviewsApi(page, captured);

    await page.goto('/reviews');
    await expect(page.getByText('Ada B.').first()).toBeVisible();

    // Bulk bar is admin-only.
    await expect(
      page.getByRole('button', { name: /approve selected/i }),
    ).toHaveCount(0);

    // Row actions open, but carry no moderation items.
    await page.getByRole('button', { name: /open menu|actions/i }).first().click();
    await expect(page.getByRole('menuitem', { name: /^approve$/i })).toHaveCount(
      0,
    );
    await expect(page.getByRole('menuitem', { name: /^reject$/i })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole('menuitem', { name: /hold for a second look/i }),
    ).toHaveCount(0);
    // Reading is still allowed - the operator is not locked out of the queue.
    await expect(page.getByRole('menuitem', { name: /^view$/i })).toHaveCount(1);

    await context.close();
  });
});
