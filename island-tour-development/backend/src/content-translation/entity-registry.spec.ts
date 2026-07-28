import { Locale } from '@prisma/client';
import { EntityRegistry } from './entity-registry';

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

describe('EntityRegistry - hub curation units', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let registry: EntityRegistry;

  beforeEach(() => {
    prisma = mockPrisma();
    registry = new EntityRegistry(prisma);
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
