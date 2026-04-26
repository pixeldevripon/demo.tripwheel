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

/**
 * Global auth guard — validates the Better Auth session cookie (or Bearer token).
 *
 * Routes decorated with @Public() skip this check entirely.
 * On success, attaches `request.user` and `request.session` for use in controllers.
 *
 * Usage:
 *   Register globally in AppModule providers:
 *     { provide: APP_GUARD, useClass: AuthGuard }
 *
 *   Skip for public routes:
 *     @Public()
 *     @Get('/health')
 *     healthCheck() {}
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Allow routes marked @Public() to bypass auth
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();

    /**
     * Resolve the active session via Better Auth natively.
     * 
     * Better Auth automatically extracts credentials from the incoming headers:
     * 1. Web/Browser Clients: Parses the configured session Cookie (e.g., better-auth.session_token).
     * 2. Mobile/API Clients: Parses the `Authorization: Bearer <token>` header.
     * 
     * If valid credentials are found, it verifies the session (checking DB or Cache)
     * and returns the strongly-typed `user` and `session` objects.
     */
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session) throw new UnauthorizedException('No active session');

    // Attach to request so controllers and other guards can read without re-querying
    request.user = session.user;
    request.session = session.session;

    return true;
  }
}
