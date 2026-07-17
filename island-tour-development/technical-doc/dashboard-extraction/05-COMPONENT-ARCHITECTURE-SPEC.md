# Phase 5 - Component Architecture Specification

> Rules, not preferences. Each is traceable to an audit finding, and each is stated so that a reviewer
> can reject a PR by pointing at it.

---

## 1. The problem this solves

**161 of 207 dashboard files are `'use client'` (77.8%).** All 28 trips components are. The App Router is being used as a static file server for a client-side SPA (A-1).

That single fact produces: skeleton-first paint on every screen, a 10,363-LOC editor in one client boundary, tabs instead of routes (because tabs are free and routes were not being used), and `trip-detail-shell.tsx` marked `'use client'` while containing zero hooks, zero handlers and zero interactivity.

**The target is not "fewer client components" as an aesthetic. It is: the server does the work it is uniquely able to do, and the client does the rest.**

---

## 2. Server / client boundary rules

### R1 · Server by default. `'use client'` is opt-in and must be justified.

A file gets `'use client'` **only if it uses** `useState` / `useReducer` / `useEffect` / `useRef`-for-DOM, an event handler, a browser API, a Context consumer, or a client-only library (RHF, TanStack Query, Recharts, framer-motion, dnd-kit).

If none apply, it is a Server Component. No exceptions, and specifically:

> **`trip-detail-shell.tsx` is the canonical violation.** 49 lines: a `Breadcrumb`, an `<h1>`, a
> `<Skeleton>`, `{children}`. Marked `'use client'`. The directive is inert anyway because a client
> parent imports it - which is exactly what makes this insidious: **it costs nothing to add and
> nothing visibly breaks, so it spread to 161 files.**

### R2 · The boundary goes at the deepest leaf that needs it.

```
BAD                                   GOOD
page.tsx          server              page.tsx              server
└ EditView        'use client'  ←     └ EntityShell         server   (breadcrumb, title)
  ├ Breadcrumb      (client)            ├ ReadinessRail     server   (pure computation)
  ├ Title           (client)            ├ TabNav            server   (<Link>s)
  ├ ReadinessCard   (client)            └ DetailsForm       'use client'  ← only this
  └ DetailsForm     (client)
```

Corollary: **a server component may render a client component, but not vice versa** - except through `children`. Passing server-rendered JSX as `children` into a client component is the primary tool for keeping the boundary deep. Use it.

### R3 · Data fetching belongs to the server unless it is user-interactive.

| Data | Where | Why |
|---|---|---|
| The entity being edited | **server**, in `layout.tsx`, once | Every tab needs it. Today half the tabs get it as a prop and half re-query (G-5). |
| Lists with URL-driven state (page, sort, filter) | **server**, from `searchParams` | The URL is already the state. Re-deriving it client-side after hydration is work done twice. |
| Child collections mutated in place | TanStack Query (client) | Optimistic updates, invalidation. Correct today. |
| Session / role | **server**, in `layout.tsx` | Correct today. **Do not touch** (see R11). |
| Anything behind a user interaction | client | |

### R4 · Never a client boundary for a provider you can hoist.

`QueryClientProvider` is mounted in the **root** layout today, so the public site pays for it. In the standalone repo it mounts in the dashboard root - correct by construction. But the rule generalizes: a provider at the root turns the root into a client boundary for everything beneath. Mount at the shallowest node that *needs* it, not the shallowest node available.

---

## 3. Composition

### R5 · One file, one responsibility. Hard limits.

| Kind | Soft | Hard |
|---|---|---|
| Component | 150 | **250** |
| Hook | 100 | 200 |
| API module | 200 | 400 |

Today: 7 trips files exceed 400 and hold **47% of the module** (4,873 of 10,363). `trip-schedules-tab.tsx` is 1,165.

The limit is a smoke alarm, not a rule of taste. A 1,165-line component is never one responsibility - `trip-schedules-tab.tsx` holds three unrelated managers, a locally-redefined `DatePickerField` duplicating a shared one, and the `scheduledSlotsForDate` availability algorithm.

### R6 · Business logic never lives in a view file.

Confirmed violations, each moves:

| Logic | From | To |
|---|---|---|
| `scheduledSlotsForDate` | `trip-schedules-tab.tsx:770-790` | `lib/tours/availability.ts` |
| `refundDue`, `paymentModelLabel` | `booking-columns.tsx` (exported, imported by 2 others) | `lib/bookings/refund.ts` |
| `deriveTourBadge`, `formatTourSignals` | `lib/tours/listing.ts` (shared with the public site) | `lib/tours/derive-badge.ts`, `signals.ts` |
| `toSlug` | duplicated in `trip-form.tsx` + `trip-details-tab.tsx` | `lib/utils/slug.ts` - **one copy, kept in sync with the backend util** |
| `numOrNull`, `numOrUndef`, `strOrNull` | `trip-locations-tab.tsx:78-80`, verbatim in `trip-pickup-locations-tab.tsx:58-60` | `lib/utils/coerce.ts` |
| `durationHint` | `trip-details-tab.tsx:352-364` (mirrors the public site) | `lib/tours/duration.ts` |
| `buildQuery` (local dup) | `bookings-dashboard.ts:16-29` | delete; import `lib/api/query.ts` |

Test: **if it can be unit-tested without React, it does not belong in a `.tsx`.**

### R7 · Extract a shared component **only** on the third occurrence - and then delete the forks.

The audit's central finding, restated because it governs this whole document:

> **This codebase's failure mode is not missing abstractions. It is un-adopted ones.**
> A generic `DataTable` (813 LOC) exists and **all 10 tables ignored it.** A generic `ConfirmDialog`
> whose docstring says "any potentially-destructive dashboard action" has **2 of ~10** consumers. A
> shared `DatePickerField` exists and the schedules tab redefined it locally. A shared
> `deactivate-dialog` sits behind **four clone wrappers**. `FaqManager` is the one that won.

**Therefore, a mandatory PR rule:**

> **A PR that adds a shared component and does not delete every fork it replaces is incomplete and
> must be rejected.** Not "follow-up ticket". Same PR.

This is the only rule in this document with teeth against the specific way this codebase decays.

### R8 · Composition over configuration.

```
BAD   <EntityTable module="tours" showBulk showCommission={role==='ADMIN'} variant="compact" />
GOOD  <DataTable data={tours} columns={tourColumns}>
        <DataTable.Toolbar><TableSearch /><ColumnVisibility /></DataTable.Toolbar>
        <DataTable.BulkBar><ArchiveAction /></DataTable.BulkBar>
      </DataTable>
```

A boolean prop that gates JSX is a slot wearing a disguise. The 813-line `data-table.tsx` failed partly because it was configuration-shaped: adapting it to a real module was harder than writing a new table.

---

## 4. State ownership

### R9 · One system per kind of state. No overlap.

| Kind | Owner |
|---|---|
| Server data | **TanStack Query.** Only. |
| Form state | **react-hook-form + zod.** Only. |
| URL state (page, sort, filter, tab) | **`searchParams`.** Only. |
| Ephemeral UI (open/closed, hover) | `useState`, colocated |
| Cross-cutting (role, sidebar collapse, upload progress) | Context / zustand |

Today four systems overlap: `AgeBandRow` holds **8 `useState`s** where RHF belongs; the schedules add-form holds 6 plus a **hand-rolled `errors` object**; and **two validation systems coexist** - zod resolvers in some rows, imperative `if (!HHMM.test(...))` in others (G-4).

**All `useState` row editors migrate to RHF. All imperative validation migrates to zod. No exceptions.**

### R10 · URL state is the default for anything a user would bookmark, share, or expect back to work.

Today `?tab=` is read once into an uncontrolled `<Tabs defaultValue>`, so switching tabs does not update the URL, tabs are not linkable, and **browser back exits the editor**. Row actions deep-link to 6 of 13 tabs, which makes the inconsistency more visible, not less.

`04` resolves this by making tabs **routes**. The general rule: page, sort, filter, search, tab, and selected-record all live in the URL.

### R11 · Do not "optimize" the auth path.

Three properties are load-bearing and non-obvious. Each has a comment in the source explaining it. **Read the comment before touching the line.**

| Property | Where | Why |
|---|---|---|
| `getUserProfile` uses React `cache()`, **never `'use cache'`** | `userActions.ts:41-48` | A cached `null` from a transient 429 would bounce logged-in users to `/portal`. |
| `guardDashboard` does **no network call** | `proxy.ts` | Middleware runs on every navigation. The layout is the authority. |
| `RoleContext` defaults to **deny-all** | `role-context.tsx` | A missing provider must deny, not permit. |

### R12 · Delete every `as unknown as Resolver<T>`.

Five occurrences (`trip-form.tsx:170`, `trip-details-tab.tsx:380`, `trip-pricing-tab.tsx:532`, `:721`, `:783`). A double-cast through `unknown` to bridge string-typed form values against a coerced schema.

That cast is **the type system reporting a real modeling problem and being told to be quiet.** Fix the schema (use `z.coerce` consistently, or type the form values to match), and the cast disappears on its own. If it does not disappear, the model is still wrong.

---

## 5. Dependency direction

```
app/          →  components/  →  hooks/  →  lib/api/  →  lib/  →  types/
(routes)         (UI)            (data)     (HTTP)       (pure)   (contracts)
```

**Arrows point right. Never left. Never sideways at the same layer.**

| # | Rule |
|---|---|
| D1 | `lib/` **never** imports from `components/`. Violated today: `lib/tours/listing.ts:5-6` imports types from `components/frontend/*` (A-2). |
| D2 | `types/` imports nothing but `types/`. |
| D3 | `components/<module>/` never imports `components/<other-module>/`. Shared goes to `components/common/`. |
| D4 | `hooks/<domain>/` may import `lib/api/<domain>` and `types/`. Nothing else. Violated today: `hooks/tiers/use-tiers.ts` and `hooks/locals-favourites/*` import `hooks/trips/use-trips`. |
| D5 | **No file outside this repo.** The isolation test: `grep -rn "@/components/frontend\|@/lib/api/public" .` returns zero, forever. |

**Enforce D1-D5 with `eslint-plugin-import/no-restricted-paths`.** Rules that are not lintable are, per the audit, aspirations.

---

## 6. Directory structure

```
components/
├── ui/                  forked shadcn primitives. Imports: react, radix, cn. NOTHING else.
├── common/              cross-module: StatusBadge, ConfirmDialog, EntityShell, SeoForm, FaqManager
├── data-table/          THE table system
├── shell/               sidebar, header, nav, command palette
├── skeletons/           (typo fixed)
└── <module>/            tours/, bookings/, media/, ...
```

| Rule | |
|---|---|
| `ui/` is a leaf | If a file in `ui/` imports from `lib/api/`, it is not a primitive. |
| `common/` earns its place by R7 | Third occurrence, forks deleted. |
| `<module>/` is private | Reaching into another module's folder is D3. |

---

## 7. The `DataTable` system

The keystone of Phase 5, and the clearest test of R7.

**Today:** 10 tables each hand-roll `useReactTable` + `flexRender` + toolbar + pagination. Three pagination strategies. Three search implementations. Four status-badge conventions. `PAGE_SIZE_OPTIONS` redeclared per table. Every empty state hand-written. Three tables have **no loading skeleton at all**. And an 813-line generic table sits unused.

**Target:**

```
components/data-table/
├── data-table.tsx          client   TanStack shell + slots
├── data-table-toolbar.tsx  client   search, filters, column visibility
├── data-table-bulk-bar.tsx client   appears on selection
├── data-table-pagination.tsx client server-driven only
├── data-table-skeleton.tsx SERVER   matches real row height + column count
├── data-table-empty.tsx    SERVER   icon + title + explanation + action
└── use-table-state.ts      client   URL-synced page/sort/filter/search (R10)
```

`use-table-state` also retires the duplicated 500ms-debounce state machine written twice in `bookings-list-view.tsx` and `payments-list-view.tsx`.

**Adoption is the deliverable, not the component.** Per R7, the PR that lands `data-table/` deletes all 10 forks and the dead `data-table.tsx`. If it lands with 10 forks alive, we have written an eleventh table.

---

## 8. Testing

| Layer | Tool | Covers |
|---|---|---|
| Pure logic (`lib/`) | vitest | slug, refund, availability, coerce, tag mapping |
| Contract | vitest + live backend | rbac vs `/auth/permissions`; types vs Swagger (02 Appendix B) |
| Component | RTL | `StatusBadge` variants, `DataTable` states |
| E2E | Playwright (installed) | the parity checklist (02 §11) |

Priority: **the tag-mapping tests (02B §10.1) and the rbac contract test (02 Appendix B1)**. Both guard silent failures - the only class of bug this migration can produce that nothing else will catch.

---

## 9. Definition of done

A module is refactored when:

- [ ] Route files are Server Components
- [ ] `'use client'` appears only on leaves that need it (R1, R2)
- [ ] No file over 250 lines (R5)
- [ ] No business logic in `.tsx` (R6)
- [ ] **Every fork it replaces is deleted in the same PR** (R7)
- [ ] One state system per kind (R9)
- [ ] Page/sort/filter/tab in the URL (R10)
- [ ] Zero palette classes, zero hex, zero arbitrary `text-[...]` (03 §8)
- [ ] `StatusBadge` for every status, with its non-color cue
- [ ] Loading, empty, and error states exist
- [ ] Dependency direction clean (D1-D5)
- [ ] No `as unknown as` (R12)

**Target: 161/207 client -> ~110/190 (~58%).** Not zero - this is a CRM, and forms and tables are genuinely interactive. The wins are concentrated in shells, rails, tab navs, skeletons, empty states, and column definitions: the things that never needed to be client and became client by contagion.
