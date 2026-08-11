import { expect, test, type Page } from '@playwright/test';

/**
 * Public unsubscribe page (email programme WP-F).
 *
 * Two of these tests are self-sufficient: an unknown token and the bare-URL
 * rewrite need nothing seeded, because a random UUID resolving to the shared
 * invalid state IS the behaviour under test.
 *
 * The happy path needs a real `email_unsubscribe_tokens` row, which only the
 * backend can mint (there is deliberately no public issue endpoint). Seed one
 * and pass it in:
 *
 *   psql island_tours -c "INSERT INTO email_unsubscribe_tokens (token, email, audience, stream)
 *     VALUES (gen_random_uuid(), 'e2e-unsub@example.com', 'TRAVELLER', 'MARKETING')
 *     ON CONFLICT (email, audience, stream) DO UPDATE SET email = excluded.email
 *     RETURNING token;"
 *   E2E_UNSUBSCRIBE_TOKEN=<that token> pnpm test:e2e unsubscribe
 *
 * Without the env var the happy-path test skips loudly rather than passing
 * vacuously. NOTE: the confirm click writes a real opt-out row for that
 * email - use a throwaway address, not a seeded traveller's.
 */

/** Valid UUID shape, guaranteed unknown - the backend 404s it, no oracle. */
const UNKNOWN_TOKEN = '00000000-0000-4000-8000-000000000000';

const SEEDED_TOKEN = process.env.E2E_UNSUBSCRIBE_TOKEN;

/**
 * The LIVE unsubscribe card. The page streams the card through a Suspense
 * boundary, and React's streaming SSR parks a second, hidden copy in the DOM
 * as its holding pen - a bare text locator resolves to both and fails strict
 * mode (the `#tour-reviews` lesson, see that spec's header). The card sets
 * `data-hydrated` in an effect; the holding-pen copy never hydrates, so the
 * attribute marks the visible one unambiguously - and waiting on it also
 * waits for interactivity, which the confirm-click test needs regardless.
 */
function card(page: Page) {
  return page.locator('[data-hydrated="true"]');
}

async function gotoUnsubscribe(page: Page, path: string) {
  const response = await page.goto(path);
  await expect(card(page)).toBeVisible({ timeout: 20_000 });
  return response;
}

test.describe('unsubscribe - invalid token', () => {
  test('unknown token renders the one shared invalid state', async ({ page }) => {
    await gotoUnsubscribe(page, `/en/unsubscribe/${UNKNOWN_TOKEN}`);
    await expect(
      card(page).getByText('This link is no longer valid.'),
    ).toBeVisible();
    // No oracle and no half-rendered confirm UI behind it.
    await expect(
      card(page).getByRole('button', { name: 'Unsubscribe' }),
    ).toHaveCount(0);
  });

  test('malformed (non-UUID) token lands on the SAME state - 400 and 404 are indistinguishable', async ({
    page,
  }) => {
    await gotoUnsubscribe(page, '/en/unsubscribe/not-a-uuid');
    await expect(
      card(page).getByText('This link is no longer valid.'),
    ).toBeVisible();
  });
});

test.describe('unsubscribe - bare email URL', () => {
  test('the locale-free URL is REWRITTEN, not redirected', async ({ page }) => {
    // Emails link /unsubscribe/{token} bare; mailbox providers' one-click
    // scanners refuse redirects, so the URL must survive verbatim while the
    // default-locale branch serves the page.
    const response = await gotoUnsubscribe(
      page,
      `/unsubscribe/${UNKNOWN_TOKEN}`,
    );

    expect(response?.status()).toBe(200);
    // The address bar keeps the exact URL that was printed in the email.
    expect(new URL(page.url()).pathname).toBe(`/unsubscribe/${UNKNOWN_TOKEN}`);
    // And no redirect hop happened on the way (a rewrite has no 3xx parent).
    expect(response?.request().redirectedFrom()).toBeNull();

    await expect(
      card(page).getByText('This link is no longer valid.'),
    ).toBeVisible();
  });
});

test.describe('unsubscribe - happy path (needs E2E_UNSUBSCRIBE_TOKEN)', () => {
  test('resolve -> confirm -> success, then the token resolves as already opted out', async ({
    page,
  }) => {
    test.skip(
      !SEEDED_TOKEN,
      'Set E2E_UNSUBSCRIBE_TOKEN to a seeded email_unsubscribe_tokens.token (see file header)',
    );

    // Resolve: the ask names the masked address and writes nothing.
    await gotoUnsubscribe(page, `/unsubscribe/${SEEDED_TOKEN}`);
    await expect(
      card(page).getByRole('heading', { name: /Unsubscribe from/ }),
    ).toBeVisible();
    await expect(card(page).getByText(/This applies to .+\*+.*@/)).toBeVisible();

    // Confirm: the explicit POST.
    await card(page)
      .getByRole('button', { name: 'Unsubscribe', exact: true })
      .click();
    await expect(card(page).getByText("You're unsubscribed.")).toBeVisible();
    await expect(
      card(page).getByText("You won't get these emails anymore."),
    ).toBeVisible();
    // The compliance-bearing reassurance: transactional mail is untouched.
    await expect(
      card(page).getByText(/Emails about your bookings.*always arrive/),
    ).toBeVisible();

    // Idempotence, as a visitor sees it: the same link keeps working and now
    // reports the opt-out instead of asking again.
    await page.reload();
    await expect(card(page)).toBeVisible({ timeout: 20_000 });
    await expect(
      card(page).getByText("You're already unsubscribed."),
    ).toBeVisible();
    await expect(
      card(page).getByRole('button', { name: 'Unsubscribe' }),
    ).toHaveCount(0);
  });
});
