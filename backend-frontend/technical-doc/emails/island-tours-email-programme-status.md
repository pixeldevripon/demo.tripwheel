# The email programme, measured against the two wireframes

> **AS-BUILT UPDATE (2026-08-11): this audit is now historical.** All 17 emails plus the
> machinery neither wireframe showed are BUILT and merged (Waves 1–3, PRs #180–#188 + dashboard
> #56): the send-once ledger (`email_sends`), unsubscribe/opt-out/consent, send windows, the
> operator state machine, the dashboard approval queue + email timelines, the public unsubscribe
> page, and MK-1 behind its consent gate. What remains is operational, not construction: founder
> sign-offs (plan §5), switch flips, and the WP-H dashboard email centre (plan §4). **For how the
> system actually behaves and how to run it, read
> [`EMAIL-PROGRAMME-RUNBOOK.md`](./EMAIL-PROGRAMME-RUNBOOK.md); for task-level status,
> [`EMAIL-PROGRAMME-CHECKLIST.md`](./EMAIL-PROGRAMME-CHECKLIST.md).** The scorecard below
> ("2 built / 6 partly / 9 not started") describes 9 August, before the build.

> Markdown companion to `island-tours-email-programme-status.html` (same content, engineer-facing
> form). Status verified against the codebase on **9 August 2026**, not against the status columns
> in the wireframes.
>
> Sources: `island-tours-email-funnel-wireframe.html` ·
> `island-tours-operator-onboarding-emails-wireframe.html`

Both wireframes were read against the actual codebase, email by email, rather than against the
status column they carry. Two of them are further along than the wireframe claims, and one whole
category — the machinery that decides when an email may send — does not exist at all.

**Scorecard: 17 emails in scope — 2 built and sending · 6 partly built · 9 not started.**

---

## Customer funnel — 6 emails

The transactional spine is in better shape than the wireframe records. Notably, BK-2 is not
missing — its entire delivery mechanism shipped months ago and has been sitting idle waiting for
exactly the copy decision this wireframe makes.

| ID | Email | State | What is actually there |
| --- | --- | --- | --- |
| BK-1 | Booking confirmation | **Built** | Template, all four payment-model branches, a render spec, fired on confirm. The wireframe's version adds the operator note, what-to-bring, the anti-fraud line and a related-tours rail — so this is a reconciliation rather than a build. |
| BK-2 | Pre-tour reminder | **Partly built** | The whole T-24h spine exists and is tested: the delayed job, the outbox scheduler, the processor and a `utcReminderSentAt` guard. The job body currently logs and sends nothing, with a comment saying it is waiting on a founder copy decision. Only the template is missing. |
| BK-3 | Post-tour review request | **Built** | Tokenised invitation, hourly sweeper, suppression with the reason recorded on the row. |
| BK-3R | Review reminder | **Partly built** | The wireframe calls this "spec only". It is not: the five-day single reminder, its give-up window and its stop-on-review rule are all live. What it lacks is its own copy — it re-sends the BK-3 template today. |
| MK-1 | Next adventure | **Not started** | Nothing exists. This is the only marketing email in either wireframe, so it cannot send until consent and unsubscribe do — see the risk below. |
| CX-1 | Cancellation confirmation | **Partly built** | "Your booking is cancelled" sends today through the generic notice template. The wireframe's version is payment-model aware, which the generic one is not. |

## Operator onboarding — 11 emails

This is the greenfield half. Two emails exist in a form that can be adapted; the nine-message nudge
sequence has nothing behind it, and neither does the operator state it all hangs off.

| ID | Email | State | What is actually there |
| --- | --- | --- | --- |
| OB-1 | Confirm your email | **Partly built** | Better Auth already sends a verification email. It is not tied to an onboarding state, which is what the sequence keys off. |
| OB-2 | Welcome + agreement | **Partly built** | The set-password operator invite exists. The agreement email, with its signatory block, does not. |
| INT-1 | New operator → sales@ | **Not started** | No internal alert stream exists, and no two-business-day pending reminder. |
| OB-2A | You're approved | **Not started** | An operator verification status enum exists (unverified / pending / verified / rejected) but nothing sets it deliberately, there is no admin one-click approve, and no email hangs off it. Every nudge below is anchored to this moment, so it is the first thing that has to be built. |
| OB-3 | First tour, step by step | **Not started** | +48h, suppressed once a tour is submitted. |
| OB-4 | We'll build it with you | **Not started** | +7d, the WhatsApp rescue. |
| OB-5 | Your tour is live | **Not started** | Needs a first-tour-live event, which is not emitted today. |
| OB-6 | How's it going? | **Not started** | +14d, personal reply-to, ends the sequence. |
| OB-7 | Connect your calendar | **Not started** | Feature-flag gated. The calendar feed itself exists, so only the email and the gate are new. |
| OB-8 | Make your page stronger | **Not started** | Live +7d, page-strength tips. |
| INT-2 | New tour → sales@ | **Partly built** | A tour-submitted alert goes to admins today. It is not routed to sales@ as a pipeline signal. |

---

## What neither wireframe has behind it

This is the part that does not show up as an email in either document, and it is where most of the
risk sits. Both wireframes state these rules in their footnotes; **none of them exist as code**.

1. **A send log with send-once idempotency.** Both wireframes require it by name: one row per
   recipient per template, with a unique index. Without it, a retried job sends a second welcome
   email. Nothing like it exists.
2. **Marketing consent and unsubscribe.** There is a `newsletterOptIn` column on bookings and
   nothing reads it. No consent record, no unsubscribe token, no preference page.
3. **Send windows.** Tuesday to Thursday, 09:00–11:00 America/Curaçao, and "around 10:00
   tour-local" for BK-3. Sends fire on their trigger today, whenever that lands.
4. **Operator onboarding state.** created → accepted → approved, plus the counters the suppression
   rules read (tours submitted, first tour live). The nine-message sequence has nothing to hang off
   until this exists.
5. **Dashboard surfaces.** The onboarding pipeline, admin one-click approve, an email timeline per
   operator and per booking, and resend. All new, and in the second repo.

---

## Estimate

Hours of build time, bottom-up. The calibration is the saved-tours page finished 9 Aug: one page
rebuilt across backend and frontend, two new API endpoints, eight components, seven locales,
twenty-two new tests and five rounds of browser verification, in about an hour. The email work is
roughly twenty-five times the surface but around eight times the effort, because seventeen emails
share one shell and one send engine.

| Piece | Why that number | Hours |
| --- | --- | --- |
| Shared send spine | Send log, suppression evaluator, send windows, consent and unsubscribe token. Three migrations. The only genuinely new design work. | 3.5 |
| Customer funnel | BK-2 and BK-3R are copy on top of working machinery. MK-1 is new. BK-1 and CX-1 are reconciliations against a richer wireframe, and BK-1 alone carries four payment-model branches and a render spec that moves with it. | 6 |
| Operator onboarding | The state machine, approval trigger and migration (~2h), then nine templates plus two internal alerts at roughly 25 minutes each once the shell exists. | 6 |
| Dashboard | Second repo: pipeline, one-click approve, email timeline, resend, opt-out view. Permissions are mirrored in two places and that repo has no CI, so it needs manual click-through. | 4 |
| Unsubscribe & preferences page | Public site, seven locales. Required before MK-1 can legally send. | 1.5 |
| Copy in seven locales | Thirteen new or changed templates across seven languages, machine-first through the existing translation path. | 2.5 |
| Tests, verification, PRs | A render spec per template, two repos, two base branches, five PRs. | 3 |
| **Total** | Range allows for review turnarounds | **24–28** |

---

## Suggested phasing

Each phase ships on its own and is useful without the next one. The order puts the revenue-adjacent
work first and the piece with a consent dependency last. One dependency drives the split: five of
the onboarding nudges are a lifecycle stream, and a lifecycle stream has to carry an unsubscribe —
so the opt-out mechanism ships with phase two, not with the marketing work it is usually
associated with.

### Phase one — Transactional funnel (~9.5h)

Every transactional email in the customer funnel, live. Needs no consent work at all, which is why
it can start immediately.

- **Send spine** — send log with send-once idempotency, the suppression evaluator, and the
  tour-local send windows. Three migrations.
- **BK-2 pre-tour reminder** — template only; the 24h-before machinery is already built and tested.
- **BK-3R review reminder** — its own copy, replacing the re-sent BK-3 template.
- **BK-1 booking confirmation** — brought up to the wireframe: operator note, what to bring, the
  anti-fraud line, the related-tours rail, across all four payment models.
- **CX-1 cancellation** — payment-model-aware copy in place of the generic notice.

### Phase two — Operator onboarding (~14h)

The full sequence plus the dashboard needed to run it. The largest phase, because it is the one
with nothing underneath it today.

- **Onboarding state** — created → accepted → approved, plus the counters the suppression rules
  read. Everything below anchors to the approval moment.
- **Nine operator emails** — OB-1 through OB-8 and the approval mail, with their Tue–Thu windows
  and zero-tours suppression.
- **Two internal alerts** — new operator and new tour to sales@, with the two-business-day pending
  reminder.
- **Opt-out and preference page** — required here, not in phase three: five of these nudges are a
  lifecycle stream and cannot legally send without an unsubscribe.
- **Dashboard** — pipeline view, admin one-click approve, an email timeline per operator, and
  resend.

### Phase three — Marketing (~3.5h)

Small, because phase two has already paid for the unsubscribe half of it. What is left is the
consent record and the email itself.

- **Consent record** — explicit marketing opt-in with its source and timestamp, which nothing on
  the platform stores today.
- **MK-1 next adventure** — the template, the +72h trigger off tour end, and its six suppression
  conditions.
- **Gate** — MK-1 sends only to travellers with a recorded opt-in, so an empty consent table simply
  means nothing goes out.

---

## Two things that could move the number

- **Copy is the one line that will not compress.** The 2.5 hours for seven locales assumes
  machine-first translation, reviewed afterwards. If the client wants human-reviewed copy before
  anything sends, that is calendar time rather than build time, and it sits outside this estimate
  entirely. Worth noting that both wireframes admit some copy is not written yet.
- **MK-1 is marketing, and marketing needs consent.** Every other email in both documents is
  transactional and can send on the strength of the booking or the account. MK-1 cannot. It needs a
  consent record and a working unsubscribe before it is allowed to go out, which is why it is
  phased last — it is the item most likely to turn into a scope conversation rather than code.
