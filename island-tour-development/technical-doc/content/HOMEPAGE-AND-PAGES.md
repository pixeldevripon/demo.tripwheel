# Homepage content + Pages system

Two related but deliberately separate systems:

1. **Homepage content** - fixed sections, editable content.
2. **Pages** - a WordPress-like permalink system, scoped to legal pages for now.

> Status legend: `[ ]` not started - `[x]` done - each completed phase carries an
> **EXECUTED** block recording what actually shipped (per the update-the-spec rule).

---

## PUBLIC HOMEPAGE IS WIRED (user, 2026-07-21) - the revert below is HISTORY

The block was lifted once the dashboard and backend were signed off. The page
was RESTORED from `ee2106f` (not rewritten) and updated for the contracts added
since - see Phase 4d. The section below is kept for the reasoning it records.

## ~~PUBLIC HOMEPAGE IS REVERTED - do not re-wire it yet (user, 2026-07-20)~~

`frontend/app/(frontend)/[locale]/page.tsx` was restored to its pre-CMS state
(`ee2106f^`). The public homepage renders bundled dictionary copy and bundled
images again, exactly as before Phase 1. **The public site is off-limits until the
dashboard and backend work is signed off.**

Everything else stayed: the backend modules, the migrations, the dashboard editor,
and the frontend data layer (`lib/api/public/home-page.ts`,
`featured-experiences.ts`, `lib/images/remote-hosts.ts`, the `homepage` cache tag).
Those loaders are simply unreferenced for now.

Re-wiring later is a ONE-FILE change, because the fallback contract was built to
allow exactly this: `Hero`, `EditorialBanner`, `EditorialCardFan` and
`TopExperiences` all take their CMS props as OPTIONAL with bundled fallbacks, so
they render pre-CMS output when the page passes nothing. Nothing was stubbed or
commented out. To restore, recover the page from `ee2106f` - do not rewrite it
from memory:

```bash
git show ee2106f:'frontend/app/(frontend)/[locale]/page.tsx'
```

Verified after the revert: `tsc --noEmit` clean, eslint clean on the page and
`components/frontend/home/`.

---

## Why two systems and not one page builder

The instinct is to make the homepage "just another page" in the Pages system. We
deliberately did not.

The homepage sections are pixel-locked Figma layouts: a fanned three-card deck, a
fixed-width Embla carousel with a fixed dot count, a specific hero crop. A block
builder would hand an admin the ability to compose layouts that do not exist in
code - effort spent building freedom we would then have to defend against.

So the homepage lets an admin change **what is in** a section, never **whether a
section exists**. Section order and structure stay in code.

Legal pages are the opposite case: genuinely arbitrary long-form documents that
will grow (about, help, contact - the footer already carries four inert labels
waiting for routes). Those get a real permalink system.

---

## The fallback contract (the load-bearing decision)

Every homepage content field is **nullable, and null means "use the built-in i18n
dictionary default"**. `content.heroTitle || dict.home.hero.title`.

This is what makes the work shippable incrementally:

- An empty table renders exactly the pre-CMS homepage. No content-entry milestone
  gates the deploy.
- Clearing a field restores its default rather than blanking the section.
- Rollback is "empty the table".
- A backend outage degrades to bundled copy (hence `publicGet`, never
  `publicGetStrict` - the site's front door must not 404).

Note the operator is `||`, not `??`: an empty string from the DB must fall back
too, or a cleared field renders a broken image / empty heading.

---

## Prior art found before building (do not re-litigate)

- **`FeaturedExperience` already exists** (`prisma/destinations.prisma`), migrated
  and demo-seeded, with **zero application code**. `entityType (CATEGORY|HUB) +
  entityId + destinationId? + videoUrl + displayOrder + isActive`. The `videoUrl`
  column exists precisely for the video cards `top-experiences.tsx` hardcodes. It
  survived the slot-economy purge deliberately (`APPLICATION-FEATURES.md:42`).
  Top Island Experiences is therefore a **wiring job, not a design job**.
  Known defects to fix when wiring: no Prisma relations (so no cascade, despite
  `destinations.service.ts:369` claiming one - deleting a destination orphans
  rows), and no locale column (titles should come from the referenced entity's
  translations, which is also the SSOT win).
- **The legal pages already exist** as hand-authored JSX (`privacy-policy` 516
  lines, `terms` 541, plus `cookie-policy`, `cancellation-policy`,
  `legal-notice`, `manage-cookies`), English on every locale, via
  `components/frontend/legal/legal-page-shell`. Header comment: verbatim handover
  copy, change only through Denley per the README. Phase 5 is a **migration of
  authored copy**, not greenfield.
- **Static route segments silently shadow destination slugs.** A destination
  slugged `terms` or `search` becomes permanently unreachable, and no reserved-word
  guard exists anywhere. The Pages system makes this sharper, so the guard ships
  with Phase 5.

---

## Phase 1 - Homepage schema + hero + CTA card `[x]`

**EXECUTED 2026-07-20.**

Schema (`backend/prisma/home-page.prisma`, migration `20260720131212_home_page_content`,
purely additive - two new tables, no changes to existing ones):

- `HomePage` singleton (`id @default("default")`, the settings.prisma convention):
  `heroImage`, `editorialImages String[]`, `editorialDestinationId`, `ogImage`.
  The destination FK is `onDelete: SetNull` - deleting an island must not delete
  the homepage row.
- `HomePageTranslation` keyed `@@unique([homeId, locale])`, mirroring every other
  `*Translation` table (so the Translation Console picks it up in Phase 4 by
  registering it in `translatable-schema.ts` rather than needing bespoke UI):
  `heroTitle`, `heroSubtitle`, `experiencesTitle`, `editorialTitleLine1/2`,
  `editorialBody`, `editorialCta`, `faqTitle`, `faqSubtitle`,
  `isMachineTranslated`.

Backend `src/home-page/` (users-module pattern: dto / swagger / service / thin
controller / module, registered in `AppModule`):

| Route | Access |
|---|---|
| `GET /home-page/public?locale=` | `@Public()` |
| `GET /home-page` | `MANAGE_EDITORIAL` |
| `PATCH /home-page` | `MANAGE_EDITORIAL` |
| `GET /home-page/translations` | `MANAGE_EDITORIAL` |
| `PATCH /home-page/translations/:locale` | `MANAGE_EDITORIAL` |

`MANAGE_EDITORIAL` (admin-only) rather than `MANAGE_SETTINGS`: this is editorial
curation, so it sits with the other manual admin flags.

Service invariants:
- The public read is a `findUnique`, **never** the self-seeding upsert the admin
  read uses - an anonymous GET must not write. Missing row returns an all-null
  payload rather than 404.
- An **archived** editorial destination reports `editorialDestinationSlug: null`
  so the homepage never advertises a link that 404s.
- Writes use conditional spreads so an absent field is untouched and an explicit
  `null` clears it.
- Translation writes seed the singleton first, so the FK always resolves even if
  an admin's first-ever action is writing copy.
- Translation copy uses the `{ fields: {...} }` wrapper, matching every other
  entity. There is no delete route: clearing is a null upsert (the English-tab
  "Clear Fields" pattern), because deleting the base locale would strand the
  section headings.

Public loader `frontend/lib/api/public/home-page.ts`: `'use cache'` +
`cacheLife('days')` + `cacheTag('homepage')`, `publicGet` with an all-null
fallback, exported from the `lib/api/public` barrel.

Cache-tag contract: `homepage` added to `COARSE_CACHE_TAGS` in **both** repos
(the file was re-synced by copying, per its own instructions - `diff` is empty),
plus a `case 'home-page'` in the dashboard's `tagsForMutation`. Coarse rather than
granular because there is exactly one homepage; a per-id tag would carry the
constant `default` forever.

Wired on the public site: `Hero` takes an optional `image`, `EditorialCardFan`
takes optional `images` matched by index (a short array leaves the remaining cards
on bundled photos - the deck always renders three), `EditorialBanner` passes them
through, and `page.tsx` resolves DB-over-dictionary for hero title/subtitle,
experiences heading, editorial title lines/body/CTA, and FAQ title/subtitle. The
editorial CTA now targets the admin-chosen island, falling back to the previous
"Curaçao, else first destination, else /search" chain.

All three loaders are cached, so the homepage stays part of the prerendered shell
- no Suspense boundary was added, consistent with the render policy.

**Verification:** backend `tsc` + `eslint` clean, 12/12 new service specs green,
frontend + dashboard `tsc` + `eslint` clean. Live smoke test: seeded content
rendered (hero title, CTA label, Cloudinary hero, CTA retargeted to
`sint-maarten`); a locale with no copy row correctly returned base fields with
null copy (Dutch dictionary, no English bleed-through); after clearing, the page
stayed stale until the `homepage` tag was busted, then fell back to dictionary
copy and the bundled hero. The revalidate endpoint accepted `homepage` (200) and
rejected a typo (400), confirming both halves of the contract.

Not yet done, by design: no dashboard UI (Phase 4), so nothing currently emits
these tags in anger.

---

## Phase 2 - Top Island Experiences `[x]`

**EXECUTED 2026-07-20.** Two things in the original plan were wrong and were
corrected during the build - see "Plan corrections" below.

Schema (migration `20260720133830_featured_experience_destination_fk`, one FK):
`FeaturedExperience.destinationId` now has a real relation to `Destination` with
`onDelete: Cascade`. `entityId` deliberately does **not**, because it cannot.

Backend `src/featured-experiences/`:

| Route | Access |
|---|---|
| `GET /featured-experiences/public?locale=&destination=` | `@Public()` |
| `GET /featured-experiences` | `MANAGE_EDITORIAL` |
| `POST /featured-experiences` | `MANAGE_EDITORIAL` |
| `PATCH /featured-experiences/:id` | `MANAGE_EDITORIAL` |
| `DELETE /featured-experiences/:id` | `MANAGE_EDITORIAL` |

The resolver returns `{ id, entityType, title, image, videoUrl, href }` where
everything except `videoUrl` comes from the referenced Category/Hub - so a card
inherits that entity's translations and can never drift from its target page.

**THE GATE IS THE FEATURE.** Every card mirrors the exact condition its target
page 404s on, and anything that fails is dropped:
- category: `destination.isActive && category.isActive && liveTourCount > 0`
- hub: `isActive && status === PUBLISHED && liveTourCount > 0`
- a hub pinned to an island other than its own (a curation mistake)
- an orphan row whose target no longer exists

Image falls back `heroImage || ogImage || null`; the frontend then falls back to
bundled art. Worth knowing: the demo seed populates `ogImage` but **not**
`heroImage` on categories, so without this fallback every card rendered grey.

Public loader `frontend/lib/api/public/featured-experiences.ts` carries
`cacheTag('homepage', 'tours')`. The second tag is load-bearing: card visibility
depends on the target still having a live tour, so a tour going dark must
regenerate the list or the carousel keeps advertising a page that now 404s.
Dashboard maps `case 'featured-experiences'` -> `homepage`.

Frontend: `TopExperiences` takes an `experiences` array and derives its slide
count, loop copies, start index and dot row from it instead of module constants.
Fewer than 3 resolved cards falls back to the bundled deck - the same never-blank
contract as Phase 1, and it also avoids a one-card "carousel" reading as a
glitch. Cards are now navigable, closing a real UX gap (they were previously
`<button>`s with no link at all).

Two implementation details that are easy to get wrong:
- The link is a **stretched overlay sibling** (`absolute inset-0 z-10`), not a
  wrapper, because the play control is a `<button>` and a button nested inside an
  anchor is invalid HTML. The button sits at `z-20` so each press hits exactly
  one control.
- Embla 8 has **no `clickAllowed()`** (that was v7), so drag-vs-click is decided
  by measuring pointer travel against an 8px slop. A card that is not centred
  pulls into the centre instead of navigating; only the centred card follows its
  href.

**Verification:** backend `tsc`/`eslint` clean, 16 new specs green (134 across
the touched modules), frontend `tsc`/`eslint` clean. Live: all 7 demo rows
resolved, each to a real island - and the auto-picked destinations genuinely
differed (curaçao / sint-maarten / aruba), proving the pick computes rather than
defaults. **Every one of the 7 rendered hrefs returned 200.** Negative test:
deactivating a featured category dropped exactly its card from the resolver and
restored it on re-activation.

### Plan corrections (Phase 2)

1. **"Add relations + cascade" was impossible for `entityId`.** It points at
   either a Category or a Hub depending on `entityType`, and a relational FK
   targets exactly one table. Handled deliberately instead: the resolver skips
   unresolvable rows (an orphan is inert, never a dead link), create/update
   validate existence in the service since no FK will, and the one hard-delete
   path clears rows in its transaction.
2. **A destination-less CATEGORY row had no URL at all.** Category pages exist
   only per-destination (`/{destination}/{category-slug}`); there is no global
   category route, and the navbar's destination-less branch is dead code. All 7
   seeded rows are `destinationId: null`, i.e. every one was unresolvable. They
   now resolve to the destination where the category has the most live tours
   (ties broken by id, so the pick is stable) - which guarantees `count > 0`,
   i.e. a page that renders, and picks the most convincing one to send a
   traveller to.

### Fixed in passing

`categories.forceDelete` claimed in a comment that Prisma cascade handled FAQs.
It does not - `Faq` is polymorphic with no FK, so **every hard-deleted category
was leaking its FAQ rows**. The transaction now deletes both `Faq` and
`FeaturedExperience` rows by discriminator, and the comment says what is
actually true.

### Known conflict (surfaced, not silently resolved)

`CLAUDE.md` says a category page renders at **>=3** published tours per
destination. The code gates at **>=1** (`categories.service.ts`
`getPublishedTourCount` + the detail 404). The featured-card gate mirrors the
**code**, because its whole job is to match the real 404 condition. If >=3 is the
intended rule, both the category service and this gate change together.

## Phase 3 - Homepage FAQ `[x]`

**EXECUTED 2026-07-20.** As predicted, the cheapest phase: one enum value, one
constant, thin delegation, and no component changes at all.

**The pre-flight check mattered.** `FaqSection` is shared by five page types, and
`app/(frontend)/[locale]/[destination]/page.tsx:109` passes `dict.home.faq` - the
destination page reuses the *homepage* dictionary block. So `FaqSection` and the
dictionary were both left untouched; the homepage composes its own `faqDict` and
every other page keeps its current behaviour.

Schema: migration `20260720151119_faq_page_type_homepage`, a single
`ALTER TYPE "FaqPageType" ADD VALUE 'homepage'`, plus `FAQ_PAGE_TYPE.HOMEPAGE`.

Backend - thin delegation to the `@Global` `FaqGroupService`, which treats the
homepage as just another `(pageType, entityId)` pair:

| Route | Access |
|---|---|
| `GET /home-page/:entityId/faqs/groups` | `MANAGE_EDITORIAL` |
| `POST /home-page/:entityId/faqs/groups` | `MANAGE_EDITORIAL` |
| `PATCH /home-page/:entityId/faqs/groups/:groupId` | `MANAGE_EDITORIAL` |
| `DELETE /home-page/:entityId/faqs/groups/:groupId` | `MANAGE_EDITORIAL` |
| `PUT /home-page/:entityId/faqs/groups/:groupId/translations/:locale` | `MANAGE_EDITORIAL` |

`:entityId` is always the singleton key `'default'`, and anything else 404s (a
typo must not write orphan FAQ rows under a `homepage` pageType that no page
reads). It stays in the path purely so the dashboard's shared `FaqManager` and
`faqGroupsApi` - which build `{basePath}/{id}/faqs/groups` for every entity -
work here with **zero** dashboard changes in Phase 4.

Public FAQs ride along inside the existing `GET /home-page/public` payload rather
than getting their own endpoint: the homepage needs copy and FAQs together, so
one cached read beats two, and no new cache tag is needed.

**Locale rule:** only FAQs that exist in the REQUESTED locale are returned - an
untranslated FAQ is omitted rather than falling back to English, because a Dutch
reader should not hit an English answer mid-list. An empty list means the frontend
keeps its full bundled dictionary set, so an untranslated locale shows a complete
block rather than a half-English one.

Frontend: `page.tsx` swaps `faqDict.items` wholesale when curated FAQs exist.
Wholesale, not appended - a half-curated, half-hardcoded list would be impossible
to reorder or reason about from the dashboard.

**Verification:** backend `tsc`/`eslint` clean, 16 home-page specs green
(1285/1286 suite-wide; the one failure is the pre-existing `tours.service.spec.ts`
time-bomb noted at the end of this doc). Live: seeded one fully-translated FAQ
plus one English-only FAQ - EN returned both, NL returned only the translated one,
and both rendered on their respective pages. Admin routes 401 unauthenticated
(auth fires before the entityId 404, so an anonymous caller cannot probe which ids
exist). Clearing the rows restored the bundled dictionary FAQs.

## Phase 4 - Dashboard Content group `[x]`

**EXECUTED 2026-07-20** (dashboard repo). Pages joins this group in Phase 5; for
now it holds Homepage alone.

> **Superseded in part by Phase 4b (2026-07-21).** The nav placement, the
> Experiences product logic and the Console registration below all still stand.
> The TAB STRUCTURE described here (a tab per homepage section) and the helpers
> it needed - `describeField`, `useSaveHomepageSection` - were replaced by the
> entity shape every other module uses. Read Phase 4b for what exists today.

Nav: **a `Pages` group, placed immediately before `Account`**, holding Homepage
and gated `MANAGE_EDITORIAL` (user decision 2026-07-20). Grouped by what the
items ARE - pages you edit - rather than by permission, so the Phase-5 legal and
marketing pages land beside the homepage rather than in Curate. The route stays
root-level (`/homepage`), like every other route in the app, and the editor uses
no `EntityDetailShell` because it is a top-level tabbed singleton, same as
Settings.

`app/(app)/homepage` -> `HomepageEditView` -> `EntityTabs`, tabs in the order the
sections appear ON THE PAGE (Hero, Experiences, CTA Card, FAQs, then SEO), so
scanning the tab row is scanning the homepage top to bottom.

Design rules, each enforced in one shared place rather than per form:
- **Label by consequence.** `HomepageField` takes a `where` prop describing where
  the text lands ("the large text over the hero photo"), never a column name.
- **Show the fallback.** The shipped copy is the placeholder AND, while a field
  is empty, an explicit "Currently showing the built-in default" note. Empty
  state on a fallback CMS otherwise reads as a missing section. Defaults live in
  `lib/home-page/defaults.ts` - the ONE cross-repo duplication in this feature
  (the public site's `en.json` cannot be imported here). It is display-only, so
  drift costs a stale hint, never wrong data.
- **Publishing honesty.** `HomepageSectionCard` renders "Saving publishes
  straight to the live homepage" beside every save button - there is no draft
  state, so nothing should imply one.
- **English inline, other locales in the Console** - the standing rule; each
  translatable card links straight to the workspace.

`useSaveHomepageSection` composes the two endpoints a tab spans (locale-agnostic
fields + English copy) so one button saves both, sequentially rather than in
parallel: both write the same singleton, and a half-applied pair is far easier to
reason about than two racing writes.

**The Experiences tab is where the real product logic sits.** It surfaces the two
ways curation silently does nothing:
- a card whose target has no live tour is dropped by the backend, and for hubs
  that bar is HIGHER than the hub page's own - exactly the case an admin cannot
  deduce, so the picker states it;
- below 3 live cards the site ignores curation entirely and keeps its bundled
  deck, so 1-2 cards produce no visible change. The notice says so with the count.
It also warns past 5 (carousel geometry), flags rows whose target was deleted
(`entityName: null`), and surfaces the 409 duplicate error inline.

Translation Console: `homepage` registered as a `TranslatableEntityType` with
`HOMEPAGE_FIELDS`, a `HomepageWorkspace`, and a single fixed `HomepageRow` in the
matrix (no search, no pagination - there is one row). Two singleton
accommodations were needed in shared code, both additive: `ContentWorkspace`'s
page-content props became optional (the homepage has no About/SEO body, and
rendering fields that save nowhere is worse than omitting them), and `paginated`
now excludes `homepage`.

**Verification:** dashboard `tsc` clean, 0 lint errors, and `next build`
succeeds with `/homepage` in the route manifest. NOT verified: the rendered UI.
Every dashboard route 307s to `/portal` without a session, and signing in is not
something I do - so the editor needs a human pass before it is trusted.

### Review fixes (Phase 4)

Five points raised on the first cut; four were real defects.

**1. The shared FaqManager pointed the homepage at a dead link.**
`CONSOLE_TYPE_BY_BASE` had no `/home-page` entry and fell back to
`?? 'destination'`, so every homepage FAQ linked to
`/translations/destination/default/es` - a route that does not exist. Added the
mapping, and removed the fallback: an unmapped basePath now renders NO pointer,
because a wrong link is worse than a missing one. That silent default is what
turned a missing entry into a broken link instead of a visible error.

**2. The forms duplicated the shared settings kit.** `HomepageSectionCard` and
`HomepageField` were re-implementations of `SettingsCard` / `TextField` /
`TextareaField` / `ImageField` in `components/settings/settings-fields.tsx` -
the kit every settings form already uses, and the closest match for a
settings-shaped page. Both duplicates are deleted; the tabs now compose the
shared kit. The label-by-consequence and show-the-fallback behaviour survived as
`describeField(where, value, fallback)`, which builds the `description` string
the shared field already accepts, so no new component was needed to keep it.

**3. FAQs already used the shared manager** (`FaqManager basePath='/home-page'
entityId='default'`) and the shared Translation Console - that part was correct.
What was broken was the link it produced, which is finding 1.

**4. Tabs already used the shared `EntityTabs`**, matching Settings (which also
has no detail shell, being a top-level page rather than an entity). The
divergence was the form internals, fixed in 2.

**5. A media field asked for a pasted URL.** The featured-experience video was a
raw `<Input>` - the one field in the dashboard not backed by the media library.
There was no video picker to use, so one now exists:
- `MediaGalleryManager` and `MediaSelector` take a `kind` restriction. It seeds
  the type filter AND omits the setter, which hides the type dropdown entirely -
  a field that can only accept a video should not offer "All types".
- Selector toasts take their noun from the kind, so a video picker never says
  "image".
- `VideoSelectorField` + a `VideoField` in the shared kit render a real `<video>`
  preview. Kind is tested with `getMediaKind`, never `resourceType === 'video'`,
  because Cloudinary stores AUDIO under resourceType `video` - the raw check
  would accept an mp3 for a video slot.

**Nav placement - RESOLVED by the user: a `Pages` group, before `Account`.**
(Two earlier attempts were rejected: a one-item "Content" group, then folding it
into Account beside Settings.) The route stays root-level (`/homepage`).
Worth recording for anyone revisiting this: `NavItem.items` is TYPED for nesting
but `nav-main.tsx` renders exactly one flat level (`group.items.map`, no
recursion), so a nested child silently disappears from the sidebar. Real
sub-menus would mean building collapsible rendering - they are not a config
change today.

**Verification:** dashboard `tsc` clean, 0 lint errors across every touched file,
`next build` succeeds. The remaining warnings are the pre-existing
`react-hooks/incompatible-library` `watch()` notices that the settings forms
already produce. Still unverified: the rendered UI (no session).

## Phase 4b - Redesign onto the entity convention `[x]`

**EXECUTED 2026-07-21** (backend + dashboard). User review of the Phase-4 editor:
*"the design is not up to the mark and not following our convention like what did
the destination module - see the destination module form structure, specially faq
and seo page content and details tab."* Correct on every count. Phase 4 shipped a
**section-shaped** editor (a tab per homepage section, each with its own save)
into an app where every other content surface is **entity-shaped**. Composing the
shared settings KIT was necessary but not sufficient - the STRUCTURE still had to
match, and it did not.

### What was actually wrong

1. **No SEO to speak of.** The "SEO" tab was one OG-image picker. The homepage had
   no `metaTitle`/`metaDescription` AT ALL - the front door of the site was the
   one page with no search-engine listing, while every category page had one.
2. **Copy scattered across four tabs**, so changing the page's words meant four
   saves in four places; a destination edits all of its copy in one.
3. **No Details tab.** The record's own fields (hero image, CTA deck, CTA target)
   were split across Hero and CTA Card, so one banner change was two round trips.
4. **A second FAQ heading form** sat above the FAQ list, when that heading is
   per-locale copy like every other string on the page.

### Backend - the homepage gets a search listing

`metaTitle` / `metaDescription` added to `HomePageTranslation` (migration
`20260721063014_home_page_seo_meta`), threaded through `TRANSLATION_SELECT`,
`EMPTY_COPY`, the public projection and the translation upsert.

**Why on the TRANSLATION row and not a page-content record:** the four content
entities keep meta on their per-locale `*PageContent` record. The homepage
singleton has no such record and inventing one would mean a table, a controller
and an upsert to hold two columns. The translation row is already per-locale, so
the fields ride there - the ONLY structural difference, and it is invisible to
the admin because the SEO tab looks identical to a destination's.

Null keeps the existing fallback contract: an empty meta title means the public
page uses the site-wide default from Settings, exactly as it did before.

### Dashboard - the destination shape, tab for tab

`Details | Page Content | Experiences | SEO | FAQs`, with `aliases` mapping the
old `hero` and `cta` tabs onto `details` so existing links still land somewhere
sensible.

- **Details** = `HomepageForm`, one card and one Save covering hero image, CTA
  deck and CTA target - one endpoint, one write, mirroring `DestinationForm`.
- **Page Content** = the shared `EnglishContentEditor`, now with a `homepage`
  branch. Every word on the page in one form, in the order the sections appear.
- **SEO** = the shared `EntitySeoTab`, now exporting `HomepageSeoTab`: SERP
  preview, character counters, Regenerate, and the OG image - the same component
  destinations use. Suggestions come from the site-wide Settings defaults, which
  is also what the live page falls back to, so the preview shows the truth.
- **Experiences** = the curation card, unchanged in behaviour (every silent-drop
  rule from Phase 4 survives verbatim); it lost only the heading form.
- **FAQs** = `FaqManager` in the same card shell destinations use.

Two additive changes to shared code, both benefiting every entity:
`TranslatableFieldDef` gained an optional `placeholder` (which is how the
show-the-fallback rule survives - the shipped copy is now the placeholder in the
editor AND in the Translation Console, where a translator needs it most), and
`SeoConfig` gained `metaSourceNote` / `ogFallbackNote` so the homepage can say
where ITS fallbacks come from without forking the component.

Deleted as dead: `homepage-hero-tab`, `homepage-editorial-tab`,
`homepage-seo-tab`, `translation-pointer`, `describeField`,
`useSaveHomepageSection` (no tab spans two endpoints any more - Details is pure
base fields, Page Content is pure copy, so the composed save had nothing left to
compose).

### Verification

Backend: `tsc` clean, **1329/1329 tests pass** (29 in `home-page`, incl. new
coverage for the meta upsert, the public projection and the DTO ceilings). The
round trip was exercised against the RUNNING API - a meta title written to the
translation row appears in `GET /home-page/public`, and clearing it returns null
(fallback intact). Dashboard: `tsc` clean, 0 lint errors, `next build` green.

**Still unverified: the rendered UI.** Unchanged from Phase 4 - dashboard routes
307 to `/portal` without a session, the Chrome extension was not connected this
session, and signing in is not something I do. It needs a human pass.

## Phase 4c - Experiences deck, CTA card links, real media `[x]`

**EXECUTED 2026-07-21.** Three user requests in one pass, all on top of 4b.

### 1. Featured Cards, redesigned - and a poster per card

The curation UI was a list of names with a number input for ordering. It is now a
**grid of the cards themselves** at the carousel's own 3:4 portrait ratio, with
hover controls (move earlier/later, edit media, show/hide, remove), following
`trip-images-tab.tsx` - the dashboard's existing idiom for an ordered visual
collection. Curating a visual section from a list of names was the actual defect.

**`FeaturedExperience.posterUrl` added** (migration
`20260721064945_featured_experience_poster`). It wins over the target entity's
hero/og image, because the slot is a 250x440 portrait crop and neither fallback
is that shape. It doubles as the `<video poster>`, so a card with a video no
longer flashes black before it plays. The title is deliberately NOT overridable
the same way - it stays the entity's translated name, so a card can never
disagree with the page it opens in any language. A photo carries no such promise.

The admin list endpoint now also returns **`entityImage`** (the target's own
photo). Without it the editor could not draw the real card, and "clear the
poster" would be a blind move.

Ordering moved from a `displayOrder` number input to arrow controls backed by
`useReorderFeaturedExperiences`, which writes POSITIONS rather than swapping two
neighbours: every seeded row shares `displayOrder = 0`, and a swap between equal
values is a no-op - the bug the obvious implementation would have shipped.

### 2. CTA card photos link to islands

`home_page.editorialImages` (a `String[]`) became **`HomePageEditorialCard`**
(migration `20260721125741_home_page_editorial_cards`, hand-written so the
existing photos are carried across BEFORE the column is dropped - the generated
version would have created and dropped with nothing in between).

Per card: photo, an optional island, and `isLink`. Three states, all editable in
the Details tab: photo only (bundled caption), island named and clickable, island
named but not clickable. `isLink` is separate from `destinationId` on purpose -
an admin can name an island without shipping traffic to it, and switch that off
for a season without losing which island it was.

**The caption is not stored.** It is the linked island's own translated name, so
all 7 locales come for free and a card can never disagree with the page it opens.
An archived island degrades the card to a plain photo - neither named nor linked -
exactly as the CTA button already did.

The deck saves as a wholesale replace in one transaction with the base row: three
fixed slots have no stable identity to diff ("the middle card" is a position, not
a thing). The dashboard renders three fixed slots rather than a `useFieldArray`,
for the same reason.

### 3. The homepage now runs on library assets

`pnpm home:media:seed` (`backend/scripts/seed-home-page-media.ts`, `--dry-run`
supported) - **16 assets published, and the homepage record pointed at them.**

The fallback contract made the CMS safe to ship but left the editor showing empty
fields describing images an admin could not see, swap or reuse, because they were
files in the frontend bundle. This closes that once:

- **10 bundled files uploaded** from `frontend/public/` (hero, the 3 CTA
  category photos, 4 island photos, the FAQ host avatar).
- **6 registered, not re-uploaded**: the reel's images and videos are already in
  this Cloudinary account (hard-coded in `top-experiences.tsx`), so the script
  reads their metadata via the Admin API instead of duplicating ~100 MB of video.
- Wired: hero image; the CTA deck as Curaçao / Aruba / Sint Maarten, each with
  its island photo, name and link; posters + real footage on the three
  experiences that have it.
- **Placeholder video cleared** on four featured rows that pointed at a Google
  Chromecast sample clip (`ForBiggerJoyrides.mp4`). Falling back to a real photo
  beats playing someone else's demo.

Idempotent throughout: deterministic public_ids with overwrite+invalidate, and
every DB write upserts on `publicId`. URL policy comes from instantiating the
app's own `CloudinaryService`, never a restatement of it.

**Verification:** backend `tsc` clean, **1342/1342 tests pass**; both new
contracts were checked against the RUNNING API - `GET /home-page/public` returns
the three cards with translated names and hrefs, and
`GET /featured-experiences/public` shows posters and the three real videos.
Dashboard `tsc`, 0 lint errors, `next build` green; public frontend `tsc` clean.

**Unverified, as before: the rendered dashboard UI** (no session, no browser).

## Phase 4d - The public homepage goes live on the CMS `[x]`

**EXECUTED 2026-07-21.** The user lifted the do-not-wire block. The page was
**restored from `ee2106f`** (the version reverted on 2026-07-20) rather than
rewritten from memory, then updated for everything added since.

### What changed against the restored version

- **`editorialCards` replaces `editorialImages`.** A fan card is a photo, an
  island name and a link. Linked cards render as a real `<a>` (`MotionLink`, so
  client-side navigation and the page transition survive) - they must be
  crawlable and middle-clickable. They GIVE UP click-to-front, which is the
  point of linking them; unlinked cards keep it. The element type is fixed per
  card, so nothing remounts mid-shuffle.
- **`generateMetadata`** now serves the homepage's own meta title, description
  and OG image, omitting whatever is unset so the site-wide Settings defaults
  apply. It reuses the same cached loader as the page, so it costs no request.
- An unrenderable card photo **drops the card** rather than rendering an empty
  slot - the deck then keeps its bundled art for that position.

### Seeded so the page has something to serve

`pnpm home:media:seed` gained two jobs beyond the media:

- **The bundled FAQ, published in all 7 locales.** Those five questions had been
  rendering from the i18n dictionaries since before the CMS - unreachable from
  the dashboard, so nobody could edit, reorder or translate them. They are now
  real grouped FAQ rows, and because every dictionary already carried its own
  translation, all 7 locales landed at once with no translation work.
  Deduplicated on the ENGLISH QUESTION TEXT, not on "are there any FAQs yet":
  an admin had already added one of them by hand, so a wholesale skip would have
  stranded the other four and a blind insert would have duplicated the one. That
  hand-added row was English-only, which had quietly cost every other locale a
  question - the script attaches the missing translations to the EXISTING group
  rather than making a rival copy.
- **The bundled page copy, in all 7 locales.** Same story as the FAQ: the nine
  copy fields rendered from the dictionaries, so Page Content showed nine empty
  inputs describing words an admin could not reach. Filled per FIELD, never per
  record - a locale someone half-filled gets only its holes populated.
- **A homepage SEO title and description**, written only when empty. Without one
  the front door inherits whatever was last typed into Settings - which on this
  database was a tour title and the word "sdf".

**Nothing a visitor sees changed.** Every seeded value is the text or image the
site was already rendering, and the dictionaries and bundled files stay exactly
where they were: clear a field in the dashboard and the fallback takes over
again, which is the contract the whole feature is built on.

### The FAQ host avatar - and why it is NOT homepage content

The last homepage media an admin could not swap: the round "your local host"
avatar beside the WhatsApp button, hardcoded to
`/videos/experiences/catamaran-trip.mp4` + `/images/home-page/faq/host-avatar.png`.

**It went into Site Info settings, not the homepage record**, on the evidence:
`FaqSection` renders on the home, destination AND collection pages (category and
hub pass `minimal`, which hides this block), so a field on the homepage record
would have fixed one surface and left the other two on a bundled file. The
component is a server component that ALREADY reads `getPublicSiteInfo()` itself,
with a comment explaining that threading one settings value through five callers
is noise - so `faqHostImage` / `faqHostVideo` follow the WhatsApp number's exact
path and all three surfaces got it with no prop threading at all.

Fallback rules: neither set → the bundled pair; photo only → the photo alone, NOT
the bundled clip playing under someone else's face; video only → their clip with
the bundled poster. Edited in Settings > General beside the logo and favicon.

**Verified on the running site** after busting the `site-info` tag: `/en` and
`/en/curacao` both serve the Cloudinary avatar and poster.

### Model correction: a CTA card advertises a CATEGORY, not an island

**Reviewed and corrected 2026-07-21.** The first cut had each fan card pointing
at an ISLAND. Wrong: the banner is themed to ONE island (the CTA button's
target), and the three cards are the categories on it - which is exactly what
the bundled deck has always shown (buggy, snorkel, catamaran).

`HomePageEditorialCard.destinationId` became `categoryId` (migration
`20260721094903`). The island is deliberately NOT stored per card: with one
island on the banner and another on a card, the button and the card beside it
could open different islands. So the public payload returns the category's
translated name plus its **slug only**, and the page joins that slug to the
island it already resolved for the button. One island resolution, used by both -
they cannot disagree by construction.

The editor reflects the dependency: the island select moved ABOVE the deck,
because every card below it opens a category on that island, so it is the first
decision rather than a footnote after them.

**The live-tour gate (added straight after).** A category page 404s unless that
category has a LIVE tour on the island, so a card could link into a missing
page. `getPublic` now applies that exact condition and serves a failing card
WITHOUT its link - photo and caption intact, so the never-blank rule holds; the
card simply stops being a door to nothing.

That forced island resolution INTO the backend. It lived in the page (pinned →
`curacao` → first active, `name asc`) and is mirrored here, so
`editorialDestinationSlug` is now the RESOLVED island rather than the raw admin
pick. The reason is not tidiness: two independent resolutions can disagree, and
then the backend gates against one island while the frontend links to another.

The admin read carries `hasLiveTours` per card plus the island it gated against,
so the editor names a closed link instead of leaving an admin to discover it on
the live site.

Verified against real data both ways: a card on a stocked category returns its
slug, and one pointed at a category with nothing live on that island comes back
named, photographed and unlinked.

### The save that produced "destinationId must be a UUID"

The payload mapped the select's `__none__` sentinel to null but compared with
`===` only, so an empty-string form value sailed past it, was posted, and was
rejected by `@IsUUID`. `realId()` now collapses both sentinels AND `''` to null.

The same `''` explained the visible oddity in the screenshot - the island select
showing its placeholder while the link-mode control below it was visible: the
slot read its value with `??`, which does not catch `''`, so an empty value
masqueraded as a selection. It reads with `||` now. The lesson is the one this
whole feature is built on: `||`, not `??`, wherever empty means unset.

### Fallback audit - "no section, no content, no video can be empty"

Every section was walked for a path that renders blank. Nine of ten guard
correctly; one did not.

| Section | Guard |
|---|---|
| Hero | photo falls back to the bundled original; title/subtitle to the dictionary |
| Trust strip | dictionary-only, always present |
| Top experiences | under 3 resolvable cards the whole bundled deck renders instead |
| Testimonials | returns null when disabled - the section is ABSENT, never empty |
| Explore islands | returns null on zero islands - same |
| Editorial CTA | copy to the dictionary; each fan slot to its own bundled photo and label; the button to `/search` |
| FAQ | copy to the dictionary; an empty list renders the bundled questions; the host avatar to the bundled pair |

**The one real hole: a featured card with no photo anywhere.** The gates all
asked "does the target still resolve", never "is there anything to show" - so a
category with no hero AND no og image, featured with no poster, reached the
carousel and rendered as a grey rectangle between two real slides. The slide is a
full-bleed image with the title over it, so a null image has nowhere to degrade
to. `resolvePublic` now drops such a card and logs it, which is what every other
gate here already does; if too few survive, the bundled deck takes over.

That made two dashboard messages false, so both were corrected: a card with no
photo now reads "Not showing - this page has no photo either" in the danger
colour, and the header counts cards that can actually REACH the homepage rather
than rows that are merely switched on (it was reporting "3 live" while the site
quietly showed its bundled deck). The one gate the editor cannot evaluate is
"has a live tour" - only the backend knows that, and the picker says so.

Not guarded, and deliberately: an image URL that is well-formed, on an allowed
host, and simply 404s at the CDN. Detecting that means fetching every image at
render time.

### UI defects found on a live pass (fixed)

- A featured card with no poster previewed the LINKED PAGE's photo, which reads
  as "this card is done". The slot now asks for the media it is missing and says
  what the site is doing meanwhile; the whole surface opens the media dialog, as
  a SIBLING of the control buttons (a button inside a button breaks the inner
  one).
- The video picker had hand-rolled a flatter empty state than the image picker,
  so side by side in a dialog it read as unstyled. `MediaUploadZone` is now
  shared by both; only the icon and copy differ.
- A single-image preview rendered inside a 3/4-column grid, so in a narrow
  container it collapsed to a thumbnail too small to judge a photo by.

### Verification

Checked against the RUNNING site, not just the build: `/en` serves the CMS hero,
all three island cards with their links, and the experience posters; `/nl` serves
the Dutch FAQ from the database. The metadata override was confirmed after a
cache bust - worth knowing that a direct DB write does NOT show up until the
`homepage` tag is invalidated, which is what the dashboard does on save.
Backend 1342/1342, dashboard and frontend `tsc` + build green.

## Phase 5 - Pages system `[x]`

**EXECUTED 2026-07-26.** All four open decisions were put to the user and
approved: fall-through routing keeping the live URLs; an ADAPTED TipTap port
(not the literal 135-file copy); English-only content for now (per-locale rows
exist for later); 301-on-rename permalinks.

### Backend (island-tours/backend)

- `prisma/pages.prisma` (migration `20260726062524_pages_system`): `PageStatus
  DRAFT|PUBLISHED|ARCHIVED`; `Page { slug @unique, status, publishedAt (stamped
  on FIRST publish, kept across cycles), ogImage }`; `PageTranslation`
  (`@@unique([pageId, locale])`, title/body/metaTitle/metaDescription);
  `PageRedirect { fromSlug @unique, toPageId }` - redirects point at the PAGE,
  so chains collapse to one hop by construction. NOT in SlugRegistry, as
  designed.
- `src/pages/` (home-page clone shape): public `GET /pages/public/:slug` -
  published page (English fallback flagged `isEnglishFallback`), or
  `redirectToSlug` for a renamed permalink (dead if the target is unpublished),
  or 404. Admin (`MANAGE_EDITORIAL`): list / create (DRAFT + English row,
  atomic) / get / update (rename on a PUBLISHED page writes the 301 in-tx;
  draft renames write none) / `PATCH :id/status` (publish requires an English
  title+body) / delete (REFUSED for published - unpublish first) / `PUT
  :id/translations/:locale` (`{ fields }` wrapper). 27 new specs.
- **Sanitization is the write path** (`common/utils/page-html.util.ts`,
  `sanitize-html` pinned **2.16.0** - 2.17+ pulls an ESM-only htmlparser2 that
  breaks Jest). Allowlist = exactly the prose vocabulary (h2/h3/p/lists/marks/
  a/blockquote/hr/tables); http(s)/mailto only; `target=_blank` forced to
  `rel="noopener noreferrer"`. Stored bodies are PURE semantic HTML - the old
  `overflow-x-auto` scroller divs dissolve at write time; the public renderer
  re-wraps every table at render time.
- **Slug guards, bidirectional:** `RESERVED_PAGE_SLUGS` (search/wishlist/
  cancel/review/manage-cookies - the routes that STAY code) blocks page
  creates; a page slug matching a destination 409s; destination create now
  also 409s on an existing page slug. `RESERVED_GLOBAL_SLUGS` gained the
  missing `reviews-policy` (+ `review`), closing the latent shadowing bug.
- Sitemap: `GET /sitemap/entries` now emits `type: 'page'` (`/{slug}`).

### Public frontend (island-tours/frontend)

- **`.it-page-prose`** in `frontend-tokens.css` is THE prose source of truth -
  the descendant-variant block extracted verbatim from `LegalPageShell`, which
  now just applies the class. Includes the `th p`/`td p`/`li p` neutralisers
  (TipTap wraps cell/li content in `<p>`; without them the first editor save
  would visibly change every table).
- `lib/api/public/pages.ts` - `getPublishedPage()`, `publicGetStrict` (the
  route 404-gates on it), `cacheTag('pages')` COARSE (a rename must bust the
  OLD slug's entry too, which a per-slug tag cannot).
- **Fall-through at EVERY depth** (nested WordPress-style permalinks, user
  request 2026-07-26 - `terms`, `legal/terms`, `help/faq/payments`):
  - 1 segment: `[locale]/[destination]/page.tsx` - destination -> else
    published Page -> else redirect -> else 404 (cannot be its own route: two
    dynamic siblings at one level is a Next conflict).
  - 2 segments: `[destination]/[slug]/page.tsx` - when the slug registry
    misses AND the first segment is not an active island, try the joined
    Pages path before the flat-TOUR default. Cannot shadow tours by
    construction: the backend REJECTS page paths whose first segment is a
    destination.
  - 3+ segments: new catch-all `[destination]/[slug]/[...path]/page.tsx` -
    Pages only (static children like checkout still win). Prerenders deep
    pages from the sitemap enumeration, placeholder param when none exist
    (the Cache Components >=1-static-param rule).
  All three emit metadata the same way; `generateStaticParams` on the
  destination route filters to SINGLE-segment page paths (a slashed param
  under one dynamic segment would be invalid). Backend: `normalizePagePath`
  (per-segment generateSlug), slug guards check the FIRST segment, the
  destination-create mirror check also catches pages NESTED under the new
  destination's name (`startsWith('slug/')`), and the public
  `GET /pages/public/:slug` resolves encoded-slash paths (`legal%2Fterms` -
  the frontend loader already encodes).
  `LegalPageShell` gained `showEnglishNotice` (defaults to the old
  `locale !== 'en'`; the CMS passes `isEnglishFallback` so a future real
  translation drops the notice with no code change).
- `PageBody` wraps EVERY `<table>` in `.it-page-table-scroller` at render
  time; `LegalTableScroller` is deleted (no consumers remain). **Table design
  upgraded** (user request 2026-07-26): the scroller IS a rounded hairline
  card (14px radius, `--it-border`), header row on `--it-surface`, 12x16px
  cells, last row keeps the card edge as its closing line. Mirrored in the
  editor (`.tableWrapper` plays the card) so the WYSIWYG promise holds -
  editing keeps dashed column separators as an editor-only affordance.
- `app/sitemap.ts` dropped its hardcoded legal paths - pages arrive as
  `type: 'page'` entries. Cache-tag contract: `pages` added to
  `COARSE_CACHE_TAGS` in BOTH repos (copied byte-identically).
- **The six static legal folders are DELETED** (`terms`, `privacy-policy`,
  `cookie-policy`, `cancellation-policy`, `legal-notice`, `reviews-policy`).
  `manage-cookies` STAYS code - it embeds the interactive Cookiebot button and
  is noindex.

### Dashboard (tripwheel-x-islandtours-dashboard)

- **TipTap v3.29 adapted port** (`components/pages/rich-text-editor.tsx` +
  scoped `rich-text-editor.css`): full WATTUP TOOL PARITY (user request
  2026-07-26) - undo/redo, headings H1-H4, bullet/ordered/TASK lists,
  blockquote, code block, bold/italic/strike/inline-code/underline,
  multicolor highlight (swatches in `lib/page-highlight-colors.ts` - document
  DATA, not theme, hence outside the component per the no-color-literal lint
  rule), link popover, superscript/subscript, text align, IMAGES, tables,
  divider. StarterKit + `@tiptap/extension-{list,highlight,superscript,
  subscript,text-align,image,table}` (v3 table package exports all four nodes
  - the four separate wattup packages are a v2-ism). The toolbar composes the
  dashboard's OWN shadcn kit + hugeicons instead of the template's
  `tiptap-ui-primitive` kit, whose SCSS overrode shadcn `:root` tokens
  app-wide - nothing styles outside `.it-page-editor`.
  - **Images go through the media library** (`MediaSelector kind="image"`),
    NOT wattup's ad-hoc `/api/upload-image` drop zone - the standing
    every-media-field-uses-the-library rule. `ResizableImage`
    (`resizable-image.tsx`) extends the stock Image with a drag-corner
    NodeView writing a persisted `width` attr; the public
    `img { max-width: 100% }` caps it at the column.
  - **The content area is ALWAYS white** (both dashboard themes): it previews
    the public page, which is light, and the hardcoded dark-on-light prose
    colors would be unreadable on a dark dashboard. Editor-only affordances:
    clearly visible dashed cell grid (#b3b3b3 - the public #ededed hairline is
    imperceptible while editing, the original light-mode complaint), orange
    selected-cell overlay, selected-image outline + handle.
  - The content area renders under `.it-page-prose` (value-inlined mirror of
    the frontend class - sync BY COPYING), so the editor is the live preview.
    The RHF wrapper is a local `Controller` in `page-form` - deliberately NOT
    a `RichTextField` in the shared settings kit, which would pull TipTap
    into every settings bundle.
  - **Sanitizer lockstep:** the backend allowlist grew to the full editor
    vocabulary (h1/h4, pre/code, mark with a color-validated
    `background-color` style, sup/sub, task-list plumbing incl. checkbox
    inputs forced `disabled`, `img` https-only with width/height - a
    src-stripped img is dropped entirely, `text-align` style on blocks).
    Both `.it-page-prose` copies gained the matching rules (blockquote, hr,
    code, mark, img, task lists). Keep editor toolbar + sanitizer + prose CSS
    in lockstep - that triple IS the feature.
- Pages module on the collections list+detail pattern: `types/pages.ts`,
  `lib/api/pages.ts`, `hooks/pages/use-pages.ts`, routes `/pages`,
  `/pages/new`, `/pages/[id](/edit)`, components (list view + DataTable +
  columns + row actions: Edit / View live / Publish-Unpublish / Delete-with-
  unpublish-first, delete dialog, `page-form` with title, permalink
  (auto-slug + `slugTouched`, rename->301 note, old-permalink list), body
  editor, meta title/description, OG image via the media library,
  `page-edit-view` header with status badge + Publish/Unpublish + View live).
  All gated `MANAGE_EDITORIAL`; nav item "Pages" added to the existing Pages
  group; `case 'pages'` in `cache-revalidation.ts`; `pageUrl()` in
  `lib/public-site.ts`.

### Seed - the content migration

`pnpm pages:seed` (`scripts/seed-pages.ts`, `--dry-run`): publishes the six
pages from fixtures in `prisma/pages-content/*.html` - the EXACT rendered HTML
scraped once from the running routes before deletion (byte-true to what the
site served, tables intact). Fill-only-empty: an admin's edits always beat the
fixtures; re-running is a no-op. Bodies pass through the same write-path
sanitizer as admin saves.

### Verification (all against running services)

- Parity: all six URLs structurally IDENTICAL pre/post cutover (whitespace +
  neutral wrappers + entity encoding normalised); cookie-policy keeps its 4
  table scrollers; cancellation-policy GAINED the one it was missing. Titles,
  canonical + 7-locale hreflang, and the NL English-only notice all unchanged.
- Rename: old slug serves an instant meta-refresh + RSC 308 to the new one.
  NOT a raw HTTP 301: the route streams its shell (same pre-existing
  constraint that makes unknown slugs a 200-with-noindex-404), so the redirect
  is the framework's streamed equivalent.
- Draft/unknown slugs 404 (streamed, `noindex`); `/sitemap.xml` lists the six
  pages dynamically; publish/unpublish + saves bust the `pages` tag through
  the existing bridge. Backend 1639/1639; frontend + dashboard tsc/lint/build
  green.
- **Still unverified: the rendered dashboard UI** (no session, Chrome
  extension not connected - the standing gap). Needs a human pass: create a
  page with a table, confirm the editor matches the public prose, confirm
  dark mode is unaffected.

---

## Review round (2026-07-20) - EXECUTED

Both the security and code reviewers were run over Phases 1-3. Four findings,
all verified against the real code before acting, all fixed.

**1. Unvalidated media URLs could take the homepage down site-wide (security, high).**
`heroImage`/`ogImage`/`editorialImages`/`videoUrl` were `@IsString()` only.
`next/image` THROWS at render on a src it cannot load, and this row is a
singleton inside the prerendered shell of every locale's front page - so one bad
save (or a typo) blanked the site's front door in every language, not one card.
Fixed in two layers:
- Write time: `@IsUrl({ protocols: ['https'] })` + `@MaxLength(2048)` on all four
  fields. Nulls still pass, so clearing a field still restores its default.
- Render time: `lib/images/remote-hosts.ts` is now the SINGLE source of truth for
  allowed hosts - `next.config.ts` derives `remotePatterns` from it, and
  `safeRemoteImage()` re-checks at render, falling back to bundled art. Host
  allow-listing is deliberately NOT duplicated in the backend: the frontend owns
  that list, and a second copy is a second thing to drift.

Verified: 9 DTO specs; and end-to-end by writing a valid https URL on a
non-allowlisted host straight to the DB (bypassing the new validation) - the page
still returned 200 with the bundled hero, and the bad host never reached the
optimizer. Confirmed the hazard was real: `/_next/image` returns **400** for that
host and **200** for an allowlisted one.

**2. Duplicate featured cards were one double-click away (code, high).**
`FeaturedExperience` had no uniqueness protection, so the identical card could
render twice. A unique index cannot express this - `destinationId` is nullable
and Postgres treats NULLs as distinct, so two "show everywhere" rows for the same
category (exactly what the seed data uses) would both pass. Added
`assertNotAlreadyFeatured` on create AND update, returning 409, alongside the
existing runtime validations that exist for the same "no FK can do this" reason.

**3. The hub gate claimed a parity it did not have (code, medium).**
The comment said it mirrored `hubs.service.render()`. It does not: `render()`
gates only on `isActive` + `PUBLISHED`, and `assertPublishable` never requires a
tour, so a hub with zero tours renders a valid page. The extra live-tour check is
kept deliberately - a "top experience" with nothing bookable is a dead end even at
200 - but the comment and swagger now say that instead of claiming parity, and
note the admin-facing consequence (a published hub can be featured and silently
not appear; the Phase 4 picker should surface "no live tours").

**4. Hand-written row types instead of the codebase idiom (code, medium).**
`CategoryRow`/`HubRow` duplicated their selects by hand and would drift silently.
Now derived via `Prisma.CategoryGetPayload<{ select: typeof CATEGORY_SELECT }>`,
matching the 8 existing uses of that idiom - and matching `FEATURED_SELECT` in the
same file, which already used `satisfies`.

Reviewers explicitly confirmed clean: authorization on every route, no write-on-read
(the public read is `findUnique`, never the upsert), no IDOR (`assertHomeId` +
`FaqGroupService` triple-scoping), no field leakage (public payloads are
hand-assembled, not spread), no raw SQL, the byte-identical cross-repo cache-tag
contract, and the `categories.forceDelete` polymorphic cleanup. Hubs need no
equivalent cleanup - they have no hard-delete path at all.

**Verification after fixes:** backend tsc/eslint clean, 1296/1297 (the one failure
is the pre-existing time-bomb below), dashboard tsc/eslint clean. Frontend tsc has
one unrelated error (`app/onboarding/page.tsx`) caused by the concurrent
dashboard-extraction deletion of `frontend/components/dashboard/` - 212 deleted
files that appeared mid-session and are not part of this work.

---

## Phase 6 - The fan card gets the mockup's surface + a starting price `[x]`

**EXECUTED 2026-08-05** (PR #66). The fan had been rendering a bare photo with
the caption laid over it. It now renders the mockup's `.c`: a white card, the
photo across the top **70%**, then a label carrying the title and a starting
price.

`flex flex-col` on the card is load-bearing rather than cosmetic. A `<button>`
and an `<a>` both centre their content, which left a 16px white band above the
photo and pushed the whole card off the mockup; the column pins the photo to the
top edge and lets the label take the remainder.

### The price is computed in the backend, and grouped by currency FIRST

`cardStartingPrices()` (`home-page.service.ts`) resolves the live tours behind
each card on the editorial island through `tourCategory` / `tourHub`, then takes
the minimum `priceFrom` **per source currency**, converts each of those through
`FxRatesService.buildMoney`, and only then picks the cheapest.

The order is the whole point. Operators price in their own currencies, so
comparing raw amounts before conversion picks the smallest *number* rather than
the cheapest *tour* - a 5,000 JPY tour would lose to a 90 EUR one. The frontend
receives the value already converted and only formats it; it never does FX,
which is the same rule the rest of the site follows.

A card with nothing bookable behind it returns `priceFrom: null` and simply
renders no price line - the never-blank fallback contract, applied to one line
rather than the whole card.

**Two traps found in review of the first cut (PR #69), both worth not
repeating:**

- **`currency ?? source` is the wrong fallback in a comparison.** It is what
  `FxRatesService.attachMoney` does, and it is correct there - that helper shows
  each item ITS OWN price and never compares two items. Here we pick a single
  cheapest, and making every source its own target converts nothing, so the
  comparison falls straight back onto raw mixed amounts. There must be ONE
  target; when the shopper's currency is unknown it is the platform base.
- **`buildMoney` returns the SOURCE currency when no rate is available** (the
  sitewide never-block-on-FX rule). So even with one target, a partial outage
  can leave two entries in different currencies. Unconvertible entries are set
  aside; if nothing converted, the card takes a price only when every tour
  behind it shared one currency. A missing price line beats a wrong one.

The price is gated by the **same liveness test** as the card's name and link.
Without that, archiving a category or unpublishing a hub that still had live
tours left the card correctly anonymous and unlinked but still quoting a real
price - a page we had just decided must not be advertised, advertised by its
price.

The spec's FX fake was originally an identity echo, which meant the suite
structurally could not tell a converted comparison from an unconverted one. It
applies a real rate now, and the multi-currency cases were confirmed to go red
against the old pivot rather than merely assumed to.

`getPublic()` therefore takes the shopper's currency, and the homepage reads it
via `getServerCurrency` inside its existing Suspense boundary.

### Interaction - one click, two lifespans

The founder split the click into two behaviours that expire differently:

- **`front`** - which card is on top. **Sticky.** Bringing a card forward is the
  point of the click, so it stays forward until another card is picked.
- **`lifted`** - the zoom. **Momentary.** It is press feedback, so it releases on
  the next click elsewhere. Without the split the card stayed enlarged for the
  rest of the visit.

Cards never move. `z-index` is a stacking value and cannot tween, so the eased
lift carries the motion and the stacking flips under cover of it.

The release listens for **`pointerdown`, not the button's own `blur`**: Safari
does not focus a `<button>` on click, so `blur` would never fire there - and
Safari is where this was reported.

### Verified

Backend `home-page` suites 43/43. In real Chrome at `/en`: rest `z 10/30/20` at
scale 1 -> click `scale 1.048, z 40` -> click away `scale 1.000, z stays 40`.
Photo flush at the card's top edge (`photoTopInset: 1` = the border alone,
`photoPctOfCard: 70`). `home.editorial.from` added to all 7 dictionaries.

---

## Known pre-existing test failure (not caused by this work)

`tours.service.spec.ts` "date filter keeps only tours with a fitting OPEN
departure" hardcodes `2026-07-20` with an 09:00 departure and a 120-minute
booking cutoff - it expires the moment that morning passes. Confirmed failing at
clean HEAD via `git stash` before any of this work was blamed for it. Everything
else is green.
