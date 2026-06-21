import { Module } from '@nestjs/common';
import { NotificationsModule } from '@/notifications/notifications.module';
import { AvailabilityController } from './availability.controller';
import { AvailabilityMaterializerService } from './availability-materializer.service';
import { AvailabilityService } from './availability.service';

/**
 * Availability module — recurring schedules + date exceptions materialize into
 * `Departure` inventory, exposed via operator management routes and public real-time
 * availability reads. `PrismaService` is `@Global()`, so it is not imported here.
 * The materializer is exported for the nightly BullMQ job (Phase 9).
 * `NotificationsModule` provides `NotificationsService` for `AVAILABILITY_UPDATE` webhooks.
 */
@Module({
  imports: [NotificationsModule],
  controllers: [AvailabilityController],
  providers: [AvailabilityService, AvailabilityMaterializerService],
  exports: [AvailabilityService, AvailabilityMaterializerService],
})
export class AvailabilityModule {}
