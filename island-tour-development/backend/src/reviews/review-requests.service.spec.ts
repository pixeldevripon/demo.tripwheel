import { BookingStatus, Prisma } from '@prisma/client';
import { ReviewRequestsService } from './review-requests.service';

/**
 * Job-level tests for the post-tour review request.
 *
 * This job emails real customers on a schedule, in three different island
 * timezones, and must never ask someone to review a tour they did not take. The
 * cases below are the ones where being wrong is visible to a guest rather than
 * to a log file.
 */

/** UTC instant helper - every assertion here is about clock arithmetic. */
const at = (iso: string) => new Date(iso);

function mockPrisma(): any {
  return {
    reviewRequestSettings: { findFirst: jest.fn() },
    booking: { findMany: jest.fn().mockResolvedValue([]) },
    reviewInvitation: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    siteInfo: { findFirst: jest.fn().mockResolvedValue(null) },
    setting: { findFirst: jest.fn().mockResolvedValue(null) },
  };
}

function mockMail(): any {
  return { sendReviewRequestEmail: jest.fn().mockResolvedValue(true) };
}

/** Cadence with the job switched ON, since `enabled` ships false. */
const ENABLED = {
  enabled: true,
  firstSendLocalHour: 10,
  firstSendDelayDays: 1,
  reminderAfterDays: 5,
  reminderEnabled: true,
  giveUpAfterDays: 30,
  batchSize: 200,
};

function booking(over: Record<string, unknown> = {}) {
  return {
    id: 'bk1',
    localDate: at('2026-03-10T00:00:00.000Z'),
    tourEndDateTime: at('2026-03-10T17:00:00.000Z'),
    tourTimeZone: 'America/Curacao',
    tour: { timeZone: 'America/Curacao' },
    ...over,
  };
}

function invitation(over: Record<string, unknown> = {}) {
  return {
    id: 'inv1',
    token: 'tok1',
    booking: {
      ...booking(),
      contactEmail: 'guest@example.test',
      contactFirstName: 'Ada',
      locale: 'en',
      tour: {
        timeZone: 'America/Curacao',
        name: 'Sunset Cruise',
        slug: 'sunset-cruise',
        destination: { slug: 'curacao' },
        images: [],
      },
    },
    ...over,
  };
}

describe('ReviewRequestsService', () => {
  let prisma: any;
  let mail: any;
  let svc: ReviewRequestsService;

  beforeEach(() => {
    prisma = mockPrisma();
    mail = mockMail();
    svc = new ReviewRequestsService(prisma, mail);
  });

  // ── The master switch ────────────────────────────────────────────────────

  describe('the enabled switch', () => {
    it('does nothing at all while disabled - not even creating invitations', async () => {
      prisma.reviewRequestSettings.findFirst.mockResolvedValue({
        ...ENABLED,
        enabled: false,
      });

      const res = await svc.run(at('2026-03-11T20:00:00.000Z'));

      expect(res).toEqual({
        created: 0,
        sent: 0,
        reminded: 0,
        suppressed: 0,
        failed: 0,
      });
      // Creating invitations while off would build a backlog that all fires at
      // once the moment someone flips the switch. It must not even scan.
      expect(prisma.booking.findMany).not.toHaveBeenCalled();
      expect(prisma.reviewInvitation.create).not.toHaveBeenCalled();
      expect(mail.sendReviewRequestEmail).not.toHaveBeenCalled();
    });

    it('defaults to disabled when no settings row exists', async () => {
      prisma.reviewRequestSettings.findFirst.mockResolvedValue(null);
      await svc.run(at('2026-03-11T20:00:00.000Z'));
      expect(mail.sendReviewRequestEmail).not.toHaveBeenCalled();
    });
  });

  // ── 1. Send window per island timezone ───────────────────────────────────

  describe("send window resolves in the tour's own timezone", () => {
    /**
     * All three launch islands sit at UTC-4, so a 10:00 local send is 14:00 UTC.
     * The point of running all three is that the zone is READ FROM THE BOOKING:
     * a hardcoded America/Curacao would pass Curaçao and quietly mis-schedule
     * the other two the moment any of them diverges (DST, or a new destination
     * at a different offset).
     */
    const ISLANDS = [
      ['Curacao', 'America/Curacao'],
      ['Aruba', 'America/Aruba'],
      ['Sint Maarten', 'America/Lower_Princes'],
    ] as const;

    beforeEach(() => {
      prisma.reviewRequestSettings.findFirst.mockResolvedValue(ENABLED);
    });

    it.each(ISLANDS)(
      '%s: holds at 09:00 local the morning after, sends at 10:00',
      async (_island, zone) => {
        const inv = invitation({
          booking: {
            ...invitation().booking,
            tourTimeZone: zone,
            tour: { ...invitation().booking.tour, timeZone: zone },
          },
        });
        prisma.reviewInvitation.findMany.mockImplementation((args: any) =>
          // Only the first-touch query (sentAt: null) returns this row.
          args?.where?.sentAt === null ? [inv] : [],
        );

        // 13:00 UTC = 09:00 local, one hour before the window opens.
        await svc.run(at('2026-03-11T13:00:00.000Z'));
        expect(mail.sendReviewRequestEmail).not.toHaveBeenCalled();

        // 14:00 UTC = 10:00 local.
        await svc.run(at('2026-03-11T14:00:00.000Z'));
        expect(mail.sendReviewRequestEmail).toHaveBeenCalledTimes(1);
      },
    );

    it('never sends before the tour has actually finished', async () => {
      const inv = invitation({
        booking: {
          ...invitation().booking,
          tourEndDateTime: at('2026-03-11T17:00:00.000Z'),
        },
      });
      prisma.reviewInvitation.findMany.mockImplementation((args: any) =>
        args?.where?.sentAt === null ? [inv] : [],
      );

      // Morning of the tour day: the guest is still on the boat.
      await svc.run(at('2026-03-11T14:00:00.000Z'));
      expect(mail.sendReviewRequestEmail).not.toHaveBeenCalled();
    });

    it('refuses to guess when the booking has no resolvable timezone', async () => {
      const inv = invitation({
        booking: {
          ...invitation().booking,
          tourTimeZone: null,
          tour: { ...invitation().booking.tour, timeZone: null },
        },
      });
      prisma.reviewInvitation.findMany.mockImplementation((args: any) =>
        args?.where?.sentAt === null ? [inv] : [],
      );

      // A missed invitation is recoverable; one sent mid-tour is not.
      await svc.run(at('2026-03-20T14:00:00.000Z'));
      expect(mail.sendReviewRequestEmail).not.toHaveBeenCalled();
    });
  });

  // ── 2. Suppression matrix ────────────────────────────────────────────────

  describe('suppression', () => {
    beforeEach(() => {
      prisma.reviewRequestSettings.findFirst.mockResolvedValue(ENABLED);
    });

    it('only ever scans bookings that actually happened', async () => {
      await svc.run(at('2026-03-11T14:00:00.000Z'));

      const where = prisma.booking.findMany.mock.calls[0][0].where;
      expect(where.status.in).toEqual([
        BookingStatus.CONFIRMED,
        BookingStatus.REDEEMED,
      ]);
      // A booking that never happened is excluded at the query, so no cancelled,
      // expired, rejected, on-hold or pending booking can reach an invitation.
      for (const bad of [
        BookingStatus.CANCELLED,
        BookingStatus.EXPIRED,
        BookingStatus.REJECTED,
        BookingStatus.ON_HOLD,
        BookingStatus.PENDING,
      ]) {
        expect(where.status.in).not.toContain(bad);
      }
    });

    it('revokes an invitation whose booking stopped qualifying after it was made', async () => {
      // The gap this closes: cancel AFTER the invitation exists but BEFORE the
      // email goes out. The create-time filter cannot catch that.
      prisma.reviewInvitation.updateMany.mockResolvedValue({ count: 2 });

      const res = await svc.run(at('2026-03-11T14:00:00.000Z'));

      expect(res.suppressed).toBe(2);
      const call = prisma.reviewInvitation.updateMany.mock.calls[0][0];
      expect(call.where.booking.status.in).toEqual(
        expect.arrayContaining([
          BookingStatus.CANCELLED,
          BookingStatus.EXPIRED,
          BookingStatus.REJECTED,
        ]),
      );
      // Revoked, never deleted: the ledger stays honest about what happened.
      expect(call.data.revokedAt).toBeInstanceOf(Date);
      expect(call.where.completedAt).toBeNull();
    });

    it('excludes revoked invitations from both send queries', async () => {
      await svc.run(at('2026-03-11T14:00:00.000Z'));

      const wheres = prisma.reviewInvitation.findMany.mock.calls.map(
        (c: any) => c[0].where,
      );
      expect(wheres).toHaveLength(2);
      for (const w of wheres) expect(w.revokedAt).toBeNull();
    });

    it('never emails a booking with no contact address', async () => {
      await svc.run(at('2026-03-11T14:00:00.000Z'));
      const where = prisma.booking.findMany.mock.calls[0][0].where;
      expect(where.contactEmail).toEqual({ not: null });
    });
  });

  // ── 3. Idempotency ───────────────────────────────────────────────────────

  describe('idempotency', () => {
    beforeEach(() => {
      prisma.reviewRequestSettings.findFirst.mockResolvedValue(ENABLED);
    });

    it('creates exactly one invitation across two runs', async () => {
      prisma.booking.findMany.mockResolvedValue([booking()]);
      // First run creates; second hits the unique index on bookingId.
      prisma.reviewInvitation.create
        .mockResolvedValueOnce({ id: 'inv1' })
        .mockRejectedValueOnce(
          new Prisma.PrismaClientKnownRequestError('unique', {
            code: 'P2002',
            clientVersion: '7',
          }),
        );

      const first = await svc.run(at('2026-03-11T14:00:00.000Z'));
      const second = await svc.run(at('2026-03-11T15:00:00.000Z'));

      expect(first.created).toBe(1);
      // The duplicate is swallowed, not thrown: a concurrent pass creating it is
      // the expected case, not an error worth failing the run over.
      expect(second.created).toBe(0);
    });

    it('rethrows a non-unique database error rather than hiding it', async () => {
      prisma.booking.findMany.mockResolvedValue([booking()]);
      prisma.reviewInvitation.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('fk violation', {
          code: 'P2003',
          clientVersion: '7',
        }),
      );

      await expect(svc.run(at('2026-03-11T14:00:00.000Z'))).rejects.toThrow();
    });

    it('re-queries only unsent invitations, so a sent one cannot send twice', async () => {
      await svc.run(at('2026-03-11T14:00:00.000Z'));
      const firstTouchWhere =
        prisma.reviewInvitation.findMany.mock.calls[0][0].where;
      expect(firstTouchWhere.sentAt).toBeNull();
      expect(firstTouchWhere.completedAt).toBeNull();
    });
  });

  // ── 4. The single reminder ───────────────────────────────────────────────

  describe('the single reminder', () => {
    beforeEach(() => {
      prisma.reviewRequestSettings.findFirst.mockResolvedValue(ENABLED);
    });

    /** Route the reminder query (remindedAt: null) to a row, first touch to none. */
    function onlyReminderDue(inv: any) {
      prisma.reviewInvitation.findMany.mockImplementation((args: any) =>
        args?.where?.remindedAt === null ? [inv] : [],
      );
    }

    it('fires once and stamps remindedAt so it never fires again', async () => {
      onlyReminderDue(invitation());

      const res = await svc.run(at('2026-03-20T14:00:00.000Z'));

      expect(res.reminded).toBe(1);
      expect(mail.sendReviewRequestEmail).toHaveBeenCalledTimes(1);
      expect(prisma.reviewInvitation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv1' },
          data: expect.objectContaining({ remindedAt: expect.any(Date) }),
        }),
      );
    });

    it('stamps remindedAt even when delivery FAILS', async () => {
      onlyReminderDue(invitation());
      // Delivery failure is a THROWN error, not a falsy return - `deliver()`
      // wraps the send in try/catch and reports false only from the catch.
      mail.sendReviewRequestEmail.mockRejectedValue(
        new Error('550 mailbox unavailable'),
      );

      const res = await svc.run(at('2026-03-20T14:00:00.000Z'));

      expect(res.failed).toBe(1);
      // Without this, a permanently bouncing address is retried on every hourly
      // run forever - a single reminder becomes an unbounded one.
      expect(prisma.reviewInvitation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ remindedAt: expect.any(Date) }),
        }),
      );
    });

    it('never chases someone who already left a review', async () => {
      await svc.run(at('2026-03-20T14:00:00.000Z'));
      const reminderWhere =
        prisma.reviewInvitation.findMany.mock.calls[1][0].where;
      expect(reminderWhere.completedAt).toBeNull();
      expect(reminderWhere.remindedAt).toBeNull();
    });

    it('bounds the reminder window at both ends', async () => {
      const now = at('2026-03-20T14:00:00.000Z');
      await svc.run(now);

      const w = prisma.reviewInvitation.findMany.mock.calls[1][0].where;
      // Silent for long enough...
      expect(w.sentAt.lte).toEqual(
        new Date(now.getTime() - ENABLED.reminderAfterDays * 864e5),
      );
      // ...but not so long ago that chasing reads as spam.
      expect(w.sentAt.gte).toEqual(
        new Date(now.getTime() - ENABLED.giveUpAfterDays * 864e5),
      );
    });

    it('sends no reminder at all when the admin turned it off', async () => {
      prisma.reviewRequestSettings.findFirst.mockResolvedValue({
        ...ENABLED,
        reminderEnabled: false,
      });
      onlyReminderDue(invitation());

      const res = await svc.run(at('2026-03-20T14:00:00.000Z'));

      expect(res.reminded).toBe(0);
      expect(mail.sendReviewRequestEmail).not.toHaveBeenCalled();
    });
  });
});
