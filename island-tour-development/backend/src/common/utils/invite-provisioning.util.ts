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

/**
 * Provisions an invited auth account: normalized unique email, user row with
 * the given role, and a credential account holding a throwaway password (never
 * transmitted anywhere) so the invite's set-password reset flow can replace it.
 *
 * This is the security-sensitive common prefix of every invite flow - ONE
 * implementation on purpose. The caller creates its own domain rows afterwards
 * and owns rollback: `authCtx.internalAdapter.deleteUser(user.id)` removes the
 * user plus sessions/accounts (and cascades staff rows), leaving no orphans.
 */
export async function provisionInvitedAccount(
  prisma: PrismaService,
  params: { email: string; name: string; role: Role },
): Promise<{
  email: string;
  user: { id: string };
  authCtx: Awaited<typeof auth.$context>;
}> {
  const email = params.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictException(`A user with email ${email} already exists`);
  }

  const authCtx = await auth.$context;

  const throwawayPassword = randomBytes(24).toString('base64url');
  const hashedPassword = await authCtx.password.hash(throwawayPassword);

  const user = await authCtx.internalAdapter.createUser({
    email,
    name: params.name,
    role: params.role,
    // Admin/owner-vouched; ownership is re-proven via the invite link.
    emailVerified: true,
  });

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

  return { email, user: { id: user.id }, authCtx };
}
