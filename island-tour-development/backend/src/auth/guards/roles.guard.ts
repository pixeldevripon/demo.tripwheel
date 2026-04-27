import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '@/auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '@/auth/auth.types';

/**
 * Coarse-grained role guard — checks that the authenticated user holds at
 * least one of the roles listed in `@Roles()`.
 *
 * ## Guard execution order (all registered as APP_GUARD in AuthModule)
 *   1. `AuthGuard`        — validates the session, attaches `request.user`
 *   2. `RolesGuard`       — optional coarse-grained role check  ← this guard
 *   3. `PermissionsGuard` — fine-grained permission check
 *
 * ## When to use `@Roles()` vs `@RequirePermissions()`
 *
 * | Scenario                                          | Use                     |
 * |---------------------------------------------------|-------------------------|
 * | Lock an *entire controller* to a single role      | `@Roles(Role.ADMIN)`    |
 * | Express the *intent* of a single route clearly    | `@RequirePermissions()` |
 * | Both coarse gate + fine-grained action check      | Both decorators together|
 *
 * **UserController does not use `@Roles()` at all** — `@RequirePermissions()`
 * alone is expressive enough for that controller and avoids redundancy.
 * `@Roles()` is most useful for locking whole controllers or groups of routes
 * where you want a hard role boundary regardless of the permission map.
 *
 * ## Anti-pattern: `@Public()` + `@Roles()` on the same route
 * `@Public()` bypasses `AuthGuard`, which means `request.user` is never
 * attached. If `@Roles()` is also present, this guard throws `ForbiddenException`
 * on the missing user check below. **Never combine these two decorators.**
 *
 * ## Usage examples
 *   Restrict a handler to admins only:
 *     @Roles(Role.ADMIN)
 *     @Post('/categories')
 *     createCategory() {}
 *
 *   Restrict an entire controller to admins:
 *     @Roles(Role.ADMIN)
 *     @Controller('admin')
 *     export class AdminController {}
 *
 *   Combine with @RequirePermissions() for belt-and-suspenders protection:
 *     @Roles(Role.ADMIN)
 *     @RequirePermissions(Permission.DELETE_CONTENT)
 *     @Delete('/trips/:id')
 *     deleteTrip() {}
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Guard against @Public() + @Roles() being used together on the same route
    if (!request.user) {
      throw new ForbiddenException('Access denied');
    }

    if (!requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException(
        `Required role: ${requiredRoles.join(' or ')}`,
      );
    }

    return true;
  }
}
