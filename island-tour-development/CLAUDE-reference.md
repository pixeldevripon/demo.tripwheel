# Island Tours — Reference Docs

> Quick reference for frontend, routing, i18n, the booking widget, and lifecycle. Canonical source:
> `technical-doc/island-tours-platform-master.html`. Deep references live in `technical-doc/` and
> `technical-doc/specs/`.

## Locales & currency

7 locales, EN primary: `EN, NL, DE, FR, ES, PT, ZH`. All UI strings via `next-intl`. Slugs are
English in every locale; the locale prefix switches language. Display currency is **locale-default**
(EN/ZH → USD; NL/DE/FR/ES/PT → EUR) plus a **footer selector** override that persists for the
session (nav never carries it). See `technical-doc/04-multilingual/MULTILINGUAL-CONTENT.md`.

## URL architecture

```
/{locale}/                              homepage
/{locale}/{destination}/                destination
/{locale}/{destination}/{slug}/         category | hub | collection | tour | reserved 'tours'
/{destination}/thank-you/{public_ref}   TYP (no locale prefix, noindex)
```

- Tours are **flat** under the destination — no `/tour/` segment, no hub nesting. Hub membership is
  a discovery tag with no URL effect.
- The `{slug}` segment is resolved by the slug registry to one entity type. Locale prefix always
  present on content pages; no-prefix → 302 by Accept-Language → `/en/`.
- Renames issue a 301 (redirect table); deleted slugs observe a 90-day reuse cooldown.
- See `technical-doc/02-architecture/ROUTING-AND-RESOLUTION.md`.

## Rendering strategy (Next.js ISR)

| Page | Render | Revalidate |
|---|---|---|
| Homepage / Destination / All Tours / Category / Collection | ISR | 60s |
| Activity Hub | ISR | 300s |
| Tour detail | ISR | 30s |
| Search results | SSR | not cached |
| Thank You page | server-rendered | — |

Performance budgets (tour detail): LCP < 2.5s, INP < 200ms, CLS < 0.05.

## Commercial tiers (quick ref)

Placement is by commission tier, not slots: `premium 30 / featured 27.5 / boosted 25 /
organic 22.5 / standard 20`, plus `Destination Spotlight 35%` (separate block, max 3/destination,
manual approval). Listings order by `tier_rank ASC, quality_score DESC, id ASC`. Tier mechanics are
internal — never user-facing. Sponsored badge on paid placements; "Most popular" is editorial
(organic, ≥10 reviews, ≥4.5, max 1/category); "Locals' favorites" is the default editorial sort
label. See `technical-doc/02-architecture/COMMERCIAL-MODEL.md`.

## Payment models (quick ref)

`operator_link` (default — operator emails balance link), `on_arrival` (balance in person),
`paid_in_full` (100% via Island Tours), `operator_full` (operator collects full; checkout takes no
payment). Deposit models charge `deposit_pct`% (20–30, tier-driven) at booking. Booking confirmed
instantly on every model. Pre-payment copy is agentless; post-booking the operator is named
(anti-phishing). See `technical-doc/02-architecture/BOOKING-AND-PAYMENTS.md`.

## Tour detail page (section order)

Breadcrumbs (3 variants) → H1 `{Destination or Hub}: {Tour name}` → rating row → gallery → booking
widget → overview → What's Included (✓/✗) → Meeting & Pickup → Important Info
→ reviews → related tours. 3 quick-info badges: Duration, Pickup, Languages (LD7). Sticky TOC, 7
items (LD16). Deep reference: `technical-doc/specs/` (Tour Detail Page Specification).

## Booking widget state machine (S1–S5)

| State | Trigger | Display |
|---|---|---|
| S1 Initial | page load | "From $X per person", date + travelers inputs, CTA "Check availability", trust strip |
| S2 Date picker | tap date | full-month calendar, first bookable date highlighted, auto-skip fully-booked/past-cutoff months |
| S3 Date selected | tap cell | time-slot chips when multiple departures; date persists as a pill with Change |
| S4 Ready | date+time+party set | financial summary (Total / Pay today / Balance later), CTA "Continue →" |
| S5 Checkout | tap Continue | accordion checkout |

Field order locked: date first, travelers second. CTA progression (LD2): Check availability →
Continue → 🔒 Reserve my spot · Pay $X (`operator_full` renders bare "Reserve my spot", no lock, no
amount). Trust strip (LD5): two clickable lines max (cancellation + deposit), nothing else; on
`paid_in_full`/`operator_full` it is the single cancellation line. Capacity-aware party validation
("Only N left"). Booking cutoff per `booking_cutoff_minutes` (default 120). Deep reference:
`technical-doc/specs/` + master §6.1.

## Availability (quick ref)

`availability_schedules` (weekly) + `availability_exceptions` (per-date stop-sell) →
materialized `departures` (the single truth, capacity per departure). Single-day tours only (v1).
Bookability = EXISTS an open departure within 30 days. All-sold-out → alternatives module (notify-me
is v2). See `technical-doc/02-architecture/AVAILABILITY-AND-DEPARTURES.md`.

## Trip lifecycle

`DRAFT → LIVE ⇄ PAUSED → ARCHIVED` (+ restore). Publish guard: ≥5 images + hero, English overview,
price, free-cancellation window present. Status changes re-run the category ≥3 gating
check in both directions. Ownership via `operator.id` (admin auto-provisioned, bypasses ownership).

## Auth

Better Auth runs on NestJS only (instance + Prisma adapter); the frontend consumes sessions via the
`better-auth.session_token` cookie and never runs `betterAuth()`. Guard chain:
ThrottlerGuard → AuthGuard → RolesGuard → PermissionsGuard.
