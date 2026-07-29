import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

import {
  BadRequestErrorDto,
  ForbiddenErrorDto,
  InternalServerErrorDto,
  NotFoundErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';

import {
  CustomScriptResponseDto,
  PublicCustomScriptsResponseDto,
} from './dto/custom-script.dto';

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

const notFound = ApiResponse({
  status: 404,
  description: 'Custom script not found',
  type: NotFoundErrorDto,
});

export function ApiGetPublicCustomScriptsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Active custom scripts, split by injection point (no auth)',
      description:
        'What the public site injects, already PARSED into top-level nodes ' +
        '({tag, attributes, html}) and in render order. The raw markup is not ' +
        'sent: the site renders a closed set of known tags rather than ' +
        'interpolating a string, which is the last step of the ' +
        'defence-in-depth chain. `head` runs before any content is drawn, ' +
        '`bodyEnd` after. Only ACTIVE snippets appear - a switched-off one is ' +
        'filtered in the query, so its code never reaches the payload or the ' +
        'page. No auth: this markup is served in the HTML of every public page ' +
        'by definition.',
    }),
    ApiResponse({
      status: 200,
      description: 'Active scripts by position',
      type: PublicCustomScriptsResponseDto,
    }),
    ...commonErrors,
  );
}

export function ApiListCustomScriptsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List every custom script (admin)',
      description:
        'All snippets, active or not, in render order. Requires VIEW_SETTINGS.',
    }),
    ApiResponse({
      status: 200,
      description: 'All custom scripts',
      type: [CustomScriptResponseDto],
    }),
    ...adminErrors,
  );
}

export function ApiGetCustomScriptDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get one custom script (admin)' }),
    ApiResponse({
      status: 200,
      description: 'The custom script',
      type: CustomScriptResponseDto,
    }),
    notFound,
    ...adminErrors,
  );
}

export function ApiCreateCustomScriptDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Add a custom script (admin)',
      description:
        "Stores the snippet VERBATIM - an admin pastes a vendor's exact code " +
        'and rewriting it would break integrity hashes and vendor support. ' +
        'The markup is structurally validated first: only ' +
        '<script>/<style>/<link>/<meta>/<noscript> at the top level, <iframe> ' +
        'only inside <noscript> (the GTM snippet shape), no <base>, no inline ' +
        'event handlers, no javascript: URLs, nothing left unclosed. The script ' +
        'BODY is not validated and cannot be - running vendor JavaScript is the ' +
        'feature. Requires MANAGE_SETTINGS; every write is logged with the ' +
        'admin id. New snippets append to the end of their position.',
    }),
    ApiResponse({
      status: 201,
      description: 'Created',
      type: CustomScriptResponseDto,
    }),
    ...adminErrors,
  );
}

export function ApiUpdateCustomScriptDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Edit a custom script (admin)',
      description:
        'Partial update; `code` keeps the same structural validation, so a ' +
        'snippet cannot be edited into an unsafe shape. Setting `isActive` ' +
        'false removes it from every page without deleting it.',
    }),
    ApiResponse({
      status: 200,
      description: 'Updated',
      type: CustomScriptResponseDto,
    }),
    notFound,
    ...adminErrors,
  );
}

export function ApiReorderCustomScriptsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Reorder custom scripts (admin)',
      description:
        'The whole list in one transactional call. Order IS execution order - ' +
        'a consent manager has to run before the tags it gates - so a ' +
        'half-applied reorder is a real defect, not a cosmetic one.',
    }),
    ApiResponse({
      status: 200,
      description: 'The full list in its new order',
      type: [CustomScriptResponseDto],
    }),
    ...adminErrors,
  );
}

export function ApiDeleteCustomScriptDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete a custom script (admin)',
      description:
        'Permanent. To take a snippet off the site while keeping it, set ' +
        '`isActive: false` instead.',
    }),
    ApiResponse({ status: 200, description: 'Removed' }),
    notFound,
    ...adminErrors,
  );
}
