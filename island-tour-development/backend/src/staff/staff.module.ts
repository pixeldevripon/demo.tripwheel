import { Module } from '@nestjs/common';
import { StaffController } from '@/staff/staff.controller';
import { StaffService } from '@/staff/staff.service';

/**
 * Staff & Teams management API. StaffPermissionsService is NOT provided here -
 * it lives in the @Global StaffPermissionsModule so the guards, UserService
 * and StaffService all share the single cached instance.
 */
@Module({
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
