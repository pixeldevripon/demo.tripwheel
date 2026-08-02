import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@prisma/client';
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import type { TypedAuthUser } from '@/auth/auth.types';
import { CalendarSyncService } from './calendar-sync.service';
import {
  CreateCalendarSubscriptionDto,
  DisconnectCalendarSubscriptionDto,
  ListSubscriptionsQueryDto,
  ListSyncLogsQueryDto,
  UpdateCalendarSubscriptionDto,
  ValidateFeedDto,
} from './dto/calendar-subscription.dto';
import {
  ApiCreateSubscriptionDocs,
  ApiDisconnectSubscriptionDocs,
  ApiGetSubscriptionDocs,
  ApiListSubscriptionsDocs,
  ApiListSyncLogsDocs,
  ApiSyncNowDocs,
  ApiUpdateSubscriptionDocs,
  ApiValidateFeedDocs,
} from './calendar-sync.swagger';

/**
 * CalendarSyncController - inbound calendar connections, one tour at a time.
 *
 * ## Access
 * Every route requires `MANAGE_AVAILABILITY` and the service additionally scopes
 * each one to a tour the caller's operator owns, so the permission decides WHO
 * may manage calendars and ownership decides WHICH.
 *
 * There is no public route here. Unlike the export side, nothing in this module
 * is reachable without a session: we are the one FETCHING, and a URL an operator
 * supplies is treated as hostile input all the way down (`safe-http.util.ts`).
 */
@ApiTags('Calendar Sync')
@Controller('calendar-subscriptions')
export class CalendarSyncController {
  constructor(private readonly sync: CalendarSyncService) {}

  // Static routes before dynamic ones - Nest matches top to bottom, so
  // `validate` would otherwise be swallowed by `:id`.
  @Post('validate')
  @RequirePermissions(Permission.MANAGE_AVAILABILITY)
  @ApiValidateFeedDocs()
  validate(
    @AuthenticatedUser() user: TypedAuthUser,
    @Body() dto: ValidateFeedDto,
  ) {
    return this.sync.validate({ id: user.id, role: user.role }, dto);
  }

  @Get()
  @RequirePermissions(Permission.MANAGE_AVAILABILITY)
  @ApiListSubscriptionsDocs()
  list(
    @AuthenticatedUser() user: TypedAuthUser,
    @Query() query: ListSubscriptionsQueryDto,
  ) {
    return this.sync.list({ id: user.id, role: user.role }, query);
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_AVAILABILITY)
  @ApiCreateSubscriptionDocs()
  create(
    @AuthenticatedUser() user: TypedAuthUser,
    @Body() dto: CreateCalendarSubscriptionDto,
  ) {
    return this.sync.create({ id: user.id, role: user.role }, dto);
  }

  @Get(':id')
  @RequirePermissions(Permission.MANAGE_AVAILABILITY)
  @ApiGetSubscriptionDocs()
  getById(@AuthenticatedUser() user: TypedAuthUser, @Param('id') id: string) {
    return this.sync.getById({ id: user.id, role: user.role }, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.MANAGE_AVAILABILITY)
  @ApiUpdateSubscriptionDocs()
  update(
    @AuthenticatedUser() user: TypedAuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCalendarSubscriptionDto,
  ) {
    return this.sync.update({ id: user.id, role: user.role }, id, dto);
  }

  @Get(':id/sync-logs')
  @RequirePermissions(Permission.MANAGE_AVAILABILITY)
  @ApiListSyncLogsDocs()
  syncLogs(
    @AuthenticatedUser() user: TypedAuthUser,
    @Param('id') id: string,
    @Query() query: ListSyncLogsQueryDto,
  ) {
    return this.sync.listSyncLogs({ id: user.id, role: user.role }, id, query);
  }

  @Post(':id/sync')
  @RequirePermissions(Permission.MANAGE_AVAILABILITY)
  @ApiSyncNowDocs()
  syncNow(@AuthenticatedUser() user: TypedAuthUser, @Param('id') id: string) {
    return this.sync.syncNow({ id: user.id, role: user.role }, id);
  }

  /**
   * Returns 200 with a body rather than 204: the operator needs to be told how
   * many dates were released or kept, and a no-content response cannot say.
   */
  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_AVAILABILITY)
  @ApiDisconnectSubscriptionDocs()
  disconnect(
    @AuthenticatedUser() user: TypedAuthUser,
    @Param('id') id: string,
    @Body() dto: DisconnectCalendarSubscriptionDto,
  ) {
    return this.sync.disconnect(
      { id: user.id, role: user.role },
      id,
      dto.releaseDates ?? false,
    );
  }
}
