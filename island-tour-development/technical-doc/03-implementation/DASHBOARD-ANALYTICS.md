# Dashboard Analytics

> Built 2026-07-20. Backend: `backend/src/analytics/`. Dashboard UI:
> `tripwheel-x-islandtours-dashboard/components/statistics.tsx`.
> Canonical business rules: master §1.4, §5.8 (`island-tours-platform-master.html` v1.9),
> [SETTLEMENT-AND-PAYOUTS.md](../02-architecture/SETTLEMENT-AND-PAYOUTS.md),
> [FX-AND-MULTI-CURRENCY.md](../02-architecture/FX-AND-MULTI-CURRENCY.md).

---

## 1. Why this module exists

The dashboard overview was fed by a server action that assembled numbers from 22 list
endpoints. It had four defects that made it unfit to run a business on:

1. **Revenue summed only the first 100 payments** (`/payments?limit=100`), silently
   under-reporting past that page.
2. **Mixed currencies were added together** under a hardcoded `$`, so USD and EUR rows
   were summed as if they were the same unit.
3. **`Total Customers` was the literal constant `0`**, and "No customers yet" was the
   else-branch of a value also pinned to `0`. It was not computed from anything.
4. **The 6-month trend charts were fabricated**: one real current-month value multiplied
   by a fixed `0.6 / 0.7 / 0.8 / 0.85 / 0.9 / 1.0` ramp, with hardcoded `Jun`-`Nov`
   labels that never moved with the calendar. Both empty-state guards were short-circuited
   with `|| true // Forced true for mock visualization`, so a brand-new tenant saw a
   flat-zero chart instead of an empty state.

`Inquiries & Leads` and `Customer Insights` were hardcoded zeros with no backing model.

**The rule for this module: every number is a live aggregate. A zero on screen means the
query genuinely returned zero. Nothing is estimated, extrapolated, or placeheld.**

---

## 2. The money model, and why the payload is role-shaped

Per master §1.4/§5.8, the traveler pays the tier-driven **deposit (20-30%) to Island Tours**
at checkout, and that deposit **is** the platform's commission. The operator keeps the
balance, collected on their own rails.

| Model | IT collects at checkout | Operator collects | Platform tracks the operator's half? |
|---|---|---|---|
| `OPERATOR_LINK` (default) | deposit | balance, via their link | **No** (conflict log 84-85) |
| `ON_ARRIVAL` | deposit | balance, in person | **No** |
| `PAID_IN_FULL` | 100% | nothing | Yes, and IT **owes** them the net |
| `OPERATOR_FULL` | nothing | everything | Dropped for v1 |

So admin and operator hold **opposite halves of the same booking**, and "revenue" is a
different number for each. `GET /analytics/dashboard` returns the same keys with
audience-dependent meaning:

| Field | ADMIN | OPERATOR |
|---|---|---|
| `earnedEur` | commission earned | retail minus commission |
| `commissionEur` | what the marketplace made | what they **paid** the marketplace |
| `payoutDueEur` | liability owed **out** to operators | money owed **to** them |
| `untrackedBalanceEur` | balance never flowing through IT | their own off-platform takings |
| `cashCollectedEur` / `refundedEur` | Stripe ledger | **null** (not applicable) |
| `customers.registered` | USER-account count | **null** (not their data) |
| `breakdowns.topOperators` / `topDestinations` / `byTier` | populated | **empty** (no cross-operator leakage) |

### Three honesty rules baked into the code

- **Recognition on completion.** `earnedEur` counts `REDEEMED` bookings only, per the
  master's "revenue is recognized on tour completion". Confirmed-but-not-travelled money
  is reported separately as `pendingEur` and must never be added to earned.
- **`untrackedBalanceEur` is EXPECTED, never received.** The platform does not track the
  operator-rails balance in v1. Every surface showing it must say so.
- **`payoutDueEur` is earned-and-unsettled.** No settlements ledger exists yet
  (SETTLEMENT-AND-PAYOUTS Phase 1 is unbuilt), so this is what is owed, not what is unpaid.

---

## 3. Data-layer traps this module handles

- **Refunds are double-recorded.** A refund flips the original payment to `REFUNDED`
  *and* writes a separate `kind = REFUND` row. Gross counts `SUCCEEDED` inbound kinds
  only; refunds count `REFUND` rows only. Summing `status = 'REFUNDED'` would double count.
- **Mixed currency.** Every money aggregate multiplies by the booking's own snapshotted
  `fxRateToEur`, so a USD/EUR ledger sums correctly and historically. Never a live rate.
- **Guest bookings.** A customer is a distinct booker keyed by
  `COALESCE(userId, lower(contactEmail))`. `reserve()` writes `userId: null` for guests,
  so counting `User` rows alone would report zero customers while bookings flow.
- **Freesale bookings.** "Upcoming" keys off `booking.localDate`, not the `departure`
  relation, because freesale bookings carry `departureId: null`.
- **Trend bucketing.** Earnings bucket by `utcRedeemedAt` (recognition), booking volume by
  `createdAt`. Empty buckets are emitted as real zeros so the axis stays continuous.

---

## 4. API

```
GET /api/v1/analytics/dashboard?granularity=month|day&buckets=2..24
@RequirePermissions(VIEW_ANALYTICS)
```

Scope follows the caller: `ADMIN`/`STAFF`/`EDITOR` are platform-wide, `TOUR_OPERATOR`
resolves to its own `operatorId` (mirrors `isPlatformWideBookingRole` in bookings.service,
so a KPI can never exceed what the caller's booking list justifies).

Response blocks: `revenue`, `bookings` (incl. `byPaymentModel` + `funnel`), `trips`,
`customers`, `payments`, `trend`, `breakdowns`, `recent`, plus `fx`.

**`fx`** carries one live `EUR -> USD` rate so the UI renders both currencies from a single
conversion. It is `null` when no fresh rate exists, and the UI then shows EUR alone rather
than converting at a stale rate.

**`bookings.funnel`** is labelled "booking outcomes", not a marketing funnel: the platform
stores only a booking's *current* status and has no view/cart event store, so pre-booking
steps cannot be reported honestly. It reports `created -> committed -> completed` with
`commitRate`, `completionRate`, `expiryRate`, `cancellationRate`.

---

## 5. Verified against live data (2026-07-20)

Platform scope, against the demo-seeded DB (263 bookings):

| Figure | Value |
|---|---|
| Commission earned (REDEEMED) | 8,914.30 EUR |
| Commission pending (CONFIRMED) | 3,568.30 EUR |
| GMV | 50,154.14 EUR |
| Payouts due to operators | 11,419.19 EUR |
| Untracked operator-rail balance | 26,279.74 EUR |
| Stripe cash collected / refunded | 23,874.29 / 2,006.68 EUR |
| Customers (distinct bookers) | 15 (12 registered) |
| Funnel | 263 created, 80.6% commit, 70.8% completion, 9% cancellation |

Operator scope (Miss Ann Boat Trips) correctly returns the **other** half: `earnedEur`
9,282.78 (net), `commissionEur` 3,112.36 (paid to IT), `cashCollectedEur` null,
`registered` null, `topOperators` empty.

Tests: `backend/src/analytics/analytics.service.spec.ts` (15). Full backend suite 1228 pass.

---

## 6. Status

- [x] Backend `analytics` module, role-shaped, EUR-normalized, FX dual-currency
- [x] Booking outcomes funnel + payment-model mix + breakdown leaderboards
- [x] Dashboard rewired to a single aggregate call (22-request fan-out removed)
- [x] All fabricated series, forced empty-state guards, and unbacked cards removed
- [ ] Settlements ledger (SETTLEMENT-AND-PAYOUTS Phase 1) - `payoutDueEur` becomes
      *unsettled* rather than *earned* once it exists
- [ ] Operator-rails balance tracking - would retire `untrackedBalanceEur`'s caveat
- [ ] Pre-booking funnel (views, add-to-cart) - needs a tracking event store
