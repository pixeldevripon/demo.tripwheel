# SEO strategy

> **Canonical source:** master §2.6 (structured data), §2.2 (URLs/hreflang), §2.4 (category
> gating), §8.2 (TYP noindex). The platform's SEO model: meta, canonicals, hreflang, JSON-LD,
> sitemaps, robots, and the ethical-CRO signal rules.

The destination page owns destination-level keywords and About content; each category page owns its
vertical's About content; the All Tours page owns long-tail filter queries (SEO ownership lock,
master conflict log 67). No page duplicates another's keyword territory.

## Meta & content storage

- Per-entity, per-locale meta lives in `*PageContent` tables (`metaTitle`, `metaDescription`,
  `aboutText`) keyed `(entityId, locale)`. Already built for destinations, categories, hubs,
  collections.
- Tour meta is **derived** at render: title from the translated name (LD15 H1 pattern), description
  from the overview, `og:image` from the hero image.
- Global defaults live in the `SiteSEO` singleton.
- **Fallback:** a missing translation falls back to English; a missing `metaTitle` falls back to a
  template (`"{name} | Island Tours"`); a missing description falls back to empty rather than a bad
  guess.

## Canonicals, locale & hreflang

- One canonical URL per tour: flat `/{locale}/{destination}/{tour-slug}/`, per-locale, trailing
  slash. See [ROUTING-AND-RESOLUTION.md](./ROUTING-AND-RESOLUTION.md).
- `hreflang` pairs across all **7 locales** (EN, NL, DE, FR, ES, PT, ZH) plus `x-default → EN` on
  every content page. Slugs are English in every locale; only the locale prefix switches language.
- **Renames issue a 301** from the old URL (redirect table); deleted slugs observe the 90-day reuse
  cooldown. Canonical chains therefore stay clean. See
  [SLUG-REGISTRY.md](./SLUG-REGISTRY.md).
- Filtered listing URLs (`?booking_type=private`) carry a self-referencing canonical to the clean
  URL (master conflict log 61).

## Structured data (JSON-LD per surface)

| Surface | Schema |
|---|---|
| Every page with breadcrumbs | `BreadcrumbList` |
| Tour detail | `Product`/`Offer` with `acceptedPaymentMethod` (incl. ApplePay, GooglePay), `audience.suggestedMinAge` from `min_age_years`, accessibility fields, `refundPolicy` from `cancellation_hours`, `includes`/`excludes` arrays, plus `Review` + `AggregateRating` |
| Help Center `/help` | `FAQPage` |
| Collection, Activity Hub | `FAQPage` on their FAQ sections |
| Destination | `FAQPage` on the NeedHelp FAQ column |
| All Tours | `ItemList` on the grid + `BreadcrumbList`; server-rendered crawlable list |
| Search results | none — `noindex, follow` |

## Category gating (thin-content guard)

A category page is indexable only at **≥3 published tours** in that destination+category. Below the
threshold it is `status: draft` — 404 to crawlers, excluded from nav, internal links, sitemaps, and
search. The check runs on every tour status change in both directions. See master §2.4 and
[ROUTING-AND-RESOLUTION.md](./ROUTING-AND-RESOLUTION.md) (two 404 layers: registry miss vs gating).

## Sitemaps & robots

- `/sitemap.xml` index plus per-locale and per-page-type sitemap files; published entities only;
  categories below the ≥3 threshold excluded; `lastmod` on change.
- `robots.txt`: disallow `/admin`, `/api`, `/dashboard`; allow `/`; declare the sitemap.
- The Thank You page (`/{destination}/thank-you/{public_ref}`) is **noindex** and carries no locale
  prefix (transactional surface). See [TRACKING-AND-ANALYTICS.md](./TRACKING-AND-ANALYTICS.md).

## Ethical CRO signals (no dark patterns)

Transparency is a brand pillar: no fake urgency, no fake scarcity, no badge inflation, no
pre-checked add-ons. Paid placement always carries the `Sponsored` badge.

- The only demand signal is the single sell-out trigger (master §3.7), driven by real
  `recent_sellouts` data.
- Capacity messaging uses live availability ("Only N left" in the party selector), never invented
  countdowns. CRO counters (`booking_count`, `booking_count_today`, `spots_remaining`,
  `last_booked_at`) exist in the model but have **no consumer urgency surface in v1**.
- `Most popular` is editorial/quality-based (organic tour, `review_count ≥ 10`, rating `≥ 4.5`,
  max 1 per category), never commission-driven. See [COMMERCIAL-MODEL.md](./COMMERCIAL-MODEL.md).

## Implementation status

Backend SEO data (meta tables, `aboutText`, derivable tour fields) is largely in place. The
frontend rendering layer (meta emission, canonical/hreflang tags, JSON-LD emitters, sitemaps,
robots, breadcrumb JSON-LD) is a build task tracked in
[../MASTER-CHECKLIST.md](../MASTER-CHECKLIST.md).
