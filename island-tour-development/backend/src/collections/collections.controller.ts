import type { TypedAuthUser } from '@/auth/auth.types';
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import { Public } from '@/auth/decorators/public.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { Body, Controller, Delete, Get, Param, ParseEnumPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
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
  ApiUpdateCollectionDocs,
  ApiUpdateCollectionFaqDocs,
  ApiUpsertCollectionPageContentDocs,
  ApiUpsertCollectionTranslationsDocs,
} from './collections.swagger';
import {
  ActiveCollectionsQueryDto,
  CollectionBySlugQueryDto,
  CreateCollectionDto,
  CreateFaqDto,
  FaqLocaleQueryDto,
  LocaleQueryDto,
  UpdateCollectionDto,
  UpdateFaqDto,
  UpsertCollectionPageContentDto,
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

  // ── Admin CRUD ────────────────────────────────────────────────────────────────

  @Post()
  @RequirePermissions(Permission.CREATE_CONTENT)
  @ApiCreateCollectionDocs()
  create(@Body() dto: CreateCollectionDto, @AuthenticatedUser() user: TypedAuthUser) {
    return this.collectionsService.create(dto, user.id);
  }

  // ── Translations (Admin) ────────────────────────────────────────────────────

  @Get(':id/translations')
  @RequirePermissions(Permission.EDIT_CONTENT)
  @ApiGetCollectionTranslationsDocs()
  getAllTranslations(@Param('id') id: string) {
    return this.collectionsService.getAllTranslations(id);
  }

  @Get(':id/translations/:locale')
  @RequirePermissions(Permission.EDIT_CONTENT)
  @ApiGetCollectionTranslationByLocaleDocs()
  getTranslationsByLocale(@Param('id') id: string, @Param('locale', new ParseEnumPipe(Locale)) locale: Locale) {
    return this.collectionsService.getTranslationsByLocale(id, locale);
  }

  @Patch(':id/translations/:locale')
  @RequirePermissions(Permission.EDIT_CONTENT)
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
  @RequirePermissions(Permission.EDIT_CONTENT)
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
  @RequirePermissions(Permission.EDIT_CONTENT)
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
  @RequirePermissions(Permission.EDIT_CONTENT)
  @ApiCreateCollectionFaqDocs()
  createFaq(@Param('id') id: string, @Body() dto: CreateFaqDto, @AuthenticatedUser() user: TypedAuthUser) {
    return this.collectionsService.createFaq(id, dto, user.id);
  }

  @Patch(':id/faqs/:faqId')
  @RequirePermissions(Permission.EDIT_CONTENT)
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
  @RequirePermissions(Permission.EDIT_CONTENT)
  @ApiDeleteCollectionFaqDocs()
  deleteFaq(@Param('id') id: string, @Param('faqId') faqId: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.collectionsService.deleteFaq(id, faqId, user.id);
  }

  // ── Update / delete (dynamic :id — declared after sub-routes) ─────────────────

  @Patch(':id')
  @RequirePermissions(Permission.EDIT_CONTENT)
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
  @RequirePermissions(Permission.DELETE_CONTENT)
  @ApiDeleteCollectionDocs()
  remove(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.collectionsService.remove(id, user.id);
  }
}
