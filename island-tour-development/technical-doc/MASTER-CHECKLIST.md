
# PART II — BACKEND TASK CHECKLIST

> Status is assigned from the **code audit** (`backend/src` + `backend/prisma`; last re-verified against the
> codebase **2026-07-25** — 37 wired modules, 76 unit spec files, 5 e2e suites). Where a technical doc asserts
> a different state than the code shows, the code wins and the doc's claim is appended in parentheses.
>
> `- [x]` DONE · `- [~]` ONGOING (exists but partial/stubbed/defective) · `- [ ]` PENDING (not built)

---

### Platform foundation

- [x] NestJS 11 strict-TypeScript app bootstrap (`main.ts`, `app.module.ts`) with base URL `/api/v1` and Better Auth mounted at `/api/auth/*` (no `/v1`)
- [x] Wire all 37 feature modules into `AppModule.imports` (Prisma, Faq, PageContentSection, StaffPermissions, Auth, Staff, Mail, User, Settings, HomePage, FeaturedExperiences, PlatformReviews, Instagram, Operators, MediaGallery, Categories, Destinations, Hubs, SlugRegistry, Sitemap, Tours, Attributes, Collections, Search, Octo, Availability, Fx, Tiers, Bookings, Customers, Payments, Settlements, Tracking, Reviews, Notifications, Wishlist, Workers, Analytics)
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
- [x] Per-door login enforcement (2026-07-27): sign-in requires `x-login-surface` (`account|portal|staff|admin`); `session.create.before` rejects missing/unknown headers and wrong doors (`WRONG_LOGIN_SURFACE`, post-password only) and stamps `Session.surface`; hat model in `auth/login-surfaces.ts` (ADMIN passes every door)
- [x] Advisory pre-login check `POST /auth/login-precheck` (`@Public`, throttled 5/min) — unknown emails always `ok:true`; wrong door returns `surfaces` + `suggested` for the login pages' wrong-door UX
- [x] One account, many hats (2026-07-27): `provisionOrAttachAccount` attaches staff/operator identities to existing emails (role elevation by precedence, never downgrade; shared `rollbackProvisionOrAttach` never deletes a pre-existing account); customer provisioning attaches Customer rows to staff/operator emails (no welcome email for credentialed accounts); effective permissions union `Role.USER`'s set when the account has customer rows
- [x] Self-service email change via Better Auth `user.changeEmail` (two-step: confirmation to the CURRENT inbox, verification to the new; taken emails = silent fake success); raw `email` removed from `UpdateUserByAdminDto` — no unverified email-write path remains
- [x] Hidden internal-management admin (`User.isSystemAccount`, migration `20260727154443`): seeded from `SYSTEM_ADMIN_EMAIL/PASSWORD` (optional), filtered out of `GET /users`, `GET /users/:id`, and the staff list's synthesized system-admin rows; immune to all admin mutations; logs in only at the admin app door
- [x] Surface-based view switching (2026-07-27): dashboard shapes customer-vs-staff view by `session.surface` (`isCustomerView` drives root redirect, route guard, nav trees, command palette, sign-out door) so a multi-hat account entering via `/account` gets the traveler view; `GET/PATCH /auth/session-surface` re-stamps the caller's OWN session to another surface it holds (validated against `getLoginSurfaces`; presentational only - guards never read it)
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
- [x] `activePaymentProvider` payout-destination switch (`operators.prisma`, default STRIPE) + `GET/PATCH /operators/:id/payment-provider` — `MANAGE_OPERATOR_PAYMENTS` + owner-only gate, 400 when the target provider is unconfigured, syncs both configs' `isActive` flags. Semantics: **receiving payouts only** — travelers are always charged by the platform's payment settings
- [x] `cancellation_rate_90d` (master E.6) — `cancellationRate90d` column on `Operator` plus a live trailing-90-day computation in the tier-eligibility engine (`operatorCancellationRate90d` in `tiers.service.ts`: operator-caused = `cancelledBy OPERATOR`; admin cancellations act as force-majeure pardons)
- [x] First-class `contactEmail` / `contactPhone` on the operator row (`operators.prisma`) — strict E.164 rejection via `libphonenumber-js` not verified
- [x] Operator onboarding state machine — WP-C, 2026-08-11 (`feat/operator-onboarding-state`, PR #180): `verificationDecidedAt` / `firstTourLiveAt` / `salesPendingReminderAt` columns (migration `operator_onboarding_state`); `POST /operators/:id/verification` (`MANAGE_OPERATORS`, guarded `PENDING → VERIFIED|REJECTED` via `updateMany`, 409 otherwise, actor logged) is now the ONLY writer of `verificationStatus` — the field is removed from `UpdateOperatorDto` so any PATCH carrying it 400s; operator creation starts PENDING and fires INT-1 to `SALES_EMAIL ?? ADMIN_EMAIL` (fire-and-forget); approve fires OB-2A (locked wireframe copy); tour publish stamps `firstTourLiveAt` one-shot and commits an `operator.first-tour-live` outbox event in the same transaction; tour submission additionally sends the INT-2 sales variant when `SALES_EMAIL` differs from `ADMIN_EMAIL`; operators list gains `toursSubmitted` (derived, `submittedAt IS NOT NULL` count), `firstTourLiveAt`, `verificationDecidedAt` + a `?verificationStatus=` filter for the dashboard queue (WP-E)
- [x] Operator onboarding email sequence — WP-D, 2026-08-11 (`feat/email-onboarding-sequence`): the nine-email drip on the WP-A spine. Eight TS templates with the wireframe copy locked (OB-2 welcome+agreement · OB-3 how-to with the Loom/guide alternates · OB-4 WhatsApp rescue — the one `#16A34A` green CTA · OB-5 tour-live · OB-6 near-plain founder check-in with `OB6_REPLY_TO` · OB-7 calendar · OB-8 page-stronger with the D6 partner-offer flag param · INT1R pending reminder); `OnboardingEmailsService` in the global `MailModule` fills the 15-min `email.lifecycle-sweep`: raw-SQL candidates ANTI-JOIN `email_sends` on `(templateKey, scopeId)` so decided operators never re-enter (perf carry-over D-25), every OB query gates `verificationStatus = VERIFIED` so ADMIN shadow operators never enter the drip (security carry-over D-26), send-time suppression writes reasoned SUPPRESSED rows (`tours-submitted`/`suspended`/`opted-out`/`flag-off`/`calendar-connected`/`not-verified`), Tue–Thu 09–11 Curaçao window (INT1R exempt), 3-day volume cap with OB-6 > OB-7 > OB-8 priority; OB-5 rides the `operator.first-tour-live` outbox fan-out (instant, transactional); INT1R stamps `salesPendingReminderAt` after `subtractBusinessDays(now, 2)`; OB-2A + INT-1 rerouted through `claimAndSend`; OB-1 logged from the Better Auth hook via the pre-DI client (P2002-swallow); lifecycle footers carry the WP-A unsubscribe token link + one-click `List-Unsubscribe` headers built from env bases + server-minted tokens only (D-28); `POST /operators/:id/emails/:templateKey/resend` (`MANAGE_OPERATORS`, OB set + OB-2A only) writes `#resend-{n}` rows and retries once with n+1 on a lost claim race (D-27). No migration (no status-led `email_sends` query exists → D-29 not triggered)
- [x] Operator email family rebuilt to wireframe fidelity — 2026-08-12 (`feat/operator-email-wireframe-fidelity`): new `operator-email-shell.ts`, a SECOND shell beside the untouched `auth-email-shell.ts` (the traveller/account family keeps that one). Ordered `blocks: OperatorEmailBlock[]` discriminated union instead of fixed slots, because the wireframe's stages disagree on order — OB-5's callout sits BELOW its CTA, OB-8's quiet panel ABOVE, OB-6 has neither logo nor headline. Gaps are spacer rows computed from the wireframe margins with CSS collapsing reproduced (the inline-block CTA sums instead of collapsing). FOUR footer variants as a discriminated union — verification (C,D) · transactional (A,B,C,D) · lifecycle (B,C,D,E, `optOutUrl` required by the type) · none (INT-1/INT-2 have no footer at all); `This is a transactional account email.` and the "If the button doesn't work" fallback are gone from the family. `preheader` split from `title` (all nine `.pre` lines wired). Outlook-safe translations: callout rule → 4px table cell, CTA padding → td, Loom flex/gradient → table with the 60% stop as bgcolor and a TEXT `&#9658;` (never the emoji). All 11 templates migrated (OB-2/2A/3/4/5/6/7/8 · INT-1 · INT1R · INT-2 in `tour-review.template.ts`); OB-6 folded off its hand-rolled markup onto the shell. New `operator-verify-email.template.ts` for OB-1 with the wireframe copy — the shared Better Auth `email-verification.template.ts` is untouched and the auth hook routes by `Role.TOUR_OPERATOR`. `siteLogoUrl` dropped from the family (the wireframe wordmark is text, no image-logo variant); `factRow`/`internalFactsTable`/`INTERNAL_CTA_BACKGROUND` folded into the shell. Still open: OB-2's PDF attachment (D4), OB-6's `from: "Denley from Island Tours"` (`SendMailOptions` has no `from`), INT-1's CRM row (no CRM), and OB-1's "works for 24 hours" copy vs Better Auth's unconfigured 1h `emailVerification.expiresIn`
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
- [x] Hero "Popular" quick links are ADMIN-CURATED per island (2026-08-05), `destination_popular_links` + `GET /destinations/slug/:slug/popular-links` + `PUT /destinations/:id/popular-links`, curated on the destination's Details tab. Curation rather than ranking because no order over live data reproduced the founder's four for Curaçao — Off-Road Tours is fifth by sortOrder and joint-fourth by tour count, so it fell outside a row of four however the row was sorted ("no dynamic order matters here"). Every curated link is still RE-GATED at render against its target's own visibility rule (category ≥ `CATEGORY_PAGE_MIN_TOURS`, hub published + on this island + ≥1 live tour, collection published + on this island) and dropped otherwise, which is the standing condition "these must show when these collections and categories have data to render page". No rows = the automatic row (hub → lead collection → categories) still composes, so an uncurated island is never empty. Seeded for Curaçao, once, skipping any island an admin has already curated
- [x] Category page-render gate moved from **≥1** published tour to the canonical **≥3** (master §2.4). One exported constant, `common/constants/category-visibility.ts` → `CATEGORY_PAGE_MIN_TOURS`, is read by all four gates so they cannot drift: `getActiveByDestinationSlug` (hero "Popular", "Explore by type", footer, All-Tours pills, `generateStaticParams`), `getBySlugForDestination` (the page 404), `SitemapService.getEntries`, and the homepage editorial-card gate (`categoriesWithLivePages`, renamed from `categoriesWithLiveTours` — it now counts rather than `distinct`s, which is what conflict-table row 4 meant by "must change in the same commit"). Found in production: an admin-made 1-tour "Buggy Tours" was being linked from the Curaçao hero
- [x] `ogImage` column + migration (`20260706195829_add_category_og_image`)
- [x] Guarded deactivation — refuse to deactivate a category while active non-draft tours are still assigned (409)
- [x] **Sub-categories = child categories (Pastel dashboard #77/#78, 2026-08-15):** `parentCategoryId` self-relation, ONE nesting level, filter-only — a sub-category writes NO slug-registry rows and renders no page; tours tag subs through the same `tour_categories` join and expose `sub_types[]` (keys only) on tour payloads. Server invariants on all three tour write paths (create, category-replacing update, `primaryCategoryId`-alone update): the primary category must be TOP-LEVEL, and a sub tag is rejected unless its parent is tagged on the same tour
- [x] **`pnpm subcategories:sync`** (`backend/scripts/sync-sub-categories.ts` + `prisma/data/sub-categories.config.ts`): config-driven converger for production — locks the 19 top-level categories, demotes the extras to sub-types (RETAGGING their tagged tours onto the parent before the demotion, same transaction), heals orphaned subs across the whole taxonomy, `--dry` preview, per-iteration state reload, P2002-skip, and busts the public cache tags (categories / slug-registry / tours / search) at the end. Admin demotion via the dashboard runs the same retag inside its transaction

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
- [x] `maxPartySize` NOT NULL, default 10 (migration `20260729190000_max_party_size_required`) — it is the capacity every departure falls back on, so a null meant the materializer skipped the slot and the tour never listed. Optional in `CreateTourDto` (create mints a draft from name/destination/categories and asks for capacity two steps later); required in the wizard's booking-rules step. `minPartySize > maxPartySize` is rejected on create AND update, comparing an incoming value against the stored one so a single-ended PATCH cannot invert the range.
- [x] Booking-logic fields: `bookingCutoffMinutes` (default 120), `pickupModel`, `startTimes[]`, `checkInMinutesBefore`, `durationMinutes`/`durationMinutesTo`, `instantConfirmation`, `bookingType`, `meetingPointLat/Lng`
- [x] `cancellationHours` enum-bound `[24,48,72,168]`, NOT NULL, default 48 (schema default + DTO `@IsIn` + service default)
- [x] `paymentModel` on the tour, snapshotted onto the booking at reserve
- [x] Flags & accessibility: `minAgeYears`, `fitnessLevel`, `weatherDependent`, `wheelchairAccessible`, `familyFriendly`, `suitableForBeginners`, `guideLanguages` via `TourLanguage`
- [x] `isLocalsFavourite` as an editorial-only column: excluded from `CreateTourDto`/`UpdateTourDto`, toggled only via `PATCH /tours/:id/locals-favourite` under `MANAGE_EDITORIAL`, plus `GET admin/locals-favourite/stats`
- [x] `recomputePriceFrom` re-anchored on the default age band (migration `20260716165001_reanchor_price_from_on_default_band`)
- [x] **Instant confirmation is always on (Pastel dashboard #83 / client review #22, 2026-08-16):** the "Instant confirmation" checkbox left the Booking rules step and `instantConfirmation` left both tour write DTOs (the global `forbidNonWhitelisted` pipe 400s any client still sending it) and both service write sites — every consumer surface promises instant confirmation ("Confirmed in seconds" on All Tours) and no request-to-book flow exists behind an off state (no pending-booking state machine, no emails, no seat-hold rules). Migration `20260816090000_instant_confirmation_always_on` heals any row switched off while the checkbox existed. The column stays, default true — the OCTO serializer and derived attributes read it. Dashboard: the toggle is removed (not hidden) and `tripToUpdatePayload` drops the key so no step's pass-through resends it. If request-to-book ever becomes a product goal, it re-enters ONLY with the full spec the client named
- [x] **Net price is never client-written (Pastel dashboard #81 / client review #20, 2026-08-15):** `priceNet` left both age-band write DTOs (the global `forbidNonWhitelisted` pipe 400s any client still sending it) and both service write sites — what an operator keeps is price minus their tier commission, derived, never typed. The column and its readers stay (booking participant snapshot, OCTO serializer band net, both null-tolerant; settlements never read it — commission is tier-rate based). Dashboard: the editable input became a read-only "You keep ({currency})" line under More price options — `price × (100 − tier)/100`, recomputed live as the operator types, from the owner-visible `commissionTier` on the trip detail
- [x] `recomputeLikelyToSellOut` demand signal + `POST admin/recompute-demand` (migration `20260630050545_add_tour_demand_signal`)
- [x] `recomputeQualityScores` nightly tie-breaker implementing the §7.2 formula (rating 40 / review count 25 / completeness 20 / conversion 15, normalized against in-category `max_conv`)
- [x] `attachMoney` display conversion on tours list/detail/by-id with an optional `?currency` query
- [x] Listing price filter aligned to `priceFrom` rather than `basePrice`
- [x] `resolveUniqueSlug` collision handling — own-duplicate 409, single operator-name suffix, never a numeric suffix, atomic claim with 409 on a write race
- [x] **Approval-time slug (Pastel dashboard #73 completion, 2026-08-15):** `approveTour` realigns a NEVER-published tour's slug to `generateSlug(finalName)` inside the approval transaction via `renameEntitySlug` (registry row re-pointed, 301 recorded); published tours are immune, a collision keeps the current slug with a warn, and a lost P2002 write race falls back to approving with the current slug — approval never fails over an address. The wizard's operator-editable slug field is gone; admins keep theirs
- [x] **Admin list vs review queue (Pastel dashboard #79, 2026-08-15):** `GET /tours/admin/all` excludes `PENDING`/`REJECTED` by default — the working catalogue and the review queue are separate surfaces. `approvalStatus=` targets one state, `reviewLoop=true` returns the whole loop (the Submissions queue's All view), `approvalStatus=ANY` skips the axis entirely (the command palette's jump-to-anything scope), and `sortBy=updatedAt|submittedAt` + `sortDir` give the queue FIFO fairness on `submittedAt asc`. Operator `my-tours` is untouched — operators always see all their own
- [x] **Live-tour content gate (Pastel dashboard #80 / client review #19, 2026-08-15):** operator edits to a LIVE tour's title (PATCH `name`), description content (translation upsert) and photos (image ops) are HELD in `tour_pending_changes` (one PENDING set per tour via a partial unique index; later edits merge into the open set, the platform is inbox-notified once per set) — travellers keep seeing the approved version and the tour never goes offline. Price + booking cutoff stay instant by explicit client rule; the cancellation window keeps its existing admin-only guard. The STAGED GALLERY keeps the dashboard Images tab unchanged: gated image ops mutate a staged copy of the whole gallery inside the payload and the operator's GET serves it back, while travellers/admin read the real rows. Admin surface: `GET /tours/admin/pending-changes` (FIFO on `submittedAt`), approve applies name + translations + gallery reconcile in ONE transaction (slug deliberately untouched — a live address never moves as a review side effect), reject requires an actionable note. Inbox events reuse the `TOUR_*` review events with content-change titles + per-set dedupe keys. Content-change verdicts are inbox-only (no email legs yet — revisit if operators miss them)
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
- [x] `firstPublishedAt` is actually WRITTEN — `publish()` stamps it once (never moved by a later republish; that is `publishedAt`). It was read by `isInProvisionalWindow` but written by nothing except the demo seed, so every app-published tour sat permanently inside the provisional window and was never demoted. Backfilled by `20260729210000_backfill_first_published_at`.
- [x] Spotlight request/approval: `POST /tiers/tours/:tourId/spotlight`, `GET /tiers/tours/:tourId/spotlight`, `GET /tiers/admin/spotlight`, `PATCH /tiers/admin/spotlight/:id/approve`, `PATCH /tiers/admin/spotlight/:id/reject`
- [x] Spotlight invariants: 35% commission, transactional max-3-per-destination cap, extra bar (≥10 reviews, rating ≥4.5), manual approval, separate block (never interleaved)
- [x] `runSpotlightLifecycle`: APPROVED→ACTIVE at `startsAt`, ACTIVE→EXPIRED at `endsAt`, mirroring `tour.isSponsored`
- [x] `effectiveCommissionRate(tourId, at)` spotlight overlay consumed by booking quote + reserve and snapshotted, never retroactive
- [x] `deposit_pct` tier-driven (20–30 in 2.5 steps), surfaced read-only to operators — **LD24 (founder bug fix 2026-07-25):** synced on EVERY tier write (`changeTier` + nightly demotion both write `depositPct` with the other three tier fields); drifted rows backfilled by migration `20260725141218_sync_deposit_pct_to_tier`
- [x] Eligibility flat bar third gate — the cancellation-rate gate is enforced: `operatorCancellationRate90d` computes the trailing-90-day rate with its booking sample size (operator-caused = `cancelledBy OPERATOR` only)
- [~] `ForceMajeurePardon` model still has **no admin CRUD endpoint** and is not read directly by the engine — force majeure is approximated by the `cancelledBy = ADMIN` proxy (admin cancellations never count against the operator's rate), so the pardon effect exists but a dedicated pardon record cannot be granted
- [~] Clear `isSponsored` on spotlight cancellation — the nightly lifecycle now recomputes `isSponsored` from ground truth (`active > 0`) so expiry clears it; there is still **no manual cancel/revoke action** for a live spotlight (`SpotlightStatus` has no CANCELLED value)
- [x] Denominator guard on the cancellation-rate gate — the rate is computed together with its booking sample size so thin samples do not demote
- [~] "Not billed for its tier during the unbookable period" (master §7.2) — **resolved as already-true by arithmetic for the money half, open founder call for the clocks half (2026-07-30).** Tiers are commission-only (the master defines no monthly/subscription/listing fee anywhere): an excluded tour takes no bookings, so nothing is billed and there is no meter to pause. What an unbookable tour DOES keep paying is time: `tierLockedUntil` (30-day lock) and the PROVISIONAL→GRACE→DEMOTED lifecycle run on wall-clock with zero `isBookable` awareness, so a dark tour burns lock days and its one-time 90-day provisional window while invisible. If the clause is meant to protect the operator, suspending those two clocks while `isBookable = false` is the only implementable version — needs the founder's reading before any code. Operator-facing copy deliberately avoids "tier billing is paused" (there is no charge to pause); the F13 banner says "hidden from ranked listings until a date opens"

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
- [x] **Closure REASON (2026-08-09, mck-15 §4):** a close now records WHY - `ClosureReason` = `SOLD_OUT` | `NOT_RUNNING`, on `availability_exceptions` and projected onto the `departures` row it closes (migration `20260809100000`, additive, nullable, no backfill). The stored status stays `CLOSED` for BOTH reasons deliberately: storing a sold-out close as `SOLD_OUT` would let it reopen the moment a booking was cancelled, and a manual stop-sell has to win until the operator lifts it - so the REASON is what makes the two read differently. It rides on the materialized departure rather than being re-derived from exceptions on every public read. Traveller mapping (`calendarDayReason` reads the reason AHEAD of the status, which can no longer tell the two closes apart): operator + Sold out -> "Sold out" struck through, only the operator reopens; operator + Not running -> "No departure", plain, no line; cutoff passed -> "Closed" struck (carries no reason); fills with us -> "Sold out", reopens itself. The §3.7 demand signal now counts ONLY `SOLD_OUT` closures - a Not running is weather/maintenance/a day off, the opposite of demand, and an unexplained pre-reason close cannot be read either way without inventing intent. Operator portal asks the question on a whole-day AND a single-departure close, with a way out ("Cancel, leave it open"), and every close confirms the consequence with the booked-guest count plus Undo
- [x] `AVAILABILITY_UPDATE` notification emitted on inventory change
- [x] `GET /availability/manage-calendar` operator month grid (per-day status/booked totals/exceptions + `scheduled` pattern flag) powering the dashboard's one-tap Availability calendar on the trip Schedules tab — close/reopen day, close/reopen slot, add departure, all via the existing exception mutations (2026-07-28; capacity controls removed from the day panel 2026-07-30 per the availability review's decided choice #5 — capacity is set-once, `set_capacity` stays in the model/API for support use)
- [x] **Portal availability review alignment (2026-07-30, `audits/island-tours-portal-availability-review.md` F1–F17):** close-vs-cancel copy corrected everywhere (closing keeps bookings — the popover previously claimed the opposite); `SET_CAPACITY` clamped at `bookedCount` on create AND update (was a silent materializer no-op); operator vocabulary purge (no "exception"/"materialised"/"recurring schedule"/"cap" renders; Weekly schedule / Calendar / Date changes) + "All times are local to {island}"; sold-out is a first-class visual state (info-violet, distinct from closed, self-explaining popover line); `GET /availability/summary` status line + 30-day delisting warning banner on the schedule step; calendar capped at 12 months with a shadcn date-jump that opens the picked day; exception audit trail exposed (`createdAt`+`createdByName` via a user-name join) + the Date Changes register (wired `useExceptions`); weekday tabs replaced with grouped pattern rows (weekday chips toggle the underlying rows, pause/remove fan out per rule, gap hint); consequence dialogs on tour-pause and rule pause/remove; pricing-model-aware copy (unit charters never see seat math, acceptance #9); `POST exceptions/close-range` + `reopen-range` bulk blackout with one-unit Undo (F8); `POST /availability/confirm` freshness stamp + stamp-on-visit (F14)
- [x] **Surface B — cross-tour daily agenda (F4, matrix v1.6):** `GET /availability/agenda` (all tours, chronological, live status, closure audit line, stalest `availabilityConfirmedAt`) + `POST /availability/agenda/close-day` ("Close all of today", per-tour CLOSE_DATE fan-out, returns the exact Undo set) + dashboard `/availability` nav section (freshness card, tour filter chips for multi-tour only, one-tap Close/Reopen rows linking to the tour's schedule step, thumb-first)
- [x] **Global availability calendar (2026-07-30):** `GET /availability/overview` (day-bucketed departures + closures + scoped tours + explicit island `today`; operator pinned via `operatorContext`, **ADMIN platform-wide** with `operatorId`/`tourId` narrowing - the only cross-operator availability read) + dashboard `/calendar` nav item: full-width Month/Week/Day grid (mini-calendar sidebar, Today, view persistence), departure chips with the management card (close/reopen `CLOSE_SLOT`, capacity edit via `PATCH departures/:id`, bookings + timetable deep links), click-empty add popover (one-off `ADD_SLOT` departure or weekly schedule), STOP_SELL seats see close/reopen only
- [x] **Stop-sell permission split (matrix v1.7, review §5.1):** new `STOP_SELL` enum value (migration `20260730120000`) + `@RequireAnyPermission` OR-decorator in the permissions guard; close/reopen/agenda/confirm routes accept `MANAGE_AVAILABILITY` OR `STOP_SELL`, timetable/capacity/departure routes stay `MANAGE_AVAILABILITY`; the service re-checks `ADD_SLOT`/`SET_CAPACITY` writes (`assertCanShapeInventory`) so a stop-sell-only seat can close and reopen but never shape inventory; grantable in staff designations, mirrored in the dashboard rbac + nav
- [~] A newly created schedule only materializes 90 days ahead and depends on the 3 AM cron to reach the full 12-month horizon — a sharp edge documented in the booking checklist. Mitigated for EXCEPTIONS (2026-07-28): every exception mutation also reconciles the exception's own day (`syncTourAvailability(tourId, date)`), so a beyond-horizon add/close/capacity change is visible immediately; schedules themselves still rely on the cron
- [x] All-sold-out recovery path (surfacing/recovering a tour whose every departure is sold out) — `GET /tours/:id/alternatives` + `AvailabilityService.nextBookableDateByTour` behind the widget's `availabilityDeadEnd` state (2026-07-29, AVAILABILITY-AND-DEPARTURES.md §8.1)
- [ ] `CHECK (booked_count <= capacity)` database constraint as a negative-inventory backstop
- [ ] Concurrency/load test suite firing 50/100/500 simultaneous reservations at 1-seat and N-seat departures, asserting exactly `capacity` succeed and the counter never goes negative
- [~] iCal export feed of departures for operators, and optional iCal import writing `availability_exceptions` (never mutating capacity directly) with `ical_sync_logs` — **EXPORT SHIPPED 2026-07-29**: `calendar_feeds` table + `backend/src/calendar-feeds/` + shared RFC 5545 writer `src/common/ics/ics.util.ts` (the traveller booking `.ics` now shares it). Two tokenized, rotatable, revocable feeds per operator — `BOOKINGS` (needs `VIEW_BOOKINGS`; traveller name + pax + ref, deliberately no email/phone/pickup address) and `DEPARTURES` (needs `MANAGE_AVAILABILITY`; fill counts, no traveller data). `@Public()` `GET /calendar-feeds/:token/calendar.ics` with ETag/`If-None-Match` 304 (DTSTAMP pinned to the data mtime, or the feed never caches); cancellations published as `STATUS:CANCELLED` rather than dropped; windows −30d/+364d bookings and −30d/+90d departures (a year of departures measured 6,039 events / 2.1 MB). Operator UI = dashboard Settings → Calendar sync. **IMPORT + `ical_sync_logs` still open** — design notes and the DTEND/RRULE/SSRF traps in `02-architecture/AVAILABILITY-AND-DEPARTURES.md` §9a

### Bookings

- [x] `Booking` model fully expanded to master E.8: `uuid`, `publicRef`, `displayRef` (IT-2026-XXXXX), `resellerReference`/`supplierReference`, `status`, `freesale`, `testMode`, `utcExpiresAt`/`utcConfirmedAt`/`utcRedeemedAt`, `paymentModel`, `onArrivalPayment`, `currency`, `localDate`/`startTime`, tour start/end/timezone, pickup snapshot, `exclusiveDeparture`, money + commission block, split contact fields, billing + card snapshot, `conversionFiredAt`
- [x] `BookingUnitItem` (one row per traveler, retail/net pricing, ticket fields) and `BookingAddOn` (snapshotted line items)
- [x] `POST /bookings/quote` — server-authoritative stateless quote (per-line breakdown, deposit/balance, commission, FX source + booking snapshot, 15-minute expiry), `@Public()`, routed before `:id`
- [x] `POST /bookings` reserve — single atomic guarded `UPDATE departures` (`WHERE status='open' AND booked_count + seats <= capacity`, 0 rows → fail) inside the same transaction that creates the booking, unit items and add-on snapshots. Hardened 2026-08-10 (BOOKING-CONCURRENCY-HARDENING F1–F3, PR-1): one raw-SQL `claimSeats()` helper serves reserve/recovery/restore/date-change (capacity compared as a live column — a concurrent capacity edit now loses the claim; `SOLD_OUT` flip + `soldOutAt` fused into the same statement), the claim is the LAST statement of the reserve txn (hot-row lock ≈ one statement + commit), and `releaseSeats` is an atomic `GREATEST` decrement (the read-modify-write lost decrements under a sweeper-vs-cancel race). Race-proven on real Postgres: `backend/test/booking-concurrency.e2e-spec.ts`. F4 (PR-2, same day): `dto.id` is now a full idempotency key - replay pre-check (pre-existing) + key-reuse 409 + in-flight duplicate P2002-on-PK catch (the loser answers with the winner's booking, fires no side effects, and never touches the hot row since the claim runs last); the constraint-error predicates read the pg driver adapter's nested meta (`driverAdapterError.cause.constraint` - top-level-only reads never match in production). HTTP-proven: `backend/test/booking-idempotency.e2e-spec.ts`. F5 (PR-3, same day): `departures_booked_within_capacity` CHECK constraint - the seat invariant is now a DATABASE guarantee, not app code; migration repairs any drifted rows from the bookings ledger first (3 dev fossils healed), and the constraint lives ONLY in the raw migration (Prisma DSL cannot express CHECK - a re-baseline must carry it by hand). F6 (PR-4, same day): explicit pool + timeouts replace the bare node-postgres defaults (max 10, none) - `DB_POOL_MAX` 25, connect 5s, statement 10s, idle-in-txn kill 15s, lock wait 3s; a lock-wait abort on reserve answers 503 "try again" in both adapter error shapes; e2e proves the settings reach pool connections and a held-lock reserve sheds at ~3s
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
- [x] Age-restriction validation deliberately minimal — tour minimum age only, checked when `travelerAge` is supplied (**founder decision 2026-07-25: "keep it simple as is"** — do not add band max/coverage checks)
- [~] Refund computation returns only a FULL/NONE **category**; execution now refunds the actual captured payment(s) via the PSP, but there is still no partial / pro-rata refund amount
- [x] Execute the actual PSP refund and write a `REFUND` `Payment` row on cancellation — `executeRefund()` (Stripe `refundIntent` / Mollie `createRefund`), triggered by the `booking.refund-owed` outbox event → `refund-execute` queue job when the verdict is FULL; Stripe webhook handles `refund.updated` + `refund.failed` (production webhook must subscribe to both)
- [x] Refund status unification (2026-07-26): a settled refund maps to `REFUNDED` (not SUCCEEDED) and the ORIGINAL charge row flips to `REFUNDED` at the same settle point (sync in `executeRefund`, async in `reconcileRefundRow`, reverting on late failure); `paid`/`payment_intent.succeeded` deliveries can no longer resurrect a refunded charge; `deriveRefundState`/`derivePaymentState`/analytics all count REFUNDED as money-moved; migration `20260726140000` backfilled old rows
- [ ] Reconcile a payment that succeeds after the hold expired — `confirmFromPayment` only confirms an `ON_HOLD` booking, so a late settlement must be voided/refunded rather than silently stranded
- [x] Capture attribution at reserve: `gclid`/`gbraid`/`wbraid`/`fbclid` + all `utm_*` accepted via `AttributionDto` on `ReserveBookingDto` and written onto the booking (frontend captures them into a 90-day first-party cookie, last-click-wins)
- [x] Distinct `gclid`/`gbraid`/`wbraid`/`fbclid` fields shipped in the attribution block (no generic `clickId`)
- [x] Operator non-payment / forfeit flow (guide §15): `POST :id/report-non-payment` (operator, idempotent stamp) → admin `POST :id/forfeit` (CANCELLED + `utcForfeitedAt`, refund NONE, deposit kept, settlement NOT reversed, seats released) or `POST :id/dismiss-non-payment` — all under the new ADMIN-only `MANAGE_BOOKINGS`; derived list statuses `NON_PAYMENT_REPORTED` / `FORFEITED` filterable on `GET /bookings`
- [ ] Coupon/discount engine — the untrusted client-supplied `discountAmount`/`couponCode` fields were deliberately removed; re-add only behind a server-side `Coupon` validation engine
- [ ] DB-backed `BookingQuote` model with input-hash revalidation so a quote cannot be replayed against different items
- [x] Booking-lookup login by email + reference (the B.34 account fallback) — `POST /bookings/lookup` + recovery + 24h traveler session, with the public `(login)/[locale]/bookings` door shipped
- [x] **Traveller account area on the public site** — `/{locale}/traveller`: passwordless one-time-code login (`POST /bookings/traveller/request-code` + `verify-code`, `TravelerLoginCode` HMAC rows), HISTORY-scoped session (`{ e, h: 1 }`), and history-gated reads (`traveller/bookings`, `traveller/summary`, `traveller/payments`) scoped by `contactEmail` so guest bookings are included. Stat row + Bookings/Payments tabs in frontend styling, 7 locales, cancellation requests proxied server-side so the token never reaches the browser (2026-07-28)
- [x] **Account area redesigned per `audits/island-tours-account-pages-review_1.md` v1.7 + `island-tours-account-pages-final.html` (2026-07-30)** — H1 "Your bookings" + signed-in row with masked email and visible Log out (F4/F13); stat tiles deleted, next-trip module pinned on top with Add-to-calendar via the tokenized `.ics` (F5/5.2); Upcoming / Past / Cancelled-collapsed grouping on server verdicts, `ON_HOLD`/`PENDING`/`EXPIRED` never list (F6/5.3/5.6); one expand affordance per card + quiet "Open booking page" link (F12); logistics block with meeting point or pickup, 4.4 be-ready buffer, Maps link, duration, LD4 check-in row (F7) — payload extended server-side (`listTravellerBookings` now joins tour image/slug/duration/meeting point locale-preferred + operator contact, `?locale=`); 5.5 model×state payment box (no "Paid so far", operator-named balance line with `{Day, DD Mon, HH:MM} (local time)` deadline, locked anti-fraud line only in the operator_link box, no Pay button anywhere) (F3/F9/F10); locked 6.4 model-aware refund copy on cancelled bookings driven by `refundStatus` (F2); 6.4 confirm strip "Cancel {tour}, {date}? Refund {amount}." with refund line only above zero; DIT-7 chips (white/hairline/state-dot status, green-tint-or-paper payment) (F15); weekday on every date (F16); payments ledger with brand+last4, `+` green refunds with on-its-way/refunded states plus Requested/Refunded date prefixes, per-currency subtotal chips (paid / refunded / on-its-way, from new `totals` on `traveller/payments` - never cross-currency summed), Site Bar B.V. statement note (F14/5.7); next-trip module is the final.html hero (photo left, kicker/logistics/one payment line/one cancellation line, View details expands the shared `TravellerBookingPanel`); 5.8 support rows (operator first + WhatsApp) + one NeedHelp block; US "traveler(s)" with real singular in 7 locales (F8); E.8 `display_ref` generator now `IT-{year}-XXXXX` Crockford-style with collision-safe `allocateDisplayRef` (F11 — existing bookings keep their emailed refs). The three review open items shipped same day (founder call 2026-07-30): **forfeited copy** (9b - payment box explains the kept deposit, "Message us and we'll take a look"); **receipts** (9a - `GET /bookings/traveller/payments/:id` HISTORY-gated receipt payload + printable `/{locale}/traveller/receipt/{id}` in the bare (login) chrome, "Print or save as PDF" = `window.print()`, explicitly a receipt NOT a tax invoice, Receipt links on settled ledger rows); **self-service date change** (10.4 - BUILT but **UI hidden for v1**, founder call 2026-07-30: DIRECT atomic swap inside the free window, `GET/POST typ/:publicRef/date-change(-options)` session-owned, guarded seat claim on the target + release on the old departure, time snapshots updated, prices/commission untouched, traveller + operator notice emails, per-booking 3/day cap; the endpoints, proxy, `traveller-date-change.tsx` picker and 7-locale copy all exist dormant - re-enable by rendering `<TravellerDateChange>` in `traveller-cancel-panel.tsx` where the comment marks it). Plus: TYP hides Resend-email AND Add-to-calendar while a cancellation request is pending (the resend used to re-send "You're booked!" mid-request - user-reported bug), and `resendConfirmation` 409s that state server-side. Demo seed emits E.8-format refs (deterministic per id) and `cleanDemo` treats hand-made tours under `@demo` operators as demo data
- [x] Retire the dashboard `/account` customer door (2026-07-28) — deleted `app/(login)/account/*`, `components/login/account-*`, `components/customer/*`, `customer-route-guard`, `customerNav`, and the `Role.USER` branches of the shared bookings/payments views; `Role.USER` is now an empty grant in the dashboard `rbac.ts`, and the wrong-door notice points travellers at the public account area. Backend: the set-password welcome email is **no longer sent** (the link pointed at the deleted `/account/reset`, and travellers are passwordless) and `getAccountUrl()` is gone. Operator Customers CRM and the admin cancellation-requests queue kept
- [ ] Decide whether the booking confirmation email should mention the traveller account area — nothing currently tells a first-time booker it exists (email copy follows the wireframe, so this needs founder sign-off)
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
- [x] **Mollie fully integrated.** `mollie.service.ts` wraps `@mollie/api-client` (`createPayment`, `getPayment` with embedded refunds, `createRefund`); `handleMollieWebhook` re-fetches the payment and `applyMolliePayment` maps status → updates the `Payment` row → `confirmFromPayment` on `paid`, with refund rows reconciled from the embedded refunds. Admin-switchable PSP: webhooks/refunds route by the Payment ROW's provider
- [x] Mollie SDK dependency + `mollie.service.ts` mirroring `stripe.service.ts`
- [x] **ChargeFx reconciliation (5C, 2026-07-25):** the PSP's actual charge→EUR rate re-anchors the booking's EUR figures at confirmation — Stripe via `balance_transaction.exchange_rate` (expanded on charge/intent retrieval), Mollie via `settlementAmount/amount`; commission RATE stays the reserve snapshot, EUR-charged bookings never reconcile, fallback is the ECB snapshot path; audited via `eurFxProvider`/`eurFxProviderAsOf`
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
- [~] **Real providers built, but the default binding is still `static`.** `StaticFxProvider`, `EcbFxProvider` and `CompositeFxProvider` all exist under `src/fx/providers/`; `FX_PROVIDER` unset/`static` → Static — production must set `FX_PROVIDER=ecb` to run on live rates
- [x] Implement a real `FxProvider` — `EcbFxProvider` (ECB reference rates) wrapped in `CompositeFxProvider` fallback, with dedicated specs (`ecb-fx.provider.spec.ts`, `composite-fx.provider.spec.ts`); complemented at payment time by the ChargeFx reconciliation so charged bookings carry the PSP's actual rate
- [x] `FX_PROVIDER` now genuinely selects the provider binding in `fx.module.ts`
- [x] Wire locale→display-currency defaults (EN/ZH → USD, others → EUR) — `LOCALE_CURRENCY` had `en: 'EUR'`; corrected 2026-07-21 in both the frontend and dashboard copies

### Settlement & payouts

- [x] `Settlement` model + `SettlementStatus` enum (`RECORDED | PAID_OUT | PAID_IN_FULL | INVOICED | REVERSED`) with `bookingId` unique (`prisma/bookings.prisma`), served by `src/settlements/` (`GET /settlements` incl. booking-ref search + operator filter, `GET /settlements/summary`, operator-scoped)
- [x] Ledger records **paid_in_full bookings only** (founder 2026-07-26): the one model where Island Tours holds money it owes the operator; self-settling deposit models and `operator_full` write NO row (`writeSettlement` no-ops; migration `20260726120000` purged the old noise rows). Written at confirmation via `settlement.upsert` keyed on `bookingId` (`update: {}` — never overwrites)
- [x] `netPosition` = the payout owed the operator (collected − commission); zeroed on REVERSED
- [x] **Manual payout** (founder 2026-07-26): `PATCH /settlements/:id/mark-paid` (+ `/mark-unpaid` undo), `MANAGE_BOOKINGS`-gated — PAID_OUT only ever means an admin confirmed the bank transfer. Guarded stepwise 409s (already paid / reversed / booking cancelled / cancellation pending / clawback window still open); the old hourly auto-release cron flip is **removed** and migration `20260726120000` reverted its cron-flipped PAID_OUT rows to RECORDED
- [x] Clawback safety kept as *eligibility*: `payoutEligible`/`payoutHeld`/`payoutReleaseAt` computed server-side (free-cancellation window close, same formula as the refund path); mark-paid is only allowed on an eligible row
- [x] Deposit self-settling invariant held by LD24 (`deposit_pct == commission` synced on every tier write); stale settlements on cancelled bookings reversed by a self-heal cron (`reverseStaleCancelledSettlements`, hourly `settlement-reverse-sweep`, forfeited bookings excluded — their settlement stands)
- [x] Demo seed writes consistent ledger rows (`prisma/demo/settlements.ts`, runs LAST): paid_in_full bookings only, RECORDED/PAID_OUT/REVERSED mix, self-heals commission-less depth bookings (rule #22) first
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
- [x] `ReviewTranslation` fully wired (LD32): rows created at submit, machine translation via a BullMQ `review-translation` queue + processor (`review-translation.service.ts`), locale-filtered reads — **provider swapped to the shared Gemini `TRANSLATION_PROVIDER` (2026-07-27)**; queue/sourceHash/endpoint unchanged, Google Translate client deleted (settings columns deprecated storage)
- [x] Explicit `reviewer_type` enum (`ReviewerType` on the model) feeding the traveller-type depth filter
- [x] Review collection loop (2026-07-22..25): token-scoped review invitations (`GET/POST/PATCH /reviews/invitations/:token` + `:token/photos` photo upload), post-tour review-request cron (hourly, `ReviewRequestsService`) with an admin-configurable cadence, and a review-request email with a reminder variant (`sendReviewRequestEmail`)
- [x] Review depth filters (traveller type, language/translations, with-photos) + `GET /reviews/summary` analytics rollups (guest-type / language)
- [ ] Spec file for `platform-reviews.service.ts`

### Wishlist

- [x] Wishlist module: `GET resolve`, `GET /`, `GET ids`, `POST :tourId`, `DELETE :tourId` with `list`/`resolveByIds`/`listIds`/`add`/`remove`
- [x] Session/auth-aware wishlist ownership
- [x] `POST /wishlist/email` (public, throttled) - mails a saved list back to its owner with a `?restore=` link. Ids that are no longer bookable are left out; none surviving is a 400 rather than an empty email (mck-17)
- [x] `resolveByIds`/`list` return unsellable saved tours as `isBookable: false` cards instead of dropping them, carrying only id, title, photo and where to find something similar
- [x] `dropSponsoredBadge` on both saved-list readers - runs AFTER `applyMostPopularCap`, which can otherwise reintroduce the badge as a cap fallback
- [x] `POST /availability/check-batch` (public) - bookability of up to 100 tours on ONE date for a given party, same `liveDepartureStatus` + `isDepartureBookable` rules as the calendar and reserve, one query for the whole list
- [ ] Spec file for `wishlist.service.ts` (no test coverage at all)

### Home page CMS

- [x] `HomePage` singleton model (`id @default("default")`) with `heroImage`, `editorialImages[]`, `editorialDestinationId`, `ogImage`, plus `HomePageTranslation` (migrations `20260720131212_home_page_content`, `20260720151119_faq_page_type_homepage`)
- [x] Endpoints: `GET /home-page/public`, `GET /home-page`, `PATCH /home-page`, `GET/PATCH translations/:locale`
- [x] Homepage FAQ groups: `GET/POST :entityId/faqs/groups`, `PATCH/DELETE :entityId/faqs/groups/:groupId`, `PUT :entityId/faqs/groups/:groupId/translations/:locale`
- [x] Homepage editor verified against the rendered public page — the public homepage is CMS-wired (`getHomePageContent` + `getFeaturedExperiences` consumed) and the bundled copy + FAQ were published to the CMS in all 7 locales

### Pages / CMS

- [x] `Page` model + module (2026-07-26): `pages.prisma` (`Page`/`PageTranslation`/`PageRedirect` + `PageStatus`), `src/pages/` full CRUD + publish lifecycle + `{fields}` translations under `MANAGE_EDITORIAL`, public `GET /pages/public/:slug` with English fallback + redirect resolution
- [x] Rich-text storage + sanitization contract: bodies are sanitized HTML, sanitized on EVERY write via `common/utils/page-html.util.ts` (`sanitize-html` pinned 2.16.0; allowlist = the legal prose vocabulary; https/mailto only)
- [x] Routing: NOT the slug registry (destination-namespaced by design) — pages are global `@unique` slugs resolved by the frontend fall-through in `[locale]/[destination]/page.tsx` (destination → published Page → redirect → 404), with bidirectional page↔destination slug guards + `RESERVED_PAGE_SLUGS`
- [x] Both product decisions resolved by the user (2026-07-26): fall-through routing keeping the live URLs; adapted TipTap v3 port (scoped SCSS, tables built, dashboard shadcn toolbar). Details: `technical-doc/content/HOMEPAGE-AND-PAGES.md` Phase 5

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
- [x] **Email programme send spine (WP-A, 2026-08-11, `feat/email-send-spine`)** — the foundation the seven-package email programme (technical-doc/emails/EMAIL-IMPLEMENTATION-PLAN.md §2/§4) builds on, capability-only (no existing email's behaviour changed): `email_sends` send log with `@@unique([templateKey, scopeId])` claim-first send-once semantics (`EmailLogService.claimAndSend`, P2002 read from the nested adapter meta = "already sent"), `email_opt_outs`/`email_consents`/`email_unsubscribe_tokens` + 4 enums (18-key `EmailTemplateKey`) in new `prisma/emails.prisma` (CREATE-only migration `20260811090000`, hand-written — a generated diff would rebuild the two known-drift enums); `@Public()` throttled `GET/POST /email/unsubscribe/:token` (masked email, per-stream idempotent opt-out, no-oracle 404s); `GET /operators/:id/emails` + `GET /bookings/:id/emails` timeline reads; `SendMailOptions` widened with `replyTo`/`headers`/`attachments` (default reply-to from `MAIL_REPLY_TO`); `send-window.util.ts` Tue–Thu 09:00–11:00 America/Curacao on `localNow()`; `PlatformJobData` → name-discriminated union + `PLATFORM_JOBS.ONBOARDING_EMAIL` + `email.lifecycle-sweep` scheduler (15 min, no-op until WP-D — boot now registers 5 schedulers); env `SALES_EMAIL`/`MAIL_REPLY_TO`/`OB6_REPLY_TO`/`CALENDAR_SYNC_AVAILABLE`/`WALKTHROUGH_VIDEO_URL` + the previously unvalidated `ADMIN_EMAIL`; demo seeder `prisma/demo/emails.ts`. Specs: `email-log.service.spec.ts` (claim-first, race → exactly one send, both P2002 shapes), `send-window.util.spec.ts` (fixed UTC-4 asserted), `test/email-preferences.e2e-spec.ts`
- [x] **Email programme customer funnel (WP-B, 2026-08-11, `feat/email-customer-funnel`)** — the four traveller emails brought up to the funnel wireframe (checklist B-01…B-27): **BK-2** pre-tour reminder built end to end (locked template + `buildReminderEmailContext()` + `runPreTourReminderJob()` filled - claim-first `BK2/bookingId`, `utcReminderSentAt` stamped on sent/skipped, throw-for-BullMQ on transport failure, SUPPRESSED row when no contact email; hard negative rules asserted by spec: no payment link, no cancel CTA, balance note operator_link-only and hidden at zero, weather block gated, today variant); **BK-3/BK-3R** routed through `claimAndSend(BK3/BK3R, bookingId)` keeping `sentAt`/`remindedAt` as the sweeper's cursor (remind-even-on-failure preserved), BK-3R gets DISTINCT draft copy (founder decision D1 pending - full draft in the PR body) with WhatsApp mention where opted in; **BK-1** logged through `claimAndSend(BK1, bookingId)` with `#resend-{n}` scopes for the TYP resend and the restore counter-notice, subject (incl. today/tomorrow <24h variants) resolved from a 7-locale copy module, C2 anti-fraud placement pinned per payment model by spec; **CX-1** traveller paragraphs now a paymentModel × CancellationRefund matrix per master 6.4 locked copy (operator_full never claims a refund from us; operator notice stays English), logged as `CX1/bookingId`. Four `*.copy.ts` modules (en canonical, machine-first de/fr/es/nl/pt/zh). Specs: reminder template render spec (style parity vs the funnel wireframe cut before the cross-sell rail), builder/negative-rule specs, BK-2 job matrix, CX-1 copy matrix, review-request log routing
- [x] **Public unsubscribe page (WP-F, 2026-08-11, `feat/unsubscribe-page`)** — the frontend half of WP-A's opt-out contract (plan §4 WP-F, checklist F-01…F-14; WP-G may not merge until this is live in prod). Route `app/(frontend)/[locale]/unsubscribe/[token]/` on the review-page idiom: noindex, `isLocale` guard, placeholder `generateStaticParams` (`sample`), `await connection()` + Suspense with a shared card skeleton (`loading.tsx` identical). Token loader `lib/api/public/unsubscribe.ts` is deliberately NEVER `'use cache'` (`no-store`, token through `seg()`, null on 400/404/unreachable — 400 and 404 collapse into ONE shared "link no longer valid" state, no oracle); the opt-out write is the client card's explicit POST (`lib/api/unsubscribe-submit.ts`, review-submit lane) because link scanners follow GETs. Card states: stream-specific ask (LIFECYCLE = operator setup emails / MARKETING = traveller offers) with the masked address, already-opted-out, success with the "booking emails always arrive" line, error → same-button retry; `data-hydrated` marker for the streamed-DOM e2e trap (the `#tour-reviews` precedent). `proxy.ts` rewrite #3: bare `/unsubscribe/{token}` (the form emails link) is URL-preservingly REWRITTEN to the default-locale branch — never redirected, one-click-unsubscribe scanners refuse 3xx. 7-locale `unsubscribe` dictionary key (en canonical, machine-first) + `DICTIONARY_VERSION` bump. Tests: Vitest (loader shape/null matrix + seg encoding, card states, proxy rewrite branch + matcher) and `e2e/tests/unsubscribe.spec.ts` (invalid + malformed token, bare-URL rewrite-not-redirect, seeded-token happy path resolve → confirm → success → already-opted-out on reload, gated on `E2E_UNSUBSCRIBE_TOKEN`)
- [x] **Marketing consent + MK-1 "Next adventure" (WP-G, 2026-08-11, `feat/email-mk1-marketing`)** — the LAST email-programme package (plan §4 WP-G, checklist G-01…G-17; G-18 open pending review/merge + prod unsubscribe verification). **Consent (G-01…G-03):** reserve carries `newsletterOptIn` but no contact, so `captureNewsletterConsent()` fires wherever a contact email LANDS on an opted-in booking (`update()` checkout lane + `confirm()` OCTO lane) — fire-and-forget upsert on the `[email]` unique with keep-first provenance (`source 'checkout-newsletter-opt-in'` + bookingId), never blocking the booking write; data-only migration `20260811180000_mk1_consent_backfill` lifts historical opt-ins (lowercased/trimmed, oldest booking wins, `ON CONFLICT DO NOTHING`, proven twice-run-stable in `test/consent-backfill.e2e-spec.ts`). **MK-1 (G-04…G-14):** locked `next-adventure-email.template.html` from the funnel wireframe `tpl-next` (3 fixed card slots — the renderer’s loop tag is single-string, the BK-1 relatedTour precedent; free-reschedule chip as the new `icon-reschedule-green` Cloudinary asset; wireframe-exact Shanice sign-off; marketing footer whose Unsubscribe AND Get-fewer-emails both hit the WP-F token page) + 7-locale copy module with subject B kept unused for the future A/B; `NextAdventureEmailsService` joins the 15-min lifecycle sweep on its OWN window (`isMarketingMorningWindowOpen`: 09:00–11:00 Curaçao ANY day — the 72h trigger must not slide across Tue–Thu), D-25 anti-join candidates on `(MK1, bookingId)` with a 14-day horizon, dueness = `tour_end + 72h` in the booking’s snapshotted zone (BK-3 idiom), G-11 gate = `EmailConsent` for the lowercased contact email AND no TRAVELLER/MARKETING opt-out (empty consent table ⇒ zero sends, asserted — the launch switch is the data), reasoned SUPPRESSED rows (`cancelled`/`cancellation-pending`/`low-star-review`/`booked-again`/`no-consent`/`opted-out`/`insufficient-open-tours`; no-show wired 2026-08-19 to the admin-confirmed `utcNoShowConfirmedAt` stamp from PRD phase 3f; complained still has no platform signal — documented skip), availability-first cards: LIVE destination tours with an OPEN departure inside 7 island-local days, canonical order, pure `selectNextAdventureTours` contrast/adjacent/flagship with role fallback, <3 → suppressed not padded; `claimAndSend(MK1, bookingId, MARKETING)` inside an equivalent capped+paced loop (200/tick · 500ms); one-click `List-Unsubscribe(-Post)` headers from env bases + server-minted tokens only. Specs: selection, suppression matrix + gate + window, render spec with banned-vocabulary assertions (no price cuts / timers / remaining-seat claims, comments included, all 7 locales scanned), consent capture, backfill e2e
- [x] **Dashboard email centre API (WP-H backend, 2026-08-11, `feat/email-settings-api`)** — the switchboard the founder asked for after Wave 3 (plan §4 WP-H, checklist H-01…H-09; the dashboard half `feat/email-centre-dashboard` builds on this): `EmailSettings` singleton in `prisma/settings.prisma` (every field nullable — null = env/built-in fallback, zero-risk rollout; migration `20260811230000` adds the table + the D-29 `[status, createdAt]` index on `email_sends`); `EmailSettingsService.resolve()` (stored ?? env ?? built-in, ~60s cache, dropped on PATCH) now feeds EVERY consumer: the onboarding sweep's offsets/window/INT1R business days (resolved per tick), the OB-7 calendar flag, the OB-8 partner-offer flag (D6), OB-6 reply-to, `sendMail`'s default reply-to, the INT-1/INT-2 sales recipient, MK-1's enabled flag + delay + morning hours; `onboardingEnabled=false` / `marketingEnabled=false` skip the candidate queries entirely (not-yet semantics, no unique slots burned). Endpoints (all `MANAGE_SYSTEM`): `GET/PATCH /email/settings` returning `{ effective, stored, defaults }` with the ReviewRequestSettings slice riding the same payload (written to THAT table), tri-state PATCH (absent/null/value) with bounds + merged start<end validation and NO booking-email switch (BK-1/BK-2/CX-1 contractual — the field does not exist, `forbidNonWhitelisted` 400s it); `GET /email/sends` (global paginated activity, filters templateKey/status/stream/toEmail/date-range, TIMELINE_SELECT); `GET /email/opt-outs` + `GET /email/consents` (email prefix search); `POST /email/test-send {templateKey}` rendering any of the 18 templates with fixed sample data to the calling admin's own address, logged `test:<userId>#<n>` (prefix documented in emails.prisma; can never match a sweep's UUID scope — asserted in spec). Specs: resolution matrix + cache, PATCH bounds/window/passthrough, list filter mapping, 18-key test-send render coverage, sweep-under-settings behaviour, `test/email-centre.e2e-spec.ts` (roundtrip, 403 non-admin, review passthrough, test-send logging)
- [x] **Dashboard settings reorg (founder request 2026-08-12, dashboard `email-settings-into-settings`, checklist H-20…H-23)** — the email switchboard is no longer a page of its own: it lives in **Settings → Email**, split into four sub-tabs (Email Groups / Addresses / Schedules / Send Window) that share one draft, one dirty-diff and one Save; `/email/settings` 307s to `/settings?tab=email` and the component moved to `components/settings/` (the D3 lint zone forbids `components/settings/` reaching into another module). The top-level Settings → Reviews tab is dissolved: the Trustpilot/Google hookup became an **Integration → Reviews** sub-tab (it is an API key + business id, like every other third-party hookup) and `ReviewRequestsForm` — still the single writer of `ReviewRequestSettings`, reminder switch and batch size included — renders as its own card under **Email → Schedules**, outside the settings `<form>` (nested forms never submit). `?tab=reviews` aliases to `integration`. The sidebar's Email group is Activity only; `/email/people` stays live, MANAGE_SYSTEM-gated and deliberately unlinked. Task IDs (MK-1, OB-3…OB-8, INT1R, BK-3) are gone from every user-visible label — the emails are named in words
- [x] **BK-3/BK-3R review request rebuilt to the wireframe (founder request 2026-08-12, `feat/bk3-review-request-template`)** — the post-tour review email left the shared four-block `booking-notice.template.html` (still the shell for ~13 other sends, untouched) for its own locked `review-request-email.template.html`, the funnel wireframe's `tpl-review` block for block: brand bar, hero band, greeting, 96px booking card, one-paragraph ask naming the operator in bold, five-star row, worded CTA + UCPD Art 7(6) disclosure, sign-off, transactional footer with **no unsubscribe**. Pure `buildReviewRequestEmailContext()` + `buildReviewRequestEmailText()` (the MK-1 structure); `review-request-email.copy.ts` re-cut from paragraph arrays into per-block strings across all 7 locales (machine-first, D5) with new `preview`, `heroSubline`, `tapAStar`, the two disclosure lines and the footer provenance line; BK-3R's founder-approved draft kept VERBATIM and mapped onto the same nine blocks. Founder decisions honoured: the five stars link plainly to `{reviewUrl}` (no `?rating=`, no frontend change), and the wireframe's `position:absolute` hero overlay ships as an image + dark band instead (Outlook ignores absolute positioning, Gmail strips `position`). **Production bug fixed:** `dateLong` was `localDate.toISOString().slice(0, 10)` in BOTH senders, emailing `2026-05-22` to every locale — the raw `Date` now reaches the builder and goes through the family's `formatDateLong`. Senders additionally select the tour hero image and the party line. Specs: nine blocks present and in order, wireframe style parity, five stars → `reviewUrl`, no unsubscribe, hero dropped when the tour has no image, long-form date, all 7 locales placeholder-free
- [x] **BK-2 cross-sell rail + CX-1 own template (founder request 2026-08-12, `feat/bk2-crosssell-cx1-template`)** — the two traveller emails brought the rest of the way to the funnel wireframe. **BK-2**: the deferred "Islanders also love…" rail is built (two cards, MK-1's listing rules — LIVE + `isActive` + `isBookable`, sponsored-first canonical order — over tours with an OPEN departure inside the island's next 7 days, so the wireframe's green "Open departures this week" line is true by construction). It is MARKETING inventory inside a TRANSACTIONAL send, so `EmailLogService.isOptedOut(TRAVELLER, MARKETING)` gates the cards and nothing is minted when they are withheld; fewer than two qualifying tours also yields no rail. The wireframe's marketing-aware footer replaces the transactional sign-off, its unsubscribe href built ONLY by `EmailPreferencesService.unsubscribeWiring` (never hand-assembled), and the picks line hides with the rail so the promise it makes is never made without the link that honours it. The balance amount got its `<b>` back: `balanceNote` split into `balanceNotePrefix` / `{balanceAmount}` / `balanceNoteSuffix` across all 7 locales (each at its own natural position), because `email-template.renderer.ts` HTML-escapes every placeholder and markup inside a copy string can never render. The reminder template spec no longer cuts the wireframe before the rail — that deviation note is retired. **CX-1**: its own locked `cancellation-email.template.html` + pure `buildCancellationEmailContext()` (the shared `booking-notice.template.html` is untouched — ~13 other sends depend on its generic shape). Matches the mock: no green check chip, one 13.5px sub-line, the "Plans change. No problem." lead, the titled "Your refund" panel, NO CTA, no `processed`/`closing` paragraph, and a real preheader instead of the subject repeated. The paymentModel × `CancellationRefund` matrix moved out of `BookingsService` into the builder, where all four models are unit-testable; `processed`/`closing`/`cta` are retained in the copy module, deliberately unrendered. New 7-locale keys in both modules
- [ ] **Operator balance email on `operator_link`** — the master's mandatory second email that names the operator and carries the secure balance link. No template exists (**founder-gated 2026-07-25: deliberately not built — do not resurrect without a founder decision**)
- [x] Pre-tour reminder email 24h before start (WP-B) — the delayed job's consumer is live: locked template `pre-tour-reminder-email.template.html` (funnel wireframe tpl-remind, 7-locale copy module), sent through `claimAndSend(BK2, bookingId)` and stamped on `utcReminderSentAt`; bookings created inside the 24h window still get no reminder (BK-1's today/tomorrow subject carries it)
- [ ] Postmark fallback provider behind the Resend primary
- [ ] Verify in template copy that the operator is never named or spotlighted pre-payment and is deliberately named post-booking on `operator_link`
- [ ] Dead-letter handling for notification deliveries after N failed attempts

### Tracking

- [x] `tracking.service.ts` — Meta Conversions API with SHA-256 advanced matching (email, phone, first/last name, city, postal code, country), `eventId` = booking `publicRef` shared with the browser Pixel for dedup
- [x] Conversion value is `commission_amount` in EUR, never GMV; a confirmed booking with a null `commission_amount` is treated as data corruption and fires nothing
- [x] Mark-first idempotency: `conversionFiredAt` stamped server-side in `finalizeConfirmation` before the conversion payload is exposed (DB guard, never `localStorage`)
- [x] Config-gated no-op with a single warn log when `META_PIXEL_ID` / `META_CAPI_TOKEN` are unset; the service never throws
- [x] TYP conversion object gated on CONFIRMED + non-null EUR commission
- [x] Server-side SHA-256 PII hashing in one pass (`pii-hash.util.ts`): email, E.164 phone, split names, city/postal/country — `toGoogleUserData` (Enhanced Conversions `sha256_*`) and `toMetaUserData` (em/ph) from the same hashes
- [x] Capture click ids + UTM at booking creation (attribution block written at reserve) so cancellation/refund adjustments and offline conversions can be posted back to Google Ads and Meta
- [x] CI type-check of the `booking_complete` payload contract so a missing required field is a build error rather than a runtime fallback (2026-08-17: `BookingCompleteEvent` typed contract in `lib/tracking/booking-complete.ts` — the push is composed against it, `tsc` runs in CI)
- [x] Hash the customer email into a `customer_id` for the GA4 `user_id` cross-device field (2026-08-17: `userId` on the conversion payload = the same lowercased-email SHA-256 the Enhanced Conversions envelope carries, derived in `buildConversionPayload` — the `Booking.customerId` column stays unpopulated/reserved)
- [x] Cancellation/refund conversion adjustments posted to the Google Ads and Meta APIs — **DONE 2026-08-17**. `cancel()` commits a `booking.cancelled` outbox event when `conversionFiredAt` is set; the relay fans it out to (a) `tracking.meta-refund` → CAPI `Refund` (`event_id = <publicRef>:refund`, `action_source: system_generated`, verdict in `custom_data.cancellation_refund`) and (b) `tracking.ads-adjustment`, **delayed 24h** so Google has ingested the `order_id` conversion → `ConversionAdjustmentUploadService` RETRACTION keyed on `orderId = publicRef`. Money rule: retract only when the commission is actually lost (FULL, and conservatively PARTIAL) — a NONE-refund cancellation keeps the deposit (= the commission, LD24) so the reported value stands. Every send attempt audited in `conversion_events`. Ads credentials are dashboard-managed (encrypted) with `GOOGLE_ADS_*` env fallback; the service is a warn-once no-op until they exist, so this ships before the developer token is approved

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
- [x] `payoutDueEur` now reads the settlements LEDGER verbatim (2026-07-25, founder: "analytics and settlements didn't match"): `settlement.aggregate` on RECORDED + PAID_IN_FULL + `netPosition > 0`, operator-scoped, un-windowed — the exact predicate of `SettlementsService.summary`, so the Overview card and the Settlements page always agree; `earnedEur`/`commissionEur` intentionally keep recognition-on-completion (REDEEMED)
- [x] Recent activity extended with cancellations + refunds (2026-07-26): latest 5 CANCELLED bookings by `utcCancelledAt` (who cancelled + refund verdict) and latest 5 REFUND payment rows whatever their outcome (a stuck PROCESSING/FAILED refund is visible), both role-scoped by the same `bookingWhere`
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
- [x] Nightly jobs on the BullMQ scheduler the queues doc specifies — RESOLVED 2026-08-10 (hardening F8, PR-6): all four sweeps are job schedulers with fixed ids (single-runner across replicas, verified with two live processes), failures land in the retained failed set (visibility), attempts=1 by design (the schedule is the retry). Deliberate trade documented in `platform-queue.ts`: sweeps now share Redis's fate at runtime, with automatic catch-up when it returns
- [~] Fix the stale docblock TODO at `workers/nightly-jobs.service.ts:22` claiming quality-score and eligibility are "when built" — both are already invoked inside `run()`; the comment is wrong, not the code (docs claim: BOOKING-CHECKLIST §13 repeats the same stale claim that "quality-score + tier eligibility/grace/demotion are TODOs")
- [x] Hold-expiry sweeper scheduled — `expireStaleHolds()` releases seats from expired unpaid holds every minute. Since 2026-08-10 (hardening F8, PR-6) it is a BullMQ job scheduler (`booking.hold-expiry-sweep`, fixed id) instead of an in-process `@Cron`: N app replicas upsert ONE schedule, exactly one worker runs each tick - no double-run when a second process appears (settlement/review/nightly-commercial sweeps moved with it; verified with two live processes)
- [x] Transactional outbox (B6, 2026-07-25): `OutboxEvent` model written inside the causing transaction (`booking.confirmed` atomic with the `conversionFiredAt` guard; `booking.refund-owed` in the cancel tx) + `OutboxRelayService` (`@Interval` 5s, overlap-guarded, batch 50, enqueue-then-stamp) publishing to the `platform-jobs` BullMQ queue
- [x] Confirmation email on a queued job with attempts + exponential backoff — **founder-amended hybrid**: confirm-time emails also send INLINE, and the queued jobs are the durable retry backstop; shared guard columns (`utcConfirmationEmailSentAt` etc.) make the two compose without double-sends
- [x] CAPI conversion on a queued idempotent job (`tracking.capi-conversion`; Meta dedups by `event_id = publicRef`; null commission throws `UnrecoverableError`)
- [x] `paid_in_full` payout after the cancellation window — the window close is computed as server-side *eligibility* (`payoutEligible`); the payout itself is a MANUAL admin mark-paid action (founder 2026-07-26 — the old hourly auto-release cron is removed; only the hourly reverse self-heal sweep remains)
- [~] Delayed `booking.pre-tour-reminder` job — enqueued with the computed delay and state re-checked in the consumer, but the consumer is a stub (template pending a founder decision)
- [ ] Delayed `affiliate.postback` job (on-hold at booking, approved after the window)
- [x] Deterministic `jobId` dedup (`{bookingId}:{jobName}`) layered on top of the DB guard columns
- [~] Failed jobs retained (`removeOnFail: 5000`) — but no Bull Board / admin view yet, so a stuck job is only visible in Redis
- [ ] Redis lock (or single-scheduler instance) so cron jobs cannot double-run under horizontal scaling
- [~] Workers specs: `outbox-relay.service.spec.ts` + `platform-jobs.processor.spec.ts` shipped; `nightly-jobs.service.ts` and `public-cache.service.ts` remain untested

### Webhooks

- [x] Stripe webhook endpoint bypassing AuthGuard and ThrottlerGuard (`@Public()` + `@SkipThrottle()`), verifying signatures against a raw body and deduplicating via `stripe_webhook_events`
- [x] `mollie_webhook_events` idempotency ledger table
- [x] Outbound OCTO notification webhooks with HMAC signing, BullMQ delivery and a `notification_deliveries` audit trail
- [x] The Mollie inbound webhook is registered, idempotent and fully reconciles (payment re-fetch → status map → Payment row → `confirmFromPayment`; see Payments)
- [ ] Retry/backoff + dead-letter policy for outbound notification deliveries
- [ ] Remove the dead `Webhooks` / `WebhookPoint` models that no webhook path uses

### Test coverage

Current state (2026-07-25): **76 unit spec files in `src/` · ~1,617 tests green · 5 e2e suites in `test/`**
(`app`, `auth`, `reviews`, `settings`, `tours` `.e2e-spec.ts`).
New since the prior audit: settlements, sitemap, instagram, review-requests, review-translation, review DTO,
pii-hash, refund-state, booking-display-status, ecb-fx + composite-fx providers, outbox-relay, platform-jobs
processor, customer-provisioning, booking-pricing util.

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
- [~] Concurrency/overbooking suite (50/100/500 simultaneous reserves) — the make-or-break test for the atomic seat claim. Partly landed 2026-08-10: `booking-concurrency.e2e-spec.ts` races claim/release on real Postgres at the transaction level (last-seat race ×25, release race ×50, capacity-shrink, exclusive, restore). The full HTTP-level 100/500/1000-VU rush with SQL postconditions is hardening F7 (`scripts/loadtest/`, planned)
- [ ] Load test of the availability + reserve endpoints (p95 latency, error rate under burst)
- [x] Refresh `auth.e2e-spec.ts` (2026-07-27): sign-up tests now pin the disabled-endpoint rejection semantics, all other describes provision via the Better Auth internal adapter, and new suites cover login-surface enforcement + the login-precheck endpoint — 40/40 green

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

**Done: 288 · Ongoing: 18 · Pending: 75** (381 tracked backend tasks; recounted from the markers 2026-07-26).

The transactional core is complete end to end: bookings, availability, tiers/eligibility (incl. the
cancellation-rate gate), Stripe **and Mollie**, refund execution, the settlements ledger (paid_in_full
payouts, manual admin mark-paid), the transactional outbox + `platform-jobs` retry queue, the review module (collection →
moderation → translation → analytics), FX with real ECB/composite providers + ChargeFx reconciliation,
attribution capture and server-side PII hashing. The severe risks called out in the prior audit are all
closed except one: **the FX binding still defaults to `static` — production must set `FX_PROVIDER=ecb`.**
The remaining blocks are v2 money rails (Stripe Connect / operator_full), the OCTO booking surface, the
Pages/CMS module, observability (Sentry/backups/deep health), and founder-gated email templates
(pre-tour reminder, operator balance email, invoice attachment).

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
- [x] Container width reconciliation: master locks **1200px** and a **3-column** desktop listing grid `(docs claim: §3.2 1200px / 3-col)`. Settled Aug 18 2026 against Figma 47361:19647 — `TOUR_CARD_GRID` (`lib/tours/listing.ts`) dropped `lg:grid-cols-4` and now carries the mockup's 24px column / 40px row gaps at `lg`. The 1440px `--it-container-max` stays: with 120px desktop padding the *content box* is exactly 1200px (3 × 384 + 2 × 24), which is the number the master actually locks. Mobile/tablet unchanged (1 col, then 3 from `sm`)
- [ ] Typographic separator system enforced platform-wide (Tier 1 middot · Tier 2 comma · Tier 3 `›`; pipe retired) — no shared separator helper exists

## Layout / nav / footer

- [x] Root layout with fully dynamic `generateMetadata()` reading `getPublicSiteInfo()` + `getPublicSiteSeo()` (dashboard-managed title/desc/keywords/robots/canonical/favicon/OG/Twitter)
- [x] `(frontend)` layout `.frontend-root` wrapper
- [x] `[locale]` layout with `generateStaticParams` over all 7 locales + parallel dictionary/destinations/site-info fetch
- [x] Sticky navbar with destination-context state (logo, island selector, Categories dropdown, search, language switcher, wishlist, account)
- [x] Island/destination selector with localStorage persistence
- [x] Categories dropdown fed by live category data — plus the island's hub rows (mck-19, decided Aug 9 2026; place dressing REVERTED per client, Aug 13 2026): qualifying hubs (≥3 bookable tours, the same shape of gate §2.4 applies to categories) sit above the categories, then a rule, then the categories exactly as they were. The hub rows render IDENTICALLY to the category rows — photo, name, "N tours" — no pin, no tint, no tagline (the mck-19 tinted place row lasted three days live; the client found it "a bit too much"). The rule under them stays: it is now the only thing separating the hubs from the categories. No group headings — the trigger already says Categories; the dropdown was the one surface in the chrome with no route to a hub at all
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
- [x] Homepage CMS wiring: `page.tsx` calls `getHomePageContent(locale)` — hero copy, editorial copy and FAQ content render from the CMS (seeded in all 7 locales) with the dictionary as fallback
- [x] Featured Experiences wiring: `getFeaturedExperiences(locale)` consumed — `TopExperiences` is fed curated cards (photoless cards filtered out), editorial/CTA cards are island-linked and gated on a live tour for that island
- [x] CMS-managed hero image: the page passes `image={safeRemoteImage(content.heroImage)}` with the bundled image as fallback
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
- [x] "Explore by type" category quick links — the hub tile renders exactly like the category tiles: same first position, image, name, "N tours" (mck-19's place tag + count-less tagline REVERTED per client, Aug 13 2026 — "back to how it was. Klein Curaçao with the number of tours under it. No Place label"). The `destination.exploreTypes.place` label was removed from all 7 dictionaries; the search recovery band's rail follows for free (shared `ExploreTypesRail`)
- [x] Destination About section from the destination model's SEO content
- [x] Streaming shell + `DestinationPageSkeleton`
- [x] Destination FAQ: destination-owned content via `getDestinationFaqs(island.id, locale)` (overrides the dictionary fallback when authored); About section is CMS-authored per island (`PageContentSection` rows, real copy seeded)
- [x] Instagram section: settings/CMS-fed via `getInstagramFeed(destination)` (admin-managed account, tiles, layout; gated on `feed.enabled`) — the hardcoded images are gone
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
- [x] Widget trust strip line 2 is the LOCKED neutral `Pay only {X}% today, the rest later`, shown
  **only** where the tour really takes a deposit online — a deposit model AND `0 < deposit_pct <
  100` (`requiresDeposit`). `paid_in_full`, `operator_full`, a 0/100% deposit and any unrecognised
  payment model all fall back to the single cancellation line (LD5 / conflict log 81 / B.81).
  Fixed 2026-08-06 (Pastel #32): the line had grown model-specific tails ("the rest via the
  operator's secure link" / "the rest on arrival"), `paid_in_full` rendered a second "Pay in full
  now" row, and `deposit_pct` was rounded — so a 27.5% tour promised 28%
- [x] Category chips in the filter row as navigation links to `/{locale}/{destination}/{category-slug}/` — 🔴 Must Fix satisfied
- [x] Category chips **never wrap** (§3.12 "horizontal scroll on overflow", Pastel #31): one
  scrolling track (`CategoryChipTrack` in `tours-filter-bar.tsx`) carrying trackpad/touch/drag
  scroll, `scrollIntoView` on focus, `pointer-events:none` edge fades and prev/next chevrons gated
  on `matchMedia('(hover:hover) and (pointer:fine)')` + `(any-pointer:coarse)` — pointer
  CAPABILITY, never a breakpoint, so a narrow desktop window keeps them and a touch laptop does
  not. Below md the controls keep line 1 and the track takes line 2. Mirrored in the mockups
  (`final design/all-tours.html`, `category.html`)
- [~] **Deviation from §3.12, founder-approved (Pastel #31 follow-up, 2026-08-06):** Sort no longer
  sits in the filter row - it moved down into the grid head, right-aligned on the counter row, so
  the band above belongs to the category track alone. The applied-filter pills + "Clear all" also
  take their own line above the counter at every width (four pills alongside the counter and Sort
  crowded the row and clipped the last one). Master still draws Sort in the filter row
- [x] Filter row **and grid head** are ONE sticky surface under the navbar (founder, 2026-08-06):
  the applied filters, the count and Sort stay reachable down a long grid. One band, so one
  hairline, at its bottom edge. Sticky height ~159px desktop / ~205px mobile with a filter applied
- [x] No "Explore by type" category-card section on All Tours — 🔴 Must Fix satisfied
- [~] Date pill (`tours-date-pill`) exists in the filter row, but `date` is not part of the tours URL filter model (Phase 3), so it does not actually filter availability
- [~] Trust strip below the grid: `ToursTrustStrip` renders, but the four locked checkmarks + "Questions? Chat on WhatsApp →" inline link and mobile vertical stacking are unverified (🟠 Important)
- [x] 🔴 Must Fix — H1 with `{year}` resolved at render time via `lib/current-year.ts` (daily-cached `getCurrentYear()`), applied to both the H1 and `<title>` in `tours-header.tsx`
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
- [x] ≥3-published-tours render gate enforced on the frontend (§2.4 / §5.4) — enforced upstream by design, not re-implemented in the route: the loader hits the gated endpoint, so a thin category is absent from every list the page renders and `getCategoryBySlugForDestination` returns `null` → `notFound()`. Nothing on the frontend re-filters, so there is no second copy of the threshold to drift
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
- [x] Hub-page cards COMPOSE "{Hub} {Title}" (trips grid, Our Picks, comparison columns) with the eyebrow suppressed — founder decision 2026-08-06, a deliberate deviation from §3.5's worked example, not to be reopened (mck-18 §2). Composed at render (`hubCardTitle(render.name, …)`) from the hub-free stored title, never stored — the same pixels used to come from printing a dirty stored prefix, which is the trap mck-18 §6 flags
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
- [x] H1 composes the LD15 colon form "{Hub or Destination}: {Tour name}" (`tourPageH1`; `hubs[0]` stands in for the primary hub until `TourHub` grows an `isPrimary`), so the H1 always carries a prefix; the last breadcrumb crumb stays the bare tour name (`breadcrumbLabel` above 35 chars), and JSON-LD, gallery alts, share text and `<title>` keep the bare title (mck-18 §2/§7, 2026-08-10). The per-locale colon form (fr narrow space, zh full-width, nl/de preposition) is an OPEN mck-18 item — EN concatenation for now
- [x] Booking card rebuilt to mck-15 (2026-08-08, GitHub #126 / Pastel #58). **Block order is now date → travelers → extras → price → button**: the price is its own block and the last thing above the CTA, so adding an extra changes a number still on screen. It used to sit INSIDE the travelers box, so collapsing the party left a box titled "5 travelers" holding a price breakdown, and it sat above the extras, so anyone adding the open bar had to scroll back up. **The per-person extra was charged twice** — two adults adding one $22 open bar were billed $44, because the party headcount multiplied the quantity the traveller had already picked. The quantity IS the unit count and the unit is whatever the price line says, so it is fixed in all four places that carried the same expression (`booking-store.ts`, `checkout.ts`, the checkout page breakdown, and `booking-pricing.util.ts`), and the widget, the checkout summary and the server quote now agree. Extras carry a **unit-aware cap** shared by the stepper and the reserve guard (`addOnMaxOf` / `addOnQuantityCap`): per-person stops at the **paying** travellers (a free infant band takes a seat but is not somebody you buy an open bar for), per-booking stops at one, and the operator's `maxQuantity` only ever lowers either. **Departure chips appear only on a tour with more than one departure**, under a "Departure time" heading, with the sub-line reserved for "Sold out" — never "Available", never "Selected", since selection is the orange border and fill; a lone departure is auto-selected by the store (`loneSlotTime`), which is what let the CTA read "Check availability" forever on a card that had already answered it. **Party bands come out in a fixed age order** (`bandTypeRank`: adults, then children, then infants) rather than the operator's creation-order `displayOrder`, which dropped an added infant between adult and child, and the row label is composed as "Adult (Age 13+)" from the operator's noun plus a LOCALIZED age qualifier — the operator's own bracket is English on all seven locales. The two-phase "check availability" click is gone (`availabilityChecked` deleted): a complete selection is ready, the party stays editable, and the price moves on every plus and minus. **Calendar**: three day states with their own labels (Sold out / Closed / No departure) where four situations used to share one grey and one hover word; the strike-through carries the RULE "there was a departure and it can no longer be had", so it covers sold-out and past-cutoff but not a day the tour never runs — which is the only version of this a phone can read, because hover does not exist there. Plus a today ring, an outline on the first bookable date, "August 2026" with the year beside the month it qualifies, and a legend line. **Microcopy**: "$150 per person" not "$150/per person", "2 adults × $150" not "Adult x 2 x $150" (in the client-side estimate AND in the server-quote rows, which used to silently replace it), a picked free band reading "1 infant · Free" rather than arithmetic about nothing, and Show details / **Hide details** in place of a bare arrow. All copy in 7 locales. Dashboard side (`add-ons-manager.tsx`): "Flat rate" is now "Per booking" and its maximum quantity is pinned at 1, so an operator cannot set a ceiling the widget and the API will refuse to honour
- [x] Expandable text / about-expander for long-form copy
- [~] Quick-info badges: the audit does not confirm the LD7 lock of **exactly 3** (Duration, Pickup, Languages)
- [x] Review preview module above Overview (LD29): "What our guests say" + **2 recent 4★+ cards**, gated on the tour's OWN approved count (hidden <3) and its own aggregate (≥4.0). The 4★+ half was the part that was never enforced — the block took the two NEWEST reviews, so the Klein Curaçao catamaran (2×5★, 1×4★, 1×3★, newest = the 3★) led with its weakest review (fixed 2026-08-06, Pastel #38 / GitHub #91). The rule lives in `lib/reviews/highlight.ts` and is applied inside `TourReviewsPreview` — the only component that renders the strip — so no call site can opt out; the page additionally pre-gates on the star distribution it already has, so a tour with nothing to highlight never streams a skeleton for a block about to hide itself. **Under two qualifying reviews the whole block is dropped, heading included** (never padded with a weaker review); returning `null` lets the page's flex column close the gap. The full Reviews section below stays completely unfiltered — that is where a traveller goes to find out what is wrong with a tour
- [ ] Sticky TOC section navigation (LD16) over the seven fixed H2 sections (LD17 stacked layout)
- [ ] "Supplied by {operatorName}" muted tail line (LD14) — the only discovery-layer place an operator may be named
- [ ] Cancellation Policy section as the two locked prose paragraphs with `{hours}` resolved from `cancellation_hours`
- [ ] Reviews trust sub-line "Every review from a confirmed booking. No exceptions." under the H2
- [~] Review sort + depth filters shipped (newest/rating/helpful; traveller type, language, with-photos) — the LD30 conditional gates (sort hidden <10, filters hidden <20) are unverified
- [x] Star-distribution chart (histogram in `tour-reviews-section.tsx`)
- [x] Per-review machine translation with a show-original toggle (LD32) — `isMachineTranslated`/`showingOriginal` in `tour-reviews-section.tsx`
- [ ] Related Tours as **two** independent rows ("More {category} in {Destination}" / "More to explore in {Destination}"), 3 cards each, rendering at ≥2 matches, firing `related_tour_click` (LD33)
- [x] Demand card below the widget ("Likely to sell out" / "Book today to secure your spot.") gated on the single §3.7 trigger (2026-08-08, GitHub #121+#122 / Pastel #52+#53): the slot under the booking widget now holds the demand card and nothing else. **Instant confirmation** is gone from it — LD5 names it as an exclusion and conflict log 42 had already rejected it there once; the claim keeps its page-level home as "Confirmed in seconds" on the All Tours trust strip. The **Sponsored** disclosure is gone from the tour page too: it discloses a paid POSITION inside a ranked list, and a tour's own page has no position to disclose, so it stays on the listing cards and in the results-counter ranking tooltip where the position actually is. **Most popular** went with them: it is a §3.6 listing-card badge (max 1 per category), never part of §5.7, and the page already carries the real rating in the meta row plus a review preview module and a Reviews section — as a card here it was badge inflation, which pillar 2 (Ethical CRO) exists to prevent. So `BookingNoticeKind` and the whole notice-stack machinery are gone, replaced by one `showDemandCard` boolean and a `DemandCard` component; the six dictionary keys the removed cards owned are deleted in all 7 locales and `sellOutSubtitle` now carries the master-locked full stop. Styling was already §5.7-correct (white card, brand-orange border at 30%, flame SVG, plain `<div>` — never red, never animated, not clickable). Backend §3.7 rule was already built (90 days old · ≥3 sell-outs in 60d · <40% seats open across REAL DEPARTURES in the next 30d, never calendar days) with `likelyToSellOutOverride` as the launch flag; this pass closed the sell-out-counting gap — an operator **date closure** now counts as a sell-out alongside departures that filled with us, and a **bulk blackout counts once** via a new `availability_exceptions.closureBatchId` stamped per `closeRange()` call (counting per closed date would let one two-week haul-out clear the three-event bar and badge a tour that is not scarce). At launch the manual override IS the signal and must be set on a handful of tours only, never catalog-wide
- [x] Product/Offer + Review + AggregateRating JSON-LD (`lib/seo/tour-review-jsonld.ts`), plus TouristTrip + BreadcrumbList on the tour page (§2.6)
- [ ] Confirm no per-tour FAQ section and no closing trust block ship (LD21, B.7)

## Tour card (shared component)

- [x] Single `<TourCard />` used on every listing surface
- [x] Whole card clickable, no CTA button
- [x] Wishlist heart control (Fix 3) with optimistic toggle and no page navigation
- [x] Badge component (`tour-badge`) + `derive-badge` logic
- [x] Sitewide grid standard applied to every tour-card grid
- [x] `pricing-label` / `priceUnitLabel` helper so per-person vs per-group copy is unit-aware
- [x] `TourCardSkeleton`
- [x] Hub eyebrow is its OWN element directly above the title, never nested in the rating row (mck-18 §4, 2026-08-10): the eyebrow belongs to the SURFACE (§3.5), the rating row to the review count, so the two come and go independently — an unrated tour keeps its hub label. The stored title is hub-free (§3.5 v1.11; the hub-aware data pass `backend/prisma/demo/tour-titles.ts` strips each tour's prefix using ITS OWN hubs only, never a blind find-and-replace) and cards render it verbatim — the render-time `stripHubPrefix` compensation is deleted. Composition helpers live in `frontend/lib/tours/tour-name.ts`. Everything AFTER checkout (summary, thank-you, emails) is still an OPEN mck-18 item — no composed form there yet
- [x] Fix 1 — no 01/02/03 ranking ribbon (position is the only ranking signal)
- [~] Fix 2 — badge colour hierarchy (urgency red/deep-orange · authority dark · New ivory), max 1 badge per card, priority `Likely to sell out > Bestseller > New` — a badge system exists; the locked colour hierarchy and the max-1 rule are unverified
- [x] Fix 4 — photo carousel (5 photos max) with always-visible quiet dots (S4j: 60% + soft shadow at rest, full on hover/focus), position-aware hover/focus chevrons, lazy loading after the first image, and a final description slide (`shortDescription`, else a ≤160-char word-boundary overview excerpt) on every card payload incl. wishlist; mobile swipes natively (scroll-snap, no chevrons) with the same dots as the signal — DIT-20 (2026-08-06) sanctions image-led mobile cards over the old single hero; the horizontal 40/60 `mobileRow` card still opts in per listing and swipes too
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
- [x] `sell-out-notice` → `demand-card`: the §5.7 demand card is the ONLY thing below the widget, rendering only when the §3.7 trigger fires. Pastel #52/#53 emptied the rest of the stack out of that slot — Instant confirmation, Sponsored, and **Most popular**, which is a §3.6 LISTING-CARD badge (max 1 per category) the master never puts on the tour page
- [x] `policy-modal` (cancellation / deposit trust modals)
- [x] `collapse` behaviour + `lib/booking.utils`
- [x] Live availability sync against real departures and a real `POST /bookings/quote`
- [x] Live currency-switch synchronisation of widget pricing
- [~] Trust strip inside the widget: modals exist, but the LD5 two-line lock (line 1 cancellation, line 2 "Pay only {X}% today, the rest later", collapsing to a single line on `paid_in_full`/`operator_full`) is unverified
- [ ] Capacity scarcity subscript `N left` on date cells only when `available_capacity_for_date < 5`, in neutral gray, mirrored onto the selected date pill
- [ ] Calendar forward-window cap at 12 months / `tour.max_advance_days` with the disabled-arrow tooltip "Bookings open up to {N} months ahead"
- [ ] Booking-cutoff "Closed" state on date cells past `tour.booking_cutoff_minutes` (default 120, range 0–10080)
- [x] All-sold-out alternatives module: "These trips still have departures this week" (headline reworded 2026-07-29) with 2–3 same-category tours holding a departure within 7 days, plus the silent GA4 dead-end event (B.77) — `availability-dead-end.tsx`; the whole selector stack is replaced, not just the calendar, and same-category widens to the destination rather than rendering an empty block (2026-07-29)
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
- [x] **Truthful disabled-method hints (Pastel #83, 2026-08-16):** the currency is blamed only when the currency rule IS the reason - an EUR checkout used to read "iDEAL - Not available for EUR" (inverting a scheme fact: iDEAL settles exclusively in euro) because every method the intent didn't offer got the same currency-blaming hint, including the card-only fallback when the intent reported no methods. Now: iDEAL missing on USD → "Not available for USD" (correct); a method the currency allows but the Stripe account doesn't offer → "Temporarily unavailable" (new `methodTemporarilyUnavailable` dict key, 7 locales); iDEAL is additionally hard-gated to EUR client-side whatever the intent claims. NOTE the account half is dashboard config, not code: iDEAL + PayPal must be enabled in the Stripe Dashboard's payment-method configuration for the rows to go live (`automatic_payment_methods` relays exactly what the account grants; redirects are allowed by default)
- [x] **Operator-conditions gate at the commit step (Pastel #80 / MCK-20, 2026-08-16):** ONE required checkbox with TWO renderings at the checkout Payment card, directly above the locked consent line, keyed on `tours.operatorTermsKind` (null = ungated, the whole catalog's default). DOCUMENT: "I have read and agree to {operator}'s operator conditions" - the conditions words open an in-flow reading layer (`GET /tours/:id/operator-terms`, locale-resolved with EN fallback) whose "Agree and continue" ticks the box; the document lives ONCE per operator (`operators.termsDocument` {locale: sanitized HTML} + `termsVersion` + `termsEffectiveDate`). ACKNOWLEDGMENT: 2-6 first-person participation facts (`tours.acknowledgmentItems` {locale: string[]}) listed right above the box - a declaration, not a contract, no document, never platform policy. SERVER-ENFORCED: the payment intent is DEFERRED behind the tick (`reserveAndPay deferIntent` → gate panel → `POST /bookings/:id/accept-operator-terms` stamps `operatorTermsAcceptedAt` + the document `operatorTermsVersion` onto the booking, idempotent, ON_HOLD only) and `POST /payments/bookings/:id/intent` 422s a flagged booking without the stamp - both PSPs and every charging model funnel through it, and confirm() separately requires captured money, so no path reaches CONFIRMED around the gate. A Pay tap with the box empty gets the one calm error line, never a swallowed click. Migration `20260816150000_operator_conditions_gate`; demo seed flags `powerboat-adventure` (ACKNOWLEDGMENT) + `private-speedboat-charter` (DOCUMENT, Miss Ann's placeholder text). ALL CONDITIONS TEXT IS PLACEHOLDER pending legal workstream D1/D2. Master consequences flagged, not silent: the 5.8 "(links, no checkbox)" lock gains this per-tour exception (DIT-21)
- [x] **Operator-conditions end-to-end (Pastel #80 second wave, 2026-08-16):** (a) DASHBOARD ENTRY at the tours level - the wizard's Booking rules step gains an "Operator conditions" section (None / Participation confirm-list / Operator conditions document; inline 2-6-fact bullets editor, EN entry) sending `operatorTermsKind` + `acknowledgmentItems` as one unit on `PATCH /tours/:id`; ~~the DOCUMENT text itself stays platform-managed~~ (superseded by the third wave below - the document is operator-authored from the same wizard section). (b) EDIT-GATE COMPATIBLE - on a LIVE tour a non-platform conditions change is HELD in the pending-change set as a new `conditions` unit (true-diff at stash, prune, withdraw-on-revert, per-unit fieldTime, `changedAreas` chip "Booking conditions", diff rows in `PendingChangeDiff` via InlineListDiff, approve applies kind + items with an apply-time DOCUMENT-has-text re-check); the gated owner's reads overlay the staged values so the wizard resend-on-save never self-withdraws. (c) CANONICAL PAGE + URL INTERCEPTION - `operators.slug` (idempotent migration `20260816170000_operator_public_slug`) + public `GET /operators/slug/:slug/terms` back `/{locale}/operators/{slug}/conditions` (full page, prerender-seeded with the demo slug) with a `@modal` parallel slot + `(.)operators/...` intercepting route: any in-app link opens the document as an overlay over the current page at the shareable canonical URL, Escape/back restores the page underneath, hard loads render the full page. The tour page's LD14 "Supplied by" line gains the "Operator conditions apply" link (DOCUMENT flavor; the acknowledgment facts already disclose via the content blocks). (d) EMAIL - the confirmation email gains a conditional acceptance-recap block (line + "Read the conditions" canonical link for DOCUMENT; confirmation line for ACKNOWLEDGMENT), rendered ONLY for flagged bookings so every ungated email stays wireframe-byte-identical (template spec updated). Review-round hardening: acceptance requires booking contact first (WHO before WHEN), atomic first-writer-wins stamp, gate-local error surfacing with a retrying panel CTA, Edit-contact inert during the arm round-trip, shared `ModalShell` extracted (PolicyModal + reader + overlay)
- [x] **Operator-conditions third wave - operator-authored document + Translation Console (Pastel #80, 2026-08-16):** (a) the wizard's DOCUMENT flavor gains the PAGES rich-text editor (`components/pages/rich-text-editor.tsx` reused as-is, controlled value/onChange) writing `operatorTermsDocument` (TipTap HTML, one document per operator) on the same one-unit PATCH; the backend sanitizes EVERY write through the shared `sanitizePageHtml` pages pipeline (import-only reuse - Pages untouched) and the operator-row apply bumps `termsVersion` to `v{YYYY-MM-DD}` + `termsEffectiveDate` whenever the EN text changes. (b) the staged `conditions` unit carries the document map too (true-diff, prune, withdraw, approve applies CROSS-ENTITY to `operators.termsDocument` with an apply-time has-text re-check; per-locale text diffs in `PendingChangeDiff`). (c) TRANSLATION CONSOLE - the tour workspace gains a "Booking conditions" card (non-EN locales; facts as a lines FieldPair with EN source + AI fill, document as EN prose preview + rich editor) saving through NEW `PUT /tours/:id/operator-terms/translation/:locale` (EDIT_TRIP; `en` → 400 wizard-owned; platform merges instantly, a gated operator's write is HELD - `{held:true}` relayed as a toast; one-locale merge preserves kind + every other locale, empty clears the locale back to EN fallback). (d) the public body renders with `.it-page-prose` (full TipTap vocabulary - the reader, overlay and canonical page share one scale). Verified live: hostile HTML stripped at stash, staged-vs-live document diff, approve → public v2026-08-16, console NL hold preserving EN. Regression: `findOne`'s terms-only operator select must be pulled off before `flattenCounts` (its operatorInfo branch expects the list query's full operator shape - crashed every wizard load)
- [x] **Operator-conditions follow-up round (client feedback, 2026-08-16):** (a) TRANSLATION-LOSS FIX - a gated wizard resave rebuilt the facts/document maps from the LIVE row + the form's EN, silently dropping every translation HELD in the pending set; `resolveDesiredConditions` now merges over the WORKING (staged) unit; verified live: ES facts held -> approve -> `/es` checkout serves Spanish, EN/NL untouched (the "always English" report was the held-for-review lane working as designed PLUS this loss bug). (b) TRANSLATION CONSOLE AI - the "Booking conditions" card gets the standard per-card "Translate section" button for BOTH flavors (facts as lines; the DOCUMENT rides the same provider as page bodies - the prompt preserves HTML verbatim and the save re-sanitizes); verified live incl. AI-fill -> Save all -> instant admin merge. (c) FORMATTED DIFF - the review panel renders the confirm-list as a real bulleted list (added=green, removed=struck; `InlineListDiff variant='bullets'`) and the conditions document as FORMATTED current/proposed `.it-page-prose` panels instead of stripped text; facts now diff PER LOCALE so a held translation-only change never reviews as an empty diff. (d) PROD SEED - `pnpm prisma:seed:operator-terms` (backend package.json) seeds operators.slug backfill + Miss Ann's document + the two tour gate flags from the demo-seed single source; idempotent, fills gaps only, `--force` to overwrite - run on the production VPS to populate the feature there
- [ ] **Operator-conditions remaining follow-ups (Pastel #80):** (a) acknowledgment-items + document AI-translation PIPELINE - the console card's per-locale entry ships (third wave); the nightly AI sweep/enqueue for missing locales does not yet cover conditions; (b) the two old-site 301s (`/terms-and-conditions/powerboat-caribbean/` + NL twin) stay OUT of redirects.csv until the real Powerboat Caribbean operator enters the catalog with a public slug to point at; (c) register an `operator-terms` cache tag in BOTH repos' `lib/cache-tags.ts` and bust it from the approve/instant document writers (the public loader currently runs on an hourly TTL with no tag - an approved document change takes up to an hour to appear publicly); (d) content for the 5 REAL tours (3 dolphin, 2 Powerboat) lands through the dashboard entry when those tours enter the catalog
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
- [x] Apartment promo block - **dynamic since 2026-07-30** (`Hotels` module; see the Hotels section below). Was a hardcoded `APARTMENT_PROMO` constant in `lib/thank-you/thank-you.ts`
- [x] Support card
- [x] Resend-confirmation-email action (`POST /bookings/typ/:ref/resend`)
- [x] ICS / add-to-calendar and next-steps blocks
- [x] `BookingManageHeader` in management mode with a cancel link gated on `booking.canCancel`
- [x] `noindex` + `generateStaticParams` demo-ref stub so the route builds
- [x] `ThankYouSkeleton` + route `loading.tsx`
- [x] **Conversion firing** — `booking_complete` pushed on the TYP with `booking_value` = EUR commission, `booking_currency: 'EUR'` and `event_id` = booking publicRef (shared with the server CAPI fire for dedup)
- [x] Server-side mark-first idempotency (`conversionFiredAt` stamped atomically in the backend confirm transaction; the TYP conversion object is gated on it)
- [x] Conversion client component (`conversion-push.tsx` + `lib/tracking/booking-complete.ts`), gated on `NEXT_PUBLIC_ENABLE_TRACKING === 'true'`
- [ ] `detectBookingState()` server-side state machine over the 8-state `BookingState` union (`fully_confirmed`, `pending_manual_confirm`, `deposit_paid_balance_pending`, `fully_paid`, `last_minute`, `balance_overdue`, `tour_today`, `tour_tomorrow`)
- [ ] Edge-case microcopy set: email-delayed, pending-manual-confirmation, tour today/tomorrow banner, fully-paid (skip step 2), last-minute urgent balance, meeting-point-instead-of-pickup
- [ ] `operator_full` booking-card and step-2 copy variants (B.90)
- [x] Error render (no conversion) when a confirmed booking has a null `commission_amount` — data-corruption guard (2026-08-19). `POST typ/:publicRef/conversion` now returns a discriminator alongside the null payload — `dataError: 'NULL_COMMISSION'` (`ConversionDataError`) — so the TYP can tell corruption apart from the ordinary nulls a refresh/second tab/unverified link produce. The page renders `ThankYouRecordIssueNotice` above the hero (7 locales) and fires nothing on any platform; the booking itself still renders in full, because the reservation is valid and only its reporting value is missing. The corruption path deliberately does NOT burn the mark-first guard, so the banner repeats on every render until the record is repaired and a repaired booking can still fire

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
- [~] Account area contents beyond bookings (login mockup success state): **receipts SHIPPED 2026-07-30** as printable payment receipts (deliberately not tax invoices - no VAT data exists); saved tours still live at `/wishlist` only
- [x] 6-digit email-code step-up before invoices / cross-booking history (spec 2.4.5) — the `/{locale}/traveller` OTP door; pair login stays single-booking
- [x] Visible logout control in the account area — "Signed in as {maskedEmail} · Log out" header row on `/{locale}/traveller` (2026-07-30)

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

- [x] `/[locale]/saved` route, `noindex, nofollow`, server-localized chrome. **Renamed from `/wishlist` (mck-17)** - "Wishlist" is an internal word and the address bar is somewhere a visitor reads. `/[locale]/wishlist` 308s to it via `next.config.ts` `redirects()`, per locale and preserving the query string, so already-emailed `?restore=` links, shared `?list=` links and bookmarks all survive. Both paths stay in `robots.txt`
- [x] `WishlistProvider` mounted in the `[locale]` layout
- [x] Client `SavedToursView` fetching contents at request time
- [x] `GET /wishlist/resolve` + `wishlistApi` backed by the real `src/wishlist/` backend module
- [x] Cookie fallback for anonymous wishlists (`lib/wishlist-cookie.ts`)
- [x] Heart control on every tour card with optimistic fill and revert on API failure
- [x] `WishlistSkeleton`
- [ ] `add_to_wishlist` analytics event with list id and index (§3.5)

### Saved tours page rebuild (mck-17, 2026-08-09)

The page is **Saved**, not "Wishlist": `wishlist` survives only in the GA4 event
names (`add_to_wishlist` / `remove_from_wishlist`) and the backend module and
its endpoints. Nothing a visitor reads says it, the URL included.

- [x] H1 "Saved tours", the locked subline, the `{n} tours · {Island}` meta row and the device line
- [x] Share pill (`SharePill`, extracted from `CollectionShareButton` so one implementation serves both) producing a `?list=` link
- [x] Remove is the FILLED HEART, not an X - collapse out plus a snackbar with Undo that restores the tour to its original position
- [x] Heart is top-right on EVERY card, the horizontal mobile card included (founder decision 2026-08-13, reversing the earlier bottom-right move and overriding master §3.5 "mobile: bottom-right overlay"); the badge keeps its right-padding reservation for the heart's corner
- [x] Heart `aria-label` localized in all 7 locales (`listings.saveAria` / `removeAria`) - it was hardcoded English on every card on every surface
- [x] **No Sponsored badge on this grid** - `WishlistService.dropSponsoredBadge` runs after `applyMostPopularCap`, which can itself hand out a 'sponsored' fallback
- [x] Price integrity line: "Was {price} when you saved it", both directions, muted, suppressed across a currency switch (an FX move is not a price change). Cookie v2 carries the snapshot
- [x] Unbookable saved tours are kept, not dropped: dimmed, desaturated, not clickable, "Not bookable right now" + "See similar tours" pointing at the tour's own category on its own island. The heart still works
- [x] Date check (spec-flagged v1.1, confirmed for this release): `POST /availability/check-batch` answers many tours for one date and party size in a single call; per-card "Available on {date}" / "Closed on {date}" chips
- [x] The checked date lives in the URL (`?date=&guests=`, `replaceState` not push), like every other answer the traveller gives the site. Survives reload and the back button, is shareable with the question already asked, and rides onto every card's href so opening a saved tour lands on the widget with that day chosen rather than asking again
- [x] The email capture validates itself (`noValidate` + inline message under the field, `aria-invalid`/`aria-describedby`) instead of the browser's native bubble, which is unstyled, vanishes on the next click and floats over whatever sits below. Submit shows the same spinner the checkout uses. `EMAIL_SHAPE` extracted to `lib/email-shape.ts` so the login card and this form cannot disagree on what an address is
- [x] "Email me this list": `POST /wishlist/email` + `saved-tours.template.ts`, throttled 1/10s · 3/min · 10/hr. The link carries `?restore=` and merges the ids back onto the opening device, then cleans itself out of the URL
- [x] Shared view (`?list=`): read-only, hearts start empty, no email box and no device line
- [x] Empty state per master 5.12: outlined heart, "Nothing saved yet", body line, CTA back to the remembered island, category quick links, and three Locals' favorites with live hearts
- [x] The suggestion row cannot vanish: `isLocalsFavourite` is editorial (~30% coverage target) so an island can legitimately have none, and a cached-empty response during a backend blip produces the same result for an hour. Falls back to the island's recommended tours under a "Popular in {destination}" heading - the curated claim is only made when the set really is curated
- [x] Sponsored suppressed on the empty-state suggestion row too. mck-17 bars it from the PAGE, not just the saved grid, and "Locals' favorites" + "Sponsored" on one card are two labels that contradict each other
- [x] Compact trust strip - the same four lines and WhatsApp link as All Tours, reusing `ToursTrustStrip`
- [x] Mobile order: header → action row → grid → email capture. The first card starts at 354px instead of 600px, so three are visible on arrival instead of none
- [x] Vitest over the cookie format (v1 + v2, budget shedding) and the three list rules (price delta, sole destination, id parsing)
- [ ] **Recommendations under the saved grid are deliberately NOT built.** mck-17 marks them "not in v1" and shows the usual evidence does not survive checking (the Airbnb carousel test compared two algorithms, never against no carousel; GetYourGuide's wishlist renders navigation, not save-based recommendations). Revisit only against our own `related_tour_click` numbers
- [ ] Destination GROUPING once a list spans islands - the meta row drops the island name rather than picking one. Described in mck-17, never drawn

## Search & typeahead

- [x] `/[locale]/search` route, `noindex`, SSR
- [x] `SearchResultsSection` streaming from `searchParams`, supporting `q`, `page`, `destination`, `date`
- [x] Search results carry the FULL listing toolbar (2026-08-08, GitHub #97 / Pastel #44): `/[locale]/search` mounts the SAME `ToursFilterBar` All Tours does — date chip (pre-filled from the search, clearable), travelers pill, Filters modal, category quick-filter chips and Sort — rather than a second implementation. The only difference is a prop: `SEARCH_SORT_PROFILE` puts **Most relevant** at the head of the sort menu and makes it the default, while All Tours keeps Locals' favorites (a page's default sort is the value OMITTED from its URL, so the two cannot drift). Category chips were excluded by the Pastel note and added back by the client on 2026-08-08. Filters, travellers, date, category and sort all live in the URL, so a result is shareable and survives a reload and the back button; the counter and the "N results for X" heading track them. Backend: `GET /search` now takes the listing's filter params (`categoryIds`, `minPrice`/`maxPrice`, `durationMin`/`durationMax`, `ratingMin`, `cancellationMaxHours`, `pickupAvailable`, `guests`, `timeOfDay`) via `PickType(TourQueryDto, …)` and applies them through the shared `applyToolbarFilters` helper, plus a `SearchSort` enum whose `relevance` ranks by WHERE the term matched (name/title 100/80/60 › category or hub name 40 › overview or highlight 20, `MAX` over the join fan-out) with the canonical `is_sponsored, tier_rank, quality_score, id` order as the tie-break inside each tier
- [x] Navbar search (`nav-search`) with `search-typeahead` and `rotating-search-placeholder`
- [x] Destination-scoped search shared between nav and destination hero search (one unified system)
- [x] `SearchPagination` + `SearchSkeleton`
- [x] Dynamic `generateMetadata` reading `searchParams.q`
- [~] Autocomplete rules (min 2 characters, 250ms debounce, grouped Categories & Hubs / Tours / Collections, CMS-driven zero-state and rotating placeholders) — typeahead ships; the **zero-state panel is COMPLETE on the destination hero** (2026-08-06, GitHub #81 / Pastel #28). Focusing the empty field opens the same panel — an addition to the typed panel, not a second component (`SearchTypeahead` branches on a query under 2 characters) — with all four sections master 5.10 asks for: **Categories & Hubs**, **Collections**, **Top tours** (3, rendered through the SAME `TourRow` as the typed results, so photo / category / rating / duration / from-price match), and the closing **See all {count} tours in {island}** link reusing `destination.listings.seeAllCount`. Every row carries the target page's own photo, falling back to the flat `bg-it-bg` surface the navbar Categories dropdown uses — never a stand-in glyph. **CMS-driven per island**: the first two groups are curated in `destination_popular_links` under `placement = SEARCH_PANEL` (same table, same re-gating and same replace-all save as the hero row, ordered independently; dashboard **Destinations → Curation** tab). Uncurated islands fall back to their own gated lists, so a new island opens a full panel on day one. Top tours are NOT curatable — they come from the platform's `recommended` ranking (spotlight → tier rank → quality score), so the panel cannot be a side door around the tier economy. Group headings are dictionary keys in all 7 locales. Still unverified: the rotating per-destination placeholders, and a zero state for the unscoped NAVBAR search
- [x] Autocomplete surfaces COLLECTIONS (2026-08-05) — `/search/suggest` had category and hub buckets but no collection one, so an island's flagship "Best Things to Do in X" page was unreachable by typing its name in either search. The suggested categories are now gated at `CATEGORY_PAGE_MIN_TOURS` too (over-fetch then filter, since Prisma cannot filter on a relation count in `where`), so autocomplete can no longer offer a 404. The destination hero panel gained the entity buckets as well: it calls `/search/suggest` alongside the date-aware tour search, because only the latter honours the date field beside the input
- [x] Hero search accepts EITHER field alone (2026-08-05). An activity goes to `/search`; no activity goes to the island's All Tours page with any date pre-applied as a chip, since "what can I do on Thursday" has no keyword to rank and that page already filters on date availability. Submitting empty used to be a silent no-op and now lands on All Tours — the same rule with no date
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
- [x] **Review submission built** — token-based route `/review/[token]` (noindex, no login): star input with correctable stars, text, real photo uploader (`review-photo-uploader.tsx`), token-scoped backend upload
- [x] Post-tour review invitation entry points: automated email (hourly backend cron + cadence settings) and the dashboard customer-bookings "Leave a review" CTA; manual "Ask for review" from the dashboard Customers list
- [x] Star-distribution chart (LD31)
- [~] Review sort and depth filters shipped; the LD30 <10/<20 conditional gates are unverified
- [x] Machine translation with show-original toggle per review card (LD32)
- [x] `reviews` cache tag in the cross-repo tag vocabulary (`lib/cache-tags.ts`), busted by dashboard/review writes
- [x] Review + AggregateRating (+ Product/Offer) JSON-LD on tour pages

## Multi-currency

- [x] `lib/currency/{current,server}.ts` with cookie + locale resolution
- [x] Footer currency switcher writing `NEXT_CURRENCY`, session-persistent
- [x] Currency never rendered in the nav (§1.3)
- [x] `formatMoney`, `formatPriceFrom`, `resolveDisplayPrice`, `deriveDisplayRate` helpers
- [x] Currency-aware backend fetches (tour repriced in the shopper currency at checkout)
- [x] Exact-decimal money rendering sitewide
- [x] Live widget resync on currency change
- [x] Currency scope is **EUR/USD only**; `LOCALE_CURRENCY` now matches the locked map (EN + ZH → USD; NL/DE/FR/ES/PT → EUR) `(docs claim: MULTILINGUAL A2.2)` — it had mapped `en→EUR`, fixed 2026-07-21 in the frontend and dashboard copies
- [ ] Locale-aware money formatting (`$1,234.56` vs `€1.234,56`) verified per locale
- [x] IP-based currency localization (was roadmap; brought forward 2026-07-21) — geo picks the OPENING currency only, by writing the `NEXT_CURRENCY` cookie: `proxy.ts` from the edge country header on the locale redirect, `CurrencyAutoDetect` from the browser time zone for deep landings. `getServerCurrency` still reads only the cookie, so prices keep one resolution path; a stored choice is never overwritten

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
- [x] Canonical + hreflang coverage broadened (SEO pass 2026-07-25): now emitted on the homepage, destination page, `/tours`, `[destination]/[slug]`, search and the legal pages (7 locales + x-default)
- [x] **`app/sitemap.ts` built** — per-locale entries with hreflang alternates covering home, destination pages, All-Tours pages, legal pages and dynamic entities (destinations, LIVE tours, tour-gated categories/hubs, published collections) from the backend `GET /sitemap/entries`, with `lastModified`; private routes excluded
- [x] **`robots` built** (public routes allowed, private surfaces disallowed, sitemap declared)
- [x] **JSON-LD emitted** via `lib/seo/jsonld.ts` + `lib/seo/tour-review-jsonld.ts`: Organization, WebSite + SearchAction, BreadcrumbList, FAQPage, TouristDestination, TouristTrip, Product/Offer/AggregateRating/Review
- [x] `BreadcrumbList` JSON-LD on entity pages
- [x] `Product`/`Offer` JSON-LD on tour detail with AggregateRating + Review
- [ ] `ItemList` JSON-LD on the All Tours grid (only `itemListElement` inside BreadcrumbList exists — no listing-page ItemList)
- [x] `FAQPage` JSON-LD emitted from the shared FAQ section component
- [ ] `/help` Help Center route with FAQPage JSON-LD across the five categories (Booking, Cancellation, Safety, Equipment, Accessibility) — route does not exist
- [ ] Self-referencing canonical from filtered listing URLs to the clean URL
- [x] ≥3-tour category indexability gate: `GET /sitemap/entries` now counts the LIVE tours behind each (destination, category) pair and drops any below `CATEGORY_PAGE_MIN_TOURS`, the same constant the page 404s on — so the sitemap can no longer advertise a soft-404
- [ ] Reserved-word guard so static route segments (`terms`, `search`, …) cannot silently shadow a destination slug

## Tracking & analytics

- [x] Tracking layer bootstrapped (A5, 2026-07-25): `google-tag-manager.tsx` loads GTM from the dashboard-managed container ID, gated on `NEXT_PUBLIC_ENABLE_TRACKING === 'true'`
- [~] GTM container four-tag fan-out (Conversion Linker · Google Ads · GA4 `purchase` · Meta Pixel) — **GTM-UI configuration, not code**: the full recipe lives in `technical-doc/03-implementation/GTM-CONTAINER-SETUP.md` (the Meta tag MUST pass `eventID = {{dlv - event_id}}` or it double-counts vs CAPI); awaiting the founder's container work
- [x] `booking_complete` dataLayer push on the TYP (`booking_value` = commission EUR, `booking_currency: 'EUR'`, refs/context, `event_id` shared with CAPI); 2026-08-17: full §8.3 payload — `booking_ref` (display ref), `click_ids` (gclid/gbraid/wbraid/fbclid, omitted when organic), `operator_id`/`operator_name`, `island`, `user_id` (hashed email), `items[]` with `item_brand` + `item_category`
- [x] Server-side SHA-256 PII hashing (email, E.164 phone, split names, address) — one hash pass serving Google Enhanced Conversions and Meta (`pii-hash.util.ts`)
- [x] Server-side Meta CAPI fire in parallel with the browser Pixel, deduplicated by the shared `event_id` (booking publicRef), queued + retried via the `platform-jobs` queue
- [x] Click-id (`gclid`, `gbraid`, `wbraid`, `fbclid`) and UTM capture at booking creation (90-day first-party attribution cookie → reserve payload)
- [x] CI type-check of the tracking payload so a missing required field is a build error, not a runtime fallback (2026-08-17: `BookingCompleteEvent` in `lib/tracking/booking-complete.ts` — required fields non-optional, composition compile-checked; backend mirror is the required-`!` fields on `BookingConversionDto`)
- [ ] GA4 page-view baseline plus `select_content` on homepage destination selection
- [ ] Tour-card events `view_item_list`, `select_item`, `add_to_wishlist` with list id and index (§3.5)
- [ ] `related_tour_click` event on the tour-detail related rows (LD33)
- [ ] GA4 `search` event with `results_count` on every search render
- [ ] GA4 `login` event with `method: booking_ref` on successful booking lookup, plus a PII-free silent failure counter
- [x] Silent GA4 dead-end event when the widget hits the all-sold-out state (B.77) — `lib/tracking/availability-dead-end.ts`, once per load, carries `alternative_count` so a 0-alternative dead end is distinguishable (2026-07-29)
- [ ] §8.4 Definition of Done verification: Tag Assistant clean fires, exactly one GA4 `purchase` per test booking, one deduplicated Meta `Purchase`, Enhanced Conversions match rate >60%

## Consent / cookies

- [x] Cookiebot consent script loaded in `(frontend)/layout.tsx` with `data-cbid` from `getPublicSiteSeo().cookiebotCbid ?? NEXT_PUBLIC_COOKIEBOT_CBID` and `data-blockingmode=auto`
- [x] `/manage-cookies` page (noindex) hosting `CookieSettingsButton` → `window.Cookiebot.renew()`
- [x] **Consent Mode v2** with regional defaults — EEA (EU27 + IS/LI/NO) + GB denied on ad_storage/ad_user_data/ad_personalization/analytics_storage, granted elsewhere; `wait_for_update: 500`, `ads_data_redaction: true`, set inline **before** `gtm.js` in the same script
- [x] Consent-gated firing wired: Cookiebot (dashboard-managed CBID, `blockingmode=auto`) pushes consent updates into the GTM consent state

## Legal & policy pages

- [x] Six global legal pages served at their original URLs via the Pages system (2026-07-26): `terms`, `privacy-policy`, `cookie-policy`, `cancellation-policy`, `legal-notice`, `reviews-policy` are `Page` rows rendered through `LegalPageShell` + `PageBody`; `manage-cookies` stays code (interactive Cookiebot button, noindex)
- [x] Verbatim handover prose preserved — seeded byte-true from the rendered routes (`pnpm pages:seed`, fixtures in `backend/prisma/pages-content/`), verified structurally identical pre/post cutover
- [x] Non-`en` locales render the English text plus a notice banner (now driven by the backend's `isEnglishFallback`, so a future real translation drops the notice with no code change)
- [x] Pages / permalink system with a rich-text (TipTap) editor backing the legal pages — dashboard `/pages` list + editor, publish/unpublish, rename→301 permalinks, `pages` cache tag in both repos
- [ ] Missing footer routes: about, help, contact (can now ship as Pages + footer links)

## Error / 404 handling

- [x] `notFound()` used correctly at every gate (inactive destination, unresolvable slug, missing booking)
- [x] `publicGetStrict` semantics so a backend outage throws instead of baking a 404 into ISR
- [x] `not-found.tsx` built — root `app/not-found.tsx` plus a localized `[locale]/not-found.tsx`, branded via `NotFoundScreen`
- [x] `error.tsx` built — root + `[locale]` route-level error boundaries via `ErrorScreen`/`getStatusCopy`
- [x] `global-error.tsx` built (root boundary; English-only by design — no locale context at that level)
- [x] Localized, branded 404 with recovery links (the `[locale]` variant; root/global screens render default-locale copy)
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
- [x] Streaming policy inconsistency resolved — the inert Suspense boundaries (`ToursHeaderSection`, `DestinationHeroSection`, `DestinationCollectionsSection`, `HubTripsPanel`) were removed/reworked so wrapped sections genuinely stream or prerender plainly
- [ ] Apply one coherent per-page-type streaming policy (prerendered pages let cached sections prerender; only searchParams/cookie/per-user holes stream)
- [ ] Add `loading.tsx` at `[destination]` and `[destination]/tours` (gap G2 — `loading.tsx` does not cascade)
- [ ] Remove the dead `connection` import in `tours/tours-header-section.tsx:1`
- [ ] Remove the debug `console.log('details', detail)` at `tour-detail-content.tsx:102`
- [ ] Fix stale docstrings claiming `await connection()` in `tours-listing-section.tsx`, `search-results-section.tsx`, `destination-page-sections.tsx`, `hub-page.tsx`, `tours-header-section.tsx`
- [ ] Correct the `lib/api/public/destinations.ts:19` comment (says `revalidateTag`, code uses `updateTag`)
- [~] Dashboard-era dead weight: `app/_actions/dashboardActions.ts` (the mock) is **deleted** and `components/ui/` is flattened (35 files, 0 dirs); remaining candidates (`hooks/*`, non-`public/` `lib/api/*.ts`, `contexts/role-context.tsx`, `lib/config/rbac.ts`) unverified
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
- [x] The four inert-boundary skeletons were resolved with the streaming-policy fix (their dead Suspense wrappers are gone)
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

- [x] Playwright configured and carrying live public-site coverage — `e2e/tests/` now includes `tour-reviews.spec.ts` (public tour-page review display + compliance) alongside the entity specs
- [~] Legacy dashboard-era specs (attributes, categories, collections, destinations, hubs) still ride along in this repo — audit which still exercise live public surfaces and delete the rest
- [ ] Remove the committed failure artifact `e2e/test-results/trips-…/test-failed-1.png`
- [ ] **Zero public-frontend test coverage** — no jest, no vitest, no testing-library in `package.json`
- [ ] Add a unit/component test runner and cover the pure logic: `lib/tours/filters.ts`, `lib/checkout/checkout.ts`, `lib/currency/*`, duration formatter, `derive-badge`, `pricing-label`
- [ ] E2E coverage of the booking chain: widget → checkout → payment → processing → TYP
- [ ] E2E coverage of booking lookup, traveler session and the cancellation-request flow
- [ ] E2E coverage of locale routing, currency switching and wishlist persistence
- [ ] Visual/contract check that the 7 dictionaries stay structurally identical

### Frontend summary

**Done 266 · Ongoing 33 · Pending 153** (452 tasks total; recounted from the markers 2026-07-26). The transactional spine — booking widget, checkout, Stripe/PayPal/iDEAL **and Mollie** payment, processing hop, thank-you page, booking lookup, traveler session and the cancellation-request flow — is built end-to-end, and the 7-locale i18n layer is fully wired. The prior audit's concentrated gaps are now closed: sitemap + robots + JSON-LD shipped, the GTM/Consent-Mode-v2 tracking layer and the `booking_complete` conversion fire are live code (gated on the founder entering the container/pixel IDs and configuring the GTM container per `GTM-CONTAINER-SETUP.md`), error/404 boundaries exist, the homepage/destination pages are genuinely CMS-fed, and review submission + display depth shipped. What remains is polish and locked-copy verification (widget/checkout microcopy, card carousel, locale formatters), Phase 3 filters (date/guests/time-of-day), the GA4 secondary event set (`view_item_list`, `search`, `add_to_wishlist`, …), ItemList JSON-LD, the accordion checkout restructure, and unit-test coverage of the public site.

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
> **Update 2026-07-25:** Reviews (full moderation queue + analytics), Settlements and Customers are
> now real, built modules. The surfaces still *never built* are: refunds (as a dedicated screen),
> FX admin, a notifications feed, slug-registry admin, and Pages/CMS.

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
- [x] **Access-roles matrix alignment, passes 1-5 (2026-07-28)** - conflicts #1-#8 from the PDF audit, all reviewed by both subagents:
  - [x] #3 commission stripped for every non-platform reader (bookings reads + the public `/bookings/quote`)
  - [x] #4 `cancellationHours` admin-only once a tour leaves DRAFT (existing bookings' deadlines are read-time derived)
  - [x] #5 settlements `mark-paid`/`mark-unpaid` behind the new admin-only `MANAGE_PAYMENTS` (ceiling-excluded); operators view-own
  - [x] #8 tier change + Spotlight request owner-account-only (`assertOwnerAuthority`; team seats rejected)
  - [x] #2 operators REPORT cancellations (`report-cancellation`), admin executes (FULL refund, `cancelledBy=OPERATOR`); pending report holds the payout
  - [x] #1 tour approval workflow (`TourApprovalStatus`); operators lost `MANAGE_TRIPS` and submit-for-review instead; publish/unpause/restore stay platform
    - [x] All three legs of the round trip notify by email: submit-for-review → `ADMIN_EMAIL` (the reviewer mailbox); approve and request-changes → the operator (`operator.contactEmail`, else the owner login), carrying the admin's note. Fire-and-forget - a mail failure logs and never rolls back a submission or a verdict, and an unset `ADMIN_EMAIL` still lets the tour queue. All three load their own recipient rather than widening `tourSelect`, which feeds public payloads.
    - [x] The approval email never says "live": `APPROVED` is still `DRAFT` until an admin publishes, so the copy names who acts next instead of sending the operator to look for a page that does not exist.
    - [ ] An ADMIN publishing an unreviewed tour directly (publish stamps the approval, conflict #1) sends no verdict email - the operator's first signal is the live page. Fine at launch volume; revisit if direct publishes become the norm.

### Dashboard inbox (in-app notifications)

> `backend/src/inbox` - the bell, the sidebar badges and the login digest. NOT `src/notifications`,
> which is the OCTO webhook system (subscriptions, signing, HTTP delivery to OTA partners). The two
> share a word and nothing else.

- [x] `inbox_notifications` (migration `20260729220000`): one row PER RECIPIENT, `UNIQUE (userId, dedupeKey)` for idempotent re-delivery, indexes on `(userId, readAt)` and `(userId, createdAt)`; `user.inboxDigestShownAt` for the once-per-session digest
- [x] Fan-out ON WRITE: an audience (`platform` | `operator`) resolves to real users once and inserts a row each. Read-time visibility was rejected - per-user read state needs a row anyway, the badge stops being an indexed COUNT, and a later permission change would silently rewrite history
- [x] **Every notification is gated on the permission that gates the page it links to**, resolved through the existing `StaffPermissionsService` (never a second authority). A guide-level seat cannot learn a settlement amount from a bell it should not have received
- [x] The actor is never notified of their own action; SUSPENDED/INVITED seats and non-ACTIVE users are excluded
- [x] `notify()` is fire-and-forget and returns `void` - a bell can never roll back the booking or verdict that caused it. No queue: see EVENT-DRIVEN-AND-QUEUES §6b
- [x] 18 events wired to real call sites, one registry (`inbox-events.ts`) deciding audience + permission + category for all of them. A test walks the source and fails if any registered event is never emitted
- [x] `GET /inbox`, `GET /inbox/summary`, `PATCH /inbox/read`, `POST /inbox/digest` - all self-scoped by session, no permission decorator (there is nothing to authorise beyond being signed in)
- [x] Dashboard: bell + popover (count polled every 60s, list fetched only on open), sidebar badges from the SAME summary query so they can never disagree with the bell, once-per-session digest modal (server marker + sessionStorage, dismissible three ways, never renders empty)
- [x] One badge per sidebar row: rows with an existing work-queue badge (cancellations, reviews, spotlight) keep it - a queue count and an unread count disagree the moment you read a notification without doing the work
- [ ] `TEAM_SEAT_ACTIVATED` dropped: the flip lives in a Better Auth login hook outside Nest DI and would need a duplicate `StaffPermissionsService`. Revisit if the auth layer gains a DI bridge
- [x] Read / dismiss / clear: `PATCH /inbox/read`, `DELETE /inbox/:id`, `DELETE /inbox` (`ids` | `category` | `all`, plus `onlyRead` for the safe sweep). Hard deletes - the rows record that someone was TOLD something, not the thing itself. An empty body refuses on both endpoints
- [x] `audience: 'both'` for events each side needs for different reasons (tier demoted, tour unlisted), de-duplicated so a double-hatted account gets one row
- [x] Full audience matrix documented: `technical-doc/02-architecture/NOTIFICATIONS-AND-ALERTS.md`
- [ ] Booking-confirmed reaches operators only, never the platform bell - deliberate (volume would bury the admin's decision queue). One word in `inbox-events.ts` if that trade changes
- [ ] Per-user category mute preferences - the schema has room (`category`), nothing is built
  - [x] #6 media: route permissions (stage 1) + `operatorId` shared-library scoping (stage 2)
  - [x] #7 `VIEW_BOOKING_FINANCIALS` shapes the booking PROJECTION (manifest for guide-level seats), not the route
  - [ ] PDF ground rule 1 (three separate logins) vs the shipped 4-door system - **founder decision owed, no code**
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
- [x] Actionable badges on nav items — `NAV_BADGES` registry in `nav-main.tsx` keyed by nav url (pending cancellations, reviews awaiting moderation, spotlight requests, submissions review loop); each badge mounts only when its row survived permission filtering, ONE badge per row, and every count mirrors its page's default view so the badge never promises work the click does not show
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
- [x] Sub-categories listed as folders under their parent (Pastel #77, 2026-08-15): the main list shows only top-level categories; a parent row expands its sub-categories in place (simple folder view, deliberately not chips). Tour wizard tags sub-types as chips with a last-chip guard (an invisible sub tag can never satisfy the ≥1-category rule)
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
- [x] **Submissions queue (Pastel #79, 2026-08-15):** independent `/submissions` page (`MANAGE_TRIPS`, Inbox icon, own review-loop nav badge) — the review axis LEFT the Tours list: In review / Changes requested are gone from its status filter (picking a lifecycle status also clears any stale `approvalStatus` URL param) and, for an admin, those tours are not in the Tours list at all. The queue reuses `makeTripColumns` (same rich rows as Tours) plus a Submitted column and a per-row Review action into `?step=review`, sorted FIFO on `submittedAt asc`; filters: search, All Status (default — the whole loop) / In review / Changes requested, destination, operator. The ⌘K palette passes `approvalStatus=ANY` so mid-review tours stay jumpable
- [x] Tours list status filter fixed + fast (2026-08-15): atomic multi-key `setFilters` in `use-table-state.ts` (same-tick writes no longer clobber each other) and shallow `window.history.replaceState` URL writes — no RSC round trip per filter click
- [x] User-facing wording is **Tour**, not Trip (client 2026-08-15): role-aware list header via `useToursListCopy()` — "All Tours" for platform staff, "My Tours" for an operator — shared by page, loading skeleton and both breadcrumbs; New Tour button, Tour column, search placeholders and empty states all follow. Routes (`/trips`) and internal identifiers unchanged
- [x] **Live-edit gate UI (Pastel #80, 2026-08-15):** the Review step's live banner no longer claims every edit "updates immediately" — price/cutoff apply instantly, title/description/photos go to Island Tours first and travellers keep seeing the approved version. `PendingChangesPanel` shows the operator what waits (per-area proposal lines) and gives the platform Approve changes / Request changes (shared `RejectChangesDialog`, note required); Submissions gained **New tours | Content updates** lanes (live counts on both tabs), the second rendering the FIFO change-set queue (hero thumb, operator, destination, changed-area chips, Submitted, Review action); the nav badge is the SUM of both lanes
- [x] **Live-edit gate UX rounds 2-3 (client feedback 2026-08-15):** the gate is no longer silent or noisy on either side. OPERATOR: a standing banner rides every wizard step of a live tour while a set is pending (area chips, submitted time, the traveller promise, guarded View → Review) or sent back; the Media step names the staged gallery as the PROPOSED set; the Submissions nav row opened to `VIEW_TRIPS` and the page branches by role — operators get the same two lanes scoped to THEIR work (`reviewLoop` on my-tours + `GET /tours/my/pending-changes`), with the set state (In review / Changes requested) as a column and the badge counting their side of the desk. REVIEWER: the panel is a field-by-field diff with human labels, rendered as INLINE WORD DIFFS (LCS, removed struck red / added green, 400-token cap, list variant for bullet fields) and a photo thumbnail diff (new = green ring, removed = dimmed row, cover marker). NOISE KILLED AT THE ROOT: stashes hold only fields that truly differ from the live row (whole-form PATCHes used to stash everything), editing a field back withdraws it, an emptied set deletes itself, and `getLatestForTour` prunes pre-fix sets against live on read — shipping `current` (the live counterparts) so BOTH roles diff against one consistent snapshot. `findOne` overlays a held title for the gated owner so step re-saves can never silently withdraw it
- [x] **Live-edit gate UX round 4 (client feedback 2026-08-15): EVERY content change is gated, recorded and diffed.** One generic `LIST_CONFIG`-driven staged-list engine extends the gate to all five itemized content child entities - highlights, inclusions, exclusions, features, itinerary locations - with per-item translations in ALL locales staged too (item translation deletes stay platform-side). Gated CRUD mutates a staged copy the GETs serve back; approve reconciles each list tourId-scoped and re-sources machine translations; revert-to-live withdraws a lane; the read-time prune + `current` snapshot cover lists. The diff renders lists per item (added green / removed struck / edited = inline word diff), the panel header carries BOTH stamps (submitted + last edited), and 25 dashboard list mutations invalidate the pending-change query. Pickup zones, age bands, add-ons, languages, schedules stay instant (the client's pricing/operational lane). Round-3 review findings all fixed: `name` left `tripToUpdatePayload` (the stale-cache resend that could silently withdraw a held title), `listForOperator` filters APPROVED in-query with a supersedence check, and the prune write is optimistic-concurrency-guarded on `updatedAt`
- [x] **Live-edit gate UX round 5 (client feedback 2026-08-15):** Approve changes asks first (AlertDialog naming the changed areas + "travellers see them immediately"); the Request-changes dialog grew into a real writing surface (up to 2xl wide, 8-row resizable textarea, character counter); a REJECTED set KEEPS its diff for both roles with the admin's note riding above it (the backend ships `current` for decided sets via read-only `collectCurrentValues`); per-change timestamps - `payload.meta.fieldTimes` stamps each unit as it is staged and every diff row shows its own "when" beside the header's submitted/last-edited (rejected: submitted/sent-back) pair; the photo diff shows ONLY changes (Added/Removed rows, old→new cover, "order changed"); "Tour title" vs "Display title (page heading)". Round-4 review fixes: approve's list-translation UPDATE branch carries the staged flag (a human edit stayed machine-flagged and the AI refresh the approval enqueues overwrote it - CRITICAL), changedAreas iterates LIST_CONFIG (features/locations chips were dropped), and ListDiff surfaces base-field-only edits ("details updated") instead of hiding them
- [x] **Live-edit gate round 6 (client bug report 2026-08-15): a rejection never erases the proposal.** `getWorkingSetForTour` = open set, else the tour's latest set if REJECTED; every gated read serves the operator's draft after a rejection, and the next save REVIVES the whole proposal with the fix applied (rejected row kept as history, platform notified as a resubmission). Proven live end-to-end; regression test pins it. The one pre-fix loss event was restored from the rejected history row
- [ ] **Follow-up (round-6 review, MAJOR non-blocking):** an admin who bypass-edits live content WHILE a rejected draft sits unresubmitted can have that edit shadowed - the operator's next save revives the stale draft field over it (misattributed as an intentional resubmission; the reviewer re-diffing against live catches it at approve time). Robust fix = per-field base-version tracking (snapshot what each field was staged AGAINST; on revival drop fields whose live value moved to a THIRD value since `decidedAt`). Needs its own round - equality pruning cannot express it
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
- [x] **Operator calendar rebuilt to mck-15 §4 (2026-08-09):** every FUTURE day opens (a day the weekly pattern skips was a dead cell, so a Saturday could never be added to a Mon-Fri tour); cells carry per-departure pills `07:00 34/70` (time + booked-of-capacity) instead of a "70 seats" capacity read nobody asked for, with sold-out/closed as filled pills and a quiet "No departures" on an empty day; "Close entire day" only where the day is more than one open departure; legend describes the shapes the cells actually draw; **Reset the month** removes the operator's own date-level changes from today onward behind a confirmation naming them by type and count (exceptions only - bookings are never touched, past days never rewritten)
- [x] `/availability/check` wired, and correctly **short-circuited** in cache-revalidation (a read shaped as a POST; revalidating it loops)
- [x] **Range-close impact preview (Pastel dashboard #67, 2026-08-15):** the close-range modal shows what the range actually hits before confirming — departure and booked-guest counts from a backend range-impact endpoint — plus the explicit "guests are not notified" line; range scope covers all tours or one tour
- [x] **Admin calendar Island → Operator → Tour cascade (Pastel dashboard #71, 2026-08-15):** the global `/calendar` filters cascade (picking an island narrows operators, picking an operator narrows tours) and range actions carry the same island/operator/tour scope end-to-end to the backend
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
- [x] Booking detail as a full Sheet with next/prev arrowing (`booking-details-sheet.tsx`), refund status + `refundDue` surfaced for cancellations
- [x] Derived display statuses in the status filter (`NON_PAYMENT_REPORTED`, `FORFEITED`, `CANCELLATION_REQUESTED`) with matching status chips
- [x] Non-payment / forfeit row actions (report → admin confirm forfeit / dismiss), forfeit gated `MANAGE_BOOKINGS` (ADMIN-only, mirrored in `rbac.ts`)
- [ ] Move `refundDue()` and `paymentModelLabel()` out of the columns file into `lib/bookings/` — money logic is not presentation (defect B-6/D-9, owed at Phase 20)
- [ ] E2E coverage for bookings — **zero specs exist**

## Payments

- [x] `/payments` route with `loading.tsx`, rendering `PaymentsListView` over `components/common/payments-page-view.tsx`
- [x] 3 components incl. refund columns and provider/method rendering
- [x] `GET /payments` wired; converted to the unified `DataTable`
- [x] Row actions built (2026-07-26, `payment-row-actions.tsx`): View booking (deep-links `/bookings?q={ref}`), copy booking/payment refs, Open in Stripe/Mollie dashboard (admin), and **Retry refund** on a FAILED refund row (admin, confirm dialog — re-invokes the idempotent cancel retry hook)
- [~] Payment detail sheet — still no detail view; the row actions + booking deep-link cover the drill-in for now (**backend request A7 remains for a full sheet**)
- [ ] E2E coverage for payments — **zero specs exist**

## Cancellation requests

- [x] `/cancellation-requests` route with `loading.tsx`
- [x] Implemented as `BookingsListView` with the `cancellationView` prop — oldest-first ordering
- [x] Refund-entitlement copy cites master §6.4
- [x] `/bookings/:id/cancellation-request` endpoint wired
- [x] The 3 cancellation-specific extra columns render
- [x] Pending-count nav badge (`CancellationsBadge` in `nav-main.tsx`, scoped to PENDING)
- [~] Rebuild as a real **queue/inbox** — the nav badge shipped; pending-first ordering + inline approve/reject in the queue shape still owed
- [ ] E2E coverage — **zero specs exist**

## Refunds

- [ ] Dedicated refunds surface — **still not built** as a screen; refund status/`refundDue` now render inside bookings (detail sheet + columns) and settlements, and the backend executes refunds automatically on FULL-verdict cancellations, so the remaining need is a reconciliation/oversight view rather than an initiation flow
- [~] Manual refund initiation / approval action from the dashboard — a **Retry refund** row action now exists on FAILED refund rows (payments table, 2026-07-26); initiating a refund on an arbitrary payment (outside the cancellation flow) is still deliberately absent
- [x] Refund statuses unified (2026-07-26): a settled refund row is `REFUNDED` (never a green "Succeeded") and the ORIGINAL charge row flips to `REFUNDED` with it — both flipped live at the settle point (`executeRefund`/`reconcileRefundRow`) and backfilled by migration `20260726140000`; analytics gross counts `SUCCEEDED+REFUNDED` inbound so nothing double-counts
- [ ] Refund reconciliation view (a dedicated oversight screen over the double-recorded refund model)

## Settlements & payouts

- [x] Settlements module built — `app/(app)/settlements` + `components/settlements/` (columns, table, list view, row actions) + `hooks/settlements/use-settlements.ts`, wired to `GET /settlements` + `/settlements/summary` + the mark-paid/mark-unpaid actions (via `lib/api/bookings-dashboard.ts`), in nav
- [x] Ledger UI reworked self-describing (founder 2026-07-26): paid_in_full payouts only; plain-words statuses (Payout due / Paid out / Reversed) with a what-happens-next line per row (On hold / Ready to pay / Clears for payout {date} / Paid {date}); booking-ref search + status/date filters + admin operator filter; role-aware wording (admin: "Payout due to operators", operator: "Due to you from Island Tours" / "Paid to you")
- [x] **Manual "Mark as paid" row action** (admin, `MANAGE_BOOKINGS`, confirm dialog asserting the transfer was made) + "Revert to due" undo — replaces the removed automatic hourly release; enabled only on server-computed `payoutEligible` rows
- [x] `payoutDueEur` caveat retired — the Statistics payouts-due card now reads the settlements ledger verbatim and says so ("Matches the Settlements page"); its note reflects the manual mark-paid workflow (2026-07-26)
- [x] Refund analytics (2026-07-26): admin "Refunded to travellers" KPI card (settled refunds from the payment ledger, `refundedEur`), and Recent Activity gained "Recent Cancellations" (who cancelled + refund-owed badge) and "Recent Refunds" (status badge incl. stuck PROCESSING/FAILED) groups, role-scoped; admin grid hides the Customers card (Refunded takes its slot - two clean rows), operators keep it
- [ ] Operator payout statements / export (per-operator statement view over the ledger)

## Reviews & moderation

- [x] Reviews module built (2026-07-22..25) — real moderation queue: status/rating/tour filters (defaults to PENDING), inline approve/hold/reject row actions, bulk approve (`useBulkModerateReviews`)
- [x] `lib/api/reviews.ts` + `hooks/reviews/use-reviews.ts` + `types/review.ts` all exist (incl. `reviewAnalyticsApi`)
- [x] Review-approval gate wired — moderation UI is live, feeding the approved-only public aggregates
- [x] `Reviews` nav entry restored (gated `VIEW_REVIEWS`) with a pending-count badge (`usePendingReviewCount` in `nav-main.tsx`)
- [x] Review analytics (DASH-9) as a tab inside Statistics (`review-analytics.tsx`, recharts)
- [x] Playwright coverage for the moderation queue (`e2e/tests/reviews.spec.ts` — queue, bulk approve, RBAC)

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
- [x] Platform customer/traveler directory distinct from staff — `/customers` route (`customers-list-view.tsx`, columns, row actions), operator-scoped by the backend, with a manual "Ask for review" action and bulk email (`EmailCustomersDialog` → `/customers/email`); in nav
- [x] "Leave a review" row action in the customer bookings view (FE-12b)
- [ ] Per-card edit on the profile page (today a single `isEditing` boolean toggles the whole page)
- [ ] Active-session list on the security card — needs a backend endpoint

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
- [x] Media kind classification (`lib/media/media-kind.ts` + badges in list/viewer)
- [ ] Server-side filters (type, date, size, unused) and sort — the controls exist but are intentionally hidden (`SHOW_FILTER_CONTROLS = false`); verify `/media-gallery` query-param support first
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
- [x] Console is the single translation path — the forked `LocaleTab` implementations are gone (no `LocaleTab` references remain); the workspace covers page content, About-band sections and SEO (`entity-workspaces.tsx`, `content-workspace.tsx`)
- [ ] `lib/translatable-schema.ts` — the single declarative registry the matrix and workspace should render from (a missed field silently becomes untranslatable)
- [x] AI translation of every console entity (2026-07-27): backend `src/content-translation/` — provider-agnostic `TRANSLATION_PROVIDER` token routed per call by `TranslationProviderRouter` over a provider catalog (gemini/anthropic/openai/groq/openrouter/mistral/deepseek/custom; 3 transports - Gemini native, Anthropic native, one OpenAI-compatible client; `custom` = any base URL; Gemini = default + fallback; `TRANSLATION_*` env fallbacks), entity registry (tour + 6 children, destination/hub/category/collection + page content + FAQ groups + sections + rationales, homepage), protect-human-edits policy (`isMachineTranslated` + `sourceHash` on all per-locale tables, migration `20260727103628`), background BullMQ queue (`content-translation`, en-save hooks in all 8 services, 60s debounce, 8 jobs/min limiter), nightly backfill sweep, and 6 per-entity `POST .../translations/:locale/generate` endpoints
- [x] "Translate with AI" button on the translation editor (current locale, synchronous) — `workspace-shell.tsx` + `use-generate-translation.ts`; human saves now send `isMachineTranslated: false`; proper nouns (destination/hub names) never machine-translated; excluded v1: Pages module (hub our-picks/comparison/HubContentSection covered since 2026-07-28: registry units + replace-all flag preservation + inline AI buttons in the hub editor)
- [x] Inline per-field AI translation (2026-07-27): AI icon on every workspace field (`field-pair.tsx` + `use-inline-translate.ts`) → `POST /content-translation/translate-text` — fills the form field for review, persists nothing until Save all; human rows gap-fill only (cleared-and-saved fields refill, hand-written fields never overwritten, no machine re-stamp)
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

- [x] Pages module built (2026-07-26): `/pages` list (DataTable) + `/pages/new` + `/pages/[id]/edit`, row actions (Edit / View live / Publish-Unpublish / Delete-with-unpublish-first), nav item in the Pages group, all gated `MANAGE_EDITORIAL`
- [x] Rich-text editor — TipTap v3.29 adapted port (`components/pages/rich-text-editor.tsx`): shadcn/hugeicons toolbar, tables wired, SCSS scoped under `.it-page-editor`, content area = `.it-page-prose` mirror of the public legal typography (live WYSIWYG preview)
- [x] Page CRUD + slug (auto-gen + `slugTouched`, rename→301 note) + publish state + English content wiring (`{fields}` translation payload); other locales are schema-ready, deferred by the English-only decision
- [x] Both user decisions resolved 2026-07-26 (fall-through routing; adapted TipTap port) — see `technical-doc/content/HOMEPAGE-AND-PAGES.md` Phase 5

## Recommendations (post-booking promo)

Island Tours' post-booking promo - featured on the thank-you page (and, once the
email block ships, the confirmation email) after a traveller books. Generalises
the single-purpose **Hotels** promo (built 2026-07-30) into a typed,
internal/external, placement-controlled system on 2026-07-31.

- [x] `RecommendationCategory` + `Recommendation` + `RecommendationTranslation` models (`prisma/recommendations.prisma`), tables `recommendation_categories` / `recommendations` / `recommendation_translations`
- [x] Migration `20260731120000_recommendations` renames `hotels` -> `recommendations` (+ `bookingUrl`->`linkUrl`, `pricePerNight`->`priceAmount`), adds `source`/`categoryId`/`placements`/`refType`/`refId`, creates the category table, and carries the seeded "Palm Suite Apartment" over as an EXTERNAL recommendation in a seeded "Hotels" category placed on `THANK_YOU_PAGE` (no on-screen change)
- [x] **Admin-managed categories** (Hotel, Restaurant, Car rental, …) - CRUD under `/recommendations/categories`, seed-protected delete, `SetNull` FK so deleting a category never deletes its recommendations
- [x] **Two kinds.** EXTERNAL = custom content (photo/link + per-locale copy, off-site). INTERNAL = a pointer at a Tour / Destination / Collection / Hub, rendered from the LIVE entity and linked same-tab (`/{destinationSlug}/{slug}`); the resolver fails closed (returns null -> card skipped) on any non-public/archived/deleted entity, so a draft never leaks
- [x] **One featured card PER SURFACE.** `getFeatured(locale, placement)` serves the first *enabled and complete* recommendation placed on that surface by `displayOrder`; an incomplete row is SKIPPED rather than ending the search. `featuredPlacements` on the admin shape names which surfaces each row currently wins
- [x] **Seed protection** on both the row and the "Hotels" category (`isSeeded` -> 403 on delete), exactly like a seeded destination
- [x] **The render gate**: EXTERNAL needs image + English title + link; INTERNAL needs the entity to still resolve live to a name + image + link. No "null falls back to bundled copy" - we ship no default, and inventing one would advertise a place that does not exist
- [x] Backend `src/recommendations/` - `GET /recommendations/public?locale=&placement=` (`@Public()`) + full CRUD, category CRUD, and per-locale copy behind `MANAGE_EDITORIAL`; PATCH updates; create/update enforce source rules + refId existence; 23 unit tests
- [x] Public loader `lib/api/public/recommendation.ts` (`'use cache'`, `cacheLife('days')`, `cacheTag('recommendations')`), gated on one `enabled` flag; component `thank-you-recommendation.tsx` branches the CTA on `external` (off-site new tab vs on-site `MotionLink`)
- [x] Cache tag `recommendations` in `lib/cache-tags.ts` in BOTH repos (byte-identical) + `case 'recommendations'` in the dashboard's `cache-revalidation.ts` (public shipped first, per the contract)
- [x] Dashboard `Recommendations` - list (source badge / category / name / featured-placements status), create/edit form forking on Source (External fields + Content tab vs Internal RefType + entity picker), Placement checkboxes, Category select, Categories CRUD sub-screen, seed-protected delete
- [x] Registered in the Translation Console (`recommendation` entity type) + the AI pipeline (`entity-registry.collectRecommendation`, nightly sweep over EXTERNAL rows, `POST /recommendations/:id/translations/:locale/generate`), so all 7 locales are reachable
- [x] The palm emoji stays chrome in the card component, identical in every language (carried over from the hotel card)
- [ ] **Confirmation-email block** (`CONFIRMATION_EMAIL` placement) - backend `getFeatured` supports it and the dashboard offers the placement, but the locked confirmation-email template does not yet render a recommendation block (no wireframe for it yet - deferred pending a design decision)
- [ ] No on-site preview of the featured recommendation - the card renders on a thank-you page reachable only with a real booking reference

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
- [x] Integrations tab cards: Meta CAPI (pixel id + token + test code), AI Translation (8-provider dropdown + per-provider model picker with Free/Paid badges + custom base URL; replaced the Google Translate card 2026-07-27), WhatsApp; GTM container ID + Cookiebot CBID live on the SEO form
- [x] Review-request cadence screen (`review-requests-form.tsx`) driving the post-tour invite cron
- [x] Instagram management tab (`instagram-form.tsx` — account, connection panel, layout, curation) feeding the public Instagram section
- [x] Instagram API auto-sync (phase 2, 2026-07-28): OAuth connect + encrypted 60-day token (reuses `ENCRYPTION_KEY`), daily `@Cron` sync mirroring media into Cloudinary, upsert on `igMediaId`, provider seam with an offline `INSTAGRAM_APP_ID=demo` mode. Manual tile picker retired; curation is reorder + hide only. Needs a Business/Creator account + `instagram_business_basic` app review to go live.
- [x] FAQ host avatar + video clip admin-managed on the site-info form
- [x] Operator: company + payments, plus the **Payout Provider** switcher (`operator-payments-form.tsx` — active provider = payout destination only; travelers are always charged by platform settings)
- [x] `PATCH /settings/site` correctly busts the public `site-info` tag (defect B-1 fixed and regression-tested in both repos)
- [ ] Routed, deep-linkable sections (`/settings/general`) — today there is **no URL state at all**, worse than the entity editors
- [ ] Rename to end the naming collision: admin `General` → **Site**, admin `Company` → **Legal Entity**, operator `Company` → **Your Business**
- [ ] Search within settings, fed by the command palette
- [x] Connection status + test action on Stripe / Mollie (2026-08-16): `GET /settings/payment/connection-status` (MANAGE_SETTINGS, 12/min throttle) live-probes the STORED credentials — Stripe `accounts.retrieveCurrent` + default `payment_method_configurations`, Mollie `GET /v2/methods` — and reports per-provider `{configured, ok, mode, accountLabel, error}` plus the 8-brand activation board (visa/mastercard/amex/paypal/ideal/applepay/googlepay/klarna; brand vocabulary shared via `payment-method-brands.ts` ↔ dashboard `payment-method-guides.ts`, Google Pay on Mollie = `unsupported`, never `inactive`). A provider missing credentials per `missingProviderCredentials` (now public — same activation contract as the switch) is never probed; a failed probe returns `ok:false` + a redacted reason (secret-shaped tokens stripped), never an HTTP error. Dashboard: per-card "Test connection" strip (result persists in the strip, toast echoes it) + a "Payment methods" board card for the ACTIVE provider with white-chip brand marks, live/test-mode badge, per-inactive-method "How to activate" collapsible guides and an honest checkout-coverage footnote
- [x] Per-method checkout OFFER switches + Klarna at checkout (2026-08-16, wave 2): each provider card's methods list is METHOD-level (Card carries the visa/mc/amex chips) with an on/off switch per method = "offered at the traveller checkout". Truth chain: stored `paymentMethods[]` (empty = all on, the pre-toggle default; dashboard materializes the explicit list on first flip, refuses to switch the LAST method off, and LOCKS the switch off for any method not activated at the PSP) → backend intersects the Stripe intent's `payment_method_types` with the stored list at RESPONSE time (the intent keeps `automatic_payment_methods` - the (booking,kind) idempotency key maps to ONE intent, so toggles never force re-creation) → checkout renders only the offered set. Mollie: creditcard off = Components profileId withheld (hosted fallback) AND stale cardTokens dropped server-side; hosted method list already honours the stored list. Checkout gains a Klarna tile (redirect via `confirmKlarnaPayment`, billing email+country from the contact step) - verified END TO END on the Stripe test account: USD checkout → Klarna playground (OTP, Pay in 4) → processing → CONFIRMED booking IT-2026-JP8MJ with Payment row `methodType=klarna`, commission stamped. Stripe's own market/currency truth still governs: the same account offers Klarna in USD but not EUR, and the checkout hints stay honest (iDEAL "Not available for USD" vs account-inactive "Temporarily unavailable"). Wallets (Apple/Google Pay) are activation-visible but not switchable: they need the wallet-sheet integration (Express Checkout Element + Apple Pay domain registration), not a radio row - honest note on their rows
- [ ] Connection status + test action on Mailchimp (the Stripe/Mollie pattern above is the template)
- [x] Wallet sheet at checkout (2026-08-17, wave 3): Stripe Express Checkout Element renders the Apple Pay / Google Pay buttons above the method list, in its OWN clientSecret-mode Elements group (the split Card Elements stay secretless); hidden entirely on devices that cannot pay (`onReady.availablePaymentMethods`); operator-conditions gate withholds the sheet (`onClick` never resolves while unticked); confirm via `confirmPayment redirect:'if_required'` -> processing. Intent response gains `walletMethods` (admin-switch gated AND requires card on - a wallet payment IS a card payment); wallet charges record `methodType=apple_pay/google_pay` (charge.payment_method_details.card.wallet.type, not plain card). Dashboard: wallet rows now toggleable with an ALWAYS-visible "How it works at checkout" guide (founder ask - Active alone didn't say what was left: Apple Pay needs one-time public-domain registration in Stripe -> Payment method domains; Google Pay needs nothing, shows in Chrome with a saved card); zero-guard counts only ACTIVE NON-WALLET survivors. Methods list + test strips show SKELETONS during the live probe (founder ask), never loading sentences. USER-SIDE for production Apple Pay: register the live site domain in Stripe once; wallet buttons need HTTPS + capable device for a real-hands tap test
- [ ] Fold the settings-local `settings-fields.tsx` design system into the shared form primitives
- [ ] E2E coverage for settings — **zero specs exist**

## Notifications

- [ ] Notifications module — **NEVER BUILT.** No route, no component, no API module; the bell in `components/shell/site-header.tsx` is still decorative (no handler)
- [ ] In-app notification feed / read state
- [~] Actionable nav badges — Reviews pending-count and Cancellations pending-count chips shipped in `nav-main.tsx`; bookings-needing-attention and pending-spotlight badges still absent
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
- [x] 11 e2e specs written: attributes, categories(+new-fields), collections, destinations(+new-fields), hubs(+new-fields), trips(+new-fields), **reviews** (moderation queue, bulk approve, RBAC) — API-mocked via route interception
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

**Done 245 · Ongoing 14 · Pending 116** (375 tasks total; recounted from the markers 2026-07-27). The dashboard is a mature, near-complete application: 24 modules
are built and wired — Reviews (moderation queue + analytics + nav badge), Settlements (self-describing
payout ledger with the manual mark-paid workflow, reworked 2026-07-26) and Customers (directory +
review requests + bulk email) all landed 2026-07-22..26, along
with the bookings forfeit/derived-status work, the booking detail sheet, the operator payout-provider
switcher, and the Integrations/Instagram/review-cadence settings. What remains splits three ways —
(1) four surfaces still never built (a dedicated refunds screen, FX admin, a notifications feed,
slug-registry/redirects admin) plus Pages/CMS (founder-blocked); (2) the untouched redesign phases
16-20; (3) a test suite that is still narrow (11 mocked specs, no unit runner) with old red artifacts
checked in.

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
| 4 | **Category page gating threshold** | Canonical / `CLAUDE.md` / master: page renders at **≥3 published tours** per destination (also `[B.45]` "≥3 adopted provisionally (C2)") | Code gated at ≥1 (ROUTING §13, SLUG-REGISTRY §10, DATA-MODEL E.2); the homepage featured-card gate mirrored the code | Thin category pages shipped at 1–2 tours; SEO gating intent defeated | **RESOLVED 2026-08-05 in favour of the master (≥3).** The threshold is now one exported constant (`CATEGORY_PAGE_MIN_TOURS`) read by the discovery lists, the page 404, the sitemap and the homepage featured-card gate — the "same commit" condition this row set. Prompted by production: an admin-made 1-tour "Buggy Tours" category was being linked from the Curaçao hero, opening a page the master says must not exist. To revert, change the one constant |
| 5 | **Traveler step-up authentication scope** | Rationale **D5** defers the traveler step-up email code to **v1.1** | **D16** and spec **§2.4.5** put invoice / cross-booking step-up **in v1** | Determines whether v1 ships an email-code challenge for the traveler surface | **Reconciliation founder decision (2026-07-19): deferred entirely** — v1 has no invoice download and no cross-booking surface, so the trigger does not exist. Both D5 and D16 are superseded |
| 6 | **Three login doors vs a fourth `/account` door** | Login spec + `01-summary`: **three separate, purpose-built login surfaces** (traveler passwordless, operator, staff IdP), **"no passwords for travelers"** by principle | **2026-07-20 amendment**: customer accounts with `Role.USER` + set-password email and a **FOURTH door `/account`** (MASTER-CHECKLIST §6.8; not in master v1.9) | Softens both the "no traveler passwords" rule and the three-doors model that the whole login spec is built on | **RESOLVED 2026-07-28 in favour of the master.** The traveller account area moved to the public site (`/{locale}/traveller`) behind a **passwordless one-time-code** door, so travelers are passwordless again and the traveller surface is back on the public frontend. The dashboard `/account` door is slated for removal (tracked separately). See `bookings/05-traveler-booking-session-story.md` Scene 3b |
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

**5. Pages system (Phase 5) — RESOLVED AND SHIPPED (2026-07-26)**
- Both decisions were made by the user and the feature built end-to-end: **(a) fall-through routing** (destination → published Page → redirect → 404) keeping the six live legal URLs; **(b) adapted TipTap v3 port** (scoped SCSS, tables built, dashboard shadcn toolbar; sanitize-html on the backend write path). The six legal pages are now CMS-managed `Page` rows; the static JSX routes are deleted (`manage-cookies` stays code). Remaining: a human pass over the rendered dashboard editor UI.

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

