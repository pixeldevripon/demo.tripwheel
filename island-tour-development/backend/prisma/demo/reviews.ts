// DEMO SEED — booking-gated reviews (one per REDEEMED booking) + per-locale
// comments, then recomputes Tour + Operator aggregates exactly like
// ReviewsService.recomputeAggregates (plus ratingDistribution + photoReviewCount).
//
// Enough reviews are APPROVED to clear the homepage social-proof gate (>=100).

import {
  BookingStatus,
  Locale,
  Prisma,
  ReviewModerationStatus,
  ReviewResponseAuthor,
  ReviewerType,
} from '@prisma/client';
import {
  ALL_LOCALES,
  DEMO_TOUR_REF,
  intBetween,
  log,
  pick,
  prisma,
  rng,
  roundRating,
  section,
  themedPhoto,
  tourTheme,
} from './_shared';
import { SHOWCASE_MOST_POPULAR } from './tours';

const COMMENTS_5 = [
  'Absolutely the highlight of our trip. The crew was warm, knowledgeable, and clearly proud of their island. We saw turtles up close and the lunch was delicious.',
  'Could not recommend this more. Small group, genuine local guide, and unforgettable scenery. Worth every cent.',
  'Perfect from start to finish. Easy booking, on-time pickup, and a guide who made everyone feel like family.',
  'A magical day. The water was crystal clear and our guide knew exactly where to take us. Book it!',
];
const COMMENTS_4 = [
  'Really enjoyed it. The experience was great and the guide was friendly; only wish it had been a little longer.',
  'Great value and a lovely day out. Slightly crowded at one stop but the team handled it well.',
  'Wonderful trip overall. Well organised and safe. Would happily do it again.',
];
const COMMENTS_3 = [
  'Good experience but felt a bit rushed at points. The guide was nice and the views made up for it.',
  'Decent tour. Nothing went wrong, just not as special as we hoped. Still glad we went.',
];
const OPERATOR_RESPONSES = [
  'Thank you so much for the kind words — it was a pleasure having you aboard! Come back and see us soon.',
  'We really appreciate your feedback and are so glad you enjoyed the day. Safe travels!',
  'Thanks for the great review! We have shared it with the whole crew.',
];
const TITLES = [
  'Unforgettable day',
  'Highlight of our holiday',
  'Exactly what we hoped for',
  'Great local experience',
  'Would book again',
  'Loved every minute',
];

function commentFor(rating: number, r: number): string {
  if (rating >= 5) return pick(COMMENTS_5, r);
  if (rating === 4) return pick(COMMENTS_4, r);
  return pick(COMMENTS_3, r);
}

/**
 * Canonical theme vocabulary for the review chips (FE-9).
 *
 * `themeTags` is a free-text `String[]` because admins set it by hand, but the
 * demo data deliberately sticks to ONE vocabulary: chips are grouped by exact
 * string match, so a seed that invented a fresh phrase per review would render
 * a chip bar where every chip reads "1" - technically correct and completely
 * useless as a filter. The wording tracks what the seeded comments actually say.
 */
const THEMES_POSITIVE = [
  'Great guide',
  'Well organised',
  'Beautiful scenery',
  'Good value',
  'Felt safe',
  'Family friendly',
];
/** What a 3-star review can still honestly be tagged with. */
const THEMES_MIXED = ['Beautiful scenery', 'Felt rushed', 'Good value'];

/** 1-3 distinct tags, deterministic in `i` so re-seeding is reproducible. */
function themesFor(rating: number, i: number): string[] {
  const pool = rating >= 4 ? THEMES_POSITIVE : THEMES_MIXED;
  const count = rating >= 4 ? (i % 3) + 1 : (i % 2) + 1;
  const out = new Set<string>();
  for (let k = 0; k < count; k++) out.add(pool[(i * 2 + k * 3) % pool.length]);
  return [...out];
}

/**
 * Guest type (LD36). Left NULL on roughly a fifth of reviews on purpose - it is
 * the one optional step in the submit flow, so a dataset where every review has
 * it would hide the "card renders fine without it" case from every reviewer.
 */
const GUEST_TYPES = [
  ReviewerType.COUPLE,
  ReviewerType.FAMILY,
  ReviewerType.FRIENDS,
  ReviewerType.SOLO,
] as const;

function guestTypeFor(i: number): ReviewerType | null {
  return i % 5 === 3 ? null : GUEST_TYPES[i % GUEST_TYPES.length];
}

export async function seedReviews(): Promise<void> {
  section('Reviews + aggregates');

  // Reviewable bookings = REDEEMED demo bookings without an existing review.
  const bookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.REDEEMED,
      tour: { reference: DEMO_TOUR_REF },
      review: { is: null },
    },
    select: {
      id: true,
      tourId: true,
      operatorId: true,
      userId: true,
      localDate: true,
      contactFirstName: true,
      contactLastName: true,
      contactCountry: true,
      tour: { select: { slug: true } },
    },
  });

  if (bookings.length === 0) {
    log('No reviewable bookings — skipping reviews.');
    return;
  }

  let created = 0;
  let approved = 0;
  let withPhotos = 0;
  const touchedTours = new Set<string>();
  const touchedOperators = new Set<string>();

  for (const [i, b] of bookings.entries()) {
    if (!b.userId) continue;
    const r = rng(5000 + i);

    // Badge showcase (master §3.6 "Most popular"): these tours must clear
    // review_count >= 10 AND rating >= 4.5, so every review is an approved 5-star
    // (they also receive >= 10 redeemed bookings in bookings-payments.ts).
    const isMostPopular = SHOWCASE_MOST_POPULAR.has(b.tour.slug);

    // Skew positive: ~70% five-star, ~22% four, ~8% three.
    const roll = r();
    const rating = isMostPopular ? 5 : roll > 0.3 ? 5 : roll > 0.08 ? 4 : 3;

    // Moderation: most approved; a few pending/rejected for queue realism.
    let moderationStatus: ReviewModerationStatus =
      ReviewModerationStatus.APPROVED;
    if (!isMostPopular && i % 13 === 7)
      moderationStatus = ReviewModerationStatus.PENDING;
    else if (!isMostPopular && i % 19 === 11)
      moderationStatus = ReviewModerationStatus.REJECTED;

    const initial = `${b.contactFirstName ?? 'Guest'} ${(b.contactLastName ?? 'T').charAt(0)}.`;
    // Traveler photos match what the tour actually is (a snorkel review shows
    // reef/turtle shots, a catamaran review shows the boat) - offset by the
    // review index so different reviews of one tour show different photos.
    const hasPhotos = r() > 0.7;
    const photos = hasPhotos
      ? Array.from({ length: intBetween(r(), 1, 3) }, (_, p) =>
          themedPhoto(tourTheme(b.tour.slug), i + p, 1080, 810),
        )
      : [];
    const comment = commentFor(rating, r());
    const addResponse =
      moderationStatus === ReviewModerationStatus.APPROVED && r() > 0.7;

    await prisma.review.create({
      data: {
        bookingId: b.id,
        tourId: b.tourId,
        operatorId: b.operatorId,
        userId: b.userId,
        rating,
        ratingValue: Math.min(5, Math.max(1, rating - (r() > 0.6 ? 1 : 0))),
        ratingGuide: rating,
        ratingSafety: 5,
        title: pick(TITLES, r()),
        reviewerFirstName: b.contactFirstName,
        reviewerInitial: initial,
        reviewerCountry: b.contactCountry,
        travelMonth: b.localDate.getUTCMonth() + 1,
        travelYear: b.localDate.getUTCFullYear(),
        reviewerType: guestTypeFor(i),
        themeTags: themesFor(rating, i),
        photos,
        isVerified: true,
        helpfulCount: intBetween(r(), 0, 28),
        moderationStatus,
        rejectionReason:
          moderationStatus === ReviewModerationStatus.REJECTED
            ? 'Off-topic / does not describe the tour experience.'
            : null,
        responseText: addResponse ? pick(OPERATOR_RESPONSES, r()) : null,
        // LD37: responses are platform-authored at launch.
        responseAuthor: addResponse ? ReviewResponseAuthor.PLATFORM : null,
        responseAt: addResponse ? new Date() : null,
        translations: {
          create: ALL_LOCALES.map((locale) => ({
            locale,
            comment,
            isMachineTranslated: locale !== Locale.en,
          })),
        },
      },
    });
    created++;
    if (moderationStatus === ReviewModerationStatus.APPROVED) approved++;
    if (hasPhotos && moderationStatus === ReviewModerationStatus.APPROVED)
      withPhotos++;
    touchedTours.add(b.tourId);
    touchedOperators.add(b.operatorId);
  }

  // ── Recompute aggregates (mirror ReviewsService.recomputeAggregates + extras) ──
  for (const tourId of touchedTours) {
    const where: Prisma.ReviewWhereInput = {
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
    // [5★,4★,3★,2★,1★]
    const distribution = [5, 4, 3, 2, 1].map(
      (s) => byStar.find((g) => g.rating === s)?._count ?? 0,
    );
    await prisma.tour.update({
      where: { id: tourId },
      data: {
        aggregateRating: roundRating(agg._avg.rating),
        aggregateReviewCount: agg._count,
        ratingDistribution: distribution,
        photoReviewCount: photoCount,
        aggregatesUpdatedAt: new Date(),
      },
    });
  }
  for (const operatorId of touchedOperators) {
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

  log(
    `Reviews: ${created} created (${approved} approved, ${withPhotos} approved-with-photos). Aggregates recomputed for ${touchedTours.size} tours / ${touchedOperators.size} operators.`,
  );
  if (approved < 100)
    log(
      `! Only ${approved} approved reviews — homepage social-proof strip (>=100) will stay hidden.`,
    );
}
