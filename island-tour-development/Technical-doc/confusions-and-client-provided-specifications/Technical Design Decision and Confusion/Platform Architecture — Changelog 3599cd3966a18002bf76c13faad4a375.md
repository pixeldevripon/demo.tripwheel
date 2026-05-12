# Platform Architecture — Changelog

## Platform Architecture - Changelog

Date: April 13, 2026 

Author: Denley

 Affects: Platform Architecture briefing + Slug Registry document

## 1. All Tours Listing Page (new)

Added a dedicated All Tours page at /{locale}/{destination}/tours/ (e.g. /en/curacao/tours/).

**Why a separate page**: The destination page (//en/curacao/) targets discovery intent - “things to do in Curaçao.” The new /tours/ page targets transactional intent - “tours in Curaçao.” These are two different search queries with different user mindsets. Keeping them on separate URLs avoids keyword cannibalization and lets each page be optimized independently.

The “Browse all tours in Curaçao →” CTA on the destination page now links here.

## Impact on the architecture:

- The slug tours is reserved per destination in the slug registry (entity_type: reserved). Nobody can create a tour, hub, or collection with this slug.
- The entity_type ENUM in the slugs table now includes reserved as a valid value.
- Pre-seeding logic seeds 20 slugs per destination (19 categories + tours), up from 19.
- Routing logic maps entity_type: reserved → dedicated page component (AllToursPage).
- The page supports full filter and sort, with category as a facet filter.
- Rendering: ISR with 60 -second revalidation.
- Breadcrumb: Home → Destination → All Tours.
- Structured data:CollectionPage + ItemList + BreadcrumbList.

## Impact on UI/UX briefing - page numbering updated:

- 4.3 - All Tours Page (new)
- 4.4 - Category Page (was 4.3)
- 4.5 - Activity Hub Page (was 4.4)
- 4.6 - Collection Page (was 4.5)

## 2. Multi-language from launch (7 languages)

The platform is multi-language from day one. Not “English with future i18n support” - all 7
languages at launch.
Languages: English (primary), Spanish, Dutch, Portuguese, French, German, Chinese.
URL strategy: Locale prefix + English slugs. Same approach as Viator.

```
/en/curacao/boat-tours/ → English
/es/curacao/boat-tours/ → Spanish (content translated, slug stays English)
/nl/curacao/boat-tours/ → Dutch
```

Why English slugs (not translated): Translated slugs would multiply the slug registry by 7 x and create massive operational complexity. The target audience (international tourists) predominantly searches in English. The SEO value lives in translated page titles, meta descriptions, and content - not in the slug.

## Impact on the architecture:

- All URLs are prefixed with a locale code (//en//,//es/, //nl/, //pt/, //fr/, //de/, //zh/).
- Next.js route pattern: pages/[locale]/[destination]/[slug].tsx.
- Slug registry is locale-independent - same slug resolves identically across all languages.
- New translations table stores per-locale content:(entity_type, entity_id, locale, field, value).
- English is the fallback for missing translations.
- API endpoints accept ?locale=xx parameter.
- Every page requires hreflang tags linking all 7 locale versions $+x$default $\rightarrow$ English.
- Sitemaps are generated per locale per content type.
- Frontend must use next-intl or react-i18next - no hardcoded English strings.

## 3. Day Trips category definition corrected

Previous definition implied Day Trips were about “traveling to a destination.” This was inaccurate - a West Coast buggy tour is also a day trip.

Updated definition: “Day Trips” is the only category based on duration and commitment level rather than activity type. It groups tours that take up a significant portion of the day (typically $6+$ hours), regardless of the activity.