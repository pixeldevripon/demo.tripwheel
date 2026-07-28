import {
  BadRequestErrorDto,
  ConflictErrorDto,
  ForbiddenErrorDto,
  InternalServerErrorDto,
  NotFoundErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import { Locale } from '@/common/constants/locales';
import { FaqGroupResponseDto } from '@/common/faq/dto/faq-group.dto';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import {
  AddAllowedCategoryResponseDto,
  AllowedCategoryItemDto,
  ComparisonGroupTranslationResponseDto,
  ComparisonTourTranslationResponseDto,
  DeleteHubResponseDto,
  DeleteMessageResponseDto,
  HubFaqResponseDto,
  HubByDestinationResponseDto,
  HubDetailLocalizedResponseDto,
  HubPageContentResponseDto,
  HubSectionTranslationResponseDto,
  HubTranslationEntryDto,
  OurPickTranslationResponseDto,
  PaginatedLocalizedHubsResponseDto,
  RemoveAllowedCategoryResponseDto,
} from './dto/hub.dto';
import { HubSectionType } from '@prisma/client';

// ── Shared error sets ─────────────────────────────────────────────────────────

const serverError = ApiResponse({ status: 500, type: InternalServerErrorDto });

const publicErrors = [serverError];

const commonErrors = [
  ApiResponse({
    status: 400,
    description: 'Bad Request',
    type: BadRequestErrorDto,
  }),
  ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: UnauthorizedErrorDto,
  }),
  serverError,
];

const adminErrors = [
  ...commonErrors,
  ApiResponse({
    status: 403,
    description: 'Forbidden',
    type: ForbiddenErrorDto,
  }),
];

const localeParam = ApiQuery({
  name: 'locale',
  required: false,
  enum: Locale,
  example: 'en',
  description:
    'Content locale - falls back to English when translation is missing',
});

// ── Public list / lookup ──────────────────────────────────────────────────────

export function ApiGetAllHubsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List all hubs with optional filters (public)',
      description:
        'Public paginated list. Supports filtering by destinationId and isActive.',
    }),
    ApiQuery({ name: 'destinationId', required: false, type: String }),
    ApiQuery({ name: 'isActive', required: false, type: Boolean }),
    ApiQuery({ name: 'page', required: false, type: Number }),
    ApiQuery({ name: 'limit', required: false, type: Number }),
    localeParam,
    ApiResponse({ status: 200, type: PaginatedLocalizedHubsResponseDto }),
    ...publicErrors,
  );
}

export function ApiGetActiveHubsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List all active hubs (public)',
      description:
        'Returns all active hubs without pagination. Optionally filter by destinationId.',
    }),
    ApiQuery({ name: 'destinationId', required: false, type: String }),
    localeParam,
    ApiResponse({ status: 200, type: [HubDetailLocalizedResponseDto] }),
    ...publicErrors,
  );
}

export function ApiGetHubsByDestinationDocs() {
  return applyDecorators(
    ApiOperation({
      summary:
        'List hubs that have ≥1 published tour in a destination (public)',
      description:
        'Tour-gated: only PUBLISHED + active hubs with at least one LIVE tour in the destination are ' +
        'returned, each with publishedTourCount, ordered by name. Used for destination-page discovery rows.',
    }),
    ApiParam({ name: 'destinationSlug', example: 'curacao' }),
    localeParam,
    ApiResponse({ status: 200, type: [HubByDestinationResponseDto] }),
    ApiResponse({
      status: 404,
      description: 'Destination not found',
      type: NotFoundErrorDto,
    }),
    ...publicErrors,
  );
}

export function ApiGetHubBySlugDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get a hub by slug (public)',
      description:
        'Hub slugs are unique per destination, so `destinationSlug` is required. ' +
        'Example: GET /hubs/slug/klein-curacao?destinationSlug=curacao',
    }),
    ApiParam({
      name: 'slug',
      description: 'Hub slug',
      example: 'klein-curacao',
    }),
    ApiQuery({
      name: 'destinationSlug',
      required: true,
      example: 'curacao',
      description: 'Destination slug',
    }),
    localeParam,
    ApiResponse({ status: 200, type: HubDetailLocalizedResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

export function ApiGetHubByIdDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get a hub by UUID (public)' }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    localeParam,
    ApiResponse({ status: 200, type: HubDetailLocalizedResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

// ── Admin CRUD ────────────────────────────────────────────────────────────────

export function ApiCreateHubDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create a new hub (Admin/Editor)',
      description:
        'Atomically creates the hub and seeds one slug_registry row for its destination. ' +
        'Requires `hubType` (location | highlight | area - V2 §5) and accepts latitude/longitude. ' +
        'Optionally seeds allowed categories in the same transaction.',
    }),
    ApiResponse({ status: 201, type: HubDetailLocalizedResponseDto }),
    ApiResponse({
      status: 404,
      description: 'Destination not found',
      type: NotFoundErrorDto,
    }),
    ApiResponse({
      status: 409,
      description: 'Hub slug already exists for this destination',
      type: ConflictErrorDto,
    }),
    ...adminErrors,
  );
}

export function ApiUpdateHubDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update a hub (Admin/Editor)',
      description:
        'Updates any of: name, description, hubType, latitude, longitude, active status. Slug is immutable. ' +
        'If isActive changes, the slug_registry row is mirrored in the same transaction.',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiResponse({ status: 200, type: HubDetailLocalizedResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiDeleteHubDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Deactivate a hub (Admin/Editor)',
      description:
        'Soft-delete: sets isActive = false on the hub and its slug_registry row. ' +
        'Seeded hubs and those with existing trips are blocked.',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiResponse({ status: 200, type: DeleteHubResponseDto }),
    ApiResponse({ status: 403, type: ForbiddenErrorDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ApiResponse({ status: 409, type: ConflictErrorDto }),
    ...adminErrors,
  );
}

// ── Allowed categories ────────────────────────────────────────────────────────

export function ApiGetAllowedCategoriesDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get allowed categories for a hub (public)' }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiResponse({ status: 200, type: [AllowedCategoryItemDto] }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

export function ApiAddAllowedCategoryDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Add an allowed category to a hub (Admin/Editor)',
      description:
        "Adds a category to the hub's allowed set. Operators can only assign this category to trips in this hub.",
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiResponse({ status: 201, type: AddAllowedCategoryResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ApiResponse({
      status: 409,
      description: 'Category already allowed for this hub',
      type: ConflictErrorDto,
    }),
    ...adminErrors,
  );
}

export function ApiRemoveAllowedCategoryDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Remove an allowed category from a hub (Admin/Editor)',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiParam({ name: 'categoryId', description: 'Category UUID' }),
    ApiResponse({ status: 200, type: RemoveAllowedCategoryResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

// ── Translation management ────────────────────────────────────────────────────

export function ApiGetAllTranslationsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get all translations for a hub (Admin/Editor)',
      description: 'Returns all available locales and their translated fields.',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiResponse({ status: 200, type: [HubTranslationEntryDto] }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiGetTranslationsByLocaleDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get translations for a specific locale (Admin/Editor)',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: Locale.nl }),
    ApiResponse({ status: 200, type: HubTranslationEntryDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiUpsertTranslationsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Patch translations for a locale (Admin/Editor)',
      description:
        'Creates or updates translated fields for the given locale. Only supplied fields are written - omitted fields are left unchanged. ' +
        'Hub names are proper nouns - set isMachineTranslated to false.',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: Locale.nl }),
    ApiResponse({ status: 200, type: HubTranslationEntryDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiDeleteTranslationsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete all translations for a locale (Admin/Editor)',
      description:
        'Removes every translated field row for the given locale. English ("en") cannot be deleted via this endpoint - update the hub name field instead.',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: Locale.nl }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

// ── Page Content ──────────────────────────────────────────────────────────────

export function ApiGetPageContentDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get editorial page content for a hub (public)',
      description:
        'Returns about text, meta title, and meta description for the requested locale.',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    localeParam,
    ApiResponse({ status: 200, type: HubPageContentResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

export function ApiUpsertPageContentDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Patch editorial page content for a locale (Admin/Editor)',
      description:
        'Creates or updates about text, meta title, and meta description. Only supplied fields are written - omitted fields are left unchanged.',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: Locale.nl }),
    ApiResponse({ status: 200, type: HubPageContentResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

export function ApiGetFaqsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get active FAQs for a hub (public)',
      description:
        'Returns active FAQ items. Pass ?locale= to filter by locale; omit to return all locales.',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiQuery({
      name: 'locale',
      required: false,
      enum: Locale,
      example: Locale.en,
    }),
    ApiResponse({ status: 200, type: [HubFaqResponseDto] }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

export function ApiCreateFaqDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Create a FAQ item for a hub (Admin/Editor)' }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiResponse({ status: 201, type: HubFaqResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiUpdateFaqDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update a FAQ item (Admin/Editor)' }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiParam({ name: 'faqId', description: 'FAQ UUID' }),
    ApiResponse({ status: 200, type: HubFaqResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiDeleteFaqDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Delete a FAQ item (Admin/Editor)' }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiParam({ name: 'faqId', description: 'FAQ UUID' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

// ── Grouped FAQ (add in English, then translate) ──────────────────────────────

export function ApiGetFaqGroupsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get FAQs grouped by locale for a hub (Admin/Editor)',
      description:
        'Returns each logical FAQ once, with its per-locale translations nested. Powers the dashboard "add in English, then translate" editor.',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiResponse({ status: 200, type: [FaqGroupResponseDto] }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiCreateFaqGroupDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create a FAQ (English base) for a hub (Admin/Editor)',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiResponse({ status: 201, type: FaqGroupResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiUpdateFaqGroupDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update a FAQ group (display order / active) (Admin/Editor)',
      description: 'Applies to every locale row of the FAQ at once.',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiParam({ name: 'groupId', description: 'FAQ group UUID' }),
    ApiResponse({ status: 200, type: FaqGroupResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiDeleteFaqGroupDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete a FAQ and all its translations (Admin/Editor)',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiParam({ name: 'groupId', description: 'FAQ group UUID' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiUpsertFaqTranslationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Add or update a FAQ translation for one locale (Admin/Editor)',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiParam({ name: 'groupId', description: 'FAQ group UUID' }),
    ApiParam({ name: 'locale', enum: Locale, description: 'Target locale' }),
    ApiResponse({ status: 200, type: HubFaqResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

// ── Curation translation upserts (Translation Console per-item saves) ─────────

export function ApiUpsertOurPickTranslationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: "Upsert one locale of an Our Pick's rationale (Admin/Editor)",
      description:
        'Human write path for the Translation Console. `en` edits the base ' +
        'blurb and re-queues AI translation; other locales upsert the ' +
        'translation row and clear its machine flag so the AI refresher ' +
        'never overwrites it.',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiParam({ name: 'pickId', description: 'Our Pick UUID' }),
    ApiParam({ name: 'locale', enum: Locale, description: 'Target locale' }),
    ApiResponse({ status: 200, type: OurPickTranslationResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiUpsertComparisonGroupTranslationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: "Upsert one locale of a comparison group's name (Admin/Editor)",
      description:
        'Human write path for the Translation Console. `en` edits the base ' +
        'name and re-queues AI translation; other locales upsert the ' +
        'translation row and clear its machine flag.',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiParam({ name: 'groupId', description: 'Comparison group UUID' }),
    ApiParam({ name: 'locale', enum: Locale, description: 'Target locale' }),
    ApiResponse({ status: 200, type: ComparisonGroupTranslationResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiUpsertComparisonTourTranslationDocs() {
  return applyDecorators(
    ApiOperation({
      summary:
        "Upsert one locale of a comparison column's standout note (Admin/Editor)",
      description:
        'Human write path for the Translation Console. `en` edits the base ' +
        'note and re-queues AI translation; other locales upsert the ' +
        'translation row and clear its machine flag.',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiParam({
      name: 'comparisonTourId',
      description: 'Comparison tour column UUID',
    }),
    ApiParam({ name: 'locale', enum: Locale, description: 'Target locale' }),
    ApiResponse({ status: 200, type: ComparisonTourTranslationResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

/** Shared docs for the three curation "clear one locale" routes. */
export function ApiClearCurationTranslationDocs(
  label: string,
  idParam: string,
) {
  return applyDecorators(
    ApiOperation({
      summary: `Clear one locale of a ${label} (Admin/Editor)`,
      description:
        "Deletes that locale's translation row - the Translation Console's " +
        '"clear". The column is NOT NULL, so a blank translation cannot be ' +
        'stored: removing the row IS the cleared state, and the public page ' +
        'falls back to the English source. `en` is rejected (it lives on the ' +
        'base row). Idempotent - clearing an absent row succeeds.',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiParam({ name: idParam, description: `${label} owner UUID` }),
    ApiParam({ name: 'locale', enum: Locale, description: 'Target locale' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ApiResponse({
      status: 400,
      type: BadRequestErrorDto,
      description: 'locale is en',
    }),
    ...adminErrors,
  );
}

export function ApiClearSectionTranslationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Clear one locale of a content block (Admin/Editor)',
      description:
        "Deletes that locale's row for the block addressed by " +
        '(sectionType, displayOrder). Blocks fall back as a SET per locale, ' +
        'so clearing one while its siblings stay translated drops it from ' +
        'the page rather than showing it in English - clear the whole type ' +
        'to fall back cleanly. `en` is rejected. Idempotent.',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiParam({
      name: 'sectionType',
      enum: HubSectionType,
      description: 'Block type',
    }),
    ApiParam({
      name: 'displayOrder',
      description: 'Block position within its type (0-based)',
    }),
    ApiParam({ name: 'locale', enum: Locale, description: 'Target locale' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ApiResponse({
      status: 400,
      type: BadRequestErrorDto,
      description: 'locale is en',
    }),
    ...adminErrors,
  );
}

export function ApiUpsertSectionTranslationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Upsert one locale of a content block (Admin/Editor)',
      description:
        'Human write path for the Translation Console. Blocks are addressed ' +
        'by (sectionType, displayOrder) - their cross-locale identity. `en` ' +
        'edits the source row and re-queues AI translation; other locales ' +
        'upsert the sibling row and clear its machine flag. Omit `heading` ' +
        'for headingless block types (the body is mirrored into it).',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiParam({
      name: 'sectionType',
      enum: HubSectionType,
      description: 'Block type',
    }),
    ApiParam({
      name: 'displayOrder',
      description: 'Block position within its type (0-based)',
    }),
    ApiParam({ name: 'locale', enum: Locale, description: 'Target locale' }),
    ApiResponse({ status: 200, type: HubSectionTranslationResponseDto }),
    ApiResponse({
      status: 404,
      type: NotFoundErrorDto,
      description: 'No English block exists at (sectionType, displayOrder)',
    }),
    ...adminErrors,
  );
}
