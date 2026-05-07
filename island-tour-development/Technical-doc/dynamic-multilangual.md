
# Dynamic Content Translation — Backend Strategy

## Database Schema

Spec এ বলা আছে এই approach:

```sql
translations (
  id,
  entity_type,   -- 'tour' | 'destination' | 'category' | 'hub'
  entity_id,     -- foreign key to respective table
  locale,        -- 'en' | 'es' | 'nl' | 'pt' | 'fr' | 'de' | 'zh'
  field,         -- 'overview' | 'highlights' | 'h1_override' | 'breadcrumb_label'
  value,         -- actual translated text (TEXT type)
  is_machine_translated,  -- boolean, "Translated" badge এর জন্য
  updated_at
)
```

এটা EAV (Entity-Attribute-Value) pattern। Flexible কিন্তু query করতে একটু কাজ লাগে।

---

## API থেকে Data Fetch করার Pattern

```typescript
// lib/api/tours.ts

async function getTourWithTranslations(tourSlug: string, locale: string) {
  // Step 1: Base tour data (locale-independent fields)
  const tour = await db.tours.findFirst({
    where: { slug: tourSlug }
  });

  // Step 2: Translated fields — requested locale first, English fallback
  const translations = await db.translations.findMany({
    where: {
      entity_type: 'tour',
      entity_id: tour.id,
      locale: { in: [locale, 'en'] }  // দুটোই fetch করো
    }
  });

  // Step 3: Merge — requested locale wins, English fallback
  const merged = mergeTranslations(translations, locale);

  return { ...tour, ...merged };
}

function mergeTranslations(translations, requestedLocale) {
  const result = {};
  const byLocale = groupBy(translations, 'locale');

  const enFields = byLocale['en'] || [];
  const targetFields = byLocale[requestedLocale] || [];

  // English দিয়ে শুরু করো
  for (const t of enFields) {
    result[t.field] = { value: t.value, isFallback: true };
  }

  // Target locale দিয়ে override করো
  for (const t of targetFields) {
    result[t.field] = { value: t.value, isFallback: false };
  }

  return result;
}
```

### Frontend এ "Translated" Badge দেখানো

```typescript
// TourOverview.tsx
export function TourOverview({ overview }) {
  return (
    <section>
      {overview.isFallback && (
        <span className="text-xs text-gray-400">Translated</span>
      )}
      <p>{overview.value}</p>
    </section>
  );
}
```

---

## Translation কোথা থেকে আসবে?

Spec অনুযায়ী তিনটা source:

| Content | Method |
|---|---|
| Tour title, highlights, FAQ | Human translation at launch |
| Itinerary body, host bio | AI-assisted + editorial review at scale |
| Missing translation | English fallback + "Translated" badge |

Admin panel এ একটা simple interface থাকবে যেখানে per-tour, per-locale content edit করা যাবে। AI translation button থাকতে পারে যেটা value populate করবে এবং `is_machine_translated = true` set করবে।

---

## একটা Practical সমস্যা — highlights field

Highlights হলো array (`string[]`), কিন্তু translations table এ value একটা TEXT field। এটা handle করার দুটো option:

**Option A: JSON হিসেবে store করো**

```sql
value = '["Reach the island in 1h15", "Snorkel with sea turtles"]'
```

**Option B: আলাদা translation_array_items table বানাও**

```sql
translation_array_items (
  translation_id, index, value
)
```

Option A সহজ, Option B বেশি queryable। Launch এর জন্য Option A ই যথেষ্ট।

---

## Trip Create করলে কী হয়?

তুমি Admin panel এ description লিখলে English এ। সেটা save হবে এভাবে:

```sql
-- tours table এ base data
INSERT INTO tours (id, slug, duration_minutes, ...) 
VALUES (42, 'miss-ann-klein-curacao', 480, ...);

-- translations table এ English content
INSERT INTO translations (entity_type, entity_id, locale, field, value, is_machine_translated)
VALUES ('tour', 42, 'en', 'overview', 'The boat trip locals tell their friends...', false);
```

এই মুহূর্তে শুধু English translation আছে। বাকি ৬টা locale এ কিছু নেই।

---

## Translation কীভাবে হবে?

দুটো approach আছে। Project এর spec অনুযায়ী দুটোই use হবে:

### Approach A — Human Translation (launch এ mandatory)

Admin panel এ manually প্রতিটা locale এর জন্য লিখবে বা paste করবে।

### Approach B — AI Auto-Translation (scale এ)

Backend এ একটা translation job trigger হবে। তুমি Anthropic API বা DeepL/Google Translate use করতে পারো।

```typescript
// lib/translation-service.ts

async function translateTourContent(tourId: number, sourceLocale = 'en') {
  const targetLocales = ['es', 'nl', 'pt', 'fr', 'de', 'zh'];
  
  // English content আনো
  const sourceTranslations = await db.translations.findMany({
    where: { entity_type: 'tour', entity_id: tourId, locale: sourceLocale }
  });

  for (const locale of targetLocales) {
    for (const t of sourceTranslations) {
      
      // AI দিয়ে translate করো
      const translated = await translateText(t.value, locale);
      
      // Database এ save করো
      await db.translations.upsert({
        where: {
          entity_type_entity_id_locale_field: {
            entity_type: 'tour',
            entity_id: tourId,
            locale,
            field: t.field
          }
        },
        update: { value: translated, is_machine_translated: true },
        create: {
          entity_type: 'tour',
          entity_id: tourId,
          locale,
          field: t.field,
          value: translated,
          is_machine_translated: true
        }
      });
    }
  }
}

async function translateText(text: string, targetLocale: string): Promise<string> {
  const localeNames = {
    es: 'Spanish', nl: 'Dutch', pt: 'Portuguese',
    fr: 'French', de: 'German', zh: 'Chinese'
  };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Translate the following tour description to ${localeNames[targetLocale]}. 
        Return only the translated text, nothing else.
        
        Text: ${text}`
      }]
    })
  });

  const data = await response.json();
  return data.content[0].text;
}
```

### Translation কখন trigger হবে?

| Option | কখন হবে | Trade-off |
|---|---|---|
| Immediate | Trip save হওয়ার সাথে সাথে | User কে wait করাবে |
| Background job | Save এর পরে async queue তে | User wait করবে না, কিন্তু কিছুক্ষণ শুধু English থাকবে |

Background job ই ভালো। Bull queue বা similar দিয়ে করো।

---

## Frontend এ Show করা

User যখন `/es/curacao/klein-curacao/miss-ann/` তে যাবে, Next.js route থেকে `locale = 'es'` পাবে।

```typescript
// app/[locale]/[destination]/[slug]/[tourSlug]/page.tsx

export default async function TourDetailPage({ params }) {
  const { locale, tourSlug } = params;
  
  // locale পাঠিয়ে দাও API তে
  const tour = await getTourWithTranslations(tourSlug, locale);
  
  return <TourDetail tour={tour} locale={locale} />;
}
```

```typescript
// lib/api/tours.ts

async function getTourWithTranslations(slug: string, locale: string) {
  const tour = await db.tours.findFirst({ where: { slug } });

  // Requested locale + English fallback — দুটোই এক query তে আনো
  const translations = await db.translations.findMany({
    where: {
      entity_type: 'tour',
      entity_id: tour.id,
      locale: { in: [locale, 'en'] }
    }
  });

  // Merge করো — target locale wins, English fallback
  const content = {};
  
  // আগে English দিয়ে fill করো
  translations
    .filter(t => t.locale === 'en')
    .forEach(t => {
      content[t.field] = { value: t.value, isMachineTranslated: false };
    });
  
  // তারপর target locale দিয়ে override করো
  translations
    .filter(t => t.locale === locale)
    .forEach(t => {
      content[t.field] = { 
        value: t.value, 
        isMachineTranslated: t.is_machine_translated 
      };
    });

  return { ...tour, content };
}
```

```typescript
// components/tour-detail/TourOverview.tsx

export function TourOverview({ overview }) {
  return (
    <section>
      <p>{overview.value}</p>
      
      {/* AI translate হলে badge দেখাও */}
      {overview.isMachineTranslated && (
        <span className="text-xs text-gray-400">Translated</span>
      )}
    </section>
  );
}
```

---

## পুরো Flow একসাথে

```
Admin trip create করলো (English description লিখলো)
        ↓
Database এ English translation save হলো
        ↓
Background job trigger হলো
        ↓
AI বাকি ৬ locale এ translate করলো
        ↓
Database এ ৬টা নতুন row insert হলো (is_machine_translated = true)
        ↓
User /es/... তে গেলো
        ↓
API locale='es' দিয়ে query করলো
        ↓
Spanish translation পেলো → show করলো
Spanish না থাকলে → English দেখালো + "Translated" badge
```

---

## Hub, Category, Destination Name — Same Way তে হবে?

হ্যাঁ, same pattern — কিন্তু কিছু পার্থক্য আছে।

### Same Pattern, কিন্তু entity_type আলাদা

```sql
-- Destination name translate
INSERT INTO translations (entity_type, entity_id, locale, field, value)
VALUES ('destination', 1, 'es', 'name', 'Curazao', false);

-- Category name translate  
INSERT INTO translations (entity_type, entity_id, locale, field, value)
VALUES ('category', 5, 'es', 'name', 'Tours en barco', false);

-- Hub name translate
INSERT INTO translations (entity_type, entity_id, locale, field, value)
VALUES ('hub', 2, 'es', 'name', 'Klein Curazao', false);
```

একই translations table, শুধু entity_type বদলায়।

### কিন্তু একটা Important পার্থক্য আছে

Tour description — AI দিয়ে translate করা practical। কিন্তু:

| Content | AI Translation? | কারণ |
|---|---|---|
| Tour description (500 words) | ✅ হ্যাঁ | Long form, AI ভালো করে |
| Destination name ("Curaçao") | ❌ না | Proper noun, translate হয় না |
| Hub name ("Klein Curaçao") | ❌ না | Proper noun |
| Category name ("Boat Tours") | ✅ হ্যাঁ, কিন্তু manually verify করো | Short, sensitive to tone |
| About section (long text) | ✅ হ্যাঁ | Long form |
| FAQ content | ✅ হ্যাঁ | Long form |

Destination আর Hub name গুলো Admin manually set করবে — AI এ দিও না। "Curaçao" সব locale এ "Curaçao" ই থাকবে।

### Slug কখনো Translate হবে না

এটা spec এ clearly বলা আছে —

```
/en/curacao/klein-curacao/   ✅
/es/curacao/klein-curacao/   ✅  ← slug same, শুধু locale prefix বদলায়
/es/curazao/klein-curazao/   ❌  ← এটা করবে না
```

Slug সবসময় English। শুধু page এর content translate হয়।

### Practically কীভাবে করবে

Translation service এ entity_type parameter add করো:

```typescript
async function translateEntityContent(
  entityType: 'tour' | 'category' | 'hub' | 'destination',
  entityId: number,
  fieldsToTranslate: string[]  // কোন fields translate করবে সেটা specify করো
) {
  // Destination/Hub name? Skip AI, admin manually করবে
  if (entityType === 'destination') {
    console.log('Destination names need manual translation');
    return;
  }

  // বাকিগুলো আগের মতোই
  await translateTourContent(entityId, entityType, fieldsToTranslate);
}
```

-------


# Island Tours — Multilingual Architecture & Dynamic Content Strategy

---

## ১. Translation Schema — কোন Approach নেওয়া হয়েছে

### ❌ Avoid — Same Table এ Locale Columns

```sql
tours (
  title_en, title_es, title_nl, ...  -- ১৪০+ column হয়ে যাবে
)
```

### ✅ Recommended — Dedicated Translation Tables

Base table এ শুধু locale-independent data, আলাদা translation table এ translated content।

```sql
-- Base table — locale-independent
tours (
  id,
  slug,               -- সবসময় English, never translates
  destination_id,
  category_id,
  duration_minutes,
  price_adult,
  price_child,
  pickup_model,       -- 'included' | 'paid_addon' | 'none'
  is_active,
  created_at
)

-- Translated content
tour_translations (
  id,
  tour_id,            -- FK → tours.id
  locale,             -- 'en' | 'es' | 'nl' | 'pt' | 'fr' | 'de' | 'zh'
  title,
  overview,
  description,
  is_machine_translated,
  updated_at,

  UNIQUE(tour_id, locale)
)
```

```sql
-- Category base
categories (
  id,
  slug,
  destination_id,
  type,               -- 'regular' | 'hub'
  is_active
)

-- Category translated content
category_translations (
  id,
  category_id,
  locale,
  name,
  about_text,
  meta_title,
  is_machine_translated,
  updated_at,

  UNIQUE(category_id, locale)
)
```

---

## ২. Array Fields — Highlights ও Inclusions

Highlights ও Inclusions list-based, তাই এগুলোর জন্য আলাদা child table।

```sql
tour_highlights (
  id,
  tour_id,
  display_order
)

tour_highlight_translations (
  id,
  highlight_id,
  locale,
  text,
  is_machine_translated
)

tour_inclusions (
  id,
  tour_id,
  icon,               -- 'meal' | 'drink' | 'equipment'
  display_order
)

tour_inclusion_translations (
  id,
  inclusion_id,
  locale,
  label
)
```

### পুরো Structure একসাথে

```
tours ──────────────── tour_translations       (title, overview, description per locale)
  │
  ├── tour_highlights ─── tour_highlight_translations  (text per locale)
  │
  └── tour_inclusions ─── tour_inclusion_translations  (label per locale)

categories ─────────── category_translations   (name, about_text per locale)
```

---

## ৩. Required Indexes

```sql
CREATE INDEX ON tour_translations(tour_id, locale);
CREATE INDEX ON tour_highlight_translations(highlight_id, locale);
CREATE INDEX ON tour_inclusion_translations(inclusion_id, locale);
```

---

## ৪. AI Auto-Translation Flow

### Trip Create হলে কী হয়

```
Admin English এ tour create করলো
        ↓
tours table এ base data save
        ↓
tour_translations এ English row insert (locale='en')
        ↓
Background job trigger
        ↓
AI বাকি ৬ locale এ translate করলো
        ↓
tour_translations এ ৬টা নতুন row (is_machine_translated=true)
```

### Translation Service

```typescript
// lib/translation-service.ts

async function translateTourContent(tourId: number, sourceLocale = 'en') {
  const targetLocales = ['es', 'nl', 'pt', 'fr', 'de', 'zh'];

  const sourceTranslations = await db.tour_translations.findFirst({
    where: { tour_id: tourId, locale: sourceLocale }
  });

  for (const locale of targetLocales) {
    const translated = await translateText(sourceTranslations.overview, locale);

    await db.tour_translations.upsert({
      where: { tour_id_locale: { tour_id: tourId, locale } },
      update: { overview: translated, is_machine_translated: true },
      create: { tour_id: tourId, locale, overview: translated, is_machine_translated: true }
    });
  }
}

async function translateText(text: string, targetLocale: string): Promise<string> {
  const localeNames = {
    es: 'Spanish', nl: 'Dutch', pt: 'Portuguese',
    fr: 'French', de: 'German', zh: 'Chinese'
  };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Translate the following tour description to ${localeNames[targetLocale]}.
Return only the translated text, nothing else.

Text: ${text}`
      }]
    })
  });

  const data = await response.json();
  return data.content[0].text;
}
```

### Background Job (Bull Queue)

```typescript
// jobs/translation.job.ts
import Queue from 'bull';

const translationQueue = new Queue('translation');

// Tour create হলে job add করো
translationQueue.add({ tourId: 42 });

// Worker
translationQueue.process(async (job) => {
  await translateTourContent(job.data.tourId);
});
```

> **Immediate vs Background:** Immediate হলে user কে wait করাবে। Background job ই ভালো — save হবে সাথে সাথে, translation কিছুক্ষণ পরে ready হবে।

---

## ৫. AI Translation — কোন Fields এ হবে, কোনটায় না

| Content | AI Translation? | কারণ |
|---|---|---|
| Tour description (500 words) | ✅ হ্যাঁ | Long form, AI ভালো করে |
| Tour highlights, FAQ | ✅ হ্যাঁ | Long form |
| Category name ("Boat Tours") | ✅ হ্যাঁ, manually verify করো | Short, tone-sensitive |
| About section (long text) | ✅ হ্যাঁ | Long form |
| Destination name ("Curaçao") | ❌ না | Proper noun |
| Hub name ("Klein Curaçao") | ❌ না | Proper noun |

```typescript
async function translateEntityContent(
  entityType: 'tour' | 'category' | 'hub' | 'destination',
  entityId: number
) {
  // Destination/Hub name — Admin manually করবে
  if (entityType === 'destination') return;

  await translateTourContent(entityId);
}
```

---

## ৬. Slug কখনো Translate হয় না

```
/en/curacao/klein-curacao/   ✅
/es/curacao/klein-curacao/   ✅  ← slug same, শুধু locale prefix বদলায়
/es/curazao/klein-curazao/   ❌  ← এটা করবে না
```

---

## ৭. Data Fetching Flow — Next.js Frontend + Backend

### Big Picture

```
User visits /es/curacao/miss-ann
        ↓
Next.js middleware → locale = 'es' confirm
        ↓
Page component (Server Component) → slug resolve
        ↓
Single Prisma query → tour + translations fetch
        ↓
Merge logic → 'es' না থাকলে 'en' fallback
        ↓
Clean tour object → Component এ render
```

### Middleware

```typescript
// middleware.ts
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['en', 'es', 'nl', 'pt', 'fr', 'de', 'zh'],
  defaultLocale: 'en',
  localePrefix: 'always'
});
```

### Page Component (Server Component)

```typescript
// app/[locale]/[destination]/[slug]/page.tsx

export const revalidate = 300; // ISR — 5 minutes cache

export default async function TourPage({ params }) {
  const { locale, slug } = params;
  const tour = await getTourBySlug(slug, locale);

  if (!tour) notFound();

  return (
    <>
      {/* Cached — fast */}
      <TourTitle title={tour.title} />
      <TourOverview overview={tour.overview} isMachineTranslated={tour.isMachineTranslated} />
      <Highlights items={tour.highlights} />
      <Inclusions items={tour.inclusions} />

      {/* Client component — real-time */}
      <BookingWidget tourId={tour.id} />
    </>
  );
}
```

### API Layer — Fetch + Merge

```typescript
// lib/api/tours.ts

export async function getTourBySlug(slug: string, locale: string) {

  const tour = await db.tours.findFirst({
    where: { slug },
    include: {
      translations: {
        where: { locale: { in: [locale, 'en'] } }
      },
      highlights: {
        orderBy: { display_order: 'asc' },
        include: {
          translations: {
            where: { locale: { in: [locale, 'en'] } }
          }
        }
      },
      inclusions: {
        include: {
          translations: {
            where: { locale: { in: [locale, 'en'] } }
          }
        }
      }
    }
  });

  if (!tour) return null;

  return mergeTourTranslations(tour, locale);
}
```

### Merge Logic — Requested Locale Wins, English Fallback

```typescript
function mergeTourTranslations(tour, locale) {
  const enTrans = tour.translations.find(t => t.locale === 'en');
  const localeTrans = tour.translations.find(t => t.locale === locale);
  const activeTrans = localeTrans ?? enTrans;

  return {
    // Locale-independent
    id: tour.id,
    slug: tour.slug,
    price_adult: tour.price_adult,
    duration_minutes: tour.duration_minutes,
    pickup_model: tour.pickup_model,

    // Translated
    title: activeTrans?.title ?? '',
    overview: activeTrans?.overview ?? '',
    description: activeTrans?.description ?? '',
    isMachineTranslated: activeTrans?.is_machine_translated ?? false,

    highlights: tour.highlights.map(h => {
      const active = h.translations.find(t => t.locale === locale)
                  ?? h.translations.find(t => t.locale === 'en');
      return { id: h.id, text: active?.text ?? '', isMachineTranslated: active?.is_machine_translated ?? false };
    }),

    inclusions: tour.inclusions.map(inc => {
      const active = inc.translations.find(t => t.locale === locale)
                  ?? inc.translations.find(t => t.locale === 'en');
      return { id: inc.id, icon: inc.icon, label: active?.label ?? '' };
    })
  };
}
```

> **DB Query কতবার হচ্ছে?** একটাই Prisma query — tours + translations + highlights + inclusions সব একসাথে JOIN হয়। N+1 problem নেই।

---

## ৮. Booking Widget — Client-Side Fetch (Real-time)

```typescript
// components/BookingWidget.tsx
'use client';

export function BookingWidget({ tourId }) {
  const [availability, setAvailability] = useState(null);

  async function handleDateSelect(date) {
    const data = await fetch(`/api/availability?tourId=${tourId}&date=${date}`);
    setAvailability(await data.json());
  }

  return (
    <div>
      <DatePicker onSelect={handleDateSelect} />
      {availability && <TimeSlots data={availability} />}
    </div>
  );
}
```

---

## ৯. On-Demand Revalidation — Admin Update করলে

```typescript
// app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache';

export async function POST(req) {
  const { slug } = await req.json();

  const locales = ['en', 'es', 'nl', 'pt', 'fr', 'de', 'zh'];
  locales.forEach(locale => {
    revalidatePath(`/${locale}/curacao/${slug}`);
  });

  return Response.json({ revalidated: true });
}
```

Admin tour edit করলে সাথে সাথে সব locale এর cache clear হবে।

---

## ১০. কেন Slow হবে না

| কারণ | ব্যাখ্যা |
|---|---|
| Server Component | Browser extra fetch করে না, server থেকে HTML ready আসে |
| Single query | সব JOIN একটাই Prisma query তে |
| Index | Properly indexed হলে 5-15ms DB response |
| ISR cache | বেশিরভাগ request DB hit করে না |
| Availability আলাদা | Real-time data page load block করে না |

---

## ১১. Admin Translation UI — Recommended Approach

### ❌ Force করা উচিত না

Create form এ ৭টা language এর tab রাখলে cognitive overload হয়। Tour create করার সময় admin শুধু English এ focus করুক।

### ✅ "Save first, translate later"

```
Create tour (English only) → Save →
Translations tab এ গিয়ে per-locale edit করো
```

### Translation Tab UI

```
Tour: Miss Ann Klein Curaçao
[Overview] [Pricing] [Schedule] [Translations] [SEO]

Translations
─────────────────────────────────────
  [EN] [ES] [NL] [PT] [FR] [DE] [ZH]

  Spanish — 0/3 fields translated
  ┌──────────────────────────────────────┐
  │ Overview                             │
  │ [Auto-translate] [Clear]             │
  │ ┌────────────────────────────────┐   │
  │ │ El viaje en barco que los...   │   │
  │ └────────────────────────────────┘   │
  └──────────────────────────────────────┘
  [Save Spanish translations]
```

Progress indicator দেখাবে — কোন locale এ কতটুকু done।

---

## ১২. Page Rendering Strategy — Summary

```
Tour Detail Page
├── Tour content (title, description, highlights)
│     → ISR, revalidate=300
│     → Admin update করলে on-demand revalidate
│
└── Booking widget (availability, pricing)
      → Client-side fetch
      → User date select করলে তখন load
```

| Content | Rendering | Revalidation |
|---|---|---|
| Tour content, translations | ISR (Server Component) | 300s + on-demand |
| Static UI strings | Build-time (next-intl) | On deploy |
| Availability / pricing | Client fetch | On date select |
| Hreflang tags | SSR (head) | Per page |