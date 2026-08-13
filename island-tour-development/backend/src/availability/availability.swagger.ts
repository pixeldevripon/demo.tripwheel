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
  AgendaResponseDto,
  AvailabilityOverviewResponseDto,
  AvailabilitySummaryDto,
  AvailabilityBatchResponseDto,
  CalendarDayResponseDto,
  CloseAgendaDayResultDto,
  CloseRangeResultDto,
  ConfirmAvailabilityResultDto,
  ReopenRangeResultDto,
  DepartureResponseDto,
  ExceptionResponseDto,
  ManageCalendarDayDto,
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
    ApiOperation({
      summary: 'Undo an availability exception',
      description:
        'A reopen for the close types, a removal for add_slot / ' +
        'set_capacity. The row is RETIRED, not deleted: it stops being in ' +
        'force but stays in the Date changes register with who undid it and ' +
        'when (dev spec §6.5 - reopens are audited too). Idempotent.',
    }),
    ApiOkResponse({ description: 'Retired (no longer in force).' }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    authErrors(),
  );

export const ApiListExceptionsDocs = () =>
  applyDecorators(
    ApiOperation({ summary: 'List a tour’s availability exceptions' }),
    ApiOkResponse({ type: ExceptionResponseDto, isArray: true }),
    authErrors(),
  );

export const ApiManageCalendarDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Operator month grid (one-tap availability calendar)',
      description:
        'Every day of the requested month with a derived state ' +
        '(open / partial / closed / no_service), the full departures (exact ' +
        'booked counts - management view), the day’s exceptions, and whether ' +
        'the weekly pattern covers the date. Closing a day from the grid is ' +
        'the ordinary POST /availability/exceptions CLOSE_DATE write; ' +
        'reopening retires that exception (DELETE exceptions/:id).',
    }),
    ApiOkResponse({ type: ManageCalendarDayDto, isArray: true }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    authErrors(),
  );

export const ApiAgendaDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Cross-tour daily agenda (Surface B)',
      description:
        'Every departure across the caller´s tours for [from, from+days), ' +
        'chronological, with live status, the stopping closure (id + audit ' +
        'line) and the freshness stamp. The daily habit surface - one ' +
        'operator, all tours, one list.',
    }),
    ApiOkResponse({ type: AgendaResponseDto }),
    authErrors(),
  );

export const ApiOverviewDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Global calendar overview (admin + operator)',
      description:
        'Every departure across the scoped tours for [from, from+days), ' +
        'day-bucketed, with live status, stopping closures and the tour ' +
        'metadata the calendar´s add-schedule popover needs (startTimes, ' +
        'maxPartySize). Operators are pinned to their own tours; ADMIN reads ' +
        'platform-wide with optional operatorId/tourId narrowing.',
    }),
    ApiOkResponse({ type: AvailabilityOverviewResponseDto }),
    authErrors(),
  );

export const ApiCloseAgendaDayDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Close all of a day across the operator´s tours',
      description:
        'The weather-day action: one CLOSE_DATE per tour with departures on ' +
        'the date (already-closed tours skipped; optional tourId scopes to ' +
        'one tour). Stops new sales only. Returns the affected tourIds - the ' +
        'Undo reopens exactly those.',
    }),
    ApiOkResponse({ type: CloseAgendaDayResultDto }),
    authErrors(),
  );

export const ApiConfirmAvailabilityDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Stamp availability_confirmed_at (freshness confirm)',
      description:
        'One tour with tourId, or every tour of the caller´s operator ' +
        'without - the daily agenda´s "Confirm today´s availability" and the ' +
        'stamp-on-visit hook (dev spec §6.4). Feeds the freshness nudges.',
    }),
    ApiOkResponse({ type: ConfirmAvailabilityResultDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    authErrors(),
  );

export const ApiCloseRangeDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Close a date range (bulk blackout)',
      description:
        'One CLOSE_DATE per date in [from, to] - for one tour (tourId), or ' +
        'for EVERY active tour of the operator when tourId is omitted (the ' +
        'weather-day scope; admins must pass operatorId instead). One ' +
        'transaction, one closureBatchId, skipping dates already closed. ' +
        'Stops new sales only - existing bookings are kept. Undo with POST ' +
        'exceptions/reopen-range over the same bounds.',
    }),
    ApiOkResponse({ type: CloseRangeResultDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    authErrors(),
  );

export const ApiReopenRangeDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Reopen a date range',
      description:
        'Retires every whole-day closure in [from, to] - the one-unit Undo ' +
        'of close-range (also reopens individually closed days in the ' +
        'range). Scoped like close-range: one tour with tourId, or every ' +
        'active tour of the operator without (admins pass operatorId). ' +
        'Retired closures stay in the Date changes register.',
    }),
    ApiOkResponse({ type: ReopenRangeResultDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    authErrors(),
  );

export const ApiAvailabilitySummaryDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Operator status line: is this tour selling?',
      description:
        'The soonest bookable departure and the count of bookable departures ' +
        'in the next 30 days - the same horizon as the §7.2 listing gate. ' +
        '0 = the tour is excluded from every ranked surface (F13 warning ' +
        'state) until a date opens.',
    }),
    ApiOkResponse({ type: AvailabilitySummaryDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
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
    ApiOperation({
      summary: 'List a tour’s materialized departures (operator view)',
    }),
    ApiOkResponse({ type: DepartureResponseDto, isArray: true }),
    authErrors(),
  );

export const ApiUpdateDepartureDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Manually edit a departure (capacity / status / price)',
      description: 'Sets manuallyEdited - protected from re-materialization.',
    }),
    ApiOkResponse({ type: DepartureResponseDto }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    authErrors(),
  );

// ── Public availability ──────────────────────────────────────────────────────
export const ApiCheckAvailabilityDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Check live bookable departures for a date range',
    }),
    ApiOkResponse({ type: DepartureResponseDto, isArray: true }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
  );

export const ApiCalendarDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Day-level availability calendar for a date range',
    }),
    ApiOkResponse({ type: CalendarDayResponseDto, isArray: true }),
    ApiNotFoundResponse({ type: NotFoundErrorDto }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
  );

export const ApiCheckBatchDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Bookability of many tours on one date',
      description:
        'Answers "can I book each of these on this day, for this many people?" in a single call - the saved tours page date check. Unknown tour ids come back as unavailable rather than as an error, so one stale saved id never fails the whole list.',
    }),
    ApiOkResponse({ type: AvailabilityBatchResponseDto }),
    ApiBadRequestResponse({ type: BadRequestErrorDto }),
  );
