import { CloudinaryService } from '@/media-gallery/cloudinary.service';
import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  InstagramLayout,
  InstagramMediaType,
  InstagramSource,
} from '@prisma/client';
import { InstagramService } from './instagram.service';
import { InstagramSyncScheduler } from './instagram-sync.scheduler';

function createMockPrismaService() {
  return {
    siteInfo: {
      findFirst: jest.fn().mockResolvedValue({ enableInstagram: true }),
    },
    instagramAccount: {
      findUnique: jest.fn().mockResolvedValue({
        username: 'island.tours_',
        profileUrl: '',
        layout: InstagramLayout.GRID,
      }),
      upsert: jest.fn(),
    },
    instagramPost: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
    },
    destination: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  };
}

/** A public-read row, as the narrowed `select` returns it. */
function tile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'tile-1',
    mediaType: InstagramMediaType.IMAGE,
    permalink: 'https://www.instagram.com/p/abc/',
    imageUrl: 'https://cdn.example/reef.jpg',
    videoUrl: null,
    caption: 'Sunset sail',
    altText: null,
    isPinned: false,
    width: 768,
    height: 674,
    ...overrides,
  };
}

describe('InstagramService', () => {
  let service: InstagramService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let cloudinary: { deleteFile: jest.Mock };
  let scheduler: { applySchedule: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    cloudinary = { deleteFile: jest.fn().mockResolvedValue(undefined) };
    scheduler = { applySchedule: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstagramService,
        { provide: PrismaService, useValue: prisma },
        { provide: CloudinaryService, useValue: cloudinary },
        { provide: InstagramSyncScheduler, useValue: scheduler },
      ],
    }).compile();

    service = module.get<InstagramService>(InstagramService);
  });

  // ── Public feed ─────────────────────────────────────────────────────────────

  describe('getPublicFeed', () => {
    it('reports disabled, and reads no tiles, when the kill switch is off', async () => {
      prisma.siteInfo.findFirst.mockResolvedValue({ enableInstagram: false });

      const feed = await service.getPublicFeed();

      expect(feed.enabled).toBe(false);
      expect(feed.posts).toEqual([]);
      expect(prisma.instagramPost.findMany).not.toHaveBeenCalled();
    });

    it('reports disabled when switched on but empty - a handle row over an empty grid is worse than no section', async () => {
      prisma.instagramPost.findMany.mockResolvedValue([]);

      const feed = await service.getPublicFeed();

      expect(feed.enabled).toBe(false);
      // The handle still comes back: the dashboard shows it either way.
      expect(feed.username).toBe('island.tours_');
    });

    it('derives the profile URL from the handle when none is stored', async () => {
      prisma.instagramPost.findMany.mockResolvedValue([tile()]);

      const feed = await service.getPublicFeed();

      expect(feed.profileUrl).toBe('https://www.instagram.com/island.tours_');
    });

    it('falls back to the profile link when a tile has no permalink, so no tile is a dead link', async () => {
      prisma.instagramPost.findMany.mockResolvedValue([
        tile({ permalink: '' }),
      ]);

      const feed = await service.getPublicFeed();

      expect(feed.posts[0].href).toBe(
        'https://www.instagram.com/island.tours_',
      );
    });

    it('serves a video tile as poster + video, so the grid can paint before the loop starts', async () => {
      prisma.instagramPost.findMany.mockResolvedValue([
        tile({
          mediaType: InstagramMediaType.VIDEO,
          imageUrl: 'https://cdn.example/poster.jpg',
          videoUrl: 'https://cdn.example/reel.mp4',
        }),
      ]);

      const feed = await service.getPublicFeed();

      expect(feed.posts[0]).toMatchObject({
        imageUrl: 'https://cdn.example/poster.jpg',
        videoUrl: 'https://cdn.example/reel.mp4',
        mediaType: InstagramMediaType.VIDEO,
      });
    });

    describe('alt text', () => {
      it('prefers the admin override', async () => {
        prisma.instagramPost.findMany.mockResolvedValue([
          tile({ altText: 'Catamaran at sunset', caption: 'whatever #tag' }),
        ]);

        const feed = await service.getPublicFeed();

        expect(feed.posts[0].alt).toBe('Catamaran at sunset');
      });

      it('strips hashtags, mentions and URLs out of a caption', async () => {
        prisma.instagramPost.findMany.mockResolvedValue([
          tile({
            caption:
              'Turtles at Playa Piskado #turtles @island.tours_ https://t.co/x',
          }),
        ]);

        const feed = await service.getPublicFeed();

        expect(feed.posts[0].alt).toBe('Turtles at Playa Piskado');
      });

      it('never returns empty - these tiles are links', async () => {
        prisma.instagramPost.findMany.mockResolvedValue([
          tile({ caption: '#curacao #sunset', altText: null }),
        ]);

        const feed = await service.getPublicFeed();

        expect(feed.posts[0].alt).toBe('Instagram post');
      });
    });

    describe('layout', () => {
      it.each([
        [InstagramLayout.GRID, 6],
        [InstagramLayout.GALLERY, 15],
      ])('asks for %s-worth of tiles by default (%i)', async (layout, take) => {
        prisma.instagramAccount.findUnique.mockResolvedValue({
          username: 'island.tours_',
          profileUrl: '',
          layout,
        });
        prisma.instagramPost.findMany.mockResolvedValue([tile()]);

        const feed = await service.getPublicFeed();

        expect(feed.layout).toBe(layout);
        expect(prisma.instagramPost.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ take }),
        );
      });

      it('an explicit limit still wins over the layout default', async () => {
        prisma.instagramPost.findMany.mockResolvedValue([tile()]);

        await service.getPublicFeed(undefined, 3);

        expect(prisma.instagramPost.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ take: 3 }),
        );
      });

      it('reports the layout even when the section is switched off', async () => {
        prisma.siteInfo.findFirst.mockResolvedValue({ enableInstagram: false });

        const feed = await service.getPublicFeed();

        expect(feed.layout).toBe(InstagramLayout.GRID);
      });
    });

    describe('destination scoping', () => {
      it('adds tiles pinned to the island to the brand-wide set', async () => {
        prisma.destination.findUnique.mockResolvedValue({
          id: 'dest-1',
          isActive: true,
        });
        prisma.instagramPost.findMany.mockResolvedValue([tile()]);

        await service.getPublicFeed('curacao');

        expect(prisma.instagramPost.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: [{ destinationId: null }, { destinationId: 'dest-1' }],
            }),
          }),
        );
      });

      it('falls back to brand-wide for an inactive island', async () => {
        prisma.destination.findUnique.mockResolvedValue({
          id: 'dest-1',
          isActive: false,
        });
        prisma.instagramPost.findMany.mockResolvedValue([tile()]);

        await service.getPublicFeed('curacao');

        expect(prisma.instagramPost.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ destinationId: null }),
          }),
        );
      });
    });
  });

  // ── Account ─────────────────────────────────────────────────────────────────

  describe('updateAccount', () => {
    beforeEach(() => {
      prisma.instagramAccount.upsert.mockResolvedValue({
        id: 'default',
        username: 'island.tours_',
        profileUrl: '',
        layout: InstagramLayout.GALLERY,
      });
    });

    it('saves the layout - the handle/link are auto-derived, not set here', async () => {
      await service.updateAccount(
        { layout: InstagramLayout.GALLERY },
        'admin-1',
      );

      const call = prisma.instagramAccount.upsert.mock.calls[0][0];
      expect(call.update).toEqual({ layout: InstagramLayout.GALLERY });
      // Never writes the handle or link from the account form.
      expect(call.update).not.toHaveProperty('username');
      expect(call.update).not.toHaveProperty('profileUrl');
      // A layout-only change does not touch the cron.
      expect(scheduler.applySchedule).not.toHaveBeenCalled();
    });

    it('persists the sync tuning and re-registers the cron when the cadence changes', async () => {
      await service.updateAccount(
        { syncFetchLimit: 12, syncIntervalMinutes: 360 },
        'admin-1',
      );

      const call = prisma.instagramAccount.upsert.mock.calls[0][0];
      expect(call.update).toEqual({
        syncFetchLimit: 12,
        syncIntervalMinutes: 360,
      });
      // The cadence change is applied to the live scheduler.
      expect(scheduler.applySchedule).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAccount', () => {
    it('never writes - an unconfigured platform must not be seeded by a GET', async () => {
      prisma.instagramAccount.findUnique.mockResolvedValue(null);

      const account = await service.getAccount();

      expect(account).toEqual({
        id: 'default',
        username: null,
        profileUrl: null,
        // An unconfigured feed still reports a layout + sync defaults, so the
        // dashboard's controls always have values to show. Default = GALLERY.
        layout: InstagramLayout.GALLERY,
        syncFetchLimit: 24,
        syncIntervalMinutes: 1440,
      });
      expect(prisma.instagramAccount.upsert).not.toHaveBeenCalled();
    });
  });

  // ── Tiles ───────────────────────────────────────────────────────────────────

  describe('updatePost', () => {
    const syncedRow = {
      id: 'tile-1',
      source: InstagramSource.API,
      mediaType: InstagramMediaType.IMAGE,
      permalink: 'https://www.instagram.com/p/abc/',
      imageUrl: 'https://cdn.example/a.jpg',
      imagePublicId: null,
      videoUrl: null,
      caption: 'from instagram',
      altText: null,
      width: null,
      height: null,
      displayOrder: 0,
      isActive: true,
      isPinned: false,
      destinationId: null,
      postedAt: null,
      syncedAt: null,
      destination: null,
    };

    it('curates a synced tile: hide, alt text, and island only', async () => {
      prisma.instagramPost.findUnique.mockResolvedValue(syncedRow);
      prisma.instagramPost.update.mockResolvedValue({
        ...syncedRow,
        isActive: false,
      });

      await service.updatePost(
        'tile-1',
        { isActive: false, altText: 'Reef at noon' },
        'admin-1',
      );

      expect(prisma.instagramPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isActive: false,
            altText: 'Reef at noon',
          }),
        }),
      );
    });

    it('never writes sync-owned fields - the DTO does not carry them', async () => {
      prisma.instagramPost.findUnique.mockResolvedValue(syncedRow);
      prisma.instagramPost.update.mockResolvedValue(syncedRow);

      // Even if callers reach past the DTO, the service only maps curation keys.
      await service.updatePost(
        'tile-1',
        {
          isActive: true,
          // @ts-expect-error - not part of UpdateInstagramPostDto
          imageUrl: 'https://cdn.example/hijack.jpg',
          caption: 'rewrite',
        },
        'admin-1',
      );

      const patch = prisma.instagramPost.update.mock.calls[0][0].data;
      expect(patch).not.toHaveProperty('imageUrl');
      expect(patch).not.toHaveProperty('caption');
      expect(patch).not.toHaveProperty('mediaType');
      expect(patch).not.toHaveProperty('videoUrl');
    });

    it('rejects a destination that does not exist', async () => {
      prisma.instagramPost.findUnique.mockResolvedValue(syncedRow);
      prisma.destination.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePost('tile-1', { destinationId: 'nope' }, 'admin-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.instagramPost.update).not.toHaveBeenCalled();
    });

    it('404s on an unknown tile', async () => {
      prisma.instagramPost.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePost('gone', { isActive: false }, 'admin-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('reorderPosts', () => {
    it('rejects a payload naming a tile twice', async () => {
      await expect(
        service.reorderPosts(
          {
            items: [
              { id: 'a', displayOrder: 0 },
              { id: 'a', displayOrder: 1 },
            ],
          },
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a payload referencing a tile that no longer exists', async () => {
      prisma.instagramPost.findMany.mockResolvedValue([{ id: 'a' }]);

      await expect(
        service.reorderPosts(
          {
            items: [
              { id: 'a', displayOrder: 0 },
              { id: 'ghost', displayOrder: 1 },
            ],
          },
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('applies the whole new order in one transaction', async () => {
      prisma.instagramPost.findMany
        .mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }])
        .mockResolvedValueOnce([]);

      await service.reorderPosts(
        {
          items: [
            { id: 'a', displayOrder: 1 },
            { id: 'b', displayOrder: 0 },
          ],
        },
        'admin-1',
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.instagramPost.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('removePost', () => {
    it('cleans up the mirrored Cloudinary assets so a delete never orphans them', async () => {
      prisma.instagramPost.findUnique.mockResolvedValue({
        id: 'tile-1',
        source: InstagramSource.API,
        imagePublicId: 'instagram/poster',
        videoPublicId: 'instagram/reel',
      });

      await service.removePost('tile-1', 'admin-1');

      expect(prisma.instagramPost.delete).toHaveBeenCalledWith({
        where: { id: 'tile-1' },
      });
      expect(cloudinary.deleteFile).toHaveBeenCalledWith('instagram/poster');
      expect(cloudinary.deleteFile).toHaveBeenCalledWith('instagram/reel');
    });

    it('404s on an unknown tile and touches nothing', async () => {
      prisma.instagramPost.findUnique.mockResolvedValue(null);

      await expect(
        service.removePost('gone', 'admin-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.instagramPost.delete).not.toHaveBeenCalled();
      expect(cloudinary.deleteFile).not.toHaveBeenCalled();
    });
  });
});
