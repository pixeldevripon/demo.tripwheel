# FX & Multi-Currency

> Canonical reference for how currency conversion works across the platform. Derives from
> `BOOKING-FLOW-DESIGN-GUIDE.md` sections 20-23. If anything here disagrees with the master
> (`island-tours-platform-master.html` v1.9), the master wins.
>
> Status: backend M1 (FX foundation) + M2 (pricing/quote/reserve wiring) + M3 (public-API
> display conversion via `money`) + M4 (refresh scheduler + startup warm-up) + M5 (frontend)
> BUILT and tested. A real **keyless ECB reference provider** backs the rate cache feed
> (`FX_PROVIDER=ecb`, 2026-07-25). The CHARGE-side rate is BUILT too (task #28 / 5C,
> 2026-07-25): at confirmation the PSP's actual conversion (Stripe
> `balance_transaction.exchange_rate` / Mollie `settlementAmount`) re-anchors the booking's
> EUR figures - see "Charge-rate reconciliation" below.

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
| `fx-refresh.service.ts` -> `FxRefreshService` | Keeps the cache warm (M4). One refresh at **startup** + a dynamic **interval** every `FX_RATE_REFRESH_MINUTES` (default 30). In-process `@nestjs/schedule` (no BullMQ - same convention as `NightlyJobsService`). Failures are logged and swallowed so boot/interval never die; correctness is enforced downstream (booking fails closed, display falls back). |
| `fx.module.ts` -> `FxModule` | Binds `FX_PROVIDER -> StaticFxProvider`, provides `FxRefreshService`, exports `FxRatesService`. Registered in `AppModule`; imported by `BookingsModule` (and, in M3, the public read modules). Relies on the global `ScheduleModule.forRoot()` in `AppModule` for `SchedulerRegistry`. |
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

FX splits into TWO rate paths with DIFFERENT providers (this was the design decision on
2026-07-25 - Stripe FX is charge-coupled, not a batch rate feed, and its FX Quotes API is a
gated preview absent from the installed SDK v22.2.2):

- **Display / quote cache feed** (cards, the widget quote - the `FxProvider.fetchRates` seam):
  **ECB reference rates**, live now. `EcbFxProvider` (`providers/ecb-fx.provider.ts`, name
  `ecb`) pulls the ECB daily reference rates as keyless JSON via Frankfurter
  (`api.frankfurter.dev`, no account/key). Selected by `FX_PROVIDER=ecb`. `StaticFxProvider`
  (0.92) remains the default for local/tests (`FX_PROVIDER` unset / `static`).
- **Charge rate** (what the money actually converted at): read back from the PSP AFTER a
  successful charge and reconciled onto the booking at confirmation (task #28 / 5C, built
  2026-07-25) - see "Charge-rate reconciliation" below. NOT usable as a `fetchRates` provider
  (it exists only per-charge).

**Hybrid outage policy** (`FxModule` factory, `createFxProvider`): in **non-production**, `ecb`
is wrapped in `CompositeFxProvider` so any pair the provider fails to return is filled from the
static rate - local dev/staging always converts. In **production**, `ecb` runs ALONE: an outage
writes no rows and cross-currency **fails closed** downstream (`getRate` 503), never silently
charging the stale static rate.

Adding another feed provider (e.g. Open Exchange Rates, keyed) = implement `FxProvider` + add a
branch to `createFxProvider`. Nothing else changes (callers depend only on `FxRatesService`).

---

## Environment variables

### Consumed by code today (all optional - defaults work)

| Var | Default | Effect |
|---|---|---|
| `FX_USD_TO_EUR` | `0.92` | The static `USD->EUR` rate used by `StaticFxProvider` (`EUR->USD` is its inverse). |
| `FX_RATE_TTL_MINUTES` | `120` | How long a fetched rate stays "fresh" for booking quotes. |
| `FX_RATE_STALE_DISPLAY_HOURS` | `24` | How stale a rate may be for the public-display fallback. |
| `FX_RATE_REFRESH_MINUTES` | `30` | `FxRefreshService` interval cadence (M4). Keep well below the TTL so a rate never expires between refreshes. |

All are validated as positive numbers in `env.validate.ts` when set (optional - code
defaults apply when unset).

**Local:** nothing required - runs on defaults. Optionally set `FX_USD_TO_EUR` to test rates.

### Provider selection (consumed since 2026-07-25)

```
FX_PROVIDER=ecb               # 'static' (default) | 'ecb'. 'ecb' = keyless ECB reference feed.
FX_PROVIDER_API_KEY=...       # RESERVED - not consumed; ECB needs no key. Add when a keyed
                              # feed provider (e.g. Open Exchange Rates) lands.
```

- Validated in `env.validate.ts` (`FX_PROVIDER` must be `static` or `ecb`).
- `FX_PROVIDER=ecb` in production; leave unset/`static` for local + tests.
- `FX_PROVIDER_API_KEY` does nothing today (ECB is keyless); kept as a reserved name for a
  future keyed provider.

---

## Failure behavior (guide 20.1)

| Scenario | Behavior |
|---|---|
| Provider down at boot | Startup refresh is logged + swallowed; app boots. Cached DB rows (if any) still serve; the interval keeps retrying. |
| Provider down, fresh cached rate exists | Use cached rate. |
| Provider down, only stale display rate exists | Public display only (source-currency fallback); booking quote blocks. |
| Provider down, no cached rate | Same-currency only; cross-currency **quote/reserve returns 503**. |
| Rate changes after a quote | Existing quote stays valid until expiry; a new quote uses the new rate. |
| Rate changes after a booking | The booking never changes (snapshot). |

---

## Refresh scheduler & startup (M4)

`FxRefreshService` (in `FxModule`) keeps `fx_rates` warm:

- **Startup** (`onApplicationBootstrap`): one `refreshRates()` so the first booking quote
  does not pay the provider round-trip and cross-currency works immediately when reachable.
- **Interval**: registered dynamically via `SchedulerRegistry` every
  `FX_RATE_REFRESH_MINUTES` (default 30), well inside the 120-minute TTL.
- **Non-fatal**: a refresh that throws is logged and swallowed - boot and the interval never
  die. Correctness is enforced per-request downstream (booking quote 503s, display falls back
  to source currency), not by blocking the app.
- **Convention**: in-process `@nestjs/schedule` (no BullMQ), matching `NightlyJobsService`.
  FX refresh is an idempotent recompute, not a retry/concurrency queue.
- `onModuleDestroy` clears the interval defensively (tests / hot-reload leave no live timer).

## Adding another feed provider

The swap is intentionally tiny because the seam already exists (this is how `EcbFxProvider`
landed):

1. Write ONE class implementing `FxProvider` (`fetchRates(pairs) -> ProviderRate[]`), e.g. a
   keyed Open Exchange Rates provider.
2. Add a branch to `createFxProvider` in `FxModule`, selected by `FX_PROVIDER`. Nothing else
   changes - all consumers depend only on `FxRatesService`, and the M4 scheduler already
   refreshes whatever provider is bound.

(The charge-side rate needs no provider work at all - it is read back from the settled charge,
see "Charge-rate reconciliation".)

## What is still needed for true production

1. DONE (2026-07-25): a real feed provider (`EcbFxProvider`) + env-selected binding in `FxModule`;
   production now genuinely fails closed on cross-currency when ECB is down (no static injection).
2. DONE (2026-07-25, task #28/5C): the PSP's actual charge conversion is reconciled onto the
   booking at confirmation for BOTH PSPs - see "Charge-rate reconciliation" below. (The original
   idea - Stripe `currency_conversion` ON the PaymentIntent - is a gated-preview API absent from
   SDK v22.2.2; reading the rate back from the settled charge achieves the same truth without it.)

---

## Charge-rate reconciliation (task #28 / 5C - built 2026-07-25)

The traveler is always CHARGED the fixed `Booking.currency` amount (both PSPs receive exact
amounts - Stripe minor units, Mollie decimal strings), so the PSP conversion happens on OUR side
of the money: charge currency -> the EUR settlement account. At confirmation that ACTUAL rate
replaces the reserve-time ECB snapshot for the booking's EUR normalization:

- **Stripe**: the charge's `balance_transaction.exchange_rate` (expanded on `retrieveCharge` and
  `retrievePaymentIntent` -> `latest_charge.balance_transaction`). Used ONLY when the balance
  transaction currency is literally `eur` - a non-EUR-settled Stripe account would supply a rate
  to the wrong currency.
- **Mollie**: `settlementAmount.value / amount.value` on the fetched payment. Used only when the
  settlement currency is EUR and the charge currency is not (Mollie omits the field when it
  settles nothing, e.g. PayPal-settled amounts).

Mechanics: `stripeChargeFx` / `mollieChargeFx` (payments.service pure helpers) build a `ChargeFx`
`{rateToEur, provider, asOf}` that rides as the 3rd argument of
`BookingsService.confirmFromPayment` (webhook AND settle-on-return paths) into
`finalizeConfirmation`, which - inside the existing mark-first guard - recomputes `fxRateToEur`
(6dp) / `totalEur` / `commissionAmount` (2dp HALF_UP) and stamps `eurFxProvider` /
`eurFxProviderAsOf` with the PSP + its timestamp (the pre-existing audit columns; no migration).
The settlement ledger row is written from the same reconciled figures, so the conversion value
(rule #22) and what operators are owed both reflect the rate the money actually moved at.

Invariants preserved: the commission RATE stays the reserve snapshot (tier changes are never
retroactive) - only its EUR value re-anchors. EUR-charged bookings never reconcile (nothing was
converted; rate stays 1). Missing/foreign-currency PSP data falls back to the prior
ECB-snapshot path unchanged. The quote/display feed remains ECB - travelers see ECB-derived
prices and are charged exactly the displayed amount; reconciliation only trues up OUR EUR books.

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

### Which currency a visitor sees first

The backend converts to whatever `?currency` it is asked for. **Choosing that value is entirely
the frontend's job**, and it has exactly two inputs, in this order:

1. **The `NEXT_CURRENCY` cookie** - and it carries exactly one meaning: *this visitor picked that
   currency in the footer selector*. `lib/currency/current.ts` `persistCurrency` is its only
   writer.
2. **The locale default**, when there is no cookie:

   | Locale | Default |
   | --- | --- |
   | `en`, `zh`, `es`, `pt` | **USD** |
   | `nl`, `de`, `fr` | **EUR** |

   `LOCALE_CURRENCY` in `frontend/lib/constants/locales.ts`. Mirrored in the dashboard repo -
   **keep the two in sync**.

`es`/`pt` were EUR until 2026-08-06 (Pastel #30, founder): those locales are served mostly from
South America, where shoppers think in dollars. The split is by who speaks the language, not by
where the language is from.

**There is no third input.** Nothing reads the IP or the device: master 1.3 puts the default on
the LOCALE and files IP-based localization under roadmap, and the geo pick `proxy.ts` once had was
deliberately removed - it wrote the cookie on the very first request, after which the locale
default could never apply again (so `/en` rendered EUR for anyone behind a European-looking edge
node). A second writer also lets the footer pill and the server-rendered prices disagree on the
same screen. `proxy.test.ts` guards this.

## Tests

- `src/fx/fx-rates.service.spec.ts` - identity rate, fresh cache hit, lazy refresh, fail-closed
  503, `convert`, `refreshRates` write+deactivate, non-positive rejection, stale-display window.
- `src/fx/fx-refresh.service.spec.ts` - startup refresh + interval registration, swallowed
  startup failure, scheduled-tick cadence, no double-register, interval cleared on destroy.
- `src/bookings/booking-pricing.util.spec.ts` - source==booking (rate 1), USD tour -> EUR
  booking, EUR tour -> USD booking with EUR commission.
- `src/bookings/bookings.service.spec.ts` - quote + reserve conversion, source snapshot, default
  booking currency.
- `src/payments/payments.service.spec.ts` - PaymentIntent currency == `Booking.currency`.
