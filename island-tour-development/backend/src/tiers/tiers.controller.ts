import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@prisma/client';
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import type { TypedAuthUser } from '@/auth/auth.types';
import { TiersService } from './tiers.service';
import {
  ApproveSpotlightDto,
  ChangeTierDto,
  CreateSpotlightRequestDto,
  RejectSpotlightDto,
  SpotlightQueueQueryDto,
} from './dto/tiers.dto';
import {
  ApiApproveSpotlightDocs,
  ApiChangeTierDocs,
  ApiGetTourSpotlightDocs,
  ApiListSpotlightQueueDocs,
  ApiRejectSpotlightDocs,
  ApiRequestSpotlightDocs,
} from './tiers.swagger';

/**
 * TiersController — commission-tier + Destination Spotlight commercial engine.
 *
 * ## Access
 * - Operator routes (`/tours/:tourId/...`) require `EDIT_TRIP`; the service scopes every
 *   write to the tour's owning operator (ADMIN bypasses ownership).
 * - Admin routes (`/admin/spotlight/...`) require `APPROVE_SPOTLIGHT`.
 *
 * Static `/admin/...` routes are declared before the dynamic `/tours/:tourId/...` routes.
 */
@ApiTags('Tiers & Spotlight')
@Controller('tiers')
export class TiersController {
  constructor(private readonly tiers: TiersService) {}

  // ── Spotlight admin (static) ────────────────────────────────────────────────

  @Get('admin/spotlight')
  @RequirePermissions(Permission.APPROVE_SPOTLIGHT)
  @ApiListSpotlightQueueDocs()
  listQueue(@Query() query: SpotlightQueueQueryDto) {
    return this.tiers.listSpotlightQueue(query);
  }

  @Patch('admin/spotlight/:id/approve')
  @RequirePermissions(Permission.APPROVE_SPOTLIGHT)
  @ApiApproveSpotlightDocs()
  approve(
    @AuthenticatedUser() user: TypedAuthUser,
    @Param('id') id: string,
    @Body() dto: ApproveSpotlightDto,
  ) {
    return this.tiers.approveSpotlight(user.id, id, dto);
  }

  @Patch('admin/spotlight/:id/reject')
  @RequirePermissions(Permission.APPROVE_SPOTLIGHT)
  @ApiRejectSpotlightDocs()
  reject(
    @AuthenticatedUser() user: TypedAuthUser,
    @Param('id') id: string,
    @Body() dto: RejectSpotlightDto,
  ) {
    return this.tiers.rejectSpotlight(user.id, id, dto);
  }

  // ── Spotlight + tier (operator, dynamic) ──────────────────────────────────────

  @Post('tours/:tourId/spotlight')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiRequestSpotlightDocs()
  requestSpotlight(
    @AuthenticatedUser() user: TypedAuthUser,
    @Param('tourId') tourId: string,
    @Body() dto: CreateSpotlightRequestDto,
  ) {
    return this.tiers.requestSpotlight(user.id, user.role, tourId, dto);
  }

  @Get('tours/:tourId/spotlight')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiGetTourSpotlightDocs()
  getTourSpotlight(
    @AuthenticatedUser() user: TypedAuthUser,
    @Param('tourId') tourId: string,
  ) {
    return this.tiers.getTourSpotlight(user.id, user.role, tourId);
  }

  @Patch('tours/:tourId/tier')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiChangeTierDocs()
  changeTier(
    @AuthenticatedUser() user: TypedAuthUser,
    @Param('tourId') tourId: string,
    @Body() dto: ChangeTierDto,
  ) {
    return this.tiers.changeTier(user.id, user.role, tourId, dto);
  }
}
