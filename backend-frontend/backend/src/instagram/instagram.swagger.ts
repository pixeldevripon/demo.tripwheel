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
  InstagramConnectionResponseDto,
  InstagramCredentialStatusResponseDto,
  InstagramPostResponseDto,
  InstagramSyncResultResponseDto,
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
      summary: 'Update the Instagram section settings (admin)',
      description:
        'Sets the public layout and the sync tuning (posts-per-sync, auto-sync ' +
        'cadence). The handle and profile link are auto-derived from the ' +
        'connected account and never set here. Changing the cadence re-registers ' +
        'the sync cron live.',
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

export function ApiGetInstagramCredentialsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get Instagram access token status (admin)',
      description:
        'Non-secret view: booleans for whether a token is stored / configured, ' +
        'plus the masked tail (bullets + last 4 characters) so an admin can ' +
        'tell WHICH token is stored. The token itself is never returned. ' +
        'There is no env fallback - the credential is DB-only.',
    }),
    ApiResponse({
      status: 200,
      description: 'Credential status',
      type: InstagramCredentialStatusResponseDto,
    }),
    ...adminErrors,
  );
}

export function ApiSaveInstagramCredentialsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Save the Instagram access token (admin)',
      description:
        'Stores the long-lived access token in the database, encrypted. Omit ' +
        'it to leave the stored one; send an empty string to clear it (the feed ' +
        'then has no token). Saving re-seeds the connection. DB-only - no env.',
    }),
    ApiResponse({
      status: 200,
      description: 'Saved; returns the fresh non-secret status',
      type: InstagramCredentialStatusResponseDto,
    }),
    ...adminErrors,
  );
}

export function ApiGetInstagramConnectionDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Instagram connection status (admin)',
      description:
        'Whether a token is configured, the resolved account id, the token ' +
        'expiry, and the last sync outcome. Never returns the token itself.',
    }),
    ApiResponse({
      status: 200,
      description: 'Connection status retrieved',
      type: InstagramConnectionResponseDto,
    }),
    ...adminErrors,
  );
}

export function ApiSyncInstagramDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Run a sync now (admin)',
      description:
        'Pulls recent media, mirrors each asset into Cloudinary, and upserts ' +
        'the tiles. Refreshes the token first if it is near expiry. A missing ' +
        'connection is a no-op, not an error.',
    }),
    ApiResponse({
      status: 200,
      description: 'Sync run finished',
      type: InstagramSyncResultResponseDto,
    }),
    ...adminErrors,
  );
}

export function ApiUpdateInstagramPostDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Curate a synced tile: hide/show, alt text, island (admin)',
      description:
        'Synced tiles own their media, caption and permalink (the sync fills ' +
        'them); this endpoint edits only the curation fields - visibility ' +
        '(isActive), alt text, and the pinned destination.',
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
