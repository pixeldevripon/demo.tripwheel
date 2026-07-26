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
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Locale, Permission } from '@prisma/client';
import {
  CreatePageDto,
  PageLocaleQueryDto,
  UpdatePageDto,
  UpdatePageStatusDto,
  UpsertPageTranslationDto,
} from './dto/pages.dto';
import { PagesService } from './pages.service';
import {
  ApiCreatePageDocs,
  ApiDeletePageDocs,
  ApiGetPageDocs,
  ApiGetPublicPageDocs,
  ApiListPagesDocs,
  ApiUpdatePageDocs,
  ApiUpdatePageStatusDocs,
  ApiUpsertPageTranslationDocs,
} from './pages.swagger';

/**
 * PagesController — the WordPress-like Pages system (global long-form
 * documents: the legal/policy pages today, marketing pages later).
 *
 * ## Access-Control Strategy
 *   - `GET /pages/public/:slug` is `@Public()`: it serves exactly what the
 *     public site is about to render.
 *   - Every other route requires `MANAGE_EDITORIAL` (admin-only) — these are
 *     the site's own pages, the same ownership as the homepage.
 *
 * Static segments (`public`) are declared before dynamic (`:id`) ones —
 * NestJS matches top-to-bottom.
 */
@ApiTags('Pages')
@Controller('pages')
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Get('public/:slug')
  @Public()
  @ApiGetPublicPageDocs()
  getPublic(@Param('slug') slug: string, @Query() query: PageLocaleQueryDto) {
    return this.pages.getPublicBySlug(slug, query.locale!);
  }

  @Get()
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiListPagesDocs()
  list() {
    return this.pages.list();
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiCreatePageDocs()
  create(@Body() dto: CreatePageDto, @AuthenticatedUser() user: TypedAuthUser) {
    return this.pages.create(dto, user.id);
  }

  @Get(':id')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiGetPageDocs()
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.pages.get(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiUpdatePageDocs()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePageDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.pages.update(id, dto, user.id);
  }

  @Patch(':id/status')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiUpdatePageStatusDocs()
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePageStatusDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.pages.updateStatus(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiDeletePageDocs()
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.pages.remove(id, user.id);
  }

  @Put(':id/translations/:locale')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiUpsertPageTranslationDocs()
  upsertTranslation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertPageTranslationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.pages.upsertTranslation(id, locale, dto, user.id);
  }
}
