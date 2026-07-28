import { Injectable } from '@nestjs/common';

import {
  encrypt,
  maskSecret,
  safeDecrypt,
  secretEquals,
} from '@/common/utils/crypto.util';
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

/** The non-secret credential view for the dashboard. */
export interface InstagramCredentialStatus {
  hasAccessToken: boolean;
  isConfigured: boolean;
  /**
   * Bullets + the last 4 characters (e.g. `••••••••WQZD`), so an admin can tell
   * WHICH token is stored without it being usable. Same masking the Stripe /
   * Mollie / translation keys use. Null when nothing is stored, and also when
   * the stored ciphertext no longer decrypts (a rotated ENCRYPTION_KEY) - which
   * `hasAccessToken: true` alongside a null mask is the signal for.
   */
  maskedAccessToken: string | null;
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
    return {
      hasAccessToken,
      isConfigured: hasAccessToken,
      maskedAccessToken: maskSecret(row?.configAccessToken),
    };
  }

  /**
   * Persist the dashboard access token (encrypted). Undefined leaves it
   * unchanged; an empty string clears it (the feed then has no token).
   *
   * Saving a DIFFERENT token is a RECONNECT: it invalidates the seeded working
   * connection (igUserId + the refreshed token + last-sync state) so the next
   * sync re-seeds from the new token and re-resolves the account/handle. It is
   * one atomic upsert because both the credential and the connection live on
   * this singleton row - a stale igUserId paired with a fresh token would
   * otherwise read the wrong account's media.
   *
   * Re-submitting the token ALREADY stored is not a reconnect, it is a no-op.
   * The dashboard's token input is write-only and can re-send an unchanged value
   * (a browser/password-manager autofill, or a form whose dirty state outlived
   * the save); treating that as a reconnect silently tore down a working feed -
   * the panel fell back to "Last sync: Never / Token expires: Unknown" and the
   * next sync had to re-resolve the account through the Graph API.
   */
  async saveCredentials(dto: SaveInstagramCredentials): Promise<void> {
    if (dto.accessToken === undefined) return;
    const next = dto.accessToken.trim();

    // Read-then-write, deliberately not in a transaction: two concurrent saves
    // could both decide off the same read, and the worst case is one redundant
    // reconnect on a singleton row only an admin can write. A transaction would
    // not fix it either without SELECT FOR UPDATE.
    const existing = await this.prisma.instagramAccount.findUnique({
      where: { id: ACCOUNT_ID },
      select: { configAccessToken: true },
    });
    const current = safeDecrypt(existing?.configAccessToken) ?? '';
    // Only an exact re-submit of the CURRENT non-empty token short-circuits.
    // Every real change - including '' (falsy, so it never gets here) - falls
    // through to the full reconnect below, so a fresh token can never end up
    // paired with the previous account's igUserId.
    if (next && secretEquals(next, current)) return;

    const configAccessToken = next ? encrypt(next) : null;
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
