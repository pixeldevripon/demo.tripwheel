# Phase 6 - Phased Implementation Plan

> **Approved and in progress.** Phases 1-8 are DONE and committed (2026-07-17); Phase 9 is next.
> Each executed phase carries an **EXECUTED** block holding what actually happened - corrections,
> deviations, and measured numbers. **Where an EXECUTED block contradicts the bullets above it,
> the EXECUTED block wins:** the bullets are the plan as written before contact with the code.
>
> Every phase: objective · affected files · rationale · dependencies · risks · validation · rollback.

## Progress

| Phase | Stage | Status | Commit |
|---|---|---|---|
| 1 · Cache-revalidation bug | A | **done** | `bbdd159` (monorepo) |
| 2 · Sever cross-tree imports | A | **done** | `5ee032e` (monorepo) |
| 3 · Sort `components/` by owner | A | **done** | `44becee` (monorepo) |
| 4 · Delete dead code | A | **done** | `528655f` (monorepo) |
| 5 · Scaffold and copy | B | **done** | `2977a77` (dashboard, pushed) |
| 6 · Base path -> `/` | B | **done** | `313d291` (dashboard, pushed) |
| 7 · Cache revalidation | B | **done** | `631ac56` (dashboard) + `6c65d0d` (monorepo) |
| 8 · Env + Vercel | B | **done, code side** | `cfdd38b` (dashboard) + `4c1d7f4` (monorepo) |
| 9 · Parity + cutover | B | **automated half DONE - no regression.** Visual rows + staging + DNS open | - |
| **9B · E2E suite trim** | B | **PARTIAL** - 55 cut, mocks repointed; trips fixtures parked (~1 day) | `2ac049c` (dashboard, branch `ui-fix`) |
| **10 · Lint rules** | **C** | **DONE** - 8 rules as `warn`, 428 warnings / 0 errors, all validated firing | `98aedb1` (dashboard, branch `ui-fix`) |
| **11 · Token system** | **C** | **DONE** - gate GREEN (34 checks x2 modes); it caught 2 defects in the spec's own palette | `fdb0294` (dashboard, `ui-fix`) |
| **12 · StatusBadge** | **C** | **NEXT** - the R7 test: add the primitive AND delete the 4 conventions | - |
| 13-23 | C/D/E | not started | - |

**Phase 8 has one open half:** the staging deploy itself (Vercel project + DNS) is the user's
action, not a code task. **Phase 9 did not wait for it** - see that phase.

**Phase 9 found no regression.** 171/171 component files clean; all 227 e2e tests behave
identically on both dashboards. What remains is not verification of the *move* - it is the visual
sign-off only a human can give, plus checks #2/#9 which need the deployed origin.

The spec set was written before any of this ran. Docs `00`, `01`, `03`, `04`, `05` are unexecuted
analysis and still stand as written. `02` and `02B` carry executed corrections inline. `02C` is a
**deferred separate project** (the `island.tours` target), untouched by phases 1-9.

---

## Governing principles

| # | Principle |
|---|---|
| 1 | **Extraction and redesign never interleave.** If a screen breaks, you must know whether the move or the redesign broke it. Stages A-B are pure moves with zero behavior change. |
| 2 | **Decoupling work lands in the current repo first.** Phases 1-4 ship independently and have value even if the split slips. This front-loads the value and shrinks the risky cut. |
| 3 | **Every phase is independently revertible.** One phase, one PR, one revert. |
| 4 | **A PR that adds a shared component and does not delete its forks is rejected** (05 R7). Non-negotiable - it is the specific way this codebase decayed. |
| 5 | **Lint lands before the pattern it protects.** Otherwise the old pattern regrows behind you. |

---

## Stage map

| Stage | Phases | Repo | Behavior change | Reversible | Status |
|---|---|---|---|---|---|
| **A. Decouple** | 1-4 | current | **none** | trivially | **done** |
| **B. Extract** | 5-9 | new | **none** | DNS | 5-8 done, **9 next** |
| **C. Foundation** | 10-13 | new | visual | per phase | gated on 9 |
| **D. Redesign** | 14-20 | new | UX | per phase | gated on 9 |
| **E. Unblocked** | 21-23 | new | new features | per phase | gated on 9 |

---

# Stage A - Decouple (current repo)

## Phase 1 · Fix the live cache-revalidation bug - **DONE** (`bbdd159`)

**Objective** `PATCH /settings/site` busts the public `site-info` tag.

**Files** `lib/api/cache-revalidation.ts` (merge the duplicate `case 'settings'` at `:142` and `:150`)

**Rationale** B-1 is a **live production bug**, verified. Every `/settings/*` write pushes only `user-profile`; the `site-info` branch at `:150` is unreachable because the first matching case wins. `getPublicSiteInfo` is `cacheLife('days')`, so a logo or WhatsApp change is invisible on the live site for days. A real production bug must not wait on an architecture project.

**Dependencies** none. **Ship today.**

**Risks** Effectively none. The change makes an unreachable branch reachable.

**Validation** Unit: `PATCH /settings/site` -> tags include `site-info`; `PATCH /settings/seo` -> does not. Manual: change the logo, confirm the public footer updates.

**Rollback** Revert. Restores the bug.

> **EXECUTED 2026-07-17.** The two `case 'settings'` arms merged into one. Shipped exactly as
> specced; no corrections.
>
> **The file this phase fixes was on Phase 4's original delete list** - an early scan called
> `lib/api/cache-revalidation.ts` dead when `lib/api/fetch.ts:7` imports it. Deleting it would
> have taken the whole public-cache bridge with it. That scan was wrong a **second** time later
> (`locals-favourites-list-view.tsx`, Phase 4). Both are recorded here because they share one
> lesson: **verify every "dead" claim from that scan against a real importer.**
>
> Re-confirmed in Phase 7 that the fix is present in **both** repos - the dashboard's copy
> carried it across the split rather than reintroducing B-1 on the new side.

---

## Phase 2 · Sever the 7 cross-tree imports - **DONE** (`5ee032e`)

**Objective** Zero dashboard imports from `components/frontend/`.

**Files**
- New: `components/dashboard/common/tour-badge.tsx`
- Edit: `collections/collection-form.tsx:24`, `collection-tour-select.tsx:10`, `collection-tours-manager.tsx:17`, `hubs/hub-comparison-manager.tsx:17`, `hub-our-picks-manager.tsx:19`, `hub-tour-select.tsx:9`
- Split: `lib/tours/listing.ts` -> `lib/tours/derive-badge.ts` + `lib/tours/signals.ts` (dashboard); public keeps its mappers

**Rationale** A-2: these 7 imports are the entire hard blocker. The dashboard renders the storefront's own chip inside admin pickers - always wrong, and it breaks the moment the public site restyles. `lib/tours/listing.ts` already documents that it is two modules (`deriveTourBadge`: "Admin tour rows don't carry a server-derived badge"; `formatTourSignals`: "Shared by the Collection, Our Picks and Comparison tour selectors").

**Dependencies** none

**Risks** The new admin chip must render the same *information*, not the same *pixels*. Low: 6 call sites, all admin-internal.

**Validation** `grep -rn "@/components/frontend" components/dashboard app/\(dashboard\) lib/tours` -> zero. **Both apps build.** Visual check of the 6 pickers.

**Rollback** Revert. **Note:** after this ships, the public repo should drop `deriveTourBadge`/`formatTourSignals` from its copy - track it, or the two copies drift.

> **EXECUTED 2026-07-17.** tsc clean, eslint 0 errors, build green. New: `lib/tours/derive-badge.ts`
> (`TourBadge` + `deriveTourBadge`), `lib/tours/signals.ts`, `components/dashboard/common/tour-badge.tsx`.
> All 6 call sites repointed; `lib/tours/listing.ts` is now public-only. **Still owed: the visual
> check of the 6 pickers** (hub tour-select / comparison / our-picks; collection form / tour-select /
> tours-manager) - the one row in this phase an agent cannot green.
>
> **Three corrections:**
>
> **1. The Rollback note above is moot, not deferred.** It anticipated two *copies* drifting.
> Doing the split before extraction meant the functions were **moved**, never copied - the public
> site no longer has them. Nothing to track.
>
> **2. The validation grep is 1 hit off.** `grep "@/components/frontend" ... lib/tours` still
> returns `lib/tours/listing.ts:5` (`type TourListing` from `components/frontend/tour-card`) - a
> legitimate public->public import in a file that does **not** travel to the dashboard repo. The
> "7 imports" were 6x `TourBadgeChip` + the `TourBadge` type at old `listing.ts:6`; line 5 was
> never dashboard-caused. Scope the grep to `components/dashboard app/(dashboard)
> lib/tours/{derive-badge,signals}.ts`.
>
> **3. The type lives in `lib/`, not the component** (`tour-badge.tsx` imports `TourBadge` from
> `lib/tours/derive-badge`). The reverse would violate `05` D1: `lib/` never imports `components/`.
> The admin chip is **token-only, no hex** - it maps badge to MEANING through existing tokens
> (sponsored=`muted` per master §3.6 "gray, never brand orange", new=`info`,
> likelyToSellOut=`warning`, mostPopular=`success`) using the subtle `border-{v}/30 bg-{v}/10
> text-{v}` triplet already in `statistics.tsx:313` - which is the shape `03` §5.1 standardizes as
> `StatusBadge`, so **Phase 12 absorbs it without a redesign**. The public chip stays pinned to
> Figma hex; `--it-*` are scoped to `.frontend-root` and unusable in the dashboard.

---

## Phase 3 · Sort `components/` by owner - **DONE** (`44becee`)

**Objective** Dashboard-only files stop living in the shared root.

**Files** `app-sidebar`, `site-header`, `nav-main`, `mode-toggle` -> `components/dashboard/shell/`. Split `components/skelitons/` by owner (**fix the typo**) -> `components/dashboard/skeletons/` + `components/frontend/skeletons/`. `smooth-scroll` -> `components/frontend/`.

> **CORRECTION (applied during implementation).** This list originally also moved
> `nav-user`, `nav-documents` and `nav-secondary` to `shell/`. **All three are dead** - each
> defines its component and nothing imports it (`app-sidebar` imports only `NavMain`). Moving
> dead code then deleting it in Phase 4 is churn, and this plan already leaves dead root files
> (`data-table`, `section-cards`, `chart-area-interactive`) in place for Phase 4. So the three
> navs stay at root and move to **Phase 4's delete list**, consistent with the plan's own logic.
> Same finding for `collection-tour-card-skeleton.tsx` (dead), which was moved with the public
> skeletons only so the typo'd directory could be deleted outright; Phase 4 removes it.
> `smooth-scroll` was added: it is public-only, and leaving it at root fails this phase's own
> validation ("root contains only genuinely shared files").

**Rationale** A-6. Ownership is real but must currently be derived by grep. `site-header.tsx` sits at root and reaches down into `components/dashboard/*`.

**Dependencies** none. **Risks** import churn; mechanical.

**Validation** Both apps build. `components/` root contains only genuinely shared files.

**Rollback** Revert.

> **EXECUTED 2026-07-17.** 21 files' imports rewritten; tsc clean, build exit 0.
> `components/skelitons/` is **deleted outright** (the typo is gone), split into
> `components/dashboard/skeletons/` (4) + `components/frontend/skeletons/` (14).
>
> **This phase's own validation is only reachable after Phase 4.** "Root contains only genuinely
> shared files" stayed false here on purpose: the 3 dead navs plus 3 pre-existing dead files sit
> at root until Phase 4 deletes them. See the CORRECTION above. Phase 4 closed it - root is now
> empty of loose files.
>
> **Trap for anyone re-running this:** `git mv` from `frontend/` stages into `frontend/.git`,
> which is a **different repo on a different branch** than the root. 23 renames landed in the
> wrong index this way and needed a `git reset`. Renames survive it fine (git detects them by
> content similarity at commit time), but **run every git command from the repo ROOT.**

---

## Phase 4 · Delete dead code - **DONE** (`528655f`)

**Objective** Remove >1,574 confirmed-dead LOC.

**Files** `components/data-table.tsx` (813), `section-cards.tsx`, `chart-area-interactive.tsx`, `trips/trip-content-tab.tsx` (255), `trips/trip-languages-tab.tsx` (205), `common/image-upload-selector.tsx` (235), `locals-favourites-list-view.tsx` (66, **verify first**), `app/__backup(auth)/`, `components/__backup_auth/`, `dashboard/{leads,enquiries}/page.tsx`, `frontend/lint_errors.log`. Fix `tsconfig.json:include` (references a nonexistent file).

> **ADDED by Phase 3 (verified dead during implementation, 2026-07-17):**
> `components/nav-user.tsx`, `components/nav-documents.tsx`, `components/nav-secondary.tsx` -
> each exports a component that **nothing imports** (`app-sidebar` imports only `NavMain`); and
> `components/frontend/skeletons/collection-tour-card-skeleton.tsx` - `CollectionTourCardSkeleton`
> has no consumer. After these four go, **`components/` root is empty of loose files** - which is
> Phase 3's stated validation, reachable only once Phase 4 lands.

> **EXECUTED 2026-07-17. Two corrections:**
>
> **1. `locals-favourites-list-view.tsx` is NOT dead - it was kept.** The "verify first" flag
> earned its place. The chain is live end to end:
> `app/(dashboard)/dashboard/locals-favourites/page.tsx` -> `LocalsFavouritesView`
> (`locals-favourites-view.tsx:8,101`) -> `LocalsFavouritesListView`. That is the curation surface
> CLAUDE.md rule 23 mandates for `is_locals_favourite`. **Deleting it would have removed a live
> admin page.** This is the second time a file in this plan was wrongly called dead (after
> `lib/api/cache-revalidation.ts`); both came from the same early scan. Treat any remaining
> "dead" claim sourced from it as unverified.
>
> **2. Leads/Enquiries needed more than the two `page.tsx` files.** Both were also **commented-out
> `navigations.ts` entries** (`:179-193`) carrying `Mail`/`MessageSquare` icon imports. Deleting
> only the pages would have left nav blocks that 404 the moment anyone uncommented them. Removed:
> both pages, both nav blocks, both now-orphaned icon imports. **`VIEW_ENQUIRIES`/`VIEW_LEADS`
> stay in `lib/config/rbac.ts`** - it mirrors `backend/src/config/roles.config.ts`, and the
> backend is out of scope (constraint: no backend changes). Flag them in Appendix A if the
> backend ever drops them.
>
> **Actual: 2,725 LOC deleted** (vs the >1,574 estimated), across 20 files. `components/` root is
> now empty of loose files. Typecheck clean, build green, `leads`/`enquiries` absent from the
> route table.
>
> **Deleting `data-table.tsx` orphaned four `ui/` primitives** - now at 0 importers:
> `drawer` (its only consumer was `data-table`), `toggle-group`, `breadcrumb`, `progress`.
> **Not deleted here** - `03` §inventory already rules on all four (`drawer`/`toggle-group` DROP,
> `progress` **KEEP** for the translation console, `breadcrumb` RESOLVE against the live
> `dashboard/breadcrumb.tsx`). They belong to the design-system phase, not this one.

**Rationale** F-2. `data-table.tsx` is the emblem: a generic table abstraction that all 10 tables ignored, keeping 813 lines and `ui/drawer.tsx` alive.

**Dependencies** none

**Risks** **`lib/api/cache-revalidation.ts` is NOT dead** - `lib/api/fetch.ts:7` imports it. An earlier scan said otherwise and was wrong. Do not delete it. Verify `locals-favourites-list-view.tsx` before removing.

**Validation** Both apps build. Bundle shrinks. `grep` each deleted symbol -> zero.

**Rollback** Revert.

---

# Stage B - Extract (new repo)

## Phase 5 · Scaffold and copy - **DONE** (`2977a77`)

**Objective** The new repo builds. **Zero redesign.**

**Files** Everything in `02` §3.4 (copies) and §3.5 (rewrites: `layout.tsx`, `globals.css`, `proxy.ts`, `next.config.ts`, `dashbaord-wraper.tsx`).

> **EXECUTED 2026-07-17** -> `github.com/devripon-tr/tripwheel-x-islandtours-dashboard` (`2977a77`).
> Build green, tsc clean, lint 0 errors, 526 files, deps 39 -> 29. Monorepo untouched.
>
> **DO NOT TRUST §3.4's copy list.** It was wrong three times. The copy was driven by walking
> the transitive import graph from the dashboard entry points instead - do that again if this
> is ever re-run. (Walker caveat: strip comments first. A commented-out `import` in
> `operator-login.tsx:7` pulled the dormant 2FA chain into the closure.)
>
> **1. "F-3 is resolved by the split itself, for free" (§3.5) is WRONG - this was the big one.**
> The portal/staff login surfaces are built on the PUBLIC site's `--it-*` tokens: **81 usages
> across 20 tokens** (`bg-it-primary`, `text-it-heading`, `font-it-display`, `shadow-it-md`...),
> and `app/(login)/layout.tsx` wraps them in `.frontend-root`. Dropping the
> `@import './(frontend)/frontend-tokens.css'` line renders `/portal` and `/staff` **unstyled**.
> Same class of error as the Phase 2 `TourBadgeChip`, 10x larger.
> **Enabling fact:** ZERO files in `components/dashboard`, `components/ui`, `components/onboarding`
> or `app/(dashboard)` use `--it-*` - the dependency is *exclusively* the login screens.
> **Resolution (user, 2026-07-17): fork the tokens, and the login screens KEEP THE BRAND LOOK
> PERMANENTLY.** So `app/login-tokens.css` (130 lines, reduced from 524, only what login
> references, scoped by `.frontend-root`) is **intentional architecture, not debt - Phase 11
> must leave the login surfaces alone.** F-3 survives but is scoped to `/portal` + `/staff`.
> Verified in the BUILT CSS, not just the build: 14/14 utilities generate (a green build proves
> nothing here - Tailwind silently skips unknown utilities).
>
> **2. `hooks/tours/use-availability-sync.ts` is NOT a "dashboard consumer"** (§3.4 says it is).
> Its only importer is the PUBLIC `tour-booking-card`. Left behind, along with
> `lib/api/availability.ts` and `lib/tours/pricing-label.ts` (all public-only).
> Conversely §3.4's "leave behind" list is wrong about `hooks/use-drag-scroll.ts` - `ui/tabs.tsx`
> imports it, so it forks with `ui/`.
>
> **3. `ui/input-otp` is not "public site only"** (`03` §inventory says DROP). It backs the
> operator **2FA** flow (`login/code-input` -> `ui/input-otp`), parked behind a commented import
> in `operator-login.tsx:7` ("uncomment when enabled"). A built feature awaiting a switch, not
> dead code. **Kept**, with the `input-otp` dep.
>
> **Also:** `ui/drawer.tsx` deleted (0 importers; sole reason `vaul` existed) and **`@dnd-kit`'s 4
> packages dropped** - their only consumer was the dead `data-table.tsx` removed in Phase 4.
> **They are now orphaned in the monorepo too - drop them there** (`05`'s DataTable system may
> re-add dnd-kit in Stage D; add it back when a consumer exists). `shadcn` must stay a runtime
> dep: `globals.css:3` imports `shadcn/tailwind.css`.
>
> **One intentional visual delta, dark mode only:** the shell gutter was a hardcoded `#f1f4fa`
> with **no** dark variant, so dark mode framed the pane in light lavender (D-4). Now
> `--shell-gutter`/`--shell-content` tokens. **Light mode is pixel-identical.** Carry this to
> Phase 9 as a known delta alongside the collections-RBAC one.

**Rationale** `02` §2. Repo root = the app. Isolation test: clone, `pnpm dev`.

**Dependencies** Phases 1-4

**Risks**
- **The `globals.css` rewrite is a token *port*, not the new system.** Phase 11 owns the redesign. Mixing them here makes every later visual diff unreviewable.
- `proxy.ts` must drop all public i18n and keep `guardDashboard` **exactly** - including the no-network property (05 R11).

**Validation** `pnpm build` succeeds. `grep "@/components/frontend\|@/lib/api/public"` -> zero.

**Rollback** Delete the repo. The current monorepo is untouched.

---

## Phase 6 · Base path `/dashboard/*` -> `/*` - **DONE** (`313d291`)

**Objective** Dashboard serves at root.

**Files** Route moves; `navigations/navigations.ts`; every `router.push`/`redirect`/`<Link>`; `proxy.ts` (add a `/dashboard/*` -> `/*` 308); `e2e/`.

> **EXECUTED 2026-07-17.** `app/(dashboard)/dashboard/**` -> `app/(app)/**`; 61 files rewritten;
> build green; all 18 nav urls resolve to a real route. **Behaviour verified against the running
> build, not by grep** - see the table below.
>
> **`navigations.ts` needed NO change.** Its urls are already relative and root-less (`'trips'`,
> `''` for Overview); `nav-main.tsx` builds the href. The whole nav change was one constant.
>
> **The `DASH_ROOT` trap.** `nav-main.tsx:30` had `const DASH_ROOT = '/dashboard'`, and hrefs were
> `` `${DASH_ROOT}/${url}` ``. A blanket `'/dashboard'` -> `'/'` rewrite turns that into
> `` `//trips` `` - **a protocol-relative URL, which the browser resolves to host "trips"**. Every
> sidebar link would have broken, and the build stays green. Replaced with a `toHref()` helper
> (which also fixes the latent `/undefined` href for url-less parent items).
>
> **`e2e/` was never copied in Phase 5** (a gap - `02` §3.4 lists it). Copied here. **§3.4's
> "audit for public-site specs and leave those behind" has nothing to act on: all 11 specs are
> dashboard tests** - every single `page.goto` targets `/dashboard/*`. (A grep for `locale`/
> `curacao` looks like public coverage but is false-positive: they are the translation workflow
> and a destination dropdown option.) The stored auth state `e2e/.auth/user.json` is deliberately
> NOT carried - it is a credential.
>
> **`proxy.ts` sits at the repo root**, outside the rewritten dirs, so it escaped the blanket
> rewrite - which is what saved it: `pathname.startsWith('/dashboard/')` -> `startsWith('/')`
> would have guarded `/portal` and produced an **infinite redirect loop**. Rewritten deliberately:
> the guard now inverts (guard everything EXCEPT `UNGUARDED_PREFIXES` = `/portal`, `/staff`,
> `/onboarding`, `/api`), and the legacy 308 runs FIRST so an unauthenticated hit on a legacy URL
> keeps its destination instead of being bounced to `/portal` and losing it.
>
> **Verified on `next start`:**
>
> | Request | Result |
> |---|---|
> | `/dashboard`, `/dashboard/trips`, `/dashboard/trips/abc/edit` | **308** -> `/`, `/trips`, `/trips/abc/edit` |
> | `/dashboard/settings?tab=seo` | **308** -> `/settings?tab=seo` (query preserved) |
> | `/`, `/trips`, `/settings` (no session) | **307** -> `/portal` |
> | `/portal`, `/portal/forgot`, `/staff`, `/onboarding` | **200** (no loop) |
> | `/login`, `/forgot-password` | **307** -> `/portal`, `/portal/forgot` |
>
> **Go/no-go on trips->tours: DEFERRED**, per the recommendation below.

**Rationale** `02` §8. `dashboard.tripwheel.io/dashboard/tours` is redundant. Cheap now, expensive later.

**Dependencies** Phase 5

**Risks** Missed links 404. Grep is exhaustive.

**Validation** `grep -rn "/dashboard" app components lib navigations` -> only the legacy redirect. Every nav item resolves. Legacy path 308s.

**Rollback** Revert.

**Go/no-go:** `02` §9 - **rename trips -> tours here, or defer?** Doing it now is one churn instead of two; doing it now also makes an already-large mechanical diff harder to review and worse to bisect. **Recommendation: defer.** Keep the extraction reviewable; pay the churn twice.

---

## Phase 7 · Cross-domain cache revalidation - **DONE** (`631ac56` + `6c65d0d`)

**Objective** Dashboard writes bust `island.tours`.

**Files**
- Dashboard: `app/_actions/revalidate.ts` (rewrite transport), `lib/api/cache-revalidation.ts` (mapping **verbatim**, B-1 fix already carried from Phase 1), **new coalescing throttle** (02B §6A.3)
- **Public repo:** new `app/api/revalidate/route.ts`
- Env both sides: `REVALIDATE_TARGET_URL`, `REVALIDATE_SECRET`

**Rationale** `02B`. **The only silent failure in the migration.** `updateTag` cannot reach another app's cache: no error, no build break, just stale pages.

**Dependencies** Phase 5. **Deploy both sides together.**

**Risks**
- **`updateTag` throws in a Route Handler.** It is Server-Action-only. The public endpoint **must** use `revalidateTag`. A naive port fails at runtime, and because the caller is fire-and-forget it fails *silently*.
- **Use no profile argument.** `revalidateTag(tag)` = today's `updateTag` semantics. `revalidateTag(tag, 'max')` is SWR - a real behavior change, deliberately deferred (02B §4.2).
- **The tag contract now spans two repos.** The 400-on-unknown guard is what converts silent staleness into a loud first-write error. It is not optional.
- Failures must be **logged, never swallowed** (02B §6).
- **Volume.** The dashboard's per-row save model means one operator task fires many writes with identical tags: a 7x3 schedule save = **21 POSTs**, a 6-locale translation = **~120**. Ship the leading+trailing throttle (02B §6A.3) **with** the transport, not after. The leading edge keeps a single save instant, so it is not a regression.
- **Do not narrow the tag mapping to reduce volume** (02B §6A.5). Over-invalidation costs a regeneration; under-invalidation serves wrong prices. Child-collection writes genuinely can change the public listing (`use-trips.ts:362-363`: `priceFrom`/`isBookable` recompute server-side).

**Validation** `02B` §10 in full. The three that matter: **a revalidation failure must never fail the operator's write** (26), **must never be silent** (25), and **a single save must still revalidate immediately** (30).

**Rollback** Revert both. Public site falls back to TTL.

> **EXECUTED 2026-07-17.** All of `02B` §10 passes: §10.1 mapping 1-9 (+11 extra edge cases),
> §10.2 endpoint 10-18 (+9 extra), §10.3 transport/throttle 25-33. Both apps build green.
>
> **CORRECTION 1 - "Use no profile argument" is wrong on Next 16.2.4, and does not compile.**
> The line above, and `02B` §4.2 / decision #4, both say `revalidateTag(tag)` bare. In the installed
> 16.2.4 the `profile` parameter is **required** in the type signature
> (`revalidateTag(tag: string, profile: string | CacheLifeConfig)`), so the bare call is a type
> error; at runtime it also emits a deprecation `console.warn` **per tag, per write**, into the very
> log drain R6 makes the alerting channel.
> **Shipped `revalidateTag(tag, { expire: 0 })`** (user-confirmed). Reading
> `next/dist/server/web/spec-extension/revalidate.js:208`, `if (!profile || cacheLife?.expire === 0)`
> puts `{ expire: 0 }` in the *same* branch as no-profile - and `updateTag` itself calls
> `revalidate([tag], ..., undefined)` into that branch too. So all three are identical in effect:
> the parity decision #4 wanted, minus the deprecated path. Verified: 0 deprecation warnings emitted.
> **`'max'` remains deferred** per §4.2/§6A.4 - it is still a real behavior change.
>
> **CORRECTION 2 - `export const runtime = 'nodejs'` breaks the build under `cacheComponents`.**
> The endpoint needs Node for `crypto.timingSafeEqual`, so pinning the runtime is the obvious move.
> It is rejected outright: *"Route segment config \"runtime\" is not compatible with
> nextConfig.cacheComponents. Please remove it."* **`tsc --noEmit` passes it** - this only surfaces
> on `next build`/`next dev`, i.e. it would have failed the Vercel deploy. Node is the default
> anyway, so the fix is to omit the export and keep the constraint as a comment.
>
> **CORRECTION 3 - `user-profile` is a phantom tag, in BOTH repos.** §5.1 lists it in the coarse
> union, and `cache-revalidation.ts` maps `/users/me` + all `/settings/*` writes to it - but
> **nothing anywhere calls `cacheTag('user-profile')`**. `getUserProfile` is React `cache()`
> (request memoization), deliberately moved off `'use cache'` because caching a transient auth
> failure bounces a logged-in user to /login. So `updateTag('user-profile')` has been a no-op since
> long before the split. **Kept in the union** (user-confirmed): parity, zero risk, and the cost is
> only a few no-op POSTs. Recorded as debt - remove from both repos together or not at all.
>
> **CORRECTION 4 - §6A.3's "21 POSTs -> 2" is 21 -> 3 in practice.** Measured. The claim assumes the
> burst fits inside one 1s window; a real 21-write schedule save spans ~1.05s, so it takes a leading
> edge plus two trailing flushes. Still an 86% reduction, and the shape of the fix is right. A 40-write
> burst over 1s also lands at 3. **Check 30 holds exactly**: a single isolated save fires at 0ms.
>
> **CORRECTION 5 - R5's "timeout at ~3s" bounds each attempt, not the operation.** Worst case for a
> hung public site is **~11s** (3 attempts x 3s + `[300, 800]` backoff + jitter), not 3s. Accepted, not
> changed: it is fire-and-forget so R1 still holds (measured - the write never blocks and never
> throws), the dashboard is self-hosted (`output: 'standalone'`) so there is no serverless
> `maxDuration` to trip, and shortening it would fight R3's required retries. Worth revisiting only
> if it shows up in practice.
>
> **Verified beyond the spec's checklist:**
> - **The cross-repo tag contract, mechanically.** Enumerated every tag the mapping can emit across
>   208 write shapes (17 distinct) and POSTed each to the live endpoint: all 200. Producer ⊆ consumer.
>   This is the check that would have caught B3 drift, and it is worth re-running whenever either
>   side's tag names move.
> - **Check 18 at the compiled-output level**, not by grepping source: the emitted chunk contains
>   `(0,_.revalidateTag)(e,{expire:0})` and **zero** `updateTag` call sites (its 9 textual
>   occurrences are all `next/cache`'s own export table / error string / implementation).
> - The public proxy already passes `/api` through unlocalized, so the i18n scheme cannot redirect
>   the endpoint.
> - Rotation works: a comma-separated `REVALIDATE_SECRET` accepts both old and new values.
>
> **ADDENDUM - the tag vocabulary now lives in `lib/cache-tags.ts` (§5.4), byte-identical at the
> same path in both repos.** As first built, Phase 7 left the contract defined *twice per repo in
> different shapes*: a hand-written type union in the dashboard's `'use server'` file, a runtime
> `Set` in the public route handler - so nothing stopped the two halves disagreeing even inside one
> repo. Now: one file, types **derived** from the arrays (`(typeof COARSE_CACHE_TAGS)[number]`), and
> `isKnownCacheTag` shared. The public route dropped 238 -> 168 lines; `app/_actions/revalidate.ts`
> exports only its action, which is what a `'use server'` file should do. **No shared npm package** -
> that would re-couple the two services the split exists to separate (same reasoning as §2 option 5).
> Verified after the refactor: all 46 harness checks + 30 exhaustive `isKnownCacheTag` cases still
> pass, both build green, and the compiled chunk still emits `(0,R.revalidateTag)(e,{expire:0})` with
> zero `updateTag` call sites.
>
> **Not done here, by design:** neither repo has a unit-test runner (Playwright only), so the
> §10.1/§10.2 checks were run as harnesses against the real files rather than committed tests. Adding
> a runner is a separate decision, not Phase 7 scope. **So the tag contract is guarded at runtime by
> the 400 only.** A CI check was investigated and is **not cheaply possible**: the monorepo has
> `.github/workflows/ci.yml` but **the dashboard repo has no CI at all**, and a cross-repo diff needs
> both repos checked out (a token-clone is fragile and re-introduces the coupling; a committed hash
> of the sibling's file goes stale on the next ship). What the shared file buys is that drift is now
> **one command** - `diff <dashboard>/lib/cache-tags.ts <public>/lib/cache-tags.ts` - rather than a
> reading exercise across two shapes. **Detection is the 400; prevention is manual.** The re-run
> procedure is in `02B` §5.4.

---

## Phase 8 · Env, ~~Docker~~ Vercel, staging - **DONE, code side** (`cfdd38b` + `4c1d7f4`)

**Objective** Deployed to a staging subdomain.

**Files** ~~`Dockerfile`, `.dockerignore`~~ (Vercel - see EXECUTED below), `.env.local.example`, `.env.production.example`, `next.config.ts` (~~`output: 'standalone'`~~ - removed), `package.json` + `playwright.config.ts` (port 3001)

**Rationale** `02` §7. **Backend config changes:** `COOKIE_DOMAIN=.islandtours.esenc.cloud` (interim topology - `.tripwheel.io` is the *target*, and was wrong here), `CORS_ORIGINS` += `https://dashboard.islandtours.esenc.cloud` and `http://localhost:3001`.

**Dependencies** Phases 5-7

**Risks** **`COOKIE_DOMAIN` mismatch = login loop.** Backend and dashboard must agree. `INTERNAL_API_SECRET` mismatch = SSR throttled.

**Validation** Loads, authenticates, lists tours on staging.

**Rollback** Staging only.

> **EXECUTED 2026-07-17 - with one approved deviation and five corrections.**
>
> **DEVIATION (your call, asked before any code was written): Vercel, not Docker.**
> The phase as written had the dashboard containerised while its sibling public app
> deploys to Vercel - `docker-compose.yml` says so outright ("the frontend is NOT
> here"). You chose Vercel for both. Consequences:
> - **No `Dockerfile`, no `.dockerignore`.** They were never created.
> - **`output: 'standalone'` REMOVED** from `next.config.ts`. Phase 5 added it *for*
>   the Docker image. It is a self-hosting feature (emits `.next/standalone` + a
>   minimal `server.js` to run instead of `next start`); Vercel builds through its
>   own pipeline and ignores it. Verified against the Next docs, and the build no
>   longer emits `.next/standalone`. The config now carries a comment saying why it
>   is absent, so it is not "helpfully" restored later.
> - The `NEXT_PUBLIC_*`-as-build-ARG hazard that made Docker risky here is moot -
>   Vercel handles build-time inlining. It is still true that changing a
>   `NEXT_PUBLIC_*` in Vercel needs a **redeploy**, not a restart.
>
> **1. `COOKIE_DOMAIN` is `.islandtours.esenc.cloud`, NOT `.tripwheel.io`.** This
> line was stale: `02` §7 already had it right and calls it "unchanged, already the
> default". `.tripwheel.io` is the *target* topology, not the interim one in force.
> Same error in `02` §11 check 9 - **corrected there too.** Shipping the value as
> written would have caused the exact login loop this phase lists as its own risk.
>
> **2. `CORS_ORIGINS` is `https://dashboard.islandtours.esenc.cloud`** for the same
> reason. Documented in both backend env examples, with *why* it matters: it feeds
> Better Auth `trustedOrigins` as well as CORS, so a miss rejects sign-in, not just
> fetches.
>
> **3. PORT COLLISION - a real defect the split introduced, fixed here.** The repo
> contradicted itself: `playwright.config.ts` ran `pnpm dev` and tested
> `localhost:3000`, while `.env.local.example` pointed `REVALIDATE_TARGET_URL` at
> `localhost:3000` as the **public site**. Both cannot own 3000. Worse,
> `reuseExistingServer: true` meant Playwright would silently attach to a running
> public site and run the dashboard suite against the wrong app. **The dashboard is
> now pinned to 3001** (`pnpm dev`/`start`, Playwright, README, env example), and
> the backend's dev `CORS_ORIGINS` lists `http://localhost:3001` - without which
> every dashboard API call is CORS-blocked locally, since they run in the browser
> with credentials.
>
> **4. `NEXT_PUBLIC_SITE_URL` (in `02` §7's table) is a ghost - no code reads it.**
> The dashboard reads exactly seven vars: `NEXT_PUBLIC_BACKEND_URL`,
> `INTERNAL_API_SECRET`, `COOKIE_DOMAIN`, `REVALIDATE_TARGET_URL`,
> `REVALIDATE_SECRET`, `NEXT_PUBLIC_OPEN_WEATHER_API_KEY`,
> `NEXT_PUBLIC_STAGING_APP_URL` (+ `NODE_ENV`). All seven are in both env examples;
> `COOKIE_DOMAIN` was missing from `.env.local.example` and was added there as an
> explicit "deliberately unset in dev" (`proxy.ts` only reads it when
> `NODE_ENV === 'production'`). Env files and code now match one-for-one.
>
> **5. `serverActions.bodySizeLimit: '100mb'` is vestigial, and its comment was
> false.** The comment claimed "media uploads post large payloads through Server
> Actions... load-bearing rather than a leftover." They do not: `mediaApi.upload`
> goes browser → backend directly via `apiFetch` and never traverses Next. **No
> Server Action in the app takes a file** - the five that exist all carry small
> JSON. On Vercel the setting is also unenforceable: the platform caps function
> request bodies at **4.5 MB** and returns 413 `FUNCTION_PAYLOAD_TOO_LARGE` before
> Next is reached. **The setting was left in place** (deleting app config is not a
> deploy phase's job) but the comment now states the truth. **Candidate deletion in
> a later phase.**
>
> **VALIDATION IS ONLY PARTLY MET.** `pnpm build` is green, routes serve at the
> root, and no `.next/standalone` is emitted. The rest of the stated validation -
> "loads, authenticates, lists tours **on staging**" - needs the Vercel project and
> DNS, which are yours to create. **Phase 9 parity stays blocked until that is
> done**, and so does Stage D.

---

## Phase 9 · Parity verification and cutover - **NEXT**

**Objective** Prove zero regression, then cut DNS.

**Files** none (verification)

**Rationale** `02` §11 - 55 checks against production data.

**Dependencies** Phases 5-8

> **NOT BLOCKED ON THE STAGING DEPLOY. Run it locally first** (analysed 2026-07-17).
> **Only 2 of the 55 checks actually need the deployed origin:** **#2** (malformed cookie cleared)
> and **#9** (cookie scoped `.islandtours.esenc.cloud`). Both are invisible on localhost *by
> design* - `crossSubDomainCookies` is gated on `NODE_ENV === 'production'` and `proxy.ts` reads
> `COOKIE_DOMAIN` only in production. Everything else is HTTP to `localhost:5050` and indifferent
> to hosting. Even the cross-service rows (**#51-55**) run locally: dashboard :3001 -> public :3000
> `/api/revalidate`, the exact path Phase 7 exercised. **#6/#7** ("diff against production") can
> compare against the OLD dashboard, still live at `/dashboard` until cutover.
> **#1 and #11 already pass** - verified during Phase 8. A regression found on staging costs a
> redeploy each; found locally it costs nothing.
>
> **A `*.vercel.app` URL cannot authenticate, so the custom subdomain is not optional garnish.**
> The backend issues the session cookie scoped `.islandtours.esenc.cloud`; a browser accepts a
> cookie only for its own host or a parent, so a different registrable domain rejects it outright
> and every login bounces to `/portal`. **There is no "deploy now, attach the domain later" path
> that yields a testable app.**
>
> **Honest limit on an agent-run pass:** many rows are visual or interactive (avatar crop, mp4
> upload progress, drag-reorder, dark-mode persistence). API-level behavior is verifiable; "does
> it look right" is not. Those rows are the user's to sign off, and must not be reported green
> without them.
>
> **Local prerequisites:** backend on :5050 with the demo seed (`pnpm prisma:seed:demo`),
> `http://localhost:3001` present in its `CORS_ORIGINS`, and the public site on :3000 for #51-55.

**Risks** ~~**One known intentional delta:** collections gains RBAC gating (B-7).~~ **THERE IS NO SUCH DELTA - B-7 IS A FALSE FINDING** (proven below). Old and new gate collections identically.

**Validation** Every row green. No waiver without a written note.

**Rollback** DNS. Old `/dashboard/*` stays live until the new origin is proven.

> **EXECUTED 2026-07-17 (in progress).** Run locally, per the note above: backend :5050 with the
> demo seed, public site :3000, dashboard :3001. **No regression found.** Findings below.
>
> ### The strongest evidence: the code cannot regress where it is identical
>
> Every one of the **171 dashboard component files** was compared old vs new:
> **95 byte-identical · 76 differing only in import paths or the `/dashboard/x` -> `/x` prefix**
> (= Phase 6's intended change) · **0 with a behavioral diff**. The route sets are identical, 19
> for 19. So checks 12-50 have no regression *surface* at the code level. That is not a substitute
> for the interactive rows, but it bounds where a regression could hide: only in the 5 rewrites,
> the 2 known deltas, and the shell.
>
> **Two methodology errors of mine, recorded because they nearly became reported results:**
> a `diff -rq` with stderr suppressed read a **missing directory** as "identical" (the new repo
> flattens `components/dashboard/*` -> `components/*`); and a zsh `ls *.tsx *.ts` **aborted on any
> directory with no `.ts` file**, silently skipping it. Both inflated parity. The numbers above are
> from a `find`-based redo. **Never let a comparison's failure mode look like success.**
>
> ### Verified directly
>
> | Check | Result |
> |---|---|
> | #1 unauthenticated `/` -> `/portal` | **PASS** (307) |
> | #11 legacy 308s | **PASS on the mechanism** - 6 paths, query preserved (see the correction below) |
> | #48 `PATCH /settings/site` busts `site-info` | **PASS** - single `case 'settings'`, present in **both** repos |
> | #51-55 transport | **PASS** - endpoint returns 200 on a matching secret, **401** on a wrong one, and **never echoes it** |
>
> ### FOUR SPEC ERRORS (this is Phase 9 earning its place)
>
> **1. `01` B-7 IS FACTUALLY FALSE, and `02` §5.4, `04` §5, this phase's Risks line, and check #20
> all inherit the error.** B-7 says collections has "no `useRole` import anywhere". At the very
> commit the specs were authored from (`6e830d0`), collections imported `useRole` in **two** files
> (`collections-list-view.tsx:28`, `collection-edit-view.tsx:11`) and gated
> `CREATE_/EDIT_/DELETE_COLLECTION`. The gating landed **2026-06-08** - five weeks *before* the
> audit. What is true is thinner and duller: collections gates in 2 files where hubs gates in 4.
> **Consequence: the "one known intentional delta" does not exist**, nothing was "newly gated",
> and check #20 needs no caveat.
>
> **2. Check #11 is mis-worded.** "Legacy `/dashboard/tours` 308s to `/tours`" - but **`/tours` has
> never existed in either repo**; the module is `trips` and the rename is deferred. The 308 fires
> and lands on a 404. The *mechanism* is fine (`/dashboard/trips` -> `/trips` renders; 6 paths
> verified with query preserved). The check presumes a rename that has not happened. **Phase 8's
> "#11 PASS" was too generous** - it was verified against `/dashboard/trips`, not the literal path.
>
> **3. AN UNDOCUMENTED VISUAL DELTA: the sidebar fonts.** Phase 5 dropped **DM Sans and General
> Sans**. All 4 usages were in the shell - `nav-main.tsx` x3 (nav item labels) and
> `app-sidebar.tsx` x1 (brand/operator name) - and now render in the default **Noto Sans**. It is
> deliberate and explained at `app/layout.tsx:18`, but the specs list only the shell gutter (D-4)
> and the phantom collections delta as "known". **This one is the user's to eyeball.** No dead
> classes were left behind.
>
> **4. `app/layout.tsx:18` points at a note in `app/globals.css` that does not exist.** Dangling
> cross-reference from Phase 5.
>
> ### The e2e suite is NOT a parity gate - it is 45% red on BOTH sides
>
> `02` §11's 55 checks are a manual checklist; the Playwright suite is supplementary evidence
> (reached for because the Chrome extension was unavailable). Run against **both** dashboards:
>
> | | Old (monorepo, `/dashboard/*`) | New repo |
> |---|---|---|
> | Passed | 125 | 120 |
> | **Failed** | **102** | **107** |
>
> **`attributes.spec.ts` fails 11 / passes 20 on BOTH, with the same test names.** On the old side
> **60 of 102 failures are the trips specs**, including **48 in the "Edit Trip" block** - the same
> block, with the same ~17s timeout signature, that fails in the new repo. **These tests were
> already red before the extraction existed.**
>
> Three failure modes, none of them the app:
> - **Page-wide locators.** `getByRole('button').filter({has: svg}).last()` grabs whatever icon
>   button happens to be last in the DOM; `getByText(/snake_case/i)` matches the field's help text
>   AND the error -> strict-mode violation. The screenshot proves the app rendered the error
>   correctly (`<div role="alert" data-slot="field-error">`) and the test failed anyway.
> - **5s prefill races** ("Display Name is pre-filled from API").
> - **30s hard timeouts** (the categories icon-picker popover).
>
> **The counts above are contaminated** - those two runs overlapped, and every non-intercepted spec
> hit the same backend and the same demo rows from both sides at once. So the new suite was re-run
> **clean and uncontended** (106 failed / 121 passed, 29.3m) and diffed **name-by-name** against
> the old 102. Test names embed their routes, so `/dashboard/x` was normalised to `/x` first -
> without that, every test reads as different.
>
> ### THE VERDICT: 102 of 106 failures are identical, name for name
>
> | | Count |
> |---|---|
> | Failures **identical on both sides** | **102** |
> | Failing **only in old** | **0** |
> | Failing **only in new** | **4** |
>
> The four that differed were each re-run **in isolation against BOTH dashboards**:
>
> | Test | New | Old |
> |---|---|---|
> | `categories` > shows validation error when form is submitted empty | fail | **fail** |
> | `destinations` > navigates to create page when Add Destination is clicked | fail | **fail** |
> | `destinations` > shows validation error when form is submitted empty | fail | **fail** |
> | `trips` > ARCHIVED trip row-actions does not show Edit Details navigation | fail | **fail** |
>
> ### **ZERO REGRESSIONS. All 227 tests behave identically on both sides.**
>
> **The four were an artifact of DATABASE RESIDUE, not of the extraction.** Note the inversion:
> in the *full old-suite run* they **passed**; run standalone they **fail on old too**. Their
> outcome depends on what earlier tests left in the database, so two full runs that start from
> different residue disagree - and ours did, because a killed run and the user's run had already
> mutated rows before the old suite started. Point them at either app and the behaviour is the same.
>
> **This is why the diff had to be name-level and the outliers re-run individually.** A count
> (102 vs 106) would have read as "4 regressions"; a full-suite re-run would have reshuffled the
> residue and produced a *different* four. Only isolation holds the variable still.
>
> **It also indicts the suite, not the app:** a test whose result depends on its predecessors
> cannot answer "did this change break anything", which is the only question a suite exists to
> answer. Isolation is a prerequisite for the trim (and for `workers > 1`, which is unsafe until
> then - these specs share rows).

---

## Phase 9B · E2E suite trim - **PARTIAL** (`2ac049c`, dashboard branch `ui-fix`)

**Objective** A suite that can answer "did this change break anything". It cannot today.

**Rationale** Phase 9 found the suite **~45% red on BOTH dashboards** - it is measuring its own
decay, not the extraction. Stage C starts changing markup; a suite this red cannot tell you whether
the redesign broke something, and **the dashboard repo has no CI at all**. This is its only net.

**User decision (2026-07-17):** keep behaviour/contract tests, cut presence-only. **Not by
red/green** - those are anti-correlated here. The green tests are mostly the worthless ones
("Key input is rendered"); the red ones are mostly the contracts ("confirming deactivation calls
DELETE"). Cutting by colour would have deleted everything worth having.

**The keep/delete rule:** *would this test still pass if the feature were broken?*

### DONE

**1. Deleted 55 presence-only tests. 227 -> 172.** tsc clean; 172 collect.
**23 were rescued** despite presence-shaped names, because they fail when something real breaks:
data binding (`renders rows from the API`), conditional rules (`Allowed Values appears when Data
Type is ENUM`), defaults (`Collection Type defaults to MANUAL`), dependency rules (`Hubs
multi-select disabled until destination chosen`), and the category-slug collision warning.
A regex classified; **a human eye rescued.** Do not re-run the regex and trust it.

**2. THE MOCKS ADDRESSED AN API THAT DOES NOT EXIST.** Tests route `**/api/v1/trips/*`; the app
calls `/api/v1/tours/*` (`lib/api/trips.ts`). Every mock missed -> every request hit the real
backend -> `trip-uuid-1` is not there -> the page renders **"Trip not found"** -> `beforeEach`
waits 15s for a form that never comes. **That is the entire ~17s signature across the Edit Trip
block - 38 failures, one cause.** Also corrected: `/tours/my-tours` (not `my-trips`), and
**schedules live at `/availability/schedules?tourId=`**, not under the tour - so a blind
`trips`->`tours` replace would have been wrong.

### PARKED - the trips fixtures are archaeological (~1 day)

With the mocks matching, the app now crashes on the fixture:
`TypeError: Cannot read properties of undefined (reading '0')` at `tripToDefaults`
(`trip-details-tab.tsx:309`, `trip.categoryIds[0]`).

`MOCK_TRIP_DRAFT` has **35 keys against a `TripListItem` of ~60**, and it predates **four**
migrations:

| Fixture says | App expects |
|---|---|
| `categoryId: 'cat-1'` | `categoryIds: string[]` + `primaryCategoryId` (1+ categories, one primary) |
| `hubId: null` | `hubIds: string[]` |
| `durationMinutes: 180` | `durationMinutesFrom` / `durationMinutesTo` |
| `featuredSlotNumber`, `featuredSlotStatus` | **the slot economy is REMOVED** - `tierKey`/`tierRank`/`commissionTier` (CLAUDE.md rule 6) |
| - | the whole OCTO block: `timeZone`, `availabilityType`, `deliveryFormats`, `redemptionMethod`, ... |

**These tests have been asserting against a schema that no longer exists, on both dashboards, for
a long time.** That is why they are red on both - and why Phase 9 was right to treat the suite as
evidence rather than a gate.

**Do NOT "fix" the app to tolerate the fixture.** `trip.categoryIds[0]` crashing on a malformed
trip is fine: the real API always sends the field. The fixture is what is wrong.

### Still undiagnosed (~41 failures, likely the cheap ones)

collections 12 · attributes 11 · categories 9 · destinations 5 · hubs 4. Expected to be the
fragile page-wide locators (`getByRole('button').filter({has: svg}).last()`,
`getByText(/snake_case/i)` matching help text AND the error) and 5s prefill races. **Not verified.**

### Deliberately NOT done: isolation

`workers: 1, fullyParallel: false` stays. Phase 9 proved why it must: **four tests changed verdict
purely from database residue** left by earlier tests. Isolation is what makes `workers: 4` safe
(~172 tests would run in ~2-3 min vs today's ~19-29). It is the expensive half and it is owed.

**Validation** tsc clean · 172 collect · `grep "api/v1/trips" e2e/` -> zero.

**Rollback** Revert `2ac049c`. The deletions are the only irreversible part, and they are in git.

---

> **Stage B ends here. Redesign starts only when Phase 9 is green.**
>
> **READ THE GATE HONESTLY (2026-07-17):** Phase 9 bundles *parity proof* with *DNS cutover*.
> **Parity is proven** - 171/171 component files clean, all 227 tests identical on both sides.
> Cutover is deployment logistics, and the old `/dashboard/*` stays live regardless. **The gate
> that protects the redesign is parity, and it is green.** Stage C may start while the deploy waits
> on the user. Recorded as a deviation, user-approved.

---

# Stage C - Foundation (new repo)

## Phase 10 · Lint rules - **DONE**

**Objective** Make the old patterns un-writable.

**Files** `eslint.config.mjs`

**Rationale** 03 §8, **ratio 4.0 - the highest in the document.** Lint **before** tokens: a token system introduced without the lint that forbids the alternatives regrows 187 palette classes within a quarter.

Rules: no palette classes · no hex/rgb/hsl/oklch in components · no inline `style` (allowlist: TanStack sizing) · spacing allowlist · no arbitrary `text-[...]` · `jsx-a11y` icon-button labels · `import/no-restricted-paths` for 05 D1-D5.

**Dependencies** Phase 9

**Risks** ~187 + 55 + 24 existing violations. **Land the rules as `warn`, fix per module in Stage D, flip to `error` at Phase 20.** Landing as `error` immediately blocks all work.

**Validation** Rules fire on known offenders (`user-profile-dropdown.tsx` 30, `statistics.tsx` 28, `spotlight-columns.tsx` 24).

**Rollback** Revert.

> ### EXECUTED 2026-07-17 - `98aedb1` (dashboard, branch `ui-fix`)
>
> All 8 rules landed in `eslint.config.mjs` as `warn`. **428 warnings, 0 errors, `eslint` exits 0** (565 before the spacing scale was corrected) -
> nothing is blocked, which was the design.
>
> **Zero new dependencies.** `eslint-config-next/core-web-vitals` already registers `import` and
> `jsx-a11y` as plugins and configures the `typescript` resolver, so their rules are referenced by
> name. Do **not** add a direct dep: under pnpm the transitive copy is not resolvable from
> `eslint.config.mjs`, so importing the plugin yourself fails where referencing it by name works.
>
> | Rule | Warnings | Note |
> |---|---|---|
> | §8.1 palette classes | **132** | |
> | §8.2 hex/rgb/hsl/oklch | **14** | |
> | §8.3 inline `style` | **17** | see decision 1 |
> | §8.4 spacing scale | **95** | was 232; scale gained `1.5`/`2.5` - see decision 2 |
> | §8.5 arbitrary `text-[...]` | **84** | |
> | §8.7 icon-button labels | **9** | `jsx-a11y/control-has-associated-label` |
> | D1 `lib/` -/-> `components/` | **0** | |
> | D2 `types/` imports only `types/` | **10** | |
> | D3 module -/-> module | **18** | |
> | D4 hook domain -/-> hook domain | **2** | exactly the two `05` predicted |
> | D5 no public-site import | **0** | isolation holds |
>
> **Every rule was proved to fire before being trusted.** A regex selector that fails to parse
> reports zero and looks identical to a clean codebase - the same "missing reads as clean" failure
> that produced two wrong parity claims in Phase 9. A synthetic probe asserted each rule against
> both positive and negative cases, then was deleted. The negative cases matter most: `bg-primary`,
> `href="#"`, `top-5 w-5 duration-500 grid-cols-5`, and `p-0.5 gap-1 mt-2 px-4 m-8 space-y-12` are
> all correctly **not** flagged. The spacing regex needs a trailing `(?![\d.])` rather than `\b` -
> with `\b`, `p-1.5` matches the allowed `1` and silently passes.
>
> **Counts in the spec were occurrence-based and low.** Actual occurrences: palette **207** (spec
> 187), arbitrary text **95** (spec 55), inline style **23** (spec 24). ESLint reports per *node*,
> so one string literal holding three palette classes is one warning - that is why 207 occurrences
> read as 132 warnings. Both numbers are correct; they count different things.
>
> **D1 and D5 are genuinely 0, verified not assumed.** `05` names `lib/tours/listing.ts` as the D1
> offender. `lib/tours/` exists in this repo but holds only `derive-badge.ts` and `signals.ts` -
> `listing.ts` is a public-site file that was never carried over. The extraction fixed D1 as a side
> effect. Checked the directory exists first: a `grep` over a missing path returns nothing and reads
> exactly like a clean result.
>
> #### Two decisions this phase surfaced - both belong to Phase 11
>
> **1. `03 §8.3`'s inline-style allowlist ("TanStack column sizing") is too narrow.** Of 17 warnings,
> ~12 are runtime-computed values - `style={{ width: `${pct}%` }}`, `transform: translateX(...)`,
> `height: `${item.height}px`` - which **no class or token can express**. The 11 `*-table.tsx` files
> each carry exactly one `header.getSize()`, so that part of the spec was right. Implemented as
> written (allowlist lifts *only* the inline-style rule for `*-table.tsx` + `ui/chart.tsx`; every
> color/spacing/type rule still applies there). **Recommendation for the Phase 20 error-flip:**
> narrow the selector to `JSXAttribute[name.name='style'] Property[value.type='Literal']`, which
> flags the actual abuse (a hardcoded static value) and permits computed values. Rule §8.2 already
> catches colors inside `style` independently, so nothing is lost.
>
> **2. The spacing scale was missing a step the codebase actually uses. RESOLVED - user added `1.5`
> and `2.5` to the scale (2026-07-17), before Phase 11 opened.** `1.5` (6px) appears **128 times** -
> the third most-used spacing value in the entire codebase, ahead of `8`. With `2.5` (47) that was
> 175 of the 291 violating occurrences, ~60%. Not drift; a scale missing a step it needs.
> **Rule §8.4 fell from 232 warnings to 95; the repo total fell 565 -> 428.** What remains (`5`,
> `3.5`, `10`, `7`, `9`) is real drift. `03 §8` amended, `SPACING` in `eslint.config.mjs` amended,
> and the rule's message updated to recite the new scale - a stale message is a rule that lies.
> **Phase 11 must mint `--spacing-*` tokens matching this exact scale:** the regex and the tokens
> are one decision expressed twice.
>
> #### Worklist the warnings define (for Stage D)
>
> - **D3 is mostly one misfiling.** 13 of 18 are `components/media/` (6 importers) and
> `components/faq/` (4) - de-facto shared components living in module folders. `05 §D3`'s own remedy
> applies: move to `components/common/`. The genuine cross-module reach is
> `locals-favourites/ -> trips/` (2).
> - **D2's 10 are all one cause**: `types/*` importing `Locale`/`Currency` from
> `lib/constants/locales`. Those types have no home in `types/`. Move them.
> - **D4's 2 are one cause**: `tripKeys` is a shared query-key factory living inside `hooks/trips/`.
> Lift to `lib/`.

---

## Phase 11 · Token system - **DONE**

**Objective** The new design system exists.

**Files** `app/globals.css` (full rewrite per 03 §3), `tailwind` theme mapping

**Rationale** 03. Closes B-3, B-5, D-2, D-3, D-5 structurally.

**Dependencies** Phase 10

> **Phase 10 handed this phase two open decisions - resolve them here, they are cheap now and
> expensive later** (full reasoning in Phase 10's EXECUTED block):
> 1. **Spacing scale: RESOLVED before this phase opened.** The user added `1.5` (6px) and `2.5`
>    (10px); `03 §8` and `eslint.config.mjs` are already amended. **This phase must mint
>    `--spacing-*` tokens for exactly `0.5,1,1.5,2,2.5,3,4,6,8,12,16`** - the `SPACING` regex and the
>    tokens are one decision expressed twice, and they must not drift apart.
> 2. **Inline style**: ~12 runtime-computed values cannot become tokens. Recommendation is to narrow
>    the selector at Phase 20 rather than annotate 12 files with disable comments.

**Risks**
- **The contrast gate (03 §9) is a merge gate, not a follow-up.** Shipping a palette because its lightness values look right is exactly how the current dark mode happened.
- Old tokens must alias to new ones for one phase, or every screen breaks at once.

**Validation** 03 §9 - all 10 checks, both modes, measured. Chart-1 vs chart-2 under deuteranopia in a simulator.

**Rollback** Revert.

> ### EXECUTED 2026-07-17 - `fdb0294` (dashboard, branch `ui-fix`)
>
> `app/globals.css` rewritten to `03` §3. **Build green, tsc clean, lint 0 errors.**
> **The gate is now a runnable check, not a one-off: `pnpm gate:contrast`** (`scripts/contrast-gate.mjs`,
> oklch -> oklab -> linear sRGB -> WCAG luminance, plus Viénot dichromacy simulation). It exits
> non-zero on failure, so Phase 20 can wire it into CI. **34 checks pass in both modes, plus 4
> dichromacy checks.**
>
> #### The gate came back RED on the first run and caught two real defects in the spec's own palette
>
> This is the whole reason §9 exists. Both fixes were surfaced and **user-approved** before any
> deviation.
>
> **1. `--content-subtle` was unfixable as specified.** §3 maps it to `n-500` in **both** modes, but
> light needs `L <= 0.556` for 4.5:1 on `n-25` and dark needs `L >= 0.567` for 4.5:1 on `n-1000`.
> **The windows do not overlap - no single value exists.** Measured: light `n-500` = **4.10:1 FAIL**.
> Every other content token already differs by mode (`content` n-900/n-50, `content-muted`
> n-600/n-400); only `--content-subtle` was left shared, which reads as an oversight rather than a
> tuning miss. **Fix:** added `--color-n-550` (`oklch(0.55 0.014 250)`) for light (**4.64:1**); dark
> keeps `n-500` (**4.75:1**). Three distinct emphasis tiers survive in both modes.
>
> **2. §9 check 7 is un-passable and was testing the wrong token.** `--line` on `--surface` measures
> **1.29:1** light / **1.39:1** dark against a 3:1 target. `--line-strong` is no better (1.56 / 2.03).
> Hitting 3:1 literally forces `L = 0.658` - **a near-black hairline around every card, table row and
> input**. §9's own wording is ">= 3:1 **where it carries meaning**", and WCAG 1.4.11 applies only
> where the boundary is the *only* thing identifying a control. **Fix:** `--line` / `--line-strong`
> stay decorative with **no contrast target**; new **`--line-control`** (light `n-450` = **3.09:1**,
> dark `oklch(0.50 0.014 250)` = **3.39:1**) covers inputs, checkboxes and select triggers. The
> shadcn `--input` alias points at `--line-control`, so the gate governs something real instead of a
> divider. **§9 check 7 now targets `--line-control`.**
>
> #### Two deliberate deviations from 03 §3
>
> - **Fonts stay wired to `next/font`** (Noto Sans / Playfair / JetBrains). §3 hardcodes
> `--font-sans: 'Inter Variable'`, but **Phase 13 owns the font swap** - doing it here changes fonts
> two phases early and outside their own validation.
> - **No `--spacing-*` tokens.** §3 says outright *"Do not restrict here; see §8"* - v4 derives
> spacing multiplicatively (`p-1.5` = `calc(var(--spacing) * 1.5)`, verified in the compiled output),
> so **`eslint.config.mjs` is the only enforcement**. An earlier note in this doc claiming Phase 11
> must mint `--spacing-*` tokens was wrong and is corrected here.
>
> #### Compatibility aliases - DELETE AT PHASE 20
>
> The risk note was right: **~2,000 call sites** still use the shadcn names (`muted` **666**,
> `muted-foreground` **510**, `destructive` **267**, `foreground` **168**, `primary` **143**,
> `border` **71**, `sidebar` **61**), plus **15 components reading `var(--primary)` and friends
> directly**. Every old name now aliases onto **exactly one** new semantic token and is retired per
> module through Stage D. They are aliases, not a second system - **giving one its own literal value
> forks the system in place, which is the exact failure `01` documents.** `--primary`, `--sidebar`
> and `--chart-1..5` needed no alias: the new system reuses those names.
>
> #### Verified along the way
>
> - **`@theme inline { --x: var(--x) }` is NOT defect B-5** when `:root` defines `--x`. Proved with a
> compile probe: the emission lands in `@layer theme`, the real value is **unlayered**, and unlayered
> outranks every layer - so no cycle forms. **B-5 breaks for a different reason**: nothing defines
> `--shadow-2xl` at all, leaving the self-reference as the only declaration. Shadows still sidestep
> it by sourcing from `--elevation-*`, Tailwind's own documented pattern.
> - **`--duration-*` is not a v4 theme namespace** and generates no `duration-fast` utility
> (`--ease-*` does). Kept as `var()`-only custom properties with a note, rather than left implying a
> utility that will never exist.
> - `rounded-2xl` (6 call sites) inherits Tailwind's default `--radius-2xl`; removing the token would
> have silently rendered nothing.
>
> **Closed:** B-3 (`--destructive-foreground` now defined), B-5 (`--tracking-normal` defined;
> shadows sourced from `--elevation-*`), D-3 (radius is `@theme`-only), D-5 (one hue, 250).
> Also dropped an inherited defect: the old `--warning-foreground` was near-white on `oklch(0.769)`
> amber and never passed contrast; it is now dark ink.

---

## Phase 12 · StatusBadge

**Objective** One status primitive, zero hand-rolled colors.

**Files** New `components/common/status-badge.tsx` + status maps. **Delete:** the 4 conventions in `booking-columns.tsx:20,33,43`, `payment-columns.tsx:10,23`, `spotlight-columns.tsx:47`, `destination-columns.tsx:89`. Rewrite all 149 palette-class call sites.

**Rationale** 03 §5.1, **impact 5 / effort 2.** One missing primitive caused 149 hardcoded colors, 4 conventions, and most of the dark-mode gap. The mandatory dot + label is **WCAG 1.4.1 Level A** (E-2), not decoration.

**Dependencies** Phase 11

**Risks** **This is the R7 test.** Adding `StatusBadge` without deleting the 4 conventions reproduces the codebase's central failure.

**Validation** `grep -E "(bg|text|border)-(amber|emerald|green|red|rose|sky|violet|blue)-[0-9]" components/` -> **zero**. Every variant renders its non-color cue. Both modes measured.

**Rollback** Revert.

---

## Phase 13 · Fonts, icons, primitives

**Objective** 5 fonts -> 2; 2 icon libraries -> 1; primitives fixed.

**Files** `app/layout.tsx` (Inter + JetBrains Mono; drop Playfair/DM Sans/General Sans/Noto), 14 hugeicons files -> lucide, `ui/button.tsx` (de-shout, 8 sizes -> 5, solid destructive), `ui/sidebar.tsx:478` (**fix the `hsl(var(--oklch-token))` bug** - B-4), `ui/badge.tsx` deleted, `ui/chart.tsx` (tokens, 6-hue ramp). Remove `@hugeicons/*`, `vaul`.

**Rationale** D-6, D-7, D-8, B-4. Ratios 2.0-3.0.

**Dependencies** Phase 12

**Risks** Dropping Playfair (70 usages) is the most visible change in the whole plan. It is correct - a high-contrast editorial display serif in an operational CRM - but expect it to be the thing people notice. **Keep `@dnd-kit`**: Phase 18 finally uses it.

**Validation** Two font files in the network tab. `grep hugeicons` -> zero. Sidebar rail shadow renders.

**Rollback** Revert.

---

# Stage D - Redesign (new repo)

> Ordered by impact/effort. Each phase is one module, one PR, independently shippable.

## Phase 14 · Command palette + IA

**Objective** New sidebar grouping; `Cmd+K` navigation.

**Files** `navigations/navigations.ts` (4 groups), `components/shell/command-palette.tsx`, `app-sidebar.tsx`

**Rationale** 04 §1, **ratio 2.0.** `cmdk` is already a dependency. **This is the real answer to click depth** - it makes the sidebar a map rather than the only road, and it de-risks every later IA change.

**Dependencies** Phase 13. **Risks** none material. **Validation** Both role IAs match 04 §1.3; palette finds tours/bookings/destinations. **Rollback** Revert.

---

## Phase 15 · DataTable

**Objective** One table system; 10 forks deleted.

**Files** New `components/data-table/*` + `use-table-state.ts`. **Delete** all 10 hand-rolled tables' scaffolding.

**Rationale** 05 §7, G-3, F-2.

**Dependencies** Phase 14

**Risks** **The largest R7 test in the plan.** The deliverable is *adoption*. Landing `data-table/` with 10 forks alive means writing an eleventh table. Watch the three client-paginated tables (collections, attributes, spotlight) - they move to server pagination, a real behavior change.

**Validation** All 10 tables use it. One pagination strategy, one search, one skeleton, one empty state. `PAGE_SIZE_OPTIONS` declared once. Parity checks 12, 35, 41.

**Rollback** Revert (large PR - consider one table per commit inside it).

---

## Phase 16 · Tours: create + readiness

**Objective** Create asks 4 fields. Publish tells the truth.

**Files** `trip-form.tsx` (704) **deleted**; new 4-field create; `readiness-rail.tsx` (**server**); `trip-edit-view.tsx` readiness card removed.

**Rationale** 04 §2.2 A + C. Both ratio 2.0. Kills the C-4 duplication (1,764 lines maintaining one form twice) and stops three lies: an always-enabled Publish the backend rejects, a readiness card that omits the 6th requirement, and a create form that asks 30 questions to collect 4.

**Dependencies** Phase 15

**Risks** **The publish gate is the sensitive one.** Disabling Publish until checks pass is a behavior change - if the client's readiness computation disagrees with the backend's validation, an operator is **blocked from a legal action**. The client rule must be a strict subset of the backend's. Verify against the backend validator before enabling; if in doubt, warn instead of disable.

**Validation** Parity 21, 31-33. Create -> editor -> readiness -> publish. Listing requirements visible before publish.

**Rollback** Revert.

---

## Phase 17 · Translation Console

**Objective** 300+ clicks -> ~30. 5 forks -> 1 console.

**Files** New `app/(app)/translations/*`, `components/translations/*`, `lib/translatable-schema.ts`. **Delete:** 5 `LocaleTab` implementations, `trip-translations-tab.tsx`, `rationale-translation-tabs.tsx`, `translation-row.tsx`, `dual-translation-row.tsx` (~1,400 LOC).

**Rationale** 04 §3. **The single largest operator cost in the product** (C-1). ~120 saves -> 6. Source text on screen for the first time. Completeness answerable for the first time.

**Dependencies** Phase 15. Pre-translate **BLOCKED on A4**; ship the console without it.

**Risks**
- **The biggest R7 test after Phase 15.** Leaving the tabs in place gives operators two ways to do one job and deletes nothing.
- `lib/translatable-schema.ts` must be exhaustive. A missed field silently becomes untranslatable.
- Preserve the EN rule exactly: EN "Clear Fields" **upserts nulls**, never calls delete (the backend blocks it).

**Validation** Parity 15. Every field in the old tabs reachable in the console. Matrix completeness matches reality. 7 locales save.

**Rollback** Revert. **Large - consider landing the console first, deleting the tabs in an immediate follow-up.** This is the one place where splitting R7 across two PRs is defensible, because the console must be proven before the old path is destroyed. **The follow-up must be same-day, not same-quarter.**

---

## Phase 18 · Tours: 13 tabs -> 4 routes

**Objective** Routed phase groups; one save per route.

**Files** `trip-edit-view.tsx` -> server `layout.tsx` + 4 routes. Split `trip-schedules-tab.tsx` (1,165), `trip-pricing-tab.tsx` (1,095), `trip-details-tab.tsx` (1,060). Move `scheduledSlotsForDate` -> `lib/tours/availability.ts`. Delete the local `DatePickerField`. All `useState` row editors -> RHF. Delete 5 `as unknown as Resolver<T>`.

**Rationale** 04 §2.2 B + D, 05 §3-4. The core workflow. 10,363 -> ~6,500 LOC.

**Dependencies** Phases 16, 17. Drag-drop **BLOCKED on A6** - keep arrows. Bulk schedules **BLOCKED on A5** - keep the 21-request loop, add progress + partial-failure summary.

**Risks** **The largest single refactor.** Mitigations: one route group per commit; the 4-field create (16) and the console (17) have already removed ~2,500 LOC from this surface; parity checks 21-34 cover it densely.

**Validation** Parity 21-34 in full. Tabs are URL-linkable; back returns to the previous tab. One save per route + dirty guard.

**Rollback** Revert per route group.

---

## Phase 19 · Entity modules

**Objective** Four forks -> one shape.

**Files** Canonical routed editor for destinations/hubs/categories/collections. One `SeoForm` (was 4 x ~360). One `ConfirmDialog` (**delete 3 abstractions + 4 wrappers**). Hubs 8 tabs -> 5. ~~Gate collections (B-7).~~ **B-7 retracted (Phase 9) - collections already gates.** What is left is to even up the *thinness*: it gates in 2 files vs hubs' 4. Fold that into the canonical editor rather than treating it as a fix.

**Rationale** 04 §4.1. ~10,500 -> ~4,000 LOC. `FaqManager` already proves the pattern.

**Dependencies** Phase 15

**Risks** Hubs' 4 extras -> one Curation tab is the only real UX change. Collections gating is the flagged intentional delta.

**Validation** Parity 12-20 per module. All four editors identical in shape and tab order.

**Rollback** Revert per module.

---

## Phase 20 · Remaining modules + lint to error

**Objective** Everything else; lint becomes blocking.

**Files** Bookings/payments (detail -> Sheet; move `refundDue` to `lib/`; one gating idiom), media (pagination - **unblock item 101**; picker -> Sheet; "used by"), settings (routed; rename to end the General/Company collision), profile (per-card edit), spotlight/locals (queue shape), operators (delete the single-tab nav). Flip lint `warn` -> `error`.

**Rationale** 04 §4.3-4.9. **Media pagination is the highest-priority item here** - the 100-cap is a hard operational ceiling, not a nice-to-have.

**Dependencies** Phase 19. Payments detail **BLOCKED on A7**; media tags **BLOCKED**.

**Risks** Media server-side search **BLOCKED** if `/media-gallery` lacks query params - **verify early**; if it supports them, this is frontend-only.

**Validation** Parity 35-50. Lint passes as `error`. 05 §9 done-list per module.

**Rollback** Revert per module.

---

# Stage E - Unblocked

Each begins when its backend request lands. Ordered by value.

## Phase 21 · Overview (A1)

**Objective** Replace fabricated data with real stats.

**Rationale** **The first screen every operator sees after login is fake** - `totalRevenue: 125000.50`, `'John Doe'`, `'Bali Adventure'` in a Caribbean product. Also removes `statistics.tsx`'s `|| true ?` forced mock branches (B-2).

**Interim, do not wait for A1:** replace the fake data with an honest empty state plus counts available from existing endpoints. **Shipping "John Doe" to real operators is worse than shipping an empty state.**

**Files** Delete `dashboardActions.ts`; split `statistics.tsx` (1,078) per card; per-card `<Suspense>`; role-split per 04 §4.10.

## Phase 22 · Pre-translate (A4)

**Objective** Machine translation in the console.

**Rationale** The DB column, DTO field, type, and badge **already exist end-to-end**. Only the generator is missing, and `CLAUDE.md` already lists AI translation as planned BullMQ work. Highest-value item in Appendix A after A1.

## Phase 23 · Reviews (A2) · Users (A3) · Bulk ops (A5, A6) · Payments (A7)

Reviews and Users reuse the **same queue shape** as Spotlight and Cancellations - three inboxes, one pattern. A5/A6 retire the 21-request schedule save and unlock drag-drop reorder (04 §2.2 E-F).

---

# Risk register

| # | Risk | Phase | Severity | Mitigation |
|---|---|---|---|---|
| 1 | **Cache revalidation fails silently** | 7 | **Critical** | `updateTag` throws in Route Handlers - use `revalidateTag`. 400-on-unknown tag guard. Log, never swallow. Integration checks 25-26. |
| 2 | **Publish gate blocks a legal action** | 16 | High | Client readiness must be a strict subset of backend validation. Verify against the validator; warn rather than disable if uncertain. |
| 3 | **Forks survive the shared component** | 12, 15, 17, 19 | High | R7 as a PR rule. `grep` assertions in validation. This is *how this codebase decayed*. |
| 4 | `COOKIE_DOMAIN` mismatch -> login loop | 8 | High | Deployment checklist; staging first |
| 5 | Contrast gate skipped | 11 | High | Merge gate, measured. Not a follow-up. |
| 6 | Translation schema misses a field | 17 | High | Field-by-field diff against the 5 old forms |
| 7 | Tours refactor too large | 18 | Medium | Per-route commits; 16 + 17 shrink it first |
| 8 | rbac / types drift post-split | ongoing | Medium | Contract tests (02 Appendix B1, B2) |
| 9 | Public site cross-site auth breaks | n/a | **High, not ours** | 02 §1.2. Raise before DNS cutover. Does not block the split. |
| 10 | Lint as `error` blocks all work | 10 | Medium | Land as `warn`, flip at 20 |

---

# Sequencing summary

```
A  1 → 2 → 3 → 4                      current repo · ships independently · zero behavior change
B  5 → 6 → 7 → 8 → 9                  new repo · zero behavior change · DNS-reversible
                                       ── gate: Phase 9 green ──
C  10 → 11 → 12 → 13                  foundation · lint FIRST
D  14 → 15 → 16 → 17 → 18 → 19 → 20   redesign · by impact/effort
E  21 → 22 → 23                       as backend lands
```

**Two properties worth naming:**

1. **Stage A has value even if the split never happens.** A live bug fixed, 7 couplings severed, 1,574 dead lines gone. Nothing in Stage A is wasted work.
2. **The gate at Phase 9 is the plan's spine.** Extraction proven before redesign begins. Break it and every subsequent bug becomes an argument about whether the move or the redesign caused it.

---

# Open decisions

| # | Decision | Recommendation |
|---|---|---|
| 1 | Rename trips -> tours in Phase 6, or defer? | **Defer.** Keep the extraction reviewable. |
| 2 | Weather widget: carry or remove? | 02 defaults to carry; 04 recommends remove. **Product call.** |
| 3 | `revalidateTag` profile: parity now, `'max'` later? | **Parity now.** Revisit `'max'` as a separately-reviewed tuning change. |
| 4 | Phase 17 rollback: one PR or console-then-delete? | **Console first, delete same-day.** The one defensible R7 exception. |
| 5 | Playfair Display: 70 usages, dropped | Confirm you are happy with the visual delta. |
