import { Suspense } from 'react';
import { type Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { TourDetailContent } from './tour-detail-content';
import { TourDetailSkeleton } from '@/components/frontend/skeletons/tour-page-skeleton';

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
 *   (related tours render in a nested boundary INSIDE the detail column)
 *
 * There is deliberately NO FAQ block here. Tours do not have FAQs at all (user
 * decision 2026-07-21) - the question a traveller would ask is answered by the
 * structured fields this page already renders (inclusions, exclusions, what to
 * bring, know before you go). Do not add a section for them.
 *
 * Component files: `tour-detail-content.tsx`, `tour-reviews-blocks.tsx`,
 * `tour-related-tours.tsx`; skeletons in
 * `components/frontend/skeletons/tour-page-skeleton.tsx`.
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
    /**
     * A day the traveller already chose upstream, from `?date=` in the URL.
     * Preselected in the booking widget so the question is not asked twice.
     *
     * Deliberately NOT part of the canonical URL (see the route's metadata):
     * one tour must not become a separate indexable page per date anyone ever
     * searched.
     */
    initialDate?: string;
}

export function TourPage({
    destinationSlug,
    slug,
    destinationName,
    locale,
    dict,
    initialDate,
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
                    initialDate={initialDate}
                />
            </Suspense>
        </>
    );
}
