# Island Tours — Complete Feature & Functionality List

> Every feature/functionality of the application — **implemented or not** — in simple bullets.
> **Status:** ✅ done · ⚠️ partial / placeholder · ⬜ not built. Verified against code + `MASTER-CHECKLIST.md`. Last updated 2026-06-08.
> Overall: ~36% of total scope built. Backend core (schema, auth, content/discovery modules) is solid; commerce (bookings/payments), slot economy, and public site are the big remaining blocks.

---

## 1. Platform & Infrastructure
- ✅ Monorepo (backend NestJS 11 + frontend Next.js 15), split Prisma schema (PostgreSQL).
- ✅ Env validation (fail-fast), Redis available, Cloudinary/SMTP/OAuth configured.
- ✅ Global `ValidationPipe` (whitelist + forbid unknown), global exception filter, `@Global` PrismaService.
- ✅ Swagger/OpenAPI at `/api/docs`; shared error DTOs.
- ✅ All 17 Prisma schema files + migrations + seed (admin, 19 categories, 5 destinations, slots, hub).

## 2. Authentication & Authorization
- ✅ Better Auth (email/password + Google OAuth + sessions), mounted at `/api/auth/*`.
- ✅ Guard chain: Throttler → Auth → Roles → Permissions; decorators (`@Public`, `@Roles`, `@RequirePermissions`, `@AuthenticatedUser`, `@SkipThrottle`).
- ✅ 3 active roles (USER / TOUR_OPERATOR / ADMIN) + `ROLE_PERMISSIONS` map (80+ permissions); ADMIN superset.
- ✅ 3-tier rate limiting (20/s · 300/min · 3000/hr); CORS with credentials.
- ⬜ Auto-create guest USER on first booking (needs bookings module).

## 3. Destinations (admin)
- ✅ CRUD; slug auto-generated + immutable; seeded-protection; soft + force delete.
- ✅ V2 fields: region (required), country, lat/lng, timezone, currency, language, gallery, ogImage, parent.
- ✅ Multilingual translations (7 locales) + page content + FAQs (+ reorder).
- ✅ On create: seeds reserved `tours` slug + a category slug-row per active category.
- ⬜ Frontend admin form for the new V2 fields.

## 4. Categories (admin, global taxonomy)
- ✅ CRUD; slug auto-generated + immutable; seeded-protection; soft + force delete.
- ✅ V2 fields: description, icon, sortOrder, meta templates, parent category.
- ✅ Destination-scoped + **tour-gated** public endpoints (≥1 published tour; 404 on empty) + `publishedTourCount`.
- ✅ Translations + page content + FAQs.
- ✅ On create: seeds 3 FeaturedSlot rows + a slug-row per active destination (transactional).

## 5. Activity Hubs (admin, destination-scoped)
- ✅ CRUD; slug auto-generated + immutable; seeded-protection; soft delete.
- ✅ V2 fields: hubType (required), lat/lng; allowed-categories management.
- ✅ Translations + page content + FAQs (backend); slug-registry HUB row lifecycle.
- ⬜ Frontend hub translation/FAQ/page-content tabs.

## 6. Tours / Trips (operator + admin)
- ✅ CRUD; ownership via `operator.id`; admin can manage any trip; admin auto-provisioned as operator.
- ✅ Many-to-many categories (one primary) + many-to-many hubs.
- ✅ Flat canonical URL `/{dest}/{tour-slug}/`; always writes TOUR slug-row; no hub nesting.
- ✅ Unique-slug resolution (title → collision → operator-name suffix; never numbers).
- ✅ Lifecycle: draft → publish → pause/unpause → archive/restore → remove.
- ✅ Publish guard (≥5 images + hero + EN overview + ≥3 highlights + price).
- ✅ Pricing: pricingModel (PER_PERSON/UNIT) + unitType + basePrice and/or age bands; `priceFrom` auto-recompute.
- ✅ Public listing with filters (dest/category/hub/price/duration/rating/pricingModel) + dynamic attribute filters + sort + pagination.
- ✅ Child resources: images, age bands, add-ons, languages, highlights(+trans), inclusions(+trans), schedules, translations.
- ⚠️ pause/archive have slot-release hook stubs (wiring pending Phase 5).
- ⬜ `PENDING_REVIEW` moderation status (decide DRAFT→LIVE vs review queue).
- ⬜ Frontend multi-select category(+primary)/hub form + flat-URL routes.

## 7. Attributes & Filters
- ✅ Attribute dictionary CRUD (admin): key, displayName, dataType (BOOLEAN/ENUM/ENUM_MULTI/INTEGER/DECIMAL/TEXT), allowedValues, appliesToCategories, filterable/sortable, displayType, sortOrder; seeded with 46 defs.
- ✅ Per-tour attribute assignment (validated; ENUM_MULTI comma→JSON).
- ✅ `GET /filters/:dest/:category` — filter sidebar data (value counts + price/duration ranges).
- ⬜ Frontend filter panel + admin dictionary/per-tour editor.

## 8. Collections (admin, editorial)
- ✅ CRUD (MANUAL ordered tours / DYNAMIC saved-filter query); slug cannibalization guard.
- ✅ Public list + detail with resolved `tours[]`; translations + page content + FAQs; soft + force delete; COLLECTION slug-row.
- ⬜ Frontend CollectionPage + admin CRUD UI.

## 9. Slug Registry & Routing
- ✅ `resolve(destinationSlug, slug)` → entityType+id (TOUR/CATEGORY/HUB/COLLECTION/RESERVED); 404 on unknown/inactive.
- ✅ Unique per destination; immutable slugs; reserved `tours`; transactional row lifecycle.
- ✅ DECIDED divergence: immutable (no redirects, no 90-day cooldown).
- ⬜ Optional future: admin slug-change + 301 redirect table (full V2 parity).

## 10. Search
- ✅ `GET /search` keyword (ILIKE) over name/translations/category/hub/highlights; dest scope; Recommended sort; paginated.
- ⬜ tsvector/GIN ranking, autocomplete, faceting on `/search` (facets live on `GET /trips`).
- ⬜ Frontend search page.

## 11. Media & Settings
- ✅ Media Gallery — Cloudinary upload/manage + async BullMQ processor.
- ✅ Settings — SiteInfo, SiteSEO, social, SMTP, Mailchimp, company info, Stripe & Mollie platform config.
- ⬜ Generic Upload module (`POST /upload`, Gap G4).

## 12. Operators
- ✅ Apply → approve/reject (promotes role); profile with trips + slot holdings; Stripe/Mollie payout config.
- ⬜ KYC/document verification (F-09); granular suspension states (ACTIVE/SUSPENDED/CONTENT_REVIEW/BANNED, F-10).
- ⬜ Contract & commission acceptance gate (F-11); per-operator revenue analytics (F-21).
- ⬜ Multi-seat operator team (OWNER/MANAGER/STAFF invites, F-12); operator API keys (F-23).

## 13. Slot Economy *(Phase 5 — not started)*
- ⬜ Lock slot (soft-lock 15-min TTL) → publish (hard-reserve 90 days) with race guard (409 SLOT_TAKEN).
- ⬜ Release slot (→ offer to waitlist); slots-by-category; slot endpoints.
- ✅ Data layer only: 3 FeaturedSlot rows seeded per category; SlotLock/SlotHistory models exist.
- ⬜ Commission tiers (20/22/25/30%).

## 14. Waitlist *(Phase 6 — not started)*
- ⬜ Join FIFO queue; offer slot (24h expiry); claim / pass; my-entries; ETA per category.
- ⬜ Paid queue-jump skips (max 3, behind payments flag).

## 15. Background Jobs & Real-Time *(Phase 7–8 — not started)*
- ⬜ BullMQ processors: slot TTL release, 90-day cap expiry, waitlist offer expiry, pre-departure (24h).
- ⬜ Workers module + queues.
- ✅ `bullJobId`/`offerJobId` columns exist (wiring pending).
- ⬜ SSE gateway (Redis pub/sub) for live slot status + per-operator offer notifications.

## 16. Bookings *(Phase 4.13 — not built)*
- ⬜ Create booking (captures commission rate, auto-creates guest account); confirm via payment webhook; cancel + refund.
- ⬜ Traveler booking history; operator bookings list.
- ⬜ Maintains CRO counters (bookingCount/today/spotsRemaining/lastBookedAt).

## 17. Payments *(Phase 4.14 — not built)*
- ⬜ Checkout session (Stripe/Mollie/PayPal) + refund.
- ⬜ Gateway webhooks (`@Public` + `@SkipThrottle`, signature-verified).

## 18. Reviews & Wishlist *(not built)*
- ⬜ Reviews: create (completed-booking gated), public list, delete; feeds aggregateRating/reviewCount.
- ⬜ Review moderation/dispute + flagging (F-14).
- ⬜ Wishlist: add/remove/list (idempotent); WishlistButton on cards/detail; wishlist page.

## 19. Notifications *(Phase 16 — mostly not built)*
- ✅ Mail service (Nodemailer from Settings); email-verification + password-reset templates.
- ⬜ Templates: guest credentials, booking confirm/cancel, slot offer / offer-expired / cap-expired, pre-departure.
- ⬜ Push notification stub; admin notification toggles; in-app notification centre (F-20); preference centre (F-19).

## 20. Admin Moderation & Management *(Phase 17 — not built)*
- ⬜ Admin analytics (operators, live trips, bookings, revenue) — platform-wide (F-22).
- ⬜ Operators management (approve/reject/suspend/ban endpoints + UI).
- ⬜ Trips moderation (force-pause/archive); PENDING_REVIEW queue (F-13).
- ⬜ Slots management + waitlist viewer + admin force-release.
- ⬜ Internal staff management (EDITOR/STAFF/GUIDE invites, role UI, F-05); GUIDE scoped to assigned trips (F-06).
- ⬜ Admin impersonation support tool (F-18); ADMIN sub-roles/departments (F-07); time-limited roles (F-08).

## 21. Frontend — Admin/Operator Dashboard
- ✅ Auth pages (login/signup/forgot/reset); session guard; TanStack Query + RBAC context + nav.
- ✅ Destinations, Categories (full: list/new/edit/translations/page-content/FAQs); Hubs (list/new/edit).
- ✅ Trips (list + multi-tab create/edit form); Media; Settings; Profile; dashboard RBAC; force-delete dialogs.
- ⚠️ Placeholder pages (UI only, no API): Users, Bookings, Payments, Reviews, Analytics, Activities, Blogs, Enquiries, Leads, Partners, Pickup-drops.
- ⬜ Real Users/Operators/Slots/Waitlist/Payouts pages; hub translation tabs; stats wired to real API.
- ⬜ Google OAuth button; become-operator page.

## 22. Frontend — Public Traveler Site *(Phase 11 — not started)*
- ⬜ Slug-resolver route + page components (destination, category, hub, collection, tour, all-tours).
- ⬜ Homepage (hero/featured/category grid); category browse; trip detail; search page.
- ⬜ Booking form; trip cards (featured badges + CRO badges); ISR/`generateStaticParams`.
- ⬜ User booking history + account/profile pages.
- ⬜ Slot picker + TTL countdown + race-condition modal + offer banner (Phase 13); 6-step trip wizard (Phase 14).

## 23. SEO & CRO
- ✅ CRO columns + response exposure (bookingCount/today/spotsRemaining/lastBookedAt); Recommended sort uses bookingCount.
- ⚠️ CRO counters inert (always 0/null until bookings module writes them).
- ⬜ JSON-LD per page type, breadcrumbs (uses primaryCategoryId), per-locale XML sitemaps, internal linking — frontend; data ready.
- ⬜ Per-locale Open Graph; no-prefix → 302 locale fallback.

## 24. Security & Compliance *(Missing Features — all ⬜)*
- ⬜ MFA/TOTP for staff (F-01); password policy + breach detection (F-04); session list + revoke (F-02); login audit + anomaly alerts (F-03).
- ⬜ GDPR erasure + data export (F-15); financial record retention (F-16); emergency kill-switch/feature flags (F-17).

---

> Source of truth for granular status: `MASTER-CHECKLIST.md` (354 tasks). Architecture: `02-architecture/PLATFORM-ARCHITECTURE-V2.md`. Slug detail: `SLUG-REGISTRY.md`. V2 migration: `06-v2-backend-migration/`.
