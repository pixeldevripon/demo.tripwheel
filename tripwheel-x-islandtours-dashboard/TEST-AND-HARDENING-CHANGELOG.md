# Dashboard Test & Hardening Changelog

A running log of the module-by-module review → test → fix initiative on the
operator/admin dashboard. Most-complex-first. Each fix records **what** changed,
**why**, and **why it was necessary**, and is verified not to break existing
business logic.

Legend: 🔴 critical · 🟠 high · 🟡 medium · 🟢 low · ✅ done · 🧪 test added

---

## 0. Test infrastructure (prerequisite)

**What:** Added Vitest + React Testing Library + happy-dom as the unit-test stack
(none existed — the repo had only Playwright e2e).

- `vitest.config.ts` — happy-dom env, globals, `@/*`→`./*` alias mirror of tsconfig,
  excludes `e2e/**` so Playwright specs are never double-run.
- `vitest.setup.ts` — `@testing-library/jest-dom` matchers + `afterEach(cleanup)`.
- `package.json` scripts: `test` (`vitest run`), `test:watch`, `test:cov`.
- Dev deps: `vitest@^3`, `@vitejs/plugin-react`, `@testing-library/{react,user-event,jest-dom,dom}`,
  `happy-dom`, `@vitest/coverage-v8@^3`. Approved `esbuild` build (moved
  `onlyBuiltDependencies` to `pnpm-workspace.yaml`).

**Why:** the ask requires happy/sad-path unit tests; Playwright alone can't cover
pure logic and component units economically. Vitest is the ESM-native fit for
Next 16 / React 19.

**Verified:** `pnpm test` green (7/7 on the first pure-logic suite).

---

## Module: `trips` (Tours) — most complex (43 files, ~15.7k LOC)

### 🧪 Tests added
- `lib/tours/derive-badge.test.ts` — badge priority ladder (likelyToSellOut >
  mostPopular > new > sponsored), 30-day new-window, invalid-date safety,
  paid-tier fallback. Happy + sad paths. ✅ 7/7.

### Security review — findings & verification

The dashboard is a thin cookie-authed client of the NestJS backend; **all** authorization
is backend-enforced, and the dashboard's `can()`/`role` checks are UI-gating only (by design).
No `dangerouslySetInnerHTML`, secret leakage, SSRF, prototype-pollution, unsafe parse, or
ReDoS in the trips module. Net: **no CRITICAL/HIGH in the dashboard code itself.** The
material item is the backend-authorization dependency — verified below against the backend.

**Backend authorization VERIFIED (island-tour-development/backend/src/tours):**
- `publish`/`approve`/`reject`/`unpause`/`restore` → `@RequirePermissions(MANAGE_TRIPS)` — operators excluded ✅
- `PATCH :id` → `EDIT_TRIP`, `DELETE :id` → `DELETE_TRIP`, both **ownership-scoped** in the
  service (`resolveOperatorId` + `ForbiddenException` on operator≠owner; ADMIN bypass) ✅
- `UpdateTourDto` is a strict allowlist — `status`/`operatorId`/`tierKey`/`tierRank`/
  `commissionTier`/`qualityScore`/`isSponsored`/`isActive` are **absent**; global
  ValidationPipe (`whitelist`+`forbidNonWhitelisted`) strips anything else ✅
- `isLocalsFavourite` intentionally NOT in `UpdateTourDto` → dedicated `MANAGE_EDITORIAL` endpoint ✅

**⏪ REVERTED (per user, 2026-08-02) — `likelyToSellOutOverride` finding left as-is.**
A finding was raised: `likelyToSellOutOverride` is accepted by the operator `UpdateTourDto`
(`EDIT_TRIP`), so an operator could force the "Likely to sell out" scarcity badge via a raw PATCH.
A fix was drafted (remove it from `UpdateTourDto`, add a `MANAGE_EDITORIAL` endpoint, rewire the
dashboard) and then **fully reverted at the user's request** — all changes were uncommitted and
`git checkout` restored the pulled versions in both repos. **No code change remains.** The user
confirmed the intended end-state ("likely to sell out will be backend-only and purely calculative")
but will decide when/how to implement it. Recorded here for traceability only.

> ### ⚠️ Operating principle (user directive, 2026-08-02)
> **Do not change any business logic without the user's explicit consent.** From here on, this
> initiative does REVIEW + TESTS (additive, non-behavioural) and **presents prioritized findings for
> approval BEFORE any fix is applied.** Tests document current behaviour; they do not change it.

### Code-review findings (trips) — triaged, NOT yet fixed (awaiting consent)

Full report: `scratchpad/trips-code-review.md`. **Root cause behind the worst ones:** `QueryClient`
runs `refetchOnWindowFocus: true` + `staleTime: 30s`, and `tripKeys.all = ['trips']` is a prefix of
every trip key — so forms that `reset(server)` inside a `[server]` effect get wiped by a sibling save
**or a plain alt-tab**, and `reset()` also flips `isDirty` false so the "unsaved changes" guard goes
silent. Same shape recurs in 6 places.

**A. Data-loss bugs (silent; fixing restores intended behaviour, no logic redesign)**
| # | Sev | File | Symptom |
|---|---|---|---|
| C1 | 🔴 | `trip-seo-tab.tsx:160-169` | Typed SEO meta title/description discarded on sibling save or window refocus; Continue advances "clean" |
| H1 | 🟠 | `step-pricing/step-schedule/step-reach.tsx`, `trip-advanced-section.tsx` | Same `reset(toDefaults(trip))`-on-`[trip]` wipes unsaved core-field edits when a sibling child list mutates |
| H3 | 🟠 | `trip-attributes-tab.tsx:69-84` | Attribute values mirrored into state via effect; window refocus overwrites typed values |
| H2 | 🟠 | `trip-images-tab.tsx:223-244` | Image reorder = per-row PATCH; one failure leaves server order scrambled while UI snaps back |
| M3 | 🟡 | `trips-table.tsx:146-176` | Bulk delete toasts success + clears selection before the fire-and-forget deletes resolve (false success) |
| M10 | 🟡 | `trip-schedules-tab.tsx:705-730` | Multi-row schedule create, no rollback; partial failure → resubmit hits duplicate-key |
| M9 | 🟡 | `trip-images-tab.tsx:700-709,358` | `ImageEditDialog` never resets `seededId` → reopen shows stale discarded edits |
| M8 | 🟡 | `trip-availability-calendar.tsx:954-989` | Single-day exception ops thread a `successMsg` that's never toasted (no feedback) |

**B. Correctness guards (small, low-risk)**
| # | Sev | File | Symptom |
|---|---|---|---|
| M7 | 🟡 | `step-review.tsx:449`, `step-reach.tsx:145,159` | `TIER_META[trip.tierKey].label` unguarded → crash if tier enum drifts. `?? TIER_META.standard` |
| M11 | 🟡 | `trip-seo-tab.tsx:36-42` | `truncate()` can exceed maxLength → zod-invalid default silently blocks Continue (no onInvalid) |
| M12 | 🟡 | `trip-date-changes.tsx:127` | Audit timestamps render in browser TZ while the gate uses island TZ (dispute surface) |
| L2/L3/L8/L10 | 🟢 | content/exclusions/images/calendar | index-as-key; stale `useState(props)`; `displayOrder` collision after deletes; null capacity chip |

**C. Quality — DRY/SOLID/composition (no behaviour change, but broad)**
| # | Sev | File | Note |
|---|---|---|---|
| M1/M2 | 🟡 | `hooks/trips/use-trips.ts` | ~40 copy-pasted mutation hooks; the duplication directly causes inconsistent detail-invalidation |
| M4 | 🟡 | `trip-row-actions.tsx` + `step-review.tsx` (925-line god-cmp) | Lifecycle handlers + reject/pause dialogs duplicated verbatim; extract `useTripLifecycle` |
| M5/M13 | 🟡 | list tabs, location editors | Hand-copied EN-translation lookup + coercion helpers drift; extract shared helpers |
| M6 | 🟡 | `query-keys.ts` + lifecycle mutations | `tripKeys.all` refetches every trips query (blast radius; amplifies H1) |
| C1(files) | 🟢 | `trip-availability-calendar.tsx` (1453 lines) | `DayPopover` 440-line god-component; extract add-slot panel |

Verified **correct** (no action): `update-payload` null/undefined clearing, `availability.ts` weekday
math, `derive-badge`/`signals` purity, sequential `commitCurrentStep` (two-writer-race guard),
`TierCard`/`LocationDetailsEditor` derived-state syncs, stable list keys, no unhandled rejections.

**Consent granted (2026-08-02):** user approved fixing groups A, B, and C. Applying test-first,
minimal, behaviour-preserving. Progress below.

---

### ✅ Fixes applied (Group B started)

**M7 — tier-map crash guard** 🟡 `types/tier.ts`, `step-review.tsx:466`, `step-reach.tsx:145`
- **What:** Added `tierMeta(key)` = `TIER_META[key] ?? TIER_META.standard` (+ exported `TierMeta`
  type). Replaced the raw `TIER_META[trip.tierKey]` index in the two wizard steps with it.
- **Why:** `trip.tierKey` is backend-supplied; a tier the enum doesn't know yet makes the raw index
  `undefined` and `.label` throws, crashing the whole step.
- **Why necessary:** the render must degrade, not blow up, on backend/enum drift. Fallback is the
  default tier, so the displayed value is sensible.
- **Scope note:** `trip-promotion-tab.tsx` also indexes `TIER_META` (lines 220/232/280/336) but was
  **left untouched** — it's outside M7's named sites and the user flagged the promotion tab as
  sensitive. Can guard it later with consent.
- 🧪 `types/tier.test.ts` (3 tests): known tiers, unknown-tier fallback, never-undefined. ✅

**M11 — SEO meta truncation could exceed maxLength and silently block Continue** 🟡
`lib/trips/seo.ts` (new), `trip-seo-tab.tsx`
- **What:** Extracted `truncateMeta(text, max)` and fixed the bound — reserve 3 chars for the
  ellipsis (`slice(0, max-3)`) so output is always `<= max`. Removed the inline `truncate`.
- **Why:** the old `slice(0, max-1)` + `'...'` produced up to `max+2` chars; that over-length string
  became the zod default (`.max(70)`/`.max(170)`), failed validation, and the submit had no
  `onInvalid` branch — so Continue silently refused with no message.
- **Why necessary:** the suggested default must satisfy its own schema, or the operator is stuck with
  no feedback.
- 🧪 `lib/trips/seo.test.ts` (5 tests): never exceeds max across limits/inputs incl. the
  no-word-boundary case, word-boundary cut, tiny-max safety. ✅

**Suite:** 51/51 green, `tsc` 0 errors. _(Group B remaining: M12 tz, L2/L3/L8/L10.)_

---

### ✅ Fixes applied (Group A — the data-loss pattern: C1 + H1 + H3)

**New shared hook:** `hooks/use-sync-form-when-pristine.ts` — `useSyncFormWhenPristine(reset, isDirty,
makeValues, key)`. Re-syncs an RHF form to server values when the record (`key`) changes, **but only
while pristine**. Keyed on the record object (identical trigger to the old `[trip]`/`[translation]`
effect); the dirty flag is read at run time (never a dep, so a post-save `true→false` transition
can't re-run reset with a stale record). 🧪 `hooks/use-sync-form-when-pristine.test.tsx` (4 tests):
first-render/edit-mode load populates ✓, pristine refetch re-syncs ✓, **dirty edit survives a refetch
✓**, post-save pristine re-syncs ✓.

**C1 🔴 — SEO meta panel discarded unsaved edits** `trip-seo-tab.tsx`
- **What:** replaced the `[translation]` reset effect with `useSyncFormWhenPristine(... translation)`.
- **Why/necessary:** a sibling tier/spotlight save or a 30s window-refocus refetched the translation
  and `reset()` wiped the in-progress meta title/description AND cleared `isDirty`, so the step read
  "clean" and Continue advanced without saving — reproducible silent data loss.

**H1 🟠 — core-field steps clobbered on sibling refetch** `step-pricing`, `step-schedule`,
`step-reach`, `trip-advanced-section`
- **What:** replaced each `useEffect(() => reset(toDefaults(trip)), [trip])` with the guarded hook.
- **Why/necessary:** sibling child-collection saves (age bands, highlights, schedules, tier…)
  invalidate trip detail; the refetch fired `reset()` over the operator's unsaved core-field edits.

**H3 🟠 — attributes tab clobbered on window focus** `trip-attributes-tab.tsx`
- **What:** non-RHF (`useState` mirror); added a `dirty` flag — re-seed from `current` only while
  pristine; `setVal` sets dirty; save `onSuccess` clears it so the refetch re-seeds from saved truth.

**Business-logic / create-edit safety:** zod schemas untouched; initial population preserved (the hook
resets when pristine — covered by tests 1–2); only the dirty-clobber is removed. **Verified:** `tsc`
0 errors (whole project), ESLint 0 errors on all changed files, **55/55** unit tests green.
_Scope kept tight per the "don't break tour create/edit/validation" directive._

---

### ✅ Fixes applied (Group A — batch-op safety, started)

**New shared helper:** `lib/async/settle-all.ts` — `settleAll(items, op)` runs all ops via
`Promise.allSettled` and returns `{ succeeded, failed }`. Never rejects. 🧪 `settle-all.test.ts`
(6 tests): all-success, partial-failure split, total-failure, no short-circuit, index passthrough,
empty list. ✅

**M3 🟡 — bulk delete reported success before anything settled** `trips-table.tsx`
- **What:** switched `useRemoveTrip` to `mutateAsync`, awaited the batch via `settleAll`, and now
  toast the real settled counts (`N deleted` / `N could not be deleted`) before clearing selection.
- **Why/necessary:** the old `forEach(fireAndForget)` + synchronous `toast.success(N)` +
  `clearSelection()` told operators deletions succeeded even on total server failure.

**H2 🟠 — image reorder silently corrupted server order on partial failure** `trip-images-tab.tsx`
- **What:** `commitOrder` now awaits the per-row PATCHes via `settleAll` (using `mutateAsync`); on any
  failure it drops the optimistic preview and toasts, letting the successful writes' cache
  invalidation + the existing `serverKey` effect reconcile the UI to the true persisted order.
- **Why/necessary:** the old code fired the PATCHes and, on one failure, reverted only the local
  preview — while already-succeeded rows had persisted, leaving a scrambled non-contiguous order the
  next refetch exposed. Happy path unchanged (each moved row still PATCHes its `displayOrder`).

**M9 🟡 — `ImageEditDialog` reopened with discarded edits** `trip-images-tab.tsx`
- **What:** reset `seededId = null` when the dialog closes (guarded render-time set, self-terminating).
- **Why/necessary:** the seed guard `image.id !== seededId` skipped re-seeding on reopen of the same
  image, so a cancelled edit reappeared instead of the server value.

**M10 🟡 — multi-row schedule create had no rollback / duplicated on resubmit** `trip-schedules-tab.tsx`
- **What:** replaced the nested `await` loop with `settleAll` over the weekday×startTime grid; all rows
  are attempted (no mid-abort), and a partial failure reports "N added, M could not be added — the
  added ones are saved" instead of aborting and leaving a resubmit to hit duplicate-key.
- **Why/necessary:** the sequential loop stopped at the first failure with earlier rows already created;
  resubmitting the whole grid then errored on the duplicates. Happy path (all succeed → reset+close)
  unchanged.

**M8 🟡 — single-day availability ops gave no feedback** `trip-availability-calendar.tsx`
- **What:** `write`/`reopen` now `toast.success(successMsg)` (the message was threaded but never shown).
- **Why/necessary:** closing a day, adding/closing/reopening a slot, reopening a day all completed
  silently, inconsistent with the range flow and schedules tab.

**Suite after Group A batch-ops:** 61/61 green, `tsc` 0 errors. New helper `lib/async/settle-all.ts`
(6 tests) reused by M3/H2/M10.

---

### ✅ Fixes applied (Group B — remaining guards)

**M12 🟡 — audit timestamps rendered in the viewer's timezone** `trip-date-changes.tsx`
- **What:** format `createdAt` via `Intl.DateTimeFormat({ timeZone })` (the island zone), same as the
  `todayKey`/Reopen gate above it. **Why:** on a dispute/audit surface the who/when line and the gate
  could disagree by a day near midnight.

**L4 🟢 — one in-flight undo greyed out every row** `trip-date-changes.tsx`
- `disabled={isPending}` → `disabled={isPending && removingId === x.id}` (scope to the acting row).

**L8 🟢 — new-image `displayOrder` collided after deletions** `trip-images-tab.tsx`
- **What:** new images now start at `max(existing displayOrder) + 1`, not `count`. **Why:** after a
  delete the max order can exceed count, so `count + index` collided with an existing row and the
  public `orderBy displayOrder asc` tie-broke arbitrarily.

**L10 🟢 — capacity chip could render literal "capacity"** `trip-availability-calendar.tsx`
- Guard the chip on `capacityException.capacity != null`.

**L3 🟢 — inline exclusion editor showed stale values after a refetch** `trip-exclusions-tab.tsx`
- Same dirty-guard as H3: re-seed from the record while pristine; setters mark dirty; save clears it.

**L2 — DEFERRED (not applied):** `LineListField` uses array-index keys (`step-content.tsx`). Fixing
needs a stable per-row id threaded through a list derived from a joined string — higher churn on a
**tour-create input list**, and only a focus/IME edge case (values already survive). Left for a
focused follow-up to honour the "don't break create/edit" guardrail. Documented, not forgotten.

**Group B suite:** 61/61 green, `tsc` 0 errors, ESLint 0 errors on all changed files.

---

### ✅ Fixes applied (Group C — safe helpers only, per user)

User chose "safe helpers now, defer the big structural refactors (M1/M2 factory, M4 god-component)."

**M5/M13 🟡 — duplicated coercion + EN-lookup helpers extracted** → `lib/trips/forms.ts`
- **What:** `numOrNull`/`numOrUndef`/`strOrNull` (were copied in the locations + pickup tabs) and
  `findEnglish(translations)` (hand-rolled in 7 places: features/highlights/inclusions/exclusions/
  locations/pickups tabs + `step-location`) now come from one module. Behaviour preserved **exactly**
  (same `Number(v)` with no finite check, same `.trim()` guards) — a de-duplication, not a change.
- 🧪 `lib/trips/forms.test.ts` (8 tests) pins the exact legacy behaviour, incl. the `Number('abc') → NaN`
  edge the tabs already produced.

**DEFERRED (not applied) — awaiting a focused pass to protect the create/edit/lifecycle surface:**
- **M6 (cache scope)** — narrowing `tripKeys.all` → subtrees is **perf-only**, and *under*-invalidating
  would leave the edit flow showing stale data (a correctness regression). Over-invalidation is safe.
  Deferred on second look rather than risk the guardrail.
- **M1/M2 (mutation-hook factory)** — touches every trip mutation; high churn.
- **M4 (split the 925-line `step-review` god-component + dedupe lifecycle dialogs)** — largest change,
  sits on publish/approve/reject. Needs its own pass with full create/edit re-verification.

**Final suite (Groups A+B+C-safe):** **69/69 green · `tsc` 0 errors · ESLint 0 errors.** Committed as
`70ff9d7` on `test/trips-review-hardening`.

---

## Deferred refactors (task #10) — now in progress

### ✅ M1/M2 — mutation-hook factory `hooks/trips/use-trip-mutation.ts`
- **What:** Added `useTripMutation(mutationFn, invalidate)` and migrated ALL ~40 trip mutation hooks
  to it, deleting the repeated `useQueryClient` + `useMutation` + `invalidateQueries` boilerplate.
  `use-trips.ts` went **1084 → 715 lines**.
- **Behaviour preserved EXACTLY:** each hook passes its own invalidation key list, transcribed verbatim
  from the original (shared `scheduleKeys`/`exceptionKeys` helpers where identical). The known M2
  inconsistencies (e.g. some `update*` hooks don't invalidate detail) were **kept as-is** — "fixing"
  them changes refetch behaviour and needs its own consent-gated change. `useConfirmAvailability`
  maps to no-invalidate.
- **Why necessary / safe:** the duplication was the root of M2's drift; a single factory makes the
  invalidation contract declarative. mutationFn signatures are unchanged, so every `.mutate` /
  `.mutateAsync` call site is untouched (tsc confirms).
- 🧪 `hooks/trips/use-trip-mutation.test.tsx` (3 tests): invalidates exactly the declared keys from
  variables, no invalidation on error, no-callback → no invalidation.
- **Verified:** `tsc` 0 errors, ESLint 0 errors, **72/72** tests.

### ◑ M4 — god-component split / dialog dedup (safe part done; rest scoped out)

Investigation finding: `trip-row-actions` and `step-review` were **near-verbatim but not identical** —
their pause title/description and every lifecycle toast string have quietly diverged. So "unifying"
them the way the review suggested would silently rewrite user-facing copy in one surface, which the
guardrail forbids. M4 was therefore scoped to the piece that dedupes **without** changing copy.

**✅ Shared `RejectChangesDialog`** `components/trips/lifecycle/reject-changes-dialog.tsx`
- **What:** Extracted the reject-with-required-note dialog (duplicated in both files). It owns the note
  text + the `>= 5`-char gate (`MIN_REJECT_NOTE`); the **success toast is passed via `onConfirm`** so
  each surface keeps its own wording (row-actions: "…notified in their dashboard."; review: "…sees your
  note."). Migrated both consumers; removed their `rejectNote` state + `Dialog`/`Textarea` imports.
  step-review 940→901 lines, trip-row-actions 459→422.
- **One cosmetic change (disclosed):** the shared title uses typographic quotes
  (`Request changes on "…"?`); row-actions previously used straight quotes there. 2-char visual only.
- 🧪 `reject-changes-dialog.test.tsx` (5 tests, first Radix-render tests): title shows the name, the
  `>= 5` gate incl. whitespace-only, trimmed-note callback, pending disables both buttons, reset on close.

**Scoped OUT of M4 (documented, not done):**
- **Pause `AlertDialog`** — its title ("Pause \"{name}\"?" vs "Pause this tour?") and description
  differ between the two surfaces; a shared component would change user-facing copy. Left as-is.
- **`useTripLifecycle` hook** — would only bundle the 7 mutation declarations; the handlers/toasts
  differ per surface, so the net dedup is small and the migration touches every call site. Low value.
- **Summary-grid split** — step-review's readiness/summary block is tightly coupled to the wizard
  context (`goTo`/`revealSection`), `CheckRow`, and motion; a safe extraction needs its own
  component tests first. Best done as a dedicated pass.

### ⏸ L2 — kept deferred after analysis (LineListField stable keys)
`LineListField` (`step-content.tsx`) is intentionally **stateless** — rows are derived from the
newline-joined string each render, which is exactly why values survive. Adding stable per-row ids means
converting it to a stateful `{id,text}[]` model that syncs back to the parent string on every keystroke,
which reintroduces the external-sync/clobber risk we just removed — on a **tour-create input**, for a
LOW-severity focus/IME edge case. Risk/reward is poor under the "don't break create/edit" guardrail, so
it stays deferred. (The wrong-DOM-node reuse is real but cosmetic; values are never lost.)
