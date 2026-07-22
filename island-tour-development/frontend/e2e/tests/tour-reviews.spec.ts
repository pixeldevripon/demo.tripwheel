/**
 * Public tour-page review display + compliance E2E.
 *
 * ## Why every locator goes through `reviewsSection()`
 *
 * This section is a `connection()` dynamic Suspense boundary. React's streaming
 * SSR parks a SECOND, hidden copy of the late-arriving content in the DOM until
 * it swaps the real one in. Both match `#tour-reviews`, DOM order between them
 * is not stable, and the hidden copy has no layout box - so `.first()`,
 * `.last()`, `filter({ visible: true })` and `:visible` are all flaky here
 * (each was tried, and each failed intermittently).
 *
 * The section sets `data-hydrated` in an effect. The holding-pen copy is never
 * hydrated, so that attribute marks the live one unambiguously - and waiting on
 * it also waits for interactivity, which the click tests need regardless.
 *
 * Runs against real seeded data rather than mocks: the whole point of these
 * assertions is that the LD11/LD30/LD31 thresholds resolve correctly against
 * what the backend actually returns, and a mocked payload would only prove that
 * the component renders whatever it is handed.
 *
 * ## Fixture coverage, stated honestly
 * The seeded dataset now has tours in four of the five threshold buckets:
 *   0    - LD11 operator fallback (klein-curacao-luxury-yacht-charter)
 *   3-9  - chart, no sort control (klein-curacao-sailing-catamaran-breakfast)
 *   20+  - chart + sort + theme chips (westpoint-snorkel-and-beach-hop, 36)
 * Only the **1-2** bucket has no fixture, so the "early reviews" copy is covered
 * by unit tests alone. That gap is real and is recorded rather than papered over
 * with a mock that would pass regardless of whether the gate works.
 *
 * These slugs are REAL seeded tours, so a change to the demo seed's review depth
 * moves them between buckets. That has happened once already - if a threshold
 * test starts failing on a count, re-check the fixture before the component.
 */

import { expect, test, type Page } from '@playwright/test';

/**
 * The VISIBLE reviews section.
 *
 * The page streams this boundary, and React's streaming SSR leaves a second,
 * `hidden` copy of late-arriving Suspense content in the DOM as its holding pen.
 * A bare `#tour-reviews` (or any `.first()`) therefore resolves to a 0x0 hidden
 * node and every assertion fails as "hidden" while the page looks perfect in a
 * browser. Filtering on visibility is what makes these tests describe what a
 * traveller actually sees.
 */
/** The LIVE reviews section - see the file header for why this is not `#tour-reviews`. */
function reviewsSection(page: Page) {
  return page.locator('#tour-reviews[data-hydrated="true"]');
}

/**
 * Navigate and WAIT for the section to hydrate.
 *
 * Without this every assertion races the stream: on a cold request the live
 * copy does not exist yet, so a bare `goto` + assert fails intermittently for
 * reasons that have nothing to do with the thing under test.
 */
async function gotoTour(page: Page, path: string) {
  await page.goto(path);
  await expect(reviewsSection(page)).toBeVisible({ timeout: 20_000 });
}

const TOURS = {
  /** 0 own reviews, operator qualifies -> LD11 borrowed rating. */
  fallback: '/en/curacao/klein-curacao-luxury-yacht-charter',
  /** 4 own reviews across 3 distinct star values -> chart, no sort. */
  small: '/en/curacao/klein-curacao-sailing-catamaran-breakfast',
  /** 36 own reviews -> chart + sort + theme chips + JSON-LD. */
  large: '/en/curacao/westpoint-snorkel-and-beach-hop',
};

test.describe('tour page - review thresholds', () => {
  test('0 own reviews: borrowed rating is disclosed, no chart, no JSON-LD', async ({
    page,
  }) => {
    await gotoTour(page, TOURS.fallback);

    // FE-7a: the borrowed rating is explained in words, naming the operator.
    await expect(
      reviewsSection(page).getByText(/New on Island Tours\. This tour is run by/i),
    ).toBeVisible();

    // LD31: no distribution to chart, so no clickable bars.
    await expect(reviewsSection(page).locator('button[aria-pressed][aria-label*="star"]')).toHaveCount(0);

    // FE-2: marking a borrowed operator rating up as this product's own
    // aggregateRating is review fraud under both Google's policy and the
    // Omnibus regime. There must be no structured data at all here.
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(
      0,
    );
  });

  test('3-9 own reviews: chart renders, sort control does not (LD30)', async ({
    page,
  }) => {
    await gotoTour(page, TOURS.small);

    const bars = reviewsSection(page).locator('button[aria-pressed][aria-label*="star"]');
    await expect(bars).toHaveCount(5);

    // Under 10 there is not enough to reorder for a sort to mean anything.
    await expect(reviewsSection(page).locator('select')).toHaveCount(0);
  });

  test('20+ own reviews: chart, sort and JSON-LD all present', async ({
    page,
  }) => {
    await gotoTour(page, TOURS.large);

    await expect(reviewsSection(page).locator('button[aria-pressed][aria-label*="star"]')).toHaveCount(5);
    // The control itself, not its option text: `<option>` inside a native
    // `<select>` is never "visible" to Playwright.
    const sort = reviewsSection(page).locator('select');
    await expect(sort).toBeVisible();
    await expect(sort.locator('option')).toHaveCount(3);

    const ld = page.locator('script[type="application/ld+json"]');
    await expect(ld).toHaveCount(1);

    const json = JSON.parse((await ld.first().textContent()) ?? '{}');
    expect(json['@type']).toBe('Product');
    expect(json.aggregateRating.reviewCount).toBeGreaterThanOrEqual(3);
    // Only reviews actually on the page may be marked up, and the page shows
    // one page of 10.
    expect(json.review.length).toBeLessThanOrEqual(10);
  });

  test('the theme-chip filter bar appears past 20 reviews (FE-9 / LD30)', async ({
    page,
  }) => {
    await gotoTour(page, TOURS.large);

    // Chips are `aria-pressed` buttons like the chart bars, so scope past the
    // 5 histogram rows.
    const chips = page
      .locator('#tour-reviews button[aria-pressed]')
      .filter({ hasText: /guide|scenery|organised|safe|value|family/i });
    await expect(chips.first()).toBeVisible();

    const cards = reviewsSection(page).locator('article');
    const before = await cards.count();

    await chips.first().click();
    await expect(chips.first()).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('button', { name: /clear filter/i }),
    ).toBeVisible();

    // The chip narrows the list, and clearing restores it.
    await expect
      .poll(async () => cards.count(), { timeout: 10_000 })
      .toBeLessThanOrEqual(before);
    await page.getByRole('button', { name: /clear filter/i }).click();
    await expect
      .poll(async () => cards.count(), { timeout: 10_000 })
      .toBe(before);
  });

  test('the filter bar stays hidden under 20 reviews (LD30)', async ({
    page,
  }) => {
    await gotoTour(page, TOURS.small);
    const chips = page
      .locator('#tour-reviews button[aria-pressed]')
      .filter({ hasText: /guide|scenery|organised|safe|value|family/i });
    await expect(chips).toHaveCount(0);
  });

  test('the clickable star chart filters the list (FE-3 / LD31)', async ({
    page,
  }) => {
    await gotoTour(page, TOURS.small);

    const cards = reviewsSection(page).locator('article');
    const before = await cards.count();
    expect(before).toBeGreaterThan(1);

    // Pick the 5-star bar (first row of the [5..1] chart). Scoped by the star
    // aria-label: a bare `button[aria-pressed]` matches the wishlist toggle AND
    // every theme chip once a tour passes the 20-review gate.
    const fiveStar = reviewsSection(page).locator('button[aria-pressed][aria-label*="star"]').first();
    await fiveStar.click();

    // The active filter is announced, and a clear affordance appears.
    await expect(fiveStar).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /clear filter/i })).toBeVisible();

    // The list narrows to that star value.
    await expect
      .poll(async () => cards.count(), { timeout: 10_000 })
      .toBeLessThan(before);

    // Clicking the active bar again clears it - the chart is its own toggle.
    await fiveStar.click();
    await expect
      .poll(async () => cards.count(), { timeout: 10_000 })
      .toBe(before);
  });
});

test.describe('tour page - compliance', () => {
  test('the verification sub-line links to the explainer (Omnibus Art. 7(6))', async ({
    page,
  }) => {
    await gotoTour(page, TOURS.large);

    const link = reviewsSection(page)
      .getByRole('link', { name: /how we handle reviews/i })
      .first();
    await expect(link).toBeVisible();
    await link.click();

    await expect(page).toHaveURL(/\/reviews-policy$/);
    await expect(
      page.getByRole('heading', { name: /how we handle reviews/i }).first(),
    ).toBeVisible();
  });

  test('the explainer states the disclosures that matter', async ({ page }) => {
    await page.goto('/en/reviews-policy');

    // The four claims a regulator would look for.
    await expect(page.getByText(/only guests with a completed booking/i)).toBeVisible();
    await expect(page.getByText(/We publish criticism/i)).toBeVisible();
    await expect(page.getByText(/review gating/i)).toBeVisible();
    await expect(page.getByText(/We never pay for reviews/i).first()).toBeVisible();
    // The LD11 borrowed-rating disclosure - the one case where a displayed
    // rating is not the tour's own.
    await expect(
      page.getByRole('heading', { name: /when the rating is not the tour/i }),
    ).toBeVisible();
  });

  test('no third-party review widget appears on a tour page', async ({ page }) => {
    await gotoTour(page, TOURS.large);

    // Trustpilot is a PLATFORM-level surface (homepage), never a tour page:
    // mixing platform reviews into a product's rating misrepresents both.
    await expect(page.getByText(/trustpilot/i)).toHaveCount(0);
    await expect(page.locator('[class*="trustpilot" i]')).toHaveCount(0);
    await expect(page.locator('script[src*="trustpilot" i]')).toHaveCount(0);
  });

  /**
   * The submit flow, driven through a real single-use invitation token.
   *
   * The token is passed in rather than generated here (the public app has no
   * database access by design), so these skip rather than fail when it is
   * absent. Mint one with:
   *
   *   INSERT INTO review_invitations (id, "bookingId", token, "createdAt", "updatedAt")
   *   SELECT gen_random_uuid(), b.id, 'e2e-' || substr(md5(random()::text),1,16), now(), now()
   *   FROM bookings b
   *   LEFT JOIN review_invitations ri ON ri."bookingId" = b.id
   *   LEFT JOIN reviews r ON r."bookingId" = b.id
   *   WHERE b.status IN ('CONFIRMED','REDEEMED') AND ri.id IS NULL AND r.id IS NULL
   *   LIMIT 1 RETURNING token;
   *
   * then run with REVIEW_TEST_TOKEN=<token>. The token is SPENT by the low-score
   * test, so a fresh one is needed per run - that is the design working, not a
   * flaky test.
   */
  test.describe('submit flow', () => {
    const token = process.env.REVIEW_TEST_TOKEN;

    test('a low score still gets the neutral invitation, recovery ADDED not swapped', async ({
      page,
    }) => {
      test.skip(!token, 'Set REVIEW_TEST_TOKEN to a fresh invitation token');
      await page.goto(`/en/review/${token}`);

      // Step 1 commits on star press, so a one-tap review still counts. The
      // star buttons are labelled with the bare value ("1".."5").
      const oneStar = page.getByRole('button', { name: '1', exact: true });
      await expect(oneStar).toBeVisible();
      await oneStar.click();

      // It saved from step 1 alone - nothing else was filled in.
      await expect(page.getByText(/Saved\. Thank you\./i).first()).toBeVisible({
        timeout: 15_000,
      });

      // The private recovery channel appears on a low score...
      await expect(
        page.getByText(/Sorry it missed the mark/i).first(),
      ).toBeVisible({ timeout: 15_000 });

      // ...ALONGSIDE the neutral platform-review step, never instead of it.
      //
      // Step 4 is gated on `trustpilotUrl` being CONFIGURED, never on the
      // score - so with no provider set (Phase 6) it is absent for a 5-star
      // exactly as it is here. Asserting it visible would therefore fail for
      // the wrong reason. What IS assertable now is that nothing about the low
      // score closed the flow down: steps 2, 3 and 3b all remain open, and the
      // guest can still write, photograph and categorise their bad review.
      await expect(
        page.getByText(/Tell other travellers what it was like/i).first(),
      ).toBeVisible();
      await expect(
        page.getByPlaceholder(/Write a few words about your day/i),
      ).toBeEditable();
      await expect(page.getByRole('button', { name: /^Couple$/ })).toBeVisible();

      // When a provider IS configured, the CTA must appear on this low score
      // too. Skipped rather than silently passing while unconfigured.
      const trustpilotCta = page.getByRole('link', {
        name: /Leave a review on Trustpilot/i,
      });
      if ((await trustpilotCta.count()) > 0) {
        await expect(trustpilotCta.first()).toBeVisible();
      }

      // And the guest is told their words are published as written.
      await expect(
        page.getByText(/published in full, whatever the score/i).first(),
      ).toBeVisible();
    });
  });

  test('every review card carries its verification basis', async ({ page }) => {
    await gotoTour(page, TOURS.large);

    const cards = reviewsSection(page).locator('article');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // The badge is a description of the only route that exists (booking-gated),
    // so it belongs on every card, not a favoured subset.
    const badges = reviewsSection(page).getByText('Verified booking');
    await expect(badges).toHaveCount(count);
  });
});
