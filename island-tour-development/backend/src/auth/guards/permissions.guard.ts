import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from '@prisma/client';
import { PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { ROLE_PERMISSIONS } from '@/config/roles.config';
import type { AuthenticatedRequest } from '@/auth/auth.types';

/**
 * Checks that the authenticated user's role grants all required permissions.
 *
 * Registered as APP_GUARD in AuthModule — runs after RolesGuard on every route.
 * If no @RequirePermissions() are declared on the handler or class, all pass.
 * Permissions are looked up from ROLE_PERMISSIONS in roles.config.ts.
 *
 * Usage:
 *   Require a specific permission:
 *     @RequirePermissions(Permission.CREATE_CONTENT)
 *     @Post('/trips')
 *     createTrip() {}
 *
 *   Require multiple permissions (ALL must be granted):
 *     @RequirePermissions(Permission.MANAGE_TRIPS, Permission.VIEW_SLOT_ANALYTICS)
 *     @Get('/operator/dashboard')
 *     getDashboard() {}
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

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Guard against @Public() + @RequirePermissions() being used together
    if (!request.user) {
      throw new ForbiddenException('Access denied');
    }

    const userPermissions: Permission[] =
      ROLE_PERMISSIONS[request.user.role] ?? [];
    const missing = required.filter((p) => !userPermissions.includes(p));

    if (missing.length > 0) {
      throw new ForbiddenException(
        `Missing permissions: ${missing.join(', ')}`,
      );
    }

    return true;
  }
}
