import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  EmailAudience,
  EmailSendStatus,
  EmailStream,
  EmailTemplateKey,
  OperatorVerificationStatus,
  Prisma,
  TourStatus,
} from '@prisma/client';
import {
  dashboardAppBase,
  islandToursBase,
  publicApiBase,
} from '@/common/utils/app-urls.util';
import { salesRecipient } from '@/common/utils/sales-recipient.util';
import { buildWhatsappUrl } from '@/common/utils/whatsapp.util';
import { PrismaService } from '@/prisma/prisma.service';
import { subtractBusinessDays } from './business-days.util';
import { EmailLogService, type ClaimAndSendResult } from './email-log.service';
import { emailSafeLogoUrl } from './email-logo.util';
import { EmailPreferencesService } from './email-preferences.service';
import { MailService } from './mail.service';
import { isLifecycleWindowOpen } from './send-window.util';
import {
  OPERATOR_APPROVED_SUBJECT,
  operatorApprovedTemplate,
  OPERATOR_BUILD_WITH_YOU_SUBJECT,
  operatorBuildWithYouTemplate,
  OPERATOR_CHECK_IN_SUBJECT,
  operatorCheckInTemplate,
  OPERATOR_CONNECT_CALENDAR_SUBJECT,
  operatorConnectCalendarTemplate,
  OPERATOR_FIRST_TOUR_HOWTO_SUBJECT,
  operatorFirstTourHowtoTemplate,
  OPERATOR_PAGE_STRONGER_SUBJECT,
  operatorPageStrongerTemplate,
  operatorPendingReminderSubject,
  operatorPendingReminderTemplate,
  operatorTourLiveSubject,
  operatorTourLiveTemplate,
  OPERATOR_WELCOME_AGREEMENT_SUBJECT,
  operatorWelcomeAgreementTemplate,
} from './templates';
import type { OnboardingEmailJobData } from '@/workers/platform-queue';

const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;

/** Candidate cap per nudge per tick — bounds a tick, the next tick resumes. */
const SWEEP_BATCH = 500;

/** Volume cap (wireframe rules): max ONE lifecycle email per operator per 3 days. */
const VOLUME_CAP_MS = 3 * DAY_MS;

/** INT1R threshold: PENDING for more than 2 business days (Sat/Sun excluded). */
const PENDING_REMINDER_BUSINESS_DAYS = 2;

/**
 * One lifecycle nudge: when is it due, and off which anchor column. Listed in
 * SEND-PRIORITY order (wireframe volume-cap rule: OB-6 > OB-7 > OB-8; OB-3/4
 * cannot collide with OB-7/8 — zero-tours vs live-tour anchors are mutually
 * exclusive — and OB-3 precedes OB-4 chronologically when both back up).
 */
interface NudgeSpec {
  key: EmailTemplateKey;
  anchor: 'verificationDecidedAt' | 'firstTourLiveAt';
  offsetMs: number;
}

const LIFECYCLE_NUDGES: readonly NudgeSpec[] = [
  {
    key: EmailTemplateKey.OB6_CHECK_IN,
    anchor: 'verificationDecidedAt',
    offsetMs: 14 * DAY_MS,
  },
  {
    key: EmailTemplateKey.OB7_CONNECT_CALENDAR,
    anchor: 'firstTourLiveAt',
    offsetMs: 3 * DAY_MS,
  },
  {
    key: EmailTemplateKey.OB8_PAGE_STRONGER,
    anchor: 'firstTourLiveAt',
    offsetMs: 7 * DAY_MS,
  },
  {
    key: EmailTemplateKey.OB3_FIRST_TOUR_HOWTO,
    anchor: 'verificationDecidedAt',
    offsetMs: 48 * HOUR_MS,
  },
  {
    key: EmailTemplateKey.OB4_BUILD_IT_WITH_YOU,
    anchor: 'verificationDecidedAt',
    offsetMs: 7 * DAY_MS,
  },
];

/** The keys the admin resend endpoint accepts (plan §2.5: OB set + OB-2A). */
const RESENDABLE_KEYS: ReadonlySet<EmailTemplateKey> = new Set([
  EmailTemplateKey.OB2_WELCOME_AGREEMENT,
  EmailTemplateKey.OB2A_APPROVED,
  EmailTemplateKey.OB3_FIRST_TOUR_HOWTO,
  EmailTemplateKey.OB4_BUILD_IT_WITH_YOU,
  EmailTemplateKey.OB5_TOUR_LIVE,
  EmailTemplateKey.OB6_CHECK_IN,
  EmailTemplateKey.OB7_CONNECT_CALENDAR,
  EmailTemplateKey.OB8_PAGE_STRONGER,
]);

/** Which stream each resendable key logs under. */
const KEY_STREAM: Readonly<Partial<Record<EmailTemplateKey, EmailStream>>> = {
  [EmailTemplateKey.OB2_WELCOME_AGREEMENT]: EmailStream.TRANSACTIONAL,
  [EmailTemplateKey.OB2A_APPROVED]: EmailStream.TRANSACTIONAL,
  [EmailTemplateKey.OB3_FIRST_TOUR_HOWTO]: EmailStream.LIFECYCLE,
  [EmailTemplateKey.OB4_BUILD_IT_WITH_YOU]: EmailStream.LIFECYCLE,
  [EmailTemplateKey.OB5_TOUR_LIVE]: EmailStream.TRANSACTIONAL,
  [EmailTemplateKey.OB6_CHECK_IN]: EmailStream.LIFECYCLE,
  [EmailTemplateKey.OB7_CONNECT_CALENDAR]: EmailStream.LIFECYCLE,
  [EmailTemplateKey.OB8_PAGE_STRONGER]: EmailStream.LIFECYCLE,
};

/** The operator projection every sender renders from. */
const OPERATOR_SELECT = {
  id: true,
  isActive: true,
  verificationStatus: true,
  createdAt: true,
  contactPhone: true,
  user: { select: { name: true, email: true } },
  companyInfo: { select: { companyName: true, companyPhone: true } },
  _count: {
    select: {
      tours: { where: { submittedAt: { not: null } } },
      calendarFeeds: { where: { revokedAt: null } },
    },
  },
} satisfies Prisma.OperatorSelect;

type OperatorRow = Prisma.OperatorGetPayload<{
  select: typeof OPERATOR_SELECT;
}>;

/** Per-tick shared context (one SiteInfo read per sweep, not per operator). */
interface SiteContext {
  siteLogoUrl: string | null;
  whatsappUrl: string | null;
}

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

/**
 * WP-D: the operator onboarding email sequence (EMAIL-PROGRAMME-CHECKLIST
 * D-11…D-19) — the 15-minute lifecycle sweep, the OB-5 outbox consumer, the
 * OB-2 welcome send, and the admin resend used by the dashboard timeline.
 *
 * Lives in the global MailModule (not WorkersModule) so NightlyJobsService
 * and PlatformJobsProcessor can inject it without new module imports and the
 * module graph stays acyclic — it reads operators/tours through Prisma
 * directly and never touches their services.
 *
 * ## Sweep shape (D-25: anti-join first, claim second)
 * Candidate queries pre-filter with `NOT EXISTS (email_sends templateKey,
 * scopeId)` — the unique index serves the anti-join — so an operator whose
 * nudge is decided (sent, failed, OR suppressed) never re-enters the
 * candidate set. `claimAndSend` closes only the residual race between two
 * concurrent ticks; it is never the primary dedupe (a P2002-rejected INSERT
 * still writes a dead tuple, and re-claiming every candidate each 15 minutes
 * is permanent autovacuum churn — perf review M1).
 *
 * ## Suppression is a decision (D-12/D-13)
 * Every deliberate non-send writes a SUPPRESSED row with a machine-readable
 * reason; the row occupies the unique slot, so suppressed operators also
 * fall out of the candidate set. The volume cap and the closed window are
 * NOT suppressions — they are "not yet", and write nothing.
 *
 * ## Shadow operators (D-26)
 * Every candidate query gates on `verificationStatus = VERIFIED`: an ADMIN's
 * auto-provisioned operator row (operator.util.ts) is UNVERIFIED forever, so
 * it never enters the drip and never even earns a suppression row. OB-5
 * re-checks at send time because it arrives via the outbox, not the sweep.
 */
@Injectable()
export class OnboardingEmailsService {
  private readonly logger = new Logger(OnboardingEmailsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly emailLog: EmailLogService,
    private readonly emailPreferences: EmailPreferencesService,
  ) {}

  // ── The 15-minute sweep tick (D-11) ────────────────────────────────────────

  /**
   * One `email.lifecycle-sweep` tick. INT1R runs every tick (internal mail is
   * window-exempt, D-15); the operator nudges only inside the Tue–Thu
   * 09:00–11:00 Curaçao window. OB-5 never runs here — it is outbox-driven.
   */
  async sweep(now: Date = new Date()): Promise<void> {
    await this.sweepPendingReminders(now);
    if (!isLifecycleWindowOpen(now)) return;
    await this.sweepLifecycleNudges(now);
  }

  // ── Lifecycle nudges: OB-3/4/6/7/8 (D-11…D-16) ─────────────────────────────

  private async sweepLifecycleNudges(now: Date): Promise<void> {
    // operatorId → due keys, kept in LIFECYCLE_NUDGES priority order.
    const due = new Map<string, EmailTemplateKey[]>();
    for (const spec of LIFECYCLE_NUDGES) {
      const cutoff = new Date(now.getTime() - spec.offsetMs);
      const ids = await this.fetchDueOperatorIds(spec, cutoff);
      for (const id of ids) {
        const keys = due.get(id) ?? [];
        keys.push(spec.key);
        due.set(id, keys);
      }
    }
    if (due.size === 0) return;

    const operators = await this.prisma.operator.findMany({
      where: { id: { in: [...due.keys()] } },
      select: OPERATOR_SELECT,
    });
    const site = await this.siteContext();

    let sent = 0;
    for (const operator of operators) {
      const keys = due.get(operator.id);
      if (!keys?.length) continue;
      const outcome = await this.evaluateOperator(operator, keys, site, now);
      if (outcome === 'sent') sent++;
    }
    this.logger.log(
      `Lifecycle sweep: ${due.size} operator(s) due, ${sent} sent`,
    );
  }

  /**
   * Due candidates for one nudge — the D-25 anti-join. `NOT EXISTS` on the
   * `[templateKey, scopeId]` unique keeps decided operators out of the set
   * entirely; the VERIFIED gate keeps shadow operators (D-26) out too. Raw
   * SQL because `email_sends` deliberately has no Prisma relation to
   * `operators` (scopeId is polymorphic).
   */
  private async fetchDueOperatorIds(
    spec: NudgeSpec,
    cutoff: Date,
  ): Promise<string[]> {
    const anchorColumn = Prisma.raw(`"${spec.anchor}"`); // fixed whitelist, never user input
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT o."id"
      FROM "operators" o
      WHERE o."verificationStatus" = 'VERIFIED'::"OperatorVerificationStatus"
        AND o.${anchorColumn} IS NOT NULL
        AND o.${anchorColumn} <= ${cutoff}
        AND NOT EXISTS (
          SELECT 1 FROM "email_sends" es
          WHERE es."templateKey" = ${spec.key}::"EmailTemplateKey"
            AND es."scopeId" = o."id"
        )
      LIMIT ${SWEEP_BATCH}
    `;
    return rows.map((r) => r.id);
  }

  /**
   * Send-time evaluation for one operator (D-12/D-13/D-14): whole-set kills
   * first (suspension, LIFECYCLE opt-out), then per-key kills, then the
   * 3-day volume cap picks AT MOST ONE survivor by priority.
   */
  private async evaluateOperator(
    operator: OperatorRow,
    dueKeys: EmailTemplateKey[],
    site: SiteContext,
    now: Date,
  ): Promise<'sent' | 'skipped'> {
    const email = operator.user.email;

    if (!operator.isActive) {
      // Suspension stops everything (wireframe rules footer).
      for (const key of dueKeys) {
        await this.suppress(key, operator.id, email, 'suspended');
      }
      return 'skipped';
    }

    if (
      await this.emailLog.isOptedOut(
        email,
        EmailAudience.OPERATOR,
        EmailStream.LIFECYCLE,
      )
    ) {
      for (const key of dueKeys) {
        await this.suppress(key, operator.id, email, 'opted-out');
      }
      return 'skipped';
    }

    const sendable: EmailTemplateKey[] = [];
    for (const key of dueKeys) {
      const reason = this.perKeySuppression(key, operator);
      if (reason) {
        await this.suppress(key, operator.id, email, reason);
      } else {
        sendable.push(key);
      }
    }
    if (sendable.length === 0) return 'skipped';

    // D-14 volume cap: newest LIFECYCLE send < 3 days old → skip (NOT a
    // suppression — the nudge is still pending and the next open window
    // retries). Status is filtered in JS on the scope's handful of recent
    // rows so the read stays on the [scopeId, createdAt] index and no
    // status-led query exists (D-29: no [status, createdAt] index needed).
    const recent = await this.prisma.emailSend.findMany({
      where: {
        scopeId: operator.id,
        stream: EmailStream.LIFECYCLE,
        createdAt: { gte: new Date(now.getTime() - VOLUME_CAP_MS) },
      },
      select: { status: true },
    });
    if (recent.some((r) => r.status === EmailSendStatus.SENT)) {
      return 'skipped';
    }

    // Highest priority only — dueKeys arrived in LIFECYCLE_NUDGES order.
    const key = sendable[0];
    const rendered = await this.renderLifecycleNudge(key, operator, site);
    const result = await this.emailLog.claimAndSend({
      templateKey: key,
      scopeId: operator.id,
      toEmail: email,
      stream: EmailStream.LIFECYCLE,
      send: () => this.sendRendered(email, rendered),
    });
    return result.outcome === 'sent' ? 'sent' : 'skipped';
  }

  /** Per-key send-time suppression (D-12); null = sendable. */
  private perKeySuppression(
    key: EmailTemplateKey,
    operator: OperatorRow,
  ): string | null {
    switch (key) {
      case EmailTemplateKey.OB3_FIRST_TOUR_HOWTO:
      case EmailTemplateKey.OB4_BUILD_IT_WITH_YOU:
        // The how-to/rescue pair exists to get the FIRST tour submitted.
        return operator._count.tours >= 1 ? 'tours-submitted' : null;
      case EmailTemplateKey.OB7_CONNECT_CALENDAR:
        // Feature-flag gated; pointless once a feed is already connected.
        if (process.env.CALENDAR_SYNC_AVAILABLE?.trim() !== 'true') {
          return 'flag-off';
        }
        return operator._count.calendarFeeds >= 1 ? 'calendar-connected' : null;
      default:
        return null;
    }
  }

  private async suppress(
    key: EmailTemplateKey,
    operatorId: string,
    email: string,
    reason: string,
  ): Promise<void> {
    await this.emailLog.recordSuppressed({
      templateKey: key,
      scopeId: operatorId,
      toEmail: email,
      stream:
        key === EmailTemplateKey.INT1R_PENDING_REMINDER
          ? EmailStream.INTERNAL
          : key === EmailTemplateKey.OB5_TOUR_LIVE
            ? EmailStream.TRANSACTIONAL
            : EmailStream.LIFECYCLE,
      reason,
    });
  }

  // ── INT1R: the 2-business-day pending reminder (D-18) ──────────────────────

  /**
   * PENDING operators older than 2 business days, one internal reminder each.
   * Window-exempt (D-15) and guarded three deep: `salesPendingReminderAt`
   * (the D-18 stamp), the anti-join, and the claim.
   */
  private async sweepPendingReminders(now: Date): Promise<void> {
    const cutoff = subtractBusinessDays(now, PENDING_REMINDER_BUSINESS_DAYS);
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT o."id"
      FROM "operators" o
      WHERE o."verificationStatus" = 'PENDING'::"OperatorVerificationStatus"
        AND o."salesPendingReminderAt" IS NULL
        AND o."createdAt" <= ${cutoff}
        AND NOT EXISTS (
          SELECT 1 FROM "email_sends" es
          WHERE es."templateKey" = ${EmailTemplateKey.INT1R_PENDING_REMINDER}::"EmailTemplateKey"
            AND es."scopeId" = o."id"
        )
      LIMIT ${SWEEP_BATCH}
    `;
    if (rows.length === 0) return;

    const to = salesRecipient();
    if (!to) {
      // No claim and no stamp: when SALES_EMAIL/ADMIN_EMAIL appear later the
      // reminder still fires (the tour-submitted log-and-skip precedent).
      this.logger.error(
        `SALES_EMAIL/ADMIN_EMAIL are not configured - ${rows.length} pending-operator reminder(s) skipped`,
      );
      return;
    }

    const operators = await this.prisma.operator.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      select: OPERATOR_SELECT,
    });
    const site = await this.siteContext();

    for (const operator of operators) {
      if (!operator.isActive) {
        await this.suppress(
          EmailTemplateKey.INT1R_PENDING_REMINDER,
          operator.id,
          to,
          'suspended',
        );
        continue;
      }
      const { html, text } = operatorPendingReminderTemplate({
        operatorName: operator.companyInfo?.companyName ?? operator.user.name,
        signatoryName: operator.user.name,
        email: operator.user.email,
        phone: operator.contactPhone ?? operator.companyInfo?.companyPhone,
        acceptedAt: operator.createdAt,
        reviewUrl: `${dashboardAppBase()}/tour-operators/${operator.id}/edit`,
        siteLogoUrl: site.siteLogoUrl,
      });
      const result = await this.emailLog.claimAndSend({
        templateKey: EmailTemplateKey.INT1R_PENDING_REMINDER,
        scopeId: operator.id,
        toEmail: to,
        stream: EmailStream.INTERNAL,
        send: () =>
          this.mail.sendMail({
            to,
            subject: operatorPendingReminderSubject(
              operator.companyInfo?.companyName ?? operator.user.name,
            ),
            html,
            text,
          }),
      });
      // Fires once (D-18): stamp on any claimed outcome — a FAILED transport
      // keeps its slot (no automated retry), so the stamp must match.
      if (result.outcome !== 'skipped') {
        await this.prisma.operator.updateMany({
          where: { id: operator.id, salesPendingReminderAt: null },
          data: { salesPendingReminderAt: now },
        });
      }
    }
  }

  // ── OB-5: outbox-driven, instant (D-17) ────────────────────────────────────

  /** Consumer for `PLATFORM_JOBS.ONBOARDING_EMAIL` (the OB-5 fan-out). */
  async runOnboardingEmailJob(data: OnboardingEmailJobData): Promise<void> {
    if (data.templateKey !== EmailTemplateKey.OB5_TOUR_LIVE) {
      this.logger.warn(
        `Onboarding email job carries unhandled template ${data.templateKey} - ignored`,
      );
      return;
    }
    await this.sendTourLive(data.operatorId);
  }

  /**
   * OB-5 "Your tour is live": transactional — no window, no opt-out check —
   * one per operator (first live tour only; the outbox event itself is
   * emitted once by the guarded `firstTourLiveAt` stamp).
   */
  private async sendTourLive(operatorId: string): Promise<void> {
    const operator = await this.prisma.operator.findUnique({
      where: { id: operatorId },
      select: OPERATOR_SELECT,
    });
    if (!operator) {
      this.logger.warn(`OB-5 for unknown operator ${operatorId} - skipped`);
      return;
    }
    if (operator.verificationStatus !== OperatorVerificationStatus.VERIFIED) {
      // D-26: an ADMIN's auto-provisioned shadow operator publishes a tour
      // like anyone else, but must never enter the drip.
      await this.suppress(
        EmailTemplateKey.OB5_TOUR_LIVE,
        operator.id,
        operator.user.email,
        'not-verified',
      );
      return;
    }
    const rendered = await this.renderTourLive(
      operator,
      await this.siteContext(),
    );
    if (!rendered) {
      this.logger.warn(
        `OB-5 for operator ${operatorId}: no live tour found - skipped`,
      );
      return;
    }
    await this.emailLog.claimAndSend({
      templateKey: EmailTemplateKey.OB5_TOUR_LIVE,
      scopeId: operator.id,
      toEmail: operator.user.email,
      stream: EmailStream.TRANSACTIONAL,
      send: () => this.sendRendered(operator.user.email, rendered),
    });
  }

  // ── OB-2: welcome + agreement, fired on operator creation (D-08) ───────────

  /**
   * Fire-and-forget from OperatorsService.create — a mail outage must never
   * roll back the account (the INT-1 contract). Hosted-link-only pending
   * founder decision D4: the template's `agreementUrl` and the transport's
   * `attachments` pathways both exist; they activate when the asset lands.
   */
  sendWelcome(operatorId: string): void {
    void (async () => {
      const operator = await this.prisma.operator.findUnique({
        where: { id: operatorId },
        select: OPERATOR_SELECT,
      });
      if (!operator) return;
      const site = await this.siteContext();
      const { html, text } = operatorWelcomeAgreementTemplate({
        firstName: OnboardingEmailsService.firstNameOf(operator),
        acceptedAt: operator.createdAt,
        // No acceptance flow records a version yet — the line degrades to
        // the dated acceptance sentence (see template JSDoc / PR notes).
        agreementVersion: null,
        agreementUrl: null,
        supportEmail: process.env.MAIL_REPLY_TO?.trim() || null,
        whatsappUrl: site.whatsappUrl,
        siteLogoUrl: site.siteLogoUrl,
      });
      await this.emailLog.claimAndSend({
        templateKey: EmailTemplateKey.OB2_WELCOME_AGREEMENT,
        scopeId: operator.id,
        toEmail: operator.user.email,
        stream: EmailStream.TRANSACTIONAL,
        send: () =>
          this.mail.sendMail({
            to: operator.user.email,
            subject: OPERATOR_WELCOME_AGREEMENT_SUBJECT,
            html,
            text,
          }),
      });
    })().catch((err: unknown) =>
      this.logger.error(
        `OB-2 welcome email failed for operator ${operatorId}`,
        err instanceof Error ? err.stack : String(err),
      ),
    );
  }

  // ── Admin resend (D-20/D-27) ───────────────────────────────────────────────

  /**
   * `POST /operators/:id/emails/:templateKey/resend`: OB set + OB-2A only.
   * Deliberately bypasses window, cap, and suppression — an explicit admin
   * action is its own authorization. Writes a `#resend-{n}` row; when two
   * concurrent resends compute the same n, the loser's claim reports
   * 'skipped' and we retry ONCE with the next n (D-27, the
   * `nextResendScopeId` JSDoc rule).
   */
  async resend(operatorId: string, templateKeyParam: string) {
    const key = (Object.values(EmailTemplateKey) as string[]).includes(
      templateKeyParam,
    )
      ? (templateKeyParam as EmailTemplateKey)
      : null;
    if (!key || !RESENDABLE_KEYS.has(key)) {
      throw new BadRequestException(
        `Template ${templateKeyParam} is not resendable - only the onboarding set (OB2…OB8, OB2A) is`,
      );
    }

    const operator = await this.prisma.operator.findUnique({
      where: { id: operatorId },
      select: OPERATOR_SELECT,
    });
    if (!operator) throw new NotFoundException('Operator not found');

    const site = await this.siteContext();
    const rendered = await this.renderForKey(key, operator, site);
    const email = operator.user.email;
    const stream = KEY_STREAM[key] ?? EmailStream.LIFECYCLE;

    let scopeId = await this.emailLog.nextResendScopeId(key, operatorId);
    let result: ClaimAndSendResult = await this.emailLog.claimAndSend({
      templateKey: key,
      scopeId,
      toEmail: email,
      stream,
      send: () => this.sendRendered(email, rendered),
    });
    if (result.outcome === 'skipped') {
      // A concurrent resend won our n — the count moved on, so recomputing
      // yields n+1. One retry only; a second collision means the admin's
      // intent (a fresh send) was satisfied milliseconds ago anyway.
      scopeId = await this.emailLog.nextResendScopeId(key, operatorId);
      result = await this.emailLog.claimAndSend({
        templateKey: key,
        scopeId,
        toEmail: email,
        stream,
        send: () => this.sendRendered(email, rendered),
      });
    }

    this.logger.log(
      `Admin resend ${key} for operator ${operatorId}: ${result.outcome} (${scopeId})`,
    );
    return this.prisma.emailSend.findUnique({
      where: { templateKey_scopeId: { templateKey: key, scopeId } },
    });
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  /** Renders any resendable key; lifecycle keys mint their opt-out link. */
  private async renderForKey(
    key: EmailTemplateKey,
    operator: OperatorRow,
    site: SiteContext,
  ): Promise<RenderedEmail> {
    switch (key) {
      case EmailTemplateKey.OB2_WELCOME_AGREEMENT: {
        const { html, text } = operatorWelcomeAgreementTemplate({
          firstName: OnboardingEmailsService.firstNameOf(operator),
          acceptedAt: operator.createdAt,
          agreementVersion: null,
          agreementUrl: null,
          supportEmail: process.env.MAIL_REPLY_TO?.trim() || null,
          whatsappUrl: site.whatsappUrl,
          siteLogoUrl: site.siteLogoUrl,
        });
        return { subject: OPERATOR_WELCOME_AGREEMENT_SUBJECT, html, text };
      }
      case EmailTemplateKey.OB2A_APPROVED: {
        const dashboardUrl = dashboardAppBase();
        const { html, text } = operatorApprovedTemplate({
          firstName: OnboardingEmailsService.firstNameOf(operator),
          companyName: operator.companyInfo?.companyName ?? operator.user.name,
          addTourUrl: `${dashboardUrl}/trips/new`,
          dashboardUrl,
          siteLogoUrl: site.siteLogoUrl,
        });
        return { subject: OPERATOR_APPROVED_SUBJECT, html, text };
      }
      case EmailTemplateKey.OB5_TOUR_LIVE: {
        const rendered = await this.renderTourLive(operator, site);
        if (!rendered) {
          throw new BadRequestException(
            'This operator has no live tour to announce',
          );
        }
        return rendered;
      }
      default:
        return this.renderLifecycleNudge(key, operator, site);
    }
  }

  /** OB-3/4/6/7/8 — issues the unsubscribe token and one-click headers. */
  private async renderLifecycleNudge(
    key: EmailTemplateKey,
    operator: OperatorRow,
    site: SiteContext,
  ): Promise<RenderedEmail> {
    const email = operator.user.email;
    const token = await this.emailPreferences.issueUnsubscribeToken(
      email,
      EmailAudience.OPERATOR,
      EmailStream.LIFECYCLE,
    );
    // D-28: both values are built from env-derived bases + the server-minted
    // token — never a caller/user-supplied string, never CR/LF.
    const optOutUrl = `${islandToursBase()}/unsubscribe/${token}`;
    const headers: Record<string, string> = {
      'List-Unsubscribe': `<${publicApiBase()}/api/v1/email/unsubscribe/${token}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };
    const dash = dashboardAppBase();

    switch (key) {
      case EmailTemplateKey.OB3_FIRST_TOUR_HOWTO: {
        const { html, text } = operatorFirstTourHowtoTemplate({
          addTourUrl: `${dash}/trips/new`,
          // No hosted guide exists yet — the wizard IS the step-by-step path.
          guideUrl: `${dash}/trips/new`,
          walkthroughVideoUrl:
            process.env.WALKTHROUGH_VIDEO_URL?.trim() || null,
          optOutUrl,
          siteLogoUrl: site.siteLogoUrl,
        });
        return {
          subject: OPERATOR_FIRST_TOUR_HOWTO_SUBJECT,
          html,
          text,
          headers,
        };
      }
      case EmailTemplateKey.OB4_BUILD_IT_WITH_YOU: {
        const { html, text } = operatorBuildWithYouTemplate({
          whatsappUrl: site.whatsappUrl,
          salesEmail: salesRecipient(),
          addTourUrl: `${dash}/trips/new`,
          optOutUrl,
          siteLogoUrl: site.siteLogoUrl,
        });
        return {
          subject: OPERATOR_BUILD_WITH_YOU_SUBJECT,
          html,
          text,
          headers,
        };
      }
      case EmailTemplateKey.OB6_CHECK_IN: {
        const { html, text } = operatorCheckInTemplate({
          firstName: OnboardingEmailsService.firstNameOf(operator),
          optOutUrl,
        });
        return {
          subject: OPERATOR_CHECK_IN_SUBJECT,
          html,
          text,
          headers,
          // The founder's monitored inbox; sendMail falls back to
          // MAIL_REPLY_TO when unset (never noreply@ — wireframe rule).
          replyTo: process.env.OB6_REPLY_TO?.trim() || undefined,
        };
      }
      case EmailTemplateKey.OB7_CONNECT_CALENDAR: {
        const { html, text } = operatorConnectCalendarTemplate({
          connectUrl: `${dash}/calendar`,
          optOutUrl,
          siteLogoUrl: site.siteLogoUrl,
        });
        return {
          subject: OPERATOR_CONNECT_CALENDAR_SUBJECT,
          html,
          text,
          headers,
        };
      }
      case EmailTemplateKey.OB8_PAGE_STRONGER: {
        const sales = salesRecipient();
        const { html, text } = operatorPageStrongerTemplate({
          // Decision D6: ships wireframe-verbatim (offer on); flipping this
          // flag is the one-line change if counsel pulls the partner block.
          includePartnerOffer: true,
          photoShootContactUrl:
            site.whatsappUrl ?? (sales ? `mailto:${sales}` : null),
          toursUrl: `${dash}/trips`,
          optOutUrl,
          siteLogoUrl: site.siteLogoUrl,
        });
        return { subject: OPERATOR_PAGE_STRONGER_SUBJECT, html, text, headers };
      }
      default:
        throw new BadRequestException(`No renderer for template ${key}`);
    }
  }

  /** OB-5; null when the operator has no live tour to point at. */
  private async renderTourLive(
    operator: OperatorRow,
    site: SiteContext,
  ): Promise<RenderedEmail | null> {
    const tour = await this.prisma.tour.findFirst({
      where: { operatorId: operator.id, status: TourStatus.LIVE },
      orderBy: { firstPublishedAt: 'asc' },
      select: {
        name: true,
        slug: true,
        destination: { select: { slug: true } },
      },
    });
    if (!tour) return null;
    const { html, text } = operatorTourLiveTemplate({
      tourName: tour.name,
      // Canonical flat URL /{locale}/{destination}/{tour-slug}/ — operator
      // emails are English (plan §2.9).
      tourUrl: `${islandToursBase()}/en/${tour.destination.slug}/${tour.slug}`,
      availabilityUrl: `${dashboardAppBase()}/availability`,
      siteLogoUrl: site.siteLogoUrl,
    });
    return { subject: operatorTourLiveSubject(tour.name), html, text };
  }

  private async sendRendered(
    to: string,
    rendered: RenderedEmail,
  ): Promise<{ providerMessageId: string | null }> {
    return this.mail.sendMail({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      ...(rendered.replyTo ? { replyTo: rendered.replyTo } : {}),
      ...(rendered.headers ? { headers: rendered.headers } : {}),
    });
  }

  /** One SiteInfo read per tick — logo chip + the wa.me deep link (OB-4/8, OB-2). */
  private async siteContext(): Promise<SiteContext> {
    try {
      const info = await this.prisma.siteInfo.findFirst({
        select: {
          logo: true,
          whatsappNumber: true,
          enableWhatsappChat: true,
        },
      });
      return {
        siteLogoUrl: emailSafeLogoUrl(info?.logo),
        whatsappUrl: buildWhatsappUrl(
          info?.whatsappNumber,
          info?.enableWhatsappChat,
        ),
      };
    } catch {
      // An email must never fail over branding (the MailService rule).
      return { siteLogoUrl: null, whatsappUrl: null };
    }
  }

  private static firstNameOf(operator: OperatorRow): string | undefined {
    return operator.user.name?.trim().split(/\s+/)[0] || undefined;
  }
}
