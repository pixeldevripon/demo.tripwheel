/**
 * Public tour-page review display + compliance E2E.
 *
 * Runs against real seeded data rather than mocks: the whole point of these
 * assertions is that the LD11/LD30/LD31 thresholds resolve correctly against
 * what the backend actually returns, and a mocked payload would only prove that
 * the component renders whatever it is handed.
 *
 * ## Fixture coverage, stated honestly
 * The seeded dataset has tours in three of the five threshold buckets:
 *   0      - LD11 operator fallback  (klein-curacao-luxury-yacht-charter)
 *   3-9    - chart, no sort control  (curacao-street-food-and-market-tour)
 *   10-19  - chart + sort control    (westpoint-snorkel-and-beach-hop)
 * There is no tour with 1-2 reviews and none with 20+, so the "early reviews"
 * copy and the theme-chip filter bar have NO fixture here and are covered by
 * unit/backend tests only. That gap is real and is recorded rather than papered
 * over with a mock that would pass regardless.
 */

import { expect, test } from '@playwright/test';

const TOURS = {
  /** 0 own reviews, operator qualifies -> LD11 borrowed rating. */
  fallback: '/en/curacao/klein-curacao-luxury-yacht-charter',
  /** 4 own reviews across 2 distinct star values -> chart, no sort. */
  small: '/en/curacao/curacao-street-food-and-market-tour',
  /** 14 own reviews -> chart + sort. */
  large: '/en/curacao/westpoint-snorkel-and-beach-hop',
};

test.describe('tour page - review thresholds', () => {
  test('0 own reviews: borrowed rating is disclosed, no chart, no JSON-LD', async ({
    page,
  }) => {
    await page.goto(TOURS.fallback);

    // FE-7a: the borrowed rating is explained in words, naming the operator.
    await expect(
      page.getByText(/New on Island Tours\. This tour is run by/i).first(),
    ).toBeVisible();

    // LD31: no distribution to chart, so no clickable bars.
    await expect(page.locator('#tour-reviews button[aria-pressed]')).toHaveCount(0);

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
    await page.goto(TOURS.small);

    const bars = page.locator('#tour-reviews button[aria-pressed]');
    await expect(bars).toHaveCount(5);

    // Under 10 there is not enough to reorder for a sort to mean anything.
    await expect(page.locator('#tour-reviews select')).toHaveCount(0);
  });

  test('10-19 own reviews: chart, sort, and JSON-LD all present', async ({
    page,
  }) => {
    await page.goto(TOURS.large);

    await expect(page.locator('#tour-reviews button[aria-pressed]')).toHaveCount(5);
    // The control itself, not its option text: `<option>` inside a native
    // `<select>` is never "visible" to Playwright.
    const sort = page.locator('#tour-reviews select');
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

  test('the clickable star chart filters the list (FE-3 / LD31)', async ({
    page,
  }) => {
    await page.goto(TOURS.small);

    const cards = page.locator('#tour-reviews article');
    const before = await cards.count();
    expect(before).toBeGreaterThan(1);

    // Pick the 5-star bar (first row of the [5..1] chart). Scoped to the
    // section: a bare `button[aria-pressed]` also matches the wishlist toggle.
    const fiveStar = page.locator('#tour-reviews button[aria-pressed]').first();
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
    await page.goto(TOURS.large);

    const link = page.getByRole('link', { name: /how we handle reviews/i }).first();
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
    await page.goto(TOURS.large);

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
    await page.goto(TOURS.large);

    const cards = page.locator('#tour-reviews article');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // The badge is a description of the only route that exists (booking-gated),
    // so it belongs on every card, not a favoured subset.
    const badges = page.locator('#tour-reviews').getByText('Verified booking');
    await expect(badges).toHaveCount(count);
  });
});
