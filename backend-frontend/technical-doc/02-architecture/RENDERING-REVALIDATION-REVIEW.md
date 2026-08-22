# Frontend Rendering & Revalidation Review

> Scope: the public site (`app/(frontend)/**`) and its data + cache layer
> (`lib/api/public/**`, `lib/api/slug-registry.ts`, `lib/api/cache-revalidation.ts`,
> `lib/i18n/dictionaries.ts`) plus the section/entity components that render them.
> Framework: Next.js 16 with `cacheComponents: true` (Partial Prerendering).
> Review date: 2026-07-12. Method: full source read of every route file, every
> public loader, the revalidation switch, and every streamed section component,
> judged against the Next.js 16 Cache Components rules.

---

## 0. Verdict up front

The architecture is fundamentally sound and correct.

- `cacheComponents: true` is enabled (`next.config.ts:5`).
- Every public data loader is a `'use cache'` function with an explicit `cacheLife`
  and (almost always) a `cacheTag`.
- No route awaits uncached data (`searchParams` / `cookies()` / `headers()` /
  `connection()`) outside a `<Suspense>` boundary, so there are no prerender-blocking
  errors. This is why the production build is green.
- Revalidation is a clean, immediate `updateTag` system with both granular
  (`type:id`) and coarse (aggregate) tags, wired to fire automatically on every
  successful dashboard mutation.

What needs work: 2 real gaps, 1 systemic inconsistency (which changes whether the
per-section loading skeletons ever render), and a short list of low-risk cleanups.
Nothing is architecturally broken; every fix is targeted.

---

## 1. The rules we are judging against (Cache Components model)

With `cacheComponents: true`, content on a route falls into three buckets:

1. Static: synchronous JSX and pure computation. Prerendered at build, served
   instantly, changes only on redeploy.
2. Cached (`'use cache'`): async data that does not need to be fresh every request.
   Stored in the cache keyed by function id + serialized args + closure, governed by
   `cacheLife` (lifetime) and `cacheTag` (event invalidation). It is part of the
   prerender, but its output is regenerated when its tag is busted or its lifetime
   expires.
3. Dynamic (Suspense): request-time data (`cookies`, `headers`, `searchParams`,
   `connection()`, randomness, current time). Must be wrapped in `<Suspense>`; it is
   excluded from the static prerender and streamed in at request time.

Consequences that drive this review:

- A `<Suspense>` boundary only actually streams (and shows its fallback skeleton) if
  the component inside it reads request-time data. A purely cached component wrapped
  in `<Suspense>` does not stream: it resolves at prerender time and is baked into the
  static shell, and its fallback effectively never renders.
- `await connection()` opts a subtree into dynamic rendering. Calling it inside a
  component whose data is entirely `'use cache'` deliberately converts prerenderable
  cached content into a per-request streamed hole (with a skeleton flash), for no
  freshness benefit (the cache tags keep both approaches equally fresh). It is a
  perceived-performance lever, not a correctness requirement.
- Cannot read `cookies()`, `headers()`, or `searchParams` inside a `'use cache'`
  function. The codebase respects this: request-time inputs are always read outside
  the cached scope and passed in, or deferred to client islands.

---

## 2. Rendering strategy: every route

`next.config.ts:5` confirms `cacheComponents: true`. No route file declares any
segment config (`dynamic`, `revalidate`, `fetchCache`, `runtime`, `dynamicParams`);
all rely on defaults (`dynamicParams = true`) plus per-loader `cacheLife`/`cacheTag`.

| Route | Render mode | Prerendered params | loading.tsx | Streamed holes |
|---|---|---|---|---|
| `app/(frontend)/layout.tsx` | Fully static | n/a | n/a | none (sync pass-through div) |
| `app/(frontend)/[locale]/layout.tsx` | Fully static shell | all 7 locales | No | none (WishlistProvider is a client island) |
| `app/(frontend)/[locale]/page.tsx` (home) | Fully static | inherits locale | No | none |
| `app/(frontend)/[locale]/[destination]/page.tsx` | Partial prerender | active destinations + launch fallback | No | Hero, Local Favourites, Collections |
| `app/(frontend)/[locale]/[destination]/tours/page.tsx` | Partial prerender | active destinations + launch fallback | No | Header, Listing |
| `app/(frontend)/[locale]/[destination]/[slug]/page.tsx` | Partial prerender | destination x category + fallback; tours/hubs/collections on-demand | Yes | owned by each entity component |
| `app/(frontend)/[locale]/search/page.tsx` | Partial prerender (body) | none | No | Results |
| `app/(frontend)/[locale]/wishlist/page.tsx` | Fully static shell | none | No | none (client WishlistView) |

### Per-route detail

1. `app/(frontend)/layout.tsx` - synchronous default export wrapping `children` in a
   div. No awaits, no Suspense. Fully static pass-through.

2. `app/(frontend)/[locale]/layout.tsx` - `generateStaticParams` at `:11` returns
   `ALL_LOCALES.map(locale => ({ locale }))` (no backend call). Top-level awaits:
   `params` (`:22`), then `Promise.all([getDictionary, getActiveDestinations])`
   (`:25-28`), both cached. No Suspense. `WishlistProvider` (`:37`) is a client island
   resolving per-user wishlist state in the browser, so the Navbar/Footer shell still
   prerenders. Fully static shell.

3. `app/(frontend)/[locale]/page.tsx` (homepage) - no `generateStaticParams`, no
   `generateMetadata`, no segment config. Top-level awaits: `params` (`:17`),
   `Promise.all([getDictionary, getActiveDestinations])` (`:18-21`), both cached. No
   Suspense, no `searchParams`. Entire tree is cached data. Fully static.

4. `app/(frontend)/[locale]/[destination]/page.tsx` - `generateStaticParams`
   (`:29-39`) uses `getActiveDestinations()`; on throw or empty it falls back to
   `LAUNCH_DESTINATION_SLUGS` (5 slugs). Backend-down safe. Top-level awaits before any
   Suspense: `params` (`:56`), `Promise.all([getDictionary, getDestinationBySlug])`
   (`:59-62`), both cached; `notFound()` gate on `!island.isActive` (`:65`). Three
   Suspense boundaries: Hero (`:71`), Local Favourites (`:81`), Collections (`:91`).
   `DestinationInstagram`, `FaqSection`, `DestinationAbout` (`:99-106`) render in the
   static shell (dictionary only). Partial prerender.

5. `app/(frontend)/[locale]/[destination]/tours/page.tsx` - `generateStaticParams`
   (`:27-37`) same pattern as (4) with launch fallback. Top-level awaits: `params`
   (`:56`), `Promise.all([getDictionary, getDestinationBySlug])` (`:59-62`), both
   cached; `notFound()` on inactive (`:63`). `searchParams` is NOT awaited at top
   level; it is passed as a Promise into the Suspense-wrapped `ToursListingSection`
   (`:98`). Two Suspense boundaries: `ToursHeaderSection` (`:79`), `ToursListingSection`
   (`:92`). `ToursBreadcrumb` + `ToursTrustStrip` render in the static shell. Partial
   prerender.

6. `app/(frontend)/[locale]/[destination]/[slug]/page.tsx` - the polymorphic entity
   route. `generateStaticParams` (`:83-121`) builds destination x category combos via
   `getActiveDestinations` + `getDestinationCategories`; on throw or empty it falls
   back to launch destinations x launch categories + `'tours'` + `klein-curacao`.
   Backend-down safe. Tours, hubs, collections render on-demand via default
   `dynamicParams`. `generateMetadata` (`:128-217`) awaits `params` + `resolveSlug` +
   cached loaders; it does NOT read `searchParams`, so metadata is cached-loader based.
   The page itself has no Suspense; it awaits only cached loaders (`resolveSlug` `:241`,
   `getDictionary` `:243`, `resolveDestinationName` -> `getDestinationBySlug` `:244`),
   then dispatches. `searchParams` is passed as a Promise into `CategoryPage` (`:263`),
   not awaited here. Each entity component owns its own strategy (see section 5).
   Partial prerender; the Collection branch is effectively fully static.

7. `app/(frontend)/[locale]/[destination]/[slug]/loading.tsx` - synchronous default
   export returning `<EntityPageSkeleton />`. This is the only `loading.tsx` in the
   entire `(frontend)` tree.

8. `app/(frontend)/[locale]/search/page.tsx` - `generateMetadata` (`:9-23`) awaits
   `Promise.all([params, searchParams])` and reads `searchParams.q` (`:16,19`). This
   makes the metadata request-time dynamic (legal, not a shell error), but worth
   knowing. The default export awaits `params` (`:41`) and `getDictionary` (`:44`,
   cached); `searchParams` is passed as a Promise into `SearchResultsSection` (`:59`),
   not awaited in the default export. One Suspense boundary (`:55`) with a static `<h1>`
   heading in the shell (`:50-52`). Partial prerender (body).

9. `app/(frontend)/[locale]/wishlist/page.tsx` - `generateMetadata` (`:7-13`) awaits
   `params` + `getDictionary` (cached), `robots: { index: false }`. Default export
   awaits `params` (`:25`) + `getDictionary` (`:28`, cached). No Suspense. Per-user
   data is loaded entirely inside the client `WishlistView` (`:31`). Fully static shell.

### Route-level flags

- No route awaits uncached data outside a Suspense boundary. Every `searchParams` is
  kept as an un-awaited Promise until inside a boundary (tours `:98`, search `:59`,
  category-page `:316`); all top-level page awaits are `'use cache'` loaders; no
  `cookies()`/`headers()` in any server route. No route will throw the "Uncached data
  accessed outside Suspense" prerender error.
- `search/page.tsx` `generateMetadata` reads `searchParams` (`:16`). Legal, but makes
  the metadata render-time dynamic.

---

## 3. Cached-loader ledger

> **EXECUTED 2026-07-19 - ISR-cost pass (Vercel ISR reads/writes reduction).** All
> event-covered entity/meta loaders moved from `hours` (revalidate 1 h, expire 1 d)
> to the built-in `days` profile (stale 300 s, revalidate 1 d, expire 1 w); the
> slug-registry's inline `{300,300,3600}` moved to `days` too (it was revalidating
> every 5 minutes). Rationale: every one of these loaders is already invalidated
> on-demand by the dashboard write bridge (`lib/api/cache-revalidation.ts` ->
> `updateTag`), so short timers only burned ISR writes/regenerations per Vercel's
> guidance ("event-driven data -> on-demand revalidation + long timers").
> Deliberately NOT switched: `getDestinationTours` and `searchTours` (nightly
> quality-score/eligibility re-rank has no tag-bust event; hourly/minutes windows
> are the freshness mechanism there) and `getPlatformReviews` (external provider
> aggregate, no change event, single cache entry). Follow-up that would unlock
> `days` everywhere: backend nightly jobs + booking confirmation POST
> `/api/revalidate` with the `tours` tag when they finish. Build-verified: 525
> pages, entity routes now `1d/1w`, tours listing route stays `1h/1d`.

> **EXECUTED 2026-07-19 (same day, follow-ups):**
> 1. **Nightly re-rank now busts tags** - backend `NightlyJobsService.run()` ends by
>    calling `PublicCacheService.revalidateTags(['tours','search'])`, which POSTs the
>    frontend `POST /api/revalidate` (header `x-revalidate-secret`, new backend env
>    `REVALIDATE_SECRET` + existing `ISLAND_TOURS_URL`; no-ops with a warning when
>    unset). So hub/collection renders and listings pick up the 03:00 UTC re-rank on
>    the next visit instead of waiting out the daily timer. `getDestinationTours`
>    stays `hours` anyway: traveler bookings change date-anchored availability with
>    no tag bust.
> 2. **Vercel client-nav fix** - on Vercel (NOT locally), RSC navigation requests to
>    NON-prerendered `[slug]` paths were served the cached HTML document
>    (`text/html`, `x-vercel-cache: HIT`) instead of the flight payload, so every
>    tour-card click aborted client nav and hard-reloaded the browser. Two changes:
>    `generateStaticParams` now prerenders ALL known slugs (categories + hubs +
>    collections + tours, tours via paginated `getAllTourSlugs` - the listing DTO
>    caps `limit` at 100 and a 400 would silently prerender zero tours), and
>    `proxy.ts`'s matcher now EXCLUDES locale-prefixed paths (they only ever hit the
>    pass-through; middleware presence on the request path triggered the wrong-variant
>    serve). Verified: 868 pages, locale redirect / TYP + cancel rewrites / dashboard
>    guard all intact, tour RSC requests return `text/x-component`.
> 3. **Streaming entity/destination shells** - `[slug]/page.tsx` and
>    `[destination]/page.tsx` no longer await anything before returning JSX: the
>    page returns `<Suspense fallback={<EntityPageSkeleton|DestinationPageSkeleton>}>`
>    around an async dispatch component (`EntityDispatch` / `DestinationContent`)
>    that does the resolves (now parallel via `Promise.all` - registry, dictionary,
>    destination name). Cold paths (new entity, expired cache entry) paint the
>    skeleton instantly and stream, instead of the first click blocking until the
>    backend answers. Prerendered paths resolve the boundary at build - baked
>    output verified byte-comparable to the pre-change baseline (43KB -> 59KB
>    shell, same content occurrence counts). Cold-path TTFB 0.27s vs blocking
>    full-render before.

Every loader used at page top-level is a `'use cache'` function. The only request-time
inputs anywhere are `searchParams` and `await connection()` (inside some section
components). No `cookies()`/`headers()` in any server route file. Per-user data
(wishlist/session) is deferred to client islands.

### lib/api/public/categories.ts

| Function (file:line) | use cache | cacheLife | cacheTag(s) |
|---|---|---|---|
| `getDestinationCategories` (`:29`) | yes (`:33`) | `days` | `categories`, `tours` (`:37`) |
| `getCategoryBySlugForDestination` (`:52`) | yes (`:57`) | `days` | `tours` + `category:${data.id}` when found, else `categories` (`:63`) |
| `getCategoryPageContent` (`:73`) | yes (`:77`) | `days` | `category:${categoryId}` (`:79`) |
| `getCategoryFaqs` (`:91`) | yes (`:95`) | `days` | `category:${categoryId}` (`:97`) |

### lib/api/public/collections.ts

| Function (file:line) | use cache | cacheLife | cacheTag(s) |
|---|---|---|---|
| `getActiveCollectionsForDestination` (`:29`) | yes (`:33`) | `days` | `collections` (`:35`) |
| `getCollectionRender` (`:53`) | yes (`:59`) | `days` | `tours` + `collection:${data.id}` when found, else `collections` (`:64`) |
| `getCollectionPageContent` (`:74`) | yes (`:78`) | `days` | `collection:${collectionId}` (`:80`) |

### lib/api/public/destinations.ts

| Function (file:line) | use cache | cacheLife | cacheTag(s) |
|---|---|---|---|
| `getActiveDestinations` (`:22`) | yes (`:26`) | `days` | `destinations` (`:27`) |
| `getDestinationBySlug` (`:44`) | yes (`:48`) | `days` | `destination:${data.id}` when found, else `destinations` (`:54`) |

### lib/api/public/filters.ts

| Function (file:line) | use cache | cacheLife | cacheTag(s) |
|---|---|---|---|
| `getDestinationFacets` (`:17`) | yes (`:20`) | `days` | `tours`, `categories` (`:22`) |
| `getCategoryFacets` (`:28`) | yes (`:31`) | `days` | `tours`, `categories` (`:34`) |

### lib/api/public/hubs.ts

| Function (file:line) | use cache | cacheLife | cacheTag(s) |
|---|---|---|---|
| `getDestinationHubs` (`:22`) | yes (`:26`) | `days` | `hubs`, `tours` (`:30`) |
| `getHubRender` (`:49`) | yes (`:54`) | `days` | `tours` + `hub:${data.id}` when found, else `hubs` (`:60`) |
| `getHubPageContent` (`:70`) | yes (`:74`) | `days` | `hub:${hubId}` (`:76`) |

### lib/api/public/reviews.ts

| Function (file:line) | use cache | cacheLife | cacheTag(s) |
|---|---|---|---|
| `getTourReviews` (`:24`) | yes (`:31`) | `days` | `reviews`, `tour:${params.tourId}` (`:35`) |

### lib/api/public/search.ts

| Function (file:line) | use cache | cacheLife | cacheTag(s) |
|---|---|---|---|
| `searchTours` (`:33`) | yes (`:42`) | `minutes` | `search` (`:44`) |

### lib/api/public/tours.ts

| Function (file:line) | use cache | cacheLife | cacheTag(s) |
|---|---|---|---|
| `getDestinationTours` (`:31`) | yes (`:68`) | `hours` (kept short: nightly quality-score/eligibility jobs re-rank without busting a tag) | `tours` (`:70`) |
| `getTourBySlug` (`:139`) | yes (`:144`) | `days` | `tour:${data.id}`, `operator:${data.operatorId}` when found, else `tours` (`:156-157`) |

### lib/api/slug-registry.ts

| Function (file:line) | use cache | cacheLife | cacheTag(s) |
|---|---|---|---|
| `resolveSlug` (`:26`) | yes (`:35`) | `days` (was inline `{300,300,3600}`) | `slug:${destinationSlug}:${slug}`, `slug-registry` (`:37`) |

### lib/i18n/dictionaries.ts

| Function (file:line) | use cache | cacheLife | cacheTag(s) |
|---|---|---|---|
| `getDictionary` (`:29`) | yes (`:30`) | `max` (`:38`) | none |

### lib/api/public/fetch.ts (fetch primitives, not loaders)

- `publicFetch` (`:45`) and `publicGet<T>` (`:64`): no `'use cache'` by design (caching
  is owned by each calling `'use cache'` scope). `serverHeaders()` (`:24-29`) sets
  `Content-Type: application/json` and, when `process.env.INTERNAL_API_SECRET` is set,
  adds `x-internal-api-key: <secret>` to identify the SSR/build server as a trusted
  origin so the backend skips its per-IP rate limiter (secret is server-only, never
  `NEXT_PUBLIC_`). Base URL: `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050'}/api/v1`.
- Two error contracts (EXECUTED 2026-07-19, the cached-404 fix): `publicFetch`
  retries only on HTTP 429/503 with fixed backoff `[300, 800]` ms (no jitter, since it
  runs inside `'use cache'`) and returns the raw Response regardless of status.
  - `publicGet<T>` is throw-free: `null` on any failure (network, non-2xx, bad JSON).
    Use it ONLY for soft-fallback data (lists that render empty, optional sections).
  - `publicGetStrict<T>` is for data a page gates with `notFound()`: `null` only on a
    backend 404 (genuine not-found); throws `BackendUnavailableError` on network
    error / 5xx / 429-after-retries / bad JSON. The throw makes an ISR background
    revalidation FAIL, so Next keeps serving the last good prerendered page instead
    of caching a 404 over it. Before this split, a backend outage during the 5-min
    stale-window revalidation replaced every destination/entity page with a cached
    404 (observed in production 2026-07-19 as `/en/curacao` + `/en/aruba` 404s).
  - Strict callers: `getDestinationBySlug`, `resolveSlug` (now a thin
    `publicGetStrict` wrapper - no more swallow-to-TOUR-branch on outage),
    `getTourBySlug`, `getCategoryBySlugForDestination`, `getHubRender`,
    `getCollectionRender`, `getTypByRef`. Everything else stays on `publicGet`.
  - Trade-off: `next build` now requires the backend to be reachable for prerendered
    entity routes (it fails loudly instead of silently baking 404s). Soft contexts
    that embed a strict loader must `.catch(() => null)` locally (done in
    `lib/thank-you/thank-you.ts` `getRelatedThankYouTours`).

### The complete tag universe emitted by loaders

Coarse (literal) tags: `categories`, `tours`, `collections`, `destinations`, `hubs`,
`reviews`, `search`, `slug-registry`.

Granular (templated) tag patterns: `category:${id}`, `collection:${id}`,
`destination:${id}`, `hub:${id}`, `tour:${id}`, `operator:${id}`,
`slug:${destinationSlug}:${slug}`.

### Loader-side notes

- Every loader has `'use cache'`. No loader is silently uncached.
- `getDictionary` has `'use cache'` + `cacheLife('max')` but no `cacheTag`, so it can
  only time-revalidate (and `max` is effectively indefinite). Editing the dictionary
  JSON requires a redeploy/restart. Acceptable because these are UI chrome strings that
  ship with the build, not backend data.

---

## 4. Revalidation ledger

### Mechanism (mutation to public cache bust)

1. A dashboard mutation (TanStack Query `useMutation`) calls a `lib/api/<module>.ts`
   method, which calls `apiFetch(path, init)` in `lib/api/fetch.ts`.
2. `apiFetch` performs the `fetch`. On a successful (`res.ok`) response it calls
   `revalidatePublicForPath(path, method)` (`lib/api/fetch.ts:64`).
3. `revalidatePublicForPath` (`lib/api/cache-revalidation.ts:141`) short-circuits for
   non-mutating verbs (`MUTATING_METHODS = POST/PATCH/PUT/DELETE`), maps path -> tags
   via `tagsForMutation`, and if non-empty fires the Server Action fire-and-forget:
   `void revalidateCacheTags(tags).catch(() => {})` (`:148`). A failure is swallowed;
   stale cache self-heals at the next `cacheLife`.
4. `revalidateCacheTags` (`app/_actions/revalidate.ts:53`, a `'use server'` action)
   loops the tags and calls `updateTag(tag)` (`:55`).
5. `updateTag` immediately expires those tags; the next request regenerates any
   `'use cache'` read carrying a matching `cacheTag`.

Only `updateTag` (immediate) is used. There is no `revalidateTag` (background) and no
`revalidatePath` anywhere in the app. Docstring at `revalidate.ts:46-52` explicitly
chooses `updateTag` so the next visitor sees the change.

### Trigger to tag mapping

There is no path->tag object; the mapping is the `switch (seg0)` in `tagsForMutation`
(`cache-revalidation.ts:48-134`). `parts` = path with query/fragment stripped, leading
slashes removed, split on `/`. `slug` = `['slug-registry']` only when
`affectsSlugRegistry(parts, method)` is true.

`affectsSlugRegistry` (`:37-42`) is true for: `POST /entity` (1 segment);
`DELETE`/`PATCH /entity/:id` (2 segments); `/entity/:id/<verb>` where verb is in
`LIFECYCLE_VERBS = {status, publish, pause, unpause, archive, restore}` (`:28`).

| Trigger (seg0 / path shape + method) | Tags emitted | Source line |
|---|---|---|
| `tours` with seg1 present and seg1 != `slug` | `tour:<seg1>`, `tours`, `search` (+ `slug-registry` if slug-affecting) | 61-64 |
| `tours` (bare `POST /tours`, or `/tours/slug/...`) | `tours`, `search` (+ `slug-registry` on `POST /tours`) | 62-63 |
| `availability` (any mutation) | `tours`, `search` | 69-71 |
| `tiers` with seg1=`tours` and seg2 present (`/tiers/tours/:tourId/...`) | `tour:<seg2>`, `tours`, `search` | 75-78 |
| `tiers` otherwise (e.g. `/tiers/admin/spotlight/:id`) | `tours`, `search` | 77 |
| `attributes` (dictionary) | `tours`, `search` | 83-85 |
| `operators` with seg1 | `operator:<seg1>`, `tours`, `search`, `user-profile` | 91-94 |
| `operators` bare | `tours`, `search`, `user-profile` | 93 |
| `destinations` with seg1 | `destination:<seg1>`, `destinations` (+ `slug-registry`) | 96-99 |
| `destinations` bare | `destinations` (+ `slug-registry` on POST) | 98 |
| `categories` with seg1 | `category:<seg1>`, `categories` (+ `slug-registry`) | 101-104 |
| `categories` bare | `categories` (+ `slug-registry` on POST) | 103 |
| `collections` with seg1 | `collection:<seg1>`, `collections` (+ `slug-registry`) | 106-109 |
| `collections` bare | `collections` (+ `slug-registry` on POST) | 108 |
| `hubs` with seg1 | `hub:<seg1>`, `hubs` (+ `slug-registry`) | 111-114 |
| `hubs` bare | `hubs` (+ `slug-registry` on POST) | 113 |
| `users` (e.g. `/users/me`) | `user-profile` | 118-120 |
| `settings` (e.g. `/settings/social-media`) | `user-profile` | 124-126 |
| anything else (media-gallery, operator-settings, wishlist, read-only lookups) | `[]` (no-op) | 128-129 (default) |

Tags are de-duped via `[...new Set(tags)]` (`:133`). The `tours` branch guards
`seg1 !== 'slug'` (`:62`) so `/tours/slug/:slug` read paths never produce a bogus
`tour:slug` tag.

Special rules:
- slug-registry busting appended only for slug-affecting writes; content-only
  sub-routes (translations, page-content, FAQs, images) do NOT bust `slug-registry`.
- user-profile: busted by `users`, `settings`, and `operators` branches (the last
  because `getUserProfile` reads operator company/social info).
- wishlist, media-gallery, operator-settings, read-only slug lookups: intentionally
  unmapped no-ops.

### Tags the revalidation layer CAN bust (14 distinct)

`tours`, `search`, `destinations`, `categories`, `collections`, `hubs`,
`slug-registry`, `user-profile`, `tour:<id>`, `operator:<id>`, `destination:<id>`,
`category:<id>`, `collection:<id>`, `hub:<id>`.

---

## 5. Streamed-section and entity-component correctness

Confirmed: every `lib/api/public/*` loader is `'use cache'`, so the only request-time
triggers inside these components are `await connection()` and `await searchParams`. No
component awaits uncached data outside a parent Suspense boundary (no prerender-blocking
anti-pattern).

| Component | async/client | connection()? | reads searchParams? | wrapped in Suspense by parent? | owns Suspense? | Verdict |
|---|---|---|---|---|---|---|
| `tour-page.tsx` `TourPage` | sync server | no | no | no (direct in EntityPage) | yes (`:48`, `:57`) | correct (sync shell) |
| `tour-detail-content.tsx` | async | yes (`:99`) | no | yes (`tour-page.tsx:48`) | yes (`:363`, `:627`) | correct (stray `console.log` `:102`) |
| `tour-reviews-blocks.tsx` (Preview/Block) | async | yes (`:36`/`:79`) | no | yes (`:363`/`:627`) | no | correct |
| `tour-related-tours.tsx` | async | yes (`:35`) | no | yes (`tour-page.tsx:57`) | no | correct |
| `category-page.tsx` | async | no | no (forwards Promise) | no (all cached) | yes (`:310`) | correct |
| `collection-page.tsx` | async | no | no | no (all cached) | no | correct (legit no-stream) |
| `hub-page.tsx` `HubPage` | async | no | no | no (all cached) | yes (`:561`) | correct |
| `hub-page.tsx` `HubTripsData` | async | no | no | yes (`:561`) | no | inert Suspense (does not stream) |
| `hub-trips-section.tsx` | client | no | no | n/a | no | correct (client leaf) |
| `tours/tours-listing-section.tsx` | async | no (comment wrongly claims yes) | yes (`:83`) | yes (`tours/page.tsx:92`; `category-page.tsx:310`) | no | correct via searchParams; stale comment |
| `tours/tours-header-section.tsx` | async | no (imported `:1`, never called) | no | yes (`tours/page.tsx:79`) | no | inert Suspense; dead import |
| `destination/destination-page-sections.tsx` `DestinationHeroSection` (`:38`) | async | no | no | yes (dest page `:71`) | no | inert Suspense (does not stream) |
| `destination/destination-page-sections.tsx` `DestinationLocalFavourites` (`:117`) | async | yes (`:124`) | no | yes (dest page `:81`) | no | correct (streams) |
| `destination/destination-page-sections.tsx` `DestinationCollectionsSection` (`:152`) | async | no | no | yes (dest page `:91`) | no | inert Suspense (does not stream) |
| `search/search-results-section.tsx` | async | no (not imported) | yes (`:37`) | yes (`search/page.tsx:55`) | no | correct via searchParams; stale comment |
| `wishlist-provider.tsx` | client | no | no | n/a | no | correct (client store) |
| `wishlist-view.tsx` | client | no | no | no (client, self-managed loading) | no | correct |

Entity components summary:
- Category / Hub / Tour: cached shell renders instantly; only their genuinely dynamic
  sub-section is wrapped in Suspense. Correct.
- Collection: fetches its entire payload in one cached round-trip
  (`getCollectionRender`), no `searchParams`, no per-request part. Fully prerenderable,
  so it legitimately has no Suspense. Correct, not a gap.

---

## 6. Cross-reference: loader tags vs bustable tags

| Loader `cacheTag` | Can revalidation bust it? |
|---|---|
| `tours`, `search`, `destinations`, `categories`, `collections`, `hubs`, `slug-registry` | yes |
| `tour:`, `operator:`, `destination:`, `category:`, `collection:`, `hub:` | yes (granular) |
| `slug:${dest}:${slug}` | covered by the coarse `slug-registry` (never busted granularly, which is fine) |
| `reviews` | NO branch ever emits it |
| `getDictionary` (untagged) | NO tag, by design |

`user-profile` is bustable but is not a public-content loader tag; it is the dashboard
`getUserProfile` cache (separate concern). Symmetric.

---

## 7. Gaps

### G1 (real, currently latent): `reviews` is unbustable

`getTourReviews` tags `reviews` + `tour:${id}`, but `cache-revalidation.ts` has no
`case 'reviews'` (confirmed: cases are tours, availability, tiers, attributes,
operators, destinations, categories, collections, hubs, users, settings). Today this is
latent, not an active production bug, because there is no review-mutation client in the
frontend yet (the reviews module is "to build"; `lib/api/reviews.ts` is GET-only, and
no review write path calls `apiFetch`).

Impact when review moderation (approve/edit/delete) ships: review list changes AND the
tour rating/count aggregate (served by `getTourBySlug`, tagged `tour:${id}`) will be
stale up to 1 hour (`cacheLife('hours')`), because a `/reviews/...` mutation falls
through to the no-op default and busts nothing.

Fix (when the write lands): add `case 'reviews'` busting `['reviews', tour:${id},
'tours', 'search']` (tours/search included because tour cards display the rating). If
the review write path is nested under tours (`/tours/:id/reviews/...`), the existing
`tours` branch already covers `tour:${id}` + `tours` + `search` but NOT `reviews`; that
still needs the `reviews` tag added.

### G2 (real): no `loading.tsx` on the on-demand-capable content routes

Only `[slug]` has a `loading.tsx` (`EntityPageSkeleton`). Next.js `loading.tsx` does
not cascade to parent/sibling segments, so `[destination]` and `[destination]/tours`
have none. Both files even assert in their own comments that "the route's loading.tsx
covers navigation" (`[destination]/page.tsx:49`, `tours/page.tsx:47`), but none exists
at those segments.

For prerendered params this is invisible (the static shell serves instantly). But for a
non-prerendered destination (a new island activated after build, or a launch-fallback
slug that is not truly active), the top-level `await getDestinationBySlug` runs at
request time with no instant fallback, so navigation can hang on a blank body until the
cached loader resolves.

Fix: add `loading.tsx` at `[destination]` and `[destination]/tours` composing the
existing section skeletons (`DestinationPageSkeleton`, `ToursPageSkeleton`). This also
gives those skeletons a real, correct home (see section 8).

### G2b (minor): `getDictionary` is untagged

`cacheLife('max')`, no `cacheTag`. Fine as long as locale copy ships with the build.
Only add a `translations` tag if the dictionary ever becomes backend-editable.

---

## 8. Systemic inconsistency: `connection()` usage and orphaned skeletons

`await connection()` is used inconsistently on cached sections. A section wrapped in
`<Suspense>` only streams (and shows its skeleton) if it reads request-time data
(`connection()` or `searchParams`). A cached section without a trigger bakes into the
static prerender and its skeleton never renders.

Sections that DO stream (skeleton shows): `DestinationLocalFavourites` (connection),
`ToursListingSection` (searchParams), `SearchResultsSection` (searchParams), tour detail
/ reviews / related (connection).

Sections that are wrapped in Suspense but do NOT stream (skeleton never shows):
- `ToursHeaderSection` - dead `connection` import at `:1`, never called.
- `DestinationHeroSection` - no trigger.
- `DestinationCollectionsSection` - no trigger.
- `HubTripsData` (hub trips) - no trigger.

Direct consequence for the loading-skeleton work: `ToursHeaderSkeleton`,
`DestinationHeroSkeleton`, `DestinationCollectionsSkeleton`, and `HubTripsPanelSkeleton`
currently render nowhere. Their Suspense boundaries are inert, and the routes that host
them have no `loading.tsx` to reuse the skeletons. (`[slug]/loading.tsx` renders the
generic `EntityPageSkeleton`, not `HubTripsPanelSkeleton`.)

The Cache Components principle: cached content should be prerendered directly; only
truly request-varying content (searchParams/cookies/per-user) needs Suspense. Forcing
cached data through `connection()` trades instant, SEO-in-HTML, no-flash content for a
per-request skeleton flash, with no freshness benefit (tags keep both fresh). So the
sections WITHOUT `connection()` are the ones following the canonical pattern; the
question is whether that is intentional and whether the skeletons should exist.

---

## 9. Cleanups (low risk)

- Remove the dead `connection` import in `tours/tours-header-section.tsx:1`.
- Remove the debug `console.log('details', detail)` at `tour-detail-content.tsx:102`.
- Fix stale docstrings claiming `await connection()` where it is not used:
  `tours/tours-listing-section.tsx:26-27`, `search/search-results-section.tsx:28-31`,
  `destination/destination-page-sections.tsx:19-24`, `hub-page.tsx:50-52` and `:558-560`,
  `tours/tours-header-section.tsx:11-13`.
- `lib/api/public/destinations.ts:19` comment says `revalidateTag('destinations')` but
  the code uses `updateTag`. Correct the comment.
- The `/{destination}/thank-you/{public_ref}` TYP route from CLAUDE.md does not exist.
  Expected (booking module is "to build"); track it with the booking work.

---

## 10. Recommendation and decision

The single decision that resolves most of section 8: pick a streaming policy per
page-type and apply it uniformly.

Recommended policy:

1. Prerendered content pages (home, `[destination]`, `tours` shell, category):
   let cached sections prerender. Drop the inert Suspense + any `connection()` that only
   forces cached data to stream (Hero, Collections, Favourites, tours-header,
   hub-trips). Result: instant LCP, SEO content in the initial HTML, no skeleton flash.
   Then add `loading.tsx` to `[destination]` and `[destination]/tours` composing the
   section skeletons. This fixes G2 and gives those skeletons a real home
   (client navigation + on-demand param miss).

2. Genuinely dynamic sections keep streaming: `ToursListingSection` and
   `SearchResultsSection` (searchParams), and the on-demand tour-detail sections
   (connection). Their skeletons correctly show. Leave as-is.

3. Fix G1 when the review-write module lands (add `case 'reviews'`), or add the branch
   pre-emptively now so it is ready.

4. Sweep the cleanups in section 9.

Alternative policy (if shell-first streaming is preferred over baked-static): keep
`connection()` but apply it to ALL below-the-fold cached sections uniformly (add it to
the currently-inert ones), so every section streams and every skeleton shows. This is
valid but gives up the instant-content benefit on prerendered pages. Do not leave the
current half-and-half state.

---

## 11. Action checklist

Priority order. Status as of the 2026-07-12 execution pass (see section 13).

- [x] (a) Cleanups: removed dead `connection` import (`tours-header-section.tsx`),
      removed `console.log` (`tour-detail-content.tsx`), fixed stale `connection()`
      docstrings (`tours-listing-section`, `search-results-section`,
      `destination-page-sections`, `tours-header-section`), fixed `destinations.ts`
      `updateTag` comment.
- [x] (b) Added `app/(frontend)/[locale]/[destination]/loading.tsx`
      (`DestinationPageSkeleton`) and `.../tours/loading.tsx` (`ToursPageSkeleton`).
      Fixes G2.
- [x] (c) Applied the streaming policy (see the refinement in section 13). Prerendered
      routes bake cached sections static; the on-demand hub route streams its secondary
      trips fetch.
- [x] (d) G1: added `case 'reviews'` to `tagsForMutation` busting `['reviews', 'tours',
      'search']`, with a code comment about the tour-detail aggregate (`tour:<id>`) for
      when the reviews module lands.
- [ ] (e) Optional: add a `translations` tag to `getDictionary` only if locale copy
      becomes backend-editable. Not done (deliberate).
- [ ] (f) Track the unimplemented TYP `/{destination}/thank-you/{public_ref}` route with
      the booking module. Not a code change; tracked here.

---

## 12. The coherent policy applied (supersedes the per-section list in section 10)

The section-10 recommendation lumped `hub-trips` into "bake static". Execution used a
cleaner, uniform principle instead:

- Prerendered routes (home, `[destination]`, `[destination]/tours`, category): cached
  sections bake into the static shell (instant, SEO-in-HTML, no skeleton flash), kept
  fresh via cache tags. Streamed holes only for `searchParams` (tours-listing,
  search-results). Route `loading.tsx` covers client navigation and cold on-demand
  param misses.
- On-demand entity routes (`tour`, `hub`) under `[slug]`: instant cached shell + stream
  the heavy / secondary fetch via `await connection()` behind its skeleton. Tour detail
  already did this; `hub-trips` now does too (its secondary `getDestinationTours` fetch
  is separate from the hub render). Collection has no secondary fetch, so it stays fully
  static and relies on `[slug]/loading.tsx`.

Net: every `<Suspense>` boundary now either genuinely streams or was removed, and every
section skeleton has a defined home (streamed fallback for the on-demand ones;
`loading.tsx` composition for the prerendered ones).

---

## 13. Execution log (2026-07-12)

Files changed:

- `lib/api/cache-revalidation.ts` - added `case 'reviews'` (G1).
- `lib/api/public/destinations.ts` - fixed `updateTag` doc comment.
- `components/frontend/tour-detail-content.tsx` - removed debug `console.log`.
- `components/frontend/tours/tours-listing-section.tsx` - docstring corrected
  (streams via `searchParams`, not `connection()`).
- `components/frontend/search/search-results-section.tsx` - docstring corrected.
- `components/skelitons/destination-page-skeleton.tsx` - docstring corrected.
- `app/(frontend)/[locale]/[destination]/loading.tsx` - NEW (G2).
- `app/(frontend)/[locale]/[destination]/tours/loading.tsx` - NEW (G2).
- `app/(frontend)/[locale]/[destination]/page.tsx` - removed the 3 `<Suspense>`
  wrappers + skeleton/`Suspense` imports; sections render inline (baked static);
  docstring updated.
- `components/frontend/destination/destination-page-sections.tsx` - removed
  `connection` import + the `await connection()` in `DestinationLocalFavourites`;
  module docstring updated.
- `app/(frontend)/[locale]/[destination]/tours/page.tsx` - removed the header
  `<Suspense>` (bake static); kept the listing `<Suspense>`; removed unused
  `ToursHeaderSkeleton` import.
- `components/frontend/tours/tours-header-section.tsx` - removed dead `connection`
  import; docstring updated.
- `components/frontend/hub-page.tsx` - added `connection` import + `await connection()`
  at the top of `HubTripsData` so its existing `<Suspense>` genuinely streams.

Verification: `pnpm build` green. TypeScript clean. Static page count rose from 356 to
434 (destination pages now bake to full static output per locale x destination). All
affected routes classify as Partial Prerender (`◐`). No "Uncached data accessed outside
Suspense" errors.

Left open by design: (e) `getDictionary` tag (chrome ships with the build), (f) TYP
route (booking module not built), and the latent `tour:<id>` half of G1 (needs the
review write path shape, decided when the reviews-moderation module is built).

---

## 12. Appendix: what was verified

- `next.config.ts:5` - `cacheComponents: true`.
- All 9 route files under `app/(frontend)` read in full (layouts, home, destination,
  tours, entity `[slug]`, entity `loading.tsx`, search, wishlist).
- All `lib/api/public/*.ts` loaders, `lib/api/slug-registry.ts`,
  `lib/i18n/dictionaries.ts`, `lib/api/public/fetch.ts` read in full.
- `lib/api/cache-revalidation.ts`, `lib/api/fetch.ts` revalidation hook,
  `app/_actions/revalidate.ts` read in full.
- All streamed section + entity components read in full (tour-page,
  tour-detail-content, tour-reviews-blocks, tour-related-tours, category-page,
  collection-page, hub-page, tours-listing-section, tours-header-section,
  destination-page-sections, search-results-section, wishlist-provider, wishlist-view).
- Confirmed: no `case 'reviews'` in the revalidation switch; no review-mutation client
  in the frontend; no `/thank-you`/TYP route in the app tree; no segment-config exports
  in any route file.
