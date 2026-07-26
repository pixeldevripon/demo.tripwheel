import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Locale, PageStatus } from '@prisma/client';
import { PagesService } from './pages.service';

function createMockPrismaService() {
  const client = {
    page: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    pageTranslation: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    pageRedirect: {
      findUnique: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn(),
    },
    destination: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn(),
  };
  client.$transaction.mockImplementation((fn: (tx: typeof client) => unknown) =>
    fn(client),
  );
  return client;
}

/** A stored page row in the full PAGE_SELECT shape. */
function pageRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'page-1',
    slug: 'terms',
    status: PageStatus.DRAFT,
    publishedAt: null,
    ogImage: null,
    createdAt: new Date('2026-07-01'),
    updatedAt: new Date('2026-07-01'),
    translations: [],
    redirects: [],
    ...overrides,
  };
}

describe('PagesService', () => {
  let service: PagesService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [PagesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<PagesService>(PagesService);
  });

  // ── Public read ─────────────────────────────────────────────────────────────

  describe('getPublicBySlug', () => {
    const englishRow = {
      locale: Locale.en,
      title: 'Terms of Service',
      body: '<h2>1. Who we are</h2>',
      metaTitle: null,
      metaDescription: null,
      isMachineTranslated: false,
      updatedAt: new Date(),
    };

    it('returns the requested locale without the English-fallback flag', async () => {
      prisma.page.findUnique.mockResolvedValue({
        slug: 'terms',
        ogImage: null,
        translations: [englishRow],
      });

      const result = await service.getPublicBySlug('terms', Locale.en);

      expect(result.title).toBe('Terms of Service');
      expect(result.isEnglishFallback).toBe(false);
      expect(result.redirectToSlug).toBeNull();
      // The public read filters on PUBLISHED in the query itself.
      expect(prisma.page.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: 'terms', status: PageStatus.PUBLISHED },
        }),
      );
    });

    it('serves the ENGLISH row with the fallback flag when the locale has no translation', async () => {
      prisma.page.findUnique.mockResolvedValue({
        slug: 'terms',
        ogImage: null,
        translations: [englishRow],
      });

      const result = await service.getPublicBySlug('terms', Locale.nl);

      expect(result.locale).toBe(Locale.en);
      expect(result.isEnglishFallback).toBe(true);
      expect(result.body).toBe('<h2>1. Who we are</h2>');
    });

    it('404s an unknown or unpublished slug with no redirect', async () => {
      prisma.page.findUnique.mockResolvedValue(null);
      prisma.pageRedirect.findUnique.mockResolvedValue(null);

      await expect(service.getPublicBySlug('nope', Locale.en)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns a redirect marker for a renamed permalink whose target is published', async () => {
      prisma.page.findUnique.mockResolvedValue(null);
      prisma.pageRedirect.findUnique.mockResolvedValue({
        toPage: { slug: 'terms-of-service', status: PageStatus.PUBLISHED },
      });

      const result = await service.getPublicBySlug('terms', Locale.en);

      expect(result.redirectToSlug).toBe('terms-of-service');
      expect(result.body).toBe('');
    });

    it('kills a redirect whose target is no longer published', async () => {
      prisma.page.findUnique.mockResolvedValue(null);
      prisma.pageRedirect.findUnique.mockResolvedValue({
        toPage: { slug: 'terms-of-service', status: PageStatus.ARCHIVED },
      });

      await expect(service.getPublicBySlug('terms', Locale.en)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── Create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates page + English translation atomically, slug from the title', async () => {
      prisma.page.create.mockResolvedValue(pageRow());

      await service.create({ title: 'Terms of Service' }, 'admin-1');

      const args = prisma.page.create.mock.calls[0][0];
      expect(args.data.slug).toBe('terms-of-service');
      expect(args.data.translations.create.locale).toBe(Locale.en);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('SANITIZES the body on the way in - scripts are stripped, structure kept', async () => {
      prisma.page.create.mockResolvedValue(pageRow());

      await service.create(
        {
          title: 'Terms',
          body: '<h2 onclick="x()">Hi</h2><script>alert(1)</script><p>ok</p>',
        },
        'admin-1',
      );

      const body = prisma.page.create.mock.calls[0][0].data.translations.create
        .body as string;
      expect(body).toBe('<h2>Hi</h2><p>ok</p>');
    });

    it('rejects a reserved platform-route slug', async () => {
      await expect(
        service.create({ title: 'Search' }, 'admin-1'),
      ).rejects.toThrow(ConflictException);
      expect(prisma.page.create).not.toHaveBeenCalled();
    });

    it('rejects a slug that is an existing destination (fall-through order)', async () => {
      prisma.destination.findUnique.mockResolvedValue({ id: 'dest-1' });

      await expect(
        service.create({ title: 'Curacao' }, 'admin-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('maps the unique violation to a 409', async () => {
      prisma.page.create.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.create({ title: 'Terms' }, 'admin-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('accepts and normalises a NESTED permalink path per segment', async () => {
      prisma.page.create.mockResolvedValue(pageRow({ slug: 'legal/terms' }));

      await service.create(
        { title: 'Terms', slug: 'Legal//Términos ' },
        'admin-1',
      );

      expect(prisma.page.create.mock.calls[0][0].data.slug).toBe(
        'legal/terminos',
      );
    });

    it('rejects a nested path whose FIRST segment is a destination', async () => {
      prisma.destination.findUnique.mockResolvedValue({ id: 'dest-1' });

      await expect(
        service.create({ title: 'X', slug: 'curacao/legal-stuff' }, 'admin-1'),
      ).rejects.toThrow(ConflictException);
      // The guard checks the first segment, not the whole path.
      expect(prisma.destination.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'curacao' } }),
      );
    });

    it('rejects a nested path under a reserved platform route', async () => {
      await expect(
        service.create({ title: 'X', slug: 'search/deep-page' }, 'admin-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('reclaims a permalink currently held by a stale redirect row', async () => {
      prisma.page.create.mockResolvedValue(pageRow());

      await service.create({ title: 'Terms' }, 'admin-1');

      expect(prisma.pageRedirect.deleteMany).toHaveBeenCalledWith({
        where: { fromSlug: 'terms' },
      });
    });
  });

  // ── Rename / update ─────────────────────────────────────────────────────────

  describe('update', () => {
    it('renaming a PUBLISHED page writes the 301 in the same transaction', async () => {
      prisma.page.findUnique.mockResolvedValue({
        id: 'page-1',
        slug: 'terms',
        status: PageStatus.PUBLISHED,
      });
      prisma.page.update.mockResolvedValue(
        pageRow({ slug: 'terms-of-service' }),
      );

      await service.update('page-1', { slug: 'terms-of-service' }, 'admin-1');

      expect(prisma.pageRedirect.create).toHaveBeenCalledWith({
        data: { fromSlug: 'terms', toPageId: 'page-1' },
      });
    });

    it('renaming a DRAFT writes NO redirect - the URL was never public', async () => {
      prisma.page.findUnique.mockResolvedValue({
        id: 'page-1',
        slug: 'terms',
        status: PageStatus.DRAFT,
      });
      prisma.page.update.mockResolvedValue(pageRow({ slug: 'tos' }));

      await service.update('page-1', { slug: 'tos' }, 'admin-1');

      expect(prisma.pageRedirect.create).not.toHaveBeenCalled();
    });

    it('an unchanged slug touches no redirect rows', async () => {
      prisma.page.findUnique.mockResolvedValue({
        id: 'page-1',
        slug: 'terms',
        status: PageStatus.PUBLISHED,
      });
      prisma.page.update.mockResolvedValue(pageRow());

      await service.update('page-1', { slug: 'terms' }, 'admin-1');

      expect(prisma.pageRedirect.deleteMany).not.toHaveBeenCalled();
      expect(prisma.pageRedirect.create).not.toHaveBeenCalled();
    });

    it('rejects renaming onto a destination slug', async () => {
      prisma.page.findUnique.mockResolvedValue({
        id: 'page-1',
        slug: 'terms',
        status: PageStatus.PUBLISHED,
      });
      prisma.destination.findUnique.mockResolvedValue({ id: 'dest-1' });

      await expect(
        service.update('page-1', { slug: 'aruba' }, 'admin-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── Publish lifecycle ───────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('refuses to publish a page with no English body', async () => {
      prisma.page.findUnique.mockResolvedValue({
        id: 'page-1',
        slug: 'terms',
        publishedAt: null,
        translations: [{ title: 'Terms', body: '   ' }],
      });

      await expect(
        service.updateStatus(
          'page-1',
          { status: PageStatus.PUBLISHED },
          'admin-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('stamps publishedAt on the FIRST publish only', async () => {
      prisma.page.findUnique.mockResolvedValue({
        id: 'page-1',
        slug: 'terms',
        publishedAt: null,
        translations: [{ title: 'Terms', body: '<p>x</p>' }],
      });
      prisma.page.update.mockResolvedValue(pageRow());

      await service.updateStatus(
        'page-1',
        { status: PageStatus.PUBLISHED },
        'admin-1',
      );

      expect(
        prisma.page.update.mock.calls[0][0].data.publishedAt,
      ).toBeInstanceOf(Date);
    });

    it('keeps the original publishedAt across republish cycles', async () => {
      prisma.page.findUnique.mockResolvedValue({
        id: 'page-1',
        slug: 'terms',
        publishedAt: new Date('2026-01-01'),
        translations: [{ title: 'Terms', body: '<p>x</p>' }],
      });
      prisma.page.update.mockResolvedValue(pageRow());

      await service.updateStatus(
        'page-1',
        { status: PageStatus.PUBLISHED },
        'admin-1',
      );

      expect(
        prisma.page.update.mock.calls[0][0].data.publishedAt,
      ).toBeUndefined();
    });
  });

  // ── Delete ──────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('refuses to delete a PUBLISHED page', async () => {
      prisma.page.findUnique.mockResolvedValue({
        id: 'page-1',
        slug: 'terms',
        status: PageStatus.PUBLISHED,
      });

      await expect(service.remove('page-1', 'admin-1')).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.page.delete).not.toHaveBeenCalled();
    });

    it('deletes a draft', async () => {
      prisma.page.findUnique.mockResolvedValue({
        id: 'page-1',
        slug: 'terms',
        status: PageStatus.DRAFT,
      });
      prisma.page.delete.mockResolvedValue({});

      await service.remove('page-1', 'admin-1');

      expect(prisma.page.delete).toHaveBeenCalledWith({
        where: { id: 'page-1' },
      });
    });
  });

  // ── Translations ────────────────────────────────────────────────────────────

  describe('upsertTranslation', () => {
    beforeEach(() => {
      prisma.page.findUnique.mockResolvedValue({ id: 'page-1', slug: 'terms' });
    });

    it('requires title AND body when creating a brand-new locale row', async () => {
      prisma.pageTranslation.findUnique.mockResolvedValue(null);

      await expect(
        service.upsertTranslation(
          'page-1',
          Locale.nl,
          { fields: { title: 'Voorwaarden' } },
          'admin-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('sanitizes the body on update and only touches named fields', async () => {
      prisma.pageTranslation.findUnique.mockResolvedValue({ id: 't-1' });
      prisma.pageTranslation.upsert.mockResolvedValue({});

      await service.upsertTranslation(
        'page-1',
        Locale.en,
        { fields: { body: '<p>ok</p><iframe src="x"></iframe>' } },
        'admin-1',
      );

      const args = prisma.pageTranslation.upsert.mock.calls[0][0];
      expect(args.update.body).toBe('<p>ok</p>');
      expect(args.update).not.toHaveProperty('title');
    });
  });
});
