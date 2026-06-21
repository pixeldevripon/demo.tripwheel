/**
 * Unit tests for OctoService (Phase 0+1 catalog reads).
 * PrismaService is fully mocked — no DB. Serialization is exercised end-to-end
 * (real serializers) so capability gating + error mapping are covered here too.
 */
import { PrismaService } from '@/prisma/prisma.service';
import { Test, TestingModule } from '@nestjs/testing';
import { Locale, TourStatus } from '@prisma/client';
import { OctoException } from './common/octo-error';
import { OctoService } from './octo.service';

function createMockPrisma() {
  return {
    tour: { findMany: jest.fn(), findUnique: jest.fn() },
    siteInfo: { upsert: jest.fn() },
    companyInformations: { findUnique: jest.fn() },
    faq: { findMany: jest.fn() },
  };
}

/** A LIVE tour shaped enough for octoTourInclude (no children needed for these tests). */
function liveTour() {
  return {
    id: 'tour-1',
    name: 'Test Tour',
    reference: null,
    status: TourStatus.LIVE,
    isActive: true,
    timeZone: 'America/Curacao',
    allowFreesale: false,
    instantConfirmation: true,
    instantDelivery: true,
    availabilityRequired: true,
    availabilityType: 'START_TIME',
    deliveryFormats: ['PDF_URL'],
    deliveryMethods: ['VOUCHER'],
    redemptionMethod: 'DIGITAL',
    defaultCurrency: 'USD',
    pricingModel: 'PER_PERSON',
    minPartySize: 1,
    maxPartySize: null,
    durationMinutesFrom: null,
    durationMinutesTo: null,
    options: [],
    categories: [],
    images: [],
    highlights: [],
    inclusions: [],
    exclusions: [],
    features: [],
    locations: [],
    languages: [],
    translations: [],
  };
}

describe('OctoService', () => {
  let service: OctoService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OctoService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(OctoService);
  });

  describe('getSupplier', () => {
    it('serializes platform-as-supplier from SiteInfo + Company', async () => {
      prisma.siteInfo.upsert.mockResolvedValue({
        id: 'default',
        siteName: 'Island Tours',
        siteTagline: 'Explore the Caribbean',
        siteDescription: '',
        logo: 'https://cdn/logo.png',
      });
      prisma.companyInformations.findUnique.mockResolvedValue({
        companyName: 'Island Tours BV',
        companyEmail: 'hi@island.tours',
        companyPhone: '+5999000',
        companyWebsite: 'https://island.tours',
        companyAddress: 'Pier 1',
        companyCity: 'Willemstad',
        companyState: null,
        companyZip: null,
        companyCountry: 'CW',
      });

      const out = await service.getSupplier('https://api.test/api/v1/octo');
      expect(out).toMatchObject({
        id: 'island-tours',
        name: 'Island Tours BV',
        endpoint: 'https://api.test/api/v1/octo',
        contact: {
          email: 'hi@island.tours',
          telephone: '+5999000',
          website: 'https://island.tours',
          address: 'Pier 1, Willemstad, CW',
        },
        shortDescription: 'Explore the Caribbean',
      });
      expect((out.media as unknown[]).length).toBe(1);
    });

    it('handles a missing company record', async () => {
      prisma.siteInfo.upsert.mockResolvedValue({
        id: 'default',
        siteName: 'Island Tours',
        siteTagline: '',
        siteDescription: '',
        logo: '',
      });
      prisma.companyInformations.findUnique.mockResolvedValue(null);

      const out = await service.getSupplier('https://x/api/v1/octo');
      expect(out.name).toBe('Island Tours');
      expect((out.contact as Record<string, unknown>).email).toBeNull();
      expect(out.media).toBeNull();
    });
  });

  describe('listTours', () => {
    it('queries only LIVE + active tours, ordered by tier ranking', async () => {
      prisma.tour.findMany.mockResolvedValue([liveTour()]);
      prisma.faq.findMany.mockResolvedValue([]);

      const out = await service.listTours(new Set(), Locale.en);

      expect(prisma.tour.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: TourStatus.LIVE, isActive: true },
          orderBy: [
            { tierRank: 'asc' },
            { qualityScore: 'desc' },
            { id: 'asc' },
          ],
        }),
      );
      expect(out).toHaveLength(1);
      expect(out[0].id).toBe('tour-1');
    });

    it('does not query FAQs without the content capability', async () => {
      prisma.tour.findMany.mockResolvedValue([liveTour()]);
      await service.listTours(new Set(), Locale.en);
      expect(prisma.faq.findMany).not.toHaveBeenCalled();
    });

    it('loads + groups FAQs (locale preferred over EN) with the content capability', async () => {
      prisma.tour.findMany.mockResolvedValue([liveTour()]);
      prisma.faq.findMany.mockResolvedValue([
        { entityId: 'tour-1', locale: 'nl', question: 'NL?', answer: 'NL.' },
        { entityId: 'tour-1', locale: 'en', question: 'EN?', answer: 'EN.' },
      ]);

      const out = await service.listTours(new Set(['octo/content']), Locale.nl);
      expect(prisma.faq.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            pageType: 'tour',
            entityId: { in: ['tour-1'] },
            locale: { in: ['nl', 'en'] },
          }),
        }),
      );
      expect(out[0].faqs).toEqual([{ question: 'NL?', answer: 'NL.' }]);
    });
  });

  describe('getTour', () => {
    it('returns a serialized tour when LIVE + active', async () => {
      prisma.tour.findUnique.mockResolvedValue(liveTour());
      const out = await service.getTour('tour-1', new Set(), Locale.en);
      expect(out.id).toBe('tour-1');
    });

    it('throws INVALID_TOUR_ID when not found', async () => {
      prisma.tour.findUnique.mockResolvedValue(null);
      await expect(
        service.getTour('missing', new Set(), Locale.en),
      ).rejects.toBeInstanceOf(OctoException);
    });

    it.each([TourStatus.DRAFT, TourStatus.PAUSED, TourStatus.ARCHIVED])(
      'throws INVALID_TOUR_ID for non-LIVE status %s',
      async (status) => {
        prisma.tour.findUnique.mockResolvedValue({ ...liveTour(), status });
        await expect(
          service.getTour('tour-1', new Set(), Locale.en),
        ).rejects.toBeInstanceOf(OctoException);
      },
    );

    it('throws INVALID_TOUR_ID when inactive', async () => {
      prisma.tour.findUnique.mockResolvedValue({
        ...liveTour(),
        isActive: false,
      });
      await expect(
        service.getTour('tour-1', new Set(), Locale.en),
      ).rejects.toBeInstanceOf(OctoException);
    });
  });
});
