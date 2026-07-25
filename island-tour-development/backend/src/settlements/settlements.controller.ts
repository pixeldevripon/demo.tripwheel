import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@prisma/client';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import type { TypedAuthUser } from '@/auth/auth.types';
import { SettlementsService } from './settlements.service';
import { ListSettlementsQueryDto } from './dto/settlement.dto';
import {
  ApiListSettlementsDocs,
  ApiSettlementSummaryDocs,
} from './settlement.swagger';

/**
 * Settlements ledger read surface (dashboard). Money/commission-sensitive, so gated
 * on VIEW_PAYMENTS; the service scopes a TOUR_OPERATOR to their own rows. The payout
 * RELEASE runs on a schedule (WorkersModule cron -> `releaseEligiblePayouts`), not
 * over HTTP.
 */
@ApiTags('settlements')
@Controller('settlements')
export class SettlementsController {
  constructor(private readonly settlements: SettlementsService) {}

  // Static route declared before the plain list (NestJS matches top-to-bottom).
  @Get('summary')
  @RequirePermissions(Permission.VIEW_PAYMENTS)
  @ApiSettlementSummaryDocs()
  summary(@AuthenticatedUser() user: TypedAuthUser) {
    return this.settlements.summary({ id: user.id, role: user.role });
  }

  @Get()
  @RequirePermissions(Permission.VIEW_PAYMENTS)
  @ApiListSettlementsDocs()
  list(
    @AuthenticatedUser() user: TypedAuthUser,
    @Query() query: ListSettlementsQueryDto,
  ) {
    return this.settlements.list(query, { id: user.id, role: user.role });
  }
}
