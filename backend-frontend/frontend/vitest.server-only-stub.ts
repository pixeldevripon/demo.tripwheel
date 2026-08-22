/**
 * Test stand-in for the `server-only` marker (see the alias in
 * `vitest.config.ts`). Deliberately empty: the real module's only behaviour
 * is to make CLIENT bundlers fail the build, and there is no bundler-lane
 * distinction inside Vitest to enforce.
 */
export {};
