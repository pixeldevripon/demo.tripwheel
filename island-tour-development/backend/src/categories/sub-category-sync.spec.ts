/**
 * Planner tests for `pnpm subcategories:sync` (client review #77).
 * The decisions are pure; the script only executes them.
 */
import {
  planRemovalForTour,
  planSubCategory,
  planTourRetag,
  type CategoryRow,
} from './sub-category-sync';

function cat(over: Partial<CategoryRow> & { slug: string }): CategoryRow {
  return {
    id: `id-${over.slug}`,
    isSeeded: false,
    isActive: true,
    parentCategoryId: null,
    childCount: 0,
    ...over,
  };
}

const SPEC = {
  slug: 'powerboat-tours',
  name: 'Powerboat Tours',
  parentSlug: 'boat-tours',
};

describe('planSubCategory', () => {
  it('creates a missing sub-category under its parent', () => {
    const bySlug = new Map([
      ['boat-tours', cat({ slug: 'boat-tours', isSeeded: true })],
    ]);
    expect(planSubCategory(SPEC, bySlug)).toEqual({
      kind: 'create',
      spec: SPEC,
      parentId: 'id-boat-tours',
    });
  });

  it('demotes an existing unseeded top-level category', () => {
    const bySlug = new Map([
      ['boat-tours', cat({ slug: 'boat-tours', isSeeded: true })],
      ['powerboat-tours', cat({ slug: 'powerboat-tours' })],
    ]);
    expect(planSubCategory(SPEC, bySlug)).toMatchObject({
      kind: 'demote',
      categoryId: 'id-powerboat-tours',
      parentId: 'id-boat-tours',
    });
  });

  it('never demotes a seeded category - the locked 19', () => {
    const bySlug = new Map([
      ['boat-tours', cat({ slug: 'boat-tours', isSeeded: true })],
      ['powerboat-tours', cat({ slug: 'powerboat-tours', isSeeded: true })],
    ]);
    expect(planSubCategory(SPEC, bySlug)).toMatchObject({
      kind: 'skip',
      reason: expect.stringContaining('seeded'),
    });
  });

  it('never nests a category that has children of its own', () => {
    const bySlug = new Map([
      ['boat-tours', cat({ slug: 'boat-tours', isSeeded: true })],
      ['powerboat-tours', cat({ slug: 'powerboat-tours', childCount: 1 })],
    ]);
    expect(planSubCategory(SPEC, bySlug)).toMatchObject({ kind: 'skip' });
  });

  it('is a no-op when already under the right parent (idempotent)', () => {
    const bySlug = new Map([
      ['boat-tours', cat({ slug: 'boat-tours', isSeeded: true })],
      [
        'powerboat-tours',
        cat({ slug: 'powerboat-tours', parentCategoryId: 'id-boat-tours' }),
      ],
    ]);
    expect(planSubCategory(SPEC, bySlug)).toMatchObject({ kind: 'noop' });
  });

  it('re-points a sub-category attached to the wrong parent', () => {
    const bySlug = new Map([
      ['boat-tours', cat({ slug: 'boat-tours', isSeeded: true })],
      [
        'powerboat-tours',
        cat({ slug: 'powerboat-tours', parentCategoryId: 'id-water-sports' }),
      ],
    ]);
    expect(planSubCategory(SPEC, bySlug)).toMatchObject({
      kind: 'repoint',
      parentId: 'id-boat-tours',
    });
  });

  it('skips when the parent is missing or itself a sub-category', () => {
    expect(planSubCategory(SPEC, new Map())).toMatchObject({ kind: 'skip' });
    const bySlug = new Map([
      ['boat-tours', cat({ slug: 'boat-tours', parentCategoryId: 'x' })],
    ]);
    expect(planSubCategory(SPEC, bySlug)).toMatchObject({ kind: 'skip' });
  });
});

describe('planTourRetag', () => {
  it('adds the parent link and moves the primary off the sub', () => {
    expect(
      planTourRetag(
        { tourId: 't1', categoryIds: ['sub'], primaryCategoryId: 'sub' },
        'sub',
        'parent',
      ),
    ).toEqual({ tourId: 't1', addParentLink: true, movePrimaryToParent: true });
  });

  it('is a no-op when the parent link exists and the sub is not primary', () => {
    expect(
      planTourRetag(
        {
          tourId: 't1',
          categoryIds: ['sub', 'parent'],
          primaryCategoryId: 'parent',
        },
        'sub',
        'parent',
      ),
    ).toEqual({
      tourId: 't1',
      addParentLink: false,
      movePrimaryToParent: false,
    });
  });
});

describe('planRemovalForTour (Private Charter)', () => {
  it('detaches and re-points the primary when the removed link held it', () => {
    expect(
      planRemovalForTour(
        {
          tourId: 't1',
          categoryIds: ['private-charter', 'boat'],
          primaryCategoryId: 'private-charter',
        },
        'private-charter',
      ),
    ).toEqual({ kind: 'detach', tourId: 't1', nextPrimaryId: 'boat' });
  });

  it('detaches without touching a primary held elsewhere', () => {
    expect(
      planRemovalForTour(
        {
          tourId: 't1',
          categoryIds: ['private-charter', 'boat'],
          primaryCategoryId: 'boat',
        },
        'private-charter',
      ),
    ).toEqual({ kind: 'detach', tourId: 't1', nextPrimaryId: null });
  });

  it('NEVER leaves a tour category-less - sole-category tours are kept and reported', () => {
    expect(
      planRemovalForTour(
        {
          tourId: 't1',
          categoryIds: ['private-charter'],
          primaryCategoryId: 'private-charter',
        },
        'private-charter',
      ),
    ).toEqual({ kind: 'keep-sole-category', tourId: 't1' });
  });
});
