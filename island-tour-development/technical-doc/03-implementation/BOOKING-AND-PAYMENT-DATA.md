# Booking & Payment module - complete data requirements

> Build-ready list of **every piece of data** the Booking + Payment modules need: the `Booking`
> entity and its children (`BookingUnitItem`, `BookingAddOn`), the `Payment` ledger, the four payment
> models, validation, write-ownership, and the gaps still missing from `bookings.prisma` /
> `payments.prisma`. Companion to `TOUR-MODULE-DATA.md`.
>
> Sources reconciled: master E.8 (canonical, wins on conflict), §1.4 (payment models), §6.1-6.5
> (cancellation/balance window), §8.3 (`booking_complete` contract), `BOOKING-AND-PAYMENTS.md`,
> `TRACKING-AND-ANALYTICS.md`, the Figma booking widget (`47659:2339`) + thank-you page
> (`47744:9184`), and the current `bookings.prisma` + `payments.prisma`.
>
> Legend: **✓** present today · **+ TO ADD** required but missing · **W** = writer (`CUST` customer
> at checkout, `SYS` system/webhook, `OP` operator, `ADM` admin, `RO` computed).

---

## 0. Lifecycle at a glance

OCTO reserve -> confirm. **Confirmed instantly on every payment model; no enquiry step.**

```
ON_HOLD (utcExpiresAt, capacity claimed)  ──confirm──>  CONFIRMED  ──>  REDEEMED
        │ expire / cancel                                   │ admin-confirmed request
        ▼                                                   ▼
     EXPIRED / CANCELLED (release capacity)             CANCELLED (full refund if before deadline)

operator_full: created CONFIRMED at commit (no charge, no webhook, no ON_HOLD).
```

Entities: `Booking (1) ──< BookingUnitItem (one per traveler)` · `Booking (1) ──< BookingAddOn` ·
`Booking (1) ──< Payment` · `Booking (1) ──< Review (0..1)`. Idempotent webhooks via
`StripeWebhookEvent`.

---

## 1. The four payment models (master §1.4)

A tour declares one; it is **snapshotted onto the booking** as `paymentModel` at creation.

| `paymentModel` | Charged at checkout (Stripe/Mollie) | Balance | Stripe + webhook? | Created status |
|---|---|---|---|---|
| `OPERATOR_LINK` (default) | `depositPct`% deposit | Operator emails secure link; **not tracked by platform v1** | Yes | `ON_HOLD -> CONFIRMED` |
| `ON_ARRIVAL` | `depositPct`% deposit | Paid in person (card/cash per tour) | Yes | `ON_HOLD -> CONFIRMED` |
| `PAID_IN_FULL` | **100%** | Nothing later | Yes | `ON_HOLD -> CONFIRMED` |
| `OPERATOR_FULL` | **Nothing** | Operator collects full amount directly | **No** | **`CONFIRMED` at commit** |

- `depositPct` is **tier-driven** (20-30 in 2.5 steps), snapshotted with `commissionRate` + `paymentModel`.
- **Zero-amount money rows are hidden.** `OPERATOR_FULL` CTA is the bare "Reserve my spot" (no amount).
- **Commission snapshots at creation, never retroactive.** `commissionAmount` (EUR) is the conversion value - never GMV. A confirmed booking with null `commissionAmount` is data corruption (no conversion fires).

---

## 2. `Booking` entity - field by field

### 2.1 Identity, refs, links  (all ✓)

| Field | Type | W | Notes |
|---|---|---|---|
| `id` | uuid | SYS | PK |
| `uuid` | uuid unique | CUST | OCTO client-supplied idempotency key |
| `tourId` / `operatorId` | FK | SYS | |
| `departureId` | FK? | SYS | null when `freesale` |
| `userId` | FK? | SYS | guest auto-created; accounts auto-created at booking |
| `resellerReference` / `supplierReference` | string? | SYS | OCTO external refs |
| `publicRef` | uuid unique | SYS | TYP URL credential (non-enumerable) |
| `displayRef` | string unique | SYS | `IT-2026-XXXXX`; transaction id + (with email) account login |
| `status` | `BookingStatus` | SYS | `ON_HOLD`/`CONFIRMED`/`CANCELLED`/`REDEEMED`/`EXPIRED`/`PENDING`/`REJECTED` |
| `freesale` / `testMode` | bool | SYS | |
| `island` | string? | SYS | Denormalized destination slug; should be NOT NULL per master (default 'Curaçao') |

### 2.2 Lifecycle timestamps  (✓ + tour datetimes TO ADD)

| Field | Type | W | Notes |
|---|---|---|---|
| `utcExpiresAt` / `utcConfirmedAt` / `utcRedeemedAt` / `utcCancelledAt` | DateTime? | SYS | ✓ |
| `localDate` | Date | SYS | ✓ tour date |
| `startTime` | string? | SYS | ✓ `'HH:MM'` |
| `tourStartDateTime` | DateTime | SYS | **+ TO ADD** - master E.8 core field. TYP time range, calendar invite (ICS), the 24h pre-tour reminder, and `cancelDeadline = start - cancellationHours` all need a full start timestamp, not just date+`'HH:MM'` |
| `tourEndDateTime` | DateTime? | SYS | **+ TO ADD** - master E.8 core field. TYP shows "8:00 AM - 5:00 PM"; derive from start + tour duration, snapshot it |

> Cancellation deadline is **computed, never stored** (`start - cancellationHours`, tour-local) - master §6.2. Do NOT add a column for it.

### 2.3 Snapshot at booking time  (✓ + pickup address TO ADD)

| Field | Type | W | Notes |
|---|---|---|---|
| `paymentModel` | `PaymentModel` | SYS | Snapshotted from tour |
| `currency` | `Currency` | SYS | = master `original_currency` (display/charged currency) |
| `pickupRequested` | bool | CUST | |
| `pickupLocationId` | FK? | CUST | null = meet on site |
| `pickupAddress` | string? | SYS | **+ TO ADD** - master `pickup_address` snapshot (TYP fallback = tour meeting point). Snapshot for booking immutability (the `PickupLocation` row can change) |

### 2.4 Pricing & commission snapshot  (all ✓)

| Field | Type | W | Notes |
|---|---|---|---|
| `totalRetail` | Decimal(10,2) | SYS | = master `original_amount` |
| `totalNet` | Decimal? | SYS | operator net |
| `commissionRate` | Decimal(5,4)? | SYS | snapshot fraction (0.2750 = 27.5%); **never retroactive** |
| `commissionAmount` | Decimal? | SYS | **EUR conversion value**; null = corruption |
| `depositAmount` | Decimal | SYS | paid to Island Tours; 0 on `OPERATOR_FULL` |
| `balanceAmount` | Decimal | SYS | operator-collected balance (master derives `original_amount - deposit_amount`; storing it is fine and matches the TYP "Balance later" row) |
| `taxes` | Json? | SYS | "All taxes and fees included" |
| `totalEur` | Decimal? | SYS | = master `booking_total_eur` |
| `fxRateToEur` | Decimal(12,6)? | SYS | snapshot at booking time (audit) |

### 2.5 Party composition  (**+ TO ADD** - master E.8 core fields)

Master E.8 lists `adults_count`, `children_count`, **plus child ages** as core booking fields, and the
TYP renders "2 adults, 1 child". Today party is only derivable by counting `BookingUnitItem` rows.

| Field | Type | W | Notes |
|---|---|---|---|
| (counts) | int | RO | `adultsCount`/`childrenCount`/`infantsCount` - **derive** from `BookingUnitItem` grouped by `ageBand.bandType` (no columns needed unless you want them denormalized) |
| `travelerAge` | int? | CUST | **+ TO ADD on `BookingUnitItem`** - master "children_count plus child ages"; not derivable from `ageBandId` alone; needed for min-age enforcement + equipment + tracking |

### 2.6 Contact (OCTO Contact; guest override of User)  (✓ + special requests cap)

| Field | Type | W | Notes |
|---|---|---|---|
| `contactFirstName` / `contactLastName` | string? | CUST | **split** for Enhanced Conversions hashing (master §5.8) |
| `contactFullName` | string? | CUST | |
| `contactEmail` | string? | CUST | confirmation + account login |
| `contactPhone` | string? | CUST | **E.164** (master: normalized via libphonenumber-js); "tour-day coordination" |
| `contactCountry` | string? | CUST | dial code "+599" shown in widget |
| `contactPostalCode` | string? | CUST | |
| `contactLocales` | string[] | CUST | |
| `notes` | string? | CUST | = "Special requests (optional)". **Cap 500 chars** (Figma "Max 500 characters") in the DTO |
| `newsletterOptIn` | bool | CUST | **+ TO ADD** - Figma "Send me the good stuff..." marketing opt-in collected at checkout |

### 2.7 Attribution & tracking  (all ✓ - `booking_complete` contract, master §8.3)

`utmSource/Medium/Campaign/Term/Content`, `clickId` (gclid), `gbraid`, `wbraid`, `fbclid`,
`affiliateId` (Trackdesk), `customerLocale`, `customerId` (hashed email - GA4 user_id), `island`,
`conversionFiredAt` (mark-first idempotency). `booking_value` = `commissionAmount` (EUR), `booking_ref`
= `displayRef`. All present.

### 2.8 Billing snapshot (from Stripe payment method; null on `OPERATOR_FULL`/`ON_ARRIVAL`)  (all ✓)

`billingCountry`, `billingPostalCode`, `billingCity`, `paymentMethodLast4`, `paymentMethodBrand` -
pulled at webhook, no form friction.

### 2.9 Cancellation  (all ✓)

`cancellationRefund` (`FULL`/`PARTIAL`/`NONE`), `cancelledBy` (`CUSTOMER`/`OPERATOR`/`ADMIN`/`SYSTEM`),
`cancellationReason`, `utcCancelledAt`. Flow: tokenized confirm page -> manual request -> admin marks
`CANCELLED` -> notify both parties. Deadline judged on **request timestamp**, not admin action.

### 2.10 Coupon / discount  (**+ TO ADD - design-derived, confirm against commercial model**)

The booking widget has an "Apply" promo field. Not defined in master E.8.

| Field | Type | W | Notes |
|---|---|---|---|
| `couponCode` | string? | CUST | **+ TO ADD** entered at checkout |
| `discountAmount` | Decimal? | SYS | **+ TO ADD** applied discount (original currency) |

> Needs a `Coupon` entity (code, type %/flat, validity, usage caps, scope). **Confirm with the
> commercial model before building** - it is not in the master tables and affects commission math.

---

## 3. `BookingUnitItem`  (one per traveler/ticket)  (✓ + `travelerAge` TO ADD)

| Field | Type | W | Notes |
|---|---|---|---|
| `id` / `uuid` | uuid | SYS | OCTO ticket uuid |
| `bookingId` | FK | SYS | cascade |
| `ageBandId` | FK | SYS | priced at the band it was sold at; **spectators flow here** via a `SPECTATOR`-participation band (see `TOUR-MODULE-DATA.md` §2.2) |
| `status` / `utcRedeemedAt` | enum / DateTime? | SYS | per-ticket redemption |
| `contactFirstName` / `contactLastName` | string? | CUST | optional per-unit |
| `travelerAge` | int? | CUST | **+ TO ADD** - master child ages; min-age enforcement |
| `priceRetail` / `priceNet` | Decimal | SYS | snapshot |
| `ticketCode` / `ticketDeliveryFormat` / `ticketUrl` | string?/enum?/string? | SYS | OCTO delivery artifact |

---

## 4. `BookingAddOn`  (snapshot line item)  (all ✓)

`addOnId` (soft ref), `name`, `unit` (`PER_PERSON`/`FLAT`), `quantity`, `unitPrice`, `totalPrice` -
fully snapshotted so a later edit/delete of the `TourAddOn` never mutates a placed booking. Paid pickup
(`PAID_ADDON`) charges through here. Spectators are NOT add-ons (they are unit items, §3).

---

## 5. `Payment` ledger + webhooks

### 5.1 `Payment`  (✓ + method type / Mollie ledger TO ADD)

| Field | Type | W | Notes |
|---|---|---|---|
| `id` / `bookingId` | uuid / FK | SYS | |
| `provider` | `PaymentProvider` | SYS | `STRIPE` / `MOLLIE` |
| `kind` | `PaymentKind` | SYS | `DEPOSIT` / `BALANCE` / `FULL` / `REFUND`. v1: no `BALANCE` rows for `OPERATOR_LINK` (operator's transaction, untracked) |
| `status` | `PaymentStatus` | SYS | `REQUIRES_PAYMENT`/`PROCESSING`/`SUCCEEDED`/`FAILED`/`REFUNDED`/`PARTIALLY_REFUNDED`/`CANCELLED` |
| `amount` / `currency` | Decimal / `Currency` | SYS | |
| `intentId` / `chargeId` / `refundId` | string? | SYS | Stripe/Mollie ids |
| `raw` | Json? | SYS | provider payload snapshot |
| `methodType` | string? | SYS | **+ TO ADD** - Figma offers Card / PayPal / Apple Pay / Google Pay; capture which was used (card brand/last4 already on `Booking`) |

### 5.2 `StripeWebhookEvent`  (✓ + Mollie coverage)

Idempotent ledger keyed by provider event id (`id`, `type`, `processedAt`, `payload`). **+ TO ADD if
Mollie is live:** a parallel `MollieWebhookEvent` (or generalize to `ProviderWebhookEvent` with a
`provider` column) so Mollie callbacks are equally idempotent. Webhooks bypass AuthGuard + Throttler
(`@Public()` + `@SkipThrottle()`), verify signatures, and are idempotent.

---

## 6. Gaps to add  (booking + payment)

| # | Change | Where | Basis |
|---|---|---|---|
| 1 | Add `tourStartDateTime` + `tourEndDateTime` | `Booking` | Master E.8 core; TYP time range, ICS, 24h reminder, deadline calc |
| 2 | Add `travelerAge` int? | `BookingUnitItem` | Master "children_count plus child ages"; min-age enforcement |
| 3 | Add `pickupAddress` string? snapshot | `Booking` | Master `pickup_address` (TYP fallback); booking immutability |
| 4 | Add `newsletterOptIn` bool | `Booking` | Figma checkout opt-in |
| 5 | Cap `notes` at **500** chars | DTO | Figma "Max 500 characters" |
| 6 | Make `island` NOT NULL (default 'Curaçao') | `Booking` | Master E.8 (`NOT NULL`) |
| 7 | Add `methodType` string? | `Payment` | Figma 4 payment methods |
| 8 | Mollie webhook idempotency | `payments.prisma` | If Mollie live: `MollieWebhookEvent` or generalize ledger |
| 9 | (design) `couponCode` + `discountAmount` + `Coupon` entity | `Booking` + new | Figma "Apply"; **confirm vs commercial model first** - not in master |

> **Optional/derive (not required):** `adultsCount`/`childrenCount`/`infantsCount` denormalized
> counts - derivable from `BookingUnitItem` by `ageBand.bandType`; add only if a hot query needs them.

**Already complete (do NOT re-add):** `publicRef`/`displayRef`, full commission + EUR-normalization
block, `paymentModel` snapshot, split contact name + E.164 phone + locale, billing snapshot, all UTM
+ click-id attribution, `conversionFiredAt`, `BookingUnitItem`, `BookingAddOn`, Stripe ledger. The
`DATA-MODEL.md` "Booking is thin" note is **stale** - the schema already covers E.8.

---

## 7. Naming reconciliations (schema <-> master; semantics match, no change needed)

| Schema | Master E.8 | |
|---|---|---|
| `currency` (`Currency` enum) | `original_currency` char(3) | same |
| `totalRetail` | `original_amount` | same |
| `totalEur` | `booking_total_eur` | same |
| `fxRateToEur` | `fx_rate_to_eur` | same |
| `contactFirstName/LastName` | `customer_first_name/last_name` | same (split) |
| `contactEmail/Phone` | `customer_email/phone` | same |
| `customerId` | `customer_id` (hashed email) | same |
| `notes` | special requests | same (cap 500) |

---

## 8. Figma traceability

### 8.1 Booking widget (`47659:2339`)

| UI element | Data source |
|---|---|
| Calendar, slot chips ("1:00 PM Selected", "Sold out", "Only 2 left") | `Departure` (E.9) `status`, `vacancies` |
| Adult (13+) / Child (4-12) $65 / Infant (0-3) Free | `TourAgeBand` -> `BookingUnitItem` per traveler |
| "Bringing Spectators? Adult $20 / Kid $10", "Spectators x 2 x $20" | `SPECTATOR` band -> `BookingUnitItem` |
| Add-ons; "Pickup location (From $17 p.p.)" | `BookingAddOn`; `pickupLocationId` (+ `pickupAddress` snapshot) |
| "Apply" promo | **`couponCode`/`discountAmount` (gap #9)** |
| Pay today 20% / Balance later, "taxes included" | `depositPct`+`paymentModel`; `depositAmount`/`balanceAmount`/`taxes` |
| Contact: name, email, country (+599), phone (E.164), special requests (<=500), newsletter | `contact*`; `notes`; **`newsletterOptIn` (gap #4)** |
| Payment: Card / PayPal / Apple Pay / Google Pay, name on card, postal | `Payment` (+ **`methodType` gap #7**); billing snapshot |

### 8.2 Thank-you page (`47744:9184`)

| UI element | Data source |
|---|---|
| "You're booked, Denley!", "Guest lead", "2 adults, 1 child" | `contactFirstName`; party from `BookingUnitItem` (counts §2.5) |
| "Booking ref: IT-2026-04821" | `displayRef` |
| "Date & time 8:00 AM - 5:00 PM", "Duration 9 hour" | **`tourStartDateTime`/`tourEndDateTime` (gap #1)** + tour duration |
| "Free cancel: Before Sunday, 26 May" | **derived** (`start - cancellationHours`) |
| "Add to calendar" (ICS) | `tourStartDateTime`/`End` + tour title + meeting point |
| "Pickup: At your accom" | `pickupLocationId` / `pickupAddress` |
| Deposit $40 (20%) / balance $160 / "Pay before" / Total | `depositAmount`/`balanceAmount`/`totalRetail` |
| "Mastercard *****4242" | `paymentMethodBrand` + `paymentMethodLast4` |
| "Trip: Miss Ann Boat Trips", "Email: ...", "Phone: +599 ..." | **Operator** `displayName`/company + `contact_email`/`contact_phone` (E.6 - operator-module gap) |
| "Islanders also love... pair with your booking" | cross-sell tours (ranking) |

---

## 9. Write-ownership & API surface

- **Customer (checkout):** party (`BookingUnitItem` + `travelerAge`), `contact*`, `notes`,
  `pickupLocationId`, add-on selections, `couponCode`, `newsletterOptIn`, payment method.
- **System/webhook:** all refs, status transitions, commission/EUR snapshot, `paymentModel`,
  billing snapshot, `conversionFiredAt`, capacity claim, `Payment` rows, ticket artifacts.
- **Admin:** cancellation confirmation (sets `CANCELLED`, refund), deposit-forfeit confirmation,
  force-majeure full refund/reschedule.
- **Operator:** reports non-payment (admin confirms); operator-forced cancellation.

| Method | Route (base `/api/v1`) | Purpose |
|---|---|---|
| `POST` | `/bookings` | Reserve (`ON_HOLD`, claim capacity); `OPERATOR_FULL` -> `CONFIRMED` |
| `POST` | `/bookings/:id/confirm` | Confirm after charge settles |
| `GET` | `/bookings/:publicRef` | TYP lookup (public token) |
| `GET` | `/bookings` | Account list (email + `displayRef`, rate-limited) |
| `POST` | `/bookings/:id/cancel-request` | Tokenized request -> admin queue |
| `PATCH` | `/bookings/:id/cancel` | Admin marks `CANCELLED` + refund |
| `POST` | `/payments/intent` | Create Stripe/Mollie intent (deposit/full) |
| `POST` | `/webhooks/stripe` | `@Public()` `@SkipThrottle()`; signature-verified, idempotent |

RBAC: `VIEW_BOOKINGS`/`MANAGE_BOOKINGS`/`EDIT_BOOKING`, `VIEW_PAYMENTS`/`MANAGE_PAYMENTS`. Booking
creation is public (guest). Guard order unchanged.
