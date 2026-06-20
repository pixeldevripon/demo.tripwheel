# Booking & Payments — Lifecycle, Models & Cancellation

Canonical source: master §1.4, §6.1–§6.5, and Appendix E.8 (`island-tours-platform-master.html` v1.9).

Purpose: defines how a booking is created, paid, confirmed, and cancelled on Island Tours — the four payment models, the deposit/balance split, the unified cancellation/balance window, booking states, and the bookings data-model highlights. **Bookings are confirmed instantly on every model; no 24h enquiry step exists.**

Sibling docs: [COMMERCIAL-MODEL.md](./COMMERCIAL-MODEL.md) · [DATA-MODEL.md](./DATA-MODEL.md) · [AVAILABILITY-AND-DEPARTURES.md](./AVAILABILITY-AND-DEPARTURES.md) · [TRACKING-AND-ANALYTICS.md](./TRACKING-AND-ANALYTICS.md) · [../MASTER-CHECKLIST.md](../MASTER-CHECKLIST.md)

> Status: **canonical/target**. The bookings service, payments/Stripe processing, webhooks, and emails are **not built**. The current `Booking` model is thin, has **no `payment_model` field**, and `cancellationHours` defaults to **24** (must become the enum default **48**). Mismatches are tracked in [../MASTER-CHECKLIST.md](../MASTER-CHECKLIST.md).

---

## 1. The four payment models

Canonical: master §1.4 (confirmed June 10, 2026). A tour declares one payment model; it is **snapshotted onto the booking** at creation as `payment_model`.

| `payment_model` | Charged at checkout (via Island Tours / Stripe) | Balance handling |
|---|---|---|
| **`operator_link`** (default) | `deposit_pct`% deposit | Operator emails a **secure payment link**; balance paid online before the deadline |
| **`on_arrival`** | `deposit_pct`% deposit | Balance paid **in person on arrival** (card or cash, or cash only, per tour) |
| **`paid_in_full`** | **100%** of the booking | Nothing later — fully paid via Island Tours at booking |
| **`operator_full`** | **Nothing** | Operator collects the **full amount** directly; checkout takes no payment |

### Deposit / balance split

- **Deposit models (`operator_link`, `on_arrival`):** the traveler pays **`deposit_pct`% to Island Tours via Stripe** at booking. The **remaining balance is the operator's transaction** — it does not flow through Island Tours in v1.
- **`paid_in_full`:** Island Tours charges the **full amount** via Stripe at booking.
- **`operator_full`:** **no payment at checkout.** Island Tours takes no deposit; the operator collects the full amount directly. `operator_full` **bypasses the Stripe charge and webhook entirely** and the booking is **created `confirmed` at commit** (master §12, conflict log C22).

`deposit_pct` is **tier-driven** (20–30 in 2.5 steps) — see [COMMERCIAL-MODEL.md](./COMMERCIAL-MODEL.md). Tier and commission are snapshotted onto the booking alongside `payment_model`.

> The earlier LD24 rule "balance online, never cash on tour day" describes only the `operator_link` default and is **superseded** as a platform-wide rule by this four-model set.

### CTA & money-row behavior (high level)

The booking widget CTA and money blocks are **`payment_model`-aware** (master §6.1, conflict log 80/82):

- `operator_full` renders the bare CTA **"Reserve my spot"** — no lock icon, no amount (no payment occurs). All other models render the locked progression `Check availability → Continue → 🔒 Reserve my spot · Pay $X`.
- **Zero-amount money rows are hidden** (widget S4, checkout summary, email block 4): `operator_full` shows Total and "Balance later"; `paid_in_full` shows Total and "Pay today".

Exact copy and visuals live in the booking-widget design spec — this doc states the rules.

---

## 2. Instant confirmation + the two emails

**The booking is confirmed instantly on every model.** Two emails follow:

1. The **Island Tours confirmation email** (always) — see §6.
2. On **`operator_link` tours only**, the **operator's balance email** with the secure payment link.

### Two-phase operator visibility (anti-phishing, the C2 mitigation)

A platform principle (master §1.4):

- **Pre-payment — agentless.** The widget and all modals are operator-agnostic: "You'll get a secure link to pay the rest." The operator is **never named or spotlighted** before payment (disintermediation control).
- **Post-booking — operator named, deliberately.** On `operator_link` tours the Thank You page and the confirmation email **name the operator** and say the operator will send the balance link — so that follow-up email is **expected and not mistaken for phishing** (the C2 mitigation).

> **Pre-payment agentless, post-booking named.** This split is the reason `operator_link` confirmation emails foreshadow the operator by name (confirmation email block 5, mandatory on `operator_link`).

---

## 3. The unified cancellation / balance window

Canonical: master §6.2 (confirmed June 10, 2026). **One per-tour window governs BOTH the balance deadline AND free cancellation.**

```
tour.cancellation_hours : enum [24, 48, 72, 168]   default 48
```

- CMS-enforced **NOT NULL, enum-bound** — values outside the enum are blocked. Validated at operator onboarding.
- **Free cancellation is a listing requirement:** every published tour carries a window from the enum. This grounds every "free cancellation on every tour" claim and the filter-modal subtext.

### Deadline computation (never stored)

```
cancelDeadline = tour start − cancellation_hours
```

- Computed in **tour-local time**, displayed with **"(local time)"**.
- The deadline is **computed, never stored** on the booking (Appendix E.8). The same value renders in five places from one backend lookup per page: trust-strip line 1, the two Cancellation Policy paragraphs, the mobile sticky bar, and the confirmation email.

### Window lifecycle

| Phase | Behavior |
|---|---|
| **Book** | Deposit (deposit models) / full (`paid_in_full`) / nothing (`operator_full`). Confirmed instantly. |
| **Up to the deadline** | Cancel for a **full refund of any amount paid**; on `operator_link`, pay the balance. |
| **After the deadline** | **Locked.** |
| **Operator-forced cancellation** (unsafe conditions) | **Full refund or free reschedule, always.** |

### Forfeiting is never automatic

The platform does **not track `operator_link` balance payments in v1**, so "unpaid" cannot be machine-determined. Therefore:

> **Operator reports non-payment → admin confirms → only that confirmation forfeits the deposit and releases the spot** (conflict log 84).

There is no automatic forfeit and no automated balance nudge.

> **Field-name note:** the canonical field is **`cancellation_hours`** (Change Log standardization). Older docs using `cancellation_window_hours` with a 24-or-48 framing rename to `cancellation_hours` with the full enum. The same migration adds the `payment_model` snapshot column to `bookings` (absent from the older dev-spec field list, which predates the four-model canon — C8).

---

## 4. Booking states & the cancellation flow

### States

```
pending_payment → confirmed → cancelled → ...
```

- `pending_payment` — created, awaiting the Stripe charge to settle (deposit / paid_in_full models).
- `confirmed` — instant on every model; `operator_full` is **created `confirmed` at commit** (no `pending_payment` step, no charge/webhook).
- `cancelled` — set by admin after a cancellation request (or operator-forced cancellation).
- Further states (e.g. forfeited / operator-cancelled) follow the same admin-confirmed pattern.

### Cancellation flow (C1) — no raw-click cancel

```
Confirmation email "Cancel booking" button
        │
        ▼
Tokenized confirmation page on island.tours
  "Cancel {tour}, {date}? Refund ${deposit}"   (refund line only when amount > 0)
        │  submit
        ▼
Manual request form (modal) → admin email
        │
        ▼
Admin marks `cancelled` in the DB
        │
        ▼
Notifications to BOTH traveler and operator
```

- **No raw-click cancellation** — the email button opens a **tokenized confirmation page**, never an immediate cancel.
- The **cancellation deadline is judged on the request timestamp, not the admin action** (so admin latency never penalizes a traveler who requested in time).
- **Account fallback** for lost emails: `island.tours/bookings`, login with **email + booking reference (`display_ref`)**, rate-limited. The TYP URL rides on the separate unguessable `public_ref` UUID; the email-plus-reference pair is the credential for an account holding invoices and PII. **Accounts are auto-created at booking.**

### Cancellation confirmation copy is `payment_model`-aware (high level)

The refund line varies by model (master §6.4, conflict log 87): deposit models reference the deposit refund "within 3 to 5 business days"; `paid_in_full` references the full payment; `operator_full` carries **no refund line** ("Nothing was paid to Island Tours …"). Exact locked strings live in the booking-widget / email specs.

---

## 5. Bookings data model (E.8 highlights)

Canonical: master Appendix E.8 and the appended booking schema (master §10290-ff). **Full field list lives in [DATA-MODEL.md](./DATA-MODEL.md); the conversion pipeline lives in [TRACKING-AND-ANALYTICS.md](./TRACKING-AND-ANALYTICS.md).** Highlights:

```sql
-- Identification
public_ref            uuid NOT NULL UNIQUE   -- used in the TYP URL, non-enumerable
display_ref           varchar NOT NULL       -- IT-2026-XXXXX, customer-facing + transaction id + login
status                varchar                -- 'pending_payment' | 'confirmed' | 'cancelled' | ...
island                varchar NOT NULL       -- denormalized from tours.island (default 'Curaçao')

-- Multi-currency
original_currency     char(3)  NOT NULL      -- 'EUR' or 'USD' (what Stripe charged)
original_amount       decimal(10,2) NOT NULL -- full booking in original currency
booking_total_eur     decimal(10,2) NOT NULL -- full booking normalized to EUR
fx_rate_to_eur        decimal(10,6) NOT NULL -- snapshot at booking time, for audit

-- Commission (the conversion value)
commission_rate       decimal(5,4)  NOT NULL -- e.g. 0.20, snapshot at booking time
commission_amount     decimal(10,2) NOT NULL -- in EUR, the conversion value for all platforms

-- Payment model + deposit
payment_model         varchar                -- operator_link | on_arrival | paid_in_full | operator_full
deposit_amount        decimal(10,2)          -- amount taken to Island Tours at checkout

-- Idempotency / attribution
conversion_fired_at   timestamptz NULL       -- guard against double conversion fires
gclid, gbraid, wbraid, fbclid                -- click IDs (Google + Meta)
utm_source/medium/campaign/term/content      -- UTM attribution

-- Customer identity + billing
customer_first_name   varchar NOT NULL       -- split for Enhanced Conversions hashing
customer_last_name    varchar NOT NULL
customer_email        varchar NOT NULL
customer_locale       varchar                -- the locale the booking was made in
billing_country/postal_code/city            -- pulled from Stripe payment_method at webhook
```

Notes:
- **`commission_rate` / `commission_amount` snapshot at booking and never change retroactively** (see [COMMERCIAL-MODEL.md](./COMMERCIAL-MODEL.md)). `commission_amount` (EUR) is the conversion value — never GMV.
- **Customer name is split** (`customer_first_name` + `customer_last_name`) to improve Enhanced Conversions match rate. If the form currently has a single `customer_name`, it must be split.
- **Billing data** (`country` / `postal_code` / `city`) is pulled automatically from the Stripe `payment_method` at webhook time — **no extra booking-form friction**.
- The **cancellation deadline is computed, never stored** (§3).

---

## 6. Confirmation email (high level)

Canonical: master §6.5 (`island-tours-booking-confirmation-email-spec.md` + wireframe). **One dynamic template** for all bookings, tours, and locales (merge variables, conditional blocks, i18n resource files). Eleven blocks in order — the load-bearing ones for this lifecycle:

- **(1)** Confirmation + booking reference at the top.
- **(4)** Payment summary: deposit paid / balance due / total, the single `{hours}` deadline "(local time)", **zero-amount rows hidden**.
- **(5)** **C2 foreshadow — mandatory on `operator_link`:** the operator, named, will send a separate email with a secure balance link, so that email is expected and never read as phishing.
- **(6)** Anti-fraud line (locked): "We'll never ask for card details by reply, text, or phone. Always pay through the link in your booking emails."
- **(7)** Cancellation: the tokenized cancel link + the account pointer.
- **(9)** Payment-model block, conditional per the four models, every deadline "(local time)", `{operatorName}` always templated.

**Email sequence:** confirmation → operator balance email (`operator_link` only) → pre-tour reminder (24h before start) → cancellation confirmation. When a booking is created **less than 24 hours before tour start**, the confirmation subject switches to "You're booked for tomorrow: {tour}" (or "today") and **no separate reminder follows**. Provider: Resend (primary), Postmark (fallback), on a dedicated transactional subdomain with SPF/DKIM/DMARC.

---

## 7. `operator_full` summary

`operator_full` is the one model that touches no payment rail:

- **No charge at checkout, no Stripe webhook.**
- Booking is **created `confirmed` at commit** — no `pending_payment` state.
- Widget CTA is the bare **"Reserve my spot"**; zero-amount money rows are hidden.
- Cancellation confirmation carries no refund line ("Nothing was paid to Island Tours …").
- Operator collects the full amount directly; balance is entirely the operator's transaction.

See the conversion-firing details for `operator_full` (fires at commit rather than on a webhook) in [TRACKING-AND-ANALYTICS.md](./TRACKING-AND-ANALYTICS.md).
