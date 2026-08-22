import { auth } from '@/auth/auth.instance';
import { ConflictException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { randomBytes } from 'crypto';
import type { PrismaService } from '@/prisma/prisma.service';

/**
 * Dashboard app base URL (including the /portal path), embedded verbatim in
 * emailed invite/reset links - trimmed and stripped of trailing junk because
 * a stray "/", ".", or space breaks the link. Shared by every invite flow
 * (operators, platform staff, team seats).
 */
export function getPortalUrl(): string {
  return (process.env.PORTAL_URL ?? 'http://localhost:3001/portal')
    .trim()
    .replace(/[/.\s]+$/, '');
}

/**
 * The staff door of the same dashboard app (`/staff/*`) - derived from
 * PORTAL_URL by swapping the `/portal` path segment, so ONE env var keeps
 * configuring the app's base. Platform-staff invite/reset links must land on
 * the staff surface, never the operator portal.
 */
export function getStaffUrl(): string {
  return getPortalUrl().replace(/\/portal$/, '/staff');
}

// `getAccountUrl()` lived here until 2026-07-28. The dashboard's `/account`
// customer door was removed: travellers are passwordless and manage their
// bookings at `/{locale}/traveller` on the public site, so nothing in the
// backend needs to link a customer into the ops dashboard any more.

/**
 * Role precedence for one-account-many-hats: attaching an identity may only
 * ELEVATE the coarse role column, never downgrade it (a traveler who becomes
 * staff is STAFF; a staff member who books a tour stays STAFF).
 */
const ROLE_PRECEDENCE: Record<Role, number> = {
  [Role.ADMIN]: 5,
  [Role.STAFF]: 4,
  [Role.TOUR_OPERATOR]: 3,
  [Role.EDITOR]: 2,
  [Role.GUIDE]: 1,
  [Role.USER]: 0,
};

export function elevateRole(current: Role, requested: Role): Role {
  return ROLE_PRECEDENCE[requested] > ROLE_PRECEDENCE[current]
    ? requested
    : current;
}

export interface ProvisionOrAttachResult {
  email: string;
  user: { id: string };
  authCtx: Awaited<typeof auth.$context>;
  /**
   * True when this call created the auth user. Rollback contract: callers may
   * `authCtx.internalAdapter.deleteUser(user.id)` ONLY when `created` is true;
   * for an attach they must instead delete the identity rows they created and
   * restore `priorRole` - deleting the user would destroy a real pre-existing
   * account (bookings, sessions, everything).
   */
  created: boolean;
  /**
   * True when the account already had a self-set password. The caller then
   * sends a "you've been added" notification instead of a set-password invite.
   */
  hadPassword: boolean;
  /** Role before elevation; restore this on attach-rollback. */
  priorRole: Role;
}

/**
 * Provisions an invited auth account - or ATTACHES a new identity to an
 * existing one (one account per email, many hats).
 *
 * New email: user row with the given role + a credential account holding a
 * throwaway password (never transmitted anywhere) so the invite's set-password
 * reset flow can replace it.
 *
 * Existing email: the role is elevated by precedence (never downgraded), the
 * existing name/password/emailVerified are left untouched, and the caller
 * creates its identity rows against the returned user id. Same-hat conflicts
 * (already staff, already an operator) are the CALLER's job to pre-check -
 * this util stays generic.
 *
 * This is the security-sensitive common prefix of every invite flow - ONE
 * implementation on purpose.
 */
export async function provisionOrAttachAccount(
  prisma: PrismaService,
  params: { email: string; name: string; role: Role },
): Promise<ProvisionOrAttachResult> {
  const email = params.email.toLowerCase().trim();
  const authCtx = await auth.$context;

  const attachTo = async (existing: {
    id: string;
    role: Role;
    hasPassword: boolean;
    isSystemAccount: boolean;
  }): Promise<ProvisionOrAttachResult> => {
    // The hidden internal-management account never gets hats attached; a
    // generic conflict avoids confirming anything about it.
    if (existing.isSystemAccount) {
      throw new ConflictException(`A user with email ${email} already exists`);
    }
    const newRole = elevateRole(existing.role, params.role);
    if (newRole !== existing.role) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: newRole },
        select: { id: true },
      });
    }
    return {
      email,
      user: { id: existing.id },
      authCtx,
      created: false,
      hadPassword: existing.hasPassword,
      priorRole: existing.role,
    };
  };

  const existingSelect = {
    id: true,
    role: true,
    hasPassword: true,
    isSystemAccount: true,
  } as const;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: existingSelect,
  });
  if (existing) return attachTo(existing);

  const throwawayPassword = randomBytes(24).toString('base64url');
  const hashedPassword = await authCtx.password.hash(throwawayPassword);

  let user: { id: string };
  try {
    user = await authCtx.internalAdapter.createUser({
      email,
      name: params.name,
      role: params.role,
      // Admin/owner-vouched; ownership is re-proven via the invite link.
      emailVerified: true,
    });
  } catch (err) {
    // Lost a create race (booking webhook vs staff invite, etc.): the row now
    // exists, so fall through to the attach path instead of failing.
    const raced = await prisma.user.findUnique({
      where: { email },
      select: existingSelect,
    });
    if (raced) return attachTo(raced);
    throw err;
  }

  try {
    await authCtx.internalAdapter.linkAccount({
      userId: user.id,
      providerId: 'credential',
      accountId: user.id,
      password: hashedPassword,
    });
  } catch (err) {
    await authCtx.internalAdapter.deleteUser(user.id).catch(() => undefined);
    throw err;
  }

  return {
    email,
    user: { id: user.id },
    authCtx,
    created: true,
    hadPassword: false,
    priorRole: params.role,
  };
}

/**
 * The rollback half of the provision-or-attach contract, shared by every
 * caller (staff invites, operator create) so the dangerous branch - "never
 * delete a pre-existing account" - is written exactly once:
 *
 * - created: the user is ours - delete it outright (sessions/accounts/staff
 *   rows cascade, no orphans).
 * - attached: only undo what the caller added - its staff rows for this user
 *   (the caller pre-checked none existed) and the role elevation.
 *
 * Never throws; rollback best-effort must not mask the original error.
 */
export async function rollbackProvisionOrAttach(
  prisma: PrismaService,
  result: Pick<
    ProvisionOrAttachResult,
    'user' | 'authCtx' | 'created' | 'priorRole'
  >,
): Promise<void> {
  if (result.created) {
    await result.authCtx.internalAdapter
      .deleteUser(result.user.id)
      .catch(() => undefined);
    return;
  }
  await prisma.staffMember
    .deleteMany({ where: { userId: result.user.id } })
    .catch(() => undefined);
  await prisma.user
    .update({
      where: { id: result.user.id },
      data: { role: result.priorRole },
    })
    .catch(() => undefined);
}
