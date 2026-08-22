# Island Tours — Project Scope

> Canonical source: master §1 (`technical-doc/island-tours-platform-master.html` v1.9). This document states the business requirements: what Island Tours is, who uses it, the commission-tier business model, the four payment models, instant booking, and the edge cases the platform must handle.

---

## 1. What Island Tours Is

Island Tours is a **Caribbean tour marketplace** built on the "Built by Islanders" ethos: local curation as the ethical, locally owned alternative to global OTAs (Viator, GetYourGuide, Klook, Headout). Travelers discover and book tours and activities; local operators supply them; Island Tours earns a **commission per booking** — it is a reseller, not the tour provider.

- **Tagline:** "Island Tours. Built by Islanders." The sign-off form is "Built by Islanders." The tagline is a brand mark (like a logo) and stays in English in all seven locales — never translated.
- **Commercial model:** commission-based marketplace. Operators pay a **tiered commission**, snapshotted onto the booking at creation time (master §1.4, §7.1).

### Positioning pillars (master §1.1)

| Pillar | Meaning |
|---|---|
| Local curation, not an algorithmic catalog | Editorial picks are made by people who live on the islands. |
| Ethical CRO | No fake urgency, no fake scarcity, no badge inflation, no dark patterns, no pre-checked add-ons. Paid placement is always labeled **Sponsored**. |
| Transparency | Total price before checkout, no hidden fees, clear cancellation, claims always verifiable. |
| Caribbean-proud voice | Warm, direct, first-person plural, never corporate. |

---

## 2. Launch Scope (master §1.2, confirmed June 10 2026)

Three **live** destinations, in rollout order. Saint Lucia and the Bahamas exist as **seeded pipeline rows only** — the architecture lists five, but every 2026 surface (homepage hero quick links, email spec, reviews) works with the three-island set.

| # | Destination | Slug | Status |
|---|---|---|---|
| 1 | Curaçao | `/curacao/` | Launch |
| 2 | Aruba | `/aruba/` | Rollout 2 |
| 3 | Sint Maarten | `/sint-maarten/` | Rollout 3 |
| 4 | Saint Lucia | `/saint-lucia/` | Pipeline, seeded only |
| 5 | Bahamas | `/bahamas/` | Pipeline, seeded only |

The destination data model supports unlimited expansion with no structural change. Destinations are grouped by **region** (a data attribute, no URL). `parent_destination_id` is nullable for future sub-destinations, unused at launch. See `../02-architecture/PLATFORM-ARCHITECTURE.md` and `../02-architecture/DATA-MODEL.md`.

### Languages and currency (master §1.3)

- **Seven locales from launch**, English primary: `EN, NL, DE, FR, ES, PT, ZH`. Slugs are English in every locale, never translated.
- **Display currency** defaults per locale, with a footer selector override that persists for the session (NOT destination-based): EN, ZH → USD; NL, DE, FR, ES, PT → EUR. The nav never carries the selector. `destination.currency` is operator/payout context only and does not drive display currency.

See `../04-multilingual/MULTILINGUAL-CONTENT.md`.

---

## 3. User Roles and Flows (master §1, §7; brief §16)

Three launch-active roles. EDITOR/STAFF/GUIDE are designed but not launch-active. ADMIN is a strict superset of OPERATOR and USER. Roles are set **server-side only** — the frontend never sends a `role` field. See `../05-access-management/ROLES-AND-ACCESS-MANAGEMENT.md`.

| Role | Created by | Core capability |
|---|---|---|
| USER (traveler) | Auto-created on first booking | Discover → book → pay → review |
| TOUR_OPERATOR | Self-registration (Better Auth, email verification + Google) | List tours, pick a commission tier, manage availability |
| ADMIN | Database seed only | Manage destinations / categories / hubs / collections, approve Spotlight, issue force-majeure pardons |

### 3.1 Traveler flow — discover → book → pay → review

1. **Discover.** Three parallel discovery layers per destination — **Categories**, **Activity Hubs**, **Collections** — plus the All Tours catalog and Search. Listing order follows the tier ranking (`tier_rank ASC, quality_score DESC, id ASC`); paid placements P1–P3 carry a gray **Sponsored** badge. (master §2.1, §7.2)
2. **Book.** **Instant booking, no enquiry model.** The traveler selects a departure and party, and the booking is **confirmed instantly on every payment model**. Pre-payment copy is agentless ("You'll get a secure link to pay the rest") and never names the operator (disintermediation control).
3. **Pay.** Deposit or full amount via Stripe at booking, per the payment model (§5 below). The Thank You page fires one `booking_complete` conversion event.
4. **Review.** A traveler can submit a review only against a **confirmed booking** ("every review from a confirmed booking, no exceptions"). Reviewer first name + last initial only; travel month + year; rating 1–5; text per locale. See `../02-architecture/DATA-MODEL.md` (E.7).

### 3.2 Operator flow — list tours, pick a tier, manage availability

- **Self-register** via Better Auth (email/password with mandatory verification, plus Google). Operators inherit all traveler capabilities.
- **List tours.** Create a tour as DRAFT, attach it to 1 destination, 1+ categories (one primary), 0–n hubs, fill localized content and pricing, then publish. See `../03-implementation/TRIP-MODULE.md`.
- **Pick a commission tier** in the dashboard (§4). On change, the tier is locked for 30 days. Tier eligibility is enforced by the eligibility engine (§4.2).
- **Manage availability.** Operators set a weekly availability pattern and per-date exceptions; the platform materializes concrete departures. See `../02-architecture/AVAILABILITY-AND-DEPARTURES.md`.
- **Request Destination Spotlight** (35% placement block) — manual approval by Island Tours, max 3 simultaneous per destination.

### 3.3 Admin flow — manage the marketplace

- Manage **destinations, categories, hubs, collections** and their editorial/page content.
- **Approve Destination Spotlight** requests (operator requests, Island Tours approves).
- **Issue force-majeure pardons** that exclude qualifying cancellations from an operator's trailing-90-day cancellation rate.
- Confirm operator non-payment reports (the only path that forfeits a deposit — §6).

> Operator and admin tooling is out of the master's consumer scope, but the role model must support these actions.

---

## 4. Commission-Tier Business Model (master §1.4, §7) — replaces the slot economy

> **There is no featured-slot economy.** The earlier 3-slots-per-category, soft-lock/hard-reserve, waitlist, and paid-skip mechanism is removed entirely. Placement is governed by **commission tiers + a ranking query + an eligibility engine**. See `../02-architecture/COMMERCIAL-MODEL.md`.

### 4.1 Tiers

Operators pay a tiered commission, locked at booking time as `commission_amount` on the booking record. Tier mechanics are **internal commercial logic, never user-facing**.

| Tier (`tier_key`) | Commission | `tier_rank` |
|---|---|---|
| `premium` | 30% | 1 |
| `featured` | 27.5% | 2 |
| `boosted` | 25% | 3 |
| `organic` | 22.5% | 4 |
| `standard` (default) | 20% | 5 |
| **Destination Spotlight** | 35% | separate labeled block, never interleaved; max 3 per destination; manual approval |

`standard` is the default for new tours and the locked rate for operators on a negotiated 20% agreement. It **deliberately ranks below `organic`**, so a 20% operator who wants to outrank other base-rate tours moves up to `organic` at 22.5%.

**Ranking:** `ORDER BY tier_rank ASC, quality_score DESC, id ASC`. Same-tier collisions are expected and valid; there is no per-category tier cap. A bookability filter excludes a tour when `status != active`, `is_bookable = false`, or it has no open departure in the next 30 days. A diversity pass runs after ranking. Tier also drives `deposit_pct` (20–30 in 2.5 steps).

**Tier lock:** on change, `tier_key`, `commission_tier`, and `tier_rank` update together and `tier_locked_until = now + 30 days`; further changes are rejected while the lock is in the future.

### 4.2 Eligibility engine

A flat eligibility bar opens the paid tiers (`boosted`, `featured`, `premium`), applied **after a one-time 90-day provisional window** from first publish during which any tier may be held:

- **5 reviews**, rating **≥ 4.0**, operator **cancellation rate ≤ 10%** (trailing 90 days, minimum 10 bookings; admin force-majeure pardons apply).
- **Destination Spotlight** additionally requires **10 reviews**, **4.5** rating, manual approval, and the max-3 cap.

A nightly check enforces eligibility: notify → **30-day grace** → automatic demotion to the highest tier the tour still qualifies for. Existing bookings keep their snapshotted commission. See `../02-architecture/COMMERCIAL-MODEL.md`.

### 4.3 Quality score

`quality_score` (0–100) is computed by a **nightly job** and is read-only at query time:

```
quality_score =
  (avg_rating / 5)               * 40 +
  (min(review_count, 100) / 100) * 25 +
  (listing_completeness / 100)   * 20 +
  (conversion_rate / max_conv)   * 15
```

`max_conv` = highest conversion rate among active tours in the same category, recomputed per run.

### 4.4 Affiliate program (master §7.3)

Trackdesk (primary). Rate: **8% of GMV**, funded entirely out of Island Tours' commission take. Commission goes on hold at booking and approves after the cancellation window closes (clawback-safe). Attribution is owned by the platform's own `booking_complete` event; promo codes double as attribution identifiers. See `../02-architecture/TRACKING-AND-ANALYTICS.md`.

---

## 5. Payment Models (master §1.4, §5.8) — four canonical models

The booking is **confirmed instantly on every model**. The chosen model is snapshotted onto the booking. On deposit models the traveler pays `deposit_pct`% to Island Tours via Stripe at booking; the balance is the operator's transaction. See `../02-architecture/BOOKING-AND-PAYMENTS.md`.

| Model | Balance handling | Deposit at booking |
|---|---|---|
| `operator_link` (default) | Operator emails a secure payment link; balance paid online before the deadline | `deposit_pct`% via Stripe |
| `on_arrival` | Balance paid in person on arrival (card or cash, or cash only, per tour) | `deposit_pct`% via Stripe |
| `paid_in_full` | Traveler paid 100% at booking via Island Tours | 100% via Stripe |
| `operator_full` | Operator collects the full amount; checkout takes no payment | none (bypasses payment + webhook; created confirmed) |

**Two-phase operator visibility:** before payment, all copy is agentless and never names the operator (disintermediation control). After booking, the operator is named deliberately — on `operator_link` tours the Thank You page and confirmation email say the operator will send the balance link, so that email is expected and not mistaken for phishing (the C2 mitigation).

---

## 6. Cancellation and Free-Cancellation Policy (master §6.2)

- `cancellation_hours` is an int enum `[24, 48, 72, 168]`, **default 48**, stored NOT NULL.
- **One window governs both** the balance deadline and free cancellation: `cancelDeadline = tour start − cancellation_hours` (tour-local time, shown "(local time)").
- **Free cancellation is a listing requirement** — every published tour carries a window.
- **Forfeiting a deposit is never automatic.** Operator reports non-payment → admin confirms → only then is the deposit forfeited.
- **Operator-forced cancellation** → full refund or free reschedule, always.

---

## 7. Page Types (master §2.1)

| Page type | Job | Example URL |
|---|---|---|
| Homepage | Destination selection, nothing else | `/` |
| Destination | Island overview, entry to all discovery layers | `/en/curacao/` |
| All Tours | Full filterable catalog per destination | `/en/curacao/tours/` |
| Category | One activity type per destination (SEO workhorse) | `/en/curacao/boat-tours/` |
| Activity Hub | One location/highlight/area with its own decision logic | `/en/curacao/klein-curacao/` |
| Collection | Persona/intent-driven curated list, cuts across categories | `/en/curacao/best-things-to-do/` |
| Tour detail | Conversion page | `/en/curacao/{tour-slug}/` |
| Checkout + Thank You | Transaction and confirmation | see §5.8, §5.9 |
| Search results | Query results within a destination | `/en/search?q={query}&destination={dest}` |
| Help Center | Site-level FAQ with FAQPage schema | `/help` |

Tours live **flat directly under the destination** — no `/tour/` segment, no hub nesting. See `../02-architecture/ROUTING-AND-RESOLUTION.md` and `../02-architecture/SLUG-REGISTRY.md`.

---

## 8. Edge Cases the System Must Handle

| ID | Scenario | Behavior |
|---|---|---|
| EC-01 | A tour drops below an eligible tier (review/rating/cancellation-rate threshold) | Nightly check notifies, opens a 30-day grace, then auto-demotes to the highest still-qualifying tier; existing bookings keep snapshotted commission |
| EC-02 | Operator changes tier within the 30-day lock | Rejected while `tier_locked_until` is in the future |
| EC-03 | Tour has no open departure in the next 30 days | Excluded from every ranked result set; not billed for its tier during the unbookable period |
| EC-04 | Category has fewer than 3 published tours in a destination | Category page is `draft` — excluded from nav, sitemaps, internal links, and search until the threshold is met (checked on every tour status change, both directions) |
| EC-05 | `operator_full` booking | Bypasses payment + webhook; created confirmed at commit; still fires the conversion event |
| EC-06 | Traveler misses the balance deadline (deposit model) | Forfeiting is never automatic — operator reports non-payment, admin confirms, only then is the deposit forfeited |
| EC-07 | Operator-forced cancellation | Full refund or free reschedule, always |
| EC-08 | Destination Spotlight request when 3 already active in that destination | Rejected (max-3 cap); request queued for manual approval when a slot frees |
| EC-09 | Slug renamed or a slug deleted | Rename creates a 301 redirect entry automatically; a deleted slug enters a 90-day reuse cooldown |
| EC-10 | Review submitted without a confirmed booking | Rejected — reviews are gated on a confirmed `booking_id` |

---

## 9. Infrastructure (master §1.5)

Next.js frontend, NestJS backend on TripWheel infrastructure; next-intl for all UI strings (no hardcoded English); PostgreSQL via Prisma; **Stripe** payments; **Resend** as the transactional email provider (Postmark fallback) on a dedicated transactional subdomain with full SPF/DKIM/DMARC, separate from marketing email; **GTM, Google Ads, GA4, Meta Pixel + server-side Meta CAPI** for tracking (master §8). Backend and frontend are independent apps in one monorepo; **Better Auth lives on NestJS only**. See `../03-implementation/IMPLEMENTATION-GUIDE.md`.
