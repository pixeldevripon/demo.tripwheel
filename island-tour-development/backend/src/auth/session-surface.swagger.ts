import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  BadRequestErrorDto,
  ForbiddenErrorDto,
  InternalServerErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import { SessionSurfaceResponseDto } from './dto/session-surface.dto';

const commonErrors = [
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

export function ApiGetSessionSurfaceDocs() {
  return applyDecorators(
    ApiOperation({
      summary:
        "The current session's surface + every surface this account may use",
      description:
        'Powers the dashboard "switch view" affordance for multi-hat ' +
        'accounts: `available` lists one surface per attached identity, ' +
        '`current` is what the session was stamped with at sign-in (or by a ' +
        'later switch).',
    }),
    ApiResponse({
      status: 200,
      description: 'Current + available surfaces',
      type: SessionSurfaceResponseDto,
    }),
    ...commonErrors,
  );
}

export function ApiUpdateSessionSurfaceDocs() {
  return applyDecorators(
    ApiOperation({
      summary:
        'Re-stamp the current session with another surface the account holds',
      description:
        'Presentational only - the surface must already be granted by the ' +
        "account's identities (same derivation the sign-in enforcement " +
        'uses), and API authorization is unchanged. Lets a multi-hat user ' +
        'switch between e.g. the staff dashboard and their traveler view ' +
        'without re-entering a password.',
    }),
    ApiResponse({
      status: 200,
      description: 'Session re-stamped; returns the new current + available',
      type: SessionSurfaceResponseDto,
    }),
    ApiResponse({
      status: 400,
      description: 'Bad Request - Unknown surface value',
      type: BadRequestErrorDto,
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - The account holds no identity for that surface',
      type: ForbiddenErrorDto,
    }),
    ...commonErrors,
  );
}
