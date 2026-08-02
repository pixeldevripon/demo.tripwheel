import { seg } from '@/lib/api/api-path';
import { BACKEND_API_BASE } from '@/lib/api/backend-url';
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

async function post<T>(path: string, body: unknown, method = 'POST'): Promise<T> {
  const res = await fetch(`${BACKEND_API_BASE}${path}`, {
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
  return post(`/reviews/invitation/${seg(token)}`, { rating });
}

/** Steps 2/3/3b. Every field optional, so each step can save on its own. */
export function enrichReview(
  token: string,
  patch: {
    /** Correct a mistapped star while the review is still pending. */
    rating?: number;
    comment?: string;
    title?: string;
    photos?: string[];
    reviewerType?: 'COUPLE' | 'FAMILY' | 'FRIENDS' | 'SOLO';
  },
): Promise<{ reviewId: string; saved: boolean }> {
  return post(`/reviews/invitation/${seg(token)}`, patch, 'PATCH');
}

/**
 * Step 3 - real photo upload (BE-16).
 *
 * Multipart to our own backend, which puts the file on Cloudinary under
 * `reviews/<reviewId>/` and returns every photo now attached. The guest is on a
 * phone straight off a boat: asking them to host an image somewhere and paste a
 * URL is asking them not to bother.
 *
 * Not a plain `post()` - that sets a JSON content-type, and multipart needs the
 * browser to set its own boundary.
 */
export async function uploadReviewPhotos(
  token: string,
  files: File[],
): Promise<{ reviewId: string; photos: string[] }> {
  const form = new FormData();
  for (const file of files) form.append('files', file);
  const res = await fetch(`${BACKEND_API_BASE}/reviews/invitation/${token}/photos`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const msg = await res
      .json()
      .then((b: { message?: string }) => b.message)
      .catch(() => null);
    throw new Error(msg || `Upload failed (${res.status})`);
  }
  return (await res.json()) as { reviewId: string; photos: string[] };
}

/**
 * Step 4b. The private service-recovery channel, offered ALONGSIDE the neutral
 * platform-review invitation on a low score - never as a substitute for it.
 */
export function sendPrivateFeedback(
  token: string,
  message: string,
): Promise<{ received: boolean }> {
  return post(`/reviews/invitation/${seg(token)}/feedback`, { message });
}
