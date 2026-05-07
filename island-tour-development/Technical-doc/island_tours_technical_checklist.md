# Island Tours — Technical Checklist

> Development এ মাথায় রাখতে হবে এমন সব technical points। UI/design related কিছু নেই — শুধু backend ও frontend engineering।

---

## 1. URL & Routing

- [ ] URL pattern: `/{locale}/{destination}/{hub-slug?}/{tour-slug}/` — locale prefix সবসময় থাকবে, slug সবসময় English
- [ ] Reserved slug `tours` প্রতিটা destination এ block করতে হবে slug registry তে (`entity_type: reserved`)
- [ ] Slug registry table: slug → entity_type (`tour | category | hub | collection | reserved`) resolve করবে
- [ ] Next.js route: `pages/[locale]/[destination]/[slug].tsx` এবং `pages/[locale]/[destination]/[slug]/[tourSlug].tsx`
- [ ] `middleware.ts`: locale detection, `/en/` prefix সবসময় force করবে, default locale = `en`
- [ ] URL params এ booking state persist: `?date=2026-05-15&travelers=2` — refresh করলেও state থাকবে, share link ও কাজ করবে

---

## 2. Rendering Strategy

- [ ] Page shell + above-the-fold content + structured data (breadcrumb, H1, rating): **SSR**
- [ ] Booking widget: client-side hydration, `requestIdleCallback` দিয়ে LCP এর পরে defer করতে হবে
- [ ] ISR: static blocks **300s** revalidation, All Tours page **60s** revalidation
- [ ] Availability data: date-picker open হলে তখনই fetch — page load এ fetch করা যাবে না
- [ ] Hero image preload: `<link rel="preload">` দিয়ে LCP candidate হিসেবে handle
- [ ] Booking widget এর সব inputs এর stable height থাকতে হবে — hydration এ zero CLS

---

## 3. Performance Budget (Hard Limits)

- [ ] **LCP < 2.5s** — hero image এর জন্য preload + responsive `srcset` mandatory
- [ ] **INP (page) < 200ms**, **INP (booking widget) < 100ms** — widget এর date-picker, party selector সব এই budget এ
- [ ] **CLS < 0.05** — hydration এ কোনো layout shift নেই, সব element এর height pre-defined
- [ ] Image format priority: **AVIF → WebP → JPEG** fallback, max **200KB** per image after compression
- [ ] Hero image native min: **2400×1800px**, tile min: **1200×1200px**, color profile: **sRGB**
- [ ] Mobile এ শুধু hero image eagerly load, বাকি lazy queue করবে
- [ ] Desktop এ hero + tiles 2–5 eagerly load করা যায় যদি LCP hold করে; tiles 6+ lazy
- [ ] Image URLs content-hash include করবে CDN caching এর জন্য

---

## 4. Database & CMS — Tour Level Fields

- [ ] `tour.pickup_model`: enum — `included | paid_addon | none` (badge behavior নির্ধারণ করে)
- [ ] `tour.pricing_model`: enum — `per_person | unit`
- [ ] `tour.unit_type`: enum (nullable) — `group | boat | vehicle | aircraft | package` (unit pricing হলে)
- [ ] `tour.booking_cutoff_minutes`: int, default **120**, range **0–10080**; cutoff পার হলে chip "Closed" দেখাবে
- [ ] `tour.cancellation_hours`: int, default **24**, per-tour override allowed
- [ ] `tour.age_bands[]`: nullable array — age-banded pricing এ Adults/Children/Infants আলাদা rows
- [ ] `tour.add_ons[]`: nullable array — **EU Digital Fairness Act: কোনো add-on pre-checked রাখা যাবে না**
- [ ] `tour.max_party_size` এবং `tour.min_party_size`: booking widget এর +/- controls এর hard limit
- [ ] `tour.gallery_images[]`: ordered array, first image `is_hero: true`, manual focal-point support per image
- [ ] `tour.overview_{locale}`: markdown field, paragraph breaks only — heading, list, bold allowed নয়
- [ ] `tour.highlights_{locale}[]`: string[], **3–6 items**, 5–15 words each; CMS এ >6 হলে save block করবে
- [ ] `tour.h1_override`: string (nullable) — awkward template-generated H1 override করার জন্য
- [ ] `tour.breadcrumb_label`: string — H1 > 35 chars হলে breadcrumb এ short-form দেখাবে
- [ ] `tour.duration_minutes`: int — duration badge formatter drive করে
- [ ] `tour.languages[]`: string[] — language codes, locale lookup দিয়ে render

---

## 5. Database & CMS — Operator Level Fields

- [ ] `operator.aggregate_rating`: float, computed — সব tours এর average rating
- [ ] `operator.aggregate_review_count`: int, computed — Provider Rating fallback threshold check এর জন্য
- [ ] **Provider Rating rule (LD11):** native review < 3 **AND** operator >= 10 reviews **AND** avg >= 4.0 — তিনটা condition একসাথে পূরণ হলেই operator aggregate দেখাবে। নইলে rating row সম্পূর্ণ hidden।

---

## 6. Multilingual — 7 Languages

- [ ] 7 locales launch থেকেই: `en` (primary), `es`, `nl`, `pt`, `fr`, `de`, `zh` — missing translation এর fallback সবসময় English
- [ ] Slug locale-independent — same English slug সব 7 locale এ একইভাবে resolve করবে
- [ ] `translations` table: `(entity_type, entity_id, locale, field, value)` — সব dynamic content store
- [ ] Static UI strings (buttons, labels, error messages): `next-intl` বা `react-i18next` ব্যবহার করবে — **কোনো hardcoded English string নয়**
- [ ] Currency: `EN/NL/DE/FR/ES/PT` → **EUR**; `ZH` → **USD** — user selector নেই, locale থেকে auto-set
- [ ] প্রতিটা page এ hreflang tags: সব 7 locale version + `x-default` → English
- [ ] Sitemap: per locale per content type আলাদাভাবে generate করতে হবে
- [ ] Auto-translated content এ "Translated" badge দেখাতে হবে; human translation mandatory at launch
- [ ] Tagline **"Built by Islanders."** সব locale এ English এই থাকবে — কোনো অবস্থায় translate হবে না (brand mark)
- [ ] API endpoints: `?locale=xx` parameter accept করবে
- [ ] `hreflang` এ `x-default` → English point করবে

---

## 7. Booking Widget — State Machine

- [ ] 5 states: `S1 Initial → S2 Date picker → S3 Date selected → S4 Ready → S5 Edge` — সব transition reversible
- [ ] **Custom date picker mandatory** — native OS picker ব্যবহার করা যাবে না (conversion underperformance documented)
- [ ] **Total price সবসময় payment info enter করার আগে visible** — LD12, regulatory requirement, negotiate করা যাবে না
- [ ] CTA copy 3 stage: `"Check availability"` (browsing) → `"Continue"` (transitional) → `"Secure your spot"` (checkout)
- [ ] Trust strip exactly **4 lines**, fixed order (LD5): Free cancellation → Reserve from 20% → Confirmed in seconds → Chat 24/7
- [ ] Trust strip date-picker overlay বা modal এর ভেতরে দেখাবে না — শুধু CTA visible থাকলে দেখাবে
- [ ] Sold-out race condition: `"Continue"` tap এ final availability check — তারপর sold out হলে inline error + date kept + time slots refreshed
- [ ] Cutoff passes during session: today chip live transition to "Closed" — real-time, no page refresh needed
- [ ] Multi-variant tour (shared vs private): variant selector at widget top, **date+time reset on variant change** (different inventory)
- [ ] Unit-priced tour: counter informational only, price doesn't multiply — `"From €450 per group → Total: €450 (up to 8 people)"`
- [ ] Age-banded pricing: sub-rows Adults / Children / Infants — each with own +/- and price
- [ ] Min party constraint surfaced inline with brand-voice copy + link to smaller-group alternative if exists
- [ ] Add-ons step: appears after date + time + party, before "Continue" — only if tour has >= 1 add-on configured

---

## 8. Availability API

- [ ] Compact date chip view = **cached** availability; expanded month overlay = **live API call** per month requested
- [ ] Time slots: date select হলেই fetch; single-departure tour এ time slot picker render-ই হবে না
- [ ] Loading UX: **200ms skeleton** show করবে; >1s timeout হলে error state + retry button
- [ ] API failure: "We're having trouble loading dates. Refresh, or message us on WhatsApp." + retry + WhatsApp deep link
- [ ] Network offline: widget grey করবে, cached availability "may be out of date" tag দিয়ে দেখাবে, Continue disabled
- [ ] Low capacity display: `"1:00 PM / Only 2 left"` — real count, **never fake scarcity**
- [ ] Sold out slot: greyed chip, still visible but not selectable
- [ ] Forward booking window: max **12 months** (operator can limit per tour)

---

## 9. Date Picker — Chip Component

- [ ] Chip content: day-of-week, date, price-from, availability indicator
- [ ] Chip states: `available | sold_out | closed_day | cutoff_passed | selected`
- [ ] Compact view: horizontal-scrolling row, initial position = today
- [ ] Expanded view: "View all dates" → full-month calendar overlay, locale-aware day order, prev/next month controls
- [ ] Live data: compact = cached; expanded = live API call for requested month; time slots fetched on date select

---

## 10. Schema.org & SEO

- [ ] JSON-LD via `@graph`: `Product` + `Offer`, `TouristTrip`, `BreadcrumbList`, `FAQPage`, `AggregateRating`, `Review` — সবগুলো combined
- [ ] `BreadcrumbList` server-rendered: hub-anchored (`Home→Dest→Hub→Tour`) এবং destination-only (`Home→Dest→Tour`) দুটো format support
- [ ] `AggregateRating`: Provider Rating fallback এ operator-aggregated stats appropriate context সহ — `"From this host's N reviews across all tours"`
- [ ] All structured data **must be server-rendered** — client-side injection SEO তে count হয় না
- [ ] H1 format: `{Destination or Hub} {Tour type} with {Host name}` — 35–55 chars target, 65 hard max
- [ ] One H1 per page — all other section headings H2 or below

---

## 11. Image Gallery

- [ ] Min **5 images** না হলে tour publish block — editorial flag raise করবে
- [ ] Max **24 images** (caps lightbox scroll-tax)
- [ ] Hero ratio: **4:3**, tile ratio: **1:1**
- [ ] Gallery images: `<link rel="preload">` + responsive `srcset`, mobile only hero eagerly loaded
- [ ] Lightbox: `role="dialog"`, `aria-modal="true"`, focus trapped, ESC closes, swipe-down (mobile) closes
- [ ] Lightbox counter: `"3 / 24"` upper area
- [ ] Save (♡) icon: session storage if unauth, wishlist if auth
- [ ] Share from lightbox: same share flow as page-level share
- [ ] Body scroll locked when lightbox open
- [ ] Vertical-orientation source images: cropped to 4:3/1:1; CMS supports manual focal-point

---

## 12. Save / Share

- [ ] Save: unauthenticated হলে session storage, authenticated হলে wishlist/database
- [ ] Share order (desktop modal): **WhatsApp → copy link → email → Facebook → X**
- [ ] Mobile share: Web Share API (native sheet)
- [ ] WhatsApp share pre-fill: `"Check this out - [Tour name] on Island Tours: [URL]"`
- [ ] WhatsApp help button pre-fill: `"Hi! I'm looking at tours on Island Tours and could use some help."`

---

## 13. Accessibility Baseline

- [ ] সব interactive elements keyboard accessible + focus visible — no exception
- [ ] Booking widget: screen-reader announcements প্রতিটা state transition এ (S1→S2→S3 etc.)
- [ ] Lightbox: `role="dialog"`, `aria-modal="true"`, focus trapped inside, ESC closes
- [ ] WCAG AA color contrast minimum সব text এ
- [ ] Touch targets: minimum **44×44 CSS pixels** সব interactive elements এ
- [ ] Rating row: `tabindex` participation, Enter/Space activates, screen reader label: `"Rating: 4.8 stars out of 5, 412 reviews. Activate to read reviews."`
- [ ] Booking widget inputs: stable height pre-hydration to prevent CLS

---

## 14. Business Rules — Locked Decisions (Override করা যাবে না)

- [ ] **LD1:** Cancellation default: 24h before tour, free. Per-tour override allowed.
- [ ] **LD2:** CTA progression: `"Check availability"` → `"Continue"` → `"Secure your spot"` — exactly এই copy, এই order
- [ ] **LD3:** `"Pickup"` — hyphen নেই কোথাও, platform-wide. `"Pick-up"` লেখা যাবে না।
- [ ] **LD4:** Email confirmation = entry pass। কোনো QR code, scannable ticket, mobile ticket, app dependency নেই।
- [ ] **LD5:** Trust strip exactly 4 lines, fixed order — (1) Free cancellation up to 24h (2) Reserve from 20%, pay the rest later (3) Confirmed in seconds (4) Chat 24/7 · WhatsApp 08:00–22:00
- [ ] **LD6:** Closing trust block ends with tagline: `"Built by Islanders."` — sign-off হিসেবে
- [ ] **LD7:** Quick-info badges exactly **3টা**: Duration, Pickup, Languages — আর কিছু এখানে add করা যাবে না
- [ ] **LD8:** Mobile breadcrumbs tour detail page এ **visible** — destination page থেকে deliberate divergence, দুটো spec cross-reference করবে
- [ ] **LD11:** Provider Rating cold-start rule — উপরে section 5 এ detail আছে
- [ ] **LD12:** Total price before checkout — payment screen এ কোনো surprise fee নেই, সব itemized
- [ ] **Instant confirmation model** — 24h enquiry model সম্পূর্ণ বাদ। এটা ছাড়া অন্য সব improvement meaningless।

---

## 15. Slug Registry — Entity Types

- [ ] `tour` → Tour Detail Page component
- [ ] `category` → Category Page component
- [ ] `hub` → Activity Hub Page component
- [ ] `collection` → Collection Page component
- [ ] `reserved` → redirect to `/[locale]/[destination]/tours/`
- [ ] Slug registry **locale-independent** — same slug সব locale এ same entity resolve করে

---

## 16. Breadcrumbs

- [ ] Hub-anchored path: `Home › Destination › Hub › Tour`
- [ ] Category-anchored path: `Home › Destination › Category › Tour`
- [ ] Destination-only path: `Home › Destination › Tour`
- [ ] Separator: `›` (U+203A)
- [ ] Last segment = H1 if H1 ≤ 35 chars; else `tour.breadcrumb_label`
- [ ] Mobile: last segment never truncates, wraps to second line if long
- [ ] All items except last are linked
- [ ] Schema: `BreadcrumbList` JSON-LD server-rendered

---

## 17. Rating Row

- [ ] Rating to **one decimal**: 4.84 → 4.8
- [ ] Pluralisation per locale: "review" / "reviews"
- [ ] Number formatting per locale: 1,738 / 1.738 / 1738
- [ ] Entire row tap-target → smooth-scroll to Reviews section + URL updates with `#reviews`
- [ ] 3 display states: (1) 3+ native reviews → show, (2) <3 native but operator qualifies → operator aggregate, (3) neither → row hidden
- [ ] Do NOT show: descriptors ("Excellent"), percentage-recommended, "happy travelers" framing

---

## 18. Quick-Info Badges

- [ ] Exactly **3 badges**, fixed order: Duration → Pickup → Languages
- [ ] Duration formatter: `"8 hours"` / `"1h 30m"` / `"4 to 5 hours"` (variable)
- [ ] Pickup badge:
  - `included` → "Pickup included"
  - `paid_addon` → "Pickup available"
  - `none` → "Meeting point only"
  - field not set → default "Meeting point only"
- [ ] Languages: first 2 + count of remaining (`EN, NL, +3`)
- [ ] 5+ languages: `EN, NL, +3` format
- [ ] Duration unknown: badge omitted + content-ops flag
- [ ] **No "Free cancellation" / "Best price" / "Bestseller" / "Likely to sell out" badges here** — listing page concerns

---

## 19. Tour Overview Section

- [ ] Length: **80–150 words** ideal, **200 hard max** — CMS blocks save above 200
- [ ] Structure: Hook (1–2 sentences) → Experience (2–4 sentences) → Local tip (1 sentence, optional)
- [ ] `≥1` specific named place required
- [ ] `≥1` quantification required (duration, year count, distance)
- [ ] No visible H2 heading — section landmark via `<section>` for screen readers and crawlers only
- [ ] No "read more" expansion — spec is short by design
- [ ] Empty → section hidden, tour cannot publish

---

## 20. Highlights Section

- [ ] Min **3** bullets, recommended **5**, max **6** — CMS blocks save above 6
- [ ] Per-bullet: **5–12 words**, hard max **15** — CMS blocks save above 15
- [ ] No emojis in bullets — checkmark prefix only
- [ ] Visible H2 heading: `"Highlights"`
- [ ] <3 bullets → section hidden + tour flagged as under-spec'd

---

## 21. Mobile Sticky CTA

- [ ] Triggered when in-flow booking widget passes above viewport
- [ ] Disappears when in-flow widget re-enters viewport
- [ ] Exactly **3 elements**: price, free-cancel micro-copy, primary CTA
- [ ] Tap → smooth-scroll to in-flow widget AND open date picker (single tap, double action)

---

## 22. All Tours Page (`/{locale}/{destination}/tours/`)

- [ ] Dedicated page at `/[locale]/[destination]/tours/`
- [ ] Slug `tours` reserved per destination in slug registry
- [ ] Supports full filter and sort, category as facet filter
- [ ] ISR: **60s** revalidation
- [ ] Breadcrumb: `Home → Destination → All Tours`
- [ ] Structured data: `CollectionPage` + `ItemList` + `BreadcrumbList`
- [ ] "Browse all tours" CTA on destination page links here

---

## 23. Edge Cases to Handle

- [ ] Image load failure → blur placeholder, retry next page view
- [ ] Full CDN outage → "Photos loading…" graceful state, booking widget unaffected
- [ ] All visible dates sold out → "No spots open in next 30 days. Want us to message you?" + email capture CTA
- [ ] Missing translation → English fallback + "Translated" badge
- [ ] Overview empty → section hidden, tour cannot publish
- [ ] Highlights < 3 → section hidden, tour flagged
- [ ] Gallery < 5 images → cannot publish, editorial flag
- [ ] Tour duration unknown → duration badge omitted, content-ops flagged
- [ ] Pickup field not set → defaults to "Meeting point only"

---

*Source: Island Tours Tour Detail Page Specification (4.7.1–4.7.28) + Platform Architecture Changelog (April 13, 2026)*
