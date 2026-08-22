import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import {
  BadRequestErrorDto,
  ForbiddenErrorDto,
  NotFoundErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import {
  GenerateTranslationResponseDto,
  TranslateFieldsResponseDto,
  TranslateTextResponseDto,
} from './dto/content-translation.dto';

/** Shared decorator set for the six per-entity generate routes. */
export function ApiGenerateTranslationDocs(entityLabel: string) {
  return applyDecorators(
    ApiOperation({
      summary: `Translate a ${entityLabel} into one locale with AI`,
      description:
        `Synchronously translates the ${entityLabel}'s English source into the ` +
        'target locale (the "Translate with AI" button). Fills missing rows and ' +
        'refreshes machine-translated ones; rows a human saved are never ' +
        'overwritten. `en` is rejected - it is the source, not a target.',
    }),
    ApiParam({
      name: 'locale',
      description: 'Target locale (any supported locale except en)',
    }),
    ApiResponse({ status: 200, type: GenerateTranslationResponseDto }),
    ApiResponse({
      status: 400,
      type: BadRequestErrorDto,
      description: 'locale is en, or AI translation is not configured',
    }),
    ApiResponse({ status: 401, type: UnauthorizedErrorDto }),
    ApiResponse({
      status: 403,
      type: ForbiddenErrorDto,
      description:
        'Missing permission (or, for tours, not the owning operator)',
    }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ApiResponse({
      status: 503,
      description:
        'The AI provider failed (rate limit or invalid output) - safe to retry',
    }),
  );
}

/** The batched per-card translation utility ("Translate section"). */
export function ApiTranslateFieldsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Translate a map of text fields with AI in one call',
      description:
        'Translates every entry of `fields` into the target locale in ONE ' +
        'provider request and returns the same keys translated. Persists ' +
        'nothing - the dashboard fills the form fields and the human reviews ' +
        'before saving. Caps: 100 entries, 30,000 characters total.',
    }),
    ApiResponse({ status: 200, type: TranslateFieldsResponseDto }),
    ApiResponse({
      status: 400,
      type: BadRequestErrorDto,
      description:
        'locale is en, caps exceeded, non-string value, or AI translation is not configured',
    }),
    ApiResponse({ status: 401, type: UnauthorizedErrorDto }),
    ApiResponse({ status: 403, type: ForbiddenErrorDto }),
    ApiResponse({
      status: 503,
      description: 'The AI provider failed - safe to retry',
    }),
  );
}

/** The inline per-field translation utility. */
export function ApiTranslateTextDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Translate one text snippet with AI (inline field button)',
      description:
        'Translates the given English text into the target locale and returns ' +
        'it. Persists nothing - the dashboard fills the form field and the ' +
        'human reviews before saving.',
    }),
    ApiResponse({ status: 200, type: TranslateTextResponseDto }),
    ApiResponse({
      status: 400,
      type: BadRequestErrorDto,
      description: 'locale is en, or AI translation is not configured',
    }),
    ApiResponse({ status: 401, type: UnauthorizedErrorDto }),
    ApiResponse({ status: 403, type: ForbiddenErrorDto }),
    ApiResponse({
      status: 503,
      description: 'The AI provider failed - safe to retry',
    }),
  );
}
