import { Injectable, Logger } from '@nestjs/common';

/**
 * Notifies the public traveller site that backend-originated data changed, by
 * POSTing the frontend's cross-app invalidation endpoint (`POST
 * /api/revalidate`, header `x-revalidate-secret`, body `{ tags }`). The
 * frontend's `'use cache'` loaders are tag-invalidated on dashboard writes, but
 * writes that originate HERE (nightly quality-score/eligibility re-rank,
 * spotlight lifecycle, availability materialization) never pass through the
 * dashboard - without this call they would only surface when a `cacheLife`
 * timer expires (up to a day on the entity loaders).
 *
 * Dependencies (both optional - the service no-ops loudly when unset, so dev
 * environments without a running frontend are unaffected):
 *   - `ISLAND_TOURS_URL`: public site origin (also used for email links).
 *   - `REVALIDATE_SECRET`: must be one of the values in the frontend's
 *     comma-separated `REVALIDATE_SECRET` list.
 *
 * Usage: `await publicCache.revalidateTags(['tours', 'search'])`. Tags must
 * exist in the frontend's `lib/cache-tags.ts` vocabulary - the endpoint rejects
 * the WHOLE batch on any unknown tag. Never throws: cache busting is
 * best-effort and must not fail the job that triggered it (stale content
 * self-heals on the next cacheLife window).
 */
@Injectable()
export class PublicCacheService {
  private readonly logger = new Logger(PublicCacheService.name);

  async revalidateTags(tags: string[]): Promise<boolean> {
    const baseUrl = process.env.ISLAND_TOURS_URL?.trim();
    const secret = process.env.REVALIDATE_SECRET?.trim();
    if (!baseUrl || !secret) {
      this.logger.warn(
        `Public-cache revalidation skipped (${!baseUrl ? 'ISLAND_TOURS_URL' : 'REVALIDATE_SECRET'} not set): [${tags.join(', ')}]`,
      );
      return false;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(`${baseUrl}/api/revalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-revalidate-secret': secret,
        },
        body: JSON.stringify({ tags }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(
          `Public-cache revalidation failed (HTTP ${res.status}) for [${tags.join(', ')}]: ${body}`,
        );
        return false;
      }
      this.logger.log(`Public-cache revalidated: [${tags.join(', ')}]`);
      return true;
    } catch (err) {
      this.logger.error(
        `Public-cache revalidation unreachable for [${tags.join(', ')}]: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }
}
