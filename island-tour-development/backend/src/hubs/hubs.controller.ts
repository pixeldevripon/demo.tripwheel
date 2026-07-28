import { PageContentQueryDto } from '@/common/dto/page-content-query.dto';
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
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HubSectionType, Locale, Permission } from '@prisma/client';
import {
  ActiveHubsQueryDto,
  AddAllowedCategoryDto,
  CreateHubFaqDto,
  CreateHubDto,
  FaqLocaleQueryDto,
  HubBySlugQueryDto,
  HubQueryDto,
  HubRenderQueryDto,
  LocaleQueryDto,
  ReplaceContentSectionsDto,
  SetComparisonDto,
  SetOurPicksDto,
  UpdateHubFaqDto,
  UpdateHubDto,
  UpsertComparisonGroupTranslationDto,
  UpsertComparisonTourTranslationDto,
  UpsertHubPageContentDto,
  UpsertHubSectionTranslationDto,
  UpsertHubTranslationsDto,
  UpsertOurPickTranslationDto,
} from './dto/hub.dto';
import {
  CreateFaqGroupDto,
  UpdateFaqGroupDto,
  UpsertFaqTranslationDto,
} from '@/common/faq/dto/faq-group.dto';
import { HubService } from './hubs.service';
import {
  ApiAddAllowedCategoryDocs,
  ApiCreateFaqDocs,
  ApiCreateFaqGroupDocs,
  ApiCreateHubDocs,
  ApiDeleteFaqDocs,
  ApiDeleteFaqGroupDocs,
  ApiDeleteHubDocs,
  ApiDeleteTranslationsDocs,
  ApiGetActiveHubsDocs,
  ApiGetAllHubsDocs,
  ApiGetAllowedCategoriesDocs,
  ApiGetAllTranslationsDocs,
  ApiGetFaqGroupsDocs,
  ApiGetFaqsDocs,
  ApiGetHubByIdDocs,
  ApiGetHubBySlugDocs,
  ApiGetHubsByDestinationDocs,
  ApiGetPageContentDocs,
  ApiGetTranslationsByLocaleDocs,
  ApiRemoveAllowedCategoryDocs,
  ApiClearCurationTranslationDocs,
  ApiClearSectionTranslationDocs,
  ApiUpdateFaqDocs,
  ApiUpdateFaqGroupDocs,
  ApiUpdateHubDocs,
  ApiUpsertComparisonGroupTranslationDocs,
  ApiUpsertComparisonTourTranslationDocs,
  ApiUpsertFaqTranslationDocs,
  ApiUpsertOurPickTranslationDocs,
  ApiUpsertPageContentDocs,
  ApiUpsertSectionTranslationDocs,
  ApiUpsertTranslationsDocs,
} from './hubs.swagger';

@ApiTags('Hubs')
@Controller('hubs')
/**
 * HubController - manages destination-specific activity hubs (e.g. Klein Curaçao).
 *
 * ## Access-Control Strategy
 * - GET endpoints are `@Public()` - needed for frontend SSR and tour-creation wizard.
 * - All mutating endpoints require `MANAGE_HUBS` permission (Admin + Editor only).
 *
 * ## Multilingual
 * - All public GET endpoints accept `?locale=` (default `en`).
 * - Hub names are proper nouns - translations are admin-managed, never AI-generated.
 * - Translation management, page content, and FAQs are admin-managed sub-resources.
 *
 * ## Slug lifecycle
 * - Slug auto-generated from name at creation; immutable after creation.
 * - DELETE is a soft-delete (`isActive = false`) because slug_registry rows are permanent.
 *
 * ## Route ordering
 * Static segments (`active`, `slug`) MUST appear before the dynamic `:id` segment.
 */
export class HubController {
  constructor(private readonly hubService: HubService) {}

  // ── Public list / lookup ──────────────────────────────────────────────────────

  @Get()
  @Public()
  @ApiGetAllHubsDocs()
  getAll(@Query() query: HubQueryDto) {
    return this.hubService.getAll(query);
  }

  @Get('active')
  @Public()
  @ApiGetActiveHubsDocs()
  getActive(@Query() query: ActiveHubsQueryDto) {
    return this.hubService.getActive(query);
  }

  @Get('slug/:slug')
  @Public()
  @ApiGetHubBySlugDocs()
  getBySlug(@Param('slug') slug: string, @Query() query: HubBySlugQueryDto) {
    return this.hubService.getBySlug(slug, query);
  }

  /** Full public render payload (hero, editorial lead, Our Picks, comparison, Discover/Local Tips, FAQ, related). */
  @Get('render/:slug')
  @Public()
  render(@Param('slug') slug: string, @Query() query: HubRenderQueryDto) {
    return this.hubService.render(slug, query);
  }

  // Static `destination/...` segment MUST precede the dynamic `:id` route below.
  @Get('destination/:destinationSlug')
  @Public()
  @ApiGetHubsByDestinationDocs()
  getActiveByDestination(
    @Param('destinationSlug') destinationSlug: string,
    @Query() query: LocaleQueryDto,
  ) {
    return this.hubService.getActiveByDestinationSlug(
      destinationSlug,
      query.locale,
    );
  }

  @Get(':id')
  @Public()
  @ApiGetHubByIdDocs()
  getById(@Param('id') id: string, @Query() query: LocaleQueryDto) {
    return this.hubService.getById(id, query.locale);
  }

  // ── Admin CRUD ────────────────────────────────────────────────────────────────

  @Post()
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiCreateHubDocs()
  create(@Body() dto: CreateHubDto, @AuthenticatedUser() user: TypedAuthUser) {
    return this.hubService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiUpdateHubDocs()
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHubDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiDeleteHubDocs()
  remove(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.hubService.remove(id, user.id);
  }

  // ── Translation management (Admin) ────────────────────────────────────────────

  @Get(':id/translations')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiGetAllTranslationsDocs()
  getAllTranslations(@Param('id') id: string) {
    return this.hubService.getAllTranslations(id);
  }

  @Get(':id/translations/:locale')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiGetTranslationsByLocaleDocs()
  getTranslationsByLocale(
    @Param('id') id: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
  ) {
    return this.hubService.getTranslationsByLocale(id, locale);
  }

  @Patch(':id/translations/:locale')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiUpsertTranslationsDocs()
  upsertTranslations(
    @Param('id') id: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertHubTranslationsDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.upsertTranslations(id, locale, dto, user.id);
  }

  @Delete(':id/translations/:locale')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiDeleteTranslationsDocs()
  deleteTranslations(
    @Param('id') id: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.deleteTranslations(id, locale, user.id);
  }

  // ── Page Content (public GET, admin PATCH) ────────────────────────────────────

  @Get(':id/page-content')
  @Public()
  @ApiGetPageContentDocs()
  getPageContent(@Param('id') id: string, @Query() query: PageContentQueryDto) {
    return this.hubService.getPageContent(id, query.locale!, query.fallback);
  }

  @Patch(':id/page-content/:locale')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiUpsertPageContentDocs()
  upsertPageContent(
    @Param('id') id: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertHubPageContentDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.upsertPageContent(id, locale, dto, user.id);
  }

  // ── FAQ (public GET, admin write) ─────────────────────────────────────────────

  @Get(':id/faqs')
  @Public()
  @ApiGetFaqsDocs()
  getFaqs(@Param('id') id: string, @Query() query: FaqLocaleQueryDto) {
    return this.hubService.getFaqs(id, query);
  }

  // Grouped FAQ routes ("groups" static segment declared before the dynamic
  // `:faqId` routes so it is never captured as an id).

  @Get(':id/faqs/groups')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiGetFaqGroupsDocs()
  getFaqGroups(@Param('id') id: string) {
    return this.hubService.getFaqGroups(id);
  }

  @Post(':id/faqs/groups')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiCreateFaqGroupDocs()
  createFaqGroup(
    @Param('id') id: string,
    @Body() dto: CreateFaqGroupDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.createFaqGroup(id, dto, user.id);
  }

  @Patch(':id/faqs/groups/:groupId')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiUpdateFaqGroupDocs()
  updateFaqGroup(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateFaqGroupDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.updateFaqGroup(id, groupId, dto, user.id);
  }

  @Delete(':id/faqs/groups/:groupId')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiDeleteFaqGroupDocs()
  deleteFaqGroup(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.deleteFaqGroup(id, groupId, user.id);
  }

  /**
   * Clear ONE locale of a FAQ (Translation Console). Question/answer are NOT
   * NULL, so removing the row IS the cleared state - the public page falls
   * back to English. `en` is rejected; delete the FAQ group instead.
   */
  @Delete(':id/faqs/groups/:groupId/translations/:locale')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiOperation({
    summary: 'Admin: clear one locale of a FAQ (falls back to English)',
  })
  deleteFaqTranslation(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.deleteFaqTranslation(id, groupId, locale, user.id);
  }

  @Put(':id/faqs/groups/:groupId/translations/:locale')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiUpsertFaqTranslationDocs()
  upsertFaqTranslation(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertFaqTranslationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.upsertFaqTranslation(
      id,
      groupId,
      locale,
      dto,
      user.id,
    );
  }

  @Post(':id/faqs')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiCreateFaqDocs()
  createFaq(
    @Param('id') id: string,
    @Body() dto: CreateHubFaqDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.createFaq(id, dto, user.id);
  }

  @Patch(':id/faqs/:faqId')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiUpdateFaqDocs()
  updateFaq(
    @Param('id') id: string,
    @Param('faqId') faqId: string,
    @Body() dto: UpdateHubFaqDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.updateFaq(id, faqId, dto, user.id);
  }

  @Delete(':id/faqs/:faqId')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiDeleteFaqDocs()
  deleteFaq(
    @Param('id') id: string,
    @Param('faqId') faqId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.deleteFaq(id, faqId, user.id);
  }

  // ── Allowed categories sub-routes ─────────────────────────────────────────────

  @Get(':id/allowed-categories')
  @Public()
  @ApiGetAllowedCategoriesDocs()
  getAllowedCategories(@Param('id') id: string) {
    return this.hubService.getAllowedCategories(id);
  }

  @Post(':id/allowed-categories')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiAddAllowedCategoryDocs()
  addAllowedCategory(
    @Param('id') id: string,
    @Body() dto: AddAllowedCategoryDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.addAllowedCategory(id, dto, user.id);
  }

  @Delete(':id/allowed-categories/:categoryId')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiRemoveAllowedCategoryDocs()
  removeAllowedCategory(
    @Param('id') id: string,
    @Param('categoryId') categoryId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.removeAllowedCategory(id, categoryId, user.id);
  }

  // ── Content sections: Discover / Local Tips / Fast Facts / Editorial (HUB-DATA §5) ──

  @Get(':id/content-sections')
  @Public()
  getContentSections(@Param('id') id: string, @Query() query: LocaleQueryDto) {
    return this.hubService.getContentSections(id, query.locale);
  }

  /**
   * Every stored locale, for the Translation Console. Declared before the
   * dynamic `:sectionType` routes so `edit` is never read as a section type.
   */
  @Get(':id/content-sections/edit')
  @RequirePermissions(Permission.MANAGE_HUBS)
  getContentSectionsForEdit(@Param('id') id: string) {
    return this.hubService.getContentSectionsForEdit(id);
  }

  @Put(':id/content-sections')
  @RequirePermissions(Permission.MANAGE_HUBS)
  replaceContentSections(
    @Param('id') id: string,
    @Body() dto: ReplaceContentSectionsDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.replaceContentSections(id, dto, user.id);
  }

  /** Translation Console "clear" - drop one locale's row for this block. */
  @Delete(
    ':id/content-sections/:sectionType/:displayOrder/translations/:locale',
  )
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiClearSectionTranslationDocs()
  deleteContentSectionTranslation(
    @Param('id') id: string,
    @Param('sectionType', new ParseEnumPipe(HubSectionType))
    sectionType: HubSectionType,
    @Param('displayOrder', ParseIntPipe) displayOrder: number,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.deleteContentSectionTranslation(
      id,
      sectionType,
      displayOrder,
      locale,
      user.id,
    );
  }

  /** Translation Console per-block save - one locale of one content block. */
  @Put(':id/content-sections/:sectionType/:displayOrder/translations/:locale')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiUpsertSectionTranslationDocs()
  upsertContentSectionTranslation(
    @Param('id') id: string,
    @Param('sectionType', new ParseEnumPipe(HubSectionType))
    sectionType: HubSectionType,
    @Param('displayOrder', ParseIntPipe) displayOrder: number,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertHubSectionTranslationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.upsertContentSectionTranslation(
      id,
      sectionType,
      displayOrder,
      locale,
      dto,
      user.id,
    );
  }

  // ── Our Picks (best overall / most popular / best for families) ─────────────────

  @Get(':id/our-picks')
  @Public()
  getOurPicks(@Param('id') id: string, @Query() query: LocaleQueryDto) {
    return this.hubService.getOurPicks(
      id,
      query.locale ?? Locale.en,
      query.currency,
    );
  }

  @Get(':id/our-picks/edit')
  @RequirePermissions(Permission.MANAGE_HUBS)
  getOurPicksForEdit(@Param('id') id: string) {
    return this.hubService.getOurPicksForEdit(id);
  }

  @Put(':id/our-picks')
  @RequirePermissions(Permission.MANAGE_HUBS)
  setOurPicks(
    @Param('id') id: string,
    @Body() dto: SetOurPicksDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.setOurPicks(id, dto, user.id);
  }

  /** Translation Console "clear" - drop one locale's rationale row. */
  @Delete(':id/our-picks/:pickId/translations/:locale')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiClearCurationTranslationDocs('Our Pick rationale', 'pickId')
  deleteOurPickTranslation(
    @Param('id') id: string,
    @Param('pickId') pickId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.deleteOurPickTranslation(
      id,
      pickId,
      locale,
      user.id,
    );
  }

  /** Translation Console per-item save - one locale of one pick's rationale. */
  @Put(':id/our-picks/:pickId/translations/:locale')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiUpsertOurPickTranslationDocs()
  upsertOurPickTranslation(
    @Param('id') id: string,
    @Param('pickId') pickId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertOurPickTranslationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.upsertOurPickTranslation(
      id,
      pickId,
      locale,
      dto,
      user.id,
    );
  }

  // ── Comparison table (Comfort vs Adventure, per-locale, standout cells) ─────────

  @Get(':id/comparison')
  @Public()
  getComparison(@Param('id') id: string, @Query() query: LocaleQueryDto) {
    return this.hubService.getComparison(
      id,
      query.locale ?? Locale.en,
      query.currency,
    );
  }

  @Get(':id/comparison/edit')
  @RequirePermissions(Permission.MANAGE_HUBS)
  getComparisonForEdit(@Param('id') id: string) {
    return this.hubService.getComparisonForEdit(id);
  }

  @Put(':id/comparison')
  @RequirePermissions(Permission.MANAGE_HUBS)
  setComparison(
    @Param('id') id: string,
    @Body() dto: SetComparisonDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.setComparison(id, dto, user.id);
  }

  /** Translation Console "clear" - drop one locale's group-name row. */
  @Delete(':id/comparison/groups/:groupId/translations/:locale')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiClearCurationTranslationDocs('comparison group name', 'groupId')
  deleteComparisonGroupTranslation(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.deleteComparisonGroupTranslation(
      id,
      groupId,
      locale,
      user.id,
    );
  }

  /** Translation Console "clear" - drop one locale's standout-note row. */
  @Delete(':id/comparison/tours/:comparisonTourId/translations/:locale')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiClearCurationTranslationDocs('standout note', 'comparisonTourId')
  deleteComparisonTourTranslation(
    @Param('id') id: string,
    @Param('comparisonTourId') comparisonTourId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.deleteComparisonTourTranslation(
      id,
      comparisonTourId,
      locale,
      user.id,
    );
  }

  /** Translation Console per-item save - one locale of one group's name. */
  @Put(':id/comparison/groups/:groupId/translations/:locale')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiUpsertComparisonGroupTranslationDocs()
  upsertComparisonGroupTranslation(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertComparisonGroupTranslationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.upsertComparisonGroupTranslation(
      id,
      groupId,
      locale,
      dto,
      user.id,
    );
  }

  /** Translation Console per-item save - one locale of one column's standout note. */
  @Put(':id/comparison/tours/:comparisonTourId/translations/:locale')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiUpsertComparisonTourTranslationDocs()
  upsertComparisonTourTranslation(
    @Param('id') id: string,
    @Param('comparisonTourId') comparisonTourId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertComparisonTourTranslationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.hubService.upsertComparisonTourTranslation(
      id,
      comparisonTourId,
      locale,
      dto,
      user.id,
    );
  }
}
