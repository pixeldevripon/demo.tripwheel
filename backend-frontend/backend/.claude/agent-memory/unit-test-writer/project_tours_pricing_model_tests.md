---
name: project_tours_pricing_model_tests
description: Coverage added 2026-07-15 for UNIT vs PER_PERSON pricing-model rules in tours.service.spec.ts / tours-children.service.spec.ts
metadata:
  type: project
---

Added unit tests (no source changes) for the pricing-model split (UNIT whole-unit/charter
vs PER_PERSON age-band) across `src/tours/tours.service.ts` and
`src/tours/tours-children.service.ts`. All green: 202/202 in `src/tours`, 860/860 full suite.

**Where the logic lives** (for next time these rules change):
- `ToursService.recomputePriceFrom` (~line 374): UNIT anchors priceFrom on `basePrice` and
  never queries `TourAgeBand`; PER_PERSON queries the cheapest
  `BandParticipation.PARTICIPANT` band, falling back to `basePrice`.
- `ToursService.findAll` (~line 688): minPrice/maxPrice filter `where.priceFrom`, never
  `where.basePrice` - the same `where` object is passed to both `prisma.tour.count` and
  `prisma.tour.findMany` (grep confirmed at lines 489/490, 736/737, 999/1000, 1056).
- `ToursService.create` (~line 1655) / `update` (~line 1876): unit fields
  (wholeUnitType/unitIncludedGuests/extraPersonPrice) are force-nulled for PER_PERSON and
  applied for UNIT; `update`'s branch uses the *effective* model
  (`dto.pricingModel ?? tour.pricingModel`), so "no model change while already UNIT" still
  applies field updates.
- `ToursService.publish` (~line 2085): UNIT requires `basePrice` AND `wholeUnitType`
  (two separate error strings); PER_PERSON requires `basePrice` OR at least one age band
  (`tour._count.ageBands`). The UNIT branch never touches `_count`, so UNIT publish tests
  don't need to stub `_count.ageBands`.
- `TourChildrenService.addAgeBand` -> private `assertNotUnitPriced` (~line 372): a plain
  `this.prisma.tour.findUnique({ select: { pricingModel: true } })` call, NOT delegated to
  the mocked `ToursService`. In `tours-children.service.spec.ts` this means
  `prisma.tour.findUnique` must be stubbed per-test (existing pre-change tests worked by
  accident because an un-stubbed `jest.fn()` resolves to `undefined`, and
  `tour?.pricingModel` optionally-chains past that -> defaults to the PER_PERSON-allowed path).

**Gotcha for future edits in this file**: `tours.service.spec.ts`'s `describe('update', ...)`
tests that set `dto.pricingModel` (or `dto.basePrice`) trigger a second, real call to
`recomputePriceFrom` after the transaction (service line ~2063). That call reuses whatever
`prisma.tour.findUnique` was mocked to return for the *original* find (mock persists across
calls unless you use `mockResolvedValueOnce`), so it doesn't reflect the "just updated"
pricing model - harmless for these tests (no assertion depends on it) but worth knowing before
asserting on a second `prisma.tour.update` call in that flow.
