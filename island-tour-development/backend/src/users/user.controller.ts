import type { TypedAuthUser } from '@/auth/auth.types';
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@prisma/client';
import type { Request } from 'express';
import {
  SetPasswordDto,
  UpdateUserByAdminDto,
  UpdateUserProfileDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
  UserQueryDto,
} from './dto/user.dto';
import { UserService } from './user.service';
import {
  ApiDeleteUserDocs,
  ApiGetAllUsersDocs,
  ApiGetCurrentUserDocs,
  ApiGetCurrentUserPermissionsDocs,
  ApiGetUserByIdDocs,
  ApiGetUserPermissionsDocs,
  ApiSetPasswordDocs,
  ApiUpdateUserByAdminDocs,
  ApiUpdateUserProfileDocs,
  ApiUpdateUserRoleDocs,
  ApiUpdateUserStatusDocs,
} from './user.swagger';

@ApiTags('Users')
@Controller('users')
/**
 * UserController — manages all user-facing and admin user-management endpoints.
 *
 * ## Access-Control Strategy
 * This controller uses **permission-based RBAC** (not pure RBAC, not true PBAC):
 *
 *   - Every authenticated request passes through the global `AuthGuard` first,
 *     which validates the Better Auth session and attaches `request.user`.
 *   - `@RequirePermissions(Permission.XYZ)` on a handler then delegates to
 *     `PermissionsGuard`, which resolves the caller's permissions from the
 *     static `ROLE_PERMISSIONS` map in `roles.config.ts`.
 *   - `@Roles()` is available (via `RolesGuard`) for coarse-grained locks but
 *     is deliberately NOT used here — `@RequirePermissions()` alone is more
 *     expressive and auditable at the route level.
 *
 * ## Why not pure RBAC (`@Roles()`  only)?
 * Pure RBAC checks `user.role === 'ADMIN'` and nothing more. Using permissions
 * instead makes the *intent* of each route self-documenting and allows future
 * fine-grained customisation without changing guard logic.
 *
 * ## Why not true PBAC (e.g. Casbin / OPA)?
 * The platform has three fixed roles with static permission sets. Dynamic,
 * attribute-based policies would add significant complexity with no real gain.
 * If per-user custom permissions are ever needed, migrate `ROLE_PERMISSIONS`
 * to a database table and adjust `PermissionsGuard` to query it.
 *
 * ## Route-ordering rule (NestJS)
 * Static path segments (`me`, `operators`) MUST be declared before the
 * dynamic `:id` segment, otherwise NestJS matches "me" as an id.
 */
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ─── Self-service (authenticated, no extra permission required) ────────────

  /**
   * GET /users/me
   *
   * Returns the profile of the currently authenticated user.
   *
   * Security: any authenticated user — no `@RequirePermissions` needed because
   * the user id is taken from the validated session, not from user input.
   * There is no elevation-of-privilege risk here.
   */
  @Get('me')
  @ApiGetCurrentUserDocs()
  getCurrentUser(@AuthenticatedUser() user: TypedAuthUser) {
    return this.userService.getCurrentUser(user.id);
  }

  /**
   * GET /users/me/permissions
   *
   * Returns the permission set granted to the currently authenticated user.
   * The frontend uses this to show/hide UI elements without exposing the full
   * role model to the client.
   *
   * Security: intentionally ungated — the user is always allowed to inspect
   * their *own* permissions. The user id is sourced from the session, not
   * from a URL param, so no IDOR risk exists.
   */
  @Get('me/permissions')
  @ApiGetCurrentUserPermissionsDocs()
  getCurrentUserPermissions(@AuthenticatedUser() user: TypedAuthUser) {
    return this.userService.getUserPermissions(user.id);
  }

  // ─── Admin / privileged reads ────────────────────────────────────────────

  /**
   * GET /users
   *
   * Paginated list of all platform users with optional search / role filters.
   *
   * Security: requires `VIEW_USERS` — granted to ADMIN only.
   */
  @Get()
  @RequirePermissions(Permission.VIEW_USERS)
  @ApiGetAllUsersDocs()
  getAllUsers(@Query() query: UserQueryDto) {
    return this.userService.getAllUsers(query);
  }

  /**
   * GET /users/:id
   *
   * Fetches a single user by their database id.
   *
   * Security: requires `VIEW_USERS` — granted to ADMIN only.
   * Regular users wanting their own profile should call GET /users/me.
   */
  @Get(':id')
  @RequirePermissions(Permission.VIEW_USERS)
  @ApiGetUserByIdDocs()
  getUserById(@Param('id') id: string) {
    return this.userService.getUserById(id);
  }

  /**
   * GET /users/:id/permissions
   *
   * Returns the resolved permission set for any user by id.
   * Intended for admin audit / debugging workflows.
   *
   * Security: requires `VIEW_PERMISSIONS` — granted to ADMIN and TOUR_OPERATOR.
   * Note: for a user to view their *own* permissions use GET /users/me/permissions,
   * which is ungated and avoids the IDOR risk of an arbitrary :id param.
   */
  @RequirePermissions(Permission.VIEW_PERMISSIONS)
  @Get(':id/permissions')
  @ApiGetUserPermissionsDocs()
  getUserPermissions(@Param('id') id: string) {
    return this.userService.getUserPermissions(id);
  }

  // ─── Self-service mutations ──────────────────────────────────────────────

  /**
   * POST /users/me/set-password
   *
   * Sets a password for users who registered via OAuth and have no credentials.
   * Calls auth.api.setPassword() server-side with the session headers — the
   * only supported way to call this Better Auth API per their documentation.
   *
   * Security: intentionally ungated beyond AuthGuard. Any authenticated user
   * without a credential account may set a password. Better Auth's
   * sensitiveSessionMiddleware validates the session a second time internally.
   */
  @Post('me/set-password')
  @ApiSetPasswordDocs()
  setPassword(@Body() dto: SetPasswordDto, @Req() req: Request) {
    const cookie = (req.headers['cookie'] as string) ?? '';
    return this.userService.setPassword(dto.newPassword, cookie);
  }

  /**
   * PATCH /users/me
   *
   * Allows an authenticated user to update their own profile fields
   * (e.g. name, avatar, phone). The user id is sourced from the session,
   * so no IDOR risk exists — a user can never update another user's profile
   * through this endpoint.
   *
   * Security: intentionally ungated — being authenticated is sufficient.
   * `EDIT_PROFILE` is not explicitly checked here because the session already
   * guarantees the caller owns the resource. Adding `@RequirePermissions` would
   * only be necessary if we ever need to *revoke* self-edit for specific roles.
   */
  @Patch('me')
  @ApiUpdateUserProfileDocs()
  updateProfile(
    @AuthenticatedUser() user: TypedAuthUser,
    @Body() dto: UpdateUserProfileDto,
  ) {
    return this.userService.updateUserProfile(user.id, dto);
  }

  // ─── Admin mutations ─────────────────────────────────────────────────────

  /**
   * PATCH /users/:id/role
   *
   * Elevates or demotes a user's role (e.g. USER → TOUR_OPERATOR).
   * The caller's id (`user.id`) is forwarded to the service so it can
   * audit-log who performed the change and prevent self-demotion.
   *
   * Security: requires `MANAGE_USERS` — granted to ADMIN only.
   */
  @Patch(':id/role')
  @RequirePermissions(Permission.MANAGE_USERS)
  @ApiUpdateUserRoleDocs()
  updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.userService.updateUserRole(id, dto, user.id);
  }

  /**
   * PATCH /users/:id/status
   *
   * Activates, suspends, or bans a user account.
   * The caller's id is forwarded for audit-logging.
   *
   * Security: requires `MANAGE_USERS` — granted to ADMIN only.
   */
  @Patch(':id/status')
  @RequirePermissions(Permission.MANAGE_USERS)
  @ApiUpdateUserStatusDocs()
  updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.userService.updateUserStatus(id, dto, user.id);
  }

  /**
   * PATCH /users/:id
   *
   * Admin-level update of any user's core fields (e.g. email, verified status).
   * Distinct from PATCH /users/me — this is an administrative override and
   * operates on an arbitrary target user.
   *
   * Security: requires `UPDATE_USER` — granted to ADMIN only.
   * Note: ownership is NOT checked at the controller level because `UPDATE_USER`
   * is an admin-exclusive permission — an admin may update any account.
   * If that assumption ever changes, add an ownership check in the service.
   */
  @Patch(':id')
  @RequirePermissions(Permission.UPDATE_USER)
  @ApiUpdateUserByAdminDocs()
  updateUserByAdmin(
    @Param('id') id: string,
    @Body() dto: UpdateUserByAdminDto,
  ) {
    return this.userService.updateUserByAdmin(id, dto);
  }

  /**
   * DELETE /users/:id
   *
   * Hard-deletes (or soft-deletes, depending on service impl) a user account.
   * The caller's id is forwarded so the service can prevent self-deletion
   * and record the audit entry.
   *
   * Security: requires `DELETE_USER` — granted to ADMIN only.
   */
  @Delete(':id')
  @RequirePermissions(Permission.DELETE_USER)
  @ApiDeleteUserDocs()
  deleteUser(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.userService.deleteUser(id, user.id);
  }
}
