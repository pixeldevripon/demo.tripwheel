---
name: cancellation_correction_meta_wave_review
description: Review of feat/tracking-payload-completion uncommitted changes (Phase 3.1, cancellation correction pipeline, Meta half) - 2026-08-17
type: project
---

Reviewed uncommitted diff on `feat/tracking-payload-completion` (the payload-completion commit
was already reviewed separately - see `tracking_payload_completion_review.md`). Scope: new
`ConversionEvent` model + 3 enums + migration, `tracking.service.ts` refactor
(`postCapiEvent`/`hashedMetaUserData` extraction + `fireBookingCancelled`), `bookings.service.ts`
(`runMetaRefundJob` + `cancel()`'s new `booking.cancelled` outbox insert), queue/relay/processor
wiring, and all 4 spec files. Verified with `pnpm prisma:generate` + `npx tsc --noEmit` (clean)
+ full spec run (317/317 pass) + `npx prisma validate` (clean) - not just read-through.

**No critical or major correctness findings.** This is a clean, well-tested diff. Confirmed:
- `fireBookingComplete`'s Meta event body is byte-identical pre/post refactor (verified by
  reading the diff structurally, not just trusting the docblock claim).
- `ConversionEvent` model/migration is a byte-perfect match for the project's own Prisma
  conventions (PK/FK/index naming exactly matches `tour_pending_changes`'s migration;
  `Decimal(10,2)` matches every other money field in `bookings.prisma`; `onDelete: Cascade`
  matches `ReviewInvitation -> Booking`).
- Idempotency design executed correctly: deterministic `<publicRef>:refund` event id (Meta-side
  dedup) + deterministic relay `jobId` (`${aggregateId}__${jobName}` in
  `outbox-relay.service.ts`), deliberately no guard column - matches the documented
  "CAPI needs no column" pattern and is explicitly called out as a deviation in
  `AD-CONVERSION-TRACKING-PRD-CHECKLIST.md`'s Phase 3.1 note.
- `cancel()`'s new `booking.cancelled` outbox insert (bookings.service.ts ~3394-3407) composes
  cleanly with the pre-existing `booking.refund-owed` insert - two independent `if` blocks in the
  same `$transaction`, disjoint guard conditions (`refund === FULL` vs `conversionFiredAt !==
  null`), can fire together or independently, no interference.
- `runMetaRefundJob` actually uses a single `select`-scoped query (incl. nested
  `tour: { select: { name: true } }`) - cleaner Prisma hygiene than its sibling
  `runCapiConversionJob`, which still does `include: { unitItems: true }` + a second
  `tour.findUnique` round trip (pre-existing, untouched by this diff, but now a visible
  inconsistency between the two sibling jobs worth aligning if `runCapiConversionJob` is ever
  revisited).

**Minor findings (not blocking):**
1. Duplicated 3-line billing-address-preference block (`city: billingCity, postalCode:
   billingPostalCode ?? contactPostalCode, country: billingCountry ?? contactCountry`) between
   `fireConversion` (bookings.service.ts ~3269-3271) and `runMetaRefundJob` (~3316-3318). Small
   surface today, but it is a business rule (Stripe-billing-snapshot-first policy) that could
   silently drift if only one call site is updated later. A private
   `resolveTrackingAddress(booking)` helper would remove it.
2. `outboxEvent.create` payload for `booking.cancelled` carries `publicRef` and `refund`, but
   neither is read by any consumer - `jobsFor()` in `outbox-relay.service.ts` only reads
   `aggregateId`, and `runMetaRefundJob` re-derives `cancellationRefund` fresh from the DB by
   `bookingId`. Harmless (likely intentional for a human reading the `outbox_events` row during
   ops debugging) but inconsistent with the leaner `booking.refund-owed` payload (`{bookingId}`
   only) and with `booking.confirmed`'s payload (which IS consumed, for the reminder delay calc).
3. `recordEvent` writes `platform: 'META'` as a bare string literal instead of
   `ConversionPlatform.META`, inconsistent with the enum-typed `kind`/`status` fields set right
   next to it in the same object literal (both use the imported enum). Typechecks fine (Prisma 7
   generates the enum field type permissively) - pure consistency nit, not a compile bug.
4. `ConversionSendStatus` (enums.prisma) is the only one of the 3 new enums without a docblock
   comment - `ConversionPlatform` and `ConversionEventKind` both have one.
5. Test gaps (small): no test asserts `fireBookingCancelled` omits `cancellation_refund` from
   `custom_data` when `refund` is null/undefined; no test for the `error?.slice(0, 500)`
   truncation in `recordEvent`.

**Positive pattern worth reusing:** the `postCapiEvent`/`hashedMetaUserData` extraction in
`tracking.service.ts` is exactly the right shape for a shared-send-path refactor - one method
owns config-resolution + fetch + logging + audit-recording, callers only build the
platform-specific `event` object. Good template for the next CAPI event type (e.g. Google Ads
adjustment, PRD phase 3c).
