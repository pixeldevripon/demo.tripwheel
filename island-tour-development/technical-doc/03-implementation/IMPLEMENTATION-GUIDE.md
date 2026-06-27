# Implementation guide

> **Canonical source:** master Appendix F (build map). The build roadmap: what is done, what is
> left, and the order to build it. Per-point status and the dependency-ordered migration plan live in [../MASTER-CHECKLIST.md](../MASTER-CHECKLIST.md).

## Monorepo & boundaries

Backend (NestJS 11 + Prisma 7) and frontend (Next.js + next-intl) are independent apps in one repo
(no Turborepo). **Better Auth runs on NestJS only**; the frontend is a UI/session-consumer layer.
One Prisma instance per process; the frontend has no `DATABASE_URL`. See
[../02-architecture/ARCHITECTURE-OVERVIEW.md](../02-architecture/ARCHITECTURE-OVERVIEW.md).

## Stage 1 — Foundations & content modules — DONE

Already built and master-shaped:
- Auth (Better Auth, guards, decorators, `ROLE_PERMISSIONS`), users, operators (+ company/social/
  Stripe/Mollie configs).
- Destinations, Categories (19 global), Hubs (+ allowed-categories, our-picks, comparison groups),
  Collections (manual/dynamic) — all with translations + per-locale page content + FAQ.
- Tours (`Trip`) + children (images, age bands, add-ons, languages, inclusions,
  exclusions, schedules, translations), multi-category (`TourCategory`, one `isPrimary`),
  multi-hub (`TourHub`), flat URLs with a `TOUR` `slug_registry` row on create.
- Attributes dictionary (`AttributeDefinition`) + per-tour values (`TourAttribute`) + public
  filters endpoint.
- Slug registry resolve endpoint, basic search, settings singletons, media gallery (Cloudinary),
  7-locale multilingual stack.

## Stage 2 — Remove the slot economy — TO DO (first)

Delete `FeaturedSlot`/`SlotLock`/`SlotHistory`/`WaitlistEntry`, their enums, the 3-slot seeding in
category create, slot release hooks, and slot permissions. This unblocks the tier engine. Detailed
steps: See the [master checklist](../MASTER-CHECKLIST.md).

## Stage 3 — Commercial tier engine — TO DO

Add tour tier columns (`commissionTier`, `tierKey`, `tierRank`, `tierLockedUntil`, `qualityScore`,
`eligibilityState`, `firstPublishedAt`, `isBookable`), the ranking query
(`tier_rank ASC, quality_score DESC, id ASC`) with the bookability filter + diversity pass,
tier selection with the 30-day lock, Destination Spotlight request/approval, and `deposit_pct`.
See [../02-architecture/COMMERCIAL-MODEL.md](../02-architecture/COMMERCIAL-MODEL.md); See the [master checklist](../MASTER-CHECKLIST.md).

## Stage 4 — Tour model enrichment — TO DO

Add the master E.3 fields (content, flags/accessibility, booking logic incl. `cancellation_hours`
enum default 48 and `payment_model`); change `TourExclusion` to the typed shape. See the
[master checklist](../MASTER-CHECKLIST.md); field reference in
[../02-architecture/DATA-MODEL.md](../02-architecture/DATA-MODEL.md) and [TRIP-MODULE.md](./TRIP-MODULE.md).

## Stage 5 — Availability & departures — TO DO

Build `availability_schedules` + `availability_exceptions` + materialized `departures`, the nightly
materialization (12 rolling months), the read contract, atomic capacity claim, bookability
(EXISTS open departure within 30 days), all-sold-out recovery, and operator portal endpoints.
See [../02-architecture/AVAILABILITY-AND-DEPARTURES.md](../02-architecture/AVAILABILITY-AND-DEPARTURES.md); See the [master checklist](../MASTER-CHECKLIST.md).

## Stage 6 — Bookings + payments — TO DO

Expand `Booking` to E.8, build the bookings module, the 4 payment models, Stripe (PaymentIntent,
`/payment/processing`, idempotent webhook via `stripe_webhook_events`), refund/forfeit flow, guest
user auto-create. `operator_full` takes no payment and is created confirmed at commit.
See [../02-architecture/BOOKING-AND-PAYMENTS.md](../02-architecture/BOOKING-AND-PAYMENTS.md); See the [master checklist](../MASTER-CHECKLIST.md).

## Stage 7 — Reviews — TO DO

Expand `Review` to E.7 (booking-gated, reviewer first + initial, travel month/year, photos,
operator response, moderation, per-locale text). Recompute tour + operator aggregates on approval;
feed LD11 cold-start and the quality score. See the [master checklist](../MASTER-CHECKLIST.md).

## Stage 8 — Tracking, TYP & analytics — TO DO

TYP route (`/{destination}/thank-you/{public_ref}`, no locale prefix, noindex, server-rendered,
mark-first idempotency), one `booking_complete` push → 4 GTM tags + Meta CAPI, conversion value =
`commission_amount` (EUR), Consent Mode v2, click-id/UTM capture + adjustments.
See [../02-architecture/TRACKING-AND-ANALYTICS.md](../02-architecture/TRACKING-AND-ANALYTICS.md); See the [master checklist](../MASTER-CHECKLIST.md).

## Stage 9 — Eligibility & nightly jobs — TO DO

Operator `cancellation_rate_90d` + contact fields, the eligibility engine (flat bar, 90-day
provisional window, notify → 30-day grace → auto-demote), force-majeure pardons, and the nightly
BullMQ jobs (quality score, eligibility, aggregates, availability materialization, recent_sellouts). See the [master checklist](../MASTER-CHECKLIST.md).

## Stage 10 — Transactional email — TO DO

Resend (SPF/DKIM/DMARC, Postmark fallback): payment-model-aware booking confirmation and the
pre-tour reminder (24h before; no payment links ever). See the [master checklist](../MASTER-CHECKLIST.md).

## Stage 11 — Routing polish — TO DO

Slug rename 301 + 90-day reuse cooldown (redirect table), category gating set to **≥3** published
tours. See the [master checklist](../MASTER-CHECKLIST.md).

## Stage 12 — Affiliate — TO DO

Trackdesk integration (8% of GMV from commission, on-hold→approved lifecycle, promo codes as
attribution IDs). See the [master checklist](../MASTER-CHECKLIST.md).

## Stage 13 — Public frontend — TO DO

Build the public pages per the rendering strategy (Homepage/Destination/All Tours/Category/
Collection ISR 60s, Hub ISR 300s, Tour ISR 30s, Search SSR, TYP server), the shared `<TourCard />`,
booking widget (S1–S5), checkout accordion, trust modals, and the SEO rendering layer (meta,
canonical/hreflang, JSON-LD, sitemaps, breadcrumbs). Depth references in `../specs/` and master §5. See the [master checklist](../MASTER-CHECKLIST.md).

## Commands

```bash
pnpm dev:backend             # NestJS on http://localhost:5050
pnpm prisma:generate         # regenerate client after schema changes
pnpm prisma:migrate          # create + apply migration (dev)
pnpm prisma:migrate:deploy   # apply pending migrations (production)
pnpm prisma:studio
```
