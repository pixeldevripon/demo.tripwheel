import { SetMetadata } from '@nestjs/common';
import { Permission } from '@prisma/client';

export const ANY_PERMISSIONS_KEY = 'anyPermissions';

/**
 * What it does: restricts a route to users whose EFFECTIVE permission set
 * contains at least ONE of the listed permissions (OR semantics), unlike
 * `@RequirePermissions`, which demands all of them (AND).
 *
 * Why it exists: the stop-sell split (access matrix v1.7). Close/reopen
 * surfaces are reachable by either the full `MANAGE_AVAILABILITY` setup grant
 * or the narrow `STOP_SELL` seat grant - an OR the AND decorator cannot say.
 *
 * Dependencies: read by `PermissionsGuard` via `ANY_PERMISSIONS_KEY`. Both
 * decorators may sit on one route; the guard then enforces both (all of the
 * AND set, plus one of the OR set).
 *
 * Usage:
 *   @RequireAnyPermission(Permission.MANAGE_AVAILABILITY, Permission.STOP_SELL)
 */
export const RequireAnyPermission = (...permissions: Permission[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);
