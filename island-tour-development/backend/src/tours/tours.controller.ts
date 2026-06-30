import type { AuthenticatedRequest, TypedAuthUser } from '@/auth/auth.types';
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import { Public } from '@/auth/decorators/public.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import {
  AdminToursQueryDto,
  CreateTourDto,
  MyToursQueryDto,
  TourBySlugQueryDto,
  TourQueryDto,
  UpdateTourDto,
} from './dto/tour.dto';
import {
  ApiAdminListToursDocs,
  ApiArchiveTourDocs,
  ApiCreateTourDocs,
  ApiDeleteTourDocs,
  ApiGetAllToursDocs,
  ApiGetMyToursDocs,
  ApiGetTourByIdDocs,
  ApiGetTourBySlugDocs,
  ApiPauseTourDocs,
  ApiPublishTourDocs,
  ApiRecomputeDemandDocs,
  ApiRestoreTourDocs,
  ApiUnpauseTourDocs,
  ApiUpdateTourDocs,
} from './tours.swagger';
import { ToursService } from './tours.service';

@ApiTags('Tours')
@Controller('tours')
/**
 * ToursController - manages the tour listing lifecycle.
 *
 * ## Route ordering
 * Static segments (my-tours) MUST appear before the dynamic :id segment.
 *
 * ## Access-Control
 * - GET /tours is @Public() - live listing for travelers and SSR.
 * - GET /tours/:id is semi-public - LIVE tours open, DRAFT/PAUSED require auth.
 * - All mutations use @RequirePermissions().
 */
export class ToursController {
  constructor(private readonly toursService: ToursService) {}

  // ── Public list ───────────────────────────────────────────────────────────────

  @Get()
  @Public()
  @ApiGetAllToursDocs()
  findAll(
    // Relaxed pipe: dynamic attribute params (e.g. ?boat_type=catamaran) are NOT in the DTO,
    // so we strip them from `query` without rejecting, and read them from the raw request query.
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: false,
      }),
    )
    query: TourQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.toursService.findAll(query, req.query);
  }

  // ── Public slug-based detail - static prefix before :id ──────────────────────

  @Get('slug/:slug')
  @Public()
  @ApiGetTourBySlugDocs()
  findBySlug(@Param('slug') slug: string, @Query() query: TourBySlugQueryDto) {
    return this.toursService.findBySlug(slug, query);
  }

  // ── Operator "my tours" - static route before :id ─────────────────────────────

  @Get('my-tours')
  @RequirePermissions(Permission.VIEW_TRIPS)
  @ApiGetMyToursDocs()
  findMyTours(
    @Query() query: MyToursQueryDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.toursService.findMyTours(user.id, user.role, query);
  }

  // ── Admin all tours - static route before :id ─────────────────────────────────

  @Get('admin/all')
  @RequirePermissions(Permission.MANAGE_TRIPS)
  @ApiAdminListToursDocs()
  findAllAdmin(@Query() query: AdminToursQueryDto) {
    return this.toursService.findAllAdmin(query);
  }

  /**
   * Recompute the §3.7 "Likely to sell out" demand signal. Production runs this on
   * a nightly schedule; this endpoint is the on-demand admin trigger. Omit `tourId`
   * to sweep every LIVE tour.
   */
  @Post('admin/recompute-demand')
  @RequirePermissions(Permission.MANAGE_TRIPS)
  @ApiRecomputeDemandDocs()
  recomputeDemand(@Query('tourId') tourId?: string) {
    return this.toursService.recomputeLikelyToSellOut(tourId);
  }

  // ── Create ────────────────────────────────────────────────────────────────────

  @Post()
  @RequirePermissions(Permission.CREATE_TRIP)
  @ApiCreateTourDocs()
  create(@Body() dto: CreateTourDto, @AuthenticatedUser() user: TypedAuthUser) {
    return this.toursService.create(dto, user.id, user.role);
  }

  // ── Single tour (semi-public) ─────────────────────────────────────────────────

  @Get(':id')
  @Public()
  @ApiGetTourByIdDocs()
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const requesterId = req.user?.id ?? null;
    const requesterRole = req.user?.role ?? null;
    return this.toursService.findOne(id, requesterId, requesterRole);
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  @Patch(':id')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiUpdateTourDocs()
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTourDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.toursService.update(id, dto, user.id, user.role);
  }

  // ── Lifecycle transitions ─────────────────────────────────────────────────────

  @Post(':id/publish')
  @RequirePermissions(Permission.MANAGE_TRIPS)
  @ApiPublishTourDocs()
  publish(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.toursService.publish(id, user.id, user.role);
  }

  @Post(':id/pause')
  @RequirePermissions(Permission.MANAGE_TRIPS)
  @ApiPauseTourDocs()
  pause(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.toursService.pause(id, user.id, user.role);
  }

  @Post(':id/unpause')
  @RequirePermissions(Permission.MANAGE_TRIPS)
  @ApiUnpauseTourDocs()
  unpause(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.toursService.unpause(id, user.id, user.role);
  }

  @Post(':id/archive')
  @RequirePermissions(Permission.MANAGE_TRIPS)
  @ApiArchiveTourDocs()
  archive(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.toursService.archive(id, user.id, user.role);
  }

  @Post(':id/restore')
  @RequirePermissions(Permission.MANAGE_TRIPS)
  @ApiRestoreTourDocs()
  restore(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.toursService.restore(id, user.id, user.role);
  }

  @Delete(':id')
  @RequirePermissions(Permission.DELETE_TRIP)
  @ApiDeleteTourDocs()
  remove(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.toursService.remove(id, user.id, user.role);
  }
}
