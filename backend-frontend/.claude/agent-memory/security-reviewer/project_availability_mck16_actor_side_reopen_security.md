---
name: project_availability_mck16_actor_side_reopen_security
description: Security review findings for MCK-16 (actor-side attribution + soft-retired reopens + closureReason backfill) on backend/src/availability
metadata:
  type: project
---

Reviewed branch `calendar-mck16-be-reason-attribution` (backend/src/availability/*, prisma/availability.prisma,
prisma/enums.prisma, migrations/20260813150000_exception_side_and_retire, tours/demand-signal.ts) on 2026-08-13.

## Finding 1 — updateException ownership-check ordering (IDOR-adjacent oracle)
In committed HEAD, `AvailabilityService.updateException` (availability.service.ts ~line 458-483) checked
`existing.retiredAt` and threw `ConflictException` (409) BEFORE calling `assertTourAccess` (ownership).
`deleteException` (same file, ~line 555-577) had the correct order (ownership first). This let any
authenticated caller holding `MANAGE_AVAILABILITY` distinguish 409 (retired) vs 403 (active-but-foreign)
for ANY exception id, without owning the tour — a cross-tenant status oracle.

Practical exploitability was assessed LOW at review time: AvailabilityException.id is `@default(uuid())`
(unguessable v4), and no other endpoint in this diff leaks foreign-tenant exception ids to non-admin
callers — `listExceptions`/`agenda` scope to the caller's own operator via `operatorContext(userId)`;
`overview` explicitly ignores the `operatorId` query param for non-admins ("deliberately ignored so a
non-admin can never widen their scope"); only ADMIN sees cross-tenant ids via `overview`, and ADMIN
already bypasses `assertTourAccess` by design. Still rated it a real defense-in-depth violation worth
fixing regardless of current blast radius (any future surface leaking an exception id would make it
live).

**Notable**: at review time the working tree already had an UNCOMMITTED fix reordering the two checks
(assertTourAccess first, retiredAt check after, with an explicit "Checked AFTER ownership so a foreign
caller cannot probe exception ids" comment) — someone had already started the fix but hadn't committed it.
Always diff `HEAD` vs the working tree (`git diff HEAD`) when reviewing a "committed diff" task — the two
can disagree.

## Finding 2 — closureReason PATCH backfill is an unrestricted rewrite, not a backfill
`UpdateExceptionDto.closureReason` (dto/availability.dto.ts) + the merge in `updateException`
(availability.service.ts, guard ~line 513-521, write ~line 531-533) let any seat with `MANAGE_AVAILABILITY`
on their own tour set `closureReason` on ANY existing (non-retired) CLOSE_DATE/CLOSE_SLOT row at any time —
there is no check that the existing value is null. Despite the comment framing this as a "backfill path
for closures written before the reason question existed," the code accepts overwriting an
already-populated reason, e.g. flipping NOT_RUNNING -> SOLD_OUT on a closure the operator wrote weeks
earlier.

This matters because `tours/demand-signal.ts` `countRecentSellouts` reads `closureReason: SOLD_OUT` on
CLOSE_DATE rows with `createdAt` inside a rolling 60-day window as sell-out evidence feeding the
"Likely to sell out" badge / demand card (§3.7) — and the module's own comments explicitly describe the
anti-gaming intent this reopens: "counting them all is what puts a scarcity badge on a tour that shut for
a fortnight's maintenance." An operator can create/label closures loosely, then retroactively relabel
several of them SOLD_OUT within the 60-day window to manufacture the 3-event threshold, with no distinct
audit marker showing the reason was edited after creation (only generic `updatedAt` changes) — undermines
both the anti-gaming design and the "Date changes register is an audit trail" claim in `mapException`'s
docstring. This is confined to the operator's own tour (assertTourAccess scopes it), so not a cross-tenant
bug, but it's a real business-logic integrity gap. Flagged as the top fix-first item.

## Confirmed clean
- `createdBySide`/`retiredBySide`/`retiredAt`/`retiredByName` exist ONLY on `ExceptionResponseDto`
  (response), never on any request DTO — global ValidationPipe whitelist means the actor side can never
  be client-set; it's always computed server-side via `actorSide(role)` from the authenticated
  `TypedAuthUser.role`.
- Migration `20260813150000_exception_side_and_retire` backfill SQL is static (no interpolation, no
  injection risk). The `Role` enum has no `@map()`, so `WHERE u.role = 'ADMIN'` is a valid literal
  comparison (verified against enums.prisma) — not the classic "@map'd enum compared to the wrong string"
  trap. Known/documented limitation: backfill uses the creator's CURRENT role, so a since-promoted or
  since-demoted user mislabels historical rows' side — acceptable, explicitly disclosed in the migration
  comment, Low/informational only.
- `assertTourAccess` (availability.service.ts ~line 2042) is a solid ownership primitive: 404 if tour
  missing, ADMIN bypass, 403 on operator mismatch otherwise. Used correctly (ownership before any
  mutation) in createException, closeRange, reopenRange, closeAgendaDay (with-tourId branch), deleteException.
  `closeAgendaDay`'s no-tourId branch correctly resolves the CALLER's own operator via `operatorContext`,
  never client input.
- `availability-materializer.service.ts` and every "what's in force" read (agenda, overview, manageCalendar,
  day panel, closeRange/reopenRange/closeAgendaDay pre-checks, demand-signal) correctly add
  `retiredAt: null`. `listExceptions` (the Date Changes register) intentionally does NOT filter retiredAt —
  correct, it's meant to show full history including retired rows.
- Public endpoints (`checkAvailability`, `calendar`, `checkBatch`) read from the already-materialized
  `departure` table, never from `availabilityException` directly, and never expose exception ids to
  unauthenticated callers.

See also [[project_backend_audit_2026_08_02]] for the wider backend audit ledger and prior recurring bug
classes in this codebase.
