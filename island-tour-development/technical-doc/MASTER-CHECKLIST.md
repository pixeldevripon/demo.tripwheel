# Island Tours — Master Implementation Checklist

> **Legend:** ✅ Implemented · ⬜ Not implemented · ⚠️ Partial / placeholder UI only  
> **Source of truth:** Implementation status verified against the actual codebase on 2026-05-30. Last updated: 2026-05-30.  
> Items are sorted by phase then priority. Within each phase, critical-path items appear first.

---

## Table of Contents

- [Phase 0 — Project Structure](#phase-0--project-structure)
- [Phase 1 — Environment Setup](#phase-1--environment-setup)
- [Phase 2 — Prisma Schema](#phase-2--prisma-schema)
- [Phase 3 — Authentication & Authorization](#phase-3--authentication--authorization)
- [Phase 4 — Backend Core Modules](#phase-4--backend-core-modules)
- [Phase 5 — Slot Economy](#phase-5--slot-economy)
- [Phase 6 — Waitlist System](#phase-6--waitlist-system)
- [Phase 7 — BullMQ Background Jobs](#phase-7--bullmq-background-jobs)
- [Phase 8 — Real-Time SSE Gateway](#phase-8--real-time-sse-gateway)
- [Phase 9 — Frontend: Project Structure & TanStack Query](#phase-9--frontend-project-structure--tanstack-query)
- [Phase 10 — Frontend: Auth Integration](#phase-10--frontend-auth-integration)
- [Phase 11 — Frontend: Traveler Pages](#phase-11--frontend-traveler-pages)
- [Phase 12 — Frontend: Admin / Operator Dashboard](#phase-12--frontend-admin--operator-dashboard)
- [Phase 13 — Frontend: Slot Picker](#phase-13--frontend-slot-picker)
- [Phase 14 — Frontend: Trip Creation Wizard](#phase-14--frontend-trip-creation-wizard)
- [Phase 15 — Edge Cases](#phase-15--edge-cases)
- [Phase 16 — Notifications](#phase-16--notifications)
- [Phase 17 — Admin Panel — Moderation & Management](#phase-17--admin-panel--moderation--management)
- [Phase 18 — Wishlist](#phase-18--wishlist)
- [Phase 19 — V2 Discovery & SEO Alignment](#phase-19--v2-discovery--seo-alignment)
- [Missing Features — Industry-Best & Business Requirements](#missing-features--industry-best--business-requirements)

---

## Phase 0 — Project Structure

| # | Task | Status |
|---|---|---|
| 0.1 | Monorepo layout (backend/ + frontend/ in single repo, no Turborepo) | ✅ |
| 0.2 | Backend — `src/` with domain module folders | ✅ |
| 0.3 | Frontend — Next.js 15 App Router with `(auth)` and `(dashboard)` route groups | ✅ |
| 0.4 | Split Prisma schema (16 `.prisma` files in `backend/prisma/`) | ✅ |

---

## Phase 1 — Environment Setup

| # | Task | Status |
|---|---|---|
| 1.1 | Backend `.env` with all required variables (DB, Better Auth, Redis, Cloudinary, SMTP, OAuth) | ✅ |
| 1.2 | Frontend `.env.local` with `NEXT_PUBLIC_BACKEND_URL` and `BACKEND_API_URL` | ✅ |
| 1.3 | Backend packages installed (better-auth, @nestjs/bullmq, bullmq, ioredis) | ✅ |
| 1.4 | Frontend packages installed (@tanstack/react-query, better-auth client) | ✅ |
| 1.5 | `env.validate.ts` — fails fast on missing env vars before Nest boots | ✅ |
| 1.6 | Local Redis for development (Docker or Upstash) | ✅ |

---

## Phase 2 — Prisma Schema

| # | Task | Status |
|---|---|---|
| 2.1 | `schema.prisma` — generator + datasource entry file | ✅ |
| 2.2 | `enums.prisma` — Role, TripStatus, SlotStatus, BookingStatus, WaitlistStatus, OperatorVerificationStatus | ✅ |
| 2.3 | `user.prisma` — User, Session, Account, Verification (Better Auth-compatible table names) | ✅ |
| 2.4 | `operators.prisma` — Operator, OperatorCompanyInfo, OperatorSocialMedia, OperatorStripeConfig, OperatorMollieConfig | ✅ |
| 2.5 | `destinations.prisma` — Destination, Hub, HubAllowedCategory, HubOurPick, HubContent, FeaturedExperience | ✅ |
| 2.6 | `categories.prisma` — Category, CategoryTranslation, CategoryPageContent | ✅ |
| 2.7 | `trips.prisma` — Trip + all child models (TourImage, TourSchedule, TourAgeBand, TourAddOn, TourHighlight, TourInclusion, etc.) | ✅ |
| 2.8 | `featured-slots.prisma` — FeaturedSlot, SlotLock, SlotHistory | ✅ |
| 2.9 | `waitlist.prisma` — WaitlistEntry | ✅ |
| 2.10 | `bookings.prisma` — Booking | ✅ |
| 2.11 | `reviews.prisma` — Review | ✅ |
| 2.12 | `wishlist.prisma` — Wishlist | ✅ |
| 2.13 | `faq.prisma` — Faq (polymorphic: pageType + entityId discriminator) | ✅ |
| 2.14 | `slug-registry.prisma` — SlugRegistry | ✅ |
| 2.15 | `media-gallery.prisma` — MediaGallery | ✅ |
| 2.16 | `settings.prisma` — SiteInfo, SiteSEO, SocialMedia, SMTP, Mailchimp, StripeConfiguration, mollieConfiguration | ✅ |
| 2.17 | `webhooks.prisma` — Webhooks, WebhookPoint | ✅ |
| 2.18 | Migrations run (`prisma migrate dev`) | ✅ |
| 2.19 | Seed script (`backend/prisma/seed.ts`) — admin user + starter categories + 3 FeaturedSlot rows per category | ✅ |
| 2.20 | Wishlist model added before first migration (not after — would require separate migration) | ✅ |

---

## Phase 3 — Authentication & Authorization

| # | Task | Status |
|---|---|---|
| 3.1 | Better Auth instance (`auth.instance.ts`) — email/password + Google OAuth + session config | ✅ |
| 3.2 | Auth controller — mounts all Better Auth routes at `/api/auth/*` via `toNodeHandler` | ✅ |
| 3.3 | `AuthGuard` — reads `better-auth.session_token` cookie or Bearer token; populates `request.user` | ✅ |
| 3.4 | `RolesGuard` — checks `@Roles()` metadata | ✅ |
| 3.5 | `PermissionsGuard` — checks `@RequirePermissions()` metadata | ✅ |
| 3.6 | `@Roles()` decorator | ✅ |
| 3.7 | `@RequirePermissions()` decorator | ✅ |
| 3.8 | `@Public()` decorator — marks endpoints that skip `AuthGuard` | ✅ |
| 3.9 | `@AuthenticatedUser()` param decorator | ✅ |
| 3.10 | `@SkipThrottle()` decorator — for webhook endpoints | ✅ |
| 3.11 | `ThrottlerGuard` — 3-tier rate limiting (20 req/s · 300 req/min · 3000 req/hr) in `AuthModule` | ✅ |
| 3.12 | CORS — `credentials: true` + `parseCorsOrigins()` in `main.ts` and `auth.instance.ts` | ✅ |
| 3.13 | `ROLE_PERMISSIONS` map in `backend/src/config/roles.config.ts` (6 roles, 80+ permissions) | ✅ |
| 3.14 | `auth.types.ts` — `AuthenticatedRequest`, `TypedAuthUser` typed interfaces | ✅ |
| 3.15 | `AuthModule` imported in `AppModule`; ThrottlerGuard fires before AuthGuard | ✅ |
| 3.16 | Auto-create guest USER account on first booking (with temp password emailed) | ⬜ |

---

## Phase 4 — Backend Core Modules

### 4.0 — App Setup

| # | Task | Status |
|---|---|---|
| 4.0.1 | `AppModule` — registers all domain modules, global `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`) | ✅ |
| 4.0.2 | `PrismaService` — `@Global()`, injected into every service without re-importing PrismaModule | ✅ |
| 4.0.3 | `HttpExceptionFilter` — global exception filter with consistent error response shape | ✅ |
| 4.0.4 | Swagger (`@nestjs/swagger`) — available at `/api/docs`; all endpoints documented | ✅ |

### 4.1 — Users Module

| # | Task | Status |
|---|---|---|
| 4.1.1 | `UsersService` — `findAll`, `findOne`, `update`, `deactivate` (soft delete) | ✅ |
| 4.1.2 | `UsersController` — CRUD routes protected by `MANAGE_USERS` permission | ✅ |
| 4.1.3 | Swagger docs for all user endpoints | ✅ |

### 4.2 — Settings Module

| # | Task | Status |
|---|---|---|
| 4.2.1 | `SettingsService` — manage SiteInfo, SiteSEO, SMTP, Mailchimp, Stripe, Mollie, social media configs | ✅ |
| 4.2.2 | `SettingsController` — all settings endpoints with `MANAGE_SETTINGS` permission guard | ✅ |
| 4.2.3 | Unit tests (`settings.service.spec.ts`, `settings.controller.spec.ts`) | ✅ |

### 4.3 — Operators Module

| # | Task | Status |
|---|---|---|
| 4.3.1 | `OperatorsService.apply()` — creates `Operator` record with `UNVERIFIED` status | ✅ |
| 4.3.2 | `OperatorsService.approve()` — sets `verificationStatus = VERIFIED`, promotes `User.role = TOUR_OPERATOR` | ✅ |
| 4.3.3 | `OperatorsService.reject()` — sets `verificationStatus = REJECTED` | ✅ |
| 4.3.4 | `OperatorsService.getProfile()` — operator profile with trips and slot holdings | ✅ |
| 4.3.5 | `OperatorsController` — `/operators/apply`, `/operators/me`, `/operators/:id/approve`, `/operators/:id/reject` | ✅ |
| 4.3.6 | Unit tests (`operators.service.spec.ts`, `operators.controller.spec.ts`) | ✅ |

### 4.4 — Destinations Module

| # | Task | Status |
|---|---|---|
| 4.4.1 | `DestinationsService` — `findAll`, `findOne`, `create`, `update`, `deactivate` (soft delete guard for `isSeeded`) | ✅ |
| 4.4.2 | Translation sub-resource — `upsertTranslation`, `deleteTranslation` (blocks delete on `en` locale) | ✅ |
| 4.4.3 | Page content sub-resource — `upsertPageContent` | ✅ |
| 4.4.4 | FAQs sub-resource — `createFaq`, `updateFaq`, `deleteFaq`, `reorderFaqs` | ✅ |
| 4.4.5 | `DestinationsController` — full REST with nested translation/faq/page-content routes | ✅ |
| 4.4.6 | Unit tests (`destinations.service.spec.ts`, `destinations.controller.spec.ts`) | ✅ |
| 4.4.7 | Force delete (`DELETE /destinations/:id/force`) — permanently removes inactive, non-seeded destination; clears all `slug_registry` rows for that destination slug; Prisma cascade handles hubs, translations, FAQs, page content; guarded by `MANAGE_SYSTEM` | ✅ |

### 4.5 — Categories Module

| # | Task | Status |
|---|---|---|
| 4.5.1 | `CategoriesService.create()` — creates category + 3 FeaturedSlot rows + `slug_registry` row per active destination (all in one transaction) | ✅ |
| 4.5.2 | `CategoriesService` — `findAll`, `findOne`, `update`, `deactivate` | ✅ |
| 4.5.3 | Translation sub-resource — upsert + delete (blocks `en` delete) | ✅ |
| 4.5.4 | Page content sub-resource | ✅ |
| 4.5.5 | FAQs sub-resource | ✅ |
| 4.5.6 | `CategoriesController` — full REST + nested routes | ✅ |
| 4.5.7 | Unit tests | ✅ |
| 4.5.8 | Force delete (`DELETE /categories/:id/force`) — permanently removes inactive, non-seeded category; explicitly deletes SlotLock → SlotHistory → WaitlistEntry → FeaturedSlot → SlugRegistry in order (no cascade defined); Prisma cascade then handles translations, FAQs, page content; guarded by `MANAGE_SYSTEM` | ✅ |

### 4.6 — Hubs Module

| # | Task | Status |
|---|---|---|
| 4.6.1 | `HubsService` — `create` (writes one `slug_registry` row for the hub's destination in same transaction), `findAll`, `findOne`, `update`, `deactivate` | ✅ |
| 4.6.2 | `HubsController` — full REST routes | ✅ |
| 4.6.3 | Unit tests (`hubs.service.spec.ts`, `hubs.controller.spec.ts`) | ✅ |

### 4.7 — Slug Registry Module

| # | Task | Status |
|---|---|---|
| 4.7.1 | `SlugRegistryService` — `resolve(destinationSlug, slug)` → returns entity type + id | ✅ |
| 4.7.2 | `SlugRegistryController` — public lookup endpoint for frontend router | ✅ |

### 4.8 — Media Gallery Module

| # | Task | Status |
|---|---|---|
| 4.8.1 | `CloudinaryService` — upload, delete, transform | ✅ |
| 4.8.2 | `MediaGalleryService` — CRUD for media assets with Cloudinary integration | ✅ |
| 4.8.3 | `MediaGalleryController` — upload + manage endpoints | ✅ |
| 4.8.4 | `MediaUploadProcessor` — BullMQ processor for async media jobs | ✅ |
| 4.8.5 | Unit tests | ✅ |

### 4.9 — Mail Module

| # | Task | Status |
|---|---|---|
| 4.9.1 | `MailService` — Nodemailer transporter with SMTP config from `Settings` | ✅ |
| 4.9.2 | Email template: email verification | ✅ |
| 4.9.3 | Email template: password reset | ✅ |
| 4.9.4 | Email template: new guest credentials (auto-created USER on booking) | ⬜ |
| 4.9.5 | Email template: booking confirmation (sent to traveler + operator + admin) | ⬜ |
| 4.9.6 | Email template: booking cancellation | ⬜ |
| 4.9.7 | Email template: slot offer available (waitlist) | ⬜ |
| 4.9.8 | Email template: slot offer expired (no action in 24h) | ⬜ |
| 4.9.9 | Email template: 90-day slot cap expired | ⬜ |
| 4.9.10 | Email template: pre-departure notification (24h before) | ⬜ |

### 4.10 — Trips Module

| # | Task | Status |
|---|---|---|
| 4.10.1 | `TripsService.create()` — creates trip as DRAFT; resolves `operatorId` from `userId` via `resolveOperatorId()` | ✅ |
| 4.10.2 | `TripsService.update()` — validates ownership; blocks `categoryId` change while holding featured slot | ✅ |
| 4.10.3 | `TripsService.getMyTrips()` — operator's own trips with status + server-side search + featured slot rank | ✅ |
| 4.10.4 | `TripsService.findLive()` — public live trips with filter params (category, price, date, search) | ✅ |
| 4.10.5 | `TripsService.findBySlug()` — trip detail with operator, reviews, slot rank | ✅ |
| 4.10.6 | `TripsService.publish()` — changes status to LIVE (calls `SlotsService` if featured slot selected) | ✅ |
| 4.10.7 | `TripsService.pause()` — sets PAUSED; Phase 5 hook stub for `SlotsService.releaseSlot()` in place | ⚠️ |
| 4.10.8 | `TripsService.unpause()` — restores to LIVE | ✅ |
| 4.10.9 | `TripsService.archive()` — sets ARCHIVED; Phase 5 hook stub for `SlotsService.releaseSlot()` in place | ⚠️ |
| 4.10.10 | Admin lifecycle bypass — `publish`, `pause`, `archive` skip ownership check when `userRole === ADMIN` | ✅ |
| 4.10.11 | `resolveOperatorId()` helper — resolves `userId → operatorId`; auto-provisions operator for ADMIN | ✅ |
| 4.10.12 | Child entities controller (`trips-children.controller.ts`) — schedules, images, highlights, inclusions, add-ons, age bands | ✅ |
| 4.10.13 | `TripsController` — all CRUD + lifecycle routes | ✅ |
| 4.10.14 | Swagger docs (`trips.swagger.ts`) | ✅ |
| 4.10.15 | `PENDING_REVIEW` status resolved — decide DRAFT→LIVE directly or DRAFT→PENDING_REVIEW→LIVE | ⬜ |
| 4.10.16 | `findOne()` ownership bug fixed — compares `operatorId` not raw `userId` | ✅ |
| 4.10.17 | Admin all-trips endpoint (`GET /trips/admin/all`) — filters by status, operatorId, search | ✅ |
| 4.10.18 | Featured slot rank (`featuredSlotNumber`, `featuredSlotStatus`) included in `findMyTrips()` + `findOne()` | ✅ |
| 4.10.19 | Admin force delete — `remove()` bypasses DRAFT-only restriction for `ADMIN` role; admin can permanently delete LIVE/PAUSED/ARCHIVED trips | ✅ |

### 4.11 — Upload Module *(Gap G4)*

| # | Task | Status |
|---|---|---|
| 4.11.1 | `UploadService.uploadFile()` — uploads to Cloudinary via Multer; returns `{ url, publicId }` | ⬜ |
| 4.11.2 | `UploadController` — `POST /api/v1/upload` guarded by `UPLOAD_MEDIA` permission | ⬜ |
| 4.11.3 | `UploadModule` imported in `AppModule` | ⬜ |

### 4.12 — Reviews Module *(Gap G5)*

| # | Task | Status |
|---|---|---|
| 4.12.1 | `ReviewsService.create()` — validates booking is `COMPLETED`, belongs to author, no duplicate review | ⬜ |
| 4.12.2 | `ReviewsService.findByTrip()` — paginated public reviews (only `isPublic = true`) | ⬜ |
| 4.12.3 | `ReviewsService.delete()` — operator or admin can delete | ⬜ |
| 4.12.4 | `ReviewsController` — `POST /api/v1/reviews`, `GET /api/v1/trips/:tripId/reviews`, `DELETE /api/v1/reviews/:id` | ⬜ |
| 4.12.5 | `ReviewsModule` imported in `AppModule` | ⬜ |

### 4.13 — Bookings Module

| # | Task | Status |
|---|---|---|
| 4.13.1 | `BookingsService.create()` — creates booking; captures commission rate at booking time; auto-creates guest account if new email | ⬜ |
| 4.13.2 | `BookingsService.confirm()` — called by payment webhook; sets `CONFIRMED`, `paidAt = now()` | ⬜ |
| 4.13.3 | `BookingsService.cancel()` — traveler or operator cancels; triggers gateway refund | ⬜ |
| 4.13.4 | `BookingsService.getMyBookings()` — traveler booking history | ⬜ |
| 4.13.5 | `BookingsService.getOperatorBookings()` — all bookings for operator's trips | ⬜ |
| 4.13.6 | `BookingsController` — all booking routes | ⬜ |
| 4.13.7 | `BookingsModule` imported in `AppModule` | ⬜ |

### 4.14 — Payments Module *(Gap G3)*

| # | Task | Status |
|---|---|---|
| 4.14.1 | `PaymentsService.createCheckoutSession()` — creates Stripe/Mollie/PayPal payment session; returns redirect URL | ⬜ |
| 4.14.2 | `PaymentsService.refund()` — issues refund via gateway stored on booking | ⬜ |
| 4.14.3 | Stripe webhook endpoint — `POST /api/v1/webhooks/stripe`; `@Public()` + `@SkipThrottle()`; verifies signature | ⬜ |
| 4.14.4 | Mollie webhook endpoint — same pattern | ⬜ |
| 4.14.5 | PayPal webhook endpoint — same pattern | ⬜ |
| 4.14.6 | `PaymentsModule` imported in `AppModule` | ⬜ |

### 4.15 — Wishlist Module

| # | Task | Status |
|---|---|---|
| 4.15.1 | `WishlistService.add()` — upsert Wishlist row (idempotent) | ⬜ |
| 4.15.2 | `WishlistService.remove()` — delete; graceful if row doesn't exist | ⬜ |
| 4.15.3 | `WishlistService.getAll()` — all wishlisted trips with trip join | ⬜ |
| 4.15.4 | `WishlistController` — `POST /api/v1/wishlist`, `DELETE /api/v1/wishlist/:tripId`, `GET /api/v1/wishlist` | ⬜ |
| 4.15.5 | `WishlistModule` imported in `AppModule` | ⬜ |

### 4.16 — Admin User Management Module *(F-05)*

> Create and manage platform-internal staff (EDITOR / STAFF / GUIDE roles). Admins invite staff via email; all role changes are server-side only.

| # | Task | Status |
|---|---|---|
| 4.16.1 | `User` schema additions — `invitedBy UUID?`, `invitedAt DateTime?`, `accountStatus` enum (ACTIVE / SUSPENDED / DEACTIVATED) | ⬜ |
| 4.16.2 | `EDITOR`, `STAFF`, `GUIDE` roles in `Role` enum (`enums.prisma`) and `ROLE_PERMISSIONS` map (`roles.config.ts`) | ⬜ |
| 4.16.3 | `AdminUsersService.inviteStaff()` — creates user account with temporary password; sets `invitedBy + invitedAt`; sends invite email | ⬜ |
| 4.16.4 | `AdminUsersService.updateRole()` — changes role; blocks `ADMIN` assignment via API; logs change | ⬜ |
| 4.16.5 | `AdminUsersService.deactivate()` — soft-deactivates account (`accountStatus = DEACTIVATED`); revokes active sessions | ⬜ |
| 4.16.6 | `AdminUsersController` — `POST /admin/staff`, `GET /admin/users`, `PATCH /admin/users/:id/role`, `DELETE /admin/users/:id`; all guarded by `MANAGE_USERS` | ⬜ |
| 4.16.7 | Email template: staff invite — credentials + assigned role + dashboard link | ⬜ |
| 4.16.8 | `AdminUsersModule` imported in `AppModule` | ⬜ |

### 4.17 — Operator Team Management Module *(F-12)*

> Multi-seat operator accounts. An OWNER can invite MANAGER / STAFF members who act within the operator's account scope.

| # | Task | Status |
|---|---|---|
| 4.17.1 | `OperatorTeamMember` schema — `id`, `operatorId`, `userId`, `teamRole` (OWNER / MANAGER / STAFF), `invitedBy`, `invitedAt`, `status` (PENDING / ACTIVE / REVOKED) | ⬜ |
| 4.17.2 | `teamRole` enum added to `enums.prisma` | ⬜ |
| 4.17.3 | `OperatorTeamService.invite()` — creates PENDING record; sends invite email with accept token | ⬜ |
| 4.17.4 | `OperatorTeamService.acceptInvite()` — validates token; creates User if new; sets status ACTIVE | ⬜ |
| 4.17.5 | `OperatorTeamService.updateRole()` — OWNER only; blocks self-demotion below OWNER | ⬜ |
| 4.17.6 | `OperatorTeamService.revoke()` — sets status REVOKED; revokes sessions | ⬜ |
| 4.17.7 | `OperatorTeamService.listMembers()` — returns all team members for current operator | ⬜ |
| 4.17.8 | `OperatorTeamController` — `GET /operators/team`, `POST /operators/team/invite`, `PATCH /operators/team/:id/role`, `DELETE /operators/team/:id` | ⬜ |
| 4.17.9 | Accept-invite public endpoint — `POST /operators/team/accept/:token`; `@Public()` | ⬜ |
| 4.17.10 | `resolveOperatorId()` in `TripsService` updated — resolves for active team members (maps `userId → operatorId` via `OperatorTeamMember`) | ⬜ |
| 4.17.11 | Email template: operator team invite | ⬜ |
| 4.17.12 | `OperatorTeamModule` imported in `AppModule` | ⬜ |

---

## Phase 5 — Slot Economy

> **Status: Not started.** This is the most critical unimplemented phase — all slot-related frontend depends on it.

| # | Task | Status |
|---|---|---|
| 5.1 | `SlotsModule` — registers `slot-ttl` BullMQ queue; exports `SlotsService` and `SlotEventsService` | ⬜ |
| 5.2 | `SlotsService.lockSlot()` — Prisma transaction: check AVAILABLE → create SlotLock → update to SOFT_LOCKED → write SlotHistory → schedule BullMQ TTL job → publish Redis event | ⬜ |
| 5.3 | `SlotsService.publishTrip()` — race condition guard: atomic `updateMany` with `WHERE status = SOFT_LOCKED` → if count=0 throw 409 `SLOT_TAKEN` → update HARD_RESERVED → set Trip to LIVE → cancel TTL job → schedule 90-day cap job → publish Redis event | ⬜ |
| 5.4 | `SlotsService.releaseSlot()` — set AVAILABLE → delete SlotLock → write SlotHistory → publish Redis event → offer to first WAITING waitlist entry | ⬜ |
| 5.5 | `SlotsService.getSlotsByCategory()` — returns all 3 FeaturedSlot rows for a category with current status | ⬜ |
| 5.6 | `SlotsController` — `GET /slots/category/:categoryId`, `POST /slots/:slotId/lock`, `DELETE /slots/:slotId/lock` | ⬜ |
| 5.7 | `SlotsModule` imported in `AppModule` | ⬜ |

---

## Phase 6 — Waitlist System

| # | Task | Status |
|---|---|---|
| 6.1 | `WaitlistService.joinQueue()` — create `WaitlistEntry { status: WAITING }`; return with position count | ⬜ |
| 6.2 | `WaitlistService.offerSlot()` — update to OFFERED; schedule 24h BullMQ expiry job; store `offerJobId`; send email notification; publish Redis per-operator event | ⬜ |
| 6.3 | `WaitlistService.claimOffer()` — validate OFFERED + not expired; re-check slot AVAILABLE; in transaction: update to CLAIMED; call `SlotsService.lockSlot()`; cancel BullMQ expiry job | ⬜ |
| 6.4 | `WaitlistService.passOffer()` — update to WAITING (keeps position); cancel BullMQ job; offer to next in FIFO queue | ⬜ |
| 6.5 | `WaitlistController` — `POST /waitlist/join`, `POST /waitlist/:id/claim`, `POST /waitlist/:id/pass`, `DELETE /waitlist/:id`, `GET /waitlist/my-entries`, `GET /waitlist/eta/:categoryId` | ⬜ |
| 6.6 | `WaitlistModule` imported in `AppModule` | ⬜ |
| 6.7 | Skip-paid queue jump (max 3 skips per entry) — gate behind future payment feature flag *(Gap G6)* | ⬜ |

---

## Phase 7 — BullMQ Background Jobs

| # | Task | Status |
|---|---|---|
| 7.1 | `SlotTtlProcessor` — handles `release-lock` job (TTL expired → `releaseSlot`) and `expire-cap` job (90-day cap → `releaseSlot` + email to operator) | ⬜ |
| 7.2 | `WaitlistOfferProcessor` — handles `expire-offer` job (offer not claimed → update to EXPIRED → offer to next in FIFO) | ⬜ |
| 7.3 | `WorkersModule` — registers `slot-ttl` + `waitlist-offers` queues; imports `SlotsModule` + `WaitlistModule` | ⬜ |
| 7.4 | `WorkersModule` imported in `AppModule` | ⬜ |
| 7.5 | Pre-departure job — BullMQ job scheduled at `TripSchedule` creation; fires at `schedule.date - 24h`; activates last-minute badges, optionally blocks new bookings | ⬜ |
| 7.6 | Store `bullJobId` on `SlotLock` and `offerJobId` on `WaitlistEntry` for early cancellation | ✅ *(schema done, wiring pending)* |

---

## Phase 8 — Real-Time SSE Gateway

| # | Task | Status |
|---|---|---|
| 8.1 | `SlotEventsService` — dedicated Redis subscriber connection (`ioredis`); `getStream(categoryId)` returns `Observable<MessageEvent>` | ⬜ |
| 8.2 | Separate publisher connection in `SlotsService` — pub/sub rule: subscriber and publisher must be separate Redis connections | ⬜ |
| 8.3 | SSE endpoint on `SlotsController` — `@Sse()` `GET /slots/stream?categoryId=` | ⬜ |
| 8.4 | Resolve Gap G12 — pick one approach: 60s polling OR per-operator SSE channel (`slot-offer:{operatorId}`) for waitlist offer notifications | ⬜ |

---

## Phase 9 — Frontend: Project Structure & TanStack Query

| # | Task | Status |
|---|---|---|
| 9.1 | Auth client (`lib/auth-client.ts`) — `createAuthClient()` pointing to NestJS backend | ✅ |
| 9.2 | TanStack Query setup — `QueryClientProvider` + `ReactQueryDevtools` in root `providers.tsx` | ✅ |
| 9.3 | API client helper (`lib/api/`) — per-module files with `credentials: 'include'` and typed errors | ✅ |
| 9.4 | All TanStack Query hooks (`hooks/<module>/use-<module>.ts`) — categories, destinations, hubs, trips, media, profile | ✅ |
| 9.5 | All TypeScript type definitions (`types/<module>.ts`) — category, destination, hub, trip, media, profile | ✅ |
| 9.6 | RBAC config (`lib/config/rbac.ts`) — mirrors backend `ROLE_PERMISSIONS` map | ✅ |
| 9.7 | RBAC utility (`lib/rbac-utils.ts`) — `hasPermission`, `hasAnyPermission` helpers | ✅ |
| 9.8 | Role context (`contexts/role-context.tsx`) — `RoleProvider` + `useRole()` hook (`can`, `canAny`) | ✅ |
| 9.9 | Navigation config (`navigations/navigations.ts`) — sidebar nav items with permission filtering | ✅ |
| 9.10 | App directory structure — `(auth)`, `(dashboard)` route groups, `onboarding` | ✅ |
| 9.11 | Route middleware (`middleware.ts`) — guards `/dashboard` routes; redirects unauthenticated users | ✅ |
| 9.12 | `(public)` route group for traveler pages (homepage, trip detail, search) | ⬜ |
| 9.13 | `lib/api/slots.ts` — slot API client | ⬜ |
| 9.14 | `lib/api/bookings.ts` — bookings API client | ⬜ |
| 9.15 | `lib/api/wishlist.ts` — wishlist API client | ⬜ |
| 9.16 | `hooks/slots/use-slots.ts` — slot query + lock mutation | ⬜ |
| 9.17 | `hooks/bookings/use-bookings.ts` | ⬜ |
| 9.18 | `types/slot.ts`, `types/booking.ts`, `types/wishlist.ts` | ⬜ |

---

## Phase 10 — Frontend: Auth Integration

| # | Task | Status |
|---|---|---|
| 10.1 | Login page (`app/(auth)/login/page.tsx`) — email + password via `signIn.email()` | ✅ |
| 10.2 | Signup page (`app/(auth)/signup/page.tsx`) — operator self-registration via `signUp.email()` | ✅ |
| 10.3 | Forgot password page (`app/(auth)/forgot-password/page.tsx`) | ✅ |
| 10.4 | Reset password page (`app/(auth)/reset-password/page.tsx`) | ✅ |
| 10.5 | Google OAuth sign-in button on login/signup pages | ⬜ |
| 10.6 | Become-operator page (`app/become-operator/page.tsx`) — form submits to `/operators/apply`; shows pending state after submission *(Gap G9)* | ⬜ |
| 10.7 | Dashboard layout session guard — redirect to `/login` if no valid session | ✅ |

---

## Phase 11 — Frontend: Traveler Pages

> **Status: Not started.** No `(public)` route group exists. All traveler-facing pages are missing.

| # | Task | Status |
|---|---|---|
| 11.1 | Homepage (`app/(public)/page.tsx`) — hero carousel with top featured trip (Slot 1), category grid | ⬜ |
| 11.2 | Category browse page (`app/(public)/[destinationSlug]/[categorySlug]/page.tsx`) — trips with featured badge ordering | ⬜ |
| 11.3 | Trip detail page (`app/(public)/trips/[slug]/page.tsx`) — hero, booking form, reviews, operator info | ⬜ |
| 11.4 | Search page (`app/(public)/search/page.tsx`) — filter by category, price, date, location, rating | ⬜ |
| 11.5 | `generateStaticParams` for trip detail and category pages (ISR revalidation) | ⬜ |
| 11.6 | `BookingForm` client component — selects departure date, guest count, payment gateway | ⬜ |
| 11.7 | Trip cards component — shows featured badge (Slot 1/2/3), price, rating | ⬜ |
| 11.8 | User booking history page (post-login) | ⬜ |
| 11.9 | User profile / account settings page | ⬜ |

---

## Phase 12 — Frontend: Admin / Operator Dashboard

### 12.1 — Implemented Pages

| # | Task | Status |
|---|---|---|
| 12.1.1 | Dashboard home (`dashboard/page.tsx`) — stats overview, mock data from `dashboardActions.ts` | ✅ |
| 12.1.2 | Destinations list (`dashboard/destinations/page.tsx`) + table with search, filter, pagination | ✅ |
| 12.1.3 | New destination form (`dashboard/destinations/new/page.tsx`) + slug auto-generation | ✅ |
| 12.1.4 | Destination edit (`dashboard/destinations/[id]/edit/page.tsx`) | ✅ |
| 12.1.5 | Destination translations (`dashboard/destinations/[id]/translations/page.tsx`) | ✅ |
| 12.1.6 | Destination page content (`dashboard/destinations/[id]/page-content/page.tsx`) | ✅ |
| 12.1.7 | Destination FAQs (`dashboard/destinations/[id]/faqs/page.tsx`) | ✅ |
| 12.1.8 | Categories list + new + edit + translations + FAQs + page-content (full set) | ✅ |
| 12.1.9 | Hubs list + new + edit (partial — no translation/faq tabs yet) | ✅ |
| 12.1.10 | Trips list (`dashboard/trips/page.tsx`) + table with server-side search, status filter, RBAC-gated actions | ✅ |
| 12.1.11 | New trip form (`dashboard/trips/new/page.tsx`) — multi-tab form (details, pricing, images, schedules, languages, translations) | ✅ |
| 12.1.12 | Trip edit (`dashboard/trips/[id]/edit/page.tsx`) — same multi-tab form; archive confirmation dialog; real EN overview readiness check | ✅ |
| 12.1.13 | Media gallery page (`dashboard/media/page.tsx`) | ✅ |
| 12.1.14 | Settings page (`dashboard/settings/page.tsx`) with system sub-section | ✅ |
| 12.1.15 | Profile page (`dashboard/profile/page.tsx`) | ✅ |
| 12.1.16 | Dashboard RBAC — `useRole().can()` gates Add buttons, bulk Delete, row-action Delete, Danger Zone | ✅ |
| 12.1.17 | `ForceDeleteDialog` common component (`components/dashboard/common/force-delete-dialog.tsx`) — shared destructive confirmation with entity name, consequence note, and irreversibility warning | ✅ |
| 12.1.18 | Force delete in destination and category row actions — admin-only, visible only on inactive non-seeded entities; hooks `useForceDeleteDestination` / `useForceDeleteCategory` wired to `DELETE /:id/force` API | ✅ |
| 12.1.19 | Force delete in trip row actions — admin-only on non-DRAFT trips; `TripDeleteDialog` adapted with `isForce` prop for distinct warning copy | ✅ |

### 12.2 — Placeholder Pages (UI shell only — no real API integration)

| # | Task | Status |
|---|---|---|
| 12.2.1 | Users list page (`dashboard/users/page.tsx`) | ⚠️ |
| 12.2.2 | Bookings page (`dashboard/bookings/page.tsx`) | ⚠️ |
| 12.2.3 | Payments page (`dashboard/payments/page.tsx`) | ⚠️ |
| 12.2.4 | Reviews page (`dashboard/reviews/page.tsx`) | ⚠️ |
| 12.2.5 | Analytics page (`dashboard/analytics/page.tsx`) | ⚠️ |
| 12.2.6 | Activities page (`dashboard/activities/page.tsx`) + new | ⚠️ |
| 12.2.7 | Blogs page (`dashboard/blogs/page.tsx`) + new | ⚠️ |
| 12.2.8 | Enquiries page (`dashboard/enquiries/page.tsx`) | ⚠️ |
| 12.2.9 | Leads page (`dashboard/leads/page.tsx`) | ⚠️ |
| 12.2.10 | Partners page (`dashboard/partners/page.tsx`) + new | ⚠️ |
| 12.2.11 | Pickup / drop-off points page (`dashboard/pickup-drops/page.tsx`) + new | ⚠️ |

### 12.3 — Missing Dashboard Pages

| # | Task | Status |
|---|---|---|
| 12.3.1 | Operators management page — list, approve/reject/suspend/ban with real API | ⬜ |
| 12.3.2 | Featured slots management page — all slots across all categories, current holder, waitlist depth | ⬜ |
| 12.3.3 | Waitlist viewer page — FIFO queue per slot with claim/pass/leave actions | ⬜ |
| 12.3.4 | Operator dashboard — "My Slots" view (slot status, waitlist position, pending offer banner) | ⬜ |
| 12.3.5 | Operator dashboard — Payouts / earnings page | ⬜ |
| 12.3.6 | Hub edit translation/faq/page-content tabs (same pattern as destinations) | ⬜ |
| 12.3.7 | Dashboard stats wired to real API (replace `dashboardActions.ts` mock) | ⬜ |

### 12.4 — Admin User & Team Management UI *(F-05 / F-12)*

| # | Task | Status |
|---|---|---|
| 12.4.1 | Admin users page — replace placeholder (`12.2.1`) with real API; list EDITOR/STAFF/GUIDE users; filter by role + status; show `invitedBy`, `accountStatus` badge | ⬜ |
| 12.4.2 | Invite staff dialog — role selector (EDITOR / STAFF / GUIDE only; ADMIN blocked); email input; submits to `POST /admin/staff` | ⬜ |
| 12.4.3 | Edit user role dialog — change role with confirmation; ADMIN option excluded from dropdown | ⬜ |
| 12.4.4 | Deactivate user action — row-action "Deactivate" calls `DELETE /admin/users/:id`; confirmation dialog | ⬜ |
| 12.4.5 | Operator team management page (`dashboard/settings/team`) — list team members with role badge + status; invite and revoke actions | ⬜ |
| 12.4.6 | Invite team member modal — email + role (MANAGER / STAFF); submits to `POST /operators/team/invite` | ⬜ |
| 12.4.7 | Change team member role dialog — OWNER only; blocks self-demotion | ⬜ |
| 12.4.8 | Accept-invite page (`/invite/[token]`) — public page; new invitees set password + activate account | ⬜ |
| 12.4.9 | GUIDE assigned trips tab — "Guides" tab on trip edit page; list assigned guides; assign/remove via `POST/DELETE /trips/:id/guides` | ⬜ |

---

## Phase 13 — Frontend: Slot Picker

> **Status: Not started.** Depends on Phase 5 (backend slot economy).

| # | Task | Status |
|---|---|---|
| 13.1 | `hooks/use-slot-stream.ts` — opens SSE connection via `EventSource`; updates TanStack Query cache on `slot.locked`, `slot.released`, `slot.taken` events | ⬜ |
| 13.2 | `SlotPicker` component — shows 3 slot cards with live status; "Reserve slot" triggers `lockSlot` mutation | ⬜ |
| 13.3 | `TTLCountdown` component — real-time countdown; turns red below 2 minutes; fires `onExpired` callback at zero | ⬜ |
| 13.4 | `AllSlotsTakenView` — shows all 3 slots as taken; estimated wait times from `GET /waitlist/eta/:categoryId`; "Join queue" per slot | ⬜ |
| 13.5 | `RaceConditionModal` — shown on 409 `SLOT_TAKEN`; options: pick again, publish as standard, join waitlist | ⬜ |
| 13.6 | `OfferBanner` — shown when a waitlist entry has `status === OFFERED`; countdown + claim/pass buttons | ⬜ |

---

## Phase 14 — Frontend: Trip Creation Wizard

> **Status: Partial.** `trips/new/page.tsx` renders a `TripForm` (multi-tab) but is not the 6-step featured-slot wizard with `useReducer` state machine.

| # | Task | Status |
|---|---|---|
| 14.1 | `WizardState` + `useReducer` — steps: Details → Pricing → Photos → Visibility → SlotPicker → Review | ⬜ |
| 14.2 | Step 1 — Trip Details (title, category, destination, hub, description) | ⚠️ *(in TripForm)* |
| 14.3 | Step 2 — Pricing (price per person, currency, group size limits, duration) | ⚠️ *(in TripForm)* |
| 14.4 | Step 3 — Photos (Cloudinary upload, drag-to-reorder) | ⚠️ *(in TripForm)* |
| 14.5 | Step 4 — Visibility choice (Standard listing vs Featured) | ⬜ |
| 14.6 | Step 5 — Slot Picker (only shown if Featured; skip if Standard) | ⬜ |
| 14.7 | Step 6 — Review & publish confirmation (shows TTL countdown if slot locked) | ⬜ |
| 14.8 | `SLOT_EXPIRED` reducer action — clears selected slot, returns to Step 5 | ⬜ |
| 14.9 | `PublishTripButton` with optimistic update + rollback on error + race condition modal | ⬜ |

---

## Phase 15 — Edge Cases

| # | Task | Status |
|---|---|---|
| 15.1 | **EC-01** All slots taken — render `AllSlotsTakenView` with estimated wait times and per-slot queue join | ⬜ |
| 15.2 | **EC-02** Race condition recovery — 409 `SLOT_TAKEN` → `RaceConditionModal` with pick-again / standard / waitlist options | ⬜ |
| 15.3 | **EC-03** TTL expired mid-wizard — SSE `slot.released` event fires `SLOT_EXPIRED` dispatch; server 410 on publish also fires it | ⬜ |
| 15.4 | **EC-04** Editing a live trip — warning banner: "Changes save immediately to the live listing" | ⬜ |
| 15.5 | **EC-05** Pre-departure window (24h before departure) — BullMQ job activates last-minute badge, optionally blocks bookings | ⬜ |
| 15.6 | **EC-06** Pause/archive releases slot automatically — `SlotsService.releaseSlot()` called in `pause()` and `archive()` | ⬜ |
| 15.7 | **EC-07** Waitlist offer banner on operator dashboard — poll `GET /waitlist/my-entries` every 60s; show `OfferBanner` for OFFERED entries | ⬜ |

---

## Phase 16 — Notifications

| # | Task | Status |
|---|---|---|
| 16.1 | `MailService` base implementation — Nodemailer transporter reading SMTP config from Settings DB | ✅ |
| 16.2 | Email verification template | ✅ |
| 16.3 | Password reset template | ✅ |
| 16.4 | Wire `sendCredentials()` into `BookingsService.createGuestAccount()` | ⬜ |
| 16.5 | Wire `sendBookingConfirmation()` into `BookingsService.confirm()` (to traveler + operator + admin) | ⬜ |
| 16.6 | Wire `sendBookingCancellation()` into `BookingsService.cancel()` | ⬜ |
| 16.7 | Wire `sendSlotOffer()` into `WaitlistService.offerSlot()` | ⬜ |
| 16.8 | Wire `sendSlotOfferExpired()` into `WaitlistOfferProcessor` (expire-offer job) | ⬜ |
| 16.9 | Wire `sendSlotCapExpired()` into `SlotTtlProcessor` (expire-cap job) | ⬜ |
| 16.10 | Push notification stub (`PushService`) — logs to console; replaceable with Firebase later | ⬜ |
| 16.11 | Notification config toggles — admin can enable/disable notification types from settings panel | ⬜ |

---

## Phase 17 — Admin Panel: Moderation & Management

| # | Task | Status |
|---|---|---|
| 17.1 | Admin dashboard stats wired to real API (`GET /api/v1/admin/analytics`) — operator count, live trips, bookings today, revenue MTD | ⬜ |
| 17.2 | Operators management — list all operators with status badges; Approve / Reject / Suspend / Ban buttons | ⬜ |
| 17.3 | Backend: `PATCH /admin/operators/:id/suspend` and `/ban` endpoints | ⬜ |
| 17.4 | Trips moderation page — list all trips; Force-Pause / Force-Archive row actions | ⬜ |
| 17.5 | Backend: `POST /admin/trips/:id/force-pause` and `/force-archive` (both call `SlotsService.releaseSlot()`) | ⬜ |
| 17.6 | Trips moderation: `PENDING_REVIEW` tab with Approve / Reject actions (if Option B chosen for Gap G2) | ⬜ |
| 17.7 | Slots management page — all FeaturedSlot rows grouped by category; current holder, `expiresAt`, waitlist depth | ⬜ |
| 17.8 | Backend: `GET /admin/slots` and `POST /admin/slots/:id/override` (admin force-release) | ⬜ |
| 17.9 | Waitlist viewer per slot — expandable drawer showing all WAITING entries in FIFO order | ⬜ |

---

## Phase 18 — Wishlist

| # | Task | Status |
|---|---|---|
| 18.1 | `WishlistModule` — backend service + controller (see Phase 4.15) | ⬜ |
| 18.2 | `WishlistButton` client component — heart icon; toggled via `useMutation`; invisible to guests | ⬜ |
| 18.3 | Place `WishlistButton` on trip cards (category browse) and trip detail hero | ⬜ |
| 18.4 | Wishlist page (`dashboard/wishlist/page.tsx` or user profile) — grid of saved trips | ⬜ |

---

## Missing Features — Industry-Best & Business Requirements

> These were identified as not-yet-planned gaps during documentation review. They are not in the current `IMPLEMENTATION_GUIDE.md` but are required for a production-grade platform. Sorted by priority.

### CRITICAL

| ID | Feature | What to Build |
|---|---|---|
| F-01 | **Multi-Factor Authentication (MFA)** | TOTP (authenticator app) for ADMIN/EDITOR/STAFF/GUIDE. Better Auth plugin `twoFactor`. Enforce at login; bypass on trusted devices via `deviceId` cookie. QR code setup in profile settings. | ⬜ |
| F-05 | **Role Management UI for internal staff** | Admin panel: list all internal users (EDITOR/STAFF/GUIDE), assign roles, deactivate accounts. Backend: `PATCH /admin/users/:id/role` with `MANAGE_USERS` guard. Never expose ADMIN role assignment via UI. | ⬜ |
| F-09 | **Operator KYC / Document Verification** | `OperatorKYC` schema: business registration doc, ID upload, status (PENDING/VERIFIED/REJECTED). Backend: `POST /operators/me/kyc/submit`. Admin review queue. Block trip publishing until KYC verified. | ⬜ |
| F-13 | **Trip Content Moderation Queue** | Implement `PENDING_REVIEW` status — new operators' first N trips go to queue. Backend: approve/reject endpoints. Admin "Pending Review" tab. Email operator when approved or rejected. | ⬜ |
| F-15 | **GDPR Right to Erasure** | `POST /me/deletion-request` (30-day cooling off). Scheduled anonymisation job. `GET /me/data-export` (DSAR download). "Delete my account" + "Export my data" in profile settings. | ⬜ |
| F-17 | **Emergency Kill Switch / Circuit Breaker** | Feature flags in Redis: `bookings_enabled`, `slot_locking_enabled`, `operator_registration_enabled`, `new_trip_publishing_enabled`. `FeatureFlagService` injects 503 when flag off. Admin Settings → Platform Controls toggles. | ⬜ |

### HIGH

| ID | Feature | What to Build |
|---|---|---|
| F-02 | **Session Management & Active Sessions List** | `GET /me/sessions` — list all active sessions with device, location, last-seen. `DELETE /me/sessions/:id` — revoke individual. `DELETE /me/sessions` — sign out all devices. Frontend: Settings → Security. | ⬜ |
| F-03 | **Login Audit Log & Suspicious Login Detection** | Log every login attempt (IP, user agent, result). Flag login from new country/device → send alert email. Admin: view login history per user. Schema: `LoginAuditLog`. | ⬜ |
| F-06 | **GUIDE Role Scoped to Assigned Trips** | Schema: `GuideAssignment { guideUserId, tripId, assignedBy, assignedAt }`. `GET /trips/my-assigned` for GUIDEs. GUIDE can view trip detail and bookings only for assigned trips. | ⬜ |
| F-10 | **Granular Operator Suspension States** | Expand `OperatorVerificationStatus`: ACTIVE / SUSPENDED (temporary, with reason + duration) / CONTENT_REVIEW (can't publish new trips) / BANNED (permanent). Email operator on status change. | ⬜ |
| F-11 | **Operator Contract & Commission Acceptance** | Schema: `OperatorContractAcceptance`. On approval: send ToS. Block publishing until accepted. On rate change: create pending acceptance record; block new publishing after 15 days. | ⬜ |
| F-14 | **Review Moderation & Dispute System** | Add `moderationStatus` to `Review`. `POST /reviews/:id/flag`. Admin moderation queue. Email reviewer when removed. Frontend: "Flag" option on each review; admin flagged filter tab. | ⬜ |
| F-16 | **Financial Record Retention Policy** | `retentionExpiresAt` on `Booking` (createdAt + 7 years). Block deletion while in retention. Scheduled hard-delete job for expired records. Admin settings: retention policy view. | ⬜ |
| F-18 | **Admin Impersonation (Support Tool)** | `POST /admin/impersonate/:userId` — short-lived impersonation token. All actions tagged with `impersonatedBy`. Sticky red banner on every page while impersonating. No destructive actions allowed. | ⬜ |
| F-19 | **Notification Preference Centre** | `NotificationPreference` schema (per user, per type, per channel). Transactional emails non-disableable. Marketing requires opt-in. Frontend: Settings → Notifications grouped by category. | ⬜ |
| F-21 | **Per-Operator Revenue Analytics** | `GET /operators/me/analytics` — bookings, gross/net revenue, by-trip breakdown. `GET /operators/me/analytics/slot-performance` — slot ROI. Frontend: operator overview with charts + date range picker. | ⬜ |
| F-22 | **Platform-Wide Admin Analytics** | `GET /admin/analytics/overview` — GMV, commission, slot fill rate. `GET /admin/analytics/slots` — heatmap from `SlotHistory`. `GET /admin/analytics/operators` — top earners, KYC pipeline. Frontend: admin overview page wired up. | ⬜ |

### MEDIUM

| ID | Feature | What to Build |
|---|---|---|
| F-04 | **Password Policy & Breach Detection** | Min 12 chars for ADMIN/EDITOR, 8 for others. Check against HaveIBeenPwned API on registration. Force ADMIN password change every 90 days. Frontend: password strength meter. | ⬜ |
| F-07 | **ADMIN Sub-roles / Departmental Permissions** | `AdminProfile { departmentRole: SUPER_ADMIN / FINANCE / CONTENT / SUPPORT }`. Department roles restrict which ADMIN permissions are exercised (finance can't edit content, content can't view payments). | ⬜ |
| F-08 | **Time-Limited Role Assignments for Internal Staff** | `expiresAt DateTime?` on role assignment. Scheduled job: expire EDITOR/STAFF/GUIDE roles that have passed. Admin sees expiry on role management page. | ⬜ |
| F-12 | **Multi-Seat Operator Accounts** | `OperatorTeamMember` schema. Owner invites by email. OWNER/MANAGER/STAFF sub-roles within the operator account. Team management UI in operator settings. | ⬜ |
| F-20 | **In-App Notification Centre** | `Notification` schema. `NotificationService.create()` called alongside every email send. Bell icon in dashboard header with unread count. SSE push per-user. All notifications page. | ⬜ |
| F-23 | **Operator API Keys (Programmatic Access)** | `ApiKey` schema (hashed, prefix only for display). `ApiKeyGuard` alternative to session auth. Scoped permissions at key creation. Key management UI in operator settings. | ⬜ |

---

## Phase 19 — V2 Discovery & SEO Alignment

> Brings the codebase in line with `02-architecture/PLATFORM-ARCHITECTURE-V2.md`. Full detail + acceptance checks in `V2-DEVELOPMENT-ALIGNMENT-PLAN.md`. Slot economy retained as-is.

### Workstream A — Additive data-model fields
- ⚠️ Add `Region` enum + `Destination.region` (nullable in Stage 1 → required after backfill) — *schema written + validated; migration not yet applied*
- ⚠️ Add destination fields: country, latitude, longitude, timezone, currency, language, galleryImages, ogImage, parentDestinationId (+ self-relation) — *schema written + validated*
- ⚠️ Add category fields: description, icon, sortOrder, parentCategoryId (+ self-relation), metaTitleTemplate, metaDescriptionTemplate — *schema written + validated*
- ⚠️ Add `HubType` enum (LOCATION/HIGHLIGHT/AREA) + Hub fields: hubType, latitude, longitude — *schema written + validated*
- ⬜ Apply migration (`prisma migrate dev -n add_v2_fields`) + `prisma generate`
- ⬜ Verify seed.ts has exactly the 19 canonical categories + 5 launch destinations *(Stage 2)*
- ⬜ Expose new fields in DTOs/Swagger + admin forms + service `*Select` consts

### Workstream B — Tour cardinality & flat URL (breaking)
- ⬜ `TourCategory` join (many-to-many, isPrimary); migrate existing single categoryId
- ⬜ `TourHub` join (many-to-many); migrate existing single hubId
- ⬜ Every tour flat URL `/{dest}/{tour-slug}/` + always write slug_registry TOUR row; remove hub-nested route
- ⬜ HubAllowedCategory check against any of the tour's categories
- ⬜ Public GET /trips filters via join tables; breadcrumb/canonical use isPrimary category
- ⬜ Update CLAUDE.md Rule #8 + TRIP-MODULE §3/§4.12/§4.13/§6.7

### Workstream C — Category page gating
- ⬜ Category page 404 when publishedTourCount = 0 (slug stays reserved)
- ⬜ categories API returns publishedTourCount; omit zero-count from nav/listings

### Workstream D — Attributes / Filters system (new module)
- ⬜ `attribute_definitions` dictionary table + seed (global + category-specific)
- ⬜ `tour_attributes` key-value table + indexes
- ⬜ Backend attributes module: dictionary CRUD + per-tour assignment with validation
- ⬜ GET /filters/:dest/:category (filters + value counts)
- ⬜ Tour-listing filter query params + comma-separated multi-values
- ⬜ Sorting incl. Recommended weighted score
- ⬜ Filter-per-page-type rules + missing-data handling
- ⬜ Frontend filter panel (sidebar/bottom-sheet, URL-driven, canonical→base)
- ⬜ Ship Filter-Priority top-6 first

### Workstream E — Collections module (new module)
- ⬜ Collection model + translations + page content + FAQ
- ⬜ slug_registry COLLECTION row on create
- ⬜ Dynamic filter_query resolver
- ⬜ Cannibalization naming guard vs category slugs
- ⬜ Admin CRUD + frontend CollectionPage

### Workstream F — Search (new module)
- ⬜ Postgres tsvector full-text (title+description+highlights+category+hub names)
- ⬜ GET /search?q=&destination=&locale= (SSR) + same filters/sort
- ⬜ Autocomplete endpoint
- ⬜ Frontend /search page

### Workstream G — SEO layer
- ⬜ JSON-LD emitters per page type (+ BreadcrumbList everywhere)
- ⬜ Breadcrumbs per page type (tour uses primary category)
- ⬜ XML sitemap index + per-type/per-locale files (published-only, non-empty categories)
- ⬜ Internal linking matrix
- ⬜ CRO fields: bookingCount, bookingCountToday, spotsRemaining, lastBookedAt + tour-card signals
- ⬜ Confirm ISR revalidation values match §10

### Workstream H — Slug redirects (decision-gated)
- ⬜ Decision: keep immutable slugs vs add slug_redirects 301 table + 90-day cooldown
- ⬜ If adopting: slug_redirects table + 301 handling + editable slug UI

### i18n confirmations
- ⬜ No-prefix → 302 locale fallback (Accept-Language) alongside localePrefix:'always'
- ⬜ Add What-Gets-Translated priority list to MULTILINGUAL-CONTENT.md
- ⬜ Per-locale Open Graph (og:locale, translated og:title/og:description)

---

## Summary Stats

| Phase | Total Tasks | ✅ Done | ⚠️ Partial | ⬜ Remaining |
|---|---|---|---|---|
| Phase 0 — Project Structure | 4 | 4 | 0 | 0 |
| Phase 1 — Environment | 6 | 6 | 0 | 0 |
| Phase 2 — Prisma Schema | 20 | 20 | 0 | 0 |
| Phase 3 — Auth & Authorization | 16 | 15 | 0 | 1 |
| Phase 4 — Backend Core Modules | 88 | 43 | 1 | 44 |
| Phase 5 — Slot Economy | 7 | 0 | 0 | 7 |
| Phase 6 — Waitlist System | 7 | 0 | 0 | 7 |
| Phase 7 — BullMQ Background Jobs | 6 | 1 | 0 | 5 |
| Phase 8 — SSE Gateway | 4 | 0 | 0 | 4 |
| Phase 9 — Frontend Structure | 18 | 11 | 0 | 7 |
| Phase 10 — Frontend Auth | 7 | 5 | 0 | 2 |
| Phase 11 — Traveler Pages | 9 | 0 | 0 | 9 |
| Phase 12 — Dashboard | 40 | 19 | 11 | 16 |
| Phase 13 — Slot Picker | 6 | 0 | 0 | 6 |
| Phase 14 — Trip Creation Wizard | 9 | 0 | 3 | 6 |
| Phase 15 — Edge Cases | 7 | 0 | 0 | 7 |
| Phase 16 — Notifications | 11 | 2 | 0 | 9 |
| Phase 17 — Admin Moderation | 9 | 0 | 0 | 9 |
| Phase 18 — Wishlist | 4 | 0 | 0 | 4 |
| Phase 19 — V2 Discovery & SEO Alignment | 43 | 0 | 0 | 43 |
| Missing Features (F-01 to F-23) | 23 | 0 | 0 | 23 |
| **TOTAL** | **354** | **126** | **15** | **213** |

**Completion: ~36% of total scope implemented.**  
Core infrastructure (schema, auth, admin modules) is solid. The next highest-priority unimplemented blocks are: **Slot Economy (Phase 5)** → **BullMQ Workers (Phase 7)** → **Bookings + Payments (Phase 4.13–4.14)** → **Traveler Pages (Phase 11)**.
