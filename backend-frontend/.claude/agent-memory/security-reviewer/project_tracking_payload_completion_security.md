---
name: project_tracking_payload_completion_security
description: Security review of the expanded booking_complete conversion payload (bookingRef, island, operatorId, operatorName, itemCategory, userId email-hash, clickIds) on POST /bookings/typ/:publicRef/conversion, branch feat/tracking-payload-completion
type: project
---

Reviewed 2026-08-17 (uncommitted, branch `feat/tracking-payload-completion`): backend
`bookings/dto/booking.dto.ts`, `bookings.service.ts` (`claimConversionPush` +
`buildConversionPayload`), `bookings.service.spec.ts`. New fields added to the
`booking_complete` conversion DTO: `bookingRef` (displayRef), `island`, `operatorId`,
`operatorName`, `itemCategory` (primary category name), `userId` (SHA-256 of lowercased
contact email), `clickIds { gclid, gbraid, wbraid, fbclid }`.

**Result: CLEAN, no CRITICAL/HIGH/MEDIUM findings.**

1. **Gating order untouched**: the diff only added fields to the existing Prisma `select`
   and to `buildConversionPayload`'s literal return object - it did not touch the
   verification/guard sequence. `claimConversionPush` (bookings.service.ts ~5854-5883) still
   checks `sessionOwnsBooking(verifyTravelerSession(sessionToken), ...)` FIRST (returns
   `{ conversion: null }` on failure, before any Prisma `updateMany` and before
   `buildConversionPayload` is ever called), then CONFIRMED-status + non-null-commission,
   THEN the mark-first `updateMany({ where: { conversionPushedAt: null } })` guard, and only
   the mark-first winner gets the built payload. Controller/`traveler-session.util.ts`/module
   have zero diff. Pre-existing spec `'never fires for a bare (unverified) link and does NOT
   burn the guard'` (line ~3628) still covers this and still passes for the same reason - the
   new fields never sit on a codepath that runs before the guard.
2. **Click IDs**: `AttributionDto` (booking.dto.ts ~1390) already enforces
   `@IsString() @MaxLength(512)` on gclid/gbraid/wbraid/fbclid at reserve time (unchanged by
   this diff). They are stored via parameterized Prisma writes, sent to Meta CAPI as a JSON
   body field (`tracking.service.ts` ~111, `userData.fbc`), and now also returned as JSON in
   this response - all three sinks are JSON/parameterized, not string-interpolated, so no
   injection or log-forging vector; grepped for logger calls touching these fields, found
   none. No character-set restriction beyond length exists, but no sink cares.
3. **userId (email hash)**: literally the same `hashed.email` value already present as
   `userData.sha256_email_address` in the same payload (`pii-hash.util.ts` `computeHashedPii`
   -> unsalted lowercased-trimmed SHA-256, per Google/Meta Enhanced-Conversions spec). Adding
   `userId` duplicates an existing crossing, it does not create a new one - no raw PII newly
   exposed.
4. **IDOR/enumeration via new relations**: `operator.companyInfo.companyName` and
   `tour.categories[isPrimary].category.name` are already public today (same `companyName`
   select pattern appears on public tour-detail responses in `tours.service.ts`; category
   names are public dictionary/taxonomy). `operatorId` is already on the public
   `CreateTourResponseDto`/tour DTO (`tour.dto.ts:78`). `island` is just the destination slug
   the booker already knows. None of this is a new exposure, and the booking's own
   `operatorId`/`tourId` were already selectable pre-diff.
5. **Rate limiting unchanged**: controller `@Throttle` (3/10s, 5/60s, 20/hr) and
   `targetLimiter.consume('conversion-push', publicRef, [{ max: 5, windowMs: 60_000 }])` both
   have zero diff.

Explicit-allow-list construction pattern worth reusing: `buildConversionPayload` hand-builds
the return object field-by-field rather than spreading the Prisma row, so adding columns to
the `select` can never leak an unlisted field into the response even if someone later adds
more columns to the select without updating the DTO.

See also [[project_booking_money_path_full_audit]] for the broader booking money-path audit
this endpoint's mark-first pattern descends from, and [[project_wallet_checkout_wave3_security]]
for the most recent sibling review's confirmed-clean format.
