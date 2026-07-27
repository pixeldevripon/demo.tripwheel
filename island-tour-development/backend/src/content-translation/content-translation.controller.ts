import type { TypedAuthUser } from '@/auth/auth.types';
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { resolveOperatorId } from '@/common/utils/operator.util';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Inject,
  NotFoundException,
  Param,
  ParseBoolPipe,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Locale, Permission, Role } from '@prisma/client';
import { ContentTranslationService } from './content-translation.service';
import {
  ApiGenerateTranslationDocs,
  ApiTranslateTextDocs,
} from './content-translation.swagger';
import {
  GenerateTranslationResponseDto,
  TranslateTextDto,
  TranslateTextResponseDto,
} from './dto/content-translation.dto';
import {
  TRANSLATION_PROVIDER,
  type TranslationProvider,
} from './providers/translation-provider.interface';
import type { ContentEntityType } from './content-translation.constants';

/**
 * The manual "Translate with AI" button (one entity, one locale, synchronous).
 *
 * Six explicit per-entity routes rather than one generic `/translations/...`
 * route, for two hard reasons:
 * - `@RequirePermissions` is a STATIC decorator - the permission cannot vary
 *   by a `:type` param, and each entity has its own write permission.
 * - The dashboard busts public cache tags by PATH SEGMENT (`tours/...` ->
 *   tour tags); these paths inherit that mapping with zero dashboard work.
 */
@ApiTags('AI Translation')
@Controller()
export class ContentTranslationController {
  constructor(
    private readonly translation: ContentTranslationService,
    private readonly prisma: PrismaService,
    @Inject(TRANSLATION_PROVIDER)
    private readonly provider: TranslationProvider,
  ) {}

  /**
   * Inline per-field translation (the small AI icon next to a field). Pure
   * utility - translates the text and returns it, persisting NOTHING; the
   * dashboard fills the form field and the human reviews before saving.
   * Gated on VIEW_TRIPS: the same permission that opens the Translations
   * section at all (single key - the guard is ALL-semantics).
   */
  @Post('content-translation/translate-text')
  @RequirePermissions(Permission.VIEW_TRIPS)
  @ApiTranslateTextDocs()
  async translateText(
    @Body() dto: TranslateTextDto,
  ): Promise<TranslateTextResponseDto> {
    if (dto.targetLocale === Locale.en) {
      throw new BadRequestException(
        'English is the source language - pick a target locale',
      );
    }
    if (!(await this.provider.isConfigured())) {
      throw new BadRequestException(
        'AI translation is not configured - set it up under Settings > Integrations > AI Translation (or TRANSLATION_API_KEY)',
      );
    }
    try {
      const translatedText = await this.provider.translateText(
        dto.text,
        Locale.en,
        dto.targetLocale,
      );
      return { translatedText };
    } catch (err) {
      throw new ServiceUnavailableException(
        `AI translation failed - please try again shortly (${
          err instanceof Error ? err.message : 'unknown error'
        })`,
      );
    }
  }

  // Single permission, matching every other tour-edit route: the guard is
  // ALL-semantics, so listing EDIT_TRIP + MANAGE_TRIPS would lock out
  // operators (who hold only EDIT_TRIP).
  @Post('tours/:id/translations/:locale/generate')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiGenerateTranslationDocs('tour')
  async generateTour(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Query('force', new ParseBoolPipe({ optional: true }))
    force: boolean | undefined,
    @AuthenticatedUser() user: TypedAuthUser,
  ): Promise<GenerateTranslationResponseDto> {
    // Same ownership rule as every tour-children write: ADMIN bypasses, a
    // TOUR_OPERATOR may only translate their own tours.
    if (user.role !== Role.ADMIN) {
      const tour = await this.prisma.tour.findUnique({
        where: { id },
        select: { operatorId: true },
      });
      if (!tour) throw new NotFoundException(`Tour ${id} not found`);
      const operatorId = await resolveOperatorId(this.prisma, user.id);
      if (tour.operatorId !== operatorId) {
        throw new ForbiddenException(
          'You do not have permission to modify this tour',
        );
      }
    }
    return this.generate('tour', id, locale, force);
  }

  @Post('destinations/:id/translations/:locale/generate')
  @RequirePermissions(Permission.EDIT_DESTINATION)
  @ApiGenerateTranslationDocs('destination')
  generateDestination(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Query('force', new ParseBoolPipe({ optional: true }))
    force: boolean | undefined,
  ): Promise<GenerateTranslationResponseDto> {
    return this.generate('destination', id, locale, force);
  }

  @Post('hubs/:id/translations/:locale/generate')
  @RequirePermissions(Permission.MANAGE_HUBS)
  @ApiGenerateTranslationDocs('hub')
  generateHub(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Query('force', new ParseBoolPipe({ optional: true }))
    force: boolean | undefined,
  ): Promise<GenerateTranslationResponseDto> {
    return this.generate('hub', id, locale, force);
  }

  @Post('categories/:id/translations/:locale/generate')
  @RequirePermissions(Permission.EDIT_CATEGORY)
  @ApiGenerateTranslationDocs('category')
  generateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Query('force', new ParseBoolPipe({ optional: true }))
    force: boolean | undefined,
  ): Promise<GenerateTranslationResponseDto> {
    return this.generate('category', id, locale, force);
  }

  @Post('collections/:id/translations/:locale/generate')
  @RequirePermissions(Permission.EDIT_COLLECTION)
  @ApiGenerateTranslationDocs('collection')
  generateCollection(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Query('force', new ParseBoolPipe({ optional: true }))
    force: boolean | undefined,
  ): Promise<GenerateTranslationResponseDto> {
    return this.generate('collection', id, locale, force);
  }

  // No :id - the homepage is a singleton; the service resolves the row itself.
  @Post('home-page/translations/:locale/generate')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiGenerateTranslationDocs('homepage')
  async generateHomepage(
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Query('force', new ParseBoolPipe({ optional: true }))
    force: boolean | undefined,
  ): Promise<GenerateTranslationResponseDto> {
    const home = await this.prisma.homePage.findFirst({ select: { id: true } });
    if (!home) {
      throw new NotFoundException('Homepage content has not been created yet');
    }
    return this.generate('homepage', home.id, locale, force);
  }

  private async generate(
    entityType: ContentEntityType,
    entityId: string,
    locale: Locale,
    force?: boolean,
  ): Promise<GenerateTranslationResponseDto> {
    if (locale === Locale.en) {
      throw new BadRequestException(
        'English is the source language - pick a target locale',
      );
    }

    let result;
    try {
      result = await this.translation.translateEntity(
        entityType,
        entityId,
        [locale],
        force ?? false,
      );
    } catch (err) {
      // Provider failure (rate limit, invalid output twice). The write side is
      // idempotent, so retrying is always safe.
      throw new ServiceUnavailableException(
        `AI translation failed - please try again shortly (${
          err instanceof Error ? err.message : 'unknown error'
        })`,
      );
    }

    if (result.reason === 'not_configured') {
      throw new BadRequestException(
        'AI translation is not configured - set it up under Settings > Integrations > AI Translation (or TRANSLATION_API_KEY)',
      );
    }
    if (result.reason === 'not_found') {
      throw new NotFoundException(`${entityType} ${entityId} not found`);
    }
    return { ...result, locale };
  }
}
