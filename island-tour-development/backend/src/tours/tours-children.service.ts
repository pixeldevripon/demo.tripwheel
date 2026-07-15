import { Locale as LocaleEnum } from '@/common/constants/locales';
import { PrismaService } from '@/prisma/prisma.service';
import { ToursService } from './tours.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Locale, PricingModel, Prisma, Role, TourStatus } from '@prisma/client';
import {
  AddTourImageDto,
  AddTourLanguageDto,
  CreatePickupLocationDto,
  CreateTourFeatureDto,
  CreateTourAddOnDto,
  CreateTourAgeBandDto,
  UpdateTourAgeBandDto,
  CreateTourHighlightDto,
  CreateTourInclusionDto,
  CreateTourExclusionDto,
  CreateTourLocationDto,
  UpdatePickupLocationDto,
  UpdateTourAddOnDto,
  UpdateTourFeatureDto,
  UpdateTourHighlightDto,
  UpdateTourImageDto,
  UpdateTourInclusionDto,
  UpdateTourExclusionDto,
  UpdateTourLocationDto,
  UpsertFeatureTranslationDto,
  UpsertHighlightTranslationDto,
  UpsertInclusionTranslationDto,
  UpsertExclusionTranslationDto,
  UpsertLocationTranslationDto,
  UpsertPickupLocationTranslationDto,
  UpsertTourTranslationDto,
} from './dto/tour-children.dto';

@Injectable()
export class TourChildrenService {
  private readonly logger = new Logger(TourChildrenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly toursService: ToursService,
  ) {}

  // ── Common helper ─────────────────────────────────────────────────────────────

  private async assertTourAccess(
    tourId: string,
    requesterId: string,
    requesterRole: Role,
  ) {
    const tour = await this.toursService.findTourOrThrow(tourId);
    await this.toursService.assertOwnership(tour, requesterId, requesterRole);
    return tour;
  }

  // ── Images ────────────────────────────────────────────────────────────────────

  private readonly imageSelect = {
    id: true,
    tourId: true,
    url: true,
    isHero: true,
    focalX: true,
    focalY: true,
    altText: true,
    displayOrder: true,
    width: true,
    height: true,
  } as const;

  async getImages(tourId: string, requesterId: string, requesterRole: Role) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);
    return this.prisma.tourImage.findMany({
      where: { tourId },
      select: this.imageSelect,
      orderBy: { displayOrder: 'asc' },
    });
  }

  async addImage(
    tourId: string,
    dto: AddTourImageDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    if (dto.isHero) {
      return this.prisma.$transaction(async (tx) => {
        await tx.tourImage.updateMany({
          where: { tourId },
          data: { isHero: false },
        });
        const image = await tx.tourImage.create({
          data: {
            tourId,
            url: dto.url,
            isHero: true,
            focalX: dto.focalX ?? 0.5,
            focalY: dto.focalY ?? 0.5,
            altText: dto.altText ?? null,
            displayOrder: dto.displayOrder ?? 0,
            width: dto.width,
            height: dto.height,
          },
          select: this.imageSelect,
        });
        this.logger.log(
          `User ${requesterId} added hero image to tour ${tourId}`,
        );
        return image;
      });
    }

    const image = await this.prisma.tourImage.create({
      data: {
        tourId,
        url: dto.url,
        isHero: false,
        focalX: dto.focalX ?? 0.5,
        focalY: dto.focalY ?? 0.5,
        altText: dto.altText ?? null,
        displayOrder: dto.displayOrder ?? 0,
        width: dto.width,
        height: dto.height,
      },
      select: this.imageSelect,
    });

    this.logger.log(`User ${requesterId} added image to tour ${tourId}`);
    return image;
  }

  async updateImage(
    tourId: string,
    imageId: string,
    dto: UpdateTourImageDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    const existing = await this.prisma.tourImage.findFirst({
      where: { id: imageId, tourId },
      select: { id: true },
    });
    if (!existing)
      throw new NotFoundException(
        `Image ${imageId} not found on tour ${tourId}`,
      );

    if (dto.isHero === true) {
      return this.prisma.$transaction(async (tx) => {
        await tx.tourImage.updateMany({
          where: { tourId },
          data: { isHero: false },
        });
        const updated = await tx.tourImage.update({
          where: { id: imageId },
          data: {
            isHero: true,
            ...(dto.focalX !== undefined && { focalX: dto.focalX }),
            ...(dto.focalY !== undefined && { focalY: dto.focalY }),
            ...(dto.altText !== undefined && { altText: dto.altText }),
            ...(dto.displayOrder !== undefined && {
              displayOrder: dto.displayOrder,
            }),
          },
          select: this.imageSelect,
        });
        this.logger.log(
          `User ${requesterId} set image ${imageId} as hero on tour ${tourId}`,
        );
        return updated;
      });
    }

    const updated = await this.prisma.tourImage.update({
      where: { id: imageId },
      data: {
        ...(dto.isHero !== undefined && { isHero: dto.isHero }),
        ...(dto.focalX !== undefined && { focalX: dto.focalX }),
        ...(dto.focalY !== undefined && { focalY: dto.focalY }),
        ...(dto.altText !== undefined && { altText: dto.altText }),
        ...(dto.displayOrder !== undefined && {
          displayOrder: dto.displayOrder,
        }),
      },
      select: this.imageSelect,
    });

    this.logger.log(
      `User ${requesterId} updated image ${imageId} on tour ${tourId}`,
    );
    return updated;
  }

  async removeImage(
    tourId: string,
    imageId: string,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    const existing = await this.prisma.tourImage.findFirst({
      where: { id: imageId, tourId },
      select: { id: true },
    });
    if (!existing)
      throw new NotFoundException(
        `Image ${imageId} not found on tour ${tourId}`,
      );

    await this.prisma.tourImage.delete({ where: { id: imageId } });
    this.logger.log(
      `User ${requesterId} removed image ${imageId} from tour ${tourId}`,
    );
    return { message: 'Image removed successfully' };
  }

  // ── Add-Ons ───────────────────────────────────────────────────────────────────

  private readonly addOnSelect = {
    id: true,
    tourId: true,
    name: true,
    description: true,
    price: true,
    unit: true,
    maxQuantity: true,
    displayOrder: true,
    isActive: true,
  } as const;

  async getAddOns(tourId: string, requesterId: string, requesterRole: Role) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);
    return this.prisma.tourAddOn.findMany({
      where: { tourId },
      select: this.addOnSelect,
      orderBy: { displayOrder: 'asc' },
    });
  }

  async addAddOn(
    tourId: string,
    dto: CreateTourAddOnDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    const addOn = await this.prisma.tourAddOn.create({
      data: {
        tourId,
        name: dto.name,
        description: dto.description ?? null,
        price: dto.price,
        unit: dto.unit ?? 'PER_PERSON',
        maxQuantity: dto.maxQuantity ?? 1,
        displayOrder: dto.displayOrder ?? 0,
      },
      select: this.addOnSelect,
    });

    this.logger.log(`User ${requesterId} added add-on to tour ${tourId}`);
    return addOn;
  }

  async updateAddOn(
    tourId: string,
    addonId: string,
    dto: UpdateTourAddOnDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    const existing = await this.prisma.tourAddOn.findFirst({
      where: { id: addonId, tourId },
      select: { id: true },
    });
    if (!existing)
      throw new NotFoundException(
        `Add-on ${addonId} not found on tour ${tourId}`,
      );

    const updated = await this.prisma.tourAddOn.update({
      where: { id: addonId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.maxQuantity !== undefined && { maxQuantity: dto.maxQuantity }),
        ...(dto.displayOrder !== undefined && {
          displayOrder: dto.displayOrder,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: this.addOnSelect,
    });

    this.logger.log(
      `User ${requesterId} updated add-on ${addonId} on tour ${tourId}`,
    );
    return updated;
  }

  async removeAddOn(
    tourId: string,
    addonId: string,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    const existing = await this.prisma.tourAddOn.findFirst({
      where: { id: addonId, tourId },
      select: { id: true },
    });
    if (!existing)
      throw new NotFoundException(
        `Add-on ${addonId} not found on tour ${tourId}`,
      );

    await this.prisma.tourAddOn.delete({ where: { id: addonId } });
    this.logger.log(
      `User ${requesterId} removed add-on ${addonId} from tour ${tourId}`,
    );
    return { message: 'Add-on removed successfully' };
  }

  // ── Age Bands ───────────────────────────────────────────────────────────────────

  private readonly ageBandSelect = {
    id: true,
    tourId: true,
    bandType: true,
    participation: true,
    label: true,
    minAge: true,
    maxAge: true,
    price: true,
    priceOriginal: true,
    priceNet: true,
    isDefault: true,
    displayOrder: true,
  } as const;

  /** Rejects an age range where the upper bound sits below the lower bound. */
  private assertValidAgeRange(minAge?: number | null, maxAge?: number | null) {
    if (minAge != null && maxAge != null && maxAge < minAge) {
      throw new BadRequestException(
        'maxAge must be greater than or equal to minAge',
      );
    }
  }

  /**
   * Age bands are a PER_PERSON pricing construct. Unit-priced (whole-unit /
   * charter) tours use a single guests count and are priced by the unit formula,
   * so they must not carry age bands.
   */
  private async assertNotUnitPriced(tourId: string) {
    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      select: { pricingModel: true },
    });
    if (tour?.pricingModel === PricingModel.UNIT) {
      throw new BadRequestException(
        'Unit-priced tours use a single guests count and do not have age bands. ' +
          'Set the base price, included guests, and extra-person price in the Pricing tab.',
      );
    }
  }

  async getAgeBands(tourId: string, requesterId: string, requesterRole: Role) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);
    return this.prisma.tourAgeBand.findMany({
      where: { tourId },
      select: this.ageBandSelect,
      orderBy: [{ isDefault: 'desc' }, { displayOrder: 'asc' }],
    });
  }

  async addAgeBand(
    tourId: string,
    dto: CreateTourAgeBandDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);
    await this.assertNotUnitPriced(tourId);
    this.assertValidAgeRange(dto.minAge, dto.maxAge);

    const band = await this.prisma.$transaction(async (tx) => {
      // Only one default band per tour - clear the others when this one claims it.
      if (dto.isDefault) {
        await tx.tourAgeBand.updateMany({
          where: { tourId },
          data: { isDefault: false },
        });
      }
      const created = await tx.tourAgeBand.create({
        data: {
          tourId,
          bandType: dto.bandType,
          participation: dto.participation ?? 'PARTICIPANT',
          label: dto.label,
          minAge: dto.minAge ?? null,
          maxAge: dto.maxAge ?? null,
          price: dto.price,
          priceOriginal: dto.priceOriginal ?? null,
          priceNet: dto.priceNet ?? null,
          isDefault: dto.isDefault ?? false,
          displayOrder: dto.displayOrder ?? 0,
        },
        select: this.ageBandSelect,
      });
      // priceFrom now anchors off the cheapest band - recompute inside the same tx.
      await this.toursService.recomputePriceFrom(tourId, tx);
      return created;
    });

    this.logger.log(
      `User ${requesterId} added age band ${band.id} to tour ${tourId}`,
    );
    return band;
  }

  async updateAgeBand(
    tourId: string,
    ageBandId: string,
    dto: UpdateTourAgeBandDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    const existing = await this.prisma.tourAgeBand.findFirst({
      where: { id: ageBandId, tourId },
      select: { id: true, minAge: true, maxAge: true },
    });
    if (!existing)
      throw new NotFoundException(
        `Age band ${ageBandId} not found on tour ${tourId}`,
      );

    // Validate the resulting range (incoming value, or the stored one when omitted).
    this.assertValidAgeRange(
      dto.minAge !== undefined ? dto.minAge : existing.minAge,
      dto.maxAge !== undefined ? dto.maxAge : existing.maxAge,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.tourAgeBand.updateMany({
          where: { tourId },
          data: { isDefault: false },
        });
      }
      const band = await tx.tourAgeBand.update({
        where: { id: ageBandId },
        data: {
          ...(dto.label !== undefined && { label: dto.label }),
          ...(dto.bandType !== undefined && { bandType: dto.bandType }),
          ...(dto.participation !== undefined && {
            participation: dto.participation,
          }),
          ...(dto.minAge !== undefined && { minAge: dto.minAge }),
          ...(dto.maxAge !== undefined && { maxAge: dto.maxAge }),
          ...(dto.price !== undefined && { price: dto.price }),
          ...(dto.priceOriginal !== undefined && {
            priceOriginal: dto.priceOriginal,
          }),
          ...(dto.priceNet !== undefined && { priceNet: dto.priceNet }),
          ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
          ...(dto.displayOrder !== undefined && {
            displayOrder: dto.displayOrder,
          }),
        },
        select: this.ageBandSelect,
      });
      await this.toursService.recomputePriceFrom(tourId, tx);
      return band;
    });

    this.logger.log(
      `User ${requesterId} updated age band ${ageBandId} on tour ${tourId}`,
    );
    return updated;
  }

  async removeAgeBand(
    tourId: string,
    ageBandId: string,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    const existing = await this.prisma.tourAgeBand.findFirst({
      where: { id: ageBandId, tourId },
      select: { id: true },
    });
    if (!existing)
      throw new NotFoundException(
        `Age band ${ageBandId} not found on tour ${tourId}`,
      );

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.tourAgeBand.delete({ where: { id: ageBandId } });
        await this.toursService.recomputePriceFrom(tourId, tx);
      });
    } catch (err) {
      // FK restrict: a booking line item was sold at this band - keep it for history.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2003'
      ) {
        throw new ConflictException(
          'This age band cannot be deleted because it is referenced by existing bookings. Mark it inactive instead.',
        );
      }
      throw err;
    }

    this.logger.log(
      `User ${requesterId} removed age band ${ageBandId} from tour ${tourId}`,
    );
    return { message: 'Age band removed successfully' };
  }

  // ── Languages ─────────────────────────────────────────────────────────────────

  async getLanguages(tourId: string, requesterId: string, requesterRole: Role) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);
    return this.prisma.tourLanguage.findMany({
      where: { tourId },
      select: { id: true, tourId: true, language: true },
      orderBy: { language: 'asc' },
    });
  }

  async addLanguage(
    tourId: string,
    dto: AddTourLanguageDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    const lang = await this.prisma.tourLanguage
      .create({
        data: { tourId, language: dto.language },
        select: { id: true, tourId: true, language: true },
      })
      .catch((err: any) => {
        if (err?.code === 'P2002') {
          throw new ConflictException(
            `Language "${dto.language}" already added to this tour`,
          );
        }
        throw err;
      });

    this.logger.log(
      `User ${requesterId} added language "${dto.language}" to tour ${tourId}`,
    );
    return lang;
  }

  async removeLanguage(
    tourId: string,
    languageId: string,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    const existing = await this.prisma.tourLanguage.findFirst({
      where: { id: languageId, tourId },
      select: { id: true, language: true },
    });
    if (!existing)
      throw new NotFoundException(
        `Language ${languageId} not found on tour ${tourId}`,
      );

    await this.prisma.tourLanguage.delete({ where: { id: languageId } });
    this.logger.log(
      `User ${requesterId} removed language ${languageId} from tour ${tourId}`,
    );
    return { message: 'Language removed successfully' };
  }

  // ── Highlights ────────────────────────────────────────────────────────────────

  private readonly highlightSelect = {
    id: true,
    tourId: true,
    displayOrder: true,
    imageUrl: true,
    translations: {
      select: { locale: true, text: true, isMachineTranslated: true },
    },
  } as const;

  async getHighlights(
    tourId: string,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);
    return this.prisma.tourHighlight.findMany({
      where: { tourId },
      select: this.highlightSelect,
      orderBy: { displayOrder: 'asc' },
    });
  }

  async addHighlight(
    tourId: string,
    dto: CreateTourHighlightDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    const result = await this.prisma.$transaction(async (tx) => {
      const highlight = await tx.tourHighlight.create({
        data: {
          tourId,
          displayOrder: dto.displayOrder ?? 0,
          imageUrl: dto.imageUrl ?? null,
        },
        select: { id: true, tourId: true, displayOrder: true, imageUrl: true },
      });
      await tx.tourHighlightTranslation.create({
        data: {
          highlightId: highlight.id,
          locale: LocaleEnum.en,
          text: dto.text,
        },
      });
      return tx.tourHighlight.findUnique({
        where: { id: highlight.id },
        select: this.highlightSelect,
      });
    });

    this.logger.log(`User ${requesterId} added highlight to tour ${tourId}`);
    return result;
  }

  async updateHighlight(
    tourId: string,
    highlightId: string,
    dto: UpdateTourHighlightDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    const existing = await this.prisma.tourHighlight.findFirst({
      where: { id: highlightId, tourId },
      select: { id: true },
    });
    if (!existing)
      throw new NotFoundException(
        `Highlight ${highlightId} not found on tour ${tourId}`,
      );

    const updated = await this.prisma.tourHighlight.update({
      where: { id: highlightId },
      data: {
        ...(dto.displayOrder !== undefined && {
          displayOrder: dto.displayOrder,
        }),
        ...('imageUrl' in dto && { imageUrl: dto.imageUrl ?? null }),
      },
      select: this.highlightSelect,
    });

    this.logger.log(
      `User ${requesterId} updated highlight ${highlightId} on tour ${tourId}`,
    );
    return updated;
  }

  async removeHighlight(
    tourId: string,
    highlightId: string,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    const existing = await this.prisma.tourHighlight.findFirst({
      where: { id: highlightId, tourId },
      select: { id: true },
    });
    if (!existing)
      throw new NotFoundException(
        `Highlight ${highlightId} not found on tour ${tourId}`,
      );

    await this.prisma.tourHighlight.delete({ where: { id: highlightId } });
    this.logger.log(
      `User ${requesterId} removed highlight ${highlightId} from tour ${tourId}`,
    );
    return { message: 'Highlight removed successfully' };
  }

  async upsertHighlightTranslation(
    tourId: string,
    highlightId: string,
    locale: Locale,
    dto: UpsertHighlightTranslationDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    const highlight = await this.prisma.tourHighlight.findFirst({
      where: { id: highlightId, tourId },
      select: { id: true },
    });
    if (!highlight)
      throw new NotFoundException(
        `Highlight ${highlightId} not found on tour ${tourId}`,
      );

    const result = await this.prisma.tourHighlightTranslation.upsert({
      where: { highlightId_locale: { highlightId, locale } },
      create: {
        highlightId,
        locale,
        text: dto.text,
        isMachineTranslated: dto.isMachineTranslated ?? false,
      },
      update: {
        text: dto.text,
        isMachineTranslated: dto.isMachineTranslated ?? false,
      },
      select: { locale: true, text: true, isMachineTranslated: true },
    });

    this.logger.log(
      `User ${requesterId} upserted highlight translation [${locale}] for highlight ${highlightId}`,
    );
    return result;
  }

  async deleteHighlightTranslation(
    tourId: string,
    highlightId: string,
    locale: Locale,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    if (locale === Locale.en) {
      throw new BadRequestException(
        'English highlight text cannot be deleted. Update the text instead.',
      );
    }

    const highlight = await this.prisma.tourHighlight.findFirst({
      where: { id: highlightId, tourId },
      select: { id: true },
    });
    if (!highlight)
      throw new NotFoundException(
        `Highlight ${highlightId} not found on tour ${tourId}`,
      );

    await this.prisma.tourHighlightTranslation
      .delete({ where: { highlightId_locale: { highlightId, locale } } })
      .catch((err: any) => {
        if (err?.code === 'P2025') {
          throw new NotFoundException(
            `No translation found for locale "${locale}"`,
          );
        }
        throw err;
      });

    this.logger.log(
      `User ${requesterId} deleted highlight translation [${locale}] for highlight ${highlightId}`,
    );
    return { message: `Translation for locale "${locale}" deleted` };
  }

  // ── Inclusions ────────────────────────────────────────────────────────────────

  private readonly inclusionSelect = {
    id: true,
    tourId: true,
    icon: true,
    displayOrder: true,
    imageUrl: true,
    translations: {
      select: { locale: true, label: true, isMachineTranslated: true },
    },
  } as const;

  async getInclusions(
    tourId: string,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);
    return this.prisma.tourInclusion.findMany({
      where: { tourId },
      select: this.inclusionSelect,
      orderBy: { displayOrder: 'asc' },
    });
  }

  async addInclusion(
    tourId: string,
    dto: CreateTourInclusionDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    const result = await this.prisma.$transaction(async (tx) => {
      const inclusion = await tx.tourInclusion.create({
        data: {
          tourId,
          icon: dto.icon ?? 'check',
          displayOrder: dto.displayOrder ?? 0,
          imageUrl: dto.imageUrl ?? null,
        },
        select: { id: true },
      });
      await tx.tourInclusionTranslation.create({
        data: {
          inclusionId: inclusion.id,
          locale: LocaleEnum.en,
          label: dto.label,
        },
      });
      return tx.tourInclusion.findUnique({
        where: { id: inclusion.id },
        select: this.inclusionSelect,
      });
    });

    this.logger.log(`User ${requesterId} added inclusion to tour ${tourId}`);
    return result;
  }

  async updateInclusion(
    tourId: string,
    inclusionId: string,
    dto: UpdateTourInclusionDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    const existing = await this.prisma.tourInclusion.findFirst({
      where: { id: inclusionId, tourId },
      select: { id: true },
    });
    if (!existing)
      throw new NotFoundException(
        `Inclusion ${inclusionId} not found on tour ${tourId}`,
      );

    const updated = await this.prisma.tourInclusion.update({
      where: { id: inclusionId },
      data: {
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.displayOrder !== undefined && {
          displayOrder: dto.displayOrder,
        }),
        ...('imageUrl' in dto && { imageUrl: dto.imageUrl ?? null }),
      },
      select: this.inclusionSelect,
    });

    this.logger.log(
      `User ${requesterId} updated inclusion ${inclusionId} on tour ${tourId}`,
    );
    return updated;
  }

  async removeInclusion(
    tourId: string,
    inclusionId: string,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    const existing = await this.prisma.tourInclusion.findFirst({
      where: { id: inclusionId, tourId },
      select: { id: true },
    });
    if (!existing)
      throw new NotFoundException(
        `Inclusion ${inclusionId} not found on tour ${tourId}`,
      );

    await this.prisma.tourInclusion.delete({ where: { id: inclusionId } });
    this.logger.log(
      `User ${requesterId} removed inclusion ${inclusionId} from tour ${tourId}`,
    );
    return { message: 'Inclusion removed successfully' };
  }

  async upsertInclusionTranslation(
    tourId: string,
    inclusionId: string,
    locale: Locale,
    dto: UpsertInclusionTranslationDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    const inclusion = await this.prisma.tourInclusion.findFirst({
      where: { id: inclusionId, tourId },
      select: { id: true },
    });
    if (!inclusion)
      throw new NotFoundException(
        `Inclusion ${inclusionId} not found on tour ${tourId}`,
      );

    const result = await this.prisma.tourInclusionTranslation.upsert({
      where: { inclusionId_locale: { inclusionId, locale } },
      create: {
        inclusionId,
        locale,
        label: dto.label,
        isMachineTranslated: dto.isMachineTranslated ?? false,
      },
      update: {
        label: dto.label,
        isMachineTranslated: dto.isMachineTranslated ?? false,
      },
      select: { locale: true, label: true, isMachineTranslated: true },
    });

    this.logger.log(
      `User ${requesterId} upserted inclusion translation [${locale}] for inclusion ${inclusionId}`,
    );
    return result;
  }

  async deleteInclusionTranslation(
    tourId: string,
    inclusionId: string,
    locale: Locale,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    if (locale === Locale.en) {
      throw new BadRequestException(
        'English inclusion text cannot be deleted. Update the label instead.',
      );
    }

    const inclusion = await this.prisma.tourInclusion.findFirst({
      where: { id: inclusionId, tourId },
      select: { id: true },
    });
    if (!inclusion)
      throw new NotFoundException(
        `Inclusion ${inclusionId} not found on tour ${tourId}`,
      );

    await this.prisma.tourInclusionTranslation
      .delete({ where: { inclusionId_locale: { inclusionId, locale } } })
      .catch((err: any) => {
        if (err?.code === 'P2025') {
          throw new NotFoundException(
            `No translation found for locale "${locale}"`,
          );
        }
        throw err;
      });

    this.logger.log(
      `User ${requesterId} deleted inclusion translation [${locale}] for inclusion ${inclusionId}`,
    );
    return { message: `Translation for locale "${locale}" deleted` };
  }

  // ── Exclusions ────────────────────────────────────────────────────────────────

  private readonly exclusionSelect = {
    id: true,
    tourId: true,
    icon: true,
    type: true,
    priceText: true,
    displayOrder: true,
    imageUrl: true,
    translations: {
      select: { locale: true, label: true, isMachineTranslated: true },
    },
  } as const;

  async getExclusions(
    tourId: string,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);
    return this.prisma.tourExclusion.findMany({
      where: { tourId },
      select: this.exclusionSelect,
      orderBy: { displayOrder: 'asc' },
    });
  }

  async addExclusion(
    tourId: string,
    dto: CreateTourExclusionDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    const result = await this.prisma.$transaction(async (tx) => {
      const exclusion = await tx.tourExclusion.create({
        data: {
          tourId,
          icon: dto.icon ?? 'x',
          type: dto.type ?? null,
          priceText: dto.priceText ?? null,
          displayOrder: dto.displayOrder ?? 0,
          imageUrl: dto.imageUrl ?? null,
        },
        select: { id: true },
      });
      await tx.tourExclusionTranslation.create({
        data: {
          exclusionId: exclusion.id,
          locale: LocaleEnum.en,
          label: dto.label,
        },
      });
      return tx.tourExclusion.findUnique({
        where: { id: exclusion.id },
        select: this.exclusionSelect,
      });
    });

    this.logger.log(`User ${requesterId} added exclusion to tour ${tourId}`);
    return result;
  }

  async updateExclusion(
    tourId: string,
    exclusionId: string,
    dto: UpdateTourExclusionDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    const existing = await this.prisma.tourExclusion.findFirst({
      where: { id: exclusionId, tourId },
      select: { id: true },
    });
    if (!existing)
      throw new NotFoundException(
        `Exclusion ${exclusionId} not found on tour ${tourId}`,
      );

    const updated = await this.prisma.tourExclusion.update({
      where: { id: exclusionId },
      data: {
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...('priceText' in dto && { priceText: dto.priceText ?? null }),
        ...(dto.displayOrder !== undefined && {
          displayOrder: dto.displayOrder,
        }),
        ...('imageUrl' in dto && { imageUrl: dto.imageUrl ?? null }),
      },
      select: this.exclusionSelect,
    });

    this.logger.log(
      `User ${requesterId} updated exclusion ${exclusionId} on tour ${tourId}`,
    );
    return updated;
  }

  async removeExclusion(
    tourId: string,
    exclusionId: string,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    const existing = await this.prisma.tourExclusion.findFirst({
      where: { id: exclusionId, tourId },
      select: { id: true },
    });
    if (!existing)
      throw new NotFoundException(
        `Exclusion ${exclusionId} not found on tour ${tourId}`,
      );

    await this.prisma.tourExclusion.delete({ where: { id: exclusionId } });
    this.logger.log(
      `User ${requesterId} removed exclusion ${exclusionId} from tour ${tourId}`,
    );
    return { message: 'Exclusion removed successfully' };
  }

  async upsertExclusionTranslation(
    tourId: string,
    exclusionId: string,
    locale: Locale,
    dto: UpsertExclusionTranslationDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    const exclusion = await this.prisma.tourExclusion.findFirst({
      where: { id: exclusionId, tourId },
      select: { id: true },
    });
    if (!exclusion)
      throw new NotFoundException(
        `Exclusion ${exclusionId} not found on tour ${tourId}`,
      );

    const result = await this.prisma.tourExclusionTranslation.upsert({
      where: { exclusionId_locale: { exclusionId, locale } },
      create: {
        exclusionId,
        locale,
        label: dto.label,
        isMachineTranslated: dto.isMachineTranslated ?? false,
      },
      update: {
        label: dto.label,
        isMachineTranslated: dto.isMachineTranslated ?? false,
      },
      select: { locale: true, label: true, isMachineTranslated: true },
    });

    this.logger.log(
      `User ${requesterId} upserted exclusion translation [${locale}] for exclusion ${exclusionId}`,
    );
    return result;
  }

  async deleteExclusionTranslation(
    tourId: string,
    exclusionId: string,
    locale: Locale,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    if (locale === Locale.en) {
      throw new BadRequestException(
        'English exclusion text cannot be deleted. Update the label instead.',
      );
    }

    const exclusion = await this.prisma.tourExclusion.findFirst({
      where: { id: exclusionId, tourId },
      select: { id: true },
    });
    if (!exclusion)
      throw new NotFoundException(
        `Exclusion ${exclusionId} not found on tour ${tourId}`,
      );

    await this.prisma.tourExclusionTranslation
      .delete({ where: { exclusionId_locale: { exclusionId, locale } } })
      .catch((err: any) => {
        if (err?.code === 'P2025') {
          throw new NotFoundException(
            `No translation found for locale "${locale}"`,
          );
        }
        throw err;
      });

    this.logger.log(
      `User ${requesterId} deleted exclusion translation [${locale}] for exclusion ${exclusionId}`,
    );
    return { message: `Translation for locale "${locale}" deleted` };
  }

  // ── Features ────────────────────────────────────────────────────────────────

  private readonly featureSelect = {
    id: true,
    tourId: true,
    type: true,
    displayOrder: true,
    translations: {
      select: { locale: true, text: true, isMachineTranslated: true },
    },
  } as const;

  async getFeatures(tourId: string, requesterId: string, requesterRole: Role) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);
    return this.prisma.tourFeature.findMany({
      where: { tourId },
      select: this.featureSelect,
      orderBy: [{ type: 'asc' }, { displayOrder: 'asc' }],
    });
  }

  async addFeature(
    tourId: string,
    dto: CreateTourFeatureDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);
    const result = await this.prisma.$transaction(async (tx) => {
      const feature = await tx.tourFeature.create({
        data: { tourId, type: dto.type, displayOrder: dto.displayOrder ?? 0 },
        select: { id: true },
      });
      await tx.tourFeatureTranslation.create({
        data: { featureId: feature.id, locale: LocaleEnum.en, text: dto.text },
      });
      return tx.tourFeature.findUnique({
        where: { id: feature.id },
        select: this.featureSelect,
      });
    });
    this.logger.log(`User ${requesterId} added feature to tour ${tourId}`);
    return result;
  }

  async updateFeature(
    tourId: string,
    featureId: string,
    dto: UpdateTourFeatureDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);
    const existing = await this.prisma.tourFeature.findFirst({
      where: { id: featureId, tourId },
      select: { id: true },
    });
    if (!existing)
      throw new NotFoundException(
        `Feature ${featureId} not found on tour ${tourId}`,
      );
    const updated = await this.prisma.tourFeature.update({
      where: { id: featureId },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.displayOrder !== undefined && {
          displayOrder: dto.displayOrder,
        }),
      },
      select: this.featureSelect,
    });
    this.logger.log(
      `User ${requesterId} updated feature ${featureId} on tour ${tourId}`,
    );
    return updated;
  }

  async removeFeature(
    tourId: string,
    featureId: string,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);
    const existing = await this.prisma.tourFeature.findFirst({
      where: { id: featureId, tourId },
      select: { id: true },
    });
    if (!existing)
      throw new NotFoundException(
        `Feature ${featureId} not found on tour ${tourId}`,
      );
    await this.prisma.tourFeature.delete({ where: { id: featureId } });
    this.logger.log(
      `User ${requesterId} removed feature ${featureId} from tour ${tourId}`,
    );
    return { message: 'Feature removed successfully' };
  }

  async upsertFeatureTranslation(
    tourId: string,
    featureId: string,
    locale: Locale,
    dto: UpsertFeatureTranslationDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);
    const feature = await this.prisma.tourFeature.findFirst({
      where: { id: featureId, tourId },
      select: { id: true },
    });
    if (!feature)
      throw new NotFoundException(
        `Feature ${featureId} not found on tour ${tourId}`,
      );
    const result = await this.prisma.tourFeatureTranslation.upsert({
      where: { featureId_locale: { featureId, locale } },
      create: {
        featureId,
        locale,
        text: dto.text,
        isMachineTranslated: dto.isMachineTranslated ?? false,
      },
      update: {
        text: dto.text,
        isMachineTranslated: dto.isMachineTranslated ?? false,
      },
      select: { locale: true, text: true, isMachineTranslated: true },
    });
    this.logger.log(
      `User ${requesterId} upserted feature translation [${locale}] for feature ${featureId}`,
    );
    return result;
  }

  async deleteFeatureTranslation(
    tourId: string,
    featureId: string,
    locale: Locale,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);
    if (locale === Locale.en)
      throw new BadRequestException(
        'English feature text cannot be deleted. Update the text instead.',
      );
    const feature = await this.prisma.tourFeature.findFirst({
      where: { id: featureId, tourId },
      select: { id: true },
    });
    if (!feature)
      throw new NotFoundException(
        `Feature ${featureId} not found on tour ${tourId}`,
      );
    await this.prisma.tourFeatureTranslation
      .delete({ where: { featureId_locale: { featureId, locale } } })
      .catch((err: any) => {
        if (err?.code === 'P2025')
          throw new NotFoundException(
            `No translation found for locale "${locale}"`,
          );
        throw err;
      });
    this.logger.log(
      `User ${requesterId} deleted feature translation [${locale}] for feature ${featureId}`,
    );
    return { message: `Translation for locale "${locale}" deleted` };
  }

  // ── Locations ───────────────────────────────────────────────────────────────

  private readonly locationSelect = {
    id: true,
    tourId: true,
    types: true,
    latitude: true,
    longitude: true,
    streetAddress: true,
    addressLocality: true,
    addressRegion: true,
    postalCode: true,
    addressCountry: true,
    minutesTo: true,
    minutesAt: true,
    displayOrder: true,
    translations: {
      select: {
        locale: true,
        title: true,
        shortDescription: true,
        isMachineTranslated: true,
      },
    },
  } as const;

  async getLocations(tourId: string, requesterId: string, requesterRole: Role) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);
    return this.prisma.tourLocation.findMany({
      where: { tourId },
      select: this.locationSelect,
      orderBy: { displayOrder: 'asc' },
    });
  }

  async addLocation(
    tourId: string,
    dto: CreateTourLocationDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);
    const result = await this.prisma.$transaction(async (tx) => {
      const location = await tx.tourLocation.create({
        data: {
          tourId,
          types: dto.types,
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          streetAddress: dto.streetAddress ?? null,
          addressLocality: dto.addressLocality ?? null,
          addressRegion: dto.addressRegion ?? null,
          postalCode: dto.postalCode ?? null,
          addressCountry: dto.addressCountry ?? null,
          minutesTo: dto.minutesTo ?? null,
          minutesAt: dto.minutesAt ?? null,
          displayOrder: dto.displayOrder ?? 0,
        },
        select: { id: true },
      });
      await tx.tourLocationTranslation.create({
        data: {
          locationId: location.id,
          locale: LocaleEnum.en,
          title: dto.title,
          shortDescription: dto.shortDescription ?? null,
        },
      });
      return tx.tourLocation.findUnique({
        where: { id: location.id },
        select: this.locationSelect,
      });
    });
    this.logger.log(`User ${requesterId} added location to tour ${tourId}`);
    return result;
  }

  async updateLocation(
    tourId: string,
    locationId: string,
    dto: UpdateTourLocationDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);
    const existing = await this.prisma.tourLocation.findFirst({
      where: { id: locationId, tourId },
      select: { id: true },
    });
    if (!existing)
      throw new NotFoundException(
        `Location ${locationId} not found on tour ${tourId}`,
      );
    const updated = await this.prisma.tourLocation.update({
      where: { id: locationId },
      data: {
        ...(dto.types !== undefined && { types: dto.types }),
        ...('latitude' in dto && { latitude: dto.latitude ?? null }),
        ...('longitude' in dto && { longitude: dto.longitude ?? null }),
        ...('streetAddress' in dto && {
          streetAddress: dto.streetAddress ?? null,
        }),
        ...('addressLocality' in dto && {
          addressLocality: dto.addressLocality ?? null,
        }),
        ...('addressRegion' in dto && {
          addressRegion: dto.addressRegion ?? null,
        }),
        ...('postalCode' in dto && { postalCode: dto.postalCode ?? null }),
        ...('addressCountry' in dto && {
          addressCountry: dto.addressCountry ?? null,
        }),
        ...('minutesTo' in dto && { minutesTo: dto.minutesTo ?? null }),
        ...('minutesAt' in dto && { minutesAt: dto.minutesAt ?? null }),
        ...(dto.displayOrder !== undefined && {
          displayOrder: dto.displayOrder,
        }),
      },
      select: this.locationSelect,
    });
    this.logger.log(
      `User ${requesterId} updated location ${locationId} on tour ${tourId}`,
    );
    return updated;
  }

  async removeLocation(
    tourId: string,
    locationId: string,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);
    const existing = await this.prisma.tourLocation.findFirst({
      where: { id: locationId, tourId },
      select: { id: true },
    });
    if (!existing)
      throw new NotFoundException(
        `Location ${locationId} not found on tour ${tourId}`,
      );
    await this.prisma.tourLocation.delete({ where: { id: locationId } });
    this.logger.log(
      `User ${requesterId} removed location ${locationId} from tour ${tourId}`,
    );
    return { message: 'Location removed successfully' };
  }

  async upsertLocationTranslation(
    tourId: string,
    locationId: string,
    locale: Locale,
    dto: UpsertLocationTranslationDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);
    const location = await this.prisma.tourLocation.findFirst({
      where: { id: locationId, tourId },
      select: { id: true },
    });
    if (!location)
      throw new NotFoundException(
        `Location ${locationId} not found on tour ${tourId}`,
      );
    const result = await this.prisma.tourLocationTranslation.upsert({
      where: { locationId_locale: { locationId, locale } },
      create: {
        locationId,
        locale,
        title: dto.title,
        shortDescription: dto.shortDescription ?? null,
        isMachineTranslated: dto.isMachineTranslated ?? false,
      },
      update: {
        title: dto.title,
        shortDescription: dto.shortDescription ?? null,
        isMachineTranslated: dto.isMachineTranslated ?? false,
      },
      select: {
        locale: true,
        title: true,
        shortDescription: true,
        isMachineTranslated: true,
      },
    });
    this.logger.log(
      `User ${requesterId} upserted location translation [${locale}] for location ${locationId}`,
    );
    return result;
  }

  async deleteLocationTranslation(
    tourId: string,
    locationId: string,
    locale: Locale,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);
    if (locale === Locale.en)
      throw new BadRequestException(
        'English location text cannot be deleted. Update the text instead.',
      );
    const location = await this.prisma.tourLocation.findFirst({
      where: { id: locationId, tourId },
      select: { id: true },
    });
    if (!location)
      throw new NotFoundException(
        `Location ${locationId} not found on tour ${tourId}`,
      );
    await this.prisma.tourLocationTranslation
      .delete({ where: { locationId_locale: { locationId, locale } } })
      .catch((err: any) => {
        if (err?.code === 'P2025')
          throw new NotFoundException(
            `No translation found for locale "${locale}"`,
          );
        throw err;
      });
    this.logger.log(
      `User ${requesterId} deleted location translation [${locale}] for location ${locationId}`,
    );
    return { message: `Translation for locale "${locale}" deleted` };
  }

  // ── Pickup Locations ────────────────────────────────────────────────────────

  private readonly pickupLocationSelect = {
    id: true,
    tourId: true,
    name: true,
    latitude: true,
    longitude: true,
    address: true,
    minutesPrior: true,
    windowStart: true,
    windowEnd: true,
    displayOrder: true,
    isActive: true,
    translations: {
      select: {
        locale: true,
        title: true,
        directions: true,
        isMachineTranslated: true,
      },
    },
  } as const;

  async getPickupLocations(
    tourId: string,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);
    return this.prisma.pickupLocation.findMany({
      where: { tourId },
      select: this.pickupLocationSelect,
      orderBy: { displayOrder: 'asc' },
    });
  }

  async addPickupLocation(
    tourId: string,
    dto: CreatePickupLocationDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);
    const result = await this.prisma.$transaction(async (tx) => {
      const pickup = await tx.pickupLocation.create({
        data: {
          tourId,
          name: dto.name,
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          address: dto.address ?? null,
          minutesPrior: dto.minutesPrior ?? null,
          windowStart: dto.windowStart ?? null,
          windowEnd: dto.windowEnd ?? null,
          displayOrder: dto.displayOrder ?? 0,
        },
        select: { id: true },
      });
      await tx.pickupLocationTranslation.create({
        data: {
          pickupLocationId: pickup.id,
          locale: LocaleEnum.en,
          title: dto.title ?? dto.name,
          directions: dto.directions ?? null,
        },
      });
      return tx.pickupLocation.findUnique({
        where: { id: pickup.id },
        select: this.pickupLocationSelect,
      });
    });
    this.logger.log(
      `User ${requesterId} added pickup location to tour ${tourId}`,
    );
    return result;
  }

  async updatePickupLocation(
    tourId: string,
    pickupLocationId: string,
    dto: UpdatePickupLocationDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);
    const existing = await this.prisma.pickupLocation.findFirst({
      where: { id: pickupLocationId, tourId },
      select: { id: true },
    });
    if (!existing)
      throw new NotFoundException(
        `Pickup location ${pickupLocationId} not found on tour ${tourId}`,
      );
    const updated = await this.prisma.pickupLocation.update({
      where: { id: pickupLocationId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...('latitude' in dto && { latitude: dto.latitude ?? null }),
        ...('longitude' in dto && { longitude: dto.longitude ?? null }),
        ...('address' in dto && { address: dto.address ?? null }),
        ...('minutesPrior' in dto && {
          minutesPrior: dto.minutesPrior ?? null,
        }),
        ...('windowStart' in dto && { windowStart: dto.windowStart ?? null }),
        ...('windowEnd' in dto && { windowEnd: dto.windowEnd ?? null }),
        ...(dto.displayOrder !== undefined && {
          displayOrder: dto.displayOrder,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: this.pickupLocationSelect,
    });
    this.logger.log(
      `User ${requesterId} updated pickup location ${pickupLocationId} on tour ${tourId}`,
    );
    return updated;
  }

  async removePickupLocation(
    tourId: string,
    pickupLocationId: string,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);
    const existing = await this.prisma.pickupLocation.findFirst({
      where: { id: pickupLocationId, tourId },
      select: { id: true },
    });
    if (!existing)
      throw new NotFoundException(
        `Pickup location ${pickupLocationId} not found on tour ${tourId}`,
      );
    await this.prisma.pickupLocation.delete({
      where: { id: pickupLocationId },
    });
    this.logger.log(
      `User ${requesterId} removed pickup location ${pickupLocationId} from tour ${tourId}`,
    );
    return { message: 'Pickup location removed successfully' };
  }

  async upsertPickupLocationTranslation(
    tourId: string,
    pickupLocationId: string,
    locale: Locale,
    dto: UpsertPickupLocationTranslationDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);
    const pickup = await this.prisma.pickupLocation.findFirst({
      where: { id: pickupLocationId, tourId },
      select: { id: true },
    });
    if (!pickup)
      throw new NotFoundException(
        `Pickup location ${pickupLocationId} not found on tour ${tourId}`,
      );
    const result = await this.prisma.pickupLocationTranslation.upsert({
      where: { pickupLocationId_locale: { pickupLocationId, locale } },
      create: {
        pickupLocationId,
        locale,
        title: dto.title,
        directions: dto.directions ?? null,
        isMachineTranslated: dto.isMachineTranslated ?? false,
      },
      update: {
        title: dto.title,
        directions: dto.directions ?? null,
        isMachineTranslated: dto.isMachineTranslated ?? false,
      },
      select: {
        locale: true,
        title: true,
        directions: true,
        isMachineTranslated: true,
      },
    });
    this.logger.log(
      `User ${requesterId} upserted pickup translation [${locale}] for pickup ${pickupLocationId}`,
    );
    return result;
  }

  async deletePickupLocationTranslation(
    tourId: string,
    pickupLocationId: string,
    locale: Locale,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);
    if (locale === Locale.en)
      throw new BadRequestException(
        'English pickup text cannot be deleted. Update the text instead.',
      );
    const pickup = await this.prisma.pickupLocation.findFirst({
      where: { id: pickupLocationId, tourId },
      select: { id: true },
    });
    if (!pickup)
      throw new NotFoundException(
        `Pickup location ${pickupLocationId} not found on tour ${tourId}`,
      );
    await this.prisma.pickupLocationTranslation
      .delete({
        where: { pickupLocationId_locale: { pickupLocationId, locale } },
      })
      .catch((err: any) => {
        if (err?.code === 'P2025')
          throw new NotFoundException(
            `No translation found for locale "${locale}"`,
          );
        throw err;
      });
    this.logger.log(
      `User ${requesterId} deleted pickup translation [${locale}] for pickup ${pickupLocationId}`,
    );
    return { message: `Translation for locale "${locale}" deleted` };
  }

  // ── Tour Translations ─────────────────────────────────────────────────────────

  private readonly tourTranslationSelect = {
    locale: true,
    title: true,
    overview: true,
    description: true,
    shortDescription: true,
    whatToBring: true,
    knowBeforeYouGo: true,
    notSuitableFor: true,
    whatToExpectIntro: true,
    categoryDisplay: true,
    localTipTitle: true,
    localTipBody: true,
    meetingPointText: true,
    metaTitle: true,
    metaDescription: true,
    isMachineTranslated: true,
    updatedAt: true,
  } as const;

  async getAllTranslations(
    tourId: string,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);
    return this.prisma.tourTranslation.findMany({
      where: { tourId },
      select: this.tourTranslationSelect,
      orderBy: { locale: 'asc' },
    });
  }

  async getTranslationByLocale(
    tourId: string,
    locale: Locale,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    const translation = await this.prisma.tourTranslation.findUnique({
      where: { tourId_locale: { tourId, locale } },
      select: this.tourTranslationSelect,
    });

    return (
      translation ?? {
        locale,
        title: null,
        overview: null,
        description: null,
        shortDescription: null,
        whatToBring: [],
        knowBeforeYouGo: [],
        notSuitableFor: [],
        whatToExpectIntro: null,
        categoryDisplay: null,
        localTipTitle: null,
        localTipBody: null,
        meetingPointText: null,
        metaTitle: null,
        metaDescription: null,
        isMachineTranslated: false,
        updatedAt: null,
      }
    );
  }

  async upsertTranslation(
    tourId: string,
    locale: Locale,
    dto: UpsertTourTranslationDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    const result = await this.prisma.tourTranslation.upsert({
      where: { tourId_locale: { tourId, locale } },
      create: {
        tourId,
        locale,
        title: dto.title ?? null,
        overview: dto.overview ?? null,
        description: dto.description ?? null,
        shortDescription: dto.shortDescription ?? null,
        whatToBring: dto.whatToBring ?? [],
        knowBeforeYouGo: dto.knowBeforeYouGo ?? [],
        notSuitableFor: dto.notSuitableFor ?? [],
        whatToExpectIntro: dto.whatToExpectIntro ?? null,
        categoryDisplay: dto.categoryDisplay ?? null,
        localTipTitle: dto.localTipTitle ?? null,
        localTipBody: dto.localTipBody ?? null,
        meetingPointText: dto.meetingPointText ?? null,
        metaTitle: dto.metaTitle ?? null,
        metaDescription: dto.metaDescription ?? null,
        isMachineTranslated: dto.isMachineTranslated ?? false,
      },
      update: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.overview !== undefined && { overview: dto.overview }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.shortDescription !== undefined && {
          shortDescription: dto.shortDescription,
        }),
        ...(dto.whatToBring !== undefined && { whatToBring: dto.whatToBring }),
        ...(dto.knowBeforeYouGo !== undefined && {
          knowBeforeYouGo: dto.knowBeforeYouGo,
        }),
        ...(dto.notSuitableFor !== undefined && {
          notSuitableFor: dto.notSuitableFor,
        }),
        ...(dto.whatToExpectIntro !== undefined && {
          whatToExpectIntro: dto.whatToExpectIntro,
        }),
        ...(dto.categoryDisplay !== undefined && {
          categoryDisplay: dto.categoryDisplay,
        }),
        ...(dto.localTipTitle !== undefined && {
          localTipTitle: dto.localTipTitle,
        }),
        ...(dto.localTipBody !== undefined && {
          localTipBody: dto.localTipBody,
        }),
        ...(dto.meetingPointText !== undefined && {
          meetingPointText: dto.meetingPointText,
        }),
        ...(dto.metaTitle !== undefined && { metaTitle: dto.metaTitle }),
        ...(dto.metaDescription !== undefined && {
          metaDescription: dto.metaDescription,
        }),
        ...(dto.isMachineTranslated !== undefined && {
          isMachineTranslated: dto.isMachineTranslated,
        }),
      },
      select: this.tourTranslationSelect,
    });

    this.logger.log(
      `User ${requesterId} upserted translation [${locale}] for tour ${tourId}`,
    );
    return result;
  }

  async deleteTranslation(
    tourId: string,
    locale: Locale,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTourAccess(tourId, requesterId, requesterRole);

    if (locale === Locale.en) {
      throw new BadRequestException(
        'English translation cannot be deleted. Set the overview field to null instead.',
      );
    }

    await this.prisma.tourTranslation
      .delete({ where: { tourId_locale: { tourId, locale } } })
      .catch((err: any) => {
        if (err?.code === 'P2025') {
          throw new NotFoundException(
            `No translation found for locale "${locale}"`,
          );
        }
        throw err;
      });

    this.logger.log(
      `User ${requesterId} deleted translation [${locale}] for tour ${tourId}`,
    );
    return { message: `Translation for locale "${locale}" deleted` };
  }
}
