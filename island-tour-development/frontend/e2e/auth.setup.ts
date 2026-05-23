/**
 * Global auth setup — runs once before the full test suite.
 *
 * Uses page.request.post() (browser-context API client) to call the Better Auth
 * sign-in endpoint directly. This shares the browser context's cookie jar, so the
 * session cookie set by localhost:5050 is immediately available to the page context
 * and gets captured in the storageState snapshot.
 *
 * Credentials are read from env vars so they never have to be hard-coded:
 *   TEST_ADMIN_EMAIL    (default: admin@islandtours.com)
 *   TEST_ADMIN_PASSWORD (default: bestPassw0rd)
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';

export const authFile = path.join(__dirname, '.auth/user.json');

setup('authenticate as admin', async ({ page }) => {
  const email = process.env.TEST_ADMIN_EMAIL ?? 'admin@islandtours.com';
  const password = process.env.TEST_ADMIN_PASSWORD ?? 'bestPassw0rd';

  // Call Better Auth sign-in via the browser-context request client.
  // This sets the session cookie on localhost:5050 inside the same cookie jar
  // that the page uses — so API calls with credentials:'include' will work.
  const response = await page.request.post('http://localhost:5050/api/auth/sign-in/email', {
    data: { email, password },
    headers: { 'Content-Type': 'application/json' },
  });

  expect(response.status()).toBe(200);

  // Navigate to the dashboard to confirm the session is valid before saving
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // Persist the full session (cookies + localStorage) so other test projects reuse it
  await page.context().storageState({ path: authFile });
});
