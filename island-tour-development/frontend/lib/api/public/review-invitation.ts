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

const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050'}/api/v1`;

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
      `${BASE_URL}/reviews/invitation/${encodeURIComponent(token)}`,
      { cache: 'no-store', headers: { 'Content-Type': 'application/json' } },
    );
    if (!res.ok) return null;
    return (await res.json()) as PublicReviewInvitation;
  } catch {
    return null;
  }
}
