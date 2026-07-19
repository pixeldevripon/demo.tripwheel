import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import type { TypedAuthUser } from '@/auth/auth.types';
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
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Permission } from '@prisma/client';
import {
  CatalogQueryDto,
  CreateDesignationDto,
  CreateTeamDesignationDto,
  InviteStaffDto,
  InviteTeamMemberDto,
  StaffQueryDto,
  TeamQueryDto,
  TeamScopeQueryDto,
  UpdateDesignationDto,
  UpdateStaffDto,
  UpdateStaffStatusDto,
  UpdateTeamDesignationDto,
  UpdateTeamMemberDto,
  UpdateTeamMemberStatusDto,
} from './dto/staff.dto';
import { StaffService } from './staff.service';
import {
  ApiCreateDesignationDocs,
  ApiDeleteDesignationDocs,
  ApiDeleteStaffDocs,
  ApiDeleteTeamMemberDocs,
  ApiGetPermissionCatalogDocs,
  ApiGetStaffDocs,
  ApiGetTeamMemberDocs,
  ApiInviteStaffDocs,
  ApiInviteTeamMemberDocs,
  ApiListDesignationsDocs,
  ApiListStaffDocs,
  ApiListTeamDocs,
  ApiResendStaffInviteDocs,
  ApiResendTeamInviteDocs,
  ApiUpdateDesignationDocs,
  ApiUpdateStaffDocs,
  ApiUpdateStaffStatusDocs,
  ApiUpdateTeamMemberDocs,
  ApiUpdateTeamMemberStatusDocs,
} from './staff.swagger';

/**
 * Staff & Teams management.
 *
 * Route order matters (NestJS matches top-to-bottom): every static segment
 * (`permission-catalog`, `designations`, `team`, `invite`) is declared BEFORE
 * the dynamic `:id` routes of its section.
 *
 * Authorization model:
 * - Platform staff + platform designations: `MANAGE_STAFF` - outside every
 *   grant ceiling, so effectively ADMIN-only.
 * - Team seats + team designations: `MANAGE_TEAM` - held by operator owners
 *   (full role set) and admins; never grantable to seats. The service pins
 *   every call to the caller's own operator (admins pass an explicit
 *   operatorId).
 */
@ApiTags('Staff')
@ApiCookieAuth()
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  // ── Permission catalog ─────────────────────────────────────────────────────

  // VIEW_PERMISSIONS keeps travelers (and staff not granted it) from
  // enumerating the RBAC shape; admins and operator owners hold it via their
  // role sets, which is exactly who opens the matrix UI.
  @Get('permission-catalog')
  @RequirePermissions(Permission.VIEW_PERMISSIONS)
  @ApiGetPermissionCatalogDocs()
  getPermissionCatalog(@Query() query: CatalogQueryDto) {
    return this.staffService.getPermissionCatalog(query.scope ?? 'platform');
  }

  // ── Platform designations (admin) ──────────────────────────────────────────

  @Get('designations')
  @RequirePermissions(Permission.MANAGE_STAFF)
  @ApiListDesignationsDocs('platform')
  listPlatformDesignations() {
    return this.staffService.listPlatformDesignations();
  }

  @Post('designations')
  @RequirePermissions(Permission.MANAGE_STAFF)
  @ApiCreateDesignationDocs('platform')
  createPlatformDesignation(
    @Body() dto: CreateDesignationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.staffService.createPlatformDesignation(dto, user);
  }

  @Patch('designations/:id')
  @RequirePermissions(Permission.MANAGE_STAFF)
  @ApiUpdateDesignationDocs()
  updatePlatformDesignation(
    @Param('id') id: string,
    @Body() dto: UpdateDesignationDto,
  ) {
    return this.staffService.updatePlatformDesignation(id, dto);
  }

  @Delete('designations/:id')
  @RequirePermissions(Permission.MANAGE_STAFF)
  @ApiDeleteDesignationDocs()
  deletePlatformDesignation(@Param('id') id: string) {
    return this.staffService.deletePlatformDesignation(id);
  }

  // ── Team designations (owner / admin) ──────────────────────────────────────

  @Get('team/designations')
  @RequirePermissions(Permission.MANAGE_TEAM)
  @ApiListDesignationsDocs('team')
  listTeamDesignations(
    @AuthenticatedUser() user: TypedAuthUser,
    @Query() query: TeamScopeQueryDto,
  ) {
    return this.staffService.listTeamDesignations(user, query.operatorId);
  }

  @Post('team/designations')
  @RequirePermissions(Permission.MANAGE_TEAM)
  @ApiCreateDesignationDocs('team')
  createTeamDesignation(
    @Body() dto: CreateTeamDesignationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.staffService.createTeamDesignation(dto, user, dto.operatorId);
  }

  @Patch('team/designations/:id')
  @RequirePermissions(Permission.MANAGE_TEAM)
  @ApiUpdateDesignationDocs()
  updateTeamDesignation(
    @Param('id') id: string,
    @Body() dto: UpdateTeamDesignationDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.staffService.updateTeamDesignation(
      id,
      dto,
      user,
      dto.operatorId,
    );
  }

  @Delete('team/designations/:id')
  @RequirePermissions(Permission.MANAGE_TEAM)
  @ApiDeleteDesignationDocs()
  deleteTeamDesignation(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
    @Query() query: TeamScopeQueryDto,
  ) {
    return this.staffService.deleteTeamDesignation(id, user, query.operatorId);
  }

  // ── Team seats (owner / admin) ─────────────────────────────────────────────

  @Get('team')
  @RequirePermissions(Permission.MANAGE_TEAM)
  @ApiListTeamDocs()
  listTeam(
    @Query() query: TeamQueryDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.staffService.listTeam(query, user, query.operatorId);
  }

  @Post('team/invite')
  @RequirePermissions(Permission.MANAGE_TEAM)
  @ApiInviteTeamMemberDocs()
  inviteTeamMember(
    @Body() dto: InviteTeamMemberDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.staffService.inviteTeamMember(dto, user);
  }

  @Patch('team/:id/status')
  @RequirePermissions(Permission.MANAGE_TEAM)
  @ApiUpdateTeamMemberStatusDocs()
  updateTeamMemberStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTeamMemberStatusDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.staffService.updateTeamMemberStatus(
      id,
      dto,
      user,
      dto.operatorId,
    );
  }

  // Human-pace cap: each resend fires a real email, and the server-initiated
  // reset path bypasses Better Auth's own per-route limiter.
  @Throttle({
    short: { limit: 1, ttl: 10_000 },
    medium: { limit: 3, ttl: 60_000 },
    long: { limit: 10, ttl: 3_600_000 },
  })
  @Post('team/:id/resend-invite')
  @RequirePermissions(Permission.MANAGE_TEAM)
  @ApiResendTeamInviteDocs()
  resendTeamInvite(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
    @Query() query: TeamScopeQueryDto,
  ) {
    return this.staffService.resendTeamInvite(id, user, query.operatorId);
  }

  @Get('team/:id')
  @RequirePermissions(Permission.MANAGE_TEAM)
  @ApiGetTeamMemberDocs()
  getTeamMember(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
    @Query() query: TeamScopeQueryDto,
  ) {
    return this.staffService.getTeamMember(id, user, query.operatorId);
  }

  @Patch('team/:id')
  @RequirePermissions(Permission.MANAGE_TEAM)
  @ApiUpdateTeamMemberDocs()
  updateTeamMember(
    @Param('id') id: string,
    @Body() dto: UpdateTeamMemberDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.staffService.updateTeamMember(id, dto, user);
  }

  @Delete('team/:id')
  @RequirePermissions(Permission.MANAGE_TEAM)
  @ApiDeleteTeamMemberDocs()
  removeTeamMember(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
    @Query() query: TeamScopeQueryDto,
  ) {
    return this.staffService.removeTeamMember(id, user, query.operatorId);
  }

  // ── Platform staff (admin) ─────────────────────────────────────────────────

  @Get()
  @RequirePermissions(Permission.MANAGE_STAFF)
  @ApiListStaffDocs()
  listPlatformStaff(@Query() query: StaffQueryDto) {
    return this.staffService.listPlatformStaff(query);
  }

  @Post('invite')
  @RequirePermissions(Permission.MANAGE_STAFF)
  @ApiInviteStaffDocs()
  invitePlatformStaff(
    @Body() dto: InviteStaffDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.staffService.invitePlatformStaff(dto, user);
  }

  @Patch(':id/status')
  @RequirePermissions(Permission.MANAGE_STAFF)
  @ApiUpdateStaffStatusDocs()
  updatePlatformStaffStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStaffStatusDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.staffService.updatePlatformStaffStatus(id, dto, user);
  }

  // Same human-pace cap as the team variant (real email per call).
  @Throttle({
    short: { limit: 1, ttl: 10_000 },
    medium: { limit: 3, ttl: 60_000 },
    long: { limit: 10, ttl: 3_600_000 },
  })
  @Post(':id/resend-invite')
  @RequirePermissions(Permission.MANAGE_STAFF)
  @ApiResendStaffInviteDocs()
  resendPlatformInvite(@Param('id') id: string) {
    return this.staffService.resendPlatformInvite(id);
  }

  @Get(':id')
  @RequirePermissions(Permission.MANAGE_STAFF)
  @ApiGetStaffDocs()
  getPlatformStaff(@Param('id') id: string) {
    return this.staffService.getPlatformStaff(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.MANAGE_STAFF)
  @ApiUpdateStaffDocs()
  updatePlatformStaff(@Param('id') id: string, @Body() dto: UpdateStaffDto) {
    return this.staffService.updatePlatformStaff(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_STAFF)
  @ApiDeleteStaffDocs()
  removePlatformStaff(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.staffService.removePlatformStaff(id, user);
  }
}
