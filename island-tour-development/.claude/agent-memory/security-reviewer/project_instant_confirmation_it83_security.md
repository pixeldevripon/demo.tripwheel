---
name: project_instant_confirmation_it83_security
description: Security review of Pastel #22 / dashboard #83 - instantConfirmation removed from tour write DTOs and dashboard checkbox
metadata:
  type: project
---

Reviewed 2026-08-16: backend `instant-confirmation-83` @ bf3b69b (diff vs pixelvega/prod) +
dashboard `instant-confirmation-83` @ 54987b6 (diff vs pixelvega/main). CLEAN - no
CRITICAL/MAJOR/MINOR findings.

**Why:** `instantConfirmation` never had a request-to-book flow behind its off state (no
pending-booking state machine, no emails, no seat-hold rules), and every consumer surface
promises instant confirmation. Field removed entirely from `CreateTourDto`/`UpdateTourDto`
(not just left `@IsOptional()`), both service write sites in `tours.service.ts` (create ~2831,
update ~3182), and the dashboard's `step-rules.tsx` toggle + `tripToUpdatePayload()` +
`CreateTripPayload`/`UpdateTripPayload` TS interfaces. Column stays (default true) - OCTO
serializer and derived-attributes.ts still read it, correctly (read-only, not a write path).
Migration `20260816090000_instant_confirmation_always_on` heals pre-existing `false` rows with
a plain parameterless UPDATE (no injection surface, table-scale-safe).

**How to apply:** This is the same "delete the field, don't just stop rendering it" pattern as
#81's `priceNet` removal (see [[project_booking_money_path_full_audit]] wave and
MASTER-CHECKLIST's #81 entry) - confirms the team's now-repeated remediation shape for
"field must never be client-writable" issues:
1. Remove the field from the DTO class entirely (relies on global `forbidNonWhitelisted` in
   `backend/src/main.ts:100-107`, verified still `whitelist:true` + `forbidNonWhitelisted:true`
   applied unconditionally at bootstrap - covers `@Public()` routes too since it's DTO
   validation, not an auth guard).
2. Remove both conditional-spread write sites in the service (`...(dto.field !== undefined && {...})`)
   rather than leaving them dead.
3. On the frontend/dashboard side, remove the field from the TS payload *interface*, not just
   the UI control - gives compile-time protection against a future caller resurrecting it.
4. Add a DTO spec that asserts the pipe's actual whitelist options (not a hand-rolled validator
   config) so the test can't drift from what `main.ts` really runs - see
   `backend/src/tours/dto/tour.dto.spec.ts`.
5. When auditing "is there any remaining write path," check OCTO/bulk/tiers/availability/reviews
   services too - grep for the field name across all of `backend/src`, and for any service that
   builds its Prisma `data:` from a raw body spread rather than named fields (none found here).

Recurring finding-free modules on this pass, reconfirmed: OCTO module has zero `tour.create/
update/updateMany` calls (read-only serialization only); `tiers.service.ts`, `availability.service.ts`,
`reviews.service.ts` all build `update` `data:` objects from explicit named fields, never a body
spread - no mass-assignment risk pattern present anywhere in these services as of this review.
