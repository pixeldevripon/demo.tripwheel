'use client';

import { useEffect, useState } from 'react';

/**
 * Client leaf for the copyright year. The current time may not be read during
 * prerender - neither in Server Components nor in a Client Component's render
 * (next-prerender-current-time-client) - and baking a build-time year into the
 * static shell would go stale every January. Reading the clock in an effect
 * keeps the prerender clean: the server (and first client render) emit
 * nothing, then the year fills in immediately after hydration with no
 * mismatch.
 */
export function CurrentYear() {
    const [year, setYear] = useState<number | null>(null);

    useEffect(() => {
        setYear(new Date().getFullYear());
    }, []);

    return <>{year ?? ''}</>;
}
