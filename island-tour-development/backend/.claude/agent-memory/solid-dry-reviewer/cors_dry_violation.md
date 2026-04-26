---
name: CORS Origins DRY Violation
description: CORS_ORIGINS env parsing is duplicated between main.ts and auth.instance.ts — project-wide pattern to fix
type: project
---

The `CORS_ORIGINS` env var is parsed (split on comma, trim, filter) in two places:
- `backend/src/main.ts` lines 38–40 (for `app.enableCors()`)
- `backend/src/auth/auth.instance.ts` lines 22–25 (for Better Auth `trustedOrigins`)

The `main.ts` version also lacks `.filter(Boolean)`, meaning an accidental trailing comma in the env var would produce an empty-string origin that silently passes the CORS check.

**Fix:** Extract to a shared utility, e.g. `src/common/utils/cors-origins.ts`, and import in both places.

**Why:** This is a systemic DRY violation. If the parsing logic ever needs to change (e.g. support wildcard subdomains), it must be updated in two places. The missing `.filter(Boolean)` in main.ts is a latent bug.

**How to apply:** Flag this pattern if a third call site appears. Fix it in the same PR as the first feature that touches CORS config.
