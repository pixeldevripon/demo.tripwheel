# Email programme — implementation plan (work packages for independent agents)

> Companion to [`island-tours-email-programme-status.md`](./island-tours-email-programme-status.md)
> (the audit) and the two wireframes. This document breaks the build into **seven work packages
> (WP-A … WP-G)** that can each be built by a separate agent on its own branch/PR. Every package
> states: repo, what to build, exactly where, how (grounded in code as of 2026-08-11), tests, and
> what it must NOT touch. §2 pins the shared contracts so parallel agents cannot diverge.
>
> Rules that bind every package: own branch off `pixelvega/prod` (backend/frontend repo) or
> `pixelvega/main` (dashboard repo) → small PR → reviewer agent + tests before merge. Update
> `MASTER-CHECKLIST.md` and the checklist in §6 here in the same commit as the work. No
> `Co-Authored-By` trailers.

---

## 1. Ground truth (verified against code, 2026-08-11)

What exists and what the packages plug into — a corrected summary of the audit:

- **Transport:** Resend only (`backend/src/mail/mail.service.ts`, `sendMail()` is the single
  egress point, `SendMailOptions = { to, subject, html, text? }`). No Postmark, no reply-to, no
  `List-Unsubscribe` header support, no attachments — WP-A widens this.
- **Two template systems:** (a) design-locked `.html` files + mini-language renderer
  (`src/mail/templates/email-template.renderer.ts`: `{token}`, `[IF]…[ELSE]…[/IF]`, `[EACH]`) used
  by BK-1, the operator notice and the shared `booking-notice.template.html` shell; (b) TS template
  functions returning `{ html, text }` (`src/mail/templates/*.template.ts`, barrel `index.ts`).
  Precedent (JSDoc at `mail.service.ts:500`): reuse the notice shell rather than adding HTML files
  for simple emails; locked HTML only for design-heavy ones.
- **Render-spec pattern:** `booking-confirmation-email.template.spec.ts` reads the wireframe from
  `technical-doc/emails/` and asserts token coverage — every new locked template gets the same.
- **BK-2 stub:** `bookings.service.ts:1524` `runPreTourReminderJob()` — guard column
  `bookings.utcReminderSentAt`, delayed BullMQ job enqueued by
  `src/workers/outbox-relay.service.ts` `jobsFor('booking.confirmed')` at T-24h. Body logs and
  never stamps. Only the template + send are missing.
- **BK-3/BK-3R:** `src/reviews/review-requests.service.ts` — hourly sweeper, master switch
  (`ReviewRequestSettings.enabled`, default **false**), suppression-with-reason, 5-day reminder that
  currently reuses the BK-3 copy via `isReminder`. Send window computed in the booking's snapshotted
  `tourTimeZone` via `localNow()` (`@/common/utils/timezone.util`) — **reuse this for all windows.**
- **CX-1:** `bookings.service.ts:2505` `sendCancellationConfirmedNotices()` through the generic
  notice shell; refund copy branches on `CancellationRefund` but not on `paymentModel`.
- **Queue plumbing:** one queue `platform-jobs`; named jobs in `PLATFORM_JOBS`, schedules in
  `PLATFORM_SCHEDULES` (`src/workers/platform-queue.ts`), fan-out in `OutboxRelayService.jobsFor()`,
  dispatch in `platform-jobs.processor.ts`, registration+pruning automatic in
  `nightly-jobs.service.ts`. `PlatformJobData` is `{ bookingId }` only — WP-A widens it.
- **Operator state:** enum `OperatorVerificationStatus { UNVERIFIED PENDING VERIFIED REJECTED }`
  exists (`prisma/enums.prisma:776`, field on `operators.prisma:5`) but nothing sets it deliberately
  — it is blanket-writable through `PATCH /operators/:id` (`operators.service.ts:401` `data: dto`).
  No `approvedAt`, no `firstTourLiveAt`, no tours-submitted counter, no approval endpoint, no email
  on transition. The operator invite email fires from the Better Auth `sendResetPassword` hook
  (`src/auth/auth.instance.ts:75`, the `if (!request)` branch).
- **Admin alerting:** in-app inbox (`src/inbox/`, fire-and-forget `notify()`) + `ADMIN_EMAIL` env
  emails (e.g. tour-submitted, `tours.service.ts:3396`). **No `sales@` exists anywhere.**
- **Consent:** `bookings.newsletterOptIn` is written once (`bookings.service.ts:683`) and read by
  nothing. `reviewWhatsappOptIn` is deliberately separate (WhatsApp reminder consent only). No
  unsubscribe surface in any repo, no send log, no suppression list, no bounce handling.
- **Email copy i18n does not exist.** Formatting is localised (`src/bookings/booking-email.context.ts`
  — `INTL_LOCALE`, `formatMoney`, `formatDeadline`…), copy is hardcoded English at ~15 call sites.
- **Dashboard:** no approval workflow (read-only badge + a raw `<Select>` on the edit form). The
  pattern to copy for a queue is `components/spotlight/*` (gated `can('APPROVE_SPOTLIGHT')`). No
  timeline component — build on `Section`/`Row` from `components/common/detail-sheet.tsx`.
- **Public site:** no unsubscribe page. The model for a tokenized page is
  `app/(frontend)/[locale]/review/[token]/page.tsx`. Locale-free email links need a rewrite rule in
  `proxy.ts` (as `thank-you` and `cancel` already have). New dictionary keys go in all 7
  `lib/i18n/dictionaries/*.json` **and require a `DICTIONARY_VERSION` bump** in
  `lib/i18n/dictionaries.ts`.

---

## 2. Shared contracts — pinned up front, no package may deviate

Agents build in parallel against these. If a contract must change, change it HERE first (own PR),
then in the consumers.

### 2.1 Template keys (enum `EmailTemplateKey`, in `prisma/enums.prisma`)

```prisma
enum EmailTemplateKey {
  BK1_CONFIRMATION          BK2_PRE_TOUR_REMINDER     BK3_REVIEW_REQUEST
  BK3R_REVIEW_REMINDER      MK1_NEXT_ADVENTURE        CX1_CANCELLATION
  OB1_VERIFY_EMAIL          OB2_WELCOME_AGREEMENT     OB2A_APPROVED
  OB3_FIRST_TOUR_HOWTO      OB4_BUILD_IT_WITH_YOU     OB5_TOUR_LIVE
  OB6_CHECK_IN              OB7_CONNECT_CALENDAR      OB8_PAGE_STRONGER
  INT1_NEW_OPERATOR         INT1R_PENDING_REMINDER    INT2_NEW_TOUR
}
```

### 2.2 Send log (new file `prisma/emails.prisma`; enums in `enums.prisma`)

```prisma
enum EmailStream { TRANSACTIONAL LIFECYCLE MARKETING INTERNAL }
enum EmailSendStatus { SENT FAILED SUPPRESSED }

model EmailSend {
  id          String           @id @default(uuid())
  templateKey EmailTemplateKey
  // dedupe scope: booking id, operator id, or lowercased email — one send per (template, scope)
  scopeId     String
  toEmail     String
  stream      EmailStream
  status      EmailSendStatus
  locale      String? // BCP-47-ish platform locale the copy rendered in
  providerMessageId String?
  suppressedReason  String? // set when status = SUPPRESSED
  error       String? // set when status = FAILED
  createdAt   DateTime @default(now())

  @@unique([templateKey, scopeId])          // ← the send-once idempotency both wireframes demand
  @@index([toEmail, createdAt])
  @@index([scopeId, createdAt])
  @@map("email_sends")
}
```

Send-once semantics: **claim the row first** (`create` with `status: SENT` intent inside a
try/catch mapping P2002 → "already sent, skip"), then send; on transport failure update the row to
`FAILED` (a FAILED row still occupies the unique slot — retries go through explicit admin resend,
which deletes/supersedes the row). SUPPRESSED rows record *why* an email deliberately did not go
out, mirroring `ReviewInvitation.suppressedReason`. Re-sendable templates (BK-1 resend already
exists) keep their current paths; the log's unique index applies to the automated first send —
admin resend writes a new row with `scopeId` suffixed `#resend-{n}`.

### 2.3 Opt-outs and consent (same `prisma/emails.prisma`)

```prisma
enum EmailAudience { TRAVELLER OPERATOR }

model EmailOptOut {
  id        String        @id @default(uuid())
  email     String        // lowercased
  audience  EmailAudience
  stream    EmailStream   // LIFECYCLE (operator nudges) or MARKETING (traveller MK-1)
  source    String        // 'unsubscribe-link' | 'dashboard' | 'admin'
  createdAt DateTime      @default(now())
  @@unique([email, audience, stream])
  @@map("email_opt_outs")
}

model EmailConsent {  // explicit marketing opt-in with provenance (WP-G reads, WP-A creates table)
  id        String   @id @default(uuid())
  email     String   // lowercased
  source    String   // 'checkout-newsletter-opt-in'
  bookingId String?
  createdAt DateTime @default(now())
  @@unique([email])
  @@map("email_consents")
}

model EmailUnsubscribeToken {
  token     String        @id @default(uuid())
  email     String
  audience  EmailAudience
  stream    EmailStream
  createdAt DateTime      @default(now())
  @@index([email])
  @@map("email_unsubscribe_tokens")
}
```

Semantics: suspension of an operator stops **everything**; opt-out stops **only** the stream it
names (LIFECYCLE for OB-3/4/6/7/8; MARKETING for MK-1). Transactional and internal streams never
check opt-outs. Tokens are long-lived and reusable (an unsubscribe link in an old email must keep
working); acting on one is idempotent.

### 2.4 Operator onboarding state (added to `prisma/operators.prisma`)

The wireframe's `created → accepted → approved` maps onto the EXISTING enum — no new state enum:
`created` = user exists, email unverified (Better Auth) · `accepted` = `PENDING` (operator row
created, agreement accepted) · `approved` = `VERIFIED` · declined = `REJECTED`.

New columns on `Operator`:

```prisma
verificationDecidedAt  DateTime?   // stamped by approve/reject — the OB-3/4/6 anchor
firstTourLiveAt        DateTime?   // stamped once by the first tour publish — the OB-7/8 anchor
salesPendingReminderAt DateTime?   // INT1R guard: set when the 2-business-day reminder fires
```

`tours_submitted` is **derived** (count of the operator's tours ever submitted for review), not a
column — computed in the suppression evaluator at send time (the wireframe requires send-time
evaluation anyway).

### 2.5 Backend API endpoints

| Endpoint | Package | Contract |
| --- | --- | --- |
| `POST /api/v1/operators/:id/verification` body `{ decision: 'VERIFIED' \| 'REJECTED' }` | WP-C | The ONLY sanctioned writer of `verificationStatus` from now on; stamps `verificationDecidedAt`, fires OB-2A on approve, audit-logs actor. Guarded `MANAGE_OPERATORS`. WP-C also strips `verificationStatus` from `UpdateOperatorDto` (closing the blanket write). |
| `GET /api/v1/email/unsubscribe/:token` | WP-A | `@Public()`. Returns `{ email(masked), audience, stream, optedOut }`. 404 for unknown token (same-shape, like review tokens). |
| `POST /api/v1/email/unsubscribe/:token` | WP-A | `@Public()`. Idempotent; writes `EmailOptOut`. |
| `GET /api/v1/operators/:id/emails` · `GET /api/v1/bookings/:id/emails` | WP-A | `EmailSend` rows for the timeline, newest first. Guarded (`MANAGE_OPERATORS` / booking-scope). |
| `POST /api/v1/operators/:id/emails/:templateKey/resend` | WP-D | Admin resend for OB set. Guarded `MANAGE_OPERATORS`. |

### 2.6 Queue names (added to `src/workers/platform-queue.ts`)

- `PLATFORM_JOBS.ONBOARDING_EMAIL` — payload `{ operatorId, templateKey }` (WP-A widens
  `PlatformJobData` to a union; processor destructures per name).
- `PLATFORM_SCHEDULES.EMAIL_LIFECYCLE_SWEEP = { name: 'email.lifecycle-sweep', every: 900_000 }`
  (15 min) — evaluates due onboarding nudges + INT1R + MK-1 candidates against window/suppression
  and sends. One sweeper for all scheduled email (BK-3 keeps its existing sweeper untouched).

### 2.7 Env vars (documented in `env.validate.ts` in WP-A; all optional with safe fallback)

- `SALES_EMAIL` — INT-1/INT1R/INT-2 recipient; falls back to `ADMIN_EMAIL`; if neither, log-and-skip
  (the tour-submitted precedent, `tours.service.ts:3407`).
- `MAIL_REPLY_TO` — default reply-to (monitored inbox; wireframe forbids noreply@ replies).
- `OB6_REPLY_TO` — the founder's monitored inbox for OB-6 (falls back to `MAIL_REPLY_TO`).
- `CALENDAR_SYNC_AVAILABLE` — `'true'` enables OB-7 (feature flag from the wireframe).
- `WALKTHROUGH_VIDEO_URL` — optional Loom URL for OB-3 (absent → guide-link-only variant).

### 2.8 Send windows (WP-A utility, used by every scheduled sender)

`src/mail/send-window.util.ts`: `isLifecycleWindowOpen(now)` — Tue–Thu 09:00–11:00
**America/Curacao** (operator emails, MK-1); `nextLifecycleWindow(now)`. Built on the existing
`localNow()` from `@/common/utils/timezone.util` — do not hand-roll timezone math. BK-3's
"around 10:00 tour-local" stays where it is (`review-requests.service.ts`), untouched.
Volume cap (wireframe): max ONE lifecycle email per operator per 3 days, priority OB-6 > OB-7 >
OB-8 — enforced in the sweeper by checking the operator's latest LIFECYCLE `EmailSend`.

### 2.9 Email copy + locales

- **Traveller-facing emails (BK-*, MK-1, CX-1): 7-locale copy.** Pattern: a per-template
  `*.copy.ts` module exporting `Record<Locale, {subject, preview, …strings}>` beside the template
  (the platform's `Locale` enum; `toLocale(booking.customerLocale)` resolves, `en` fallback).
  Machine-first translations, English is canonical. No new i18n framework.
- **Operator + internal emails (OB-*, INT-*): English only** (dashboard is English; wireframe copy
  is English). Structure the copy as constants anyway so locales can be added later.
- Wireframe copy is **locked** where it exists (see §4 per-email status). BK-3R copy does not exist
  yet — WP-B drafts it for founder review in the PR description.
- Design constants (onboarding wireframe): 600px single column on `#EDEFF2`, one button per email
  (brand `#E8611A`; WhatsApp green only in OB-4), no emoji, alt text on every image, < 125 KB.

---

## 3. Dependency graph and parallelisation

```text
WP-A  send spine (backend)  ──────────────┬──▶ WP-B  customer funnel (backend)
                                          ├──▶ WP-D  onboarding sequence (backend)   ◀── WP-C
WP-C  operator state machine (backend) ───┤
                                          ├──▶ WP-E  dashboard (approval UI + timeline)  ◀── WP-C
                                          ├──▶ WP-F  unsubscribe page (frontend)
                                          └──▶ WP-G  consent + MK-1 (backend)        ◀── WP-F live
```

- **Wave 1 (parallel):** WP-A and WP-C — they touch disjoint files (WP-A: mail/, workers/, new
  prisma file; WP-C: operators/, tours/ publish hook, auth hook) and different migrations.
- **Wave 2 (parallel, after WP-A merges; WP-D/E also need WP-C):** WP-B, WP-D, WP-E, WP-F.
- **Wave 3:** WP-G (needs WP-A's consent table and WP-F's live unsubscribe page — a marketing email
  may not ship before its unsubscribe link works).

Each package = one branch = one PR. Backend/frontend repo PRs base `prod`; dashboard PRs base
`main`. Migrations: WP-A and WP-C each add exactly one migration; they must not touch the same
tables (WP-A: new tables only; WP-C: `operators` columns only) so merge order between them is free.

---

## 4. The work packages

### WP-A — Send spine (backend) — branch `feat/email-send-spine`

The foundation: send log, opt-outs, unsubscribe API, mail-service widening, window utility, queue
plumbing. **No behaviour change to any existing email** — this PR only adds capability.

Build:

1. **Schema** — new `prisma/emails.prisma` with §2.2/§2.3 models; enums into `prisma/enums.prisma`
   (§2.1 + `EmailStream`, `EmailSendStatus`, `EmailAudience`). One migration
   (`email_programme_spine`). Demo seed parity: small seeder in `prisma/demo/` (a few EmailSend
   rows for dashboard dev).
2. **`EmailLogService`** (`src/mail/email-log.service.ts`, provided by the global `MailModule`) —
   `claimAndSend({templateKey, scopeId, toEmail, stream, locale, send: () => Promise<…>})`
   implementing §2.2 claim-first semantics; `recordSuppressed(…reason)`; `listForScope(scopeId)`.
   Opt-out check helper: `isOptedOut(email, audience, stream)`.
3. **`MailService` widening** — `SendMailOptions` gains `replyTo?`, `headers?`
   (`List-Unsubscribe`, `List-Unsubscribe-Post`), `attachments?` (Resend supports all three).
   Default `replyTo` from `MAIL_REPLY_TO`. Nothing else in the service changes.
4. **Unsubscribe API** — `src/mail/email-preferences.controller.ts` (`@Public()`, throttled) per
   §2.5, + token issue helper `issueUnsubscribeToken(email, audience, stream)` used by senders to
   build links (`${islandToursBase()}/unsubscribe/${token}` — locale-free, see WP-F).
5. **Timeline reads** — the two `GET …/emails` endpoints (§2.5) with DTOs + swagger per module
   conventions.
6. **Queue plumbing** — widen `PlatformJobData` to a discriminated union; add
   `PLATFORM_JOBS.ONBOARDING_EMAIL` + `PLATFORM_SCHEDULES.EMAIL_LIFECYCLE_SWEEP` with a no-op
   sweep handler in `NightlyJobsService` (WP-D fills it; keeping the scheduler here means WP-D
   ships no scheduler-registration change).
7. **`send-window.util.ts`** per §2.8, with unit tests across DST-irrelevant Curaçao (fixed UTC-4).
8. **Env** — add §2.7 vars to `env.validate.ts` (validated-optional, like `MAIL_FROM`); also add
   the missing `ADMIN_EMAIL` entry while in the file (currently load-bearing but unvalidated).

Tests: `email-log.service.spec.ts` (P2002 race → exactly-one-send, using real adapter-shaped error
metas — see `prisma-adapter-error-shapes` precedent in `bookings.service.spec.ts`), window util
spec, controller e2e (`test/email-preferences.e2e-spec.ts`: token resolve/act/idempotent/404).
Does NOT touch: any existing template, `bookings.service.ts`, `review-requests.service.ts`.

### WP-B — Customer funnel (backend) — branch `feat/email-customer-funnel`

Brings the four transactional traveller emails up to the funnel wireframe. Depends on WP-A.

1. **BK-2 pre-tour reminder** — new locked template
   `src/mail/templates/pre-tour-reminder-email.template.html` built from the funnel wireframe
   (sibling of the confirmation template; the wireframe embeds the full design: logistics, what to
   bring, weather block `[IF weatherDependent]`, remaining-balance note for `operator_link`, NO
   payment link / cancellation CTA / balance nudge, "today" variant for same-day). Context builder
   `buildReminderEmailContext()` added to `src/bookings/booking-email.context.ts` (reuse
   formatters). Fill `runPreTourReminderJob()` (`bookings.service.ts:1524`): keep the existing
   guards, route the send through `EmailLogService.claimAndSend` (scopeId = bookingId), stamp
   `utcReminderSentAt` on success. Suppression at send time: status must be CONFIRMED (already
   checked) — cancelled/forfeited/operator-cancelled all leave CONFIRMED so the existing check
   covers the wireframe's list. Render spec reading the wireframe from `technical-doc/emails/`
   (add the standalone BK-2 wireframe file there if the designer supplies one; until then the spec
   reads the funnel wireframe's embedded template).
   *Catch-up note:* bookings whose T-24h job already fired as a logged no-op stay unsent (the doc'd
   behaviour); bookings inside 24h get none (existing `jobsFor` rule) — BK-1 switches subject to
   today/tomorrow instead (already the wireframe rule, implemented in the BK-1 reconciliation).
2. **BK-3R own copy** — in `MailService.sendReviewRequestEmail`, replace the `isReminder` paragraph
   branch with distinct copy (drafted for founder review; wireframe: one reminder only, mention
   WhatsApp where `reviewWhatsappOptIn` — the WhatsApp send itself stays unbuilt/flagged). Route
   both BK-3 and BK-3R sends through the send log (scopeId = bookingId; BK3 and BK3R are separate
   template keys so the unique index allows one of each). 7-locale copy module.
3. **BK-1 reconciliation** — update `booking-confirmation-email.template.html` +
   `buildConfirmationEmailContext()` to close the wireframe gaps: operator note block, what-to-bring
   list, good-to-know, the anti-fraud line placement (C2: above the fold of the payment area),
   related-tours rail ("More Curaçao experiences", 2 cards, from the tour's destination), today/
   tomorrow subject for <24h bookings. All four `paymentModel` branches + `onArrivalPayment`
   sub-variants per the wireframe. The render spec already diffs against the wireframe — extend it
   for the new blocks. Log through `EmailLogService` (scopeId = bookingId) while keeping
   `utcConfirmationEmailSentAt` as the legacy guard.
4. **CX-1 payment-model-aware** — extend `sendCancellationConfirmedNotices()`
   (`bookings.service.ts:2505`): branch paragraphs on `paymentModel` per master 6.4 locked copy
   (`paid_in_full` → "on its way back from us"; `operator_full` → no refund line, operator refunds
   directly; deposit models → deposit-back + operator-balance split). 7-locale copy module. Log the
   traveller send (CX1, scopeId = bookingId).

Tests: render specs per template; `bookings.service.spec.ts` additions (BK-2 job send path, CX-1
branching); review-requests spec update for BK-3R copy + logging. Does NOT touch: workers/ (the
BK-2 job plumbing already exists), operators, dashboard.

### WP-C — Operator state machine + internal alerts (backend) — branch `feat/operator-onboarding-state`

Independent of WP-A (do not wait for it): uses the existing mail patterns for INT-1/INT-2 and
leaves send-log integration of these two internal emails to WP-D.

1. **Schema** — §2.4 columns on `Operator`; one migration (`operator_onboarding_state`).
2. **Verification endpoint** — §2.5 `POST /operators/:id/verification` in
   `src/operators/` (controller/service/dto/swagger per module conventions): validates transition
   (only PENDING→VERIFIED/REJECTED, VERIFIED is terminal unless admin re-pends), stamps
   `verificationDecidedAt`, logs actor. **Remove `verificationStatus` from `UpdateOperatorDto`**
   (the blanket write at `operators.service.ts:401` currently lets any PATCH flip it silently) —
   coordinate the dashboard's edit-form Select removal in WP-E.
3. **PENDING on acceptance** — where the operator row is created (invite/acceptance flow), set
   `verificationStatus: PENDING` explicitly (today it defaults UNVERIFIED and nothing moves it).
4. **INT-1 (new operator → sales)** — fire on operator-row creation: TS template
   (`operator-signup-internal.template.ts`, table of signatory/email/phone/KvK/accepted-at per the
   wireframe, "Review in admin" deep link `${dashboardAppBase()}/tour-operators/{id}/edit`; NEVER an
   approve action in the email — link scanners click). Recipient `SALES_EMAIL ?? ADMIN_EMAIL`,
   log-and-skip if neither (tours.service precedent).
5. **INT-2 (new tour → sales)** — extend `notifyReviewSubmitted()` (`tours.service.ts:3396`) to also
   send the sales-pipeline variant to `SALES_EMAIL` when it differs from `ADMIN_EMAIL` (one email if
   they're the same address).
6. **`firstTourLiveAt`** — stamp in the tour-publish path (the same service region that emits
   `TOUR_PUBLISHED` inbox events) with `updateMany({ where: { id, firstTourLiveAt: null } })`
   one-shot semantics; emit outbox event `operator.first-tour-live` (WP-D consumes; unknown outbox
   types are logged+dispatched harmlessly until then — verified behaviour of `jobsFor`).
7. **OB-2A "You're approved"** — sent by the verification endpoint on approve (TS template per
   wireframe: add-first-tour CTA + dashboard intro). Until WP-A merges, guard with the existing
   one-shot pattern (`verificationDecidedAt` transition happens once); WP-D routes it through the
   send log.

Tests: operators service spec (transitions, one-shot stamps), e2e for the endpoint (403 non-admin,
409 double-decide), tours spec for INT-2 + `firstTourLiveAt`. Does NOT touch: mail transport,
workers/, review flow.

### WP-D — Onboarding email sequence (backend) — branch `feat/email-onboarding-sequence`

Depends on WP-A + WP-C. The nine-email drip and its sweeper.

1. **Templates** (TS functions on `auth-email-shell.ts`, English, wireframe copy locked):
   OB-3 (+48h, walkthrough alternates: Loom thumb if `WALKTHROUGH_VIDEO_URL` else guide link),
   OB-4 (+7d, WhatsApp rescue — the one green button), OB-5 (first-tour-live, instant), OB-6
   (+14d, near-plain text, from the founder, `OB6_REPLY_TO`), OB-7 (live+3d, `CALENDAR_SYNC_AVAILABLE`
   gated, suppressed when a calendar feed is already connected), OB-8 (live+7d, page-strength +
   Dronebaas block), INT1R (2-business-day pending reminder). OB-1 = Better Auth verification email
   as-is (only: record an `EmailSend` row via the auth hook, template key OB1). OB-2 welcome +
   agreement: extend the invite/acceptance flow; agreement PDF attached via WP-A's `attachments`
   (version-pinned file + hosted link).
2. **The sweeper** — fill WP-A's `email.lifecycle-sweep` handler in `NightlyJobsService`, new
   `src/mail/onboarding-emails.service.ts` (or `src/operators/`— keep module imports acyclic;
   `WorkersModule` already imports the world, so put the service in `MailModule`'s reach or a new
   `EmailProgrammeModule`). Each tick: find operators due each nudge (anchors:
   `verificationDecidedAt` for OB-3/4/6; `firstTourLiveAt` for OB-7/8; INT1R for PENDING older than
   2 business days with `salesPendingReminderAt` null), evaluate suppression AT SEND TIME
   (tours-submitted count ≥1 kills OB-3/4; suspension (`isActive=false`) kills all; opt-out kills
   the lifecycle set; volume cap 1-per-3-days with priority OB-6 > OB-7 > OB-8), check
   `isLifecycleWindowOpen()`, send through `EmailLogService.claimAndSend` (scopeId = operatorId).
   The send log's unique index makes the sweep naturally idempotent — no per-email guard columns.
   Sequence formally ends at day 14 (OB-6); non-responders are visible via the dashboard pipeline
   (WP-E), CRM handoff stays manual.
3. **Resend endpoint** (§2.5) for the OB set + OB-2A, writing `#resend-{n}` rows.
4. **Lifecycle unsubscribe links** — every OB lifecycle email footer carries the WP-A token link
   ("Prefer no setup emails? Opt out here"); `List-Unsubscribe` headers on the lifecycle set.

Tests: sweeper service spec (window closed → nothing; due+suppressed → SUPPRESSED row with reason;
volume-cap priority; opt-out honoured; INT1R business-day math), template specs (token coverage),
e2e resend. Does NOT touch: booking emails, review flow, dashboard.

### WP-E — Dashboard: approval queue, pipeline, email timeline — branch `feat/operator-onboarding-dashboard` (dashboard repo, base `main`)

Depends on WP-C endpoints (+ WP-A timeline reads). All calls via `apiFetch`; permissions:
`MANAGE_OPERATORS` only (no new Permission keys → no rbac.ts/backend sync risk).

1. **Approval queue** — copy the Spotlight pattern (`components/spotlight/spotlight-queue-view.tsx`
   et al.) into `components/operators/verification-queue-*` + route
   `app/(app)/tour-operators/verification/page.tsx` (register under `Configure` in
   `navigations/navigations.ts`, permission `MANAGE_OPERATORS`): PENDING operators table (signatory,
   email, KvK, accepted-at, days-pending), one-click Approve / Reject dialogs →
   `POST /operators/:id/verification`, toast + query invalidation (`operatorKeys`).
2. **Edit-form cleanup** — replace the raw `verificationStatus` `<Select>` in
   `operator-details-form.tsx:174-198` with the read-only badge + (for PENDING) Approve/Reject
   buttons calling the same endpoint. Coordinate merge with WP-C (the DTO stops accepting the
   field; merging WP-E after WP-C avoids a broken window).
3. **Onboarding pipeline view** — a status strip/tab on the operators list (`operators-list-view.tsx`
   filter by verificationStatus + "0 tours" + "first tour live" facets from list API fields WP-C
   exposes) — the wireframe's "zero-tour non-responders flow to human follow-up" surface.
4. **Email timeline** — new `components/operators/operator-email-timeline.tsx` on the
   `Section`/`Row` idiom (`components/common/detail-sheet.tsx`), fed by
   `GET /operators/:id/emails` (new `lib/api/emails.ts` + `hooks/emails/use-operator-emails.ts` +
   `types/email.ts` mirroring §2.2 fields). Shows templateKey label, status (new `EMAIL_SEND` badge
   map in `components/common/status-maps.ts`), sent-at, suppression reason; per-row Resend action
   (OB set only) hitting the WP-D endpoint. Surface it in a detail sheet opened from the queue row
   and from the edit page.
5. Booking email timeline (BK/CX rows via `GET /bookings/:id/emails`) added to
   `components/bookings/booking-details-sheet.tsx`'s existing Timeline section — same components.

Tests: this repo has no CI — manual click-through checklist in the PR body (queue approve/reject,
timeline render, resend, RBAC hide for non-admin), plus type-check. Does NOT touch: rbac.ts,
lib/cache-tags.ts.

### WP-F — Public site: unsubscribe page (frontend) — branch `feat/unsubscribe-page`

Depends on WP-A's two public endpoints. Model: `app/(frontend)/[locale]/review/[token]/page.tsx`.

1. **Route** `app/(frontend)/[locale]/unsubscribe/[token]/page.tsx` + `loading.tsx`: noindex
   metadata, `isLocale` guard, placeholder `generateStaticParams`, `await connection()` +
   `Suspense`, token resolved server-side with a **non-cached** loader
   (`lib/api/public/unsubscribe.ts` shaped exactly like `review-invitation.ts` — never `'use cache'`
   a token resolver), one shared invalid state. Confirm button = client component POSTing the
   token via plain fetch to `BACKEND_API_BASE` (the `review-submit.ts` lane — no cookie, token in
   path through `seg()`), success + already-opted-out states.
2. **Locale-free links** — add rewrite rule #3 in `proxy.ts` for `^\/unsubscribe\/[^/]+$` →
   `DEFAULT_LOCALE` (emails link `/unsubscribe/{token}` bare; a 302 breaks one-click-unsubscribe
   scanners).
3. **Copy** — new top-level `unsubscribe` key in all 7 `lib/i18n/dictionaries/*.json` (+ typed
   slice passed to the client component, `SavedEmailDict` pattern) **and bump `DICTIONARY_VERSION`**
   in `lib/i18n/dictionaries.ts`.
4. Design: `it-*` tokens, `LegalPageShell`-adjacent minimal layout, skeleton matching `loading.tsx`.

Tests: Vitest for the loader (404/ok shapes) and the client confirm component; Playwright e2e happy
path + invalid token (the repo's `e2e/` conventions). Does NOT touch: checkout, traveller area,
proxy locale matcher list.

### WP-G — Consent record + MK-1 (backend) — branch `feat/email-mk1-marketing`

Last: may not merge before WP-F is live in production. Depends on WP-A (+ WP-B's rail conventions).

1. **Consent capture** — in `BookingsService.reserve`/confirm path where `newsletterOptIn` is
   persisted (`bookings.service.ts:683`): on `true`, upsert `EmailConsent` (source
   `'checkout-newsletter-opt-in'`, bookingId). Backfill migration for historical
   `newsletterOptIn=true` bookings (idempotent INSERT … SELECT with ON CONFLICT DO NOTHING).
2. **MK-1 template** — locked HTML per the funnel wireframe (availability email, NOT
   recommendations: 3 cards contrast/adjacent/flagship from the booking's destination, availability
   pulled AT SEND TIME, tour without an open departure in 7 days is dropped; < 3 qualifying tours →
   skip the send entirely (SUPPRESSED row, reason `insufficient-open-tours`); free-reschedule line;
   no discount, no countdown, no scarcity). Subject A/B fields exist in copy module; v1 sends A
   (A/B testing out of scope). 7-locale copy module.
3. **Trigger** — tour_end +72h evaluated by the WP-A/WP-D lifecycle sweep (MARKETING stream,
   Curaçao-morning window). Gate: `EmailConsent` row exists for the contact email AND no
   MARKETING opt-out. Six suppressions from the wireframe evaluated at send time: booked again ·
   cancelled · no-show · complained (no signal exists today → skip, documented) · 1–2★ review left ·
   opted out. scopeId = bookingId.
4. **Unsubscribe wiring** — MK-1 footer carries the WP-A token link + `List-Unsubscribe` +
   `List-Unsubscribe-Post` headers (one-click compliant).

Tests: selection-logic spec (card picking, drop-when-<3), suppression matrix spec, consent backfill
migration assertion, render spec. An empty consent table = zero sends (safe default, no launch
switch needed) — assert that in the spec.

---

## 5. Decisions needed from the founder (none block Wave 1)

1. **BK-3R copy** — does not exist; WP-B ships a draft in the PR for sign-off before merge.
2. **`SALES_EMAIL` value** — which mailbox; falls back to `ADMIN_EMAIL` until set.
3. **OB-6 reply-to** — the founder's monitored inbox address (`OB6_REPLY_TO`).
4. **Operator agreement PDF** — WP-D needs the version-pinned v1.0 file (or ships hosted-link-only
   and adds the attachment when supplied).
5. **Traveller-email locales** — plan assumes 7-locale machine-first copy for BK-*/CX-1/MK-1 and
   English-only operator emails; confirm.
6. **Dronebaas offer (OB-8)** — wireframe notes counsel review (Q5); OB-8 can ship without the
   partner block if that's pending.

## 6. Package status

Tracked task-by-task in [`EMAIL-PROGRAMME-CHECKLIST.md`](./EMAIL-PROGRAMME-CHECKLIST.md) — one
checkbox per atomic task with stable IDs (`A-01`…`G-18`), grouped by scope (backend / dashboard /
frontend). Update it in the same commit as the work.
