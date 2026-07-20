import { FaqGroupService } from '@/common/faq/faq-group.service';
import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FaqPageType, Locale } from '@prisma/client';
import { HomePageService } from './home-page.service';

function createMockPrismaService() {
  return {
    homePage: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    homePageTranslation: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    destination: {
      findUnique: jest.fn(),
    },
    faq: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

function createMockFaqGroupService() {
  return {
    getGroups: jest.fn().mockResolvedValue([]),
    createGroup: jest.fn().mockResolvedValue({}),
    updateGroup: jest.fn().mockResolvedValue({}),
    deleteGroup: jest.fn().mockResolvedValue({}),
    upsertTranslation: jest.fn().mockResolvedValue({}),
  };
}

describe('HomePageService', () => {
  let service: HomePageService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let faqGroups: ReturnType<typeof createMockFaqGroupService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();
    faqGroups = createMockFaqGroupService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HomePageService,
        { provide: PrismaService, useValue: prisma },
        { provide: FaqGroupService, useValue: faqGroups },
      ],
    }).compile();

    service = module.get<HomePageService>(HomePageService);
    jest.clearAllMocks();
    prisma.faq.findMany.mockResolvedValue([]);
  });

  // ── Public read ─────────────────────────────────────────────────────────────

  describe('getPublic', () => {
    it('returns an all-null payload when no content row exists', async () => {
      prisma.homePage.findUnique.mockResolvedValue(null);

      const result = await service.getPublic(Locale.en);

      expect(result).toEqual({
        locale: Locale.en,
        heroImage: null,
        editorialImages: [],
        editorialDestinationSlug: null,
        ogImage: null,
        heroTitle: null,
        heroSubtitle: null,
        experiencesTitle: null,
        editorialTitleLine1: null,
        editorialTitleLine2: null,
        editorialBody: null,
        editorialCta: null,
        faqTitle: null,
        faqSubtitle: null,
        faqs: [],
      });
    });

    it('never writes - an anonymous GET must not seed the singleton', async () => {
      prisma.homePage.findUnique.mockResolvedValue(null);

      await service.getPublic(Locale.en);

      expect(prisma.homePage.upsert).not.toHaveBeenCalled();
    });

    it('flattens the requested locale onto the base row', async () => {
      prisma.homePage.findUnique.mockResolvedValue({
        heroImage: 'https://cdn/hero.jpg',
        editorialImages: ['https://cdn/a.jpg'],
        editorialDestinationId: 'dest-1',
        ogImage: null,
        editorialDestination: { slug: 'curacao', isActive: true },
        translations: [
          {
            locale: Locale.nl,
            heroTitle: 'Titel',
            heroSubtitle: null,
            experiencesTitle: null,
            editorialTitleLine1: null,
            editorialTitleLine2: null,
            editorialBody: null,
            editorialCta: null,
            faqTitle: null,
            faqSubtitle: null,
            isMachineTranslated: false,
          },
        ],
      });

      const result = await service.getPublic(Locale.nl);

      expect(result.heroImage).toBe('https://cdn/hero.jpg');
      expect(result.heroTitle).toBe('Titel');
      expect(result.editorialDestinationSlug).toBe('curacao');
      // Unset copy stays null so the frontend keeps its dictionary default.
      expect(result.heroSubtitle).toBeNull();
    });

    it('falls back to null copy when the locale has no row yet', async () => {
      prisma.homePage.findUnique.mockResolvedValue({
        heroImage: 'https://cdn/hero.jpg',
        editorialImages: [],
        editorialDestinationId: null,
        ogImage: null,
        editorialDestination: null,
        translations: [],
      });

      const result = await service.getPublic(Locale.de);

      expect(result.heroTitle).toBeNull();
      // Locale-agnostic fields still apply - only the copy is missing.
      expect(result.heroImage).toBe('https://cdn/hero.jpg');
    });

    it('does not advertise an archived island in the CTA', async () => {
      prisma.homePage.findUnique.mockResolvedValue({
        heroImage: null,
        editorialImages: [],
        editorialDestinationId: 'dest-1',
        ogImage: null,
        editorialDestination: { slug: 'saint-lucia', isActive: false },
        translations: [],
      });

      const result = await service.getPublic(Locale.en);

      expect(result.editorialDestinationSlug).toBeNull();
    });
  });

  // ── Admin ───────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('rejects an editorial CTA target that does not exist', async () => {
      prisma.destination.findUnique.mockResolvedValue(null);

      await expect(
        service.update({ editorialDestinationId: 'missing' }, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.homePage.upsert).not.toHaveBeenCalled();
    });

    it('only writes the fields the request names', async () => {
      prisma.homePage.upsert.mockResolvedValue({});

      await service.update({ heroImage: 'https://cdn/new.jpg' }, 'admin-1');

      const call = prisma.homePage.upsert.mock.calls[0][0];
      expect(call.update).toEqual({ heroImage: 'https://cdn/new.jpg' });
      // editorialImages was not sent, so it must survive untouched.
      expect(call.update).not.toHaveProperty('editorialImages');
    });

    it('clears a field when it is explicitly null', async () => {
      prisma.homePage.upsert.mockResolvedValue({});

      await service.update({ heroImage: null }, 'admin-1');

      const call = prisma.homePage.upsert.mock.calls[0][0];
      expect(call.update).toEqual({ heroImage: null });
    });

    it('skips the destination lookup when no CTA target is sent', async () => {
      prisma.homePage.upsert.mockResolvedValue({});

      await service.update({ ogImage: null }, 'admin-1');

      expect(prisma.destination.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('FAQs', () => {
    it('returns only the requested locale, in display order', async () => {
      prisma.homePage.findUnique.mockResolvedValue(null);
      prisma.faq.findMany.mockResolvedValue([
        { question: 'Vraag?', answer: 'Antwoord.' },
      ]);

      const result = await service.getPublic(Locale.nl);

      expect(result.faqs).toEqual([
        { question: 'Vraag?', answer: 'Antwoord.' },
      ]);
      const call = prisma.faq.findMany.mock.calls[0][0];
      expect(call.where).toEqual({
        pageType: FaqPageType.homepage,
        entityId: 'default',
        locale: Locale.nl,
        isActive: true,
      });
      expect(call.orderBy).toEqual([{ displayOrder: 'asc' }, { id: 'asc' }]);
    });

    it('delegates to the shared FAQ service under the homepage pageType', async () => {
      await service.getFaqGroups('default');

      expect(faqGroups.getGroups).toHaveBeenCalledWith(
        FaqPageType.homepage,
        'default',
      );
    });

    it('rejects any entityId other than the singleton key', async () => {
      // Otherwise a typo writes orphan FAQ rows no page would ever read.
      await expect(service.getFaqGroups('some-uuid')).rejects.toThrow(
        NotFoundException,
      );
      expect(faqGroups.getGroups).not.toHaveBeenCalled();
    });

    it('seeds the singleton before creating the first FAQ', async () => {
      prisma.homePage.upsert.mockResolvedValue({ id: 'default' });

      await service.createFaqGroup(
        'default',
        { question: 'How do I book?', answer: 'Pick a date and pay.' },
        'admin-1',
      );

      expect(prisma.homePage.upsert).toHaveBeenCalled();
      expect(faqGroups.createGroup).toHaveBeenCalled();
    });
  });

  describe('upsertTranslation', () => {
    it('seeds the singleton first so the FK always resolves', async () => {
      prisma.homePage.upsert.mockResolvedValue({ id: 'default' });
      prisma.homePageTranslation.upsert.mockResolvedValue({});

      await service.upsertTranslation(
        Locale.fr,
        { fields: { heroTitle: 'Bonjour' } },
        'admin-1',
      );

      expect(prisma.homePage.upsert).toHaveBeenCalled();
      expect(prisma.homePageTranslation.upsert).toHaveBeenCalled();
    });

    it('only writes the named copy fields', async () => {
      prisma.homePage.upsert.mockResolvedValue({ id: 'default' });
      prisma.homePageTranslation.upsert.mockResolvedValue({});

      await service.upsertTranslation(
        Locale.fr,
        { fields: { heroTitle: 'Bonjour' } },
        'admin-1',
      );

      const call = prisma.homePageTranslation.upsert.mock.calls[0][0];
      expect(call.update).toEqual({
        isMachineTranslated: false,
        heroTitle: 'Bonjour',
      });
    });

    it('clears copy when a field is explicitly null', async () => {
      prisma.homePage.upsert.mockResolvedValue({ id: 'default' });
      prisma.homePageTranslation.upsert.mockResolvedValue({});

      await service.upsertTranslation(
        Locale.en,
        { fields: { heroSubtitle: null } },
        'admin-1',
      );

      const call = prisma.homePageTranslation.upsert.mock.calls[0][0];
      expect(call.update).toEqual({
        isMachineTranslated: false,
        heroSubtitle: null,
      });
    });
  });
});
