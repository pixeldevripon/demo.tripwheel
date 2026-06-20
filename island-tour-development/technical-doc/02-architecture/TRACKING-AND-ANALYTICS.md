# Tracking & Analytics — Conversion Architecture

> **Canonical source:** master §8 (`island-tours-platform-master.html` v1.9; deep source `island-tours-typ-tracking-dev-spec.md`).
> **Purpose:** Define the conversion-tracking architecture — one `booking_complete` event on the Thank-You Page (TYP) fanning out to four GTM tags plus a server-side Meta CAPI, with `commission_amount` (EUR) as the conversion value and mark-first idempotency.

> **Status:** Target architecture. **Not yet built** (no payments/Stripe processing, no webhooks, no tracking layer in code today). Cross-references: [`DATA-MODEL.md`](./DATA-MODEL.md) (E.8 bookings — all tracking columns) · [`AVAILABILITY-AND-DEPARTURES.md`](./AVAILABILITY-AND-DEPARTURES.md).

---

## 1. Principles (§8.1)

1. **Conversion value = `commission_amount` in EUR, never GMV.** Smart Bidding learns from real margin, not gross booking total. The conversion value is **always** `bookings.commission_amount`, never `booking_total_eur`.
2. **One `booking_complete` dataLayer event** on the TYP feeds **four GTM tags**: Conversion Linker, Google Ads, GA4 (`purchase`), Meta Pixel. **No per-tour or per-campaign tags.**
3. **Enhanced Conversions / Advanced Matching** on all available **hashed PII** — email, phone (E.164 via `libphonenumber-js`), name, address — hashed **server-side** (SHA-256). One hash pass serves Google and Meta alike.
4. **Server-side Meta CAPI** fires **in parallel** with the browser Pixel, **deduplicated by event id** (iOS 14+ recovery).
5. **Server-side idempotency via `conversion_fired_at`** on the bookings table. Refreshes, email revisits, and shared links never double-fire. **Never `localStorage`.**
6. **Cancellation/refund adjustments** flow back to Google Ads and Meta via API, which requires **click-id (`gclid`, `gbraid`, `wbraid`, `fbclid`) and UTM capture at booking creation** (dev spec §14).
7. **Consent Mode v2** from scratch, regional defaults: **EEA denied by default, US/CA granted.** CMP selection (Cookiebot or Iubenda) precedes the GTM build.

---

## 2. Flow (§8.2)

```
/payment/processing                  lean intermediate page · waits for the webhook · ZERO tags
        │
        ▼
Stripe webhook confirms              idempotent — processed Stripe event ids live in
                                     stripe_webhook_events (dev spec §15); retries are safe
        │
        ▼
302 → /{destination}/thank-you/{public_ref}     (NO locale prefix · noindex)
        │
        ▼
TYP server component                 loads booking · normalizes currency · hashes PII ·
                                     sets conversion_fired_at BEFORE render  (mark-first)
        │
        ▼
TYP client component                 pushes booking_complete ONCE (production only; staging guard)
        │
        ▼
GTM fans out                         Conversion Linker · Google Ads · GA4 purchase · Meta Pixel
        │
        ▼
Meta CAPI                            server-side POST with the SHARED event id (dedup)
```

**Mark-first idempotency.** The server sets `conversion_fired_at` **before render**. A client push that never executes (the user closes the tab) is an **accepted false negative**, never a double fire. The guard is the database column, not client storage.

**`operator_full` bypass.** `operator_full` bookings take **no charge and no webhook**. The booking is created **confirmed at commit** and redirects **straight to the TYP**, where mark-first idempotency and the §3 data contract apply **unchanged** (master §5.8, conflict log 79).

### TYP route

```
/{destination}/thank-you/{bookingRef}        bookingRef = bookings.public_ref (a UUID)
```

- **No locale prefix.** The TYP is a `noindex` transactional surface, so the content-page locale-prefix rule (§2.2) does **not** apply.
- `{bookingRef}` = `public_ref`, a **UUID, never incremental** — booking URLs cannot be enumerated.
- TYP strings localize via **next-intl** using `bookings.customer_locale` (captured at booking under the seven-locale launch scope, §1.3).
- Deadlines render in the **tour-local timezone** per `destination.timezone` (e.g. `America/Curacao`).

---

## 3. Data contract — the `booking_complete` push (§8.3)

Folded in verbatim from tracking dev spec §13. The push carries the **shared event id** for CAPI deduplication, plus:

| dataLayer field | Source | Notes |
|---|---|---|
| `booking_value` | `bookings.commission_amount` | **EUR, always; never `booking_total_eur`** (§8.1 item 1) |
| `booking_currency` | hardcoded `'EUR'` | Tracking currency is always EUR; the customer UI shows `original_currency` |
| `booking_ref` | `bookings.display_ref` | Transaction id for dedupe across all platforms |
| `tour_id`, `tour_name` | `bookings.tour_id`, `tours.name` | GA4 `item_id` and `item_name` |
| `operator_id`, `operator_name` | `bookings.operator_id`, `operators.name` | `item_brand` and segmentation |
| `island` | `bookings.island` | Denormalized at creation |
| `items[]` | composed | `{item_id, item_name, item_brand, item_category, price, quantity: 1}`; `item_category` from `tours.category` |
| `user_id` | `bookings.customer_id` | GA4 cross-device tracking |
| `click_ids.gclid` / `.gbraid` / `.wbraid` / `.fbclid` | the E.8 click-id columns | Google Ads and Meta adjustments, offline conversions |
| `user_data.sha256_email_address` | SHA-256 of lowercased, trimmed `customer_email` | **Required** |
| `user_data.sha256_phone_number` | SHA-256 of the E.164 `customer_phone` | Optional when no phone |
| `user_data.sha256_first_name`, `.sha256_last_name` | SHA-256 of the split name fields | Match rate +20–40% |
| `user_data.address.sha256_city` / `.sha256_postal_code` / `.sha256_country` | SHA-256 of the Stripe billing fields | Optional |

### Contract rules (dev spec §13)

- **One SHA-256 pass** serves Google and Meta alike — never per-platform hashing.
- The payload is **type-checked in CI**; a missing **required** field is a **build error**, not a runtime fallback.
- A confirmed booking with a **null `commission_amount` is data corruption**: render an error and fire **no conversion**. The same no-silent-fallback rule covers a missing cancellation window and an operator with **neither** contact field (E.6).

Where the §13 UI columns disagree with this master, the master governs: the stale 72h payment deadline and `cancellation_window_hours` are superseded by the unified `cancellation_hours` window (§6.2, C4/C5); the unmasked confirmation email by the masked render (§5.9); en-US-only dates by the seven-locale scope (§1.3, E.8 `customer_locale`).

---

## 4. Definition of Done (§8.4)

The dev spec's **37 checks**, headlined by:

- **Tag Assistant** clean fires.
- **GA4 DebugView**: exactly **one `purchase`** per test booking.
- **Meta Events Manager**: **one deduplicated `Purchase`** (browser + CAPI).
- **Enhanced Conversions** match rate **above 60%**.

---

## 5. Supporting infrastructure & current code state

| Concern | Mechanism | Status |
|---|---|---|
| Conversion idempotency | `bookings.conversion_fired_at` (timestamptz, set server-side pre-render) | Not built — Booking model is thin (see [`DATA-MODEL.md` §E.8](./DATA-MODEL.md#e8-bookings)) |
| Webhook idempotency | dedicated `stripe_webhook_events` table (processed event ids) | Not built — no payments/webhook layer |
| Click-id / UTM capture | `gclid`/`gbraid`/`wbraid`/`fbclid` + `utm_*` columns on bookings, captured at creation | Not built |
| PII hashing | SHA-256 server-side, phone normalized via `libphonenumber-js` | Not built |
| Consent | Consent Mode v2 + CMP (Cookiebot/Iubenda) before GTM build | Not built |

The current `Booking` model carries none of the tracking columns (`public_ref`, `display_ref`, `commission_amount`, `conversion_fired_at`, click-ids, UTM, split customer name, billing fields). Building this architecture depends first on the E.8 booking schema and the payments/webhook layer.
