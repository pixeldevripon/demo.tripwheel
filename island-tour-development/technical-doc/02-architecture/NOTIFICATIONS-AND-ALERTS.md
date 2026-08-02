# Notifications & Alerts — who is told what

> **Scope:** every action on the platform that tells a human something, on either channel.
> **Sources of truth in code:** `backend/src/inbox/inbox-events.ts` (the in-app routing table) and
> `backend/src/mail/mail.service.ts` (the email surface). If this document and those files disagree,
> the code wins and this file is stale — say so in the PR.

---

## 1. Three systems, one word

| System | What it is | Where |
|---|---|---|
| **Inbox** | The dashboard bell, the sidebar badges, the login digest. Humans. | `src/inbox` |
| **Email** | Transactional mail to travellers, operators and Island Tours. Humans. | `src/mail` |
| **Notifications (OCTO)** | Webhook delivery of JSON to OTA partner servers. **Machines.** | `src/notifications` |

The third one shares a word with the first and nothing else — no shared table, queue, or concept. It
exists because the OCTO spec requires it. **Do not merge them, and do not add a dashboard feature to
`src/notifications`.**

---

## 2. Who counts as an audience

An in-app notification never targets a role directly. It targets an **audience**, which the fan-out
resolves to real user rows at the moment the event fires:

| Audience | Resolves to |
|---|---|
| `platform` | every ACTIVE `ADMIN`, plus ACTIVE platform staff seats (`staff_members` with `operatorId = NULL`) |
| `operator` | the owning operator's owner account, plus its ACTIVE team seats |
| `both` | each of the above, de-duplicated — one row per person even if they hold two hats |

Then every candidate is filtered by one rule:

> **A notification is gated on the permission that gates the page it links to.**

A notification is a link. A link to a screen the recipient cannot open is a dead end, and its title
can leak the existence of a record they are not cleared for — a guide-level seat learning a
settlement figure from a bell. The filter reads the same `StaffPermissionsService` the route guards
and the sidebar read, so a designation change moves all three together.

Two more rules that hold everywhere:

- **The actor is never notified of their own action.** The admin who clicks Approve does not get
  "a tour was approved".
- **SUSPENDED and INVITED seats are excluded.** A seat that cannot sign in does not accrue an inbox.

---

## 3. The matrix

`✉` = email, `🔔` = in-app inbox. "Permission" is what a recipient must hold.

### Tours

| Action | 🔔 Who | ✉ Who | Permission | Lands on |
|---|---|---|---|---|
| Operator submits a tour for review | **Platform** | `ADMIN_EMAIL` | `MANAGE_TRIPS` | the tour's review step |
| Island Tours approves it | Operator | Operator | `EDIT_TRIP` | the tour's review step |
| Island Tours requests changes | Operator | Operator | `EDIT_TRIP` | the tour's review step |
| Tour is published | Operator | — | `EDIT_TRIP` | the tour's review step |
| **A live tour drops out of listings** (no bookable departures in 30 days) | **Both** | — | `EDIT_TRIP` | the tour's schedule step |

The last one is the reason this system earns its keep: before it, a published tour could go dark and
nobody found out until someone opened it.

### Calendar sync (iCal import)

| Action | 🔔 Who | ✉ Who | Permission | Lands on |
|---|---|---|---|---|
| **An imported busy block lands on a booked departure** | Operator | Operator | `MANAGE_AVAILABILITY` | the tour's schedule step |
| **A connected calendar stops syncing** | Operator | Operator | `MANAGE_AVAILABILITY` | the tour's schedule step |
| A connected calendar starts working again | Operator | Operator | `MANAGE_AVAILABILITY` | the tour's schedule step |
| A sync ran and changed dates | — | — | — | (sync history only) |

**Platform is not an audience for any of these.** A broken feed is the operator's channel, their
credential and their fix; routing it to Island Tours would bury the handful of things that genuinely
need us under other people's expired Airbnb links.

Three rules govern the cadence, and all three exist to keep the emails worth opening:

- **Failure is sent on the TRANSITION into a broken state, once.** A feed down overnight is polled
  ~96 times; every one of those after the first is silent. An operator told six times about one dead
  link stops reading the seventh.
- **Recovery is the other half of that pair.** It is what makes the silence in between safe to
  interpret - without it, an operator who pasted a fresh link has no way to know it took, so they go
  back to checking the dashboard and the email stops being trusted.
- **A routine successful sync emails nobody.** It is the normal case, it happens up to 96 times a day
  per connection, and the bell plus `ical_sync_logs` already record it.

Conflict is the one that justifies the feature: iCal is **polled, not pushed**, so a channel can sell
a seat we only learn about hours later. The atomic seat claim cannot see it and nothing else in the
system will say so. In `WARN_ONLY` - the default, because iCal carries no seat count and one external
booking must not close a 60-seat boat - nothing is written to availability at all, and **this
notification IS the product**.

Both channels are addressed to the operator's `contactEmail`, falling back to the owner's login
address. Sending is fire-and-forget and failures are logged, never thrown: the sync is already
committed by then, and losing it because Resend is down is strictly worse than a missed email.

### Commercial

| Action | 🔔 Who | ✉ Who | Permission | Lands on |
|---|---|---|---|---|
| Operator requests Spotlight | **Platform** | — | `APPROVE_SPOTLIGHT` | the spotlight queue |
| Spotlight approved | Operator | — | `EDIT_TRIP` | the tour's reach step |
| Spotlight rejected | Operator | — | `EDIT_TRIP` | the tour's reach step |
| Nightly job demotes a tier after grace | **Both** | — | `EDIT_TRIP` | the tour's reach step |

### Bookings & cancellations

| Action | 🔔 Who | ✉ Who | Permission | Lands on |
|---|---|---|---|---|
| Booking confirmed | Operator | Traveller **and** operator | `VIEW_BOOKINGS` | the booking |
| Booking cancelled (admin executes) | Operator | Traveller and operator | `VIEW_BOOKINGS` | the booking |
| Traveller requests a cancellation | **Platform** | `ADMIN_EMAIL` + traveller ack + operator heads-up | `EDIT_BOOKING` | the booking |
| Traveller withdraws the request | **Platform** | `ADMIN_EMAIL` first ("do not process") + traveller ack + operator heads-up | `EDIT_BOOKING` | the booking |
| Booking restored (admin reverses a cancellation) | Operator | Traveller (confirmation email re-sent) | `VIEW_BOOKINGS` | the booking |
| Operator reports they must cancel | **Platform** | `ADMIN_EMAIL` | `EDIT_BOOKING` | the booking |
| Operator reports non-payment | **Platform** | — | `MANAGE_PAYMENTS` | the booking |

**Booking-confirmed is operator-only in the bell, on purpose.** Island Tours reads bookings on the
Bookings screen; one bell row per booking across every operator would bury the handful of items that
genuinely need a human here. If that trade stops being right at volume, it is a one-word change in
`inbox-events.ts` (`audience: 'both'`).

### Reviews, money, team

| Action | 🔔 Who | ✉ Who | Permission | Lands on |
|---|---|---|---|---|
| Traveller submits a review | **Platform** | — | `APPROVE_REVIEW` | the reviews queue |
| Review approved and published | Operator | — | `VIEW_REVIEWS` | the reviews page |
| Payout marked as paid | Operator | Operator + `ADMIN_EMAIL` | `VIEW_BOOKING_FINANCIALS` | settlements |
| Operator invites a team seat | Operator | The invitee (set-password link) | `MANAGE_TEAM` | the team page |

`VIEW_BOOKING_FINANCIALS`, not `VIEW_BOOKINGS`, on the payout: conflict #7 keeps amounts away from
guide-level seats, and a payout notification **is** an amount.

### Email-only (identity and lifecycle)

These never produce a bell — they are addressed to one person, usually before they can sign in:
operator invite, staff/team invite, "hat added" (an existing account gained a role), password reset,
password-change confirmation, email verification, email-change confirmation, traveller login code,
booking confirmation, pre-tour reminder, and the post-tour review request.

---

## 4. What an admin actually receives

Seven platform events: tour submitted for review, spotlight requested, cancellation requested,
cancellation request withdrawn, operator-reported cancellation, operator-reported non-payment,
review submitted — plus the two `both` events (tier demoted, tour unlisted).

Every one of them is **work waiting for a decision by Island Tours**. That is the design: the admin
bell is a to-do list, not an activity feed. If it is empty, there is nothing waiting — which is also
why a brand-new install shows an empty bell until the first operator submits something.

---

## 5. Reliability contract

- **Fire-and-forget.** `InboxService.notify()` returns `void` and swallows its own errors. A bell can
  never roll back the booking, verdict or payout that caused it. Email dispatch follows the same rule.
- **Idempotent.** `UNIQUE (userId, dedupeKey)` plus `skipDuplicates` — a repeated call writes nothing
  rather than duplicating. Events that can legitimately recur for one entity (a tour resubmitted
  after changes) carry a distinguishing key.
- **No queue.** Fan-out is two indexed reads and one `createMany`; it is not slow, external or
  retryable. See `EVENT-DRIVEN-AND-QUEUES.md` §6b.
- **Every registered event is emitted.** A test walks the source tree and fails if any `InboxEvent`
  has no call site, so this table cannot quietly drift into fiction.

---

## 6. Reading, clearing, and the login digest

| Control | Endpoint | Behaviour |
|---|---|---|
| Open a notification | — | marks that row read and navigates |
| Mark all read | `PATCH /inbox/read` `{all:true}` | read, not deleted |
| Dismiss one row | `DELETE /inbox/:id` | hard delete, scoped to the caller |
| Clear read | `DELETE /inbox` `{all:true, onlyRead:true}` | the safe sweep |
| Clear all | `DELETE /inbox` `{all:true}` | deliberate; removes unread too |

An empty request body deletes nothing and marks nothing — the destructive default is refused on
both endpoints.

**Deletes are hard.** These rows record that someone was *told* something; they are not the record
*of* anything. The booking, the verdict and the payout all survive with their own audit trails.

**The login digest** (`POST /inbox/digest`) shows what arrived since this account last saw it, once
per session, in a modal that closes on X, Esc or the backdrop. Two guards make "once per session"
real: a server-side `user.inboxDigestShownAt`, and a `sessionStorage` key shared across tabs.
Without the server marker there is no "since when"; without the client key, opening a second tab
would pop the modal again. It renders nothing when nothing is new.

---

## 7. Adding a new notification

1. Add the value to `InboxEvent` in `prisma/enums.prisma` and migrate.
2. Register it in `src/inbox/inbox-events.ts` — category, audience, and the permission that gates its
   destination page.
3. Call `this.inbox.notify({...})` from the service that performs the action, **after** the write
   succeeds, passing `actorUserId` so the person who did it is not told about it.
4. Add the row to §3 above.

The registry test fails until step 3 exists, which is the point.
