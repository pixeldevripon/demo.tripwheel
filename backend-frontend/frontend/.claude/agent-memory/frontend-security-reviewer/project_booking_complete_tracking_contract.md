---
name: project-booking-complete-tracking-contract
description: Security baseline for the TYP booking_complete dataLayer push (master 8.3) - verified-gate, mark-first, explicit composition, type-only import boundary
metadata:
  type: project
---

Audited on branch `feat/tracking-payload-completion` (2026-08-17): `frontend/lib/api/public/bookings.ts`
(`TypConversion`/`ConversionClickIds`), `frontend/lib/tracking/booking-complete.ts`
(`BookingCompleteEvent`, `compactClickIds`, `pushBookingComplete`), and its new test file. Extended the
payload with `bookingRef`, `operatorId`/`operatorName`, `island`, `itemCategory`, `userId` (SHA-256
email hash), `clickIds`. **Verdict: clean, no findings.**

Why clean, the four things to re-check on the NEXT change to this area:

1. **Verified-gate is upstream, not in these files.** `app/(frontend)/[locale]/[destination]/thank-you/[publicRef]/page.tsx:127` only calls
   `claimConversionPush` when `booking.verified` is true; backend `bookings.service.ts:5858`
   re-checks `verified` and mark-firsts via `conversionPushedAt` (line ~5877). So every field added
   to the payload is scoped to "the verified booker's own confirmed booking, once." A future field
   addition doesn't need to re-derive this gate, but a change that calls `claimConversionPush`
   from a masked/unverified path would blow it up - check the call site, not just the payload shape.
2. **No new exposure class**: `bookingRef`/`operatorName`/`island` mirror what the verified TYP
   already renders in the DOM (displayRef, operator contact card, destination in URL); `userId` is
   the same SHA-256 hash already inside `userData.sha256_email_address`, just promoted to a top-level
   GA4 key; `clickIds` (gclid/gbraid/wbraid/fbclid) are values the ad network that generated the click
   already possesses - pushing them to GTM (which fires Google Ads/Meta pixels) is the point of the
   feature, not a leak. A field is only a NEW finding here if it exposes something the verified
   traveller couldn't already see on their own TYP page, or something a party other than the booker
   could read.
3. **Composition is explicit end to end, not mass-assignment.** Backend `buildConversionPayload`
   (`backend/src/bookings/bookings.service.ts:5893`) builds `BookingConversionDto` field-by-field from
   a typed subset of the booking row. Frontend `BookingCompleteEvent` (`booking-complete.ts:49`) is a
   closed interface, and `compactClickIds` (`booking-complete.ts:82`) iterates a fixed
   `['gclid','gbraid','wbraid','fbclid'] as const` tuple, not `Object.keys(ids)`. Any future spread
   of a raw server object (`...conversion`) into the dataLayer event would be the regression to flag.
4. **The server/client line is a type-only import**, not a runtime one: `booking-complete.ts:8` does
   `import type { ConversionClickIds, ConversionUserData, TypConversion } from '@/lib/api/public/bookings'`
   - erased at compile time, so `bookings.ts`'s `import 'server-only'` (line 11) never reaches the
   client bundle even though `bookings.ts` itself is never imported for its runtime exports here. If a
   future edit changes any of those three imports from `import type` to a value import, that's the
   thing that breaks this guarantee - check for it specifically.
5. **Sink is `window.dataLayer.push(event)` only** (`booking-complete.ts:142`) - a JS array push, not
   an HTML/DOM/eval sink, so attacker-influenced string values (operator name, category name) sitting
   in the object pose no XSS risk here even though the same values WOULD need escaping if they ever
   landed in a `dangerouslySetInnerHTML` `<script>` block (that's the JSON-LD builder pattern, a
   different code path - see the "Injection and XSS sinks" audit lens for that class).

See also [[project_context]] for the wider Island Tours frontend security model (traveler session
scopes, cache-key-per-traveller, route-handler CSRF).
