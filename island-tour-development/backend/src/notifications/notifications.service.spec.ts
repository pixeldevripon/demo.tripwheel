import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationType, Role } from '@prisma/client';
import { decrypt } from '@/common/utils/crypto.util';
import { NotificationsService } from './notifications.service';

function mockPrisma() {
  return {
    notificationSubscription: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    notificationDelivery: {
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    operator: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  } as any;
}

function mockQueue() {
  return { add: jest.fn().mockResolvedValue(undefined) } as any;
}

const ADMIN = { id: 'admin1', role: Role.ADMIN };
const OPERATOR = { id: 'u1', role: Role.TOUR_OPERATOR };

function subRow(over: Record<string, unknown> = {}) {
  return {
    id: 'sub1',
    operatorId: null,
    url: 'https://reseller.example.com/webhook',
    notificationTypes: [NotificationType.AVAILABILITY_UPDATE],
    headers: {},
    isActive: true,
    createdAt: new Date('2026-06-21T00:00:00.000Z'),
    updatedAt: new Date('2026-06-21T00:00:00.000Z'),
    ...over,
  };
}

describe('NotificationsService', () => {
  let prisma: any;
  let queue: any;
  let svc: NotificationsService;

  beforeEach(() => {
    prisma = mockPrisma();
    queue = mockQueue();
    svc = new NotificationsService(prisma, queue);
  });

  describe('create', () => {
    it('generates + encrypts a secret and returns the plaintext once (admin → platform)', async () => {
      prisma.notificationSubscription.create.mockResolvedValue(subRow());

      const res = await svc.create(
        {
          url: 'https://reseller.example.com/webhook',
          notificationTypes: [NotificationType.AVAILABILITY_UPDATE],
        },
        ADMIN,
      );

      expect(res.secret).toMatch(/^[0-9a-f]{64}$/);
      expect(res.operatorId).toBeNull();
      const data = prisma.notificationSubscription.create.mock.calls[0][0].data;
      expect(data.operatorId).toBeNull(); // admin → platform-level
      expect(data.secret).not.toBe(res.secret); // stored encrypted
      expect(decrypt(data.secret)).toBe(res.secret); // decrypts back to the plaintext
    });

    it('scopes an operator subscription to their own operator id', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      prisma.notificationSubscription.create.mockResolvedValue(
        subRow({ operatorId: 'op1' }),
      );

      await svc.create(
        {
          url: 'https://x.io/hook',
          notificationTypes: [NotificationType.PRODUCT_UPDATE],
          secret: 'caller-secret',
        },
        OPERATOR,
      );

      const data = prisma.notificationSubscription.create.mock.calls[0][0].data;
      expect(data.operatorId).toBe('op1');
      expect(decrypt(data.secret)).toBe('caller-secret'); // caller-supplied secret honored
    });
  });

  describe('emit', () => {
    it('creates a delivery row + enqueues a job per matching subscription', async () => {
      prisma.notificationSubscription.findMany.mockResolvedValue([
        { id: 'sub1' },
        { id: 'sub2' },
      ]);
      prisma.notificationDelivery.create
        .mockResolvedValueOnce({ id: 'd1' })
        .mockResolvedValueOnce({ id: 'd2' });
      prisma.notificationDelivery.update.mockResolvedValue({});

      await svc.emit(
        NotificationType.AVAILABILITY_UPDATE,
        { productId: 't1' },
        { operatorId: 'op1' },
      );

      expect(prisma.notificationDelivery.create).toHaveBeenCalledTimes(2);
      expect(queue.add).toHaveBeenCalledTimes(2);
      // job carries the delivery id as jobId (subscriber idempotency)
      expect(queue.add.mock.calls[0][1]).toEqual({ deliveryId: 'd1' });
      expect(queue.add.mock.calls[0][2]).toMatchObject({
        jobId: 'd1',
        attempts: 5,
      });
      // operator-scoped emit widens to platform OR the operator's own subscriptions
      const where =
        prisma.notificationSubscription.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([{ operatorId: null }, { operatorId: 'op1' }]);
    });

    it('no-ops with no matching subscriptions', async () => {
      prisma.notificationSubscription.findMany.mockResolvedValue([]);
      await svc.emit(NotificationType.BOOKING_UPDATE, { uuid: 'p1' });
      expect(prisma.notificationDelivery.create).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('swallows errors so the originating write is never broken', async () => {
      prisma.notificationSubscription.findMany.mockRejectedValue(
        new Error('db down'),
      );
      await expect(
        svc.emit(NotificationType.PRODUCT_UPDATE, { productId: 't1' }),
      ).resolves.toBeUndefined();
    });

    it('emitAvailabilityUpdate only includes optionId/localDate when present', () => {
      const spy = jest.spyOn(svc, 'emit').mockResolvedValue(undefined);
      svc.emitAvailabilityUpdate({ tourId: 't1', operatorId: 'op1' });
      expect(spy).toHaveBeenCalledWith(
        NotificationType.AVAILABILITY_UPDATE,
        { productId: 't1' },
        { operatorId: 'op1' },
      );
      svc.emitAvailabilityUpdate({
        tourId: 't1',
        optionId: 'opt1',
        localDate: '2026-07-01',
        operatorId: 'op1',
      });
      expect(spy).toHaveBeenLastCalledWith(
        NotificationType.AVAILABILITY_UPDATE,
        { productId: 't1', optionId: 'opt1', localDate: '2026-07-01' },
        { operatorId: 'op1' },
      );
    });
  });

  describe('ownership', () => {
    it('blocks an operator from reading another operator’s subscription', async () => {
      prisma.notificationSubscription.findUnique.mockResolvedValue(
        subRow({ operatorId: 'op2' }),
      );
      prisma.operator.findUnique.mockResolvedValue({ id: 'op1' });
      await expect(svc.getById('sub1', OPERATOR)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('lets an admin read any subscription', async () => {
      prisma.notificationSubscription.findUnique.mockResolvedValue(
        subRow({ operatorId: 'op2' }),
      );
      const res = await svc.getById('sub1', ADMIN);
      expect(res.id).toBe('sub1');
    });

    it('404s a missing subscription', async () => {
      prisma.notificationSubscription.findUnique.mockResolvedValue(null);
      await expect(svc.getById('nope', ADMIN)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('deletes an owned subscription', async () => {
      prisma.notificationSubscription.findUnique.mockResolvedValue(subRow());
      prisma.notificationSubscription.delete.mockResolvedValue({});
      const res = await svc.remove('sub1', ADMIN);
      expect(res).toEqual({ id: 'sub1', deleted: true });
    });
  });
});
