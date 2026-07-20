import { Locale } from '@/common/constants/locales';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  FeaturedEntityType,
  HubStatus,
  TourStatus,
  type Prisma,
} from '@prisma/client';
import {
  CreateFeaturedExperienceDto,
  UpdateFeaturedExperienceDto,
} from './dto/featured-experience.dto';

/**
 * The carousel's slide geometry and dot row assume a small curated set. Resolving
 * more than this is almost certainly a curation mistake, so the public read caps
 * the list - and logs when it does, because a silently truncated list reads as
 * "everything is showing" when it is not.
 */
const MAX_PUBLIC_EXPERIENCES = 8;

/** A resolved card: everything the frontend needs, nothing it has to look up. */
export interface ResolvedExperience {
  id: string;
  entityType: FeaturedEntityType;
  title: string;
  image: string | null;
  videoUrl: string | null;
  /** Locale-less path (`/curacao/snorkeling`); the frontend localizes it. */
  href: string;
}

@Injectable()
export class FeaturedExperiencesService {
  private readonly logger = new Logger(FeaturedExperiencesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Public resolve ──────────────────────────────────────────────────────────

  /**
   * Resolve the curated rows into renderable cards.
   *
   * Title, image and href all come from the referenced Category/Hub rather than
   * being stored on the featured row, so a card inherits that entity's
   * translations and can never drift from the page it links to.
   *
   * THE GATE IS THE POINT: a card must never outlive what it points at. Each
   * gate is at least its target page's 404 condition (and for hubs, stricter -
   * see `resolveHub`), so a featured card can never be a dead link. Anything
   * that fails to resolve is dropped silently: a missing card is a much smaller
   * failure than a broken one.
   *
   * @param destinationSlug omit for the global homepage (matches only
   *        "show everywhere" rows); pass a slug on a destination page to also
   *        pick up rows pinned to it.
   */
  async resolvePublic(
    locale: Locale,
    destinationSlug?: string,
  ): Promise<ResolvedExperience[]> {
    const pinnedDestination = destinationSlug
      ? await this.prisma.destination.findUnique({
          where: { slug: destinationSlug },
          select: { id: true, isActive: true },
        })
      : null;

    const rows = await this.prisma.featuredExperience.findMany({
      where: {
        isActive: true,
        // "Show everywhere" rows (destinationId null) appear on every surface;
        // a destination page additionally picks up rows pinned to it.
        ...(pinnedDestination?.isActive
          ? {
              OR: [
                { destinationId: null },
                { destinationId: pinnedDestination.id },
              ],
            }
          : { destinationId: null }),
      },
      select: {
        id: true,
        entityType: true,
        entityId: true,
        destinationId: true,
        videoUrl: true,
        displayOrder: true,
      },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });

    if (!rows.length) return [];

    const categoryIds = rows
      .filter((r) => r.entityType === FeaturedEntityType.CATEGORY)
      .map((r) => r.entityId);
    const hubIds = rows
      .filter((r) => r.entityType === FeaturedEntityType.HUB)
      .map((r) => r.entityId);

    const [categories, hubs, categoryTourRows] = await Promise.all([
      this.loadCategories(categoryIds, locale),
      this.loadHubs(hubIds, locale),
      this.loadCategoryTourDestinations(categoryIds),
    ]);

    // categoryId -> destinationId -> live tour count, for both the gate and the
    // "which island is this category strongest on" pick below.
    const countsByCategory = new Map<string, Map<string, number>>();
    for (const row of categoryTourRows) {
      const destinationId = row.tour.destinationId;
      if (!destinationId) continue;
      const perDestination =
        countsByCategory.get(row.categoryId) ?? new Map<string, number>();
      perDestination.set(
        destinationId,
        (perDestination.get(destinationId) ?? 0) + 1,
      );
      countsByCategory.set(row.categoryId, perDestination);
    }

    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const hubById = new Map(hubs.map((h) => [h.id, h]));

    const resolved: ResolvedExperience[] = [];
    for (const row of rows) {
      const card =
        row.entityType === FeaturedEntityType.HUB
          ? this.resolveHub(row, hubById.get(row.entityId))
          : this.resolveCategory(
              row,
              categoryById.get(row.entityId),
              countsByCategory.get(row.entityId),
            );
      if (card) resolved.push(card);
    }

    if (resolved.length > MAX_PUBLIC_EXPERIENCES) {
      this.logger.warn(
        `Featured experiences resolved ${resolved.length} cards; showing the first ${MAX_PUBLIC_EXPERIENCES} by display order`,
      );
      return resolved.slice(0, MAX_PUBLIC_EXPERIENCES);
    }
    return resolved;
  }

  /**
   * Hub gate: active + PUBLISHED + at least one live tour. A hub always belongs
   * to exactly one destination, so unlike a category it resolves its own URL
   * without any guesswork.
   *
   * NOTE: this is deliberately STRICTER than the hub page's own 404 condition.
   * `hubs.service.render()` gates only on `isActive` + `PUBLISHED`, and
   * `assertPublishable` never requires a tour - so a hub with zero live tours
   * renders a valid page. We still refuse to feature it, because the section is
   * "Top island experiences": sending a traveller to a page with nothing
   * bookable is a dead end even when it returns 200. Categories reach the same
   * bar via their own gate, which does require a live tour.
   *
   * The consequence to know: an admin can publish a hub, feature it, and see no
   * card, with no error to explain it. The dashboard picker (Phase 4) should
   * surface "no live tours" rather than leaving them guessing.
   */
  private resolveHub(
    row: { id: string; videoUrl: string | null; destinationId: string | null },
    hub?: HubRow,
  ): ResolvedExperience | null {
    if (!hub) return null;
    if (!hub.isActive || hub.status !== HubStatus.PUBLISHED) return null;
    if (!hub.destination.isActive) return null;
    if (hub._count.tourHubs === 0) return null;
    // A row pinned to a different destination than the hub's own is a curation
    // mistake; showing it would advertise the hub on the wrong island.
    if (row.destinationId && row.destinationId !== hub.destinationId) {
      return null;
    }

    return {
      id: row.id,
      entityType: FeaturedEntityType.HUB,
      title: hub.translations[0]?.name || hub.name,
      image: cardImage(hub.heroImage, hub.ogImage),
      videoUrl: row.videoUrl,
      href: `/${hub.destination.slug}/${hub.slug}`,
    };
  }

  /**
   * Category gate, mirroring `categories.service.getByDestinationSlug`: the page
   * 404s unless destination and category are both active AND the pair has at
   * least one live tour.
   *
   * A category page only exists per-destination, so a row with no pinned
   * destination has no single URL. Rather than dropping those (all the seeded
   * rows are destination-less) we resolve the destination where the category is
   * strongest - most live tours, ties broken by destination id so the choice is
   * stable between requests. That guarantees a count > 0, i.e. a page that
   * renders, and picks the most convincing one to send a traveller to.
   */
  private resolveCategory(
    row: { id: string; videoUrl: string | null; destinationId: string | null },
    category?: CategoryRow,
    counts?: Map<string, number>,
  ): ResolvedExperience | null {
    if (!category || !category.isActive || !counts) return null;

    let destinationId: string | null | undefined = row.destinationId;
    if (destinationId) {
      if (!counts.get(destinationId)) return null;
    } else {
      destinationId = pickStrongestDestination(counts);
      if (!destinationId) return null;
    }

    const destination = category.destinationsById.get(destinationId);
    if (!destination) return null;

    return {
      id: row.id,
      entityType: FeaturedEntityType.CATEGORY,
      title: category.translations[0]?.name || category.name,
      image: cardImage(category.heroImage, category.ogImage),
      videoUrl: row.videoUrl,
      href: `/${destination.slug}/${category.slug}`,
    };
  }

  private async loadCategories(ids: string[], locale: Locale) {
    if (!ids.length) return [];

    const [categories, destinations] = await Promise.all([
      this.prisma.category.findMany({
        where: { id: { in: ids } },
        select: {
          ...CATEGORY_SELECT,
          translations: { where: { locale }, select: { name: true } },
        },
      }),
      // Small set (a handful of islands), fetched once and shared by every card
      // rather than joined per row.
      this.prisma.destination.findMany({
        where: { isActive: true },
        select: { id: true, slug: true },
      }),
    ]);

    const destinationsById = new Map(destinations.map((d) => [d.id, d]));
    return categories.map((c) => ({ ...c, destinationsById }));
  }

  private async loadHubs(ids: string[], locale: Locale) {
    if (!ids.length) return [];

    return this.prisma.hub.findMany({
      where: { id: { in: ids } },
      select: {
        ...HUB_SELECT,
        translations: { where: { locale }, select: { name: true } },
        _count: {
          select: {
            tourHubs: {
              where: { tour: { status: TourStatus.LIVE, isActive: true } },
            },
          },
        },
      },
    });
  }

  /**
   * Every (category, destination) pairing that has a live tour, in one query.
   * Tallied in memory rather than grouped in SQL because Prisma cannot group a
   * join table by a column on the joined row (`tour.destinationId`). Bounded in
   * practice by the handful of curated categories, and this read is cached for
   * days on the public side.
   */
  private async loadCategoryTourDestinations(ids: string[]) {
    if (!ids.length) return [];

    return this.prisma.tourCategory.findMany({
      where: {
        categoryId: { in: ids },
        tour: {
          status: TourStatus.LIVE,
          isActive: true,
          destination: { isActive: true },
        },
      },
      select: { categoryId: true, tour: { select: { destinationId: true } } },
    });
  }

  // ── Admin ───────────────────────────────────────────────────────────────────

  /** Raw rows plus a resolved label, so the admin list is readable. */
  async list() {
    const rows = await this.prisma.featuredExperience.findMany({
      select: FEATURED_SELECT,
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });

    const categoryIds = rows
      .filter((r) => r.entityType === FeaturedEntityType.CATEGORY)
      .map((r) => r.entityId);
    const hubIds = rows
      .filter((r) => r.entityType === FeaturedEntityType.HUB)
      .map((r) => r.entityId);

    const [categories, hubs] = await Promise.all([
      categoryIds.length
        ? this.prisma.category.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, name: true },
          })
        : [],
      hubIds.length
        ? this.prisma.hub.findMany({
            where: { id: { in: hubIds } },
            select: { id: true, name: true },
          })
        : [],
    ]);

    const nameById = new Map(
      [...categories, ...hubs].map((e) => [e.id, e.name]),
    );

    return rows.map((row) => ({
      ...row,
      // Null flags a row whose target no longer exists - the admin list must show
      // that rather than hide it, since the public side drops it silently.
      entityName: nameById.get(row.entityId) ?? null,
    }));
  }

  async create(dto: CreateFeaturedExperienceDto, adminId: string) {
    await this.assertEntityExists(dto.entityType, dto.entityId);
    await this.assertDestinationValid(
      dto.entityType,
      dto.entityId,
      dto.destinationId,
    );

    await this.assertNotAlreadyFeatured(
      dto.entityType,
      dto.entityId,
      dto.destinationId ?? null,
    );

    const created = await this.prisma.featuredExperience.create({
      data: {
        entityType: dto.entityType,
        entityId: dto.entityId,
        destinationId: dto.destinationId ?? null,
        videoUrl: dto.videoUrl ?? null,
        displayOrder: dto.displayOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
      select: FEATURED_SELECT,
    });

    this.logger.log(
      `Admin ${adminId} featured ${dto.entityType} ${dto.entityId}`,
    );
    return created;
  }

  async update(id: string, dto: UpdateFeaturedExperienceDto, adminId: string) {
    const existing = await this.prisma.featuredExperience.findUnique({
      where: { id },
      select: FEATURED_SELECT,
    });
    if (!existing) throw new NotFoundException('Featured experience not found');

    const entityType = dto.entityType ?? existing.entityType;
    const entityId = dto.entityId ?? existing.entityId;
    if (dto.entityType !== undefined || dto.entityId !== undefined) {
      await this.assertEntityExists(entityType, entityId);
    }
    if (
      dto.entityType !== undefined ||
      dto.entityId !== undefined ||
      dto.destinationId !== undefined
    ) {
      await this.assertNotAlreadyFeatured(
        entityType,
        entityId,
        dto.destinationId !== undefined
          ? dto.destinationId
          : existing.destinationId,
        id,
      );
    }
    if (dto.destinationId !== undefined) {
      await this.assertDestinationValid(
        entityType,
        entityId,
        dto.destinationId,
      );
    }

    const updated = await this.prisma.featuredExperience.update({
      where: { id },
      data: {
        ...(dto.entityType !== undefined && { entityType: dto.entityType }),
        ...(dto.entityId !== undefined && { entityId: dto.entityId }),
        ...(dto.destinationId !== undefined && {
          destinationId: dto.destinationId,
        }),
        ...(dto.videoUrl !== undefined && { videoUrl: dto.videoUrl }),
        ...(dto.displayOrder !== undefined && {
          displayOrder: dto.displayOrder,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: FEATURED_SELECT,
    });

    this.logger.log(`Admin ${adminId} updated featured experience ${id}`);
    return updated;
  }

  async remove(id: string, adminId: string) {
    const existing = await this.prisma.featuredExperience.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Featured experience not found');

    await this.prisma.featuredExperience.delete({ where: { id } });

    this.logger.log(`Admin ${adminId} removed featured experience ${id}`);
    return { message: 'Featured experience removed' };
  }

  /**
   * `entityId` has no foreign key (it points at two different tables depending
   * on `entityType`), so the existence check that a FK would give us has to live
   * here - otherwise a typo becomes a row that silently never renders.
   */
  private async assertEntityExists(
    entityType: FeaturedEntityType,
    entityId: string,
  ) {
    const found =
      entityType === FeaturedEntityType.CATEGORY
        ? await this.prisma.category.findUnique({
            where: { id: entityId },
            select: { id: true },
          })
        : await this.prisma.hub.findUnique({
            where: { id: entityId },
            select: { id: true },
          });

    if (!found) {
      throw new BadRequestException(
        `No ${entityType.toLowerCase()} found with id "${entityId}"`,
      );
    }
  }

  /**
   * Refuse a second card for the same entity at the same scope.
   *
   * Enforced here rather than by a unique index because `destinationId` is
   * nullable and Postgres treats NULLs as distinct - so `@@unique([entityType,
   * entityId, destinationId])` would still happily allow two "show everywhere"
   * rows for the same category, which is exactly the case the demo data uses.
   * (A partial index would cover it, but this service already validates the
   * polymorphic entity and the hub-destination pairing at runtime for the same
   * "no FK can do this" reason, so the check belongs with them.)
   *
   * Without this, one double-submitted form renders the identical card twice in
   * the carousel - same title, image and href, different ids.
   */
  private async assertNotAlreadyFeatured(
    entityType: FeaturedEntityType,
    entityId: string,
    destinationId: string | null,
    excludeId?: string,
  ) {
    const duplicate = await this.prisma.featuredExperience.findFirst({
      where: {
        entityType,
        entityId,
        destinationId,
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException(
        destinationId
          ? 'This is already featured for that destination'
          : 'This is already featured everywhere',
      );
    }
  }

  /** A hub lives on exactly one island - pinning it to another is meaningless. */
  private async assertDestinationValid(
    entityType: FeaturedEntityType,
    entityId: string,
    destinationId?: string | null,
  ) {
    if (!destinationId) return;

    const destination = await this.prisma.destination.findUnique({
      where: { id: destinationId },
      select: { id: true },
    });
    if (!destination) {
      throw new BadRequestException(
        `No destination found with id "${destinationId}"`,
      );
    }

    if (entityType === FeaturedEntityType.HUB) {
      const hub = await this.prisma.hub.findUnique({
        where: { id: entityId },
        select: { destinationId: true },
      });
      if (hub && hub.destinationId !== destinationId) {
        throw new BadRequestException(
          'A hub can only be featured on its own destination',
        );
      }
    }
  }
}

const CATEGORY_SELECT = {
  id: true,
  name: true,
  slug: true,
  heroImage: true,
  ogImage: true,
  isActive: true,
} satisfies Prisma.CategorySelect;

const HUB_SELECT = {
  id: true,
  name: true,
  slug: true,
  heroImage: true,
  ogImage: true,
  isActive: true,
  status: true,
  destinationId: true,
  destination: { select: { slug: true, isActive: true } },
} satisfies Prisma.HubSelect;

const FEATURED_SELECT = {
  id: true,
  entityType: true,
  entityId: true,
  destinationId: true,
  videoUrl: true,
  displayOrder: true,
  isActive: true,
} satisfies Prisma.FeaturedExperienceSelect;

/**
 * The card photo. Prefers the entity's hero image and falls back to its OG image,
 * which is a different crop (1200x630 social card vs a 250x440 portrait slot) but
 * beats an empty grey box - and is frequently the only image an entity has, since
 * `ogImage` is populated far more consistently than `heroImage`. Null when neither
 * exists; the frontend then falls back to its bundled card art.
 */
function cardImage(heroImage: string | null, ogImage: string | null) {
  return heroImage || ogImage || null;
}

/** Most live tours wins; ties break on destination id so the pick is stable. */
function pickStrongestDestination(
  counts: Map<string, number>,
): string | undefined {
  let best: string | undefined;
  let bestCount = 0;
  for (const [destinationId, count] of [...counts.entries()].sort((a, z) =>
    a[0].localeCompare(z[0]),
  )) {
    if (count > bestCount) {
      best = destinationId;
      bestCount = count;
    }
  }
  return best;
}

// Row shapes are DERIVED from the selects above rather than hand-written, so a
// changed select is a compile error instead of silent drift. (The `translations`
// filter and `_count` are locale/where-dependent, so they are declared alongside
// rather than inside the shared select consts.)
type CategoryRow = Prisma.CategoryGetPayload<{
  select: typeof CATEGORY_SELECT;
}> & {
  translations: { name: string | null }[];
  destinationsById: Map<string, { id: string; slug: string }>;
};

type HubRow = Prisma.HubGetPayload<{ select: typeof HUB_SELECT }> & {
  translations: { name: string | null }[];
  _count: { tourHubs: number };
};
