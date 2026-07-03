import { connection } from 'next/server';
import type { ComponentProps } from 'react';
import { type Locale } from '@/lib/constants/locales';
import { getTourReviews } from '@/lib/api/public/reviews';
import { REVIEWS_PAGE_SIZE } from '@/lib/api/reviews';
import { toFullReview, toTourReview } from '@/lib/reviews/review-view';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { TourReviews } from './tour-reviews';
import { TourReviewsSection } from './tour-reviews-section';

/**
 * Async review sections for the tour detail page. Each fetches the tour's
 * reviews (`getTourReviews`, cached - the two dedupe to one request) and is
 * marked dynamic via `await connection()` so its `<Suspense>` fallback (skeleton)
 * actually streams under Cache Components, rather than being prerendered inline.
 * The aggregate (rating / count / histogram) comes from the tour payload and is
 * passed in by the parent.
 */

interface TourReviewsPreviewProps {
    tourId: string;
    rating: number | null;
    reviewCount: number;
    locale: Locale;
    dict: Dictionary['destination']['tour']['reviews'];
}

/** Two-newest review preview strip (gallery column). */
export async function TourReviewsPreview({
    tourId,
    rating,
    reviewCount,
    locale,
    dict,
}: TourReviewsPreviewProps) {
    await connection();
    const reviewList = await getTourReviews({
        tourId,
        locale,
        limit: REVIEWS_PAGE_SIZE,
    });
    if (reviewList.total === 0) return null;

    const previewReviews = reviewList.data
        .slice(0, 2)
        .map(r => toTourReview(r, locale));

    return (
        <TourReviews
            rating={rating}
            reviewCount={reviewCount}
            reviews={previewReviews}
            locale={locale}
            dict={dict}
        />
    );
}

interface TourReviewsBlockProps {
    tourId: string;
    locale: Locale;
    rating: number;
    reviewCount: number;
    histogram: { stars: number; count: number }[];
    hostLabel: string;
    dict: ComponentProps<typeof TourReviewsSection>['dict'];
}

/** Full, paginated reviews section. Streams the first page from the reviews fetch. */
export async function TourReviewsBlock({
    tourId,
    locale,
    rating,
    reviewCount,
    histogram,
    hostLabel,
    dict,
}: TourReviewsBlockProps) {
    await connection();
    const reviewList = await getTourReviews({
        tourId,
        locale,
        limit: REVIEWS_PAGE_SIZE,
    });
    const fullReviews = reviewList.data.map(r =>
        toFullReview(r, locale, hostLabel),
    );

    return (
        <TourReviewsSection
            tourId={tourId}
            locale={locale}
            rating={rating}
            reviewCount={reviewCount}
            histogram={histogram}
            initialReviews={fullReviews}
            total={reviewList.total}
            pageSize={REVIEWS_PAGE_SIZE}
            hostLabel={hostLabel}
            dict={dict}
        />
    );
}
