import { redactEmail } from '@/common/utils/redact-email.util';
import { authPrismaClient } from '@/auth/auth-prisma.client';
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Resend } from 'resend';
import { emailSafeLogoUrl } from './email-logo.util';
import {
  changeEmailConfirmationTemplate,
  emailVerificationTemplate,
  savedToursTemplate,
  type SavedTourCard,
  travellerLoginCodeTemplate,
  hatAddedSubject,
  hatAddedTemplate,
  type HatAddedTemplateProps,
  operatorInviteTemplate,
  passwordChangeConfirmationTemplate,
  passwordResetTemplate,
  staffInviteTemplate,
  type StaffInviteTemplateProps,
  tourApprovedTemplate,
  type TourApprovedTemplateProps,
  tourChangesRequestedTemplate,
  type TourChangesRequestedTemplateProps,
  tourSubmittedForReviewTemplate,
  type TourSubmittedForReviewTemplateProps,
  tourSubmittedSalesTemplate,
  type TourSubmittedSalesTemplateProps,
  OPERATOR_APPROVED_SUBJECT,
  operatorApprovedTemplate,
  type OperatorApprovedTemplateProps,
  operatorSignupInternalSubject,
  operatorSignupInternalTemplate,
  type OperatorSignupInternalTemplateProps,
  tourSubmittedSalesSubject,
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
  /**
   * Overrides the default reply-to (`MAIL_REPLY_TO` env). The email programme
   * forbids noreply@ replies — lifecycle emails carry a monitored inbox here
   * (OB-6 uses the founder's own, `OB6_REPLY_TO`).
   */
  replyTo?: string;
  /**
   * Custom SMTP headers (`List-Unsubscribe`, `List-Unsubscribe-Post`, …).
   * CONTRACT: values must never contain caller/user-supplied strings and
   * never CR/LF - build them from server-minted tokens and env-derived URLs
   * only. (Resend serializes JSON, but the rule keeps a transport swap from
   * becoming an injection surface.)
   */
  headers?: Record<string, string>;
  /** Attachments (operator agreement PDF, …). Resend caps at 40 MB total. */
  attachments?: { filename: string; content: Buffer }[];
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
    return redactEmail(email);
  }

  // ── Core send method ──────────────────────────────────────────────────────────
  /**
   * The single egress point. Returns the provider message id so the send log
   * (EmailLogService) can record it; existing callers ignore the return value
   * and compile untouched.
   */
  async sendMail(
    opts: SendMailOptions,
  ): Promise<{ providerMessageId: string | null }> {
    if (!this.resend) {
      this.logger.error(
        `Email to ${this.redact(opts.to)} dropped - RESEND_API_KEY is not configured.`,
      );
      throw new Error('Email service is not configured');
    }

    // Default reply-to from MAIL_REPLY_TO (a monitored inbox) — read per send,
    // not in the constructor, because this service also runs as a DI-free
    // singleton created before env validation (mail.singleton.ts).
    const replyTo = opts.replyTo ?? process.env.MAIL_REPLY_TO;

    const { data, error } = await this.resend.emails.send({
      from: this.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text ?? opts.html.replace(/<[^>]*>/g, ''),
      ...(replyTo ? { replyTo } : {}),
      ...(opts.headers ? { headers: opts.headers } : {}),
      ...(opts.attachments ? { attachments: opts.attachments } : {}),
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
    return { providerMessageId: data?.id ?? null };
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

  // ── Traveller account-area sign-in code ──────────────────────────────────────
  async sendTravellerLoginCodeEmail(
    to: string,
    code: string,
    expiresInLabel: string,
  ): Promise<void> {
    const siteLogoUrl = await this.getSiteLogo();
    const { html, text } = travellerLoginCodeTemplate({
      code,
      expiresInLabel,
      siteLogoUrl,
    });
    await this.sendMail({
      to,
      // The code is NOT in the subject on purpose: subjects show on lock
      // screens and in notification banners, where anyone holding the phone
      // can read it without unlocking.
      subject: 'Your Island Tours sign-in code',
      html,
      text,
    });
  }

  // ── Saved tours ("Email me this list") ───────────────────────────────────────
  /**
   * Sends the traveller's own saved list back to them as a link (mck-17).
   *
   * The one pre-booking email on the platform, and the only reason a list kept
   * in a browser cookie survives a change of device.
   */
  async sendSavedToursEmail(
    to: string,
    listUrl: string,
    list: { locale: string; tours: SavedTourCard[] },
  ): Promise<void> {
    const siteLogoUrl = await this.getSiteLogo();
    const { html, text } = savedToursTemplate({
      listUrl,
      locale: list.locale,
      tours: list.tours,
      siteLogoUrl,
    });
    await this.sendMail({
      to,
      subject: 'Your saved tours',
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

  /**
   * Confirm-link for a self-service password change. The current password was
   * already verified, so this email is the SECOND factor: it proves the
   * requester also holds the mailbox. Nothing has changed on the account when
   * this is sent.
   */
  async sendPasswordChangeConfirmationEmail(
    to: string,
    confirmUrl: string,
    expiresInLabel: string,
    name?: string,
  ): Promise<void> {
    const siteLogoUrl = await this.getSiteLogo();
    const { html, text } = passwordChangeConfirmationTemplate({
      confirmUrl,
      expiresInLabel,
      name,
      siteLogoUrl,
    });
    await this.sendMail({
      to,
      subject: 'Confirm your Island Tours password change',
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

  // ── Tour approval workflow (access-roles conflict #1) ────────────────────────

  /**
   * To Island Tours: an operator submitted a tour and it is sitting in the
   * review queue. Operators cannot publish, so nothing moves until a human
   * here looks - this is what stops that wait being indefinite.
   */
  async sendTourSubmittedForReviewEmail(
    to: string,
    params: Omit<TourSubmittedForReviewTemplateProps, 'siteLogoUrl'>,
  ): Promise<void> {
    const siteLogoUrl = await this.getSiteLogo();
    const { html, text } = tourSubmittedForReviewTemplate({
      ...params,
      siteLogoUrl,
    });
    await this.sendMail({
      to,
      subject: `Tour submitted for review: ${params.tourName}`,
      html,
      text,
    });
  }

  /**
   * To the operator: Island Tours approved the tour. Deliberately NOT "your
   * tour is live" - publishing is a separate admin action, and sending an
   * operator to look for a page that is still a draft creates the support
   * ticket this email exists to prevent.
   */
  async sendTourApprovedEmail(
    to: string,
    params: Omit<TourApprovedTemplateProps, 'siteLogoUrl'>,
  ): Promise<void> {
    const siteLogoUrl = await this.getSiteLogo();
    const { html, text } = tourApprovedTemplate({ ...params, siteLogoUrl });
    await this.sendMail({
      to,
      subject: `Approved: ${params.tourName}`,
      html,
      text,
    });
  }

  /**
   * To the operator: Island Tours wants changes before publishing. The admin's
   * note is the reason this email exists - the dashboard shows it too, but
   * only to someone who thinks to go and look.
   */
  async sendTourChangesRequestedEmail(
    to: string,
    params: Omit<TourChangesRequestedTemplateProps, 'siteLogoUrl'>,
  ): Promise<void> {
    const siteLogoUrl = await this.getSiteLogo();
    const { html, text } = tourChangesRequestedTemplate({
      ...params,
      siteLogoUrl,
    });
    await this.sendMail({
      to,
      subject: `Changes requested: ${params.tourName}`,
      html,
      text,
    });
  }

  /**
   * INT-2 (sales-pipeline variant of the submission alert). Sent to
   * SALES_EMAIL only when it differs from ADMIN_EMAIL - the caller decides;
   * this facade only renders and sends.
   */
  async sendTourSubmittedSalesEmail(
    to: string,
    params: Omit<TourSubmittedSalesTemplateProps, 'siteLogoUrl'>,
  ): Promise<void> {
    const siteLogoUrl = await this.getSiteLogo();
    const { html, text } = tourSubmittedSalesTemplate({
      ...params,
      siteLogoUrl,
    });
    await this.sendMail({
      to,
      subject: tourSubmittedSalesSubject(params.tourName),
      html,
      text,
    });
  }

  // ── Operator onboarding (WP-C: OB-2A approval + INT-1 sign-up alert) ─────────

  /**
   * OB-2A "You're approved" - to the operator, the moment an admin approves
   * verification. Fired once by the guarded PENDING->VERIFIED transition in
   * OperatorsService.decideVerification; wireframe copy is locked.
   */
  async sendOperatorApprovedEmail(
    to: string,
    params: Omit<OperatorApprovedTemplateProps, 'siteLogoUrl'>,
  ): Promise<void> {
    const siteLogoUrl = await this.getSiteLogo();
    const { html, text } = operatorApprovedTemplate({ ...params, siteLogoUrl });
    await this.sendMail({
      to,
      subject: OPERATOR_APPROVED_SUBJECT,
      html,
      text,
    });
  }

  /**
   * INT-1 "New operator" - to the sales pipeline (SALES_EMAIL, ADMIN_EMAIL
   * fallback), fired on operator-row creation. Facts table + a dashboard
   * review link; deliberately no approve action inside the email.
   */
  async sendOperatorSignupInternalEmail(
    to: string,
    params: Omit<OperatorSignupInternalTemplateProps, 'siteLogoUrl'>,
  ): Promise<void> {
    const siteLogoUrl = await this.getSiteLogo();
    const { html, text } = operatorSignupInternalTemplate({
      ...params,
      siteLogoUrl,
    });
    await this.sendMail({
      to,
      subject: operatorSignupInternalSubject(params.operatorName),
      html,
      text,
    });
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
