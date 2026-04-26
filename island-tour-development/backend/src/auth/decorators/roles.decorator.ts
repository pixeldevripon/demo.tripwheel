import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to users with one of the specified roles.
 *
 * @example
 *   @Roles(Role.ADMIN)
 *   @Roles(Role.ADMIN, Role.TOUR_OPERATOR)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
