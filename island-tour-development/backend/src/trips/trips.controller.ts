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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission, Role } from '@prisma/client';
import { CreateTripDto, MyTripsQueryDto, TripBySlugQueryDto, TripQueryDto, UpdateTripDto } from './dto/trip.dto';
import {
  ApiArchiveTripDocs,
  ApiCreateTripDocs,
  ApiDeleteTripDocs,
  ApiGetAllTripsDocs,
  ApiGetMyTripsDocs,
  ApiGetTripByIdDocs,
  ApiGetTripBySlugDocs,
  ApiPauseTripDocs,
  ApiPublishTripDocs,
  ApiUnpauseTripDocs,
  ApiUpdateTripDocs,
} from './trips.swagger';
import { TripsService } from './trips.service';

@ApiTags('Trips')
@Controller('trips')
/**
 * TripsController — manages the trip listing lifecycle.
 *
 * ## Route ordering
 * Static segments (my-trips) MUST appear before the dynamic :id segment.
 *
 * ## Access-Control
 * - GET /trips is @Public() — live listing for travelers and SSR.
 * - GET /trips/:id is semi-public — LIVE trips open, DRAFT/PAUSED require auth.
 * - All mutations use @RequirePermissions().
 */
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  // ── Public list ───────────────────────────────────────────────────────────────

  @Get()
  @Public()
  @ApiGetAllTripsDocs()
  findAll(@Query() query: TripQueryDto) {
    return this.tripsService.findAll(query);
  }

  // ── Public slug-based detail — static prefix before :id ──────────────────────

  @Get('slug/:slug')
  @Public()
  @ApiGetTripBySlugDocs()
  findBySlug(@Param('slug') slug: string, @Query() query: TripBySlugQueryDto) {
    return this.tripsService.findBySlug(slug, query);
  }

  // ── Operator "my trips" — static route before :id ─────────────────────────────

  @Get('my-trips')
  @RequirePermissions(Permission.VIEW_TRIPS)
  @ApiGetMyTripsDocs()
  findMyTrips(@Query() query: MyTripsQueryDto, @AuthenticatedUser() user: TypedAuthUser) {
    return this.tripsService.findMyTrips(user.id, user.role, query);
  }

  // ── Create ────────────────────────────────────────────────────────────────────

  @Post()
  @RequirePermissions(Permission.CREATE_TRIP)
  @ApiCreateTripDocs()
  create(@Body() dto: CreateTripDto, @AuthenticatedUser() user: TypedAuthUser) {
    return this.tripsService.create(dto, user.id, user.role);
  }

  // ── Single trip (semi-public) ─────────────────────────────────────────────────

  @Get(':id')
  @Public()
  @ApiGetTripByIdDocs()
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const requesterId = req.user?.id ?? null;
    const requesterRole = (req.user?.role ?? null) as Role | null;
    return this.tripsService.findOne(id, requesterId, requesterRole);
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  @Patch(':id')
  @RequirePermissions(Permission.EDIT_TRIP)
  @ApiUpdateTripDocs()
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTripDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.tripsService.update(id, dto, user.id, user.role);
  }

  // ── Lifecycle transitions ─────────────────────────────────────────────────────

  @Post(':id/publish')
  @RequirePermissions(Permission.MANAGE_TRIPS)
  @ApiPublishTripDocs()
  publish(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.tripsService.publish(id, user.id, user.role);
  }

  @Post(':id/pause')
  @RequirePermissions(Permission.MANAGE_TRIPS)
  @ApiPauseTripDocs()
  pause(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.tripsService.pause(id, user.id, user.role);
  }

  @Post(':id/unpause')
  @RequirePermissions(Permission.MANAGE_TRIPS)
  @ApiUnpauseTripDocs()
  unpause(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.tripsService.unpause(id, user.id, user.role);
  }

  @Post(':id/archive')
  @RequirePermissions(Permission.MANAGE_TRIPS)
  @ApiArchiveTripDocs()
  archive(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.tripsService.archive(id, user.id, user.role);
  }

  @Delete(':id')
  @RequirePermissions(Permission.DELETE_TRIP)
  @ApiDeleteTripDocs()
  remove(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.tripsService.remove(id, user.id, user.role);
  }
}
