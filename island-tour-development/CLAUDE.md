# Island Tours — CLAUDE.md

> Full specs: `technical-doc/01-project-scope/PROJECT-SCOPE.md` · `technical-doc/02-architecture/ARCHITECTURE-OVERVIEW.md` · `technical-doc/03-implementation/IMPLEMENTATION-GUIDE.md`
> Trip module: `technical-doc/03-implementation/TRIP-MODULE.md`
> Multilingual: `technical-doc/04-multilingual/MULTILINGUAL-CONTENT.md`
> Access management: `technical-doc/05-access-management/ROLES-AND-ACCESS-MANAGEMENT.md`
> Frontend/slot/booking reference: `CLAUDE-reference.md`
> **Discovery/SEO architecture (canonical, reflects V2 PDF): `technical-doc/02-architecture/PLATFORM-ARCHITECTURE-V2.md`**
> **V2 alignment/migration plan: `technical-doc/V2-DEVELOPMENT-ALIGNMENT-PLAN.md`** · gap rationale: `technical-doc/ARCHITECTURE-V2-GAP-ANALYSIS.md`
> **Master task checklist: `technical-doc/MASTER-CHECKLIST.md`**

---

## Master Checklist — Keep It Current

`technical-doc/MASTER-CHECKLIST.md` is the single source of truth for what is built, in progress, and remaining across all 18 implementation phases plus the 23 missing-feature items.

**You must update this file whenever you:**
- Complete a task — change `⬜` to `✅`
- Partially implement something — change `⬜` to `⚠️` (or `⚠️` to `✅`)
- Discover a task was already done that was marked ⬜ — correct it immediately
- Add a new task that doesn't appear in the list — append it to the relevant phase section

Update the checklist in the same commit/response as the implementation work. Never leave the checklist stale. The Summary Stats table at the bottom of the checklist should be updated to match the new counts whenever the counts change materially.

---

## What This Project Is

Island tour marketplace (reseller — commission on local operators). **Admins** manage destinations, categories, hubs, and collections. **Operators** list trips and compete for 3 featured slots per category. **Travelers** discover via three parallel layers (Categories | Activity Hubs | Collections), filter by attributes, and book instantly — no 24h enquiry model.

**Discovery architecture (canonical):** `technical-doc/02-architecture/PLATFORM-ARCHITECTURE-V2.md`. Core hierarchy: Destination → Category → Tour → Attributes, with Activity Hubs and Collections as parallel discovery layers. Destinations are grouped by **region** (data attribute, no URL). A tour belongs to 1 destination, **1+ categories**, **0–n activity hubs**, and has one canonical flat URL `/{locale}/{destination}/{tour-slug}/`.

**Launch destinations (5, all Caribbean):** Curaçao, Aruba, Sint Maarten, Saint Lucia, Bahamas. Schema scales to other regions (Atlantic, Mediterranean, Asia, Africa) without structural change.

> Some V2 points (multi-category/multi-hub tours, flat tour URLs, attributes/filters, collections, category-page gating) are **target state** not yet built — tracked in `technical-doc/V2-DEVELOPMENT-ALIGNMENT-PLAN.md`. The featured-slot economy is retained as-is (V2 omits it).

---

## Backend Structure

```
backend/
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── env.validate.ts          ← required env check — runs before Nest boots
│   ├── auth/                    ✓ done — Better Auth, guards, decorators
│   ├── common/
│   │   ├── dto/error-responses.dto.ts  ← shared Swagger error DTOs (400/401/403/404/409/500)
│   │   ├── filters/http-exception.filter.ts
│   │   └── utils/parse-cors-origins.ts
│   ├── prisma/                  ✓ done — PrismaService (@Global)
│   ├── users/                   ✓ done — user + operator management
│   ├── operators/               ✓ done
│   ├── media-gallery/           ✓ done
│   ├── settings/                ✓ done
│   ├── mail/                    ✓ done
│   ├── destinations/            ← current phase
│   ├── categories/              ← current phase
│   ├── hubs/                    ← current phase
│   ├── slug-registry/           ← current phase
│   ├── upload/                  Phase 4
│   ├── trips/                   Phase 4
│   ├── reviews/                 Phase 4
│   ├── bookings/                Phase 4
│   ├── payments/                Phase 4
│   ├── wishlist/                Phase 4
│   ├── slots/                   Phase 5
│   ├── waitlist/                Phase 6
│   ├── workers/                 Phase 7
│   └── config/
│       └── roles.config.ts      ← ROLE_PERMISSIONS map
├── prisma/                      ← split schema (16 files, Prisma 7 merges automatically)
├── prisma.config.ts
├── .env
└── package.json
```

---

## Commands

```bash
pnpm dev:backend             # NestJS on http://localhost:5050

# Prisma (run from root or backend/)
pnpm prisma:generate         # regenerate client after schema changes
pnpm prisma:migrate          # create + apply migration (dev)
pnpm prisma:migrate:deploy   # apply pending migrations (production)
pnpm prisma:migrate:reset    # reset DB + re-apply all (dev only)
pnpm prisma:studio
pnpm prisma:format
pnpm prisma:validate
```

---

## Tech Stack (Backend)

| Layer | Tool |
|---|---|
| Framework | NestJS 11 — Strict TypeScript |
| Database | PostgreSQL via Prisma ORM (split schema) |
| Auth | Better Auth — backend only |
| API docs | `@nestjs/swagger` — Swagger UI at `/api/docs` |
| Validation | `class-validator` + `class-transformer` — global `ValidationPipe` |
| Rate limiting | `@nestjs/throttler` — global guard |
| Package manager | pnpm |

---

## Platform Entities — Who Controls What

| Entity | Create | Notes |
|---|---|---|
| Destinations | Admin only | Islands; pre-seeded; `is_seeded` protects from delete; grouped by **region** (data attribute, no URL) |
| Categories | Admin only | **Global** (the 19 canonical categories) — one category spans all destinations; page renders only when ≥1 published tour (target) |
| Hubs (Activity Hubs) | Admin only | **Destination-specific** — destination mandatory; `hub_type` = location/highlight/area |
| Collections | Admin only | Curated/filtered editorial lists (manual or dynamic); **new module, not yet built** |
| Tours | Operators | Picks Destination → **1+ Categories** → **0–n Hubs** (target: many-to-many); one flat canonical URL |
| Featured slot | Operators | Via slot economy — lockSlot → publishTrip (retained; not in V2) |
| Top Island Experiences | Admin | Categories and Hubs only — never individual tours |
| Page editorial content | Admin | About text, FAQ per destination/category/hub/collection |
| Attributes / Filters | Admin (dictionary) + Operator (per-tour values) | Central `attribute_definitions` dictionary + `tour_attributes`; **new system, not yet built** |

**Slug registry write rules:**
- Category create → 1 `slug_registry` row **per active destination** (in same transaction)
- Hub create → 1 `slug_registry` row for its destination (in same transaction)
- Collection create → 1 `slug_registry` row for its destination (in same transaction) — *(target; module not yet built)*
- Tour create → **always** 1 `slug_registry` TOUR row (in same transaction). Every tour is flat `/{dest}/{tour-slug}/`; hubs are a discovery tag with no URL effect. *(Implemented in Stage 4/5 — the old hub-nested URL and the "hub-anchored skips slug_registry" rule are removed.)*

**FeaturedSlot write rule:**
- Category create → seed exactly **3 FeaturedSlot rows** for that category (in same transaction, never after)

---

## Slug Registry — How It Works

The `[slug]` URL segment is ambiguous — could be a category, hub, or destination-only tour. The slug registry resolves it.

```
slug_registry
  id                UUID PRIMARY KEY
  destination_slug  VARCHAR(100) NOT NULL   -- 'curacao'
  slug              VARCHAR(100) NOT NULL   -- 'boat-tours'
  entity_type       VARCHAR(20)  NOT NULL   -- 'category' | 'hub' | 'tour' | 'reserved'
  entity_id         UUID nullable           -- NULL only for 'reserved'
  is_active         BOOLEAN DEFAULT true
  UNIQUE (destination_slug, slug)
```

**`is_active = false`** when entity is disabled — row stays (protects the slug), page returns 404.

**`tours` slug** is reserved at every destination (seeded as `entity_type: 'reserved'`).

**Slug rules:**
- Slugs are always English — never translated
- Same destination: unique per `(destination_slug, slug)` pair
- Different destinations: same slug is allowed

---

## Prisma Schema Layout

Split schema in `backend/prisma/` — Prisma 7 merges all `.prisma` files automatically.

```
prisma/
├── schema.prisma          ← generator + datasource only
├── enums.prisma           ← all platform enums
├── user.prisma            ← User, Session, Account, Verification (Better Auth)
├── operators.prisma       ← Operator, OperatorCompanyInfo, OperatorSocialMedia, OperatorStripeConfig, OperatorMollieConfig
├── destinations.prisma    ← Destination, Hub, HubAllowedCategory, HubOurPick, HubComparisonGroup, HubComparisonTour, HubContent, FeaturedExperience
├── categories.prisma      ← Category, CategoryTranslation, CategoryPageContent
├── slug-registry.prisma   ← SlugRegistry
├── faq.prisma             ← Faq (shared polymorphic; pageType + entityId discriminator)
├── trips.prisma           ← Trip + all child models (TourImage, TourSchedule, TourAgeBand, TourAddOn, TourHighlight, TourInclusion…)
├── featured-slots.prisma  ← FeaturedSlot, SlotLock, SlotHistory
├── waitlist.prisma        ← WaitlistEntry
├── bookings.prisma        ← Booking
├── reviews.prisma         ← Review
├── wishlist.prisma        ← Wishlist
├── media-gallery.prisma   ← MediaGallery
├── settings.prisma        ← SiteInfo, SiteSEO, SocialMedia, SMTP, Mailchimp, CompanyInformations, StripeConfiguration, mollieConfiguration
├── webhooks.prisma        ← Webhooks, WebhookPoint
└── migrations/
```

`prisma.config.ts`:
```typescript
export default defineConfig({
  schema: 'prisma/',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
})
```

`prisma generate` runs automatically — prepended to `build`, `start`, `start:dev`, `start:debug`.

---

## API Conventions

- Base URL: `http://localhost:5050/api/v1`
- Auth endpoints: `http://localhost:5050/api/auth/*` (Better Auth, no `/v1`)
- Swagger docs: `http://localhost:5050/api/docs`
- All authenticated routes require the `better-auth.session_token` cookie
- Error shape for slot conflicts: `{ statusCode: 409, code: 'SLOT_TAKEN' }`
- Error shape for expired lock: `{ statusCode: 410 }`

---

## Three User Roles

| Role | Created by | Key capability |
|---|---|---|
| USER | Auto-created on first booking | Browse, book, review |
| OPERATOR | Self-registration | Create trips, hold featured slots |
| ADMIN | Database seed only | Full platform management |

Operators inherit all USER capabilities. Admins inherit all USER + OPERATOR capabilities.

---

## Auth Guard Execution Order

```
ThrottlerGuard        ← blocks rate-limited clients before any DB work
AuthGuard             ← validates session cookie/Bearer; populates request.user
RolesGuard            ← checks @Roles() metadata
PermissionsGuard      ← checks @RequirePermissions() metadata
```

Do not reorder. Do not add `@Roles()` to individual endpoints — use `@RequirePermissions()` only.

---

## Module Code Patterns

Every new module follows `src/users/`. This is the authoritative reference.

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
export class CategoryResponseDto {
  @ApiProperty({ example: '3fa85f64-...' }) id!: string;
  @ApiProperty({ example: 'Boat Tours' })   name!: string;
  @ApiProperty({ example: 'boat-tours' })   slug!: string;
}

// Paginated wrapper
export class PaginatedCategoriesResponseDto {
  @ApiProperty({ example: 42 })  total!: number;
  @ApiProperty({ example: 1 })   page!: number;
  @ApiProperty({ example: 20 })  limit!: number;
  @ApiProperty({ type: [CategoryResponseDto] }) data!: CategoryResponseDto[];
}

// Numeric query param
export class CategoryQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;
}
```

Rules:
- `@ApiProperty` on every response DTO field with `example:`
- `@ApiPropertyOptional` on optional fields
- Numeric query params need `@Type(() => Number)`

### Swagger conventions

```typescript
const commonErrors = [/* 400, 401, 500 */];
const adminErrors  = [...commonErrors, /* 403 */];

export function ApiGetAllCategoriesDocs() {
  return applyDecorators(
    ApiOperation({ summary: '...' }),
    ApiResponse({ status: 200, type: PaginatedCategoriesResponseDto }),  // always type:, never schema:
    ...adminErrors,
  );
}
```

- `404` always uses `type: NotFoundErrorDto`
- Import error DTOs from `@/common/dto/error-responses.dto`

### Controller conventions

```typescript
@ApiTags('Categories')
@Controller('categories')
export class CategoryController {
  // Static routes BEFORE dynamic (:id) routes — NestJS matches top-to-bottom
  @Get('active')   @RequirePermissions(Permission.VIEW_CONTENT) getActive() { ... }
  @Get(':id')      @RequirePermissions(Permission.VIEW_CONTENT) getById(@Param('id') id: string) { ... }
}
```

- `import type { TypedAuthUser }` (satisfies `isolatedModules`)
- No business logic, no try-catch, no Prisma calls in controllers
- No `@Roles()` on individual endpoints — use `@RequirePermissions()` only

### Service conventions

```typescript
@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);
  constructor(private readonly prisma: PrismaService) {}
}
```

- No try-catch for HttpExceptions — NestJS handles them automatically
- Only try-catch for Prisma unique constraint violations → 409 ConflictException
- Always use `select:` in Prisma queries — never return raw DB rows
- Guard business rules in the service (not controller)
- `this.logger.log(...)` on all mutating admin actions

### Module registration

Every new module must be added to `AppModule.imports`. `PrismaService` is `@Global()` — do NOT import `PrismaModule` inside individual modules.

---

## Critical Rules — Never Break These

### 1. @/ path alias for all internal imports
```typescript
import { PrismaClient } from '@prisma/client';  // ✅ exception — standard package
import { X } from '@/common/...';               // ✅ all other internal imports
```

### 2. Global ValidationPipe strips unknown fields
`whitelist: true` + `forbidNonWhitelisted: true`. Every request body must have a matching DTO class.

### 3. ADMIN role must be a strict superset of all lower roles
`ROLE_PERMISSIONS[Role.ADMIN]` must include every permission granted to `TOUR_OPERATOR` and `USER`. Check whenever `Permission` enum is extended.

### 4. Slug registry rows are transactional
Every entity creation that writes to `slug_registry` must do so inside a Prisma transaction with the entity creation itself. Partial writes leave orphaned rows.

### 5. Category create writes slug_registry rows for ALL active destinations
```typescript
const destinations = await prisma.destination.findMany({ where: { isActive: true } });
// insert one slug_registry row per destination — in the same transaction as category creation
```

### 6. Category create seeds exactly 3 FeaturedSlot rows
```typescript
await prisma.featuredSlot.createMany({
  data: [1, 2, 3].map(slotNumber => ({ categoryId, slotNumber, status: 'AVAILABLE' })),
});
```
In the same transaction. Never create FeaturedSlot rows outside of category creation.

### 7. FeaturedSlot rows are permanent
Never DELETE FeaturedSlot rows. Only UPDATE: `status`, `tripId`, `acquiredAt`, `expiresAt`. Every category always has exactly 3 rows.

### 8. Every tour is flat and always writes a slug_registry TOUR row
A tour has one canonical URL `/{dest}/{tour-slug}/` and **always** writes a `slug_registry` TOUR row on create (and toggles/removes it on archive/restore/remove). Tours belong to **1+ categories** (one `isPrimary`) via `TourCategory` and **0–n hubs** via `TourHub`; hubs are a discovery tag with **no** URL effect — there is no hub-nested tour URL. *(Stage 4/5. The earlier "hub-anchored tours skip slug_registry" rule is removed.)*

### 9. Destinations with `is_seeded = true` cannot be deleted
Guard in service: throw 403 ForbiddenException if `destination.isSeeded === true`.

### 10. Never let the frontend set user roles
Role changes must only happen through protected backend endpoints guarded with `@Roles(Role.ADMIN)`. Frontend must never send a `role` field.

### 11. ThrottlerGuard is global and runs first
Three tiers: 20 req/s · 300 req/min · 3 000 req/hr. Lives in `AuthModule` (not `AppModule`) — do not move it.

### 12. Better Auth lives on NestJS only
Frontend never runs `betterAuth()`. All session logic happens on the backend.

### 13. CORS must have `credentials: true`
Always use `parseCorsOrigins()` from `@/common/utils/parse-cors-origins` in both `main.ts` and `auth.instance.ts`.

### 14. Only one Prisma instance per process
Backend owns all DB access. Frontend has no `prisma/` folder and no `DATABASE_URL`.

### 15. Webhook endpoints bypass AuthGuard and ThrottlerGuard
Must be `@Public()` + `@SkipThrottle()`. Verify with gateway signatures.

### 16. Use `AuthenticatedRequest` and `TypedAuthUser` for typed access
```typescript
import type { AuthenticatedRequest, TypedAuthUser } from '@/auth/auth.types';
```
Never inline `getRequest<{ user: { role: Role } }>()`.

### 17. Guards and decorators must keep instructional JSDoc
Preserve the JSDoc with What it does + Dependencies + Usage examples. Do not trim to a one-liner.

### 18. Store BullMQ job IDs
Store `bullJobId` on `SlotLock` and `offerJobId` on `WaitlistEntry` to cancel them early when no longer needed.

### 19. Trip ownership uses `operator.id`, not `user.id`
`trips.operatorId` is a FK to `operators.id` — **not** `users.id`. Controllers pass `user.id`; the service must resolve it to `operator.id` before any DB write or ownership check. Use the private `resolveOperatorId(userId, role?)` helper in `trips.service.ts`.

```typescript
// ✅ correct — resolve first
const operatorId = await this.resolveOperatorId(userId, userRole);

// ❌ wrong — user.id ≠ operator.id
await prisma.trip.create({ data: { operatorId: userId, ... } });
```

**Admin auto-provisioning:** If the caller is `Role.ADMIN` and has no operator record, `resolveOperatorId` silently creates one (`{ userId }` — all other fields optional). This lets admins create and own trips without a separate registration step. For `Role.TOUR_OPERATOR` with no operator record, it throws `400`.

**Lifecycle ownership bypass:** `publish`, `pause`, `unpause`, `remove`, and `assertOwnership` all skip the ownership check when `userRole === Role.ADMIN`, so admins can manage any operator's trip. Operators are always checked against their own `operatorId`.

---

## Frontend Translation Form Patterns

These patterns apply to every multilingual module (Category, Hub, and any future entity with translations).

### Upsert translation payload shape
The backend wraps translation fields inside a `fields` key — never send them flat:
```typescript
// ✅ correct
{ fields: { name, overview, h1Override, breadcrumbLabel }, isMachineTranslated?: false }

// ❌ wrong — causes 400 "property X should not exist" (forbidNonWhitelisted)
{ name, overview, h1Override, breadcrumbLabel }
```
Frontend type must match:
```typescript
export interface UpsertTranslationPayload {
  fields: {
    name?: string | null;
    // ...other translatable fields
  };
  isMachineTranslated?: boolean;
}
```

### English (base locale) tab rules
- Name is **read-only** — it's the canonical value, edited only in the Details tab
- All other fields (overview, h1Override, breadcrumbLabel, etc.) are **fully editable** via `LocaleTab` with `disableNameField` prop
- The "Delete Translation" button on English must **not** call the delete endpoint (backend blocks it). Instead it should call upsert with the editable fields set to `null` — label it "Clear Fields"
- Pattern: pass `disableNameField` prop to `LocaleTab`; branch `handleDelete` on this prop

```tsx
// English tab
<LocaleTab destinationId={id} locale="en" disableNameField />

// In LocaleTab — name field
<Input
  {...register('name')}
  readOnly={disableNameField}
  className={disableNameField ? 'opacity-60 cursor-not-allowed' : undefined}
/>

// In handleDelete
if (disableNameField) {
  upsert({ id, locale, payload: { fields: { overview: null, h1Override: null, breadcrumbLabel: null } } })
} else {
  deleteTranslation({ id, locale })
}
```

---

## Frontend Create Form — Slug Field Pattern

Every entity with a URL slug must expose an editable slug field on create and lock it on edit.

### Rules
- **Create mode**: slug field shown, auto-generates from name as the user types; once manually edited (`slugTouched` flag), auto-generation stops
- **Edit mode**: slug shown as read-only input with a "cannot be changed after creation" note
- Backend `CreateXxxDto` always accepts an optional `slug?: string`; service uses `dto.slug ?? generateSlug(dto.name)` and always runs the value through `generateSlug` to normalise it

### Frontend pattern
```typescript
// toSlug mirrors the backend generateSlug util — keep them in sync
function toSlug(value: string) {
  return value
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Zod field
slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, hyphens only')

// Auto-generate, stop on manual edit
const [slugTouched, setSlugTouched] = useState(false);
useEffect(() => {
  if (!isEditMode && !slugTouched) setValue('slug', toSlug(nameValue));
}, [nameValue, isEditMode, slugTouched, setValue]);

// Input — create mode
<Input
  {...register('slug')}
  onChange={(e) => { setSlugTouched(true); setValue('slug', e.target.value, { shouldValidate: true }); }}
/>

// Input — edit mode
<Input value={existing.slug} readOnly className="opacity-60 cursor-not-allowed" />
```

---

## Frontend Dashboard RBAC Pattern

Control rendering based on the logged-in user's role. The role is resolved server-side in the dashboard layout and distributed to all client components via `RoleContext`.

### Infrastructure

- **`lib/config/rbac.ts`** — Source of truth: `Permission` constants, `Role` constants, `ROLE_PERMISSIONS` map, `hasPermission` / `hasAnyPermission` helpers. **Must stay in sync with `backend/src/config/roles.config.ts`.**
- **`contexts/role-context.tsx`** — `RoleProvider` wraps `DashboardWrapper` children. `useRole()` returns `{ role, can, canAny }`.
- `DashboardWrapper` (`components/dashboard/dashbaord-wraper.tsx`) wraps all dashboard content in `<RoleProvider role={userRole}>`.

### Hook usage

```tsx
import { useRole } from '@/contexts/role-context';

const { can, canAny } = useRole();

// Single permission check
{can('CREATE_DESTINATION') && <Button>Add Destination</Button>}

// Multiple permissions (any one suffices)
{canAny(['EDIT_DESTINATION', 'DELETE_DESTINATION']) && <ActionsMenu />}
```

### What to gate (DO apply RBAC)

| UI Element | Permission to check |
|---|---|
| "Add X" button on list pages | `CREATE_*` or `MANAGE_*` |
| Bulk Delete button in tables | `DELETE_*` or `MANAGE_*` |
| Delete item in row-actions dropdown | `DELETE_*` or `MANAGE_*` |
| Danger Zone card on edit forms | `DELETE_*` or `MANAGE_*` |
| Admin-only panels (Settings, Users) | `MANAGE_SYSTEM` / `MANAGE_USERS` |

### What NOT to gate (skip RBAC)

- Every tiny sub-action inside a page already protected at the nav level
- Deeply nested conditional UI that only appears after multiple guarded steps
- Fields within a form (gate the form/page, not individual inputs)

### Permission map for existing modules

| Module | Create | Edit | Delete |
|---|---|---|---|
| Destinations | `CREATE_DESTINATION` | `EDIT_DESTINATION` | `DELETE_DESTINATION` |
| Categories | `CREATE_CATEGORY` | `EDIT_CATEGORY` | `DELETE_CATEGORY` |
| Hubs | `MANAGE_HUBS` | `MANAGE_HUBS` | `MANAGE_HUBS` |

### Apply this pattern to every new module

When adding a new module, always:
1. Check `lib/config/rbac.ts` for the correct `Permission` key(s)
2. Import `useRole` in the table, row-actions, and form components
3. Gate: `Add X` button, bulk Delete button, Delete row-action item, Danger Zone card

---

## Frontend (Public Site) — Coding Patterns

### File locations
```
app/(frontend)/                  ← public site route group
  layout.tsx                     ← imports frontend-tokens.css; wraps with .frontend-root
  page.tsx                       ← homepage
  frontend-tokens.css            ← all --it-* design tokens (scope: frontend only)
components/frontend/             ← all public-facing components (never in components/dashboard/)
```

### Icons — SVG files in `public/icons/`, rendered via `next/image`
Icons are **SVG files committed to `public/icons/`**, not inline `<svg>` JSX. Pull the exact SVG from Figma, save it as a file, and render it with `next/image`. Never hand-draw an approximation or inline a one-off `<svg>` component in a `.tsx` file.

```tsx
// ✅ correct — file + next/image, width/height match the Figma export
<Image src='/icons/nav-search.svg' alt='' width={18} height={18} className='size-4.5 shrink-0' />

// ❌ wrong — inline <svg> component / lucide stand-in for a Figma icon
function SearchIcon() { return <svg>…</svg> }
<SearchIcon />
```

**Naming & layout**
- Section-prefix the filename by where it's used: `nav-*` (navbar), `hero-*`, `trust-*`, `footer/*`. Generic shared icons need no prefix (`check-green.svg`, `whatsapp.svg`, `star-filled.svg`).
- Group related sets in subfolders: `icons/flags/<locale>.svg`, `icons/payments/pay-N.svg`, `footer/social/*`, `footer/payment/*`.
- Keep the Figma colour baked into the SVG (e.g. search icon ships `#767676`, category ships `#2c2c2c`). These are file assets — `currentColor`/Tailwind text utilities do **not** recolour a `next/image` SVG.
- Set `width`/`height` on `<Image>` to the Figma export's intrinsic size; size on screen with a Tailwind `size-*` class. Use `alt=''` for decorative icons.

**`lucide-react` is allowed only for generic UI affordances** that aren't in the Figma design — menu/close (hamburger), chevrons, the mobile-search back arrow. Anything that appears in a Figma frame must be the exported Figma SVG file.

### Always use Tailwind classes — never inline style objects
The `--it-*` CSS vars are registered in `@theme inline` inside `frontend-tokens.css`, so they map directly to Tailwind utilities:

```tsx
// ✅ correct
<div className="bg-it-primary text-it-white rounded-it-full shadow-it-md">

// ❌ wrong — no inline style objects
<div style={{ background: 'var(--it-primary)', color: '#fff' }}>
```

| Token type | Tailwind prefix | Example |
|---|---|---|
| Color | `bg-it-*`, `text-it-*`, `border-it-*` | `bg-it-primary`, `text-it-ink` |
| Border radius | `rounded-it-*` | `rounded-it-full`, `rounded-it-lg` |
| Shadow | `shadow-it-*` | `shadow-it-md`, `shadow-it-lg` |
| Font family | `font-it-*` | `font-it-display`, `font-it-body` |

### Fonts
- SF Pro system stack — **no next/font loading needed**
- `font-it-display` → display/headings (SF Pro Display)
- `font-it-body` → body text (SF Pro Text)

### Tailwind v4 canonical classes
- Use `bg-linear-to-br` not `bg-gradient-to-br`
- Use `text-(--it-star-filled)` not `text-[var(--it-star-filled)]`
- Use `z-100` not `z-[100]`
- Use `min-w-45` not `min-w-[180px]` (when the value maps to a scale token)

### Container & layout — reuse the section utilities (do NOT hardcode padding)
Every public-site section uses the two reusable utilities defined in `frontend-tokens.css`. Never hardcode section padding (`py-32.5`, `px-30`, etc.) — change the token if the value is wrong, don't inline it.

```tsx
<section className="it-section bg-it-white">   {/* vertical padding: 130px desktop / 64px mobile */}
  <div className="it-container">               {/* max-width 1440 + horizontal 120px desktop / 32 / 16 */}
    {/* section content */}
  </div>
</section>
```

- `it-section` → vertical padding (`--it-section-py` = 130px desktop, `--it-section-py-sm` = 64px mobile). Matches Figma's 130px section padding.
- `it-container` → max-width (1440px) + horizontal padding (120px desktop → 32px tablet → 16px mobile). Matches Figma's 120px side padding.
- If a section needs a different spacing, **update the token** (or add a new reusable utility/token) — keep reusable styling in `frontend-tokens.css`, not scattered across components.
- When you spot a repeated pattern (card, badge, pill, glass panel…), promote it to a `--it-*` token or an `it-*` utility class in `frontend-tokens.css` rather than copy-pasting values.

### What to tokenize vs. inline
Tokenize **colors only** — add them to `frontend-tokens.css` (`:root` + `@theme inline`) and use the utility (`bg-it-*`, `text-it-*`, `border-it-*`). Do **not** create CSS variables for typography metrics — font size, letter-spacing, and line-height go inline as plain Tailwind values:

```tsx
// ✅ correct — color from token, metrics inline
<h1 className="text-it-hero-heading text-[40px] leading-[1.2] tracking-[-0.012em]">

// ❌ wrong — over-tokenized metrics
<h1 className="text-it-hero-heading text-(length:--it-hero-h1-size) leading-(--it-leading-tight) tracking-(--it-tracking-hero)">
```

### Use px, not rem, in arbitrary values
When a Tailwind arbitrary value is needed, use `px` (matches Figma measurements directly): `text-[40px]` not `text-[2.5rem]`, `h-[600px]` not `h-[37.5rem]`. (em-based and unitless values like `tracking-[-0.012em]` / `leading-[1.2]` stay as-is.)
