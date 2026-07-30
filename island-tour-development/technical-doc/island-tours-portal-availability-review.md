# Island Tours Operator Portal, Availability: Review and Redesign

**Version:** 1.10 · July 29, 2026 (v1.9 + a plain-language note for the dev on what happened to the Date Exceptions card; §3.2 heading matches the final tab name) · **Author:** Cowork session for Denley
**Reviewed build:** operator portal, tour editor, Schedules tab (screenshot July 27, 2026, "Sunset Champagne Sail, Private Charter")
**Sources:** island-tours-platform-master.md v1.17 (E.9 canonical, wins on any conflict) · island-tours-availability-dev-spec.md v1 (§6 portal requirements) · island-tours-access-roles-matrix.md v1.6 (the July 27 two-surface decision)
**Status:** design proposal for the portal build. No master change required: E.9, the dev spec, and matrix v1.6 already define the model and the split; this document specifies the UX that implements them. Companion files: `island-tours-portal-availability-final.html` (**the build reference**: the KISS Schedules tab plus the daily Availability agenda on one shared model, in the dev build's visual language) · `island-tours-portal-availability-mockup.html` and `island-tours-portal-availability-mockup-kiss.html` (the exploration behind it).

---

## 1. What this part of the backend must achieve

The availability system is the heart of the operator portal, and the one place where a design mistake costs real money in both directions:

1. **The platform is the single source of truth** and always current, regardless of any operator API status (E.9 principle 1). For roughly 40 percent of operators there will never be an API: they maintain availability by hand, ideally daily.
2. **The daily habit is stop-sell.** A non-API operator's core action is "this date is full (or the boat is out), stop selling it". If that takes more than a few seconds on a phone at the dock, operators will not do it, and the platform sells seats that do not exist. That is the worst failure the marketplace can have: guests standing on a pier for a boat that is full.
3. **Availability has commercial teeth.** A tour with no open departure in the next 30 days drops out of every ranked listing and its tier billing pauses (7.2). `departures.sold_out_at` feeds the sell-out demand trigger (3.7). Wrong availability is wrong revenue, for the operator and for Island Tours.
4. **Setup and daily use are different jobs done at different frequencies** by possibly different people (owner vs staff). Matrix v1.6 therefore locks two surfaces on one model: per-tour setup as a tab under Tours (rarely touched) and a cross-tour daily agenda as the Availability nav section (the habit, mobile first, the FareHarbor pattern).
5. **Guardrails are non-negotiable:** manual stop-sell always wins and is never silently reopened; capacity never drops below booked count from the portal; closing a date never touches existing bookings; every mutation writes an audit line.

The screenshot under review implements the storage model (schedules, exceptions) faithfully, but as forms. It is a correct admin screen and a weak operator tool. The redesign below keeps every concept and inverts the presentation: **calendar first, forms become one-tap actions on the calendar.**

---

## 2. Review of the current Schedules tab

Severity: **Blocker** (defeats the purpose of the surface) · **High** (will cause operational errors or support load) · **Medium** (friction, confusion) · **Low** (polish, copy).

| # | Severity | Finding | Why it matters | Fix |
|---|---|---|---|---|
| F1 | Blocker | **No calendar, no view of actual departures.** The tab shows rules and an exceptions form, never the result: which departures exist, on which dates, with how many booked. | The operator's mental model is a calendar ("August 28 is full"), not a rule table. Dev spec §6.2 explicitly requires an exceptions calendar ("tap a date to close it"). Closing a date today means translating a date into a four-field form, blind. | Month calendar of materialized departures becomes the primary element of the tab. Tap a date, see its slots and booked counts, act. See §3.2. |
| F2 | Blocker | **No booked/capacity numbers anywhere.** | Every availability decision (close, change capacity, add a slot) depends on how many seats are sold. Without counts the operator cannot see that Aug 28 is at 38/40, and cannot be stopped from cutting capacity below booked (E.9: portal may never do that). | Booked/capacity on every departure pill, day panel, and agenda row. Capacity inputs get `min = booked_count` with the explanatory line. |
| F3 | Blocker | **"Close" and "cancel" are blurred.** The Date Exceptions intro says "cancel a single slot"; the type card says "the captain is out". | Closing stops new sales and never touches existing bookings. Cancelling a departure with bookings is the heavy 6.2 flow (full refund or free reschedule, admin-executed in v1). An operator who thinks close = cancel will strand booked guests; one who fears close = cancel will not dare to stop-sell. | One verb per concept, everywhere: **Close (stop selling)** vs **Cancel departure** (routes to a support/admin flow, never a casual toggle). Every close confirmation states "Existing bookings are kept." See §3.4. |
| F4 | High | **The two-surface split is missing.** Everything, including daily exceptions, lives inside one tour's edit flow. | Matrix v1.6 (July 27): daily ops belong in a cross-tour Availability section in the nav, mobile first. A three-tour operator on a stormy morning cannot open three tour editors to close the day. | Keep this tab as **setup for this tour** (timetable + this tour's calendar). Build the **Availability agenda** as its own nav section: today and coming days across all tours, one-tap close, bulk blackout, Close today. See §3.3. |
| F5 | High | **Start Times are editable in two places with contradictory helper copy.** This tab says "declared here"; the Add Schedule helper says "edit the set on the Details tab". A typed but unsaved "09:00" sits in an input with no draft state. | Two homes for one set guarantees drift and support tickets. Deleting a declared time that live schedules or booked departures depend on is one click with no stated consequence. | One home for the time set, inside the timetable flow: adding a timetable row can declare a new time in the same motion; removing the last row that uses a time offers to retire the time. Guard rails on removal (active rules, future booked departures). See §3.2, step "Add times where you use them". |
| F6 | High | **Weekday tabs (Mon 1 · Tue 1 · ... · Fri 0) hide the week.** A rule spanning 7 weekdays materializes as 7 rows reachable one tab at a time; pausing "the 16:30 sailing" means 7 separate pauses; the Friday gap is invisible unless the Fri tab is clicked. | The storage model (one row per weekday and time) is leaking into the UI. Operators think in patterns ("daily at 16:30 except Friday"), not in per-weekday rows. | Group identical rules into one pattern row: "16:30 · Mon to Sun, not Fri · capacity default". Weekday chips on the row toggle days directly. A quiet gap hint ("No departures on Fridays") replaces the Fri 0 tab. See §3.2. |
| F7 | High | **Pause is three different things with no stated consequences.** Pause (tour, header), Pause (schedule row), and closing dates all read as "stop". What pausing does to already-materialized departures (nothing, for booked ones: re-materialization is forward-only and never touches booked departures) is nowhere. | An operator who pauses the tour or a schedule expecting today's sales to stop is wrong: booked departures stay live and open ones may too until the job runs. That is a silent overbooking path. | Consequence dialogs on every pause/remove: what happens to future departures, what happens to booked ones, and the one-tap alternative ("To stop selling specific dates, close them on the calendar"). Copy in §3.4. |
| F8 | High | **No bulk blackout.** The exception form takes exactly one date. | Dev spec §6.2 requires blackout ranges. A two-week maintenance haul-out is 14 forms today. | "Close a range" action on the calendar (start, end, reason), stored as bulk `close_date` rows, undone as one unit. |
| F9 | Medium | **The exception form is type-first, context-last.** You choose "Close entire day / Close one time slot / Add extra departure / Change capacity" before seeing what exists on the date. | Type-first requires the operator to already know the answer. Date-first shows the day (slots, booked, state) and makes the four types self-evident buttons in context. | The day panel replaces the form (§3.2). The four exception types survive unchanged as the day panel's actions; the API contract does not change. |
| F10 | Medium | **Unit-priced private charters get seat-tour copy.** "Capacity Override: leave blank to use the tour's max party size", "default cap", readiness chip "Capacity set (max party size or per-schedule override)". | For `pricing_model: unit` (this very tour), one booking takes the whole departure (E.9); capacity is 1 unit and max party size is a guest ceiling, not seats. Seat copy invites operators to "raise capacity" expecting more bookings per sailing. | Copy adapts by pricing model. Unit tours: "Private charter: each departure takes one booking (up to {max_party_size} guests)". Capacity override hidden for unit tours except an explicit "I run multiple boats" path, which is an add_slot/second-departure question, not a capacity one. |
| F11 | Medium | **Raw jargon in the rule list:** "default cap", "From 16 Jul 2026" with no explanation, enum-flavored labels ("Recurring Schedules", "Date Exceptions"). | The portal's audience is a dive-shop desk, not the data model. Every label that mirrors a table name ("availability_schedules") externalizes internal vocabulary. | Naming: tab = **Availability**; sections = **Weekly timetable** and **Calendar**; exceptions list = **Changes to specific dates**. Resolved values, not placeholders: "Capacity 40 (tour default)". |
| F12 | Medium | **No audit surface and no undo.** Exceptions and schedule changes show no who/when; deleting is instant. | Dev spec §6.5: "I closed that date" disputes must be resolvable. Undo is also the cheapest safety net for one-tap actions. | Every override row shows actor and time ("Closed by Maria · Jul 28, 14:02"). Every one-tap close gets an inline Undo (which writes its own audit line). |
| F13 | Medium | **The 30-day bookability consequence is invisible after publish.** The readiness chip checks it once, but nothing warns a live tour whose calendar is running dry. | 7.2: no open departure in 30 days = out of every ranked listing and tier billing paused. Operators should never discover this from their revenue. | Persistent warning banner on both surfaces when the horizon is empty (or nearly empty), with the consequence spelled out and the one-tap fix ("Extend your timetable"). Copy in §3.4. |
| F14 | Medium | **No freshness mechanism.** `availability_confirmed_at` (E.9, matrix v1.6) has no UI. | The nudge system needs a confirm action, and the confirm action is also the habit anchor for daily portal visits. | "Confirm today's availability" card at the top of the agenda (§3.3); visiting the availability surfaces also stamps it per dev spec §6.4. |
| F15 | Low | **Publish Readiness arithmetic and label.** Badge says 5/5 while 7 chips render; "TO BE LISTED" reads as a status, not a heading. | Erodes trust in the checklist. | One count over one visible set (or "5 required, 2 recommended" split); heading "Required to be listed". |
| F16 | Low | **Copy inconsistencies:** footer "Next: Text" vs tab "Content"; "Edit trip" vs the platform-wide "tour"; no timezone note anywhere. | Small, but this is the surface operators live in. | "Next: Content"; "Edit tour"; one quiet line "All times are local to {island}" (AST, no DST) on the availability tab. |
| F17 | Low | **Sold out is not a first-class visible state.** Nothing in this UI distinguishes "sold out by bookings" (automatic, good news) from "closed by you" (manual). | The two states have different semantics: sold_out flips back automatically on cancellation or capacity raise, manual close only by hand (manual always wins, E.9). Operators must see which is which to trust the system. | Distinct visual states everywhere: Open / Low / **Sold out** (automatic, celebratory) / **Closed** (manual, neutral) / Cancelled. See §3.5. |

**What the current build gets right, keep it:** the model mapping is faithful (declared times constrain schedules and exceptions, exactly E.9); the four exception types are the right four; validity windows (seasonal patterns) are present; the readiness checklist ties departures to listability; visual style is clean and consistent with the rest of the portal.

---

## 3. Redesign

### 3.0 Architecture: two surfaces, one model

In one sentence each: the **Tours tab (Schedules)** is where an operator builds and corrects one tour's schedule; the **Availability section** is where the operator and their staff run the day across ALL their tours at once: one chronological list of today's departures, one-tap close, one confirm. A one-tour operator gets the same two places, just with shorter lists.

| | **Tour setup** (Tours → tour → Availability tab) | **Daily agenda** (Availability, own nav section) |
|---|---|---|
| Job | Define the pattern: timetable, seasons, capacity defaults. Inspect and override this tour's calendar. | Run the day(s): confirm, close, reopen across all tours. |
| Frequency | Rarely (onboarding, season change) | Daily, the habit |
| Primary device | Desktop | Phone (thumb-first), works on desktop |
| Typical seat | owner / manager | any seat incl. staff at the desk or dock |
| Writes | schedules, declared times, per-date changes (via this tour's calendar) | per-date changes only (close_date / close_slot / add_slot via rows and the day card), `availability_confirmed_at` |

Both write the same `availability_exceptions` and read the same materialized `departures`. Nothing in the data model or API contract changes; this is presentation only.

### 3.1 Nav and naming

- The tour-editor tab keeps the dev build's name **Schedules** (decided in the KISS pass: with the nav section named Availability, two things called Availability would be worse than the original name; this supersedes the F11 fix cell above).
- Add the nav section **Availability** (matrix v1.6 already lists it; operator column: Own).
- Inside the tab: **Weekly Schedule** card, then **Calendar** card, then **Date Changes** (the register of one-off changes). The word "exception" never renders for operators.

### 3.2 Surface A: the tour's Schedules tab

**Where your Date Exceptions went (for the dev, in one paragraph).** The starting point was the existing Schedules tab from the build (the reviewed screenshot), and its Date Exceptions concept survives in full: the same change types (close entire day, close one time slot, add extra departure, set capacity), the same `availability_exceptions` storage, the same API contract. What changed is presentation only, in two moves. First, the entry point flipped from type-first to date-first: instead of picking a type and then a date in a form, the operator taps the date on the calendar and the applicable types appear as buttons in the day card, with booked counts in view (`set_capacity` deliberately has no day-card button; it stays reachable through the timetable flow and the API, see §5.5). Second, the list at the bottom was renamed from Date Exceptions to **Date Changes** and shows every one-off in operator language ("Whole day closed · Fully booked", "18:00 added (one-off)") with who, when, and a Reopen or Remove button. So exceptions were not removed; they were made self-evident. An operator never needs to know the word "exception" to use them, and nothing changes for the backend.

**Layout, top to bottom:** Weekly Schedule → Calendar (the centerpiece) → Date Changes, with one quiet line under the tab title: "All times are local to Curaçao." The status line under (a) is a build-level addition on top of the reference mockup.

**a) Status line (build-level; not in the reference mockup).** One line that answers "is this tour selling?": next open departure, departures open in the next 30 days, and (when relevant) the warning state from F13. The warning variant is required (7.2 has commercial consequences); the healthy-state line is nice-to-have. Examples:

> Next departure: Thu Jul 30, 09:00 · 41 open departures in the next 30 days.

> ⚠ No open departures in the next 30 days. This tour is hidden from ranked listings and tier billing is paused until a date opens (it stays reachable by direct link). **Extend timetable**

**b) Weekly Schedule.** Pattern rows, grouped, not per-weekday rows (F6):

```
16:30   M T W T F S S      Capacity: 1 booking per departure (private charter)
        [F dimmed/off]     Since Jul 16, 2026 · open ended          Active ▸
```

- One row per (time × identical settings); the weekday chips on the row toggle days directly (writes/deletes the underlying per-weekday rows; the model is untouched).
- Seat tours show "Capacity 40 (tour default)" or the override; unit tours the private-charter line (F10). Capacity itself is a set-once tour property (Details tab) and serves both channel strategies unchanged: **free-sale** (capacity = the real seat count, everywhere, close when full; the expected default for most operators) and **allotment** (capacity = the share given to Island Tours). Day-to-day channel management is closing, not number-editing.
- Season rows (valid_from/valid_until, build-level; not in the reference mockup) render as a second line ("Dec 1 to Apr 30"); overlapping seasonal variants of the same time stack under one time heading.
- Row menu: Edit · Pause · Remove, each with a consequence dialog (§3.4, F7). In the reference mockup, Remove appears once a row is paused: pause-first is the natural confirmation step for a destructive action, and removal keeps booked departures per the forward-only rule.
- **Add times where you use them (F5):** "Add departure time" opens one inline flow: a free time input (the time is declared on the tour in the same motion; a time that already has a row is guarded away), toggle weekdays, optional capacity override, optional season. The Add button is visually distinct from the weekday chips. The snackbar confirms the effect after saving and the calendar shows the new departures immediately. Build-level guard: removing the last row that uses a time offers to retire that time from the tour; retirement is blocked while future booked departures still use it.
- Gap hint when a weekday has zero rows: "No departures on Fridays." (quiet, informational; it doubles as the F6 fix).

**c) Calendar, the centerpiece.** A month grid (Mon-first, matching the portal) of **materialized departures**, not of rules:

- **Cell anatomy:** date number + one pill per slot: `09:00 34/40`. Unit tours: `16:30 Open` / `16:30 Sold out` (one sold-out label everywhere; "Booked" was tried for private charters and read as an inconsistency). Cells with no departures show a quiet "No departures" hint. Today gets a ring; past days fade and are read-only (history stays visible).
- **States (§3.5):** Open (teal outline) · Low, under 5 left (amber) · Sold out, automatic (violet, solid) · Closed, manual (gray, struck) · Cancelled (red outline) · Cutoff passed renders as gray "Closed" per the consumer contract but only affects today.
- **Tap a date → day card**, rendered inline directly under the calendar (no drawer, no overlay; the reference mockup pattern):
  - Header: "Friday, Aug 28" + day state.
  - Per slot: time, booked/capacity, state, actions **Close** / **Reopen**, and per-slot notes. No capacity editing in the day panel (decided July 29): operators manage channels by closing, not by number-editing. The `set_capacity` exception stays in the model, the timetable flow, and the API (floor: never below `booked_count`) for support and allotment-style power use.
  - Day actions, rendered contextually: **Close entire day** (the headline action; this is the "Aug 28 is full" one-tap) shows at 2+ departures, since a single-slot day is fully covered by the slot's own Close; the optional reason row (Fully booked · Other, plus a free note) shows only while something is still open to close; **Add one-off departure** (`add_slot`) offers the tour's own times plus a free "Other time" picker.
  - After closing: confirmation line "Day closed. New sales stopped. 46 booked guests keep their bookings." + **Undo**. Audit line appears immediately: "Closed by you · just now".
  - Sold-out slots explain themselves: "Sold out from bookings at 16:12. Reopens automatically if a spot frees up (cancellation or capacity raise). No action needed."
- **Close a range** (build-level; dev spec §6.2 requires blackout ranges; not in the reference mockup, a working pattern sits in the v1 exploration file): start, end, reason → bulk close_date rows, one log entry, one Undo.
- The E.9 change types map 1:1 to day-card actions; the form disappears, the API stays.

**d) Date Changes (the register).** Reverse-chronological list of one-off changes with date, action, reason, actor, timestamp, and Reopen (closures) or Remove (added one-offs). This is the audit surface (F12) and the undo-later mechanism, per selected tour. Empty state: "No date changes yet. Tap a date on the calendar to close it or add an extra departure."

### 3.3 Surface B: the Availability agenda (nav section)

The daily habit, designed thumb-first. **This is the one-operator, all-tours page:** every departure across the operator's tours in one chronological list, so a three-tour operator never opens three tour editors to run one morning. A one-tour operator sees the same page, just shorter and without the filter row. One screen answers: *what runs, how full is it, and can I stop or confirm it in one tap?*

**Layout, top to bottom:**

1. **Header:** "Availability" + week strip (Mon..Sun, today highlighted) + Today / pick-a-day.
2. **Freshness card (F14):** "Confirm today's availability · last confirmed yesterday 17:40" → one tap → "Confirmed · today 09:12 ✓". Visiting the surface also stamps `availability_confirmed_at`; the button is the explicit habit anchor the nudge emails point at.
3. **Bulk action:** **Close all of today** (the weather-day action, matrix v1.6). Confirmation: "Stops new sales on 3 departures across 2 tours. 57 booked guests keep their bookings. Guests are not notified; contact booked guests yourself if the day will not run." Reason chips, Weather preselected. One Undo. With a tour filter active, the button scopes: "Close today · Sunset Champagne Sail".
4. **Departure list, grouped by day** (Today, Tomorrow, next 5 days; infinite forward paging): one row per departure, chronological across tours:
   - `09:00 · Klein Curaçao Luxury Catamaran · 34/40 booked · Open · [Close]`
   - `16:30 · Sunset Champagne Sail · 1 booking · Sold out` (no Close button; sold out is automatic)
   - Closed rows show `Closed by Maria, 08:12 · Weather · [Reopen]`.
   - Tapping a row jumps to that tour's calendar with the date's day card open (setup-level detail lives there); **Close** on the row itself never needs it: one tap, undo snackbar.
5. **Tour filter chips** render only for multi-tour operators: All tours · per-tour. A one-tour operator sees the same agenda without the row (matrix v1.6).

**Row anatomy rules:** time first (the field sorts by "what leaves next"), tour second, the fraction third, state chip, one action. Tap targets ≥ 44px. No hover-dependent affordances.

**Roles:** all operator seats see the agenda; close/reopen requires owner or manager? **No: staff too.** The dock is exactly where staff works; stop-sell is protective, cheap to undo, and fully audit-logged. Money-adjacent actions (capacity changes) stay owner/manager. (Decided July 28, §5; access matrix v1.7.)

**API-managed tours (later, dev spec §7):** rows render with a "Synced from your system" chip and are read-only **except Close/Reopen**, which always works and wins until a sync explicitly confirms it. The agenda is why stop-sell-always-works matters: one surface, every tour, no exceptions.

### 3.4 Guardrails and system copy (the invariants, spelled out in UI)

| Invariant (source) | Where the UI says it |
|---|---|
| Closing never touches bookings (E.9) | Every close confirmation: "Existing bookings are kept. This only stops new sales." |
| Cancel ≠ close; 6.2 flow, admin-executed in v1 | Day panel, under the slot actions: "Need to cancel a departure that has bookings? That triggers refunds or rebooking for every guest. **Contact Island Tours support**." Never a self-serve cancel button in v1. |
| Manual close wins; nothing reopens it silently (E.9) | Closed-state copy: "Closed by you. Only you (or your team) can reopen it." |
| Capacity ≥ booked_count from the portal (E.9) | Capacity input min + inline line: "Can't go below {booked} already booked. Lowering further is an Island Tours support action, and existing bookings are never auto-cancelled." |
| sold_out flips back automatically on restore; sold_out_at history stays (E.9) | Sold-out state copy (§3.2c). |
| Pause schedule ≠ stop-sell (materialization is forward-only, booked departures untouched) | Pause dialog: "Pausing this timetable stops creating new dates from {date}. Already-listed dates stay on sale, and {n} departures with bookings are kept. To stop selling specific dates now, close them on the calendar → **Open calendar**." |
| Pause/unpublish tour closes future departures; republish reopens only what you did not close yourself (dev spec §2.3) | Tour-level Pause dialog states exactly that, with the booked-departures count. |
| No open departure in 30 days = delisted from ranked surfaces + tier billing paused (7.2) | The F13 warning banner, both surfaces. |
| Every mutation is audit-logged (dev spec §6.5) | Actor + timestamp on every override row and every state chip ("Closed by Maria · 08:12"). |
| All times tour-local (E.9) | One line per surface: "All times are local to Curaçao." |
| Counts are channel-scoped: `booked_count` counts Island Tours bookings only; other channels are invisible in manual mode | Day panel fractions read "booked via Island Tours"; one-line explainer on both surfaces: "Counts show Island Tours bookings only. Full through another channel? Close the departure." A free-sale boat that fills up elsewhere while showing 40/80 here is the expected reading, not a bug; the operator's move is Close. Real cross-channel occupancy arrives with the API adapters (dev spec §7). |

### 3.5 States and visual language

One state system across both surfaces. The consumer month map keeps its low state (under 5 left); the operator surfaces deliberately do not: the booked fraction already communicates fullness (KISS pass decision):

| State | Trigger | Visual | Operator action available |
|---|---|---|---|
| Open | default | teal outline pill, booked/capacity | Close |
| Sold out | booked = capacity, automatic | violet solid pill, "Sold out 16:12" | none needed (reopens on cancellation or a support-side capacity raise) |
| Closed | manual close (or cutoff, today only) | gray struck pill + who/when | Reopen |
| Cancelled | admin action (6.2) | red outline | view only |
| No departures | no rule, no add_slot | empty cell | Add one-off departure |

Sold out is deliberately celebratory (it is revenue), never styled like an error.

### 3.6 Explicitly out of scope for v1

Notify-me waitlists (v2, conflict log 77) · API adapters (§7 of the dev spec; the design above already reserves their read-only + stop-sell behavior) · multi-day tours (LD25) · self-serve cancellation of booked departures (6.2 keeps this manual with admin execution) · cross-tour month grid (the agenda is a day list; the month view lives per tour).

---

## 4. Build acceptance checklist (portal UX layer)

Extends dev spec §8; the engine DoD stays as-is.

1. Closing a full day from the calendar: ≤ 2 taps from the tab, ≤ 3 from portal home; Undo restores state and both actions appear in the audit log.
2. Close all of today (agenda): one confirmation, all open departures across tours closed, booked counts unchanged, one Undo.
3. A closed departure survives the nightly job and (later) an API sync; nothing in the UI offers a way for the system to reopen it.
4. Every capacity input (timetable flow, admin tooling) clamps at booked_count and renders the support-path line when clamped. The day panel has no capacity input.
5. Pausing a schedule shows the consequence dialog and does not change any departure with bookings.
6. Sold-out pills render distinctly from closed pills on both surfaces; sold_out_at timestamp visible in the day panel.
7. The 30-day warning banner appears within one revalidation window of the last open departure closing, on both surfaces, and links to the timetable.
8. Freshness confirm stamps `availability_confirmed_at`; the surface visit alone also stamps it.
9. Unit-priced tours never render seat-capacity copy; seat tours never render the private-charter line.
10. Agenda usable one-handed on a 360px viewport; every action reachable without hover.
11. A single-tour operator sees no filter row; a multi-tour operator's filter scopes the bulk close.
12. The words "exception", "materialised", "cap", and "recurring schedule" do not render anywhere in the operator portal.

---

## 5. Decided choices (veto round with Denley, July 28, 2026)

1. **Staff seats and stop-sell: yes.** `staff` can Close/Reopen on the daily agenda (protective, undoable, audited); capacity changes stay manager+. This widens matrix v1.6's "Bookings manifests only" for staff; applied as access matrix v1.7.
2. **Closure reasons: optional**, with quick-pick chips (Fully booked · Weather · Maintenance · Private hire · Other). Optional keeps the one-tap promise; the chips make most closures self-documenting anyway.
3. **Agenda horizon: Today + 6 days** with forward paging. Seven keeps the list scannable on a phone and matches the freshness-nudge window (open departures in the next 7 days).
4. **"Add extra departure" lives in the day panel on both surfaces** (it is a date-scoped act). Both surfaces write the same `add_slot` exception.
5. **Capacity is set-once, not a daily control (July 29).** The number is required at publish (the widget's atomic claim, sold-out, and "Only N left" depend on it) but it lives on the Details tab, with the optional per-timetable override in the timetable flow. It serves free-sale operators (capacity = real seat count, close when full) and allotment operators (capacity = Island Tours' share) with the same field. The day panel deliberately has no Change capacity; `set_capacity` remains in the model and API for support and power use.

## 6. Next steps

1. ~~Denley: veto round on §5~~ (done July 28, all four as above). This document plus the mockups go to Arnav; `island-tours-portal-availability-final.html` is the build reference (reason set simplified to Fully booked / Other plus an optional note, per Denley July 28), the other two files are exploration.
2. On approval, register the pair in the project's normal way (proposal flow; candidates: fold the surface split one level deeper into island-tours-availability-dev-spec.md §6, or keep this file as the portal UX companion next to it). Not self-registered into sources/canonical/: the spec-links registry stays untouched until the founder decides.
3. The current build's Schedules tab is close under the hood: the model mapping survives, the forms become the day panel's actions, and the weekday tabs become grouped pattern rows. This is a re-skin plus one new nav section, not a rebuild.

---

## 7. Build addendum — implementation status (July 30, 2026, dev pass)

Cross-checked against the shipped code (backend `src/availability/`, dashboard `components/trips/` + `components/availability/`). Statuses per finding:

| # | Status | How it shipped |
|---|---|---|
| F1 | ✅ (pre-existing) | Month grid + day card were already built; this pass added the 12-month cap and a shadcn date-jump that opens the picked day's card. |
| F2 | ✅ | `SET_CAPACITY` below `booked_count` now **rejects** on create and update (`assertCapacityAboveBooked`) with the support-path message — it was previously stored and silently ignored by the materializer. Per §5.5 the day panel has **no** capacity input at all (removed this pass). |
| F3 | ✅ | The popover claimed the opposite of the truth ("booked seats will be cancelled"); every close surface now states "existing bookings are kept", closed state carries "nothing reopens it automatically", and the booked-day panel routes real cancellations to the booking's report action. |
| F4 | ✅ | Surface B built: `GET /availability/agenda` + `POST /availability/agenda/close-day`, dashboard `/availability` nav section — freshness card, Close all of today (with the exact-Undo tourIds contract), chronological rows across tours, filter chips only for multi-tour operators, thumb-first. Week-strip jump deferred (the 7-day grouped list + Load more covers the job). |
| F5 | ✅ (pre-existing) | One home for times; in-use times un-deletable with the guard tooltip. |
| F6 | ✅ | Weekday tabs replaced with grouped pattern rows: one row per (time × identical settings), weekday chips toggle the underlying rows, pause/remove fan out across the rule, gap hint ("No departures on Fridays."). Supersedes the July 17 weekday-tab preference per this review. |
| F7 | ✅ | Consequence dialogs on tour-level Pause (row actions + review step) and rule Pause/Remove, each stating what stops, what is kept, and the close-on-calendar alternative. Note: the **built** tour-pause is a status gate (tour leaves the site whole; nothing sellable while paused) — simpler than §3.4's close/reopen dance and with no silent-overbooking path, so the dialog copy states the built behaviour. |
| F8 | ✅ | `POST exceptions/close-range` (idempotent over overlaps, 366-day cap) + `reopen-range` as the one-unit Undo; dashboard dialog + toast-Undo. |
| F9 | ✅ (pre-existing) | Date-first day card. |
| F10 | ✅ | `pricingModel` threaded through schedules + calendar + agenda: unit charters read "Private charter · 1 booking per departure (up to N guests)", never fractions; capacity override and seat inputs hidden; extra departure = "the second boat". |
| F11 | ✅ | Operator vocabulary purge (acceptance #12 words no longer render), resolved capacity values ("40 seats (tour default)"), "All times are local to {island}" on both surfaces. |
| F12 | ✅ | `createdAt` + `createdByName` exposed on every exception (user-name join, tolerant of deleted accounts); "Closed by Maria · Jul 28, 14:02" in the day card and agenda rows; the Date Changes register built (newest-first, Reopen/Remove, empty state per §3.2d). |
| F13 | ✅ | `GET /availability/summary` (same bookability math as the §7.2 gate) powers the §3.2a status line + the warning banner on LIVE tours. Copy deliberately says "hidden from ranked listings", **not** "tier billing is paused" — see the tier-billing note below. |
| F14 | ✅ | `POST /availability/confirm` (one tour or all); stamp-on-visit on both surfaces per dev spec §6.4; the agenda's freshness card is the explicit anchor and reports the STALEST tour's stamp. |
| F15/F16 | ✅ | Readiness arithmetic fixed earlier; "Next: Content"; timezone line shipped with F11. |
| F17 | ✅ | Sold out is a first-class info-violet state (grid dot, day-cell word, popover chip with `sold_out_at`, agenda chip), distinct from manual-close, with the self-explaining "reopens automatically" line. |
| §5.1 | ✅ | Stop-sell split shipped as `STOP_SELL` (permission enum + `@RequireAnyPermission` guard support): close/reopen/agenda/confirm reachable by either grant, timetable/capacity stays `MANAGE_AVAILABILITY`, and the service refuses `ADD_SLOT`/`SET_CAPACITY` from a stop-sell-only seat. Grantable per staff designation (access matrix v1.7). |

**On "tier billing pauses" (§1.3, F13, §3.4):** the master defines no recurring tier charge — tiers are commission-per-booking only — so "not billed for its tier during the unbookable period" is already true by arithmetic and there is no meter to pause. The one thing an unbookable tour *does* keep spending is time (`tier_locked_until`, the 90-day provisional window, grace), and none of those clocks are `is_bookable`-aware. Whether they should suspend while unbookable is a founder call, tracked in MASTER-CHECKLIST. Until then this document's banner copy is implemented **without** the billing phrase.

**Not built, tracked:** the agenda week-strip day picker (Load more covers it); closure reason quick-pick chips (a free note field shipped; chips are polish on top of the same column); API-managed rows (§3.3, dev spec §7 — later by design).
