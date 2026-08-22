import {
  EMAIL_SETTINGS_BUILTINS,
  EmailSettingsService,
  SETTINGS_CACHE_TTL_MS,
  type StoredEmailSettings,
} from './email-settings.service';

/**
 * WP-H (H-02/H-09): the `stored ?? env ?? built-in` resolution matrix, the
 * ~60s cache, and the invalidate-on-PATCH contract.
 */

const ALL_NULL: StoredEmailSettings = {
  marketingEnabled: null,
  onboardingEnabled: null,
  calendarEmailEnabled: null,
  ob8PartnerOffer: null,
  salesEmail: null,
  mailReplyTo: null,
  ob6ReplyTo: null,
  ob3DelayHours: null,
  ob4DelayDays: null,
  ob6DelayDays: null,
  ob7AfterLiveDays: null,
  ob8AfterLiveDays: null,
  pendingReminderBusinessDays: null,
  windowWeekdays: null,
  windowStartHour: null,
  windowEndHour: null,
  mk1DelayHours: null,
};

const ENV_KEYS = [
  'MK1_ENABLED',
  'CALENDAR_SYNC_AVAILABLE',
  'SALES_EMAIL',
  'ADMIN_EMAIL',
  'MAIL_REPLY_TO',
  'OB6_REPLY_TO',
] as const;

describe('EmailSettingsService', () => {
  const envBefore: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      envBefore[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (envBefore[key] === undefined) delete process.env[key];
      else process.env[key] = envBefore[key];
    }
  });

  // ── The resolution matrix (pure fold) ──────────────────────────────────────

  describe('effective() — stored ?? env ?? built-in', () => {
    it('all-null + no env = the built-in defaults (zero-risk rollout)', () => {
      const eff = EmailSettingsService.effective(ALL_NULL);
      expect(eff).toEqual({
        marketingEnabled: false,
        onboardingEnabled: true,
        calendarEmailEnabled: false,
        ob8PartnerOffer: true,
        salesEmail: null,
        mailReplyTo: null,
        ob6ReplyTo: null,
        ...{
          ob3DelayHours: 48,
          ob4DelayDays: 7,
          ob6DelayDays: 14,
          ob7AfterLiveDays: 3,
          ob8AfterLiveDays: 7,
          pendingReminderBusinessDays: 2,
          windowWeekdays: 'tue,wed,thu',
          windowStartHour: 9,
          windowEndHour: 11,
          mk1DelayHours: 72,
        },
      });
      // The fold's null-branch IS the builtin table — a drift between the
      // two would silently change behaviour on rollout.
      expect(eff.onboardingEnabled).toBe(
        EMAIL_SETTINGS_BUILTINS.onboardingEnabled,
      );
      expect(eff.mk1DelayHours).toBe(EMAIL_SETTINGS_BUILTINS.mk1DelayHours);
    });

    it('env layer wins over built-ins when the column is null', () => {
      process.env.MK1_ENABLED = 'true';
      process.env.CALENDAR_SYNC_AVAILABLE = 'true';
      process.env.SALES_EMAIL = 'sales@env.test';
      process.env.MAIL_REPLY_TO = 'reply@env.test';
      process.env.OB6_REPLY_TO = 'founder@env.test';
      const eff = EmailSettingsService.effective(ALL_NULL);
      expect(eff.marketingEnabled).toBe(true);
      expect(eff.calendarEmailEnabled).toBe(true);
      expect(eff.salesEmail).toBe('sales@env.test');
      expect(eff.mailReplyTo).toBe('reply@env.test');
      expect(eff.ob6ReplyTo).toBe('founder@env.test');
    });

    it('SALES_EMAIL falls back to ADMIN_EMAIL (the salesRecipient rule)', () => {
      process.env.ADMIN_EMAIL = 'admin@env.test';
      expect(EmailSettingsService.effective(ALL_NULL).salesEmail).toBe(
        'admin@env.test',
      );
    });

    it('ob6ReplyTo cascades OB6_REPLY_TO → effective mailReplyTo', () => {
      process.env.MAIL_REPLY_TO = 'reply@env.test';
      expect(EmailSettingsService.effective(ALL_NULL).ob6ReplyTo).toBe(
        'reply@env.test',
      );
      const stored = { ...ALL_NULL, mailReplyTo: 'reply@stored.test' };
      expect(EmailSettingsService.effective(stored).ob6ReplyTo).toBe(
        'reply@stored.test',
      );
    });

    it('stored values win over BOTH env and built-ins', () => {
      process.env.MK1_ENABLED = 'true';
      process.env.SALES_EMAIL = 'sales@env.test';
      const stored: StoredEmailSettings = {
        ...ALL_NULL,
        marketingEnabled: false, // stored false beats env true
        onboardingEnabled: false,
        salesEmail: 'sales@stored.test',
        ob3DelayHours: 6,
        windowWeekdays: 'mon,fri',
        windowStartHour: 14,
        windowEndHour: 16,
        mk1DelayHours: 24,
      };
      const eff = EmailSettingsService.effective(stored);
      expect(eff.marketingEnabled).toBe(false);
      expect(eff.onboardingEnabled).toBe(false);
      expect(eff.salesEmail).toBe('sales@stored.test');
      expect(eff.ob3DelayHours).toBe(6);
      expect(eff.windowWeekdays).toBe('mon,fri');
      expect(eff.windowStartHour).toBe(14);
      expect(eff.windowEndHour).toBe(16);
      expect(eff.mk1DelayHours).toBe(24);
    });

    it('defaults() is exactly effective(all-null) — the dashboard hint set', () => {
      process.env.SALES_EMAIL = 'sales@env.test';
      expect(EmailSettingsService.defaults()).toEqual(
        EmailSettingsService.effective(ALL_NULL),
      );
    });
  });

  // ── Cache behaviour ─────────────────────────────────────────────────────────

  describe('resolve() cache', () => {
    function build(row: Partial<StoredEmailSettings> | null = null) {
      const findUnique = jest.fn().mockResolvedValue(row);
      const upsert = jest.fn().mockResolvedValue({});
      const svc = new EmailSettingsService({
        emailSettings: { findUnique, upsert },
      } as never);
      return { svc, findUnique, upsert };
    }

    it('serves from cache inside the TTL — one row read for many resolves', async () => {
      const { svc, findUnique } = build(null);
      const t0 = new Date('2026-08-11T12:00:00.000Z');
      await svc.resolve(t0);
      await svc.resolve(new Date(t0.getTime() + SETTINGS_CACHE_TTL_MS - 1));
      expect(findUnique).toHaveBeenCalledTimes(1);
    });

    it('re-reads after the TTL', async () => {
      const { svc, findUnique } = build(null);
      const t0 = new Date('2026-08-11T12:00:00.000Z');
      await svc.resolve(t0);
      await svc.resolve(new Date(t0.getTime() + SETTINGS_CACHE_TTL_MS + 1));
      expect(findUnique).toHaveBeenCalledTimes(2);
    });

    it('invalidate() drops the cache immediately (the PATCH contract)', async () => {
      const { svc, findUnique } = build(null);
      const t0 = new Date('2026-08-11T12:00:00.000Z');
      await svc.resolve(t0);
      svc.invalidate();
      await svc.resolve(new Date(t0.getTime() + 1));
      expect(findUnique).toHaveBeenCalledTimes(2);
    });

    it('store() persists only defined keys, then resolves fresh', async () => {
      const { svc, findUnique, upsert } = build(null);
      await svc.resolve(); // warm the cache
      await svc.store({ ob3DelayHours: 12, salesEmail: undefined });
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'default' },
          update: { ob3DelayHours: 12 },
          create: { id: 'default', ob3DelayHours: 12 },
        }),
      );
      // resolve → store(resolve before/after) → stored: the cache was
      // dropped, so the row is re-read rather than served stale.
      expect(findUnique.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('a stored row round-trips through resolve()', async () => {
      const { svc } = build({
        marketingEnabled: true,
        onboardingEnabled: null,
        calendarEmailEnabled: null,
        ob8PartnerOffer: null,
        salesEmail: null,
        mailReplyTo: null,
        ob6ReplyTo: null,
        ob3DelayHours: 24,
        ob4DelayDays: null,
        ob6DelayDays: null,
        ob7AfterLiveDays: null,
        ob8AfterLiveDays: null,
        pendingReminderBusinessDays: null,
        windowWeekdays: null,
        windowStartHour: null,
        windowEndHour: null,
        mk1DelayHours: null,
      });
      const eff = await svc.resolve();
      expect(eff.marketingEnabled).toBe(true);
      expect(eff.ob3DelayHours).toBe(24);
      expect(eff.ob4DelayDays).toBe(7); // untouched → built-in
    });
  });
});
