---
name: Bootstrap Phase Security Findings
description: Security patterns and issues found during Phase 1 (bootstrap) review of NestJS backend src/ — main.ts, env.validate.ts, app.module.ts, app.controller.ts, app.service.ts
type: project
---

Phase 1 bootstrap review completed 2026-04-26. Key facts that carry forward:

**Known gaps to watch in future phases:**
- No global HTTP exception filter exists yet — NestJS default will expose stack traces in dev and internal error shapes in prod. Must be added before Phase 3.
- Swagger UI is unconditionally mounted (no NODE_ENV guard). Acceptable in dev/staging; must be gated before production deploy.
- `enableImplicitConversion: true` on ValidationPipe — a type-coercion risk when future DTOs use numeric/boolean fields without explicit `@Type()` or strict `@IsInt()` decorators. Flag in DTO reviews.
- `sourceMap: true` in tsconfig.json — source maps will be included in dist/. Must be disabled or kept server-side-only before production.
- `CORS_ORIGINS` and `PORT` and `NODE_ENV` are NOT validated in env.validate.ts — silent fallback to localhost:3000. Low risk now, but should be added.
- `.env.example` BETTER_AUTH_SECRET uses a weak placeholder string ("change-me-must-be-at-least-32-characters-long") — the actual .env has a real random secret, which is correct. Validator enforces >=32 chars.
- Health endpoint leaks `environment` (NODE_ENV value) — acceptable for internal monitoring, low risk.
- Trust proxy is set to 1 — correct for single nginx/Cloudflare hop. If topology changes to multiple hops, this needs adjustment.
- ThrottlerModule uses in-memory storage — documented as Phase 5 TODO. In-memory means rate limits don't work across instances until Redis is wired.

**Confirmed secure patterns:**
- `credentials: true` in CORS — correctly implemented per Critical Rule #2.
- CORS origin list comes from env, not hardcoded — correct.
- ValidationPipe with `whitelist: true` + `forbidNonWhitelisted: true` — correct per Critical Rule #13.
- ThrottlerGuard registered as global APP_GUARD — correct per Critical Rule #14.
- `validateEnv()` called before NestFactory.create() — correct crash-early pattern.
- `import 'dotenv/config'` as first line of main.ts — correct.
- .env is in .gitignore — confirmed not committed.
- Frontend .env.local contains no secrets (only NEXT_PUBLIC_BACKEND_URL and BACKEND_API_URL) — correct per Critical Rule #4.
- `@SkipThrottle()` on health endpoint — correct.
- `app.enableShutdownHooks()` — correct for graceful drain.

**Why:** These facts need to persist so future phase reviews can reference what was already audited and what was flagged as "acceptable now, fix before prod."
**How to apply:** In Phase 3+ reviews, immediately flag if exception filter is still missing or Swagger is still unguarded in a production deploy context.
