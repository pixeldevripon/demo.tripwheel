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
| **MK-1 Next adventure** (marketing) | 72h after tour end, mornings 09:00–11:00 Curaçao | **No consent recorded**, opted out, booked again, cancelled, 1–2★ review, or fewer than 3 bookable tours to recommend |

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

| What | Where it lives today | Dashboard-editable? |
| --- | --- | --- |
| Review request + reminder ON/OFF | `ReviewRequestSettings` row in the database (`enabled`, default **false**) | Not yet → WP-H switchboard |
| Calendar email (OB-7) ON/OFF | `CALENDAR_SYNC_AVAILABLE` env var (default off; waits, never skips anyone permanently) | Not yet → WP-H |
| Photo-partner block in OB-8 | Code flag, currently ON (founder decision D6) | Not yet → WP-H |
| Sales inbox address | `SALES_EMAIL` env (falls back to `ADMIN_EMAIL`) | Not yet → WP-H |
| Reply-to addresses | `MAIL_REPLY_TO`, `OB6_REPLY_TO` env | Not yet → WP-H |
| From-address + provider key | `MAIL_FROM`, `RESEND_API_KEY` env | No (deliberately) |
| MK-1 marketing ON/OFF | **No switch — the consent data IS the switch.** Empty consent list = zero sends, guaranteed | People view → WP-H |
| Opt-outs | Written automatically by the unsubscribe page | Viewer → WP-H |

**WP-H (planned, plan §4) moves the first five into a dashboard "Email" section** — Activity log,
Settings switchboard, People (opt-outs + consents), and a test-send button — with env values as
fallback so nothing breaks during the transition.

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
- **Everything at once:** only the `email_sends` database table today — **the WP-H Activity page
  is the fix** (global, filterable, with detail + resend).
- **Transport errors:** backend server logs (addresses always redacted to `j***@host`).

## 8. Go-live sequence (when you're ready)

1. Sign off D1 (BK-3R + CX-1 wording) — the only copy still awaiting your word.
2. Set `SALES_EMAIL`, `MAIL_REPLY_TO`, `OB6_REPLY_TO` on the VPS (or via WP-H later).
3. Verify Resend domain settings for the from-address (and decide D7 before big MK-1 volume).
4. Flip `ReviewRequestSettings.enabled` to true → BK-3/BK-3R go live (the sweeper deliberately
   never blasts a backlog on enable).
5. When calendar sync ships: set `CALENDAR_SYNC_AVAILABLE=true` → OB-7 starts, including for
   every operator who passed the 3-day mark while it was off (deliberately not skipped).
6. MK-1 needs no flip — it grows with the consent list. Watch the first morning's Activity rows.
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
