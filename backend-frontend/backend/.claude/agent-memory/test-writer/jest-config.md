---
name: jest-config
description: Jest 30 configuration specifics for the backend — flag names, rootDir, module alias
metadata:
  type: reference
---

## Jest version: 30

The backend uses Jest 30. Key behavioral difference from Jest 29:
- CLI flag is `--testPathPatterns` (plural), NOT `--testPathPattern` (singular)
- Passing `--testPathPattern` triggers an error: "Option was replaced by --testPathPatterns"

## Run a single spec file
```bash
pnpm test --testPathPatterns="trips-children"
# or match by full path segment
pnpm test --testPathPatterns="trips/trips-children"
```

## Jest config (from package.json)
```json
{
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "moduleNameMapper": { "^@/(.*)$": "<rootDir>/$1" },
  "testEnvironment": "node",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" }
}
```

- `rootDir` is `src/` — spec files live co-located next to source
- `@/` alias maps to `src/` (ts-jest respects tsconfig paths via moduleNameMapper)
- No global setup file — module state is reset per-suite via `jest.clearAllMocks()` in beforeEach
