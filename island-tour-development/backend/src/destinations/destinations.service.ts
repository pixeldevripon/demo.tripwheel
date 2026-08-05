import { CATEGORY_PAGE_MIN_TOURS } from '@/common/constants/category-visibility';
import { FAQ_PAGE_TYPE } from '@/common/constants/faq-page-type';
import { Locale } from '@/common/constants/locales';
import {
  applyTranslation,
  faqSelect,
  mergeTranslation,
  resolveFaqLocale,
  resolveGroupedLocale,
  translationSelect,
} from '@/common/utils/translation.util';
import { generateSlug, RESERVED_GLOBAL_SLUGS } from '@/common/utils/slug.util';
import { DEFAULT_DESTINATION_TIMEZONES } from '@/common/validators/is-iana-timezone.validator';
import {
  clearCooledDownDestinationSlugs,
  markDestinationSlugsDeleted,
} from '@/common/utils/slug-registry.util';
import { FaqGroupService } from '@/common/faq/faq-group.service';
import { ContentTranslationEnqueuer } from '@/content-translation/content-translation.enqueuer';
import { TranslationClearMarkService } from '@/content-translation/translation-clear-mark.service';
import { translationUnitKeys } from '@/content-translation/translation-unit-keys';
import {
  CreateFaqGroupDto,
  UpdateFaqGroupDto,
  UpsertFaqTranslationDto,
} from '@/common/faq/dto/faq-group.dto';
import {
  PageContentSectionService,
  pageContentSectionSelect,
} from '@/common/page-content-sections/page-content-section.service';
import {
  CreatePageContentSectionDto,
  UpdatePageContentSectionDto,
  UpsertPageContentSectionTranslationDto,
} from '@/common/page-content-sections/dto/page-content-section.dto';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CollectionStatus,
  HubStatus,
  Prisma,
  SlugEntityType,
  TourStatus,
} from '@prisma/client';
import {
  CreateDestinationDto,
  CreateDestinationFaqDto,
  DestinationQueryDto,
  FaqLocaleQueryDto,
  UpdateDestinationDto,
  UpdateDestinationFaqDto,
  UpsertDestinationPageContentDto,
  UpsertDestinationTranslationsDto,
} from './dto/destination.dto';
import type { PopularLinkInputDto } from './dto/destination.dto';

/**
 * Ceiling on the curated hero row.
 *
 * mck-02 draws four, and four is still the shape to aim for - the row is one
 * line of text under the search box, and every extra link buys less attention
 * for the ones already there. This is a guard rail, not a target: it exists so
 * a runaway save cannot put forty links in the hero, and it sits high enough
 * that an island with several strong hubs is not forced to drop one.
 *
 * The row is inline text and wraps, so going past four costs layout nothing -
 * it costs focus.
 *
 * Enforced on write, and again on read so a row saved under an older, higher
 * cap cannot overflow this one.
 */
export const POPULAR_LINK_MAX = 8;

@Injectable()
export class DestinationService {
  private readonly logger = new Logger(DestinationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly faqGroups: FaqGroupService,
    private readonly contentSections: PageContentSectionService,
    private readonly contentTranslation: ContentTranslationEnqueuer,
    private readonly clearMarks: TranslationClearMarkService,
  ) {}

  private readonly destinationSelect = {
    id: true,
    name: true,
    slug: true,
    heroImage: true,
    region: true,
    country: true,
    latitude: true,
    longitude: true,
    timezone: true,
    currency: true,
    language: true,
    galleryImages: true,
    ogImage: true,
    parentDestinationId: true,
    isSeeded: true,
    isActive: true,
    displayOrder: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  // Curated platform order everywhere islands are listed: ranked rows first
  // (1 = launch island), unranked after them alphabetically. The homepage
  // Popular row renders this order verbatim - it must lead with the launch
  // island, never alphabetical (client-locked copy).
  private readonly destinationOrderBy = [
    { displayOrder: { sort: 'asc', nulls: 'last' } },
    { name: 'asc' },
  ] as const satisfies Prisma.DestinationOrderByWithRelationInput[];

  // ── Internal helpers ──────────────────────────────────────────────────────────

  private async findDestinationOrThrow(id: string) {
    const destination = await this.prisma.destination.findUnique({
      where: { id },
      select: this.destinationSelect,
    });
    if (!destination)
      throw new NotFoundException(`Destination ${id} not found`);
    return destination;
  }

  // ── Public CRUD ───────────────────────────────────────────────────────────────

  async getAll(query: DestinationQueryDto) {
    const { isActive, page = 1, limit = 20, locale = Locale.en } = query;
    const skip = (page - 1) * limit;

    const where = { ...(isActive !== undefined && { isActive }) };

    const [total, data] = await Promise.all([
      this.prisma.destination.count({ where }),
      this.prisma.destination.findMany({
        where,
        select: {
          ...this.destinationSelect,
          translations: {
            where: { locale },
            select: { name: true, isMachineTranslated: true },
          },
        },
        orderBy: this.destinationOrderBy,
        skip,
        take: limit,
      }),
    ]);

    const localizedData = data.map(({ translations, ...dest }) =>
      applyTranslation(dest, translations[0], locale),
    );

    return { total, page, limit, data: localizedData };
  }

  async getActive(locale: Locale = Locale.en) {
    const data = await this.prisma.destination.findMany({
      where: { isActive: true },
      select: {
        ...this.destinationSelect,
        // Live (published) tours only — drives the homepage "Explore islands" count.
        _count: { select: { tours: { where: { status: TourStatus.LIVE } } } },
        translations: {
          where: { locale },
          select: { name: true, isMachineTranslated: true },
        },
      },
      orderBy: this.destinationOrderBy,
    });

    return data.map(({ translations, _count, ...dest }) => ({
      ...applyTranslation(dest, translations[0], locale),
      tourCount: _count.tours,
    }));
  }

  async getById(id: string, locale: Locale = Locale.en) {
    const destination = await this.prisma.destination.findUnique({
      where: { id },
      select: {
        ...this.destinationSelect,
        // Both locales: the merge below needs English to fall back to.
        translations: {
          where: { locale: { in: [locale, Locale.en] } },
          select: { locale: true, ...translationSelect },
        },
      },
    });
    if (!destination)
      throw new NotFoundException(`Destination ${id} not found`);

    const { translations, ...dest } = destination;
    const t = mergeTranslation(translations, locale);

    return {
      ...applyTranslation(dest, t, locale),
      overview: t?.overview ?? null,
      h1Override: t?.h1Override ?? null,
      breadcrumbLabel: t?.breadcrumbLabel ?? null,
    };
  }

  async getBySlug(slug: string, locale: Locale = Locale.en) {
    const destination = await this.prisma.destination.findUnique({
      where: { slug },
      select: {
        ...this.destinationSelect,
        translations: {
          where: { locale: { in: [locale, Locale.en] } },
          select: { locale: true, ...translationSelect },
        },
      },
    });
    if (!destination)
      throw new NotFoundException(`Destination with slug "${slug}" not found`);

    const { translations, ...dest } = destination;
    const t = mergeTranslation(translations, locale);

    return {
      ...applyTranslation(dest, t, locale),
      overview: t?.overview ?? null,
      h1Override: t?.h1Override ?? null,
      breadcrumbLabel: t?.breadcrumbLabel ?? null,
    };
  }

  async create(dto: CreateDestinationDto, adminId: string) {
    const slug = dto.slug ? generateSlug(dto.slug) : generateSlug(dto.name);

    // Global static pages (legal pages, search, ...) live at the same path
    // level as destinations; a destination with one of those slugs would be
    // unreachable behind the static route.
    if (RESERVED_GLOBAL_SLUGS.has(slug)) {
      throw new ConflictException(
        `Destination slug "${slug}" is reserved for a platform page`,
      );
    }

    // Pages (the WordPress-like legal/marketing pages) resolve at the same
    // path level too, but AFTER destinations in the frontend's fall-through -
    // so a destination taking a page's slug (or the first segment of a NESTED
    // page path like "legal/terms") would silently shadow those pages. The
    // mirror check (pages.service.assertSlugAvailable) protects the other
    // direction.
    const shadowedPage = await this.prisma.page.findFirst({
      where: { OR: [{ slug }, { slug: { startsWith: `${slug}/` } }] },
      select: { slug: true },
    });
    if (shadowedPage) {
      throw new ConflictException(
        `Destination slug "${slug}" would shadow the page "/${shadowedPage.slug}"`,
      );
    }

    // Timezone is required platform data (all tour/departure math anchors to it).
    // Prefer the admin's IANA value; otherwise derive a known launch zone from the
    // slug; never default silently to Curaçao for a non-Curaçao island.
    const timezone = dto.timezone ?? DEFAULT_DESTINATION_TIMEZONES[slug];
    if (!timezone) {
      throw new BadRequestException(
        `Timezone is required for destination "${slug}". Provide a valid IANA timezone (e.g. "America/Aruba").`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const destination = await tx.destination
        .create({
          data: {
            name: dto.name,
            slug,
            heroImage: dto.heroImage,
            region: dto.region,
            country: dto.country ?? null,
            latitude: dto.latitude ?? null,
            longitude: dto.longitude ?? null,
            timezone,
            currency: dto.currency ?? null,
            language: dto.language ?? null,
            galleryImages: dto.galleryImages ?? [],
            ogImage: dto.ogImage ?? null,
            parentDestinationId: dto.parentDestinationId ?? null,
            displayOrder: dto.displayOrder ?? null,
            createdBy: adminId,
          },
          select: this.destinationSelect,
        })
        .catch((err: any) => {
          if (err?.code === 'P2002') {
            throw new ConflictException(
              `Destination slug "${slug}" already exists`,
            );
          }
          throw err;
        });

      // Clear any cooled-down ghosts if this destination slug was force-deleted < 90 days ago.
      await clearCooledDownDestinationSlugs(tx, destination.slug);

      await tx.slugRegistry.create({
        data: {
          destinationSlug: destination.slug,
          slug: 'tours',
          entityType: SlugEntityType.RESERVED,
          entityId: null,
        },
      });

      const categories = await tx.category.findMany({
        where: { isActive: true },
        select: { id: true, slug: true },
      });

      if (categories.length > 0) {
        await tx.slugRegistry.createMany({
          data: categories.map((cat) => ({
            destinationSlug: destination.slug,
            slug: cat.slug,
            entityType: SlugEntityType.CATEGORY,
            entityId: cat.id,
          })),
        });
      }

      this.logger.log(
        `Admin ${adminId} created destination "${dto.name}" (${destination.id}), ` +
          `seeded ${categories.length} category slug(s) + 1 reserved`,
      );

      return destination;
    });
  }

  async update(id: string, dto: UpdateDestinationDto, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.destination
        .update({
          where: { id },
          data: {
            ...(dto.name !== undefined && { name: dto.name }),
            ...(dto.heroImage !== undefined && { heroImage: dto.heroImage }),
            ...(dto.region !== undefined && { region: dto.region }),
            ...(dto.country !== undefined && { country: dto.country }),
            ...(dto.latitude !== undefined && { latitude: dto.latitude }),
            ...(dto.longitude !== undefined && { longitude: dto.longitude }),
            ...(dto.timezone !== undefined && { timezone: dto.timezone }),
            ...(dto.currency !== undefined && { currency: dto.currency }),
            ...(dto.language !== undefined && { language: dto.language }),
            ...(dto.galleryImages !== undefined && {
              galleryImages: dto.galleryImages,
            }),
            ...(dto.ogImage !== undefined && { ogImage: dto.ogImage }),
            ...(dto.displayOrder !== undefined && {
              displayOrder: dto.displayOrder,
            }),
            ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          },
          select: this.destinationSelect,
        })
        .catch((err: any) => {
          if (err?.code === 'P2025')
            throw new NotFoundException(`Destination ${id} not found`);
          throw err;
        });

      if (dto.isActive !== undefined) {
        await tx.slugRegistry.updateMany({
          where: { destinationSlug: updated.slug },
          data: { isActive: dto.isActive },
        });
      }

      this.logger.log(`Admin ${adminId} updated destination ${id}`);
      return updated;
    });
  }

  async remove(id: string, adminId: string) {
    await this.prisma.$transaction(async (tx) => {
      const destination = await tx.destination.findUnique({
        where: { id },
        select: this.destinationSelect,
      });
      if (!destination)
        throw new NotFoundException(`Destination ${id} not found`);

      if (destination.isSeeded) {
        throw new ForbiddenException(
          'Seeded destinations cannot be deactivated',
        );
      }

      const tourCount = await tx.tour.count({
        where: {
          destinationId: id,
          isActive: true,
          status: { not: TourStatus.DRAFT },
        },
      });
      if (tourCount > 0) {
        throw new ConflictException(
          `Cannot deactivate destination: ${tourCount} active tour(s) are still assigned to it`,
        );
      }

      await tx.destination.update({ where: { id }, data: { isActive: false } });

      await tx.slugRegistry.updateMany({
        where: { destinationSlug: destination.slug },
        data: { isActive: false },
      });
    });

    this.logger.log(`Admin ${adminId} deactivated destination ${id}`);
    return { message: 'Destination deactivated successfully' };
  }

  async forceDelete(id: string, adminId: string) {
    const destination = await this.prisma.destination.findUnique({
      where: { id },
      select: { id: true, slug: true, isSeeded: true },
    });
    if (!destination)
      throw new NotFoundException(`Destination ${id} not found`);

    if (destination.isSeeded) {
      throw new ForbiddenException(
        'Seeded destinations cannot be permanently deleted',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Master slug-registry rule: hard delete starts the 90-day reuse cooldown across the
      // whole destination namespace (categories, hubs, tours, reserved) - rows are kept,
      // marked isActive=false + deletedAt=now, and cleared on re-seed after the cooldown.
      await markDestinationSlugsDeleted(tx, destination.slug);
      // Cascade via Prisma schema handles: hubs, translations, FAQs, page content, featured experiences
      await tx.destination.delete({ where: { id } });
    });

    this.logger.log(`Admin ${adminId} permanently deleted destination ${id}`);
    return { message: 'Destination permanently deleted' };
  }

  // ── Hero "Popular" links (admin-curated) ─────────────────────────────────────

  /**
   * Targets a popular link may point at, with everything the resolver needs to
   * decide whether that page would actually open.
   */
  private readonly popularTargetSelect = {
    id: true,
    displayOrder: true,
    categoryId: true,
    hubId: true,
    collectionId: true,
    category: {
      select: {
        id: true,
        slug: true,
        name: true,
        isActive: true,
        parentCategoryId: true,
      },
    },
    hub: {
      select: {
        id: true,
        slug: true,
        name: true,
        isActive: true,
        status: true,
        destinationId: true,
      },
    },
    collection: {
      select: {
        id: true,
        slug: true,
        name: true,
        isActive: true,
        status: true,
        destinationId: true,
      },
    },
  } as const;

  /**
   * The island hero's curated "Popular" quick links, resolved and localized.
   *
   * Curation decides WHICH pages are offered; it never asserts one exists. Every
   * link is re-checked here against its target's own visibility rule and dropped
   * if that page would not open - the founder's standing condition, "these must
   * show when these collections and categories have data to render page". The
   * three rules are deliberately the same objects the pages themselves use:
   *
   *  - Category   : active, top-level, and ≥ {@link CATEGORY_PAGE_MIN_TOURS} LIVE
   *                 tours HERE (`categories.service.getBySlugForDestination`).
   *  - Hub        : active, PUBLISHED, on THIS island, ≥1 LIVE tour (`hubs.service`).
   *  - Collection : active, PUBLISHED, on THIS island (`collections.service.getBySlug`).
   *
   * Returns `[]` when nothing is curated, which the frontend reads as "compose
   * the automatic row instead" - an island nobody has curated still gets links.
   */
  async getPopularLinks(destinationSlug: string, locale: Locale = Locale.en) {
    const destination = await this.prisma.destination.findUnique({
      where: { slug: destinationSlug },
      select: { id: true, isActive: true },
    });
    if (!destination || !destination.isActive) {
      throw new NotFoundException(`Destination "${destinationSlug}" not found`);
    }

    const links = await this.prisma.destinationPopularLink.findMany({
      where: { destinationId: destination.id },
      select: this.popularTargetSelect,
      orderBy: { displayOrder: 'asc' },
    });
    if (links.length === 0) return [];

    const categoryIds = links
      .map((l) => l.categoryId)
      .filter((id): id is string => !!id);
    const hubIds = links.map((l) => l.hubId).filter((id): id is string => !!id);

    // Tour counts for the two tour-gated target types, plus the localized names.
    // One query each rather than one per link, and only for the ids in play.
    const [categoryCounts, hubCounts, names] = await Promise.all([
      categoryIds.length
        ? this.prisma.tourCategory.groupBy({
            by: ['categoryId'],
            where: {
              categoryId: { in: categoryIds },
              tour: {
                destinationId: destination.id,
                status: TourStatus.LIVE,
                isActive: true,
              },
            },
            _count: { _all: true },
          })
        : [],
      hubIds.length
        ? this.prisma.tourHub.groupBy({
            by: ['hubId'],
            where: {
              hubId: { in: hubIds },
              tour: {
                destinationId: destination.id,
                status: TourStatus.LIVE,
                isActive: true,
              },
            },
            _count: { _all: true },
          })
        : [],
      this.popularLinkNames(links, locale),
    ]);

    const categoryTours = new Map(
      categoryCounts.map((g) => [g.categoryId, g._count._all]),
    );
    const hubTours = new Map(hubCounts.map((g) => [g.hubId, g._count._all]));

    const resolved: { name: string; slug: string }[] = [];
    const seen = new Set<string>();

    for (const link of links) {
      const target = this.renderablePopularTarget(link, destination.id, {
        categoryTours,
        hubTours,
      });
      // Two slots may name the same page (nothing in the schema forbids it);
      // the row must not print it twice.
      if (!target || seen.has(target.slug)) continue;
      seen.add(target.slug);
      resolved.push({
        name: names.get(target.id) ?? target.name,
        slug: target.slug,
      });
      if (resolved.length === POPULAR_LINK_MAX) break;
    }

    return resolved;
  }

  /**
   * The link's target if - and only if - its page would open on this island.
   * Null means "drop this slot", never "render it dead".
   */
  private renderablePopularTarget(
    link: {
      category: {
        id: string;
        slug: string;
        name: string;
        isActive: boolean;
        parentCategoryId: string | null;
      } | null;
      hub: {
        id: string;
        slug: string;
        name: string;
        isActive: boolean;
        status: HubStatus;
        destinationId: string;
      } | null;
      collection: {
        id: string;
        slug: string;
        name: string;
        isActive: boolean;
        status: CollectionStatus;
        destinationId: string;
      } | null;
    },
    destinationId: string,
    counts: {
      categoryTours: Map<string, number>;
      hubTours: Map<string, number>;
    },
  ): { id: string; slug: string; name: string } | null {
    const { category, hub, collection } = link;

    if (category) {
      const live = counts.categoryTours.get(category.id) ?? 0;
      return category.isActive &&
        category.parentCategoryId === null &&
        live >= CATEGORY_PAGE_MIN_TOURS
        ? category
        : null;
    }
    if (hub) {
      const live = counts.hubTours.get(hub.id) ?? 0;
      return hub.isActive &&
        hub.status === HubStatus.PUBLISHED &&
        hub.destinationId === destinationId &&
        live > 0
        ? hub
        : null;
    }
    if (collection) {
      return collection.isActive &&
        collection.status === CollectionStatus.PUBLISHED &&
        collection.destinationId === destinationId
        ? collection
        : null;
    }
    return null;
  }

  /**
   * Localized names for the curated targets, keyed by entity id. One query per
   * entity type, and only when that type is actually used. A missing row falls
   * back to the base name at the call site - the label must always be the target
   * page's OWN name, never an admin-typed string.
   */
  private async popularLinkNames(
    links: {
      categoryId: string | null;
      hubId: string | null;
      collectionId: string | null;
    }[],
    locale: Locale,
  ): Promise<Map<string, string>> {
    const byId = new Map<string, string>();
    if (locale === Locale.en) return byId;

    const categoryIds = links
      .map((l) => l.categoryId)
      .filter((id): id is string => !!id);
    const hubIds = links.map((l) => l.hubId).filter((id): id is string => !!id);
    const collectionIds = links
      .map((l) => l.collectionId)
      .filter((id): id is string => !!id);

    const [categories, hubs, collections] = await Promise.all([
      categoryIds.length
        ? this.prisma.categoryTranslation.findMany({
            where: { categoryId: { in: categoryIds }, locale },
            select: { categoryId: true, name: true },
          })
        : [],
      hubIds.length
        ? this.prisma.hubTranslation.findMany({
            where: { hubId: { in: hubIds }, locale },
            select: { hubId: true, name: true },
          })
        : [],
      collectionIds.length
        ? this.prisma.collectionTranslation.findMany({
            where: { collectionId: { in: collectionIds }, locale },
            select: { collectionId: true, name: true },
          })
        : [],
    ]);

    for (const t of categories) if (t.name) byId.set(t.categoryId, t.name);
    for (const t of hubs) if (t.name) byId.set(t.hubId, t.name);
    for (const t of collections) if (t.name) byId.set(t.collectionId, t.name);
    return byId;
  }

  /** Admin read: the raw curation, unresolved and ungated, in slot order. */
  async getPopularLinksAdmin(id: string) {
    await this.findDestinationOrThrow(id);
    return this.prisma.destinationPopularLink.findMany({
      where: { destinationId: id },
      select: this.popularTargetSelect,
      orderBy: { displayOrder: 'asc' },
    });
  }

  /**
   * Admin replace-all. One save for the whole row (the one-save-button rule):
   * partial slot writes would let two concurrent edits interleave into an order
   * neither admin chose.
   *
   * `displayOrder` is assigned from array position rather than trusted from the
   * client, so the unique (destinationId, displayOrder) index can never be hit
   * by a client that numbers its slots badly.
   */
  async replacePopularLinks(
    id: string,
    links: PopularLinkInputDto[],
    adminId: string,
  ) {
    await this.findDestinationOrThrow(id);

    if (links.length > POPULAR_LINK_MAX) {
      throw new BadRequestException(
        `A destination can have at most ${POPULAR_LINK_MAX} popular links`,
      );
    }

    // Exactly one target per slot: none is an empty link, several is ambiguous.
    links.forEach((link, i) => {
      const targets = [link.categoryId, link.hubId, link.collectionId].filter(
        Boolean,
      );
      if (targets.length !== 1) {
        throw new BadRequestException(
          `Popular link ${i + 1} must name exactly one of categoryId, hubId or collectionId`,
        );
      }
    });

    await this.assertPopularTargetsExist(id, links);

    await this.prisma.$transaction(async (tx) => {
      await tx.destinationPopularLink.deleteMany({
        where: { destinationId: id },
      });
      if (links.length > 0) {
        await tx.destinationPopularLink.createMany({
          data: links.map((link, index) => ({
            destinationId: id,
            categoryId: link.categoryId ?? null,
            hubId: link.hubId ?? null,
            collectionId: link.collectionId ?? null,
            displayOrder: index,
          })),
        });
      }
    });

    this.logger.log(
      `Admin ${adminId} set ${links.length} popular link(s) on destination ${id}`,
    );
    return this.getPopularLinksAdmin(id);
  }

  /**
   * Every named target must exist, and hubs/collections must belong to THIS
   * island - a hub from another island would be saved happily and then silently
   * dropped at render, which reads as "the save did not work". Categories are
   * global, so only existence is checked; whether the category clears the tour
   * bar HERE is a render-time question that changes as tours come and go.
   */
  private async assertPopularTargetsExist(
    destinationId: string,
    links: PopularLinkInputDto[],
  ) {
    const categoryIds = links
      .map((l) => l.categoryId)
      .filter((v): v is string => !!v);
    const hubIds = links.map((l) => l.hubId).filter((v): v is string => !!v);
    const collectionIds = links
      .map((l) => l.collectionId)
      .filter((v): v is string => !!v);

    const [categories, hubs, collections] = await Promise.all([
      categoryIds.length
        ? this.prisma.category.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true },
          })
        : [],
      hubIds.length
        ? this.prisma.hub.findMany({
            where: { id: { in: hubIds }, destinationId },
            select: { id: true },
          })
        : [],
      collectionIds.length
        ? this.prisma.collection.findMany({
            where: { id: { in: collectionIds }, destinationId },
            select: { id: true },
          })
        : [],
    ]);

    const found = new Set([
      ...categories.map((c) => c.id),
      ...hubs.map((h) => h.id),
      ...collections.map((c) => c.id),
    ]);
    const missing = [...categoryIds, ...hubIds, ...collectionIds].filter(
      (targetId) => !found.has(targetId),
    );
    if (missing.length > 0) {
      throw new BadRequestException(
        `Unknown or off-island popular link target(s): ${missing.join(', ')}`,
      );
    }
  }

  // ── Translations ──────────────────────────────────────────────────────────────

  async getAllTranslations(id: string) {
    await this.findDestinationOrThrow(id);

    return this.prisma.destinationTranslation.findMany({
      where: { destinationId: id },
      select: { locale: true, ...translationSelect },
      orderBy: { locale: 'asc' },
    });
  }

  async getTranslationsByLocale(id: string, locale: Locale) {
    await this.findDestinationOrThrow(id);

    const translation = await this.prisma.destinationTranslation.findUnique({
      where: { destinationId_locale: { destinationId: id, locale } },
      select: { locale: true, ...translationSelect },
    });

    return (
      translation ?? {
        locale,
        name: null,
        overview: null,
        h1Override: null,
        breadcrumbLabel: null,
        isMachineTranslated: false,
      }
    );
  }

  async upsertTranslations(
    id: string,
    locale: Locale,
    dto: UpsertDestinationTranslationsDto,
    adminId: string,
  ) {
    await this.findDestinationOrThrow(id);

    const { fields, isMachineTranslated } = dto;

    const result = await this.prisma.destinationTranslation.upsert({
      where: { destinationId_locale: { destinationId: id, locale } },
      create: {
        destinationId: id,
        locale,
        isMachineTranslated: isMachineTranslated ?? false,
        name: fields.name,
        overview: fields.overview,
        h1Override: fields.h1Override,
        breadcrumbLabel: fields.breadcrumbLabel,
      },
      update: {
        isMachineTranslated: isMachineTranslated ?? false,
        // Human write path: reset the AI bookkeeping so the machine refresher
        // never overwrites what was typed here.
        sourceHash: null,
        ...(fields.name !== undefined && { name: fields.name }),
        ...(fields.overview !== undefined && { overview: fields.overview }),
        ...(fields.h1Override !== undefined && {
          h1Override: fields.h1Override,
        }),
        ...(fields.breadcrumbLabel !== undefined && {
          breadcrumbLabel: fields.breadcrumbLabel,
        }),
      },
      select: { locale: true, ...translationSelect },
    });

    this.logger.log(
      `Admin ${adminId} upserted translation for destination ${id} [${locale}]`,
    );
    // An English edit re-sources the other locales.
    if (locale === Locale.en) {
      this.contentTranslation.enqueue('destination', id);
    }
    return result;
  }

  async deleteTranslations(id: string, locale: Locale, adminId: string) {
    if (locale === Locale.en) {
      throw new BadRequestException(
        'The English translation cannot be deleted. Update the destination name field instead.',
      );
    }

    await this.findDestinationOrThrow(id);

    await this.prisma.destinationTranslation
      .delete({
        where: { destinationId_locale: { destinationId: id, locale } },
      })
      .catch((err: any) => {
        if (err?.code === 'P2025') {
          throw new NotFoundException(
            `No translation found for locale "${locale}"`,
          );
        }
        throw err;
      });

    // A whole-locale delete is the broadest possible clear - mark it so the
    // AI treats the absent row as deliberate, not as untranslated.
    await this.clearMarks.mark(
      'destination',
      id,
      translationUnitKeys.main(),
      locale,
      adminId,
    );

    this.logger.log(
      `Admin ${adminId} deleted translation for destination ${id} [${locale}]`,
    );
    return { message: `Translation for locale "${locale}" deleted` };
  }

  // ── Page Content ──────────────────────────────────────────────────────────────

  /**
   * `fallback` is the public read: fill blanks from English so a page never
   * renders an empty About band. The dashboard editor leaves it off and gets
   * the locale exactly as stored - anything else would have an admin edit
   * English text inside a Dutch box and save it as Dutch.
   */
  async getPageContent(id: string, locale: Locale, fallback = false) {
    await this.findDestinationOrThrow(id);

    // The authored sections render inside the same About band as `aboutText`, so
    // they ride along on this one read rather than adding a second public
    // endpoint (and a second cache tag) for the same strip of the page.
    const [rows, sections] = await Promise.all([
      this.prisma.destinationPageContent.findMany({
        where: {
          destinationId: id,
          locale: fallback ? { in: [locale, Locale.en] } : locale,
        },
        select: {
          locale: true,
          aboutText: true,
          metaTitle: true,
          metaDescription: true,
        },
      }),
      this.getPublicContentSections(id, locale),
    ]);

    const row = fallback
      ? mergeTranslation(rows, locale)
      : rows.find((r) => r.locale === locale);

    return {
      ...(row ?? {
        locale,
        aboutText: null,
        metaTitle: null,
        metaDescription: null,
      }),
      sections,
    };
  }

  /**
   * Active authored sections for the public page, collapsed to one row per
   * section with per-section English fallback. Reading `locale` alone would blank
   * the whole band on any island not yet translated - in six of seven locales.
   */
  private async getPublicContentSections(id: string, locale: Locale) {
    const rows = await this.prisma.pageContentSection.findMany({
      where: {
        pageType: FAQ_PAGE_TYPE.DESTINATION,
        entityId: id,
        isActive: true,
        locale: { in: [locale, Locale.en] },
      },
      select: pageContentSectionSelect,
      orderBy: [{ displayOrder: 'asc' }],
    });

    return resolveGroupedLocale(rows, locale, (r) => r.sectionGroupId).map(
      ({ sectionKey, heading, body }) => ({ sectionKey, heading, body }),
    );
  }

  async upsertPageContent(
    id: string,
    locale: Locale,
    dto: UpsertDestinationPageContentDto,
    adminId: string,
  ) {
    await this.findDestinationOrThrow(id);

    const result = await this.prisma.destinationPageContent.upsert({
      where: { destinationId_locale: { destinationId: id, locale } },
      create: {
        destinationId: id,
        locale,
        aboutText: dto.aboutText,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
      },
      update: {
        // Human write path - reset the AI bookkeeping (see upsertTranslations).
        isMachineTranslated: false,
        sourceHash: null,
        ...(dto.aboutText !== undefined && { aboutText: dto.aboutText }),
        ...(dto.metaTitle !== undefined && { metaTitle: dto.metaTitle }),
        ...(dto.metaDescription !== undefined && {
          metaDescription: dto.metaDescription,
        }),
      },
      select: {
        locale: true,
        aboutText: true,
        metaTitle: true,
        metaDescription: true,
      },
    });

    this.logger.log(
      `Admin ${adminId} upserted page content for destination ${id} [${locale}]`,
    );
    if (locale === Locale.en) {
      this.contentTranslation.enqueue('destination', id);
    }
    return result;
  }

  // ── FAQ ───────────────────────────────────────────────────────────────────────

  /**
   * Public FAQ read. With a locale it fetches that locale AND English and
   * resolves per group and per field: an untranslated FAQ shows in English
   * rather than vanishing, and a field cleared in the Translation Console
   * falls back on its own (English question next to a translated answer).
   * Without a locale it returns every row - the admin listing.
   */
  async getFaqs(id: string, query: FaqLocaleQueryDto) {
    await this.findDestinationOrThrow(id);

    const rows = await this.prisma.faq.findMany({
      where: {
        pageType: FAQ_PAGE_TYPE.DESTINATION,
        entityId: id,
        isActive: true,
        ...(query.locale && { locale: { in: [query.locale, Locale.en] } }),
      },
      select: faqSelect,
      orderBy: [{ locale: 'asc' }, { displayOrder: 'asc' }],
    });

    return query.locale ? resolveFaqLocale(rows, query.locale) : rows;
  }

  async createFaq(id: string, dto: CreateDestinationFaqDto, adminId: string) {
    await this.findDestinationOrThrow(id);

    const faq = await this.prisma.faq.create({
      data: {
        pageType: FAQ_PAGE_TYPE.DESTINATION,
        entityId: id,
        locale: dto.locale,
        question: dto.question,
        answer: dto.answer,
        displayOrder: dto.displayOrder ?? 0,
      },
      select: faqSelect,
    });

    this.logger.log(
      `Admin ${adminId} created FAQ for destination ${id} [${dto.locale}]`,
    );
    return faq;
  }

  async updateFaq(
    id: string,
    faqId: string,
    dto: UpdateDestinationFaqDto,
    adminId: string,
  ) {
    const faq = await this.prisma.faq.findFirst({
      where: { id: faqId, pageType: FAQ_PAGE_TYPE.DESTINATION, entityId: id },
    });
    if (!faq)
      throw new NotFoundException(
        `FAQ ${faqId} not found for destination ${id}`,
      );

    const updated = await this.prisma.faq.update({
      where: { id: faqId },
      data: {
        ...(dto.question !== undefined && { question: dto.question }),
        ...(dto.answer !== undefined && { answer: dto.answer }),
        ...(dto.displayOrder !== undefined && {
          displayOrder: dto.displayOrder,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: faqSelect,
    });

    this.logger.log(
      `Admin ${adminId} updated FAQ ${faqId} for destination ${id}`,
    );
    return updated;
  }

  async deleteFaq(id: string, faqId: string, adminId: string) {
    const faq = await this.prisma.faq.findFirst({
      where: { id: faqId, pageType: FAQ_PAGE_TYPE.DESTINATION, entityId: id },
    });
    if (!faq)
      throw new NotFoundException(
        `FAQ ${faqId} not found for destination ${id}`,
      );

    await this.prisma.faq.delete({ where: { id: faqId } });

    this.logger.log(
      `Admin ${adminId} deleted FAQ ${faqId} for destination ${id}`,
    );
    return { message: 'FAQ deleted successfully' };
  }

  // ── Grouped FAQ (add in English, then translate) ────────────────────────────
  // Thin wrappers over the shared FaqGroupService; each verifies the destination
  // exists first so 404s are accurate, then delegates the grouped-FAQ logic.

  async getFaqGroups(id: string) {
    await this.findDestinationOrThrow(id);
    return this.faqGroups.getGroups(FAQ_PAGE_TYPE.DESTINATION, id);
  }

  async createFaqGroup(id: string, dto: CreateFaqGroupDto, adminId: string) {
    await this.findDestinationOrThrow(id);
    this.logger.log(`Admin ${adminId} created FAQ for destination ${id}`);
    return this.faqGroups.createGroup(FAQ_PAGE_TYPE.DESTINATION, id, dto);
  }

  async upsertFaqTranslation(
    id: string,
    groupId: string,
    locale: Locale,
    dto: UpsertFaqTranslationDto,
    adminId: string,
  ) {
    await this.findDestinationOrThrow(id);
    this.logger.log(
      `Admin ${adminId} upserted FAQ ${groupId} [${locale}] for destination ${id}`,
    );
    return this.faqGroups.upsertTranslation(
      FAQ_PAGE_TYPE.DESTINATION,
      id,
      groupId,
      locale,
      dto,
    );
  }

  async updateFaqGroup(
    id: string,
    groupId: string,
    dto: UpdateFaqGroupDto,
    adminId: string,
  ) {
    await this.findDestinationOrThrow(id);
    this.logger.log(
      `Admin ${adminId} updated FAQ ${groupId} for destination ${id}`,
    );
    return this.faqGroups.updateGroup(
      FAQ_PAGE_TYPE.DESTINATION,
      id,
      groupId,
      dto,
    );
  }

  /** Clear ONE locale of a FAQ (Translation Console) - see FaqGroupService. */
  async deleteFaqTranslation(
    id: string,
    groupId: string,
    locale: Locale,
    adminId: string,
  ) {
    await this.findDestinationOrThrow(id);
    this.logger.log(
      `Admin ${adminId} cleared FAQ ${groupId} [${locale}] for destination ${id}`,
    );
    return this.faqGroups.deleteTranslation(
      FAQ_PAGE_TYPE.DESTINATION,
      id,
      groupId,
      locale,
    );
  }

  async deleteFaqGroup(id: string, groupId: string, adminId: string) {
    await this.findDestinationOrThrow(id);
    this.logger.log(
      `Admin ${adminId} deleted FAQ ${groupId} for destination ${id}`,
    );
    return this.faqGroups.deleteGroup(FAQ_PAGE_TYPE.DESTINATION, id, groupId);
  }

  // ── Page content sections (authored About-band blocks) ───────────────────────
  // Same shape as the grouped-FAQ wrappers above: verify the destination exists
  // so 404s are accurate, then delegate to the shared service.

  async getContentSections(id: string) {
    await this.findDestinationOrThrow(id);
    return this.contentSections.getGroups(FAQ_PAGE_TYPE.DESTINATION, id);
  }

  async createContentSection(
    id: string,
    dto: CreatePageContentSectionDto,
    adminId: string,
  ) {
    await this.findDestinationOrThrow(id);
    this.logger.log(
      `Admin ${adminId} created content section for destination ${id}`,
    );
    return this.contentSections.createGroup(FAQ_PAGE_TYPE.DESTINATION, id, dto);
  }

  /** Clear ONE locale of an About-band section (Translation Console). */
  async deleteContentSectionTranslation(
    id: string,
    groupId: string,
    locale: Locale,
    adminId: string,
  ) {
    await this.findDestinationOrThrow(id);
    this.logger.log(
      `Admin ${adminId} cleared content section ${groupId} [${locale}] for destination ${id}`,
    );
    return this.contentSections.deleteTranslation(
      FAQ_PAGE_TYPE.DESTINATION,
      id,
      groupId,
      locale,
    );
  }

  async upsertContentSectionTranslation(
    id: string,
    groupId: string,
    locale: Locale,
    dto: UpsertPageContentSectionTranslationDto,
    adminId: string,
  ) {
    await this.findDestinationOrThrow(id);
    this.logger.log(
      `Admin ${adminId} upserted content section ${groupId} [${locale}] for destination ${id}`,
    );
    return this.contentSections.upsertTranslation(
      FAQ_PAGE_TYPE.DESTINATION,
      id,
      groupId,
      locale,
      dto,
    );
  }

  async updateContentSection(
    id: string,
    groupId: string,
    dto: UpdatePageContentSectionDto,
    adminId: string,
  ) {
    await this.findDestinationOrThrow(id);
    this.logger.log(
      `Admin ${adminId} updated content section ${groupId} for destination ${id}`,
    );
    return this.contentSections.updateGroup(
      FAQ_PAGE_TYPE.DESTINATION,
      id,
      groupId,
      dto,
    );
  }

  async deleteContentSection(id: string, groupId: string, adminId: string) {
    await this.findDestinationOrThrow(id);
    this.logger.log(
      `Admin ${adminId} deleted content section ${groupId} for destination ${id}`,
    );
    return this.contentSections.deleteGroup(
      FAQ_PAGE_TYPE.DESTINATION,
      id,
      groupId,
    );
  }
}
