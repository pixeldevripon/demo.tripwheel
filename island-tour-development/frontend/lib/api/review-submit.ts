/**
 * Client-side calls for the tokenized post-tour review flow (browser).
 *
 * Every endpoint is `@Public()` on the backend and authenticated by the
 * single-use invitation token in the path, so these are plain fetches with no
 * auth cookie - the same shape as the other anonymous public clients here.
 *
 * The server resolves the token for the initial render
 * (`lib/api/public/review-invitation.ts`); this module owns the writes.
 */
const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050'}/api/v1`;

async function post<T>(path: string, body: unknown, method = 'POST'): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
}

/**
 * Step 1. Commits the rating and SPENDS the token, so it succeeds exactly once.
 * Called on star press rather than on submit: a one-tap review still counts.
 */
export function startReview(
  token: string,
  rating: number,
): Promise<{ reviewId: string; rating: number }> {
  return post(`/reviews/invitation/${token}`, { rating });
}

/** Steps 2/3/3b. Every field optional, so each step can save on its own. */
export function enrichReview(
  token: string,
  patch: {
    comment?: string;
    title?: string;
    photos?: string[];
    reviewerType?: 'COUPLE' | 'FAMILY' | 'FRIENDS' | 'SOLO';
  },
): Promise<{ reviewId: string; saved: boolean }> {
  return post(`/reviews/invitation/${token}`, patch, 'PATCH');
}

/**
 * Step 4b. The private service-recovery channel, offered ALONGSIDE the neutral
 * platform-review invitation on a low score - never as a substitute for it.
 */
export function sendPrivateFeedback(
  token: string,
  message: string,
): Promise<{ received: boolean }> {
  return post(`/reviews/invitation/${token}/feedback`, { message });
}
