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
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Locale, Permission } from '@prisma/client';
import { DestinationService } from './destinations.service';
import {
  ApiCreateDestinationDocs,
  ApiCreateFaqDocs,
  ApiDeleteDestinationDocs,
  ApiDeleteFaqDocs,
  ApiDeleteTranslationsDocs,
  ApiGetActiveDestinationsDocs,
  ApiGetAllDestinationsDocs,
  ApiGetAllTranslationsDocs,
  ApiGetDestinationByIdDocs,
  ApiGetDestinationBySlugDocs,
  ApiGetFaqsDocs,
  ApiGetPageContentDocs,
  ApiGetTranslationsByLocaleDocs,
  ApiUpdateDestinationDocs,
  ApiUpdateFaqDocs,
  ApiUpsertPageContentDocs,
  ApiUpsertTranslationsDocs,
} from './destinations.swagger';
import {
  CreateDestinationDto,
  CreateFaqDto,
  DestinationQueryDto,
  FaqLocaleQueryDto,
  LocaleQueryDto,
  UpdateDestinationDto,
  UpdateFaqDto,
  UpsertDestinationPageContentDto,
  UpsertDestinationTranslationsDto,
} from './dto/destination.dto';

@ApiTags('Destinations')
@Controller('destinations')
/**
 * DestinationController — manages Caribbean island destinations (Curaçao, Aruba, etc.)
 *
 * ## Access-Control Strategy
 * - GET endpoints are `@Public()` — destinations are needed for frontend SSR.
 * - Mutating endpoints require explicit destination permissions (Admin + Editor only).
 * - `@Roles()` is deliberately NOT used — `@RequirePermissions()` alone is sufficient.
 *
 * ## Multilingual
 * - All public GET endpoints accept `?locale=` (default `en`).
 * - Destination names are proper nouns — translations are admin-managed, never AI-generated.
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
    return this.destinationService.getActive(query.locale ?? 'en');
  }

  @Get('slug/:slug')
  @Public()
  @ApiGetDestinationBySlugDocs()
  getBySlug(@Param('slug') slug: string, @Query() query: LocaleQueryDto) {
    return this.destinationService.getBySlug(slug, query.locale ?? 'en');
  }

  @Get(':id')
  @Public()
  @ApiGetDestinationByIdDocs()
  getById(@Param('id') id: string, @Query() query: LocaleQueryDto) {
    return this.destinationService.getById(id, query.locale ?? 'en');
  }

  // ── Admin CRUD ────────────────────────────────────────────────────────────────

  @Post()
  @RequirePermissions(Permission.CREATE_DESTINATION)
  @ApiCreateDestinationDocs()
  create(@Body() dto: CreateDestinationDto, @AuthenticatedUser() user: TypedAuthUser) {
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

  @Delete(':id')
  @RequirePermissions(Permission.DELETE_DESTINATION)
  @ApiDeleteDestinationDocs()
  remove(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.destinationService.remove(id, user.id);
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
  getTranslationsByLocale(@Param('id') id: string, @Param('locale') locale: string) {
    return this.destinationService.getTranslationsByLocale(id, locale as Locale);
  }

  @Patch(':id/translations/:locale')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiUpsertTranslationsDocs()
  upsertTranslations(
    @Param('id') id: string,
    @Param('locale') locale: string,
    @Body() dto: UpsertDestinationTranslationsDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.destinationService.upsertTranslations(id, locale as Locale, dto, user.id);
  }

  @Delete(':id/translations/:locale')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiDeleteTranslationsDocs()
  deleteTranslations(
    @Param('id') id: string,
    @Param('locale') locale: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.destinationService.deleteTranslations(id, locale as Locale, user.id);
  }

  // ── Page Content (public GET, admin PATCH) ────────────────────────────────────

  @Get(':id/page-content')
  @Public()
  @ApiGetPageContentDocs()
  getPageContent(@Param('id') id: string, @Query() query: LocaleQueryDto) {
    return this.destinationService.getPageContent(id, query.locale ?? 'en');
  }

  @Patch(':id/page-content/:locale')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiUpsertPageContentDocs()
  upsertPageContent(
    @Param('id') id: string,
    @Param('locale') locale: string,
    @Body() dto: UpsertDestinationPageContentDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.destinationService.upsertPageContent(id, locale as Locale, dto, user.id);
  }

  // ── FAQ (public GET, admin write) ─────────────────────────────────────────────

  @Get(':id/faqs')
  @Public()
  @ApiGetFaqsDocs()
  getFaqs(@Param('id') id: string, @Query() query: FaqLocaleQueryDto) {
    return this.destinationService.getFaqs(id, query);
  }

  @Post(':id/faqs')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiCreateFaqDocs()
  createFaq(
    @Param('id') id: string,
    @Body() dto: CreateFaqDto,
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
    @Body() dto: UpdateFaqDto,
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
