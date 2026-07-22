import { connection } from 'next/server';
import type { ComponentProps } from 'react';
import { type Locale } from '@/lib/constants/locales';
import { getTourReviews } from '@/lib/api/public/reviews';
import { REVIEWS_PAGE_SIZE } from '@/lib/api/reviews';
import { toFullReview, toTourReview } from '@/lib/reviews/review-view';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { ReviewFacet, ThemeFacet } from '@/types/review';
import {
    buildTourReviewJsonLd,
    type TourJsonLdProduct,
} from '@/lib/seo/tour-review-jsonld';
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
    /** DISPLAYED rating - the tour's own, or the operator's under LD11. */
    rating: number;
    /** Count behind the displayed rating (the operator's when borrowed). */
    reviewCount: number;
    /** The tour's OWN approved count. Drives every LD30/LD31 render threshold. */
    ownReviewCount: number;
    /** Which entity the displayed rating belongs to (LD11). */
    ratingSource: 'tour' | 'operator' | 'none';
    /** Operator display name, for the LD11 fallback sentence. */
    operatorName: string;
    histogram: { stars: number; count: number }[];
    themes: ThemeFacet[];
    /** Phase 7 depth facets. */
    guestTypes: ReviewFacet[];
    languages: ReviewFacet[];
    /** Approved reviews carrying photos - the FE-10 carousel gate. */
    photoCount: number;
    hostLabel: string;
    /** Locale-prefixed href of the "How we handle reviews" explainer (FE-11). */
    explainerHref: string;
    /** Product facts for the FE-2 structured data. */
    product: TourJsonLdProduct;
    dict: ComponentProps<typeof TourReviewsSection>['dict'];
}

/** Full, paginated reviews section. Streams the first page from the reviews fetch. */
export async function TourReviewsBlock({
    tourId,
    locale,
    rating,
    reviewCount,
    ownReviewCount,
    ratingSource,
    operatorName,
    histogram,
    themes,
    guestTypes,
    languages,
    photoCount,
    hostLabel,
    explainerHref,
    product,
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

    // FE-2. Built from the SAME page of reviews that renders below, so the markup
    // can only ever describe what a visitor can actually see. Emits nothing under
    // the LD11 operator fallback - see the builder for why that matters.
    const jsonLd = buildTourReviewJsonLd({
        product,
        ratingSource,
        rating,
        ownReviewCount,
        visibleReviews: reviewList.data,
    });

    return (
        <>
            {jsonLd && (
                <script
                    type='application/ld+json'
                    // Serialized, not interpolated: `<` inside review text would
                    // otherwise be able to close the script tag.
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
                    }}
                />
            )}
            <TourReviewsSection
                tourId={tourId}
                locale={locale}
                rating={rating}
                reviewCount={reviewCount}
                ownReviewCount={ownReviewCount}
                ratingSource={ratingSource}
                operatorName={operatorName}
                histogram={histogram}
                themes={themes}
                guestTypes={guestTypes}
                languages={languages}
                photoCount={photoCount}
                initialReviews={fullReviews}
                total={reviewList.total}
                pageSize={REVIEWS_PAGE_SIZE}
                hostLabel={hostLabel}
                explainerHref={explainerHref}
                dict={dict}
            />
        </>
    );
}
