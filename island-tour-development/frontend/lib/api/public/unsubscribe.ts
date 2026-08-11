/**
 * Server-side resolution of an email-unsubscribe token.
 *
 * DELIBERATELY NOT CACHED - the same rule as `review-invitation.ts`. The token
 * is a long-lived credential whose answer changes the moment the recipient
 * acts on it (`optedOut` flips true): a cached "not yet opted out" would keep
 * offering the confirm button after the opt-out landed, and there is at most
 * one human per token anyway, so caching buys nothing and costs correctness.
 */
import 'server-only';

import { seg } from '@/lib/api/api-path';
import { perVisitorThrottleHeaders } from '@/lib/api/visitor-throttle';
import { BACKEND_API_BASE } from '@/lib/api/backend-url';

/** Who the token's email belongs to - mirrors the backend `EmailAudience`. */
export type UnsubscribeAudience = 'TRAVELLER' | 'OPERATOR';

/**
 * The stream the token opts out of. Only the two opt-out-able streams ever
 * reach this page: TRANSACTIONAL and INTERNAL emails carry no unsubscribe
 * link by design (plan §2.3).
 */
export type UnsubscribeStream = 'LIFECYCLE' | 'MARKETING';

/** `GET /email/unsubscribe/:token` - the email arrives masked (`j***@host`). */
export interface PublicUnsubscribeInfo {
  email: string;
  audience: UnsubscribeAudience;
  stream: UnsubscribeStream;
  optedOut: boolean;
}

/**
 * Resolve a token, or `null` when it is unknown, malformed, or the backend is
 * unreachable. The backend 400s a non-UUID and 404s an unknown UUID with the
 * same empty hands - no oracle - and the page renders one shared "no longer
 * valid" state for every failure, so they all collapse to `null` here.
 */
export async function getUnsubscribeInfo(
  token: string,
): Promise<PublicUnsubscribeInfo | null> {
  try {
    // Per-visitor throttle bucket: without these headers every SSR resolve
    // on the platform shares ONE 10/min bucket keyed on our egress IP, and a
    // junk-token loop makes every legitimate unsubscribe link render "no
    // longer valid" - a false statement on a compliance surface. Safe here
    // precisely because the route declares its own @Throttle (the key only
    // re-keys the bucket, never bypasses it). Template: claimConversionPush.
    const res = await fetch(`${BACKEND_API_BASE}/email/unsubscribe/${seg(token)}`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(await perVisitorThrottleHeaders()),
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as PublicUnsubscribeInfo;
  } catch {
    return null;
  }
}
