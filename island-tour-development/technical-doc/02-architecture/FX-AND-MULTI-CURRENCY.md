# FX & Multi-Currency

> Canonical reference for how currency conversion works across the platform. Derives from
> `BOOKING-FLOW-DESIGN-GUIDE.md` sections 20-23. If anything here disagrees with the master
> (`island-tours-platform-master.html` v1.9), the master wins.
>
> Status: backend M1 (FX foundation) + M2 (pricing/quote/reserve wiring) + M3 (public-API
> display conversion via `money`) BUILT and tested. M4 (refresh scheduler + real provider)
> and M5 (frontend) are tracked in `03-implementation/BOOKING-CHECKLIST.md` section 6.

---

## The one rule

**The frontend never computes or fetches FX rates.** All conversion happens in
`FxRatesService` (backend). Any rate used for money is **snapshotted onto the booking** at
reserve time and never refetched afterwards, so a historical booking's charged amount and
commission never drift.

---

## The pieces (`backend/src/fx/`)

| File | Role |
|---|---|
| `prisma/fx.prisma` -> `FxRate` | Rate cache + immutable history. One active row per pair (`USD->EUR`, `EUR->USD`) with `rate`, `provider`, `providerAsOf`, `expiresAt`, `isActive`. A refresh writes a NEW row and flips the prior active row `isActive=false`. |
| `fx-provider.interface.ts` | `FxProvider` interface + `FX_PROVIDER` DI token + `FxQuote`/`ProviderRate`/`FxPair` types. The swappable seam - booking/tour code never touches a provider response shape. |
| `providers/static-fx.provider.ts` -> `StaticFxProvider` | The provider wired RIGHT NOW. Derives `USD<->EUR` from `FX_USD_TO_EUR` (default `0.92`) with no network call, so local/dev/tests convert without any account. NOT production-grade. |
| `fx-rates.service.ts` -> `FxRatesService` | The single API everyone calls (see below). |
| `fx.module.ts` -> `FxModule` | Binds `FX_PROVIDER -> StaticFxProvider`, exports `FxRatesService`. Registered in `AppModule`; imported by `BookingsModule` (and, in M3, the public read modules). |
| `dto/money.dto.ts` -> `MoneyDto` | Canonical converted-price display object for public reads (M3): `{ currency, sourceCurrency, fxRate, priceFrom, basePrice }`. |

---

## `FxRatesService` API - two rate paths (deliberately different)

| Method | Used by | Freshness | On failure |
|---|---|---|---|
| `getRate()` / `convert()` | booking **quote + reserve** (authoritative money) | fresh only; lazy-refreshes once if stale | **fails closed -> 503** (`Payments temporarily unavailable`) |
| `getDisplayRate()` / `buildMoney()` | **public cards/detail** (display only) | fresh preferred, stale allowed within a window | falls back to source currency (rate `1`), never blocks the page |
| `refreshRates()` | scheduler (M4) + the lazy on-demand path | writes new active rows, deactivates old | logs + skips a non-positive rate |

- **Same-currency short-circuits** to rate `1` with no DB or provider call (`identityRate`).
- **Immutable history**: `refreshRates()` never mutates a rate row in place.
- All rate/money math uses `Decimal` (never JS float); conversions round HALF_UP to 2dp at
  the line boundary (guide 20.5).

---

## Data flow at booking time

```
quote / reserve  ->  resolvePricing()            (bookings.service.ts)
   |                   |- getRate(tourCurrency -> bookingCurrency)  -> sourceFxRateToBooking
   |                   |- getRate(bookingCurrency -> EUR)           -> fxRateToEur
   |                   |- tiers.effectiveCommissionRate(tourId, now)  (spotlight-aware, see below)
   |                 computeBookingPricing(...rates, commissionTier)   (pure, booking-pricing.util.ts)
   |                   -> booking-currency totals + source* snapshot + EUR commission
   v
booking.create snapshots:
   currency                         (= bookingCurrency, the charged currency)
   totalRetail/depositAmount/balanceAmount   (booking currency)
   sourceCurrency, sourceTotalRetail, sourceDepositAmount, sourceBalanceAmount
   sourceFxRateToBooking            (tourCurrency -> bookingCurrency)
   fxRateToEur, totalEur            (bookingCurrency -> EUR)
   commissionRate, commissionAmount (EUR, rule #22)
   sourceFxProvider / sourceFxProviderAsOf / eurFxProvider / eurFxProviderAsOf  (audit)

payment / TYP / email / tracking  ->  READ the snapshot, NEVER refetch FX.
```

### Currency resolution
- `sourceCurrency = tour.defaultCurrency`.
- `bookingCurrency = dto.currency ?? sourceCurrency` (shopper choice; default = tour currency).
- The traveler is charged in `bookingCurrency`; the PaymentIntent uses `Booking.currency`
  (never the tour currency - guide 20.7).

### Rounding policy (guide 20.5)
Each participant seat and add-on line is converted to booking currency and rounded to 2dp,
then summed for `totalRetail`. `source*` figures preserve the original tour-currency quote.
Deposit/balance are computed in each currency independently.

---

## Commission of Spotlighted tours (handled)

Commission is resolved in **both quote and reserve** via
`TiersService.effectiveCommissionRate(tourId, now)`:

```
effectiveCommissionRate(tourId, at):
  if hasActiveSpotlight(tourId, at) -> 0.35   (SPOTLIGHT_COMMISSION_RATE)
  else                              -> tour.commissionTier / 100
```

- `resolvePricing` converts that to a percentage and passes it to `computeBookingPricing`,
  which snapshots `commissionRate` and computes `commissionAmount` in **EUR**.
- Evaluated at booking-time `now`, snapshotted, and **never retroactive** - a later
  spotlight activation/expiry does not change an existing booking.
- **Quote** shows the spotlight-effective rate (matches what reserve will charge). If a
  spotlight flips between quote and reserve, the **reserve** snapshot is authoritative.
- **Payment** never recomputes commission; `finalizeConfirmation` only EUR-normalizes the
  already-snapshotted value using the snapshot's `fxRateToEur` (no refetch).
- Multi-currency safe: commission is computed on the **EUR** value of the booking total, so
  a USD- or EUR-charged spotlight tour still yields a correct EUR commission at 35%.

---

## Which provider we use

**Right now: `StaticFxProvider` (dev/static), in every environment.** Correct for local and
tests; NOT production-grade. The guide (20.1) mandates a real provider and "fail closed" for
production checkout.

- **Recommended production provider: Stripe FX Quotes** - it locks a quote you can attach to
  the PaymentIntent, so the displayed converted amount and the charged payment share one rate.
- **Open Exchange Rates** is a good display/cache fallback; **ECB** as a reference/audit source.

Swapping in a real provider = implement the `FxProvider` interface + rebind `FX_PROVIDER` in
`FxModule`. Nothing else changes (booking/tour code depends only on `FxRatesService`).

---

## Environment variables

### Consumed by code today (all optional - defaults work)

| Var | Default | Effect |
|---|---|---|
| `FX_USD_TO_EUR` | `0.92` | The static `USD->EUR` rate used by `StaticFxProvider` (`EUR->USD` is its inverse). |
| `FX_RATE_TTL_MINUTES` | `120` | How long a fetched rate stays "fresh" for booking quotes. |
| `FX_RATE_STALE_DISPLAY_HOURS` | `24` | How stale a rate may be for the public-display fallback. |

**Local:** nothing required - runs on defaults. Optionally set `FX_USD_TO_EUR` to test rates.

### Production (guide-listed, NOT YET consumed)

These activate only when a real provider + the refresh scheduler (M4) land:

```
FX_PROVIDER=stripe            # selects the provider impl (no effect yet)
FX_PROVIDER_API_KEY=...       # provider credential (no effect yet)
FX_RATE_REFRESH_MINUTES=30    # scheduler cadence (M4)
FX_RATE_TTL_MINUTES=120
FX_RATE_STALE_DISPLAY_HOURS=24
```

> WARNING: setting `FX_PROVIDER` / `FX_PROVIDER_API_KEY` does nothing today - the binding is
> hardcoded to `StaticFxProvider` in `FxModule`. They take effect once a real provider class
> is implemented and bound.

---

## Failure behavior (guide 20.1)

| Scenario | Behavior |
|---|---|
| Provider down, fresh cached rate exists | Use cached rate. |
| Provider down, only stale display rate exists | Public display only (source-currency fallback); booking quote blocks. |
| Provider down, no cached rate | Same-currency only; cross-currency **quote/reserve returns 503**. |
| Rate changes after a quote | Existing quote stays valid until expiry; a new quote uses the new rate. |
| Rate changes after a booking | The booking never changes (snapshot). |

---

## What is still needed for true production

1. A real `FxProvider` implementation (Stripe FX Quotes) + rebind in `FxModule`.
2. The refresh scheduler + startup behavior (M4) so `fx_rates` stays warm.
3. Then production genuinely fails closed on cross-currency when the provider is down, instead
   of leaning on the static default.

---

## Public display conversion (M3)

Public read endpoints accept an optional `?currency` and return a converted `money` object
per tour card/detail (guide §20.9). It is the canonical display object; the legacy
`priceFrom`/`basePrice`/`defaultCurrency` fields stay for back-compat.

```
money: { currency, sourceCurrency, fxRate, priceFrom, basePrice }   // amounts are strings
```

- Built via `FxRatesService.buildMoney` (single) or the per-page helpers
  `ToursService.attachMoney` / `HubService.attachHubMoney` (resolve each distinct source
  currency's display rate once, ≤2 DB reads per page). Uses `getDisplayRate` (stale allowed);
  when no rate is available it falls back to the tour's source currency at rate `1` - a page
  never blocks on FX.
- **Endpoints with `?currency` + `money`:** `GET /tours` (listing), `GET /tours/slug/:slug`
  (detail), `GET /tours/:id`, `GET /search`, `GET /collections/render/:slug`,
  `GET /hubs/render/:slug`, `GET /hubs/:id/our-picks`, `GET /hubs/:id/comparison`.
- **Deferred (still source-currency):** collection `getBySlug`/`getActive`, and hero/fastStats
  aggregate numbers (hub hero `priceFrom`, collection `fastStats.fromPrice`). The frontend can
  derive a display "from" price from the card `money` objects.

## Tests

- `src/fx/fx-rates.service.spec.ts` - identity rate, fresh cache hit, lazy refresh, fail-closed
  503, `convert`, `refreshRates` write+deactivate, non-positive rejection, stale-display window.
- `src/bookings/booking-pricing.util.spec.ts` - source==booking (rate 1), USD tour -> EUR
  booking, EUR tour -> USD booking with EUR commission.
- `src/bookings/bookings.service.spec.ts` - quote + reserve conversion, source snapshot, default
  booking currency.
- `src/payments/payments.service.spec.ts` - PaymentIntent currency == `Booking.currency`.
