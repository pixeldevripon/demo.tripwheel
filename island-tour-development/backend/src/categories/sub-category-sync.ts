/**
 * Pure planning logic for `pnpm subcategories:sync` (client review #77).
 *
 * The script gathers current state, this module DECIDES, the script executes.
 * Split so the decisions - which category is created vs demoted vs skipped,
 * how a tour's links are retagged, when Private Charter can be dissolved -
 * are unit-testable without a database.
 *
 * Invariants honoured (mirroring categories.service.ts):
 *  - Seeded categories are never demoted (the locked master 19).
 *  - A category with children can never become a sub-category (one level).
 *  - A demotion retires the category's page slugs (the script calls
 *    markSlugsDeleted in the same transaction).
 *  - A tour always keeps >=1 category and exactly one primary; a sub-category
 *    is never a tour's primary once its parent link exists (a sub has no
 *    page, so a breadcrumb pointing at it would 404).
 */
import type {
  SubCategorySpec,
  BookingTypeRemovalSpec,
} from '../../prisma/data/sub-categories.config';

export interface CategoryRow {
  id: string;
  slug: string;
  isSeeded: boolean;
  isActive: boolean;
  parentCategoryId: string | null;
  childCount: number;
}

export type SubCategoryAction =
  | { kind: 'create'; spec: SubCategorySpec; parentId: string }
  | {
      kind: 'demote';
      spec: SubCategorySpec;
      categoryId: string;
      parentId: string;
    }
  | {
      kind: 'repoint';
      spec: SubCategorySpec;
      categoryId: string;
      parentId: string;
    }
  | { kind: 'noop'; spec: SubCategorySpec; categoryId: string }
  | { kind: 'skip'; spec: SubCategorySpec; reason: string };

/** Decide what to do for one configured sub-category. */
export function planSubCategory(
  spec: SubCategorySpec,
  bySlug: Map<string, CategoryRow>,
): SubCategoryAction {
  const parent = bySlug.get(spec.parentSlug);
  if (!parent) {
    return {
      kind: 'skip',
      spec,
      reason: `parent "${spec.parentSlug}" not found`,
    };
  }
  if (parent.parentCategoryId) {
    return {
      kind: 'skip',
      spec,
      reason: `parent "${spec.parentSlug}" is itself a sub-category`,
    };
  }
  const existing = bySlug.get(spec.slug);
  if (!existing) return { kind: 'create', spec, parentId: parent.id };
  if (existing.parentCategoryId === parent.id) {
    return { kind: 'noop', spec, categoryId: existing.id };
  }
  if (existing.parentCategoryId) {
    // Already a sub-category, but of the WRONG parent - re-point only.
    return {
      kind: 'repoint',
      spec,
      categoryId: existing.id,
      parentId: parent.id,
    };
  }
  if (existing.isSeeded) {
    return {
      kind: 'skip',
      spec,
      reason: 'seeded master category - the locked 19 are never demoted',
    };
  }
  if (existing.childCount > 0) {
    return {
      kind: 'skip',
      spec,
      reason: 'has sub-categories of its own - one level of nesting only',
    };
  }
  return { kind: 'demote', spec, categoryId: existing.id, parentId: parent.id };
}

export interface TourLinkRow {
  tourId: string;
  /** Category ids this tour is linked to. */
  categoryIds: string[];
  /** The tour's current primary category id (exactly one by invariant). */
  primaryCategoryId: string | null;
}

export interface TourRetagOps {
  tourId: string;
  /** Create a (tourId, parentId) link, non-primary. */
  addParentLink: boolean;
  /** Move isPrimary from the sub-category link to the parent link. */
  movePrimaryToParent: boolean;
}

/**
 * A tour tagged with a sub-category must also carry the parent (that is what
 * puts it on the parent's page; the sub link is the Row-2 chip tag), and the
 * sub must never remain its PRIMARY.
 */
export function planTourRetag(
  link: TourLinkRow,
  subCategoryId: string,
  parentId: string,
): TourRetagOps {
  const hasParent = link.categoryIds.includes(parentId);
  return {
    tourId: link.tourId,
    addParentLink: !hasParent,
    movePrimaryToParent: link.primaryCategoryId === subCategoryId,
  };
}

export type RemovalTourAction =
  | { kind: 'detach'; tourId: string; nextPrimaryId: string | null }
  | { kind: 'keep-sole-category'; tourId: string };

/**
 * Private-Charter dissolution for one tour: drop the link, re-pointing the
 * primary onto another of the tour's categories when needed - but NEVER
 * leave a tour category-less: a sole-category tour keeps the link and is
 * reported for manual re-categorisation instead.
 */
export function planRemovalForTour(
  link: TourLinkRow,
  removedCategoryId: string,
): RemovalTourAction {
  const others = link.categoryIds.filter((id) => id !== removedCategoryId);
  if (others.length === 0) {
    return { kind: 'keep-sole-category', tourId: link.tourId };
  }
  return {
    kind: 'detach',
    tourId: link.tourId,
    nextPrimaryId:
      link.primaryCategoryId === removedCategoryId ? others[0] : null,
  };
}

export type { SubCategorySpec, BookingTypeRemovalSpec };
