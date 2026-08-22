import { PrismaService } from '@/prisma/prisma.service';
import { PublicCacheService } from '@/workers/public-cache.service';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test, TestingModule } from '@nestjs/testing';
import { InstagramSyncStatus } from '@prisma/client';

import { InstagramSyncScheduler } from './instagram-sync.scheduler';
import { InstagramSyncService } from './instagram-sync.service';

/**
 * The cron wrapper's ONE public-facing decision: after a sync, did the grid move
 * enough to justify busting the public `instagram` cache tag?
 *
 * It matters more than it looks. This is the only revalidation path the dashboard
 * is not part of, so nothing else will notice if it is wrong - a missed bust is
 * silent for a full `cacheLife('days')`.
 */
describe('InstagramSyncScheduler', () => {
  let scheduler: InstagramSyncScheduler;
  let sync: { syncNow: jest.Mock };
  let publicCache: { revalidateTags: jest.Mock };

  const result = (over: Partial<Record<string, unknown>> = {}) => ({
    ran: true,
    created: 0,
    updated: 0,
    removed: 0,
    failed: 0,
    status: InstagramSyncStatus.OK,
    error: null,
    ...over,
  });

  beforeEach(async () => {
    sync = { syncNow: jest.fn().mockResolvedValue(result()) };
    publicCache = { revalidateTags: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstagramSyncScheduler,
        { provide: InstagramSyncService, useValue: sync },
        { provide: PublicCacheService, useValue: publicCache },
        { provide: PrismaService, useValue: { instagramAccount: {} } },
        {
          provide: SchedulerRegistry,
          useValue: { getCronJobs: () => new Map() },
        },
      ],
    }).compile();

    scheduler = module.get(InstagramSyncScheduler);
  });

  /** `run` is private - the cron is its only caller, so reach it directly. */
  const run = () =>
    (scheduler as unknown as { run: () => Promise<void> }).run();

  it.each([
    ['a tile was added', { created: 1 }],
    ['a tile was removed', { removed: 1 }],
    // The regression this suite exists for: `updated` was left out of the
    // predicate, so a re-mirrored image, a new permalink or a corrected caption
    // (the caption IS the public alt text) never reached the site.
    ['a tile was updated in place', { updated: 1 }],
  ])('busts the instagram tag when %s', async (_case, over) => {
    sync.syncNow.mockResolvedValue(result(over));

    await run();

    expect(publicCache.revalidateTags).toHaveBeenCalledWith(['instagram']);
  });

  it('does not bust when the sync changed nothing - a no-op must not thrash the cache', async () => {
    sync.syncNow.mockResolvedValue(result());

    await run();

    expect(publicCache.revalidateTags).not.toHaveBeenCalled();
  });

  it('swallows a sync failure so one bad night never kills the cron', async () => {
    sync.syncNow.mockRejectedValue(new Error('token revoked'));

    await expect(run()).resolves.toBeUndefined();
    expect(publicCache.revalidateTags).not.toHaveBeenCalled();
  });
});
