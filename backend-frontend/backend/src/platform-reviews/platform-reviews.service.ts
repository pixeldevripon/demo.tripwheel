import { decrypt, encrypt, maskSecret } from '@/common/utils/crypto.util';
import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  PlatformReviewDto,
  PlatformReviewsConfigResponseDto,
  PublicPlatformReviewsResponseDto,
  RefreshPlatformReviewsResponseDto,
  UpdatePlatformReviewsConfigDto,
} from './dto/platform-reviews.dto';

/**
 * Third-party platform reviews (master point 15): the admin configures the
 * Trustpilot API or the Google Reviews API in the dashboard; the system
 * fetches reviews automatically and the public site renders them.
 *
 * Design:
 * - The fetched payload is CACHED in the config row (`cachedPayload` +
 *   `fetchedAt`) and refreshed lazily when older than {@link CACHE_TTL_MS} -
 *   public reads never block on the third-party API when a cache exists, and
 *   a failed refresh serves the stale payload rather than an empty section.
 * - The API key is encrypted at rest and only ever returned masked.
 * - Social-proof gate: the public payload is `visible` only when the
 *   platform's total review count EXCEEDS {@link MIN_REVIEWS} - a section
 *   bragging about 12 reviews hurts more than it helps.
 */

/** Show the section only above this many platform reviews (founder rule). */
const MIN_REVIEWS = 100;

/** Refresh the cached payload when older than this (12 hours). */
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

/** How many reviews we keep for display. */
const MAX_REVIEWS = 6;

/** Third-party call guard - a slow provider must not hang a request. */
const FETCH_TIMEOUT_MS = 8_000;

interface NormalizedPayload {
  provider: string;
  rating: number | null;
  reviewCount: number | null;
  reviews: PlatformReviewDto[];
}

@Injectable()
export class PlatformReviewsService {
  private readonly logger = new Logger(PlatformReviewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Config (admin) ──────────────────────────────────────────────────────────

  private async getRow() {
    return this.prisma.platformReviewsConfig.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
  }

  private toConfigResponse(
    row: Awaited<ReturnType<PlatformReviewsService['getRow']>>,
  ): PlatformReviewsConfigResponseDto {
    const payload = (row.cachedPayload ?? null) as NormalizedPayload | null;
    return {
      id: row.id,
      provider: row.provider ?? null,
      apiKey: maskSecret(row.apiKey || null),
      businessId: row.businessId ?? null,
      enabled: row.enabled,
      displayPages: Array.isArray(row.displayPages)
        ? (row.displayPages as string[])
        : ['homepage'],
      fetchedAt: row.fetchedAt,
      lastError: row.lastError ?? null,
      reviewCount: payload?.reviewCount ?? null,
      rating: payload?.rating ?? null,
    };
  }

  async getConfig(): Promise<PlatformReviewsConfigResponseDto> {
    return this.toConfigResponse(await this.getRow());
  }

  async updateConfig(
    dto: UpdatePlatformReviewsConfigDto,
  ): Promise<PlatformReviewsConfigResponseDto> {
    const row = await this.getRow();

    const data: Prisma.PlatformReviewsConfigUpdateInput = {};
    if (dto.provider !== undefined) data.provider = dto.provider;
    if (dto.businessId !== undefined) data.businessId = dto.businessId.trim();
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.displayPages !== undefined) data.displayPages = dto.displayPages;

    if (dto.apiKey !== undefined && !dto.apiKey.startsWith('••••')) {
      // '' clears; anything else is a new plaintext key. Masked echoes are
      // ignored so a form round-trip cannot corrupt the stored secret.
      data.apiKey = dto.apiKey ? encrypt(dto.apiKey.trim()) : '';
    }

    // Identity changed -> the cache describes the OLD source; drop it.
    const identityChanged =
      (dto.provider !== undefined && dto.provider !== row.provider) ||
      (dto.businessId !== undefined &&
        dto.businessId.trim() !== (row.businessId ?? '')) ||
      (dto.apiKey !== undefined && !dto.apiKey.startsWith('••••'));
    if (identityChanged) {
      data.cachedPayload = Prisma.DbNull;
      data.fetchedAt = null;
      data.lastError = null;
    }

    const updated = await this.prisma.platformReviewsConfig.update({
      where: { id: 'default' },
      data,
    });
    this.logger.log(
      `Platform reviews config updated (provider=${updated.provider ?? 'none'}, enabled=${updated.enabled})`,
    );
    return this.toConfigResponse(updated);
  }

  // ── Refresh (admin "test/fetch now" + lazy public refresh) ─────────────────

  async refresh(): Promise<RefreshPlatformReviewsResponseDto> {
    const row = await this.getRow();
    if (!row.provider || !row.businessId || !row.apiKey) {
      throw new BadRequestException(
        'Set a provider, API key, and business/place ID first',
      );
    }

    try {
      const payload = await this.fetchFromProvider(
        row.provider,
        decrypt(row.apiKey),
        row.businessId,
      );
      await this.prisma.platformReviewsConfig.update({
        where: { id: 'default' },
        data: {
          cachedPayload: payload as unknown as Prisma.InputJsonValue,
          fetchedAt: new Date(),
          lastError: null,
        },
      });
      this.logger.log(
        `Platform reviews refreshed: ${row.provider} rating=${payload.rating} count=${payload.reviewCount}`,
      );
      return {
        ok: true,
        reviewCount: payload.reviewCount ?? undefined,
        rating: payload.rating ?? undefined,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fetch failed';
      await this.prisma.platformReviewsConfig.update({
        where: { id: 'default' },
        data: { lastError: message },
      });
      this.logger.warn(`Platform reviews refresh failed: ${message}`);
      return { ok: false, error: message };
    }
  }

  // ── Public read (marketing site) ───────────────────────────────────────────

  async getPublic(): Promise<PublicPlatformReviewsResponseDto> {
    const hidden: PublicPlatformReviewsResponseDto = {
      visible: false,
      provider: null,
      rating: null,
      reviewCount: null,
      reviews: [],
      displayPages: [],
    };

    let row = await this.getRow();
    if (!row.enabled || !row.provider || !row.businessId || !row.apiKey) {
      return hidden;
    }

    // Lazy refresh: fetch when there is no cache yet or it has gone stale.
    // Failures are non-fatal - a stale payload beats an empty section.
    const stale =
      !row.fetchedAt || Date.now() - row.fetchedAt.getTime() > CACHE_TTL_MS;
    if (stale) {
      await this.refresh();
      row = await this.getRow();
    }

    const payload = (row.cachedPayload ?? null) as NormalizedPayload | null;
    if (!payload) return hidden;

    // Social-proof gate: only brag once the platform count exceeds MIN_REVIEWS.
    if (!payload.reviewCount || payload.reviewCount <= MIN_REVIEWS) {
      return hidden;
    }

    return {
      visible: true,
      provider: payload.provider,
      rating: payload.rating,
      reviewCount: payload.reviewCount,
      reviews: payload.reviews,
      displayPages: Array.isArray(row.displayPages)
        ? (row.displayPages as string[])
        : ['homepage'],
    };
  }

  // ── Provider fetchers ──────────────────────────────────────────────────────

  private fetchFromProvider(
    provider: string,
    apiKey: string,
    businessId: string,
  ): Promise<NormalizedPayload> {
    if (provider === 'trustpilot') {
      return this.fetchTrustpilot(apiKey, businessId);
    }
    if (provider === 'google') {
      return this.fetchGoogle(apiKey, businessId);
    }
    throw new BadRequestException(`Unknown provider '${provider}'`);
  }

  private async fetchJson(url: string, init?: RequestInit): Promise<unknown> {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(
        `Provider responded ${res.status} - check the API key and business/place ID`,
      );
    }
    return res.json();
  }

  /**
   * Trustpilot public API: business-unit aggregate + latest reviews.
   * https://developers.trustpilot.com/business-units-api
   */
  private async fetchTrustpilot(
    apiKey: string,
    businessUnitId: string,
  ): Promise<NormalizedPayload> {
    const base = 'https://api.trustpilot.com/v1';
    const headers = { apikey: apiKey };

    const unit = (await this.fetchJson(
      `${base}/business-units/${encodeURIComponent(businessUnitId)}`,
      { headers },
    )) as {
      score?: { trustScore?: number };
      numberOfReviews?: { total?: number };
    };

    const reviewsRes = (await this.fetchJson(
      `${base}/business-units/${encodeURIComponent(businessUnitId)}/reviews?perPage=${MAX_REVIEWS}&orderBy=createdat.desc`,
      { headers },
    )) as {
      reviews?: Array<{
        stars?: number;
        text?: string;
        createdAt?: string;
        consumer?: { displayName?: string };
      }>;
    };

    return {
      provider: 'trustpilot',
      rating: unit.score?.trustScore ?? null,
      reviewCount: unit.numberOfReviews?.total ?? null,
      reviews: (reviewsRes.reviews ?? [])
        .filter((r) => !!r.text)
        .slice(0, MAX_REVIEWS)
        .map((r) => ({
          author: r.consumer?.displayName ?? 'Trustpilot reviewer',
          avatarUrl: null,
          rating: r.stars ?? 0,
          text: r.text ?? '',
          publishedAt: r.createdAt ?? null,
          relativeTime: null,
        })),
    };
  }

  /**
   * Google Places API (New) Place Details - rating, count, and the five
   * "most relevant" reviews Google exposes.
   * https://developers.google.com/maps/documentation/places/web-service/place-details
   */
  private async fetchGoogle(
    apiKey: string,
    placeId: string,
  ): Promise<NormalizedPayload> {
    const data = (await this.fetchJson(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'rating,userRatingCount,reviews',
        },
      },
    )) as {
      rating?: number;
      userRatingCount?: number;
      reviews?: Array<{
        rating?: number;
        text?: { text?: string };
        publishTime?: string;
        relativePublishTimeDescription?: string;
        authorAttribution?: { displayName?: string; photoUri?: string };
      }>;
    };

    return {
      provider: 'google',
      rating: data.rating ?? null,
      reviewCount: data.userRatingCount ?? null,
      reviews: (data.reviews ?? [])
        .filter((r) => !!r.text?.text)
        .slice(0, MAX_REVIEWS)
        .map((r) => ({
          author: r.authorAttribution?.displayName ?? 'Google reviewer',
          avatarUrl: r.authorAttribution?.photoUri ?? null,
          rating: r.rating ?? 0,
          text: r.text?.text ?? '',
          publishedAt: r.publishTime ?? null,
          relativeTime: r.relativePublishTimeDescription ?? null,
        })),
    };
  }
}
