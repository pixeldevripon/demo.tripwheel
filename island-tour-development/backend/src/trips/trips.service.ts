import { Locale } from '@/common/constants/locales';
import { generateSlug } from '@/common/utils/slug.util';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Role, ScheduleStatus, SlugEntityType, TripStatus } from '@prisma/client';
import { CreateTripDto, MyTripsQueryDto, TripBySlugQueryDto, TripQueryDto, UpdateTripDto } from './dto/trip.dto';

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private readonly tripSelect = {
    id: true,
    name: true,
    slug: true,
    status: true,
    operatorId: true,
    destinationId: true,
    categoryId: true,
    hubId: true,
    pricingModel: true,
    unitType: true,
    basePrice: true,
    priceFrom: true,
    durationMinutes: true,
    pickupModel: true,
    maxPartySize: true,
    minPartySize: true,
    bookingCutoffMinutes: true,
    cancellationHours: true,
    h1Override: true,
    breadcrumbLabel: true,
    aggregateRating: true,
    aggregateReviewCount: true,
    isSponsored: true,
    isActive: true,
    publishedAt: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  // ── Internal helpers ──────────────────────────────────────────────────────────

  async findTripOrThrow(id: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      select: { ...this.tripSelect },
    });
    if (!trip) throw new NotFoundException(`Trip ${id} not found`);
    return trip;
  }

  private assertOwnership(
    trip: { operatorId: string },
    requesterId: string,
    requesterRole: Role,
  ) {
    if (requesterRole === Role.ADMIN) return;
    if (trip.operatorId !== requesterId) {
      throw new ForbiddenException('You do not have permission to modify this trip');
    }
  }

  // ── Public list ───────────────────────────────────────────────────────────────

  async findAll(query: TripQueryDto) {
    const { destinationId, categoryId, hubId, pricingModel, minPrice, maxPrice, page = 1, limit = 20 } = query;

    const where: any = { status: TripStatus.LIVE, isActive: true };
    if (destinationId) where.destinationId = destinationId;
    if (categoryId) where.categoryId = categoryId;
    if (hubId) where.hubId = hubId;
    if (pricingModel) where.pricingModel = pricingModel;
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.basePrice = {};
      if (minPrice !== undefined) where.basePrice.gte = minPrice;
      if (maxPrice !== undefined) where.basePrice.lte = maxPrice;
    }

    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      this.prisma.trip.count({ where }),
      this.prisma.trip.findMany({
        where,
        select: {
          ...this.tripSelect,
          images: {
            where: { isHero: true },
            select: { id: true, url: true, altText: true, focalX: true, focalY: true, width: true, height: true },
            take: 1,
          },
        },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { total, page, limit, data };
  }

  // ── Operator "my trips" ───────────────────────────────────────────────────────

  async findMyTrips(operatorId: string, query: MyTripsQueryDto) {
    const { status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { operatorId };
    if (status) where.status = status;

    const [total, data] = await Promise.all([
      this.prisma.trip.count({ where }),
      this.prisma.trip.findMany({
        where,
        select: {
          ...this.tripSelect,
          images: {
            where: { isHero: true },
            select: { id: true, url: true, altText: true },
            take: 1,
          },
          _count: {
            select: { images: true, schedules: true, highlights: true, inclusions: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { total, page, limit, data: data.map((t) => this.flattenCounts(t)) };
  }

  // ── Single trip ───────────────────────────────────────────────────────────────

  private flattenCounts(trip: any) {
    const { _count, images, ...rest } = trip;
    return {
      ...rest,
      heroImage: images?.[0] ?? null,
      imageCount: _count?.images ?? 0,
      scheduleCount: _count?.schedules ?? 0,
      highlightCount: _count?.highlights ?? 0,
      inclusionCount: _count?.inclusions ?? 0,
    };
  }

  async findOne(id: string, requesterId: string | null, requesterRole: Role | null) {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      select: {
        ...this.tripSelect,
        images: {
          where: { isHero: true },
          select: { id: true, url: true, altText: true },
          take: 1,
        },
        _count: {
          select: { images: true, schedules: true, highlights: true, inclusions: true },
        },
      },
    });

    if (!trip) throw new NotFoundException(`Trip ${id} not found`);

    if (trip.status !== TripStatus.LIVE) {
      if (!requesterId) throw new NotFoundException(`Trip ${id} not found`);
      if (requesterRole !== Role.ADMIN && trip.operatorId !== requesterId) {
        throw new ForbiddenException('You do not have permission to view this trip');
      }
    }

    return this.flattenCounts(trip);
  }

  // ── Public slug-based lookup (trip detail page) ───────────────────────────────

  async findBySlug(slug: string, query: TripBySlugQueryDto) {
    const { destinationSlug, hubSlug, locale = Locale.en } = query;

    const trip = await this.prisma.trip.findFirst({
      where: {
        slug,
        status: TripStatus.LIVE,
        isActive: true,
        destination: { slug: destinationSlug },
        // destination-only: hubId must be null; hub-anchored: hub slug must match
        ...(hubSlug ? { hub: { slug: hubSlug } } : { hubId: null }),
      },
      select: {
        ...this.tripSelect,
        images: {
          select: {
            id: true,
            url: true,
            isHero: true,
            altText: true,
            focalX: true,
            focalY: true,
            width: true,
            height: true,
            displayOrder: true,
          },
          orderBy: { displayOrder: 'asc' },
        },
        // Fetch both requested locale and EN so we can fallback without a second query
        translations: {
          where: { locale: { in: [locale, Locale.en] } },
          select: { locale: true, title: true, overview: true, description: true, isMachineTranslated: true },
        },
        highlights: {
          select: {
            id: true,
            displayOrder: true,
            translations: {
              where: { locale: { in: [locale, Locale.en] } },
              select: { locale: true, text: true },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
        inclusions: {
          select: {
            id: true,
            icon: true,
            displayOrder: true,
            translations: {
              where: { locale: { in: [locale, Locale.en] } },
              select: { locale: true, label: true },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
        ageBands: {
          select: {
            id: true,
            bandType: true,
            label: true,
            minAge: true,
            maxAge: true,
            price: true,
            minCount: true,
            maxCount: true,
            displayOrder: true,
          },
          orderBy: { displayOrder: 'asc' },
        },
        addOns: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            unit: true,
            maxQuantity: true,
            displayOrder: true,
          },
          orderBy: { displayOrder: 'asc' },
        },
        languages: {
          select: { id: true, language: true },
          orderBy: { language: 'asc' },
        },
        schedules: {
          where: {
            status: ScheduleStatus.AVAILABLE,
            startDate: { gte: new Date() },
          },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            startTime: true,
            availableSpots: true,
            status: true,
          },
          orderBy: { startDate: 'asc' },
          take: 30,
        },
      },
    });

    if (!trip) throw new NotFoundException('Trip not found');

    // Apply locale → EN fallback for translated child models
    const { translations, highlights, inclusions, languages, ...rest } = trip;

    const resolvedTranslation =
      translations.find((t) => t.locale === locale) ??
      translations.find((t) => t.locale === Locale.en) ??
      null;

    const resolvedHighlights = highlights.map((h) => ({
      id: h.id,
      displayOrder: h.displayOrder,
      text:
        (h.translations.find((t) => t.locale === locale) ??
          h.translations.find((t) => t.locale === Locale.en))?.text ?? '',
    }));

    const resolvedInclusions = inclusions.map((i) => ({
      id: i.id,
      icon: i.icon,
      displayOrder: i.displayOrder,
      label:
        (i.translations.find((t) => t.locale === locale) ??
          i.translations.find((t) => t.locale === Locale.en))?.label ?? '',
    }));

    return {
      ...rest,
      translation: resolvedTranslation,
      highlights: resolvedHighlights,
      inclusions: resolvedInclusions,
      languages: languages.map((l) => l.language),
    };
  }

  // ── Create ────────────────────────────────────────────────────────────────────

  async create(dto: CreateTripDto, operatorId: string) {
    const slug = dto.slug ? generateSlug(dto.slug) : generateSlug(dto.name);

    // Validate destination
    const destination = await this.prisma.destination.findUnique({
      where: { id: dto.destinationId },
      select: { id: true, slug: true, isActive: true },
    });
    if (!destination || !destination.isActive) {
      throw new BadRequestException('Destination not found or is not active');
    }

    // Validate category
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
      select: { id: true, isActive: true },
    });
    if (!category || !category.isActive) {
      throw new BadRequestException('Category not found or is not active');
    }

    return this.prisma.$transaction(async (tx) => {
      // Hub validation inside transaction to prevent TOCTOU race conditions
      if (dto.hubId) {
        const hub = await tx.hub.findUnique({
          where: { id: dto.hubId },
          select: { id: true, destinationId: true, isActive: true },
        });
        if (!hub || !hub.isActive) {
          throw new BadRequestException('Hub not found or is not active');
        }
        if (hub.destinationId !== dto.destinationId) {
          throw new BadRequestException('Hub does not belong to the specified destination');
        }
        const allowed = await tx.hubAllowedCategory.findUnique({
          where: { hubId_categoryId: { hubId: dto.hubId, categoryId: dto.categoryId } },
        });
        if (!allowed) {
          throw new BadRequestException('Category is not allowed in this hub');
        }
      }

      const trip = await tx.trip
        .create({
          data: {
            name: dto.name,
            slug,
            operatorId,
            destinationId: dto.destinationId,
            categoryId: dto.categoryId,
            hubId: dto.hubId ?? null,
            pricingModel: dto.pricingModel,
            unitType: dto.unitType ?? null,
            basePrice: dto.basePrice ?? null,
            durationMinutes: dto.durationMinutes ?? null,
            pickupModel: dto.pickupModel,
            maxPartySize: dto.maxPartySize ?? null,
            minPartySize: dto.minPartySize ?? 1,
            bookingCutoffMinutes: dto.bookingCutoffMinutes ?? 120,
            cancellationHours: dto.cancellationHours ?? 24,
            h1Override: dto.h1Override ?? null,
            breadcrumbLabel: dto.breadcrumbLabel ?? null,
          },
          select: this.tripSelect,
        })
        .catch((err: any) => {
          if (err?.code === 'P2002') {
            throw new ConflictException(`A trip with slug "${slug}" already exists in this destination`);
          }
          throw err;
        });

      // Only destination-only trips get a slug_registry row
      if (!dto.hubId) {
        await tx.slugRegistry
          .create({
            data: {
              destinationSlug: destination.slug,
              slug: trip.slug,
              entityType: SlugEntityType.TOUR,
              entityId: trip.id,
              isActive: true,
            },
          })
          .catch((err: any) => {
            if (err?.code === 'P2002') {
              throw new ConflictException(`Slug "${slug}" is already taken at destination "${destination.slug}"`);
            }
            throw err;
          });
      }

      this.logger.log(`Operator ${operatorId} created trip "${dto.name}" (${trip.id})`);
      return trip;
    });
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateTripDto, requesterId: string, requesterRole: Role) {
    const trip = await this.findTripOrThrow(id);
    this.assertOwnership(trip, requesterId, requesterRole);

    if (trip.status === TripStatus.ARCHIVED) {
      throw new BadRequestException('Cannot update an archived trip');
    }

    const warnings: string[] = [];

    // Phase 4: category change is allowed on LIVE trips with a warning.
    // Phase 5 will add: if (dto.categoryId && trip.status === LIVE && trip.featuredSlot) throw ConflictException
    if (dto.categoryId && dto.categoryId !== trip.categoryId && trip.status === TripStatus.LIVE) {
      warnings.push('Category changed on a LIVE trip. In Phase 5 this will be blocked if a featured slot is held.');
    }

    const updated = await this.prisma.trip.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.pricingModel !== undefined && { pricingModel: dto.pricingModel }),
        ...(dto.unitType !== undefined && { unitType: dto.unitType }),
        ...(dto.basePrice !== undefined && { basePrice: dto.basePrice }),
        ...(dto.durationMinutes !== undefined && { durationMinutes: dto.durationMinutes }),
        ...(dto.pickupModel !== undefined && { pickupModel: dto.pickupModel }),
        ...(dto.maxPartySize !== undefined && { maxPartySize: dto.maxPartySize }),
        ...(dto.minPartySize !== undefined && { minPartySize: dto.minPartySize }),
        ...(dto.bookingCutoffMinutes !== undefined && { bookingCutoffMinutes: dto.bookingCutoffMinutes }),
        ...(dto.cancellationHours !== undefined && { cancellationHours: dto.cancellationHours }),
        ...(dto.h1Override !== undefined && { h1Override: dto.h1Override }),
        ...(dto.breadcrumbLabel !== undefined && { breadcrumbLabel: dto.breadcrumbLabel }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: this.tripSelect,
    });

    this.logger.log(`User ${requesterId} updated trip ${id}`);
    return { trip: updated, warnings };
  }

  // ── Lifecycle transitions ─────────────────────────────────────────────────────

  async publish(id: string, operatorId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      select: {
        ...this.tripSelect,
        images: { select: { id: true, isHero: true } },
        highlights: { select: { id: true } },
        translations: { where: { locale: Locale.en }, select: { overview: true } },
      },
    });
    if (!trip) throw new NotFoundException(`Trip ${id} not found`);
    if (trip.operatorId !== operatorId) {
      throw new ForbiddenException('You do not have permission to publish this trip');
    }
    if (trip.status !== TripStatus.DRAFT) {
      throw new BadRequestException('Trip must be in DRAFT status to publish');
    }

    const errors: string[] = [];
    if (trip.images.length < 5) errors.push('At least 5 images are required to publish');
    if (!trip.images.some((img) => img.isHero)) errors.push('A hero image must be set before publishing');

    const enTranslation = trip.translations[0];
    if (!enTranslation?.overview?.trim()) errors.push('An English overview is required to publish');

    if (trip.highlights.length < 3) errors.push('At least 3 highlights are required to publish');

    if (errors.length > 0) throw new BadRequestException(errors);

    const updated = await this.prisma.trip.update({
      where: { id },
      data: { status: TripStatus.LIVE, publishedAt: new Date() },
      select: this.tripSelect,
    });

    this.logger.log(`Operator ${operatorId} published trip ${id}`);
    return updated;
  }

  async pause(id: string, operatorId: string) {
    const trip = await this.findTripOrThrow(id);
    if (trip.operatorId !== operatorId) {
      throw new ForbiddenException('You do not have permission to pause this trip');
    }
    if (trip.status !== TripStatus.LIVE) {
      throw new BadRequestException('Trip must be LIVE to pause');
    }

    // Phase 5 hook: if trip holds a featured slot → SlotsService.releaseSlot()

    const updated = await this.prisma.trip.update({
      where: { id },
      data: { status: TripStatus.PAUSED },
      select: this.tripSelect,
    });

    this.logger.log(`Operator ${operatorId} paused trip ${id}`);
    return updated;
  }

  async unpause(id: string, operatorId: string) {
    const trip = await this.findTripOrThrow(id);
    if (trip.operatorId !== operatorId) {
      throw new ForbiddenException('You do not have permission to unpause this trip');
    }
    if (trip.status !== TripStatus.PAUSED) {
      throw new BadRequestException('Trip must be PAUSED to unpause');
    }

    const updated = await this.prisma.trip.update({
      where: { id },
      data: { status: TripStatus.LIVE },
      select: this.tripSelect,
    });

    this.logger.log(`Operator ${operatorId} unpaused trip ${id}`);
    return updated;
  }

  async archive(id: string, requesterId: string, requesterRole: Role) {
    const trip = await this.findTripOrThrow(id);
    this.assertOwnership(trip, requesterId, requesterRole);

    if (trip.status === TripStatus.DRAFT) {
      throw new BadRequestException('Cannot archive a draft — delete it instead');
    }
    if (trip.status === TripStatus.ARCHIVED) {
      throw new BadRequestException('Trip is already archived');
    }

    // Phase 5 hook: if trip holds a featured slot → SlotsService.releaseSlot()

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.trip.update({
        where: { id },
        data: { status: TripStatus.ARCHIVED, isActive: false },
        select: this.tripSelect,
      });

      // Deactivate slug_registry row for destination-only trips
      if (!trip.hubId) {
        await tx.slugRegistry.updateMany({
          where: { entityType: SlugEntityType.TOUR, entityId: id },
          data: { isActive: false },
        });
      }

      this.logger.log(`User ${requesterId} archived trip ${id}`);
      return updated;
    });
  }

  async remove(id: string, operatorId: string) {
    const trip = await this.findTripOrThrow(id);
    if (trip.operatorId !== operatorId) {
      throw new ForbiddenException('You do not have permission to delete this trip');
    }
    if (trip.status !== TripStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT trips can be deleted');
    }

    await this.prisma.$transaction(async (tx) => {
      // Delete slug_registry row for destination-only trips
      if (!trip.hubId) {
        await tx.slugRegistry.deleteMany({
          where: { entityType: SlugEntityType.TOUR, entityId: id },
        });
      }
      // Cascade deletes all child models via Prisma schema onDelete: Cascade
      await tx.trip.delete({ where: { id } });
    });

    this.logger.log(`Operator ${operatorId} deleted trip ${id}`);
    return { message: 'Trip deleted successfully' };
  }
}
