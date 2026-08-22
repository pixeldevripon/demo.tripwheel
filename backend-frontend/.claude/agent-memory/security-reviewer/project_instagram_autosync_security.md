---
name: project_instagram_autosync_security
description: Security review of the Instagram auto-sync feature (DB-only long-lived token, masking, sync) — clean audits across two passes, only low/informational findings
type: project
---

**Superseded design note:** an earlier pass on 2026-07-28 reviewed an OAuth-based connect flow
(`instagram-oauth-state.util.ts`, an `oauth/callback` endpoint, App ID/Secret/Redirect). That flow
no longer exists in the codebase (no `*oauth*` files under `backend/src/instagram/`) — the feature
was redesigned to a single DB-only long-lived access token pasted by an admin into the dashboard
(`instagram-config.service.ts`: "There is no OAuth, App ID/Secret or Redirect — the token IS the
credential"). Do not reuse the OAuth-specific findings from that pass (state/CSRF, callback
handling); they no longer apply. Below is the current shipped model, reviewed again same day after
the masking + no-op changes landed.

**No critical or high findings in either pass.** Current architecture:
- `InstagramConfigService` (`backend/src/instagram/instagram-config.service.ts`) is the sole
  read/write path for the token: AES-256-GCM via `crypto.util` (`encrypt`/`safeDecrypt`), stored on
  the singleton `InstagramAccount` row (`configAccessToken`), no env fallback (confirmed by
  `env.validate.ts` comment + `.env.example` + a unit test that sets
  `INSTAGRAM_ACCESS_TOKEN` and asserts it's ignored).
- `getCredentialStatus()` now returns `maskedAccessToken` (bullets + last 4 chars) alongside the
  existing booleans, deliberately mirroring `SettingsService.maskSecret()` (Stripe/Mollie/Mailchimp
  pattern in `backend/src/settings/settings.service.ts:29-32`). Confirmed **not** an escalation:
  `VIEW_SETTINGS`/`MANAGE_SETTINGS` are ADMIN-only in `backend/src/config/roles.config.ts`
  (lines ~108-109) — absent from EDITOR/STAFF/GUIDE/TOUR_OPERATOR/USER blocks, and absent from the
  staff effective-permission module too (grepped, zero hits) — so there is no ceiling-bypass path
  a lower seat could ride to reach this. A trailing 4 chars of an opaque `IGAA...`-prefixed
  long-lived Graph token carries no brute-force/correlation value beyond what an already-admin
  operator already has (the "IGAA" prefix itself is public Meta convention, not secret).
- Public projections stay clean: `InstagramService.getPublicFeed()` and
  `SettingsService.getPublicSiteInfo()` both use explicit Prisma `select` blocks that never touch
  `configAccessToken`/credential fields; `maskedAccessToken` is only reachable through
  `getCredentialStatus()`, itself only wired to the two admin-gated `/instagram/credentials`
  routes. No logger line anywhere in `backend/src/instagram/*.ts` prints a decrypted token or the
  masked value.
- `saveCredentials()`'s no-op guard (`if (next && next === current) return;`) only short-circuits
  on an exact resubmit of the *current, non-empty* plaintext. Every real change — including
  clearing to `''` — always runs the full upsert that nulls `igUserId`/`accessToken`/
  `tokenExpiresAt`/`lastSyncedAt`/`lastSyncStatus`/`lastSyncError`, so a stale `igUserId` can never
  end up paired with a token for a different account. Test suite
  (`instagram-config.service.spec.ts`) explicitly covers same-token no-op, different-token
  reconnect, and empty-string-always-clears.
- Dashboard (`tripwheel-x-islandtours-dashboard/components/settings/instagram-form.tsx`): token
  `SecretField` uses `autoComplete="off"` on purpose (comment explains: `"new-password"` would
  invite password-manager autofill into an API-credential field), always resets to `''` after
  every save/reset, and no react-query persister to localStorage exists anywhere in that dashboard
  repo (grepped for `persistQueryClient`/`createSyncStoragePersister`/`localStorage` — zero hits).
- Migration `20260728160000_site_info_enable_instagram_not_null` (backfill NULL→true, then
  `SET NOT NULL DEFAULT true`) is safe and idempotent — re-running is a no-op either step.

**Low/informational only:**
1. `saveCredentials()`'s stored-token comparison (`instagram-config.service.ts`) uses plain `===`,
   not `crypto.timingSafeEqual`. Real-world exploitability is minimal: reaching this endpoint
   already requires `MANAGE_SETTINGS` (the same principal can already read the mask and overwrite
   the token outright), so this is hygiene, not a live hole.
2. Read-then-upsert in `saveCredentials()` isn't wrapped in one Prisma transaction — two concurrent
   admin `PATCH /credentials` calls could race. Acceptable for a singleton settings row
   (last-write-wins), not a data-integrity bug.
3. `backend/.env` (gitignored, untracked — confirmed via `git ls-files`) has a real
   `INSTAGRAM_ACCESS_TOKEN` value sitting dead in it; nothing reads it (DB-only by design). Local
   hygiene recommendation only: remove it and rotate that token, since a real secret in a file is
   attack surface even when unreferenced by code.
4. `instagram.swagger.ts`'s `ApiGetInstagramCredentialsDocs` description still says "...and whether
   it is coming from the env fallback" — stale wording predating the DB-only redesign (no such
   field exists). Doc drift only, not in the reviewed diff's changed-files list.

**Confirmed secure pattern worth reusing:** masking format `'••••••••' + plaintext.slice(-4)` is
now used identically in three places (`SettingsService.maskSecret`,
`InstagramConfigService`'s local `maskToken`, and the historical Stripe/Mollie inline masking) —
a good template for any future secret-bearing settings field: mask at the service boundary, never
in the DTO/controller, and null out the mask (not the boolean) when ciphertext fails to decrypt so
"stored but unreadable after a key rotation" stays distinguishable from "never set."
