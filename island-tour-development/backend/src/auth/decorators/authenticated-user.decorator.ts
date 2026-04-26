import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '@/auth/auth.instance';

/**
 * Extracts the authenticated user from the request object.
 * AuthGuard must run before this decorator is used.
 *
 * @example
 *   @Get('/me')
 *   getProfile(@AuthenticatedUser() user: AuthUser) {
 *     return user;
 *   }
 */
export const AuthenticatedUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => {
    return ctx.switchToHttp().getRequest<{ user: AuthUser }>().user;
  },
);
