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
import { Currency, Permission, Role } from '@prisma/client';
import {
  AdminToursQueryDto,
  ApproveTourDto,
  CreateTourDto,
  MyToursQueryDto,
  PendingChangesQueryDto,
  SetLocalsFavouriteDto,
  TourAlternativesQueryDto,
  TourBySlugQueryDto,
  RejectTourDto,
  TourQueryDto,
  UpdateTourDto,
} from './dto/tour.dto';
import {
  ApiAdminListToursDocs,
  ApiArchiveTourDocs,
  ApiCreateTourDocs,
  ApiDeleteTourDocs,
  ApiGetAllToursDocs,
  ApiGetLocalsFavouriteStatsDocs,
  ApiGetMyToursDocs,
  ApiGetTourAlternativesDocs,
  ApiGetTourByIdDocs,
  ApiGetTourBySlugDocs,
  ApiPauseTourDocs,
  ApiApproveTourDocs,
  ApiApprovePendingChangesDocs,
  ApiGetTourPendingChangeDocs,
  ApiListPendingChangesDocs,
  ApiPublishTourDocs,
  ApiRejectPendingChangesDocs,
  ApiRejectTourDocs,
  ApiSubmitTourForReviewDocs,
  ApiRecomputeDemandDocs,
  ApiRestoreTourDocs,
  ApiSetLocalsFavouriteDocs,
  ApiUnpauseTourDocs,
  ApiUpdateTourDocs,
} from './tours.swagger';
import { ToursService } from './tours.service';
import { TourPendingChangesService } from './tour-pending-changes.service';

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
  constructor(
    private readonly toursService: ToursService,
    private readonly pendingChangesService: TourPendingChangesService,
  ) {}

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

  // ── All-sold-out dead-end alternatives (public) ───────────────────────────────

  /**
   * AVAILABILITY-AND-DEPARTURES.md §8: what the booking widget shows instead of a
   * blank calendar when the tour has no open departure in the next 30 days. Up to
   * 3 same-destination tours that still have room within 7 days.
   */
  @Get(':id/alternatives')
  @Public()
  @ApiGetTourAlternativesDocs()
  findAlternatives(
    @Param('id') id: string,
    @Query() query: TourAlternativesQueryDto,
  ) {
    return this.toursService.findDeadEndAlternatives(id, query);
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

  // ── Live-tour content changes (client review #19) - static before :id ─────────

  @Get('admin/pending-changes')
  @RequirePermissions(Permission.MANAGE_TRIPS)
  @ApiListPendingChangesDocs()
  listPendingChanges(@Query() query: PendingChangesQueryDto) {
    return this.pendingChangesService.listOpen(query.page, query.limit);
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

  // ── Editorial: Locals' favourite (admin-only; static route before :id) ─────────

  @Get('admin/locals-favourite/stats')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiGetLocalsFavouriteStatsDocs()
  localsFavouriteStats() {
    return this.toursService.getLocalsFavouriteStats();
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
  findOne(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Query('currency') currency?: Currency,
  ) {
    const requesterId = req.user?.id ?? null;
    const requesterRole = req.user?.role ?? null;
    return this.toursService.findOne(id, requesterId, requesterRole, currency);
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
  // Conflict #1 (access-roles matrix): publishing is always Island Tours'.
  // UPWARD transitions (publish / unpause / restore) stay MANAGE_TRIPS =
  // platform-only. DOWNWARD transitions (pause / archive) are EDIT_TRIP -
  // taking a tour offline is always safe, and the service pins operators to
  // their own tours. Operators enter the pipeline via submit-for-review.

  @Post(':id/submit-for-review')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiSubmitTourForReviewDocs()
  submitForReview(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.toursService.submitForReview(id, user.id, user.role);
  }

  @Post(':id/approve')
  @RequirePermissions(Permission.MANAGE_TRIPS)
  @ApiApproveTourDocs()
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveTourDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.toursService.approveTour(id, user.id, dto.note);
  }

  @Post(':id/reject')
  @RequirePermissions(Permission.MANAGE_TRIPS)
  @ApiRejectTourDocs()
  reject(
    @Param('id') id: string,
    @Body() dto: RejectTourDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.toursService.rejectTour(id, user.id, dto.note);
  }

  @Get(':id/pending-changes')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiGetTourPendingChangeDocs()
  getPendingChange(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.toursService.getPendingChangeForTour(id, user.id, user.role);
  }

  @Post(':id/pending-changes/approve')
  @RequirePermissions(Permission.MANAGE_TRIPS)
  @ApiApprovePendingChangesDocs()
  approvePendingChanges(
    @Param('id') id: string,
    @Body() dto: ApproveTourDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.pendingChangesService.approve(id, user.id, dto.note);
  }

  @Post(':id/pending-changes/reject')
  @RequirePermissions(Permission.MANAGE_TRIPS)
  @ApiRejectPendingChangesDocs()
  rejectPendingChanges(
    @Param('id') id: string,
    @Body() dto: RejectTourDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.pendingChangesService.reject(id, user.id, dto.note);
  }

  @Post(':id/publish')
  @RequirePermissions(Permission.MANAGE_TRIPS)
  @ApiPublishTourDocs()
  publish(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.toursService.publish(id, user.id, user.role);
  }

  @Post(':id/pause')
  @RequirePermissions(Permission.EDIT_TRIP)
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
  @RequirePermissions(Permission.EDIT_TRIP)
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

  // ── Editorial: Locals' favourite toggle (admin-only) ──────────────────────────

  @Patch(':id/locals-favourite')
  @RequirePermissions(Permission.MANAGE_EDITORIAL)
  @ApiSetLocalsFavouriteDocs()
  setLocalsFavourite(
    @Param('id') id: string,
    @Body() dto: SetLocalsFavouriteDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.toursService.setLocalsFavourite(id, dto.value, user.id);
  }
}
