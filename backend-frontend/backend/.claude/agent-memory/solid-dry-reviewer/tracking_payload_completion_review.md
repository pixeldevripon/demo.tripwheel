---
name: tracking_payload_completion_review
description: Review of feat/tracking-payload-completion (booking_complete dataLayer contract, master 8.3) - 2026-08-17
type: project
---

Reviewed uncommitted changes on `feat/tracking-payload-completion`: `booking.dto.ts`
(new `BookingConversionClickIdsDto` + extended `BookingConversionDto`),
`bookings.service.ts` (`claimConversionPush` select + `buildConversionPayload`),
and its spec. Clean diff - no critical/major findings. All 8 relevant tests pass,
`tsc --noEmit` clean, field names verified byte-identical against the frontend
consumer (`frontend/lib/tracking/booking-complete.ts` + `lib/api/public/bookings.ts`).

**Confirmed correct (worth reusing as a template for future 8.3-style additions):**
- Select shape for the primary category (`categories: { where: { isPrimary: true },
  select: {...}, take: 1 }` on `Trip.categories`) is backed by the real
  `@@index([tourId, isPrimary])` in `tours.prisma` - efficient, not N+1 (single
  nested select inside one `findUnique`).
- `island`/`operatorId` are non-null in the schema (`bookings.prisma`) and correctly
  typed `@ApiProperty()` (required); `gclid/gbraid/wbraid/fbclid` are `String?` and
  correctly typed nullable both in the select-param type and the DTO.
- PII hashing is NOT duplicated: `computeHashedPii` from `pii-hash.util.ts` is
  called once and its output is reused for both `toGoogleUserData` (existing) and
  the new `userId` field (`hashed.email`) - exactly the "one hash pass serves every
  consumer" pattern the util's own docblock prescribes.

**Confirmed pre-existing project-wide DRY pattern (NOT introduced by this diff, but
perpetuated by it - flag once, fix broadly if ever revisited):** the Prisma select
shape `categories: { where: { isPrimary: true }, select: {...}, take: 1 }` for
"a tour's primary category" is now hand-duplicated in >= 6 places: `tours.service.ts`
(several spots), `octo/serializers/octo-tour.serializer.ts:35`,
`wishlist.service.ts:60`, `mail/next-adventure-emails.service.ts:100,124`, and now
`bookings.service.ts:5840`. A shared `primaryCategorySelect` Prisma select
fragment/helper would remove the duplication, but this is a repo-wide refactor, not
a fix for any single PR.

**Minor style note:** `operatorId!: string` and the 4 fields on
`BookingConversionClickIdsDto` use bare `@ApiProperty()/@ApiPropertyOptional()`
with no `example:` - matches the file's pre-existing baseline laxness (e.g.
`contentId`/`contentName` already lack examples too), so it's consistent with the
file as it stood, not a new regression.

**Minor test-coverage gap (not blocking):** no test exercises the `?? null`
fallback branches for `itemCategory` (empty/missing primary category) or
`operatorName` (operator with no `companyInfo`, or fully null `operator`) inside
`claimConversionPush`'s new fields - `pushable()` always populates both. Low risk
(defensive optional-chaining only), but worth adding if this file's tests are
revisited.
