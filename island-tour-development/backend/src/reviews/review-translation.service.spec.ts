import { Locale, ReviewModerationStatus } from '@prisma/client';
import { ReviewTranslationService } from './review-translation.service';

/**
 * LD32. The cases that matter here are the ones that cost money or lose a
 * guest's own words - re-translating unchanged text, and overwriting an
 * original with machine output.
 */

function mockPrisma(): any {
  return {
    review: { findUnique: jest.fn(), findMany: jest.fn() },
    reviewTranslation: { upsert: jest.fn().mockResolvedValue({}) },
  };
}

const SOURCE = 'The crew were wonderful and the water was crystal clear.';

function review(over: Record<string, any> = {}) {
  return {
    id: 'r1',
    moderationStatus: ReviewModerationStatus.APPROVED,
    translations: [
      {
        id: 't-en',
        locale: Locale.en,
        comment: SOURCE,
        isMachineTranslated: false,
        sourceHash: null,
      },
    ],
    ...over,
  };
}

/** Stub the provider so no test ever reaches the network. */
function stubFetch(text = '[translated]') {
  return jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ translations: [{ translatedText: text }] }),
  });
}

describe('ReviewTranslationService', () => {
  let prisma: any;
  let svc: ReviewTranslationService;
  const realFetch = global.fetch;

  beforeEach(() => {
    prisma = mockPrisma();
    svc = new ReviewTranslationService(prisma);
    process.env.GOOGLE_TRANSLATE_API_KEY = 'test-key-aaaaaaaaaaaaaaaaaaaa';
    process.env.GOOGLE_TRANSLATE_PROJECT_ID = 'island-tours-test';
    global.fetch = stubFetch() as any;
  });

  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.GOOGLE_TRANSLATE_API_KEY;
    delete process.env.GOOGLE_TRANSLATE_PROJECT_ID;
  });

  describe('when unconfigured', () => {
    it('is inert rather than throwing', async () => {
      delete process.env.GOOGLE_TRANSLATE_API_KEY;
      expect(svc.isEnabled).toBe(false);

      const res = await svc.translateReview('r1');

      // A missing key degrades the page to original-language only. It must not
      // break approval, and it must not hit the database looking for work.
      expect(res).toEqual({
        reviewId: 'r1',
        written: 0,
        skipped: 0,
        reason: 'not_configured',
      });
      expect(prisma.review.findUnique).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('what it refuses to translate', () => {
    it.each([
      ReviewModerationStatus.PENDING,
      ReviewModerationStatus.HELD,
      ReviewModerationStatus.REJECTED,
    ])('skips a %s review', async (moderationStatus) => {
      prisma.review.findUnique.mockResolvedValue(review({ moderationStatus }));

      const res = await svc.translateReview('r1');

      // Paying to translate something that may never publish is waste.
      expect(res.reason).toBe('not_approved');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('skips a star-only review with no text', async () => {
      prisma.review.findUnique.mockResolvedValue(
        review({
          translations: [
            {
              locale: Locale.en,
              comment: '   ',
              isMachineTranslated: false,
              sourceHash: null,
            },
          ],
        }),
      );

      const res = await svc.translateReview('r1');

      // Not an error: a one-tap review with no words is the flow working.
      expect(res.reason).toBe('no_source_text');
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('the sourceHash cache', () => {
    it('translates every missing locale on a first pass', async () => {
      prisma.review.findUnique.mockResolvedValue(review());

      const res = await svc.translateReview('r1');

      // 7 locales, minus the source -> 6.
      expect(res.written).toBe(6);
      expect(global.fetch).toHaveBeenCalledTimes(6);
      const written = prisma.reviewTranslation.upsert.mock.calls.map(
        (c: any) => c[0].create,
      );
      expect(written.every((w: any) => w.isMachineTranslated === true)).toBe(
        true,
      );
      // Every row records what it came from, or the cache cannot work.
      const hash = ReviewTranslationService.hash(SOURCE);
      expect(written.every((w: any) => w.sourceHash === hash)).toBe(true);
      expect(written.some((w: any) => w.locale === Locale.en)).toBe(false);
    });

    it('writes NOTHING when every locale is already built from this source', async () => {
      const hash = ReviewTranslationService.hash(SOURCE);
      prisma.review.findUnique.mockResolvedValue(
        review({
          translations: [
            {
              locale: Locale.en,
              comment: SOURCE,
              isMachineTranslated: false,
              sourceHash: null,
            },
            ...[
              Locale.nl,
              Locale.de,
              Locale.fr,
              Locale.es,
              Locale.pt,
              Locale.zh,
            ].map((locale) => ({
              locale,
              comment: '[cached]',
              isMachineTranslated: true,
              sourceHash: hash,
            })),
          ],
        }),
      );

      const res = await svc.translateReview('r1');

      // The whole point: a re-run is free. Without this the job is a recurring
      // per-character bill for identical output.
      expect(res).toEqual({ reviewId: 'r1', written: 0, skipped: 6 });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('re-translates when the source text has CHANGED', async () => {
      prisma.review.findUnique.mockResolvedValue(
        review({
          translations: [
            {
              locale: Locale.en,
              comment: SOURCE,
              isMachineTranslated: false,
              sourceHash: null,
            },
            {
              locale: Locale.nl,
              comment: '[stale]',
              isMachineTranslated: true,
              // Built from something else - an admin edited the original since.
              sourceHash: ReviewTranslationService.hash('older text'),
            },
          ],
        }),
      );

      await svc.translateReview('r1');

      // A stale translation is worse than a missing one: it silently shows a
      // Dutch reader something the guest no longer says.
      const locales = prisma.reviewTranslation.upsert.mock.calls.map(
        (c: any) => c[0].where.reviewId_locale.locale,
      );
      expect(locales).toContain(Locale.nl);
    });

    it('never overwrites a HUMAN translation with machine output', async () => {
      prisma.review.findUnique.mockResolvedValue(
        review({
          translations: [
            {
              locale: Locale.en,
              comment: SOURCE,
              isMachineTranslated: false,
              sourceHash: null,
            },
            {
              locale: Locale.nl,
              comment: 'Een echt door een mens geschreven vertaling.',
              isMachineTranslated: false,
              sourceHash: null,
            },
          ],
        }),
      );

      await svc.translateReview('r1');

      const locales = prisma.reviewTranslation.upsert.mock.calls.map(
        (c: any) => c[0].where.reviewId_locale.locale,
      );
      expect(locales).not.toContain(Locale.nl);
    });
  });

  describe('the provider call', () => {
    it('sends plain text and maps zh to the provider code zh-CN', async () => {
      prisma.review.findUnique.mockResolvedValue(review());

      await svc.translateReview('r1');

      const bodies = (global.fetch as jest.Mock).mock.calls.map((c) =>
        JSON.parse(c[1].body),
      );
      // `text/plain` stops a stray `<` or `&` in a guest's comment being
      // treated as markup to preserve.
      expect(bodies.every((b) => b.mimeType === 'text/plain')).toBe(true);
      expect(bodies.map((b) => b.targetLanguageCode)).toContain('zh-CN');
      expect(bodies.map((b) => b.targetLanguageCode)).not.toContain('zh');
    });

    it('writes nothing when the provider errors, leaving the row for next run', async () => {
      prisma.review.findUnique.mockResolvedValue(review());
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'rate limited',
      }) as any;

      const res = await svc.translateReview('r1');

      // An outage must not fail the caller or write a half-translation.
      expect(res.written).toBe(0);
      expect(prisma.reviewTranslation.upsert).not.toHaveBeenCalled();
    });

    it('survives a thrown network error', async () => {
      prisma.review.findUnique.mockResolvedValue(review());
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('ECONNRESET')) as any;

      await expect(svc.translateReview('r1')).resolves.toEqual(
        expect.objectContaining({ written: 0 }),
      );
    });
  });

  describe('enqueue', () => {
    it('swallows a queue failure - a Redis outage must not fail an approval', async () => {
      const queue = {
        add: jest.fn().mockRejectedValue(new Error('redis down')),
      } as any;

      await expect(svc.enqueue(queue, 'r1')).resolves.toBeUndefined();
    });

    it('de-duplicates on the review id', async () => {
      const queue = { add: jest.fn().mockResolvedValue({}) } as any;

      await svc.enqueue(queue, 'r1');

      // Approve / un-approve / re-approve enqueues one unit of work, not three.
      expect(queue.add.mock.calls[0][2]).toEqual(
        expect.objectContaining({ jobId: 'r1' }),
      );
    });

    it('does not enqueue while unconfigured', async () => {
      delete process.env.GOOGLE_TRANSLATE_API_KEY;
      const queue = { add: jest.fn() } as any;

      await svc.enqueue(queue, 'r1');

      expect(queue.add).not.toHaveBeenCalled();
    });
  });
});
