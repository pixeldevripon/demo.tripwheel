import type { TypedAuthUser } from '@/auth/auth.types';
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import { Public } from '@/auth/decorators/public.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { Body, Controller, Delete, Get, Param, ParseEnumPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Locale, Permission } from '@prisma/client';
import { CollectionsService } from './collections.service';
import {
  ApiCreateCollectionDocs,
  ApiCreateCollectionFaqDocs,
  ApiDeleteCollectionDocs,
  ApiDeleteCollectionFaqDocs,
  ApiDeleteCollectionTranslationsDocs,
  ApiForceDeleteCollectionDocs,
  ApiGetActiveCollectionsDocs,
  ApiGetCollectionBySlugDocs,
  ApiGetCollectionFaqsDocs,
  ApiGetCollectionPageContentDocs,
  ApiGetCollectionTranslationByLocaleDocs,
  ApiGetCollectionTranslationsDocs,
  ApiRenderCollectionDocs,
  ApiReplaceCollectionToursDocs,
  ApiUpdateCollectionDocs,
  ApiUpdateCollectionFaqDocs,
  ApiUpdateCollectionStatusDocs,
  ApiUpsertCollectionPageContentDocs,
  ApiUpsertCollectionTourRationaleDocs,
  ApiUpsertCollectionTranslationsDocs,
} from './collections.swagger';
import {
  ActiveCollectionsQueryDto,
  CollectionBySlugQueryDto,
  CollectionRenderQueryDto,
  CreateCollectionDto,
  CreateFaqDto,
  FaqLocaleQueryDto,
  LocaleQueryDto,
  ReplaceCollectionToursDto,
  UpdateCollectionDto,
  UpdateCollectionStatusDto,
  UpdateFaqDto,
  UpsertCollectionPageContentDto,
  UpsertCollectionTourRationaleDto,
  UpsertCollectionTranslationsDto,
} from './dto/collection.dto';

@ApiTags('Collections')
@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  // ── Public ────────────────────────────────────────────────────────────────────

  @Get()
  @Public()
  @ApiGetActiveCollectionsDocs()
  getActive(@Query() query: ActiveCollectionsQueryDto) {
    return this.collectionsService.getActiveByDestinationSlug(query.destinationSlug, query.locale);
  }

  @Get('slug/:slug')
  @Public()
  @ApiGetCollectionBySlugDocs()
  getBySlug(@Param('slug') slug: string, @Query() query: CollectionBySlugQueryDto) {
    return this.collectionsService.getBySlug(query.destinationSlug, slug, query.locale);
  }

  @Get('render/:slug')
  @Public()
  @ApiRenderCollectionDocs()
  render(@Param('slug') slug: string, @Query() query: CollectionRenderQueryDto) {
    return this.collectionsService.render(slug, query.destinationId, query.locale);
  }

  // ── Admin CRUD ────────────────────────────────────────────────────────────────

  @Get('admin/all')
  @RequirePermissions(Permission.VIEW_COLLECTIONS)
  @ApiOperation({ summary: 'Admin: list all collections (active + inactive) for a destination slug' })
  getAllAdmin(@Query() query: ActiveCollectionsQueryDto) {
    return this.collectionsService.getAllByDestinationAdmin(query.destinationSlug);
  }

  @Get(':id')
  @RequirePermissions(Permission.VIEW_COLLECTIONS)
  @ApiOperation({ summary: 'Admin: get a single collection by id (for the edit form)' })
  getByIdAdmin(@Param('id') id: string) {
    return this.collectionsService.getByIdAdmin(id);
  }

  @Post()
  @RequirePermissions(Permission.CREATE_COLLECTION)
  @ApiCreateCollectionDocs()
  create(@Body() dto: CreateCollectionDto, @AuthenticatedUser() user: TypedAuthUser) {
    return this.collectionsService.create(dto, user.id);
  }

  // ── Translations (Admin) ────────────────────────────────────────────────────

  @Get(':id/translations')
  @RequirePermissions(Permission.EDIT_COLLECTION)
  @ApiGetCollectionTranslationsDocs()
  getAllTranslations(@Param('id') id: string) {
    return this.collectionsService.getAllTranslations(id);
  }

  @Get(':id/translations/:locale')
  @RequirePermissions(Permission.EDIT_COLLECTION)
  @ApiGetCollectionTranslationByLocaleDocs()
  getTranslationsByLocale(@Param('id') id: string, @Param('locale', new ParseEnumPipe(Locale)) locale: Locale) {
    return this.collectionsService.getTranslationsByLocale(id, locale);
  }

  @Patch(':id/translations/:locale')
  @RequirePermissions(Permission.EDIT_COLLECTION)
  @ApiUpsertCollectionTranslationsDocs()
  upsertTranslations(
    @Param('id') id: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertCollectionTranslationsDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.collectionsService.upsertTranslations(id, locale, dto, user.id);
  }

  @Delete(':id/translations/:locale')
  @RequirePermissions(Permission.EDIT_COLLECTION)
  @ApiDeleteCollectionTranslationsDocs()
  deleteTranslations(
    @Param('id') id: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.collectionsService.deleteTranslations(id, locale, user.id);
  }

  // ── Page content (public GET, admin write) ───────────────────────────────────

  @Get(':id/page-content')
  @Public()
  @ApiGetCollectionPageContentDocs()
  getPageContent(@Param('id') id: string, @Query() query: LocaleQueryDto) {
    return this.collectionsService.getPageContent(id, query.locale!);
  }

  @Patch(':id/page-content/:locale')
  @RequirePermissions(Permission.EDIT_COLLECTION)
  @ApiUpsertCollectionPageContentDocs()
  upsertPageContent(
    @Param('id') id: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertCollectionPageContentDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.collectionsService.upsertPageContent(id, locale, dto, user.id);
  }

  // ── FAQ (public GET, admin write) ─────────────────────────────────────────────

  @Get(':id/faqs')
  @Public()
  @ApiGetCollectionFaqsDocs()
  getFaqs(@Param('id') id: string, @Query() query: FaqLocaleQueryDto) {
    return this.collectionsService.getFaqs(id, query);
  }

  @Post(':id/faqs')
  @RequirePermissions(Permission.EDIT_COLLECTION)
  @ApiCreateCollectionFaqDocs()
  createFaq(@Param('id') id: string, @Body() dto: CreateFaqDto, @AuthenticatedUser() user: TypedAuthUser) {
    return this.collectionsService.createFaq(id, dto, user.id);
  }

  @Patch(':id/faqs/:faqId')
  @RequirePermissions(Permission.EDIT_COLLECTION)
  @ApiUpdateCollectionFaqDocs()
  updateFaq(
    @Param('id') id: string,
    @Param('faqId') faqId: string,
    @Body() dto: UpdateFaqDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.collectionsService.updateFaq(id, faqId, dto, user.id);
  }

  @Delete(':id/faqs/:faqId')
  @RequirePermissions(Permission.EDIT_COLLECTION)
  @ApiDeleteCollectionFaqDocs()
  deleteFaq(@Param('id') id: string, @Param('faqId') faqId: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.collectionsService.deleteFaq(id, faqId, user.id);
  }

  // ── Membership + rationale + status (Admin) ──────────────────────────────────

  @Put(':id/tours')
  @RequirePermissions(Permission.EDIT_COLLECTION)
  @ApiReplaceCollectionToursDocs()
  replaceTours(
    @Param('id') id: string,
    @Body() dto: ReplaceCollectionToursDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.collectionsService.replaceTours(id, dto, user.id);
  }

  @Put(':id/tours/:tourId/rationale/:locale')
  @RequirePermissions(Permission.EDIT_COLLECTION)
  @ApiUpsertCollectionTourRationaleDocs()
  upsertTourRationale(
    @Param('id') id: string,
    @Param('tourId') tourId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertCollectionTourRationaleDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.collectionsService.upsertTourRationale(id, tourId, locale, dto, user.id);
  }

  @Patch(':id/status')
  @RequirePermissions(Permission.EDIT_COLLECTION)
  @ApiUpdateCollectionStatusDocs()
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCollectionStatusDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.collectionsService.updateStatus(id, dto.status, user.id);
  }

  // ── Update / delete (dynamic :id - declared after sub-routes) ─────────────────

  @Patch(':id')
  @RequirePermissions(Permission.EDIT_COLLECTION)
  @ApiUpdateCollectionDocs()
  update(@Param('id') id: string, @Body() dto: UpdateCollectionDto, @AuthenticatedUser() user: TypedAuthUser) {
    return this.collectionsService.update(id, dto, user.id);
  }

  @Delete(':id/force')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  @ApiForceDeleteCollectionDocs()
  forceDelete(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.collectionsService.forceDelete(id, user.id);
  }

  @Delete(':id')
  @RequirePermissions(Permission.DELETE_COLLECTION)
  @ApiDeleteCollectionDocs()
  remove(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.collectionsService.remove(id, user.id);
  }
}
