import { FaqGroupService } from '@/common/faq/faq-group.service';
import { FxRatesService } from '@/fx/fx-rates.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ContentTranslationEnqueuer } from '@/content-translation/content-translation.enqueuer';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Currency, FaqPageType, Locale, Prisma } from '@prisma/client';
import { HomePageService } from './home-page.service';

function createMockPrismaService() {
  const client = {
    homePage: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    homePageTranslation: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    homePageEditorialCard: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    destination: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    category: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    hub: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    tourHub: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    tourCategory: {
      // The card PRICES (cheapest live tour behind each card).
      findMany: jest.fn().mockResolvedValue([]),
      // The card GATE: how many LIVE tours each category has on the banner's
      // island, weighed against the 3 a category page needs to exist.
      groupBy: jest.fn().mockResolvedValue([]),
    },
    faq: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    // The deck replace runs in one transaction with the base upsert. The mock
    // hands the callback the same client, so assertions read as if it were not
    // transactional - the ordering guarantee is Prisma's to keep, not ours.
    $transaction: jest.fn(),
  };
  client.$transaction.mockImplementation((fn: (tx: typeof client) => unknown) =>
    fn(client),
  );
  return client;
}

function createMockFaqGroupService() {
  return {
    getGroups: jest.fn().mockResolvedValue([]),
    createGroup: jest.fn().mockResolvedValue({}),
    updateGroup: jest.fn().mockResolvedValue({}),
    deleteGroup: jest.fn().mockResolvedValue({}),
    upsertTranslation: jest.fn().mockResolvedValue({}),
    deleteTranslation: jest
      .fn()
      .mockResolvedValue({ message: 'Translation cleared' }),
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
        {
          provide: ContentTranslationEnqueuer,
          useValue: { enqueue: jest.fn(), enqueueForPageType: jest.fn() },
        },
        {
          /*
           * A REAL rate (1 USD = 0.90 EUR), not an identity echo.
           *
           * This used to echo the amount back unconverted, which meant the
           * suite structurally could not tell a converted comparison from an
           * unconverted one - the exact bug the starting-price code exists to
           * prevent. With a real rate, picking the cheapest before converting
           * gives a different answer than picking it after, so the test can
           * actually see the difference.
           */
          provide: FxRatesService,
          useValue: {
            getDisplayRate: jest.fn((from: Currency, to: Currency) =>
              Promise.resolve(
                from === to
                  ? null
                  : {
                      rate: new Prisma.Decimal(
                        from === Currency.USD ? '0.9' : '1.111111',
                      ),
                    },
              ),
            ),
          },
        },
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
        editorialCards: [],
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
        metaTitle: null,
        metaDescription: null,
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
        editorialCards: [],
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
            metaTitle: 'Rondleidingen op de Cariben',
            metaDescription: null,
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
      // SEO meta is per-locale copy like any other field.
      expect(result.metaTitle).toBe('Rondleidingen op de Cariben');
      expect(result.metaDescription).toBeNull();
    });

    it('falls back to null copy when the locale has no row yet', async () => {
      prisma.homePage.findUnique.mockResolvedValue({
        heroImage: 'https://cdn/hero.jpg',
        editorialCards: [],
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

    /**
     * The fanned deck. Caption and slug come from the CATEGORY; the link is
     * additionally gated on that category having something bookable on the
     * banner's island. These cover every state an admin can put a card in, plus
     * the two the system can put it in behind their back (category archived,
     * last tour on that island going dark).
     */
    describe('editorial cards', () => {
      const CURACAO = { id: 'dest-1', slug: 'curacao' };

      /** An island to resolve, and a category whose PAGE is live on it. */
      function islandWithLivePage() {
        prisma.destination.findMany.mockResolvedValue([CURACAO]);
        prisma.tourCategory.groupBy.mockResolvedValue([
          { categoryId: 'cat-1', _count: { _all: 3 } },
        ]);
      }

      function homeWithCards(cards: unknown[]) {
        return {
          heroImage: null,
          editorialCards: cards,
          editorialDestinationId: null,
          ogImage: null,
          editorialDestination: null,
          translations: [],
        };
      }

      const buggy = {
        slug: 'buggy-tours',
        name: 'Buggy Tours',
        isActive: true,
        translations: [],
      };

      it('names a card from its category and hands back the slug', async () => {
        islandWithLivePage();
        prisma.homePage.findUnique.mockResolvedValue(
          homeWithCards([
            {
              id: 'c1',
              imageUrl: 'https://cdn/buggy.jpg',
              categoryId: 'cat-1',
              isLink: true,
              displayOrder: 0,
              category: buggy,
            },
          ]),
        );

        const [card] = (await service.getPublic(Locale.en)).editorialCards;

        // No island in the slug: the frontend joins it to the island it
        // resolved for the button, so the two can never disagree.
        expect(card).toEqual({
          image: 'https://cdn/buggy.jpg',
          name: 'Buggy Tours',
          categorySlug: 'buggy-tours',
          priceFrom: null,
          priceCurrency: null,
        });
      });

      /**
       * The starting price. The interesting case is not "does it find a
       * minimum" but "does it compare the RIGHT way": operators price in their
       * own currency, so the cheapest number and the cheapest tour are not the
       * same thing.
       */
      describe('starting price', () => {
        /** 100 USD (= 90 EUR) and 95 EUR behind the same card. */
        function mixedCurrencyTours() {
          prisma.destination.findMany.mockResolvedValue([CURACAO]);
          prisma.tourCategory.findMany.mockResolvedValue([
            {
              categoryId: 'cat-1',
              tour: {
                priceFrom: new Prisma.Decimal('100'),
                defaultCurrency: Currency.USD,
              },
            },
            {
              categoryId: 'cat-1',
              tour: {
                priceFrom: new Prisma.Decimal('95'),
                defaultCurrency: Currency.EUR,
              },
            },
          ]);
          prisma.homePage.findUnique.mockResolvedValue(
            homeWithCards([
              {
                id: 'c1',
                imageUrl: 'https://cdn/buggy.jpg',
                categoryId: 'cat-1',
                isLink: true,
                displayOrder: 0,
                category: buggy,
              },
            ]),
          );
        }

        it('converts before comparing, so the cheapest TOUR wins - not the smallest number', async () => {
          mixedCurrencyTours();

          const [card] = (await service.getPublic(Locale.en, Currency.EUR))
            .editorialCards;

          // 100 USD converts to 90 EUR, which beats the 95 EUR tour. Comparing
          // the raw amounts first would have picked 95 - smaller as a number,
          // more expensive as a price.
          expect(card.priceFrom).toBe('90');
          expect(card.priceCurrency).toBe(Currency.EUR);
        });

        it('still compares in ONE currency when the shopper currency is omitted', async () => {
          mixedCurrencyTours();

          const [card] = (await service.getPublic(Locale.en)).editorialCards;

          // The param is optional, and the tempting fallback - convert each
          // source to itself - converts nothing, putting us back to comparing
          // raw mixed amounts. It falls back to the platform base instead.
          expect(card.priceFrom).toBe('90');
          expect(card.priceCurrency).toBe(Currency.EUR);
        });

        it('gives an archived category no price, just as it gives it no name or link', async () => {
          prisma.destination.findMany.mockResolvedValue([CURACAO]);
          prisma.tourCategory.findMany.mockResolvedValue([
            {
              categoryId: 'cat-1',
              tour: {
                priceFrom: new Prisma.Decimal('100'),
                defaultCurrency: Currency.EUR,
              },
            },
          ]);
          prisma.homePage.findUnique.mockResolvedValue(
            homeWithCards([
              {
                id: 'c1',
                imageUrl: 'https://cdn/buggy.jpg',
                categoryId: 'cat-1',
                isLink: true,
                displayOrder: 0,
                category: { ...buggy, isActive: false },
              },
            ]),
          );

          const [card] = (await service.getPublic(Locale.en, Currency.EUR))
            .editorialCards;

          // A page we have decided must not be advertised must not be
          // advertised by its price either.
          expect(card.name).toBeNull();
          expect(card.categorySlug).toBeNull();
          expect(card.priceFrom).toBeNull();
          expect(card.priceCurrency).toBeNull();
        });
      });

      it('prefers the locale translation for the card name', async () => {
        islandWithLivePage();
        prisma.homePage.findUnique.mockResolvedValue(
          homeWithCards([
            {
              id: 'c1',
              imageUrl: 'https://cdn/buggy.jpg',
              categoryId: 'cat-1',
              isLink: true,
              displayOrder: 0,
              category: {
                ...buggy,
                translations: [{ name: 'Tours en buggy' }],
              },
            },
          ]),
        );

        const [card] = (await service.getPublic(Locale.es)).editorialCards;

        expect(card.name).toBe('Tours en buggy');
      });

      it('keeps the name but drops the slug when the link is switched off', async () => {
        islandWithLivePage();
        prisma.homePage.findUnique.mockResolvedValue(
          homeWithCards([
            {
              id: 'c1',
              imageUrl: 'https://cdn/buggy.jpg',
              categoryId: 'cat-1',
              isLink: false,
              displayOrder: 0,
              category: buggy,
            },
          ]),
        );

        const [card] = (await service.getPublic(Locale.en)).editorialCards;

        expect(card.name).toBe('Buggy Tours');
        expect(card.categorySlug).toBeNull();
      });

      it('degrades an archived category to a plain photo', async () => {
        islandWithLivePage();
        prisma.homePage.findUnique.mockResolvedValue(
          homeWithCards([
            {
              id: 'c1',
              imageUrl: 'https://cdn/buggy.jpg',
              categoryId: 'cat-1',
              isLink: true,
              displayOrder: 0,
              category: { ...buggy, isActive: false },
            },
          ]),
        );

        const [card] = (await service.getPublic(Locale.en)).editorialCards;

        // Neither named nor linked: the page it would open no longer resolves.
        expect(card.name).toBeNull();
        expect(card.categorySlug).toBeNull();
        expect(card.image).toBe('https://cdn/buggy.jpg');
      });

      it('drops the link when the category has no live tour on that island', async () => {
        prisma.destination.findMany.mockResolvedValue([CURACAO]);
        // The island resolves, the category is active and the admin asked for a
        // link - but nothing is bookable, so the category page would 404.
        prisma.tourCategory.groupBy.mockResolvedValue([]);
        prisma.homePage.findUnique.mockResolvedValue(
          homeWithCards([
            {
              id: 'c1',
              imageUrl: 'https://cdn/buggy.jpg',
              categoryId: 'cat-1',
              isLink: true,
              displayOrder: 0,
              category: buggy,
            },
          ]),
        );

        const [card] = (await service.getPublic(Locale.en)).editorialCards;

        // Still a card - photo and caption survive, only the door closes.
        expect(card.image).toBe('https://cdn/buggy.jpg');
        expect(card.name).toBe('Buggy Tours');
        expect(card.categorySlug).toBeNull();
      });

      it('drops the link when the category is under the 3-tour page bar', async () => {
        prisma.destination.findMany.mockResolvedValue([CURACAO]);
        // Two live tours: bookable, but not enough for the category page to
        // exist (master §2.4). Gating on "has a tour" would advertise a 404 -
        // which is exactly what put a 1-tour "Buggy Tours" in front of
        // travellers in production.
        prisma.tourCategory.groupBy.mockResolvedValue([
          { categoryId: 'cat-1', _count: { _all: 2 } },
        ]);
        prisma.homePage.findUnique.mockResolvedValue(
          homeWithCards([
            {
              id: 'c1',
              imageUrl: 'https://cdn/buggy.jpg',
              categoryId: 'cat-1',
              isLink: true,
              displayOrder: 0,
              category: buggy,
            },
          ]),
        );

        const [card] = (await service.getPublic(Locale.en)).editorialCards;

        expect(card.name).toBe('Buggy Tours');
        expect(card.categorySlug).toBeNull();
      });

      it('gates against the island the banner actually points at', async () => {
        prisma.destination.findMany.mockResolvedValue([CURACAO]);
        prisma.tourCategory.groupBy.mockResolvedValue([
          { categoryId: 'cat-1', _count: { _all: 3 } },
        ]);
        prisma.homePage.findUnique.mockResolvedValue(
          homeWithCards([
            {
              id: 'c1',
              imageUrl: 'https://cdn/buggy.jpg',
              categoryId: 'cat-1',
              isLink: true,
              displayOrder: 0,
              category: buggy,
            },
          ]),
        );

        const result = await service.getPublic(Locale.en);

        // The resolved island is reported, and the gate was asked about THAT
        // island - if the two ever diverged the gate would be meaningless.
        expect(result.editorialDestinationSlug).toBe('curacao');
        expect(
          prisma.tourCategory.groupBy.mock.calls[0][0].where.tour.destinationId,
        ).toBe(CURACAO.id);
      });

      it('leaves a category-less photo unnamed so the bundled label survives', async () => {
        prisma.homePage.findUnique.mockResolvedValue(
          homeWithCards([
            {
              id: 'c1',
              imageUrl: 'https://cdn/buggy.jpg',
              categoryId: null,
              isLink: false,
              displayOrder: 0,
              category: null,
            },
          ]),
        );

        const [card] = (await service.getPublic(Locale.en)).editorialCards;

        expect(card).toEqual({
          image: 'https://cdn/buggy.jpg',
          name: null,
          categorySlug: null,
          priceFrom: null,
          priceCurrency: null,
        });
      });
    });

    it('does not advertise an archived island in the CTA', async () => {
      prisma.homePage.findUnique.mockResolvedValue({
        heroImage: null,
        editorialCards: [],
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
      // The deck was not sent, so it must survive untouched.
      expect(prisma.homePageEditorialCard.deleteMany).not.toHaveBeenCalled();
    });

    it('clears a field when it is explicitly null', async () => {
      prisma.homePage.upsert.mockResolvedValue({});

      await service.update({ heroImage: null }, 'admin-1');

      const call = prisma.homePage.upsert.mock.calls[0][0];
      expect(call.update).toEqual({ heroImage: null });
    });

    it('replaces the deck wholesale, numbering slots by array order', async () => {
      prisma.homePage.upsert.mockResolvedValue({});
      prisma.category.findMany.mockResolvedValue([{ id: 'cat-1' }]);

      await service.update(
        {
          editorialCards: [
            { imageUrl: 'https://cdn/1.jpg', categoryId: 'cat-1' },
            { imageUrl: 'https://cdn/2.jpg' },
          ],
        },
        'admin-1',
      );

      expect(prisma.homePageEditorialCard.deleteMany).toHaveBeenCalledWith({
        where: { homeId: 'default' },
      });
      const { data } = prisma.homePageEditorialCard.createMany.mock.calls[0][0];
      expect(data).toEqual([
        {
          homeId: 'default',
          imageUrl: 'https://cdn/1.jpg',
          categoryId: 'cat-1',
          hubId: null,
          isLink: true,
          displayOrder: 0,
        },
        {
          homeId: 'default',
          imageUrl: 'https://cdn/2.jpg',
          categoryId: null,
          hubId: null,
          // No target to click through to, so the flag is normalised off
          // here rather than left for the public resolver to second-guess.
          isLink: false,
          displayOrder: 1,
        },
      ]);
    });

    it('stores a hub target, and the category wins when both are sent', async () => {
      prisma.homePage.upsert.mockResolvedValue({});
      prisma.category.findMany.mockResolvedValue([{ id: 'cat-1' }]);
      prisma.hub.findMany.mockResolvedValue([{ id: 'hub-1' }]);

      await service.update(
        {
          editorialCards: [
            { imageUrl: 'https://cdn/1.jpg', hubId: 'hub-1' },
            {
              imageUrl: 'https://cdn/2.jpg',
              categoryId: 'cat-1',
              hubId: 'hub-1',
            },
          ],
        },
        'admin-1',
      );

      const { data } = prisma.homePageEditorialCard.createMany.mock.calls[0][0];
      expect(data[0]).toMatchObject({
        categoryId: null,
        hubId: 'hub-1',
        isLink: true,
      });
      // At most one target: the category wins so the resolver never ties.
      expect(data[1]).toMatchObject({ categoryId: 'cat-1', hubId: null });
    });

    it('clears the deck when an empty array is sent', async () => {
      prisma.homePage.upsert.mockResolvedValue({});

      await service.update({ editorialCards: [] }, 'admin-1');

      expect(prisma.homePageEditorialCard.deleteMany).toHaveBeenCalled();
      expect(prisma.homePageEditorialCard.createMany).not.toHaveBeenCalled();
    });

    it('rejects a card pointing at a category that does not exist', async () => {
      prisma.category.findMany.mockResolvedValue([]);

      await expect(
        service.update(
          {
            editorialCards: [
              { imageUrl: 'https://cdn/1.jpg', categoryId: 'missing' },
            ],
          },
          'admin-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.homePageEditorialCard.deleteMany).not.toHaveBeenCalled();
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

    // The Translation Console clears a homepage FAQ by emptying both fields;
    // question/answer are NOT NULL, so that has to delete the locale row. This
    // route was the one FAQ surface missing it - the console got a 404 and
    // reported "Saved with 1 failure".
    it('clears one locale of a FAQ, always against the singleton key', async () => {
      const res = await service.deleteFaqTranslation(
        'default',
        'g1',
        Locale.es,
        'admin-1',
      );

      expect(faqGroups.deleteTranslation).toHaveBeenCalledWith(
        FaqPageType.homepage,
        'default',
        'g1',
        Locale.es,
      );
      expect(res).toEqual({ message: 'Translation cleared' });
    });

    it('404s a FAQ clear aimed at anything but the singleton', async () => {
      await expect(
        service.deleteFaqTranslation('nope', 'g1', Locale.es, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
      expect(faqGroups.deleteTranslation).not.toHaveBeenCalled();
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

    it('writes the SEO meta like any other copy field', async () => {
      prisma.homePage.upsert.mockResolvedValue({ id: 'default' });
      prisma.homePageTranslation.upsert.mockResolvedValue({});

      await service.upsertTranslation(
        Locale.en,
        {
          fields: {
            metaTitle: 'Caribbean Tours | Island Tours',
            metaDescription: 'Book boat trips and island tours.',
          },
        },
        'admin-1',
      );

      const call = prisma.homePageTranslation.upsert.mock.calls[0][0];
      expect(call.update).toEqual({
        isMachineTranslated: false,
        sourceHash: null,
        metaTitle: 'Caribbean Tours | Island Tours',
        metaDescription: 'Book boat trips and island tours.',
      });
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
        sourceHash: null,
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
        sourceHash: null,
        heroSubtitle: null,
      });
    });
  });
});
