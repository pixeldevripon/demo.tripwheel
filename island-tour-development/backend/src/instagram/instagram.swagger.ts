import {
  BadRequestErrorDto,
  ForbiddenErrorDto,
  InternalServerErrorDto,
  NotFoundErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  InstagramAccountResponseDto,
  InstagramPostResponseDto,
  PublicInstagramFeedResponseDto,
} from './dto/instagram.dto';

const commonErrors = [
  ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data',
    type: BadRequestErrorDto,
  }),
  ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid authentication',
    type: UnauthorizedErrorDto,
  }),
  ApiResponse({
    status: 500,
    description: 'Internal Server Error',
    type: InternalServerErrorDto,
  }),
];

const adminErrors = [
  ...commonErrors,
  ApiResponse({
    status: 403,
    description: 'Forbidden - requires MANAGE_SETTINGS',
    type: ForbiddenErrorDto,
  }),
];

export function ApiGetPublicInstagramFeedDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Instagram grid: handle row + tiles (no auth)',
      description:
        'Serves only URLs we control - Instagram CDN links expire within days ' +
        'and hotlinking them breaks their terms, so tiles always render from ' +
        'our own media. `enabled` folds together the admin kill switch ' +
        '(SiteInfo.enableInstagram) and "no tiles to show": either way the ' +
        'frontend renders no section. Passing `destination` adds the tiles ' +
        'pinned to that island to the brand-wide set.',
    }),
    ApiResponse({
      status: 200,
      description: 'Feed resolved successfully',
      type: PublicInstagramFeedResponseDto,
    }),
    ...commonErrors,
  );
}

export function ApiGetInstagramAccountDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get the connected Instagram account (admin)',
      description:
        'Read-only: never creates the singleton row, so an unconfigured ' +
        'platform reports empty rather than writing on a GET.',
    }),
    ApiResponse({
      status: 200,
      description: 'Account retrieved successfully',
      type: InstagramAccountResponseDto,
    }),
    ...commonErrors,
  );
}

export function ApiUpdateInstagramAccountDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update the Instagram handle / profile link (admin)',
      description:
        "Accepts '@handle', 'handle' or a pasted profile URL and stores the " +
        'bare handle. An empty profileUrl is fine - the link is derived from ' +
        'the handle.',
    }),
    ApiResponse({
      status: 200,
      description: 'Account updated successfully',
      type: InstagramAccountResponseDto,
    }),
    ...adminErrors,
  );
}

export function ApiListInstagramPostsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List every Instagram tile, active or not (admin)',
    }),
    ApiResponse({
      status: 200,
      description: 'Tiles retrieved successfully',
      type: [InstagramPostResponseDto],
    }),
    ...adminErrors,
  );
}

export function ApiCreateInstagramPostDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Add a curated Instagram tile (admin)',
      description:
        'The image must be a media-library asset. New tiles land at the end ' +
        'of the grid.',
    }),
    ApiResponse({
      status: 201,
      description: 'Tile created successfully',
      type: InstagramPostResponseDto,
    }),
    ...adminErrors,
  );
}

export function ApiUpdateInstagramPostDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update an Instagram tile (admin)',
      description:
        'On API-synced tiles the photo, caption and permalink are owned by the ' +
        'sync job and rejected here (the next run would revert the edit); ' +
        'order, visibility, pinning and alt text stay editable on every tile.',
    }),
    ApiResponse({
      status: 200,
      description: 'Tile updated successfully',
      type: InstagramPostResponseDto,
    }),
    ApiResponse({
      status: 404,
      description: 'Instagram tile not found',
      type: NotFoundErrorDto,
    }),
    ...adminErrors,
  );
}

export function ApiReorderInstagramPostsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Persist a drag-and-drop reorder (admin)',
      description:
        'Applied in one transaction, so a partial write can never leave two ' +
        'tiles sharing a slot. Returns the full list in its new order.',
    }),
    ApiResponse({
      status: 200,
      description: 'Order saved successfully',
      type: [InstagramPostResponseDto],
    }),
    ...adminErrors,
  );
}

export function ApiDeleteInstagramPostDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Remove an Instagram tile (admin)' }),
    ApiResponse({ status: 200, description: 'Tile removed successfully' }),
    ApiResponse({
      status: 404,
      description: 'Instagram tile not found',
      type: NotFoundErrorDto,
    }),
    ...adminErrors,
  );
}
