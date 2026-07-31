import { Locale } from '@prisma/client';
import { ContentTranslationService } from './content-translation.service';
import { EntityRegistry } from './entity-registry';

/**
 * The overwrite policy is the product here: the cases that matter are the
 * ones that lose a translator's work (overwriting a human row), burn quota
 * (re-translating an unchanged source) or leak a proper noun into a provider
 * payload. Registry collectors are exercised through the real EntityRegistry
 * with a mocked Prisma - the policy and the collectors fail together in
 * production, so they are tested together here.
 */

function mockPrisma(): any {
  const upsert = () => ({ upsert: jest.fn().mockResolvedValue({}) });
  const noRows = () => jest.fn().mockResolvedValue([]);
  return {
    category: { findUnique: jest.fn(), findMany: noRows() },
    destination: { findUnique: jest.fn(), findMany: noRows() },
    tour: { findUnique: jest.fn(), findMany: noRows() },
    hub: { findUnique: jest.fn(), findMany: noRows() },
    collection: { findUnique: jest.fn(), findMany: noRows() },
    homePage: { findUnique: jest.fn(), findFirst: jest.fn() },
    recommendation: { findUnique: jest.fn(), findMany: noRows() },
    faq: { findMany: jest.fn().mockResolvedValue([]), ...upsert() },
    pageContentSection: {
      findMany: jest.fn().mockResolvedValue([]),
      ...upsert(),
    },
    categoryTranslation: upsert(),
    categoryPageContent: upsert(),
    destinationTranslation: upsert(),
    destinationPageContent: upsert(),
    tourTranslation: upsert(),
    tourHighlightTranslation: upsert(),
    tourInclusionTranslation: upsert(),
    tourExclusionTranslation: upsert(),
    tourFeatureTranslation: upsert(),
    tourLocationTranslation: upsert(),
    pickupLocationTranslation: upsert(),
    collectionTourRationale: upsert(),
    homePageTranslation: upsert(),
  };
}

/** Echo-provider: proves what was sent and lets writes be asserted verbatim. */
function mockProvider(): any {
  return {
    isConfigured: jest.fn().mockResolvedValue(true),
    translateFields: jest
      .fn()
      .mockImplementation(
        (fields: Record<string, string | string[]>, _from: any, to: string) =>
          Promise.resolve(
            Object.fromEntries(
              Object.entries(fields).map(([k, v]) => [
                k,
                Array.isArray(v) ? v.map((i) => `${to}:${i}`) : `${to}:${v}`,
              ]),
            ),
          ),
      ),
    translateText: jest.fn(),
  };
}

function mockPublicCache(): any {
  return { revalidateTags: jest.fn().mockResolvedValue(true) };
}

const enRow = (fields: Record<string, unknown>) => ({
  locale: Locale.en,
  isMachineTranslated: false,
  sourceHash: null,
  ...fields,
});

/** No clear marks unless a test says otherwise. */
function mockClearMarks() {
  return {
    mark: jest.fn().mockResolvedValue(undefined),
    markForPageType: jest.fn().mockResolvedValue(undefined),
    loadFor: jest.fn().mockResolvedValue(new Set<string>()),
    forget: jest.fn().mockResolvedValue(undefined),
  };
}

describe('ContentTranslationService', () => {
  let prisma: any;
  let provider: any;
  let publicCache: any;
  let enqueuer: any;
  let clearMarks: any;
  let svc: ContentTranslationService;

  beforeEach(() => {
    prisma = mockPrisma();
    provider = mockProvider();
    publicCache = mockPublicCache();
    enqueuer = { enqueue: jest.fn(), enqueueForPageType: jest.fn() };
    clearMarks = mockClearMarks();
    svc = new ContentTranslationService(
      new EntityRegistry(prisma, clearMarks),
      publicCache,
      provider,
      prisma,
      enqueuer,
    );
  });

  it('is inert when unconfigured - no reads, no provider calls', async () => {
    provider.isConfigured.mockResolvedValue(false);

    const res = await svc.translateEntity('category', 'c1');

    expect(res.reason).toBe('not_configured');
    expect(prisma.category.findUnique).not.toHaveBeenCalled();
    expect(provider.translateFields).not.toHaveBeenCalled();
  });

  it('treats a deleted entity as done, not an error', async () => {
    prisma.category.findUnique.mockResolvedValue(null);

    const res = await svc.translateEntity('category', 'gone');

    expect(res.reason).toBe('not_found');
    expect(provider.translateFields).not.toHaveBeenCalled();
  });

  it('translates every unit into every missing locale on a first pass', async () => {
    prisma.category.findUnique.mockResolvedValue({
      id: 'c1',
      name: 'Snorkeling',
      translations: [enRow({ overview: 'Best snorkeling trips.' })],
      pageContents: [enRow({ aboutText: 'About snorkeling here.' })],
    });
    prisma.faq.findMany.mockResolvedValue([
      {
        ...enRow({ question: 'Do I need a license?', answer: 'No.' }),
        faqGroupId: 'g1',
        displayOrder: 2,
        isActive: true,
      },
    ]);

    const res = await svc.translateEntity('category', 'c1');

    // 3 units (main, page content, one FAQ group) x 6 locales.
    expect(res.written).toBe(18);
    // ONE provider call per locale, not per unit - that is the rate-limit deal.
    expect(provider.translateFields).toHaveBeenCalledTimes(6);
    expect(prisma.categoryTranslation.upsert).toHaveBeenCalledTimes(6);
    expect(prisma.categoryPageContent.upsert).toHaveBeenCalledTimes(6);
    expect(prisma.faq.upsert).toHaveBeenCalledTimes(6);

    // The category name translates (unlike destination/hub) and falls back to
    // the base-row name when the en row has no override.
    const esCall = prisma.categoryTranslation.upsert.mock.calls.find(
      (c: any) => c[0].where.categoryId_locale.locale === Locale.es,
    );
    expect(esCall[0].create).toEqual(
      expect.objectContaining({
        name: 'es:Snorkeling',
        overview: 'es:Best snorkeling trips.',
        isMachineTranslated: true,
        sourceHash: expect.any(String),
      }),
    );
    // Machine FAQ rows keep the English row's ordering attributes.
    const faqCreate = prisma.faq.upsert.mock.calls[0][0].create;
    expect(faqCreate).toEqual(
      expect.objectContaining({
        faqGroupId: 'g1',
        displayOrder: 2,
        isActive: true,
        isMachineTranslated: true,
      }),
    );
    // Public cache busted once, with the entity's own tags.
    expect(publicCache.revalidateTags).toHaveBeenCalledWith([
      'category:c1',
      'categories',
    ]);
  });

  it('never overwrites a human translation, but still fills the other locales', async () => {
    prisma.category.findUnique.mockResolvedValue({
      id: 'c1',
      name: 'Snorkeling',
      translations: [
        enRow({ overview: 'Best snorkeling trips.' }),
        {
          locale: Locale.es,
          isMachineTranslated: false,
          sourceHash: null,
          // Every source field present -> nothing fillable, row untouched.
          name: 'Esnórquel',
          overview: 'Texto escrito por una persona.',
        },
      ],
      pageContents: [],
    });

    const res = await svc.translateEntity('category', 'c1');

    const locales = prisma.categoryTranslation.upsert.mock.calls.map(
      (c: any) => c[0].where.categoryId_locale.locale,
    );
    expect(locales).not.toContain(Locale.es);
    expect(locales).toHaveLength(5);
    expect(res.skipped).toBe(1);
  });

  it('leaves a field the human cleared-and-saved EMPTY (no gap-fill)', async () => {
    // Founder decision 2026-07-28: clearing a field in the console and
    // saving is a deliberate "show English here". The row is human, so the
    // AI must not touch it - not the empty field, not the written one. The
    // public page falls back to English for the cleared field.
    prisma.category.findUnique.mockResolvedValue({
      id: 'c1',
      name: 'Snorkeling',
      translations: [
        enRow({ overview: 'Best snorkeling trips.' }),
        {
          locale: Locale.nl,
          isMachineTranslated: false,
          sourceHash: null,
          name: null, // cleared and saved - must STAY cleared
          overview: 'Handgeschreven overzicht.',
        },
      ],
      pageContents: [],
    });

    const res = await svc.translateEntity('category', 'c1', [Locale.nl]);

    expect(res.written).toBe(0);
    expect(res.skipped).toBe(1);
    expect(provider.translateFields).not.toHaveBeenCalled();
    expect(prisma.categoryTranslation.upsert).not.toHaveBeenCalled();
  });

  it('does NOT re-create a FAQ the console cleared (the row is gone, the mark is not)', async () => {
    // The NOT NULL surfaces cannot store a blank, so clearing DELETES the
    // locale row. Without the mark that gap looks exactly like "never
    // translated" and the next English edit would put the FAQ back - which is
    // the bug the clear-mark table exists to kill.
    prisma.category.findUnique.mockResolvedValue({
      id: 'c1',
      name: 'Snorkeling',
      translations: [enRow({ overview: 'Best snorkeling trips.' })],
      pageContents: [],
    });
    prisma.faq.findMany.mockResolvedValue([
      {
        locale: Locale.en,
        faqGroupId: 'g1',
        question: 'What should I bring?',
        answer: 'Sunscreen.',
        displayOrder: 0,
        isActive: true,
        isMachineTranslated: false,
        sourceHash: null,
      },
    ]);
    clearMarks.loadFor.mockResolvedValue(new Set(['faq:g1@@nl']));

    const res = await svc.translateEntity('category', 'c1', [Locale.nl]);

    expect(prisma.faq.upsert).not.toHaveBeenCalled();
    // The main unit still translates - a clear is per unit, not per entity.
    expect(prisma.categoryTranslation.upsert).toHaveBeenCalledTimes(1);
    expect(res.skipped).toBe(1);
  });

  it('a mark never suppresses another locale', async () => {
    prisma.category.findUnique.mockResolvedValue({
      id: 'c1',
      name: 'Snorkeling',
      translations: [enRow({ overview: 'Best snorkeling trips.' })],
      pageContents: [],
    });
    clearMarks.loadFor.mockResolvedValue(new Set(['main@@nl']));

    const nl = await svc.translateEntity('category', 'c1', [Locale.nl]);
    const de = await svc.translateEntity('category', 'c1', [Locale.de]);

    expect(nl.written).toBe(0);
    expect(de.written).toBe(1);
  });

  it('force overrides a clear mark - the admin asked for it explicitly', async () => {
    prisma.category.findUnique.mockResolvedValue({
      id: 'c1',
      name: 'Snorkeling',
      translations: [enRow({ overview: 'Best snorkeling trips.' })],
      pageContents: [],
    });
    clearMarks.loadFor.mockResolvedValue(new Set(['main@@nl']));

    const res = await svc.translateEntity('category', 'c1', [Locale.nl], true);

    expect(res.written).toBe(1);
  });

  it('force DOES rewrite a human row, cleared fields included', async () => {
    // The escape hatch stays: the console's "Translate with AI" button (behind
    // a confirm dialog) is the one path that overrides a human row.
    prisma.category.findUnique.mockResolvedValue({
      id: 'c1',
      name: 'Snorkeling',
      translations: [
        enRow({ overview: 'Best snorkeling trips.' }),
        {
          locale: Locale.nl,
          isMachineTranslated: false,
          sourceHash: null,
          name: null,
          overview: 'Handgeschreven overzicht.',
        },
      ],
      pageContents: [],
    });

    const res = await svc.translateEntity('category', 'c1', [Locale.nl], true);

    expect(res.written).toBe(1);
    const call = prisma.categoryTranslation.upsert.mock.calls[0][0];
    expect(call.update.isMachineTranslated).toBe(true);
  });

  it('skips locales already built from THIS source without a provider call', async () => {
    const source = { overview: 'Unchanged copy.' };
    const hash = ContentTranslationService.hash(source);
    prisma.category.findUnique.mockResolvedValue({
      id: 'c1',
      name: '',
      translations: [
        enRow(source),
        ...[
          Locale.nl,
          Locale.de,
          Locale.fr,
          Locale.es,
          Locale.pt,
          Locale.zh,
        ].map((locale) => ({
          locale,
          isMachineTranslated: true,
          sourceHash: hash,
          overview: '[cached]',
        })),
      ],
      pageContents: [],
    });

    const res = await svc.translateEntity('category', 'c1');

    // A re-run over unchanged copy is free - the whole point of sourceHash.
    expect(res.written).toBe(0);
    expect(res.skipped).toBe(6);
    expect(provider.translateFields).not.toHaveBeenCalled();
    expect(publicCache.revalidateTags).not.toHaveBeenCalled();
  });

  it('refreshes a machine row built from an OLDER source', async () => {
    prisma.category.findUnique.mockResolvedValue({
      id: 'c1',
      name: '',
      translations: [
        enRow({ overview: 'New copy after an edit.' }),
        {
          locale: Locale.nl,
          isMachineTranslated: true,
          sourceHash: 'stale-hash',
          overview: '[stale]',
        },
      ],
      pageContents: [],
    });

    await svc.translateEntity('category', 'c1');

    const locales = prisma.categoryTranslation.upsert.mock.calls.map(
      (c: any) => c[0].where.categoryId_locale.locale,
    );
    expect(locales).toContain(Locale.nl);
  });

  it('NEVER sends a destination name to the provider (proper noun)', async () => {
    prisma.destination.findUnique.mockResolvedValue({
      id: 'd1',
      translations: [
        enRow({ name: 'Curaçao', overview: 'Island of hidden beaches.' }),
      ],
      pageContents: [],
    });

    await svc.translateEntity('destination', 'd1', [Locale.de]);

    const payload = provider.translateFields.mock.calls[0][0];
    expect(Object.keys(payload)).toEqual(['main.overview']);
    // And the write never carries a name either.
    const data = prisma.destinationTranslation.upsert.mock.calls[0][0].create;
    expect(data.name).toBeUndefined();
  });

  it('round-trips tour array fields and translates child rows from their en row', async () => {
    prisma.tour.findUnique.mockResolvedValue({
      id: 't1',
      translations: [
        enRow({
          title: 'Catamaran trip',
          whatToBring: ['Swimwear', 'Sunscreen'],
        }),
      ],
      highlights: [
        {
          id: 'h1',
          translations: [enRow({ text: 'Open bar on board' })],
        },
      ],
      inclusions: [],
      exclusions: [],
      features: [],
      locations: [],
      pickupLocations: [],
    });

    const res = await svc.translateEntity('tour', 't1', [Locale.fr]);

    expect(res.written).toBe(2); // main + one highlight
    const payload = provider.translateFields.mock.calls[0][0];
    expect(payload['main.whatToBring']).toEqual(['Swimwear', 'Sunscreen']);
    expect(payload['highlight:h1.text']).toBe('Open bar on board');

    const main = prisma.tourTranslation.upsert.mock.calls[0][0];
    expect(main.create.whatToBring).toEqual(['fr:Swimwear', 'fr:Sunscreen']);
    expect(publicCache.revalidateTags).toHaveBeenCalledWith([
      'tour:t1',
      'tours',
      'search',
    ]);
  });

  it('does nothing (and calls no provider) when there is no English source yet', async () => {
    prisma.category.findUnique.mockResolvedValue({
      id: 'c1',
      name: '   ',
      translations: [],
      pageContents: [],
    });

    const res = await svc.translateEntity('category', 'c1');

    expect(res.written).toBe(0);
    expect(provider.translateFields).not.toHaveBeenCalled();
  });

  describe('enqueuePending (nightly sweep)', () => {
    it('enqueues the recent entities of every type, recommendations and the homepage included', async () => {
      prisma.tour.findMany.mockResolvedValue([{ id: 't1' }, { id: 't2' }]);
      prisma.category.findMany.mockResolvedValue([{ id: 'c1' }]);
      prisma.recommendation.findMany.mockResolvedValue([{ id: 'r1' }]);
      prisma.homePage.findFirst.mockResolvedValue({ id: 'default' });

      const res = await svc.enqueuePending(10);

      expect(res.enqueued).toBe(5);
      expect(enqueuer.enqueue).toHaveBeenCalledWith('tour', 't1');
      expect(enqueuer.enqueue).toHaveBeenCalledWith('category', 'c1');
      expect(enqueuer.enqueue).toHaveBeenCalledWith('recommendation', 'r1');
      expect(enqueuer.enqueue).toHaveBeenCalledWith('homepage', 'default');
    });

    /**
     * The homepage is self-seeded on first admin read, so a database where nobody
     * has opened the editor yet has no row at all. The sweep has to skip it rather
     * than enqueue a job for an id that does not exist. (Hotels need no such
     * guard - `findMany` on an empty table is simply an empty list.)
     */
    it('skips the homepage singleton when it has no row yet', async () => {
      prisma.homePage.findFirst.mockResolvedValue(null);

      const res = await svc.enqueuePending(10);

      expect(res.enqueued).toBe(0);
      expect(enqueuer.enqueue).not.toHaveBeenCalled();
    });

    it('does not even read the database while unconfigured', async () => {
      provider.isConfigured.mockResolvedValue(false);

      const res = await svc.enqueuePending();

      expect(res.enqueued).toBe(0);
      expect(prisma.tour.findMany).not.toHaveBeenCalled();
    });
  });

  it('propagates a provider failure so the queue can retry', async () => {
    prisma.category.findUnique.mockResolvedValue({
      id: 'c1',
      name: 'Snorkeling',
      translations: [enRow({ overview: 'Copy.' })],
      pageContents: [],
    });
    provider.translateFields.mockRejectedValue(new Error('Gemini HTTP 429'));

    await expect(svc.translateEntity('category', 'c1')).rejects.toThrow(
      'Gemini HTTP 429',
    );
    expect(prisma.categoryTranslation.upsert).not.toHaveBeenCalled();
  });
});
