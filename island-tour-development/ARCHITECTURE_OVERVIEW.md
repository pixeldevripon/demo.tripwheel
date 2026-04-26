# Island Tours — Architecture & Concept Guide

> **Purpose:** Understand the system design, business rules, schema reasoning, and technical decisions before implementing.
> Companion to `IMPLEMENTATION_GUIDE.md` (step-by-step code) and `DEEP_DIVE_QA.md` (specific Q&A).

---

## Table of Contents

1. [System in One Breath](#1-system-in-one-breath)
2. [Architecture Overview](#2-architecture-overview)
3. [Real-Time Strategy — SSE](#3-real-time-strategy--sse)
4. [Frontend Data Strategy](#4-frontend-data-strategy)
5. [Authentication & Authorization with Better Auth](#5-authentication--authorization-with-better-auth)
6. [Prisma Schema — Full Structure with Reasoning](#6-prisma-schema--full-structure-with-reasoning)
7. [The Slot Economy — Core Business Logic](#7-the-slot-economy--core-business-logic)
8. [NestJS Backend Module Map](#8-nestjs-backend-module-map)
9. [Next.js Frontend Page Map](#9-nextjs-frontend-page-map)
10. [Edge Cases You Must Handle](#10-edge-cases-you-must-handle)
11. [Background Jobs with BullMQ](#11-background-jobs-with-bullmq)
12. [Key Technical Decisions — Summary Table](#12-key-technical-decisions--summary-table)

---

## 1. System in One Breath

Island Tours is a **marketplace platform** where:

- **Operators** (tour businesses) create and list trips.
- **Travelers** browse, search, and book those trips.
- **Admins** moderate, configure, and manage the whole platform.

The distinctive feature is the **featured slot system**:

- Every trip category (e.g., "Boat & sail · Cyclades") has exactly **3 featured slots**.
- A featured slot gives the operator better visibility — hero carousel, top-of-category pin, sponsored badge — in exchange for a **higher platform commission**.
- Slot 1 = best placement, lowest extra commission (22%).
- Slot 2 = mid placement, 25% commission.
- Slot 3 = lowest featured placement, 30% commission.
- Standard listings always pay 20% and get no placement boost.
- When an operator picks a slot in the creation wizard, it gets **soft-locked for 15 minutes** — a countdown starts.
- If they publish before 15 minutes → slot becomes **hard-reserved** (theirs for up to 90 days).
- If two operators both try to publish on the same slot at the same moment → **first HTTP request wins**. The loser gets a recovery modal.
- If all 3 slots are taken → operators can join a **FIFO waitlist**. When a slot frees, the next in line gets a **24-hour offer window** to claim it.
- Operators can also skip the waitlist queue by paying a fee (max 3 paid skips per queue entry).

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  Next.js 15 (App Router)                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Server Comp. │  │ Client Comp. │  │  Server Actions  │   │
│  │ (SSR/SSG)    │  │ + TanStack Q │  │  (mutations)     │   │
│  └──────────────┘  └──────┬───────┘  └────────┬─────────┘   │
│                           │ SSE (slot updates) │ REST calls  │
└───────────────────────────┼────────────────────┼────────────┘
                            │                    │
┌───────────────────────────┼────────────────────┼────────────┐
│                        BACKEND                               │
│  NestJS                   │                    │             │
│  ┌──────────────┐  ┌──────┴───────┐  ┌─────────┴────────┐   │
│  │  REST API    │  │  SSE Gateway │  │  BullMQ Workers  │   │
│  │  (CRUD, auth)│  │  (slot events│  │  (TTL expiry,    │   │
│  └──────┬───────┘  └──────┬───────┘  │   waitlist jobs) │   │
│         │                 │          └────────┬─────────┘   │
│  ┌──────┴─────────────────┴────────────────────┴──────────┐  │
│  │   Service Layer (slots, trips, bookings, waitlist)      │  │
│  └──────────────────────────┬───────────────────────────--┘  │
│                             │                                 │
│  ┌──────────────┐   ┌───────┴──────────┐                     │
│  │  Prisma ORM  │   │  Redis (Upstash) │                     │
│  │  PostgreSQL  │   │  TTL keys + pub/ │                     │
│  └──────────────┘   │  sub + BullMQ   │                     │
│                     └─────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

**Responsibilities of each layer:**

- **PostgreSQL** — source of truth for everything permanent: users, trips, slot assignments, bookings.
- **Redis** — ephemeral state: TTL countdowns, BullMQ job queues, pub/sub event channels.
- **BullMQ** — all scheduled/background work: expiring slot locks, sending waitlist notifications, releasing 90-day caps.
- **SSE** — real-time slot status pushed to connected operator browsers.
- **Better Auth** — session management (lives on the Next.js side, validated on the NestJS side).

---

## 3. Real-Time Strategy — SSE

### Why SSE, Not WebSockets

When an operator opens the slot picker, they need live updates — did someone just soft-lock slot #2 in the last 3 seconds? Did a TTL expire and free up slot #1?

**WebSockets** create a two-way persistent connection. They are the right tool when both sides need to push messages in real-time — chat, collaborative editing, multiplayer. For Island Tours, the operator never sends real-time messages to the server. All mutations (reserve, publish, join waitlist) are standard HTTP POST calls. The only "live" need is receiving status changes from the server. WebSockets are overkill.

**Server-Sent Events (SSE)** keep an HTTP connection open and the server pushes text events whenever something changes. One-way: server → client. Built into every browser. Auto-reconnects on disconnect. Five lines to set up in NestJS with `@Sse()`.

### How It Flows

```
1. Operator A opens the slot picker
   → browser opens: new EventSource('/api/v1/slots/stream?categoryId=...')
   → NestJS keeps this HTTP connection open indefinitely

2. Operator B (different browser) clicks "Reserve slot #2"
   → POST /api/v1/slots/:slotId/lock
   → SlotsService creates SlotLock in PostgreSQL
   → SlotsService publishes to Redis channel: slot-events:{categoryId}

3. NestJS SSE gateway has a Redis subscriber for that channel
   → receives the Redis message
   → writes it as an SSE event to all open EventSource connections for that category

4. Operator A's browser fires onmessage
   → TanStack Query cache updated: slot #2 = SOFT_LOCKED
   → Slot card re-renders with lock indicator and countdown
```

### Why Redis Pub/Sub Is Needed

If you run multiple NestJS instances (horizontal scaling), a publish event from Instance A needs to reach browsers connected to Instances B and C. Redis pub/sub is the message bus that fans events to all instances. Without it, only browsers connected to the same instance that processed the mutation would see the update.

### SSE Connection Lifecycle

- **Open:** When the SlotPicker component mounts, `useEffect` creates `new EventSource(...)`.
- **Receive:** `source.onmessage` fires, TanStack Query cache is updated, UI re-renders.
- **Reconnect:** If the connection drops, the browser automatically retries (built-in behavior of EventSource).
- **Close:** When the component unmounts (operator navigates away), `source.close()` is called in the `useEffect` cleanup function. The NestJS Observable unsubscribes, the Redis channel subscription is cleaned up.

---

## 4. Frontend Data Strategy

### Three Tools, Three Jobs

| Tool | Where it runs | Used for |
|---|---|---|
| Next.js Server Components + `fetch()` | Server only | Traveler-facing pages (homepage, trip detail, search) — SSR for SEO, no client JS |
| `unstable_cache` / `use cache` | Server only | Deduplicating DB queries during server render; revalidation on a schedule |
| TanStack Query `useQuery` | Browser only | Operator/admin dashboard pages; any client component that needs caching, background refetch, or SSE integration |
| TanStack Query `useMutation` | Browser only | Mutations that need optimistic updates or complex error handling (e.g., publish trip with race condition rollback) |
| Server Actions | Server (called from client) | Simple mutations: join waitlist, save draft, update profile |

### The Pattern for Operator Pages

The best approach for operator dashboard pages combines SSR initial load with TanStack Query client takeover:

```
1. Server Component renders initial data (fast first paint, no loading spinner)
2. Pass data as initialData to TanStack Query
3. TanStack Query takes over: caches it, background-refetches when stale
4. SSE events update the cache in real-time where needed
```

This means the slot picker gets an instant initial view of slot states from SSR, then stays live via SSE without an extra loading state.

### When NOT to Use TanStack Query

- Static traveler pages (homepage, category browse, trip detail): use Next.js Server Components + `fetch()` with `next: { revalidate }`.
- Simple one-off mutations with no optimistic update needs: use Server Actions directly with `useTransition`.

---

## 5. Authentication & Authorization with Better Auth

### How Better Auth Is Split Across the Two Apps

**Frontend (Next.js) — the auth server:**

- `lib/auth.ts` creates the `betterAuth()` instance with the Prisma adapter.
- `app/api/auth/[...all]/route.ts` exposes all auth endpoints via `toNextJsHandler(auth)`.
- All sign-in, sign-up, OAuth, session management, and email verification happen here.
- After login, Better Auth sets a cookie: `better-auth.session_token=<token>`.

**Backend (NestJS) — the session validator:**

- `auth.service.ts` creates a second `betterAuth()` instance using the same `BETTER_AUTH_SECRET`.
- It never handles login or registration. It only calls `auth.api.getSession({ headers })`.
- `AuthGuard` reads the session token from the cookie (or Bearer header), calls `getSession()`, and attaches `{ user, session }` to `request`.

Both apps **must share the same `BETTER_AUTH_SECRET`**. The backend uses it to query the same session records that the frontend created.

### Required Prisma Schema for Better Auth

Better Auth's Prisma adapter expects these exact model names and table names. Do not rename them:

```prisma
model User        { ... @@map("user") }
model Session     { ... @@map("session") }
model Account     { ... @@map("account") }
model Verification { ... @@map("verification") }
```

Critical field requirements on `User`:
- `emailVerified Boolean` — must be Boolean, not DateTime (NextAuth uses DateTime; Better Auth uses Boolean).
- `image String?` — must be a URL string, not JSON.
- `id String @id @default(uuid())` — Better Auth works with both uuid and cuid.

You can add custom fields to `User` (like `role`, `status`, `operatorProfile`) without breaking Better Auth as long as you do not remove or rename the required fields.

### Three Roles for Island Tours

| Role | Who | What they can do |
|---|---|---|
| `USER` | Travelers | Browse, search, book trips, write reviews |
| `OPERATOR` | Tour businesses | Create/manage trips, manage featured slots, view own bookings and payouts |
| `ADMIN` / `SUPER_ADMIN` | Platform staff | Moderate everything, configure slots, manage operators, view analytics |

Role changes are controlled exclusively by the backend with `@Roles(Role.ADMIN)` protection. The frontend never directly sets a user's role.

### How Guards Work Together in NestJS

```typescript
// Just authentication — any logged-in user
@UseGuards(AuthGuard)
@Get('profile')
getProfile() {}

// Authentication + role check
@Roles(Role.OPERATOR, Role.ADMIN)
@UseGuards(AuthGuard, RolesGuard)
@Post('trips')
createTrip(@AuthenticatedUser() user) {}

// Admin only
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@UseGuards(AuthGuard, RolesGuard)
@Patch('operators/:id/approve')
approveOperator() {}
```

---

## 6. Prisma Schema — Full Structure with Reasoning

### Why a Split Schema (Multiple `.prisma` Files)

Your project already uses split schemas in `prisma/schema/`. This is Prisma's multi-file schema feature. Each domain gets its own file. It keeps things organized as the schema grows.

### File-by-File Reasoning

**`base.prisma`** — generator and datasource. Never changes.

**`enums.prisma`** — all enums for the project. Keep them together so you can see all possible values at a glance without navigating multiple files.

**`user.prisma`** — the Better Auth core tables (`User`, `Session`, `Account`, `Verification`) plus the custom fields Island Tours needs (`role`, `status`, `operatorProfile` relation). The table names `@@map("user")` etc. are fixed by Better Auth.

**`operator.prisma`** — `OperatorProfile` is separate from `User` because not every user is an operator. An operator profile is created when a user applies to become an operator and is approved by admin.

**`categories.prisma`** — `Category` and `SubCategory`. Simple lookup tables. Important: every time a category is created, 3 `FeaturedSlot` rows must be created immediately (seeded). This is enforced in `CategoriesService.create()`.

**`trips.prisma`** — `Trip` and `TripSchedule`. A trip has many schedules (different dates/times). The `status` enum drives visibility: only `LIVE` trips show to travelers.

**`featured-slots.prisma`** — the four models that implement the slot economy:

- `FeaturedSlot` — permanent rows (3 per category). Only UPDATE, never INSERT/DELETE in normal operation.
- `SlotLock` — temporary (max 15 min TTL). Created on slot pick, deleted on publish or TTL expiry.
- `WaitlistEntry` — one per operator per slot. FIFO by `createdAt`. Status drives the offer lifecycle.
- `SlotHistory` — audit log. Every state change writes a row here. Required for the 7-day turnover heatmap in the slot picker UI.

**`bookings.prisma`** — `Booking` and `Review`. Commission is stored on the booking at creation time (not recalculated later), so even if slot rates change, historical earnings are preserved.

### Key Schema Design Decisions

**Why `WaitlistEntry` does not store `position` as a number:**
Position is always derived at query time (`COUNT(entries WHERE createdAt < this.createdAt AND status IN (WAITING, OFFERED))`). Storing it as a number would require updating every row in the queue whenever someone joins or leaves — an expensive operation prone to race conditions.

**Why `SlotLock` has a `bullJobId` field:**
When an operator publishes before TTL, we need to cancel the BullMQ TTL-expiry job. Without the job ID, we cannot find it to cancel. Same logic applies to `WaitlistEntry.offerJobId`.

**Why `FeaturedSlot.tripId` is `@unique`:**
A trip can only hold one featured slot, and a slot can only be held by one trip. The `@unique` constraint on `tripId` enforces both halves of this at the database level.

**Why commissions are stored on `Booking`, not calculated at read time:**
Commission rates can change (e.g., admin adjusts rates, or an operator moves from slot #2 to slot #3). Historical bookings must always show the rate that was in effect when the booking was made.

---

## 7. The Slot Economy — Core Business Logic

### Flow 1: Soft-Lock (Operator Picks a Slot)

```
Trigger: POST /api/v1/slots/:slotId/lock

1. Start Prisma transaction
2. Check FeaturedSlot.status === AVAILABLE → else throw 409
3. Check no SlotLock exists for this featuredSlotId (unique constraint also enforces this)
4. Create SlotLock { expiresAt: now() + 15min }
5. Update FeaturedSlot.status = SOFT_LOCKED
6. Write SlotHistory row
7. Commit transaction

After commit:
8. Schedule BullMQ delayed job: release-lock (delay: 15min)
9. Store BullMQ job ID in SlotLock.bullJobId
10. Publish Redis event to slot-events:{categoryId}: { type: 'slot.locked', rank, expiresAt }
11. Return SlotLock (with expiresAt) to frontend → frontend starts countdown display
```

### Flow 2: Hard-Reserve (Operator Publishes)

```
Trigger: POST /api/v1/trips/:tripId/publish

1. Find SlotLock for this tripId
   → Not found? Throw 410 Gone ("Lock expired, start over")
   → expiresAt <= now? Throw 410 Gone

2. Start Prisma transaction
3. Conditional UPDATE — this is the race condition guard:
   UPDATE featured_slots
   SET status = 'HARD_RESERVED', trip_id = :tripId,
       acquired_at = now(), expires_at = now() + 90days
   WHERE id = :slotId AND status = 'SOFT_LOCKED'

   → If 0 rows updated: another operator's publish arrived first → throw 409
     { code: 'SLOT_TAKEN' } → frontend shows race condition modal
   → If 1 row updated: we won

4. Set Trip.status = LIVE, publishedAt = now()
5. Delete SlotLock
6. Write SlotHistory row
7. Commit transaction

After commit:
8. Cancel BullMQ TTL job using SlotLock.bullJobId
9. Schedule BullMQ job: expire-cap (delay: 90 days)
10. Publish Redis event: { type: 'slot.taken', rank }
```

### Flow 3: TTL Expiry (Background Worker)

```
Trigger: BullMQ job 'release-lock' fires 15 minutes after soft-lock

1. Look up SlotLock by ID
   → Not found? Operator published before TTL. Job is stale. Do nothing.
2. Start transaction
3. Delete SlotLock
4. Update FeaturedSlot.status = AVAILABLE, tripId = null
5. Write SlotHistory row (reason: 'ttl_expired')
6. Commit

After commit:
7. Publish Redis event: { type: 'slot.released', rank }
8. Check for WAITING WaitlistEntry for this slot
9. If found (FIFO — first by createdAt): offer it → Flow 4
```

### Flow 4: Waitlist Offer

```
Trigger: Slot becomes available (TTL expiry, operator releases, 90-day cap)

1. Find first WaitlistEntry WHERE featuredSlotId = :id AND status = 'WAITING'
   ORDER BY createdAt ASC LIMIT 1
2. Update: status = 'OFFERED', offeredAt = now(), offerExpiresAt = now() + 24h
3. Schedule BullMQ job: expire-offer (delay: 24h)
4. Store job ID in WaitlistEntry.offerJobId
5. Send email + push notification to the operator
6. Publish Redis event to slot-offer:{operatorId}: { type: 'offer.received' }
```

### Flow 5: Offer Claimed

```
Trigger: POST /api/v1/waitlist/:id/claim

1. Validate: status === 'OFFERED' AND offerExpiresAt > now()
2. Check FeaturedSlot is still AVAILABLE (someone else may have grabbed it)
   → If taken: expire this offer, offer to next in queue
3. In transaction:
   - Update WaitlistEntry.status = 'CLAIMED', claimedAt = now()
   - Call lockSlot() → creates a new SlotLock for this operator
4. Cancel BullMQ offer-expiry job
5. Return SlotLock data → redirect operator to the creation wizard with slot pre-selected
```

### Flow 6: 90-Day Cap Expiry

```
Trigger: BullMQ job 'expire-cap' fires 90 days after hard-reserve

1. Release the slot (same as Flow 3, step 3–7)
2. Notify the operator: "Your featured slot has expired. Re-queue to continue."
3. Offer to the waitlist if entries exist
```

### The Race Condition in Detail

The race condition happens when two operators are both in the wizard, both have a soft-lock on the same slot (which should not happen due to the unique constraint — only one soft-lock per slot). Actually the race condition is subtler: two operators could both have a soft-lock on **different** slots, but what if one operator publishes a trip that was assigned slot #2, and simultaneously another operator's BullMQ TTL job fires for slot #2? In that case:

The conditional UPDATE `WHERE status = 'SOFT_LOCKED'` handles it atomically. PostgreSQL processes one UPDATE at a time. Whoever gets to the row first sets it to `HARD_RESERVED`. The second UPDATE finds `status != 'SOFT_LOCKED'` and updates 0 rows.

This is why you do **not** need a Redis distributed lock for this. The database itself is the arbiter.

---

## 8. NestJS Backend Module Map

```
src/
├── auth/                         # Better Auth session validation
│   ├── auth.module.ts            # @Global() — available everywhere
│   ├── auth.service.ts           # betterAuth() instance for getSession()
│   └── guards/
│       ├── auth.guard.ts         # validates session token
│       ├── roles.guard.ts        # checks user.role
│       └── permissions.guard.ts  # checks permission array
│
├── slots/                        # The slot economy — most critical
│   ├── slots.module.ts
│   ├── slots.controller.ts       # lock, release, stream (SSE)
│   ├── slots.service.ts          # lockSlot, publishTrip, releaseSlot
│   └── slot-events.service.ts    # Redis pub/sub → RxJS Observable for SSE
│
├── waitlist/
│   ├── waitlist.module.ts
│   ├── waitlist.controller.ts    # join, claim, pass, leave
│   └── waitlist.service.ts       # offerSlot, claimOffer, passOffer
│
├── trips/
│   ├── trips.module.ts
│   ├── trips.controller.ts       # CRUD + publish endpoint
│   └── trips.service.ts
│
├── categories/
│   ├── categories.module.ts
│   ├── categories.controller.ts
│   └── categories.service.ts     # create() also seeds 3 FeaturedSlot rows
│
├── operators/
│   ├── operators.module.ts
│   ├── operators.controller.ts   # apply, approve, reject, getMySlots
│   └── operators.service.ts
│
├── bookings/
│   ├── bookings.module.ts
│   ├── bookings.controller.ts
│   └── bookings.service.ts
│
├── workers/                      # BullMQ processors
│   ├── workers.module.ts
│   ├── slot-lock-expiry.processor.ts   # fires 15min after lock creation
│   └── waitlist-offer.processor.ts     # fires 24h after offer is made
│
└── admin/
    ├── admin.module.ts
    ├── admin.controller.ts
    └── admin.service.ts
```

### Controller Route Map

```
GET    /api/v1/slots/category/:categoryId     Public — slot states for slot picker
POST   /api/v1/slots/:slotId/lock             OPERATOR — soft-lock
DELETE /api/v1/slots/:slotId/lock             OPERATOR — manually release lock
GET    /api/v1/slots/stream?categoryId=       Public — SSE stream (EventSource)

POST   /api/v1/waitlist/join                  OPERATOR — join queue
POST   /api/v1/waitlist/:id/claim             OPERATOR — accept offer
POST   /api/v1/waitlist/:id/pass              OPERATOR — decline offer (keep position)
DELETE /api/v1/waitlist/:id                   OPERATOR — leave queue entirely
GET    /api/v1/waitlist/my-entries            OPERATOR — my queue positions

GET    /api/v1/trips                          Public — live trips with filters
GET    /api/v1/trips/:slug                    Public — trip detail
POST   /api/v1/trips                          OPERATOR — create draft
PATCH  /api/v1/trips/:id                      OPERATOR — update
POST   /api/v1/trips/:id/publish              OPERATOR — publish (race condition endpoint)
POST   /api/v1/trips/:id/pause                OPERATOR — pause live trip
DELETE /api/v1/trips/:id                      OPERATOR — archive

POST   /api/v1/operators/apply                USER — apply to become operator
GET    /api/v1/operators/me                   OPERATOR — my profile
GET    /api/v1/operators/me/slots             OPERATOR — slots dashboard data
PATCH  /api/v1/operators/:id/approve          ADMIN — verify operator
PATCH  /api/v1/operators/:id/reject           ADMIN

GET    /api/v1/categories                     Public
POST   /api/v1/categories                     ADMIN
PATCH  /api/v1/categories/:id                 ADMIN
```

---

## 9. Next.js Frontend Page Map

```
app/
├── (public)/                             Server Components — SSR, SEO-optimized
│   ├── page.tsx                          Homepage: hero carousel + category grids
│   ├── search/page.tsx                   Search results with featured boost label
│   ├── [category]/[sub]/page.tsx         Category browse page
│   └── trips/[slug]/page.tsx             Trip detail + booking form (form is client)
│
├── (operator)/                           Client Components — TanStack Query
│   └── operator/
│       ├── layout.tsx                    Session check → redirect if not OPERATOR
│       ├── dashboard/page.tsx            Overview stats
│       ├── trips/
│       │   ├── page.tsx                  Trips list (useQuery + refetch)
│       │   ├── new/page.tsx              6-step wizard (useReducer state)
│       │   └── [id]/edit/page.tsx
│       ├── featured/page.tsx             Slots dashboard (active + waitlist + categories)
│       ├── bookings/page.tsx
│       └── payouts/page.tsx
│
├── (admin)/                              Admin panel — TanStack Query
│   └── admin/
│       ├── layout.tsx                    Session check → redirect if not ADMIN
│       ├── dashboard/page.tsx
│       ├── operators/page.tsx            Approve/reject operators
│       ├── trips/page.tsx
│       └── slots/page.tsx
│
├── login/page.tsx                        Uses existing LoginForm component
├── signup/page.tsx                       Uses existing SignupForm component
├── become-operator/page.tsx              Operator application form
└── api/auth/[...all]/route.ts            Better Auth — do not modify
```

### Data Fetching by Page Type

**Traveler pages (Server Components):**

```typescript
// fetch() with revalidation — no client library needed
const trips = await fetch(
  `${process.env.BACKEND_API_URL}/trips?featured=true`,
  { next: { revalidate: 60 } }  // re-fetch at most every 60 seconds
).then(r => r.json());
```

**Operator pages (Client Components):**

```typescript
// TanStack Query — caching + background refetch + loading/error states
const { data } = useQuery({
  queryKey: ['operator-trips'],
  queryFn: () => apiClient('/trips/my-trips'),
  staleTime: 30_000,
});
```

**Slot picker (Client Component with SSE):**

```typescript
// 1. Initial data from useQuery
const { data } = useQuery({ queryKey: ['slots', categoryId], ... });

// 2. SSE updates merge into the same cache
useSlotStream(categoryId); // custom hook — opens EventSource, calls setQueryData on events

// 3. UI reads from cache — automatically re-renders on any update
```

---

## 10. Edge Cases You Must Handle

The wireframes define 6 edge cases that the system must handle gracefully:

### EC-01: All Slots Taken

**What happens:** All 3 `FeaturedSlot` rows have `status = HARD_RESERVED`.

**Backend:** `GET /api/v1/slots/category/:id` returns all three as taken. Also returns estimated ETAs per slot (calculated from waitlist queue depth and average historical hold duration via `SlotHistory`).

**Frontend:** Instead of the slot picker, render the `AllSlotsTakenView` — shows all 3 slot cards as taken, estimated wait time for each, and a "Join queue" button per slot.

### EC-02: Race Condition on Submit

**What happens:** Two operators both have valid soft-locks, but only one can hard-reserve. The conditional UPDATE returns 0 rows for the loser.

**Backend:** `POST /trips/:id/publish` returns `{ statusCode: 409, code: 'SLOT_TAKEN' }`.

**Frontend:** The `useMutation` `onError` handler detects `error.code === 'SLOT_TAKEN'`, rolls back the optimistic update, and shows `RaceConditionModal` overlaid on the wizard. The operator can pick again, publish as standard, or join the waitlist.

### EC-03: Editing a Live Trip

**What happens:** Operator edits a trip that is currently `LIVE` and holds a featured slot.

**Backend:** `PATCH /trips/:id` allows content updates (title, description, photos, pricing) on live trips. Changing `categoryId` is blocked if the trip holds a slot — that requires releasing the slot first.

**Frontend:** Show a warning banner on the edit page: "Changes save immediately to the live listing."

### EC-04: TTL Expired Mid-Wizard

**What happens:** Operator is on the review step, the 15-minute countdown hits zero.

**Detection paths:**

1. SSE event `slot.released` arrives for the slot the operator holds → component detects it is their lock → shows expiry warning.
2. Operator clicks "Publish →" and server returns `410 Gone`.

**Frontend response:** Clear `selectedSlot` state, disable the publish button, show a toast/banner, return operator to the slot picker step.

### EC-05: Pre-Book Window (24h Before Departure)

**What happens:** 24 hours before a scheduled trip date, the system activates a special window.

**Backend:** A BullMQ job is scheduled when a `TripSchedule` is created, set to fire at `(schedule.date - 24h)`. The worker can trigger price updates, "last-minute" badges, or block new bookings.

### EC-06: Removed / Paused Trip

**What happens:** Operator pauses or archives a trip that holds a featured slot.

**Backend:** `TripsService.pause()` and `TripsService.archive()` both call `SlotsService.releaseSlot(featuredSlotId, 'operator_released')`. This automatically triggers the waitlist offer flow for the next person in queue.

---

## 11. Background Jobs with BullMQ

All time-sensitive operations run as delayed BullMQ jobs. Jobs survive server restarts (stored in Redis). Jobs are cancellable (store the job ID in the database row).

### Queue: `slot-ttl`

| Job name | Scheduled when | Delay | What it does |
|---|---|---|---|
| `release-lock` | SlotLock created | 15 minutes | Expires lock, sets slot to AVAILABLE, offers to waitlist |
| `expire-cap` | FeaturedSlot hard-reserved | 90 days | Releases slot, notifies operator, offers to waitlist |

**Cancellation:** When operator publishes before TTL → `queue.getJob(bullJobId).then(job => job?.remove())`.

### Queue: `waitlist-offers`

| Job name | Scheduled when | Delay | What it does |
|---|---|---|---|
| `expire-offer` | WaitlistEntry offered | 24 hours | Marks offer expired, offers to next in queue |

**Cancellation:** When operator claims offer → cancel job using `offerJobId`.

### Queue: `notifications`

| Job name | Scheduled when | Delay | What it does |
|---|---|---|---|
| `send-email` | Various events | 0 (immediate) | Send via Nodemailer |
| `pre-book-activate` | TripSchedule created | `date - 24h - now` | Activates 24h pre-booking window |

### Critical: Two Separate Redis Connections

BullMQ needs one Redis connection for its queue operations. The SSE pub/sub needs two — one for `subscribe` mode and one for `publish`. A Redis connection in `subscribe` mode cannot send other commands.

```
Redis Connection 1: BullMQ queue (ioredis managed by @nestjs/bullmq)
Redis Connection 2: SlotEventsService publisher (ioredis, SlotsService injects)
Redis Connection 3: SlotEventsService subscriber (ioredis, listens to pub/sub channels)
```

---

## 12. Key Technical Decisions — Summary Table

| Decision | Choice | Reasoning |
|---|---|---|
| Real-time slot updates | Server-Sent Events (SSE) | Server→client only push. Simpler than WebSockets. Works with Redis pub/sub for horizontal scale. Auto-reconnect built in. |
| Client data fetching | TanStack Query v5 | Cache + background refetch + SSE integration via `setQueryData` + `useMutation` for optimistic updates. |
| Server mutations | Server Actions or TanStack `useMutation` | Server Actions for simple forms; `useMutation` when optimistic updates or complex error handling needed. |
| Traveler pages | Next.js Server Components + `fetch()` | SSR for SEO. No client library overhead. `unstable_cache` for DB deduplication. |
| Auth | Better Auth (frontend-hosted) | Handles sessions, OAuth, email verification. NestJS validates sessions via shared secret. |
| Authorization | `AuthGuard` + `RolesGuard` + `@Roles()` | Already built in the codebase. Three-role system: USER (traveler), OPERATOR, ADMIN. |
| Race condition prevention | PostgreSQL conditional UPDATE | `WHERE status = 'SOFT_LOCKED'` — atomic, no Redis lock needed. 0 rows updated = loser. |
| TTL enforcement | BullMQ delayed job | Survives server restart. Cancellable. Reliable 15-min expiry. |
| Slot event broadcast | Redis pub/sub | Already in stack (Upstash). Fanout works across multiple NestJS instances. |
| Schema organization | Split Prisma files (existing pattern) | One file per domain. Already configured in the project. |
| 90-day slot cap | BullMQ delayed job | Scheduled at hard-reserve time. Cancel if operator voluntarily releases. |
| Waitlist ordering | FIFO by `createdAt` (derived at query time) | Never store `position` as a number — race conditions and expensive updates on every queue change. |
| Commission storage | Stored on `Booking` at creation time | Rates can change. Historical bookings must reflect the rate at booking time. |
| FeaturedSlot lifecycle | Permanent rows, only UPDATE status | Create 3 rows per category on seed. Never INSERT/DELETE in normal operation. |
