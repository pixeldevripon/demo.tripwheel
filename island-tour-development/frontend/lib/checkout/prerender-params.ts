import 'server-only';

import { getActiveDestinations } from '@/lib/api/public/destinations';
import { getDestinationTours } from '@/lib/api/public/tours';

/**
 * The prerender seed shared by `/checkout` and `/checkout/processing`.
 *
 * Both routes exist under the same `[destination]/[slug]` tree and both need at
 * least one prerendered entry, or `cacheComponents` turns every layout await
 * into a request-time Blocking Route error. Neither is a content page - one
 * tour per destination is plenty.
 *
 * Shared because the FALLBACK is a fact, not boilerplate. `generateStaticParams`
 * is required by the framework, but the demo-seed tour named below is a specific
 * row in a specific database: rename or unpublish it and both routes need
 * editing, and a build that silently prerenders nothing is how a Blocking Route
 * error reaches production.
 */

/**
 * The demo-seed tour, used when the backend is unreachable at build time.
 * Must stay a real published tour on a real active destination.
 */
const FALLBACK_PARAMS = [
    { destination: 'curacao', slug: 'klein-curacao-super-yacht-beach-house' },
];

export async function checkoutShellParams(): Promise<
    { destination: string; slug: string }[]
> {
    try {
        const destinations = await getActiveDestinations();
        if (destinations && destinations.length > 0) {
            const combos = await Promise.all(
                destinations.map(async (d) => {
                    const { data } = await getDestinationTours({
                        destinationId: d.id,
                        limit: 1,
                    });
                    return data.map((t) => ({
                        destination: d.slug,
                        slug: t.slug,
                    }));
                })
            );
            const flat = combos.flat();
            if (flat.length > 0) return flat;
        }
    } catch {
        // Backend unavailable at build - fall through to the demo-seed tour.
    }
    return FALLBACK_PARAMS;
}
