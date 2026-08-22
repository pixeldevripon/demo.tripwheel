# Test report 2026-08-01 - defects and fixes

Source: `technical-doc/test-reports/Copy of Tripwheel Testing.pdf` (traveller pass + admin
pass). Eight defects, tracked here one per section: what was reported, what actually
caused it, what changed, and how it was verified.

| # | Report | Area | Status |
|---|---|---|---|
| 1 | Traveler §1 | Checkout form auto-fill | **Fixed** |
| 2 | Traveler §2 | TYP summary order (operator before traveller) | **Fixed** |
| 3 | Traveler §3 | Blank "Show Up & Enjoy" block | **Fixed** |
| 4 | Traveler §4 | Logged-in booking binds to the wrong account | **Fixed** |
| 5 | Admin §1 | Custom JavaScript never executes | **Fixed** (not the reported cause) |
| 6 | Admin §2 | Operations Manager: Overview errors | **Fixed** |
| 7 | Admin §3 | Operations Manager: booking View Details errors | **Fixed** |
| 8 | Admin §4 | Operations Manager: seven sections show no data | **Fixed** (6 of 7; see below) |

---

## 1 + 4. Checkout identity: auto-fill, and the account a booking lands on

Reported as two items; they are one root cause seen from two sides.

> §1 - "When I am logged in and have previously purchased a tour, the checkout form
> should automatically populate with my previously provided information. However, all the
> fields are currently blank."
>
> §4 - "After purchase is successful, there still show my previous loggedin email. But
> when I go to my account it will logged out. But if I refresh in thank you page it will
> not logged out [...] if I enter a different email address during checkout, the system
> creates a new user account using that email, and the booking is associated with the
> newly created account instead of my currently logged-in account."

### Why it happened

**The checkout form knew nothing about the traveller session.** It mounted with a hardcoded
blank contact block and read no identity of any kind, so:

- there was nothing to prefill from, and
- the email input was free text, and the contact email is what the platform files a booking
  under (`CustomerProvisioningService` find-or-creates a `Role.USER` by `contactEmail`).
  Typing a different address at checkout therefore did exactly what it is designed to do -
  opened a second customer - just without the traveller ever being told.

**And checkout downgraded the session.** There are three traveller credential scopes
(`backend/src/bookings/traveler-session.util.ts`):

| Scope | Minted by | Unlocks |
|---|---|---|
| HISTORY (`e`, `h:1`) | account-door OTP login | every booking on the email **+ the account area** |
| EMAIL (`e`) | `/bookings` pair lookup | every booking on the email |
| BOOKING (`b`) | checkout's contact PATCH | exactly one booking |

All three live in the one `it.travelerSession` cookie, and checkout unconditionally
overwrote it with its BOOKING-scoped token. That single line explains the whole of §4's
symptom list:

- `/traveller` demands HISTORY scope, so it started answering 401 - **"it will logged out"**;
- the TYP kept working, because the new token covers that one booking - **"if I refresh in
  thank you page it will not logged out"**;
- the navbar reads a separate client-readable identity cookie that nothing updated, so it
  kept naming the previous traveller - **"there still show my previous loggedin email"**.

Three surfaces disagreed because the credential underneath them had silently narrowed.

### What changed

**Backend** - `GET /bookings/traveller/contact` (`bookings.service.ts` →
`getTravellerContact`). Returns the contact block off the caller's most recent booking plus
the session email. Behind the same HISTORY-scoped gate as the rest of the account area
(`requireTravellerEmail`), selecting only the four contact columns - it can only ever echo
the caller's own details back to the caller. `email` is always the **session** email, never
a stored value, so checkout's locked field cannot drift.

**Frontend**

- `app/api/traveller/contact/route.ts` - same-origin proxy that replays the HttpOnly
  session server-side. The client never holds the token. 401 is a normal answer, not an
  error: checkout stays fully usable signed out.
- `hooks/checkout/use-checkout-prefill.ts` - one fetch per mount; any failure resolves to
  "signed out".
- `checkout-form.tsx` - prefills first/last name, phone and country **without ever
  overwriting what the traveller has typed**, and renders the email field `readOnly` when a
  proven session exists, with `Booking as {email}` and a **Use a different email** button.
  That button signs the traveller out, because booking under another address *is* booking
  as someone else - and it releases the session so checkout can mint the booking's own token.
- `lib/checkout/countries.ts` - `splitPhone`, the inverse of `composePhone`, so a stored
  E.164 number goes back into the split country/number control. The stored country wins over
  prefix-matching when its dial code fits, because +1 covers the US, Canada and most of the
  Caribbean.
- `app/api/traveler-session/route.ts` - **never downgrade.** A BOOKING-scoped token no
  longer replaces a live email-scoped session for the same address. The token payload is
  decoded (not verified - this route has no secret), which is safe because the only decision
  it feeds is *keep the cookie the browser already has*. The backend still re-verifies the
  signature on every use. Cached account reads are still busted, so a new booking shows up
  on the account page immediately.
- `lib/traveler-booking.ts` - `reconcileTravellerIdentity(email)`. After checkout, if the
  displayed identity is a *different* address, the display cookies are dropped: the session
  is booking-scoped now, which is what signed-out looks like, and the header should say so
  rather than name an account the browser can no longer open.

Two dictionary keys in all 7 locales: `checkout.signedInAs`, `checkout.useAnotherEmail`.
`DICTIONARY_VERSION` bumped to `2026-08-01-checkout-signed-in-email`.

### Deliberately not done

The **backend does not reject** a contact email that differs from the session's. It is not a
privilege boundary - a caller with no session at all can already book under any address, and
that is the guest flow. The lock is a UX guarantee for a signed-in traveller, enforced where
the confusion actually happens.

### Verification

- `getTravellerContact`: 4 unit tests - scope gate (rejects no token / pair-login token /
  booking token / garbage), most-recent-booking scoping and `orderBy`, the no-history case,
  and the exact `select` list. `src/bookings/bookings.service.spec.ts`, suite green.
- `tsc --noEmit` clean in both repos; `eslint` clean on every changed frontend file.

---

## 2. Thank-you page: operator contact came before the traveller's own booking

> "Currently, the operator's information (name, email, and phone) appears first, followed by
> my information. Instead, I would expect the booking/traveler information [...] to be
> displayed first. If the operator's information is necessary, it would be better to place it
> in a separate section labeled 'Operator Contact Information'."

### Why it happened

Correct as reported, and it is purely row order inside one card. The TOUR DETAILS card ran:

```
Date & time · Duration · Pickup · Free cancel · Operator · Email · Phone · Traveler · Guest lead · Extras
```

Three operator rows sat in the middle of the card, above the traveller's own party size and
lead name. Nothing was conditional or broken - the rows were simply authored in that order.

### What changed

`components/frontend/thank-you/thank-you-summary.tsx`

- TOUR DETAILS is now the traveller's booking, in reading order:
  `Date & time · Duration · Pickup · Traveler · Guest lead · Extras · Free cancel` -
  when, how long, where, **who**, what else, and the policy last.
- A third card, **OPERATOR CONTACT INFORMATION** (`dict.operatorContact`), carries Operator /
  Email / Phone.
- The band is still a 2-column grid; the right column now stacks PAYMENT over OPERATOR
  CONTACT. The tour card is the tall one, so this balances the two columns instead of
  leaving a hole, and the mobile reading order becomes "your booking → what you paid → who
  to call".

Email and phone are identity fields: they arrive null on the masked shared-link payload and
simply do not render there, so the new card degrades to the operator name alone. That
matches the existing masking contract - no new leak surface.

One key in all 7 locales: `thankYou.operatorContact`.

### Verification

Rendered live against a real CONFIRMED booking (`IT-2026-CRP3T`) through the `/bookings`
pair login. Card headings in DOM order: `TOUR DETAILS`, `PAYMENT`,
`OPERATOR CONTACT INFORMATION`. No horizontal overflow. Screenshot confirms the layout.

---

## 3. Thank-you page: the "Show up & enjoy" card was blank

> "Below the booking summary on the Thank You page, there is a 'Show Up & Enjoy' block that
> currently appears blank. It should include a short description or helpful instructions."

### Why it happened

One line. `thank-you-next-steps.tsx` built the third step as `{ title: dict.step3Title }` -
no `sub` at all - and the card only renders a body `{step.sub && ...}`. Steps 1 and 2 had
`step1Sub` / `step2Sub`; `step3Sub` was never written, in any locale. So the card rendered a
heading on an otherwise empty panel.

### What changed

- Two keys in all 7 locales: `thankYou.step3Sub` (carries a `{time}` token) and
  `thankYou.step3SubNoTime`.
- `thank-you-next-steps.tsx` fills the third step with the start time and the booking
  reference instruction. `startTimeLabel` is a formatted label and comes back empty when the
  departure has no time of day, so the no-time variant is used there - a sentence reading
  "Arrive at  and ..." would be worse than no time at all.

English: *"Arrive at 7:00 AM and have your booking reference ready. Your operator takes care
of the rest."*

### Verification

Same live booking: the third card now reads the sentence above, with the real 7:00 AM start
pulled from the booking. `DICTIONARY_VERSION` bump covers the cached dictionary.

---

## 5. Custom JavaScript "not working"

> "The Custom JavaScript option is not working. For example, the following script does not
> execute [...] However, if I run the exact same code directly in the browser console, it
> works as expected."
>
> ```html
> <script>document.querySelector("input[placeholder='Which Island?']").placeholder = "hello";</script>
> ```

### What is actually happening

**Custom scripts execute.** Measured, not assumed: a probe snippet in each position, on one
page load of `/en` -

| Position | `window` flag set | `<script>` in the document |
|---|---|---|
| Header (`HEAD`) | yes | inside `<head>` |
| Footer (`BODY_END`) | yes | end of `<body>` |

The reported snippet fails for its own reason, and the browser says so plainly. Pasting it
into both positions and reloading gives two console exceptions:

```
TypeError: Cannot set properties of null (setting 'placeholder')
```

Both positions run **during document parse, before the page is interactive**. `BODY_END`
runs when the browser reaches the end of the HTML - which is still before React has rendered
and hydrated the client-side chrome. The search input does not exist yet, `querySelector`
returns null, and the assignment throws. In the console it works because by then the page
has hydrated. (Confirmed directly: immediately after load `document.querySelectorAll('input')`
is empty; a moment later there are two.)

Vendor snippets - Hotjar, Clarity, a chat widget, a Tag Manager container - are written to
survive this, which is why the feature has otherwise been fine.

### Why it read as a platform bug

The dashboard's Footer hint said: *"Runs once the content is on screen."* That is not true,
and it is exactly the promise the snippet was written against. An admin following that hint
has no reason to suspect timing - and the failure is silent, because the exception only
exists in a visitor's console.

Backend and rendering were both checked and are correct: 50 unit tests over the allowlist,
parser and service pass, the public payload is well-formed, and each tag lands where
`CUSTOM-SCRIPTS.md` §5 says it does. (A `<script>` appearing twice in the served HTML is the
RSC flight payload carrying it as *data*, not a second execution - the executable tag is
emitted once.)

### What changed

`dashboard/components/settings/custom-scripts-form.tsx`

- Both position hints now describe the **moment** rather than the appearance:
  Header *"while the page is still loading, before any content is drawn"*, Footer
  *"when the page finishes loading, but still before the page is interactive"*.
- A standing note in the Scripts card, next to the existing security note: both positions run
  before anything is interactive; code that looks for something on the page needs a
  `setTimeout` or a `MutationObserver`; and it fails quietly, in the visitor's console only.

`technical-doc/02-architecture/CUSTOM-SCRIPTS.md` §5 gains a "When a snippet runs - and why a
DOM one-liner does nothing" section with the reproduction above.

No code path changed, because none was wrong. What was wrong was the sentence that set the
expectation.

### Verification

Diagnostic rows were inserted, exercised and **removed**; `custom_scripts` is back to 0 rows
and the `custom-scripts` cache tag was busted after cleanup. Dashboard `tsc --noEmit` clean.

---

## 6 + 8. Operations Manager: Overview errors, and seven empty sections

> §2 - "I was invited as an Operations Manager [...] when I open the Overview page in the
> dashboard, I immediately see an error. Is this due to a permission restriction, or is it an
> actual system error?"
>
> §4 - "the following dashboard sections do not display any data: Cancellations, Reviews,
> Customers, Payments, Settlements, Tours, Translations."

Both, and it is two distinct faults - neither of them a deliberate restriction.

### Fault A - the seeded designation is one permission short

Platform staff do **not** inherit `ROLE_PERMISSIONS[STAFF]`. The effective set is the
DESIGNATION's grants, capped by the platform ceiling, plus a two-permission floor
(`staff-permissions.service.ts`) - the static role list is deliberately not unioned in, so a
user-manager cannot hand out broad access by flipping a role.

The three system designations were seeded in migration `20260719180644`.
`VIEW_BOOKING_FINANCIALS` only arrived in `20260728022458` (conflict #7: money and traveller
PII on booking rows), and nothing went back to fill it in. So `Operations Manager` held
`VIEW_PAYMENTS` and `VIEW_ANALYTICS` but not the financials pairing every money surface
requires **on top**:

| Surface | Endpoint | Requires | Result |
|---|---|---|---|
| Overview | `GET /analytics/dashboard` | `VIEW_ANALYTICS` + `VIEW_BOOKING_FINANCIALS` | 403 → "couldn't load" |
| Payments | `GET /payments` | `VIEW_PAYMENTS` + `VIEW_BOOKING_FINANCIALS` | 403 → empty |
| Settlements | `GET /settlements` | `VIEW_PAYMENTS` + `VIEW_BOOKING_FINANCIALS` | 403 → empty |
| Customers | `GET /customers` | `VIEW_USERS` + `VIEW_BOOKING_FINANCIALS` | 403 → empty |

**Fix:** migration `20260801200000_system_designations_booking_financials` adds it to the two
system designations that already hold `VIEW_PAYMENTS` - Operations Manager and Support Agent
(platform support triages refunds, which is why `Role.STAFF`'s own list carries it). Content
Editor holds neither and is untouched. The statement is a no-op where the permission is
already present, so it never rewrites a set an admin has curated; re-running it reports
`UPDATE 0`.

### Fault B - `role === ADMIN` used to ask "is this actor platform-scoped?"

Three services decided scope by testing for ADMIN alone. Platform STAFF and EDITOR fell into
the **operator** branch, where `resolveOperatorId` throws
`No operator profile found. Please complete your operator registration first.` - they have no
operator record, and never will.

| Surface | Was | Now |
|---|---|---|
| Reviews | `reviews.service.listForActor`: `role === ADMIN` | `isPlatformWideRole(role)` |
| Settlements | `settlements.service` list + summary: `role !== ADMIN` | `!isPlatformWideRole(role)` |
| Tours / Translations | `tours.service.findMyTours` always resolved an operator | platform roles skip resolution and read the catalogue |

`isPlatformWideRole` (ADMIN / STAFF / EDITOR) now lives in `common/utils/operator.util.ts`
next to `resolveOperatorId`, since it is the exact complement of it.
`isPlatformWideBookingRole` delegates to it, so the booking and payment paths - which already
got this right - cannot drift from the rest.

**No widening.** The operator branch is unchanged, and scope is still decided from the session
role, never from a query param. `findMyTours` additionally selects the operator relation on
the platform-wide read only, so the dashboard's Operator column has something to show.

**Dashboard, to match.** `isPlatformWideRole` is mirrored in `lib/rbac-utils.ts`. Trips and
Settlements used it for presentation (Operator column; "Paid out" vs "Paid to you" - wording
the page from the operator's side over platform-wide rows would simply be false). Trips also
separates the two questions that were conflated: **which route** answers is now
`can('MANAGE_TRIPS')` (an Operations Manager does not hold it, so they take the `VIEW_TRIPS`
route, which is the one that now scopes itself platform-wide), while **how the table is
worded** follows the role.

### Cancellations - no defect found

`Cancellations` is `GET /bookings?cancellationRequested=true`, gated on `VIEW_BOOKINGS`
alone, which the designation has held all along - and the bookings list already scoped
platform-wide correctly (`isPlatformWideBookingRole`). It should have shown rows; the
database has 2 requested cancellations. Reported here as unreproduced rather than fixed:
worth a second look with the same account once the other six are confirmed.

### Verification

- Full backend suite: **2174 tests, 98 suites, green**.
- New tests: `findMyTours` scope (platform roles resolve no operator, operators still scoped,
  operator with no profile still 400s), `listForActor` scope, settlements list scope.
- Migration applied to the dev database. Before: Operations Manager 16 permissions, no
  financials. After: 17 with `VIEW_BOOKING_FINANCIALS`; Support Agent 14 with it; Content
  Editor 18, unchanged. Re-running the statement: `UPDATE 0`.
- `tsc --noEmit` clean in backend and dashboard; `eslint` clean on changed dashboard files.

---

## 7. Operations Manager: booking View Details throws

> "As an Operations Manager, I can view the list of bookings. However, when I click View
> Details for any booking, an error is displayed instead of the booking information."

### Why it happened

A one-character-class bug, and the report's own detail - list fine, detail broken - points
straight at it.

Without `VIEW_BOOKING_FINANCIALS` the backend returns the **manifest projection**: money and
traveller email are **nulled, not omitted**, so the response shape stays DTO-stable.
`refundStatus` is one of the nulled fields. The detail sheet had:

```tsx
{b.refundStatus !== 'NONE' && (
  <StatusBadge variant={REFUND_STATUS[b.refundStatus].variant} …>
```

`null !== 'NONE'` is **true**, so the branch rendered and then evaluated
`REFUND_STATUS[null].variant` → `TypeError: Cannot read properties of undefined`. That takes
down the whole sheet, for every booking.

The list survived because its column already guards the same field the right way
(`booking-columns.tsx`: `if (b.refundStatus && b.refundStatus !== 'NONE')`). One of the two
call sites knew; the other did not.

### What changed

`dashboard/components/bookings/booking-details-sheet.tsx`

- `{b.refundStatus && b.refundStatus !== 'NONE' && …}` - matching the column. For a seat
  that cannot see refund state, the row is simply absent, which is the intent.
- "Refund due" moved behind `showFinancials`. A withheld amount made `refundDue()` return
  null, which fell through to **"None (outside window)"** - not "withheld", a different and
  wrong answer. It now follows the same conflict-#7 rule as the Payment and Settlement blocks
  above it.

Every other enum-map lookup on a manifest-nulled field was checked: the remaining ones
(`SETTLEMENT_STATUS`, `SETTLEMENT_METHOD_LABEL`, `paymentModelLabel`) all sit inside
`showFinancials`, or on the Payments/Settlements screens, which a seat without the permission
cannot load at all.

Note this fix is independent of §6: the Operations Manager now holds
`VIEW_BOOKING_FINANCIALS`, so they no longer receive the projection - but any genuinely
restricted seat (a guide-level designation) still does, and the sheet must not crash for them.
