// DEMO SEED — wishlists (saved tours per traveler) + OCTO notification
// subscriptions and a few delivery records.

import {
  NotificationDeliveryStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import {
  DEMO_TOUR_REF,
  DEMO_WEBHOOK_HOST,
  intBetween,
  log,
  prisma,
  rng,
  section,
} from './_shared';
import { loadDemoTravelers } from './users-operators';

export async function seedEngagement(): Promise<void> {
  section('Wishlists + notifications');

  const travelers = await loadDemoTravelers();
  const tours = await prisma.tour.findMany({ where: { reference: DEMO_TOUR_REF }, select: { id: true } });

  // ── Wishlists ──
  let wishlistCount = 0;
  for (const [i, t] of travelers.entries()) {
    const r = rng(7000 + i);
    const n = intBetween(r(), 2, 5);
    const picks = new Set<string>();
    while (picks.size < n && picks.size < tours.length) {
      picks.add(tours[Math.floor(r() * tours.length) % tours.length].id);
    }
    for (const tourId of picks) {
      await prisma.wishlist.upsert({
        where: { userId_tourId: { userId: t.id, tourId } },
        update: {},
        create: { userId: t.id, tourId },
      });
      wishlistCount++;
    }
  }

  // ── Notification subscriptions (platform-level + per operator) ──
  const operators = await prisma.operator.findMany({
    where: { user: { email: { endsWith: '@demo.islandtours.test' } } },
    select: { id: true },
  });

  const subscriptions: { operatorId: string | null; url: string }[] = [
    { operatorId: null, url: `https://${DEMO_WEBHOOK_HOST}/platform/octo` },
    ...operators.slice(0, 3).map((o, i) => ({ operatorId: o.id, url: `https://${DEMO_WEBHOOK_HOST}/operator-${i + 1}/octo` })),
  ];

  let subCount = 0;
  let deliveryCount = 0;
  for (const sub of subscriptions) {
    const existing = await prisma.notificationSubscription.findFirst({ where: { url: sub.url }, select: { id: true } });
    let subId: string;
    if (existing) {
      subId = existing.id;
    } else {
      const created = await prisma.notificationSubscription.create({
        data: {
          operatorId: sub.operatorId,
          url: sub.url,
          secret: 'demo_hmac_secret_not_real',
          notificationTypes: [NotificationType.BOOKING_UPDATE, NotificationType.AVAILABILITY_UPDATE, NotificationType.PRODUCT_UPDATE],
          headers: { 'X-Demo': 'true' } as Prisma.InputJsonValue,
          isActive: true,
        },
        select: { id: true },
      });
      subId = created.id;
      subCount++;
    }

    // A few deliveries across statuses (idempotent-ish: only add when none exist).
    const hasDeliveries = await prisma.notificationDelivery.findFirst({ where: { subscriptionId: subId }, select: { id: true } });
    if (!hasDeliveries) {
      const samples: { type: NotificationType; status: NotificationDeliveryStatus; lastError?: string }[] = [
        { type: NotificationType.BOOKING_UPDATE, status: NotificationDeliveryStatus.DELIVERED },
        { type: NotificationType.AVAILABILITY_UPDATE, status: NotificationDeliveryStatus.DELIVERED },
        { type: NotificationType.PRODUCT_UPDATE, status: NotificationDeliveryStatus.FAILED, lastError: 'Subscriber returned 503' },
        { type: NotificationType.BOOKING_UPDATE, status: NotificationDeliveryStatus.PENDING },
      ];
      for (const s of samples) {
        await prisma.notificationDelivery.create({
          data: {
            subscriptionId: subId,
            notificationType: s.type,
            payload: { subscriptionId: subId, notificationType: s.type, demo: true } as Prisma.InputJsonValue,
            status: s.status,
            attempts: s.status === NotificationDeliveryStatus.FAILED ? 3 : s.status === NotificationDeliveryStatus.DELIVERED ? 1 : 0,
            lastError: s.lastError ?? null,
            deliveredAt: s.status === NotificationDeliveryStatus.DELIVERED ? new Date() : null,
          },
        });
        deliveryCount++;
      }
    }
  }

  log(`Engagement: ${wishlistCount} wishlist saves, ${subCount} new subscriptions, ${deliveryCount} deliveries.`);
}
