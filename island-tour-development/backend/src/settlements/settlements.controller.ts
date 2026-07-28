import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@prisma/client';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import type { TypedAuthUser } from '@/auth/auth.types';
import { SettlementsService } from './settlements.service';
import { ListSettlementsQueryDto } from './dto/settlement.dto';
import {
  ApiListSettlementsDocs,
  ApiMarkSettlementPaidDocs,
  ApiMarkSettlementUnpaidDocs,
  ApiSettlementSummaryDocs,
} from './settlement.swagger';

/**
 * Operator-payout ledger surface (dashboard). Reads are gated on VIEW_PAYMENTS
 * (the service scopes a TOUR_OPERATOR to their own rows). The payout itself is
 * MANUAL in v1: an admin transfers the money by hand and confirms it via
 * mark-paid. Both ledger flips (mark-paid / mark-unpaid) are MANAGE_PAYMENTS,
 * which is admin-only (excluded from the platform-staff ceiling) - the
 * access-roles matrix keeps operators strictly view-own on settlements.
 */
@ApiTags('settlements')
@Controller('settlements')
export class SettlementsController {
  constructor(private readonly settlements: SettlementsService) {}

  // Static route declared before the plain list (NestJS matches top-to-bottom).
  @Get('summary')
  @RequirePermissions(
    Permission.VIEW_PAYMENTS,
    Permission.VIEW_BOOKING_FINANCIALS,
  )
  @ApiSettlementSummaryDocs()
  summary(@AuthenticatedUser() user: TypedAuthUser) {
    return this.settlements.summary({ id: user.id, role: user.role });
  }

  @Get()
  @RequirePermissions(
    Permission.VIEW_PAYMENTS,
    Permission.VIEW_BOOKING_FINANCIALS,
  )
  @ApiListSettlementsDocs()
  list(
    @AuthenticatedUser() user: TypedAuthUser,
    @Query() query: ListSettlementsQueryDto,
  ) {
    return this.settlements.list(query, { id: user.id, role: user.role });
  }

  @Patch(':id/mark-paid')
  @RequirePermissions(Permission.MANAGE_PAYMENTS)
  @ApiMarkSettlementPaidDocs()
  markPaid(@AuthenticatedUser() user: TypedAuthUser, @Param('id') id: string) {
    return this.settlements.markPaidOut(id, user.id);
  }

  @Patch(':id/mark-unpaid')
  @RequirePermissions(Permission.MANAGE_PAYMENTS)
  @ApiMarkSettlementUnpaidDocs()
  markUnpaid(
    @AuthenticatedUser() user: TypedAuthUser,
    @Param('id') id: string,
  ) {
    return this.settlements.markUnpaid(id, user.id);
  }
}
