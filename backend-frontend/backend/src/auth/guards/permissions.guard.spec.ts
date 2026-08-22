// Unit tests for PermissionsGuard - the fine-grained guard registered as
// APP_GUARD that runs after RolesGuard on every route.
//
// Covers: no-decorator passthrough, missing request.user (the @Public() +
// @RequirePermissions() misuse guard), and delegation to
// StaffPermissionsService.hasPermissions (both the granted and denied paths).

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, Role } from '@prisma/client';
import { ANY_PERMISSIONS_KEY } from '@/auth/decorators/require-any-permission.decorator';
import { PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { PermissionsGuard } from './permissions.guard';
import { StaffPermissionsService } from '@/staff/staff-permissions.service';
import type { AuthenticatedRequest } from '@/auth/auth.types';

function createContext(
  request: Partial<AuthenticatedRequest>,
): ExecutionContext {
  return {
    getHandler: () => ({}) as any,
    getClass: () => ({}) as any,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let staffPermissions: {
    hasPermissions: jest.Mock;
    getEffectivePermissions: jest.Mock;
  };

  /** Key-aware metadata stub: the guard reads two keys (ALL + ANY). */
  function setMetadata(all?: Permission[], any?: Permission[]) {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === PERMISSIONS_KEY
        ? all
        : key === ANY_PERMISSIONS_KEY
          ? any
          : undefined,
    );
  }

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    staffPermissions = {
      hasPermissions: jest.fn(),
      getEffectivePermissions: jest.fn().mockResolvedValue([]),
    };
    guard = new PermissionsGuard(
      reflector as unknown as Reflector,
      staffPermissions as unknown as StaffPermissionsService,
    );
  });

  it('passes through when no permissions are required (undefined metadata)', async () => {
    setMetadata(undefined);
    const context = createContext({});

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(staffPermissions.hasPermissions).not.toHaveBeenCalled();
  });

  it('passes through when the required permissions list is empty', async () => {
    setMetadata([]);
    const context = createContext({});

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(staffPermissions.hasPermissions).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when request.user is missing', async () => {
    setMetadata([Permission.VIEW_TRIPS]);
    const context = createContext({ user: undefined });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    expect(staffPermissions.hasPermissions).not.toHaveBeenCalled();
  });

  it('delegates to StaffPermissionsService.hasPermissions and passes when granted', async () => {
    const user = {
      id: 'user-1',
      role: Role.STAFF,
    } as AuthenticatedRequest['user'];
    setMetadata([Permission.VIEW_TRIPS]);
    staffPermissions.hasPermissions.mockResolvedValue({
      granted: true,
      missing: [],
    });
    const context = createContext({ user });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(staffPermissions.hasPermissions).toHaveBeenCalledWith(user, [
      Permission.VIEW_TRIPS,
    ]);
  });

  it('throws ForbiddenException listing the missing permissions when not granted', async () => {
    const user = {
      id: 'user-2',
      role: Role.STAFF,
    } as AuthenticatedRequest['user'];
    setMetadata([Permission.MANAGE_TRIPS, Permission.VIEW_ANALYTICS]);
    staffPermissions.hasPermissions.mockResolvedValue({
      granted: false,
      missing: [Permission.MANAGE_TRIPS],
    });
    const context = createContext({ user });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException('Missing permissions: MANAGE_TRIPS'),
    );
  });

  // The stop-sell split (matrix v1.7): @RequireAnyPermission is OR - one hit
  // from the effective set suffices, none of them throws.
  it('passes @RequireAnyPermission when the user holds ANY listed permission', async () => {
    const user = {
      id: 'user-3',
      role: Role.STAFF,
    } as AuthenticatedRequest['user'];
    setMetadata(undefined, [
      Permission.MANAGE_AVAILABILITY,
      Permission.STOP_SELL,
    ]);
    staffPermissions.getEffectivePermissions.mockResolvedValue([
      Permission.STOP_SELL,
    ]);
    const context = createContext({ user });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(staffPermissions.hasPermissions).not.toHaveBeenCalled();
  });

  it('throws @RequireAnyPermission when the user holds none of the set', async () => {
    const user = {
      id: 'user-4',
      role: Role.STAFF,
    } as AuthenticatedRequest['user'];
    setMetadata(undefined, [
      Permission.MANAGE_AVAILABILITY,
      Permission.STOP_SELL,
    ]);
    staffPermissions.getEffectivePermissions.mockResolvedValue([
      Permission.VIEW_TRIPS,
    ]);
    const context = createContext({ user });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException('Requires one of: MANAGE_AVAILABILITY, STOP_SELL'),
    );
  });
});
