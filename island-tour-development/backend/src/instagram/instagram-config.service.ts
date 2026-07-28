import { Injectable } from '@nestjs/common';

import { encrypt, safeDecrypt } from '@/common/utils/crypto.util';
import { PrismaService } from '@/prisma/prisma.service';

const ACCOUNT_ID = 'default';

/** The resolved Instagram credential. One thing: a long-lived access token. */
export interface InstagramConfig {
  /**
   * The long-lived access token, from the dashboard row (configAccessToken).
   * DB-only - there is no env fallback, no OAuth, no App ID/Secret/Redirect.
   */
  accessToken: string;
  /** True when a token is present - the sync can run. */
  hasToken: boolean;
  /** Same as hasToken; kept as the general "is this set up" flag. */
  isConfigured: boolean;
}

/** The non-secret credential view for the dashboard (token shown only as a boolean). */
export interface InstagramCredentialStatus {
  hasAccessToken: boolean;
  isConfigured: boolean;
}

/** What the dashboard PATCHes. Omit to leave unchanged; '' clears the stored token. */
export interface SaveInstagramCredentials {
  accessToken?: string;
}

/**
 * The single source of the Instagram access token: the InstagramAccount row,
 * encrypted (crypto.util). DB-ONLY - the token is entered in the dashboard and
 * lives in the database; there is deliberately no INSTAGRAM_ACCESS_TOKEN env
 * fallback. Resolved per call so a change needs no restart.
 */
@Injectable()
export class InstagramConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(): Promise<InstagramConfig> {
    const row = await this.prisma.instagramAccount.findUnique({
      where: { id: ACCOUNT_ID },
      select: { configAccessToken: true },
    });

    const accessToken = safeDecrypt(row?.configAccessToken)?.trim() || '';
    const hasToken = Boolean(accessToken);
    return { accessToken, hasToken, isConfigured: hasToken };
  }

  /** The dashboard's non-secret view of the current credential. */
  async getCredentialStatus(): Promise<InstagramCredentialStatus> {
    const row = await this.prisma.instagramAccount.findUnique({
      where: { id: ACCOUNT_ID },
      select: { configAccessToken: true },
    });
    const hasAccessToken = Boolean(row?.configAccessToken);
    return { hasAccessToken, isConfigured: hasAccessToken };
  }

  /**
   * Persist the dashboard access token (encrypted). Undefined leaves it
   * unchanged; an empty string clears it (the feed then has no token).
   *
   * Saving a token is a RECONNECT: it invalidates the seeded working connection
   * (igUserId + the refreshed token + last-sync state) so the next sync re-seeds
   * from the new token and re-resolves the account/handle. It is one atomic
   * upsert because both the credential and the connection live on this singleton
   * row - a stale igUserId paired with a fresh token would otherwise read the
   * wrong account's media.
   */
  async saveCredentials(dto: SaveInstagramCredentials): Promise<void> {
    if (dto.accessToken === undefined) return;
    const configAccessToken = dto.accessToken.trim()
      ? encrypt(dto.accessToken.trim())
      : null;
    await this.prisma.instagramAccount.upsert({
      where: { id: ACCOUNT_ID },
      update: {
        configAccessToken,
        igUserId: null,
        accessToken: null,
        tokenExpiresAt: null,
        lastSyncedAt: null,
        lastSyncStatus: null,
        lastSyncError: null,
      },
      create: { id: ACCOUNT_ID, configAccessToken },
    });
  }
}
