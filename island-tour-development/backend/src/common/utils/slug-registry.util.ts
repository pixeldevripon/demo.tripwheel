import { Prisma, SlugEntityType } from '@prisma/client';

/**
 * Shared slug-registry mechanics (master SLUG-REGISTRY rules), transaction-aware so
 * every slug-bearing entity service (tours, categories, hubs, collections, destinations)
 * reuses one implementation. All functions take a Prisma client - pass the `$transaction`
 * `tx` client so the writes commit atomically with the entity mutation (rule #4).
 *
 * Two master guarantees:
 * - **Rename → auto 301**: renaming a slug re-points the registry row(s), records a 301
 *   redirect from the old slug, and collapses redirect chains.
 * - **Delete → 90-day cooldown**: a hard-deleted slug is *not* removed; its row is kept
 *   (`isActive=false`, `deletedAt=now`) so the slug stays protected and 404s until the
 *   cooldown elapses, after which it can be reused.
 */
export const SLUG_REUSE_COOLDOWN_DAYS = 90;

/** Accepts both the full PrismaService and a `$transaction` client. */
type SlugClient = Prisma.TransactionClient;

/** Slugs hard-deleted before this instant are out of cooldown and reusable. */
export function slugCooldownCutoff(): Date {
  return new Date(Date.now() - SLUG_REUSE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Whether an existing slug_registry row blocks (re)use of its slug. A row blocks unless
 * it was hard-deleted (`deletedAt` set) more than the cooldown ago - those ghosts are
 * reusable and should be cleared with {@link clearCooledDownSlugs} before a new row is written.
 */
export function slugRowBlocks(
  row: { deletedAt: Date | null } | null | undefined,
): boolean {
  if (!row) return false;
  if (row.deletedAt && row.deletedAt < slugCooldownCutoff()) return false;
  return true;
}

/** Deletes cooled-down ghost rows for the given (destinationSlug, slug) pairs. */
export async function clearCooledDownSlugs(
  tx: SlugClient,
  pairs: { destinationSlug: string; slug: string }[],
): Promise<void> {
  if (pairs.length === 0) return;
  await tx.slugRegistry.deleteMany({
    where: {
      OR: pairs.map((p) => ({
        destinationSlug: p.destinationSlug,
        slug: p.slug,
      })),
      deletedAt: { lt: slugCooldownCutoff() },
    },
  });
}

/**
 * Whether (destinationSlug, slug) is currently taken by a protected row that is not owned
 * by `excludeEntityId` (so an entity renaming onto its own existing slug is not blocked).
 */
export async function isSlugTaken(
  tx: SlugClient,
  destinationSlug: string,
  slug: string,
  excludeEntityId?: string,
): Promise<boolean> {
  const row = await tx.slugRegistry.findUnique({
    where: { destinationSlug_slug: { destinationSlug, slug } },
    select: { entityId: true, deletedAt: true },
  });
  if (!row) return false;
  if (excludeEntityId && row.entityId === excludeEntityId) return false;
  return slugRowBlocks(row);
}

/**
 * Hard-delete cooldown: keep the entity's registry rows, marking them `isActive=false` +
 * `deletedAt=now`. The slug stays protected (404s) and is reusable only after the cooldown.
 */
export async function markSlugsDeleted(
  tx: SlugClient,
  entityType: SlugEntityType,
  entityId: string,
): Promise<void> {
  await tx.slugRegistry.updateMany({
    where: { entityType, entityId },
    data: { isActive: false, deletedAt: new Date() },
  });
}

/**
 * Hard-delete cooldown for a whole destination namespace: keeps every slug_registry row
 * under `destinationSlug` but marks them `isActive=false` + `deletedAt=now`. Used when a
 * destination is permanently deleted (its child slugs stay protected for the cooldown).
 */
export async function markDestinationSlugsDeleted(
  tx: SlugClient,
  destinationSlug: string,
): Promise<void> {
  await tx.slugRegistry.updateMany({
    where: { destinationSlug },
    data: { isActive: false, deletedAt: new Date() },
  });
}

/** Clears cooled-down ghost rows across an entire destination namespace before re-seeding it. */
export async function clearCooledDownDestinationSlugs(
  tx: SlugClient,
  destinationSlug: string,
): Promise<void> {
  await tx.slugRegistry.deleteMany({
    where: { destinationSlug, deletedAt: { lt: slugCooldownCutoff() } },
  });
}

/**
 * Renames a slug across ALL of an entity's registry rows (handles multi-destination
 * categories): clears cooled-down ghosts at the target, re-points the rows, writes a 301
 * redirect old→new per destination, and collapses any chains pointing at the old slug.
 */
export async function renameEntitySlug(
  tx: SlugClient,
  params: {
    entityType: SlugEntityType;
    entityId: string;
    fromSlug: string;
    toSlug: string;
  },
): Promise<void> {
  const { entityType, entityId, fromSlug, toSlug } = params;
  if (fromSlug === toSlug) return;

  const rows = await tx.slugRegistry.findMany({
    where: { entityType, entityId },
    select: { destinationSlug: true },
  });
  const destinationSlugs = [...new Set(rows.map((r) => r.destinationSlug))];
  if (destinationSlugs.length === 0) return;

  await clearCooledDownSlugs(
    tx,
    destinationSlugs.map((destinationSlug) => ({
      destinationSlug,
      slug: toSlug,
    })),
  );

  // Re-point every registry row for this entity to the new slug.
  await tx.slugRegistry.updateMany({
    where: { entityType, entityId },
    data: { slug: toSlug },
  });

  for (const destinationSlug of destinationSlugs) {
    // Collapse chains: redirects that pointed to the old slug now point to the new slug.
    await tx.slugRedirect.updateMany({
      where: { destinationSlug, toSlug: fromSlug },
      data: { toSlug },
    });
    // The target slug is live again - drop any stale redirect leaving it.
    await tx.slugRedirect.deleteMany({
      where: { destinationSlug, fromSlug: toSlug },
    });
    // Auto-301 old → new.
    await tx.slugRedirect.upsert({
      where: { destinationSlug_fromSlug: { destinationSlug, fromSlug } },
      create: {
        destinationSlug,
        fromSlug,
        toSlug,
        entityType,
        statusCode: 301,
      },
      update: { toSlug },
    });
  }
}
