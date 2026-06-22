import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import {
  bookingConfirmationTemplate,
  emailVerificationTemplate,
  operatorInviteTemplate,
  passwordResetTemplate,
  type BookingConfirmationTemplateProps,
} from './templates';

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
        `Email sent to ${this.redact(opts.to)} | messageId: ${(info as any)?.messageId ?? 'n/a'}`,
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
  async sendBookingConfirmationEmail(
    to: string,
    props: BookingConfirmationTemplateProps,
  ): Promise<void> {
    const { html, text } = bookingConfirmationTemplate(props);
    await this.sendMail({
      to,
      subject: `Booking confirmed - ${props.displayRef}`,
      html,
      text,
    });
  }
}
