import { timingSafeEqual } from 'node:crypto';
import { ExecutionContext, Module, OnModuleDestroy } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from '@/auth/auth.controller';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { authPrismaClient } from '@/auth/auth.instance';

/** Constant-time string compare (avoids leaking the secret via timing). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * True when a request carries the internal API secret, identifying it as a
 * first-party call from our own SSR/build server (the Next.js frontend).
 *
 * Such calls bypass the per-IP throttle: rate limiting exists to stop abusive
 * ANONYMOUS clients, but our SSR/build server is trusted infrastructure that
 * legitimately bursts many requests from a single origin IP while prerendering
 * (which would otherwise trip the limiter and fail the build). Only this
 * authenticated origin is exempted - unlike blanket-skipping the public read
 * endpoints, anonymous traffic to those routes stays fully throttled.
 *
 * The secret is server-only (never `NEXT_PUBLIC_`), so it is never shipped to a
 * browser; browser-side auth requests carry no such header and remain throttled
 * (and are separately guarded by Better Auth's own per-path rate limiter). When
 * the secret is unset the bypass never triggers - throttling applies to all.
 */
function isTrustedInternalOrigin(context: ExecutionContext): boolean {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return false;
  const req = context.switchToHttp().getRequest<{
    headers: Record<string, string | string[] | undefined>;
  }>();
  const provided = req.headers['x-internal-api-key'];
  return typeof provided === 'string' && safeEqual(provided, secret);
}

/**
 * AuthModule wires Better Auth into NestJS.
 *
 * APP_GUARD providers are applied globally in registration order:
 *   1. ThrottlerGuard     - rate-limit before hitting the DB for session checks
 *   2. AuthGuard          - validates session cookie / Bearer token
 *   3. RolesGuard         - checks @Roles() decorator metadata
 *   4. PermissionsGuard   - checks @RequirePermissions() metadata
 *
 * ThrottlerModule lives here (not AppModule) so ThrottlerGuard is registered
 * before the auth guards and fires first on every request.
 *
 * onModuleDestroy disconnects the standalone Prisma client used by Better Auth.
 */
@Module({
  imports: [
    ThrottlerModule.forRoot({
      // Trusted first-party origin (our SSR/build server, identified by the
      // internal API secret) bypasses the throttle; everyone else is limited.
      // This is what gives `next build` prerendering its headroom, WITHOUT
      // weakening protection for anonymous clients - so the tiers below stay
      // strict. Auth brute-force is separately handled by Better Auth's own
      // per-path rate limiter (see auth.instance.ts `rateLimit.customRules`).
      skipIf: isTrustedInternalOrigin,
      // In test, use a single permissive throttler so E2E suites don't hit 429s.
      // Otherwise three tiers: burst / sustained / hourly.
      throttlers:
        process.env.NODE_ENV === 'test'
          ? [{ name: 'test', ttl: 60_000, limit: 10_000 }]
          : [
              // Burst tier sized for an authenticated dashboard page load, which
              // legitimately fan-outs many parallel requests on mount (trips +
              // collections + attributes + hubs + tiers + resolved-tours, etc.)
              // from one browser/IP. The sustained + hourly caps below still bound
              // real abuse; anonymous auth brute-force is separately handled by
              // Better Auth's own per-path limiter (auth.instance.ts).
              { name: 'short', ttl: 1_000, limit: 60 }, // burst: 60 req/s
              { name: 'medium', ttl: 60_000, limit: 300 }, // sustained: 300 req/min
              { name: 'long', ttl: 3_600_000, limit: 3_000 }, // hourly cap: 3 000 req/hr
            ],
    }),
  ],
  controllers: [AuthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AuthModule implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await authPrismaClient.$disconnect();
  }
}
