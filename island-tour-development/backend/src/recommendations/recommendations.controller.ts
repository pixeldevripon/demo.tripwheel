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
  CreateRecommendationDto,
  RecommendationPublicQueryDto,
  UpdateRecommendationDto,
  UpsertRecommendationTranslationDto,
} from './dto/recommendation.dto';
import { RecommendationsService } from './recommendations.service';
import {
  ApiCreateRecommendationDocs,
  ApiDeleteRecommendationDocs,
  ApiGetPublicRecommendationDocs,
  ApiGetRecommendationDocs,
  ApiGetRecommendationTranslationsDocs,
  ApiListRecommendationsDocs,
  ApiUpdateRecommendationDocs,
  ApiUpsertRecommendationTranslationDocs,
} from './recommendations.swagger';

/**
 * RecommendationsController - Island Tours' post-booking promo (thank-you page and
 * confirmation email).
 *
 * ## Access-Control Strategy
 *   - `GET /recommendations/public` is `@Public()`: the marketing site has no
 *     session, and the payload is copy and image URLs about to be rendered publicly.
 *   - Every other route requires `MANAGE_EDITORIAL` (admin-only). This is our own
 *     marketing content, not platform configuration, so it sits with the homepage
 *     and the other editorial surfaces. Operators must never reach it.
 *
 * The category is a fixed enum on the recommendation (not admin-managed), so there
 * are no category routes. Route ordering: the static `public` route is declared
 * BEFORE the dynamic `:id` ones.
 */
@ApiTags('Recommendations')
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}

  // ── Public read ─────────────────────────────────────────────────────────────

  @Get('public')
  @Public()
  @ApiGetPublicRecommendationDocs()
  getPublic(@Query() query: RecommendationPublicQueryDto) {
    return this.recommendations.getFeatured(query.locale!, query.placement!);
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
