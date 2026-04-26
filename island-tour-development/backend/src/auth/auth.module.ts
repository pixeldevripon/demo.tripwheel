import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from '@/auth/auth.controller';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { PermissionsGuard } from '@/auth/guards/permissions.guard';

/**
 * AuthModule wires Better Auth into NestJS.
 *
 * Registers three APP_GUARD providers (applied globally in order):
 *   1. AuthGuard         — validates session cookie / Bearer token
 *   2. RolesGuard        — checks @Roles() decorator metadata
 *   3. PermissionsGuard  — checks @RequirePermissions() metadata
 *
 * The AuthController mounts all /api/auth/* endpoints.
 * It is NOT subject to the global "api/v1" prefix (set in main.ts).
 */
@Module({
  controllers: [AuthController],
  providers: [
    // Global guards — applied to every route in the application
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [],
})
export class AuthModule {}
