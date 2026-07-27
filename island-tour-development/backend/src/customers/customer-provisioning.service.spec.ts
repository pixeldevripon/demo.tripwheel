// Mock the Better Auth singleton so the ESM `better-auth` package is never
// loaded in the unit test (same approach as staff/operators specs). The
// provisioning util is mocked too - its own behavior is covered by the
// staff/operator invite specs; here we assert WHEN it is called.
jest.mock('@/auth/auth.instance', () => ({
  auth: {
    $context: Promise.resolve({}),
    api: { requestPasswordReset: jest.fn().mockResolvedValue(undefined) },
  },
}));
jest.mock('@/common/utils/invite-provisioning.util', () => ({
  provisionOrAttachAccount: jest.fn(),
  getAccountUrl: () => 'http://localhost:3001/account',
}));

import { ConflictException } from '@nestjs/common';
import { BookingStatus, Prisma, Role } from '@prisma/client';
import { auth } from '@/auth/auth.instance';
import { provisionOrAttachAccount } from '@/common/utils/invite-provisioning.util';
import { CustomerProvisioningService } from './customer-provisioning.service';

const D = (v: string | number) => new Prisma.Decimal(v);

const BOOKING = {
  id: 'b1',
  operatorId: 'op1',
  contactEmail: 'Jane@Example.com',
  contactFullName: 'Jane Doe',
  contactFirstName: 'Jane',
};

/** findFirst payload shape the service selects. */
const userRow = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'u1',
  role: Role.USER,
  hasPassword: true,
  isSystemAccount: false,
  customerOf: [{ id: 'c1' }],
  ...over,
});

describe('CustomerProvisioningService', () => {
  let prisma: any;
  let limiter: any;
  let staffPermissions: any;
  let svc: CustomerProvisioningService;
  const provisionMock = provisionOrAttachAccount as jest.Mock;
  const resetMock = auth.api.requestPasswordReset as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      user: { findFirst: jest.fn() },
      booking: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([{ operatorId: 'op1' }]),
        aggregate: jest.fn().mockResolvedValue({
          _count: { _all: 2 },
          _sum: { totalEur: D('150.00') },
          _min: { utcConfirmedAt: new Date('2026-01-01T00:00:00Z') },
          _max: { utcConfirmedAt: new Date('2026-06-01T00:00:00Z') },
        }),
      },
      customer: { upsert: jest.fn().mockResolvedValue({}) },
    };
    limiter = { consume: jest.fn() };
    staffPermissions = { invalidate: jest.fn() };
    svc = new CustomerProvisioningService(prisma, limiter, staffPermissions);
    provisionMock.mockResolvedValue({
      email: 'jane@example.com',
      user: { id: 'u1' },
      authCtx: {},
      created: true,
      hadPassword: false,
      priorRole: Role.USER,
    });
  });

  it('creates a USER account, sends ONE welcome link, backfills and aggregates', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await svc.provisionForBooking(BOOKING);

    expect(provisionMock).toHaveBeenCalledWith(prisma, {
      email: 'jane@example.com',
      name: 'Jane Doe',
      role: Role.USER,
    });
    expect(resetMock).toHaveBeenCalledTimes(1);
    expect(resetMock).toHaveBeenCalledWith({
      body: {
        email: 'jane@example.com',
        redirectTo: 'http://localhost:3001/account/reset',
      },
    });
    // Backfill claims THIS + every past booking with the same contact email:
    // unowned ones, and ones mis-stamped at checkout with a DIFFERENT account
    // whose email is not the contact email. A booking correctly owned by the
    // account whose email IS the contact email is never re-stamped.
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: {
        contactEmail: { equals: 'jane@example.com', mode: 'insensitive' },
        OR: [
          { userId: null },
          {
            userId: { not: 'u1' },
            user: {
              email: {
                not: { equals: 'jane@example.com' },
                mode: 'insensitive',
              },
            },
          },
        ],
      },
      data: { userId: 'u1' },
    });
    expect(prisma.customer.upsert).toHaveBeenCalledTimes(1);
    // First customer hat -> effective-permission cache dropped.
    expect(staffPermissions.invalidate).toHaveBeenCalledWith('u1');
  });

  it('recomputes only the booking operator when the backfill linked nothing extra', async () => {
    prisma.user.findFirst.mockResolvedValue(userRow());
    prisma.booking.updateMany.mockResolvedValue({ count: 1 });

    await svc.provisionForBooking(BOOKING);

    // Steady state: no fan-out query, one upsert for THIS booking's operator.
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
    expect(prisma.customer.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.booking.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'u1', operatorId: 'op1' }),
      }),
    );
    // Already had customer rows - no cache churn.
    expect(staffPermissions.invalidate).not.toHaveBeenCalled();
  });

  it('fans out to every operator the customer has booked when the backfill linked past bookings', async () => {
    prisma.user.findFirst.mockResolvedValue(userRow());
    prisma.booking.updateMany.mockResolvedValue({ count: 3 });
    prisma.booking.findMany.mockResolvedValue([
      { operatorId: 'op1' },
      { operatorId: 'op2' },
    ]);

    await svc.provisionForBooking(BOOKING);

    expect(prisma.booking.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      select: { operatorId: true },
      distinct: ['operatorId'],
    });
    // One recompute per distinct operator, not one per linked booking.
    expect(prisma.customer.upsert).toHaveBeenCalledTimes(2);
    const operatorsRecomputed = prisma.booking.aggregate.mock.calls.map(
      ([args]: [any]) => args.where.operatorId,
    );
    expect(operatorsRecomputed).toEqual(['op1', 'op2']);
  });

  it('does nothing at all without a contact email', async () => {
    await svc.provisionForBooking({ ...BOOKING, contactEmail: null });
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(provisionMock).not.toHaveBeenCalled();
  });

  it('skips entirely when the email belongs to the hidden system account', async () => {
    prisma.user.findFirst.mockResolvedValue(
      userRow({ id: 'sys', role: Role.ADMIN, isSystemAccount: true }),
    );

    await svc.provisionForBooking(BOOKING);

    expect(provisionMock).not.toHaveBeenCalled();
    expect(resetMock).not.toHaveBeenCalled();
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    expect(prisma.customer.upsert).not.toHaveBeenCalled();
  });

  it('attaches the customer hat to a staff/operator account: links + aggregates, NO welcome email', async () => {
    prisma.user.findFirst.mockResolvedValue(
      userRow({ id: 'staff-u', role: Role.STAFF, customerOf: [] }),
    );

    await svc.provisionForBooking(BOOKING);

    expect(provisionMock).not.toHaveBeenCalled();
    expect(resetMock).not.toHaveBeenCalled();
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { userId: 'staff-u' } }),
    );
    expect(prisma.customer.upsert).toHaveBeenCalledTimes(1);
    // First customer hat on a staff account -> USER perms union kicks in now.
    expect(staffPermissions.invalidate).toHaveBeenCalledWith('staff-u');
  });

  it('never re-mails a customer welcome to a passwordless NON-USER account', async () => {
    prisma.user.findFirst.mockResolvedValue(
      userRow({
        id: 'staff-u',
        role: Role.STAFF,
        hasPassword: false,
        customerOf: [],
      }),
    );

    await svc.provisionForBooking(BOOKING);

    expect(resetMock).not.toHaveBeenCalled();
    expect(limiter.consume).not.toHaveBeenCalled();
    expect(prisma.booking.updateMany).toHaveBeenCalled();
  });

  it('links without any email for an existing USER who already set a password', async () => {
    prisma.user.findFirst.mockResolvedValue(userRow());

    await svc.provisionForBooking(BOOKING);

    expect(provisionMock).not.toHaveBeenCalled();
    expect(resetMock).not.toHaveBeenCalled();
    expect(prisma.booking.updateMany).toHaveBeenCalled();
  });

  it('re-sends the set-password link (capped) when the USER never set one', async () => {
    prisma.user.findFirst.mockResolvedValue(userRow({ hasPassword: false }));

    await svc.provisionForBooking(BOOKING);

    expect(limiter.consume).toHaveBeenCalledWith(
      'customer-welcome',
      'jane@example.com',
      [{ max: 1, windowMs: 24 * 60 * 60 * 1000 }],
    );
    expect(resetMock).toHaveBeenCalledTimes(1);
  });

  it('stays silent when the resend cap is hit', async () => {
    prisma.user.findFirst.mockResolvedValue(userRow({ hasPassword: false }));
    limiter.consume.mockImplementation(() => {
      throw new Error('429');
    });

    await svc.provisionForBooking(BOOKING);

    expect(resetMock).not.toHaveBeenCalled();
    // Linking still happens - only the email is capped.
    expect(prisma.booking.updateMany).toHaveBeenCalled();
  });

  it('skips the welcome email when the create race resolved to an attach', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    provisionMock.mockResolvedValue({
      email: 'jane@example.com',
      user: { id: 'u1' },
      authCtx: {},
      created: false, // someone else created it between lookup and create
      hadPassword: false,
      priorRole: Role.USER,
    });

    await svc.provisionForBooking(BOOKING);

    expect(resetMock).not.toHaveBeenCalled(); // the racing winner sent it
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { userId: 'u1' } }),
    );
  });

  it('bails out silently when provisioning hits the system-account conflict', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    provisionMock.mockRejectedValue(new ConflictException('exists'));

    await svc.provisionForBooking(BOOKING);

    expect(resetMock).not.toHaveBeenCalled();
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it('never throws - booking flow is protected from provisioning failures', async () => {
    prisma.user.findFirst.mockRejectedValue(new Error('db down'));
    await expect(svc.provisionForBooking(BOOKING)).resolves.toBeUndefined();
  });

  describe('recomputeAggregates', () => {
    it('upserts the (user x operator) row from CONFIRMED+REDEEMED bookings', async () => {
      await svc.recomputeAggregates('u1', 'op1');

      expect(prisma.booking.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'u1',
            operatorId: 'op1',
            status: { in: [BookingStatus.CONFIRMED, BookingStatus.REDEEMED] },
          },
        }),
      );
      expect(prisma.customer.upsert).toHaveBeenCalledWith({
        where: { userId_operatorId: { userId: 'u1', operatorId: 'op1' } },
        create: expect.objectContaining({
          userId: 'u1',
          operatorId: 'op1',
          bookingsCount: 2,
          totalSpendEur: D('150.00'),
        }),
        update: expect.objectContaining({ bookingsCount: 2 }),
      });
    });

    it('never throws on aggregate failure', async () => {
      prisma.booking.aggregate.mockRejectedValue(new Error('boom'));
      await expect(
        svc.recomputeAggregates('u1', 'op1'),
      ).resolves.toBeUndefined();
    });
  });
});
