import { auth } from '@/auth/auth.instance';
import { PrismaService } from '@/prisma/prisma.service';
import { StaffPermissionsService } from '@/staff/staff-permissions.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Role, StaffStatus, UserStatus } from '@prisma/client';
import {
  UpdateUserByAdminDto,
  UpdateUserProfileDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
  UserQueryDto,
} from './dto/user.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly staffPermissions: StaffPermissionsService,
  ) {}

  async getAllUsers(query: UserQueryDto) {
    const { role, status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(role && { role }),
      ...(status && { status }),
      // The hidden internal-management admin never appears in any listing.
      isSystemAccount: false,
    };

    const [total, data] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          image: true,
          role: true,
          status: true,
          timezone: true,
          phone: true,
          location: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { total, page, limit, data };
  }

  async getUserById(id: string, opts?: { includeSystem?: boolean }) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        role: true,
        status: true,
        timezone: true,
        phone: true,
        location: true,
        createdAt: true,
        updatedAt: true,
        isSystemAccount: true,
        operator: {
          select: {
            id: true,
          },
        },
      },
    });

    // The hidden internal-management admin 404s for everyone except itself
    // (self-lookups pass includeSystem) - indistinguishable from not existing.
    if (!user || (user.isSystemAccount && !opts?.includeSystem)) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const { isSystemAccount: _hidden, ...safe } = user;
    return safe;
  }

  async getCurrentUser(userId: string) {
    return this.getUserById(userId, { includeSystem: true });
  }

  async getUserPermissions(id: string, requester: { id: string; role: Role }) {
    // Admin-or-self only: VIEW_PERMISSIONS alone must not let one account
    // enumerate another's resolved access (IDOR on the :id param).
    if (requester.role !== Role.ADMIN && requester.id !== id) {
      throw new ForbiddenException('You can only view your own permissions');
    }
    const user = await this.getUserById(id, {
      includeSystem: requester.id === id,
    });
    // EFFECTIVE permissions: static role map for most roles; the computed
    // designation/override set for staff members and operator team seats.
    const permissions = await this.staffPermissions.getEffectivePermissions({
      id: user.id,
      role: user.role,
    });
    return { permissions };
  }

  async updateUserProfile(userId: string, dto: UpdateUserProfileDto) {
    await this.getUserById(userId);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        role: true,
        status: true,
        timezone: true,
        phone: true,
        location: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updated;
  }

  /**
   * Keeps account-status changes made through the USERS module consistent
   * with the staff module's suspension semantics: suspending kills every
   * live session, mirrors the status onto any staff_members row, and drops
   * the cached permission set - reactivating restores the staff row.
   * Without this, PATCH /users/:id(/status) would flip user.status while the
   * staff row and sessions drifted out of sync.
   */
  private async syncStatusSideEffects(userId: string, status: UserStatus) {
    if (status === UserStatus.SUSPENDED || status === UserStatus.DELETED) {
      await Promise.all([
        this.prisma.session.deleteMany({ where: { userId } }),
        this.prisma.staffMember.updateMany({
          where: { userId },
          data: { status: StaffStatus.SUSPENDED },
        }),
      ]);
    } else if (status === UserStatus.ACTIVE) {
      await this.prisma.staffMember.updateMany({
        where: { userId, status: StaffStatus.SUSPENDED },
        data: { status: StaffStatus.ACTIVE },
      });
    }
    this.staffPermissions.invalidate(userId);
  }

  async updateUserByAdmin(id: string, dto: UpdateUserByAdminDto) {
    const target = await this.getUserById(id);

    // Admin accounts (including the hidden system account, which already
    // 404s above) are never edited through this endpoint - matching the
    // role/status/delete paths.
    if (target.role === Role.ADMIN) {
      throw new ForbiddenException(
        'Admin accounts cannot be edited via this endpoint',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        role: true,
        status: true,
        timezone: true,
        phone: true,
        location: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (dto.status !== undefined) {
      await this.syncStatusSideEffects(id, dto.status);
    }

    return updated;
  }

  async updateUserRole(
    id: string,
    dto: UpdateUserRoleDto,
    requester: { id: string; role: Role },
  ) {
    // Role changes hand out entire STATIC permission sets (EDITOR, STAFF, ...)
    // that sit outside the staff grant ceiling - so only a real ADMIN account
    // may perform them, never a staff member holding a delegated permission.
    if (requester.role !== Role.ADMIN) {
      throw new ForbiddenException('Only administrators can change user roles');
    }
    const requestingUserId = requester.id;
    if (id === requestingUserId) {
      throw new BadRequestException('You cannot change your own role');
    }

    const target = await this.getUserById(id);

    if (target.role === Role.ADMIN && dto.role !== Role.ADMIN) {
      throw new ForbiddenException('Cannot demote another admin');
    }

    if (dto.role === Role.ADMIN) {
      throw new ForbiddenException('ADMIN role cannot be assigned.');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    this.logger.log(
      `Admin ${requestingUserId} changed user ${id} role from ${target.role} to ${dto.role}`,
    );

    return updated;
  }

  async updateUserStatus(
    id: string,
    dto: UpdateUserStatusDto,
    requestingUserId: string,
  ) {
    if (id === requestingUserId) {
      throw new BadRequestException('You cannot change your own status');
    }

    const target = await this.getUserById(id);

    if (target.role === Role.ADMIN) {
      throw new ForbiddenException(
        'Cannot change the status of an admin account',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    await this.syncStatusSideEffects(id, dto.status);

    this.logger.log(
      `Admin ${requestingUserId} changed user ${id} status to ${dto.status}`,
    );

    return updated;
  }

  // ─── Set password (OAuth users only) ─────────────────────────────────────────

  async setPassword(
    newPassword: string,
    cookie: string,
  ): Promise<{ status: boolean }> {
    try {
      const result = await auth.api.setPassword({
        body: { newPassword },
        headers: new Headers({ cookie }),
      });
      return result;
    } catch (err: any) {
      const code = err?.body?.code as string | undefined;
      if (code === 'PASSWORD_ALREADY_SET') {
        throw new BadRequestException(
          'A password is already set on this account. Use change password instead.',
        );
      }
      throw new BadRequestException(
        err?.body?.message || 'Failed to set password',
      );
    }
  }

  async deleteUser(id: string, requestingUserId: string) {
    if (id === requestingUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const target = await this.getUserById(id);

    if (target.role === Role.ADMIN) {
      throw new ForbiddenException(
        'Admin accounts cannot be deleted via this endpoint',
      );
    }

    await this.prisma.user.delete({ where: { id } });

    this.logger.log(`Admin ${requestingUserId} deleted user ${id}`);

    return { message: 'User deleted successfully' };
  }
}
