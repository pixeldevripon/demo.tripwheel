---
name: coverage-map
description: Which backend service files have spec files and what business logic each covers
metadata:
  type: reference
---

## Spec files that exist (as of 2026-05-30)

| Source file | Spec file | Key scenarios covered |
|---|---|---|
| trips/trips.service.ts | trips/trips.service.spec.ts | resolveOperatorId, assertOwnership, resolveUniqueSlug, create (slug_registry write/skip), publish readiness guards, pause/unpause/archive/restore/remove lifecycle, update warnings |
| trips/trips-children.service.ts | trips/trips-children.service.spec.ts | assertTripAccess delegation, getSchedules auth matrix, all CRUD children, English-delete guards, P2002/P2025 handling |
| destinations/destinations.service.ts | destinations/destinations.service.spec.ts | Full CRUD, translations, page content, FAQs, slug registry seeding |
| categories/categories.service.ts | categories/categories.service.spec.ts | |
| hubs/hubs.service.ts | hubs/hubs.service.spec.ts | |
| operators/operators.service.ts | operators/operators.service.spec.ts | |
| users/user.service.ts | users/user.service.spec.ts | |
| settings/settings.service.ts | settings/settings.service.spec.ts | |
| media-gallery/media-gallery.service.ts | media-gallery/media-gallery.service.spec.ts | |

## Total test counts (trips module, 2026-05-30)
- trips.service.spec.ts: 80 tests
- trips-children.service.spec.ts: 89 tests
- Combined: 169 passing
