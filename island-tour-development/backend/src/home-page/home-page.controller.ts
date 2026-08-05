import type { TypedAuthUser } from '@/auth/auth.types';
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import { Public } from '@/auth/decorators/public.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import {
  CreateFaqGroupDto,
  UpdateFaqGroupDto,
  UpsertFaqTranslationDto,
} from '@/common/faq/dto/faq-group.dto';
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
import {
  HomePageLocaleQueryDto,
  UpdateHomePageDto,
  UpsertHomePageTranslationDto,
} from './dto/home-page.dto';
import { HomePageService } from './home-page.service';
import {
  ApiCreateHomePageFaqGroupDocs,
  ApiDeleteHomePageFaqGroupDocs,
  ApiGetHomePageDocs,
  ApiGetHomePageFaqGroupsDocs,
  ApiGetHomePageTranslationsDocs,
  ApiGetPublicHomePageDocs,
  ApiUpdateHomePageDocs,
  ApiUpdateHomePageFaqGroupDocs,
  ApiUpsertHomePageFaqTranslationDocs,
  ApiUpsertHomePageTranslationDocs,
} from './home-page.swagger';

/**
 * HomePageController - admin-managed content for the public homepage.
 *
 * ## Access-Control Strategy
 *   - `GET /home-page/public` is `@Public()`: the marketing site has no session,
 *     and the payload is copy and image URLs that are about to be rendered
 *     publicly anyway.
 *   - Every other route requires `MANAGE_EDITORIAL` (admin-only). This is
 *     editorial curation, not configuration, so it sits with the other manual
 *     admin flags rather than under MANAGE_SETTINGS.
 */
@ApiTags('Home Page')
@Controller('home-page')
export class HomePageController {
  constructor(private readonly homePage: HomePageService) {}

  /**
   * GET /home-page/public?locale=en
   *
   * Declared before the bare `GET /` so `public` is never read as a route
   * parameter, and kept a sibling of the guarded routes so the contrast in
   * access control is obvious at a glance.
   */
  @Get('public')
  @Public()
  @ApiGetPublicHomePageDocs()
  getPublic(@Query() query: HomePageLocaleQueryDto) {
    return this.homePage.getPublic(query.locale!, query.currency);
  }

  @Get('translations')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiGetHomePageTranslationsDocs()
  getTranslations() {
    return this.homePage.getTranslations();
  }

  @Patch('translations/:locale')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiUpsertHomePageTranslationDocs()
  upsertTranslation(
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertHomePageTranslationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.homePage.upsertTranslation(locale, dto, user.id);
  }

  // ── FAQs ────────────────────────────────────────────────────────────────────
  //
  // `:entityId` is always the singleton key ('default'). It stays in the path so
  // the dashboard's shared FaqManager and faqGroupsApi - which build
  // `{basePath}/{id}/faqs/groups` for every entity - work here unmodified.
  // Declared above the bare `GET /` and `PATCH /` for readability only; the
  // segment counts differ, so there is no ambiguity to resolve.

  @Get(':entityId/faqs/groups')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiGetHomePageFaqGroupsDocs()
  getFaqGroups(@Param('entityId') entityId: string) {
    return this.homePage.getFaqGroups(entityId);
  }

  @Post(':entityId/faqs/groups')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiCreateHomePageFaqGroupDocs()
  createFaqGroup(
    @Param('entityId') entityId: string,
    @Body() dto: CreateFaqGroupDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.homePage.createFaqGroup(entityId, dto, user.id);
  }

  @Patch(':entityId/faqs/groups/:groupId')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiUpdateHomePageFaqGroupDocs()
  updateFaqGroup(
    @Param('entityId') entityId: string,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateFaqGroupDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.homePage.updateFaqGroup(entityId, groupId, dto, user.id);
  }

  @Delete(':entityId/faqs/groups/:groupId')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiDeleteHomePageFaqGroupDocs()
  deleteFaqGroup(
    @Param('entityId') entityId: string,
    @Param('groupId') groupId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.homePage.deleteFaqGroup(entityId, groupId, user.id);
  }

  /**
   * Clear ONE locale of a homepage FAQ (Translation Console). Question/answer
   * are NOT NULL, so removing the row IS the cleared state - the public page
   * falls back to English. `en` is rejected; delete the FAQ group instead.
   */
  @Delete(':entityId/faqs/groups/:groupId/translations/:locale')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiOperation({
    summary:
      'Admin: clear one locale of a homepage FAQ (falls back to English)',
  })
  deleteFaqTranslation(
    @Param('entityId') entityId: string,
    @Param('groupId') groupId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.homePage.deleteFaqTranslation(
      entityId,
      groupId,
      locale,
      user.id,
    );
  }

  @Put(':entityId/faqs/groups/:groupId/translations/:locale')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiUpsertHomePageFaqTranslationDocs()
  upsertFaqTranslation(
    @Param('entityId') entityId: string,
    @Param('groupId') groupId: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Body() dto: UpsertFaqTranslationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.homePage.upsertFaqTranslation(
      entityId,
      groupId,
      locale,
      dto,
      user.id,
    );
  }

  @Get()
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiGetHomePageDocs()
  get() {
    return this.homePage.get();
  }

  @Patch()
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiUpdateHomePageDocs()
  update(
    @Body() dto: UpdateHomePageDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.homePage.update(dto, user.id);
  }
}
