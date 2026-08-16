import type { TypedAuthUser } from '@/auth/auth.types';
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { resolveOperatorId } from '@/common/utils/operator.util';
import { toTranslationHttpError } from './translation-http-error';
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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Locale, Permission, Role } from '@prisma/client';
import { ContentTranslationService } from './content-translation.service';
import {
  ApiGenerateTranslationDocs,
  ApiTranslateFieldsDocs,
  ApiTranslateTextDocs,
} from './content-translation.swagger';
import {
  GenerateTranslationResponseDto,
  TranslateFieldsDto,
  TranslateFieldsResponseDto,
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
      throw toTranslationHttpError(err);
    }
  }

  /**
   * Batched inline translation (the per-card "Translate section" button).
   * The card's fields ride in ONE request and hit the provider in ONE
   * `translateFields` call - the same battle-tested path the background job
   * uses (JSON mode, key-preserving validation, internal chunking, 429-hint
   * waits). Persists NOTHING, exactly like translate-text above.
   *
   * The Record's values are opaque to class-validator, so the shape/size
   * caps live here: they bound what one synchronous click can send to an
   * external LLM.
   */
  @Post('content-translation/translate-fields')
  @RequirePermissions(Permission.VIEW_TRIPS)
  @ApiTranslateFieldsDocs()
  async translateFields(
    @Body() dto: TranslateFieldsDto,
  ): Promise<TranslateFieldsResponseDto> {
    if (dto.targetLocale === Locale.en) {
      throw new BadRequestException(
        'English is the source language - pick a target locale',
      );
    }

    const entries = Object.entries(dto.fields ?? {});
    if (entries.length === 0) {
      throw new BadRequestException('fields must contain at least one entry');
    }
    if (entries.length > 100) {
      throw new BadRequestException(
        'Too many fields - send at most 100 per request',
      );
    }
    const fields: Record<string, string> = {};
    let totalChars = 0;
    for (const [key, value] of entries) {
      // Loud rejection instead of the silent drop a bracket-assignment of
      // these keys would cause (they hit Object.prototype accessors).
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new BadRequestException(`Field key "${key}" is not allowed`);
      }
      if (key.length > 64) {
        throw new BadRequestException(
          'Field keys must be 64 characters or fewer',
        );
      }
      if (typeof value !== 'string') {
        throw new BadRequestException(`Field "${key}" must be a string`);
      }
      if (!value.trim()) continue; // nothing to translate - key is omitted
      // Keys ride in the LLM payload too - count them, or a map of long keys
      // with short values inflates the real cost past the documented cap.
      totalChars += key.length + value.length;
      fields[key] = value;
    }
    if (totalChars > 30_000) {
      throw new BadRequestException(
        'Fields exceed 30,000 characters - split the request',
      );
    }
    if (Object.keys(fields).length === 0) {
      return { fields: {} };
    }

    if (!(await this.provider.isConfigured())) {
      throw new BadRequestException(
        'AI translation is not configured - set it up under Settings > Integrations > AI Translation (or TRANSLATION_API_KEY)',
      );
    }
    try {
      const translated = await this.provider.translateFields(
        fields,
        Locale.en,
        dto.targetLocale,
      );
      // Echo back ONLY the keys we sent (a hallucinated extra key never
      // reaches the client) and normalise defensively - the provider
      // contract also carries string[] for other callers. A missing or
      // non-string value simply omits the key; the dashboard treats a
      // missing key as not-filled.
      const result: Record<string, string> = {};
      for (const key of Object.keys(fields)) {
        const value = translated[key];
        if (Array.isArray(value)) result[key] = value.join('\n');
        else if (typeof value === 'string') result[key] = value;
      }
      return { fields: result };
    } catch (err) {
      throw toTranslationHttpError(err);
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

  // Recommendations are a normal list, so this is the standard per-id shape -
  // unlike the homepage singleton above.
  @Post('recommendations/:id/translations/:locale/generate')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiGenerateTranslationDocs('recommendation')
  generateRecommendation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('locale', new ParseEnumPipe(Locale)) locale: Locale,
    @Query('force', new ParseBoolPipe({ optional: true }))
    force: boolean | undefined,
  ): Promise<GenerateTranslationResponseDto> {
    return this.generate('recommendation', id, locale, force);
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
      throw toTranslationHttpError(err);
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
