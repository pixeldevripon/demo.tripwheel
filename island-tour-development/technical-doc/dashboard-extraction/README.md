# Dashboard Extraction & UI/UX Redesign - Specification Set

> Status: **specs complete, awaiting review. No code written. Implementation is gated on approval.**
> Authored 2026-07-17 against branch `dashboard-ui`.

---

## Documents

| # | Doc | What it is |
|---|---|---|
| 0 | [`00-DISCOVERY-INVENTORY.md`](./00-DISCOVERY-INVENTORY.md) | Facts only. Routes, LOC, coupling graph, API layer, auth, tokens, dead code, 10 verified defects. |
| 1 | [`01-AUDIT-REPORT.md`](./01-AUDIT-REPORT.md) | Ranked findings by severity and impact/effort. Architecture, correctness, UX, design, a11y, performance, duplication. Plus what is genuinely good. |
| 2 | [`02-EXTRACTION-SPEC.md`](./02-EXTRACTION-SPEC.md) | **Primary deliverable.** Domain topology, per-module resolution, API/auth boundary, env, migration order, 55-row parity checklist, backend requests, contract-drift register. |
| 2B | [`02B-CACHE-REVALIDATION-SPEC.md`](./02B-CACHE-REVALIDATION-SPEC.md) | Cross-**app** cache invalidation. The only silent failure in the migration. Applies from Phase 7 regardless of domain - this is process separation, not domain. |
| 2C | [`02C-CROSS-DOMAIN-AUTH-SPEC.md`](./02C-CROSS-DOMAIN-AUTH-SPEC.md) | Better Auth analysis for the `island.tours` + `dashboard.tripwheel.io` + `api.tripwheel.io` target. **Verdict: viable** - 3 public-site files, 2 env vars, zero backend code (**§4A** is the change set). Grounded in the installed dist source. Separate project from the split; not needed for the interim. |
| 3 | [`03-DESIGN-SYSTEM-SPEC.md`](./03-DESIGN-SYSTEM-SPEC.md) | Palette + rationale, full Tailwind v4 token set, density strategy, component standards, shadcn inventory, lint enforcement, contrast gate. |
| 4 | [`04-UX-STRATEGY-SPEC.md`](./04-UX-STRATEGY-SPEC.md) | IA, navigation, role journeys, the 7-locale system, tour progressive disclosure, and a Problem/Solution/Architecture triad per scope area. |
| 5 | [`05-COMPONENT-ARCHITECTURE-SPEC.md`](./05-COMPONENT-ARCHITECTURE-SPEC.md) | Server/client rules, composition, state ownership, dependency direction, the DataTable system, definition of done. |
| 6 | [`06-IMPLEMENTATION-PLAN.md`](./06-IMPLEMENTATION-PLAN.md) | 23 phases in 5 stages. Objective, files, rationale, dependencies, risks, validation, rollback per phase. Plan only. |

**Read in order.** 02 and 02B are the ones to review first if time is short - they carry the risk.

---

## The five things that matter

| # | Finding | Why first-order |
|---|---|---|
| 1 | **161 of 207 dashboard files are `'use client'` (77.8%)** | Root cause of the performance profile, skeleton-first UX, and why tabs multiplied instead of routes |
| 2 | **7-locale entry costs 300+ clicks and ~120 saves per tour** | Largest operator cost in the product. A missing system, not a bad screen. |
| 3 | **The cache bridge dies silently on split** | The only extraction risk no build, type check, or import graph will catch |
| 4 | **Tour editor: 13 flat tabs, no save model, a publish contract that lies** | The core workflow, weakest contract |
| 5 | **A stripped badge primitive caused 149 hardcoded colors** | Highest leverage-to-effort fix in the set |

---

## The headline

**Extraction is smaller than it looks. The redesign is bigger.**

The API boundary is already clean: two deliberately separate fetch stacks, and the public site imports **zero** dashboard code. **7 import statements and 4 shared files** stand between this codebase and a standalone app.

What is genuinely hard is elsewhere:
- The dashboard is a client SPA wearing an App Router costume.
- **Cache revalidation stops working the moment there are two apps, with no error at all.** This is
  *process* separation, not domain - the interim single-apex topology does **not** rescue it. `02B`.
- The eventual `island.tours` move silently breaks the **public site's** cookie auth, and **one Better
  Auth instance cannot emit cookies for two registrable domains** (verified in the installed source).
  Deferred, analysed in `02C`. Not a problem on the interim topology.

---

## The pattern beneath everything

> **This codebase's failure mode is not missing abstractions. It is un-adopted ones.**
>
> A generic `DataTable` (813 LOC) exists and **all 10 tables ignored it**. A generic `ConfirmDialog`
> documented for "any potentially-destructive dashboard action" has **2 of ~10** consumers. A shared
> `DatePickerField` exists and the schedules tab redefined it locally. A shared `deactivate-dialog`
> sits behind **four clone wrappers**. `FaqManager` is the one that won - 477 LOC, 4 consumers, zero
> forks. It proves the pattern works here.
>
> **Therefore, the governing rule of the whole plan (05 R7):** a PR that adds a shared component and
> does not delete every fork it replaces is incomplete and must be rejected. Not a follow-up ticket.
> Same PR. Any remediation that only *writes* shared components will reproduce the problem it set out
> to solve.

---

## Confirmed parameters

| | |
|---|---|
| Split | Own repo, now. Hard cut. |
| Domains (interim, in force) | `islandtours.esenc.cloud` · `dashboard.islandtours.esenc.cloud` · `api.islandtours.esenc.cloud` - one apex, all same-site |
| Domains (target) | `island.tours` · `dashboard.tripwheel.io` · `api.tripwheel.io`. **Confirmed viable** via bearer-for-public (`02C` §4A). A separate project - do the split on the interim topology first. |
| Auth | Cookie, cross-subdomain on `.islandtours.esenc.cloud` - **already the configured default, no change needed** |
| Base path | Root `/` |
| Travels with | portal + staff, onboarding, media gallery |
| `components/ui/` | Fork. Dashboard diverges. |
| Design | Free rein, new palette. Dark mode kept, both to WCAG AA. |
| Backend | **No changes.** Requests are in 02 Appendix A. |
| Deploy | Dockerfile + Next standalone |
| Locales | 7, as a **content workflow**. Admin UI stays English. |
| Deleted | Leads, Enquiries (vestigial - "no enquiry model") |
| Designed but blocked | Overview (A1), Reviews (A2), Users (A3), Pre-translate (A4) |

---

## Expected outcome

| | Before | After |
|---|---|---|
| Dashboard LOC | ~35,300 | ~19,500 (**-45%**) |
| Client components | 161 / 207 (78%) | ~110 / 190 (~58%) |
| Translate 1 tour x 6 locales | 300+ clicks, ~120 saves | ~30 clicks, 6 saves |
| Publish a tour | ~25-30 clicks, 5 tabs | ~12, guided |
| Hardcoded palette classes | 187 | **0** (lint-enforced) |
| Distinct spacing values | 59 | 9 |
| Fonts | 5 | 2 |
| Icon libraries | 2 | 1 |
| Dead code | 1,574 LOC | 0 |
| "Is this tour ready for Germany?" | unanswerable | 1 click |

---

## Verified defects (reported, not fixed)

| # | Defect | Severity |
|---|---|---|
| B-1 | **`PATCH /settings/site` never busts the public `site-info` cache.** Duplicate `case 'settings'` in `cache-revalidation.ts:142,150`; the second is unreachable. `site-info` is `cacheLife('days')`. **Live production bug.** Phase 1 fixes it in the current repo, independent of the split. | S1 |
| B-2 | `statistics.tsx:408,516` - `\|\| true ?` forces mock chart branches on | S2 |
| B-3 | Dashboard home is 100% fabricated (`'John Doe'` booking `'Bali Adventure'`) | S2 |
| B-4 | `ui/sidebar.tsx:478` wraps oklch tokens in `hsl()` - invalid CSS, renders nothing | S3 |
| B-5 | `--shadow-2xl`/`--tracking-normal` self-referential; `--destructive-foreground` never defined | S3 |
| B-6 | `refundDue`/`paymentModelLabel` (money logic) exported from a columns file | S3 |
| B-7 | Collections: 594-line CRUD form, **zero RBAC gating** | S2 |

---

## What is NOT covered

Stated plainly so nothing here is over-claimed:

1. **No accessibility audit was run.** No axe, no keyboard sweep, no screen reader, no focus order. The a11y findings are static-analysis only (type size, color-only semantics, contrast math). **§E of 01 is not a WCAG audit and must not be cited as one.** A real audit is scoped in 06.
2. **No bundle measurement.** No `@next/bundle-analyzer`. Client-component counts are a proxy.
3. **Contrast ratios in 03 are design targets, not compliance claims.** The gate in 03 §9 must be measured before merge.
4. **The public site's cross-site auth break (02 §1.2) is reported, not solved.** It is outside this project and needs the public-site owner.

---

## Next step

Review, and tell me what to change. On approval, implementation runs 06 in order, one phase per PR, reporting back at each phase boundary.

If a spec decision turns out to be wrong or infeasible during implementation, I stop and surface it rather than deviating.

**Five open decisions** need your call (06 §Open decisions): the trips->tours rename timing, the weather widget, the `revalidateTag` profile, the Phase 17 rollback shape, and dropping Playfair Display.
