import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Permission, Role } from '@prisma/client';
import { Locale } from '@/common/constants/locales';
import { MediaGalleryService } from './media-gallery.service';
import { PrismaService } from '@/prisma/prisma.service';
import { StaffPermissionsService } from '@/staff/staff-permissions.service';
import { CloudinaryService } from './cloudinary.service';
import { ContentTranslationEnqueuer } from '@/content-translation/content-translation.enqueuer';
import { ContentTranslationService } from '@/content-translation/content-translation.service';

const mockPrismaService = {
  mediaGallery: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  mediaTranslation: {
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
  operator: { findUnique: jest.fn() },
  staffMember: { findUnique: jest.fn() },
};

const mockCloudinaryService = {
  uploadFile: jest.fn(),
  deleteFile: jest.fn(),
  generateSignedParams: jest.fn(),
};

// The scope MUST come from the effective-permission engine, not the static
// role table - a designation can revoke MANAGE_MEDIA from a STAFF seat.
const mockStaffPermissions = {
  getEffectivePermissions: jest.fn(),
};

// Fire-and-forget hook: an English copy edit queues the asset's BUCKET so the
// AI refreshes the other six locales.
const mockEnqueuer = { enqueueMedia: jest.fn() };

// The manual per-asset AI button goes through the same pipeline service the
// background worker uses, with a single-uuid entityId.
const mockTranslationService = {
  translateEntity: jest.fn().mockResolvedValue({ written: 1, skipped: 0 }),
};

describe('MediaGalleryService', () => {
  let service: MediaGalleryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Default: no MANAGE_MEDIA - each test opts in explicitly.
    mockStaffPermissions.getEffectivePermissions.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaGalleryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CloudinaryService, useValue: mockCloudinaryService },
        {
          provide: StaffPermissionsService,
          useValue: mockStaffPermissions,
        },
        {
          provide: ContentTranslationEnqueuer,
          useValue: mockEnqueuer,
        },
        {
          provide: ContentTranslationService,
          useValue: mockTranslationService,
        },
      ],
    }).compile();

    service = module.get<MediaGalleryService>(MediaGalleryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Conflict #6 stage 2: rows are scoped to the OPERATOR context, so team
  // seats share one library; platform content roles see everything.
  describe('operator-context scoping', () => {
    const query = {} as never;

    it('scopes an operator OWNER to the operator library (not their userId)', async () => {
      mockPrismaService.operator.findUnique.mockResolvedValue({ id: 'op1' });
      mockPrismaService.mediaGallery.count.mockResolvedValue(0);
      mockPrismaService.mediaGallery.findMany.mockResolvedValue([]);

      await service.getMyMedia({ id: 'u1', role: Role.TOUR_OPERATOR }, query);

      // The scope is AND-ed with the type / untranslated filters (each of which
      // can carry its own `OR`), so it lives at AND[0] rather than at the root.
      const where = (
        mockPrismaService.mediaGallery.findMany.mock.calls[0][0].where as {
          AND: Array<Record<string, unknown>>;
        }
      ).AND[0];
      // Operator library + the orphan fallback (rows the backfill could not
      // attribute stay reachable by their uploader).
      expect(where.OR).toEqual([
        { operatorId: 'op1' },
        { operatorId: null, userId: 'u1' },
      ]);
    });

    it('resolves a team SEAT to the same shared operator library', async () => {
      // No Operator row for the seat user; the staffMember branch resolves.
      mockPrismaService.operator.findUnique.mockResolvedValue(null);
      mockPrismaService.staffMember.findUnique.mockResolvedValue({
        operatorId: 'op1',
        status: 'ACTIVE',
      });
      mockPrismaService.mediaGallery.count.mockResolvedValue(0);
      mockPrismaService.mediaGallery.findMany.mockResolvedValue([]);

      await service.getMyMedia({ id: 'u2', role: Role.TOUR_OPERATOR }, query);

      // The scope is AND-ed with the type / untranslated filters (each of which
      // can carry its own `OR`), so it lives at AND[0] rather than at the root.
      const where = (
        mockPrismaService.mediaGallery.findMany.mock.calls[0][0].where as {
          AND: Array<Record<string, unknown>>;
        }
      ).AND[0];
      expect(where.OR).toEqual([
        { operatorId: 'op1' },
        { operatorId: null, userId: 'u2' },
      ]);
    });

    it('gives a MANAGE_MEDIA platform role the whole library', async () => {
      mockStaffPermissions.getEffectivePermissions.mockResolvedValue([
        Permission.MANAGE_MEDIA,
      ]);
      mockPrismaService.mediaGallery.count.mockResolvedValue(0);
      mockPrismaService.mediaGallery.findMany.mockResolvedValue([]);

      await service.getMyMedia({ id: 'a1', role: Role.ADMIN }, query);

      // The scope is AND-ed with the type / untranslated filters (each of which
      // can carry its own `OR`), so it lives at AND[0] rather than at the root.
      const where = (
        mockPrismaService.mediaGallery.findMany.mock.calls[0][0].where as {
          AND: Array<Record<string, unknown>>;
        }
      ).AND[0];
      expect(where.operatorId).toBeUndefined();
      expect(where.userId).toBeUndefined();
      expect(where.OR).toBeUndefined();
    });

    it('pins a STAFF seat whose designation REVOKED manage-media to own rows', async () => {
      // The static role table grants STAFF manage-media; the effective set
      // (designation/revocations) is what actually decides. Reading the
      // static table here used to hand this seat the whole library.
      mockStaffPermissions.getEffectivePermissions.mockResolvedValue([
        Permission.VIEW_MEDIA,
        Permission.UPLOAD_MEDIA,
      ]);
      mockPrismaService.mediaGallery.count.mockResolvedValue(0);
      mockPrismaService.mediaGallery.findMany.mockResolvedValue([]);

      await service.getMyMedia({ id: 's1', role: Role.STAFF }, query);

      // The scope is AND-ed with the type / untranslated filters (each of which
      // can carry its own `OR`), so it lives at AND[0] rather than at the root.
      const where = (
        mockPrismaService.mediaGallery.findMany.mock.calls[0][0].where as {
          AND: Array<Record<string, unknown>>;
        }
      ).AND[0];
      expect(where.userId).toBe('s1');
      expect(where.OR).toBeUndefined();
    });

    it('denies a SUSPENDED seat (resolveOperatorId refuses to resolve)', async () => {
      mockPrismaService.operator.findUnique.mockResolvedValue(null);
      mockPrismaService.staffMember.findUnique.mockResolvedValue({
        operatorId: 'op1',
        status: 'SUSPENDED',
      });
      await expect(
        service.getMyMedia({ id: 'u3', role: Role.TOUR_OPERATOR }, query),
      ).rejects.toThrow(BadRequestException);
    });

    it('KEEPS the operator scope when a type filter is applied', async () => {
      // Regression: the scope and the type filter were merged with an object
      // spread, and both carry an `OR`. The type filter's `OR` overwrote the
      // scope's, so an operator filtering by Image saw the WHOLE platform
      // library. They must be AND-ed, never spread.
      mockPrismaService.operator.findUnique.mockResolvedValue({ id: 'op1' });
      mockPrismaService.mediaGallery.count.mockResolvedValue(0);
      mockPrismaService.mediaGallery.findMany.mockResolvedValue([]);

      await service.getMyMedia({ id: 'u1', role: Role.TOUR_OPERATOR }, {
        type: 'image',
      } as never);

      const where = mockPrismaService.mediaGallery.findMany.mock.calls[0][0]
        .where as { AND: Array<Record<string, unknown>> };
      expect(where.AND[0]).toEqual({
        OR: [{ operatorId: 'op1' }, { operatorId: null, userId: 'u1' }],
      });
      // And the type filter survives alongside it rather than replacing it.
      expect(JSON.stringify(where.AND[1])).toContain('image/');
    });

    it('pins bulk delete to the actor scope (no cross-operator IDOR)', async () => {
      mockPrismaService.operator.findUnique.mockResolvedValue({ id: 'op1' });
      mockPrismaService.mediaGallery.findMany.mockResolvedValue([
        { id: 'm1', publicId: 'pid1' },
      ]);
      mockPrismaService.mediaGallery.deleteMany.mockResolvedValue({ count: 1 });

      await service.bulkDeleteMedia(['m1', 'm2'], {
        id: 'u1',
        role: Role.TOUR_OPERATOR,
      });

      const scope = [{ operatorId: 'op1' }, { operatorId: null, userId: 'u1' }];
      expect(mockPrismaService.mediaGallery.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['m1', 'm2'] }, OR: scope },
        }),
      );
      expect(mockPrismaService.mediaGallery.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['m1'] }, OR: scope },
        }),
      );
    });
  });

  // The public read behind the site's localized alt text. Two things make it
  // fussy: the join key is a URL carrying a Cloudinary `?_a=` param that the two
  // sides need not agree on, and the locale row may be only partly filled.
  describe('getSeo', () => {
    const BASE = 'https://res.cloudinary.com/t/hero';

    it('matches on the query-stripped URL and returns it as the key', async () => {
      mockPrismaService.mediaGallery.findMany.mockResolvedValue([
        {
          url: `${BASE}?_a=STORED`,
          title: 'Hero',
          description: null,
          altText: 'A hero',
        },
      ]);

      // Caller passes a DIFFERENT analytics param than the one stored.
      const rows = await service.getSeo([`${BASE}?_a=CALLER`], Locale.en);

      expect(rows).toEqual([
        { url: BASE, title: 'Hero', description: null, altText: 'A hero' },
      ]);
    });

    it('never prefix-matches a sibling asset (.../hero vs .../hero-bg)', async () => {
      mockPrismaService.mediaGallery.findMany.mockResolvedValue([]);

      await service.getSeo([BASE], Locale.en);

      // `startsWith(BASE)` alone would also match `${BASE}-bg`, handing one
      // asset's copy to a different image. Exact, or exact + '?'.
      const where = mockPrismaService.mediaGallery.findMany.mock.calls[0][0]
        .where as { OR: unknown[] };
      expect(where.OR).toEqual([
        { url: BASE },
        { url: { startsWith: `${BASE}?` } },
      ]);
    });

    it('de-duplicates repeated URLs (hero and gallery tile can be one asset)', async () => {
      mockPrismaService.mediaGallery.findMany.mockResolvedValue([]);

      await service.getSeo([BASE, `${BASE}?_a=X`, BASE], Locale.en);

      const where = mockPrismaService.mediaGallery.findMany.mock.calls[0][0]
        .where as { OR: unknown[] };
      expect(where.OR).toHaveLength(2); // one URL -> one exact + one prefixed
    });

    it('joins no translations at all for locale=en', async () => {
      mockPrismaService.mediaGallery.findMany.mockResolvedValue([]);

      await service.getSeo([BASE], Locale.en);

      const select = mockPrismaService.mediaGallery.findMany.mock.calls[0][0]
        .select as Record<string, unknown>;
      expect(select.translations).toBeUndefined();
    });

    it('falls back PER FIELD, so a cleared field shows English', async () => {
      // The row exists in Spanish with only altText filled - either never
      // translated or deliberately cleared in the dashboard. Picking the locale
      // row wholesale would render an empty title.
      mockPrismaService.mediaGallery.findMany.mockResolvedValue([
        {
          url: BASE,
          title: 'English title',
          description: 'English description',
          altText: 'English alt',
          translations: [
            { title: null, description: '', altText: 'Alt en espanol' },
          ],
        },
      ]);

      const [row] = await service.getSeo([BASE], Locale.es);

      expect(row.altText).toBe('Alt en espanol');
      expect(row.title).toBe('English title');
      // '' counts as "says nothing" alongside null.
      expect(row.description).toBe('English description');
    });

    it('returns null rather than an empty string when neither side has copy', async () => {
      mockPrismaService.mediaGallery.findMany.mockResolvedValue([
        {
          url: BASE,
          title: null,
          description: null,
          altText: null,
          translations: [],
        },
      ]);

      const [row] = await service.getSeo([BASE], Locale.nl);

      expect(row).toEqual({
        url: BASE,
        title: null,
        description: null,
        altText: null,
      });
    });

    it('short-circuits an empty URL list without querying', async () => {
      const rows = await service.getSeo([], Locale.en);

      expect(rows).toEqual([]);
      expect(mockPrismaService.mediaGallery.findMany).not.toHaveBeenCalled();
    });
  });

  // The media library's replacement for a Translation Console matrix that
  // cannot enumerate thousands of assets.
  describe('untranslated filter', () => {
    const admin = { id: 'a1', role: Role.ADMIN };

    beforeEach(() => {
      mockStaffPermissions.getEffectivePermissions.mockResolvedValue([
        Permission.MANAGE_MEDIA,
      ]);
      mockPrismaService.mediaGallery.count.mockResolvedValue(0);
      mockPrismaService.mediaGallery.findMany.mockResolvedValue([]);
    });

    const whereFor = async (untranslated?: Locale) => {
      await service.getMyMedia(admin, { untranslated });
      return mockPrismaService.mediaGallery.findMany.mock.calls[0][0].where as {
        AND: Array<Record<string, unknown>>;
      };
    };

    it('requires English alt text, and excludes deliberate clears', async () => {
      const where = await whereFor(Locale.nl);
      const filter = where.AND[2] as {
        altText: unknown;
        OR: unknown[];
      };

      // Nothing to translate without an English source.
      expect(filter.altText).toEqual({ not: null });
      // Missing row = outstanding. A machine row with no alt text = outstanding.
      // A HUMAN row with no alt text is a deliberate "show English" and is
      // absent from these clauses on purpose - nagging about it would fight the
      // clear-means-clear contract.
      expect(filter.OR).toEqual([
        { translations: { none: { locale: Locale.nl } } },
        {
          translations: {
            some: {
              locale: Locale.nl,
              altText: null,
              isMachineTranslated: true,
            },
          },
        },
      ]);
    });

    it('ignores en - no asset has an en row, so it would match everything', async () => {
      const where = await whereFor(Locale.en);
      expect(where.AND[2]).toEqual({});
    });

    it('applies nothing when the filter is absent', async () => {
      const where = await whereFor(undefined);
      expect(where.AND[2]).toEqual({});
    });
  });

  describe('per-locale copy (dashboard)', () => {
    const admin = { id: 'a1', role: Role.ADMIN };

    beforeEach(() => {
      mockStaffPermissions.getEffectivePermissions.mockResolvedValue([
        Permission.MANAGE_MEDIA,
      ]);
      mockPrismaService.mediaGallery.findFirst.mockResolvedValue({ id: 'm1' });
    });

    it('reads back EVERY locale, with no locale filter', async () => {
      mockPrismaService.mediaTranslation.findMany.mockResolvedValue([]);

      await service.getTranslations('m1', admin);

      // A defaulted locale filter is what made a comparable editor silently
      // show English only - the switcher needs all of them at once.
      const args = mockPrismaService.mediaTranslation.findMany.mock
        .calls[0][0] as { where: Record<string, unknown> };
      expect(args.where).toEqual({ mediaId: 'm1' });
    });

    it('404s a foreign asset instead of leaking its copy', async () => {
      mockPrismaService.mediaGallery.findFirst.mockResolvedValue(null);

      await expect(service.getTranslations('m1', admin)).rejects.toThrow(
        NotFoundException,
      );
      expect(
        mockPrismaService.mediaTranslation.findMany,
      ).not.toHaveBeenCalled();
    });

    it('clears a field to null and KEEPS the row', async () => {
      mockPrismaService.mediaTranslation.upsert.mockResolvedValue({});

      await service.upsertTranslation('m1', Locale.nl, admin, {
        title: '  ',
        altText: 'Een boot',
      });

      const args = mockPrismaService.mediaTranslation.upsert.mock
        .calls[0][0] as { update: Record<string, unknown> };
      // Blank -> null, absent -> null, and the row survives either way. Deleting
      // it would read as "never translated" and get refilled by the AI.
      expect(args.update.title).toBeNull();
      expect(args.update.description).toBeNull();
      expect(args.update.altText).toBe('Een boot');
    });

    it('stamps every save human, so the AI leaves it alone', async () => {
      mockPrismaService.mediaTranslation.upsert.mockResolvedValue({});

      await service.upsertTranslation('m1', Locale.de, admin, {
        altText: 'Ein Boot',
      });

      const args = mockPrismaService.mediaTranslation.upsert.mock
        .calls[0][0] as {
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      };
      expect(args.create.isMachineTranslated).toBe(false);
      expect(args.create.sourceHash).toBeNull();
      expect(args.update.isMachineTranslated).toBe(false);
      expect(args.update.sourceHash).toBeNull();
    });

    it('queues the AI when English COPY changes', async () => {
      mockPrismaService.mediaGallery.update.mockResolvedValue({ id: 'm1' });

      await service.updateMedia('m1', admin, { altText: 'A boat' });

      expect(mockEnqueuer.enqueueMedia).toHaveBeenCalledWith('m1');
    });

    it('does NOT queue on a filename or indexing-only edit', async () => {
      mockPrismaService.mediaGallery.update.mockResolvedValue({ id: 'm1' });

      await service.updateMedia('m1', admin, {
        fileName: 'beach.jpg',
        excludeFromIndexing: true,
      });

      // Nothing to translate, and enqueuing would burn free-tier quota
      // re-hashing an unchanged source.
      expect(mockEnqueuer.enqueueMedia).not.toHaveBeenCalled();
    });

    it('translates ONE asset for the manual button, not its whole bucket', async () => {
      await service.generateTranslation('m1', Locale.de, admin);

      // A bare uuid, so the collector's single-asset branch runs: one provider
      // call, only this asset touched.
      expect(mockTranslationService.translateEntity).toHaveBeenCalledWith(
        'media',
        'm1',
        [Locale.de],
        false,
      );
    });

    it('refuses to generate English, and never reaches the provider', async () => {
      await expect(
        service.generateTranslation('m1', Locale.en, admin),
      ).rejects.toThrow(BadRequestException);
      expect(mockTranslationService.translateEntity).not.toHaveBeenCalled();
    });

    it('refuses to generate for a foreign asset (no quota theft)', async () => {
      mockPrismaService.mediaGallery.findFirst.mockResolvedValue(null);

      await expect(
        service.generateTranslation('m1', Locale.de, admin),
      ).rejects.toThrow(NotFoundException);
      expect(mockTranslationService.translateEntity).not.toHaveBeenCalled();
    });

    it('refuses English - it is what the others fall back TO', async () => {
      await expect(
        service.upsertTranslation('m1', Locale.en, admin, { altText: 'x' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.mediaTranslation.upsert).not.toHaveBeenCalled();
    });

    it('404s a write to a foreign asset', async () => {
      mockPrismaService.mediaGallery.findFirst.mockResolvedValue(null);

      await expect(
        service.upsertTranslation('m1', Locale.nl, admin, { altText: 'x' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.mediaTranslation.upsert).not.toHaveBeenCalled();
    });
  });
});
