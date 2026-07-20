import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@prisma/client';

import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import type { TypedAuthUser } from '@/auth/auth.types';

import { AnalyticsService } from './analytics.service';
import { ApiDashboardStatsDocs } from './analytics.swagger';
import { DashboardStatsQueryDto } from './dto/analytics.dto';

/**
 * Read-only aggregates for the dashboard overview.
 *
 * VIEW_ANALYTICS gates WHO may see statistics at all; the service then scopes
 * WHICH rows feed them (operators to their own tours, platform roles to
 * everything) - the same split the bookings controller uses.
 */
@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('dashboard')
  @RequirePermissions(Permission.VIEW_ANALYTICS)
  @ApiDashboardStatsDocs()
  dashboard(
    @AuthenticatedUser() user: TypedAuthUser,
    @Query() query: DashboardStatsQueryDto,
  ) {
    return this.analytics.getDashboardStats(query, {
      id: user.id,
      role: user.role,
    });
  }
}
