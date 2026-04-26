import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Permission } from '@prisma/client';
import { PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { ROLE_PERMISSIONS } from '@/config/roles.config';

/**
 * Checks that the authenticated user's role grants all required permissions.
 *
 * Must be used AFTER AuthGuard (which attaches request.user).
 *
 * Usage:
 *   @RequirePermissions(Permission.CREATE_CATEGORY)
 *   @UseGuards(PermissionsGuard)
 *   @Post()
 *   createCategory() {}
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{
      user: { role: Role };
    }>();

    const userPermissions = ROLE_PERMISSIONS[user.role] ?? [];
    const missing = required.filter((p) => !userPermissions.includes(p));

    if (missing.length > 0) {
      throw new ForbiddenException(
        `Missing permissions: ${missing.join(', ')}`,
      );
    }

    return true;
  }
}
