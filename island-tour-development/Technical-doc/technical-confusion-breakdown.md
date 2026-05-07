# Island Tours — Technical Design Full Breakdown

---

## ১. Top Island Experiences কীভাবে কাজ করবে?

"Top Island Experiences" হলো categories নয় — এগুলো হলো curated tour types যেগুলো admin panel থেকে manually select করা হবে।

### ✅ Locked Decision
**Top Island Experiences = Categories এবং Hubs only। Individual trips/tours এখানে add করা যাবে না।**

কারণ:
- User এর mental model অনুযায়ী এটা "কী করতে পারি" এর overview — specific কোনো trip না
- Specific operator কে unfair advantage দেওয়া হবে যদি trips allow করা হয়
- Sunset Cruise তে click করলে সে যাবে Sunset Cruise category page এ, সেখান থেকে specific tour choose করবে

### কীভাবে কাজ করবে
- Admin dashboard থেকে admin যেকোনো category বা hub কে "featured experience" হিসেবে mark করতে পারবে
- Video play button প্রতিটা featured experience এর সাথে থাকবে (Image 14 অনুযায়ী)
- Display order admin manually set করবে

### Database Structure
```sql
featured_experiences (
  id,
  entity_type,    -- 'category' | 'hub' ONLY (trips allowed না)
  entity_id,
  destination_id,
  display_order,
  video_url,
  is_active
)
```

---

## ২. Destination কীভাবে কাজ করবে?

### ✅ Locked Decision
**Destinations fixed এবং Admin-controlled। Tour Operator destination create করতে পারবে না।**

- Destination শুধু Admin create করতে পারবে
- Destinations are predefined Caribbean islands (Curaçao, Aruba, Sint Maarten, etc.)
- Tour Operator শুধু existing destinations এর মধ্যে থেকে তাদের tour create করতে পারবে
- Tour Operators worldwide destination create করতে পারবে না — এটা Caribbean-focused platform

### Seeding vs Admin Create
- **Seeding** — launch এর আগে একবার database এ push হবে
- **Admin Panel** — launch এর পরে admin চাইলে নতুন destination add করতে পারবে

```typescript
// seeds/destinations.ts
const destinations = [
  { name: 'Curaçao', slug: 'curacao' },
  { name: 'Aruba', slug: 'aruba' },
  { name: 'Sint Maarten', slug: 'sint-maarten' },
  // ...
]
```

### Database Structure
```sql
destinations (
  id,
  name,
  slug,           -- 'curacao', 'aruba'
  is_seeded,      -- true = initial data, false = admin created
  is_active,
  created_by,     -- null = seeded, admin_id = admin created
  hero_image,
  tour_count      -- computed
)
```

`is_seeded` flag রাখার কারণ — seeded items গুলো accidentally delete করা থেকে protect করা যাবে।

### ⚠️ Product Owner কে Confirm করতে হবে
- Platform কোন কোন Caribbean islands cover করবে launch এ?
- Curaçao confirmed — বাকিগুলো সব launch এ থাকবে নাকি phased rollout?

---

## ৩. Categories কীভাবে কাজ করবে?

### ✅ Locked Decision
**Categories Admin-controlled এবং predefined। Operators নতুন category create করতে পারবে না।**

### Important Distinction — দুই ধরনের "Type"

| | Category | Hub |
|---|---|---|
| কী | Activity type | Physical location |
| Example | Boat Tours | Klein Curaçao |
| URL | `/en/curacao/boat-tours/` | `/en/curacao/klein-curacao/` |
| Destination-specific? | না (global) | হ্যাঁ |
| Content | Tour listing + filters | Tabbed experience |
| কে create করে | Admin only | Admin only |

### Category Global (Destination-Independent)
Category তে destination লাগে না — category সব destination এ same।
```
/en/curacao/boat-tours/
/en/aruba/boat-tours/   ← same category, আলাদা destination
```
Admin একবার category create করলে সব active destinations এ automatically available হবে।

### Seeding vs Admin Create
```typescript
// seeds/categories.ts
const categories = [
  { name: 'Boat Tours', slug: 'boat-tours' },
  { name: 'Sunset Cruises', slug: 'sunset-cruises' },
  { name: 'Buggy Tours', slug: 'buggy-tours' },
  { name: 'Snorkeling Trips', slug: 'snorkeling-trips' },
  { name: 'Private Charters', slug: 'private-charters' },
  { name: 'Day Trips', slug: 'day-trips' },
  // ...
]
```

### ⚠️ Product Owner কে Confirm করতে হবে
- Exact category list কী কী থাকবে launch এ?
- Klein Curaçao এর মতো আর কোনো Hub আছে launch এ?

---

## ৪. Badges কীভাবে কাজ করবে?

Image 3 এ দেখা যাচ্ছে: New, Sponsored, Likely to sell out, Most popular

এগুলো **system-generated** — admin manually assign করে না (Sponsored ছাড়া)।

| Badge | Logic |
|---|---|
| New | Tour created < 30 days ago |
| Sponsored | Operator paid for promotion (admin toggle) |
| Likely to sell out | < 20% capacity remaining in next 7 days |
| Most popular | Highest booking count in last 30 days per category |

> **Important:** Tour Detail Page এ এই badges দেখাবে না (spec LD7 অনুযায়ী — শুধু Duration, Pickup, Languages দেখাবে)। এই badges শুধু listing/search page এর tour cards এ দেখাবে।

---

## ৫. "Boat Tours" vs "Boat Tours Active" — পার্থক্য কী?

এটা same page এর দুটো ভিন্ন state/view — **দুটো আলাদা page নয়।**

- **Image 5 — "Boat tours in Curaçao"** = Default listing page, broader context
- **Image 6 — "Boat tours active"** = Active filters applied state। Duration ও Price active, boat-type sub-filters দেখা যাচ্ছে

---

## ৬. Destination ও Category Page এর Additional Content কোথা থেকে আসবে?

### ✅ Locked Decision
**Admin CMS থেকে manage হবে। Operators এই content manage করতে পারবে না।**

Content types:
- Editorial description text (About section) → Admin লেখে per destination+category combination
- FAQ items → Admin add করে

### Database Structure
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

## ৭. Klein Curaçao কী — Hub Architecture

### ✅ Locked Decision
**Klein Curaçao একটা "Activity Hub" — না destination, না regular category।**

Klein Curaçao হলো Curaçao থেকে 10km দূরে একটা ছোট uninhabited island। Multiple operators (BlueFinn, Miss Ann, Powerboat, etc.) সবাই Klein Curaçao তে যায়।

### Hub Page Tabs (Images অনুযায়ী)
- **Book now tab** (Image 1) — সব Klein Curaçao tours, per_person pricing
- **Private charter tab** (Image 2) — unit-priced tours ($1,750/10 people)
- **Our Pick tab** (Image 3) — Admin editorial recommendation
- **Compare tab** (Image 4) — Comparison table (Comfort vs Adventure groups)
- **Tips & FAQ tab** — Location-specific content

### Tab Logic
```
tour.pricing_model = 'per_person' → Book now tab এ দেখাবে
tour.pricing_model = 'unit'       → Private charter tab এ দেখাবে
```

### Platform Architecture
```
Destination: Curaçao
  ├── Hub: Klein Curaçao
  │     ├── Tour: Miss Ann (hub_id set)
  │     ├── Tour: BlueFinn Catamaran (hub_id set)
  │     └── Tour: Powerboat Experience (hub_id set)
  ├── Category: Boat Tours
  ├── Category: Sunset Cruises
  └── Category: Buggy Tours
```

### URL Structure
```
/en/curacao/klein-curacao/           ← Hub page
/en/curacao/klein-curacao/miss-ann/  ← Hub-anchored tour
/en/curacao/boat-tours/              ← Regular category
/en/curacao/sunset-cruise-bluefinn/  ← Destination-only tour
```

### Hub Database Structure
```sql
hubs (
  id,
  destination_id,   -- mandatory, hub is destination-specific
  name,             -- 'Klein Curaçao'
  slug,             -- 'klein-curacao'
  description,
  is_active
)

hub_content (
  id,
  hub_id,
  locale,
  field,    -- 'about' | 'tips' | 'faq' | 'our_pick_intro'
  value
)

hub_our_picks (
  id,
  hub_id,
  tour_id,
  pick_type,      -- 'best_overall' | 'most_popular' | 'best_for_families'
  description,    -- admin লেখা editorial text
  display_order
)

hub_comparison_groups (
  id,
  hub_id,
  group_name,     -- 'Comfort trips' | 'Adventure trips'
  display_order
)

hub_comparison_tours (
  id,
  group_id,
  tour_id,
  display_order
)

hub_allowed_categories (
  hub_id,
  category_id     -- কোন categories এর tours এই hub এ allowed
)
```

### Hub Create করার সময় Destination Mandatory
```
Admin hub create করে:
Name: Klein Curaçao
Slug: klein-curacao [auto-generated]
Destination: Curaçao ← mandatory (hub is destination-specific)
```

---

## ৮. Tour কীভাবে Hub এ Assign হয় — Operator Flow

### ✅ Locked Decision
**Operator Destination → Category → Hub (optional, conditional) flow follow করবে।**

```
Step 1: Destination → Curaçao
Step 2: Category    → Boat Tours

[যদি Boat Tours hub-eligible হয়]
Step 3: Does this tour go to Klein Curaçao?
        ( ) Yes — Klein Curaçao
        (●) No  — stays under Boat Tours only
```

Hub-eligible না হলে Step 3 দেখাবেই না।

### Tour Table
```sql
tours (
  id,
  destination_id,
  category_id,      -- Boat Tours, Sunset Cruises etc.
  hub_id,           -- nullable। Klein Curaçao হলে set, নাহলে null
  pricing_model,    -- per_person | unit
  slug,
  ...
)
```

---

## ৯. Comparison Table কীভাবে কাজ করবে?

Image 4 অনুযায়ী — Hub-specific feature। Klein Curaçao Hub page এর "Compare" tab এ থাকে।

**কীভাবে trips select হয়:**
- Admin manually tours কে comparison group এ assign করে
- Groups হলো editorial categories: "Comfort" vs "Adventure"
- প্রতিটা tour এর structured data CMS থেকে আসে

---

## ১০. Editorial Cards — Blog নাকি Static Content?

Image 13 — "Discover Klein Curaçao" section এ content cards।

এগুলো **Hub Editorial Content** — Admin CMS থেকে manage করা structured content।

প্রতিটা card এ: Title, Image, Description text (informational only, কোনো link নেই)।

"What nobody tells you about Klein Curaçao" = curated local tips, Admin লেখে।

---

## ১১. Inclusions (Pickup, Free Cancellation, Bar, Beer, etc.)

দুটো আলাদা জিনিস:

| | কোথায় | কীভাবে |
|---|---|---|
| Quick-info badges | Tour Detail Page (LD7) | শুধু 3টা — Duration, Pickup, Languages |
| Tour Card inclusions | Listing page | tour fields থেকে auto-generate |
| Add-ons | Booking widget | Operator CMS থেকে configure |

**Pickup logic:**
```
tour.pickup_model = 'included'    → "Pickup included"
tour.pickup_model = 'paid_addon'  → "Pickup available"
tour.pickup_model = 'none'        → "Meeting point only"
```

---

## ১২. Slug Registry — Full Architecture

### সমস্যাটা কী?
```
/en/curacao/boat-tours/              → Category page
/en/curacao/klein-curacao/           → Hub page
/en/curacao/sunset-cruise-bluefinn/  → Tour page
```
Next.js কে বুঝতে হবে কোন slug কোন ধরনের page। Slug Registry এই কাজ করে।

### ✅ Locked Decisions
- **Destination slug registry তে যাবে না** — URL এ fixed position, `[destination]` directly catch করে
- **Category, Hub, Tour (destination-only) slug registry তে যাবে** — same `[slug]` position এ ambiguous
- **Hub-anchored tour slug registry তে যাবে না** — URL structure ই sufficient (`[slug]/[tourSlug]`)
- **Same destination এ same slug দুই operator নিতে পারবে না**
- **আলাদা destination এ same slug allowed**

### কোনটা কোথায়

| Entity | Registry লাগে? | কেন |
|---|---|---|
| Destination | ❌ না | URL এ fixed position |
| Category | ✅ হ্যাঁ | `[slug]` position এ ambiguous |
| Hub | ✅ হ্যাঁ | `[slug]` position এ ambiguous |
| Tour (destination-only) | ✅ হ্যাঁ | `[slug]` position এ ambiguous |
| Tour (hub-anchored) | ❌ না | `[slug]/[tourSlug]` structure sufficient |
| Reserved | ✅ হ্যাঁ | Protect করতে হবে |

### Final Schema
```sql
slug_registry (
  id                SERIAL PRIMARY KEY,
  destination_slug  VARCHAR(100) NOT NULL,  -- 'curacao'
  slug              VARCHAR(100) NOT NULL,  -- 'boat-tours'
  entity_type       VARCHAR(20)  NOT NULL,  -- 'category' | 'hub' | 'tour' | 'collection' | 'reserved'
  entity_id         INTEGER,                -- null only for 'reserved'
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMP DEFAULT now(),

  UNIQUE (destination_slug, slug)           -- same destination এ duplicate slug allowed না
)
```

### Populated Table Example
```
id | destination_slug | slug                    | entity_type | entity_id | is_active
---|------------------|-------------------------|-------------|-----------|----------
1  | curacao          | tours                   | reserved    | null      | true
2  | aruba            | tours                   | reserved    | null      | true
3  | curacao          | boat-tours              | category    | 3         | true
4  | aruba            | boat-tours              | category    | 3         | true  ← same category id
5  | curacao          | klein-curacao           | hub         | 1         | true
6  | curacao          | miss-ann                | tour        | 47        | true
7  | curacao          | sunset-cruise-bluefinn  | tour        | 48        | true
8  | curacao          | buggy-tours             | category    | 7         | true
```

Row 3 ও 4 — same category id (3), কিন্তু আলাদা destination। Category একটাই, দুই destination এ available।

---

## ১৩. Next.js Route Structure ও Dynamic Content

### Route Structure
```
app/
└── [locale]/
    └── [destination]/
        ├── page.tsx                    ← Destination page
        ├── tours/
        │   └── page.tsx                ← Reserved, All Tours page
        └── [slug]/
            ├── page.tsx                ← Dynamic resolver
            └── [tourSlug]/
                └── page.tsx            ← Hub-anchored tour only
```

### Dynamic Resolver
```typescript
// app/[locale]/[destination]/[slug]/page.tsx

export default async function DynamicPage({ params }) {
  const { locale, destination, slug } = params;

  const dest = await db.destinations.findFirst({
    where: { slug: destination, is_active: true }
  });
  if (!dest) notFound();

  const entity = await resolveSlug(destination, slug);
  if (!entity) notFound();

  switch (entity.entity_type) {
    case 'hub':
      return <HubPage hubId={entity.entity_id} locale={locale} />;
    case 'category':
      return <CategoryPage categoryId={entity.entity_id} locale={locale} />;
    case 'tour':
      return <TourDetailPage tourId={entity.entity_id} locale={locale} />;
    case 'collection':
      return <CollectionPage collectionId={entity.entity_id} locale={locale} />;
    case 'reserved':
      redirect(`/${locale}/${destination}/tours/`);
    default:
      notFound();
  }
}
```

### Hub-Anchored Tour Resolver
```typescript
// app/[locale]/[destination]/[slug]/[tourSlug]/page.tsx

export default async function HubTourPage({ params }) {
  const { locale, destination, slug, tourSlug } = params;

  const hubEntry = await resolveSlug(destination, slug);
  if (!hubEntry || hubEntry.entity_type !== 'hub') notFound();

  const tour = await db.tours.findFirst({
    where: { slug: tourSlug, hub_id: hubEntry.entity_id, is_active: true }
  });
  if (!tour) notFound();

  return <TourDetailPage tourId={tour.id} locale={locale} />;
}
```

### resolveSlug + generateUniqueSlug
```typescript
// lib/slug-registry.ts

export async function resolveSlug(destinationSlug: string, slug: string) {
  return await db.slugRegistry.findFirst({
    where: { destination_slug: destinationSlug, slug, is_active: true }
  });
}

export async function slugExists(destinationSlug: string, slug: string): Promise<boolean> {
  const entry = await db.slugRegistry.findFirst({
    where: { destination_slug: destinationSlug, slug }
  });
  return !!entry;
}

export async function generateUniqueSlug(name: string, destinationSlug: string): Promise<string> {
  const base = name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  let slug = base;
  let counter = 1;

  while (await slugExists(destinationSlug, slug)) {
    slug = `${base}-${counter}`;
    counter++;
  }

  return slug;
  // 'miss-ann' taken → 'miss-ann-2'
}
```

---

## ১৪. Create Time — Frontend & Backend Flow

### Hub Create (Admin)

**Frontend:**
```typescript
const handleNameChange = async (value: string) => {
  setName(value);
  const suggested = await fetch(
    `/api/slugs/suggest?name=${value}&destination=${destinationId}`
  ).then(r => r.json());
  setSlug(suggested.slug);
};
```

**Backend:**
```typescript
// app/api/admin/hubs/route.ts
export async function POST(req: Request) {
  const { name, slug, destination_id } = await req.json();
  const destination = await db.destinations.findById(destination_id);

  const conflict = await slugExists(destination.slug, slug);
  if (conflict) return Response.json({ error: 'Slug already taken' }, { status: 409 });

  const result = await db.$transaction(async (tx) => {
    const hub = await tx.hubs.create({ data: { name, slug, destination_id } });

    await tx.slugRegistry.create({
      data: {
        destination_slug: destination.slug,
        slug,
        entity_type: 'hub',
        entity_id: hub.id,
        is_active: true
      }
    });

    return hub;
  });

  return Response.json(result);
}
```

### Category Create (Admin)

**Backend:**
```typescript
// app/api/admin/categories/route.ts
export async function POST(req: Request) {
  const { name, slug } = await req.json();

  // Category global — সব active destinations এ add হবে
  const destinations = await db.destinations.findMany({ where: { is_active: true } });

  const result = await db.$transaction(async (tx) => {
    const category = await tx.categories.create({ data: { name, slug } });

    await tx.slugRegistry.createMany({
      data: destinations.map(dest => ({
        destination_slug: dest.slug,
        slug,
        entity_type: 'category',
        entity_id: category.id,
        is_active: true
      }))
    });

    return category;
  });

  return Response.json(result);
}
```

### Tour Create (Operator)

**Frontend:**
```typescript
// Name change → slug suggest
const handleTourNameChange = async (value: string) => {
  setTourName(value);
  if (selectedDestination) {
    const res = await fetch(
      `/api/slugs/suggest?name=${value}&destination=${selectedDestination}`
    ).then(r => r.json());
    setSlug(res.slug);
  }
};

// Category change → hub eligibility check
const handleCategoryChange = async (categoryId: string) => {
  setSelectedCategory(categoryId);
  const res = await fetch(
    `/api/hubs/eligible?category=${categoryId}&destination=${selectedDestination}`
  ).then(r => r.json());
  setEligibleHubs(res.hubs); // [] হলে hub option দেখাবে না
};
```

**Backend:**
```typescript
// app/api/operator/tours/route.ts
export async function POST(req: Request) {
  const { name, slug, destination_id, category_id, hub_id } = await req.json();
  const destination = await db.destinations.findById(destination_id);

  const conflict = await slugExists(destination.slug, slug);
  if (conflict) return Response.json({ error: 'Slug already taken' }, { status: 409 });

  const result = await db.$transaction(async (tx) => {
    const tour = await tx.tours.create({
      data: { name, slug, destination_id, category_id, hub_id: hub_id ?? null }
    });

    // Hub-anchored হলে registry তে add করো না
    // Destination-only হলে registry তে add করো
    if (!hub_id) {
      await tx.slugRegistry.create({
        data: {
          destination_slug: destination.slug,
          slug,
          entity_type: 'tour',
          entity_id: tour.id,
          is_active: true
        }
      });
    }

    return tour;
  });

  return Response.json(result);
}
```

### Create Flow Summary
```
Hub create:
Admin fills form → name change → slug auto-suggest →
destination select (mandatory) → submit →
backend: conflict check → transaction(hub + registry) → done

Category create:
Admin fills form → name change → slug auto-suggest →
submit →
backend: conflict check → transaction(category + registry × all destinations) → done

Tour create (destination-only):
Operator: destination → category → name → slug auto-suggest → submit →
backend: conflict check → transaction(tour + registry) → done

Tour create (hub-anchored):
Operator: destination → category → hub select → name → slug auto-suggest → submit →
backend: conflict check → transaction(tour, NO registry) → done
```

---




Slug Registry Table — প্রতিটা Column
sqlslug_registry (
  id,                -- Primary key, auto-increment
  destination_slug,  -- কোন destination এর under এ এই slug
  slug,              -- actual URL segment
  entity_type,       -- এই slug কোন ধরনের entity
  entity_id,         -- সেই entity র actual table এর id
  is_active          -- soft delete / disable
)

প্রতিটা Column কী Hold করে
id — just primary key।
destination_slug — 'curacao' বা 'aruba'। কারণ same slug দুই destination এ থাকতে পারে।
curacao  | boat-tours  ✓
aruba    | boat-tours  ✓  ← same slug, আলাদা destination, conflict নেই
slug — URL এ যা দেখা যায়। 'boat-tours', 'klein-curacao', 'miss-ann'।
entity_type — এই slug click করলে কোন page দেখাবে।
'category'   → CategoryPage
'hub'        → HubPage
'tour'       → TourDetailPage
'collection' → CollectionPage
'reserved'   → redirect to /tours/
entity_id — সেই entity র actual id। Category table এ গিয়ে id=3 lookup করবে।
reserved type এর entity_id = null (কোনো entity নেই)
is_active — tour/category disable করলে page 404 দেখাবে, কিন্তু row delete হবে না। Slug টা protect থাকবে।

কখন কখন Registry তে Row Insert হবে
Hub create হলে
typescript// Admin hub create করলে
async function createHub(data) {
  const hub = await db.hubs.create({
    name: data.name,        -- 'Klein Curaçao'
    slug: data.slug,        -- 'klein-curacao'
    destination_id: data.destination_id
  });

  // Registry তে add
  await db.slugRegistry.create({
    destination_slug: 'curacao',
    slug: 'klein-curacao',
    entity_type: 'hub',
    entity_id: hub.id,
    is_active: true
  });
}
Category create হলে
typescript// Admin category create করলে
async function createCategory(data) {
  const category = await db.categories.create({
    name: data.name,    -- 'Boat Tours'
    slug: data.slug,    -- 'boat-tours'
  });

  // প্রতিটা destination এর জন্য আলাদা row
  for (const destSlug of data.destination_slugs) {
    await db.slugRegistry.create({
      destination_slug: destSlug,   -- 'curacao', 'aruba'
      slug: 'boat-tours',
      entity_type: 'category',
      entity_id: category.id,
      is_active: true
    });
  }
}
Tour create হলে
typescript// Operator tour create করলে
async function createTour(data) {
  // আগে conflict check
  const conflict = await db.slugRegistry.findFirst({
    where: {
      destination_slug: data.destination_slug,
      slug: data.slug
    }
  });
  if (conflict) throw new Error('Slug already taken');

  const tour = await db.tours.create(data);

  // Registry তে add
  await db.slugRegistry.create({
    destination_slug: data.destination_slug,  -- 'curacao'
    slug: data.slug,                          -- 'miss-ann'
    entity_type: 'tour',
    entity_id: tour.id,
    is_active: true
  });
}

একটা Populated Table দেখো
id | destination_slug | slug                    | entity_type | entity_id | is_active
---|------------------|-------------------------|-------------|-----------|----------
1  | curacao          | tours                   | reserved    | null      | true
2  | aruba            | tours                   | reserved    | null      | true
3  | curacao          | boat-tours              | category    | 3         | true
4  | aruba            | boat-tours              | category    | 3         | true
5  | curacao          | klein-curacao           | hub         | 1         | true
6  | curacao          | miss-ann                | tour        | 47        | true
7  | curacao          | sunset-cruise-bluefinn  | tour        | 48        | true
8  | curacao          | buggy-tours             | category    | 7         | true
Row 3 আর 4 — same category id (3), কিন্তু আলাদা destination। Category একটাই, দুই destination এ available।
Row 1 আর 2 — reserved, entity_id null। কেউ tours নামে tour বা category বানাতে পারবে না।

## Multilingual System — সম্পূর্ণ Breakdown

### ৭টা Language, Launch থেকেই
English (primary), Spanish, Dutch, Portuguese, French, German, Chinese

### URL Structure
```
/en/curacao/klein-curacao/miss-ann/   ← English
/es/curacao/klein-curacao/miss-ann/   ← Spanish (slug same!)
/nl/curacao/klein-curacao/miss-ann/   ← Dutch (slug same!)
/zh/curacao/klein-curacao/miss-ann/   ← Chinese (slug same!)
```

> Slug সবসময় English — শুধু content translate হয়।

### Next.js Folder Structure
```
src/
├── app/
│   └── [locale]/
│       ├── layout.tsx
│       ├── page.tsx                        ← Homepage
│       └── [destination]/
│           ├── page.tsx                    ← Destination page
│           ├── tours/
│           │   └── page.tsx                ← All Tours page
│           └── [slug]/
│               ├── page.tsx                ← Dynamic resolver
│               └── [tourSlug]/
│                   └── page.tsx            ← Hub-anchored tour
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
│   ├── config.ts
│   ├── routing.ts
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
│   ├── slug-registry.ts
│   ├── api/
│   │   ├── tours.ts
│   │   ├── availability.ts
│   │   └── translations.ts
│   └── formatters/
│       ├── duration.ts
│       ├── price.ts
│       └── date.ts
│
└── middleware.ts
```

### Static vs Dynamic Content

**Static UI strings** → `i18n/messages/*.json` files এ থাকে:
```json
// en.json
{
  "booking.cta.check_availability": "Check availability",
  "booking.trust.free_cancel": "Free cancellation up to 24h",
  "tour.highlights.heading": "Highlights"
}
```

**Dynamic content** → Database `translations` table থেকে আসে:
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

### Rendering Strategy

| Content | Rendering | Revalidation |
|---|---|---|
| Page shell, H1, overview | SSR / ISR | 300 seconds |
| Tour availability | Client-side fetch | On date-picker open |
| Booking widget | Client hydration | After LCP |
| Static UI strings | Build-time (i18n) | On deploy |
| Hreflang tags | SSR (head) | Per page |

### middleware.ts
```typescript
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['en', 'es', 'nl', 'pt', 'fr', 'de', 'zh'],
  defaultLocale: 'en',
  localePrefix: 'always'
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)']
};
```

### Hreflang Tags
```typescript
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

### Multilingual CMS Data Table

| Field | Type | Notes |
|---|---|---|
| tour.h1_override | string (nullable) | Override for awkward template-generated H1s |
| tour.breadcrumb_label | string | Short-form for breadcrumb last segment when H1 > 35 chars |
| tour.duration_minutes | int | Drives duration badge formatter |
| tour.pickup_model | enum | included / paid_addon / none |
| tour.languages[] | string[] | Language codes; rendered via locale lookup |
| tour.gallery_images[] | array | Ordered; first marked is_hero: true |
| tour.overview_{locale} | markdown | Paragraph breaks only |
| tour.highlights_{locale}[] | string[] | 3–6 items, 5–15 words each |
| tour.pricing_model | enum | per_person / unit |
| tour.unit_type | enum (nullable) | group / boat / vehicle / aircraft / package |
| tour.max_party_size | int | Tour capacity ceiling |
| tour.min_party_size | int | Default 1 |
| tour.age_bands[] | array (nullable) | When age-banded pricing applies |
| tour.booking_cutoff_minutes | int | Default 120; range 0–10080 |
| tour.cancellation_hours | int | Default 24; per-tour override |
| tour.add_ons[] | array (nullable) | Optional extras shown at booking step |

---

## ⚠️ Pending — Product Owner এর কাছ থেকে Confirm করতে হবে

1. **Destinations:** Exact list কী কী থাকবে launch এ? Phased rollout আছে কিনা?
2. **Categories:** Final category list কী কী?
3. **Hub eligibility:** Klein Curaçao Hub এ কোন categories এর tours allowed?
4. **Future Hubs:** Launch এ Curaçao ছাড়া অন্য destinations এ কি Hub থাকবে?