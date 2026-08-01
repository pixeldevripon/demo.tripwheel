# TripWheel dashboard test pass - findings and fixes

Answers `technical-doc/test-reports/TripWheel Testing.pdf` (01 August 2026,
~30% of the Admin Dashboard covered; testing ongoing). Three findings. All the
code lives in the **dashboard repo** (`tripwheel-x-islandtours-dashboard`)
except where a backend file is named.

| # | Finding | Verdict | Status |
|---|---|---|---|
| TW1 | Tour attribute dropdown shows a raw token | Confirmed bug | Fixed |
| TW2 | Admin cannot delete a customer, with no explanation | Half confirmed - the silence was the bug | Fixed; one founder call open |
| TW3 | Payments date filter "does not restrict results" | Filter is correct; the table made it unverifiable | Fixed |

---

## TW1 - Attribute dropdowns printed the stored token

**Reported** as the Tier field rendering the i18n key `general.tier` under a
"Local Payments" section.

**What is actually on screen.** The screenshot is the tour wizard, **step 8
(Reach)**, attributes block, group **Luxury Experiences**, field **Tier** - and
the value reads `premium`. Not a translation key and not Local Payments; the
written description is off on both counts, but there IS a real bug and the red
box is around it.

**Root cause.** `trip-attributes-tab.tsx` rendered allowed enum values straight
into the options:

```tsx
{allowed.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
```

So the operator sees the stored token - `premium`, and for the next option
along, `ultra_luxury`, underscore and all. The same applied to the ENUM_MULTI
options and to the "Allowed: …" hint. That is what the tester correctly called
"exposing internal code to the end user"; they just guessed at which internal.

**Fix.** A shared `humanizeEnumValue` (`lib/utils.ts`) turns
`ultra_luxury` -> `Ultra luxury` for display, while the stored and submitted
value stays the raw token. Applied to the ENUM options (which also fixes the
closed trigger, since it renders the selected item), the ENUM_MULTI options and
the allowed-values hint.

`statistics.tsx` already had a private copy of this transform
(`humanizeStatus`) - it now imports the shared one rather than keeping a second
implementation of the same three lines.

Two smaller things in the same control, both visible in the screenshot:
the reset option was labelled `-` (no clue that it clears the field) and is now
**Not set**; the placeholder was `Select…` and now names the field.

**Deliberately mechanical, not a copy table.** Attribute definitions and their
allowed values are created by admins at runtime, so there is no dictionary to
translate them against - only a consistent transform. If a specific attribute
ever needs bespoke option labels, that belongs in the attribute definition
itself, not hard-coded here.

**Files.** `lib/utils.ts`, `components/trips/trip-attributes-tab.tsx`,
`components/statistics.tsx`.

**Re-test.** Tour wizard -> step 8 Reach -> Luxury Experiences -> Tier: reads
"Premium", and the list offers Premium / Luxury / Ultra luxury. Save and reload:
the stored value is still `premium`.

---

## TW2 - No delete on a customer, and no reason given

**Reported.** From Operate -> Customers an Admin has no delete option; nothing
explains the restriction. The tester flagged this one as needing a decision.

**Findings.** Both halves of the report check out, but they resolve differently.

*The missing action is correct.* There is no delete endpoint in
`backend/src/customers/` - the module is list + review-request + email - and
there should not be one. A row on this screen is not a record. It is a
`(userId, operatorId)` pair **derived from bookings**, which is why the same
person appears twice in the tester's own screenshot, once per operator they
have booked with. There is nothing to delete that is not a booking, and
deleting the bookings would take the payments, refunds and the operator's
settlement history with them.

*The silence is the bug.* An Admin holding every permission looked for a
capability they reasonably expected, found nothing, and got no reason. That is
a real defect regardless of the decision below.

**Fix.** The row menu now carries a disabled **Delete customer** item with a
tooltip stating why the record cannot be deleted and where an erasure request
should go. Present-and-explained rather than absent - the same pattern the
dashboard already uses for seeded destinations.

**Open founder call.** There is currently **no anonymisation path anywhere in
the platform** (nothing matches `anonymi[sz]`/`gdpr`/`erasure`). For an EU
traveller exercising erasure - and the launch markets are NL/DE/FR, with
Curacao under Dutch law - the correct mechanism is not deletion but
anonymisation: keep the financial rows, scrub the PII (name, email, phone,
pickup address) and leave the ledger intact. That is a backend feature with a
permission, an audit trail and a scrub across booking/payment/review, so it is
not something to slip in under a test-report fix. Flagged here for the
decision: build it, or handle erasure manually and document the process.

**Files.** `components/customers/customer-row-actions.tsx`.

**Re-test.** Customers -> row "…" menu: "Delete customer" is visible, disabled,
and hovering it explains why.

---

## TW3 - The payments date filter was right; the table hid the evidence

**Reported.** Filtering 28 Jul - 02 Aug 2026 still lists payments dated 19, 20
and 21 Aug, which "will lead to incorrect reconciliation and reporting."

**Root cause - the filter is correct, and the table gave no way to see that.**
The backend filters `payment.createdAt`, the date the money moved:

```ts
if (query.from) where.createdAt.gte = new Date(`${query.from}T00:00:00.000Z`);
if (query.to)   where.createdAt.lte = new Date(`${query.to}T23:59:59.999Z`);
```

The dates the tester compared against are in the column headed **"Tour /
Travel date"** - `booking.localDate`. A deposit taken on 30 July for a tour on
29 August is a correct hit for a 28 Jul - 02 Aug filter. Every row in the
screenshot is consistent with that.

But the complaint stands, because **the payments table never showed the payment
date at all**. The one date on the row was the travel date, so a filtered list
looked wrong and could not be checked. On a reconciliation screen that is a
real defect: the number you filter by has to be visible next to the amount you
are reconciling.

**Fix.** A **Paid on** column showing `payment.createdAt`, placed beside the
amount. The date pickers now read **Paid from / Paid to** instead of the
unqualified From date / To date, so the filter says which of the two dates on
the row it acts on. `createdAt` was already on the API payload
(`PaymentListItemDto`) and already shown in the detail sheet - only the table
was missing it.

**No backend change.** The query was never wrong.

**Noted, not changed.** The bounds are built in **UTC** (`T00:00:00.000Z`), so
for an admin in a non-UTC zone the edges of a range can be off by a few hours -
a payment at 02:00 local on 28 Jul is 27 Jul in UTC and would fall outside a
range starting 28 Jul. Not what was reported and not visible at day-scale for
most of the day, but it is the next thing to get right if reconciliation moves
to a strict daily cut-off.

**Files.** `components/payments/payment-columns.tsx`,
`components/payments/payments-table.tsx`.

**Re-test.** Payments -> set Paid from/to: every visible "Paid on" falls inside
the range, while "Tour / Travel date" legitimately does not.

---

## Coverage note

The report states ~30% of the Admin Dashboard is covered so far and that
further items were "flagged as suspected issues" pending discussion. This
document covers the three written up; it should be extended as the remaining
70% is tested.
