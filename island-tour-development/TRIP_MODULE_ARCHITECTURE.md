# Trip Module — Architecture & Business Logic

> Phase 4 scope: Trip CRUD + child model management + lifecycle transitions.
> Slot system (SlotLock, FeaturedSlot interactions) is deferred to Phase 5.

---

## 1. What the Trip Module Owns

The trips module manages the full lifecycle of a tour listing: from creation as a DRAFT by an operator, through publication as a LIVE listing visible to travelers, through pausing, and finally archiving. It owns all child entities that make up a trip listing.

**Entities owned:**
- `Trip` — core listing record
- `TourImage` — gallery images (min 5 to publish, max 24)
- `TourAgeBand` — optional per-age pricing (Adult/Child/Infant)
- `TourAddOn` — optional extras (EU Fair Act: never pre-checked)
- `TourLanguage` — languages offered on the tour
- `TourHighlight` + `TourHighlightTranslation` — 3–6 bullet points, translated
- `TourInclusion` + `TourInclusionTranslation` — what is included, translated
- `TripTranslation` — per-locale title, overview, description for the trip itself
- `TourSchedule` — specific departure dates with capacity

**Entities NOT owned by this module (referenced, not managed here):**
- `Destination` — lookup only; must exist and be active
- `Category` — lookup only; must exist and be active
- `Hub` — lookup only; must exist and be active; validates category allowed
- `FeaturedSlot` / `SlotLock` — managed by Phase 5 Slots module
- `Booking`, `Review`, `Wishlist` — Phase 4+ separate modules

---

## 2. Trip Lifecycle

```
DRAFT ──publish──► LIVE ◄──unpause── PAUSED
                     │                   ▲
                     └──pause────────────┘
                     │
                     └──archive──► ARCHIVED (terminal, no going back)
```

| Status | Visible to Travelers | Operator Can Edit | Can Delete | Notes |
|--------|---------------------|-------------------|------------|-------|
| DRAFT | No | Yes, freely | Yes | Newly created; no publish blocks enforced yet |
| LIVE | Yes | Yes (content only) | No | Category change blocked while holding a slot (Phase 5) |
| PAUSED | No | Yes | No | Slot auto-released in Phase 5; not here |
| ARCHIVED | No | No | No | Permanent; soft-delete via `isActive = false` |

### Transition Rules

| Transition | Trigger | Who | Pre-conditions |
|------------|---------|-----|---------------|
| DRAFT → LIVE | `POST /trips/:id/publish` | Operator (own trip) | ≥5 images, hero image set, EN overview present, ≥3 highlights |
| LIVE → PAUSED | `POST /trips/:id/pause` | Operator (own trip) | Must be LIVE |
| PAUSED → LIVE | `POST /trips/:id/unpause` | Operator (own trip) | Must be PAUSED |
| LIVE/PAUSED → ARCHIVED | `POST /trips/:id/archive` | Operator (own) or Admin | Must not be ARCHIVED |
| Any → deleted | `DELETE /trips/:id` | Operator (own trip) | Status must be DRAFT only |

**Phase 5 addition (not now):** When pausing or archiving a trip that holds a featured slot, the service will call `SlotsService.releaseSlot()` before the status transition.

---

## 3. Hub Management — The Core Conditional Logic

A trip belongs to exactly one destination and one category. A hub is optional. The presence or absence of a hub changes routing, slug_registry behavior, and validation requirements.

### Three Valid Trip Configurations

| Config | Required Fields | Hub Rule | URL Pattern | slug_registry |
|--------|----------------|----------|-------------|--------------|
| Destination-only | `destinationId`, `categoryId` | `hubId = null` | `/{locale}/{dest}/{tour-slug}/` | 1 row written (TOUR) |
| Hub-anchored | `destinationId`, `categoryId`, `hubId` | `hubId` must belong to destination, category must be in `HubAllowedCategory` | `/{locale}/{dest}/{hub-slug}/{tour-slug}/` | NO row written |

### Hub Validation Rules (enforced in service on create)

1. **Hub existence**: Hub must exist and `isActive = true`
2. **Hub–Destination consistency**: `hub.destinationId === dto.destinationId` — the hub must belong to the same destination as the trip
3. **Category–Hub allowance**: A row in `HubAllowedCategory` must exist for `(hubId, categoryId)` — this is the admin-managed list of categories allowed in a hub. If the category is not allowed, reject with 400.
4. **No slug_registry write**: Hub-anchored tours are resolved by the two-segment URL pattern, not slug_registry. Skip the registry insert entirely.

### slug_registry Write Rule (destination-only trips only)

When `hubId` is null, write exactly **1 row** in `slug_registry` in the **same transaction** as trip creation:

```
destinationSlug: destination.slug   (must fetch Destination to get its slug)
slug:            trip.slug          (tour's slug)
entityType:      TOUR
entityId:        trip.id
isActive:        true
```

Slug uniqueness is enforced by the `@@unique([destinationSlug, slug])` constraint. A 409 ConflictException surfaces on P2002.

**When the trip is archived:** Set `slugRegistry.isActive = false` (keeps slug protected, page returns 404).

---

## 4. Publish Blocks — All Four Must Pass

The publish endpoint validates these four conditions **in this order** before setting status to LIVE:

| Block | Check | Error |
|-------|-------|-------|
| B1 — Images | `trip.images.length >= 5` | 400 "At least 5 images are required to publish" |
| B2 — Hero image | `trip.images.some(img => img.isHero === true)` | 400 "A hero image must be set before publishing" |
| B3 — English overview | English `TripTranslation` exists with `overview` non-null and non-empty | 400 "An English overview is required to publish" |
| B4 — Highlights | `trip.highlights.length >= 3` | 400 "At least 3 highlights are required to publish" |

If all pass: set `status = LIVE`, `publishedAt = now()`.

---

## 5. Ownership & Authorization

Every operator-facing mutation checks that `trip.operatorId === authenticatedUser.id` before proceeding. Admins bypass this check via `MANAGE_TRIPS` permission.

| Action | Who can perform |
|--------|----------------|
| Create trip | Any TOUR_OPERATOR |
| Read DRAFT trip | Owner operator OR admin |
| Read LIVE/PAUSED trip | Anyone (public for LIVE, operator/admin for PAUSED) |
| Update trip core fields | Owner operator OR admin |
| Publish | Owner operator only |
| Pause / Unpause | Owner operator only |
| Archive | Owner operator OR admin |
| Delete (DRAFT only) | Owner operator only |
| Force-archive (admin) | Admin only |
| Manage child models (images, schedules, etc.) | Owner operator OR admin |

**Pattern for ownership check in service:**

```typescript
private async assertOwnership(trip: { operatorId: string }, requesterId: string, requesterRole: Role) {
  if (requesterRole === Role.ADMIN) return;  // bypass
  if (trip.operatorId !== requesterId) {
    throw new ForbiddenException('You do not have permission to modify this trip');
  }
}
```

---

## 6. Slug Generation Rules

- Trip slug is **English only** — never translated
- Auto-generated from `name` using `generateSlug()` (existing `@/common/utils/slug.util`)
- Optional manual slug on create (same `slugTouched` pattern as categories)
- Unique per `(destinationId, slug)` — same tour name allowed in different destinations
- **Cannot be changed after creation** (edit endpoint does not accept slug)
- Slug is passed through `generateSlug()` even if manually provided, to normalize it

---

## 7. Category Change Guard (Live Trip)

In Phase 4 (no slots), changing `categoryId` on a LIVE trip is **allowed** with a warning returned in the response. In Phase 5, this will be blocked if the trip holds a featured slot.

Design the update service method to return metadata:

```typescript
return { trip: updatedTrip, warnings: [] };
```

When Phase 5 adds the guard:

```typescript
if (dto.categoryId && trip.status === TripStatus.LIVE && trip.featuredSlot) {
  throw new ConflictException('Cannot change category while holding a featured slot. Release the slot first.');
}
```

The Phase 5 team will add this check — structure the code to make it easy to drop in.

---

## 8. Child Model Rules

### Images (`TourImage`)

- Min 5, max 24 per trip (enforced at publish time, not at upload time)
- Exactly **one** must have `isHero = true` to publish
- Ordered by `displayOrder`; first is hero
- `focalX`, `focalY` — float 0.0–1.0 for responsive cropping
- On update: when setting a new hero, the service clears `isHero` on all other images in the same transaction

### Age Bands (`TourAgeBand`)

- Optional — when absent, `basePrice` on Trip is used for flat pricing
- When present, each band has its own `price`
- Valid `bandType` values: `ADULT`, `CHILD`, `INFANT`
- `minCount` / `maxCount` control the booking widget +/- controls

### Add-Ons (`TourAddOn`)

- Optional extras shown in the booking widget after date/party selection
- EU Digital Fairness Act: never pre-checked — frontend enforces; backend does not need to track checked state
- `unit`: `PER_PERSON` or `FLAT`

### Languages (`TourLanguage`)

- ISO 639-1 codes: `'en'`, `'nl'`, `'es'`, `'de'`, etc.
- `@@unique([tripId, language])` — no duplicates

### Highlights (`TourHighlight` + `TourHighlightTranslation`)

- 3–6 bullets per trip (enforced at publish, not at add time)
- Each highlight is a row in `tour_highlights` (just tripId + displayOrder)
- The text lives in `TourHighlightTranslation` per locale
- Upsert pattern: create the highlight row if needed, then upsert translation per locale
- Admin/operator manages English first; other locales can be added later

### Inclusions (`TourInclusion` + `TourInclusionTranslation`)

- Same pattern as highlights
- Has an `icon` field (slug string for frontend icon component, default `"check"`)

### Trip Translations (`TripTranslation`)

- Per-locale: `title`, `overview`, `description`
- English translation is the authoritative content
- `overview` must be 80–200 words (enforced at publish for English only; others not checked)
- Upsert by `(tripId, locale)`; English can be cleared but not deleted (same pattern as categories)

### Schedules (`TourSchedule`)

- Each schedule = one departure slot with its own capacity
- `availableSpots` decrements per booking (managed by Bookings module in Phase 4+)
- `startTime` stored as `"HH:MM"` string (e.g. `"09:00"`)
- `startDate` as `@db.Date` (date only, no time)
- Status: `AVAILABLE` | `SOLD_OUT` | `CLOSED` | `CANCELLED`
- **Phase 5 addition**: When a schedule is created, schedule a BullMQ job at `startDate - 24h` for pre-booking window activation

---

## 9. Filtering — Public Trip List

The `GET /trips` endpoint accepts these filters:

| Filter | Field | Behavior |
|--------|-------|----------|
| `destinationId` | `destinationId = ?` | Required or optional — decide per frontend needs |
| `categoryId` | `categoryId = ?` | Filter by category |
| `hubId` | `hubId = ?` | Filter by hub |
| `locale` | Applied to translation select | Default `en` |
| `pricingModel` | `pricingModel = ?` | `PER_PERSON` or `UNIT` |
| `minPrice` | `basePrice >= ?` | Numeric |
| `maxPrice` | `basePrice <= ?` | Numeric |
| `page`, `limit` | pagination | default 1, 20 |

Always includes `where: { status: TripStatus.LIVE, isActive: true }` for public queries.

---

## 10. Operator "My Trips" View

`GET /trips/my-trips` — authenticated operator only. Returns all own trips regardless of status. Includes counts and key metadata (status, image count, schedule count, highlight count) to support the dashboard list view.

---

## 11. Permissions Used

| Permission | Used on |
|------------|---------|
| `CREATE_TRIP` | POST /trips |
| `EDIT_TRIP` | PATCH /trips/:id, images, bands, etc. |
| `VIEW_TRIPS` | GET /trips, GET /trips/my-trips, GET /trips/:id |
| `MANAGE_TRIPS` | Admin force-archive, admin update any trip |
| `DELETE_TRIP` | DELETE /trips/:id (DRAFT only, own) |

---

## 12. Edge Cases

| ID | Scenario | Handling |
|----|----------|----------|
| EC-T1 | Operator tries to publish with <5 images | 400 with clear message listing all failing blocks |
| EC-T2 | Two operators create a trip with the same slug in the same destination | 409 ConflictException from P2002 on `@@unique([destinationId, slug])` |
| EC-T3 | Create trip with hubId that doesn't belong to destinationId | 400 "Hub does not belong to the specified destination" |
| EC-T4 | Create trip with category not in hub's allowed list | 400 "Category is not allowed in this hub" |
| EC-T5 | Archive a DRAFT trip | 400 "Cannot archive a draft — delete it instead" |
| EC-T6 | Delete a non-DRAFT trip | 400 "Only DRAFT trips can be deleted" |
| EC-T7 | Operator tries to update another operator's trip | 403 |
| EC-T8 | Set hero image when trip already has one | Service clears existing hero in same transaction, sets new one |
| EC-T9 | Add a schedule with a past date | Allow (no date validation); availability API handles it at query time |
| EC-T10 | Set both `basePrice` and `ageBands` | Service accepts both; frontend drives which to show in booking widget |

---

## 13. Database Indexes — Why They Exist

```
@@index([operatorId])    — "my trips" list
@@index([destinationId]) — filter by destination
@@index([categoryId])    — filter by category
@@index([hubId])         — filter by hub
@@index([status])        — public live trip query + admin status filter
@@unique([destinationId, slug]) — slug uniqueness per destination + P2002 guard
```

---

## 14. What Is NOT in Phase 4

| Feature | Phase | Notes |
|---------|-------|-------|
| FeaturedSlot interactions on pause/archive | 5 | `SlotsService.releaseSlot()` call added later |
| BullMQ pre-booking job (24h before schedule) | 5 | Hook exists in service; job scheduling added later |
| Cloudinary upload endpoint | 4 (separate module) | Upload module handles file upload; this module stores the returned URL |
| Trip review aggregation update | 4 (reviews module) | Reviews module triggers `aggregateRating` cache update |
| Category change guard on live trip with slot | 5 | Phase 4 allows it with a warning |
