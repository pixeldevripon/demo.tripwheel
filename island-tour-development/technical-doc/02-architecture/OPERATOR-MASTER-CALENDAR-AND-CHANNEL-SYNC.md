# The Operator Master Calendar — and why it is two systems, not one

> **Status:** architecture proposal. Nothing here is built yet.
> **Supersedes nothing.** The shipped per-tour iCal integration
> (`ICAL-SETUP-AND-USAGE.md`) remains correct and is Phase 0 of this plan.
> **Prerequisite reading:** `AVAILABILITY-AND-DEPARTURES.md` (departures as SSOT).

---

## 1. The short answer

**Q: Is a true Operator Master Calendar possible with RFC 5545 alone?**

**No — and no amount of convention, extension or cleverness fixes it.** But the reason is not the
one usually given, and the requirement behind the question *is* achievable. It just needs a domain
concept we do not currently model.

Three claims, argued below:

1. **iCal cannot express an operation.** A VEVENT asserts that *one* resource is occupied over an
   interval. An operator's availability is a *vector* — N tours × M departures × seat counts. This
   is a **model mismatch, not a syntax gap**, which is why metadata cannot rescue it.
2. **The unit of calendar synchronisation is the RESOURCE, not the tour and not the operator.** A
   resource — a boat, a guide, a vehicle — is a thing that can only be in one place at a time. That
   *is* a single busy/free timeline, which is exactly what iCal models. Introduce resources and the
   mismatch disappears for the cases where a master calendar is genuinely meaningful.
3. **A channel manager cannot be built on iCal, ever.** Not because of expressiveness, but because
   of latency, acknowledgement and capacity. That job belongs to **OCTO**, which is the industry
   standard for tours and activities — and which this codebase has already started (`src/octo/`).

So the answer to "one feed for the whole operation" is: **two protocols, each doing the job it is
good at.** iCal for coarse blocking and human calendars. OCTO for capacity-aware distribution.

---

## 2. Challenging the requirement

Before designing, two parts of the premise need pushing back on.

### 2a. One outbound feed for all tours would *lose you money*

The stated goal — "expose ONE feed external platforms subscribe to, to sync the operator's entire
operation" — is actively harmful when the consumer is an OTA.

Take the example operator:

| Tour | Runs on |
|---|---|
| Saint Martin Tour | minibus |
| Snorkeling Tour | boat A |
| Sunset Cruise | boat A |
| Private Boat Charter | boat A |

If Airbnb subscribes to a single "this operator is busy" timeline, then a sold-out **Sunset Cruise**
marks Tuesday evening busy — and Airbnb stops selling the **Saint Martin Tour**, which runs on a
completely different vehicle with an empty minibus. You have just closed sellable inventory.

An OTA listing maps to **one product**. Publishing per-product is correct, not a limitation. The
per-tour `CHANNEL` feed already shipped is the right shape and should not be replaced.

What *is* missing is the observation that the Snorkeling Tour, Sunset Cruise and Private Charter
share **boat A** — and that a booking on any of them should affect the other two. That is a real
requirement, and it is a **resource** constraint, not a calendar-feed topology problem.

### 2b. "Sync the entire operation" conflates two different jobs

| | Job A — **Blocking** | Job B — **Distribution** |
|---|---|---|
| Question | "when can this operator not run?" | "how many seats are left on departure X?" |
| Shape | busy/free intervals | typed inventory with counts |
| Latency tolerance | hours | seconds |
| Correct protocol | **iCal** | **OCTO** |
| Direction | mostly inbound | bidirectional |
| Failure mode | over-blocking (safe) | overselling (unsafe) |

Trying to make one feed do both is what makes the problem look unsolvable. Split them and each half
becomes tractable.

---

## 3. Why iCal cannot carry the operation (the rigorous version)

### 3a. The data model, precisely

RFC 5545's `VEVENT` says: *this calendar's subject is occupied from DTSTART to DTEND*. The subject
is **opaque and singular** — the calendar itself. There is no notion of *which* of several things is
occupied, nor *how much* of it.

`VFREEBUSY` (§3.6.4) is no better. `FBTYPE` admits only `FREE`, `BUSY`, `BUSY-UNAVAILABLE`,
`BUSY-TENTATIVE`. All are booleans over an interval. **There is no cardinality anywhere in RFC 5545.**

### 3b. Capacity is not representable, even in principle

To express *"3 of 60 seats sold"* in iCal you would need either:

- **60 parallel calendars**, one per seat — absurd, and it still cannot express which seat is which;
  or
- **a numeric property** — which is an extension, and therefore something no third party sends.

This yields the sharpest statement of the limit:

> **A busy/free protocol can express "sold out" and "not sold out". It can never express "how many
> are left."**

Therefore an iCal-only integration can do **stop-sell** but can never do **inventory
synchronisation**. Those are different products. Our shipped `CHANNEL` feed is honest about this: it
publishes a date only once the tour *cannot take another booking* — a stop-sell signal, deliberately
not an inventory feed.

### 3c. Identity is not representable either

Your list is right — no `tourId`, `departureId`, `slotId`. But note **which direction that hurts**:

- **Outbound**, we control the producer, so we *could* emit identity. It just does not help
  (see §4).
- **Inbound**, we do not control Airbnb, Google or Apple. They will emit `SUMMARY:Reserved` until
  the end of time. **No design decision of ours changes a single byte of what arrives.**

This asymmetry is the crux. Inbound richness is not an engineering choice available to us. Any
architecture premised on receiving richer iCal is premised on something that will not happen.

### 3d. Even the transport is wrong for inventory

Set semantics aside. iCal-over-HTTP has:

- **No acknowledgement.** You cannot know a partner applied your change.
- **No idempotency or transaction identity.** No request id, no retry semantics.
- **No incremental sync.** Every poll is a full document diff.
- **No authentication** beyond a bearer URL in a query string.
- **No error channel.** A partner that rejects your data has no way to say so.
- **Latency measured in hours.** Google refreshes external calendars on its own schedule —
  commonly **8–24 hours**, unforceable. Airbnb is roughly hourly at best. Our own poll is 15 minutes.

You cannot run atomic seat inventory over a polled flat file with a 24-hour worst-case propagation
delay. This alone disqualifies iCal as the channel protocol, independent of everything in §3a–3c.

---

## 4. Q3 — Should we extend iCal with `X-` properties?

**No.** It is the worst of both worlds, and here is the precise argument.

RFC 5545 §3.8.8.2 does permit `X-` properties, and conformant clients must ignore unknown ones — so
emitting `X-TRIPWHEEL-TOUR-ID` is *legal* and would not break Google. But:

1. **Inbound it is worthless.** No external platform will ever send our extension. The direction
   that most needs richness cannot receive it.
2. **Outbound it is redundant.** Any partner capable of parsing our `X-` properties is capable of
   calling a JSON endpoint — and JSON gives us versioning, authentication, pagination, incremental
   sync, idempotency keys, error responses, and rate limiting. Every one of those is absent from
   iCal.
3. **It creates a private protocol wearing a standard's clothes.** Integrators would see
   `text/calendar` and reasonably assume standard semantics, then silently lose the half of the
   meaning that lives in `X-` properties. A feed that is *only* correct if you read our extensions is
   a proprietary format with a misleading MIME type.

**Use `X-` properties only for things that are genuinely annotations on a standard event** — for
example a loop-prevention marker (`X-TRIPWHEEL-ORIGIN`) so we can recognise our own blocks echoed
back at us. That is metadata *about* a busy interval, not a smuggled second data model.

---

## 5. Q4 — Should we build a TripWheel-specific protocol?

**No. Finish OCTO.**

This is the single highest-leverage decision in this document.

**OCTO** (Open Connectivity for Tours & Activities) is the industry-standard REST specification for
exactly this domain. It models suppliers, products, options, availability *with capacity*,
pricing, and the reservation → confirmation booking lifecycle. It is what the major resellers in
this category consume.

Building a bespoke TripWheel protocol would mean every future partner integration is a custom
project — for you and for them. Adopting the standard means a partner who already speaks OCTO can
integrate with configuration rather than code.

**You have already started it:**

| Piece | Status |
|---|---|
| `src/octo/octo-supplier.controller.ts` | ✅ supplier identity |
| `src/octo/octo-tours.controller.ts` | ✅ product list + get product (§3, §4.2) |
| `src/notifications/` (OCTO webhooks + BullMQ delivery) | ✅ **the push transport already exists** |
| Availability calendar / availability check | ❌ not built |
| Booking lifecycle (reservation → confirmation → cancel) | ❌ not built |

The catalogue half is done and the delivery mechanism is done. What is missing is precisely the
availability and capacity half — which is precisely what the master-calendar requirement is asking
for. **The requirement is an OCTO roadmap item, not an iCal design problem.**

---

## 6. The reframe: the resource is the unit of synchronisation

Here is the concept the domain model is missing.

> A **resource** is a thing that can only be in one place at a time.
> A **tour** is a product you sell. A **departure** is an instance of that product.
> A departure **consumes** resources for its window.

Once resources exist, the confusion dissolves:

| The operator says | The truth is | Sync unit |
|---|---|---|
| "I only have one boat" | 3 tours consume **boat A** | one resource calendar |
| "I'm the only guide" | all tours consume **guide: me** | one resource calendar |
| "these are unrelated products" | disjoint resources | per-tour, as today |

And critically — **a resource genuinely is a single busy/free timeline.** That is exactly what a
`VEVENT` models. So for resource-scoped calendars, **iCal stops being a mismatch and becomes the
right tool.** The operator's personal Google Calendar marking Tuesday busy is a true, complete
statement about the resource "me".

This is what makes an Operator Master Calendar *possible* — not extensions, not conventions. A
model that matches what the protocol can actually say.

### The remaining honest limitation

A **shared** resource (boat A holds 60; the Snorkeling Tour takes 20 of them) cannot be expressed
in iCal, because partial consumption is a count. So:

- **Exclusive** resource consumption + iCal → can safely close.
- **Shared** resource consumption + iCal → **can only warn.**

This is the same reasoning that made `WARN_ONLY` the default for the shipped import, and it
generalises cleanly rather than needing a special case.

---

## 6b. Mixed exclusivity: private charters and shared seats on the same asset

The operator has **both** kinds of product, often on the same boat. This needs care, because two
different questions hide behind the word "exclusive" and only one of them is solved.

### What already works — exclusivity *within* a tour

`bookings.service.ts` already distinguishes them, and correctly:

```ts
// UNIT + PRIVATE = exclusive charter: one booking takes the whole departure.
const exclusive = ctx.isUnit && ctx.tour.bookingType === TourBookingType.PRIVATE;
```

| Product shape | Claim |
|---|---|
| `UNIT` + `PRIVATE` | `WHERE bookedCount = 0` → `SET bookedCount = capacity` — takes the whole departure |
| everything else | `WHERE bookedCount <= capacity - seats` → `increment` — takes seats |

Both are single guarded `updateMany`s, so the loser of a race matches zero rows. **Axis 1 is done
and should not be touched.**

### What does not work — exclusivity *across* tours

`departures` is unique on `[tourId, date, startTime]`. Two products running off **boat A** at 09:00
are **two independent rows with two independent counters**, and nothing connects them.

So today, on one boat:

| Time | Event | Should happen | Actually happens |
|---|---|---|---|
| 09:00 | Private Charter booked | Snorkeling 09:00 closes | **stays open and sellable** |
| 09:00 | 20 seats sold on Snorkeling | Charter 09:00 closes | **stays open and sellable** |

**This is a latent overselling hole that exists today, independent of iCal.** It only bites when two
tours share one physical asset — but that is exactly the operator shape described. It is the most
important thing in this document, and it is a *booking correctness* problem, not a calendar one.

### The unifying idea: one currency, resource units

Model both axes in a single quantity — **units of a resource consumed over a window**:

```
consumed(resource, window) = Σ over departures D overlapping window:
    D is exclusive AND D.bookedCount > 0   →  resource.capacity     (the whole asset is gone)
    D is exclusive AND D.bookedCount = 0   →  0                     (not claimed yet)
    otherwise                              →  D.bookedCount         (seats taken)
```

A departure may sell `n` more iff `consumed(resource, its window) + n <= resource.capacity`.

This one expression covers every case the operator has:

- charter booked → consumes the whole asset → every overlapping shared departure closes
- 20 shared seats sold → consumes 20 → the charter (which needs all 60) can no longer be claimed
- 20 shared seats sold → a second shared tour on the same hull may still sell 40

### Implementing it without touching the atomic claim

The seat claim stays exactly as it is. A **second guarded claim** on the resource joins it **inside
the same transaction**, and both must succeed:

```
BEGIN
  pg_advisory_xact_lock(hash(resourceId, localDate))   -- serialise this asset, this day only
  recompute consumed(resource, window)                 -- from overlapping departures
  if consumed + requested > resource.capacity → reject
  <existing guarded departure claim, unchanged>
COMMIT
```

Why a transaction-scoped advisory lock rather than more conditional updates: resource windows are
**ranges**, and a single conditional `updateMany` cannot express "no overlapping range exceeds
capacity". The lock makes the check exact, its contention domain is one asset on one day (tiny), and
it needs no new denormalised counter to drift out of sync.

If contention ever becomes real, the scale-out path is to bucket each window into fixed slots
(15-minute `resource_slots` rows) and claim every bucket with the same conditional-`updateMany`
pattern already proven for departures — no advisory lock, at the cost of N rows per booking.

**Availability display** stays cheap: the materializer projects departures as it does now, and
`consumed()` is computed per resource-day when rendering a calendar, then intersected. No second
inventory table, no shadow state.

### What this means for iCal

The `EXCLUSIVE` / `SHARED` distinction in §8a is now precise. An inbound iCal busy block cannot say
*how much* of a resource is consumed, so it must assume **all** of it:

| Overlapping departure | Effect of a resource-scoped iCal block |
|---|---|
| exclusive (charter) | safe to close — the asset is genuinely unavailable |
| shared (seats) | **warn only** — "all of it" may be a wild overstatement |

Which is the same conclusion as before, now derived rather than asserted.

---

## 6c. Layering — the right axis, and two things in the wrong place

The proposed shape is:

```
Inventory ─┬─ Private     → iCal
           ├─ Shared Seat → OCTO/API
           └─ Resource    → iCal/API
```

**The instinct is correct: layer by concern, and let each protocol own one.** That is the right
conclusion. But the concerns have been attached to the wrong dimension, and one branch is a category
error.

### Challenge 1 — protocol is not chosen by inventory type

Two counterexamples kill the mapping:

- A **private charter sold on Viator** needs OCTO. Viator must *make a booking*, and iCal cannot
  express one. Private → iCal is therefore not sufficient.
- A **shared seat tour on the operator's own iPhone** needs iCal. Apple Calendar will never speak
  OCTO. Shared → OCTO is therefore not sufficient either.

Both inventory types need **both** protocols. So inventory type cannot be the selector.

What actually selects the protocol is a different pair of questions:

1. **What is being exchanged — a constraint, or inventory?**
2. **What can the counterparty speak?**

Which gives the real decomposition:

| Plane | Question it answers | Protocol | Properties | Failure mode |
|---|---|---|---|---|
| **Constraint** | "when can this *not* run?" | **iCal** | lossy, coarse, polled, hours of latency | over-blocking — **safe** |
| **Inventory** | "how many seats, what price, hold two" | **OCTO/API** | exact, counted, transactional, pushed | overselling — **unsafe** |

The rule that falls out is short enough to remember:

> **iCal never sells. OCTO never blocks.**
> iCal moves *constraints*. OCTO moves *inventory and bookings*.
> Every inventory type needs both — for different counterparties.

### Challenge 2 — a resource is not a third inventory type

`Resource` sits as a sibling of `Private` and `Shared Seat` in the diagram, but it is a different
kind of thing:

|  | Sellable? | Has a price? | A traveller can book it? |
|---|---|---|---|
| Private tour | ✅ | ✅ | ✅ |
| Shared seat tour | ✅ | ✅ | ✅ |
| **Resource** | ❌ | ❌ | ❌ |

Nobody books "boat A". A resource is **a constraint that couples inventory** — it is what makes the
charter and the snorkel tour interfere (§6b). Putting it on the inventory axis invites a
`resource_inventory` table, which is the second-availability-layer mistake in a new costume.

Corrected shape:

```
              SELLABLE INVENTORY                     CONSTRAINTS
         ┌────────────┴────────────┐            ┌────────┴────────┐
    Private (qty 1)      Shared seat (qty N)  Resource      Operator/staff
         └────────────┬────────────┘            └────────┬────────┘
                      │                                  │
        ┌─────────────┴───────────────┐                  │
        ▼                             ▼                  ▼
  INVENTORY PLANE              CONSTRAINT PLANE ◄────────┘
  OCTO / native API            iCal (+ API)
  counts · holds · bookings    stop-sell only
        └─────────────┬───────────────┘
                      ▼
        Availability engine  (exceptions → materializer)
                      ▼
              DEPARTURES = SSOT
                      ▼
           Atomic claim  (+ resource claim, §6b)
```

Note what is preserved: **both planes converge on exceptions → materializer → departures.** There is
still exactly one inventory truth and one place capacity is enforced.

### Where iCal is genuinely excellent — and where it is genuinely wrong

The diagram's `Private → iCal` is right, and for a reason worth naming: **a private charter's state
really is binary.** Booked or not booked. That is precisely what a `VEVENT` encodes, so for
inventory of quantity 1 the protocol and the domain agree exactly — no information is lost in either
direction.

For shared seats they disagree completely: `bookedCount = 20 / capacity = 60` collapses to "busy",
which is either a 40-seat lie or a 20-seat one depending on which way you read it.

| Inventory | iCal **out** | iCal **in** | OCTO |
|---|---|---|---|
| **Private (qty 1)** | ✅ **lossless** — booked = busy | ✅ safe to close | required to *sell* it |
| **Shared (qty N)** | ⚠️ only as "sold out" — never partial | ⚠️ **warn only** — cannot say how many | ✅ the only correct channel |
| **Resource** | ✅ commitment intervals | ✅ the master-calendar case | optional |

This is why the shipped `CHANNEL` feed publishes a date **only when the tour cannot take another
booking**: it is the single projection that is truthful for both quantity-1 and quantity-N inventory.

### Answering the five questions directly

- **Which protocol per inventory type?** Wrong axis — but as a practical matrix: private inventory
  is fully served by iCal for blocking *and* needs OCTO to be sold remotely; shared inventory needs
  OCTO for anything involving counts and may use iCal only for stop-sell; resources are
  constraint-plane only and iCal fits them natively.
- **Which should use iCal?** Everything that is a **constraint**: resource and staff blackouts,
  private-charter occupancy, and outbound stop-sell for any tour.
- **Which require OCTO/API?** Everything involving a **count, a price, or a hold** — so all remote
  *selling*, of either inventory type. Shared seats have no alternative.
- **Where do resource calendars fit?** Constraint plane only. They never carry inventory. They fan
  out to every consuming tour through `availability_exceptions`, and their effect depends on the
  consuming tour's exclusivity (§6b).
- **How should the Operator Master Calendar behave?** See §6d.

---

## 6d. What the Operator Master Calendar actually is

It is **two different objects that share a name**, and separating them resolves the whole question.

**Outbound — a human view, never a channel.** One feed carrying everything across all tours, with
traveller detail, for the operator's own phone. This already exists: the `BOOKINGS` / `DEPARTURES`
feeds and the dashboard `/calendar` page. It is legitimate precisely *because* the consumer is a
human who can interpret it. It must never be handed to a channel, for the reason in §2a.

**Inbound — a resource calendar where the resource is the operator.** "I am at a wedding Tuesday" →
a block on the resource *me* → fans out to every tour I personally run. This is the genuinely useful
master-calendar import, and it is a resource calendar with no new machinery.

So:

> The Operator Master Calendar is **an export for humans and a resource import for constraints.**
> It is never an inventory channel in either direction.

And the answer to the original per-tour question: **per-tour iCal is not replaced.** It stays, for
tours that map to an external listing. Resource calendars are **added alongside** for constraints
that span tours. The two coexist and compose, which is the layering instinct — applied to concerns
rather than to inventory types.

---

## 7. The architecture: three planes

The governing rule, unchanged: **`departures` is the single source of truth, and only
`AvailabilityMaterializer` writes it.**

```
┌─ PLANE 3 — DISTRIBUTION (protocol adapters) ──────────────────────────┐
│  iCal in    iCal out (per tour / per resource)    OCTO in/out         │
│  ─────────────────────────┬───────────────────────────────────────    │
│  never write departures ──┘  write EXCEPTIONS (in) / read views (out) │
└───────────────────────────────────────────────────────────────────────┘
                                  ↕
┌─ PLANE 2 — CONSTRAINT (new) ──────────────────────────────────────────┐
│  resources · tour_resources · resource busy blocks                    │
│  translates "resource R busy [s,e)" → per-tour availability exceptions│
└───────────────────────────────────────────────────────────────────────┘
                                  ↕
┌─ PLANE 1 — INVENTORY (existing, untouched) ───────────────────────────┐
│  availability_schedules + availability_exceptions                     │
│         → AvailabilityMaterializer → departures → atomic seat claim   │
└───────────────────────────────────────────────────────────────────────┘
```

**Plane 1 does not change.** No booking-architecture rewrite. Every new capability enters through
exceptions, which is the seam the materializer already honours.

**Plane 2 is the only new domain concept.** It is small: two tables and a fan-out function.

**Plane 3 is adapters.** Each protocol translates into Plane 2 or Plane 1 vocabulary and has no
privileged access to inventory. Adding a fourth protocol later touches nothing below it.

---

## 8. Data model

### 8a. New — resources

```prisma
enum ResourceKind { BOAT  VEHICLE  GUIDE  EQUIPMENT  GENERIC }

model Resource {
  id         String       @id @default(uuid())
  operatorId String
  name       String       /// "Boat A", "Miguel", "Minibus 1"
  kind       ResourceKind @default(GENERIC)

  /// Total simultaneous units. NULL = indivisible (one departure at a time).
  /// A 60-seat boat shared across products sets 60; a single guide leaves NULL.
  capacity   Int?

  isActive   Boolean      @default(true)

  tours         TourResource[]
  subscriptions CalendarSubscription[]
  feeds         CalendarFeed[]

  @@unique([operatorId, name])
  @@map("resources")
}

enum ResourceExclusivity {
  EXCLUSIVE  /// a departure takes the whole resource for its window
  SHARED     /// a departure takes `quantity` of resource.capacity
}

model TourResource {
  tourId      String
  resourceId  String
  exclusivity ResourceExclusivity @default(EXCLUSIVE)
  quantity    Int                 @default(1)

  @@id([tourId, resourceId])
  @@map("tour_resources")
}
```

### 8b. Changed — `CalendarSubscription` gains a scope

```prisma
enum CalendarScope { TOUR  RESOURCE }

model CalendarSubscription {
  scope      CalendarScope @default(TOUR)
  operatorId String        /// denormalised: needed to fan out without a tour
  tourId     String?       /// set iff scope = TOUR
  resourceId String?       /// set iff scope = RESOURCE

  /// tourId | resourceId — makes the unique index work across both scopes,
  /// the same trick CalendarFeed already uses for the CHANNEL kind.
  scopeKey   String

  @@unique([operatorId, scopeKey, urlHash])
}
```

### 8c. **The blocking migration** — one index must change

`AvailabilityException` is currently unique on:

```prisma
@@unique([subscriptionId, externalUid, date, slotKey])
```

**`tourId` is not in that key.** A resource-scoped subscription writing the same busy date to four
tours violates it on the second tour. This is the concrete blocker, and it must become:

```prisma
@@unique([subscriptionId, tourId, externalUid, date, slotKey])
```

Nothing else in Plane 1 changes.

### 8d. Unchanged, deliberately

`departures`, `availability_schedules`, the booking tables and the atomic claim are **untouched**.
There is still **no `blocked_dates` table** — a second availability layer remains the thing we most
want to avoid.

---

## 9. Synchronisation flows

### 9a. Inbound iCal — resource-scoped (the master calendar)

```
poll → SSRF-guarded fetch → parse (ical.js) → BusyBlock[]
     → resolve scope
         TOUR      → { that tour }                    (today's behaviour)
         RESOURCE  → every ACTIVE tour consuming it   (new fan-out)
     → per tour: map blocks → exceptions, honouring import mode
     → reconcile (diff scoped to subscriptionId + tourId + source=ICAL)
     → AvailabilityService.resync(tour) for each affected tour
```

Consumption rules for a resource-scoped block:

| Tour consumes resource as | Effect |
|---|---|
| `EXCLUSIVE` | departure cannot run → `CLOSE_SLOT` / `CLOSE_DATE` per mode |
| `SHARED` | partial consumption is unrepresentable in iCal → **warn only** |

The existing four import modes carry over unchanged. `WARN_ONLY` stays the default and matters far
more at resource scope, where blast radius is the whole catalogue.

### 9b. Outbound iCal — three feeds, three audiences

| Feed | Scope | Contains | Audience |
|---|---|---|---|
| `CHANNEL` *(shipped)* | one tour | dates the tour cannot take another booking | **an OTA** |
| `RESOURCE` *(new)* | one resource | intervals where the resource is committed | operator's own calendar app, or a partner blocking that asset |
| `BOOKINGS` / `DEPARTURES` *(shipped)* | operator | full agenda, with traveller detail | **humans only — never a channel** |

The master *view* the operator already has in the dashboard `/calendar` page is served by
`BOOKINGS`/`DEPARTURES`. That is the legitimate "one calendar for everything" — for a human. It must
never be handed to a channel, because §2a.

### 9c. OCTO — the actual channel manager

```
Partner ──GET /octo/products──────────────► catalogue          ✅ built
Partner ──GET /octo/availability/calendar─► date-level summary  ❌ to build
Partner ──POST /octo/availability─────────► slot + REAL capacity ❌ to build
Partner ──POST /octo/bookings─────────────► reservation (hold)   ❌ to build
Partner ──POST /octo/bookings/{id}/confirm► confirmation         ❌ to build
TripWheel ──webhook──────────────────────► availability changed  ✅ transport exists
```

This is where `capacity` and `bookedCount` travel — the two fields iCal can never carry. The
reservation → confirmation handshake is what makes distributed selling safe, and it maps directly
onto the existing atomic claim: **a reservation is a hold on real departure seats**, not a parallel
inventory.

---

## 10. Precedence and conflict resolution

With multiple writers, a departure's status needs a **deterministic, total order**. Proposed:

```
1. Booked seats are never destroyed.        (already true — closing stops NEW sales only)
2. MANUAL      operator's own hand           — always wins
3. OCTO/API    authoritative, capacity-aware — beats coarse signals
4. ICAL        coarse busy/free              — weakest write
5. SCHEDULE    the default projection
```

Within a tier, **most restrictive wins**. Every exception already records `source`, so this is
computable, explainable in the UI ("closed by your Airbnb calendar"), and auditable.

**Conflict** keeps its current meaning — an imported block landing on a departure with seats already
sold — and remains an alert, never an automatic cancellation. At resource scope, conflicts must be
**collapsed per sync run**, or one busy week emails an operator once per affected tour.

### Loop prevention

Generalise the existing `excludeFromExport`: every exception carries its origin, and an outbound
feed never republishes blocks that originated from the partner it is being served to. Stamp our own
outbound events with `X-TRIPWHEEL-ORIGIN` so an echo is recognisable. Without this, connecting a
channel in both directions produces a block that ping-pongs and never dies.

---

## 11. Polling and push strategy

| Channel | Mechanism | Cadence | Notes |
|---|---|---|---|
| iCal inbound | poll + conditional GET | 15-min tick, per-subscription interval, DB retry ladder | already built |
| iCal outbound | subscriber polls us | ETag/304; `REFRESH-INTERVAL` advertised | Google ignores it: 8–24 h is normal |
| OCTO outbound | **webhook push** | on change | transport already exists in `notifications/` |
| OCTO reconcile | partner pulls calendar | nightly | **push alone drifts** — periodic full reconciliation is mandatory in every serious channel manager |

The last row is the one teams skip and regret. Webhooks are lossy; a scheduled reconciliation is
what keeps two systems honest over months.

---

## 12. Migration strategy

Strictly additive, each phase shippable and reversible.

| Phase | Work | Risk |
|---|---|---|
| **0** *(done)* | per-tour iCal import + `CHANNEL` export | — |
| **1** | `resources` + `tour_resources`; dashboard CRUD; **no sync behaviour yet**. Purely additive. | very low |
| **2** | Exception unique-key migration (add `tourId`); `CalendarSubscription` scope columns; existing rows backfill to `scope = TOUR`. Behaviour unchanged. | low — index change, no semantics |
| **3** | Resource-scoped **import** + fan-out. Ships the master calendar. Force `WARN_ONLY` initially. | medium — blast radius |
| **4** | Resource-scoped **export** feed. | low |
| **5** | OCTO availability calendar + availability check *(read-only distribution)* | medium |
| **6** | OCTO booking lifecycle (reservation → confirmation → cancellation) | high — touches money |
| **7** | Webhook fan-out on availability change + nightly reconciliation | medium |

Phases 1–2 are safe to do now and unblock everything else. Phase 3 delivers what was asked for.
Phases 5–7 are the actual channel manager and are a separate programme of work, not a feature.

---

## 13. Direct answers

**1. Is a true Operator Master Calendar possible with RFC 5545 alone?**
No. iCal expresses occupancy of one opaque resource; an operation is a vector of tours, departures
and seat counts. It is a model mismatch, and there is no cardinality anywhere in the spec. But a
**resource-scoped** master calendar *is* possible and correct, because a resource really is one
busy/free timeline.

**2. What extra metadata would be required?**
For outbound: tour/departure/slot identity and capacity. For inbound: **none is achievable** — we do
not control the producers, and they will never send it. Any design assuming richer inbound iCal is
assuming something that will not happen.

**3. Extend with `X-` properties?**
Only for annotations on a standard event, such as a loop-prevention origin marker. Never to carry
inventory: worthless inbound, redundant outbound, and it turns a standard MIME type into a private
protocol.

**4. Build a TripWheel protocol?**
No. **Finish OCTO** — the domain's actual standard, already begun here, with the webhook transport
already in place. A bespoke protocol makes every partner integration a custom project forever.

**5. How do both audiences work?**
Layer them. iCal remains the lowest common denominator for Google/Apple/Airbnb — coarse busy/free,
per tour or per resource. OCTO carries products, departures, slots and real capacity for partners
who can use it. Both write through the **same** exceptions → materializer → departures path, so
there is exactly one inventory truth and one place capacity is enforced.

**6. Complete architecture?**
§7–§12 above.

---

## 14. What this deliberately does not do

- **No second availability layer.** No `blocked_dates`, no shadow inventory. Everything lands in
  `availability_exceptions` and is projected by the one materializer.
- **No booking-architecture rewrite.** The atomic claim is untouched; an OCTO reservation becomes a
  hold on real departure seats.
- **No single outbound feed spanning unrelated tours.** It would close sellable inventory (§2a).
- **No attempt to make iCal carry capacity.** It cannot, and pretending otherwise is how
  overselling happens.

---

## 15. Decisions needed before Phase 1

1. **Do operators actually share resources across tours today?** If most run one product per asset,
   Phase 3's value drops sharply and per-tour connections may be enough. Worth checking against real
   operator data before building.
2. **May a resource-scoped calendar ever close inventory, or only warn?** Recommendation: **warn
   only at first**. A stale personal Google Calendar taking an entire catalogue off sale is the
   worst failure this system can produce.
3. **Is a channel manager (Phases 5–7) actually on the roadmap,** or is iCal stop-sell sufficient for
   now? This determines whether OCTO availability is urgent or merely eventual.
4. **Should resources carry their own timezone,** or always inherit the tour's? Matters for
   operators working across islands.
