# Technical Design Decision and Confusion

Tags: Engineering, On Going, Research
Created time: May 7, 2026 12:55 PM
Created by: Shahadat Hussain Ripon _devripon

## 1. Top Island Experience

![image.png](Technical%20Design%20Decision%20and%20Confusion/image.png)

Q: It seems these are categories. how these categories will be select as top, or will show all categories as Top?

## 2. How destination will work?

![image.png](Technical%20Design%20Decision%20and%20Confusion/image%201.png)

**Q:** Seems there’s some pre-defined destination. Is the destination fixed?

- If **No**, will Tour Operator be able to create Destination?
    - If **Yes**, can Tour Operator create destination across the world and list here?
    - If **No**, which destinations can be added by Tour Operators?
- If **No**, only admin will create destinations and operators will use these destinations when creating a trip?
- If **Yes**, which locations will be predefined?

## 3. How Categories will work?

![image.png](Technical%20Design%20Decision%20and%20Confusion/image%202.png)

**Q:** Seems there’s some pre-defined Categories. Is these Categories fixed?

- If **No**, will Tour Operator be able to create Categories?
    - If **No**, only admin will create destinations and operators will use these destinations when creating a trip?
- If **Yes**, which Categories will be predefined?

## 4. How Badges will work?

![image.png](Technical%20Design%20Decision%20and%20Confusion/image%203.png)

**Q:** How Badges will applied to trip? whats the logic behind it?

- Is the badges fixed? or can be create from admin panel by Admin only?

## 4. How this 3 types of booking will work?

![image.png](Technical%20Design%20Decision%20and%20Confusion/image%204.png)

## 5. Whats the difference between Boat tours and Boat Tour active?

![image.png](Technical%20Design%20Decision%20and%20Confusion/image%205.png)

![image.png](Technical%20Design%20Decision%20and%20Confusion/image%206.png)

## 6. How this additional content of each destination and category page will be managed?

![image.png](Technical%20Design%20Decision%20and%20Confusion/image%207.png)

![image.png](Technical%20Design%20Decision%20and%20Confusion/image%208.png)

Q: Is will be came from Admin dashboard panel? is it so that its very conflicting if Tour Operators are able to create Categories and Destinations.

## 7. What does it mean **Klein Curaçao?**

![image.png](Technical%20Design%20Decision%20and%20Confusion/image%209.png)

![image.png](Technical%20Design%20Decision%20and%20Confusion/image%2010.png)

![image.png](Technical%20Design%20Decision%20and%20Confusion/image%2011.png)

Q: **Klein Curaçao** it seems a destination but here it works like a activity or category? than how this private charter and boat related things are here? how this **Klein Curaçao** will work here?

## 8. How this comparison will work ?

![image.png](Technical%20Design%20Decision%20and%20Confusion/image%2012.png)

Q: Its showing 6 trips based on two Types, “Comfort” “Adventure”? How we will decide which trips are need to compare?

## 9. Whats about these cards ? is it Blogs or static content?

![image.png](Technical%20Design%20Decision%20and%20Confusion/image%2013.png)

## 10. Whats about the Inclusions? (Pickups, Free Cancellation, Bar, Bear etc)

## 11. Platform Architecture

[Platform Architecture — Changelog](Technical%20Design%20Decision%20and%20Confusion/Platform%20Architecture%20%E2%80%94%20Changelog%203599cd3966a18002bf76c13faad4a375.md)

## 12. Platform Technical Architecture

[Island Tours — Tour Detail Page Specification-1-8](Technical%20Design%20Decision%20and%20Confusion/Island%20Tours%20%E2%80%94%20Tour%20Detail%20Page%20Specification-1-8%203599cd3966a18010b62cd513ee420726.md)

[Island Tours — Tour Detail Page Specification-9-15](Technical%20Design%20Decision%20and%20Confusion/Island%20Tours%20%E2%80%94%20Tour%20Detail%20Page%20Specification-9-15%203599cd3966a1808b92fdc07ae00b351d.md)

[Island Tours — Tour Detail Page Specification-16-20](Technical%20Design%20Decision%20and%20Confusion/Island%20Tours%20%E2%80%94%20Tour%20Detail%20Page%20Specification-16-2%203599cd3966a180c8bab2f75d573fe0e4.md)

[Island Tours — Tour Detail Page Specification-21-28](Technical%20Design%20Decision%20and%20Confusion/Island%20Tours%20%E2%80%94%20Tour%20Detail%20Page%20Specification-21-2%203599cd3966a180d99bf9c91d2410359c.md)

## All About Multi Lingual

## Multi-language from launch (7 languages)

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
- Next.js route pattern: `pages/[locale]/[destination]/[slug].tsx.`
- Slug registry is locale-independent - same slug resolves identically across all languages.
- New translations table stores per-locale content:(entity_type, entity_id, locale, field, value).
- English is the fallback for missing translations.
- API endpoints accept ?locale=xx parameter.
- Every page requires hreflang tags linking all 7 locale versions $+x$default $\rightarrow$ English.
- Sitemaps are generated per locale per content type.
- Frontend must use `next-intl` or `react-i18next` - no hardcoded English strings.

Multilingual Features CMS data table

| Field | Type | Notes |
| --- | --- | --- |
| tour.h1_override | string (nullable) | Override for awkward template-generated H1s |
| tour.breadcrumb_label | string | Short-form for breadcrumb last segment when H1 &gt; 35 chars |
| tour.duration_minutes | int | Drives duration badge formatter |
| tour.pickup_model | enum | included / paid_addon / none |
| tour.languages[] | string[] | Language codes; rendered via locale lookup |
| `tour.gallery_images[]` | array | Ordered; first marked is_hero: true; supports manual focal-point per image |
| tour.overview_{locale} | markdown | Paragraph breaks only — no headings, lists, or bold |
| tour.highlights_{locale}[] | string[] | 3–6 items, 5–15 words each |
| tour.pricing_model | enum | per_person / unit |
| tour.unit_type | enum (nullable) | If unit: group / boat / vehicle / aircraft / package |
| tour.max_party_size | int | Tour capacity ceiling |
| tour.min_party_size | int | Default 1; some tours require 4+ |
| tour.age_bands[] | array (nullable) | When age-banded pricing applies |
| `tour.booking_cutoff_minutes` | int | Default 120; range 0–10080 (0 minutes to 1 week) |
| tour.cancellation_hours | int | Default 24; per-tour override |
| tour.add_ons[] | array (nullable) | Optional extras shown at booking step |