
# PART II — BACKEND TASK CHECKLIST

> Status is assigned from the **code audit** (`backend/src` + `backend/prisma`, 284 `.ts` files, 33 wired modules,
> 26 `.prisma` files, 34 migrations). Where a technical doc asserts a different state than the code shows,
> the code wins and the doc's claim is appended in parentheses.
>
> `- [x]` DONE · `- [~]` ONGOING (exists but partial/stubbed/defective) · `- [ ]` PENDING (not built)

---

### Platform foundation

- [x] NestJS 11 strict-TypeScript app bootstrap (`main.ts`, `app.module.ts`) with base URL `/api/v1` and Better Auth mounted at `/api/auth/*` (no `/v1`)
- [x] Wire all 33 feature modules into `AppModule.imports` (Prisma, Faq, StaffPermissions, Auth, Staff, Mail, User, Settings, HomePage, FeaturedExperiences, PlatformReviews, Operators, MediaGallery, Categories, Destinations, Hubs, SlugRegistry, Tours, Attributes, Collections, Search, Octo, Availability, Fx, Tiers, Bookings, Customers, Payments, Tracking, Reviews, Notifications, Wishlist, Workers, Analytics)
- [x] Global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted` so every request body needs a matching DTO
- [x] Global HTTP exception filter (`common/filters/http-exception.filter.ts`) + shared error DTOs (`common/dto/error-responses.dto.ts`)
- [x] Swagger UI at `/api/docs` with one decorator function per endpoint (`<module>.swagger.ts` convention)
- [x] `PrismaService` as a `@Global()` provider with connect/disconnect lifecycle hooks — one Prisma instance per process
- [x] Split Prisma schema across 26 `.prisma` files (Prisma 7 auto-merge); `schema.prisma` holds only generator + datasource
- [x] `env.validate.ts` secret/format validation incl. placeholder-detection error messages
- [x] `GET /health` endpoint, `@Public()` + `@SkipThrottle()`
- [~] Deepen `/health` into a real liveness probe — it returns `{status,timestamp,uptime}` only and does **not** ping Postgres or Redis; add `@nestjs/terminus` DB/Redis indicators
- [x] Global 3-tier per-IP `ThrottlerGuard` (60/s · 300/min · 3000/hr) registered in `AuthModule`, first in the guard chain
- [x] Trusted-origin throttle bypass via `skipIf` + `x-internal-api-key` / `INTERNAL_API_SECRET` (boot fails in production when unset)
- [~] `trust proxy = 1` in `main.ts` assumes exactly one proxy hop (nginx) — must be bumped to `2` (or nginx `real_ip`) before any CDN/LB is put in front, otherwise `X-Forwarded-For` spoofing evades the per-IP limit
- [ ] Swap throttler storage to Redis (`@nest-lab/throttler-storage-redis`) so limits are shared once more than one backend replica runs
- [x] Shared `common/utils/` toolkit (app-urls, crypto, date-range, fx, invite-provisioning, operator, parse-cors-origins, redis, slug, slug-registry, timezone, translation, whatsapp)
- [x] Custom validators `is-iana-timezone` + `is-local-date`
- [x] Production seed (`prisma/seed.ts`) and removable demo seed (`prisma/demo-seed.ts` + `prisma/demo/`)
- [x] Remove the featured-slot economy from schema and code — no `featured-slots.prisma`/`waitlist.prisma`, no `slots/`/`waitlist/` modules, no 3-slot seeding in category create (docs claim: MASTER-CHECKLIST "Remove (was the slot economy)" still lists all 4 removal tasks as pending; SLUG-REGISTRY §10 still says "Exists in code, must be REMOVED")
- [ ] Delete the dormant `Webhooks` + `WebhookPoint` models (legacy Zapier/n8n lead-catch; no service reads them)
- [ ] Build a business `audit_log` model (`actorId`, `action`, `entityType`, `entityId`, `before`/`after`, `ip`) written from a NestJS interceptor on mutating routes — today there is only stdout `Logger` output
- [ ] Mailchimp send/sync integration — the `Mailchimp` model and its settings CRUD exist with no integration behind them

### Auth / RBAC / Staff

- [x] Better Auth engine on NestJS only (`auth.instance.ts`, `auth-prisma.client.ts`, `auth.types.ts`) with the catch-all `@All('/api/auth/*splat')` controller
- [x] Guard chain in fixed order: `ThrottlerGuard → AuthGuard → RolesGuard → PermissionsGuard`
- [x] Decorators `@Public`, `@Roles`, `@RequirePermissions`, `@AuthenticatedUser` + `AuthenticatedRequest`/`TypedAuthUser` types
- [x] CORS with `credentials: true` via `parseCorsOrigins()` in both `main.ts` and `auth.instance.ts`
- [x] Better Auth per-path brute-force limiter (5/min on sign-in/forget/reset), independent of the NestJS throttler
- [x] `config/roles.config.ts` permission map (~140 `Permission` enum values) with ADMIN as a strict superset
- [x] Unified staff model: `StaffDesignation` + `StaffMember` covering both platform staff and operator seats (migration `20260719180644_staff_and_designations`)
- [x] Effective-permission engine `staff-permissions.service.ts` (`getEffectivePermissions`, `hasPermissions`, `invalidate`, `invalidateAll`) with ceilings/floor in `config/staff.config.ts`, consumed by `PermissionsGuard`
- [x] Staff API surface (22 endpoints): permission catalog, platform designations CRUD, team designations CRUD, team list/invite/status/resend/detail, platform staff list/invite/status/resend/detail
- [x] Immediate suspension enforcement (`AuthGuard` with `disableCookieCache`) so a suspended seat loses access on the next request
- [x] Staff invite lifecycle with `sendStaffInviteEmail` set-password links
- [x] `MANAGE_EDITORIAL` permission (migration `20260712133827`) gating the locals-favourite editorial endpoints
- [ ] Bearer-token auth for the OCTO surface (decision D1) — OCTO catalog reads are `@Public()` today; needed before a third-party OTA integrates
- [ ] Per-operator API keys + scoped permissions for operator/OTA access to availability and bookings (OCTO Phase 9)

### Users & Customers

- [x] Users module: `GET me`, `GET me/permissions`, `GET /`, `GET :id`, `GET :id/permissions`, `POST me/set-password`, `PATCH me`, `PATCH :id/role`, `PATCH :id/status`, `PATCH :id`, `DELETE :id`
- [x] Role changes admin-only (`@Roles(Role.ADMIN)`) — the frontend can never set a role
- [x] Customer provisioning service (`customer-provisioning.service.ts`): `provisionForBooking` auto-creates a `Role.USER` on first booking, backfills past bookings by `contactEmail`, skips non-USER emails
- [x] Customer welcome email with a secure set-password link, capped at one resend per 24h
- [x] `customers` table (`userId` × `operatorId` unique) with `bookingsCount` / `totalSpendEur` aggregates and an idempotent `recomputeAggregates` groupBy→upsert
- [x] Self-scoped customer reads (`GET /bookings/me/summary`, payment ledger status) and customer-initiated cancellation requests
- [ ] Operator-facing customer page/endpoints (deliberately deferred; the `customers` table is populated but unexposed to operators)
- [ ] Manual end-to-end verification pass of the customer-accounts flow against `technical-doc/customers/CUSTOMER-ACCOUNTS.md`

### Operators

- [x] Operators CRUD (`POST /`, `POST onboarding`, `GET /`, `GET :id`, `PATCH :id`, `DELETE :id`)
- [x] Sub-resource endpoints: `GET/PATCH :id/company-info`, `:id/social-media`, `:id/stripe-config`, `:id/mollie-config`
- [x] `aggregateRating` / `aggregateReviewCount` on the operator row feeding the LD11 cold-start fallback
- [x] Operator invite email (`sendOperatorInviteEmail`) + invite-provisioning util
- [ ] Add `cancellation_rate_90d` to `Operator` (master E.6) — operator-initiated cancellations ÷ confirmed bookings over a trailing 90 days, null under 10 bookings, recomputed nightly. Blocks the tier-eligibility cancellation gate
- [ ] Add first-class `contact_email` / `contact_phone` on the operator row with E.164 normalization via `libphonenumber-js` (default country CW), rejecting invalid numbers rather than storing plain text
- [ ] Enforce the E.6 render invariant: both contact fields null is invalid operator data (render error, never a silent fallback)

### Destinations

- [x] Destinations module (~24 routes): list/active/`slug/:slug`/`:id`, create/patch/delete/force-delete, translations, page content, legacy FAQs + FAQ groups
- [x] `is_seeded` delete protection (403 in the service, even on force delete)
- [x] Destination create seeds 1 `RESERVED` `tours` slug row + 1 `CATEGORY` row per active category, transactionally
- [x] Destination deactivate/reactivate flips every `slug_registry` row for that `destinationSlug`
- [x] Geo/currency/timezone fields (`latitude`, `longitude`, `timezone`, `currency`, `galleryImages`, `ogImage`, `parentDestinationId`)
- [ ] Enforce live-vs-pipeline surfacing (Curaçao/Aruba/Sint Maarten live; Saint Lucia + Bahamas pipeline) — the status flag exists but nothing gates surfaces on it
- [ ] Destination-slug rename support (deliberately deferred — it is the URL namespace, so a rename would 301 every child slug)

### Categories

- [x] Categories module (~26 routes): list/active/`slug/:slug`/`destination/:destinationSlug`/`destination/:destinationSlug/:categorySlug`/`:id`, create/patch/delete/force-delete, translations, page content, legacy FAQs + FAQ groups
- [x] Category create writes one `slug_registry` row per active destination in the same transaction, and **no** slot rows
- [x] 19 global category slugs, unique globally, reused per destination
- [x] `getPublishedTourCount` gating helper + re-check on every tour status change
- [~] Move the category page-render gate from **≥1** published tour to the canonical **≥3** (master §2.4): the service currently 404s only at zero, so a 1- or 2-tour category renders when it should stay `draft` and be excluded from nav/sitemaps/internal links/search (docs claim: MASTER-CHECKLIST §2.4 marks both gating lines `- [x]` with a ⚠️; SLUG-REGISTRY §10 records "Built at ≥1, must change to ≥3")
- [x] `ogImage` column + migration (`20260706195829_add_category_og_image`)
- [x] Guarded deactivation — refuse to deactivate a category while active non-draft tours are still assigned (409)

### Hubs

- [x] Hubs module (~40 routes, 1864 L service): list/active/`slug/:slug`/`render/:slug`/`destination/:destinationSlug`/`:id` + CRUD
- [x] Hub translations, per-locale page content, legacy FAQs + FAQ groups
- [x] `:id/allowed-categories` GET/POST/DELETE
- [x] `:id/content-sections` GET/PUT (+ section image field, migration `20260710120000_add_hub_content_section_image`; highlight flag, migration `20260711120000_add_hub_section_highlight`)
- [x] `:id/our-picks` GET / `/edit` / PUT and `:id/comparison` GET / `/edit` / PUT
- [x] `render/:slug` public page-render endpoint returning the fully composed hub payload
- [x] Comparison rows derived from tour attributes (differentiating attributes only)
- [x] Hub create derives the slug from the name only (no client-supplied slug) and writes exactly 1 `HUB` registry row
- [x] `attachHubMoney` currency conversion on hub render, our-picks and comparison
- [ ] Convert hub hero `priceFrom` / fast-stats aggregates to converted `money` (still source-currency; the frontend derives a display price from card money objects)

### Collections

- [x] Collections module (~28 routes, 1213 L service): list, `slug/:slug`, `render/:slug`, `admin/all`, `:id`, create/patch/`PATCH :id/status`/delete/force-delete
- [x] Collection translations, per-locale page content, legacy FAQs + FAQ groups
- [x] Tour membership endpoints: `GET :id/tours`, `GET :id/resolved-tours`, `PUT :id/tours` (diff-preserving `replaceTours`)
- [x] Per-tour, per-locale editorial rationale: `PUT :id/tours/:tourId/rationale/:locale` + `CollectionTourRationale` model
- [x] `render/:slug` public page-render endpoint
- [x] Collection create writes exactly 1 `COLLECTION` registry row in the entity transaction
- [x] `ogImage` column + migration (`20260709224411_add_collection_og_image`)
- [ ] Enforce "rationale required before publish, max 20 words" as a server-side publish guard (master §3.5 / E.5)
- [ ] Return converted `money` from collection `getBySlug` / `getActive` and the `fastStats.fromPrice` aggregate (only `render/:slug` converts today)

### Tours & children

- [x] Tours module (`/tours`, 2807 L service): `GET /`, `GET slug/:slug`, `GET my-tours`, `GET admin/all`, `GET :id`, `POST /`, `PATCH :id`, `DELETE :id`
- [x] Lifecycle endpoints `POST :id/publish|pause|unpause|archive|restore` with the publish guard
- [x] `tours-children.controller.ts` (`/tours/:tourId`, ~60 routes): full CRUD + per-locale translation upsert/delete for images, addons, age-bands, languages, highlights, inclusions, exclusions, features, locations, pickup-locations, plus tour translations
- [x] Ownership resolution via `resolveOperatorId` (user.id → operator.id); ADMIN auto-provisioned an operator, `TOUR_OPERATOR` without an operator record throws 400
- [x] Multi-category (`TourCategory`, exactly one `isPrimary`) + multi-hub (`TourHub`, no URL effect), 1 destination, always exactly 1 flat `TOUR` slug-registry row
- [x] Master E.3 identity/routing fields: `h1Override`, `breadcrumbLabel`, `departureCity`, `ogImage`
- [x] Master E.3 localized content on `TourTranslation`: `shortDescription`, `whatToBring`, `knowBeforeYouGo`, `notSuitableFor`, `localTip`, `categoryDisplay`, `meetingPointText`, `whatToExpectIntro`, `operatorNote`, per-locale meta
- [x] Typed `TourExclusion` shape (`type` + `priceText`) per LD18
- [x] Pricing & party fields: `pricingModel`, `unitType`, `unitIncludedGuests`, `extraPersonPrice`, age bands, add-ons, min/max party size (migration `20260710140000_add_unit_pricing_fields`)
- [x] Booking-logic fields: `bookingCutoffMinutes` (default 120), `pickupModel`, `startTimes[]`, `checkInMinutesBefore`, `durationMinutes`/`durationMinutesTo`, `instantConfirmation`, `bookingType`, `meetingPointLat/Lng`
- [x] `cancellationHours` enum-bound `[24,48,72,168]`, NOT NULL, default 48 (schema default + DTO `@IsIn` + service default)
- [x] `paymentModel` on the tour, snapshotted onto the booking at reserve
- [x] Flags & accessibility: `minAgeYears`, `fitnessLevel`, `weatherDependent`, `wheelchairAccessible`, `familyFriendly`, `suitableForBeginners`, `guideLanguages` via `TourLanguage`
- [x] `isLocalsFavourite` as an editorial-only column: excluded from `CreateTourDto`/`UpdateTourDto`, toggled only via `PATCH /tours/:id/locals-favourite` under `MANAGE_EDITORIAL`, plus `GET admin/locals-favourite/stats`
- [x] `recomputePriceFrom` re-anchored on the default age band (migration `20260716165001_reanchor_price_from_on_default_band`)
- [x] `recomputeLikelyToSellOut` demand signal + `POST admin/recompute-demand` (migration `20260630050545_add_tour_demand_signal`)
- [x] `recomputeQualityScores` nightly tie-breaker implementing the §7.2 formula (rating 40 / review count 25 / completeness 20 / conversion 15, normalized against in-category `max_conv`)
- [x] `attachMoney` display conversion on tours list/detail/by-id with an optional `?currency` query
- [x] Listing price filter aligned to `priceFrom` rather than `basePrice`
- [x] `resolveUniqueSlug` collision handling — own-duplicate 409, single operator-name suffix, never a numeric suffix, atomic claim with 409 on a write race
- [~] The `conversion_rate` term of `quality_score` contributes effectively **0** for every tour until a pageview/tracking event store exists — there is no view counter to divide bookings by, so the 15-point component cannot discriminate between tours
- [ ] Collapse the residual `Trip*` / `Tour*` Prisma identifier mix to a single `Tour*` naming (OCTO A7.1 — documentation-only today)
- [ ] Currency-change guard: block or relabel a `Tour.defaultCurrency` change once priced children/bookings exist

### Attributes

- [x] Attribute dictionary CRUD under `@Controller('attributes')`: `GET /`, `GET /:key`, `POST /`, `PATCH /:key`, `DELETE /:key`
- [x] Public filter endpoints under `@Controller('filters')`: `GET /:destinationSlug`, `GET /:destinationSlug/:categorySlug`
- [x] Per-tour attribute values under `@Controller('tours/:tourId/attributes')`: `GET /`, `POST /`, `DELETE /:key`
- [x] Derived-attribute SSOT: the ~13 attributes that duplicate first-class Tour fields (cancellation, pickup, duration, languages, flags) are computed on read and the backend rejects attempts to set them

### Slug registry & redirects

- [x] `SlugRegistry` model with `@@unique([destinationSlug, slug])`, `@@index([destinationSlug, slug, isActive])` and `entityId` null only for `RESERVED`
- [x] `GET /slug-registry/resolve` public resolver, 404 on missing or `isActive:false`
- [x] Transactional registry writes at every entity create site (destination, category, hub, collection, tour) via `common/utils/slug-registry.util.ts`
- [x] Tombstoning: deactivate flips `isActive:false` (row and slug retained), reactivate flips it back; tour archive/restore toggles the `TOUR` row
- [x] `SlugRedirect` model + automatic 301 on rename (`renameEntitySlug`: re-point the row, write the redirect, collapse redirect chains) exposed via optional `slug?` on the update DTOs of tours, categories (one 301 per destination), hubs and collections (docs claim: SLUG-REGISTRY §10 lists "SlugRedirect table + 301-on-rename — Not built")
- [x] Redirect-aware `SlugRegistryService.resolve` that checks the redirect table before returning 404
- [x] 90-day deletion cooldown: `markSlugsDeleted` / `markDestinationSlugsDeleted` keep the row with `isActive:false` + `deletedAt`, and `slugRowBlocks` treats an in-cooldown slug as taken during `resolveUniqueSlug`, with ghost-clear on create (docs claim: SLUG-REGISTRY §10 lists "90-day reuse cooldown — Not built")
- [x] Force-delete removes registry rows in the entity transaction, blocked for `isSeeded` entities
- [ ] Destination-slug rename + its cascading 301s (explicitly deferred)
- [ ] Unit/e2e coverage for the slug-registry module and the rename/cooldown utilities (no spec file exists)

### Search

- [~] `search` module is a deliberate delegating shell: `GET /search` → `ToursService.search()` and `GET /search/suggest` → `ToursService.suggest()`. There is **no `search.service.ts`**; all ranking, faceting and matching live in `tours.service.ts`, so search logic is not independently testable or replaceable
- [x] `?currency` + `money` conversion on `GET /search`
- [x] Ranked output honours `tier_rank ASC, quality_score DESC, id ASC` plus the bookability filter (via the shared tours ranking path)
- [ ] Two-stage faceted search ranking per master §5.10 — the current implementation is basic matching, not the specified two-stage rank (docs claim: MASTER-CHECKLIST §5.10 is marked `- [x]` with a ⚠️ noting "basic search exists, no two-stage ranking")
- [ ] Dedicated spec file for the search module (currently only covered indirectly through tours specs)

### Media gallery

- [x] Endpoints: `POST upload`, `POST upload/async`, `GET sign`, `POST confirm`, `GET /`, `GET excluded-urls`, `GET :id`, `PATCH :id`, `DELETE bulk`, `DELETE :id`, `DELETE public/:publicId`
- [x] `cloudinary.service.ts` (upload, optimized URL, delete, signed params, asset verification)
- [x] `media-upload` BullMQ queue + `media-upload.processor.ts` backing `POST upload/async`
- [x] Metadata, editable metadata and dimension columns (migrations `20260719091812`, `20260719102130`, `20260719103359`)
- [x] All web mimetypes supported (image/svg/video/audio) with sort + type filtering
- [x] Size-aware Cloudinary transform policy (2× upscale behind a width gate — 4× risks timeouts)
- [ ] Spec file for `cloudinary.service.ts` (uncovered; `media-gallery.service.ts` is covered)

### Settings

- [x] Settings endpoints: `GET site`, `GET public/site`, `GET public/seo`, `GET public/social-media`, `GET public/company`, `PATCH site`, `GET/PATCH seo`, `GET/POST/PATCH payment/stripe`, `GET/POST/PATCH payment/mollie`, `GET/POST/PATCH company`, `GET/PATCH social-media`, `GET/PATCH mailchimp`
- [x] Payment credentials stored encrypted at rest in the database (`ENCRYPTION_KEY`), never in `.env`
- [x] SEO settings incl. Cookiebot CBID (migration `20260718092016_site_seo_cookiebot_cbid`)
- [x] Social-media YouTube/TikTok fields (migration `20260718083304_social_media_youtube_tiktok`)
- [x] SMTP settings surface removed when Resend landed (`/settings/smtp` API + `smtp_configuration` table dropped)
- [x] Settings e2e suite (`test/settings.e2e-spec.ts`)
- [ ] Rename the lowercase `mollieConfiguration` Prisma model to match the schema's naming convention

### Tiers / ranking / eligibility / spotlight

- [x] Tour tier columns `tierKey` (default `standard`), `commissionTier` (default 20.0), `tierRank` (default 5), `tierLockedUntil`, `qualityScore`, `firstPublishedAt`, `eligibilityState` (+ `graceStartedAt`, `graceMetric`), `isBookable`
- [x] `PATCH /tiers/tours/:tourId/tier` — updates all three tier fields together, sets `tierLockedUntil = now + 30 days`, rejects changes while locked, and never lets the client write `tierRank`
- [x] Ranking order `tier_rank ASC, quality_score DESC, id ASC` applied on category, listing and search result sets
- [x] Bookability filter excluding `status != active`, `is_bookable = false`, or no open departure within 30 days
- [x] Diversity pass after ranking so one operator cannot dominate the top of a result set
- [x] Nightly `recomputeQualityScores` as the only writer of `quality_score` (read-only at query time)
- [x] `runEligibilityLifecycle`: 90-day one-time provisional window from first publish → nightly bar check → grace → auto-demote to the highest still-qualifying tier, with existing bookings keeping their snapshotted commission
- [x] Spotlight request/approval: `POST /tiers/tours/:tourId/spotlight`, `GET /tiers/tours/:tourId/spotlight`, `GET /tiers/admin/spotlight`, `PATCH /tiers/admin/spotlight/:id/approve`, `PATCH /tiers/admin/spotlight/:id/reject`
- [x] Spotlight invariants: 35% commission, transactional max-3-per-destination cap, extra bar (≥10 reviews, rating ≥4.5), manual approval, separate block (never interleaved)
- [x] `runSpotlightLifecycle`: APPROVED→ACTIVE at `startsAt`, ACTIVE→EXPIRED at `endsAt`, mirroring `tour.isSponsored`
- [x] `effectiveCommissionRate(tourId, at)` spotlight overlay consumed by booking quote + reserve and snapshotted, never retroactive
- [x] `deposit_pct` tier-driven (20–30 in 2.5 steps), surfaced read-only to operators
- [~] Eligibility flat bar is missing its third gate: `tiers.service.ts:830` carries a TODO to also require `operator.cancellation_rate_90d <= 10%`, so today only "≥5 approved reviews" and "rating ≥4.0" are enforced. Blocked on the operator E.6 field (docs claim: MASTER-CHECKLIST §7.2 marks the flat bar `- [x]` "5 reviews / 4.0 / ≤10% cancellation, min 10 bookings")
- [~] `ForceMajeurePardon` exists as a model but is inert: it has **no admin CRUD endpoint** and the eligibility engine never consumes it, so a hurricane day cannot actually be pardoned. Its only reference is a `select` in `operators.service.ts` (docs claim: MASTER-CHECKLIST §7.2 marks force-majeure pardons `- [x]`)
- [~] Clear `isSponsored` on spotlight cancellation — the lifecycle mirrors the flag on activate/expire, but a manually cancelled/revoked spotlight can leave `tour.isSponsored = true`, keeping a paid highlight on a tour that no longer has one
- [ ] Apply the "only at ≥10 confirmed bookings in the trailing 90-day window" denominator guard to the cancellation-rate gate (depends on the operator field)
- [ ] Suppress tier billing during an unbookable period (an excluded tour must not be billed for its tier)

### Availability & departures

- [x] Three-table model: `AvailabilitySchedule` (tour × weekday × startTime, capacityOverride, validFrom/Until), `AvailabilityException` (`close_date` / `close_slot` / `add_slot` / `set_capacity`), `Departure` (unique per tour+date+startTime, capacity, bookedCount, status, soldOutAt, source, manuallyEdited)
- [x] Schedule CRUD: `POST/GET schedules`, `PATCH/DELETE schedules/:id`, with slot-set validation against `Tour.startTimes` and Monday=0 weekday indexing
- [x] Exception CRUD: `POST/GET exceptions`, `PATCH/DELETE exceptions/:id`
- [x] `availability-materializer.service.ts` — expands schedules + exceptions into concrete departures, never touching departures with bookings, manual edits or `source = api`
- [x] `POST /availability/materialize` on-demand materialization (90-day default window at create time)
- [x] `materializeAllLive()` nightly rolling window (364 days, `MAX_HORIZON_DAYS = 365`)
- [x] `POST /availability/check` and `POST /availability/calendar` read contracts with live cutoff enforcement and a "remaining < 5" disclosure
- [x] `GET departures` / `PATCH departures/:id` operator portal endpoints (blackouts, close-today, capacity edits)
- [x] `computeIsBookable` / `refreshIsBookable` / `recomputeAllBookable` implementing "EXISTS an open departure within 30 days" (`BOOKABLE_HORIZON_DAYS = 30`)
- [x] `resyncTourAvailability` after schedule/exception edits
- [x] `CLOSE_DATE` / `CLOSE_SLOT` correctly close BOOKED departures with capacity/booking counts protected
- [x] `AVAILABILITY_UPDATE` notification emitted on inventory change
- [~] A newly created schedule only materializes 90 days ahead and depends on the 3 AM cron to reach the full 12-month horizon — a sharp edge documented in the booking checklist that has no mitigation in code
- [ ] All-sold-out recovery path (surfacing/recovering a tour whose every departure is sold out)
- [ ] `CHECK (booked_count <= capacity)` database constraint as a negative-inventory backstop
- [ ] Concurrency/load test suite firing 50/100/500 simultaneous reservations at 1-seat and N-seat departures, asserting exactly `capacity` succeed and the counter never goes negative
- [ ] iCal export feed of departures for operators, and optional iCal import writing `availability_exceptions` (never mutating capacity directly) with `ical_sync_logs`

### Bookings

- [x] `Booking` model fully expanded to master E.8: `uuid`, `publicRef`, `displayRef` (IT-2026-XXXXX), `resellerReference`/`supplierReference`, `status`, `freesale`, `testMode`, `utcExpiresAt`/`utcConfirmedAt`/`utcRedeemedAt`, `paymentModel`, `onArrivalPayment`, `currency`, `localDate`/`startTime`, tour start/end/timezone, pickup snapshot, `exclusiveDeparture`, money + commission block, split contact fields, billing + card snapshot, `conversionFiredAt`
- [x] `BookingUnitItem` (one row per traveler, retail/net pricing, ticket fields) and `BookingAddOn` (snapshotted line items)
- [x] `POST /bookings/quote` — server-authoritative stateless quote (per-line breakdown, deposit/balance, commission, FX source + booking snapshot, 15-minute expiry), `@Public()`, routed before `:id`
- [x] `POST /bookings` reserve — single atomic guarded `UPDATE departures` (`WHERE status='open' AND booked_count + seats <= capacity`, 0 rows → fail) inside the same transaction that creates the booking, unit items and add-on snapshots
- [x] Reserve validation: tour exists, departure belongs to the tour, cutoff not passed, party min/max, add-ons active and owned by the tour, pickup belongs to the tour
- [x] All party bands including infants/spectators count toward capacity (one unit item each)
- [x] `UNIT` + `PRIVATE` whole-departure exclusivity: exclusive claim guarded by `status=open AND booked_count=0`, released on cancel/expiry via `Booking.exclusiveDeparture`
- [x] `POST /bookings/:id/confirm` and `confirmFromPayment` with an atomic guarded `ON_HOLD → CONFIRMED` transition
- [x] `POST /bookings/:id/extend` (push `utcExpiresAt`, only while `ON_HOLD`) and `PATCH /bookings/:id`
- [x] `POST /bookings/:id/cancel` — releases seats, marks unit items + booking CANCELLED with `cancelledBy`/reason/timestamps, in a transaction, recomputing departure status (SOLD_OUT → OPEN)
- [x] Refund eligibility judged at the request timestamp, not the admin action; deadline computed as tour start − `cancellationHours`, never stored
- [x] Operator-forced cancellation path (`force`) → full refund / free reschedule
- [x] `expireStaleHolds()` — finds `ON_HOLD` past `utcExpiresAt`, releases seats, marks unit items + booking EXPIRED, idempotent
- [x] `GET /bookings` list with search on refs/guest/tour, `paymentModel` and `cancellationRequested` filters, and `BookingListItemDto` incl. `requestedInFreeWindow` judged at the request instant
- [x] `GET /bookings/:id`, `GET /bookings/me/summary`
- [x] `POST /bookings/lookup` + `POST /bookings/lookup/recover-reference` with per-credential caps (5/email, 10/reference per 15 min) via `lookup-rate-limiter.ts`, plus audit + lockout logging
- [x] Traveler session: 24h HMAC email-bound token (`traveler-session.util.ts`), masked-vs-verified TYP render, `cancellation-request` 401s without an owning session
- [x] `GET /bookings/typ/:publicRef` — public TYP payload with conversion object gated on CONFIRMED + non-null EUR commission, plus cancellation state (`cancellationRequestedAt`, `cancelledAt`, `canRequestCancellation`, `cancellationBlockedReason`)
- [x] `POST /bookings/typ/:publicRef/resend` (hard-throttled, recipient never caller-supplied) and `GET /bookings/typ/:publicRef/calendar.ics` (RFC 5545)
- [x] `POST /bookings/typ/:publicRef/cancellation-request` + `POST /bookings/:id/cancellation-request` stamping `utcCancellationRequestedAt` on first request, with `cancellationEligibility` refusing repeats (ALREADY_REQUESTED / NOT_CONFIRMED / DEPARTED → 409)
- [x] `OPERATOR_FULL` rejected with 422 in v1 per the founder decision (the confirmed-at-commit path is retained for its v2 return)
- [x] Snapshot invariants: later tier/price/age-band/add-on/pickup edits never mutate an existing booking
- [~] Age-restriction validation only enforces the tour minimum age, and only when `travelerAge` is supplied — there is no maximum age and no requirement that supplied ages cover every seat
- [~] Refund computation returns only a FULL/NONE **category**; there is no payment-model-aware amount (deposit-only vs full) and no partial refund
- [ ] Execute the actual Stripe refund and write a `REFUND` `Payment` row on cancellation (today refunds are categorized, never issued)
- [ ] Reconcile a payment that succeeds after the hold expired — `confirmFromPayment` only confirms an `ON_HOLD` booking, so a late settlement must be voided/refunded rather than silently stranded
- [ ] Capture attribution at reserve: `gclid`/`gbraid`/`wbraid`/`fbclid` and `utm_*` are columns on `Booking` but are absent from `ReserveBookingDto` and never written, breaking conversion adjustments and affiliate attribution
- [ ] Split the generic `clickId` column into the distinct `gclid` field the tracking spec names
- [ ] Operator non-payment / forfeit flow: operator reports non-payment → admin confirms → only that confirmation forfeits the deposit and releases the spot (never automatic)
- [ ] Coupon/discount engine — the untrusted client-supplied `discountAmount`/`couponCode` fields were deliberately removed; re-add only behind a server-side `Coupon` validation engine
- [ ] DB-backed `BookingQuote` model with input-hash revalidation so a quote cannot be replayed against different items
- [ ] Booking-lookup login by email + `display_ref` (the B.34 account fallback for lost confirmation emails)
- [ ] Controller-level spec for `bookings.controller.ts` (the service has 6 spec files; the controller has none)

### Payments & Stripe / Mollie

- [x] `stripe.service.ts` complete: `isConfigured`, `webhookSecret`, `publishableKey`, `paymentMethods`, `createPaymentIntent`, `refundIntent`, `retrieveCharge`, `retrievePaymentIntent`, `constructEvent`
- [x] `POST /payments/bookings/:id/intent` — PaymentIntent idempotent per `(bookingId, kind)` via a Stripe idempotency key + a deterministic `Payment` row id
- [x] Charge currency is always `Booking.currency`, never `Tour.defaultCurrency`
- [x] `chargeFor` per payment model: `OPERATOR_LINK`/`ON_ARRIVAL` → deposit, `PAID_IN_FULL` → total, `OPERATOR_FULL` → null
- [x] `POST /payments/webhook` — `@Public()` + `@SkipThrottle()`, raw-body signature verification, event id recorded in `stripe_webhook_events` **before** processing, rethrows so Stripe retries
- [x] `onIntentSucceeded` → Payment SUCCEEDED, booking `ON_HOLD → CONFIRMED`, billing + card snapshot pulled from the provider
- [x] `POST /payments/typ/:publicRef/settle` — synchronous settle-on-return that re-reads the PaymentIntent from Stripe (never trusting the client), race-hardened with atomic guarded `updateMany`s so exactly one of settle/webhook emits emails and fires the conversion, plus a 5/publicRef/min `TargetRateLimiter`
- [x] `GET /payments` list (`VIEW_PAYMENTS`, operator-scoped via `booking.operatorId`, filters on status/kind/provider/search/created-range)
- [x] `Payment` model with kinds DEPOSIT / BALANCE / FULL / REFUND, plus `StripeWebhookEvent` and `MollieWebhookEvent` idempotency tables
- [x] Encrypted-at-rest Stripe credentials read from `stripe_configuration` (never `.env`) behind a stable `ENCRYPTION_KEY`
- [x] Card collected inline via Stripe Card Elements (no Stripe-hosted UI); PayPal + iDEAL as redirect methods gated by `automatic_payment_methods`
- [~] **Mollie webhook reconciliation never settles a booking.** `handleMollieWebhook` writes an idempotency row to `mollie_webhook_events`, marks it processed and logs "reconciliation pending" (`payments.service.ts:321` `TODO(payments)`). It does not fetch the Mollie payment, map its status, update the `Payment` row, or call `confirmFromPayment` — so **any Mollie-paid booking stays `ON_HOLD` forever**. There is no Mollie SDK in `package.json` and no `mollie.service.ts`; Mollie is schema + config + webhook ledger only
- [ ] Add the Mollie SDK dependency and a `mollie.service.ts` (payment fetch, status map, refund) mirroring `stripe.service.ts`
- [ ] Attach the provider invoice to the confirmation email
- [ ] Controller-level spec for `payments.controller.ts`

### FX & multi-currency

- [x] `FxRate` model as an immutable rate history — one active row per pair, `Decimal(18,8)`, `provider`/`providerAsOf`/`expiresAt`/`isActive`; a refresh writes a new row and deactivates the prior one
- [x] `FxProvider` interface + `FX_PROVIDER` DI token as the swappable seam, so no booking or tour code touches a provider response shape
- [x] `FxRatesService` with two deliberate rate paths: `getRate`/`convert` (fresh-only, lazy refresh once, **fails closed with 503** — used by quote + reserve) and `getDisplayRate`/`buildMoney` (stale allowed within a window, falls back to source currency at rate 1 — used by public reads)
- [x] Same-currency short-circuit to rate 1 with no DB or provider call; all math in `Decimal`, rounded HALF_UP to 2dp at the line boundary
- [x] `FxRefreshService` — startup `refreshRates()` in `onApplicationBootstrap` plus a dynamic `SchedulerRegistry` interval every `FX_RATE_REFRESH_MINUTES` (default 30, well inside the 120-minute TTL), non-fatal on failure, interval cleared on destroy
- [x] Booking-time FX snapshot: `sourceCurrency`, `sourceTotalRetail`/`DepositAmount`/`BalanceAmount`, `sourceFxRateToBooking`, `fxRateToEur`, `totalEur`, plus provider/asOf audit fields — never refetched at payment/TYP/email/tracking time (migration `20260715221643`)
- [x] `MoneyDto` public display object `{currency, sourceCurrency, fxRate, priceFrom, basePrice}` with `?currency` on `/tours`, `/tours/slug/:slug`, `/tours/:id`, `/search`, `/collections/render/:slug`, `/hubs/render/:slug`, `/hubs/:id/our-picks`, `/hubs/:id/comparison`
- [x] FX env vars validated as positive numbers when set: `FX_USD_TO_EUR`, `FX_RATE_TTL_MINUTES`, `FX_RATE_STALE_DISPLAY_HOURS`, `FX_RATE_REFRESH_MINUTES`
- [~] **Only `StaticFxProvider` is implemented and it is bound in every environment.** It derives USD⇄EUR from `FX_USD_TO_EUR` (default 0.92) with no network call; its own docblock says "never ship this static rate to production". The consequence is that production does not genuinely fail closed on cross-currency — it silently leans on a hardcoded constant, so every converted price and every EUR commission is computed off a stale invented rate
- [ ] Implement a real `FxProvider` (Stripe FX Quotes recommended, so the displayed converted amount and the charged PaymentIntent share one locked quote) and rebind `FX_PROVIDER` in `FxModule` — one class plus one line, the seam is ready
- [ ] Make `FX_PROVIDER` / `FX_PROVIDER_API_KEY` actually select the provider (both are documented but consumed by nothing; the binding is hardcoded)
- [ ] Wire locale→display-currency defaults (EN/ZH → USD, others → EUR)

### Settlement & payouts

- [ ] Add the `Settlement` model + `SettlementStatus` enum (`RECORDED | PAID_OUT | INVOICED | SETTLED`) with `bookingId` unique, `operatorId`, `paymentModel`, `amountCollected`, `commissionOwed`, `netPosition`, `currency`, `operatorPayout`, `settledAt`, `externalRef`
- [ ] Write exactly one settlement row per booking at confirmation, on every payment model (deposit models record a `netPosition ~ 0` row)
- [ ] Enforce the sign convention in writes: positive `netPosition` = Island Tours owes the operator, negative = the operator owes Island Tours
- [ ] `paid_in_full` scheduled payout released **after the cancellation window closes** (clawback-safe): `RECORDED → PAID_OUT` with `operatorPayout` set
- [ ] Assert the self-settling invariant for deposit models (`deposit_pct == commission` per tier); reconcile any residual through the ledger when they diverge
- [ ] v2: reintroduce `operator_full` with its commission-collection rail (Stripe Connect application fee, or self-billed monthly invoice + SEPA/card-on-file mandate + listing suspension on non-payment)
- [ ] v2: onboard operators as Stripe Connect Express accounts and migrate deposit + `paid_in_full` models to destination charges with `application_fee_amount = commission`, populating the ledger from Stripe events instead of manual entry

### Reviews & platform reviews

- [x] Reviews module: `POST /`, `GET /`, `GET summary`, `GET mine`, `GET pending`, `POST :id/helpful`, `POST :id/response`, `PATCH :id/moderate`, `DELETE :id`, `GET :id`
- [x] Booking-gated submission (one review per confirmed/completed booking, ownership enforced)
- [x] Moderation queue + `moderate` + operator `respond` + `markHelpful`
- [x] `review-display.util.ts` implementing the LD11 cold-start rule (own rating at ≥3 reviews, else the operator aggregate when the operator has ≥10 reviews at ≥4.0), surfaced through `GET /reviews/summary`
- [x] Rating distribution + photo-review count feeding the star chart and photo carousel gates
- [x] Approved-reviews-only aggregates feeding tour ranking and `quality_score`
- [x] Platform reviews module: `GET /platform-reviews/public`, `GET/PUT config`, `POST refresh` — encrypted-at-rest third-party API key returned masked, 12h cache TTL, stale-on-failure, 8s fetch timeout, `MIN_REVIEWS = 100` social-proof gate, `MAX_REVIEWS = 6` (migration `20260718140717`)
- [~] `ReviewTranslation` is declared in the schema but **completely unwired** — there are zero `prisma.reviewTranslation` references in `src`, so the per-locale review text + LD32 translation cache does not exist despite the model (docs claim: MASTER-CHECKLIST E.7 marks per-locale text + translation cache `- [x]`)
- [ ] Explicit `reviewer_type` enum — the model treats every review as implicitly verified rather than typing the reviewer
- [ ] Spec file for `platform-reviews.service.ts`

### Wishlist

- [x] Wishlist module: `GET resolve`, `GET /`, `GET ids`, `POST :tourId`, `DELETE :tourId` with `list`/`resolveByIds`/`listIds`/`add`/`remove`
- [x] Session/auth-aware wishlist ownership
- [ ] Spec file for `wishlist.service.ts` (no test coverage at all)

### Home page CMS

- [x] `HomePage` singleton model (`id @default("default")`) with `heroImage`, `editorialImages[]`, `editorialDestinationId`, `ogImage`, plus `HomePageTranslation` (migrations `20260720131212_home_page_content`, `20260720151119_faq_page_type_homepage`)
- [x] Endpoints: `GET /home-page/public`, `GET /home-page`, `PATCH /home-page`, `GET/PATCH translations/:locale`
- [x] Homepage FAQ groups: `GET/POST :entityId/faqs/groups`, `PATCH/DELETE :entityId/faqs/groups/:groupId`, `PUT :entityId/faqs/groups/:groupId/translations/:locale`
- [ ] Manual UI verification of the homepage editor against the rendered public page (the module shipped unverified)

### Pages / CMS

- [ ] `Page` model + module for arbitrary editorial pages (slug, status, per-locale translations, SEO fields, page-content blocks) — nothing exists in `src` or `prisma` today
- [ ] Rich-text storage + sanitization contract for TipTap-authored page bodies
- [ ] Register `PAGE` in the slug registry / routing resolver so CMS pages get first-class URLs
- [ ] Resolve the two outstanding product decisions blocking the Pages phase before building

### Featured experiences

- [x] `FeaturedExperience` model with a destination FK (migration `20260720133830_featured_experience_destination_fk`)
- [x] Endpoints: `GET /featured-experiences/public`, `GET /`, `POST /`, `PATCH :id`, `DELETE :id`
- [x] `resolvePublic` resolves the referenced category/hub entities for the homepage "Top Island Experiences" block
- [x] Enforce that only categories and hubs (never individual tours) can be featured

### Notifications & email

- [x] `mail.service.ts` on Resend (`resend ^6.17.2`; migrations `20260719105059` / `20260719105425_resend_replaces_smtp` removed SMTP) with ten implemented send methods: `sendMail`, `sendPasswordResetEmail`, `sendOperatorInviteEmail`, `sendCustomerWelcomeEmail`, `sendStaffInviteEmail`, `sendVerificationEmail`, `sendBookingConfirmationEmail`, `sendBookingNoticeEmail`, `sendCancellationRequestEmail`, `sendOperatorBookingReceivedEmail`
- [x] Wireframe-exact booking confirmation HTML template rendered by `email-template.renderer.ts` — payment-model-aware, zero-amount rows hidden, `[EACH]` bullet lists, operator-note card, 24h times, locale money/date formatting, real text/plain part, `<24h` subject variant
- [x] Operator "Booking Received" template on every confirmed booking, per-model action copy, sent to `companyInfo.companyEmail ?? contactEmail`
- [x] Cancellation-request emails ×3 (admin work item, traveller ack, operator heads-up) via the shared `booking-notice.template.html`
- [x] Cancellation-confirmed notices to traveller + operator once an admin processes the request, with refund-verdict-aware copy, best-effort and skipped for `heldOnly` hold releases
- [x] Dark-mode-safe logo (`email-logo.util.ts` Cloudinary white-chip transform + `color-scheme: light` on all four shells)
- [x] TS templates for customer welcome, email verification, operator invite, password reset, staff invite, plus `auth-email-shell.ts` and 10 inline SVG icons
- [x] OCTO outbound webhooks: `NotificationSubscription` + `NotificationDelivery` models, subscription CRUD at `/octo/notifications/subscriptions`, `GET :id/deliveries` audit, `emitAvailabilityUpdate` / `emitProductUpdate` / `emitBookingUpdate`
- [x] `notification-delivery` BullMQ queue + processor with HMAC signing (`notification-signing.util.ts`)
- [ ] **Operator balance email on `operator_link`** — the master's mandatory second email that names the operator and carries the secure balance link. No template exists, so the confirmation email's C2 foreshadow promises an email that is never sent
- [ ] Pre-tour reminder email 24h before start ("today"/"tomorrow" variant, no payment links ever), suppressed when the booking was made inside 24h
- [ ] Postmark fallback provider behind the Resend primary
- [ ] Verify in template copy that the operator is never named or spotlighted pre-payment and is deliberately named post-booking on `operator_link`
- [ ] Dead-letter handling for notification deliveries after N failed attempts

### Tracking

- [x] `tracking.service.ts` — Meta Conversions API with SHA-256 advanced matching (email, phone, first/last name, city, postal code, country), `eventId` = booking `publicRef` shared with the browser Pixel for dedup
- [x] Conversion value is `commission_amount` in EUR, never GMV; a confirmed booking with a null `commission_amount` is treated as data corruption and fires nothing
- [x] Mark-first idempotency: `conversionFiredAt` stamped server-side in `finalizeConfirmation` before the conversion payload is exposed (DB guard, never `localStorage`)
- [x] Config-gated no-op with a single warn log when `META_PIXEL_ID` / `META_CAPI_TOKEN` are unset; the service never throws
- [x] TYP conversion object gated on CONFIRMED + non-null EUR commission
- [ ] Capture click ids + UTM at booking creation so cancellation/refund adjustments and offline conversions can be posted back to Google Ads and Meta
- [ ] CI type-check of the `booking_complete` payload contract so a missing required field is a build error rather than a runtime fallback
- [ ] Hash the customer email into a `customer_id` for the GA4 `user_id` cross-device field (deferred)
- [ ] Cancellation/refund conversion adjustments posted to the Google Ads and Meta APIs

### Analytics

- [x] `GET /analytics/dashboard` aggregate endpoint under `VIEW_ANALYTICS`, replacing the old 22-request dashboard fan-out
- [x] Role-shaped revenue: admin sees commission, operator sees retail minus commission
- [x] Revenue recognized on completion (`REDEEMED`), with `pendingEur` reported separately and never summed into earned
- [x] EUR normalization through each booking's snapshotted `fxRateToEur` (fixes mixed USD/EUR summing)
- [x] Refund double-count trap handled by counting `kind = REFUND` rows only, never `status = REFUNDED`
- [x] Customers counted as distinct bookers via `COALESCE(userId, lower(contactEmail))` so guest checkout is included
- [x] Real month/day trend series bucketed by recognition date; booking-outcome funnel; payment-model mix; top tours/operators/destinations; tier breakdown
- [x] Dual-currency display from one live EUR→USD rate, falling back to EUR alone when no fresh rate exists
- [x] `payoutDueEur` (PAID_IN_FULL liability) and `untrackedBalanceEur` (operator-rail balance) surfaced with explicit caveats
- [x] Honesty rule enforced in code: zeros are real query results and unbacked cards were deleted rather than faked
- [ ] Turn `payoutDueEur` from *earned* into *unsettled* once the settlements ledger exists
- [ ] Pre-booking funnel (views, add-to-cart) — requires a tracking event store that does not exist

### OCTO

- [x] Naming convention locked: `tour` everywhere (DB, code, routes, JSON) instead of OCTO's wire term `product`
- [x] Capabilities middleware parsing `Octo-Capabilities` (+ `_capabilities` query), exposing the active set to serializers and echoing it in the response header; applied `forRoutes('octo')`
- [x] Locale negotiation via `Accept-Language` → `Content-Language` (`octo-locale.ts`)
- [x] Money serializer converting `Decimal` → `{amount (minor units), currency, currencyPrecision}` with the `Pricing` object (original/retail/net, includedTaxes) — DB money types unchanged (D2)
- [x] OCTO error filter emitting the flat `{error, errorMessage, <contextId>}` envelope with OCTO codes, bound per controller
- [x] `GET /octo/supplier` — platform-as-supplier (D4) from `SiteInfo` + `CompanyInformations`, contact + media + request-derived endpoint
- [x] `GET /octo/tours` and `GET /octo/tours/:tourId` core serializer (id, internalName, reference, locale, timeZone, allowFreesale, instantConfirmation, instantDelivery, availabilityRequired, availabilityType, deliveryFormats, deliveryMethods, redemptionMethod, options[])
- [x] Persisted `TourOption` / `TourUnit` (D3 schema landed — no synthesis needed), units sourced from age bands with restrictions + pricing
- [x] `octo/content` serializer (features, media, faqs, locations, commentary, categoryLabels, durations) and `octo/pricing` serializer (defaultCurrency, availableCurrencies, pricingPer, pricingFrom)
- [x] OCTO notifications surface at `/octo/notifications/subscriptions` with the three spec event types
- [~] Availability is OCTO-shaped but mounted natively — `POST /availability/check` and `POST /availability/calendar` live under `/availability`, not under the `/octo` namespace, so an OCTO client cannot reach them at the spec path
- [~] **There is no `/octo/bookings` surface.** The OCTO reserve → confirm → cancel → extend lifecycle is not exposed; native booking lives entirely at `/bookings`, so a third-party OCTO consumer can read the catalog but cannot transact
- [ ] Pagination on the OCTO tour list — it currently returns the full LIVE catalog as a bare tier-ranked array (decision D5 still open)
- [ ] `Octo-Env` (live/test) header handling wired through to booking `testMode`
- [ ] `Available-Languages` response header
- [ ] OCTO DTO classes for Swagger (responses are spec-shaped but undocumented as types)
- [ ] `/products` → `/tours` and `productId` → `tourId` compatibility aliases for strict-OCTO consumers (decision D11)
- [ ] Reconcile the overlapping OCTO and E.8 identifier pairs (`public_ref` ↔ `uuid`, `display_ref` ↔ `resellerReference`) — decision D6
- [ ] `octo/pickups` and `octo/dropoffs` capability implementations

### Workers / queues / nightly jobs

- [x] Two live BullMQ queues, each with a real `@Processor`: `media-upload` (async Cloudinary uploads) and `notification-delivery` (HMAC-signed OCTO webhook fan-out), both on `buildRedisConnection()`
- [x] `NightlyJobsService` `@Cron(EVERY_DAY_AT_3AM, timeZone: 'UTC')` running six jobs in dependency order — spotlight lifecycle → likely-to-sell-out → materialize all live → recompute bookability → recompute quality scores → eligibility lifecycle — and separately invokable for admin/seed/tests
- [x] Best-effort public-cache revalidation (`workers/public-cache.service.ts` → `revalidateTags(['tours','search'])`) that never fails the nightly job
- [x] FX refresh on an in-process dynamic interval (deliberately not BullMQ — an idempotent recompute, not a retry/concurrency queue)
- [~] Nightly jobs run on in-process `@nestjs/schedule`, not the BullMQ repeatable cron the queues doc specifies — so they carry no retry/backoff, no run-date guard, no failure visibility, and **will double-run the moment a second replica is started**
- [~] Fix the stale docblock TODO at `workers/nightly-jobs.service.ts:22` claiming quality-score and eligibility are "when built" — both are already invoked inside `run()`; the comment is wrong, not the code (docs claim: BOOKING-CHECKLIST §13 repeats the same stale claim that "quality-score + tier eligibility/grace/demotion are TODOs")
- [ ] **Schedule the hold-expiry sweeper.** `expireStaleHolds()` exists but nothing calls it, so expired holds keep their seats indefinitely and produce phantom sold-outs
- [ ] Transactional outbox: an `OutboxEvent` model written inside the booking transaction (`booking.confirmed`, `booking.cancelled`, `payment.succeeded`, `hold.expired`) plus a relay that publishes to BullMQ and marks rows dispatched
- [ ] Move the confirmation email onto a queued job with `attempts` + exponential backoff instead of the inline send
- [ ] Move the CAPI conversion onto a queued job idempotent by event id — today `conversionFiredAt` is stamped *before* the inline email/CAPI run, so a failure loses the conversion permanently with no retry
- [ ] Delayed `settlement.paid-in-full-payout` job released after the cancellation window
- [ ] Delayed `booking.pre-tour-reminder` job (24h before start, delay computed from tour-local time, state re-checked in the consumer)
- [ ] Delayed `affiliate.postback` job (on-hold at booking, approved after the window)
- [ ] Add `jobId` dedup on top of the existing DB guards once jobs move to the queue (never relying on `jobId` alone, given `removeOnComplete`)
- [ ] Retain failed jobs (`removeOnFail: false` or a numeric retention) and surface them via Bull Board or an admin view so a stuck payout/conversion is visible
- [ ] Redis lock (or single-scheduler instance) so cron jobs cannot double-run under horizontal scaling
- [ ] Spec files for `nightly-jobs.service.ts` and `public-cache.service.ts` (the whole `workers/` module is untested)

### Webhooks

- [x] Stripe webhook endpoint bypassing AuthGuard and ThrottlerGuard (`@Public()` + `@SkipThrottle()`), verifying signatures against a raw body and deduplicating via `stripe_webhook_events`
- [x] `mollie_webhook_events` idempotency ledger table
- [x] Outbound OCTO notification webhooks with HMAC signing, BullMQ delivery and a `notification_deliveries` audit trail
- [~] The Mollie inbound webhook is registered and idempotent but performs no reconciliation (see Payments)
- [ ] Retry/backoff + dead-letter policy for outbound notification deliveries
- [ ] Remove the dead `Webhooks` / `WebhookPoint` models that no webhook path uses

### Test coverage

Current state: **62 unit spec files in `src/` · 1283 `it()` blocks · 4 e2e suites in `test/`**
(`app.e2e-spec.ts` 3, `auth.e2e-spec.ts` 39, `settings.e2e-spec.ts` 20, `tours.e2e-spec.ts` 21 = 83 e2e assertions).
Heaviest coverage: bookings (6 specs), octo (5), mail templates (4), availability (3), tours (3), staff (3).

- [x] Unit specs for analytics, attributes, availability (3), bookings (6: service, pricing, ics, email context, lookup limiter, traveler session), categories (service + controller), collections, customers, destinations (service + controller), featured-experiences, fx (2), home-page (service + dto), hubs (service + controller), media-gallery (service + controller), mail templates (3 HTML + renderer), notifications (service + signing), octo (5), operators (service + controller), payments (service + stripe), reviews (service + display util), settings (service, controller, dto), staff (2 + config + permissions guard), tiers, tours (service, children, quality-score), tracking, users, common utils (fx, timezone, whatsapp, 2 validators)
- [x] e2e suites for app health, auth, settings and tours
- [ ] Spec file for `wishlist.service.ts` — the module has **no test coverage whatsoever**
- [ ] Spec file for the `slug-registry` module (`resolve()` plus the `slug-registry.util.ts` rename/301/cooldown logic, which is load-bearing for every public URL)
- [ ] Spec files for `workers/` — both `nightly-jobs.service.ts` (the six-job commercial pipeline) and `public-cache.service.ts` are untested
- [ ] Spec file for `platform-reviews.service.ts` (encrypted key handling, cache TTL, stale-on-failure, the 100-review social-proof gate)
- [ ] Spec file for `media-gallery/cloudinary.service.ts` (upload, signed params, delete, asset verification)
- [ ] Spec file for `common/faq/faq-group.service.ts` — the shared FAQ engine used by destinations, categories, hubs, collections and the home page
- [ ] Controller specs for `bookings.controller.ts` and `payments.controller.ts` (services covered, controllers not)
- [ ] Dedicated spec for the `search` module (only covered indirectly through tours specs)
- [ ] Concurrency/overbooking suite (50/100/500 simultaneous reserves) — the make-or-break test for the atomic seat claim
- [ ] Load test of the availability + reserve endpoints (p95 latency, error rate under burst)
- [ ] Refresh `auth.e2e-spec.ts`, which is stale now that sign-up is disabled and users must be provisioned through the Better Auth internal adapter

### Deployment / infra

- [x] Multi-stage production `backend/Dockerfile` (build → slim runner) with `.dockerignore`
- [x] `docker-entrypoint.sh` running `prisma migrate deploy` (+ optional seed via `RUN_SEED`) before start
- [x] `docker-compose.yml` production stack (postgres:16 + redis:7 with `--requirepass` + backend on `island-net`), Postgres/Redis unpublished, backend bound to `127.0.0.1:5050`
- [x] `docker-compose.dev.yml` local infra (postgres + redis on host ports, no Redis password)
- [x] `.env.example` (compose infra) + `backend/.env.production.example` (app secrets), with the 3-file rule for any new env var (`env.validate.ts` + both examples)
- [x] GitHub Actions `ci.yml` (lint + build + test) and `deploy-backend.yml` (SSH deploy to the VPS on push to main)
- [x] Tracked nginx site config `deploy/nginx/island-api.conf` with TLS via certbot and `X-Real-IP` / `X-Forwarded-For` forwarding
- [x] Redis AOF persistence (`--appendonly yes`) so queue state survives restarts
- [x] Rate limiter active in production with the `INTERNAL_API_SECRET` trusted bypass enforced at boot
- [ ] Automated database backups — nightly `pg_dump -Fc` cron with 14-day retention, pushed off-box to S3/Backblaze/R2, plus at least one tested restore
- [ ] Sentry error monitoring: `@sentry/nestjs` + `@sentry/profiling-node`, `instrument.ts` imported first in `main.ts`, `SentryModule.forRoot()`, and `SENTRY_DSN` added to `env.validate.ts` OPTIONAL + both env examples
- [ ] Docker log rotation (`/etc/docker/daemon.json` json-file, 20m × 5) plus a log viewer (Dozzle now, Loki+Grafana alongside metrics later)
- [ ] OpenTelemetry tracing — start with Sentry's built-in tracing, adopt the full OTel stack only when distributed traces or Prometheus metrics are needed
- [ ] Deep health check wired to an uptime monitor once `/health` actually pings Postgres and Redis
- [ ] Alerting on negative-inventory attempts and expiry-sweeper lag
- [ ] Retire the legacy `devripon-tr` pipeline, which is still armed alongside the current one
- [ ] Set `REVALIDATE_SECRET` in the deployed environment (the public-cache revalidation hook depends on it)

### Backend summary

**Done: 243 · Ongoing: 19 · Pending: 110** (372 tracked backend tasks across 34 module/domain sections).

The transactional core is far more complete than the technical docs assert — bookings, availability,
tiers/eligibility, Stripe, FX plumbing, staff/RBAC, email templates and the OCTO catalog are built and
tested. The genuine risk surface is narrow but severe: **Mollie can take money and never confirm a
booking**, **FX runs production on a hardcoded static rate**, **the hold-expiry sweeper is never
scheduled**, **there is no settlements ledger or outbox**, and **conversion/email fire inline after the
mark-first stamp, so a failure loses them permanently**. The largest untouched blocks are settlement
and payouts, the queue/outbox layer, the OCTO booking surface, the Pages/CMS module, and observability.

---

# PART III — PUBLIC FRONTEND TASK CHECKLIST

> Status is taken from the **code audit** of `frontend/` (`frag-code-frontend.md`), which overrides any
> claim made in the specification documents. Where a doc asserts something the code contradicts, the
> disagreement is noted inline as `(docs claim: …)`.
>
> Legend: `- [x]` DONE (built and backend-wired) · `- [~]` ONGOING (partial, mocked, or wired but
> incomplete) · `- [ ]` PENDING (not built).

---

## Foundation & design tokens

- [x] Next.js 16 App Router app with `cacheComponents: true` (PPR) enabled in `next.config.ts`
- [x] Tailwind v4 with `--it-*` design tokens registered in `@theme inline` (`frontend-tokens.css`)
- [x] `it-section` / `it-container` layout utilities used instead of hardcoded padding
- [x] Colour tokens for brand orange, peach tint, ink, secondary text, borders, trust green (§3.1)
- [x] Font stack wired (DM Sans, GeneralSans, Playfair, Noto, JetBrains) via root layout
- [x] `lib/motion.ts` canonical spring/fade constants as the single source of animation values
- [x] Remote image host allowlist derived from `lib/images/remote-hosts.ts`
- [x] `bg-it-border` image-fallback background convention on photo containers
- [~] Single icon system (§3.3 / LD20): Figma SVGs in `public/icons/` + `lucide-react` for generic affordances — no audit that all meta-row icons share one library, stroke weight and 16–20px size (Fix 6)
- [ ] WCAG AA contrast verification pass across tokens (§3.1 mandates it; no evidence of an audit)
- [ ] Container width reconciliation: master locks **1200px** and a **3-column** desktop listing grid; the codebase ships a 1440 container and a 4-column grid standard `(docs claim: §3.2 1200px / 3-col)`
- [ ] Typographic separator system enforced platform-wide (Tier 1 middot · Tier 2 comma · Tier 3 `›`; pipe retired) — no shared separator helper exists

## Layout / nav / footer

- [x] Root layout with fully dynamic `generateMetadata()` reading `getPublicSiteInfo()` + `getPublicSiteSeo()` (dashboard-managed title/desc/keywords/robots/canonical/favicon/OG/Twitter)
- [x] `(frontend)` layout `.frontend-root` wrapper
- [x] `[locale]` layout with `generateStaticParams` over all 7 locales + parallel dictionary/destinations/site-info fetch
- [x] Sticky navbar with destination-context state (logo, island selector, Categories dropdown, search, language switcher, wishlist, account)
- [x] Island/destination selector with localStorage persistence
- [x] Categories dropdown fed by live category data
- [x] Locale selector in nav
- [x] Wishlist link with live count
- [x] Account menu (cookie-driven traveler surface, no Better Auth on the public site)
- [x] Mobile menu
- [x] Global footer on every page (server component) with destination links, legal links, sign-off
- [x] Footer language + currency pills writing `NEXT_LOCALE` / `NEXT_CURRENCY` cookies (currency never in nav, §3.10)
- [x] Footer rendered fully expanded on mobile, never an accordion (§3.10)
- [~] Homepage nav variant: master requires the location selector to read "Select your island" with Categories and search **hidden** on the homepage (§3.9) — no evidence of a homepage nav variant in the audit
- [~] Nav search pill that expands on scroll (§3.9) — search + typeahead exist; the compact-to-expanded scroll behaviour is unverified
- [ ] Footer payment logo set in monochrome (VISA, Mastercard, PayPal, iDEAL, Apple Pay, Google Pay, Klarna, Amex) flush to the language pill's left edge (§3.10, §3.11)
- [ ] Footer "Powered by Stripe" badge in the slate variant (§3.1)
- [ ] Footer routes for the four inert labels (about, help, contact) — no routes exist
- [ ] `SmoothScroll` re-enabled (currently commented out in `(frontend)/layout.tsx`)

## Homepage

- [x] Route `(frontend)/[locale]/page.tsx` rendering Hero, TrustStrip, TopExperiences, Testimonials, ExploreIslands, EditorialBanner, FaqSection
- [x] Islands data live from `getActiveDestinations` (name, slug, tourCount, heroImage) for hero-popular and explore cards
- [x] Hero destination search field navigating to `/{locale}/{destination}/` on selection
- [x] Social proof / testimonials strip fed by live `getPlatformReviews()` and gated until the backend review threshold passes (§5.1 ≥100 reviews)
- [x] Editorial banner + card-fan section (launch-only slot, §5.1 section 7)
- [x] Homepage FAQ section component
- [~] Homepage CMS wiring: `getHomePageContent()` loader exists in `lib/api/public/home-page.ts` but has **ZERO callers** — hero title/subtitle, experiences heading, editorial copy and FAQ headings still render static dictionary text `(docs claim: HOMEPAGE-AND-PAGES A12.5 wired; A12.1 records the deliberate revert — restore from `git show ee2106f:…/page.tsx`)`
- [~] Featured Experiences wiring: `getFeaturedExperiences()` loader exists with the eligibility gate but has **ZERO callers**; `TopExperiences` renders bundled fallback cards and its `MIN_CURATED_CARDS = 3` curated path is never fed `(docs claim: HOMEPAGE-AND-PAGES A12.6 executed)`
- [~] CMS-managed hero image per locale (§5.1): `Hero` accepts an optional `image` prop the page never passes, so it always falls back to `FALLBACK_HERO_IMAGE = /images/kc-powerboat.jpg`
- [~] Micro trust bar below the hero: rendered, but content comes from the dictionary, not the CMS; the three locked Figma rows (label + clarification pairs, §5.1) are not verifiable as the shipped copy
- [ ] Hero H1 locked copy "We didn't discover the Caribbean. We grew up in it." with a per-locale translation test (§5.1, conflict log 71)
- [ ] Locked subheadline "Chosen by locals. Made for travelers." and locked placeholder "Which island?"
- [ ] Popular quick links row `Popular: Curaçao · Aruba · Sint Maarten`, CMS-ordered, horizontal scroll on mobile overflow
- [ ] Video carousel section (§5.1 section 4): center-active card with flanking partials, progress lines, 2.5 cards visible on mobile
- [ ] "Why Island Tours" section (§5.1 section 8)
- [ ] Full `NeedHelpSection` with FAQ column and the two locked checkmarks (§3.11, §5.1 section 9)
- [ ] Confirm no date field and no destination-scoped search on the homepage (§5.10 "No search on the homepage")

## Destination page

- [x] Route `(frontend)/[locale]/[destination]/page.tsx`, live `getDestinationBySlug` with a `notFound()` gate on `!isActive`
- [x] `generateStaticParams` from `getActiveDestinations` with 5 hardcoded launch-slug fallbacks (backend-down safe)
- [x] Destination hero + `HeroSearch` (search scoped to destination, single-month date picker)
- [x] Locals' favourites listing section, backend-fed by the `is_locals_favourite` editorial flag
- [x] Collections section fed by `getActiveCollectionsForDestination`
- [x] "Explore by type" category quick links
- [x] Destination About section from the destination model's SEO content
- [x] Streaming shell + `DestinationPageSkeleton`
- [~] Destination FAQ: renders, but reuses `dict.home.faq` static copy rather than destination-owned FAQ content
- [~] `DestinationInstagram`: **fully hardcoded** to 6 local `/images/home-page/...` files — no CMS or feed source
- [ ] H1 locked sentence case "{Destination} tours & activities" verification (§5.2, conflict log 65)
- [ ] Locked subheadline "Tours picked by locals who know every reef, route, and sunset spot."
- [ ] Featured tours CTA "See all {Destination} tours →" with the dynamic count only at ≥20 published tours (§5.2, C21)
- [ ] Category quick links constrained to 7–8 cards excluding All Experiences, 5–6 visible desktop / 2.5 mobile
- [ ] Destination description block enforced at 350–500 words with exactly 3 H2s (§5.2)
- [ ] Full `NeedHelpSection` with FAQ column per the trust matrix (§3.11)
- [ ] `loading.tsx` at the `[destination]` segment (gap G2 — non-prerendered islands hang on a blank body)

## All Tours page

- [x] Route `(frontend)/[locale]/[destination]/tours/page.tsx`, reserved `tours` slug, `RESERVED` registry entries redirect here
- [x] Static breadcrumb + trust strip in the prerendered shell
- [x] `ToursHeaderSection` with a cached tour count
- [x] `ToursListingSection` streaming behind `ToursListingSkeleton`, searchParams-driven
- [x] URL-driven pagination
- [x] `ToursEmptyState`
- [x] Filter bar + Filters modal (locked Filters-button pattern, not facet pills — 🔴 Must Fix satisfied)
- [x] Sort control locked to exactly 3 options (Locals' favourites default, Price low→high, Price high→low) — 🔴 Must Fix satisfied
- [x] Category chips in the filter row as navigation links to `/{locale}/{destination}/{category-slug}/` — 🔴 Must Fix satisfied
- [x] No "Explore by type" category-card section on All Tours — 🔴 Must Fix satisfied
- [~] Date pill (`tours-date-pill`) exists in the filter row, but `date` is not part of the tours URL filter model (Phase 3), so it does not actually filter availability
- [~] Trust strip below the grid: `ToursTrustStrip` renders, but the four locked checkmarks + "Questions? Chat on WhatsApp →" inline link and mobile vertical stacking are unverified (🟠 Important)
- [ ] 🔴 Must Fix — H1 "All {Destination} tours & activities in {year}" with `{year}` resolved at render time (never hardcoded), and `<title>`/meta using the same variable
- [ ] 🟠 Important — grid density locked to 18 per page (3×6) desktop; mobile 1 column with pagination after 12
- [ ] 🟠 Important — orientation line locked copy "From Klein Curaçao day trips to buggy adventures. Every tour we offer on the island.", CMS-managed per destination
- [ ] 🟠 Important — SEO content block position: moved above pagination (option A: above the grid) or expanded to 300+ words with internal category links
- [ ] 🟠 Important — final page stack verification: grid → pagination → trust strip → SEO block → footer
- [ ] Dual count: static "{Y} tours available" in the page header **plus** dynamic "{X} of {Y} tours" with dismissible applied-filter pills and "Clear all" in the grid header (§3.12, conflict log 62)
- [ ] Ranking transparency tooltip on the results counter (`32 tours ⓘ`), never on the sort dropdown
- [ ] Adults/travelers pill opening the 3-tier popover (Adults 12+, Children 4–11, Infants under 4) feeding age-based pricing and availability filtering — 🔴 Must Fix
- [ ] Filter row sticky on mobile with the vertical divider between search-context and category-navigation zones
- [ ] Peach tint on card #1 under the default sort only, dropped under price sorts (🟠 Important; §3.5 B.63)
- [ ] Diversity pass on listing order (never >2 tours of the same subtype consecutively, §3.8)
- [ ] `loading.tsx` at the `[destination]/tours` segment (gap G2)

## Category page

- [x] Rendered through the polymorphic `[destination]/[slug]` route via `resolveSlug()`
- [x] Live category data + page content + FAQs from `/categories/destination/:d/:c`, `/categories/:id/page-content`, `/categories/:id/faqs`
- [x] Ranked grid of shared tour cards
- [x] `generateMetadata` per category with canonical + 7 hreflang + x-default
- [x] `category-you-might-like` related-categories block
- [~] About/FAQ content falls back to a dictionary placeholder "until authored" rather than category-owned copy
- [~] Filter row reuse on category pages **without** the category chips (§5.4) — the tours filter row exists but category-page reuse is unverified in the audit
- [ ] ≥3-published-tours render gate enforced on the frontend (§2.4 / §5.4) — no gating logic evidenced in the route
- [ ] Category H1 template (C19, keyword-matched per category) — still undecided in the master, so unbuildable until locked
- [ ] Confirm no trust bar renders on category pages (§3.11 deliberate exclusion)

## Activity Hub page

- [x] Hub branch of `[destination]/[slug]`, fully backend-fed from `/hubs/render/:slug` + `/hubs/:id/page-content`
- [x] Hero with H1 and fast-facts bar overlaid on the image
- [x] Editorial lead / "Our {hub}" deep-dive section
- [x] Our Picks section (3 picks, referencing tour titles)
- [x] Comparison table with `comparisonGroups`, rows auto-derived from differentiating tour attributes
- [x] Discover section (`hub-discover-section.tsx`) — the "MOCK convention" comment is stale doc-only text; the data is real
- [x] Local tips section
- [x] Hub FAQs section
- [x] Related hubs section
- [x] Hub tours grid + `HubTripsPanel`
- [x] Private charters section
- [x] `generateMetadata` with canonical + hreflang for the HUB branch
- [~] Sticky anchor nav: the 5 locked items (Book now · Private charter · Our Pick · Compare · Tips & FAQ) are specced; presence in the shipped component set is unverified
- [ ] Hub-specific chip set in the filter row (e.g. Date · Catamaran · Powerboat · Beach house · Open bar, §3.12)
- [ ] Confirm the no-peach-tint rule holds on hub cards (§3.5)
- [ ] FAQPage JSON-LD on the hub FAQ section (§2.6)
- [ ] `HubTripsPanelSkeleton` actually renders — its Suspense boundary is inert (no `connection()`/searchParams trigger), so the skeleton renders nowhere (A15.9)

## Collection page

- [x] Collection branch of `[destination]/[slug]` fed by `getCollectionRender` + `getCollectionPageContent`
- [x] Thin editorial banner with persona label, H1, curation note, fast stats
- [x] One-sentence intro block
- [x] Curated grid with no sort and no filters (§5.6 section 4)
- [x] Per-tour translatable rationale line (italic, collection pages only)
- [x] Collection FAQ section
- [x] `collection-card` + `CollectionCardSkeleton`
- [x] `generateMetadata` with canonical + hreflang for the COLLECTION branch
- [~] "Keep exploring {Destination}" cross-intent section with 3 collection cards + recovery CTA — collection components exist but this specific section is unverified
- [ ] Circular numbered rank badges 01–10 on Best Things to Do / Top 10 collections only (§3.6, §5.6)
- [ ] `NeedHelpSection showFAQ={false}` with payment logos and the collection FAQ as its right column (§3.11)
- [ ] FAQPage JSON-LD on the collection FAQ (§2.6)
- [ ] Enforce no Sponsored badge and no peach tint on collection cards (§5.6)
- [ ] Share pill on the editorial banner

## Tour detail page

- [x] Tour branch of `[destination]/[slug]`, live `getTourBySlug`, streaming detail content
- [x] `generateStaticParams` prerenders every tour slug per destination (paginated `getAllTourSlugs`, 10×100 cap) — the Vercel RSC-variant fix
- [x] Full `generateMetadata` with canonical + 7 hreflang + x-default; OG images filtered through `filterIndexableImages`
- [x] Gallery component with hero + tiles
- [x] Tour header + header actions (Save / Share)
- [x] Meeting & pickup card
- [x] Sectioned content components + tabs
- [x] Reviews display (3 components) fed by `getTourReviews`
- [x] Related tours (2 components), streamed
- [x] Sticky booking widget in the right rail
- [x] Expandable text / about-expander for long-form copy
- [~] Quick-info badges: the audit does not confirm the LD7 lock of **exactly 3** (Duration, Pickup, Languages)
- [~] Review preview module above Overview (LD29): review components exist, but the tiered gate (hidden <3; "What our guests say" + 2 recent 4★+ cards at 3–9 with aggregate ≥4.0) is unverified
- [ ] Sticky TOC section navigation (LD16) over the seven fixed H2 sections (LD17 stacked layout)
- [ ] "Supplied by {operatorName}" muted tail line (LD14) — the only discovery-layer place an operator may be named
- [ ] Cancellation Policy section as the two locked prose paragraphs with `{hours}` resolved from `cancellation_hours`
- [ ] Reviews trust sub-line "Every review from a confirmed booking. No exceptions." under the H2
- [ ] Reviews sort hidden <10 reviews, filters hidden <20 reviews (LD30)
- [ ] Clickable star-distribution chart rendering at ≥3 reviews (LD31)
- [ ] Per-review machine translation with a show-original toggle (LD32)
- [ ] Related Tours as **two** independent rows ("More {category} in {Destination}" / "More to explore in {Destination}"), 3 cards each, rendering at ≥2 matches, firing `related_tour_click` (LD33)
- [ ] Demand card below the widget ("Likely to sell out" / "Book today to secure your spot.") gated on the single §3.7 trigger
- [ ] Product/Offer + Review + AggregateRating JSON-LD (§2.6)
- [ ] Confirm no per-tour FAQ section and no closing trust block ship (LD21, B.7)

## Tour card (shared component)

- [x] Single `<TourCard />` used on every listing surface
- [x] Whole card clickable, no CTA button
- [x] Wishlist heart control (Fix 3) with optimistic toggle and no page navigation
- [x] Badge component (`tour-badge`) + `derive-badge` logic
- [x] Sitewide grid standard applied to every tour-card grid
- [x] `pricing-label` / `priceUnitLabel` helper so per-person vs per-group copy is unit-aware
- [x] `TourCardSkeleton`
- [x] Fix 1 — no 01/02/03 ranking ribbon (position is the only ranking signal)
- [~] Fix 2 — badge colour hierarchy (urgency red/deep-orange · authority dark · New ivory), max 1 badge per card, priority `Likely to sell out > Bestseller > New` — a badge system exists; the locked colour hierarchy and the max-1 rule are unverified
- [ ] Fix 4 — desktop 5–7 photo carousel with always-visible dots, hover arrows, lazy loading after the first image, and a final description slide (~150 chars, word-boundary truncation, `...More`); mobile stays a single hero image
- [ ] Fix 6 — outlined check-circle icon for Free Cancellation, matched in style/stroke/size/colour to the duration and pickup icons
- [ ] Fix 8 — locale-aware thousands separator on the review count plus `aria-label="4.8 out of 5 stars, 1,738 reviews"`
- [ ] Fix 9 — locale-aware duration formatter with all six locked rules (<60min, exactly 60, whole hours, hours+minutes, whole-hour range, mixed range; never decimals, never string concatenation)
- [ ] Rating row rendered only at `review_count >= 3`; hidden at 0–2
- [ ] "New" badge replacing the rating row for tours <30 days old with 0 reviews (§3.6 B.64)
- [ ] Pickup label driven by `pickup_model`: "Pickup included" when in the price, "Pickup available" when a paid add-on, nothing when none (B.69) — resolves the Fix 7 vs 🟠 Important vs LD3 conflict in the master's favour
- [ ] "Free cancellation" rendered as the last card line
- [ ] "Price on request" fallback label for unpriced tours (B.41)
- [ ] Peach tint on card #1 of curated lists filling the full card area, excluded from search results, related-tours carousels and numbered collections

## Booking widget

- [x] `tour-booking-card` layout with `BookingStoreProvider` + `use-booking` / `use-availability-sync` / `use-booking-quote`
- [x] S1 initial state with price anchor ("From $X per person") and locked field order (date first, travelers second)
- [x] `booking-calendar` full-month date picker (S2)
- [x] `departure-times` time-slot chips (S3)
- [x] `party-selector` + `band-stepper-row` + `stepper`, variant-aware for age-banded pricing
- [x] `spectators-panel` rendered only on tours with spectator pricing
- [x] `price-header` + `price-summary` with server-quoted totals (S4)
- [x] `booking-cta` with CTA progression into checkout (S5)
- [x] `sell-out-notice`
- [x] `policy-modal` (cancellation / deposit trust modals)
- [x] `collapse` behaviour + `lib/booking.utils`
- [x] Live availability sync against real departures and a real `POST /bookings/quote`
- [x] Live currency-switch synchronisation of widget pricing
- [~] Trust strip inside the widget: modals exist, but the LD5 two-line lock (line 1 cancellation, line 2 "Pay only {X}% today, the rest later", collapsing to a single line on `paid_in_full`/`operator_full`) is unverified
- [ ] Capacity scarcity subscript `N left` on date cells only when `available_capacity_for_date < 5`, in neutral gray, mirrored onto the selected date pill
- [ ] Calendar forward-window cap at 12 months / `tour.max_advance_days` with the disabled-arrow tooltip "Bookings open up to {N} months ahead"
- [ ] Booking-cutoff "Closed" state on date cells past `tour.booking_cutoff_minutes` (default 120, range 0–10080)
- [ ] All-sold-out alternatives module: "These trips still have room this week" with 2–3 same-category tours holding a departure within 7 days, plus the silent GA4 dead-end event (B.77)
- [ ] Locked S1 error microcopy set (sold-out date with auto-suggest, all-slots-sold-out, API failure with Retry + WhatsApp, below-min-party, missing departure time, offline cached-dates notice)
- [ ] Unified loading-state timing rule (<200ms nothing · 200–1500ms skeleton · >1500ms skeleton + "Loading…" · >5000ms timeout + retry) applied to every widget async operation

## Checkout

- [x] Route `[destination]/[slug]/checkout/page.tsx`, `noindex`, dynamic + real booking API
- [x] Two-phase Contact → Payment flow with a persistent booking summary
- [x] `checkout-client`, `checkout-form`, `checkout-fields`, `checkout-steps`, `checkout-summary`, `checkout-pickup-label`
- [x] Currency resolution (URL `currency` → cookie) with the tour refetched priced in the shopper currency
- [x] `computeCheckoutTotals` + `reserveSelection` construction
- [x] Reserve → `POST /bookings`, contact → `PATCH /bookings/:id`, then `POST /payments/bookings/:id/intent`
- [x] Split first name / last name fields (B.50, Enhanced Conversions match rate)
- [x] Country selector + phone field (`lib/checkout/countries.ts`)
- [x] Pickup location dropdown rendered when the tour offers pickup
- [x] `CheckoutSkeleton` + route `loading.tsx`
- [~] Payment-model awareness: `operator_full` is rejected at reserve in v1, so the "no Payment section / bare CTA / straight-to-TYP" branch (B.79/B.80/B.89) is not exercised
- [ ] Single-page accordion architecture with completed sections showing a check and reopening on tap (§5.8 restructure; the build is two-phase)
- [ ] "Back to availability" link in the Contact section
- [ ] PECR soft opt-in marketing notice under the email field
- [ ] Pickup dropdown locked default "No pickup, meet at location", zone prices with no `$0.00` decimals, and the "Other location, we'll confirm via WhatsApp" fallback
- [ ] Special requests field capped at 500 characters
- [ ] Locked CTA "🔒 Reserve my spot · Pay $X" placed **inside** the expanded payment method
- [ ] "Payments are secure and encrypted" line plus the implied-consent line with Terms/Privacy links and no checkbox
- [ ] Exactly two payment-step trust signals: Powered-by-Stripe slate badge + the free-cancellation commit line "✓ Free cancellation up to {hours}h before the tour starts, full refund." (§3.11 C23)
- [ ] Zero-amount summary rows hidden per payment model (§5.8 conflict log 82)
- [ ] Locked Step 2 error microcopy (empty field, invalid email, email-typo suggestion, invalid phone, card declined with WhatsApp fallback, payment failure with Retry)
- [ ] Sold-out race handling: final availability check on commit → "This time just sold out. Pick another?" → return to Step 1 with the date preserved and the contact form pre-filled
- [ ] Mobile full-screen takeover for the booking summary

## Payment & processing

- [x] Stripe integration via `@stripe/react-stripe-js` + `@stripe/stripe-js` in `checkout-payment.tsx`
- [x] Custom inline Card Elements (`confirmCardPayment`) — no Stripe-hosted UI
- [x] PayPal redirect flow (`confirmPayPalPayment`)
- [x] iDEAL redirect flow (`confirmIdealPayment`, no Bank Element — Stripe collects the bank)
- [x] Eligibility-gated payment-method list
- [x] `/checkout/processing` page reading `?ref=`, redirecting to `/tours` when absent
- [x] `CheckoutProcessing` polling booking status and replacing to the TYP on confirmation
- [x] Processing page carries **zero** tracking tags (correct per §8.2)
- [~] Payment method radio list (LD26): card/PayPal/iDEAL ship; the locked equal-radio presentation with card expanded by default and VISA/MC/Amex logos is unverified
- [ ] Klarna, Apple Pay and Google Pay methods (Apple/Google device-conditional; Discover/JCB/Maestro logos locale-conditional)
- [ ] Client-generated idempotency key (UUID) per booking attempt, reused on retry to prevent double-charge
- [ ] Payment-processing loading lock: CTA becomes a "Processing…" spinner, widget locked, trust strip stays visible

## Thank-You page

- [x] Route `[locale]/[destination]/thank-you/[publicRef]/page.tsx` served locale-less via the `proxy.ts` rewrite
- [x] `connection()` + `getTravelerSessionToken()` → `getThankYouBooking` against `/bookings/typ/:publicRef` (`publicGetStrict`)
- [x] Three render modes: `masked` / `celebratory` / `management`
- [x] Masked mode with a verify card; masked-vs-verified email rendering
- [x] Confirmation hero with tour, date/time, party, booking reference
- [x] Booking summary card with payment status
- [x] "What happens next" step cards
- [x] Cross-sell upsell section fed by `getThankYouRelatedTours`
- [x] Apartment promo block
- [x] Support card
- [x] Resend-confirmation-email action (`POST /bookings/typ/:ref/resend`)
- [x] ICS / add-to-calendar and next-steps blocks
- [x] `BookingManageHeader` in management mode with a cancel link gated on `booking.canCancel`
- [x] `noindex` + `generateStaticParams` demo-ref stub so the route builds
- [x] `ThankYouSkeleton` + route `loading.tsx`
- [ ] **Conversion firing** — the `booking_complete` push is an inline comment reserving the work for the unbuilt tracking module; critical rule 22 (`commission_amount` in EUR) is documented but never fired
- [ ] Server-side mark-first idempotency (`conversion_fired_at` set atomically before render, `shouldFire` derived from the returned row)
- [ ] `<ConversionTracker>` client component pushing `booking_complete` exactly once, production-only with a staging guard
- [ ] `detectBookingState()` server-side state machine over the 8-state `BookingState` union (`fully_confirmed`, `pending_manual_confirm`, `deposit_paid_balance_pending`, `fully_paid`, `last_minute`, `balance_overdue`, `tour_today`, `tour_tomorrow`)
- [ ] Edge-case microcopy set: email-delayed, pending-manual-confirmation, tour today/tomorrow banner, fully-paid (skip step 2), last-minute urgent balance, meeting-point-instead-of-pickup
- [ ] `operator_full` booking-card and step-2 copy variants (B.90)
- [ ] Error render (no conversion) when a confirmed booking has a null `commission_amount` — data-corruption guard

## Booking lookup & manage booking

- [x] Route `(login)/[locale]/bookings/page.tsx`, `noindex`, all 7 locales prerendered
- [x] Email + booking-reference pair login against `POST /bookings/lookup` (no passwords, no sign-up)
- [x] "Lost your reference?" recovery panel against `POST /bookings/lookup/recover-reference`
- [x] Live `getPublicSiteInfo` branding + `buildWhatsappUrl` support affordance
- [x] Traveler HttpOnly session: `POST /api/traveler-session` moves the backend-issued token into a cookie, with a CSRF guard (`Sec-Fetch-Site` → Origin fallback) and a `v1.<payload>.<sig>` shape check
- [x] 24-hour HMAC traveler session (`lib/traveler-session.{server,shared}.ts`)
- [x] Booking management surface reachable from the TYP via `BookingManageHeader`
- [~] `(login)/layout.tsx` bare shell whose comments still reference `/portal`, `/staff`, `/apply` — routes that no longer exist in this repo
- [ ] Minimal takeover chrome per spec: logo top-left, language pill, "WhatsApp us" pill, 440px card, micro footer with legal links and the "Built by Islanders." sign-off
- [ ] Locked copy set (H1 "Your bookings", sub, field labels, `IT-2026-K3M9P` placeholder, helper, "Show my bookings", generic mismatch error, lockout copy)
- [ ] Always-positive lost-reference result "If that email has bookings with us, the reference is on its way." (no enumeration)
- [ ] Quiet operator cross-link "Tour operator? Log in to the operator portal →"
- [ ] Account area contents beyond bookings: invoices and saved tours (per the login mockup success state)
- [ ] 6-digit email-code step-up before invoices / cross-booking history (spec 2.4.5)
- [ ] Visible logout control in the account area

## Cancellation flow

- [x] Route `[locale]/cancel/[publicRef]/page.tsx`, `noindex`, served locale-less via the proxy rewrite
- [x] Request-only design — the page never cancels directly (§6.4 "no raw-click cancellation")
- [x] All 5 state branches: unverified → verify CTA to `/bookings?returnTo=`; already-requested; non-CONFIRMED; past the free-cancellation window; else `CancelRequestCard`
- [x] Refund line rendered only when `depositPaid > 0` (C23)
- [x] Submission against `POST /bookings/typ/:ref/cancellation-request`, 401-gated
- [x] Cancellation cancel/state handling with user notification and state management
- [ ] Locked confirmation copy per payment model (deposit / `paid_in_full` / `operator_full` variants, §6.4 conflict log 87)
- [ ] "Cancel {tour}, {date}? Refund ${deposit}" confirmation header format

## Customer account area

- [~] Traveler mini-surface: `AccountMenu` is a cookie-driven menu (`it.travelerBooking`) linking to `/bookings` only
- [ ] `/account` customer door and customer dashboard pages — **not in this repo**; they live in the extracted dashboard repo `(docs claim: CUSTOMER-ACCOUNTS A13.6 built — in the dashboard repo, not the public frontend)`
- [ ] Public-site pointer from the TYP / footer to the `/account` door for password-setting travelers
- [ ] Saved tours (wishlist) surfaced inside the account area
- [ ] Invoices surfaced inside the account area

## Auth / login screens

- [x] Traveler booking-lookup door (the only routed auth surface on the public site) — see "Booking lookup"
- [~] `components/frontend/login/` still contains `operator-login`, `operator-forgot`, `operator-reset`, `operator-two-factor`, `operator-apply` — **self-described "SCREENS ONLY — submit is mocked (no backend)"** — and `staff-login` marked **"Mockup endpoint"**; the `/portal`, `/staff` and `/apply` routes do not exist here
- [ ] Delete or migrate the mocked operator/staff/apply login components now that the dashboard repo owns those doors
- [ ] `proxy.ts` legacy redirects (`/login→/portal`, `/forgot-password→/portal/forgot`, `/reset-password→/portal/reset`) reconciled with the fact that no `/portal` route exists in this app
- [ ] Anti-phishing line rendered where a public-site auth surface remains ("We'll never ask for your password or codes by email, text, or phone.")

## Wishlist

- [x] `/[locale]/wishlist` route, `noindex, nofollow`, server-localized chrome
- [x] `WishlistProvider` mounted in the `[locale]` layout
- [x] Client `WishlistView` fetching contents at request time
- [x] `GET /wishlist/resolve` + `wishlistApi` backed by the real `src/wishlist/` backend module
- [x] Cookie fallback for anonymous wishlists (`lib/wishlist-cookie.ts`)
- [x] Heart control on every tour card with optimistic fill and revert on API failure
- [x] `WishlistSkeleton`
- [ ] `add_to_wishlist` analytics event with list id and index (§3.5)

## Search & typeahead

- [x] `/[locale]/search` route, `noindex`, SSR
- [x] `SearchResultsSection` streaming from `searchParams`, supporting `q`, `page`, `destination`, `date`
- [x] Navbar search (`nav-search`) with `search-typeahead` and `rotating-search-placeholder`
- [x] Destination-scoped search shared between nav and destination hero search (one unified system)
- [x] `SearchPagination` + `SearchSkeleton`
- [x] Dynamic `generateMetadata` reading `searchParams.q`
- [~] Autocomplete rules (min 2 characters, 250ms debounce, grouped Categories & Hubs / Tours / Collections, CMS-driven zero-state and rotating placeholders) — typeahead ships; these specific locks are unverified
- [ ] Search filter row (§3.12 minus category chips) with the `date` param pre-applied
- [ ] Search sort options (Most relevant default · Price low→high · Price high→low)
- [ ] Empty state recovery: popular-search chips + Category Quick Links row + "See all {Destination} tours →"
- [ ] Transparency tooltip on the search results counter
- [ ] Confirm no paid placements and no peach tint render on search results (§5.10)
- [ ] GA4 `search` event on every render with `results_count`

## Filters & sorting

- [x] URL-driven filter model in `lib/tours/filters.ts` (state in query params, not client-only)
- [x] Phase 1 filters: category, sort, price, rating, duration
- [x] Phase 2 filters: free cancellation, pickup
- [x] `tours-filter-bar` + `tours-filter-modal` (single Filters button + modal, the locked Viator pattern)
- [x] Filters button count badge when filters are active
- [x] Sorts locked to exactly 3
- [x] Backend facet endpoints wired (`/filters/:d`, `/filters/:d/:category`)
- [~] Price section: slider is wired but `PRICE_MAX = 560` is a hardcoded default rather than a catalogue-derived max
- [~] Free cancellation: implemented as a Phase 2 filter, not yet the locked **single-select window** (24h / 48h / 72h) mapping to `cancellation_hours` with the locked subtext "All tours include free cancellation. Filter by how late you can cancel."
- [~] Ratings section: present, but the "hidden entirely until tours cross the 3-review render threshold, flipping on per island" gate is not implemented
- [ ] **Phase 3 filters — date, guests, time-of-day are not in the URL model at all** (time of day is a locked modal section; date and guests are locked filter-row controls)
- [ ] Duration bands normalised to the locked 4 multi-select bands (≤2h · 2–4h · 4–6h · full day 6h+) with lower-bound-inclusive / upper-exclusive boundaries
- [ ] Apply button showing a live result count against the unapplied selection
- [ ] Session storage preserving filter state for back navigation
- [ ] Self-referencing canonical from filtered listing URLs back to the clean URL (§3.12 B.61)

## Reviews

- [x] Tour review display components (3 files) fed by `GET /reviews?tourId=…`
- [x] Platform review aggregate loader (`platform-reviews.ts`) powering homepage testimonials
- [x] Review-count / rating rendering on tour cards and the tour meta row
- [ ] **Review submission — entirely absent.** No POST call and no submit UI anywhere in the repo
- [ ] Post-tour review invitation entry point from the account/booking surface
- [ ] Clickable star-distribution chart (LD31)
- [ ] Review sort (≥10) and filters (≥20) conditional rendering (LD30)
- [ ] Machine translation with show-original toggle per review card (LD32)
- [ ] `case 'reviews'` added to `lib/api/cache-revalidation.ts` so review writes bust `reviews`, `tour:${id}`, `tours`, `search` (gap G1 — latent only until the write path ships)
- [ ] Review + AggregateRating JSON-LD on tour pages

## Multi-currency

- [x] `lib/currency/{current,server}.ts` with cookie + locale resolution
- [x] Footer currency switcher writing `NEXT_CURRENCY`, session-persistent
- [x] Currency never rendered in the nav (§1.3)
- [x] `formatMoney`, `formatPriceFrom`, `resolveDisplayPrice`, `deriveDisplayRate` helpers
- [x] Currency-aware backend fetches (tour repriced in the shopper currency at checkout)
- [x] Exact-decimal money rendering sitewide
- [x] Live widget resync on currency change
- [~] Currency scope is **EUR/USD only**; `LOCALE_CURRENCY` maps zh→USD and every other locale→EUR, which contradicts the locked map (EN + ZH → USD; NL/DE/FR/ES/PT → EUR) `(docs claim: MULTILINGUAL A2.2)`
- [ ] Locale-aware money formatting (`$1,234.56` vs `€1.234,56`) verified per locale
- [ ] IP-based currency localization (explicitly roadmap, not built)

## Multilingual (7 locales)

- [x] All 7 locales wired: `en, es, nl, pt, fr, de, zh` (`lib/constants/locales.ts`, `ALL_LOCALES`, `DEFAULT_LOCALE='en'`, native labels, flag SVGs)
- [x] **Dictionaries genuinely translated** — `lib/i18n/dictionaries/{locale}.json`, 813 lines each, all 7 identical in structure, spot-checked nl + zh
- [x] Dictionary keys cover nav, footer, common, search, wishlist, home, destination, checkout, cancelBooking, thankYou, travelerLogin
- [x] `getDictionary()` as `'use cache'` + `cacheLife('max')` with per-locale dynamic import so translations never reach the client bundle
- [x] `localizeHref` helper + `LOCALE_COOKIE='NEXT_LOCALE'` (1-year)
- [x] Locale redirect + `NEXT_LOCALE` cookie + Accept-Language negotiation in `proxy.ts`
- [x] Locale-less exceptions for the TYP and cancel routes via proxy rewrites
- [x] English slugs in every locale; only the prefix switches language
- [x] Entity content (tours/categories/hubs/collections/FAQs) translated backend-side via `?locale=`
- [x] `generateStaticParams` over all 7 locales in the `[locale]` layout
- [~] Legal pages are **English-only by policy** in all 7 locales, with a notice banner on non-`en`
- [~] Homepage editorial copy lives in the dictionary rather than the CMS, so it cannot be edited per locale by an admin
- [~] Documented dev trap: editing a dictionary JSON does not bust the `cacheLife('max')` cache; the file's comment header must be bumped
- [ ] Locale-aware duration and thousands-separator formatters (Fix 8, Fix 9) — required to be locale functions, never string concatenation

## SEO emission

- [x] Root `generateMetadata` fully dashboard-driven (title, description, keywords, robots, metadataBase, google-site-verification, favicon, OG, Twitter)
- [x] Per-entity `generateMetadata` for CATEGORY / HUB / COLLECTION / TOUR branches
- [x] Canonical + 7 hreflang + `x-default` emitted on the `[destination]/[slug]` route
- [x] `filterIndexableImages` applied to TOUR OG images (media-gallery exclusion list)
- [x] `noindex` on checkout, TYP, cancel, search, wishlist, manage-cookies and `/bookings`
- [~] Canonical + hreflang coverage: emitted **only** on `[destination]/[slug]` — missing on the homepage, destination page, `/tours` and search `(docs claim: SEO-STRATEGY "hreflang across all 7 locales on every content page")`
- [ ] **`sitemap.ts` — does not exist.** No `/sitemap.xml` index, no per-locale or per-page-type sitemap files, no `lastmod`, no ≥3-tour category exclusion
- [ ] **`robots.ts` — does not exist.** No disallow for `/admin` `/api` `/dashboard`, no sitemap declaration
- [ ] **JSON-LD — zero `ld+json` / `schema.org` matches repo-wide.** Nothing emitted anywhere
- [ ] `BreadcrumbList` JSON-LD on every page with breadcrumbs
- [ ] `Product`/`Offer` JSON-LD on tour detail with `acceptedPaymentMethod`, `audience.suggestedMinAge`, accessibility fields, `refundPolicy` from `cancellation_hours`, `includes`/`excludes`
- [ ] `ItemList` JSON-LD on the All Tours grid
- [ ] `FAQPage` JSON-LD on collection, hub and destination-NeedHelp FAQ sections
- [ ] `/help` Help Center route with FAQPage JSON-LD across the five categories (Booking, Cancellation, Safety, Equipment, Accessibility) — route does not exist
- [ ] Self-referencing canonical from filtered listing URLs to the clean URL
- [ ] Frontend enforcement of the ≥3-tour category indexability gate
- [ ] Reserved-word guard so static route segments (`terms`, `search`, …) cannot silently shadow a destination slug

## Tracking & analytics

- [ ] **No analytics or tracking layer exists at all** — no GTM container, no `dataLayer`, no `gtag`, no GA4, no Meta Pixel / `fbq`, no CAPI (verified by grep)
- [ ] GTM container bootstrap with the four tags (Conversion Linker · Google Ads · GA4 `purchase` · Meta Pixel), no per-tour or per-campaign tags
- [ ] `booking_complete` dataLayer push on the TYP with the full §3 data contract (`booking_value` = `commission_amount` EUR, `booking_currency` hardcoded `'EUR'`, `booking_ref`, tour/operator/island context, `items[]`, `user_id`, click ids, hashed `user_data`)
- [ ] Server-side SHA-256 PII hashing (email, E.164 phone via `libphonenumber-js`, split names, address) — one hash pass serving Google and Meta
- [ ] Server-side Meta CAPI fire in parallel with the browser Pixel, deduplicated by a shared event id, fire-and-forget with error logging
- [ ] Click-id (`gclid`, `gbraid`, `wbraid`, `fbclid`) and UTM capture at booking creation
- [ ] CI type-check of the tracking payload so a missing required field is a build error, not a runtime fallback
- [ ] GA4 page-view baseline plus `select_content` on homepage destination selection
- [ ] Tour-card events `view_item_list`, `select_item`, `add_to_wishlist` with list id and index (§3.5)
- [ ] `related_tour_click` event on the tour-detail related rows (LD33)
- [ ] GA4 `search` event with `results_count` on every search render
- [ ] GA4 `login` event with `method: booking_ref` on successful booking lookup, plus a PII-free silent failure counter
- [ ] Silent GA4 dead-end event when the widget hits the all-sold-out state (B.77)
- [ ] §8.4 Definition of Done verification: Tag Assistant clean fires, exactly one GA4 `purchase` per test booking, one deduplicated Meta `Purchase`, Enhanced Conversions match rate >60%

## Consent / cookies

- [x] Cookiebot consent script loaded in `(frontend)/layout.tsx` with `data-cbid` from `getPublicSiteSeo().cookiebotCbid ?? NEXT_PUBLIC_COOKIEBOT_CBID` and `data-blockingmode=auto`
- [x] `/manage-cookies` page (noindex) hosting `CookieSettingsButton` → `window.Cookiebot.renew()`
- [ ] **Consent Mode v2** with regional defaults (EEA denied by default, US/CA granted) — only the banner exists, no consent signalling to any tag platform
- [ ] Consent-gated firing wired to the (unbuilt) GTM container

## Legal & policy pages

- [x] Six global legal pages via `LegalPageShell`: `terms`, `privacy-policy`, `cookie-policy`, `cancellation-policy`, `legal-notice`, `manage-cookies`
- [x] Verbatim handover prose preserved (change only through Denley per the README header)
- [x] Non-`en` locales render the English text plus a notice banner
- [~] Legal copy is hardcoded JSX (privacy-policy 516 lines, terms 541) rather than CMS-managed — Phase 5 of the Pages system is a migration of this authored copy
- [ ] Pages / permalink system with a rich-text editor backing the legal pages (blocked on open decisions; port the TipTap config noted in the docs)
- [ ] Missing footer routes: about, help, contact

## Error / 404 handling

- [x] `notFound()` used correctly at every gate (inactive destination, unresolvable slug, missing booking)
- [x] `publicGetStrict` semantics so a backend outage throws instead of baking a 404 into ISR
- [ ] **`not-found.tsx` — does not exist anywhere in `app/`.** Next's default 404 renders
- [ ] **`error.tsx` — does not exist.** No route-level error boundary
- [ ] **`global-error.tsx` — does not exist.** No root error boundary
- [ ] Localized, branded 404 with recovery links (destination / all tours / search)
- [ ] Error boundary with a WhatsApp fallback affordance consistent with the widget/checkout error pattern
- [ ] `manifest.ts` (absent; noted alongside the other missing app-level files)

## Rendering / caching / streaming

- [x] `cacheComponents: true` with every public loader as `'use cache'` + explicit `cacheLife` + `cacheTag`
- [x] No route awaits uncached data outside a `<Suspense>` boundary (production build green)
- [x] `publicFetch` / `publicGet` / `publicGetStrict` three-tier fetch layer with `x-internal-api-key` and no-jitter 429/503 retry
- [x] Client `apiFetch` with `credentials:'include'`, jittered GET retry and error normalization
- [x] `POST /api/revalidate` cross-app invalidation with `timingSafeEqual` secret comparison and a shared `lib/cache-tags.ts` vocabulary
- [x] Granular `type:${id}` + coarse aggregate cache tags, fired automatically on dashboard mutations
- [x] ISR-cost pass moving event-covered loaders to the `days` profile
- [x] Nightly re-rank busting `tours` + `search` tags from the backend
- [x] Vercel RSC-variant fix: prerender all known slugs + `proxy.ts` matcher excluding locale-prefixed paths
- [x] Streaming entity/destination shells returning `<Suspense>` before any await, with parallel `Promise.all` resolution
- [x] `proxy.ts` (Next 16 renamed middleware) handling locale redirect, cookie, locale-less rewrites and the dashboard cookie guard
- [~] Streaming policy is inconsistent: `ToursHeaderSection`, `DestinationHeroSection`, `DestinationCollectionsSection` and `HubTripsData` are wrapped in Suspense but have no request-time trigger, so they bake into the static shell and their skeletons never render
- [ ] Apply one coherent per-page-type streaming policy (prerendered pages let cached sections prerender; only searchParams/cookie/per-user holes stream)
- [ ] Add `loading.tsx` at `[destination]` and `[destination]/tours` (gap G2 — `loading.tsx` does not cascade)
- [ ] Remove the dead `connection` import in `tours/tours-header-section.tsx:1`
- [ ] Remove the debug `console.log('details', detail)` at `tour-detail-content.tsx:102`
- [ ] Fix stale docstrings claiming `await connection()` in `tours-listing-section.tsx`, `search-results-section.tsx`, `destination-page-sections.tsx`, `hub-page.tsx`, `tours-header-section.tsx`
- [ ] Correct the `lib/api/public/destinations.ts:19` comment (says `revalidateTag`, code uses `updateTag`)
- [ ] Delete dashboard-era dead weight now that the dashboard is extracted: `components/ui/` (37 dirs), `hooks/*`, non-`public/` `lib/api/*.ts`, `contexts/role-context.tsx`, `lib/config/rbac.ts`, `app/_actions/dashboardActions.ts` (admitted mock data)
- [ ] Set `INTERNAL_API_SECRET` and `REVALIDATE_SECRET` in both apps so the throttle bypass and cache bridge are actually active

## Motion & interaction standards

- [x] `lib/motion.ts` canonical constants (springPop, swapFade, crossFade, pageEnter) imported everywhere, never re-declared inline
- [x] `PageTransition` owning page-enter animation in the `[locale]` layout
- [x] `MountReveal` for Suspense-streamed content, `Reveal` for below-fold content
- [x] Server-renderable motion primitives (`motion-link.tsx`, `motion-primitives.tsx` — MotionDiv/Span/Button/A) keeping `'use client'` on the smallest leaves
- [x] No `whileHover` motion anywhere; hovers are colour/opacity CSS transitions only
- [x] `whileTap` scale-down (0.9–0.98) for press feedback
- [x] Mapped lists use the `listItem` prop instead of index-incremented reveal delays
- [x] Static-shell (prerendered) content carries no self-animation, avoiding the hydration flash
- [ ] Motion audit of the newer surfaces (checkout, TYP, cancel, filters modal) against the sitewide standard

## Skeletons & loading

- [x] 13 skeleton components: checkout, destination, entity, hub-tour-card, hub-trips-panel, search, thank-you, tour-card, tour-page, tours-page, wishlist, collection-card, `skeleton-bar`
- [x] Route `loading.tsx` at `[slug]`, destination, tours, checkout and thank-you
- [x] Per-section Suspense boundaries with skeletons mirroring each section
- [~] Four skeletons render nowhere because their Suspense boundaries are inert: `ToursHeaderSkeleton`, `DestinationHeroSkeleton`, `DestinationCollectionsSkeleton`, `HubTripsPanelSkeleton`
- [ ] Unified loading timing rule applied platform-wide (<200ms none · 200–1500ms skeleton · >1500ms skeleton + secondary indicator · >5000ms timeout + retry)
- [ ] Skeleton calendar grid on date-picker initial load and month change; skeleton chip row on time-slot fetch

## Accessibility

- [x] `role="alert"` error blocks and `aria-describedby` wiring on the traveler login form
- [~] Modal a11y (dialog semantics, focus trap, ESC, focus return) is required for the trust/policy modals; `policy-modal` exists but compliance is unverified
- [ ] `aria-label="4.8 out of 5 stars, 1,738 reviews"` on every rating element (Fix 8)
- [ ] WCAG AA contrast audit across tokens, badges and the free-cancellation filter subtext
- [ ] Focus management on filter modal open/close and on error (focus returns to the first errored field)
- [ ] Keyboard operability pass on the carousel, calendar, party stepper and typeahead
- [ ] Decorative icons carry `alt=''`; meaningful icons carry accessible names

## Testing

- [~] Playwright configured (`playwright.config.ts`, chromium, 1 worker, global auth setup, `webServer: pnpm dev`) — infrastructure exists but points at dead specs
- [ ] **All 10 existing specs target `/dashboard` routes** (attributes, categories ×2, collections, destinations ×2, hubs ×2, trips ×2) and are stale/dead now that the dashboard lives in another repo — delete or migrate them
- [ ] Remove the committed failure artifact `e2e/test-results/trips-…/test-failed-1.png`
- [ ] **Zero public-frontend test coverage** — no jest, no vitest, no testing-library in `package.json`
- [ ] Add a unit/component test runner and cover the pure logic: `lib/tours/filters.ts`, `lib/checkout/checkout.ts`, `lib/currency/*`, duration formatter, `derive-badge`, `pricing-label`
- [ ] E2E coverage of the booking chain: widget → checkout → payment → processing → TYP
- [ ] E2E coverage of booking lookup, traveler session and the cancellation-request flow
- [ ] E2E coverage of locale routing, currency switching and wishlist persistence
- [ ] Visual/contract check that the 7 dictionaries stay structurally identical

### Frontend summary

**Done 224 · Ongoing 38 · Pending 191** (453 tasks total). The transactional spine — booking widget, checkout, Stripe/PayPal/iDEAL payment, processing hop, thank-you page, booking lookup, traveler session and the cancellation-request flow — is genuinely built end-to-end against real endpoints, and the 7-locale i18n layer is fully wired and genuinely translated. The concentrated gaps are commercial-surface rather than structural: no sitemap, no robots, no JSON-LD, no analytics or conversion layer of any kind, no error/404 boundaries, homepage CMS loaders written but unconsumed, review submission absent, hreflang emitted on one route only, tours filters stopped at Phase 2, and zero automated coverage of the public site.

---

# PART IV — DASHBOARD TASK CHECKLIST

> Repo: `tripwheel-x-islandtours-dashboard` (standalone Next 16.2.4 app, port 3001, Vercel target).
> Status below is taken from the **code audit** of the repo at `c2d25e0` (branch `backed`). Where the
> extraction spec set (`technical-doc/dashboard-extraction/`, 11 docs) disagrees with the code, the
> code wins and the spec claim is noted inline.
>
> Legend: `- [x]` done (audit-confirmed built and wired) · `- [~]` ongoing (partial / known defects)
> · `- [ ]` pending (not built).
>
> **Read the difference carefully:** `/reviews` is a *placeholder* (a route exists, rendering an
> `<h1>` and one `<p>`). Settlements/payouts, refunds, FX admin, notifications, slug-registry
> admin and Pages/CMS were *never built* — no route, no component, no API module, no type.

---

## Foundation & repo setup

- [x] Phase 1 — fix the live cache-revalidation bug B-1 (duplicate `case 'settings'`, `site-info` never busted) — `bbdd159`
- [x] Phase 2 — sever the 7 cross-tree imports from the public site (`TourBadgeChip`, `TourListing`, `TourBadge`); split `lib/tours/listing.ts` — `5ee032e`
- [x] Phase 3 — sort `components/` by owner; move dashboard chrome into `components/shell/` — `44becee`
- [x] Phase 4 — delete confirmed dead code (~2,725 LOC incl. `leads`/`enquiries` stubs, old 813-LOC `data-table.tsx`) — `528655f`
- [x] Phase 5 — scaffold the standalone repo and copy; repo root *is* the app, no monorepo, no workspace — `2977a77`
- [x] Phase 6 — base-path migration `/dashboard/*` → `/*`; all `router.push`/`redirect`/`<Link>` rewritten — `313d291`
- [x] Phase 7 — cross-domain cache-revalidation transport (dashboard client + public `/api/revalidate`) — `631ac56` + `6c65d0d`
- [x] Phase 8 — env matrix + Vercel target (code side); `output: 'standalone'` deliberately removed and documented in `next.config.ts` — `cfdd38b` + `4c1d7f4`
- [x] Seven env vars documented in both `.env.local.example` and `.env.production.example` (`NEXT_PUBLIC_BACKEND_URL`, `INTERNAL_API_SECRET`, `COOKIE_DOMAIN`, `REVALIDATE_TARGET_URL`, `REVALIDATE_SECRET`, `NEXT_PUBLIC_OPEN_WEATHER_API_KEY`, `NEXT_PUBLIC_FACING_APP_URL`/`NEXT_PUBLIC_ADMIN_LOGIN_URL`)
- [x] Keep `cacheComponents: true` in `next.config.ts` despite the app being overwhelmingly client-rendered
- [x] Image `remotePatterns` restricted to `res.cloudinary.com`, `lh3.googleusercontent.com`, `images.unsplash.com`
- [x] Phase 9 automated parity half — 171/171 component files compared (95 byte-identical, 76 differ only in import paths, 0 behavioural); route sets identical 19/19; **NO REGRESSION FOUND**
- [~] Phase 9 cutover overall — automated half done; **visual sign-off, staging deploy and DNS still open** (see Domain move & cutover)
- [ ] Phase 16 — Tours: 4-field create + readiness as a real contract — **NEXT, untouched**
- [ ] Phase 17 — Translation Console (matrix + workspace, `lib/translatable-schema.ts`) — not started
- [ ] Phase 18 — Tours 13 tabs → 4 routed groups — not started
- [ ] Phase 19 — canonical routed editor across destinations/hubs/categories/collections — not started
- [ ] Phase 20 — remaining modules + flip lint `warn` → `error` — not started
- [ ] Phases 21-23 (Stage E) — Overview A1, Pre-translate A4, Reviews A2 / Users A3 / Bulk ops A5-A6 / Payments A7 — each blocked on its backend request
- [ ] Add any CI to the repo — **there is none at all**, which is also why the cache-tag contract cannot be machine-guarded
- [ ] Add a husky/lint-staged hook (only `.lintstagedrc.json` exists; no hook) — formatting drift risk against the public repo
- [ ] Delete the vestigial `serverActions.bodySizeLimit: '100mb'` (uploads go browser→backend and never traverse Next; Vercel caps at 4.5mb anyway)
- [ ] 02 §10 step 10 — delete the dashboard route group (and duplicated `portal`/`staff` login surfaces) from the public repo
- [ ] Drop the now-orphaned `@dnd-kit` packages from the monorepo
- [ ] Rename `trips` → `tours` throughout (routes still `/trips`; Phase 14 labels already say "Tours") — **DEFERRED by open decision #1**
- [ ] Run a bundle measurement — never done; client-component counts are only a proxy
- [~] `/profile` route and its 11 components exist and work, but the nav entry is **commented out** in `navigations.ts` — reachable only via customer nav or direct URL; re-link or delete deliberately

## Design system

- [x] Phase 10 — 8 custom ESLint rules landed as warnings (428 warnings / 0 errors), all validated firing — `98aedb1`
- [x] Phase 11 — Tailwind v4 token system with a measured contrast gate (`pnpm gate:contrast`, `scripts/contrast-gate.mjs`, 34 checks × 2 modes, GREEN; it caught 2 defects in the spec's own palette) — `fdb0294`
- [x] Phase 12 — one `StatusBadge` + `status-maps.ts`; **zero raw palette classes repo-wide**; 5 competing status conventions deleted — `9418b29`
- [x] Phase 13 — fonts/icons/primitives: Playfair Display dropped (user-approved), hugeicons kept (user call), B-4 (`hsl()` wrapping oklch tokens in `ui/sidebar.tsx`) fixed, buttons de-shouted — `aa91c02`
- [x] Phase 15 — unified `components/data-table/` system (7 files incl. URL-synced `use-table-state.ts`); **11/11 table forks converted** (spec counted 10); 3,552 → 2,524 LOC — `17a1fd5` +5
- [x] `components/ui/` forked from the public site (30 shadcn/radix primitives) — dashboard diverges by design
- [x] `components/common/` shared kit built (21 files: `entity-tabs`, `entity-detail-shell`, `entity-seo-tab`, `faq-manager`, `quick-edit-sheet`, `media-selector`, `image-selector-field`, `video-selector-field`, `confirm-dialog`, `deactivate-dialog`, `force-delete-dialog`, …)
- [x] `components/skeletons/` created with the directory-name typo fixed (public repo's misspelled `skelitons/` not carried over)
- [x] Dark mode via `next-themes` with a `mode-toggle`, both themes gated to WCAG AA by the contrast script
- [ ] Flip the 8 lint rules from `warn` to `error` (owed at Phase 20)
- [ ] Delete the ~2,000 call-site compatibility aliases and retire `badge.tsx` (owed at Phase 20)
- [ ] Narrow the inline-style lint selector and wire `gate:contrast` into CI (blocked — no CI exists)
- [ ] Run a real accessibility audit (axe, keyboard sweep, screen reader, focus order) — **never run**; the spec's §E is static analysis only and must not be cited as a WCAG audit
- [ ] Decide the weather widget: keep in the header or remove (02 defaults to carry, 04 recommends remove) — **open decision #2, still in the header**

## Auth / session / cross-domain

- [x] Three separate login doors built: `/portal` (operator), `/staff` (staff/admin), `/account` (customer), each with `forgot` + `reset` and its own layout
- [x] 15 `components/login/` files incl. `operator-two-factor.tsx` and `code-input.tsx`
- [x] Operator onboarding wizard (`app/onboarding/`, business-identity + business-intent steps, zod schema in `lib/validations/onboarding.ts`)
- [x] Better Auth client only (`lib/auth-client.ts`, 7 LOC pointing at `NEXT_PUBLIC_BACKEND_URL`) — **no `betterAuth()` server instance in this repo**, per critical rule #12
- [x] `proxy.ts` (Next 16's renamed middleware) as a deliberately **network-free** optimistic guard — cookie presence + shape only
- [x] Malformed-cookie detection strips all `*session_token*`/`*session_data*` cookies on redirect, echoing `COOKIE_DOMAIN`, to break redirect loops
- [x] Documented and fixed the prior bug where `proxy.ts` fetched `/api/auth/get-session` on every navigation *and prefetch*, tripping the NestJS throttle until a 429 read as "no session"
- [x] Legacy redirects preserved: `/dashboard/*`→`/*` (308, before the guard), `/login`→`/portal`, `/forgot-password`→`/portal/forgot`, `/reset-password`→`/portal/reset` (query preserved)
- [x] Authoritative session validation one hop later in `app/(app)/layout.tsx` + `lib/server/dashboard-session.ts`
- [x] `getDashboardSession(cookie)` slimmed to **one parallel wave of 3 calls** (`authClient.getSession`, `GET /users/me`, `GET /users/me/permissions`); `getUserProfile` retained for `onboardingActions`
- [x] Session helper uses React `cache()` (per-render only, never across requests) — the documented trap that a cached `null` from a transient 429 would log users out
- [x] Layout redirects: no session → `/portal`; `TOUR_OPERATOR` without an operator record → `/onboarding`
- [x] `export const unstable_instant = false` with the note that nesting `{children}` in the awaited subtree also blocks pages from opting in
- [x] `lib/server/auth-headers.ts` forwards the cookie **plus** `INTERNAL_API_SECRET` on SSR fetches so trusted-origin requests bypass the backend throttle (server-only, never `NEXT_PUBLIC_`)
- [ ] Cross-domain auth for the target domains `island.tours` + `dashboard.tripwheel.io` (spec 02C, Option C change set, 15 verification checks) — **deferred separate project, untouched**
- [ ] Parity check #2 (malformed cookie cleared) and #9 (cookie scoped `.islandtours.esenc.cloud`, survives reload) — **staging only**, cannot be run locally

## RBAC & role gating

- [x] `lib/config/rbac.ts` (383 LOC) mirrors `backend/src/config/roles.config.ts` + `prisma/enums.prisma`
- [x] `contexts/role-context.tsx` `RoleProvider` receives role **plus backend effective permissions**; `useRole()` → `{ role, permissions, can, canAny }`
- [x] Security-conscious fallback: on a failed permissions fetch admins/operators fall back to the static `ROLE_PERMISSIONS` mirror, but **`STAFF` falls back to a profile-only floor** (`VIEW_PROFILE`, `EDIT_PROFILE`) so a hiccup cannot over-render UI
- [x] `RoleContext` defaults to deny-all — a missing provider denies rather than permits
- [x] `lib/rbac-utils.ts` `filterNavGroups` **removes** unpermitted nav items and whole groups (never greys them); group headers never render over an empty section
- [x] Per-module gating wired across Add buttons, bulk Delete, row-action Delete and Danger Zones (the B-7 "collections ungated" finding was **retracted as false** — gated since 2026-06-08)
- [x] Commission column visible to ADMIN, hidden from operators
- [x] `is_locals_favourite` admin-only, `MANAGE_EDITORIAL` only, never operator-settable (critical rule #23)
- [~] Two gating idioms still mixed — capability `can('X')` alongside raw `role === 'ADMIN'` equality, *inside the same files* (`destination-row-actions.tsx`, `bookings-table.tsx`); target is `can()` everywhere, owed at Phase 20
- [ ] Contract guard for rbac drift between the two repos (02 Appendix B1) — no CI, no test runner, drift caught only at runtime

## Navigation & IA

- [x] Phase 14 — four task-frequency nav groups shipped (OPERATE / CATALOG / CURATE / CONFIGURE) replacing the flat ~20-item list — `64a4835`
- [x] Command palette (`command-palette.tsx`, `Cmd+K`) — jump to any tour, booking or destination
- [x] De-shout follow-up on nav/button typography — `a1a6e04`
- [x] Operator and admin see structurally different products: `CURATE`/`CONFIGURE` are **absent** for operators, not disabled
- [x] Separate `customerNav` array plus `components/shell/customer-route-guard.tsx` for `USER`-role customers
- [x] Shell built: `dashboard-shell`, `app-sidebar`, `nav-main`, `site-header`, `use-nav-prefetch.ts`, `mode-toggle`
- [x] `Leads` and `Enquiries` removed from nav and codebase ("book instantly — no enquiry model")
- [x] `Translations` promoted to a top-level nav destination
- [~] `Reviews` deliberately absent from nav with the comment "returns with its module (blocked on A2)" — restore when the module lands
- [~] `Profile` nav entry commented out while the page still exists (see Foundation)
- [ ] Actionable badges on nav items (bookings needing attention, pending cancellations, pending spotlight approvals) — specified in the IA but not built
- [ ] Parity #6/#7 — sidebar item-by-item diff against production per role — **user sign-off owed**

## Destinations

- [x] Full CRUD routes: `/destinations`, `/new`, `/[id]`, `/[id]/edit`
- [x] 10 components: form, page-content form, quick-edit sheet, detail shell, delete dialog, columns, row-actions, table, list-view, edit-view
- [x] Translations tab (7 locales) wired to `/destinations/:id/translations`
- [x] Page Content + SEO tab (`entity-seo-tab`, OG image)
- [x] Grouped FAQs via the shared `FaqManager`
- [x] Force-delete / deactivate dialogs; `is_seeded` delete guard respected
- [x] Converted to the unified `DataTable` (Phase 15)
- [ ] Canonical routed editor shape `/destinations/[id]/details|content|seo|faqs` (Phase 19) — still in-page tabs
- [ ] Replace the local translation form with a link into the Translation Console (Phase 17)

## Categories

- [x] Full CRUD routes: `/categories`, `/new`, `/[id]`, `/[id]/edit`
- [x] 12 components incl. `category-icon-picker.tsx` and `category-subcategories-manager.tsx`
- [x] Page-content form, quick-edit sheet, translations, SEO, FAQs
- [x] Per-destination listing endpoint `/categories/destination/:slug` wired
- [x] Converted to the unified `DataTable`
- [ ] Canonical routed editor + tab-order alignment with the other three entity modules (Phase 19)
- [ ] Translations tab → console link (Phase 17)

## Hubs

- [x] Full CRUD routes: `/hubs`, `/new`, `/[id]`, `/[id]/edit`
- [x] 14 components — the richest curation module
- [x] `hub-allowed-categories-manager` wired to `/hubs/:id/allowed-categories`
- [x] `hub-our-picks-manager` wired to `/hubs/:id/our-picks`
- [x] `hub-comparison-manager` wired to `/hubs/:id/comparison`
- [x] `hub-content-sections-manager` wired to `/hubs/:id/content-sections`
- [x] `hub-tour-select` reimplemented locally after the cross-tree import was severed
- [x] Translations, page content, SEO, FAQs
- [ ] Collapse the 4 curation extras into one "Curation" tab with sections (8 tabs → 5, Phase 19)
- [ ] Translations tab → console link (Phase 17)

## Collections

- [x] Full CRUD routes: `/collections`, `/new`, `/[id]`, `/[id]/edit`
- [x] 9 components incl. `collection-tours-manager` and `collection-tour-select`
- [x] Per-tour rationale translation (`rationale-translation-tabs.tsx`)
- [x] `/collections/:id/tours`, `/resolved-tours`, `/rationale/:locale`, `/status` wired
- [x] RBAC gating confirmed present (B-7 retracted as a false finding)
- [x] Translations, page content, SEO, FAQs
- [ ] Canonical routed editor + even up gating thinness (2 files vs hubs' 4) inside the shared editor (Phase 19)
- [ ] Translations tab → console link + retire `rationale-translation-tabs.tsx` (Phase 17)

## Tours / trips — editor tabs

- [x] Routes `/trips`, `/trips/new`, `/trips/[id]`, `/trips/[id]/edit` (23 components — the deepest module)
- [x] `trip-editor-view.tsx` drives a **3-group / 13-tab** editor via `GROUP_TABS`, URL-synced with `?tab=`, with per-group last-tab memory
- [x] Tab — **Details** (group 1 / setup)
- [x] Tab — **Pricing** (basics, age bands incl. Set Default, add-ons)
- [x] Tab — **Schedules** (recurring schedules, start-time chips, exceptions)
- [x] Tab — **Copy / Text** (group 2 / content)
- [x] Tab — **Images** (gallery add, hero, reorder, alt/focal, 24 cap)
- [x] Tab — **Highlights**
- [x] Tab — **Inclusions & Exclusions**
- [x] Tab — **Itinerary / locations**
- [x] Tab — **Pickups** (pickup locations)
- [x] Tab — **Info & Terms / features**
- [x] Tab — **Attributes** (group 3 / distribution; bulk save; derived attributes filtered out via `lib/config/derived-attributes.ts`)
- [x] Tab — **Promotion** (commission tier picker + spotlight request)
- [x] Tab — **SEO** (per-locale)
- [x] Tab — **Translations** (`?tab=translations`, per-child-entity translation endpoints)
- [x] FAQs via the shared `FaqManager`
- [x] `readiness-rail.tsx` + `lib/trips/readiness.ts` — the readiness rail exists and is wired
- [x] Lifecycle actions: publish / pause / unpause / archive / restore
- [x] Archive and delete dialogs, row-actions with `?tab=` deep links
- [x] `/tours/admin/all` and `/tours/my-tours` scoping wired
- [ ] Phase 16 — reduce create from ~30 fields to **4** (name, destination, category, slug) and delete `trip-form.tsx` (704 LOC duplicating `trip-details-tab.tsx`)
- [ ] Phase 16 — disable Publish until readiness checks pass, name the blocking item, link each unmet item to the fixing sub-tab; **client rule must be a strict subset of backend validation** or an operator is blocked from a legal action
- [ ] Phase 16 — surface the "to be LISTED, not just live" requirements (schedule + capacity) alongside publish requirements, ending the 6th-hidden-requirement problem
- [ ] Phase 18 — 13 in-page tabs → 4 routed groups (`setup` / `content` / `reach` / `translations`)
- [ ] Phase 18 — one save per route in a sticky footer, dirty-tracked, with an unsaved-changes guard (today: no global save, no autosave, ~20 scattered buttons)
- [ ] Drag-and-drop reorder replacing numeric `displayOrder` and up/down arrows — **BLOCKED on backend request A6**; keep arrows until it lands
- [ ] Batched schedule creation — **BLOCKED on A5**; a 7-day × 3-time schedule still fires 21 sequential writes (interim: progress indicator + partial-failure summary)

## Availability & departures

- [x] Availability lives inside the tour **Schedules** tab (no standalone route, by design)
- [x] `/availability/schedules` create/update/delete wired
- [x] `/availability/exceptions` wired (CLOSE_DATE / CLOSE_SLOT)
- [x] `/availability/check` wired, and correctly **short-circuited** in cache-revalidation (a read shaped as a POST; revalidating it loops)
- [x] `lib/trips/availability.ts` helper extracted
- [ ] Bulk schedule endpoint adoption (A5) — see Tours
- [ ] Standalone departures management surface (per-departure capacity/status) — no route or component

## Bookings

- [x] `/bookings` route with `loading.tsx`, rendering `BookingsListView` over the shared `components/common/bookings-page-view.tsx`
- [x] 5 components: columns, details sheet, row-actions, list-view, table
- [x] `GET /bookings` with pagination, search and filters
- [x] Cancel action wired to `POST /bookings/:id/cancel`, gated on `EDIT_BOOKING`, limited to `ON_HOLD`/`PENDING`/`CONFIRMED`
- [x] Commission column ADMIN-only
- [x] Money rendered with exact decimals and the correct currency
- [x] Converted to the unified `DataTable` with URL-synced state
- [ ] Move `refundDue()` and `paymentModelLabel()` out of the columns file into `lib/bookings/` — money logic is not presentation (defect B-6/D-9, owed at Phase 20)
- [ ] Booking detail as a full Sheet with next/prev arrowing (today a cramped read-only dialog) — the single biggest throughput win in the module
- [ ] E2E coverage for bookings — **zero specs exist**

## Payments

- [x] `/payments` route with `loading.tsx`, rendering `PaymentsListView` over `components/common/payments-page-view.tsx`
- [x] 3 components incl. refund columns and provider/method rendering
- [x] `GET /payments` wired; converted to the unified `DataTable`
- [~] Payments is a **read-only dead end** — no actions column, no row-actions, no detail view, no status transitions; the only money-touching module with no drill-in
- [ ] Payment detail sheet + refund action — **BLOCKED on backend request A7**; do not add affordances the API cannot serve
- [ ] E2E coverage for payments — **zero specs exist**

## Cancellation requests

- [x] `/cancellation-requests` route with `loading.tsx`
- [x] Implemented as `BookingsListView` with the `cancellationView` prop — oldest-first ordering
- [x] Refund-entitlement copy cites master §6.4
- [x] `/bookings/:id/cancellation-request` endpoint wired
- [x] The 3 cancellation-specific extra columns render
- [ ] Rebuild as a real **queue/inbox** — pending first, free-cancellation window and refund-due as columns not prose, approve/reject inline, nav badge (same shape as Spotlight and, later, Reviews and Users)
- [ ] E2E coverage — **zero specs exist**

## Refunds

- [ ] Dedicated refunds surface — **NEVER BUILT.** No route, no component, no API module; refunds appear only as columns/status inside bookings and payments
- [ ] Refund initiation / approval action — blocked on A7
- [ ] Refund reconciliation view against the double-recorded refund model (original payment flips to `REFUNDED` **and** a separate `kind = REFUND` row is written — summing `status='REFUNDED'` double counts)

## Settlements & payouts

- [ ] Settlements & payouts module — **NEVER BUILT.** No route, no component, no API module; the words appear only as *fields* in `types/analytics.ts` and `components/statistics.tsx`
- [ ] Settlements ledger UI — backend Phase 1 of `SETTLEMENT-AND-PAYOUTS.md` is itself unbuilt
- [ ] Payout run / payout statement views for operators
- [ ] Retire the `payoutDueEur` caveat once the ledger exists (today it means *earned-and-unsettled*, not *unpaid*, and every surface showing it must say so)

## Reviews & moderation

- [~] `/reviews` route exists but is the **only genuine placeholder in the repo** — the entire file is an `<h1>Reviews</h1>` plus one `<p>`. No table, no API module, no hook, no type. Deliberately removed from nav with the comment "Reviews returns with its module (blocked on A2)"
- [ ] Moderation queue — pending first, approve/reject inline, filter by tour/rating/status, bulk approve — **BLOCKED on backend request A2** (Phase 23)
- [ ] `lib/api/reviews.ts` + `hooks/reviews/*` + `types/review.ts` — none exist in this repo
- [ ] Wire the review-approval gate that `CLAUDE.md` says homepage social proof depends on — today there is **no moderation UI at all**
- [ ] Restore the `Reviews` nav entry under CONFIGURE when the module lands

## Platform reviews

- [x] `/platform-reviews/config` and `/platform-reviews/refresh` endpoints wired
- [x] Surfaced in `components/settings/reviews-form.tsx` (Trustpilot / Google integration, commit `2738321`)
- [~] This is **config-only** — connect a provider and trigger a refresh; there is no aggregate display, no per-review view, and no moderation
- [ ] Connection status indicator (connected / error / not configured) with a test action, as specified for all integrations

## Customers / users

- [x] `components/customer/` built (4 components): customer bookings view, booking details, payments view, stat card
- [x] Self-scoped `/bookings/me/summary` wired
- [x] Separate `customerNav` array plus `customer-route-guard.tsx` so a `USER`-role account sees only its own surfaces
- [x] `/account` customer login door with forgot/reset
- [x] `/profile` page + `userActions.ts` (profile update, set-password) — 11 components incl. avatar cropper and `change-password-dialog`
- [x] `/users`, `/users/new`, `/users/[id]` routes are **real and complete** — they are the Staff & Teams module (spec claims: 00 §2 and 04 §4.7 list `users` as an 8-line static JSX stub blocked on A3; the code audit shows a fully built 13-file module)
- [ ] Per-card edit on the profile page (today a single `isEditing` boolean toggles the whole page)
- [ ] Active-session list on the security card — needs a backend endpoint
- [ ] A platform-wide customer/traveler directory distinct from staff (role column, booking history) — not built

## Operators

- [x] Full CRUD routes: `/tour-operators`, `/new`, `/[id]`, `/[id]/edit` (9 components)
- [x] Operator create / edit / detail / delete wired to `/operators`
- [x] `/operators/:id/company-info` and `/social-media` wired
- [x] `/operators/:id/stripe-config` and `/mollie-config` wired (operator payment settings)
- [x] Operator onboarding endpoint + wizard; layout redirects an operator with no operator record to `/onboarding`
- [x] Converted to the unified `DataTable`
- [ ] Delete the `DashboardTabNav` wrapping a **single** "Details" tab and render the form directly (Phase 20)
- [ ] Add an onboarding-status column (the data exists — the layout already branches on `user.operator`)
- [ ] Add tour count + tier distribution so an admin can assess an operator from the row
- [ ] E2E coverage for operators — **zero specs exist**

## Staff & teams

- [x] `/users`, `/users/new`, `/users/[id]` — the unified staff module, 13 files
- [x] `designations-tab.tsx` + `designation-dialog.tsx` — reusable permission templates
- [x] `permission-matrix.tsx` — per-person grant/revoke overrides on top of a designation
- [x] `staff-invite-dialog.tsx` + `/invite` and `/resend-invite` endpoints
- [x] `staff-member-sheet.tsx`, `staff-member-profile.tsx`, `staff-access-fields.tsx`, `staff-no-access.tsx`
- [x] `use-access-editor.ts` hook
- [x] `/staff`, `/staff/team`, `/designations`, `/staff/permission-catalog` endpoints wired (the catalog is served by the backend so the UI never hardcodes the permission universe)
- [x] `/staff` login door (staff/admin) with forgot/reset
- [x] Both scopes handled by the one model — `operatorId NULL` = platform staff (`STAFF` role), `operatorId` set = operator team seat (`TOUR_OPERATOR` role)
- [x] Seat-role picker (OWNER / MANAGER / STAFF) present with **honest copy** stating it is an organizational label carrying no permission semantics in v1
- [x] `MANAGE_STAFF` (ADMIN-only) and `MANAGE_TEAM` (owner-only) held outside every grant ceiling — the self-escalation guard is respected by the UI
- [ ] Suspension / status (`INVITED`/`ACTIVE`/`SUSPENDED`) lifecycle surfaces beyond the list — verify against the backend's suspension enforcement
- [ ] Real MANAGER seat semantics (staff-seat management, step-up rules) — a later login-plan phase
- [ ] E2E coverage for staff/designations — **zero specs exist**

## Tiers & spotlight

- [x] `lib/api/tiers.ts` + `hooks/tiers/use-tiers.ts` + `types/tier.ts`
- [x] Operator tier picker in the tour **Promotion** tab → `PATCH /tiers/tours/:id/tier`, 30-day lock enforced
- [x] Operator spotlight request → `/tiers/tours/:id/spotlight`
- [x] `/spotlight` admin approval route with `SpotlightQueueView` and max-3-per-destination copy
- [x] Admin approve/reject wired to `/tiers/admin/spotlight[/:id/approve|reject]`
- [x] Spotlight moved under CURATE and converted to `StatusBadge` + the unified `DataTable` (its 24 hardcoded palette classes, the #3 offender, are gone)
- [ ] Give Spotlight a true inbox shape — pending first, approve/reject inline, nav badge on pending count
- [ ] Split `spotlight-queue-view.tsx` (483 LOC) into `queue.tsx` + `approve-sheet.tsx` (Phase 20)
- [ ] E2E coverage for spotlight — **zero specs exist**

## Media library

- [x] `/media` route (the only module carrying `export const metadata`), 13 components
- [x] Direct browser→backend signed upload flow: `/media-gallery/sign` → `/upload` → `/confirm` (never traverses Next)
- [x] Viewer with editable metadata; grid/list UI; bulk actions; selector/picker mode
- [x] **Infinite scroll shipped** — the hardcoded `limit=100` ceiling that made item 101 unreachable is resolved (spec claims: 04 §4.4 still lists the 100-cap as an open S2 "hard operational ceiling")
- [x] Shared pickers `components/common/media-selector.tsx`, `image-selector-field.tsx`, `video-selector-field.tsx` adopted across all modules (no pasted URLs)
- [x] zustand upload store retained for cross-component progress
- [ ] Server-side filters (type, date, size, unused) and sort — verify `/media-gallery` query-param support first
- [ ] Tags (an image belongs to a tour *and* a destination; folders force one truth) — **BLOCKED**, needs a backend field
- [ ] "Used by" indicator so deletion is not blind — the highest-value non-blocked item in the module
- [ ] Convert the picker from a full-screen `Dialog` to a Sheet
- [ ] E2E coverage for media (upload, picker, bulk delete) — **zero specs exist**; parity #43-45 are user sign-off owed

## Attributes

- [x] Routes `/attributes`, `/attributes/new`, `/attributes/[key]/edit` (keyed by `key`, no detail route — a defensible quirk), 5 components
- [x] `key` immutable on edit, asserted by an e2e spec
- [x] `lib/config/derived-attributes.ts` mirrors the backend's compute-on-read SSOT list so the 13 derived attributes are never offered as editable
- [x] Per-tour attribute values wired to `/tours/:tripId/attributes` with a true bulk save
- [x] Converted to the unified `DataTable` (client-pagination-without-a-skeleton resolved)
- [x] Dialog-based create/edit deliberately kept (the inconsistency is named and accepted)
- [ ] Add a "used by N tours" column so an admin can see blast radius before editing

## Translations console

- [x] `/translations` matrix route built
- [x] `/translations/[type]/[id]/[locale]` per-locale workspace route built
- [x] Tour translations reachable from the editor via `?tab=translations`
- [x] Per-child-entity translation endpoints wired (highlights, inclusions, exclusions, features, locations, pickups, SEO)
- [x] The EN rule preserved — "Clear Fields" upserts nulls and never calls the delete endpoint
- [~] Phase 17 is marked *not started* in the extraction ledger while the console routes exist in code — the console is built but the **5 forked `LocaleTab` implementations and the per-entity Translations tabs have not been deleted**, so operators still have two ways to do one job (this is explicitly called the make-or-break instruction)
- [ ] `lib/translatable-schema.ts` — the single declarative registry the matrix and workspace should render from (a missed field silently becomes untranslatable)
- [ ] Bulk **Pre-translate** action (fills empty targets from EN, marks `isMachineTranslated: true`) — **BLOCKED on A4**; the DB column, DTO field, type and badge already exist end-to-end, only the generator is missing
- [ ] "Source updated" conflict flag when the EN source changed after a translation was saved — needs a source-updated timestamp (verify whether `updatedAt` suffices)
- [ ] Delete `trip-translations-tab.tsx`, `rationale-translation-tabs.tsx`, `translation-row.tsx`, `dual-translation-row.tsx` and the 5 `LocaleTab` forks (~1,400 LOC)
- [ ] E2E coverage for translations — **zero specs exist**

## Homepage CMS

- [x] `/homepage` route with `HomepageEditView`, tab selected via `searchParams`
- [x] Hero tab
- [x] Editorial tab
- [x] FAQ tab
- [x] SEO tab
- [x] `translation-pointer.tsx` linking into the translation console
- [x] `/home-page` and `/home-page/translations/:locale` endpoints wired
- [x] Media fields go through the shared media selectors, not pasted URLs

## Pages / CMS

- [ ] Pages module (legal, marketing, editorial pages) — **NEVER BUILT.** No route, no component, no API module. The nav "Pages" group contains only Homepage, with a comment that the rest arrives "from Phase 5"
- [ ] Rich-text editor — **no TipTap or any rich-text dependency is installed** in `package.json`, confirming the gap; port the working config from the `wattup-frontend` project when this starts
- [ ] Page CRUD + slug + publish state + per-locale translation wiring
- [ ] Two user-owned decisions still block the backend Phase 5 of the homepage/pages plan

## Featured experiences

- [x] Built as the **experiences tab inside the Homepage module** (`homepage-experiences-tab.tsx`), not a standalone route
- [x] `/featured-experiences` and `/featured-experiences/:id` endpoints wired (create, reorder, remove)
- [x] Admin curates categories and hubs (never individual tours), per the platform rule

## Locals' favourites

- [x] `/locals-favourites` route, 3 components + `lib/api/locals-favourites.ts`
- [x] `PATCH /tours/:id/locals-favourite` wired, `MANAGE_EDITORIAL`-gated, admin-only and never tier-linked
- [x] `/tours/admin/locals-favourite/stats` wired
- [x] Moved under CURATE beside Spotlight; the orphan-suspected `locals-favourites-list-view.tsx` proved live and was kept
- [ ] Show coverage against the ~30% editorial target from `CLAUDE.md` — the goal exists in the docs and is invisible in the UI
- [ ] Extract the inline columns into a sibling `*-columns.tsx` (the only table without one)

## Analytics

- [x] `/` overview route — server component, `getSessionRole` → redirect `/portal` if none, `USER` → `/bookings`
- [x] `app/_actions/dashboardActions.ts` (65 LOC) is a **real Server Action** calling the backend `/analytics/dashboard` — **not a mock** (spec claims: 00 §15, 04 §4.10 and defect B-3 describe it as a hardcoded literal with "John Doe" / "Bali Adventure" / `totalRevenue: 125000.50`; that data is gone from this repo)
- [x] Single aggregate call replaces the old 22-endpoint fan-out
- [x] URL-param date range (`lib/analytics/range-presets.ts`) with a server-resolved range label
- [x] Stats promise streamed unawaited into `PageComponents`
- [x] Defect B-2 resolved — the `|| true ?` forced-mock chart branches in `statistics.tsx` are gone, and all fabricated series and unbacked cards were removed
- [x] Role-shaped payload rendered correctly (`earnedEur`, `commissionEur`, `payoutDueEur`, `untrackedBalanceEur` mean different things to ADMIN vs OPERATOR; `cashCollectedEur`/`refundedEur`/`customers.registered`/breakdowns are null or empty for operators — no cross-operator leakage)
- [x] `types/analytics.ts` carries the settlement / payout / refund / FX concepts as data fields
- [x] FX block renders both currencies from one live EUR→USD rate, and falls back to **EUR alone** when the rate is null rather than converting at a stale rate
- [x] Booking outcomes funnel labelled honestly as outcomes, not a marketing funnel
- [ ] Split `statistics.tsx` per card with per-card `<Suspense>` so each streams independently (Phase 21)
- [ ] Make every card link to the filtered list that produced it ("a number nobody can act on is decoration")
- [ ] Pre-booking funnel (views, add-to-cart) — needs a tracking event store
- [ ] E2E coverage for analytics — **zero specs exist**

## Settings

- [x] `/settings` route, 15 components, `SettingsClient` branching on permission (`VIEW_SETTINGS` → admin settings; else `EDIT_OPERATOR_PROFILE`/`MANAGE_OPERATOR_PAYMENTS` → operator settings)
- [x] Admin: site info, SEO, social, company, payments (Stripe/Mollie/methods), integrations, Mailchimp, platform-reviews form
- [x] Operator: company + payments
- [x] `PATCH /settings/site` correctly busts the public `site-info` tag (defect B-1 fixed and regression-tested in both repos)
- [ ] Routed, deep-linkable sections (`/settings/general`) — today there is **no URL state at all**, worse than the entity editors
- [ ] Rename to end the naming collision: admin `General` → **Site**, admin `Company` → **Legal Entity**, operator `Company` → **Your Business**
- [ ] Search within settings, fed by the command palette
- [ ] Connection status + test action on Stripe / Mollie / Mailchimp
- [ ] Fold the settings-local `settings-fields.tsx` design system into the shared form primitives
- [ ] E2E coverage for settings — **zero specs exist**

## Notifications

- [ ] Notifications module — **NEVER BUILT.** No route, no component, no API module; only a bell affordance in `components/shell/site-header.tsx`
- [ ] In-app notification feed / read state
- [ ] Actionable nav badges (bookings needing attention, pending cancellations, pending spotlight approvals) — specified in the IA, not built
- [ ] Operator email/notification preferences surface

## FX admin

- [ ] FX / multi-currency admin module — **NEVER BUILT.** No route, no component, no API module
- [ ] Rate provider configuration, refresh trigger and rate-history view (`FX-AND-MULTI-CURRENCY.md`)
- [ ] Snapshot inspection (bookings carry a snapshotted `fxRateToEur`; there is no UI to inspect or audit it)
- [x] Display-side money formatting exists (`lib/currency/current.ts`, `types/money.ts`) — formatting only, not administration

## Slug registry & redirects

- [ ] Slug registry admin module — **NEVER BUILT.** No route, no component, no API module; slug is only a per-entity form field
- [ ] 301 redirect table management (view / add / retire redirects created by renames)
- [ ] 90-day reuse-cooldown visibility for deleted slugs
- [ ] Reserved-slug and per-destination collision inspection
- [x] The `slug-registry` cache tag is emitted correctly on tour and slug writes, and `/tours/slug/:slug` is excluded from the granular `tour:<id>` tag (a lookup, not an entity id)

## Cache revalidation

- [x] `lib/api/fetch.ts` calls `revalidatePublicForPath(path, method)` after **every successful write** — revalidation is centralized in one place
- [x] `lib/api/cache-revalidation.ts` (212 LOC) maps write path + method → tags
- [x] `lib/cache-tags.ts` (160 LOC) — the cross-repo tag contract, types derived from the runtime arrays so the two halves cannot disagree within a repo
- [x] `app/_actions/revalidate.ts` (140 LOC) as the Server Action transport: POSTs tags to the public site's `/api/revalidate` with `REVALIDATE_SECRET` kept server-side, 3s timeout, `[300,800]` jitter backoff
- [x] Public endpoint uses `revalidateTag(tag, { expire: 0 })`, **not** `updateTag` (which throws in a Route Handler and would fail silently on a fire-and-forget caller)
- [x] Timing-safe secret comparison; 400 on any unknown tag rejects the **whole** batch (the drift guard); 401 never echoes the secret
- [x] `lib/api/revalidation-throttle.ts` — leading+trailing coalescing throttle (~1s window, per unique tag set, flush on `pagehide`/`visibilitychange`); measured 21 POSTs → 3
- [x] `apiFetch` retry with full jitter on 429/503, **GET only** (explicitly refuses to retry mutations)
- [x] `/availability/check` short-circuits to no tags
- [x] All of spec 02B §10 verified (mapping 1-9, endpoint 10-18, transport/throttle 25-33, plus ~20 extra cases)
- [~] `REVALIDATE_TARGET_URL` / `REVALIDATE_SECRET` unset = revalidation **silently disabled** (logged once) — fine locally, a staleness bug in production; the user must set both on the real environments
- [ ] Automated guard on the byte-identical `lib/cache-tags.ts` across the two repos — enforced only by a **manual `diff`** plus a runtime 400; no CI exists and a shared package was deliberately rejected
- [ ] Backend-emitted revalidation via the outbox (02B §8) — the target state; today BullMQ nightly jobs, Stripe webhooks, seeds and admin scripts **never** bust the public cache (a pre-existing gap, not a regression)
- [ ] A durable queue/replay for lost revalidations — a revalidation lost to a hard failure is **lost forever**; mitigated by the TTL backstop and alerting, not solved
- [ ] `cacheLife` audit on the public repo (only `site-info` confirmed)

## Domain move & cutover

- [x] Interim domain plan fixed: `islandtours.esenc.cloud` / `dashboard.islandtours.esenc.cloud` / `api.islandtours.esenc.cloud` — one apex, all same-site
- [x] `COOKIE_DOMAIN` prod default `.islandtours.esenc.cloud`, read only when `NODE_ENV === 'production'`; must match the backend's `crossSubDomainCookies.domain` or it is a login loop
- [x] Legacy `/dashboard/*` → `/*` 308 in `proxy.ts` so bookmarks survive the cutover
- [x] `.env.production.example` and the backend's committed `.env` examples updated with the new origin
- [~] **Phase 9 cutover is BLOCKED on user-owned work.** The automated parity half is done with no regression, but the deploy cannot proceed
- [ ] **USER:** create the Vercel project for `dashboard.islandtours.esenc.cloud` and cut DNS — a `*.vercel.app` host **cannot authenticate**, because the session cookie is scoped to a different registrable domain, so there is no "deploy now, domain later"
- [ ] **USER:** add `https://dashboard.islandtours.esenc.cloud` to `CORS_ORIGINS` in the backend's **real** `.env.production` (only the committed examples were changed); this one var feeds both `main.ts` CORS and Better Auth `trustedOrigins` — a miss rejects **sign-in**, not just fetches
- [ ] **USER:** parity #2 and #9 on staging (production-gated cookie behavior — not reproducible locally)
- [ ] **USER:** parity #6, #7, #10, #43-45, #49 and the visual half of the module rows — an agent cannot report "the avatar crop looks right"
- [ ] **USER:** eyeball the newly-documented sidebar font delta (DM Sans + General Sans dropped in Phase 5 → Noto Sans in 4 usages)
- [ ] **USER:** the Phase 2 visual check of the 6 tour pickers
- [ ] Target-domain move to `island.tours` / `dashboard.tripwheel.io` / `api.tripwheel.io` (spec 02C + the 02D runbook) — **deferred separate project**, untouched
- [ ] Raise the public site's cross-site auth break (02 §1.2) before the DNS cutover — reported, not solved; does not block the split

## Testing

- [x] Playwright configured (`playwright.config.ts`, `test:e2e`/`:ui`/`:debug`/`:report`, `auth.setup.ts`, `e2e/fixtures/index.ts`)
- [x] 9 e2e specs written: attributes, categories, categories-new-fields, collections, destinations, destinations-new-fields, hubs, hubs-new-fields, trips, trips-new-fields — all API-mocked via route interception, asserting PATCH/POST/DELETE calls and toasts
- [~] Phase 9B e2e trim is **PARTIAL** — 55 tests cut and mocks repointed, but **trips fixtures are parked** (~1 day of work, 4 migrations behind)
- [~] The committed suite **must not be read as green** — `e2e/test-results/` holds **~80 checked-in failing-test directories** (each with `error-context.md` + `test-failed-1.png`) spanning attributes, categories, collections, destinations, hubs and trips
- [ ] Repair or delete the ~80 checked-in failing test-result directories so the repo stops shipping a red run as its baseline
- [ ] Diagnose the ~41 undiagnosed failures carried over from the Phase 9 comparison run (the suite is ~45% red on **both** old and new — it is measuring its own decay, not the extraction)
- [ ] Fix e2e isolation so the suite can run `workers: 4` instead of `workers: 1` — the expensive half of Phase 9B
- [ ] E2E coverage is **Curate/Catalog-only**; add specs for **bookings**
- [ ] Add e2e specs for **payments**
- [ ] Add e2e specs for **cancellation requests**
- [ ] Add e2e specs for **staff & designations**
- [ ] Add e2e specs for **settings** (admin 6 tabs + operator 2 tabs)
- [ ] Add e2e specs for **media** (upload, picker, bulk delete)
- [ ] Add e2e specs for **homepage CMS**, **spotlight**, **translations**, **locals-favourites**, **operators** and **analytics** — none exist for any of them
- [ ] Add a **unit test runner** — there is no vitest or jest in `package.json` at all, so `cache-tags.ts`, `rbac.ts`, readiness computation and money helpers have no unit coverage
- [ ] Contract guards B1-B7 between the two repos (B1 rbac, B2 types, B3 cache tags are the ones that will bite)

### Dashboard summary

**Done 187 · Ongoing 15 · Pending 122** (324 tasks total). The dashboard is a mature, near-complete
application, not a scaffold: 21 modules are built and wired, the extraction is code-complete through
Phase 8 with Phases 10-15 of the redesign also DONE. What remains splits three ways — (1) six
surfaces that were **never built** (settlements/payouts, refunds, FX admin, notifications,
slug-registry/redirects, Pages/CMS) plus one genuine placeholder (`/reviews`); (2) the untouched
redesign phases 16-20 and the backend-blocked phases 21-23; (3) a test suite that is narrow and red.

### Blocked on user

1. **Vercel project + DNS for `dashboard.islandtours.esenc.cloud`** — Phase 9 cutover cannot complete without it, and a `*.vercel.app` host cannot authenticate at all.
2. **Add the dashboard origin to `CORS_ORIGINS` in the backend's real `.env.production`** — a miss rejects sign-in, not just fetches.
3. **Set `REVALIDATE_TARGET_URL` and `REVALIDATE_SECRET`** on both apps in production — unset means revalidation is silently disabled.
4. **Visual sign-off on parity rows #6, #7, #10, #43-45, #49**, the module rows' visual half, the sidebar font delta, and the Phase 2 tour-picker check.
5. **Parity #2 and #9 on staging** — production-gated cookie behavior, not reproducible locally.
6. **Open decision #2** — keep or remove the header weather widget (02 says carry, 04 says remove; it is a product call).
7. **Open decision #4** — Phase 17 rollback shape: one PR, or console-first with the tab deletion as a same-day follow-up.
8. **The two decisions blocking Pages/CMS (Phase 5 of the homepage/pages plan).**

---

# PART V — CONFLICTS, STALE DOCS & OPEN DECISIONS

> **Arbitration rule (project-wide):** `technical-doc/island-tours-platform-master.html` (v1.9,
> June 11 2026) is the canonical source of truth — "where any doc, **or the codebase**, disagrees
> with it, the master wins." Where the master does not speak to a point, the item is marked
> **NEEDS FOUNDER DECISION**.
>
> Nothing below is resolved here. Both sides are recorded with their sources.

---

## V.1 Spec conflicts (documents disagree with each other)

| # | Topic | Claim A (source) | Claim B (source) | Impact | Suggested arbiter |
|---|---|---|---|---|---|
| 1 | **`operator_full` payment model — live or dropped?** | Live fourth payment model, fully specced: no charge, no webhook, booking created `confirmed` at commit, straight to TYP (master §5.8 + §12, conflict log **C22**/79/80/82; PROJECT-SCOPE §5; BOOKING-AND-PAYMENTS; DATA-MODEL; TRACKING; booking-confirmation email wireframe blocks 1/5/6/9) | **Dropped from v1**, returns in v2 — founder decision locked **2026-07-15** (`SETTLEMENT-AND-PAYOUTS.md` Part 2; `EVENT-DRIVEN-AND-QUEUES.md` §3 notes it explicitly) | Five+ documents still specify UI, email, TYP and tracking branches for a model that is not shipping. Email wireframe coverage "remains the binding template shape if it is reinstated". Backend already rejects `OPERATOR_FULL` (BOOKING-CHECKLIST §0 flaw 6) | **Founder decision 2026-07-15 governs** (later + explicitly locked). Master needs amending to record the v1 drop — until then the master text reads as live |
| 2 | **Badge precedence & sponsored trigger** | `TOUR-BADGES.md` (Jun 30): priority **1 sponsored → 2 likelyToSellOut → 3 mostPopular → 4 new** ("sponsored outranks every earned badge"); sponsored = **ACTIVE Spotlight ONLY** ("commission tier alone does NOT make a tour sponsored") | `TOUR-BADGES-AND-RANKING.md` (Jul 19, §2.2 "FINAL, product decision 2026-07-18"): priority **1 likelyToSellOut → 2 mostPopular → 3 new → 4 sponsored (fallback)**; sponsored = ACTIVE Spotlight **OR paid tier P1–P3 (`tier_rank <= 3`)** | Every listing surface renders the wrong badge on paid placements if the stale doc is followed. Code shipped the Jul 19 behaviour (EXECUTED 2026-07-18) | Master §3.6/§3.7/§7.2 — but the Jul 19 doc self-describes as FINAL after two iterations and matches code; **TOUR-BADGES.md appears stale on this point** |
| 3 | **Nightly job runtime: BullMQ vs in-process** | `ARCHITECTURE-OVERVIEW.md` §8 and `EVENT-DRIVEN-AND-QUEUES.md` §4 specify **BullMQ repeatable (cron)** | `AVAILABILITY-BOOKING-ARCHITECTURE.md` §9 documents the shipped job as **in-process `@nestjs/schedule` at 03:00 UTC, explicitly NOT BullMQ** (recomputes, not retry/concurrency queues); FX §M4 follows the same in-process convention | Deployment/scaling model differs: in-process cron double-fires on multi-instance deploys; BullMQ needs Redis. CLAUDE.md rule 18 says "BullMQ is for the master's async work… nightly quality-score/eligibility/materialization" | Master (job architecture) — **NEEDS FOUNDER DECISION** on whether the shipped `@nestjs/schedule` choice is ratified or reverted before scale-out |
| 4 | **Category page gating threshold** | Canonical / `CLAUDE.md` / master: page renders at **≥3 published tours** per destination (also `[B.45]` "≥3 adopted provisionally (C2)") | **Code gates at ≥1** (ROUTING §13, SLUG-REGISTRY §10, DATA-MODEL E.2); the homepage featured-card gate deliberately **mirrors the code** | Thin category pages ship at 1–2 tours; SEO gating intent defeated. Explicitly logged as "KNOWN CONFLICT, surfaced not silently resolved" | **Master (≥3)** — note `[B.45]` calls ≥3 "provisional". If ≥3 is intended, **the category service and the featured-card gate must change in the same commit** |
| 5 | **Traveler step-up authentication scope** | Rationale **D5** defers the traveler step-up email code to **v1.1** | **D16** and spec **§2.4.5** put invoice / cross-booking step-up **in v1** | Determines whether v1 ships an email-code challenge for the traveler surface | **Reconciliation founder decision (2026-07-19): deferred entirely** — v1 has no invoice download and no cross-booking surface, so the trigger does not exist. Both D5 and D16 are superseded |
| 6 | **Three login doors vs a fourth `/account` door** | Login spec + `01-summary`: **three separate, purpose-built login surfaces** (traveler passwordless, operator, staff IdP), **"no passwords for travelers"** by principle | **2026-07-20 amendment**: customer accounts with `Role.USER` + set-password email and a **FOURTH door `/account`** (MASTER-CHECKLIST §6.8; not in master v1.9) | Softens both the "no traveler passwords" rule and the three-doors model that the whole login spec is built on | **NEEDS FOUNDER DECISION** — the amendment postdates master v1.9, so the master cannot arbitrate until it is amended |
| 7 | **Auth engine: Supabase vs Better Auth** | Login **spec + rationale (D12)** specify **Supabase Auth** + Google SSO ("no custom crypto, enumeration-proof, SMS-free by principle") | Reconciliation, implementation plan and the `why-better-auth` doc all override to **Better Auth**, citing CLAUDE.md rules 12/14 and "the master wins" | Whole auth stack, session model, and hosting posture | **Resolved in the doc set: Better Auth.** Recorded here because the spec + rationale still read Supabase and are cited elsewhere |
| 8 | **All Tours filter modal — two versions** | `[ALLTOURS-MUST]` names a **6-filter set**: Price / Duration / **Booking type** / Rating / **Free cancellation toggle** / **Pickup included** | `[FILTER-MODAL]` (dtpl-11) is the **final locked version**: Price / Duration / **Time of day** / **Free cancellation window** (24h/48h/72h) / **Pickup available** (toggle) / Ratings (hidden until reviews exist). Booking type **removed** (was a no-op) | Filter UI, URL params, and backend filter contract differ between the two lists | **Master — dtpl-11 is self-described as "the final locked version"**; `[ALLTOURS-MUST]` is the earlier set |
| 9 | **"Pick-up" hyphenation** | `[TOURCARD-FIX]` **Fix 7**: `Pickup is available` → **`Pick-up available`** — the hyphenated form signals optional/at-extra-cost | `[LD3]` locks **"Pickup", NO hyphen, platform-wide**; `[ALLTOURS-IMP]` locks **`Pickup included`** for All Tours card labels | Three different strings for one attribute across cards, filters and 7 locales | **Master — LD3 is a Locked Decision and is platform-wide**; Fix 7 conflicts with it (the master itself flags the conflict inline) |
| 10 | **Trust strip line count (widget)** | `[ALLTOURS-IMP]`: the original All Tours review locked a **4-checkmark trust strip** (+ WhatsApp link) below the grid, currently missing from the wireframe | **LD5**: booking widget trust strip is **exactly TWO clickable lines**, final of the 4→3→2 chain; **no WhatsApp** ("no exit ramps at the commit moment"); single line on `paid_in_full`/`operator_full` (conflict log 81) | Risk of applying LD5's 2-line rule to the All Tours page strip, or the 4-line strip to the widget | **Master — these are two different surfaces.** LD5 governs the **widget**; the 4-checkmark strip is the **All Tours below-grid** element. Flagged because the 4-line spec predates LD5 and reads as contradictory |
| 11 | **`Trip` vs `Tour` naming** | Prisma/schema and dashboard routes use **`Trip`** (`trips.prisma`, `Trip` model, `/trips` routes, `dashboardActions`, trips fixtures) | Master, public API and all product copy use **`Tour`** (`/tours` endpoints, "Tours" labels; Phase 14 dashboard labels already say "Tours" while routes stay `/trips`) | Permanent translation layer between schema, dashboard routes and public API; onboarding friction | Dashboard-extraction **open decision #1: DEFERRED** ("keep the extraction reviewable"; revisit at Phase 6 go/no-go). **NEEDS FOUNDER DECISION** on timing |
| 12 | **`ON_ARRIVAL` — deposit or no upfront charge?** | Master §1.4 / §5.8 / conflict log C22 + BOOKING-AND-PAYMENTS §1: **`ON_ARRIVAL` is a deposit model** — the doc's own warning: "if code treats `ON_ARRIVAL` as no upfront charge, that conflicts with the master" | `BOOKING-CHECKLIST` §0 flaw 1 marked `[x]` **FIXED**, but §4 and §5 lines still read `[~]` "Currently deposit=0" / "Currently returns null" | Traveler is charged €0 instead of the deposit; forfeit rules and cancellation copy break | **Master — `ON_ARRIVAL` is a deposit model.** The checklist's own internal contradiction needs reconciling |
| 13 | **`OPERATOR_FULL` rejection status** | `BOOKING-CHECKLIST` §0 flaw 6 = `[x]` (backend rejects `OPERATOR_FULL`) | Same doc, §4 line = `[ ]` (not done) | Cannot tell from the checklist whether the reject path is shipped; interacts with conflict #1 | Internal to `BOOKING-CHECKLIST.md` — **doc must be reconciled against code**, master not implicated |
| 14 | **OCTO namespace path** | **D0 recommends `/api/octo/v1`** | **§3.2 executed line records the built path as `/api/v1/octo/tours`** | Public integration URL for every OCTO supplier; changing it later is a breaking change for partners | **NEEDS FOUNDER DECISION** — recorded as a discrepancy, not resolved. (Note: OCTO booking endpoints are not implemented at all; the OCTO surface is supplier + products read-only) |
| 15 | **Cancellation-refund timing basis** | Architecture doc: the free-cancellation window is judged at the **cancellation-request timestamp** (the traveler ack email even says "terms are judged from this moment") | Code computes it at **`cancel()` action time** (when the admin/system actually cancels) | A request inside the window that is processed after it flips to non-refundable — real money difference | **Master §6.4** (cancellation policy). Logged as date-time gap 16, "docs and code disagree" — **OPEN** |
| 16 | **`TOUR_OPERATOR` account creation** | `ROLES-AND-ACCESS-MANAGEMENT.md`, PROJECT-SCOPE §3 and ARCHITECTURE-OVERVIEW §4: **self-registration** (Better Auth email verification + Google) | Repo `CLAUDE.md`: **admin-invited** (set-password email); the operator-apply surface exists | Determines whether operator signup is open or gated; changes onboarding, vetting and the apply page's purpose | **Master arbitrates** — "unreconciled in the doc set" |
| 17 | **Category page: one listing or two** | Master **§5.4 = one listing, no trust bar** (§3.11 locked matrix) | Code renders **two listings + a `CategoryTrustStrip`** | Duplicate listings and an unspecced trust element on 19 categories × 3 destinations | **Master wins unless it is amended** — flagged as a master-vs-Figma **founder decision** |
| 18 | **`cancellation_hours` default** | Canonical: **enum [24, 48, 72, 168], default 48**, NOT NULL (CLAUDE.md rule 20, LD1) | Code: `Int @default(24)` | Every tour created without an explicit value advertises a 24h window instead of 48h — a customer-facing policy term | **Master (default 48)** |
| 19 | **Booking status vocabulary** | `BOOKING-AND-PAYMENTS.md` / `DATA-MODEL.md`: `pending_payment` / `confirmed` / `cancelled` | Shipped code (`AVAILABILITY-BOOKING-ARCHITECTURE` §3.5, §11.2): **`ON_HOLD` / `CONFIRMED` / `CANCELLED` / `EXPIRED`** | Docs, dashboard filters and API consumers reference statuses that do not exist; `EXPIRED` is undocumented | **Master (Appendix E.8)** — docs likely need updating to the code's four-state model |
| 20 | **Payment providers** | Most docs: **Stripe** only | `SETTLEMENT-AND-PAYOUTS.md` Part 2 + its HTML companion: **Stripe/Mollie**; `operators.prisma` carries a `MollieConfig` | Determines webhook surface, settlement rails and the operator config UI | **NEEDS FOUNDER DECISION** — the settlement doc is the later artifact but the master says Stripe |
| 21 | **Materializer horizon constant** | `AVAILABILITY-BOOKING-ARCHITECTURE.md` §5.1 states `MAX_HORIZON_DAYS = 23` | The **same sentence** says the hard cap is 365 days; `AVAILABILITY-AND-DEPARTURES.md` §3.1 confirms **365** | Apparent typo, but if taken literally the rolling window collapses from 12 months to 23 days | **Master / AVAILABILITY-AND-DEPARTURES (365)** — treat §5.1 as a typo, correct it in the doc |
| 22 | **Spectator pricing model** | Master: **"spectator pricing lives in `add_ons[]`"** | Figma booking widget + code: spectators are **banded** (Adult $20 / Kid $10) with their own line items — a flat `TourAddOn` (single price) cannot express this; modeled as `TourAgeBand` rows with `participation = SPECTATOR` | Two incompatible pricing shapes for the same concept | **Master says add-ons** — divergence is **acknowledged and deferred (PRICING D6)** in both docs, not resolved |
| 23 | **Rate-limit / permission-cache store** | Login spec and plan both mandate a **central store, never in-memory** | As-built traveler limiter **and** the staff permission cache are both **in-process today** | Limits and permission revocation are per-instance; breaks the moment the API scales past one node | **ACCEPTED deviation with a documented pre-deployment gate** (shared Redis invalidation before scaling out) — see V.3 |
| 24 | **`accountUrl` in booking emails vs master C1** | Master **C1: "No account area in v1"** — asks only for a lightweight booking-lookup fallback (reference + email) | Email template footer says details/history/invoice "are always in your Island Tours account at `{accountUrl}`"; `/bookings` **does exist** in code (built after the master was written) | Emails point travelers at a surface the master says does not exist | **Master B.34 RESOLVES it** (Arnav confirmed): accounts ARE auto-created with email + booking-reference login; "No account area" is superseded and the email line is correct. **The lookup login page itself is still to build** |
| 25 | **Cancel flow shape** | Booking-email wireframe: **request → admin email → admin processes refund and confirms** (request-based, no auth mentioned) | As-built cancellation endpoint is **session-gated** (401 without an owning traveler session) | Consistent in outcome, but adds an authentication gate the wireframe never specifies — travelers without a live session cannot start a cancellation from the email | **Master §6.4** — flagged as an addition, not a contradiction |
| 26 | **Weather widget in the dashboard header** | `02` Appendix C1 **defaults to carrying it** (`weather-slider.tsx` 193 LOC + `utils/weather.ts` ~300 LOC + an OpenWeather API key + an external network dependency in an admin CRM) | `04`'s UX recommendation is to **remove it** | Dead weight and a third-party dependency in an admin tool | **NEEDS FOUNDER DECISION** (dashboard open decision #2 — still in the header as of Phase 14) |
| 27 | **Category page H1 template** | Uniform template H1 across categories | **C19**: per-category keyword-matched H1s proposed ("Sunset cruises in Curaçao", "Snorkeling in Curaçao") — "advice only, never decided" | SEO targeting for 19 categories × 3 destinations × 7 locales; feeds the C16 per-category content spec | **NEEDS FOUNDER DECISION** — **C19 is the only Appendix C item still open** after the June 10 2026 veto round |
| 28 | **`Tour.isBookable` semantics** | Option A: coarse **cached flag, allowed to be stale** during the day (refreshed on schedule mutations + nightly) | Option B: **live-computed** for user-facing endpoints | Listings/search can advertise a sold-out or unbookable tour; "acceptable only as a coarse listing optimization" | **NEEDS FOUNDER DECISION** (date-time gap 7) — master does not speak to caching strategy |
| 29 | **Spotlight / admin campaign windows** | UTC instants | Destination-**local** campaign dates | A spotlight campaign starts/ends up to a day off from what the admin entered | **NEEDS FOUNDER DECISION** (date-time gap 9) — recommendation on file: **keep as UTC instants** |

---

## V.2 Stale documentation (docs disagree with shipped code)

> Where a document claims a different status than the code shows, **the code wins** — the doc's
> claim is recorded here so it can be corrected rather than silently trusted.

| # | Doc | Claims | Reality (code audit) | Action |
|---|---|---|---|---|
| 1 | `technical-doc/APPLICATION-FEATURES.md` (44 lines) | Marks **bookings, payments, tiers, availability and reviews as NOT BUILT** | **All five ship today.** Bookings/payments (reserve → Stripe → webhook → TYP → emails → cancellation), the tier + eligibility engine, the three-table availability model with nightly materializer, and read-side reviews are all in the codebase | **Materially stale — supersede.** The Part 0–IV inventory replaces it. Leave the file in place but mark it superseded at the top, or delete it |
| 2 | `MASTER-CHECKLIST.md` — progress table | **"46 of 203 tracked master points implemented (~23%)"**, 157 remaining, 15 partial. Per-section Done counts: §3 Design system **0**/12, §4 Brand voice **0**/4, §5 Page specs **0**/11, §6 Booking/payments/email **0**/13, §7 Commercial model **0**/15, §8 Tracking **0**/12 | The table is **stale relative to the item markers directly beneath it** — many items in §3, §5, §7 and §8 carry `- [x]`. The commercial engine (§7), the public page set (§5) and dashboard analytics (§8.4, built 2026-07-20) are substantially built. ~23% materially understates completion | **Recompute the whole table from the `[x]` markers.** CLAUDE.md requires this file to be updated in the same commit as the work — that rule has been breaking |
| 3 | `backend/src/workers/nightly-jobs.service.ts:22` | TODO comment claims **quality_score + tier eligibility are unbuilt** | Both are **actually invoked inside `run()`**. Explicitly classified in the code audit as "stale comment only, not a gap — code > comment here" | **Delete the TODO comment.** No code change needed |
| 4 | `hub-discover-section.tsx` / `hub-compare-section.tsx` | Inline **"MOCK convention"** comments implying mock data | The hub page is **BUILT and fully backend-fed** — `/hubs/render/:slug` supplies hero, picks, `comparisonGroups`, `discover`, `localTips` and FAQs. The comments are **doc-only; the data is real** | **Delete the MOCK comments** — they will cause a future engineer to "fix" working code |
| 5 | `DATA-MODEL.md` E.9 + `ARCHITECTURE-OVERVIEW.md` §5 | Describe the **three-table availability model as "to build"** | `AVAILABILITY-AND-DEPARTURES.md` and `AVAILABILITY-BOOKING-ARCHITECTURE.md` mark it **BUILT** — `backend/prisma/availability.prisma`, `backend/src/availability/`, `backend/src/workers/nightly-jobs.service.ts`; legacy `TourSchedule` superseded. Sibling docs contradict each other | **Update E.9 and §5 to "built."** Treat "Action: Build" rows as done except the API adapters |
| 6 | `TRIP-MODULE.md` (Jul 2) + `TOUR-MODULE-DATA.md` §1.6 (Jul 2) | Commercial tier columns on the tour are **"to add"** / **"all ✓ but service logic still to build"** | `TOUR-BADGES-AND-RANKING.md` (Jul 19): columns **built + eligibility engine EXECUTED 2026-07-18** (flat bar, provisional window, nightly grace/demotion in `changeTier` + `runEligibilityLifecycle`) | **Update both Jul 2 docs** — newest doc reflects the code |
| 7 | `TOUR-BADGES.md` | Calls `applyMostPopularCap` (max 1 most-popular badge per category) a **"Known simplification"** i.e. not implemented | **Built 2026-07-18**, page-local implementation | **Remove the "known simplification" note** |
| 8 | `technical-doc/dashboard-extraction/README.md` header | Headline status implies redesign is **gated on Phase 9** and extraction is mid-flight | **`06`'s progress table is the live status**: extraction phases **1-8 DONE (2026-07-17)**, Phase 9 automated half DONE with no regression, and **the gate was read honestly and Stage C (redesign) started** as a user-approved deviation | **The README header is superseded by its own `06` progress table.** Point the README at `06` and stop stating status in two places |
| 9 | `BOOKING-FLOW-DESIGN-GUIDE.md` §18 and §23 checklists | **100% unchecked** | Three sibling docs mark many of the same items **done**; the guide's checkboxes "were evidently never maintained" | **Either re-derive from the sibling checklists or delete the checkboxes** so the guide stops reading as a status source |
| 10 | `BOOKING-CHECKLIST.md` group headers | Group counts read **"C. Email (0/7)"**, **"D. Async/queue (0/8)"**, **"E. Tracking (0/8)"** | Individual items inside those groups are ticked — e.g. **E3 (real-TYP payload) is `[x]`**, verified live; the C-group email work shipped across rounds 5–6 | **Recompute the group counts** — they are stale headers over live item markers |
| 11 | `BOOKING-CHECKLIST.md` §0 vs §4/§5 (widget + payment models) | §0 lists the widget as **"STILL PENDING"** (quote/submission/processing/TYP); §1 says **`[~]` "slots capped at 3 / no real availability"** | §5/§6/§7/§8 mark those same items **`[x]` DONE** later in the same doc; §4 records **`[x]` "removed the `slice(0,3)` cap"** | **Reconcile within the document** — §0 is a stale summary of its own body |
| 12 | `BOOKING-COMPLETION-PROGRESS` flow table | **"real-TYP data still demo"**, **"no tokenized cancel page"** | **E3 and B3 are marked `[x]` DONE elsewhere in the same doc** — the TYP renders real guest/operator/ref/party/money (verified live on a real booking ref) and the master-6.4 cancel page shipped in round 5 | **Update the flow table** |
| 13 | Docs referencing the checkout **"lowest applicable" from-price line** | Master wording still describes the superseded from-price rule | Superseded by the default-band **"From" anchor** shipped in the PRICE1-3 pass | **Master wording update owed** (listed on the blocked-on-founder ledger) |
| 14 | Docstrings claiming `await connection()` | Several frontend sections' docstrings claim `connection()` is used, and `tours-listing-section.tsx` / `search-results-section.tsx` comments claim the wrong dynamic-render mechanism | Both are **correct via `searchParams`**, not `connection()` — flagged as **stale comments** in the render audit | **Fix the stale docstrings** (cleanup list already drafted) |
| 15 | Demo-seed `quality_score` placeholders | The badges-and-ranking HTML board still shows seeded placeholders (`60 + tier×5`) | **Overwritten by the real nightly job** on the next 03:00 UTC run | **No action beyond noting it** — the board is transiently stale by design |

---

## V.3 Open decisions & blocked work

Each item: **what is blocked → who owns it → what unblocks it.**

### Blocked on the founder / user (cannot be agent-completed)

**1. Phase 9 dashboard cutover — staging deploy + DNS**
- **Blocked:** the entire dashboard extraction gate. Phases 1-8 are done and Phase 9's automated half passed with no regression, but the visual/parity half cannot run without a real deployed origin. Stage C (redesign) started anyway as a user-approved deviation, which means **every subsequent bug becomes an argument about whether the move or the redesign caused it** — the plan's own warning.
- **Owner:** user (infrastructure).
- **Unblocks it:** a Vercel project for `dashboard.islandtours.esenc.cloud` **plus DNS**, and adding that origin to `CORS_ORIGINS` in the backend's **real** `.env.production` (only the committed examples were updated). **A `*.vercel.app` URL cannot authenticate** — the session cookie is scoped to a different registrable domain — **so there is no "deploy now, domain later."** Also owed on staging: parity checks **#2, #9** (production-gated cookie behavior), **#6, #7, #10, #43-45, #49**, the visual half of the module rows, the **Phase 2 visual check of the 6 tour pickers**, and sign-off on the **sidebar-font visual delta** (DM Sans + General Sans → Noto Sans).

**2. C23 — counter-party settlement rails**
- **Blocked:** two money rails that must not be invented in code. (a) **operator payout on `paid_in_full`** (platform holds 100% of the money and owes the operator their share); (b) **Island Tours commission collection on `operator_full`** (platform holds nothing and is owed its commission). Deposit models (`operator_link`, `on_arrival`) are **resolved** — no cross-transfer, each party keeps its own leg.
- **Owner:** Arnav (founder).
- **Unblocks it:** choosing between **Stripe Connect** (named phase-2 candidate, conflict log **B.85** — would also make the currently off-platform `operator_link` / `on_arrival` balances machine-readable) and **manual invoicing in v1**. A v1/v2 decision was locked 2026-07-15 in `SETTLEMENT-AND-PAYOUTS.md` Part 2 (settlements ledger, scheduled `paid_in_full` payout, `operator_full` dropped from v1); the master's conflict log still carries C23 as open, so **the master needs amending to match**.

**3. Master Appendix C — remaining founder-confirmation item**
- **Blocked:** category-page H1 strategy. The June 10 2026 veto round resolved **C1-C18**; C19-C21 were added from the June 10 chat sweep and C22-C23 on June 11. **C19 is the only Appendix C item still open**: per-category keyword-matched H1s ("Sunset cruises in Curaçao") vs a uniform template — recorded as "advice only, never decided." It feeds the **C16 per-category content spec**, which cannot be finalised without it.
- **Owner:** Arnav.
- **Unblocks it:** a yes/no on per-category H1s.

**4. Login spec open items O1-O5**
- **Blocked:** the operator and staff login surfaces (traveler surface is hardened and shipped). Awaiting sign-off on: **O1** operator 2FA rollout (v1 TOTP + backup codes with white-glove enrollment; v1.1 WhatsApp fallback; **never SMS, never email codes**); **O2** traveler step-up scope (superseded by the 2026-07-19 deferral, see V.1 #5); **O3** operator portal locales (EN v1; NL + ES roadmap); **O4** device-trust duration (30-day remember-device, 14-day rolling session); **O5** Google Workspace — confirm all staff seats live in one org with enforced 2SV (passkeys or security keys).
- **Owner:** founder. The summary itself says it is **"a proposal awaiting founder sign-off (5 open items), not yet locked into the master."**
- **Unblocks it:** sign-off, then folding the spec into master §5.11 / §6.4 / Appendix E.11.

**5. Pages system (Phase 5) — two open decisions, NOT STARTED**
- **Blocked:** the whole CMS Pages feature. Dashboard nav "Pages" group currently contains only Homepage.
- **Owner:** user/founder.
- **Unblocks it — decision (a) routing:** `/{locale}/{slug}` **collides with `/{locale}/{destination}`**. Options: fall-through resolution (`destination → Page → 404`) vs `/legal/{slug}` namespacing, which **changes 6 live SEO-indexed URLs**. Recommendation on file: **fall-through, keep the URLs**. **Decision (b) rich text:** **neither repo has any editor, markdown lib, or sanitizer** — recommendation is to port **TipTap v3 from `wattup-frontend`** with 4 caveats. No rich-text dependency exists in either `package.json`.

**6. Dashboard open decisions #2 and #4**
- **#2 Weather widget** (see V.1 #26) — carry or remove; still in the header as of Phase 14. **Product call, owner: user.**
- **#4 Phase 17 rollback shape** — one PR, or console-then-delete. Recommendation: **console first, delete same-day** — "the one defensible R7 exception." **OPEN**; Phase 17 not started.
- *(#1 trips→tours rename **DEFERRED**; #3 `revalidateTag` profile **RESOLVED** — shipped `{ expire: 0 }`, `'max'` deferred; #5 Playfair Display **RESOLVED** — dropped, user-approved.)*

**7. Demo reseed (only remaining item on the pricing-model checklist)**
- **Blocked:** demo data does not reflect the no-age-band **unit** pricing model. All code and tests shipped (backend suite green at 875); this is purely a data rebuild.
- **Owner:** user (must run locally against their DB).
- **Unblocks it:** `pnpm prisma:seed:demo:clean` then `pnpm prisma:seed:demo`.

**8. Environment secrets not wired in the real environments**
- **Blocked:** two cross-app mechanisms silently no-op without them. **`INTERNAL_API_SECRET`** — forwarded by `lib/server/auth-headers.ts` on SSR fetches to exempt trusted origins from the per-IP throttle; **must match the backend's**, server-only, never `NEXT_PUBLIC_`. Unset → SSR and build-time fetches get throttled. **`REVALIDATE_SECRET`** — shared by the dashboard's `app/_actions/revalidate.ts` and the public site's `/api/revalidate`; **unset = revalidation silently disabled** (logged once). Fine locally, **a staleness bug in prod**; contract guard **B7** notes 02B requires this to be logged, not swallowed.
- **Owner:** user (deployment).
- **Unblocks it:** set both in the real `.env.production` on backend, public site and dashboard (only the committed `.example` files are populated). Rotation is supported — `REVALIDATE_SECRET` accepts a comma-separated old+new pair.

**9. Third-party credentials blocking tracking and email**
- **Blocked:** **A5** GTM / Meta Pixel / CMP credentials — the entire tracking module (`booking_complete`, CAPI, Enhanced Conversions) cannot be wired; the frontend audit confirms **zero** GTM / `dataLayer` / `gtag` / `fbq` / CAPI in the repo (only Cookiebot). **B1** Resend production confirmation.
- **Owner:** founder.
- **Unblocks it:** supplying the accounts/keys.

### Accepted deviations with a pre-deployment gate

**10. In-process permission cache + in-process rate limiters**
- **Accepted** for the single-VPS deployment: 60s permission-cache staleness for grant changes; the traveler lookup limiter and staff permission cache both live in-memory (`lookup-rate-limiter.ts`).
- **Documented gate:** **shared invalidation (Redis) before scaling out.** Contradicts the login spec's "central store, never in-memory" mandate (V.1 #23).

**11. `trust proxy = 1` tripwire**
- Assumes **exactly one proxy hop** (nginx). **Must be bumped to `2` if a CDN or load balancer is added**, or clients can spoof `X-Forwarded-For` and defeat every per-IP limit. Owner: whoever changes the edge topology.

### Flagged, unowned, not fixed

- **Two live Cloudinary accounts.** `SiteInfo.logo` → cloud **`djqinkh2c`**; `backend/.env` `CLOUDINARY_CLOUD_NAME` → **`dsfms7jb4`**. Old absolute URLs keep resolving, but new uploads and old assets are **split across two accounts**. Decide: migrate or leave. **Owner: user.**
- **`start:prod` path bug.** Script is `node dist/main`, but the build emits `dist/src/main.js` — **production start would fail**. Pre-existing, explicitly "flagged, not fixed."
- **Gmail font — closed as impossible-by-platform.** Gmail (web + apps) and Outlook-Windows strip `<link>` / `@import` / `@font-face` for every sender. A closer-metric fallback (Segoe UI) would require a **wireframe edit first** — and the wireframe is the source of truth for booking emails.
- **WhatsApp `?text={greeting}` copy** needs real copy in **7 locales**; currently linking bare `wa.me/{number}`. Also owed: an **audit (report, do not unilaterally strip)** of hardcoded WhatsApp in `category-trust-strip.tsx`, `login/traveler-login.tsx` and `operator-apply.tsx` — `traveler-login` is checkout takeover chrome and is arguably the commit moment that master §6.6 excludes.
- **FX production provider.** Only `StaticFxProvider` (env constant, no network) exists, with an explicit **"never ship this to production"** docblock. The `FxProvider` interface and refresh/caching machinery are done; a real provider is not.
- **Tier eligibility cancellation-rate gate.** `tiers.service.ts:830` TODO — the rule also requires `operator.cancellation_rate_90d <= 10%`, but **the operator field (master E.6) does not exist yet**. Related: `ForceMajeurePardon` has **no admin CRUD** and is not consumed by the engine.
- **Clear `isSponsored` on spotlight cancellation** — "to be added" (`TOUR-BADGES-AND-RANKING.md` §2.3). A cancelled spotlight currently leaves the denormalized flag set.
- **Operator eligibility-demotion email notice** — built engine, but the operator notification is a **wireframe-gated TODO**.
- **Never run:** a real accessibility audit (axe, keyboard sweep, screen reader, focus order) and **bundle measurement** — both on the dashboard.
- **OCTO booking endpoints** (`/octo/bookings` reserve/confirm) are **not implemented**; the OCTO surface is supplier + products (read) only. `Octo-Env` live/test handling and booking `testMode` remain an **open item to verify** against the spec. `OCTO-PRISMA-SCHEMA-DESIGN.md` is **"design only; live schema untouched until approved."**
- **Booking-lookup login page** still to build (B3 leftover) — master B.34 confirmed accounts are auto-created with email + booking-reference login, but the login surface itself does not exist.
- **Translation "source updated" conflict flag** — **BLOCKED**: needs a source-updated timestamp; verify whether `updatedAt` on the EN translation suffices. Also blocked with no request number: **media tags** (needs a backend field) and the **profile session list** (needs an endpoint).
- **Dashboard technical debt owed:** Phase 9B trips fixtures (~1 day, 4 migrations behind); ~41 undiagnosed test failures; **e2e isolation** (`workers: 1` → `workers: 4`) — the expensive half; the `lib/cache-tags.ts` cross-repo `diff` (manual — **the dashboard repo has no CI at all**); contract guards **B1-B7** (B1, B2, B3 "are the ones that will bite"); deleting the dashboard route group from the public repo plus the duplicated `portal`/`staff`/operator-login surfaces; dropping the orphaned `@dnd-kit` packages; a `cacheLife` audit on the public repo (only `site-info` confirmed).
- **Async/queue hardening D1-D8: 0/8, all unchecked** — transactional outbox, hold-expiry sweeper wiring, queued confirmation email, queued CAPI job, scheduled `paid_in_full` payout job (pairs with the C23 decision), pre-tour reminder job, affiliate postback, and retries/backoff with no silent drop.

---

## Omissions

Two items from the requested list are **not included above** because the fragments did not support
them as written:

- **"Nightly jobs BullMQ-cron vs in-process `@nestjs/schedule`"** is included (V.1 #3), but no
  fragment records a *founder* position on it — only the two documents disagreeing. It is therefore
  marked NEEDS FOUNDER DECISION rather than arbitrated.
- **`APPLICATION-FEATURES.md`'s specific per-area markings** are sourced from the superseding
  document's own header note ("it marks bookings, payments, tiers, availability and reviews as not
  built when all five ship today"); the fragments contain the file's *description* but not its
  44-line body, so the individual rows could not be quoted directly.

Additionally, several conflicts referenced in passing in the fragments (e.g. individual master
conflict-log numbers 51-90) are **resolutions already recorded in the master's own Appendix B**, not
live disagreements, and are deliberately excluded from V.1.

*End of Part V.*

---

