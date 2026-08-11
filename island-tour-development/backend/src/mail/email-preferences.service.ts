import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EmailAudience, EmailStream } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { EmailLogService } from './email-log.service';

/**
 * Unsubscribe tokens + the stream-scoped opt-out they act on
 * (EMAIL-IMPLEMENTATION-PLAN.md §2.3/§2.5).
 *
 * The token is the credential: it arrives in an email footer, the recipient
 * is on a phone, and any sign-in wall between them and "stop emailing me"
 * is a compliance failure. So, like the review-invitation tokens, unknown
 * tokens 404 with no oracle, resolves disclose only a masked address, and
 * tokens are long-lived and reusable — the link in a months-old email must
 * keep working, and acting on it twice is a no-op, not an error.
 */
@Injectable()
export class EmailPreferencesService {
  private readonly logger = new Logger(EmailPreferencesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailLog: EmailLogService,
  ) {}

  /**
   * The token for `(email, audience, stream)` — reuses the existing row when
   * one exists so links in already-sent emails stay valid forever. Senders
   * call this to build footer links:
   * `${islandToursBase()}/unsubscribe/${token}` (locale-free, WP-F).
   */
  async issueUnsubscribeToken(
    email: string,
    audience: EmailAudience,
    stream: EmailStream,
  ): Promise<string> {
    const canonical = email.toLowerCase();
    const existing = await this.prisma.emailUnsubscribeToken.findFirst({
      where: { email: canonical, audience, stream },
      select: { token: true },
    });
    if (existing) return existing.token;
    const created = await this.prisma.emailUnsubscribeToken.create({
      data: { email: canonical, audience, stream },
      select: { token: true },
    });
    return created.token;
  }

  /** GET resolve: what would this token opt out of, and is it already done? */
  async resolveToken(token: string): Promise<{
    email: string;
    audience: EmailAudience;
    stream: EmailStream;
    optedOut: boolean;
  }> {
    const row = await this.findToken(token);
    const optedOut = await this.emailLog.isOptedOut(
      row.email,
      row.audience,
      row.stream,
    );
    return {
      email: EmailPreferencesService.maskEmail(row.email),
      audience: row.audience,
      stream: row.stream,
      optedOut,
    };
  }

  /**
   * POST act: idempotent opt-out of the token's stream. Upsert keyed on the
   * `[email, audience, stream]` unique — repeating the call changes nothing.
   */
  async optOut(token: string): Promise<{
    email: string;
    audience: EmailAudience;
    stream: EmailStream;
    optedOut: true;
  }> {
    const row = await this.findToken(token);
    await this.prisma.emailOptOut.upsert({
      where: {
        email_audience_stream: {
          email: row.email,
          audience: row.audience,
          stream: row.stream,
        },
      },
      create: {
        email: row.email,
        audience: row.audience,
        stream: row.stream,
        source: 'unsubscribe-link',
      },
      update: {}, // already opted out - nothing to change
      select: { id: true },
    });
    this.logger.log(
      `Opt-out recorded: ${EmailPreferencesService.maskEmail(row.email)} ` +
        `${row.audience}/${row.stream} (unsubscribe-link)`,
    );
    return {
      email: EmailPreferencesService.maskEmail(row.email),
      audience: row.audience,
      stream: row.stream,
      optedOut: true,
    };
  }

  /** Same-shape 404 for unknown tokens — no oracle (review-token precedent). */
  private async findToken(token: string) {
    const row = await this.prisma.emailUnsubscribeToken.findUnique({
      where: { token },
      select: { email: true, audience: true, stream: true },
    });
    if (!row) throw new NotFoundException('Unsubscribe link not found');
    return row;
  }

  /** `jane@host.com` → `j***@host.com` (the MailService.redact pattern). */
  static maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    return `${local.slice(0, 1)}***@${domain}`;
  }
}
