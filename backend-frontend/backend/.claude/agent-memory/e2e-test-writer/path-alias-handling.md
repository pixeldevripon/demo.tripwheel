---
name: Path Alias Handling in E2E Tests
description: jest-e2e.json now HAS a moduleNameMapper for @/ — but relative imports remain the safer, proven-working convention for test files
type: feedback
---

**Update (2026-07):** `backend/test/jest-e2e.json` now DOES contain:
```json
"moduleNameMapper": { "^@/(.*)$": "<rootDir>/../src/$1" }
```
This contradicts this memory's original claim ("no moduleNameMapper, `@/` fails
in test files"). The file has evidently been fixed since that finding — always
re-read `jest-e2e.json` directly before trusting this note; don't assume it's
still accurate.

**Current recommendation:** even though `@/` may now resolve correctly at both
typecheck time (root `tsconfig.json` already has `paths: {"@/*": ["./src/*"]}`)
and at Jest runtime (via the mapper above), keep using relative imports
(`'./../src/app.module'`, `'./../src/auth/auth.instance'`) for new files in
`backend/test/`. Reason: this is unverified end-to-end (no one has run `pnpm
test:e2e` against a file using `@/` yet to confirm runtime resolution under the
`useESM: true` / `extensionsToTreatAsEsm: ['.ts']` config), and it costs
nothing to match the one convention (`test/auth.e2e-spec.ts`) that is known to
actually run green. Only switch to `@/` in test files once a full `pnpm
test:e2e` run has been observed to pass with it.

**How to apply:** In every new `backend/test/*.e2e-spec.ts` file, import
`AppModule`, `AllExceptionsFilter`, and any other `src/` module (e.g.
`auth.instance` for the internalAdapter user-provisioning pattern — see
`auth-testing-patterns.md`) via `'./../src/...'`, never `'@/...'`.
