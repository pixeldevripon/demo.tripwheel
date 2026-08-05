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
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Locale, Permission } from '@prisma/client';
import { DestinationService } from './destinations.service';
import {
  ApiCreateDestinationDocs,
  ApiCreateFaqDocs,
  ApiCreateFaqGroupDocs,
  ApiDeleteDestinationDocs,
  ApiForceDeleteDestinationDocs,
  ApiDeleteFaqDocs,
  ApiDeleteFaqGroupDocs,
  ApiDeleteTranslationsDocs,
  ApiGetActiveDestinationsDocs,
  ApiGetAllDestinationsDocs,
  ApiGetAllTranslationsDocs,
  ApiGetDestinationByIdDocs,
  ApiGetDestinationBySlugDocs,
  ApiGetFaqsDocs,
  ApiGetContentSectionsDocs,
  ApiCreateContentSectionDocs,
  ApiUpdateContentSectionDocs,
  ApiDeleteContentSectionDocs,
  ApiUpsertContentSectionTranslationDocs,
  ApiGetFaqGroupsDocs,
  ApiGetPageContentDocs,
  ApiGetPopularLinksAdminDocs,
  ApiGetPopularLinksDocs,
  ApiGetTranslationsByLocaleDocs,
  ApiReplacePopularLinksDocs,
  ApiUpdateDestinationDocs,
  ApiUpdateFaqDocs,
  ApiUpdateFaqGroupDocs,
  ApiUpsertFaqTranslationDocs,
  ApiUpsertPageContentDocs,
  ApiUpsertTranslationsDocs,
} from './destinations.swagger';
import {
  CreateFaqGroupDto,
  UpdateFaqGroupDto,
  UpsertFaqTranslationDto,
} from '@/common/faq/dto/faq-group.dto';
import {
  CreatePageContentSectionDto,
  UpdatePageContentSectionDto,
  UpsertPageContentSectionTranslationDto,
} from '@/common/page-content-sections/dto/page-content-section.dto';
import {
  CreateDestinationDto,
  CreateDestinationFaqDto,
  DestinationQueryDto,
  FaqLocaleQueryDto,
  LocaleQueryDto,
  ReplacePopularLinksDto,
  UpdateDestinationDto,
  UpdateDestinationFaqDto,
  UpsertDestinationPageContentDto,
  UpsertDestinationTranslationsDto,
} from './dto/destination.dto';

@ApiTags('Destinations')
@Controller('destinations')
/**
 * DestinationController - manages Caribbean island destinations (Curaçao, Aruba, etc.)
 *
 * ## Access-Control Strategy
 * - GET endpoints are `@Public()` - destinations are needed for frontend SSR.
 * - Mutating endpoints require explicit destination permissions (Admin + Editor only).
 * - `@Roles()` is deliberately NOT used - `@RequirePermissions()` alone is sufficient.
 *
 * ## Multilingual
 * - All public GET endpoints accept `?locale=` (default `en`).
 * - Destination names are proper nouns - translations are admin-managed, never AI-generated.
 * - Translation management, page content, and FAQs are admin-managed sub-resources.
 *
 * ## Route ordering
 * Static segments (`active`, `slug`) MUST appear before the dynamic `:id` segment.
 */
export class DestinationController {
  constructor(private readonly destinationService: DestinationService) {}

  // ── Public list / lookup ──────────────────────────────────────────────────────

  @Get()
  @Public()
  @ApiGetAllDestinationsDocs()
  getAll(@Query() query: DestinationQueryDto) {
    return this.destinationService.getAll(query);
  }

  @Get('active')
  @Public()
  @ApiGetActiveDestinationsDocs()
  getActive(@Query() query: LocaleQueryDto) {
    return this.destinationService.getActive(query.locale);
  }

  @Get('slug/:slug')
  @Public()
  @ApiGetDestinationBySlugDocs()
  getBySlug(@Param('slug') slug: string, @Query() query: LocaleQueryDto) {
    return this.destinationService.getBySlug(slug, query.locale);
  }

  // Static `slug/...` segment, so it MUST stay above the dynamic `:id` below.
  @Get('slug/:slug/popular-links')
  @Public()
  @ApiGetPopularLinksDocs()
  getPopularLinks(@Param('slug') slug: string, @Query() query: LocaleQueryDto) {
    return this.destinationService.getPopularLinks(slug, query.locale);
  }

  @Get(':id')
  @Public()
  @ApiGetDestinationByIdDocs()
  getById(@Param('id') id: string, @Query() query: LocaleQueryDto) {
    return this.destinationService.getById(id, query.locale);
  }

  // ── Admin CRUD ────────────────────────────────────────────────────────────────

  @Post()
  @RequirePermissions(Permission.CREATE_DESTINATION)
  @ApiCreateDestinationDocs()
  create(
    @Body() dto: CreateDestinationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.destinationService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiUpdateDestinationDocs()
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDestinationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.destinationService.update(id, dto, user.id);
  }

  @Delete(':id/force')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  @ApiForceDeleteDestinationDocs()
  forceDelete(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.destinationService.forceDelete(id, user.id);
  }

  @Delete(':id')
  @RequirePermissions(Permission.DELETE_DESTINATION)
  @ApiDeleteDestinationDocs()
  remove(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.destinationService.remove(id, user.id);
  }

  // ── Hero "Popular" links (Admin) ──────────────────────────────────────────────

  @Get(':id/popular-links')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiGetPopularLinksAdminDocs()
  getPopularLinksAdmin(@Param('id') id: string) {
    return this.destinationService.getPopularLinksAdmin(id);
  }

  @Put(':id/popular-links')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiReplacePopularLinksDocs()
  replacePopularLinks(
    @Param('id') id: string,
    @Body() dto: ReplacePopularLinksDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.destinationService.replacePopularLinks(id, dto.links, user.id);
  }

  // ── Translation management (Admin) ────────────────────────────────────────────

  @Get(':id/translations')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiGetAllTranslationsDocs()
  getAllTranslations(@Param('id') id: string) {
    return this.destinationService.getAllTranslations(id);
  }

  @Get(':id/translations/:locale')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiGetTranslationsByLocaleDocs()
  getTranslationsByLocale(
    @Param('id') id: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
  ) {
    return this.destinationService.getTranslationsByLocale(id, locale);
  }

  @Patch(':id/translations/:locale')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiUpsertTranslationsDocs()
  upsertTranslations(
    @Param('id') id: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertDestinationTranslationsDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.destinationService.upsertTranslations(id, locale, dto, user.id);
  }

  @Delete(':id/translations/:locale')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiDeleteTranslationsDocs()
  deleteTranslations(
    @Param('id') id: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.destinationService.deleteTranslations(id, locale, user.id);
  }

  // ── Page Content (public GET, admin PATCH) ────────────────────────────────────

  @Get(':id/page-content')
  @Public()
  @ApiGetPageContentDocs()
  getPageContent(@Param('id') id: string, @Query() query: PageContentQueryDto) {
    return this.destinationService.getPageContent(
      id,
      query.locale!,
      query.fallback,
    );
  }

  @Patch(':id/page-content/:locale')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiUpsertPageContentDocs()
  upsertPageContent(
    @Param('id') id: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertDestinationPageContentDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.destinationService.upsertPageContent(id, locale, dto, user.id);
  }

  // ── Page content sections (admin only) ────────────────────────────────────────
  // The public page reads these nested in GET :id/page-content, so there is no
  // @Public() route here.

  @Get(':id/content-sections')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiGetContentSectionsDocs()
  getContentSections(@Param('id') id: string) {
    return this.destinationService.getContentSections(id);
  }

  @Post(':id/content-sections')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiCreateContentSectionDocs()
  createContentSection(
    @Param('id') id: string,
    @Body() dto: CreatePageContentSectionDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.destinationService.createContentSection(id, dto, user.id);
  }

  @Patch(':id/content-sections/:groupId')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiUpdateContentSectionDocs()
  updateContentSection(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @Body() dto: UpdatePageContentSectionDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.destinationService.updateContentSection(
      id,
      groupId,
      dto,
      user.id,
    );
  }

  @Delete(':id/content-sections/:groupId')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiDeleteContentSectionDocs()
  deleteContentSection(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.destinationService.deleteContentSection(id, groupId, user.id);
  }

  /**
   * Clear ONE locale of a section (Translation Console). heading/body are NOT
   * NULL, so removing the row IS the cleared state - the page falls back to
   * English. `en` is rejected; delete the section instead.
   */
  @Delete(':id/content-sections/:groupId/translations/:locale')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiOperation({
    summary: 'Admin: clear one locale of a section (falls back to English)',
  })
  deleteContentSectionTranslation(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.destinationService.deleteContentSectionTranslation(
      id,
      groupId,
      locale,
      user.id,
    );
  }

  @Put(':id/content-sections/:groupId/translations/:locale')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiUpsertContentSectionTranslationDocs()
  upsertContentSectionTranslation(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertPageContentSectionTranslationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.destinationService.upsertContentSectionTranslation(
      id,
      groupId,
      locale,
      dto,
      user.id,
    );
  }

  // ── FAQ (public GET, admin write) ─────────────────────────────────────────────

  @Get(':id/faqs')
  @Public()
  @ApiGetFaqsDocs()
  getFaqs(@Param('id') id: string, @Query() query: FaqLocaleQueryDto) {
    return this.destinationService.getFaqs(id, query);
  }

  // Grouped FAQ routes ("groups" static segment declared before the dynamic
  // `:faqId` routes so it is never captured as an id).

  @Get(':id/faqs/groups')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiGetFaqGroupsDocs()
  getFaqGroups(@Param('id') id: string) {
    return this.destinationService.getFaqGroups(id);
  }

  @Post(':id/faqs/groups')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiCreateFaqGroupDocs()
  createFaqGroup(
    @Param('id') id: string,
    @Body() dto: CreateFaqGroupDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.destinationService.createFaqGroup(id, dto, user.id);
  }

  @Patch(':id/faqs/groups/:groupId')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiUpdateFaqGroupDocs()
  updateFaqGroup(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateFaqGroupDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.destinationService.updateFaqGroup(id, groupId, dto, user.id);
  }

  @Delete(':id/faqs/groups/:groupId')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiDeleteFaqGroupDocs()
  deleteFaqGroup(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.destinationService.deleteFaqGroup(id, groupId, user.id);
  }

  /**
   * Clear ONE locale of a FAQ (Translation Console). Question/answer are NOT
   * NULL, so removing the row IS the cleared state - the public page falls
   * back to English. `en` is rejected; delete the FAQ group instead.
   */
  @Delete(':id/faqs/groups/:groupId/translations/:locale')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiOperation({
    summary: 'Admin: clear one locale of a FAQ (falls back to English)',
  })
  deleteFaqTranslation(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.destinationService.deleteFaqTranslation(
      id,
      groupId,
      locale,
      user.id,
    );
  }

  @Put(':id/faqs/groups/:groupId/translations/:locale')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiUpsertFaqTranslationDocs()
  upsertFaqTranslation(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertFaqTranslationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.destinationService.upsertFaqTranslation(
      id,
      groupId,
      locale,
      dto,
      user.id,
    );
  }

  @Post(':id/faqs')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiCreateFaqDocs()
  createFaq(
    @Param('id') id: string,
    @Body() dto: CreateDestinationFaqDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.destinationService.createFaq(id, dto, user.id);
  }

  @Patch(':id/faqs/:faqId')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiUpdateFaqDocs()
  updateFaq(
    @Param('id') id: string,
    @Param('faqId') faqId: string,
    @Body() dto: UpdateDestinationFaqDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.destinationService.updateFaq(id, faqId, dto, user.id);
  }

  @Delete(':id/faqs/:faqId')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiDeleteFaqDocs()
  deleteFaq(
    @Param('id') id: string,
    @Param('faqId') faqId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.destinationService.deleteFaq(id, faqId, user.id);
  }
}
