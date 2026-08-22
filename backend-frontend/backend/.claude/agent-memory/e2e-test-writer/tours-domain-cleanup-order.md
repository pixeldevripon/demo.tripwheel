---
name: Tours Domain E2E Cleanup Order
description: FK-safe delete order for Tour/Hub/Category/Destination/Operator/User fixtures created directly via Prisma in tours-related e2e tests
type: project
---

`Tour.operatorId` and `Tour.destinationId` have **no `onDelete: Cascade`** on
the `Operator`/`Destination` side (default Postgres-restrict behavior) — you
cannot delete an Operator or Destination while a Tour still references it.
Every child model of Tour (images, highlights, inclusions, exclusions,
ageBands, features, locations, pickupLocations, addOns, languages,
translations, TourCategory, TourHub) DOES cascade on Tour delete, as does
`Departure`/`AvailabilitySchedule`/`AvailabilityException` (see
`prisma/availability.prisma`). `HubAllowedCategory` cascades on either Hub or
Category delete.

**Correct `afterAll` cleanup order for a shared test Destination:**
1. `prisma.tour.deleteMany({ where: { destinationId } })` — nukes everything tour-shaped.
2. `prisma.slugRegistry.deleteMany({ where: { destinationSlug } })` — tour deletes via raw
   Prisma (not the service's `remove()`) don't run `markSlugsDeleted`, so stale
   TOUR rows are left behind; sweep the whole destinationSlug to be safe.
3. `prisma.hub.deleteMany({ where: { id: hubId } })` — cascades HubAllowedCategory.
4. `prisma.category.deleteMany({ where: { id: { in: categoryIds } } })`.
5. `prisma.destination.delete({ where: { id: destinationId } })`.
6. `prisma.operator.deleteMany({ where: { userId: { in: userIds } } })`.
7. `prisma.user.deleteMany({ where: { id: { in: userIds } } })` — cascades Session/Account.

**Why this order matters:** reversing steps 1 and 5/6 (or 3/4) throws a Postgres
FK violation and the whole `afterAll` fails partway, leaking rows into the next
run. Wrap each step in its own try/catch so a single failure doesn't skip the
rest.

**Also:** `ToursService.remove()` lets ADMIN hard-delete a tour in ANY status
(the "must be ARCHIVED first" rule is skipped for `Role.ADMIN`) — so if you'd
rather clean up through the real API instead of raw Prisma, `DELETE
/api/v1/tours/:id` as the admin session works directly on LIVE/DRAFT/PAUSED
tours too, no need to archive first.
