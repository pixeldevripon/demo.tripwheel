import { FaqPageType } from '@prisma/client';
import { ContentTranslationEnqueuer } from './content-translation.enqueuer';

/**
 * The enqueuer's one promise: it can never hurt the save that called it.
 * Redis down, provider unconfigured, kill switch on - all must be silent
 * no-ops, and a successful add must carry the dedup/debounce options the
 * free-tier budget depends on.
 */

const flush = () => new Promise((resolve) => setImmediate(resolve));

function mockQueue(): any {
  return { add: jest.fn().mockResolvedValue({}) };
}

function mockProvider(configured = true): any {
  return { isConfigured: jest.fn().mockResolvedValue(configured) };
}

describe('ContentTranslationEnqueuer', () => {
  afterEach(() => {
    delete process.env.CONTENT_TRANSLATION_DISABLED;
  });

  it('enqueues with the dedup jobId, debounce delay and non-blocking retention', async () => {
    const queue = mockQueue();
    const enqueuer = new ContentTranslationEnqueuer(queue, mockProvider());

    enqueuer.enqueue('tour', 't1');
    await flush();

    expect(queue.add).toHaveBeenCalledWith(
      'translate',
      { entityType: 'tour', entityId: 't1' },
      expect.objectContaining({
        jobId: 'tour:t1',
        delay: 60_000,
        // A retained completed job with this jobId would block every future
        // re-enqueue of the entity - retention must be `true`, not a count.
        removeOnComplete: true,
      }),
    );
  });

  it('swallows a Redis failure - an outage must never fail a save', async () => {
    const queue = mockQueue();
    queue.add.mockRejectedValue(new Error('redis down'));
    const enqueuer = new ContentTranslationEnqueuer(queue, mockProvider());

    expect(() => enqueuer.enqueue('category', 'c1')).not.toThrow();
    await flush();
  });

  it('maps a pageType to its entity type for the FAQ/section choke points', async () => {
    const queue = mockQueue();
    const enqueuer = new ContentTranslationEnqueuer(queue, mockProvider());

    enqueuer.enqueueForPageType(FaqPageType.category, 'c1');
    await flush();

    expect(queue.add).toHaveBeenCalledWith(
      'translate',
      { entityType: 'category', entityId: 'c1' },
      expect.anything(),
    );
  });

  it('ignores the tour pageType - tours have NO FAQs (house rule)', async () => {
    const queue = mockQueue();
    const enqueuer = new ContentTranslationEnqueuer(queue, mockProvider());

    enqueuer.enqueueForPageType(FaqPageType.tour, 't1');
    await flush();

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('does not enqueue while unconfigured', async () => {
    const queue = mockQueue();
    const enqueuer = new ContentTranslationEnqueuer(queue, mockProvider(false));

    enqueuer.enqueue('hub', 'h1');
    await flush();

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('honours the CONTENT_TRANSLATION_DISABLED kill switch', async () => {
    process.env.CONTENT_TRANSLATION_DISABLED = '1';
    const queue = mockQueue();
    const provider = mockProvider();
    const enqueuer = new ContentTranslationEnqueuer(queue, provider);

    enqueuer.enqueue('collection', 'x1');
    await flush();

    expect(provider.isConfigured).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });
});
