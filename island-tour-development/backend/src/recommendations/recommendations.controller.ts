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
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Locale, Permission } from '@prisma/client';
import {
  CreateRecommendationCategoryDto,
  CreateRecommendationDto,
  RecommendationPublicQueryDto,
  UpdateRecommendationCategoryDto,
  UpdateRecommendationDto,
  UpsertRecommendationTranslationDto,
} from './dto/recommendation.dto';
import { RecommendationCategoriesService } from './recommendation-categories.service';
import { RecommendationsService } from './recommendations.service';
import {
  ApiCreateRecommendationCategoryDocs,
  ApiCreateRecommendationDocs,
  ApiDeleteRecommendationCategoryDocs,
  ApiDeleteRecommendationDocs,
  ApiGetPublicRecommendationDocs,
  ApiGetRecommendationDocs,
  ApiGetRecommendationTranslationsDocs,
  ApiListRecommendationCategoriesDocs,
  ApiListRecommendationsDocs,
  ApiUpdateRecommendationCategoryDocs,
  ApiUpdateRecommendationDocs,
  ApiUpsertRecommendationTranslationDocs,
} from './recommendations.swagger';

/**
 * RecommendationsController - Island Tours' post-booking promo (thank-you page and
 * confirmation email), generalising the old Hotels feature.
 *
 * ## Access-Control Strategy
 *   - `GET /recommendations/public` is `@Public()`: the marketing site has no
 *     session, and the payload is copy and image URLs about to be rendered publicly.
 *   - Every other route requires `MANAGE_EDITORIAL` (admin-only). This is our own
 *     marketing content, not platform configuration, so it sits with the homepage
 *     and the other editorial surfaces. Operators must never reach it.
 *
 * Route ordering: the static `public` and `categories` routes are declared BEFORE
 * the dynamic `:id` ones so `public`/`categories` is never read as an `:id`.
 */
@ApiTags('Recommendations')
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendations: RecommendationsService,
    private readonly categories: RecommendationCategoriesService,
  ) {}

  // ── Public read ─────────────────────────────────────────────────────────────

  @Get('public')
  @Public()
  @ApiGetPublicRecommendationDocs()
  getPublic(@Query() query: RecommendationPublicQueryDto) {
    return this.recommendations.getFeatured(query.locale!, query.placement!);
  }

  // ── Categories (static prefix, declared before `:id`) ───────────────────────
  // Category ids are NOT validated with ParseUUIDPipe: the seeded "Hotels"
  // category ships with the fixed key `rec-cat-hotel` (not a uuid) so the seed and
  // migration stay idempotent, and it must remain renameable. A bad id just 404s
  // in the service.

  @Get('categories')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiListRecommendationCategoriesDocs()
  listCategories() {
    return this.categories.findAll();
  }

  @Post('categories')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiCreateRecommendationCategoryDocs()
  createCategory(
    @Body() dto: CreateRecommendationCategoryDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.categories.create(dto, user.id);
  }

  @Patch('categories/:categoryId')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiUpdateRecommendationCategoryDocs()
  updateCategory(
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateRecommendationCategoryDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.categories.update(categoryId, dto, user.id);
  }

  @Delete('categories/:categoryId')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiDeleteRecommendationCategoryDocs()
  removeCategory(
    @Param('categoryId') categoryId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.categories.remove(categoryId, user.id);
  }

  // ── Admin recommendations ────────────────────────────────────────────────────

  @Get()
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiListRecommendationsDocs()
  findAll() {
    return this.recommendations.findAll();
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiCreateRecommendationDocs()
  create(
    @Body() dto: CreateRecommendationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.recommendations.create(dto, user.id);
  }

  @Get(':id/translations')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiGetRecommendationTranslationsDocs()
  getTranslations(@Param('id', ParseUUIDPipe) id: string) {
    return this.recommendations.getTranslations(id);
  }

  @Patch(':id/translations/:locale')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiUpsertRecommendationTranslationDocs()
  upsertTranslation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertRecommendationTranslationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.recommendations.upsertTranslation(id, locale, dto, user.id);
  }

  @Get(':id')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiGetRecommendationDocs()
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.recommendations.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiUpdateRecommendationDocs()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecommendationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.recommendations.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiDeleteRecommendationDocs()
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.recommendations.remove(id, user.id);
  }
}
