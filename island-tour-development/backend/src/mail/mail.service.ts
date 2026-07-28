import { authPrismaClient } from '@/auth/auth-prisma.client';
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Resend } from 'resend';
import { emailSafeLogoUrl } from './email-logo.util';
import {
  changeEmailConfirmationTemplate,
  emailVerificationTemplate,
  hatAddedSubject,
  hatAddedTemplate,
  type HatAddedTemplateProps,
  operatorInviteTemplate,
  passwordResetTemplate,
  staffInviteTemplate,
  type StaffInviteTemplateProps,
} from './templates';
import {
  escapeHtml,
  findUnresolvedTokens,
  renderEmailTemplate,
  type EmailTemplateContext,
} from './templates/email-template.renderer';

/**
 * Where the design-owned HTML templates live at runtime.
 *
 * `nest build` emits CommonJS, so `__dirname` is the right answer in every real
 * environment. The e2e suite is the exception: `test/jest-e2e.json` transforms
 * with `useESM` (better-auth ships ESM only), and `__dirname` does not exist
 * under ESM - referencing it threw a ReferenceError at import time, which took
 * down every e2e suite in the repo, not just the mail ones, because this module
 * is reached through `AppModule`.
 *
 * `typeof` on an undeclared identifier is safe in JS, so this probes rather than
 * throws, and production still resolves through `__dirname` exactly as before.
 */
const TEMPLATE_DIR =
  typeof __dirname !== 'undefined'
    ? path.join(__dirname, 'templates')
    : path.join(process.cwd(), 'src', 'mail', 'templates');

/**
 * The LOCKED confirmation-email template (master 6.5 + its HTML wireframe), read
 * once at boot. It is design-owned markup rather than TypeScript, so `nest build`
 * has to copy it: see the `assets` entry in `nest-cli.json` - without it this throws
 * at startup in production while passing every test locally.
 */
const BOOKING_CONFIRMATION_TEMPLATE = fs.readFileSync(
  path.join(TEMPLATE_DIR, 'booking-confirmation-email.template.html'),
  'utf8',
);

/** Operator "Booking Received" notification (C7) - same shell, operator content. */
const OPERATOR_BOOKING_RECEIVED_TEMPLATE = fs.readFileSync(
  path.join(TEMPLATE_DIR, 'operator-booking-received.template.html'),
  'utf8',
);

/** Shared branded notice (cancellation ack, operator notices) - same shell. */
const BOOKING_NOTICE_TEMPLATE = fs.readFileSync(
  path.join(TEMPLATE_DIR, 'booking-notice.template.html'),
  'utf8',
);

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  /** Null when RESEND_API_KEY is absent - every send then fails loudly. */
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY is missing. Email sending will fail.');
    }
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from =
      process.env.MAIL_FROM ?? 'Island Tours <noreply@islandtours.com>';
  }

  /** Redacts a recipient for logs: keeps first char + domain (e.g. j***@host.com). */
  private redact(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    return `${local.slice(0, 1)}***@${domain}`;
  }

  // ── Core send method ──────────────────────────────────────────────────────────
  async sendMail(opts: SendMailOptions): Promise<void> {
    if (!this.resend) {
      this.logger.error(
        `Email to ${this.redact(opts.to)} dropped - RESEND_API_KEY is not configured.`,
      );
      throw new Error('Email service is not configured');
    }

    const { data, error } = await this.resend.emails.send({
      from: this.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text ?? opts.html.replace(/<[^>]*>/g, ''),
    });

    if (error) {
      // Log the provider error name/message (they never contain the API key),
      // but throw only the name so callers cannot surface provider internals.
      this.logger.error(
        `Failed to send email to ${this.redact(opts.to)} | ${error.name}: ${error.message}`,
      );
      throw new Error(`Email send failed: ${error.name}`);
    }

    this.logger.log(
      `Email sent to ${this.redact(opts.to)} | resend id: ${data?.id ?? 'n/a'}`,
    );
  }

  // ── Dashboard-managed logo (auth-email brand bars) ─────────────────────────
  /**
   * SiteInfo.logo for the auth emails' brand bar, read via the pre-DI
   * `authPrismaClient` (this service also runs as a DI-free singleton, see
   * mail.singleton.ts). Cached for 5 minutes; any failure falls back to null,
   * which the shell renders as the text logo - an email must never fail over
   * branding.
   */
  private siteLogoCache: { url: string | null; at: number } | null = null;
  private async getSiteLogo(): Promise<string | null> {
    const now = Date.now();
    if (this.siteLogoCache && now - this.siteLogoCache.at < 5 * 60_000) {
      return this.siteLogoCache.url;
    }
    try {
      const info = await authPrismaClient.siteInfo.findFirst({
        select: { logo: true },
      });
      this.siteLogoCache = { url: emailSafeLogoUrl(info?.logo), at: now };
    } catch {
      this.siteLogoCache = { url: null, at: now };
    }
    return this.siteLogoCache.url;
  }

  // ── Password reset ────────────────────────────────────────────────────────────
  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    const siteLogoUrl = await this.getSiteLogo();
    const { html, text } = passwordResetTemplate({ resetUrl, siteLogoUrl });
    await this.sendMail({
      to,
      subject: 'Reset your Island Tours password',
      html,
      text,
    });
  }

  // ── Operator invite (set-password link) ──────────────────────────────────────
  async sendOperatorInviteEmail(
    to: string,
    inviteUrl: string,
    name?: string,
  ): Promise<void> {
    const siteLogoUrl = await this.getSiteLogo();
    const { html, text } = operatorInviteTemplate({
      inviteUrl,
      siteLogoUrl,
      name,
    });
    await this.sendMail({
      to,
      subject: "You've been invited to Island Tours - set your password",
      html,
      text,
    });
  }

  // ── Customer welcome (set-password link) ────────────────────────────────────

  // ── Staff / team-seat invite (set-password link) ─────────────────────────────

  /**
   * Dynamic invite for platform staff and operator team seats: the copy names
   * who is inviting (Island Tours vs the operator's company) and what the
   * person was invited as (designation or seat role). The auth hook picks
   * this over the operator invite by inspecting the staff_members row
   * (see auth.instance.ts sendResetPassword).
   */
  async sendStaffInviteEmail(
    to: string,
    inviteUrl: string,
    params: Omit<StaffInviteTemplateProps, 'inviteUrl' | 'siteLogoUrl'>,
  ): Promise<void> {
    const siteLogoUrl = await this.getSiteLogo();
    const { html, text } = staffInviteTemplate({
      inviteUrl,
      siteLogoUrl,
      ...params,
    });
    const subject =
      params.variant === 'platform'
        ? `You're invited to the Island Tours team${params.roleLabel ? ` as ${params.roleLabel}` : ''} - set your password`
        : `${params.companyName ?? 'Your team'} invited you to Island Tours${params.roleLabel ? ` as ${params.roleLabel}` : ''} - set your password`;
    await this.sendMail({ to, subject, html, text });
  }

  // ── Email change confirmation (to the CURRENT address) ──────────────────────

  /**
   * Step 1 of the Better Auth change-email flow: the current mailbox must
   * approve moving the account to `newEmail`. Step 2 (verifying the new
   * address) reuses sendVerificationEmail below.
   */
  async sendChangeEmailConfirmationEmail(
    to: string,
    confirmUrl: string,
    newEmail: string,
    name?: string,
  ): Promise<void> {
    const siteLogoUrl = await this.getSiteLogo();
    const { html, text } = changeEmailConfirmationTemplate({
      confirmUrl,
      newEmail,
      name,
      siteLogoUrl,
    });
    await this.sendMail({
      to,
      subject: 'Confirm your Island Tours email change',
      html,
      text,
    });
  }

  // ── Role added to an existing account (no set-password link) ─────────────────

  /**
   * One account, many hats: a staff/operator identity was attached to an email
   * that already holds a password. Tells the person which door to use - never
   * carries a credential link.
   */
  async sendHatAddedEmail(
    to: string,
    params: Omit<HatAddedTemplateProps, 'siteLogoUrl'>,
  ): Promise<void> {
    const siteLogoUrl = await this.getSiteLogo();
    const { html, text } = hatAddedTemplate({ ...params, siteLogoUrl });
    await this.sendMail({ to, subject: hatAddedSubject(params), html, text });
  }

  // ── Email verification ────────────────────────────────────────────────────────

  /**
   * 'account' = ordinary verify-on-sign-in. 'email-change' = step 2 of the
   * change-email flow (sent to the NEW address after the old inbox approved);
   * same template, tailored copy + subject.
   */
  async sendVerificationEmail(
    to: string,
    verifyUrl: string,
    name?: string,
    variant: 'account' | 'email-change' = 'account',
  ): Promise<void> {
    const siteLogoUrl = await this.getSiteLogo();
    const { html, text } = emailVerificationTemplate({
      verifyUrl,
      siteLogoUrl,
      name,
      variant,
    });
    await this.sendMail({
      to,
      subject:
        variant === 'email-change'
          ? 'Confirm your new Island Tours email address'
          : 'Verify your Island Tours email address',
      html,
      text,
    });
  }

  // ── Booking confirmation ────────────────────────────────────────────────────

  /**
   * Render + send the locked confirmation template. The caller owns the token
   * context (`bookings/booking-email.context.ts`) and the subject, so this stays a
   * transport concern.
   *
   * A token the context forgot is left literal by the renderer, which would email a
   * raw `{whatToBring}`. The template spec is the real guard, but tests only cover
   * the shapes they enumerate - so log loudly here too rather than let a genuinely
   * novel booking ship broken copy to a traveler.
   */
  async sendBookingConfirmationEmail(
    to: string,
    subject: string,
    context: EmailTemplateContext,
    text: string,
  ): Promise<void> {
    const missing = findUnresolvedTokens(
      BOOKING_CONFIRMATION_TEMPLATE,
      context,
    );
    if (missing.length) {
      this.logger.error(
        `Confirmation email context is missing tokens: ${missing.join(', ')}`,
      );
    }
    await this.sendMail({
      to,
      subject,
      html: renderEmailTemplate(BOOKING_CONFIRMATION_TEMPLATE, context),
      text,
    });
  }

  // ── Branded notice (shared shell: cancellation ack, operator notices) ──────
  async sendBookingNoticeEmail(
    to: string,
    subject: string,
    context: EmailTemplateContext,
    text: string,
  ): Promise<void> {
    const missing = findUnresolvedTokens(BOOKING_NOTICE_TEMPLATE, context);
    if (missing.length) {
      this.logger.error(
        `Booking notice context is missing tokens: ${missing.join(', ')}`,
      );
    }
    await this.sendMail({
      to,
      subject,
      html: renderEmailTemplate(BOOKING_NOTICE_TEMPLATE, context),
      text,
    });
  }

  // ── Post-tour review request (the collection gap) ──────────────────────────

  /**
   * The post-tour review invitation - the fifth sibling in the transactional
   * email family, after confirmation, operator balance, pre-tour reminder and
   * cancellation.
   *
   * REUSES THE SHARED NOTICE SHELL rather than adding a fifth near-identical
   * HTML file. The shell already carries exactly this shape (brand bar, headline,
   * booking reference, tour line, paragraphs, one CTA, sign-off), and a copy of
   * it would drift from the family the first time anyone restyled one of them.
   *
   * The CTA points at the tokenized review page, so the guest goes from inbox to
   * a committed star rating in one tap with no login. Copy is deliberately about
   * the guest's day and the local team, not about us needing content.
   */
  async sendReviewRequestEmail(
    to: string,
    context: {
      firstName: string;
      tourName: string;
      bookingRef: string;
      dateLong: string;
      startTime: string;
      reviewUrl: string;
      siteLogoUrl?: string | null;
      emailIconBase: string;
      isReminder?: boolean;
    },
  ): Promise<void> {
    const subject = context.isReminder
      ? `Did you enjoy ${context.tourName}?`
      : `How was ${context.tourName}?`;

    const paragraphs = context.isReminder
      ? [
          `Hi ${context.firstName}, we hope ${context.tourName} was everything you came for.`,
          'A quick star rating helps the next traveller book with confidence, and it means a lot to the local team who ran your tour. It takes about thirty seconds.',
        ]
      : [
          `Hi ${context.firstName},`,
          `We hope ${context.tourName} was everything you came to the islands for.`,
          'Travellers trust other travellers, so a quick word about your day helps the next guest book with confidence, and it means a lot to the local team who ran your tour.',
          'It takes about thirty seconds.',
        ];

    await this.sendBookingNoticeEmail(
      to,
      subject,
      {
        noticeTitle: subject,
        bookingRef: context.bookingRef,
        tourName: context.tourName,
        dateLong: context.dateLong,
        startTime: context.startTime,
        noticeParagraphs: paragraphs,
        ctaUrl: context.reviewUrl,
        ctaLabel: 'Rate your tour',
        siteLogoUrl: context.siteLogoUrl ?? '',
        emailIconBase: context.emailIconBase,
      },
      `${paragraphs.join('\n\n')}\n\nRate your tour: ${context.reviewUrl}\n\nThank you for spending your day with us. Built by Islanders.`,
    );
  }

  // ── Cancellation request → admin (B3) ──────────────────────────────────────

  /**
   * Internal notice to the Island Tours admin when a traveller submits the
   * tokenized cancellation-request form (master 6.4/C1: the form never cancels
   * anything itself - the admin processes the refund and confirms by email).
   * Deliberately plain: it is an internal work item, not a designed surface.
   */
  async sendCancellationRequestEmail(
    to: string,
    details: {
      displayRef: string;
      tourName: string;
      dateLabel: string;
      guestName: string;
      guestEmail: string;
      totalAmount: string;
      paymentModel: string;
      reason: string | null;
      dashboardUrl: string;
      /** Who initiated: traveler request (default) or operator report (conflict #2). */
      source?: 'traveler' | 'operator';
      /** Operator company name - only for source 'operator'. */
      reporterName?: string;
    },
  ): Promise<void> {
    const fromOperator = details.source === 'operator';
    const heading = fromOperator
      ? 'Operator cancellation report'
      : 'Cancellation request';
    const intro = fromOperator
      ? `${details.reporterName ?? 'The operator'} reports they must cancel this booking. Execute the cancellation (full refund) from the dashboard, or dismiss the report if the tour runs after all.`
      : 'A traveller asked to cancel. Process the refund and confirm to them by email.';
    const noteLabel = fromOperator ? 'Operator note' : 'Traveller note';
    // Every interpolated value is escaped: `reason` (and in principle the guest
    // fields) is traveller-supplied via the public cancellation-request form,
    // and this is the one email built by string concatenation rather than
    // renderEmailTemplate (which escapes for us).
    const row = (label: string, value: string) =>
      `<tr><td style="padding:6px 12px 6px 0;color:#6B7280;font-size:14px;">${label}</td><td style="padding:6px 0;color:#1F2937;font-size:14px;font-weight:600;">${escapeHtml(value)}</td></tr>`;
    const html = `
<div style="font-family:Arial,sans-serif;max-width:560px;">
  <h2 style="font-size:18px;color:#1F2937;">${heading}: ${escapeHtml(details.displayRef)}</h2>
  <p style="font-size:14px;color:#374151;">${escapeHtml(intro)}</p>
  <table cellpadding="0" cellspacing="0">
    ${row('Booking', details.displayRef)}
    ${row('Tour', details.tourName)}
    ${fromOperator && details.reporterName ? row('Operator', details.reporterName) : ''}
    ${row('Date', details.dateLabel)}
    ${row('Guest', `${details.guestName} <${details.guestEmail}>`)}
    ${row('Total', details.totalAmount)}
    ${row('Payment model', details.paymentModel)}
    ${details.reason ? row(noteLabel, details.reason) : ''}
  </table>
  <p style="font-size:14px;"><a href="${escapeHtml(details.dashboardUrl)}">Open in the dashboard</a></p>
</div>`;
    const text = [
      `${heading}: ${details.displayRef}`,
      `Tour: ${details.tourName}`,
      fromOperator && details.reporterName
        ? `Operator: ${details.reporterName}`
        : '',
      `Date: ${details.dateLabel}`,
      `Guest: ${details.guestName} <${details.guestEmail}>`,
      `Total: ${details.totalAmount}`,
      `Payment model: ${details.paymentModel}`,
      details.reason ? `${noteLabel}: ${details.reason}` : '',
      `Dashboard: ${details.dashboardUrl}`,
    ]
      .filter(Boolean)
      .join('\n');
    await this.sendMail({
      to,
      subject: `${heading} - ${details.displayRef}: ${details.tourName}`,
      html,
      text,
    });
  }

  // ── Operator "Booking Received" notification (C7) ──────────────────────────
  async sendOperatorBookingReceivedEmail(
    to: string,
    subject: string,
    context: EmailTemplateContext,
    text: string,
  ): Promise<void> {
    const missing = findUnresolvedTokens(
      OPERATOR_BOOKING_RECEIVED_TEMPLATE,
      context,
    );
    if (missing.length) {
      this.logger.error(
        `Operator notification context is missing tokens: ${missing.join(', ')}`,
      );
    }
    await this.sendMail({
      to,
      subject,
      html: renderEmailTemplate(OPERATOR_BOOKING_RECEIVED_TEMPLATE, context),
      text,
    });
  }
}
