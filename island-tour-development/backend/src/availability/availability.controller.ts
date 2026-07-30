import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@prisma/client';
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import { Public } from '@/auth/decorators/public.decorator';
import { RequireAnyPermission } from '@/auth/decorators/require-any-permission.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import type { TypedAuthUser } from '@/auth/auth.types';
import { AvailabilityService } from './availability.service';
import {
  AgendaQueryDto,
  AvailabilityCalendarDto,
  AvailabilityCheckDto,
  AvailabilitySummaryQueryDto,
  CloseAgendaDayDto,
  CloseRangeDto,
  ConfirmAvailabilityDto,
  CreateExceptionDto,
  CreateScheduleDto,
  ListDeparturesQueryDto,
  ListExceptionsQueryDto,
  ListSchedulesQueryDto,
  ManageCalendarQueryDto,
  MaterializeDto,
  ReopenRangeDto,
  UpdateDepartureDto,
  UpdateExceptionDto,
  UpdateScheduleDto,
} from './dto/availability.dto';
import {
  ApiAgendaDocs,
  ApiAvailabilitySummaryDocs,
  ApiCalendarDocs,
  ApiCloseAgendaDayDocs,
  ApiCheckAvailabilityDocs,
  ApiCloseRangeDocs,
  ApiConfirmAvailabilityDocs,
  ApiCreateExceptionDocs,
  ApiCreateScheduleDocs,
  ApiDeleteExceptionDocs,
  ApiDeleteScheduleDocs,
  ApiListDeparturesDocs,
  ApiListExceptionsDocs,
  ApiListSchedulesDocs,
  ApiManageCalendarDocs,
  ApiMaterializeDocs,
  ApiReopenRangeDocs,
  ApiUpdateDepartureDocs,
  ApiUpdateExceptionDocs,
  ApiUpdateScheduleDocs,
} from './availability.swagger';

/**
 * AvailabilityController - native availability surface (the inventory source of truth).
 *
 * ## Access
 * - Operator management (schedules / exceptions / departures / materialize) requires
 *   `MANAGE_AVAILABILITY`; the service scopes every write to the tour's operator.
 * - `POST check` / `POST calendar` are `@Public()` real-time reads for the frontend.
 *
 * OCTO's `POST /octo/availability` is a thin adapter layered on this service later.
 */
@ApiTags('Availability')
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  // ── Public real-time reads ──────────────────────────────────────────────────

  @Post('check')
  @Public()
  @ApiCheckAvailabilityDocs()
  check(@Body() dto: AvailabilityCheckDto) {
    return this.availability.checkAvailability(dto);
  }

  @Post('calendar')
  @Public()
  @ApiCalendarDocs()
  calendar(@Body() dto: AvailabilityCalendarDto) {
    return this.availability.calendar(dto);
  }

  // ── Daily agenda (Surface B - cross-tour) ───────────────────────────────────

  @Get('agenda')
  @RequireAnyPermission(Permission.MANAGE_AVAILABILITY, Permission.STOP_SELL)
  @ApiAgendaDocs()
  agenda(
    @AuthenticatedUser() user: TypedAuthUser,
    @Query() query: AgendaQueryDto,
  ) {
    return this.availability.agenda(user.id, user.role, query);
  }

  @Post('agenda/close-day')
  @RequireAnyPermission(Permission.MANAGE_AVAILABILITY, Permission.STOP_SELL)
  @ApiCloseAgendaDayDocs()
  closeAgendaDay(
    @AuthenticatedUser() user: TypedAuthUser,
    @Body() dto: CloseAgendaDayDto,
  ) {
    return this.availability.closeAgendaDay(user.id, user.role, dto);
  }

  // ── Operator status line ────────────────────────────────────────────────────

  @Get('summary')
  @RequireAnyPermission(Permission.MANAGE_AVAILABILITY, Permission.STOP_SELL)
  @ApiAvailabilitySummaryDocs()
  summary(
    @AuthenticatedUser() user: TypedAuthUser,
    @Query() query: AvailabilitySummaryQueryDto,
  ) {
    return this.availability.availabilitySummary(
      user.id,
      user.role,
      query.tourId,
    );
  }

  // ── Schedules ───────────────────────────────────────────────────────────────

  @Post('schedules')
  @RequirePermissions(Permission.MANAGE_AVAILABILITY)
  @ApiCreateScheduleDocs()
  createSchedule(
    @AuthenticatedUser() user: TypedAuthUser,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.availability.createSchedule(user.id, user.role, dto);
  }

  @Get('schedules')
  @RequirePermissions(Permission.MANAGE_AVAILABILITY)
  @ApiListSchedulesDocs()
  listSchedules(
    @AuthenticatedUser() user: TypedAuthUser,
    @Query() query: ListSchedulesQueryDto,
  ) {
    return this.availability.listSchedules(user.id, user.role, query.tourId);
  }

  @Patch('schedules/:id')
  @RequirePermissions(Permission.MANAGE_AVAILABILITY)
  @ApiUpdateScheduleDocs()
  updateSchedule(
    @AuthenticatedUser() user: TypedAuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.availability.updateSchedule(user.id, user.role, id, dto);
  }

  @Delete('schedules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.MANAGE_AVAILABILITY)
  @ApiDeleteScheduleDocs()
  deleteSchedule(
    @AuthenticatedUser() user: TypedAuthUser,
    @Param('id') id: string,
  ) {
    return this.availability.deleteSchedule(user.id, user.role, id);
  }

  // ── Exceptions ──────────────────────────────────────────────────────────────

  @Post('exceptions')
  @RequireAnyPermission(Permission.MANAGE_AVAILABILITY, Permission.STOP_SELL)
  @ApiCreateExceptionDocs()
  createException(
    @AuthenticatedUser() user: TypedAuthUser,
    @Body() dto: CreateExceptionDto,
  ) {
    return this.availability.createException(user.id, user.role, dto);
  }

  @Post('confirm')
  @RequireAnyPermission(Permission.MANAGE_AVAILABILITY, Permission.STOP_SELL)
  @ApiConfirmAvailabilityDocs()
  confirmAvailability(
    @AuthenticatedUser() user: TypedAuthUser,
    @Body() dto: ConfirmAvailabilityDto,
  ) {
    return this.availability.confirmAvailability(user.id, user.role, dto);
  }

  @Post('exceptions/close-range')
  @RequireAnyPermission(Permission.MANAGE_AVAILABILITY, Permission.STOP_SELL)
  @ApiCloseRangeDocs()
  closeRange(
    @AuthenticatedUser() user: TypedAuthUser,
    @Body() dto: CloseRangeDto,
  ) {
    return this.availability.closeRange(user.id, user.role, dto);
  }

  @Post('exceptions/reopen-range')
  @RequireAnyPermission(Permission.MANAGE_AVAILABILITY, Permission.STOP_SELL)
  @ApiReopenRangeDocs()
  reopenRange(
    @AuthenticatedUser() user: TypedAuthUser,
    @Body() dto: ReopenRangeDto,
  ) {
    return this.availability.reopenRange(user.id, user.role, dto);
  }

  @Get('exceptions')
  @RequireAnyPermission(Permission.MANAGE_AVAILABILITY, Permission.STOP_SELL)
  @ApiListExceptionsDocs()
  listExceptions(
    @AuthenticatedUser() user: TypedAuthUser,
    @Query() query: ListExceptionsQueryDto,
  ) {
    return this.availability.listExceptions(user.id, user.role, query);
  }

  @Patch('exceptions/:id')
  @RequirePermissions(Permission.MANAGE_AVAILABILITY)
  @ApiUpdateExceptionDocs()
  updateException(
    @AuthenticatedUser() user: TypedAuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateExceptionDto,
  ) {
    return this.availability.updateException(user.id, user.role, id, dto);
  }

  @Delete('exceptions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireAnyPermission(Permission.MANAGE_AVAILABILITY, Permission.STOP_SELL)
  @ApiDeleteExceptionDocs()
  deleteException(
    @AuthenticatedUser() user: TypedAuthUser,
    @Param('id') id: string,
  ) {
    return this.availability.deleteException(user.id, user.role, id);
  }

  // ── Management calendar ─────────────────────────────────────────────────────

  @Get('manage-calendar')
  @RequireAnyPermission(Permission.MANAGE_AVAILABILITY, Permission.STOP_SELL)
  @ApiManageCalendarDocs()
  manageCalendar(
    @AuthenticatedUser() user: TypedAuthUser,
    @Query() query: ManageCalendarQueryDto,
  ) {
    return this.availability.manageCalendar(user.id, user.role, query);
  }

  // ── Materialization ─────────────────────────────────────────────────────────

  @Post('materialize')
  @RequirePermissions(Permission.MANAGE_AVAILABILITY)
  @ApiMaterializeDocs()
  materialize(
    @AuthenticatedUser() user: TypedAuthUser,
    @Body() dto: MaterializeDto,
  ) {
    return this.availability.materialize(user.id, user.role, dto);
  }

  // ── Departures ──────────────────────────────────────────────────────────────

  @Get('departures')
  @RequirePermissions(Permission.MANAGE_AVAILABILITY)
  @ApiListDeparturesDocs()
  listDepartures(
    @AuthenticatedUser() user: TypedAuthUser,
    @Query() query: ListDeparturesQueryDto,
  ) {
    return this.availability.listDepartures(user.id, user.role, query);
  }

  @Patch('departures/:id')
  @RequirePermissions(Permission.MANAGE_AVAILABILITY)
  @ApiUpdateDepartureDocs()
  updateDeparture(
    @AuthenticatedUser() user: TypedAuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateDepartureDto,
  ) {
    return this.availability.updateDeparture(user.id, user.role, id, dto);
  }
}
