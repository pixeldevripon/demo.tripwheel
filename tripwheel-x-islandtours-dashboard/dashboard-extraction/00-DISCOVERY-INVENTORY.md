# Phase 0 - Discovery Inventory

> Facts only. No opinions, no proposals. Opinions are in `01-AUDIT-REPORT.md`.
> Scanned: 2026-07-17. Branch `dashboard-ui`. Root: `frontend/`.
> Every claim below is grounded in a file path; line refs given where load-bearing.

---

## 1. Scale

| Measure                                          | Count                     |
| ------------------------------------------------ | ------------------------- |
| Dashboard route files (`app/(dashboard)/**`)     | 42                        |
| Dashboard route pages (excl. layout)             | 41 across 21 modules      |
| Dashboard components (`components/dashboard/**`) | 166 files                 |
| Total dashboard `.tsx` (routes + components)     | 207                       |
| Of those, marked `'use client'`                  | **161 (77.8%)**           |
| Dashboard component LOC                          | ~35,328                   |
| `components/ui/` (shadcn)                        | 35 files, 4,518 LOC       |
| Trips module alone                               | 28 components, 10,363 LOC |

---

## 2. Route inventory

Base path today: `/dashboard/*`. Layout: `app/(dashboard)/dashboard/layout.tsx` (52 lines).

| Module                | Routes                                                                              |
| --------------------- | ----------------------------------------------------------------------------------- |
| overview              | `page.tsx`                                                                          |
| trips                 | `page.tsx`, `new/`, `[id]/` (redirect), `[id]/edit/`                                |
| destinations          | `page.tsx`, `new/`, `[id]/` (redirect), `[id]/edit/`                                |
| hubs                  | `page.tsx`, `new/`, `[id]/` (redirect), `[id]/edit/`                                |
| categories            | `page.tsx`, `new/`, `[id]/` (redirect), `[id]/edit/`                                |
| collections           | `page.tsx`, `new/`, `[id]/` (redirect), `[id]/edit/`                                |
| attributes            | `page.tsx`, `new/`, `[key]/edit/` (keyed by `key`, no detail route)                 |
| tour-operators        | `page.tsx`, `new/`, `[id]/` (redirect), `[id]/edit/`                                |
| bookings              | `page.tsx`                                                                          |
| payments              | `page.tsx`                                                                          |
| cancellation-requests | `page.tsx` (zero components; renders `<BookingsListView cancellationView />`)       |
| spotlight             | `page.tsx`                                                                          |
| locals-favourites     | `page.tsx`                                                                          |
| media                 | `page.tsx` (only module with `export const metadata`)                               |
| settings              | `page.tsx`                                                                          |
| profile               | `page.tsx`                                                                          |
| users                 | `page.tsx`, `new/page.tsx` - **stub** (static JSX, 8 lines each, no components dir) |
| reviews               | `page.tsx` - **stub**                                                               |
| leads                 | `page.tsx` - **stub**                                                               |
| enquiries             | `page.tsx` - **stub**                                                               |

All five `[id]/page.tsx` files are pure `redirect()` shims to `[id]/edit`.

### Adjacent surfaces that travel with the dashboard (per Phase-0 scope decision)

| Surface                                            | Files                                                |
| -------------------------------------------------- | ---------------------------------------------------- |
| `app/(login)/portal`                               | operator/admin login; dashboard guard redirects here |
| `app/(login)/staff`                                | staff login                                          |
| `app/(login)/apply`, `app/(login)/bookings`        | traveler-facing; **do not** travel (see 02)          |
| `app/onboarding/`                                  | operator onboarding; layout redirects here           |
| `components/onboarding/`                           | onboarding form                                      |
| `app/__backup(auth)/`, `components/__backup_auth/` | dead backup dirs                                     |

---

## 3. Coupling inventory

### 3.1 Dashboard imports FROM public site (hard blockers)

| File                                                            | Line | Import                                                    |
| --------------------------------------------------------------- | ---- | --------------------------------------------------------- |
| `components/dashboard/collections/collection-form.tsx`          | 24   | `TourBadgeChip` from `@/components/frontend/tour-badge`   |
| `components/dashboard/collections/collection-tour-select.tsx`   | 10   | same                                                      |
| `components/dashboard/collections/collection-tours-manager.tsx` | 17   | same                                                      |
| `components/dashboard/hubs/hub-comparison-manager.tsx`          | 17   | same                                                      |
| `components/dashboard/hubs/hub-our-picks-manager.tsx`           | 19   | same                                                      |
| `components/dashboard/hubs/hub-tour-select.tsx`                 | 9    | same                                                      |
| `lib/tours/listing.ts`                                          | 5    | `type TourListing` from `@/components/frontend/tour-card` |
| `lib/tours/listing.ts`                                          | 6    | `type TourBadge` from `@/components/frontend/tour-badge`  |

`lib/tours/listing.ts` is itself imported by 9 public files **and** the dashboard. Its own docstrings acknowledge the split: `deriveTourBadge` exists because "Admin tour rows don't carry a server-derived badge"; `formatTourSignals` is "Shared by the Collection, Our Picks and Comparison tour selectors" (all dashboard).

### 3.2 Public site imports FROM dashboard

None. `grep "@/components/dashboard" app/(frontend) components/frontend` returns zero.

One non-dashboard file does: `components/site-header.tsx:5-6` imports `ProfileDropdown` and `WeatherSlide` from `@/components/dashboard/*`. `site-header.tsx` is dashboard-only by usage but sits at `components/` root.

### 3.3 Genuinely shared modules (both trees import)

| Module                                                                | Public importers                    | Dashboard use                             |
| --------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------- |
| `lib/constants/locales`                                               | 56                                  | `ALL_LOCALES`, `LOCALE_LABELS`, `Locale`  |
| `lib/motion`                                                          | 49                                  | `pageEnter` only (`dashbaord-wraper.tsx`) |
| `lib/tours/listing`                                                   | 9                                   | `deriveTourBadge`, `formatTourSignals`    |
| `lib/currency/current`                                                | 6                                   | money display                             |
| `components/ui/calendar`                                              | 5                                   |                                           |
| `components/ui/popover`                                               | 5                                   |                                           |
| `lib/auth-client`                                                     | 4                                   | server actions + client                   |
| `lib/utils` (`cn`)                                                    | 3 direct, ~40 via `components/ui/*` | everywhere                                |
| `types/collection`                                                    | 2                                   | 8 dashboard importers                     |
| `types/hub`                                                           | 1                                   | 13 dashboard importers                    |
| `types/search`, `types/review`, `types/category`, `types/destination` | 1-6 each                            | 1-11 each                                 |

### 3.4 Files mixing both concerns (extraction blockers)

| File                         | Mixed concern                                                                                                                                                                                                                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/globals.css:4`          | `@import './(frontend)/frontend-tokens.css'` - loads 149 `--it-*` public tokens on every dashboard route. The imported file's own header (lines 1-4) says "Scope: (frontend) routes only / Import in (frontend)/layout.tsx - never in (dashboard) routes". `app/(frontend)/layout.tsx` does not import it. |
| `app/globals.css`            | 276 lines serving both trees; contains dashboard-only rules (`.sidebar-menu-item`, `[data-slot='sidebar']`, `.tox-*`)                                                                                                                                                                                      |
| `app/layout.tsx`             | Root layout for both trees; `metadata.title = 'Island Tours - Admin'`; declares 5 fonts; mounts `QueryProvider`/`ThemeProvider`/`TooltipProvider`/`Toaster` for both                                                                                                                                       |
| `proxy.ts`                   | One middleware holding `guardDashboard()` **and** the full public i18n redirect/rewrite scheme                                                                                                                                                                                                             |
| `lib/tours/listing.ts`       | Public mappers + dashboard-only derivations in one file                                                                                                                                                                                                                                                    |
| `components/site-header.tsx` | Dashboard chrome at `components/` root                                                                                                                                                                                                                                                                     |
| `components/skelitons/`      | Mixes `dashboard-skeleton`/`profile-skeleton`/`statistics-skeleton` with `tour-page-skeleton`/`checkout-page-skeleton`/`wishlist-skeleton`                                                                                                                                                                 |
| `components/` root           | `app-sidebar`, `nav-*`, `data-table`, `section-cards`, `chart-area-interactive`, `mode-toggle` are dashboard-only but sit beside `smooth-scroll.tsx` (public)                                                                                                                                              |

---

## 4. API + data layer

### 4.1 Two independent fetch stacks (already cleanly separated)

|               | `apiFetch` (`lib/api/fetch.ts`)                                | `publicGet`/`publicFetch` (`lib/api/public/fetch.ts`)                   |
| ------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Owner         | Dashboard                                                      | Public site                                                             |
| Context       | Browser                                                        | `import 'server-only'`                                                  |
| Base URL      | `${NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050'}/api/v1` | same                                                                    |
| Auth          | `credentials: 'include'` (session cookie)                      | `x-internal-api-key: INTERNAL_API_SECRET`                               |
| Retry         | `[300, 800]` + full jitter, **GET only**, on 429/503           | `[300, 800]` fixed, no jitter (no `Math.random()` inside `'use cache'`) |
| Errors        | throws `Error(message)`                                        | `publicGet` returns `null`, never throws                                |
| Caching       | none (TanStack Query owns it)                                  | none at fetch level (`'use cache'` scope owns it)                       |
| Next coupling | calls `revalidatePublicForPath()` on success (`:64`)           | `cacheTag()` in callers                                                 |

Third variant: `lib/server/auth-headers.ts` (`serverAuthHeaders`) forwards **both** cookie and internal key; used by server actions.

### 4.2 Dashboard API modules and backend endpoints

| Module                                  | Backend base paths                                                                                                                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `trips.ts` (519 LOC)                    | `/tours`, `/tours/:id/{images,addons,age-bands,languages,highlights,inclusions,exclusions,features,locations,pickup-locations,translations}`, `/tours/:id/{publish,pause,unpause,archive,restore}`, `/availability/{schedules,exceptions}` |
| `destinations.ts`                       | `/destinations`, `/destinations/:id/{translations,page-content,faqs,force}`                                                                                                                                                                |
| `categories.ts`                         | `/categories`, `/categories/destination/:slug`, `/categories/:id/{translations,page-content,faqs,force}`                                                                                                                                   |
| `collections.ts`                        | `/collections`, `/collections/:id/{translations,page-content,faqs,status,tours,resolved-tours,force}`                                                                                                                                      |
| `hubs.ts`                               | `/hubs`, `/hubs/:id/{translations,page-content,faqs,allowed-categories,content-sections,our-picks,comparison}`                                                                                                                             |
| `attributes.ts`                         | `/attributes`, `/tours/:tripId/attributes`                                                                                                                                                                                                 |
| `tiers.ts`                              | `/tiers/tours/:tourId/{tier,spotlight}`, `/tiers/admin/spotlight`                                                                                                                                                                          |
| `bookings-dashboard.ts`                 | `GET /bookings`, `POST /bookings/:id/cancel`, `GET /payments`                                                                                                                                                                              |
| `operators.ts` / `operator-settings.ts` | `/operators`, `/operators/:id/{company-info,stripe-config,mollie-config}`                                                                                                                                                                  |
| `settings.ts`                           | `/settings/{site,seo,social-media,company,payment/stripe,payment/mollie,smtp,mailchimp}`                                                                                                                                                   |
| `profile.ts`                            | `/users/me`, `/operators/:id/{company-info,social-media}`                                                                                                                                                                                  |
| `media.ts`                              | `/media-gallery`, `/media-gallery/{bulk,upload,sign,confirm}`                                                                                                                                                                              |
| `faq-groups.ts`                         | `${basePath}/:id/faqs/groups` (generic, 4 modules)                                                                                                                                                                                         |
| `locals-favourites.ts`                  | `/tours/admin/locals-favourite/stats`, `PATCH /tours/:tourId/locals-favourite`                                                                                                                                                             |
| `availability.ts`                       | `POST /availability/{check,calendar}` (shared with public)                                                                                                                                                                                 |

No dashboard module exists for `/reviews` or a `/users` list. Those pages are stubs.

Naming: the frontend calls the entity a "trip" throughout; the backend route base is `/tours`. `tripId` params post `{ tourId }` bodies (`lib/api/trips.ts:489`, `:512`).

### 4.3 Dashboard -> public-site cache bridge

The one runtime coupling from dashboard to public site:

1. `lib/api/fetch.ts:64` - every successful `apiFetch` fires `revalidatePublicForPath(path, method)`
2. `lib/api/cache-revalidation.ts:167-178` - no-op unless method is POST/PATCH/PUT/DELETE; maps path to tags; fire-and-forget (`void ...catch(() => {})`)
3. `app/_actions/revalidate.ts:57-61` - `'use server'` action calling `updateTag(tag)` (not `revalidateTag`, for immediate invalidation)
4. `lib/api/public/*` read with matching `cacheTag(...)`

Tag taxonomy (`app/_actions/revalidate.ts:14-45`):

- Coarse: `tours | search | hubs | categories | collections | destinations | reviews | slug-registry | site-info | user-profile`
- Granular: `tour:${id} | destination:${id} | hub:${id} | category:${id} | collection:${id} | operator:${id}`

### 4.4 Server actions (`app/_actions/`)

| File                   | Export                                             | Notes                                                                                                                               |
| ---------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `revalidate.ts`        | `revalidateCacheTags(tags)`                        | called over RPC from the browser                                                                                                    |
| `userActions.ts`       | `getUserProfile(cookie)`                           | React `cache()`-wrapped, NOT `'use cache'` (comment at `:41-48`: a cached `null` from a transient 429 would bounce logged-in users) |
| `userActions.ts`       | `setPasswordAction(newPassword)`                   |                                                                                                                                     |
| `onboardingActions.ts` | `checkOnboardingStatus()`, `onboardOperator(data)` |                                                                                                                                     |
| `dashboardActions.ts`  | `getDashboardStats()`                              | **hardcoded mock, no backend call**                                                                                                 |

### 4.5 Data-fetching style

Uniform. Every list/edit route is a thin server shim rendering a `*-view` / `*-client` client component. All entity data flows through TanStack Query hooks calling `apiFetch`. Zero `useEffect` fetching. Zero server-component entity fetches.

Exceptions:

- `layout.tsx` - server component, `await getUserProfile(cookie)` inside `<Suspense>`, redirects to `/portal` (null) or `/onboarding` (operator-less TOUR_OPERATOR)
- `page.tsx` (overview) - passes an **unawaited** `getDashboardStats()` promise to `<PageComponents statsPromise=... />`

`QueryClientProvider`: `components/providers/query-provider.tsx`, mounted in the **root** layout (`app/layout.tsx:73-84`), so it wraps both trees. Defaults: `staleTime: 30_000`, `retry: 2` (exp backoff, 10s cap), `refetchOnWindowFocus: true`, `mutations.retry: 0`.

Hooks: one directory per domain under `hooks/` (15 dashboard domains). `hooks/trips/use-trips.ts` is 921 LOC: 14 queries + 44 mutations, `tripKeys` factory at `:39-59`.

### 4.6 Forms

`react-hook-form@7.75` + `zod@4.4.3` + `@hookform/resolvers@5.2.2`.

Schemas are **colocated inline** in ~44 dashboard components. No `schemas/` directory. Only two shared schema files: `lib/validations/onboarding.ts`, `lib/validations/profile.ts`. No shared validation with the public site.

Repeated cast `as unknown as Resolver<T>` at `trip-form.tsx:170`, `trip-details-tab.tsx:380`, `trip-pricing-tab.tsx:532`, `:721`, `:783`.

### 4.7 Types

All hand-written, no codegen. They mirror backend DTOs by convention - `types/trip.ts:1-2`: "mirror the backend tours + tours/:tourId + availability contracts exactly. Backend route base is /tours (NOT /trips)."

Dashboard-only: `trip`, `media`, `enums`, `booking`, `attribute`, `operator`, `operator-settings`, `profile`, `settings`, `tier`, `faq`, `locals-favourite`, `slug-registry`.
Shared: `collection`, `hub`, `category`, `destination`, `search`, `review`.
Public-only: `tour-detail`, `facets`.

---

## 5. Auth and session

- `better-auth@1.6.9` referenced in exactly 2 files: `proxy.ts:7` (`getSessionCookie`) and `lib/auth-client.ts:1` (`createAuthClient`).
- `lib/auth-client.ts` - `baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'`; exports `authClient`, `signIn`, `signOut`, `useSession`.
- Cookie names never hardcoded. `proxy.ts` `clearSessionCookies()` matches by substring: `name.includes('session_token')`, `name.includes('session_data')` - covers `__Secure-` prefixes.
- Prod cookie domain default `.islandtours.esenc.cloud`, overridable via `COOKIE_DOMAIN` (`proxy.ts:126`). Comment says keep in sync with `backend/src/auth/auth.instance.ts` `crossSubDomainCookies.domain`.
- `guardDashboard()` is a **cookie-presence check only** - no backend call. Missing cookie -> `/portal`. Malformed cookie (not `<token>.<signature>`) -> `/portal` + clear. Authoritative validation is deferred to the layout.
- Server-side role resolution: `getUserProfile()` fans out `authClient.getSession()` + `GET /users/me` in parallel; role read from `sessionRes.data.user.role`; extra fetches for TOUR_OPERATOR/ADMIN. Returns `null` on any failure.
- `contexts/role-context.tsx` - `RoleProvider({ role })` resolves `ROLE_PERMISSIONS[role]` from `lib/config/rbac.ts` into `PermissionKey[]`; exposes `{ role, can, canAny }`. Default context is deny-all. 27 dashboard consumers.
- `lib/config/rbac.ts` header: "Mirrors backend: src/config/roles.config.ts + prisma/enums.prisma. Keep in sync."
- `navigations/navigations.ts` -> `filterNavigationByPermissions` (`lib/rbac-utils.ts`) -> `components/app-sidebar.tsx` (sole consumer).

### `proxy.ts` order of operations

1. `/dashboard*` -> `guardDashboard()`, return immediately (locale logic never applies)
2. Legacy redirects: `/login` -> `/portal`, `/forgot-password` -> `/portal/forgot`, `/reset-password` -> `/portal/reset`
3. `NON_LOCALIZED_PREFIXES = ['/dashboard','/onboarding','/bookings','/portal','/staff','/apply','/api']` -> pass through
4. Already locale-prefixed -> pass through
5. `/{destination}/thank-you/{ref}` and `/cancel/{ref}` -> rewrite to `/${DEFAULT_LOCALE}${pathname}`
6. Anything else -> redirect to `/{locale}{pathname}`, set `LOCALE_COOKIE`

Matcher: `['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)']`

---

## 6. Environment variables

| Var                                | Referenced at (dashboard paths)                                                                                                                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_BACKEND_URL`          | `lib/auth-client.ts:4`, `app/_actions/userActions.ts:8`, `app/_actions/onboardingActions.ts:8`, `lib/api/fetch.ts:9`, `lib/api/categories.ts:22`, `components/dashboard/media/media-uploader.tsx:24` |
| `INTERNAL_API_SECRET`              | `lib/server/auth-headers.ts:21`                                                                                                                                                                      |
| `NEXT_PUBLIC_OPEN_WEATHER_API_KEY` | `utils/weather.ts:229`, `:298`                                                                                                                                                                       |
| `NEXT_PUBLIC_STAGING_APP_URL`      | `components/dashboard/setup-guide.tsx:53`                                                                                                                                                            |
| `NODE_ENV`                         | `proxy.ts:124`, `:207`                                                                                                                                                                               |
| `COOKIE_DOMAIN`                    | `proxy.ts:126`                                                                                                                                                                                       |

---

## 7. Design tokens

### 7.1 `app/globals.css` (276 lines)

Color space: `oklch()` exclusively. Mixed notation (decimals `0.99` vs percentages `19.382%`).

Hue split: light neutrals on hue **80** (warm), dark neutrals on hue **260** (cool). Not a lightness inversion of one ramp.

| Group                | Tokens                                                                                                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core color           | `background`, `foreground`, `card(-foreground)`, `popover(-foreground)`, `primary(-foreground)`, `secondary(-foreground)`, `muted(-foreground)`, `accent(-foreground)`, `destructive`, `border`, `input`, `ring` |
| Sidebar              | 8 tokens                                                                                                                                                                                                         |
| Chart                | `--chart-1..5` - all purple-family, **identical in light and dark**                                                                                                                                              |
| Semantic (non-stock) | `--success`, `--warning`, `--info` + `-foreground` pairs; base values **identical in light and dark**                                                                                                            |
| Radius               | `--radius: 0.3rem` (`:root`), `0.2rem` (`.dark`) - radius changes with color theme                                                                                                                               |

`--primary`: `oklch(0.5417 0.179 288.0332)` (violet), identical in both modes.

**Not defined:** no spacing tokens, no typography tokens, no shadow tokens.

**Broken:**

- `globals.css:229-230` - `--shadow-2xl: var(--shadow-2xl)` and `--tracking-normal: var(--tracking-normal)` are self-referential with no source definition
- `--destructive-foreground` mapped in `@theme inline` (`:248`) but never defined
- `body { letter-spacing: var(--tracking-normal) }` (`:21`) resolves to nothing

### 7.2 `@theme inline` block (`globals.css:215-274`)

Maps: 5 fonts, 6 radius steps, 2 broken (`--shadow-2xl`, `--tracking-normal`), 38 colors (19 core + 8 sidebar + 5 chart + 6 semantic).

Not mapped: spacing, font-size, z-index, duration/easing.

Radius scale is a 1px-step ladder: `sm` = `calc(var(--radius) - 1px)` through `2xl` = `calc(var(--radius) + 4px)`. Total span 5px (0.2rem-0.55rem in light mode).

### 7.3 `app/(frontend)/frontend-tokens.css`

524 lines, 149 `--it-*` tokens, values in hex/rgba (a second color space). Header declares "(frontend) routes only".

Leak is **definition-only**: grep for `--it-` across `components/dashboard/**`, `app/(dashboard)/**`, `components/ui/**` returns **0 references**. Payload and `:root` pollution, no render impact.

### 7.4 Hardcoded value audit (243 dashboard-path files)

| Pattern                          | Count                 |
| -------------------------------- | --------------------- |
| Hardcoded hex                    | 12 (7 files)          |
| `rgb(` / `rgba(`                 | 0                     |
| `hsl(`                           | 1 (broken, see below) |
| inline `oklch(`                  | 0                     |
| Numeric Tailwind palette classes | **187 (30 files)**    |
| Inline `style={{`                | 24 (20 files)         |

Palette family distribution: amber 67, emerald 35, gray 26, red 20, green 15, rose 7, slate 5, sky 5, violet 4, neutral 2, blue 1. `components.json` declares `"baseColor": "zinc"`; zinc has **0** occurrences.

149 of 187 duplicate what `--warning`/`--success`/`--destructive`/`--info` already define.

Top offenders: `user-profile-dropdown.tsx` (30), `statistics.tsx` (28), `spotlight/spotlight-columns.tsx` (24), `trips/trip-schedules-tab.tsx` (13), `trips/trip-edit-view.tsx` (11).

Hex occurrences: `dashbaord-wraper.tsx:45` `#f1f4fa` (no dark variant), `:65` `#F4F7FB` (has dark variant), `#1a0dab` x5 (SERP-preview link blue, duplicated across 5 `*-seo-tab.tsx`), `ui/chart.tsx:68` `#ccc`/`#fff` (stock shadcn).

`ui/sidebar.tsx:478` - `shadow-[0_0_0_1px_hsl(var(--sidebar-border))]`. The tokens are authored as `oklch(...)` strings, so `hsl()` wrapping produces invalid CSS. The shadow does not render in either mode. Stock shadcn ships this assuming HSL-triplet tokens.

### 7.5 Typography

5 families declared in `app/layout.tsx`, all attached to `<html>`, all loaded on every route:

| Font                       | Var                     | Dashboard usages            |
| -------------------------- | ----------------------- | --------------------------- |
| Playfair Display           | `--font-heading`        | 70                          |
| JetBrains Mono             | `--font-jetbrains-mono` | 21                          |
| General Sans (local woff2) | `--font-general-sans`   | 3                           |
| Noto Sans                  | `--font-sans`           | 2 explicit (+ body default) |
| DM Sans                    | `--font-dm-sans`        | 1                           |

Font-size distribution (1,075 total):

| Class       | Count | Share     |
| ----------- | ----- | --------- |
| `text-xs`   | 688   | **64.0%** |
| `text-sm`   | 294   | 27.3%     |
| `text-lg`   | 47    | 4.4%      |
| `text-2xl`  | 36    | 3.3%      |
| `text-base` | 7     | 0.7%      |
| `text-3xl`  | 2     | 0.2%      |
| `text-xl`   | 1     | 0.1%      |

Arbitrary `text-[...]`: 55 occurrences, 8 distinct values. `text-[10px]` x23, `text-[13px]` x10, `text-[11px]` x6, `text-[18px]` x5, `text-[#1a0dab]` x5, `text-[14px]` x3, `text-[0.8rem]` x2, `text-[0.625rem]` x1. Three units in play (px, rem, hex).

### 7.6 Spacing

**59 distinct spacing values across 1,298 occurrences.**

| Scale      | Distinct | Total | Top 3                                                |
| ---------- | -------- | ----- | ---------------------------------------------------- |
| `gap-`     | 13       | 565   | `gap-2` (238), `gap-3` (97), `gap-4` (72)            |
| `p-`       | 11       | 93    | `p-0` (23), `p-3` (13), `p-2` (11)                   |
| `px-`      | 11       | 206   | `px-3` (65), `px-4` (42), `px-2` (35)                |
| `py-`      | 14       | 143   | `py-2` (51), `py-4` (23), `py-3` (20)                |
| `space-y-` | 10       | 291   | `space-y-4` (91), `space-y-3` (57), `space-y-2` (48) |

Half-steps (`0.5`/`1.5`/`2.5`) appear across all five scales: 143 occurrences.

Radius: `rounded-none` (82), `rounded-full` (44), `rounded-md` (23), `rounded-lg` (20), `rounded-sm` (16), `rounded-xl` (8), `rounded-2xl` (1).

Shadow: all resolve to Tailwind defaults; there are no shadow tokens.

### 7.7 Dark mode gaps

- **80 of 110 palette-class lines (72.7%) have no `dark:` variant.**
- `dashbaord-wraper.tsx:45` - `bg-[#f1f4fa]` with no dark override, on the outermost dashboard container. Lines 57 and 65 of the same file do handle dark.
- `--chart-1..5` identical in both modes; purple family tuned for white renders against `oklch(14% 0.02 260)` unchanged. `--chart-5` (L=0.4509) and `--chart-1` (L=0.5417) are the low-contrast cases.
- `--success`/`--warning`/`--info` base values identical in both modes; only `-foreground` flips.
- Typical light-only pattern: `-50`/`-100` bg with `-700`/`-800` text in `*-columns.tsx` status badges and `trip-*-tab.tsx` alert panels. Under `.dark` these keep light backgrounds while inheriting `--foreground: oklch(0.98 0 0)`, producing near-white on near-white.

---

## 8. shadcn inventory

`components.json`: `"style": "radix-sera"`, `"baseColor": "zinc"`, `"iconLibrary": "lucide"`, `"rsc": true`, plus non-standard `"menuColor"`/`"menuAccent"`. Imports use the unified `radix-ui@1.4.3` package (`Slot.Root`), not per-primitive `@radix-ui/react-*`.

### Heavily used

`button` (93), `skeleton` (61), `card` (61), `input` (55), `label` (53), `field` (49), `badge` (43), `select` (36), `tabs` (27), `textarea` (22), `dropdown-menu` (22), `checkbox` (21).

### Customized vs stock

| File               | Lines | Status                                                                                                                                                                                                                                                 |
| ------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `button.tsx`       | 65    | **Heavily customized** - base forces `text-xs font-medium tracking-widest uppercase` on every button; 8 sizes vs stock 4; `destructive` reworked to tinted `bg-destructive/10 text-destructive`; non-stock `has-data-[icon=inline-end]` padding system |
| `badge.tsx`        | 46    | **Radically de-chromed** - base is `rounded-none border-0 bg-transparent px-0 py-0`. All badges render as bare uppercase text with no pill or background. Uses `text-[0.625rem]`. Adds `ghost`/`link` variants.                                        |
| `table.tsx`        | 116   | Customized - `TableHead` is `h-12 px-3 text-xs font-medium tracking-wider uppercase` (stock: `h-10 px-2`, no uppercase); `TableCell` `p-3` (stock `p-2`); non-stock `has-aria-expanded:bg-muted/50` on `TableRow`. All colors are tokens.              |
| `tabs.tsx`         | 98    | Customized (pill variant per DASHBOARD-PATTERNS §8)                                                                                                                                                                                                    |
| `avatar.tsx`       | 112   | Customized (stock ~53)                                                                                                                                                                                                                                 |
| `multi-select.tsx` | 184   | **Custom** - not a shadcn primitive                                                                                                                                                                                                                    |
| remaining 29       |       | Stock                                                                                                                                                                                                                                                  |

### Unused by the dashboard (0 dashboard importers)

| File                             | Note                                                   |
| -------------------------------- | ------------------------------------------------------ |
| `progress.tsx`, `breadcrumb.tsx` | 0 importers repo-wide                                  |
| `sheet.tsx`                      | transitive only (`ui/sidebar.tsx`)                     |
| `drawer.tsx`                     | transitive only, via dead `data-table.tsx`             |
| `toggle.tsx`                     | transitive only (`ui/toggle-group.tsx`)                |
| `input-group.tsx`                | transitive only (`ui/command.tsx`)                     |
| `toggle-group.tsx`               | transitive only, via dead `chart-area-interactive.tsx` |
| `sonner.tsx`                     | root layout only                                       |
| `input-otp.tsx`                  | public site only                                       |

**Zero sheet/drawer usage. 21 dialog sites.**

### Icons: two libraries

| Library                                                 | Dashboard files |
| ------------------------------------------------------- | --------------- |
| `lucide-react@1.11`                                     | 105             |
| `@hugeicons/react@1.1.6` + `@hugeicons/core-free-icons` | 14              |

7 of the 14 hugeicons files are the `media/` module (a de-facto module convention). `components.json` declares lucide.

---

## 9. Table patterns

All 10 live dashboard tables use `@tanstack/react-table` + `@/components/ui/table`, each calling `useReactTable` + `flexRender` directly and rebuilding toolbar/body/pagination from scratch. Zero hand-rolled tables.

| Table             | Sort | Filter | RowSel | ColVis | Search             | Pagination | Skeleton | Bulk    | RowActions |
| ----------------- | ---- | ------ | ------ | ------ | ------------------ | ---------- | -------- | ------- | ---------- |
| destinations      | Y    | Y      | Y      | Y      | `TableSearchInput` | server     | Y        | 3       | Y          |
| hubs              | Y    | Y      | Y      | Y      | `TableSearchInput` | server     | Y        | 3       | Y          |
| categories        | Y    | Y      | Y      | Y      | `TableSearchInput` | server     | Y        | 3       | Y          |
| collections       | Y    | Y      | N      | Y      | `TableSearchInput` | **client** | **N**    | N       | N          |
| attributes        | Y    | Y      | N      | Y      | `TableSearchInput` | **client** | **N**    | N       | N          |
| spotlight         | Y    | Y      | N      | Y      | `TableSearchInput` | **client** | **N**    | N       | N          |
| operators         | Y    | N      | Y      | N      | **own `<Input>`**  | server     | Y        | partial | Y          |
| bookings          | Y    | N      | N      | Y      | `searchValue` prop | server     | Y        | N       | Y          |
| payments          | Y    | N      | N      | Y      | `searchValue` prop | server     | Y        | N       | **N**      |
| locals-favourites | Y    | Y      | N      | Y      | `searchValue` prop | server     | Y        | N       | inline     |

Three pagination strategies (server `manualPagination`, client `getPaginationRowModel()`, none). Three search implementations. `PAGE_SIZE_OPTIONS = [10, 20, 30, 50]` redeclared per table.

`components/data-table.tsx` - **813 lines, 0 importers repo-wide.** Stock shadcn dashboard-01 block demo (TanStack + `@dnd-kit` drag-reorder + Drawer detail + Recharts area chart + hardcoded `z` schema). Sole importer of `ui/drawer.tsx`.

---

## 10. Editor patterns

In-page shadcn `<Tabs>` for destinations/hubs/categories/collections/trips. Each `*-edit-view.tsx` declares `VALID_TABS`, validates `?tab=`, falls back to `'details'`.

| Module              | Tabs                                                                                                                                                 | Count  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| destinations        | Details, Translations, Page Content, SEO, FAQs                                                                                                       | 5      |
| categories          | Details, Sub-categories\*, Translations, Page Content, FAQs, SEO                                                                                     | 6      |
| collections         | Details, Tours, Translations, Page Content, FAQs, SEO                                                                                                | 6      |
| hubs                | Details, Allowed Categories, Translations, Our Picks, Comparison, Page Content, FAQs, SEO                                                            | 8      |
| **trips**           | Details, Pricing, Schedules, Images, Highlights, Inclusions & Exclusions, Itinerary, Pickups, Info & Terms, Attributes, Promotion, Translations, SEO | **13** |
| attributes          | none (single form)                                                                                                                                   | 0      |
| tour-operators      | `DashboardTabNav` with a **single tab**                                                                                                              | 1      |
| settings (admin)    | General, SEO, Social, Company, Payments, Integrations                                                                                                | 6      |
| settings (operator) | Company, Payments                                                                                                                                    | 2      |

\* conditionally rendered (`category-edit-view.tsx:66`).

**Tab state is read-once from `?tab=` and passed as `defaultValue`.** `<Tabs>` is uncontrolled, so switching tabs does not update the URL. Tabs are not linkable or bookmarkable; browser back exits the editor.

Tab-order inconsistency: destinations puts SEO before FAQs (with a justifying comment at `destination-edit-view.tsx:14`); categories/collections/hubs put FAQs before SEO.

---

## 11. Trips module structure (highest complexity)

28 components, 10,363 LOC, **all 28 are `'use client'`**.

### 11.1 Editor shell

`trip-edit-view.tsx` (431). Single flat `<Tabs>`, 13 tabs, **no grouping in the UI** (grouping exists only as comments at `:77-94`, `:358`, `:375`, `:401`). **No tab is gated or disabled.**

Header: status badge, lifecycle buttons (Publish/Pause/Unpause/Archive, gated on `can('MANAGE_TRIPS')`), warnings banner fed by `onWarnings` from Details, a "Published, not yet listed" notice when `LIVE && !isBookable`, and a 5-item Publish Readiness card shown only for `DRAFT` (`:302-322`): 5 images, hero set, 3 highlights, EN overview, price set.

### 11.2 Create flow

`app/(dashboard)/dashboard/trips/new/page.tsx` -> `trip-form.tsx` (704). **Single long form, one submit, no wizard, no draft-save.** ~30 fields rendered; **4 truly required**: `name` (>=3), `slug` (auto from name), `destinationId`, `categoryIds` (>=1). Conditionally required: `basePrice` + `wholeUnitType` when `pricingModel === 'UNIT'` (`:97-116`).

The form itself says most fields are optional (`:689-693`) while still rendering them.

After create: `router.push('/dashboard/trips/${created.id}/edit')` (`:286-289`) -> Details tab with 5 unmet readiness checks.

`trip-form.tsx` and `trip-details-tab.tsx` are near-identical field-for-field: both define `toSlug`, the same ~30-field schema, the same `CANCELLATION_VALUES`, the same conditional ON_ARRIVAL block. Payload builders (`trip-form.tsx:237-284`, `trip-details-tab.tsx:412-455`) are parallel copies.

### 11.3 Save model

**No global save. No autosave. Every tab submits independently; most tabs have multiple save buttons.**

| Tab                                   | Save model                                                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Details                               | 1 RHF form, **2 buttons** (`:863` and a duplicate inside the OCTO collapsible at `:1051`, both calling the same handler) |
| Details -> Guide Languages            | per-chip immediate                                                                                                       |
| Pricing                               | **3 independent forms** (basics, age-band add, add-on add); each row also saves itself                                   |
| Schedules                             | 3 sections, all immediate-per-action                                                                                     |
| Images                                | immediate per action; dialog has its own save                                                                            |
| Highlights/Inclusions/Exclusions/Info | add form + per-row delete + per-locale save                                                                              |
| Itinerary/Pickups                     | per-row "Save Details" + 7 per-locale saves                                                                              |
| Attributes                            | **the only true bulk save** in the module (`:157`)                                                                       |
| Translations                          | per-locale "Save Translation"                                                                                            |
| SEO                                   | per-locale "Save SEO" + separate OG save                                                                                 |

Request fan-out:

- Schedule creation loops `weekdays x startTimes` awaiting one POST per pair (`trip-schedules-tab.tsx:464-477`). 7 days x 3 times = **21 sequential requests**.
- Image add = 1 POST per image in a `forEach` (`trip-images-tab.tsx:80-108`).
- Image reorder = **2 PATCHes per arrow click** (`:155-184`).
- Start-time add/remove = full `PATCH /tours/:id` rewriting the `startTimes` array.

### 11.4 Child collections

| Collection                         | Pattern                                                                    | Reorder                         |
| ---------------------------------- | -------------------------------------------------------------------------- | ------------------------------- |
| Images                             | grid of cards, hover controls, `MediaSelector` dialog, `ImageEditDialog`   | **up/down arrows** (cap 24)     |
| Age bands                          | inline row, chevron-expand, **local `useState` per field**                 | n/a                             |
| Add-ons                            | same inline-expand, local `useState`                                       | n/a                             |
| Highlights                         | inline row + 7-locale `TranslationRow` panel (cap 6, "need at least 3")    | numeric `displayOrder` input    |
| Inclusions / Exclusions / Features | inline row + 7 `TranslationRow`s                                           | numeric `displayOrder` input    |
| Itinerary / Pickups                | inline row, chevron-expand to RHF form + 7 `DualTranslationRow`s           | numeric `displayOrder` input    |
| Schedules                          | flat rows grouped into **weekday sub-tabs** (Tabs inside Tabs inside Tabs) | n/a                             |
| Start times                        | badge chips + HH:MM text input; in-use times lock their remove control     | n/a                             |
| Exceptions                         | rows + type-driven conditional form (4 types x `timeMode` matrix)          | **no edit**, create/delete only |
| Attributes                         | dynamic inputs grouped by category                                         | n/a                             |

**No drag-and-drop anywhere in the module**, despite `@dnd-kit/*` being a dependency (used only by the dead `data-table.tsx`).

### 11.5 Click depth (from trips list)

| Task                           | Clicks                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| Publish a new tour             | **~25-30 across 5 tabs**, minimum                                                                  |
| Change one price               | 5 (via row-action deep link) / 6 (without)                                                         |
| Add a date exception           | 8-10, target card below two full-height cards on a 1,165-line tab                                  |
| Translate overview into German | 5, with no German source reference on screen; covers 1 of 13 fields on 1 of 7 translation surfaces |

Publish is always enabled regardless of readiness; the checks are advisory and the backend rejects. Passing all 5 checks still does not make a tour _listed_ - it needs schedules + capacity, surfaced only afterward via the `LIVE && !isBookable` banner (`trip-edit-view.tsx:284-299`). That is a 6th requirement absent from the readiness card.

Row actions (`trip-row-actions.tsx:103-123`) deep-link to 6 of 13 tabs via `?tab=`.

### 11.6 State ownership

Four coexisting systems:

1. **TanStack Query** - source of truth for server data (`use-trips.ts`, 921 LOC, 14 queries + 44 mutations)
2. **react-hook-form** - most forms, with the repeated `as unknown as Resolver<T>` cast
3. **local `useState`** - inconsistently substituted for RHF: `AgeBandRow` (8 `useState`s), `AddOnRow` (5), schedules add-form (6 + a manual `errors` object), `ExceptionsSection` (5 + errors), `TripAttributesTab`, `TripSeoTab` OG
4. **React Context** - `useRole()`

**Two hand-rolled validation systems coexist**: Zod in some rows, imperative `if (!HHMM.test(...))` in others (`trip-schedules-tab.tsx:423`, `:928`).

Prop drilling: `trip-edit-view.tsx` passes the whole `trip` object to 5 tabs and bare `tripId` to 6 others, so half re-derive from a prop and half re-query. `onWarnings={setWarnings}` is drilled up from `TripDetailsTab` to render a banner the tab cannot reach.

### 11.7 Files over 400 lines (7 of 28 = 4,873 lines = 47% of the module)

| File                     | Lines | Mixes                                                                                                                                                                                                                                        |
| ------------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trip-schedules-tab.tsx` | 1,165 | 3 unrelated managers + a locally-defined `DatePickerField` (`:80-121`) duplicating the shared `components/dashboard/date-picker-field.tsx` + the `scheduledSlotsForDate` availability algorithm (`:770-790`) - business logic in a view file |
| `trip-pricing-tab.tsx`   | 1,095 | 3 domains, 5 schemas, 5 RHF instances, 2 local-state row editors                                                                                                                                                                             |
| `trip-details-tab.tsx`   | 1,060 | ~30-field form + embedded Guide Languages manager (`:65-197`) + OCTO fields + `toSlug` + `durationHint` logic mirroring the public site                                                                                                      |
| `trip-form.tsx`          | 704   | near-duplicate of Details for the create path                                                                                                                                                                                                |
| `trip-images-tab.tsx`    | 523   | grid + card + edit dialog + reorder algorithm + media wiring                                                                                                                                                                                 |
| `trip-locations-tab.tsx` | 469   | row + form + 7-locale panel + add form + `numOrNull`/`numOrUndef`/`strOrNull` helpers copy-pasted verbatim into `trip-pickup-locations-tab.tsx:58-60`                                                                                        |
| `trip-edit-view.tsx`     | 431   | tab shell + lifecycle + readiness + 3 banners + archive dialog                                                                                                                                                                               |

`trip-translations-tab.tsx` (420) restates the same 13-field list **four times**: schema (`:26-40`), `EMPTY_FORM` (`:44-58`), reset block (`:97-111`), payload (`:119-133`).

### 11.8 Dead code in trips

`trip-content-tab.tsx` (255) and `trip-languages-tab.tsx` (205) are imported by nothing. `LanguagesCard` was inlined into `trip-details-tab.tsx:65-197` instead.

---

## 12. The 7-locale workflow

Locales: `['en','es','nl','pt','fr','de','zh']` (`lib/constants/locales.ts:4`). `LOCALE_LABELS` is commented "English labels (admin UI)" - the admin interface itself is English-only; the 7 locales are a **content translation workflow**, not an i18n system.

### 12.1 Trip translations tab

`<Tabs defaultValue="en">` with 7 triggers (`:392-397`), one `<TabsContent>` per locale, each rendering an independent `<LocaleTab>` with its own `useTripTranslationByLocale` query, its own RHF form, and its own "Save Translation" button (`:369`).

**13 translatable fields** (`:26-40`): `title`, `overview` (required for publish, EN only), `description`, `shortDescription`, `whatToBring`, `knowBeforeYouGo`, `notSuitableFor`, `whatToExpectIntro`, `categoryDisplay`, `localTipTitle`, `localTipBody`, `operatorNote`, `meetingPointText`. Three are `string[]` on the backend, edited as newline-delimited textareas (`linesToArray`/`arrayToLines`, `:61-71`).

**No source text is shown.** The German tab renders 13 empty inputs with placeholder "Overview in German". The English text appears nowhere on that tab.

### 12.2 Machine translation

**No machine-translation affordance exists anywhere in the app.**

`isMachineTranslated` exists across the type layer (`types/trip.ts`, 14 occurrences) and renders a read-only badge (`trip-translations-tab.tsx:204-209` and identically in `trip-seo-tab.tsx:252`, destinations `:139`, categories `:139`, hubs `:145`, collections `:169`). The flag is settable via `UpsertTripTranslationPayload.isMachineTranslated` (`types/trip.ts:664`) but **no UI ever sets it**.

`grep -E "autoTranslate|translateAll|deepl|openai"` across `components lib hooks types`: **zero hits**.

The SEO tab's "Regenerate" (`trip-seo-tab.tsx:282`) is client-side `truncate(collapse(...))` of already-entered text, not translation.

(For context: `CLAUDE.md` lists "AI translation" as planned BullMQ work, so the backend roadmap anticipates this.)

### 12.3 Translation surfaces per tour

Translated content is spread across **7 tabs**, each with per-locale, per-row saves:

| Surface                 | Structure                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Translations tab        | 7 locale tabs x 13 fields x 1 save                                                                                 |
| Highlights              | `TranslationRow` x 7 locales x up to 6 rows, each row a separate form with its own save (`translation-row.tsx:39`) |
| Inclusions              | same                                                                                                               |
| Exclusions              | same                                                                                                               |
| Info & Terms (features) | same                                                                                                               |
| Itinerary               | `DualTranslationRow` (title + description) x 7 x N (`dual-translation-row.tsx`)                                    |
| Pickups                 | `DualTranslationRow` (title + directions) x 7 x N                                                                  |
| SEO                     | 7 locale tabs x 1 save                                                                                             |

Each row must be expanded first (`setExpanded`, e.g. `trip-highlights-tab.tsx:42`).

**Measured cost:** a tour with 5 highlights, 5 inclusions, 3 exclusions, 4 itinerary stops and 2 pickups, translated into 6 non-English locales = **300+ clicks and ~120 discrete save requests**, across 7 tabs, with no progress indicator and no way to see which locales are complete.

### 12.4 Cross-module: duplicated, not shared

**There is no shared `LocaleTab`.** It is redefined from scratch in 5 modules:

| File                                            | Def at |
| ----------------------------------------------- | ------ |
| `trips/trip-translations-tab.tsx`               | `:80`  |
| `destinations/destination-translation-form.tsx` | `:39`  |
| `categories/category-translation-form.tsx`      | `:39`  |
| `hubs/hub-translation-form.tsx`                 | `:40`  |
| `collections/collection-translation-form.tsx`   | `:41`  |

All five share the same skeleton (`ALL_LOCALES.map` -> `TabsTrigger`; EN special-cased with `disableNameField`/`isEnglish`; per-locale RHF form; `useEffect` reset on data; upsert-or-delete; machine-translated badge) with hand-copied field lists and per-module schemas.

`destination-translation-form.tsx` (272) vs `category-translation-form.tsx` (272): **identical except identifier renames.** Full diff is ~30 lines, every one mechanical (`destinationId`->`categoryId`, hook rename, and one copy string at `:173`: "destination page"->"category page").

`components/dashboard/rationale-translation-tabs.tsx` (97) is a sixth variant.

Trips is the only module whose child collections are translatable, hence `translation-row.tsx` (42) + `dual-translation-row.tsx` (62) exist nowhere else.

---

## 13. Duplication hotspots (measured by `diff`)

| #   | Cluster                           | Files                                           | Total LOC | Evidence                                                                                                  |
| --- | --------------------------------- | ----------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------- |
| 1   | Translation forms                 | 4                                               | ~1,145    | dest(272) vs cat(272) diff = ~30 lines, all renames                                                       |
| 2   | SEO tabs                          | 4                                               | ~1,448    | dest(362) vs cat(366) diff = 139; vs hub(361) = 133; vs coll(359) = 137. All within 7 lines of each other |
| 3   | Table scaffolds                   | 10                                              | -         | dest(352) vs cat(332) diff = 138; vs hubs(361) = 202                                                      |
| 4   | Row actions                       | 3+                                              | -         | dest(185) vs cat(185) diff = 139                                                                          |
| 5   | Quick-edit dialogs                | 3                                               | 422       | dest(142) vs cat(142) diff = 64                                                                           |
| 6   | Delete confirms                   | **4 competing abstractions** + 4 clone wrappers | -         | see below                                                                                                 |
| 7   | Status badges                     | 4 conventions                                   | -         | see below                                                                                                 |
| 8   | List-view shells                  | 4+                                              | -         | dest vs cat diff = 18; bookings vs payments = the same 500ms-debounce state machine written twice         |
| 9   | Detail shells                     | 4                                               | ~200      | dest(51) vs cat(50) diff = 32                                                                             |
| 10  | `trip-form` vs `trip-details-tab` | 2                                               | 1,764     | near-identical field-for-field                                                                            |

### 13.1 Four competing delete-confirm abstractions

1. `confirm-dialog.tsx` (72) - generic `ConfirmDialog`. Docstring: "Reusable confirmation dialog for any potentially-destructive dashboard action." Consumers: **only** `booking-row-actions.tsx`, `locals-favourites-table.tsx`.
2. `common/deactivate-dialog.tsx` (70) - used by the per-entity delete dialogs
3. `common/force-delete-dialog.tsx` (76)
4. `media/delete-confirmation-dialog.tsx` (55) - media's private fork

On top of #2 sit four thin wrappers that are themselves clones: `destination-delete-dialog.tsx` / `category-delete-dialog.tsx` / `hub-delete-dialog.tsx` (all 47 lines, mutual diff = 44 = only the entity noun) and `operator-delete-dialog.tsx` (52, diff 55). Each re-wraps `DeactivateDialog`, re-does the same toast pair, re-types the same props, and duplicates the long `preservationNote` prose.

Two different primitives are used for semantically identical destructive confirms: `Dialog` and `AlertDialog`.

### 13.2 Four status-badge conventions

| File                           | Shape                                                         |
| ------------------------------ | ------------------------------------------------------------- |
| `booking-columns.tsx:20,33,43` | `statusVariant` + `statusDot` + `statusLabel`                 |
| `payment-columns.tsx:10,23`    | `statusVariant` + `statusLabel`                               |
| `spotlight-columns.tsx:47`     | `statusStyles` (different shape and name)                     |
| `destination-columns.tsx:89`   | inline ternary `variant={isActive ? 'default' : 'secondary'}` |

No shared `StatusBadge`. This is a direct consequence of `badge.tsx` being de-chromed: the primitive carries no semantic color, so call sites hand-roll `bg-amber-100`/`text-emerald-700`.

### 13.3 Genuinely shared (the successes)

| Component                        | LOC | Consumers                                                                                                                               |
| -------------------------------- | --- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `faq/faq-manager.tsx`            | 477 | all 4 entity modules, identically: `<FaqManager basePath="/destinations\|/hubs\|/collections\|/categories" entityId={id} />`. No forks. |
| `media/image-selector-field.tsx` | 296 | 10 consumers across settings, destinations, hubs, collections, categories                                                               |
| `table-search-input.tsx`         | 67  | 6 of 10 tables                                                                                                                          |
| `rationale-translation-tabs.tsx` | 97  | 3 (hub-our-picks, hub-comparison, collection-tours)                                                                                     |
| `common/deactivate-dialog.tsx`   | 70  | shared, but only reachable through 4 duplicated wrappers                                                                                |

---

## 14. Dead and orphaned code

| File                                                                     | LOC | Status                                                                   |
| ------------------------------------------------------------------------ | --- | ------------------------------------------------------------------------ |
| `components/data-table.tsx`                                              | 813 | **0 importers repo-wide**                                                |
| `components/dashboard/common/image-upload-selector.tsx`                  | 235 | **0 external importers**; superseded by `media/image-selector-field.tsx` |
| `components/dashboard/trips/trip-content-tab.tsx`                        | 255 | 0 importers                                                              |
| `components/dashboard/trips/trip-languages-tab.tsx`                      | 205 | 0 importers                                                              |
| `components/section-cards.tsx`                                           | -   | 0 importers                                                              |
| `components/chart-area-interactive.tsx`                                  | -   | 0 importers; sole importer of `ui/toggle-group.tsx`                      |
| `components/dashboard/locals-favourites/locals-favourites-list-view.tsx` | 66  | likely superseded by `locals-favourites-view.tsx`                        |
| `app/__backup(auth)/`, `components/__backup_auth/`                       | -   | backup dirs still in the graph                                           |

> `lib/api/cache-revalidation.ts` is **NOT dead** - verified `lib/api/fetch.ts:7` imports it. An earlier scan reported zero importers; that was wrong. Do not delete it.

**Total confirmed dead: >1,574 LOC.**

Other artifacts:

- `dashbaord-wraper.tsx` - filename typo, shipped
- `components/skelitons/` - directory name typo, shipped
- `tsconfig.json:include` references `app/(dashboard)/_dashboard/layout.js`, which does not exist on disk
- `lint_errors.log` (45,724 bytes) committed at `frontend/` root

---

## 15. Mock and stub inventory

| Item                                   | State                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/_actions/dashboardActions.ts`     | `getDashboardStats()` returns a **fully hardcoded object literal**: `totalRevenue: 125000.50`, `bookings.total: 1240`, `recentBookings` with `'John Doe'` / `'Bali Adventure'` / `BK-1234`, `recentCustomers` with `alice@example.com`. Live-wired into the dashboard home (`page.tsx:1,18,22`). Calls `new Date()` inside a server action (`:49,57,67,79`). |
| `components/dashboard/statistics.tsx`  | `:81` "Generate mock historical data based on current values". `:408` and `:516` contain `\|\| true ? ( // Forced true for mock visualization` - forcing chart branches on regardless of data.                                                                                                                                                               |
| `reviews/page.tsx`                     | stub, static JSX                                                                                                                                                                                                                                                                                                                                             |
| `users/page.tsx`, `users/new/page.tsx` | stub, static JSX                                                                                                                                                                                                                                                                                                                                             |
| `leads/page.tsx`                       | stub, static JSX                                                                                                                                                                                                                                                                                                                                             |
| `enquiries/page.tsx`                   | stub, static JSX                                                                                                                                                                                                                                                                                                                                             |
| `trip-promotion-tab.tsx:49`            | `SHOW_DEMAND_BADGE_OVERRIDE = false` - DemandBadgeCard is dead behind a flag                                                                                                                                                                                                                                                                                 |

---

## 16. Confirmed defects found during discovery

> Reported, not fixed. Carried into `01-AUDIT-REPORT.md` with severity.

**D-1. `PATCH /settings/site` never busts the public `site-info` cache. [VERIFIED]**
`lib/api/cache-revalidation.ts` declares `case 'settings'` **twice**: `:142` (pushes `user-profile`, then `break`) and `:150` (pushes `site-info` when `seg1 === 'site'`). In a JS `switch`, the first matching case wins, so `:150-152` is unreachable dead code and every `/settings/*` write - including `PATCH /settings/site` - pushes only `user-profile`. `lib/api/public/settings.ts:37-39` tags `getPublicSiteInfo` with `cacheTag('site-info')` + `cacheLife('days')`. A Settings -> General save (logo, WhatsApp, Instagram - read by the footer and every NeedHelp surface) serves stale values for up to the `days` window. This is precisely the scenario the comment at `revalidate.ts:23-25` says must not happen.

**D-2. `ui/sidebar.tsx:478` shadow is invalid CSS.**
`shadow-[0_0_0_1px_hsl(var(--sidebar-border))]` wraps oklch-authored tokens in `hsl()`. Renders nothing in both modes.

**D-3. `--destructive-foreground` mapped but never defined** (`globals.css:248`).

**D-4. `--tracking-normal` undefined**, yet applied to `body` (`globals.css:21`, mapped `:230`).

**D-5. `--shadow-2xl: var(--shadow-2xl)`** - self-referential, no source (`globals.css:229`).

**D-6. `dashbaord-wraper.tsx:45`** - `bg-[#f1f4fa]` with no `dark:` variant on the outermost dashboard container.

**D-7. `statistics.tsx:408,516`** - `|| true ?` forces mock chart branches on in production.

**D-8. `bookings-dashboard.ts:16-29`** defines a local `buildQuery` duplicating `lib/api/query.ts:8`.

**D-9. `refundDue` and `paymentModelLabel`** are exported from `booking-columns.tsx` (a columns file) and imported by row-actions and the details dialog. Business logic in a view file.

**D-10. `collections` has full CRUD (594-line form) and zero client-side RBAC gating** - no `useRole` import anywhere in the module.

---

## 17. Documented-but-unverified

Items I could not confirm within Phase 0 and that must not be assumed:

1. **Accessibility.** No axe run, no keyboard-trap sweep, no screen-reader pass, no focus-order audit was performed. The a11y findings in `01-AUDIT-REPORT.md` are limited to what static analysis evidences (type size, color-only semantics, contrast math). **A real audit is a Phase-1 gap, not a completed activity.**
2. **`locals-favourites-list-view.tsx`** - orphan status inferred, not proven.
3. **Runtime bundle sizes** - no `@next/bundle-analyzer` run. Client-component counts are a proxy, not a measurement.
4. **Whether `app/(login)/apply` and `app/(login)/bookings` are traveler-facing** - inferred from route names and `proxy.ts` prefix handling.
5. **`components/dashboard/weather-slider.tsx` + `utils/weather.ts`** - a live OpenWeather widget in the admin header. Its product rationale is unknown; it carries an env var and an external network dependency into the standalone app.

