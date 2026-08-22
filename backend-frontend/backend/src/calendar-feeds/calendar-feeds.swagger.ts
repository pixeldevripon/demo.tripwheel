import { applyDecorators } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
} from '@nestjs/swagger';
import {
  ForbiddenErrorDto,
  NotFoundErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import { CalendarFeedResponseDto } from './dto/calendar-feed.dto';

export function ApiListCalendarFeedsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List my calendar feeds',
      description:
        "The caller operator's live feeds. A feed whose kind the caller lacks permission for is omitted rather than rejected.",
    }),
    ApiOkResponse({ type: [CalendarFeedResponseDto] }),
    ApiResponse({ status: 401, type: UnauthorizedErrorDto }),
    ApiResponse({ status: 403, type: ForbiddenErrorDto }),
  );
}

export function ApiCreateCalendarFeedDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create (or fetch) a calendar feed',
      description:
        'Idempotent per (operator, kind). Re-creating a revoked feed mints a NEW token; the revoked one stays dead. BOOKINGS additionally requires VIEW_BOOKINGS.',
    }),
    ApiCreatedResponse({ type: CalendarFeedResponseDto }),
    ApiResponse({ status: 401, type: UnauthorizedErrorDto }),
    ApiResponse({ status: 403, type: ForbiddenErrorDto }),
  );
}

export function ApiRotateCalendarFeedDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Rotate a feed token',
      description:
        'Issues a new token. Every existing calendar subscription to this feed stops working and must be re-added.',
    }),
    ApiOkResponse({ type: CalendarFeedResponseDto }),
    ApiResponse({ status: 401, type: UnauthorizedErrorDto }),
    ApiResponse({ status: 403, type: ForbiddenErrorDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
  );
}

export function ApiRevokeCalendarFeedDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Revoke a calendar feed',
      description:
        'The feed answers 404 from now on. The row is retained so the token can never be re-issued.',
    }),
    ApiNoContentResponse(),
    ApiResponse({ status: 401, type: UnauthorizedErrorDto }),
    ApiResponse({ status: 403, type: ForbiddenErrorDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
  );
}

export function ApiRenderCalendarFeedDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Subscribable iCal feed (token-authenticated)',
      description:
        'The URL an operator pastes into Google/Apple/Outlook Calendar. Public by necessity - calendar clients carry no session - so the token IS the credential. Supports conditional GET via ETag/If-None-Match. Unknown, malformed and revoked tokens all answer 404 alike.',
    }),
    ApiParam({
      name: 'token',
      description: 'The feed token from the feed URL',
    }),
    ApiProduces('text/calendar'),
    ApiOkResponse({
      description: 'An RFC 5545 VCALENDAR document',
      schema: { type: 'string', example: 'BEGIN:VCALENDAR\r\n…' },
    }),
    ApiResponse({
      status: 304,
      description: 'Not modified since the client ETag',
    }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
  );
}
