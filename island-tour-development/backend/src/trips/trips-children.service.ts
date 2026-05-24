import { Locale as LocaleEnum } from '@/common/constants/locales';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Locale, Role } from '@prisma/client';
import {
  AddTourImageDto,
  AddTourLanguageDto,
  CreateTourAddOnDto,
  CreateTourAgeBandDto,
  CreateTourHighlightDto,
  CreateTourInclusionDto,
  CreateTourScheduleDto,
  UpdateTourAddOnDto,
  UpdateTourAgeBandDto,
  UpdateTourHighlightDto,
  UpdateTourImageDto,
  UpdateTourInclusionDto,
  UpdateTourScheduleDto,
  UpsertHighlightTranslationDto,
  UpsertInclusionTranslationDto,
  UpsertTripTranslationDto,
} from './dto/trip-children.dto';

@Injectable()
export class TripChildrenService {
  private readonly logger = new Logger(TripChildrenService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Common helper ─────────────────────────────────────────────────────────────

  private async assertTripAccess(tripId: string, requesterId: string, requesterRole: Role) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true, operatorId: true, status: true },
    });
    if (!trip) throw new NotFoundException(`Trip ${tripId} not found`);
    if (requesterRole !== Role.ADMIN && trip.operatorId !== requesterId) {
      throw new ForbiddenException('You do not have permission to modify this trip');
    }
    return trip;
  }

  // ── Images ────────────────────────────────────────────────────────────────────

  private readonly imageSelect = {
    id: true,
    tripId: true,
    url: true,
    isHero: true,
    focalX: true,
    focalY: true,
    altText: true,
    displayOrder: true,
    width: true,
    height: true,
  } as const;

  async getImages(tripId: string, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);
    return this.prisma.tourImage.findMany({
      where: { tripId },
      select: this.imageSelect,
      orderBy: { displayOrder: 'asc' },
    });
  }

  async addImage(tripId: string, dto: AddTourImageDto, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);

    if (dto.isHero) {
      return this.prisma.$transaction(async (tx) => {
        await tx.tourImage.updateMany({ where: { tripId }, data: { isHero: false } });
        const image = await tx.tourImage.create({
          data: {
            tripId,
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
        this.logger.log(`User ${requesterId} added hero image to trip ${tripId}`);
        return image;
      });
    }

    const image = await this.prisma.tourImage.create({
      data: {
        tripId,
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

    this.logger.log(`User ${requesterId} added image to trip ${tripId}`);
    return image;
  }

  async updateImage(
    tripId: string,
    imageId: string,
    dto: UpdateTourImageDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);

    const existing = await this.prisma.tourImage.findFirst({
      where: { id: imageId, tripId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Image ${imageId} not found on trip ${tripId}`);

    if (dto.isHero === true) {
      return this.prisma.$transaction(async (tx) => {
        await tx.tourImage.updateMany({ where: { tripId }, data: { isHero: false } });
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
        this.logger.log(`User ${requesterId} set image ${imageId} as hero on trip ${tripId}`);
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

    this.logger.log(`User ${requesterId} updated image ${imageId} on trip ${tripId}`);
    return updated;
  }

  async removeImage(tripId: string, imageId: string, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);

    const existing = await this.prisma.tourImage.findFirst({
      where: { id: imageId, tripId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Image ${imageId} not found on trip ${tripId}`);

    await this.prisma.tourImage.delete({ where: { id: imageId } });
    this.logger.log(`User ${requesterId} removed image ${imageId} from trip ${tripId}`);
    return { message: 'Image removed successfully' };
  }

  // ── Age Bands ─────────────────────────────────────────────────────────────────

  private readonly ageBandSelect = {
    id: true,
    tripId: true,
    bandType: true,
    label: true,
    minAge: true,
    maxAge: true,
    price: true,
    minCount: true,
    maxCount: true,
    displayOrder: true,
  } as const;

  async getAgeBands(tripId: string, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);
    return this.prisma.tourAgeBand.findMany({
      where: { tripId },
      select: this.ageBandSelect,
      orderBy: { displayOrder: 'asc' },
    });
  }

  async addAgeBand(tripId: string, dto: CreateTourAgeBandDto, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);

    const band = await this.prisma.tourAgeBand.create({
      data: {
        tripId,
        bandType: dto.bandType,
        label: dto.label,
        minAge: dto.minAge ?? null,
        maxAge: dto.maxAge ?? null,
        price: dto.price,
        minCount: dto.minCount ?? 0,
        maxCount: dto.maxCount ?? null,
        displayOrder: dto.displayOrder ?? 0,
      },
      select: this.ageBandSelect,
    });

    this.logger.log(`User ${requesterId} added age band to trip ${tripId}`);
    return band;
  }

  async updateAgeBand(
    tripId: string,
    bandId: string,
    dto: UpdateTourAgeBandDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);

    const existing = await this.prisma.tourAgeBand.findFirst({
      where: { id: bandId, tripId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Age band ${bandId} not found on trip ${tripId}`);

    const updated = await this.prisma.tourAgeBand.update({
      where: { id: bandId },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.minAge !== undefined && { minAge: dto.minAge }),
        ...(dto.maxAge !== undefined && { maxAge: dto.maxAge }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.minCount !== undefined && { minCount: dto.minCount }),
        ...(dto.maxCount !== undefined && { maxCount: dto.maxCount }),
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
      },
      select: this.ageBandSelect,
    });

    this.logger.log(`User ${requesterId} updated age band ${bandId} on trip ${tripId}`);
    return updated;
  }

  async removeAgeBand(tripId: string, bandId: string, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);

    const existing = await this.prisma.tourAgeBand.findFirst({
      where: { id: bandId, tripId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Age band ${bandId} not found on trip ${tripId}`);

    await this.prisma.tourAgeBand.delete({ where: { id: bandId } });
    this.logger.log(`User ${requesterId} removed age band ${bandId} from trip ${tripId}`);
    return { message: 'Age band removed successfully' };
  }

  // ── Add-Ons ───────────────────────────────────────────────────────────────────

  private readonly addOnSelect = {
    id: true,
    tripId: true,
    name: true,
    description: true,
    price: true,
    unit: true,
    maxQuantity: true,
    displayOrder: true,
    isActive: true,
  } as const;

  async getAddOns(tripId: string, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);
    return this.prisma.tourAddOn.findMany({
      where: { tripId },
      select: this.addOnSelect,
      orderBy: { displayOrder: 'asc' },
    });
  }

  async addAddOn(tripId: string, dto: CreateTourAddOnDto, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);

    const addOn = await this.prisma.tourAddOn.create({
      data: {
        tripId,
        name: dto.name,
        description: dto.description ?? null,
        price: dto.price,
        unit: dto.unit ?? 'PER_PERSON',
        maxQuantity: dto.maxQuantity ?? 1,
        displayOrder: dto.displayOrder ?? 0,
      },
      select: this.addOnSelect,
    });

    this.logger.log(`User ${requesterId} added add-on to trip ${tripId}`);
    return addOn;
  }

  async updateAddOn(
    tripId: string,
    addonId: string,
    dto: UpdateTourAddOnDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);

    const existing = await this.prisma.tourAddOn.findFirst({
      where: { id: addonId, tripId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Add-on ${addonId} not found on trip ${tripId}`);

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

    this.logger.log(`User ${requesterId} updated add-on ${addonId} on trip ${tripId}`);
    return updated;
  }

  async removeAddOn(tripId: string, addonId: string, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);

    const existing = await this.prisma.tourAddOn.findFirst({
      where: { id: addonId, tripId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Add-on ${addonId} not found on trip ${tripId}`);

    await this.prisma.tourAddOn.delete({ where: { id: addonId } });
    this.logger.log(`User ${requesterId} removed add-on ${addonId} from trip ${tripId}`);
    return { message: 'Add-on removed successfully' };
  }

  // ── Languages ─────────────────────────────────────────────────────────────────

  async getLanguages(tripId: string, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);
    return this.prisma.tourLanguage.findMany({
      where: { tripId },
      select: { id: true, tripId: true, language: true },
      orderBy: { language: 'asc' },
    });
  }

  async addLanguage(tripId: string, dto: AddTourLanguageDto, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);

    const lang = await this.prisma.tourLanguage
      .create({
        data: { tripId, language: dto.language },
        select: { id: true, tripId: true, language: true },
      })
      .catch((err: any) => {
        if (err?.code === 'P2002') {
          throw new ConflictException(`Language "${dto.language}" already added to this trip`);
        }
        throw err;
      });

    this.logger.log(`User ${requesterId} added language "${dto.language}" to trip ${tripId}`);
    return lang;
  }

  async removeLanguage(tripId: string, languageId: string, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);

    const existing = await this.prisma.tourLanguage.findFirst({
      where: { id: languageId, tripId },
      select: { id: true, language: true },
    });
    if (!existing) throw new NotFoundException(`Language ${languageId} not found on trip ${tripId}`);

    await this.prisma.tourLanguage.delete({ where: { id: languageId } });
    this.logger.log(`User ${requesterId} removed language ${languageId} from trip ${tripId}`);
    return { message: 'Language removed successfully' };
  }

  // ── Highlights ────────────────────────────────────────────────────────────────

  private readonly highlightSelect = {
    id: true,
    tripId: true,
    displayOrder: true,
    translations: { select: { locale: true, text: true, isMachineTranslated: true } },
  } as const;

  async getHighlights(tripId: string, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);
    return this.prisma.tourHighlight.findMany({
      where: { tripId },
      select: this.highlightSelect,
      orderBy: { displayOrder: 'asc' },
    });
  }

  async addHighlight(
    tripId: string,
    dto: CreateTourHighlightDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);

    const result = await this.prisma.$transaction(async (tx) => {
      const highlight = await tx.tourHighlight.create({
        data: { tripId, displayOrder: dto.displayOrder ?? 0 },
        select: { id: true, tripId: true, displayOrder: true },
      });
      await tx.tourHighlightTranslation.create({
        data: { highlightId: highlight.id, locale: LocaleEnum.en, text: dto.text },
      });
      return tx.tourHighlight.findUnique({
        where: { id: highlight.id },
        select: this.highlightSelect,
      });
    });

    this.logger.log(`User ${requesterId} added highlight to trip ${tripId}`);
    return result;
  }

  async updateHighlight(
    tripId: string,
    highlightId: string,
    dto: UpdateTourHighlightDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);

    const existing = await this.prisma.tourHighlight.findFirst({
      where: { id: highlightId, tripId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Highlight ${highlightId} not found on trip ${tripId}`);

    const updated = await this.prisma.tourHighlight.update({
      where: { id: highlightId },
      data: { ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }) },
      select: this.highlightSelect,
    });

    this.logger.log(`User ${requesterId} updated highlight ${highlightId} on trip ${tripId}`);
    return updated;
  }

  async removeHighlight(tripId: string, highlightId: string, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);

    const existing = await this.prisma.tourHighlight.findFirst({
      where: { id: highlightId, tripId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Highlight ${highlightId} not found on trip ${tripId}`);

    await this.prisma.tourHighlight.delete({ where: { id: highlightId } });
    this.logger.log(`User ${requesterId} removed highlight ${highlightId} from trip ${tripId}`);
    return { message: 'Highlight removed successfully' };
  }

  async upsertHighlightTranslation(
    tripId: string,
    highlightId: string,
    locale: Locale,
    dto: UpsertHighlightTranslationDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);

    const highlight = await this.prisma.tourHighlight.findFirst({
      where: { id: highlightId, tripId },
      select: { id: true },
    });
    if (!highlight) throw new NotFoundException(`Highlight ${highlightId} not found on trip ${tripId}`);

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
    tripId: string,
    highlightId: string,
    locale: Locale,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);

    if (locale === Locale.en) {
      throw new BadRequestException('English highlight text cannot be deleted. Update the text instead.');
    }

    const highlight = await this.prisma.tourHighlight.findFirst({
      where: { id: highlightId, tripId },
      select: { id: true },
    });
    if (!highlight) throw new NotFoundException(`Highlight ${highlightId} not found on trip ${tripId}`);

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
    tripId: true,
    icon: true,
    displayOrder: true,
    translations: { select: { locale: true, label: true, isMachineTranslated: true } },
  } as const;

  async getInclusions(tripId: string, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);
    return this.prisma.tourInclusion.findMany({
      where: { tripId },
      select: this.inclusionSelect,
      orderBy: { displayOrder: 'asc' },
    });
  }

  async addInclusion(
    tripId: string,
    dto: CreateTourInclusionDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);

    const result = await this.prisma.$transaction(async (tx) => {
      const inclusion = await tx.tourInclusion.create({
        data: {
          tripId,
          icon: dto.icon ?? 'check',
          displayOrder: dto.displayOrder ?? 0,
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

    this.logger.log(`User ${requesterId} added inclusion to trip ${tripId}`);
    return result;
  }

  async updateInclusion(
    tripId: string,
    inclusionId: string,
    dto: UpdateTourInclusionDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);

    const existing = await this.prisma.tourInclusion.findFirst({
      where: { id: inclusionId, tripId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Inclusion ${inclusionId} not found on trip ${tripId}`);

    const updated = await this.prisma.tourInclusion.update({
      where: { id: inclusionId },
      data: {
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
      },
      select: this.inclusionSelect,
    });

    this.logger.log(`User ${requesterId} updated inclusion ${inclusionId} on trip ${tripId}`);
    return updated;
  }

  async removeInclusion(tripId: string, inclusionId: string, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);

    const existing = await this.prisma.tourInclusion.findFirst({
      where: { id: inclusionId, tripId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Inclusion ${inclusionId} not found on trip ${tripId}`);

    await this.prisma.tourInclusion.delete({ where: { id: inclusionId } });
    this.logger.log(`User ${requesterId} removed inclusion ${inclusionId} from trip ${tripId}`);
    return { message: 'Inclusion removed successfully' };
  }

  async upsertInclusionTranslation(
    tripId: string,
    inclusionId: string,
    locale: Locale,
    dto: UpsertInclusionTranslationDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);

    const inclusion = await this.prisma.tourInclusion.findFirst({
      where: { id: inclusionId, tripId },
      select: { id: true },
    });
    if (!inclusion) throw new NotFoundException(`Inclusion ${inclusionId} not found on trip ${tripId}`);

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
    tripId: string,
    inclusionId: string,
    locale: Locale,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);

    if (locale === Locale.en) {
      throw new BadRequestException('English inclusion text cannot be deleted. Update the label instead.');
    }

    const inclusion = await this.prisma.tourInclusion.findFirst({
      where: { id: inclusionId, tripId },
      select: { id: true },
    });
    if (!inclusion) throw new NotFoundException(`Inclusion ${inclusionId} not found on trip ${tripId}`);

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

  // ── Trip Translations ─────────────────────────────────────────────────────────

  private readonly tripTranslationSelect = {
    locale: true,
    title: true,
    overview: true,
    description: true,
    isMachineTranslated: true,
    updatedAt: true,
  } as const;

  async getAllTranslations(tripId: string, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);
    return this.prisma.tripTranslation.findMany({
      where: { tripId },
      select: this.tripTranslationSelect,
      orderBy: { locale: 'asc' },
    });
  }

  async getTranslationByLocale(tripId: string, locale: Locale, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);

    const translation = await this.prisma.tripTranslation.findUnique({
      where: { tripId_locale: { tripId, locale } },
      select: this.tripTranslationSelect,
    });

    return (
      translation ?? {
        locale,
        title: null,
        overview: null,
        description: null,
        isMachineTranslated: false,
        updatedAt: new Date(),
      }
    );
  }

  async upsertTranslation(
    tripId: string,
    locale: Locale,
    dto: UpsertTripTranslationDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);

    const result = await this.prisma.tripTranslation.upsert({
      where: { tripId_locale: { tripId, locale } },
      create: {
        tripId,
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

    this.logger.log(`User ${requesterId} upserted translation [${locale}] for trip ${tripId}`);
    return result;
  }

  async deleteTranslation(tripId: string, locale: Locale, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);

    if (locale === Locale.en) {
      throw new BadRequestException(
        'English translation cannot be deleted. Set the overview field to null instead.',
      );
    }

    await this.prisma.tripTranslation
      .delete({ where: { tripId_locale: { tripId, locale } } })
      .catch((err: any) => {
        if (err?.code === 'P2025') {
          throw new NotFoundException(`No translation found for locale "${locale}"`);
        }
        throw err;
      });

    this.logger.log(`User ${requesterId} deleted translation [${locale}] for trip ${tripId}`);
    return { message: `Translation for locale "${locale}" deleted` };
  }

  // ── Schedules ─────────────────────────────────────────────────────────────────

  private readonly scheduleSelect = {
    id: true,
    tripId: true,
    startDate: true,
    endDate: true,
    startTime: true,
    totalSpots: true,
    availableSpots: true,
    status: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  async getSchedules(tripId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true },
    });
    if (!trip) throw new NotFoundException(`Trip ${tripId} not found`);

    return this.prisma.tourSchedule.findMany({
      where: { tripId },
      select: this.scheduleSelect,
      orderBy: { startDate: 'asc' },
    });
  }

  async createSchedule(
    tripId: string,
    dto: CreateTourScheduleDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);

    const schedule = await this.prisma.tourSchedule.create({
      data: {
        tripId,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        startTime: dto.startTime,
        totalSpots: dto.totalSpots,
        availableSpots: dto.totalSpots,
      },
      select: this.scheduleSelect,
    });

    // Phase 5 hook: schedule BullMQ pre-booking job at (startDate - 24h)

    this.logger.log(`User ${requesterId} created schedule for trip ${tripId}`);
    return schedule;
  }

  async updateSchedule(
    tripId: string,
    scheduleId: string,
    dto: UpdateTourScheduleDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);

    const existing = await this.prisma.tourSchedule.findFirst({
      where: { id: scheduleId, tripId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Schedule ${scheduleId} not found on trip ${tripId}`);

    const updated = await this.prisma.tourSchedule.update({
      where: { id: scheduleId },
      data: {
        ...(dto.totalSpots !== undefined && { totalSpots: dto.totalSpots }),
        ...(dto.availableSpots !== undefined && { availableSpots: dto.availableSpots }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      select: this.scheduleSelect,
    });

    this.logger.log(`User ${requesterId} updated schedule ${scheduleId} on trip ${tripId}`);
    return updated;
  }

  async removeSchedule(tripId: string, scheduleId: string, requesterId: string, requesterRole: Role) {
    await this.assertTripAccess(tripId, requesterId, requesterRole);

    const existing = await this.prisma.tourSchedule.findFirst({
      where: { id: scheduleId, tripId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Schedule ${scheduleId} not found on trip ${tripId}`);

    await this.prisma.tourSchedule.delete({ where: { id: scheduleId } });
    this.logger.log(`User ${requesterId} removed schedule ${scheduleId} from trip ${tripId}`);
    return { message: 'Schedule removed successfully' };
  }
}
