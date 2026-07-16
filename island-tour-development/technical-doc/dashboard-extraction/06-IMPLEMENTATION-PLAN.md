# Phase 6 - Phased Implementation Plan

> **Plan only. No code.** Implementation begins only on explicit approval (Phase 7).
>
> Every phase: objective · affected files · rationale · dependencies · risks · validation · rollback.

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

| Stage | Phases | Repo | Behavior change | Reversible |
|---|---|---|---|---|
| **A. Decouple** | 1-4 | current | **none** | trivially |
| **B. Extract** | 5-9 | new | **none** | DNS |
| **C. Foundation** | 10-13 | new | visual | per phase |
| **D. Redesign** | 14-20 | new | UX | per phase |
| **E. Unblocked** | 21-23 | new | new features | per phase |

---

# Stage A - Decouple (current repo)

## Phase 1 · Fix the live cache-revalidation bug

**Objective** `PATCH /settings/site` busts the public `site-info` tag.

**Files** `lib/api/cache-revalidation.ts` (merge the duplicate `case 'settings'` at `:142` and `:150`)

**Rationale** B-1 is a **live production bug**, verified. Every `/settings/*` write pushes only `user-profile`; the `site-info` branch at `:150` is unreachable because the first matching case wins. `getPublicSiteInfo` is `cacheLife('days')`, so a logo or WhatsApp change is invisible on the live site for days. A real production bug must not wait on an architecture project.

**Dependencies** none. **Ship today.**

**Risks** Effectively none. The change makes an unreachable branch reachable.

**Validation** Unit: `PATCH /settings/site` -> tags include `site-info`; `PATCH /settings/seo` -> does not. Manual: change the logo, confirm the public footer updates.

**Rollback** Revert. Restores the bug.

---

## Phase 2 · Sever the 7 cross-tree imports

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

---

## Phase 3 · Sort `components/` by owner

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

---

## Phase 4 · Delete dead code

**Objective** Remove >1,574 confirmed-dead LOC.

**Files** `components/data-table.tsx` (813), `section-cards.tsx`, `chart-area-interactive.tsx`, `trips/trip-content-tab.tsx` (255), `trips/trip-languages-tab.tsx` (205), `common/image-upload-selector.tsx` (235), `locals-favourites-list-view.tsx` (66, **verify first**), `app/__backup(auth)/`, `components/__backup_auth/`, `dashboard/{leads,enquiries}/page.tsx`, `frontend/lint_errors.log`. Fix `tsconfig.json:include` (references a nonexistent file).

> **ADDED by Phase 3 (verified dead during implementation, 2026-07-17):**
> `components/nav-user.tsx`, `components/nav-documents.tsx`, `components/nav-secondary.tsx` -
> each exports a component that **nothing imports** (`app-sidebar` imports only `NavMain`); and
> `components/frontend/skeletons/collection-tour-card-skeleton.tsx` - `CollectionTourCardSkeleton`
> has no consumer. After these four go, **`components/` root is empty of loose files** - which is
> Phase 3's stated validation, reachable only once Phase 4 lands.

**Rationale** F-2. `data-table.tsx` is the emblem: a generic table abstraction that all 10 tables ignored, keeping 813 lines and `ui/drawer.tsx` alive.

**Dependencies** none

**Risks** **`lib/api/cache-revalidation.ts` is NOT dead** - `lib/api/fetch.ts:7` imports it. An earlier scan said otherwise and was wrong. Do not delete it. Verify `locals-favourites-list-view.tsx` before removing.

**Validation** Both apps build. Bundle shrinks. `grep` each deleted symbol -> zero.

**Rollback** Revert.

---

# Stage B - Extract (new repo)

## Phase 5 · Scaffold and copy

**Objective** The new repo builds. **Zero redesign.**

**Files** Everything in `02` §3.4 (copies) and §3.5 (rewrites: `layout.tsx`, `globals.css`, `proxy.ts`, `next.config.ts`, `dashbaord-wraper.tsx`).

**Rationale** `02` §2. Repo root = the app. Isolation test: clone, `pnpm dev`.

**Dependencies** Phases 1-4

**Risks**
- **The `globals.css` rewrite is a token *port*, not the new system.** Phase 11 owns the redesign. Mixing them here makes every later visual diff unreviewable.
- `proxy.ts` must drop all public i18n and keep `guardDashboard` **exactly** - including the no-network property (05 R11).

**Validation** `pnpm build` succeeds. `grep "@/components/frontend\|@/lib/api/public"` -> zero.

**Rollback** Delete the repo. The current monorepo is untouched.

---

## Phase 6 · Base path `/dashboard/*` -> `/*`

**Objective** Dashboard serves at root.

**Files** Route moves; `navigations/navigations.ts`; every `router.push`/`redirect`/`<Link>`; `proxy.ts` (add a `/dashboard/*` -> `/*` 308); `e2e/`.

**Rationale** `02` §8. `dashboard.tripwheel.io/dashboard/tours` is redundant. Cheap now, expensive later.

**Dependencies** Phase 5

**Risks** Missed links 404. Grep is exhaustive.

**Validation** `grep -rn "/dashboard" app components lib navigations` -> only the legacy redirect. Every nav item resolves. Legacy path 308s.

**Rollback** Revert.

**Go/no-go:** `02` §9 - **rename trips -> tours here, or defer?** Doing it now is one churn instead of two; doing it now also makes an already-large mechanical diff harder to review and worse to bisect. **Recommendation: defer.** Keep the extraction reviewable; pay the churn twice.

---

## Phase 7 · Cross-domain cache revalidation

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

---

## Phase 8 · Env, Docker, staging

**Objective** Deployed to a staging subdomain.

**Files** `Dockerfile`, `.dockerignore`, `.env.example`, `.env.production.example`, `next.config.ts` (`output: 'standalone'`)

**Rationale** `02` §7. **Backend config changes:** `COOKIE_DOMAIN=.tripwheel.io`, `CORS_ORIGINS` += `https://dashboard.tripwheel.io`.

**Dependencies** Phases 5-7

**Risks** **`COOKIE_DOMAIN` mismatch = login loop.** Backend and dashboard must agree. `INTERNAL_API_SECRET` mismatch = SSR throttled.

**Validation** Loads, authenticates, lists tours on staging.

**Rollback** Staging only.

---

## Phase 9 · Parity verification and cutover

**Objective** Prove zero regression, then cut DNS.

**Files** none (verification)

**Rationale** `02` §11 - 55 checks against production data.

**Dependencies** Phases 5-8

**Risks** **One known intentional delta:** collections gains RBAC gating (B-7). Flag it; do not let it read as a regression.

**Validation** Every row green. No waiver without a written note.

**Rollback** DNS. Old `/dashboard/*` stays live until the new origin is proven.

> **Stage B ends here. Redesign starts only when Phase 9 is green.**

---

# Stage C - Foundation (new repo)

## Phase 10 · Lint rules

**Objective** Make the old patterns un-writable.

**Files** `eslint.config.mjs`

**Rationale** 03 §8, **ratio 4.0 - the highest in the document.** Lint **before** tokens: a token system introduced without the lint that forbids the alternatives regrows 187 palette classes within a quarter.

Rules: no palette classes · no hex/rgb/hsl/oklch in components · no inline `style` (allowlist: TanStack sizing) · spacing allowlist · no arbitrary `text-[...]` · `jsx-a11y` icon-button labels · `import/no-restricted-paths` for 05 D1-D5.

**Dependencies** Phase 9

**Risks** ~187 + 55 + 24 existing violations. **Land the rules as `warn`, fix per module in Stage D, flip to `error` at Phase 20.** Landing as `error` immediately blocks all work.

**Validation** Rules fire on known offenders (`user-profile-dropdown.tsx` 30, `statistics.tsx` 28, `spotlight-columns.tsx` 24).

**Rollback** Revert.

---

## Phase 11 · Token system

**Objective** The new design system exists.

**Files** `app/globals.css` (full rewrite per 03 §3), `tailwind` theme mapping

**Rationale** 03. Closes B-3, B-5, D-2, D-3, D-5 structurally.

**Dependencies** Phase 10

**Risks**
- **The contrast gate (03 §9) is a merge gate, not a follow-up.** Shipping a palette because its lightness values look right is exactly how the current dark mode happened.
- Old tokens must alias to new ones for one phase, or every screen breaks at once.

**Validation** 03 §9 - all 10 checks, both modes, measured. Chart-1 vs chart-2 under deuteranopia in a simulator.

**Rollback** Revert.

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

**Files** Canonical routed editor for destinations/hubs/categories/collections. One `SeoForm` (was 4 x ~360). One `ConfirmDialog` (**delete 3 abstractions + 4 wrappers**). Hubs 8 tabs -> 5. Gate collections (B-7).

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
