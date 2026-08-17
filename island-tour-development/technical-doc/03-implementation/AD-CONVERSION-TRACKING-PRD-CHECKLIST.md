# Server-Side Ad Conversion Tracking - PRD audit, checklist & implementation plan

> **PRD:** `technical-doc/Island Tours — Server-Side Ad Conversion Tracking PRD.md` (Rezina,
> 2026-08-16). **Architecture:** `02-architecture/TRACKING-AND-ANALYTICS.md` (master §8).
> **Container recipe:** `03-implementation/GTM-CONTAINER-SETUP.md`.
> **This doc:** every PRD requirement cross-checked against the actual code on **2026-08-17**,
> split into DONE / NOT DONE, with a where-and-how plan for everything open.

---

## 0. TL;DR scoreboard

| PRD requirement | Status | One-liner |
| --- | --- | --- |
| Click-ID capture at landing (gclid/gbraid/wbraid/fbclid + UTMs, first-party cookie) | ✅ BUILT | `it.attribution` cookie, 90 days, last-click wins per param |
| Click IDs + UTMs persisted on the booking record | ✅ BUILT | 9 columns on `Booking`, write-once at reserve |
| Fire on transition to CONFIRMED | ✅ BUILT | single choke point `finalizeConfirmation`, all 3 confirm paths |
| Conversion value = server-resolved `commission_amount`, never GMV | ✅ BUILT | rule #22; null commission = corruption, no fire |
| EUR normalization + documented rounding | ✅ BUILT | HALF_UP 2dp, PSP charge-rate re-anchoring, FX audit columns |
| Atomic mark-fired dedup guard | ✅ BUILT | `conversionFiredAt` (server) + `conversionPushedAt` (browser), guarded `updateMany` in tx |
| Meta CAPI server-side, parallel to Pixel, shared transaction id | ✅ BUILT | queued `tracking.capi-conversion` job, `event_id = publicRef` |
| Enhanced Conversions hashed PII (email, E.164 phone, name, address) | ✅ BUILT (code) | one SHA-256 pass server-side; envelope emitted in the dataLayer push |
| Consent Mode v2 region-aware defaults + Cookiebot | ✅ BUILT | EEA+UK denied default, inline before gtm.js; CBID dashboard-managed |
| GTM container 4-tag fan-out (Conversion Linker / Ads / GA4 / Pixel) | 🟡 CONFIG ONLY | code side done; container work blocked on stakeholder IDs |
| Click IDs / booking_ref / operator / island / user_id **inside** the dataLayer payload | ✅ BUILT 2026-08-17 | Phase 2 shipped: full §8.3 payload + typed `BookingCompleteEvent` CI contract |
| Cancellation correction: Google Ads negative adjustments | ❌ NOT BUILT | zero Google Ads API code; gclid stored but never read |
| Cancellation correction: Meta refund events | ❌ NOT BUILT | no cancel-side CAPI event, no `booking.cancelled` outbox event |
| No-show correction | ❌ BLOCKED | no no-show state exists anywhere in the schema (documented skip) |
| Paid vs affiliate/organic separation at the data-model level | 🟡 PARTIAL | `affiliateId` column exists and is separate from UTMs, but nothing writes it (Trackdesk not integrated) |
| Google Ads developer token request | ❌ NOT STARTED | external, stakeholder approval needed day one |
| QA across card / deposit / pay-on-arrival + test cancellation | ❌ NOT RUN | §8.4 Definition-of-Done checks pending container config |
| Recorded walkthrough + written event reference | ❌ NOT DONE | reference doc should live in this folder (Phase 6 below) |
| 14-day post-launch monitoring | ❌ NOT STARTED | needs the failed-job visibility already present in Bull Board |

Bottom line: **the platform-code half of the PRD is ~80% built and live** (attribution capture,
commission-EUR value, dedup guards, Meta CAPI, consent). The genuinely missing engineering is the
**post-conversion correction pipeline** (Google Ads adjustments + Meta refund events + a no-show
concept), the **payload completion** on the TYP push, and everything **external** (GTM container
config, ad-platform access, developer token, QA, walkthrough, monitoring).

---

## 1. ALREADY IMPLEMENTED - verified against code

### 1.1 Event capture and attribution

- [x] **Click IDs + UTMs captured at landing into a first-party cookie.**
  `frontend/lib/tracking/attribution.ts` - cookie `it.attribution`, max-age 90 days,
  captures `gclid`/`gbraid`/`wbraid`/`fbclid` (512-char cap) + `utm_source/medium/campaign/term/content`
  (255-char cap), merges over the existing cookie so last click wins per param while older params
  survive. Mounted site-wide via `components/frontend/attribution-capture.tsx` in
  `app/(frontend)/layout.tsx:81`.
- [x] **Attribution written through to the booking record at creation.**
  `AttributionDto` (`backend/src/bookings/dto/booking.dto.ts:1337`) nested on `ReserveBookingDto`;
  persisted in `BookingsService.reserve()` at `bookings.service.ts:707-715`; columns at
  `prisma/bookings.prisma:122-130`. **Write-once**: the idempotent re-reserve early-return never
  overwrites the original click IDs, so attribution survives multi-session journeys (PRD metric
  "attribution completeness").
  Frontend sends it in `lib/checkout/reserve-and-pay.ts:134-136` (`attribution: readAttribution()`),
  covered by tests in `reserve-and-pay.test.ts`.
- [x] **Paid vs affiliate separation exists at the data-model level.**
  `affiliateId` (`bookings.prisma:131`, reserved for Trackdesk) is a separate column from the
  `utm_*`/click-id block, and `couponCode` (`bookings.prisma:82`) is separate again. *Caveat: see
  §2.6 - no write path populates `affiliateId` yet.*

### 1.2 Conversion firing

- [x] **One conversion per booking, fired on the CONFIRMED transition.** All three confirm paths
  funnel into the single private method `finalizeConfirmation` (`bookings.service.ts:1289`):
  1. Stripe/Mollie webhook + TYP settle-on-return -> `confirmFromPayment` (`bookings.service.ts:1089`,
     called from `payments.service.ts:717` (Stripe) and `:899` (Mollie))
  2. OCTO `confirm` endpoint (`bookings.service.ts:1006` -> `:1073`)
  3. `operator_full` instant confirm at reserve commit (`bookings.service.ts:843-846`) - no charge,
     no webhook, conversion still fires (rule #21 / master EC-05)
- [x] **Value = server-resolved `commission_amount`, never the tour price.**
  Computed at reserve in `booking-pricing.util.ts:293-299` (commission on the EUR tour value,
  extras excluded), stored `bookings.prisma:76` ("EUR-normalized conversion value; null = corruption").
  A confirmed booking with null commission logs `conversion NOT fired (data corruption)` and fires
  nothing (`bookings.service.ts:1397-1401`); the queued CAPI job throws `UnrecoverableError`
  (`bookings.service.ts:1583`) so it fails loudly instead of retrying.
- [x] **EUR normalization with a consistent, documented rounding policy.**
  `Decimal` math only, HALF_UP to 2dp for money legs (`common/utils/fx.util.ts`,
  `FX-AND-MULTI-CURRENCY.md`). At confirmation the PSP's actual charge rate replaces the reserve-time
  ECB snapshot (`finalizeConfirmation`, `bookings.service.ts:1300-1342`) - only the EUR value
  re-anchors, the commission *rate* stays the reserve snapshot. Full FX audit trail:
  `fxRateToEur`, `totalEur`, `eurFxProvider`, `eurFxProviderAsOf` (`bookings.prisma:86-100`).
  This directly satisfies the PRD "currency consistency" metric: every platform receives the same
  single EUR number.
- [x] **Trigger tied to the TYP URL + confirmed state.**
  TYP `/{destination}/thank-you/{publicRef}` (locale-less via `frontend/proxy.ts:102-106`, noindex).
  The browser push is claimed via `POST /bookings/typ/:publicRef/conversion`
  (`bookings.controller.ts:434-442`, traveler-session gated, throttled), which only returns a
  conversion object for CONFIRMED bookings with a non-null EUR commission
  (`bookings.service.ts:5797-5862`, payload builder `:5872-5908`).

### 1.3 De-duplication

- [x] **Shared transaction ID across browser and server.** `event_id = bookings.publicRef` in both
  the dataLayer push (`frontend/lib/tracking/booking-complete.ts:55-77`) and the server CAPI body
  (`tracking.service.ts:120`). The GTM Ads tag also reuses it as Transaction ID (Ads-side dedup).
- [x] **Atomic server-side mark-fired guard.** Two deliberate guards:
  - `conversionFiredAt` - server fire (CAPI + email), claimed via guarded
    `updateMany({ where: { conversionFiredAt: null } })` inside a transaction that also commits the
    `booking.confirmed` OutboxEvent (`bookings.service.ts:1344-1382`), so a conversion can never be
    lost between commit and enqueue, and concurrent webhook/settle racers collapse to one winner.
  - `conversionPushedAt` - browser push claim, mark-first (`bookings.service.ts:5855-5859`); a TYP
    refresh, email revisit, or shared link gets `{ conversion: null }`. Never `localStorage`.
- [x] **Meta CAPI fires in parallel with the (future) browser Pixel, dedup-ready.**
  `TrackingService.fireBookingComplete` (`src/tracking/tracking.service.ts:80`) posts
  `Purchase` to `graph.facebook.com/v19.0/{pixelId}/events`; runs as the queued idempotent
  `tracking.capi-conversion` job (`workers/platform-queue.ts:17`, processor
  `platform-jobs.processor.ts:80-81`) fed by the transactional-outbox relay
  (`workers/outbox-relay.service.ts`), 5 attempts exponential backoff, failures retained
  (`removeOnFail: 5000`) and visible.

### 1.4 Consent and match quality

- [x] **Server-side SHA-256 PII hashing, one pass for Google and Meta.**
  `src/tracking/pii-hash.util.ts` - email (trim+lowercase), phone E.164 via `libphonenumber-js`,
  split first/last name (checkout collects them split, B.50), city/postal/country.
  `toGoogleUserData` -> Enhanced Conversions `sha256_*` envelope (emitted to the browser via the
  conversion payload, `bookings.service.ts:5888`); `toMetaUserData` -> CAPI `em/ph/fn/ln/ct/zp/country`.
- [x] **Consent Mode v2 with region-aware defaults, against Cookiebot.**
  `frontend/components/frontend/tracking/google-tag-manager.tsx` - EEA (EU27+IS/LI/NO) + UK denied
  on all four signals, everywhere else granted, `wait_for_update: 500`, `ads_data_redaction: true`,
  set **inline in the same script before gtm.js** so ordering is guaranteed. Cookiebot loads in
  `app/(frontend)/layout.tsx:66-74` (`data-blockingmode="auto"`, CBID dashboard-managed with
  `NEXT_PUBLIC_COOKIEBOT_CBID` dev fallback). `/manage-cookies` page hosts `Cookiebot.renew()`.
  PRD non-goal respected: Cookiebot is configured against, not replaced.

### 1.5 Supporting infrastructure

- [x] **All tracking IDs dashboard-managed, secrets encrypted.** `SiteSEO`
  (`prisma/settings.prisma:73-77`): `googleTagManagerId`, `googleAnalyticsId`, `facebookPixelId`,
  `cookiebotCbid`. `IntegrationsConfiguration` (`settings.prisma:218-219`): `metaCapiToken`
  (encrypted, masked on read), `metaCapiTestCode`. Env fallbacks exist (`env.validate.ts:197-199`),
  DB wins.
- [x] **Prod-only master switch.** `NEXT_PUBLIC_ENABLE_TRACKING === 'true'` gates the GTM loader and
  the conversion push; staging builds must not set it.
- [x] **Custom-scripts surface** for any extra vendor snippet (Hotjar etc.):
  `src/custom-scripts/` + `components/frontend/tracking/custom-scripts.tsx`, allowlisted, mounted in
  the root layout head + bodyEnd. GTM/GA4/Pixel/Cookiebot deliberately do NOT go here - they have
  first-class SiteSEO fields.
- [x] **Webhook idempotency** (`stripe_webhook_events` ledger; Mollie fetch-and-reconcile) and the
  `/payment/processing` page carries **zero tags** - conversions only ever fire from the confirmed
  state.

---

## 2. NOT IMPLEMENTED - the gap list

### 2.1 GTM container 4-tag fan-out - CONFIGURATION, not code ~ blocked on IDs

The dataLayer push, consent defaults, and CAPI dedup contract all ship in code; the container that
consumes them is empty. Follow `GTM-CONTAINER-SETUP.md` verbatim: 7 Data Layer Variables, one
`booking_complete` trigger, 4 tags (Conversion Linker, **dynamic-value Google Ads conversion action**
with Enhanced Conversions from `{{dlv - user_data}}`, GA4 `purchase`, Meta Pixel **with
`eventID = {{dlv - event_id}}`** - without it every booking double-counts against CAPI).
Blocked on: GTM container ID, GA4 `G-` ID, Google Ads Conversion ID + Label, Meta Pixel ID.

### 2.2 dataLayer payload is missing spec'd fields - ✅ RESOLVED 2026-08-17 (Phase 2 shipped)

`TRACKING-AND-ANALYTICS.md` §3 requires `click_ids.{gclid,gbraid,wbraid,fbclid}`, `booking_ref`
(display_ref), `operator_id`/`operator_name`, `island`, `user_id`, and `item_brand`/`item_category`
in `items[]`. All shipped: `buildConversionPayload` + `BookingConversionDto` extended on the
backend, `TypConversion` + the typed `BookingCompleteEvent` contract on the frontend
(`lib/tracking/booking-complete.ts`), with `click_ids`/`user_id`/`user_data` omitted (not null)
when absent. The CI type-check items (MASTER-CHECKLIST :426/:1082) and the GA4 `user_id`
hashed-email item (:427) closed with it.

### 2.3 Cancellation correction pipeline - the PRD's headline gap

- **No Google Ads integration exists at all.** Zero matches for any Google Ads API surface in
  `backend/src`. `gclid`/`gbraid`/`wbraid` are captured, stored - and never read by any code path.
- **No Meta refund/cancel event.** `TrackingService` only knows `fireBookingComplete`.
- **No `booking.cancelled` outbox event.** `cancel()` (`bookings.service.ts:3205`) emits only
  `booking.refund-owed` (money retry, and only on FULL refunds) - a tracking dispatcher has nothing
  to subscribe to.
- **No adjustment mark/audit.** Nothing records that a correction was sent; there is no
  `conversionAdjustedAt` guard and no conversion log table (CAPI failures today are logged and
  swallowed, `tracking.service.ts:149-161`).
- **Settlement reversal already works** (`reverseSettlement`, `bookings.service.ts:2017-2040` +
  nightly sweep) - the money side reverses, the marketing side doesn't hear about it.

### 2.4 No-show correction - blocked on schema + product decision

`BookingStatus` (`prisma/enums.prisma:406-414`) = `ON_HOLD | CONFIRMED | EXPIRED | CANCELLED |
REDEEMED | PENDING | REJECTED` - **no no-show state**, and the gap is already documented in code
(`mail/next-adventure-emails.service.ts:347-348`: "nothing in the schema marks a no-show today").
A no-show adjustment cannot be built until an operator-reported no-show exists.

### 2.5 Google Ads server-side credentials + developer token

`IntegrationsConfiguration` has no Google Ads fields (developer token, customer ID, conversion
action, OAuth refresh token), `env.validate.ts` has no `GOOGLE_ADS_*` vars, and the developer-token
request (external, 2-3 business days) has not been submitted. The PRD wants it submitted on day one
because only the adjustment stage depends on it.

### 2.6 Affiliate/channel separation is model-only

`affiliateId` exists but no code writes it (Trackdesk not integrated), and nothing in GA4/GTM
distinguishes paid vs affiliate vs organic yet. The PRD only requires that they be *separable with
no shared-attribution overlap* - the model satisfies that today; reporting-side channel definitions
land with the container work.

### 2.7 Smaller open items already tracked in MASTER-CHECKLIST

- [x] CI type-check of the `booking_complete` payload contract (missing required field = build
  error, not runtime fallback) - DONE 2026-08-17 (typed `BookingCompleteEvent`, composition
  compile-checked; `tsc` runs in CI).
- [ ] TYP error render (no conversion) when a confirmed booking has null `commission_amount` -
  MASTER-CHECKLIST :888 (backend guard exists; the TYP currently renders normally).
- [x] `user_id` for GA4 cross-device from the hashed email - DONE 2026-08-17 (derived in
  `buildConversionPayload` from the same email hash; `Booking.customerId` column stays reserved).
- [ ] `eurFxRate()` treats every non-EUR currency as USD (`fx.util.ts:26`) - fine for the EUR/USD
  launch pair, but add a guard before any third currency ships, because this number is the
  conversion value ad platforms optimize on.

### 2.8 QA, verification, deliverables (PRD milestones 4-6)

- [ ] §8.4 Definition of Done run: Tag Assistant clean, exactly one GA4 `purchase` per test booking,
  one deduplicated Meta `Purchase`, Enhanced Conversions match rate >60%, EEA-VPN consent check.
- [ ] QA across card / deposit / pay-on-arrival / `operator_full` flows + a proven test cancellation
  with a visible negative adjustment.
- [ ] Recorded walkthrough (Google Ads, Meta, GA4 event verification).
- [ ] Written event reference kept alongside the codebase (Phase 6 creates it).
- [ ] 14-day post-launch monitoring window.

---

## 3. IMPLEMENTATION PLAN - where and how

Order matters: Phases 0-1 are external/config and unblock nothing in code; Phase 2 is a small,
independent code change; Phase 3 is the real build; 4-6 close out the PRD.

### Phase 0 - Access + credentials (day 1, mostly stakeholder)

1. Stakeholder grants: GTM admin, Google Ads admin, GA4 editor/admin, Meta Business Manager
   (Pixel + system user). Timeline starts here per the PRD.
2. **Submit the Google Ads developer token request immediately** (Google Ads -> Tools -> API Center).
   2-3 business days external; only Phase 3c blocks on it.
3. Enter existing IDs in the dashboard: Settings -> SEO & Tracking (`googleTagManagerId`,
   `facebookPixelId`, `cookiebotCbid`) and Settings -> Integrations (`metaCapiToken`,
   `metaCapiTestCode`). GA4 `G-` ID and Ads Conversion ID/Label go inside the GTM container, not
   the dashboard.
4. Set `NEXT_PUBLIC_ENABLE_TRACKING=true` on the production frontend deploy only.

### Phase 1 - GTM container configuration (no code)

Follow `GTM-CONTAINER-SETUP.md` end to end. Non-negotiables: Meta tag passes
`eventID = {{dlv - event_id}}`; Ads tag uses `{{dlv - event_id}}` as Transaction ID and Enhanced
Conversions from `{{dlv - user_data}}` (values are pre-hashed - Google accepts that); consent
overview enabled and each tag's built-in consent checks verified. This alone completes the PRD's
"Google Ads setup" and half of "Meta CAPI and deduplication" milestones.

### Phase 2 - Complete the `booking_complete` payload - ✅ SHIPPED 2026-08-17

**Backend (source of truth for the payload):**

- `backend/src/bookings/bookings.service.ts` -> `buildConversionPayload` (:5872-5908): add
  `bookingRef` (= `displayRef`), `clickIds: { gclid, gbraid, wbraid, fbclid }`, `operatorId`,
  `operatorName`, `island`, `userId` (= the already-stored hashed-email `customerId`,
  `bookings.prisma:142`), and enrich `items[]` with `item_brand` (operator name) and
  `item_category` (primary category).
- `backend/src/bookings/dto/booking.dto.ts` -> extend `BookingConversionDto` (:132-159) with the
  same fields (`@ApiProperty` per repo DTO conventions).
- The booking select feeding the payload already loads tour + operator relations for the TYP; add
  any missing `select:` fields there rather than a second query.
**Frontend (pass-through):**

- `frontend/lib/api/public/bookings.ts` - extend the conversion types (`ConversionUserData` block,
  ~:20-37) to mirror the DTO.
- `frontend/lib/tracking/booking-complete.ts` (:46-78) - push the new fields:
  `booking_ref`, `click_ids`, `operator_id`, `operator_name`, `island`, `user_id`.
**Contract check (closes MASTER-CHECKLIST :426/:1082):** make the required fields non-optional in a
single shared payload type on each side so `tsc` (already in CI) fails the build when a required
field goes missing - the "CI type-check" the spec asks for, no new tooling needed.
**GTM follow-up:** add matching Data Layer Variables only if/when a tag consumes them.
**Do NOT** rename `event_id` to `transaction_id` - the container maps it; renaming breaks the
CAPI dedup contract.

### Phase 3 - Post-conversion correction pipeline (the main build)

#### 3a. Emit a `booking.cancelled` domain event (backend)

- `backend/src/bookings/bookings.service.ts` -> inside the existing `cancel()` transaction
  (:3281-3330), create an `OutboxEvent` `type: 'booking.cancelled'` **only when
  `conversionFiredAt != null`** (nothing was reported for never-confirmed bookings, so there is
  nothing to retract). Payload: `bookingId`, `publicRef`, `cancelledAt`, `refund` kind.
  Same-transaction outbox write mirrors the proven `booking.confirmed` pattern (:1364-1378).
- EXPIRED/REJECTED bookings never fired a conversion - no event needed there.

#### 3b. Adjustment guard + conversion audit trail (backend, prerequisite for 3c/3d)

- `backend/prisma/bookings.prisma`: add `conversionAdjustedAt DateTime?` next to
  `conversionFiredAt`/`conversionPushedAt` (:143-144) - the same mark-first idempotency pattern,
  claimed with a guarded `updateMany` before enqueueing adjustment jobs.
- Recommended (fixes "no audit trail", and the PRD's verifiability metric): a small
  `ConversionEvent` model in a new `prisma/tracking.prisma` -
  `id, bookingId, platform (META|GOOGLE_ADS|GA4), kind (CONVERSION|ADJUSTMENT|REFUND), eventId,
  valueEur, status (SENT|FAILED), response Json?, createdAt`. Write one row per send from
  `TrackingService` (today failures are logged and swallowed - `tracking.service.ts:149-161`).
  An adjustment must reference what the original fire sent; this table is where it looks.

#### 3c. Google Ads conversion adjustments (new backend service)

- **Where:** extend `backend/src/tracking/` with `google-ads.service.ts` (keep the module pattern:
  service + spec; registered in `tracking.module.ts`). Do not create a parallel module - the seam
  is TrackingService's.
- **How:** call the Google Ads API `ConversionAdjustmentUploadService.uploadConversionAdjustments`
  with `adjustment_type: RETRACTION`, identifying the conversion by
  **`order_id = publicRef`** + the conversion action resource name - this matches the Transaction ID
  the GTM Ads tag sends, so no gclid round-trip is needed for retraction (gclid-based identification
  is the fallback; we store it either way). Restatement (value change) uses the same call with
  `adjustment_type: RESTATEMENT` if partial refunds ever need it. Use the `google-ads-api` npm
  client (Opteo) or plain REST against the current API version - pin the version at build time, and
  fetch current docs then (the API majors churn ~2x/year).
- **Credentials (follow the 3-file env rule + dashboard-first pattern):**
  - `prisma/settings.prisma` -> `IntegrationsConfiguration`: `googleAdsDeveloperToken` (encrypted),
    `googleAdsCustomerId`, `googleAdsConversionActionId`, `googleAdsRefreshToken` (encrypted) +
    OAuth client id/secret; migration.
  - `settings.service.ts` / `settings/dto/settings.dto.ts`: masked read + encrypted write, same as
    `metaCapiToken` (:413/:425).
  - Dashboard repo: new card on the Integrations tab (mirror the Meta CAPI card).
  - `env.validate.ts` + both backend `.env` examples: `GOOGLE_ADS_*` fallbacks.
- Config-gated no-op exactly like Meta (`resolveMetaConfig` pattern, `tracking.service.ts:49`):
  unset credentials = one warn, never a throw - cancellations must keep working while the developer
  token is pending approval.

#### 3d. Meta refund event (extend TrackingService)

- `backend/src/tracking/tracking.service.ts`: add `fireBookingCancelled(payload)` posting a CAPI
  event to the same endpoint: `event_name: 'Refund'` (standard event), `event_id =
  `${publicRef}:refund``, same hashed `user_data`, `value = commissionEur`, `currency: 'EUR'`,
  `action_source: 'system_generated'`.
- Set expectations with the stakeholder (see §4 decisions): Meta has no true conversion retraction -
  the Refund event is the correction signal the PRD asks for, visible in Events Manager, but Ads
  Manager does not subtract it from reported Purchases.

#### 3e. Queue + relay wiring (backend)

- `backend/src/workers/platform-queue.ts` -> add to `PLATFORM_JOBS`:
  `ADS_ADJUSTMENT: 'tracking.ads-adjustment'`, `META_REFUND: 'tracking.meta-refund'`.
- `backend/src/workers/outbox-relay.service.ts` -> `jobsFor` switch (:99+): new case
  `'booking.cancelled'` fanning out to both jobs (deterministic `jobId` dedup comes free from the
  relay: `${aggregateId}__${name}`).
- `backend/src/workers/platform-jobs.processor.ts` -> two new cases calling
  `runAdsAdjustmentJob` / `runMetaRefundJob` on BookingsService (mirror
  `runCapiConversionJob`, `bookings.service.ts:1564-1596`: re-validate status, mark-first claim on
  `conversionAdjustedAt`, loud `UnrecoverableError` on unhealable state).
- **SLA:** the relay ticks every 5s and jobs retry 5x with backoff - the PRD's 24-48h correction
  window is met by construction; a pending developer token parks jobs in the visible failed set for
  manual retry once approved.

#### 3f. No-show reporting (needs a product decision first - see §4)

- Schema: `utcNoShowReportedAt DateTime?` + `noShowReportedBy` on `Booking` (pattern:
  `utcNonPaymentReportedAt` / `utcOperatorCancellationReportedAt`, `bookings.prisma:163-172`) -
  a flag, not a new `BookingStatus`, so no state machine churn.
- Endpoint: operator/admin `POST /bookings/:id/no-show` (ownership via `operator.id`, rule #19),
  allowed only after the departure time, window TBD.
- Dashboard: action on the booking detail (mirrors the operator cancellation-report flow).
- Effect: emits the same `booking.cancelled`-shaped outbox event (perhaps
  `type: 'booking.no-show'` routed to the same two jobs).
- Also unblocks the documented email-suppression skip in `next-adventure-emails.service.ts:347`.

**Phase 3 tests:** unit tests for the adjustment builders + payloads; e2e for
cancel -> outbox event -> jobs enqueued; run the code + security reviewers per repo rule after each
part.

### Phase 4 - Consent hardening (small, decide-then-do)

- **`it.attribution` is written pre-consent** (`attribution.ts` runs unconditionally; Cookiebot
  auto-blocking cannot intercept first-party `document.cookie` writes). Two options - pick one with
  the stakeholder: (a) declare it in the Cookiebot cookie declaration as a first-party
  functional/marketing cookie and rely on GTM consent-gating the *use* of the data (nothing leaves
  the site until a consent-gated tag fires; the CAPI fire carries click IDs only for consented EU
  users once 4b lands), or (b) gate `captureAttribution()` on `Cookiebot.consent.marketing` in a
  callback - safest for EEA, costs attribution for EU decliners (which is also what Consent Mode
  expects). Option (b) is the compliance-clean default.
- Consider moving the Cookiebot `<Script>` ahead of GTM more forcefully (`beforeInteractive`) - today
  ordering rests on JSX order in `app/(frontend)/layout.tsx:66` vs `:77`.

### Phase 5 - QA (PRD milestone 6)

Run on production config with the Meta test event code, then clear it:

1. Test bookings across **card (Stripe + Mollie), deposit, pay-on-arrival, `operator_full`** - each
   must produce exactly one `booking_complete` (GTM Preview), one GA4 `purchase` (DebugView), one
   deduplicated Meta `Purchase` (Events Manager), with identical EUR commission values everywhere.
2. TYP refresh + email revisit: no second event (mark-first guard returns null).
3. EEA VPN, no consent: tags hold, click IDs redacted; accept banner: tags fire.
4. Enhanced Conversions diagnostic after ~48h: match rate >60%.
5. **Proven test cancellation**: cancel a confirmed test booking, verify the retraction lands in
   Google Ads (Conversions -> adjustments) and the Refund event in Meta Events Manager within the
   SLA window.

### Phase 6 - Deliverables + monitoring (PRD deliverables)

- Write `technical-doc/03-implementation/TRACKING-EVENT-REFERENCE.md`: every event, every
  parameter, its value source (the PRD's "written reference kept alongside the codebase") - most of
  its content is §8.3 + the ConversionEvent table from 3b.
- Record the stakeholder walkthrough (Google Ads / Meta / GA4 verification paths).
- 14-day monitoring: daily check of the platform-jobs failed set (failures are retained and
  visible) + platform dashboards; log defects and fix within the window.
- Update `MASTER-CHECKLIST.md` lines :426-:428, :888, :1077, :1082, :1089 and
  `TRACKING-AND-ANALYTICS.md` §5 in the same PRs as each phase (repo rule: checklist rides the
  implementation commit).

---

## 4. Decisions to surface (do not resolve silently)

1. **"Server-side GA4/Google Ads" interpretation.** The PRD's framing says conversions fire
   "natively from the server" for all three platforms. The canonical master architecture (§8) fires
   Google Ads + GA4 from the **browser** GTM fan-out (server-guarded, mark-first) and only Meta
   truly server-side; a user who never reaches the TYP is an *accepted false negative* (master
   §8.2). If the stakeholder wants zero false negatives, that's Google Ads **offline click
   conversions** (gclid upload - the 3c plumbing enables it) + **GA4 Measurement Protocol** as an
   add-on scope. Master governs until the founder says otherwise.
2. **Meta refund semantics.** Meta offers no true retraction; the Refund CAPI event is the
   correction signal but Ads Manager won't subtract it from Purchase totals. Confirm this meets the
   stakeholder's "corrections reflected" expectation before Phase 3d is called done.
3. **No-show definition.** Who may report (operator only?), how long after departure, and whether a
   no-show on a deposit booking forfeits or refunds - product call before 3f.
4. **Attribution-cookie consent stance** (Phase 4 option a vs b).
5. **Affiliate channel go-live.** Trackdesk integration (writes `affiliateId`) is out of the PRD's
   scope but the "channel separation" metric will be judged against it eventually.

## 5. Doc bugs found during this audit (fix opportunistically)

- `TRACKING-AND-ANALYTICS.md:6` status banner says "Not yet built" - contradicted by its own §5
  table (most items BUILT 2026-07-25).
- `user_data` name-hash nesting differs between `TRACKING-AND-ANALYTICS.md` §3 (root-level
  `sha256_first_name`) and `GTM-CONTAINER-SETUP.md` §1 (nested under `address`). The code
  (`pii-hash.util.ts:96`, `toGoogleUserData`) puts names at the **root** - fix the GTM doc.
- Stale-unchecked lines contradicting done-work elsewhere: `BOOKING-CHECKLIST.md:638,:644`,
  `BOOKING-COMPLETION-PROGRESS.md` E8/D4 + its "🔴 ~5%" status row,
  `BOOKING-FLOW-DESIGN-GUIDE.md:866-867`, `MASTER-CHECKLIST.md:1909,:1937`.
- The August PRD is linked from no architecture doc; its cancellation-SLA, channel-separation,
  dev-token, and monitoring requirements exist nowhere else - this checklist is now that link.
