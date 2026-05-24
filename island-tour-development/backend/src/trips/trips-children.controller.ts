import type { TypedAuthUser } from '@/auth/auth.types';
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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Locale, Permission } from '@prisma/client';
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
import {
  ApiAddAddOnDocs,
  ApiAddAgeBandDocs,
  ApiAddHighlightDocs,
  ApiAddImageDocs,
  ApiAddInclusionDocs,
  ApiAddLanguageDocs,
  ApiCreateScheduleDocs,
  ApiDeleteHighlightTranslationDocs,
  ApiDeleteInclusionTranslationDocs,
  ApiDeleteTripTranslationDocs,
  ApiGetAddOnsDocs,
  ApiGetAgeBandsDocs,
  ApiGetAllTripTranslationsDocs,
  ApiGetHighlightsDocs,
  ApiGetImagesDocs,
  ApiGetInclusionsDocs,
  ApiGetLanguagesDocs,
  ApiGetSchedulesDocs,
  ApiGetTripTranslationByLocaleDocs,
  ApiRemoveAddOnDocs,
  ApiRemoveAgeBandDocs,
  ApiRemoveHighlightDocs,
  ApiRemoveImageDocs,
  ApiRemoveInclusionDocs,
  ApiRemoveLanguageDocs,
  ApiRemoveScheduleDocs,
  ApiUpdateAddOnDocs,
  ApiUpdateAgeBandDocs,
  ApiUpdateHighlightDocs,
  ApiUpdateImageDocs,
  ApiUpdateInclusionDocs,
  ApiUpdateScheduleDocs,
  ApiUpsertHighlightTranslationDocs,
  ApiUpsertInclusionTranslationDocs,
  ApiUpsertTripTranslationDocs,
} from './trips-children.swagger';
import { TripChildrenService } from './trips-children.service';

@ApiTags('Trip Children')
@Controller('trips/:tripId')
/**
 * TripChildrenController — manages all child models nested under a trip.
 *
 * ## Route ordering
 * Static segments (translations, schedules) MUST appear before dynamic
 * (:locale, :scheduleId) routes in each sub-resource group.
 *
 * ## Access-Control
 * GET /schedules is @Public() — travelers need availability data.
 * All other endpoints require EDIT_TRIP permission.
 */
export class TripChildrenController {
  constructor(private readonly tripChildrenService: TripChildrenService) {}

  // ── Images ────────────────────────────────────────────────────────────────────

  @Get('images')
  @RequirePermissions(Permission.VIEW_TRIPS)
  @ApiGetImagesDocs()
  getImages(@Param('tripId') tripId: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.tripChildrenService.getImages(tripId, user.id, user.role);
  }

  @Post('images')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiAddImageDocs()
  addImage(
    @Param('tripId') tripId: string,
    @Body() dto: AddTourImageDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripChildrenService.addImage(tripId, dto, user.id, user.role);
  }

  @Patch('images/:imageId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiUpdateImageDocs()
  updateImage(
    @Param('tripId') tripId: string,
    @Param('imageId') imageId: string,
    @Body() dto: UpdateTourImageDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripChildrenService.updateImage(tripId, imageId, dto, user.id, user.role);
  }

  @Delete('images/:imageId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiRemoveImageDocs()
  removeImage(
    @Param('tripId') tripId: string,
    @Param('imageId') imageId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripChildrenService.removeImage(tripId, imageId, user.id, user.role);
  }

  // ── Age Bands ─────────────────────────────────────────────────────────────────

  @Get('age-bands')
  @RequirePermissions(Permission.VIEW_TRIPS)
  @ApiGetAgeBandsDocs()
  getAgeBands(@Param('tripId') tripId: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.tripChildrenService.getAgeBands(tripId, user.id, user.role);
  }

  @Post('age-bands')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiAddAgeBandDocs()
  addAgeBand(
    @Param('tripId') tripId: string,
    @Body() dto: CreateTourAgeBandDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripChildrenService.addAgeBand(tripId, dto, user.id, user.role);
  }

  @Patch('age-bands/:bandId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiUpdateAgeBandDocs()
  updateAgeBand(
    @Param('tripId') tripId: string,
    @Param('bandId') bandId: string,
    @Body() dto: UpdateTourAgeBandDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripChildrenService.updateAgeBand(tripId, bandId, dto, user.id, user.role);
  }

  @Delete('age-bands/:bandId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiRemoveAgeBandDocs()
  removeAgeBand(
    @Param('tripId') tripId: string,
    @Param('bandId') bandId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripChildrenService.removeAgeBand(tripId, bandId, user.id, user.role);
  }

  // ── Add-Ons ───────────────────────────────────────────────────────────────────

  @Get('addons')
  @RequirePermissions(Permission.VIEW_TRIPS)
  @ApiGetAddOnsDocs()
  getAddOns(@Param('tripId') tripId: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.tripChildrenService.getAddOns(tripId, user.id, user.role);
  }

  @Post('addons')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiAddAddOnDocs()
  addAddOn(
    @Param('tripId') tripId: string,
    @Body() dto: CreateTourAddOnDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripChildrenService.addAddOn(tripId, dto, user.id, user.role);
  }

  @Patch('addons/:addonId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiUpdateAddOnDocs()
  updateAddOn(
    @Param('tripId') tripId: string,
    @Param('addonId') addonId: string,
    @Body() dto: UpdateTourAddOnDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripChildrenService.updateAddOn(tripId, addonId, dto, user.id, user.role);
  }

  @Delete('addons/:addonId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiRemoveAddOnDocs()
  removeAddOn(
    @Param('tripId') tripId: string,
    @Param('addonId') addonId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripChildrenService.removeAddOn(tripId, addonId, user.id, user.role);
  }

  // ── Languages ─────────────────────────────────────────────────────────────────

  @Get('languages')
  @RequirePermissions(Permission.VIEW_TRIPS)
  @ApiGetLanguagesDocs()
  getLanguages(@Param('tripId') tripId: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.tripChildrenService.getLanguages(tripId, user.id, user.role);
  }

  @Post('languages')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiAddLanguageDocs()
  addLanguage(
    @Param('tripId') tripId: string,
    @Body() dto: AddTourLanguageDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripChildrenService.addLanguage(tripId, dto, user.id, user.role);
  }

  @Delete('languages/:languageId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiRemoveLanguageDocs()
  removeLanguage(
    @Param('tripId') tripId: string,
    @Param('languageId') languageId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripChildrenService.removeLanguage(tripId, languageId, user.id, user.role);
  }

  // ── Highlights ────────────────────────────────────────────────────────────────

  @Get('highlights')
  @RequirePermissions(Permission.VIEW_TRIPS)
  @ApiGetHighlightsDocs()
  getHighlights(@Param('tripId') tripId: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.tripChildrenService.getHighlights(tripId, user.id, user.role);
  }

  @Post('highlights')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiAddHighlightDocs()
  addHighlight(
    @Param('tripId') tripId: string,
    @Body() dto: CreateTourHighlightDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripChildrenService.addHighlight(tripId, dto, user.id, user.role);
  }

  @Patch('highlights/:highlightId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiUpdateHighlightDocs()
  updateHighlight(
    @Param('tripId') tripId: string,
    @Param('highlightId') highlightId: string,
    @Body() dto: UpdateTourHighlightDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripChildrenService.updateHighlight(tripId, highlightId, dto, user.id, user.role);
  }

  @Delete('highlights/:highlightId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiRemoveHighlightDocs()
  removeHighlight(
    @Param('tripId') tripId: string,
    @Param('highlightId') highlightId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripChildrenService.removeHighlight(tripId, highlightId, user.id, user.role);
  }

  @Patch('highlights/:highlightId/translations/:locale')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiUpsertHighlightTranslationDocs()
  upsertHighlightTranslation(
    @Param('tripId') tripId: string,
    @Param('highlightId') highlightId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertHighlightTranslationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripChildrenService.upsertHighlightTranslation(tripId, highlightId, locale, dto, user.id, user.role);
  }

  @Delete('highlights/:highlightId/translations/:locale')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiDeleteHighlightTranslationDocs()
  deleteHighlightTranslation(
    @Param('tripId') tripId: string,
    @Param('highlightId') highlightId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripChildrenService.deleteHighlightTranslation(tripId, highlightId, locale, user.id, user.role);
  }

  // ── Inclusions ────────────────────────────────────────────────────────────────

  @Get('inclusions')
  @RequirePermissions(Permission.VIEW_TRIPS)
  @ApiGetInclusionsDocs()
  getInclusions(@Param('tripId') tripId: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.tripChildrenService.getInclusions(tripId, user.id, user.role);
  }

  @Post('inclusions')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiAddInclusionDocs()
  addInclusion(
    @Param('tripId') tripId: string,
    @Body() dto: CreateTourInclusionDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripChildrenService.addInclusion(tripId, dto, user.id, user.role);
  }

  @Patch('inclusions/:inclusionId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiUpdateInclusionDocs()
  updateInclusion(
    @Param('tripId') tripId: string,
    @Param('inclusionId') inclusionId: string,
    @Body() dto: UpdateTourInclusionDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripChildrenService.updateInclusion(tripId, inclusionId, dto, user.id, user.role);
  }

  @Delete('inclusions/:inclusionId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiRemoveInclusionDocs()
  removeInclusion(
    @Param('tripId') tripId: string,
    @Param('inclusionId') inclusionId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripChildrenService.removeInclusion(tripId, inclusionId, user.id, user.role);
  }

  @Patch('inclusions/:inclusionId/translations/:locale')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiUpsertInclusionTranslationDocs()
  upsertInclusionTranslation(
    @Param('tripId') tripId: string,
    @Param('inclusionId') inclusionId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertInclusionTranslationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripChildrenService.upsertInclusionTranslation(tripId, inclusionId, locale, dto, user.id, user.role);
  }

  @Delete('inclusions/:inclusionId/translations/:locale')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiDeleteInclusionTranslationDocs()
  deleteInclusionTranslation(
    @Param('tripId') tripId: string,
    @Param('inclusionId') inclusionId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripChildrenService.deleteInclusionTranslation(tripId, inclusionId, locale, user.id, user.role);
  }

  // ── Trip Translations — static routes before :locale ─────────────────────────

  @Get('translations')
  @RequirePermissions(Permission.VIEW_TRIPS)
  @ApiGetAllTripTranslationsDocs()
  getAllTranslations(@Param('tripId') tripId: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.tripChildrenService.getAllTranslations(tripId, user.id, user.role);
  }

  @Get('translations/:locale')
  @RequirePermissions(Permission.VIEW_TRIPS)
  @ApiGetTripTranslationByLocaleDocs()
  getTranslationByLocale(
    @Param('tripId') tripId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripChildrenService.getTranslationByLocale(tripId, locale, user.id, user.role);
  }

  @Patch('translations/:locale')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiUpsertTripTranslationDocs()
  upsertTranslation(
    @Param('tripId') tripId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertTripTranslationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripChildrenService.upsertTranslation(tripId, locale, dto, user.id, user.role);
  }

  @Delete('translations/:locale')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiDeleteTripTranslationDocs()
  deleteTranslation(
    @Param('tripId') tripId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripChildrenService.deleteTranslation(tripId, locale, user.id, user.role);
  }

  // ── Schedules — @Public GET ───────────────────────────────────────────────────

  @Get('schedules')
  @Public()
  @ApiGetSchedulesDocs()
  getSchedules(@Param('tripId') tripId: string) {
    return this.tripChildrenService.getSchedules(tripId);
  }

  @Post('schedules')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiCreateScheduleDocs()
  createSchedule(
    @Param('tripId') tripId: string,
    @Body() dto: CreateTourScheduleDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripChildrenService.createSchedule(tripId, dto, user.id, user.role);
  }

  @Patch('schedules/:scheduleId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiUpdateScheduleDocs()
  updateSchedule(
    @Param('tripId') tripId: string,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: UpdateTourScheduleDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripChildrenService.updateSchedule(tripId, scheduleId, dto, user.id, user.role);
  }

  @Delete('schedules/:scheduleId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiRemoveScheduleDocs()
  removeSchedule(
    @Param('tripId') tripId: string,
    @Param('scheduleId') scheduleId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripChildrenService.removeSchedule(tripId, scheduleId, user.id, user.role);
  }
}
