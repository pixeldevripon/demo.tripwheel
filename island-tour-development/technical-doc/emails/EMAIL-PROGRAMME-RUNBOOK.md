# Email programme — the runbook (plain language)

> The operator's manual for the whole email system: what exists, how it decides to send, how you
> control it from the dashboard, how to test it, and what to do when something looks wrong.
> Technical companions: [`EMAIL-IMPLEMENTATION-PLAN.md`](./EMAIL-IMPLEMENTATION-PLAN.md)
> (architecture + contracts), [`EMAIL-PROGRAMME-CHECKLIST.md`](./EMAIL-PROGRAMME-CHECKLIST.md)
> (task-level build status).
>
> The dashboard surfaces described throughout ship in dashboard PRs #57 (`feat/email-centre-dashboard`)
> and #58 (`email-settings-into-settings`, the 2026-08-12 reorg below); the API behind them is
> live in production.
>
> **Where things live (after the 2026-08-12 reorg):** the send log is **Email → Activity** in the
> sidebar; every switch, address and timing — **including when review invitations go out** — is
> **Settings → Email** (four tabs). The old top-level Settings → Reviews tab is gone: its
> Trustpilot/Google hookup moved to **Settings → Integration → Reviews**, and its email schedule
> moved into **Settings → Email → Schedules**. The compliance ledger (opt-outs and consents) is
> still at `/email/people` but is deliberately no longer in the sidebar — type the address, or
> reach it from a suppression reason you're investigating.

## 1. The big picture — three parts, one ledger

**The backend is the engine.** It decides who gets which email and when, renders it in the right
language, sends it through the email provider (Resend), and writes **every decision** into one
ledger. One row per email per booking/operator, with exactly three possible outcomes:

| Outcome | Meaning |
| --- | --- |
| **Sent** | Handed to the email provider successfully |
| **Failed** | The provider refused or was unreachable — the row keeps the error text |
| **Suppressed** | The system *deliberately decided not to send* — the row keeps the reason (e.g. `opted-out`, `tours-submitted`, `no-consent`) |

The database physically refuses a second row for the same email + same person, so a duplicate
send is impossible — even if servers crash mid-way and retry.

**The public site owns one page:** `https://<site>/unsubscribe/<token>`. Every nudge and
marketing email carries a personal link there; one click records the opt-out. Booking emails are
never affected by opting out — they're part of the purchase.

**The dashboard is your control room.** Three places matter:

- **Configure → Operator Verification** — your Approve click is itself an email trigger (it sends
  "You're approved" and starts the onboarding sequence).
- **Email → Activity** — the global log of every send decision, plus the test-send button.
- **Settings → Email** — every switch, address and timing, in four tabs (review invitations
  included, at the bottom of *Schedules*).

Section 3 walks through all of it.

**The heartbeat:** a scheduler wakes **every 15 minutes**, asks "who is due right now?", checks
every rule (right day and hour, switch on, not opted out, still eligible, not already decided),
and sends — capped at 200 per cycle, paced at ~2 per second, 15-second timeout per send. A bad
email-provider day degrades gracefully; it can never snowball.

## 2. Every email and its trigger

**Traveller emails** — 7 languages, chosen from the traveller's booking:

| Email | Fires | Won't fire when |
| --- | --- | --- |
| **Booking confirmation** (BK-1) | Instantly when a booking is confirmed | — (subject switches to "today/tomorrow" for last-minute bookings) |
| **Pre-tour reminder** (BK-2) | 24h before tour start, tour-local time | Cancelled/expired; a cancellation request is pending; booked <24h before start (BK-1 covers it); no contact email |
| **Review request** (BK-3) | The morning after the tour (~10:00 tour-local) | **Reviews switch is OFF**; booking no longer completed |
| **Review reminder** (BK-3R) | 5 days after the request, once only | Review already submitted; same switch |
| **Cancellation confirmed** (CX-1) | When the admin confirms a cancellation | — (wording adapts to how the booking was paid) |
| **Next adventure** (MK-1, marketing) | 72h`*` after tour end, mornings 09:00–11:00`*` Curaçao | **Marketing switch OFF (ships dark)**; no consent; opted out; booked again; cancelled; 1–2★ review; fewer than 3 bookable tours to recommend |

**Operator emails** — English:

| Email | Fires | Won't fire when |
| --- | --- | --- |
| **Verify email** (OB-1) | On signup | — |
| **Welcome + agreement** (OB-2) | Operator account created | — |
| **New operator → sales inbox** (INT-1) | Operator account created | No sales/admin address configured (logged, skipped) |
| **You're approved** (OB-2A) | **Your Approve click** in the verification queue | — (this moment anchors the whole sequence) |
| **First tour, step by step** (OB-3) | 2 days`*` after approval, Tue–Thu 09–11`*` | Already submitted a tour; opted out; suspended; onboarding switch off |
| **We'll build it with you** (OB-4) | 7 days`*` after approval, same window | Same as OB-3 |
| **Your tour is live** (OB-5) | Instantly on first tour published | Suspended or not approved |
| **How's it going?** (OB-6, from the founder) | 14 days`*` after approval — ends the sequence | Suspended; opted out; onboarding switch off |
| **Connect your calendar** (OB-7) | 3 days`*` after first tour live | **Calendar switch OFF** (waits — nobody is skipped permanently); calendar already connected; opted out |
| **Better photos** (OB-8) | 7 days`*` after first tour live | Opted out; suspended; onboarding switch off |
| **Still pending → sales inbox** (INT1R) | Operator awaiting approval > 2 business days`*` | No sales/admin address |
| **New tour → sales inbox** (INT-2) | Any tour submitted for review | Sales copy only when the sales address differs from the admin address |

Every value marked with `*` is editable in **Settings → Email**; the shown number is the built-in
default that applies while the field is empty. Extra guardrails on the nudges: **max one
lifecycle email per operator per 3 days`*`* (priority: check-in > calendar > photos), and
everything stops instantly on suspension or opt-out.

**Booking emails (confirmation, reminder, cancellation) have NO off switch anywhere — on
purpose.** They're contractual; the API rejects any attempt to invent such a switch.

## 3. The dashboard — your control room

Two surfaces, one hidden third:

| What you want | Where |
| --- | --- |
| See what was sent, skipped or failed · send yourself a test | **Email → Activity** (sidebar) |
| Switch a group on/off · set addresses · change any timing · set the send window | **Settings → Email** |
| Change when review invitations go out | **Settings → Email → Schedules** (bottom card) |
| Connect Trustpilot / Google reviews | **Settings → Integration → Reviews** |
| Check who unsubscribed or who consented to marketing | `/email/people` — live, but not in the sidebar |

### Email → Activity (the global log)

Every email decision across the whole platform, newest first. Filter by email type (all 18),
outcome (Sent / Failed / Suppressed), stream (booking / onboarding / marketing / internal),
recipient address, and date range. Click any row for the full story: exact timestamps, the
suppression reason or error text, the provider's message id, and — for onboarding emails — a
**Resend** button.

How to read a row:
- **Sent** — it went out. Done.
- **Suppressed** — the system chose not to send and the reason says why. This is usually the
  system *working*: `opted-out` (they unsubscribed), `tours-submitted` (the nudge became
  irrelevant), `no-consent` (marketing gate), `suspended`, `insufficient-open-tours` (MK-1
  couldn't find 3 bookable tours), `cancellation-pending`, and so on.
- **Failed** — transport problem. The error text is on the row; check the Resend dashboard if it
  persists.
- A scope starting `test:` is a test-send (yours); a scope ending `#resend-N` was a manual resend.

**Test-send button** (toolbar): pick any of the 18 emails → it sends a sample-data render **to
your own signed-in address** (it cannot be pointed anywhere else) → the row appears in the list.
The fastest way to see any email in a real inbox.

### Settings → Email (the switchboard)

Four tabs, **one Save**. The tabs are only a way of reading the form — you can change something
under *Email Groups*, something else under *Schedules*, and save both at once. The counter above
the button says how many changes are pending across all four.

Every field starts as **"Using default (X)"** — the built-in value keeps applying until you type
something. Set a value and it takes effect within about a minute (and within 15 minutes for
schedule timing, the sweep cadence). Every field has a **"Use default"** action to clear back.
Only the fields you changed are sent.

| Tab | Fields | Defaults |
| --- | --- | --- |
| **Email Groups** | Marketing ("Your next adventure") · Onboarding nudges · Calendar email · Photo-partner block | off · on · off · on |
| **Addresses** | Sales inbox · Reply-to (all mail) · Reply-to for the founder check-in | env values, then admin address |
| **Schedules** | How-to delay · Rescue delay · Check-in delay · Calendar after-live · Photos after-live · Sales pending-reminder · Marketing delay after tour end | 48h · 7d · 14d · 3d · 7d · 2 business days · 72h |
| **Send Window** | Weekday chips + start/end hours (Curaçao time) | Tue–Thu, 09:00–11:00 |

Safety built in: addresses must be a single plain email (nothing can be smuggled in), timings
have sane bounds, the window can't be made empty, and every change is logged with **which admin
made it**.

**Review invitations sit at the bottom of the Schedules tab**, in a card of their own:
on/off, how many days after the tour the invitation goes out and at what local hour, how many
days later the single reminder follows (with its own on/off), how old a booking may be before
it is never chased, and the batch size. It has **its own Save button** — it writes the review
schedule, not the email settings, which is why it is a separate card rather than more fields in
the form above. Before 2026-08-12 it lived in a top-level Settings → Reviews tab; that tab is
gone and this is now the only place those numbers exist.

One access note, in case a colleague reports a different-looking screen: the switches, addresses
and timings above need the admin-only system permission, while the review card needs only the
ordinary settings permission. A staff seat holding the latter opens Settings → Email and sees the
review card by itself — that is deliberate, not a broken page.

### /email/people (the compliance ledger, unlinked)

Not in the sidebar since 2026-08-12 — it answers a question you only ask while investigating, so
type the address or come back to it when a suppression reason sends you looking:

- **Opt-outs** — everyone who clicked unsubscribe, with which stream they left (onboarding
  nudges vs marketing). Searchable by email.
- **Consents** — everyone eligible for marketing: they ticked "send me travel inspiration"
  **during a completed purchase**. Shows where the consent came from. Searchable.

### The two older surfaces (still there)

- **Per operator**: open any operator → Email timeline (their personal history + resend).
- **Per booking**: open any booking → the Timeline section shows its email rows.

## 4. How to test everything, step by step

1. **Fastest check of any email's look:** Email → Activity → **Test send** → pick a template →
   check your inbox. The row appears in the log.
2. **Operator flow end-to-end:** Tour Operators → Add → sales inbox gets "New operator", the
   operator gets the welcome → open the operator: both rows on the timeline → Configure →
   Operator Verification → **Approve** → "You're approved" lands and the sequence is armed.
   Days 2/7/14 nudges then appear on schedule (or as Suppressed-with-reason).
3. **Booking flow:** make a test booking → confirmation arrives, row on the booking sheet →
   the reminder fires T-24h (watch Activity).
4. **Unsubscribe:** click the opt-out link in any nudge → public page confirms → the person
   appears at `/email/people` → Opt-outs → their next nudge shows in Activity as
   `Suppressed: opted-out`.
5. **Settings behave:** change a timing (e.g. how-to delay 48h → 1h) in Settings → Email →
   *Schedules*, on a fresh approved test operator → the nudge shows up within the next
   15-minute sweep inside the window. Set it back with "Use default".
6. **On a dev machine with no `RESEND_API_KEY`:** everything still *decides* and logs — rows
   show as Failed ("service not configured"), which is exactly what you're verifying.

## 5. Consent and marketing, precisely

- A consent row is created when a traveller ticks the inspiration box **and completes the
  purchase**. Abandoned/unpaid checkouts record nothing — legally, the tick only counts "in the
  context of a sale". One row per address, first booking kept as provenance. Historical
  completed bookings were backfilled (visible at `/email/people` → Consents).
- MK-1 sends **only** when: the marketing switch is on **and** the address has a consent row
  **and** no marketing opt-out — all checked at the moment of sending. It only recommends tours
  the site itself currently lists as bookable, with open departures in the next 7 days, counted
  from the island's *tomorrow* — it can never advertise a boat that already left.
- Two dark layers by design: the switch (yours) and the consent data (the traveller's). Both
  must say yes.

## 6. Founder items still open (sign-offs, not settings)

| # | What | Where |
| --- | --- | --- |
| D4 | Supply the operator agreement PDF | Email works link-less until then; one code spot activates the attachment |
| D7 | Separate marketing sending domain for MK-1 | Resend infrastructure; revisit before real MK-1 volume |

Everything else is decided (2026-08-11): the review-reminder wording is approved, the
cancellation email uses the wireframe's exact text, machine-first translations ship (human
edits welcome anytime), the photo-partner block stays ON per the wireframe, and the sales +
reply-to addresses are ordinary Settings fields.

## 7. Go-live sequence

1. Settings → Email → *Addresses*: set the **sales inbox** and **reply-to** addresses (this is
   D2/D3 — the last two open items that are yours to type rather than decide).
2. Verify the Resend domain for the from-address (and decide D7 before real marketing volume).
3. Settings → Email → *Schedules* → the review-invitation card: flip **Send review request
   emails ON** → requests + reminders go live (the sweeper deliberately never blasts a backlog
   on enable). Remember that card saves on its own button.
4. When calendar sync ships: Settings → Email → *Email Groups* → flip **Calendar email ON** →
   the connect-your-calendar nudge starts, including for every operator who passed the 3-day
   mark while it was off (deliberately not skipped).
5. Flip **Marketing emails ON** in the same tab when ready → the "next adventure" email reaches
   consented, not-opted-out travellers only. Watch the first morning in Activity.
6. After any deploy that adds email icons: `pnpm email:icons:upload` (current set already done).

## 8. If something looks wrong

- **"An email didn't send"** → Email → Activity, filter to the person/template:
  **Suppressed** = the reason on the row explains it (usually correct behaviour) ·
  **Failed** = transport; check the error text and the Resend dashboard ·
  **no row at all** = the trigger never fired (wrong status, outside the window, switch off, or
  simply not due yet).
- **"An email sent twice"** → automated paths can't; a second row is always `#resend-N` —
  someone clicked Resend, and Activity shows it.
- **"Stop everything to one person"** → have them click their unsubscribe link (or ask us to add
  an opt-out row). Booking emails still send — contractual.
- **"Stop a whole category platform-wide"** → Settings → Email → *Email Groups*: flip the group
  switch off (review invitations: the card under *Schedules*). It's "pause", not "cancel":
  nobody is skipped permanently; turning it back on resumes where things left off.
- **"A setting seems to have no effect"** → check the field actually shows "Set here" (not
  "Using default"); remember schedule changes surface at the next 15-minute sweep, inside the
  send window.

## 9. For developers (one paragraph)

Ledger: `email_sends` (unique `[templateKey, scopeId]` = send-once). Settings: `email_settings`
singleton resolved `stored ?? env ?? built-in` (`EmailSettingsService`, ~60s cache) + the
review pair in `ReviewRequestSettings`. Sweep: `email.lifecycle-sweep` every 15 min
(`OnboardingEmailsService` + `NextAdventureEmailsService`), anti-join pre-filter, cap 200/tick,
2/s pacing, 15s transport timeout. API: `GET/PATCH /email/settings`, `GET /email/sends|opt-outs|consents`,
`POST /email/test-send` — all `MANAGE_SYSTEM`. Copy: locked in code, 7-locale `*.copy.ts`
modules for traveller emails. Full contracts: the plan §2 and §4.
