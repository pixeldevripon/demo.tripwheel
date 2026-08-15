import { PrismaService } from '@/prisma/prisma.service';
import { InboxService } from '@/inbox/inbox.service';
import { ContentTranslationEnqueuer } from '@/content-translation/content-translation.enqueuer';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PendingChangeStatus, Role, TourStatus } from '@prisma/client';
import { TourPendingChangesService } from './tour-pending-changes.service';

function createMockPrismaService() {
  const mock = {
    tourPendingChange: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    tour: { findUnique: jest.fn(), update: jest.fn() },
    tourTranslation: { upsert: jest.fn() },
    tourImage: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  mock.$transaction.mockImplementation((fn: (tx: typeof mock) => unknown) =>
    fn(mock),
  );
  return mock;
}

const TOUR = { id: 'tour-1', operatorId: 'op-1', name: 'Sunset Cruise' };

function makeOpenChange(payload: object, overrides: object = {}) {
  return {
    id: 'chg-1',
    tourId: 'tour-1',
    status: PendingChangeStatus.PENDING,
    payload,
    submittedAt: new Date('2026-08-15T10:00:00Z'),
    submittedById: 'user-1',
    decidedAt: null,
    decidedById: null,
    reviewNote: null,
    updatedAt: new Date('2026-08-15T10:00:00Z'),
    ...overrides,
  };
}

function stagedImg(overrides: object = {}) {
  return {
    id: 'img-1',
    url: 'https://cdn/x.jpg',
    isHero: true,
    focalX: 0.5,
    focalY: 0.5,
    altText: null,
    displayOrder: 0,
    width: 1600,
    height: 900,
    ...overrides,
  };
}

describe('TourPendingChangesService', () => {
  let service: TourPendingChangesService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let inbox: { notify: jest.Mock };
  let contentTranslation: { enqueue: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    inbox = { notify: jest.fn() };
    contentTranslation = { enqueue: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TourPendingChangesService,
        { provide: PrismaService, useValue: prisma },
        { provide: InboxService, useValue: inbox },
        { provide: ContentTranslationEnqueuer, useValue: contentTranslation },
      ],
    }).compile();
    service = module.get(TourPendingChangesService);
    jest.clearAllMocks();
  });

  describe('isGated', () => {
    it('gates a LIVE tour for an operator, never for platform roles', () => {
      expect(service.isGated(TourStatus.LIVE, Role.TOUR_OPERATOR)).toBe(true);
      expect(service.isGated(TourStatus.LIVE, Role.ADMIN)).toBe(false);
      expect(service.isGated(TourStatus.LIVE, Role.STAFF)).toBe(false);
      expect(service.isGated(TourStatus.LIVE, Role.EDITOR)).toBe(false);
      expect(service.isGated(TourStatus.DRAFT, Role.TOUR_OPERATOR)).toBe(false);
      expect(service.isGated(TourStatus.PAUSED, Role.TOUR_OPERATOR)).toBe(
        false,
      );
    });
  });

  describe('getLatestForTour', () => {
    it('the OPEN set wins outright over any decided row (same-ms tie-proof)', async () => {
      const open = makeOpenChange({ tour: { name: 'Resubmitted' } });
      // First call = getOpenForTour (PENDING filter), second would be the
      // decided fallback - it must never be reached.
      prisma.tourPendingChange.findFirst.mockResolvedValueOnce(open);

      const result = await service.getLatestForTour('tour-1');

      expect(result?.id).toBe('chg-1');
      expect(result?.status).toBe(PendingChangeStatus.PENDING);
      expect(prisma.tourPendingChange.findFirst).toHaveBeenCalledTimes(1);
    });
  });

  describe('stash', () => {
    it('opens a change set and notifies the platform ONCE', async () => {
      prisma.tourPendingChange.findFirst.mockResolvedValue(null);
      prisma.tourPendingChange.create.mockResolvedValue(
        makeOpenChange({ tour: { name: 'New' } }),
      );

      await service.stash(TOUR, 'user-1', { tour: { name: 'New' } });

      expect(prisma.tourPendingChange.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tourId: 'tour-1',
            payload: { tour: { name: 'New' } },
          }),
        }),
      );
      expect(inbox.notify).toHaveBeenCalledTimes(1);
    });

    it('merges into the open set without re-notifying', async () => {
      prisma.tourPendingChange.findFirst.mockResolvedValue(
        makeOpenChange({
          tour: { name: 'Held Title' },
          translations: { en: { overview: 'old proposal' } },
        }),
      );
      prisma.tourPendingChange.update.mockResolvedValue(makeOpenChange({}));

      await service.stash(TOUR, 'user-1', {
        translations: { en: { description: 'long copy' }, nl: { title: 'x' } },
      });

      expect(prisma.tourPendingChange.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'chg-1' },
          data: {
            payload: {
              tour: { name: 'Held Title' },
              translations: {
                en: { overview: 'old proposal', description: 'long copy' },
                nl: { title: 'x' },
              },
            },
          },
        }),
      );
      expect(inbox.notify).not.toHaveBeenCalled();
    });

    it('a lost create race (P2002) folds into the winner row', async () => {
      prisma.tourPendingChange.findFirst
        .mockResolvedValueOnce(null) // the pre-check
        .mockResolvedValue(makeOpenChange({ tour: { name: 'Winner' } }));
      prisma.tourPendingChange.create.mockRejectedValue({ code: 'P2002' });
      prisma.tourPendingChange.update.mockResolvedValue(makeOpenChange({}));

      await service.stash(TOUR, 'user-1', { tour: { name: 'Loser' } });

      expect(prisma.tourPendingChange.update).toHaveBeenCalled();
      expect(inbox.notify).not.toHaveBeenCalled();
    });
  });

  describe('staged gallery', () => {
    it('first gated op copies the real gallery, then applies the op', async () => {
      prisma.tourPendingChange.findFirst.mockResolvedValueOnce(null); // no stage yet
      prisma.tourImage.findMany.mockResolvedValue([
        stagedImg(),
        stagedImg({ id: 'img-2', isHero: false, displayOrder: 1 }),
      ]);
      prisma.tourPendingChange.findFirst.mockResolvedValue(null);
      prisma.tourPendingChange.create.mockResolvedValue(makeOpenChange({}));

      const added = await service.stageImageAdd(
        TOUR,
        { url: 'https://cdn/new.jpg', width: 800, height: 600 },
        'user-1',
      );

      const payload = prisma.tourPendingChange.create.mock.calls[0][0].data
        .payload as { images: Array<{ url: string; isNew?: boolean }> };
      expect(payload.images).toHaveLength(3);
      expect(payload.images[2]).toMatchObject({
        url: 'https://cdn/new.jpg',
        isNew: true,
      });
      expect(added).toMatchObject({
        tourId: 'tour-1',
        url: 'https://cdn/new.jpg',
      });
      expect((added as { isNew?: boolean }).isNew).toBeUndefined();
    });

    it('staging a new hero demotes every other staged entry', async () => {
      const open = makeOpenChange({
        images: [stagedImg(), stagedImg({ id: 'img-2', isHero: false })],
      });
      prisma.tourPendingChange.findFirst.mockResolvedValue(open);
      prisma.tourPendingChange.update.mockResolvedValue(open);

      await service.stageImageUpdate(TOUR, 'img-2', { isHero: true }, 'user-1');

      const payload = prisma.tourPendingChange.update.mock.calls[0][0].data
        .payload as { images: Array<{ id: string; isHero: boolean }> };
      expect(payload.images.find((i) => i.id === 'img-1')!.isHero).toBe(false);
      expect(payload.images.find((i) => i.id === 'img-2')!.isHero).toBe(true);
    });

    it('a full staged gallery rejects another add (write-amplification cap)', async () => {
      prisma.tourPendingChange.findFirst.mockResolvedValue(
        makeOpenChange({
          images: Array.from({ length: 24 }, (_, i) =>
            stagedImg({ id: `img-${i}`, isHero: i === 0 }),
          ),
        }),
      );

      await expect(
        service.stageImageAdd(
          TOUR,
          { url: 'https://cdn/one-too-many.jpg', width: 800, height: 600 },
          'user-1',
        ),
      ).rejects.toThrow('at most 24 photos');
    });

    it('updating or removing an unknown staged image 404s', async () => {
      prisma.tourPendingChange.findFirst.mockResolvedValue(
        makeOpenChange({ images: [stagedImg()] }),
      );
      await expect(
        service.stageImageUpdate(TOUR, 'img-x', { altText: 'x' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.stageImageRemove(TOUR, 'img-x', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listOpen', () => {
    it('is FIFO on submittedAt and derives changedAreas', async () => {
      prisma.tourPendingChange.count.mockResolvedValue(1);
      prisma.tourPendingChange.findMany.mockResolvedValue([
        makeOpenChange({
          tour: { name: 'X' },
          images: [stagedImg()],
        }),
      ]);

      const result = await service.listOpen(1, 20);

      expect(
        prisma.tourPendingChange.findMany.mock.calls[0][0].orderBy,
      ).toEqual({ submittedAt: 'asc' });
      expect(result.data[0].changedAreas).toEqual(['title', 'photos']);
    });
  });

  describe('approve', () => {
    it('applies title + translations + gallery in one transaction, slug untouched', async () => {
      prisma.tourPendingChange.findFirst.mockResolvedValue(
        makeOpenChange({
          tour: { name: 'Approved Title' },
          translations: { en: { overview: 'fresh copy' } },
          images: [
            stagedImg(), // kept (real row)
            stagedImg({
              id: 'new-1',
              isNew: true,
              isHero: false,
              displayOrder: 1,
            }),
          ],
        }),
      );
      prisma.tour.findUnique.mockResolvedValue(TOUR);
      prisma.tourPendingChange.update.mockResolvedValue(
        makeOpenChange({}, { status: PendingChangeStatus.APPROVED }),
      );

      await service.approve('tour-1', 'admin-1', 'looks good');

      // Title applied - and ONLY the name (never the slug).
      expect(prisma.tour.update).toHaveBeenCalledWith({
        where: { id: 'tour-1' },
        data: { name: 'Approved Title' },
      });
      // Translation upsert marks the row human-authored.
      expect(prisma.tourTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tourId_locale: { tourId: 'tour-1', locale: 'en' } },
          update: expect.objectContaining({
            overview: 'fresh copy',
            isMachineTranslated: false,
          }),
        }),
      );
      // Gallery reconciled: rows not staged are deleted, new entries created.
      expect(prisma.tourImage.deleteMany).toHaveBeenCalledWith({
        where: { tourId: 'tour-1', id: { notIn: ['img-1'] } },
      });
      expect(prisma.tourImage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ id: 'new-1', tourId: 'tour-1' }),
        }),
      );
      // tourId-scoped, and a stale id updates 0 rows instead of throwing.
      expect(prisma.tourImage.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'img-1', tourId: 'tour-1' },
        }),
      );
      // The applied EN edit re-sources the other locales.
      expect(contentTranslation.enqueue).toHaveBeenCalledWith('tour', 'tour-1');
      // Operator hears the verdict.
      expect(inbox.notify).toHaveBeenCalledTimes(1);
    });

    it('smuggled non-whitelisted translation keys are dropped at apply time', async () => {
      prisma.tourPendingChange.findFirst.mockResolvedValue(
        makeOpenChange({
          translations: {
            en: { overview: 'fine', isMachineTranslated: true, tourId: 'evil' },
          },
        }),
      );
      prisma.tour.findUnique.mockResolvedValue(TOUR);
      prisma.tourPendingChange.update.mockResolvedValue(
        makeOpenChange({}, { status: PendingChangeStatus.APPROVED }),
      );

      await service.approve('tour-1', 'admin-1');

      const upsert = prisma.tourTranslation.upsert.mock.calls[0][0];
      expect(upsert.update).toEqual({
        overview: 'fine',
        isMachineTranslated: false,
      });
      expect(upsert.create.tourId).toBe('tour-1');
    });

    it('an approve with no EN translation change enqueues nothing', async () => {
      prisma.tourPendingChange.findFirst.mockResolvedValue(
        makeOpenChange({ tour: { name: 'Only a title' } }),
      );
      prisma.tour.findUnique.mockResolvedValue(TOUR);
      prisma.tourPendingChange.update.mockResolvedValue(
        makeOpenChange({}, { status: PendingChangeStatus.APPROVED }),
      );

      await service.approve('tour-1', 'admin-1');

      expect(contentTranslation.enqueue).not.toHaveBeenCalled();
    });

    it('404s when the tour has no open change set', async () => {
      prisma.tourPendingChange.findFirst.mockResolvedValue(null);
      await expect(service.approve('tour-1', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reject', () => {
    it('stamps REJECTED with the note and leaves live content untouched', async () => {
      prisma.tourPendingChange.findFirst.mockResolvedValue(
        makeOpenChange({ tour: { name: 'Nope' } }),
      );
      prisma.tour.findUnique.mockResolvedValue(TOUR);
      prisma.tourPendingChange.update.mockResolvedValue(
        makeOpenChange({}, { status: PendingChangeStatus.REJECTED }),
      );

      await service.reject('tour-1', 'admin-1', 'Please fix the wording');

      expect(prisma.tour.update).not.toHaveBeenCalled();
      expect(prisma.tourTranslation.upsert).not.toHaveBeenCalled();
      expect(
        prisma.tourPendingChange.update.mock.calls[0][0].data,
      ).toMatchObject({
        status: PendingChangeStatus.REJECTED,
        reviewNote: 'Please fix the wording',
      });
      expect(inbox.notify).toHaveBeenCalledTimes(1);
    });
  });
});
