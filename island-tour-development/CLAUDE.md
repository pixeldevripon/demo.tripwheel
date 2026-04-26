# Island Tours — CLAUDE.md

> Quick reference for Claude Code. Full specs live in the companion docs:
> `PROJECT_SCOPE.md` · `ARCHITECTURE_OVERVIEW.md` · `IMPLEMENTATION_GUIDE.md` · `DEEP_DIVE_QA.md`

---

## What This Project Is

Full-stack tour marketplace. **Operators** list trips and compete for 3 featured slots per category (tiered commissions: 22% / 25% / 30%). **Travelers** browse and book. **Admins** manage the platform. The distinctive feature is the **slot economy**: soft-lock (15 min) → publish (race-condition guarded) → hard-reserve (90 days) → waitlist FIFO.

---

## Monorepo Structure

```
island-tours/
├── backend/          ← NestJS 11 — owns ALL business logic, auth, database
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── app.controller.ts
│   │   ├── app.service.ts
│   │   ├── env.validate.ts        ← required env check — runs before Nest boots
│   │   ├── main.ts
│   │   ├── common/
│   │   │   └── filters/
│   │   │       └── http-exception.filter.ts
│   │   └── prisma/
│   │       ├── prisma.module.ts   ← @Global() — inject PrismaService anywhere
│   │       └── prisma.service.ts  ← extends PrismaClient with PrismaPg adapter
│   ├── prisma/                    ← split schema (one file per domain)
│   │   ├── schema.prisma          ← generator + datasource provider
│   │   ├── enums.prisma
│   │   ├── user.prisma
│   │   ├── operator.prisma
│   │   ├── categories.prisma
│   │   ├── trips.prisma
│   │   ├── featured-slots.prisma
│   │   ├── bookings.prisma
│   │   └── migrations/
│   ├── prisma.config.ts           ← Prisma 7 config — DATABASE_URL + schema path
│   ├── .env                       ← copy from .env.example and fill in
│   └── package.json
│
├── frontend/         ← Next.js 16, App Router — UI only, no auth logic, no DB
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── .env.local    ← copy from .env.local.example and fill in
│   └── package.json
│
├── .claude/
│   └── agents/               ← project-wide Claude Code agents
│       ├── security-code-reviewer.md
│       ├── solid-dry-reviewer.md
│       ├── e2e-test-writer.md
│       └── test-writer.md
├── package.json      ← root: concurrently scripts only, no shared code
├── CLAUDE.md         ← this file
└── .gitignore
```

No `packages/` folder. No `turbo.json`. No pnpm workspaces. Each app manages its own `node_modules`. The root `package.json` only provides convenience scripts.

---

## Running the Project

```bash
# Both apps at once (recommended)
pnpm dev

# Individually
pnpm dev:backend    # NestJS on http://localhost:5050
pnpm dev:frontend   # Next.js on http://localhost:3000

# Build
pnpm build

# Install all deps from scratch
pnpm install:all

# Lint
pnpm lint

# Tests (backend only)
pnpm test:backend
pnpm test:e2e

# Prisma (run from root or backend)
pnpm prisma:generate         # regenerate client after schema changes
pnpm prisma:migrate          # create + apply a migration (dev)
pnpm prisma:migrate:deploy   # apply pending migrations (production)
pnpm prisma:migrate:reset    # reset DB and re-apply all migrations (dev only)
pnpm prisma:studio           # open Prisma Studio GUI
pnpm prisma:format           # format all .prisma files
```

---

## Environment Setup

```bash
# Backend
cp backend/.env.example backend/.env
# Fill in: DATABASE_URL (Postgres connection string)
# BETTER_AUTH_SECRET is pre-generated in .env — change it for production
# Add to CORS_ORIGINS as new clients are added (comma-separated)

# Frontend
cp frontend/.env.local.example frontend/.env.local
# Both values are pre-filled for local dev — no changes needed
```

The frontend `.env.local` has NO secrets — no DATABASE_URL, no auth secrets, no OAuth credentials. Those all live on the backend.

### Backend env variables (current)

| Variable | Required now | Notes |
|---|---|---|
| `PORT` | Yes | Default `5050` |
| `NODE_ENV` | Yes | `development` / `production` |
| `FRONTEND_URL` | Yes | Used as fallback display only |
| `CORS_ORIGINS` | Yes | Comma-separated trusted origins |
| `DATABASE_URL` | Yes | Postgres — fill before Phase 2 |
| `BETTER_AUTH_SECRET` | Yes | Min 32 chars — pre-generated in `.env` |
| `BETTER_AUTH_URL` | Yes | Backend public URL |
| `REDIS_URL` | Phase 5 | BullMQ + pub/sub (TCP ioredis) |
| `EMAIL_*` | Phase 16 | Nodemailer SMTP |
| `CLOUDINARY_*` | Phase 4 | File uploads |
| `ADMIN_SEED_PASSWORD` | Phase 4 | DB seeding |
| `GOOGLE_CLIENT_*` | Phase 3 | OAuth (GitHub TBD — see G11) |

---

## Tech Stack

| Layer | Tool | Notes |
|---|---|---|
| Backend framework | NestJS 11 | Strict TypeScript |
| Frontend framework | Next.js 16 | App Router, Server + Client Components |
| Styling | Tailwind CSS 4 | |
| Database | PostgreSQL | via Prisma ORM (split schema files) |
| Auth | Better Auth | Backend only — see Critical Rules |
| Cache + job queue | Redis + BullMQ | TCP ioredis URL — see Critical Rules |
| Real-time | Server-Sent Events (SSE) | One-way server → client slot updates |
| Client data | TanStack Query v5 | Operator dashboard; SSE integration |
| File uploads | Cloudinary | Trip photos, operator profile images |
| Email | Nodemailer | Pluggable provider |
| Package manager | pnpm | Both apps + root |
| API docs | `@nestjs/swagger` | Swagger UI at `/api/docs` |
| Security headers | `helmet` | HTTP headers — configured in `main.ts` |
| Rate limiting | `@nestjs/throttler` | Global guard; per-route via `@Throttle()` / `@SkipThrottle()` |
| Validation | `class-validator` + `class-transformer` | Global `ValidationPipe` — whitelist + forbidNonWhitelisted |
| Env loading | `dotenv` | `import 'dotenv/config'` — first line of `main.ts` |

---

## Backend Module Map

Modules to build (in order per `IMPLEMENTATION_GUIDE.md`):

```
src/
├── auth/           Phase 3  — Better Auth instance, AuthGuard, RolesGuard, decorators
├── prisma/         Phase 2  — PrismaService (global)
├── upload/         Phase 4  — Cloudinary upload endpoint
├── categories/     Phase 4  — CRUD, auto-seeds 3 FeaturedSlot rows on create
├── operators/      Phase 4  — apply, approve, reject
├── trips/          Phase 4  — CRUD + publish (race condition endpoint)
├── reviews/        Phase 4  — create, list by trip
├── bookings/       Phase 4  — create (auto-creates guest user), confirm, cancel
├── payments/       Phase 4  — Stripe/Mollie/PayPal webhook handlers
├── wishlist/       Phase 4  — add, remove, list
├── slots/          Phase 5  — lockSlot, publishTrip, releaseSlot (CRITICAL)
│   └── slot-events.service.ts — SSE + Redis subscriber (Phase 8)
├── waitlist/       Phase 6  — joinQueue, offerSlot, claimOffer, passOffer
├── workers/        Phase 7  — BullMQ processors: slot-ttl, waitlist-offers, trip-schedules
├── mail/           Phase 16 — MailService, email templates
├── push/           Phase 16 — PushService stub
└── config/
    └── roles.config.ts — ROLE_PERMISSIONS map
```

---

## Frontend Page Map

```
app/
├── (public)/                   Server Components — SSR/SSG for SEO
│   ├── page.tsx                Homepage: featured trips + categories
│   ├── search/page.tsx
│   ├── [category]/page.tsx
│   ├── [category]/[sub]/page.tsx
│   └── trips/[slug]/page.tsx   Trip detail + BookingForm (client)
│
├── (operator)/                 Client Components — TanStack Query
│   └── operator/
│       ├── dashboard/page.tsx
│       ├── trips/page.tsx
│       ├── trips/new/page.tsx  6-step creation wizard
│       ├── trips/[id]/edit/page.tsx
│       ├── featured/page.tsx   Slot status + offer banners
│       ├── bookings/page.tsx
│       ├── payouts/page.tsx
│       └── wishlist/page.tsx
│
├── (admin)/                    Client Components — admin only
│   └── admin/
│       ├── dashboard/page.tsx
│       ├── operators/page.tsx
│       ├── trips/page.tsx
│       └── slots/page.tsx
│
├── login/page.tsx
├── signup/page.tsx             Operator self-registration only
├── become-operator/page.tsx    USER → apply to become OPERATOR
└── layout.tsx                  Root layout — wraps with <Providers>
```

---

## Critical Rules — Never Break These

### 1. Better Auth lives on NestJS only
The frontend never runs `betterAuth()`. It only uses `createAuthClient()` pointing to `NEXT_PUBLIC_BACKEND_URL`. All session logic, OAuth callbacks, and user creation happen on the backend.

### 2. CORS must have `credentials: true`
Without this, the browser strips the `better-auth.session_token` cookie from cross-origin requests. Every session check fails silently.

```typescript
// backend/src/main.ts — origin list comes from CORS_ORIGINS env (comma-separated)
const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

app.enableCors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
});
```

### 3. Better Auth table names stay lowercase
Do not rename these `@@map` values or the Prisma adapter breaks:
- `@@map("user")`
- `@@map("session")`
- `@@map("account")`
- `@@map("verification")`

### 4. Only one Prisma instance
The backend owns all database access. The frontend has no `prisma/` folder and no `DATABASE_URL`. Never add Prisma to the frontend.

### 5. BullMQ must use ioredis with a TCP Redis URL
Use `redis://` or `rediss://` — never the Upstash HTTP REST client. BullMQ uses Redis commands that are not available over HTTP.

### 6. Two separate Redis connections for pub/sub
One connection for `subscribe` mode (`SlotEventsService`), a separate one for `publish` (`SlotsService`). A connection in subscribed mode cannot send other commands.

### 7. FeaturedSlot rows are permanent
Never DELETE FeaturedSlot rows. Only UPDATE: `status`, `tripId`, `acquiredAt`, `expiresAt`. Every category always has exactly 3 rows (created when the category is created, never after).

### 8. Publish race condition — conditional UPDATE only
```typescript
prisma.featuredSlot.updateMany({
  where: { id: slotId, status: 'SOFT_LOCKED' },  // ← the guard
  data: { status: 'HARD_RESERVED', tripId, ... },
})
// If count === 0 → another operator won → throw 409 { code: 'SLOT_TAKEN' }
```
This is the only safe way to prevent two operators from hard-reserving the same slot simultaneously.

### 9. Never let the frontend set user roles
Role changes (`USER → OPERATOR`, `OPERATOR → ADMIN`) must only happen through protected backend endpoints guarded with `@Roles(Role.ADMIN)`. The frontend must never send a `role` field in any request body.

### 10. Store BullMQ job IDs
Store `bullJobId` on `SlotLock` and `offerJobId` on `WaitlistEntry`. You need these to cancel jobs when they're no longer needed (operator publishes before TTL expires, operator claims offer before 24h window closes).

### 11. Webhook endpoints bypass AuthGuard and ThrottlerGuard
Payment provider webhooks (`/webhooks/stripe`, etc.) are server-to-server calls with no session cookie. They must be marked `@Public()` to skip `AuthGuard` and `@SkipThrottle()` to skip the global rate limiter. Verify them with gateway signatures instead of session auth.

### 12. Wishlist model must be added before the first migration
Adding it after `prisma migrate dev --name init` requires a new migration. Define it in `bookings.prisma` before running the first migration.

### 13. Global ValidationPipe strips unknown fields
`ValidationPipe` is registered globally with `whitelist: true` and `forbidNonWhitelisted: true`. Any DTO field not decorated with a `class-validator` decorator is stripped, and sending extra fields returns a 400. Every request body must have a matching DTO class — never use plain `object` or `any` as a body type.

### 14. Rate limiting — ThrottlerGuard is global
Three tiers active on every route: 20 req/s · 300 req/min · 3 000 req/hr. Use `@SkipThrottle()` on health checks and payment webhooks. Use `@Throttle({ short: { limit: 5, ttl: 60_000 } })` to tighten auth-sensitive routes (login, register, forgot-password). ThrottlerModule uses **in-memory storage** until Phase 5 — swap to `@nest-lab/throttler-storage-redis` when Redis is added so limits work across multiple instances.

### 15. Use `@/` path alias for all internal imports
Every internal import must use the `@/` base path alias (e.g., `import { X } from '@/common/...'`). The Prisma client is the exception — import it from the standard `@prisma/client` package:
```typescript
import { PrismaClient } from '@prisma/client';  // ✅ standard, always correct
```
Do not create a custom Prisma output location — it creates unnecessary build complexity (assets copying, tsconfig exclusions, rootDir inference issues).

---

## Slot Economy — Quick Reference

```
Operator picks a slot
    ↓
lockSlot() — Prisma transaction
  • Check FeaturedSlot.status === AVAILABLE (else 409)
  • Create SlotLock { expiresAt: +15min }
  • Update FeaturedSlot.status = SOFT_LOCKED
  • Write SlotHistory
  • Schedule BullMQ 'release-lock' job (delay: 15min)
  • Store bullJobId on SlotLock
  • Publish Redis event: slot.locked
    ↓
Operator completes wizard and publishes
    ↓
publishTrip() — Prisma transaction
  • Conditional updateMany WHERE status='SOFT_LOCKED'
  • If count === 0 → 409 SLOT_TAKEN (race condition — frontend shows modal)
  • If count === 1 → HARD_RESERVED, Trip=LIVE
  • Delete SlotLock
  • Write SlotHistory
  • Cancel 15-min BullMQ job
  • Schedule 90-day cap job
  • Publish Redis event: slot.taken
    ↓
After 90 days (or pause/archive/manual release)
    ↓
releaseSlot() — Prisma transaction
  • FeaturedSlot → AVAILABLE, clear tripId/acquiredAt/expiresAt
  • Write SlotHistory
  • Publish Redis event: slot.released
  • Find first WAITING WaitlistEntry → offerSlot()
    ↓
offerSlot()
  • WaitlistEntry → OFFERED, offeredAt=now, offerExpiresAt=+24h
  • Schedule BullMQ 'expire-offer' job
  • Send email to operator
```

---

## Three User Roles

| Role | Created by | Login | Key capability |
|---|---|---|---|
| USER | Auto-created on first booking (credentials emailed) | Email + password only | Browse, book, review |
| OPERATOR | Self-registration (email verification required) | Email/password or Google OAuth | Create trips, hold featured slots |
| ADMIN | Database seed only (`admin@islandtours.com`) | Email + password only | Full platform management |

Operators inherit all USER capabilities. Admins inherit all USER + OPERATOR capabilities.

---

## Trip Lifecycle

```
DRAFT → LIVE ⇄ PAUSED → ARCHIVED
```

- **DRAFT** — not visible, operator can edit freely, can delete
- **LIVE** — visible to travelers, content edits save immediately, cannot change category while holding a slot
- **PAUSED** — hidden, featured slot auto-released and offered to waitlist
- **ARCHIVED** — permanent, featured slot auto-released

---

## API Conventions

- Base URL: `http://localhost:5050/api/v1`
- Auth endpoints: `http://localhost:5050/api/auth/*` (Better Auth, no `/v1`)
- Swagger docs: `http://localhost:5050/api/docs` (all environments)
- All authenticated routes require the `better-auth.session_token` cookie (set automatically by the browser after login)
- Frontend always fetches with `credentials: 'include'`
- Error shape for slot conflicts: `{ statusCode: 409, code: 'SLOT_TAKEN' }`
- Error shape for expired lock: `{ statusCode: 410 }`

---

## Prisma Schema Layout

Split schema in `backend/prisma/` (one file per domain). Prisma 7 merges all `.prisma` files in the directory automatically — configured via `prisma.config.ts`.

```
prisma/
├── schema.prisma          ← generator + datasource provider (no url — in prisma.config.ts)
├── enums.prisma           ← all enums
├── user.prisma            ← User, Session, Account, Verification (Better Auth tables)
├── operator.prisma        ← OperatorProfile
├── categories.prisma      ← Category, SubCategory
├── trips.prisma           ← Trip, TripSchedule
├── featured-slots.prisma  ← FeaturedSlot, SlotLock, WaitlistEntry, SlotHistory
├── bookings.prisma        ← Booking, Review, Wishlist
└── migrations/            ← auto-generated, do not edit manually
```

`prisma.config.ts` (backend root) — owns the connection URL and schema path:
```typescript
export default defineConfig({
  schema: 'prisma/',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
})
```

Migration commands:
```bash
pnpm prisma:migrate -- --name <name>   # create + apply (dev)
pnpm prisma:migrate:deploy             # apply pending (production)
pnpm prisma:migrate:reset              # reset DB + re-run all migrations (dev only)
pnpm prisma:generate                   # regenerate client after any schema change
```

### Prisma Build Setup

**`prisma generate` runs automatically** — `build`, `start`, `start:dev`, and `start:debug` in `backend/package.json` all prepend `prisma generate &&`. This ensures the client in `node_modules/@prisma/client` always matches the current schema before the app starts.

**`prisma.config.ts` is excluded from TypeScript compilation** — it lives at the backend root (outside `src/`) and uses ESM `export default`. Prisma 7 loads it directly with its own TypeScript runner. Both tsconfigs exclude it to prevent `tsc` from picking it up:
```json
// tsconfig.json + tsconfig.build.json
"exclude": [..., "prisma.config.ts"]
```
If a stale `prisma.config.js` ever appears at the backend root, delete it immediately — it means the file was accidentally compiled by `tsc`.

---

## Gaps Resolved During Implementation

Before starting each phase, check the **Gaps & Missing Pieces** section at the top of `IMPLEMENTATION_GUIDE.md`. Twelve gaps (G1–G12) were identified and must be resolved before their dependent phase begins. The most important ones:

- **G1** — Add `Wishlist` model to schema before first migration
- **G2** — Decide on `PENDING_REVIEW` trip status (remove it or implement admin review flow)
- **G3** — Implement payment webhook handlers in Phase 4
- **G7** — Notifications are a full missing phase (Phase 16)
- **G11** — Decide GitHub OAuth: in scope or remove from `auth.instance.ts`
- **G12** — Decide SSE vs. polling for operator slot offer notifications
