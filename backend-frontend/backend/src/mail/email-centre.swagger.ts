import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  BadRequestErrorDto,
  ForbiddenErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import {
  EmailSendRowDto,
  EmailSettingsResponseDto,
  PaginatedEmailConsentsResponseDto,
  PaginatedEmailOptOutsResponseDto,
  PaginatedEmailSendsResponseDto,
} from './dto/email-centre.dto';

const guarded = () =>
  applyDecorators(
    ApiUnauthorizedResponse({
      description: 'Not authenticated',
      type: UnauthorizedErrorDto,
    }),
    ApiForbiddenResponse({
      description: 'Requires MANAGE_SYSTEM',
      type: ForbiddenErrorDto,
    }),
  );

export function ApiGetEmailSettingsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Email programme settings (WP-H switchboard)',
      description:
        'Returns { effective, stored, defaults }: what runs now, what the ' +
        'admin explicitly stored (null = never touched), and what a null ' +
        'falls back to (env or built-in) — the dashboard renders "using ' +
        'default (…)" hints from the difference. Includes the ' +
        'ReviewRequestSettings slice.',
    }),
    ApiOkResponse({ type: EmailSettingsResponseDto }),
    guarded(),
  );
}

export function ApiUpdateEmailSettingsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update email programme settings',
      description:
        'Tri-state per field: absent = untouched, null = clear the override ' +
        '(back to env/built-in), value = store. The review slice writes to ' +
        'ReviewRequestSettings. There is NO switch for booking emails ' +
        '(BK-1/BK-2/CX-1) — they are contractual; unknown fields 400.',
    }),
    ApiOkResponse({ type: EmailSettingsResponseDto }),
    ApiBadRequestResponse({
      description: 'Bounds violation (e.g. empty send window) or unknown field',
      type: BadRequestErrorDto,
    }),
    guarded(),
  );
}

export function ApiListEmailSendsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Global email activity (send log)',
      description:
        'Every automated email decision — SENT, FAILED or SUPPRESSED (with ' +
        'reason) — newest first, filterable by template, status, stream, ' +
        'exact recipient and date range.',
    }),
    ApiOkResponse({ type: PaginatedEmailSendsResponseDto }),
    guarded(),
  );
}

export function ApiListEmailOptOutsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Email opt-outs',
      description:
        'Stream-scoped unsubscribes, newest first, searchable by email ' +
        'prefix. Transactional booking emails are never affected by these.',
    }),
    ApiOkResponse({ type: PaginatedEmailOptOutsResponseDto }),
    guarded(),
  );
}

export function ApiListEmailConsentsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Marketing consents',
      description:
        'Explicit checkout opt-ins (the MK-1 gate), newest first, ' +
        'searchable by email prefix.',
    }),
    ApiOkResponse({ type: PaginatedEmailConsentsResponseDto }),
    guarded(),
  );
}

export function ApiTestSendDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Send a test render of any template to yourself',
      description:
        'Renders the chosen template with fixed sample data and sends it to ' +
        'the calling admin’s own address. Logged under scopeId ' +
        '`test:<userId>#<n>` — never counted by any sweep. Booking templates ' +
        'are allowed (a test-send is not a switch).',
    }),
    ApiCreatedResponse({ type: EmailSendRowDto }),
    ApiBadRequestResponse({
      description: 'Unknown template key',
      type: BadRequestErrorDto,
    }),
    guarded(),
  );
}
