# Phase 1 - Audit Report

> Findings only. No fixes. Fixes are specified in `02` through `06`.
> Every finding is grounded in `00-DISCOVERY-INVENTORY.md`.

---

## The one-paragraph version

The dashboard is **functionally complete and architecturally inverted**. Its API boundary is already clean (two separate fetch stacks, no public-site imports of dashboard code), so extraction is a smaller job than it looks: roughly **8 import statements and 4 shared files** stand between this codebase and a standalone app. The real problem is elsewhere. **161 of 207 files are `'use client'`**, which means the App Router is being used as a static file server for a client-side SPA. That single fact produces most of what reads as "bloat": no server boundary means no data on first paint, which means every screen is a skeleton, which means density was chased by shrinking type to 10-12px, and complexity was managed by adding tabs (13 on the tour editor) rather than by deferring work to the server. The 7-locale workflow is the most expensive symptom: **300+ clicks and ~120 save requests to translate one tour**, because translation was implemented as a per-locale form inside every module instead of as a system. None of this is a functional defect. All of it is a throughput defect.

---

## Severity and ranking

**Severity**: `S1` breaks correctness or blocks the split · `S2` materially costs operator throughput or engineering velocity · `S3` inconsistency and polish.

**Impact vs Effort**: both on a 1-5 scale. `Ratio` = Impact / Effort. Ranked by ratio within each section.

---

## A. Architecture and coupling

### A-1 · S1 · The dashboard is a client SPA wearing an App Router costume
**Impact 5 · Effort 4 · Ratio 1.3**

161 of 207 dashboard files (77.8%) are `'use client'`. All 28 trips components are. Every list and edit route is a thin server shim that immediately hands off to a `*-view` client component; **no dashboard page fetches entity data in a server component.** All data arrives client-side via TanStack Query after hydration.

Consequences, all downstream of this one cause:
- First paint is always a skeleton. There is no server-rendered content on any screen.
- The whole tour editor - 13 tabs, ~10,363 LOC - is in one client boundary. Selecting a tab does not fetch a route; it reveals code that already shipped.
- `trip-detail-shell.tsx` is marked `'use client'` while containing **zero hooks, zero handlers, zero interactivity** (a Breadcrumb, an `<h1>`, a `<Skeleton>`, `{children}`). The directive is inert because a client parent imports it.
- `QueryClientProvider` is mounted in the **root** layout, so the public site pays for it too.

This is the root cause of most of section C and all of section F. It is ranked first despite a mediocre ratio because nothing else in this document can be fixed properly while it holds.

### A-2 · S1 · Six imports and one type-import are the entire hard blocker
**Impact 5 · Effort 1 · Ratio 5.0**

The dashboard reaches into the public site in exactly 7 places: `TourBadgeChip` from `@/components/frontend/tour-badge` in 6 files, and two `import type` lines in `lib/tours/listing.ts:5-6` pointing at `components/frontend/tour-card` and `tour-badge`.

That is the whole thing. The good news is the headline of this audit: **there is no deep entanglement.** The public site imports zero dashboard code.

### A-3 · S1 · Three files serve both trees and must be split, not moved
**Impact 5 · Effort 2 · Ratio 2.5**

| File | Why it blocks |
|---|---|
| `app/layout.tsx` | One root layout for both trees. Its `metadata.title` is `'Island Tours - Admin'` while it also renders the public storefront. Declares 5 fonts and mounts 4 providers for both. |
| `app/globals.css` | 276 lines for both trees. Line 4 imports the public token file. Contains dashboard-only rules (`[data-slot='sidebar']`, `.tox-*`). |
| `proxy.ts` | One middleware containing `guardDashboard()` **and** the entire public i18n redirect scheme. |

These cannot be copied wholesale into the new repo; each needs a dashboard-only rewrite. They are the only three files in that category.

### A-4 · S2 · `lib/tours/listing.ts` is two modules in one file
**Impact 3 · Effort 1 · Ratio 3.0**

Self-described as "pure mappers ... consumed by `TourCard`", imported by 9 public files. But `deriveTourBadge`'s own docstring says it exists because "Admin tour rows don't carry a server-derived badge, so the dashboard derives it", and `formatTourSignals` is "Shared by the Collection, Our Picks and Comparison tour selectors" - all three are dashboard surfaces. The file knows it is two modules. It was never split.

### A-5 · S2 · The dashboard-to-public cache bridge has no post-split story
**Impact 4 · Effort 3 · Ratio 1.3**

`lib/api/fetch.ts:7,64` -> `cache-revalidation.ts` -> `app/_actions/revalidate.ts` -> `updateTag()`. Today this works because the dashboard and the public site are **the same Next.js process**, so a Server Action in one can invalidate the other's `'use cache'` entries.

**After the split this silently stops working.** `updateTag` only affects the calling app's cache. There is no error - the dashboard keeps firing the action, the public site keeps serving stale content, and nobody notices until a customer does.

This is the single most dangerous item in the extraction, because it is a **silent** regression that no import graph, type check, or build will catch. Resolution is specified in `02-EXTRACTION-SPEC.md` §6.

### A-6 · S3 · `components/` root is an unsorted drawer
**Impact 2 · Effort 1 · Ratio 2.0**

`app-sidebar`, `site-header`, `nav-main`, `nav-user`, `nav-documents`, `nav-secondary`, `data-table`, `section-cards`, `chart-area-interactive`, `mode-toggle` are dashboard-only by usage but sit at `components/` root beside `smooth-scroll.tsx` (public). `components/skelitons/` mixes both trees' skeletons in one directory. `site-header.tsx` reaches back down into `@/components/dashboard/*`.

Ownership is real but undocumented, so the split has to be derived by grep rather than read off the tree.

---

## B. Correctness defects

### B-1 · S1 · `PATCH /settings/site` never busts the public cache **[VERIFIED]**
**Impact 4 · Effort 1 · Ratio 4.0**

`lib/api/cache-revalidation.ts` declares `case 'settings'` twice - `:142` (pushes `user-profile`, `break`) and `:150` (pushes `site-info` when `seg1 === 'site'`). The first match wins, so `:150-152` is unreachable.

`lib/api/public/settings.ts:37-39` tags `getPublicSiteInfo` with `cacheTag('site-info')` + `cacheLife('days')`. So an admin saving Settings -> General (logo, WhatsApp number, Instagram - read by the footer and every NeedHelp surface) sees the change nowhere on the live site for up to the `days` window.

The comment at `revalidate.ts:23-25` describes exactly this scenario as the thing that must not happen. The code directly beneath it does it.

This is a live production bug independent of the redesign.

### B-2 · S2 · `statistics.tsx` forces mock chart branches on
**Impact 3 · Effort 1 · Ratio 3.0**

Lines 408 and 516: `|| true ? ( // Forced true for mock visualization`. Line 81: "Generate mock historical data based on current values". This ships.

### B-3 · S2 · The dashboard home is entirely fictional
**Impact 3 · Effort 1 · Ratio 3.0**

`app/_actions/dashboardActions.ts` `getDashboardStats()` is a hardcoded object literal with no backend call: `totalRevenue: 125000.50`, `bookings.total: 1240`, `recentBookings` containing `'John Doe'` booking `'Bali Adventure'` (a tour in a product that sells Caribbean tours), `alice@example.com`. It is live-wired into `page.tsx:1,18,22`.

The **first screen every operator and admin sees after login is fake data**. Noted in memory as an intentional placeholder pending a real API, which is a reasonable decision - but it means the dashboard's home has no design worth auditing and no contract to design against.

### B-4 · S3 · `ui/sidebar.tsx:478` renders invalid CSS
**Impact 1 · Effort 1 · Ratio 1.0**

`shadow-[0_0_0_1px_hsl(var(--sidebar-border))]` - the tokens are authored `oklch(...)`, so `hsl()` receives a color string, not the H/S/L triplet it expects. Invalid, drops silently, both modes. Stock shadcn assumes HSL-triplet tokens; this project uses oklch.

### B-5 · S3 · Three token declarations are inert or self-referential
**Impact 1 · Effort 1 · Ratio 1.0**

- `--shadow-2xl: var(--shadow-2xl)` (`globals.css:229`) - self-referential, no source
- `--tracking-normal: var(--tracking-normal)` (`:230`) - same, yet applied to `body` at `:21`
- `--destructive-foreground` mapped at `:248`, never defined - `text-destructive-foreground` resolves to nothing

### B-6 · S3 · Business logic in a columns file
**Impact 2 · Effort 1 · Ratio 2.0**

`refundDue()` and `paymentModelLabel()` are exported from `booking-columns.tsx` and imported by `booking-row-actions.tsx` and `booking-details-dialog.tsx`. Refund eligibility is money logic living in a table's column definitions.

### B-7 · S2 · Collections has full CRUD and zero RBAC gating
**Impact 3 · Effort 1 · Ratio 3.0**

`components/dashboard/collections/` has no `useRole` import anywhere, despite a 594-line create/edit form, a tours manager, and delete. Every other entity module gates. The backend presumably enforces, so this is not an exploit - it is an operator seeing buttons that will 403.

Related: two gating idioms are mixed throughout - capability checks `can('X')` and raw `role === 'ADMIN'` equality - **inside the same file** at `destination-row-actions.tsx:134` vs `:146`, and at `bookings-table.tsx:110`.

---

## C. UX findings, ranked by operator impact

### C-1 · S1 · The 7-locale workflow costs 300+ clicks per tour
**Impact 5 · Effort 4 · Ratio 1.3 · The single largest source of bloat**

Translating one tour into the 6 non-English locales, for a realistic tour (5 highlights, 5 inclusions, 3 exclusions, 4 itinerary stops, 2 pickups):

| Surface | Structure | Saves |
|---|---|---|
| Translations tab | 7 locale tabs x 13 fields | 6 |
| Highlights | `TranslationRow` x 6 locales x 5 rows, each its own form + save | 30 |
| Inclusions | same x 5 rows | 30 |
| Exclusions | same x 3 rows | 18 |
| Info & Terms | same x N rows | N x 6 |
| Itinerary | `DualTranslationRow` x 6 x 4 stops | 24 |
| Pickups | `DualTranslationRow` x 6 x 2 | 12 |
| SEO | 7 locale tabs x 1 | 6 |

**~120 discrete save requests. 300+ clicks. Across 7 tabs.** Each child row must be expanded before its translation panel appears. There is no progress indicator, no completeness view, and no way to answer "which locales is this tour done in?" without clicking through all of them.

Three aggravating factors:

1. **The source text is never on screen.** The German tab renders 13 empty inputs with placeholder "Overview in German". The English text it is a translation *of* appears nowhere on that tab. The operator must memorize it or keep the EN tab open in a second window.
2. **No machine translation exists**, despite `isMachineTranslated` threading through the entire type layer (14 occurrences in `types/trip.ts`), being settable on the upsert payload (`types/trip.ts:664`), and rendering a "Machine Translated" badge in 6 components. The flag is read-only in practice. `grep -E "autoTranslate|translateAll|deepl|openai"` returns zero. The data model is ready for a feature the UI never built. (`CLAUDE.md` lists AI translation as planned BullMQ work, so the backend anticipates it.)
3. **The pattern is duplicated 5 times, not shared.** There is no shared `LocaleTab`. `destination-translation-form.tsx` and `category-translation-form.tsx` are 272 lines each and **identical except for mechanical renames** - the entire diff is ~30 lines, of which one is a copy string ("destination page" -> "category page").

This is not a screen problem. It is a missing system.

### C-2 · S1 · The tour editor has 13 flat tabs and no save model
**Impact 5 · Effort 4 · Ratio 1.3**

`trip-edit-view.tsx` renders a single flat `<Tabs>` with 13 triggers. The tabs **are** grouped - but only in source comments (`:77-94`, `:358`, `:375`, `:401`). The operator sees 13 peers.

**No tab is gated or disabled.** A brand-new DRAFT tour with no price offers a fully interactive SEO tab.

**There is no global save and no autosave.** Every tab submits independently, and most contain several save buttons:
- Details has **two buttons calling the same handler** (`:863` and `:1051`, the second buried inside a collapsible)
- Pricing has **three independent forms** plus per-row saves
- Schedules has three sections, all immediate-per-action
- Attributes is the **only** true bulk save in the module

The operator has no model for "am I saved?" because the answer differs per tab, and sometimes per row within a tab.

**Tab state is not URL-synced.** `?tab=` is read once and passed as `defaultValue` to an uncontrolled `<Tabs>` (`:325`). Switching tabs does not update the URL. Tabs are not linkable or bookmarkable, and **browser back exits the editor** rather than returning to the previous tab. Row actions deep-link to 6 of 13 tabs, which makes the inconsistency more visible, not less.

### C-3 · S1 · Publish readiness is advisory, incomplete, and lies by omission
**Impact 4 · Effort 2 · Ratio 2.0**

The DRAFT readiness card (`trip-edit-view.tsx:302-322`) lists 5 checks: 5 images, hero set, 3 highlights, EN overview, price set.

- **The Publish button is always enabled regardless.** The checks are decoration; the backend rejects.
- **Satisfying all 5 does not list the tour.** It also needs schedules and capacity - surfaced *only afterward*, via a "Published, not yet listed" banner (`:284-299`). That is a 6th requirement the readiness card does not mention.

So the operator's model is: satisfy 5 checks, press Publish, succeed, and then discover the tour is invisible for a reason nobody told them about. The readiness card is the right idea implemented as a hint instead of a contract.

### C-4 · S2 · Create asks 30 questions to collect 4 answers
**Impact 4 · Effort 2 · Ratio 2.0**

`trip-form.tsx` (704 lines) renders ~30 fields in one form with one submit. **Four are required**: `name`, `slug` (auto-derived), `destinationId`, `categoryIds`.

The form knows this. Line 689-693 tells the operator: *"Pickup, party size, booking cutoff, meeting point, audience and accessibility are optional - add them any time after creating the trip, from its Details tab."* It then renders all of them anyway.

On submit, the operator lands on a 13-tab editor showing 5 unmet checks. The create form's entire job was to collect 4 fields and it made that the operator's problem.

Worse: `trip-form.tsx` and `trip-details-tab.tsx` are near-identical field-for-field - the same `toSlug`, the same ~30-field schema, the same `CANCELLATION_VALUES`, the same conditional ON_ARRIVAL block, with parallel payload builders (`:237-284` vs `:412-455`). **1,764 lines maintaining one form twice.**

### C-5 · S2 · Ordering is exposed as raw database columns
**Impact 3 · Effort 2 · Ratio 1.5**

**No drag-and-drop exists anywhere in the dashboard**, despite `@dnd-kit/core`, `/sortable`, `/modifiers`, and `/utilities` all being dependencies. They are used by exactly one file: the dead 813-line `data-table.tsx`.

Instead:
- Images reorder via **up/down arrow buttons**, firing **2 PATCHes per click** (`trip-images-tab.tsx:155-184`)
- Highlights, inclusions, exclusions, features, itinerary stops and pickups expose a raw numeric **`displayOrder` input** - including in add-forms, pre-seeded to `String(count)`

The operator is hand-editing sort keys. That is a database concept on a screen.

### C-6 · S2 · Saving a weekly schedule fires 21 sequential requests
**Impact 3 · Effort 2 · Ratio 1.5**

`trip-schedules-tab.tsx:464-477` loops `weekdays x startTimes`, awaiting one POST per pair. Seven days at three start times = **21 sequential round-trips** behind one button, with no batching, no progress, and no partial-failure story. If #14 fails, the operator has 13 schedules and an error toast.

### C-7 · S2 · Zero slide-overs; 21 modals
**Impact 3 · Effort 2 · Ratio 1.5**

`components/ui/sheet.tsx` and `components/ui/drawer.tsx` are both installed. **Neither is used anywhere.** All secondary disclosure is a centered modal (21 sites) or a full page navigation.

Consequences: `media/media-selector.tsx` is a `Dialog` styled `inset-0 w-screen h-screen` borderless and `rounded-none` - **a dialog cosplaying as a route** because the right primitive was never adopted. Booking details is a read-only `max-w-lg` Dialog rendering ~15 label/value pairs, which is a slide-over's job.

Also: `Dialog` and `AlertDialog` are both used for semantically identical destructive confirms.

### C-8 · S2 · Media caps at 100 items with no pagination
**Impact 3 · Effort 2 · Ratio 1.5**

`useMediaList('limit=100&page=1')` is hardcoded. No pagination, no infinite scroll. **Item 101 is unreachable through the UI.**

Beyond the cap: no folders, no tags, no albums (the only `folder` reference is a hardcoded `folder='users/media'` server destination at `media-gallery.tsx:275`, not user-facing). Search is a client-side substring match on filename only. No type filter, no date filter, no size filter, no sort. Bulk actions are delete-only.

For a marketplace where every tour needs 5+ images across dozens of tours, a flat unpaginated 100-item list with filename-only search is a hard operational ceiling.

### C-9 · S2 · Payments is a dead end
**Impact 3 · Effort 2 · Ratio 1.5**

No actions column, no row-actions file, no detail view, no status transitions. It is a read-only list - **the only money-touching module with no drill-in** - while its sibling Bookings, sharing the same `types/booking` data shape, has a details dialog and a cancel action.

Bookings itself exposes exactly one transition: `CANCELLABLE = ['ON_HOLD','PENDING','CONFIRMED'] -> CANCELLED`. No confirm, no hold, no refund.

### C-10 · S2 · Four modules are stubs sitting in production navigation
**Impact 2 · Effort 1 · Ratio 2.0**

`reviews`, `users`, `leads`, `enquiries` are static JSX with no data layer and no components directory. They are reachable from the sidebar. An operator clicking "Reviews" gets a heading and a sentence.

`leads` and `enquiries` are additionally **vestigial by contradiction**: `CLAUDE.md` states travelers "book instantly - no enquiry model."

### C-11 · S3 · Density was achieved by shrinking type
**Impact 3 · Effort 3 · Ratio 1.0**

`text-xs` is **64.0%** of all font-size classes (688 of 1,075). With `text-sm`, that is **91.3%**. `text-base` appears 7 times; `text-xl` once.

On top of that, 55 arbitrary `text-[...]` values, led by `text-[10px]` (x23).

This is not a density strategy. It is the absence of one: when there is no system for information hierarchy, every new element gets `text-xs` because it fits. See D-2 and E-1.

### C-12 · S3 · Tour operators renders a tab bar for one tab
**Impact 1 · Effort 1 · Ratio 1.0**

`operator-sub-nav.tsx` uses `DashboardTabNav` (link-based sub-routes) - a different navigation primitive from the four entity editors (in-page shadcn `Tabs`) - to wrap **a single tab labeled "Details"**.

---

## D. Design system findings

### D-1 · S2 · The badge primitive was stripped, so 149 status colors are hand-rolled
**Impact 4 · Effort 2 · Ratio 2.0 · The highest-leverage design fix**

`badge.tsx` was de-chromed to `rounded-none border-0 bg-transparent px-0 py-0` - every badge is bare uppercase text at `text-[0.625rem]` with no pill, no background, no semantic color.

The consequence is mechanical and measurable. Because the primitive carries no meaning, **every call site invents its own**: 187 numeric Tailwind palette classes across 30 files, of which **149 duplicate what `--success`/`--warning`/`--destructive`/`--info` already define as tokens**.

Distribution: amber 67, emerald 35, gray 26, red 20, green 15, rose 7, slate 5, sky 5, violet 4, neutral 2, blue 1. (`components.json` declares `"baseColor": "zinc"`. Zinc: **0 occurrences.**)

And it produced **four incompatible status-badge conventions**:

| File | Shape |
|---|---|
| `booking-columns.tsx:20,33,43` | `statusVariant` + `statusDot` + `statusLabel` |
| `payment-columns.tsx:10,23` | `statusVariant` + `statusLabel` |
| `spotlight-columns.tsx:47` | `statusStyles` |
| `destination-columns.tsx:89` | inline ternary |

One missing primitive cost 149 hardcoded colors, 4 conventions, and the entire dark-mode gap in D-4.

### D-2 · S2 · 59 distinct spacing values
**Impact 3 · Effort 2 · Ratio 1.5**

Across 1,298 occurrences: 13 distinct `gap-`, 11 `p-`, 11 `px-`, 14 `py-`, 10 `space-y-`. Half-steps (`0.5`/`1.5`/`2.5`) account for 143. Long-tail singletons: `gap-5`, `gap-10`, `p-12`, `py-8`, `py-5`, `py-10`, `space-y-0`.

There are **no spacing tokens** in `globals.css` and `--spacing-*` is not mapped in `@theme inline`. Nothing constrains the choice, so every component picked its own.

### D-3 · S2 · The radius scale spans 5 pixels and is mostly bypassed
**Impact 2 · Effort 1 · Ratio 2.0**

`@theme inline` defines radius as a 1px ladder: `sm = calc(var(--radius) - 1px)` through `2xl = calc(var(--radius) + 4px)`. With `--radius: 0.3rem`, the entire `sm`->`2xl` range is **0.2rem to 0.55rem**. `rounded-sm` and `rounded-2xl` are visually indistinguishable, so the scale cannot express hierarchy.

Predictably it is ignored: `rounded-none` is the most-used radius class (82), ahead of `rounded-full` (44) and `rounded-md` (23).

Separately: **`--radius` changes with the color theme** - `0.3rem` in `:root`, `0.2rem` in `.dark`. Corner radius is not a function of light or dark. Toggling the theme silently reshapes every component.

### D-4 · S2 · Dark mode is substantially broken
**Impact 3 · Effort 3 · Ratio 1.0**

- **80 of 110 palette-class lines (72.7%) have no `dark:` variant.** The dominant pattern is a `-50`/`-100` background with `-700`/`-800` text (status badges in `*-columns.tsx`, alert panels in `trip-*-tab.tsx`). Under `.dark` these keep their light backgrounds while inheriting `--foreground: oklch(0.98 0 0)` - **near-white text on near-white backgrounds**.
- `dashbaord-wraper.tsx:45` hardcodes `bg-[#f1f4fa]` with no dark override **on the outermost dashboard container**. Lines 57 and 65 of the same file handle dark correctly, so this is an inconsistency inside a single 88-line file.
- `--chart-1..5` are **identical in both modes**, and all five are purple-family. Tuned for a white canvas, rendered unchanged against `oklch(14% 0.02 260)`. `--chart-5` (L=0.4509) and `--chart-1` (L=0.5417) are the failures.
- `--success`/`--warning`/`--info` base values are identical in both modes; only their `-foreground` pairs flip.
- The 5 `text-[#1a0dab]` SERP-preview literals sit on light-only cards.

Dark mode is wired (`next-themes`, a `mode-toggle` in the header) and shipped. It is not usable.

### D-5 · S3 · The neutral ramp changes hue between modes
**Impact 2 · Effort 2 · Ratio 1.0**

Light neutrals sit on **hue 80** (warm). Dark neutrals sit on **hue 260** (cool). This is not a lightness inversion of one ramp; it is two unrelated ramps sharing token names. Any color reasoning that holds in light mode does not transfer.

Notation is mixed within the same file: `oklch(0.99 0.004 80)` beside `oklch(19.382% 0.11977 267.676)`.

### D-6 · S3 · Five fonts load on every route; two are effectively unused
**Impact 2 · Effort 1 · Ratio 2.0**

All five families are attached to `<html>` in the root layout, so **the public site pays for the dashboard's fonts and vice versa**.

| Font | Dashboard usages |
|---|---|
| Playfair Display | 70 |
| JetBrains Mono | 21 |
| General Sans (local woff2) | **3** |
| Noto Sans | 2 explicit + body default |
| DM Sans | **1** |

A local variable woff2 (plus its italic) is downloaded for 3 usages. DM Sans for 1.

Separately: Playfair Display is a high-contrast display serif designed for editorial headlines. It is the dashboard's most-used explicit font (70 uses) in an operational CRM.

### D-7 · S3 · Two icon libraries
**Impact 2 · Effort 1 · Ratio 2.0**

`lucide-react` in 105 dashboard files; `@hugeicons/react` + `@hugeicons/core-free-icons` in 14. `components.json` declares `"iconLibrary": "lucide"`.

7 of the 14 hugeicons files are the `media/` module - it is a de-facto module convention, which is how a second icon library becomes permanent. Notably `user-profile-dropdown.tsx` and `statistics.tsx` are simultaneously the #1 and #2 palette-class offenders **and** hugeicons users: the same two files diverge on both axes.

### D-8 · S3 · The button primitive shouts
**Impact 2 · Effort 2 · Ratio 1.0**

`button.tsx` forces `text-xs font-semibold tracking-widest uppercase` on **every button in the product**. This is a documented rule (`DASHBOARD-PATTERNS.md` §6), so it is intentional - but it is worth naming as a finding because uppercase + wide tracking at 12px measurably reduces reading speed, is harder for dyslexic readers, and interacts badly with the 6 non-English locales that operators' own content lives in.

Same file: `destructive` is reworked from a solid fill to a tinted `bg-destructive/10 text-destructive`, which reads as a secondary action rather than a dangerous one.

---

## E. Accessibility

> **Scope caveat, stated plainly:** no axe run, no keyboard-navigation sweep, no screen-reader pass, and no focus-order audit was performed in Phase 0. Everything below is evidenced by static analysis. **This section is not a WCAG audit and must not be cited as one.** A real audit is scoped as a Phase-1 gap in `06-IMPLEMENTATION-PLAN.md`.

### E-1 · S2 · Type sizes fall below usable minimums at scale
**Impact 4 · Effort 3 · Ratio 1.3**

`text-xs` (12px) is 64% of all font-size classes. `text-[10px]` appears **23 times**, `text-[11px]` 6 times, `text-[0.625rem]` (10px) once - and that last one is inside `badge.tsx`, so it applies to all 43 badge usages.

WCAG has no absolute minimum font size, so this is not a spec violation on its own. It is a usability finding: 10px is below the threshold at which most users can read comfortably, and this is a tool operators sit in all day.

### E-2 · S2 · Status is communicated by color alone
**Impact 3 · Effort 2 · Ratio 1.5**

Because `badge.tsx` renders bare text with no shape or background, status distinction in every table rests on `text-emerald-700` vs `text-amber-700` vs `text-red-700`. `booking-columns.tsx` does add a `statusDot` - which is also color-only.

WCAG 1.4.1 (Use of Color, Level A) requires that color not be the sole means of conveying information. A red/green deficit reader cannot distinguish a confirmed booking from a cancelled one in the bookings table.

### E-3 · S2 · Dark mode contrast failures are near-certain
**Impact 3 · Effort 3 · Ratio 1.0**

Per D-4: 80 light-only palette lines putting `-700`/`-800` text on `-50`/`-100` backgrounds that persist under `.dark` while foreground inherits `oklch(0.98 0 0)`. The chart ramp is unchanged across modes with two entries below L=0.55 on an L=0.14 canvas.

These need measurement, not assumption - but the mechanism is deterministic and the failures are predictable.

### E-4 · S3 · Uppercase + `tracking-widest` on 100% of buttons
**Impact 2 · Effort 2 · Ratio 1.0**

See D-8. Flagged here because it is a readability finding as well as a design one.

---

## F. Performance

> No `@next/bundle-analyzer` run was performed. Client-component counts and dead-code LOC are proxies, not measurements. Ranked by confidence in the mechanism, not by measured milliseconds.

### F-1 · S1 · 77.8% client components means no server rendering
**Impact 5 · Effort 4 · Ratio 1.3**

See A-1. Every screen ships its full interactive tree to the browser and fetches data after hydration. The 13-tab tour editor (~10,363 LOC) is one client boundary: all 13 tabs' code ships whether or not the operator opens them.

### F-2 · S2 · >1,574 LOC of confirmed dead code in the graph
**Impact 3 · Effort 1 · Ratio 3.0**

| File | LOC | Note |
|---|---|---|
| `components/data-table.tsx` | 813 | 0 importers repo-wide. The stock shadcn dashboard-01 demo: TanStack + `@dnd-kit` + Drawer + Recharts + a hardcoded `z` schema. Sole importer of `ui/drawer.tsx`. |
| `components/dashboard/trips/trip-content-tab.tsx` | 255 | 0 importers |
| `common/image-upload-selector.tsx` | 235 | 0 external importers; superseded by `media/image-selector-field.tsx` |
| `components/dashboard/trips/trip-languages-tab.tsx` | 205 | 0 importers; inlined into `trip-details-tab.tsx:65-197` instead |
| `locals-favourites-list-view.tsx` | 66 | probable orphan |
| `components/section-cards.tsx` | - | 0 importers |
| `components/chart-area-interactive.tsx` | - | 0 importers; sole importer of `ui/toggle-group.tsx` |

The irony worth naming: `data-table.tsx` is a **generic table abstraction that all 10 real tables ignored**, each hand-rolling `useReactTable` + `flexRender` + toolbar + pagination instead. The abstraction existed. Nobody adopted it. Then it kept 813 lines and two ui primitives alive in the dependency graph.

### F-3 · S2 · 149 unused CSS custom properties on `:root` of every dashboard page
**Impact 2 · Effort 1 · Ratio 2.0**

`app/globals.css:4` imports `(frontend)/frontend-tokens.css` - 524 lines, 149 `--it-*` tokens - into the root stylesheet that both trees load. The imported file's own header says "Scope: (frontend) routes only / Import in (frontend)/layout.tsx - never in (dashboard) routes."

`app/(frontend)/layout.tsx` does not import it. So the file is loaded *only* the way it documents it must not be.

Mitigating: the leak is **definition-only**. `grep --it-` across all dashboard paths returns **0 references**. It costs payload and `:root` namespace, not correctness.

### F-4 · S2 · Request fan-out on common operations
**Impact 3 · Effort 2 · Ratio 1.5**

| Operation | Requests |
|---|---|
| Save a 7-day x 3-time schedule | **21 sequential POSTs** |
| Reorder one image | 2 PATCHes per arrow click |
| Add 5 images | 5 POSTs (one per image in a `forEach`) |
| Add/remove one start time | full `PATCH /tours/:id` rewriting the `startTimes` array |
| Translate one tour to 6 locales | **~120 saves** |

### F-5 · S3 · Global `refetchOnWindowFocus: true` with `staleTime: 30_000`
**Impact 2 · Effort 1 · Ratio 2.0**

Set in the root-mounted `QueryProvider`. Every alt-tab back into a dashboard tab older than 30 seconds refetches every mounted query on the screen. On the trips list plus its filters, that is a burst - against a backend with a documented per-IP throttle that `apiFetch` already has bespoke 429 retry logic to absorb (`lib/api/fetch.ts:15-25`).

The retry logic is treating a symptom the cache config creates.

### F-6 · S3 · Fonts
**Impact 2 · Effort 1 · Ratio 2.0**

See D-6. Five families on `<html>`, cross-charged between both apps.

---

## G. Code quality and duplication

### G-1 · S2 · ~4,300 LOC of near-mechanical duplication
**Impact 4 · Effort 3 · Ratio 1.3**

Measured by `diff`, not estimated:

| Cluster | Files | LOC | Evidence |
|---|---|---|---|
| Translation forms | 4 | ~1,145 | dest(272) vs cat(272): diff = **~30 lines, all renames** |
| SEO tabs | 4 | ~1,448 | dest(362) vs cat(366) = 139; vs hub(361) = 133; vs coll(359) = 137. All four within 7 lines of each other in length |
| `trip-form` vs `trip-details-tab` | 2 | 1,764 | near-identical field-for-field |
| Table scaffolds | 10 | - | dest(352) vs cat(332) = 138; vs hubs(361) = 202 |
| Row actions | 3+ | - | dest(185) vs cat(185) = 139 |
| Quick-edit dialogs | 3 | 422 | dest(142) vs cat(142) = 64 |
| Detail shells | 4 | ~200 | dest(51) vs cat(50) = 32 |
| List-view shells | 4+ | - | dest vs cat = 18; bookings vs payments = the same 500ms-debounce state machine written twice |

A shared `LocaleTab` is roughly one 280-line file. It would replace ~1,145.

### G-2 · S2 · Four competing delete-confirm abstractions
**Impact 3 · Effort 1 · Ratio 3.0**

1. `confirm-dialog.tsx` (72) - docstring: *"Reusable confirmation dialog for any potentially-destructive dashboard action."* Actual consumers: **2**.
2. `common/deactivate-dialog.tsx` (70)
3. `common/force-delete-dialog.tsx` (76)
4. `media/delete-confirmation-dialog.tsx` (55) - a private fork

Above #2 sit four wrappers that are themselves clones: `destination-` / `category-` / `hub-delete-dialog.tsx` are **all 47 lines with a mutual diff of 44** (only the entity noun differs), plus `operator-delete-dialog.tsx` (52). Each re-wraps `DeactivateDialog`, re-does the same toast pair, re-declares the same props interface, and re-duplicates the long `preservationNote` prose.

`Dialog` and `AlertDialog` are both used for semantically identical destructive confirms.

This is the clearest instance of the codebase's central pattern: **a correct shared abstraction exists, and the modules forked around it anyway.**

### G-3 · S2 · Three pagination strategies, three search implementations
**Impact 3 · Effort 2 · Ratio 1.5**

Pagination: server-driven `manualPagination` (6 tables), client-side `getPaginationRowModel()` (collections, attributes, spotlight), none. The three client-paginated tables also have **no loading skeleton at all**, while the other six copy-paste the identical `Array.from({length: 8}).map(() => <Skeleton className="h-12 w-full rounded-none" />)` block.

Search: shared `TableSearchInput` (6), a hand-rolled `<Input>` + `SearchIcon` (`operators-table.tsx:126-127`), and a `searchValue`/`onSearchChange` prop pair debounced in the list view (bookings, payments, locals-favourites).

`PAGE_SIZE_OPTIONS = [10, 20, 30, 50]` is redeclared in every server-paginated table.

Every empty state is hand-written: `<TableCell colSpan={N} className="h-32 text-center">` + a module-specific lucide icon at `size-8 opacity-40` + two `<p>` lines. Spotlight's is shallower than the rest.

### G-4 · S2 · Four state systems, two validation systems
**Impact 3 · Effort 3 · Ratio 1.0**

Coexisting in trips: TanStack Query (server truth), react-hook-form (most forms), raw `useState` (inconsistently substituted - `AgeBandRow` has **8** `useState`s, `AddOnRow` 5, the schedules add-form 6 **plus a hand-rolled `errors` object**), and React Context.

And two validation systems: Zod resolvers in some rows, imperative `if (!HHMM.test(...))` in others (`trip-schedules-tab.tsx:423`, `:928`).

Symptom of the seam: `as unknown as Resolver<T>` appears 5 times (`trip-form.tsx:170`, `trip-details-tab.tsx:380`, `trip-pricing-tab.tsx:532`, `:721`, `:783`) - a double-cast through `unknown` to bridge string-typed form values against coerced schemas. That cast is the type system reporting a real modeling problem and being told to be quiet.

### G-5 · S2 · Seven files over 400 lines hold 47% of the trips module
**Impact 3 · Effort 3 · Ratio 1.0**

4,873 of 10,363 lines. Each mixes unrelated concerns:

| File | Lines | Mixes |
|---|---|---|
| `trip-schedules-tab.tsx` | 1,165 | 3 unrelated managers + a **locally-redefined `DatePickerField`** (`:80-121`) duplicating the shared `components/dashboard/date-picker-field.tsx` that the Promotion tab imports + the `scheduledSlotsForDate` availability algorithm (`:770-790`) - **business logic in a view file** |
| `trip-pricing-tab.tsx` | 1,095 | 3 domains, 5 schemas, 5 RHF instances, 2 local-state row editors |
| `trip-details-tab.tsx` | 1,060 | ~30-field form + an embedded Guide Languages manager + OCTO fields + `toSlug` + `durationHint` logic mirroring the public site |
| `trip-form.tsx` | 704 | duplicate of the above for create |
| `trip-images-tab.tsx` | 523 | grid + card + dialog + reorder algorithm + media wiring |
| `trip-locations-tab.tsx` | 469 | row + form + 7-locale panel + add form + `numOrNull`/`numOrUndef`/`strOrNull` **copy-pasted verbatim** into `trip-pickup-locations-tab.tsx:58-60` |
| `trip-edit-view.tsx` | 431 | tab shell + lifecycle + readiness + 3 banners + archive dialog |

`trip-translations-tab.tsx` (420) restates the same 13-field list **four times**: schema (`:26-40`), `EMPTY_FORM` (`:44-58`), reset block (`:97-111`), payload (`:119-133`).

### G-6 · S3 · Shipped typos and stale config
**Impact 1 · Effort 1 · Ratio 1.0**

- `components/dashboard/dashbaord-wraper.tsx` - two typos in one filename, in the file that wraps every dashboard page
- `components/skelitons/` - directory name, in the import path of 61 `Skeleton` usages
- `tsconfig.json:include` references `app/(dashboard)/_dashboard/layout.js`, **which does not exist on disk**
- `frontend/lint_errors.log` - 45,724 bytes committed at repo root
- `types/trip.ts` calls it a trip; the backend calls it a tour; `tripId` params post `{ tourId }` bodies (`lib/api/trips.ts:489`, `:512`). The naming split runs through every file in the module.

---

## H. What is genuinely good

Stated because a redesign that discards these would be a regression, and because they prove the team can build the abstractions this document asks for.

1. **The API boundary is already clean.** Two deliberately separate fetch stacks with different auth models, different retry strategies, and correct reasoning about each. `public/fetch.ts:31-33` explicitly avoids `Math.random()`/`Date.now()` because `'use cache'` bans them - and `fetch.ts:19-22` explains why the client stack *can* use jitter. That is a team that understands its own constraints.
2. **`userActions.ts:41-48`** deliberately uses React `cache()` instead of `'use cache'` because a cached `null` from a transient 429 would bounce logged-in users. That is a subtle bug reasoned about and prevented.
3. **`apiFetch` retries GETs only**, with the comment "a retried POST/PATCH/DELETE could double-apply a mutation." Correct, and rarer than it should be.
4. **`FaqManager` (477 LOC)** is consumed identically by all four entity modules with zero forks: `<FaqManager basePath="..." entityId={id} />`. This is the proof that the shared-abstraction pattern works here. It was achieved once.
5. **`image-selector-field.tsx`** - 10 consumers, no forks.
6. **All 10 tables use TanStack consistently.** The scaffolding around them is duplicated, but nobody hand-rolled a `<table>`.
7. **Route-level server/client split is correct** where it exists: every page is a thin server shim, and `[id]/page.tsx` redirects are async server components.
8. **`cache-revalidation.ts` is thoughtfully specified** - the `/availability/check` short-circuit (`:76`) exists because "it's a read shaped as POST and revalidating loops." The tag taxonomy is granular where it matters. It has one bug (B-1), not a bad design.

---

## Summary: the five things that matter

| # | Finding | Why it is first-order |
|---|---|---|
| 1 | **A-1** 77.8% client components | Root cause of the perf profile, the skeleton-first UX, and the reason tabs multiplied instead of routes |
| 2 | **C-1** 7-locale workflow = 300+ clicks, ~120 saves, no source text, no MT | The largest single operator cost in the product, and a missing system rather than a bad screen |
| 3 | **A-5** The cache bridge dies silently on split | The only extraction risk that no build, type check, or import graph will catch |
| 4 | **C-2 + C-3** 13 flat tabs, no save model, advisory readiness that omits a requirement | The tour editor is the product's core workflow and its weakest contract |
| 5 | **D-1** A stripped badge primitive caused 149 hardcoded colors and the dark-mode gap | Highest leverage-to-effort fix in the document |

And the pattern beneath most of section G, worth stating on its own:

> **This codebase's failure mode is not missing abstractions. It is un-adopted ones.** A generic `DataTable` exists and all 10 tables ignored it. A generic `ConfirmDialog` exists and 2 of ~10 destructive flows use it. A shared `DatePickerField` exists and the schedules tab redefined it locally. A shared `deactivate-dialog` exists behind four clone wrappers. `FaqManager` is the one case where the abstraction won.
>
> Any remediation that only *writes* shared components will reproduce this. The Phase 6 plan must **delete the forks in the same change that introduces the shared piece**, or the forks survive.
