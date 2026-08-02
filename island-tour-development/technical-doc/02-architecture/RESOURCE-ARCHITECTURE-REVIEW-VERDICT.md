# Principal architecture review — resource-aware availability

> **Brief:** break the design before it is built. No defence of earlier decisions.
> **Verdict: C — redesign one subsystem (resource allocation) before implementation.**
> Everything else is sound. The corrections are well-defined and are specified below, followed by
> the phased roadmap conditional on them.

---

## Verdict

**C. Redesign resource allocation before writing code.**

The *concept* — resources as a constraint layer over an unchanged departure SSOT — is correct,
industry-standard and worth building. But the **allocation mechanics** contain three defects that
would have reached production, and one semantic change that is being mis-sold as "additive".

| # | Finding | Severity | Subsystem |
|---|---|---|---|
| **F1** | Lock key includes a local date → **midnight-spanning windows race** | 🔴 correctness | allocation |
| **F2** | Lock key's timezone is ambiguous → **two tours can take different locks for the same instant** | 🔴 correctness | allocation |
| **F3** | `EXCLUSIVE_ON_FIRST` **is not expressible** as the proposed `consumed()` sum | 🔴 design gap | allocation |
| **F4** | `departures.capacity` silently stops meaning what it says platform-wide | 🟠 debt | read paths |
| **F5** | Four modes on day one; two are unproven | 🟠 over-engineering | modelling |
| **F6** | Resource iCal fan-out is O(tours × dates) per poll | 🟠 scale | iCal |
| **F7** | OCTO adds a fifth claim site and a hot read path | 🟠 future | OCTO |
| **F8** | Advisory locks are invisible and unenforced | 🟠 process | allocation |

F1–F3 are why this is **C** and not **B**. They are all in one place, and all fixable before a line
of code — which is exactly why this review was worth doing now.

---

## Part 1 — Breaking the design

### F1 🔴 The lock key includes a date, and windows cross midnight

Proposed: `pg_advisory_xact_lock(hash(resourceId, localDate))`.

A sunset cruise running **22:00–02:00** spans two local dates. Two bookings — one filed against the
23rd, one against the 24th — **take different locks**, do not serialise, and both pass the capacity
check.

The lock was introduced precisely to make the window check atomic, and it fails on the exact class
of product (evening cruises) most likely to share a boat.

### F2 🔴 The lock key's timezone is ambiguous

`localDate` in whose zone? `Tour.timeZone` is per **tour**, and a resource is shared **across**
tours. Two tours mapped to one boat with different `timeZone` values (a data-entry slip is enough)
compute **different local dates for the same physical instant**, take different locks, and race.

Worse than F1, because it fails silently and only under specific data — the kind of bug that
surfaces months later as "we sold the boat twice and nobody can reproduce it".

### F1 + F2 have one fix, and it is a simplification

**Drop the date from the key entirely. Lock on `resourceId` alone.**

```
pg_advisory_xact_lock( hashtextextended(resourceId, 0) )   -- 64-bit, not hashtext()
```

- Midnight spanning: **gone**, no date arithmetic exists.
- Timezone ambiguity: **gone**, no zone is consulted.
- Hash collisions: use the **64-bit** `hashtextextended`. `hashtext()` returns int4, and at 32 bits
  the birthday bound bites around ~77k distinct keys — collisions would silently serialise unrelated
  resources.

**Trade-off — is per-resource too coarse?** It serialises every booking for one asset across all
dates. Do the arithmetic: a resource-scoped transaction runs ~20 ms, so one asset sustains ~50
bookings/second. A busy jet-ski operator does perhaps 50 bookings **per day**. Even 1,000/day is 20
seconds of cumulative lock time spread over 24 hours.

**We were about to accept two correctness bugs to optimise a bottleneck three orders of magnitude
away from mattering.** Take the coarse lock. If contention ever becomes real, shard by date *then* —
and solve midnight and timezone properly at that point, with a reason to.

### F3 🔴 `EXCLUSIVE_ON_FIRST` is not a sum

§5 modelled everything as `consumed(resource, window) ≤ capacity`. `EXCLUSIVE_ON_FIRST` — the mode
§9b identified as the **most common real case** — is not a quantity at all. It is:

> "this window is **claimed by product X**; other products are excluded, X keeps filling."

That is an *identity*, not a count. The proposed formula cannot express it, and glossing it as
"consumes capacity" gives the wrong answer: if the safari has 3 of 4 skis, a `consumed = 3` check
would let the private charter through on the remaining 1.

**Correct check is two-part, in order:**

```
1. CLAIMANT   if any overlapping departure on R has bookedCount > 0
              under mode EXCLUSIVE_ON_FIRST or EXCLUSIVE,
              and its tour ≠ this tour            → REJECT (asset committed elsewhere)
              and its mode = EXCLUSIVE            → REJECT (even for the same tour)

2. QUANTITY   consumed + requested ≤ resource.capacity
```

An ambiguity remains: if two products both show `bookedCount > 0` under `EXCLUSIVE_ON_FIRST` — which
should be impossible, but can arise from data predating the feature or a manual capacity edit — the
claimant is undefined. **Pick a deterministic tie-break** (earliest `createdAt`, then id) and log it
as an inconsistency rather than guessing silently.

### F4 🟠 "Purely additive" is not true — `capacity` changes meaning everywhere

This is the finding most likely to become the two-year debt, and it was hidden by the framing.

After resources, `departures.capacity` is **no longer the number of seats that can be sold**. The
truth becomes `min(departure.capacity, resource headroom)`. Every existing reader of `capacity` now
reports a number that can overstate reality:

| Reader | Consequence |
|---|---|
| booking widget | shows "4 spots left" when the boat is chartered |
| `isBookable` listing gate | tour listed as bookable with no usable inventory — **SEO/indexing impact** |
| `CHANNEL` iCal export | publishes a date as available when it is not — **oversell via OTA** |
| OCTO availability | same, to a paying partner |
| analytics / utilisation | silently wrong |

**The schema change is additive. The semantic change is platform-wide.** Calling it "two new tables"
undersells the work by a wide margin, and discovering this during implementation is how a two-week
task becomes two months.

**Required before building:** one `effectiveCapacity(departure)` function, and an explicit decision
per reader about whether it uses raw or effective capacity. That decision list belongs in Phase 1,
not Phase 5.

### F5 🟠 Four modes is over-engineering for v1

Two of the four are unproven against a real operator:

| Mode | Justified by | v1? |
|---|---|---|
| `EXCLUSIVE` | the live jet-ski case (§4) | ✅ |
| `EXCLUSIVE_ON_FIRST` | dive-boat pattern; Rezdy's "shared non-private" | ✅ |
| `PER_SEAT` | Checkfront's shuttle example — **no TripWheel operator observed needing it** | ❌ defer |
| `FIXED` | plausible for guides — **no observed case** | ❌ defer |

Both deferred modes are **additive enum values**. Adding them later costs one migration and touches
one function. Shipping them now costs four code paths to test, four to document, four to support,
and four ways for an operator to misconfigure — on speculation.

**Ship two modes. Add the others when an operator asks.**

### F6 🟠 Resource iCal fan-out does not scale linearly the way it looks

A resource with 20 tours receiving one busy block writes exceptions for **20 tours × N dates**, then
calls `resyncTourAvailability` **20 times** — every poll, per subscription.

Steady state is fine (the reconciler diffs, so unchanged polls write nothing). The problem is the
**first sync and every change**: 20 materializer runs inside one job, each re-projecting a 90-day
window.

**Required:** resync only tours whose exception set actually changed. The reconciler already knows
this — it must return the affected tour set instead of the caller assuming all of them.

### F7 🟠 OCTO is a fifth claim site and a hot read path

Two consequences that must be designed for now, not discovered later:

1. **An OCTO reservation is a hold on real seats**, so it must pass the resource check. That is a
   fifth call site — reinforcing F8.
2. **OCTO `availability/calendar` is per-product**, but resource-adjusted availability depends on
   *other* products. Every partner poll would run `consumed()` across the resource. At partner
   frequency this is a hot path and needs caching with explicit invalidation on booking.

Neither is a blocker. Both are cheaper to design in now than to retrofit.

### F8 🟠 The lock is a convention, not a constraint

Four claim sites today (`reserve`, `recoverExpiredBooking`, `restore`, `changeDate`), a fifth coming
with OCTO. An advisory lock is invisible in the schema; a sixth site added in 2027 that forgets it
silently restores the overselling bug, and code review will not catch it because there is nothing to
see.

**Non-negotiable:** one `claimDeparture()` helper owning the lock *and* the guarded update, every
site routed through it, and a test that **fails if `departure.updateMany` appears anywhere outside
that helper.** Without this enforcement the design decays quietly, and I would not approve it.

---

## Part 2 — The eight questions, per subsystem

| Subsystem | Correct? | Enterprise-standard? | Scales? | Debt in 2y? | Would they build it differently? | Simplify? |
|---|---|---|---|---|---|---|
| Departure SSOT | ✅ | ✅ (Rezdy "sessions", FareHarbor "availabilities") | ✅ | no | no | no |
| Atomic booking claim | ✅ genuinely good | ✅ conditional-update guard is textbook | ✅ | no | no | **no — do not touch** |
| Availability Materializer | ✅ | ✅ (schedule → projected instances) | ✅ with the 90-day horizon | no | no | no |
| `AvailabilityException` | ✅ | ✅ | ✅ | no | no | no |
| iCal export | ✅ | ✅ all five ship it | ✅ | no | no | no |
| iCal import | ✅ | ✅ | ⚠️ **F6** at resource scope | no | no | no |
| Operator master calendar | ✅ as *view + resource import* | ✅ | ✅ | no | no | already minimal |
| Resource model | ✅ | ✅ **all five** (§9b) | ✅ | no | no | **F5 — 2 modes not 4** |
| Resource allocation | ❌ **F1 F2 F3** | ✅ concept, ❌ mechanics | ✅ after fix | — | yes, they lock coarser | **yes — drop the date** |
| Sharing modes | ⚠️ **F3** | ✅ mirrors Rezdy | ✅ | no | no | **F5** |
| Private / shared tours | ✅ already correct | ✅ | ✅ | no | no | no |
| Resource-aware booking | ⚠️ **F4 F8** | ✅ | ✅ | ⚠️ **F4** | no | no |
| OCTO compatibility | ⚠️ **F7** | ✅ the standard | needs caching | no | no | no |

**Concepts we do not need:** `PER_SEAT` and `FIXED` for v1 (F5); per-day lock sharding (F1/F2);
any `resource_allocations` ledger — derived consumption remains the right call and survives review.

**What survives unchanged and should not be reopened:** the departure SSOT, the atomic seat claim,
the materializer, exceptions, and derived-not-stored consumption. That part of the design is sound.

---

## Part 3 — Required changes before implementation

| # | Change | Why | Migration cost | Future impact |
|---|---|---|---|---|
| 1 | Lock on **`resourceId` only**, 64-bit hash | fixes F1 + F2 | none — pre-code | coarser lock, irrelevant at real volume; date sharding stays available |
| 2 | **Two-part check**: claimant, then quantity | F3 — the common mode is otherwise wrong | none | correct by construction |
| 3 | **Two modes** (`EXCLUSIVE`, `EXCLUSIVE_ON_FIRST`) | F5 | additive enum later | less surface, less support load |
| 4 | Define `effectiveCapacity()` + audit every `capacity` reader **in Phase 1** | F4 — the real debt | ~1 week of read-path work, mostly widget/OCTO/export | prevents the wrong number leaking into OTAs |
| 5 | Reconciler returns **affected tours** | F6 | small | keeps resource iCal viable at 20+ tours |
| 6 | Single `claimDeparture()` choke point + guard test | F8 | small | the only thing that stops silent decay |

**None requires a data migration.** All are design corrections, which is the entire value of doing
this before implementation rather than after.

---

## Part 4 — Phased roadmap *(conditional on Part 3)*

Production SaaS: every phase is independently shippable, dark-launchable and reversible. No phase
leaves the booking path in a half-migrated state.

### Phase 1 — Schema + capacity semantics

- **DB:** `resources`, `tour_resources` (2 modes). No changes to existing tables.
- **Services:** `effectiveCapacity()` and `consumed()` as pure, unit-tested functions. **Not yet
  wired into booking.**
- **API:** none.
- **Jobs:** none.
- **Migration:** purely additive; zero rows created; zero behaviour change.
- **Risks:** low. Main risk is F4 scope discovery — hence the reader audit lands here.
- **Rollback:** drop two unused tables.
- **Tests:** `consumed()` and the claimant rule across every mode; the F4 reader inventory documented
  and asserted.

### Phase 2 — Dashboard UI (Level 1 only)

- **DB:** none.
- **Services:** resource CRUD.
- **API:** `GET/POST/PATCH/DELETE /resources`, `PUT /tours/:id/resources`.
- **Jobs:** none.
- **Migration:** none.
- **Risks:** low — data entry only, nothing enforces yet.
- **Rollback:** hide the UI; data is inert.
- **Tests:** RBAC (`MANAGE_TRIPS`/`MANAGE_AVAILABILITY`), operator scoping (IDOR), mode inference
  from `bookingType`.

> Deliberately before enforcement: operators map real assets while the system still cannot reject
> anything, so the data is validated against reality with **zero booking risk**.

### Phase 3 — Booking transaction (**shadow mode**)

- **DB:** none.
- **Services:** `claimDeparture()` choke point; all four sites routed through it. Resource check runs
  and **logs what it *would* have rejected — rejects nothing.**
- **API:** unchanged.
- **Jobs:** daily report of would-be rejections.
- **Migration:** none.
- **Risks:** **near zero** — this is the phase that de-risks everything after it.
- **Rollback:** remove the call.
- **Tests:** all four sites route through the helper; the guard test from change 6; shadow logging
  never throws.

> Shadow mode answers the only question that matters — *how often would this have blocked a real
> booking?* — before it can cost a sale.

### Phase 4 — Resource locking + enforcement

- **DB:** none.
- **Services:** advisory lock (resourceId, 64-bit) inside `claimDeparture()`; flip shadow →
  enforcing, **per operator**.
- **API:** new `422` with an operator-legible reason.
- **Jobs:** lock-wait and rejection monitoring.
- **Migration:** feature flag per operator; enable for the jet-ski operator first.
- **Risks:** 🔴 **highest of the plan.** A false rejection is a lost sale. Mitigated by Phase 3 data:
  do not enable until shadow rejections match expectations.
- **Rollback:** flip the flag back to shadow. Instant, no data change.
- **Tests:** concurrency tests proving two competing bookings cannot both win; multi-resource
  deadlock (locks sorted by id); midnight-spanning windows; the F3 claimant tie-break.

### Phase 5 — Availability integration (read paths)

- **DB:** none.
- **Services:** route the F4 readers through `effectiveCapacity()` — widget, `isBookable` gate,
  `CHANNEL` export, analytics.
- **API:** availability responses carry effective numbers.
- **Jobs:** recompute `isBookable` on resource change.
- **Migration:** reader by reader, each independently revertible.
- **Risks:** 🟠 the `isBookable` gate affects listing visibility and therefore SEO. Ship it last
  within the phase and watch indexing.
- **Rollback:** per reader.
- **Tests:** a chartered boat's sibling tour shows zero availability everywhere — widget, export,
  OCTO, listing gate.

### Phase 6 — Resource iCal

- **DB:** `CalendarSubscription.scope/resourceId/operatorId/scopeKey`; **`AvailabilityException`
  unique key gains `tourId`**.
- **Services:** reconciler fan-out returning affected tours (change 5).
- **API:** subscriptions accept `scope=RESOURCE`.
- **Jobs:** existing 15-min poll.
- **Migration:** backfill all existing rows to `scope=TOUR`; the unique-key change is index-only.
- **Risks:** 🟠 F6 fan-out cost; blast radius across the catalogue. Force `WARN_ONLY` on resource
  scope initially.
- **Rollback:** disable resource-scoped subscriptions; per-tour ones are untouched.
- **Tests:** fan-out writes exactly the changed tours; a failed fetch still releases nothing.

### Phase 7 — Operator calendar

- **DB:** none.
- **Services:** resource-scoped export projecting `consumed()`.
- **API:** `CalendarFeedKind.RESOURCE`.
- **Jobs:** none.
- **Migration:** additive enum value.
- **Risks:** low — read-only.
- **Rollback:** remove the kind.
- **Tests:** zero PII; ETag/304; a chartered window appears busy.

### Phase 8 — OCTO

- **DB:** none for availability.
- **Services:** resource-adjusted availability with cache + invalidation on booking (F7);
  reservation path routed through `claimDeparture()` — the fifth site.
- **API:** `/octo/availability/calendar`, `/octo/availability`, then bookings.
- **Jobs:** webhook fan-out on availability change; **nightly full reconciliation**.
- **Migration:** availability (read-only) before bookings.
- **Risks:** 🔴 booking lifecycle touches money. Availability first, bookings only once Phase 4 has
  been enforcing in production for a meaningful period.
- **Rollback:** disable per capability.
- **Tests:** partner-visible availability reflects resource commitments; a reservation consumes the
  resource; reconciliation detects induced drift.

---

## Part 5 — The honest summary

**What is genuinely good and should not be touched:** the departure SSOT, the conditional-update
seat claim, the materializer, the exception model, and derived-not-stored consumption. That core is
better than most systems of this age, and the review found nothing wrong with it.

**What was about to go wrong:** the resource *allocation* mechanics. A lock key carrying a local
date would have raced on evening cruises and on any timezone mismatch — silently, in production, on
the exact products most likely to share a boat. And the mode identified as the most common real case
could not be expressed by the check that was supposed to enforce it.

**The most expensive thing that was nearly missed:** F4. "Two new tables" is true of the schema and
false of the system. `capacity` stops meaning what every reader thinks it means, and one of those
readers publishes to OTAs.

**Ship it — after Part 3.** The corrections are small, none needs a data migration, and Phase 3's
shadow mode means the risky part is measured against real traffic before it can ever reject a
booking.
