# Operator test report 2026-08-01 - defects and fixes

Source: `technical-doc/test-reports/Operator Testing.pdf`. Two defects, both in the operator's
tour lifecycle. Companion to `TEST-REPORT-2026-08-01-FIXES.md` (traveller + admin passes).

| # | Report | Area | Status |
|---|---|---|---|
| 1 | §01 | Tour-create wizard errors; Reload jumps to Review with steps pre-ticked | **Fixed** (2 of 3 causes; see "Not reproduced") |
| 2 | §02 | Paused/archived tours are a dead end for the operator | **Fixed** |

---

## 1. The wizard errors, and Reload lands on Review with steps already ticked

> "When I try to create a new tour, the page shows the following error instead of proceeding:
> *This page couldn't load. Reload to try again, or go back.* If I click Reload, instead of
> returning to the Basics step, the system automatically marks all the steps as completed and
> takes me directly to the Review page, even though no data has been entered in the required
> fields."

Three separate faults stacked into one bad minute. Two are reproduced and fixed; the third is
mitigated rather than found, and that is stated plainly below.

### Fault A - the dashboard had no error boundary at all

That error text is **Next.js's own built-in screen**
(`next/dist/esm/client/components/builtin/app-error.js`). It appears when an error escapes and
the app has no boundary of its own - and the dashboard had **none**: no `error.tsx` in any
segment, no `global-error.tsx`. So *any* failure anywhere in the dashboard produced a blank
page with no message, no sidebar, and no route back.

The advice on it made things worse. "Reload" re-requests the **current URL**, and several
dashboard routes are bare - `/trips/{id}` redirects to `/trips/{id}/edit` with no `?step=` -
so reloading did not return the operator to where they were. It dropped them somewhere else
entirely, which is what "it threw my work away" feels like.

**Fixed:** `app/(app)/error.tsx` and `app/global-error.tsx`.

The dashboard one is a **segment** boundary on purpose, so the shell survives: sidebar, search
and account menu stay usable, and a failed page is one broken page rather than a broken
product. It offers `reset()` (re-renders the segment with the client cache intact, which
recovers a transient failure without a document load) and a link back to the overview, logs
the error to the console the boundary would otherwise swallow, and prints the **digest** -
the only handle support has on a server-side error, since the message is redacted in
production.

`global-error.tsx` covers an error in the root layout itself, which the segment boundary sits
inside and cannot catch. It replaces the document, so it imports `globals.css` directly -
without that line the classes resolve to nothing, and hand-rolling a palette instead would
break the design-system lint rules (03 §8.2/§8.3).

### Fault B - a bare edit URL sent a half-built draft to Review

Reproduced exactly. `/trips/{id}/edit` with no `?step=` ran
`resolveStepParam(null, REVIEW_STEP)` - the review hub, which is the right answer for a tour
that has been published and the wrong one for a draft mid-build. It is easy to reach:
`/trips/{id}` redirects without a step, and so does any reload after an error.

**Fixed:** `trip-wizard.tsx` now picks the fallback by mode. Edit mode still lands on the
review hub. **Create mode lands on the first step with work left on it**
(`firstIncompleteStep` in `lib/trips/wizard-steps.ts`).

The overview check is treated as passing for that decision alone - it lives on the translation
record, so honouring it would make the landing wait on a second request, and a landing that
moves once the request resolves is worse than one that is occasionally a step optimistic. The
rail and the Review checklist both still report it accurately.

### Fault C - four steps ticked on an untouched draft

Also reproduced. `isStepComplete` is `checks.filter(owned by step).every(passed)`, and
**`[].every()` is `true`** - so every step that owns no readiness check reported complete the
instant a draft existed. On a brand-new tour that ticked **Basics, Booking rules, Location and
Reach** before the operator had opened any of them.

That is the right answer to "is anything outstanding here" and the wrong one to "have you done
this", which is what a tick means while you are walking a wizard.

**Fixed:** `isStepVacuous` marks the three steps whose content is genuinely optional - `rules`,
`location`, `reach`. While **creating**, `WizardProgress` holds their tick until the step has
been visited. Editing is hub-and-spoke and keeps today's behaviour, where a tick correctly
means "nothing left to do".

`basics` is deliberately excluded even though it owns no check: its requirements are enforced
by `POST /tours`, so the draft's existence *is* the proof it was filled.

**Measured, same empty draft, bare URL:**

| | Before | After |
|---|---|---|
| Lands on | Step 9, Review | Step 2, Pricing |
| Basics | complete ✓ | complete ✓ |
| Booking rules / Location / Reach | **complete ✓** | locked |
| Pricing / Schedule / Media / Description | incomplete | locked (ahead of the walk) |

### Not reproduced

**What threw in the first place.** With the boundary in place any future occurrence now shows
a digest and a real message instead of a blank page, but the underlying throw was not
identified. One adjacent fragility was found while looking and is *not* fixed, being outside
this report: `getDashboardSession` returns null on **any** non-OK `/users/me`, including a
transient 429 from the global throttler, and the layout turns null into a redirect to
`/portal`. That signs a valid user out on a blip. It is documented in that file as a
deliberate trade (caching the null would be worse), but the 429 case deserves a retry.

---

## 2. Paused and archived tours are a dead end for the operator

> "If a tour is set to Paused or Archived, the Operator has no option to change the tour's
> status. There is also no option to submit the tour for review again, so the Operator cannot
> send it back to the admin for review and publishing."

### Why it happened

Correct, and worse than it reads. The lifecycle splits by direction (conflict #1, access-roles
matrix): downward transitions are `EDIT_TRIP`, upward ones are `MANAGE_TRIPS`.

```
DRAFT  --submit-for-review (EDIT_TRIP)-->  DRAFT/PENDING
       --approve (MANAGE_TRIPS)-->         DRAFT/APPROVED
       --publish (MANAGE_TRIPS)-->         LIVE
LIVE   --pause (EDIT_TRIP)-->              PAUSED
PAUSED --unpause (MANAGE_TRIPS)-->         LIVE
*      --archive (EDIT_TRIP)-->            ARCHIVED
ARCHIVED --restore (MANAGE_TRIPS)-->       DRAFT
```

Every exit from PAUSED and ARCHIVED is `MANAGE_TRIPS`. The one channel built for the operator
to ask - `submit-for-review`, which *is* `EDIT_TRIP` - refused anything that was not `DRAFT`:

```ts
if (tour.status !== TourStatus.DRAFT) throw new BadRequestException(
  'Only a DRAFT tour can be submitted for review');
```

So in the dashboard an operator with a **paused** tour saw exactly one lifecycle action -
Archive, i.e. further down - and one with an **archived** tour saw none at all. The status
badge told them to "contact us", which is not a feature.

### What changed

The half of conflict #1 that belongs to the operator is **asking**. Submitting stamps
`approvalStatus = PENDING` and queues the request; it does not touch `status`. So this widens
who may knock, never who may open the door.

**Backend** (`tours.service.ts`)

- `REVIEWABLE_STATUSES = [DRAFT, PAUSED, ARCHIVED]` - one constant, used by
  `submitForReview`, `approveTour` and `rejectTour` so a request can always be decided from
  wherever it was raised. LIVE stays excluded: it is already published, and the message says so.
- The readiness bar is unchanged - a tour missing images still cannot queue.
- Going live is still `unpause` / `restore` / `publish`, all `MANAGE_TRIPS`.

**Dashboard**

- `trip-row-actions.tsx` and the wizard's `step-review.tsx` offer the request from all three
  statuses, and the admin's approve/reject follows it.
- The label follows the ask, because "Submit for review" tells a paused-tour operator nothing:
  **"Ask to go live again"** (paused), **"Ask to bring this back"** (archived),
  "Resubmit for review" (rejected), "Submit for review" (draft).
- The PAUSED badge hint now names that action instead of saying "contact us".

### Verification

- 4 new unit tests: submit from PAUSED and from ARCHIVED stamps the request and **asserts
  `data.status` is untouched** (the boundary this rests on), LIVE still refused, and an admin
  can approve a request raised from a parked tour.
- Full backend suite: **2202 tests, 99 suites, green**. `tsc --noEmit` clean in backend and
  dashboard; `eslint` clean on every changed file.
- Fault B and C were verified live against a real empty draft in the running dashboard (table
  above). The §02 UI could not be re-checked in the browser - the operator session expired
  mid-session and signing back in is not something I do - so that half rests on the unit tests
  plus typecheck and lint.
- Two probe tours created for the reproduction were deleted, with their `slug_registry` rows.
