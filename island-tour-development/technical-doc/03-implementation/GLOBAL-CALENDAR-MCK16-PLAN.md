# Global Calendar (sidebar) - MCK-16 alignment plan

> v1.0 - August 13 2026. Mockup: `technical-doc/mck-16.html` ("MCK-16 v1 - Availability agenda,
> the Calendar section in the sidebar", August 11 2026). Do not confuse it with
> `technical-doc/mockups/mck-16.html`, which is an unrelated hub-hero mock.
>
> This plan maps every MCK-16 change onto the real code in both repos, states why each change is
> owed (with the surviving authority for it), lists the decisions that still need a call, and
> breaks the build into 5 dependency-ordered phases with per-phase checklists. Nothing here is a
> new design decision: every row traces to a rule that already ships on another surface or to a
> recorded founder decision.

---

## 0. Scope

**In scope**
- Dashboard repo (`tripwheel-x-islandtours-dashboard`): the global `/calendar` page and its
  component tree (`components/calendar/*`), plus the minimum parity sweep on the two sibling
  surfaces that share its hooks: the `/availability` agenda and the trip wizard Schedule tab.
- Backend (`island-tour-development/backend`): the availability module - reason propagation,
  actor attribution, reopen audit, range-close scope, staff grant, overview payload extensions.

**Out of scope (verified, not assumed)**
- The public traveler frontend. `frontend/lib/tours/calendar-day-state.ts` already renders the
  full MCK-15 reason map (Sold out = struck, Not running = plain grey, cutoff = struck "Closed").
  Nothing MCK-16 asks for changes the traveler contract; it only makes the operator side finally
  *write* the data that contract reads.
- The admin-side screens for the three operator-to-support escalations (cancel with bookings,
  capacity below booked, retiring a booked start time). MCK-16 itself calls this "the open admin
  card, not this file".
- The freshness nudge email job. It does not exist yet (no worker references
  `availabilityConfirmedAt`). MCK-16 only requires the button the future email will point at.

---

## 1. The two surfaces today (why this file exists)

The product has two dated surfaces writing the same `availability_exceptions` rows:

| | Trip wizard: Tours > [tour] > Schedule (surface B) | Sidebar Calendar `/calendar` (surface A) |
|---|---|---|
| Close asks a reason | Yes - reason IS the commit (`trip-availability-calendar.tsx:1534-1586`) | **No** - silent `CLOSE_SLOT`, no reason, no note (`departure-chip.tsx:133-165`) |
| Reason rendered after the fact | No (fetched, never shown) | No (API shape has no reason field) |
| Capacity control | None in the day panel (decided July 29) | **Capacity editor in the departure card** (`departure-chip.tsx:256-284`) |
| Audit timestamps | Island timezone (`trip-date-changes.tsx:133-140`) | **Browser timezone** (`departure-chip.tsx:243-252`) |
| Freshness | Stamps on visit (`step-schedule.tsx:186-189`) | Read-only line, stamps nothing |
| 30-day horizon warning | Yes (`step-schedule.tsx:283,312-324`) | None |
| State colours | green outline / blue solid / grey struck / past faded | green / blue / **red "Closed by you"** / grey "Departed or cancelled" |
| Cancelled state | Merged into Closed | Merged into Departed |
| UNIT tours | Charter copy, no seats field | Pill says **"Free"**, add form still offers Seats |

Surface A is the one an operator lives in (it is the only place showing every tour at once), and
it is the one that missed the August 7 rules. MCK-16 = apply B's rules to A, and fix the four
things both get wrong (reason display, cancelled state, reopen audit, platform attribution).

---

## 2. Authority status of MCK-16's citations

Surveyed August 13. This matters because the plan must cite what exists, not what MCK-16 wishes
existed.

| Cited source | Status | Where / what survives |
|---|---|---|
| Portal availability review v1.10 | EXISTS | `technical-doc/audits/island-tours-portal-availability-review.md` - sections 3.2c/d, 3.3.2, 3.4, 3.5, 5.3-5.5, F10, F13, F14, F16, and the §7 build addendum (F1-F17 shipped) |
| MCK-15 reason map | EXISTS | `technical-doc/mockups/mck-15.html` - the four-row portal-cause > traveler-rendering table |
| Master doc | EXISTS as **v1.9** (MCK-16 cites v1.17) | E.9 availability (all times tour-local, stop-sell wins, capacity floor), 3.7 demand signal, 7.2 bookability filter. **E.11 does not exist in v1.9**; unit pricing lives in E.3, not E.9 |
| access-roles-matrix | Only **v1.6 PDF** (`technical-doc/specs/`) | The v1.7 delta (staff close/reopen) survives in review §5.1/§7 and in shipped code (`STOP_SELL` permission, Guide designation) |
| island-tours-availability-dev-spec | **ABSENT** | §6.4/§6.5 content reconstructed from review quotes; nearest in-repo equivalent is `02-architecture/AVAILABILITY-AND-DEPARTURES.md` |
| FINDINGS-availability (AV-007..012) | **ABSENT** | AV numbers exist only inside mck-16.html; AV-012's content is unrecoverable |
| HANDOFF-availability §5 | **ABSENT** | The "three admin cases" are inferable from review §3.4/§3.2b only |
| R1-124 / R1-144 / R2-014 | **ABSENT** | Subject matter inferable from the citing rows only (close reason / editable add date / whole-boat wording) |

Consequence: where MCK-16 and a surviving doc disagree, the surviving doc wins and the conflict
is flagged in §5 (per the "master doc settles every conflict" rule) rather than silently resolved.

---

## 3. The twelve changes - what, where, why

File references: dashboard repo paths are relative to `tripwheel-x-islandtours-dashboard/`,
backend paths relative to `island-tour-development/backend/`. Line numbers as of August 13 2026.

### Change 1 - The close asks a reason (blocker)

**What.** Closing a departure (or a range, or a day) from `/calendar` must ask the same single
question the wizard asks - **Sold out** or **Not running** - with an optional note and a way out.
The reason is behavioural, not cosmetic: only Sold out feeds the §3.7 sell-out demand signal, an
operator-marked Sold out waits for the operator while a derived one self-heals, and the traveler
calendar strikes the date for Sold out but renders plain grey for Not running.

**Where - dashboard.**
- `components/calendar/departure-chip.tsx:133-165` - the silent close. Port the wizard's inline
  reason panel (`components/trips/trip-availability-calendar.tsx:1534-1586`: question, two
  reason buttons as the commit, note input, "Cancel, leave it open") into the departure card, and
  send `closureReason` + `note` in the `CLOSE_SLOT` payload. The payload type already carries the
  field (`types/trip.ts:986-987`) - it was simply never sent.
- `components/calendar/range-dialog.tsx:221-231` - close mode has a free-text "Reason (optional)"
  note but **no reason enum**. Add the Sold out / Not running segment (default **Not running** -
  a blackout is almost always a not-running act; weather is Not running plus a note, per the
  MCK-15 reconciliation) and send `closureReason` on `POST /availability/exceptions/close-range`
  (the backend DTO already accepts it: `dto/availability.dto.ts:491-520`).
- Wizard range close (`trip-availability-calendar.tsx:245-289`) - same gap, same fix, same sweep.

**Where - backend.**
- `src/availability/dto/availability.dto.ts:435-453` (`CloseAgendaDayDto`) - the agenda's
  close-day accepts `note` only. Add optional `closureReason`; store it (and a `closureBatchId`)
  in the write at `availability.service.ts:1045-1054`. Today a "close all of today" is invisible
  to the demand signal and reads as bare "Closed" to travelers.
- `dto/availability.dto.ts:749-771` (`UpdateExceptionDto`) - allow `closureReason` on PATCH so
  legacy reasonless closures can be **backfilled** (the mockup's own instruction: "Backfill it
  rather than renaming the label"). Stays `MANAGE_AVAILABILITY`-guarded as it is now.

**Why.** Review §3.2c/§3.4, MCK-15 reason map, master 3.7 (sellout events come from
`departures.sold_out_at`; an operator Sold out counts, a Not running must not), enums already
shipped (`prisma/enums.prisma:349-354` - exactly `SOLD_OUT` / `NOT_RUNNING`, no third value).

### Change 2 - Add departure takes a date

**What.** The add popover's date is a fixed prop rendered as read-only text; any other day means
closing the popover and hunting for the right cell. It becomes an editable date field defaulting
to the day it was opened from.

**Where.** `components/calendar/add-event-popover.tsx:204-206` (read-only date line) - replace
with a `DatePickerField`, min = today. The weekly-schedule tab derives `weekday` from the chosen
date (`171-199`), so the derivation input just moves from prop to field. Entry points that
prefill (`global-calendar.tsx:246,326`, `calendar-month-view.tsx:208-217`,
`calendar-time-grid.tsx:180-209`) keep working - they now prefill an editable field.

**Why.** Review §3.2c (add is date-scoped with a time picker) and §5.4; founder August 11.

### Change 3 - No capacity control in the departure card (blocker)

**What.** Remove the seats editor from the card. Capacity is a set-once property on the Details
tab; the wizard day panel deliberately has none; capacity changes sit at manager+ while staff may
close and reopen - so an inline capacity input here is both a decided-design break and a role
hole (it renders for anyone with `MANAGE_AVAILABILITY` on a card whose other action is staff-safe).

**Where.** `components/calendar/departure-chip.tsx:184-203` (mutation) and `256-284` (input +
save). Delete both; keep the seats line as read-only text. `PATCH /availability/departures/:id`
stays in the API for admin/support power use - it just loses this UI.

**Why.** Review §5.5 + acceptance item 4 ("The day panel has no capacity input", decided
July 29), matrix v1.6 (capacity below booked = admin-only), master E.9 capacity floor.

### Change 4 - One clock: tour-local everywhere

**What.** The same closure renders at different wall times on different surfaces because some
format in the browser's timezone. E.9 locks all display to tour-local; the week grid already
stamps its header with the island offset. Every timestamp on these surfaces formats in the
tour's IANA zone.

**Where - dashboard.**
- `components/calendar/departure-chip.tsx:243-252` - closure audit line uses date-fns `format`
  (browser tz). Switch to the island-zone formatter the register already uses
  (`components/trips/trip-date-changes.tsx:133-140`, `Intl.DateTimeFormat` with the tour's zone).
- `components/calendar/global-calendar.tsx:390-398` + `467-475` - the freshness line, same fix.
- `components/availability/availability-agenda.tsx:786` - same bug on the agenda row, same fix.
- Extract ONE shared island-time formatter (new `lib/trips/island-time.ts` or similar) instead of
  a third copy; `trip-date-changes.tsx` adopts it too. The overview response already carries
  `timeZone` per tour (backend `dto/availability.dto.ts:376-401`), so no backend change.

**Why.** Master E.9 "all times tour-local"; dev-spec §6.5 audit-line intent (a dispute cannot be
resolved when the same act renders as two different times); the register already does it right -
this is convergence, not invention.

### Change 5 - The reason shows, everywhere the closure does

**What.** Once a reason exists it renders on the departure card, in the day rows, and in the
Date changes register. Today the register says only "07:00 departure closed" while the capacity
row next to it carries its note; the card shows who/when/note but never why.

**Where - backend (the blocker half).** The reason never leaves the exceptions table on the
calendar feeds:
- `src/availability/availability.service.ts:630-639` (agenda closure select) and `884-893`
  (overview closure select) - add `closureReason`.
- Mappers `660-674` / `913-927` - thread it into the closure object.
- DTOs: `AgendaDepartureDto.closure` (`dto/availability.dto.ts:299-310`) and the overview closure
  shape - add the field. `GET /availability/exceptions` already returns it.

**Where - dashboard.**
- `types/trip.ts:486-493` (`OverviewDeparture.closure`) - add `closureReason`.
- `components/calendar/departure-chip.tsx:243-252` - render `Sold out` / `Not running` as the
  bolded lead of the audit line; a legacy null reason renders as "No reason recorded" with the
  backfill hint (mockup card copy), not silently.
- `components/trips/trip-date-changes.tsx:23-36,111-122` - the register's action label carries
  the reason ("Whole day closed - Not running").
- Wizard day card `trip-availability-calendar.tsx:1358-1397` - it fetches `closureReason` today
  and never shows it; render it there too.

**Why.** MCK-15 (the reason is the traveler-facing contract; an operator must see what travelers
are being told), review §3.2d (reason is an explicit register column).

### Change 6 - Week opens on desktop; Day becomes a list

**What.** The build opens on Month (localStorage-persisted). The decided agenda horizon is
today + 6 days - a week grid is that horizon in one screen, so **Week is the desktop default**.
Day remains the mobile default and becomes the chronological list the July 29 review specified
(time, tour, seats, state chip, one-tap Close/Reopen per row) instead of a one-day hour axis.
A separate "Close today" button was proposed August 11 and dropped the same day - the range tool
already covers it; do NOT add one.

**Where.**
- `components/calendar/global-calendar.tsx:76-86` - initial view: `week` on desktop, `day` under
  the mobile breakpoint; a stored user preference still wins after first change.
- New `components/calendar/day-list.tsx` - the chronological day list (mockup's `daylist`:
  header "N of M open", rows with time / name / sub-line / chip / action). `calendar-time-grid.tsx`
  keeps week rendering; its one-column day mode is retired from `/calendar`.
- The day-row quick Close routes into the same reason panel (change 1); a derived sold-out row
  gets a disabled "Automatic" action; past rows get disabled "Past".
- The "+N" overflow chip (`day-peek.tsx`) - opens the day view (`openDay`) rather than only
  expanding in place (MCK-16 §3, kept-list caveat).

**Why.** Review §5.3 (agenda horizon today + 6); founder August 11 (the dropped button).

### Change 7 - Freshness is an action

**What.** The rail line "Availability confirmed 11 Aug, 21:05" becomes the confirm card: state
line + one button ("Yes, today is right") that stamps `availability_confirmed_at`; visiting the
surface still stamps it. This button is the future nudge email's target.

**Where.** `components/calendar/global-calendar.tsx:390-398` - replace the passive line with the
confirm card (the `/availability` agenda already has both halves to copy:
`components/availability/availability-agenda.tsx:147-161` stamp-on-visit, `399-416` confirm
button, via `useConfirmAvailability` > `POST /availability/confirm`). Mobile strip `467-475`
follows. No backend change - endpoint shipped (`availability.service.ts:1087-1108`).

**Why.** Dev-spec §6.4 as quoted in review F14/§3.3.2; the endpoint exists and this surface is
the one place it is invisible.

### Change 8 - The empty horizon warns, in two flavours

**What.** A tour with no open departure in 30 days drops out of every ranked list (master 7.2
bookability filter) and the operator must not learn that from revenue. Two causes, two banners:
**Dry** (timetable ran out / closures) is amber with "Open their timetables"; **Full** (every
departure sold out for 30 days) is good news styled calmly - sold out is never an error - with
"Add a departure". One line covering every affected tour on this surface, not a banner per tour
(the per-tour banner already exists on the wizard step and stays there).

**Where - backend.** The binary exists (`computeIsBookable`,
`availability.service.ts:1805-1839`; nightly `refreshIsBookable` + `TOUR_UNLISTED_NO_DEPARTURES`
inbox event at `1847-1883`) but the dry/full cause split does not. Extend the overview response
with a `horizon` block: for each of the caller's LIVE tours with zero live-bookable departures in
the next 30 days, classify `full` (departures exist in-horizon and every one is sold out - stored
SOLD_OUT or closure-reason SOLD_OUT) vs `dry` (everything else), returning tour id + name per
bucket. Compute inside `overview()` (`availability.service.ts:783+`) reusing
`BOOKABLE_HORIZON_DAYS` and the live-status util - do not invent a second horizon.

**Where - dashboard.** `components/calendar/global-calendar.tsx` canvas top - one banner per
flavour (mockup's `warn` / `warn good` styling mapped to dashboard tokens: amber = warning
tokens, full = calm violet/muted), listing affected tour names, action buttons deep-linking to
`/trips/{id}/edit?step=schedule`.

**Why.** Master 7.2; review F13 + §3.4/§3.5 ("Sold out is deliberately celebratory, never styled
like an error"); founder challenge August 11 (the two-flavour split and the one-line rule).
**Copy caveat: see Decision D1 - the mockup's "tier is not billed" phrase.**

### Change 9 - Four states, the decided colours, shared by both surfaces

**What.** Surface A's legend is wrong twice: red for a routine closure (red is the cancelled
colour, and cancelled is the one state that moves money) and "Departed or cancelled" as one grey
state. The decided set (review §3.5): **Open** teal outline, **Sold out** violet solid, **Closed**
grey struck, **Cancelled** red outline, past simply fades. Neither surface renders Cancelled
distinctly today, and B shipped green/blue where the decided words are teal/violet.

**Where.**
- New shared module `components/calendar/departure-states.ts(x)` (or `lib/trips/`): one state
  derivation + one colour/label vocabulary, consumed by BOTH surfaces. Replaces
  `calendar-utils.ts:82-113` (A's derivation collapses CANCELLED into `past`) and the wizard's
  inline pill classes (`trip-availability-calendar.tsx:966-1004`, where `CANCELLED` renders as
  "Closed").
- Legend `global-calendar.tsx:48,375-389,453-466`: Open / Sold out / Closed / Cancelled + the
  microcopy lines ("Past departures fade. Sold out is revenue, never an error. Cancelled never
  appears from this surface...").
- Label fixes: "Closed by you" > "Closed" (attribution now lives on the row - change 10);
  "Departed or cancelled" > past-fade note + distinct Cancelled.
- Tokens: violet does not exist in the dashboard palette - see Decision D2.

**Why.** Review §3.5 (the one state system both surfaces were supposed to share); MCK-15 pill
classes; cancelled-moves-money is the platform's own colour grammar.

### Change 10 - A closure by Island Tours: attribution + reopen stays

**What.** Founder decision August 11: the operator MAY reopen a platform closure (a close is an
availability action, not enforcement - holding a tour off sale is unpublish/suspension, separate
instruments). The build's Reopen button is right. What is missing is attribution: the row must
name the side that closed it, because an operator undoing an Island Tours closure should know
what they are undoing. The review's locked line "Closed by you. Only you (or your team) can
reopen it." is now wrong. And reopening must be logged ("Reopening is logged too") - today a
reopen hard-deletes the exception row, erasing the closure from the register entirely.

**Where - backend (schema).**
- `prisma/availability.prisma` (`AvailabilityException`) - add `createdBySide` enum
  (`OPERATOR` / `PLATFORM`), set at write time from the actor's role (ADMIN and platform staff
  roles write PLATFORM; `assertTourAccess` at `availability.service.ts:1942-1960` already knows).
  Backfill migration: join `createdBy` to `users.role`, ADMIN > PLATFORM, else OPERATOR.
- Reopen audit - **soft-retire instead of hard delete** (see Decision D5): add
  `retiredAt` / `retiredBy` / `retiredBySide` to the exception row. `DELETE
  /availability/exceptions/:id` (`availability.service.ts` delete path) and `reopen-range`
  (`1186-1222`) set the retire fields instead of deleting. Every closure read filters
  `retiredAt: null` (closure resolution `588-659`, register list `1239-1244`, traveler calendar
  aggregation). The register then shows both the closure and its reopening.
- Expose `createdBySide` (+ retire fields on the register) in agenda/overview/exceptions payloads
  (same edit points as change 5).

**Where - dashboard.**
- `departure-chip.tsx` audit line + `trip-date-changes.tsx` row: "By {name} (Island Tours)" when
  side = PLATFORM; platform closures get the explainer card copy from the mockup ("Island Tours
  closed this departure, and you can reopen it...").
- Copy sweep for the dead line: legend label (change 9) plus the wizard day card line
  `trip-availability-calendar.tsx:1369-1378` ("Closed by {name}... Nothing reopens it
  automatically") - keep the mechanics sentence, drop any only-you claim.
- Register renders reopen events ("Reopened by {name} - {when}").

**Why.** Founder August 11 2026 (recorded in MCK-16 change 10); dev-spec §6.5 (every mutation
audited - reopens are mutations); master E.9 is silent on manual-vs-manual, so this decision is
the write-down.

### Change 11 - Unit tours say "Whole boat", and trips become tours

**What.** A private charter renders "Free" on a screen where every other number is seats sold -
it reads as no cost. The pill says **Whole boat** (noun per unit type - see D4) and the card
carries the review's sentence. Same sweep: the filter says "All trips" where the platform word is
tour.

**Where.**
- `components/calendar/calendar-utils.ts:130-135` (`seatsLabel`: UNIT > 'Free'/'Booked') - label
  becomes "Whole {noun}"; a booked unit reads as sold via its state, not via the label.
- `components/calendar/departure-chip.tsx:236-241` - card copy: "Whole {noun}, one group takes
  it all" / booked variant.
- `components/calendar/add-event-popover.tsx:274-285` - suppress the Seats field for UNIT tours
  (the wizard already does: `trip-availability-calendar.tsx:1501-1521`).
- `components/common/tour-filter-popover.tsx:57` - "All trips" > "All tours" (and the "1 trip"
  fallback). Check other consumers of the popover in the same pass.
- Backend: overview `tours[]` needs `wholeUnitType` to pick the noun
  (`dto/availability.dto.ts:376-401`, mapper `availability.service.ts:975-985`).

**Why.** Review F10 (shipped on the wizard, missed here) + F16 (tour, not trip); master E.3 unit
pricing (one booking takes the whole departure).

### Change 12 - Admin needs the operator

**What.** On the admin seat every pill looks like an operator pill; a departure cannot be traced
to a company without opening the card. The operator name belongs on the row. And the freshness
line cannot be one global stamp across every operator - the field is per tour, so admin gets the
overdue-tours list, not a confirm button.

**Where.**
- Pills/rows: `calendar-month-view.tsx` + `calendar-time-grid.tsx` + the new day list - append
  the operator name to the pill meta when platform-side (the `operatorNameById` map is already
  threaded: `global-calendar.tsx:127-130,429,442`; today it only reaches the card).
- `global-calendar.tsx:65` - `isAdmin = role === 'ADMIN'` misses platform STAFF/EDITOR; switch to
  `isPlatformWideRole()` (`lib/rbac-utils.ts:80-82`).
- Freshness for admin: rail card becomes "N tours not confirmed in 7 days" (no confirm button -
  admin does not confirm on operators' behalf). Backend: add per-tour `availabilityConfirmedAt`
  to overview `tours[]` so the dashboard can count/list.
- Server-side narrowing: the fetch never sends `tourId`/`operatorId` although
  `OverviewQueryDto` accepts both (`dto:337`) - wire the admin operator filter through the query
  instead of client-side filtering the downloaded window (`global-calendar.tsx:131-143`).

**Why.** Matrix ground rule (admin Full on Availability); the freshness field is per tour
(`tours.prisma:72`); client-side filtering breaks at platform scale.

---

## 4. Cross-cutting items from "what does not change"

These are kept-with-tweaks, not redesigns:

1. **Range tool, two changes only** (`components/calendar/range-dialog.tsx`):
   - Open with From = To = the day being viewed (fields currently start empty: `199-220`) and
     with **All tours** preselected - which requires the backend to accept an all-tours range
     close: make `tourId` optional on `CloseRangeDto` / `ReopenRangeDto`
     (`dto/availability.dto.ts:491-556`); service fans out over the operator's LIVE tours under
     one `closureBatchId` (`availability.service.ts:1113-1184,1186-1222`). Consequence line
     states departure/tour/booked-guest counts as the mockup does.
   - Ask the reason (part of change 1).
   - It stays the weather-day action; no separate "Close today" button - decided and dropped.
2. **Overflow "+N" chip** opens the day view instead of expanding in place (change 6 checklist).
3. **Footer sentence** ("All times are local to each tour's island. Counts show Island Tours
   bookings only, closing never touches booked guests.") - keep; add to `/calendar` rail if
   missing after the redesign.
4. **Week grid anatomy, shell, mini month, filters, view switch** - untouched.

**Staff seat (founder decision, August 11):** operator staff (STOP_SELL-only seats, e.g. the
Guide designation) may close/reopen, close a range, confirm freshness, **and add a one-off
departure** - but no capacity anywhere and no weekly schedules.
- Backend: `assertCanShapeInventory` (`availability.service.ts:131-144`, enforced at `379-384`
  and delete-side `522-530`) currently blocks ADD_SLOT for STOP_SELL-only seats. Relax: allow
  ADD_SLOT create with STOP_SELL **only when no capacity override is supplied** (capacity
  defaults to the tour's own); SET_CAPACITY and schedules stay `MANAGE_AVAILABILITY`. Allow
  STOP_SELL to delete an ADD_SLOT row (their own undo) - see Decision D3.
- Dashboard: Add button gates on `canStopSell` instead of `canShape`
  (`global-calendar.tsx:64-67,324-343`); for STOP_SELL-only seats the form hides the Weekly
  schedule tab and disables Seats with the explainer ("Uses the tour's own capacity. Setting a
  different number is a capacity change, and those stay at manager and up.").

**Known adjacent debts (not in this plan's scope, recorded so they are not mistaken for missed
work):** duplicate closure rows are possible (no unique constraint; reads use oldest-wins),
`GET /availability/departures` and `PATCH /availability/exceptions/:id` are MANAGE_AVAILABILITY
-only asymmetries, and the freshness nudge email job does not exist.

---

## 5. Decisions needed before/while building (with recommendations)

| # | Decision | Recommendation |
|---|---|---|
| D1 | **Banner copy: "tier is not billed".** MCK-16's banner says the tier is not billed during the unbookable window. Master 7.2 says "not billed for its tier during the unbookable period", but review §7 shipped the F13 banner WITHOUT the billing phrase because tiers have no recurring meter (commission-per-booking only) - there is nothing to pause. | Keep the shipped F13 copy: ranked-list consequence + "reachable by direct link", no billing claim. Flag to founder for a master-doc erratum. |
| D2 | **Sold-out violet + open teal tokens.** The decided colour words (review §3.5) are teal outline / violet solid; the wizard shipped green/blue on the existing success/info tokens; the dashboard palette has no violet. | Add two calendar-state tokens (violet solid for sold-out, teal for open) and align BOTH surfaces via the shared state module. Colour is decided language; tokens are the mechanism. |
| D3 | **Staff undo of their own one-off.** Matrix is silent. Blocking delete makes the staff Add un-undoable (the toast Undo would 403). | Allow STOP_SELL to delete ADD_SLOT rows. Capacity/schedule deletes stay manager+. |
| D4 | **"Whole boat" noun.** MCK-16 says "Whole boat"; the platform has `wholeUnitType` (the charter-split work already derives nouns from it). | Noun from `wholeUnitType` ("Whole boat", "Whole jeep", ... fallback "Whole unit"). "Whole boat" exactly matches for BOAT, and non-boat charters never read wrong. |
| D5 | **Reopen audit mechanism.** Options: (a) soft-retire the exception row (retiredAt/By/Side), (b) separate reopen-event rows. | Soft-retire (a): one row tells the whole story, the register shows close AND reopen, closure resolution just filters `retiredAt: null`, and no new table is needed. |

The phases below proceed on the recommended defaults; a different call on any of these only
re-touches its own checklist items.

---

## 6. Phased implementation plan

Order is forced by the cross-repo deploy rule: the backend deploys before the dashboard consumes
a new field, and the dashboard must tolerate the deploy window (drop unknown keys, render
conditionally - the `forbidNonWhitelisted` lesson). Each phase is one PR on its own branch
(backend PRs to `pixelvega/prod`, dashboard PRs to `pixelvega/main`), with code + security
reviewers after every phase and a Chrome verification pass before merge.

| Phase | Repo | Contents (changes) | Depends on |
|---|---|---|---|
| 1 | backend | Reason + attribution data model: reason on close-day and PATCH, `createdBySide`, soft-retire reopens, reason/side in feed payloads | - |
| 2 | backend | Surface data + permissions: overview per-tour `availabilityConfirmedAt` + `wholeUnitType` + horizon dry/full block, all-tours range close, staff ADD_SLOT grant | 1 (same files) |
| 3 | dashboard | Close-with-reason everywhere + card cleanup + attribution display (changes 1, 3, 5, 10-UI) | 1 deployed |
| 4 | dashboard | One clock + shared four-state vocabulary + unit wording (changes 4, 9, 11) | 2 deployed (wholeUnitType) |
| 5 | dashboard | Views + freshness + horizon + admin + staff-add + range defaults (changes 2, 6, 7, 8, 12; §4 items) | 2 deployed |
| 6 | both | Verification matrix, docs, MASTER-CHECKLIST + memory updates | 3-5 |

Phases 3-5 could collapse into two PRs if review load allows, but never ahead of their backend
dependency. Phase 1 and 2 may ship as one PR if the migration count stays at one.

---

## 7. Per-phase detailed checklists

### Phase 1 - backend: reason + attribution data model

Schema and migration:
- [x] `prisma/availability.prisma`: add `createdBySide ActorSide?` (new enum `ActorSide { OPERATOR PLATFORM }` in `enums.prisma`), `retiredAt DateTime?`, `retiredBy String?`, `retiredBySide ActorSide?` to `AvailabilityException`
- [x] Migration with backfill: `createdBySide` from `createdBy` join to users.role (ADMIN > PLATFORM, else OPERATOR; null createdBy stays null)
- [x] `pnpm prisma:generate` + `pnpm prisma:validate` green

Writes:
- [x] `CloseAgendaDayDto` (`dto/availability.dto.ts:435-453`): add optional `closureReason`; write it + a `closureBatchId` in `closeAgendaDay` (`availability.service.ts:1045-1054`)
- [x] `UpdateExceptionDto` (`dto:749-771`): allow `closureReason` (backfill path, MANAGE_AVAILABILITY as today)
- [x] Every exception create sets `createdBySide` from the resolved actor (single choke point near `availability.service.ts:423,1052,1161`)
- [x] `deleteException` + `reopenRange` (`service:1186-1222`): soft-retire (set retiredAt/By/Side) instead of `delete`/`deleteMany` for CLOSE_* rows; ADD_SLOT/SET_CAPACITY delete behaviour per D3 (retire those too for register completeness)
- [x] Duplicate-closure guard: creating a closure where an identical **active** (unretired) row exists stays idempotent/oldest-wins as today - assert with a test

Reads (every consumer of closure rows filters `retiredAt: null`):
- [x] Closure resolution `service:588-659` (agenda) and `884-927` (overview)
- [x] Traveler paths: `calendar()` day aggregation, `check`, `check-batch`, materializer interplay - sweep every `availabilityException.findMany` for the filter
- [x] Register `listExceptions` (`service:1239-1244`): returns retired rows WITH their retire fields (the register shows reopens); everything else excludes them
- [x] Agenda + overview closure objects (`service:630-674, 884-927`) and DTOs (`dto:299-310` + overview closure): add `closureReason`, `createdBySide`
- [x] Swagger decorators updated for every touched route

Tests + hygiene:
- [x] Unit tests: reason stored on close-day; side stamped operator vs admin; retire instead of delete; retired closures invisible to agenda/overview/traveler calendar; register shows both events; PATCH backfills reason
- [x] Existing availability spec suite green (baseline before change, diff test names)
- [x] `MASTER-CHECKLIST.md` + this doc updated in the same PR

### Phase 2 - backend: surface data + permissions

Overview payload:
- [x] `tours[]` gains `availabilityConfirmedAt` and `wholeUnitType` (`service:975-985`, `dto:376-401`)
- [x] New `horizon` block: `{ dry: [{id,name}], full: [{id,name}] }` over the caller's LIVE tours with zero live-bookable departures in `BOOKABLE_HORIZON_DAYS`; `full` = in-horizon departures exist and all are sold out (stored SOLD_OUT or closure-reason SOLD_OUT); reuse `availability-status.util.ts` - no second horizon constant
- [x] Admin scoping: horizon block respects `operatorId` narrowing; per-tour freshness serves the admin overdue count

Range close scope:
- [x] `CloseRangeDto` / `ReopenRangeDto`: `tourId` optional; absent = all the operator's LIVE tours (admin must pass `operatorId` or `tourId` - never platform-wide by accident)
- [x] Service fans out under one `closureBatchId`; reopen-range mirrors; response reports affected departure/tour counts for the consequence line
- [x] Throttle/size sanity: cap range length as today; test the multi-tour path

Staff grant (founder Aug 11):
- [x] `assertCanShapeInventory` (`service:131-144`): ADD_SLOT create allowed with STOP_SELL **iff no capacity supplied**; capacity present still demands MANAGE_AVAILABILITY; error copy updated
- [x] ADD_SLOT delete/retire allowed with STOP_SELL (D3); SET_CAPACITY + schedules unchanged
- [x] Tests: stop-sell-only seat can add a default-capacity one-off + undo it, cannot set seats, cannot touch schedules/capacity

Hygiene:
- [x] Swagger + DTO examples; spec suite green; MASTER-CHECKLIST updated

### Phase 3 - dashboard: close-with-reason + card cleanup + attribution

Reason flow (change 1):
- [x] Extract the wizard's reason panel into a shared component (`components/calendar/closure-reason-panel.tsx` or similar); wizard consumes the extraction (no behaviour change there)
- [x] `departure-chip.tsx`: Close opens the reason panel in the card; the two reason buttons are the commit; optional note; "Cancel, leave it open"; payload sends `closureReason` + `note`
- [x] `range-dialog.tsx`: Sold out / Not running segment (default Not running) + note; sends `closureReason`; wizard range close (`trip-availability-calendar.tsx:245-289`) same
- [x] Undo toasts preserved (close > undo reopens; reopen has no undo, as today)

Card cleanup (change 3):
- [x] Remove capacity mutation + input + save (`departure-chip.tsx:184-203,256-284`); seats line stays read-only
- [x] Card keeps: name, day line, state chip, seats line, audit line, Bookings/Timetable links, Close/Reopen

Reason + attribution display (changes 5, 10-UI):
- [x] `types/trip.ts` closure shapes: `closureReason`, `createdBySide` (optional fields - deploy-window safe)
- [x] Card audit line: "**Sold out** - "note" - By {name} (Island Tours) - {when}"; null reason renders "No reason recorded" + backfill hint
- [x] Platform-closure explainer block (mockup copy) when side = PLATFORM; Reopen stays enabled
- [x] `trip-date-changes.tsx`: reason in the action label; reopen events rendered ("Reopened by ...")
- [x] Wizard day card renders the reason it already fetches
- [x] Copy sweep: no surface says "Only you (or your team) can reopen it"

Review + verify:
- [x] code-reviewer + security-reviewer; fix confirmed findings
- [x] Chrome: close with each reason from card and range; traveler calendar shows strike vs plain grey accordingly; platform closure (admin seat) shows attribution on operator seat; reopen logged in register

### Phase 4 - dashboard: one clock + shared states + unit wording

One clock (change 4):
- [x] Shared island-time formatter module; adopt in `departure-chip.tsx`, freshness line, `availability-agenda.tsx:786`, `trip-date-changes.tsx` (replacing its inline copy)
- [x] "Today"/past reckoning on `/calendar` stays server-fed (`data.today`) - verify no browser-date regressions

Shared states (change 9):
- [x] `departure-states` module: one derivation (OPEN/SOLD_OUT/CLOSED/CANCELLED/past + cutoff) + one label/colour vocabulary; both surfaces consume it
- [x] Distinct Cancelled (red outline) on both surfaces; Closed = grey struck; routine closures never red
- [x] Tokens per D2 (teal open / violet sold-out) added once, used by the module only
- [x] Legend: four states + past-fades + "Sold out is revenue, never an error" + cancelled-never-from-here microcopy; "Closed by you" and "Departed or cancelled" labels retired

Unit wording (change 11):
- [x] `seatsLabel`: "Whole {noun}" from `wholeUnitType` (D4); card copy variants; add form hides Seats for UNIT
- [x] "All trips" > "All tours" in `tour-filter-popover.tsx` (+ audit its other consumers)

Review + verify:
- [x] Reviewers; Chrome check both surfaces render identical vocabulary for the same departure; timestamps match the register to the minute

### Phase 5 - dashboard: views, freshness, horizon, admin, staff-add, range defaults

Views (changes 2, 6):
- [x] Default view: week (desktop) / day (mobile); stored preference wins thereafter
- [x] New chronological day list replaces the one-column hour axis on `/calendar`; rows: time, tour, sub-line (seats or whole-unit copy; reason + by-line when closed), state chip, quick action (Close > reason panel; Reopen; disabled Automatic for derived sold-out; disabled Past)
- [x] "+N" chip opens the day view
- [x] `add-event-popover.tsx`: editable date field defaulting to the opened day; weekly tab derives weekday from the field; min = today
- [x] No "Close today" button anywhere (decided-against; note in code comment on the range dialog)

Freshness (change 7):
- [x] Confirm card in the rail (+ mobile strip): unconfirmed state with button > confirmed state; stamp-on-visit on `/calendar` mount (parity with `/availability`)
- [x] Admin variant: "N tours not confirmed in 7 days" list (per-tour `availabilityConfirmedAt`), no confirm button

Horizon banners (change 8):
- [x] Dry banner (amber): tour names + ranked-list consequence + "Open their timetables" deep links; copy per D1 (no billing claim)
- [x] Full banner (calm): celebratory copy + "Add a departure"; never error-styled
- [x] One line per flavour regardless of tour count

Admin (change 12):
- [x] Operator name on pills and day-list rows (platform seats only); `isPlatformWideRole()` replaces the raw ADMIN check
- [x] Operator filter narrows server-side (`operatorId` on the overview query); client filter remains for tour chips

Staff add (§4):
- [x] Add button gates on `canStopSell`; STOP_SELL-only seats: no Weekly tab, Seats disabled with the capacity explainer; payload omits capacity

Range defaults (§4):
- [x] Dialog opens with From = To = viewed day, All tours preselected (new backend scope); consequence line reports departures/tours/booked-guests counts

Review + verify:
- [x] Reviewers; full Chrome matrix (below)

### Phase 6 - verification + docs

- [x] Chrome walkthrough: admin seat (close-with-reason round trip, platform attribution, island clock, logged reopen, day list, week default, legend, per-tour freshness) and operator seat (confirm card + stamp-on-visit persistence) verified live; mobile width verified at 400px (Day-list default, stacked toolbar, no page overflow). Staff (Guide) seat: service guards unit-tested; UI walkthrough needs the product.pixelvega Guide login - the one remaining manual check: owner/manager (everything), staff seat (close/reopen/range/confirm/add-one-off only - no seats field, no weekly tab, no capacity anywhere), admin (operator names, operator filter, overdue-freshness list, platform-attributed closures)
- [x] Traveler round trip: Sold out close -> date struck through on the public calendar; Not running -> plain grey, no strike; reopen -> bookable again (verified on sunset-sail-with-open-bar, 2026-08-13)
- [x] Demand-signal spot check: a whole-day Sold out close = exactly 1 batch-collapsed event; Not running and slot closes = 0; retiring the closure withdraws the evidence while keeping the retire audit (verified against the live DB)
- [ ] Range close on a day with bookings: consequence line counts correct; Undo restores the whole range
- [x] This doc's checkboxes flipped; memory resume-point updated (MASTER-CHECKLIST carries no MCK-16 rows - the mockup is client-driven, not a master point)
- [x] D1 resolved by the founder 2026-08-13: keep the shipped copy, no billing claim (master 7.2 phrasing stands as-is)

---

## 8. Acceptance criteria (the mockup's own bar)

1. No close on any dashboard surface commits without a reason; the reason is two buttons, not a
   dropdown; the note stays optional; there is always a "Cancel, leave it open".
2. A closure renders its reason + actor + side + island-local time in: the departure card, the
   day list row, and the Date changes register. A reasonless legacy row says so explicitly.
3. The departure card has no capacity input on any seat.
4. The same closure timestamp reads identically (island time) on every surface it appears.
5. `/calendar` opens on Week on desktop, on the day list on mobile; no Close-today button exists.
6. The rail confirm card stamps `availability_confirmed_at`; visiting the surface stamps it.
7. An operator whose tour is unbookable-in-30-days sees the right flavour of banner on
   `/calendar` before they could notice it in revenue.
8. Legend = Open / Sold out / Closed / Cancelled, decided colours, past fades; both surfaces
   share one vocabulary; a routine closure is never red.
9. An Island Tours closure is labelled as such on the operator's row, with reason, and the
   operator can reopen it; the reopen appears in the register.
10. A UNIT departure never renders "Free"; the filter says "All tours".
11. Admin sees the operator on every row and a per-tour freshness picture, and the operator
    filter narrows at the server.
12. A STOP_SELL-only seat can close, reopen, range-close, confirm, and add a default-capacity
    one-off - and nothing else.
