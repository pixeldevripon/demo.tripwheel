---
name: google_ads_retraction_phase3c_review
description: Review of feat/tracking-cancel-correction-meta uncommitted changes (Phase 3c, Google Ads cancellation retraction) - 2026-08-17
type: project
---

Reviewed uncommitted diff on `feat/tracking-cancel-correction-meta` (branch name is stale - this
wave is actually Phase 3c, Google Ads; Phase 3.1/Meta was the prior wave, see
`cancellation_correction_meta_wave_review.md`). Scope: new `google-ads.service.ts` +
`conversion-audit.service.ts` (audit writer extracted from `TrackingService`, + `alreadySent`
replay pre-check), `bookings.service.ts` `runAdsAdjustmentJob`, queue/relay/processor wiring,
`settings.prisma` + migration (7 Google Ads columns), `settings.service.ts`/`dto` mask+encrypt,
env.validate + both `.env` examples. Verified with `npx tsc --noEmit` (clean), `npx prisma
validate` (clean), and targeted `jest` runs (58/58 tracking+workers, 5/5 new bookings tests) -
not just read-through.

**No critical findings. Two confirmed Major findings, both fixable in isolation:**

1. **OAuth token-cache stampede** (`google-ads.service.ts` `getAccessToken`, ~142-173): no
   request-coalescing on `cachedToken`. `PlatformJobsProcessor` runs `{ concurrency: 5 }` and
   `GoogleAdsService` is a singleton, so N concurrently-processed `ADS_ADJUSTMENT` jobs with a
   cold/expired cache each independently POST to Google's OAuth endpoint. Not a correctness bug
   (refresh-token grants are stateless/multi-use, each job still gets a valid token) but a real,
   confirmed race exactly where the reviewer was asked to check ("races?") - and the trigger
   scenario (many cancellations maturing at the same T+24h `ADS_ADJUSTMENT_DELAY_MS` after a
   batch-cancel event) is realistic. Fix: memoize the in-flight refresh promise (`pendingToken:
   Promise<string> | null`, cleared in `.finally()`), not just the resolved token.
2. **DRY: DB-first/env-fallback field resolution repeated 7x** in `GoogleAdsService.resolveConfig`
   and 3x in `TrackingService.resolveMetaConfig` (`dbValue?.trim() || process.env.X?.trim()`
   per field) - confirmed, quantifiable, and now duplicated ACROSS two platform services with zero
   extraction despite the prior wave's memory note explicitly flagging this as "good template for
   the next CAPI event type." A third platform (GA4/TikTok) will make this three copies. A small
   `resolveField(dbValue, envVar)` helper (natural home: `crypto.util.ts`, next to
   `safeDecrypt`/`maskSecret` which already carry the "belongs to the secret, not the module"
   philosophy) collapses both call sites to one-liners. Worth doing project-wide before the next
   platform ships, not blocking today.

**Design intent verified correct (all four points the task asked to check):**
- Throws deliberately (UnrecoverableError 401/403, plain Error otherwise) - confirmed opposite of
  `TrackingService`'s swallow-everything contract, and correct given retractions run ONLY as
  queued jobs.
- Every exit path in `uploadRetraction` after `cfg` resolves records EXACTLY one audit row -
  walked all 6 paths (cfg-null no-op has none, by design, matching Meta's same unconfigured
  no-audit-row precedent) and confirmed no double-write, no missed write.
- Replay safety is layered correctly: `alreadySent` pre-check lives in `bookings.service.ts`
  (NOT inside `google-ads.service.ts` - the service itself has no pre-check), and the
  ALREADY_RETRACTED-as-success absorption in the service covers the race the pre-check cannot
  (two jobs passing the pre-check concurrently). Both are tested.
- Money rule (`runAdsAdjustmentJob`) matches spec exactly: retract on FULL, retract-conservatively
  + warn on PARTIAL (never produced today), skip on NONE. Verified `cancellationRefund` can be
  DB-nullable (`CancellationRefund?` in `bookings.prisma`) but is PROVABLY non-null whenever this
  job's outbox event exists - `cancel()` sets `cancellationRefund` and creates the
  `booking.cancelled` outbox row in the SAME `$transaction` write (bookings.service.ts
  ~3478-3517), so the theoretical "null falls through to retract" path is unreachable. Worth
  re-verifying if `cancel()`'s transaction is ever restructured.

**Minor:**
- No test exercises the Stage-2 transport-exception catch in `uploadRetraction` (a rejected
  `fetch()` promise on the UPLOAD call, as opposed to a resolved-but-bad-status response) - every
  spec test resolves with `ok:false`/a body, none reject the promise itself. Small gap given the
  design intent's explicit "every exit path is audited" claim.
- Migration (`20260817110000_google_ads_credentials`) is a byte-exact match for the
  `settings.prisma` diff (columns, nullability, defaults) - confirmed, not just assumed.
- Secret mask/encrypt symmetry with `metaCapiToken`/`translationApiKey` confirmed exact for all 3
  new secrets (`googleAdsDeveloperToken`/`ClientSecret`/`RefreshToken`) on both GET and
  update-response paths; no plaintext-ciphertext leak path found (only other reader of
  `integrationsConfiguration` is `translation-config.service.ts`, unrelated fields).

**Positive pattern confirmed:** `ConversionAuditService` extraction is clean - `TrackingService`
now delegates via a 1-line `recordEvent`, and in the same move fixed the prior wave's minor nit
(bare `'META'` string literal is now `ConversionPlatform.META`). `bookings.module.ts` already
imported `TrackingModule`, which now also exports `GoogleAdsService`/`ConversionAuditService` -
DI wiring required zero new module edits in `bookings.module.ts` itself.
