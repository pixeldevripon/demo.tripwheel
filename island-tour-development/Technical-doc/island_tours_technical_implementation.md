# Island Tours — Technical Implementation Guide

> প্রতিটা point এর **কী করতে হবে**, **কীভাবে করতে হবে**, এবং **কোন logic দিয়ে** করতে হবে সেটা এখানে আছে। UI/design নেই — শুধু engineering।

---

## 1. URL & Routing

---

### 1.1 URL Pattern

**কী:** `/{locale}/{destination}/{hub-slug?}/{tour-slug}/` — locale prefix সবসময় থাকবে, slug সবসময় English।

**Implementation:**

```
/en/curacao/klein-curacao/miss-ann/     ← hub-anchored tour
/en/curacao/sunset-cruise-bluefinn/     ← destination-only tour
/es/curacao/klein-curacao/miss-ann/     ← same tour, Spanish locale
/nl/curacao/boat-tours/                 ← category page
```

Next.js এ দুটো dynamic route দরকার:

```
app/
└── [locale]/
    └── [destination]/
        ├── page.tsx                    ← destination page
        ├── tours/
        │   └── page.tsx                ← all tours listing
        └── [slug]/
            ├── page.tsx                ← category | hub | tour (slug registry resolve করবে)
            └── [tourSlug]/
                └── page.tsx            ← hub-anchored tour
```

`[slug]/page.tsx` এ slug registry query করে কোন component render করবে সেটা decide করতে হবে:

```typescript
// app/[locale]/[destination]/[slug]/page.tsx
export default async function DynamicPage({ params }) {
  const entity = await resolveSlug(params.destination, params.slug);

  switch (entity.type) {
    case 'hub':        return <HubPage entity={entity} locale={params.locale} />;
    case 'category':   return <CategoryPage entity={entity} locale={params.locale} />;
    case 'tour':       return <TourDetailPage entity={entity} locale={params.locale} />;
    case 'reserved':   redirect(`/${params.locale}/${params.destination}/tours/`);
    default:           notFound();
  }
}
```

---

### 1.2 Reserved Slug "tours"

**কী:** প্রতিটা destination এ `tours` slug কেউ ব্যবহার করতে পারবে না — operator, admin কেউ না।

**Implementation:**

Database এ slug registry table এ destination seed করার সময়েই এটা insert করতে হবে:

```sql
-- slug_registry table
CREATE TABLE slug_registry (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destination   VARCHAR(100) NOT NULL,   -- 'curacao'
  slug          VARCHAR(200) NOT NULL,   -- 'tours'
  entity_type   VARCHAR(50)  NOT NULL,   -- 'tour' | 'category' | 'hub' | 'collection' | 'reserved'
  entity_id     UUID,                    -- NULL for reserved
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (destination, slug)
);

-- Seed করার সময়:
INSERT INTO slug_registry (destination, slug, entity_type, entity_id)
VALUES ('curacao', 'tours', 'reserved', NULL);
```

Tour বা category create করার সময় slug validate করতে হবে:

```typescript
async function validateSlug(destination: string, slug: string): Promise<void> {
  const existing = await db.slugRegistry.findFirst({
    where: { destination, slug }
  });

  if (existing) {
    if (existing.entity_type === 'reserved') {
      throw new Error(`Slug "${slug}" is reserved and cannot be used.`);
    }
    throw new Error(`Slug "${slug}" is already taken.`);
  }
}
```

---

### 1.3 Slug Registry — Entity Resolution

**কী:** একটা slug আসলে কোন entity সেটা database থেকে resolve করতে হবে।

**Implementation:**

```typescript
// lib/slug-registry.ts
type EntityType = 'tour' | 'category' | 'hub' | 'collection' | 'reserved';

interface ResolvedEntity {
  type: EntityType;
  id: string | null;
  destination: string;
  slug: string;
}

export async function resolveSlug(
  destination: string,
  slug: string
): Promise<ResolvedEntity | null> {
  const record = await db.slugRegistry.findFirst({
    where: {
      destination: destination.toLowerCase(),
      slug: slug.toLowerCase(),
    }
  });

  if (!record) return null;

  return {
    type: record.entity_type as EntityType,
    id: record.entity_id,
    destination: record.destination,
    slug: record.slug,
  };
}
```

Hub-anchored tour এর জন্য দুটো slug resolve করতে হবে:

```typescript
// app/[locale]/[destination]/[slug]/[tourSlug]/page.tsx
export default async function HubTourPage({ params }) {
  const hub = await resolveSlug(params.destination, params.slug);
  if (!hub || hub.type !== 'hub') notFound();

  const tour = await resolveSlug(params.destination, params.tourSlug);
  if (!tour || tour.type !== 'tour') notFound();

  return <TourDetailPage tourId={tour.id} hubId={hub.id} locale={params.locale} />;
}
```

---

### 1.4 Next.js Route Structure

**কী:** Next.js 14+ App Router দিয়ে locale-aware routing।

**Implementation:**

```typescript
// middleware.ts
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['en', 'es', 'nl', 'pt', 'fr', 'de', 'zh'],
  defaultLocale: 'en',
  localePrefix: 'always',  // সবসময় /en/, /es/ দেখাবে — /curacao/ alone কাজ করবে না
});

export const config = {
  // API routes, static files, _next বাদে সব route এ middleware run করবে
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap).*)'],
};
```

`localePrefix: 'always'` মানে `/curacao/` কেউ access করলে `/en/curacao/` এ redirect হবে।

---

### 1.5 URL Params এ Booking State Persist

**কী:** Date, travelers select করলে URL এ push হবে। Share করলে বা refresh করলে same state দেখাবে।

**Implementation:**

```typescript
// hooks/useBookingParams.ts
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export function useBookingParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const date = searchParams.get('date');       // '2026-05-15'
  const travelers = searchParams.get('travelers'); // '2'
  const time = searchParams.get('time');       // '08:00' (optional)

  function updateParams(updates: { date?: string; travelers?: number; time?: string }) {
    const params = new URLSearchParams(searchParams.toString());

    if (updates.date !== undefined)      params.set('date', updates.date);
    if (updates.travelers !== undefined) params.set('travelers', String(updates.travelers));
    if (updates.time !== undefined)      params.set('time', updates.time);

    // replace নয়, push — back button কাজ করবে
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return { date, travelers: travelers ? Number(travelers) : 2, time, updateParams };
}
```

Widget mount হলে URL params থেকে initial state hydrate করবে:

```typescript
// Widget initialization
const { date, travelers, time } = useBookingParams();

useEffect(() => {
  if (date) setSelectedDate(date);
  if (travelers) setPartySize(travelers);
  if (time) setSelectedTime(time);
}, []); // mount এ একবার
```

---

## 2. Rendering Strategy

---

### 2.1 SSR — Page Shell + Above-the-Fold

**কী:** Page এর প্রথম দেখায় যা আসে (breadcrumb, H1, rating, hero image) সেগুলো server এ render হবে।

**Implementation:**

```typescript
// app/[locale]/[destination]/[slug]/page.tsx
// এটা async Server Component — 'use client' নেই

export default async function TourDetailPage({ params }) {
  // Server এ data fetch — no loading state, no useEffect
  const tour = await getTourBySlug(params.destination, params.slug, params.locale);

  if (!tour) notFound();

  return (
    <>
      {/* SSR — immediately in HTML response */}
      <Breadcrumbs items={tour.breadcrumbs} />
      <h1>{tour.h1}</h1>
      <RatingRow rating={tour.rating} reviewCount={tour.reviewCount} />
      <ImageGallery images={tour.galleryImages} />
      <QuickInfoBadges tour={tour} />

      {/* Client Component — hydrates after LCP */}
      <BookingWidgetShell
        tourId={tour.id}
        initialPrice={tour.priceFrom}
        pricingModel={tour.pricingModel}
      />

      {/* SSR — editorial content */}
      <TourOverview text={tour.overview} />
      <Highlights items={tour.highlights} />

      {/* JSON-LD structured data — SSR */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(tour.structuredData) }}
      />
    </>
  );
}
```

---

### 2.2 Booking Widget — Deferred Hydration

**কী:** Booking widget LCP এর পরে hydrate হবে — LCP block করবে না।

**Implementation:**

```typescript
// components/BookingWidgetShell.tsx
'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import — bundle split করবে
const BookingWidget = dynamic(() => import('./BookingWidget'), {
  ssr: false,
  loading: () => <BookingWidgetSkeleton />,  // stable height placeholder
});

export function BookingWidgetShell({ tourId, initialPrice, pricingModel }) {
  const [shouldMount, setShouldMount] = useState(false);

  useEffect(() => {
    // requestIdleCallback — browser idle হলে তখন mount করবে
    const id = requestIdleCallback(
      () => setShouldMount(true),
      { timeout: 3000 }  // max 3s wait, তারপর force mount
    );
    return () => cancelIdleCallback(id);
  }, []);

  // Hydration এর আগে skeleton দেখাবে — same height, zero CLS
  if (!shouldMount) {
    return <BookingWidgetSkeleton initialPrice={initialPrice} />;
  }

  return <BookingWidget tourId={tourId} initialPrice={initialPrice} pricingModel={pricingModel} />;
}
```

Skeleton এর height exactly widget এর height এর সমান হতে হবে:

```typescript
// BookingWidgetSkeleton — same dimensions as real widget
function BookingWidgetSkeleton({ initialPrice }) {
  return (
    <div style={{ height: '420px', width: '100%' }}>  {/* exact height */}
      <div>From €{initialPrice}</div>
      {/* Shimmer animation দিয়ে loading feel */}
    </div>
  );
}
```

---

### 2.3 ISR — Incremental Static Regeneration

**কী:** Static content 300 seconds পর পর background এ revalidate হবে। User পুরনো version দেখবে না — background এ update হবে।

**Implementation:**

```typescript
// app/[locale]/[destination]/[slug]/page.tsx
export const revalidate = 300; // 5 minutes — tour detail page

// All Tours page
// app/[locale]/[destination]/tours/page.tsx
export const revalidate = 60; // 1 minute — listing page বেশি frequently update হয়
```

On-demand revalidation — CMS থেকে content update হলে immediately revalidate:

```typescript
// app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  const { secret, tourSlug, locale, destination } = await request.json();

  // Secret key দিয়ে validate — যে কেউ call করতে পারবে না
  if (secret !== process.env.REVALIDATION_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // সব locale এর জন্য revalidate
  const locales = ['en', 'es', 'nl', 'pt', 'fr', 'de', 'zh'];
  for (const loc of locales) {
    revalidatePath(`/${loc}/${destination}/${tourSlug}`);
  }

  return Response.json({ revalidated: true });
}
```

---

### 2.4 Availability — Fetch on Date-Picker Open

**কী:** Page load এ availability fetch করবে না — date picker open করলে তখন fetch করবে।

**Implementation:**

```typescript
// Compact chip view — cached, page load এর সময় SSR দিয়ে আসে
// Expanded month view — user "View all dates" click করলে live fetch

function DatePicker({ tourId }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [monthData, setMonthData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Compact view এর chips — SSR থেকে আসা cached data
  // এখানে কোনো fetch নেই

  async function handleExpand() {
    setIsExpanded(true);
    setLoading(true);

    // এখন live fetch করবে
    const data = await fetchAvailability(tourId, currentMonth);
    setMonthData(data);
    setLoading(false);
  }

  async function handleMonthChange(month: string) {
    setLoading(true);
    // নতুন month এর জন্য fresh fetch
    const data = await fetchAvailability(tourId, month);
    setMonthData(data);
    setLoading(false);
  }

  return (
    <>
      <CompactChipRow {/* cached data */} />
      {!isExpanded && (
        <button onClick={handleExpand}>View all dates</button>
      )}
      {isExpanded && (
        <MonthCalendar
          data={monthData}
          loading={loading}
          onMonthChange={handleMonthChange}
        />
      )}
    </>
  );
}
```

---

### 2.5 Hero Image Preload

**কী:** Hero image LCP candidate — browser কে আগে থেকে জানাতে হবে এটা load করতে।

**Implementation:**

```typescript
// app/[locale]/[destination]/[slug]/page.tsx
export async function generateMetadata({ params }) {
  const tour = await getTourBySlug(params.destination, params.slug, params.locale);

  return {
    // Next.js automatically adds <link rel="preload"> for this
    openGraph: {
      images: [{ url: tour.heroImage.url }],
    },
  };
}

// অথবা manually head এ:
// app/[locale]/[destination]/[slug]/layout.tsx
export default function TourLayout({ children, params }) {
  return (
    <>
      <head>
        <link
          rel="preload"
          as="image"
          href={heroImageUrl}
          imageSrcSet={`${heroImageUrl}?w=800 800w, ${heroImageUrl}?w=1200 1200w, ${heroImageUrl}?w=2400 2400w`}
          imageSizes="(max-width: 768px) 100vw, 60vw"
        />
      </head>
      {children}
    </>
  );
}
```

Image component এ priority flag:

```typescript
import Image from 'next/image';

// Hero image — always priority
<Image
  src={heroImage.url}
  alt={heroImage.alt}
  priority={true}         // preload করবে, lazy load করবে না
  sizes="(max-width: 768px) 100vw, 60vw"
  width={2400}
  height={1800}
/>
```

---

### 2.6 Stable Heights — Zero CLS

**কী:** Hydration এর আগে এবং পরে page এর কোনো element এর height change হবে না।

**Implementation:**

Booking widget এর প্রতিটা state এর জন্য fixed height define করতে হবে:

```css
/* Widget container — fixed height সব state এ */
.booking-widget {
  min-height: 420px;  /* S1 initial state এর height */
}

/* Date picker open হলে height বাড়বে — কিন্তু widget এর নিচের content push হবে */
/* Widget এর নিচে কিছু নেই desktop এ (sticky) তাই CLS issue নেই */
```

Rating row — SSR এ placeholder height:

```typescript
// RatingRow — SSR এ exact height
// rating data না থাকলেও height same রাখতে হবে

function RatingRow({ rating, reviewCount }) {
  // rating hidden হলেও row এর জায়গা রাখো
  // visibility: hidden — height রাখে কিন্তু দেখা যায় না
  // display: none করলে CLS হবে

  if (!rating) return <div style={{ height: '28px' }} aria-hidden="true" />;

  return (
    <div style={{ height: '28px' }}>
      ★ {rating} · {reviewCount} reviews
    </div>
  );
}
```

---

## 3. Performance Budget

---

### 3.1 LCP < 2.5s

**কী:** Page load এর 2.5 সেকেন্ডের মধ্যে hero image screen এ দেখা যেতে হবে।

**Implementation logic:**

LCP কমানোর জন্য যা করতে হবে:

1. Hero image preload (উপরে 2.5 এ আছে)
2. AVIF/WebP format — JPEG এর চেয়ে 30-50% ছোট
3. CDN থেকে serve — origin server থেকে নয়
4. `sizes` attribute ঠিকমতো দিতে হবে যাতে browser সঠিক size এর image নামায়

```typescript
<Image
  src={heroImage.url}
  priority={true}
  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 60vw, 800px"
  // এটা browser কে বলে কোন viewport এ কত বড় image দরকার
  // browser তখন srcset থেকে সঠিক image বেছে নেয়
/>
```

Monitoring — Next.js built-in:

```typescript
// app/layout.tsx
export function reportWebVitals(metric) {
  if (metric.name === 'LCP') {
    // 2500ms এর বেশি হলে alert
    if (metric.value > 2500) {
      console.warn('LCP budget exceeded:', metric.value);
      // Analytics এ পাঠাও
    }
  }
}
```

---

### 3.2 INP < 200ms (page), < 100ms (booking widget)

**কী:** User কিছু click করলে 200ms এর মধ্যে visual response দিতে হবে। Booking widget এ 100ms।

**Implementation logic:**

INP বাড়ার কারণ সাধারণত:
- Long JavaScript tasks (>50ms) main thread block করে
- Event handler এ heavy computation

Date picker chip click এ:

```typescript
function handleDateChipClick(date: string) {
  // 1. Immediately UI update — optimistic
  setSelectedDate(date);        // instant visual feedback
  setWidgetState('S3');         // CTA বদলে যাবে

  // 2. Background এ time slots fetch — non-blocking
  startTransition(() => {       // React 18 — lower priority
    fetchTimeSlots(date).then(setTimeSlots);
  });
}
// Total: UI update instant, fetch background এ
```

Heavy computation (price calculation) web worker এ:

```typescript
// Heavy price calculation — main thread block করবে না
const worker = new Worker('/workers/price-calculator.js');

function calculatePrice(date, travelers, addons) {
  return new Promise((resolve) => {
    worker.postMessage({ date, travelers, addons });
    worker.onmessage = (e) => resolve(e.data.total);
  });
}
```

---

### 3.3 CLS < 0.05

**কী:** Page load এ কোনো content নিচে ধাক্কা খাবে না।

**Implementation logic:**

CLS হওয়ার সাধারণ কারণ এবং fix:

```typescript
// ❌ WRONG — image height unknown, page load এ shift হবে
<img src={heroImage.url} alt="..." />

// ✅ CORRECT — aspect ratio reserve করে রাখো
<Image
  src={heroImage.url}
  width={2400}
  height={1800}    // browser জানে কতটুকু জায়গা রাখতে হবে
  alt="..."
/>
```

Font loading:

```typescript
// ❌ WRONG — font load হলে text reflow হবে
@import url('https://fonts.googleapis.com/...');

// ✅ CORRECT — font-display: optional বা swap
// Next.js built-in font optimization use করো
import { Inter } from 'next/font/google';
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',  // FOUT accept করা হচ্ছে কিন্তু FOIT নয়
});
```

---

### 3.4 Image Format & Size

**কী:** AVIF → WebP → JPEG priority তে serve করতে হবে। Max 200KB per image।

**Implementation:**

Next.js Image Optimization automatically handles format negotiation:

```typescript
// next.config.js
module.exports = {
  images: {
    formats: ['image/avif', 'image/webp'],  // AVIF first, WebP fallback
    deviceSizes: [640, 828, 1080, 1200, 1920, 2400],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,  // 30 days CDN cache
  },
};
```

Image upload pipeline — operator upload করলে:

```typescript
// Backend: image processing pipeline
async function processUploadedImage(file: Buffer, type: 'hero' | 'tile') {
  const sharp = require('sharp');

  const targetWidth = type === 'hero' ? 2400 : 1200;
  const targetHeight = type === 'hero' ? 1800 : 1200;

  // AVIF generate
  const avif = await sharp(file)
    .resize(targetWidth, targetHeight, { fit: 'cover', position: 'centre' })
    .avif({ quality: 80 })
    .toBuffer();

  // WebP generate
  const webp = await sharp(file)
    .resize(targetWidth, targetHeight, { fit: 'cover', position: 'centre' })
    .webp({ quality: 85 })
    .toBuffer();

  // JPEG fallback
  const jpeg = await sharp(file)
    .resize(targetWidth, targetHeight, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 85, progressive: true })
    .toBuffer();

  // 200KB check
  if (jpeg.length > 200 * 1024) {
    // Quality কমিয়ে retry
  }

  // Content hash দিয়ে filename — CDN cache bust করা যাবে
  const hash = crypto.createHash('md5').update(avif).digest('hex').slice(0, 8);
  const filename = `${tourId}-${type}-${hash}`;

  // Upload to CDN/S3
  await uploadToCDN(filename, { avif, webp, jpeg });

  return { url: `https://cdn.islandtours.com/images/${filename}`, hash };
}
```

---

## 4. Database & CMS — Tour Level Fields

---

### 4.1 tour.pickup_model

**কী:** Tour এর pickup situation কী সেটা enum দিয়ে define।

**Implementation:**

```sql
CREATE TYPE pickup_model AS ENUM ('included', 'paid_addon', 'none');

ALTER TABLE tours ADD COLUMN pickup_model pickup_model NOT NULL DEFAULT 'none';
```

Badge render logic:

```typescript
function getPickupBadgeText(model: 'included' | 'paid_addon' | 'none'): string {
  switch (model) {
    case 'included':   return 'Pickup included';
    case 'paid_addon': return 'Pickup available';
    case 'none':       return 'Meeting point only';
    default:           return 'Meeting point only';  // safe default
  }
}

// Add-on step এ pickup add করা যাবে কিনা:
const canAddPickup = tour.pickup_model === 'paid_addon';
```

---

### 4.2 tour.pricing_model + tour.unit_type

**কী:** Per person pricing বা group/boat/vehicle হিসেবে flat pricing।

**Implementation:**

```sql
CREATE TYPE pricing_model AS ENUM ('per_person', 'unit');
CREATE TYPE unit_type AS ENUM ('group', 'boat', 'vehicle', 'aircraft', 'package');

ALTER TABLE tours
  ADD COLUMN pricing_model pricing_model NOT NULL DEFAULT 'per_person',
  ADD COLUMN unit_type unit_type;  -- NULL for per_person tours
```

Price calculation logic:

```typescript
function calculateTotal(
  tour: Tour,
  partySize: number,
  ageBands?: AgeBandSelection
): number {
  if (tour.pricing_model === 'unit') {
    // Flat price — party size বাড়লেও price বাড়ে না
    return tour.base_price;
  }

  if (tour.age_bands && ageBands) {
    // Age-banded: Adults × adult_price + Children × child_price + ...
    return (
      (ageBands.adults * tour.age_bands.adult_price) +
      (ageBands.children * tour.age_bands.child_price) +
      ((ageBands.infants ?? 0) * (tour.age_bands.infant_price ?? 0))
    );
  }

  // Standard per-person
  return tour.base_price * partySize;
}
```

Display logic:

```typescript
function getPriceDisplay(tour: Tour, partySize: number, total: number): string {
  if (tour.pricing_model === 'unit') {
    return `Total: €${total} (up to ${tour.max_party_size} people)`;
  }
  return `Total: €${total}`;
}

function getPriceFromDisplay(tour: Tour): string {
  if (tour.pricing_model === 'unit') {
    return `From €${tour.base_price} per ${tour.unit_type}`;
  }
  return `From €${tour.base_price} per person`;
}
```

---

### 4.3 tour.booking_cutoff_minutes

**কী:** Tour এর কত আগ পর্যন্ত booking accept করা হবে। Default 120 minutes।

**Implementation:**

```sql
ALTER TABLE tours
  ADD COLUMN booking_cutoff_minutes INTEGER NOT NULL DEFAULT 120
  CHECK (booking_cutoff_minutes >= 0 AND booking_cutoff_minutes <= 10080);
-- 0 = zero-minute cutoff (cruise-day-tripper segment)
-- 10080 = 1 week cutoff
```

Date chip এ cutoff check:

```typescript
function getChipState(
  date: string,
  tourStartTime: string,
  cutoffMinutes: number
): ChipState {
  const now = new Date();
  const tourDateTime = new Date(`${date}T${tourStartTime}`);
  const cutoffDateTime = new Date(tourDateTime.getTime() - cutoffMinutes * 60 * 1000);

  if (now >= cutoffDateTime) return 'cutoff_passed';  // chip "Closed" দেখাবে

  // Other checks...
  return 'available';
}
```

Real-time update — user session চলাকালীন cutoff pass হলে:

```typescript
// Booking widget এ interval চালাও
useEffect(() => {
  const interval = setInterval(() => {
    const todayChipState = getChipState(today, tourStartTime, tour.booking_cutoff_minutes);

    if (todayChipState === 'cutoff_passed' && selectedDate === today) {
      // User today select করে বসে আছে, এখন cutoff pass হয়ে গেছে
      setSelectedDate(null);
      setWidgetState('S1');
      showInlineMessage("Today's bookings just closed. Pick another date.");
    }

    // Today chip update
    setTodayChipState(todayChipState);
  }, 60 * 1000);  // প্রতি মিনিটে check

  return () => clearInterval(interval);
}, [tour.booking_cutoff_minutes, selectedDate]);
```

---

### 4.4 tour.cancellation_hours

**কী:** Tour এর কত ঘণ্টা আগ পর্যন্ত free cancellation পাওয়া যাবে।

**Implementation:**

```sql
ALTER TABLE tours
  ADD COLUMN cancellation_hours INTEGER NOT NULL DEFAULT 24;
-- Default 24h — LD1 অনুযায়ী
-- Per-tour override allowed
```

Trust strip text generate করতে:

```typescript
function getCancellationText(hours: number): string {
  if (hours === 24) return 'Free cancellation up to 24h';
  if (hours === 48) return 'Free cancellation up to 48h';
  if (hours >= 168)  return `Free cancellation up to ${hours / 24} days`;
  return `Free cancellation up to ${hours}h`;
}
```

Cancellation policy section এর text:

```typescript
function getCancellationPolicyText(hours: number): string {
  const deadline = hours >= 24 ? `${hours / 24} day${hours / 24 > 1 ? 's' : ''}` : `${hours} hours`;
  return `Cancel at least ${deadline} before your tour for a full refund.`;
}
```

---

### 4.5 tour.age_bands[]

**কী:** Adult/Child/Infant আলাদা price এর tour এর জন্য।

**Implementation:**

```sql
CREATE TABLE tour_age_bands (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id     UUID NOT NULL REFERENCES tours(id),
  band_type   VARCHAR(20) NOT NULL,   -- 'adult' | 'child' | 'infant'
  label       VARCHAR(50),            -- 'Adults (13+)', 'Children (3-12)'
  min_age     INTEGER,
  max_age     INTEGER,
  price       DECIMAL(10,2) NOT NULL,
  min_count   INTEGER DEFAULT 0,
  max_count   INTEGER,
  display_order INTEGER NOT NULL
);
```

Party selector render logic:

```typescript
function AgeBandedPartySelector({ ageBands, onChange }) {
  const [counts, setCounts] = useState(
    ageBands.reduce((acc, band) => ({ ...acc, [band.band_type]: band.min_count }), {})
  );

  function updateCount(bandType: string, delta: number) {
    const band = ageBands.find(b => b.band_type === bandType);
    const current = counts[bandType];
    const next = Math.max(band.min_count, Math.min(band.max_count ?? Infinity, current + delta));

    const newCounts = { ...counts, [bandType]: next };
    setCounts(newCounts);
    onChange(newCounts);
  }

  return ageBands.map(band => (
    <div key={band.band_type}>
      <span>{band.label}</span>
      <button onClick={() => updateCount(band.band_type, -1)}>-</button>
      <span>{counts[band.band_type]}</span>
      <button onClick={() => updateCount(band.band_type, +1)}>+</button>
      <span>€{band.price} each</span>
    </div>
  ));
}
```

---

### 4.6 tour.add_ons[] — EU Digital Fairness Act

**কী:** Optional extras যেগুলো user নিজে select করবে। **কখনো pre-checked রাখা যাবে না।** এটা EU আইন।

**Implementation:**

```sql
CREATE TABLE tour_add_ons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id       UUID NOT NULL REFERENCES tours(id),
  name          VARCHAR(100) NOT NULL,   -- 'Hotel pickup', 'Snorkel mask rental'
  description   TEXT,
  price         DECIMAL(10,2) NOT NULL,
  unit          VARCHAR(20) DEFAULT 'per_person',  -- 'per_person' | 'flat'
  max_quantity  INTEGER DEFAULT 1,
  display_order INTEGER NOT NULL
);
```

Add-on card — always unchecked on mount:

```typescript
function AddOnCard({ addOn, onToggle }) {
  // ✅ Always false on mount — EU Digital Fairness Act
  const [selected, setSelected] = useState(false);
  const [quantity, setQuantity] = useState(1);

  // ❌ NEVER do this:
  // const [selected, setSelected] = useState(addOn.is_recommended);

  return (
    <div>
      <input
        type="checkbox"
        checked={selected}       // controlled — default false
        onChange={(e) => {
          setSelected(e.target.checked);
          onToggle(addOn.id, e.target.checked, quantity);
        }}
      />
      <label>{addOn.name}</label>
      <p>{addOn.description}</p>
      <span>+€{addOn.price}</span>
    </div>
  );
}
```

Add-on step কখন দেখাবে:

```typescript
// Date + time + party select হওয়ার পরে, "Continue" এর আগে
const showAddOns = (
  selectedDate !== null &&
  (tour.departures.length <= 1 || selectedTime !== null) &&
  partySize >= tour.min_party_size &&
  tour.add_ons.length > 0  // add-on আছে কিনা
);
```

---

### 4.7 tour.max_party_size / tour.min_party_size

**কী:** Booking widget এর +/- button এর hard limit।

**Implementation:**

```typescript
function PartySelector({ min, max, value, onChange }) {
  const canDecrease = value > min;
  const canIncrease = value < max;

  return (
    <div>
      <button
        disabled={!canDecrease}
        onClick={() => onChange(value - 1)}
        aria-label="Remove traveler"
      >-</button>

      <span aria-live="polite">{value} traveler{value !== 1 ? 's' : ''}</span>

      <button
        disabled={!canIncrease}
        onClick={() => onChange(value + 1)}
        aria-label="Add traveler"
      >+</button>
    </div>
  );
}

// Min party constraint message:
function getMinPartyMessage(min: number, current: number): string | null {
  if (current < min) {
    return `This tour needs at least ${min} travelers.`;
  }
  return null;
}
```

---

### 4.8 tour.gallery_images[] — Ordered Array with Focal Point

**কী:** Images ordered array, প্রথমটা hero, প্রতিটায় focal point support।

**Implementation:**

```sql
CREATE TABLE tour_images (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id       UUID NOT NULL REFERENCES tours(id),
  url           TEXT NOT NULL,
  url_avif      TEXT,
  url_webp      TEXT,
  is_hero       BOOLEAN NOT NULL DEFAULT false,
  focal_x       FLOAT DEFAULT 0.5,   -- 0.0 left, 1.0 right
  focal_y       FLOAT DEFAULT 0.5,   -- 0.0 top, 1.0 bottom
  alt_text      TEXT,
  display_order INTEGER NOT NULL,
  width         INTEGER NOT NULL,
  height        INTEGER NOT NULL
);

-- Constraint: exactly one hero per tour
CREATE UNIQUE INDEX one_hero_per_tour ON tour_images(tour_id) WHERE is_hero = true;
```

Focal point CSS:

```typescript
function TourImage({ image, aspectRatio }) {
  const objectPosition = `${image.focal_x * 100}% ${image.focal_y * 100}%`;

  return (
    <div style={{ aspectRatio, overflow: 'hidden' }}>
      <Image
        src={image.url}
        alt={image.alt_text}
        fill
        style={{ objectFit: 'cover', objectPosition }}
        // focal point অনুযায়ী crop হবে
      />
    </div>
  );
}
```

Minimum image check — publish করার আগে:

```typescript
async function canPublishTour(tourId: string): Promise<{ allowed: boolean; reason?: string }> {
  const imageCount = await db.tourImages.count({ where: { tour_id: tourId } });

  if (imageCount < 5) {
    return {
      allowed: false,
      reason: `Tour needs at least 5 images. Currently has ${imageCount}.`
    };
  }

  // অন্যান্য checks...
  return { allowed: true };
}
```

---

### 4.9 tour.overview_{locale} — Markdown Field

**কী:** Per-locale tour description। Paragraph breaks only — heading, list, bold allowed নয়।

**Implementation:**

```sql
-- translations table এ store হবে (multilingual section এ detail আছে)
-- field = 'overview'
-- value = markdown text

-- অথবা dedicated column:
ALTER TABLE tours
  ADD COLUMN overview_en TEXT,
  ADD COLUMN overview_es TEXT,
  ADD COLUMN overview_nl TEXT,
  ADD COLUMN overview_pt TEXT,
  ADD COLUMN overview_fr TEXT,
  ADD COLUMN overview_de TEXT,
  ADD COLUMN overview_zh TEXT;
```

CMS validation — save করার আগে check:

```typescript
function validateOverview(markdown: string): string | null {
  // Heading check
  if (/^#{1,6}\s/m.test(markdown)) {
    return 'Overview cannot contain headings.';
  }

  // Bullet list check
  if (/^[-*+]\s/m.test(markdown)) {
    return 'Overview cannot contain bullet lists.';
  }

  // Numbered list check
  if (/^\d+\.\s/m.test(markdown)) {
    return 'Overview cannot contain numbered lists.';
  }

  // Bold check
  if (/\*\*.+\*\*/m.test(markdown) || /__.+__/m.test(markdown)) {
    return 'Overview cannot contain bold text.';
  }

  // Word count
  const wordCount = markdown.trim().split(/\s+/).length;
  if (wordCount > 200) {
    return `Overview is ${wordCount} words. Maximum is 200.`;
  }

  return null; // valid
}
```

Render করার সময় safe markdown parser:

```typescript
import { marked } from 'marked';

// Custom renderer — শুধু paragraph allow করবে
const renderer = new marked.Renderer();

renderer.heading = (text) => `<p>${text}</p>`;  // heading → paragraph convert
renderer.list = () => '';                        // list skip
renderer.strong = (text) => text;               // bold strip

function TourOverview({ markdown }) {
  const html = marked(markdown, { renderer });
  return (
    <section aria-label="Tour overview">
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
}
```

---

### 4.10 tour.highlights_{locale}[]

**কী:** 3–6 bullet points, 5–15 words each।

**Implementation:**

```sql
CREATE TABLE tour_highlights (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id       UUID NOT NULL REFERENCES tours(id),
  locale        VARCHAR(5) NOT NULL DEFAULT 'en',
  text          VARCHAR(200) NOT NULL,  -- 15 words max ≈ ~100 chars তবে 200 safe
  display_order INTEGER NOT NULL,
  UNIQUE (tour_id, locale, display_order)
);
```

CMS validation:

```typescript
function validateHighlight(text: string): string | null {
  const wordCount = text.trim().split(/\s+/).length;

  if (wordCount < 5)  return `Too short (${wordCount} words). Minimum 5 words.`;
  if (wordCount > 15) return `Too long (${wordCount} words). Maximum 15 words.`;

  return null;
}

function validateHighlights(highlights: string[]): string | null {
  if (highlights.length < 3) return 'Minimum 3 highlights required.';
  if (highlights.length > 6) return 'Maximum 6 highlights allowed.';

  for (const h of highlights) {
    const error = validateHighlight(h);
    if (error) return error;
  }

  return null;
}
```

---

## 5. Database & CMS — Operator Level

---

### 5.1 operator.aggregate_rating (Computed)

**কী:** Operator এর সব tours এর average rating — real-time computed।

**Implementation:**

```sql
-- View হিসেবে রাখলে always fresh:
CREATE VIEW operator_aggregates AS
SELECT
  o.id AS operator_id,
  COUNT(r.id) AS review_count,
  ROUND(AVG(r.rating)::NUMERIC, 1) AS avg_rating
FROM operators o
LEFT JOIN tours t ON t.operator_id = o.id
LEFT JOIN reviews r ON r.tour_id = t.id AND r.status = 'approved'
GROUP BY o.id;
```

অথবা nightly computed এবং cache করা:

```sql
-- operators table এ cached columns:
ALTER TABLE operators
  ADD COLUMN aggregate_rating DECIMAL(3,1),
  ADD COLUMN aggregate_review_count INTEGER DEFAULT 0,
  ADD COLUMN aggregates_updated_at TIMESTAMPTZ;

-- Nightly job বা review approve হলে update:
UPDATE operators SET
  aggregate_rating = (
    SELECT ROUND(AVG(r.rating)::NUMERIC, 1)
    FROM reviews r
    JOIN tours t ON r.tour_id = t.id
    WHERE t.operator_id = operators.id AND r.status = 'approved'
  ),
  aggregate_review_count = (
    SELECT COUNT(r.id)
    FROM reviews r
    JOIN tours t ON r.tour_id = t.id
    WHERE t.operator_id = operators.id AND r.status = 'approved'
  ),
  aggregates_updated_at = now()
WHERE id = $1;
```

---

### 5.2 Provider Rating Rule (LD11) — Critical Logic

**কী:** Tour এর নিজের review কম থাকলে operator aggregate দেখাবে — কিন্তু শুধু specific condition এ।

**Implementation — exact logic:**

```typescript
interface RatingDisplayResult {
  show: boolean;
  rating?: number;
  reviewCount?: number;
  isOperatorAggregate?: boolean;
  attributionText?: string;
}

function getRatingDisplay(tour: Tour, operator: Operator): RatingDisplayResult {
  const nativeReviewCount = tour.native_review_count;
  const nativeRating = tour.native_avg_rating;

  // Case 1: Tour has 3+ native reviews — show tour's own rating
  if (nativeReviewCount >= 3) {
    return {
      show: true,
      rating: nativeRating,
      reviewCount: nativeReviewCount,
      isOperatorAggregate: false,
    };
  }

  // Case 2: Tour has < 3 native reviews — check operator threshold
  // তিনটা condition একসাথে পূরণ হতে হবে:
  const operatorQualifies = (
    operator.aggregate_review_count >= 10 &&   // condition 1
    operator.aggregate_rating >= 4.0            // condition 2
    // condition 3: native < 3 (already checked above)
  );

  if (operatorQualifies) {
    return {
      show: true,
      rating: operator.aggregate_rating,
      reviewCount: operator.aggregate_review_count,
      isOperatorAggregate: true,
      attributionText: `From this host's ${operator.aggregate_review_count} reviews across all tours`,
    };
  }

  // Case 3: Neither condition met — hide rating row entirely
  return { show: false };
}
```

Render:

```typescript
function RatingRow({ tour, operator }) {
  const display = getRatingDisplay(tour, operator);

  if (!display.show) return null;  // hidden — no placeholder space needed here

  return (
    <a
      href="#reviews"
      onClick={scrollToReviews}
      tabIndex={0}
      aria-label={`Rating: ${display.rating} stars out of 5, ${display.reviewCount} reviews. Activate to read reviews.`}
    >
      ★ {display.rating}
      {display.isOperatorAggregate ? (
        <span>{display.attributionText}</span>
      ) : (
        <span>· {formatNumber(display.reviewCount)} review{display.reviewCount !== 1 ? 's' : ''}</span>
      )}
    </a>
  );
}
```

---

## 6. Multilingual — 7 Languages

---

### 6.1 7 Locales — Launch থেকেই

**কী:** EN primary, বাকি 6 launch থেকে active। Missing translation → English fallback।

**Implementation:**

```typescript
// lib/i18n/config.ts
export const locales = ['en', 'es', 'nl', 'pt', 'fr', 'de', 'zh'] as const;
export type Locale = typeof locales[number];
export const defaultLocale: Locale = 'en';

// Translation fetch with fallback:
async function getTranslatedField(
  entityType: string,
  entityId: string,
  field: string,
  locale: Locale
): Promise<{ value: string; isTranslated: boolean }> {
  // Requested locale try করো
  const translation = await db.translations.findFirst({
    where: { entity_type: entityType, entity_id: entityId, locale, field }
  });

  if (translation) {
    return { value: translation.value, isTranslated: locale !== 'en' };
  }

  // Fallback to English
  const fallback = await db.translations.findFirst({
    where: { entity_type: entityType, entity_id: entityId, locale: 'en', field }
  });

  return {
    value: fallback?.value ?? '',
    isTranslated: false  // English fallback — "Translated" badge দেখাবে না
  };
}
```

---

### 6.2 Slug Locale-Independent

**কী:** `/en/curacao/miss-ann/` এবং `/es/curacao/miss-ann/` same tour resolve করবে।

**Implementation:**

Slug registry তে locale column নেই — এটাই design:

```typescript
export async function resolveSlug(destination: string, slug: string) {
  // locale parameter নেই — intentional
  return db.slugRegistry.findFirst({
    where: {
      destination: destination.toLowerCase(),
      slug: slug.toLowerCase(),
    }
  });
}
```

Page component এ locale আলাদাভাবে content fetch এ pass করা হয়:

```typescript
// entity resolve হয় slug দিয়ে (locale-independent)
const entity = await resolveSlug(params.destination, params.slug);

// কিন্তু content fetch হয় locale দিয়ে
const tour = await getTourContent(entity.id, params.locale);
```

---

### 6.3 Translations Table

**কী:** সব dynamic content (tour name, description, highlights) এখানে store হবে।

**Implementation:**

```sql
CREATE TABLE translations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   VARCHAR(50) NOT NULL,    -- 'tour' | 'destination' | 'category' | 'hub'
  entity_id     UUID NOT NULL,
  locale        VARCHAR(5) NOT NULL,     -- 'en' | 'es' | 'nl' | 'pt' | 'fr' | 'de' | 'zh'
  field         VARCHAR(100) NOT NULL,   -- 'overview' | 'h1_override' | 'breadcrumb_label'
  value         TEXT NOT NULL,
  is_human_translated BOOLEAN DEFAULT false,
  translated_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),

  UNIQUE (entity_type, entity_id, locale, field)
);

CREATE INDEX idx_translations_lookup
  ON translations (entity_type, entity_id, locale);
```

Bulk fetch — single query দিয়ে সব fields:

```typescript
async function getTourTranslations(tourId: string, locale: Locale) {
  const rows = await db.translations.findMany({
    where: {
      entity_type: 'tour',
      entity_id: tourId,
      locale: { in: [locale, 'en'] }  // requested + fallback একসাথে
    }
  });

  // Locale priority: requested > English
  const byField: Record<string, string> = {};
  const isTranslated: Record<string, boolean> = {};

  for (const row of rows) {
    if (row.locale === 'en' && !byField[row.field]) {
      byField[row.field] = row.value;
      isTranslated[row.field] = false;
    }
    if (row.locale === locale) {
      byField[row.field] = row.value;
      isTranslated[row.field] = locale !== 'en';
    }
  }

  return { fields: byField, isTranslated };
}
```

---

### 6.4 Static UI Strings — next-intl

**কী:** Buttons, labels, error messages — hardcoded English string নয়, সব i18n key থেকে।

**Implementation:**

```json
// i18n/messages/en.json
{
  "booking": {
    "cta": {
      "check_availability": "Check availability",
      "continue": "Continue",
      "secure_spot": "Secure your spot"
    },
    "trust": {
      "free_cancel": "Free cancellation up to {hours}h",
      "reserve_deposit": "Reserve from {percent}%, pay the rest later",
      "confirmed": "Confirmed in seconds",
      "chat": "Chat 24/7 · WhatsApp 08:00–22:00"
    },
    "party": {
      "traveler_singular": "traveler",
      "traveler_plural": "travelers",
      "min_party_message": "This tour needs at least {min} travelers."
    },
    "errors": {
      "sold_out": "This time just sold out — try another?",
      "cutoff_passed": "Today's bookings just closed. Pick another date.",
      "api_failure": "We're having trouble loading dates. Refresh, or message us on WhatsApp."
    }
  },
  "gallery": {
    "see_all": "See all {count} photos",
    "counter": "{current} / {total}"
  }
}
```

```json
// i18n/messages/nl.json
{
  "booking": {
    "cta": {
      "check_availability": "Beschikbaarheid controleren",
      "continue": "Doorgaan",
      "secure_spot": "Reserveer je plek"
    }
  }
}
```

Component এ use:

```typescript
'use client';
import { useTranslations } from 'next-intl';

function BookingCTA({ state, partySize }) {
  const t = useTranslations('booking.cta');

  // ❌ NEVER:
  // return <button>Check availability</button>

  // ✅ ALWAYS:
  const label = state === 'S1' ? t('check_availability')
              : state === 'S4' ? t('continue')
              : t('secure_spot');

  return <button>{label}</button>;
}
```

---

### 6.5 Currency per Locale

**কী:** EN/NL/DE/FR/ES/PT → EUR; ZH → USD। User selector নেই।

**Implementation:**

```typescript
// lib/currency.ts
type CurrencyLocale = 'en' | 'es' | 'nl' | 'pt' | 'fr' | 'de' | 'zh';

const LOCALE_CURRENCY: Record<CurrencyLocale, string> = {
  en: 'EUR',
  es: 'EUR',
  nl: 'EUR',
  pt: 'EUR',
  fr: 'EUR',
  de: 'EUR',
  zh: 'USD',
};

export function getCurrency(locale: CurrencyLocale): string {
  return LOCALE_CURRENCY[locale] ?? 'EUR';
}

export function formatPrice(amount: number, locale: string): string {
  const currency = getCurrency(locale as CurrencyLocale);

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  // en: €120, nl: € 120, zh: $134
}
```

Backend এ price store করার সময়:

```sql
-- সব price EUR এ store করো (base currency)
-- Frontend render এর সময় locale অনুযায়ী convert করবে
ALTER TABLE tour_pricing
  ADD COLUMN price_eur DECIMAL(10,2) NOT NULL,
  ADD COLUMN price_usd DECIMAL(10,2);  -- ZH locale এর জন্য
```

---

### 6.6 Hreflang Tags

**কী:** প্রতিটা page এ সব 7 locale এর link + x-default।

**Implementation:**

```typescript
// app/[locale]/[destination]/[slug]/page.tsx
export async function generateMetadata({ params }) {
  const locales = ['en', 'es', 'nl', 'pt', 'fr', 'de', 'zh'];
  const basePath = `/${params.destination}/${params.slug}`;

  return {
    alternates: {
      languages: {
        ...Object.fromEntries(
          locales.map(loc => [loc, `https://islandtours.com/${loc}${basePath}`])
        ),
        'x-default': `https://islandtours.com/en${basePath}`,
      },
    },
  };
}
// Next.js automatically renders these as <link rel="alternate" hreflang="..."> in <head>
```

---

### 6.7 Sitemap per Locale

**কী:** সব 7 locale এর জন্য আলাদা sitemap।

**Implementation:**

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const locales = ['en', 'es', 'nl', 'pt', 'fr', 'de', 'zh'];
  const tours = await getAllPublishedTours();

  const entries: MetadataRoute.Sitemap = [];

  for (const tour of tours) {
    for (const locale of locales) {
      entries.push({
        url: `https://islandtours.com/${locale}/${tour.destination}/${tour.slug}`,
        lastModified: tour.updated_at,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  }

  return entries;
}
```

---

### 6.8 "Translated" Badge

**কী:** Machine-translated content এ badge দেখাবে।

**Implementation:**

```typescript
async function getTourData(tourId: string, locale: Locale) {
  const { fields, isTranslated } = await getTourTranslations(tourId, locale);

  return {
    overview: fields['overview'],
    isOverviewTranslated: isTranslated['overview'],
    // ...
  };
}

// Component:
function TourOverview({ text, isTranslated }) {
  return (
    <section>
      {isTranslated && (
        <span aria-label="Machine translated content">Translated</span>
      )}
      <p>{text}</p>
    </section>
  );
}
```

---

### 6.9 "Built by Islanders." — Never Translate

**কী:** Tagline সব locale এ English এই থাকবে।

**Implementation:**

```typescript
// i18n/messages/en.json — শুধু en.json এ এটা আছে
{
  "brand": {
    "tagline": "Built by Islanders."
  }
}

// Component এ locale দিয়ে নয়, hardcode:
function ClosingTagline() {
  // ❌ NEVER translate করো:
  // const t = useTranslations('brand');
  // return <p>{t('tagline')}</p>;

  // ✅ ALWAYS hardcoded:
  return <p lang="en">Built by Islanders.</p>;
  // lang="en" — screen reader কে জানানো হচ্ছে এটা English
}
```

---

## 7. Booking Widget — State Machine

---

### 7.1 5 States

**কী:** Widget এর 5টা state — সব transition reversible।

**Implementation:**

```typescript
type WidgetState = 'S1' | 'S2' | 'S3' | 'S4' | 'S5';

interface BookingWidgetState {
  state: WidgetState;
  selectedDate: string | null;
  selectedTime: string | null;
  partySize: number;
  selectedAddOns: Record<string, number>;
  total: number | null;
  error: EdgeCaseError | null;
}

function bookingReducer(state: BookingWidgetState, action: BookingAction): BookingWidgetState {
  switch (action.type) {
    case 'OPEN_DATE_PICKER':
      return { ...state, state: 'S2' };

    case 'SELECT_DATE':
      return {
        ...state,
        state: 'S3',
        selectedDate: action.date,
        selectedTime: null,  // date change → time reset
        total: null,
      };

    case 'SELECT_TIME':
    case 'UPDATE_PARTY':
      const isReady = state.selectedDate !== null &&
        (noTimeSlotsRequired || state.selectedTime !== null);
      return {
        ...state,
        state: isReady ? 'S4' : 'S3',
        selectedTime: action.type === 'SELECT_TIME' ? action.time : state.selectedTime,
        partySize: action.type === 'UPDATE_PARTY' ? action.size : state.partySize,
        total: isReady ? calculateTotal(/* ... */) : null,
      };

    case 'SET_EDGE_ERROR':
      return { ...state, state: 'S5', error: action.error };

    case 'RESET':
      return { ...state, state: 'S1', selectedDate: null, selectedTime: null, error: null };

    default:
      return state;
  }
}
```

---

### 7.2 Custom Date Picker — Not Native

**কী:** OS native date picker convert rate কমায়। Custom chip-based picker mandatory।

**Implementation:**

```typescript
// ❌ NEVER use:
<input type="date" />

// ✅ ALWAYS custom:
function DatePicker({ tourId, onSelect }) {
  const next14Days = getNext14Days();  // আজ থেকে পরের 14 দিন

  return (
    <div role="group" aria-label="Select date">
      {/* Compact chip row — horizontal scroll */}
      <div style={{ overflowX: 'auto', display: 'flex', gap: '8px' }}>
        {next14Days.map(date => (
          <DateChip
            key={date}
            date={date}
            state={getChipState(date)}
            priceFrom={getPriceForDate(date)}
            onSelect={onSelect}
          />
        ))}
      </div>

      {/* Expand button */}
      <button onClick={() => setShowMonthView(true)}>
        View all dates
      </button>

      {/* Month overlay — lazy loaded */}
      {showMonthView && (
        <MonthCalendarOverlay
          tourId={tourId}
          onSelect={onSelect}
          onClose={() => setShowMonthView(false)}
        />
      )}
    </div>
  );
}
```

---

### 7.3 Total Price Before Checkout — LD12

**কী:** Payment form দেখার আগেই total দেখাতে হবে। কোনো hidden fee নেই।

**Implementation:**

```typescript
// S4 state এ total calculate করে দেখাতে হবে

function PricingDisplay({ tour, partySize, ageBands, selectedAddOns, date }) {
  const breakdown = calculateBreakdown(tour, partySize, ageBands, selectedAddOns, date);

  return (
    <div>
      <div>Total: €{breakdown.total}</div>

      {/* Expandable breakdown */}
      <details>
        <summary>See price breakdown</summary>
        <div>
          {breakdown.lines.map(line => (
            <div key={line.label}>
              <span>{line.label}</span>
              <span>€{line.amount}</span>
            </div>
          ))}
          {/* Lines example:
              Adults × 2 × €120 = €240
              Hotel pickup × 2 × €15 = €30
              ─────────────────────────
              Total: €270
          */}
          <div>
            <strong>Total: €{breakdown.total}</strong>
          </div>
        </div>
      </details>
    </div>
  );
}

function calculateBreakdown(tour, partySize, ageBands, addOns, date) {
  const lines = [];
  let total = 0;

  // Base price
  if (tour.pricing_model === 'per_person') {
    if (ageBands) {
      lines.push({ label: `Adults × ${ageBands.adults}`, amount: ageBands.adults * tour.adult_price });
      if (ageBands.children > 0) {
        lines.push({ label: `Children × ${ageBands.children}`, amount: ageBands.children * tour.child_price });
      }
    } else {
      lines.push({ label: `${partySize} traveler${partySize > 1 ? 's' : ''}`, amount: partySize * tour.base_price });
    }
  } else {
    lines.push({ label: `${tour.unit_type} (up to ${tour.max_party_size} people)`, amount: tour.base_price });
  }

  // Add-ons
  for (const [addOnId, qty] of Object.entries(addOns)) {
    if (qty > 0) {
      const addOn = tour.add_ons.find(a => a.id === addOnId);
      lines.push({ label: `${addOn.name} × ${qty}`, amount: addOn.price * qty });
    }
  }

  total = lines.reduce((sum, l) => sum + l.amount, 0);

  return { lines, total };
}
```

---

### 7.4–7.5 CTA Copy এবং Trust Strip — LD2, LD5

**কী:** CTA copy state অনুযায়ী বদলাবে। Trust strip সবসময় 4 lines fixed।

**Implementation:**

```typescript
function getCTALabel(state: WidgetState, t: TranslationFunction): string {
  // LD2 — exact copy, exact order
  if (state === 'S1' || state === 'S2') return t('booking.cta.check_availability');
  if (state === 'S3' || state === 'S4') return t('booking.cta.continue');
  return t('booking.cta.check_availability');
}

// Trust strip — LD5
// 4 lines, fixed order, সবসময় visible (date picker overlay ছাড়া)
function TrustStrip({ tour }) {
  return (
    <ul aria-label="Booking guarantees">
      <li>✓ Free cancellation up to {tour.cancellation_hours}h</li>
      <li>✓ Reserve from 20%, pay the rest later</li>
      <li>✓ Confirmed in seconds</li>
      <li>✓ Chat 24/7 · WhatsApp 08:00–22:00</li>
    </ul>
  );
}
```

---

### 7.6 Sold-Out Race Condition

**কী:** User "Continue" click করার মুহূর্তে spot টা বিক্রি হয়ে যেতে পারে।

**Implementation:**

```typescript
async function handleContinue() {
  setLoading(true);

  // Final availability check — "Continue" tap এ
  const available = await checkAvailability({
    tourId,
    date: selectedDate,
    time: selectedTime,
    partySize,
  });

  setLoading(false);

  if (!available) {
    // Date রেখে দাও, time slots refresh করো
    setSelectedTime(null);
    setWidgetState('S3');

    const freshSlots = await fetchTimeSlots(tourId, selectedDate);
    setTimeSlots(freshSlots);

    showInlineError("This time just sold out — try another?");
    return;
  }

  // Available — checkout এ যাও
  router.push(`/checkout?tourId=${tourId}&date=${selectedDate}&travelers=${partySize}`);
}
```

---

### 7.7 Cutoff Passes During Session

**কী:** User widget এ বসে থাকলে real-time এ today chip "Closed" হয়ে যাবে।

**Implementation:** উপরে 4.3 এ আছে (interval check প্রতি মিনিটে)।

---

### 7.8 Multi-Variant Tour

**কী:** Shared vs private — ভিন্ন inventory, variant change এ date+time reset।

**Implementation:**

```typescript
function VariantSelector({ variants, selectedVariant, onSelect }) {
  return (
    <div role="group" aria-label="Tour type">
      {variants.map(v => (
        <button
          key={v.id}
          aria-pressed={v.id === selectedVariant.id}
          onClick={() => onSelect(v)}
        >
          {v.name}
        </button>
      ))}
    </div>
  );
}

// Variant change হলে date+time reset
function handleVariantChange(variant: Variant) {
  setSelectedVariant(variant);
  setSelectedDate(null);      // reset — different inventory
  setSelectedTime(null);      // reset
  setWidgetState('S1');
  setTimeSlots([]);
}
```

---

## 8. Availability API

---

### 8.1 Cached vs Live Fetch

**কী:** Compact chips = cached (fast), month overlay = live API call।

**Implementation:**

```typescript
// API endpoints:
// GET /api/availability/compact?tourId=&date=  ← cached, next 14 days
// GET /api/availability/month?tourId=&month=   ← live, per month

// Compact — cached in Redis, 5 min TTL
// app/api/availability/compact/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tourId = searchParams.get('tourId');

  const cacheKey = `availability:compact:${tourId}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return Response.json(JSON.parse(cached), {
      headers: { 'Cache-Control': 'public, max-age=300' }
    });
  }

  const data = await fetchFromOperatorSystem(tourId, 'next_14_days');
  await redis.setex(cacheKey, 300, JSON.stringify(data));  // 5 min

  return Response.json(data);
}

// Month overlay — live, no cache
// app/api/availability/month/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tourId = searchParams.get('tourId');
  const month = searchParams.get('month');  // '2026-05'

  // Live call — no cache
  const data = await fetchFromOperatorSystem(tourId, month);
  return Response.json(data, {
    headers: { 'Cache-Control': 'no-store' }  // cache করবে না
  });
}
```

---

### 8.2 Time Slots — Fetch on Date Select

**কী:** Date select হলেই time slots fetch করবে।

**Implementation:**

```typescript
async function handleDateSelect(date: string) {
  dispatch({ type: 'SELECT_DATE', date });

  // Single-departure tour এ time slot picker দেখাবে না
  if (tour.departures_per_day <= 1) return;

  setTimeSlotsLoading(true);
  try {
    const slots = await fetchTimeSlots(tourId, date);
    setTimeSlots(slots);
  } catch {
    setTimeSlotsError(true);
  } finally {
    setTimeSlotsLoading(false);
  }
}
```

---

### 8.3 Loading UX — 200ms Skeleton

**কী:** 200ms এর মধ্যে skeleton দেখাবে, 1s এর বেশি হলে error।

**Implementation:**

```typescript
function useFetchWithTimeout<T>(
  fetchFn: () => Promise<T>,
  timeoutMs = 1000
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function execute() {
    setLoading(true);
    setError(false);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeoutMs)
    );

    try {
      const result = await Promise.race([fetchFn(), timeoutPromise]);
      setData(result);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return { data, loading, error, execute };
}

// Usage:
const { data, loading, error, execute } = useFetchWithTimeout(
  () => fetchAvailability(tourId, month),
  1000
);

if (loading) return <DatePickerSkeleton />;     // 200ms delay দিয়ে show
if (error)   return <DatePickerError onRetry={execute} />;
return <DatePickerContent data={data} />;
```

---

### 8.4–8.5 API Failure এবং Offline

**কী:** API fail বা network নেই — graceful degradation।

**Implementation:**

```typescript
// Network status detect:
function useNetworkStatus() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline  = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}

// Widget এ:
const isOnline = useNetworkStatus();

if (!isOnline) {
  return (
    <div>
      <p>You're offline. Showing last available dates.</p>
      <CompactChipRow data={cachedData} stale />  {/* "may be out of date" tag */}
      <button disabled>Continue</button>           {/* disabled */}
    </div>
  );
}
```

---

## 9. Schema.org & SEO

---

### 9.1 JSON-LD via @graph

**কী:** Multiple schema types একটা @graph এ combine করতে হবে।

**Implementation:**

```typescript
// lib/structured-data.ts
function generateTourStructuredData(tour: Tour, locale: string) {
  const baseUrl = `https://islandtours.com/${locale}/${tour.destination_slug}/${tour.slug}`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      // 1. Product (primary)
      {
        '@type': 'Product',
        '@id': `${baseUrl}#product`,
        name: tour.h1,
        description: tour.overview,
        image: tour.gallery_images.map(img => img.url),
        offers: {
          '@type': 'Offer',
          price: tour.price_from,
          priceCurrency: getCurrency(locale),
          availability: 'https://schema.org/InStock',
          url: baseUrl,
        },
      },

      // 2. TouristTrip
      {
        '@type': 'TouristTrip',
        '@id': `${baseUrl}#trip`,
        name: tour.h1,
        description: tour.overview,
        touristType: tour.category_name,
        itinerary: tour.itinerary_stops?.map(stop => ({
          '@type': 'TouristAttraction',
          name: stop.name,
        })),
      },

      // 3. BreadcrumbList
      {
        '@type': 'BreadcrumbList',
        itemListElement: tour.breadcrumbs.map((crumb, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: crumb.label,
          item: crumb.url ? `https://islandtours.com${crumb.url}` : undefined,
        })),
      },

      // 4. AggregateRating (if applicable)
      ...(tour.rating_display.show ? [{
        '@type': 'AggregateRating',
        '@id': `${baseUrl}#rating`,
        ratingValue: tour.rating_display.rating,
        reviewCount: tour.rating_display.reviewCount,
        bestRating: 5,
        worstRating: 1,
      }] : []),

      // 5. FAQPage (if tour has FAQs)
      ...(tour.faqs?.length > 0 ? [{
        '@type': 'FAQPage',
        mainEntity: tour.faqs.map(faq => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      }] : []),
    ],
  };
}
```

Page এ inject:

```typescript
// Server Component এ — SSR
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify(generateTourStructuredData(tour, locale))
  }}
/>
```

---

### 9.2 BreadcrumbList — Two Path Formats

**কী:** Hub-anchored এবং destination-only দুটো format।

**Implementation:**

```typescript
function buildBreadcrumbs(tour: Tour, locale: string): BreadcrumbItem[] {
  const base = `/${locale}`;

  if (tour.hub_slug) {
    // Hub-anchored: Home > Destination > Hub > Tour
    return [
      { label: 'Home', url: `${base}/` },
      { label: tour.destination_name, url: `${base}/${tour.destination_slug}/` },
      { label: tour.hub_name, url: `${base}/${tour.destination_slug}/${tour.hub_slug}/` },
      { label: getTourBreadcrumbLabel(tour), url: null },  // last item, no link
    ];
  }

  // Destination-only: Home > Destination > Tour
  return [
    { label: 'Home', url: `${base}/` },
    { label: tour.destination_name, url: `${base}/${tour.destination_slug}/` },
    { label: getTourBreadcrumbLabel(tour), url: null },
  ];
}

function getTourBreadcrumbLabel(tour: Tour): string {
  const h1Length = tour.h1.length;
  // H1 > 35 chars হলে short-form ব্যবহার করো
  return h1Length > 35 ? tour.breadcrumb_label : tour.h1;
}
```

---

## 10. Image Gallery

---

### 10.1 Minimum 5 Images — Publish Block

**কী:** 5 এর কম image হলে tour publish করা যাবে না।

**Implementation:**

```typescript
// Backend — tour publish endpoint
async function publishTour(tourId: string, adminId: string) {
  const imageCount = await db.tourImages.count({
    where: { tour_id: tourId }
  });

  if (imageCount < 5) {
    throw new PublishValidationError(
      `Cannot publish: tour has only ${imageCount} image(s). Minimum is 5.`
    );
  }

  // Hero image আছে কিনা
  const heroExists = await db.tourImages.findFirst({
    where: { tour_id: tourId, is_hero: true }
  });

  if (!heroExists) {
    throw new PublishValidationError('Cannot publish: no hero image set.');
  }

  // Publish করো
  await db.tours.update({
    where: { id: tourId },
    data: { status: 'published', published_at: new Date() }
  });
}
```

---

### 10.2 Lightbox Implementation

**কী:** Full-screen image viewer, focus trapped, keyboard navigable।

**Implementation:**

```typescript
function Lightbox({ images, initialIndex, onClose }) {
  const [current, setCurrent] = useState(initialIndex);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    // Focus trap library বা manual implementation
    const focusable = el.querySelectorAll(
      'button, [href], input, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;

    first?.focus();

    function handleTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }

    el.addEventListener('keydown', handleTab);
    return () => el.removeEventListener('keydown', handleTab);
  }, []);

  // ESC close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setCurrent(c => Math.min(c + 1, images.length - 1));
      if (e.key === 'ArrowLeft')  setCurrent(c => Math.max(c - 1, 0));
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [images.length, onClose]);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Photo gallery"
    >
      <span>{current + 1} / {images.length}</span>
      <Image src={images[current].url} alt={images[current].alt_text} fill />
      <button onClick={() => setCurrent(c => c - 1)} disabled={current === 0}>←</button>
      <button onClick={() => setCurrent(c => c + 1)} disabled={current === images.length - 1}>→</button>
      <button onClick={onClose} aria-label="Close gallery">✕</button>
    </div>
  );
}
```

---

## 11. Save / Share

---

### 11.1 Save — Session vs Authenticated

**Implementation:**

```typescript
async function saveTour(tourId: string, userId: string | null) {
  if (userId) {
    // Authenticated — database এ save
    await db.userWishlists.upsert({
      where: { user_id_tour_id: { user_id: userId, tour_id: tourId } },
      create: { user_id: userId, tour_id: tourId },
      update: {},
    });
  } else {
    // Unauthenticated — session storage (client-side only)
    const saved = JSON.parse(sessionStorage.getItem('saved_tours') ?? '[]');
    if (!saved.includes(tourId)) {
      sessionStorage.setItem('saved_tours', JSON.stringify([...saved, tourId]));
    }
  }
}
```

---

### 11.2 Share — Platform Order

**কী:** WhatsApp → copy link → email → Facebook → X। এই exact order।

**Implementation:**

```typescript
const SHARE_OPTIONS = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    getUrl: (url: string, title: string) =>
      `https://wa.me/?text=${encodeURIComponent(`Check this out - ${title} on Island Tours: ${url}`)}`,
  },
  {
    id: 'copy',
    label: 'Copy link',
    action: async (url: string) => {
      await navigator.clipboard.writeText(url);
      showToast('Link copied!');
    },
  },
  {
    id: 'email',
    label: 'Email',
    getUrl: (url: string, title: string) =>
      `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`Check this out - ${title} on Island Tours: ${url}`)}`,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    getUrl: (url: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: 'x',
    label: 'X',
    getUrl: (url: string, title: string) =>
      `https://x.com/intent/tweet?text=${encodeURIComponent(`Check this out - ${title} on Island Tours: ${url}`)}`,
  },
];

function handleShare(tourUrl: string, tourTitle: string) {
  // Mobile — native share sheet
  if (navigator.share) {
    navigator.share({
      title: tourTitle,
      text: `Check this out - ${tourTitle} on Island Tours`,
      url: tourUrl,
    });
    return;
  }

  // Desktop — custom modal, options in SHARE_OPTIONS order
  setShowShareModal(true);
}
```

---

## 12. Accessibility Baseline

---

### 12.1–12.6 All Accessibility Rules

**Implementation:**

```typescript
// Rating row — full keyboard + screen reader support
<a
  href="#reviews"
  tabIndex={0}
  onClick={handleScrollToReviews}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleScrollToReviews();
    }
  }}
  aria-label={`Rating: ${rating} stars out of 5, ${reviewCount} reviews. Activate to read reviews.`}
>
  ★ {rating} · {reviewCount} reviews
</a>

// Booking widget state transition announcement
const [announcement, setAnnouncement] = useState('');

function announceToScreenReader(message: string) {
  setAnnouncement('');
  setTimeout(() => setAnnouncement(message), 100);
}

// S1 → S2 transition:
announceToScreenReader('Date picker opened. Select a date for your tour.');

// Announcement element:
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"  // visually hidden
>
  {announcement}
</div>
```

Touch target enforcement:

```css
/* Global — সব interactive elements এ */
button,
a,
[role="button"],
input[type="checkbox"],
input[type="radio"] {
  min-width: 44px;
  min-height: 44px;
}

/* Visually hidden but focusable */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

---

## 13. Business Rules — Locked Decisions

---

### 13.1 LD4 — Email = Ticket, No QR

**Implementation:**

```typescript
// Booking confirmation এ যা পাঠাতে হবে:
async function sendBookingConfirmation(booking: Booking) {
  await emailService.send({
    to: booking.user_email,
    subject: `Your booking confirmed — ${booking.tour_name}`,
    template: 'booking-confirmation',
    data: {
      bookingId: booking.id,
      tourName: booking.tour_name,
      date: booking.tour_date,
      time: booking.tour_time,
      partySize: booking.party_size,
      meetingPoint: booking.meeting_point,
      // ❌ NO QR code
      // ❌ NO app download link
      // ❌ NO "mobile ticket" language
      // ✅ "This email is your entry pass. Show it on the day."
    },
  });
}
```

---

### 13.2 LD3 — "Pickup" No Hyphen

**কী:** Database থেকে UI পর্যন্ত সব জায়গায়।

**Implementation:**

```typescript
// ❌ WRONG:
'Pick-up available'
'pick-up'
'Pick-Up'

// ✅ CORRECT:
'Pickup available'
'pickup'
'Pickup'

// i18n messages:
{
  "badges": {
    "pickup_included":  "Pickup included",
    "pickup_available": "Pickup available",
    "meeting_only":     "Meeting point only"
  }
}
```

---

### 13.3 LD7 — Exactly 3 Quick-Info Badges

**কী:** Duration, Pickup, Languages — এই তিনটা, এই order এ।

**Implementation:**

```typescript
// ✅ Fixed order, fixed 3:
function QuickInfoBadges({ tour }) {
  return (
    <div role="list" aria-label="Tour quick info">
      {/* Badge 1: Duration */}
      <div role="listitem">
        ⏱ {formatDuration(tour.duration_minutes)}
      </div>

      {/* Badge 2: Pickup */}
      <div role="listitem">
        🚐 {getPickupBadgeText(tour.pickup_model)}
      </div>

      {/* Badge 3: Languages */}
      <div role="listitem">
        💬 {formatLanguages(tour.languages)}
      </div>

      {/* ❌ NEVER add a 4th badge */}
    </div>
  );
}

function formatDuration(minutes: number): string {
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes / 60 > 1 ? 's' : ''}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function formatLanguages(codes: string[]): string {
  if (codes.length === 0) return '';
  if (codes.length <= 2) return codes.join(', ');
  return `${codes[0]}, ${codes[1]}, +${codes.length - 2}`;
}
```

---

## 14. All Tours Page

---

### 14.1 `/{locale}/{destination}/tours/`

**Implementation:**

```typescript
// app/[locale]/[destination]/tours/page.tsx
export const revalidate = 60;  // 60s ISR

export default async function AllToursPage({ params, searchParams }) {
  const { locale, destination } = params;
  const { category, date, sort = 'locals_favorites' } = searchParams;

  const tours = await getToursForDestination({
    destination,
    locale,
    filters: { category, date },
    sort,
  });

  return (
    <>
      <Breadcrumbs items={[
        { label: 'Home', url: `/${locale}/` },
        { label: destinationName, url: `/${locale}/${destination}/` },
        { label: 'All Tours', url: null },
      ]} />

      <h1>All tours in {destinationName}</h1>
      <TourGrid tours={tours} />

      {/* Structured data */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: `All tours in ${destinationName}`,
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: tours.map((tour, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              url: `https://islandtours.com/${locale}/${destination}/${tour.slug}`,
            })),
          },
        })
      }} />
    </>
  );
}
```

---

## 15. Edge Cases

---

### 15.1 সব Edge Cases এর Handling

**Implementation:**

```typescript
// Centralized edge case handler
function getWidgetEdgeState(
  date: string,
  availability: AvailabilityData
): EdgeCaseState | null {

  if (availability.status === 'sold_out') {
    const nextAvailable = availability.next_available_date;
    return {
      type: 'sold_out',
      message: 'Sold out — try another date.',
      action: nextAvailable ? {
        label: `Next available: ${formatDate(nextAvailable)}`,
        onTap: () => selectDate(nextAvailable),
      } : {
        label: 'Email me when there\'s room',
        onTap: () => openEmailCapture(),
      },
    };
  }

  if (availability.status === 'all_dates_sold_out') {
    return {
      type: 'all_sold_out',
      message: 'No spots open in next 30 days.',
      action: {
        label: 'Email me when there\'s room',
        onTap: () => openEmailCapture(),
      },
    };
  }

  return null;
}

// Missing translation fallback:
function withFallback(translation: string | null, fallback: string): string {
  return translation ?? fallback;
}

// Gallery CDN outage:
function HeroImage({ src, alt }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div aria-label="Photo loading" role="img">
        Photos loading…
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
    />
  );
}
```

---

*Source: Island Tours Tour Detail Page Specification (Sections 4.7.1–4.7.28) + Platform Architecture Changelog (April 13, 2026)*

*Total sections: 15 | Total implementation points: 70+*
