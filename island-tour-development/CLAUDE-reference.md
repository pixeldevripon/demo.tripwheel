# Island Tours — Reference Docs

> Sections not needed during day-to-day backend module work.
> Active instructions live in `CLAUDE.md`.

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

**"Built by Islanders."** — brand tagline, hardcoded English everywhere, never translated.

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

**middleware.ts:**
```typescript
import createMiddleware from 'next-intl/middleware';
export default createMiddleware({
  locales: ['en', 'es', 'nl', 'pt', 'fr', 'de', 'zh'],
  defaultLocale: 'en',
  localePrefix: 'always',
});
export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
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
- Format priority: AVIF → WebP → JPEG fallback
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
tour.pricing_model           enum: per_person | unit
tour.unit_type               enum (nullable): group | boat | vehicle | aircraft | package
tour.pickup_model            enum: included | paid_addon | none
tour.booking_cutoff_minutes  int, default 120, range 0–10080
tour.cancellation_hours      int, default 24, per-tour override
tour.age_bands[]             nullable (Adults/Children/Infants with own prices)
tour.add_ons[]               nullable; EU Digital Fairness Act: never pre-checked
tour.max_party_size / min_party_size  hard limits on booking widget +/- controls
tour.gallery_images[]        ordered; first = hero (is_hero: true); manual focal point per image
tour.h1_override             nullable — overrides template-generated H1
tour.breadcrumb_label        short-form when H1 > 35 chars
tour.duration_minutes        drives duration badge formatter
```

**Hub page routing:**
- `pricing_model = 'per_person'` → "Book now" tab on hub page
- `pricing_model = 'unit'` → "Private charter" tab on hub page

**Pickup badge text:**
- `included` → "Pickup included"
- `paid_addon` → "Pickup available"
- `none` → "Meeting point only"

**Tour publish blocks:** <5 images, no hero image, overview empty, highlights <3.

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

**BullMQ rule:** Must use ioredis with a TCP Redis URL (`redis://` or `rediss://`). Never the Upstash HTTP REST client.

**Two separate Redis connections for pub/sub:** One for `subscribe` mode (`SlotEventsService`), a separate one for `publish` (`SlotsService`). A subscribed connection cannot send other commands.

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

## Auth Module Architecture

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
- `role` must always be `input: false` in Better Auth additional fields
- Admin seeding is always a two-step operation: `signUpEmail` then `prisma.user.update({ role: ADMIN })`
- Better Auth table names stay lowercase: `@@map("user")` · `@@map("session")` · `@@map("account")` · `@@map("verification")`

---

## Gaps to Resolve Before Corresponding Phases

- **G2** — Decide on `PENDING_REVIEW` trip status (remove or implement admin review flow)
- **G3** — Implement payment webhook handlers in Phase 4
- **G7** — Notifications are a full missing phase (Phase 16)
- **G11** — Decide GitHub OAuth: in scope or remove from `auth.instance.ts`
- **G12** — Decide SSE vs. polling for operator slot offer notifications

## Pending — Product Owner Confirmation Required

| # | Question |
|---|---|
| P1 | Exact destination list at launch? Phased rollout? |
| P2 | Final category list? |
| P3 | Which categories are allowed in Klein Curaçao hub? (`hub_allowed_categories` seed data) |
| P4 | Any hubs outside Curaçao at launch? |

## Environment Variables (full list)

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
