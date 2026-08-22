# Server-Side Ad Conversion Tracking - PRD audit, checklist & implementation plan

> **PRD:** `technical-doc/Island Tours — Server-Side Ad Conversion Tracking PRD.md` (Rezina,
> 2026-08-16). **Architecture:** `02-architecture/TRACKING-AND-ANALYTICS.md` (master §8).
>
> **→ Setting it up? Use these, not this doc.** This one is the audit trail; those are the
> instructions:
>
> | If you want to… | Read |
> | --- | --- |
> | **Do the setup, step by step, ticking boxes** | **[`SEO-AND-TRACKING-SETUP-RUNBOOK.md`](./SEO-AND-TRACKING-SETUP-RUNBOOK.md)** |
> | Understand what any of it means, in plain language | [`../SEO-AND-TRACKING-EXPLAINED.md`](../SEO-AND-TRACKING-EXPLAINED.md) |
> | Configure the GTM container tag by tag | [`GTM-CONTAINER-SETUP.md`](./GTM-CONTAINER-SETUP.md) |
>
> **This doc:** every PRD requirement cross-checked against the actual code, split into
> DONE / NOT DONE, with a where-and-how plan for everything open.
> **Last verified against code: 2026-08-19.** That pass closed the last four open engineering
> items - the TYP null-commission error render, the `eurFxRate` third-currency guard, the
> attribution consent gate, and no-show reporting - so **every remaining item below is external,
> configuration, or QA. There is no platform code left to write for this PRD.**

---

## 0. TL;DR scoreboard

| PRD requirement | Status | One-liner |
| --- | --- | --- |
| Click-ID capture at landing (gclid/gbraid/wbraid/fbclid + UTMs, first-party cookie) | ✅ BUILT · CONSENT-GATED 2026-08-19 | `it.attribution.v2` cookie, 90 days, last-click wins per param. Written ONLY on Cookiebot marketing consent; landing params held in memory so a late Accept still captures; withdrawal clears it; sanitised on read |
| Click IDs + UTMs persisted on the booking record | ✅ BUILT | 9 columns on `Booking`, write-once at reserve |
| Fire on transition to CONFIRMED | ✅ BUILT | single choke point `finalizeConfirmation`, all 3 confirm paths |
| Conversion value = server-resolved `commission_amount`, never GMV | ✅ BUILT · ERROR RENDER 2026-08-19 | rule #22; null commission = corruption, no fire, AND the TYP now renders the error instead of a silent fallback (`dataError: 'NULL_COMMISSION'`) |
| EUR normalization + documented rounding | ✅ BUILT · GUARDED 2026-08-19 | HALF_UP 2dp, PSP charge-rate re-anchoring, FX audit columns. `eurFxRate` is now exhaustive over `Currency` (`never` default), so a third currency breaks the BUILD instead of silently pricing at the USD rate |
| Atomic mark-fired dedup guard | ✅ BUILT | `conversionFiredAt` (server) + `conversionPushedAt` (browser), guarded `updateMany` in tx |
| Meta CAPI server-side, parallel to Pixel, shared transaction id | ✅ BUILT | queued `tracking.capi-conversion` job, `event_id = publicRef` |
| Enhanced Conversions hashed PII (email, E.164 phone, name, address) | ✅ BUILT (code) | one SHA-256 pass server-side; envelope emitted in the dataLayer push |
| Consent Mode v2 region-aware defaults + Cookiebot | ✅ BUILT | EEA+UK denied default, inline before gtm.js; CBID dashboard-managed on the **Integrations** tab (its own Cookiebot card), with a `NEXT_PUBLIC_COOKIEBOT_CBID` dev fallback |
| GTM container 4-tag fan-out (Conversion Linker / Ads / GA4 / Pixel) | 🟡 CONFIG ONLY | code side done; container work blocked on stakeholder IDs |
| Click IDs / booking_ref / operator / island / user_id **inside** the dataLayer payload | ✅ BUILT 2026-08-17 | Phase 2 shipped: full §8.3 payload + typed `BookingCompleteEvent` CI contract |
| Cancellation correction: Google Ads negative adjustments | ✅ BUILT 2026-08-17 | Phase 3c: delayed `tracking.ads-adjustment` job -> RETRACTION by `orderId = publicRef`; config-gated no-op until the developer token + credentials are entered |
| Cancellation correction: Meta refund events | ✅ BUILT 2026-08-17 | Phase 3.1: `booking.cancelled` outbox -> `tracking.meta-refund` job -> CAPI `Refund` + `conversion_events` audit |
| No-show correction | ✅ BUILT 2026-08-19 (as a NON-correction) | phase 3f: operator reports -> admin confirms (`utcNoShowReportedAt`/`utcNoShowConfirmedAt`). Deliberately sends NOTHING to the ad platforms - the kept deposit IS the commission (LD24), so the reported value is still true |
| Paid vs affiliate/organic separation at the data-model level | 🟡 PARTIAL | `affiliateId` column exists and is separate from UTMs, but nothing writes it (Trackdesk not integrated) |
| Google Ads developer token request | ❌ NOT STARTED | external, stakeholder action - **now the single biggest blocker**: with all platform code done, this is what stands between the built retraction code and live corrections. 2-3 business days |
| QA across card / deposit / pay-on-arrival + test cancellation | ❌ NOT RUN | §8.4 Definition-of-Done checks pending container config |
| Recorded walkthrough + written event reference | ❌ NOT DONE | reference doc should live in this folder (Phase 6 below) |
| 14-day post-launch monitoring | ❌ NOT STARTED | needs the failed-job visibility already present in Bull Board |

Bottom line as of **2026-08-19: the platform-code half of the PRD is COMPLETE.** Attribution
capture (now consent-gated), the commission-EUR value, both dedup guards, the full §8.3 payload,
Meta CAPI, Consent Mode v2, the cancellation-correction pipeline (Meta Refund + Google Ads
retraction), the conversion audit trail, the rule #22 error render, the FX exhaustiveness guard and
no-show reporting are all built, tested and merged.

**Everything still open is external, configuration, or QA** - and one item gates most of the rest:

| Blocker | Why it matters | Runbook step |
| --- | --- | --- |
| **Google Ads developer token not requested** | 2-3 business days, external. The retraction code is live but a warn-once no-op until it plus the credentials exist. The PRD says submit it on day one for exactly this reason. | **2** |
| **Live canonical URL is a placeholder** (`https://islandtours.example`) | Verified on prod 2026-08-19: every canonical tag, every hreflang alternate and the whole sitemap point at a domain that is not yours. One dashboard field. | **3** |
| Ad-platform access not provisioned | GTM admin, Google Ads admin, GA4 editor, Meta BM (pixel + system user) | 1 |
| IDs not entered in the dashboard | **Settings → SEO** (GTM / GA4 / Pixel / Search Console / Canonical URL) + **Settings → Integration → Analytics and Tracking** (Meta CAPI, Cookiebot, Google Ads). Verified empty on prod 2026-08-19. | 4-5 |
| GTM container not configured | The dataLayer push, consent defaults and CAPI dedup contract all ship in code; the container that consumes them is empty | 6 |
| `NEXT_PUBLIC_ENABLE_TRACKING` not set on prod | The browser half fires nothing until it is `'true'` - **and the frontend is rebuilt**, because it is inlined at build time. The server-side Meta feed is NOT gated on it and arms at step 5. | 7 |
| QA, walkthrough, 14-day monitoring | PRD milestone 6 + the contractual deliverables | 8-10 |

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
consumes them is empty. Follow `GTM-CONTAINER-SETUP.md` verbatim: 7 Data Layer Variables named WITH
the `dlv - ` prefix, one `booking_complete` trigger, and 4 tags:

1. **Conversion Linker** - trigger **All Pages / Initialization**, not `booking_complete`. It exists
   to capture the click at LANDING, so putting it on the TYP defeats it.
2. **Google Ads conversion** (dynamic value) with Enhanced Conversions from `{{dlv - user_data}}`
   and Transaction ID `{{dlv - event_id}}`.
3. **GA4 `purchase`** with its own Measurement ID. **No "Google tag" / GA4 configuration tag** - the
   app now loads gtag.js itself (§2.1b), so a config tag here would double-count pageviews.
4. **Meta Pixel with `eventID = {{dlv - event_id}}`** - without it every booking double-counts
   against the server CAPI.

Blocked on: GTM container ID, Google Ads Conversion ID + Label, Meta Pixel ID. (The GA4 `G-` ID is
no longer a container input - it is a dashboard field, §2.1b.)

### 2.1b GA4 is loaded from the dashboard - ✅ RESOLVED 2026-08-19

The dashboard's **Google Analytics ID** field was inert: nothing on the public site read
`googleAnalyticsId`, and GA4 in fact depended on a "Google tag" someone had to remember to add
inside GTM. Filling the field in felt like configuring GA4 and did nothing.

`components/frontend/tracking/google-tag-manager.tsx` now loads `gtag.js` from it, so entering the
ID is what switches GA4 on. Alongside:

- **GA4 and GTM are independently gated.** The component previously returned `null` without a GTM
  ID, so GA4 could never have loaded on its own.
- **Both IDs are format-validated** (`lib/tracking/tag-ids.ts`, 23 tests) because they are
  interpolated into an INLINE SCRIPT - a stray apostrophe would have broken every page, a crafted
  value would have executed. Malformed = treated as not configured.
- **Consent ordering preserved**: the Consent Mode v2 defaults and both loaders are concatenated
  into ONE inline script in that order, which is the only way to guarantee the defaults land first.
- **Trade-off, documented in three places**: the container must NOT also carry a GA4 configuration
  tag, or pageviews double-count. Google's docs do not settle whether an Event tag needs a config
  tag, so the runbook verifies it empirically and names the fallback.

**Deliberately NOT moved to the dashboard: the Google Ads Conversion ID + Label.** The Ads
conversion is fired BY the GTM tag; firing it from the app as well would double-count every booking -
the same failure mode as a missing `eventID`. Enhanced Conversions and the Transaction ID also live
in that tag's config, so splitting the ID away from them buys nothing.

### 2.2 dataLayer payload is missing spec'd fields - ✅ RESOLVED 2026-08-17 (Phase 2 shipped)

`TRACKING-AND-ANALYTICS.md` §3 requires `click_ids.{gclid,gbraid,wbraid,fbclid}`, `booking_ref`
(display_ref), `operator_id`/`operator_name`, `island`, `user_id`, and `item_brand`/`item_category`
in `items[]`. All shipped: `buildConversionPayload` + `BookingConversionDto` extended on the
backend, `TypConversion` + the typed `BookingCompleteEvent` contract on the frontend
(`lib/tracking/booking-complete.ts`), with `click_ids`/`user_id`/`user_data` omitted (not null)
when absent. The CI type-check items (MASTER-CHECKLIST :426/:1082) and the GA4 `user_id`
hashed-email item (:427) closed with it.

### 2.3 Cancellation correction pipeline - ✅ RESOLVED 2026-08-17 (was the PRD's headline gap)

Every bullet that used to sit here is now built. Kept as a record of what changed:

- **Google Ads integration** - `src/tracking/google-ads.service.ts`. `ConversionAdjustmentUpload`
  RETRACTION keyed on `orderId = publicRef` (the Transaction ID the GTM Ads tag reports, so no
  gclid round-trip). Delayed 24h so Google has ingested the conversion first; still inside the
  PRD's 24-48h SLA. Retracts only when the commission is actually lost (FULL refund), never on a
  NONE-refund cancellation where the kept deposit IS the commission.
- **Meta refund event** - `TrackingService.fireBookingCancelled`, CAPI `Refund` with
  `event_id = <publicRef>:refund`.
- **`booking.cancelled` outbox event** - committed in the `cancel()` transaction, only when
  `conversionFiredAt` is set, fanned out by the relay to both jobs.
- **Adjustment audit** - the `conversion_events` table (`prisma/tracking.prisma`), one row per send
  attempt with SENT/FAILED and the platform error. This is the PRD's verifiability metric.

Still true, and still the blocker: **none of it fires until the Google Ads developer token and
credentials exist** (§2.5). The service is a warn-once no-op until then, which is why it was safe
to merge ahead of the token.

### 2.4 No-show correction - ✅ RESOLVED 2026-08-19 (phase 3f)

Built, but deliberately NOT as an ad-platform correction - and that is the finding, not a shortcut.

**The PRD asks for no-show corrections on the premise that Smart Bidding keeps optimising on
bookings that never complete.** Under this platform's money model that premise does not hold: a
no-show keeps the deposit, and per LD24 the deposit IS the commission. The revenue is real and
already correctly reported, so there is nothing to retract. Retracting anyway would under-report
genuine revenue to Smart Bidding - the opposite of the PRD's own goal. This is the same rule the
shipped cancellation pipeline already applies when it skips a NONE-refund cancellation.

So what shipped is the operational half:

- `utcNoShowReportedAt` + `noShowReason` + `utcNoShowConfirmedAt` on `Booking` (migration
  `20260819120000_booking_no_show`). A FLAG, not a `BookingStatus`: the tour ran and the seat was
  consumed, so there is no transition to make and no state machine to rework.
- `POST /bookings/:id/report-no-show` (operator, `EDIT_BOOKING`, ownership 404s a foreign booking),
  `POST /bookings/:id/confirm-no-show` and `/dismiss-no-show` (admin, `MANAGE_BOOKINGS`) - the exact
  report-then-confirm shape as the non-payment forfeit, because "they didn't come" is one party's
  word about an event with no system trace.
- Refused before the trip has departed (reuses `hasDeparted`, which handles the local-wall-clock and
  legacy date-only cases) and on any non-CONFIRMED booking.
- Confirming changes nothing else: no status flip, no refund, no seat release, no settlement
  reversal, no outbox event.
- **Closes the documented email-suppression skip** in `next-adventure-emails.service.ts` - MK-1 now
  suppresses on `utcNoShowConfirmedAt`, gated on the CONFIRMED stamp rather than the report so a
  mistaken report cannot silently switch off someone's marketing.

Companion dashboard PR adds the row actions.

### 2.5 Google Ads developer token - THE remaining blocker

The **plumbing is done**: `IntegrationsConfiguration` carries all seven Google Ads fields (developer
token, customer id, optional login-customer id, OAuth client id/secret, refresh token, conversion
action id) with the secrets encrypted and masked on read; `env.validate.ts` has the matching
`GOOGLE_ADS_*` fallbacks (all defaulting to null); and the dashboard Integrations tab has the card
(dashboard PR #109).

**What has NOT happened is the external request.** The developer token (Google Ads -> Tools -> API
Center, 2-3 business days) has still not been submitted. The PRD asks for it on day one precisely
because it is the only external dependency and everything else was built to proceed in parallel -
which it now has. With all platform code complete, this is the single item holding up live
corrections.

### 2.6 Affiliate/channel separation is model-only

`affiliateId` exists but no code writes it (Trackdesk not integrated), and nothing in GA4/GTM
distinguishes paid vs affiliate vs organic yet. The PRD only requires that they be *separable with
no shared-attribution overlap* - the model satisfies that today; reporting-side channel definitions
land with the container work.

### 2.7 Smaller open items already tracked in MASTER-CHECKLIST

- [x] CI type-check of the `booking_complete` payload contract (missing required field = build
  error, not runtime fallback) - DONE 2026-08-17 (typed `BookingCompleteEvent`, composition
  compile-checked; `tsc` runs in CI).
- [x] TYP error render (no conversion) when a confirmed booking has null `commission_amount` -
  DONE 2026-08-19 (MASTER-CHECKLIST :888). The claim endpoint returns
  `dataError: 'NULL_COMMISSION'` next to the null payload so the page can distinguish corruption
  from the ordinary nulls; `ThankYouRecordIssueNotice` renders above the hero in all 7 locales.
  **Deliberate reading of "render an error":** a banner, not a thrown error page - the booking is
  paid and valid and only its *reporting* value is missing, so blanking the traveller's tour date,
  meeting point and operator contact would turn an internal accounting defect into a customer-facing
  outage. Nothing fires on any platform, the backend logs `data corruption` on every render, and the
  mark-first guard is deliberately not burned so a repaired booking can still convert.
- [x] `user_id` for GA4 cross-device from the hashed email - DONE 2026-08-17 (derived in
  `buildConversionPayload` from the same email hash; `Booking.customerId` column stays reserved).
- [x] `eurFxRate()` no longer treats every non-EUR currency as USD - DONE 2026-08-19. It was
  `currency === EUR ? 1 : usdToEurRate()`, which reads "anything that is not EUR is USD" and is
  true only while `Currency` has exactly two members; a third (GBP, ANG, …) would have been priced
  silently at the USD rate. Now an exhaustive `switch` whose `default` assigns to `never`, so
  **extending the enum stops the build** - that is the real guard - plus a runtime throw for a
  value arriving from outside the type system (raw SQL, stale client). Matters because this rate
  produces `commission_amount`, the number Google Ads and Meta bid against (rule #22), and it is
  snapshotted onto the booking forever as `fxRateToEur`. `StaticFxProvider` already warned-and-
  skipped unknown pairs, so it needed no change. Security review also caught a SECOND copy of the
  old shape in `prisma/demo/_shared.ts` - inside the TS program, so it would have kept compiling
  and silently seeded at the USD rate after the real one broke the build; it is now a re-export of
  the single implementation. Code review also found the same latent shape in
  `fx-rates.service.ts` `REQUIRED_PAIRS` - a hardcoded two-currency array with nothing tying it to
  `Currency`, so a third member would have compiled clean, had no rate fetched, and silently made
  the platform unable to book in it (`getRate` 503s at reserve - safe direction, zero build
  signal); it is now derived from a `Record<Exclude<Currency, 'EUR'>, true>` that the enum forces
  to grow. (`src/octo/common/octo-money.ts` `Record<Currency, number>` was already an independent
  guard on the same enum and needs no change.) **The guard was verified empirically**, not by
  reasoning: adding `GBP` to `enums.prisma` + `prisma generate` + `tsc` produced
  `TS2322: Type '"GBP"' is not assignable to type 'never'`, and `prisma generate` is prepended to
  both `build` and `start:dev` so a schema-only edit cannot hide it.

### 2.7b Follow-up surfaced by the FX security review (2026-08-19, NOT introduced by it)

- [ ] **A `CONFIRMED` booking with `conversionFiredAt IS NULL` is a terminal state with no repair
  path.** Every reader of that column skips on null (`bookings.service.ts` :1299/:1622/:1648/:1706/
  :1719/:3493) and no sweeper re-attempts `finalizeConfirmation`. So if that method ever throws
  after the status flip commits, the booking is confirmed and paid but has no confirmation email,
  no settlement row, no outbox event and no conversion - and a webhook redelivery just throws
  again. Unreachable today (the FX guard's precondition is independently prevented at the DTO,
  the PG enum and a fail-closed `getRate`), but it is the right safety net for ANY throw in that
  method, not just this one. A nightly sweep over `status=CONFIRMED AND conversionFiredAt IS NULL`
  would close it.
- [ ] **The Stripe webhook lane cannot self-heal that state, and Mollie can.** `payments.service.ts`
  inserts the `stripe_webhook_events` row BEFORE processing (:573) and rethrows leaving
  `processedAt` null so Stripe retries (:620) - but the retry re-enters, hits the unique violation
  on the same event id (:583), logs `already processed - skipping` and returns. Nothing anywhere
  reads `processedAt IS NULL`, so on Stripe a lost finalization is lost permanently. Mollie is
  fine: it upserts with `update: { processedAt: null }` (:642-654), so a redelivery genuinely
  reprocesses. Fixing the sweep above matters more on the Stripe lane for this reason.

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

**Phases 2, 3 and 4 are SHIPPED - all platform code for this PRD is merged.** What is left is
Phase 0 (access + the developer token), Phase 1 (the GTM container), and Phases 5-6 (QA, the
walkthrough, the written event reference and the 14-day monitoring window). They are listed in the
order they must happen: nothing in 1 or 5 can start before the access in 0.

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

> **Phase 3.1 SHIPPED 2026-08-17** - 3a (the `booking.cancelled` outbox event), 3d (Meta Refund
> CAPI event), 3e (queue/relay/processor wiring for the Meta job) and the `conversion_events`
> audit table from 3b. **Deliberate deviation from 3b as planned below:** NO `conversionAdjustedAt`
> guard column was added - the Meta refund is idempotent the same way the CAPI conversion is
> (deterministic `event_id = <publicRef>:refund` absorbed by Meta + the relay's deterministic
> jobId), matching the repo's documented "CAPI needs no column" pattern, and a single shared
> column could not have guarded two independent platform jobs anyway. Google Ads (3c) decides its
> own idempotency when it lands (likely a unique claim on `conversion_events` or its own stamp).
> Cancellation semantics shipped: the outbox event fires for EVERY executed cancellation of a
> conversion-fired booking with the refund verdict in the payload; the Meta Refund event carries
> `cancellation_refund` so reporting can distinguish kept-deposit cancels. Phase 3c's rule (from
> §4 decision 2 groundwork): retract in Google Ads only when the commission is actually lost
> (FULL refund / settlement reversed), restate for PARTIAL, leave NONE alone.
> Optional follow-ups noted: admin dashboard view over `conversion_events` (monitoring nicety);
> consider letting a Meta HTTP rejection throw so the queue's 5-attempt retry covers transient
> 5xx (today: FAILED audit row + log, no retry - unchanged from the original conversion fire).

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

#### 3c. Google Ads conversion adjustments (new backend service) - ✅ SHIPPED 2026-08-17

> **As built** (differs from the sketch below in three deliberate ways):
>
> 1. **Delayed 24h**, not immediate (`ADS_ADJUSTMENT_DELAY_MS`) - an `order_id`-keyed conversion
>    must be ingested by Google before it can be adjusted. Still inside the PRD's 24-48h SLA.
>
> 2. **Money rule decides whether to correct at all**: retract on FULL (and conservatively on
>    PARTIAL, which `computeRefund` never produces today - it returns FULL|NONE); **skip NONE**,
>    because the kept deposit IS the commission (LD24), so the reported conversion value is still
>    true. Restatement is not used - no defensible adjusted value exists for a partial.
>
> 3. **Throws, unlike the Meta service** - retractions only ever run as queued jobs, so failures
>    must reach the queue: 401/403 (developer token pending/revoked) -> `UnrecoverableError`
>    (parks visibly, manually retryable once approved); 5xx/partial-failure -> plain Error (5
>    retries with backoff). Replay protection is a prior-SENT `conversion_events` pre-check plus
>    ALREADY_RETRACTED-as-success, because Google ERRORS on a duplicate retraction where Meta
>    absorbs it. Shared `ConversionAuditService` now owns the audit rows for both platforms.
>
> Ships BEFORE the developer token exists: unset credentials = warn-once no-op, so merging this
> is safe and the corrections begin the moment the stakeholder enters the credentials.
> **Dashboard PR is the companion half** (Integrations card) - backend deploys FIRST, or the
> dashboard POSTs keys the API would reject.

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

- [x] **`it.attribution` is no longer written pre-consent** - DONE 2026-08-19, founder chose
  option (b), the compliance-clean default. The cookie is written ONLY once
  `Cookiebot.consent.marketing` is true. This had to be enforced in our own code: `blockingmode=auto`
  works by holding back third-party `<script>` tags and cannot intercept a first-party
  `document.cookie` write, so `AttributionCapture` IS the control.
  **Fails closed** - no Cookiebot on the page means no capture, ever.
  **The landing params are snapshotted into memory on mount and persisted only when consent
  arrives**, because click ids exist on the landing URL and nowhere else: by the time a visitor has
  read the banner and clicked Accept they have usually navigated on, and a naive gate would have
  silently gutted attribution for every *consenting* EEA visitor. Memory is not storage and needs
  no consent.
  **Withdrawal actively CLEARS the cookie** (subscribes to ConsentReady/Accept/Decline, which also
  fire via `Cookiebot.renew()`), rather than merely stopping future writes.
  Also: `secure` added to the cookie on https, and the duplicate `window.Cookiebot` global
  declaration consolidated into `lib/tracking/cookiebot.ts` (TS merges `declare global` across
  files, so two shapes would not compile). Cost, accepted by design: EU decliners lose attribution -
  which is exactly what Consent Mode expects.
  **The gate is not retroactive, so the cookie NAME was versioned to `it.attribution.v2`** and the
  old name is deleted unconditionally on mount. Security review's catch: the pre-gate build wrote
  `it.attribution` for every visitor with a 90-day life, and the clear path only runs when Cookiebot
  is present - which is exactly what an ad blocker, a CSP block or an unset CBID removes. That
  legacy cookie would still have been read at checkout and snapshotted onto the booking forever.
  **The cookie is also sanitised on READ** (known keys only, strings only, caps re-applied): cookies
  match on (name, domain, path), so a sibling subdomain can plant a `Domain`-scoped duplicate that a
  host-only delete cannot remove - and an unknown key merged forward would 400 every booking attempt
  against `forbidNonWhitelisted`.
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
3. ~~**No-show definition.**~~ RESOLVED 2026-08-19. Operator reports / admin confirms; allowed any
   time after departure (no upper window - a late report is better than a lost one, and the admin
   is the check); the deposit is KEPT, matching the non-payment forfeit. And the founder's call on
   the substantive question: a confirmed no-show sends NOTHING to the ad platforms, because the
   kept deposit is the commission.
4. ~~**Attribution-cookie consent stance**~~ RESOLVED 2026-08-19: option (b), gate on Cookiebot marketing consent. Shipped.
5. **Affiliate channel go-live.** Trackdesk integration (writes `affiliateId`) is out of the PRD's
   scope but the "channel separation" metric will be judged against it eventually.

## 5. Doc bugs found during this audit (fix opportunistically)

Re-verified 2026-08-19.

**Fixed since the original audit:**

- ~~`TRACKING-AND-ANALYTICS.md:6` status banner says "Not yet built"~~ - now reads BUILT and points
  at its own §5 table.
- ~~`user_data` name-hash nesting differs between `TRACKING-AND-ANALYTICS.md` §3 and
  `GTM-CONTAINER-SETUP.md` §1~~ - the GTM doc now matches the code (names at root, address nested).

**Still open:**

- Stale-unchecked lines contradicting done work elsewhere: `BOOKING-CHECKLIST.md:641,:644`
  (items 6/7/8 - Meta CAPI, GTM fan-out, Consent Mode - all shipped),
  `BOOKING-COMPLETION-PROGRESS.md:57` ("🔴 ~5%" for the whole tracking layer), `:564` (D4 CAPI job),
  `:651` (E8 Consent Mode), `BOOKING-FLOW-DESIGN-GUIDE.md:866-867`,
  `MASTER-CHECKLIST.md:1909,:1937`.
- `SEO-STRATEGY.md` is stale twice: its "Implementation status" section says the frontend rendering
  layer is still a build task (it is built - sitemap, robots, JSON-LD all ship), and its
  structured-data table says tour detail emits `Product`/`Offer` when the code emits `TouristTrip`.
- `frontend/lib/seo/site-url.ts` falls back to `https://www.tripwheel.app`, not island.tours, when
  both the Settings canonical URL and `NEXT_PUBLIC_SITE_URL` are unset.
- `ItemList` JSON-LD on the All Tours grid is spec'd in `SEO-STRATEGY.md` but not implemented
  (`MASTER-CHECKLIST.md:1067`).
- The August PRD is linked from no architecture doc; its cancellation-SLA, channel-separation,
  dev-token, and monitoring requirements exist nowhere else - this checklist is that link.
