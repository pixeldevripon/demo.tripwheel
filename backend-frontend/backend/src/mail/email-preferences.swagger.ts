import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import {
  InternalServerErrorDto,
  NotFoundErrorDto,
  TooManyRequestsErrorDto,
} from '@/common/dto/error-responses.dto';
import { UnsubscribeStatusResponseDto } from './dto/email-preferences.dto';

const tokenParam = ApiParam({
  name: 'token',
  description: 'Unsubscribe token from an email footer link',
  example: 'c1f7f2f0-6f3a-4d2c-9b7e-1a2b3c4d5e6f',
});

const commonErrors = [
  ApiResponse({
    status: 404,
    description: 'Unknown token (same shape for missing and malformed)',
    type: NotFoundErrorDto,
  }),
  ApiResponse({
    status: 429,
    description: 'Too many requests',
    type: TooManyRequestsErrorDto,
  }),
  ApiResponse({
    status: 500,
    description: 'Internal Server Error',
    type: InternalServerErrorDto,
  }),
];

export function ApiResolveUnsubscribeTokenDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Resolve an unsubscribe token',
      description:
        'Public, token-authenticated. Returns the masked address, the audience and the ONE stream the token opts out of, plus whether that opt-out already exists. Unknown tokens 404 with no oracle.',
    }),
    tokenParam,
    ApiResponse({
      status: 200,
      description: 'Token resolved',
      type: UnsubscribeStatusResponseDto,
    }),
    ...commonErrors,
  );
}

export function ApiActOnUnsubscribeTokenDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Opt out via an unsubscribe token',
      description:
        'Public, token-authenticated, idempotent: repeating the call is a no-op, never an error (links in old emails keep working). Opts the address out of ONLY the stream the token names - transactional email is unaffected.',
    }),
    tokenParam,
    ApiResponse({
      status: 201,
      description: 'Opt-out recorded (or already in place)',
      type: UnsubscribeStatusResponseDto,
    }),
    ...commonErrors,
  );
}
