# Memory Index

- [Tours pricing-model test coverage](project_tours_pricing_model_tests.md) — 2026-07-15 UNIT vs PER_PERSON tests added to tours.service.spec.ts/tours-children.service.spec.ts; where the branching logic lives + one gotcha (recomputePriceFrom double-call in update tests, assertNotUnitPriced hits real prisma not the mocked ToursService)
- [Staff & Teams module test coverage](project_staff_module_tests.md) — 2026-07-19 66 tests across staff.config/staff-permissions.service/staff.service/permissions.guard; auth.instance mock recipe + resolveTeamOperatorId gotcha + pre-existing bookings.service.spec ADMIN_EMAIL flake (not caused by this work)
