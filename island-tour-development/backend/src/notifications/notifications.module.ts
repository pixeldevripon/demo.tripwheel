import { BullModule } from '@nestjs/bullmq';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { buildRedisConnection } from '@/common/utils/redis.util';
import { OctoCapabilitiesMiddleware } from '@/octo/common/octo-capabilities';
import { NotificationDeliveryProcessor } from './notification-delivery.processor';
import { NotificationsController } from './notifications.controller';
import { NotificationsService, NOTIFICATION_QUEUE } from './notifications.service';

/**
 * OCTO notifications module - subscription CRUD + outbound webhook delivery.
 *
 * `NotificationsService` is exported so domain services (availability, bookings, …) can
 * fire change events. The `OctoCapabilitiesMiddleware` is applied so `@OctoCaps()` is
 * populated and the `Octo-Capabilities` header is echoed on this OCTO surface.
 * `PrismaService` is `@Global()`, so it is not imported here.
 */
@Module({
  imports: [
    BullModule.registerQueue({
      name: NOTIFICATION_QUEUE,
      connection: buildRedisConnection(),
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationDeliveryProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(OctoCapabilitiesMiddleware)
      .forRoutes('octo/notifications/subscriptions');
  }
}
