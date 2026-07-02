# Trip (tour) module

> **Canonical source:** master Appendix E.3 (tours), §2 (IA), §7 (tier columns). The tour entity,
> its relationships, fields, lifecycle, and ownership. Marks what is **built** vs **to add** against
> the current Prisma schema. Full field reference: [../02-architecture/DATA-MODEL.md](../02-architecture/DATA-MODEL.md).

A tour belongs to exactly **1 destination**, **1+ categories** (one `isPrimary`), and **0–n hubs**.
Its canonical URL is flat: `/{locale}/{destination}/{tour-slug}/`. The model entity is `Trip`
(`@@map("trips")`).

## Relationships (all built)

- **Categories** — `TourCategory(tripId, categoryId, isPrimary)`, unique `(tripId, categoryId)`.
  Exactly one row per tour has `isPrimary = true`; it drives the breadcrumb and the canonical's
  category variant. Multi-category overlaps are intentional (e.g. a sunset catamaran is
  `boat-tours` + `sunset-cruises`).
- **Hubs** — `TourHub(tripId, hubId)`. A hub is a **discovery tag with no URL effect**. Hub
  validation: the hub belongs to the tour's destination and at least one of the tour's categories is
  in the hub's `HubAllowedCategory` set.
- **Slug registry** — tour create **always** writes one `TOUR` row to `slug_registry`, in the same
  transaction. See [../02-architecture/SLUG-REGISTRY.md](../02-architecture/SLUG-REGISTRY.md).
- Children: `TourImage`, `TourAgeBand`, `TourAddOn`, `TourLanguage`, `TourHighlight`,
  `TourInclusion`, `TourExclusion` (+ their translations), `TourAttribute`, `TripTranslation`.

## Field groups (master E.3)

### Identity & routing — built
`id`, `title`, `slug` (unique per destination), `destinationId`, `operatorId`, `categories[]`,
`hubs[]`, `h1Override`, `breadcrumbLabel`, `departureCity` (drives the meta-row location label;
empty → island only).

### Localized content — built
Built: `overview`/`description` (via `TourTranslation`), highlights, inclusions, exclusions (via
child tables + translations). `shortDescription` (200, card/preview), `whatToBring`,
`knowBeforeYouGo`, `notSuitableFor`, `localTip`, `meetingPointText` are on `TourTranslation` and
upsertable via the trip-children translation endpoint. `TourExclusion` carries the master shape
`{label, type: paid_advance|paid_onsite|unavailable|not_permitted, priceText?}` (LD18). **To add:**
`categoryDisplay` (plural noun phrase for "More {x} in {destination}"). Highlights merge into the
Overview rendering (LD22) — a frontend render rule.

### Pricing & party — mostly built
Built: `pricingModel` (`per_person`/`unit`), `unitType` (`group`/`boat`/`vehicle`/`aircraft`/
`package`), `basePrice`, `priceFrom` (cached min), `ageBands[]`, `addOns[]`, `maxPartySize`,
`minPartySize` (default 1). **Reconcile naming** with master `price_adult`/`price_child`/
`price_infant` (document the mapping in DATA-MODEL.md). All party bands count toward capacity.

### Booking logic — built
Built: `bookingCutoffMinutes` (default 120, 0–10080), `pickupModel` (`included`/`paid_addon`/
`none`), `pickupRequired`, `durationMinutesFrom`/`durationMinutesTo`. `cancellationHours` is
enum-bound `[24,48,72,168]`, **default 48**, NOT NULL (DTO `@IsIn`, service default 48 — master
rule #20). `paymentModel` (`operator_link`/`on_arrival`/`paid_in_full`/`operator_full`),
`instantConfirmation`, `bookingType` (private/shared), `meetingPointLat`/`meetingPointLng`,
`departureCity` are operator-writable on trip create/update; localized `meetingPointText` lives on
`TourTranslation`. `depositPct` is surfaced read-only (tier-driven). **To add:** `startTimes[]`
(slot template — deferred to the availability phase). See
[../02-architecture/BOOKING-AND-PAYMENTS.md](../02-architecture/BOOKING-AND-PAYMENTS.md).

### Flags & accessibility — built
`minAgeYears`, `fitnessLevel` (easy default/moderate/challenging), `weatherDependent`,
`wheelchairAccessible`, `familyFriendly`, `suitableForBeginners` are operator-writable on trip
create/update; `isLocalsFavourite` (manual editorial flag, single source for every Locals' favorite
surface, ~30% target, never tier-linked) is update-only. `guideLanguages[]` built via `TourLanguage`.

### Commercial tier — to add (master §7)
`commissionTier`, `tierKey`, `tierRank`, `tierLockedUntil`, `qualityScore`, `firstPublishedAt`,
`eligibilityState` (`eligible`/`provisional`/`grace`/`demoted`) + `graceStartedAt`/`graceMetric`,
`isBookable`. See [../02-architecture/COMMERCIAL-MODEL.md](../02-architecture/COMMERCIAL-MODEL.md).

### Computed (read-only)
`aggregateRating`, `reviewCount`, `ratingDistribution[]`, `photoReviewCount`, `bookingCount` (+
`bookingCountToday`, `spotsRemaining`, `lastBookedAt` — present, no consumer urgency surface in v1),
`qualityScore` (nightly). Render thresholds: rating at ≥3 reviews (LD11 fallback below 3); sort/
filter gates at 10/20 (LD30).

## Availability

The simple `TourSchedule` model (startDate/endDate/startTime/totalSpots/availableSpots/status) is
**superseded** by the schedules + exceptions + departures model. See
[../02-architecture/AVAILABILITY-AND-DEPARTURES.md](../02-architecture/AVAILABILITY-AND-DEPARTURES.md).
`start_times[]` on the tour is the slot template the schedules switch on per weekday. Single-day
tours only in v1 (LD25).

## Lifecycle & publish guard

Lifecycle: `DRAFT → LIVE ⇄ PAUSED → ARCHIVED` (+ restore). Publish guard enforces the listing
requirements: ≥5 images with a hero, English overview, ≥3 highlights, a price, and a
free-cancellation window present (`cancellation_hours`, listing requirement per master §6.2).
Tour status changes re-run the category ≥3 gating check in both directions (see
[../02-architecture/ROUTING-AND-RESOLUTION.md](../02-architecture/ROUTING-AND-RESOLUTION.md)).

## Ownership

`trips.operatorId` is a FK to `operators.id`, not `users.id`. The service resolves the caller's
`user.id` → `operator.id` (`resolveOperatorId`) before any write or ownership check. `ADMIN` bypasses
ownership (manage any tour) and is auto-provisioned an operator record on first create; a
`TOUR_OPERATOR` with no operator record gets a 400. See
[../05-access-management/ROLES-AND-ACCESS-MANAGEMENT.md](../05-access-management/ROLES-AND-ACCESS-MANAGEMENT.md).
