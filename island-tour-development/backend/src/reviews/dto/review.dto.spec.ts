import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ReviewModerationStatus } from '@prisma/client';
import { ListReviewsQueryDto, ModerateReviewDto } from './review.dto';

const TOUR_ID = '11111111-1111-4111-8111-111111111111';

async function errorsFor(cls: any, data: Record<string, unknown>) {
  return validate(plainToInstance(cls, data));
}

/**
 * The moderation state machine lives in the DTO, not the service: `@IsIn`
 * decides which transitions are even expressible. So this is where it has to be
 * tested - a service test would be asserting against a value the request layer
 * would already have rejected.
 */
describe('ModerateReviewDto - moderation state machine', () => {
  it.each([
    ReviewModerationStatus.APPROVED,
    ReviewModerationStatus.HELD,
    ReviewModerationStatus.REJECTED,
  ])('accepts %s as a transition target', async (status) => {
    const errors = await errorsFor(ModerateReviewDto, {
      status,
      // REJECTED needs a reason, but that rule is enforced in the service; the
      // DTO only decides whether the status itself is expressible.
      rejectionReason: 'Off-topic - does not describe the tour.',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects PENDING - it is entry-only, not a transition target', async () => {
    // A review arrives PENDING and can never be put back. Allowing it would let
    // a moderator quietly un-decide a decision that is already in the audit log.
    const errors = await errorsFor(ModerateReviewDto, {
      status: ReviewModerationStatus.PENDING,
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('status');
  });

  it('rejects an unknown status rather than silently ignoring it', async () => {
    const errors = await errorsFor(ModerateReviewDto, { status: 'DELETED' });
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('status');
  });

  it('caps the rejection reason at 500 chars', async () => {
    const errors = await errorsFor(ModerateReviewDto, {
      status: ReviewModerationStatus.REJECTED,
      rejectionReason: 'x'.repeat(501),
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('rejectionReason');
  });
});

describe('ListReviewsQueryDto - public filters', () => {
  it('accepts a bare tourId', async () => {
    const errors = await errorsFor(ListReviewsQueryDto, { tourId: TOUR_ID });
    expect(errors).toHaveLength(0);
  });

  it.each([1, 5])('accepts rating %i', async (rating) => {
    const errors = await errorsFor(ListReviewsQueryDto, {
      tourId: TOUR_ID,
      rating,
    });
    expect(errors).toHaveLength(0);
  });

  it.each([0, 6])('rejects out-of-range rating %i', async (rating) => {
    const errors = await errorsFor(ListReviewsQueryDto, {
      tourId: TOUR_ID,
      rating,
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('rating');
  });

  it('rejects an unsupported sort instead of falling through to newest', async () => {
    // `helpful` was a real sort once. A bare @IsString would let it through and
    // silently return newest, which reads as a broken sort control.
    const errors = await errorsFor(ListReviewsQueryDto, {
      tourId: TOUR_ID,
      sort: 'helpful',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('sort');
  });

  it('accepts a themeTag and caps it at 60 chars', async () => {
    expect(
      await errorsFor(ListReviewsQueryDto, {
        tourId: TOUR_ID,
        themeTag: 'Great guide',
      }),
    ).toHaveLength(0);

    const tooLong = await errorsFor(ListReviewsQueryDto, {
      tourId: TOUR_ID,
      themeTag: 'x'.repeat(61),
    });
    expect(tooLong).toHaveLength(1);
    expect(tooLong[0].property).toBe('themeTag');
  });

  it('caps limit at 50 so one request cannot pull the whole table', async () => {
    const errors = await errorsFor(ListReviewsQueryDto, {
      tourId: TOUR_ID,
      limit: 51,
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('limit');
  });

  it('requires a UUID tourId', async () => {
    const errors = await errorsFor(ListReviewsQueryDto, {
      tourId: 'not-a-uuid',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('tourId');
  });
});
