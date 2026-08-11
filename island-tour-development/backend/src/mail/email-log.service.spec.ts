/**
 * Unit tests for EmailLogService — the send-once spine (plan §2.2).
 *
 * The P2002 cases use REAL pg driver-adapter error shapes (constraint info
 * nested under `meta.driverAdapterError.cause`) alongside the classic
 * top-level `target` shape, because a predicate reading only top-level keys
 * silently never matches in production (the bookings idempotency lesson —
 * see bookings.service.ts `constraintIdsOf`).
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  EmailAudience,
  EmailSendStatus,
  EmailStream,
  EmailTemplateKey,
  Prisma,
  Role,
} from '@prisma/client';
import { EmailLogService } from './email-log.service';

/** A P2002 shaped exactly as Prisma 7 + @prisma/adapter-pg emits it. */
function adapterP2002() {
  return new Prisma.PrismaClientKnownRequestError('unique violation', {
    code: 'P2002',
    clientVersion: 'test',
    meta: {
      modelName: 'EmailSend',
      driverAdapterError: {
        cause: { constraint: { fields: ['templateKey', 'scopeId'] } },
      },
    },
  });
}

/** The classic engine shape — the predicate must accept both. */
function classicP2002() {
  return new Prisma.PrismaClientKnownRequestError('unique violation', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: ['templateKey', 'scopeId'] },
  });
}

function mockPrisma() {
  return {
    emailSend: {
      create: jest.fn().mockResolvedValue({ id: 'row-1' }),
      update: jest.fn().mockResolvedValue({ id: 'row-1' }),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    emailOptOut: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    operator: { findUnique: jest.fn() },
    booking: { findUnique: jest.fn() },
  };
}

const baseInput = () => ({
  templateKey: EmailTemplateKey.OB3_FIRST_TOUR_HOWTO,
  scopeId: 'op-1',
  toEmail: 'operator@example.com',
  stream: EmailStream.LIFECYCLE,
  send: jest.fn().mockResolvedValue({ providerMessageId: 'resend-1' }),
});

describe('EmailLogService', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let svc: EmailLogService;

  beforeEach(() => {
    prisma = mockPrisma();
    svc = new EmailLogService(prisma as never);
  });

  describe('claimAndSend', () => {
    it('claims the row BEFORE calling the transport (claim-first ordering)', async () => {
      const calls: string[] = [];
      prisma.emailSend.create.mockImplementation(() => {
        calls.push('claim');
        return Promise.resolve({ id: 'row-1' });
      });
      const input = baseInput();
      input.send.mockImplementation(() => {
        calls.push('send');
        return Promise.resolve({ providerMessageId: 'resend-1' });
      });

      const res = await svc.claimAndSend(input);

      expect(calls).toEqual(['claim', 'send']);
      expect(res).toEqual({ outcome: 'sent', providerMessageId: 'resend-1' });
      expect(prisma.emailSend.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            templateKey: EmailTemplateKey.OB3_FIRST_TOUR_HOWTO,
            scopeId: 'op-1',
            status: EmailSendStatus.SENT,
          }),
        }),
      );
    });

    it('P2002 race (adapter shape): the loser skips and NEVER sends', async () => {
      prisma.emailSend.create.mockRejectedValue(adapterP2002());
      const input = baseInput();

      const res = await svc.claimAndSend(input);

      expect(res).toEqual({ outcome: 'skipped', reason: 'already-sent' });
      expect(input.send).not.toHaveBeenCalled();
    });

    it('P2002 race: exactly ONE of two concurrent claims sends', async () => {
      // First insert wins, second collides — the DB's serialization order.
      prisma.emailSend.create
        .mockResolvedValueOnce({ id: 'row-1' })
        .mockRejectedValueOnce(adapterP2002());
      const winner = baseInput();
      const loser = baseInput();

      const [a, b] = await Promise.all([
        svc.claimAndSend(winner),
        svc.claimAndSend(loser),
      ]);

      const outcomes = [a.outcome, b.outcome].sort();
      expect(outcomes).toEqual(['sent', 'skipped']);
      expect(winner.send.mock.calls.length + loser.send.mock.calls.length).toBe(
        1,
      );
    });

    it('accepts the classic top-level target shape too', async () => {
      prisma.emailSend.create.mockRejectedValue(classicP2002());
      const res = await svc.claimAndSend(baseInput());
      expect(res).toEqual({ outcome: 'skipped', reason: 'already-sent' });
    });

    it('a P2002 on a DIFFERENT constraint is not swallowed as already-sent', async () => {
      prisma.emailSend.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique violation', {
          code: 'P2002',
          clientVersion: 'test',
          meta: {
            driverAdapterError: {
              cause: { constraint: { fields: ['email'] } },
            },
          },
        }),
      );
      const input = baseInput();
      const res = await svc.claimAndSend(input);
      // Claim never happened for a non-slot reason: reported as failed, no send.
      expect(res.outcome).toBe('failed');
      expect(input.send).not.toHaveBeenCalled();
    });

    it('transport failure AFTER the claim → row updated to FAILED with truncated error, no throw', async () => {
      const input = baseInput();
      input.send.mockRejectedValue(new Error('X'.repeat(600)));

      const res = await svc.claimAndSend(input);

      expect(res.outcome).toBe('failed');
      expect(prisma.emailSend.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'row-1' },
          data: expect.objectContaining({
            status: EmailSendStatus.FAILED,
            error: expect.stringMatching(/^X{500}$/) as string,
          }),
        }),
      );
    });

    it('never throws out of the sweep loop, even when the FAILED update also fails', async () => {
      const input = baseInput();
      input.send.mockRejectedValue(new Error('transport down'));
      prisma.emailSend.update.mockRejectedValue(new Error('db down too'));

      await expect(svc.claimAndSend(input)).resolves.toMatchObject({
        outcome: 'failed',
      });
    });

    it('stores the provider message id when the transport reports one', async () => {
      await svc.claimAndSend(baseInput());
      expect(prisma.emailSend.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'row-1' },
          data: { providerMessageId: 'resend-1' },
        }),
      );
    });
  });

  describe('recordSuppressed', () => {
    it('writes a SUPPRESSED row with the reason', async () => {
      const res = await svc.recordSuppressed({
        templateKey: EmailTemplateKey.OB7_CONNECT_CALENDAR,
        scopeId: 'op-1',
        toEmail: 'operator@example.com',
        stream: EmailStream.LIFECYCLE,
        reason: 'calendar-sync-unavailable',
      });
      expect(res).toEqual({ recorded: true });
      expect(prisma.emailSend.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: EmailSendStatus.SUPPRESSED,
            suppressedReason: 'calendar-sync-unavailable',
          }),
        }),
      );
    });

    it('occupies the same unique slot: P2002 → not recorded, no throw', async () => {
      prisma.emailSend.create.mockRejectedValue(adapterP2002());
      const res = await svc.recordSuppressed({
        templateKey: EmailTemplateKey.OB7_CONNECT_CALENDAR,
        scopeId: 'op-1',
        toEmail: 'operator@example.com',
        stream: EmailStream.LIFECYCLE,
        reason: 'opted-out',
      });
      expect(res).toEqual({ recorded: false });
    });
  });

  describe('isOptedOut', () => {
    it('lowercases the email before the lookup', async () => {
      prisma.emailOptOut.findUnique.mockResolvedValue({ id: 'oo-1' });
      const out = await svc.isOptedOut(
        'Jane.Doe@Example.COM',
        EmailAudience.OPERATOR,
        EmailStream.LIFECYCLE,
      );
      expect(out).toBe(true);
      expect(prisma.emailOptOut.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            email_audience_stream: {
              email: 'jane.doe@example.com',
              audience: EmailAudience.OPERATOR,
              stream: EmailStream.LIFECYCLE,
            },
          },
        }),
      );
    });

    it('false when no row exists', async () => {
      await expect(
        svc.isOptedOut(
          'a@b.co',
          EmailAudience.TRAVELLER,
          EmailStream.MARKETING,
        ),
      ).resolves.toBe(false);
    });
  });

  describe('resend scope ids', () => {
    it('resendScopeId builds the documented suffix', () => {
      expect(EmailLogService.resendScopeId('op-1', 2)).toBe('op-1#resend-2');
    });

    it('nextResendScopeId: n = count of existing rows for the base scope', async () => {
      prisma.emailSend.count.mockResolvedValue(1); // just the base row
      await expect(
        svc.nextResendScopeId(EmailTemplateKey.OB3_FIRST_TOUR_HOWTO, 'op-1'),
      ).resolves.toBe('op-1#resend-1');
      expect(prisma.emailSend.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            templateKey: EmailTemplateKey.OB3_FIRST_TOUR_HOWTO,
          }),
        }),
      );
    });
  });

  describe('listForScope / timeline reads', () => {
    it('lists base + #resend rows newest first', async () => {
      await svc.listForScope('op-1');
      expect(prisma.emailSend.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { scopeId: 'op-1' },
              // Collation-proof btree range, not startsWith (a LIKE prefix
              // only uses the index under C collation).
              { scopeId: { gte: 'op-1#resend-', lt: 'op-1#resend-\uffff' } },
            ],
          },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('listForOperator 404s on an unknown operator', async () => {
      prisma.operator.findUnique.mockResolvedValue(null);
      await expect(svc.listForOperator('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('listForBooking 404s on an unknown booking', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      await expect(
        svc.listForBooking('nope', { id: 'u1', role: Role.ADMIN }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('listForBooking scopes non-platform actors: a stranger is refused', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: 'b1',
        operatorId: 'op-1',
        userId: 'owner',
      });
      await expect(
        svc.listForBooking('b1', { id: 'stranger', role: Role.USER }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('listForBooking lets the booking owner through', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: 'b1',
        operatorId: 'op-1',
        userId: 'owner',
      });
      await expect(
        svc.listForBooking('b1', { id: 'owner', role: Role.USER }),
      ).resolves.toEqual([]);
    });
  });
});
