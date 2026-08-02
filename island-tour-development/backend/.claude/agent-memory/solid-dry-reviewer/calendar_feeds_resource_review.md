---
name: calendar_feeds_resource_review
description: Phase 7 (RESOURCE calendar feed) review findings in calendar-feeds.service.ts — ownership-check duplication, interval-building triplication, DTO parity gap, misplaced JSDoc
type: project
---

Reviewed 2026-08-02: `backend/src/calendar-feeds/calendar-feeds.service.ts` Phase 7 diff (new
RESOURCE feed kind, per ADR-001-RESOURCE-ARCHITECTURE.md). No ADR §18 rule violations, no tenancy
bypass, no traveller-data leak — the feed is genuinely read-only and correctly scoped. Findings were
all DRY/consistency, not correctness-critical:

1. **`assertFeedResource` (line ~777) is a ~90%-identical copy of `assertChannelTour` (line ~744)**
   — same shape: require id → look up owning entity → 404 if missing → re-resolve operatorId and
   403 if `role !== ADMIN` and mismatch. Only the Prisma model and two error strings differ. This is
   the SAME anti-pattern already recorded for the trips module
   ([[trips_ownership_inconsistency]]) — an ownership-check helper that gets copy-pasted per entity
   kind instead of parametrized once. Worth watching: ADR-001 §15 roadmap lists more feed/protocol
   kinds coming (Google Calendar sync, iCal import fan-out), so this file will likely grow a THIRD
   near-duplicate ownership check if not generalized first.

2. **Interval-building math (`combineDateTime` → `localWallClockToUtc` → `+minutes*60_000`) is now
   duplicated a third time**: `departureEvents` (this file), `loadResourceState`
   (`src/resources/resource-lookup.ts`), and the new `resourceEvents` (this file) all inline the same
   4-line conversion. Candidate extraction: a `departureToUtcInterval(date, startTime, timeZone,
   minutes)` helper in `timezone.util.ts`, reused by all three.

3. **DTO/response parity gap**: `FEED_SELECT` and the `render()` select both fetch `resourceId`, but
   `CalendarFeedResponseDto` and `toDto()`'s inline param type only carry `tourId` through — `tourId`
   is exposed on every response, `resourceId` silently is not. Compiles fine (TS doesn't
   excess-property-check assigned variables), so it fails silently rather than at build time. Net
   effect: the frontend has no way to tell which resource a RESOURCE feed row is for from
   list/create responses.

4. **Doc-comment misattachment** (calendar-feeds.service.ts, now around line 907-955): the new
   `mergeIntervals` function was inserted BETWEEN the pre-existing JSDoc for `mergeRanges`
   ("Collapse sorted date keys...") and `mergeRanges` itself, so that docstring now sits on top of
   `mergeIntervals` and `mergeRanges` is left with no docstring at all. Concrete lesson: when adding a
   new exported function right before an existing one, check whether the existing one's doc-comment
   is directly above it — insertion can silently detach it.

**How to apply**: when reviewing the next calendar-feeds phase (or any module with N structurally
similar entity-ownership checks), lead with "is this the Nth copy of an ownership-check /
projection-building pattern" — this file and the trips module both show the team defaults to
copy-paste-per-entity-kind rather than extracting on the second occurrence.
