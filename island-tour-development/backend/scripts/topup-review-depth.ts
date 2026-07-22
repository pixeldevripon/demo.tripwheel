/**
 * Applies the review-DEPTH top-up to an already-seeded database, without the
 * destructive full re-seed.
 *
 * `topUpReviewDepth()` normally runs as part of `seedReviews()`. This runner
 * exists because the demo data on a working database predates it, and
 * `prisma:seed:demo:clean` would take every booking, payment and tour with it -
 * a very expensive way to add reviews to three tours.
 *
 * Idempotent: the top-up fills each showcase tour UP TO its target, so running
 * this twice adds nothing the second time.
 *
 *   pnpm ts-node -r tsconfig-paths/register scripts/topup-review-depth.ts
 */
import { ReviewModerationStatus } from '@prisma/client';
import { prisma, roundRating } from '../prisma/demo/_shared';
import { topUpReviewDepth } from '../prisma/demo/reviews';

async function main() {
  const { tourIds, operatorIds } = await topUpReviewDepth();

  if (tourIds.length === 0) {
    console.log('Nothing to top up.');
    return;
  }

  // Same recompute the seed does - the new rows have to land in the aggregates
  // or the tour page keeps rendering the old count.
  for (const tourId of tourIds) {
    const where = {
      tourId,
      moderationStatus: ReviewModerationStatus.APPROVED,
    };
    const [agg, byStar, photoCount] = await Promise.all([
      prisma.review.aggregate({ where, _count: true, _avg: { rating: true } }),
      prisma.review.groupBy({ by: ['rating'], where, _count: true }),
      prisma.review.count({
        where: { ...where, NOT: { photos: { isEmpty: true } } },
      }),
    ]);
    await prisma.tour.update({
      where: { id: tourId },
      data: {
        aggregateRating: roundRating(agg._avg.rating),
        aggregateReviewCount: agg._count,
        ratingDistribution: [5, 4, 3, 2, 1].map(
          (s) => byStar.find((g) => g.rating === s)?._count ?? 0,
        ),
        photoReviewCount: photoCount,
        aggregatesUpdatedAt: new Date(),
      },
    });
  }

  for (const operatorId of operatorIds) {
    const agg = await prisma.review.aggregate({
      where: { operatorId, moderationStatus: ReviewModerationStatus.APPROVED },
      _count: true,
      _avg: { rating: true },
    });
    await prisma.operator.update({
      where: { id: operatorId },
      data: {
        aggregateRating: roundRating(agg._avg.rating),
        aggregateReviewCount: agg._count,
        aggregatesUpdatedAt: new Date(),
      },
    });
  }

  console.log(
    `Recomputed aggregates for ${tourIds.length} tours / ${operatorIds.length} operators.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
