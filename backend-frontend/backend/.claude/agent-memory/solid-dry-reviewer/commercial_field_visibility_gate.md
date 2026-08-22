---
name: commercial-field-visibility-gate
description: How ToursService gates commissionTier/tierKey/qualityScore visibility on the shared GET /tours/:id route - owner-operators are NOT neutralized
type: reference
---

`ToursService.findOne` (`backend/src/tours/tours.service.ts` ~2191-2262) is the ONE shared
`GET /tours/:id` route - both the public site and the dashboard hit it. It calls
`neutralizeForPublic` → `neutralizeApprovalFields` + `neutralizeCommercialFields`
(commissionTier/tierKey/tierRank/tierLockedUntil/qualityScore/eligibilityState/grace*) whenever
`!isPlatform && !isOwner`:
- `isPlatform` = ADMIN/STAFF/EDITOR
- `isOwner` = requester is TOUR_OPERATOR and `tour.operatorId === resolveOperatorId(requesterId)`

So the owning operator (and admin) get commercial fields populated; everyone else (anon, other
operators, USER) gets them nulled. `neutralizeCommercialFields` nulls rather than deletes so the
response DTO shape stays structurally valid.

**Why this matters for review**: when a dashboard feature reads `trip.commissionTier` (or any of
the other neutralized fields) off `useTrip`/`GET /tours/:id` and gates its own rendering on that
value being present, don't assume it needs its own role check or worry the value will be null for
the operator viewing their own trip - the backend route already guarantees it's populated for that
exact audience. Verified clean for dashboard issue #81 (net-price → "You keep" read-only line in
`age-bands-manager.tsx`, 2026-08-15): the line correctly renders for operators because `isOwner`
already covers them, mirroring the pre-existing pattern in `trip-promotion-tab.tsx` /
`step-reach.tsx` / `step-review.tsx` which read the same field with no extra guard.

Only worth re-checking this gate if someone adds a NEW commercial field to
`neutralizeCommercialFields`'s input type without also adding it to the null-out list (an easy silent
leak/omission), or if a future endpoint bypasses `findOne` and reads `tourSelect` directly without
calling `neutralizeForPublic` at all.
