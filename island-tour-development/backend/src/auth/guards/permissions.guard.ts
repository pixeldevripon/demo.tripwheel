import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from '@prisma/client';
import { PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { StaffPermissionsService } from '@/staff/staff-permissions.service';
import type { AuthenticatedRequest } from '@/auth/auth.types';

/**
 * Checks that the authenticated user's EFFECTIVE permissions grant all
 * required permissions.
 *
 * Registered as APP_GUARD in AuthModule - runs after RolesGuard on every route.
 * If no @RequirePermissions() are declared on the handler or class, all pass.
 *
 * Effective permissions come from StaffPermissionsService: the static
 * ROLE_PERMISSIONS map for ADMIN/EDITOR/GUIDE/USER (no DB hit), and the
 * computed designation + per-member override set (capped to the scope
 * ceiling, briefly cached) for STAFF users and operator team seats. See
 * staff-permissions.service.ts for the full policy.
 *
 * Usage:
 *   Require a specific permission:
 *     @RequirePermissions(Permission.CREATE_CONTENT)
 *     @Post('/trips')
 *     createTrip() {}
 *
 *   Require multiple permissions (ALL must be granted):
 *     @RequirePermissions(Permission.MANAGE_TRIPS, Permission.VIEW_BOOKINGS)
 *     @Get('/operator/dashboard')
 *     getDashboard() {}
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly staffPermissions: StaffPermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    const { granted, missing } = await this.staffPermissions.hasPermissions(
      request.user,
      required,
    );

    if (!granted) {
      throw new ForbiddenException(
        `Missing permissions: ${missing.join(', ')}`,
      );
    }

    return true;
  }
}
