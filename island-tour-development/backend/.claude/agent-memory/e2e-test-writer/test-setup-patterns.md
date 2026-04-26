---
name: Test Setup Patterns
description: How to bootstrap the NestJS E2E test app, mirror main.ts, and clean up via PrismaClient
type: project
---

Use `Test.createTestingModule({ imports: [AppModule] })` — no module overrides needed for auth E2E.

Apply these in `beforeAll` to mirror `main.ts` exactly:
- `app.setGlobalPrefix('api/v1', { exclude: ['api/auth/*path'] })`
- `app.useGlobalFilters(new AllExceptionsFilter())`
- `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`
- `app.enableShutdownHooks()`
- `await app.init()`

Use `new PrismaClient()` directly for cleanup (not PrismaService from the app) to avoid lifecycle coupling.
Track created emails in a `createdEmails: string[]` array and bulk-delete in `afterEach`.
Wrap deletions in try/catch — a failed sign-up leaves no row to delete.

**Why:** Mirrors production config; using PrismaService would require accessing the module ref and risks double-disconnect.
**How to apply:** Copy this pattern for every new E2E describe block.
