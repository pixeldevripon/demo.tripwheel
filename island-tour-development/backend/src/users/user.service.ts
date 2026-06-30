import { auth } from '@/auth/auth.instance';
import { ROLE_PERMISSIONS } from '@/config/roles.config';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
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

  constructor(private readonly prisma: PrismaService) {}

  async getAllUsers(query: UserQueryDto) {
    const { role, status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(role && { role }),
      ...(status && { status }),
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

  async getUserById(id: string) {
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
        operator: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException(`User ${id} not found`);

    return user;
  }

  async getCurrentUser(userId: string) {
    return this.getUserById(userId);
  }

  async getUserPermissions(id: string) {
    const user = await this.getUserById(id);
    const permissions = ROLE_PERMISSIONS[user.role] || [];
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

  async updateUserByAdmin(id: string, dto: UpdateUserByAdminDto) {
    await this.getUserById(id);

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

    return updated;
  }

  async updateUserRole(
    id: string,
    dto: UpdateUserRoleDto,
    requestingUserId: string,
  ) {
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
