import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, 'e2e/.auth/user.json');

export default defineConfig({
  globalSetup: './e2e/auth.setup.ts',
  testDir: './e2e/tests',
  outputDir: './e2e/test-results',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  reporter: [
    ['html', { outputFolder: 'e2e/playwright-report', open: 'never' }],
    ['list'],
  ],

  use: {
    // 3001, not 3000: since the extraction, 3000 belongs to the PUBLIC site (it
    // is what REVALIDATE_TARGET_URL points at in .env.local.example). With
    // `reuseExistingServer` below, a baseURL of 3000 would silently attach to
    // the public site and run this suite against the wrong app.
    baseURL: 'http://localhost:3001',
    storageState: authFile,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
