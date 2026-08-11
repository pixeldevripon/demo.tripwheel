# Email programme — the runbook (plain language)

> How the whole email system works, how to test it, how to configure it, and how to launch it.
> Written for operating the system, not building it. Technical companions:
> [`EMAIL-IMPLEMENTATION-PLAN.md`](./EMAIL-IMPLEMENTATION-PLAN.md) (architecture + contracts),
> [`EMAIL-PROGRAMME-CHECKLIST.md`](./EMAIL-PROGRAMME-CHECKLIST.md) (task-level status).

## 1. The big picture — three parts, one ledger

- **Backend (the engine).** Decides who gets which email and when, renders it, sends it through
  Resend, and writes every decision into one ledger table (`email_sends`). One row per email per
  booking/operator: **Sent**, **Failed**, or **Suppressed (with the reason)**. The database
  refuses a duplicate row, so the same email can physically never send twice — even if servers
  crash mid-way and retry.
- **Public site (what travellers see).** One page: `https://<site>/unsubscribe/<token>`. Every
  nudge/marketing email carries a personal link there; one click records the opt-out. Booking
  emails are never affected by opting out.
- **Dashboard (what admins see).** The Operator Verification queue (Approve/Reject — approving IS
  what fires the "You're approved" email and starts the onboarding sequence), an **email timeline
  on every operator** (with per-email Resend), and email rows on every **booking's detail sheet**.

Behind the scenes a **scheduler wakes every 15 minutes**, asks "who is due right now?", checks
every rule (right day and hour, not opted out, still eligible, not already decided), and sends —
capped at 200 per cycle, paced at ~2 per second, with a 15-second timeout per send, so a bad
email-provider day degrades gracefully instead of exploding.

## 2. Every email and its trigger

**Traveller emails** (7-language copy, resolved from the traveller's booking locale):

| Email | Fires | Won't fire when |
| --- | --- | --- |
| **BK-1 Confirmation** | Instantly on booking confirmed | — (subject switches to "today/tomorrow" for last-minute bookings) |
| **BK-2 Pre-tour reminder** | 24h before tour start (tour-local) | Booking cancelled/expired, cancellation request pending, booked <24h before start (BK-1 covers it), no contact email |
| **BK-3 Review request** | The morning after the tour (~10:00 tour-local) | **Master switch is OFF** (`ReviewRequestSettings.enabled`); cancelled/no-longer-completed bookings |
| **BK-3R Review reminder** | 5 days after BK-3, once only | Review already submitted; same master switch |
| **CX-1 Cancellation confirmed** | When the admin confirms a cancellation | — (wording adapts to how the booking was paid) |
| **MK-1 Next adventure** (marketing) | 72h after tour end, mornings 09:00–11:00 Curaçao | **Master switch `MK1_ENABLED` is OFF (ships dark)**; no consent recorded, opted out, booked again, cancelled, 1–2★ review, or fewer than 3 bookable tours to recommend |

**Operator emails** (English):

| Email | Fires | Won't fire when |
| --- | --- | --- |
| **OB-1 Verify email** | On signup | — |
| **OB-2 Welcome + agreement** | Operator account created | — |
| **INT-1 → sales inbox** | Operator account created | No `SALES_EMAIL`/`ADMIN_EMAIL` configured (logged, skipped) |
| **OB-2A You're approved** | **Admin clicks Approve** in the dashboard queue | — (this moment anchors the whole sequence) |
| **OB-3 First tour, step by step** | 2 days after approval, Tue–Thu 09:00–11:00 | They already submitted a tour; opted out; suspended |
| **OB-4 We'll build it with you** | 7 days after approval, same window | Same as OB-3 |
| **OB-5 Your tour is live** | Instantly on first tour published | Operator suspended or not approved |
| **OB-6 How's it going?** (from the founder) | 14 days after approval, same window — ends the sequence | Suspended; opted out |
| **OB-7 Connect your calendar** | 3 days after first tour live | **Calendar flag is OFF** (waits, never burned); calendar already connected; opted out |
| **OB-8 Better photos** | 7 days after first tour live | Opted out; suspended |
| **INT1R → sales inbox** | Operator still awaiting approval after 2 business days | No sales/admin address configured |
| **INT-2 → sales inbox** | Any tour submitted for review | Only sends the sales copy when `SALES_EMAIL` differs from `ADMIN_EMAIL` |

Extra rule for the nudges: **max one lifecycle email per operator per 3 days**, priority OB-6 >
OB-7 > OB-8, and everything stops instantly on suspension or opt-out.

## 3. How to test it, step by step

1. **Operator flow:** dashboard → Tour Operators → Add. Sales inbox gets INT-1; the operator
   address gets OB-2. Open the operator → the **email timeline** shows both rows.
2. **Approval:** Configure → Operator Verification → Approve. The operator gets OB-2A; the row
   leaves the queue; the timeline grows.
3. **Booking flow:** make a test booking on the site → BK-1 arrives; the booking's detail sheet
   in the dashboard shows the row. The T-24h reminder appears on the timeline when its moment
   comes (or as *Suppressed* with the reason if it shouldn't send).
4. **Unsubscribe:** click the opt-out link in any nudge → the public page confirms → future
   nudges show as `Suppressed: opted-out` in the timeline instead of sending.
5. **Resend:** in an operator timeline, Resend on any onboarding email → confirm → a new
   "Resend" row appears. (The dialog warns you if the recipient has opted out.)
6. **If emails don't physically arrive** on a dev machine: check `RESEND_API_KEY` is set —
   without it, rows appear as *Failed* ("service not configured") but every decision is still
   logged, which is what you're testing.

## 4. Configuration — where every switch lives TODAY

Since WP-H's backend, the switchboard is the API: `GET/PATCH /email/settings`
(admin-only). Every dashboard setting starts EMPTY and the old env/built-in
value keeps applying until an admin explicitly stores an override — nothing
changed on deploy. "Dashboard setting (env fallback)" below means exactly
that: stored value first, env var second, built-in default last.

| What | Where it lives today | Dashboard-editable? |
| --- | --- | --- |
| Review request + reminder ON/OFF + timings | `ReviewRequestSettings` row in the database (`enabled`, default **false**) | **Yes** — rides the same `/email/settings` payload (WP-H); UI in the email-centre dashboard PR |
| Onboarding nudges OB-3…OB-8 ON/OFF | Dashboard setting (built-in fallback: **on**). Off = "not yet": nothing is written, nobody is skipped permanently | **Yes** (WP-H API) |
| Calendar email (OB-7) ON/OFF | Dashboard setting (`CALENDAR_SYNC_AVAILABLE` env fallback, default off; waits, never skips anyone permanently) | **Yes** (WP-H API) |
| Photo-partner block in OB-8 | Dashboard setting (built-in fallback: ON, founder decision D6) | **Yes** (WP-H API) |
| Sales inbox address | Dashboard setting (`SALES_EMAIL` env fallback, then `ADMIN_EMAIL`) | **Yes** (WP-H API) |
| Reply-to addresses | Dashboard settings (`MAIL_REPLY_TO`, `OB6_REPLY_TO` env fallback) | **Yes** (WP-H API) |
| Every schedule timing (OB-3/4/6 delays, OB-7/8 after-live, INT1R business days, MK-1 delay, send-window weekdays + hours) | Dashboard settings (built-in fallbacks: 48h / 7d / 14d / 3d / 7d / 2 bd / 72h / Tue–Thu 09:00–11:00) | **Yes** (WP-H API) |
| From-address + provider key | `MAIL_FROM`, `RESEND_API_KEY` env | No (deliberately) |
| MK-1 marketing ON/OFF | Dashboard setting (`MK1_ENABLED` env fallback, **default OFF**) — AND the consent data beneath it (empty consent list = zero sends even when on) | **Yes** (WP-H API) |
| Opt-outs | Written automatically by the unsubscribe page | Viewer → `GET /email/opt-outs` (WP-H API; UI in the dashboard PR) |

**Booking emails (BK-1/BK-2/CX-1) have NO switch anywhere — deliberately.**
They are contractual and always-on (founder decision 2026-08-11); the API
rejects any attempt to invent such a field.

**The WP-H dashboard UI** (Activity log, Settings switchboard, People, and a
test-send button — `POST /email/test-send` sends any template with sample
data to your own inbox) ships in the `feat/email-centre-dashboard` PR; the
API above is live for it.

## 5. Consent and the marketing email, precisely

- Consent is recorded when a traveller ticks "send me travel inspiration" at checkout **and the
  booking actually completes** — an abandoned or unpaid checkout records nothing (that tick is
  only legal consent "in the context of a sale"). One row per email address, keeping the first
  booking as provenance. Historical completed bookings with the tick were backfilled on deploy.
- MK-1 sends **only** to an address with a consent row AND no marketing opt-out, checked at the
  moment of sending, and only recommends tours the site itself currently lists as bookable, with
  open departures in the next 7 days — checked live, starting from the island's *tomorrow* so it
  never advertises a boat that already left.

## 6. Founder decisions still open (these are sign-offs, not configs)

| # | Decision | Where it sits |
| --- | --- | --- |
| D1 | BK-3R reminder wording + one CX-1 refund-wording deviation | Drafts in PR #186's description — read and approve/amend |
| D2/D3 | Sales inbox + founder reply-to addresses | Set the env vars (or wait for WP-H) |
| D4 | Operator agreement PDF | Supply the file; one code spot activates the attachment |
| D6 | Dronebaas photo-partner block | Currently ON; say the word and it's one flag |
| D7 | Marketing subdomain for MK-1 | Infrastructure (Resend domain), deferred; revisit before real MK-1 volume |

## 7. Where the logs are

- **Per operator:** dashboard → operator → Email timeline (sent/failed/suppressed + reason + resend).
- **Per booking:** dashboard → booking detail sheet → Timeline section.
- **Everything at once:** `GET /email/sends` (admin) — global, filterable by
  template/status/stream/recipient/date (the WP-H Activity page renders this).
- **Transport errors:** backend server logs (addresses always redacted to `j***@host`).

## 8. Go-live sequence (when you're ready)

1. Sign off D1 (BK-3R + CX-1 wording) — the only copy still awaiting your word.
2. Set the sales + reply-to addresses — dashboard Email settings (or the
   `SALES_EMAIL`/`MAIL_REPLY_TO`/`OB6_REPLY_TO` env vars as the fallback layer).
3. Verify Resend domain settings for the from-address (and decide D7 before big MK-1 volume).
4. Flip `ReviewRequestSettings.enabled` to true → BK-3/BK-3R go live (the sweeper deliberately
   never blasts a backlog on enable).
5. When calendar sync ships: flip the calendar-email setting in the dashboard (or set
   `CALENDAR_SYNC_AVAILABLE=true`) → OB-7 starts, including for every operator who passed
   the 3-day mark while it was off (deliberately not skipped).
6. MK-1: flip the marketing setting in the dashboard (or set `MK1_ENABLED=true`) when you're
   ready for marketing sends (it ships dark). Even when on, it only reaches consented,
   not-opted-out travellers. Watch the first morning's rows.
7. After any deploy that adds email icons: `pnpm email:icons:upload` (already run for the current set).

## 9. If something looks wrong

- **"An email didn't send"** → find the operator/booking timeline row: *Suppressed* tells you the
  exact rule that stopped it (that's usually the system working); *Failed* means transport — check
  server logs and the Resend dashboard; **no row at all** means the trigger never fired (wrong
  status, outside the window, or not due yet).
- **"An email sent twice"** → it can't, from the automated paths; a second row will always be a
  `#resend-N` row — someone clicked Resend, and the timeline shows it.
- **"Stop everything to one person"** → today: insert an opt-out row / use their unsubscribe link
  (transactional booking emails will still send — they're contractual). WP-H gives this a button.
- **"Stop ALL nudges platform-wide"** → today: unset `SALES_EMAIL`+`ADMIN_EMAIL` only stops
  internal alerts; the true kill switch for lifecycle+marketing is pausing the sweep — ask before
  doing this; it's one scheduler entry.
