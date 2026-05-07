# Island Tours — Technical Design Full Breakdown

---

## ১. Top Island Experiences কীভাবে কাজ করবে?

"Top Island Experiences" হলো categories নয় — এগুলো হলো curated tour types যেগুলো admin panel থেকে manually select করা হবে।

**কীভাবে কাজ করবে:**

- Admin dashboard থেকে admin যেকোনো tour/category কে "featured" বা "top experience" হিসেবে mark করতে পারবে
- Database এ একটা `is_featured` boolean field থাকবে অথবা আলাদা `featured_experiences` table থাকবে যেখানে admin manually tours বা categories add করবে
- সব categories show হবে না — শুধু admin-selected গুলোই দেখাবে
- Video play button দেখা যাচ্ছে (image 14), তাই প্রতিটা featured experience এর সাথে একটা short video clip থাকবে

**Database structure:**

```sql
featured_experiences (
  id,
  entity_type,    -- 'tour' | 'category'
  entity_id,
  destination_id,
  display_order,
  video_url,
  is_active
)
```

---

## ২. Destination কীভাবে কাজ করবে?

Destination গুলো fixed এবং Admin-controlled।

Image 1 এ দেখা যাচ্ছে: Curaçao, Aruba, Sint Maarten, Saint L... — এগুলো সব Caribbean islands।

**Rules:**

- Destination শুধু Admin create করতে পারবে — Tour Operator পারবে না
- Destinations are predefined Caribbean islands (Curaçao, Aruba, Sint Maarten, etc.)
- Tour Operator শুধু existing destinations এর মধ্যে থেকে তাদের tour create করতে পারবে
- Tour Operators worldwide destination create করতে পারবে না — এটা একটা Caribbean-focused platform

**Database:**

```sql
destinations (
  id,
  name,
  slug,           -- 'curacao', 'aruba'
  is_active,
  hero_image,
  tour_count      -- computed
)
```

---

## ৩. Categories কীভাবে কাজ করবে?

Categories ও Admin-controlled এবং predefined।

Image 2 এ দেখা যাচ্ছে: Klein Curaçao, Boat Tours, Sunset Cruises, Buggy Tours, Snorkeling Trips, Private Charters।

**Important distinction — দুই ধরনের "type" আছে:**

- **Activity Hub (Special location-based):** Klein Curaçao — এটা একটা physical place যেটা নিজেই একটা hub। এখানে multiple operators যায়।
- **Regular Categories:** Boat Tours, Sunset Cruises, Buggy Tours, Snorkeling Trips, Private Charters — এগুলো activity types।

**Rules:**

- Categories শুধু Admin create করে
- Operators নতুন category create করতে পারবে না
- Operator তাদের tour create করার সময় existing categories থেকে select করবে

**Predefined categories (launch):**

```
Klein Curaçao (Hub), Boat Tours, Sunset Cruises,
Buggy Tours, Snorkeling Trips, Private Charters,
Day Trips, Catamaran Trips, Powerboat Trips, etc.
```

---

## ৪. Badges কীভাবে কাজ করবে?

Image 3 এ দেখা যাচ্ছে: New, Sponsored, Likely to sell out, Most popular

এগুলো **system-generated** — admin manually assign করে না।

| Badge | Logic |
|---|---|
| New | Tour created < 30 days ago |
| Sponsored | Operator paid for promotion (admin toggle) |
| Likely to sell out | < 20% capacity remaining in next 7 days |
| Most popular | Highest booking count in last 30 days per category |

> Tour Detail Page এ এই badges দেখাবে না (spec LD7 অনুযায়ী — শুধু Duration, Pickup, Languages দেখাবে)। এই badges শুধু listing/search page এর tour cards এ দেখাবে।

---

## ৫. "Boat Tours" vs "Boat Tours Active" — পার্থক্য কী?

এটা same page এর দুটো ভিন্ন state/view:

- **Image 5 — "Boat tours in Curaçao"** = Default listing page, broader context, filter chips include destination names (Klein Curaçao, Snorkeling, etc.)
- **Image 6 — "Boat tours active"** = Active filters applied state। Filter chips এ Duration ও Price active আছে, আর boat-type sub-filters দেখা যাচ্ছে (Catamaran, Speedboat, Sailing boat)।

মানে এটা দুটো আলাদা page নয় — **একটাই page, filter state আলাদা।**

---

## ৬. Destination ও Category Page এর Additional Content কোথা থেকে আসবে?

Image 7 ও 8 এ দেখা যাচ্ছে "About boat tours in Curaçao" text block এবং FAQ section।

এটা **Admin CMS থেকে manage হবে।**

**Content types:**

- Editorial description text (About section) → Admin লেখে per destination+category combination
- FAQ items → Admin add করে
- যেহেতু Operators categories create করতে পারে না, তাই এই content conflict করার সুযোগ নেই

**Database:**

```sql
page_content (
  id,
  page_type,    -- 'destination' | 'category' | 'hub'
  entity_id,
  locale,
  field,        -- 'about_text' | 'faq' | 'meta_title'
  value
)
```

---

## ৭. Klein Curaçao কী — Destination নাকি Category?

Klein Curaçao একটা **"Activity Hub"** — এটা না destination, না regular category। এটা একটা special entity type।

**Explanation:** Klein Curaçao হলো Curaçao থেকে 10km দূরে একটা ছোট uninhabited island। এটা নিজেই একটা place/location কিন্তু platform এর main destination নয় (main destination = Curaçao)। Multiple operators (BlueFinn, Miss Ann, Powerboat, etc.) সবাই Klein Curaçao তে যায়।

তাই এটা একটা Hub page যেখানে:

- **Book now tab** — সব Klein Curaçao tours
- **Private charter tab** — private boats
- **Our Pick tab** — editorial recommendations (Image 11)
- **Compare tab** — comparison table (Image 12)
- **Tips & FAQ tab** — location-specific info (Image 13)

**URL structure:**

```
/en/curacao/klein-curacao/           ← Hub page
/en/curacao/klein-curacao/miss-ann/  ← Tour under hub
/en/curacao/boat-tours/              ← Regular category
```

**Architecture:**

```
Destination: Curaçao
  ├── Hub: Klein Curaçao
  │     ├── Tour: Miss Ann
  │     ├── Tour: BlueFinn Catamaran
  │     └── Tour: Powerboat Experience
  ├── Category: Boat Tours
  ├── Category: Sunset Cruises
  └── Category: Buggy Tours
```

---

## ৮. Comparison Table কীভাবে কাজ করবে?

Image 12 এ দেখা যাচ্ছে "Comfort trips" ও "Adventure trips" দুটো group এ tours compare হচ্ছে।

এটা **Hub-specific feature।** Klein Curaçao Hub page এর "Compare" tab এ থাকে।

**কীভাবে trips select হয়:**

- Admin manually tours কে comparison group এ assign করে
- Groups হলো editorial categories: "Comfort" vs "Adventure"
- প্রতিটা tour এর structured data (beach house, open bar, price, departure, group size, boat type, catering, etc.) CMS থেকে আসে

```sql
hub_comparison_groups (
  id, hub_id, group_name,   -- 'Comfort trips'
  display_order
)

hub_comparison_tours (
  id, group_id, tour_id, display_order
)
```

---

## ৯. Editorial Cards — Blog নাকি Static Content?

Image 13 এ দেখা যাচ্ছে "Discover Klein Curaçao" section এ content cards: The White Beach, Kitesurfing, Sea Turtles, The Pink Lighthouse, etc।

এগুলো না Blog, না Static। এগুলো হলো **Hub Editorial Content** — Admin CMS থেকে manage করা structured content।

**প্রতিটা card এর:**

- Title
- Image
- Description text
- কোনো link নেই (informational only)

"What nobody tells you about Klein Curaçao" section = curated local tips, Admin লেখে।

---

## ১০. Inclusions (Pickup, Free Cancellation, Bar, Beer, etc.)

দুটো আলাদা জিনিস:

- **Quick-info badges (Tour Detail Page, spec LD7):** শুধু 3টা — Duration, Pickup, Languages।
- **Tour Card inclusions (Listing page):** "Pick-up available", "Free cancellation" — এগুলো tour এর fields থেকে auto-generate হয়।
- **Add-ons (Booking widget):** Hotel pickup, snorkel mask, drinks package, photo package, towel rental — এগুলো operator CMS থেকে configure করে।

**Pickup logic:**

```
tour.pickup_model = 'included'    → "Pickup included"
tour.pickup_model = 'paid_addon'  → "Pickup available"
tour.pickup_model = 'none'        → "Meeting point only"
```

---

## Multilingual System — সম্পূর্ণ Breakdown

### ৭টা Language, Launch থেকেই:

English (primary), Spanish, Dutch, Portuguese, French, German, Chinese

### URL Structure:

```
/en/curacao/klein-curacao/miss-ann/   ← English
/es/curacao/klein-curacao/miss-ann/   ← Spanish (slug same!)
/nl/curacao/klein-curacao/miss-ann/   ← Dutch (slug same!)
/zh/curacao/klein-curacao/miss-ann/   ← Chinese (slug same!)
```

> Slug সবসময় English — শুধু content translate হয়।

---

### Next.js Folder Structure:

```
src/
├── app/
│   └── [locale]/
│       ├── layout.tsx              ← locale-aware root layout
│       ├── page.tsx                ← Homepage
│       └── [destination]/
│           ├── page.tsx            ← Destination page
│           │                          /en/curacao/
│           ├── tours/
│           │   └── page.tsx        ← All Tours page
│           │                          /en/curacao/tours/
│           └── [slug]/
│               ├── page.tsx        ← Dynamic: resolves via slug registry
│               │                    Could be: category, hub, OR tour
│               └── [tourSlug]/
│                   └── page.tsx    ← Hub-anchored tour
│                                    /en/curacao/klein-curacao/miss-ann/
│
├── components/
│   ├── tour-detail/
│   │   ├── Breadcrumbs.tsx
│   │   ├── H1.tsx
│   │   ├── RatingRow.tsx
│   │   ├── ImageGallery.tsx
│   │   ├── QuickInfoBadges.tsx
│   │   ├── BookingWidget/
│   │   │   ├── index.tsx
│   │   │   ├── DatePicker.tsx
│   │   │   ├── TimeSlotPicker.tsx
│   │   │   ├── PartySelector.tsx
│   │   │   ├── PricingDisplay.tsx
│   │   │   ├── AddOns.tsx
│   │   │   ├── TrustStrip.tsx
│   │   │   └── StickyBottomCTA.tsx
│   │   ├── TourOverview.tsx
│   │   └── Highlights.tsx
│   ├── hub/
│   │   ├── HubTabs.tsx
│   │   ├── ComparisonTable.tsx
│   │   ├── OurPick.tsx
│   │   └── PrivateCharter.tsx
│   ├── listing/
│   │   ├── TourCard.tsx
│   │   ├── FilterBar.tsx
│   │   └── SortControl.tsx
│   └── shared/
│       ├── Navbar.tsx
│       ├── Footer.tsx
│       └── Lightbox.tsx
│
├── i18n/
│   ├── config.ts                   ← locales list, defaultLocale
│   ├── routing.ts                  ← next-intl routing
│   └── messages/
│       ├── en.json
│       ├── es.json
│       ├── nl.json
│       ├── pt.json
│       ├── fr.json
│       ├── de.json
│       └── zh.json
│
├── lib/
│   ├── slug-registry.ts            ← slug → entity resolver
│   ├── api/
│   │   ├── tours.ts
│   │   ├── availability.ts
│   │   └── translations.ts
│   └── formatters/
│       ├── duration.ts             ← "8 hours" / "1h 30m"
│       ├── price.ts                ← EUR/USD per locale
│       └── date.ts                 ← locale-aware
│
└── middleware.ts                   ← locale detection & redirect
```

---

### Static vs Dynamic Content — Multilingual Strategy:

**Static UI strings** (buttons, labels, navigation) → `i18n/messages/*.json` files এ থাকে, next-intl দিয়ে handle হয়।

```json
// en.json
{
  "booking.cta.check_availability": "Check availability",
  "booking.trust.free_cancel": "Free cancellation up to 24h",
  "tour.highlights.heading": "Highlights"
}

// es.json
{
  "booking.cta.check_availability": "Comprobar disponibilidad",
  "booking.trust.free_cancel": "Cancelación gratuita hasta 24h",
  "tour.highlights.heading": "Lo más destacado"
}
```

**Dynamic content** (tour name, description, highlights) → Database `translations` table থেকে আসে।

```sql
translations (
  entity_type,   -- 'tour' | 'destination' | 'category' | 'hub'
  entity_id,
  locale,        -- 'en' | 'es' | 'nl' | 'pt' | 'fr' | 'de' | 'zh'
  field,         -- 'h1_override' | 'overview' | 'highlights' | 'breadcrumb_label'
  value
)
```

> **Fallback rule:** যদি কোনো locale তে translation না থাকে → English দেখাবে + "Translated" badge।

---

### Rendering Strategy per Content Type:

| Content | Rendering | Revalidation |
|---|---|---|
| Page shell, H1, overview | SSR / ISR | 300 seconds |
| Tour availability | Client-side fetch | On date-picker open |
| Booking widget | Client hydration | After LCP |
| Static UI strings | Build-time (i18n) | On deploy |
| Hreflang tags | SSR (head) | Per page |

---

### `middleware.ts` — Locale Handling:

```typescript
// middleware.ts
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['en', 'es', 'nl', 'pt', 'fr', 'de', 'zh'],
  defaultLocale: 'en',
  localePrefix: 'always'  // always show /en/, /es/, etc.
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)']
};
```

---

### Slug Registry — Dynamic Route Resolution:

`[slug]` এ অনেক কিছু আসতে পারে — category, hub, বা tour। Slug registry এটা resolve করে:

```typescript
// lib/slug-registry.ts
type EntityType = 'tour' | 'category' | 'hub' | 'collection' | 'reserved';

async function resolveSlug(destination: string, slug: string) {
  const entity = await db.slugRegistry.findFirst({
    where: { destination_slug: destination, slug }
  });

  // entity.type determines which component renders
  return entity; // { type: 'hub', id: 'klein-curacao' }
}
```

```typescript
// app/[locale]/[destination]/[slug]/page.tsx
export default async function DynamicPage({ params }) {
  const entity = await resolveSlug(params.destination, params.slug);

  if (entity.type === 'hub')      return <HubPage id={entity.id} locale={params.locale} />;
  if (entity.type === 'category') return <CategoryPage id={entity.id} locale={params.locale} />;
  if (entity.type === 'tour')     return <TourDetailPage id={entity.id} locale={params.locale} />;
  if (entity.type === 'reserved') redirect(`/${params.locale}/${params.destination}/tours/`);

  notFound();
}
```

---

### Hreflang Tags (SEO — সব ৭ locale এ):

```typescript
// প্রতিটা page এ এই tags থাকবে
export function generateHreflangTags(path: string) {
  const locales = ['en', 'es', 'nl', 'pt', 'fr', 'de', 'zh'];
  return locales.map(locale => ({
    rel: 'alternate',
    hrefLang: locale,
    href: `https://islandtours.com/${locale}${path}`
  }));
  // + x-default → English
}
```