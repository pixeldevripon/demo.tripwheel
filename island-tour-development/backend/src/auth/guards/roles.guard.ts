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
 * Checks that the authenticated user has one of the required roles.
 *
 * Registered as APP_GUARD in AuthModule — runs after AuthGuard on every route.
 * If no @Roles() are declared on the handler or class, all authenticated users pass.
 *
 * Usage:
 *   Restrict a handler to admins only:
 *     @Roles(Role.ADMIN)
 *     @Post('/categories')
 *     createCategory() {}
 *
 *   Restrict an entire controller to admins:
 *     @Roles(Role.ADMIN)
 *     @Controller('admin')
 *     export class AdminController {}
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
