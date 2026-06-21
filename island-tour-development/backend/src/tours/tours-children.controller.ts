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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Locale, Permission, Role } from '@prisma/client';
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
  UpsertTourTranslationDto,
} from './dto/tour-children.dto';
import {
  ApiAddAddOnDocs,
  ApiAddHighlightDocs,
  ApiAddImageDocs,
  ApiAddInclusionDocs,
  ApiAddLanguageDocs,
  ApiDeleteHighlightTranslationDocs,
  ApiDeleteInclusionTranslationDocs,
  ApiDeleteTourTranslationDocs,
  ApiGetAddOnsDocs,
  ApiGetAllTourTranslationsDocs,
  ApiGetHighlightsDocs,
  ApiGetImagesDocs,
  ApiGetInclusionsDocs,
  ApiGetLanguagesDocs,
  ApiGetTourTranslationByLocaleDocs,
  ApiRemoveAddOnDocs,
  ApiRemoveHighlightDocs,
  ApiRemoveImageDocs,
  ApiRemoveInclusionDocs,
  ApiRemoveLanguageDocs,
  ApiUpdateAddOnDocs,
  ApiUpdateHighlightDocs,
  ApiUpdateImageDocs,
  ApiUpdateInclusionDocs,
  ApiUpsertHighlightTranslationDocs,
  ApiUpsertInclusionTranslationDocs,
  ApiUpsertTourTranslationDocs,
} from './tours-children.swagger';
import { TourChildrenService } from './tours-children.service';

@ApiTags('Tour Children')
@Controller('tours/:tourId')
/**
 * TourChildrenController — manages all child models nested under a tour.
 *
 * ## Route ordering
 * Static segments (translations, schedules) MUST appear before dynamic
 * (:locale, :scheduleId) routes in each sub-resource group.
 *
 * ## Access-Control
 * GET /schedules is @Public() — travelers need availability data.
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

  // ── Highlights ────────────────────────────────────────────────────────────────

  @Get('highlights')
  @RequirePermissions(Permission.VIEW_TRIPS)
  @ApiGetHighlightsDocs()
  getHighlights(@Param('tourId') tourId: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.tourChildrenService.getHighlights(tourId, user.id, user.role);
  }

  @Post('highlights')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiAddHighlightDocs()
  addHighlight(
    @Param('tourId') tourId: string,
    @Body() dto: CreateTourHighlightDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.addHighlight(tourId, dto, user.id, user.role);
  }

  @Patch('highlights/:highlightId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiUpdateHighlightDocs()
  updateHighlight(
    @Param('tourId') tourId: string,
    @Param('highlightId') highlightId: string,
    @Body() dto: UpdateTourHighlightDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.updateHighlight(tourId, highlightId, dto, user.id, user.role);
  }

  @Delete('highlights/:highlightId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiRemoveHighlightDocs()
  removeHighlight(
    @Param('tourId') tourId: string,
    @Param('highlightId') highlightId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.removeHighlight(tourId, highlightId, user.id, user.role);
  }

  @Patch('highlights/:highlightId/translations/:locale')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiUpsertHighlightTranslationDocs()
  upsertHighlightTranslation(
    @Param('tourId') tourId: string,
    @Param('highlightId') highlightId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertHighlightTranslationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.upsertHighlightTranslation(tourId, highlightId, locale, dto, user.id, user.role);
  }

  @Delete('highlights/:highlightId/translations/:locale')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiDeleteHighlightTranslationDocs()
  deleteHighlightTranslation(
    @Param('tourId') tourId: string,
    @Param('highlightId') highlightId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.deleteHighlightTranslation(tourId, highlightId, locale, user.id, user.role);
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
  @ApiOperation({ summary: "List a tour's exclusions (what's NOT included)" })
  getExclusions(@Param('tourId') tourId: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.tourChildrenService.getExclusions(tourId, user.id, user.role);
  }

  @Post('exclusions')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiOperation({ summary: 'Add an exclusion to a tour (creates the English label)' })
  addExclusion(
    @Param('tourId') tourId: string,
    @Body() dto: CreateTourExclusionDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.addExclusion(tourId, dto, user.id, user.role);
  }

  @Patch('exclusions/:exclusionId')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiOperation({ summary: 'Update an exclusion (icon / order / image)' })
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
  @ApiOperation({ summary: 'Remove an exclusion from a tour' })
  removeExclusion(
    @Param('tourId') tourId: string,
    @Param('exclusionId') exclusionId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.removeExclusion(tourId, exclusionId, user.id, user.role);
  }

  @Patch('exclusions/:exclusionId/translations/:locale')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiOperation({ summary: 'Upsert an exclusion label translation for a locale' })
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
  @ApiOperation({ summary: 'Delete a non-English exclusion translation' })
  deleteExclusionTranslation(
    @Param('tourId') tourId: string,
    @Param('exclusionId') exclusionId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tourChildrenService.deleteExclusionTranslation(tourId, exclusionId, locale, user.id, user.role);
  }

  // ── Tour Translations — static routes before :locale ─────────────────────────

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
