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
  provisionInvitedAccount: jest.fn(),
  getAccountUrl: () => 'http://localhost:3001/account',
}));

import { ConflictException } from '@nestjs/common';
import { BookingStatus, Prisma, Role } from '@prisma/client';
import { auth } from '@/auth/auth.instance';
import { provisionInvitedAccount } from '@/common/utils/invite-provisioning.util';
import { CustomerProvisioningService } from './customer-provisioning.service';

const D = (v: string | number) => new Prisma.Decimal(v);

const BOOKING = {
  id: 'b1',
  operatorId: 'op1',
  contactEmail: 'Jane@Example.com',
  contactFullName: 'Jane Doe',
  contactFirstName: 'Jane',
};

describe('CustomerProvisioningService', () => {
  let prisma: any;
  let limiter: any;
  let svc: CustomerProvisioningService;
  const provisionMock = provisionInvitedAccount as jest.Mock;
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
    svc = new CustomerProvisioningService(prisma, limiter);
    provisionMock.mockResolvedValue({
      email: 'jane@example.com',
      user: { id: 'u1' },
      authCtx: {},
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
    // unowned ones, and ones mis-stamped with an ops account at checkout.
    // A booking already owned by another CUSTOMER is never stolen.
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: {
        contactEmail: { equals: 'jane@example.com', mode: 'insensitive' },
        OR: [{ userId: null }, { user: { role: { not: Role.USER } } }],
      },
      data: { userId: 'u1' },
    });
    expect(prisma.customer.upsert).toHaveBeenCalledTimes(1);
  });

  it('recomputes only the booking operator when the backfill linked nothing extra', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      role: Role.USER,
      hasPassword: true,
    });
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
  });

  it('fans out to every operator the customer has booked when the backfill linked past bookings', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      role: Role.USER,
      hasPassword: true,
    });
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

  it('skips entirely when the email belongs to a non-USER account', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'op-user',
      role: Role.TOUR_OPERATOR,
      hasPassword: true,
    });

    await svc.provisionForBooking(BOOKING);

    expect(provisionMock).not.toHaveBeenCalled();
    expect(resetMock).not.toHaveBeenCalled();
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    expect(prisma.customer.upsert).not.toHaveBeenCalled();
  });

  it('links without any email for an existing USER who already set a password', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      role: Role.USER,
      hasPassword: true,
    });

    await svc.provisionForBooking(BOOKING);

    expect(provisionMock).not.toHaveBeenCalled();
    expect(resetMock).not.toHaveBeenCalled();
    expect(prisma.booking.updateMany).toHaveBeenCalled();
  });

  it('re-sends the set-password link (capped) when the USER never set one', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      role: Role.USER,
      hasPassword: false,
    });

    await svc.provisionForBooking(BOOKING);

    expect(limiter.consume).toHaveBeenCalledWith(
      'customer-welcome',
      'jane@example.com',
      [{ max: 1, windowMs: 24 * 60 * 60 * 1000 }],
    );
    expect(resetMock).toHaveBeenCalledTimes(1);
  });

  it('stays silent when the resend cap is hit', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      role: Role.USER,
      hasPassword: false,
    });
    limiter.consume.mockImplementation(() => {
      throw new Error('429');
    });

    await svc.provisionForBooking(BOOKING);

    expect(resetMock).not.toHaveBeenCalled();
    // Linking still happens - only the email is capped.
    expect(prisma.booking.updateMany).toHaveBeenCalled();
  });

  it('survives the create race (ConflictException) by refetching, no second welcome', async () => {
    prisma.user.findFirst
      .mockResolvedValueOnce(null) // initial lookup
      .mockResolvedValueOnce({ id: 'u1', role: Role.USER, hasPassword: false }); // refetch after conflict
    provisionMock.mockRejectedValue(new ConflictException('exists'));

    await svc.provisionForBooking(BOOKING);

    expect(resetMock).not.toHaveBeenCalled(); // the racing winner sent it
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { userId: 'u1' } }),
    );
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
