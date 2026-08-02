import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

/**
 * Unit / component test runner for the public site.
 *
 * WHY VITEST AND NOT JEST. The backend is Jest because NestJS is, but this app
 * is ESM-first, path-aliased (`@/*`), and full of `.tsx` - the exact setup Jest
 * needs a transform stack and a moduleNameMapper to survive. Vitest reads the
 * same `tsconfig.json` paths through `vite-tsconfig-paths` and needs no Babel
 * config, so there is nothing to keep in sync when the aliases change.
 *
 * SCOPE. This covers pure modules, route handlers and client components -
 * everything testable without a running Next server. It deliberately does NOT
 * replace Playwright: async Server Components, `'use cache'` semantics, PPR
 * boundaries and the real cookie jar are only honest in `e2e/`. The `exclude`
 * below keeps the two runners from picking up each other's specs.
 */
export default defineConfig({
    plugins: [tsconfigPaths(), react()],
    test: {
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.ts'],
        // Colocated: `foo.ts` is tested by `foo.test.ts` beside it, so a moved
        // file takes its test with it and an untested module is visible in the
        // directory listing rather than hidden in a parallel tree.
        include: ['{app,components,hooks,lib}/**/*.test.{ts,tsx}', '*.test.ts'],
        // `e2e/` is Playwright's; its `test`/`expect` come from a different
        // package and throw under Vitest.
        exclude: ['node_modules/**', '.next/**', 'e2e/**'],
        restoreMocks: true,
        css: false,
        coverage: {
            provider: 'v8',
            include: ['app/**', 'components/**', 'hooks/**', 'lib/**'],
            exclude: [
                // Generated shadcn primitives - regenerating them would discard
                // any test written against their internals.
                'components/ui/**',
                '**/*.test.{ts,tsx}',
                '**/loading.tsx',
                'lib/i18n/dictionaries/**',
            ],
        },
    },
});
