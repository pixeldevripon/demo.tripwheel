/**
 * sync-sub-categories.ts - makes the category taxonomy match the canonical
 * sub-category config (client review #77 / master 2.4 + E.2).
 *
 * WHY: master 2.4 locks 19 top-level categories; the extras are the right
 * idea at the wrong level. This command converges the database onto
 * prisma/data/sub-categories.config.ts: it CREATES configured sub-categories
 * that do not exist, DEMOTES existing top-level extras under their parent
 * (retiring their page slugs exactly like the admin demotion flow), RETAGS
 * tours so every sub-tagged tour also carries the parent (and the sub is
 * never the primary - a sub-category has no page for a breadcrumb), and
 * dissolves booking-type duplicates (Private Charter -> bookingType=PRIVATE).
 *
 * Run:  pnpm subcategories:sync            (from backend/)
 *       pnpm subcategories:sync -- --dry   (report only, writes nothing)
 *
 * On the production VPS: run it inside the backend app directory (same place
 * `prisma migrate deploy` runs), e.g.
 *       docker compose exec backend pnpm subcategories:sync -- --dry
 *       docker compose exec backend pnpm subcategories:sync
 * Adding a future sub-category = add a line to the config, deploy, run this
 * command once. Idempotent: a converged database yields all no-ops.
 *
 * Notes:
 *  - Seeded (locked-19) categories are never demoted - reported and skipped.
 *  - A tour is never left category-less: a Private-Charter-only tour keeps
 *    its link and is reported for manual re-categorisation; the category is
 *    only deactivated once no links remain.
 *  - Every mutation batch runs in a transaction with the same slug-registry
 *    bookkeeping the admin flows use (markSlugsDeleted on demotion).
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, SlugEntityType, TourBookingType } from '@prisma/client';
import * as dotenv from 'dotenv';

import { SUB_CATEGORY_SYNC } from '../prisma/data/sub-categories.config';
import {
  planRemovalForTour,
  planSubCategory,
  planTourRetag,
  type CategoryRow,
  type TourLinkRow,
} from '../src/categories/sub-category-sync';
import { markSlugsDeleted } from '../src/common/utils/slug-registry.util';
import { PublicCacheService } from '../src/workers/public-cache.service';

dotenv.config();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DRY_RUN = process.argv.includes('--dry');

/** Set whenever a write actually happened - drives the cache bust below. */
let mutated = false;

function log(line: string): void {
  console.log(`${DRY_RUN ? '[dry] ' : ''}${line}`);
}

async function loadCategories(): Promise<Map<string, CategoryRow>> {
  const rows = await prisma.category.findMany({
    select: {
      id: true,
      slug: true,
      isSeeded: true,
      isActive: true,
      parentCategoryId: true,
      _count: { select: { subCategories: true } },
    },
  });
  return new Map(
    rows.map((r) => [
      r.slug,
      {
        id: r.id,
        slug: r.slug,
        isSeeded: r.isSeeded,
        isActive: r.isActive,
        parentCategoryId: r.parentCategoryId,
        childCount: r._count.subCategories,
      },
    ]),
  );
}

/** Tour links for every tour attached to `categoryId`. */
async function loadTourLinks(categoryId: string): Promise<TourLinkRow[]> {
  const links = await prisma.tourCategory.findMany({
    where: { categoryId },
    select: { tourId: true },
  });
  if (links.length === 0) return [];
  const all = await prisma.tourCategory.findMany({
    where: { tourId: { in: links.map((l) => l.tourId) } },
    select: { tourId: true, categoryId: true, isPrimary: true },
  });
  const byTour = new Map<string, TourLinkRow>();
  for (const l of all) {
    const row = byTour.get(l.tourId) ?? {
      tourId: l.tourId,
      categoryIds: [],
      primaryCategoryId: null,
    };
    row.categoryIds.push(l.categoryId);
    if (l.isPrimary) row.primaryCategoryId = l.categoryId;
    byTour.set(l.tourId, row);
  }
  return [...byTour.values()];
}

/** Retag every tour on the sub-category so parent+primary invariants hold. */
async function retagTours(
  subCategoryId: string,
  parentId: string,
  label: string,
): Promise<void> {
  const tours = await loadTourLinks(subCategoryId);
  let added = 0;
  let repointed = 0;
  for (const link of tours) {
    const ops = planTourRetag(link, subCategoryId, parentId);
    if (!ops.addParentLink && !ops.movePrimaryToParent) continue;
    if (!DRY_RUN) {
      try {
        await prisma.$transaction(async (tx) => {
          if (ops.addParentLink) {
            await tx.tourCategory.create({
              data: {
                tourId: ops.tourId,
                categoryId: parentId,
                isPrimary: false,
              },
            });
          }
          if (ops.movePrimaryToParent) {
            await tx.tourCategory.update({
              where: {
                tourId_categoryId: {
                  tourId: ops.tourId,
                  categoryId: subCategoryId,
                },
              },
              data: { isPrimary: false },
            });
            await tx.tourCategory.update({
              where: {
                tourId_categoryId: { tourId: ops.tourId, categoryId: parentId },
              },
              data: { isPrimary: true },
            });
          }
        });
      } catch (err: unknown) {
        // An admin attaching the parent to the same tour mid-run races the
        // link create (P2002 on tourId+categoryId). One tour's race must not
        // abort the whole run - report it; the idempotent re-run converges.
        if ((err as { code?: string })?.code === 'P2002') {
          log(
            `  ${label}: tour ${ops.tourId} raced a concurrent edit - re-run to converge`,
          );
          continue;
        }
        throw err;
      }
    }
    if (!DRY_RUN) mutated = true;
    if (ops.addParentLink) added++;
    if (ops.movePrimaryToParent) repointed++;
  }
  if (added || repointed) {
    log(
      `  ${label}: +${added} parent link(s), ${repointed} primary(ies) moved to the parent`,
    );
  }
}

async function main(): Promise<void> {
  log('Syncing sub-categories from prisma/data/sub-categories.config.ts ...');

  for (const spec of SUB_CATEGORY_SYNC.subCategories) {
    // Reloaded EVERY iteration: earlier entries mutate the taxonomy, and a
    // stale snapshot would let a later entry nest under a parent that was
    // itself just demoted - silently breaking single-level nesting. 23 rows;
    // the re-read costs nothing next to that landmine.
    const bySlug = await loadCategories();
    const action = planSubCategory(spec, bySlug);
    switch (action.kind) {
      case 'skip':
        log(`SKIP   ${spec.slug}: ${action.reason}`);
        continue;
      case 'noop':
        log(
          `OK     ${spec.slug}: already a sub-category of ${spec.parentSlug}`,
        );
        await retagTours(
          action.categoryId,
          bySlug.get(spec.parentSlug)!.id,
          spec.slug,
        );
        continue;
      case 'create': {
        log(`CREATE ${spec.slug} under ${spec.parentSlug}`);
        if (!DRY_RUN) {
          // End of the parent's row, as in the admin create flow - aggregate
          // and create in ONE transaction (same shape as the service) so a
          // concurrent sibling create cannot hand out the same sortOrder.
          // Filter-only: sub-categories write NO slug-registry rows.
          await prisma
            .$transaction(async (tx) => {
              const sortOrder =
                ((
                  await tx.category.aggregate({
                    where: { parentCategoryId: action.parentId },
                    _max: { sortOrder: true },
                  })
                )._max.sortOrder ?? -1) + 1;
              await tx.category.create({
                data: {
                  name: spec.name,
                  slug: spec.slug,
                  parentCategoryId: action.parentId,
                  sortOrder,
                  isSeeded: false,
                },
              });
            })
            .catch((err: unknown) => {
              if ((err as { code?: string })?.code === 'P2002') {
                log(`SKIP   ${spec.slug}: slug already exists (raced?)`);
                return null;
              }
              throw err;
            });
          mutated = true;
        }
        continue;
      }
      case 'repoint':
        log(`REPOINT ${spec.slug}: moving under ${spec.parentSlug}`);
        // Retag FIRST: the interim state (dual-tagged tours, category not yet
        // moved) is valid, so an interrupted run never leaves a tour's
        // breadcrumb pointing at a page-less category.
        await retagTours(action.categoryId, action.parentId, spec.slug);
        if (!DRY_RUN) {
          await prisma.category.update({
            where: { id: action.categoryId },
            data: { parentCategoryId: action.parentId },
          });
          mutated = true;
        }
        continue;
      case 'demote': {
        log(
          `DEMOTE ${spec.slug} under ${spec.parentSlug} (page slugs retired, 90-day cooldown)`,
        );
        // Retag BEFORE the page slugs are retired (see repoint): an
        // interrupted run leaves tours dual-tagged with the category still
        // top-level - valid - instead of primaries pointing at a 404.
        await retagTours(action.categoryId, action.parentId, spec.slug);
        if (!DRY_RUN) {
          // Same transaction shape as the admin demotion (categories.service
          // update with confirmPageRemoval): nest + retire the page slugs.
          await prisma.$transaction(async (tx) => {
            await tx.category.update({
              where: { id: action.categoryId },
              data: { parentCategoryId: action.parentId },
            });
            await markSlugsDeleted(
              tx,
              SlugEntityType.CATEGORY,
              action.categoryId,
            );
          });
          mutated = true;
        }
        continue;
      }
    }
  }

  // ── Orphan-heal pass (review #78) ───────────────────────────────────────────
  // EVERY sub-category - configured here or demoted through the admin UI -
  // gets the same retag, so no tour is left carrying a sub tag without its
  // parent (the tours write-guards reject such a set, and pre-fix admin
  // demotions never retagged). Converged data makes this a pure no-op.
  const healState = await loadCategories();
  const byId = new Map([...healState.values()].map((c) => [c.id, c]));
  for (const row of healState.values()) {
    if (!row.parentCategoryId) continue;
    const parent = byId.get(row.parentCategoryId);
    if (!parent) continue;
    await retagTours(row.id, parent.id, row.slug);
  }

  // ── Booking-type duplicates (Private Charter) ───────────────────────────────
  // Fresh state again - the loop above may have reshaped the taxonomy.
  const bySlug = await loadCategories();
  for (const removal of SUB_CATEGORY_SYNC.removeToBookingType) {
    const cat = bySlug.get(removal.slug);
    if (!cat) {
      log(`OK     ${removal.slug}: not present, nothing to dissolve`);
      continue;
    }
    log(`DISSOLVE ${removal.slug} -> bookingType=${removal.bookingType}`);
    const tours = await loadTourLinks(cat.id);
    let stamped = 0;
    let detached = 0;
    const stragglers: string[] = [];
    for (const link of tours) {
      const action = planRemovalForTour(link, cat.id);
      if (!DRY_RUN) {
        await prisma.$transaction(async (tx) => {
          await tx.tour.update({
            where: { id: link.tourId },
            data: { bookingType: TourBookingType.PRIVATE },
          });
          if (action.kind === 'detach') {
            if (action.nextPrimaryId) {
              await tx.tourCategory.update({
                where: {
                  tourId_categoryId: {
                    tourId: link.tourId,
                    categoryId: action.nextPrimaryId,
                  },
                },
                data: { isPrimary: true },
              });
            }
            await tx.tourCategory.delete({
              where: {
                tourId_categoryId: { tourId: link.tourId, categoryId: cat.id },
              },
            });
          }
        });
      }
      if (!DRY_RUN) mutated = true;
      stamped++;
      if (action.kind === 'detach') detached++;
      else stragglers.push(link.tourId);
    }
    log(
      `  ${removal.slug}: ${stamped} tour(s) stamped PRIVATE, ${detached} link(s) detached`,
    );
    if (stragglers.length > 0) {
      log(
        `  KEPT ACTIVE: ${stragglers.length} tour(s) have no other category - ` +
          `re-categorise manually, then re-run: ${stragglers.join(', ')}`,
      );
    } else if (!DRY_RUN) {
      // No links left: hide the page everywhere, keep the slug protected.
      await prisma.$transaction(async (tx) => {
        await tx.category.update({
          where: { id: cat.id },
          data: { isActive: false },
        });
        await markSlugsDeleted(tx, SlugEntityType.CATEGORY, cat.id);
      });
      mutated = true;
      log(`  ${removal.slug}: deactivated, page slugs retired`);
    }
  }

  if (mutated) {
    // Direct Prisma writes bypass the dashboard's revalidation bridge - bust
    // the public 'use cache' tags ourselves, or demoted category pages keep
    // serving until their cacheLife window expires (observed in verification).
    await new PublicCacheService().revalidateTags([
      'categories',
      'slug-registry',
      'tours',
      'search',
    ]);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
