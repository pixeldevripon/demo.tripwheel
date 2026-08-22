---
name: playwright-auth-setup
description: storageState pattern for admin session; auth.setup.ts already written; how fixtures/index.ts is used
metadata:
  type: project
---

The global auth setup file lives at `e2e/auth.setup.ts` (already written). It:
- Navigates to `/login`
- Fills `#email` and `#password` (the LoginForm uses `id` attributes, not `name`)
- Clicks `button[type="submit"]`
- Waits for `**/dashboard**`
- Saves storageState to `e2e/.auth/user.json`

The `playwright.config.ts` wires this up: the `setup` project matches `auth.setup.ts`, and the `chromium` project depends on `setup` and sets `storageState: authFile`. No custom fixture logic is needed.

`e2e/fixtures/index.ts` is a thin re-export of `{ test, expect }` from `@playwright/test`. All spec files import from `'../fixtures/index'` for a consistent import path.

Credentials come from env vars:
- `TEST_ADMIN_EMAIL` (default: `admin@test.com`)
- `TEST_ADMIN_PASSWORD` (default: `Test1234!`)

**Why:** Playwright recommends the storageState pattern to avoid re-authenticating for every test.
**How to apply:** Never implement login inside a `beforeEach`. Add new test projects to `playwright.config.ts` with `dependencies: ['setup']` and `storageState: authFile`.
