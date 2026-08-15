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

dotenv.config();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DRY_RUN = process.argv.includes('--dry');

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
    }
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
  const bySlug = await loadCategories();

  for (const spec of SUB_CATEGORY_SYNC.subCategories) {
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
          // End of the parent's row, as in the admin create flow. Filter-only:
          // sub-categories write NO slug-registry rows.
          const sortOrder =
            ((
              await prisma.category.aggregate({
                where: { parentCategoryId: action.parentId },
                _max: { sortOrder: true },
              })
            )._max.sortOrder ?? -1) + 1;
          await prisma.category
            .create({
              data: {
                name: spec.name,
                slug: spec.slug,
                parentCategoryId: action.parentId,
                sortOrder,
                isSeeded: false,
              },
            })
            .catch((err: unknown) => {
              if ((err as { code?: string })?.code === 'P2002') {
                log(`SKIP   ${spec.slug}: slug already exists (raced?)`);
                return null;
              }
              throw err;
            });
        }
        continue;
      }
      case 'repoint':
        log(`REPOINT ${spec.slug}: moving under ${spec.parentSlug}`);
        if (!DRY_RUN) {
          await prisma.category.update({
            where: { id: action.categoryId },
            data: { parentCategoryId: action.parentId },
          });
        }
        await retagTours(action.categoryId, action.parentId, spec.slug);
        continue;
      case 'demote': {
        log(
          `DEMOTE ${spec.slug} under ${spec.parentSlug} (page slugs retired, 90-day cooldown)`,
        );
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
        }
        await retagTours(action.categoryId, action.parentId, spec.slug);
        continue;
      }
    }
  }

  // ── Booking-type duplicates (Private Charter) ───────────────────────────────
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
      log(`  ${removal.slug}: deactivated, page slugs retired`);
    }
  }

  log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
