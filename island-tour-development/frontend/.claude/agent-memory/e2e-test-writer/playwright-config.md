---
name: playwright-config
description: playwright.config.ts location, project structure, baseURL, webServer, testDir
metadata:
  type: project
---

`playwright.config.ts` is at the frontend root (`/frontend/playwright.config.ts`).

Key settings:
- `testDir: './e2e/tests'` — all spec files go under `e2e/tests/`
- `fullyParallel: false`, `workers: 1` — tests run serially (important for shared state)
- `baseURL: 'http://localhost:3000'`
- `webServer.command: 'pnpm dev'` with `reuseExistingServer: true`
- Two projects: `setup` (matches `auth.setup.ts`) and `chromium` (depends on `setup`, applies storageState)
- `authFile` is resolved as `path.join(__dirname, 'e2e/.auth/user.json')`

Backend runs at `http://localhost:5050`. API routes are `http://localhost:5050/api/v1/<module>`.
Auth routes are `http://localhost:5050/api/auth/*`.
