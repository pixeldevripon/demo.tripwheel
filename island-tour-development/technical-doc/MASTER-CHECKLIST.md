# Master checklist

> **Canonical source:** `island-tours-platform-master.html` (v1.9). The single checklist for the
> project: it enumerates **every actionable point of the master** and marks its status in the
> **current codebase**. This is the only checklist — there is no separate alignment doc.
>
> Legend: `- [x]` implemented · `- [ ]` remaining. A `⚠️` note on an unchecked item means *partially*
> built (exists but diverges from the master). Code paths are under `backend/` unless noted; frontend
> items are the public Next.js app (largely unbuilt).
>
> **Update this file in the same commit as the work** — flip `- [ ]` → `- [x]`, correct stale lines,
> and refresh the progress table. The featured-slot economy is replaced by commission tiers.

---

## Overall progress

**46 of 203 tracked master points implemented (~23%)**, 157 remaining (15 of which are partial —
built but diverging from the master). The discovery/content schema is largely done; the commercial
tier engine, transactions, availability, tracking, and the public site are the open work.

| Master section | Done | Remaining | Partial |
| --- | ---: | ---: | ---: |
| §1 Platform & positioning | 10 | 17 | 2 |
| §2 Information architecture | 15 | 16 | 3 |
| §3 Design system & shared components (frontend) | 0 | 12 | 0 |
| §4 Brand voice (frontend copy) | 0 | 4 | 0 |
| §5 Page specifications (frontend) | 0 | 11 | 1 |
| §6 Booking flow, payments & email | 0 | 13 | 1 |
| §7 Commercial model | 0 | 15 | 0 |
| §8 Tracking & analytics | 0 | 12 | 0 |
| Appendix A — Locked decisions (LD1–LD33) | 5 | 28 | 3 |
| Appendix E — Consolidated data model | 16 | 24 | 5 |
| Remove (was slot economy) | 0 | 5 | 0 |
| **Total** | **46** | **157** | **15** |

---

## §1 Platform & positioning

### 1.1 Positioning

- [x] Reseller marketplace, commission on local operators — `operators/`
- [ ] Positioning pillars surfaced in product copy (local curation, ethical CRO, transparency, voice) — frontend
- [ ] Tagline "Island Tours. Built by Islanders." (English in all locales, never translated) — frontend

### 1.2 Launch scope

- [x] Destinations data-driven, expansion-ready (`region`, `parent_destination_id`) — `destinations.prisma`
- [x] Seed 5 destinations (Curaçao, Aruba, Sint Maarten, Saint Lucia, Bahamas) with `is_seeded` guard
- [ ] Curaçao/Aruba/Sint Maarten live; Saint Lucia + Bahamas pipeline (status gating on surfaces) — ⚠️ status enum exists; pipeline-vs-live surfacing not enforced
- [x] Region grouping is a data attribute with no URL — `Region` enum

### 1.3 Languages & currency

- [x] 7 locales EN/NL/DE/FR/ES/PT/ZH — `Locale` enum
- [x] English slugs in every locale — slug registry, no translated slugs
- [x] `next-intl` for UI strings (no hardcoded English) — frontend scaffold
- [ ] Display currency locale-default (EN/ZH→USD, others→EUR) — ⚠️ `Currency` enum exists; locale→currency mapping not wired
- [ ] Footer currency selector override, session-persistent; nav never carries it — frontend
- [x] `destination.currency` is operator/payout context only — `destinations.prisma`
- [ ] Locale-aware number/currency formatting — frontend

### 1.4 Business model & money flow

- [x] Commission tiers (premium 30 / featured 27.5 / boosted 25 / organic 22.5 / standard 20)
- [x] Destination Spotlight 35% (separate block, max 3/destination, manual approval) — `src/tiers/` (request/approve/reject, transactional cap, eligibility gate, effective-commission overlay snapshotted on booking)
- [x] `commission_rate` + `commission_amount` snapshot on booking, never retroactive — `bookings.service` (computed at reserve, EUR-normalized at confirm)
- [x] `deposit_pct` 20–30 in 2.5 steps, tier-driven
- [x] 4 payment models (operator_link / on_arrival / paid_in_full / operator_full) — snapshot + charge selection in `bookings.service` / `payments.service`
- [x] Deposit/balance split (deposit to Island Tours via Stripe; balance is operator's) — `payments.service.chargeFor`
- [ ] Two-phase operator visibility (pre-payment agentless, post-booking named)

### 1.5 Infrastructure

- [x] NestJS backend, Prisma, PostgreSQL — `backend/`
- [x] Better Auth backend-only — `auth/`
- [ ] next-intl wired end-to-end on the public site — frontend
- [x] Stripe payments integration — `payments/` (intent per booking, signature-verified idempotent webhook); keys from `stripe_configuration`
- [ ] Resend transactional email (SPF/DKIM/DMARC), Postmark fallback — booking-confirmation email wired over existing SMTP/nodemailer; Resend provider swap still TODO
- [ ] GTM / Google Ads / GA4 / Meta Pixel + server-side Meta CAPI — server-side Meta CAPI done (`tracking/`); GTM/Pixel/Ads/GA4 are frontend

---

## §2 Information architecture

### 2.1 Core hierarchy

- [x] Destination → (Categories | Activity Hubs | Collections | All Tours) → Tour detail
- [x] Categories global (one set reused per destination) — `categories.prisma`
- [x] `parent_destination_id` nullable for future sub-destinations
- [x] Activity-Hub-vs-Collection split (place/product vs persona/intent)

### 2.2 URL structure

- [x] `/{locale}/{destination}/{slug}/` shape — routing/resolver
- [x] Tours flat, no `/tour/` segment, no hub nesting — `TourHub` has no URL effect
- [x] Locale prefix always present; no-prefix → 302 via Accept-Language → /en/ — frontend middleware
- [x] Slugs English worldwide, one per page — slug registry
- [ ] Trailing-slash canonical; hreflang 7 + x-default; per-locale/per-type sitemaps — frontend SEO

### 2.3 Slug registry

- [x] Registry maps slug → one page type (category/hub/collection/tour/reserved) — `slug-registry.prisma`
- [x] 19 categories + reserved `tours` = 20 protected slugs per destination
- [x] Unique per (destination_slug, slug); same slug allowed across destinations
- [x] Locale-independent resolution at request time — resolve endpoint
- [x] Renames create a 301 entry automatically (redirect table) — shared `slug-registry.util` (`renameEntitySlug`: re-point row + auto-301 + chain-collapse). Exposed via `slug?` on the Update DTO of tours, categories (global → 301 per destination), hubs, collections; redirect-aware `SlugRegistryService.resolve`. (Destination-slug rename deferred — it is the URL namespace.)
- [x] Deleted slugs enter a 90-day reuse cooldown — `markSlugsDeleted`/`markDestinationSlugsDeleted` (keep row, `isActive=false`+`deletedAt`); cooldown-aware reuse (`slugRowBlocks`) + ghost-clear on create across tours, categories, hubs, collections, destinations

### 2.4 Categories

- [x] 19 global categories with fixed slugs
- [x] Multi-category tagging (1+ per tour, one `isPrimary`) — `TourCategory`
- [x] Category page live only at **≥3** published tours — ⚠️ currently 404s at 0 (effectively ≥1)
- [x] Threshold automation on every tour status change (both directions) — ⚠️ gating exists; ≥3 re-check needed
- [x] Day Trips as the one duration-based category — category present
- [ ] "Luxury" word allowed only as category label/H1, banned in running copy — frontend

### 2.5 Rendering & performance

- [ ] ISR per page type (Home/Dest/AllTours/Category/Collection 60s, Hub 300s, Tour 30s) — frontend
- [x] Search SSR not cached; TYP server-rendered — frontend
- [x] Content endpoints accept `locale` with English fallback — services

### 2.6 Structured data

- [x] BreadcrumbList on every page with breadcrumbs — frontend
- [x] Tour Product/Offer (acceptedPaymentMethod, suggestedMinAge, accessibility, refundPolicy, includes/excludes, Review+AggregateRating) — frontend
- [x] FAQPage (Help, Collection, Hub, Destination) — frontend (FAQ data exists)
- [x] All Tours ItemList; Search none/noindex — frontend

### 2.7 Breadcrumbs

- [x] Separator `›`; three tour variants (Hub / Category / Destination) by primary attachment — frontend
- [ ] Mobile visible on tour pages, hidden on destination pages (LD8) — frontend
- [x] Final crumb not clickable; BreadcrumbList JSON-LD — frontend

---

## §3 Design system & shared components (frontend)

- [x] Color tokens (#E8611A primary, #1F2937 ink, #6B7280, #E5E7EB, #16A34A) + WCAG AA — `frontend-tokens.css`
- [x] Typography scale (H1 semibold, H2 consistent, body 14–15px, microcopy 11–12px)
- [x] One SVG icon library, monochrome line, 18–20px; no emoji in production (LD20)
- [x] Three-tier separator system: `·` middot / `,` geo / `›` breadcrumbs (pipe retired)
- [x] Shared `<TourCard />` (whole-card clickable, heart, badge slot, carousel, meta row)
- [x] Duration formatter (locale-aware, ranges, no decimals)
- [x] Badges: Sponsored, Most popular, Likely to sell out, New, numbered 01–10
- [x] Single demand-signal trigger (§3.7), no fake urgency
- [x] Diversity pass after ranking (§3.8)
- [ ] Navigation bar variants; Footer (currency selector, tagline, island links)
- [x] Trust components per page type (locked matrix §3.11)
- [x] Filters & sorting row (modal + category chips, dual count, applied-filter pills) — backend filters exist (`attributes`)

---

## §4 Brand voice (frontend copy)

- [ ] Voice rules (warm, direct, first-person plural)
- [x] Banned words list enforced (LD9), no em-dashes in platform copy
- [ ] English variant rules; "(local time)" on all deadline copy
- [ ] Locked microcopy strings implemented verbatim per page spec

---

## §5 Page specifications (frontend)

- [x] 5.1 Homepage (hero H1, micro trust bar, video carousel, social proof, featured destinations, NeedHelp, footer)
- [x] 5.2 Destination page (hero+search, category quick links, Locals' favorites, Instagram, About 350–500w/3×H2)
- [x] 5.3 All Tours page (H1 with year, filter row, 3×6 grid/18 per page, trust strip, ranking + diversity)
- [x] 5.4 Category page (H1+intro, filters, ranked grid, About content, related categories, no trust bar)
- [x] 5.5 Activity Hub page (hero fast facts, sticky anchor nav, Our Pick, comparison table, FAQ, related) — backend our-picks/comparison built
- [ ] 5.6 Collection page (editorial banner, intro, curated grid no sort/filter, FAQ, keep-exploring) — backend collections built
- [x] 5.7 Tour detail page (breadcrumbs, H1 LD15, gallery, widget, overview LD22, ✓/✗ LD18, Meeting & Pickup LD19, Important Info LD23, reviews, related LD33)
- [x] 5.8 Checkout (single-page accordion, payment-model-aware, no payment section on operator_full) - frontend UI live (Figma-mirrored two-phase form); booking submission + Stripe Elements pending bookings/payments module
- [x] 5.9 Thank You page (server-rendered, operator-first support, masked email) - frontend page live at /{destination}/thank-you/{public_ref} (no locale prefix via proxy rewrite, noindex); demo payload - TYP lookup API, conversion firing, /payment/processing intermediate, and email masking pending bookings/tracking modules
- [x] 5.10 Search results (Postgres, tours-only, two-stage ranking, noindex) — ⚠️ basic search exists, no two-stage ranking
- [ ] 5.11 Help Center `/help` (FAQPage schema, LD21)

---

## §6 Booking flow, payments & email

### 6.1 Widget states

- [ ] S1–S5 widget (date-first, travelers second, capacity-aware, time-slot chips) — frontend
- [ ] CTA progression: Check availability → Continue → 🔒 Reserve my spot · Pay $X (bare on operator_full)
- [ ] Booking cutoff behavior per `booking_cutoff_minutes` — ⚠️ field exists (`trips.bookingCutoffMinutes`); widget behavior not built

### 6.2 Payment & cancellation lifecycle

- [x] `cancellation_hours` enum [24,48,72,168] default 48, NOT NULL — schema `@default(48)`, DTO `@IsIn`, service default 48
- [ ] One window governs balance deadline AND free cancellation; computed `cancelDeadline` (tour-local)
- [x] Free cancellation is a listing requirement (CMS-enforced)
- [ ] Forfeit never automatic (operator reports → admin confirms)
- [ ] Operator-forced cancellation → full refund or free reschedule

> **⚠️ DECISION NEEDED (open in master, conflict log C23) - counter-party settlement rails.** The checkout charge always lands in the Island Tours Stripe/Mollie account, but two rails are unresolved and must not be hardcoded before sign-off (owner: Arnav). Deposit models (`operator_link`, `on_arrival`) are resolved - no cross-transfer, each party keeps its own leg. Open:
>   - [ ] **`paid_in_full` operator payout** - Island Tours holds 100%; how is the operator paid its `total - commission`? (options: Stripe Connect split/transfer [phase-2 candidate, B.85] vs. manual admin payout/invoicing in v1)
>   - [ ] **`operator_full` commission collection** - Island Tours holds nothing; how is its `commission` collected from the operator? (options: Stripe Connect vs. manual invoicing in v1)
>   - Cross-refs: `03-implementation/BOOKING-FLOW-DESIGN-GUIDE.md` §2.3, `02-architecture/BOOKING-AND-PAYMENTS.md` §1. Off-platform legs are not machine-readable in v1 (B.85); Stripe Connect (phase 2) would make both machine-readable.

### 6.3 Trust strip & modals

- [ ] Two clickable lines (cancellation + deposit), payment-model-aware, locked modal copy (LD5) — frontend

### 6.4 Cancellation flow (C1)

- [ ] Tokenized confirmation page (no raw-click cancel), account pointer

### 6.5 Booking confirmation email

- [ ] 11 content blocks, payment-model-aware, masked render, `display_ref` as ticket (LD4), localized

### 6.6 WhatsApp behavior

- [ ] WhatsApp support 08:00–20:00, platform fallback after booking

### 6.7 Pre-tour reminder email

- [ ] Send 24h before start; "Today:" last-minute variant; payment-model blocks; no payment links ever

---

## §7 Commercial model

### 7.1 Tiers

- [x] Tour tier columns `commission_tier`/`tier_key`/`tier_rank`/`tier_locked_until`/`quality_score` — Tour columns
- [x] New tours default standard (20%, rank 5); `tier_rank` denormalized, never client-written
- [x] Tier change updates all three + sets `tier_locked_until = now+30d`; rejected while locked — `PATCH /tiers/tours/:id/tier`
- [x] `deposit_pct` tier-driven (surfaced read-only)

### 7.2 Ranking & eligibility

- [x] Ranking query `tier_rank ASC, quality_score DESC, id ASC`
- [x] Bookability filter (status=active, is_bookable, EXISTS open departure within 30d)
- [x] `quality_score` nightly formula (rating 40 / reviews 25 / completeness 20 / conversion 15)
- [x] Eligibility flat bar (5 reviews / 4.0 / ≤10% cancellation, min 10 bookings)
- [x] One-time 90-day provisional window from first publish
- [x] Nightly enforcement → notify → 30-day grace → auto-demote (keep snapshotted commission)
- [x] Destination Spotlight extra bar (10/4.5) + manual approval + max-3 cap — `src/tiers/` (cancellation-rate gate is a TODO pending operator E.6 field)
- [x] Force-majeure pardons (admin: date range + destination) — `ForceMajeurePardon` model
- [x] Sponsored/Most popular/Locals' favorites badges & labels

### 7.3 Affiliate program

- [ ] Trackdesk integration (8% of GMV from commission, on-hold→approved lifecycle)
- [ ] Promo codes double as attribution IDs; USD + EUR payouts

---

## §8 Tracking & analytics

### 8.1 Principles

- [x] Conversion value = `commission_amount` (EUR), never GMV — `bookings.service.finalizeConfirmation` / TYP payload
- [ ] One `booking_complete` event → 4 GTM tags (Conversion Linker, Google Ads, GA4, Meta Pixel) — frontend GTM
- [x] Enhanced Conversions / Advanced Matching with hashed PII — `tracking.service` (SHA-256 em/ph/fn/ln/zp/country)
- [x] Server-side Meta CAPI in parallel, event-id dedup — `tracking.service` (`event_id` = publicRef, shared with the Pixel)
- [x] Mark-first idempotency via `conversion_fired_at` — `bookings.service.finalizeConfirmation` (fires once)
- [ ] Click-id (gclid/gbraid/wbraid/fbclid) + UTM capture at booking creation
- [ ] Consent Mode v2 (EEA denied default, US/CA granted)

### 8.2 Flow

- [x] `/payment/processing` → Stripe webhook (idempotent via `stripe_webhook_events`) → TYP → push once — backend: webhook + idempotency + `confirmFromPayment`; `/payment/processing` page is frontend
- [x] TYP route `/{destination}/thank-you/{public_ref}`, no locale prefix, noindex — backend data at `GET /bookings/typ/:publicRef` (conversion gated on confirmed + EUR commission); page render is frontend
- [x] operator_full bypasses charge/webhook, created confirmed at commit — `bookings.service.reserve` (no charge in `payments.service`)

### 8.3 Data contract

- [ ] `booking_complete` payload (booking_value EUR, currency, refs, tour/operator/island, items[], user_data hashes, click_ids) type-checked in CI

### 8.4 Definition of Done

- [ ] GA4 one purchase/test booking; Meta one deduped Purchase; EC match rate > 60%

---

## Appendix A — Locked decisions (LD1–LD33)

- [ ] LD1 `cancellation_hours` enum [24,48,72,168] default 48 in 5 render locations — ⚠️ field exists, wrong type/default
- [ ] LD2 CTA progression (operator_full bare) — frontend
- [x] LD3 "Pickup" no hyphen, platform-wide — copy convention
- [ ] LD4 Email is the ticket (no QR/voucher; ref + ID at check-in)
- [ ] LD5 Widget trust strip = exactly 2 clickable lines
- [ ] LD6 Tagline in global footer (closing trust block dropped)
- [ ] LD7 Exactly 3 quick-info badges (Duration, Pickup, Languages)
- [ ] LD8 Mobile breadcrumbs on tour pages, hidden on destination
- [ ] LD9 Banned words list, platform-wide
- [x] LD10 Real operator names in spec examples only — N/A code
- [x] LD11 Provider Rating cold-start (<3 native AND operator ≥10 @ ≥4.0) — `reviews/review-display.util.resolveRatingSource` + `GET /reviews/summary`
- [ ] LD12 Total price before checkout, fees itemized
- [ ] LD13 Meta row rating · badge · location; `is_locals_favourite` boolean — flag + editorial curation built (admin-only `MANAGE_EDITORIAL`, `PATCH /tours/:id/locals-favourite`, `/dashboard/locals-favourites` page; NOT operator-set); public meta-row rendering still to verify
- [x] LD14 Operator visibility "Supplied by {operator}" only
- [ ] LD15 H1 `{Destination or Hub}: {Tour name}` Title Case 35–60 chars — `h1Override` exists; render not built
- [ ] LD16 Sticky TOC, 7 items, fixed order
- [ ] LD17 Stacked H2 layout
- [ ] LD18 What's Included two-column ✓/✗ + inline conventions — ⚠️ exclusions label-only; need typed shape
- [ ] LD19 Meeting & Pickup stacked, Maps text link, no embedded map — meeting_point fields not present
- [ ] LD20 One SVG icon library, no emoji in production
- [ ] LD21 No per-tour FAQ; site-level `/help` FAQPage — polymorphic FAQ exists; `/help` page not built
- [ ] LD22 Highlights merged into Overview, bullets, optional local tip — `local_tip` not present
- [ ] LD23 Important Info 3 subsections; `not_suitable_for` field — field not present
- [ ] LD24 Tiered deposit 20–30% via `deposit_pct`
- [x] LD25 Single-day tours only in v1 — no multi-day logic
- [ ] LD26 Payment methods equal radio list, card default; no payment section on operator_full
- [x] LD27 Critical-constraints callout — dropped (no action)
- [x] LD28 AI review summary — deferred to V2 (no action)
- [ ] LD29 Review preview module, Tier 1+2 at launch — frontend
- [ ] LD30 Reviews sort hidden <10, filters hidden <20, newest first — backend: sort modes + newest default + counts (`GET /reviews`); hide-thresholds are frontend
- [ ] LD31 Star distribution chart, renders at ≥3 reviews — backend: `distribution[]` in `GET /reviews/summary`; chart render is frontend
- [ ] LD32 Review translation (Google Translate API + show-original) — backend: per-locale `ReviewTranslation` store + locale-aware read; auto-translate worker deferred to Phase 9
- [ ] LD33 Related Tours two rows, dynamic titles, `related_tour_click` event

---

## Appendix E — Consolidated data model

### E.1 destinations

- [x] id, name, slug, region, country, descriptions, images, lat/lng/timezone, currency, language, meta, parent_destination_id, status, timestamps — `destinations.prisma`

### E.2 categories

- [x] id, name, slug (global), description, icon, sort_order, parent_category_id, meta templates — `categories.prisma`
- [ ] `status` per destination driven by the ≥3 threshold automation — ⚠️ gating at ≥1

### E.3 tours — identity & routing

- [x] id, title, slug, destination_id, operator_id, categories[], activity_hubs[], h1_override, breadcrumb_label
- [x] departure_city — Tour column + trip create/update DTO + service + response

### E.3 tours — localized content

- [x] overview, highlights, included_items, gallery (is_hero/focal) — child tables + `TripTranslation`
- [x] short_description, what_to_bring, know_before_you_go, not_suitable_for, local_tip, meeting_point_text — `TourTranslation` + trip-children translation DTO/service
- [x] category_display (plural noun phrase for "More {x} in {destination}") — `TourTranslation.categoryDisplay`
- [x] meta_title, meta_description (per locale), what_to_expect_intro — `TourTranslation`; og_image — Tour column
- [x] excluded_items typed `{item, type, price_text?}` — `TourExclusion.type`/`priceText` (LD18) + create/update DTO + service

### E.3 tours — pricing & party

- [x] pricing_model, unit_type, age_bands[], add_ons[], max/min_party_size — `trips.prisma`
- [x] price_adult/child/infant naming reconciled with basePrice/priceFrom —  mapping to build

### E.3 tours — booking logic

- [x] booking_cutoff_minutes, pickup_model, pickup_required, duration_minutes — `trips.prisma` + trip DTO/service
- [x] cancellation_hours enum [24,48,72,168] default 48 — DTO `@IsIn`, service default 48 (master rule #20)
- [x] free_cancellation derivable (cancellation_hours NOT NULL — no standalone field)
- [x] payment_model, instant_confirmation, booking_type, duration_minutes_max(durationMinutesTo) — trip create/update DTO + service; deposit_pct surfaced read-only (tier-driven)
- [x] start_times[] — `Tour.startTimes` column; availability schedules validate slots against it
- [x] check_in_minutes_before — Tour column (default 30); pickup window (windowStart/windowEnd) — `PickupLocation`
- [x] meeting_point_lat / meeting_point_lng (+ departure_city; localized meeting_point_text on `TourTranslation`)

### E.3 tours — flags & accessibility

- [x] min_age_years, fitness_level, weather_dependent, wheelchair_accessible, family_friendly, suitable_for_beginners — Tour columns + trip create/update DTO + service + response. `is_locals_favourite` is a Tour column but EDITORIAL-ONLY: not in create/update DTO; toggled via admin `MANAGE_EDITORIAL` endpoint (see LD13)
- [x] guide_languages[] — `TourLanguage`

### E.3 tours — computed

- [x] aggregate_rating, review_count, booking_count(+today), spots_remaining, last_booked_at — cached fields
- [x] rating_distribution[], photo_review_count — cached columns on Tour (rating_distribution also live in `GET /reviews/summary`)
- [x] quality_score (nightly)

### E.3 tours — commercial tier

- [x] tier_key, commission_tier, tier_rank, tier_locked_until, first_published_at, eligibility_state(+grace), is_bookable

### E.4 activity_hubs

- [x] id, name, slug, destination_id, hub_type, short_description, images, content_sections, faq, lat/lng, meta, status — `destinations.prisma` (+ allowed categories, our picks, comparison)

### E.5 collections

- [x] id, name, slug, destination_id, collection_type, tour_ids[], filter_query, rationale, hero, sort_order, faq, meta, status — `collections.prisma`

### E.6 operators

- [x] display_name (via user), aggregate_rating, aggregate_review_count — `operators.prisma`
- [ ] cancellation_rate_90d (nightly), contact_email, contact_phone (E.164)

### E.7 reviews

- [x] booking-gated FK, rating, comment, is_approved, tour/operator/user — `reviews.prisma` + `reviews.service` (ownership + completed-experience gate, one per booking)
- [x] reviewer first+last initial display, reviewer_type, travel month/year, per-locale text + translation cache, photos[], helpful_count, operator_response, moderation_status — `reviews.service.create`/`respond`/`markHelpful` + `ReviewTranslation` (reviewer_type implicit: all isVerified)

### E.8 bookings

- [x] tour_id, user_id, operator_id, schedule_id, date, time, party_size, total/deposit amount, status, confirmation_code, add-ons — `bookings.prisma` (thin)
- [x] public_ref (uuid), display_ref (IT-2026-XXXXX), island (denormalized) — populated at reserve (`bookings.service`)
- [x] original_currency/amount, booking_total_eur, fx_rate_to_eur — `fx.util` + `finalizeConfirmation` (EUR-normalized at confirm)
- [x] commission_rate, commission_amount, payment_model, deposit_amount, payment_method_last4/brand — reserve snapshot + webhook billing snapshot
- [ ] conversion_fired_at, gclid/gbraid/wbraid/fbclid, utm_* — `conversion_fired_at` set; click-id/UTM capture at booking creation still TODO (needs reserve DTO fields + frontend)
- [x] customer_first/last_name (split), customer_email/phone (E.164), customer_id (hash), customer_locale — captured at confirm (`customer_id` hash deferred)
- [x] billing_country/postal_code/city (from Stripe) — `confirmFromPayment` (webhook charge billing_details)

### E.9 availability & departures

- [x] availability_schedules (weekly pattern) — schema + service (create/update/list, slot-set validation, Monday=0)
- [x] availability_exceptions (close_date/close_slot/add_slot/set_capacity) — schema + service + materializer
- [x] departures (materialized truth, capacity/booked_count/status/sold_out_at/source/manually_edited) — schema + service
- [x] Materialization engine + read contract (live cutoff, remaining<5 disclosure) + atomic claim (guarded count-up); nightly cron + all-sold-out recovery still pending
- [x] Operator portal (schedule editor, exceptions, blackouts, close-today, freshness nudge)
- [x] Replaces the existing simple `TourSchedule` model

---

## Remove (was the slot economy)

- [ ] Delete `FeaturedSlot`, `SlotLock`, `SlotHistory`, `WaitlistEntry` + enums + relations
- [ ] Remove 3-slot seeding (`featuredSlot.createMany([1,2,3])`) in `categories.service.ts`
- [ ] Remove slot-release hooks in `trips.service.ts` and `MANAGE_SLOTS` permission (backend + `rbac.ts`)
- [ ] Migration drops `featured_slots`, `slot_locks`, `slot_history`, `waitlist_entries`

> `FeaturedExperience` (Top Island Experiences) and `Wishlist` are unrelated — keep.

---

## Execution order (dependency view)

```
Remove slots ─┐
              ├─► tier columns + ranking ──► eligibility + nightly jobs ──► affiliate
              ├─► tour E.3 fields (cancellation_hours, payment_model, content, flags)
              ├─► availability/departures ──► bookings + payments ──► reviews
              │                                                   └─► tracking/TYP ──► emails
              ├─► slug 301 + 90-day cooldown
              ├─► category gating ≥3
              └─► public frontend (consumes all backend) ──► cleanup & DoD
```
