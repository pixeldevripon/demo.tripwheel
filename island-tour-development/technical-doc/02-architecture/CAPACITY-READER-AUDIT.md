# Capacity reader audit (finding F4)

> **Phase 1 deliverable.** Produced *before* any resource is attached to a tour, so the work is
> known rather than discovered.
> **The finding:** the resource layer's schema change is additive; its **semantic** change is
> platform-wide. `departures.capacity` stops meaning "seats that can be sold" the moment a tour is
> mapped to a resource.
> **Frozen design:** `RESOURCE-ARCHITECTURE-REVIEW-VERDICT.md`

---

## The two numbers

| | Meaning | Source |
|---|---|---|
| `departure.capacity` | seats this departure was **scheduled** for | `departures` column |
| `effectiveCapacity()` | seats it can **actually sell** right now | `src/resources/resource-allocation.util.ts` |

They are equal for every tour with no resource attached — which is every tour today, and will remain
most tours forever. They diverge only once an asset is shared, and the divergence is total: a
four-seat safari on a chartered fleet still reports `capacity = 4` while being unsellable.

**Rule of thumb:** if the number is shown to a human, published to a partner, or used to decide
whether something is sellable, it must be **effective**. If it describes how the schedule was
configured, it stays **raw**.

---

## The readers

`🔴` must switch (Phase 5) · `🟢` correctly stays raw · `⚪` unaffected

| # | Reader | File | Verdict | Why |
|---|---|---|---|---|
| 1 | **CHANNEL iCal sellability** | `calendar-feeds.service.ts:451` | 🔴 **highest risk** | `bookedCount < capacity` decides whether a date is published as available **to an OTA**. Raw capacity here means publishing inventory that does not exist — an oversell originating from us |
| 2 | **Public availability / booking widget** | `tours.service.ts:~1150` | 🔴 | `capacity - bookedCount >= guests` gates what a traveller can select. Raw means offering seats that will fail at checkout |
| 3 | **`isBookable` listing gate** | `tours.service.ts:~793` | 🔴 | decides whether a tour appears in listings and sitemaps. Raw means a tour indexed as bookable with no usable inventory — **SEO impact**, not just UX |
| 4 | **Departure status derivation** | `availability-status.util.ts:20` | 🔴 | `remaining` and the OPEN/SOLD_OUT flip. Everything downstream inherits this, so it is the highest-leverage single switch |
| 5 | **DEPARTURES iCal feed** | `calendar-feeds.service.ts:~491` | 🔴 | shows the operator "how full" a departure is. A guide reading it needs the real number |
| 6 | **Demand signal / analytics** | `demand-signal.ts:92` | 🔴 | `totalCapacity` and `remaining` feed demand scoring. Raw silently overstates supply |
| 7 | **OCTO availability** | not yet built | 🔴 Phase 8 | a paying partner's view. Must be effective from the first line written |
| 8 | **Atomic seat claim** | `bookings.service.ts:600–628` | 🟢 | the guard threshold must stay raw — the resource constraint is a **separate** check in the same transaction (Phase 3/4), not a smaller number here. Conflating them would hide which limit rejected a booking |
| 9 | **Materializer projection** | `availability-materializer.service.ts` | 🟢 | writes `departures.capacity` from schedules and exceptions. This *is* the raw number's definition |
| 10 | **`SET_CAPACITY` exception** | `availability.service.ts` | 🟢 | an operator setting the scheduled capacity. Raw by definition |
| 11 | **iCal conflict detection** | `block-mapper.util.ts:235`, `calendar-reconciler.service.ts` | 🟢 | asks "did this departure already sell something" (`bookedCount > 0`) — a fact about bookings, not about sellability |
| 12 | **Booking pricing** | `booking-pricing.util.ts` | ⚪ | party-size arithmetic, unrelated to departure capacity |
| 13 | **Staff config / rate limiter / hubs** | `staff.config.ts`, `lookup-rate-limiter.ts`, `hubs.service.ts` | ⚪ | unrelated uses of the word |

**Seven readers must switch. Four must deliberately not. Three are false matches.**

---

## Sequencing (Phase 5)

Order matters, because the blast radius differs by orders of magnitude:

1. **#4 status derivation** — one function, and most other readers inherit from it.
2. **#1 CHANNEL feed** — the only reader that can cause an oversell on someone else's platform.
3. **#2 widget** and **#5 DEPARTURES feed** — user-visible, immediately verifiable.
4. **#6 demand signal** — internal, no external contract.
5. **#3 `isBookable` gate — LAST**, and watch indexing afterwards. It changes which pages search
   engines consider live; shipping it alongside anything else makes an indexing dip impossible to
   attribute.

Each is independently revertible. None requires a data migration.

---

## Why this is safe to defer to Phase 5

`effectiveCapacity()` returns `departure.capacity` unchanged when a departure has no resources
(`resources.length === 0` short-circuits before any work). Since Phase 1 creates **zero** resource
rows, every reader is already returning the correct number today.

The audit exists so that Phase 5 is a known list of seven edits rather than an open-ended
investigation — and so nobody attaches a resource in production before those seven are done. That
ordering is the actual risk, and it is why the audit is Phase 1 work rather than Phase 5 work.
