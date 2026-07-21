# Editorial content + FAQs on the non-homepage pages

> Sibling of `HOMEPAGE-AND-PAGES.md`. That doc covers the homepage CMS; this one
> covers every OTHER public page: destination, category, hub, collection,
> all-tours and single tour.
>
> The homepage is the reference bar: every editorial field is nullable, and null
> renders the bundled i18n default. See "The fallback contract" in
> `HOMEPAGE-AND-PAGES.md` - it is not restated here.

---

## The audit (2026-07-21, both halves verified against source)

The question was "are the other pages' editorial content and FAQs dynamic?".
The answer was no, with wide variance.

| Page | Editorial body | FAQs | Verdict |
|---|---|---|---|
| Home | CMS + fallback on every field | CMS | reference bar |
| Category | `aboutText` from DB | DB, per category | closest |
| Hub | rich DB (`editorialLead`, picks, tips, discover) | DB | good, three defects |
| Collection | DB hero/overview/curationNote | DB | good, `aboutText` orphaned |
| Destination | **none consumed** | **none** | worst |
| All tours | **none exists** | **cannot exist** | no model at all |
| Single tour | all bodies from DB | **none, and unwritable** | copy fine, FAQ broken |

### The findings that drive the phase order

1. **Lorem ipsum was live** on every destination page in all 7 locales
   (`destination.about.description`), and the category About fell back to the
   same string.
2. **Curacao copy was being served on Aruba and Sint Maarten.** The all-tours
   subtitle, the hub comparison subtitle, the hub discover subtitle, 9 bundled
   hub FAQs and 6 bundled collection FAQs were all island-specific strings in
   the shared dictionary. Not missing content - *wrong* content.
3. **The destination page had no CMS path, but the backend already had one.**
   `GET /destinations/:id/page-content` and `/:id/faqs` existed, were
   admin-writable, already had authored content for all three live islands, and
   the frontend even declared the TypeScript types. Only the public loader was
   missing. Meanwhile the destination FAQ block rendered the *homepage's*
   bundled questions.
4. **Six locales silently lose whole sections.** Hub and collection `render`
   filter FAQs and content sections to the exact locale with no English
   fallback, while the same methods *do* fall back for `h1`/`heroTagline`.
   Collection is worse: its translations have no fallback either, so `overview`,
   `curationNote` and `eyebrowLabel` all return null in an untranslated locale.
5. **Tour FAQs are a dead read.** `FaqPageType.tour` exists and
   `octo.service.ts` queries it for partners, but no admin endpoint anywhere can
   create one - `ToursService` does not even inject `FaqGroupService`. The OCTO
   layer reads a table nothing can populate.
   **Resolved as WONTFIX** (2026-07-21): tours do not get FAQs, so the read
   stays dead on purpose. See the Phase 4 DROPPED block.
6. **Category editorial cannot vary by destination.** `CategoryPageContent` and
   `CategoryTranslation` key on `categoryId + locale` only, and `Faq.entityId`
   is the category id, so `/curacao/boat-tours` and `/aruba/boat-tours` are
   structurally forced to share body copy, SEO and FAQs.

---

## Phases

- **Phase 1 `[x]`** - wire the destination page to the CMS it already had; kill
  the lorem ipsum and the island-specific fallbacks. No schema.
- **Phase 2 `[x]`** - backend: English fallback for hub/collection FAQs, hub
  content sections and collection translations; put `aboutText` + meta into both
  `render` payloads; add the missing `isActive`/`status` guards on
  `getBySlug` (DRAFT hubs and collections were public). EXECUTED block below.
- **Phase 3 `[ ]`** - generic `PageContentSection` model + admin tab, so the
  destination About block can carry the three authored columns ("Top things to
  do" / "Planning your trip" / "Why book with us"). Requested with a design
  reference on 2026-07-21; the sample copy is island-specific, which is why it
  cannot be a `{destination}` dictionary template.
- **Phase 4 `[-]` DROPPED** - tour FAQs. Built, then removed the same day:
  **tours do not have FAQs at all** (user, 2026-07-21). A tour already answers
  those questions with structured fields. Nothing to resume. DROPPED block below.
- **Phase 5 `[x]`** - all-tours page. Reduced to its metadata half once the
  "wire what already renders" rule landed: the page has NO editorial section to
  make dynamic, so no `FaqPageType` member and no schema after all. What it did
  have was a missing `generateMetadata`. EXECUTED block below.
- **Phase 6 `[-]` CLOSED, no work** - per-destination category editorial.
  **Decided 2026-07-21: category copy should NOT vary per destination.** The
  current schema already enforces exactly that, so there is nothing to build and
  no migration to run. DECIDED block below.

---

## Phase 2 work list `[x]` - pointers

> **Executed 2026-07-21.** Items 1-3 landed as written; item 4's premise turned
> out to be wrong (see the EXECUTED block). Kept here because the pointers
> explain *why* each change was made. Line numbers are pre-change.

Line numbers are as of the 2026-07-21 audit; re-grep rather than trusting them
blind. All four items are backend-only, no schema, no frontend change.

**1. English fallback (the bug that empties whole sections in 6 locales).**
`hubs.service.ts` `render` already falls back locale -> EN correctly for
`h1`/`heroTagline`/`overview` around `:1622-1646`. **Copy that same shape** to:
- `hubs.service.ts:1657-1666` - FAQs, currently hard-filtered on `locale`
- `hubs.service.ts:1650-1654` - `HubContentSection` (Discover / LocalTips /
  FastFacts). Untranslated locale = the whole editorial block vanishes.
- `collections.service.ts:1126-1135` - FAQs
- `collections.service.ts:1112` - `translations: {where:{locale}}`. Collection is
  worse than hub: with no fallback here, `overview`, `curationNote`,
  `eyebrowLabel` and `h1Override` all return null.

The single-tour endpoint (`tours.service.ts:1756-1758` and per-child) is the best
locale-fallback implementation in the codebase - use it as the reference if the
hub one is unclear.

**2. `aboutText` + meta into the render payloads.** `HubPageContent` and
`CollectionPageContent` are authored and admin-editable but never selected by the
page endpoint, so the frontend fetches them a second time just for `<meta>` and
never renders `aboutText` at all.
- `hubs.service.ts` - inline select at `:1594-1615`, return at `:1702-1730`.
  Also add `Hub.ogImage` and `Hub.description`, both omitted from `render` while
  present in `hubSelect`/`hubDetailSelect` (`:109`/`:127`).
- `collections.service.ts` - `collectionSelect` at `:64-81`, return at `:1149-1160`.

Once these land, drop the now-redundant second fetch on the frontend:
`getHubPageContent` / `getCollectionPageContent` are used *only* in
`generateMetadata` (`[slug]/page.tsx:236` and `:214`).

**3. Draft entities are publicly readable.** `render` gates correctly in both
cases; the `getBySlug` variants do not.
- `hubs.service.ts:559-568` - no `isActive` / `status = PUBLISHED` filter.
- `collections.service.ts:132-165` - checks `isActive` (`:151`) but **not**
  `status`, so DRAFT collections leak.
- `destinations.service.ts:158-165` and `categories.service.ts:149-158` have the
  same shape - check them in the same pass.

**4. FAQ locale query.** `GET /destinations/:id/faqs` with `locale` omitted
returns every locale's rows mixed together (`FaqLocaleQueryDto` optional,
`destination.dto.ts:369-377`). The Phase 1 loader always sends `locale`, so the
public site is safe, but the endpoint itself should not be able to do that.

---

## Phase 4 - tour FAQs `[-]`  DROPPED, NOT DEFERRED

**Tours do not have FAQs.** User decision, 2026-07-21: *"faq in trip is not
needed"*. This phase was built, then removed the same day - first its public
section, then the whole thing.

### Why it is dropped rather than parked

A tour FAQ has nothing left to answer. The questions a traveller actually asks
before booking - is it confirmed instantly, can I cancel, where do I meet, what
do I bring, is it OK for kids - are all **already structured fields** on the
tour: `instantConfirmation`, `cancellationHours`, the meeting point and pickup
locations, `whatToBring`, `knowBeforeYouGo`, `minAgeYears`. An FAQ restating
them is a second copy that drifts the moment an operator edits the real field.
Entity FAQs earn their place because destinations, categories, hubs and
collections have no such fields; a tour does.

### What was removed

- Six routes on `tours/:tourId` (`faqs`, `faqs/groups` CRUD, the per-locale
  translation upsert) plus their service methods, Swagger docs and 9 tests.
- The `tourFaqs` seed: the template interface entry, all six non-English locale
  blocks in `demo/i18n-templates.ts`, and `tourFaqsFor` + its loop in
  `demo/entity-content.ts`.
- Earlier the same day: the `TourFaq` section on the public tour page,
  `PublicTourDetail.faqs`, `TourFaqSkeleton`, and the `faqs` field on
  `findBySlug` - the last one had been costing a database round-trip per tour
  page view that nothing rendered.

All four backend files and both seed files are byte-identical to their
pre-Phase-4 state (`git diff HEAD` is empty for each).

### What was deliberately kept

- **`FaqPageType.tour` and OCTO's `loadFaqs` reader.** Both predate this phase.
  With no write path and no seed the query simply returns `[]`.
- **The OCTO resolver cleanup.** `octo.service.ts` had its own hand-rolled
  all-or-nothing locale fallback; it now uses the shared `resolveFaqLocale`.
  That is a straight improvement to pre-existing code, so reverting it would
  put worse code back.
- **The doc note in `tour-page.tsx`** recording that the missing FAQ block is
  deliberate, so it is not "fixed" later.

### The rule this produced

Making content dynamic means wiring what the frontend **already renders**. A new
section is never introduced because the payload happens to have data for one -
and a backend write path is not built for data nothing asks for. See
[[feedback_no_new_frontend_sections]].

### Verification

Backend `jest`: **1395 passed / 64 suites** - exactly the pre-Phase-4 count
(1404 minus the 9 FAQ tests). `tsc --noEmit` clean, both repos.

---

## Phase 6 - per-destination category editorial `[-]`  DECIDED, NO WORK

**Decision, 2026-07-21 (user): category copy should NOT vary per destination.**

This was the one phase blocked on a business question, and the answer closes it
without any code. `CategoryPageContent` and `CategoryTranslation` key on
`categoryId + locale`, and `Faq.entityId` is the category id - so
`/curacao/boat-tours` and `/aruba/boat-tours` already share body copy, SEO and
FAQs by construction. The audit listed that as finding 6 (a defect); with the
decision made it is **the intended behaviour**. No model change, no data
migration, nothing to build.

### The one consequence worth knowing

Shared authored meta means two live URLs emit the **same `<title>` and
description**. `/en/curacao/boat-tours` and `/en/sint-maarten/boat-tours` both
serve "Boat Tours & Cruises | Island Tours" today (verified against the running
site). The generated fallback in `[slug]/page.tsx` does interpolate the island
(`{category} in {destination} | Island Tours`), so the duplication only appears
once an admin authors `metaTitle` - authoring is what removes the island name.

This is not a bug to fix under the decision above, but if duplicate titles ever
hurt in Search Console, the cheap fix is to append the destination to the
authored title at render time rather than to make the copy per-destination.

---

## Phase 5 - the All Tours page gets metadata `[x]`  EXECUTED

Executed 2026-07-21. No schema, no new sections, no CMS model.

### What the phase turned out to be

Originally scoped as "all-tours page editorial", needing a new `FaqPageType`
member and a migration. Re-scoped to nothing once the rule from Phase 4 applied:
the All Tours page renders a breadcrumb, a heading, a trust strip and the tour
grid - **there is no editorial section on it to make dynamic**, so inventing a
CMS model for it would have been introducing a section, not wiring one.

What it did have was a real defect: **no `generateMetadata` at all**. Every
island's All Tours page served the root layout's global title, with no
description, no canonical and no hreflang.

### What was built

- `lib/seo/alternates.ts` - `buildAlternates(locale, path)`, the canonical +
  7 locales + `x-default` set from ROUTING-AND-RESOLUTION.md §11.2. It was
  inline in `[slug]/page.tsx`; that copy now calls the helper, so there is one
  definition.
- `lib/current-year.ts` - the `'use cache'` year helper lifted out of
  `tours-header.tsx`. The heading and the `<title>` both stamp the year and must
  agree; two independent `new Date()` calls could straddle midnight on 31 Dec.
- `generateMetadata` on `[destination]/tours/page.tsx`. Copy comes from the same
  localized dictionary templates the page's own H1 uses
  (`destination.allTours.heading.title` / `.subtitle`), so `<title>` and H1 stay
  in step by construction in all 7 locales, with no CMS row behind them.
- `generateMetadata` on `[destination]/page.tsx` gained the canonical + hreflang
  it was missing (a Phase 1 gap - it had title/description only).

**The canonical is deliberately query-stripped.** All Tours is driven by
searchParams (filters, sort, date, party size); without a self-referencing
canonical every filter combination is a separate indexable URL (§11.3).

### Verification (against the running site)

| URL | `<title>` | canonical |
|---|---|---|
| `/en/curacao/tours` | All Curacao tours & activities in 2026 | `/en/curacao/tours` |
| `/nl/aruba/tours` | Alle Aruba tours & activiteiten in 2026 | `/nl/aruba/tours` |
| `/en/curacao/tours?sort=price_asc&adults=3` | (same as base) | `/en/curacao/tours` |

8 `<link rel="alternate">` tags (7 locales + `x-default`) on all of them, and on
the destination, hub and category pages. `tsc --noEmit` clean.

### Found while verifying: stale slug resolutions after a demo re-seed

`/en/aruba/boat-tours` renders the **correct** category body while its `<title>`
shows an unrelated Sint Maarten tour. The body and the metadata call the same
`resolveSlug` loader, so this is one stale `'use cache'` entry, not a logic bug:
the backend resolves that slug to `CATEGORY` correctly right now.

Cause: `resolveSlug` is tagged `slug:{dest}:{slug}` + `slug-registry`, and every
*dashboard* write busts those tags through `lib/api/cache-revalidation.ts`.
**`pnpm prisma:seed:demo` writes straight to the database and never calls that
bridge**, so re-seeding silently leaves resolutions cached for the `cacheLife
('days')` window. Production is unaffected (its writes all go through the
dashboard); local dev after a re-seed is not. Clear `.next/cache` after seeding,
or treat a title that names the wrong entity as this, not as a routing bug.

---

## Phase 3 - DESIGN DECIDED, not yet written (2026-07-21)

Nothing is implemented yet. These are the decisions made before starting, so the
work resumes without re-deriving them.

**Model: mirror `Faq`, not `HubContentSection`.** `prisma/faq.prisma` is already
the codebase's polymorphic pattern and it has the group key
`HubContentSection` lacks:

```prisma
model PageContentSection {
  id           String   @id @default(uuid())
  pageType     FaqPageType   // reuse the existing discriminator
  entityId     String
  sectionGroupId String      // links the 7 per-locale rows of ONE section
  locale       Locale
  sectionKey   String        // 'top-things' | 'planning' | 'why-book'
  heading      String
  body         String
  displayOrder Int      @default(0)
  isActive     Boolean  @default(true)

  @@unique([pageType, entityId, sectionGroupId, locale])
  @@index([pageType, entityId, locale, displayOrder])
  @@map("page_content_sections")
}
```

`sectionGroupId` is NOT nullable here (unlike `Faq.faqGroupId`, which is only
nullable for legacy rows) - there are no legacy rows to protect, so the per-group
locale fallback works from day one and `resolveFaqLocale`'s logic applies
directly.

**What the frontend has today** (`components/frontend/destination/
destination-about.tsx:53-101`): three `<a>` elements - check icon + a one-line
label from `dict.destination.about.{topThings,planning,whyBook}` - anchoring to
`#experiences` / `#planning` / `#faq`. Identical on every island, no body copy.
Each becomes heading + description. **The anchors must survive** - they are
in-page navigation, not decoration.

**Order of work:** schema + migration -> backend (admin CRUD + the section into
the destination render payload) -> seed all 7 locales with REAL island copy ->
frontend render keeping the `dict` fallback -> dashboard tab.

**Still needs the design screenshot** for layout only; the data layer above does
not depend on it.

---

## Phase 3 work list `[ ]` - pointers

Line numbers are as of 2026-07-21; re-grep rather than trusting them blind.

**What exists today.** `components/frontend/destination/destination-about.tsx`
renders the three items at `:55`, `:71`, `:87` as bare **anchor links** - a green
check icon plus a one-line label, jumping to `#experiences` / `#planning` /
`#faq`. The labels come from the bundled dictionary
(`destination.about.topThings` / `.planning` / `.whyBook`), so they are identical
on every island and carry no body text at all.

**What was asked for** (2026-07-21, with a design reference image): each of the
three becomes a **heading + description block**. The sample copy was
island-specific - Klein Curaçao, the 45-minute crossing, the Willemstad quays -
which is exactly why this cannot be a `{destination}` dictionary template and
needs authored per-destination rows.

**The design reference is an image and does not survive a context compaction.**
Re-attach it before starting, or work from this description and expect to
iterate on layout.

**Shape to build.** A generic `PageContentSection` model is the plan of record
(see the Phase 3 bullet above) rather than three columns bolted onto
`DestinationPageContent`, because hub already proves the pattern:
`HubContentSection` (`prisma/destinations.prisma:261`) is per-locale,
`sectionType`-discriminated, `displayOrder`-ordered. Copy that shape, but note
its one flaw before repeating it - **it has no group key linking the per-locale
variants**, which is why Phase 2 had to fall back all-or-nothing via
`resolveLocaleSet` instead of per row. Give the new model a group id (the way
`Faq.faqGroupId` does) and the resolver gets strictly better.

Also needed: the admin tab (follow the destination entity's existing
Details/Page Content/SEO/FAQs structure) and the render path through
`getDestinationPageContent`.

---

## Phase 2 - hub + collection pages stop dropping their editorial `[x]`  EXECUTED

Executed 2026-07-21. Backend + a small frontend follow-through. No schema, no
migration.

### The shared resolvers

`common/utils/translation.util.ts` gained two pure functions, unit-tested in
`translation.util.spec.ts` (13 cases). Both expect the caller to query
`where: { locale: { in: [locale, Locale.en] } }` and hand the rows over.

- **`resolveFaqLocale(rows, locale)`** - one row per logical FAQ, locale first.
  Grouped rows (`faqGroupId` set) fall back *per group*, so a page with three of
  five questions translated renders all five. Legacy ungrouped rows have no
  group key to pair on, so they fall back as a set - the English ones appear
  only when the locale has no ungrouped rows at all. Without that split, an
  ungrouped EN row and an ungrouped NL row would both render, duplicating the
  same question in two languages.
- **`resolveLocaleSet(rows, locale)`** - all-or-nothing fallback for rows with
  no group key. `HubContentSection` is the only such model.

### Hub `render`

- FAQs and content sections now query locale + EN and resolve in memory.
- Content sections resolve **per `sectionType`**, not across the whole set: a hub
  with translated Discover copy but English-only Fast Facts renders both. A
  whole-set fallback would have silently dropped the Fast Facts.
- Payload gained `pageContent` (`aboutText`/`metaTitle`/`metaDescription`,
  locale → EN per field), plus `description` and `ogImage`, which were in
  `hubSelect` but never reached the page.

### Collection `render`

- Translations now merge **field by field** locale → EN, so a half-filled locale
  row no longer nulls out `curationNote` or `eyebrowLabel` while keeping
  `overview`.
- FAQs resolve through `resolveFaqLocale`.
- Payload gained the same `pageContent` object.

### Draft entities were publicly readable

`GET /hubs/slug/:slug` had no `isActive`/`status` filter at all;
`GET /collections/slug/:slug` checked `isActive` but not `status`. Both are
`@Public()`. Both now gate exactly as their `render` sibling does.

Neither endpoint has a caller in either repo - the leak was reachable only by
hand-crafting the URL - but they are public routes and now behave like it.
`destinations`/`categories` `getBySlug` were checked in the same pass: they gate
on nothing either, but their entities have no draft state that hides authored
copy the way a hub or collection does, so they were left alone.

### Item 4's premise was wrong - no change made

The work list claimed `GET /:id/faqs` should not be able to return every locale
at once. It should: the **dashboard FAQ editor depends on it**
(`hooks/*/use-*.ts` call `getFaqs(id, locale)` for the per-locale editor, and
the all-locales mode backs the group view) across all four modules. Adding an
English fallback there would have shown editors English rows as if they were
translated. The public site never uses that endpoint for hub or collection any
more - the render payload carries the FAQs, already resolved.

### Frontend follow-through

`generateMetadata` in `[slug]/page.tsx` was fetching the hub/collection page
content a **second time** purely for `<meta>`. Both fetches are gone; it reads
`render.pageContent`. `getHubPageContent` / `getCollectionPageContent` were
deleted from `lib/api/public/` and replaced with a comment explaining why the
remaining `/page-content` endpoint (single locale, no fallback) is correct for
the dashboard and wrong for a public page. The hub branch also gained the
`og:image` it never emitted.

**The one trap.** `pageContent` is typed **optional** on `HubRender` and
`CollectionRender`, and read with `?.`. These payloads are cached with
`cacheLife('days')`: on first run the cache still held entries written by the
pre-change backend, and the non-optional read threw
`Cannot read properties of undefined (reading 'metaTitle')` inside
`generateMetadata` - killing the `<title>` and `<meta description>` on every
cached entity page. That is a real rollout hazard, not a dev artifact. Keep the
guard until the cached entries have aged out.

### Verification

- Backend: `jest` full suite **1395 passed / 64 suites**; `tsc --noEmit` and
  `eslint` clean. Two collection fixtures needed `status: PUBLISHED` added (they
  predate the gate); new tests cover the gate on both entities.
- Frontend: `tsc --noEmit` + `eslint` clean on every changed file.
- Live payloads: hub and collection `render` return `pageContent` populated from
  authored DB copy in all 7 locales; `ogImage` present.
- Served HTML: `/en|nl|de/curacao/klein-curacao` and
  `/en|fr/curacao/<collection>` carry authored per-locale `<title>` +
  `<meta description>`; FAQ questions appear in the requested locale only, with
  **no English bleed-through and no duplication**.
- Phase 1 pages re-checked for regression: `/en|nl/curacao`, `/en/aruba/tours`,
  `/en/curacao/off-road-tours` all 200 with correct titles.

### The fallback path is not covered by live data

Every hub, collection and their FAQs/sections/page-content are currently
authored in **all 7 locales**, and there are **no draft or inactive** hubs or
collections in the database. So neither the English fallback nor the new 404
gate changes any page today - both are latent-bug fixes. Their proof is the unit
tests, not the running site. Re-verify against real data the first time a
partially-translated hub or collection exists.

### Found, not fixed at the time - FIXED in Phase 5

`/{destination}/tours` had **no `generateMetadata` and no canonical**, so it
inherited the root layout's global title. Every all-tours page across every
destination served the same `<title>`, and it was a tour's name rather than
anything about the page. Pre-existing (that route file was untouched by Phase 2);
fixed in the Phase 5 block above, which also explains where that tour name came
from - a stale cached slug resolution, not the metadata itself.

---

## Phase 1 - the destination page goes live on its CMS `[x]`  EXECUTED

### Frontend loaders that were missing

`lib/api/public/destinations.ts` gained `getDestinationPageContent(id, locale)`
and `getDestinationFaqs(id, locale)`, mirroring the category loaders exactly:
`'use cache'` + `cacheLife('days')` + granular `cacheTag('destination:<id>')`,
so an admin edit refreshes only that island.

Both are keyed by id, not slug, because that is the shape the backend exposes.
The page already holds the island from `getDestinationBySlug`, so the two run in
one `Promise.all` after the slug resolves.

`locale` is always sent on the FAQ call. The backend returns **every locale's
rows mixed together** when it is omitted, which would render each question seven
times.

### What the destination page now renders

- **About body** - `pageContent.aboutText`, falling back to the bundled template.
- **FAQs** - the island's own questions, falling back to the generic site-wide
  set. Only `items` is swapped; the surrounding chrome (title, WhatsApp prompt,
  guarantees) stays shared with the homepage on purpose.
- **SEO** - the page had **no `generateMetadata` at all**, so its authored
  `metaTitle`/`metaDescription` were dead. It has one now, following the
  homepage convention (omit anything unset so the site-wide defaults apply),
  plus `openGraph.images` from `island.ogImage`.

All three live islands (Curacao, Aruba, Sint Maarten) already had authored
`aboutText`, meta and 4 FAQs per locale in the database. Every bit of it was
invisible on the public site. Verified live for `en` and `nl`.

### The `||` vs `??` rule, again

`pageContent?.aboutText || dict...` - an admin who clears the field leaves an
empty string, and `??` would render a blank block instead of falling back. Same
rule as the homepage.

### Placeholder and wrong-island copy, removed

Dictionary changes applied to all 7 locales (verified byte-identical JSON
round-trip first, so the diff contains only the intended strings):

| Key | Was | Now |
|---|---|---|
| `destination.about.description` | lorem ipsum | real generic copy, `{destination}` template |
| `destination.allTours.heading.subtitle` | "From Klein Curacao day trips…" | generic, `{destination}` template |
| `destination.hub.comparison.subtitle` | "All six boats go to Klein Curacao…" | generic |
| `destination.hub.discover.subtitle` | Klein Curacao geography | generic |
| `destination.hub.faq` | 9 Klein Curacao Q&As | **deleted** |
| `destination.collections.faq.items` | 6 Curacao Q&As | **deleted** |
| `destination.categorySubtitle` | - | **new** generic fallback |

The two FAQ sets were deleted rather than rewritten: both pages now fall back to
`home.faq.items`, the generic set already authored in all 7 locales. Rewriting
15 island-specific Q&As across 7 locales would have produced 105 strings that
are still wrong for every island but one.

`{destination}` substitution is applied **only to the bundled template**, never
to authored copy - an admin's words are rendered exactly as written.

### Fixed in passing

- `dict.destination.about.readLess` was authored and translated in all 7 locales
  and never wired; both About expanders hardcoded the English `'Read Less'`.
- The category header subtitle was a hardcoded English sentence claiming "Most
  boat tours offer free cancellation up to 48h before" - untranslated everywhere
  and untrue for most categories. It now uses the category's own localized
  `overview`, falling back to the new generic `categorySubtitle`.
- `ToursHeader` now substitutes `{destination}` into the bundled subtitle (a
  pre-resolved override is still used as-is).
- One mangled indent in `destination-about.tsx`.

### Verification

`tsc --noEmit` clean; ESLint clean on all changed files. The `Dictionary` type is
derived from `en.json` (`Awaited<ReturnType<typeof dictionaries['en']>>`), so tsc
passing is proof that nothing still references the deleted FAQ keys.

Verified by rendering the real pages against the dev server, not just by type
checking - 6 page types across 3 locales, asserting on the served HTML:

| Page | Asserted |
|---|---|
| `/en/curacao`, `/nl/curacao`, `/de/aruba` | CMS `aboutText` renders, no lorem ipsum, island's own FAQs render, per-locale `<title>` + `<meta description>` present (all three were absent before) |
| `/en/curacao/klein-curacao` (hub) | its 9 authored FAQs still render, generic fallback NOT used, new comparison subtitle, "All six boats" gone |
| `/en/curacao/family-favourites-curacao` | its 6 authored FAQs still render |
| `/en/aruba/tours`, `/en/curacao/tours` | subtitle names the right island, no Curacao leak |
| `/en/…/off-road-tours`, `/nl/…/off-road-tours` | boat-tours sentence gone; `Read Less` -> `Lees minder` in NL |

**The deleted bundled FAQ sets were duplicates of rows that already exist in the
database.** Checked before deleting: the hub's 9 questions and the collection's 6
are authored, so removing the bundled copies cost those two pages nothing. They
would only ever have surfaced on a *different* hub or collection, where they were
wrong.

The one residual `{destination}` in the all-tours HTML is inside the RSC script
payload (`seeAll` / `seeAllCount` templates handed to a client component and
substituted there). Pre-existing and unrelated.

`pnpm build` green: exit 0, full 868-page prerender, zero errors.

### Environment trap that cost three failed builds

The first three build attempts failed for a disk reason, not a code one, and the
symptoms actively mislead:

1. The prerender's `.segments` output needs roughly **15 GB**. The machine had
   ~12 GB free because `tripwheel-x-islandtours-dashboard/.next/dev` had grown to
   **20 GB** (a Next dev cache - regenerable, and unrelated to this repo).
2. When the disk fills, the local backend's `nest start --watch` cannot rewrite
   `dist/src/main.js`, so it **crash-loops with `MODULE_NOT_FOUND`**. That reads
   like the backend was OOM-killed by the build. It was not - it ran out of disk.
3. The build then reports a wave of `BackendUnavailableError` prerender
   failures. Those are third-order symptoms; chasing them leads nowhere.

Check `df -h` before diagnosing any local build failure in this repo, and clear
the dashboard's `.next/dev` if it has grown. After clearing (32 GB free) the same
build passed unchanged.

### Not done, deliberately

`components/frontend/category/category-trust-strip.tsx` is dead code with
orphaned `destination.categoryTrust.*` keys - the all-tours page has a trust
strip and the category page does not. Left in place: whether the category page
should gain one is a design decision, not a cleanup.
