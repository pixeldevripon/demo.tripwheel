# Trip Module — Step-by-Step Implementation Plan

> Phase 4 scope: Core trip CRUD + all child models + lifecycle transitions.
> Slot system is Phase 5. Upload module (Cloudinary) is a parallel Phase 4 track.
> Reference: `TRIP_MODULE_ARCHITECTURE.md` for business rules.

---

## File Structure to Create

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

---

## Route Table

### Core Trip Routes (`trips.controller.ts`)

| Method | Path | Auth | Permission | Description |
|--------|------|------|-----------|-------------|
| GET | `/trips` | Public | — | Live trips with filters |
| GET | `/trips/my-trips` | Operator | `VIEW_TRIPS` | Own trips all statuses |
| GET | `/trips/:id` | Optional | `VIEW_TRIPS` | Single trip detail |
| POST | `/trips` | Operator | `CREATE_TRIP` | Create draft |
| PATCH | `/trips/:id` | Operator/Admin | `EDIT_TRIP` | Update core fields |
| POST | `/trips/:id/publish` | Operator | `MANAGE_TRIPS` | DRAFT → LIVE |
| POST | `/trips/:id/pause` | Operator | `MANAGE_TRIPS` | LIVE → PAUSED |
| POST | `/trips/:id/unpause` | Operator | `MANAGE_TRIPS` | PAUSED → LIVE |
| POST | `/trips/:id/archive` | Operator/Admin | `MANAGE_TRIPS` | → ARCHIVED |
| DELETE | `/trips/:id` | Operator | `DELETE_TRIP` | Delete DRAFT only |

> Static routes (`my-trips`) MUST come before dynamic (`:id`) in the controller class — NestJS matches top-to-bottom.

### Child Model Routes (`trips-children.controller.ts`)

All routes are nested under `/trips/:tripId/...`

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

---

## Step 1 — Module Scaffold

**File: `trips/trips.module.ts`**

```typescript
@Module({
  controllers: [TripsController, TripChildrenController],
  providers: [TripsService, TripChildrenService],
  exports: [TripsService],  // SlotsService will need this in Phase 5
})
export class TripsModule {}
```

**Add to `AppModule.imports`:** `TripsModule`

No need to import `PrismaModule` — `PrismaService` is `@Global()`.

---

## Step 2 — Core Trip DTOs (`dto/trip.dto.ts`)

### Response DTOs

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

### Query DTOs

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

### Request DTOs

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
  // Same fields as Create except destinationId/categoryId/hubId are not here
  // (destination change is not allowed; category change in Phase 5 adds guard)
  // Omit: destinationId, categoryId, hubId, slug
  // All fields optional with @IsOptional()
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

---

## Step 3 — Core Trips Service (`trips.service.ts`)

### Select Shape (private constant)

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

### Service Methods

**`create(dto: CreateTripDto, operatorId: string)`**

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

**`findAll(query: TripQueryDto)`**

```
Build where: { status: LIVE, isActive: true }
  + optional destinationId, categoryId, hubId, pricingModel
  + optional basePrice gte/lte filter
Paginate, orderBy: publishedAt desc
Select: tripSelect + images(hero only) + schedules(count) for preview
```

**`findMyTrips(operatorId: string, query: MyTripsQueryDto)`**

```
where: { operatorId, ...(status filter) }
Include: _count for images, schedules, highlights, inclusions
```

**`findOne(id: string, requesterId: string | null, requesterRole: Role | null)`**

```
Fetch full trip
If status !== LIVE:
  If requester is null → 404
  If requester is not owner AND not ADMIN → 403
Return trip with _count for child models
```

**`update(id: string, dto: UpdateTripDto, requesterId: string, requesterRole: Role)`**

```
Fetch trip
assertOwnership(trip, requesterId, requesterRole)
If status === ARCHIVED → throw 400 "Cannot update an archived trip"
Update fields (omit slug, destinationId, categoryId, hubId)
```

**`publish(id: string, operatorId: string)`**

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

**`pause(id: string, operatorId: string)`**

```
Fetch trip
If trip.operatorId !== operatorId → 403
If trip.status !== LIVE → 400 "Trip must be LIVE to pause"
Update status = PAUSED
// Phase 5 hook: if trip.featuredSlot → SlotsService.releaseSlot()
logger.log(...)
```

**`unpause(id: string, operatorId: string)`**

```
Fetch trip
If trip.operatorId !== operatorId → 403
If trip.status !== PAUSED → 400 "Trip must be PAUSED to unpause"
Update status = LIVE
logger.log(...)
```

**`archive(id: string, requesterId: string, requesterRole: Role)`**

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

**`remove(id: string, operatorId: string)`**

```
Fetch trip
If trip.operatorId !== operatorId → 403
If trip.status !== DRAFT → 400 "Only DRAFT trips can be deleted"

prisma.$transaction:
  a. If trip.hubId === null: delete slugRegistry row
  b. Delete trip (Prisma cascades child models)
logger.log(...)
```

---

## Step 4 — Core Trips Controller (`trips.controller.ts`)

```typescript
@ApiTags('Trips')
@Controller('trips')
export class TripsController {
  // ORDER: static routes before dynamic :id
  @Get()          @ApiGetAllTripsDocs()           getAll(@Query() q: TripQueryDto) {}
  @Get('my-trips') @ApiGetMyTripsDocs()  @RequirePermissions(Permission.VIEW_TRIPS) getMyTrips(...) {}
  @Post()          @ApiCreateTripDocs()  @RequirePermissions(Permission.CREATE_TRIP) create(...) {}
  @Get(':id')      @ApiGetTripByIdDocs()            getById(@Param('id') id: string, @Req() req) {}
  @Patch(':id')    @ApiUpdateTripDocs()  @RequirePermissions(Permission.EDIT_TRIP)   update(...) {}
  @Post(':id/publish') @ApiPublishTripDocs() @RequirePermissions(Permission.MANAGE_TRIPS) publish(...) {}
  @Post(':id/pause')   @ApiPauseTripDocs()   @RequirePermissions(Permission.MANAGE_TRIPS) pause(...) {}
  @Post(':id/unpause') @ApiUnpauseTripDocs() @RequirePermissions(Permission.MANAGE_TRIPS) unpause(...) {}
  @Post(':id/archive') @ApiArchiveTripDocs() @RequirePermissions(Permission.MANAGE_TRIPS) archive(...) {}
  @Delete(':id')   @ApiDeleteTripDocs()  @RequirePermissions(Permission.DELETE_TRIP) remove(...) {}
}
```

Use `import type { TypedAuthUser, AuthenticatedRequest }` from `@/auth/auth.types`.
Pass `user.id` and `user.role` to service methods that need ownership checks.

---

## Step 5 — Core Trips Swagger (`trips.swagger.ts`)

One decorator function per endpoint. Follow the exact pattern from `categories.swagger.ts`:

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

---

## Step 6 — Child Model DTOs (`dto/trip-children.dto.ts`)

### Image DTOs

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

### Age Band DTOs

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

### Add-On DTOs

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

### Highlight DTOs

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

### Inclusion DTOs

```typescript
export class CreateTourInclusionDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) label!: string; // English
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) icon?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) displayOrder?: number;
}
```

### Trip Translation DTOs

```typescript
export class UpsertTripTranslationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000) overview?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isMachineTranslated?: boolean;
}
```

### Schedule DTOs

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

---

## Step 7 — Child Model Service (`trips-children.service.ts`)

### Common pattern — helper

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

### Images

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

### Highlights

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

### Trip Translations

**`upsertTranslation(tripId, locale, dto, requesterId, requesterRole)`**

```
assertTripAccess(...)
upsert TripTranslation { tripId, locale }
If locale === 'en' and dto.title → also update Trip.name? 
  → No: Trip.name stays as canonical English name; TripTranslation.title is the override display title
```

**`deleteTranslation(tripId, locale, requesterId, requesterRole)`**

```
assertTripAccess(...)
If locale === 'en' → 400 "English translation cannot be deleted. Update the overview field to null instead."
Delete TripTranslation row
```

### Schedules

**`createSchedule(tripId, dto, requesterId, requesterRole)`**

```
assertTripAccess(...)
Create TourSchedule { tripId, availableSpots: dto.totalSpots, ... }
// Phase 5 hook: schedule BullMQ pre-booking job at (startDate - 24h)
Return schedule
```

---

## Step 8 — Child Model Controller (`trips-children.controller.ts`)

```typescript
@ApiTags('Trip Children')
@Controller('trips/:tripId')
export class TripChildrenController {
  // Images
  @Get('images')     @RequirePermissions(Permission.VIEW_TRIPS) getImages(...)
  @Post('images')    @RequirePermissions(Permission.EDIT_TRIP)  addImage(...)
  @Patch('images/:imageId') @RequirePermissions(Permission.EDIT_TRIP) updateImage(...)
  @Delete('images/:imageId') @RequirePermissions(Permission.EDIT_TRIP) removeImage(...)

  // Age Bands
  @Get('age-bands')  ...
  @Post('age-bands') ...
  // etc.
  
  // Highlights — ordered with static before dynamic
  @Get('highlights') ...
  @Post('highlights') ...
  @Patch('highlights/:highlightId') ...
  @Delete('highlights/:highlightId') ...
  @Put('highlights/:highlightId/translations/:locale') ...
  @Delete('highlights/:highlightId/translations/:locale') ...
  
  // Translations
  @Get('translations') ...
  @Get('translations/:locale') ...
  @Put('translations/:locale') ...
  @Delete('translations/:locale') ...
  
  // Schedules
  @Get('schedules') ...
  @Post('schedules') ...
  @Patch('schedules/:scheduleId') ...
  @Delete('schedules/:scheduleId') ...
}
```

---

## Step 9 — Child Model Swagger (`trips-children.swagger.ts`)

One function per endpoint using `applyDecorators`. Follow the same pattern as step 5.

---

## Step 10 — Register in AppModule

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

---

## Implementation Order (Recommended Execution Sequence)

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

---

## Checklist — Critical Rules to Verify Before Each Commit

- [ ] `@/` path alias used for all internal imports
- [ ] `select:` used in every Prisma query — no raw row returns
- [ ] `$transaction` wraps trip create + slug_registry write
- [ ] Hub validation runs inside the same transaction as trip creation
- [ ] No slug_registry write when `hubId` is set
- [ ] `slugRegistry.isActive = false` on archive (destination-only trips only)
- [ ] Publish checks ALL four blocks, collects all errors, returns them together
- [ ] Hero image change clears all other heroes in the same transaction
- [ ] English translation cannot be deleted (return 400 with explanation)
- [ ] English highlight text cannot be deleted (return 400)
- [ ] Static routes (`my-trips`, `translations`, `schedules`) come before `:id`/`:locale`/`:scheduleId` in the controller
- [ ] `this.logger.log(...)` on all state-changing operations
- [ ] `TOUR_OPERATOR` role has `CREATE_TRIP`, `EDIT_TRIP`, `VIEW_TRIPS`, `MANAGE_TRIPS`, `DELETE_TRIP` in `roles.config.ts` ← verify and add if missing
