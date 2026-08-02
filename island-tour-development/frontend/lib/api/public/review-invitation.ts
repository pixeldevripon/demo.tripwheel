/**
 * Server-side resolution of a post-tour review invitation token.
 *
 * DELIBERATELY NOT CACHED. Every other loader here is `'use cache'`, but this one
 * is keyed by a single-use credential whose whole job is to stop being valid: a
 * cached "still valid" answer would keep a spent token looking usable for the
 * cacheLife window, and there is exactly one reader per token anyway, so caching
 * buys nothing and costs correctness.
 */
import 'server-only';

import type { PublicReviewInvitation } from '@/types/review';
import { BACKEND_API_BASE } from '@/lib/api/backend-url';

/**
 * Resolve a token, or `null` when it is unknown, already spent, revoked, or the
 * backend is unreachable. The page renders the same "no longer valid" state for
 * all of those - the backend deliberately does not distinguish them either.
 */
export async function getReviewInvitation(
  token: string,
): Promise<PublicReviewInvitation | null> {
  try {
    const res = await fetch(
      `${BACKEND_API_BASE}/reviews/invitation/${encodeURIComponent(token)}`,
      { cache: 'no-store', headers: { 'Content-Type': 'application/json' } },
    );
    if (!res.ok) return null;
    return (await res.json()) as PublicReviewInvitation;
  } catch {
    return null;
  }
}
