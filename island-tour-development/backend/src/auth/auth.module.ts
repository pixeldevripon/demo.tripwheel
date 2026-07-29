import { Module, OnModuleDestroy } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import {
  hasOwnThrottleOverride,
  isTrustedInternalOrigin,
} from '@/auth/internal-origin.util';
import { TrustedOriginThrottlerGuard } from '@/auth/trusted-origin-throttler.guard';
import { AuthController } from '@/auth/auth.controller';
import { LoginPrecheckController } from '@/auth/login-precheck.controller';
import { LoginPrecheckService } from '@/auth/login-precheck.service';
import { SessionSurfaceController } from '@/auth/session-surface.controller';
import { SessionSurfaceService } from '@/auth/session-surface.service';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { authPrismaClient } from '@/auth/auth.instance';

/**
 * AuthModule wires Better Auth into NestJS.
 *
 * APP_GUARD providers are applied globally in registration order:
 *   1. TrustedOriginThrottlerGuard - rate-limit before hitting the DB for
 *                                    session checks (ThrottlerGuard + a tracker
 *                                    that understands our SSR callers)
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
      //
      // SCOPED, not wholesale: a route that declares its OWN `@Throttle()` did
      // so because these tiers were too loose for it - the mail-senders, the
      // credential paths, settle. Those limits are the whole protection there,
      // so one leak of INTERNAL_API_SECRET must not lift them all at once.
      // Using `@Throttle()` itself as the marker means the rule cannot drift:
      // tightening a route removes it from the bypass automatically.
      // Such a route reached from SSR is then limited by the SSR egress IP, so
      // that caller must forward INTERNAL_CLIENT_IP_HEADER - see
      // `TrustedOriginThrottlerGuard`, which tracks by it and warns when a
      // trusted origin is throttled without it.
      skipIf: (context) =>
        isTrustedInternalOrigin(context) && !hasOwnThrottleOverride(context),
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
  controllers: [
    AuthController,
    LoginPrecheckController,
    SessionSurfaceController,
  ],
  providers: [
    LoginPrecheckService,
    SessionSurfaceService,
    { provide: APP_GUARD, useClass: TrustedOriginThrottlerGuard },
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
