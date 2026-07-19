// Unit tests for PermissionsGuard - the fine-grained guard registered as
// APP_GUARD that runs after RolesGuard on every route.
//
// Covers: no-decorator passthrough, missing request.user (the @Public() +
// @RequirePermissions() misuse guard), and delegation to
// StaffPermissionsService.hasPermissions (both the granted and denied paths).

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, Role } from '@prisma/client';
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
  let staffPermissions: { hasPermissions: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    staffPermissions = { hasPermissions: jest.fn() };
    guard = new PermissionsGuard(
      reflector as unknown as Reflector,
      staffPermissions as unknown as StaffPermissionsService,
    );
  });

  it('passes through when no permissions are required (undefined metadata)', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = createContext({});

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(staffPermissions.hasPermissions).not.toHaveBeenCalled();
  });

  it('passes through when the required permissions list is empty', async () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    const context = createContext({});

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(staffPermissions.hasPermissions).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when request.user is missing', async () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.VIEW_TRIPS]);
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
    reflector.getAllAndOverride.mockReturnValue([Permission.VIEW_TRIPS]);
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
    reflector.getAllAndOverride.mockReturnValue([
      Permission.MANAGE_TRIPS,
      Permission.VIEW_ANALYTICS,
    ]);
    staffPermissions.hasPermissions.mockResolvedValue({
      granted: false,
      missing: [Permission.MANAGE_TRIPS],
    });
    const context = createContext({ user });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException('Missing permissions: MANAGE_TRIPS'),
    );
  });
});
