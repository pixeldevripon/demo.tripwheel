// DEMO SEED — Customer rows (the user <-> operator relationship the dashboard's
// customer list reads) + the stable, always-usable review demo links.

import { BookingStatus, ReviewModerationStatus } from '@prisma/client';
import { DEMO_TOUR_REF, log, prisma, section } from './_shared';

/**
 * How many bookings are deliberately LEFT un-reviewed with a live invitation.
 *
 * The base seed reviews every completed booking, which is right for the tour
 * pages but leaves nothing to demonstrate the collection flow with - every link
 * is already spent. This reserves a pool so "here is a guest who has travelled
 * and still owes you a review" is always a real state you can click through.
 */
const REVIEW_READY_TARGET = 20;

/** Stable, human-readable tokens that must work after EVERY seed run. */
const DEMO_TOKENS = ['demo-review-1', 'demo-review-2', 'demo-review-3'];

/**
 * Travellers who always have several trips waiting to be reviewed.
 *
 * Without this the reserved pool is scattered one-booking-per-person across
 * dozens of accounts, so logging in as any single customer shows a dashboard of
 * upcoming trips and nothing to review - which is exactly what the customer
 * dashboard looked like, and it reads as a broken feature rather than an empty
 * one. Concentrating the pool means one login demonstrates the whole flow.
 */
const DEMO_REVIEW_CUSTOMERS = [
  'traveler.t01@demo.islandtours.test',
  'traveler.t02@demo.islandtours.test',
  'traveler.t03@demo.islandtours.test',
];
/** Completed bookings freed for review per demo customer. */
const PER_CUSTOMER_AWAITING = 4;

/**
 * Customer rows.
 *
 * Mirrors `CustomerProvisioningService.recomputeAggregates` exactly - same
 * source (CONFIRMED/REDEEMED bookings), same four fields - because the customer
 * list must show the same numbers whether a row was written by a real booking
 * or by this seed. Diverging here would make the demo lie about the product.
 */
export async function seedCustomers(): Promise<void> {
  section('Customers');

  const pairs = await prisma.booking.groupBy({
    by: ['userId', 'operatorId'],
    where: {
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.REDEEMED] },
      userId: { not: null },
      tour: { reference: DEMO_TOUR_REF },
    },
    _count: { _all: true },
    _sum: { totalEur: true },
    _min: { utcConfirmedAt: true, createdAt: true },
    _max: { utcConfirmedAt: true, createdAt: true },
  });

  let written = 0;
  for (const p of pairs) {
    if (!p.userId) continue;
    const data = {
      // Same fallback as the service - see recomputeAggregates.
      firstBookingAt: p._min.utcConfirmedAt ?? p._min.createdAt,
      lastBookingAt: p._max.utcConfirmedAt ?? p._max.createdAt,
      bookingsCount: p._count._all,
      totalSpendEur: p._sum.totalEur ?? 0,
    };
    await prisma.customer.upsert({
      where: {
        userId_operatorId: { userId: p.userId, operatorId: p.operatorId },
      },
      create: { userId: p.userId, operatorId: p.operatorId, ...data },
      update: data,
    });
    written++;
  }

  log(`Customers: ${written} user/operator relationships upserted.`);
}

/**
 * Review demo links - guaranteed to work after every seed.
 *
 * ## Why this resets rather than just creating
 * An invitation token is single-use BY DESIGN: press a star and it dies. That is
 * correct for real guests and useless for a demo, where the same three links
 * need to work again tomorrow. So this step actively RESTORES them: it clears
 * any review submitted through a demo token and un-spends the token.
 *
 * That deletion is safe precisely because it is scoped to these three fixed
 * tokens - it can never touch a review that arrived any other way.
 *
 * Also reserves {@link REVIEW_READY_TARGET} further bookings in the
 * "travelled, not yet reviewed" state with live invitations, so the dashboard
 * and the customer list have something to show beyond the three named links.
 */
export async function seedReviewDemoLinks(): Promise<void> {
  section('Review demo links');

  // 1. Free up the fixed tokens: drop any review submitted through one, so the
  //    booking is reviewable again.
  const existing = await prisma.reviewInvitation.findMany({
    where: { token: { in: DEMO_TOKENS } },
    select: { bookingId: true },
  });
  if (existing.length > 0) {
    await prisma.review.deleteMany({
      where: { bookingId: { in: existing.map((e) => e.bookingId) } },
    });
    await prisma.reviewInvitation.deleteMany({
      where: { token: { in: DEMO_TOKENS } },
    });
  }

  // 2. Give the named demo travellers a visible backlog.
  //
  //    Their existing reviews on completed trips are removed so the bookings
  //    become reviewable again. Scoped to these three accounts, so it can never
  //    touch a review that arrived any other way - the same containment the
  //    fixed tokens above rely on.
  let freed = 0;
  for (const email of DEMO_REVIEW_CUSTOMERS) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) continue;

    const theirs = await prisma.booking.findMany({
      where: {
        userId: user.id,
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.REDEEMED] },
        tour: { reference: DEMO_TOUR_REF },
        tourEndDateTime: { lt: new Date() },
      },
      select: { id: true, review: { select: { id: true } } },
      orderBy: { localDate: 'desc' },
      take: PER_CUSTOMER_AWAITING,
    });

    for (const b of theirs) {
      if (b.review) {
        await prisma.review.delete({ where: { id: b.review.id } });
      }
      await prisma.reviewInvitation.upsert({
        where: { bookingId: b.id },
        create: { bookingId: b.id },
        update: { revokedAt: null, completedAt: null, suppressedReason: null },
      });
      freed++;
    }
  }

  // 3. Candidates: travelled, completed, and carrying no review.
  const candidates = await prisma.booking.findMany({
    where: {
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.REDEEMED] },
      tour: { reference: DEMO_TOUR_REF },
      review: { is: null },
      userId: { not: null },
      contactEmail: { not: null },
      tourEndDateTime: { lt: new Date() },
    },
    select: { id: true, displayRef: true, contactEmail: true },
    orderBy: { localDate: 'desc' },
    take: REVIEW_READY_TARGET + DEMO_TOKENS.length,
  });

  if (candidates.length === 0) {
    log('! No un-reviewed completed bookings — demo links not created.');
    return;
  }

  // 4. The three named links.
  const named: string[] = [];
  for (const [i, token] of DEMO_TOKENS.entries()) {
    const booking = candidates[i];
    if (!booking) break;
    await prisma.reviewInvitation.upsert({
      where: { bookingId: booking.id },
      create: { bookingId: booking.id, token },
      update: {
        token,
        revokedAt: null,
        completedAt: null,
        suppressedReason: null,
      },
    });
    named.push(`${token} -> ${booking.displayRef} (${booking.contactEmail})`);
  }

  // 5. The rest of the pool gets ordinary invitations, so the "awaiting review"
  //    count on the customer list is a real number rather than three.
  let pool = 0;
  for (const booking of candidates.slice(DEMO_TOKENS.length)) {
    const created = await prisma.reviewInvitation.upsert({
      where: { bookingId: booking.id },
      create: { bookingId: booking.id },
      update: { revokedAt: null, completedAt: null, suppressedReason: null },
      select: { id: true },
    });
    if (created) pool++;
  }

  log(`Review demo links (always usable):`);
  for (const n of named) log(`  ${n}`);
  log(`  + ${pool} more bookings left awaiting a review.`);
  log(
    `  ${freed} bookings freed across ${DEMO_REVIEW_CUSTOMERS.length} demo customers ` +
      `(${PER_CUSTOMER_AWAITING} each) - log in as any of them to see the CTA:`,
  );
  for (const e of DEMO_REVIEW_CUSTOMERS) log(`    ${e}`);
}

/**
 * Guard used by the reviews seed: bookings reserved for the demo must NOT be
 * auto-reviewed, or the pool is consumed the moment the seed runs again.
 */
export async function reservedBookingIds(): Promise<Set<string>> {
  const rows = await prisma.reviewInvitation.findMany({
    where: {
      completedAt: null,
      revokedAt: null,
      booking: { review: { is: null } },
    },
    select: { bookingId: true },
  });
  return new Set(rows.map((r) => r.bookingId));
}

/** Statuses a review-demo booking may hold. Exported for the checklist's sake. */
export const REVIEW_DEMO_TOKENS = DEMO_TOKENS;
