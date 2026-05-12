# Island Tours — CLAUDE.md

> Quick reference for Claude Code. Full specs live in the companion docs:
> `PROJECT_SCOPE.md` · `ARCHITECTURE_OVERVIEW.md` · `IMPLEMENTATION_GUIDE.md` · `DEEP_DIVE_QA.md`
> Technical design decisions: `Technical-doc/` directory

---

## What This Project Is

Caribbean tour marketplace. **Operators** list trips and compete for 3 featured slots per category (tiered commissions: 22% / 25% / 30%). **Travelers** browse and book instantly — no 24h enquiry model. **Admins** manage the platform.

Two distinctive features:
1. **Slot economy**: soft-lock (15 min) → publish (race-condition guarded) → hard-reserve (90 days) → waitlist FIFO
2. **Multilingual**: 7 locales from launch (EN primary) with locale-aware routing, slug registry, and translations table

Platform covers Caribbean destinations only (Curaçao, Aruba, Sint Maarten, etc.). Admins control destinations, categories, and hubs. Operators control tours within those structures.

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
│   │   ├── auth/
│   │   │   ├── auth.instance.ts   ← Better Auth singleton + authPrismaClient export
│   │   │   ├── auth.module.ts     ← ThrottlerModule + all 4 APP_GUARDs + OnModuleDestroy
│   │   │   ├── auth.controller.ts ← mounts /api/auth/* via toNodeHandler (@Public())
│   │   │   ├── auth.types.ts      ← AuthenticatedRequest, TypedAuthUser
│   │   │   ├── guards/
│   │   │   │   ├── auth.guard.ts
│   │   │   │   ├── roles.guard.ts
│   │   │   │   └── permissions.guard.ts
│   │   │   └── decorators/
│   │   │       ├── public.decorator.ts
│   │   │       ├── roles.decorator.ts
│   │   │       ├── require-permissions.decorator.ts
│   │   │       └── authenticated-user.decorator.ts
│   │   ├── common/
│   │   │   ├── dto/
│   │   │   │   └── error-responses.dto.ts ← shared Swagger error DTOs (400/401/403/404/409/500)
│   │   │   ├── filters/
│   │   │   │   └── http-exception.filter.ts
│   │   │   └── utils/
│   │   │       └── parse-cors-origins.ts  ← shared CORS origin parser
│   │   ├── users/                         ← user + operator management (Phase 3) ✓ done
│   │   │   ├── dto/user.dto.ts
│   │   │   ├── user.swagger.ts
│   │   │   ├── user.service.ts
│   │   │   ├── user.controller.ts
│   │   │   └── user.module.ts
│   │   └── prisma/
│   │       ├── prisma.module.ts   ← @Global() — inject PrismaService anywhere
│   │       └── prisma.service.ts  ← extends PrismaClient with PrismaPg adapter
│   ├── prisma/                    ← split schema (one file per domain)
│   │   ├── schema.prisma
│   │   ├── enums.prisma
│   │   ├── user.prisma
│   │   ├── operator.prisma
│   │   ├── categories.prisma
│   │   ├── trips.prisma
│   │   ├── featured-slots.prisma
│   │   ├── bookings.prisma
│   │   └── migrations/
│   ├── prisma.config.ts
│   ├── .env
│   └── package.json
│
├── frontend/         ← Next.js 16, App Router — UI only, no auth logic, no DB
│   ├── src/
│   │   ├── app/
│   │   │   └── [locale]/              ← locale-aware root (next-intl)
│   │   │       ├── layout.tsx
│   │   │       ├── page.tsx           ← Homepage
│   │   │       └── [destination]/
│   │   │           ├── page.tsx       ← Destination page
│   │   │           ├── tours/
│   │   │           │   └── page.tsx   ← All Tours (reserved slug)
│   │   │           └── [slug]/
│   │   │               ├── page.tsx   ← Dynamic: Category | Hub | Tour (slug registry)
│   │   │               └── [tourSlug]/
│   │   │                   └── page.tsx ← Hub-anchored tour only
│   │   ├── components/
│   │   │   ├── tour-detail/           ← Breadcrumbs, RatingRow, ImageGallery, BookingWidget/...
│   │   │   ├── hub/                   ← HubTabs, ComparisonTable, OurPick, PrivateCharter
│   │   │   ├── listing/               ← TourCard, FilterBar, SortControl
│   │   │   └── shared/                ← Navbar, Footer, Lightbox
│   │   ├── lib/
│   │   │   ├── slug-registry.ts       ← resolveSlug, slugExists, generateUniqueSlug
│   │   │   ├── api/                   ← tours.ts, availability.ts, translations.ts
│   │   │   └── formatters/            ← duration.ts, price.ts, date.ts
│   │   └── i18n/
│   │       ├── config.ts              ← locales list, defaultLocale
│   │       ├── routing.ts
│   │       └── messages/              ← en.json, es.json, nl.json, pt.json, fr.json, de.json, zh.json
│   ├── middleware.ts                  ← next-intl locale detection
│   ├── .env.local
│   └── package.json
│
├── .claude/
│   └── agents/
│       ├── security-code-reviewer.md
│       ├── solid-dry-reviewer.md
│       ├── e2e-test-writer.md
│       └── test-writer.md
├── package.json      ← root: concurrently scripts only, no shared code
├── CLAUDE.md
└── .gitignore
```

No `packages/` folder. No `turbo.json`. No pnpm workspaces. Each app manages its own `node_modules`.

---

## Running the Project

```bash
pnpm dev              # both apps at once (recommended)
pnpm dev:backend      # NestJS on http://localhost:5050
pnpm dev:frontend     # Next.js on http://localhost:3000

pnpm build
pnpm install:all
pnpm lint
pnpm test:backend
pnpm test:e2e

# Prisma (run from root or backend)
pnpm prisma:generate         # regenerate client after schema changes
pnpm prisma:migrate          # create + apply a migration (dev)
pnpm prisma:migrate:deploy   # apply pending migrations (production)
pnpm prisma:migrate:reset    # reset DB and re-apply all migrations (dev only)
pnpm prisma:studio
pnpm prisma:format
```

---

## Environment Setup

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

Frontend `.env.local` has NO secrets — no DATABASE_URL, no auth secrets. Those all live on the backend.

### Backend env variables

| Variable | Required | Notes |
|---|---|---|
| `PORT` | Yes | Default `5050` |
| `NODE_ENV` | Yes | `development` / `production` |
| `FRONTEND_URL` | Yes | Validated at startup |
| `CORS_ORIGINS` | Yes | Comma-separated trusted origins |
| `DATABASE_URL` | Yes | Postgres |
| `BETTER_AUTH_SECRET` | Yes | Min 32 chars |
| `BETTER_AUTH_URL` | Yes | Backend public URL |
| `ADMIN_EMAIL` | Seeding only | Not validated at startup |
| `ADMIN_PASSWORD` | Seeding only | Min 12 chars, placeholder rejected |
| `REDIS_URL` | Phase 5 | BullMQ + pub/sub (TCP ioredis) |
| `EMAIL_*` | Phase 16 | Nodemailer SMTP |
| `CLOUDINARY_*` | Phase 4 | File uploads |
| `GOOGLE_CLIENT_*` | Phase 3 | OAuth |
| `REVALIDATION_SECRET` | Frontend | On-demand ISR revalidation key |

---

## Tech Stack

| Layer | Tool | Notes |
|---|---|---|
| Backend framework | NestJS 11 | Strict TypeScript |
| Frontend framework | Next.js 16 | App Router, ISR, Server + Client Components |
| i18n | next-intl | Locale routing + static string translations |
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
| Rate limiting | `@nestjs/throttler` | Global guard |
| Validation | `class-validator` + `class-transformer` | Global `ValidationPipe` — whitelist + forbidNonWhitelisted |
| Env loading | `dotenv` | `import 'dotenv/config'` — first line of `main.ts` |

---

## Platform Entities — Who Controls What

| Entity | Create | Notes |
|---|---|---|
| Destinations | Admin only | Caribbean islands; pre-seeded at launch; `is_seeded` flag protects from accidental delete |
| Categories | Admin only | **Global** (not destination-specific) — one category available across all destinations automatically |
| Hubs | Admin only | **Destination-specific** — Klein Curaçao-style activity hubs; destination is mandatory on create |
| Tours | Operators | Operator picks Destination → Category → Hub (optional, conditional on `hub_allowed_categories`) |
| Featured slot | Operators | Via slot economy — lockSlot → publishTrip |
| Top Island Experiences | Admin | Categories and Hubs only — never individual tours |
| Page editorial content | Admin | About text, FAQ per destination/category/hub combination |

**Category create → automatic slug_registry rows for all active destinations.**
**Hub create → 1 slug_registry row for its destination.**
**Destination-only tour create → 1 slug_registry row.**
**Hub-anchored tour create → NO slug_registry row** (URL structure `[slug]/[tourSlug]` is sufficient).

---

## Frontend URL Architecture

```
/{locale}/{destination}/                          → Destination page
/{locale}/{destination}/tours/                    → All Tours (reserved slug)
/{locale}/{destination}/{slug}/                   → Dynamic: Category | Hub | Tour
/{locale}/{destination}/{hub-slug}/{tour-slug}/   → Hub-anchored Tour
```

**Examples:**
```
/en/curacao/                              → Curaçao destination page
/en/curacao/tours/                        → All tours in Curaçao
/en/curacao/boat-tours/                   → Boat Tours category
/en/curacao/klein-curacao/                → Klein Curaçao hub
/en/curacao/sunset-cruise-bluefinn/       → Destination-only tour
/en/curacao/klein-curacao/miss-ann/       → Hub-anchored tour
/es/curacao/klein-curacao/miss-ann/       → Same tour, Spanish locale
```

**Slug rules:**
- Slugs are always English — never translated
- Same destination: same slug cannot be used by two entities (UNIQUE constraint on `destination_slug + slug`)
- Different destinations: same slug is allowed
- `tours` slug is reserved at every destination (seeded as `entity_type: 'reserved'`)

**middleware.ts:**
```typescript
import createMiddleware from 'next-intl/middleware';
export default createMiddleware({
  locales: ['en', 'es', 'nl', 'pt', 'fr', 'de', 'zh'],
  defaultLocale: 'en',
  localePrefix: 'always',  // /curacao/ alone won't work — redirects to /en/curacao/
});
export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
```

---

## Slug Registry — How It Works

The `[slug]` URL segment is ambiguous — it could be a category, hub, or destination-only tour. The slug registry resolves it.

```sql
slug_registry (
  id                SERIAL PRIMARY KEY,
  destination_slug  VARCHAR(100) NOT NULL,  -- 'curacao'
  slug              VARCHAR(100) NOT NULL,  -- 'boat-tours'
  entity_type       VARCHAR(20)  NOT NULL,  -- 'category' | 'hub' | 'tour' | 'collection' | 'reserved'
  entity_id         INTEGER,                -- NULL only for 'reserved'
  is_active         BOOLEAN DEFAULT true,
  UNIQUE (destination_slug, slug)
)
```

**Dynamic page resolver** (`app/[locale]/[destination]/[slug]/page.tsx`):
```typescript
const entity = await resolveSlug(destination, slug);
switch (entity.entity_type) {
  case 'hub':      return <HubPage hubId={entity.entity_id} locale={locale} />;
  case 'category': return <CategoryPage categoryId={entity.entity_id} locale={locale} />;
  case 'tour':     return <TourDetailPage tourId={entity.entity_id} locale={locale} />;
  case 'reserved': redirect(`/${locale}/${destination}/tours/`);
  default:         notFound();
}
```

**Hub-anchored tour resolver** (`app/[locale]/[destination]/[slug]/[tourSlug]/page.tsx`):
```typescript
const hubEntry = await resolveSlug(destination, slug);
if (!hubEntry || hubEntry.entity_type !== 'hub') notFound();
const tour = await db.tours.findFirst({ where: { slug: tourSlug, hub_id: hubEntry.entity_id } });
if (!tour) notFound();
return <TourDetailPage tourId={tour.id} locale={locale} />;
```

**`is_active = false`** when tour/category is disabled — slug row stays (protects the slug), page returns 404.

---

## Multilingual Strategy — 7 Languages

**Locales:** `en` (primary), `es`, `nl`, `pt`, `fr`, `de`, `zh` — all active from launch.

**Fallback rule:** Missing translation → English content + "Translated" badge in UI.

**Currency:** EN/NL/DE/FR/ES/PT → EUR; ZH → USD. Auto-set from locale, no user selector.

### Static UI strings → `next-intl` + `i18n/messages/*.json`
Buttons, labels, error messages, CTAs. Never hardcode English strings in components.
```typescript
const t = useTranslations('booking.cta');
return <button>{t('check_availability')}</button>;
```

### Dynamic content → `translations` database table (EAV pattern)
Tour names, overviews, highlights, FAQ, category about-text — all per entity+locale.

```sql
translations (
  id, entity_type, entity_id, locale, field, value,
  is_machine_translated BOOLEAN,
  UNIQUE (entity_type, entity_id, locale, field)
)
-- entity_type: 'tour' | 'destination' | 'category' | 'hub'
-- field: 'overview' | 'highlights' | 'h1_override' | 'breadcrumb_label' | 'name' | 'about_text'
```

**Fetch pattern:** single query with `locale: { in: [locale, 'en'] }`, then merge (requested locale wins):
```typescript
const translations = await db.translations.findMany({
  where: { entity_type: 'tour', entity_id: tour.id, locale: { in: [locale, 'en'] } }
});
// Merge: requested locale wins, English fallback
```

**Array fields** (highlights, inclusions) need child translation tables:
```sql
tour_highlights (id, tour_id, display_order)
tour_highlight_translations (id, highlight_id, locale, text, is_machine_translated)
```

**AI translation:** Background job (BullMQ) triggers after English content saved. Translates to 6 locales, sets `is_machine_translated = true`. Destination/Hub names are proper nouns — never AI-translate, admin sets manually.

**On-demand revalidation** when admin updates content:
```typescript
const locales = ['en', 'es', 'nl', 'pt', 'fr', 'de', 'zh'];
locales.forEach(locale => revalidatePath(`/${locale}/${destination}/${slug}`));
```

**SEO:** Every page must have hreflang tags for all 7 locales + `x-default → English`.

**"Built by Islanders."** — brand tagline, hardcoded English everywhere, never translated:
```typescript
return <p lang="en">Built by Islanders.</p>;
```

---

## Rendering Strategy

| Content | Method | Revalidation |
|---|---|---|
| Page shell, H1, overview, structured data | SSR / ISR | 300 seconds (tour detail), 60s (All Tours) |
| Tour availability | Client-side fetch | On date-picker open only — never on page load |
| Booking widget | Client hydration (`requestIdleCallback` after LCP) | Per interaction |
| Static UI strings | Build-time (next-intl) | On deploy |
| Hreflang tags | SSR (head) | Per page |

---

## Performance Budgets — Hard Limits

| Metric | Target | Notes |
|---|---|---|
| LCP | < 2.5s | Hero image must have `priority={true}` + `<link rel="preload">` |
| INP (page) | < 200ms | Date chip clicks must give immediate visual feedback via `startTransition` |
| INP (booking widget) | < 100ms | Heavy price calc → Web Worker |
| CLS | < 0.05 | All elements need pre-defined heights before hydration |
| Image size | Max 200KB | After AVIF/WebP compression |

**Image requirements:**
- Format priority: AVIF → WebP → JPEG fallback (Next.js handles automatically with `formats: ['image/avif', 'image/webp']`)
- Hero source: min 2400×1800px, ratio 4:3
- Tile source: min 1200×1200px, ratio 1:1
- Filenames include content hash for CDN cache busting

---

## Tour Detail Page — Section Order & Locked Decisions

**Page sections (in order):**
1. Breadcrumbs — Hub-anchored: `Home › Dest › Hub › Tour` | Destination-only: `Home › Dest › Tour`
2. H1 — format: `{Destination or Hub} {Tour type} with {Host name}`, 35–55 chars target, 65 hard max
3. Rating row — 3 states: native ≥3 reviews | operator aggregate | hidden
4. Image gallery — min 5 images to publish, max 24
5. Quick-info badges — exactly 3: Duration, Pickup, Languages (no 4th badge ever)
6. Booking widget
7. Tour overview — 80–150 words, 200 hard max, paragraph breaks only
8. Highlights — 3–6 bullets, 5–15 words each
9. Inclusions
10. Itinerary
11. Meeting + Pickup
12. What to Bring
13. Know Before You Go
14. Accessibility
15. Languages
16. Cancellation Policy
17. About Your Hosts
18. Reviews
19. FAQ
20. Related Tours
21. Closing Trust Block (ends with "Built by Islanders.")

**Locked business decisions (cannot be changed):**

| # | Rule |
|---|---|
| LD1 | Cancellation default: free up to 24h before tour. Per-tour override allowed. |
| LD2 | CTA progression: "Check availability" → "Continue" → "Secure your spot" |
| LD3 | "Pickup" — no hyphen anywhere on platform. "Pick-up" is wrong. |
| LD4 | Email confirmation = entry pass. No QR code, no app, no mobile ticket. |
| LD5 | Trust strip exactly 4 lines: Free cancel 24h · Reserve from 20% · Confirmed in seconds · Chat 24/7 / WhatsApp 08:00-22:00 |
| LD6 | Closing trust block ends with: "Built by Islanders." |
| LD7 | Quick-info row = exactly 3 badges: Duration, Pickup, Languages. No listing-page badges here. |
| LD8 | Mobile breadcrumbs visible on tour detail page (differs from destination page). |
| LD9 | Banned words: paradise, luxury, exclusive, seamless, world-class, discover (verb), unlock, adventure-awaits, committed-to |
| LD11 | Provider Rating cold-start: <3 native reviews → show operator aggregate only if operator has ≥10 reviews AND ≥4.0 avg. Otherwise rating row hidden entirely. |
| LD12 | Total price visible before payment. All fees itemized. No hidden fees. |
| — | Instant confirmation only — no 24h enquiry model. |
| — | Add-ons never pre-checked (EU Digital Fairness Act). |

---

## Booking Widget — State Machine

```
S1 Initial    → price-from, date prompt, party selector, "Check availability", trust strip
S2 Date picker → 14-day horizontal chip row; "View all dates" → month overlay (live fetch)
S3 Date selected → time-slot chips (fetched on date select); party selector active
S4 Ready      → "Continue" CTA; total price calculated and visible
S5 Edge       → sold out, all dates sold out, API failure, offline
```

**Rules:**
- All transitions reversible
- Custom date picker mandatory — never `<input type="date">`
- Date chip states: `available | sold_out | closed_day | cutoff_passed | selected`
- Compact chips = cached (Redis, 5min TTL); month overlay = live API call
- Variant change (shared vs private) resets date + time (different inventory)
- Unit-priced tours: party counter is informational, total does not multiply
- `"Continue"` click → final availability check before proceeding → if sold out: show inline error, keep date, refresh time slots
- Cutoff passes during session: interval (every 60s) checks and auto-transitions today chip to "Closed"
- Age-banded pricing: Adults/Children/Infants each have own +/- row

---

## Tour Model — Key Fields

```
tour.pricing_model      enum: per_person | unit
tour.unit_type          enum (nullable): group | boat | vehicle | aircraft | package
tour.pickup_model       enum: included | paid_addon | none
tour.booking_cutoff_minutes  int, default 120, range 0–10080
tour.cancellation_hours int, default 24, per-tour override
tour.age_bands[]        nullable array (Adults/Children/Infants with own prices)
tour.add_ons[]          nullable; EU Digital Fairness Act: never pre-checked
tour.max_party_size / min_party_size  hard limits on booking widget +/- controls
tour.gallery_images[]   ordered; first = hero (is_hero: true); manual focal point per image
tour.overview_{locale}  markdown, paragraph breaks only — no headings/lists/bold
tour.highlights_{locale}[]  3–6 bullets, 5–15 words each
tour.h1_override        nullable string — overrides template-generated H1
tour.breadcrumb_label   short-form when H1 > 35 chars
tour.duration_minutes   drives duration badge formatter
tour.languages[]        language codes
```

**Hub page routing:**
- `tour.pricing_model = 'per_person'` → "Book now" tab on hub page
- `tour.pricing_model = 'unit'` → "Private charter" tab on hub page

**Pickup badge text:**
- `included` → "Pickup included"
- `paid_addon` → "Pickup available"
- `none` → "Meeting point only"

**Tour publish blocks:** <5 images, no hero image, overview empty, highlights <3.

---

## Backend Module Map

```
src/
├── auth/           Phase 3  ✓ done — Better Auth, guards, decorators
├── prisma/         Phase 2  ✓ done — PrismaService (global)
├── users/          Phase 3  ✓ done — user + operator management
├── upload/         Phase 4  — Cloudinary upload endpoint
├── categories/     Phase 4  — CRUD; auto-seeds 3 FeaturedSlot rows + slug_registry rows on create
├── operators/      Phase 4  — apply, approve, reject (OperatorProfile)
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

## Critical Rules — Never Break These

### 1. Better Auth lives on NestJS only
The frontend never runs `betterAuth()`. It only uses `createAuthClient()` pointing to `NEXT_PUBLIC_BACKEND_URL`. All session logic, OAuth callbacks, and user creation happen on the backend.

### 2. CORS must have `credentials: true`
Without this, the browser strips the `better-auth.session_token` cookie from cross-origin requests. Every session check fails silently.

Always use `parseCorsOrigins()` (from `@/common/utils/parse-cors-origins`) — use it in both `main.ts` and `auth.instance.ts` so allowed origin lists never drift.

```typescript
app.enableCors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('CORS: origin not allowed'));
  },
  credentials: true,
});
```

### 3. Better Auth table names stay lowercase
Do not rename these `@@map` values or the Prisma adapter breaks:
- `@@map("user")` · `@@map("session")` · `@@map("account")` · `@@map("verification")`

### 4. Only one Prisma instance
The backend owns all database access. The frontend has no `prisma/` folder and no `DATABASE_URL`. Never add Prisma to the frontend.

### 5. BullMQ must use ioredis with a TCP Redis URL
Use `redis://` or `rediss://` — never the Upstash HTTP REST client. BullMQ uses Redis commands unavailable over HTTP.

### 6. Two separate Redis connections for pub/sub
One for `subscribe` mode (`SlotEventsService`), a separate one for `publish` (`SlotsService`). A subscribed connection cannot send other commands.

### 7. FeaturedSlot rows are permanent
Never DELETE FeaturedSlot rows. Only UPDATE: `status`, `tripId`, `acquiredAt`, `expiresAt`. Every category always has exactly 3 rows (created on category create, never after).

### 8. Publish race condition — conditional UPDATE only
```typescript
prisma.featuredSlot.updateMany({
  where: { id: slotId, status: 'SOFT_LOCKED' },  // ← the guard
  data: { status: 'HARD_RESERVED', tripId, ... },
})
// count === 0 → another operator won → throw 409 { code: 'SLOT_TAKEN' }
```

### 9. Never let the frontend set user roles
Role changes must only happen through protected backend endpoints guarded with `@Roles(Role.ADMIN)`. Frontend must never send a `role` field in any request body.

### 10. Store BullMQ job IDs
Store `bullJobId` on `SlotLock` and `offerJobId` on `WaitlistEntry` to cancel them early when no longer needed.

### 11. Webhook endpoints bypass AuthGuard and ThrottlerGuard
Payment webhooks must be `@Public()` + `@SkipThrottle()`. Verify with gateway signatures instead.

### 12. Wishlist model must be added before the first migration
Define it in `bookings.prisma` before running the first migration.

### 13. Global ValidationPipe strips unknown fields
`whitelist: true` + `forbidNonWhitelisted: true`. Every request body must have a matching DTO class.

### 14. Rate limiting — ThrottlerGuard is global and runs first
Three tiers: 20 req/s · 300 req/min · 3 000 req/hr. Lives in `AuthModule` (not `AppModule`) — do not move it. Use in-memory storage until Phase 5, then swap to `@nest-lab/throttler-storage-redis`.

### 15. Use `@/` path alias for all internal imports
```typescript
import { PrismaClient } from '@prisma/client';  // ✅ exception — standard package
import { X } from '@/common/...';               // ✅ all other internal imports
```
Do not create a custom Prisma output location.

### 16. `role` must always be `input: false` in Better Auth additional fields
```typescript
// CORRECT
role: { type: 'string', defaultValue: Role.TOUR_OPERATOR, returned: true, input: false }
// WRONG — clients can self-assign any role
role: { type: 'string', defaultValue: Role.TOUR_OPERATOR, returned: true, input: true }
```

### 17. Admin seeding is always a two-step operation
```typescript
await auth.api.signUpEmail({ body: { email, password, name: 'System Admin' } });
await prisma.user.update({ where: { email }, data: { role: Role.ADMIN } });
```

### 18. Use `AuthenticatedRequest` and `TypedAuthUser` for typed guard/decorator access
```typescript
import type { AuthenticatedRequest, TypedAuthUser } from '@/auth/auth.types';
const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
```
Never inline `getRequest<{ user: { role: Role } }>()`.

### 19. Guards and decorators must keep instructional JSDoc with Usage examples
Guards and decorators are framework infrastructure. Preserve the JSDoc with What it does + Dependencies + Usage examples. Do not trim to a one-liner.

### 20. ADMIN role must be a strict superset of all lower roles
`ROLE_PERMISSIONS[Role.ADMIN]` must include every permission granted to `TOUR_OPERATOR` and `USER`. Check whenever `Permission` enum is extended.

### 21. Slug registry rows are transactional
Every entity creation (hub, category, destination-only tour) that writes to `slug_registry` must do so inside a Prisma transaction with the entity creation. Partial writes leave orphaned or missing rows.

### 22. Category create writes slug_registry rows for ALL active destinations
When creating a category, run `destinations.findMany({ where: { is_active: true } })` and insert one `slug_registry` row per destination in the same transaction.

### 23. Hub-anchored tours never write to slug_registry
If `hub_id` is set, skip the `slug_registry` insert. Only destination-only tours (`hub_id = null`) get a registry row.

---

## Slot Economy — Quick Reference

```
lockSlot() — Prisma transaction
  • Check FeaturedSlot.status === AVAILABLE (else 409)
  • Create SlotLock { expiresAt: +15min }
  • Update FeaturedSlot.status = SOFT_LOCKED
  • Write SlotHistory · Schedule BullMQ 'release-lock' job · Store bullJobId
  • Publish Redis event: slot.locked

publishTrip() — Prisma transaction
  • Conditional updateMany WHERE status='SOFT_LOCKED'   ← race condition guard
  • count === 0 → 409 SLOT_TAKEN
  • count === 1 → HARD_RESERVED, Trip=LIVE
  • Delete SlotLock · Cancel BullMQ job · Schedule 90-day cap job
  • Publish Redis event: slot.taken

releaseSlot() — Prisma transaction (90 days / pause / archive / manual)
  • FeaturedSlot → AVAILABLE, clear tripId/acquiredAt/expiresAt
  • Write SlotHistory · Publish Redis event: slot.released
  • Find first WAITING WaitlistEntry → offerSlot()

offerSlot()
  • WaitlistEntry → OFFERED, offeredAt=now, offerExpiresAt=+24h
  • Schedule BullMQ 'expire-offer' job · Send email to operator
```

---

## Three User Roles

| Role | Created by | Login | Key capability |
|---|---|---|---|
| USER | Auto-created on first booking (credentials emailed) | Email + password only | Browse, book, review |
| OPERATOR | Self-registration (email verification required) | Email/password or Google OAuth | Create trips, hold featured slots |
| ADMIN | Database seed only | Email + password only | Full platform management |

Operators inherit all USER capabilities. Admins inherit all USER + OPERATOR capabilities.

---

## Trip Lifecycle

```
DRAFT → LIVE ⇄ PAUSED → ARCHIVED
```
- **DRAFT** — not visible, operator can edit freely, can delete
- **LIVE** — visible to travelers, cannot change category while holding a slot
- **PAUSED** — hidden, featured slot auto-released and offered to waitlist
- **ARCHIVED** — permanent, featured slot auto-released

---

## API Conventions

- Base URL: `http://localhost:5050/api/v1`
- Auth endpoints: `http://localhost:5050/api/auth/*` (Better Auth, no `/v1`)
- Swagger docs: `http://localhost:5050/api/docs`
- All authenticated routes require the `better-auth.session_token` cookie
- Frontend always fetches with `credentials: 'include'`
- Error shape for slot conflicts: `{ statusCode: 409, code: 'SLOT_TAKEN' }`
- Error shape for expired lock: `{ statusCode: 410 }`

---

## Prisma Schema Layout

Split schema in `backend/prisma/` — Prisma 7 merges all `.prisma` files automatically.

```
prisma/
├── schema.prisma          ← generator + datasource (no url — in prisma.config.ts)
├── enums.prisma           ← all enums
├── user.prisma            ← User, Session, Account, Verification (Better Auth)
├── operator.prisma        ← OperatorProfile
├── categories.prisma      ← Category, SubCategory
├── trips.prisma           ← Trip, TripSchedule, TourImages, TourAgeBands, TourAddOns
├── featured-slots.prisma  ← FeaturedSlot, SlotLock, WaitlistEntry, SlotHistory
├── bookings.prisma        ← Booking, Review, Wishlist
└── migrations/
```

Additional tables needed (not yet in schema — add before migrating):
- `destinations` — id, name, slug, is_seeded, is_active, created_by
- `hubs` — id, destination_id, name, slug, is_active
- `hub_allowed_categories` — hub_id, category_id (which categories can go in which hub)
- `slug_registry` — destination_slug, slug, entity_type, entity_id, is_active
- `translations` — entity_type, entity_id, locale, field, value, is_machine_translated
- `page_content` — page_type, entity_id, locale, field, value
- `faqs` — page_type, entity_id, locale, question, answer, display_order
- `hub_our_picks` — hub_id, tour_id, pick_type, description, display_order
- `hub_comparison_groups` — hub_id, group_name, display_order
- `hub_comparison_tours` — group_id, tour_id, display_order
- `featured_experiences` — entity_type ('category'|'hub' only), entity_id, destination_id, video_url, display_order
- `tour_languages` — tour_id, language
- `tour_highlights` — tour_id, display_order + `tour_highlight_translations` — highlight_id, locale, text
- `tour_inclusions` — tour_id, icon, display_order + `tour_inclusion_translations` — inclusion_id, locale, label

`prisma.config.ts`:
```typescript
export default defineConfig({
  schema: 'prisma/',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
})
```

**`prisma generate` runs automatically** — prepended to `build`, `start`, `start:dev`, `start:debug`.
**`prisma.config.ts` excluded from TypeScript compilation** — both tsconfigs exclude it.

---

## Auth Module Architecture

### Guard execution order (do not reorder)
```
ThrottlerGuard        ← blocks rate-limited clients before any DB work
AuthGuard             ← validates session cookie/Bearer; populates request.user
RolesGuard            ← checks @Roles() metadata
PermissionsGuard      ← checks @RequirePermissions() metadata
```

### Key files

| File | Responsibility |
|---|---|
| `auth/auth.instance.ts` | Better Auth singleton; exports `auth`, `authPrismaClient`, `AuthSession`, `AuthUser` |
| `auth/auth.types.ts` | `AuthenticatedRequest`, `TypedAuthUser` |
| `auth/auth.module.ts` | ThrottlerModule; all 4 APP_GUARDs; disconnects `authPrismaClient` on shutdown |
| `auth/auth.controller.ts` | Mounts `/api/auth/*` via `toNodeHandler(auth)`; must have `@Public()` |
| `common/utils/parse-cors-origins.ts` | Shared CORS origin parser |

### Better Auth instance rules
- `authPrismaClient` is standalone from `PrismaService` — disconnected in `AuthModule.onModuleDestroy()`
- `minPasswordLength: 12`
- `openAPI()` plugin is dev-only — never expose in production
- `cookieCache.maxAge: 300s` — role/status changes take up to 5 min to propagate

---

## Module Code Patterns

Every new backend module follows `src/users/`. This is the authoritative reference.

### File structure
```
src/<module>/
├── dto/<module>.dto.ts      ← ALL DTOs: response, query, request
├── <module>.swagger.ts      ← one decorator function per endpoint
├── <module>.service.ts      ← all business logic
├── <module>.controller.ts   ← thin routing only
└── <module>.module.ts
```

### DTO conventions
Three categories in order: Response DTOs → Query DTOs → Request DTOs.

```typescript
// Response DTO — required fields with !
export class UserResponseDto {
  @ApiProperty({ example: '3fa85f64...' }) id!: string;
  @ApiProperty({ enum: Role, example: Role.TOUR_OPERATOR }) role!: Role;
}

// Paginated wrapper
export class PaginatedUsersResponseDto {
  @ApiProperty({ example: 42 })  total!: number;
  @ApiProperty({ example: 1 })   page!: number;
  @ApiProperty({ example: 20 })  limit!: number;
  @ApiProperty({ type: [UserResponseDto] }) data!: UserResponseDto[];
}

// Numeric query param
export class ThingQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;
}
```

Rules: `@ApiProperty` on every response DTO field with `example:`. `@ApiPropertyOptional` on optional fields. Numeric query params need `@Type(() => Number)`.

### Swagger conventions
```typescript
const commonErrors = [/* 400, 401, 500 */];
const adminErrors = [...commonErrors, /* 403 */];

export function ApiGetAllThingsDocs() {
  return applyDecorators(
    ApiOperation({ summary: '...' }),
    ApiResponse({ status: 200, type: PaginatedThingsResponseDto }),  // always type:, never schema:
    ...adminErrors,
  );
}
```
`404` always uses `type: NotFoundErrorDto`. Import error DTOs from `@/common/dto/error-responses.dto`.

### Controller conventions
```typescript
@ApiTags('Things')
@Controller('things')
export class ThingController {
  // Static routes BEFORE dynamic (:id) routes — NestJS matches top-to-bottom
  @Get('export') @RequirePermissions(Permission.EXPORT_DATA) export() { ... }
  @Get(':id')    @RequirePermissions(Permission.VIEW_CONTENT) getById(@Param('id') id: string) { ... }
}
```
- `import type { TypedAuthUser }` (satisfies `isolatedModules`)
- No business logic, no try-catch, no Prisma calls in controllers
- No `@Roles()` on individual endpoints — use `@RequirePermissions()` only

### Service conventions
```typescript
@Injectable()
export class ThingService {
  private readonly logger = new Logger(ThingService.name);
  constructor(private readonly prisma: PrismaService) {}
}
```
- No try-catch for HttpExceptions — NestJS handles them automatically
- Only try-catch for Prisma unique constraint → 409 ConflictException
- Always use `select:` in Prisma queries — never return raw DB rows
- Guard business rules in the service (self-action, cross-role)
- `this.logger.log(...)` on all mutating admin actions

### Module registration
Every new module must be added to `AppModule.imports`. `PrismaService` is `@Global()` — do NOT import `PrismaModule` inside individual modules.

### Bearer token auth
The `bearer()` plugin is registered in `auth.instance.ts`. Token value is `session.token` (raw DB token, not cookie value).

---

## Gaps to Resolve Before Corresponding Phases

- **G1** — Add `Wishlist` model to schema before first migration
- **G2** — Decide on `PENDING_REVIEW` trip status (remove or implement admin review flow)
- **G3** — Implement payment webhook handlers in Phase 4
- **G7** — Notifications are a full missing phase (Phase 16)
- **G11** — Decide GitHub OAuth: in scope or remove from `auth.instance.ts`
- **G12** — Decide SSE vs. polling for operator slot offer notifications
- **G13** — Add `slug_registry`, `translations`, `destinations`, `hubs`, and hub-related tables to Prisma schema before first migration

## Pending — Product Owner Confirmation Required

| # | Question |
|---|---|
| P1 | Exact destination list at launch? Phased rollout? |
| P2 | Final category list? |
| P3 | Which categories are allowed in Klein Curaçao hub? (`hub_allowed_categories` seed data) |
| P4 | Any hubs outside Curaçao at launch? |
