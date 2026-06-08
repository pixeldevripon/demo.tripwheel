# 06 — Frontend Implementation Plan (V2 Admin-Panel Sync)

> **Purpose.** The concrete, dependency-ordered, step-by-step plan to bring the **admin dashboard** in sync with every V2 backend change already shipped (Stages 1–8). Built from a live analysis of the backend DTOs/controllers/services and the current frontend (`types/`, `lib/api/`, `hooks/`, `components/dashboard/`).
>
> **Companion docs:** `05-FRONTEND-IMPACT-LOG.md` (what changed per stage) · `02-architecture/SLUG-REGISTRY.md` (routing) · root `CLAUDE.md` (frontend form/RBAC/slug/translation patterns).
>
> **Scope.** This plan covers the **admin dashboard** (the user's priority). The **public site** (resolver route + page components, Stages 3/5/6b/8 rendering) is tracked separately in §Public-Site Track at the end — do it after the admin panels.
>
> **Golden rule:** backend is the source of truth and is **already done**. The frontend is currently **out of sync** (e.g. the trip module still sends singular `categoryId`/`hubId`, which the backend no longer accepts → trip create/edit is broken today). Fixing that drift is the core of this plan.

---

## How to use this doc

- Work phases **top to bottom** — later phases depend on earlier ones (shared types + the MultiSelect primitive first).
- Each phase lists: **Files**, **Steps**, **Payload/response shapes** (verbatim from backend), **RBAC**, **Acceptance criteria**.
- After each phase: run `pnpm --filter frontend build` (or the repo's typecheck) and tick the **Progress tracker** at the bottom. Update `05-FRONTEND-IMPACT-LOG.md` (flip 🔵→🟢) in the same session.
- Follow existing module conventions exactly: `types/<m>.ts` · `lib/api/<m>.ts` · `hooks/<m>/use-<m>.ts` · `components/dashboard/<m>/`. React Hook Form + Zod, TanStack Query, `useRole().can()` gating, slug-on-create pattern, `{ fields: {...} }` translation payload, English-tab "Clear Fields" rule.

---

## Backend reality check (verified contracts)

**Required-on-create fields that the admin form must send (else 400):**
| Entity | Newly required | Enum values |
|---|---|---|
| Destination | `region` | `CARIBBEAN · ATLANTIC · MEDITERRANEAN · ASIA · AFRICA` |
| Hub | `hubType` | `LOCATION · HIGHLIGHT · AREA` |
| Trip | `categoryIds: string[]` (≥1) | — (`primaryCategoryId` optional, defaults to first) |

**Enums to add frontend-side:** `Region`, `HubType`, `AttributeDataType` (`BOOLEAN·ENUM·ENUM_MULTI·INTEGER·DECIMAL·TEXT`), `FilterDisplayType` (`CHECKBOX·RANGE_SLIDER·RADIO·DROPDOWN`), `CollectionType` (`MANUAL·DYNAMIC`), `SlugEntityType` (`TOUR·CATEGORY·HUB·COLLECTION·RESERVED`).

**RBAC keys (all already exist in `lib/config/rbac.ts`):** destinations `CREATE/EDIT/DELETE_DESTINATION`; categories `CREATE/EDIT/DELETE_CATEGORY`; hubs `MANAGE_HUBS`; trips `CREATE_TRIP/EDIT_TRIP/VIEW_TRIPS/MANAGE_TRIPS/DELETE_TRIP`; attributes dictionary `MANAGE_SYSTEM`; collections `CREATE_CONTENT/EDIT_CONTENT/DELETE_CONTENT` (+`MANAGE_SYSTEM` for force-delete).

**API base:** `${NEXT_PUBLIC_BACKEND_URL}/api/v1`, `fetch` with `credentials: 'include'` (existing `lib/api/*` pattern).

---

## Phase F0 — Shared foundations (do first)

These unblock every later phase.

### F0.1 — Add the enums

**Files:** `types/destination.ts`, `types/hub.ts`, plus new `types/attribute.ts`, `types/collection.ts`, `types/slug-registry.ts` (created in their phases). Prefer a small shared `types/enums.ts` if one fits the repo style; otherwise co-locate each enum with its module type.

```ts
export type Region = 'CARIBBEAN' | 'ATLANTIC' | 'MEDITERRANEAN' | 'ASIA' | 'AFRICA';
export type HubType = 'LOCATION' | 'HIGHLIGHT' | 'AREA';
export type AttributeDataType = 'BOOLEAN' | 'ENUM' | 'ENUM_MULTI' | 'INTEGER' | 'DECIMAL' | 'TEXT';
export type FilterDisplayType = 'CHECKBOX' | 'RANGE_SLIDER' | 'RADIO' | 'DROPDOWN';
export type CollectionType = 'MANUAL' | 'DYNAMIC';
export type SlugEntityType = 'TOUR' | 'CATEGORY' | 'HUB' | 'COLLECTION' | 'RESERVED';
```

> Match the repo's existing convention: trip enums are string-union types in `types/trip.ts` (e.g. `TripStatus`). Use string unions, **not** TS `enum`. For Zod use `z.enum([...])`.

### F0.2 — Build a reusable MultiSelect primitive ⭐ (blocker for F4/F5/F6)

There is **no** multi-select component today (only `select.tsx` + `command.tsx`). Trips (categories/hubs), attributes (`appliesToCategories`, ENUM_MULTI values), and collections (manual tour list) all need one.

**File:** `components/ui/multi-select.tsx`

**Build with the primitives that already exist:** `Popover` + `Command`/`CommandInput`/`CommandList`/`CommandItem` (cmdk) + `Badge` (selected chips) + `Button` (trigger). Mirror the look of `hub-allowed-categories-manager.tsx`.

**Props:**
```ts
interface MultiSelectProps {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  // optional: render a "primary" marker per selected item (used by Trip categories)
  primaryValue?: string | null;
  onPrimaryChange?: (value: string) => void;
}
```

**Behavior:** searchable list; selected items show as removable `Badge` chips; toggling an item adds/removes from `value`; when `onPrimaryChange` is provided, each selected chip shows a "Set primary"/"★ Primary" affordance (used only by Trip categories).

**Acceptance:** a controlled component usable inside RHF `Controller`. Add a tiny story/manual test on one form before reuse.

### F0.3 — Confirm RBAC (no code change)

All needed permission keys already exist (see Backend reality check). No `rbac.ts` edits required unless a new permission surfaces. Keep `lib/config/rbac.ts` in sync with `backend/src/config/roles.config.ts` if you ever touch it.

**Phase F0 acceptance:** `types` compile; `MultiSelect` renders and round-trips a `string[]` in a throwaway form.

---

## Phase F1 — Destinations admin form (Stage 1)

**Backend:** `POST /destinations` now **requires `region`**; create/update accept `country, latitude, longitude, timezone, currency, language, galleryImages (string[]), ogImage, parentDestinationId`; responses include them all.

**Files:** `types/destination.ts`, `lib/api/destinations.ts` (no path changes — payload types only), `components/dashboard/destinations/destination-form.tsx`, optionally list/detail views.

**Steps:**
1. **Types** — extend `Destination` with: `region: Region | null`, `country: string | null`, `latitude: number | null`, `longitude: number | null`, `timezone: string | null`, `currency: string | null`, `language: string | null`, `galleryImages: string[]`, `ogImage: string | null`, `parentDestinationId: string | null`. Extend `CreateDestinationPayload` (add `region: Region` **required** + the optionals). Extend `UpdateDestinationPayload` (all optional, + `region?`).
2. **Form Zod** — add `region: z.enum(['CARIBBEAN','ATLANTIC','MEDITERRANEAN','ASIA','AFRICA'])` (required), `country: z.string().optional()`, `latitude/longitude: z.coerce.number().min(-90/-180).max(90/180).optional()`, `timezone/currency/language: z.string().optional()`, `ogImage: z.string().optional()`, `galleryImages: z.array(z.string()).optional()`, `parentDestinationId: z.string().optional()`.
3. **Form inputs** — add a **required Region `<Select>`** (5 options), text inputs for country/timezone/currency/language, number inputs for lat/lng, `ImageSelectorField` for `ogImage`, a multi-image picker for `galleryImages` (reuse the media selector in array mode), and an optional parent-destination `<Select>` (populate via `useActiveDestinations()`, exclude self in edit). Group new fields under a "Location & SEO" card so the form stays scannable.
4. **Payload wiring** — include `region` + new fields in the create/update mutation calls; send `null` for cleared optionals.

**Acceptance:** Creating a destination without Region is blocked client-side; with Region + new fields it succeeds and they persist on reload. Editing updates them.

---

## Phase F2 — Categories admin form (Stage 1)

**Backend:** create/update accept `description, icon, sortOrder (int, default 0), metaTitleTemplate, metaDescriptionTemplate, parentCategoryId` (all optional); responses include them + `publishedTourCount` (only on the destination-scoped endpoints).

**Files:** `types/category.ts`, `components/dashboard/categories/category-form.tsx`, category list (ordering).

**Steps:**
1. **Types** — extend `Category` + payloads with `description, icon, sortOrder, metaTitleTemplate, metaDescriptionTemplate, parentCategoryId`. (Add `publishedTourCount?: number` to a new destination-scoped response type in F-public, not the base type.)
2. **Form Zod/inputs** — `description` (Textarea), `icon` (text input; pairs with the icon map in F7), `sortOrder` (number, default 0), `metaTitleTemplate`/`metaDescriptionTemplate` (text inputs with a hint: tokens `{category}` / `{destination}`), `parentCategoryId` (optional `<Select>` of categories, exclude self in edit).
3. **List ordering** — sort the categories table by `sortOrder` asc (then name) to match backend ordering.

**Acceptance:** New fields save and reload; list respects `sortOrder`.

---

## Phase F3 — Hubs admin form (Stage 1)

**Backend:** `POST /hubs` now **requires `hubType`**; create/update accept `latitude, longitude`; create still accepts optional `allowedCategoryIds[]`. (Allowed-categories sub-routes already wired in the frontend manager — leave as-is.)

**Files:** `types/hub.ts`, `components/dashboard/hubs/hub-form.tsx`.

**Steps:**
1. **Types** — add `hubType: HubType | null`, `latitude: number | null`, `longitude: number | null` to `Hub`/`HubDetail`. `CreateHubPayload.hubType: HubType` **required**; add `latitude?`, `longitude?` to create + update; add `hubType?` to update.
2. **Form Zod/inputs** — add **required HubType `<Select>`** (`LOCATION/HIGHLIGHT/AREA`) + lat/lng number inputs (Zod `z.coerce.number().min().max().optional()`). Keep destinationId select (immutable on edit) and the existing allowed-categories manager.
3. **Payload wiring** — send `hubType` (+ lat/lng) on create/update.

**Acceptance:** Hub create without HubType is blocked; with it succeeds; lat/lng persist.

---

## Phase F4 — Trips admin: multi-category / multi-hub + flat URL + publish guard ⭐ (Stages 4, 5, 8)

This is the largest and highest-priority phase — the current trip module is **broken** against the backend.

**Backend (verified):**
- `CreateTripDto`: `categoryIds: string[]` (**ArrayMinSize 1**), `primaryCategoryId?: string` (must be ∈ categoryIds; defaults to first), `hubIds?: string[]` (0–n). **No `categoryId`/`hubId`.**
- `UpdateTripDto`: send `categoryIds` to replace the set; send `primaryCategoryId` alone to re-point primary; send `hubIds` to replace hubs.
- Responses: `categoryIds: string[]`, `primaryCategoryId: string | null`, `hubIds: string[]`; detail/list/admin also include `categoryNames`, `primaryCategoryName`, `hubNames` (no more `categoryName`/`hubName`). Plus CRO fields `bookingCount`, `bookingCountToday`, `spotsRemaining`, `lastBookedAt` on all responses.
- `GET /trips/slug/:slug` takes **`destinationSlug` + `locale` only — `hubSlug` is removed.**
- **Publish guard** (`POST /trips/:id/publish`): requires ≥5 images, 1 hero, English overview, ≥3 highlights, **and a price (`basePrice` OR ≥1 age band)**, else 400 with a message array.
- Hub validation: each hub must belong to the trip's destination AND allow **≥1** of the trip's categories.

**Files:** `types/trip.ts`, `lib/api/trips.ts` (payload/response types only), `hooks/trips/use-trips.ts` (types), `components/dashboard/trips/trip-form.tsx` (create), `components/dashboard/trips/trip-details-tab.tsx` + `trip-edit-view.tsx` (edit), `trip-columns.tsx`/`trips-table.tsx` (list display), any tour-card/breadcrumb component.

**Steps:**
1. **Types** — in `types/trip.ts`:
   - Replace `categoryId: string` → `categoryIds: string[]`; add `primaryCategoryId: string | null`.
   - Replace `hubId: string | null` → `hubIds: string[]`.
   - Replace `categoryName`/`hubName` → `categoryNames?: string[]`, `primaryCategoryName?: string | null`, `hubNames?: string[]`.
   - Add CRO fields: `bookingCount: number`, `bookingCountToday: number`, `spotsRemaining: number`, `lastBookedAt: string | null`.
   - `CreateTripPayload`: `categoryIds: string[]` (required), `primaryCategoryId?: string`, `hubIds?: string[]` (drop singular).
   - `UpdateTripPayload`: `categoryIds?: string[]`, `primaryCategoryId?: string`, `hubIds?: string[]` (drop singular `categoryId`).
2. **Grep & purge singular usage** — search the whole `components/dashboard/trips/` + `hooks/trips/` for `categoryId`/`hubId`/`categoryName`/`hubName` and migrate each to the array/primary forms. (Known sites: `trip-form.tsx`, `trip-details-tab.tsx`, `trip-columns.tsx`, the smart-hub prompt logic.)
3. **Create form (`trip-form.tsx`)** —
   - Category single-select → **MultiSelect with a primary marker** (F0.2). Zod: `categoryIds: z.array(z.string()).min(1, 'Select at least one category')`, `primaryCategoryId: z.string().optional()` with a `.refine` ensuring it's ∈ categoryIds (default to `categoryIds[0]` on submit if unset).
   - Hub single-select → **MultiSelect (0–n)**. Populate hub options for the chosen destination; optionally filter to hubs whose allowed-categories intersect the chosen categories (the backend enforces this — surface a friendly inline note rather than failing late). The old "smart hub prompt" (accept/decline single hub) is replaced by the multi-select; remove `useHubMatchForCategory` single-match branch or repurpose it as a suggestion.
   - Submit `categoryIds`, `primaryCategoryId`, `hubIds` (omit empty `hubIds` or send `[]`).
4. **Edit (`trip-details-tab.tsx` / `trip-edit-view.tsx`)** — same MultiSelect controls. Saving categories sends `categoryIds` (+ `primaryCategoryId`); a "make primary" action on an already-saved category can send `primaryCategoryId` alone. Saving hubs sends `hubIds`.
5. **List/table** — render `primaryCategoryName` (badge) + count of extra categories ("Boat Tours +2"); render `hubNames` as chips. Remove references to `categoryName`/`hubName`.
6. **Cards / breadcrumb / canonical** — use `primaryCategoryId`/`primaryCategoryName`.
7. **Drop `hubSlug`** — anywhere the tour-detail fetch passes `hubSlug`, remove it; resolve by `destinationSlug` + `slug` only. Remove any hub-nested tour route under `app/(frontend)/.../[hub]/[tour]/` if present (public track, but delete the dead route now).
8. **Publish-guard UX (Stage 8)** — before enabling the Publish button, check the same preconditions client-side (≥5 images, hero set, EN overview, ≥3 highlights, price present). Show a checklist of what's missing; still surface the API's 400 message array if the server rejects.
9. **CRO display (optional now, Stage 8)** — wire `bookingCountToday`/`spotsRemaining`/`lastBookedAt` into card badges when building public cards; in admin, optionally show them read-only on the detail header.

**Acceptance:** Create a trip with 2 categories (one primary) + 1 hub → succeeds; reload shows all three relations and the primary. Edit re-points primary and swaps hubs. Publishing a trip missing a price is blocked with a clear reason. No remaining references to singular `categoryId`/`hubId`/`hubSlug`.

---

## Phase F5 — Attributes module (Stage 6a — NEW module)

Two distinct UIs: a **dictionary admin** (system-level) and a **per-tour attribute editor** (on the trip detail).

**Backend (verified):**
- Dictionary (read `@Public`, write `MANAGE_SYSTEM`):
  - `GET /attributes?category={slug}&globalOnly=&filterableOnly=` → `AttributeDefinition[]`.
  - `GET /attributes/:key` · `POST /attributes` · `PATCH /attributes/:key` · `DELETE /attributes/:key` (soft-deactivate).
  - Definition shape: `{ id, key, displayName, dataType, allowedValues: string[], appliesToCategories: string[], isFilterable, isSortable, filterDisplayType, sortOrder, isActive }`.
  - Create requires `key` (snake_case `^[a-z][a-z0-9_]*$`), `displayName`, `dataType`; `allowedValues` required for `ENUM`/`ENUM_MULTI`.
- Per-tour (read `VIEW_TRIPS`, write `EDIT_TRIP`):
  - `GET /trips/:tripId/attributes` → `[{ key, value, displayName, dataType }]`.
  - `POST /trips/:tripId/attributes` body `{ attributes: [{ key, value }] }` (upsert; **ENUM_MULTI value is a comma-separated string** `"turtles,coral"`).
  - `DELETE /trips/:tripId/attributes/:key`.

**Files (new):** `types/attribute.ts`, `lib/api/attributes.ts`, `hooks/attributes/use-attributes.ts`, `components/dashboard/attributes/` (dictionary list/table/form/row-actions), `app/(dashboard)/dashboard/attributes/` (+ `/new`, `/[key]`), and a `components/dashboard/trips/trip-attributes-tab.tsx` for the per-tour editor.

**Steps:**
1. **Types** — `AttributeDefinition`, `CreateAttributeDefinitionPayload`, `UpdateAttributeDefinitionPayload` (+ `isActive`), `AttributeDefinitionQuery` (`category?`, `globalOnly?`, `filterableOnly?`), `TourAttribute` (`{ key, value, displayName, dataType }`), `SetTourAttributesPayload` (`{ attributes: { key: string; value: string }[] }`).
2. **API client** — the 5 dictionary calls + 3 per-tour calls, matching paths above.
3. **Hooks** — `useAttributes(query)`, `useAttribute(key)`, `useCreateAttribute/useUpdateAttribute/useDeactivateAttribute`; `useTripAttributes(tripId)`, `useSetTripAttributes(tripId)`, `useRemoveTripAttribute(tripId)`. Query keys: `['attributes', ...]`, `['trips', tripId, 'attributes']`.
4. **Dictionary admin screens** (gated `can('MANAGE_SYSTEM')`):
   - List page + table (key, displayName, dataType, filterable/sortable badges, sortOrder, active). RBAC: Add button, row Delete (deactivate), Danger Zone.
   - Create/edit form: `key` (create-only, snake_case validation, locked on edit), `displayName`, `dataType` `<Select>` (6), `allowedValues` (a tag/`MultiSelect`-style free-entry list — **shown only when dataType ∈ ENUM/ENUM_MULTI**, required then), `appliesToCategories` (MultiSelect of category slugs; empty = global), `isFilterable`/`isSortable` (Checkbox/Switch), `filterDisplayType` `<Select>` (4), `sortOrder` (number). Add the dictionary to the dashboard nav under a "System"/"Taxonomy" group.
5. **Per-tour attribute editor** (`trip-attributes-tab.tsx`, gated `can('EDIT_TRIP')`):
   - On open, fetch `GET /attributes?category={primaryCategorySlug}` to get applicable global + category-specific fields. (Need the primary category **slug** — derive from `primaryCategoryId` via the categories cache, or add slug to the trip response if missing.)
   - Render each definition by `dataType`/`filterDisplayType`: `BOOLEAN`→Switch; `ENUM`→Select/Radio; `ENUM_MULTI`→MultiSelect (submit as comma-joined string); `INTEGER`/`DECIMAL`→number input; `TEXT`→text input.
   - Prefill from `GET /trips/:id/attributes`. Save via `POST` upsert with `{ attributes: [{ key, value }] }` (join ENUM_MULTI arrays with `,`). Surface API validation errors (invalid value / unknown key) inline.

**Acceptance:** Admin can CRUD dictionary definitions; on a trip, the editor shows the right fields for the primary category, saves values, and rejects invalid ENUM values with the server message.

---

## Phase F6 — Collections module (Stage 7 — NEW module)

**Backend (verified):**
- Public: `GET /collections?destinationSlug=&locale=`; `GET /collections/slug/:slug?destinationSlug=&locale=` (returns detail + resolved `tours[]`); `GET /collections/:id/page-content?locale=`; `GET /collections/:id/faqs?locale=`.
- Admin: `POST /collections` (`CREATE_CONTENT`), `PATCH /collections/:id` (`EDIT_CONTENT`), `DELETE /collections/:id` (soft, `DELETE_CONTENT`), `DELETE /collections/:id/force` (`MANAGE_SYSTEM`); translations (`GET`/`GET :locale`/`PATCH :locale`/`DELETE :locale`, `EDIT_CONTENT`); `PATCH /collections/:id/page-content/:locale`; FAQ CRUD — all the same shape as category/hub.
- `CreateCollectionDto`: `destinationId` (req), `name` (req), `slug?`, `collectionType` (req, `MANUAL|DYNAMIC`), `tourIds?: string[]` (**MANUAL**), `filterQuery?: object` (**DYNAMIC**), `heroImage?`, `sortOrder?: string`. **Slug must not equal a category slug → 409.** `UpdateCollectionDto` adds `isActive?`.
- `filterQuery` example: `{ categoryId, attributes: { booking_type: 'private', boat_type: ['catamaran','yacht'] }, minPrice, maxPrice, durationMin, durationMax, ratingMin }`.

**Files (new):** `types/collection.ts`, `lib/api/collections.ts`, `hooks/collections/use-collections.ts`, `components/dashboard/collections/` (list/table/row-actions/form + translation/page-content/FAQ tabs — clone the category components), `app/(dashboard)/dashboard/collections/` (+ `/new`, `/[id]`). Add a nav entry.

**Steps:**
1. **Types** — `Collection`, `CollectionDetail` (+ `tours: unknown[]`/typed tour-card), `CreateCollectionPayload`, `UpdateCollectionPayload` (+ `isActive`), plus translation/page-content/FAQ types (reuse category's shapes).
2. **API + hooks** — all endpoints above; query keys `['collections', ...]`. Reuse the category translation/page-content/FAQ hook patterns verbatim.
3. **List + table** — name, destination, type badge (MANUAL/DYNAMIC), sortOrder, active. RBAC: Add (`CREATE_CONTENT`), row Delete (`DELETE_CONTENT`), force-delete + Danger Zone (`MANAGE_SYSTEM`).
4. **Create/edit form** —
   - `destinationId` `<Select>` (immutable on edit), `name`, slug field (create-only, auto-from-name, **inline warning if the slug matches an existing category slug** — check against `useActiveCategories()`/destination-scoped list; the server also enforces 409, surface it), `heroImage` (ImageSelectorField), `sortOrder` (`<Select>`: recommended/price_asc/price_desc/rating/newest — it's a string).
   - **`collectionType` toggle:**
     - **MANUAL** → MultiSelect of tours **with ordering** (reorderable list; submit `tourIds` in order). Populate from admin/my trips for that destination.
     - **DYNAMIC** → a filter-query builder reusing the attribute dictionary (category select + attribute filters + price/duration/rating ranges); serialize to the `filterQuery` object shape above. A "Preview matched tours" call to the public resolver is a nice-to-have.
5. **Translations / Page content / FAQ tabs** — clone category's `LocaleTab` + page-content + FAQ manager (same `{ fields: {...} }` payload, English-tab "Clear Fields" rule).

**Acceptance:** Create a MANUAL collection with ordered tours and a DYNAMIC one with a filter query; both save, reload, and translate. Slug colliding with a category slug is warned client-side and blocked by the server.

---

## Phase F7 — Stage 2 taxonomy cleanup (hardcoded slugs + icon map)

Mostly affects the **public** components, but do the data-hygiene now so nothing references dead slugs.

**Backend:** canonical **19** category slugs; renames `buggy-tours→off-road-tours`, `snorkeling-trips→snorkeling`; removed `private-charters`, `catamaran-trip`, `dolphin-encounters`. Bahamas added (data-driven).

**Known frontend hits (from grep):** `components/frontend/navbar.tsx` (`catamaran-trips`, `buggy-tours`), `components/frontend/editorial-banner.tsx` (`buggy`/`catamaran`/`snorkel` keys), `components/frontend/top-experiences.tsx` (`catamaranTrip`/`dolphin`), `app/(frontend)/[locale]/[destination]/tours/page.tsx` (`buggy-tours`), `app/(frontend)/[locale]/[destination]/page.tsx` (`buggy-tours`).

**Steps:**
1. Replace every hardcoded slug with a canonical one (or make it data-driven from the API).
2. Build a **category-icon map** keyed by the 19 canonical slugs (pairs with the new `icon` field from F2). Centralize it (e.g. `lib/constants/category-icons.ts`).
3. Ensure Bahamas appears wherever destinations are listed (should be automatic if data-driven).

**Acceptance:** No occurrences of `buggy-tours`, `snorkeling-trips`, `catamaran`, `dolphin`, `private-charters` remain in `frontend/` (except inside the icon map keyed by the new canonical slug); icon map covers all 19.

---

## Public-Site Track (separate — after admin panels)

These build the public site and consume the same backend; track in `05-FRONTEND-IMPACT-LOG.md`. Summary of the work and the exact endpoints (all `@Public`):

1. **Slug resolver route** — `app/(frontend)/[locale]/[destination]/[slug]/page.tsx`: call `GET /slug-registry/resolve?destinationSlug=&slug=` (`lib/api/slug-registry.ts` → `{ destinationSlug, slug, entityType, entityId }`, 404→`notFound()`), then switch on `entityType` → CategoryPage / HubPage / TourPage / CollectionPage / AllToursPage (RESERVED). See `SLUG-REGISTRY.md` §7.
2. **Category page (Stage 3)** — `GET /categories/destination/{dest}/{slug}` (404 on 0 published tours → `notFound()`); destination grid uses `GET /categories/destination/{dest}` (non-empty only).
3. **Tour page (Stage 5)** — `GET /trips/slug/{slug}?destinationSlug=&locale=` (flat; no `hubSlug`).
4. **Filters + sort (Stage 6b)** — `GET /filters/{dest}/{category}` for the sidebar (render by `filterDisplayType`, show counts, use `priceRange`/`durationRange` for sliders); push selections into `GET /trips?...` query (comma multi-values, dynamic attribute keys, `sort` ∈ recommended/price_asc/price_desc/rating/newest).
5. **Collection page (Stage 7)** — `GET /collections/slug/{slug}?destinationSlug=` → render `tours[]` + page content + FAQ.
6. **Search (Stage 8)** — `/search?q=&destination=` → `GET /search`.
7. **SEO/CRO rendering (Stage 8)** — JSON-LD per page type, breadcrumbs (tour crumb uses `primaryCategoryId`), per-locale sitemaps (exclude zero-tour categories), CRO badges from CRO fields. All data already exposed.

---

## Build / verify protocol

After each phase:
1. `pnpm --filter frontend build` (or the repo typecheck/lint) — zero TS errors.
2. Manually exercise the create + edit happy path for the touched module against the running backend (`pnpm dev:backend` on `:5050`).
3. Flip the matching row in `05-FRONTEND-IMPACT-LOG.md` 🔵→🟢 and tick the tracker below — same session.

---

## Progress tracker

| Phase | Module | Stage(s) | Status |
|---|---|---|---|
| F0.1 | Shared enums | 1/6/7 | ⬜ |
| F0.2 | MultiSelect primitive | 4/6a/7 | ⬜ |
| F1 | Destinations form | 1 | ⬜ |
| F2 | Categories form | 1 | ⬜ |
| F3 | Hubs form | 1 | ⬜ |
| F4 | Trips (multi-cat/hub, flat URL, publish guard) | 4/5/8 | ⬜ |
| F5 | Attributes (dictionary + per-tour) | 6a | ⬜ |
| F6 | Collections (CRUD) | 7 | ⬜ |
| F7 | Taxonomy cleanup + icon map | 2 | ⬜ |
| P1–P7 | Public-site track | 3/5/6b/7/8 | ⬜ |

> Legend: ⬜ not started · ⚠️ partial · ✅ done. Mirror status into `05-FRONTEND-IMPACT-LOG.md` Quick index.
