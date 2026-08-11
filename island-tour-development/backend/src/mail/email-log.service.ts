import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  EmailAudience,
  EmailSendStatus,
  EmailStream,
  EmailTemplateKey,
  Prisma,
  Role,
} from '@prisma/client';
import {
  isPlatformWideBookingRole,
  resolveOperatorId,
} from '@/common/utils/operator.util';
import { PrismaService } from '@/prisma/prisma.service';

/** Truncation cap for the `error` column — a log line, not a stack dump. */
const ERROR_MAX_CHARS = 500;

/** What `claimAndSend` resolved to. Never throws out of a sweep loop. */
export type ClaimAndSendResult =
  | { outcome: 'sent'; providerMessageId: string | null }
  | { outcome: 'skipped'; reason: 'already-sent' }
  | { outcome: 'failed'; error: string };

export interface ClaimAndSendInput {
  templateKey: EmailTemplateKey;
  /** Booking id, operator id, or lowercased email — the dedupe scope. */
  scopeId: string;
  toEmail: string;
  stream: EmailStream;
  /** Platform locale the copy rendered in (traveller emails only). */
  locale?: string;
  /**
   * The actual transport call. Runs ONLY when this process won the claim.
   * May resolve with the provider message id (MailService.sendMail does).
   */
  send: () => Promise<{ providerMessageId: string | null } | void>;
}

/** The timeline projection — exactly what the dashboard renders. */
const TIMELINE_SELECT = {
  id: true,
  templateKey: true,
  scopeId: true,
  toEmail: true,
  stream: true,
  status: true,
  locale: true,
  providerMessageId: true,
  suppressedReason: true,
  error: true,
  createdAt: true,
} satisfies Prisma.EmailSendSelect;

/**
 * The send log (EMAIL-IMPLEMENTATION-PLAN.md §2.2) — send-once semantics for
 * every automated email.
 *
 * ## Claim-first, always
 * `claimAndSend` INSERTs the `EmailSend` row before touching the transport.
 * The `@@unique([templateKey, scopeId])` index makes the insert the mutex:
 * when two sweeps race, exactly one insert commits and the loser's P2002 is
 * the "already sent" answer. The alternative order (send, then log) double-
 * sends on every crash between the two steps; this order at worst records
 * SENT for an email the transport then failed — which the FAILED update
 * repairs whenever the process survives the send call.
 *
 * ## FAILED rows still occupy the slot
 * A transport failure updates the claimed row to FAILED rather than deleting
 * it: automated retries must NOT re-fire (the sweep would hammer a hard
 * bounce forever); recovery is an explicit admin resend, which writes a NEW
 * row under `${scopeId}#resend-{n}` (WP-D's endpoint).
 *
 * ## SUPPRESSED rows are decisions
 * `recordSuppressed` occupies the same unique slot with WHY the email
 * deliberately did not go out, mirroring `ReviewInvitation.suppressedReason`
 * — a suppressed email is decided, not pending, so the next sweep skips it
 * for free via the same P2002.
 */
@Injectable()
export class EmailLogService {
  private readonly logger = new Logger(EmailLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Claim the `(templateKey, scopeId)` slot, then send. See class JSDoc for
   * the ordering rationale. Returns instead of throwing — the callers are
   * sweep loops and best-effort hooks that must survive one bad recipient.
   */
  async claimAndSend(input: ClaimAndSendInput): Promise<ClaimAndSendResult> {
    let claimId: string;
    try {
      const claim = await this.prisma.emailSend.create({
        data: {
          templateKey: input.templateKey,
          scopeId: input.scopeId,
          toEmail: input.toEmail,
          stream: input.stream,
          status: EmailSendStatus.SENT,
          locale: input.locale ?? null,
        },
        select: { id: true },
      });
      claimId = claim.id;
    } catch (err) {
      if (EmailLogService.isSendSlotTaken(err)) {
        return { outcome: 'skipped', reason: 'already-sent' };
      }
      // Not the unique slot (DB down, bad enum, …): the claim never happened,
      // so nothing was sent and nothing needs repair. Report, don't throw.
      const msg = err instanceof Error ? err.message : 'unknown claim error';
      this.logger.error(
        `Claim failed for ${input.templateKey}/${input.scopeId}: ${msg}`,
      );
      return { outcome: 'failed', error: msg.slice(0, ERROR_MAX_CHARS) };
    }

    try {
      const sent = await input.send();
      const providerMessageId = sent?.providerMessageId ?? null;
      if (providerMessageId) {
        // Best-effort enrichment — the claim row is already correct without it.
        await this.prisma.emailSend
          .update({
            where: { id: claimId },
            data: { providerMessageId },
            select: { id: true },
          })
          .catch(() => undefined);
      }
      return { outcome: 'sent', providerMessageId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown send error';
      const truncated = msg.slice(0, ERROR_MAX_CHARS);
      this.logger.error(
        `Send failed for ${input.templateKey}/${input.scopeId}: ${truncated}`,
      );
      // The row keeps its slot (no automated retry) but tells the truth.
      await this.prisma.emailSend
        .update({
          where: { id: claimId },
          data: { status: EmailSendStatus.FAILED, error: truncated },
          select: { id: true },
        })
        .catch((updateErr: unknown) =>
          this.logger.error(
            `Could not mark ${input.templateKey}/${input.scopeId} FAILED: ` +
              `${updateErr instanceof Error ? updateErr.message : 'unknown'}`,
          ),
        );
      return { outcome: 'failed', error: truncated };
    }
  }

  /**
   * Record that an email deliberately did NOT go out and why. Occupies the
   * same unique slot as a send; a second suppression (or a send after a
   * suppression) is a silent no-op via the same P2002.
   */
  async recordSuppressed(input: {
    templateKey: EmailTemplateKey;
    scopeId: string;
    toEmail: string;
    stream: EmailStream;
    reason: string;
    locale?: string;
  }): Promise<{ recorded: boolean }> {
    try {
      await this.prisma.emailSend.create({
        data: {
          templateKey: input.templateKey,
          scopeId: input.scopeId,
          toEmail: input.toEmail,
          stream: input.stream,
          status: EmailSendStatus.SUPPRESSED,
          suppressedReason: input.reason,
          locale: input.locale ?? null,
        },
        select: { id: true },
      });
      return { recorded: true };
    } catch (err) {
      if (EmailLogService.isSendSlotTaken(err)) return { recorded: false };
      this.logger.error(
        `Suppression record failed for ${input.templateKey}/${input.scopeId}: ` +
          `${err instanceof Error ? err.message : 'unknown'}`,
      );
      return { recorded: false };
    }
  }

  /** Has this address opted out of this stream for this audience? */
  async isOptedOut(
    email: string,
    audience: EmailAudience,
    stream: EmailStream,
  ): Promise<boolean> {
    const row = await this.prisma.emailOptOut.findUnique({
      where: {
        email_audience_stream: {
          email: email.toLowerCase(),
          audience,
          stream,
        },
      },
      select: { id: true },
    });
    return row !== null;
  }

  /**
   * Timeline rows for a scope (base sends + `#resend-*` rows), newest first.
   * Selects only what the timeline renders.
   */
  async listForScope(scopeId: string) {
    return this.prisma.emailSend.findMany({
      where: {
        OR: [{ scopeId }, { scopeId: { startsWith: `${scopeId}#resend-` } }],
      },
      orderBy: { createdAt: 'desc' },
      select: TIMELINE_SELECT,
    });
  }

  /** Timeline for an operator; 404s when the operator does not exist. */
  async listForOperator(operatorId: string) {
    const operator = await this.prisma.operator.findUnique({
      where: { id: operatorId },
      select: { id: true },
    });
    if (!operator) throw new NotFoundException('Operator not found');
    return this.listForScope(operatorId);
  }

  /**
   * Timeline for a booking; 404s when the booking does not exist. Scoped the
   * way `BookingsService.getById` scopes (VIEW_BOOKINGS gates WHO may read,
   * this decides WHOSE rows): platform-wide roles see all, operators only
   * their own tours' bookings, customers only their own booking.
   */
  async listForBooking(bookingId: string, actor: { id: string; role: Role }) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, operatorId: true, userId: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (!isPlatformWideBookingRole(actor.role)) {
      let allowed = booking.userId === actor.id;
      if (!allowed && actor.role === Role.TOUR_OPERATOR) {
        const operatorId = await resolveOperatorId(
          this.prisma,
          actor.id,
          actor.role,
        );
        allowed = booking.operatorId === operatorId;
      }
      if (!allowed) {
        throw new ForbiddenException('You do not have access to this booking');
      }
    }
    return this.listForScope(bookingId);
  }

  /** Admin-resend scope id: `${scopeId}#resend-${n}`. */
  static resendScopeId(scopeId: string, n: number): string {
    return `${scopeId}#resend-${n}`;
  }

  /**
   * The next free resend scope id for `(templateKey, scopeId)`: n = count of
   * existing rows for the base scope (base row = 1 → first resend is
   * `#resend-1`). WP-D's resend endpoint is the only caller.
   */
  async nextResendScopeId(
    templateKey: EmailTemplateKey,
    scopeId: string,
  ): Promise<string> {
    const n = await this.prisma.emailSend.count({
      where: {
        templateKey,
        OR: [{ scopeId }, { scopeId: { startsWith: `${scopeId}#resend-` } }],
      },
    });
    return EmailLogService.resendScopeId(scopeId, n);
  }

  /**
   * True when the error is a P2002 on the `[templateKey, scopeId]` unique —
   * the "somebody already decided this email" signal. Reads BOTH the classic
   * top-level `target` shape and the pg driver adapter's nested
   * `driverAdapterError.cause.constraint.fields` shape (Prisma 7 + adapter-pg,
   * verified against live Postgres — reading only top-level keys silently
   * never matches in production; see bookings.service.ts `constraintIdsOf`).
   */
  private static isSendSlotTaken(err: unknown): boolean {
    if (
      !(err instanceof Prisma.PrismaClientKnownRequestError) ||
      err.code !== 'P2002'
    ) {
      return false;
    }
    const meta = (err.meta ?? {}) as {
      target?: unknown;
      constraint?: unknown;
      driverAdapterError?: {
        cause?: { constraint?: { fields?: unknown; index?: unknown } };
      };
    };
    const nested = meta.driverAdapterError?.cause?.constraint;
    const ids = [meta.target, meta.constraint, nested?.fields, nested?.index]
      .flatMap((v) => (Array.isArray(v) ? v : [v]))
      .filter((v): v is string => typeof v === 'string');
    return ids.some(
      (v) =>
        v === 'templateKey' ||
        v === 'scopeId' ||
        v.includes('email_sends_templateKey_scopeId'),
    );
  }
}
