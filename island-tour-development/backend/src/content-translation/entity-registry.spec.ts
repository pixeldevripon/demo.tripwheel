import { Locale } from '@prisma/client';
import { EntityRegistry } from './entity-registry';
import { MEDIA_BUCKET_SIZE } from './content-translation.constants';

/**
 * Focused on the hub collector's curation surfaces (Our Picks, comparison,
 * content sections) - the parts with non-obvious sourcing rules: picks and
 * comparison read their EN source from the BASE row, content-section blocks
 * are matched across locales by (sectionType, displayOrder) because the rows
 * have no FK group key, and headingless blocks (heading === body) translate
 * the body once and mirror it. The main/page-content/FAQ units follow the
 * same shape as every other entity and are covered by the service spec.
 */

function mockPrisma(): any {
  return {
    hub: { findUnique: jest.fn() },
    faq: { findMany: jest.fn().mockResolvedValue([]) },
    pageContentSection: { findMany: jest.fn().mockResolvedValue([]) },
    hubOurPickTranslation: { upsert: jest.fn().mockResolvedValue({}) },
    hubComparisonGroupTranslation: { upsert: jest.fn().mockResolvedValue({}) },
    hubComparisonTourTranslation: { upsert: jest.fn().mockResolvedValue({}) },
    hubContentSection: {
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
  };
}

/** A hub row with empty defaults, overridable per test. */
function hubRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'hub-1',
    translations: [],
    pageContents: [],
    ourPicks: [],
    comparisonGroups: [],
    contentSections: [],
    ...overrides,
  };
}

/** No clear marks unless a test says otherwise. */
function mockClearMarks() {
  return {
    mark: jest.fn().mockResolvedValue(undefined),
    markForPageType: jest.fn().mockResolvedValue(undefined),
    loadFor: jest.fn().mockResolvedValue(new Set<string>()),
    forget: jest.fn().mockResolvedValue(undefined),
  };
}

describe('EntityRegistry - hub curation units', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let registry: EntityRegistry;
  let clearMarks: ReturnType<typeof mockClearMarks>;

  beforeEach(() => {
    prisma = mockPrisma();
    clearMarks = mockClearMarks();
    registry = new EntityRegistry(prisma, clearMarks as never);
  });

  it('builds an Our-Pick unit sourced from the BASE description and upserts by (pick, locale)', async () => {
    prisma.hub.findUnique.mockResolvedValue(
      hubRow({
        ourPicks: [
          {
            id: 'pick-1',
            description: 'Best boat on the island',
            translations: [
              {
                locale: Locale.de,
                description: 'Alt',
                isMachineTranslated: true,
                sourceHash: 'old',
              },
            ],
          },
        ],
      }),
    );

    const units = (await registry.collect('hub', 'hub-1'))!;
    const pick = units.find((u) => u.key === 'ourpick:pick-1')!;

    expect(pick.source).toEqual({ description: 'Best boat on the island' });
    expect(pick.existing[Locale.de]).toMatchObject({
      isMachineTranslated: true,
      sourceHash: 'old',
    });

    await pick.write(Locale.de, { description: 'Bestes Boot' }, 'h1', true);
    expect(prisma.hubOurPickTranslation.upsert).toHaveBeenCalledWith({
      where: { ourPickId_locale: { ourPickId: 'pick-1', locale: Locale.de } },
      create: {
        ourPickId: 'pick-1',
        locale: Locale.de,
        description: 'Bestes Boot',
        isMachineTranslated: true,
        sourceHash: 'h1',
      },
      update: {
        description: 'Bestes Boot',
        isMachineTranslated: true,
        sourceHash: 'h1',
      },
    });
  });

  it('builds comparison units per group and per tour column, skipping empty standout notes', async () => {
    prisma.hub.findUnique.mockResolvedValue(
      hubRow({
        comparisonGroups: [
          {
            id: 'g1',
            groupName: 'Comfort trips',
            translations: [],
            comparisonTours: [
              {
                id: 'ct1',
                standoutNote: 'Dive school on board',
                translations: [],
              },
              { id: 'ct2', standoutNote: null, translations: [] },
            ],
          },
        ],
      }),
    );

    const units = (await registry.collect('hub', 'hub-1'))!;

    expect(units.find((u) => u.key === 'compgroup:g1')!.source).toEqual({
      groupName: 'Comfort trips',
    });
    expect(units.find((u) => u.key === 'comptour:ct1')!.source).toEqual({
      standoutNote: 'Dive school on board',
    });
    // Empty source = the service skips it; the unit exists but says nothing.
    expect(units.find((u) => u.key === 'comptour:ct2')!.source).toEqual({});
  });

  it('matches content-section blocks across locales by (sectionType, displayOrder)', async () => {
    prisma.hub.findUnique.mockResolvedValue(
      hubRow({
        contentSections: [
          {
            id: 's-en',
            locale: Locale.en,
            sectionType: 'DISCOVER',
            heading: 'Hidden beaches',
            body: 'Long text',
            image: 'img.jpg',
            displayOrder: 2,
            isMachineTranslated: false,
            sourceHash: null,
          },
          {
            id: 's-de',
            locale: Locale.de,
            sectionType: 'DISCOVER',
            heading: 'Versteckte Strände',
            body: 'Langer Text',
            image: null,
            displayOrder: 2,
            isMachineTranslated: true,
            sourceHash: 'old',
          },
          // Same type, different order - a DIFFERENT block, must not match.
          {
            id: 's-de-other',
            locale: Locale.de,
            sectionType: 'DISCOVER',
            heading: 'Anders',
            body: 'Anders',
            image: null,
            displayOrder: 3,
            isMachineTranslated: false,
            sourceHash: null,
          },
        ],
      }),
    );

    const units = (await registry.collect('hub', 'hub-1'))!;
    const block = units.find((u) => u.key === 'hubsection:DISCOVER:2')!;

    expect(block.source).toEqual({
      heading: 'Hidden beaches',
      body: 'Long text',
    });
    expect(block.existing[Locale.de]).toMatchObject({
      isMachineTranslated: true,
      sourceHash: 'old',
    });

    // Existing sibling -> update in place.
    await block.write(
      Locale.de,
      { heading: 'Neu', body: 'Neuer Text' },
      'h2',
      true,
    );
    expect(prisma.hubContentSection.update).toHaveBeenCalledWith({
      where: { id: 's-de' },
      data: {
        heading: 'Neu',
        body: 'Neuer Text',
        isMachineTranslated: true,
        sourceHash: 'h2',
      },
    });

    // No sibling in that locale -> create, copying the EN block's shape.
    await block.write(
      Locale.fr,
      { heading: 'Plages cachées', body: 'Texte long' },
      'h2',
      true,
    );
    expect(prisma.hubContentSection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        hubId: 'hub-1',
        locale: Locale.fr,
        sectionType: 'DISCOVER',
        heading: 'Plages cachées',
        body: 'Texte long',
        image: 'img.jpg',
        displayOrder: 2,
        isMachineTranslated: true,
        sourceHash: 'h2',
      }),
    });
  });

  it('translates headingless blocks (heading === body) once and mirrors the body into heading', async () => {
    prisma.hub.findUnique.mockResolvedValue(
      hubRow({
        contentSections: [
          {
            id: 's-en',
            locale: Locale.en,
            sectionType: 'FAST_FACT',
            heading: 'Same text',
            body: 'Same text',
            image: null,
            displayOrder: 0,
            isMachineTranslated: false,
            sourceHash: null,
          },
        ],
      }),
    );

    const units = (await registry.collect('hub', 'hub-1'))!;
    const block = units.find((u) => u.key === 'hubsection:FAST_FACT:0')!;

    // Body only - the same text must not be paid for twice.
    expect(block.source).toEqual({ body: 'Same text' });

    await block.write(Locale.nl, { body: 'Zelfde tekst' }, 'h3', true);
    expect(prisma.hubContentSection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        heading: 'Zelfde tekst',
        body: 'Zelfde tekst',
      }),
    });
  });

  it('builds no curation units from non-EN section rows (translations are targets, not sources)', async () => {
    prisma.hub.findUnique.mockResolvedValue(
      hubRow({
        contentSections: [
          {
            id: 's-de',
            locale: Locale.de,
            sectionType: 'DISCOVER',
            heading: 'Nur Deutsch',
            body: 'Kein EN',
            image: null,
            displayOrder: 0,
            isMachineTranslated: false,
            sourceHash: null,
          },
        ],
      }),
    );

    const units = (await registry.collect('hub', 'hub-1'))!;
    expect(units.some((u) => u.key.startsWith('hubsection:'))).toBe(false);
  });
});

describe('EntityRegistry - clear marks', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let clearMarks: ReturnType<typeof mockClearMarks>;
  let registry: EntityRegistry;

  beforeEach(() => {
    prisma = mockPrisma();
    clearMarks = mockClearMarks();
    registry = new EntityRegistry(prisma as never, clearMarks as never);
  });

  it('stamps `cleared` on the unit whose locale row is absent', async () => {
    prisma.hub.findUnique.mockResolvedValue(
      hubRow({
        ourPicks: [
          {
            id: 'pick-1',
            description: 'The one to book.',
            translations: [],
          },
        ],
      }),
    );
    clearMarks.loadFor.mockResolvedValue(new Set(['ourpick:pick-1@@nl']));

    const units = await registry.collect('hub', 'h1');
    const pick = units?.find((u) => u.key === 'ourpick:pick-1');

    expect(pick?.cleared?.nl).toBe(true);
    expect(pick?.cleared?.de).toBeUndefined();
  });

  it('garbage-collects a mark once the human has typed the translation back in', async () => {
    // The row itself now carries the policy (isMachineTranslated: false), so
    // the mark is dead weight - and would wrongly suppress translation if a
    // wholesale editor save later replaced the row.
    prisma.hub.findUnique.mockResolvedValue(
      hubRow({
        ourPicks: [
          {
            id: 'pick-1',
            description: 'The one to book.',
            translations: [
              {
                locale: 'nl',
                description: 'Deze moet je boeken.',
                isMachineTranslated: false,
                sourceHash: null,
              },
            ],
          },
        ],
      }),
    );
    clearMarks.loadFor.mockResolvedValue(new Set(['ourpick:pick-1@@nl']));

    const units = await registry.collect('hub', 'h1');
    const pick = units?.find((u) => u.key === 'ourpick:pick-1');

    expect(pick?.cleared?.nl).toBeUndefined();
    expect(clearMarks.forget).toHaveBeenCalledWith('hub', 'h1', [
      { unitKey: 'ourpick:pick-1', locale: 'nl' },
    ]);
  });

  it('skips the mark query result entirely when an entity has none', async () => {
    prisma.hub.findUnique.mockResolvedValue(hubRow({}));

    await registry.collect('hub', 'h1');

    expect(clearMarks.forget).not.toHaveBeenCalled();
  });
});

/**
 * The media collector is the one that batches: a single job carries up to
 * MEDIA_BUCKET_SIZE assets so they share ONE provider call per locale. Its other
 * oddity is that the English source is the asset row itself, not an `en`
 * translation row.
 */
describe('EntityRegistry - media buckets', () => {
  let prisma: any;
  let registry: EntityRegistry;

  const asset = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    title: 'Hero',
    description: null,
    altText: 'A boat',
    translations: [],
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      mediaGallery: { findMany: jest.fn().mockResolvedValue([]) },
      mediaTranslation: { upsert: jest.fn().mockResolvedValue({}) },
    };
    registry = new EntityRegistry(prisma, mockClearMarks() as never);
  });

  it('turns a bucket into one unit per asset, keyed by asset id', async () => {
    prisma.mediaGallery.findMany.mockResolvedValue([asset('a1'), asset('a2')]);

    const units = await registry.collect('media', 'bucket:a');

    expect(units?.map((u) => u.key)).toEqual(['media:a1', 'media:a2']);
    // Source comes off the BASE row (no `en` translation row exists for media).
    expect(units?.[0].source).toEqual({ title: 'Hero', altText: 'A boat' });
  });

  it('queries the bucket least-translated-first, capped at the batch size', async () => {
    await registry.collect('media', 'bucket:7');

    const args = prisma.mediaGallery.findMany.mock.calls[0][0];
    expect(args.where.id).toEqual({ startsWith: '7' });
    // Ordering by updatedAt instead would re-offer the same finished fifty
    // forever and never reach the fifty-first asset in a big bucket.
    expect(args.orderBy[0]).toEqual({ translations: { _count: 'asc' } });
    expect(args.take).toBe(MEDIA_BUCKET_SIZE);
    // Nothing to translate without English copy to translate FROM.
    expect(args.where.OR).toEqual([
      { title: { not: null } },
      { description: { not: null } },
      { altText: { not: null } },
    ]);
  });

  it('accepts a bare uuid for the manual per-asset button', async () => {
    prisma.mediaGallery.findMany.mockResolvedValue([asset('a1')]);

    const units = await registry.collect('media', 'a1');

    expect(prisma.mediaGallery.findMany.mock.calls[0][0].where).toEqual({
      id: 'a1',
    });
    expect(units).toHaveLength(1);
  });

  it('treats an empty BUCKET as no work, but a missing ASSET as gone', async () => {
    // A drained bucket is a normal nightly no-op; returning null would log it
    // as "deleted while queued".
    expect(await registry.collect('media', 'bucket:f')).toEqual([]);
    expect(await registry.collect('media', 'missing-id')).toBeNull();
  });

  it('writes through to the asset own locale row', async () => {
    prisma.mediaGallery.findMany.mockResolvedValue([asset('a1')]);

    const units = await registry.collect('media', 'bucket:a');
    await units?.[0].write(
      Locale.nl,
      { title: 'Held', altText: 'Een boot' },
      'hash-1',
      true,
    );

    const args = prisma.mediaTranslation.upsert.mock.calls[0][0];
    expect(args.where).toEqual({
      mediaId_locale: { mediaId: 'a1', locale: Locale.nl },
    });
    expect(args.create).toMatchObject({
      mediaId: 'a1',
      locale: Locale.nl,
      title: 'Held',
      altText: 'Een boot',
      isMachineTranslated: true,
      sourceHash: 'hash-1',
    });
  });

  it('reports an existing locale row so the policy can protect it', async () => {
    prisma.mediaGallery.findMany.mockResolvedValue([
      asset('a1', {
        translations: [
          {
            locale: Locale.nl,
            title: null,
            description: null,
            altText: null,
            isMachineTranslated: false,
            sourceHash: null,
          },
        ],
      }),
    ]);

    const units = await registry.collect('media', 'bucket:a');

    // Human row with everything blank = a deliberate clear. The service skips
    // it, and media needs no clear-MARK to say so because the row survives.
    expect(units?.[0].existing[Locale.nl]).toEqual({
      isMachineTranslated: false,
      sourceHash: null,
    });
  });
});
