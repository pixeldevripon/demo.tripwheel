import * as fs from 'fs';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import {
  InboxCategory,
  InboxEvent,
  Permission,
  Role,
  StaffStatus,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { StaffPermissionsService } from '@/staff/staff-permissions.service';
import { INBOX_EVENTS } from './inbox-events';
import { InboxService } from './inbox.service';

/**
 * The fan-out is the only part of this module with real logic, and every bug it
 * can have is a privacy bug: notifying the wrong operator, or notifying a seat
 * that cannot open the page it links to.
 */
describe('InboxService', () => {
  let service: InboxService;
  let prisma: {
    user: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    inboxNotification: {
      createMany: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      groupBy: jest.Mock;
      updateMany: jest.Mock;
      deleteMany: jest.Mock;
      count: jest.Mock;
    };
  };
  let staffPermissions: { hasPermissions: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      inboxNotification: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        groupBy: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    // Grants everything unless a test says otherwise.
    staffPermissions = {
      hasPermissions: jest.fn().mockResolvedValue({ granted: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InboxService,
        { provide: PrismaService, useValue: prisma },
        { provide: StaffPermissionsService, useValue: staffPermissions },
      ],
    }).compile();
    service = module.get(InboxService);
  });

  // ── The registry ───────────────────────────────────────────────────────────

  /**
   * A registry entry that names a permission nobody can hold, or a category the
   * sidebar cannot badge, fails silently at runtime - the fan-out just writes
   * zero rows and nothing ever reports it.
   */
  it('registers every InboxEvent with a real permission and category', () => {
    for (const event of Object.values(InboxEvent)) {
      const definition = INBOX_EVENTS[event];
      expect(definition).toBeDefined();
      expect(Object.values(Permission)).toContain(definition.permission);
      expect(Object.values(InboxCategory)).toContain(definition.category);
      expect(['platform', 'operator', 'both']).toContain(definition.audience);
    }
  });

  /**
   * Every registered event must actually be emitted by something.
   *
   * A registry entry with no call site is a promise the product does not keep:
   * it reads as "we notify you about this" in the one file anyone consults,
   * while the bell stays empty forever. This walks the source rather than
   * trusting review, because the gap is invisible at every other layer - it
   * compiles, it passes, it just never fires.
   */
  it('emits every registered event from a real call site', () => {
    const root = path.join(__dirname, '..');
    const emitted = new Set<string>();

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules') walk(full);
          continue;
        }
        if (!entry.name.endsWith('.ts') || entry.name.endsWith('.spec.ts')) {
          continue;
        }
        // The registry and the service itself only REFERENCE the enum.
        if (full.includes(`${path.sep}inbox${path.sep}`)) continue;
        for (const match of fs
          .readFileSync(full, 'utf8')
          .matchAll(/InboxEvent\.([A-Z_]+)/g)) {
          emitted.add(match[1]);
        }
      }
    };
    walk(root);

    const registered = Object.values(InboxEvent) as string[];
    const unwired = registered.filter((e) => !emitted.has(e));
    expect(unwired).toEqual([]);
  });

  // ── Audience resolution ────────────────────────────────────────────────────

  it('writes one row per recipient of a platform event', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'admin-1', role: Role.ADMIN },
      { id: 'staff-1', role: Role.STAFF },
    ]);

    const count = await service.fanOut({
      event: InboxEvent.TOUR_SUBMITTED_FOR_REVIEW,
      operatorId: 'op-1',
      title: 'A tour was submitted',
      url: '/trips/t1/edit?step=review',
      entityId: 't1',
    });

    const call = prisma.inboxNotification.createMany.mock.calls[0][0];
    expect(call.data).toHaveLength(2);
    expect(call.data.map((d: { userId: string }) => d.userId)).toEqual([
      'admin-1',
      'staff-1',
    ]);
    expect(call.skipDuplicates).toBe(true);
    expect(count).toBe(0); // the mock's reported count, not the input length
  });

  it('asks only for ACTIVE platform seats, never suspended or invited ones', async () => {
    await service.fanOut({
      event: InboxEvent.TOUR_SUBMITTED_FOR_REVIEW,
      operatorId: 'op-1',
      title: 'x',
      url: '/x',
    });

    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.status).toBe(UserStatus.ACTIVE);
    expect(where.OR).toContainEqual({
      role: Role.STAFF,
      staffMember: { operatorId: null, status: StaffStatus.ACTIVE },
    });
  });

  it('scopes an operator event to that operator, owner and team alike', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'owner-1', role: Role.TOUR_OPERATOR },
    ]);

    await service.fanOut({
      event: InboxEvent.BOOKING_CONFIRMED,
      operatorId: 'op-7',
      title: 'New booking',
      url: '/bookings',
    });

    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { operator: { id: 'op-7' } },
      { staffMember: { operatorId: 'op-7', status: StaffStatus.ACTIVE } },
    ]);
  });

  /**
   * The failure mode this prevents is the worst one available: broadcasting one
   * operator's booking to every operator on the platform.
   */
  it('drops an operator-scoped event that arrives with no operator', async () => {
    const count = await service.fanOut({
      event: InboxEvent.BOOKING_CONFIRMED,
      title: 'New booking',
      url: '/bookings',
    });

    expect(count).toBe(0);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.inboxNotification.createMany).not.toHaveBeenCalled();
  });

  it('reaches both sides for a dual-audience event, each person once', async () => {
    // The same account appears in both candidate lists - an admin who also
    // owns an operator. It must produce ONE row, not two.
    prisma.user.findMany
      .mockResolvedValueOnce([
        { id: 'admin-1', role: Role.ADMIN },
        { id: 'both-hats', role: Role.ADMIN },
      ])
      .mockResolvedValueOnce([
        { id: 'owner-1', role: Role.TOUR_OPERATOR },
        { id: 'both-hats', role: Role.ADMIN },
      ]);

    await service.fanOut({
      event: InboxEvent.TIER_DEMOTED,
      operatorId: 'op-1',
      title: 'A tour was demoted',
      url: '/trips',
    });

    const ids = prisma.inboxNotification.createMany.mock.calls[0][0].data.map(
      (d: { userId: string }) => d.userId,
    );
    expect(ids).toEqual(['admin-1', 'both-hats', 'owner-1']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('drops a dual-audience event that arrives with no operator', async () => {
    const count = await service.fanOut({
      event: InboxEvent.TIER_DEMOTED,
      title: 'x',
      url: '/x',
    });
    expect(count).toBe(0);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  // ── Entitlement ────────────────────────────────────────────────────────────

  it('excludes anyone without the permission that gates the linked page', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'owner-1', role: Role.TOUR_OPERATOR },
      { id: 'guide-1', role: Role.TOUR_OPERATOR },
    ]);
    // The guide seat lacks VIEW_BOOKING_FINANCIALS (conflict #7).
    staffPermissions.hasPermissions.mockImplementation((user: { id: string }) =>
      Promise.resolve({ granted: user.id !== 'guide-1' }),
    );

    await service.fanOut({
      event: InboxEvent.SETTLEMENT_STATEMENT_READY,
      operatorId: 'op-1',
      title: 'Payout marked as paid - USD 240',
      url: '/settlements',
    });

    const call = prisma.inboxNotification.createMany.mock.calls[0][0];
    expect(call.data).toHaveLength(1);
    expect(call.data[0].userId).toBe('owner-1');
    expect(staffPermissions.hasPermissions).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'owner-1' }),
      [Permission.VIEW_BOOKING_FINANCIALS],
    );
  });

  it('writes nothing when nobody is entitled', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'guide-1', role: Role.TOUR_OPERATOR },
    ]);
    staffPermissions.hasPermissions.mockResolvedValue({ granted: false });

    const count = await service.fanOut({
      event: InboxEvent.SETTLEMENT_STATEMENT_READY,
      operatorId: 'op-1',
      title: 'x',
      url: '/settlements',
    });

    expect(count).toBe(0);
    expect(prisma.inboxNotification.createMany).not.toHaveBeenCalled();
  });

  it('never notifies the actor about their own action', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'admin-1', role: Role.ADMIN },
      { id: 'admin-2', role: Role.ADMIN },
    ]);

    await service.fanOut({
      event: InboxEvent.TOUR_SUBMITTED_FOR_REVIEW,
      operatorId: 'op-1',
      title: 'x',
      url: '/x',
      actorUserId: 'admin-1',
    });

    const call = prisma.inboxNotification.createMany.mock.calls[0][0];
    expect(call.data).toHaveLength(1);
    expect(call.data[0].userId).toBe('admin-2');
  });

  // ── Idempotency ────────────────────────────────────────────────────────────

  it('derives a dedupe key from the event and entity by default', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'u1', role: Role.ADMIN }]);

    await service.fanOut({
      event: InboxEvent.REVIEW_SUBMITTED,
      operatorId: 'op-1',
      title: 'x',
      url: '/reviews',
      entityId: 'rev-9',
    });

    expect(
      prisma.inboxNotification.createMany.mock.calls[0][0].data[0],
    ).toEqual(expect.objectContaining({ dedupeKey: 'REVIEW_SUBMITTED:rev-9' }));
  });

  it('honours an explicit dedupe key so a resubmission is its own notification', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'u1', role: Role.ADMIN }]);

    await service.fanOut({
      event: InboxEvent.TOUR_SUBMITTED_FOR_REVIEW,
      operatorId: 'op-1',
      title: 'x',
      url: '/x',
      entityId: 't1',
      dedupeKey: 'TOUR_SUBMITTED_FOR_REVIEW:t1:2026-07-29T10:00:00.000Z',
    });

    expect(
      prisma.inboxNotification.createMany.mock.calls[0][0].data[0],
    ).toEqual(
      expect.objectContaining({
        dedupeKey: 'TOUR_SUBMITTED_FOR_REVIEW:t1:2026-07-29T10:00:00.000Z',
      }),
    );
  });

  // ── notify() is fire-and-forget ────────────────────────────────────────────

  it('swallows a fan-out failure so it can never roll back the caller', async () => {
    prisma.user.findMany.mockRejectedValue(new Error('database is down'));

    expect(() =>
      service.notify({
        event: InboxEvent.TOUR_APPROVED,
        operatorId: 'op-1',
        title: 'x',
        url: '/x',
      }),
    ).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
  });

  // ── Read surface ───────────────────────────────────────────────────────────

  it('summarises the bell and the badges from one grouped count', async () => {
    prisma.inboxNotification.groupBy.mockResolvedValue([
      { category: InboxCategory.TOURS, _count: { _all: 2 } },
      { category: InboxCategory.BOOKINGS, _count: { _all: 3 } },
    ]);

    const summary = await service.summary('u1');

    // The bell is the sum of the badges, by construction - they cannot drift.
    expect(summary.unread).toBe(5);
    expect(summary.byCategory).toEqual({ TOURS: 2, BOOKINGS: 3 });
  });

  it('pages with a keyset cursor and reports the next one', async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      id: `n${i}`,
      createdAt: new Date(`2026-07-2${9 - i}T00:00:00.000Z`),
    }));
    prisma.inboxNotification.findMany.mockResolvedValue(rows);

    const page = await service.list('u1', { limit: 2 });

    // Asked for one more than the page size to detect "hasMore" without a count.
    expect(prisma.inboxNotification.findMany.mock.calls[0][0].take).toBe(3);
    expect(page.data).toHaveLength(2);
    expect(page.nextCursor).toBe(rows[1].createdAt.toISOString());
  });

  it('returns a null cursor on the last page', async () => {
    prisma.inboxNotification.findMany.mockResolvedValue([
      { id: 'n1', createdAt: new Date('2026-07-29T00:00:00.000Z') },
    ]);

    const page = await service.list('u1', { limit: 2 });
    expect(page.nextCursor).toBeNull();
  });

  it('changes nothing when mark-read is asked for nothing', async () => {
    const result = await service.markRead('u1', {});
    expect(result.updated).toBe(0);
    expect(prisma.inboxNotification.updateMany).not.toHaveBeenCalled();
  });

  it('always scopes mark-read to the caller, even when given ids', async () => {
    await service.markRead('u1', { ids: ['someone-elses-row'] });

    expect(prisma.inboxNotification.updateMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ userId: 'u1' }),
    );
  });

  // ── Clear / dismiss ────────────────────────────────────────────────────────

  it('deletes nothing when clear is asked for nothing', async () => {
    const result = await service.clear('u1', {});
    expect(result.deleted).toBe(0);
    expect(prisma.inboxNotification.deleteMany).not.toHaveBeenCalled();
  });

  it('clears the whole inbox only when explicitly told to', async () => {
    prisma.inboxNotification.deleteMany.mockResolvedValue({ count: 7 });

    const result = await service.clear('u1', { all: true });

    expect(prisma.inboxNotification.deleteMany.mock.calls[0][0].where).toEqual({
      userId: 'u1',
    });
    expect(result.deleted).toBe(7);
  });

  it('restricts the safe sweep to rows already read', async () => {
    await service.clear('u1', { all: true, onlyRead: true });

    expect(prisma.inboxNotification.deleteMany.mock.calls[0][0].where).toEqual({
      userId: 'u1',
      readAt: { not: null },
    });
  });

  it('clears one category without touching the rest', async () => {
    await service.clear('u1', { category: InboxCategory.BOOKINGS });

    expect(prisma.inboxNotification.deleteMany.mock.calls[0][0].where).toEqual({
      userId: 'u1',
      category: InboxCategory.BOOKINGS,
    });
  });

  it('scopes a single dismiss to the caller so a stranger id deletes nothing', async () => {
    prisma.inboxNotification.deleteMany.mockResolvedValue({ count: 0 });

    const result = await service.remove('u1', 'someone-elses-row');

    expect(prisma.inboxNotification.deleteMany.mock.calls[0][0].where).toEqual({
      id: 'someone-elses-row',
      userId: 'u1',
    });
    // 0, not a 404: a 404 would confirm the row exists for somebody.
    expect(result.deleted).toBe(0);
  });

  // ── Digest ─────────────────────────────────────────────────────────────────

  it('only returns what arrived since the last digest, then stamps the marker', async () => {
    const lastShown = new Date('2026-07-28T00:00:00.000Z');
    prisma.user.findUnique.mockResolvedValue({ inboxDigestShownAt: lastShown });
    prisma.inboxNotification.findMany.mockResolvedValue([{ id: 'n1' }]);
    prisma.inboxNotification.count.mockResolvedValue(4);

    const digest = await service.digest('u1');

    expect(prisma.inboxNotification.findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ createdAt: { gt: lastShown } }),
    );
    expect(digest.unread).toBe(4);
    expect(prisma.user.update).toHaveBeenCalled();
  });

  /**
   * Stamping on an empty digest would swallow anything that lands in the same
   * second - the operator would never be shown it.
   */
  it('does not stamp the marker when there was nothing to show', async () => {
    prisma.inboxNotification.findMany.mockResolvedValue([]);

    const digest = await service.digest('u1');

    expect(digest.data).toHaveLength(0);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
