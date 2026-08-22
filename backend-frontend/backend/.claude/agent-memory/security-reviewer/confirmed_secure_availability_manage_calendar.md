---
name: confirmed_secure_availability_manage_calendar
description: Reference pattern for operator-scoped read endpoints - GET /availability/manage-calendar reviewed clean, no findings
metadata:
  type: project
---

`GET /api/v1/availability/manage-calendar` (backend/src/availability/availability.controller.ts +
`manageCalendar()` in availability.service.ts) was security-reviewed 2026-07-28 against the "one-tap
availability calendar" feature (uncommitted at review time) and had **zero findings** - use it as the
reference shape for future operator-scoped month/list-grid endpoints in this module.

Why it passed clean:
- `assertTourAccess(query.tourId, userId, role)` is awaited FIRST, before the `Promise.all` of the
  three read queries (departures/exceptions/schedules) - ownership is checked before any data leaves
  the DB, and ADMIN bypass is the same helper used by every other write in the module (no bespoke
  admin check to drift out of sync).
- Every one of the three parallel queries has `tourId: query.tourId` in its `where` - there is no
  path where another operator's rows can be pulled in, and the day-grid is built purely from
  same-tourId data.
- `ManageCalendarQueryDto.month` is `@Matches(/^\d{4}-(0[1-9]|1[0-2])$/)` - bounds the query to a
  single calendar month (max 31 iterations of the day-loop) regardless of the year value; an
  extreme year (`9999-12`) is not a DoS vector because the date-range query window is still just
  one month wide.
- Endpoint is a pure read: no Prisma writes anywhere in `manageCalendar()`. The dashboard's
  one-tap close/reopen reuses the EXISTING `createException`/`deleteException` mutations (their own
  `@RequirePermissions(MANAGE_AVAILABILITY)` + `assertTourAccess` already applied) - no new write
  surface was introduced.
- Dashboard side (`components/trips/trip-availability-calendar.tsx`) renders all server data as
  plain React text/props (no `dangerouslySetInnerHTML`, no URL interpolation of user input); the
  `note` input is a controlled `<Input>` sent as JSON body, never templated into a URL or HTML.
- `bookedTotal` used for the two-step "confirm close" gate comes straight from the server payload
  (`day.bookedTotal`, summed server-side from `dayDepartures.reduce(...)` in the service) - the
  confirm-skip risk would require the *server* response to under-report booked seats, not a
  client-side state bug.
- `lib/api/trips.ts getManageCalendar` builds its query string via the shared `buildQuery()` helper
  (`lib/api/query.ts`), which uses `URLSearchParams` - proper encoding, no manual string
  concatenation into the URL.

Minor non-blocking observation (not filed as a finding - pre-existing pattern, not part of this
diff): `CreateExceptionDto.note` / `UpdateExceptionDto.note` have `@IsString()` but no `@MaxLength()`.
Same as every other free-text note field already in this DTO file, so it isn't a regression
introduced by this feature - flag only if the team decides to add a MaxLength sweep across the
availability module.
