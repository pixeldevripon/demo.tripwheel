'use client';

/**
 * Client leaf for the copyright year. Server Components may not read the
 * current time during prerender (next-prerender-current-time), and baking a
 * build-time year into the static shell would go stale every January.
 */
export function CurrentYear() {
    return <>{new Date().getFullYear()}</>;
}
