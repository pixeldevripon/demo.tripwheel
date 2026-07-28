---
name: project_instagram_autosync_security
description: Security review of the Instagram OAuth auto-sync feature (connect/sync/token-storage) — clean audit, only low/informational findings
type: project
---

Reviewed 2026-07-28: `backend/src/instagram/**` (providers, config, oauth-state util, token
service, connect service, sync service, scheduler, controller, DTOs). This is the OAuth +
encrypted-token-storage feature that mirrors the brand Instagram account into Cloudinary-hosted
tiles for the public grid.

**No critical or high findings.** The token-handling path is sound:
- `instagram-token.service.ts` encrypts with AES-256-GCM (`crypto.util`, `ENCRYPTION_KEY`) before
  every write, decrypts only inside `readCredential()` (internal-only, never called from a
  controller), and `safeDecrypt` degrades to `null` (forces reconnect) rather than throwing on a
  rotated key.
- The token never appears in a response DTO (`InstagramConnectionResponseDto`,
  `InstagramConnection` interface) or a log line — `instagram-graph.provider.ts`'s `parse()`
  logs only `res.status` + `safeHost(url)`, deliberately never the body (which could echo the
  code/token back).
- `instagram-oauth-state.util.ts`: HMAC-SHA256 keyed on `BETTER_AUTH_SECRET`, `timingSafeEqual`
  for the signature compare, explicit expiry check. Sound CSRF state.
- All mutating endpoints (`oauth/callback`, `disconnect`, `sync`, `posts/*` writes,
  `account` PUT) require `Permission.MANAGE_SETTINGS`; reads require `VIEW_SETTINGS`; only
  `GET public/feed` is `@Public()` and its Prisma `select` never touches `accessToken`. Static
  route `posts/reorder` correctly precedes `posts/:id`.
- Public feed / demo provider have zero attacker-reachable input into
  `CloudinaryService.uploadFromUrl()` — `media_url`/`thumbnail_url` only ever come from Meta's
  Graph API response (via our own OAuth token) or hardcoded demo constants.

**Low/informational findings only (see full review for detail, not separately tracked as bugs):**
1. `env.validate.ts` `INSTAGRAM_APP_ID` OPTIONAL validator is `/^\d+$/` only — rejects the
   documented demo sentinel (`INSTAGRAM_APP_ID=demo`), so demo mode as documented in
   `instagram-config.service.ts` crashes `validateEnv()` at boot. Config/functional bug, not
   itself a vulnerability, but worth fixing before anyone relies on the demo path in a fresh env.
2. OAuth `state` isn't bound to the issuing admin/session — replayable by any other
   `MANAGE_SETTINGS` holder within the 10-minute TTL. Not exploitable beyond the existing
   privilege level (minting a state already requires `MANAGE_SETTINGS`), so accepted as-is.
3. `instagram-sync.service.ts` `reconcile()`'s "gone" cleanup loop (delete + Cloudinary
   `cleanupMirror`) has no per-row try/catch and sits outside `syncNow()`'s own try/catch — one
   bad Cloudinary delete aborts the rest of the loop and skips `recordSyncResult`. Resilience gap,
   not a security hole (no error detail leaks to the client — `AllExceptionsFilter` collapses any
   non-`HttpException` to a generic "Internal server error").
4. No host/scheme allow-list before `uploadFromUrl(item.mediaUrl)` — fine today since the URL is
   Meta-API-sourced only, but would become a real SSRF vector if a future feature ever let an
   admin (or worse, an operator) supply the media URL directly.

**Confirmed secure pattern worth reusing:** `AllExceptionsFilter` (`src/common/filters/http-exception.filter.ts`)
collapses any non-`HttpException` to a generic 500 message client-side while still logging the
real stack server-side — verified this actually prevents leakage even when a raw `Error` (e.g. a
Cloudinary failure) propagates uncaught from a service.
