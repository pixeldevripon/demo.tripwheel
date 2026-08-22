---
name: project_range_impact_it67_security
description: Security review of GET /availability/exceptions/range-impact (issue #67) — clean; tenant-scoping pattern re-confirmed, missing 366-day cap judged non-exploitable
type: project
---

Reviewed 2026-08-15: backend `it-67-range-impact` worktree (`rangeImpact()` in
`availability.service.ts`, `RangeImpactQueryDto`/`RangeImpactResultDto` in
`dto/availability.dto.ts`, controller route `GET exceptions/range-impact`) +
dashboard `dash-67-range-impact` worktree (`RangeDialog`, `useRangeImpact`,
`tripsApi.getRangeImpact`). No critical/high findings — clean audit.

**Why this needed checking:** new read-only endpoint that fans out counts
(departures, tours, booked guests) across an operator's whole tour scope, the
same `rangeScope()` used by the mutating `closeRange`/`reopenRange`. The
worry was IDOR via a spoofed `operatorId`/`tourId`, and DoS via an
uncapped date range (its write siblings cap at 366 days; this endpoint does
not).

**Confirmed clean:**
- `rangeScope()` (private, shared by close/reopen/impact) ignores
  client-supplied `operatorId` for every non-ADMIN caller — the `else`
  branch resolves scope only via `operatorContext(userId)` (own
  Operator row or non-suspended StaffMember seat). `dto.operatorId` is read
  **only** inside the `role === Role.ADMIN` branch. This is the same
  tenant-pinning pattern verified clean in
  [[project_operator_team_designations_security]].
- `tourId` path runs `assertTourAccess` (throws `NotFoundException` /
  `ForbiddenException`) as the *first* line of `rangeImpact()`, before any
  count query — no data leaks pre-auth-check.
- STOP_SELL-only seats (guide designation) get the same aggregate counts
  agenda/overview already expose to that role; no new sensitivity introduced
  (no PII, no per-traveller rows, no financials).
- All Prisma calls use typed `where`/`select`/`groupBy` — no raw SQL, no
  string interpolation into queries.
- Dashboard renders the counts as plain React text (template strings, no
  `dangerouslySetInnerHTML`) — no XSS even though the numbers are
  server-controlled.
- Frontend never trusts a client-supplied `operatorId` for authorization —
  it's inert against a spoofed value anyway since the backend enforces
  scope server-side (defense in depth already exists without the frontend
  needing to gate it).

**Judged non-exploitable (documented, not filed as a finding):**
`rangeImpact()` has no equivalent of `closeRange`/`reopenRange`'s
"span > 366 days → 400" guard (`assertDateRangeOrder` only checks ordering,
not width). Reasoning it's immaterial: `closeRange`/`reopenRange` cap
because they *write* — the materializer does per-day work proportional to
range width regardless of existing data (real fan-out amplification).
`rangeImpact` only runs a `departure.groupBy` + `bookingUnitItem.count`,
both filtered by `tourId IN (<=200)` (existing `rangeScope` take:200 cap)
and covered by compound indexes (`Departure @@index([tourId, date])`,
`@@index([tourId, status, date])`; `Booking @@index([departureId])`;
`BookingUnitItem @@index([bookingId])`). Postgres index range-scan cost is
proportional to *matching rows*, not requested date-span width, and matching
rows are already bounded by real departure data (itself bounded by other
write-path caps). A 1000-year-wide query costs the same as a 2-week one when
the underlying data is sparse. Recommended (low/info, not blocking) to add
the same 366-day guard anyway for API consistency / defense-in-depth, but
explicitly is not a DoS vector as shipped.

**Pattern reconfirmed:** query DTOs for scope params (`tourId`/`operatorId`)
use `@IsString()` not `@IsUUID()` — this is the established convention
(`CloseRangeDto` does the same), not a deviation to flag.
