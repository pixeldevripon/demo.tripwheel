import type { Request } from 'express';
import type { Role } from '@prisma/client';
import type { AuthUser, AuthSession } from '@/auth/auth.instance';

// Narrows Better Auth's inferred `role: string` to the typed Role enum
export type TypedAuthUser = Omit<AuthUser, 'role'> & { role: Role };

export interface AuthenticatedRequest extends Request {
  user?: TypedAuthUser;
  session?: AuthSession['session'];
}
