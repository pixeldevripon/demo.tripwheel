import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpsRequest, type RequestOptions } from 'node:https';
import type { LookupFunction } from 'node:net';
import { blockedHostnameReason, blockedIpReason } from './ip-guard.util';

/**
 * HTTP GET for URLs supplied by an OPERATOR rather than by us.
 *
 * ## The threat
 * Fetching a user-controlled URL from inside our network is server-side request
 * forgery. Everything below exists to make our egress useless as an attack tool:
 * the scheme is pinned to https, every resolved address is screened against
 * `ip-guard.util.ts`, redirects are re-validated hop by hop, and - the part that
 * is easy to get wrong - **the socket connects to the exact IP we validated**,
 * not to whatever DNS answers a second time.
 *
 * ## DNS rebinding, and why `lookup` is overridden
 * The naive shape is "resolve, check the IP, then hand the hostname to the HTTP
 * client". That is a TOCTOU bug: the client resolves AGAIN when it dials, and an
 * attacker controlling the zone can answer `93.184.216.34` for our check and
 * `169.254.169.254` for the real connection, with a one-second TTL. Passing a
 * `lookup` that ignores its hostname argument and returns the address we already
 * approved closes that window completely. TLS `servername` and the `Host` header
 * still carry the real hostname, so certificate validation is unaffected.
 *
 * ## Not handled here, on purpose
 * Whether the body is a calendar. This module speaks HTTP; the parser decides
 * what the bytes mean.
 */

export const SAFE_FETCH_LIMITS = {
  /** Socket-level connect timeout. */
  connectTimeoutMs: 10_000,
  /** Whole-request budget including redirects, body and TLS. */
  totalTimeoutMs: 30_000,
  /** Enforced on Content-Length AND again while streaming, since the header lies. */
  maxBytes: 5 * 1024 * 1024,
  maxRedirects: 3,
} as const;

/**
 * Identifies us to channels, several of which block generic clients, and gives a
 * hosting provider somewhere to complain rather than silently null-routing us.
 */
const USER_AGENT =
  'IslandToursCalendarSync/1.0 (+https://tripwheel.app/calendar-sync)';

export type SafeFetchErrorCode =
  | 'URL_MALFORMED'
  | 'URL_NOT_HTTPS'
  | 'URL_HAS_CREDENTIALS'
  | 'URL_BLOCKED_HOST'
  | 'HOST_UNREACHABLE'
  | 'TOO_MANY_REDIRECTS'
  | 'CONNECT_TIMEOUT'
  | 'FEED_TIMEOUT'
  | 'FEED_TOO_LARGE'
  | 'TLS_ERROR'
  | 'NETWORK_ERROR'
  | `HTTP_${number}`;

export interface SafeFetchSuccess {
  ok: true;
  notModified: false;
  status: number;
  body: string;
  contentType: string | null;
  etag: string | null;
  lastModified: string | null;
  sizeBytes: number;
  /** After redirects. Used for per-host rate limiting and for showing the operator where they actually landed. */
  finalUrl: string;
}

export interface SafeFetchNotModified {
  ok: true;
  notModified: true;
  status: 304;
}

export interface SafeFetchFailure {
  ok: false;
  code: SafeFetchErrorCode;
  message: string;
  /**
   * Transient = retry on the ladder. Permanent = stop immediately.
   *
   * The split matters more than it looks: retrying a 404 sixteen times helps
   * nobody, and treating a 30-second timeout as permanent would disconnect a
   * healthy channel over one bad afternoon.
   */
  transient: boolean;
  httpStatus?: number;
}

export type SafeFetchResult =
  | SafeFetchSuccess
  | SafeFetchNotModified
  | SafeFetchFailure;

export interface SafeFetchOptions {
  /** Sent as `If-None-Match`; a matching feed answers 304 and costs us nothing. */
  etag?: string | null;
  /** Sent as `If-Modified-Since`, for feeds that version by time rather than tag. */
  lastModified?: string | null;
}

const fail = (
  code: SafeFetchErrorCode,
  message: string,
  transient: boolean,
  httpStatus?: number,
): SafeFetchFailure => ({ ok: false, code, message, transient, httpStatus });

/**
 * A real type guard rather than an inline `'ok' in x` check: only a guard narrows
 * the NEGATIVE branch too, which is what lets the happy path below read straight
 * down without casts.
 */
function isFailure(value: object): value is SafeFetchFailure {
  return (value as SafeFetchFailure).ok === false;
}

/**
 * Normalise for storage and duplicate detection (PRD §8.4).
 *
 * Query parameters are preserved EXACTLY - order, case and all - because an OTA
 * calendar URL carries its auth token in the query string, and "tidying" it
 * breaks the feed. Only the parts that are provably insignificant are touched.
 */
export function normalizeFeedUrl(raw: string): string {
  // C0 controls and the zero-width family paste in invisibly from help articles
  // and support chats, and break URL parsing with no visible cause. Stripping
  // control characters IS the point here, so the rule is disabled deliberately.
  const trimmed = raw
    .trim()
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F\u200B-\u200D\uFEFF]/g, '');
  const rewritten = trimmed.replace(/^webcal:\/\//i, 'https://');
  const url = new URL(rewritten);

  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  url.hash = '';
  if (url.port === '443') url.port = '';
  if (url.pathname === '/') url.pathname = '';

  return url.toString();
}

/** Validation that needs no network. Returns the parsed URL or a failure. */
export function validateFeedUrl(
  raw: string,
): { ok: true; url: URL } | SafeFetchFailure {
  let url: URL;
  try {
    url = new URL(normalizeFeedUrl(raw));
  } catch {
    return fail(
      'URL_MALFORMED',
      'This does not look like a valid link.',
      false,
    );
  }

  if (url.protocol !== 'https:') {
    return fail(
      'URL_NOT_HTTPS',
      'Calendar links must start with https.',
      false,
    );
  }
  // Credentials in the URL would be forwarded to whatever the redirect chain ends at.
  if (url.username || url.password) {
    return fail(
      'URL_HAS_CREDENTIALS',
      'Remove the username and password from this link.',
      false,
    );
  }

  const blocked = blockedHostnameReason(url.hostname);
  if (blocked) {
    return fail('URL_BLOCKED_HOST', 'This address cannot be used.', false);
  }

  return { ok: true, url };
}

/**
 * Resolve every address for a host and reject if ANY of them is private.
 *
 * All-or-nothing on purpose: a hostname answering with one public and one
 * internal address is not a half-safe target, it is an attack. Returns the
 * address we will pin the socket to.
 */
async function resolvePinnedAddress(
  hostname: string,
): Promise<{ address: string; family: number } | SafeFetchFailure> {
  let records: Array<{ address: string; family: number }>;
  try {
    records = await dnsLookup(hostname, { all: true });
  } catch {
    return fail(
      'HOST_UNREACHABLE',
      'We could not reach this address. Check the link and try again.',
      true,
    );
  }
  if (records.length === 0) {
    return fail('HOST_UNREACHABLE', 'We could not reach this address.', true);
  }
  for (const record of records) {
    if (blockedIpReason(record.address)) {
      return fail('URL_BLOCKED_HOST', 'This address cannot be used.', false);
    }
  }
  return records[0];
}

/**
 * Classify an HTTP status. 408/425/429 are transient despite being 4xx.
 *
 * Exported because the transient/permanent split decides whether a connection
 * retries or dies, which is a product decision worth asserting in tests rather
 * than an implementation detail.
 */
export function classifyHttpStatus(status: number): SafeFetchFailure {
  const transient =
    status >= 500 || status === 408 || status === 425 || status === 429;
  const message =
    status === 401 || status === 403
      ? 'This feed needs a login. Calendar links must be public.'
      : status === 404 || status === 410
        ? 'This link no longer exists. Regenerate it on that channel.'
        : transient
          ? 'That channel is having trouble. We will keep trying.'
          : `The channel responded with an error (${status}).`;
  return fail(`HTTP_${status}`, message, transient, status);
}

/** One hop. No redirect following - the caller re-validates and recurses. */
function fetchOnce(
  url: URL,
  pinned: { address: string; family: number },
  options: SafeFetchOptions,
  deadline: number,
): Promise<
  | {
      kind: 'response';
      status: number;
      headers: Record<string, string | undefined>;
      body: Buffer;
    }
  | { kind: 'redirect'; status: number; location: string }
  | SafeFetchFailure
> {
  return new Promise((resolve) => {
    // Ignores the hostname it is handed and returns the address already screened
    // above - this is what makes the check and the connection the same decision.
    const pinnedLookup: LookupFunction = (_hostname, opts, callback) => {
      const all =
        typeof opts === 'object' && opts !== null && opts.all === true;
      if (all) {
        (
          callback as (
            err: null,
            addrs: Array<{ address: string; family: number }>,
          ) => void
        )(null, [{ address: pinned.address, family: pinned.family }]);
      } else {
        callback(null, pinned.address, pinned.family);
      }
    };

    const requestOptions: RequestOptions = {
      protocol: url.protocol,
      hostname: url.hostname, // drives SNI + the Host header, so TLS still validates
      port: url.port || 443,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      lookup: pinnedLookup,
      headers: {
        accept: 'text/calendar, text/plain;q=0.9, */*;q=0.1',
        'user-agent': USER_AGENT,
        'accept-encoding': 'identity', // the size cap must count real bytes
        ...(options.etag ? { 'if-none-match': options.etag } : {}),
        ...(options.lastModified
          ? { 'if-modified-since': options.lastModified }
          : {}),
      },
    };

    let settled = false;
    const finish = (result: Awaited<ReturnType<typeof fetchOnce>>) => {
      if (settled) return;
      settled = true;
      clearTimeout(totalTimer);
      req.destroy();
      resolve(result);
    };

    const totalTimer = setTimeout(
      () =>
        finish(
          fail(
            'FEED_TIMEOUT',
            'The channel did not respond in time. We will try again.',
            true,
          ),
        ),
      Math.max(1, deadline - Date.now()),
    );

    const req = httpsRequest(requestOptions, (res) => {
      const status = res.statusCode ?? 0;

      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume(); // drain, we only need the header
        finish({ kind: 'redirect', status, location: res.headers.location });
        return;
      }

      // Trust the declared length enough to bail early, never enough to skip counting.
      const declared = Number(res.headers['content-length'] ?? '');
      if (Number.isFinite(declared) && declared > SAFE_FETCH_LIMITS.maxBytes) {
        res.destroy();
        finish(
          fail(
            'FEED_TOO_LARGE',
            'This calendar is too large to sync (over 5 MB).',
            false,
          ),
        );
        return;
      }

      const chunks: Buffer[] = [];
      let received = 0;
      res.on('data', (chunk: Buffer) => {
        received += chunk.length;
        if (received > SAFE_FETCH_LIMITS.maxBytes) {
          res.destroy();
          finish(
            fail(
              'FEED_TOO_LARGE',
              'This calendar is too large to sync (over 5 MB).',
              false,
            ),
          );
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () =>
        finish({
          kind: 'response',
          status,
          headers: res.headers as Record<string, string | undefined>,
          body: Buffer.concat(chunks),
        }),
      );
      // A drop mid-body leaves a truncated file that looks exactly like a feed
      // whose later bookings were all cancelled. Never parse a partial body.
      res.on('error', () =>
        finish(
          fail('NETWORK_ERROR', 'The connection dropped while reading.', true),
        ),
      );
    });

    req.setTimeout(SAFE_FETCH_LIMITS.connectTimeoutMs, () =>
      finish(
        fail(
          'CONNECT_TIMEOUT',
          'The channel did not respond. Try again in a moment.',
          true,
        ),
      ),
    );

    req.on('error', (error: NodeJS.ErrnoException) => {
      // Expired / self-signed / hostname-mismatch certificates are rejected with
      // no bypass option - a channel that cannot present a valid certificate is
      // a channel we cannot prove we are talking to.
      const tls =
        typeof error.code === 'string' &&
        (error.code.startsWith('CERT_') ||
          error.code.startsWith('ERR_TLS') ||
          error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
          error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
          error.code === 'SELF_SIGNED_CERT_IN_CHAIN');
      finish(
        tls
          ? fail(
              'TLS_ERROR',
              "This channel's security certificate is not valid.",
              false,
            )
          : fail(
              'NETWORK_ERROR',
              'We could not reach this address. Check the link and try again.',
              true,
            ),
      );
    });

    req.end();
  });
}

/**
 * Fetch an operator-supplied calendar URL safely.
 *
 * Every redirect hop is re-validated from scratch — scheme, hostname, DNS and IP
 * range — because a feed that starts at a public host may redirect to
 * `169.254.169.254`, and checking only the first URL would wave it through.
 */
export async function safeFetchFeed(
  rawUrl: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const deadline = Date.now() + SAFE_FETCH_LIMITS.totalTimeoutMs;
  let target = rawUrl;

  for (let hop = 0; hop <= SAFE_FETCH_LIMITS.maxRedirects; hop++) {
    const validated = validateFeedUrl(target);
    if (isFailure(validated)) return validated;
    const { url } = validated;

    const pinned = await resolvePinnedAddress(url.hostname);
    if (isFailure(pinned)) return pinned;

    // Conditional headers belong to the resource, so they ride every hop.
    const result = await fetchOnce(url, pinned, options, deadline);

    if (isFailure(result)) return result;

    if (result.kind === 'redirect') {
      // Resolved against the CURRENT url so a relative Location works.
      target = new URL(result.location, url).toString();
      continue;
    }

    if (result.status === 304)
      return { ok: true, notModified: true, status: 304 };
    if (result.status < 200 || result.status >= 300) {
      return classifyHttpStatus(result.status);
    }

    const contentType = result.headers['content-type'] ?? null;
    return {
      ok: true,
      notModified: false,
      status: result.status,
      body: decodeBody(result.body, contentType),
      contentType,
      etag: result.headers.etag ?? null,
      lastModified: result.headers['last-modified'] ?? null,
      sizeBytes: result.body.length,
      finalUrl: url.toString(),
    };
  }

  return fail(
    'TOO_MANY_REDIRECTS',
    'This link redirects too many times.',
    false,
  );
}

/**
 * UTF-8, falling back to Latin-1.
 *
 * A calendar exported from an older European system is often Latin-1, and
 * decoding it as UTF-8 turns every accented character into U+FFFD. Sniffing for
 * that marker is cruder than reading the charset parameter but catches the feeds
 * that declare the wrong one, which is most of the ones that get this wrong.
 */
function decodeBody(buffer: Buffer, contentType: string | null): string {
  const declared = /charset=([^;]+)/i
    .exec(contentType ?? '')?.[1]
    ?.trim()
    .toLowerCase();
  if (declared && /^(iso-8859-1|latin1|windows-1252)$/.test(declared)) {
    return buffer.toString('latin1');
  }
  const utf8 = buffer.toString('utf8');
  return utf8.includes('�') ? buffer.toString('latin1') : utf8;
}
