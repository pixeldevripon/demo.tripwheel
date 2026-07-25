import {
  BookingStatus,
  PaymentModel,
  Prisma,
  Role,
  SettlementStatus,
} from '@prisma/client';
import { SettlementsService } from './settlements.service';

const D = (v: string) => new Prisma.Decimal(v);

function mockPrisma(): any {
  return {
    settlement: {
      findMany: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn(),
    },
    // Array form used by list(); run the queued promises.
    $transaction: jest.fn((arg: unknown) =>
      Promise.all(arg as Promise<unknown>[]),
    ),
  };
}

describe('SettlementsService', () => {
  let prisma: any;
  let svc: SettlementsService;

  beforeEach(() => {
    prisma = mockPrisma();
    svc = new SettlementsService(prisma);
  });

  // A paid_in_full net owed to the operator; 2020 tour => clawback window long closed.
  const candidate = (over: Record<string, unknown> = {}) => ({
    id: 's1',
    netPosition: D('80'),
    paymentModel: PaymentModel.PAID_IN_FULL,
    status: SettlementStatus.RECORDED,
    booking: {
      displayRef: 'IT-1',
      status: BookingStatus.CONFIRMED,
      tourStartDateTime: new Date('2020-01-01T09:00:00.000Z'),
      tourTimeZone: 'UTC',
      utcCancellationRequestedAt: null,
      utcCancelledAt: null,
      tour: { cancellationHours: 48 },
    },
    ...over,
  });

  describe('releaseEligiblePayouts', () => {
    it('releases a paid_in_full net past its clawback window (RECORDED -> PAID_OUT)', async () => {
      prisma.settlement.findMany.mockResolvedValue([candidate()]);

      const released = await svc.releaseEligiblePayouts();

      expect(released).toBe(1);
      const arg = prisma.settlement.updateMany.mock.calls[0][0];
      // Guarded flip, idempotent on still-RECORDED.
      expect(arg.where).toEqual({
        id: 's1',
        status: SettlementStatus.RECORDED,
      });
      expect(arg.data.status).toBe(SettlementStatus.PAID_OUT);
      expect(arg.data.operatorPayout.toString()).toBe('80');
      expect(arg.data.settledAt).toBeInstanceOf(Date);
    });

    it('does NOT release while the clawback window is still open (future tour)', async () => {
      prisma.settlement.findMany.mockResolvedValue([
        candidate({
          booking: {
            displayRef: 'IT-1',
            status: BookingStatus.CONFIRMED,
            tourStartDateTime: new Date('2999-01-01T09:00:00.000Z'),
            tourTimeZone: 'UTC',
            tour: { cancellationHours: 48 },
          },
        }),
      ]);

      const released = await svc.releaseEligiblePayouts();

      expect(released).toBe(0);
      expect(prisma.settlement.updateMany).not.toHaveBeenCalled();
    });

    it('does NOT release a settlement whose booking is no longer standing', async () => {
      // The DB `where` already excludes non-standing bookings, but the in-memory
      // guard is the backstop: a cancelled booking must never pay out.
      prisma.settlement.findMany.mockResolvedValue([
        candidate({
          booking: {
            displayRef: 'IT-1',
            status: BookingStatus.CANCELLED,
            tourStartDateTime: new Date('2020-01-01T09:00:00.000Z'),
            tourTimeZone: 'UTC',
            tour: { cancellationHours: 48 },
          },
        }),
      ]);

      const released = await svc.releaseEligiblePayouts();

      expect(released).toBe(0);
      expect(prisma.settlement.updateMany).not.toHaveBeenCalled();
    });

    it('HOLDS the payout while a cancellation request is pending (past window)', async () => {
      // Window long closed AND booking still CONFIRMED, so it would normally
      // release - but a pending request means a refund may still be owed
      // (master 6.4: judged at the request instant), so it must not pay out.
      prisma.settlement.findMany.mockResolvedValue([
        candidate({
          booking: {
            displayRef: 'IT-1',
            status: BookingStatus.CONFIRMED,
            tourStartDateTime: new Date('2020-01-01T09:00:00.000Z'),
            tourTimeZone: 'UTC',
            utcCancellationRequestedAt: new Date('2020-01-01T00:00:00.000Z'),
            utcCancelledAt: null,
            tour: { cancellationHours: 48 },
          },
        }),
      ]);

      const released = await svc.releaseEligiblePayouts();

      expect(released).toBe(0);
      expect(prisma.settlement.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('reverseStaleCancelledSettlements', () => {
    it('voids RECORDED/INVOICED settlements whose booking is cancelled/expired', async () => {
      prisma.settlement.updateMany.mockResolvedValue({ count: 2 });

      const reversed = await svc.reverseStaleCancelledSettlements();

      expect(reversed).toBe(2);
      const arg = prisma.settlement.updateMany.mock.calls[0][0];
      expect(arg.where.status.in).toEqual([
        SettlementStatus.RECORDED,
        SettlementStatus.INVOICED,
      ]);
      expect(arg.where.booking.status.in).toEqual([
        BookingStatus.CANCELLED,
        BookingStatus.EXPIRED,
      ]);
      expect(arg.data.status).toBe(SettlementStatus.REVERSED);
      expect(arg.data.netPosition.toString()).toBe('0');
      expect(arg.data.operatorPayout).toBeNull();
    });
  });

  describe('list (dashboard)', () => {
    const row = (over: Record<string, unknown> = {}) => ({
      id: 's1',
      bookingId: 'b1',
      operatorId: 'op1',
      paymentModel: PaymentModel.PAID_IN_FULL,
      amountCollected: D('100'),
      commissionOwed: D('20'),
      netPosition: D('80'),
      operatorPayout: null,
      status: SettlementStatus.RECORDED,
      currency: 'EUR',
      settledAt: null,
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      booking: {
        displayRef: 'IT-1',
        status: BookingStatus.CONFIRMED,
        tourStartDateTime: new Date('2020-01-01T09:00:00.000Z'),
        tourTimeZone: 'UTC',
        utcCancellationRequestedAt: null,
        utcCancelledAt: null,
        tour: { name: 'Reef Snorkel', cancellationHours: 48 },
        operator: { companyInfo: { companyName: 'Blue Co' } },
      },
      ...over,
    });

    it('maps a row and computes payoutEligible (admin sees all)', async () => {
      prisma.settlement.count.mockResolvedValue(1);
      prisma.settlement.findMany.mockResolvedValue([row()]);

      const res = await svc.list({}, { id: 'admin', role: Role.ADMIN });

      expect(res.total).toBe(1);
      expect(res.data[0]).toMatchObject({
        displayRef: 'IT-1',
        operatorName: 'Blue Co',
        tourName: 'Reef Snorkel',
        amountCollected: '100',
        commissionOwed: '20',
        netPosition: '80',
        status: SettlementStatus.RECORDED,
        payoutEligible: true, // paid_in_full, past window, still RECORDED
      });
      // Admin, no operator filter -> the where clause is not operator-scoped.
      const findArg = prisma.settlement.findMany.mock.calls[0][0];
      expect(findArg.where.operatorId).toBeUndefined();
    });

    it('is NOT payout-eligible once already released (PAID_OUT)', async () => {
      prisma.settlement.count.mockResolvedValue(1);
      prisma.settlement.findMany.mockResolvedValue([
        row({ status: SettlementStatus.PAID_OUT, operatorPayout: D('80') }),
      ]);

      const res = await svc.list({}, { id: 'admin', role: Role.ADMIN });

      expect(res.data[0].payoutEligible).toBe(false);
      expect(res.data[0].operatorPayout).toBe('80');
    });

    it('flags payoutHeld (and not eligible) when a cancellation request is pending', async () => {
      prisma.settlement.count.mockResolvedValue(1);
      prisma.settlement.findMany.mockResolvedValue([
        row({
          booking: {
            displayRef: 'IT-1',
            status: BookingStatus.CONFIRMED,
            tourStartDateTime: new Date('2020-01-01T09:00:00.000Z'),
            tourTimeZone: 'UTC',
            utcCancellationRequestedAt: new Date('2020-01-01T00:00:00.000Z'),
            utcCancelledAt: null,
            tour: { name: 'Reef Snorkel', cancellationHours: 48 },
            operator: { companyInfo: { companyName: 'Blue Co' } },
          },
        }),
      ]);

      const res = await svc.list({}, { id: 'admin', role: Role.ADMIN });

      expect(res.data[0].payoutHeld).toBe(true);
      expect(res.data[0].payoutEligible).toBe(false);
    });
  });
});
