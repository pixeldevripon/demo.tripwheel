---
name: Path Alias Handling in E2E Tests
description: @/ alias is NOT resolved in jest-e2e.json; test files must use relative imports
type: feedback
---

`backend/test/jest-e2e.json` has NO `moduleNameMapper` and no `pathsToModuleNameMapper` entry.
The `@/` path alias defined in `tsconfig.json` under `paths` is NOT available to test files.

**Rule:** Test files in `backend/test/` must import using relative paths:
- `import { AppModule } from './../src/app.module'`  ✅
- `import { AllExceptionsFilter } from './../src/common/filters/http-exception.filter'`  ✅
- `import { AppModule } from '@/app.module'`  ❌ — will fail at test runtime

Source files inside `src/` that are loaded at runtime through NestJS module compilation DO resolve `@/` correctly via ts-jest using the tsconfig paths. Only the test entry files themselves must avoid `@/`.

**Why:** The `jest-e2e.json` config does not extend the root jest config which handles `moduleNameMapper`. Adding `moduleNameMapper` would risk breaking the existing `app.e2e-spec.ts` test.

**How to apply:** Never use `@/` in any file directly inside `backend/test/`. Use `'./../src/...'` relative paths for all imports.
