---
name: playwright-conventions
description: Playwright e2e conventions for the Island Tours frontend — file layout, auth, mocking, selector patterns
metadata:
  type: project
---

## Playwright setup (frontend)

- Config: `frontend/playwright.config.ts` — baseURL `http://localhost:3000`, globalSetup runs `e2e/auth.setup.ts`
- Auth: `e2e/auth.setup.ts` hits `http://localhost:5050/api/auth/sign-in/email`, captures session cookie via `ctx.storageState({ path: authFile })`. All tests reuse `e2e/.auth/user.json`.
- Fixtures: `e2e/fixtures/index.ts` simply re-exports `{ test, expect }` from `@playwright/test` — no custom fixture logic. All spec files import from this path.
- Specs live in `e2e/tests/` (may be nested: `e2e/tests/trips/`).
- Relative import from subdirectory spec: `../../fixtures/index`.
- `fullyParallel: false`, `workers: 1`.

## API mocking pattern

- Use `page.route('**/api/v1/<resource>**', ...)` to intercept by method.
- Wildcard `**` on both ends catches all query params.
- For specific IDs: `page.route('**/api/v1/resource/id', ...)`.
- Route mocks are set up BEFORE navigating to the page.
- Active-destinations returns a plain array (not paginated).
- Categories active endpoint also returns a plain array.
- Admin trips uses `/api/v1/trips/admin/all` and returns paginated `{ data, total, page, limit }`.
- Collections list uses `/api/v1/collections/admin/all?destinationSlug=...` and returns a plain array.
- Attributes list uses `/api/v1/attributes` and returns a plain array.

## Selector conventions

- Prefer `getByRole`, `getByText`, `getByPlaceholder`, `locator('input[name="..."]')`.
- Radix Select trigger: `page.getByRole('combobox').filter({ hasText: /placeholder text/i })`.
- Radix Select options: `page.getByRole('option', { name: /.../ })`.
- MultiSelect: uses button/text with placeholder — target via `page.getByText(/placeholder/i)`.
- Toast assertions: `page.getByText(/success message/i)` with `{ timeout: 5_000 }`.
- AlertDialog: `page.getByRole('alertdialog')`.
- Open-menu row actions button: `page.getByRole('button', { name: /open menu/i })`.
- Icon-only buttons: `page.getByRole('button').filter({ has: page.locator('svg') })`.

## Common test patterns

- `test.setTimeout(30_000)` at the top of every file.
- `beforeEach`: set up mocks, navigate, `waitForSelector('table')` or `waitForSelector('form')`.
- `waitForLoadState('networkidle')` for pages with multiple async fetches (hubs, collections).
- Race-condition-free delete: mock the specific resource ID endpoint before clicking.
- Expect toast visibility with `{ timeout: 5_000 }` (Sonner may animate).

**Why:** All established by reviewing `destinations.spec.ts`, `categories.spec.ts`, `hubs.spec.ts`, and `trips/trips.spec.ts`.
**How to apply:** Mirror exactly when writing new spec files. Never import from `@playwright/test` directly — always use `../fixtures/index` (or `../../fixtures/index` from subdirs).
