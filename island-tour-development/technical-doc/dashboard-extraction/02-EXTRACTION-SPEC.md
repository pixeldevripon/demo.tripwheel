# Phase 2 - Extraction Specification

> The primary deliverable. Target: lift the dashboard into an empty repository and have it run with
> zero functional regression.
>
> Cross-domain cache revalidation is specified separately in `02B-CACHE-REVALIDATION-SPEC.md`.

---

## 0. Confirmed parameters

| Parameter | Decision |
|---|---|
| Split target | **Own repo, now.** Hard cut. Duplicate what must be duplicated; no shared-package ceremony. |
| Dashboard origin | `https://dashboard.islandtours.esenc.cloud` |
| Backend origin | `https://api.islandtours.esenc.cloud` |
| Public site origin | `https://islandtours.esenc.cloud` |
| Auth | Cookie-based, cross-subdomain on `.islandtours.esenc.cloud` - **the current default; no change needed** |
| Target topology (deferred) | `island.tours` + `dashboard.tripwheel.io` + `api.tripwheel.io` - planned separately in **`02C-CROSS-DOMAIN-AUTH-SPEC.md`** |
| Base path | Root `/` (not `/dashboard`) |
| Travels with dashboard | `app/(login)/portal`, `app/(login)/staff`, `app/onboarding`, media gallery |
| `components/ui/` | **Fork.** Dashboard owns its copy and diverges. |
| Dark mode | Keep, both palettes to WCAG AA |
| Deploy | Dockerfile + Next `output: 'standalone'`; Vercel noted as drop-in |
| Backend changes | **None.** New endpoints go in an appendix as requests, not code. |

---

## 1. Domain topology and its consequences

**Interim (the decision in force):**

```
                    ┌────────────────────────────────────┐
                    │   api.islandtours.esenc.cloud      │
                    │   NestJS + Postgres                │
                    └──────┬───────────────────┬─────────┘
           same-site       │                   │      same-site
   (cookie: .islandtours.esenc.cloud - covers all three)
                    ┌──────┴──────────┐  ┌─────┴──────────────┐
                    │ dashboard.      │  │ islandtours.       │
                    │ islandtours.    │  │ esenc.cloud        │
                    │ esenc.cloud     │  │ public storefront  │
                    └─────────────────┘  └────────────────────┘
                            │                     ▲
                            └─────────────────────┘
                     revalidation (server-to-server) - see 02B
                     NOTE: needed even here. Two apps = two caches,
                     regardless of domain. This is process separation.
```

**Target (deferred, planned in `02C`):** `island.tours` + `dashboard.tripwheel.io` +
`api.tripwheel.io`. Two registrable domains, one auth server. The public leg becomes cross-site and
loses cookies. See `02C-CROSS-DOMAIN-AUTH-SPEC.md`.

### 1.1 All three hosts share one apex. No auth changes needed.

`islandtours.esenc.cloud`, `dashboard.islandtours.esenc.cloud` and `api.islandtours.esenc.cloud` share
the registrable domain `islandtours.esenc.cloud`. Everything is **same-site**: the
`.islandtours.esenc.cloud` cookie covers all three, `credentials: 'include'` works from both frontends,
and `guardDashboard` can read the cookie server-side. `SameSite=Lax` is sufficient.

**This is already the configured default** - `auth.instance.ts:196` defaults `COOKIE_DOMAIN` to
`.islandtours.esenc.cloud`, and the comment at `:182-195` documents this exact design (including why
the scope is the project apex and not the bare `.esenc.cloud`: cookie-tossing blast radius).

Config to confirm at split time (all environment, no code):

| Where | Value |
|---|---|
| Backend `COOKIE_DOMAIN` | `.islandtours.esenc.cloud` (**the current default - unchanged**) |
| Backend `CORS_ORIGINS` | must include `https://dashboard.islandtours.esenc.cloud` alongside the public origin |
| Dashboard `COOKIE_DOMAIN` | `.islandtours.esenc.cloud` (consumed at `proxy.ts:126` for `clearSessionCookies`) |
| Dashboard `NEXT_PUBLIC_BACKEND_URL` | `https://api.islandtours.esenc.cloud` |

`main.ts` must keep `credentials: true` (critical rule #13).

> `CORS_ORIGINS` feeds **both** `main.ts:43` (CORS) and `auth.instance.ts:17` (Better Auth
> `trustedOrigins`). One var, two consumers. Miss a host and you get either a CORS failure or a Better
> Auth origin rejection - which look nothing alike and are debugged very differently.

### 1.2 Public site <-> API: cross-site IF the public site moves to `island.tours`.

> **DECISION 2026-07-17: the public site stays on a `tripwheel.io` subdomain for now.** Everything
> below therefore describes a **deferred risk, not a current break**. On a `tripwheel.io` subdomain
> the public site is same-site with `api.tripwheel.io`, the `.tripwheel.io` cookie covers it, and
> `credentials: 'include'` keeps working. **Nothing breaks.** This section is retained as the
> mandatory pre-read for whoever plans the `island.tours` move.

**What changes the day the public site moves to `island.tours`:**

`island.tours` and `api.tripwheel.io` have **different registrable domains**. A cookie cannot span two eTLD+1s - there is no `Domain` value that covers both. `crossSubDomainCookies` cannot help; the name says subdomain and that is the limit.

So any browser request from `island.tours` to `api.tripwheel.io` carrying `credentials: 'include'` is a **third-party cookie** request.

**Confirmed affected call sites (browser context, public site):**

| File | Line | What breaks |
|---|---|---|
| `lib/api/wishlist.ts` | 16 | `credentials: 'include'` - the entire traveler wishlist |
| `lib/api/categories.ts` | 86 | `credentials: 'include'` |
| `components/frontend/wishlist-provider.tsx` | - | `authClient` session |
| `components/frontend/login/auth-form.tsx` | - | traveler login |
| `components/frontend/login/operator-forgot.tsx`, `operator-reset.tsx` | - | password flows |

**Failure profile:**

| Browser | Result |
|---|---|
| Safari (ITP) | **Blocked today.** Third-party cookies are off by default. |
| Firefox (Total Cookie Protection) | **Blocked today.** |
| Chrome | Works today; degrading as third-party cookie restrictions roll out. |
| Localhost dev | **Works** - `localhost:3000` -> `localhost:5050` is same-site. |

That last row is why this must be written down: **development will never reproduce it.** It appears only in production, only on some browsers, as "the wishlist heart doesn't stick."

**Options (public-site team's decision, not this project's):**

| # | Option | Cost | Verdict |
|---|---|---|---|
| A | Serve the API at `api.island.tours` as well (same backend, second hostname) | DNS + cert + CORS entry | **Recommended.** Makes both frontends same-site with their own API hostname. Cheapest correct fix. |
| B | Proxy `/api/*` on `island.tours` through the public Next app to the backend | A route handler + latency hop | Works. Adds a hop and makes the public Next app an auth-critical path. |
| C | Token-based auth (bearer in memory/localStorage) for travelers only | Auth rework + XSS surface | Last resort. |
| D | Do nothing | Wishlist and traveler login silently broken for Safari/Firefox users | Not viable |

> **SUPERSEDED. This table is retained only to show the reasoning that was corrected.**
>
> A previous draft recommended option A ("serve the API at `api.island.tours` too") as "the cheap
> correct one". **That was wrong.** Reading the installed Better Auth source
> (`dist/cookies/index.mjs:22`) shows the cookie `domain` is a single value resolved from a closure -
> either the static `crossSubDomainCookies.domain` or the baseURL hostname. **One instance cannot emit
> cookies for two registrable domains**, so option A alone fixes the public leg and *breaks* the
> dashboard's server-side cookie read.
>
> **The corrected analysis, with the full option set and an evidence table, is
> `02C-CROSS-DOMAIN-AUTH-SPEC.md`.** Its recommendation is **bearer tokens for the public site**,
> because `bearer()` is already enabled at `auth.instance.ts:177` and the public site already never
> reads the session server-side.

**Current action: none required.** All three hosts share `.islandtours.esenc.cloud`, so nothing is
broken and nothing needs changing. The `island.tours` move is a separate future project - see `02C`.

**The trap to carry into that project:** localhost can never reproduce this
(`localhost:3000` -> `localhost:5050` is same-site, and `crossSubDomainCookies.enabled` is gated on
`NODE_ENV === 'production'` at `auth.instance.ts:195`, so the path is off in dev entirely). The failure
is silent and appears only in production, only on Safari/Firefox, as "the wishlist heart doesn't
stick". **Do not discover this during a cutover.**

### 1.3 Server-to-server calls are unaffected

`lib/api/public/fetch.ts` runs under `import 'server-only'` and authenticates with `x-internal-api-key`, not cookies. Cross-domain is irrelevant to it. The public site's SSR/ISR data path keeps working exactly as-is.

---

## 2. Target repository structure

```
tripwheel-dashboard/                    # new repo, root = the app (no monorepo)
├── app/
│   ├── layout.tsx                      # NEW: dashboard-only root layout
│   ├── globals.css                     # NEW: dashboard-only token system (see 03)
│   ├── not-found.tsx · error.tsx · loading.tsx
│   ├── (auth)/                         # unauthenticated surfaces
│   │   ├── layout.tsx
│   │   ├── portal/                     # from app/(login)/portal
│   │   └── staff/                      # from app/(login)/staff
│   ├── onboarding/                     # from app/onboarding
│   └── (app)/                          # authenticated dashboard, served at /
│       ├── layout.tsx                  # from app/(dashboard)/dashboard/layout.tsx
│       ├── page.tsx                    # overview
│       ├── tours/                      # renamed from trips (see §9)
│       ├── destinations/ · hubs/ · categories/ · collections/ · attributes/
│       ├── bookings/ · payments/ · cancellation-requests/
│       ├── spotlight/ · locals-favourites/
│       ├── media/ · operators/ · users/ · reviews/
│       ├── settings/ · profile/
│       └── translations/               # NEW: the translation console (see 04)
├── components/
│   ├── ui/                             # FORKED shadcn, dashboard-owned
│   ├── shell/                          # sidebar, header, nav-*, profile dropdown
│   ├── data-table/                     # ONE table system (see 05)
│   ├── common/                         # StatusBadge, ConfirmDialog, EntityForm scaffolds
│   └── <module>/                       # tours/, destinations/, hubs/, ...
├── contexts/role-context.tsx
├── hooks/<domain>/
├── lib/
│   ├── api/                            # apiFetch + per-module clients
│   ├── config/rbac.ts
│   ├── i18n/locales.ts                 # reduced copy (see §4)
│   ├── auth-client.ts
│   ├── cache/                          # revalidation client (see 02B)
│   ├── validations/
│   └── utils.ts
├── navigations/navigations.ts
├── types/
├── utils/
├── public/
├── proxy.ts                            # NEW: dashboard-only middleware
├── next.config.ts · tsconfig.json · components.json
├── Dockerfile · .dockerignore
├── .env.example · .env.production.example
└── e2e/                                # dashboard specs only
```

**Rule:** the repo root is the app. No `apps/` directory, no workspace. The isolation test is "clone and `pnpm dev`".

---

## 3. Full dependency graph and per-module resolution

Legend: **COPY** = move the file as-is · **COPY-REDUCED** = copy only what the dashboard uses · **REIMPLEMENT** = write a dashboard-native replacement · **REWRITE** = new file, same role · **LEAVE** = stays with the public site · **DELETE** = do not carry.

### 3.1 Hard blockers (the 7 cross-tree imports)

| Import | Sites | Resolution | Rationale |
|---|---|---|---|
| `TourBadgeChip` from `@/components/frontend/tour-badge` | `collections/collection-form.tsx:24`, `collection-tour-select.tsx:10`, `collection-tours-manager.tsx:17`, `hubs/hub-comparison-manager.tsx:17`, `hub-our-picks-manager.tsx:19`, `hub-tour-select.tsx:9` | **REIMPLEMENT** as `components/common/tour-badge.tsx` | The dashboard was rendering the storefront's own chip inside admin pickers. That was always wrong: an admin selector should show an admin-styled signal, not a replica of customer-facing chrome that will drift the moment the public site restyles. Reimplement against the new design system (see 03). |
| `type TourListing` from `@/components/frontend/tour-card` | `lib/tours/listing.ts:5` | **REIMPLEMENT** as a local `AdminTourRow` type | A type describing the public site's card shape has no business in admin code. |
| `type TourBadge` from `@/components/frontend/tour-badge` | `lib/tours/listing.ts:6` | **REIMPLEMENT** locally | Same. |

**`lib/tours/listing.ts` splits in two** (finding A-4 - the file already documents that it is two modules):

| Piece | Destination |
|---|---|
| `deriveTourBadge` ("Admin tour rows don't carry a server-derived badge, so the dashboard derives it") | -> dashboard `lib/tours/derive-badge.ts` |
| `formatTourSignals` ("Shared by the Collection, Our Picks and Comparison tour selectors") | -> dashboard `lib/tours/signals.ts` |
| public mappers consumed by `TourCard` | **LEAVE** in the public repo |

> **Public-repo change required:** after the dashboard stops importing it, `lib/tours/listing.ts` on the
> public side should have `deriveTourBadge` and `formatTourSignals` removed. This is the only edit the
> extraction asks of the public repo besides the revalidate endpoint (02B). Track it; do not skip it,
> or the two copies drift.

### 3.2 Shared modules

| Module | Public importers | Resolution | Rationale |
|---|---|---|---|
| `lib/constants/locales.ts` | 56 | **COPY-REDUCED** -> `lib/i18n/locales.ts` | Dashboard needs `Locale`, `ALL_LOCALES`, `DEFAULT_LOCALE`, `LOCALE_LABELS`, and `Currency`/`ALL_CURRENCIES` for money display in bookings/payments. It does **not** need `LOCALE_NATIVE_LABELS` (public switcher), `LOCALE_CURRENCY`, or `LOCALE_COOKIE` (public i18n middleware). Copy ~40 lines, not 150. |
| `lib/motion.ts` | 49 | **REIMPLEMENT** (~8 lines) | The dashboard imports exactly one export: `pageEnter`, in `dashbaord-wraper.tsx`. Copying a 107-line public motion vocabulary to use one constant is cargo cult. Declare `pageEnter` locally. |
| `lib/auth-client.ts` | 4 | **COPY** verbatim | 6 lines. `createAuthClient({ baseURL: NEXT_PUBLIC_BACKEND_URL })`. Both apps independently constructing a client against the same auth server is correct microservice behavior, not duplication. |
| `lib/utils.ts` (`cn`) | 3 direct, ~40 transitive | **COPY** verbatim | 6 lines. Universal. |
| `lib/currency/current.ts` | 6 | **COPY-REDUCED** | Verify dashboard usage during migration; carry only the formatting helpers bookings/payments actually call. |
| `components/ui/calendar`, `popover` | 5 each | **COPY** (part of the ui fork) | |
| `lib/api/query.ts` (`buildQuery`) | both | **COPY** | Isomorphic, deliberately not `server-only`. Also delete the duplicate local `buildQuery` at `bookings-dashboard.ts:16-29` (defect B-8) in the same change. |
| `lib/api/availability.ts` | public + `hooks/tours/use-availability-sync` | **COPY-REDUCED** | Dashboard needs `checkTourDepartures`/`getTourCalendar` only for the schedules sync hook. Public keeps its copy. |

### 3.3 Types

**Decision: COPY all dashboard-consumed types. Do not treat this as duplication.**

Rationale, and it matters: `types/*.ts` are hand-written mirrors of **backend DTOs** - `types/trip.ts:1-2` says so explicitly ("mirror the backend tours + tours/:tourId + availability contracts exactly"). In a microservice architecture, **two independent consumers each maintaining their own view of a shared HTTP contract is the correct shape**, not an accident to be deduplicated. Extracting them into a shared package would recreate exactly the coupling this project exists to remove: a public-site type change would then force a dashboard release.

| Types | Resolution |
|---|---|
| `trip`, `media`, `enums`, `booking`, `attribute`, `operator`, `operator-settings`, `profile`, `settings`, `tier`, `faq`, `locals-favourite`, `slug-registry` | **COPY** (dashboard-only already) |
| `collection`, `hub`, `category`, `destination`, `search`, `review` | **COPY** - each repo keeps its own. Dashboard's copy should be **narrowed** to the fields the dashboard reads. |
| `tour-detail`, `facets` | **LEAVE** |
| `money` | Verify usage; likely **LEAVE** (0 importers on either side today) |

**The one real risk:** these mirror the backend by hand, with no codegen. Drift between backend DTOs and either frontend's types is caught only at runtime. See §10 (Appendix B).

### 3.4 Dashboard-owned, straight copies

| Source | Destination | Note |
|---|---|---|
| `app/(dashboard)/dashboard/**` | `app/(app)/**` | drop the `/dashboard` path segment (§8) |
| `components/dashboard/**` (166 files) | `components/<module>/**` | flatten the `dashboard/` level; the whole repo is the dashboard |
| `hooks/{attributes,bookings,categories,collections,destinations,faq,hubs,locals-favourites,media,operators,payments,profile,settings,tiers,trips}/**` | `hooks/**` | |
| `hooks/use-visible-section.ts`, `hooks/use-mobile.ts` | `hooks/` | `use-mobile` is consumed by `ui/sidebar.tsx` |
| `hooks/tours/use-availability-sync.ts` | `hooks/tours/` | dashboard consumer |
| `contexts/role-context.tsx` | `contexts/` | |
| `lib/config/rbac.ts` | `lib/config/` | **must stay in sync with backend `src/config/roles.config.ts`** - see Appendix B |
| `lib/rbac-utils.ts` | `lib/` | |
| `navigations/navigations.ts` | `navigations/` | sole consumer is the sidebar |
| `lib/api/{trips,destinations,categories,collections,hubs,attributes,tiers,operators,operator-settings,settings,profile,media,faq-groups,locals-favourites,bookings-dashboard,fetch}.ts` | `lib/api/` | |
| `lib/server/auth-headers.ts` | `lib/server/` | `'server-only'` |
| `lib/validations/{profile,onboarding}.ts` | `lib/validations/` | |
| `lib/stores/use-upload-store.ts` | `lib/stores/` | media upload progress (zustand) |
| `lib/config/derived-attributes.ts` | `lib/config/` | mirror of a backend rule (critical rule #23 family) |
| `lib/constants/category-icons.ts` | `lib/constants/` | |
| `utils/{crop-utils,intl-utils,weather}.ts` | `utils/` | weather: see §11 |
| `app/_actions/{userActions,onboardingActions,dashboardActions}.ts` | `app/_actions/` | |
| `components/{app-sidebar,site-header,nav-main,nav-user,nav-documents,nav-secondary,mode-toggle}.tsx` | `components/shell/` | dashboard-only despite living at `components/` root (finding A-6) |
| `components/skelitons/{dashboard,profile,statistics}-skeleton.tsx` | `components/skeletons/` | **fix the directory typo on the way** (G-6) |
| `components/providers/query-provider.tsx` | `components/providers/` | now mounts in the dashboard root layout only, not a shared one |
| `components/ui/**` (35 files) | `components/ui/` | fork, then remediate per 03 |
| `app/(login)/portal`, `app/(login)/staff` | `app/(auth)/` | |
| `app/onboarding`, `components/onboarding/` | `app/onboarding/`, `components/onboarding/` | |
| `e2e/` (dashboard specs) | `e2e/` | audit for public-site specs and leave those behind |

### 3.5 Rewrites (cannot be copied)

| File | Why | Spec |
|---|---|---|
| `app/layout.tsx` | Serves both trees; admin metadata on a public layout; 5 fonts; 4 providers | **REWRITE.** Dashboard-only metadata. Fonts reduced per 03 (drop DM Sans + General Sans: 1 and 3 usages). Provider chain unchanged: `QueryProvider -> ThemeProvider -> TooltipProvider -> {children} + Toaster`. |
| `app/globals.css` | 276 lines for both trees; imports public tokens at `:4`; contains dashboard-only rules | **REWRITE** per `03-DESIGN-SYSTEM-SPEC.md`. The `@import './(frontend)/frontend-tokens.css'` line simply does not exist in the new repo - **F-3 is resolved by the split itself, for free.** |
| `proxy.ts` | Holds `guardDashboard()` **and** the entire public i18n scheme | **REWRITE** to `guardDashboard` only. See §5. |
| `app/_actions/revalidate.ts` | `updateTag()` cannot reach another app's cache | **REWRITE** per `02B`. **This is the silent-regression risk (A-5).** |
| `lib/api/cache-revalidation.ts` | Tag-mapping logic is sound; transport is not | **COPY the mapping, REWRITE the transport** per `02B`. **Fix defect B-1 (duplicate `case 'settings'`) in the same change.** |
| `next.config.ts` | Shared config; `picsum.photos`/`unsplash` demo hosts | **REWRITE.** Keep `cacheComponents: true` and the 100mb `serverActions.bodySizeLimit` (media uploads need it). Add `output: 'standalone'`. Keep `res.cloudinary.com` + `lh3.googleusercontent.com`; drop demo-seed hosts. |
| `components/dashboard/dashbaord-wraper.tsx` | Filename typo + hardcoded `bg-[#f1f4fa]` with no dark variant (D-4) | **REWRITE** as `components/shell/dashboard-shell.tsx`, tokenized. |

### 3.6 Deletions (do not carry)

| File | LOC | Reason |
|---|---|---|
| `components/data-table.tsx` | 813 | 0 importers; superseded by the new `components/data-table/` system (05) |
| `components/section-cards.tsx` | - | 0 importers |
| `components/chart-area-interactive.tsx` | - | 0 importers |
| `components/dashboard/trips/trip-content-tab.tsx` | 255 | 0 importers |
| `components/dashboard/trips/trip-languages-tab.tsx` | 205 | 0 importers |
| `components/dashboard/common/image-upload-selector.tsx` | 235 | superseded by `media/image-selector-field.tsx` |
| `components/dashboard/locals-favourites/locals-favourites-list-view.tsx` | 66 | probable orphan - **verify before deleting** |
| `app/__backup(auth)/`, `components/__backup_auth/` | - | backup dirs |
| `app/(dashboard)/dashboard/{leads,enquiries}/page.tsx` | - | vestigial; `CLAUDE.md`: "book instantly - no enquiry model" |
| `frontend/lint_errors.log` | 45KB | build artifact |
| `ui/{progress,breadcrumb,drawer,toggle,toggle-group,input-otp,input-group}.tsx` | - | unused or transitive-only to deleted files - **re-verify after the table rewrite**, which may adopt some |

~~**Do NOT delete** `lib/api/cache-revalidation.ts` - it is live (`lib/api/fetch.ts:7`). An earlier scan reported it orphaned; that was wrong.~~

> **SUPERSEDED 2026-07-22, after step 6 shipped.** That note was correct while the
> dashboard route group still lived in the public repo: `cache-revalidation.ts` was the
> in-process producer and `app/_actions/revalidate.ts` called `updateTag` in a cache both
> apps shared. Once the transport moved (02B) and the route group left, the public repo's
> copy became a *stale second vocabulary*: its hand-written `CacheTag` union had drifted
> and was missing `platform-reviews`, `homepage`, `instagram` and `media-indexing`, while
> the authoritative list sat in `lib/cache-tags.ts` next to it. It was still reachable from
> `lib/api/fetch.ts`, but the only live callers left (`/bookings/*`, and
> `/availability/check`, which is explicitly skipped) mapped to **zero** tags, so it
> produced nothing. Both files are now **deleted from the public repo**, and
> `lib/api/fetch.ts` carries a comment explaining why this app has no producer path.
> The public repo is the **consumer** only: `app/api/revalidate/route.ts`, validating
> against the shared `lib/cache-tags.ts`. Do not reinstate a parallel map here.

**Leave behind** (public-owned): `app/(frontend)/**`, `components/frontend/**`, `lib/api/public/**`, `lib/api/{wishlist,search,reviews,categories-public,slug-registry,bookings}.ts`, `contexts/booking-context.tsx`, `hooks/tours/{use-booking,use-booking-quote}.ts`, `hooks/use-drag-scroll.ts`, `app/(login)/{apply,bookings}`, `components/smooth-scroll.tsx`, public skeletons, `types/{tour-detail,facets}.ts`, `app/(frontend)/frontend-tokens.css`.
Add to that list, verified live 2026-07-22: `lib/api/{availability,bookings-lookup,fetch,query}.ts`
(`fetch.ts` survives because `bookings.ts` and `availability.ts` import it).

### 3.6a Step-10 cleanup executed in the public repo (2026-07-22)

Method: a resolved import graph (every `@/…` and relative specifier resolved to a real file),
walked transitively from the Next entrypoints (`page`/`layout`/`route`/`loading`/`error`/
`not-found`/`sitemap`/`robots` + `proxy.ts`/`next.config.ts`) over **all** source roots -
`app`, `components`, `contexts`, `hooks`, `lib`, `navigations`, `types`, `utils`. A plain
`grep` is not sufficient and gave three false positives on the first pass: `./fetch` and
`./categories` inside `lib/api/public/` resolve to that folder's own files, not to
`lib/api/fetch.ts` / `lib/api/categories.ts`, and `lib/api/categories` substring-matches the
live `categories-public.ts`.

Deleted (62 files, ~7,000 LOC, every one confirmed to exist in the dashboard repo and none on
the Leave-behind list):

| Group | Files |
|---|---|
| Cache-bridge producer | `lib/api/cache-revalidation.ts`, `app/_actions/revalidate.ts` (see the superseded note above) |
| Dashboard API clients | `lib/api/{attributes,bookings-dashboard,categories,collections,destinations,faq-groups,hubs,locals-favourites,media,operator-settings,operators,profile,settings,tiers,trips}.ts` |
| Their sole consumers | `hooks/{attributes,bookings,categories,collections,destinations,faq,hubs,locals-favourites,media,operators,payments,profile,settings,tiers,trips}/**` |
| Server actions | `app/_actions/{dashboardActions,userActions}.ts`, `lib/server/auth-headers.ts` |
| `lib/tours/listing.ts` split leftovers | `lib/tours/{derive-badge,signals}.ts` - **this is the §3.1 item**; they were split out here, copied to the dashboard, and never removed from the public side |
| Dashboard-only lib | `lib/config/{rbac,derived-attributes}.ts`, `lib/rbac-utils.ts`, `lib/constants/category-icons.ts`, `lib/stores/use-upload-store.ts`, `lib/validations/profile.ts`, `hooks/use-visible-section.ts` (its default storage key is literally `dashboard-visible-sections`) |
| Dashboard shell | `contexts/role-context.tsx`, `navigations/navigations.ts` |
| Dashboard DTO mirrors | `types/{attribute,booking,faq,locals-favourite,media,operator-settings,operator,profile,settings,tier}.ts` |
| Stray `utils/` (dir removed) | `utils/{crop-utils,intl-utils}.ts` (both live in the dashboard repo) and `utils/weather.ts`, template cruft that defaulted to Dhaka, Bangladesh |
| Dead public skeletons | `components/frontend/skeletons/hub-{tour-card,trips-panel}-skeleton.tsx` - leftovers of a Suspense boundary that was **deliberately reverted**; `hub-page.tsx:68` says "The trips block deliberately has NO Suspense hole of its own… the fallback just flashed" |

Verified after: `tsc --noEmit` clean, `eslint .` clean, all 923 internal imports resolve, and
`next build` green (exit 0, 868/868 static pages) against a running backend.

**Deliberately NOT deleted**, though currently unreachable:

- `components/frontend/login/**` (8 files) and `lib/auth-client.ts` - operator/staff login is
  built but not yet routed. `components/frontend/**` is Leave-behind, and §3.2 marks
  `lib/auth-client.ts` as COPY (each repo keeps one).
- `components/frontend/{category/category-trust-strip,skeletons/hub-tour-card-skeleton,skeletons/hub-trips-panel-skeleton}.tsx` -
  unwired public components; Leave-behind covers them.
- `components/ui/**` (30 of 35 unreferenced) + `hooks/use-mobile.ts` - the shadcn fork. Only
  `calendar`, `popover`, `sonner`, `tooltip` are reachable today and `input-otp` is held by
  the pending login work. Pruning the design system is a separate, owner-level decision.


---

## 4. API boundary specification

### 4.1 Contract

The dashboard's only permitted contact with the backend is HTTP to `${NEXT_PUBLIC_BACKEND_URL}/api/v1`. No shared database, no shared package, no shared process. This already holds; the spec exists to keep it holding.

### 4.2 Client

`lib/api/fetch.ts` copies **as-is**. It is already correct and its reasoning is documented in-file:
- Base URL from `NEXT_PUBLIC_BACKEND_URL`, defaulting to `http://localhost:5050`
- `credentials: 'include'` (same-site to `api.tripwheel.io` - §1.1)
- Retry `[300, 800]` with full jitter, **GET only**, on 429/503 (correct: a retried mutation could double-apply)
- Error normalization: `body.message` (string or `string[]`) -> `throw new Error(message)`
- `204` -> `undefined`; text-first parse to survive empty-body 200s

**One change:** the tail call `revalidatePublicForPath(path, method)` at `:64` keeps its signature but its implementation is replaced (02B).

### 4.3 Server-side variant

`lib/server/auth-headers.ts` copies as-is: `serverAuthHeaders(cookie)` -> `{ cookie, 'x-internal-api-key': INTERNAL_API_SECRET }`. Used by `getUserProfile` for the layout's auth gate. `INTERNAL_API_SECRET` must match the backend's, and exempts SSR from the per-IP throttle.

### 4.4 Error handling and retries

Unchanged from today. Explicitly **not** in scope to redesign: the current behavior is correct and any change is a regression risk with no user-visible benefit.

One related recommendation (finding F-5, deferred to 06): `refetchOnWindowFocus: true` + `staleTime: 30_000` produces refetch bursts that the 429 retry logic then absorbs. The retry is treating a symptom the cache config creates. Tune in a later phase, not during extraction.

### 4.5 Endpoint surface

Unchanged. The dashboard consumes: `/tours` (+ 11 child collections + 5 lifecycle verbs), `/destinations`, `/categories`, `/collections`, `/hubs`, `/attributes`, `/tiers`, `/bookings`, `/payments`, `/operators`, `/settings`, `/users/me`, `/media-gallery`, `/availability/{schedules,exceptions,check,calendar}`.

---

## 5. Auth and session specification

### 5.1 Flow

```
Browser -> dashboard.tripwheel.io
  proxy.ts guardDashboard()          cookie presence + shape only, no network
    no cookie          -> 302 /portal
    malformed cookie   -> 302 /portal + clearSessionCookies()
    ok                 -> next()
  app/(app)/layout.tsx (Server Component)
    getUserProfile(cookie)           React cache(), NOT 'use cache'
      -> authClient.getSession() + GET /users/me   (parallel)
      null                           -> redirect('/portal')
      TOUR_OPERATOR without operator -> redirect('/onboarding')
    -> RoleProvider role={user.role} -> useRole() -> { role, can, canAny }
```

**Preserve exactly.** Three properties are load-bearing and non-obvious:

1. **`guardDashboard` does no network call.** It is a cheap cookie-shape check; the layout is the authority. Keep the split - moving validation into middleware would put a backend round-trip on every navigation.
2. **`getUserProfile` uses React `cache()`, never `'use cache'`.** The comment at `userActions.ts:41-48` explains why: a cached `null` from a transient 429 would bounce logged-in users to `/portal`. **This is a trap. Do not "optimize" it during the migration.**
3. **`RoleContext` defaults to deny-all.** A missing provider denies rather than permits.

### 5.2 Cookie handling

`clearSessionCookies()` matches by substring (`name.includes('session_token')`, `'session_data'`), which covers `__Secure-` prefixes. Keep. Set `COOKIE_DOMAIN` to the **same** value in both the dashboard and the backend — a mismatch is a login loop.

> **Corrected 2026-07-17 (Phase 8):** that value is **`.islandtours.esenc.cloud`**, the interim topology in force and already the backend's default (§7). This line previously said `.tripwheel.io`, which is the *deferred target* (`02C`) — setting it today would break login.

### 5.3 New `proxy.ts`

Reduced to dashboard concerns only. Everything the public site needs (locale redirects, `NON_LOCALIZED_PREFIXES`, thank-you/cancel rewrites, `LOCALE_COOKIE`) **is deleted** - it stays in the public repo.

Remaining responsibilities:
1. `guardDashboard` for everything under `/` except `(auth)` and `/onboarding`
2. Legacy redirects `/login` -> `/portal`, `/forgot-password` -> `/portal/forgot`, `/reset-password` -> `/portal/reset`
3. Legacy `/dashboard/*` -> `/*` permanent redirect (§8)

Matcher stays `['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)']`.

> Note: the file is named `proxy.ts`, not `middleware.ts` - Next 16 renamed it. Keep the name.

### 5.4 RBAC

`lib/config/rbac.ts` copies as-is. Its header - "Mirrors backend: src/config/roles.config.ts + prisma/enums.prisma. Keep in sync." - becomes **more** dangerous after the split, because the two files are now in different repos with no shared CI. See Appendix B.

~~Fix during migration (finding B-7): `collections` has zero gating. Add `useRole` gates matching the other entity modules. This is a **new gate on an ungated surface**, so it is a behavior change - but in the safe direction, and the backend already enforces. Flag it in the parity checklist as an intentional delta.~~

> **VOID 2026-07-17 (Phase 9): B-7 is retracted - see `01`.** Collections has gated since
> 2026-06-08, five weeks before the audit said otherwise. Nothing to fix, nothing to flag, and
> **no intentional delta** for the parity checklist. Verified: the only diff between the old and
> new `collections-list-view.tsx` is the `/dashboard/collections/new` -> `/collections/new` href.

---

## 6. Cache revalidation

**Specified in full in `02B-CACHE-REVALIDATION-SPEC.md`.** Summary of the decision recorded here for completeness:

- Today: `apiFetch` -> `cache-revalidation.ts` -> `revalidate.ts` Server Action -> `updateTag()`. Works only because both apps are one process.
- After split: `updateTag()` cannot reach `island.tours`. **Silent failure - no error, no build break, just stale content.**
- **Decision:** keep the tag-mapping logic identically; replace the transport with a server-to-server POST from the dashboard's Server Action to `https://island.tours/api/revalidate`, secret-authenticated. The Server Action boundary already exists (because `updateTag` is server-only), so the secret never reaches the browser.
- **Target state:** backend-emitted revalidation (it owns the outbox + BullMQ). Requires backend work; out of scope here; specified as a migration path.

---

## 7. Environment variables

Per the project's 3-file rule for new env vars, adapted to the dashboard repo: **every var appears in `.env.example` AND `.env.production.example` in the same change.**

| Var | Public? | Purpose | Example |
|---|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | yes | Backend base | `https://api.islandtours.esenc.cloud` |
| `INTERNAL_API_SECRET` | **no** | SSR throttle exemption; must match backend | 32+ chars |
| `COOKIE_DOMAIN` | **no** | Session cookie scope; must match backend | `.islandtours.esenc.cloud` |
| ~~`NEXT_PUBLIC_SITE_URL`~~ | — | **GHOST — does not exist. Do not add it.** Verified in Phase 8: no code reads it. `NEXT_PUBLIC_STAGING_APP_URL` (below) is the var that actually backs the "view site" link. | — |
| `REVALIDATE_TARGET_URL` | **no** | Public revalidate endpoint (02B) | `https://islandtours.esenc.cloud/api/revalidate` |
| `REVALIDATE_SECRET` | **no** | Shared secret for that endpoint (02B); must match public site | 32+ chars |
| `NEXT_PUBLIC_OPEN_WEATHER_API_KEY` | yes | Header weather widget (§11) | |
| `NEXT_PUBLIC_STAGING_APP_URL` | yes | `setup-guide.tsx:53` | |

**Backend-side changes required (config only, no code):**

| Var | New value |
|---|---|
| `COOKIE_DOMAIN` | `.islandtours.esenc.cloud` - **unchanged, already the default** |
| `CORS_ORIGINS` | add `https://dashboard.islandtours.esenc.cloud`; keep the public origin. Feeds both CORS (`main.ts:43`) and Better Auth `trustedOrigins` (`auth.instance.ts:17`) — so a miss rejects **sign-in**, not just fetches. **In dev, also add `http://localhost:3001`** (below). |

> **Added 2026-07-17 (Phase 8) — local port map.** The split turned one app into two,
> and they cannot share a port: **5050** backend · **3000** public site · **3001**
> dashboard (pinned in its `pnpm dev`). 3000 must stay the public site's — it is what
> `REVALIDATE_TARGET_URL` points at. The dashboard's API calls run in the *browser*
> with credentials, so `http://localhost:3001` in the backend's dev `CORS_ORIGINS` is
> required or every local dashboard request is CORS-blocked.

**Public-site-side changes required:** `REVALIDATE_SECRET` (matching), and the new `/api/revalidate` route handler (02B).

---

## 8. Base path migration: `/dashboard/*` -> `/*`

Mechanical but touches many files. Order matters.

| Step | Action |
|---|---|
| 1 | Move `app/(dashboard)/dashboard/*` -> `app/(app)/*` |
| 2 | `navigations/navigations.ts` - strip the `/dashboard` prefix from every `url`. Note `Overview` is already `url: ''`. |
| 3 | Grep `'/dashboard` across the repo and rewrite every `router.push`/`redirect`/`<Link href>`. Known sites: `trip-form.tsx:287`, all `[id]/page.tsx` redirect shims, `trip-row-actions.tsx:103-123` `?tab=` deep links, breadcrumbs, `layout.tsx` redirects. |
| 4 | `proxy.ts` - add `/dashboard/*` -> `/*` 308 permanent redirect so bookmarks survive |
| 5 | Update `e2e/` specs |
| 6 | Verify no `basePath` in `next.config.ts` (there is none today) |

**Validation:** `grep -rn "/dashboard" app components lib navigations` must return only the legacy-redirect rule in `proxy.ts`.

---

## 9. The trip/tour naming split

Not required for extraction. Recorded because the new repo is the cheapest moment it will ever be fixable.

Today: the frontend says "trip" everywhere; the backend route base is `/tours`; `tripId` params post `{ tourId }` bodies (`lib/api/trips.ts:489,512`); `types/trip.ts:1-2` carries a warning comment about it; `CLAUDE.md` says the entity is a Tour and the dashboard route is `/dashboard/trips`.

**Recommendation:** rename to `tours` throughout the dashboard (routes, components, hooks, types) **as part of the file move in Phase 1 of the implementation plan** - i.e. while every path is already changing and every import is already being rewritten. Doing it later costs a second full-repo churn.

**Risk:** it is a large mechanical diff on top of an already-large mechanical diff, which makes review harder and bisecting a regression worse. **Decision is yours.** If you want the split reviewable, defer the rename to its own later phase and accept paying the churn twice.

Recorded in 06 as an explicit go/no-go.

---

## 10. Migration order

Ordered so that nothing is broken at any step, and the risky item is isolated.

> **Status 2026-07-17: steps 0-7 are DONE** (step 7 minus the deploy itself). Live progress and
> every executed correction live in `06`, which is the authoritative record - this table is the
> plan, not the log.

| # | Step | Verification | Status |
|---|---|---|---|
| 0 | **In the current repo:** fix defect B-1 (duplicate `case 'settings'`). One-line fix, ships to production now, independent of the split. | `PATCH /settings/site` busts `site-info` | **done** (`06` Ph1) |
| 1 | **In the current repo:** sever the 7 cross-tree imports (§3.1). Reimplement `tour-badge` in `components/dashboard/common/`; split `lib/tours/listing.ts`. | `grep "@/components/frontend" components/dashboard app/(dashboard) lib/tours` -> zero. **Both apps still build.** | **done** (`06` Ph2) |
| 2 | **In the current repo:** move dashboard-only files out of `components/` root into `components/dashboard/shell/`; split `components/skelitons/`. | Both apps build. Public site untouched. | **done** (`06` Ph3) |
| 3 | **In the current repo:** delete confirmed dead code (§3.6). | Both apps build; bundle shrinks | **done** (`06` Ph4) |
| 4 | Create the new repo. Copy per §3.4. Rewrite per §3.5. Do **not** redesign anything yet. | `pnpm build` succeeds in the new repo | **done** (`06` Ph5) |
| 5 | Base path migration (§8) | `grep "/dashboard"` clean | **done** (`06` Ph6) |
| 6 | **Cache revalidation transport** (02B) - both the dashboard client and the public `/api/revalidate` endpoint, deployed together. Includes the coalescing throttle (02B §6A.3). | 02B §10 verification | **done** (`06` Ph7) |
| 7 | Env + ~~Docker~~ **Vercel** + deploy to a staging subdomain | Loads, authenticates, lists tours | **code done** (`06` Ph8); deploy pending |
| 8 | **Parity verification** (§11) against production | Every row green | **next** |
| 9 | Cut DNS. Old `/dashboard/*` 308s to the new origin. | | |
| 10 | **In the public repo:** delete the dashboard route group and the now-unused exports from `lib/tours/listing.ts` | Public site builds and deploys | **done 2026-07-22** (see §3.6a) |

**Step 7 is Vercel, not Docker** (user decision, 2026-07-17): the sibling public app already
deploys there and `docker-compose.yml` states the frontend is not containerised. No `Dockerfile`
was written and `output: 'standalone'` was removed. `06` Phase 8 carries the full consequence list.

**Step 10 partly happened early, for free.** Doing step 1 before step 4 meant `deriveTourBadge` /
`formatTourSignals` were **moved**, not copied - the public site never had a duplicate to delete.
What remains of step 10 is the dashboard route group itself.

**Steps 0-3 happen in the current monorepo and ship independently.** They are pure decoupling with no behavior change, they reduce the size of the cut, and if the split slips they are still improvements. This is the single most important property of this ordering: **the risky part (steps 4-9) is preceded by work that has value on its own.**

Redesign work (03/04/05) begins **only after step 9 is green**. Extraction and redesign must not be interleaved: if a screen breaks, you must know whether the move or the redesign broke it.

---

## 11. Parity verification checklist

Run against production data on the staging subdomain, before DNS cutover. **Every row must be green.** No row may be waived without a written note.

> **Correction 2026-07-17: "on the staging subdomain" overstates it. 53 of these 55 run locally,
> and should.** Only **#2** and **#9** need the deployed origin - both depend on production-gated
> cookie behavior (`crossSubDomainCookies` and `proxy.ts`'s `COOKIE_DOMAIN` read are both behind
> `NODE_ENV === 'production'`), so localhost cannot show them either way. Everything else is HTTP
> to the backend and indifferent to where the frontend is hosted, **including #51-55** (dashboard
> :3001 -> public :3000 `/api/revalidate`). Run the sweep locally, fix cheaply, then re-run only
> #2 and #9 on staging. Rationale and prerequisites: `06` Phase 9.
>
> **Already passing** (verified during Phase 8, on `next start`): **#1** and **#11**.

> ## Phase 9 result, 2026-07-17: **NO REGRESSION FOUND**
>
> **The code-level evidence bounds where a regression could even hide.** All **171** dashboard
> component files were compared old vs new: **95 byte-identical**, **76** differing *only* in
> import paths or the `/dashboard/x` -> `/x` prefix (Phase 6's intended change), **0 behavioural**.
> Route sets identical, 19 for 19.
>
> **The e2e suite agrees, and it is a stronger signal than its pass rate suggests.** 227 tests,
> run against both dashboards: **102 failures identical name-for-name, 0 failing only on old**,
> and the 4 that failed only on new **fail on old too when run in isolation** - they depend on
> database residue left by earlier tests. Net: **all 227 behave identically.** (The suite is ~45%
> red on *both* sides. It is measuring its own decay, not the extraction. See `06` Phase 9.)
>
> **Rows 12-50 are therefore waived on written evidence**, which §11 permits: they ask "does this
> module still work" about code that did not change, and the diff above is the note. **Not waived,
> still owed:**
> - **#2, #9** - staging only (production-gated cookie behaviour).
> - **#6, #7, #10, #43-45, #49** and the visual half of the module rows - **the user's to sign off.**
>   An agent cannot report "the avatar crop looks right".
> - **A NEW visual delta to eyeball: the sidebar fonts.** DM Sans + General Sans were dropped in
>   Phase 5; the 4 usages (`nav-main.tsx` x3, `app-sidebar.tsx` x1) now render in Noto Sans.
>   Deliberate, documented at `app/globals.css`, but never listed as a known delta until now.
> - ~~The collections RBAC delta~~ - **does not exist.** B-7 retracted; see §5.4.

### Auth and shell

| # | Check | Pass |
|---|---|---|
| 1 | Unauthenticated `/` -> `/portal` | **PASS** (Phase 8) |
| 2 | Malformed session cookie -> `/portal` **and cookie cleared** | staging only |
| 3 | Operator login -> lands on overview | |
| 4 | Admin login -> lands on overview | |
| 5 | TOUR_OPERATOR with no operator record -> `/onboarding` | |
| 6 | Sidebar shows **exactly** the operator's permitted items (diff against production, item by item) | |
| 7 | Sidebar shows exactly the admin's permitted items | |
| 8 | Logout clears session, redirects, and back-button does not restore the dashboard | |
| 9 | Session cookie is scoped **`.islandtours.esenc.cloud`** (the interim topology, and what §7 specifies — `.tripwheel.io` here was stale) and survives a reload | staging only |
| 10 | Dark mode toggles and persists | |
| 11 | Legacy `/dashboard/tours` 308s to `/tours` | **PASS** (Phase 8) |

### Per-module CRUD (repeat for destinations, hubs, categories, collections, attributes, operators)

| # | Check | Pass |
|---|---|---|
| 12 | List renders with server pagination, sort, filter, search | |
| 13 | Create -> redirects to edit | |
| 14 | Every editor tab loads and saves | |
| 15 | Translations: all 7 locale tabs load, save, and delete (EN "Clear Fields" upserts nulls, does **not** call delete) | |
| 16 | SEO tab saves per locale; OG image saves | |
| 17 | FAQs: create, edit, reorder, delete | |
| 18 | Page Content saves | |
| 19 | Delete / deactivate / force-delete dialogs behave identically | |
| 20 | RBAC gates match production per role (~~note the intentional delta: collections is newly gated - §5.4~~ **no delta: B-7 retracted, collections has gated since 2026-06-08**) | |

### Tours (highest risk)

| # | Check | Pass |
|---|---|---|
| 21 | Create with the 4 required fields -> redirect to edit | |
| 22 | All 13 tabs load | |
| 23 | Details saves; warnings banner still fires via `onWarnings` | |
| 24 | Pricing: basics, age bands (incl. Set Default), add-ons all save | |
| 25 | Schedules: start times, recurring schedules, exceptions all save. **7 days x 3 times still produces 21 schedules** | |
| 26 | Images: add from gallery, set hero, reorder, edit alt/focal, delete. Cap 24 enforced | |
| 27 | Highlights / inclusions / exclusions / features: add, delete, per-locale save | |
| 28 | Itinerary + pickups: save details, per-locale save, `displayOrder` respected | |
| 29 | Attributes: bulk save; derived attributes still filtered out | |
| 30 | Promotion: tier change (30-day lock enforced), spotlight request | |
| 31 | Publish / Pause / Unpause / Archive / Restore all work and the status badge updates | |
| 32 | Publish readiness card shows the same 5 checks for DRAFT | |
| 33 | "Published, not yet listed" banner still fires on `LIVE && !isBookable` | |
| 34 | Row-action `?tab=` deep links reach all 6 target tabs | |

### Money and operations

| # | Check | Pass |
|---|---|---|
| 35 | Bookings list: pagination, search, filters | |
| 36 | Commission column visible to ADMIN, hidden from operator | |
| 37 | Booking details dialog shows all ~15 fields | |
| 38 | Cancel booking works for `ON_HOLD`/`PENDING`/`CONFIRMED` only, gated on `EDIT_BOOKING` | |
| 39 | Refund-due copy branches correctly in the confirm dialog | |
| 40 | Cancellation-requests view shows the 3 extra columns | |
| 41 | Payments list renders with correct provider/method | |
| 42 | Money renders with exact decimals and correct currency | |

### Media, settings, profile

| # | Check | Pass |
|---|---|---|
| 43 | Upload (image + mp4 + mov), progress, cache prepend | |
| 44 | Grid/list toggle; select mode; bulk delete | |
| 45 | Picker mode: opens from a form, returns selection, respects `multiple`/`maxFiles` | |
| 46 | Admin settings: all 6 tabs load and save | |
| 47 | Operator settings: both tabs load and save | |
| 48 | **`PATCH /settings/site` busts `site-info` on island.tours** (was B-1) | |
| 49 | Profile: edit, avatar crop+upload, change password, social links | |
| 50 | Onboarding completes and lands on the dashboard | |

### Cross-service (see 02B §10 for the full matrix)

| # | Check | Pass |
|---|---|---|
| 51 | Publish a tour on the dashboard -> it appears on island.tours within the target window | |
| 52 | Edit a tour price -> island.tours reflects it | |
| 53 | Rename a slug -> 301 works, slug-registry tag busted | |
| 54 | Deactivate a destination -> its public page 404s | |
| 55 | Revalidation failure is **logged**, not swallowed | |

---

## Appendix A - Backend requests (no backend code changes in this project)

These are **requests to the backend team**, not work items here. The screens that depend on them are designed in `04-UX-STRATEGY-SPEC.md` against the proposed contract and marked blocked.

| # | Request | Unblocks | Priority |
|---|---|---|---|
| A1 | `GET /dashboard/stats` returning real revenue / bookings / tours / customers + recent activity | Kills `dashboardActions.ts` (B-3). **The first screen after login is currently fabricated data.** | **High** |
| A2 | `GET /reviews` + moderation transitions | The `reviews` stub | High |
| A3 | `GET /users` (paginated, filterable) + role management | The `users` stub | Medium |
| A4 | Machine-translation job: `POST /tours/:id/translations/:locale/generate` setting `isMachineTranslated: true` | The translation console's pre-translate step (04 §2). The flag, the payload field, and the badge **already exist** end-to-end; only the generator is missing. `CLAUDE.md` already lists AI translation as planned BullMQ work. | **High** |
| A5 | Bulk schedule create: `POST /availability/schedules/bulk` accepting `{ weekdays[], startTimes[] }` | Collapses 21 sequential POSTs to 1 (C-6, F-4) | Medium |
| A6 | Bulk image reorder: `PATCH /tours/:id/images/order` accepting an ordered id array | Enables drag-drop reorder in 1 request instead of 2-per-arrow (C-5) | Medium |
| A7 | Payment detail + refund transitions | Payments is currently a dead end (C-9) | Medium |
| A8 | Backend-emitted cache revalidation via the existing outbox/BullMQ | The correct end-state for 02B; removes the dashboard's knowledge of island.tours | Medium |

---

## Appendix B - Contracts that survive the split only by discipline

After the split, these pairs are in **different repositories with no shared CI**. Nothing mechanically prevents drift. Each needs an owner and a check.

| # | Contract | Repos | Failure mode | Proposed guard |
|---|---|---|---|---|
| B1 | `lib/config/rbac.ts` <-> `backend/src/config/roles.config.ts` + `prisma/enums.prisma` | dashboard, backend | Operator sees a button that 403s, or is denied something they may do | Backend exposes `GET /auth/permissions` returning the role->permission map; a dashboard test asserts its local map matches. **Cheap, and it kills a whole class of bug.** |
| B2 | `types/*.ts` <-> backend DTOs | dashboard, public, backend | Runtime `undefined` on a renamed field | Backend already serves Swagger at `/api/docs`. Generate types in CI and diff, or at minimum run a contract test per module against a live backend. |
| B3 | `CacheTag` union <-> public site's `cacheTag()` calls | dashboard, public | **Silent staleness** | Public `/api/revalidate` validates the incoming tag against its own union and 400s on unknown. Turns drift into a loud error. See 02B §5. |
| B4 | `lib/config/derived-attributes.ts` <-> backend's derived-attribute list | dashboard, backend | Dashboard offers an attribute the backend rejects | Contract test |
| B5 | `COOKIE_DOMAIN` <-> backend `crossSubDomainCookies.domain` | dashboard, backend | Login loop | Deployment checklist |
| B6 | `INTERNAL_API_SECRET` <-> backend | dashboard, public, backend | SSR throttled | Deployment checklist |
| B7 | `REVALIDATE_SECRET` <-> public site | dashboard, public | Revalidation 401s silently | 02B requires this to be logged, not swallowed |

> **The honest summary of this appendix:** the split trades one large implicit coupling (a shared
> process) for seven small explicit ones. That is the right trade - explicit couplings can be tested,
> implicit ones cannot - but it is only an improvement if the guards actually get built. B1, B2 and B3
> are the ones that will bite.

---

## Appendix C - Open questions

| # | Question | Default if unanswered |
|---|---|---|
| C1 | **Weather widget.** `components/dashboard/weather-slider.tsx` + `utils/weather.ts` (193 + ~300 LOC) put a live OpenWeather widget in the admin header, carrying an env var and an external network dependency. Product rationale unknown. | **Carry it as-is.** It works and removing it is a product decision, not an architectural one. Flagged because it is the only external service dependency in the dashboard. |
| C2 | **Tour/trip rename** (§9) - do it during the file move, or defer? | Defer, to keep the extraction diff reviewable. |
| C3 | `app/(login)/apply` and `app/(login)/bookings` - confirmed traveler-facing and staying with the public site? | Stay with the public site. |
| C4 | `locals-favourites-list-view.tsx` - orphan? | Verify before deleting. |
| C5 | Public site's cross-site auth (§1.2) - who owns the fix? | Raise before DNS cutover. Does not block the dashboard. |
