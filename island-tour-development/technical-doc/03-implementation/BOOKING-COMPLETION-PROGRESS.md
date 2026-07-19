# Booking -> Payment -> Payout -> Tracking - completion progress

> **Living progress tracker** for finishing the end-to-end booking flow: booking, payment,
> confirmation email + operator payment-link email, scheduled payout after the cancellation
> window, payout/settlement, cancellation + refunds, provider-backed FX, the frontend widget,
> and the tracking/analytics layer.
>
> **This is the dashboard.** The task detail lives in the two checklists; this doc rolls them up
> into a single trackable view with a critical path.
>
> - Detail (backend/logic): [BOOKING-CHECKLIST.md](./BOOKING-CHECKLIST.md)
> - Detail (frontend widget/checkout): [BOOKING-WIDGET-CHECKLIST.md](./BOOKING-WIDGET-CHECKLIST.md)
> - Canonical: `technical-doc/island-tours-platform-master.html` v1.9 (wins on any conflict)
>
> **Maintenance rule:** on completing ANY task, update (1) this doc's checkbox + progress table,
> (2) the matching line in BOOKING-CHECKLIST.md / BOOKING-WIDGET-CHECKLIST.md, (3) the task status.
> Keep the three in lockstep in the same commit/response.

Last updated: 2026-07-16 · Branch: `rendering-caching` · ROOT HEAD at doc creation: `21efe49`

---

## Where we are now

The **money-flow spine is built and committed end-to-end**:

```
reserve (ON_HOLD) -> PATCH contact -> payment intent (automatic_payment_methods)
  -> custom Stripe card / PayPal + iDEAL redirect -> /payment/processing poller
  -> webhook confirm -> CONFIRMED + EUR conversion stamp -> TYP
```

Also built: server-authoritative quote, UNIT pricing, provider-backed FX (static provider + DB
cache + refresh scheduler), multi-currency display across public/wishlist/dashboard.

**Happy-path booking + card payment works.** What remains is the **edges**: real money
settlement/payout, real refunds, the second (operator) email, async/queue hardening, and the whole
tracking layer.

Uncommitted at doc creation: consent-line tweak (`checkout-payment.tsx`, `en.json`) + two trip-form files.

---

## End-to-end flow status

| Stage | Status | Remaining |
|---|---|---|
| Booking / reserve | 🟢 ~95% | attribution (utm/gclid) not captured at reserve; age-restriction validation partial |
| Payment (card / PayPal / iDEAL) | 🟢 ~90% | Mollie webhook is a stub; payment-succeeds-after-hold-expired reconciliation |
| Confirmation email | 🟡 ~75% | Resend transport live (2026-07-19); no invoice attachment; sent inline not queued |
| Operator payment-link email | 🔴 not built | second `operator_link` balance email (names operator + secure link) |
| Scheduled payout after cancel window | 🔴 not built | needs Settlement ledger + delayed payout job (RECORDED -> PAID_OUT, clawback-safe) |
| Payout / settlement | 🔴 not built | no Settlement model, no rows at confirm, no net_position convention (Connect = v2) |
| Cancellation + refunds | 🟡 ~60% | refund is category-only: no real Stripe refund, no REFUND row, no per-model amount, no tokenized cancel page |
| Provider-backed FX | 🟡 ~85% | only a real provider impl (Stripe FX Quotes) behind the existing seam remains |
| Frontend widget / checkout | 🟡 ~80% | pickup, add-ons, timing affordances; real-TYP data still demo |
| Tracking / analytics | 🔴 ~5% | whole §8.2/§8.3 browser + CAPI + GTM + consent layer |

Legend: 🟢 done/nearly · 🟡 partial · 🔴 not built.

---

## Task groups (~45 open items)

Checkboxes here mirror the two checklists. Tick both when a task lands.

### A. Settlement & payout (0/5 v1; 2 v2 deferred)
- [ ] A1 `Settlement` model + `SettlementStatus` enum
- [ ] A2 Write one Settlement row per booking at confirmation (deposit models net ~0)
- [ ] A3 `net_position` sign convention enforced in writes
- [ ] A4 `paid_in_full` scheduled payout after cancel window (RECORDED -> PAID_OUT, clawback-safe)
- [ ] A5 Delayed payout job wiring (depends A1-A4)
- [ ] A6 (v2) `operator_full` reintroduced + commission collection rail - deferred
- [ ] A7 (v2) Stripe Connect Express (destination charge, application_fee) - deferred

### B. Cancellation & refunds (0/4)
- [ ] B1 Execute real Stripe refund on cancellation + write `REFUND` Payment row
- [ ] B2 Payment-model-aware refund amount (deposit-only vs full; partial)
- [x] B3 Tokenized cancel confirmation page (no raw-click) - BUILT 2026-07-16, see round 4 below.
  (The "account fallback" booking-lookup half of B3 is still open.)
- [ ] B4 Operator non-payment -> admin confirm -> forfeit deposit + release (no auto-forfeit)

### C. Email (0/7)

> **Founder requirement 2026-07-16: 2 emails per booking, 3 on `operator_link`.**
> 1. Confirmation email to the traveller (C6 - must follow the LOCKED wireframe)
> 2. **"Booking Received" notification to the tour operator** (C7 - NEW, was untracked)
> 3. Secure payment link for the remainder, `operator_link` only (C1)

- [ ] C1 Operator-balance email on `operator_link` (names operator + secure balance link)
- [ ] C2 Invoice attachment (from Stripe/Mollie) on confirmation
- [ ] C3 Pre-tour reminder (24h before; no payment links)
- [x] C4 Switch provider SMTP -> Resend - EXECUTED 2026-07-19 (env-only config: `RESEND_API_KEY` + `MAIL_FROM`; SMTP settings API + table removed; Postmark fallback still open)
- [ ] C5 Verify template never names/spotlights operator before payment
- [x] **C6 Confirmation email follows the locked wireframe** (`technical-doc/island-tours-booking-confirmation-email-wireframe.html`
  -> `backend/src/mail/templates/booking-confirmation-email.template.html`). **WIRED 2026-07-16** -
  `mail.service.ts` now renders the locked template; the lean `booking-confirmation.template.ts` is
  retired. See "C6 - wiring complete" below.
- [x] **C7 "Booking Received" notification email to the tour operator** - BUILT 2026-07-16, see
  round 4 below. Recipient = `companyInfo.companyEmail ?? contactEmail` (founder: company email
  first). Fires in `finalizeConfirmation` right after the traveller email; failures swallow (money
  already captured). English-formatted regardless of the traveller's locale.

#### C6 - locked template contract (extracted 2026-07-16)

Mini-language: `{token}` placeholders + `[IF cond]…[ELSE]…[/IF]` blocks (supports `=`, `AND`, `OR`).
Needs a small renderer - none exists. **44 tokens, 14 distinct conditions.**

Conditions: `hasPickup`, `duration`, `endPoint`, `tourLanguage`, `specialRequests`, `operatorNote`,
`paymentModel = operator_link | on_arrival | paid_in_full | operator_full` (+ the `OR` pairs), and
`paymentModel = on_arrival AND onArrivalPayment = card_or_cash | cash_only`.

**Data we already have** (post-E3): `firstName`, `bookingRef`, `tourName`, `operatorName/Email/Phone`,
`dateLong`, `dateShort`, `startTime`, `duration`, `partyBreakdown`, `pickupLocation`, `totalAmount`,
`depositAmount`, `depositPct`, `balanceAmount`, `islandName`, `specialRequests` (`Booking.notes`),
`cancelDeadlineDateTime`, `locale`, related tours (via `getThankYouRelatedTours`).

**Data with NO model - needs a decision before C6 can be faithful:**

| Token / condition | Gap |
|---|---|
| `onArrivalPayment` (`card_or_cash` / `cash_only`) | Not modelled anywhere. Drives 2 whole template variants. Needs a Tour column + operator UI, or a fixed default. |
| `arrivalBufferMin` | Not modelled ("be ready N minutes before"). Tour column or platform constant? |
| `pickupTime` | Not modelled (pickup time vs departure start). Derive from start - buffer, or new field? |
| `meetingPoint` | No field for the non-pickup meeting point. |
| `endPoint` | No field (tour end location). |
| `operatorNote` | No field (per-tour or per-booking note from the operator). |
| `whatToBring`, `knowBeforeYouGo` | Tour editorial content - confirm which existing fields map here. |
| `tourLanguage` | Tour languages exist; confirm which to render for a booking. |
| `whatsappUrl`, `mapUrl`, `cancelUrl`, `accountUrl` | Routes/handles not defined yet (cancel needs the tokenised page, B3). |
| `featuredImageUrl` | Tour hero image - available, confirm the source field. |

#### C6 - locked decisions (founder, 2026-07-16)

1. **`onArrivalPayment` = new `Tour` enum column** (`CARD_OR_CASH | CASH_ONLY`) + operator dashboard
   field, **snapshotted onto `Booking` at reserve** (same rule as `payment_model`, #21 - never
   retroactive). Needs a migration.
2. ~~`arrivalBufferMin` = platform constant; `pickupTime` = start - buffer.~~ **SUPERSEDED on
   inspection - NO constant is needed, every field already exists:**
   - non-pickup "arrive N minutes early" -> **`Tour.checkInMinutesBefore`** (`@default(30)`, already
     labelled "Please arrive N minutes early for check-in" - Figma, master default 30)
   - pickup "be ready N minutes before" -> **`PickupLocation.minutesPrior`**
   Original (also correct) findings:
   - `PickupLocation.minutesPrior` ("pickup happens N minutes before departure")
   - `PickupLocation.windowStart` / `windowEnd` (`'HH:MM'`, the Figma "7:45-8:15 AM window")
   -> `pickupTime` = the pickup window (or start - `minutesPrior` when no window);
     `arrivalBufferMin` = `minutesPrior` for pickup tours. A **platform constant is only the
     fallback** (no `minutesPrior` set) and for the non-pickup "arrive N minutes early" line.
   - Booking already snapshots `pickupAddress` + `pickupLocationId`; the timing fields are NOT
     snapshotted, so decide whether to snapshot them at reserve (booking immutability) or join live.
3. **`meetingPoint` = the tour's `START` `TourLocation`** (`TourLocation.types` contains `'START'`),
   rendered from `TourLocationTranslation.title` (**already localized**) + `streetAddress`. No
   migration. Same source gives **`endPoint`** for free (`types` contains `'END'`) - so that block
   can be populated rather than hidden.

#### C6 - progress 2026-07-16

- [x] **Renderer built + tested** - `mail/templates/email-template.renderer.ts` (+ spec, 20 tests).
  Recursive (handles the 2-deep nesting), supports `{token}` / `[IF]` / `[ELSE]` / `=` / `AND` / `OR`.
  Unknown tokens are left **literal** (a loud `{whatToBring}` beats a silently-blanked sentence);
  `findUnresolvedTokens()` is the guard. Values are HTML-escaped; CSS braces are untouched; it throws
  on an unbalanced block rather than emitting half an email. Tests render the **real shipped
  template** and assert the wireframe's per-model money rows, so a future designer edit fails here
  and not in a traveller's inbox.
- [x] **Migration applied** `20260716122726_on_arrival_payment_and_pickup_timing_snapshot`
  (additive/safe): `OnArrivalPayment` enum; `Tour.onArrivalPayment` (NOT NULL default `CARD_OR_CASH`);
  `Booking.onArrivalPayment` + `pickupMinutesPrior` + `pickupWindowStart` + `pickupWindowEnd`
  (all nullable snapshots). **925 tests / 44 suites green.**
- [x] **Icons ported - glyphs gone, LD20 satisfied (2026-07-16).**
  - **Structure + copy: MATCH.** Every wireframe block is present (`How to pay the rest`,
    `A note from {operatorName}`, `Cancel for a full refund up to`, `Browse all …`, `Ends at:`,
    `Duration:`, `Guests:`), and the money-row logic now matches (fixed above).
  - The wireframe draws **14 `<svg>` sites = 10 unique icons** (the shield-check repeats across the
    5 payment-model variants, which collapse to one tokenized site). All 10 are now extracted
    verbatim into `mail/templates/icons/*.svg` (**repo = source of truth**), and the template's
    **10 glyph sites are gone** (9 known + `◇`, the anti-fraud shield, missed by the first sweep).
  - **DELIBERATE DEVIATION - SVG is NOT deliverable in email (founder-approved 2026-07-16).** Gmail
    strips `<svg>` outright; Outlook's Word engine never supported it. Shipping the wireframe's
    inline SVG verbatim would send blank gutters to most travellers. Icons are therefore rasterized
    by **Cloudinary (`f_png`)** and referenced as `<img>`. Visually identical, renders everywhere.
    The wireframe is a *browser* mockup, so this was never visible in it.
  - Delivery: one `{emailIconBase}` token =
    `https://res.cloudinary.com/<cloud>/image/upload/f_png,w_34/islandtours/email/icons`; every icon
    delivered at 34px and displayed at its wireframe size (16/17px). Source SVGs are authored at 4x
    so Cloudinary always **downscales** (an upscaled raster would be soft). `alt=""` + fixed 26px
    gutter cells so Outlook's default image-blocking never collapses the layout.
  - Republish with `pnpm email:icons:upload` (idempotent: `overwrite` + `invalidate`, so the
    template URLs never change). Preview with `pnpm email:preview [paymentModel]`.
  - Verified: PNGs return `200 image/png 34x34` and rasterize correctly (pin, globe, hourglass,
    users, green check inspected).
- [x] **Two orphan-icon bugs fixed** (found by the new template spec). The icon cells sat OUTSIDE
  their `[IF]`, so a booking with no end point / duration / language / note would have emailed an
  icon beside blank space; the `[IF operatorNote]` wrapped only the heading, so a booking with no
  note rendered an **empty blue card**. Both now wrap the whole `<tr>`, per the wireframe build note
  *"pickup vs meeting point, duration, special requests, what-to-bring all render or hide per booking"*.
- [x] **Brand bar is now the real logo, sourced from settings** (founder-approved 2026-07-16). The
  wireframe's brand bar is a **text wordmark, not an image** (the wireframe has **zero `<img>`**), so
  using the real logo is itself a deliberate deviation. Renders
  `[IF siteLogoUrl]<img alt="Island Tours">[ELSE]<wireframe wordmark>[/IF]` - admin-swappable via
  Settings > General with no deploy, and it degrades to the wordmark when Outlook blocks images.
- [x] **Template spec added** - `booking-confirmation-email.template.spec.ts` (13 tests) renders the
  **real shipped template** and asserts: every token resolves for **all 5 payment models**; no
  leftover `[IF]`/`{token}`; **zero `<svg>` and zero glyphs**; all 10 icons render as Cloudinary PNG
  `<img alt="">`; each optional row hides **together with its icon**; logo/wordmark both branches.
- [ ] Other wireframe build-note rules to honour when wiring (from the wireframe's own notes):
  **times 24-hour across all locales** (note: the TYP renders 12-hour - the email rule differs);
  currency/date locale-formatted (USD for EN/ZH, EUR for NL/DE/FR/ES/PT); `How to pay the rest` +
  the anti-fraud line are the **C2 anti-phishing mitigation** and must stay **above the fold of the
  payment area**, never in the footer; cancel is a **tokenized link** to a request form, never a raw
  one-click cancel (ties to B3); hero image `alt` = tour name; max 600px single column.
#### C6 - wiring complete (2026-07-16). 1024 tests / 48 suites green.

The template is **live**: `mail.service.ts` renders the locked HTML and the lean
`booking-confirmation.template.ts` is gone. TYP resend picks it up automatically (same code path).

- [x] **Reserve now snapshots the 4 remaining fields** (rule #21, never retroactive):
  `onArrivalPayment` (null unless `paymentModel = ON_ARRIVAL`), `pickupMinutesPrior`,
  `pickupWindowStart`, `pickupWindowEnd`. `loadContext`'s `pickupAddress` local became a
  `PickupSnapshot`. Pickup TIMING is snapshotted, never joined live: the email states a pickup time,
  so a later edit to the `PickupLocation` must not rewrite what a confirmed traveler was told (§17).
- [x] **Token context = `bookings/booking-email.context.ts`, a PURE function** (46 tokens + 3
  condition-only fields). `BookingsService.assembleConfirmationContext` does the I/O; the assembly is
  DB-free so every wireframe rule is unit-testable. **Deliberately render-agnostic** - if C4 ports to
  React Email, only the render step changes, the context survives.
- [x] **The loop is closed by a test**: `booking-email.context.spec.ts` renders the REAL shipped
  template with the REAL builder output and asserts `findUnresolvedTokens() === []` for **all 5
  payment models** plus a minimal booking. A forgotten token now fails CI, not an inbox.
- [x] **Dashboard field for `Tour.onArrivalPayment`** - Details tab + create form, shown only when
  `paymentModel = ON_ARRIVAL`; Create/Update DTO + service (`onArrivalPayment` never retroactive).
- [x] **ICS endpoint built** (founder-approved): `GET /bookings/typ/:publicRef/calendar.ics`,
  `@Public`, keyed on `publicRef` like the TYP/resend (opened from a mail client, no session).
  Confirmed bookings only. `booking-ics.util.ts` is hand-rolled RFC 5545: CRLF, escaping, **75-OCTET**
  folding on UTF-8 boundaries, real UTC via `localWallClockToUtc`.
- [x] **Wireframe formatting rules honoured + tested**: times **24-hour in all 7 locales**
  (`hourCycle: 'h23'` - en-GB and zh-CN both default to 12-hour, so this was a real trap); dates/money
  locale-formatted; money always in the **charged** currency (never the locale's default - that would
  relabel a real charge); `en` -> **en-GB** (the wireframe's "22 May 2026", and master 8.3 superseded
  the tracking spec's en-US-only dates).
- [x] **Subject implements the master's <24h variant** ("You're booked for tomorrow: {tour}" /
  "today"), which doubles as the reminder for last-minute bookings since C3 fires at 24h and skips them.
- [x] **Real `text/plain` part** (`buildConfirmationEmailText`). Not optional: the old
  `html.replace(/<[^>]*>/g,'')` fallback would have dumped the template's `<style>` CSS into the body,
  and a junk text part costs real spam score - deliverability is the actual lever on the C2 mitigation.

Bugs found and fixed while wiring (each one would have shipped):

1. **`nest build` never copied the .html** - no `assets` entry, so `readFileSync` threw at startup in
   production while every test passed locally. Fixed in `nest-cli.json` (`outDir: dist/src`, matching
   the real emit layout); verified the file lands in `dist`.
2. **`Booking.customerLocale` is a free-form `String?`, not the `Locale` enum** - the compiler caught
   the whole Prisma `select` silently widening. Added `toLocale()` coercion ("en-US"/junk -> `en`).
3. **`calendarUrl` was built off `FRONTEND_URL`** - it is an API route, so it would have 404'd in
   every inbox. Now `PUBLIC_API_URL ?? BETTER_AUTH_URL` (added to `env.validate.ts` OPTIONAL +
   both `.env.example` and `.env.production.example`).
4. **en-GB renders USD as "US$220.00"** - the wireframe locks "$60.00" / "from $45".
   Fixed with `currencyDisplay: 'narrowSymbol'`, keeping locale number formatting ("€ 220,00" for nl).
5. **Redundant tour query** - `resendConfirmation` loaded the tour just for its name, which the
   context already loads. Dropped; `sendConfirmationEmail` no longer takes `tourTitle`.
6. **`render-email-preview.ts` hand-rolled its context**, so the preview could look perfect while
   production shipped something else. It now builds through the real builder.

Decisions taken while wiring (grounded, not invented):

- **`cancelUrl` -> `/cancel/{publicRef}`** per **master 6.4/C1**: "a tokenized confirmation page on
  island.tours, not a cancel-on-raw-click". **That page does not exist yet (B3)** - the link is
  correct but currently dead. B3 is now the blocking follow-up.
- **`operatorNote` renders nothing** - no per-tour/per-booking operator note is modelled. The blue
  card hides rather than inventing copy the operator never wrote.
- **Related tours** = same destination, LIVE, bookable, master **§7.2** order
  (`tier_rank ASC, quality_score DESC, id ASC`) - the same order the listing uses, so the email never
  contradicts the site. No rating is fabricated for an unreviewed tour (LD11 cold start).
- **`depositPct` is derived from the booked amounts**, not read from `Tour.depositPct` (tier-driven
  and mutable) - the snapshot is what the traveler actually paid.

#### C6 - design review round 2 (founder, 2026-07-16). 1033 tests / 48 suites green.

The founder compared the sent email against the wireframe on desktop + Gmail Android. Every gap was
real; most were compromises I made and should have surfaced instead of shipping.

- [x] **Mobile was not responsive.** The shell was a fixed `width="600"` table relying on `<style>`
  media queries - which **Gmail on Android ignores** (especially non-Gmail accounts), so it rendered
  zoomed-out. Now **fluid-hybrid**: `width:100%;max-width:600px` + an mso ghost table for Outlook
  (which ignores `max-width`). The wireframe itself uses `max-width:600px` and **no media queries** -
  it was already telling us the answer.
- [x] **Typography fell back to Arial everywhere.** The template NAMED 'Plus Jakarta Sans' but never
  loaded it. Added the wireframe's own Google Fonts `<link>` (+ `@import`); Apple Mail/iOS now match
  the design, Gmail/Outlook still fall back (they strip webfonts - unavoidable).
- [x] **What-to-bring / good-to-know were one middot-joined line**; the wireframe renders each bullet
  as its own row with an **orange marker**. Fixed properly by adding **`[EACH list]…{item}…[/EACH]`**
  to the mini-language, so the markup lives in the design-owned template rather than in TypeScript.
  An empty list is now falsy for `[IF]`, so the heading hides with it.
- [x] **"A note from {operatorName}" never rendered** - no field existed. Added
  `TourTranslation.operatorNote` (localized; migration `20260716144848_tour_translation_operator_note`,
  additive) + the full children DTO/service wiring + a **"Note to Travellers" field on the trip
  Translations tab**. Empty still hides the card.
- [x] **Deadline format** was "Wednesday, 20 May 2026 at 08:00"; the design locks
  **"Wed, 20 May 2026, 08:00"** (short weekday, comma - not `Intl`'s "at" connector). Date and time
  are now formatted separately and joined.
- [x] **Language rendered raw ISO codes** ("Language: en, es, nl") - now names via
  `Intl.DisplayNames`, localized for the reader ("English" / "Engels").
- [x] **Account line printed the raw URL** ("http://localhost:3000/bookings"); the design shows the
  label **"island.tours/bookings"**. New `{accountUrlLabel}` token (href unchanged).
- [x] **Logo enlarged** 28px -> 40px (founder).
- [x] **Related tours: same DESTINATION, not category** (founder correction mid-review). The original
  destination-scoped query was right; a category filter was tried and reverted. The block is "More
  {island} experiences" - it cross-sells the island. Comment added so it is not "fixed" again.

**Still open from this review: B3.** The cancel PAGE, the cancel MODAL, and the admin cancellation
request do not exist. The email's button already links to `/cancel/{publicRef}` per master 6.4/C1.
This is the next task.

#### C6 - design review round 3: 100% style parity, mechanically enforced (2026-07-16)

Founder: "every single style must match 100%, nothing skipped" + mobile must equal the wireframe's
own mobile render. Done by **rebuilding the template as a byte-for-byte port of the wireframe's
`<template id="email-tpl">`**, tokens/conditionals and the approved icon/img substitutions being the
only differences. 1038 tests / 48 suites green.

- **Root cause of the typography mismatch:** email clients do NOT inherit `font-family` from `<body>`
  into tables. The wireframe carries `font-family:'Plus Jakarta Sans',Arial,sans-serif` **on every
  block `<td>`** (15 sites); the first port only set it on body, so everything fell back to Arial.
- **Root cause of the mobile mismatch:** the wireframe has **no media queries and no classes** - its
  shell IS the fluid hybrid (`width="600"` attribute for Outlook + `style="width:100%;max-width:600px"`
  for everyone else), and mobile is simply the same email rendered narrower. The first port's
  media-query/class layer (and round 2's mso ghost table) were both deviations - removed; the shell
  now matches the wireframe's own mechanism exactly.
- **Style details recovered by the verbatim port:** the payment divider row above Total
  (`colspan=2 border-top`), `paid_in_full` = single green 800-weight row, `operator_full` = plain
  Total row + "Payable to {operator}. Island Tours took no payment." + **no Cancel button** (Block 9
  changes per the spec), upsell price "4.9 · $89" (no "from", zero cents stripped), lowercase design
  hex values (#9aa3b2 etc), first-icon-cell-only `width:26px`, headline without a line-height.
- **The guard that makes "100%" stay true:** the template spec now extracts EVERY `style=""`
  attribute from the wireframe's email template and asserts each appears **verbatim** in the shipped
  template (only the demo placeholder art, the canvas padding fold, and the inline-svg alignment are
  excluded, each with its reason). A designer edit to either file now fails CI on the first drifted
  byte instead of a founder screenshot.
- **Operator note management (founder question):** the note is per-tour, localized -
  `TourTranslation.operatorNote`, edited in **Dashboard > Tours > edit > Translations tab > "Note to
  Travellers"** (English tab = base copy, other locales translatable like every translation field).
  The email picks the traveller's locale with English fallback; empty hides the blue card entirely.

#### Round 4 (2026-07-16): stale-template root cause + C7 + pickup summary + B3 page. 1050 tests / 49 suites green; frontend prod build green.

- [x] **The "still not matched" screenshots were a STALE TEMPLATE, not a design bug.** The running
  dev server compiled before `watchAssets` landed in `nest-cli.json`, so its `dist` kept the OLD html
  (comma-joined lists = the plain `{whatToBring}` fallback; full-width stacked buttons = the old
  media-query layer). `dist` is rebuilt; **the dev backend must be restarted once** so asset-watching
  applies from now on.
- [x] **Gmail font: unfixable by anyone.** Gmail (web + apps) strips `<link>`, `@import`, and
  `@font-face` for every sender - no custom webfont ever renders in Gmail; Apple Mail/iOS load
  Plus Jakarta Sans from our template. The only lever is the fallback stack, and the wireframe locks
  it to Arial. Improving the fallback would first require a wireframe edit (parity test enforces it).
- [x] **C7 operator "Booking Received" email** - `operator-booking-received.template.html` reuses
  the traveller shell VERBATIM (its spec asserts the operator template introduces **zero new style
  attributes** vs the traveller one, so they can't drift apart). Per-model action copy (send link /
  collect on arrival / fully paid), guest contact, dashboard CTA. Context piggybacks on the traveller
  context builder (shared facts formatted once, in English for operators).
- [x] **Checkout: selected pickup now shows in the summary card.** Root cause: the summary is a
  SERVER-rendered node, the pickup select is client form state - they never met. Fixed with a
  minimal client bridge (`PickupLabelProvider` + a pickup-row client leaf with the server label as
  fallback), per the smallest-leaf client-boundary rule.
- [x] **B3 cancel page + modal + admin request built.**
  - Backend: `POST /bookings/typ/:publicRef/cancellation-request` (@Public, resend-grade throttle,
    optional 500-char reason). Stamps `utcCancellationRequestedAt` on the FIRST request only (refund
    eligibility is judged at the traveller's instant, gap #16); re-submits re-notify but never move
    it. Emails **ADMIN_EMAIL** (503 if unconfigured - a silently dropped refund request is the worst
    outcome); mail failure THROWS like resend. 6 new specs.
  - Frontend: locale-less `/cancel/{publicRef}` via a proxy.ts rewrite (same mechanism as the TYP),
    PPR shell + Suspense skeleton, noindex. The card mirrors the wireframe modal (title, tour · date
    line, refund note, optional textarea, "Yes, cancel booking" + "Keep my booking" back to the TYP),
    with a sent-state cross-fade and a non-CONFIRMED "nothing to cancel" state. `cancelBooking` dict
    section added in all 7 locales (EN = wireframe copy verbatim).
  - The confirmation email's Cancel button now lands on a REAL page end-to-end.

#### Round 5 (2026-07-16): mobile spacing, master-6.4 cancel page, 3-recipient cancellation emails. 1056 tests / 50 suites green; frontend prod build green.

- [x] **Mobile email breathing room** (founder request). One media query on all email templates:
  outer gutter 26/16 -> 12/6, cell sides 28 -> 16 on <=480px (`.it-shell-pad` / `.it-cell`). This is
  the ONLY media query and those are the ONLY classes - the parity guards now assert exactly that,
  so it cannot grow silently. Clients that ignore style blocks keep the wireframe spacing.
- [x] **Gmail font: closed as impossible-by-platform.** Gmail (web + apps) and Outlook-Windows strip
  `<link>`/`@import`/`@font-face` for every sender on the internet; NO email renders a custom font
  there. Apple Mail / iOS / Outlook-Mac load Plus Jakarta Sans from our template. Documented in the
  template head; the fallback is the wireframe's own Arial stack. A closer-metric fallback (e.g.
  Segoe UI) would need a WIREFRAME edit first - the parity test enforces the stack.
- [x] **Cancel page now matches master 6.4 exactly**: title "Cancel {tour}, {date}?", booking ref
  line, green "Refund {amount}" chip rendered ONLY when something was paid to Island Tours (C23),
  refund-method line from the trust-modal locked copy; AFTER the window the page shows the locked
  after-window copy and no request button. Copy in all 7 locales.
- [x] **Cancellation request now emails all three parties** (founder extension of the master flow):
  admin work-item (unchanged, throws on failure), traveller ack "we got your request - terms are
  judged from this moment" (their locale's date format), operator heads-up "no action needed yet"
  (company inbox first). The ack/notice pair is best-effort (the admin already has the request).
  Both ride a new shared `booking-notice.template.html` whose spec asserts **zero new style
  attributes** vs the traveller shell. The FINAL confirmation emails (after the admin marks
  cancelled, with the locked "on its way back within 3 to 5 business days" copy, C23-aware) belong
  to CP6/refund execution - not built yet.
- [x] **Master B.34 RESOLVES the accountUrl conflict** (was open item 1 below): accounts ARE
  auto-created with email + booking-reference login ("No account area" was superseded; Arnav
  confirmed). The email's `island.tours/bookings` line is correct. The lookup LOGIN page itself is
  still to build (B3 leftover).

**Open conflicts for the founder (do not silently resolve):**

1. **`accountUrl` vs master C1.** The template's footer says "your booking details, history, and
   invoice are always in your Island Tours account at {accountUrl}", but master C1 states **"No
   account area in v1"** and asks instead for "a lightweight booking-lookup fallback (booking
   reference + email), not a full account area, for lost emails". `/bookings` DOES exist in the code
   (built after the master was written). Currently pointing at `{FRONTEND_URL}/bookings`.
2. **Two Cloudinary accounts** (unchanged): `SiteInfo.logo` -> `djqinkh2c`, `backend/.env` ->
   `dsfms7jb4`.
3. **`start:prod` is `node dist/main`, but the build emits `dist/src/main.js`** (pre-existing, not
   introduced here) - production start would fail. Flagged, not fixed.

#### TYP correctness fixes (2026-07-16, founder-spotted)

- [x] **"4 guestss"** - `getThankYou` returned the PLURAL label `'Guests'` for age-band-less
  (UNIT-priced) parties while every other label is singular (`'Adult'`, `'Traveler'`). The client
  pluralises against the quantity, so it double-pluralised. **Contract: the backend sends the
  SINGULAR unit; the client pluralises.** Fixed to `'Guest'`.
  - `getThankYou` had **ZERO test coverage** - that is why it shipped. Added 3 party-line specs
    (singular Guest fallback / age-band grouping / unknown-band `'Traveler'` fallback).
  - Also hardened `fmtParty`: age-band labels are **operator-authored free text**, so an operator
    naming a band "Adults" would have produced "2 adultss" from a source the backend cannot fix.
    `pluralise()` now skips a label already ending in 's' (never worse than the old `${base}s`).
- [x] **"Card payment only" removed from operator_link** (founder-approved 2026-07-16). It was
  hardcoded in `thank-you-summary.tsx`, driven by **no data**, and present in **no spec** - not the
  master, not the email wireframe, and not the TYP Figma element list in
  `BOOKING-AND-PAYMENT-DATA.md` §8.2. It asserted how a **third party** collects a balance that runs
  on the operator's own rails, which **master B.85** forbids on *any* surface: *"the balance runs on
  the operator's own rails and the platform cannot verify it, so the reminder (and any surface) uses
  a neutral balance line for operator_link."* The card/cash statement is only legitimate on
  `on_arrival`, where `Tour.onArrivalPayment` actually tells us. Dead `cardOnly` key dropped from all
  7 locales.

#### TYP "Resend email" (2026-07-16)

- [x] **`POST /bookings/typ/:publicRef/resend`** - the TYP link was a demo stub
  (*"the transactional resend endpoint lands with the booking module"*). Now live end to end:
  service `resendConfirmation()` + client `resendConfirmationEmail()` + real pending/sent/failed
  states on `ResendEmailLine` (copy added to **all 7 locales**: `emailResending`,
  `emailResendFailed`). 8 service tests; **958 tests / 46 suites green**.
- **Security shape (important):** `@Public` and keyed on the unguessable `publicRef` (master rule
  #7), and the **recipient is never accepted from the caller** - it sends only to the
  `contactEmail` stored on the booking. That is what stops a public route being an open relay;
  worst case is a traveler's own inbox. CONFIRMED-only, so a CANCELLED booking can never re-emit
  "You're booked". Throttled to **1/10s, 3/min, 10/hr per IP** (the global tiers - 60/s, 300/min,
  3000/hr - are sized for dashboard page loads and are far too loose for a route that sends mail).
  Verified live: unknown ref 404s, a second call inside 10s 429s, the window recovers.
- **MUST stay a browser call.** `skipIf: isTrustedInternalOrigin` in AuthModule exempts the internal
  API secret from throttling, so routing this through SSR/`publicFetch` would silently strip every
  limit above. Documented at both call sites.
- Confirm-time sends still **swallow** email failures (the money is already captured - an email-provider
  outage must never fail a paid booking); the resend path **rethrows**, because the traveler asked and
  a silent success would be a lie. One `rethrow` flag, both behaviours tested.
- [ ] **KNOWN + EXPECTED: resend still sends the OLD template.** It reuses
  `mail.service.sendBookingConfirmationEmail` -> `booking-confirmation.template.ts`. Swapping onto
  the new wireframe HTML template is **task #54 (C6 wiring)**, which is the next job. Resend will
  pick up the new template automatically the moment #54 lands - no change needed here.

#### Media + WhatsApp (2026-07-16)

- [x] **Cloudinary is now namespaced under `islandtours/`.** `CLOUDINARY_ROOT_FOLDER` in
  `media-gallery/cloudinary.service.ts`; uploads land in `islandtours/users/<userId>`, email icons in
  `islandtours/email/icons`. Both the server upload and the **signed direct-upload params** derive the
  folder from one private `userFolder()` helper - the signature covers `folder`, so any drift between
  the two would fail verification. Existing assets keep resolving by their stored `public_id`; this
  only governs NEW uploads.
- [x] **`GET /settings/public/site`** (`@Public`) - the public site had **no way to read settings**
  (`GET /settings/site` needs VIEW_SETTINGS), which is why `faq-section.tsx` shipped a dead
  `href='#'` WhatsApp button. Returns a hand-picked 8-field projection via explicit `select:`; the
  same controller also serves Stripe/Mollie, so this must never be widened to the row.
  `whatsappNumber` is nulled when `enableWhatsappChat` is false. Read-only (`findFirst`, not the
  dashboard's `upsert`) - an anonymous GET must never write.
- [x] **`site-info` cache tag** + `settings/site` mutation mapping, so a Settings > General save busts
  the public `'use cache'` layer instead of waiting out `cacheLife('days')`. Settings previously had
  **no** tag mapping (correct while it was dashboard-only).
- [x] **`buildWhatsappUrl()` on both sides** (`common/utils/whatsapp.util.ts` + `lib/whatsapp.ts`,
  mirrored like rbac.ts) - master 6.6's single `https://wa.me/{number}?text={greeting}` pattern.
  Normalizes to bare digits (wa.me rejects `+`/spaces: `+8801913509868` -> `8801913509868`), returns
  **null** when disabled/unusable so callers hide the surface rather than render a dead button.
  12 tests.
- [x] **NeedHelp (`faq-section.tsx`) wired** - the dead `href='#'` is now a live deep link, hidden
  entirely when the chat is off. Fetches settings itself (it renders from home / destination /
  category / collection / hub - threading one value through five callers for one button is noise);
  all five confirmed server components.
- [ ] **Remaining 6.6 placements:** global footer, tour-description inline links, error states.
  6.6 **excludes**: the widget trust strip, the trust modals, and the commit moment generally.
- [ ] **AUDIT (report, do not unilaterally strip):** `category-trust-strip.tsx` and
  `login/traveler-login.tsx` + `operator-apply.tsx` carry hardcoded WhatsApp. `traveler-login` is
  checkout takeover chrome = arguably the **commit moment** 6.6 excludes; `category-trust-strip` is a
  *category page* strip, **not** the widget trust strip, so it likely stays but needs wiring off
  settings.
- [ ] **OPEN:** the `?text={greeting}` half of the 6.6 pattern needs real copy in **7 locales**.
  Currently linking bare `wa.me/{number}` (valid; the helper takes an optional greeting) rather than
  machine-translating founder-facing copy.
- [ ] **FLAG - two Cloudinary accounts are live.** `SiteInfo.logo` currently points at cloud
  **`djqinkh2c`** (`users/16iqHft1…`, uploaded under an older env), but `backend/.env`
  `CLOUDINARY_CLOUD_NAME` is now **`dsfms7jb4`** - where the new email icons and the founder's
  `logo_oizw6t.png` live. Old absolute URLs keep working, so nothing is broken, but new uploads and
  old assets are now split across two accounts. Decide whether to migrate or leave.

#### C6 - defects found in the locked template (FIXED 2026-07-16)

- [x] **One unclosed `[IF`** (28 `[IF` vs 27 `[/IF]`; depth trace ended at 1). The renderer's test
  pinpointed it: `[IF paymentModel = operator_link OR on_arrival]` opened **inside a `<td>`** on the
  deposit row and never closed.
- [x] **`[ELSEIF]` is not in the language** - the template used
  `[IF … operator_link]Balance due[ELSEIF … on_arrival]Balance due on arrival[/IF]`, but `[ELSEIF]`
  appears **nowhere in the wireframe** and nothing implements it. Rewritten as a nested `[ELSE]`
  inside the `operator_link OR on_arrival` block (the else-branch *is* on_arrival), so no new
  construct was needed.
- [x] **Money rows conditioned only the LABEL, not the row.** `paid_in_full`/`operator_full` would
  have rendered a **bare `{depositAmount}` with no label**. Per the wireframe the whole `<tr>` must
  vanish: `operator_link` = deposit/Balance due/Total · `on_arrival` = deposit/Balance due on
  arrival/Total · `paid_in_full` = **Paid in full only** · `operator_full` = **Total only**. Now
  wrapped at `<tr>` level and asserted by 4 tests.
- The **wireframe and the template are different artifacts** and must not be confused:
  `island-tours-booking-confirmation-email-wireframe.html` is the **visual mockup** (zero tokens - it
  lays every payment-model variant out side by side as the design reference);
  `booking-confirmation-email.template.html` is the **tokenized** template that actually renders.
- Tokens that are **optional and hide cleanly** when absent (no action needed): `endPoint`,
  `operatorNote`, `tourLanguage`, `duration`, `specialRequests`.

### D. Async / queue hardening (0/8)
- [ ] D1 Transactional outbox (`OutboxEvent` written in booking txn; relay -> BullMQ)
- [ ] D2 Hold-expiry sweeper wiring (repeatable job drives `expireStaleHolds`)
- [ ] D3 Confirmation-email job (queued, retry + backoff) instead of inline
- [ ] D4 CAPI conversion job (queued, idempotent by event id)
- [ ] D5 Scheduled `paid_in_full` payout job (delayed) - pairs with A4/A5
- [ ] D6 Pre-tour reminder job (delayed) - pairs with C3
- [ ] D7 Affiliate postback job (delayed, approve after window)
- [ ] D8 Retries + exponential backoff, keep failed jobs (no silent drop)

### E. Tracking / analytics (0/8)
- [ ] E1 `booking_complete` browser push on TYP (once; prod-only guard)
- [ ] E2 Fire-point reconciliation: add `conversion_pushed_at` guard (separate from `conversion_fired_at`)
- [x] **E3 Real-TYP payload** (2026-07-16). Backend `getThankYou` + `ThankYouResponseDto` expanded
  (guest name/phone, party grouped by age band, deposit/balance + paymentModel, card brand/last4,
  durationMinutes, cancellationHours, computed free-cancel deadline local+UTC, operator contact via
  `companyInfo` join) - **no migration**. Frontend `getThankYouBooking` now calls `getTypByRef` and
  composes every label locale-side; demo payload deleted; cross-sell fetches **real** destination
  tours (`getThankYouRelatedTours`, booked tour excluded). Verified live on
  `4ce3c7c1-…`: real guest/operator/ref/party/money render, demo strings gone, deadline math
  correct (start `2026-07-24T13:30` - 48h = `2026-07-22T13:30`).
  `Code:` `bookings.service.ts:getThankYou`, `dto/booking.dto.ts`, `lib/thank-you/thank-you.ts`,
  `lib/api/public/bookings.ts`, TYP `page.tsx`
- [ ] E4 Attribution captured at reserve (utm/gclid/gbraid/wbraid/fbclid + affiliate)
- [ ] E5 Server-side PII hashing (SHA-256 email/phone/name/address) for EC/AM
- [ ] E6 Meta CAPI (server, parallel to Pixel, dedup by shared event id) - needs external creds
- [ ] E7 GTM container + 4-tag fan-out - needs GTM container id
- [ ] E8 Consent Mode v2 + CMP (EEA denied default) - needs CMP choice

### F. Frontend widget / checkout (0/6)
- [ ] F1 Pickup selection in widget (mandatory when `pickupRequired`)
- [ ] F2 Add-ons render + totals + payload (PER_PERSON vs FLAT, maxQuantity)
- [ ] F3 Timing affordances (instantConfirmation, bookingType PRIVATE/SHARED, bookingCutoffMinutes)
- [ ] F4 Consume server quote for persisted totals (client math = estimate only)
- [ ] F5 Swap TYP `getThankYouBooking` to real `GET /bookings/typ/:publicRef` (pairs with E3)
- [ ] F6 i18n / motion / Tailwind compliance pass on new copy

### G. Correctness / misc (0/6)
- [ ] G1 Mollie webhook confirm (currently ledger-only stub)
- [ ] G2 Hold-expiry cron (pairs with D2)
- [ ] G3 Discount/coupon engine (deferred - re-add validated when Coupon engine ships)
- [ ] G4 Currency-change guard (block/relabel `defaultCurrency` once prices exist)
- [ ] G5 Real FX provider impl (Stripe FX Quotes) behind existing seam
- [x] **G6 Backend suite green** (2026-07-16). `bookings.service.spec.ts` mocks swapped from
  `$executeRaw` to `departure.updateMany`/`update` (`$executeRaw` is gone from service code entirely);
  `rawSqlTexts` SQL-substring matching replaced with `claimCalls`/`releaseCalls` asserting real Prisma
  args (stronger: exclusive claim now asserts `where.bookedCount===0 && data.bookedCount===capacity`);
  added the missing in-txn capacity read to `setupUnitReserveContext`. **905 tests / 43 suites pass.**

---

## Critical path

Ordered so each step de-risks the next and nothing produces wrong money.

- [ ] **1. Real-TYP data + fire-point reconciliation** (E3 -> E1 -> E2) - foundational; unblocks the browser push. *(TRK2 resume point.)*
- [ ] **2. Operator-balance email + switch to Resend** (C1 + C4) - completes the two-email requirement.
- [ ] **3. Hold-expiry sweeper wiring** (D2 / G2) - stops phantom sold-outs; small.
- [ ] **4. Settlement ledger** (A1-A3) - write one row per booking at confirm.
- [ ] **5. Scheduled `paid_in_full` payout after cancel window** (A4/A5, D5) - depends on 4.
- [ ] **6. Real refund execution** (B1-B2) - actual Stripe refund + REFUND row.
- [ ] **7. Outbox + queued idempotent jobs** (D1, D3-D4, D8) - hardening once jobs exist.
- [ ] **8. Tracking fan-out** (E5-E8) - PII hashing, then GTM/CAPI/Consent.
- [ ] **9. Real FX provider** (G5) - swap the static provider for live rates.

Plus, opportunistically: G1 (Mollie confirm), G4 (currency guard), G6 (spec green), B3/B4, C2/C3, E4, F1-F6.

---

## Locked decisions

- **TYP URL token = `publicRef` UUID** (founder, 2026-07-16). Confirmed correct as built and
  verified live: `http://localhost:3000/sint-maarten/thank-you/4ce3c7c1-3af9-4aeb-ac1c-bbe84b11eeae`
  - locale-less, destination segment, unguessable UUID. Master rules #7/#16.
  - `publicRef` (UUID, `@unique @default(uuid())`) = URL token only. **Never** the DB `id`, and
    never the human ref.
  - `displayRef` (`IT-YYYY-XXXXXXXX`) = customer-facing reference, shown **in page content + email**,
    never in the URL (it is sequential/guessable -> enumeration risk).
  - `id` (DB PK, client-suppliable as the reserve idempotency key) = authenticated mutations only
    (`PATCH /bookings/:id`, `POST /payments/bookings/:id/intent`).
  - **Verified as built, no fix needed.** The TYP "looks wrong" only because the page still renders
    the demo payload - fixed by E3 (step 1) below.

---

## Blocked on your input

- **Email provider (step 2):** confirm **Resend** (with Postmark fallback) is what we wire for C1/C4.
- **Tracking creds (step 8):** Meta Pixel id + CAPI access token (E6); GTM container id (E7); CMP
  choice - Cookiebot vs Iubenda (E8).

---

## Execution plan - start here after a session/plan switch

> Resume with `claude --continue` from the repo root, then work this list top-down. Each step:
> implement -> verify -> tick this doc + the matching checklist line -> update the task -> commit
> **from the ROOT repo** (never `backend/`).

### Realistic scope check

The full ~45-item list is **multi-day**, not one night: settlement + payouts + real refunds + the
outbox/queue layer are substantial, and the tracking fan-out (E6-E8) is **hard-blocked** on external
creds. What IS achievable in one focused session is the **"a real traveler's booking works
end-to-end and reports correctly"** milestone - steps 1-3 below.

### Tonight's target (achievable, unblocked)

- [ ] **Step 1 - Real TYP + fire-point** (tasks #40 -> #39 -> #42)
      1. Backend: widen `getThankYou` + `ThankYouResponseDto` (`bookings.service.ts:908`,
         `dto/booking.dto.ts`). The `Booking` row already has guest name, deposit/balance, card
         brand/last4, dates, pickup - **no migration needed**. Add joins: `operator`
         (`companyName`/`contactEmail`/`contactPhone`) + `tour` (`durationMinutesFrom`,
         `cancellationHours`). Compute `freeCancellationDeadline = tourStartDateTime - cancellationHours`.
      2. Frontend: wire `lib/thank-you/thank-you.ts:getThankYouBooking` to `getTypByRef`
         (`lib/api/public/bookings.ts` - already built), map -> rich `ThankYouBooking`, delete the
         demo payload. Keep `DEMO_PUBLIC_REF` only for `generateStaticParams`.
      3. Add `conversion_pushed_at` (migration) as a **separate** browser-push guard - do NOT reuse
         `conversion_fired_at` (already set at webhook-confirm, so a push gated on it would never
         fire). Mark-first on TYP render; `getThankYou` must return `conversion` **once**.
      4. Add the `booking_complete` dataLayer push on TYP (prod-only guard, EUR `commissionAmount`,
         never GMV - rule #22).
      - Verify: real booking -> TYP shows that booking's real data; refresh does **not** double-fire.

- [ ] **Step 2 - Operator-balance email + Resend** (task #46) - *needs your Resend confirmation*
- [ ] **Step 3 - Hold-expiry sweeper** (task #47) - small; `expireStaleHolds()` already exists, just
      needs a repeatable job. Stops phantom sold-outs.
- [ ] **Step 3.5 - Make the suite green** (task #53 / G6): swap `bookings.service.spec.ts`
      `$executeRaw` mocks -> `departure.updateMany`/`update` (red since the refactor). Do this
      before any commit that touches bookings.

### Next session (not tonight)

- [ ] Step 4 - Settlement ledger (#48) -> Step 5 - scheduled payout (#49, blocked by #48)
- [ ] Step 6 - Real refund execution (#50)
- [ ] Step 7 - Outbox + queued jobs (#51)
- [ ] Step 8 - Tracking fan-out (#43-#45) - **blocked on creds**
- [ ] Step 9 - Real FX provider (#53 / G5)
- [ ] Group F - widget gaps (#52)

---

## Change log

- 2026-07-16 - Doc created. Baseline captured at ROOT `21efe49`. Nothing ticked yet.
- 2026-07-16 - **TYP URL token decision locked = `publicRef` UUID** (verified live; no fix needed -
  the perceived "id in URL" is the correct unguessable token). Added execution plan + scope check.
- 2026-07-16 - **E3 (real-TYP data) DONE + verified live.** Step 1 is now E1+E2 only. Two findings
  raised while verifying (see "Open findings" below).

---

## Open findings (raised 2026-07-16 while verifying E3)

- [x] **Card brand/last4 null on every paid booking - ROOT-CAUSED + FIXED 2026-07-16.** Not a data
  quirk: `expandedCharge(intent)` only read an *already-expanded* charge, but **Stripe webhooks never
  expand nested objects** - a succeeded `payment_intent` carries `latest_charge` as a plain **string
  id**, and the legacy `intent.charges.data[0]` list no longer exists on current API versions. So it
  returned `undefined` -> `billing` was `undefined` -> `confirmFromPayment` wrote null brand/last4 on
  **every** booking, and the TYP card line was always blank. Fixed by adding
  `StripeService.retrieveCharge()` + `PaymentsService.resolveCharge()`, which fetches the charge when
  `latest_charge` is a string (best-effort: a failed lookup logs and still confirms - the snapshot must
  never block a confirmation). The old spec had **baked the bug in** (`confirmFromPayment('b1', undefined)`
  was the asserted expectation); replaced with 3 real regression tests (string id -> fetch + snapshot;
  pre-expanded -> no fetch; lookup fails -> still confirms). `Code:` `payments.service.ts:resolveCharge`,
  `stripe.service.ts:retrieveCharge`
  > Note: existing bookings (incl. `4ce3c7c1-…`) keep their null snapshot - the fix only applies to new
  > webhook deliveries. Make a fresh test booking to see the card line populate.
- [ ] **English date punctuation vs Figma (cosmetic, needs a call).** Figma demo strings were
  `Tue 28 May, 2026` / `Sunday, 26 May`. Intl `en-GB` produces `Fri, 24 Jul 2026` /
  `Wednesday 22 July` - correct day-then-month **order**, but the comma sits after the weekday
  rather than before the year. Matching Figma exactly needs a hand-rolled formatter, which would
  break the other 6 locales, so it was NOT silently hand-rolled. Decide: keep locale-correct Intl,
  or hand-compose for `en` only.

---

## Round 6 (2026-07-16, post-compaction) - price anchor + dashboard ops pages

Founder queued two items ahead of the tracking push (#42/#39):

- [x] **PRICE1 - per-person "From" anchor = DEFAULT age band, not cheapest.** Widget + cards showed
  "From EUR41" (child band) while the dashboard default band is Adult EUR69. Founder rule: the
  anchor is the default (adult) band; cheapest participant band only when no default is flagged;
  basePrice when no bands. Changed `recomputePriceFrom` (orderBy `isDefault DESC, price ASC`),
  demo-seed mirror (`prisma/demo/tours.ts`), dashboard Pricing-tab copy, spec (70 tours tests
  green); existing rows backfilled via migration `20260716165001_reanchor_price_from_on_default_band`
  (verified: priceFrom = default-band price, cheapest ignored). Frontend reads `priceFrom` as-is -
  zero client changes. NOTE: master field-table line "'from' price on cards is the lowest
  applicable" is SUPERSEDED by this founder decision; master wording needs an update.
- [x] **DASH1 - `/dashboard/bookings` list page.** Backend `GET /bookings` extended (`search` on
  refs/guest/tour, `paymentModel`, `cancellationRequested`; `BookingListItemDto` adds tourName,
  contact, partySize, createdAt, freeCancelDeadline + `requestedInFreeWindow` judged at the
  REQUEST instant per C23). Frontend TanStack table mirroring the trips table (debounced search,
  status/model selects, travel-date range inputs, columns toggle, server pagination); commission
  columns ADMIN-only (rule #22 snapshot); row actions = details dialog, copy ref, admin
  "Mark cancelled" (ConfirmDialog -> `POST /bookings/:id/cancel`, EDIT_BOOKING-gated, refund
  verdict shown in the confirm copy). `Code:` `components/dashboard/bookings/*`,
  `lib/api/bookings-dashboard.ts`, `hooks/bookings/use-bookings.ts`, `types/booking.ts`.
- [x] **DASH2 - `/dashboard/payments` list page.** NEW backend `GET /payments`
  (`@RequirePermissions(VIEW_PAYMENTS)`, operator scoping via `booking.operatorId`, filters
  status/kind/provider/search/created-date-range) + same table pattern (amount+kind, provider/
  method + intent id, booking context columns). `Code:` `payments.service.ts:list`,
  `components/dashboard/payments/*`, `hooks/payments/use-payments.ts`.
- [x] **DASH3 - `/dashboard/cancellation-requests` queue.** Bookings table in queue mode
  (`cancellationRequested=true`, OLDEST request first) with Requested / Free-window / Refund-due
  columns. This is master 6.4's "admin marks cancelled" done properly (master v1 literally says
  "admin marks cancelled in Supabase"; the queue replaces raw DB edits - C23 copy + 3-party
  notification flow unchanged; REAL refund money movement stays CP6). New nav item + page gated
  `VIEW_BOOKINGS`; TOUR_OPERATOR granted `VIEW_BOOKINGS` in BOTH role configs (master roles doc:
  operators "view own bookings"; scoping is server-side).
- **Master answers recorded (founder asked mid-build):** admin visibility = the
  `VIEW_BOOKINGS`/`MANAGE_BOOKINGS` + `VIEW_PAYMENTS` permission tier (roles doc table); the
  master has NO separate "commission listing" page - commission is the per-booking snapshot
  (rule #22) surfaced as admin-only columns on Bookings, and the true commission/settlement
  REPORT arrives with the CP4 settlements ledger.
- Verified: backend 1063 tests / 50 suites green (new `list (dashboard)` specs in both services);
  frontend `pnpm build` green.

- [x] **PRICE2 - widget shows exact decimal prices.** The card rounded every amount to whole units
  (Senior $63.75 rendered "$64" in the From header + band labels while the quote total said
  $63.75). Fixed: `conv` in `lib/tours/booking.ts` now keeps cents (`*100/100`); the
  `money()` formatter in `booking-store.ts` and `formatCheckoutMoney` show 2 fraction digits when
  fractional (whole prices stay "$75"); the optimistic deposit estimate in `booking-store.ts` +
  `lib/checkout/checkout.ts` rounds to cents, not whole units. Founder then extended the rule to
  the TOUR CARDS too ("why you showing rounded value in tour card and booking widget"): the central
  `formatPriceFrom` + `resolveDisplayPrice` (`lib/currency/current.ts`) now render the exact
  backend price (cents when fractional, bare when whole) - every card surface (listing, wishlist,
  search typeahead, collection, hub picks/compare, dashboard trip columns) flows through them.
  NOTE: this supersedes the Figma whole-number "From $120" card anchor; whole prices still render
  whole, so the design only changes for genuinely fractional prices.

- [x] **PRICE3 - widget re-prices live on footer currency switch.** The footer selector sets the
  currency cookie + `router.refresh()`; server components re-rendered in the new currency but the
  widget's per-card zustand store (created once in `BookingStoreProvider`) kept the old price model
  until a hard reload. Fixed in `contexts/booking-context.tsx`: an effect syncs
  `data`/`currency`/band config into the live store when the shopper currency changes - the
  traveler's date/time/party selection survives (band ids are stable) and the stale quote is
  dropped, so `useBookingQuote` re-quotes in the new currency automatically.

Order per founder: PRICE1 first, then the listing pages, then resume #42/#39 tracking.

- [x] **DASH polish (same day):** native date inputs in the Bookings/Payments/Cancellation-Requests
  toolbars replaced with the shared shadcn `DatePickerField` (Calendar-in-Popover, clearable);
  toolbar control widths aligned to the tours page exactly (search `flex-1 min-w-36`, selects
  `w-32`/`w-44`, date pickers `w-36`).

---

## NEXT - serial execution order (2026-07-16, after PRICE1-3 + DASH1-3; follow top to bottom)

Dependency-ordered plan to clear every remaining `[ ]`/`[~]` across BOOKING-CHECKLIST,
BOOKING-WIDGET-CHECKLIST, and this doc. Blocked-on-founder items are marked; skip and continue.

**Phase A - Tracking & conversion (resume point; tasks #42/#39, #43-#45)**
1. A1 = #42+#39: `booking_complete` dataLayer push on the TYP, fired ONCE per booking - server-side
   `conversion_pushed_at` guard (fire-point reconciliation), value = EUR `commission_amount`
   (rule #22, CONFIRMED + non-null commission only; corrupt -> render error, no push).
2. A2: click-id (gclid/gbraid/wbraid/fbclid) + UTM capture at reserve (columns exist, flaw 9) +
   decide the `gclid` vs generic `clickId` column question.
3. A3 = #43: server-side PII hashing (SHA-256 email/phone) for Enhanced Conversions / Advanced
   Matching payloads.
4. A4 = #44: Meta CAPI server-side send (dedup by event id; inline first, queued in B6).
5. A5 = #45: GTM fan-out (4 tags) + Consent Mode v2 - BLOCKED on founder: GTM container id,
   Pixel id, CMP choice (Cookiebot/Iubenda).

**Phase B - Money correctness (CP2-CP7; tasks #41/#46-#51)**
6. B1 = CP2: operator-balance email on `operator_link` (C1, names operator + secure balance link)
   + C5 verify never-name-operator-pre-payment in template copy; Resend provider switch (C4) is
   BLOCKED on founder confirm.
7. B2 = CP3: hold-expiry sweeper (BullMQ repeatable -> `expireStaleHolds`) + the
   payment-succeeds-after-expiry reconciliation branch in `confirmFromPayment`.
8. B3 = CP4: `Settlement` model + one row per booking at confirmation + `net_position` sign
   convention (deposit models net ~0).
9. B4 = CP5: scheduled `paid_in_full` payout after the cancel window (delayed job, clawback-safe,
   RECORDED -> PAID_OUT).
10. B5 = CP6: REAL Stripe refund execution + `REFUND` Payment row + payment-model-aware
    `computeRefund` + the locked "3 to 5 business days" C23-aware FINAL cancellation-confirmation
    emails (traveller + operator) - wire onto the new `/dashboard/cancellation-requests` Mark
    cancelled action.
11. B6 = CP7: transactional outbox (`OutboxEvent` in the booking tx) + queued idempotent jobs
    (confirmation email, CAPI, sweeper, payout, pre-tour reminder) with retry/backoff.

**Phase C - Product gaps (widget §3 + master 6.4/6.6; tasks #52, #59, #60)**
12. C1: widget add-ons (PER_PERSON x party / FLAT once, maxQuantity) into totals + reserve payload.
13. C2: `bookingCutoffMinutes` consumed in the widget (server already computes it);
    `pickupRequired` enforcement + pickup surfacing widget-side; `instantConfirmation` +
    `bookingType` affordances.
14. C3: B.34 booking-lookup login (email + `display_ref`, rate-limited) - the account fallback
    half of master 6.4.
15. C4 = WA2/WA3: WhatsApp placements per master 6.6 (footer, tour description, error states) +
    email footer CTA/anti-fraud line, `?text={greeting}` x7 locales.

**Phase D - Correctness/misc tail (task #53 + checklist leftovers)**
16. D1: real FX provider implementation behind the ready seam (Stripe FX Quotes) + currency-change
    guard on `defaultCurrency`.
17. D2: discount subtracted from totals (flaw 2 coupon engine), age-restriction validation
    completion, quote-currency 5C (#28).
18. D3: invoice attachment (C2), pre-tour reminder content (C3; job ships in B6), operator
    non-payment forfeit flow (guide §15), Mollie webhook confirm (Mollie stays block-commented).

Blocked-on-founder ledger: GTM/Pixel/CMP creds (A5), Resend confirm (B1), two Cloudinary
accounts, `start:prod` path bug, Segoe-UI Gmail fallback (wireframe edit), master wording update
for the superseded "lowest applicable" from-price line.
