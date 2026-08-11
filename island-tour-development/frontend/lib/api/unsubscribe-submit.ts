import { seg } from '@/lib/api/api-path';
import { BACKEND_API_BASE } from '@/lib/api/backend-url';

/**
 * Client-side confirm for the tokenized unsubscribe page (browser).
 *
 * The endpoint is `@Public()` on the backend and authenticated by the
 * unsubscribe token in the path, so this is a plain fetch with no auth
 * cookie - the `review-submit.ts` lane. The server resolves the token for
 * the initial render (`lib/api/public/unsubscribe.ts`); this module owns
 * the one write.
 */

/**
 * Records the opt-out. Idempotent on the backend: confirming twice is a
 * no-op, not an error, because the link in a months-old email must keep
 * working however many times it is clicked.
 */
export async function confirmUnsubscribe(token: string): Promise<{
  email: string;
  audience: 'TRAVELLER' | 'OPERATOR';
  stream: 'LIFECYCLE' | 'MARKETING';
  optedOut: true;
}> {
  const res = await fetch(`${BACKEND_API_BASE}/email/unsubscribe/${seg(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as {
    email: string;
    audience: 'TRAVELLER' | 'OPERATOR';
    stream: 'LIFECYCLE' | 'MARKETING';
    optedOut: true;
  };
}
