import { Suspense } from 'react';
import { type Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { TourDetailContent } from './tour-detail-content';
import { TourRelatedTours } from './tour-related-tours';
import {
    TourDetailSkeleton,
    TourRelatedSkeleton,
} from '@/components/frontend/skeletons/tour-page-skeleton';

/**
 * Tour detail page - the TOUR branch of the polymorphic `[slug]` route
 * (`/{locale}/{destination}/{tour-slug}/`, always flat - ROUTING-AND-RESOLUTION
 * §5.2). Localized fields fall back to canonical English on the backend; slugs
 * are English at every locale.
 *
 * Streaming: this is a sync shell that lays out the `<Suspense>` boundaries; the
 * section components fetch their own (cached, deduped) data and are marked dynamic
 * with `await connection()` so each boundary streams its section-mirroring skeleton
 * instead of leaving the body blank. Boundaries, by data source:
 *   - `TourDetailContent` (`getTourBySlug`): breadcrumb, header, gallery, booking,
 *     content sections; reviews stream in nested boundaries (`getTourReviews`)
 *   - `TourRelatedTours` (`getDestinationTours`): the two related grids
 *
 * Component files: `tour-detail-content.tsx`, `tour-reviews-blocks.tsx`,
 * `tour-related-tours.tsx`; skeletons in `components/frontend/skeletons/tour-page-skeleton.tsx`.
 */
interface TourPageProps {
    /** Destination slug from the URL (e.g. `curacao`). */
    destinationSlug: string;
    /** Resolved tour slug from the URL (e.g. `sunset-reef-snorkel-boat-tour`). */
    slug: string;
    /** Proper-noun destination display name (resolved by the route). */
    destinationName: string;
    locale: Locale;
    dict: Dictionary;
}

export function TourPage({
    destinationSlug,
    slug,
    destinationName,
    locale,
    dict,
}: TourPageProps) {
    return (
        <>
            <Suspense fallback={<TourDetailSkeleton />}>
                <TourDetailContent
                    destinationSlug={destinationSlug}
                    slug={slug}
                    destinationName={destinationName}
                    locale={locale}
                    dict={dict}
                />
            </Suspense>
            <Suspense fallback={<TourRelatedSkeleton />}>
                <TourRelatedTours
                    destinationSlug={destinationSlug}
                    slug={slug}
                    destinationName={destinationName}
                    locale={locale}
                    dict={dict}
                />
            </Suspense>
        </>
    );
}
