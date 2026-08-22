import { BadRequestException } from '@nestjs/common';
import { EmailStream, EmailTemplateKey } from '@prisma/client';
import {
  EmailTestSendService,
  testScopePrefix,
} from './email-test-send.service';

/**
 * WP-H (H-07): test-send logging (`test:<userId>#<n>`, count-based n), the
 * retry-once collision rule, the 18-key render coverage, and the guarantee
 * that a test scope can NEVER collide with a real sweep scope.
 */
describe('EmailTestSendService', () => {
  const ADMIN = {
    id: 'a0b1c2d3-0000-4000-8000-000000000001',
    email: 'ash@tripwheel.io',
  };

  let prisma: {
    emailSend: { count: jest.Mock; findUnique: jest.Mock };
    siteInfo: { findFirst: jest.Mock };
  };
  let mail: Record<string, jest.Mock>;
  let emailLog: { claimAndSend: jest.Mock };
  let svc: EmailTestSendService;

  beforeEach(() => {
    prisma = {
      emailSend: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({ id: 'row-1' }),
      },
      siteInfo: { findFirst: jest.fn().mockResolvedValue({ logo: null }) },
    };
    mail = {
      sendMail: jest.fn().mockResolvedValue({ providerMessageId: 'resend-1' }),
      sendBookingConfirmationEmail: jest
        .fn()
        .mockResolvedValue({ providerMessageId: 'resend-1' }),
      sendPreTourReminderEmail: jest
        .fn()
        .mockResolvedValue({ providerMessageId: 'resend-1' }),
      sendNextAdventureEmail: jest
        .fn()
        .mockResolvedValue({ providerMessageId: 'resend-1' }),
      sendBookingNoticeEmail: jest
        .fn()
        .mockResolvedValue({ providerMessageId: 'resend-1' }),
      sendCancellationEmail: jest
        .fn()
        .mockResolvedValue({ providerMessageId: 'resend-1' }),
      sendReviewRequestEmail: jest
        .fn()
        .mockResolvedValue({ providerMessageId: 'resend-1' }),
    };
    emailLog = {
      claimAndSend: jest.fn(async (input: { send: () => Promise<unknown> }) => {
        await input.send();
        return { outcome: 'sent', providerMessageId: 'resend-1' };
      }),
    };
    svc = new EmailTestSendService(
      prisma as never,
      mail as never,
      emailLog as never,
    );
  });

  it('rejects an unknown template key with 400', async () => {
    await expect(svc.testSend(ADMIN, 'NOT_A_KEY')).rejects.toThrow(
      BadRequestException,
    );
    expect(emailLog.claimAndSend).not.toHaveBeenCalled();
  });

  it('logs under test:<userId>#<n> with n = count + 1, to the caller only', async () => {
    prisma.emailSend.count.mockResolvedValue(2);
    await svc.testSend(ADMIN, EmailTemplateKey.OB6_CHECK_IN);
    expect(emailLog.claimAndSend).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: EmailTemplateKey.OB6_CHECK_IN,
        scopeId: `${testScopePrefix(ADMIN.id)}3`,
        toEmail: ADMIN.email,
        stream: EmailStream.LIFECYCLE,
      }),
    );
    // The count is scoped to THIS user's test rows for THIS key.
    expect(prisma.emailSend.count).toHaveBeenCalledWith({
      where: {
        templateKey: EmailTemplateKey.OB6_CHECK_IN,
        scopeId: {
          gte: testScopePrefix(ADMIN.id),
          lt: `${testScopePrefix(ADMIN.id)}\uffff`,
        },
      },
    });
  });

  it('retries ONCE with the recomputed n on a claim collision', async () => {
    prisma.emailSend.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    emailLog.claimAndSend
      .mockResolvedValueOnce({ outcome: 'skipped', reason: 'already-sent' })
      .mockResolvedValueOnce({ outcome: 'sent', providerMessageId: null });
    await svc.testSend(ADMIN, EmailTemplateKey.OB6_CHECK_IN);
    expect(emailLog.claimAndSend).toHaveBeenCalledTimes(2);
    expect(emailLog.claimAndSend).toHaveBeenLastCalledWith(
      expect.objectContaining({ scopeId: `${testScopePrefix(ADMIN.id)}2` }),
    );
  });

  it('renders and sends EVERY template key with the fixed sample data', async () => {
    for (const key of Object.values(EmailTemplateKey)) {
      emailLog.claimAndSend.mockClear();
      await svc.testSend(ADMIN, key);
      expect(emailLog.claimAndSend).toHaveBeenCalledTimes(1);
      const input = emailLog.claimAndSend.mock.calls[0][0] as {
        toEmail: string;
        scopeId: string;
      };
      expect(input.toEmail).toBe(ADMIN.email);
      expect(input.scopeId.startsWith('test:')).toBe(true);
    }
    // Booking templates included: test-send ≠ switch (founder decision).
    // The loop above covered BK1/BK2/BK3/BK3R/CX1/MK1 with the rest.
  });

  describe('the test: scope can never be swept', () => {
    it('never matches a UUID (sweep anti-joins compare scopeId = o./b."id")', () => {
      const scope = `${testScopePrefix(ADMIN.id)}1`;
      const uuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(uuid.test(scope)).toBe(false);
      expect(scope.startsWith('test:')).toBe(true);
    });

    it('never collides with the admin-resend scope family for a real id', () => {
      // Resend scopes are `<uuid>#resend-<n>`; test scopes are
      // `test:<uuid>#<n>` — the prefixes are disjoint by the first char.
      const scope = `${testScopePrefix(ADMIN.id)}1`;
      expect(scope.includes('#resend-')).toBe(false);
    });
  });
});
