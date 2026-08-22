---
name: project_mck16_calendar_state_unification
description: Dashboard repo MCK-16 "one clock + one state vocabulary" calendar unification - Phase 4 stragglers confirmed fixed in Phase 5 (commit 27373bd); Phase 5 introduced its own new class of issues, tracked below
metadata:
  type: project
---

MCK-16 (dashboard repo, `tripwheel-x-islandtours-dashboard`) is unifying the availability calendar
across three surfaces - the global calendar (`components/calendar/`), the wizard's per-tour Schedule
calendar (`components/trips/trip-availability-calendar.tsx`), and the agenda list
(`components/availability/availability-agenda.tsx`) - onto ONE departure-state vocabulary
(`components/common/departure-states.ts`: open/soldOut/closed/cancelled/past) and ONE audit-timestamp
clock (`lib/island-time.ts`, tour's island zone via `islandTime()`).

**Phase 4 stragglers (previously flagged) - VERIFIED FIXED in Phase 5, commit `27373bd`
(reviewed 2026-08-13):** `availability-agenda.tsx`'s legend/row-wash/dot now index
`DEPARTURE_DOT_CLASS`/`DEPARTURE_STATE_LABEL` instead of the old success/info/destructive tokens;
its freshness card uses `islandTime()`; the wizard's `SlotRow` sold-out stamp uses `islandTime()`;
the wizard's month pill indexes `DEPARTURE_CHIP_CLASS`; `lib/island-time.ts` now has the same
try/catch malformed-IANA-zone guard as `gmtLabel()`. The commit message's claims here were accurate
- good sign this team follows through on self-flagged review debt.

**Phase 5 (commit `27373bd`, "week opens on desktop, Day becomes the list...") - NEW findings:**

1. **The drift mechanism recurred a third time, in a NEW spot, inside a file that ALSO fixed a prior
   straggler:** `availability-agenda.tsx` `AgendaRow` (~line 822-824) hand-derives
   `departed`/`manuallyClosed` booleans from `row.status`/`row.cutoffPassed`/`row.closure` for the row
   wash + text, then ~40 lines later (~line 865) calls the real `departureState()` for the dot color -
   TWO independent expressions of the identical closed-vs-past rule in the same component. Currently
   they agree bit-for-bit, but nothing enforces that. Fix: derive `departed`/`manuallyClosed` FROM the
   `departureState()` result, not re-implement the branch.

2. **The wizard's month pill still can't render "Departed":** `trip-availability-calendar.tsx`
   DayCell now passes `hasClosure` to `departureState()` (the Phase 4 fix) but STILL never passes
   `cutoffPassed` - and can't, because `TourDeparture` (`types/trip.ts`) has no `cutoffPassed` field at
   all. So on that one surface, every departed CLOSED slot with no operator closure still renders
   "Closed" (grey), never "Departed" - a real backend-data gap, not an oversight the commit
   overclaimed (it only claimed the hasClosure fix).

3. **New in Phase 5, not a straggler:** the day view's `filteredDays.find(d => d.date === anchor)`
   (`global-calendar.tsx:631`) combined with `useAvailabilityOverview`'s
   `placeholderData: (prev) => prev` (`hooks/trips/use-trips.ts:656`) - since the day-view fetch
   window is exactly 1 day (`viewWindow('day', anchor) => {days: 1}`), ANY anchor change while in Day
   view guarantees a query-key change whose placeholder (stale, old-anchor-only) data cannot contain
   the new anchor. Result: `day` is `undefined` and `day-list.tsx` flashes "Nothing runs this day" on
   every Next/Prev/Today/jump click in Day view, until the real fetch lands. Week/Month views don't
   have this because their window spans many days, so old data stays populated (stale but not empty)
   during the transition.

4. **`RangeDialog`'s remount key includes `anchor`** (`global-calendar.tsx:681`,
   `key={\`${rangeOpen}-${tourId ?? 'all'}-${anchor}\`}`) - intentional for "fresh fields on
   `rangeOpen` toggle", but `anchor` can ALSO change while `rangeOpen` stays `true`, via the
   pre-existing today-snap `useEffect` (fires once `data.today` resolves, if the user opened Range
   before the initial overview fetch landed) - discarding whatever the user already typed into the
   dialog, silently, via a full remount of an open modal.

5. **`day-list.tsx`'s `reasonRowId`/`note`/`error` state is NOT reset on `day` prop change** and
   `CalendarDayList` is not date-keyed in its parent (only `key={view}` on the wrapping
   `motion.div`) - navigate away from a day mid-close-note, then back to the SAME day (real DB
   departure ids persist), and the reason panel silently reopens with the stale note, uninvited.

6. **`min-h-104` on the grid frame div is never cleared at `lg:`** (`global-calendar.tsx:586`) - the
   Phase 5 horizon banners (`:537-580`) are new siblings inserted ABOVE it with no compensating
   `lg:min-h-0` on the frame, so on short/cramped lg-xl viewports (e.g. 1366x768, where the
   `xl:hidden` toolbar cluster commonly wraps to 2 lines) the frame's hard floor can exceed the
   `self-stretch` budget the whole column is built around - breaks the deliberate "calendar always
   ends at the viewport bottom, never a page scrollbar" contract documented in the big comment at the
   top of `GlobalCalendar`.

7. **`canShape` naming drifted from its meaning:** this commit rewired all 3 render-gates that used
   to read `canShape` (`can('MANAGE_AVAILABILITY')`) to read `canStopSell`
   (`canAny(['MANAGE_AVAILABILITY','STOP_SELL'])`) instead, per the founder's Aug 11 STOP_SELL grant
   - but left the prop through `CalendarMonthView`/`CalendarTimeGrid` named `canShape`, and left the
   now-fully-unused `const canShape = can('MANAGE_AVAILABILITY')` declared at
   `global-calendar.tsx:88`. Grep for `canShape` on the next phase - if it's still only feeding
   `canShape={canStopSell}`, rename the prop or delete the dead local.

**Why this keeps happening:** every one of these is exactly what the shared `departure-states.ts`
module's own doc comment warns about - the fix lives in ONE place, but callers keep re-expressing the
same fact locally out of convenience (a raw `Intl`/boolean ternary is one line quicker to write than
importing the shared helper). The fix pattern is always the same: derive the auxiliary values FROM the
canonical function's output, never recompute them in parallel next to it.

**How to apply on the next MCK-16 phase:** (1) grep the WHOLE touched file for hand-rolled
status/cutoff/closure boolean logic sitting near (not necessarily inside the diff hunk of) a
`departureState()` call - the AgendaRow case proves "the fix is 40 lines above/below the call" is a
real pattern here, not hypothetical. (2) When a permission gate's semantics change (e.g.
`canShape`→`canStopSell`), grep every prop NAME that carried the OLD narrower permission through
child components - a value swap without a rename is exactly how a reader gets misled later. (3) When
a `key` prop on a modal/dialog includes state that can change from an effect (not just from a user
click while the modal is definitely non-interactive-background), check whether that effect can fire
while the modal is open.
