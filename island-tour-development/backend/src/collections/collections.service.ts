import { FAQ_PAGE_TYPE } from '@/common/constants/faq-page-type';
import { Locale } from '@/common/constants/locales';
import { generateSlug } from '@/common/utils/slug.util';
import {
  clearCooledDownSlugs,
  isSlugTaken,
  markSlugsDeleted,
  renameEntitySlug,
} from '@/common/utils/slug-registry.util';
import {
  applyTranslation,
  faqSelect,
  translationSelect,
} from '@/common/utils/translation.util';
import { PrismaService } from '@/prisma/prisma.service';
import { ToursService } from '@/tours/tours.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  CollectionStatus,
  CollectionType,
  Prisma,
  SlugEntityType,
} from '@prisma/client';
import { TourQueryDto, TourSort } from '@/tours/dto/tour.dto';
import {
  CreateCollectionDto,
  CreateFaqDto,
  FaqLocaleQueryDto,
  ReplaceCollectionToursDto,
  UpdateCollectionDto,
  UpdateFaqDto,
  UpsertCollectionPageContentDto,
  UpsertCollectionTourRationaleDto,
  UpsertCollectionTranslationsDto,
} from './dto/collection.dto';

@Injectable()
export class CollectionsService {
  private readonly logger = new Logger(CollectionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly toursService: ToursService,
  ) {}

  private readonly collectionSelect = {
    id: true,
    destinationId: true,
    name: true,
    slug: true,
    collectionType: true,
    status: true,
    displayStyle: true,
    tourIds: true,
    filterQuery: true,
    heroImage: true,
    sortOrder: true,
    isActive: true,
    isSeeded: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  /** Translation fields surfaced on the public render + the admin translation editor. */
  private readonly collectionTranslationSelect = {
    name: true,
    overview: true,
    curationNote: true,
    eyebrowLabel: true,
    h1Override: true,
    breadcrumbLabel: true,
    isMachineTranslated: true,
  } as const;

  private async findCollectionOrThrow(id: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      select: this.collectionSelect,
    });
    if (!collection) throw new NotFoundException(`Collection ${id} not found`);
    return collection;
  }

  // ── Public read ─────────────────────────────────────────────────────────────

  async getActiveByDestinationSlug(
    destinationSlug: string,
    locale: Locale = Locale.en,
  ) {
    const destination = await this.prisma.destination.findUnique({
      where: { slug: destinationSlug },
      select: { id: true, isActive: true },
    });
    if (!destination || !destination.isActive)
      throw new NotFoundException(`Destination "${destinationSlug}" not found`);

    const data = await this.prisma.collection.findMany({
      where: { destinationId: destination.id, isActive: true },
      select: {
        ...this.collectionSelect,
        translations: {
          where: { locale },
          select: { name: true, isMachineTranslated: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    return data.map(({ translations, ...c }) =>
      applyTranslation(c, translations[0], locale),
    );
  }

  async getBySlug(
    destinationSlug: string,
    slug: string,
    locale: Locale = Locale.en,
  ) {
    const destination = await this.prisma.destination.findUnique({
      where: { slug: destinationSlug },
      select: { id: true, isActive: true },
    });
    if (!destination || !destination.isActive)
      throw new NotFoundException(`Destination "${destinationSlug}" not found`);

    const collection = await this.prisma.collection.findUnique({
      where: { destinationId_slug: { destinationId: destination.id, slug } },
      select: {
        ...this.collectionSelect,
        translations: { where: { locale }, select: translationSelect },
      },
    });
    if (!collection || !collection.isActive)
      throw new NotFoundException(`Collection "${slug}" not found`);

    const { translations, ...c } = collection;
    const t = translations[0];
    const tours = await this.resolveTours(collection);

    return {
      ...applyTranslation(c, t, locale),
      overview: t?.overview ?? null,
      h1Override: t?.h1Override ?? null,
      breadcrumbLabel: t?.breadcrumbLabel ?? null,
      tours,
    };
  }

  // ── Admin read ──────────────────────────────────────────────────────────────

  /** Raw collection by id (active or inactive) - for the admin edit form. */
  async getByIdAdmin(id: string) {
    return this.findCollectionOrThrow(id);
  }

  /** All collections (active + inactive) for a destination - for the admin list. */
  async getAllByDestinationAdmin(destinationSlug: string) {
    const destination = await this.prisma.destination.findUnique({
      where: { slug: destinationSlug },
      select: { id: true },
    });
    if (!destination)
      throw new NotFoundException(`Destination "${destinationSlug}" not found`);

    return this.prisma.collection.findMany({
      where: { destinationId: destination.id },
      select: this.collectionSelect,
      orderBy: { name: 'asc' },
    });
  }

  /** MANUAL → ordered tourIds; DYNAMIC → filterQuery resolved via the tour-listing engine. */
  private async resolveTours(collection: {
    destinationId: string;
    collectionType: CollectionType;
    tourIds: string[];
    filterQuery: unknown;
    sortOrder: string;
  }) {
    if (collection.collectionType === CollectionType.MANUAL) {
      return this.toursService.findPublicByIds(collection.tourIds);
    }
    const fq = (collection.filterQuery as Record<string, any>) ?? {};
    const query: TourQueryDto = {
      destinationId: collection.destinationId,
      categoryId: typeof fq.categoryId === 'string' ? fq.categoryId : undefined,
      minPrice: typeof fq.minPrice === 'number' ? fq.minPrice : undefined,
      maxPrice: typeof fq.maxPrice === 'number' ? fq.maxPrice : undefined,
      durationMin:
        typeof fq.durationMin === 'number' ? fq.durationMin : undefined,
      durationMax:
        typeof fq.durationMax === 'number' ? fq.durationMax : undefined,
      ratingMin: typeof fq.ratingMin === 'number' ? fq.ratingMin : undefined,
      sort: this.toTourSort(collection.sortOrder),
      page: 1,
      limit: 100,
    };
    // Attribute filters from filterQuery.attributes ({ key: "v1,v2" | ["v1","v2"] }).
    const rawAttrs: Record<string, string> = {};
    const attrs = fq.attributes;
    if (attrs && typeof attrs === 'object') {
      for (const [k, v] of Object.entries(attrs)) {
        rawAttrs[k] = Array.isArray(v) ? v.join(',') : String(v);
      }
    }
    const result = await this.toursService.findAll(query, rawAttrs);
    return result.data;
  }

  private toTourSort(value: string): TourSort {
    return (Object.values(TourSort) as string[]).includes(value)
      ? (value as TourSort)
      : TourSort.recommended;
  }

  // ── Admin CRUD ────────────────────────────────────────────────────────────────

  async create(dto: CreateCollectionDto, adminId: string) {
    const slug = dto.slug ? generateSlug(dto.slug) : generateSlug(dto.name);

    const destination = await this.prisma.destination.findUnique({
      where: { id: dto.destinationId },
      select: { id: true, slug: true, isActive: true },
    });
    if (!destination || !destination.isActive)
      throw new BadRequestException('Destination not found or is not active');

    // Cannibalization guard (V2 §6): a collection slug must not equal a (global) category slug.
    const categoryClash = await this.prisma.category.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (categoryClash) {
      throw new ConflictException(
        `Slug "${slug}" collides with a category slug - choose a distinct collection slug`,
      );
    }

    if (
      dto.collectionType === CollectionType.MANUAL &&
      (!dto.tourIds || dto.tourIds.length === 0)
    ) {
      throw new BadRequestException(
        'MANUAL collections require at least one tourId',
      );
    }
    if (dto.collectionType === CollectionType.DYNAMIC && !dto.filterQuery) {
      throw new BadRequestException(
        'DYNAMIC collections require a filterQuery',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const collection = await tx.collection
        .create({
          data: {
            destinationId: dto.destinationId,
            name: dto.name,
            slug,
            collectionType: dto.collectionType,
            ...(dto.status !== undefined && { status: dto.status }),
            ...(dto.displayStyle !== undefined && {
              displayStyle: dto.displayStyle,
            }),
            tourIds: dto.tourIds ?? [],
            filterQuery: (dto.filterQuery ?? undefined) as
              | Prisma.InputJsonValue
              | undefined,
            heroImage: dto.heroImage ?? null,
            sortOrder: dto.sortOrder ?? 'recommended',
            createdBy: adminId,
          },
          select: this.collectionSelect,
        })
        .catch((err: any) => {
          if (err?.code === 'P2002')
            throw new ConflictException(
              `Collection slug "${slug}" already exists for this destination`,
            );
          throw err;
        });

      // Clear any cooled-down ghost so a previously force-deleted collection slug can be reused.
      await clearCooledDownSlugs(tx, [
        { destinationSlug: destination.slug, slug },
      ]);

      await tx.slugRegistry
        .create({
          data: {
            destinationSlug: destination.slug,
            slug,
            entityType: SlugEntityType.COLLECTION,
            entityId: collection.id,
          },
        })
        .catch((err: any) => {
          if (err?.code === 'P2002')
            throw new ConflictException(
              `Slug "${slug}" is already taken at destination "${destination.slug}"`,
            );
          throw err;
        });

      // Seed CollectionTour rows (authoritative MANUAL membership) from the initial tourIds.
      if (
        dto.collectionType === CollectionType.MANUAL &&
        dto.tourIds &&
        dto.tourIds.length > 0
      ) {
        await tx.collectionTour.createMany({
          data: dto.tourIds.map((tourId, index) => ({
            collectionId: collection.id,
            tourId,
            position: index,
          })),
        });
      }

      this.logger.log(
        `Admin ${adminId} created collection "${dto.name}" (${collection.id})`,
      );
      return collection;
    });
  }

  async update(id: string, dto: UpdateCollectionDto, adminId: string) {
    // Resolve a slug rename up-front (cooldown-aware, master slug-registry rules).
    let renameFrom: string | undefined;
    let renameTo: string | undefined;
    if (dto.slug !== undefined) {
      const current = await this.prisma.collection.findUnique({
        where: { id },
        select: { slug: true, destination: { select: { slug: true } } },
      });
      if (!current) throw new NotFoundException(`Collection ${id} not found`);
      const normalized = generateSlug(dto.slug);
      if (normalized !== current.slug) {
        // Cannibalization guard (V2 §6): a collection slug must not equal a category slug.
        const categoryClash = await this.prisma.category.findUnique({
          where: { slug: normalized },
          select: { id: true },
        });
        if (categoryClash) {
          throw new ConflictException(
            `Slug "${normalized}" collides with a category slug - choose a distinct collection slug`,
          );
        }
        if (
          await isSlugTaken(
            this.prisma,
            current.destination.slug,
            normalized,
            id,
          )
        ) {
          throw new ConflictException(
            `Slug "${normalized}" is already taken at this destination`,
          );
        }
        renameFrom = current.slug;
        renameTo = normalized;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (renameTo && renameFrom) {
        await renameEntitySlug(tx, {
          entityType: SlugEntityType.COLLECTION,
          entityId: id,
          fromSlug: renameFrom,
          toSlug: renameTo,
        });
      }

      const updated = await tx.collection
        .update({
          where: { id },
          data: {
            ...(renameTo && { slug: renameTo }),
            ...(dto.name !== undefined && { name: dto.name }),
            ...(dto.tourIds !== undefined && { tourIds: dto.tourIds }),
            ...(dto.filterQuery !== undefined && {
              filterQuery: dto.filterQuery as Prisma.InputJsonValue,
            }),
            ...(dto.heroImage !== undefined && { heroImage: dto.heroImage }),
            ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
            ...(dto.displayStyle !== undefined && {
              displayStyle: dto.displayStyle,
            }),
            ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          },
          select: this.collectionSelect,
        })
        .catch((err: any) => {
          if (err?.code === 'P2025')
            throw new NotFoundException(`Collection ${id} not found`);
          throw err;
        });

      if (dto.isActive !== undefined) {
        await tx.slugRegistry.updateMany({
          where: { entityType: SlugEntityType.COLLECTION, entityId: id },
          data: { isActive: dto.isActive },
        });
      }
      this.logger.log(`Admin ${adminId} updated collection ${id}`);
      return updated;
    });
  }

  async remove(id: string, adminId: string) {
    const collection = await this.findCollectionOrThrow(id);
    if (collection.isSeeded)
      throw new ForbiddenException('Seeded collections cannot be deactivated');

    await this.prisma.$transaction(async (tx) => {
      await tx.collection.update({ where: { id }, data: { isActive: false } });
      await tx.slugRegistry.updateMany({
        where: { entityType: SlugEntityType.COLLECTION, entityId: id },
        data: { isActive: false },
      });
    });
    this.logger.log(`Admin ${adminId} deactivated collection ${id}`);
    return { message: 'Collection deactivated successfully' };
  }

  async forceDelete(id: string, adminId: string) {
    const collection = await this.findCollectionOrThrow(id);
    if (collection.isSeeded)
      throw new ForbiddenException(
        'Seeded collections cannot be permanently deleted',
      );

    await this.prisma.$transaction(async (tx) => {
      // Master slug-registry rule: hard delete starts the 90-day reuse cooldown.
      await markSlugsDeleted(tx, SlugEntityType.COLLECTION, id);
      await tx.collection.delete({ where: { id } });
    });
    this.logger.log(`Admin ${adminId} permanently deleted collection ${id}`);
    return { message: 'Collection permanently deleted' };
  }

  // ── Translations ──────────────────────────────────────────────────────────────

  async getAllTranslations(id: string) {
    await this.findCollectionOrThrow(id);
    return this.prisma.collectionTranslation.findMany({
      where: { collectionId: id },
      select: { locale: true, ...this.collectionTranslationSelect },
      orderBy: { locale: 'asc' },
    });
  }

  async getTranslationsByLocale(id: string, locale: Locale) {
    await this.findCollectionOrThrow(id);
    const t = await this.prisma.collectionTranslation.findUnique({
      where: { collectionId_locale: { collectionId: id, locale } },
      select: { locale: true, ...this.collectionTranslationSelect },
    });
    return (
      t ?? {
        locale,
        name: null,
        overview: null,
        curationNote: null,
        eyebrowLabel: null,
        h1Override: null,
        breadcrumbLabel: null,
        isMachineTranslated: false,
      }
    );
  }

  async upsertTranslations(
    id: string,
    locale: Locale,
    dto: UpsertCollectionTranslationsDto,
    adminId: string,
  ) {
    await this.findCollectionOrThrow(id);
    const { fields, isMachineTranslated } = dto;
    const result = await this.prisma.collectionTranslation.upsert({
      where: { collectionId_locale: { collectionId: id, locale } },
      create: {
        collectionId: id,
        locale,
        isMachineTranslated: isMachineTranslated ?? false,
        name: fields.name,
        overview: fields.overview,
        curationNote: fields.curationNote,
        eyebrowLabel: fields.eyebrowLabel,
        h1Override: fields.h1Override,
        breadcrumbLabel: fields.breadcrumbLabel,
      },
      update: {
        isMachineTranslated: isMachineTranslated ?? false,
        ...(fields.name !== undefined && { name: fields.name }),
        ...(fields.overview !== undefined && { overview: fields.overview }),
        ...(fields.curationNote !== undefined && {
          curationNote: fields.curationNote,
        }),
        ...(fields.eyebrowLabel !== undefined && {
          eyebrowLabel: fields.eyebrowLabel,
        }),
        ...(fields.h1Override !== undefined && {
          h1Override: fields.h1Override,
        }),
        ...(fields.breadcrumbLabel !== undefined && {
          breadcrumbLabel: fields.breadcrumbLabel,
        }),
      },
      select: { locale: true, ...this.collectionTranslationSelect },
    });
    this.logger.log(
      `Admin ${adminId} upserted translation for collection ${id} [${locale}]`,
    );
    return result;
  }

  async deleteTranslations(id: string, locale: Locale, adminId: string) {
    if (locale === Locale.en) {
      throw new BadRequestException(
        'The English translation cannot be deleted. Update the collection name instead.',
      );
    }
    await this.findCollectionOrThrow(id);
    await this.prisma.collectionTranslation
      .delete({ where: { collectionId_locale: { collectionId: id, locale } } })
      .catch((err: any) => {
        if (err?.code === 'P2025')
          throw new NotFoundException(
            `No translation found for locale "${locale}"`,
          );
        throw err;
      });
    this.logger.log(
      `Admin ${adminId} deleted translation for collection ${id} [${locale}]`,
    );
    return { message: `Translation for locale "${locale}" deleted` };
  }

  // ── Page Content ──────────────────────────────────────────────────────────────

  async getPageContent(id: string, locale: Locale) {
    await this.findCollectionOrThrow(id);
    const row = await this.prisma.collectionPageContent.findUnique({
      where: { collectionId_locale: { collectionId: id, locale } },
      select: {
        locale: true,
        aboutText: true,
        metaTitle: true,
        metaDescription: true,
      },
    });
    return (
      row ?? { locale, aboutText: null, metaTitle: null, metaDescription: null }
    );
  }

  async upsertPageContent(
    id: string,
    locale: Locale,
    dto: UpsertCollectionPageContentDto,
    adminId: string,
  ) {
    await this.findCollectionOrThrow(id);
    const result = await this.prisma.collectionPageContent.upsert({
      where: { collectionId_locale: { collectionId: id, locale } },
      create: {
        collectionId: id,
        locale,
        aboutText: dto.aboutText,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
      },
      update: {
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
      `Admin ${adminId} upserted page content for collection ${id} [${locale}]`,
    );
    return result;
  }

  // ── FAQ ─────────────────────────────────────────────────────────────────────

  async getFaqs(id: string, query: FaqLocaleQueryDto) {
    await this.findCollectionOrThrow(id);
    return this.prisma.faq.findMany({
      where: {
        pageType: FAQ_PAGE_TYPE.COLLECTION,
        entityId: id,
        isActive: true,
        ...(query.locale && { locale: query.locale }),
      },
      select: faqSelect,
      orderBy: [{ locale: 'asc' }, { displayOrder: 'asc' }],
    });
  }

  async createFaq(id: string, dto: CreateFaqDto, adminId: string) {
    await this.findCollectionOrThrow(id);
    const faq = await this.prisma.faq.create({
      data: {
        pageType: FAQ_PAGE_TYPE.COLLECTION,
        entityId: id,
        locale: dto.locale,
        question: dto.question,
        answer: dto.answer,
        displayOrder: dto.displayOrder ?? 0,
      },
      select: faqSelect,
    });
    this.logger.log(
      `Admin ${adminId} created FAQ for collection ${id} [${dto.locale}]`,
    );
    return faq;
  }

  async updateFaq(
    id: string,
    faqId: string,
    dto: UpdateFaqDto,
    adminId: string,
  ) {
    const faq = await this.prisma.faq.findFirst({
      where: { id: faqId, pageType: FAQ_PAGE_TYPE.COLLECTION, entityId: id },
    });
    if (!faq)
      throw new NotFoundException(
        `FAQ ${faqId} not found for collection ${id}`,
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
      `Admin ${adminId} updated FAQ ${faqId} for collection ${id}`,
    );
    return updated;
  }

  async deleteFaq(id: string, faqId: string, adminId: string) {
    const faq = await this.prisma.faq.findFirst({
      where: { id: faqId, pageType: FAQ_PAGE_TYPE.COLLECTION, entityId: id },
    });
    if (!faq)
      throw new NotFoundException(
        `FAQ ${faqId} not found for collection ${id}`,
      );
    await this.prisma.faq.delete({ where: { id: faqId } });
    this.logger.log(
      `Admin ${adminId} deleted FAQ ${faqId} for collection ${id}`,
    );
    return { message: 'FAQ deleted successfully' };
  }

  // ── Membership + rationale (MANUAL) ─────────────────────────────────────────────

  private static readonly RATIONALE_MAX_WORDS = 20;

  private static wordCount(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  /**
   * Replace the ordered MANUAL membership. Writes CollectionTour rows (position normalized
   * to a dense 0..n by the submitted order) and keeps the legacy `tourIds[]` mirror in the
   * same order. Existing members not in the payload are removed (cascading their rationales).
   */
  async replaceTours(
    id: string,
    dto: ReplaceCollectionToursDto,
    adminId: string,
  ) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      select: { id: true, collectionType: true, destinationId: true },
    });
    if (!collection) throw new NotFoundException(`Collection ${id} not found`);
    if (collection.collectionType !== CollectionType.MANUAL) {
      throw new BadRequestException(
        'Membership can only be set on MANUAL collections',
      );
    }

    // Order the payload by position, then re-normalize positions to a dense 0..n sequence.
    const ordered = [...dto.tours].sort((a, b) => a.position - b.position);
    const tourIds = ordered.map((t) => t.tourId);
    if (new Set(tourIds).size !== tourIds.length) {
      throw new BadRequestException('Duplicate tourId in membership payload');
    }

    // Validate every tour exists and belongs to this destination.
    const found = await this.prisma.tour.findMany({
      where: { id: { in: tourIds }, destinationId: collection.destinationId },
      select: { id: true },
    });
    if (found.length !== tourIds.length) {
      const foundSet = new Set(found.map((t) => t.id));
      const missing = tourIds.filter((t) => !foundSet.has(t));
      throw new BadRequestException(
        `Tour(s) not found in this destination: ${missing.join(', ')}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.collectionTour.deleteMany({ where: { collectionId: id } });
      await tx.collectionTour.createMany({
        data: ordered.map((t, index) => ({
          collectionId: id,
          tourId: t.tourId,
          position: index,
        })),
      });
      await tx.collection.update({ where: { id }, data: { tourIds } });
    });

    this.logger.log(
      `Admin ${adminId} replaced membership for collection ${id} (${tourIds.length} tours)`,
    );
    return this.prisma.collectionTour.findMany({
      where: { collectionId: id },
      orderBy: { position: 'asc' },
      select: { id: true, tourId: true, position: true },
    });
  }

  /** Upsert a per-tour, per-locale rationale (≤20 words; 400 otherwise). */
  async upsertTourRationale(
    id: string,
    tourId: string,
    locale: Locale,
    dto: UpsertCollectionTourRationaleDto,
    adminId: string,
  ) {
    if (
      CollectionsService.wordCount(dto.rationale) >
      CollectionsService.RATIONALE_MAX_WORDS
    ) {
      throw new BadRequestException(
        `Collection rationale must be ${CollectionsService.RATIONALE_MAX_WORDS} words or fewer`,
      );
    }
    const member = await this.prisma.collectionTour.findUnique({
      where: { collectionId_tourId: { collectionId: id, tourId } },
      select: { id: true },
    });
    if (!member)
      throw new NotFoundException(
        `Tour ${tourId} is not a member of collection ${id}`,
      );

    const result = await this.prisma.collectionTourRationale.upsert({
      where: {
        collectionTourId_locale: { collectionTourId: member.id, locale },
      },
      create: { collectionTourId: member.id, locale, rationale: dto.rationale },
      update: { rationale: dto.rationale },
      select: { id: true, locale: true, rationale: true },
    });
    this.logger.log(
      `Admin ${adminId} upserted rationale for collection ${id} tour ${tourId} [${locale}]`,
    );
    return { ...result, tourId };
  }

  // ── Status transition + publish guard (G5) ───────────────────────────────────────

  /**
   * Status transition with the publish guard. DRAFT→PUBLISHED is only allowed when the
   * collection is publishable: heroImage set, base-locale (en) H1 + overview present, and
   * (MANUAL only) every member tour carries a base-locale rationale (≤20 words). DYNAMIC
   * collections skip the per-tour rationale requirement. Throws 422 listing what is missing.
   */
  async updateStatus(id: string, status: CollectionStatus, adminId: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      select: { id: true, status: true, collectionType: true, heroImage: true },
    });
    if (!collection) throw new NotFoundException(`Collection ${id} not found`);

    if (
      status === CollectionStatus.PUBLISHED &&
      collection.status !== CollectionStatus.PUBLISHED
    ) {
      const missing = await this.collectPublishBlockers(collection);
      if (missing.length > 0) {
        throw new UnprocessableEntityException(
          `Cannot publish collection: ${missing.join('; ')}`,
        );
      }
    }

    const updated = await this.prisma.collection.update({
      where: { id },
      data: { status },
      select: this.collectionSelect,
    });
    this.logger.log(`Admin ${adminId} set collection ${id} status → ${status}`);
    return updated;
  }

  /** Returns human-readable reasons a collection cannot be published (empty = OK). */
  private async collectPublishBlockers(collection: {
    id: string;
    collectionType: CollectionType;
    heroImage: string | null;
  }): Promise<string[]> {
    const missing: string[] = [];
    if (!collection.heroImage) missing.push('heroImage is not set');

    const enTranslation = await this.prisma.collectionTranslation.findUnique({
      where: {
        collectionId_locale: { collectionId: collection.id, locale: Locale.en },
      },
      select: { h1Override: true, overview: true },
    });
    if (!enTranslation?.h1Override)
      missing.push('English H1 (h1Override) is missing');
    if (!enTranslation?.overview) missing.push('English overview is missing');

    if (collection.collectionType === CollectionType.MANUAL) {
      const members = await this.prisma.collectionTour.findMany({
        where: { collectionId: collection.id },
        select: {
          tourId: true,
          translations: {
            where: { locale: Locale.en },
            select: { rationale: true },
          },
        },
        orderBy: { position: 'asc' },
      });
      if (members.length === 0) {
        missing.push('MANUAL collection has no member tours');
      } else {
        const withoutRationale = members.filter((m) => {
          const r = m.translations[0]?.rationale;
          return (
            !r ||
            CollectionsService.wordCount(r) >
              CollectionsService.RATIONALE_MAX_WORDS
          );
        });
        if (withoutRationale.length > 0) {
          missing.push(
            `${withoutRationale.length} member tour(s) missing a valid English rationale (≤${CollectionsService.RATIONALE_MAX_WORDS} words)`,
          );
        }
      }
    }
    return missing;
  }

  // ── Public render (§10) ───────────────────────────────────────────────────────

  /**
   * Full collection page render. Only PUBLISHED + active collections render (404 otherwise).
   * Resolves tours (MANUAL → CollectionTour ordered by position with each tour's rationale[locale],
   * fallback en; DYNAMIC → filterQuery → tour listing with sortOrder), computes fast stats,
   * loads FAQs, and lists up to 3 related PUBLISHED collections in the same destination.
   */
  async render(
    slug: string,
    destinationId: string,
    locale: Locale = Locale.en,
  ) {
    const collection = await this.prisma.collection.findUnique({
      where: { destinationId_slug: { destinationId, slug } },
      select: {
        ...this.collectionSelect,
        translations: {
          where: { locale },
          select: this.collectionTranslationSelect,
        },
      },
    });
    if (
      !collection ||
      !collection.isActive ||
      collection.status !== CollectionStatus.PUBLISHED
    ) {
      throw new NotFoundException(`Collection "${slug}" not found`);
    }

    const { translations, ...c } = collection;
    const t = translations[0];

    // Resolve tours (+ per-tour rationale for MANUAL).
    const tours: Array<Record<string, unknown>> =
      collection.collectionType === CollectionType.MANUAL
        ? await this.resolveManualToursWithRationale(collection.id, locale)
        : await this.resolveTours(collection);

    const fastStats = this.computeFastStats(tours);

    const faqs = await this.prisma.faq.findMany({
      where: {
        pageType: FAQ_PAGE_TYPE.COLLECTION,
        entityId: collection.id,
        isActive: true,
        locale,
      },
      select: faqSelect,
      orderBy: { displayOrder: 'asc' },
    });

    const relatedCollections = await this.prisma.collection.findMany({
      where: {
        destinationId,
        status: CollectionStatus.PUBLISHED,
        isActive: true,
        id: { not: collection.id },
      },
      select: { id: true, name: true, slug: true, heroImage: true },
      orderBy: { name: 'asc' },
      take: 3,
    });

    return {
      ...applyTranslation(c, t, locale),
      overview: t?.overview ?? null,
      h1Override: t?.h1Override ?? null,
      breadcrumbLabel: t?.breadcrumbLabel ?? null,
      curationNote: t?.curationNote ?? null,
      eyebrowLabel: t?.eyebrowLabel ?? null,
      tours,
      fastStats,
      faqs,
      relatedCollections,
    };
  }

  /** MANUAL membership ordered by position, each card enriched with rationale[locale] (fallback en). */
  private async resolveManualToursWithRationale(
    collectionId: string,
    locale: Locale,
  ) {
    const members = await this.prisma.collectionTour.findMany({
      where: { collectionId },
      orderBy: { position: 'asc' },
      select: {
        tourId: true,
        translations: {
          where: { locale: { in: [locale, Locale.en] } },
          select: { locale: true, rationale: true },
        },
      },
    });
    if (members.length === 0) return [];

    const rationaleByTourId = new Map<string, string | null>();
    for (const m of members) {
      const exact = m.translations.find((r) => r.locale === locale)?.rationale;
      const fallback = m.translations.find(
        (r) => r.locale === Locale.en,
      )?.rationale;
      rationaleByTourId.set(m.tourId, exact ?? fallback ?? null);
    }

    const orderedIds = members.map((m) => m.tourId);
    const cards = (await this.toursService.findPublicByIds(
      orderedIds,
    )) as Array<{ id: string }>;
    return cards.map((card) => ({
      ...card,
      rationale: rationaleByTourId.get(card.id) ?? null,
    }));
  }

  /** Fast stats: count of resolved tours + min(priceFrom) across them (master §7). */
  private computeFastStats(tours: Array<Record<string, unknown>>) {
    let min: number | null = null;
    for (const tour of tours) {
      const raw = tour['priceFrom'];
      if (raw === null || raw === undefined) continue;
      const value = typeof raw === 'number' ? raw : Number(raw);
      if (Number.isFinite(value) && (min === null || value < min)) min = value;
    }
    return { tourCount: tours.length, fromPrice: min };
  }
}
