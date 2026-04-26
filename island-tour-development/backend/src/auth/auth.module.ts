import { Module, OnModuleDestroy } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from '@/auth/auth.controller';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';
import { authPrismaClient } from '@/auth/auth.instance';

/**
 * AuthModule wires Better Auth into NestJS.
 *
 * APP_GUARD providers are applied globally in registration order:
 *   1. ThrottlerGuard     — rate-limit before hitting the DB for session checks
 *   2. AuthGuard          — validates session cookie / Bearer token
 *   3. RolesGuard         — checks @Roles() decorator metadata
 *   4. PermissionsGuard   — checks @RequirePermissions() metadata
 *
 * ThrottlerModule lives here (not AppModule) so ThrottlerGuard is registered
 * before the auth guards and fires first on every request.
 *
 * onModuleDestroy disconnects the standalone Prisma client used by Better Auth.
 */
@Module({
  imports: [
    ThrottlerModule.forRoot({
      // In test, use a single permissive throttler so E2E suites don't hit 429s.
      // Production uses three tiers: burst / sustained / hourly.
      throttlers:
        process.env.NODE_ENV === 'test'
          ? [{ name: 'test', ttl: 60_000, limit: 10_000 }]
          : [
              { name: 'short', ttl: 1_000, limit: 20 }, // burst: 20 req/s
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
