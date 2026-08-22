# Phase 4 - UX Strategy & Redesign Specification

> Cross-cutting layer first (IA, navigation, role journeys), then the two systemic problems, then a
> triad per scope area: **The UX Problem / The UX Solution / Component Architecture**.
>
> Constraint honored throughout: **no business logic, API contract, or backend behavior changes.**
> Where a screen needs data that does not exist, it is marked BLOCKED and traced to
> `02-EXTRACTION-SPEC.md` Appendix A.

---

## 1. Information architecture

### 1.1 The problem with the current IA

The sidebar is a flat list of ~20 modules with no grouping by task. It mixes:
- things an operator does daily (bookings, tours)
- things an admin does monthly (categories, attributes)
- things nobody does (leads, enquiries, users, reviews - all stubs)

Both roles see one structure, filtered by permission. That is a *permission* model, not an *information* model: it answers "may you see this?" and never "what are you here to do?"

### 1.2 Proposed IA: four groups by task frequency

```
┌─ OPERATE ──────────────── daily
│  Overview
│  Bookings            (badge: needs attention)
│  Cancellations       (badge: pending count)
│  Payments
├─ CATALOG ──────────────── weekly
│  Tours
│  Media
│  Translations        ← NEW (§3)
├─ CURATE ──────────────── admin, weekly            [ADMIN]
│  Destinations
│  Hubs
│  Categories
│  Collections
│  Spotlight           (badge: pending approvals)
│  Locals' Favourites
├─ CONFIGURE ────────────── admin, rarely           [ADMIN]
│  Attributes
│  Tour Operators
│  Users                                            [BLOCKED: A3]
│  Reviews                                          [BLOCKED: A2]
│  Settings
└─ (footer)
   Profile · Theme · Sign out
```

| Decision | Rationale |
|---|---|
| Group by **frequency**, not entity type | An operator opens Bookings every morning and Attributes never. A flat list makes those equally prominent. |
| **Badges on actionable counts only** | Pending cancellations, spotlight approvals, bookings needing attention. Never a decorative count. A badge is a promise that something needs a human. |
| **`Translations` is a top-level destination** | It is the single largest workload in the product (C-1). It currently has no home at all; it is smeared across 7 tabs of every entity. |
| **`Leads` and `Enquiries` deleted** | Stubs, and `CLAUDE.md`: travelers "book instantly - no enquiry model". |
| **`Trips` renamed `Tours`** | The backend, the master doc, and the domain all say Tour. Only the frontend says Trip (G-6). |

### 1.3 Per-role IA

The two roles are different products sharing a chassis. Today they share one structure and differ only by hidden items - which is why the operator's sidebar has holes in it.

**Tour Operator** sees:
```
OPERATE:  Overview · Bookings · Cancellations · Payments
CATALOG:  Tours · Media · Translations
ACCOUNT:  Settings (Company, Payments) · Profile
```
Nine destinations. `CURATE` and `CONFIGURE` do not exist for them - **not greyed, absent.**

**System Admin** sees all four groups.

> **Rule:** an operator must never see a disabled item they can never enable. Today's model
> (`filterNavigationByPermissions`) already removes rather than disables - keep that, and let the
> **group headers disappear** with their contents rather than leaving empty sections.

### 1.4 Global layout

| Region | Spec |
|---|---|
| Sidebar | 240px / 56px collapsed, persisted. Groups by `--text-2xs` uppercase. Active = `bg-sidebar-active` **+ 2px leading indicator** (never color alone). |
| Header | 56px. Breadcrumb (left) · global search `Cmd+K` (center) · theme · profile (right). |
| Content | max-width 1440, `p-6` gutter. |
| **Command palette** | `Cmd+K`. `cmdk` is already a dependency. Jump to any tour by name, any booking by ref, any destination. **This is the real answer to click depth** - it makes the sidebar a map rather than the only road. |

**Removed from the header: the weather widget.** `weather-slider.tsx` (193 LOC) + `utils/weather.ts` (~300 LOC) + an OpenWeather API key + an external network dependency, in an admin CRM. `02` Appendix C1 defaults to carrying it as-is because removal is a product call, not an architectural one. **The UX recommendation is to remove it**; it occupies prime header real estate and serves no operator task. Your call.

---

## 2. Progressive disclosure for tour management

> Cross-cutting problem 1 of 2. Findings C-2, C-3, C-4, G-5.

### 2.1 The UX Problem

**Severity: S1. The product's core workflow, and its weakest contract.**

| Symptom | Measure |
|---|---|
| Flat tabs | **13**, presented as peers. Grouped only in source comments (`trip-edit-view.tsx:77-94`). |
| Gating | **None.** A brand-new DRAFT with no price offers a fully interactive SEO tab. |
| Save model | **No global save, no autosave.** Details has *two* buttons calling the same handler. Pricing has *three* forms. Attributes is the only true bulk save. |
| URL state | `?tab=` read once into an uncontrolled `<Tabs defaultValue>`. Tabs are not linkable; **browser back exits the editor.** |
| Publish | Advisory 5-item card. **Button always enabled.** Backend rejects. |
| Publish, worse | Passing all 5 checks does **not** list the tour. It also needs schedules + capacity - revealed only afterward by a "Published, not yet listed" banner. **A 6th requirement the card omits.** |
| Create | ~30 fields, **4 required**. The form says most are optional and renders them anyway. |
| Duplication | `trip-form.tsx` (704) + `trip-details-tab.tsx` (1,060) = **1,764 lines maintaining one form twice.** |

**Cognitive load:** the operator holds a 13-item map, an unknown save state per tab, and a publish contract that is wrong. **~25-30 clicks across 5 tabs to publish one tour.**

The deep diagnosis: **13 tabs is not a navigation problem, it is a missing state machine.** A tour has a lifecycle (draft -> complete -> published -> listed) and the UI renders every stage's controls simultaneously, flat, always enabled. The tabs multiplied because there was nowhere else to put things.

### 2.2 The UX Solution

**A. Create collects 4 fields. Nothing else.**

A single-screen form: Name, Destination, Category, (slug auto-derived, editable). Submit -> the editor. `trip-form.tsx` is **deleted**; the ~30 fields already live in Details, which is where the form itself says they belong.

Kills 704 lines and the C-4 duplication in one move.

**B. 13 tabs -> 4 phase groups, routed and gated.**

```
/tours/[id]/setup        Details · Pricing · Schedules
/tours/[id]/content      Images · Highlights · Inclusions · Itinerary · Pickups · Info
/tours/[id]/reach        Attributes · Promotion · SEO
/tours/[id]/translations → deep-links into the Translation Console (§3)
```

Four routes, each with sub-tabs. **Routes, not in-page tabs** - which fixes URL state, back-button, bookmarking, and (see 2.3) lets each group be its own server boundary.

**Gating rule, and it is deliberately soft:**

| Group | Available when |
|---|---|
| Setup | always |
| Content | always |
| Reach | **always, but SEO shows an inline notice** if no EN overview exists |
| Translations | **always, but shows an empty-state** if no EN content exists to translate |

> Hard-locking a tab is tempting and wrong. An operator pasting SEO copy before pricing is doing
> nothing incorrect. **Gate with information, not with disabled controls.** The current design gives
> zero guidance; the fix is guidance, not prohibition.

**C. Publish becomes a contract, not a hint.**

The readiness panel moves from a DRAFT-only card to a **persistent right rail** on every tour route, and it tells the truth:

```
┌ Readiness ─────────────────┐
│ ✓ Name, destination, category
│ ✓ Price set
│ ✓ 5+ images          5/5
│ ✓ Hero image
│ ⚠ Highlights         2/3
│ ✓ EN overview
│ ─────────────────────────
│ To be LISTED (not just live):
│ ✗ At least one schedule      ← the 6th requirement, stated up front
│ ✓ Capacity set
│ ─────────────────────────
│ [ Publish ]  ← disabled, "1 item left"
└────────────────────────────┘
```

Three changes, each fixing a specific lie:
1. **Publish is disabled until the checks pass**, with the blocking item named. It currently fires a request the backend will reject.
2. **The listing requirements are shown alongside the publish requirements**, so "published but invisible" stops being a surprise ambush.
3. Each unmet item **links to the exact sub-tab** that fixes it.

The backend contract is unchanged - the client simply stops offering an action it knows will fail.

**D. One save per route. Dirty-tracked.**

| Rule | Detail |
|---|---|
| One primary Save per route, in a sticky footer, enabled only when dirty | Replaces ~20 scattered buttons |
| Unsaved-changes guard on navigation | Does not exist today |
| Child collections (images, age bands, schedules) stay **immediate-per-action** | Correct today: adding an image *is* the save. Do not put a list behind a form submit. |
| Explicit "Saved" state in the footer | The operator currently has no way to know |

**E. Drag-and-drop reorder.**

`@dnd-kit/*` is already a dependency, used only by the dead `data-table.tsx`. Replace the numeric `displayOrder` inputs (highlights, inclusions, exclusions, features, itinerary, pickups) and the image up/down arrows.

**Requires backend A6** (bulk reorder endpoint). Without it, drag-drop would fire N PATCHes on every drop - worse than today. **BLOCKED on A6; keep arrows until it lands.**

**F. Schedule creation batches.**

7 days x 3 times currently = **21 sequential POSTs** behind one button, with no progress and no partial-failure story. **BLOCKED on A5** (bulk endpoint). Interim: keep the loop, add a progress indicator and a partial-failure summary naming what succeeded.

**States:**
- *Empty:* a new tour opens on Setup with the readiness rail showing 6 unmet items - the rail **is** the empty state.
- *Loading:* per-route skeleton mirroring that route's layout.
- *Error:* inline per section with retry; a failed section never blanks the editor.
- *Saving:* footer button spinner; child rows show per-row pending.

### 2.3 Component Architecture

```
app/(app)/tours/
├── page.tsx                       SERVER  list shell
├── new/page.tsx                   SERVER  4-field form shell
└── [id]/
    ├── layout.tsx                 SERVER  fetch tour once → header + rail + <Tabs nav>
    ├── setup/page.tsx             SERVER  → <SetupTabs/>
    ├── content/page.tsx           SERVER  → <ContentTabs/>
    ├── reach/page.tsx             SERVER  → <ReachTabs/>
    └── translations/page.tsx      SERVER  → redirect to console

components/tours/
├── readiness-rail.tsx             SERVER  pure computation from the tour object
├── tour-status-badge.tsx          SERVER  StatusBadge wrapper
├── lifecycle-actions.tsx          client  mutations + confirms
├── setup/
│   ├── details-form.tsx           client  ~30 fields, ONE form  (was 1,060 + 704)
│   ├── pricing-form.tsx           client  basics only           (was 1,095 mixed)
│   ├── age-bands-manager.tsx      client  extracted
│   ├── addons-manager.tsx         client  extracted
│   └── schedules/
│       ├── start-times.tsx        client  extracted             (was 1,165 mixed)
│       ├── recurring-schedules.tsx client
│       └── exceptions.tsx         client
└── ...
```

| Change | From | To |
|---|---|---|
| `trip-edit-view.tsx` (431) | client shell + lifecycle + readiness + 3 banners + archive dialog | **server layout** + a small client `lifecycle-actions` |
| `readiness-rail` | inline in a client component | **server** - pure function of the tour object, zero interactivity, zero JS |
| `trip-schedules-tab.tsx` (1,165) | 3 managers + a locally-redefined `DatePickerField` + the `scheduledSlotsForDate` algorithm | 3 components; **`scheduledSlotsForDate` -> `lib/tours/availability.ts`** (it is business logic in a view file); delete the local DatePicker, import the shared one |
| `trip-pricing-tab.tsx` (1,095) | 3 domains, 5 schemas, 5 RHF instances | 3 components, 3 schemas |
| `trip-details-tab.tsx` (1,060) | form + embedded languages manager + OCTO + `toSlug` + `durationHint` | form + extracted `languages-manager` |
| `trip-form.tsx` (704) | duplicate of Details | **deleted** |

**State ownership:**
- Server: the tour object (fetched once in `layout.tsx`), readiness computation, tab nav.
- TanStack Query: child collections.
- RHF: one form instance **per route**, not per card. **All `useState` row editors migrate to RHF** - `AgeBandRow` currently holds 8 `useState`s and the schedules add-form 6 plus a hand-rolled `errors` object (G-4).
- **Delete the 5 `as unknown as Resolver<T>` casts.** They are the type system reporting the string-vs-coerced-schema mismatch and being silenced. Fix the schemas; the cast disappears.

**Expected:** 10,363 LOC -> ~6,500. 28 client components -> ~20 client + 6 server.

---

## 3. The 7-locale data-entry strategy

> Cross-cutting problem 2 of 2, and **the single largest source of bloat in the product.**
> Finding C-1.

### 3.1 The UX Problem

**Severity: S1.**

Translating one realistic tour (5 highlights, 5 inclusions, 3 exclusions, 4 itinerary stops, 2 pickups) into 6 non-English locales:

| Surface | Saves |
|---|---|
| Translations tab (7 locale tabs x 13 fields) | 6 |
| Highlights (`TranslationRow` x 6 x 5) | 30 |
| Inclusions | 30 |
| Exclusions | 18 |
| Info & Terms | 6N |
| Itinerary (`DualTranslationRow` x 6 x 4) | 24 |
| Pickups | 12 |
| SEO | 6 |
| **Total** | **~120 saves, 300+ clicks, across 7 tabs** |

Three aggravators:

1. **The source text is never on screen.** The German tab shows 13 empty inputs placeheld "Overview in German". The English it translates *from* is not there. The operator memorizes it or opens a second window.
2. **No machine translation exists** - though `isMachineTranslated` threads through the whole type layer (14 occurrences in `types/trip.ts`), is settable on the upsert payload (`types/trip.ts:664`), and renders a "Machine Translated" badge in 6 components. **The data model is complete for a feature the UI never built.**
3. **No completeness view.** "Which tours are ready for the German market?" is currently unanswerable without opening every tour and clicking every locale tab.

And the code shape mirrors the UX shape: **there is no shared `LocaleTab`** - it is redefined in 5 modules. `destination-translation-form.tsx` and `category-translation-form.tsx` are **272 lines each and identical except for mechanical renames** (~30-line diff, one of which is the string "destination page" -> "category page").

**Diagnosis: this is not a screen problem. Translation was modeled as a *field attribute* ("every field has 7 versions") when it is a *workload* ("a person renders one entity into one language").** The UI mirrors the database schema instead of the job. Every per-screen fix reproduces it.

### 3.2 The UX Solution: a Translation Console

**A. One destination, `/translations`, organized by the actual unit of work: entity x locale.**

```
/translations                     matrix: what needs doing
/translations/[type]/[id]/[locale]  workspace: do it
```

**B. The matrix answers the question nobody can answer today.**

```
Tours ▾        Destination: Curaçao ▾     Status: Live ▾

Tour                    EN   ES   NL   PT   FR   DE   ZH
─────────────────────────────────────────────────────────
Klein Curaçao Sail      ✓   ✓   ✓   ⬤   ⬤   ○   ○     ← ⬤ partial ○ missing
Shete Boka Hike         ✓   ✓   ○   ○   ○   ○   ○
Blue Room Snorkel       ✓   ✓   ✓   ✓   ✓   ✓   ✓
─────────────────────────────────────────────────────────
                             [ Bulk pre-translate → ]
```

Cell = a completeness ratio across **every** translatable surface for that entity, not just the Translations tab. Click a cell -> the workspace for that entity+locale.

**C. The workspace: one locale, every field, side by side, one save.**

```
Klein Curaçao Sail · German                    [ 8 / 21 fields ]

┌ English (source, read-only) ──┬─ German ─────────────────┐
│ Overview                      │                          │
│ A full-day sail to the        │ [ Ein ganztägiger Segel… ]│
│ uninhabited island…           │                          │
├───────────────────────────────┼──────────────────────────┤
│ Highlight 1                   │                          │
│ Snorkel with sea turtles      │ [ Schnorcheln mit …     ]│
└───────────────────────────────┴──────────────────────────┘
   … all 13 core fields + every highlight, inclusion,
     exclusion, feature, itinerary stop, pickup, SEO field …

[ Pre-translate all empty ]        [ Save all (13 changes) ]
```

Four changes, each killing one aggravator:

| Change | Kills |
|---|---|
| **Source text always beside the target** | The memorize-or-second-window problem |
| **Every translatable surface on ONE screen** | The 7-tab scatter |
| **ONE save for the whole locale** | ~120 saves -> **1** |
| **Progress counter** | "Is this done?" |

**D. Pre-translate.**

A "Pre-translate all empty" button fills every empty target from the EN source, marks each `isMachineTranslated: true`, and leaves them editable for review. The existing badge then means something.

**BLOCKED on backend A4.** But note what already exists end-to-end: the DB column, the DTO field, the type, and the badge. **Only the generator is missing**, and `CLAUDE.md` already lists AI translation as planned BullMQ work. This is the highest-value item in Appendix A.

**E. Delete the Translations tab from all 5 modules.**

Every entity editor's Translations tab becomes a **link into the console**, showing a locale completeness summary. The five private `LocaleTab` implementations (~1,145 LOC) are deleted.

> **This is the make-or-break instruction.** Adding a console while leaving the tabs in place gives
> operators two ways to do one job and deletes nothing. Per 01's central finding - **this codebase's
> failure mode is un-adopted abstractions** - the forks must die in the same change.

**F. Realistic outcome.**

| | Before | After |
|---|---|---|
| Clicks per tour x 6 locales | 300+ | ~30 (6 x: open, review, save) |
| Saves | ~120 | 6 |
| Screens | 7 tabs x 6 locales | 6 |
| Source text visible | no | yes |
| Completeness visible | no | matrix |
| LOC | ~1,145 (5 forks) + trips' tab | ~450 (one console) |

**States:** *Empty* - "No EN content yet. Translations need a source." + link to Setup. *Loading* - two-column skeleton. *Error* - per-field inline; a failed field never blocks the rest. *Saving* - one progress row, per-field success/failure so a partial save is legible. *Conflict* - if the EN source changed since the translation was saved, flag the row "source updated" (**BLOCKED**: needs a source-updated timestamp; verify whether `updatedAt` on the EN translation suffices).

### 3.3 Component Architecture

```
app/(app)/translations/
├── page.tsx                       SERVER  filters + <TranslationMatrix/>
└── [type]/[id]/[locale]/page.tsx  SERVER  fetch source + target → <Workspace/>

components/translations/
├── translation-matrix.tsx         client  (virtualized grid)
├── completeness-cell.tsx          SERVER  pure
├── workspace/
│   ├── workspace.tsx              client  ONE RHF form, all fields
│   ├── field-pair.tsx             SERVER  source (read-only) | target (client input)
│   └── pretranslate-button.tsx    client  [BLOCKED: A4]
└── lib/translatable-schema.ts     ← the keystone
```

**`lib/translatable-schema.ts` is the design.** One declarative registry describing what is translatable per entity type:

```
tour:        13 core fields + highlights[] + inclusions[] + exclusions[]
             + features[] + locations[] + pickups[] + seo{}
destination: name, overview, h1Override, breadcrumbLabel + pageContent + seo
category:    ...same shape...
hub:         ...
collection:  ... + per-tour rationale
```

The matrix computes completeness from it. The workspace renders from it. Adding a translatable field is **one registry entry**, not a change in 5 forked forms.

This also retires `trip-translations-tab.tsx`'s worst property: it restates the same 13-field list **four times** (schema, `EMPTY_FORM`, reset block, payload).

**Deleted:** 5 `LocaleTab` implementations, `trip-translations-tab.tsx`, `rationale-translation-tabs.tsx`, `translation-row.tsx`, `dual-translation-row.tsx`. **~1,400 LOC.**

---

## 4. Module triads

### 4.1 Entity modules: Destinations · Hubs · Categories · Collections

Treated as one, because the audit proves they *are* one: ~90% identical translation forms, ~60% identical SEO tabs, 138-202 line diffs between table scaffolds, 32-line diffs between detail shells.

**The UX Problem** · *Severity S2*

| Symptom | Evidence |
|---|---|
| Tab count drifts per module for no reason | destinations 5, categories 6, collections 6, **hubs 8** |
| Tab **order** drifts | destinations puts SEO before FAQs (with a comment justifying it); the other three do the opposite |
| Four forks of one editor | ~4,300 LOC of near-mechanical duplication |
| Collections diverges arbitrarily | no row-actions, no delete dialog, no quick-edit - and **no RBAC gating at all** despite a 594-line form |
| Three pagination strategies | collections/attributes/spotlight are client-paginated **and have no loading skeleton** |
| Four delete-confirm abstractions | + 4 clone wrappers (47 lines each, 44-line mutual diffs) |
| No URL tab state | same as tours |

Cognitive load: an admin who learns Destinations must **re-learn** Hubs. The modules are the same job with different furniture.

**The UX Solution**

1. **One canonical editor shape**, same tabs, same order, every module:
   `Details · Page Content · SEO · FAQs · [module extras] · Translations→console`
   Hubs' 4 extras (Allowed Categories, Our Picks, Comparison, Content Sections) become **one "Curation" tab with sections**. 8 tabs -> 5.
2. **Routed tabs** (`/destinations/[id]/details`), fixing back-button and bookmarking everywhere at once.
3. **One `EntityTable`** (05) - server pagination for all, one skeleton, one empty state, one bulk bar, `PAGE_SIZE_OPTIONS` declared once.
4. **One `ConfirmDialog`** - the generic one already exists with a docstring saying "any potentially-destructive dashboard action" and **two** consumers. Delete the other 3 abstractions + 4 wrappers.
5. ~~**Gate collections** (B-7). An intentional, flagged behavior delta.~~ **VOID - B-7 retracted 2026-07-17 (see `01`): collections has gated since 2026-06-08.** What remains is cosmetic: it gates in 2 files where hubs gates in 4. Not a behavior delta.
6. **Sheet quick-edit** replacing the 3 cloned dialogs.

**Component Architecture**

```
app/(app)/[entity]/[id]/
├── layout.tsx        SERVER  fetch + shell + tab nav
├── details/page.tsx  SERVER  → <DetailsForm/> client
├── content/page.tsx  SERVER  → <PageContentForm/> client
├── seo/page.tsx      SERVER  → <SeoForm/> client
└── faqs/page.tsx     SERVER  → <FaqManager/> client   ← already shared, no forks

components/common/
├── entity-table/       ONE table
├── entity-shell.tsx    SERVER  breadcrumb + title + tab nav
├── seo-form.tsx        ONE     (was 4 x ~360)
└── confirm-dialog.tsx  ONE     (was 4 + 4 wrappers)
```

`FaqManager` (477 LOC, 4 consumers, **zero forks**) is the proof this works. It was achieved once. Do it four more times.

**Expected:** ~10,500 LOC -> ~4,000.

---

### 4.2 Attributes

**The UX Problem** · *S3.* The thinnest module (748 LOC) and structurally fine. Two real issues: client-side pagination with **no loading skeleton**, and a create/edit `Dialog` inconsistent with every other module's route-based form. Keyed by `key` not `id`, with no detail route - a defensible quirk.

**The UX Solution** Adopt the shared `EntityTable` (server pagination, skeleton). Keep the dialog - attributes are small and a dialog is genuinely right here; the inconsistency is worth naming and then accepting. Add a "used by N tours" column so an admin can see blast radius before editing.

**Component Architecture** `attributes/page.tsx` SERVER -> `<AttributesTable/>` client. `attribute-form.tsx` stays. ~748 -> ~600.

---

### 4.3 Spotlight & Locals' Favourites

**The UX Problem** · *S2.* Two editorial-curation surfaces with nothing in common structurally.
- Spotlight: 1,042 LOC, **24 palette classes in `spotlight-columns.tsx`** (the #3 offender), its own `statusStyles` convention, client pagination, no skeleton, a shallower empty state than the rest.
- Locals' Favourites: 591 LOC, **inline columns** (the only table that does not use a sibling `*-columns.tsx`), two overlapping shells (`locals-favourites-view.tsx` + a probably-orphaned `locals-favourites-list-view.tsx`).
- Neither is discoverable. Both are editorial powers with real commercial consequence, buried in a flat sidebar.

**The UX Solution**
1. Both under `CURATE`, adjacent, where curation lives.
2. Spotlight approvals get a **queue** shape - pending first, approve/reject inline, badge on the nav item. It is an inbox; make it one.
3. `StatusBadge` for both (kills the 24 palette classes and `statusStyles`).
4. Locals' Favourites: extract columns; delete the orphan shell; show **coverage against the ~30% target** from `CLAUDE.md` - the editorial goal exists in the docs and is invisible in the UI.
5. Preserve exactly: `is_locals_favourite` is admin-only, never operator-set, never tier-linked, `MANAGE_EDITORIAL` only (critical rule #23).

**Component Architecture** Shared `EntityTable`. `spotlight-queue-view.tsx` (483) splits into `queue.tsx` + `approve-sheet.tsx`. ~1,633 -> ~1,000.

---

### 4.4 Media Gallery

**The UX Problem** · *S2. A hard operational ceiling.*

| Symptom | Evidence |
|---|---|
| **Capped at 100 items** | `useMediaList('limit=100&page=1')` hardcoded. No pagination, no infinite scroll. **Item 101 is unreachable through the UI.** |
| No organization | No folders, no tags, no albums. The only `folder` is a hardcoded server destination. |
| Search is filename-substring, client-side | No type/date/size filter. No sort. |
| Bulk = delete only | |
| The picker is a `Dialog` pretending to be a route | `inset-0 w-screen h-screen`, borderless, `rounded-none` (C-7) |
| Second icon library | 7 of the 14 hugeicons files |
| Its own everything | own skeleton, own empty state, own delete dialog - none shared |

For a marketplace where every tour needs 5+ images across dozens of tours, this is the module most likely to simply stop working.

**The UX Solution**
1. **Pagination or infinite scroll.** Table stakes. The 100-cap is a bug wearing a config's clothes.
2. **Server-side search + filters** (type, date, size, unused). **BLOCKED** if `/media-gallery` lacks query params - verify; if it does support them, this is frontend-only.
3. **Tags over folders.** An image belongs to a tour *and* a destination; folders force one truth. **BLOCKED**: needs a backend field.
4. Picker becomes a **Sheet** (§5.4 of 03) - it is a selection task beside a form, not a destination.
5. **"Used by" indicator.** Delete is currently blind: an operator cannot see that an image is a tour's hero. This is the highest-value non-blocked item here.
6. lucide only; shared skeleton, empty state, `ConfirmDialog`.

**Component Architecture** `media/page.tsx` SERVER shell -> `<MediaGrid/>` client (virtualized). `media-selector.tsx` -> `media-picker-sheet.tsx`. Keep the zustand upload store - correct for cross-component progress. ~1,949 -> ~1,400.

---

### 4.5 Bookings · Payments · Cancellations

**The UX Problem** · *S2. The daily-throughput surface.*

| Symptom | Evidence |
|---|---|
| **Payments is a dead end** | No actions, no detail, no transitions. The **only money module with no drill-in** - while Bookings, sharing the same `types/booking`, has both. |
| Bookings exposes **one** transition | `ON_HOLD\|PENDING\|CONFIRMED -> CANCELLED`. No confirm, no hold, no refund. |
| Detail is a cramped modal | `max-w-lg` Dialog, ~15 label/value pairs, read-only, no fetch - just the list row |
| Cancellations is a boolean | `<BookingsListView cancellationView />`, zero components. Clever reuse; invisible as a workflow. |
| Business logic in a columns file | `refundDue()`, `paymentModelLabel()` exported from `booking-columns.tsx` |
| Two gating idioms in one file | `can('EDIT_BOOKING')` vs `role === 'ADMIN'` (`bookings-table.tsx:110`) |
| 7 palette classes | `booking-columns.tsx` status colors |

**The UX Solution**
1. **Detail moves to a Sheet.** Same data, room to breathe, list context preserved, and the operator can arrow through bookings without closing anything. This is the single biggest throughput win in the module.
2. **Cancellations becomes a real queue**, not a filtered list: pending first, the free-cancellation window and refund-due surfaced as **columns not prose**, approve/reject inline, nav badge.
3. `StatusBadge` everywhere (kills 7 palette classes + the 3 conventions).
4. **Move `refundDue`/`paymentModelLabel` to `lib/bookings/`.** Money logic is not presentation.
5. One gating idiom: `can()`. Never `role ===`.
6. Payments: detail sheet + refund. **BLOCKED on A7.** Until then the read-only list is at least *honestly* read-only - do not add affordances the API cannot serve.
7. Preserve exactly: commission is ADMIN-only; conversion value is `commission_amount` in EUR, never GMV; a confirmed booking with null commission renders an **error**, never a conversion (critical rule #22).

**Component Architecture** `bookings/page.tsx` SERVER -> `<BookingsTable/>` client + `<BookingSheet/>`. Shared `EntityTable`. `bookings-list-view` and `payments-list-view` currently implement the same 500ms-debounce state machine twice -> one `useTableState` hook. ~1,529 -> ~1,100.

---

### 4.6 Tour Operators

**The UX Problem** · *S3.* 1,001 LOC. **A `DashboardTabNav` wrapping a single tab labeled "Details"** - a navigation primitive rendering navigation for nothing, and a *different* primitive from the four entity editors. Its own hand-rolled `<Input>` search instead of the shared `TableSearchInput`. 5 palette classes. No onboarding visibility: an admin cannot see who has completed onboarding.

**The UX Solution** Delete the single-tab nav; render the form. Adopt `EntityTable` + `TableSearchInput`. Add an **onboarding status column** (the data exists - the layout already branches on `user.operator` to redirect to `/onboarding`). Add tour count + tier distribution so an admin can assess an operator without leaving the row.

**Component Architecture** Shared shell. `operator-sub-nav.tsx` (15) deleted. ~1,001 -> ~800.

---

### 4.7 Users & Reviews

**The UX Problem** · *S2.* Both are static JSX stubs in production navigation. An operator clicking "Reviews" gets a heading and a sentence. Reviews is the more damaging absence: `CLAUDE.md` gates homepage social proof on approved reviews, and there is **no moderation UI at all**.

**The UX Solution** Both designed against the proposed contract, both **BLOCKED**:
- **Reviews** (A2): moderation queue, pending first, approve/reject inline, filter by tour/rating/status, bulk approve. Same queue shape as Spotlight and Cancellations - **three inboxes, one pattern.**
- **Users** (A3): `EntityTable` + role column + invite flow. Role changes via the admin-only endpoint; **never client-set** (critical rule #10).

Until unblocked, both show an honest empty state naming what is coming. **Do not ship a fake table.**

---

### 4.8 Global Settings

**The UX Problem** · *S2.* Not discoverable and structurally two products at one URL. `settings-client.tsx` is a **role branch**, not a tab set: admin sees 6 tabs, operator sees 2, at the same route. No URL state at all (worse than the entity editors, which at least read `?tab=`). A naming collision: admin has both **General** (`site-info-form`) and **Company** (`company-info-form`), while operator's **Company** is a different component with different semantics. `settings-fields.tsx` (247) is a settings-local design system no other module uses.

**The UX Solution**
1. **Routed sections** (`/settings/general`), deep-linkable - matters because these are the URLs people paste into support threads.
2. **Rename to end the collision:** admin `General` -> **Site**, admin `Company` -> **Legal Entity**, operator `Company` -> **Your Business**.
3. **Search within settings**, fed by the command palette. "Where do I set SMTP?" should not require knowing it is under Integrations.
4. **Connection status** on Stripe/Mollie/SMTP/Mailchimp - connected/error/not configured, with a test action. Currently a form with no feedback that it works.
5. Fold `settings-fields.tsx` into the shared form primitives.
6. Preserve: `PATCH /settings/site` is the one settings write backing a public read - and **the reason B-1 matters** (02B §5.2).

**Component Architecture** `settings/layout.tsx` SERVER (role-branched nav) -> per-section SERVER pages -> client forms. ~1,673 -> ~1,300.

---

### 4.9 Account & Profile

**The UX Problem** · *S3.* 1,188 LOC. One long page with a **single `isEditing` boolean toggling the entire page** between read and edit - so changing an avatar puts every field into edit mode. The only module using framer-motion stagger (an inconsistency). Gated by `Role.USER` equality rather than `can()`. `change-password-dialog.tsx` is 268 lines.

**The UX Solution**
1. **Per-card edit**, not per-page. Each card owns its own state.
2. Security card: password + sessions + last login. **Session list BLOCKED** (needs a backend endpoint).
3. Keep the avatar cropper - it is good and it works.
4. Drop the stagger; match the rest of the product.
5. `can()`, not `role ===`.

**Component Architecture** Cards become independently-stateful client components under a SERVER page. `profile-completion-card.tsx` (23) -> server. ~1,188 -> ~900.

---

### 4.10 Overview

**The UX Problem** · *S1 for trust, S3 for effort.* **The first screen after login is fabricated.** `getDashboardStats()` is a hardcoded literal: `totalRevenue: 125000.50`, `'John Doe'` booking `'Bali Adventure'` (in a Caribbean product), `alice@example.com`. And `statistics.tsx` forces mock chart branches on with `|| true ?` at lines 408 and 516.

There is no design to audit here, because there is no data.

**The UX Solution** **BLOCKED on A1** - the highest-priority backend request.

When unblocked, two different pages by role, because the roles have nothing in common at 9am:

| Operator | Admin |
|---|---|
| Today's departures | Platform GMV + commission |
| Bookings needing action | Bookings by status |
| Tours not listed (and why) | Spotlight approvals pending |
| Translation completeness | Cancellation requests pending |
| Payout summary | Operator activity |

Every card links to the filtered list that produced it. A number nobody can act on is decoration.

**Until unblocked:** replace the fake data with a **real, honest empty state** plus the counts that *are* available from existing endpoints (tour count, booking count via `/bookings?limit=1` total). **Shipping "John Doe" and "Bali Adventure" to real operators is worse than shipping an empty state.**

**Component Architecture** SERVER page, per-card `<Suspense>` so each streams independently. Charts stay client (Recharts). `statistics.tsx` (1,078) splits per card. **Delete `dashboardActions.ts`.**

---

## 5. Summary

### 5.1 Click depth

| Task | Before | After |
|---|---|---|
| Publish a new tour | ~25-30 clicks, 5 tabs | ~12, guided by the readiness rail |
| Translate a tour to 6 locales | **300+ clicks, ~120 saves, 7 tabs** | **~30 clicks, 6 saves, 6 screens** |
| Change one price | 5-6 | 3 (`Cmd+K` -> tour -> Pricing) |
| Add a date exception | 8-10 | 4 |
| Find a booking by ref | scroll/search the list | 2 (`Cmd+K`) |
| Answer "is this tour ready for Germany?" | **impossible** | 1 (matrix) |

### 5.2 Code

| Module | Before | After |
|---|---|---|
| Tours | 10,363 | ~6,500 |
| Entity modules x4 | ~10,500 | ~4,000 |
| Translations (5 forks) | ~1,400 | ~450 (one console) |
| Bookings/Payments | 1,529 | ~1,100 |
| Media | 1,949 | ~1,400 |
| Settings | 1,673 | ~1,300 |
| Profile | 1,188 | ~900 |
| Spotlight/Locals | 1,633 | ~1,000 |
| Operators | 1,001 | ~800 |
| Dead code | 1,574 | **0** |
| **Total** | **~35,300** | **~19,500 (-45%)** |

### 5.3 Blocked on backend

| Item | Request | Priority |
|---|---|---|
| Overview | A1 real stats | **High** - the first screen is fake |
| Pre-translate | A4 MT job | **High** - the flag, payload and badge already exist end-to-end |
| Reviews | A2 | High |
| Users | A3 | Medium |
| Bulk schedules | A5 | Medium - 21 requests -> 1 |
| Drag-drop reorder | A6 | Medium - blocks E above |
| Payments detail | A7 | Medium |
| Media tags | new | Low |
| Session list | new | Low |

### 5.4 Ranked by impact/effort

| # | Item | Impact | Effort | Ratio |
|---|---|---|---|---|
| 1 | `StatusBadge` + semantic tokens | 5 | 2 | **2.5** |
| 2 | Command palette (`cmdk` already installed) | 4 | 2 | **2.0** |
| 3 | Publish readiness as a real contract | 4 | 2 | **2.0** |
| 4 | Create: 30 fields -> 4 | 4 | 2 | **2.0** |
| 5 | Booking detail -> Sheet | 3 | 2 | 1.5 |
| 6 | Media pagination (unblock item 101) | 3 | 2 | 1.5 |
| 7 | **Translation Console** | **5** | 4 | 1.3 | 
| 8 | Tours: 13 tabs -> 4 routes | 5 | 4 | 1.3 |
| 9 | One `EntityTable` | 4 | 4 | 1.0 |
| 10 | Entity editor unification | 4 | 4 | 1.0 |

**Sequence:** 1, 2, 3, 4 first - all ratio >= 2.0, all independent, all shippable in isolation. Then 7 (the largest win, and it needs A4 to be fully realized). Then 8, 9, 10.
