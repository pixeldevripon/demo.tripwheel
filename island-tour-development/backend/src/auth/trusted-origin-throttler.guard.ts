import { Injectable, Logger, type ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import {
  INTERNAL_CLIENT_IP_HEADER,
  isTrustedInternalHeaders,
} from './internal-origin.util';

/**
 * ThrottlerGuard that understands our first-party SSR callers.
 *
 * ## Why the default tracker is wrong for us
 *
 * The public site and the dashboard both render server-side and call this API
 * server-to-server, so `req.ip` is their egress address - the SAME value for
 * every visitor on the platform. Any per-IP limit on a route reached that way
 * is therefore one shared bucket: the thank-you page's conversion claim is
 * capped at 5/min for ALL travellers combined, not 5/min each, and conversion
 * tracking dies quietly under load. That is exactly why the internal secret
 * originally skipped throttling wholesale.
 *
 * Skipping wholesale is too blunt, though: it also dissolved the deliberately
 * tight limits on the mail-senders and credential routes, so one leak of
 * `INTERNAL_API_SECRET` would have lifted every one of them at once. The
 * bypass is now scoped (`hasOwnThrottleOverride`), and this guard closes the
 * gap that scoping opens: a trusted caller may forward the REAL visitor's
 * address, and we track by that instead of by its own egress IP. The limits
 * then land per visitor whether the request came from a browser or through SSR.
 *
 * The forwarded header is honoured ONLY alongside a valid internal secret, so
 * an anonymous client cannot spoof a fresh bucket for itself.
 */
@Injectable()
export class TrustedOriginThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(TrustedOriginThrottlerGuard.name);

  /**
   * Track by the forwarded visitor IP for trusted first-party callers, else by
   * the request's own IP. Falls back to the egress IP when a trusted caller
   * sends no header, so this can never throw or produce an empty bucket key.
   */
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const headers = (req.headers ?? {}) as Record<
      string,
      string | string[] | undefined
    >;
    if (isTrustedInternalHeaders(headers)) {
      const forwarded = headers[INTERNAL_CLIENT_IP_HEADER];
      // Take the first entry: a forwarded chain is "client, proxy1, proxy2".
      const clientIp =
        typeof forwarded === 'string'
          ? forwarded.split(',')[0]?.trim()
          : undefined;
      if (clientIp) return Promise.resolve(`fwd:${clientIp}`);
    }
    // Narrowed rather than String()-ed: `req` is loosely typed here, and
    // stringifying a non-string `ip` would yield "[object Object]" - collapsing
    // every such request into ONE shared bucket.
    const ip = req.ip;
    return Promise.resolve(typeof ip === 'string' && ip ? ip : 'unknown');
  }

  /**
   * Same 429 as the default, plus a warning when the caller was first-party.
   *
   * A throttled trusted origin is never routine - it means either an SSR caller
   * hit a route whose tight `@Throttle()` excludes it from the bypass without
   * forwarding `INTERNAL_CLIENT_IP_HEADER` (so every visitor is sharing one
   * bucket), or the secret is being used by something it should not be. Both
   * would otherwise surface only as mysterious intermittent 429s.
   */
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      method?: string;
      url?: string;
    }>();
    if (isTrustedInternalHeaders(req.headers)) {
      this.logger.warn(
        `Trusted internal origin throttled on ${req.method ?? '?'} ${req.url ?? '?'} ` +
          `(limit ${throttlerLimitDetail.limit}/${throttlerLimitDetail.ttl}ms). ` +
          `If this route is called from SSR it must forward ${INTERNAL_CLIENT_IP_HEADER}, ` +
          `or every visitor shares one bucket.`,
      );
    }
    await super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
