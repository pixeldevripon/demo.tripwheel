# Application features

> **Canonical source:** `island-tours-platform-master.html`. Feature inventory by area, against the
> master target. Status: ✅ Built · ⚠️ Partial · ⬜ Missing. The featured-slot economy is removed
> (replaced by commission tiers). For ordered build steps see
> [MASTER-CHECKLIST.md](./MASTER-CHECKLIST.md).

| Area | Status | Notes |
|---|---|---|
| Platform foundation (NestJS, Prisma split schema, env validation, Swagger, throttling) | ✅ | |
| Auth & RBAC (Better Auth backend-only, guard chain, `ROLE_PERMISSIONS`) | ✅ | Slot permissions to be removed |
| Users (CRUD, soft-delete) | ✅ | Guest auto-create on first booking ⬜ |
| Operators (CRUD, onboarding, company/social/Stripe/Mollie configs) | ✅ | `cancellation_rate_90d`, `contact_email/phone` (E.164) ⬜ |
| Destinations (CRUD, translations, page content, FAQ, seeded guard) | ✅ | |
| Categories (19 global, per-destination pages, translations, FAQ) | ⚠️ | Built; gating must move ≥1 → **≥3**; drop slot seeding |
| Hubs (CRUD, allowed-categories, our-picks, comparison groups, translations) | ✅ | |
| Collections (manual/dynamic, translations, page content, slug registry) | ✅ | |
| Tours (CRUD, lifecycle, children, multi-category, multi-hub, flat URL) | ⚠️ | Built; missing E.3 content/flag/booking fields + tier columns |
| Attributes & filters (dictionary, per-tour values, public filters) | ✅ | Faceted filter UI on listings ⬜ (frontend) |
| Slug registry & routing (resolve, transactional writes, reserved `tours`) | ⚠️ | Built; **301 redirects + 90-day cooldown** ⬜ |
| Commission tiers + ranking + quality score | ⬜ | Replaces slot economy; tier columns, ranking query, nightly job |
| Tier eligibility (flat bar, provisional/grace/demotion, Spotlight, pardons) | ⬜ | |
| Availability & departures (schedules, exceptions, materialized departures) | ⬜ | Only a basic `TourSchedule` exists; superseded |
| Bookings (E.8: refs, multi-currency, commission snapshot, payment_model) | ⬜ | Thin `Booking` model only; no service |
| Payments (4 models, Stripe PaymentIntent, idempotent webhook) | ⬜ | Config models only |
| Reviews (booking-gated, moderation, operator response, aggregates) | ⬜ | Thin `Review` model only; no service |
| Wishlist | ✅ | Schema + relation built |
| Tracking & analytics (`booking_complete`, TYP, GTM, Meta CAPI, Consent Mode v2) | ⬜ | |
| Transactional email (Resend; confirmation + pre-tour reminder) | ✅ | Resend transport live (env-configured: `RESEND_API_KEY` + `MAIL_FROM`); pre-tour reminder still TODO |
| Affiliate program (Trackdesk, 8% of GMV) | ⬜ | |
| Search | ⚠️ | Basic name search; faceted/two-stage ranking ⬜ |
| Media gallery (Cloudinary) | ✅ | |
| Settings (SiteInfo, SiteSEO, Social, Mailchimp, Stripe, Mollie, Company) | ✅ | SMTP settings removed 2026-07-19 (email = Resend via env, no settings API) |
| SEO rendering layer (meta, canonical/hreflang, JSON-LD, sitemaps, breadcrumbs) | ⬜ | Backend data ready; frontend emission missing |
| Public site (Homepage, Destination, All Tours, Category, Hub, Collection, Tour detail, Checkout, TYP) | ⬜ | Frontend build |
| Background workers (BullMQ: nightly jobs, email, materialization, AI translation) | ⬜ | |
| Admin tooling (moderation, Spotlight approval, force-majeure pardons) | ⬜ | |

## Removed (was the slot economy)

`FeaturedSlot`, `SlotLock`, `SlotHistory`, `WaitlistEntry` and the 3-slots-per-category seeding are
removed in favor of commission tiers. `FeaturedExperience` (Top Island Experiences editorial) and
`Wishlist` are unrelated and stay. See
[02-architecture/COMMERCIAL-MODEL.md](./02-architecture/COMMERCIAL-MODEL.md).
