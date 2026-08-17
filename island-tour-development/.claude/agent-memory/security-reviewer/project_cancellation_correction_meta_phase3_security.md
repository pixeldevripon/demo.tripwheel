---
name: cancellation_correction_meta_phase3_security
description: Security review of the Meta-refund cancellation-correction pipeline (Phase 3.1) on feat/tracking-payload-completion — CLEAN, no findings
type: project
---

Reviewed 2026-08-17: uncommitted working-tree changes on `feat/tracking-payload-completion`
adding the cancellation-correction half of Phase 3 (ad-conversion PRD) — `booking.cancelled`
outbox event, `tracking.meta-refund` job, `TrackingService.fireBookingCancelled` (Meta CAPI
`Refund` event), and the new `conversion_events` audit table. **Confirmed CLEAN — no
critical/high/medium findings.**

What was checked and why it holds:
- **Outbox insert is inside the existing authorized path.** `cancel()` in
  `backend/src/bookings/bookings.service.ts` computes `heldOnly` (ON_HOLD, or CANCELLED-without-
  ever-confirming) BEFORE the role check; for `!heldOnly` it throws `UnauthorizedException`/
  `ForbiddenException` unless `actor.role === Role.ADMIN`. The new `booking.cancelled` outbox
  write is gated `if (!heldOnly && conversionFiredAt !== null)`, so an unauthenticated `@Public`
  caller can only ever reach `heldOnly === true`, where `conversionFiredAt` is always null (a
  held/never-confirmed booking never fired a conversion). No path for an anonymous caller to
  trigger the ad-platform correction.
- **No forgery via outbox payload.** The outbox row's `payload` (`bookingId`, `publicRef`,
  `refund`) is never read by the relay or the job — `outbox-relay.service.ts` `case
  'booking.cancelled'` only forwards `{ bookingId: aggregateId }`. `runMetaRefundJob` re-fetches
  the booking fresh from Postgres and re-validates `status === CANCELLED`,
  `conversionFiredAt !== null`, `commissionAmount != null` (throws `UnrecoverableError` on null
  commission — data-corruption fail-loud, matches the existing `runCapiConversionJob` pattern).
  A hand-replayed/redelivered job is safe by construction.
- **No user-controlled free text reaches the CAPI body or the audit row.** `dto.reason` /
  `cancellationReason` is never passed into `BookingCancelledPayload` or the outbox payload. The
  only enum-ish value that rides along is `cancellationRefund` (FULL/PARTIAL/NONE, server-computed
  by `computeRefund`), sent as Meta `custom_data.cancellation_refund` — not attacker-influenced
  content, and JSON-stringified so no injection risk regardless.
- **PII: no more exposure than the existing Purchase event.** `fireBookingCancelled` uses the
  same `hashedMetaUserData` (SHA-256 one-pass util) as `fireBookingComplete`; `BookingCancelledPayload`
  deliberately omits `clickId`/`eventSourceUrl` (action_source is `system_generated`, not `website`).
  `conversion_events.error` (truncated to 500 chars in `TrackingService.recordEvent`) can only ever
  echo back non-PII fields, since every PII field sent to Meta is already hashed before the
  request — even if Meta's error text echoed a bad-value complaint, there's no raw PII in the
  outbound body for it to echo.
- **Access-token-in-URL pattern (`postCapiEvent`, `tracking.service.ts`) is pre-existing, unchanged
  by this diff** — it's a straight extraction of code that already lived in `fireBookingComplete`.
  Not a new finding; still worth fixing generally (query-string secrets end up in
  access/proxy logs) but out of scope for this diff per the review's own instruction to flag
  only regressions.
- **Migration `20260817080000_conversion_events_audit`** is purely additive (2 new enums, 1 new
  table + 2 indexes + 1 FK with `ON DELETE CASCADE` to `bookings`) — no destructive statement,
  safe for `prisma migrate deploy` on prod. No naming collision with prior migrations.

How to apply: if Phase 3 later adds the Google Ads adjustment leg (mentioned as "phase 3c" in
`outbox-relay.service.ts` comments) or a GA4 sender, re-check the same three invariants: (1) outbox
write stays inside the `!heldOnly`+authorized branch, (2) the job re-validates state from the DB
rather than trusting outbox/job payload, (3) no free-text traveler input (reason/notes) crosses
into the third-party payload.
