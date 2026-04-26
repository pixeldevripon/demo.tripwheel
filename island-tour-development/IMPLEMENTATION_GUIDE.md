# Island Tours — Step-by-Step Implementation Guide

> **Stack:** Next.js 15 · NestJS · Better Auth · PostgreSQL · Prisma · BullMQ · Redis · TanStack Query

---

## Table of Contents

- [Phase 0 — Understand the Project Structure](#phase-0--understand-the-project-structure)
- [Phase 1 — Environment Setup](#phase-1--environment-setup)
- [Phase 2 — Prisma Schema (All Models)](#phase-2--prisma-schema-all-models)
- [Phase 3 — Authentication & Authorization](#phase-3--authentication--authorization)
- [Phase 4 — Backend: Core Modules](#phase-4--backend-core-modules)
- [Phase 5 — Backend: Slot Economy (Soft-Lock, Race Condition, Publish)](#phase-5--backend-slot-economy)
- [Phase 6 — Backend: Waitlist System](#phase-6--backend-waitlist-system)
- [Phase 7 — Backend: BullMQ Background Jobs](#phase-7--backend-bullmq-background-jobs)
- [Phase 8 — Backend: Real-Time SSE Gateway](#phase-8--backend-real-time-sse-gateway)
- [Phase 9 — Frontend: Project Structure & TanStack Query Setup](#phase-9--frontend-project-structure--tanstack-query-setup)
- [Phase 10 — Frontend: Auth Integration](#phase-10--frontend-auth-integration)
- [Phase 11 — Frontend: Traveler Pages (Server Components)](#phase-11--frontend-traveler-pages-server-components)
- [Phase 12 — Frontend: Operator Dashboard (Client Components)](#phase-12--frontend-operator-dashboard-client-components)
- [Phase 13 — Frontend: Slot Picker (Real-Time Client Component)](#phase-13--frontend-slot-picker-real-time-client-component)
- [Phase 14 — Frontend: Trip Creation Wizard](#phase-14--frontend-trip-creation-wizard)
- [Phase 15 — Edge Cases Implementation](#phase-15--edge-cases-implementation)
- [Gaps & Missing Pieces](#gaps--missing-pieces)
- [Phase 16 — Notifications](#phase-16--notifications)
- [Phase 17 — Admin Panel Frontend](#phase-17--admin-panel-frontend)
- [Phase 18 — Wishlist](#phase-18--wishlist)

---

## Gaps & Missing Pieces

> These items appear in `PROJECT_SCOPE.md` or the architecture but are **absent from this implementation guide**. Resolve each gap before starting the phase that depends on it.

| ID | Gap | Affects Phase | Action Required |
|---|---|---|---|
| G1 | **No `Wishlist` model** in any schema file — PROJECT_SCOPE mentions it but no Prisma model exists | Phase 2 | Add `Wishlist` model to `bookings.prisma` before migration |
| G2 | **`PENDING_REVIEW` is in `TripStatus` enum** but the lifecycle shows `DRAFT → LIVE` directly — no admin review flow is designed | Phase 4 | Decide: add admin-approve-trip endpoint or remove `PENDING_REVIEW` from the enum |
| G3 | **Payment webhooks not designed** — Stripe/Mollie/PayPal webhook handler endpoints are entirely missing | Phase 4 | Create `payments.controller.ts` with webhook endpoints and signature verification |
| G4 | **No Cloudinary upload endpoint** — upload service is said to "already exist" but no controller route is specified | Phase 4 | Create `upload.controller.ts` with `POST /api/v1/upload` |
| G5 | **Review system has schema but no service/controller spec** | Phase 4 | Write `reviews.service.ts` and `reviews.controller.ts` from scratch |
| G6 | **`skipPaid` fee payment flow not designed** — `WaitlistEntry` has the fields and business rule (max 3 paid skips) but no payment implementation | Phase 6 | Stub the method; gate behind a future payment feature flag |
| G7 | **Notification system entirely absent from this guide** — fully specified in PROJECT_SCOPE but zero implementation steps here | After Phase 15 | Implement as Phase 16 |
| G8 | **No admin seed script** — docs say admin is "seeded only" but no `prisma/seed.ts` spec exists | Phase 2 | Write seed script with admin user + starter categories |
| G9 | **`become-operator` page flow** — referenced in route structure but never implemented in any phase | Phase 10 | Implement in Phase 10 |
| G10 | **No search/filter query implementation** — `findLive(filters)` is mentioned but the Prisma `where` clauses are not specified | Phase 4 | Define filter parameters in `TripsService.findLive()` |
| G11 | **GitHub OAuth in auth instance but NOT in PROJECT_SCOPE** — scope table lists Google only for operators | Phase 3 | Decide: include GitHub or remove it from `auth.instance.ts` |
| G12 | **SSE vs. polling for operator offer notifications** — docs mention both 60s polling and a Redis `slot-offer:{operatorId}` channel inconsistently | Phase 8 | Pick one approach: extend SSE to per-operator channel, or use polling |

---

## Phase 0 — Understand the Project Structure

### Monorepo Layout (No Turborepo)

This project is a monorepo without Turborepo. The two apps (`backend` and `frontend`) live together in one repository but are fully independent — each has its own `package.json`, its own dev server, its own environment variables, and its own Prisma setup. They share nothing at the code level. The monorepo is for convenience (one `git` repo, one place to open in your editor), not for build orchestration.

```
island-tours/
├── backend/                  ← NestJS app (owns Better Auth, all business logic)
│   ├── src/
│   ├── prisma/
│   │   └── schema/           ← Split schema files (one per domain)
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
│
├── frontend/                 ← Next.js 15 app (UI only — no auth logic)
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.local
│
├── .gitignore
└── README.md
```

There is no shared `packages/` folder, no `turbo.json`, no `pnpm-workspace.yaml`. Each app manages its own dependencies. You run them independently:

```bash
# Terminal 1
cd backend && pnpm dev

# Terminal 2
cd frontend && pnpm dev
```

---

### How Better Auth Works in This Setup

**Better Auth lives entirely on the NestJS backend.** The frontend has zero auth logic — it only calls the backend to get the current session.

This is the most important architectural decision to understand before writing any code.

```
BACKEND (NestJS)                             FRONTEND (Next.js)
────────────────                             ──────────────────
src/auth/auth.module.ts                      lib/auth-client.ts
  betterAuth() instance                        createAuthClient()
  → handles ALL registration                   → signIn.email()
  → handles ALL login                          → signUp.email()
  → handles OAuth callbacks                    → signOut()
  → manages sessions in DB                     → useSession() hook
  → email verification                         → only talks to backend
  → password reset

src/auth/auth.controller.ts
  toNodeHandler(auth)
  → mounts all Better Auth HTTP routes:
    POST /api/auth/sign-in/email
    POST /api/auth/sign-up/email
    POST /api/auth/sign-out
    GET  /api/auth/session
    GET  /api/auth/callback/google
    ... (all other Better Auth routes)

src/auth/auth.guard.ts
  → reads cookie: better-auth.session_token
  → OR reads: Authorization: Bearer <token>
  → calls auth.api.getSession({ headers })
  → attaches user to request.user
```

### The Session Token Flow

```
1. User submits login form on frontend
2. Frontend calls POST http://localhost:5000/api/auth/sign-in/email  (NestJS)
3. Better Auth validates credentials, creates a Session row in PostgreSQL
4. Better Auth sets cookie: better-auth.session_token=<token>  (domain: localhost)
5. Cookie is now sent automatically on every subsequent request to NestJS
6. When frontend calls any NestJS API endpoint:
   → NestJS AuthGuard reads the cookie
   → AuthGuard calls auth.api.getSession({ headers })
   → Better Auth looks up the session token in DB
   → If valid → returns { user, session } → attached to request.user
   → Route handler proceeds
7. When a Next.js Server Component needs the current user:
   → It calls GET http://localhost:5000/api/auth/session  (NestJS)
   → Returns { user, session } or null
   → Server Component uses this to gate access or personalize the page
```

**Why this is cleaner than splitting Better Auth across two apps:**
- One `BETTER_AUTH_SECRET`, one database connection for auth, one place auth logic lives.
- The frontend is a pure UI layer — it fetches data and renders it.
- No shared secrets between two `.env` files to keep in sync.
- The frontend does not need its own Prisma instance.

### What Already Exists in the Backend Codebase

These are already implemented in the `Next-Nest-Better-Auth` base — adapted here for the backend-only Better Auth pattern:

- Better Auth instance with email/password, Google OAuth, GitHub OAuth
- `AuthGuard` — validates sessions via cookie or Bearer token
- `RolesGuard` — checks `user.role` enum
- `PermissionsGuard` — checks permission arrays
- `@Roles()` decorator
- `@RequirePermissions()` decorator
- `@AuthenticatedUser` param decorator
- `PrismaService`
- Cloudinary upload service
- Mail service (Nodemailer — provider TBD)
- Swagger docs setup

---

## Phase 1 — Environment Setup

### Step 1.1 — Backend Environment Variables

Create `backend/.env`:

```bash
SERVER_PORT=5000
NODE_ENV=development

# PostgreSQL — single database for the whole project
DATABASE_URL="postgresql://user:password@localhost:5432/island_tours"

# Better Auth — lives entirely on the backend
BETTER_AUTH_SECRET="your-secret-min-32-chars-keep-this-safe"
BETTER_AUTH_URL="http://localhost:5000"   # backend's own base URL

# OAuth providers — registered in Better Auth on the backend
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# Redis — use local Docker for dev, Upstash TCP URL for production
REDIS_URL="redis://localhost:6379"
# OR for Upstash (TCP, not HTTP REST):
# REDIS_URL="rediss://default:password@your-endpoint.upstash.io:6380"

# Mail (provider TBD — Nodemailer-compatible)
EMAIL_USER="your@email.com"
EMAIL_PASS="your-app-password"

# Cloudinary
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-key"
CLOUDINARY_API_SECRET="your-secret"

# Frontend URL (for CORS and redirect callbacks after OAuth)
FRONTEND_URL="http://localhost:3000"
```

### Step 1.2 — Frontend Environment Variables

Create `frontend/.env.local`:

```bash
# NestJS backend URL — all API calls go here, including auth
NEXT_PUBLIC_BACKEND_URL="http://localhost:5000"

# Used in Server Components for direct server-to-server fetch (no browser involved)
BACKEND_API_URL="http://localhost:5000/api/v1"
```

**Notice what is NOT in the frontend `.env`:** No `BETTER_AUTH_SECRET`, no `DATABASE_URL`, no OAuth credentials. The frontend knows nothing about auth internals.

### Step 1.3 — Start Local Redis (Development Only)

```bash
docker run -d -p 6379:6379 --name island-tours-redis redis:alpine
```

### Step 1.4 — Install Backend Packages

```bash
cd backend
pnpm add better-auth @nestjs/bullmq bullmq ioredis
```

### Step 1.5 — Install Frontend Packages

```bash
cd frontend
pnpm add @tanstack/react-query @tanstack/react-query-devtools better-auth
```

The frontend installs `better-auth` only to use `createAuthClient()` — the lightweight client SDK that calls the backend auth endpoints. It does not use the server-side `betterAuth()` function.

---

## Phase 2 — Prisma Schema (All Models)

The backend is the **only** place Prisma runs. There is no `frontend/prisma/`. The `frontend` has no database connection.

The backend uses a **split schema** in `backend/prisma/schema/`. Each domain gets its own `.prisma` file. The `schema.prisma` entry file glues them together.

### Step 2.0 — `backend/prisma/schema.prisma` (Entry File)

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["prismaSchemaFolder"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

With `prismaSchemaFolder`, Prisma reads all `*.prisma` files in the `schema/` folder automatically. Run migrations with:

```bash
cd backend
pnpm prisma migrate dev --name <migration-name> --schema=./prisma/schema.prisma
```

### Step 2.1 — `backend/prisma/schema/enums.prisma`

```prisma
enum Role {
  ADMIN
  OPERATOR
  USER
}

enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
  DELETED
}

enum Permission {
  MANAGE_USERS
  VIEW_USERS
  CREATE_USER
  UPDATE_USER
  DELETE_USER
  CREATE_CONTENT
  VIEW_CONTENT
  EDIT_CONTENT
  DELETE_CONTENT
  CREATE_CATEGORY
  VIEW_CATEGORIES
  EDIT_CATEGORY
  DELETE_CATEGORY
  UPLOAD_MEDIA
  MANAGE_MEDIA
  VIEW_MEDIA
  VIEW_ORDERS
  EDIT_ORDER
  DELETE_ORDER
  VIEW_PAYMENTS
  EDIT_PAYMENT
  DELETE_PAYMENT
  VIEW_PROFILE
  EDIT_PROFILE
  MANAGE_SETTINGS
  VIEW_SETTINGS
  VIEW_ANALYTICS
  EXPORT_DATA
  BULK_OPERATIONS
  MANAGE_SYSTEM
  MANAGE_TRIPS
  MANAGE_SLOTS
  VIEW_SLOT_ANALYTICS
}

enum TripStatus {
  DRAFT
  PENDING_REVIEW
  LIVE
  PAUSED
  ARCHIVED
}

enum SlotStatus {
  AVAILABLE
  SOFT_LOCKED
  HARD_RESERVED
}

enum WaitlistStatus {
  WAITING
  OFFERED
  CLAIMED
  PASSED
  EXPIRED
  CANCELLED
}

enum BookingStatus {
  PENDING
  CONFIRMED
  CANCELLED
  COMPLETED
  REFUNDED
}

enum OperatorVerificationStatus {
  UNVERIFIED
  PENDING
  VERIFIED
  REJECTED
}
```

### Step 2.2 — `backend/prisma/schema/user.prisma`

Better Auth's Prisma adapter requires these exact table names (`@@map("user")`, `@@map("session")`, etc.) and these exact field names. Do not rename them.

```prisma
model User {
  id             String      @id @default(uuid())
  name           String?
  email          String      @unique
  emailVerified  Boolean     @default(false)
  image          String?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  role           Role        @default(USER)
  roleAssignedAt DateTime?
  roleAssignedBy String?
  status         UserStatus  @default(ACTIVE)

  sessions        Session[]
  accounts        Account[]
  operatorProfile OperatorProfile?
  bookings        Booking[]
  reviews         Review[]

  @@index([id, email])
  @@index([role])
  @@map("user")
}

model Session {
  id        String   @id @default(uuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([token])
  @@map("session")
}

model Account {
  id                    String    @id @default(uuid())
  userId                String
  accountId             String
  providerId            String
  accessToken           String?
  refreshToken          String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  idToken               String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("account")
}

model Verification {
  id         String   @id @default(uuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@map("verification")
}
```

### Step 2.3 — `backend/prisma/schema/operator.prisma`

```prisma
model OperatorProfile {
  id                  String                     @id @default(uuid())
  userId              String                     @unique
  businessName        String
  businessDescription String?
  website             String?
  phone               String?
  country             String?
  verificationStatus  OperatorVerificationStatus @default(UNVERIFIED)
  verifiedAt          DateTime?
  payoutAccountId     String?
  createdAt           DateTime                   @default(now())
  updatedAt           DateTime                   @updatedAt

  user                User                       @relation(fields: [userId], references: [id], onDelete: Cascade)
  trips               Trip[]

  @@index([userId])
  @@map("operator_profiles")
}
```

### Step 2.4 — `backend/prisma/schema/categories.prisma`

```prisma
model Category {
  id            String         @id @default(uuid())
  name          String
  slug          String         @unique
  description   String?
  imageUrl      String?
  isActive      Boolean        @default(true)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  subCategories SubCategory[]
  trips         Trip[]
  featuredSlots FeaturedSlot[]

  @@map("categories")
}

model SubCategory {
  id         String    @id @default(uuid())
  categoryId String
  name       String
  slug       String
  createdAt  DateTime  @default(now())

  category   Category  @relation(fields: [categoryId], references: [id])
  trips      Trip[]

  @@unique([categoryId, slug])
  @@map("sub_categories")
}
```

### Step 2.5 — `backend/prisma/schema/trips.prisma`

```prisma
model Trip {
  id              String          @id @default(uuid())
  operatorId      String
  categoryId      String
  subCategoryId   String?

  title           String
  slug            String          @unique
  description     String?
  highlights      String[]
  includes        String[]
  excludes        String[]

  pricePerPerson  Decimal         @db.Decimal(10, 2)
  currency        String          @default("EUR")
  minGroupSize    Int             @default(1)
  maxGroupSize    Int

  durationHours   Float?
  meetingPoint    String?
  heroImageUrl    String?
  imageUrls       String[]

  status          TripStatus      @default(DRAFT)
  publishedAt     DateTime?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  operator        OperatorProfile @relation(fields: [operatorId], references: [id])
  category        Category        @relation(fields: [categoryId], references: [id])
  subCategory     SubCategory?    @relation(fields: [subCategoryId], references: [id])

  schedules       TripSchedule[]
  featuredSlot    FeaturedSlot?   @relation("SlotTrip")
  slotLock        SlotLock?       @relation("LockTrip")
  waitlistEntries WaitlistEntry[]
  bookings        Booking[]
  reviews         Review[]

  @@index([categoryId])
  @@index([operatorId])
  @@index([status])
  @@map("trips")
}

model TripSchedule {
  id          String    @id @default(uuid())
  tripId      String
  date        DateTime  @db.Date
  startTime   String
  capacity    Int
  bookedCount Int       @default(0)
  isCancelled Boolean   @default(false)
  createdAt   DateTime  @default(now())

  trip        Trip      @relation(fields: [tripId], references: [id], onDelete: Cascade)
  bookings    Booking[]

  @@index([tripId, date])
  @@map("trip_schedules")
}
```

### Step 2.6 — `backend/prisma/schema/featured-slots.prisma`

This is the most important schema file. Read every comment.

```prisma
// FeaturedSlot rows are PERMANENT — created when a category is created.
// Never INSERT or DELETE these in normal operation.
// Only UPDATE: who holds the slot, what the status is.
// Each category always has exactly 3 rows (rank 1, 2, 3).
model FeaturedSlot {
  id             String       @id @default(uuid())
  categoryId     String
  rank           Int          // 1, 2, or 3
  commissionRate Float        // 0.22 / 0.25 / 0.30

  status         SlotStatus   @default(AVAILABLE)

  // The trip currently hard-reserving this slot. Null when AVAILABLE or SOFT_LOCKED.
  tripId         String?      @unique
  trip           Trip?        @relation("SlotTrip", fields: [tripId], references: [id])

  acquiredAt     DateTime?    // when hard-reserve happened
  expiresAt      DateTime?    // acquiredAt + 90 days

  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  category        Category       @relation(fields: [categoryId], references: [id])
  slotLock        SlotLock?
  waitlistEntries WaitlistEntry[]
  history         SlotHistory[]

  @@unique([categoryId, rank])
  @@index([categoryId])
  @@map("featured_slots")
}

// Created when an operator picks a slot in the wizard.
// Lives for max 15 minutes. Deleted on publish or TTL expiry.
// Only ONE lock per slot at any time (enforced by @unique).
model SlotLock {
  id             String       @id @default(uuid())
  featuredSlotId String       @unique
  tripId         String?      @unique
  operatorId     String

  lockedAt       DateTime     @default(now())
  expiresAt      DateTime     // lockedAt + 15 minutes
  bullJobId      String?      // BullMQ job ID — store to cancel on publish

  featuredSlot   FeaturedSlot @relation(fields: [featuredSlotId], references: [id], onDelete: Cascade)
  trip           Trip?        @relation("LockTrip", fields: [tripId], references: [id])

  @@index([expiresAt])
  @@map("slot_locks")
}

// One row per operator per slot. FIFO queue.
// Queue position is derived at query time (ORDER BY createdAt) — never stored as a number.
model WaitlistEntry {
  id             String         @id @default(uuid())
  featuredSlotId String
  operatorId     String
  tripId         String?

  status         WaitlistStatus @default(WAITING)
  offeredAt      DateTime?
  offerExpiresAt DateTime?      // offeredAt + 24 hours
  claimedAt      DateTime?
  offerJobId     String?        // BullMQ job ID for offer expiry

  skipPaid       Boolean        @default(false)
  skipCount      Int            @default(0)    // max 3

  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  featuredSlot   FeaturedSlot   @relation(fields: [featuredSlotId], references: [id], onDelete: Cascade)

  @@unique([featuredSlotId, operatorId])
  @@index([featuredSlotId, status, createdAt])
  @@map("waitlist_entries")
}

// Audit log — every slot state change writes a row here.
model SlotHistory {
  id             String       @id @default(uuid())
  featuredSlotId String
  fromStatus     SlotStatus
  toStatus       SlotStatus
  operatorId     String?
  tripId         String?
  reason         String?      // "published" | "ttl_expired" | "operator_released" | "90day_cap"
  createdAt      DateTime     @default(now())

  featuredSlot   FeaturedSlot @relation(fields: [featuredSlotId], references: [id])

  @@index([featuredSlotId, createdAt])
  @@map("slot_history")
}
```

### Step 2.7 — `backend/prisma/schema/bookings.prisma`

```prisma
model Booking {
  id               String        @id @default(uuid())
  tripId           String
  scheduleId       String?
  travelerId       String

  guestCount       Int           @default(1)
  totalAmount      Decimal       @db.Decimal(10, 2)
  commissionAmount Decimal       @db.Decimal(10, 2)
  operatorEarnings Decimal       @db.Decimal(10, 2)
  currency         String        @default("EUR")

  // Commission rate is stored at booking time so it never changes retroactively
  commissionRate   Float

  status           BookingStatus @default(PENDING)
  paymentId        String?
  paidAt           DateTime?
  cancelledAt      DateTime?

  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  trip             Trip          @relation(fields: [tripId], references: [id])
  schedule         TripSchedule? @relation(fields: [scheduleId], references: [id])
  traveler         User          @relation(fields: [travelerId], references: [id])
  review           Review?

  @@index([tripId])
  @@index([travelerId])
  @@map("bookings")
}

model Review {
  id        String   @id @default(uuid())
  tripId    String
  bookingId String   @unique
  authorId  String
  rating    Int      // 1–5
  comment   String?
  isPublic  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  trip      Trip     @relation(fields: [tripId], references: [id])
  booking   Booking  @relation(fields: [bookingId], references: [id])
  author    User     @relation(fields: [authorId], references: [id])

  @@index([tripId])
  @@map("reviews")
}
```

### Step 2.8 — Run Migration

```bash
cd backend
pnpm prisma migrate dev --name init --schema=./prisma/schema.prisma
pnpm prisma generate
```

### Step 2.9 — Seed Script (`backend/prisma/seed.ts`)

> **[Gap G8]** No seed script was originally specified. Create this file before running `pnpm prisma db seed`.

```typescript
import { PrismaClient } from '@prisma/client';
import { auth } from '../src/auth/auth.instance';

const prisma = new PrismaClient();

async function seedFeaturedSlotsForCategory(categoryId: string) {
  const tiers = [
    { rank: 1, commissionRate: 0.22 },
    { rank: 2, commissionRate: 0.25 },
    { rank: 3, commissionRate: 0.30 },
  ];
  for (const tier of tiers) {
    await prisma.featuredSlot.upsert({
      where: { categoryId_rank: { categoryId, rank: tier.rank } },
      update: {},
      create: { categoryId, ...tier },
    });
  }
}

async function seedAdmin() {
  // Use Better Auth admin API so the password is hashed correctly
  await auth.api.createUser({
    body: {
      email: 'admin@islandtours.com',
      name: 'Admin',
      password: process.env.ADMIN_SEED_PASSWORD ?? 'change-me-in-prod',
      role: 'ADMIN',
    },
  });
}

async function seedCategories() {
  const categories = [
    { name: 'Boat & Sail', slug: 'boat-sail', description: 'Sailing tours and boat trips' },
    { name: 'Hiking', slug: 'hiking', description: 'Guided hikes and trekking expeditions' },
    { name: 'Snorkeling & Diving', slug: 'snorkeling-diving', description: 'Underwater tours' },
    { name: 'Cultural Tours', slug: 'cultural-tours', description: 'History, art and local culture' },
    { name: 'Food & Wine', slug: 'food-wine', description: 'Culinary experiences and tastings' },
  ];

  for (const cat of categories) {
    const category = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
    await seedFeaturedSlotsForCategory(category.id);
  }
}

async function main() {
  await seedAdmin();
  await seedCategories();
  console.log('Seed complete');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Add to `backend/package.json`:

```json
"prisma": {
  "seed": "ts-node --compiler-options '{\"module\":\"CommonJS\"}' prisma/seed.ts"
}
```

Run: `pnpm prisma db seed`

### Step 2.10 — Add Wishlist Model

> **[Gap G1]** The `Wishlist` model is in PROJECT_SCOPE but missing from all schema files. Add it to `backend/prisma/schema/bookings.prisma` before running migration.

```prisma
// Add this to bookings.prisma alongside Booking and Review

model Wishlist {
  id        String   @id @default(uuid())
  userId    String
  tripId    String
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  trip      Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)

  @@unique([userId, tripId])
  @@index([userId])
  @@map("wishlists")
}
```

Also add the reverse relations:
- On `User`: `wishlists Wishlist[]`
- On `Trip`: `wishlists Wishlist[]`

### Step 2.11 — Resolve PENDING_REVIEW Status

> **[Gap G2]** `TripStatus` enum includes `PENDING_REVIEW` but the trip lifecycle in all docs shows `DRAFT → LIVE` with no admin review step. Decide now — do not leave this ambiguous.

**Option A (Simpler — recommended for MVP):** Remove `PENDING_REVIEW` from the enum. Operators publish directly to LIVE.

**Option B (Stricter):** Keep `PENDING_REVIEW`. After operator publishes, trip goes to `PENDING_REVIEW`. Admin must call `POST /api/v1/admin/trips/:id/approve` to make it LIVE. Add this endpoint in Phase 17.

Make this decision before running `pnpm prisma migrate dev`.

### Step 2.12 — Seed Featured Slots Helper (used by CategoriesService)

Every time a new category is created, 3 FeaturedSlot rows must be created immediately. Add this helper to `backend/prisma/seed.ts` and also call it inside `CategoriesService.create()`:

```typescript
async function seedFeaturedSlotsForCategory(categoryId: string) {
  const tiers = [
    { rank: 1, commissionRate: 0.22 },
    { rank: 2, commissionRate: 0.25 },
    { rank: 3, commissionRate: 0.30 },
  ];
  for (const tier of tiers) {
    await prisma.featuredSlot.upsert({
      where: { categoryId_rank: { categoryId, rank: tier.rank } },
      update: {},
      create: { categoryId, ...tier },
    });
  }
}
```

---

## Phase 3 — Authentication & Authorization

### Step 3.1 — Set Up Better Auth in NestJS

Create `backend/src/auth/auth.instance.ts`. This is the single Better Auth instance the entire backend uses:

```typescript
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  baseURL: process.env.BETTER_AUTH_URL,   // http://localhost:5000
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [process.env.FRONTEND_URL], // http://localhost:3000

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    // For OPERATOR self-registration — email must be verified before they can use the platform
    // For USER accounts — created programmatically, email sent with credentials
  },

  socialProviders: {
    // Only TOUR_OPERATORs use social login — configured here
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,          // 7 days
    updateAge: 60 * 60 * 24,              // refresh if older than 1 day
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
});
```

### Step 3.2 — Mount Better Auth Routes in NestJS

Better Auth exposes its own HTTP routes (sign-in, sign-up, OAuth callbacks, etc.). Mount them in NestJS using `toNodeHandler`:

```typescript
// backend/src/auth/auth.controller.ts
import { All, Controller, Req, Res } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.instance';
import { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  private readonly handler = toNodeHandler(auth);

  // Catch ALL methods on ALL sub-paths under /api/auth/*
  @All('*')
  async handleAuth(@Req() req: Request, @Res() res: Response) {
    // Strip the /api prefix — Better Auth expects paths like /auth/sign-in/email
    req.url = req.url.replace('/api', '');
    return this.handler(req, res);
  }
}
```

Register this controller in `AuthModule` and import `AuthModule` in `AppModule`. Better Auth routes are now live at:

```
POST http://localhost:5000/api/auth/sign-in/email
POST http://localhost:5000/api/auth/sign-up/email
POST http://localhost:5000/api/auth/sign-out
GET  http://localhost:5000/api/auth/session
GET  http://localhost:5000/api/auth/callback/google
... (all other Better Auth endpoints)
```

### Step 3.3 — AuthGuard (Protects NestJS Routes)

The `AuthGuard` reads the session cookie (or Bearer token) from incoming requests and validates it against Better Auth.

```typescript
// backend/src/auth/guards/auth.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { auth } from '../auth.instance';
import { fromNodeHeaders } from 'better-auth/node';

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session) throw new UnauthorizedException();

    // Attach user to request so controllers can access it
    request.user = session.user;
    request.session = session.session;

    return true;
  }
}
```

### Step 3.4 — RolesGuard and Decorators

```typescript
// backend/src/auth/guards/roles.guard.ts
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<Role[]>('roles', context.getHandler());
    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!requiredRoles.includes(user.role)) throw new ForbiddenException();
    return true;
  }
}

// backend/src/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);

// backend/src/decorators/authenticated-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const AuthenticatedUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user,
);
```

Using guards in a controller:

```typescript
@Roles(Role.OPERATOR, Role.ADMIN)
@UseGuards(AuthGuard, RolesGuard)
@Post()
createTrip(@AuthenticatedUser() user: any) {
  // user = { id, email, name, role, ... } from Better Auth session
}
```

### Step 3.5 — CORS Configuration

The frontend (port 3000) and backend (port 5000) are on different origins. Configure CORS in NestJS so the browser allows cross-origin requests **with credentials** (needed for the session cookie):

```typescript
// backend/src/main.ts
app.enableCors({
  origin: process.env.FRONTEND_URL,  // http://localhost:3000
  credentials: true,                 // CRITICAL: allows session cookie to be sent
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

Without `credentials: true`, the browser will strip the `better-auth.session_token` cookie from cross-origin requests and the session will never validate.

### Step 3.6 — Update ROLE_PERMISSIONS Config

```typescript
// backend/src/config/roles.config.ts
import { Permission, Role } from '@prisma/client';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: [
    Permission.MANAGE_USERS,
    Permission.VIEW_USERS,
    Permission.MANAGE_TRIPS,
    Permission.MANAGE_SLOTS,
    Permission.VIEW_SLOT_ANALYTICS,
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_DATA,
    Permission.VIEW_CONTENT,
    Permission.EDIT_CONTENT,
    Permission.DELETE_CONTENT,
    Permission.CREATE_CATEGORY,
    Permission.VIEW_CATEGORIES,
    Permission.EDIT_CATEGORY,
    Permission.DELETE_CATEGORY,
    Permission.VIEW_ORDERS,
    Permission.VIEW_PAYMENTS,
    Permission.VIEW_PROFILE,
    Permission.EDIT_PROFILE,
    Permission.VIEW_SETTINGS,
    Permission.MANAGE_SETTINGS,
  ],
  [Role.OPERATOR]: [
    Permission.CREATE_CONTENT,
    Permission.EDIT_CONTENT,
    Permission.DELETE_CONTENT,
    Permission.VIEW_CONTENT,
    Permission.UPLOAD_MEDIA,
    Permission.VIEW_MEDIA,
    Permission.VIEW_ORDERS,
    Permission.VIEW_PAYMENTS,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_PROFILE,
    Permission.EDIT_PROFILE,
    Permission.MANAGE_TRIPS,
    Permission.VIEW_CATEGORIES,
  ],
  [Role.USER]: [
    Permission.VIEW_CONTENT,
    Permission.VIEW_ORDERS,
    Permission.VIEW_PROFILE,
    Permission.EDIT_PROFILE,
  ],
};
```

### Step 3.7 — User Account Creation for Customers (USER role)

Customers do not self-register. When a booking is made by an unregistered person, the backend auto-creates their account:

```typescript
// backend/src/bookings/bookings.service.ts
async createGuestAccount(email: string, name: string): Promise<{ user: User; tempPassword: string }> {
  const tempPassword = crypto.randomBytes(8).toString('hex'); // e.g. "a3f7b2c1"

  // Use Better Auth's admin API to create the user programmatically
  const user = await auth.api.createUser({
    body: {
      email,
      name,
      password: tempPassword,
      role: 'USER',
    },
  });

  // Send credentials via email
  await this.mailService.sendCredentials(email, name, tempPassword);

  return { user, tempPassword };
}
```

---

## Phase 4 — Backend: Core Modules

### Step 4.1 — Update `backend/src/app.module.ts`

```typescript
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.getOrThrow('REDIS_URL') },
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    CategoriesModule,
    TripsModule,
    SlotsModule,
    WaitlistModule,
    BookingsModule,
    OperatorsModule,
    ReviewsModule,
    UploadModule,
    PaymentsModule,
    WishlistModule,
    WorkersModule,
  ],
})
export class AppModule {}
```

### Step 4.1b — Upload Module

> **[Gap G4]** The upload service is referenced throughout the guide but no controller or module is specified. Create this before the Trip wizard (operators need it to attach photos).

`backend/src/upload/`

**`upload.service.ts`** key methods:

- `uploadFile(file: Express.Multer.File)` — uploads to Cloudinary, returns `{ url, publicId }`
- `deleteFile(publicId: string)` — removes from Cloudinary (for photo management)

**`upload.controller.ts`** routes:

- `POST /api/v1/upload` — `@Roles(Role.OPERATOR, Role.ADMIN)`, `@UseInterceptors(FileInterceptor('file'))` — returns `{ url }`

Install `multer` types: `pnpm add -D @types/multer`

Install Cloudinary SDK: `pnpm add cloudinary`

### Step 4.2 — Categories Module

`backend/src/categories/`

**`categories.service.ts`** key methods:
- `findAll()` — all active categories with sub-categories
- `create(dto)` — creates category AND immediately calls `seedFeaturedSlotsForCategory(id)` to create 3 FeaturedSlot rows
- `findOne(slug)` — for traveler browse

**`categories.controller.ts`** routes:
- `GET /api/v1/categories` — public
- `GET /api/v1/categories/:slug` — public
- `POST /api/v1/categories` — `@Roles(Role.ADMIN)`
- `PATCH /api/v1/categories/:id` — `@Roles(Role.ADMIN)`

### Step 4.3 — Operators Module

`backend/src/operators/`

**`operators.service.ts`** key methods:
- `apply(userId, dto)` — creates `OperatorProfile` with `PENDING` status
- `approve(userId, adminId)` — sets `verificationStatus = VERIFIED` and `User.role = OPERATOR`
- `reject(userId, adminId)` — sets `verificationStatus = REJECTED`
- `getProfile(userId)` — operator profile with trips and slot holdings
- `getMySlots(operatorId)` — active slots, waitlist positions

**`operators.controller.ts`** routes:
- `POST /api/v1/operators/apply` — `@UseGuards(AuthGuard)` — any logged-in user
- `GET /api/v1/operators/me` — `@Roles(Role.OPERATOR)`
- `GET /api/v1/operators/me/slots` — `@Roles(Role.OPERATOR)`
- `PATCH /api/v1/operators/:id/approve` — `@Roles(Role.ADMIN)`
- `PATCH /api/v1/operators/:id/reject` — `@Roles(Role.ADMIN)`

### Step 4.4 — Trips Module

`backend/src/trips/`

**`trips.service.ts`** key methods:

- `create(operatorId, dto)` — creates trip as `DRAFT`
- `update(tripId, dto, operatorId)` — updates, validates ownership; throws 422 if operator tries to change `categoryId` while holding a featured slot
- `getMyTrips(operatorId)` — operator's own trips
- `findLive(filters)` — public: live trips with featured slot badges. **[Gap G10]** Implement these Prisma `where` clauses:
  - `categoryId` — filter by category
  - `subCategoryId` — filter by sub-category
  - `pricePerPerson` — `{ gte: minPrice, lte: maxPrice }`
  - `schedules.date` — filter by available departure date range
  - `title` — `{ contains: searchTerm, mode: 'insensitive' }` (full-text search via Prisma)
  - `featuredSlot` — include slot rank in the response so frontend can show badges
- `findBySlug(slug)` — trip detail with operator info, reviews, and slot rank
- `pause(tripId, operatorId)` — sets PAUSED, calls `slotsService.releaseSlot()` if slot held
- `archive(tripId, operatorId)` — sets ARCHIVED, calls `slotsService.releaseSlot()` if slot held

**`trips.controller.ts`** routes:

- `GET /api/v1/trips` — public
- `GET /api/v1/trips/:slug` — public
- `GET /api/v1/trips/my-trips` — `@Roles(Role.OPERATOR)`
- `POST /api/v1/trips` — `@Roles(Role.OPERATOR)`
- `PATCH /api/v1/trips/:id` — `@Roles(Role.OPERATOR)`
- `POST /api/v1/trips/:id/publish` — `@Roles(Role.OPERATOR)` — race condition endpoint
- `POST /api/v1/trips/:id/pause` — `@Roles(Role.OPERATOR)`
- `DELETE /api/v1/trips/:id` — `@Roles(Role.OPERATOR)` — soft archive

> **[Gap G2 reminder]** If you chose Option B for `PENDING_REVIEW`, add `POST /api/v1/admin/trips/:id/approve` here and guard it with `@Roles(Role.ADMIN)`.

### Step 4.4b — Reviews Module

> **[Gap G5]** Reviews have a complete schema but no service or controller was specified. This module must be implemented for the post-trip user experience.

`backend/src/reviews/`

**`reviews.service.ts`** key methods:

- `create(bookingId, authorId, dto)` — validates that the Booking status is `COMPLETED`, that it belongs to `authorId`, and that no review exists yet for this booking (enforced by `@unique` on `bookingId`); creates Review row
- `findByTrip(tripId, page?, limit?)` — paginated public reviews for a trip; only `isPublic = true`
- `delete(reviewId, requesterId)` — operator or admin can delete a review

**`reviews.controller.ts`** routes:

- `POST /api/v1/reviews` — `@Roles(Role.USER, Role.OPERATOR)` (both roles can book and review)
- `GET /api/v1/trips/:tripId/reviews` — public
- `DELETE /api/v1/reviews/:id` — `@Roles(Role.OPERATOR, Role.ADMIN)`

### Step 4.5 — Bookings Module

`backend/src/bookings/`

**`bookings.service.ts`** key methods:

- `create(travelerId, dto)` — create booking, capture commission rate from slot at booking time; if `travelerId` is new email, call `createGuestAccount()` first
- `confirm(bookingId)` — after payment webhook confirms; sets `status = CONFIRMED`, `paidAt = now()`
- `cancel(bookingId, userId)` — traveler or operator cancels; sets `status = CANCELLED`, `cancelledAt = now()`; triggers refund via payment gateway
- `getMyBookings(travelerId)` — traveler booking history
- `getOperatorBookings(operatorId)` — all bookings for operator's trips

### Step 4.5b — Payments Module (Webhooks)

> **[Gap G3]** Payment webhook handlers are entirely missing from this guide. Without them, bookings will never transition from `PENDING` to `CONFIRMED`.

`backend/src/payments/`

**`payments.controller.ts`** routes:

- `POST /api/v1/webhooks/stripe` — verify Stripe signature (`stripe.webhooks.constructEvent`), on `checkout.session.completed` call `bookingsService.confirm(bookingId)`
- `POST /api/v1/webhooks/mollie` — verify Mollie webhook, on `paid` status call `bookingsService.confirm()`
- `POST /api/v1/webhooks/paypal` — verify PayPal IPN/webhook, on `PAYMENT.CAPTURE.COMPLETED` call `bookingsService.confirm()`

**Critical:** Webhook endpoints must NOT use the `AuthGuard`. They are called by payment providers, not by the browser. Verify signatures instead. Mark these controllers with `@Public()` or exclude them from global guards.

**`payments.service.ts`** key methods:

- `createCheckoutSession(bookingId, gateway)` — creates Stripe/Mollie/PayPal payment session and returns redirect URL
- `refund(bookingId)` — issues refund via the gateway stored on the booking

### Step 4.5c — Wishlist Module

`backend/src/wishlist/`

**`wishlist.service.ts`** key methods:

- `add(userId, tripId)` — upsert Wishlist row (idempotent)
- `remove(userId, tripId)` — delete Wishlist row
- `getAll(userId)` — all wishlisted trips with trip details

**`wishlist.controller.ts`** routes:

- `POST /api/v1/wishlist` — `@Roles(Role.USER, Role.OPERATOR)`, body: `{ tripId }`
- `DELETE /api/v1/wishlist/:tripId` — `@Roles(Role.USER, Role.OPERATOR)`
- `GET /api/v1/wishlist` — `@Roles(Role.USER, Role.OPERATOR)`

---

## Phase 5 — Backend: Slot Economy

This is the most critical module. The correctness of this phase determines everything downstream.

### Step 5.1 — `backend/src/slots/slots.module.ts`

```typescript
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { SlotsController } from './slots.controller';
import { SlotsService } from './slots.service';
import { SlotEventsService } from './slot-events.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'slot-ttl' })],
  providers: [SlotsService, SlotEventsService],
  controllers: [SlotsController],
  exports: [SlotsService, SlotEventsService],
})
export class SlotsModule {}
```

### Step 5.2 — `backend/src/slots/slots.service.ts`

**Method 1: `lockSlot(featuredSlotId, tripId, operatorId)`**

Runs when an operator clicks "Reserve slot #N" in the wizard.

```
Step 1: Open a Prisma transaction.
Step 2: Inside transaction, find FeaturedSlot and check status === AVAILABLE.
        If not → throw ConflictException('Slot is not available').
Step 3: Verify no SlotLock already exists for this featuredSlotId.
Step 4: Create SlotLock { expiresAt: now + 15min, operatorId, tripId }.
Step 5: Update FeaturedSlot.status = SOFT_LOCKED.
Step 6: Write SlotHistory row: fromStatus=AVAILABLE, toStatus=SOFT_LOCKED.
Step 7: Commit transaction.

After transaction:
Step 8: Add BullMQ delayed job to 'slot-ttl' queue:
        { name: 'release-lock', data: { slotLockId }, delay: 15 * 60 * 1000 }
Step 9: Update SlotLock.bullJobId with the returned job ID.
Step 10: Publish Redis pub/sub event to 'slot-events:{categoryId}':
         { type: 'slot.locked', rank, expiresAt }
Step 11: Return SlotLock (including expiresAt) to the caller.
```

**Method 2: `publishTrip(tripId, operatorId)`**

The race-condition-critical publish. Only one operator can win per slot.

```
Step 1: Find SlotLock for this tripId. If absent → throw GoneException('Lock expired').
Step 2: If SlotLock.expiresAt <= now() → throw GoneException('Lock expired').
Step 3: Open a Prisma transaction.
Step 4: Run the atomic conditional UPDATE — this is the race-condition guard:

        prisma.featuredSlot.updateMany({
          where: {
            id: featuredSlotId,
            status: 'SOFT_LOCKED',    // ← the guard: only succeeds if still soft-locked
          },
          data: {
            status: 'HARD_RESERVED',
            tripId,
            acquiredAt: new Date(),
            expiresAt: addDays(new Date(), 90),
          },
        })

Step 5: If updateMany.count === 0 → another operator published first.
        Throw ConflictException({ code: 'SLOT_TAKEN' }).
        Frontend will show the race-condition recovery modal.
Step 6: Update Trip.status = LIVE, Trip.publishedAt = now().
Step 7: Delete the SlotLock row.
Step 8: Write SlotHistory: fromStatus=SOFT_LOCKED, toStatus=HARD_RESERVED, reason='published'.
Step 9: Commit transaction.

After transaction:
Step 10: Cancel the 15-min BullMQ TTL job:
         const job = await this.slotTtlQueue.getJob(slotLock.bullJobId);
         await job?.remove();
Step 11: Schedule 90-day cap job:
         { name: 'expire-cap', data: { featuredSlotId }, delay: 90 * 24 * 60 * 60 * 1000 }
Step 12: Publish Redis event: { type: 'slot.taken', rank }
Step 13: Return the published trip.
```

**Method 3: `releaseSlot(featuredSlotId, reason)`**

Called by TTL worker, 90-day cap worker, or when operator pauses/archives a trip.

```
Step 1: Open transaction.
Step 2: Update FeaturedSlot: status=AVAILABLE, tripId=null, acquiredAt=null, expiresAt=null.
Step 3: Delete SlotLock if it exists.
Step 4: Write SlotHistory: toStatus=AVAILABLE, reason=reason.
Step 5: Commit transaction.

After transaction:
Step 6: Publish Redis event: { type: 'slot.released', rank }
Step 7: Find the first WAITING WaitlistEntry for this slot (ORDER BY createdAt ASC — FIFO).
Step 8: If found → call waitlistService.offerSlot(entry.id).
```

### Step 5.3 — `backend/src/slots/slots.controller.ts`

```typescript
@Controller({ path: 'slots', version: '1' })
export class SlotsController {

  @Get('category/:categoryId')
  getSlotsByCategory(@Param('categoryId') id: string) {
    return this.slotsService.getSlotsByCategory(id);
  }

  @Roles(Role.OPERATOR, Role.ADMIN)
  @UseGuards(AuthGuard, RolesGuard)
  @Post(':slotId/lock')
  lockSlot(
    @Param('slotId') slotId: string,
    @Body() dto: LockSlotDto,
    @AuthenticatedUser() user: any,
  ) {
    return this.slotsService.lockSlot(slotId, dto.tripId, user.id);
  }

  @Roles(Role.OPERATOR, Role.ADMIN)
  @UseGuards(AuthGuard, RolesGuard)
  @Delete(':slotId/lock')
  releaseLock(@Param('slotId') slotId: string, @AuthenticatedUser() user: any) {
    return this.slotsService.releaseSlotLock(slotId, user.id);
  }

  // SSE endpoint — real-time slot status stream (Phase 8)
  @Get('stream')
  @Sse()
  slotStream(@Query('categoryId') categoryId: string): Observable<MessageEvent> {
    return this.slotEventsService.getStream(categoryId);
  }
}
```

---

## Phase 6 — Backend: Waitlist System

### Step 6.1 — `backend/src/waitlist/waitlist.service.ts`

**`joinQueue(featuredSlotId, operatorId, tripId?)`**
```
1. Verify no existing WAITING/OFFERED entry for this operator+slot.
2. Create WaitlistEntry { status: WAITING }.
3. Return entry with queue position (COUNT of WAITING entries with createdAt < this one).
```

**`offerSlot(waitlistEntryId)`** — called when a slot becomes free and this entry is first in line:
```
1. Update WaitlistEntry: status=OFFERED, offeredAt=now(), offerExpiresAt=now()+24h.
2. Add BullMQ job: { name: 'expire-offer', data: { waitlistEntryId }, delay: 24h }.
3. Store job ID in WaitlistEntry.offerJobId.
4. Send email notification to the operator.
5. Publish Redis event to 'slot-offer:{operatorId}': { type: 'offer.received', expiresAt }.
```

**`claimOffer(waitlistEntryId, operatorId)`**
```
1. Validate status=OFFERED and offerExpiresAt > now().
2. Re-check FeaturedSlot is still AVAILABLE (could have changed between offer and claim).
   If taken → mark offer EXPIRED, offer to next in queue.
3. In transaction: update WaitlistEntry.status=CLAIMED, claimedAt=now().
4. Call slotsService.lockSlot() to soft-lock for this operator.
5. Cancel BullMQ offer-expiry job using offerJobId.
6. Return the SlotLock so frontend takes operator into the creation wizard.
```

**`passOffer(waitlistEntryId, operatorId)`**
```
1. Update WaitlistEntry.status = WAITING (keeps queue position).
2. Cancel BullMQ offer job.
3. Find next WAITING entry and call offerSlot() on it.
```

### Step 6.2 — Waitlist Controller Routes

- `POST /api/v1/waitlist/join` — `@Roles(Role.OPERATOR)`
- `POST /api/v1/waitlist/:id/claim` — `@Roles(Role.OPERATOR)`
- `POST /api/v1/waitlist/:id/pass` — `@Roles(Role.OPERATOR)`
- `DELETE /api/v1/waitlist/:id` — `@Roles(Role.OPERATOR)` — leave queue
- `GET /api/v1/waitlist/my-entries` — `@Roles(Role.OPERATOR)` — current positions
- `GET /api/v1/waitlist/eta/:categoryId` — public — estimated wait times per slot

---

## Phase 7 — Backend: BullMQ Background Jobs

### Step 7.1 — `backend/src/workers/slot-ttl.processor.ts`

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('slot-ttl')
export class SlotTtlProcessor extends WorkerHost {
  constructor(
    private slotsService: SlotsService,
    private prisma: PrismaService,
  ) { super(); }

  async process(job: Job) {
    if (job.name === 'release-lock') {
      const { slotLockId } = job.data;
      const lock = await this.prisma.slotLock.findUnique({
        where: { id: slotLockId },
      });

      // If lock is gone, operator already published — job is stale, do nothing
      if (!lock) return;
      if (lock.expiresAt > new Date()) return; // shouldn't happen, guard anyway

      await this.slotsService.releaseSlot(lock.featuredSlotId, 'ttl_expired');
    }

    if (job.name === 'expire-cap') {
      const { featuredSlotId } = job.data;
      await this.slotsService.releaseSlot(featuredSlotId, '90day_cap');
      // TODO: send email to operator informing their 90-day slot cap has ended
    }
  }
}
```

### Step 7.2 — `backend/src/workers/waitlist-offer.processor.ts`

```typescript
@Processor('waitlist-offers')
export class WaitlistOfferProcessor extends WorkerHost {
  async process(job: Job) {
    if (job.name === 'expire-offer') {
      const { waitlistEntryId } = job.data;
      const entry = await this.prisma.waitlistEntry.findUnique({
        where: { id: waitlistEntryId },
      });

      if (!entry || entry.status === 'CLAIMED') return;

      await this.prisma.waitlistEntry.update({
        where: { id: waitlistEntryId },
        data: { status: 'EXPIRED' },
      });

      // Offer to the next person in FIFO queue
      const next = await this.prisma.waitlistEntry.findFirst({
        where: {
          featuredSlotId: entry.featuredSlotId,
          status: 'WAITING',
          createdAt: { gt: entry.createdAt },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (next) await this.waitlistService.offerSlot(next.id);
    }
  }
}
```

### Step 7.3 — `backend/src/workers/workers.module.ts`

```typescript
@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'slot-ttl' },
      { name: 'waitlist-offers' },
    ),
    SlotsModule,
    WaitlistModule,
  ],
  providers: [SlotTtlProcessor, WaitlistOfferProcessor],
})
export class WorkersModule {}
```

---

## Phase 8 — Backend: Real-Time SSE Gateway

### Step 8.1 — `backend/src/slots/slot-events.service.ts`

**Critical:** Two separate Redis connections are required. A Redis connection in `subscribe` mode cannot send other commands. So the subscriber lives here, and the publisher lives in `SlotsService`.

```typescript
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import Redis from 'ioredis';

@Injectable()
export class SlotEventsService implements OnModuleDestroy {
  // Dedicated connection for SUBSCRIBE mode only
  private subscriber: Redis;

  constructor(private config: ConfigService) {
    this.subscriber = new Redis(this.config.getOrThrow('REDIS_URL'));
  }

  getStream(categoryId: string): Observable<MessageEvent> {
    const channel = `slot-events:${categoryId}`;

    return new Observable((obs) => {
      this.subscriber.subscribe(channel);

      const handler = (ch: string, message: string) => {
        if (ch === channel) {
          obs.next({ data: JSON.parse(message) } as MessageEvent);
        }
      };

      this.subscriber.on('message', handler);

      // Cleanup when SSE client disconnects (tab closes, component unmounts)
      return () => {
        this.subscriber.off('message', handler);
        this.subscriber.unsubscribe(channel);
      };
    });
  }

  onModuleDestroy() {
    this.subscriber.disconnect();
  }
}
```

### Step 8.2 — Resolve Operator Offer Notifications (Gap G12)

> **[Gap G12]** The guide describes two inconsistent approaches for notifying operators of a pending slot offer: 60-second polling AND a per-operator Redis channel `slot-offer:{operatorId}`. Pick one before implementation.

**Option A — Polling (simpler, recommended for MVP):**
- Frontend calls `GET /api/v1/waitlist/my-entries` every 60 seconds on the operator dashboard
- Display `OfferBanner` for any entry with `status === 'OFFERED'`
- No additional SSE channel needed

**Option B — SSE per-operator channel (lower latency):**
- Add a second SSE endpoint: `GET /api/v1/waitlist/stream` (authenticated, per-operator)
- `WaitlistService.offerSlot()` publishes to Redis channel `slot-offer:{operatorId}`
- `SlotEventsService.getOperatorStream(operatorId)` subscribes and returns `Observable<MessageEvent>`
- Operator dashboard opens this SSE connection permanently alongside the slot-events stream

Implement whichever you choose, then remove the reference to the other approach. Do not implement both.

In `SlotsService`, inject a separate publisher connection:

```typescript
// In SlotsService — separate connection for PUBLISH
private publisher: Redis;

constructor(private config: ConfigService, ...) {
  this.publisher = new Redis(this.config.getOrThrow('REDIS_URL'));
}

private async publishSlotEvent(categoryId: string, event: object) {
  await this.publisher.publish(`slot-events:${categoryId}`, JSON.stringify(event));
}
```

---

## Phase 9 — Frontend: Project Structure & TanStack Query Setup

### Step 9.1 — Auth Client Setup

The frontend uses Better Auth's client SDK. It points to the **backend** for all auth operations.

```typescript
// frontend/lib/auth-client.ts
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL, // http://localhost:5000
});

// Export individual methods for convenience
export const { signIn, signUp, signOut, useSession } = authClient;
```

**What this does:** Every auth call (`signIn.email()`, `signUp.email()`, `signOut()`, `useSession()`) goes to `http://localhost:5000/api/auth/*`. The frontend has no auth logic of its own — it just drives the backend's auth endpoints.

### Step 9.2 — Get Session in Server Components

For Next.js Server Components, fetch the session from the backend directly:

```typescript
// frontend/lib/session.ts
import { headers } from 'next/headers';

export async function getSession() {
  const res = await fetch(
    `${process.env.BACKEND_API_URL}/auth/session`,
    {
      headers: Object.fromEntries(await headers()), // forward cookies to backend
      cache: 'no-store',
    },
  );

  if (!res.ok) return null;
  const data = await res.json();
  return data?.session ? data : null; // { user, session } or null
}
```

Usage in any Server Component:

```typescript
// frontend/app/(operator)/layout.tsx
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';

export default async function OperatorLayout({ children }) {
  const session = await getSession();

  if (!session) redirect('/login?callbackUrl=/operator/dashboard');
  if (session.user.role !== 'OPERATOR' && session.user.role !== 'ADMIN') {
    redirect('/become-operator');
  }

  return <>{children}</>;
}
```

### Step 9.3 — TanStack Query Setup

```typescript
// frontend/components/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60 * 1000,
        retry: 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### Step 9.4 — API Client Helper

```typescript
// frontend/lib/api.ts
const BASE = process.env.NEXT_PUBLIC_BACKEND_URL + '/api/v1';

export async function apiClient<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include', // sends better-auth.session_token cookie
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw { status: res.status, ...error };
  }

  return res.json();
}
```

### Step 9.5 — Frontend Route Middleware

```typescript
// frontend/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const protectedPrefixes = ['/operator', '/admin', '/bookings', '/profile'];
  const isProtected = protectedPrefixes.some(p => pathname.startsWith(p));

  if (!isProtected) return NextResponse.next();

  // Check session from backend
  const sessionRes = await fetch(
    `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/session`,
    {
      headers: { cookie: request.headers.get('cookie') || '' },
      cache: 'no-store',
    },
  );

  if (!sessionRes.ok) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/operator/:path*', '/admin/:path*', '/bookings/:path*', '/profile/:path*'],
};
```

### Step 9.6 — App Directory Structure

```
frontend/app/
├── (public)/                           # Traveler pages — Server Components, SEO
│   ├── page.tsx                        # Homepage: featured trips + categories
│   ├── search/page.tsx
│   ├── [category]/
│   │   ├── page.tsx
│   │   └── [sub]/page.tsx
│   └── trips/[slug]/
│       └── page.tsx                    # Trip detail + booking form
│
├── (operator)/                         # Operator dashboard — Client Components
│   ├── layout.tsx                      # Role guard: OPERATOR or ADMIN only
│   └── operator/
│       ├── dashboard/page.tsx
│       ├── trips/
│       │   ├── page.tsx
│       │   ├── new/page.tsx            # 6-step creation wizard
│       │   └── [id]/edit/page.tsx
│       ├── featured/page.tsx           # Slot status + waitlist
│       ├── bookings/page.tsx
│       └── payouts/page.tsx
│
├── (admin)/                            # Admin panel — Client Components
│   ├── layout.tsx                      # Role guard: ADMIN only
│   └── admin/
│       ├── dashboard/page.tsx
│       ├── operators/page.tsx
│       ├── trips/page.tsx
│       └── slots/page.tsx
│
├── login/page.tsx
├── signup/page.tsx                     # OPERATOR self-registration only
├── become-operator/page.tsx            # Apply to become an operator
└── layout.tsx                          # Root layout — wraps with <Providers>
```

---

## Phase 10 — Frontend: Auth Integration

### Step 10.0 — Resolve GitHub OAuth (Gap G11)

> **[Gap G11]** `auth.instance.ts` includes GitHub OAuth but `PROJECT_SCOPE.md` only lists Google for operators. Decide before implementing any social login button.

**Option A (match scope):** Remove `github` from `socialProviders` in `auth.instance.ts`. Only Google OAuth button on login/signup pages.

**Option B (extend scope):** Keep GitHub. Update `PROJECT_SCOPE.md` to list GitHub as a supported login method.

Either way, document the decision in a code comment on `auth.instance.ts`.

### Step 10.1 — Login Page

```typescript
// frontend/app/login/page.tsx
'use client';

import { signIn } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    const { error } = await signIn.email({
      email: form.get('email') as string,
      password: form.get('password') as string,
    });

    if (error) {
      // show error
      return;
    }

    router.push('/operator/dashboard'); // or wherever
  }

  return (
    <form onSubmit={handleLogin}>
      <input name="email" type="email" />
      <input name="password" type="password" />
      <button type="submit">Sign in</button>
    </form>
  );
}
```

`signIn.email()` calls `POST http://localhost:5000/api/auth/sign-in/email` — the NestJS backend. On success, Better Auth sets the session cookie. All subsequent requests carry it automatically.

### Step 10.2 — Using Session in Client Components

```typescript
'use client';
import { useSession, signOut } from '@/lib/auth-client';

function NavUser() {
  const { data: session, isPending } = useSession();

  if (isPending) return <Skeleton />;
  if (!session) return <a href="/login">Sign in</a>;

  return (
    <div>
      <span>{session.user.name}</span>
      <button onClick={() => signOut()}>Sign out</button>
    </div>
  );
}
```

### Step 10.3 — Become-Operator Page

> **[Gap G9]** The `become-operator` page is referenced in the route structure and the operator layout guard redirects to it, but it was never specified. This page bridges a logged-in USER account to the operator onboarding flow.

```typescript
// frontend/app/become-operator/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

export default function BecomeOperatorPage() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    await apiClient('/operators/apply', {
      method: 'POST',
      body: JSON.stringify({
        businessName: form.get('businessName'),
        businessDescription: form.get('businessDescription'),
        website: form.get('website'),
        phone: form.get('phone'),
        country: form.get('country'),
      }),
    });

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div>
        <h1>Application submitted</h1>
        <p>We will review your application and notify you by email. This typically takes 1–2 business days.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="businessName" placeholder="Business name" required />
      <textarea name="businessDescription" placeholder="Describe your business" />
      <input name="website" placeholder="Website URL" />
      <input name="phone" placeholder="Phone number" />
      <input name="country" placeholder="Country" />
      <button type="submit">Apply to become an operator</button>
    </form>
  );
}
```

This page is accessible to any authenticated user (role = USER). After admin approval, the user's role is promoted to OPERATOR.

---

## Phase 11 — Frontend: Traveler Pages (Server Components)

These pages are Server Components — they fetch data server-side via `fetch()`. No TanStack Query here.

### Step 11.1 — Homepage

```typescript
// frontend/app/(public)/page.tsx
import { unstable_cache } from 'next/cache';

const getFeaturedTrips = unstable_cache(
  async () => {
    const res = await fetch(
      `${process.env.BACKEND_API_URL}/trips?featured=true&limit=9`,
      { next: { revalidate: 60 } },
    );
    return res.json();
  },
  ['featured-trips'],
  { revalidate: 60 },
);

export default async function HomePage() {
  const { trips } = await getFeaturedTrips();
  return (
    <>
      <HeroCarousel featuredTrip={trips.find(t => t.slotRank === 1)} />
      <CategoryGrid trips={trips} />
    </>
  );
}
```

### Step 11.2 — Trip Detail Page

```typescript
// frontend/app/(public)/trips/[slug]/page.tsx
export default async function TripPage({ params }) {
  const trip = await fetch(
    `${process.env.BACKEND_API_URL}/trips/${params.slug}`,
    { next: { revalidate: 300 } },
  ).then(r => { if (!r.ok) return null; return r.json(); });

  if (!trip) notFound();

  return (
    <>
      <TripHero trip={trip} />
      <BookingForm trip={trip} />   {/* Client Component */}
    </>
  );
}

export async function generateStaticParams() {
  const trips = await fetch(
    `${process.env.BACKEND_API_URL}/trips?limit=50&status=LIVE`,
  ).then(r => r.json());
  return trips.map(t => ({ slug: t.slug }));
}
```

---

## Phase 12 — Frontend: Operator Dashboard (Client Components)

### Step 12.1 — Trips List

```typescript
'use client';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export default function TripsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['operator-trips'],
    queryFn: () => apiClient('/trips/my-trips'),
  });

  if (isLoading) return <TripsSkeleton />;
  return <TripsList trips={data.trips} />;
}
```

### Step 12.2 — Publish Trip with Optimistic Update + Race Condition Handling

```typescript
'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

export function PublishTripButton({ tripId }) {
  const queryClient = useQueryClient();
  const [raceConditionData, setRaceConditionData] = useState(null);

  const { mutate: publishTrip, isPending } = useMutation({
    mutationFn: () => apiClient(`/trips/${tripId}/publish`, { method: 'POST' }),

    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['operator-trips'] });
      const prev = queryClient.getQueryData(['operator-trips']);
      // Optimistically mark as LIVE before server confirms
      queryClient.setQueryData(['operator-trips'], (old: any) => ({
        ...old,
        trips: old.trips.map(t => t.id === tripId ? { ...t, status: 'LIVE' } : t),
      }));
      return { prev };
    },

    onError: (error: any, _, context) => {
      queryClient.setQueryData(['operator-trips'], context.prev);  // roll back

      if (error.statusCode === 409 && error.code === 'SLOT_TAKEN') {
        setRaceConditionData(error); // show recovery modal
      } else if (error.statusCode === 410) {
        toast.error('Slot reservation expired. Please pick a slot again.');
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator-trips'] });
      toast.success('Trip is now live!');
    },
  });

  return (
    <>
      <Button onClick={() => publishTrip()} disabled={isPending}>
        {isPending ? 'Publishing...' : 'Publish →'}
      </Button>
      {raceConditionData && (
        <RaceConditionModal data={raceConditionData} onClose={() => setRaceConditionData(null)} />
      )}
    </>
  );
}
```

---

## Phase 13 — Frontend: Slot Picker (Real-Time Client Component)

### Step 13.1 — `frontend/hooks/use-slot-stream.ts`

```typescript
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useSlotStream(categoryId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!categoryId) return;

    const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/slots/stream?categoryId=${categoryId}`;
    const source = new EventSource(url, { withCredentials: true });

    source.onmessage = (event) => {
      const data = JSON.parse(event.data);

      queryClient.setQueryData(['slots', categoryId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          slots: old.slots.map(slot => {
            if (slot.rank !== data.rank) return slot;
            if (data.type === 'slot.locked')
              return { ...slot, status: 'SOFT_LOCKED', lockExpiresAt: data.expiresAt };
            if (data.type === 'slot.released')
              return { ...slot, status: 'AVAILABLE', lockExpiresAt: null };
            if (data.type === 'slot.taken')
              return { ...slot, status: 'HARD_RESERVED' };
            return slot;
          }),
        };
      });
    };

    source.onerror = () => {
      // Browser auto-reconnects. Optionally refetch on reconnect:
      queryClient.invalidateQueries({ queryKey: ['slots', categoryId] });
    };

    return () => source.close(); // cleanup on unmount
  }, [categoryId, queryClient]);
}
```

### Step 13.2 — SlotPicker Component

```typescript
// frontend/components/operator/slot-picker.tsx
'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSlotStream } from '@/hooks/use-slot-stream';
import { apiClient } from '@/lib/api';

export function SlotPicker({ categoryId, tripId, onSlotLocked }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['slots', categoryId],
    queryFn: () => apiClient(`/slots/category/${categoryId}`),
    staleTime: 5_000,
  });

  useSlotStream(categoryId); // opens SSE connection for live updates

  const { mutate: lockSlot, isPending: isLocking } = useMutation({
    mutationFn: (slotId: string) =>
      apiClient(`/slots/${slotId}/lock`, {
        method: 'POST',
        body: JSON.stringify({ tripId }),
      }),
    onSuccess: (lockData) => {
      queryClient.setQueryData(['slots', categoryId], (old: any) => ({
        ...old,
        slots: old.slots.map(s =>
          s.id === lockData.featuredSlotId
            ? { ...s, status: 'SOFT_LOCKED', isMyLock: true, lockExpiresAt: lockData.expiresAt }
            : s
        ),
      }));
      onSlotLocked({ slotId: lockData.featuredSlotId, expiresAt: lockData.expiresAt });
    },
    onError: (error: any) => {
      if (error.statusCode === 409) {
        toast.error('Slot just taken. Refreshing...');
        queryClient.invalidateQueries({ queryKey: ['slots', categoryId] });
      }
    },
  });

  if (isLoading) return <SlotPickerSkeleton />;

  if (data.slots.every(s => s.status === 'HARD_RESERVED')) {
    return <AllSlotsTakenView categoryId={categoryId} tripId={tripId} />;
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {data.slots.map(slot => (
        <SlotCard
          key={slot.id}
          slot={slot}
          onReserve={() => lockSlot(slot.id)}
          isLocking={isLocking}
        />
      ))}
    </div>
  );
}
```

### Step 13.3 — TTL Countdown Component

```typescript
// frontend/components/operator/ttl-countdown.tsx
'use client';
import { useEffect, useState } from 'react';

export function TTLCountdown({ expiresAt, onExpired }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    if (remaining <= 0) { onExpired(); return; }

    const interval = setInterval(() => {
      const secs = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0) { clearInterval(interval); onExpired(); }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <div className={remaining < 120 ? 'text-red-500' : 'text-amber-600'}>
      ⏱ {mm}:{ss}
    </div>
  );
}
```

---

## Phase 14 — Frontend: Trip Creation Wizard

### Step 14.1 — Wizard State with `useReducer`

```typescript
// frontend/app/(operator)/operator/trips/new/page.tsx
'use client';
import { useReducer } from 'react';

type WizardState = {
  step: number;
  details: Partial<TripDetailsForm>;
  pricing: Partial<TripPricingForm>;
  photos: string[];
  visibilityType: 'standard' | 'featured';
  selectedSlot: { slotId: string; rank: number; expiresAt: string } | null;
};

type WizardAction =
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'SET_DETAILS'; payload: TripDetailsForm }
  | { type: 'SET_PRICING'; payload: TripPricingForm }
  | { type: 'SET_VISIBILITY'; payload: 'standard' | 'featured' }
  | { type: 'SET_SLOT'; payload: WizardState['selectedSlot'] }
  | { type: 'SLOT_EXPIRED' };

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'NEXT_STEP':    return { ...state, step: state.step + 1 };
    case 'PREV_STEP':    return { ...state, step: state.step - 1 };
    case 'SET_DETAILS':  return { ...state, details: action.payload };
    case 'SET_PRICING':  return { ...state, pricing: action.payload };
    case 'SET_VISIBILITY': return { ...state, visibilityType: action.payload };
    case 'SET_SLOT':     return { ...state, selectedSlot: action.payload, step: state.step + 1 };
    case 'SLOT_EXPIRED': return { ...state, selectedSlot: null, step: 4 }; // back to slot picker
    default: return state;
  }
}

export default function NewTripPage() {
  const [state, dispatch] = useReducer(wizardReducer, {
    step: 0,
    details: {},
    pricing: {},
    photos: [],
    visibilityType: 'featured',
    selectedSlot: null,
  });

  const steps = {
    0: <DetailsStep data={state.details}
          onNext={d => { dispatch({ type: 'SET_DETAILS', payload: d }); dispatch({ type: 'NEXT_STEP' }); }} />,
    1: <PricingStep data={state.pricing}
          onNext={d => { dispatch({ type: 'SET_PRICING', payload: d }); dispatch({ type: 'NEXT_STEP' }); }} />,
    2: <PhotosStep onNext={() => dispatch({ type: 'NEXT_STEP' })} />,
    3: <VisibilityStep
          onNext={v => { dispatch({ type: 'SET_VISIBILITY', payload: v }); dispatch({ type: 'NEXT_STEP' }); }} />,
    4: state.visibilityType === 'featured'
      ? <SlotPickerStep
          categoryId={state.details.categoryId}
          tripId={state.details.tripId}
          onSlotLocked={s => dispatch({ type: 'SET_SLOT', payload: s })}
          onSkip={() => { dispatch({ type: 'SET_VISIBILITY', payload: 'standard' }); dispatch({ type: 'NEXT_STEP' }); }}
        />
      : <ReviewStep state={state} onSlotExpired={() => dispatch({ type: 'SLOT_EXPIRED' })} />,
    5: <ReviewStep state={state} onSlotExpired={() => dispatch({ type: 'SLOT_EXPIRED' })} />,
  };

  return (
    <WizardLayout step={state.step} isFeatured={state.visibilityType === 'featured'}>
      {steps[state.step]}
    </WizardLayout>
  );
}
```

---

## Phase 15 — Edge Cases Implementation

### EC-01: All Slots Taken — Waitlist View

In `SlotPicker`, if `data.slots.every(s => s.status === 'HARD_RESERVED')` → render `AllSlotsTakenView`:
- Shows all 3 slot cards as taken with estimated wait times from `GET /api/v1/waitlist/eta/:categoryId`
- "Join queue" button per slot → calls `POST /api/v1/waitlist/join`

### EC-02: Race Condition Recovery

When `POST /trips/:id/publish` returns `{ statusCode: 409, code: 'SLOT_TAKEN' }`:
- Show `RaceConditionModal` overlaid on the wizard (do NOT navigate away)
- Options: "Pick again" → `dispatch({ type: 'SET_SLOT', payload: null })` + `PREV_STEP`, "Publish as standard", "Join waitlist"

### EC-03: TTL Expired Mid-Wizard

**Path A — SSE event:** `useSlotStream` receives `slot.released` for the operator's current slot. Detect `isMyLock`, call `dispatch({ type: 'SLOT_EXPIRED' })` + show toast.

**Path B — Server 410:** Publish mutation `onError` catches `error.statusCode === 410` → same dispatch.

`SLOT_EXPIRED` reducer action: clears `selectedSlot`, sets `step = 4` (back to slot picker).

### EC-04: Editing a Live Trip

```typescript
{trip.status === 'LIVE' && (
  <Banner variant="warning">
    Changes save immediately to the live listing.
  </Banner>
)}
```

Backend `PATCH /trips/:id`: allows content edits on LIVE trips. Blocks `categoryId` change if slot is held.

### EC-05: Pre-Departure Window

BullMQ job scheduled on `TripSchedule` creation, fires at `schedule.date - 24h`. Worker activates last-minute badges, optionally blocks new bookings.

### EC-06: Operator Pauses or Archives Trip

`POST /trips/:id/pause` or `DELETE /trips/:id` → backend calls `SlotsService.releaseSlot(featuredSlotId, 'operator_released')` → triggers waitlist offer flow automatically.

### EC-07: Waitlist Offer Banner

Poll `GET /api/v1/waitlist/my-entries` every 60 seconds on the operator dashboard. Show banner for any entry with `status === 'OFFERED'`:

```typescript
{pendingOffers.map(offer => (
  <OfferBanner
    key={offer.id}
    timeLeft={<TTLCountdown expiresAt={offer.offerExpiresAt} onExpired={refetch} />}
    onClaim={() => claimOffer(offer.id)}
    onPass={() => passOffer(offer.id)}
  />
))}
```

---

## Implementation Order (Suggested)

```
Week 1:  Phase 0 scaffold + Phase 1 + 2 + 3
         → Resolve gaps G1, G2, G8, G11 before migrating schema.
           Auth works (sign up, sign in, session) on NestJS backend.
           Frontend can sign in and get session. Schema migrated + seeded.

Week 2:  Phase 4 (all sub-modules: Categories, Upload, Operators, Trips, Reviews, Bookings, Payments, Wishlist)
         → Resolve gaps G3, G4, G5, G10 during this phase.
           Operator can apply, get approved, create and publish draft trips.
           Upload endpoint working. Webhooks stubbed.

Week 3:  Phase 5 (Slot Economy)
         → Soft-lock, hard-reserve, release. Test race condition manually with two tabs.

Week 4:  Phase 6 + 7 (Waitlist + BullMQ)
         → Full slot lifecycle: lock → publish → TTL → waitlist → offer → claim.
           Resolve gap G6 (skipPaid stub).

Week 5:  Phase 8 (SSE)
         → Resolve gap G12 (polling vs. SSE for offer notifications).
           Slot picker shows live updates. Test with two browser windows.

Week 6:  Phase 9 + 10 + 11 (Frontend base + auth + traveler pages)
         → Homepage, search, trip detail visible. Auth client working.
           Resolve gap G9 (become-operator page).

Week 7:  Phase 12 + 13 + 14 (Operator dashboard + slot picker + creation wizard)
         → Full 6-step trip creation wizard with slot picker.

Week 8:  Phase 15 (Edge cases)
         → Race condition modal, TTL expiry recovery, waitlist offer banner.

Week 9:  Phase 16 (Notifications — currently missing entirely)
         → Email templates, MailService, wired into all trigger points.

Week 10: Phase 17 + 18 (Admin panel frontend + Wishlist)
         → Admin can manage operators, trips, slots. Wishlist heart button on trip cards.

Post-MVP: Payment gateway integration (Stripe checkout sessions), chat system,
          payout system, push notifications, analytics heatmaps.
```

---

## Critical Rules — Never Break These

1. **Better Auth lives on NestJS only.** The frontend never runs `betterAuth()`. It only uses `createAuthClient()` pointing to the backend.

2. **CORS must have `credentials: true`.** Without this, the session cookie is stripped on cross-origin requests and no session will ever validate.

3. **Better Auth table names stay lowercase.** `@@map("user")`, `@@map("session")`, `@@map("account")`, `@@map("verification")` — do not change these or Better Auth's Prisma adapter breaks.

4. **Only one Prisma instance.** The backend owns all database access. The frontend has no `prisma/` folder and no `DATABASE_URL`.

5. **BullMQ must use `ioredis` with a TCP Redis URL** (`redis://` or `rediss://`). Never the Upstash HTTP REST client — it doesn't support the Redis commands BullMQ needs.

6. **Two separate Redis connections for pub/sub.** One for `subscribe` mode (`SlotEventsService`), one for `publish` (`SlotsService`). A subscribed connection cannot send other commands.

7. **FeaturedSlot rows are permanent.** Never DELETE them. Only UPDATE status, tripId, acquiredAt, expiresAt. Always create exactly 3 per category at category creation time.

8. **The publish race condition guard must be a `WHERE status = 'SOFT_LOCKED'` conditional UPDATE.** If `updateMany.count === 0` → return 409. This is the only safe way to prevent two operators from hard-reserving the same slot simultaneously.

9. **Never let the frontend set user roles.** Role changes (to `OPERATOR` or `ADMIN`) must only happen via protected backend endpoints with `@Roles(Role.ADMIN)`.

10. **Store BullMQ job IDs.** Store `bullJobId` on `SlotLock` and `offerJobId` on `WaitlistEntry` so jobs can be cancelled when no longer needed (operator publishes before TTL, operator claims before 24h window closes).

11. **Webhook endpoints bypass `AuthGuard`.** Payment provider webhooks (`/webhooks/stripe`, etc.) are not browser requests — they have no session cookie. Verify them with gateway signatures instead, not auth guards.

12. **Wishlist model must be added before the first migration.** Adding it after `prisma migrate dev --name init` will require a new migration and could conflict with existing data in development.

---

## Phase 16 — Notifications

> **[Gap G7]** This entire phase is specified in `PROJECT_SCOPE.md` but was absent from this guide. Implement after Phase 15.

### Step 16.1 — Mail Service

`backend/src/mail/`

Install: `pnpm add nodemailer && pnpm add -D @types/nodemailer`

**`mail.service.ts`** base method:

```typescript
// backend/src/mail/mail.service.ts
import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST ?? 'smtp.gmail.com',
    port: 587,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  async sendEmail(to: string, subject: string, html: string) {
    await this.transporter.sendMail({
      from: `"Island Tours" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
  }
}
```

**`mail.module.ts`** — export `MailService` with `isGlobal: true` so any module can inject it.

### Step 16.2 — Email Templates

Add template methods to `MailService`. Each method composes an HTML string and calls `sendEmail()`.

| Method | Trigger | Recipient |
|---|---|---|
| `sendCredentials(email, name, tempPassword)` | New guest account created on booking | Customer (USER) |
| `sendBookingConfirmation(email, booking)` | Booking confirmed (payment webhook) | Customer + Operator + Admin |
| `sendBookingCancellation(email, booking)` | Booking cancelled | Customer + Operator + Admin |
| `sendSlotOffer(email, slotInfo, expiresAt)` | Waitlist slot offered | Operator |
| `sendSlotOfferExpired(email)` | Offer not claimed in 24h | Operator |
| `sendSlotCapExpired(email)` | 90-day hard-reserve ended | Operator |
| `sendPasswordReset(email, resetLink)` | Forgot password flow | Customer / Operator |

Keep HTML templates minimal for now (plain-text-like HTML). Swap in a proper template engine (MJML, React Email) post-MVP.

### Step 16.3 — Wire MailService into Trigger Points

| Trigger location | Method to call |
|---|---|
| `BookingsService.createGuestAccount()` | `mailService.sendCredentials()` |
| `BookingsService.confirm()` | `mailService.sendBookingConfirmation()` (to traveler, operator, admin) |
| `BookingsService.cancel()` | `mailService.sendBookingCancellation()` |
| `WaitlistService.offerSlot()` | `mailService.sendSlotOffer()` |
| `WaitlistOfferProcessor` (expire-offer job) | `mailService.sendSlotOfferExpired()` |
| `SlotTtlProcessor` (expire-cap job) | `mailService.sendSlotCapExpired()` |

### Step 16.4 — Push Notifications (Stub)

Push notification provider is TBD (Firebase or equivalent). Create a stub that logs to console in development and can be swapped for a real provider later.

```typescript
// backend/src/push/push.service.ts
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  async sendPush(userId: string, title: string, body: string) {
    // TODO: replace with Firebase Admin SDK or equivalent
    this.logger.log(`Push → ${userId}: ${title} — ${body}`);
  }
}
```

### Step 16.5 — Notification Config (Admin Control)

Add a simple `notification_config` table or use a JSON config stored in the database. Admin panel (Phase 17) exposes toggles for each notification type.

For MVP, use a simple boolean flag per notification type stored in a `SystemConfig` table:

```prisma
model SystemConfig {
  key       String  @id
  value     String
  updatedAt DateTime @updatedAt

  @@map("system_config")
}
```

Seeded with defaults: `email_booking_confirmation=true`, `email_slot_offer=true`, etc.

`MailService.sendEmail()` checks the config before sending.

---

## Phase 17 — Admin Panel Frontend

### Step 17.1 — Admin Dashboard Page

```typescript
// frontend/app/(admin)/admin/dashboard/page.tsx
// Server Component — fetch aggregated stats server-side

export default async function AdminDashboard() {
  const stats = await fetch(
    `${process.env.BACKEND_API_URL}/admin/analytics`,
    { headers: Object.fromEntries(await headers()), cache: 'no-store' },
  ).then(r => r.json());

  return (
    <>
      <KpiCard label="Total Operators" value={stats.operatorCount} />
      <KpiCard label="Live Trips" value={stats.liveTrips} />
      <KpiCard label="Bookings Today" value={stats.bookingsToday} />
      <KpiCard label="Revenue (MTD)" value={stats.revenueMtd} />
      <RecentBookingsFeed bookings={stats.recentBookings} />
    </>
  );
}
```

Backend: add `GET /api/v1/admin/analytics` — `@Roles(Role.ADMIN)` — returns aggregated counts and recent activity.

### Step 17.2 — Operators Management Page

```typescript
// frontend/app/(admin)/admin/operators/page.tsx
'use client';
```

- `useQuery(['admin-operators'])` → `GET /api/v1/admin/operators` — all operators with status badges
- Approve button → `PATCH /api/v1/operators/:id/approve`
- Suspend button → `PATCH /api/v1/admin/operators/:id/suspend` (sets `User.status = SUSPENDED`)
- Ban button → `PATCH /api/v1/admin/operators/:id/ban` (sets `User.status = DELETED`, revokes session)

Backend: add `PATCH /api/v1/admin/operators/:id/suspend` and `PATCH /api/v1/admin/operators/:id/ban` — both `@Roles(Role.ADMIN)`.

### Step 17.3 — Trips Moderation Page

- `useQuery(['admin-trips'])` → `GET /api/v1/admin/trips` — all trips across all operators
- Force-pause button → `POST /api/v1/admin/trips/:id/force-pause`
- Force-archive button → `POST /api/v1/admin/trips/:id/force-archive`

> If you chose `PENDING_REVIEW` in Gap G2 Option B, add an **Approve** button here: `POST /api/v1/admin/trips/:id/approve` — sets status from `PENDING_REVIEW` to `LIVE`.

Backend: add `POST /api/v1/admin/trips/:id/force-pause` and `force-archive` — both `@Roles(Role.ADMIN)` — call `SlotsService.releaseSlot()` if the trip held a featured slot.

### Step 17.4 — Slots Management Page

- Fetch all categories → for each, show 3 slot cards with current holder, `expiresAt`, waitlist depth
- Admin override button → `POST /api/v1/admin/slots/:id/override` — force-releases the slot (use with caution; add confirmation modal)
- Waitlist viewer per slot → expandable drawer showing all WAITING entries in FIFO order

Backend: add `GET /api/v1/admin/slots` — returns all FeaturedSlot rows grouped by category; add `POST /api/v1/admin/slots/:id/override` — calls `SlotsService.releaseSlot(id, 'admin_override')`.

### Step 17.5 — Analytics Page (Post-MVP)

Defer heatmaps and slot fill rate charts to after core admin features. Placeholder page with "Analytics coming soon" is sufficient for MVP.

---

## Phase 18 — Wishlist

### Step 18.1 — Backend (already specified in Phase 4.5c)

Ensure `WishlistModule` is imported in `AppModule` and `WishlistService` is fully tested:

- `add()` is idempotent (upsert) — calling it twice does not create duplicate rows
- `remove()` returns gracefully if the row does not exist (no 404)
- `getAll()` joins the `Trip` data so the frontend can render trip cards directly

### Step 18.2 — Wishlist Button Component

```typescript
// frontend/components/wishlist-button.tsx
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { Heart } from 'lucide-react';

export function WishlistButton({ tripId }: { tripId: string }) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const { data: wishlist } = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => apiClient<{ items: { tripId: string }[] }>('/wishlist'),
    enabled: !!session,
  });

  const isWishlisted = wishlist?.items.some(w => w.tripId === tripId) ?? false;

  const { mutate: toggle } = useMutation({
    mutationFn: () => isWishlisted
      ? apiClient(`/wishlist/${tripId}`, { method: 'DELETE' })
      : apiClient('/wishlist', { method: 'POST', body: JSON.stringify({ tripId }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wishlist'] }),
  });

  if (!session) return null; // guests can't wishlist

  return (
    <button onClick={() => toggle()} aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}>
      <Heart className={isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-400'} />
    </button>
  );
}
```

Place `<WishlistButton tripId={trip.id} />` on trip cards (category browse) and the trip detail page hero.

### Step 18.3 — Wishlist Page (Operator/User Dashboard)

```typescript
// frontend/app/(operator)/operator/wishlist/page.tsx  (or equivalent user route)
'use client';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export default function WishlistPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => apiClient('/wishlist'),
  });

  if (isLoading) return <WishlistSkeleton />;
  if (!data?.items?.length) return <p>No saved trips yet.</p>;

  return (
    <div className="grid grid-cols-3 gap-6">
      {data.items.map(item => (
        <TripCard key={item.tripId} trip={item.trip} />
      ))}
    </div>
  );
}
```
