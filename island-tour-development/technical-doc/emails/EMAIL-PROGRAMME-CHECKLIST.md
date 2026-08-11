# Email programme — build checklist

> The tracking companion to [`EMAIL-IMPLEMENTATION-PLAN.md`](./EMAIL-IMPLEMENTATION-PLAN.md).
> Tasks are grouped **by scope** — BACKEND → DASHBOARD → FRONTEND — so each repo's work can be
> handed to its own agent. Within a scope they keep their work-package identity (WP-A…WP-G) and
> every task has a stable ID (`A-01`, `E-07`, …) to reference in commits and PR bodies.
> **Update this file (and `MASTER-CHECKLIST.md`) in the same commit as the work.** Flip
> `- [ ]` → `- [x]`, put the PR number on the package row in Progress when it merges.
> Contract changes (plan §2) get their own PR before any consumer changes.

## Progress

| Wave | Package | Scope | Branch | Status | PR |
| --- | --- | --- | --- | --- | --- |
| 1 | WP-A send spine | backend | `feat/email-send-spine` | **merged** | #181 |
| 1 | WP-C operator state machine | backend | `feat/operator-onboarding-state` | **merged** | #180 |
| 2 | WP-B customer funnel | backend | `feat/email-customer-funnel` | **in review** | — |
| 2 | WP-D onboarding sequence | backend | `feat/email-onboarding-sequence` | **in review** | #185 |
| 2 | WP-E dashboard surfaces | dashboard | `feat/operator-onboarding-dashboard` | not started | — |
| 2 | WP-F unsubscribe page | frontend | `feat/unsubscribe-page` | not started | — |
| 3 | WP-G consent + MK-1 | backend | `feat/email-mk1-marketing` | not started | — |

Gates: WP-B/D/F start after WP-A merges · WP-D/E also need WP-C · WP-E's edit-form change merges
AFTER WP-C (DTO strips `verificationStatus`) · **WP-G may not merge until WP-F is live in prod.**

---

# BACKEND (`island-tour-development/backend` — PRs base `prod`)

## WP-A — Send spine — `feat/email-send-spine`

### Schema & migration

- [x] A-01 Add `EmailTemplateKey` enum (18 keys, plan §2.1) to `prisma/enums.prisma`
- [x] A-02 Add `EmailStream`, `EmailSendStatus`, `EmailAudience` enums to `prisma/enums.prisma`
- [x] A-03 Create `prisma/emails.prisma` with `model EmailSend` (fields per plan §2.2, unique
      `[templateKey, scopeId]`, indexes on `[toEmail, createdAt]` and `[scopeId, createdAt]`,
      `@@map("email_sends")`)
- [x] A-04 Add `model EmailOptOut` (unique `[email, audience, stream]`, `@@map("email_opt_outs")`)
- [x] A-05 Add `model EmailConsent` (unique `[email]`, `@@map("email_consents")`)
- [x] A-06 Add `model EmailUnsubscribeToken` (`@id token`, index `[email]`,
      `@@map("email_unsubscribe_tokens")`)
- [x] A-07 Generate migration `email_programme_spine`; verify it creates NEW tables only (no
      `operators` change — WP-C owns that table)
- [x] A-08 `pnpm prisma:migrate:deploy` clean on dev DB and the e2e/test DB
- [x] A-09 Demo seeder in `prisma/demo/` inserting a handful of `EmailSend` rows (SENT + FAILED +
      SUPPRESSED) for dashboard dev; wire into the demo seed entrypoint

### EmailLogService (`src/mail/email-log.service.ts`)

- [x] A-10 `claimAndSend({templateKey, scopeId, toEmail, stream, locale, send})`: create the
      `EmailSend` row FIRST (the claim), then run `send()`
- [x] A-11 P2002 on the claim → return `{skipped: 'already-sent'}` (use `constraintIdsOf`-style
      nested adapter meta reading — see `bookings.service.ts` predicates)
- [x] A-12 Transport failure after claim → update row to `FAILED` with truncated `error`; never
      throw out of the sweep loop
- [x] A-13 `recordSuppressed({templateKey, scopeId, toEmail, stream, reason})` writes a
      SUPPRESSED row (same unique slot — a suppressed email is decided, not pending)
- [x] A-14 `isOptedOut(email, audience, stream)` (lowercases the email)
- [x] A-15 `listForScope(scopeId)` newest-first, selects only timeline fields
- [x] A-16 Provide + export from the global `MailModule`; logger per service conventions
- [x] A-17 Admin-resend rule: helper `resendScopeId(scopeId, n)` → `` `${scopeId}#resend-${n}` ``
      (next n = count of existing rows for the base scope)

### MailService widening (`src/mail/mail.service.ts`)

- [x] A-18 `SendMailOptions` gains `replyTo?: string`, `headers?: Record<string,string>`,
      `attachments?: { filename: string; content: Buffer }[]`
- [x] A-19 `sendMail()` passes all three to Resend; default `replyTo` from `MAIL_FROM`-style env
      `MAIL_REPLY_TO` when set
- [x] A-20 No behaviour change to any existing call site (grep: all current callers compile
      untouched)

### Send-window utility (`src/mail/send-window.util.ts`)

- [x] A-21 `isLifecycleWindowOpen(now?)` — Tue–Thu 09:00–11:00 America/Curacao, built on
      `localNow()` from `@/common/utils/timezone.util`
- [x] A-22 `nextLifecycleWindow(now?)` — next window open instant (for logging/UI, not scheduling)
- [x] A-23 Unit spec: boundary minutes (08:59/09:00/10:59/11:00), Friday→Tuesday rollover, UTC
      offsets (Curaçao is fixed UTC-4, no DST — assert that assumption in the spec)

### Unsubscribe tokens + public API

- [x] A-24 `issueUnsubscribeToken(email, audience, stream)` — reuse the row for the same triple if
      one exists (links in old emails stay valid)
- [x] A-25 `src/mail/email-preferences.controller.ts` — `GET /email/unsubscribe/:token`:
      `@Public()`, throttled, returns `{ email: masked, audience, stream, optedOut }`; unknown
      token → 404 (same shape as review tokens, no oracle)
- [x] A-26 `POST /email/unsubscribe/:token` — idempotent upsert of `EmailOptOut`
      (`source: 'unsubscribe-link'`); 404 unknown token
- [x] A-27 Email masking helper (`j***@host.com` — reuse `redact()` pattern from `MailService`)
- [x] A-28 DTOs (`dto/email-preferences.dto.ts`) + swagger file per module conventions
- [x] A-29 Static-before-dynamic route order respected in the controller

### Timeline read endpoints

- [x] A-30 `GET /operators/:id/emails` — `@RequirePermissions(MANAGE_OPERATORS)`, returns
      `EmailSend` rows for `scopeId = operatorId` (base + `#resend-*`), newest first
- [x] A-31 `GET /bookings/:id/emails` — booking-scoped guard consistent with existing booking admin
      reads
- [x] A-32 Response DTOs with `@ApiProperty` examples; paginated wrapper if > 50 rows possible

### Queue & env plumbing

- [x] A-33 `PlatformJobData` → discriminated union (`{ bookingId }` | `{ operatorId, templateKey }`);
      processor destructures per job name; existing booking jobs compile unchanged
- [x] A-34 Add `PLATFORM_JOBS.ONBOARDING_EMAIL`
- [x] A-35 Add `PLATFORM_SCHEDULES.EMAIL_LIFECYCLE_SWEEP = { name: 'email.lifecycle-sweep',
      every: 900_000 }` + processor case → `NightlyJobsService.emailLifecycleSweep()` (no-op stub
      logging "no senders registered" until WP-D)
- [x] A-36 Verify scheduler registration/pruning picks the new entry up (boot log
      "Registered 5 job schedulers")
- [x] A-37 `env.validate.ts`: add `SALES_EMAIL`, `MAIL_REPLY_TO`, `OB6_REPLY_TO`,
      `CALENDAR_SYNC_AVAILABLE`, `WALKTHROUGH_VIDEO_URL` (all optional) + the missing
      `ADMIN_EMAIL` entry; update `.env.example`

### Tests & ship

- [x] A-38 `email-log.service.spec.ts`: claim-first ordering, P2002 race → exactly one send,
      FAILED update path, suppressed rows, opt-out check, resend scope ids
- [x] A-39 `test/email-preferences.e2e-spec.ts`: GET resolve, POST act, POST repeat (idempotent),
      unknown token 404 on both verbs
- [x] A-40 Full backend suite green (`pnpm test`, `pnpm test:e2e`); lint clean
- [x] A-41 Reviewer agent pass; findings verified against source before acting
- [x] A-42 Docs: `MASTER-CHECKLIST.md` + this file + plan §6 flipped, same commit
- [x] A-43 PR merged; post-deploy smoke: boot log shows 5 schedulers, unsubscribe GET 404s on a
      junk token in prod

## WP-C — Operator state machine + internal alerts — `feat/operator-onboarding-state`

### Schema & migration

- [x] C-01 `prisma/operators.prisma`: add `verificationDecidedAt DateTime?`,
      `firstTourLiveAt DateTime?`, `salesPendingReminderAt DateTime?`
- [x] C-02 Generate migration `operator_onboarding_state` (columns only, no new tables)
- [x] C-03 Deploy clean on dev + test DBs

### Verification endpoint

- [x] C-04 `dto`: `DecideVerificationDto { decision: 'VERIFIED' | 'REJECTED' }` (enum-validated)
- [x] C-05 `POST /operators/:id/verification` — controller route (static-before-dynamic order),
      `@RequirePermissions(MANAGE_OPERATORS)`, swagger decorator
- [x] C-06 Service: transition guard — only `PENDING → VERIFIED | REJECTED`; anything else → 409
      with the current status in the message
- [x] C-07 Stamp `verificationStatus` + `verificationDecidedAt` atomically (guarded
      `updateMany({ where: { id, verificationStatus: 'PENDING' } })` — no decide race)
- [x] C-08 Log the acting admin (logger per service conventions: who, operator id, decision)
- [x] C-09 Remove `verificationStatus` from `UpdateOperatorDto` (closes the blanket
      `PATCH /operators/:id` write at `operators.service.ts:401`)
- [x] C-10 Operator-creation path sets `verificationStatus: PENDING` explicitly

### OB-2A approval email

- [x] C-11 `templates/operator-approved.template.ts` (`auth-email-shell.ts` base): wireframe copy
      — "Good news, {firstName}" / company approved / "Add your first tour" CTA
      (`${dashboardAppBase()}/tours/new` or the correct dashboard route) + dashboard intro block
- [x] C-12 `MailService.sendOperatorApprovedEmail()` facade; barrel export in
      `templates/index.ts`
- [x] C-13 Send fired from the verification service on VERIFIED (one-shot by the C-07 guarded
      transition); wrapped best-effort (approval never fails on mail error)

### INT-1 / INT-2 internal alerts

- [x] C-14 `templates/operator-signup-internal.template.ts`: table of signatory name, email,
      phone/WhatsApp, KvK, accepted-at + agreement version; "Review in admin" deep link to
      `${dashboardAppBase()}/tour-operators/{id}/edit`; **no approve action in the email**
- [x] C-15 Recipient resolution helper `salesRecipient()`: `SALES_EMAIL ?? ADMIN_EMAIL ?? null`;
      null → log error and skip (tours.service precedent, never throw)
- [x] C-16 INT-1 fired fire-and-forget on operator-row creation
- [x] C-17 INT-2: extend `notifyReviewSubmitted()` (`tours.service.ts:3396`) — sales-pipeline
      variant to `SALES_EMAIL` when set and different from `ADMIN_EMAIL`; single email when same
- [x] C-18 INT-2 template variant (`tour-review.template.ts` addition or sibling): operator name,
      submitted-at, "Open the submission" link

### First-tour-live event

- [x] C-19 Stamp `firstTourLiveAt` in the tour-publish path with
      `updateMany({ where: { id: operatorId, firstTourLiveAt: null } })` (one-shot)
- [x] C-20 Emit outbox event `operator.first-tour-live` `{ operatorId, tourId }` in the same
      transaction as the publish (WP-D consumes; unknown types are logged+dispatched harmlessly
      today — verified `jobsFor` behaviour)

### List API for the dashboard

- [x] C-21 Operators list response gains: `verificationStatus` (already there), `toursSubmitted`
      (derived count), `firstTourLiveAt`, `verificationDecidedAt`, days-pending derivable from
      `createdAt` — update DTO + swagger
- [x] C-22 List accepts `?verificationStatus=` filter for the queue/pipeline views

### Tests & ship

- [x] C-23 Service spec: PENDING→VERIFIED ok, PENDING→REJECTED ok, VERIFIED→* 409, UNVERIFIED→*
      409, decide race (two parallel decides → one winner), one-shot `firstTourLiveAt`
- [x] C-24 Spec: OB-2A fires exactly once on approve; mail failure does not fail the approval
- [x] C-25 Spec: INT-1/INT-2 recipient resolution matrix (SALES set / unset / equal to ADMIN)
- [x] C-26 e2e: endpoint 403 for non-admin, 409 double-decide, DTO rejects unknown decision;
      PATCH /operators/:id with `verificationStatus` in body → 400 (`forbidNonWhitelisted`)
- [x] C-27 Suite green · reviewer agent pass · docs same-commit · PR merged

## WP-B — Customer funnel — `feat/email-customer-funnel` (after WP-A)

### BK-2 pre-tour reminder

- [x] B-01 `templates/pre-tour-reminder-email.template.html` — locked template from the funnel
      wireframe: hero "You're set for tomorrow, {firstName}", tour card, pickup/be-ready line,
      what-to-bring `[EACH]`, weather block `[IF weatherDependent]`, remaining-balance note
      (`operator_link` only, "Already paid? You're all set" — never a link), operator contact,
      WhatsApp support block
- [x] B-02 Enforce the negative rules in the template: NO payment link, NO cancellation CTA, NO
      balance nudge beyond the note, zero-amount money lines hidden
- [x] B-03 "Today" variant: `[IF isSameDay]` subject/greeting switch (booked-inside-24h bookings
      never get BK-2 — `jobsFor` already skips them; same-day here means the T-24h fire lands on
      the tour date in tour-local time)
- [x] B-04 `buildReminderEmailContext()` in `booking-email.context.ts` reusing `formatDateLong`,
      `formatMoney`, `toLocale`, `emailIconBase`
- [x] B-05 7-locale copy module `pre-tour-reminder-email.copy.ts` (`Record<Locale, …>`, en
      canonical, machine-first translations)
- [x] B-06 `MailService.sendPreTourReminderEmail()` facade
- [x] B-07 Fill `runPreTourReminderJob()` (`bookings.service.ts:1524`): keep existing guards
      (missing / `utcReminderSentAt` set / not CONFIRMED) → `claimAndSend(BK2, bookingId)` →
      stamp `utcReminderSentAt` on success only
- [x] B-08 Render spec `pre-tour-reminder-email.template.spec.ts`: token coverage per payment
      model, orphan-icon check, wireframe diff (funnel wireframe's embedded template)
- [x] B-09 Service spec: job path happy / already-stamped / not-confirmed / claim-lost (P2002)

### BK-3R review reminder

- [x] B-10 Draft BK-3R copy (one reminder, lighter touch than BK-3, star-row CTA kept) — included
      in PR body for founder sign-off (decision D1)
- [x] B-11 Replace the `isReminder` paragraph branch in `sendReviewRequestEmail` with the new copy
- [x] B-12 7-locale copy module for both BK-3 and BK-3R subjects/bodies
- [x] B-13 Route BK-3 first-touch through `claimAndSend(BK3, bookingId)`; BK-3R through
      `claimAndSend(BK3R, bookingId)` — keep `sentAt`/`remindedAt` stamps as the sweeper's cursor
- [x] B-14 `review-requests.service.spec.ts` updated: distinct copy asserted, log rows written,
      remind-on-failure semantics preserved

### BK-1 confirmation reconciliation

- [x] B-15 Template: add operator-note block (`[IF operatorNote]`), what-to-bring `[EACH]`,
      good-to-know `[EACH]`
- [x] B-16 Verify/normalize anti-fraud line placement: inside/directly under "How to pay the
      rest" (C2 mitigation — above the payment fold), all four payment models
- [x] B-17 Related-tours rail: "More {island} experiences", 2 cards (image, name, rating, from
      price) from the tour's destination + "Browse all" link (context builder picks; no live
      availability requirement for BK-1)
- [x] B-18 Today/tomorrow subject variant for bookings created <24h before start (the funnel rule
      "BK-2 skipped → BK-1 carries it")
- [x] B-19 `buildConfirmationEmailContext()` extended for the new blocks; source fields confirmed
      in schema (operator note = tour/operator field; what-to-bring/good-to-know = tour children)
- [x] B-20 Log through `claimAndSend(BK1, bookingId)` while keeping `utcConfirmationEmailSentAt`;
      manual resend path writes `#resend-{n}`
- [x] B-21 Render spec extended: new blocks token-covered, four payment models + `onArrivalPayment`
      sub-variants diffed against the (updated) wireframe fixture
- [x] B-22 7-locale copy module for the changed strings

### CX-1 cancellation

- [x] B-23 `sendCancellationConfirmedNotices()` paragraph sets branch on `paymentModel` (master
      6.4 locked copy): deposit models (deposit back + operator refunds balance part),
      `paid_in_full` ("Your payment is on its way back from us"), `operator_full` (no refund
      line; "Nothing was paid to Island Tours…")
- [x] B-24 Keep the existing `CancellationRefund` FULL/PARTIAL overlay working with the new
      branches (matrix, not replacement)
- [x] B-25 7-locale copy module; operator-facing notice stays English
- [x] B-26 Log traveller send via `claimAndSend(CX1, bookingId)`
- [x] B-27 Spec: paymentModel × refund matrix renders the locked lines

### Ship

- [ ] B-28 Full suite green (incl. adapter-shape e2e specs) · reviewer agent pass · docs
      same-commit · PR merged

## WP-D — Onboarding sequence — `feat/email-onboarding-sequence` (after WP-A + WP-C)

### Templates (English, wireframe copy locked, on `auth-email-shell.ts`)

- [x] D-01 OB-3 `operator-first-tour-howto.template.ts` — walkthrough alternates: Loom thumbnail
      when `WALKTHROUGH_VIDEO_URL` set, guide-link-only otherwise; "Add your first tour" CTA;
      opt-out footer
- [x] D-02 OB-4 `operator-build-with-you.template.ts` — WhatsApp CTA (the only green button),
      email-to-sales alternative, self-serve link; opt-out footer
- [x] D-03 OB-5 `operator-tour-live.template.ts` — "{tourName} is live", see-your-page CTA,
      availability-habit block; transactional (no opt-out footer)
- [x] D-04 OB-6 `operator-check-in.template.ts` — near-plain text, no buttons/images, from
      "Denley from Island Tours", `replyTo: OB6_REPLY_TO`; opt-out footer
- [x] D-05 OB-7 `operator-connect-calendar.template.ts` — connect CTA + manual-is-fine line;
      opt-out footer
- [x] D-06 OB-8 `operator-page-stronger.template.ts` — photo tips + Dronebaas block behind
      decision D6 (`[IF]`-style flag param so it ships either way); opt-out footer
- [x] D-07 INT1R `operator-pending-reminder` (variant of INT-1 template: "still pending after 2
      business days")
- [x] D-08 OB-2 agreement email: extend the acceptance flow — agreement PDF attachment
      (version-pinned file, via WP-A `attachments`) + hosted link; graceful hosted-link-only when
      the PDF asset is absent (decision D4)
- [x] D-09 OB-1: record an `EmailSend` row (OB1, scopeId=operatorId or lowercased email
      pre-operator) from the Better Auth verification hook — no template change
- [x] D-10 All new templates exported from `templates/index.ts`; every lifecycle footer carries
      the WP-A unsubscribe token link ("Prefer no setup emails? Opt out here")

### Wave-1 review carry-overs (bind on this package)

- [x] D-25 Sweeps pre-filter candidates with an anti-join / `NOT EXISTS` on
      `(templateKey, scopeId)` and use `claimAndSend` only to close the residual
      race — a P2002-rejected INSERT still writes a dead tuple, and re-claiming
      every candidate each 15-min tick is permanent autovacuum churn
      (perf review M1; JSDoc on `claimAndSend` states the rule)
- [x] D-26 Suppression evaluator excludes ADMIN shadow operators: an admin
      publishing their own tour gets `firstTourLiveAt` stamped like anyone else
      (`operator.util.ts` auto-provisions the row) — gate every OB nudge on
      `verificationStatus = VERIFIED` so shadow operators never enter the drip
      (security review of #180, LOW-4)
- [x] D-27 Resend endpoint retries once with n+1 when `claimAndSend` reports
      `skipped/already-sent` after `nextResendScopeId` — two concurrent admin
      resends compute the same n (JSDoc on `nextResendScopeId`)
- [x] D-28 `List-Unsubscribe`/`List-Unsubscribe-Post` header values built ONLY
      from server-minted tokens + env URLs — the `SendMailOptions.headers`
      contract forbids user-supplied strings and CR/LF
- [x] D-29 If WP-D adds any FAILED-send monitoring query, add the
      `[status, createdAt]` composite index in the same PR (perf review L2)

### Sweeper (`src/mail/onboarding-emails.service.ts` or `EmailProgrammeModule`)

- [x] D-11 Fill `emailLifecycleSweep()`: query due candidates per anchor —
      `verificationDecidedAt` +48h → OB-3, +7d → OB-4, +14d → OB-6; `firstTourLiveAt` +3d → OB-7,
      +7d → OB-8; PENDING operators older than 2 business days with `salesPendingReminderAt`
      null → INT1R
- [x] D-12 Suppression evaluated AT SEND TIME: tours-submitted count ≥1 kills OB-3/OB-4;
      `isActive=false` (suspension) kills the whole set; LIFECYCLE opt-out kills OB-3/4/6/7/8;
      OB-7 additionally needs `CALENDAR_SYNC_AVAILABLE==='true'` and no connected calendar feed
- [x] D-13 Every suppression writes `recordSuppressed()` with a machine-readable reason
      (`tours-submitted`, `suspended`, `opted-out`, `flag-off`, `calendar-connected`, …)
- [x] D-14 Volume cap: skip an operator whose latest LIFECYCLE `EmailSend` is <3 days old;
      when several nudges are due at once send only the highest priority (OB-6 > OB-7 > OB-8;
      OB-3/4 are mutually exclusive by their zero-tours condition + anchor offsets)
- [x] D-15 Window: whole sweep no-ops unless `isLifecycleWindowOpen()` (INT1R and OB-5 are
      exempt — internal/transactional)
- [x] D-16 All sends through `claimAndSend` (scopeId = operatorId) — the unique index makes
      re-sweeps idempotent; no new guard columns
- [x] D-17 OB-5 wired off the outbox: `operator.first-tour-live` → `PLATFORM_JOBS.ONBOARDING_EMAIL`
      fan-out in `jobsFor()` → processor → send (instant, not sweep-gated)
- [x] D-18 INT1R stamps `salesPendingReminderAt` (fires once); business-day math helper
      (Sat/Sun excluded) with unit spec
- [x] D-19 OB-2A send (WP-C) rerouted through `claimAndSend(OB2A, operatorId)`

### Resend endpoint

- [x] D-20 `POST /operators/:id/emails/:templateKey/resend` — `MANAGE_OPERATORS`, OB set + OB-2A
      only (400 otherwise), writes `#resend-{n}` row, returns the new `EmailSend`
- [x] D-21 e2e: resend happy path, non-OB key 400, non-admin 403

### Tests & ship

- [x] D-22 Sweeper spec: window closed → zero sends; each anchor/offset; each suppression reason
      row; volume-cap priority; opt-out honoured; suspension kills all; INT1R business days
- [x] D-23 Template token-coverage specs (one per template, `findUnresolvedTokens` empty)
- [ ] D-24 Suite green · reviewer agent pass · docs same-commit · PR merged

## WP-G — Consent + MK-1 — `feat/email-mk1-marketing` (LAST; gated on WP-F live in prod)

### Consent record

- [ ] G-01 On booking create where `newsletterOptIn: true` is persisted
      (`bookings.service.ts:683` region): upsert `EmailConsent`
      (`source: 'checkout-newsletter-opt-in'`, bookingId, lowercased contact email)
- [ ] G-02 Backfill migration: `INSERT … SELECT` from historical `newsletterOptIn=true` bookings
      with `ON CONFLICT DO NOTHING` (idempotent, re-runnable)
- [ ] G-03 Spec asserting the upsert fires only on `true` and never blocks booking creation

### MK-1 template & selection

- [ ] G-04 `templates/next-adventure-email.template.html` — locked from the funnel wireframe:
      "Still have days left on the island?", 3 tour cards (image, name, rating, duration, from
      price, open-days line, one-liner, "See times ›"), "See all {n} tours" link,
      free-reschedule line, personal sign-off, unsubscribe footer
- [ ] G-05 Enforce: no discount, no countdown, no scarcity lines anywhere in the template
- [ ] G-06 Card selection service: candidates = published tours in the booking's destination with
      an OPEN departure inside 7 days (live availability at send time), excluding the booked
      tour; pick contrast (different category) / adjacent (same category) / flagship (top
      quality_score); dedupe; <3 qualifying → no send
- [ ] G-07 <3 qualifying → `recordSuppressed(MK1, bookingId, 'insufficient-open-tours')`
- [ ] G-08 7-locale copy module; subject A ships (subject B field kept in the module, unused)
- [ ] G-09 Render spec: token coverage, wireframe diff, forbidden-content assertions (G-05)

### Trigger, gate, suppressions

- [ ] G-10 MK-1 candidates evaluated in the lifecycle sweep: `tour_end + 72h` reached, MARKETING
      stream, Curaçao-morning window
- [ ] G-11 Consent gate: send ONLY when `EmailConsent` exists for the contact email AND no
      MARKETING `EmailOptOut` — empty consent table ⇒ zero sends (asserted in spec, the launch
      switch is the data)
- [ ] G-12 Suppressions at send time, each with its reason row: booked again (another booking,
      same email, created after this one) · booking cancelled/forfeited/operator-cancelled ·
      no-show · 1–2★ review left · opted out · complained (no signal exists today — documented
      skip in code comment)
- [ ] G-13 `claimAndSend(MK1, bookingId)`
- [ ] G-14 Footer: unsubscribe token link + `List-Unsubscribe` + `List-Unsubscribe-Post:
      List-Unsubscribe=One-Click` headers

### Tests & ship

- [ ] G-15 Selection spec: category contrast/adjacent/flagship, 7-day availability edge, <3 drop
- [ ] G-16 Suppression matrix spec (each of the six + consent-missing + opt-out)
- [ ] G-17 Backfill assertion (run twice → same count)
- [ ] G-18 Suite green · reviewer agent pass · docs same-commit · PR merged · verify WP-F
      unsubscribe URL resolves in prod BEFORE enabling the sweep path

---

# DASHBOARD (`tripwheel-x-islandtours-dashboard` — PRs base `main`)

## WP-E — Approval queue, pipeline, email timeline — `feat/operator-onboarding-dashboard`

Needs WP-C endpoints (+ WP-A timeline reads). Permission `MANAGE_OPERATORS` only — **no `rbac.ts`
change, no `lib/cache-tags.ts` change.**

### API layer

- [ ] E-01 `types/email.ts` — `EmailSendRow` mirroring plan §2.2 (templateKey, stream, status,
      toEmail, locale, suppressedReason, error, createdAt)
- [ ] E-02 `lib/api/emails.ts` — `emailsApi.listForOperator(id)`, `listForBooking(id)`,
      `resend(operatorId, templateKey)` over `apiFetch`
- [ ] E-03 `lib/api/operators.ts` — `operatorsApi.decideVerification(id, decision)` →
      `POST /operators/:id/verification`
- [ ] E-04 `hooks/emails/use-operator-emails.ts` (+ booking variant) with `emailKeys` factory
- [ ] E-05 `hooks/operators/use-operators.ts` — `useDecideVerification` mutation invalidating
      `operatorKeys` on success, `sonner` toasts
- [ ] E-06 `types/operator.ts` — add `toursSubmitted`, `firstTourLiveAt`, `verificationDecidedAt`
      from WP-C's list API

### Verification queue

- [ ] E-07 Route `app/(app)/tour-operators/verification/page.tsx` + `loading.tsx` (thin header +
      list view, Spotlight-queue pattern)
- [ ] E-08 Nav entry under `Configure` in `navigations/navigations.ts`
      (`permissions: [Permission.MANAGE_OPERATORS]`)
- [ ] E-09 `components/operators/verification-queue-view.tsx` — `useTableState` +
      `useOperators({ verificationStatus: 'PENDING' })`, `DataTable`
- [ ] E-10 Queue columns: company, signatory, email, phone/WhatsApp, KvK, accepted-at,
      days-pending (highlight ≥2 business days — the INT1R threshold)
- [ ] E-11 Approve dialog (confirm copy: triggers OB-2A "You're approved" email) →
      `useDecideVerification('VERIFIED')`
- [ ] E-12 Reject dialog (consequence copy: operator cannot add tours; no email is sent) →
      `useDecideVerification('REJECTED')`
- [ ] E-13 Row click opens an operator detail sheet (detail-sheet idiom) with the email timeline
      (E-17) inside
- [ ] E-14 Empty state ("No operators waiting for review") via `data-table-empty`

### Edit form & pipeline facets

- [ ] E-15 `operator-details-form.tsx:174-198` — replace the raw `verificationStatus` `<Select>`
      with the read-only `OPERATOR_VERIFICATION` badge + (when PENDING) Approve/Reject buttons
      calling E-05 (**merge after WP-C's DTO strips the field**)
- [ ] E-16 Operators list (`operators-list-view.tsx`): status filter chips (All / Pending /
      Verified / Rejected) + facet chips "0 tours" and "first tour live" from E-06 fields — the
      zero-tour non-responder view for human CRM follow-up

### Email timeline

- [ ] E-17 `components/operators/operator-email-timeline.tsx` on `Section`/`Row` from
      `components/common/detail-sheet.tsx`: template label, status badge, sent-at, suppression
      reason / error line
- [ ] E-18 `EMAIL_SEND` badge map in `components/common/status-maps.ts`
      (SENT/FAILED/SUPPRESSED with hints)
- [ ] E-19 Human labels for `EmailTemplateKey` (e.g. `OB3_FIRST_TOUR_HOWTO` → "First tour,
      step by step") in a `lib/` map — single source for queue + timeline
- [ ] E-20 Per-row Resend action (OB set + OB-2A only) → `emailsApi.resend`, confirm dialog,
      toast, invalidate `emailKeys`
- [ ] E-21 Timeline surfaced in: verification queue row sheet (E-13) AND the operator edit page
- [ ] E-22 Booking email rows (BK/CX keys) appended to the existing Timeline section in
      `components/bookings/booking-details-sheet.tsx` via `listForBooking`

### Verify & ship

- [ ] E-23 RBAC negative check: STAFF login without `MANAGE_OPERATORS` sees no nav entry, no
      queue, no Approve buttons
- [ ] E-24 Type-check + lint clean; NO diffs in `lib/config/rbac.ts` / `lib/cache-tags.ts`
- [ ] E-25 Manual click-through checklist in the PR body (queue approve → OB-2A visible in
      timeline; reject; facets; resend; booking timeline) — this repo has no CI
- [ ] E-26 Reviewer agent pass · PR merged

---

# FRONTEND — public site (`island-tour-development/frontend` — PRs base `prod`)

## WP-F — Unsubscribe page — `feat/unsubscribe-page`

Needs WP-A's two public endpoints. Must be **live in production before WP-G merges.**

### Data layer

- [ ] F-01 `lib/api/public/unsubscribe.ts` — `getUnsubscribeInfo(token)` shaped like
      `review-invitation.ts`: plain `fetch`, `cache: 'no-store'`, **never `'use cache'`** (token
      resolvers must not cache validity), token through `seg()`, null on 404/failure
- [ ] F-02 `confirmUnsubscribe(token)` client-lane POST (the `review-submit.ts` shape: plain
      fetch to `BACKEND_API_BASE`, no cookie, throws on `!res.ok`)

### Route & UI

- [ ] F-03 `app/(frontend)/[locale]/unsubscribe/[token]/page.tsx`: noindex metadata, `isLocale`
      guard → `notFound()`, placeholder `generateStaticParams` (`[{ token: 'sample' }]`),
      `await connection()` + `Suspense` with skeleton
- [ ] F-04 `loading.tsx` matching the Suspense fallback shape
- [ ] F-05 Valid-token view: masked email, stream explanation (lifecycle vs marketing wording),
      confirm button; already-opted-out state renders "You're already unsubscribed"
- [ ] F-06 Invalid/unknown token → one shared "link no longer valid" state (no oracle)
- [ ] F-07 Client confirm component: POST → success state ("You won't get these emails
      anymore" + "your booking emails always arrive" line); error → retry affordance
- [ ] F-08 Design: `it-*` tokens, `it-section`/`it-container`, px values, no inline styles;
      minimal `LegalPageShell`-adjacent layout

### Locale & routing

- [ ] F-09 `proxy.ts`: rewrite rule #3 `^\/unsubscribe\/[^/]+$` → URL-preserving rewrite to
      `DEFAULT_LOCALE` (emails link bare `/unsubscribe/{token}`; a 302 breaks one-click scanners)
- [ ] F-10 New top-level `unsubscribe` key in ALL 7 `lib/i18n/dictionaries/*.json` (en canonical,
      machine-first for the other six)
- [ ] F-11 **Bump `DICTIONARY_VERSION`** in `lib/i18n/dictionaries.ts`
- [ ] F-12 Typed dict slice passed to the client component (`SavedEmailDict` pattern)

### Tests & ship

- [ ] F-13 Vitest: loader null-on-404 / shape-on-200; confirm component success + error states
- [ ] F-14 Playwright e2e: happy path (resolve → confirm → success), invalid token state,
      bare-URL rewrite lands on the page (not a redirect)
- [ ] F-15 `pnpm test` + `pnpm test:e2e` green · reviewer agents (frontend-code-reviewer +
      frontend-security-reviewer in parallel, verify findings against source) · docs same-commit
      · PR merged

---

## Founder decisions (plan §5)

- [ ] D1 BK-3R copy approved (draft ships in WP-B's PR)
- [ ] D2 `SALES_EMAIL` mailbox chosen (falls back to `ADMIN_EMAIL` until set)
- [ ] D3 `OB6_REPLY_TO` address supplied
- [ ] D4 Operator agreement v1.0 PDF supplied (else OB-2 ships hosted-link-only)
- [ ] D5 Locale policy confirmed (7-locale traveller emails, English operator emails)
- [ ] D6 Dronebaas block in OB-8 cleared by counsel (else OB-8 ships without it)
