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
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      delete: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    tour: { findUnique: jest.fn(), update: jest.fn() },
    tourTranslation: { findUnique: jest.fn(), upsert: jest.fn() },
    tourHighlight: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn(),
    },
    tourHighlightTranslation: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    tourImage: {
      findMany: jest.fn().mockResolvedValue([]),
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
      prisma.tour.findUnique.mockResolvedValue({ name: 'Live Name' });

      const result = await service.getLatestForTour('tour-1');

      expect(result?.id).toBe('chg-1');
      expect(result?.status).toBe(PendingChangeStatus.PENDING);
      expect(prisma.tourPendingChange.findFirst).toHaveBeenCalledTimes(1);
    });

    it('an open set is PRUNED against the live rows and the healed payload persisted', async () => {
      prisma.tourPendingChange.findFirst.mockResolvedValueOnce(
        makeOpenChange({
          tour: { name: 'Live Name' }, // equal -> pruned
          translations: {
            en: {
              overview: 'Live overview', // equal -> pruned
              title: 'A genuinely new title', // differs -> kept
            },
          },
        }),
      );
      prisma.tour.findUnique.mockResolvedValue({ name: 'Live Name' });
      prisma.tourTranslation.findUnique.mockResolvedValue({
        overview: 'Live overview',
        title: 'Live Translation Title',
      });
      prisma.tourPendingChange.update.mockResolvedValue(
        makeOpenChange({
          translations: { en: { title: 'A genuinely new title' } },
        }),
      );

      const result = await service.getLatestForTour('tour-1');

      expect(prisma.tourPendingChange.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'chg-1',
            updatedAt: new Date('2026-08-15T10:00:00Z'),
          },
          data: {
            payload: {
              translations: { en: { title: 'A genuinely new title' } },
            },
          },
        }),
      );
      expect(result?.changedAreas).toEqual(['content']);
    });

    it('a set that prunes to NOTHING is withdrawn and the decided fallback served', async () => {
      const decided = makeOpenChange(
        { tour: { name: 'Old proposal' } },
        { id: 'chg-0', status: PendingChangeStatus.REJECTED },
      );
      prisma.tourPendingChange.findFirst
        .mockResolvedValueOnce(makeOpenChange({ tour: { name: 'Live Name' } }))
        .mockResolvedValueOnce(decided);
      prisma.tour.findUnique.mockResolvedValue({ name: 'Live Name' });

      const result = await service.getLatestForTour('tour-1');

      expect(prisma.tourPendingChange.deleteMany).toHaveBeenCalledWith({
        where: {
          id: 'chg-1',
          updatedAt: new Date('2026-08-15T10:00:00Z'),
        },
      });
      expect(result?.id).toBe('chg-0');
      expect(result?.status).toBe(PendingChangeStatus.REJECTED);
    });
  });

  describe('stash mutators', () => {
    it('a held title opens a change set and notifies the platform ONCE', async () => {
      prisma.tourPendingChange.findFirst.mockResolvedValue(null);
      prisma.tourPendingChange.create.mockResolvedValue(
        makeOpenChange({ tour: { name: 'New' } }),
      );

      await service.setStashedName(TOUR, 'user-1', 'New');

      expect(prisma.tourPendingChange.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tourId: 'tour-1',
            payload: expect.objectContaining({
              tour: { name: 'New' },
              // Per-unit stamp (client ask: per-change timestamps).
              meta: { fieldTimes: { title: expect.any(String) } },
            }),
          }),
        }),
      );
      expect(inbox.notify).toHaveBeenCalledTimes(1);
    });

    it('a translation stash REPLACES defined keys, drops reverted ones, keeps the rest', async () => {
      prisma.tourPendingChange.findFirst.mockResolvedValue(
        makeOpenChange({
          tour: { name: 'Held Title' },
          translations: {
            en: { overview: 'old proposal', metaTitle: 'seo half' },
          },
        }),
      );
      prisma.tourPendingChange.update.mockResolvedValue(makeOpenChange({}));

      // The copy form re-saves: overview changed again, title newly changed,
      // and a previously-stashed field (none here) that now equals live is
      // passed as reverted. metaTitle was written by the SEO form - this
      // request does not define it, so it stays.
      await service.setTranslationStash(
        TOUR,
        'user-1',
        'en',
        { overview: 'newer proposal', title: 'Held Copy Title' },
        ['description'],
      );

      expect(prisma.tourPendingChange.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'chg-1' },
          data: {
            payload: expect.objectContaining({
              tour: { name: 'Held Title' },
              translations: {
                en: {
                  overview: 'newer proposal',
                  metaTitle: 'seo half',
                  title: 'Held Copy Title',
                },
              },
              meta: {
                fieldTimes: {
                  'tr:en:overview': expect.any(String),
                  'tr:en:title': expect.any(String),
                },
              },
            }),
          },
        }),
      );
      expect(inbox.notify).not.toHaveBeenCalled();
    });

    it('reverting the last held change DELETES the set - review withdrawn', async () => {
      prisma.tourPendingChange.findFirst.mockResolvedValue(
        makeOpenChange({ translations: { en: { overview: 'proposal' } } }),
      );

      await service.setTranslationStash(TOUR, 'user-1', 'en', {}, ['overview']);

      expect(prisma.tourPendingChange.delete).toHaveBeenCalledWith({
        where: { id: 'chg-1' },
      });
      expect(prisma.tourPendingChange.update).not.toHaveBeenCalled();
    });

    it('typing the live title back withdraws a title-only set', async () => {
      prisma.tourPendingChange.findFirst.mockResolvedValue(
        makeOpenChange({ tour: { name: 'Held Title' } }),
      );

      await service.setStashedName(TOUR, 'user-1', null);

      expect(prisma.tourPendingChange.delete).toHaveBeenCalledWith({
        where: { id: 'chg-1' },
      });
    });

    it('a save after rejection REVIVES the whole rejected proposal (client round 6)', async () => {
      // No open set; the tour's last word is a rejection carrying two edits.
      prisma.tourPendingChange.findFirst
        .mockResolvedValueOnce(null) // getOpenForTour
        .mockResolvedValueOnce(
          makeOpenChange(
            {
              tour: { name: 'Held Title' },
              translations: { en: { overview: 'Held overview' } },
            },
            { id: 'chg-rejected', status: PendingChangeStatus.REJECTED },
          ),
        );
      prisma.tourPendingChange.create.mockResolvedValue(
        makeOpenChange({}, { id: 'chg-2' }),
      );

      // The operator fixes ONE key - the flagged overview.
      await service.setTranslationStash(TOUR, 'user-1', 'en', {
        overview: 'Fixed overview',
      });

      // The new PENDING set carries the held title AND the fixed overview -
      // fixing one key must never drop the rest of the proposal.
      expect(prisma.tourPendingChange.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            payload: expect.objectContaining({
              tour: { name: 'Held Title' },
              translations: { en: { overview: 'Fixed overview' } },
            }),
          }),
        }),
      );
      // The rejection stays as history - never deleted or updated.
      expect(prisma.tourPendingChange.delete).not.toHaveBeenCalled();
      expect(prisma.tourPendingChange.update).not.toHaveBeenCalled();
      // The platform hears it as a resubmission.
      expect(inbox.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Sunset Cruise: content changes updated after review',
        }),
      );
    });

    it('a lost create race (P2002) re-applies the mutation onto the winner', async () => {
      prisma.tourPendingChange.findFirst
        .mockResolvedValueOnce(null) // the pre-check
        .mockResolvedValue(makeOpenChange({ tour: { name: 'Winner' } }));
      prisma.tourPendingChange.create.mockRejectedValue({ code: 'P2002' });
      prisma.tourPendingChange.update.mockResolvedValue(makeOpenChange({}));

      await service.setTranslationStash(TOUR, 'user-1', 'en', {
        overview: 'loser edit',
      });

      expect(prisma.tourPendingChange.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            payload: expect.objectContaining({
              tour: { name: 'Winner' },
              translations: { en: { overview: 'loser edit' } },
            }),
          },
        }),
      );
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

    it('approving a list reconciles rows and PRESERVES each staged translation flag', async () => {
      prisma.tourPendingChange.findFirst.mockResolvedValue(
        makeOpenChange({
          lists: {
            highlights: [
              {
                id: 'hl-1',
                displayOrder: 0,
                imageUrl: null,
                translations: [
                  // Human-edited EN - must stay human after approval.
                  {
                    locale: 'en',
                    text: 'Edited text',
                    isMachineTranslated: false,
                  },
                  // Untouched machine NL, copied into the stage verbatim -
                  // must STAY machine so the AI may refresh it.
                  {
                    locale: 'nl',
                    text: 'Machinetekst',
                    isMachineTranslated: true,
                  },
                ],
              },
              {
                id: 'new-1',
                isNew: true,
                displayOrder: 1,
                imageUrl: null,
                translations: [
                  {
                    locale: 'en',
                    text: 'Brand new bullet',
                    isMachineTranslated: false,
                  },
                ],
              },
            ],
          },
        }),
      );
      prisma.tour.findUnique.mockResolvedValue(TOUR);
      prisma.tourPendingChange.update.mockResolvedValue(
        makeOpenChange({}, { status: PendingChangeStatus.APPROVED }),
      );

      await service.approve('tour-1', 'admin-1');

      // Rows not staged are deleted, scoped by tourId.
      expect(prisma.tourHighlight.deleteMany).toHaveBeenCalledWith({
        where: { tourId: 'tour-1', id: { notIn: ['hl-1'] } },
      });
      expect(prisma.tourHighlight.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ id: 'new-1', tourId: 'tour-1' }),
        }),
      );
      // The human EN edit keeps isMachineTranslated false in the UPDATE
      // branch (code review CRITICAL - the AI refresh this approval enqueues
      // would otherwise overwrite the just-approved edit)...
      expect(prisma.tourHighlightTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            highlightId_locale: { highlightId: 'hl-1', locale: 'en' },
          },
          update: expect.objectContaining({
            text: 'Edited text',
            isMachineTranslated: false,
          }),
        }),
      );
      // ...while the untouched machine NL row stays machine.
      expect(prisma.tourHighlightTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            highlightId_locale: { highlightId: 'hl-1', locale: 'nl' },
          },
          update: expect.objectContaining({ isMachineTranslated: true }),
        }),
      );
      // A list carries EN, so the machine locales re-source.
      expect(contentTranslation.enqueue).toHaveBeenCalledWith('tour', 'tour-1');
    });

    it('an untouched translation row is NOT rewritten on approve (sourceHash preserved)', async () => {
      prisma.tourPendingChange.findFirst.mockResolvedValue(
        makeOpenChange({
          lists: {
            highlights: [
              {
                id: 'hl-1',
                displayOrder: 0,
                imageUrl: null,
                translations: [
                  {
                    locale: 'en',
                    text: 'Edited text',
                    isMachineTranslated: false,
                  },
                  {
                    locale: 'nl',
                    text: 'Machinetekst',
                    isMachineTranslated: true,
                  },
                ],
              },
            ],
          },
        }),
      );
      // The live row: EN differs (edited), NL is a verbatim copy.
      prisma.tourHighlight.findMany.mockResolvedValue([
        {
          id: 'hl-1',
          displayOrder: 0,
          imageUrl: null,
          translations: [
            { locale: 'en', text: 'Old text', isMachineTranslated: false },
            { locale: 'nl', text: 'Machinetekst', isMachineTranslated: true },
          ],
        },
      ]);
      prisma.tour.findUnique.mockResolvedValue(TOUR);
      prisma.tourPendingChange.update.mockResolvedValue(
        makeOpenChange({}, { status: PendingChangeStatus.APPROVED }),
      );

      await service.approve('tour-1', 'admin-1');

      const upsertedLocales =
        prisma.tourHighlightTranslation.upsert.mock.calls.map(
          (c) => c[0].where.highlightId_locale.locale,
        );
      expect(upsertedLocales).toEqual(['en']);
    });

    it('changedAreas names every configured list kind', () => {
      expect(
        service.changedAreas({
          lists: {
            features: [],
            locations: [],
          },
        }),
      ).toEqual(['features', 'locations']);
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
