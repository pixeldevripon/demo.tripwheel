# Customer Accounts & Customer Dashboard

> Decision record + design + build checklist. Founder-approved 2026-07-20.
> AMENDS `technical-doc/login/01-login-design-summary.md` (travelers were
> passwordless-only; three-doors isolation) - see "Policy change" below.
> Frontend/dashboard code lives in the SEPARATE dashboard repo
> (`tripwheel-x-islandtours-dashboard`).

## Policy change (recorded, not silent)

The login spec locked "no passwords / no signup for travelers" and a
three-doors model (operators `/portal`, staff `/staff`, travelers only on the
public site). The founder's 2026-07-20 decision AMENDS this:

- **Passwordless stays primary.** The public `/bookings` pair login, TYP,
  cancel page, HMAC traveler session, and the confirmation-email CTA to
  `island.tours/bookings` are UNCHANGED and remain the no-account path.
- **Customer accounts are additive.** Every booking now auto-creates (or
  links to) a `Role.USER` account; a welcome email offers a set-password
  link. Setting a password is optional - nothing about the trip requires it.
- **Four doors.** The dashboard app gains `/account` (customer door) beside
  `/portal` and `/staff`. Doors still never share pages or link each other.

## What was built (2026-07-20, both repos)

### Data model (backend)

- `prisma/customers.prisma` - `customers` table: one row per
  (userId, operatorId), unique-compound; aggregates `firstBookingAt`,
  `lastBookingAt`, `bookingsCount`, `totalSpendEur` (Decimal 12,2).
  Migration `20260720002912_customer_accounts`.
- Aggregates are **recompute-on-write** (groupBy over CONFIRMED+REDEEMED
  bookings, then upsert) - idempotent, self-healing. They feed the FUTURE
  operator-facing "Customers" page only; refunds do not adjust
  `totalSpendEur` (it is a confirmed-booking EUR value snapshot).
  Customer-facing totals always come live from `GET /bookings/me/summary`.

### Provisioning (backend, `src/customers/`)

`CustomerProvisioningService.provisionForBooking(booking)` - fire-and-forget
(never throws, never blocks a booking/webhook):

1. No contact email -> no-op.
2. Email belongs to a **non-USER** account (operator/staff/admin) -> skip
   entirely (no link, no email). Linking would inject bookings into their ops
   dashboard lists; those bookers keep the publicRef flow.
3. No account -> `provisionInvitedAccount(role: USER)` +
   `auth.api.requestPasswordReset({ redirectTo: getAccountUrl() + '/reset' })`
   -> welcome email (only on this create path). ConflictException race
   (settle vs webhook) -> refetch, continue, no second welcome.
4. Existing USER with `hasPassword=false` -> re-send set-password link,
   capped 1/24h per email (own `TargetRateLimiter` instance, bucket
   `customer-welcome`); `hasPassword=true` -> silent.
5. Backfill: `updateMany` links this + ALL past bookings with the same
   contactEmail (case-insensitive) where `userId IS NULL`.
6. Upsert `customers` rows for each distinct operator + recompute aggregates.

**Call sites** in `bookings.service.ts` (all `void ...`):
`finalizeConfirmation` (winner branch - confirm endpoint + Stripe webhook
paths), `update()` when contact lands on an already-CONFIRMED booking
(OPERATOR_FULL insurance; note OPERATOR_FULL is rejected at reserve in v1),
and `cancel()` recomputes aggregates when the booking was linked.

**Trust model**: the account is inert until the emailed set-password link
proves mailbox ownership - the same trust basis as lookup/recover.
`emailVerified: true` at creation is safe for the same reason.

### Welcome email (backend)

- `src/mail/templates/customer-welcome.template.ts` on the shared
  `auth-email-shell` ("Your booking created an account... set a password";
  explicitly notes confirmation links keep working without one).
- `MailService.sendCustomerWelcomeEmail(to, inviteUrl, { name? })`.
- `auth.instance.ts sendResetPassword`: the server-initiated (invite) branch
  now checks the user's role FIRST - `USER` -> customer welcome; then the
  existing staff-row branching (operator vs staff copy) unchanged. Genuine
  forgot-password requests keep the role-neutral reset template.
- `getAccountUrl()` in `invite-provisioning.util.ts` derives `/account` from
  `PORTAL_URL` (like `getStaffUrl`) - **no new env var**.

### Customer read API (backend)

- `ROLE_PERMISSIONS[USER]` (roles.config.ts + dashboard rbac.ts mirror) adds
  `VIEW_BOOKINGS` + `VIEW_PAYMENTS`. Verified blast radius: exactly
  `GET /bookings`, `GET /bookings/:id`, `GET /payments` - all self-scoped:
  - `BookingsService.list` already scoped non-platform roles via
    `where.userId = actor.id`; `getById` had the owner check.
  - `PaymentsService.list` gained the USER branch:
    `where.booking = { userId: actor.id }` (was operator-resolution for all
    non-ADMIN).
- Booking list rows now carry ledger-derived `paymentStatus`
  (`PAID | PARTIALLY_PAID | UNPAID | REFUNDED`) + `paidAmount`
  (SUCCEEDED non-REFUND minus SUCCEEDED REFUND vs totalRetail) - for
  operators too, unconditional.
- `GET /bookings/me/summary` (declared ABOVE `:id` - route order):
  `{ bookingsCount, upcomingCount, totalSpend: [{currency, amount}] }`,
  live from the payment ledger.
- `POST /bookings/:id/cancellation-request` (session-authed): the shared
  post-gate core of the traveler flow was extracted to
  `submitCancellationRequest` (limiter -> status check -> stamp -> admin
  email -> notices); the public TYP route keeps its HMAC gate verbatim;
  `requestCancellationAsCustomer` 404s (never 403s) foreign/unlinked ids.

### Dashboard repo

- **`/account` door**: `app/(login)/account/{layout,page,forgot,reset}` +
  `components/login/account-{login,forgot,reset}.tsx` - portal-style
  split-screen with traveler copy; `AuthForm` gained the `'account'` variant;
  the welcome email's set-password link lands on `/account/reset` (shared
  `ResetCard` doubles as invite set-password, 12-char min).
- **Role-shaped shell**: `customerNav` (My Bookings / Payments / Profile) is
  a SEPARATE nav array in `navigations.ts` chosen by `app-sidebar` when
  `role === 'USER'` - the permission grant never lights operator nav items.
  Root `/` redirects USER -> `/bookings`; sign-out sends USER -> `/account`.
  Unauthenticated deep links still land on `/portal` (documented; customer
  emails always link `/account`).
- **Customer pages**: `components/customer/customer-bookings-view.tsx`
  (stat row from `me/summary` + own-bookings table + details sheet),
  `customer-booking-details.tsx` (trip/payment sections + cancellation
  request with "nothing is cancelled until we process it" copy),
  `customer-payments-view.tsx` (charges/refunds table),
  `payment-state.tsx` (badge meta for the derived payment state).
  `app/(app)/bookings|payments/page.tsx` branch on role server-side.
  Profile page was already role-aware (change/set password works).

## Build checklist

- [x] Phase 0 - `customers` schema + migration + USER permission grant
- [x] Phase 1 - welcome template + MailService + auth invite branch + getAccountUrl
- [x] Phase 2 - CustomerProvisioningService + booking hooks (3 call sites)
- [x] Phase 3 - payments USER scope · paymentStatus derivation · me/summary · customer cancellation-request
- [x] Phase 4 - /account door + AuthForm variant + customerNav + role shell/redirects
- [x] Phase 5 - customer bookings/payments views + details sheet + API client/hooks
- [x] Phase 6 - docs (this file + login/ROLES amendments) + unit tests
- [ ] Manual E2E pass (Stripe test booking -> welcome email -> set password ->
      /account login -> backfilled history -> cancel request -> admin inbox;
      operator-owned email books -> no account; webhook replay -> one welcome)
- [ ] Operator-facing "Customers" page (deferred by decision - table is ready)

## Tests (unit, all green 2026-07-20: 298/298 across bookings/payments/staff/auth/customers)

- `customer-provisioning.service.spec.ts` (10): create+welcome-once,
  no-email no-op, non-USER skip, linked-silent, resend cap hit/ok, conflict
  race, never-throws, aggregate recompute + never-throws.
- `bookings.service.spec.ts` additions: customer cancellation-request
  (owner submits / foreign 404 / unlinked 404 / non-confirmed 409),
  summary math (refund netting + zero-currency drop), list fixtures carry
  `payments` for the derivation.
- `payments.service.spec.ts` addition: USER scoping (booking.userId, no
  operator resolution).
- NOT unit-tested (manual): the auth.instance invite branch (module-level
  Better Auth singleton; covered by the manual E2E pass).

## Review pass (2026-07-20, code-reviewer + security-reviewer) - EXECUTED

Fixes applied same day:

- **Bookings list USER-scope + commission-strip regression tests added**
  (the one scoping path without coverage).
- **Commission withheld from customers**: `stripCommissionForCustomer` nulls
  `commissionRate`/`commissionAmount` on `GET /bookings` + `GET /bookings/:id`
  for `Role.USER` (same withholding rule as the public TYP payload).
- **Welcome-email cap now covers the FIRST send too** (creation seeds the
  `customer-welcome` 1/24h bucket; server-initiated resets bypass Better
  Auth's route limiter, this is the backstop).
- **Aggregate recompute scoped**: steady state touches only the current
  booking's operator; the all-operators fan-out runs only when the backfill
  actually linked rows, and in parallel.
- **One shared `TargetRateLimiter`** via `src/common/rate-limit.module.ts`
  (BookingsModule re-exports it for PaymentsModule; CustomersModule imports
  it) - no duplicate instance/sweep timer.
- **Dashboard**: `BOOKING_PAYMENT_STATE` moved into the single status-map
  registry (`components/common/status-maps.ts`); `CustomerRouteGuard`
  (client leaf in the shell) redirects USER off non-customer routes -
  single source of truth `['/bookings','/payments','/profile']`;
  `AuthForm` submit style is an exhaustive per-variant lookup.
- `derivePaymentState`: zero-value bookings read as PAID, not UNPAID.
- `sendCustomerWelcomeEmail(to, url, name?)` matches the operator-invite
  signature.

**Booking-lifecycle security gaps - RESOLVED same day (founder-approved).**
All three pre-existing @Public gaps the review surfaced are now gated
(unit-tested; checkout and the admin dashboard flows verified unaffected -
the public frontend never called `/confirm` or raw `/cancel`; the Stripe
webhook/settle path uses `confirmFromPayment`, untouched):

1. `POST /bookings/:id/confirm` now requires the amount due at confirmation
   (deposit, or full total for PAID_IN_FULL) to be captured in the payment
   ledger - one indexed `payment.aggregate` (SUCCEEDED non-REFUND) before
   the existing atomic transition; **402** otherwise. A raw booking id is no
   longer a free-confirmation (or forced-welcome-email) capability.
2. `PATCH /bookings/:id`: contact changes on a CONFIRMED booking require an
   `X-Traveler-Session` owning the booking (**401** otherwise). The ON_HOLD
   checkout contact PATCH is unchanged (id is a short-lived secret held by
   the reserving client). Notes/pickup remain ungated.
3. `POST /bookings/:id/cancel`: ON_HOLD releases stay open (checkout-abandon
   path); anything past ON_HOLD requires an authenticated ops actor -
   platform-wide booking role, or the operator owning the booking (foreign
   ids **404**, no existence oracle; `Role.USER` rejected - customers use
   the cancellation-request flow). The dashboard admin flow still works
   because AuthGuard attaches the session user even on @Public routes.

All guarded `updateMany`/`$transaction` atomic transitions are unchanged -
the gates are pre-checks, each a single indexed query.

## Second review pass (2026-07-20, both reviewers re-run) - EXECUTED

Re-ran code-reviewer + security-reviewer against the fix rounds above. Both
confirmed the three lifecycle gates hold under tracing and are backed by tests
that assert the gate actually fires (the fully-paid `payment.aggregate` mock
default is overridden in the gate tests, so it cannot mask a regression).
Six further items were found and fixed:

1. **`cancel()` authorization now runs BEFORE the idempotent `CANCELLED`
   early-return.** Previously the early-return sat above the gate, so a raw id
   alone returned the full payload (totals, refund, commission) for any
   already-cancelled booking - an existence oracle plus a data leak. The
   checkout-abandon release and its idempotent retry stay open via
   `utcConfirmedAt === null` ("this was only ever a hold"). Authorization also
   now outranks the status check, so a 409 can no longer name a stranger's
   booking status.
2. **Commission withheld from every traveler-facing booking payload.** The
   first pass covered only `GET /bookings` and `/bookings/:id`; `reserve`,
   `confirm`, `extend`, `update` and the public `cancel` still returned
   `commissionRate`/`commissionAmount` to whoever held the booking id. New
   `mapBookingPublic` (and `mapBookingForActor` for cancel, where an ops actor
   keeps the full payload). Verified no frontend/dashboard consumer reads
   commission outside the list/detail views.
3. **`TargetRateLimiter` retention is per-bucket.** Sharing one instance made
   `maxWindowMs` global, so the customer-welcome 24h window held every
   short-window bucket's keys (resend/recover/cancel-req/settle) 24x longer
   than useful - a regression from the shared-module fix. Now
   `maxWindowByBucket`.
4. **`MAX_TRACKED_KEYS` is a real bound.** `sweepStale` alone is not one: a
   flood of distinct fresh keys has nothing stale to drop. Added
   least-recently-touched eviction so a high-cardinality bucket cannot grow the
   map without limit or crowd out a security-critical bucket.
5. **`isPlatformWideBookingRole` moved to `common/utils/operator.util.ts`** and
   is now used by `PaymentsService.list` too. It previously routed every
   non-ADMIN through `resolveOperatorId`, so a platform STAFF/EDITOR with
   `VIEW_PAYMENTS` but no operator record got a 400 instead of the visibility
   the grant entitles them to. One definition, two services, no drift.
6. **Typed Swagger errors + shared constant**: `PaymentRequiredErrorDto` (402
   on confirm) and `UnauthorizedErrorDto` (401 on update/cancel) replace
   free-text-only documentation; `ACTIVE_BOOKING_STATUSES` in
   `common/constants/booking-status.ts` replaces the duplicated
   `[CONFIRMED, REDEEMED]` literal in `getCustomerSummary` and
   `recomputeAggregates`.

Also fixed a `tsc` error carried in from the first fix round (`update()`'s
return union made `sessionToken` unreachable in the spec) by typing the
payload's `sessionToken` as optional.

New tests: cancel re-cancel 401 after confirming, hold-release idempotency,
commission withheld from the cancel payload, 401-not-409 on a redeemed
booking, and the provisioning fan-out (steady state touches one operator;
a backfill that links past bookings recomputes once per distinct operator).

Verified: **1245/1245** backend unit tests, `tsc` clean, eslint clean on the
touched modules. (`src/analytics/` is separate uncommitted WIP and is excluded
from both the suite run and this pass.)

Deferred (cosmetic, logged not done): the identical `@Throttle` block on the
three human-pace mail routes could become one shared decorator.

## Invariants (do not break)

1. Provisioning is fire-and-forget and must NEVER fail or slow a booking,
   webhook, or cancellation.
2. Welcome email fires ONLY on account creation; unset-password resends are
   capped 1/24h per email; password-holders get nothing.
3. Emails belonging to non-USER accounts are never linked or converted.
4. The public passwordless flow and `booking-email.context.ts` CTA stay
   untouched; `traveler-session.util.ts` is off-limits.
5. `GET /bookings/me/summary` must stay declared above `GET /bookings/:id`.
6. Customer-facing money comes from the live ledger, never the `customers`
   aggregate snapshots.
7. Commission (`commissionRate`/`commissionAmount`) never rides a
   traveler-facing payload - only authenticated ops actors see it. New booking
   response paths use `mapBookingPublic`/`mapBookingForActor`, never raw
   `mapBooking`.
8. In `cancel()`, authorization runs before both the idempotent early-return
   and the status check - neither a payload nor a status may reach an
   unauthenticated caller holding only a booking id.
