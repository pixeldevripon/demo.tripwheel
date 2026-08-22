import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest, TypedAuthUser } from '@/auth/auth.types';

/**
 * Extracts the authenticated user from the request object.
 * Returns undefined on @Public() routes where AuthGuard does not run.
 *
 * @example
 *   @Get('/me')
 *   getProfile(@AuthenticatedUser() user: TypedAuthUser) { ... }
 */
export const AuthenticatedUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): TypedAuthUser | undefined => {
    return ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
  },
);
