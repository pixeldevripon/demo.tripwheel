import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import type { TypedAuthUser } from '@/auth/auth.types';
import { OctoExceptionFilter } from '@/octo/common/octo-error';
import {
  CreateNotificationSubscriptionDto,
  ListDeliveriesQueryDto,
  UpdateNotificationSubscriptionDto,
} from './dto/notification.dto';
import { NotificationsService } from './notifications.service';
import {
  ApiCreateSubscriptionDocs,
  ApiDeleteSubscriptionDocs,
  ApiGetSubscriptionDocs,
  ApiListDeliveriesDocs,
  ApiListSubscriptionsDocs,
  ApiNotificationsTag,
  ApiUpdateSubscriptionDocs,
} from './notifications.swagger';

/**
 * OCTO `octo/notifications` capability — webhook subscription CRUD (spec §5.4).
 *
 * Authenticated (session cookie) for v1; bearer for external OTAs is layered later (D1).
 * Operators manage their own subscriptions; admins manage platform-level ones. The OCTO
 * flat error envelope is scoped here via `@UseFilters` so the native surface is untouched.
 */
@ApiNotificationsTag()
@UseFilters(OctoExceptionFilter)
@Controller('octo/notifications/subscriptions')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post()
  @ApiCreateSubscriptionDocs()
  create(
    @Body() dto: CreateNotificationSubscriptionDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.notifications.create(dto, { id: user.id, role: user.role });
  }

  @Get()
  @ApiListSubscriptionsDocs()
  list(@AuthenticatedUser() user: TypedAuthUser) {
    return this.notifications.list({ id: user.id, role: user.role });
  }

  @Get(':id/deliveries')
  @ApiListDeliveriesDocs()
  listDeliveries(
    @Param('id') id: string,
    @Query() query: ListDeliveriesQueryDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.notifications.listDeliveries(id, query, {
      id: user.id,
      role: user.role,
    });
  }

  @Get(':id')
  @ApiGetSubscriptionDocs()
  getById(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.notifications.getById(id, { id: user.id, role: user.role });
  }

  @Patch(':id')
  @ApiUpdateSubscriptionDocs()
  update(
    @Param('id') id: string,
    @Body() dto: UpdateNotificationSubscriptionDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.notifications.update(id, dto, { id: user.id, role: user.role });
  }

  @Delete(':id')
  @ApiDeleteSubscriptionDocs()
  remove(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.notifications.remove(id, { id: user.id, role: user.role });
  }
}
