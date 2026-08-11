import { DEFAULTS as REVIEW_REQUEST_DEFAULTS } from '@/reviews/review-requests.service';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  EmailSettingsService,
  type StoredEmailSettings,
} from './email-settings.service';
import { TIMELINE_SELECT } from './email-log.service';
import type {
  EmailSendsQueryDto,
  EmailPeopleQueryDto,
  UpdateEmailSettingsDto,
  UpdateReviewSettingsSliceDto,
} from './dto/email-centre.dto';

/** The ReviewRequestSettings fields the switchboard carries (H-04). */
const REVIEW_SLICE_SELECT = {
  enabled: true,
  firstSendLocalHour: true,
  firstSendDelayDays: true,
  reminderAfterDays: true,
  giveUpAfterDays: true,
} satisfies Prisma.ReviewRequestSettingsSelect;

/**
 * Schema defaults of the review slice — the dashboard's "default" hints.
 * DERIVED from ReviewRequestsService.DEFAULTS (the sweeper's own fallback
 * table) so the number lives in one place (review of #192, minor 5).
 */
const REVIEW_SLICE_DEFAULTS = {
  enabled: REVIEW_REQUEST_DEFAULTS.enabled,
  firstSendLocalHour: REVIEW_REQUEST_DEFAULTS.firstSendLocalHour,
  firstSendDelayDays: REVIEW_REQUEST_DEFAULTS.firstSendDelayDays,
  reminderAfterDays: REVIEW_REQUEST_DEFAULTS.reminderAfterDays,
  giveUpAfterDays: REVIEW_REQUEST_DEFAULTS.giveUpAfterDays,
};

/**
 * WP-H (H-04…H-06): the dashboard email centre's read/write surface —
 * settings switchboard + the three global lists (activity, opt-outs,
 * consents). Test-sends live in their own service (EmailTestSendService).
 *
 * The review-request schedule is READ AND WRITTEN THROUGH HERE as part of
 * the same settings payload (one switchboard, no second screen) but stays in
 * ITS table — `ReviewRequestSettings` remains the single source the BK-3
 * sweeper reads, and `/settings/review-requests` keeps working unchanged.
 */
@Injectable()
export class EmailCentreService {
  private readonly logger = new Logger(EmailCentreService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailSettings: EmailSettingsService,
  ) {}

  // ── Settings (H-04) ────────────────────────────────────────────────────────

  /** `{ effective, stored, defaults }` — see EmailSettingsResponseDto. */
  async getSettings() {
    const stored = await this.emailSettings.stored();
    const review = await this.reviewSlice();
    return {
      effective: {
        ...EmailSettingsService.effective(stored),
        review,
      },
      stored: { ...stored, review },
      defaults: {
        ...EmailSettingsService.defaults(),
        review: { ...REVIEW_SLICE_DEFAULTS },
      },
    };
  }

  /**
   * PATCH: tri-state per field (absent = untouched, null = clear override,
   * value = store); the `review` slice routes to ReviewRequestSettings.
   * Cross-field bound (start < end) is validated against the MERGED
   * effective values — a PATCH that only moves one endpoint cannot sneak an
   * empty or inverted window past per-field validation.
   */
  async updateSettings(dto: UpdateEmailSettingsDto, actor: { id: string }) {
    const { review, ...emailPatch } = dto;
    // The review slice's columns are NOT NULL - an explicit null has no
    // meaning and would 500 inside Prisma; say so properly (sec review L3).
    if (review) {
      const nullKey = Object.entries(review).find(([, v]) => v === null)?.[0];
      if (nullKey) {
        throw new BadRequestException(
          `review.${nullKey} cannot be null - review settings have no ` +
            'env fallback to clear back to; send a value or omit the field',
        );
      }
    }

    const patch: Partial<StoredEmailSettings> = {
      ...emailPatch,
      // Normalize: weekday csv lowercase, addresses trimmed.
      ...(typeof emailPatch.windowWeekdays === 'string'
        ? { windowWeekdays: emailPatch.windowWeekdays.trim().toLowerCase() }
        : {}),
      ...(typeof emailPatch.salesEmail === 'string'
        ? { salesEmail: emailPatch.salesEmail.trim() }
        : {}),
      ...(typeof emailPatch.mailReplyTo === 'string'
        ? { mailReplyTo: emailPatch.mailReplyTo.trim() }
        : {}),
      ...(typeof emailPatch.ob6ReplyTo === 'string'
        ? { ob6ReplyTo: emailPatch.ob6ReplyTo.trim() }
        : {}),
    };

    const current = await this.emailSettings.stored();
    const merged: StoredEmailSettings = { ...current };
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) {
        (merged as Record<string, unknown>)[key] = value;
      }
    }
    const effective = EmailSettingsService.effective(merged);
    if (effective.windowStartHour >= effective.windowEndHour) {
      throw new BadRequestException(
        `The send window must be non-empty: start hour ${effective.windowStartHour} ` +
          `is not before end hour ${effective.windowEndHour} (effective values)`,
      );
    }

    if (
      Object.keys(patch).some(
        (k) => patch[k as keyof typeof patch] !== undefined,
      )
    ) {
      await this.emailSettings.store(patch);
      // Post-write belt (review of #192, minor 3): two concurrent PATCHes
      // can each validate against stale state and persist an inverted
      // window, which would silently close every nudge and MK-1. Re-check
      // what actually landed; roll back to the built-ins on inversion.
      const landed = EmailSettingsService.effective(
        await this.emailSettings.stored(),
      );
      if (landed.windowStartHour >= landed.windowEndHour) {
        await this.emailSettings.store({
          windowStartHour: null,
          windowEndHour: null,
        });
        throw new BadRequestException(
          'Concurrent updates produced an empty send window - the window ' +
            'hours were reset to the built-in defaults; re-apply your change',
        );
      }
      this.logger.log(
        `Email settings updated by admin ${actor.id}: ${Object.keys(patch)
          .filter((k) => patch[k as keyof typeof patch] !== undefined)
          .join(', ')}`,
      );
    }
    if (review && Object.keys(review).length > 0) {
      await this.updateReviewSlice(review, actor);
    }
    return this.getSettings();
  }

  /** Singleton read, upserted on first touch (the settings.service pattern). */
  private async reviewSlice() {
    return this.prisma.reviewRequestSettings.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
      select: REVIEW_SLICE_SELECT,
    });
  }

  private async updateReviewSlice(
    slice: UpdateReviewSettingsSliceDto,
    actor: { id: string },
  ) {
    const before = await this.reviewSlice();
    const after = await this.prisma.reviewRequestSettings.update({
      where: { id: 'default' },
      data: { ...slice },
      select: REVIEW_SLICE_SELECT,
    });
    if (before.enabled !== after.enabled) {
      // The same deliberate-flip logging the /settings endpoint does — this
      // switch mails real customers.
      this.logger.log(
        `Post-tour review requests ${after.enabled ? 'ENABLED' : 'DISABLED'} ` +
          `by admin ${actor.id} (via email centre)`,
      );
    }
  }

  // ── Global activity list (H-05) ────────────────────────────────────────────

  async listSends(query: EmailSendsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const createdAt: Prisma.DateTimeFilter | undefined =
      query.from || query.to
        ? {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          }
        : undefined;
    const where: Prisma.EmailSendWhereInput = {
      ...(query.templateKey ? { templateKey: query.templateKey } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.stream ? { stream: query.stream } : {}),
      // Exact match, case-insensitive: `toEmail` is stored as the sender saw
      // it (MK-1 lowercases, the operator emails do not), so the lowercased
      // input must still find both forms.
      ...(query.toEmail
        ? {
            toEmail: {
              equals: query.toEmail.trim().toLowerCase(),
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(createdAt ? { createdAt } : {}),
    };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.emailSend.count({ where }),
      this.prisma.emailSend.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        // TIMELINE_SELECT already carries scopeId — the same projection the
        // per-operator/per-booking timelines render (H-05).
        select: TIMELINE_SELECT,
      }),
    ]);
    return { total, page, limit, data };
  }

  // ── People lists (H-06) ────────────────────────────────────────────────────

  async listOptOuts(query: EmailPeopleQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.EmailOptOutWhereInput = {
      // Prefix-or-equals on the lowercased column (opt-outs are written
      // lowercased) — startsWith covers both.
      ...(query.email
        ? { email: { startsWith: query.email.trim().toLowerCase() } }
        : {}),
    };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.emailOptOut.count({ where }),
      this.prisma.emailOptOut.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          audience: true,
          stream: true,
          source: true,
          createdAt: true,
        },
      }),
    ]);
    return { total, page, limit, data };
  }

  async listConsents(query: EmailPeopleQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.EmailConsentWhereInput = {
      ...(query.email
        ? { email: { startsWith: query.email.trim().toLowerCase() } }
        : {}),
    };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.emailConsent.count({ where }),
      this.prisma.emailConsent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          source: true,
          bookingId: true,
          createdAt: true,
        },
      }),
    ]);
    return { total, page, limit, data };
  }
}
