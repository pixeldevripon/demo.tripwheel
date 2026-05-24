# Trip Module — Frontend Integration Guide

> Backend base URL: `http://localhost:5050/api/v1`  
> Auth: `better-auth.session_token` cookie (set automatically by Better Auth on login)  
> All authenticated requests require the cookie to be present.

---

## API Quick Reference

### Core Trip Endpoints

| Method | Path | Auth | Used by |
|--------|------|------|---------|
| GET | `/trips` | Public | Listing page, search |
| GET | `/trips/slug/:slug?destinationSlug=&hubSlug=&locale=` | Public | Tour detail page (SSR) |
| GET | `/trips/my-trips?status=&page=&limit=` | Operator | Operator dashboard |
| GET | `/trips/:id` | Semi-public | Dashboard preview, admin view |
| POST | `/trips` | Operator | Create trip form |
| PATCH | `/trips/:id` | Operator | Edit trip form |
| POST | `/trips/:id/publish` | Operator | Publish button |
| POST | `/trips/:id/pause` | Operator | Pause button |
| POST | `/trips/:id/unpause` | Operator | Unpause button |
| POST | `/trips/:id/archive` | Operator/Admin | Archive action |
| DELETE | `/trips/:id` | Operator | Delete DRAFT |

### Child Model Endpoints (all under `/trips/:tripId/...`)

| Resource | GET | POST | PATCH | DELETE |
|----------|-----|------|-------|--------|
| Images | `/images` | `/images` | `/images/:imageId` | `/images/:imageId` |
| Age Bands | `/age-bands` | `/age-bands` | `/age-bands/:bandId` | `/age-bands/:bandId` |
| Add-Ons | `/addons` | `/addons` | `/addons/:addonId` | `/addons/:addonId` |
| Languages | `/languages` | `/languages` | — | `/languages/:languageId` |
| Highlights | `/highlights` | `/highlights` | `/highlights/:highlightId` | `/highlights/:highlightId` |
| Highlight Translations | — | — | PUT `/highlights/:highlightId/translations/:locale` | `/highlights/:highlightId/translations/:locale` |
| Inclusions | `/inclusions` | `/inclusions` | `/inclusions/:inclusionId` | `/inclusions/:inclusionId` |
| Inclusion Translations | — | — | PUT `/inclusions/:inclusionId/translations/:locale` | `/inclusions/:inclusionId/translations/:locale` |
| Trip Translations | `/translations` | — | PUT `/translations/:locale` | `/translations/:locale` |
| Schedules | `/schedules` | `/schedules` | `/schedules/:scheduleId` | `/schedules/:scheduleId` |

---

## Part 1 — Operator Dashboard

### 1.1 Operator: My Trips List

The dashboard landing page for an operator. Shows all their trips with status badges and quick stats.

**Request:**
```
GET /trips/my-trips?page=1&limit=20
```

**Response shape (per item):**
```json
{
  "id": "uuid",
  "name": "Sunset Catamaran Cruise",
  "slug": "sunset-catamaran-cruise",
  "status": "DRAFT",              // DRAFT | LIVE | PAUSED | ARCHIVED
  "pricingModel": "PER_PERSON",
  "basePrice": "75.00",
  "publishedAt": null,
  "heroImage": {
    "id": "uuid",
    "url": "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/sunset-cruise",
    "altText": "Sunset view from the catamaran"
  },
  "imageCount": 3,
  "scheduleCount": 0,
  "highlightCount": 2,
  "inclusionCount": 1,
  "updatedAt": "2026-05-24T10:00:00Z"
}
```

`heroImage` is `null` when no hero image has been set yet. Use the `url` directly in `<img src>` — Cloudinary delivers the optimal format (`f_auto`) and compression (`q_auto`) automatically based on the browser's `Accept` header.

**Dashboard list rendering rules:**
- `status === "DRAFT"` → grey badge; show "Complete & Publish" CTA
- `status === "LIVE"` → green badge; show "Pause" action
- `status === "PAUSED"` → amber badge; show "Unpause" and "Archive" actions
- `status === "ARCHIVED"` → red badge; read-only, no actions
- `heroImage === null` → show placeholder thumbnail
- `imageCount < 5` → show image warning on the card
- `highlightCount < 3` → show content warning on the card

**Optional filter by status:**
```
GET /trips/my-trips?status=DRAFT
GET /trips/my-trips?status=LIVE
```

---

### 1.2 Creating a New Trip (Create Form)

**Step 1 — Load selectors:**
```
GET /destinations/active               → destination dropdown options
GET /categories/active                 → category dropdown options
GET /hubs?destinationId=:id&isActive=true  → hub dropdown (after destination is selected)
```

**Step 2 — Submit create form:**
```
POST /trips
Content-Type: application/json

{
  "name": "Sunset Catamaran Cruise",
  "destinationId": "uuid",
  "categoryId": "uuid",
  "hubId": null,               // null = destination-only; set UUID = hub-anchored
  "pricingModel": "PER_PERSON",
  "basePrice": "75.00",
  "durationMinutes": 180,
  "pickupModel": "NONE",
  "minPartySize": 1,
  "maxPartySize": 20,
  "bookingCutoffMinutes": 120,
  "cancellationHours": 24
}
```

**Optional — custom slug:**
```json
{
  "name": "Sunset Catamaran Cruise",
  "slug": "my-custom-slug",        // if omitted, auto-generated from name
  ...
}
```

**Slug field behaviour (same as category/destination pattern):**
- Auto-generates from `name` as user types (use the same `toSlug()` util as other create forms)
- Once manually edited, auto-generation stops (`slugTouched` flag)
- On edit page: render as read-only — slug cannot change after creation

**On success:** Navigate to the trip edit page `/dashboard/trips/:id/edit`  
**On 409:** Show "A trip with this slug already exists in this destination"

---

### 1.3 Trip Edit Page — Tab Structure

The edit page is split into tabs. Each tab manages different child resources.

```
[ Details ] [ Images ] [ Content ] [ Highlights ] [ Inclusions ] [ Pricing ] [ Schedules ] [ Languages ] [ Translations ]
```

#### Tab: Details

Calls `PATCH /trips/:id` with any changed core fields:

```json
{
  "name": "Updated Tour Name",
  "durationMinutes": 240,
  "pickupModel": "INCLUDED",
  "pricingModel": "PER_PERSON",
  "basePrice": "85.00",
  "maxPartySize": 25,
  "bookingCutoffMinutes": 180,
  "cancellationHours": 48,
  "h1Override": null,
  "breadcrumbLabel": null
}
```

**Category change warning:** If the trip is LIVE and operator changes `categoryId`, the response includes:
```json
{
  "trip": { ... },
  "warnings": ["Category changed on a LIVE trip. In Phase 5 this will be blocked if a featured slot is held."]
}
```
Show the warning as a dismissable yellow banner.

---

#### Tab: Images

**Load images:**
```
GET /trips/:tripId/images
```

**Add image** (after Cloudinary upload returns the URL):
```
POST /trips/:tripId/images
{
  "url": "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/sunset-cruise",
  "isHero": false,
  "altText": "Sunset view from the catamaran",
  "displayOrder": 0,
  "width": 1920,
  "height": 1080
}
```

> **Cloudinary URL:** Store the URL exactly as returned by the Cloudinary upload API — it already includes `f_auto,q_auto` (applied via `getOptimizedUrl()` in `cloudinary.service.ts`). A single URL is sufficient; Cloudinary serves the right format (WebP, AVIF, JPEG) automatically based on the browser's `Accept` header.
> **width / height:** Required — pass the pixel dimensions from the Cloudinary upload response (`data.width`, `data.height`). These are stored for layout/aspect ratio calculations.
> **focalX / focalY:** Optional (default `0.5 / 0.5` = centered). Provide these when the subject is off-centre so the responsive crop stays on-target in CSS using `object-position: ${focalX * 100}% ${focalY * 100}%`.

**Set hero image:**
```
PATCH /trips/:tripId/images/:imageId
{ "isHero": true }
```
This atomically clears the old hero and sets the new one. Only one hero is allowed at a time.

**Update focal point (used for responsive cropping):**
```
PATCH /trips/:tripId/images/:imageId
{ "focalX": 0.7, "focalY": 0.4 }
```

**Remove image:**
```
DELETE /trips/:tripId/images/:imageId
```

**Dashboard validation display:**
- Show image count: `{count}/24 images`  
- If count < 5: red warning "Need at least 5 images to publish"
- Mark the hero image with a star/crown icon
- If no hero: amber warning "Set a hero image before publishing"

---

#### Tab: Content (Highlights + Inclusions)

**Highlights** — 3 to 6 bullet points that appear on the tour page.

```
GET /trips/:tripId/highlights        → load list

POST /trips/:tripId/highlights       → add new (English text only)
{ "text": "Watch the sunset with cocktails in hand", "displayOrder": 0 }

PATCH /trips/:tripId/highlights/:id  → reorder
{ "displayOrder": 2 }

DELETE /trips/:tripId/highlights/:id → remove (also deletes all translations)
```

**Dashboard validation display:**
- `{count}/6 highlights` — warn if < 3 or > 6

**Inclusions** — what is included in the price.

```
POST /trips/:tripId/inclusions
{ "label": "Open bar", "icon": "drink", "displayOrder": 0 }

PATCH /trips/:tripId/inclusions/:id
{ "icon": "check" }

DELETE /trips/:tripId/inclusions/:id
```

Available icon slugs: `check`, `drink`, `food`, `transport`, `gear`, `guide`, `photo`, `ticket`  
(These map to frontend icon components — keep in sync with the icon component library.)

---

#### Tab: Pricing (Age Bands + Add-Ons)

**When `pricingModel === "PER_PERSON"` and no age bands** → `basePrice` is used flat for all guests.

**When age bands are defined** → the booking widget shows separate counters per band.

```
POST /trips/:tripId/age-bands
{
  "bandType": "ADULT",
  "label": "Adults (13+)",
  "minAge": 13,
  "price": "75.00",
  "minCount": 1,
  "maxCount": 10
}

POST /trips/:tripId/age-bands
{
  "bandType": "CHILD",
  "label": "Children (3-12)",
  "minAge": 3,
  "maxAge": 12,
  "price": "45.00",
  "minCount": 0,
  "maxCount": 5
}
```

**Add-ons** — extras shown after date + party selection. EU Fair Act: never pre-checked.

```
POST /trips/:tripId/addons
{
  "name": "Hotel pickup",
  "description": "We pick you up from your hotel in Willemstad",
  "price": "15.00",
  "unit": "PER_PERSON",
  "maxQuantity": 1
}
```

`unit` values: `PER_PERSON` | `FLAT`

---

#### Tab: Schedules

Each schedule is one departure slot with its own capacity.

**Add a departure:**
```
POST /trips/:tripId/schedules
{
  "startDate": "2026-07-15",
  "startTime": "09:00",
  "totalSpots": 20
}
```

**For multi-day tours:**
```json
{ "startDate": "2026-07-15", "endDate": "2026-07-16", "startTime": "09:00", "totalSpots": 12 }
```

**Update spots or close a departure:**
```
PATCH /trips/:tripId/schedules/:scheduleId
{
  "status": "CLOSED"       // AVAILABLE | SOLD_OUT | CLOSED | CANCELLED
}
```

**Note:** `availableSpots` is decremented by the Bookings module (Phase 4). Operators can manually adjust with `"availableSpots": N`.

---

#### Tab: Languages

ISO 639-1 two-letter codes. Shown in the booking widget as a badge strip.

```
POST /trips/:tripId/languages    → { "language": "nl" }
DELETE /trips/:tripId/languages/:languageId
```

Common codes for Caribbean: `en`, `nl`, `es`, `pt`, `de`

---

#### Tab: Translations

Each locale stores `title` (optional override), `overview` (80–200 words, required for publish), and `description` (long-form).

**English is the base locale — always edit first.**

```
PUT /trips/:tripId/translations/en
{
  "overview": "Join us for a breathtaking two-hour sunset cruise...",
  "description": "Full detailed markdown description..."
}
```

**Other locales** — same endpoint with different locale code:
```
PUT /trips/:tripId/translations/nl
{
  "title": "Zonsondergang Catamaran Cruise",
  "overview": "Stap aan boord voor een adembenemende zonsondergangscruise...",
  "isMachineTranslated": true
}
```

**Delete non-English translation:**
```
DELETE /trips/:tripId/translations/nl
```

**English cannot be deleted** — the backend returns 400. To clear it, send `null` values:
```json
{ "overview": null, "description": null }
```

**Supported locales:** `en`, `nl`, `es`, `pt`, `fr`, `de`, `zh`

---

#### Highlight / Inclusion Translations

Same pattern as trip translations, but per highlight/inclusion item.

```
PUT /trips/:tripId/highlights/:highlightId/translations/nl
{ "text": "Aanschouw de zonsondergang vanaf het water" }

DELETE /trips/:tripId/highlights/:highlightId/translations/nl

PUT /trips/:tripId/inclusions/:inclusionId/translations/nl
{ "label": "Open bar" }
```

English translation cannot be deleted from highlights or inclusions.

---

### 1.4 Publishing a Trip

**Publish button calls:**
```
POST /trips/:id/publish
```

**Four publish blocks are checked together.** If any fail, all errors are returned at once:
```json
{
  "statusCode": 400,
  "message": [
    "At least 5 images are required to publish",
    "A hero image must be set before publishing",
    "An English overview is required to publish"
  ]
}
```

**Dashboard publish-readiness checklist to show operator before they click:**

| Check | How to display |
|-------|---------------|
| `imageCount >= 5` | "5+ images ✓" or "Need X more images" |
| Hero image set | "Hero set ✓" or "No hero image" |
| English overview present | "Overview ✓" or "Add English overview" |
| `highlightCount >= 3` | "3+ highlights ✓" or "Need X more highlights" |

On success: trip `status` changes to `LIVE`, `publishedAt` is set.

---

### 1.5 Trip Lifecycle Actions

```
POST /trips/:id/pause      → LIVE → PAUSED
POST /trips/:id/unpause    → PAUSED → LIVE
POST /trips/:id/archive    → LIVE or PAUSED → ARCHIVED (terminal)
DELETE /trips/:id          → only DRAFT trips
```

**UI gate rules:**
- Only show "Pause" when `status === "LIVE"`
- Only show "Unpause" when `status === "PAUSED"`
- Only show "Archive" when `status === "LIVE"` or `status === "PAUSED"`
- Never show "Archive" for DRAFT — show "Delete" instead
- ARCHIVED trips: read-only, no action buttons
- "Delete" is in the Danger Zone section, only visible when `status === "DRAFT"`

---

## Part 2 — Public-Facing Frontend

### 2.1 Trip Listing Page

**URL pattern:** `/{locale}/destinations/{destinationSlug}/tours`  
or with filters: `/{locale}/destinations/{destinationSlug}/tours?categoryId=&page=`

**API call:**
```
GET /trips?destinationId=uuid&categoryId=uuid&page=1&limit=20&locale=en
```

**Response:**
```json
{
  "total": 42,
  "page": 1,
  "limit": 20,
  "data": [
    {
      "id": "uuid",
      "name": "Sunset Catamaran Cruise",
      "slug": "sunset-catamaran-cruise",
      "status": "LIVE",
      "hubId": null,
      "basePrice": "75.00",
      "priceFrom": "45.00",
      "durationMinutes": 180,
      "aggregateRating": 4.8,
      "aggregateReviewCount": 47,
      "heroImage": {
        "id": "uuid",
        "url": "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/sunset-cruise",
        "altText": "Sunset view from the catamaran"
      }
    }
  ]
}
```

The listing returns only the hero image as `heroImage: { id, url, altText } | null`.  
Use `url` directly in `<img src>` — no format negotiation needed, Cloudinary handles it.

**Build the trip card URL:**
```typescript
// destinationSlug comes from the page's route param
// hubId determines URL pattern
const tripUrl = trip.hubId
  ? `/${locale}/${destinationSlug}/${hubSlug}/${trip.slug}`   // hub-anchored
  : `/${locale}/${destinationSlug}/${trip.slug}`;              // destination-only
```

> **Note:** For hub-anchored trips in the listing, you need the hub slug. The listing API returns `hubId` but not the hub slug. Either enrich the response in a later iteration, or pass `hubId` and resolve hub slug separately, or store hub slug alongside hubId in the listing response (future enhancement).

**Available filters:**
```
?destinationId=uuid     → filter by destination
?categoryId=uuid        → filter by category
?hubId=uuid             → filter by hub
?pricingModel=PER_PERSON
?minPrice=50&maxPrice=200
?locale=nl              → returns trip data (no translation in listing, for future use)
?page=2&limit=20
```

---

### 2.2 URL Routing and Slug Resolution

The platform has two URL patterns for tour detail pages:

```
Destination-only:  /{locale}/{destinationSlug}/{tourSlug}
Hub-anchored:      /{locale}/{destinationSlug}/{hubSlug}/{tourSlug}
```

**How the frontend tells them apart:**

The slug at position `[slug]` in a 3-segment URL could be a **category**, a **hub**, or a **destination-only tour**. Use the slug registry to resolve it:

```
GET /slug-registry/resolve?destinationSlug=curacao&slug=boat-tours
→ { "entityType": "CATEGORY", "entityId": "uuid" }

GET /slug-registry/resolve?destinationSlug=curacao&slug=mambo-beach
→ { "entityType": "HUB", "entityId": "uuid" }

GET /slug-registry/resolve?destinationSlug=curacao&slug=sunset-catamaran-cruise
→ { "entityType": "TOUR", "entityId": "uuid" }
```

Then render the appropriate page component based on `entityType`.

**For a 4-segment URL** (`/{locale}/{dest}/{hub-slug}/{tour-slug}`):  
You already know it's a hub-anchored tour — call the trip slug endpoint directly (no registry needed).

---

### 2.3 Trip Detail Page (SSR)

**This is the single most important public endpoint.**

```
GET /trips/slug/sunset-catamaran-cruise?destinationSlug=curacao&locale=nl
```

For hub-anchored tours:
```
GET /trips/slug/snorkel-adventure?destinationSlug=curacao&hubSlug=mambo-beach&locale=nl
```

**Full response includes everything needed for the page in one call:**

```json
{
  "id": "uuid",
  "name": "Sunset Catamaran Cruise",
  "slug": "sunset-catamaran-cruise",
  "status": "LIVE",
  "destinationId": "uuid",
  "categoryId": "uuid",
  "hubId": null,
  "pricingModel": "PER_PERSON",
  "basePrice": "75.00",
  "durationMinutes": 180,
  "pickupModel": "INCLUDED",
  "aggregateRating": 4.8,
  "aggregateReviewCount": 47,

  "translation": {
    "locale": "nl",
    "title": "Zonsondergang Catamaran Cruise",
    "overview": "Stap aan boord voor een adembenemende...",
    "description": "Volledige beschrijving...",
    "isMachineTranslated": true
  },

  "images": [
    {
      "id": "uuid",
      "url": "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/sunset-cruise-hero",
      "isHero": true,
      "altText": "Sunset view from the catamaran",
      "focalX": 0.5,
      "focalY": 0.3,
      "width": 1920,
      "height": 1080,
      "displayOrder": 0
    },
    {
      "id": "uuid",
      "url": "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/sunset-cruise-gallery",
      "isHero": false,
      "altText": null,
      "focalX": 0.5,
      "focalY": 0.5,
      "width": 1600,
      "height": 900,
      "displayOrder": 1
    }
  ],

  "highlights": [
    { "id": "uuid", "displayOrder": 0, "text": "Aanschouw de zonsondergang vanaf het water" },
    { "id": "uuid", "displayOrder": 1, "text": "Inclusief welkomstdrankje en open bar" }
  ],

  "inclusions": [
    { "id": "uuid", "icon": "drink", "displayOrder": 0, "label": "Open bar" },
    { "id": "uuid", "icon": "transport", "displayOrder": 1, "label": "Hotelophaal" }
  ],

  "ageBands": [
    { "bandType": "ADULT", "label": "Volwassenen (13+)", "price": "75.00", "minCount": 1, "maxCount": 10 },
    { "bandType": "CHILD", "label": "Kinderen (3-12)", "price": "45.00", "minCount": 0, "maxCount": 5 }
  ],

  "addOns": [
    { "id": "uuid", "name": "Hotelophaal", "price": "15.00", "unit": "PER_PERSON", "maxQuantity": 1 }
  ],

  "languages": ["en", "nl"],

  "schedules": [
    { "id": "uuid", "startDate": "2026-07-15", "startTime": "09:00", "availableSpots": 18, "status": "AVAILABLE" },
    { "id": "uuid", "startDate": "2026-07-18", "startTime": "09:00", "availableSpots": 20, "status": "AVAILABLE" }
  ]
}
```

**Locale fallback behaviour:** If the requested locale has no translation, the response returns the English translation automatically. `translation.locale` tells you which locale was actually served. Show "Available in English only" label if `translation.locale !== requestedLocale`.

---

### 2.4 Building the Booking Widget

The booking widget lives on the trip detail page and uses data from the slug endpoint response.

**Step 1 — Date picker:** Populated from `schedules`. Each item has `startDate`, `startTime`, `availableSpots`. Only show schedules with `status === "AVAILABLE"` and `availableSpots > 0`.

**Step 2 — Party selector:**

```typescript
// If ageBands array is empty → use basePrice as flat price
// If ageBands is present → show one +/- counter per band
const hasAgeBands = trip.ageBands.length > 0;

// Counter limits per band
band.minCount  // minimum selections (0 = optional, 1 = required)
band.maxCount  // maximum selections (null = unlimited)
```

**Step 3 — Add-ons** (shown after date + party, never pre-checked per EU Fair Act):
```typescript
// unit === "PER_PERSON" → price × total party size
// unit === "FLAT"       → flat price regardless of party size
const addonTotal = addon.unit === 'PER_PERSON'
  ? addon.price * totalPartySize
  : addon.price;
```

**Step 4 — Price summary:**
```typescript
// With age bands
const subtotal = ageBands.reduce((sum, band) => sum + band.price * band.selectedCount, 0);

// Without age bands
const subtotal = trip.basePrice * totalPartySize;

// Add-ons
const addonSubtotal = selectedAddOns.reduce((sum, a) => sum + addonTotal(a), 0);

const total = subtotal + addonSubtotal;
```

---

### 2.5 SEO and Meta Tags

Use the `translation` fields from the slug endpoint for all SEO meta:

```typescript
// Page <title>
const pageTitle = trip.translation?.title ?? trip.name;

// <meta name="description">
const metaDescription = trip.translation?.overview
  ? trip.translation.overview.slice(0, 160)
  : `Book ${trip.name} in ${destinationSlug}`;

// Open Graph image
const ogImage = trip.images.find(img => img.isHero)?.url ?? trip.images[0]?.url;
```

---

### 2.6 H1 and Breadcrumb Overrides

The trip has two optional SEO overrides:

```typescript
// H1 tag
const h1 = trip.h1Override ?? trip.translation?.title ?? trip.name;

// Breadcrumb label
const breadcrumb = trip.breadcrumbLabel ?? trip.name;
```

`h1Override` is used when the auto-generated H1 reads awkwardly (e.g., "Sunset Catamaran Cruise Curaçao" is fine; "Snorkeling Tour at Mambo Beach Curaçao" might need `h1Override = "Mambo Beach Snorkel Tour"`).

---

### 2.7 Multilingual URL Strategy

The `trip.slug` is always English — it never changes per locale. Only the content (title, overview, description) is translated. The URL stays the same across all locales:

```
/en/curacao/sunset-catamaran-cruise   → English content
/nl/curacao/sunset-catamaran-cruise   → Dutch content (same slug, different locale prefix)
/es/curacao/sunset-catamaran-cruise   → Spanish content
```

Pass `?locale=nl` to the slug endpoint to get Dutch content. If Dutch translation doesn't exist, English is returned automatically.

---

## Part 3 — Error Handling Reference

| Status | When | Frontend action |
|--------|------|----------------|
| 400 | Publish blocks not met (array of messages) | Show all messages in a red error box |
| 400 | Archived trip update attempt | Redirect to read-only view |
| 403 | Operator trying to edit another operator's trip | Redirect to 403 page |
| 404 | Trip slug not found or not LIVE | Show 404 page |
| 404 | DRAFT trip accessed without auth | Show 404 (intentional, no information leak) |
| 409 | Slug conflict on create | "A trip with this name/slug already exists. Choose a different slug." |

---

## Part 4 — RBAC Gates in Dashboard

Using `useRole().can()` from `RoleContext`:

```tsx
const { can } = useRole();

// Trip list — Add Trip button
{can('CREATE_TRIP') && <Button onClick={openCreateModal}>Add Trip</Button>}

// Trip row — Edit action
{can('EDIT_TRIP') && <DropdownItem onClick={() => navigate(`/trips/${id}/edit`)}>Edit</DropdownItem>}

// Trip row — Publish/Pause/Unpause/Archive
{can('MANAGE_TRIPS') && <LifecycleActions trip={trip} />}

// Danger Zone — Delete (DRAFT only)
{can('DELETE_TRIP') && trip.status === 'DRAFT' && <DangerZone onDelete={handleDelete} />}
```

---

## Part 5 — Data Flow Summary

### Dashboard: Creating and Publishing a Trip

```
1. GET /destinations/active             → populate destination selector
2. GET /categories/active               → populate category selector
3. GET /hubs?destinationId=:id          → populate hub selector (after destination chosen)
4. POST /trips                          → create DRAFT, get back trip.id
5. Navigate to /dashboard/trips/:id/edit
6. POST /trips/:id/images (×5 minimum)  → upload images
7. PATCH /trips/:id/images/:heroId      → { isHero: true }
8. POST /trips/:id/highlights (×3 min)  → add English text bullets
9. PUT /trips/:id/translations/en       → add English overview (80-200 words)
10. POST /trips/:id/schedules (×1 min)  → add at least one departure
11. POST /trips/:id/publish             → all 4 blocks pass → status = LIVE
```

### Public Frontend: Rendering a Tour Page

```
URL: /nl/curacao/sunset-catamaran-cruise

1. Parse URL: locale=nl, destinationSlug=curacao, slug=sunset-catamaran-cruise

2. (If 3-segment URL and entityType unknown — resolve first)
   GET /slug-registry/resolve?destinationSlug=curacao&slug=sunset-catamaran-cruise
   → { entityType: "TOUR" }    → render TourDetailPage

3. GET /trips/slug/sunset-catamaran-cruise?destinationSlug=curacao&locale=nl
   → Full trip page data in one call

4. Render page:
   - H1: translation.title ?? trip.name
   - Hero image: images.find(img => img.isHero)
   - Image gallery: remaining images
   - Highlights: highlights.map(h => h.text)
   - Inclusions: inclusions.map(i => i.label + i.icon)
   - Booking widget: schedules + ageBands + addOns + basePrice
   - Meta tags: from translation.overview
```

---

## Part 6 — Phase 5 Hooks (Do Not Implement Yet)

These are intentional placeholders in the current backend:

| Feature | Location | What Phase 5 adds |
|---------|----------|-------------------|
| Release featured slot on pause | `trips.service.ts → pause()` | `SlotsService.releaseSlot(trip.id)` |
| Release featured slot on archive | `trips.service.ts → archive()` | `SlotsService.releaseSlot(trip.id)` |
| Category change guard | `trips.service.ts → update()` | Block if `trip.featuredSlot` exists |
| BullMQ pre-booking job | `trips-children.service.ts → createSchedule()` | Schedule job at `startDate - 24h` |

The frontend should NOT expose any slot-related UI in Phase 4. Slot management is a separate Phase 5 dashboard panel.
