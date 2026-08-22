import { Inject, Injectable, Logger } from '@nestjs/common';
import { InstagramSyncStatus } from '@prisma/client';

import { encrypt, safeDecrypt } from '@/common/utils/crypto.util';
import { PrismaService } from '@/prisma/prisma.service';

import { InstagramConfigService } from './instagram-config.service';
import {
  INSTAGRAM_API_PROVIDER,
  type InstagramApiProvider,
  type InstagramTokenResult,
} from './providers/instagram-api.provider';

const ACCOUNT_ID = 'default';

/** How near expiry (ms) the daily job refreshes the long-lived token. */
export const REFRESH_WINDOW_MS = 10 * 24 * 60 * 60 * 1000; // 10 days

/** Assumed lifetime for a freshly-seeded token when its real expiry is unknown. */
const ASSUMED_LIFETIME_SECONDS = 60 * 24 * 60 * 60; // 60 days

/** The connection state the dashboard panel renders - never the token itself. */
export interface InstagramConnection {
  /** True as soon as an access token is configured (dashboard or env). */
  connected: boolean;
  igUserId: string | null;
  tokenExpiresAt: Date | null;
  lastSyncedAt: Date | null;
  lastSyncStatus: InstagramSyncStatus | null;
  lastSyncError: string | null;
}

/**
 * Owns the WORKING Instagram connection on InstagramAccount: the account the
 * configured token belongs to (igUserId), the refreshed copy of the token, and
 * its expiry. The dashboard token (InstagramConfigService.configAccessToken)
 * SEEDS this once; the nightly refresh keeps it alive thereafter. The token is
 * encrypted with crypto.util (ENCRYPTION_KEY) and NEVER returned to any HTTP
 * surface or log line, and this exposes a token-free status view for the panel.
 */
@Injectable()
export class InstagramTokenService {
  private readonly logger = new Logger(InstagramTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: InstagramConfigService,
    @Inject(INSTAGRAM_API_PROVIDER)
    private readonly provider: InstagramApiProvider,
  ) {}

  /**
   * Store the working connection seeded from the configured token: the resolved
   * account id, the (refreshed) token, and its expiry. Upserts the singleton
   * account (the seed may be its very first row) and clears any stale sync error
   * - a fresh seed is a clean slate.
   */
  async saveConnection(
    token: InstagramTokenResult,
    username?: string | null,
  ): Promise<void> {
    const data = {
      igUserId: token.userId,
      accessToken: encrypt(token.accessToken),
      tokenExpiresAt: expiryFrom(token.expiresInSeconds),
      lastSyncStatus: null,
      lastSyncError: null,
      // The handle is auto-derived from the connected account, never typed in.
      ...(username !== undefined && username !== null && { username }),
    };
    await this.prisma.instagramAccount.upsert({
      where: { id: ACCOUNT_ID },
      update: data,
      create: { id: ACCOUNT_ID, ...data },
    });
    this.logger.log(`Instagram account connected (ig user ${token.userId})`);
  }

  /**
   * Store a refreshed token. Keeps the existing igUserId (refresh does not
   * return one) and only advances the token + expiry.
   */
  async saveRefreshedToken(token: InstagramTokenResult): Promise<void> {
    await this.prisma.instagramAccount.update({
      where: { id: ACCOUNT_ID },
      data: {
        accessToken: encrypt(token.accessToken),
        tokenExpiresAt: expiryFrom(token.expiresInSeconds),
      },
    });
    this.logger.log('Instagram long-lived token refreshed');
  }

  /**
   * The decrypted token + user id for the sync/refresh, or null when there is no
   * usable connection (no token configured, or the configured token's account
   * cannot be resolved). INTERNAL ONLY - never goes near a controller.
   *
   * The configured token (dashboard, else env) SEEDS the working connection
   * once; the nightly refresh keeps the stored copy alive thereafter, so a token
   * pasted in the dashboard gets the same 60-day auto-refresh, not one that
   * silently dies.
   */
  async readCredential(): Promise<{
    igUserId: string;
    accessToken: string;
    tokenExpiresAt: Date | null;
  } | null> {
    const cfg = await this.config.resolve();
    if (!cfg.hasToken) return null;
    return this.readOrSeedToken(cfg.accessToken);
  }

  /**
   * Prefers a live stored token (the nightly refresh keeps it fresh) and only
   * SEEDS from the configured token when the stored one is missing/expired - so
   * the configured value bootstraps the connection once and the refresh cycle
   * owns it thereafter. Called only from readCredential (sync path), never from
   * getConnection, so a dashboard load never hits the API.
   */
  private async readOrSeedToken(seedToken: string): Promise<{
    igUserId: string;
    accessToken: string;
    tokenExpiresAt: Date | null;
  } | null> {
    const row = await this.prisma.instagramAccount.findUnique({
      where: { id: ACCOUNT_ID },
      select: { igUserId: true, accessToken: true, tokenExpiresAt: true },
    });
    const storedToken = safeDecrypt(row?.accessToken);

    // A live stored token (present, decryptable, not near/at expiry) is the
    // refreshed one - use it and let the sync's own refresh window keep it alive.
    if (row?.igUserId && storedToken && !isExpired(row.tokenExpiresAt)) {
      return {
        igUserId: row.igUserId,
        accessToken: storedToken,
        tokenExpiresAt: row.tokenExpiresAt,
      };
    }

    // Otherwise seed from the configured token: resolve the real account (id +
    // handle), and try to get a real expiry (and a fresh 60-day token) by
    // refreshing it right away. If it is too new to refresh (<24h old), keep it
    // and assume 60 days.
    let account: { userId: string; username: string | null };
    try {
      account = await this.provider.resolveAccount(seedToken);
    } catch (err) {
      this.logger.error(
        `Instagram /me failed for the configured token: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      return null;
    }
    const igUserId = account.userId;

    let token = seedToken;
    let expiresInSeconds = ASSUMED_LIFETIME_SECONDS;
    try {
      const refreshed = await this.provider.refreshToken(seedToken);
      if (refreshed.accessToken) token = refreshed.accessToken;
      if (refreshed.expiresInSeconds)
        expiresInSeconds = refreshed.expiresInSeconds;
    } catch {
      // Non-refreshable (too new / non-refresh token). Keep the configured token;
      // the nightly job will refresh it once it is old enough.
    }

    await this.saveConnection(
      { accessToken: token, userId: igUserId, expiresInSeconds },
      account.username,
    );
    return {
      igUserId,
      accessToken: token,
      tokenExpiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }

  /**
   * The token-free status for the dashboard connection panel. Connected as soon
   * as a token is configured; the user id + expiry become meaningful once the
   * first sync seeds the working connection. Never hits the Instagram API.
   */
  async getConnection(): Promise<InstagramConnection> {
    const [row, cfg] = await Promise.all([
      this.prisma.instagramAccount.findUnique({
        where: { id: ACCOUNT_ID },
        select: {
          igUserId: true,
          tokenExpiresAt: true,
          lastSyncedAt: true,
          lastSyncStatus: true,
          lastSyncError: true,
        },
      }),
      this.config.resolve(),
    ]);

    return {
      connected: cfg.hasToken,
      igUserId: row?.igUserId ?? null,
      tokenExpiresAt: row?.tokenExpiresAt ?? null,
      lastSyncedAt: row?.lastSyncedAt ?? null,
      lastSyncStatus: row?.lastSyncStatus ?? null,
      lastSyncError: row?.lastSyncError ?? null,
    };
  }

  /** Keep the stored handle in step with the connected account (auto, not typed). */
  async storeUsername(username: string | null): Promise<void> {
    if (!username) return;
    await this.prisma.instagramAccount.updateMany({
      where: { id: ACCOUNT_ID },
      data: { username },
    });
  }

  /** Record the outcome of a sync run (or a failing refresh). */
  async recordSyncResult(
    status: InstagramSyncStatus,
    error: string | null,
  ): Promise<void> {
    await this.prisma.instagramAccount.updateMany({
      where: { id: ACCOUNT_ID },
      data: {
        lastSyncedAt: new Date(),
        lastSyncStatus: status,
        lastSyncError: error,
      },
    });
  }
}

/** now + N seconds, as an absolute expiry the refresh window is measured against. */
function expiryFrom(expiresInSeconds: number): Date {
  return new Date(Date.now() + expiresInSeconds * 1000);
}

/** Past its expiry (or unknown). A missing expiry counts as expired so the env
 * token re-seeds rather than being trusted forever. */
function isExpired(expiresAt: Date | null): boolean {
  return !expiresAt || expiresAt.getTime() <= Date.now();
}
