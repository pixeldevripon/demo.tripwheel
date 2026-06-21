import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  BadRequestErrorDto,
  ForbiddenErrorDto,
  NotFoundErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import {
  CalendarDayResponseDto,
  DepartureResponseDto,
  ExceptionResponseDto,
  MaterializeResultDto,
  ScheduleResponseDto,
} from './dto/availability.dto';

const authErrors = () =>
  applyDecorators(
    ApiUnauthorizedResponse({ type: UnauthorizedErrorDto }),
    ApiForbiddenResponse({ type: ForbiddenErrorDto }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
  );

// ── Schedules ────────────────────────────────────────────────────────────────
export const ApiCreateScheduleDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Create a recurring availability schedule' }),
    ApiOkResponse({ type: ScheduleResponseDto }),
    authErrors(),
  );

export const ApiUpdateScheduleDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Update an availability schedule' }),
    ApiOkResponse({ type: ScheduleResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    authErrors(),
  );

export const ApiDeleteScheduleDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Delete an availability schedule' }),
    ApiOkResponse({ description: 'Deleted.' }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    authErrors(),
  );

export const ApiListSchedulesDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'List a tour’s availability schedules' }),
    ApiOkResponse({ type: ScheduleResponseDto, isArray: true }),
    authErrors(),
  );

// ── Exceptions ───────────────────────────────────────────────────────────────
export const ApiCreateExceptionDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Create a date-specific availability exception' }),
    ApiOkResponse({ type: ExceptionResponseDto }),
    authErrors(),
  );

export const ApiUpdateExceptionDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Update an availability exception' }),
    ApiOkResponse({ type: ExceptionResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    authErrors(),
  );

export const ApiDeleteExceptionDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Delete an availability exception' }),
    ApiOkResponse({ description: 'Deleted.' }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    authErrors(),
  );

export const ApiListExceptionsDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'List a tour’s availability exceptions' }),
    ApiOkResponse({ type: ExceptionResponseDto, isArray: true }),
    authErrors(),
  );

// ── Materialization ──────────────────────────────────────────────────────────
export const ApiMaterializeDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Materialize schedules + exceptions into departures',
      description:
        'Idempotent. Preserves booked seats and manually-edited departures; prunes orphans.',
    }),
    ApiOkResponse({ type: MaterializeResultDto }),
    authErrors(),
  );

// ── Departures ───────────────────────────────────────────────────────────────
export const ApiListDeparturesDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'List a tour’s materialized departures (operator view)' }),
    ApiOkResponse({ type: DepartureResponseDto, isArray: true }),
    authErrors(),
  );

export const ApiUpdateDepartureDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Manually edit a departure (capacity / status / price)',
      description: 'Sets manuallyEdited — protected from re-materialization.',
    }),
    ApiOkResponse({ type: DepartureResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    authErrors(),
  );

// ── Public availability ──────────────────────────────────────────────────────
export const ApiCheckAvailabilityDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Check live bookable departures for a date range' }),
    ApiOkResponse({ type: DepartureResponseDto, isArray: true }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
  );

export const ApiCalendarDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'Day-level availability calendar for a date range' }),
    ApiOkResponse({ type: CalendarDayResponseDto, isArray: true }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
  );
