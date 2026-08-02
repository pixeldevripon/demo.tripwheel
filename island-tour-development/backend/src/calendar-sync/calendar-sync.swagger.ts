import { applyDecorators } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import {
  BadRequestErrorDto,
  ConflictErrorDto,
  ForbiddenErrorDto,
  NotFoundErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import {
  CalendarSubscriptionResponseDto,
  DisconnectResponseDto,
  PaginatedSyncLogsDto,
  SyncRunResponseDto,
  ValidateFeedResponseDto,
} from './dto/calendar-subscription.dto';

/** Shared by every route here: all of them are operator-scoped and authenticated. */
const scoped = () => [
  ApiResponse({ status: 401, type: UnauthorizedErrorDto }),
  ApiResponse({ status: 403, type: ForbiddenErrorDto }),
  ApiResponse({ status: 404, type: NotFoundErrorDto }),
];

export function ApiListSubscriptionsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: "List a tour's connected calendars",
      description:
        'URLs are MASKED here - an OTA calendar link is a bearer credential for that operator account, so the full value is only returned by the single-subscription read.',
    }),
    ApiOkResponse({ type: [CalendarSubscriptionResponseDto] }),
    ...scoped(),
  );
}

export function ApiGetSubscriptionDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Read one calendar connection',
      description:
        'Returns the unmasked URL; this is what the edit form loads.',
    }),
    ApiOkResponse({ type: CalendarSubscriptionResponseDto }),
    ...scoped(),
  );
}

export function ApiValidateFeedDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Dry-run a calendar URL',
      description:
        'Fetches and parses the feed and writes nothing. Powers the inline check in the add form, so a bad link is caught while the operator is still looking at the field rather than failing silently every hour afterwards.',
    }),
    ApiOkResponse({
      type: ValidateFeedResponseDto,
      description:
        'Always 200 - `valid` carries the verdict, so the form can render a specific reason and hint rather than a generic failure.',
    }),
    ...scoped(),
  );
}

export function ApiCreateSubscriptionDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Connect an external calendar',
      description:
        'Stores the URL encrypted and schedules the first sync immediately. Re-adding a previously disconnected URL revives that row so its history stays attached.',
    }),
    ApiCreatedResponse({ type: CalendarSubscriptionResponseDto }),
    ApiResponse({ status: 400, type: BadRequestErrorDto }),
    ApiResponse({
      status: 409,
      type: ConflictErrorDto,
      description:
        'Already connected, or the per-tour calendar limit is reached.',
    }),
    ...scoped(),
  );
}

export function ApiUpdateSubscriptionDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update a calendar connection',
      description:
        '`platform` is immutable - existing blocks are attributed to it, so changing it would relabel history. Changing the URL resets the cached validators and error state and forces a fresh sync.',
    }),
    ApiOkResponse({ type: CalendarSubscriptionResponseDto }),
    ApiResponse({ status: 400, type: BadRequestErrorDto }),
    ...scoped(),
  );
}

export function ApiDisconnectSubscriptionDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Disconnect a calendar',
      description:
        'Soft-deletes the connection. `releaseDates=false` (the default) converts its blocks to manual closures and keeps the dates shut; `true` frees them. Keeping is the default because a channel that stopped syncing is not a channel whose dates became free.',
    }),
    ApiOkResponse({ type: DisconnectResponseDto }),
    ApiResponse({
      status: 409,
      type: ConflictErrorDto,
      description: 'A sync is currently running for this connection.',
    }),
    ...scoped(),
  );
}

export function ApiListSyncLogsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Run history for one calendar',
      description:
        'Newest first. Answers "why did my dates change" and "why has nothing synced since Tuesday", and is the audit trail when an import closed a booked date. In WARN_ONLY - where nothing is written to availability - this history is most of what the feature produces. Retained 7 days for unchanged runs, 180 days for everything else.',
    }),
    ApiOkResponse({ type: PaginatedSyncLogsDto }),
    ...scoped(),
  );
}

export function ApiSyncNowDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Sync this calendar now',
      description:
        'Runs the full pipeline immediately. Allowed on a paused or errored connection too - it is how an operator verifies a fix.',
    }),
    ApiOkResponse({ type: SyncRunResponseDto }),
    ApiResponse({
      status: 409,
      type: ConflictErrorDto,
      description: 'A sync is already in progress.',
    }),
    ...scoped(),
  );
}
