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

## Machine translation

A background job (BullMQ) translates content to the other six locales after the English source is
saved, setting `isMachineTranslated = true`. Proper nouns (destination and hub names) are never
machine-translated. Reviews use the LD32 path (Google Translate API with a show-original toggle),
cached per locale.

## SEO i18n

`hreflang` across all 7 locales plus `x-default → EN` on every content page. On slug rename a `301`
is issued (slugs are not immutable). On admin content update, on-demand ISR revalidation fires for
all 7 locale URLs. See [../02-architecture/SEO-STRATEGY.md](../02-architecture/SEO-STRATEGY.md).
