# Local Date/Time vs UTC Conversation

## User Question

see my backend apis and prisma models '/Users/devripon/devripon/Final  Running Project/island-tour-development/backend/prisma''/Users/devripon/devripon/Final  Running Project/island-tour-development/backend/src'

this is tours and travels maanegment application for carrebian island. destination like curacao, aruba, sint marteen. 

now the question is, in this applciation exactly where i need to manage local date time rather than utc time. my understanding in availabity and departure. like when a user create a tour from dashboard and update schedules like tour destination is cuaracao and schedules is every tuesday 9.00 am. so this schedules is must maintain the curacao local time. same thing for when booking happen and invoice and others option you will help me to understand very very clearly. i need to understand this complete concept very clearly. then analysing my code tell me that my implementation is wrong or right and whats the gap i need to handle?

## Assistant Investigation Updates

I’ll inspect the Prisma schema and backend modules around tours, availability, bookings, payments, destinations, and any date handling utilities. Then I’ll separate the domain concept from what your code currently does.

I found dedicated `availability`, `bookings`, `payments`, `reviews`, and `timezone.util` code, plus timezone fields on destinations/tours. I’ll read those specific files now instead of scanning the whole repo output.

The schema already models destination-local schedule concepts: `@db.Date`, `@db.Time`, `Tour.timeZone`, and booking snapshots. The key question is whether services consistently keep wall-clock schedule time separate from absolute UTC timestamps.

So far, the availability materializer looks intentionally designed around destination-local wall-clock dates and times, while lifecycle fields use real UTC instants. I’m checking the rest of booking cancellation/expiry/mapping now because that’s where local and UTC often get mixed.

There’s one likely implementation issue already: the code stores `tourStartDateTime` as a fake `Z`-labelled local wall time but exposes it as an ISO string. That is fine only if every consumer knows it is not a real UTC instant; otherwise invoices, emails, calendars, and reminders can display the wrong time.

I’m also checking tour creation/update because the source of truth for timezone should normally be the destination, not a free-form operator choice. If this is weak, all later availability math can be correct but anchored to the wrong island clock.

The tour creation path derives `Tour.timeZone` from the destination, which is good. Tour update currently allows `timeZone` to be changed directly with only string validation; destination timezone also accepts any string. That is a real gap because one bad IANA value breaks local-now calculations.

I have enough to answer the architecture question and code review. I’m not changing files in this turn because you asked for understanding and analysis, not an implementation patch.

## Assistant Explanation

Your understanding is correct: availability and departures must be managed in the destination’s local wall-clock time. But the full rule is broader:

**Use destination-local time for “when the customer experiences the tour.” Use UTC for “when the system event happened.”**

For your app, that means:

| Area | Correct time model |
|---|---|
| Weekly schedule: “Every Tuesday 09:00” | Destination-local wall time |
| Availability exception: “Closed on 2026-08-12” | Destination-local date |
| Departure inventory: “2026-08-12 at 09:00” | Destination-local date + local time |
| Booking cutoff: “stop booking 2 hours before 09:00 Curaçao time” | Compare against destination-local now |
| Cancellation window: “free until 48 hours before tour starts” | Compare against destination-local tour start |
| Booking confirmation/payment/webhook timestamps | UTC instant |
| Hold expiry | UTC instant |
| Invoice/payment issue timestamp | UTC or business/accounting timezone, but show tour date locally |
| Customer invoice/receipt tour date | Destination-local date/time |
| Email reminders | Compute from destination-local tour time, but job scheduling should use a real UTC instant |
| Tracking conversion time | UTC instant |
| Reviews: “can review after tour happened” | Compare destination-local tour start/end against destination-local now |

Your current backend is **partly right and intentionally designed around this**.

The good parts:

- `AvailabilitySchedule.weekday` and `startTime` are tour-local: [availability.prisma](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/prisma/availability.prisma:10)
- `AvailabilityException.date` and `Departure.date/startTime` use `@db.Date` and `@db.Time`, which is the right shape for local calendar inventory: [availability.prisma](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/prisma/availability.prisma:33)
- You have explicit local-time helpers that treat date/time as local wall-clock values instead of converting them to UTC: [timezone.util.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/common/utils/timezone.util.ts:1)
- Materialization uses the tour timezone to decide “today” locally: [availability-materializer.service.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/availability/availability-materializer.service.ts:62)
- Public availability correctly computes cutoff from local start time and local now: [availability.service.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/availability/availability.service.ts:744)
- Booking reserve snapshots `localDate`, `startTime`, `tourStartDateTime`, and `tourEndDateTime`: [bookings.service.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/bookings/bookings.service.ts:196)
- Lifecycle fields are correctly named as UTC: `utcExpiresAt`, `utcConfirmedAt`, `utcRedeemedAt`: [bookings.prisma](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/prisma/bookings.prisma:24)

The main gaps I see:

1. **You expose fake local wall-clock `Date` values as ISO UTC strings.**  
   `tourStartDateTime.toISOString()` returns something like `2026-07-01T09:00:00.000Z`, but in your model that does **not** mean 09:00 UTC. It means 09:00 Curaçao local, stored in a Date object for convenience. This can confuse frontend, invoice, ICS calendar, reminder, or third-party integrations: [bookings.service.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/bookings/bookings.service.ts:705)

   Better response shape:
   ```ts
   localDate: "2026-07-01"
   startTime: "09:00"
   endTime: "13:00"
   timeZone: "America/Curacao"
   ```

   If you need an actual instant for reminders/ICS:
   ```ts
   startsAtUtc: "2026-07-01T13:00:00.000Z" // for Curaçao UTC-4
   ```

2. **Timezone strings are not validated.**  
   Destination timezone accepts any string: [destination.dto.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/destinations/dto/destination.dto.ts:434)  
   Tour timezone also accepts any string: [tour.dto.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/tours/dto/tour.dto.ts:1178)

   A bad value like `"Curacao"` or `"UTC-4"` can break `Intl.DateTimeFormat`.

3. **Tour update allows timezone drift from destination.**  
   Create derives `Tour.timeZone` from destination, which is good: [tours.service.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/tours/tours.service.ts:1501)  
   But update allows direct override: [tours.service.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/tours/tours.service.ts:1756)

   For this marketplace, I would not let operators freely edit tour timezone. Derive it from destination unless you truly support cross-destination tours.

4. **Booking should snapshot the timezone.**  
   Booking snapshots `localDate` and `startTime`, but not `timeZone`. Later cancellation/refund logic looks up the current tour timezone. If the tour or destination timezone changes after booking, old bookings may be evaluated with the wrong timezone. Add something like:
   ```prisma
   tourTimeZone String
   ```
   on `Booking`.

5. **Invoices/receipts need two separate concepts.**  
   Your payment/invoice timestamp should be UTC/system time. But the booked experience must show:
   ```text
   Tour date: Tuesday, July 1, 2026
   Time: 9:00 AM
   Timezone: Curaçao local time / America/Curacao
   ```
   Do not print `2026-07-01T09:00:00.000Z` on invoices as the tour time.

Overall verdict: **your availability/departure implementation is conceptually mostly right**, especially the `@db.Date` + `@db.Time` model and local cutoff comparisons. The risky part is the API boundary: you currently serialize local wall-clock `Date` values as UTC-looking ISO strings. That is where bugs will appear in frontend display, invoices, calendar files, reminders, and integrations.

The clean rule to follow now: store and return tour schedule as `{ localDate, startTime, endTime, timeZone }`; store UTC only for real system events; derive real UTC instants only when a scheduler, webhook, tracking event, or external calendar needs an absolute moment.

## Follow-Up User Question

understand deeply any other part logic or area aren't we miss?

## Assistant Follow-Up Investigation Updates

I’ll check the surrounding backend areas that can quietly depend on tour time: payments/webhooks, notifications, reviews, tracking, spotlight tiers, search/tour filters, and workers. The goal is to find every place where local tour time vs real UTC instant matters, not just availability.

Payments and webhooks look UTC-oriented, which is correct for settlement. The notification payload uses `utcCreatedAt` correctly, but availability notifications only pass `localDate`; subscribers must know that this is a local date, not a UTC day.

Reviews use local date/start time to decide when a guest can review, which is the right frame. Spotlight/tier windows use absolute `DateTime`; that’s fine for commercial campaign windows, but the API should be explicit whether admin-entered dates are UTC instants or destination-local campaign dates.

One more area stands out: user/profile timezone defaults are offset strings (`UTC+06:00`), not IANA zones. That is acceptable only for display preferences, but should never be reused for destination/tour calculations.

I found an extra concrete bug candidate in tour search: the date availability filter checks `Departure.status = OPEN` and capacity, but it does not apply the live cutoff calculation. So a departure can be past its booking cutoff and still appear in tour search results if its stored status remains `OPEN`.

## Assistant Follow-Up Explanation

Yes, there are a few more areas we should include. Availability/departure is the center, but not the whole surface.

**Extra Areas**
1. **Tour Search / Listing Filters**
Your date-based tour search checks `Departure.status = OPEN` and capacity, but does **not** apply the live booking cutoff logic.

So this can happen:

- Tour departure: today 09:00 Curaçao time
- Booking cutoff: 2 hours before
- Current local time: 08:30
- Stored departure status: still `OPEN`
- Public availability API says unavailable because cutoff passed
- Tour search may still include it

Relevant file: [tours.service.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/tours/tours.service.ts:503)

This is a real gap. Search should reuse the same cutoff logic as `AvailabilityService`.

2. **`isBookable` Can Become Stale During the Day**
`isBookable` is refreshed on schedule mutations and nightly jobs. But cutoff passing is time-based. A tour can be bookable at 06:00 and not bookable at 08:00, without any DB row changing.

Your public availability reads handle this correctly, but listing/search may still rely on stale `tour.isBookable`.

This is acceptable only as a coarse listing optimization. For exact date/guest/time search, you must compute live availability.

3. **Booking Confirmation Email**
Email currently sends:

```ts
2026-07-01 at 09:00
```

That is local, which is good, but it does not say timezone/local island time.

Relevant file: [booking-confirmation.template.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/mail/templates/booking-confirmation.template.ts:5)

Better:

```text
2026-07-01 at 09:00 Curaçao local time
```

or:

```text
2026-07-01 at 09:00 (America/Curacao)
```

4. **Notifications / Webhooks**
Notification metadata uses `utcCreatedAt`, which is correct.

But availability notification payload sends `localDate`. That is okay, but the API contract should explicitly say this is a destination-local date, not a UTC date.

Relevant file: [notifications.service.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/notifications/notifications.service.ts:49)

5. **Reviews**
Reviews correctly check whether the experience passed using local date/start time and tour timezone.

Relevant file: [reviews.service.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/reviews/reviews.service.ts:392)

Gap: it uses current `tour.timeZone`, not a booking-snapshotted timezone. Same issue as cancellation. Booking should snapshot `tourTimeZone`.

6. **Spotlight / Commercial Windows**
Spotlight `startsAt` and `endsAt` are absolute `DateTime` values. That is probably okay because this is a commercial/admin campaign window, not a tour departure.

But the DTO examples use UTC ISO strings. You need decide clearly:

- Are spotlight windows absolute UTC instants?
- Or destination-local campaign dates?

Relevant files:
[tiering DTO](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/tiers/dto/tiers.dto.ts:147)  
[tiers.service.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/tiers/tiers.service.ts:176)

I would keep them as UTC instants for admin/commercial logic.

7. **Demand Signal**
Demand signal uses UTC day windows for “past 60 days” and “next 30 days.”

Relevant file: [demand-signal.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/tours/demand-signal.ts:34)

This is probably acceptable because it is an analytics/ranking signal, not a customer-facing schedule. But if you want exact destination-local demand windows, it needs destination/tour timezone awareness.

8. **User Timezone**
User timezone defaults to offset strings like `UTC+06:00`.

Relevant file: [user.prisma](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/prisma/user.prisma:9)

That should never be used for destination/tour availability logic. For tour logic, use IANA only:

```text
America/Curacao
America/Aruba
America/Lower_Princes
America/St_Lucia
America/Nassau
```

**Updated Gap List**
The full gap list is now:

1. Validate destination/tour timezone as real IANA timezone.
2. Prevent operator-edited tour timezone drift, or strictly control it.
3. Add `Booking.tourTimeZone` snapshot.
4. Stop exposing fake local wall-clock `Date` as UTC-looking ISO for customer-facing fields.
5. Add timezone/local-island wording to emails, invoices, receipts, TYP, and calendar exports.
6. Fix tour search date availability to apply live cutoff.
7. Decide whether `isBookable` is allowed to be stale or must be recomputed live for some endpoints.
8. Clarify notification payload contract: `localDate` means destination-local date.
9. Clarify spotlight/admin campaign windows as UTC instants or destination-local campaign dates.
10. Keep user timezone completely separate from tour/destination timezone.

So yes, we were missing some important surfaces, especially **tour search**, **email/invoice display**, **booking timezone snapshot**, and **stale `isBookable` behavior**.

## Second Follow-Up User Question

and search again and see if there any other gaps

## Assistant Second Follow-Up Investigation Updates

I’ll do another pass focused on missed edge cases: DTO date formats, raw `new Date()` parsing, `@db.Date` ranges, public API serialization, OCTO serializers, seeds/demo data that may encode the wrong model, and any docs/comments that contradict the implementation.

The second pass found a few more important details in the docs/code mismatch area. I’m narrowing them now so I can distinguish real business gaps from harmless UTC audit timestamps.

The narrower pass found a stronger availability gap than the previous search: exception writes do not immediately re-materialize departures. That means a close-date or add-slot can be stored correctly but not affect sellable inventory until another sync or the nightly job.

One more docs-vs-code mismatch is cancellation timing: the architecture says refund eligibility is judged at the traveler’s cancellation request timestamp, but the current service computes refund when `cancel()` runs. That can be wrong if there is admin/manual delay.

## Assistant Second Follow-Up Findings

Yes. A second search found more gaps beyond the first updated list.

### 11. Availability exceptions do not immediately sync departures

Schedules call `syncTourAvailability()` after create/update/delete, but exceptions do not.

Current exception flow:

- `createException()` writes the exception and emits notification.
- `updateException()` updates the exception and emits notification.
- `deleteException()` deletes the exception and emits notification.
- None of those call `materializeTour()` / `syncTourAvailability()`.

Relevant file: [availability.service.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/availability/availability.service.ts:254)

Impact:

- Operator closes July 10.
- Existing July 10 departures remain bookable until a manual materialize call, another schedule sync, or the nightly job.
- Operator adds an extra slot.
- The new sellable departure may not exist immediately.

This is a high-priority gap. Every exception mutation should re-materialize the affected window and refresh `isBookable`.

### 12. Exception DTOs allow invalid combinations that the materializer silently skips

Examples:

- `ADD_SLOT` without `startTime`
- `ADD_SLOT` without resolvable capacity
- `SET_CAPACITY` without capacity
- `CLOSE_SLOT` without `startTime`
- `startTime` not in the tour slot set, depending on whether extra exception slots are supposed to be allowed

The materializer logs and skips some of these cases instead of rejecting at write time.

Relevant file: [availability.dto.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/availability/dto/availability.dto.ts:268)

This should be service-validated the same way schedules validate `startTime` and capacity.

### 13. Local date DTOs use `@IsDateString()` instead of strict `YYYY-MM-DD`

Many fields represent local calendar dates only:

- availability `from`, `to`
- schedule `validFrom`, `validUntil`
- exception `date`
- public availability `dateFrom`, `dateTo`
- booking list `from`, `to`

But `@IsDateString()` accepts full ISO timestamps too. Your service helpers expect date-only strings and append `T00:00:00.000Z`.

Relevant files:

- [availability.dto.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/availability/dto/availability.dto.ts:142)
- [availability.dto.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/availability/dto/availability.dto.ts:205)
- [availability.dto.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/availability/dto/availability.dto.ts:273)
- [availability.dto.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/availability/dto/availability.dto.ts:381)
- [booking.dto.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/bookings/dto/booking.dto.ts:371)

These should use a strict date-only validator:

```ts
@Matches(/^\d{4}-\d{2}-\d{2}$/)
```

or a custom `@IsLocalDate()` validator.

### 14. Schedule and query date ranges need explicit ordering validation

Examples:

- `validUntil < validFrom`
- `dateTo < dateFrom`
- `to < from`

`MaterializeDto` has a service-level window check, but other date ranges can silently return no rows or create dead schedules.

Relevant service/date areas:

- schedule create/update: [availability.service.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/availability/availability.service.ts:92)
- exception/departure list queries: [availability.service.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/availability/availability.service.ts:333)
- booking list query: [bookings.service.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/bookings/bookings.service.ts:740)

### 15. Full-text tour search has the same date availability problem, plus less filtering

The previous pass found the main listing date filter issue. The separate `search()` method also filters date by:

```ts
departures: {
  some: { date: parsedDate, status: DepartureStatus.OPEN },
}
```

Relevant file: [tours.service.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/tours/tours.service.ts:372)

This does not apply:

- live cutoff
- remaining capacity
- `isBookable`
- time-of-day

Some of that may be intentional for broad text search, but the word “bookable” in the comment is inaccurate unless live cutoff is applied.

### 16. Cancellation refund uses action time, but docs require request time

Architecture says:

> The cancellation deadline is judged on the request timestamp, not the admin action.

Relevant doc: [BOOKING-AND-PAYMENTS.md](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/technical-doc/02-architecture/BOOKING-AND-PAYMENTS.md:136)

Current code:

- `cancel()` calls `computeRefund()`
- `computeRefund()` uses `localNow(tour.timeZone)` at the moment the cancel service runs

Relevant files:

- [bookings.service.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/bookings/bookings.service.ts:500)
- [bookings.service.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/src/bookings/bookings.service.ts:975)

If a traveler requested cancellation before the local deadline, but admin processed it after the deadline, the current code can incorrectly return `NONE`.

This needs either:

- a cancellation request table with `requestedAt`, or
- a `requestedAt` field in the cancel DTO for admin-confirmed cancellation, validated/audited.

### 17. Reminder emails are specified as tour-local but not implemented yet

The master specifies “Tomorrow:” / “Today:” reminder emails using tour-local date and time. Current backend has confirmation email only.

This is not a bug in existing code if reminders are pending, but it is a future implementation trap: reminders must be scheduled from the local tour start converted to a real UTC instant, not from fake `Z` local wall-clock values.

### 18. `bookingCountToday` is timezone-sensitive and currently not maintained in live booking flow

`Tour.bookingCountToday` exists and is exposed for CRO copy, but live booking flow does not appear to increment/reset it. When implemented, “today” should mean destination-local today or clearly platform-business today, not server UTC.

Relevant model fields: [tours.prisma](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/backend/prisma/tours.prisma:90)

## Full Gap List After Second Search

1. Validate destination/tour timezone as real IANA timezone.
2. Prevent operator-edited tour timezone drift, or strictly control it.
3. Add `Booking.tourTimeZone` snapshot.
4. Stop exposing fake local wall-clock `Date` as UTC-looking ISO for customer-facing fields.
5. Add timezone/local-island wording to emails, invoices, receipts, TYP, and calendar exports.
6. Fix tour listing date availability to apply live cutoff.
7. Decide whether `isBookable` is allowed to be stale or must be recomputed live for some endpoints.
8. Clarify notification payload contract: `localDate` means destination-local date.
9. Clarify spotlight/admin campaign windows as UTC instants or destination-local campaign dates.
10. Keep user timezone completely separate from tour/destination timezone.
11. Re-materialize departures immediately after availability exception create/update/delete.
12. Validate exception type combinations before writing them.
13. Replace `@IsDateString()` with strict `YYYY-MM-DD` validation for local calendar dates.
14. Validate local date range ordering.
15. Fix full-text tour search date filtering, or rename/comment it so it does not claim “bookable.”
16. Align cancellation refund logic with request timestamp, not admin/action timestamp.
17. Implement future reminder emails using real UTC schedule instants derived from local tour time.
18. Define and maintain `bookingCountToday` using a chosen timezone rule.

## Third Follow-Up User Question

is there anything else?

## Assistant Third Follow-Up Investigation Updates

I’ll do one final quick pass across the frontend/public UI references, because even if backend is corrected, the most common remaining bugs show up when local dates are parsed/rendered in the browser.

The frontend scan points to one more class of issue: generic `new Date()` formatting helpers and dashboard schedule date pickers. I’ll inspect the schedule tab and shared date utilities before answering.

I found a final set of frontend/UI risks: browser-local date parsing/formatting can shift destination-local dates for users outside the island timezone, and the dashboard currently tells operators exceptions update departures automatically even though backend does not yet do that.

## Assistant Third Follow-Up Findings

Yes, a few more, mostly frontend/API-boundary risks.

### 19. Frontend generic date formatters can shift local calendar dates

Shared frontend helpers parse strings through `new Date(...)` and then format in the browser’s local timezone.

Relevant files:

- [frontend/lib/utils.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/frontend/lib/utils.ts:34)
- [frontend/utils/intl-utils.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/frontend/utils/intl-utils.ts:8)

This is fine for real UTC audit timestamps like `createdAt`, but dangerous for destination-local date-only values.

Example:

```ts
new Date("2026-07-01")
```

JavaScript treats this as midnight UTC. A user in a negative offset timezone can see June 30 when formatted locally.

Rule:

- Do not use generic `formatDate(new Date(...))` for `localDate`, `validFrom`, `validUntil`, exception `date`, or departure `date`.
- Use a local-date formatter that parses `YYYY-MM-DD` as plain calendar components, not an instant.

### 20. Dashboard schedule date picker uses browser-local Date objects

The schedule tab converts date-only strings to browser-local `Date` objects:

```ts
new Date(value + 'T00:00:00')
```

Relevant file: [trip-schedules-tab.tsx](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/frontend/components/dashboard/trips/trip-schedules-tab.tsx:51)

This is less risky than `"YYYY-MM-DD"` parsing because it creates local midnight, but the calendar still uses the operator/admin browser timezone, not the destination timezone.

For date-only values this is usually okay because the final payload is `format(date, 'yyyy-MM-dd')`, but the UI should be treated as a plain calendar-date editor, not an instant editor. Avoid showing timezone-converted date labels here.

### 21. Frontend says exceptions update departures automatically, but backend does not yet do it

The dashboard text says:

> Departures update automatically.

Relevant file: [trip-schedules-tab.tsx](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/frontend/components/dashboard/trips/trip-schedules-tab.tsx:713)

That text is correct as a product requirement, but the backend currently does not sync departures after exception create/update/delete. Until backend gap #11 is fixed, the UI over-promises.

### 22. Timezone selection utilities exist, but destination/tour forms must not auto-detect browser timezone for tours

Frontend has helpers to detect browser timezone and list IANA zones:

Relevant file: [frontend/utils/intl-utils.ts](/Users/devripon/devripon/Final%20&%20Running%20Project/island-tour-development/frontend/utils/intl-utils.ts:28)

This is useful for user profile timezone, but dangerous if reused for tours/destinations. A tour in Curaçao must use the destination timezone, not the operator’s browser timezone.

### 23. Public/customer UI must avoid rendering fake `Z` local fields with generic date formatters

If the frontend receives `tourStartDateTime: "2026-07-01T09:00:00.000Z"` and passes it into `new Date()` / `Intl.DateTimeFormat`, it will render as a real UTC instant and shift the time for many users.

This reinforces backend gap #4. Until the backend response shape is fixed, frontend must prefer:

```ts
localDate
startTime
timeZone
```

over:

```ts
tourStartDateTime
```

for customer-facing displays.

## Full Gap List After Third Search

1. Validate destination/tour timezone as real IANA timezone.
2. Prevent operator-edited tour timezone drift, or strictly control it.
3. Add `Booking.tourTimeZone` snapshot.
4. Stop exposing fake local wall-clock `Date` as UTC-looking ISO for customer-facing fields.
5. Add timezone/local-island wording to emails, invoices, receipts, TYP, and calendar exports.
6. Fix tour listing date availability to apply live cutoff.
7. Decide whether `isBookable` is allowed to be stale or must be recomputed live for some endpoints.
8. Clarify notification payload contract: `localDate` means destination-local date.
9. Clarify spotlight/admin campaign windows as UTC instants or destination-local campaign dates.
10. Keep user timezone completely separate from tour/destination timezone.
11. Re-materialize departures immediately after availability exception create/update/delete.
12. Validate exception type combinations before writing them.
13. Replace `@IsDateString()` with strict `YYYY-MM-DD` validation for local calendar dates.
14. Validate local date range ordering.
15. Fix full-text tour search date filtering, or rename/comment it so it does not claim “bookable.”
16. Align cancellation refund logic with request timestamp, not admin/action timestamp.
17. Implement future reminder emails using real UTC schedule instants derived from local tour time.
18. Define and maintain `bookingCountToday` using a chosen timezone rule.
19. Add frontend local-date-only formatting utilities and forbid generic `new Date()` formatting for `YYYY-MM-DD` business dates.
20. Treat dashboard schedule/exception date pickers as plain calendar-date editors, not timezone-aware instant editors.
21. Fix backend exception materialization before keeping UI copy that says departures update automatically.
22. Do not reuse browser timezone detection for tour/destination timezone.
23. Do not render `tourStartDateTime` / `tourEndDateTime` with generic browser date formatting in customer UI.
24. Remove unsafe `America/Curacao` fallbacks for non-Curaçao destinations. Current locations:
    - Tour create uses `destination.timezone ?? 'America/Curacao'`: `backend/src/tours/tours.service.ts`.
    - Tour schema has `timeZone String @default("America/Curacao")`: `backend/prisma/tours.prisma`.
    - Review eligibility falls back to `booking.tour?.timeZone ?? 'America/Curacao'`: `backend/src/reviews/reviews.service.ts`.
    These are safe only for Curaçao. For Aruba, Sint Maarten, Saint Lucia, Bahamas, or future destinations, a missing destination timezone can silently create wrong local schedules. Destination timezone must be required platform data: it should be stored on every destination before any tour, availability, departure, or booking logic can use that destination.

## Complete Implementation Plan

### Goal

Make the platform use the correct time model everywhere:

- Destination/tour experience time is destination-local wall-clock time.
- System, payment, webhook, audit, tracking, and job execution time is UTC.
- API responses never make a destination-local wall-clock value look like a real UTC instant.
- Frontend date formatting never shifts destination-local dates because of the viewer's browser timezone.

### Phase 1 - Define the platform time contract

1. Add a short backend contract document or shared code comment near `timezone.util.ts`:
   - `localDate`: `YYYY-MM-DD`, destination-local calendar date.
   - `startTime` / `endTime`: `HH:mm`, destination-local wall-clock time.
   - `timeZone`: IANA timezone, for example `America/Curacao`.
   - `startsAtUtc` / `endsAtUtc`: real UTC instants, used only for integrations, reminders, calendars, and schedulers.
   - `createdAt`, `updatedAt`, webhook timestamps, payment timestamps: UTC instants.
2. Update Swagger descriptions for availability, departure, booking, cancellation, and TYP DTOs so every date/time field is explicitly labelled as either local wall-clock or UTC instant.
3. Add one rule to `technical-doc/MASTER-CHECKLIST.md` or the relevant architecture docs when implementation starts: customer-facing tour dates must render from `{ localDate, startTime, timeZone }`, not from a fake `DateTime` field.

Deliverable: a clear API contract that prevents future code from mixing local calendar values with UTC instants.

### Phase 2 - Harden timezone source of truth

1. Add a reusable IANA timezone validator:
   - Suggested file: `backend/src/common/validators/is-iana-timezone.validator.ts`.
   - Accept only valid `Intl.DateTimeFormat(..., { timeZone })` zones.
   - Reject offset strings such as `UTC-04:00`.
   - Reject labels such as `Curacao`, `Curaçao time`, or `AST`.
   - Minimal helper shape:

```ts
export function isValidIanaTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
```

2. Apply it to destination timezone create/update DTOs:
   - Replace plain `@IsString()` validation on destination timezone fields.
   - Treat destination timezone as required platform data.
   - On destination create, require a timezone unless the service derives it from a known launch-destination slug/name.
   - Keep Swagger examples as real IANA zones, not human labels.
   - Valid examples:
     - `America/Curacao`
     - `America/Aruba`
     - `America/Lower_Princes`
     - `America/St_Lucia`
     - `America/Nassau`
3. Apply the same validator to tour DTOs only if `Tour.timeZone` remains client-writable.
4. Preferred tour rule: stop operators from freely editing `Tour.timeZone`:
   - Preferred: remove `timeZone` from operator update payloads and always derive it from `Destination.timeZone`.
   - If admin override is required later, make it admin-only and audit logged.
5. Harden service logic:
   - On tour create, continue deriving `Tour.timeZone` from `Destination.timeZone`.
   - On tour update, ignore or reject operator-provided `dto.timeZone`.
   - When a tour destination changes, recalculate `Tour.timeZone` from the new destination in the same transaction.
6. Remove unsafe default-to-Curaçao behavior:
   - Current tour create fallback: `timeZone: destination.timezone ?? 'America/Curacao'` in `backend/src/tours/tours.service.ts`.
   - Current schema fallback: `timeZone String @default("America/Curacao")` in `backend/prisma/tours.prisma`.
   - Current review fallback: `booking.tour?.timeZone ?? 'America/Curacao'` in `backend/src/reviews/reviews.service.ts`.
   - Replace these with "destination timezone must exist" for persisted launch/future destinations.
   - Keep `America/Curacao` only as a seed/default for the Curaçao destination itself, not as a universal fallback.
7. Define destination-create fallback behavior:
   - Destination timezone is required.
   - If timezone is provided, validate it as IANA.
   - If timezone is missing and the destination slug/name is one of the known launch destinations, derive it from a fixed map and store it explicitly.
   - If timezone is missing and cannot be derived, reject destination creation with `400 Bad Request`.
   - Suggested launch map:

```ts
const DEFAULT_DESTINATION_TIMEZONES = {
  curacao: 'America/Curacao',
  aruba: 'America/Aruba',
  'sint-maarten': 'America/Lower_Princes',
  'saint-lucia': 'America/St_Lucia',
  bahamas: 'America/Nassau',
} as const;
```

8. Define destination-update behavior:
   - If timezone is omitted, keep the existing timezone.
   - If timezone is provided, validate it as IANA.
   - If timezone changes, update existing tours for that destination unless an explicit future admin-only tour timezone override is introduced.
9. Add tests for valid launch zones:
   - `America/Curacao`
   - `America/Aruba`
   - `America/Lower_Princes`
   - `America/St_Lucia`
   - `America/Nassau`
10. Add rejection tests:
   - reject `Curacao`
   - reject `Curaçao time`
   - reject `UTC-4`
   - reject `AST`
   - reject empty strings
11. Add missing-timezone tests:
   - creating Curaçao without timezone derives `America/Curacao`.
   - creating Aruba without timezone derives `America/Aruba`.
   - creating Sint Maarten without timezone derives `America/Lower_Princes`.
   - creating an unknown destination without timezone returns `400 Bad Request`.
   - creating a tour for a destination with null timezone fails instead of silently using Curaçao.
12. Add drift-prevention tests:
   - operator tour update cannot change `Tour.timeZone` away from the destination timezone.
   - tour destination change updates `Tour.timeZone` to the new destination timezone.

Deliverable: every tour is anchored to a valid destination timezone, timezone drift is blocked, and non-Curaçao destinations can never silently inherit Curaçao local time.

if user dont update or pass the timezone in destination?


• If the user/admin does not pass timezone when creating/
  updating a destination, then one of two things happens
  depending on your DTO/service/schema.

  In your current model, destination timezone likely has a
  default. Tours also have a fallback here:

  timeZone: destination.timezone ?? 'America/Curacao'

  So if no timezone exists, the tour becomes America/
  Curacao.

  That is safe for Curaçao, but dangerous for Aruba, Sint
  Maarten, Saint Lucia, Bahamas.

  Correct Rule

  For destination create:

  - If timezone is provided: validate it as IANA.
  - If timezone is missing: derive it from the destination
    slug/name when it is one of your known launch

  - If it cannot be derived: reject creation and require
    timezone.

  const DEFAULT_DESTINATION_TIMEZONES = {
    curacao: 'America/Curacao',
    aruba: 'America/Aruba',
    'sint-maarten': 'America/Lower_Princes',

  Create Aruba with no timezone
  → store America/Aruba

  Create unknown destination with no timezone
  → 400 Bad Request: timezone is required

  For destination update:

  - If timezone is omitted: keep the existing timezone.
  - If timezone is provided: validate it.
  - If timezone changes: decide whether existing tours
    should be updated too. For your app, yes, because tour
    timezone should follow destination timezone unless you
    support admin override.

  Do not use America/Curacao as the universal fallback for
  every destination. That will silently make Bahamas/Saint
  Lucia/Sint Maarten schedules wrong.


› timeZone: destination.timezone ?? 'America/Curacao' where
  this is defined?


• I’ll locate the exact line and surrounding code so I can
  point you to where the fallback is defined and how it is
  reached.

• Explored
  └ Search destination\.timezone \?\?|America/Curacao|
  timeZone:
           destination in backend
    Read tours.service.ts
    Search timezone.*default|timeZone.*default|model
           Destination|model Tour in *.prisma

────────────────────────────────────────────────────────────

• It is defined in two places.

  Main service fallback:

  backend/src/tours/tours.service.ts:1501

  timeZone: destination.timezone ?? 'America/Curacao',

  This is inside createTour(), when a new tour is created.
  The flow is:

  → service creates Tour
  → Tour.timeZone = Destination.timezone if present
  → otherwise Tour.timeZone = America/Curacao


  timeZone String @default("America/Curacao") // IANA;
  derive from destination

  So even if a tour is inserted without timeZone, Prisma/
  Postgres defaults it to America/Curacao.

  Destination timezone itself is nullable:

  backend/prisma/destinations.prisma:19

  timezone String? // IANA timezone, e.g. 'America/Curacao'

  There is also another fallback in reviews:

  backend/src/reviews/reviews.service.ts:397

  const tz = booking.tour?.timeZone ?? 'America/Curacao';

  The risky part is: if destination timezone is missing for
  Aruba/Bahamas/Sint Maarten, the tour silently becomes
  Curaçao time. Better fix is to require or derive
  destination timezone before creating tours.

### Phase 3 - Fix local date DTO validation

1. Add a reusable `@IsLocalDate()` validator or a helper using `@Matches(/^\d{4}-\d{2}-\d{2}$/)`.
2. Replace `@IsDateString()` for date-only business fields:
   - availability schedule `validFrom`, `validUntil`
   - availability exception `date`
   - materialization `from`, `to`
   - public availability `dateFrom`, `dateTo`
   - booking list query `from`, `to`
   - any future cancellation request local date fields
3. Add service-level range validation:
   - `validUntil >= validFrom`
   - `dateTo >= dateFrom`
   - `to >= from`
4. Keep `@IsDateString()` only for real UTC instants or ISO timestamp fields.

Deliverable: date-only fields cannot accept timestamp strings that later get misinterpreted.

### Phase 4 - Fix availability exception write behavior

1. Validate exception type combinations before writing:
   - `CLOSE_DATE`: requires `date`, forbids `startTime` unless intentionally ignored.
   - `CLOSE_SLOT`: requires `date` and `startTime`.
   - `ADD_SLOT`: requires `date`, `startTime`, and resolvable capacity.
   - `SET_CAPACITY`: requires `date`, `startTime`, and `capacity`.
2. After exception create/update/delete, immediately re-materialize the affected date window.
3. Refresh tour-level `isBookable` after the exception mutation.
4. Preserve protected departures:
   - booked departures must not be deleted.
   - manually edited departures must not be overwritten.
   - capacity lower than `bookedCount` must follow the admin-only warning rule.
5. Add regression tests:
   - close date immediately hides all same-day departures.
   - close slot immediately hides only that slot.
   - add slot immediately creates a bookable departure.
   - set capacity immediately changes remaining capacity.

Deliverable: the dashboard promise "Departures update automatically" becomes true.

### Phase 5 - Snapshot booking timezone and stop fake UTC serialization

1. Add `tourTimeZone String` to `Booking`.
2. On booking reserve, snapshot:
   - `localDate`
   - `startTime`
   - `endTime`
   - `tourTimeZone`
   - cancellation hours
   - payment model
   - commission fields
3. Backfill existing bookings:
   - use `Booking.tour.timeZone` when present.
   - otherwise use `Booking.tour.destination.timeZone`.
4. Change booking response DTOs:
   - keep `localDate`, `startTime`, `endTime`, `timeZone`.
   - add `startsAtUtc` / `endsAtUtc` only if a real instant is needed.
   - deprecate or remove customer-facing `tourStartDateTime` / `tourEndDateTime` ISO fields if they are fake `Z` local wall-clock values.
5. Use the snapshotted `tourTimeZone` for:
   - cancellation deadline computation.
   - review eligibility.
   - booking emails.
   - TYP display.
   - invoice/receipt display.

Deliverable: historical bookings remain stable even if a tour or destination timezone changes later.

### Phase 6 - Correct booking cutoff and search/listing availability

1. Extract one shared backend helper for live departure bookability:
   - status is open.
   - remaining capacity is enough.
   - current destination-local time has not passed `bookingCutoffMinutes`.
2. Use this helper in:
   - public availability month map.
   - tour listing date filters.
   - full-text search date filters, if those results claim to be bookable.
   - booking reserve pre-check.
3. Decide the official meaning of `Tour.isBookable`:
   - Option A: coarse cached flag, allowed to be stale during the day.
   - Option B: live-computed for user-facing endpoints.
4. If Option A is chosen, never use `isBookable` alone for exact date/guest/time search.
5. Add tests for same-day cutoff:
   - departure is visible before cutoff.
   - departure is hidden after cutoff.
   - search/listing and availability API agree.

Deliverable: search, listings, availability, and booking reserve all agree on what can actually be booked.

### Phase 7 - Align cancellation with request timestamp

1. Model cancellation as a request, not only an immediate action:
   - Add `cancellation_requested_at` or a separate cancellation request table.
   - Store the request timestamp as a UTC instant.
2. Compute refund eligibility from the request timestamp converted against the snapshotted tour timezone.
3. Admin processing time must not reduce refund eligibility if the traveler requested cancellation before the deadline.
4. Add audit fields:
   - requested by
   - processed by
   - processed at
   - refund decision
   - refund reason
5. Add tests:
   - request before deadline, admin processes after deadline, refund remains eligible.
   - request after deadline, refund is not eligible unless admin override applies.

Deliverable: cancellation matches the architecture rule that eligibility is judged at request time.

### Phase 8 - Update email, invoice, receipt, TYP, and calendar display

1. Confirmation email:
   - show tour date/time as destination-local.
   - include "local time" or the island/timezone label.
   - never print fake UTC ISO strings.
2. Payment-model blocks:
   - every balance/cancellation deadline includes "(local time)".
3. TYP and booking detail:
   - render from `{ localDate, startTime, timeZone }`.
4. Invoice/receipt:
   - payment issue timestamp may be UTC or accounting timezone.
   - booked tour date/time must be destination-local.
5. Calendar/ICS export:
   - convert local tour start/end to real UTC instants or emit timezone-aware calendar fields.
6. Reminder emails:
   - schedule jobs using real UTC instants derived from local tour start.
   - copy switches correctly for "Tomorrow:" and "Today:" based on destination-local date.

Deliverable: every customer-facing artifact communicates the island-local experience time correctly.

### Phase 9 - Fix frontend local-date handling

1. Add frontend utilities:
   - `parseLocalDateParts("YYYY-MM-DD")`
   - `formatLocalDateOnly(localDate, locale)`
   - `formatLocalTime(startTime, locale)`
   - `formatTourLocalDateTime({ localDate, startTime, timeZone, locale })`
2. Forbid generic `new Date(localDate)` formatting for date-only business fields.
3. Replace generic date formatting in public booking, dashboard availability, invoices, emails previews, and TYP surfaces.
4. Treat schedule and exception date pickers as plain calendar-date editors:
   - input/output remains `YYYY-MM-DD`.
   - do not auto-convert to the browser timezone.
5. Do not reuse browser timezone detection for destination or tour timezone fields.
6. Add frontend tests for a viewer outside the Caribbean timezone:
   - user in Asia/Dhaka sees the same booked local date.
   - user in US Pacific sees the same booked local date.
   - date-only fields do not shift to previous/next day.

Deliverable: the UI displays the destination-local tour date consistently for every traveler.

### Phase 10 - Define analytics and cached counters

1. Keep tracking event timestamps as UTC instants.
2. Keep conversion value as `commission_amount` in EUR.
3. Define `bookingCountToday`:
   - Preferred: destination-local today, because it supports destination/tour CRO copy.
   - Alternative: UTC analytics day, but then do not use it for customer-facing "today" copy.
4. Implement reset/increment logic through a worker or materialized aggregate.
5. Document demand-signal windows:
   - UTC is acceptable for analytics/ranking.
   - destination-local is required if the value appears as customer-facing "today", "tomorrow", or date-specific copy.

Deliverable: analytics remains UTC-safe while customer-facing counters use an explicit local-day rule.

### Phase 11 - Tests and verification

Backend test matrix:

1. Timezone validation rejects invalid zones and accepts all launch destination zones.
2. Tour timezone is derived from destination and cannot drift through operator update.
3. Local date DTOs reject full ISO timestamps.
4. Date range validation rejects reversed ranges.
5. Availability exceptions re-materialize departures immediately.
6. Booking cutoff hides departures consistently across availability, search, listing, and reserve.
7. Booking snapshots timezone and uses it after tour/destination timezone changes.
8. Cancellation refund eligibility uses request timestamp.
9. Review eligibility uses snapshotted booking timezone.
10. Response DTOs do not expose fake UTC-looking tour local datetimes.

Frontend test matrix:

1. Local date-only formatter does not shift dates across browser timezones.
2. Booking/TYP/invoice surfaces render `localDate`, `startTime`, and `timeZone`.
3. Schedule and exception editors submit exact `YYYY-MM-DD` strings.
4. Customer-facing UI does not render `tourStartDateTime` if it is a fake UTC-looking field.

Manual QA scenarios:

1. Curaçao tour every Tuesday at 09:00.
2. Viewer in Asia/Dhaka, US Pacific, and Europe/Amsterdam sees Tuesday 09:00 Curaçao local time.
3. Same-day cutoff passes in Curaçao; availability, search, and booking reserve all block it.
4. Operator closes a date; public availability updates immediately.
5. Traveler requests cancellation before local deadline; admin processes later; refund eligibility remains correct.

Deliverable: local-time behavior is proven across backend, frontend, and user-facing workflows.

### Phase 12 - Migration and rollout order

1. Add validators and tests first. This is low-risk and prevents new bad data.
2. Add `Booking.tourTimeZone` and backfill existing records.
3. Change booking/availability response DTOs to expose explicit local fields and real UTC fields separately.
4. Fix exception materialization and date range validation.
5. Fix search/listing cutoff consistency.
6. Update frontend formatters and replace unsafe date rendering.
7. Update email/TYP/invoice/reminder display.
8. Implement cancellation request timestamp logic.
9. Implement `bookingCountToday` with the chosen timezone rule.
10. Update `MASTER-CHECKLIST.md` and relevant architecture docs in the same implementation commits.

Recommended first implementation slice:

1. Backend validators for IANA timezone and local date-only fields.
2. Exception mutation re-materialization.
3. Booking `tourTimeZone` snapshot.
4. Booking response cleanup for local date/time fields.
5. Shared live bookability helper used by availability, search, listing, and reserve.

This first slice removes the highest-risk bugs: wrong timezone source, stale departures after exceptions, fake UTC serialization, and inconsistent bookability.
