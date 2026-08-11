import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { salesRecipient } from '@/common/utils/sales-recipient.util';

/**
 * Built-in defaults for every EmailSettings field that has no env fallback
 * (EMAIL-IMPLEMENTATION-PLAN.md §4 WP-H, the pinned contract of PR #190).
 * These are the values the programme shipped with in WP-A…WP-G — moving them
 * here changes NOTHING until an admin stores an override.
 */
export const EMAIL_SETTINGS_BUILTINS = {
  onboardingEnabled: true,
  ob8PartnerOffer: true, // founder decision D6
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
} as const;

/** How long one resolve() result serves before the row is re-read (~60s). */
export const SETTINGS_CACHE_TTL_MS = 60_000;

/**
 * The EFFECTIVE email-programme configuration — every value already resolved
 * through `stored ?? env ?? built-in`. Consumers never look at env or the raw
 * row; this object is the single truth for one sweep tick / one send.
 */
export interface EffectiveEmailSettings {
  marketingEnabled: boolean;
  onboardingEnabled: boolean;
  calendarEmailEnabled: boolean;
  ob8PartnerOffer: boolean;
  salesEmail: string | null;
  mailReplyTo: string | null;
  ob6ReplyTo: string | null;
  ob3DelayHours: number;
  ob4DelayDays: number;
  ob6DelayDays: number;
  ob7AfterLiveDays: number;
  ob8AfterLiveDays: number;
  pendingReminderBusinessDays: number;
  /** Normalized csv of lowercase day names, e.g. "tue,wed,thu". */
  windowWeekdays: string;
  windowStartHour: number;
  windowEndHour: number;
  mk1DelayHours: number;
}

/** The raw stored row shape — every field nullable (null = use fallback). */
export type StoredEmailSettings = {
  [K in keyof EffectiveEmailSettings]: EffectiveEmailSettings[K] | null;
};

const ALL_NULL_STORED: StoredEmailSettings = {
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

/**
 * WP-H (checklist H-02): the single reader of the `email_settings` singleton.
 *
 * ## Resolution rule (the §4 pinned contract)
 * `stored value ?? env fallback ?? built-in default`. A null column means
 * "the admin never touched this" and the programme behaves exactly as it did
 * before WP-H — zero-risk rollout. Env fallbacks: MK1_ENABLED,
 * CALENDAR_SYNC_AVAILABLE, SALES_EMAIL ?? ADMIN_EMAIL (via salesRecipient),
 * MAIL_REPLY_TO, OB6_REPLY_TO ?? effective mailReplyTo.
 *
 * ## Cache
 * `resolve()` caches for ~60s so the 15-minute sweep, MailService's per-send
 * reply-to default and the INT-1/INT-2 alert paths never turn one email into
 * one settings query each. The email-centre PATCH drops the cache in-process;
 * other processes (workers) converge within the TTL — every timing consumer
 * resolves per tick, so a 60s-stale offset only delays a nudge by one tick.
 *
 * ## No switch for booking emails — by construction
 * BK-1/BK-2/CX-1 are contractual (founder decision 2026-08-11). This service
 * exposes no flag for them, the model has no column, and the PATCH DTO
 * whitelists nothing of the kind — `forbidNonWhitelisted` rejects any attempt.
 */
@Injectable()
export class EmailSettingsService {
  private readonly logger = new Logger(EmailSettingsService.name);

  private cache: { value: EffectiveEmailSettings; expiresAt: number } | null =
    null;

  constructor(private readonly prisma: PrismaService) {}

  /** The effective configuration, cached ~60s. */
  async resolve(now: Date = new Date()): Promise<EffectiveEmailSettings> {
    if (this.cache && this.cache.expiresAt > now.getTime()) {
      return this.cache.value;
    }
    const stored = await this.stored();
    const value = EmailSettingsService.effective(stored);
    this.cache = { value, expiresAt: now.getTime() + SETTINGS_CACHE_TTL_MS };
    return value;
  }

  /**
   * Drop the cache. Called by the email-centre PATCH so an admin edit is
   * live on the very next send in this process.
   */
  invalidate(): void {
    this.cache = null;
  }

  /** The raw stored row (all-null shape when no row exists yet). */
  async stored(): Promise<StoredEmailSettings> {
    const row = await this.prisma.emailSettings.findUnique({
      where: { id: 'default' },
    });
    if (!row) return { ...ALL_NULL_STORED };
    return {
      marketingEnabled: row.marketingEnabled,
      onboardingEnabled: row.onboardingEnabled,
      calendarEmailEnabled: row.calendarEmailEnabled,
      ob8PartnerOffer: row.ob8PartnerOffer,
      salesEmail: row.salesEmail,
      mailReplyTo: row.mailReplyTo,
      ob6ReplyTo: row.ob6ReplyTo,
      ob3DelayHours: row.ob3DelayHours,
      ob4DelayDays: row.ob4DelayDays,
      ob6DelayDays: row.ob6DelayDays,
      ob7AfterLiveDays: row.ob7AfterLiveDays,
      ob8AfterLiveDays: row.ob8AfterLiveDays,
      pendingReminderBusinessDays: row.pendingReminderBusinessDays,
      windowWeekdays: row.windowWeekdays,
      windowStartHour: row.windowStartHour,
      windowEndHour: row.windowEndHour,
      mk1DelayHours: row.mk1DelayHours,
    };
  }

  /**
   * What every field falls back to when its column is null — env value where
   * one exists, else the built-in. This is what the dashboard renders as the
   * "using default (…)" hint, and by definition `effective(all-null) ===
   * defaults()`.
   */
  static defaults(): EffectiveEmailSettings {
    return EmailSettingsService.effective(ALL_NULL_STORED);
  }

  /** Pure `stored ?? env ?? built-in` fold — exported for the spec matrix. */
  static effective(stored: StoredEmailSettings): EffectiveEmailSettings {
    const mailReplyTo =
      stored.mailReplyTo ?? (process.env.MAIL_REPLY_TO?.trim() || null);
    return {
      marketingEnabled:
        stored.marketingEnabled ?? process.env.MK1_ENABLED?.trim() === 'true',
      onboardingEnabled:
        stored.onboardingEnabled ?? EMAIL_SETTINGS_BUILTINS.onboardingEnabled,
      calendarEmailEnabled:
        stored.calendarEmailEnabled ??
        process.env.CALENDAR_SYNC_AVAILABLE?.trim() === 'true',
      ob8PartnerOffer:
        stored.ob8PartnerOffer ?? EMAIL_SETTINGS_BUILTINS.ob8PartnerOffer,
      salesEmail: stored.salesEmail ?? salesRecipient(),
      mailReplyTo,
      // The OB-6 reply-to cascades one level deeper (§4): env OB6_REPLY_TO,
      // then the (already resolved) default reply-to.
      ob6ReplyTo:
        stored.ob6ReplyTo ??
        (process.env.OB6_REPLY_TO?.trim() || null) ??
        mailReplyTo,
      ob3DelayHours:
        stored.ob3DelayHours ?? EMAIL_SETTINGS_BUILTINS.ob3DelayHours,
      ob4DelayDays: stored.ob4DelayDays ?? EMAIL_SETTINGS_BUILTINS.ob4DelayDays,
      ob6DelayDays: stored.ob6DelayDays ?? EMAIL_SETTINGS_BUILTINS.ob6DelayDays,
      ob7AfterLiveDays:
        stored.ob7AfterLiveDays ?? EMAIL_SETTINGS_BUILTINS.ob7AfterLiveDays,
      ob8AfterLiveDays:
        stored.ob8AfterLiveDays ?? EMAIL_SETTINGS_BUILTINS.ob8AfterLiveDays,
      pendingReminderBusinessDays:
        stored.pendingReminderBusinessDays ??
        EMAIL_SETTINGS_BUILTINS.pendingReminderBusinessDays,
      windowWeekdays:
        stored.windowWeekdays ?? EMAIL_SETTINGS_BUILTINS.windowWeekdays,
      windowStartHour:
        stored.windowStartHour ?? EMAIL_SETTINGS_BUILTINS.windowStartHour,
      windowEndHour:
        stored.windowEndHour ?? EMAIL_SETTINGS_BUILTINS.windowEndHour,
      mk1DelayHours:
        stored.mk1DelayHours ?? EMAIL_SETTINGS_BUILTINS.mk1DelayHours,
    };
  }

  /**
   * Persist a partial update (undefined = untouched, null = clear back to
   * the fallback), then drop the cache. Cross-field bounds (start < end) are
   * the email-centre service's job — it validates against the MERGED values
   * before calling this.
   */
  async store(
    patch: Partial<StoredEmailSettings>,
  ): Promise<StoredEmailSettings> {
    const data = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    const before = await this.resolve();
    await this.prisma.emailSettings.upsert({
      where: { id: 'default' },
      update: data,
      create: { id: 'default', ...data },
    });
    this.invalidate();
    const after = await this.resolve();
    // Mailing real people starts/stops here — the flips must be in the log
    // (the ReviewRequestSettings.enabled precedent).
    for (const flag of [
      'marketingEnabled',
      'onboardingEnabled',
      'calendarEmailEnabled',
    ] as const) {
      if (before[flag] !== after[flag]) {
        this.logger.log(
          `Email settings: ${flag} is now ${after[flag] ? 'ON' : 'OFF'} (effective)`,
        );
      }
    }
    return this.stored();
  }
}
