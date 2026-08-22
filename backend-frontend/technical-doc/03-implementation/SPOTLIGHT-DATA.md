# Destination Spotlight (per-tour) - data & logic

> How a tour manages Spotlight requests. Spotlight is **not a tier** - it is a separate,
> manually-approved placement overlay modeled per-tour by `SpotlightRequest` (in
> `backend/prisma/tiers.prisma`). Companion to `TOUR-MODULE-DATA.md` (tour tier columns) and
> `BOOKING-AND-PAYMENT-DATA.md` (commission snapshot).
>
> Sources: master "Destination Spotlight" (35% block, max 3/destination, manual approval) +
> `02-architecture/COMMERCIAL-MODEL.md` §1 (Spotlight block) and §5 (extra eligibility bar).
>
> Legend: **✓** present today · **+ TO ADD** optional/recommended · **W** = writer (`OP` operator,
> `ADM` admin, `SYS` system/job, `RO` computed).

---

## 0. What Spotlight is (and is not)

| | |
|---|---|
| Commission | **35%** (only while active) |
| Placement | **Separate labeled block, never interleaved** with the ranked list |
| Cap | **Max 3 simultaneous per destination** (hard, across all operators) |
| Approval | **Manual** - operator requests, Island Tours approves (not self-serve) |
| Extra eligibility (on top of the flat bar) | **>=10 reviews · rating >=4.5 · cancellation_rate_90d <=10%** |

Spotlight does **not** change the tour's `tierKey`/`commissionTier`/`tierRank` columns - those stay at
the operator's chosen tier. Spotlight is an **overlay** that wins on commission + placement while active.

---

## 1. Lifecycle

```
Operator requests Spotlight for a tour
        │  service checks the extra eligibility bar (>=10 reviews · >=4.5 · <=10% cancel)
        ▼
REQUESTED ──admin approves (manual; verify active count for destination < 3)──► APPROVED
        │                                          (approvedBy, startsAt, endsAt set)
        │                                                     │
        │                                          startsAt reached
        │                                                     ▼
        │                                                  ACTIVE ──endsAt reached──► EXPIRED
        └──admin rejects──► REJECTED (note / rejectionReason)              (frees a cap slot)
```

`SpotlightStatus` = `REQUESTED | APPROVED | REJECTED | ACTIVE | EXPIRED`.

---

## 2. `SpotlightRequest` entity

A **first-class per-tour entity** (`@@map("spotlight_requests")`), `Tour ──< SpotlightRequest`,
`onDelete: Cascade`. A tour may have many over time; at most one is live.

| Field | Type | W | Notes |
|---|---|---|---|
| `id` | uuid | SYS | PK |
| `tourId` | FK -> tours.id | SYS | per-tour; cascade delete |
| `operatorId` | FK | SYS | requesting operator |
| `destinationId` | FK | SYS | cap is enforced per destination |
| `status` | `SpotlightStatus` | SYS/ADM | default `REQUESTED` |
| `requestedAt` | DateTime | SYS | default now |
| `approvedAt` | DateTime? | ADM | set on approve |
| `approvedBy` | string? | ADM | admin user id |
| `startsAt` / `endsAt` | DateTime? | ADM | the active window |
| `note` | string? | ADM | admin note / context |
| **`requestedStartsAt`** | DateTime? | OP | **+ TO ADD** - operator's preferred start (today only the admin sets the window) |
| **`requestedDurationDays`** | int? | OP | **+ TO ADD** - operator's preferred length (alt: `requestedEndsAt`) |
| **`rejectionReason`** | string? | ADM | **+ TO ADD** - cleaner than overloading `note` (mirrors `Review.rejectionReason`) |
| **`requestedBy`** | string? | OP | **+ TO ADD** - submitting user id (you have `operatorId`, not the user) for audit |

Indexes: `@@index([destinationId, status])` (cap enforcement), `@@index([tourId])`.

---

## 3. Rules the service must enforce

1. **Eligibility gate (at request AND approve).** Reads `tour.aggregateRating`,
   `tour.aggregateReviewCount` (present) and `operator.cancellation_rate_90d` (**operator-module gap,
   master E.6 - to add**). Reject the request if the bar is not met.
2. **Hard cap (at approve).** Count `SpotlightRequest` for the destination where `status IN
   (APPROVED, ACTIVE)` and the window has not ended; **reject approval if already 3**. Do this in a
   transaction to avoid a race past the cap.
3. **Effective commission (at booking creation).** The booking commission snapshot must use the
   **active-spotlight rate**, not the tour's tier column:
   ```
   effectiveCommission = hasActiveSpotlight(tourId, bookingTime) ? 0.35 : tour.commissionTier / 100
   ```
   `hasActiveSpotlight` = EXISTS a `SpotlightRequest` with `status = ACTIVE` and
   `bookingTime BETWEEN startsAt AND endsAt`. The data supports this; the rule lives in the booking
   service (see `BOOKING-AND-PAYMENT-DATA.md` §2.4). Commission still **snapshots and never changes
   retroactively**.
4. **Placement overlay (read/ranking path).** Active-spotlight tours are **excluded from the
   interleaved ranked list** and rendered in the separate labeled block.

---

## 4. Jobs (no schema change)

- **Nightly/clock job:** flip `APPROVED -> ACTIVE` when `now >= startsAt`, and `ACTIVE -> EXPIRED`
  when `now > endsAt` (frees the destination cap slot automatically).

---

## 5. API surface (suggested, base `/api/v1`)

| Method | Route | Who | Purpose |
|---|---|---|---|
| `POST` | `/tours/:id/spotlight` | OP | Request Spotlight (eligibility-gated) -> `REQUESTED` |
| `GET` | `/tours/:id/spotlight` | OP/ADM | Current + historical requests for the tour |
| `GET` | `/admin/spotlight?destinationId=&status=` | ADM | Review queue + active count |
| `PATCH` | `/admin/spotlight/:id/approve` | ADM | Set window, cap check -> `APPROVED` |
| `PATCH` | `/admin/spotlight/:id/reject` | ADM | `REJECTED` + `rejectionReason` |

RBAC: operator request via `EDIT_TRIP` (own tour) or a dedicated permission; approval via
`APPROVE_SPOTLIGHT` (admin). Guard order unchanged.

---

## 6. Related: `ForceMajeurePardon` (eligibility input)

Also in `tiers.prisma`. An admin marks a date range + destination (e.g. a hurricane day); operator
cancellations inside a pardoned range are **excluded from `cancellation_rate_90d` for every operator
at once**. This feeds the Spotlight eligibility bar (rule 1) and the tier eligibility engine. Fields:
`destinationId`, `startDate`, `endDate`, `reason`, `createdBy`. No per-tour data; listed because it
changes whether a tour clears the Spotlight cancellation-rate gate.

---

## 7. Summary - is the data sufficient?

**Yes, for the core flow.** `SpotlightRequest` already models per-tour request -> approval -> active
window -> expiry, with the destination cap enforceable via its index. The missing pieces are:

- **Service logic** (not schema): effective-commission resolution, transactional cap enforcement,
  the activate/expire job, and the eligibility gate.
- **Optional fields** (§2): `requestedStartsAt` / `requestedDurationDays` (operator-chosen window),
  `rejectionReason`, `requestedBy`.
- **One cross-module dependency:** `operator.cancellation_rate_90d` (master E.6) must exist for the
  eligibility bar.
