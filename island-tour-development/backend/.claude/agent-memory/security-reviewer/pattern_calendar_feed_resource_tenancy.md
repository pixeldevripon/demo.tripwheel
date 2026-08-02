---
name: pattern_calendar_feed_resource_tenancy
description: Why CalendarFeedKind.RESOURCE (Phase 7) is safe from cross-tenant leakage without re-checking tenancy at render() time, plus the two soft spots found in review
metadata:
  type: project
---

Reviewed 2026-08-02 (uncommitted, branch `global-ical`): `backend/src/calendar-feeds/calendar-feeds.service.ts`
`resourceEvents()` / `assertFeedResource()`, `backend/prisma/calendar-feeds.prisma`,
`backend/prisma/migrations/20260802190000_resource_calendar_feed/migration.sql`.

**The invariant that makes it safe:** a `Resource` row belongs to exactly one `operatorId`, and
every `TourResource` attached to it is enforced (at write time, in `resources.service.ts`) to
belong to that SAME operator - see `create()`'s `owners.size > 1` guard (line ~240) and
`setTourResources()`'s `resource.findMany({ where: { operatorId: tour.operatorId } })` (line ~377).
Because of this, `resourceEvents(resourceId)` can safely `departure.findMany({ tourId: { in:
[...byTour.keys()] } })` without re-checking operator ownership at render time - every tour reachable
from a resource is guaranteed same-tenant by construction. Tenancy for the feed itself is enforced
once, at mint time, in `assertFeedResource()` (mirrors `assertChannelTour()`: resource lookup ->
404 if missing -> 403 if `resource.operatorId !== resolveOperatorId(caller)`, `ADMIN` bypasses).

**Data leakage is also clean:** `resourceEvents()` selects only `date`/`startTime`/`updatedAt` from
`departure` and `name` from `resource` - no traveller data, no tour name, no booking ref, no seat
count. `SUMMARY` is `${resource.name} in use` only. Correctly gated on `MANAGE_AVAILABILITY` (same
bar as CHANNEL/DEPARTURES, not `VIEW_BOOKINGS`) since it carries no traveller data - see
`PERMISSION_FOR_KIND`.

**iCal injection (operator-controlled resource name -> SUMMARY):** not exploitable. All free-text
iCal properties (SUMMARY, DESCRIPTION, LOCATION, X-WR-CALNAME) are escaped centrally in
`backend/src/common/ics/ics.util.ts` `escapeText()` (backslash/`;`/`,`/CRLF/C0-control), called from
`buildCalendar()` - this is a single shared writer for every feed kind, so a new feed kind gets the
escaping for free as long as it goes through `IcsEvent`. One thing NOT escaped: `UID:${event.uid}`
is written raw in `buildCalendar()` - safe today only because every `uid` across every feed kind is
built from server-generated UUIDs/refs/ISO timestamps, never straight from user-controlled text. If
a future feed kind ever interpolates a free-text field into `uid`, that becomes a CRLF-injection
vector - grep `uid:` in `calendar-feeds.service.ts` before trusting a new one.

**Two soft spots found, not blocking:**
1. No unit test exercises `assertFeedResource`'s 404/403/ADMIN-bypass branches (mirrors a
   pre-existing gap: `assertChannelTour` has none either - see `calendar-feeds.service.spec.ts`).
   Worth adding given this is the only thing standing between one operator and another's schedule.
2. `CalendarFeedsService.toDto()` and `CalendarFeedResponseDto` never surface `resourceId` even
   though `FEED_SELECT` fetches it - not a vulnerability, just means the dashboard list can't tell
   two RESOURCE feed rows apart by asset. Functional bug, not security.

Reusable takeaway: when reviewing a NEW scoped-feed/export kind in this codebase, check (a) does the
scope entity have an enforced single-tenant invariant elsewhere (don't assume - verify, as I did here
via `resources.service.ts`), and (b) does its render path only emit fields already covered by
`escapeText`, never a raw interpolation into `uid`.
