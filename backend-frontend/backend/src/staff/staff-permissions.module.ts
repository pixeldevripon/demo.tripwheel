import { Global, Module } from '@nestjs/common';
import { StaffPermissionsService } from '@/staff/staff-permissions.service';

/**
 * Global provider of the effective-permission resolver.
 *
 * @Global on purpose: PermissionsGuard (registered as APP_GUARD in AuthModule),
 * UserService and StaffService must all share ONE instance - the in-process
 * cache lives on it, and staff mutations must invalidate the exact cache the
 * guard reads. Import nothing; PrismaService is itself global.
 */
@Global()
@Module({
  providers: [StaffPermissionsService],
  exports: [StaffPermissionsService],
})
export class StaffPermissionsModule {}
