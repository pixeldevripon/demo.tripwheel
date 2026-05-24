import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '@/auth/auth.instance';
import { IS_PUBLIC_KEY } from '@/auth/decorators/public.decorator';
import type { AuthenticatedRequest, TypedAuthUser } from '@/auth/auth.types';

/**
 * Global auth guard — validates the Better Auth session cookie (or Bearer token).
 *
 * Registered as APP_GUARD in AuthModule — runs on every route automatically.
 * Routes decorated with @Public() skip this check entirely.
 * On success, attaches `request.user` (TypedAuthUser) and `request.session`.
 *
 * Usage:
 *   Skip auth for a public route:
 *     @Public()
 *     @Get('/health')
 *     healthCheck() {}
 *
 *   Access the authenticated user in a controller:
 *     @Get('/me')
 *     getMe(@AuthenticatedUser() user: TypedAuthUser) { return user; }
 *
 *   Webhook endpoints must also add @SkipThrottle() — see Critical Rule #11.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (session) {
      // Cast is safe: role/status values at runtime are always valid enum members
      request.user = session.user as unknown as TypedAuthUser;
      request.session = session.session;
    }

    // Public routes: always allow through regardless of session presence.
    // req.user is populated above when a valid session cookie IS present,
    // so service-layer ownership checks work correctly for authenticated callers.
    if (isPublic) return true;

    if (!session) throw new UnauthorizedException('No active session');

    return true;
  }
}
