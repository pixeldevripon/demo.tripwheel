# Resource correctness — architecture review

> **Status:** review only. Nothing proposed here is built.
> **Question:** does TripWheel have a resource-allocation correctness problem *today*, independent
> of any calendar synchronisation work?
> **Answer:** **yes**, and it is demonstrable against live seed data.
> **Scope discipline:** Availability, AvailabilityMaterializer and the atomic booking claim are
> **not** redesigned. Resources are proposed as a **constraint layer only**.

---

## 1. Verdict

| Question | Answer |
|---|---|
| Can two departures sharing a physical resource both be booked today? | **Yes. Every time.** |
| Is there any shared-resource concept in schema or booking flow? | **None.** |
| Is this a guard that is missing? | **No — it is a *fact* that is missing.** |
| Is it a real problem or a theoretical one? | **Real. Live rows shown in §4.** |

The important framing: this is **not** a concurrency bug. Every transaction involved is individually
correct, properly guarded, and commits a consistent database. The invariant being violated —
*"physical capacity is finite"* — is one the schema has no way to express, so no amount of locking or
transaction tuning would catch it. **You cannot enforce a constraint over a fact you do not store.**

---

## 2. Q1 & Q2 — what exists today, from the code

### 2a. There is no resource concept anywhere

Searched `prisma/*.prisma` and `src/`:

| Candidate | Verdict |
|---|---|
| `model Resource` / `Boat` / `Vehicle` / `Guide` / `Asset` | **do not exist** |
| `Tour.wholeUnitType` (`GROUP\|BOAT\|VEHICLE\|AIRCRAFT\|PACKAGE`) | a **type**, not an instance. Says "this is priced as a boat", never *which* boat |
| `Tour.bookingType` (`PRIVATE\|SHARED`) | exclusivity **within one departure** only (§2c) |
| `Operator` | an owner, not a capacity constraint |
| `Departure` | `tourId, date, startTime, capacity, bookedCount` — **no resource FK** |

The nearest thing to a shared asset is `wholeUnitType`, which is a pricing classification. Two tours
can both say `BOAT` and there is nothing to indicate whether that is the same hull or two.

### 2b. The concurrency domain is exactly one departure row

```prisma
model Departure {
  @@unique([tourId, date, startTime])
  @@index([tourId, date])
  @@index([tourId, status, date])
}
```

Every key and index is `tourId`-scoped. **Two tours at 09:00 are two rows, with two independent
counters, and no relation between them.**

### 2c. What *is* correctly implemented — and its exact limit

`bookings.service.ts:573`:

```ts
// UNIT + PRIVATE = exclusive charter: one booking takes the whole departure.
const exclusive = ctx.isUnit && ctx.tour.bookingType === TourBookingType.PRIVATE;
```

| Shape | Claim |
|---|---|
| `UNIT` + `PRIVATE` | `WHERE bookedCount = 0` → `SET bookedCount = capacity` |
| everything else | `WHERE bookedCount <= capacity - seats` → `increment` |

This is correct and should not be touched. But read the comment precisely: *"takes the whole
**departure**"* — not the whole *asset*. Exclusivity is scoped to one row of one tour. That
scope-limit is the entire bug.

---

## 3. Q3 — exactly where the transaction permits it

`BookingsService.reserve()`, `src/bookings/bookings.service.ts`:

```
:590   const created = await this.prisma.$transaction(async (tx) => {
:592     const dep = await tx.departure.findUnique({
:593       where: { id: dto.departureId },      ← the ONLY row read
:594       select: { capacity: true },
:607     const claim = exclusive
:610       ? await tx.departure.updateMany({
:612           where: { id: dto.departureId, tourId: dto.tourId,
:614                    status: OPEN, bookedCount: 0 },
:617           data:  { bookedCount: capacity } })
:620       : await tx.departure.updateMany({
:622           where: { id: dto.departureId, tourId: dto.tourId,
:625                    status: OPEN, bookedCount: { lte: capacity - seats } },
:627           data:  { bookedCount: { increment: seats } } });
:629   if (claim.count === 0) → reject
```

**The whole universe of this transaction is one departure row, addressed by primary key.**

- The only `SELECT` is `findUnique` by `id`.
- The guard's `WHERE` filters `id` and `tourId` — both narrowing to that same row.
- There is no read, no lock, no predicate and no join that could observe another tour.

So two transactions booking two different departures **never contend**. That is true *by
construction*, not by timing — they touch disjoint rows, so they do not even serialise under
`SERIALIZABLE`. No isolation level fixes this.

**The same hole exists at all four claim sites**, and any solution must cover all of them:

| Method | Line | Context |
|---|---|---|
| `reserve()` | 610 / 620 | normal booking |
| `recoverExpiredBooking()` | 1139 / 1148 | re-claim after hold expiry |
| `restore()` | 2950 / 2958 | un-cancel |
| `changeDate()` | 4685 / 4693 | move to another departure |

---

## 4. Q4 — a concrete overselling walkthrough, from live data

Not hypothetical. This query against the current database returns real rows:

```
private_tour                 | shared_tour                | date       | start | priv_cap | shared_cap
Private Jet Ski Island Tour  | Palm Beach Jet Ski Safari  | 2026-08-02 | 09:00 |    4     |     4
Private Jet Ski Island Tour  | Palm Beach Jet Ski Safari  | 2026-08-03 | 09:00 |    4     |     4
```

Same operator. Same date. **Same 09:00 start.** Both selling jet skis — almost certainly the same
four machines.

### Step by step

Fleet: **4 jet skis.**

| Step | Transaction A — Safari (SHARED) | Transaction B — Private tour |
|---|---|---|
| 1 | `BEGIN` | |
| 2 | `findUnique(departure_A)` → capacity 4 | |
| 3 | `exclusive = false` (SHARED) | |
| 4 | `updateMany WHERE id=A AND bookedCount <= 4-3` → **1 row**, bookedCount `0 → 3` | |
| 5 | `COMMIT` ✅ 3 skis sold | |
| 6 | | `BEGIN` |
| 7 | | `findUnique(departure_B)` → capacity 4 |
| 8 | | `exclusive = true` (UNIT + PRIVATE) |
| 9 | | `updateMany WHERE id=B AND bookedCount = 0` → departure_B is **untouched**, so **1 row**, `0 → 4` |
| 10 | | `COMMIT` ✅ whole fleet chartered |

**Outcome: 3 shared riders and an exclusive 4-ski charter, at 09:00, on a 4-ski fleet. 7 machines
required, 4 exist.**

Both transactions were correct. Both guards fired as designed. The database is internally
consistent. Steps 4 and 9 touch different primary keys, so **there is no race to lose** — this
reproduces just as reliably a week apart as it does concurrently.

That is what makes it an architecture gap rather than a bug: the failure is silent, deterministic,
and invisible to every existing check.

---

## 5. Q5 & Q6 — the smallest additive model

Two new tables. **Zero changes to `departures`, `availability_schedules`,
`availability_exceptions`, `bookings`, or the materializer.**

```prisma
enum ResourceKind { BOAT  VEHICLE  JETSKI  GUIDE  EQUIPMENT  GENERIC }

/// A thing that can only be in one place at a time. NOT inventory: it is never
/// sold, has no price, and no traveller can book it. It exists to COUPLE tours
/// that would otherwise be independent.
model Resource {
  id         String       @id @default(uuid())
  operatorId String
  name       String       /// "Jet ski fleet", "Boat A", "Miguel"
  kind       ResourceKind @default(GENERIC)

  /// Total simultaneous units: 4 jet skis, 60 seats, 1 guide.
  capacity   Int
  isActive   Boolean      @default(true)

  operator Operator       @relation(fields: [operatorId], references: [id], onDelete: Cascade)
  tours    TourResource[]

  @@unique([operatorId, name])
  @@map("resources")
}

/// How one tour's departure consumes a resource.
enum ResourceConsumption {
  PER_SEAT   /// one unit per booked seat  — shared safari on the jet ski fleet
  FIXED      /// `units` regardless of pax — one guide, two crew
  EXCLUSIVE  /// the entire resource       — private charter of the whole fleet
}

model TourResource {
  tourId      String
  resourceId  String
  mode        ResourceConsumption @default(PER_SEAT)
  units       Int                 @default(1)  /// used when mode = FIXED

  tour     Tour     @relation(fields: [tourId], references: [id], onDelete: Cascade)
  resource Resource @relation(fields: [resourceId], references: [id], onDelete: Cascade)

  @@id([tourId, resourceId])
  @@index([resourceId])
  @@map("tour_resources")
}
```

Three modes, because the business has exactly three inventory shapes:

| Business case | mode | consumes |
|---|---|---|
| Shared safari on the fleet | `PER_SEAT` | `bookedCount` |
| Any tour needing the one guide | `FIXED`, units 1 | 1 |
| Private charter of the fleet | `EXCLUSIVE` | `resource.capacity` |

### The load-bearing decision: consumption is DERIVED, never stored

```
consumed(resource, window) = Σ over departures D overlapping window,
                             where D.tour maps to this resource:
    mode = EXCLUSIVE  and D.bookedCount > 0  →  resource.capacity
    mode = EXCLUSIVE  and D.bookedCount = 0  →  0
    mode = FIXED      and D.bookedCount > 0  →  units
    mode = PER_SEAT                          →  D.bookedCount
```

**There is no `resource_allocations` ledger.** That is deliberate:

- A ledger must be updated on booking, cancellation, expiry, restore, date-change, no-show and
  capacity edit — **seven** places to drift, in a system that already had a
  reconciler-vs-hand-edit drift bug (`source = ICAL`).
- Derived consumption has exactly one source of truth — `departures.bookedCount` — which is the SSOT
  the architecture already commits to. Cancel a booking and the resource frees itself. **Drift is
  not possible, because there is no second copy.**

Cost: an aggregate per claim, bounded by *one resource on one day* (realistically <10 rows).

This is also what keeps the promise: **resources never write `departures`.** The materializer stays
per-tour (`materializeTour(tourId)`) and untouched.

---

## 6. Q7 — the booking transaction

The existing claim is unchanged. A resource gate is added **in front of it, inside the same
transaction**:

```
BEGIN                                                  ← existing prisma.$transaction
  ── NEW ────────────────────────────────────────────────────────────────────
  resources ← SELECT * FROM tour_resources WHERE tourId = ?      (usually 0–2 rows)

  if resources is empty:
      skip everything below            ← tours with no resource behave EXACTLY as today

  for r in resources ORDER BY r.resourceId:            ← deterministic order, see §7c
      pg_advisory_xact_lock( hash(r.resourceId, localDate) )

  for r in resources:
      consumed  ← Σ consumption over overlapping departures on r   (§5)
      requested ← consumption of THIS booking under r.mode
      if consumed + requested > r.capacity:
          throw UnprocessableEntity("…is already committed at this time")
  ── /NEW ───────────────────────────────────────────────────────────────────

  <existing guarded departure updateMany — BYTE-IDENTICAL>
  if claim.count = 0 → reject
  recomputeStoredStatus(tx, departureId)
  tx.booking.create(...)
COMMIT
```

Four properties worth stating:

1. **The seat claim does not change.** The resource gate is additive and precedes it.
2. **Tours with no resources take a single indexed lookup returning zero rows**, then behave exactly
   as today. Adoption is opt-in per tour, and the blast radius of the change is proportional to how
   much of it you use.
3. **Both checks share one transaction**, so a resource rejection rolls back the seat claim and vice
   versa.
4. **All four claim sites** (§3) must route through one shared helper — see §8, challenge 2.

### Window arithmetic — a real edge case

A departure's window is `[localStart, localStart + duration)`. But `Tour.durationMinutesFrom` and
`durationMinutesTo` are **both `Int?`**. A resource-mapped tour with no duration has an undefined
window.

Options: treat as whole-day (safe, over-blocks), or require a duration before a tour may be mapped
to a resource (explicit, better). **Recommend the latter** — silently over-blocking a whole day is
the kind of surprise that erodes trust in the feature.

---

## 7. Q8 — locking strategy

Five candidates, honestly assessed.

### 7a. `SELECT … FOR UPDATE` on the `resources` row

Serialises **every day** of that resource, not just the contended one. A busy fleet would serialise
its entire booking stream across all future dates. Also an abuse of the row: it is being used purely
as a mutex, which is what advisory locks exist for. **Rejected — needlessly coarse.**

### 7b. `SELECT … FOR UPDATE` on the overlapping departure rows

Closer, but **unsound**. The rows to lock are defined by a *predicate* (windows overlapping mine).
`FOR UPDATE` locks rows that exist; it does not stop a concurrent transaction **inserting** a new
departure that satisfies the predicate — a classic **phantom read**. Under READ COMMITTED (Prisma's
default) this fails. **Rejected — incorrect.**

### 7c. `SERIALIZABLE` isolation

Genuinely correct: predicate locking handles phantoms. Costs:

- Every one of the four claim sites needs `40001` serialization-failure retry logic.
- Abort rate rises with unrelated concurrent load, not just resource contention.
- It is a large, system-wide hammer for one narrow invariant.

**Rejected for now** — correct but disproportionate. Worth revisiting if other invariants ever need
predicate-level safety.

### 7d. `pg_advisory_xact_lock(resourceId, localDate)` ← **recommended**

- **Exact.** Everyone touching that asset-day holds the same lock, so phantoms cannot occur — a
  concurrent insert must first take the lock.
- **Correctly scoped.** The contention domain is one asset on one day, which is precisely the true
  conflict set. Boat A on Tuesday does not block Boat A on Wednesday, or Boat B ever.
- **Self-releasing** at commit or rollback. No cleanup, no stuck locks, no table.
- **No new denormalised state**, so nothing to drift.
- Cost: one extra round trip per resource.

**Its real weakness:** an advisory lock is a **convention**, invisible in the schema. Nothing forces
a future claim site to take it. Mitigation in §8.

**Deadlock note:** a tour with two resources (fleet + guide) takes two locks, so they **must** be
acquired in a deterministic order — sorted by `resourceId`. Without that, two concurrent bookings
holding each other's first lock deadlock.

### 7e. Bucketed counter rows + conditional `updateMany`

Mirrors the existing departure pattern exactly, which is architecturally attractive. But windows are
**ranges**: a per-day counter over-approximates (a 09:00 charter and a 18:00 cruise would falsely
conflict). Being exact needs 15-minute `resource_slots` buckets → N rows written per booking, plus a
denormalised counter that can drift from `departures` — reintroducing precisely what §5 avoids.

**Rejected now; the documented scale-out path** if advisory-lock contention ever becomes real.

### Recommendation

**7d**, with 7e held in reserve. It is exact, proportionate, adds no state that can drift, and
reuses the transaction the booking already opens.

---

## 8. Challenging my own proposal

**Challenge 1 — is this premature?**
It would be, if operators created one tour per asset. §4 shows they do not: 15-tour and 5-tour
operators mixing PRIVATE and SHARED, with a private and a shared jet-ski tour at the same 09:00 slot.
The shape is real. **But** the demo seed is *our* fixture, not customer behaviour. **Confirm against
production data before building** — the query in §4 is the test.

**Challenge 2 — advisory locks are invisible and easy to forget.**
The most serious objection. Four claim sites exist today; a fifth added next year that forgets the
lock silently restores the bug, and it will not show up in review because there is nothing to see.
Mitigation: a single `claimDeparture()` helper that owns both the lock and the guarded update, every
site routed through it, plus a lint/unit test that **fails if `departure.updateMany` appears anywhere
outside that helper**. Without that enforcement I would not recommend this design.

**Challenge 3 — derived consumption costs a query per claim.**
Bounded by one resource-day, so realistically <10 rows behind an index. But an operator who maps 50
tours to one `GENERIC` resource makes it 50× worse and serialises their whole business on one lock.
Guard rail: cap tours per resource, or warn in the dashboard.

**Challenge 4 — claim-time enforcement means the UI can still show a departure that then fails.**
True and unavoidable without also computing at read time. Correctness first: claim-time is
mandatory. Display-time filtering is a UX follow-up using the *same* `consumed()` function — no new
concepts, so it is genuinely incremental.

**Challenge 5 — does this violate "the materializer owns departures"?**
No. Resources never write `departures` and never call the materializer. The constraint applies at
**claim** time and later at **read** time. Departure generation stays per-tour and untouched.

**Challenge 6 — is `capacity` on the resource the right unit?**
It works when tour capacity and resource capacity share a unit (4 skis, 4 seats). It gets murky if a
boat's 60 seats are sold as 20 to one product and 60 to another. `PER_SEAT` handles it, but the
operator must think in the resource's units. **Worth validating with a real operator** before
committing to the modelling.

---

## 9. Q9 — what this unlocks, with no further booking-engine change

Once `Resource` and `TourResource` exist, resource calendars are **projection and fan-out**, not new
invariants:

| Feature | How | Booking engine |
|---|---|---|
| **Resource iCal import** | busy block on R → `availability_exceptions` for every tour consuming R. Same reconciler, wider fan-out | untouched |
| **Resource iCal export** | render `consumed(R, window)` as busy intervals — a read-only view | untouched |
| **Guide calendars** | `ResourceKind.GUIDE`, capacity 1 | untouched |
| **Boat calendars** | `ResourceKind.BOAT`, capacity = seats | untouched |
| **Vehicle calendars** | `ResourceKind.VEHICLE` | untouched |
| **Maintenance / leave** | a manual busy block on R | untouched |

The reason it does not touch the engine again: **this layer defines the noun (`Resource`) and the
coupling (`TourResource`) once.** Everything afterwards is either more *data* (another resource) or
more *projection* (another feed). Neither is a new invariant, and invariants are the only thing that
forces the engine to change.

It also settles the earlier iCal question with evidence rather than assertion: an inbound busy block
cannot say *how much* of a resource is consumed, so it must assume all of it — safe to close
`EXCLUSIVE` and `FIXED` consumers, warn-only for `PER_SEAT`.

---

## 9b. Product validation — is this a real domain problem, and how does the industry solve it?

### The domain question

**Should two tours sharing an asset at the same time be impossible through business rules?**

**No — and forbidding it would destroy revenue.**

The operator lists *Private Jet Ski Island Tour* and *Palm Beach Jet Ski Safari* at 09:00
deliberately. They do not know which will sell, and the two have very different yields: four seats
sold individually versus one charter of the whole fleet. Listing both and letting the market decide
is a **yield strategy**, not a modelling error.

Forcing a pre-split — two skis to shared, two to private — is strictly worse: if the private tour
does not sell that morning, two machines sit idle that the shared tour could have filled.

So the correct product rule is:

> **Both products may be OFFERED at 09:00.
> What must be impossible is both being BOOKED beyond the fleet.**

That is contention resolved at booking time — which is precisely what a resource layer does, and
precisely what every competitor implements.

### How an operator with 4 jet skis models this today

| Option | Outcome |
|---|---|
| One shared tour only | loses the private charter product and its whole-unit pricing |
| Two separate tours | **oversells** — §4 |
| Split inventory 2 / 2 | strands machines whenever one side does not sell |
| Overbook and sort it out by phone | what operators actually do, and why they churn |

**None of these is acceptable. This is a missing product feature, not an operator modelling error.**

### The industry has converged — all five use Resources

| System | Name | Model |
|---|---|---|
| **FareHarbor** | **Resources** | "if a boat is booked on one tour, it's instantly blocked from others that use the same boat"; items sharing a resource "automatically close out" |
| **Bókun** | **Resource Management** | allocates resources across products to prevent overbooking; allocation strategies *Orderly*, *Round Robin*, *Sticky* |
| **Rezdy** | **Resources** + sharing modes | one boat assigned across overlapping sessions; first booking closes the others |
| **Peek Pro** | **Resources** (equipment + guides) | assign guides/equipment across activities, real-time availability |
| **Checkfront** | **Asset pools** + **assets** | pool has a capacity (e.g. a 15-seat shuttle); assets shared across products |

Two conclusions:

1. **Resources are the industry standard vocabulary.** Introducing them is adopting a convention
   operators already understand from other tools — not inventing a TripWheel-only concept.
2. **Nobody duplicates inventory.** Inventory duplication is the specific failure these features
   exist to eliminate.

### Rezdy's three modes — and the one I got wrong

Rezdy documents three sharing behaviours, and comparing them against §5 exposed a gap in my
proposal:

| Rezdy mode | Behaviour | My §5 mode |
|---|---|---|
| **Shared** | capacity is continually shared across all sessions as bookings arrive | `PER_SEAT` ✅ |
| **Shared (private)** | shares until one booking, then blocks **all** sessions **including the booked one** | `EXCLUSIVE` ✅ |
| **Shared (non-private)** | shares until one booking, then blocks the **other** sessions while the booked one keeps filling | **missing** ❌ |

That third mode is almost certainly the **most common real case for a boat**. A vessel running a
snorkel tour at 09:00 cannot also run a sunset cruise at 09:00 — but it *can* fill up with snorkel
guests. "First product to sell claims the asset for that window, then fills normally" is how a
shared boat actually operates.

My original `PER_SEAT` would have modelled something different and operationally odd: three
different tour products' guests riding the same vessel simultaneously. That is real for a **pooled
shuttle** — Checkfront's 15-seat wine-tour bus is exactly it — but wrong for a dive boat.

**Revised model — four modes, each matching a real operation:**

| Mode | Behaviour | Real example |
|---|---|---|
| `PER_SEAT` | products share units simultaneously | pooled shuttle, 15 seats across 3 tours |
| `EXCLUSIVE_ON_FIRST` | first booking claims the asset for that window; that product keeps filling, others close | **dive boat, one tour type at a time** |
| `FIXED` | consumes N units regardless of pax | one guide, two crew |
| `EXCLUSIVE` | one booking takes everything; nothing more sells, even on this product | private charter of the whole fleet |

The jet-ski case needs `EXCLUSIVE` on the private tour and `EXCLUSIVE_ON_FIRST` on the safari — and
the §4 overselling scenario is then correctly rejected at step 2.

*This is why the research was worth doing before building: it changed the model.*

### Incremental adoption — three levels, and most operators stay at zero

The constraint is real: an operator with one tour and no shared equipment must never see the word
"resource".

**Level 0 — default, no configuration.** A tour with no resource mapping takes one indexed lookup
returning zero rows and behaves **exactly as today**. Most operators live here permanently and the
feature is invisible to them.

**Level 1 — one question, no vocabulary.** On the tour form: *"Does this tour share equipment or
staff with your other tours?"* → pick the tours, name the thing, give it a count. The system creates
the `Resource` behind the scenes and **infers the mode** from data it already has:

- `bookingType = PRIVATE` + `pricingModel = UNIT` → `EXCLUSIVE`
- otherwise → `EXCLUSIVE_ON_FIRST` (the safe, common default)

The operator never chooses a mode, never learns a taxonomy, and the jet-ski bug is fixed.

**Level 2 — enterprise, opt-in.** A real Resources section: CRUD, explicit per-tour modes,
allocation strategies (Bókun's Orderly / Round Robin / Sticky), utilisation reporting, and resource
calendars (§9). Only surfaced to operators who have created a resource.

This ordering matters. FareHarbor and Bókun both expose Resources as an *advanced* area precisely
because most operators never need it. **Shipping the enterprise vocabulary first is how a
correctness fix turns into an adoption problem.**

**Sources:**
[FareHarbor — Resources overview](https://help.fareharbor.com/hc/en-us/articles/40897623777947-Resources-overview) ·
[FareHarbor — using Resources to track inventory](https://fareharbor.com/blog/overbooking-be-gone-use-fareharbor-resources-to-better-track-your-inventory/) ·
[Bókun — Resource Management](https://www.bokun.io/resource-management) ·
[Bókun — new resource management](https://docs.bokun.io/docs/products/product-settings-resource-allocation/new-resource-management) ·
[Bókun — multiple experiences sharing availability](https://docs.bokun.io/docs/products/product-settings-availability/how-to-have-multiple-experiences-share-availability) ·
[Rezdy — sharing resources across product sessions](https://support.rezdy.com/hc/en-us/articles/1500004025202-Sharing-Resources-Across-Multiple-Product-Sessions) ·
[Rezdy — what is a Resource](https://support.rezdy.com/hc/en-us/articles/203690714-What-Is-a-Resource-and-How-To-Set-Them-Up) ·
[Peek Pro — equipment rental](https://www.peekpro.com/solutions/equipment-rental) ·
[Checkfront — asset pools and assets](https://support.checkfront.com/hc/en-us/articles/360035623434-Adding-asset-pools-and-assets-from-the-asset-builder) ·
[Checkfront — inventory management](https://www.checkfront.com/maximize-your-resources/)

---

## 10. What I would validate before writing any code

1. **Run the §4 query against production.** If it returns nothing, this is a seed-data artefact and
   the priority drops sharply.
2. **Ask two real operators** whether their tours share physical assets, and in what units they
   think about capacity (§8, challenge 6).
3. **Decide the duration rule** for resource-mapped tours (§6): require a duration, or default to
   whole-day blocking.
4. **Agree the enforcement mechanism for challenge 2** before building. Without a single choke point
   and a test guarding it, this design decays quietly.
