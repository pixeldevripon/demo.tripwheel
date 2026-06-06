# Trip Module — Complete Technical Reference

> Phase 4 scope: Trip CRUD + all child model management + lifecycle transitions.
> Slot system (SlotLock, FeaturedSlot interactions) is deferred to Phase 5.
> Upload module (Cloudinary) is a parallel Phase 4 track.
>
> ⚠️ **V2 alignment (target state — see `02-architecture/PLATFORM-ARCHITECTURE-V2.md` §4 + `V2-DEVELOPMENT-ALIGNMENT-PLAN.md` §B).** This doc currently describes a tour with a **single** category and an optional **single** hub, plus a **hub-anchored two-segment URL** `/{dest}/{hub}/{tour}/`. The V2 target is:
> - Tour belongs to **1+ categories** (many-to-many via `TourCategory`, one `isPrimary` for the breadcrumb).
> - Tour belongs to **0–n hubs** (many-to-many via `TourHub`).
> - **Every** tour has one **flat** canonical URL `/{dest}/{tour-slug}/` and **always** writes a slug_registry `TOUR` row; the hub-nested URL is removed.
> - Most boolean/enum tour properties (booking_type, instant_confirmation, free_cancellation, wheelchair_accessible, …) move into the **Attributes** system, not Trip columns.
>
> Sections §3 (Data Model), §4.12 (Hub Validation), §4.13 (Slug Generation), and §6.7 (URL Routing) below reflect the **current** single-category/hub-nested design and will be revised when Workstream B lands.

---

## Table of Contents

1. [Overview & Scope](#1-overview--scope)
2. [Trip Lifecycle](#2-trip-lifecycle)
3. [Data Model](#3-data-model)
4. [Backend Implementation](#4-backend-implementation)
   - 4.1 [File Structure](#41-file-structure)
   - 4.2 [Module Registration](#42-module-registration)
   - 4.3 [Core Trip DTOs](#43-core-trip-dtos)
   - 4.4 [Child Model DTOs](#44-child-model-dtos)
   - 4.5 [Core Trips Service](#45-core-trips-service)
   - 4.6 [Child Model Service](#46-child-model-service)
   - 4.7 [Core Trips Controller](#47-core-trips-controller)
   - 4.8 [Child Model Controller](#48-child-model-controller)
   - 4.9 [Swagger Decorators](#49-swagger-decorators)
   - 4.10 [Ownership & Authorization](#410-ownership--authorization)
   - 4.11 [Publish Blocks](#411-publish-blocks)
   - 4.12 [Hub Validation Rules](#412-hub-validation-rules)
   - 4.13 [Slug Generation Rules](#413-slug-generation-rules)
   - 4.14 [Category Change Guard](#414-category-change-guard)
   - 4.15 [Child Model Rules](#415-child-model-rules)
   - 4.16 [Permissions](#416-permissions)
   - 4.17 [Database Indexes](#417-database-indexes)
   - 4.18 [Edge Cases](#418-edge-cases)
5. [API Reference](#5-api-reference)
   - 5.1 [Core Trip Endpoints](#51-core-trip-endpoints)
   - 5.2 [Child Model Endpoints](#52-child-model-endpoints)
   - 5.3 [Request & Response Shapes](#53-request--response-shapes)
   - 5.4 [Error Codes](#54-error-codes)
6. [Frontend Integration](#6-frontend-integration)
   - 6.1 [Operator Dashboard — My Trips List](#61-operator-dashboard--my-trips-list)
   - 6.2 [Creating a New Trip](#62-creating-a-new-trip)
   - 6.3 [Trip Edit Page — Tab Structure](#63-trip-edit-page--tab-structure)
   - 6.4 [Publishing a Trip](#64-publishing-a-trip)
   - 6.5 [Trip Lifecycle Actions](#65-trip-lifecycle-actions)
   - 6.6 [Public Trip Listing Page](#66-public-trip-listing-page)
   - 6.7 [URL Routing and Slug Resolution](#67-url-routing-and-slug-resolution)
   - 6.8 [Trip Detail Page (SSR)](#68-trip-detail-page-ssr)
   - 6.9 [Building the Booking Widget](#69-building-the-booking-widget)
   - 6.10 [SEO, Meta Tags, H1 and Breadcrumb Overrides](#610-seo-meta-tags-h1-and-breadcrumb-overrides)
   - 6.11 [Multilingual URL Strategy](#611-multilingual-url-strategy)
   - 6.12 [RBAC Gates in Dashboard](#612-rbac-gates-in-dashboard)
   - 6.13 [Data Flow Summary](#613-data-flow-summary)
   - 6.14 [Phase 5 Hooks (Do Not Implement Yet)](#614-phase-5-hooks-do-not-implement-yet)
7. [Implementation Checklist](#7-implementation-checklist)

---

## 1. Overview & Scope

The trips module manages the full lifecycle of a tour listing: from creation as a DRAFT by an operator, through publication as a LIVE listing visible to travelers, through pausing, and finally archiving. It owns all child entities that make up a trip listing.

### Entities Owned

- `Trip` — core listing record
- `TourImage` — gallery images (min 5 to publish, max 24)
- `TourAgeBand` — optional per-age pricing (Adult/Child/Infant)
- `TourAddOn` — optional extras (EU Fair Act: never pre-checked)
- `TourLanguage` — languages offered on the tour
- `TourHighlight` + `TourHighlightTranslation` — 3–6 bullet points, translated
- `TourInclusion` + `TourInclusionTranslation` — what is included, translated
- `TripTranslation` — per-locale title, overview, description for the trip itself
- `TourSchedule` — specific departure dates with capacity

### Entities NOT Owned (Referenced, Not Managed Here)

- `Destination` — lookup only; must exist and be active
- `Category` — lookup only; must exist and be active
- `Hub` — lookup only; must exist and be active; validates category allowed
- `FeaturedSlot` / `SlotLock` — managed by Phase 5 Slots module
- `Booking`, `Review`, `Wishlist` — Phase 4+ separate modules

### What Is NOT in Phase 4

| Feature | Phase | Notes |
|---------|-------|-------|
| FeaturedSlot interactions on pause/archive | 5 | `SlotsService.releaseSlot()` call added later |
| BullMQ pre-booking job (24h before schedule) | 5 | Hook exists in service; job scheduling added later |
| Cloudinary upload endpoint | 4 (separate module) | Upload module handles file upload; this module stores the returned URL |
| Trip review aggregation update | 4 (reviews module) | Reviews module triggers `aggregateRating` cache update |
| Category change guard on live trip with slot | 5 | Phase 4 allows it with a warning |

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

## 3. Data Model

### Three Valid Trip Configurations

A trip belongs to exactly one destination and one category. A hub is optional. The presence or absence of a hub changes routing, slug_registry behavior, and validation requirements.

| Config | Required Fields | Hub Rule | URL Pattern | slug_registry |
|--------|----------------|----------|-------------|--------------|
| Destination-only | `destinationId`, `categoryId` | `hubId = null` | `/{locale}/{dest}/{tour-slug}/` | 1 row written (TOUR) |
| Hub-anchored | `destinationId`, `categoryId`, `hubId` | `hubId` must belong to destination, category must be in `HubAllowedCategory` | `/{locale}/{dest}/{hub-slug}/{tour-slug}/` | NO row written |

### slug_registry Row (Destination-Only Trips)

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

**Hub-anchored tours never write to slug_registry.** If `hub_id` is set, skip the registry insert entirely. Hub-anchored tours are resolved by the two-segment URL pattern, not slug_registry.

### Child Entity Specifications

#### Images (`TourImage`)

- Min 5, max 24 per trip (enforced at publish time, not at upload time)
- Exactly **one** must have `isHero = true` to publish
- Ordered by `displayOrder`; first is hero
- `focalX`, `focalY` — float 0.0–1.0 for responsive cropping
- On update: when setting a new hero, the service clears `isHero` on all other images in the same transaction

#### Age Bands (`TourAgeBand`)

- Optional — when absent, `basePrice` on Trip is used for flat pricing
- When present, each band has its own `price`
- Valid `bandType` values: `ADULT`, `CHILD`, `INFANT`
- `minCount` / `maxCount` control the booking widget +/- controls

#### Add-Ons (`TourAddOn`)

- Optional extras shown in the booking widget after date/party selection
- EU Digital Fairness Act: never pre-checked — frontend enforces; backend does not need to track checked state
- `unit`: `PER_PERSON` or `FLAT`

#### Languages (`TourLanguage`)

- ISO 639-1 codes: `'en'`, `'nl'`, `'es'`, `'de'`, etc.
- `@@unique([tripId, language])` — no duplicates

#### Highlights (`TourHighlight` + `TourHighlightTranslation`)

- 3–6 bullets per trip (enforced at publish, not at add time)
- Each highlight is a row in `tour_highlights` (just tripId + displayOrder)
- The text lives in `TourHighlightTranslation` per locale
- Upsert pattern: create the highlight row if needed, then upsert translation per locale
- Admin/operator manages English first; other locales can be added later

#### Inclusions (`TourInclusion` + `TourInclusionTranslation`)

- Same pattern as highlights
- Has an `icon` field (slug string for frontend icon component, default `"check"`)

#### Trip Translations (`TripTranslation`)

- Per-locale: `title`, `overview`, `description`
- English translation is the authoritative content
- `overview` must be 80–200 words (enforced at publish for English only; others not checked)
- Upsert by `(tripId, locale)`; English can be cleared but not deleted (same pattern as categories)

#### Schedules (`TourSchedule`)

- Each schedule = one departure slot with its own capacity
- `availableSpots` decrements per booking (managed by Bookings module in Phase 4+)
- `startTime` stored as `"HH:MM"` string (e.g. `"09:00"`)
- `startDate` as `@db.Date` (date only, no time)
- Status: `AVAILABLE` | `SOLD_OUT` | `CLOSED` | `CANCELLED`
- **Phase 5 addition**: When a schedule is created, schedule a BullMQ job at `startDate - 24h` for pre-booking window activation

### Database Indexes

```
@@index([operatorId])    — "my trips" list
@@index([destinationId]) — filter by destination
@@index([categoryId])    — filter by category
@@index([hubId])         — filter by hub
@@index([status])        — public live trip query + admin status filter
@@unique([destinationId, slug]) — slug uniqueness per destination + P2002 guard
```

---

## 4. Backend Implementation

### 4.1 File Structure

```
backend/src/trips/
├── dto/
│   ├── trip.dto.ts              ← Core trip DTOs (Create, Update, Query, Response)
│   └── trip-children.dto.ts    ← Child model DTOs (images, bands, highlights, etc.)
├── trips.service.ts             ← Core trip CRUD + lifecycle
├── trips-children.service.ts   ← Child model CRUD
├── trips.controller.ts          ← Core trip routes
├── trips-children.controller.ts ← Child model routes (nested under :tripId)
├── trips.swagger.ts             ← Swagger decorators for core endpoints
├── trips-children.swagger.ts   ← Swagger decorators for child endpoints
└── trips.module.ts              ← Module registration
```

### 4.2 Module Registration

**File: `trips/trips.module.ts`**

```typescript
@Module({
  controllers: [TripsController, TripChildrenController],
  providers: [TripsService, TripChildrenService],
  exports: [TripsService],  // SlotsService will need this in Phase 5
})
export class TripsModule {}
```

**Add to `AppModule.imports`:**

```typescript
// src/app.module.ts
import { TripsModule } from '@/trips/trips.module';

@Module({
  imports: [
    // ... existing modules ...
    TripsModule,
  ],
})
export class AppModule {}
```

No need to import `PrismaModule` — `PrismaService` is `@Global()`.

### 4.3 Core Trip DTOs

**File: `dto/trip.dto.ts`**

#### Response DTOs

```typescript
// TripResponseDto — base fields for list views
export class TripResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() status!: TripStatus;
  @ApiProperty() operatorId!: string;
  @ApiProperty() destinationId!: string;
  @ApiProperty() categoryId!: string;
  @ApiPropertyOptional() hubId?: string | null;
  @ApiProperty({ enum: PricingModel }) pricingModel!: PricingModel;
  @ApiPropertyOptional({ enum: UnitType }) unitType?: UnitType | null;
  @ApiPropertyOptional() basePrice?: string | null;
  @ApiPropertyOptional() priceFrom?: string | null;
  @ApiPropertyOptional() durationMinutes?: number | null;
  @ApiProperty({ enum: PickupModel }) pickupModel!: PickupModel;
  @ApiPropertyOptional() maxPartySize?: number | null;
  @ApiProperty() minPartySize!: number;
  @ApiProperty() bookingCutoffMinutes!: number;
  @ApiProperty() cancellationHours!: number;
  @ApiPropertyOptional() h1Override?: string | null;
  @ApiPropertyOptional() breadcrumbLabel?: string | null;
  @ApiPropertyOptional() aggregateRating?: number | null;
  @ApiProperty() aggregateReviewCount!: number;
  @ApiProperty() isSponsored!: boolean;
  @ApiProperty() isActive!: boolean;
  @ApiPropertyOptional() publishedAt?: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

// TripDetailResponseDto — includes nested child counts
export class TripDetailResponseDto extends TripResponseDto {
  @ApiProperty() imageCount!: number;
  @ApiProperty() scheduleCount!: number;
  @ApiProperty() highlightCount!: number;
  @ApiProperty() inclusionCount!: number;
}

// PaginatedTripsResponseDto
export class PaginatedTripsResponseDto {
  @ApiProperty({ example: 42 }) total!: number;
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ type: [TripResponseDto] }) data!: TripResponseDto[];
}
```

#### Query DTOs

```typescript
export class TripQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() destinationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() hubId?: string;
  @ApiPropertyOptional({ enum: PricingModel }) @IsOptional() @IsEnum(PricingModel) pricingModel?: PricingModel;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() minPrice?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() maxPrice?: number;
  @ApiPropertyOptional({ enum: Locale }) @IsOptional() @IsEnum(Locale) locale?: Locale = Locale.en;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20;
}

export class MyTripsQueryDto {
  @ApiPropertyOptional({ enum: TripStatus }) @IsOptional() @IsEnum(TripStatus) status?: TripStatus;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20;
}
```

#### Request DTOs

```typescript
export class CreateTripDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(120) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^[a-z0-9-]+$/) @MinLength(2) slug?: string;
  @ApiProperty() @IsUUID() destinationId!: string;
  @ApiProperty() @IsUUID() categoryId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() hubId?: string;
  @ApiPropertyOptional({ enum: PricingModel }) @IsOptional() @IsEnum(PricingModel) pricingModel?: PricingModel;
  @ApiPropertyOptional({ enum: UnitType }) @IsOptional() @IsEnum(UnitType) unitType?: UnitType;
  @ApiPropertyOptional() @IsOptional() @IsDecimal() basePrice?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(10080) durationMinutes?: number;
  @ApiPropertyOptional({ enum: PickupModel }) @IsOptional() @IsEnum(PickupModel) pickupModel?: PickupModel;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) maxPartySize?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) minPartySize?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(10080) bookingCutoffMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) cancellationHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) h1Override?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) breadcrumbLabel?: string;
}

export class UpdateTripDto {
  // Omit: destinationId, categoryId, hubId, slug (cannot change after creation)
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(120) name?: string;
  @ApiPropertyOptional({ enum: PricingModel }) @IsOptional() @IsEnum(PricingModel) pricingModel?: PricingModel;
  @ApiPropertyOptional({ enum: UnitType }) @IsOptional() @IsEnum(UnitType) unitType?: UnitType;
  @ApiPropertyOptional() @IsOptional() @IsDecimal() basePrice?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) durationMinutes?: number;
  @ApiPropertyOptional({ enum: PickupModel }) @IsOptional() @IsEnum(PickupModel) pickupModel?: PickupModel;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) maxPartySize?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) minPartySize?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(10080) bookingCutoffMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) cancellationHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) h1Override?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) breadcrumbLabel?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
```

### 4.4 Child Model DTOs

**File: `dto/trip-children.dto.ts`**

#### Image DTOs

```typescript
export class AddTourImageDto {
  @ApiProperty() @IsString() @IsUrl() url!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsUrl() urlAvif?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsUrl() urlWebp?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isHero?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(1) focalX?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(1) focalY?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) altText?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) displayOrder?: number;
  @ApiProperty() @IsInt() @Min(1) width!: number;
  @ApiProperty() @IsInt() @Min(1) height!: number;
}

export class UpdateTourImageDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isHero?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(1) focalX?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(1) focalY?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) altText?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) displayOrder?: number;
}
```

#### Age Band DTOs

```typescript
export class CreateTourAgeBandDto {
  @ApiProperty({ enum: AgeBandType }) @IsEnum(AgeBandType) bandType!: AgeBandType;
  @ApiProperty() @IsString() @MaxLength(60) label!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) minAge?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) maxAge?: number;
  @ApiProperty() @IsDecimal() price!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) minCount?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) maxCount?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) displayOrder?: number;
}
```

#### Add-On DTOs

```typescript
export class CreateTourAddOnDto {
  @ApiProperty() @IsString() @MaxLength(120) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
  @ApiProperty() @IsDecimal() price!: string;
  @ApiPropertyOptional({ enum: AddOnUnit }) @IsOptional() @IsEnum(AddOnUnit) unit?: AddOnUnit;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) maxQuantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) displayOrder?: number;
}
```

#### Highlight DTOs

```typescript
export class CreateTourHighlightDto {
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(100) text!: string; // English text
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) displayOrder?: number;
}

export class UpsertHighlightTranslationDto {
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(100) text!: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isMachineTranslated?: boolean;
}
```

#### Inclusion DTOs

```typescript
export class CreateTourInclusionDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) label!: string; // English
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) icon?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) displayOrder?: number;
}
```

#### Trip Translation DTOs

```typescript
export class UpsertTripTranslationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000) overview?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isMachineTranslated?: boolean;
}
```

#### Schedule DTOs

```typescript
export class CreateTourScheduleDto {
  @ApiProperty({ example: '2026-07-15' }) @IsDateString() startDate!: string;
  @ApiPropertyOptional({ example: '2026-07-16' }) @IsOptional() @IsDateString() endDate?: string;
  @ApiProperty({ example: '09:00' }) @IsString() @Matches(/^\d{2}:\d{2}$/) startTime!: string;
  @ApiProperty() @IsInt() @Min(1) totalSpots!: number;
}

export class UpdateTourScheduleDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) totalSpots?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) availableSpots?: number;
  @ApiPropertyOptional({ enum: ScheduleStatus }) @IsOptional() @IsEnum(ScheduleStatus) status?: ScheduleStatus;
}
```

### 4.5 Core Trips Service

**File: `trips.service.ts`**

#### Select Shape (Private Constant)

```typescript
private readonly tripSelect = {
  id: true, name: true, slug: true, status: true, operatorId: true,
  destinationId: true, categoryId: true, hubId: true,
  pricingModel: true, unitType: true, basePrice: true, priceFrom: true,
  durationMinutes: true, pickupModel: true, maxPartySize: true, minPartySize: true,
  bookingCutoffMinutes: true, cancellationHours: true, h1Override: true, breadcrumbLabel: true,
  aggregateRating: true, aggregateReviewCount: true, isSponsored: true, isActive: true,
  publishedAt: true, createdAt: true, updatedAt: true,
} as const;
```

#### `create(dto: CreateTripDto, operatorId: string)`

```
1. Generate slug = dto.slug ? generateSlug(dto.slug) : generateSlug(dto.name)
2. Validate destinationId exists and isActive = true
3. Validate categoryId exists and isActive = true
4. If dto.hubId:
   a. Fetch hub, verify exists and isActive = true
   b. Assert hub.destinationId === dto.destinationId → 400 if not
   c. Assert HubAllowedCategory row exists for (hubId, categoryId) → 400 if not
5. Start prisma.$transaction:
   a. Create Trip with status = DRAFT, operatorId = operatorId
      .catch P2002 → 409 ConflictException (slug already used in this destination)
   b. If dto.hubId === null/undefined:
      Fetch destination.slug (or use previously fetched)
      slugRegistry.create({ destinationSlug, slug, entityType: TOUR, entityId: trip.id })
      .catch P2002 → 409 ConflictException (slug already taken by another entity)
6. logger.log(...)
7. Return trip
```

#### `findAll(query: TripQueryDto)`

```
Build where: { status: LIVE, isActive: true }
  + optional destinationId, categoryId, hubId, pricingModel
  + optional basePrice gte/lte filter
Paginate, orderBy: publishedAt desc
Select: tripSelect + images(hero only) + schedules(count) for preview
```

#### `findMyTrips(operatorId: string, query: MyTripsQueryDto)`

```
where: { operatorId, ...(status filter) }
Include: _count for images, schedules, highlights, inclusions
```

#### `findOne(id: string, requesterId: string | null, requesterRole: Role | null)`

```
Fetch full trip
If status !== LIVE:
  If requester is null → 404
  If requester is not owner AND not ADMIN → 403
Return trip with _count for child models
```

#### `update(id: string, dto: UpdateTripDto, requesterId: string, requesterRole: Role)`

```
Fetch trip
assertOwnership(trip, requesterId, requesterRole)
If status === ARCHIVED → throw 400 "Cannot update an archived trip"
Update fields (omit slug, destinationId, categoryId, hubId)
```

#### `publish(id: string, operatorId: string)`

```
Fetch trip with images, highlights, translations
If trip.operatorId !== operatorId → 403
If trip.status !== DRAFT → 400 "Trip is not in DRAFT status"

// Collect all failing blocks, return them all at once (better UX)
const errors: string[] = [];
if (trip.images.length < 5) errors.push('At least 5 images required');
if (!trip.images.some(i => i.isHero)) errors.push('A hero image must be set');
const enTranslation = trip.translations.find(t => t.locale === 'en');
if (!enTranslation?.overview?.trim()) errors.push('An English overview is required');
if (trip.highlights.length < 3) errors.push('At least 3 highlights required');
if (errors.length > 0) throw new BadRequestException(errors);

// All pass
return prisma.trip.update({ where: { id }, data: { status: LIVE, publishedAt: new Date() }, select: tripSelect })
logger.log(...)
```

#### `pause(id: string, operatorId: string)`

```
Fetch trip
If trip.operatorId !== operatorId → 403
If trip.status !== LIVE → 400 "Trip must be LIVE to pause"
Update status = PAUSED
// Phase 5 hook: if trip.featuredSlot → SlotsService.releaseSlot()
logger.log(...)
```

#### `unpause(id: string, operatorId: string)`

```
Fetch trip
If trip.operatorId !== operatorId → 403
If trip.status !== PAUSED → 400 "Trip must be PAUSED to unpause"
Update status = LIVE
logger.log(...)
```

#### `archive(id: string, requesterId: string, requesterRole: Role)`

```
Fetch trip
assertOwnership(trip, requesterId, requesterRole)
If trip.status === DRAFT → 400 "Cannot archive a draft — delete it instead"
If trip.status === ARCHIVED → 400 "Trip is already archived"

prisma.$transaction:
  a. Update trip: status = ARCHIVED, isActive = false
  b. If trip.hubId === null (destination-only): update slugRegistry isActive = false
  // Phase 5 hook: if trip.featuredSlot → SlotsService.releaseSlot()
logger.log(...)
```

#### `remove(id: string, operatorId: string)`

```
Fetch trip
If trip.operatorId !== operatorId → 403
If trip.status !== DRAFT → 400 "Only DRAFT trips can be deleted"

prisma.$transaction:
  a. If trip.hubId === null: delete slugRegistry row
  b. Delete trip (Prisma cascades child models)
logger.log(...)
```

### 4.6 Child Model Service

**File: `trips-children.service.ts`**

#### Common Access Helper

```typescript
private async assertTripAccess(tripId: string, requesterId: string, requesterRole: Role) {
  const trip = await this.prisma.trip.findUnique({ where: { id: tripId }, select: { id: true, operatorId: true, status: true } });
  if (!trip) throw new NotFoundException(`Trip ${tripId} not found`);
  if (requesterRole !== Role.ADMIN && trip.operatorId !== requesterId) {
    throw new ForbiddenException('Not your trip');
  }
  return trip;
}
```

#### Images

**`addImage(tripId, dto, requesterId, requesterRole)`**

```
assertTripAccess(...)
If dto.isHero:
  prisma.$transaction:
    a. Clear existing hero: update tourImage where tripId=tripId, set isHero=false
    b. Create new image with isHero=true
Else:
  Create image directly
Return image
```

**`updateImage(tripId, imageId, dto, requesterId, requesterRole)`**

```
assertTripAccess(...)
If dto.isHero === true:
  $transaction: clear hero, update this image to isHero=true
Else:
  Update image directly
```

**`removeImage(tripId, imageId, requesterId, requesterRole)`**

```
assertTripAccess(...)
Delete image (verify tripId matches)
```

#### Highlights

**`addHighlight(tripId, dto, requesterId, requesterRole)`**

```
assertTripAccess(...)
$transaction:
  a. Create TourHighlight { tripId, displayOrder }
  b. Create TourHighlightTranslation { highlightId, locale: 'en', text: dto.text }
Return highlight with English translation
```

**`upsertHighlightTranslation(tripId, highlightId, locale, dto, requesterId, requesterRole)`**

```
assertTripAccess(...)
Verify highlight.tripId === tripId → 404 if not found
upsert TourHighlightTranslation
```

**`deleteHighlightTranslation(tripId, highlightId, locale, requesterId, requesterRole)`**

```
assertTripAccess(...)
If locale === 'en' → 400 "English highlight text cannot be deleted"
Delete translation row
```

#### Trip Translations

**`upsertTranslation(tripId, locale, dto, requesterId, requesterRole)`**

```
assertTripAccess(...)
upsert TripTranslation { tripId, locale }
Note: Trip.name stays as canonical English name; TripTranslation.title is the override display title
```

**`deleteTranslation(tripId, locale, requesterId, requesterRole)`**

```
assertTripAccess(...)
If locale === 'en' → 400 "English translation cannot be deleted. Update the overview field to null instead."
Delete TripTranslation row
```

#### Schedules

**`createSchedule(tripId, dto, requesterId, requesterRole)`**

```
assertTripAccess(...)
Create TourSchedule { tripId, availableSpots: dto.totalSpots, ... }
// Phase 5 hook: schedule BullMQ pre-booking job at (startDate - 24h)
Return schedule
```

### 4.7 Core Trips Controller

**File: `trips.controller.ts`**

```typescript
@ApiTags('Trips')
@Controller('trips')
export class TripsController {
  // ORDER: static routes BEFORE dynamic :id routes — NestJS matches top-to-bottom
  @Get()               @ApiGetAllTripsDocs()                                             getAll(@Query() q: TripQueryDto) {}
  @Get('my-trips')     @ApiGetMyTripsDocs()     @RequirePermissions(Permission.VIEW_TRIPS)   getMyTrips(...) {}
  @Post()              @ApiCreateTripDocs()     @RequirePermissions(Permission.CREATE_TRIP)  create(...) {}
  @Get(':id')          @ApiGetTripByIdDocs()                                             getById(@Param('id') id: string, @Req() req) {}
  @Patch(':id')        @ApiUpdateTripDocs()     @RequirePermissions(Permission.EDIT_TRIP)    update(...) {}
  @Post(':id/publish') @ApiPublishTripDocs()    @RequirePermissions(Permission.MANAGE_TRIPS) publish(...) {}
  @Post(':id/pause')   @ApiPauseTripDocs()      @RequirePermissions(Permission.MANAGE_TRIPS) pause(...) {}
  @Post(':id/unpause') @ApiUnpauseTripDocs()    @RequirePermissions(Permission.MANAGE_TRIPS) unpause(...) {}
  @Post(':id/archive') @ApiArchiveTripDocs()    @RequirePermissions(Permission.MANAGE_TRIPS) archive(...) {}
  @Delete(':id')       @ApiDeleteTripDocs()     @RequirePermissions(Permission.DELETE_TRIP)  remove(...) {}
}
```

Use `import type { TypedAuthUser, AuthenticatedRequest }` from `@/auth/auth.types`.
Pass `user.id` and `user.role` to service methods that need ownership checks.

### 4.8 Child Model Controller

**File: `trips-children.controller.ts`**

```typescript
@ApiTags('Trip Children')
@Controller('trips/:tripId')
export class TripChildrenController {
  // Images
  @Get('images')               @RequirePermissions(Permission.VIEW_TRIPS) getImages(...)
  @Post('images')              @RequirePermissions(Permission.EDIT_TRIP)  addImage(...)
  @Patch('images/:imageId')    @RequirePermissions(Permission.EDIT_TRIP)  updateImage(...)
  @Delete('images/:imageId')   @RequirePermissions(Permission.EDIT_TRIP)  removeImage(...)

  // Age Bands
  @Get('age-bands')            ...
  @Post('age-bands')           ...
  @Patch('age-bands/:bandId')  ...
  @Delete('age-bands/:bandId') ...

  // Add-Ons
  @Get('addons')               ...
  @Post('addons')              ...
  @Patch('addons/:addonId')    ...
  @Delete('addons/:addonId')   ...

  // Languages
  @Get('languages')                  ...
  @Post('languages')                 ...
  @Delete('languages/:languageId')   ...

  // Highlights — static before dynamic
  @Get('highlights')                                       ...
  @Post('highlights')                                      ...
  @Patch('highlights/:highlightId')                        ...
  @Delete('highlights/:highlightId')                       ...
  @Put('highlights/:highlightId/translations/:locale')     ...
  @Delete('highlights/:highlightId/translations/:locale')  ...

  // Inclusions
  @Get('inclusions')                                       ...
  @Post('inclusions')                                      ...
  @Patch('inclusions/:inclusionId')                        ...
  @Delete('inclusions/:inclusionId')                       ...
  @Put('inclusions/:inclusionId/translations/:locale')     ...
  @Delete('inclusions/:inclusionId/translations/:locale')  ...

  // Trip Translations
  @Get('translations')         ...
  @Get('translations/:locale') ...
  @Put('translations/:locale') ...
  @Delete('translations/:locale') ...

  // Schedules
  @Get('schedules')                   ...
  @Post('schedules')                  ...
  @Patch('schedules/:scheduleId')     ...
  @Delete('schedules/:scheduleId')    ...
}
```

### 4.9 Swagger Decorators

**File: `trips.swagger.ts`** — one decorator function per endpoint. Follow the exact pattern from `categories.swagger.ts`:

```typescript
const commonErrors = [BadRequestErrorDoc, UnauthorizedErrorDoc, InternalServerErrorDoc];
const operatorErrors = [...commonErrors, ForbiddenErrorDoc];

export function ApiGetAllTripsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get all live trips with filters' }),
    ApiResponse({ status: 200, type: PaginatedTripsResponseDto }),
    ...commonErrors,
  );
}

export function ApiPublishTripDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Publish a draft trip (DRAFT → LIVE)' }),
    ApiResponse({ status: 200, type: TripResponseDto }),
    ApiResponse({ status: 400, description: 'Publish blocks not met (images, hero, overview, highlights)' }),
    ApiResponse({ status: 409, description: 'Trip is not in DRAFT status' }),
    ...operatorErrors,
  );
}
// ... one per endpoint
```

`404` always uses `type: NotFoundErrorDto`. Import error DTOs from `@/common/dto/error-responses.dto`.

**File: `trips-children.swagger.ts`** — same pattern, one function per child endpoint.

### 4.10 Ownership & Authorization

Every operator-facing mutation checks that `trip.operatorId === authenticatedUser.id` before proceeding. Admins bypass this check via `MANAGE_TRIPS` permission.

| Action | Who Can Perform |
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

**Ownership check helper:**

```typescript
private async assertOwnership(trip: { operatorId: string }, requesterId: string, requesterRole: Role) {
  if (requesterRole === Role.ADMIN) return;  // bypass
  if (trip.operatorId !== requesterId) {
    throw new ForbiddenException('You do not have permission to modify this trip');
  }
}
```

**resolveOperatorId pattern (from CLAUDE.md):**

`trips.operatorId` is a FK to `operators.id` — **not** `users.id`. Controllers pass `user.id`; the service must resolve it to `operator.id` before any DB write or ownership check. Use the private `resolveOperatorId(userId, role?)` helper in `trips.service.ts`.

```typescript
// Correct — resolve first
const operatorId = await this.resolveOperatorId(userId, userRole);

// Wrong — user.id !== operator.id
await prisma.trip.create({ data: { operatorId: userId, ... } });
```

**Admin auto-provisioning:** If the caller is `Role.ADMIN` and has no operator record, `resolveOperatorId` silently creates one (`{ userId }` — all other fields optional). This lets admins create and own trips without a separate registration step. For `Role.TOUR_OPERATOR` with no operator record, it throws `400`.

**Lifecycle ownership bypass:** `publish`, `pause`, `unpause`, `remove`, and `assertOwnership` all skip the ownership check when `userRole === Role.ADMIN`, so admins can manage any operator's trip. Operators are always checked against their own `operatorId`.

### 4.11 Publish Blocks

The publish endpoint validates these four conditions **in this order** before setting status to LIVE. All failing blocks are collected and returned together (better UX — the operator sees everything at once):

| Block | Check | Error |
|-------|-------|-------|
| B1 — Images | `trip.images.length >= 5` | 400 "At least 5 images are required to publish" |
| B2 — Hero image | `trip.images.some(img => img.isHero === true)` | 400 "A hero image must be set before publishing" |
| B3 — English overview | English `TripTranslation` exists with `overview` non-null and non-empty | 400 "An English overview is required to publish" |
| B4 — Highlights | `trip.highlights.length >= 3` | 400 "At least 3 highlights are required to publish" |

If all pass: set `status = LIVE`, `publishedAt = now()`.

### 4.12 Hub Validation Rules

These are enforced in the service on create:

1. **Hub existence**: Hub must exist and `isActive = true`
2. **Hub–Destination consistency**: `hub.destinationId === dto.destinationId` — the hub must belong to the same destination as the trip
3. **Category–Hub allowance**: A row in `HubAllowedCategory` must exist for `(hubId, categoryId)` — this is the admin-managed list of categories allowed in a hub. If the category is not allowed, reject with 400.
4. **No slug_registry write**: Hub-anchored tours are resolved by the two-segment URL pattern, not slug_registry. Skip the registry insert entirely.

### 4.13 Slug Generation Rules

- Trip slug is **English only** — never translated
- Auto-generated from `name` using `generateSlug()` (existing `@/common/utils/slug.util`)
- Optional manual slug on create (same `slugTouched` pattern as categories)
- Unique per `(destinationId, slug)` — same tour name allowed in different destinations
- **Cannot be changed after creation** (edit endpoint does not accept `slug`)
- Slug is passed through `generateSlug()` even if manually provided, to normalize it

### 4.14 Category Change Guard

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

### 4.15 Child Model Rules

See [Section 3 — Data Model](#3-data-model) for the full specifications per child entity. Additional service-level rules:

- Hero image change clears all other heroes in a single `$transaction`
- English translation cannot be deleted — return 400 with explanation to use null-field upsert instead
- English highlight text cannot be deleted — return 400
- Highlight deletion cascades to all translations for that highlight
- `TripTranslation.title` is the override display title; `Trip.name` stays as the canonical English name

### 4.16 Permissions

| Permission | Used on |
|------------|---------|
| `CREATE_TRIP` | POST /trips |
| `EDIT_TRIP` | PATCH /trips/:id, images, bands, etc. |
| `VIEW_TRIPS` | GET /trips, GET /trips/my-trips, GET /trips/:id |
| `MANAGE_TRIPS` | Admin force-archive, admin update any trip, publish/pause/unpause/archive |
| `DELETE_TRIP` | DELETE /trips/:id (DRAFT only, own) |

**Verify in `roles.config.ts`:** `TOUR_OPERATOR` role must include `CREATE_TRIP`, `EDIT_TRIP`, `VIEW_TRIPS`, `MANAGE_TRIPS`, `DELETE_TRIP`. Add if missing.

### 4.17 Database Indexes

```
@@index([operatorId])            — "my trips" list
@@index([destinationId])         — filter by destination
@@index([categoryId])            — filter by category
@@index([hubId])                 — filter by hub
@@index([status])                — public live trip query + admin status filter
@@unique([destinationId, slug])  — slug uniqueness per destination + P2002 guard
```

### 4.18 Edge Cases

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

## 5. API Reference

> Base URL: `http://localhost:5050/api/v1`
> Auth: `better-auth.session_token` cookie

### 5.1 Core Trip Endpoints

| Method | Path | Auth | Permission | Description |
|--------|------|------|-----------|-------------|
| GET | `/trips` | Public | — | Live trips with filters |
| GET | `/trips/my-trips` | Operator | `VIEW_TRIPS` | Own trips, all statuses |
| GET | `/trips/slug/:slug?destinationSlug=&hubSlug=&locale=` | Public | — | Tour detail page (SSR) |
| GET | `/trips/:id` | Optional | `VIEW_TRIPS` | Single trip detail |
| POST | `/trips` | Operator | `CREATE_TRIP` | Create draft |
| PATCH | `/trips/:id` | Operator/Admin | `EDIT_TRIP` | Update core fields |
| POST | `/trips/:id/publish` | Operator | `MANAGE_TRIPS` | DRAFT → LIVE |
| POST | `/trips/:id/pause` | Operator | `MANAGE_TRIPS` | LIVE → PAUSED |
| POST | `/trips/:id/unpause` | Operator | `MANAGE_TRIPS` | PAUSED → LIVE |
| POST | `/trips/:id/archive` | Operator/Admin | `MANAGE_TRIPS` | → ARCHIVED |
| DELETE | `/trips/:id` | Operator | `DELETE_TRIP` | Delete DRAFT only |

> Static routes (`my-trips`) MUST come before dynamic (`:id`) in the controller class — NestJS matches top-to-bottom.

### 5.2 Child Model Endpoints

All routes nested under `/trips/:tripId/...`

**Images**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/trips/:tripId/images` | Operator | List images |
| POST | `/trips/:tripId/images` | Operator | Add image |
| PATCH | `/trips/:tripId/images/:imageId` | Operator | Update image (alt, focal, order, hero) |
| DELETE | `/trips/:tripId/images/:imageId` | Operator | Remove image |

**Age Bands**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/trips/:tripId/age-bands` | Operator | List age bands |
| POST | `/trips/:tripId/age-bands` | Operator | Add age band |
| PATCH | `/trips/:tripId/age-bands/:bandId` | Operator | Update band |
| DELETE | `/trips/:tripId/age-bands/:bandId` | Operator | Remove band |

**Add-Ons**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/trips/:tripId/addons` | Operator | List add-ons |
| POST | `/trips/:tripId/addons` | Operator | Add add-on |
| PATCH | `/trips/:tripId/addons/:addonId` | Operator | Update add-on |
| DELETE | `/trips/:tripId/addons/:addonId` | Operator | Remove add-on |

**Languages**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/trips/:tripId/languages` | Operator | List languages |
| POST | `/trips/:tripId/languages` | Operator | Add language |
| DELETE | `/trips/:tripId/languages/:languageId` | Operator | Remove language |

**Highlights**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/trips/:tripId/highlights` | Operator | List highlights |
| POST | `/trips/:tripId/highlights` | Operator | Add highlight (creates row + EN translation) |
| PATCH | `/trips/:tripId/highlights/:highlightId` | Operator | Update display order |
| DELETE | `/trips/:tripId/highlights/:highlightId` | Operator | Remove highlight + all translations |
| PUT | `/trips/:tripId/highlights/:highlightId/translations/:locale` | Operator | Upsert highlight translation |
| DELETE | `/trips/:tripId/highlights/:highlightId/translations/:locale` | Operator | Delete translation (not EN) |

**Inclusions**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/trips/:tripId/inclusions` | Operator | List inclusions |
| POST | `/trips/:tripId/inclusions` | Operator | Add inclusion |
| PATCH | `/trips/:tripId/inclusions/:inclusionId` | Operator | Update icon/order |
| DELETE | `/trips/:tripId/inclusions/:inclusionId` | Operator | Remove inclusion |
| PUT | `/trips/:tripId/inclusions/:inclusionId/translations/:locale` | Operator | Upsert translation |
| DELETE | `/trips/:tripId/inclusions/:inclusionId/translations/:locale` | Operator | Delete translation |

**Trip Translations**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/trips/:tripId/translations` | Operator | All locale translations |
| GET | `/trips/:tripId/translations/:locale` | Operator | Single locale |
| PUT | `/trips/:tripId/translations/:locale` | Operator | Upsert translation |
| DELETE | `/trips/:tripId/translations/:locale` | Operator | Delete (non-EN only) |

**Schedules**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/trips/:tripId/schedules` | Public | List schedules |
| POST | `/trips/:tripId/schedules` | Operator | Add schedule |
| PATCH | `/trips/:tripId/schedules/:scheduleId` | Operator | Update schedule |
| DELETE | `/trips/:tripId/schedules/:scheduleId` | Operator | Remove schedule |

### 5.3 Request & Response Shapes

#### GET /trips (Public Listing)

Query parameters:
```
?destinationId=uuid
?categoryId=uuid
?hubId=uuid
?pricingModel=PER_PERSON
?minPrice=50&maxPrice=200
?locale=nl              (default: en)
?page=2&limit=20        (default: 1, 20)
```

Response:
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

#### GET /trips/my-trips

Query parameters: `?status=DRAFT|LIVE|PAUSED|ARCHIVED&page=1&limit=20`

Response per item:
```json
{
  "id": "uuid",
  "name": "Sunset Catamaran Cruise",
  "slug": "sunset-catamaran-cruise",
  "status": "DRAFT",
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

`heroImage` is `null` when no hero image has been set yet.

#### POST /trips (Create)

Request body:
```json
{
  "name": "Sunset Catamaran Cruise",
  "destinationId": "uuid",
  "categoryId": "uuid",
  "hubId": null,
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

Optional custom slug:
```json
{
  "name": "Sunset Catamaran Cruise",
  "slug": "my-custom-slug",
  ...
}
```

#### GET /trips/slug/:slug (Tour Detail — SSR)

For destination-only tours:
```
GET /trips/slug/sunset-catamaran-cruise?destinationSlug=curacao&locale=nl
```

For hub-anchored tours:
```
GET /trips/slug/snorkel-adventure?destinationSlug=curacao&hubSlug=mambo-beach&locale=nl
```

Full response:
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
    }
  ],

  "highlights": [
    { "id": "uuid", "displayOrder": 0, "text": "Aanschouw de zonsondergang vanaf het water" }
  ],

  "inclusions": [
    { "id": "uuid", "icon": "drink", "displayOrder": 0, "label": "Open bar" }
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
    { "id": "uuid", "startDate": "2026-07-15", "startTime": "09:00", "availableSpots": 18, "status": "AVAILABLE" }
  ]
}
```

**Locale fallback:** If the requested locale has no translation, the response returns the English translation automatically. `translation.locale` tells you which locale was actually served. Show "Available in English only" label if `translation.locale !== requestedLocale`.

#### PATCH /trips/:id (Update)

Category change response when trip is LIVE:
```json
{
  "trip": { "...": "..." },
  "warnings": ["Category changed on a LIVE trip. In Phase 5 this will be blocked if a featured slot is held."]
}
```

#### POST /trips/:tripId/images (Add Image)

```json
{
  "url": "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/sunset-cruise",
  "isHero": false,
  "altText": "Sunset view from the catamaran",
  "displayOrder": 0,
  "width": 1920,
  "height": 1080
}
```

- `width` / `height`: Required — pass the pixel dimensions from the Cloudinary upload response (`data.width`, `data.height`)
- `focalX` / `focalY`: Optional (default `0.5 / 0.5` = centered)
- Store the Cloudinary URL exactly as returned — it already includes `f_auto,q_auto`

#### PUT /trips/:tripId/translations/:locale

English:
```json
{
  "overview": "Join us for a breathtaking two-hour sunset cruise...",
  "description": "Full detailed markdown description..."
}
```

Other locales:
```json
{
  "title": "Zonsondergang Catamaran Cruise",
  "overview": "Stap aan boord voor een adembenemende zonsondergangscruise...",
  "isMachineTranslated": true
}
```

**Supported locales:** `en`, `nl`, `es`, `pt`, `fr`, `de`, `zh`

**English cannot be deleted.** To clear it, send `null` values: `{ "overview": null, "description": null }`

#### POST /trips/:tripId/schedules (Add Schedule)

Single-day:
```json
{ "startDate": "2026-07-15", "startTime": "09:00", "totalSpots": 20 }
```

Multi-day:
```json
{ "startDate": "2026-07-15", "endDate": "2026-07-16", "startTime": "09:00", "totalSpots": 12 }
```

#### POST /trips/:tripId/age-bands

```json
{
  "bandType": "ADULT",
  "label": "Adults (13+)",
  "minAge": 13,
  "price": "75.00",
  "minCount": 1,
  "maxCount": 10
}
```

#### POST /trips/:tripId/addons

```json
{
  "name": "Hotel pickup",
  "description": "We pick you up from your hotel in Willemstad",
  "price": "15.00",
  "unit": "PER_PERSON",
  "maxQuantity": 1
}
```

`unit` values: `PER_PERSON` | `FLAT`

#### PUT /trips/:tripId/highlights/:highlightId/translations/:locale

```json
{ "text": "Aanschouw de zonsondergang vanaf het water" }
```

#### PUT /trips/:tripId/inclusions/:inclusionId/translations/:locale

```json
{ "label": "Open bar" }
```

Available inclusion icon slugs: `check`, `drink`, `food`, `transport`, `gear`, `guide`, `photo`, `ticket`

### 5.4 Error Codes

| Status | When | Frontend action |
|--------|------|----------------|
| 400 | Publish blocks not met (array of messages) | Show all messages in a red error box |
| 400 | Archived trip update attempt | Redirect to read-only view |
| 400 | English translation delete attempt | Show explanation; offer null-field upsert |
| 400 | Archive a DRAFT trip | Show "Delete this trip instead" |
| 400 | Delete a non-DRAFT trip | Show current status and available actions |
| 403 | Operator trying to edit another operator's trip | Redirect to 403 page |
| 404 | Trip slug not found or not LIVE | Show 404 page |
| 404 | DRAFT trip accessed without auth | Show 404 (intentional — no information leak) |
| 409 | Slug conflict on create | "A trip with this name/slug already exists. Choose a different slug." |

---

## 6. Frontend Integration

### 6.1 Operator Dashboard — My Trips List

**Request:**
```
GET /trips/my-trips?page=1&limit=20
GET /trips/my-trips?status=DRAFT
GET /trips/my-trips?status=LIVE
```

**Dashboard list rendering rules:**
- `status === "DRAFT"` → grey badge; show "Complete & Publish" CTA
- `status === "LIVE"` → green badge; show "Pause" action
- `status === "PAUSED"` → amber badge; show "Unpause" and "Archive" actions
- `status === "ARCHIVED"` → red badge; read-only, no actions
- `heroImage === null` → show placeholder thumbnail
- `imageCount < 5` → show image warning on the card
- `highlightCount < 3` → show content warning on the card

### 6.2 Creating a New Trip

**Step 1 — Load selectors:**
```
GET /destinations/active               → destination dropdown options
GET /categories/active                 → category dropdown options
GET /hubs?destinationId=:id&isActive=true  → hub dropdown (after destination selected)
```

**Slug field behaviour (same as category/destination pattern):**
- Auto-generates from `name` as user types (use the same `toSlug()` util as other create forms)
- Once manually edited, auto-generation stops (`slugTouched` flag)
- On edit page: render as read-only — slug cannot change after creation

```typescript
// toSlug mirrors the backend generateSlug util — keep them in sync
function toSlug(value: string) {
  return value
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const [slugTouched, setSlugTouched] = useState(false);
useEffect(() => {
  if (!isEditMode && !slugTouched) setValue('slug', toSlug(nameValue));
}, [nameValue, isEditMode, slugTouched, setValue]);
```

**On success:** Navigate to the trip edit page `/dashboard/trips/:id/edit`
**On 409:** Show "A trip with this slug already exists in this destination"

### 6.3 Trip Edit Page — Tab Structure

```
[ Details ] [ Images ] [ Content ] [ Highlights ] [ Inclusions ] [ Pricing ] [ Schedules ] [ Languages ] [ Translations ]
```

#### Tab: Details

Calls `PATCH /trips/:id` with any changed core fields. If the trip is LIVE and `categoryId` changes, show the warning as a dismissable yellow banner.

#### Tab: Images

**Cloudinary URL:** Store the URL exactly as returned by the Cloudinary upload API — it already includes `f_auto,q_auto`. A single URL is sufficient; Cloudinary serves the right format (WebP, AVIF, JPEG) automatically based on the browser's `Accept` header.

**Dashboard validation display:**
- Show image count: `{count}/24 images`
- If count < 5: red warning "Need at least 5 images to publish"
- Mark the hero image with a star/crown icon
- If no hero: amber warning "Set a hero image before publishing"

Set hero image:
```
PATCH /trips/:tripId/images/:imageId
{ "isHero": true }
```
This atomically clears the old hero and sets the new one.

Update focal point (for responsive CSS object-position):
```
PATCH /trips/:tripId/images/:imageId
{ "focalX": 0.7, "focalY": 0.4 }
```
Used as: `object-position: ${focalX * 100}% ${focalY * 100}%`

#### Tab: Content (Highlights + Inclusions)

**Highlights — 3 to 6 bullet points:**

```
GET /trips/:tripId/highlights        → load list
POST /trips/:tripId/highlights       → { "text": "Watch the sunset with cocktails in hand", "displayOrder": 0 }
PATCH /trips/:tripId/highlights/:id  → { "displayOrder": 2 }
DELETE /trips/:tripId/highlights/:id → remove (also deletes all translations)
```

Dashboard validation: show `{count}/6 highlights`; warn if < 3 or > 6.

**Inclusions:**

```
POST /trips/:tripId/inclusions
{ "label": "Open bar", "icon": "drink", "displayOrder": 0 }

PATCH /trips/:tripId/inclusions/:id
{ "icon": "check" }
```

Available icon slugs: `check`, `drink`, `food`, `transport`, `gear`, `guide`, `photo`, `ticket`

#### Tab: Pricing (Age Bands + Add-Ons)

When `pricingModel === "PER_PERSON"` and no age bands → `basePrice` is used flat for all guests.
When age bands are defined → the booking widget shows separate counters per band.

Add-ons: EU Fair Act — never pre-checked.

#### Tab: Schedules

`availableSpots` is decremented by the Bookings module (Phase 4). Operators can manually adjust with `"availableSpots": N`.

Schedule status values: `AVAILABLE` | `SOLD_OUT` | `CLOSED` | `CANCELLED`

#### Tab: Languages

ISO 639-1 two-letter codes. Shown in the booking widget as a badge strip.

```
POST /trips/:tripId/languages    → { "language": "nl" }
DELETE /trips/:tripId/languages/:languageId
```

Common codes for Caribbean: `en`, `nl`, `es`, `pt`, `de`

#### Tab: Translations

Each locale stores `title` (optional override), `overview` (80–200 words, required for publish), and `description` (long-form).

**English is the base locale — always edit first.**

Highlight and inclusion translations follow the same PUT/DELETE pattern under their respective nested paths.

English translation cannot be deleted from highlights or inclusions (same rule as trip translations — return 400, offer null-field upsert instead).

### 6.4 Publishing a Trip

**Publish button calls:**
```
POST /trips/:id/publish
```

All four publish blocks are checked simultaneously. All errors are returned at once:
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

### 6.5 Trip Lifecycle Actions

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

### 6.6 Public Trip Listing Page

**URL pattern:** `/{locale}/destinations/{destinationSlug}/tours`
or with filters: `/{locale}/destinations/{destinationSlug}/tours?categoryId=&page=`

**API call:**
```
GET /trips?destinationId=uuid&categoryId=uuid&page=1&limit=20&locale=en
```

**Build the trip card URL:**
```typescript
// destinationSlug comes from the page's route param
// hubId determines URL pattern
const tripUrl = trip.hubId
  ? `/${locale}/${destinationSlug}/${hubSlug}/${trip.slug}`   // hub-anchored
  : `/${locale}/${destinationSlug}/${trip.slug}`;              // destination-only
```

> For hub-anchored trips in the listing, the listing API returns `hubId` but not the hub slug. Either enrich the response in a later iteration, or pass `hubId` and resolve hub slug separately, or store hub slug alongside hubId in the listing response (future enhancement).

### 6.7 URL Routing and Slug Resolution

The platform has two URL patterns for tour detail pages:

```
Destination-only:  /{locale}/{destinationSlug}/{tourSlug}
Hub-anchored:      /{locale}/{destinationSlug}/{hubSlug}/{tourSlug}
```

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

**For a 4-segment URL** (`/{locale}/{dest}/{hub-slug}/{tour-slug}`): You already know it's a hub-anchored tour — call the trip slug endpoint directly (no registry needed).

### 6.8 Trip Detail Page (SSR)

This is the single most important public endpoint. One call returns everything needed for the page.

```
GET /trips/slug/sunset-catamaran-cruise?destinationSlug=curacao&locale=nl
```

See [Section 5.3](#53-request--response-shapes) for the full response shape.

**Render the page:**
```typescript
// H1
const h1 = trip.h1Override ?? trip.translation?.title ?? trip.name;

// Hero image
const heroImage = trip.images.find(img => img.isHero);

// Gallery
const galleryImages = trip.images.filter(img => !img.isHero);

// Breadcrumb
const breadcrumb = trip.breadcrumbLabel ?? trip.name;
```

### 6.9 Building the Booking Widget

Uses data from the slug endpoint response.

**Step 1 — Date picker:** Populated from `schedules`. Only show schedules with `status === "AVAILABLE"` and `availableSpots > 0`.

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

### 6.10 SEO, Meta Tags, H1 and Breadcrumb Overrides

```typescript
// Page <title>
const pageTitle = trip.translation?.title ?? trip.name;

// <meta name="description">
const metaDescription = trip.translation?.overview
  ? trip.translation.overview.slice(0, 160)
  : `Book ${trip.name} in ${destinationSlug}`;

// Open Graph image
const ogImage = trip.images.find(img => img.isHero)?.url ?? trip.images[0]?.url;

// H1 tag
const h1 = trip.h1Override ?? trip.translation?.title ?? trip.name;

// Breadcrumb label
const breadcrumb = trip.breadcrumbLabel ?? trip.name;
```

`h1Override` is used when the auto-generated H1 reads awkwardly (e.g., "Snorkeling Tour at Mambo Beach Curaçao" might need `h1Override = "Mambo Beach Snorkel Tour"`).

### 6.11 Multilingual URL Strategy

The `trip.slug` is always English — it never changes per locale. Only the content (title, overview, description) is translated. The URL stays the same across all locales:

```
/en/curacao/sunset-catamaran-cruise   → English content
/nl/curacao/sunset-catamaran-cruise   → Dutch content (same slug, different locale prefix)
/es/curacao/sunset-catamaran-cruise   → Spanish content
```

Pass `?locale=nl` to the slug endpoint to get Dutch content. If Dutch translation doesn't exist, English is returned automatically.

### 6.12 RBAC Gates in Dashboard

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

### 6.13 Data Flow Summary

#### Dashboard: Creating and Publishing a Trip

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

#### Public Frontend: Rendering a Tour Page

```
URL: /nl/curacao/sunset-catamaran-cruise

1. Parse URL: locale=nl, destinationSlug=curacao, slug=sunset-catamaran-cruise

2. (If 3-segment URL and entityType unknown — resolve first)
   GET /slug-registry/resolve?destinationSlug=curacao&slug=sunset-catamaran-cruise
   → { entityType: "TOUR" }    → render TourDetailPage

3. GET /trips/slug/sunset-catamaran-cruise?destinationSlug=curacao&locale=nl
   → Full trip page data in one call

4. Render page:
   - H1: h1Override ?? translation.title ?? trip.name
   - Hero image: images.find(img => img.isHero)
   - Image gallery: remaining images
   - Highlights: highlights.map(h => h.text)
   - Inclusions: inclusions.map(i => i.label + i.icon)
   - Booking widget: schedules + ageBands + addOns + basePrice
   - Meta tags: from translation.overview
```

### 6.14 Phase 5 Hooks (Do Not Implement Yet)

These are intentional placeholders in the current backend. The frontend must NOT expose any slot-related UI in Phase 4. Slot management is a separate Phase 5 dashboard panel.

| Feature | Location | What Phase 5 Adds |
|---------|----------|-------------------|
| Release featured slot on pause | `trips.service.ts → pause()` | `SlotsService.releaseSlot(trip.id)` |
| Release featured slot on archive | `trips.service.ts → archive()` | `SlotsService.releaseSlot(trip.id)` |
| Category change guard | `trips.service.ts → update()` | Block if `trip.featuredSlot` exists |
| BullMQ pre-booking job | `trips-children.service.ts → createSchedule()` | Schedule job at `startDate - 24h` |

---

## 7. Implementation Checklist

### Recommended Execution Sequence

| Order | Task | Why This Order |
|-------|------|---------------|
| 1 | Module scaffold + AppModule registration | Required before anything compiles |
| 2 | Core trip DTOs | Services and controllers depend on these |
| 3 | Core trips service — `create`, `findAll`, `findMyTrips`, `findOne`, `update` | Foundation; publish/pause/archive build on top |
| 4 | Core trips controller | Exposes step 3 methods |
| 5 | Core trips swagger | Swagger decorators for step 4 |
| 6 | Lifecycle methods — `publish`, `pause`, `unpause`, `archive`, `remove` | Depends on step 3 foundation |
| 7 | Child model DTOs | Required before child service |
| 8 | Child model service — images | Most critical for publish validation |
| 9 | Child model service — highlights + inclusions | Publish block depends on highlight count |
| 10 | Child model service — translations | Publish block depends on EN overview |
| 11 | Child model service — schedules, age bands, add-ons, languages | No publish dependency |
| 12 | Child model controller | Expose all child services |
| 13 | Child model swagger | Documentation |

### Critical Rules to Verify Before Each Commit

- [ ] `@/` path alias used for all internal imports
- [ ] `select:` used in every Prisma query — no raw row returns
- [ ] `$transaction` wraps trip create + slug_registry write
- [ ] Hub validation runs before the transaction — fail fast with 400 before any DB writes
- [ ] No slug_registry write when `hubId` is set
- [ ] `slugRegistry.isActive = false` on archive (destination-only trips only)
- [ ] Publish checks ALL four blocks, collects all errors, returns them together
- [ ] Hero image change clears all other heroes in the same transaction
- [ ] English translation cannot be deleted (return 400 with explanation)
- [ ] English highlight text cannot be deleted (return 400)
- [ ] Static routes (`my-trips`, `translations`, `schedules`) come before `:id`/`:locale`/`:scheduleId` in the controller
- [ ] `this.logger.log(...)` on all state-changing operations
- [ ] `TOUR_OPERATOR` role has `CREATE_TRIP`, `EDIT_TRIP`, `VIEW_TRIPS`, `MANAGE_TRIPS`, `DELETE_TRIP` in `roles.config.ts` — verify and add if missing
- [ ] `resolveOperatorId` used before any DB write — never pass `user.id` directly as `operatorId`
- [ ] Admin auto-provisioning in `resolveOperatorId`: create operator record if Admin has none; throw 400 if Operator role has none
- [ ] `assertOwnership` bypasses check for `Role.ADMIN`
- [ ] Category change on LIVE trip returns `{ trip, warnings: [] }` — not a 4xx error — in Phase 4
