import { BadRequestException } from '@nestjs/common';
import { EmailStream, EmailTemplateKey } from '@prisma/client';
import { OnboardingEmailsService } from './onboarding-emails.service';

/**
 * The WP-D sweeper contract (checklist D-22): window gating, anchors via the
 * anti-join candidate queries, every suppression reason as a recorded row,
 * the 3-day volume cap with OB-6 > OB-7 > OB-8 priority, INT1R business-day
 * flow with its one-shot stamp, the OB-5 job path, and the resend n+1 retry.
 *
 * Window control uses REAL instants (Curaçao is fixed UTC-4): 2026-08-11 is
 * a Tuesday, so 14:30Z = 10:30 local = window OPEN; the Monday before is
 * CLOSED at any hour.
 */
const WINDOW_OPEN = new Date('2026-08-11T14:30:00.000Z'); // Tue 10:30 local
const WINDOW_CLOSED = new Date('2026-08-10T14:30:00.000Z'); // Mon 10:30 local

type QueryRawImpl = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<{ id: string }[]>;

/** Route $queryRaw calls by the template key interpolated into the query. */
function candidatesByKey(due: Partial<Record<string, string[]>>): QueryRawImpl {
  return (_strings, ...values) => {
    const key = values.find(
      (v): v is string =>
        typeof v === 'string' &&
        (Object.values(EmailTemplateKey) as string[]).includes(v),
    );
    return Promise.resolve((due[key ?? ''] ?? []).map((id) => ({ id })));
  };
}

const operatorRow = (over: Record<string, unknown> = {}) => ({
  id: 'op1',
  isActive: true,
  verificationStatus: 'VERIFIED',
  createdAt: new Date('2026-08-01T12:00:00.000Z'),
  contactPhone: '+599 9 561 22 43',
  user: { name: 'Mayra Martina', email: 'mayra@irietours.com' },
  companyInfo: { companyName: 'Irie Tours B.V.', companyPhone: null },
  _count: { tours: 0, calendarFeeds: 0 },
  ...over,
});

describe('OnboardingEmailsService', () => {
  let prisma: {
    $queryRaw: jest.Mock;
    operator: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
    emailSend: { findMany: jest.Mock; findUnique: jest.Mock };
    siteInfo: { findFirst: jest.Mock };
    tour: { findFirst: jest.Mock };
  };
  let mail: { sendMail: jest.Mock };
  let emailLog: {
    claimAndSend: jest.Mock;
    recordSuppressed: jest.Mock;
    isOptedOut: jest.Mock;
    nextResendScopeId: jest.Mock;
  };
  let prefs: { issueUnsubscribeToken: jest.Mock };
  let svc: OnboardingEmailsService;

  const envBefore: Record<string, string | undefined> = {};
  const ENV_KEYS = [
    'CALENDAR_SYNC_AVAILABLE',
    'WALKTHROUGH_VIDEO_URL',
    'SALES_EMAIL',
    'ADMIN_EMAIL',
    'OB6_REPLY_TO',
    'MAIL_REPLY_TO',
  ] as const;

  beforeEach(() => {
    for (const key of ENV_KEYS) envBefore[key] = process.env[key];
    process.env.SALES_EMAIL = 'sales@island.tours';
    delete process.env.CALENDAR_SYNC_AVAILABLE;
    delete process.env.WALKTHROUGH_VIDEO_URL;
    delete process.env.OB6_REPLY_TO;

    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      operator: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      emailSend: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ id: 'row-1' }),
      },
      siteInfo: {
        findFirst: jest.fn().mockResolvedValue({
          logo: null,
          whatsappNumber: '+599 9 561 22 43',
          enableWhatsappChat: true,
        }),
      },
      tour: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    mail = {
      sendMail: jest.fn().mockResolvedValue({ providerMessageId: 'resend-1' }),
    };
    emailLog = {
      claimAndSend: jest.fn(async (input: { send: () => Promise<unknown> }) => {
        await input.send();
        return { outcome: 'sent', providerMessageId: null };
      }),
      recordSuppressed: jest.fn().mockResolvedValue({ recorded: true }),
      isOptedOut: jest.fn().mockResolvedValue(false),
      nextResendScopeId: jest.fn().mockResolvedValue('op1#resend-1'),
    };
    prefs = { issueUnsubscribeToken: jest.fn().mockResolvedValue('tok-1') };

    svc = new OnboardingEmailsService(
      prisma as never,
      mail as never,
      emailLog as never,
      prefs as never,
    );
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (envBefore[key] === undefined) delete process.env[key];
      else process.env[key] = envBefore[key];
    }
  });

  // ── Window (D-15) ──────────────────────────────────────────────────────────

  it('outside the window: only INT1R is evaluated, no nudge query runs', async () => {
    await svc.sweep(WINDOW_CLOSED);

    // Exactly one candidate query - the window-exempt INT1R one.
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(emailLog.claimAndSend).not.toHaveBeenCalled();
    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it('inside the window with the calendar flag ON: all five nudge queries run', async () => {
    process.env.CALENDAR_SYNC_AVAILABLE = 'true';
    await svc.sweep(WINDOW_OPEN);
    // INT1R + OB6 + OB7 + OB8 + OB3 + OB4.
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(6);
  });

  it('anchors: each nudge query receives cutoff = now - its offset (D-22)', async () => {
    process.env.CALENDAR_SYNC_AVAILABLE = 'true';
    await svc.sweep(WINDOW_OPEN);
    // Pin the spec table's offsets: a wrong offsetMs constant must fail HERE,
    // not ship silently (review of #185, Major 3).
    const HOUR = 3_600_000;
    const DAY = 24 * HOUR;
    const expected: Record<string, number> = {
      [EmailTemplateKey.OB3_FIRST_TOUR_HOWTO]: 48 * HOUR,
      [EmailTemplateKey.OB4_BUILD_IT_WITH_YOU]: 7 * DAY,
      [EmailTemplateKey.OB6_CHECK_IN]: 14 * DAY,
      [EmailTemplateKey.OB7_CONNECT_CALENDAR]: 3 * DAY,
      [EmailTemplateKey.OB8_PAGE_STRONGER]: 7 * DAY,
    };
    const seen: Record<string, number> = {};
    for (const call of prisma.$queryRaw.mock.calls) {
      const values = call.slice(1) as unknown[];
      const key = values.find((v) => typeof v === 'string' && v in expected) as
        | string
        | undefined;
      const cutoff = values.find((v) => v instanceof Date);
      if (key && cutoff) {
        seen[key] = WINDOW_OPEN.getTime() - cutoff.getTime();
      }
    }
    expect(seen).toEqual(expected);
  });

  // ── The send path (D-16, D-10, D-28) ───────────────────────────────────────

  it('sends a due OB-3 through claimAndSend with the opt-out link and one-click headers', async () => {
    prisma.$queryRaw.mockImplementation(
      candidatesByKey({ OB3_FIRST_TOUR_HOWTO: ['op1'] }),
    );
    prisma.operator.findMany.mockResolvedValue([operatorRow()]);

    await svc.sweep(WINDOW_OPEN);

    expect(prefs.issueUnsubscribeToken).toHaveBeenCalledWith(
      'mayra@irietours.com',
      'OPERATOR',
      'LIFECYCLE',
    );
    expect(emailLog.claimAndSend).toHaveBeenCalledTimes(1);
    expect(emailLog.claimAndSend).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: EmailTemplateKey.OB3_FIRST_TOUR_HOWTO,
        scopeId: 'op1',
        toEmail: 'mayra@irietours.com',
        stream: EmailStream.LIFECYCLE,
      }),
    );
    const sent = mail.sendMail.mock.calls[0][0] as {
      html: string;
      headers: Record<string, string>;
      subject: string;
    };
    expect(sent.subject).toBe('Your first tour, step by step');
    expect(sent.html).toContain('/unsubscribe/tok-1');
    // D-28: header values are env-base + server-minted token only.
    expect(sent.headers['List-Unsubscribe']).toContain(
      '/api/v1/email/unsubscribe/tok-1',
    );
    expect(sent.headers['List-Unsubscribe-Post']).toBe(
      'List-Unsubscribe=One-Click',
    );
  });

  // ── Suppressions (D-12/D-13) ───────────────────────────────────────────────

  it('kills OB-3/OB-4 once a tour is submitted, with reason rows', async () => {
    prisma.$queryRaw.mockImplementation(
      candidatesByKey({
        OB3_FIRST_TOUR_HOWTO: ['op1'],
        OB4_BUILD_IT_WITH_YOU: ['op1'],
      }),
    );
    prisma.operator.findMany.mockResolvedValue([
      operatorRow({ _count: { tours: 2, calendarFeeds: 0 } }),
    ]);

    await svc.sweep(WINDOW_OPEN);

    expect(emailLog.claimAndSend).not.toHaveBeenCalled();
    expect(emailLog.recordSuppressed).toHaveBeenCalledTimes(2);
    for (const key of [
      EmailTemplateKey.OB3_FIRST_TOUR_HOWTO,
      EmailTemplateKey.OB4_BUILD_IT_WITH_YOU,
    ]) {
      expect(emailLog.recordSuppressed).toHaveBeenCalledWith(
        expect.objectContaining({
          templateKey: key,
          scopeId: 'op1',
          reason: 'tours-submitted',
        }),
      );
    }
  });

  it('suspension kills the WHOLE due set, one reason row per key', async () => {
    process.env.CALENDAR_SYNC_AVAILABLE = 'true';
    prisma.$queryRaw.mockImplementation(
      candidatesByKey({
        OB6_CHECK_IN: ['op1'],
        OB7_CONNECT_CALENDAR: ['op1'],
      }),
    );
    prisma.operator.findMany.mockResolvedValue([
      operatorRow({ isActive: false }),
    ]);

    await svc.sweep(WINDOW_OPEN);

    expect(emailLog.claimAndSend).not.toHaveBeenCalled();
    expect(emailLog.recordSuppressed).toHaveBeenCalledTimes(2);
    expect(emailLog.recordSuppressed).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: EmailTemplateKey.OB6_CHECK_IN,
        reason: 'suspended',
      }),
    );
    // Suspension short-circuits before the opt-out read.
    expect(emailLog.isOptedOut).not.toHaveBeenCalled();
  });

  it('a LIFECYCLE opt-out kills the due set with opted-out rows', async () => {
    prisma.$queryRaw.mockImplementation(
      candidatesByKey({ OB6_CHECK_IN: ['op1'] }),
    );
    prisma.operator.findMany.mockResolvedValue([operatorRow()]);
    emailLog.isOptedOut.mockResolvedValue(true);

    await svc.sweep(WINDOW_OPEN);

    expect(emailLog.claimAndSend).not.toHaveBeenCalled();
    expect(emailLog.recordSuppressed).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: EmailTemplateKey.OB6_CHECK_IN,
        reason: 'opted-out',
      }),
    );
  });

  it('OB-7 flag off = "not yet": the candidate query is SKIPPED, no row burned', async () => {
    // A SUPPRESSED row would occupy the unique slot forever - every operator
    // passing live+3d pre-launch would be permanently excluded from OB-7.
    // The anti-join re-finds them all when the flag flips (review Major 2).
    prisma.$queryRaw.mockImplementation(
      candidatesByKey({ OB7_CONNECT_CALENDAR: ['op1'] }),
    );
    prisma.operator.findMany.mockResolvedValue([operatorRow()]);

    await svc.sweep(WINDOW_OPEN);

    const queriedKeys = prisma.$queryRaw.mock.calls
      .flatMap((c: unknown[]) => c.slice(1))
      .filter((v: unknown) => typeof v === 'string');
    expect(queriedKeys).not.toContain(EmailTemplateKey.OB7_CONNECT_CALENDAR);
    expect(emailLog.claimAndSend).not.toHaveBeenCalled();
    expect(emailLog.recordSuppressed).not.toHaveBeenCalled();
  });

  it('OB-7 with the flag on but a connected feed → calendar-connected row', async () => {
    process.env.CALENDAR_SYNC_AVAILABLE = 'true';
    prisma.$queryRaw.mockImplementation(
      candidatesByKey({ OB7_CONNECT_CALENDAR: ['op1'] }),
    );
    prisma.operator.findMany.mockResolvedValue([
      operatorRow({ _count: { tours: 3, calendarFeeds: 1 } }),
    ]);

    await svc.sweep(WINDOW_OPEN);

    expect(emailLog.recordSuppressed).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'calendar-connected' }),
    );
    expect(emailLog.claimAndSend).not.toHaveBeenCalled();
  });

  it('OB-7 with the flag on and no feed sends', async () => {
    process.env.CALENDAR_SYNC_AVAILABLE = 'true';
    prisma.$queryRaw.mockImplementation(
      candidatesByKey({ OB7_CONNECT_CALENDAR: ['op1'] }),
    );
    prisma.operator.findMany.mockResolvedValue([
      operatorRow({ _count: { tours: 3, calendarFeeds: 0 } }),
    ]);

    await svc.sweep(WINDOW_OPEN);

    expect(emailLog.claimAndSend).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: EmailTemplateKey.OB7_CONNECT_CALENDAR,
      }),
    );
  });

  // ── Volume cap + priority (D-14) ───────────────────────────────────────────

  it('skips (does NOT suppress) an operator whose latest lifecycle send is <3 days old', async () => {
    prisma.$queryRaw.mockImplementation(
      candidatesByKey({ OB6_CHECK_IN: ['op1'] }),
    );
    prisma.operator.findMany.mockResolvedValue([operatorRow()]);
    prisma.emailSend.findMany.mockResolvedValue([{ status: 'SENT' }]);

    await svc.sweep(WINDOW_OPEN);

    expect(emailLog.claimAndSend).not.toHaveBeenCalled();
    // A cap skip is "not yet", never a decision row.
    expect(emailLog.recordSuppressed).not.toHaveBeenCalled();
  });

  it('a recent SUPPRESSED row does not consume the cap (only real sends do)', async () => {
    prisma.$queryRaw.mockImplementation(
      candidatesByKey({ OB6_CHECK_IN: ['op1'] }),
    );
    prisma.operator.findMany.mockResolvedValue([operatorRow()]);
    prisma.emailSend.findMany.mockResolvedValue([{ status: 'SUPPRESSED' }]);

    await svc.sweep(WINDOW_OPEN);

    expect(emailLog.claimAndSend).toHaveBeenCalledTimes(1);
  });

  it('several nudges due at once → only the highest priority goes (OB-6 over OB-7/OB-8)', async () => {
    process.env.CALENDAR_SYNC_AVAILABLE = 'true';
    prisma.$queryRaw.mockImplementation(
      candidatesByKey({
        OB6_CHECK_IN: ['op1'],
        OB7_CONNECT_CALENDAR: ['op1'],
        OB8_PAGE_STRONGER: ['op1'],
      }),
    );
    prisma.operator.findMany.mockResolvedValue([
      operatorRow({ _count: { tours: 1, calendarFeeds: 0 } }),
    ]);

    await svc.sweep(WINDOW_OPEN);

    expect(emailLog.claimAndSend).toHaveBeenCalledTimes(1);
    expect(emailLog.claimAndSend).toHaveBeenCalledWith(
      expect.objectContaining({ templateKey: EmailTemplateKey.OB6_CHECK_IN }),
    );
  });

  it('OB-6 carries the founder reply-to when OB6_REPLY_TO is set', async () => {
    process.env.OB6_REPLY_TO = 'denley@island.tours';
    prisma.$queryRaw.mockImplementation(
      candidatesByKey({ OB6_CHECK_IN: ['op1'] }),
    );
    prisma.operator.findMany.mockResolvedValue([operatorRow()]);

    await svc.sweep(WINDOW_OPEN);

    expect(mail.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ replyTo: 'denley@island.tours' }),
    );
  });

  // ── INT1R (D-18) ───────────────────────────────────────────────────────────

  it('INT1R sends to the sales recipient and stamps salesPendingReminderAt once', async () => {
    prisma.$queryRaw.mockImplementation(
      candidatesByKey({ INT1R_PENDING_REMINDER: ['op1'] }),
    );
    prisma.operator.findMany.mockResolvedValue([
      operatorRow({ verificationStatus: 'PENDING' }),
    ]);

    await svc.sweep(WINDOW_CLOSED); // window-exempt

    expect(emailLog.claimAndSend).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: EmailTemplateKey.INT1R_PENDING_REMINDER,
        scopeId: 'op1',
        toEmail: 'sales@island.tours',
        stream: EmailStream.INTERNAL,
      }),
    );
    expect(prisma.operator.updateMany).toHaveBeenCalledWith({
      where: { id: 'op1', salesPendingReminderAt: null },
      data: { salesPendingReminderAt: WINDOW_CLOSED },
    });
  });

  it('INT1R with no sales mailbox: no claim, no stamp (fires when env appears)', async () => {
    delete process.env.SALES_EMAIL;
    delete process.env.ADMIN_EMAIL;
    prisma.$queryRaw.mockImplementation(
      candidatesByKey({ INT1R_PENDING_REMINDER: ['op1'] }),
    );

    await svc.sweep(WINDOW_CLOSED);

    expect(emailLog.claimAndSend).not.toHaveBeenCalled();
    expect(prisma.operator.updateMany).not.toHaveBeenCalled();
  });

  it('INT1R for a suspended operator suppresses instead of mailing sales', async () => {
    prisma.$queryRaw.mockImplementation(
      candidatesByKey({ INT1R_PENDING_REMINDER: ['op1'] }),
    );
    prisma.operator.findMany.mockResolvedValue([
      operatorRow({ verificationStatus: 'PENDING', isActive: false }),
    ]);

    await svc.sweep(WINDOW_CLOSED);

    expect(emailLog.claimAndSend).not.toHaveBeenCalled();
    expect(emailLog.recordSuppressed).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: EmailTemplateKey.INT1R_PENDING_REMINDER,
        reason: 'suspended',
      }),
    );
  });

  // ── OB-5 job path (D-17, D-26) ─────────────────────────────────────────────

  it('OB-5: sends transactionally for a VERIFIED operator with a live tour', async () => {
    prisma.operator.findUnique.mockResolvedValue(operatorRow());
    prisma.tour.findFirst.mockResolvedValue({
      name: 'Sunset Cruise along Spanish Water',
      slug: 'sunset-cruise-spanish-water',
      destination: { slug: 'curacao' },
    });

    await svc.runOnboardingEmailJob({
      operatorId: 'op1',
      templateKey: EmailTemplateKey.OB5_TOUR_LIVE,
    });

    expect(emailLog.claimAndSend).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: EmailTemplateKey.OB5_TOUR_LIVE,
        scopeId: 'op1',
        stream: EmailStream.TRANSACTIONAL,
      }),
    );
    const sent = mail.sendMail.mock.calls[0][0] as {
      subject: string;
      html: string;
    };
    expect(sent.subject).toBe(
      'Your tour is live: Sunset Cruise along Spanish Water',
    );
    expect(sent.html).toContain('/curacao/sunset-cruise-spanish-water');
  });

  it('OB-5: an unverified (shadow/ADMIN) operator never enters the drip (D-26)', async () => {
    prisma.operator.findUnique.mockResolvedValue(
      operatorRow({ verificationStatus: 'UNVERIFIED' }),
    );

    await svc.runOnboardingEmailJob({
      operatorId: 'op1',
      templateKey: EmailTemplateKey.OB5_TOUR_LIVE,
    });

    expect(emailLog.claimAndSend).not.toHaveBeenCalled();
    expect(emailLog.recordSuppressed).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: EmailTemplateKey.OB5_TOUR_LIVE,
        reason: 'not-verified',
      }),
    );
  });

  // ── Resend (D-20/D-27) ─────────────────────────────────────────────────────

  it('resend writes the next #resend-{n} row and returns it', async () => {
    prisma.operator.findUnique.mockResolvedValue(operatorRow());

    const row = await svc.resend('op1', 'OB3_FIRST_TOUR_HOWTO');

    expect(emailLog.nextResendScopeId).toHaveBeenCalledWith(
      EmailTemplateKey.OB3_FIRST_TOUR_HOWTO,
      'op1',
    );
    expect(emailLog.claimAndSend).toHaveBeenCalledTimes(1);
    expect(emailLog.claimAndSend).toHaveBeenCalledWith(
      expect.objectContaining({ scopeId: 'op1#resend-1' }),
    );
    // recipientOptedOut surfaced so an admin overriding an unsubscribe does
    // it knowingly (security review of #185, Low 2).
    expect(row).toEqual({ id: 'row-1', recipientOptedOut: false });
  });

  it('resend retries ONCE with n+1 when a concurrent resend won the claim (D-27)', async () => {
    prisma.operator.findUnique.mockResolvedValue(operatorRow());
    emailLog.nextResendScopeId
      .mockResolvedValueOnce('op1#resend-1')
      .mockResolvedValueOnce('op1#resend-2');
    emailLog.claimAndSend
      .mockResolvedValueOnce({ outcome: 'skipped', reason: 'already-sent' })
      .mockImplementationOnce(
        async (input: { send: () => Promise<unknown> }) => {
          await input.send();
          return { outcome: 'sent', providerMessageId: null };
        },
      );

    await svc.resend('op1', 'OB6_CHECK_IN');

    expect(emailLog.claimAndSend).toHaveBeenCalledTimes(2);
    expect(emailLog.claimAndSend).toHaveBeenLastCalledWith(
      expect.objectContaining({ scopeId: 'op1#resend-2' }),
    );
  });

  it('resend 400s for a non-onboarding key without touching the operator', async () => {
    await expect(svc.resend('op1', 'BK1_CONFIRMATION')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(svc.resend('op1', 'not-a-key')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.operator.findUnique).not.toHaveBeenCalled();
  });

  it('resend of OB-5 with no live tour is a 400, not a broken email', async () => {
    prisma.operator.findUnique.mockResolvedValue(operatorRow());
    prisma.tour.findFirst.mockResolvedValue(null);

    await expect(svc.resend('op1', 'OB5_TOUR_LIVE')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(emailLog.claimAndSend).not.toHaveBeenCalled();
  });
});
