import { Locale as LocaleEnum } from '@/common/constants/locales';
import { PrismaService } from '@/prisma/prisma.service';
import { TripsService } from './trips.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Locale, Role, TourStatus } from '@prisma/client';
import {
  AddTourImageDto,
  AddTourLanguageDto,
  CreateTourAddOnDto,
  CreateTourHighlightDto,
  CreateTourInclusionDto,
  CreateTourExclusionDto,
  UpdateTourAddOnDto,
  UpdateTourHighlightDto,
  UpdateTourImageDto,
  UpdateTourInclusionDto,
  UpdateTourExclusionDto,
  UpsertHighlightTranslationDto,
  UpsertInclusionTranslationDto,
  UpsertExclusionTranslationDto,
  UpsertTripTranslationDto,
} from './dto/trip-children.dto';

@Injectable()
export class TripChildrenService {
  private readonly logger = new Logger(TripChildrenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tripsService: TripsService,
  ) {}

  // ── Common helper ─────────────────────────────────────────────────────────────

  private async assertTripAccess(tourId: string, requesterId: string, requesterRole: Role) {
    const trip = await this.tripsService.findTripOrThrow(tourId);
    await this.tripsService.assertOwnership(trip, requesterId, requesterRole);
    return trip;
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
    await this.assertTripAccess(tourId, requesterId, requesterRole);
    return this.prisma.tourImage.findMany({
      where: { tourId },
      select: this.imageSelect,
      orderBy: { displayOrder: 'asc' },
    });
  }

  async addImage(tourId: string, dto: AddTourImageDto, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tourId, requesterId, requesterRole);

    if (dto.isHero) {
      return this.prisma.$transaction(async (tx) => {
        await tx.tourImage.updateMany({ where: { tourId }, data: { isHero: false } });
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
        this.logger.log(`User ${requesterId} added hero image to trip ${tourId}`);
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

    this.logger.log(`User ${requesterId} added image to trip ${tourId}`);
    return image;
  }

  async updateImage(
    tourId: string,
    imageId: string,
    dto: UpdateTourImageDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTripAccess(tourId, requesterId, requesterRole);

    const existing = await this.prisma.tourImage.findFirst({
      where: { id: imageId, tourId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Image ${imageId} not found on trip ${tourId}`);

    if (dto.isHero === true) {
      return this.prisma.$transaction(async (tx) => {
        await tx.tourImage.updateMany({ where: { tourId }, data: { isHero: false } });
        const updated = await tx.tourImage.update({
          where: { id: imageId },
          data: {
            isHero: true,
            ...(dto.focalX !== undefined && { focalX: dto.focalX }),
            ...(dto.focalY !== undefined && { focalY: dto.focalY }),
            ...(dto.altText !== undefined && { altText: dto.altText }),
            ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
          },
          select: this.imageSelect,
        });
        this.logger.log(`User ${requesterId} set image ${imageId} as hero on trip ${tourId}`);
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
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
      },
      select: this.imageSelect,
    });

    this.logger.log(`User ${requesterId} updated image ${imageId} on trip ${tourId}`);
    return updated;
  }

  async removeImage(tourId: string, imageId: string, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tourId, requesterId, requesterRole);

    const existing = await this.prisma.tourImage.findFirst({
      where: { id: imageId, tourId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Image ${imageId} not found on trip ${tourId}`);

    await this.prisma.tourImage.delete({ where: { id: imageId } });
    this.logger.log(`User ${requesterId} removed image ${imageId} from trip ${tourId}`);
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
    await this.assertTripAccess(tourId, requesterId, requesterRole);
    return this.prisma.tourAddOn.findMany({
      where: { tourId },
      select: this.addOnSelect,
      orderBy: { displayOrder: 'asc' },
    });
  }

  async addAddOn(tourId: string, dto: CreateTourAddOnDto, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tourId, requesterId, requesterRole);

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

    this.logger.log(`User ${requesterId} added add-on to trip ${tourId}`);
    return addOn;
  }

  async updateAddOn(
    tourId: string,
    addonId: string,
    dto: UpdateTourAddOnDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTripAccess(tourId, requesterId, requesterRole);

    const existing = await this.prisma.tourAddOn.findFirst({
      where: { id: addonId, tourId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Add-on ${addonId} not found on trip ${tourId}`);

    const updated = await this.prisma.tourAddOn.update({
      where: { id: addonId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.maxQuantity !== undefined && { maxQuantity: dto.maxQuantity }),
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: this.addOnSelect,
    });

    this.logger.log(`User ${requesterId} updated add-on ${addonId} on trip ${tourId}`);
    return updated;
  }

  async removeAddOn(tourId: string, addonId: string, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tourId, requesterId, requesterRole);

    const existing = await this.prisma.tourAddOn.findFirst({
      where: { id: addonId, tourId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Add-on ${addonId} not found on trip ${tourId}`);

    await this.prisma.tourAddOn.delete({ where: { id: addonId } });
    this.logger.log(`User ${requesterId} removed add-on ${addonId} from trip ${tourId}`);
    return { message: 'Add-on removed successfully' };
  }

  // ── Languages ─────────────────────────────────────────────────────────────────

  async getLanguages(tourId: string, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tourId, requesterId, requesterRole);
    return this.prisma.tourLanguage.findMany({
      where: { tourId },
      select: { id: true, tourId: true, language: true },
      orderBy: { language: 'asc' },
    });
  }

  async addLanguage(tourId: string, dto: AddTourLanguageDto, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tourId, requesterId, requesterRole);

    const lang = await this.prisma.tourLanguage
      .create({
        data: { tourId, language: dto.language },
        select: { id: true, tourId: true, language: true },
      })
      .catch((err: any) => {
        if (err?.code === 'P2002') {
          throw new ConflictException(`Language "${dto.language}" already added to this trip`);
        }
        throw err;
      });

    this.logger.log(`User ${requesterId} added language "${dto.language}" to trip ${tourId}`);
    return lang;
  }

  async removeLanguage(tourId: string, languageId: string, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tourId, requesterId, requesterRole);

    const existing = await this.prisma.tourLanguage.findFirst({
      where: { id: languageId, tourId },
      select: { id: true, language: true },
    });
    if (!existing) throw new NotFoundException(`Language ${languageId} not found on trip ${tourId}`);

    await this.prisma.tourLanguage.delete({ where: { id: languageId } });
    this.logger.log(`User ${requesterId} removed language ${languageId} from trip ${tourId}`);
    return { message: 'Language removed successfully' };
  }

  // ── Highlights ────────────────────────────────────────────────────────────────

  private readonly highlightSelect = {
    id: true,
    tourId: true,
    displayOrder: true,
    imageUrl: true,
    translations: { select: { locale: true, text: true, isMachineTranslated: true } },
  } as const;

  async getHighlights(tourId: string, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tourId, requesterId, requesterRole);
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
    await this.assertTripAccess(tourId, requesterId, requesterRole);

    const result = await this.prisma.$transaction(async (tx) => {
      const highlight = await tx.tourHighlight.create({
        data: { tourId, displayOrder: dto.displayOrder ?? 0, imageUrl: dto.imageUrl ?? null },
        select: { id: true, tourId: true, displayOrder: true, imageUrl: true },
      });
      await tx.tourHighlightTranslation.create({
        data: { highlightId: highlight.id, locale: LocaleEnum.en, text: dto.text },
      });
      return tx.tourHighlight.findUnique({
        where: { id: highlight.id },
        select: this.highlightSelect,
      });
    });

    this.logger.log(`User ${requesterId} added highlight to trip ${tourId}`);
    return result;
  }

  async updateHighlight(
    tourId: string,
    highlightId: string,
    dto: UpdateTourHighlightDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTripAccess(tourId, requesterId, requesterRole);

    const existing = await this.prisma.tourHighlight.findFirst({
      where: { id: highlightId, tourId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Highlight ${highlightId} not found on trip ${tourId}`);

    const updated = await this.prisma.tourHighlight.update({
      where: { id: highlightId },
      data: {
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
        ...('imageUrl' in dto && { imageUrl: dto.imageUrl ?? null }),
      },
      select: this.highlightSelect,
    });

    this.logger.log(`User ${requesterId} updated highlight ${highlightId} on trip ${tourId}`);
    return updated;
  }

  async removeHighlight(tourId: string, highlightId: string, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tourId, requesterId, requesterRole);

    const existing = await this.prisma.tourHighlight.findFirst({
      where: { id: highlightId, tourId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Highlight ${highlightId} not found on trip ${tourId}`);

    await this.prisma.tourHighlight.delete({ where: { id: highlightId } });
    this.logger.log(`User ${requesterId} removed highlight ${highlightId} from trip ${tourId}`);
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
    await this.assertTripAccess(tourId, requesterId, requesterRole);

    const highlight = await this.prisma.tourHighlight.findFirst({
      where: { id: highlightId, tourId },
      select: { id: true },
    });
    if (!highlight) throw new NotFoundException(`Highlight ${highlightId} not found on trip ${tourId}`);

    const result = await this.prisma.tourHighlightTranslation.upsert({
      where: { highlightId_locale: { highlightId, locale } },
      create: { highlightId, locale, text: dto.text, isMachineTranslated: dto.isMachineTranslated ?? false },
      update: { text: dto.text, isMachineTranslated: dto.isMachineTranslated ?? false },
      select: { locale: true, text: true, isMachineTranslated: true },
    });

    this.logger.log(`User ${requesterId} upserted highlight translation [${locale}] for highlight ${highlightId}`);
    return result;
  }

  async deleteHighlightTranslation(
    tourId: string,
    highlightId: string,
    locale: Locale,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTripAccess(tourId, requesterId, requesterRole);

    if (locale === Locale.en) {
      throw new BadRequestException('English highlight text cannot be deleted. Update the text instead.');
    }

    const highlight = await this.prisma.tourHighlight.findFirst({
      where: { id: highlightId, tourId },
      select: { id: true },
    });
    if (!highlight) throw new NotFoundException(`Highlight ${highlightId} not found on trip ${tourId}`);

    await this.prisma.tourHighlightTranslation
      .delete({ where: { highlightId_locale: { highlightId, locale } } })
      .catch((err: any) => {
        if (err?.code === 'P2025') {
          throw new NotFoundException(`No translation found for locale "${locale}"`);
        }
        throw err;
      });

    this.logger.log(`User ${requesterId} deleted highlight translation [${locale}] for highlight ${highlightId}`);
    return { message: `Translation for locale "${locale}" deleted` };
  }

  // ── Inclusions ────────────────────────────────────────────────────────────────

  private readonly inclusionSelect = {
    id: true,
    tourId: true,
    icon: true,
    displayOrder: true,
    imageUrl: true,
    translations: { select: { locale: true, label: true, isMachineTranslated: true } },
  } as const;

  async getInclusions(tourId: string, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tourId, requesterId, requesterRole);
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
    await this.assertTripAccess(tourId, requesterId, requesterRole);

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
        data: { inclusionId: inclusion.id, locale: LocaleEnum.en, label: dto.label },
      });
      return tx.tourInclusion.findUnique({
        where: { id: inclusion.id },
        select: this.inclusionSelect,
      });
    });

    this.logger.log(`User ${requesterId} added inclusion to trip ${tourId}`);
    return result;
  }

  async updateInclusion(
    tourId: string,
    inclusionId: string,
    dto: UpdateTourInclusionDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTripAccess(tourId, requesterId, requesterRole);

    const existing = await this.prisma.tourInclusion.findFirst({
      where: { id: inclusionId, tourId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Inclusion ${inclusionId} not found on trip ${tourId}`);

    const updated = await this.prisma.tourInclusion.update({
      where: { id: inclusionId },
      data: {
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
        ...('imageUrl' in dto && { imageUrl: dto.imageUrl ?? null }),
      },
      select: this.inclusionSelect,
    });

    this.logger.log(`User ${requesterId} updated inclusion ${inclusionId} on trip ${tourId}`);
    return updated;
  }

  async removeInclusion(tourId: string, inclusionId: string, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tourId, requesterId, requesterRole);

    const existing = await this.prisma.tourInclusion.findFirst({
      where: { id: inclusionId, tourId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Inclusion ${inclusionId} not found on trip ${tourId}`);

    await this.prisma.tourInclusion.delete({ where: { id: inclusionId } });
    this.logger.log(`User ${requesterId} removed inclusion ${inclusionId} from trip ${tourId}`);
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
    await this.assertTripAccess(tourId, requesterId, requesterRole);

    const inclusion = await this.prisma.tourInclusion.findFirst({
      where: { id: inclusionId, tourId },
      select: { id: true },
    });
    if (!inclusion) throw new NotFoundException(`Inclusion ${inclusionId} not found on trip ${tourId}`);

    const result = await this.prisma.tourInclusionTranslation.upsert({
      where: { inclusionId_locale: { inclusionId, locale } },
      create: { inclusionId, locale, label: dto.label, isMachineTranslated: dto.isMachineTranslated ?? false },
      update: { label: dto.label, isMachineTranslated: dto.isMachineTranslated ?? false },
      select: { locale: true, label: true, isMachineTranslated: true },
    });

    this.logger.log(`User ${requesterId} upserted inclusion translation [${locale}] for inclusion ${inclusionId}`);
    return result;
  }

  async deleteInclusionTranslation(
    tourId: string,
    inclusionId: string,
    locale: Locale,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTripAccess(tourId, requesterId, requesterRole);

    if (locale === Locale.en) {
      throw new BadRequestException('English inclusion text cannot be deleted. Update the label instead.');
    }

    const inclusion = await this.prisma.tourInclusion.findFirst({
      where: { id: inclusionId, tourId },
      select: { id: true },
    });
    if (!inclusion) throw new NotFoundException(`Inclusion ${inclusionId} not found on trip ${tourId}`);

    await this.prisma.tourInclusionTranslation
      .delete({ where: { inclusionId_locale: { inclusionId, locale } } })
      .catch((err: any) => {
        if (err?.code === 'P2025') {
          throw new NotFoundException(`No translation found for locale "${locale}"`);
        }
        throw err;
      });

    this.logger.log(`User ${requesterId} deleted inclusion translation [${locale}] for inclusion ${inclusionId}`);
    return { message: `Translation for locale "${locale}" deleted` };
  }

  // ── Exclusions ────────────────────────────────────────────────────────────────

  private readonly exclusionSelect = {
    id: true,
    tourId: true,
    icon: true,
    displayOrder: true,
    imageUrl: true,
    translations: { select: { locale: true, label: true, isMachineTranslated: true } },
  } as const;

  async getExclusions(tourId: string, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tourId, requesterId, requesterRole);
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
    await this.assertTripAccess(tourId, requesterId, requesterRole);

    const result = await this.prisma.$transaction(async (tx) => {
      const exclusion = await tx.tourExclusion.create({
        data: {
          tourId,
          icon: dto.icon ?? 'x',
          displayOrder: dto.displayOrder ?? 0,
          imageUrl: dto.imageUrl ?? null,
        },
        select: { id: true },
      });
      await tx.tourExclusionTranslation.create({
        data: { exclusionId: exclusion.id, locale: LocaleEnum.en, label: dto.label },
      });
      return tx.tourExclusion.findUnique({
        where: { id: exclusion.id },
        select: this.exclusionSelect,
      });
    });

    this.logger.log(`User ${requesterId} added exclusion to trip ${tourId}`);
    return result;
  }

  async updateExclusion(
    tourId: string,
    exclusionId: string,
    dto: UpdateTourExclusionDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTripAccess(tourId, requesterId, requesterRole);

    const existing = await this.prisma.tourExclusion.findFirst({
      where: { id: exclusionId, tourId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Exclusion ${exclusionId} not found on trip ${tourId}`);

    const updated = await this.prisma.tourExclusion.update({
      where: { id: exclusionId },
      data: {
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
        ...('imageUrl' in dto && { imageUrl: dto.imageUrl ?? null }),
      },
      select: this.exclusionSelect,
    });

    this.logger.log(`User ${requesterId} updated exclusion ${exclusionId} on trip ${tourId}`);
    return updated;
  }

  async removeExclusion(tourId: string, exclusionId: string, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tourId, requesterId, requesterRole);

    const existing = await this.prisma.tourExclusion.findFirst({
      where: { id: exclusionId, tourId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Exclusion ${exclusionId} not found on trip ${tourId}`);

    await this.prisma.tourExclusion.delete({ where: { id: exclusionId } });
    this.logger.log(`User ${requesterId} removed exclusion ${exclusionId} from trip ${tourId}`);
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
    await this.assertTripAccess(tourId, requesterId, requesterRole);

    const exclusion = await this.prisma.tourExclusion.findFirst({
      where: { id: exclusionId, tourId },
      select: { id: true },
    });
    if (!exclusion) throw new NotFoundException(`Exclusion ${exclusionId} not found on trip ${tourId}`);

    const result = await this.prisma.tourExclusionTranslation.upsert({
      where: { exclusionId_locale: { exclusionId, locale } },
      create: { exclusionId, locale, label: dto.label, isMachineTranslated: dto.isMachineTranslated ?? false },
      update: { label: dto.label, isMachineTranslated: dto.isMachineTranslated ?? false },
      select: { locale: true, label: true, isMachineTranslated: true },
    });

    this.logger.log(`User ${requesterId} upserted exclusion translation [${locale}] for exclusion ${exclusionId}`);
    return result;
  }

  async deleteExclusionTranslation(
    tourId: string,
    exclusionId: string,
    locale: Locale,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTripAccess(tourId, requesterId, requesterRole);

    if (locale === Locale.en) {
      throw new BadRequestException('English exclusion text cannot be deleted. Update the label instead.');
    }

    const exclusion = await this.prisma.tourExclusion.findFirst({
      where: { id: exclusionId, tourId },
      select: { id: true },
    });
    if (!exclusion) throw new NotFoundException(`Exclusion ${exclusionId} not found on trip ${tourId}`);

    await this.prisma.tourExclusionTranslation
      .delete({ where: { exclusionId_locale: { exclusionId, locale } } })
      .catch((err: any) => {
        if (err?.code === 'P2025') {
          throw new NotFoundException(`No translation found for locale "${locale}"`);
        }
        throw err;
      });

    this.logger.log(`User ${requesterId} deleted exclusion translation [${locale}] for exclusion ${exclusionId}`);
    return { message: `Translation for locale "${locale}" deleted` };
  }

  // ── Trip Translations ─────────────────────────────────────────────────────────

  private readonly tripTranslationSelect = {
    locale: true,
    title: true,
    overview: true,
    description: true,
    isMachineTranslated: true,
    updatedAt: true,
  } as const;

  async getAllTranslations(tourId: string, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tourId, requesterId, requesterRole);
    return this.prisma.tourTranslation.findMany({
      where: { tourId },
      select: this.tripTranslationSelect,
      orderBy: { locale: 'asc' },
    });
  }

  async getTranslationByLocale(tourId: string, locale: Locale, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tourId, requesterId, requesterRole);

    const translation = await this.prisma.tourTranslation.findUnique({
      where: { tourId_locale: { tourId, locale } },
      select: this.tripTranslationSelect,
    });

    return (
      translation ?? {
        locale,
        title: null,
        overview: null,
        description: null,
        isMachineTranslated: false,
        updatedAt: null,
      }
    );
  }

  async upsertTranslation(
    tourId: string,
    locale: Locale,
    dto: UpsertTripTranslationDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTripAccess(tourId, requesterId, requesterRole);

    const result = await this.prisma.tourTranslation.upsert({
      where: { tourId_locale: { tourId, locale } },
      create: {
        tourId,
        locale,
        title: dto.title ?? null,
        overview: dto.overview ?? null,
        description: dto.description ?? null,
        isMachineTranslated: dto.isMachineTranslated ?? false,
      },
      update: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.overview !== undefined && { overview: dto.overview }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isMachineTranslated !== undefined && { isMachineTranslated: dto.isMachineTranslated }),
      },
      select: this.tripTranslationSelect,
    });

    this.logger.log(`User ${requesterId} upserted translation [${locale}] for trip ${tourId}`);
    return result;
  }

  async deleteTranslation(tourId: string, locale: Locale, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tourId, requesterId, requesterRole);

    if (locale === Locale.en) {
      throw new BadRequestException(
        'English translation cannot be deleted. Set the overview field to null instead.',
      );
    }

    await this.prisma.tourTranslation
      .delete({ where: { tourId_locale: { tourId, locale } } })
      .catch((err: any) => {
        if (err?.code === 'P2025') {
          throw new NotFoundException(`No translation found for locale "${locale}"`);
        }
        throw err;
      });

    this.logger.log(`User ${requesterId} deleted translation [${locale}] for trip ${tourId}`);
    return { message: `Translation for locale "${locale}" deleted` };
  }

}
