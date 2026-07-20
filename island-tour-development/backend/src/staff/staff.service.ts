import { auth } from '@/auth/auth.instance';
import {
  getPortalUrl,
  getStaffUrl,
  provisionInvitedAccount,
} from '@/common/utils/invite-provisioning.util';
import {
  computeEffectivePermissions,
  OPERATOR_SEAT_CEILING,
  PERMISSION_CATALOG,
  PLATFORM_STAFF_CEILING,
  STAFF_BASE_PERMISSIONS,
} from '@/config/staff.config';
import { PrismaService } from '@/prisma/prisma.service';
import { StaffPermissionsService } from '@/staff/staff-permissions.service';
import type { TypedAuthUser } from '@/auth/auth.types';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Permission,
  Prisma,
  Role,
  StaffSeatRole,
  StaffStatus,
  UserStatus,
} from '@prisma/client';
import {
  CreateDesignationDto,
  InviteStaffDto,
  InviteTeamMemberDto,
  StaffQueryDto,
  UpdateDesignationDto,
  UpdateStaffDto,
  UpdateStaffStatusDto,
  UpdateTeamMemberDto,
} from './dto/staff.dto';
import { ROLE_PERMISSIONS } from '@/config/roles.config';

/**
 * Staff & Teams management (login doc Phase 2, extended with fine-grained
 * permissions). Two audiences over one data model:
 *
 * - PLATFORM staff (operatorId NULL, user role STAFF): admin-managed via
 *   MANAGE_STAFF - which sits outside every grant ceiling, so only real
 *   ADMIN accounts ever hold it.
 * - OPERATOR team seats (operatorId set, user role TOUR_OPERATOR): managed by
 *   the operator OWNER via MANAGE_TEAM (owner-only by ceiling; admins pass an
 *   explicit ?operatorId). OWNER seats are never creatable/editable here.
 *
 * Invites reuse the operator invite flow: provision the auth user with a
 * throwaway credential, then fire a server-initiated password reset whose
 * hook branch sends the set-password invite email.
 */
@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  private readonly portalUrl = getPortalUrl();
  private readonly staffUrl = getStaffUrl();

  /**
   * Where a member's set-password link must land: platform staff get the
   * staff door (`/staff/reset`), team seats the operator portal
   * (`/portal/reset`) - the two surfaces have separate reset screens.
   */
  private resetRedirectFor(operatorId: string | null): string {
    return `${operatorId ? this.portalUrl : this.staffUrl}/reset`;
  }

  private readonly memberSelect = {
    id: true,
    operatorId: true,
    seatRole: true,
    status: true,
    extraPermissions: true,
    revokedPermissions: true,
    invitedAt: true,
    activatedAt: true,
    lastLoginAt: true,
    createdAt: true,
    updatedAt: true,
    user: {
      select: { id: true, name: true, email: true, image: true, status: true },
    },
    designation: { select: { id: true, name: true, permissions: true } },
    invitedBy: { select: { id: true, name: true } },
  } satisfies Prisma.StaffMemberSelect;

  constructor(
    private readonly prisma: PrismaService,
    private readonly staffPermissions: StaffPermissionsService,
  ) {}

  // ── Shared helpers ─────────────────────────────────────────────────────────

  private toMemberResponse(
    member: Prisma.StaffMemberGetPayload<{
      select: StaffService['memberSelect'];
    }>,
  ) {
    const { designation, ...rest } = member;
    return {
      ...rest,
      // Real staff rows are never the system admin - that account has no
      // staff_members row at all and is synthesized in listPlatformStaff.
      isSystemAdmin: false,
      designation: designation
        ? { id: designation.id, name: designation.name }
        : null,
      effectivePermissions: computeEffectivePermissions({
        operatorScoped: member.operatorId !== null,
        seatRole: member.seatRole,
        status: member.status,
        designationPermissions: designation?.permissions ?? [],
        extraPermissions: member.extraPermissions,
        revokedPermissions: member.revokedPermissions,
      }),
    };
  }

  /**
   * The `user` columns needed to render an ADMIN account in the staff-member
   * shape. Kept next to its mapper so the list and the single-member lookup
   * cannot drift apart.
   */
  private readonly systemAdminSelect = {
    id: true,
    name: true,
    email: true,
    image: true,
    status: true,
    createdAt: true,
    // No lastLoginAt on User - the newest session is the real signal.
    sessions: {
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 1,
    },
  } satisfies Prisma.UserSelect;

  /** An ADMIN user rendered as a read-only staff member (see findSystemAdmins). */
  private toSystemAdminResponse(
    admin: Prisma.UserGetPayload<{ select: StaffService['systemAdminSelect'] }>,
  ) {
    return {
      id: admin.id,
      operatorId: null,
      seatRole: StaffSeatRole.OWNER,
      status: StaffStatus.ACTIVE,
      extraPermissions: [],
      revokedPermissions: [],
      invitedAt: null,
      activatedAt: admin.createdAt,
      lastLoginAt: admin.sessions[0]?.createdAt ?? null,
      createdAt: admin.createdAt,
      updatedAt: admin.createdAt,
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        image: admin.image,
        status: admin.status,
      },
      designation: null,
      invitedBy: null,
      effectivePermissions: [...ROLE_PERMISSIONS[Role.ADMIN]],
      isSystemAdmin: true,
    };
  }

  /** Rejects grants outside the scope ceiling with an explicit 400. */
  private assertWithinCeiling(
    permissions: Permission[] | undefined,
    operatorScoped: boolean,
    fieldName: string,
  ) {
    if (!permissions?.length) return;
    const ceiling = operatorScoped
      ? OPERATOR_SEAT_CEILING
      : PLATFORM_STAFF_CEILING;
    const outside = permissions.filter((p) => !ceiling.includes(p));
    if (outside.length) {
      throw new BadRequestException(
        `${fieldName} contains permissions outside the grantable set: ${outside.join(', ')}`,
      );
    }
  }

  /** Designation must exist and belong to the same scope (platform/operator). */
  private async resolveDesignation(
    designationId: string,
    operatorId: string | null,
  ) {
    const designation = await this.prisma.staffDesignation.findUnique({
      where: { id: designationId },
      select: { id: true, operatorId: true },
    });
    if (!designation || designation.operatorId !== operatorId) {
      throw new BadRequestException('Designation not found in this scope');
    }
    return designation;
  }

  /**
   * Resolves which operator a team call acts on and asserts the caller may
   * manage it. Owners resolve to their own operator; admins must pass an
   * explicit operatorId. Everyone else is rejected (MANAGE_TEAM sits outside
   * the seat ceiling, so seats cannot even reach this point).
   */
  private async resolveTeamOperatorId(
    actor: TypedAuthUser,
    operatorId?: string,
  ): Promise<string> {
    if (actor.role === Role.ADMIN) {
      if (!operatorId) {
        throw new BadRequestException(
          'operatorId is required when acting as admin',
        );
      }
      const operator = await this.prisma.operator.findUnique({
        where: { id: operatorId },
        select: { id: true },
      });
      if (!operator) throw new NotFoundException('Operator not found');
      return operator.id;
    }

    const own = await this.prisma.operator.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    });
    if (own) {
      if (operatorId && operatorId !== own.id) {
        throw new ForbiddenException('You can only manage your own team');
      }
      return own.id;
    }

    throw new ForbiddenException('Only the operator owner can manage the team');
  }

  /** Loads a member and asserts it belongs to the expected scope. */
  private async resolveMember(id: string, operatorId: string | null) {
    const member = await this.prisma.staffMember.findUnique({
      where: { id },
      select: this.memberSelect,
    });
    if (!member || member.operatorId !== operatorId) {
      throw new NotFoundException('Staff member not found');
    }
    return member;
  }

  /**
   * Provisions the auth user + credential (shared invite util) + staff row +
   * invite email. Rolls back everything it created on failure.
   */
  private async provisionMember(params: {
    email: string;
    name: string;
    role: Role;
    operatorId: string | null;
    seatRole: StaffSeatRole;
    designationId?: string;
    extraPermissions: Permission[];
    invitedById: string;
  }) {
    const { email, user, authCtx } = await provisionInvitedAccount(
      this.prisma,
      { email: params.email, name: params.name, role: params.role },
    );

    try {
      const member = await this.prisma.staffMember.create({
        data: {
          userId: user.id,
          operatorId: params.operatorId,
          seatRole: params.seatRole,
          status: StaffStatus.INVITED,
          designationId: params.designationId ?? null,
          extraPermissions: params.extraPermissions,
          invitedById: params.invitedById,
        },
        select: this.memberSelect,
      });

      // Server-initiated reset -> the invite branch in auth.instance.ts sends
      // the set-password invite email (not a reset email).
      await auth.api.requestPasswordReset({
        body: { email, redirectTo: this.resetRedirectFor(params.operatorId) },
      });

      this.logger.log(
        `Staff invited: ${email} (${params.operatorId ? `operator ${params.operatorId}` : 'platform'}) by ${params.invitedById}`,
      );
      return this.toMemberResponse(member);
    } catch (err) {
      // internalAdapter.deleteUser removes sessions/accounts; the staff row
      // cascades with the user - a failure leaves no orphans.
      await authCtx.internalAdapter.deleteUser(user.id).catch(() => undefined);
      throw err;
    }
  }

  private async listMembers(operatorId: string | null, query: StaffQueryDto) {
    const { search, status, designationId, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.StaffMemberWhereInput = {
      operatorId,
      ...(status && { status }),
      ...(designationId && { designationId }),
      ...(search && {
        user: {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        },
      }),
    };

    const [total, rows] = await Promise.all([
      this.prisma.staffMember.count({ where }),
      this.prisma.staffMember.findMany({
        where,
        select: this.memberSelect,
        // Owner first, then newest invites.
        orderBy: [{ seatRole: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      total,
      page,
      limit,
      data: rows.map((row) => this.toMemberResponse(row)),
    };
  }

  private async applyMemberUpdate(
    member: { id: string; operatorId: string | null; user: { id: string } },
    dto: UpdateStaffDto,
    seatRole?: StaffSeatRole,
  ) {
    const operatorScoped = member.operatorId !== null;
    this.assertWithinCeiling(
      dto.extraPermissions,
      operatorScoped,
      'extraPermissions',
    );

    if (dto.designationId) {
      await this.resolveDesignation(dto.designationId, member.operatorId);
    }

    const updated = await this.prisma.staffMember.update({
      where: { id: member.id },
      data: {
        ...(seatRole !== undefined && { seatRole }),
        ...(dto.designationId !== undefined && {
          designationId: dto.designationId,
        }),
        ...(dto.extraPermissions !== undefined && {
          extraPermissions: dto.extraPermissions,
        }),
        ...(dto.revokedPermissions !== undefined && {
          revokedPermissions: dto.revokedPermissions,
        }),
      },
      select: this.memberSelect,
    });

    this.staffPermissions.invalidate(member.user.id);
    return this.toMemberResponse(updated);
  }

  private async applyStatusUpdate(
    member: {
      id: string;
      operatorId: string | null;
      seatRole: StaffSeatRole;
      status: StaffStatus;
      user: { id: string; email: string };
    },
    dto: UpdateStaffStatusDto,
    actorId: string,
  ) {
    if (member.seatRole === StaffSeatRole.OWNER) {
      throw new ForbiddenException(
        'Owner seats cannot be suspended via the staff API',
      );
    }
    if (member.user.id === actorId) {
      throw new BadRequestException('You cannot change your own status');
    }

    const suspending = dto.status === StaffStatus.SUSPENDED;

    const updated = await this.prisma.staffMember.update({
      where: { id: member.id },
      data: {
        status: dto.status,
        ...(dto.status === StaffStatus.ACTIVE &&
          member.status === StaffStatus.INVITED && { activatedAt: new Date() }),
      },
      select: this.memberSelect,
    });

    // Suspension is immediate: block future logins AND kill live sessions.
    await this.prisma.user.update({
      where: { id: member.user.id },
      data: { status: suspending ? UserStatus.SUSPENDED : UserStatus.ACTIVE },
      select: { id: true },
    });
    if (suspending) {
      await this.prisma.session.deleteMany({
        where: { userId: member.user.id },
      });
    }

    this.staffPermissions.invalidate(member.user.id);
    this.logger.log(
      `Staff ${member.user.email} ${suspending ? 'suspended' : 'reactivated'} by ${actorId}`,
    );
    return this.toMemberResponse(updated);
  }

  private async removeMember(
    member: {
      id: string;
      seatRole: StaffSeatRole;
      user: { id: string; email: string };
    },
    actorId: string,
  ) {
    if (member.seatRole === StaffSeatRole.OWNER) {
      throw new ForbiddenException(
        'Owner seats cannot be removed via the staff API',
      );
    }
    if (member.user.id === actorId) {
      throw new BadRequestException('You cannot remove your own account');
    }

    // Removes the user plus sessions/accounts; the staff row cascades.
    const authCtx = await auth.$context;
    await authCtx.internalAdapter.deleteUser(member.user.id);

    this.staffPermissions.invalidate(member.user.id);
    this.logger.log(`Staff ${member.user.email} removed by ${actorId}`);
    return { message: 'Staff member removed successfully' };
  }

  private async resendInviteFor(member: {
    status: StaffStatus;
    operatorId: string | null;
    user: { email: string };
  }) {
    if (member.status !== StaffStatus.INVITED) {
      throw new BadRequestException(
        'Only members with a pending invite can receive a new invite email',
      );
    }
    await auth.api.requestPasswordReset({
      body: {
        email: member.user.email,
        redirectTo: this.resetRedirectFor(member.operatorId),
      },
    });
    return { message: 'Invite email sent' };
  }

  // ── Permission catalog ─────────────────────────────────────────────────────

  getPermissionCatalog(scope: 'platform' | 'team') {
    const ceiling =
      scope === 'team' ? OPERATOR_SEAT_CEILING : PLATFORM_STAFF_CEILING;
    const groups = PERMISSION_CATALOG.map((group) => ({
      group: group.group,
      permissions: group.permissions.filter((p) => ceiling.includes(p.key)),
    })).filter((group) => group.permissions.length > 0);

    return {
      groups,
      ceiling: [...ceiling],
      base: [...STAFF_BASE_PERMISSIONS],
    };
  }

  // ── Platform staff (admin-side) ────────────────────────────────────────────

  /**
   * Platform members, with the system administrator(s) shown at the top.
   *
   * ADMIN accounts are deliberately NOT staff-managed (see staff.prisma): they
   * have no `staff_members` row, so the plain member query cannot see them and
   * the Users page used to render without the very account running it. They
   * are synthesized into the list here as read-only entries flagged
   * `isSystemAdmin`, so the page shows who holds the keys while every mutating
   * path keeps rejecting them (`assertNotSystemAdmin`).
   *
   * The synthesized rows carry `seatRole: OWNER` so any surface that already
   * hides destructive actions for owners does the right thing for admins
   * without needing to know about the new flag.
   */
  async listPlatformStaff(query: StaffQueryDto) {
    const { page = 1, limit = 20 } = query;
    const admins = await this.findSystemAdmins(query);
    const staff = await this.listMembers(null, query);

    // One virtual list: [admins..., staff...]. Slice it per page so the pager
    // total and the row count stay consistent across every page.
    const offset = (page - 1) * limit;
    const adminSlice = admins.slice(offset, offset + limit);
    const remaining = limit - adminSlice.length;
    const staffSkip = Math.max(0, offset - admins.length);

    const staffSlice =
      remaining > 0 ? staff.data.slice(staffSkip, staffSkip + remaining) : [];

    return {
      total: admins.length + staff.total,
      page,
      limit,
      data: [...adminSlice, ...staffSlice],
    };
  }

  /**
   * ADMIN users rendered in the staff-member shape. Honours the same search
   * filter as the real query; a `status` filter other than ACTIVE or any
   * `designationId` filter excludes them, since an admin is always active and
   * never carries a designation.
   */
  private async findSystemAdmins(query: StaffQueryDto) {
    const { search, status, designationId } = query;
    if (designationId) return [];
    if (status && status !== StaffStatus.ACTIVE) return [];

    const admins = await this.prisma.user.findMany({
      where: {
        role: Role.ADMIN,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      select: this.systemAdminSelect,
      orderBy: { createdAt: 'asc' },
    });

    return admins.map((admin) => this.toSystemAdminResponse(admin));
  }

  /**
   * The system administrator cannot be edited, suspended or removed through
   * the staff API. Without this the id would simply 404 (no staff row), which
   * reads as "not found" rather than "not allowed" - and now that the account
   * is VISIBLE in the list, the refusal has to be explicit.
   */
  private async assertNotSystemAdmin(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });
    if (user?.role === Role.ADMIN) {
      throw new ForbiddenException(
        'The system administrator account cannot be modified or removed',
      );
    }
  }

  async invitePlatformStaff(dto: InviteStaffDto, actor: TypedAuthUser) {
    this.assertWithinCeiling(dto.extraPermissions, false, 'extraPermissions');
    if (dto.designationId) {
      await this.resolveDesignation(dto.designationId, null);
    }
    return this.provisionMember({
      email: dto.email,
      name: dto.name,
      role: Role.STAFF,
      operatorId: null,
      seatRole: StaffSeatRole.STAFF,
      designationId: dto.designationId,
      extraPermissions: dto.extraPermissions ?? [],
      invitedById: actor.id,
    });
  }

  /**
   * A single platform member. The system administrator is visible in the list
   * but has no `staff_members` row, so a plain lookup would 404 on the very
   * account running the page - synthesize the same read-only shape the list
   * uses instead. Mutating paths keep rejecting it via `assertNotSystemAdmin`.
   */
  async getPlatformStaff(id: string) {
    const admin = await this.prisma.user.findFirst({
      where: { id, role: Role.ADMIN },
      select: this.systemAdminSelect,
    });
    if (admin) return this.toSystemAdminResponse(admin);

    const member = await this.resolveMember(id, null);
    return this.toMemberResponse(member);
  }

  async updatePlatformStaff(id: string, dto: UpdateStaffDto) {
    await this.assertNotSystemAdmin(id);
    const member = await this.resolveMember(id, null);
    return this.applyMemberUpdate(member, dto);
  }

  async updatePlatformStaffStatus(
    id: string,
    dto: UpdateStaffStatusDto,
    actor: TypedAuthUser,
  ) {
    await this.assertNotSystemAdmin(id);
    const member = await this.resolveMember(id, null);
    return this.applyStatusUpdate(member, dto, actor.id);
  }

  async removePlatformStaff(id: string, actor: TypedAuthUser) {
    await this.assertNotSystemAdmin(id);
    const member = await this.resolveMember(id, null);
    return this.removeMember(member, actor.id);
  }

  async resendPlatformInvite(id: string) {
    await this.assertNotSystemAdmin(id);
    const member = await this.resolveMember(id, null);
    return this.resendInviteFor(member);
  }

  // ── Operator team seats ────────────────────────────────────────────────────

  async listTeam(
    query: StaffQueryDto,
    actor: TypedAuthUser,
    operatorId?: string,
  ) {
    const resolved = await this.resolveTeamOperatorId(actor, operatorId);
    return this.listMembers(resolved, query);
  }

  async inviteTeamMember(dto: InviteTeamMemberDto, actor: TypedAuthUser) {
    const operatorId = await this.resolveTeamOperatorId(actor, dto.operatorId);
    this.assertWithinCeiling(dto.extraPermissions, true, 'extraPermissions');
    if (dto.designationId) {
      await this.resolveDesignation(dto.designationId, operatorId);
    }
    return this.provisionMember({
      email: dto.email,
      name: dto.name,
      role: Role.TOUR_OPERATOR,
      operatorId,
      // MANAGER/STAFF is an organizational label (no permission semantics
      // yet); OWNER is created only by operator create, never here.
      seatRole: dto.seatRole ?? StaffSeatRole.STAFF,
      designationId: dto.designationId,
      extraPermissions: dto.extraPermissions ?? [],
      invitedById: actor.id,
    });
  }

  async getTeamMember(id: string, actor: TypedAuthUser, operatorId?: string) {
    const resolved = await this.resolveTeamOperatorId(actor, operatorId);
    const member = await this.resolveMember(id, resolved);
    return this.toMemberResponse(member);
  }

  async updateTeamMember(
    id: string,
    dto: UpdateTeamMemberDto,
    actor: TypedAuthUser,
  ) {
    const resolved = await this.resolveTeamOperatorId(actor, dto.operatorId);
    const member = await this.resolveMember(id, resolved);
    if (member.seatRole === StaffSeatRole.OWNER) {
      throw new ForbiddenException(
        'Owner seats cannot be edited via the team API',
      );
    }
    // Validate-then-write-once: seatRole rides in the same update as the
    // permission fields, so a validation failure can never leave a partially
    // applied mutation behind.
    return this.applyMemberUpdate(member, dto, dto.seatRole);
  }

  async updateTeamMemberStatus(
    id: string,
    dto: UpdateStaffStatusDto,
    actor: TypedAuthUser,
    operatorId?: string,
  ) {
    const resolved = await this.resolveTeamOperatorId(actor, operatorId);
    const member = await this.resolveMember(id, resolved);
    return this.applyStatusUpdate(member, dto, actor.id);
  }

  async removeTeamMember(
    id: string,
    actor: TypedAuthUser,
    operatorId?: string,
  ) {
    const resolved = await this.resolveTeamOperatorId(actor, operatorId);
    const member = await this.resolveMember(id, resolved);
    return this.removeMember(member, actor.id);
  }

  async resendTeamInvite(
    id: string,
    actor: TypedAuthUser,
    operatorId?: string,
  ) {
    const resolved = await this.resolveTeamOperatorId(actor, operatorId);
    const member = await this.resolveMember(id, resolved);
    return this.resendInviteFor(member);
  }

  // ── Designations ───────────────────────────────────────────────────────────

  private designationSelectWithCount = {
    id: true,
    operatorId: true,
    name: true,
    description: true,
    permissions: true,
    isSystem: true,
    createdAt: true,
    updatedAt: true,
    _count: { select: { members: true } },
  } satisfies Prisma.StaffDesignationSelect;

  private toDesignationResponse(
    row: Prisma.StaffDesignationGetPayload<{
      select: StaffService['designationSelectWithCount'];
    }>,
  ) {
    const { _count, ...rest } = row;
    return { ...rest, memberCount: _count.members };
  }

  private async listDesignationsFor(operatorId: string | null) {
    const rows = await this.prisma.staffDesignation.findMany({
      where: { operatorId },
      select: this.designationSelectWithCount,
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
    return rows.map((row) => this.toDesignationResponse(row));
  }

  private async createDesignationFor(
    operatorId: string | null,
    dto: CreateDesignationDto,
    actorId: string,
  ) {
    this.assertWithinCeiling(
      dto.permissions,
      operatorId !== null,
      'permissions',
    );

    // Postgres treats NULLs as distinct in the compound unique, so platform
    // scope uniqueness must be enforced here.
    const duplicate = await this.prisma.staffDesignation.findFirst({
      where: { operatorId, name: { equals: dto.name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(
        `A designation named "${dto.name}" already exists`,
      );
    }

    try {
      const row = await this.prisma.staffDesignation.create({
        data: {
          operatorId,
          name: dto.name,
          description: dto.description,
          permissions: dto.permissions,
          createdById: actorId,
        },
        select: this.designationSelectWithCount,
      });
      return this.toDesignationResponse(row);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          `A designation named "${dto.name}" already exists`,
        );
      }
      throw err;
    }
  }

  private async updateDesignationFor(
    id: string,
    operatorId: string | null,
    dto: UpdateDesignationDto,
  ) {
    const designation = await this.prisma.staffDesignation.findUnique({
      where: { id },
      select: { id: true, operatorId: true, isSystem: true, name: true },
    });
    if (!designation || designation.operatorId !== operatorId) {
      throw new NotFoundException('Designation not found');
    }
    if (
      designation.isSystem &&
      dto.name !== undefined &&
      dto.name !== designation.name
    ) {
      throw new ForbiddenException('System designations cannot be renamed');
    }
    this.assertWithinCeiling(
      dto.permissions,
      operatorId !== null,
      'permissions',
    );

    if (dto.name && dto.name !== designation.name) {
      const duplicate = await this.prisma.staffDesignation.findFirst({
        where: {
          operatorId,
          name: { equals: dto.name, mode: 'insensitive' },
          id: { not: id },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException(
          `A designation named "${dto.name}" already exists`,
        );
      }
    }

    const row = await this.prisma.staffDesignation.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.permissions !== undefined && { permissions: dto.permissions }),
      },
      select: this.designationSelectWithCount,
    });

    // A template edit affects every member holding it.
    if (dto.permissions !== undefined) this.staffPermissions.invalidateAll();
    return this.toDesignationResponse(row);
  }

  private async deleteDesignationFor(id: string, operatorId: string | null) {
    const designation = await this.prisma.staffDesignation.findUnique({
      where: { id },
      select: {
        id: true,
        operatorId: true,
        isSystem: true,
        _count: { select: { members: true } },
      },
    });
    if (!designation || designation.operatorId !== operatorId) {
      throw new NotFoundException('Designation not found');
    }
    if (designation.isSystem) {
      throw new ForbiddenException('System designations cannot be deleted');
    }
    if (designation._count.members > 0) {
      throw new ConflictException(
        `Designation is assigned to ${designation._count.members} member(s). Reassign them first.`,
      );
    }

    await this.prisma.staffDesignation.delete({
      where: { id },
      select: { id: true },
    });
    return { message: 'Designation deleted successfully' };
  }

  // Platform designation API (admin)
  async listPlatformDesignations() {
    return this.listDesignationsFor(null);
  }
  async createPlatformDesignation(
    dto: CreateDesignationDto,
    actor: TypedAuthUser,
  ) {
    return this.createDesignationFor(null, dto, actor.id);
  }
  async updatePlatformDesignation(id: string, dto: UpdateDesignationDto) {
    return this.updateDesignationFor(id, null, dto);
  }
  async deletePlatformDesignation(id: string) {
    return this.deleteDesignationFor(id, null);
  }

  // Team designation API (owner / admin with operatorId)
  async listTeamDesignations(actor: TypedAuthUser, operatorId?: string) {
    const resolved = await this.resolveTeamOperatorId(actor, operatorId);
    return this.listDesignationsFor(resolved);
  }
  async createTeamDesignation(
    dto: CreateDesignationDto,
    actor: TypedAuthUser,
    operatorId?: string,
  ) {
    const resolved = await this.resolveTeamOperatorId(actor, operatorId);
    return this.createDesignationFor(resolved, dto, actor.id);
  }
  async updateTeamDesignation(
    id: string,
    dto: UpdateDesignationDto,
    actor: TypedAuthUser,
    operatorId?: string,
  ) {
    const resolved = await this.resolveTeamOperatorId(actor, operatorId);
    return this.updateDesignationFor(id, resolved, dto);
  }
  async deleteTeamDesignation(
    id: string,
    actor: TypedAuthUser,
    operatorId?: string,
  ) {
    const resolved = await this.resolveTeamOperatorId(actor, operatorId);
    return this.deleteDesignationFor(id, resolved);
  }
}
