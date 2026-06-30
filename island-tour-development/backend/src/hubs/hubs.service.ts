import { FAQ_PAGE_TYPE } from '@/common/constants/faq-page-type';
import { Locale } from '@/common/constants/locales';
import { applyTranslation, faqSelect } from '@/common/utils/translation.util';
import { generateSlug } from '@/common/utils/slug.util';
import { clearCooledDownSlugs, isSlugTaken, renameEntitySlug } from '@/common/utils/slug-registry.util';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { HubSectionType, HubStatus, SlugEntityType, TourStatus } from '@prisma/client';
import {
  ActiveHubsQueryDto,
  AddAllowedCategoryDto,
  CreateFaqDto,
  CreateHubDto,
  FaqLocaleQueryDto,
  HubBySlugQueryDto,
  HubQueryDto,
  HubRenderQueryDto,
  ReplaceContentSectionsDto,
  SetComparisonDto,
  SetOurPicksDto,
  UpdateFaqDto,
  UpdateHubDto,
  UpsertHubPageContentDto,
  UpsertHubTranslationsDto,
} from './dto/hub.dto';

@Injectable()
export class HubService {
  private readonly logger = new Logger(HubService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Hub translation select including `heroTagline` (absent from the shared translationSelect util).
  private readonly hubTranslationSelect = {
    name: true,
    overview: true,
    heroTagline: true,
    h1Override: true,
    breadcrumbLabel: true,
    isMachineTranslated: true,
  } as const;

  private readonly hubSelect = {
    id: true,
    destinationId: true,
    name: true,
    slug: true,
    description: true,
    heroImage: true,
    ogImage: true,
    status: true,
    hubType: true,
    latitude: true,
    longitude: true,
    isSeeded: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  private readonly hubDetailSelect = {
    id: true,
    destinationId: true,
    name: true,
    slug: true,
    description: true,
    heroImage: true,
    ogImage: true,
    status: true,
    hubType: true,
    latitude: true,
    longitude: true,
    isSeeded: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    allowedCategories: {
      select: {
        id: true,
        categoryId: true,
        category: { select: { id: true, name: true, slug: true } },
      },
    },
  } as const;

  private readonly allowedCategorySelect = {
    id: true,
    categoryId: true,
    category: { select: { id: true, name: true, slug: true } },
  } as const;

  // ── Internal helpers ──────────────────────────────────────────────────────────

  private async findHubOrThrow(id: string) {
    const hub = await this.prisma.hub.findUnique({
      where: { id },
      select: this.hubSelect,
    });
    if (!hub) throw new NotFoundException(`Hub ${id} not found`);
    return hub;
  }

  /** Localized tour title with en fallback to the canonical name. */
  private tourTitle(tour: {
    name: string;
    translations: { title: string | null }[];
  }): string {
    return tour.translations[0]?.title ?? tour.name;
  }

  // ── Public CRUD ───────────────────────────────────────────────────────────────

  async getAll(query: HubQueryDto) {
    const { destinationId, isActive, page = 1, limit = 20, locale = Locale.en } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(destinationId !== undefined && { destinationId }),
      ...(isActive !== undefined && { isActive }),
    };

    const [total, data] = await Promise.all([
      this.prisma.hub.count({ where }),
      this.prisma.hub.findMany({
        where,
        select: {
          ...this.hubSelect,
          translations: { where: { locale }, select: { name: true, isMachineTranslated: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    const localizedData = data.map(({ translations, ...hub }) =>
      applyTranslation(hub, translations[0], locale),
    );

    return { total, page, limit, data: localizedData };
  }

  async getActive(query: ActiveHubsQueryDto) {
    const { destinationId, locale = Locale.en } = query;

    const data = await this.prisma.hub.findMany({
      where: {
        isActive: true,
        ...(destinationId !== undefined && { destinationId }),
      },
      select: {
        ...this.hubDetailSelect,
        translations: { where: { locale }, select: { name: true, isMachineTranslated: true } },
      },
      orderBy: { name: 'asc' },
    });

    return data.map(({ translations, ...hub }) =>
      applyTranslation(hub, translations[0], locale),
    );
  }

  /**
   * Destination-scoped, tour-gated public hub list (mirrors the category
   * equivalent): only PUBLISHED + active hubs that have ≥1 LIVE tour tagged to
   * them, each with `publishedTourCount`. Backs the destination page's discovery
   * rows (hero "Popular" + "Explore by type") so every hub link resolves.
   */
  async getActiveByDestinationSlug(destinationSlug: string, locale: Locale = Locale.en) {
    const destination = await this.prisma.destination.findUnique({
      where: { slug: destinationSlug },
      select: { id: true, isActive: true },
    });
    if (!destination || !destination.isActive) {
      throw new NotFoundException(`Destination "${destinationSlug}" not found`);
    }

    const grouped = await this.prisma.tourHub.groupBy({
      by: ['hubId'],
      where: { tour: { destinationId: destination.id, status: TourStatus.LIVE, isActive: true } },
      _count: { _all: true },
    });
    const countByHub = new Map(grouped.map((g) => [g.hubId, g._count._all]));
    const hubIds = [...countByHub.keys()];
    if (hubIds.length === 0) return [];

    const hubs = await this.prisma.hub.findMany({
      where: { id: { in: hubIds }, isActive: true, status: HubStatus.PUBLISHED },
      select: {
        ...this.hubSelect,
        translations: { where: { locale }, select: { name: true, isMachineTranslated: true } },
      },
      orderBy: { name: 'asc' },
    });

    return hubs.map(({ translations, ...hub }) => ({
      ...applyTranslation(hub, translations[0], locale),
      publishedTourCount: countByHub.get(hub.id) ?? 0,
    }));
  }

  async getById(id: string, locale: Locale = Locale.en) {
    const hub = await this.prisma.hub.findUnique({
      where: { id },
      select: {
        ...this.hubDetailSelect,
        translations: { where: { locale }, select: this.hubTranslationSelect },
      },
    });

    if (!hub) throw new NotFoundException(`Hub ${id} not found`);

    const { translations, ...hubData } = hub;
    const t = translations[0];

    return {
      ...applyTranslation(hubData, t, locale),
      overview: t?.overview ?? null,
      heroTagline: t?.heroTagline ?? null,
      h1Override: t?.h1Override ?? null,
      breadcrumbLabel: t?.breadcrumbLabel ?? null,
    };
  }

  async getBySlug(slug: string, query: HubBySlugQueryDto) {
    const locale = query.locale ?? Locale.en;

    const hub = await this.prisma.hub.findFirst({
      where: {
        slug,
        destination: { slug: query.destinationSlug },
      },
      select: {
        ...this.hubDetailSelect,
        translations: { where: { locale }, select: this.hubTranslationSelect },
      },
    });

    if (!hub) {
      throw new NotFoundException(
        `Hub "${slug}" not found for destination "${query.destinationSlug}"`,
      );
    }

    const { translations, ...hubData } = hub;
    const t = translations[0];

    return {
      ...applyTranslation(hubData, t, locale),
      overview: t?.overview ?? null,
      heroTagline: t?.heroTagline ?? null,
      h1Override: t?.h1Override ?? null,
      breadcrumbLabel: t?.breadcrumbLabel ?? null,
    };
  }

  async create(dto: CreateHubDto, adminId: string) {
    const slug = generateSlug(dto.name);

    return this.prisma.$transaction(async (tx) => {
      const destination = await tx.destination.findUnique({
        where: { id: dto.destinationId },
        select: { slug: true },
      });
      if (!destination) {
        throw new NotFoundException(`Destination ${dto.destinationId} not found`);
      }

      const hub = await tx.hub
        .create({
          data: {
            destinationId: dto.destinationId,
            name: dto.name,
            slug,
            description: dto.description,
            heroImage: dto.heroImage ?? null,
            ogImage: dto.ogImage ?? null,
            ...(dto.status !== undefined && { status: dto.status }),
            hubType: dto.hubType,
            latitude: dto.latitude ?? null,
            longitude: dto.longitude ?? null,
            createdBy: adminId,
          },
          select: { id: true },
        })
        .catch((err: any) => {
          if (err?.code === 'P2002') {
            throw new ConflictException(
              `Hub slug "${slug}" already exists for this destination`,
            );
          }
          throw err;
        });

      // Clear any cooled-down ghost so a previously deleted hub slug can be reused.
      await clearCooledDownSlugs(tx, [{ destinationSlug: destination.slug, slug }]);

      await tx.slugRegistry
        .create({
          data: {
            destinationSlug: destination.slug,
            slug,
            entityType: SlugEntityType.HUB,
            entityId: hub.id,
          },
        })
        .catch((err: any) => {
          if (err?.code === 'P2002') {
            throw new ConflictException(
              `Slug "${slug}" is already taken for destination "${destination.slug}"`,
            );
          }
          throw err;
        });

      if (dto.allowedCategoryIds && dto.allowedCategoryIds.length > 0) {
        await tx.hubAllowedCategory.createMany({
          data: dto.allowedCategoryIds.map((categoryId) => ({
            hubId: hub.id,
            categoryId,
          })),
          skipDuplicates: true,
        });
      }

      this.logger.log(
        `Admin ${adminId} created hub "${dto.name}" (${hub.id}) for destination ${dto.destinationId}`,
      );

      return tx.hub.findUniqueOrThrow({
        where: { id: hub.id },
        select: this.hubDetailSelect,
      });
    });
  }

  async update(id: string, dto: UpdateHubDto, adminId: string) {
    // Resolve a slug rename up-front (cooldown-aware, master slug-registry rules).
    let renameFrom: string | undefined;
    let renameTo: string | undefined;
    if (dto.slug !== undefined) {
      const current = await this.prisma.hub.findUnique({
        where: { id },
        select: { slug: true, destination: { select: { slug: true } } },
      });
      if (!current) throw new NotFoundException(`Hub ${id} not found`);
      const normalized = generateSlug(dto.slug);
      if (normalized !== current.slug) {
        if (await isSlugTaken(this.prisma, current.destination.slug, normalized, id)) {
          throw new ConflictException(`Slug "${normalized}" is already taken for this destination`);
        }
        renameFrom = current.slug;
        renameTo = normalized;
      }
    }

    // Publish guard (G6): DRAFT -> PUBLISHED must satisfy the listing requirements.
    if (dto.status === HubStatus.PUBLISHED) {
      await this.assertPublishable(id, dto);
    }

    return this.prisma.$transaction(async (tx) => {
      if (renameTo && renameFrom) {
        await renameEntitySlug(tx, {
          entityType: SlugEntityType.HUB,
          entityId: id,
          fromSlug: renameFrom,
          toSlug: renameTo,
        });
      }

      const updated = await tx.hub
        .update({
          where: { id },
          data: {
            ...(renameTo && { slug: renameTo }),
            ...(dto.name !== undefined && { name: dto.name }),
            ...(dto.description !== undefined && { description: dto.description }),
            ...(dto.heroImage !== undefined && { heroImage: dto.heroImage }),
            ...(dto.ogImage !== undefined && { ogImage: dto.ogImage }),
            ...(dto.status !== undefined && { status: dto.status }),
            ...(dto.hubType !== undefined && { hubType: dto.hubType }),
            ...(dto.latitude !== undefined && { latitude: dto.latitude }),
            ...(dto.longitude !== undefined && { longitude: dto.longitude }),
            ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          },
          select: this.hubDetailSelect,
        })
        .catch((err: any) => {
          if (err?.code === 'P2025') throw new NotFoundException(`Hub ${id} not found`);
          throw err;
        });

      if (dto.isActive !== undefined) {
        await tx.slugRegistry.updateMany({
          where: { entityType: SlugEntityType.HUB, entityId: id },
          data: { isActive: dto.isActive },
        });
      }

      this.logger.log(`Admin ${adminId} updated hub ${id}`);

      return updated;
    });
  }

  /**
   * Publish guard (HUB-DATA §14 G6). A hub may go PUBLISHED only when:
   *  - heroImage is set (incoming dto value or stored),
   *  - hubType is set,
   *  - base-locale (en) H1 override + overview (editorial lead) exist,
   *  - at least one en DISCOVER and one en LOCAL_TIP content section exist.
   * Throws 422 with the full missing-list otherwise.
   */
  private async assertPublishable(id: string, dto: UpdateHubDto): Promise<void> {
    const hub = await this.prisma.hub.findUnique({
      where: { id },
      select: { heroImage: true, hubType: true },
    });
    if (!hub) throw new NotFoundException(`Hub ${id} not found`);

    const [enTranslation, discoverCount, localTipCount] = await Promise.all([
      this.prisma.hubTranslation.findUnique({
        where: { hubId_locale: { hubId: id, locale: Locale.en } },
        select: { h1Override: true, overview: true },
      }),
      this.prisma.hubContentSection.count({
        where: { hubId: id, locale: Locale.en, sectionType: HubSectionType.DISCOVER },
      }),
      this.prisma.hubContentSection.count({
        where: { hubId: id, locale: Locale.en, sectionType: HubSectionType.LOCAL_TIP },
      }),
    ]);

    const heroImage = dto.heroImage ?? hub.heroImage;
    const hubType = dto.hubType ?? hub.hubType;

    const missing: string[] = [];
    if (!heroImage) missing.push('heroImage');
    if (!hubType) missing.push('hubType');
    if (!enTranslation?.h1Override) missing.push('English (en) H1 override');
    if (!enTranslation?.overview) missing.push('English (en) overview (editorial lead)');
    if (discoverCount === 0) missing.push('at least one English (en) DISCOVER content section');
    if (localTipCount === 0) missing.push('at least one English (en) LOCAL_TIP content section');

    if (missing.length > 0) {
      throw new UnprocessableEntityException({
        message: 'Hub cannot be published until all listing requirements are met.',
        missing,
      });
    }
  }

  async remove(id: string, adminId: string) {
    const hub = await this.findHubOrThrow(id);

    if (hub.isSeeded) {
      throw new ForbiddenException('Seeded hubs cannot be deactivated');
    }

    await this.prisma.$transaction(async (tx) => {
      const tripCount = await tx.tour.count({
        where: { hubs: { some: { hubId: id } }, isActive: true, status: { not: TourStatus.DRAFT } },
      });
      if (tripCount > 0) {
        throw new ConflictException(
          `Cannot deactivate hub: ${tripCount} active trip(s) are still assigned to it`,
        );
      }

      await tx.hub.update({ where: { id }, data: { isActive: false } });

      await tx.slugRegistry.updateMany({
        where: { entityType: SlugEntityType.HUB, entityId: id },
        data: { isActive: false },
      });
    });

    this.logger.log(`Admin ${adminId} deactivated hub ${id}`);

    return { message: 'Hub deactivated successfully' };
  }

  // ── Allowed categories ────────────────────────────────────────────────────────

  async getAllowedCategories(id: string) {
    await this.findHubOrThrow(id);

    return this.prisma.hubAllowedCategory.findMany({
      where: { hubId: id },
      select: this.allowedCategorySelect,
      orderBy: { category: { name: 'asc' } },
    });
  }

  async addAllowedCategory(hubId: string, dto: AddAllowedCategoryDto, adminId: string) {
    await this.findHubOrThrow(hubId);

    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
      select: { id: true, name: true },
    });
    if (!category) throw new NotFoundException(`Category ${dto.categoryId} not found`);

    const allowedCategory = await this.prisma.hubAllowedCategory
      .create({
        data: { hubId, categoryId: dto.categoryId },
        select: this.allowedCategorySelect,
      })
      .catch((err: any) => {
        if (err?.code === 'P2002') {
          throw new ConflictException(
            `Category "${category.name}" is already allowed for this hub`,
          );
        }
        throw err;
      });

    this.logger.log(
      `Admin ${adminId} added allowed category ${dto.categoryId} to hub ${hubId}`,
    );

    return {
      message: 'Allowed category added successfully',
      allowedCategory,
    };
  }

  async removeAllowedCategory(hubId: string, categoryId: string, adminId: string) {
    await this.findHubOrThrow(hubId);

    const existing = await this.prisma.hubAllowedCategory.findUnique({
      where: { hubId_categoryId: { hubId, categoryId } },
    });
    if (!existing) {
      throw new NotFoundException(
        `Category ${categoryId} is not in the allowed list for hub ${hubId}`,
      );
    }

    await this.prisma.hubAllowedCategory.delete({
      where: { hubId_categoryId: { hubId, categoryId } },
    });

    this.logger.log(
      `Admin ${adminId} removed allowed category ${categoryId} from hub ${hubId}`,
    );

    return { message: 'Allowed category removed successfully' };
  }

  // ── Translations ──────────────────────────────────────────────────────────────

  async getAllTranslations(id: string) {
    await this.findHubOrThrow(id);

    return this.prisma.hubTranslation.findMany({
      where: { hubId: id },
      select: { locale: true, ...this.hubTranslationSelect },
      orderBy: { locale: 'asc' },
    });
  }

  async getTranslationsByLocale(id: string, locale: Locale) {
    await this.findHubOrThrow(id);

    const translation = await this.prisma.hubTranslation.findUnique({
      where: { hubId_locale: { hubId: id, locale } },
      select: { locale: true, ...this.hubTranslationSelect },
    });

    return (
      translation ?? {
        locale,
        name: null,
        overview: null,
        heroTagline: null,
        h1Override: null,
        breadcrumbLabel: null,
        isMachineTranslated: false,
      }
    );
  }

  async upsertTranslations(
    id: string,
    locale: Locale,
    dto: UpsertHubTranslationsDto,
    adminId: string,
  ) {
    await this.findHubOrThrow(id);

    const { fields, isMachineTranslated } = dto;

    const result = await this.prisma.hubTranslation.upsert({
      where: { hubId_locale: { hubId: id, locale } },
      create: {
        hubId: id,
        locale,
        isMachineTranslated: isMachineTranslated ?? false,
        name: fields.name,
        overview: fields.overview,
        heroTagline: fields.heroTagline,
        h1Override: fields.h1Override,
        breadcrumbLabel: fields.breadcrumbLabel,
      },
      update: {
        isMachineTranslated: isMachineTranslated ?? false,
        ...(fields.name !== undefined && { name: fields.name }),
        ...(fields.overview !== undefined && { overview: fields.overview }),
        ...(fields.heroTagline !== undefined && { heroTagline: fields.heroTagline }),
        ...(fields.h1Override !== undefined && { h1Override: fields.h1Override }),
        ...(fields.breadcrumbLabel !== undefined && { breadcrumbLabel: fields.breadcrumbLabel }),
      },
      select: { locale: true, ...this.hubTranslationSelect },
    });

    this.logger.log(`Admin ${adminId} upserted translation for hub ${id} [${locale}]`);
    return result;
  }

  async deleteTranslations(id: string, locale: Locale, adminId: string) {
    if (locale === Locale.en) {
      throw new BadRequestException(
        'The English translation cannot be deleted. Update the hub name field instead.',
      );
    }

    await this.findHubOrThrow(id);

    await this.prisma.hubTranslation
      .delete({ where: { hubId_locale: { hubId: id, locale } } })
      .catch((err: any) => {
        if (err?.code === 'P2025') {
          throw new NotFoundException(`No translation found for locale "${locale}"`);
        }
        throw err;
      });

    this.logger.log(`Admin ${adminId} deleted translation for hub ${id} [${locale}]`);
    return { message: `Translation for locale "${locale}" deleted` };
  }

  // ── Page Content ──────────────────────────────────────────────────────────────

  async getPageContent(id: string, locale: Locale) {
    await this.findHubOrThrow(id);

    const row = await this.prisma.hubPageContent.findUnique({
      where: { hubId_locale: { hubId: id, locale } },
      select: { locale: true, aboutText: true, metaTitle: true, metaDescription: true },
    });

    return row ?? { locale, aboutText: null, metaTitle: null, metaDescription: null };
  }

  async upsertPageContent(
    id: string,
    locale: Locale,
    dto: UpsertHubPageContentDto,
    adminId: string,
  ) {
    await this.findHubOrThrow(id);

    const result = await this.prisma.hubPageContent.upsert({
      where: { hubId_locale: { hubId: id, locale } },
      create: {
        hubId: id,
        locale,
        aboutText: dto.aboutText,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
      },
      update: {
        ...(dto.aboutText !== undefined && { aboutText: dto.aboutText }),
        ...(dto.metaTitle !== undefined && { metaTitle: dto.metaTitle }),
        ...(dto.metaDescription !== undefined && { metaDescription: dto.metaDescription }),
      },
      select: { locale: true, aboutText: true, metaTitle: true, metaDescription: true },
    });

    this.logger.log(`Admin ${adminId} upserted page content for hub ${id} [${locale}]`);
    return result;
  }

  // ── Content sections (Discover / Local Tips / Fast Facts / Editorial) ──────────

  private readonly contentSectionSelect = {
    locale: true,
    sectionType: true,
    heading: true,
    body: true,
    displayOrder: true,
  } as const;

  async getContentSections(id: string, locale?: Locale) {
    await this.findHubOrThrow(id);

    return this.prisma.hubContentSection.findMany({
      where: { hubId: id, ...(locale && { locale }) },
      select: this.contentSectionSelect,
      orderBy: [{ sectionType: 'asc' }, { displayOrder: 'asc' }],
    });
  }

  /** Replace the hub's full set of content sections (delete-then-insert). */
  async replaceContentSections(id: string, dto: ReplaceContentSectionsDto, adminId: string) {
    await this.findHubOrThrow(id);

    const sections = await this.prisma.$transaction(async (tx) => {
      await tx.hubContentSection.deleteMany({ where: { hubId: id } });

      if (dto.sections.length > 0) {
        await tx.hubContentSection.createMany({
          data: dto.sections.map((s) => ({
            hubId: id,
            locale: s.locale,
            sectionType: s.sectionType,
            heading: s.heading,
            body: s.body,
            displayOrder: s.displayOrder ?? 0,
          })),
        });
      }

      return tx.hubContentSection.findMany({
        where: { hubId: id },
        select: this.contentSectionSelect,
        orderBy: [{ sectionType: 'asc' }, { displayOrder: 'asc' }],
      });
    });

    this.logger.log(
      `Admin ${adminId} replaced ${sections.length} content section(s) for hub ${id}`,
    );

    return { count: sections.length, sections };
  }

  // ── Our Picks ──────────────────────────────────────────────────────────────────

  /** Replace the hub's Our-Pick selections, including per-locale blurb translations. */
  async setOurPicks(id: string, dto: SetOurPicksDto, adminId: string) {
    await this.findHubOrThrow(id);

    // Validate referenced tours exist and belong to the same destination as the hub.
    if (dto.picks.length > 0) {
      const tourIds = dto.picks.map((p) => p.tourId);
      const hub = await this.prisma.hub.findUniqueOrThrow({
        where: { id },
        select: { destinationId: true },
      });
      const tours = await this.prisma.tour.findMany({
        where: { id: { in: tourIds }, destinationId: hub.destinationId },
        select: { id: true },
      });
      const found = new Set(tours.map((t) => t.id));
      const missing = tourIds.filter((tid) => !found.has(tid));
      if (missing.length > 0) {
        throw new BadRequestException(
          `Tour(s) not found in this hub's destination: ${missing.join(', ')}`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Cascade removes child translations of the old rows.
      await tx.hubOurPick.deleteMany({ where: { hubId: id } });

      for (const pick of dto.picks) {
        const created = await tx.hubOurPick.create({
          data: {
            hubId: id,
            tourId: pick.tourId,
            pickType: pick.pickType,
            description: pick.description,
            displayOrder: pick.displayOrder ?? 0,
          },
          select: { id: true },
        });

        if (pick.translations && pick.translations.length > 0) {
          await tx.hubOurPickTranslation.createMany({
            data: pick.translations.map((t) => ({
              ourPickId: created.id,
              locale: t.locale,
              description: t.description,
            })),
          });
        }
      }
    });

    this.logger.log(`Admin ${adminId} set ${dto.picks.length} Our-Pick(s) for hub ${id}`);

    return this.getOurPicks(id, Locale.en);
  }

  async getOurPicks(id: string, locale: Locale = Locale.en) {
    await this.findHubOrThrow(id);

    const rows = await this.prisma.hubOurPick.findMany({
      where: { hubId: id },
      select: {
        id: true,
        pickType: true,
        description: true,
        displayOrder: true,
        translations: { where: { locale }, select: { description: true } },
        tour: {
          select: {
            id: true,
            slug: true,
            name: true,
            translations: { where: { locale }, select: { title: true } },
          },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    const ourPicks = rows.map((r) => ({
      id: r.id,
      pickType: r.pickType,
      description: r.translations[0]?.description ?? r.description,
      displayOrder: r.displayOrder,
      tour: {
        id: r.tour.id,
        slug: r.tour.slug,
        title: this.tourTitle(r.tour),
      },
    }));

    return { count: ourPicks.length, ourPicks };
  }

  // ── Comparison ───────────────────────────────────────────────────────────────

  /** Replace the hub's comparison groups + tour columns, with per-locale labels/notes. */
  async setComparison(id: string, dto: SetComparisonDto, adminId: string) {
    await this.findHubOrThrow(id);

    // Validate referenced tours belong to the hub's destination.
    const tourIds = dto.groups.flatMap((g) => g.tours.map((t) => t.tourId));
    if (tourIds.length > 0) {
      const hub = await this.prisma.hub.findUniqueOrThrow({
        where: { id },
        select: { destinationId: true },
      });
      const tours = await this.prisma.tour.findMany({
        where: { id: { in: tourIds }, destinationId: hub.destinationId },
        select: { id: true },
      });
      const found = new Set(tours.map((t) => t.id));
      const missing = [...new Set(tourIds)].filter((tid) => !found.has(tid));
      if (missing.length > 0) {
        throw new BadRequestException(
          `Tour(s) not found in this hub's destination: ${missing.join(', ')}`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Cascade removes comparison tours + all translations.
      await tx.hubComparisonGroup.deleteMany({ where: { hubId: id } });

      for (const group of dto.groups) {
        const createdGroup = await tx.hubComparisonGroup.create({
          data: {
            hubId: id,
            groupName: group.groupName,
            displayOrder: group.displayOrder ?? 0,
          },
          select: { id: true },
        });

        if (group.translations && group.translations.length > 0) {
          await tx.hubComparisonGroupTranslation.createMany({
            data: group.translations.map((t) => ({
              groupId: createdGroup.id,
              locale: t.locale,
              groupName: t.groupName,
            })),
          });
        }

        for (const tour of group.tours) {
          const createdTour = await tx.hubComparisonTour.create({
            data: {
              groupId: createdGroup.id,
              tourId: tour.tourId,
              standoutNote: tour.standoutNote ?? null,
              displayOrder: tour.displayOrder ?? 0,
            },
            select: { id: true },
          });

          if (tour.translations && tour.translations.length > 0) {
            await tx.hubComparisonTourTranslation.createMany({
              data: tour.translations.map((t) => ({
                comparisonTourId: createdTour.id,
                locale: t.locale,
                standoutNote: t.standoutNote,
              })),
            });
          }
        }
      }
    });

    this.logger.log(
      `Admin ${adminId} set ${dto.groups.length} comparison group(s) for hub ${id}`,
    );

    return this.getComparison(id, Locale.en);
  }

  async getComparison(id: string, locale: Locale = Locale.en) {
    await this.findHubOrThrow(id);

    const groups = await this.prisma.hubComparisonGroup.findMany({
      where: { hubId: id },
      select: {
        id: true,
        groupName: true,
        displayOrder: true,
        translations: { where: { locale }, select: { groupName: true } },
        comparisonTours: {
          select: {
            id: true,
            standoutNote: true,
            displayOrder: true,
            translations: { where: { locale }, select: { standoutNote: true } },
            tour: {
              select: {
                id: true,
                slug: true,
                name: true,
                translations: { where: { locale }, select: { title: true } },
              },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    const mapped = groups.map((g) => ({
      id: g.id,
      groupName: g.translations[0]?.groupName ?? g.groupName,
      displayOrder: g.displayOrder,
      tours: g.comparisonTours.map((ct) => ({
        id: ct.id,
        displayOrder: ct.displayOrder,
        standoutNote: ct.translations[0]?.standoutNote ?? ct.standoutNote ?? null,
        tour: {
          id: ct.tour.id,
          slug: ct.tour.slug,
          title: this.tourTitle(ct.tour),
        },
      })),
    }));

    return { count: mapped.length, groups: mapped };
  }

  // ── Public render payload (§14) ────────────────────────────────────────────────

  async render(slug: string, query: HubRenderQueryDto) {
    const locale = query.locale ?? Locale.en;

    const hub = await this.prisma.hub.findFirst({
      where: {
        slug,
        destinationId: query.destinationId,
        isActive: true,
        status: HubStatus.PUBLISHED,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        hubType: true,
        heroImage: true,
        destinationId: true,
        translations: {
          where: { locale },
          select: { name: true, h1Override: true, heroTagline: true, overview: true, breadcrumbLabel: true },
        },
      },
    });

    if (!hub) {
      throw new NotFoundException(`Hub "${slug}" not found`);
    }

    // English fallback for editorial lead / h1 / tagline when the locale row is empty.
    const localeT = hub.translations[0];
    const enT =
      locale === Locale.en
        ? localeT
        : await this.prisma.hubTranslation.findUnique({
            where: { hubId_locale: { hubId: hub.id, locale: Locale.en } },
            select: { name: true, h1Override: true, heroTagline: true, overview: true, breadcrumbLabel: true },
          });

    const h1 = localeT?.h1Override ?? enT?.h1Override ?? localeT?.name ?? enT?.name ?? hub.name;
    const heroTagline = localeT?.heroTagline ?? enT?.heroTagline ?? null;
    const editorialLead = localeT?.overview ?? enT?.overview ?? null;
    const breadcrumbLabel = localeT?.breadcrumbLabel ?? enT?.breadcrumbLabel ?? null;

    const [sections, ourPicks, comparison, faqs, relatedHubs] = await Promise.all([
      this.prisma.hubContentSection.findMany({
        where: { hubId: hub.id, locale },
        select: this.contentSectionSelect,
        orderBy: [{ sectionType: 'asc' }, { displayOrder: 'asc' }],
      }),
      this.getOurPicks(hub.id, locale),
      this.getComparison(hub.id, locale),
      this.prisma.faq.findMany({
        where: { pageType: FAQ_PAGE_TYPE.HUB, entityId: hub.id, isActive: true, locale },
        select: faqSelect,
        orderBy: { displayOrder: 'asc' },
      }),
      this.prisma.hub.findMany({
        where: {
          destinationId: hub.destinationId,
          isActive: true,
          status: HubStatus.PUBLISHED,
          id: { not: hub.id },
        },
        select: { id: true, slug: true, name: true, heroImage: true },
        orderBy: { name: 'asc' },
        take: 3,
      }),
    ]);

    const fastFacts = sections.filter((s) => s.sectionType === HubSectionType.FAST_FACT);
    const discover = sections.filter((s) => s.sectionType === HubSectionType.DISCOVER);
    const localTips = sections.filter((s) => s.sectionType === HubSectionType.LOCAL_TIP);

    return {
      id: hub.id,
      slug: hub.slug,
      name: localeT?.name ?? enT?.name ?? hub.name,
      locale,
      hubType: hub.hubType,
      breadcrumbLabel,
      hero: {
        heroImage: hub.heroImage,
        h1,
        heroTagline,
        fastFacts,
      },
      editorialLead,
      ourPicks: ourPicks.ourPicks,
      comparisonGroups: comparison.groups,
      discover,
      localTips,
      faqs,
      relatedHubs,
    };
  }

  // ── FAQ ───────────────────────────────────────────────────────────────────────

  async getFaqs(id: string, query: FaqLocaleQueryDto) {
    await this.findHubOrThrow(id);

    return this.prisma.faq.findMany({
      where: {
        pageType: FAQ_PAGE_TYPE.HUB,
        entityId: id,
        isActive: true,
        ...(query.locale && { locale: query.locale }),
      },
      select: faqSelect,
      orderBy: [{ locale: 'asc' }, { displayOrder: 'asc' }],
    });
  }

  async createFaq(id: string, dto: CreateFaqDto, adminId: string) {
    await this.findHubOrThrow(id);

    const faq = await this.prisma.faq.create({
      data: {
        pageType: FAQ_PAGE_TYPE.HUB,
        entityId: id,
        locale: dto.locale,
        question: dto.question,
        answer: dto.answer,
        displayOrder: dto.displayOrder ?? 0,
      },
      select: faqSelect,
    });

    this.logger.log(`Admin ${adminId} created FAQ for hub ${id} [${dto.locale}]`);
    return faq;
  }

  async updateFaq(id: string, faqId: string, dto: UpdateFaqDto, adminId: string) {
    const faq = await this.prisma.faq.findFirst({
      where: { id: faqId, pageType: FAQ_PAGE_TYPE.HUB, entityId: id },
    });
    if (!faq) throw new NotFoundException(`FAQ ${faqId} not found for hub ${id}`);

    const updated = await this.prisma.faq.update({
      where: { id: faqId },
      data: {
        ...(dto.question !== undefined && { question: dto.question }),
        ...(dto.answer !== undefined && { answer: dto.answer }),
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: faqSelect,
    });

    this.logger.log(`Admin ${adminId} updated FAQ ${faqId} for hub ${id}`);
    return updated;
  }

  async deleteFaq(id: string, faqId: string, adminId: string) {
    const faq = await this.prisma.faq.findFirst({
      where: { id: faqId, pageType: FAQ_PAGE_TYPE.HUB, entityId: id },
    });
    if (!faq) throw new NotFoundException(`FAQ ${faqId} not found for hub ${id}`);

    await this.prisma.faq.delete({ where: { id: faqId } });

    this.logger.log(`Admin ${adminId} deleted FAQ ${faqId} for hub ${id}`);
    return { message: 'FAQ deleted successfully' };
  }
}
