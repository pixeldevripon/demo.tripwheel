/**
 * Re-exports test and expect from @playwright/test.
 *
 * storageState is applied globally via playwright.config.ts (the "chromium"
 * project depends on "setup" and sets storageState: authFile), so no custom
 * fixture logic is needed here. All test files import from this module so the
 * import path is consistent and we have a single place to extend later.
 */

export { test, expect } from '@playwright/test';
