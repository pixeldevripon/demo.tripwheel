import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '@/auth/decorators/roles.decorator';

/**
 * Checks that the authenticated user has one of the required roles.
 *
 * Must be used AFTER AuthGuard (which attaches request.user).
 * If no roles are declared on the handler, all authenticated users pass.
 *
 * Usage:
 *   @Roles(Role.ADMIN)
 *   @UseGuards(RolesGuard)
 *   @Post()
 *   createCategory() {}
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No role restriction on this route
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{
      user: { role: Role };
    }>();

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Required role: ${requiredRoles.join(' or ')}`,
      );
    }

    return true;
  }
}
