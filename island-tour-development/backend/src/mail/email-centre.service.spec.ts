import { BadRequestException } from '@nestjs/common';
import { EmailSendStatus, EmailStream, EmailTemplateKey } from '@prisma/client';
import { EmailCentreService } from './email-centre.service';
import { EmailSettingsService } from './email-settings.service';

/**
 * WP-H (H-04/H-05/H-06 unit side): the settings payload shape, the merged
 * cross-field window validation, and the list endpoints' filter → where
 * mapping (the SQL-facing contract the dashboard filters depend on).
 */
describe('EmailCentreService', () => {
  let prisma: {
    emailSettings: { findUnique: jest.Mock; upsert: jest.Mock };
    reviewRequestSettings: { upsert: jest.Mock; update: jest.Mock };
    emailSend: { count: jest.Mock; findMany: jest.Mock };
    emailOptOut: { count: jest.Mock; findMany: jest.Mock };
    emailConsent: { count: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let settings: EmailSettingsService;
  let svc: EmailCentreService;

  const REVIEW_ROW = {
    enabled: false,
    firstSendLocalHour: 10,
    firstSendDelayDays: 1,
    reminderAfterDays: 5,
    giveUpAfterDays: 30,
  };

  const envBefore: Record<string, string | undefined> = {};
  const ENV_KEYS = ['SALES_EMAIL', 'ADMIN_EMAIL', 'MAIL_REPLY_TO'] as const;

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      envBefore[key] = process.env[key];
      delete process.env[key];
    }
    prisma = {
      emailSettings: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      reviewRequestSettings: {
        upsert: jest.fn().mockResolvedValue({ ...REVIEW_ROW }),
        update: jest.fn().mockResolvedValue({ ...REVIEW_ROW, enabled: true }),
      },
      emailSend: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      emailOptOut: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      emailConsent: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      // The real $transaction executes the batched promises; the mocks above
      // already resolve, so awaiting them preserves [count, rows] order.
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    settings = new EmailSettingsService(prisma as never);
    svc = new EmailCentreService(prisma as never, settings);
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (envBefore[key] === undefined) delete process.env[key];
      else process.env[key] = envBefore[key];
    }
  });

  // ── Settings payload (H-04) ────────────────────────────────────────────────

  it('getSettings returns { effective, stored, defaults } with the review slice on each', async () => {
    const out = await svc.getSettings();
    expect(out.stored.ob3DelayHours).toBeNull();
    expect(out.effective.ob3DelayHours).toBe(48);
    expect(out.defaults.ob3DelayHours).toBe(48);
    expect(out.effective.review).toEqual(REVIEW_ROW);
    expect(out.stored.review).toEqual(REVIEW_ROW);
    expect(out.defaults.review).toEqual(REVIEW_ROW); // schema defaults here
    // The review slice is READ from its own table, upserted on first touch.
    expect(prisma.reviewRequestSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'default' } }),
    );
  });

  it('PATCH writes only provided fields; null clears an override', async () => {
    await svc.updateSettings(
      { ob3DelayHours: 12, salesEmail: null },
      { id: 'admin-1' },
    );
    expect(prisma.emailSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { ob3DelayHours: 12, salesEmail: null },
      }),
    );
  });

  it('PATCH normalizes weekday csv to lowercase and trims addresses', async () => {
    await svc.updateSettings(
      {
        windowWeekdays: ' MON,Fri ',
        salesEmail: '  sales@x.test ',
      },
      { id: 'admin-1' },
    );
    expect(prisma.emailSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { windowWeekdays: 'mon,fri', salesEmail: 'sales@x.test' },
      }),
    );
  });

  it('PATCH rejects an inverted window measured on MERGED values', async () => {
    // Stored end = 11 (built-in); moving start alone to 11 empties the window.
    await expect(
      svc.updateSettings({ windowStartHour: 11 }, { id: 'admin-1' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.emailSettings.upsert).not.toHaveBeenCalled();
  });

  it('PATCH accepts a window move that stays consistent', async () => {
    await svc.updateSettings(
      {
        windowStartHour: 13,
        windowEndHour: 15,
      },
      { id: 'admin-1' },
    );
    expect(prisma.emailSettings.upsert).toHaveBeenCalled();
  });

  it('the review slice routes to ReviewRequestSettings, not email_settings', async () => {
    await svc.updateSettings({ review: { enabled: true } }, { id: 'admin-1' });
    expect(prisma.reviewRequestSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'default' },
        data: { enabled: true },
      }),
    );
    expect(prisma.emailSettings.upsert).not.toHaveBeenCalled();
  });

  // ── Sends list (H-05) ──────────────────────────────────────────────────────

  it('listSends maps every filter into the where clause', async () => {
    await svc.listSends({
      templateKey: EmailTemplateKey.MK1_NEXT_ADVENTURE,
      status: EmailSendStatus.SUPPRESSED,
      stream: EmailStream.MARKETING,
      toEmail: ' Denley@Example.COM ',
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-31T00:00:00.000Z',
      page: 2,
      limit: 10,
    });
    expect(prisma.emailSend.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          templateKey: EmailTemplateKey.MK1_NEXT_ADVENTURE,
          status: EmailSendStatus.SUPPRESSED,
          stream: EmailStream.MARKETING,
          toEmail: { equals: 'denley@example.com', mode: 'insensitive' },
          createdAt: {
            gte: new Date('2026-08-01T00:00:00.000Z'),
            lte: new Date('2026-08-31T00:00:00.000Z'),
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 10,
      }),
    );
  });

  it('listSends returns the paginated wrapper', async () => {
    prisma.emailSend.count.mockResolvedValue(42);
    prisma.emailSend.findMany.mockResolvedValue([{ id: 'row' }]);
    const out = await svc.listSends({ page: 1, limit: 20 });
    expect(out).toEqual({
      total: 42,
      page: 1,
      limit: 20,
      data: [{ id: 'row' }],
    });
  });

  it('listSends with no filters sends an empty where (full log, newest first)', async () => {
    await svc.listSends({});
    expect(prisma.emailSend.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  // ── People lists (H-06) ────────────────────────────────────────────────────

  it('opt-out search is a lowercased prefix match on the canonical column', async () => {
    await svc.listOptOuts({ email: ' Mayra@IRIE', page: 1, limit: 20 });
    expect(prisma.emailOptOut.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: { startsWith: 'mayra@irie' } },
      }),
    );
  });

  it('consent search mirrors the opt-out shape', async () => {
    await svc.listConsents({ email: 'denley@example.com' });
    expect(prisma.emailConsent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: { startsWith: 'denley@example.com' } },
      }),
    );
  });
});
