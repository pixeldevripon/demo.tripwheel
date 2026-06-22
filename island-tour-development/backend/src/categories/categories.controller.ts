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
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Locale, Permission } from '@prisma/client';
import { CategoryService } from './categories.service';
import {
  ApiCreateCategoryDocs,
  ApiCreateFaqDocs,
  ApiDeleteCategoryDocs,
  ApiForceDeleteCategoryDocs,
  ApiDeleteFaqDocs,
  ApiDeleteTranslationsDocs,
  ApiGetActiveCategoriesDocs,
  ApiGetAllCategoriesDocs,
  ApiGetAllTranslationsDocs,
  ApiGetCategoriesByDestinationDocs,
  ApiGetCategoryByDestinationSlugDocs,
  ApiGetCategoryByIdDocs,
  ApiGetCategoryBySlugDocs,
  ApiGetFaqsDocs,
  ApiGetPageContentDocs,
  ApiGetTranslationsByLocaleDocs,
  ApiUpdateCategoryDocs,
  ApiUpdateFaqDocs,
  ApiUpsertPageContentDocs,
  ApiUpsertTranslationsDocs,
} from './categories.swagger';
import {
  CategoryQueryDto,
  CreateCategoryDto,
  CreateFaqDto,
  FaqLocaleQueryDto,
  LocaleQueryDto,
  UpdateCategoryDto,
  UpdateFaqDto,
  UpsertCategoryPageContentDto,
  UpsertCategoryTranslationsDto,
} from './dto/category.dto';
import { Throttle } from '@nestjs/throttler/dist/throttler.decorator';

@ApiTags('Categories')
@Controller('categories')
/**
 * CategoryController - manages tour activity categories (Boat Tours, Sunset Cruises, etc.)
 *
 * ## Access-Control Strategy
 * - GET endpoints are `@Public()` - categories are needed for frontend SSR and the
 *   operator tour-creation wizard without requiring authentication.
 * - Mutating endpoints (POST/PATCH/DELETE) require the appropriate permission.
 * - `@Roles()` is deliberately NOT used - `@RequirePermissions()` alone is sufficient.
 *
 * ## Multilingual
 * - All public GET endpoints accept `?locale=` (default `en`).
 * - Requested locale falls back to `en` when no translation exists.
 * - Translation management, page content, and FAQs are admin-managed sub-resources.
 *
 * ## Route ordering
 * Static segments (`active`, `slug`) MUST appear before the dynamic `:id` segment.
 */
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  // ── Public list / lookup ──────────────────────────────────────────────────────

  @Get()
  @Public()
  @ApiGetAllCategoriesDocs()
  getAll(@Query() query: CategoryQueryDto) {
    return this.categoryService.getAll(query);
  }

  @Get('active')
  @Public()
  @ApiGetActiveCategoriesDocs()
  getActive(@Query() query: LocaleQueryDto) {
    return this.categoryService.getActive(query.locale);
  }

  @Get('slug/:slug')
  @Public()
  @ApiGetCategoryBySlugDocs()
  getBySlug(@Param('slug') slug: string, @Query() query: LocaleQueryDto) {
    return this.categoryService.getBySlug(slug, query.locale);
  }

  // ── V2 destination-scoped, tour-gated (Stage 3) ──────────────────────────────
  // Static `destination/...` segments MUST precede the dynamic `:id` route below.

  @Get('destination/:destinationSlug')
  @Public()
  @ApiGetCategoriesByDestinationDocs()
  getActiveByDestination(
    @Param('destinationSlug') destinationSlug: string,
    @Query() query: LocaleQueryDto,
  ) {
    return this.categoryService.getActiveByDestinationSlug(destinationSlug, query.locale);
  }

  @Get('destination/:destinationSlug/:categorySlug')
  @Public()
  @ApiGetCategoryByDestinationSlugDocs()
  getByDestinationSlug(
    @Param('destinationSlug') destinationSlug: string,
    @Param('categorySlug') categorySlug: string,
    @Query() query: LocaleQueryDto,
  ) {
    return this.categoryService.getBySlugForDestination(destinationSlug, categorySlug, query.locale);
  }

  @Get(':id')
  @Public()
  @ApiGetCategoryByIdDocs()
  getById(@Param('id') id: string, @Query() query: LocaleQueryDto) {
    return this.categoryService.getById(id, query.locale);
  }

  // ── Admin CRUD ────────────────────────────────────────────────────────────────

  @Post()
  @RequirePermissions(Permission.CREATE_CATEGORY)
  @ApiCreateCategoryDocs()
  create(@Body() dto: CreateCategoryDto, @AuthenticatedUser() user: TypedAuthUser) {
    return this.categoryService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.EDIT_CATEGORY)
  @ApiUpdateCategoryDocs()
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.categoryService.update(id, dto, user.id);
  }

  @Delete(':id/force')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  @ApiForceDeleteCategoryDocs()
  forceDelete(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.categoryService.forceDelete(id, user.id);
  }

  @Delete(':id')
  @RequirePermissions(Permission.DELETE_CATEGORY)
  @ApiDeleteCategoryDocs()
  remove(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.categoryService.remove(id, user.id);
  }

  // ── Translation management (Admin) ────────────────────────────────────────────

  @Get(':id/translations')
  @RequirePermissions(Permission.EDIT_CATEGORY)
  @ApiGetAllTranslationsDocs()
  getAllTranslations(@Param('id') id: string) {
    return this.categoryService.getAllTranslations(id);
  }

  @Get(':id/translations/:locale')
  @RequirePermissions(Permission.EDIT_CATEGORY)
  @ApiGetTranslationsByLocaleDocs()
  getTranslationsByLocale(
    @Param('id') id: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
  ) {
    return this.categoryService.getTranslationsByLocale(id, locale);
  }

  @Patch(':id/translations/:locale')
  @RequirePermissions(Permission.EDIT_CATEGORY)
  @ApiUpsertTranslationsDocs()
  upsertTranslations(
    @Param('id') id: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertCategoryTranslationsDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.categoryService.upsertTranslations(id, locale, dto, user.id);
  }

  @Delete(':id/translations/:locale')
  @RequirePermissions(Permission.EDIT_CATEGORY)
  @ApiDeleteTranslationsDocs()
  deleteTranslations(
    @Param('id') id: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.categoryService.deleteTranslations(id, locale, user.id);
  }

  // ── Page Content (public GET, admin PUT) ──────────────────────────────────────

  @Get(':id/page-content')
  @Public()
  @ApiGetPageContentDocs()
  getPageContent(@Param('id') id: string, @Query() query: LocaleQueryDto) {
    return this.categoryService.getPageContent(id, query.locale!);
  }

  @Patch(':id/page-content/:locale')
  @RequirePermissions(Permission.EDIT_CATEGORY)
  @ApiUpsertPageContentDocs()
  upsertPageContent(
    @Param('id') id: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertCategoryPageContentDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.categoryService.upsertPageContent(id, locale, dto, user.id);
  }

  // ── FAQ (public GET, admin write) ─────────────────────────────────────────────

  @Get(':id/faqs')
  @Public()
  @ApiGetFaqsDocs()
  getFaqs(@Param('id') id: string, @Query() query: FaqLocaleQueryDto) {
    return this.categoryService.getFaqs(id, query);
  }

  @Post(':id/faqs')
  @RequirePermissions(Permission.EDIT_CATEGORY)
  @ApiCreateFaqDocs()
  createFaq(
    @Param('id') id: string,
    @Body() dto: CreateFaqDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.categoryService.createFaq(id, dto, user.id);
  }

  @Patch(':id/faqs/:faqId')
  @RequirePermissions(Permission.EDIT_CATEGORY)
  @ApiUpdateFaqDocs()
  updateFaq(
    @Param('id') id: string,
    @Param('faqId') faqId: string,
    @Body() dto: UpdateFaqDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.categoryService.updateFaq(id, faqId, dto, user.id);
  }

  @Delete(':id/faqs/:faqId')
  @RequirePermissions(Permission.EDIT_CATEGORY)
  @ApiDeleteFaqDocs()
  deleteFaq(
    @Param('id') id: string,
    @Param('faqId') faqId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.categoryService.deleteFaq(id, faqId, user.id);
  }
}
