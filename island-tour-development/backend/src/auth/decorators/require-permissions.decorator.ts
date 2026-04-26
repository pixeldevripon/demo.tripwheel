import { SetMetadata } from '@nestjs/common';
import { Permission } from '@prisma/client';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Restricts a route to users whose role grants all of the listed permissions.
 *
 * @example
 *   @RequirePermissions(Permission.CREATE_CATEGORY)
 *   @RequirePermissions(Permission.MANAGE_TRIPS, Permission.VIEW_ANALYTICS)
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
