import type { AuthenticatedRequest, TypedAuthUser } from '@/auth/auth.types';
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import { Public } from '@/auth/decorators/public.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Locale, Permission, Role } from '@prisma/client';
import {
  AddTourImageDto,
  AddTourLanguageDto,
  CreatePickupLocationDto,
  CreateTourAddOnDto,
  CreateTourAgeBandDto,
  UpdateTourAgeBandDto,
  CreateTourFeatureDto,
  CreateTourInclusionDto,
  CreateTourExclusionDto,
  CreateTourLocationDto,
  UpdatePickupLocationDto,
  UpdateTourAddOnDto,
  UpdateTourFeatureDto,
  UpdateTourImageDto,
  UpdateTourInclusionDto,
  UpdateTourExclusionDto,
  UpdateTourLocationDto,
  UpsertFeatureTranslationDto,
  UpsertInclusionTranslationDto,
  UpsertExclusionTranslationDto,
  UpsertLocationTranslationDto,
  UpsertPickupLocationTranslationDto,
  UpsertTourTranslationDto,
} from './dto/tour-children.dto';
import {
  ApiAddAddOnDocs,
  ApiAddExclusionDocs,
  ApiAddFeatureDocs,
  ApiAddImageDocs,
  ApiAddInclusionDocs,
  ApiAddLanguageDocs,
  ApiAddLocationDocs,
  ApiAddPickupLocationDocs,
  ApiAddAgeBandDocs,
  ApiDeleteExclusionTranslationDocs,
  ApiDeleteFeatureTranslationDocs,
  ApiDeleteInclusionTranslationDocs,
  ApiDeleteLocationTranslationDocs,
  ApiDeletePickupLocationTranslationDocs,
  ApiDeleteTourTranslationDocs,
  ApiGetAddOnsDocs,
  ApiGetAgeBandsDocs,
  ApiGetAllTourTranslationsDocs,
  ApiGetExclusionsDocs,
  ApiGetFeaturesDocs,
  ApiGetImagesDocs,
  ApiGetInclusionsDocs,
  ApiGetLanguagesDocs,
  ApiGetLocationsDocs,
  ApiGetPickupLocationsDocs,
  ApiGetTourTranslationByLocaleDocs,
  ApiRemoveAddOnDocs,
  ApiRemoveAgeBandDocs,
  ApiRemoveExclusionDocs,
  ApiRemoveFeatureDocs,
  ApiRemoveImageDocs,
  ApiRemoveInclusionDocs,
  ApiRemoveLanguageDocs,
  ApiRemoveLocationDocs,
  ApiRemovePickupLocationDocs,
  ApiUpdateAddOnDocs,
  ApiUpdateAgeBandDocs,
  ApiUpdateExclusionDocs,
  ApiUpdateFeatureDocs,
  ApiUpdateImageDocs,
  ApiUpdateInclusionDocs,
  ApiUpdateLocationDocs,
  ApiUpdatePickupLocationDocs,
  ApiUpsertExclusionTranslationDocs,
  ApiUpsertFeatureTranslationDocs,
  ApiUpsertInclusionTranslationDocs,
  ApiUpsertLocationTranslationDocs,
  ApiUpsertPickupLocationTranslationDocs,
  ApiUpsertTourTranslationDocs,
} from './tours-children.swagger';
import { TourChildrenService } from './tours-children.service';

@ApiTags('Tour Children')
@Controller('tours/:tourId')
/**
 * TourChildrenController - manages all child models nested under a tour.
 *
 * ## Route ordering
 * Static segments (translations, schedules) MUST appear before dynamic
 * (:locale, :scheduleId) routes in each sub-resource group.
 *
 * ## Access-Control
 * GET /schedules is @Public() - travelers need availability data.
 * All other endpoints require EDIT_TRIP permission.
 */
export class TourChildrenController {
  constructor(private readonly tourChildrenService: TourChildrenService) {}

  // ── Images ────────────────────────────────────────────────────────────────────

  @Get('images')
  @RequirePermissions(Permission.VIEW_TRIPS)
  @ApiGetImagesDocs()
  getImages(@Param('tourId') tourId: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.tourChildrenService.getImages(tourId, user.id, user.role);
  }

  @Post('images')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiAddImageDocs()
  addImage(
    @Param('tourId') tourId: string,
    @Body() dto: AddTourImageDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.addImage(tourId, dto, user.id, user.role);
  }

  @Patch('images/:imageId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiUpdateImageDocs()
  updateImage(
    @Param('tourId') tourId: string,
    @Param('imageId') imageId: string,
    @Body() dto: UpdateTourImageDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.updateImage(tourId, imageId, dto, user.id, user.role);
  }

  @Delete('images/:imageId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiRemoveImageDocs()
  removeImage(
    @Param('tourId') tourId: string,
    @Param('imageId') imageId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.removeImage(tourId, imageId, user.id, user.role);
  }

  // ── Add-Ons ───────────────────────────────────────────────────────────────────

  @Get('addons')
  @RequirePermissions(Permission.VIEW_TRIPS)
  @ApiGetAddOnsDocs()
  getAddOns(@Param('tourId') tourId: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.tourChildrenService.getAddOns(tourId, user.id, user.role);
  }

  @Post('addons')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiAddAddOnDocs()
  addAddOn(
    @Param('tourId') tourId: string,
    @Body() dto: CreateTourAddOnDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.addAddOn(tourId, dto, user.id, user.role);
  }

  @Patch('addons/:addonId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiUpdateAddOnDocs()
  updateAddOn(
    @Param('tourId') tourId: string,
    @Param('addonId') addonId: string,
    @Body() dto: UpdateTourAddOnDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.updateAddOn(tourId, addonId, dto, user.id, user.role);
  }

  @Delete('addons/:addonId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiRemoveAddOnDocs()
  removeAddOn(
    @Param('tourId') tourId: string,
    @Param('addonId') addonId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.removeAddOn(tourId, addonId, user.id, user.role);
  }

  // ── Age Bands ───────────────────────────────────────────────────────────────────

  @Get('age-bands')
  @RequirePermissions(Permission.VIEW_TRIPS)
  @ApiGetAgeBandsDocs()
  getAgeBands(@Param('tourId') tourId: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.tourChildrenService.getAgeBands(tourId, user.id, user.role);
  }

  @Post('age-bands')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiAddAgeBandDocs()
  addAgeBand(
    @Param('tourId') tourId: string,
    @Body() dto: CreateTourAgeBandDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.addAgeBand(tourId, dto, user.id, user.role);
  }

  @Patch('age-bands/:ageBandId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiUpdateAgeBandDocs()
  updateAgeBand(
    @Param('tourId') tourId: string,
    @Param('ageBandId') ageBandId: string,
    @Body() dto: UpdateTourAgeBandDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.updateAgeBand(tourId, ageBandId, dto, user.id, user.role);
  }

  @Delete('age-bands/:ageBandId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiRemoveAgeBandDocs()
  removeAgeBand(
    @Param('tourId') tourId: string,
    @Param('ageBandId') ageBandId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.removeAgeBand(tourId, ageBandId, user.id, user.role);
  }

  // ── Languages ─────────────────────────────────────────────────────────────────

  @Get('languages')
  @RequirePermissions(Permission.VIEW_TRIPS)
  @ApiGetLanguagesDocs()
  getLanguages(@Param('tourId') tourId: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.tourChildrenService.getLanguages(tourId, user.id, user.role);
  }

  @Post('languages')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiAddLanguageDocs()
  addLanguage(
    @Param('tourId') tourId: string,
    @Body() dto: AddTourLanguageDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.addLanguage(tourId, dto, user.id, user.role);
  }

  @Delete('languages/:languageId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiRemoveLanguageDocs()
  removeLanguage(
    @Param('tourId') tourId: string,
    @Param('languageId') languageId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.removeLanguage(tourId, languageId, user.id, user.role);
  }

  // ── Inclusions ────────────────────────────────────────────────────────────────

  @Get('inclusions')
  @RequirePermissions(Permission.VIEW_TRIPS)
  @ApiGetInclusionsDocs()
  getInclusions(@Param('tourId') tourId: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.tourChildrenService.getInclusions(tourId, user.id, user.role);
  }

  @Post('inclusions')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiAddInclusionDocs()
  addInclusion(
    @Param('tourId') tourId: string,
    @Body() dto: CreateTourInclusionDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.addInclusion(tourId, dto, user.id, user.role);
  }

  @Patch('inclusions/:inclusionId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiUpdateInclusionDocs()
  updateInclusion(
    @Param('tourId') tourId: string,
    @Param('inclusionId') inclusionId: string,
    @Body() dto: UpdateTourInclusionDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.updateInclusion(tourId, inclusionId, dto, user.id, user.role);
  }

  @Delete('inclusions/:inclusionId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiRemoveInclusionDocs()
  removeInclusion(
    @Param('tourId') tourId: string,
    @Param('inclusionId') inclusionId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.removeInclusion(tourId, inclusionId, user.id, user.role);
  }

  @Patch('inclusions/:inclusionId/translations/:locale')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiUpsertInclusionTranslationDocs()
  upsertInclusionTranslation(
    @Param('tourId') tourId: string,
    @Param('inclusionId') inclusionId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertInclusionTranslationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.upsertInclusionTranslation(tourId, inclusionId, locale, dto, user.id, user.role);
  }

  @Delete('inclusions/:inclusionId/translations/:locale')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiDeleteInclusionTranslationDocs()
  deleteInclusionTranslation(
    @Param('tourId') tourId: string,
    @Param('inclusionId') inclusionId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.deleteInclusionTranslation(tourId, inclusionId, locale, user.id, user.role);
  }

  // ── Exclusions ────────────────────────────────────────────────────────────────

  @Get('exclusions')
  @RequirePermissions(Permission.VIEW_TRIPS)
  @ApiGetExclusionsDocs()
  getExclusions(@Param('tourId') tourId: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.tourChildrenService.getExclusions(tourId, user.id, user.role);
  }

  @Post('exclusions')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiAddExclusionDocs()
  addExclusion(
    @Param('tourId') tourId: string,
    @Body() dto: CreateTourExclusionDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.addExclusion(tourId, dto, user.id, user.role);
  }

  @Patch('exclusions/:exclusionId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiUpdateExclusionDocs()
  updateExclusion(
    @Param('tourId') tourId: string,
    @Param('exclusionId') exclusionId: string,
    @Body() dto: UpdateTourExclusionDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.updateExclusion(tourId, exclusionId, dto, user.id, user.role);
  }

  @Delete('exclusions/:exclusionId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiRemoveExclusionDocs()
  removeExclusion(
    @Param('tourId') tourId: string,
    @Param('exclusionId') exclusionId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.removeExclusion(tourId, exclusionId, user.id, user.role);
  }

  @Patch('exclusions/:exclusionId/translations/:locale')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiUpsertExclusionTranslationDocs()
  upsertExclusionTranslation(
    @Param('tourId') tourId: string,
    @Param('exclusionId') exclusionId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertExclusionTranslationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.upsertExclusionTranslation(tourId, exclusionId, locale, dto, user.id, user.role);
  }

  @Delete('exclusions/:exclusionId/translations/:locale')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiDeleteExclusionTranslationDocs()
  deleteExclusionTranslation(
    @Param('tourId') tourId: string,
    @Param('exclusionId') exclusionId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.deleteExclusionTranslation(tourId, exclusionId, locale, user.id, user.role);
  }

  // ── Features ──────────────────────────────────────────────────────────────────

  @Get('features')
  @RequirePermissions(Permission.VIEW_TRIPS)
  @ApiGetFeaturesDocs()
  getFeatures(@Param('tourId') tourId: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.tourChildrenService.getFeatures(tourId, user.id, user.role);
  }

  @Post('features')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiAddFeatureDocs()
  addFeature(
    @Param('tourId') tourId: string,
    @Body() dto: CreateTourFeatureDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.addFeature(tourId, dto, user.id, user.role);
  }

  @Patch('features/:featureId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiUpdateFeatureDocs()
  updateFeature(
    @Param('tourId') tourId: string,
    @Param('featureId') featureId: string,
    @Body() dto: UpdateTourFeatureDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.updateFeature(tourId, featureId, dto, user.id, user.role);
  }

  @Delete('features/:featureId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiRemoveFeatureDocs()
  removeFeature(
    @Param('tourId') tourId: string,
    @Param('featureId') featureId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.removeFeature(tourId, featureId, user.id, user.role);
  }

  @Patch('features/:featureId/translations/:locale')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiUpsertFeatureTranslationDocs()
  upsertFeatureTranslation(
    @Param('tourId') tourId: string,
    @Param('featureId') featureId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertFeatureTranslationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.upsertFeatureTranslation(tourId, featureId, locale, dto, user.id, user.role);
  }

  @Delete('features/:featureId/translations/:locale')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiDeleteFeatureTranslationDocs()
  deleteFeatureTranslation(
    @Param('tourId') tourId: string,
    @Param('featureId') featureId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.deleteFeatureTranslation(tourId, featureId, locale, user.id, user.role);
  }

  // ── Locations ─────────────────────────────────────────────────────────────────

  @Get('locations')
  @RequirePermissions(Permission.VIEW_TRIPS)
  @ApiGetLocationsDocs()
  getLocations(@Param('tourId') tourId: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.tourChildrenService.getLocations(tourId, user.id, user.role);
  }

  @Post('locations')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiAddLocationDocs()
  addLocation(
    @Param('tourId') tourId: string,
    @Body() dto: CreateTourLocationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.addLocation(tourId, dto, user.id, user.role);
  }

  @Patch('locations/:locationId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiUpdateLocationDocs()
  updateLocation(
    @Param('tourId') tourId: string,
    @Param('locationId') locationId: string,
    @Body() dto: UpdateTourLocationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.updateLocation(tourId, locationId, dto, user.id, user.role);
  }

  @Delete('locations/:locationId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiRemoveLocationDocs()
  removeLocation(
    @Param('tourId') tourId: string,
    @Param('locationId') locationId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.removeLocation(tourId, locationId, user.id, user.role);
  }

  @Patch('locations/:locationId/translations/:locale')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiUpsertLocationTranslationDocs()
  upsertLocationTranslation(
    @Param('tourId') tourId: string,
    @Param('locationId') locationId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertLocationTranslationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.upsertLocationTranslation(tourId, locationId, locale, dto, user.id, user.role);
  }

  @Delete('locations/:locationId/translations/:locale')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiDeleteLocationTranslationDocs()
  deleteLocationTranslation(
    @Param('tourId') tourId: string,
    @Param('locationId') locationId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.deleteLocationTranslation(tourId, locationId, locale, user.id, user.role);
  }

  // ── Pickup Locations ──────────────────────────────────────────────────────────

  @Get('pickup-locations')
  @RequirePermissions(Permission.VIEW_TRIPS)
  @ApiGetPickupLocationsDocs()
  getPickupLocations(@Param('tourId') tourId: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.tourChildrenService.getPickupLocations(tourId, user.id, user.role);
  }

  @Post('pickup-locations')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiAddPickupLocationDocs()
  addPickupLocation(
    @Param('tourId') tourId: string,
    @Body() dto: CreatePickupLocationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.addPickupLocation(tourId, dto, user.id, user.role);
  }

  @Patch('pickup-locations/:pickupLocationId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiUpdatePickupLocationDocs()
  updatePickupLocation(
    @Param('tourId') tourId: string,
    @Param('pickupLocationId') pickupLocationId: string,
    @Body() dto: UpdatePickupLocationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.updatePickupLocation(tourId, pickupLocationId, dto, user.id, user.role);
  }

  @Delete('pickup-locations/:pickupLocationId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiRemovePickupLocationDocs()
  removePickupLocation(
    @Param('tourId') tourId: string,
    @Param('pickupLocationId') pickupLocationId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.removePickupLocation(tourId, pickupLocationId, user.id, user.role);
  }

  @Patch('pickup-locations/:pickupLocationId/translations/:locale')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiUpsertPickupLocationTranslationDocs()
  upsertPickupLocationTranslation(
    @Param('tourId') tourId: string,
    @Param('pickupLocationId') pickupLocationId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertPickupLocationTranslationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.upsertPickupLocationTranslation(tourId, pickupLocationId, locale, dto, user.id, user.role);
  }

  @Delete('pickup-locations/:pickupLocationId/translations/:locale')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiDeletePickupLocationTranslationDocs()
  deletePickupLocationTranslation(
    @Param('tourId') tourId: string,
    @Param('pickupLocationId') pickupLocationId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.deletePickupLocationTranslation(tourId, pickupLocationId, locale, user.id, user.role);
  }

  // ── Tour Translations - static routes before :locale ─────────────────────────

  @Get('translations')
  @RequirePermissions(Permission.VIEW_TRIPS)
  @ApiGetAllTourTranslationsDocs()
  getAllTranslations(@Param('tourId') tourId: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.tourChildrenService.getAllTranslations(tourId, user.id, user.role);
  }

  @Get('translations/:locale')
  @RequirePermissions(Permission.VIEW_TRIPS)
  @ApiGetTourTranslationByLocaleDocs()
  getTranslationByLocale(
    @Param('tourId') tourId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.getTranslationByLocale(tourId, locale, user.id, user.role);
  }

  @Patch('translations/:locale')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiUpsertTourTranslationDocs()
  upsertTranslation(
    @Param('tourId') tourId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertTourTranslationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.upsertTranslation(tourId, locale, dto, user.id, user.role);
  }

  @Delete('translations/:locale')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiDeleteTourTranslationDocs()
  deleteTranslation(
    @Param('tourId') tourId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.deleteTranslation(tourId, locale, user.id, user.role);
  }

}
