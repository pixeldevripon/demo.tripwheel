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
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn(),
    },
    // Best-effort status-change emails re-read these; undefined results make
    // the (swallowed) email path a no-op, which is what these tests want.
    operator: { findUnique: jest.fn() },
    siteInfo: { findFirst: jest.fn() },
    // Array form used by list(); run the queued promises.
    $transaction: jest.fn((arg: unknown) =>
      Promise.all(arg as Promise<unknown>[]),
    ),
  };
}

function mockMail(): any {
  return { sendBookingNoticeEmail: jest.fn() };
}

describe('SettlementsService', () => {
  let prisma: any;
  let mail: any;
  let svc: SettlementsService;

  beforeEach(() => {
    prisma = mockPrisma();
    mail = mockMail();
    svc = new SettlementsService(prisma, mail, { notify: jest.fn() } as never);
  });

  /** The row shape sendStatusChangeEmails re-reads after a ledger flip. */
  const emailReadRow = (over: Record<string, unknown> = {}) => ({
    operatorId: 'op1',
    netPosition: D('80'),
    operatorPayout: null,
    currency: 'EUR',
    booking: {
      displayRef: 'IT-1',
      localDate: '2020-01-01',
      tourStartDateTime: new Date('2020-01-01T09:00:00.000Z'),
      startTime: '09:00',
      tour: { name: 'Sunset Cruise' },
    },
    ...over,
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
      utcOperatorCancellationReportedAt: null,
      utcCancelledAt: null,
      tour: { cancellationHours: 48 },
    },
    ...over,
  });

  // Manual payout confirmation (founder 2026-07-26): PAID_OUT is only ever set
  // by an admin's "Mark as paid" - each blocker gets its own specific 409.
  describe('markPaidOut', () => {
    it('marks an eligible payout PAID_OUT (guarded flip, stamps payout + settledAt)', async () => {
      // First read = the action's eligibility read; second = the email re-read.
      prisma.settlement.findUnique
        .mockResolvedValueOnce(candidate())
        .mockResolvedValueOnce(emailReadRow({ operatorPayout: D('80') }));
      prisma.operator.findUnique.mockResolvedValue({
        contactEmail: 'op@example.test',
        companyInfo: { companyEmail: null, companyName: 'Blue Boats' },
      });
      process.env.ADMIN_EMAIL = 'admin@islandtours.test';

      const res = await svc.markPaidOut('s1', 'admin-1');

      const arg = prisma.settlement.updateMany.mock.calls[0][0];
      // Guarded flip, race-safe on still-RECORDED.
      expect(arg.where).toEqual({
        id: 's1',
        status: SettlementStatus.RECORDED,
      });
      expect(arg.data.status).toBe(SettlementStatus.PAID_OUT);
      expect(arg.data.operatorPayout.toString()).toBe('80');
      expect(arg.data.settledAt).toBeInstanceOf(Date);
      expect(res.status).toBe(SettlementStatus.PAID_OUT);
      expect(res.operatorPayout).toBe('80');

      // The notification path actually ran (regression guard: an incomplete
      // re-read mock used to crash inside the swallowed try/catch, leaving
      // this whole code path unexercised).
      const recipients = mail.sendBookingNoticeEmail.mock.calls.map(
        (c: unknown[]) => c[0],
      );
      expect(recipients).toEqual(['op@example.test', 'admin@islandtours.test']);
      expect(mail.sendBookingNoticeEmail.mock.calls[0][1]).toBe(
        'Payout marked as paid - IT-1',
      );
      delete process.env.ADMIN_EMAIL;
    });

    it('404s on an unknown settlement', async () => {
      prisma.settlement.findUnique.mockResolvedValue(null);
      await expect(svc.markPaidOut('nope')).rejects.toThrow(
        'Settlement not found',
      );
    });

    it('409s when already paid out (never double-pays)', async () => {
      prisma.settlement.findUnique.mockResolvedValue(
        candidate({ status: SettlementStatus.PAID_OUT }),
      );
      await expect(svc.markPaidOut('s1')).rejects.toThrow(
        'already marked as paid out',
      );
      expect(prisma.settlement.updateMany).not.toHaveBeenCalled();
    });

    it('409s on a REVERSED row (cancelled booking owes nothing)', async () => {
      prisma.settlement.findUnique.mockResolvedValue(
        candidate({ status: SettlementStatus.REVERSED }),
      );
      await expect(svc.markPaidOut('s1')).rejects.toThrow('reversed');
      expect(prisma.settlement.updateMany).not.toHaveBeenCalled();
    });

    it('409s while the clawback window is still open (future tour)', async () => {
      prisma.settlement.findUnique.mockResolvedValue(
        candidate({
          booking: {
            displayRef: 'IT-1',
            status: BookingStatus.CONFIRMED,
            tourStartDateTime: new Date('2999-01-01T09:00:00.000Z'),
            tourTimeZone: 'UTC',
            utcCancellationRequestedAt: null,
            utcCancelledAt: null,
            tour: { cancellationHours: 48 },
          },
        }),
      );
      await expect(svc.markPaidOut('s1')).rejects.toThrow(
        'can still cancel for free',
      );
      expect(prisma.settlement.updateMany).not.toHaveBeenCalled();
    });

    it('409s when the booking is no longer standing (cancelled)', async () => {
      prisma.settlement.findUnique.mockResolvedValue(
        candidate({
          booking: {
            displayRef: 'IT-1',
            status: BookingStatus.CANCELLED,
            tourStartDateTime: new Date('2020-01-01T09:00:00.000Z'),
            tourTimeZone: 'UTC',
            utcCancellationRequestedAt: null,
            utcCancelledAt: null,
            tour: { cancellationHours: 48 },
          },
        }),
      );
      await expect(svc.markPaidOut('s1')).rejects.toThrow('no longer stands');
      expect(prisma.settlement.updateMany).not.toHaveBeenCalled();
    });

    it('409s while an OPERATOR cancellation report is pending (conflict #2 hold)', async () => {
      // Window long closed AND booking still CONFIRMED - but the operator
      // reported they must cancel, so the admin is about to fully refund;
      // money must not go out first.
      prisma.settlement.findUnique.mockResolvedValue(
        candidate({
          booking: {
            displayRef: 'IT-1',
            status: BookingStatus.CONFIRMED,
            tourStartDateTime: new Date('2020-01-01T09:00:00.000Z'),
            tourTimeZone: 'UTC',
            utcCancellationRequestedAt: null,
            utcOperatorCancellationReportedAt: new Date(
              '2020-01-01T00:00:00.000Z',
            ),
            utcCancelledAt: null,
            tour: { cancellationHours: 48 },
          },
        }),
      );
      await expect(svc.markPaidOut('s1')).rejects.toThrow(
        'operator reported a cancellation',
      );
      expect(prisma.settlement.updateMany).not.toHaveBeenCalled();
    });

    it('409s while a cancellation request is pending (payout HELD, master 6.4)', async () => {
      // Window long closed AND booking still CONFIRMED, so it would otherwise be
      // payable - but a pending request means a refund may still be owed.
      prisma.settlement.findUnique.mockResolvedValue(
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
      );
      await expect(svc.markPaidOut('s1')).rejects.toThrow(
        'cancellation request is pending',
      );
      expect(prisma.settlement.updateMany).not.toHaveBeenCalled();
    });

    it('409s when the guarded flip loses a race (row changed concurrently)', async () => {
      prisma.settlement.findUnique.mockResolvedValue(candidate());
      prisma.settlement.updateMany.mockResolvedValue({ count: 0 });
      await expect(svc.markPaidOut('s1')).rejects.toThrow(
        'changed while you were looking at it',
      );
    });
  });

  describe('markUnpaid', () => {
    it('reverts a paid-out row to RECORDED and clears the payout stamp', async () => {
      prisma.settlement.findUnique
        .mockResolvedValueOnce({
          id: 's1',
          status: SettlementStatus.PAID_OUT,
          booking: { displayRef: 'IT-1' },
        })
        .mockResolvedValueOnce(emailReadRow());
      prisma.operator.findUnique.mockResolvedValue({
        contactEmail: 'op@example.test',
        companyInfo: { companyEmail: null, companyName: 'Blue Boats' },
      });
      process.env.ADMIN_EMAIL = 'admin@islandtours.test';

      const res = await svc.markUnpaid('s1', 'admin-1');

      const arg = prisma.settlement.updateMany.mock.calls[0][0];
      expect(arg.where).toEqual({
        id: 's1',
        status: SettlementStatus.PAID_OUT,
      });
      expect(arg.data).toEqual({
        status: SettlementStatus.RECORDED,
        operatorPayout: null,
        settledAt: null,
      });
      expect(res.status).toBe(SettlementStatus.RECORDED);

      // Revert notices actually dispatched to both parties.
      const recipients = mail.sendBookingNoticeEmail.mock.calls.map(
        (c: unknown[]) => c[0],
      );
      expect(recipients).toEqual(['op@example.test', 'admin@islandtours.test']);
      expect(mail.sendBookingNoticeEmail.mock.calls[0][1]).toBe(
        'Payout reverted to due - IT-1',
      );
      delete process.env.ADMIN_EMAIL;
    });

    it('409s on a row that is not paid out (RECORDED / REVERSED)', async () => {
      prisma.settlement.findUnique.mockResolvedValue({
        id: 's1',
        status: SettlementStatus.RECORDED,
        booking: { displayRef: 'IT-1' },
      });
      await expect(svc.markUnpaid('s1', 'admin-1')).rejects.toThrow(
        'Only a paid-out settlement',
      );
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

    // Test report 2026-08-01 §Admin.4. Scoping used to ask "is this an ADMIN",
    // which threw platform staff into operator resolution - and they have no
    // operator record, so the whole payout ledger 400'd for them.
    it.each([
      ['STAFF', Role.STAFF],
      ['EDITOR', Role.EDITOR],
    ])('reads the ledger platform-wide for %s', async (_label, role) => {
      prisma.settlement.count.mockResolvedValue(1);
      prisma.settlement.findMany.mockResolvedValue([row()]);

      await svc.list({}, { id: 'staff-1', role });

      expect(
        prisma.settlement.findMany.mock.calls[0][0].where.operatorId,
      ).toBeUndefined();
      expect(prisma.operator.findUnique).not.toHaveBeenCalled();
    });

    it('still scopes a TOUR_OPERATOR to their own settlements', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-9' });
      prisma.settlement.count.mockResolvedValue(0);
      prisma.settlement.findMany.mockResolvedValue([]);

      await svc.list({}, { id: 'operator-1', role: Role.TOUR_OPERATOR });

      expect(prisma.settlement.findMany.mock.calls[0][0].where.operatorId).toBe(
        'op-9',
      );
    });
  });
});
