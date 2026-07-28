# AI Translation - How the Full Pipeline Works

> Shipped 2026-07-27. Code: `backend/src/content-translation/`. Companion doc:
> `MULTILINGUAL-CONTENT.md` (content model + console). This doc answers one question:
> **when English content is created or updated, how does it become 6 translated locales?**

There are **three trigger paths** into the same translation engine, plus the review pipeline
that shares the provider layer:

| Path | Trigger | Transport | Locales | Overwrite mode |
|---|---|---|---|---|
| **Background** | Any English-source save (create or update) | **BullMQ queue** (async, debounced) | All 6 non-EN | Protect human edits |
| **Manual** | "Translate with AI" button in the Translation Console | Synchronous HTTP | Current locale only | **Force** (after confirm dialog) |
| **Inline** | Per-field AI icon inside a form field (console + collection editor) | Synchronous HTTP | Current locale, one field | Persists nothing (form-fill) |
| **Section** | "Translate section" button on each console card header | Synchronous HTTP, **one batched request** | Current locale, one card | Persists nothing (form-fill) |
| **Nightly sweep** | `NightlyJobsService.run()` | BullMQ (same queue) | All 6 | Protect human edits |

---

## 1. Background path - yes, it goes through BullMQ

Every create/update of English source content ends in a queue job. Step by step:

```
en-locale save (HTTP upsert in an entity service)
        │
        ▼
ContentTranslationEnqueuer.enqueue(entityType, entityId)     fire-and-forget void
        │  • CONTENT_TRANSLATION_DISABLED=1 → silent no-op (kill switch)
        │  • provider not configured → silent no-op
        │  • Redis down → warn + swallow (the save NEVER fails because of translation)
        ▼
BullMQ queue "content-translation"
        │  job = { entityType, entityId }
        │  jobId = "type__id"         ← dedup: re-saves while a job is delayed are no-ops
        │                               (`__` not `:` - BullMQ rejects colons in custom ids)
        │  delay = 60s                ← debounce: an editing session collapses into ONE job
        │  attempts = 3, exponential backoff 10s
        │  removeOnComplete: true     ← MUST stay true (a retained job with this jobId
        │                               would block every future re-enqueue)
        ▼
ContentTranslationProcessor          concurrency 1, limiter 8 jobs/min (free-tier RPM)
        │
        ▼
ContentTranslationService.translateEntity(type, id)          all 6 target locales
        │  1. Entity registry collects TranslationUnits (main row + FAQ groups +
        │     page content + sections + tour children + rationales)
        │  2. Per locale: decide per unit what needs writing (policy below)
        │  3. ONE provider call per locale - pending units flattened into a single
        │     JSON object keyed "<unitKey>.<field>"
        │  4. Write back via registry prisma upserts (isMachineTranslated: true,
        │     sourceHash stamped) - NEVER through the entity services (no recursion)
        │  5. written > 0 → bust the public frontend cache tags for that entity
        ▼
Public site serves the new locale content
```

**Where the hooks live** (every English-source write path, ~27 call sites):

- `tours-children.service.ts` - main tour translation upsert (en) + all 6 child types
  (highlights, inclusions, exclusions, features, locations, pickups): child **create/update**
  (base-row source changed) and child **en translation upsert** each fire `enqueue('tour', tourId)`.
- `categories / destinations / hubs / collections / home-page` services - en translation
  upsert + en page-content upsert (+ collection rationale upsert).
- `common/faq/faq-group.service.ts` + `common/page-content-sections/page-content-section.service.ts` -
  shared choke points that cover FAQs/sections for ALL entities via
  `enqueueForPageType(pageType, entityId)` (the `tour` page type is unmapped on purpose:
  tours have no FAQs).

**Timing:** a background translation lands roughly 60-90s after the last en save
(60s debounce + one job at up to 6 provider calls). Rapid consecutive saves do not stack
jobs - same `jobId` while delayed is a no-op.

**Known accepted race:** a save landing while a job is *active* (not delayed) is deduped
away. The nightly sweep recovers it: `enqueuePending(10 per type)` re-enqueues live entities
whose `sourceHash` no longer matches; hash-current entities cost zero provider calls.

## 2. Manual path - the "Translate with AI" button (synchronous, force)

The Translation Console button does **not** use the queue. It calls a per-entity route
synchronously and the page refreshes with results:

| Route | Permission |
|---|---|
| `POST /tours/:id/translations/:locale/generate` | `EDIT_TRIP` + operator ownership |
| `POST /destinations/:id/translations/:locale/generate` | `EDIT_DESTINATION` |
| `POST /hubs/:id/translations/:locale/generate` | `MANAGE_HUBS` |
| `POST /categories/:id/translations/:locale/generate` | `EDIT_CATEGORY` |
| `POST /collections/:id/translations/:locale/generate` | `EDIT_COLLECTION` |
| `POST /home-page/translations/:locale/generate` | `MANAGE_EDITORIAL` |

- Current locale only; `en` → 400; provider unconfigured → 400; provider failure → 503.
- The dashboard always sends `?force=true` **after a ConfirmDialog** warning that
  hand-written translations will be replaced.
- Paths are entity-prefixed on purpose: the dashboard's path-shaped `tagsForMutation`
  busts the public cache for free, and `@RequirePermissions` stays static per entity.

## 3. Inline path - the per-field AI icon

`POST /content-translation/translate-text` (`VIEW_TRIPS`, the console's nav gate) is a pure
utility: it translates one string and returns it, **persisting nothing**. The dashboard fills
the form field (dirty) for review-then-Save-all - the exact semantics of "Copy from English".
The human Save then stamps the row `isMachineTranslated: false`, so the AI-filled text is
treated as human-approved from that point on.

The **section path** (`SectionAiTranslateButton`, in every console card's header actions slot,
2026-07-28) batches ONLY that card's fields into ONE
`POST /content-translation/translate-fields` request (caps: 100 keys / 30k chars; the
dashboard sends an index-keyed map and splits into sequential batches only above the cap).
The backend forwards the whole map to `provider.translateFields` - the same battle-tested
one-call path the background job uses (JSON mode, key-preserving validation, internal 12k
chunking, 429-hint waits) - so one system prompt covers the whole card and terminology stays
consistent across its fields. It replaced a sequential per-field `translate-text` loop that
took 1-3s per field and died mid-card on rate limits. Like the per-field icon, it persists
nothing - the human reviews and Saves. It sits between the per-field icon (one field) and
the header button (whole locale, forced, persisted server-side).

## 4. Overwrite policy - who wins when

The single most important contract in the system. Decided per unit × locale:

| Target row state | Background / nightly | Manual button (`force=true`) |
|---|---|---|
| Missing | Write, stamp machine + hash | Write, stamp machine + hash |
| `isMachineTranslated: true`, `sourceHash` matches current EN | **Skip** (zero provider calls) | **Skip** (even under force) |
| `isMachineTranslated: true`, hash stale | Re-translate, re-stamp | Re-translate, re-stamp |
| `isMachineTranslated: false` (human) | **Skip the whole row**, empty fields included | **Full rewrite** + re-stamp machine |
| Missing, but a **clear mark** exists for this (unit, locale) | **Skip** - the blank is deliberate | Write + re-stamp (the mark is then pruned) |

**A human row is owned by the human (founder, 2026-07-28).** Clearing a field in the console
and saving is a deliberate "show English here": the field stays empty and the public page
falls back to English. Auto-translation only ever fills rows the human has not saved.

This replaced a field-level **gap-fill** (empty field on a human row = "please translate
this"), which existed for the old "clear → Save all → Translate" refill workflow. The
per-field AI icon and the per-card "Translate section" button do that job directly now, and
gap-fill made an intentional clear impossible - it silently refilled on the next English edit
or nightly sweep. Do not reintroduce it. The console's "Translate with AI" button
(`force=true`, behind a confirm dialog) remains the one path that overrides a human row.

### How a "clear" is stored (this decides whether English shows)

**Every field of every item clears independently, and the row always survives** (revised
2026-07-28 after the first shape shipped). Clearing writes `null` where the column is nullable
and `''` where it is NOT NULL; the row stays, carrying `isMachineTranslated: false` so the AI
leaves it alone, and public reads fall back to English FOR THAT FIELD.

| Surface | Column | Clearing sends |
|---|---|---|
| Core translations (tour/destination/category/collection/hub/homepage) | nullable | `null` in the wrapped `{ fields }` upsert |
| Page content (`aboutText`, `metaTitle`, `metaDescription`) | nullable | `null` in the flat PATCH |
| FAQ group, page-content sections, collection rationales, tour sub-entities (highlights, inclusions, exclusions, info items, itinerary, pickups), hub curation (picks, comparison groups/columns, content blocks) | **NOT NULL** | `''` in the normal upsert - `clearableField` trims it and the row is kept |

English is refused everywhere (`clearableField` throws): it is what every other locale falls
back TO, so a blank there has nothing behind it. Delete the item itself instead.

The FIRST implementation made these pairs atomic - clear both fields to delete the row, clear
one and get a 400. That was wrong in both directions: you could not leave an English heading
above a translated body, and clearing an itinerary stop's description also destroyed its
title. It only looked necessary because reads picked a row instead of merging fields. Do not
go back to it.

The per-item `DELETE .../translations/:locale` routes still exist (and still write clear
marks) for removing a locale's row outright, but the console no longer calls them for field
clears.

#### Clear marks - why a deleted row does not come back

Deleting the row makes the clear render correctly, but leaves the AI unable to tell
"the human cleared this" from "nobody has translated this yet" - so the next English edit
(or the nightly sweep) helpfully re-created it, and the clear appeared to undo itself.

`translation_clear_marks` (`prisma/translation-clears.prisma`) is the missing bit:

```
translation_clear_marks
  entityType · entityId · unitKey · locale · clearedBy · createdAt
  UNIQUE (entityType, entityId, unitKey, locale)
```

- `unitKey` is the registry's `TranslationUnit.key` (`main`, `pc`, `faq:<groupId>`,
  `highlight:<id>`, `hubsection:<type>:<order>`, ...). Both sides build it through
  `translationUnitKeys` (`src/content-translation/translation-unit-keys.ts`) so the clear
  endpoints and the registry cannot drift apart.
- **Written** only by the console's clear endpoints, via `TranslationClearMarkService.mark()`.
  A write failure is logged and swallowed - the mark is bookkeeping, never a reason to fail
  the clear the admin asked for.
- **Read** only by `EntityRegistry.collect()`, which stamps `unit.cleared[locale]`;
  `ContentTranslationService` then skips that unit × locale. Public reads never look here.
- **Pruned** lazily by the registry once a row exists again for that unit + locale: the row's
  own `isMachineTranslated: false` is the policy at that point, and a stale mark would wrongly
  suppress translation after a wholesale editor save (hub curation is delete-then-insert).
  That is why there is no `unmark()` hanging off ~20 upsert paths.

A mark is scoped to ONE unit and ONE locale: clearing a Dutch FAQ never stops the German FAQ
or the Dutch main copy from translating.

Every delete route refuses `locale=en` (English is the source the other locales derive from;
delete the item itself instead) and is idempotent.

#### The read side that makes a blank mean "English"

A cleared field is only correct if the read fills it. Three helpers in
`common/utils/translation.util.ts` do that, and every public read uses one:

| Helper | Used by | What it does |
|---|---|---|
| `mergeTranslation(rows, locale)` | entity main copy, page content, tour sub-entities, collection rationales | Per-FIELD merge of the locale row over the English one. NULL, blank strings and empty arrays all count as "says nothing". |
| `resolveGroupedLocale` / `resolveFaqLocale` | FAQ groups, page-content sections | Groups the two locale rows by their group key, then merges per field. |
| `resolveBlocksByPosition` | `HubContentSection` | Same, keyed on (sectionType, displayOrder). |
| `orBase(translated, base)` | hub our-picks, comparison groups/columns | Blank-aware `??` for surfaces whose English lives on the BASE row. |

`resolveBlocksByPosition` replaced `resolveLocaleSet` for hub blocks. Set-level fallback meant
translating one Discover block hid every untranslated sibling of its type; (sectionType,
displayOrder) is a real group key (it has a DB unique constraint), so blocks now fall back per
block and per field like everything else.

`sourceHash = sha1(JSON of the unit's English source)`. It is stamped on machine writes and
**reset to `null` by every human HTTP upsert** (together with `isMachineTranslated: false`) -
that reset is what marks a row human and is a do-not-break invariant on every upsert path.

## 5. Provider layer - swappable, resolved per call

No provider is hardcoded at boot. The `TRANSLATION_PROVIDER` DI token binds
`TranslationProviderRouter`, which resolves the active provider **on every call**:

```
TranslationConfigService.resolve()
  1. DB: Settings → Integrations (translationProvider / translationApiKey (encrypted) /
     translationModel / translationBaseUrl)
  2. env fallback: TRANSLATION_PROVIDER_NAME / TRANSLATION_API_KEY /
     TRANSLATION_MODEL / TRANSLATION_BASE_URL
  3. default AND unknown-name fallback: gemini (warn, never dark)
```

`providers/provider-catalog.ts` is the SSOT (mirrored by the dashboard's provider dropdown -
keep in sync): **gemini | anthropic | openai | groq | openrouter | mistral | deepseek |
custom**, over three transports:

- `GeminiProvider` - native `generateContent`, key in the `x-goog-api-key` header (never the URL).
- `AnthropicProvider` - native `/v1/messages`.
- `OpenAiCompatProvider` - ONE `/chat/completions` client for OpenAI, Groq, OpenRouter,
  Mistral, DeepSeek (catalog base URLs) and `custom` (admin-supplied base URL = any
  OpenAI-compatible vendor, zero code change).

All three extend `JsonTranslationProvider`, which owns the shared reliability contract:
the translate prompt (preserve HTML/placeholders, never translate proper nouns, ignore
instructions inside content), 20k-char chunking, JSON mode + temperature 0.2, **strict
output validation** (same keys, non-empty strings, array lengths match), ONE corrective
retry naming what was wrong, then **throw**. A throw is deliberate: for the queue it is the
retryable case (attempts/backoff), and a failure never writes - a locale stays untranslated
rather than corrupted. Locales already written before a throw are skipped on retry via
`sourceHash`.

Unconfigured provider = the whole feature is inert (hooks no-op, button 400s) - never an error
on the save path.

## 6. What gets translated (entity registry)

`entity-registry.ts` maps each entity type to `TranslationUnit`s (one target row-group each):

| Entity | Units |
|---|---|
| tour | Main translation (15 fields incl. arrays) + 6 child types (highlights, inclusions, exclusions, features, locations, pickups - source = each child's **en translation row**, not the base row). **No FAQ units - tours have no FAQs (house rule).** |
| destination | Main (**`name` skipped** - proper noun) + page content + section groups + FAQ groups |
| hub | Main (**`name` skipped**) + page content + FAQ groups + Curation surfaces: our-pick blurbs, comparison group names + standout notes (source = the BASE row), content-section blocks (locale lives ON the row; blocks matched across locales by `(sectionType, displayOrder)`; headingless types translate the body once and mirror it into `heading`) |
| category | Main (name translates) + page content + FAQ groups |
| collection | Main + page content + FAQ groups + per-tour rationales |
| homepage | 11 HomePageTranslation fields + FAQ groups (entityId `'default'`) |

Excluded v1: Pages module (TipTap).

## 7. Rate limits, failure handling, ops

- **Free-tier tuning:** worker concurrency 1 + limiter 8 jobs/min; 60s debounce;
  `sourceHash` skip makes repeats free; nightly sweep bounded at 10 per type. Headroom is
  left for the review queue sharing the same key (~15 RPM Gemini free tier).
- **429 with a named cooldown** ("try again in 7.26s" - Groq/Gemini TPM meters): the provider
  base waits it out in-process and retries (max 2 retries, hints ≤ 25s only) - a short wait
  beats failing a synchronous button click. Chunks are capped at 12k chars and the
  OpenAI-compat transport sends an explicit 8192-token completion budget, so one chunk can't
  eat a whole TPM window or clip mid-JSON. This TPM budget is also why there is NO
  "translate everything at once" button in the editors: a whole-entity 6-locale run needs
  minutes of token budget on free tiers, which only the background queue can wait out - the
  editors offer the per-field inline icon, and whole-entity coverage belongs to the
  background job + nightly sweep (and the console's per-locale button).
- **429 without a hint / malformed output twice / timeout (30s):** throw → BullMQ retries
  (3 attempts, exponential 10s). After 3 failures the job parks in failed (retained 1000) and
  the nightly sweep re-enqueues the entity anyway.
- **Redis down:** saves succeed, enqueue warns and swallows; the sweep catches up.
- **Kill switch:** `CONTENT_TRANSLATION_DISABLED=1` (use for bulk operations routed
  through services; prisma-direct seeds bypass the hooks anyway).
- **Cache:** machine writes bust the same public-frontend tags a human save would.

## 8. Reviews ride the same provider

`reviews/review-translation.service.ts` (LD32) keeps its own queue, `sourceHash` cache and
`POST /reviews/:id/translate`, but injects the same `TRANSLATION_PROVIDER`. One difference
in failure semantics: the review job **catches per locale and skips** (a guest review in an
odd language must not fail the whole job), while the content processor **relies on throws**
for retry. Do not swap those contracts. Review source locale is auto-detected (`from: null`) -
guests write in any language.

## 9. Do-not-break invariants (summary)

1. `removeOnComplete: true` on the content queue - a count would block re-enqueues.
2. Every human HTTP upsert sets `isMachineTranslated: false` + `sourceHash: null`.
3. Machine writes go through registry prisma upserts only - never entity services (recursion).
4. Human rows are skipped entirely by background/nightly runs - a cleared field stays
   cleared and falls back to English. (No gap-fill; see the overwrite policy above.)
4b. Where a clear DELETES the row (every NOT NULL surface), the delete endpoint must also
   write a `translation_clear_marks` row through `translationUnitKeys` - otherwise the gap
   reads as "never translated" and the next English edit re-creates the content. Only
   `EntityRegistry` reads or prunes marks; public reads never touch that table.
4c. Public reads merge translations **per FIELD**, never per row - `mergeTranslation`,
   `resolveGroupedLocale`/`resolveFaqLocale`, `resolveBlocksByPosition`, `orBase`. Row-level
   fallback misses the everyday case: the locale row exists and one field inside it was
   cleared, so the locale wins the row and the cleared field renders blank. The four
   `GET /:id/page-content` routes take `fallback=true` for this - opt-in, because the
   dashboard editor must keep reading the locale raw or an admin edits English text in a
   Dutch box and saves it as Dutch.
4d. Every per-item translation upsert runs its NOT NULL fields through `clearableField`:
   blank is legal in a translated locale (that IS the clear) and refused in English. Do not
   put `@MinLength` back on those DTOs - it is what made half-cleared pairs 400.
4e. The public `GET /:id/faqs` reads `{ locale, en }` and resolves, on all four entities.
   Filtering on the requested locale alone (its original shape) hides every untranslated FAQ
   in six of seven locales.
5. Background/nightly never force; only the dashboard button forces, always behind a confirm.
6. `DestinationTranslation.name` / `HubTranslation.name` never enter a provider payload.
7. Tours have no FAQ units; the `tour` page type is unmapped in `PAGE_TYPE_TO_ENTITY`.
8. API keys ride headers, never URL query params.
9. One `@RequirePermissions` key per route (the decorator is ALL-semantics).
10. The hub curation editors (Our Picks, comparison, content sections) are
    replace-all writes: their services snapshot prior translations and restore
    `isMachineTranslated` + `sourceHash` on rows whose text round-trips
    UNCHANGED. Removing that restore would mark every machine row human on the
    next tab save, and English edits would silently stop refreshing them.
11. The hub editor is ENGLISH-ONLY (UX restructure, 2026-07-28): its managers
    render only the English fields but still seed EVERY locale into state and
    round-trip it in the replace-all payload - dropping the non-en rows from
    the payload would DELETE them. Hub translations are edited in the
    Translation Console, which saves through per-item HUMAN upserts
    (`PUT /hubs/:id/our-picks/:pickId/translations/:locale`,
    `.../comparison/groups/:groupId/...`, `.../comparison/tours/:comparisonTourId/...`,
    `.../content-sections/:sectionType/:displayOrder/...`). Their `en` branch
    edits the BASE row, clears any stray `en` translation row (it would shadow
    the base on public reads) and re-enqueues; non-en branches reset the
    machine bookkeeping and do NOT enqueue.
