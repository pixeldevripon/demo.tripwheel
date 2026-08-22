import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  BadRequestErrorDto,
  InternalServerErrorDto,
} from '@/common/dto/error-responses.dto';
import { LoginPrecheckResponseDto } from './dto/login-precheck.dto';

export function ApiLoginPrecheckDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Check whether an email belongs at a login surface (public)',
      description:
        'Called by login pages before sign-in for friendly wrong-door ' +
        'messaging. Advisory only - the sign-in endpoint independently ' +
        'enforces the surface via the x-login-surface header, so skipping ' +
        'this check cannot bypass the door. Unknown emails always return ' +
        'ok=true. Throttled like sign-in.',
    }),
    ApiResponse({
      status: 200,
      description: 'Verdict for this email + surface combination',
      type: LoginPrecheckResponseDto,
    }),
    ApiResponse({
      status: 400,
      description: 'Bad Request - Invalid email or unknown surface',
      type: BadRequestErrorDto,
    }),
    ApiResponse({
      status: 429,
      description: 'Too Many Requests - throttled (matches sign-in limits)',
    }),
    ApiResponse({
      status: 500,
      description: 'Internal Server Error',
      type: InternalServerErrorDto,
    }),
  );
}
