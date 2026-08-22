import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { NotificationDeliveryStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { decrypt } from '@/common/utils/crypto.util';
import { PrismaService } from '@/prisma/prisma.service';
import { NOTIFICATION_QUEUE } from './notifications.service';
import {
  OCTO_NOTIFICATION_ID_HEADER,
  OCTO_SIGNATURE_HEADER,
  signNotification,
} from './notification-signing.util';

export interface NotificationDeliveryJob {
  deliveryId: string;
}

/** Webhook POST timeout (ms). */
const DELIVERY_TIMEOUT_MS = 10_000;

/**
 * NotificationDeliveryProcessor - consumes the 'notification-delivery' queue and
 * POSTs each pending delivery to its subscriber `url` with an HMAC `Octo-Signature`
 * header (D13). BullMQ retries with exponential backoff; the final failed attempt
 * marks the row `DEAD`, intermediate failures `FAILED`, success `DELIVERED`.
 */
@Processor(NOTIFICATION_QUEUE)
export class NotificationDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationDeliveryProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<NotificationDeliveryJob>): Promise<void> {
    const { deliveryId } = job.data;

    const delivery = await this.prisma.notificationDelivery.findUnique({
      where: { id: deliveryId },
      include: { subscription: true },
    });
    if (!delivery) {
      this.logger.warn(`Delivery ${deliveryId} not found - skipping`);
      return;
    }
    if (delivery.status === NotificationDeliveryStatus.DELIVERED) return;

    const { subscription } = delivery;
    if (!subscription || !subscription.isActive) {
      await this.prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: {
          status: NotificationDeliveryStatus.DEAD,
          attempts: { increment: 1 },
          lastError: 'Subscription is missing or inactive',
        },
      });
      return;
    }

    const rawBody = JSON.stringify(delivery.payload);
    const secret = decrypt(subscription.secret);
    const customHeaders = (subscription.headers ?? {}) as Record<
      string,
      string
    >;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(subscription.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            [OCTO_SIGNATURE_HEADER]: signNotification(rawBody, secret),
            [OCTO_NOTIFICATION_ID_HEADER]: delivery.id,
            ...customHeaders,
          },
          body: rawBody,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      await this.prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: {
          status: NotificationDeliveryStatus.DELIVERED,
          attempts: { increment: 1 },
          lastError: null,
          deliveredAt: new Date(),
        },
      });
      this.logger.log(`Delivery ${deliveryId} → ${subscription.url} OK`);
    } catch (err) {
      const message = (err as Error).message;
      const maxAttempts = job.opts.attempts ?? 1;
      const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;

      await this.prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: {
          status: isLastAttempt
            ? NotificationDeliveryStatus.DEAD
            : NotificationDeliveryStatus.FAILED,
          attempts: { increment: 1 },
          lastError: message.slice(0, 500),
        },
      });
      this.logger.warn(
        `Delivery ${deliveryId} failed (attempt ${job.attemptsMade + 1}/${maxAttempts}): ${message}`,
      );
      // Re-throw so BullMQ schedules the next backoff attempt (no-op once exhausted).
      throw err;
    }
  }
}
