import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import {
  emailVerificationTemplate,
  operatorInviteTemplate,
  passwordResetTemplate,
} from './templates';
import {
  findUnresolvedTokens,
  renderEmailTemplate,
  type EmailTemplateContext,
} from './templates/email-template.renderer';

/**
 * The LOCKED confirmation-email template (master 6.5 + its HTML wireframe), read
 * once at boot. It is design-owned markup rather than TypeScript, so `nest build`
 * has to copy it: see the `assets` entry in `nest-cli.json` - without it this throws
 * at startup in production while passing every test locally.
 */
const BOOKING_CONFIRMATION_TEMPLATE = fs.readFileSync(
  path.join(__dirname, 'templates', 'booking-confirmation-email.template.html'),
  'utf8',
);

/** Operator "Booking Received" notification (C7) - same shell, operator content. */
const OPERATOR_BOOKING_RECEIVED_TEMPLATE = fs.readFileSync(
  path.join(__dirname, 'templates', 'operator-booking-received.template.html'),
  'utf8',
);

/** Shared branded notice (cancellation ack, operator notices) - same shell. */
const BOOKING_NOTICE_TEMPLATE = fs.readFileSync(
  path.join(__dirname, 'templates', 'booking-notice.template.html'),
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
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor() {
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = process.env.SMTP_PORT
      ? parseInt(process.env.SMTP_PORT, 10)
      : 465;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      this.logger.warn(
        'SMTP_USER or SMTP_PASS is missing. Email sending will fail.',
      );
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    this.from =
      process.env.MAIL_FROM ?? '"Island Tours" <noreply@islandtours.com>';
  }

  /** Redacts a recipient for logs: keeps first char + domain (e.g. j***@host.com). */
  private redact(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    return `${local.slice(0, 1)}***@${domain}`;
  }

  // ── Core send method ──────────────────────────────────────────────────────────
  async sendMail(opts: SendMailOptions): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text ?? opts.html.replace(/<[^>]*>/g, ''),
      });

      this.logger.log(
        `Email sent to ${this.redact(opts.to)} | messageId: ${info?.messageId ?? 'n/a'}`,
      );
    } catch (err) {
      this.logger.error(`Failed to send email to ${this.redact(opts.to)}`, err);
      throw err;
    }
  }

  // ── Password reset ────────────────────────────────────────────────────────────
  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    const { html, text } = passwordResetTemplate({ resetUrl });
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
    const { html, text } = operatorInviteTemplate({ inviteUrl, name });
    await this.sendMail({
      to,
      subject: "You've been invited to Island Tours - set your password",
      html,
      text,
    });
  }

  // ── Email verification ────────────────────────────────────────────────────────
  async sendVerificationEmail(
    to: string,
    verifyUrl: string,
    name?: string,
  ): Promise<void> {
    const { html, text } = emailVerificationTemplate({ verifyUrl, name });
    await this.sendMail({
      to,
      subject: 'Verify your Island Tours email address',
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
    },
  ): Promise<void> {
    const row = (label: string, value: string) =>
      `<tr><td style="padding:6px 12px 6px 0;color:#6B7280;font-size:14px;">${label}</td><td style="padding:6px 0;color:#1F2937;font-size:14px;font-weight:600;">${value}</td></tr>`;
    const html = `
<div style="font-family:Arial,sans-serif;max-width:560px;">
  <h2 style="font-size:18px;color:#1F2937;">Cancellation request: ${details.displayRef}</h2>
  <p style="font-size:14px;color:#374151;">A traveller asked to cancel. Process the refund and confirm to them by email.</p>
  <table cellpadding="0" cellspacing="0">
    ${row('Booking', details.displayRef)}
    ${row('Tour', details.tourName)}
    ${row('Date', details.dateLabel)}
    ${row('Guest', `${details.guestName} &lt;${details.guestEmail}&gt;`)}
    ${row('Total', details.totalAmount)}
    ${row('Payment model', details.paymentModel)}
    ${details.reason ? row('Traveller note', details.reason) : ''}
  </table>
  <p style="font-size:14px;"><a href="${details.dashboardUrl}">Open in the dashboard</a></p>
</div>`;
    const text = [
      `Cancellation request: ${details.displayRef}`,
      `Tour: ${details.tourName}`,
      `Date: ${details.dateLabel}`,
      `Guest: ${details.guestName} <${details.guestEmail}>`,
      `Total: ${details.totalAmount}`,
      `Payment model: ${details.paymentModel}`,
      details.reason ? `Traveller note: ${details.reason}` : '',
      `Dashboard: ${details.dashboardUrl}`,
    ]
      .filter(Boolean)
      .join('\n');
    await this.sendMail({
      to,
      subject: `Cancellation request - ${details.displayRef}: ${details.tourName}`,
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
