import { auth } from '@/auth/auth.instance';
import { PrismaService } from '@/prisma/prisma.service';
import { StaffPermissionsService } from '@/staff/staff-permissions.service';
import { MailService } from '@/mail/mail.service';
import { TargetRateLimiter } from '@/bookings/lookup-rate-limiter';
import { dashboardAppBase } from '@/common/utils/app-urls.util';
import { createHash, randomBytes } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Role, StaffStatus, UserStatus } from '@prisma/client';
import {
  ConfirmPasswordChangeDto,
  RequestPasswordChangeDto,
  UpdateUserByAdminDto,
  UpdateUserProfileDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
  UserQueryDto,
} from './dto/user.dto';

/**
 * How long an emailed password-change link stays usable. Matches
 * `resetPasswordTokenExpiresIn` in auth.instance.ts on purpose - the two are
 * the same kind of credential and should not expire on different clocks.
 */
const PASSWORD_CHANGE_TTL_MS = 60 * 60 * 1000;
const PASSWORD_CHANGE_TTL_LABEL = '1 hour';

/** SHA-256 hex. The raw token only ever exists in the email. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly staffPermissions: StaffPermissionsService,
    private readonly mail: MailService,
    private readonly targetLimiter: TargetRateLimiter,
  ) {}

  async getAllUsers(query: UserQueryDto) {
    const { role, status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(role && { role }),
      ...(status && { status }),
      // The hidden internal-management admin never appears in any listing.
      isSystemAccount: false,
    };

    const [total, data] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          image: true,
          role: true,
          status: true,
          timezone: true,
          phone: true,
          location: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { total, page, limit, data };
  }

  async getUserById(id: string, opts?: { includeSystem?: boolean }) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        role: true,
        status: true,
        timezone: true,
        phone: true,
        location: true,
        createdAt: true,
        updatedAt: true,
        isSystemAccount: true,
        operator: {
          select: {
            id: true,
          },
        },
      },
    });

    // The hidden internal-management admin 404s for everyone except itself
    // (self-lookups pass includeSystem) - indistinguishable from not existing.
    if (!user || (user.isSystemAccount && !opts?.includeSystem)) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const { isSystemAccount: _hidden, ...safe } = user;
    return safe;
  }

  async getCurrentUser(userId: string) {
    return this.getUserById(userId, { includeSystem: true });
  }

  async getUserPermissions(id: string, requester: { id: string; role: Role }) {
    // Admin-or-self only: VIEW_PERMISSIONS alone must not let one account
    // enumerate another's resolved access (IDOR on the :id param).
    if (requester.role !== Role.ADMIN && requester.id !== id) {
      throw new ForbiddenException('You can only view your own permissions');
    }
    const user = await this.getUserById(id, {
      includeSystem: requester.id === id,
    });
    // EFFECTIVE permissions: static role map for most roles; the computed
    // designation/override set for staff members and operator team seats.
    const permissions = await this.staffPermissions.getEffectivePermissions({
      id: user.id,
      role: user.role,
    });
    return { permissions };
  }

  async updateUserProfile(userId: string, dto: UpdateUserProfileDto) {
    await this.getUserById(userId);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        role: true,
        status: true,
        timezone: true,
        phone: true,
        location: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updated;
  }

  /**
   * Keeps account-status changes made through the USERS module consistent
   * with the staff module's suspension semantics: suspending kills every
   * live session, mirrors the status onto any staff_members row, and drops
   * the cached permission set - reactivating restores the staff row.
   * Without this, PATCH /users/:id(/status) would flip user.status while the
   * staff row and sessions drifted out of sync.
   */
  private async syncStatusSideEffects(userId: string, status: UserStatus) {
    if (status === UserStatus.SUSPENDED || status === UserStatus.DELETED) {
      await Promise.all([
        this.prisma.session.deleteMany({ where: { userId } }),
        this.prisma.staffMember.updateMany({
          where: { userId },
          data: { status: StaffStatus.SUSPENDED },
        }),
      ]);
    } else if (status === UserStatus.ACTIVE) {
      await this.prisma.staffMember.updateMany({
        where: { userId, status: StaffStatus.SUSPENDED },
        data: { status: StaffStatus.ACTIVE },
      });
    }
    this.staffPermissions.invalidate(userId);
  }

  async updateUserByAdmin(id: string, dto: UpdateUserByAdminDto) {
    const target = await this.getUserById(id);

    // Admin accounts (including the hidden system account, which already
    // 404s above) are never edited through this endpoint - matching the
    // role/status/delete paths.
    if (target.role === Role.ADMIN) {
      throw new ForbiddenException(
        'Admin accounts cannot be edited via this endpoint',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        role: true,
        status: true,
        timezone: true,
        phone: true,
        location: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (dto.status !== undefined) {
      await this.syncStatusSideEffects(id, dto.status);
    }

    return updated;
  }

  async updateUserRole(
    id: string,
    dto: UpdateUserRoleDto,
    requester: { id: string; role: Role },
  ) {
    // Role changes hand out entire STATIC permission sets (EDITOR, STAFF, ...)
    // that sit outside the staff grant ceiling - so only a real ADMIN account
    // may perform them, never a staff member holding a delegated permission.
    if (requester.role !== Role.ADMIN) {
      throw new ForbiddenException('Only administrators can change user roles');
    }
    const requestingUserId = requester.id;
    if (id === requestingUserId) {
      throw new BadRequestException('You cannot change your own role');
    }

    const target = await this.getUserById(id);

    if (target.role === Role.ADMIN && dto.role !== Role.ADMIN) {
      throw new ForbiddenException('Cannot demote another admin');
    }

    if (dto.role === Role.ADMIN) {
      throw new ForbiddenException('ADMIN role cannot be assigned.');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    this.logger.log(
      `Admin ${requestingUserId} changed user ${id} role from ${target.role} to ${dto.role}`,
    );

    return updated;
  }

  async updateUserStatus(
    id: string,
    dto: UpdateUserStatusDto,
    requestingUserId: string,
  ) {
    if (id === requestingUserId) {
      throw new BadRequestException('You cannot change your own status');
    }

    const target = await this.getUserById(id);

    if (target.role === Role.ADMIN) {
      throw new ForbiddenException(
        'Cannot change the status of an admin account',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    await this.syncStatusSideEffects(id, dto.status);

    this.logger.log(
      `Admin ${requestingUserId} changed user ${id} status to ${dto.status}`,
    );

    return updated;
  }

  // ─── Set password (OAuth users only) ─────────────────────────────────────────

  async setPassword(
    newPassword: string,
    cookie: string,
  ): Promise<{ status: boolean }> {
    try {
      const result = await auth.api.setPassword({
        body: { newPassword },
        headers: new Headers({ cookie }),
      });
      return result;
    } catch (err: any) {
      const code = err?.body?.code as string | undefined;
      if (code === 'PASSWORD_ALREADY_SET') {
        throw new BadRequestException(
          'A password is already set on this account. Use change password instead.',
        );
      }
      throw new BadRequestException(
        err?.body?.message || 'Failed to set password',
      );
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // Password change - verified by password AND confirmed from the mailbox
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Step 1: authorise a password change.
   *
   * The current password is verified here so a wrong one fails immediately and
   * visibly, but NOTHING is written to the credential account yet - the new
   * password is parked (already hashed) behind an emailed token. Knowing the
   * password is therefore no longer enough to change it: an attacker on a
   * borrowed session, or one who has shoulder-surfed the password, still
   * cannot lock the owner out without also holding the mailbox.
   *
   * Re-requesting replaces any pending change, which kills the older link.
   */
  async requestPasswordChange(
    dto: RequestPasswordChangeDto,
    actor: { id: string; email: string; name?: string | null },
    cookie: string,
    ip?: string,
  ): Promise<{ sent: boolean }> {
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException(
        'Your new password must be different from your current one.',
      );
    }

    // Cap the GUESSES, not just the sends. A stolen session would otherwise
    // get the global throttle's ~300/min against this endpoint as a password
    // oracle. Counted on a separate bucket from the success cap below, so a
    // burst of wrong guesses cannot also lock the real owner out of
    // legitimately changing their password.
    this.targetLimiter.consume(
      'password-change-attempt',
      actor.id,
      [{ max: 10, windowMs: 15 * 60 * 1000 }],
      'Too many password attempts. Please wait a few minutes and try again.',
    );

    // Verify FIRST, so a wrong current password can never cost an email.
    // `verifyPassword` is a server-scope Better Auth endpoint: it re-reads the
    // session from the cookie (no cookie cache) and throws INVALID_PASSWORD.
    try {
      await auth.api.verifyPassword({
        body: { password: dto.currentPassword },
        headers: new Headers({ cookie }),
      });
    } catch (err: unknown) {
      const code = (err as { body?: { code?: string } })?.body?.code;
      if (code === 'INVALID_PASSWORD') {
        throw new UnauthorizedException(
          'The current password you entered is incorrect.',
        );
      }
      if (code === 'CREDENTIAL_ACCOUNT_NOT_FOUND') {
        throw new BadRequestException(
          'This account has no password yet. Set one instead of changing it.',
        );
      }
      throw new BadRequestException(
        'Could not verify your current password. Please try again.',
      );
    }

    // Only AFTER the password checks out - a failed attempt must not burn the
    // budget, or anyone could lock the real owner out of changing their
    // password by spamming wrong guesses.
    this.targetLimiter.consume(
      'password-change',
      actor.id,
      [{ max: 5, windowMs: 60 * 60 * 1000 }],
      'Too many password-change emails requested. Please wait and try again.',
    );

    const ctx = await auth.$context;
    const newPasswordHash = await ctx.password.hash(dto.newPassword);
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_CHANGE_TTL_MS);

    await this.prisma.passwordChangeRequest.upsert({
      where: { userId: actor.id },
      create: {
        userId: actor.id,
        newPasswordHash,
        tokenHash: hashToken(token),
        expiresAt,
        requestedIp: ip ?? null,
      },
      update: {
        newPasswordHash,
        tokenHash: hashToken(token),
        expiresAt,
        requestedIp: ip ?? null,
        createdAt: new Date(),
      },
    });

    const confirmUrl = `${dashboardAppBase()}/profile/confirm-password-change?token=${token}`;
    try {
      await this.mail.sendPasswordChangeConfirmationEmail(
        actor.email,
        confirmUrl,
        PASSWORD_CHANGE_TTL_LABEL,
        actor.name ?? undefined,
      );
    } catch (err) {
      // The token only ever existed in the undelivered email, so the row is
      // now unreachable - drop it rather than leave a dead pending change
      // sitting on the account for an hour (it would also make the profile
      // read "a change is pending" when none can be completed).
      await this.prisma.passwordChangeRequest.deleteMany({
        where: { userId: actor.id },
      });
      this.logger.error(
        `Password-change email failed for user ${actor.id}; pending change discarded`,
        err as Error,
      );
      throw new ServiceUnavailableException(
        'We could not send the confirmation email. Please try again shortly.',
      );
    }

    this.logger.log(
      `Password change requested for user ${actor.id} - awaiting email confirmation`,
    );
    return { sent: true };
  }

  /**
   * Step 2: apply the change from the emailed link.
   *
   * Authorised by the TOKEN alone, deliberately: the link is often opened on a
   * phone with no dashboard session. The token is single-use and short-lived,
   * and step 1 already proved the requester knew the password.
   *
   * Every session is revoked, including the caller's: a password change is
   * exactly the moment you want anyone holding a stolen session pushed out.
   */
  async confirmPasswordChange(
    dto: ConfirmPasswordChangeDto,
  ): Promise<{ changed: boolean }> {
    const pending = await this.prisma.passwordChangeRequest.findUnique({
      where: { tokenHash: hashToken(dto.token) },
      select: {
        id: true,
        userId: true,
        newPasswordHash: true,
        expiresAt: true,
      },
    });

    // Same message for "never existed", "already used" and "expired" - a
    // distinct 410 would tell someone probing tokens that they had guessed a
    // real one.
    const invalid = new BadRequestException(
      'This confirmation link is invalid or has expired. Start the password change again.',
    );
    if (!pending) throw invalid;
    if (pending.expiresAt.getTime() <= Date.now()) {
      await this.prisma.passwordChangeRequest.deleteMany({
        where: { id: pending.id },
      });
      throw invalid;
    }

    // Single-use: consume the row FIRST, guarded on its own id, so two
    // concurrent clicks cannot both go on to apply the change.
    const { count } = await this.prisma.passwordChangeRequest.deleteMany({
      where: { id: pending.id },
    });
    if (count === 0) throw invalid;

    const ctx = await auth.$context;
    await ctx.internalAdapter.updatePassword(
      pending.userId,
      pending.newPasswordHash,
    );
    // Mirrors `revokeSessionsOnPasswordReset` for the reset path.
    await ctx.internalAdapter.deleteSessions(pending.userId);
    await this.prisma.user.update({
      where: { id: pending.userId },
      data: { hasPassword: true, passwordChangedAt: new Date() },
    });

    this.logger.log(
      `Password changed for user ${pending.userId} after email confirmation (all sessions revoked)`,
    );
    return { changed: true };
  }

  async deleteUser(id: string, requestingUserId: string) {
    if (id === requestingUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const target = await this.getUserById(id);

    if (target.role === Role.ADMIN) {
      throw new ForbiddenException(
        'Admin accounts cannot be deleted via this endpoint',
      );
    }

    await this.prisma.user.delete({ where: { id } });

    this.logger.log(`Admin ${requestingUserId} deleted user ${id}`);

    return { message: 'User deleted successfully' };
  }
}
