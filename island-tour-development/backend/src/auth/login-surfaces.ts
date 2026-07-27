import { Role } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

/**
 * Login surfaces ("doors"): every user type signs in through its own URL, all
 * hitting the same Better Auth endpoint. The client names its door via the
 * `x-login-surface` header and the sign-in hook rejects a mismatch, so a
 * credential can only mint a session at a door its account is eligible for.
 *
 * - account: traveler door   (dashboard /account)
 * - portal:  operator door   (dashboard /portal, owners + team seats)
 * - staff:   platform staff  (dashboard /staff)
 * - admin:   system admin    (separate admin app)
 */
export const LOGIN_SURFACES = ['account', 'portal', 'staff', 'admin'] as const;
export type LoginSurface = (typeof LOGIN_SURFACES)[number];

export const SURFACE_HEADER = 'x-login-surface';

/** Highest-privilege first; used to suggest "the" door for a multi-hat user. */
const SURFACE_PRIORITY: LoginSurface[] = [
  'admin',
  'staff',
  'portal',
  'account',
];

export function isLoginSurface(value: unknown): value is LoginSurface {
  return (
    typeof value === 'string' && LOGIN_SURFACES.includes(value as LoginSurface)
  );
}

export function suggestedSurface(
  surfaces: LoginSurface[],
): LoginSurface | null {
  return SURFACE_PRIORITY.find((s) => surfaces.includes(s)) ?? null;
}

/**
 * The minimal user shape the hat computation needs (one findUnique).
 * `status` and `isSystemAccount` are NOT read by surfacesForUser - they ride
 * along for callers that branch on them (the sign-in hook's suspension check,
 * customer provisioning's system-account skip) so one select serves all.
 */
export interface SurfaceUserRow {
  role: Role;
  status: string;
  isSystemAccount: boolean;
  operator: { id: string } | null;
  staffMember: { operatorId: string | null } | null;
  customerOf: { id: string }[];
}

export const SURFACE_USER_SELECT = {
  role: true,
  status: true,
  isSystemAccount: true,
  operator: { select: { id: true } },
  staffMember: { select: { operatorId: true } },
  customerOf: { select: { id: true }, take: 1 },
} as const;

/**
 * Derives which doors a user may enter from its attached identities ("hats"),
 * not just the coarse role column - one account can be traveler + staff +
 * operator at once.
 *
 * ADMIN passes every door (Critical Rule #3: ADMIN is a strict superset), and
 * it also keeps the platform reachable if the admin app is ever down.
 */
export function surfacesForUser(user: SurfaceUserRow): LoginSurface[] {
  if (user.role === Role.ADMIN) return [...LOGIN_SURFACES];

  const surfaces: LoginSurface[] = [];
  if (user.role === Role.STAFF || user.staffMember?.operatorId === null) {
    surfaces.push('staff');
  }
  if (
    user.operator !== null ||
    (user.staffMember !== null && user.staffMember.operatorId !== null) ||
    user.role === Role.TOUR_OPERATOR
  ) {
    surfaces.push('portal');
  }
  if (user.customerOf.length > 0 || user.role === Role.USER) {
    surfaces.push('account');
  }
  return surfaces;
}

/**
 * Accepts any Prisma-client-shaped instance so both the pre-DI
 * `authPrismaClient` (Better Auth hooks) and the Nest `PrismaService` work.
 */
export async function getLoginSurfaces(
  db: Pick<PrismaClient, 'user'>,
  userId: string,
): Promise<LoginSurface[]> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: SURFACE_USER_SELECT,
  });
  if (!user) return [];
  return surfacesForUser(user);
}
