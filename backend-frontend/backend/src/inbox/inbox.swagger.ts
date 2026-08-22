import {
  BadRequestErrorDto,
  InternalServerErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  InboxClearResponseDto,
  InboxDigestResponseDto,
  InboxListResponseDto,
  InboxMarkReadResponseDto,
  InboxSummaryResponseDto,
} from './dto/inbox.dto';

/**
 * Every route here is self-scoped: the session decides whose inbox is read, so
 * there is no 403 and no 404 to document. A stranger's id in a request body
 * simply matches nothing.
 */
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

export const ApiInboxTag = () => ApiTags('Inbox');

export function ApiListInboxDocs() {
  return applyDecorators(
    ApiOperation({
      summary: "List the signed-in user's notifications",
      description:
        'Newest first, keyset-paginated on `createdAt`. Offset paging would skip or repeat rows as new notifications land at the top mid-scroll.',
    }),
    ApiResponse({ status: 200, type: InboxListResponseDto }),
    ...commonErrors,
  );
}

export function ApiInboxSummaryDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Unread counts for the bell and the sidebar badges',
      description:
        'One cheap grouped count. This is the endpoint the dashboard polls; the list is fetched only when the bell is opened.',
    }),
    ApiResponse({ status: 200, type: InboxSummaryResponseDto }),
    ...commonErrors,
  );
}

export function ApiMarkInboxReadDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Mark notifications read',
      description:
        'By `ids`, by `category` (the badge clear), or `all`. An empty body changes nothing - marking the whole inbox read is never the default.',
    }),
    ApiResponse({ status: 200, type: InboxMarkReadResponseDto }),
    ...commonErrors,
  );
}

export function ApiInboxDigestDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'The once-per-session login digest',
      description:
        'Returns unread notifications that arrived since this account last saw the digest, and stamps the marker. Empty when there is nothing new - the client must not render an empty modal. POST because it mutates that marker.',
    }),
    ApiResponse({ status: 200, type: InboxDigestResponseDto }),
    ...commonErrors,
  );
}

export function ApiClearInboxDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete notifications',
      description:
        'By `ids`, by `category`, or `all`; add `onlyRead: true` for the safe sweep. A hard delete - these rows record that someone was TOLD something, not the thing itself, and the booking or verdict behind each one keeps its own audit trail. An empty body deletes nothing.',
    }),
    ApiResponse({ status: 200, type: InboxClearResponseDto }),
    ...commonErrors,
  );
}

export function ApiRemoveInboxDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Dismiss one notification',
      description:
        'Scoped to the caller, so an id belonging to someone else deletes nothing and reports 0 rather than 404 - a 404 would confirm the row exists for somebody.',
    }),
    ApiResponse({ status: 200, type: InboxClearResponseDto }),
    ...commonErrors,
  );
}
