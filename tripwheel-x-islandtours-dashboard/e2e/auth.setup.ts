/**
 * Global auth setup - runs once before the full test suite via globalSetup.
 *
 * Uses Playwright's APIRequestContext to call the Better Auth sign-in endpoint
 * and captures the session cookie via storageState. The saved file is loaded by
 * the chromium project so every spec test starts already authenticated.
 *
 * Credentials are read from env vars so they never have to be hard-coded:
 *   TEST_ADMIN_EMAIL    (default: admin@islandtours.com)
 *   TEST_ADMIN_PASSWORD (default: bestPassw0rd)
 */

import { request } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const authFile = path.join(__dirname, '.auth/user.json');

export default async function globalSetup() {
  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const email = process.env.TEST_ADMIN_EMAIL ?? 'admin@islandtours.com';
  const password = process.env.TEST_ADMIN_PASSWORD ?? 'bestPassw0rd';

  const ctx = await request.newContext();

  const response = await ctx.post('http://localhost:5050/api/auth/sign-in/email', {
    data: { email, password },
    // Sign-in requires the login-surface header (per-door enforcement).
    // ADMIN passes every door; 'admin' is its canonical surface.
    headers: { 'Content-Type': 'application/json', 'x-login-surface': 'admin' },
  });

  if (!response.ok()) {
    await ctx.dispose();
    throw new Error(`Auth setup failed: ${response.status()} ${await response.text()}`);
  }

  await ctx.storageState({ path: authFile });
  await ctx.dispose();
}
