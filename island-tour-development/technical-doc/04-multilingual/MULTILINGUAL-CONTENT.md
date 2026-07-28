# Multilingual content

> **Canonical source:** master §1.3 (languages & currency), §2.2 (English slugs). How the platform
> stores, fetches, falls back, and translates content across 7 locales, and how display currency is
> resolved.

## Locales

Seven locales from launch, **English primary**: `EN, NL, DE, FR, ES, PT, ZH`. (The DB `Locale`
enum is `en, es, nl, pt, fr, de, zh` — the same set.) All UI strings go through `next-intl`; no
hardcoded English anywhere.

- **Slugs are always English**, never translated — one slug worldwide per page. The locale prefix
  alone switches language (`/en/…`, `/nl/…`, `/zh/…`). See
  [../02-architecture/ROUTING-AND-RESOLUTION.md](../02-architecture/ROUTING-AND-RESOLUTION.md).
- The tagline "Island Tours. Built by Islanders." stays English in every locale (brand mark).

## Display currency

Currency is **locale-default with a footer selector override**, NOT destination-based:

| Locales | Default currency |
|---|---|
| EN, ZH | USD |
| NL, DE, FR, ES, PT | EUR |

- The footer currency selector lets the user override the default; the override **persists for the
  session**. The nav never carries the selector.
- Locale-aware formatting applies (`$1,234.56` vs `€1.234,56`).
- `destination.currency` is **operator/payout context only** — it does not drive display currency.
- IP-based currency localization is roadmap.

## Storage model — typed translation tables (not EAV)

Each translatable entity has a typed child table keyed `(entityId, locale)` unique. Already built:

| Entity | Translation table | Fields |
|---|---|---|
| Destination | `DestinationTranslation` | name, overview, h1Override, breadcrumbLabel, isMachineTranslated |
| Category | `CategoryTranslation` | (same shape) |
| Hub | `HubTranslation` | (same shape) |
| Trip | `TripTranslation` | title, overview, description, isMachineTranslated |
| Collection | `CollectionTranslation` | name, overview, h1Override, breadcrumbLabel, isMachineTranslated |
| Tour highlights / inclusions / exclusions | `Tour*Translation` | text/label, isMachineTranslated |

SEO meta is stored separately per locale in the `*PageContent` tables (`metaTitle`,
`metaDescription`, `aboutText`). FAQ is a polymorphic table (`pageType` + `entityId` + `locale`).

`name` overrides are optional; a null translated `name` falls back to the canonical base value.

## Fetch & fallback

Content endpoints accept a `locale` query param (default `en`). The service fetches the requested
locale and **falls back to English** field-by-field when a translation row or field is missing —
never a blank render. This applies to names, overviews, and meta alike.

## Upsert payload contract

Translation upserts wrap fields in a `fields` key plus an `isMachineTranslated` flag. Sending fields
flat fails the global `ValidationPipe` (`forbidNonWhitelisted` → 400).

```jsonc
// ✅ correct
{ "fields": { "name": "…", "overview": "…", "h1Override": null, "breadcrumbLabel": null },
  "isMachineTranslated": false }
```

### English (base-locale) tab rules

- `name` is read-only on the English tab (it is the canonical value, edited in the Details tab).
- All other fields are editable.
- The "Delete translation" action on English does **not** call the delete endpoint (backend blocks
  it). It clears editable fields via an upsert with them set to `null` ("Clear fields").

## Machine translation (BUILT 2026-07-27 - `src/content-translation/`)

> **Full pipeline walkthrough (triggers, BullMQ flow, overwrite policy, invariants):
> `AI-TRANSLATION-FLOW.md`** (this section is the summary).

AI translation is live for every Translation-Console entity. The surface is provider-agnostic:
the admin picks the provider on `Settings > Integrations > AI Translation` (dropdown + API key +
per-provider model dropdown with Free/Paid badges + base URL for `custom`), resolved PER CALL by
`TranslationProviderRouter`. The provider catalog
(`src/content-translation/providers/provider-catalog.ts`, mirrored in the dashboard card) covers
**gemini, anthropic, openai, groq, openrouter, mistral, deepseek and custom** over three
transports - Gemini native, Anthropic Messages native, and ONE OpenAI-compatible client that
serves every chat-completions vendor, including `custom` with an admin-supplied base URL
(Together, xAI, self-hosted Ollama/vLLM - any provider, any model, no code change). **Gemini**
(default model `gemini-2.5-flash-lite`) is the default AND the fallback. Env fallbacks:
`TRANSLATION_PROVIDER_NAME` / `TRANSLATION_API_KEY` / `TRANSLATION_MODEL` /
`TRANSLATION_BASE_URL`. Unconfigured = the whole feature is inert.

Two triggers:

- **Background**: every English-source write (entity/child translation upserts, FAQ groups, page
  content, sections, collection rationales) fire-and-forget enqueues a BullMQ job
  (`content-translation` queue, jobId `type__id` (no `:` - BullMQ rejects it), 60s debounce, worker limiter 8 jobs/min for the
  free tier) that translates the whole entity into the six other locales. A nightly sweep
  (`enqueuePending`, inside `NightlyJobsService.run()`) backfills what the debounce race or an
  outage dropped.
- **Manual**: the "Translate with AI" button on the translation editor page calls
  `POST /{tours|destinations|hubs|categories|collections}/:id/translations/:locale/generate`
  (homepage: `POST /home-page/translations/:locale/generate`) - synchronous, current locale only,
  per-entity write permission + tour ownership enforced.
- **Inline per-field**: every workspace field has a small AI icon that calls
  `POST /content-translation/translate-text` (gated on `VIEW_TRIPS`, the console's nav gate). Pure
  utility - the translated text fills the form field for review and nothing is persisted until
  "Save all", exactly like "Copy from English".

Overwrite policy (founder-locked): machine writes fill missing rows and refresh rows flagged
`isMachineTranslated = true` whose `sourceHash` no longer matches the English source. **A field a
human saved is never overwritten** - on human-flagged rows the AI gap-fills only the EMPTY fields
(e.g. a field cleared-and-saved to be re-translated) and the row keeps its human flag; every
human upsert path resets the flag + hash. Proper nouns
(`DestinationTranslation.name`, `HubTranslation.name`) never enter a provider payload. The hub
curation surfaces are covered since 2026-07-28: our-picks blurbs, comparison group names +
standout notes, and `HubContentSection` blocks (matched across locales by
`(sectionType, displayOrder)` - the dashboard editor's own grouping convention; headingless
block types translate the body once and mirror it into `heading`). Their replace-all editors
preserve machine flags on translations that round-trip unchanged, so English edits keep
refreshing machine rows. Excluded v1: the Pages module (TipTap).
Tours have no FAQs (house rule), so the tour fan-out has no FAQ units.

Reviews (LD32) ride the **same Gemini provider** since 2026-07-27 - the queue, sourceHash cache
and `POST /reviews/:id/translate` endpoint are unchanged; only the Google Cloud Translation client
was replaced. The `googleTranslate*` settings columns are deprecated storage (no reader, no
dashboard card, no env validation).

## SEO i18n

`hreflang` across all 7 locales plus `x-default → EN` on every content page. On slug rename a `301`
is issued (slugs are not immutable). On admin content update, on-demand ISR revalidation fires for
all 7 locale URLs. See [../02-architecture/SEO-STRATEGY.md](../02-architecture/SEO-STRATEGY.md).
