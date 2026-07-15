# Payment Settlement & Payouts

> Canonical source: master §1.4, §5.8, §7.1, conflict log C22/C23/B.85 (`island-tours-platform-master.html` v1.9).
> Companion docs: [BOOKING-AND-PAYMENTS.md](./BOOKING-AND-PAYMENTS.md) · [COMMERCIAL-MODEL.md](./COMMERCIAL-MODEL.md) · [../03-implementation/BOOKING-FLOW-DESIGN-GUIDE.md](../03-implementation/BOOKING-FLOW-DESIGN-GUIDE.md) · [../MASTER-CHECKLIST.md](../MASTER-CHECKLIST.md)
> Visual companion: [settlement-payout-flow.html](./settlement-payout-flow.html)

This document resolves the two "open settlement rails" flagged in the master (conflict log C23): operator payout on `paid_in_full` (the platform holds 100%) and commission collection on `operator_full` (the platform holds nothing). Part 1 is the analysis and industry benchmark. Part 2 is the locked v1/v2 decision.

---

## Part 1 - Analysis: how settlement should work

### First, the key reframe

Your four models are really **one target with three deviations**. The platform's goal on every booking is to end up holding exactly its `commission`. Look at what each model collects at checkout versus that target:

| Model | Collected at checkout | vs. commission target | Settlement needed |
|---|---|---|---|
| Deposit models | `deposit` (≈ commission by design) | roughly equal | none (self-settling) |
| `paid_in_full` | 100% | **over-collects** | pay the operator back the net |
| `operator_full` | 0% | **under-collects** | collect commission from the operator |

This is why your deposit models are "resolved" and the other two are open: the deposit is deliberately sized near the commission rate (your `deposit_pct` steps 20/22.5/25/27.5/30 line up with the tier commission rates), so IT keeps its deposit as its cut and the operator keeps the balance. No transfer needed. `paid_in_full` and `operator_full` are just the two ends where checkout collection and commission diverge maximally.

So the two "open rails" are the two classic marketplace money-flow problems:
- **`paid_in_full` = the payout problem** (platform holds money, owes the supplier net).
- **`operator_full` = the commission-collection problem** (supplier holds money, owes the platform its cut).

### How the global leaders do it

There are exactly two archetypes, and every big travel platform is one, the other, or moving between them:

| Platform | Model | How the money settles |
|---|---|---|
| **Viator** (Merchant API), **GetYourGuide**, **Klook** | Merchant of record (= your `paid_in_full`) | Traveler pays the OTA in full. OTA keeps commission, **remits net to the operator on a schedule**. Viator: monthly, ~21 business days after the travel month (weekly PayPal option). GYG: monthly default, bi-weekly for +2% commission. |
| **Airbnb** | Merchant of record + fast payout | Guest pays Airbnb in full; host is **paid out ~24h after check-in**, net of fees, via Payoneer/bank/PayPal. |
| **Booking.com** (legacy) | Pay-at-property (= your `operator_full`) | Guest pays the hotel directly. Booking.com **invoices the hotel monthly for commission** and collects by direct debit / bank transfer / virtual card. |

The important lesson from that last row: the pay-at-property / `operator_full` model is real and viable (Booking.com ran a global business on it for two decades), **but it is the one everyone is trying to get away from** because commission collection has leakage, disputes, and reconciliation cost. That's precisely why Booking.com pushed "Payments by Booking.com" to become merchant of record. Nobody builds *toward* the operator-collects model on purpose; they tolerate it because suppliers demand it.

### The standard tool: Stripe Connect

The modern, standard way to implement all of this is **Stripe Connect with destination charges + `application_fee_amount`**. You charge the traveler on your platform account, Stripe routes the funds to the operator's connected account, and your commission is skimmed automatically as the application fee. Stripe handles the operator payout, its schedule, FX, and gives you built-in fee reconciliation. This maps cleanly:

- **`paid_in_full`** -> destination charge, `application_fee_amount = commission`. Operator gets net automatically, you get commission, Stripe pays out on schedule. **Fully solved, machine-readable, zero manual work.**
- **Deposit models** -> charge the deposit as a destination charge with the fee; over time you can route the balance through Connect too and retire the "off-platform balance" concept.
- **`operator_full`** -> this is the catch (below).

### The one hard truth about `operator_full`

**You cannot automatically collect a commission on money that never touches your platform.** Connect can only take a fee on a charge Stripe processes. So there are only two honest ways to close the `operator_full` rail:

1. **Route the money through the platform** (traveler pays via Connect, operator gets net). This makes it trackable and auto-collects commission, but it **stops being `operator_full`** as your product currently defines it (operator collecting cash/directly). It effectively collapses into `paid_in_full`.
2. **Keep it truly off-platform and invoice for commission** (the Booking.com legacy model): monthly self-billed commission invoice + SEPA direct-debit mandate or card-on-file, with listing suspension on non-payment. This preserves the product but keeps the leakage/collection risk and cannot be made machine-readable in v1.

There is no third option. This is a product decision, not an engineering one.

### What I recommend for Island Tours

**Strategic direction: converge on merchant-of-record via Stripe Connect for everything that can flow through the platform.** It is where every mature marketplace ends up, it kills commission leakage, and it directly satisfies the requirement that *every transaction stays trackable* (off-platform legs are, by definition, not trackable).

Phased so it doesn't block v1:

**Phase 1 (now, no Connect) - build the settlement ledger, execute manually:**
- Add a `settlements` ledger that records, per booking, `amount_collected`, `commission_owed`, and `net_position` (positive = IT owes operator, negative = operator owes IT). Every model writes a row, even deposit models (delta usually ~0).
- `paid_in_full`: scheduled **manual net payout** per operator per cycle, released **after the cancellation window closes / tour completion** (clawback-safe, and it matches the master's "revenue recognized on tour completion" and the affiliate on-hold-then-approve lifecycle).
- `operator_full`: **monthly commission invoice**, collected via bank transfer / direct debit. Require a payment method or mandate on file at operator onboarding; suspend listings on non-payment (you already have the manual admin-confirm pattern from the forfeit flow).
- The ledger is the important part: build it now so Phase 2 just changes the *executor*, not the data model.

**Phase 2 (Stripe Connect Express):**
- Onboard operators as Express connected accounts.
- `paid_in_full` and deposit models -> destination charges with `application_fee_amount = commission`. Automatic, reconciled, machine-readable. The ledger gets populated from Stripe events instead of manual entry.
- `operator_full` -> force the product decision: either route it through Connect (recommended: restrict/deprecate true off-platform collection, or gate it behind a card-on-file mandate), or keep it as invoice-only and accept it will never be machine-readable.

**Decision to put to Arnav:** the real question behind both rails is *"is Island Tours the merchant of record?"* Say yes (via Connect) and `paid_in_full` and the deposit balances all solve themselves and become trackable. The only genuinely open policy question left is whether `operator_full` is allowed to remain truly off-platform, and if so, how aggressively you mitigate collection risk.

---

## Part 2 - Locked decision (founder, 2026-07-15)

This is the phased decision from Ash. It supersedes the two OPEN flags in the checklist for v1 scope.

### V1 payment models

V1 ships with **three** payment models. `operator_full` is **dropped from v1**.

| `payment_model` | v1 status | Checkout leg | Settlement in v1 |
|---|---|---|---|
| `operator_link` | Live | `deposit` to Island Tours via Stripe/Mollie | **Self-settling.** `deposit_pct == commission`, so IT keeps the deposit as its commission; the operator collects the balance directly (secure payment link). No transfer. |
| `on_arrival` | Live | `deposit` to Island Tours via Stripe/Mollie | **Self-settling.** Same as above; the operator collects the balance in person. |
| `paid_in_full` | Live | `total` (100%) to Island Tours via Stripe/Mollie | **Scheduled payout (clawback-safe).** IT retains its `commission`; the remainder (`total - commission`) is paid out to the operator on a schedule after the cancellation window closes. |
| `operator_full` | **Removed in v1** | none | Returns in **v2** via Stripe Connect **or** direct bank transfer. |

### The three decisions in detail

**1. Deposit models (`operator_link`, `on_arrival`) - commission equals deposit.**
- We treat `commission == deposit_pct`. Island Tours collects the deposit, which **is** its commission take; the rest of the booking amount is received by the tour operator directly, exactly as described in [BOOKING-AND-PAYMENTS.md](./BOOKING-AND-PAYMENTS.md) §1 and [BOOKING-FLOW-DESIGN-GUIDE.md](../03-implementation/BOOKING-FLOW-DESIGN-GUIDE.md) §2.
- No cross-transfer and no settlement action are required for these models. The `settlements` row exists for record-keeping only (`net_position` ~ 0).
- Engineering note: because we lock `commission == deposit_pct` for these models, keep the two values consistent per tier so the self-settling property holds. If a tour ever has `deposit_pct != commission`, a residual appears and must be reconciled through the ledger.

**2. `paid_in_full` - platform commission retained, remainder paid out to the operator in a single booking flow but in a queue so that it not awaiting the booking of traveller.** (depricated- see the Note below)
- This is documented as the v1 behavior. **Open for phase 2:** decide whether `paid_in_full` should be formalized as a proper **payout model** (scheduled, clawback-safe payouts via Stripe Connect destination charges) rather than an immediate in-flow payout. This question is deliberately carried forward - see V2 below.
- Engineering note (carry to phase 2): an immediate in-flow payout is not clawback-safe against cancellations inside the free-cancellation window. If a traveler cancels and is refunded after the operator has already been paid, IT must recover the net from the operator. A scheduled payout released after the cancellation window closes (the Viator/Airbnb pattern) removes this risk. A true in-flow split also generally requires Stripe Connect (destination charge with `transfer_data`); without Connect, the "single flow payout" is a manual/near-real-time transfer recorded against the ledger row.
**NOTE AS PER ENGINNER NOTE WE WILL IMPLEMENT SCHEDULED PAYOUT RELEASE AFTER THE CANCELLATION. WINDOW**



**3. `operator_full` - deferred to v2.**
- Not offered in v1. Reintroduced in v2 using **Stripe Connect or direct bank transfer**, at which point the commission-collection rail (invoice + collection, or Connect application fee) is specified.

### The settlements ledger (build in v1, extend later)

Add a `settlements` ledger so every booking has a settlement record from day one, even when no transfer happens. This is the extension point that lets us grow into scheduled payouts, Connect, and `operator_full` in v2 without a data-model rewrite.

Minimum fields (per the founder decision):

```prisma
model Settlement {
  id               String        @id @default(uuid())
  bookingId        String        @unique
  booking          Booking       @relation(fields: [bookingId], references: [id])
  operatorId       String
  paymentModel     PaymentModel

  // Core ledger (locked minimum)
  amountCollected  Decimal       @db.Decimal(10, 2)  // what IT collected at checkout (EUR)
  commissionOwed   Decimal       @db.Decimal(10, 2)  // IT's commission (EUR)
  netPosition      Decimal       @db.Decimal(10, 2)  // + = IT owes operator; - = operator owes IT

  // Extension hooks (nullable in v1, used by v2 payouts/Connect)
  currency         Currency      @default(EUR)
  operatorPayout   Decimal?      @db.Decimal(10, 2)  // amount paid out to the operator (paid_in_full)
  status           SettlementStatus @default(RECORDED) // RECORDED | PAID_OUT | INVOICED | SETTLED
  settledAt        DateTime?
  externalRef      String?       // Stripe transfer id / payout id / invoice id (v2)

  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  @@index([operatorId, status])
  @@index([status])
  @@map("settlements")
}
```

Row semantics per v1 model:

| Model | `amountCollected` | `commissionOwed` | `netPosition` | Action |
|---|---|---|---|---|
| `operator_link` | `deposit` | `commission` (= deposit) | ~ 0 | record only |
| `on_arrival` | `deposit` | `commission` (= deposit) | ~ 0 | record only |
| `paid_in_full` | `total` | `commission` | `+ (total - commission)` | scheduled payout after cancellation window; `status = RECORDED` until the window closes, then `PAID_OUT` (set `operatorPayout`) |

- `net_position` sign is fixed: **positive means Island Tours owes the operator; negative means the operator owes Island Tours.**
- Every booking writes exactly one settlement row at confirmation, regardless of model.
- In v2 the same table absorbs `operator_full` (negative `net_position`, `status = INVOICED`) and scheduled Connect payouts (`externalRef` = Stripe transfer/payout id).

### Tracking stays unchanged

Settlement is separate from conversion tracking. Regardless of model, exactly one `booking_complete` fires with `booking_value = commission_amount` in EUR (never GMV). See [TRACKING-AND-ANALYTICS.md](./TRACKING-AND-ANALYTICS.md). The settlements ledger is the money-movement record; the conversion event is the marketing-value record. They must never be conflated.

---

## Part 3 - V2 scope (carried forward)

Documented now so phase-2 work has a target, not built in v1.

- **Reintroduce `operator_full`** using Stripe Connect **or** direct bank transfer, with the commission-collection rail specified (Connect application fee, or self-billed monthly commission invoice + SEPA/card-on-file mandate + listing suspension on non-payment).
- **Automate the `paid_in_full` scheduled payout:** the payout model is decided - a scheduled, clawback-safe payout released after the cancellation window closes. V1 runs this manually/batched against the ledger; v2 automates it via a Stripe Connect destination charge (`application_fee_amount = commission`) with the transfer released on the same post-window schedule.
- **Onboard operators as Stripe Connect Express accounts**; migrate deposit models and `paid_in_full` to destination charges so the settlements ledger is populated from Stripe events instead of manual entry.
- **Machine-readable balances:** routing the operator balance through Connect makes the currently off-platform legs (`operator_link` balance, `on_arrival` balance) verifiable, closing the "not machine-readable in v1" gap (conflict log B.85).

---

## References

- [Stripe: Create destination charges](https://docs.stripe.com/connect/destination-charges)
- [Stripe: Collect application fees](https://docs.stripe.com/connect/marketplace/tasks/app-fees)
- [Stripe: Understand how charges work in a Connect integration](https://docs.stripe.com/connect/charges)
- [Stripe: Accept a payment using destination charges](https://docs.stripe.com/connect/marketplace/tasks/accept-payment/destination-charges)
- [Viator vs GetYourGuide 2026: Commission, Payouts](https://automate.travel/blog/viator-vs-getyourguide-for-operators/)
- [Tour OTA Commission Rates 2026 (Viator, GYG, Klook)](https://www.sambahq.com/ota-supplier-guide/ota-commission-rates)
- [OTA Commission Models for Tour Operators](https://otaplaybook.com/ota-commission-models/)
- [Viator Merchant API (merchant of record)](https://partnerresources.viator.com/travel-commerce/merchant/)
