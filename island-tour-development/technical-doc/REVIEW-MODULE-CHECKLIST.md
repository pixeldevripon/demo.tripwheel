# Review Module - Build Checklist

> Requirements: `REVIEW-MODULE-REQUIREMENTS.md` · Plan: `REVIEW-MODULE-PLAN.md`
>
> **Keep this current.** Flip `- [ ]` to `- [x]` in the **same commit or response** as the
> implementation work, and add an `EXECUTED:` note where a decision or a deviation was
> made. Do not mark a task done until it is verified, not merely written.
>
> Repos: **BE** = `island-tour-development/backend` · **FE** =
> `island-tour-development/frontend` · **DASH** =
> `tripwheel-x-islandtours-dashboard`

---

## Progress

| Phase | Scope | Tasks | Done | Status |
|---|---|---|---|---|
| 0 | Fix silent bugs | 6 | 6 | **DONE 2026-07-22** |
| 1 | Schema + moderation backbone (BE) | 14 | 14 | **DONE 2026-07-22** |
| 2 | Collection flow (BE + FE) | 17 | 16 | **DONE 2026-07-22** (FE-12 deferred, BE-16 open) |
| 3 | Dashboard moderation module | 14 | 14 | **DONE 2026-07-22** |
| 4 | Tour-page display completion (FE) | 14 | 14 | **DONE 2026-07-22** (FE-9 chips unseen: no tour hits the 20 gate) |
| 5 | LD32 translation | 5 | 0 | Not started |
| 6 | Trustpilot platform layer | 8 | 0 | Not started |
| 7 | Depth + operator partnership | 8 | 0 | Not started |
| T | Test pass | 21 | 0 | Not started |
| **Total** | | **107** | **66** | |

---

## Blocking decisions (answer before the phase they gate)

- [x] **D1 - Response authorship.** DECIDED 2026-07-22: **LD37 phased** - platform-authored
      at launch, moderated operator-authored from phase 4. Adds `responseAuthor`, restricts
      who may write, freezes edits after publish. *Gates BE-6, DASH-4.*
- [x] **D2 - Helpful votes.** DECIDED 2026-07-22: **remove both for launch**, keep the
      `helpfulCount` column. *EXECUTED in Phase 0.*
- [x] **D3 - New frontend surfaces.** DECIDED 2026-07-22 from the requirements, not
      preference: **build FE-11, skip FE-13 for now.** Requirements §5.4 makes the "How we
      handle reviews" explainer a compliance item (a bare claim does not satisfy UCPD
      Art. 7(6)); §6.2 marks the homepage tour-quote strip "**NEW, optional**,
      volume-gated" and Phase 2 parks it. *FE-13 stays on the list, unapproved.*
- [x] **D4 - Review photo upload path.** DECIDED 2026-07-22 from the requirements:
      **token-scoped public upload**. Photos are locked in master E.7, are Step 3 of the
      flow, and gate the >= 3 photo-review carousel; a login wall contradicts the
      tokenized no-login pattern the flow inherits from cancellation. *Gates BE-16, FE-1.*
- [ ] **D5 - First-send timing.** Morning-after is the launch default; register the A/B
      against day-2 / day-3. Non-blocking.
- [ ] **D6 - Translation provider.** Paid API vs self-hosted OPUS-MT / LibreTranslate.
      Gates phase 5.
- [ ] **D7 - Master diff.** LD34 / LD35 / LD36 / LD37 need a founder-approved diff, an
      archive copy, a version bump and conflict-log entries before the master reflects
      this module.

---

## Phase 0 - Fix what is silently broken · **COMPLETE 2026-07-22**

- [x] **BUG-1** BE `recomputeAggregates()` now also writes `Tour.ratingDistribution`,
      `Tour.photoReviewCount` and `Tour.aggregatesUpdatedAt`.
      **EXECUTED:** added a `groupBy(['rating'])` and a `count({ photos: { isEmpty: false } })`
      to the existing parallel batch, so it stays one round trip. All five tour columns are
      written together. Two unit tests added: one pins the `[2,1,0,0,0]` ordering, one pins
      that the photo count filters on APPROVED + non-empty `photos`.
- [x] **BUG-3** BE optional `rating` filter on `ListReviewsQueryDto` + `list()`.
      **EXECUTED.** Verified live: `rating=5` -> 200, `rating=9` -> 400.
- [x] **BUG-5** FE `getTourReviewSummary()` added (`'use cache'`, `cacheLife('days')`,
      `cacheTag('reviews', 'tour:<id>')`) and consumed by `tour-detail-content.tsx`.
      **The LD11 operator cold-start path is now reachable** - it was fully implemented in
      `review-display.util.ts` and the page simply never called it.
      **EXECUTED, and it surfaced a second bug:** the displayed `reviewCount` can now be the
      *operator's* borrowed count, so every render threshold and the histogram denominator
      were re-pointed at a new `ownReviewCount` (the tour's own approved count). Without
      that, a 0-review tour borrowing an operator's 40 would have opened the LD29 preview
      with no cards and scaled every histogram bar against the wrong total.
- [x] **BUG-2** (D2) BE removed `POST /reviews/:id/helpful` (service, controller, swagger,
      spec) and the `helpful` sort; FE dropped the "Most helpful" option and narrowed
      `ReviewSort`. The `helpfulCount` column and the `sortHelpful` dict key are retained,
      so V2 is neither a migration nor a seven-locale copy change. Verified live: 404.
      **EXTRA:** `sort` was validated with a bare `@IsString()` while advertising an enum,
      so `sort=helpful` silently fell through to newest. Now `@IsIn(REVIEW_SORTS)` -> 400.
- [x] **BUG-6 / DASH-10** `tour:<tourId>` busting on review writes.
      **EXECUTED, differently than planned:** the mapper *cannot* derive the tour id,
      because the backend routes are top-level - `PATCH /reviews/:id/moderate` carries the
      REVIEW id. Added an exported `revalidateReviewWrite(tourId)` to the dashboard's
      `lib/api/cache-revalidation.ts` for the Phase 3 write client to call alongside the
      automatic mapping, and rewrote the `case 'reviews'` comment to say so. *The public
      repo's copy of that file no longer exists: it was a stale duplicate producer and was
      deleted, so that app is consumer-only. See `dashboard-extraction/02-EXTRACTION-SPEC.md`
      §3.6a.*
- [x] **Verified end to end:** backend `tsc` 0, 27/27 reviews unit tests pass, 5/5 endpoint
      smoke tests against a running backend; frontend `tsc` 0, `eslint` 0, `next build`
      exit 0 with 868/868 static pages and zero errors.

---

## Phase 1 - Schema and moderation backbone (BE) · **COMPLETE 2026-07-22**

- [x] **BE-1** `HELD` added to `ReviewModerationStatus` and accepted by `moderate()`.
      **EXECUTED:** `MODERATABLE_STATUSES` is `APPROVED | HELD | REJECTED` - `PENDING` is
      entry-only and cannot be transitioned back into. HELD is "needs a second look", not a
      soft reject, so it carries no rejection reason. Verified against the live DB that a
      HELD review is excluded from the approved aggregate.
- [x] **BE-2** `reviewerType` enum + nullable column + `CreateReviewDto` field.
      Nullable because step 3b is optional - a one-tap review must still count (LD36).
- [x] **BE-3** `source` enum (`NATIVE` default, `IMPORTED_OPERATOR`,
      `IMPORTED_THIRD_PARTY`). **EXECUTED via a shared `PUBLISHED` where-clause**
      (`APPROVED` + `NATIVE`) composed into the public list, the LD11 summary and both
      aggregate queries, so there is one place to get it right rather than four. A unit
      test pins `source: NATIVE` in the photo-count query.
- [x] **BE-4** `themeTags String[]` + `PATCH /reviews/:id/theme-tags` (`EDIT_REVIEW`),
      deduped and trimmed, max 5 tags of 40 chars.
- [x] **BE-5** `departureId String?` FK (`onDelete: SetNull`), derived from the booking at
      create time, never client-supplied. Back-relation added to `Departure`.
- [x] **BE-6** (D1 / LD37) `responseAuthor` enum added; `respond()` now **admin-only** and
      stamps `PLATFORM`; a second write is a **409, not an overwrite** (E.7 "no editing").
      Fields renamed `operatorResponse`/`operatorRespondedAt` -> `responseText`/`responseAt`.
- [x] **BE-7** `ReviewModerationLog` written in the **same transaction** as every status
      change, plus a genesis row on create and a deletion row on remove.
      **EXECUTED, with a design correction:** the log is **deliberately NOT a foreign key**.
      As first written it cascaded on review delete, which destroyed the audit trail
      together with the row it documented - including the one record proving *who* removed
      a review and on what ground, which is exactly what the Omnibus "policy grounds only"
      position depends on being able to produce. Follow-up migration
      `20260722140000_review_audit_log_survives_delete` drops the constraint. Verified live:
      2 audit rows survive their review's deletion.
- [x] **BE-8** `ReviewFlag` + `POST /reviews/:id/flag` (operator/admin, upsert so
      re-flagging updates rather than queueing duplicates) and
      `PATCH /reviews/flags/:flagId` (`APPROVE_REVIEW`) to resolve or dismiss. Resolving a
      flag does **not** touch the review's status - removal is a separate, audited act.
      The reason enum has **no sentiment option**, by design.
- [x] **BE-15** `isFeatured` + `PATCH /reviews/:id/feature` (`EDIT_REVIEW`).
- [x] **BE-11** `GET /reviews/admin` (`VIEW_REVIEWS`): cross-tour, all statuses, filters
      `status`, `tourId`, `operatorId`, `rating`, `hasPhotos`, `flagged`, `locale`,
      `from`, `to`, `search`, `sort`. Oldest-first by default.
- [x] **BE-12** Rows carry `tourTitle`, `operatorName`, booking `displayRef`, `isFeatured`,
      `rejectionReason` and `openFlagCount` (`AdminReviewResponseDto`).
- [x] **BE-11b** `PATCH /reviews/bulk-moderate` (max 100 ids). Per-review rather than one
      `updateMany`, because each needs its own audit row with its own `fromStatus`;
      aggregates recompute once per affected tour, not once per review.
- [x] **BE-13** `GET /reviews/operator`, scoped via `resolveOperatorId`. **The scope is
      applied LAST in the where-clause**, so a caller-supplied `operatorId` can never widen
      it past their own tours.
- [x] **Migration + generate.** Two migrations applied; `prisma generate` re-run.
      **EXECUTED, and this is the important one:** `prisma migrate diff` proposed
      DROP COLUMN + ADD COLUMN for the response rename, which would have **destroyed 44
      published responses**. The migration was hand-written to `RENAME` instead, and
      backfills `responseAuthor = OPERATOR` for those pre-LD37 rows. Also seeds one genesis
      audit row per existing review. Verified before/after: 150 reviews, 44 responses in,
      **44 responses out**, 44 authors backfilled, 150 audit rows, 150 `source = NATIVE`.
- [x] **Also updated:** `prisma/demo/reviews.ts` seed (renamed fields + `PLATFORM` author),
      and the audit-log genesis row on create.
- [x] **FE contract break caught and fixed.** Renaming `operatorResponse` ->
      `responseText` broke the public site, and **nothing would have reported it**:
      `frontend/types/review.ts` is a hand-written mirror, not a generated client, so
      `tsc`, `eslint` and `next build` all stayed green while `review-view.ts` read a field
      that no longer existed. Operator responses would simply have stopped rendering, with
      no error anywhere. Updated the mirror (renamed fields + `reviewerType`, `themeTags`,
      `source`) and `toFullReview`, and left a comment on the type saying why this file has
      to move in step with the backend DTO.
      **Verified against the live API**, not just the types: the public payload carries
      `responseText`, `responseAuthor: OPERATOR` (the backfilled pre-LD37 value) and
      `responseAt`; the old field names are gone.
- [x] **Verified:** `tsc` 0 · 28/28 unit tests (3 new: PLATFORM stamping, 409 on re-edit,
      operator blocked at launch) · 9/9 new routes registered and guarded (401, not 404) ·
      public list still 200 · 4/4 live DB assertions (HELD accepted, HELD excluded from
      aggregates, defaults correct, audit trail survives delete).

---

## Phase 2 - The collection flow (the headline gap)

### 2a. Token and submission API (BE) · **COMPLETE 2026-07-22**

- [x] **BE-9a** `ReviewInvitation` model (`bookingId @unique`, non-enumerable `token`,
      `reviewId`, `sentAt`, `remindedAt`, `completedAt`, `revokedAt`, `suppressedReason`).
      **EXECUTED:** it is both the send ledger and the page credential, so the job and the
      page read one row. Two indexes shaped to the job's working sets ("needs a first
      touch", "needs its reminder"). Migration `20260722150000_review_invitations`,
      purely additive.
- [x] **BE-9b** `GET /reviews/invitation/:token` (`@Public()`).
      **EXECUTED:** unknown, spent and revoked tokens return the **same** 404, so a caller
      holding a bad token learns nothing about whether it ever existed. The payload is
      deliberately narrow (tour name, hero image, travel date, guest first name) - the
      token travels in an email and may be forwarded, so it must not unlock price, contact
      details or payment data.
- [x] **BE-9c** `POST /reviews/invitation/:token` - step-1 commit. Creates the review
      PENDING with its genesis audit row and spends the token, **all in one transaction**.
      Also re-checks `Review.bookingId @unique` so a double tap racing itself gets a clean
      409 rather than a raw constraint error.
- [x] **BE-9d** `PATCH /reviews/invitation/:token` - text, title, photos, guest type and
      the optional sub-ratings, each saving independently. Allowed **only while PENDING**:
      once a moderator has acted, the text they approved is not rewritable from an emailed
      link. The comment upserts its locale translation rather than duplicating it.
- [x] **BE-9e** `POST /reviews/invitation/:token/feedback` - the private recovery channel.
      Deliberately **not** stored on the review: it is support correspondence, not review
      content, and must never reach a public surface or an aggregate.
- [x] **Route ordering:** `ReviewInvitationsController` is registered **before**
      `ReviewsController` in the module, or `reviews/:id` swallows `reviews/invitation`
      as an id. Verified both still resolve.
- [x] **BE-9j (schema half)** `Booking.reviewWhatsappOptIn` added, separate from
      `newsletterOptIn` - agreeing to a newsletter is not consent to be messaged on
      WhatsApp, and WhatsApp Business rejects the template without prior opt-in.
- [x] **Verified end to end against the live API** with a real booking: resolve -> step-1
      commit -> enrich -> token spent (404) -> double-start refused (404). Persisted state
      checked in the DB: rating 4, `reviewerType FAMILY`, `PENDING`, `source NATIVE`,
      privacy-safe `"Wei C."`, travel month/year derived from the booking, EN translation
      upserted, 1 genesis audit row, invitation `completedAt` set and `reviewId` linked.
      Test rows cleaned up afterwards.
- [ ] **BE-16** (D4: token-scoped) `POST /reviews/invitation/:token/photos` - token-scoped
      upload, mimetype and size capped, `reviews/` folder, NSFWJS band routing to the
      queue. *Deferred to the end of Phase 2: `PATCH` already accepts photo URLs, so the
      flow is unblocked and this is only the upload transport for them.*

### 2b. Scheduling and email (BE) · **COMPLETE 2026-07-22**

- [x] **BE-9f** Review-request email.
      **EXECUTED, reusing the shared notice shell rather than adding a fifth HTML file.**
      `booking-notice.template.html` states in its own header that it carries the traveller
      confirmation's styles *verbatim* "so the family of emails cannot drift apart", and it
      already has exactly this shape (brand bar, headline, booking ref, tour line,
      paragraphs, one CTA, sign-off). A near-duplicate would have drifted the first time
      anyone restyled one of them. `MailService.sendReviewRequestEmail` owns the copy and
      the first-touch / reminder variants; the real `SiteInfo.logo` is resolved once per
      run through the same `emailSafeLogoUrl` the confirmation uses, so the two emails
      render an identical header. **Confirmed rendering in a real inbox.**
- [x] **BE-9g** Hourly send job (`ReviewRequestsService.run`), wired into
      `NightlyJobsService` as `@Cron(EVERY_HOUR)`.
      **EXECUTED as HOURLY, not nightly, deliberately:** "the morning after, ~10:00 local"
      is a different absolute instant on every island, so a daily job at a fixed UTC hour
      would either fire at the wrong local time or need one cron per destination. The job
      runs hourly and decides per booking, in that booking's **snapshotted** `tourTimeZone`
      - never a universal Curaçao fallback, and never the live tour zone, so a later
      timezone change cannot retroactively move emails already sent.
- [x] **BE-9h** Suppression matrix: `CANCELLED`, `EXPIRED`, `REJECTED`, `ON_HOLD`,
      `PENDING` never receive a request. Plus a **revoke pass** for bookings cancelled
      *after* their invitation was created - `revokedAt` also kills any token already
      shipped. Verified: 0 live invitations on non-completed bookings.
- [x] **BE-9i** Single reminder, default 5 days. `remindedAt` is stamped **even on send
      failure**: this is the one reminder, and a bounced address would otherwise be retried
      on every run forever.
- [x] **BE-9j** `Booking.reviewWhatsappOptIn` captured (schema in 2a). *WhatsApp delivery
      itself is not wired - there is no WhatsApp provider in the stack yet, so the reminder
      falls back to email. Tracked for Phase 6 alongside the Trustpilot work.*
- [x] **Dashboard-controlled cadence** (`ReviewRequestSettings` + `GET`/`PATCH
      /settings/review-requests`, `VIEW_SETTINGS` / `MANAGE_SETTINGS`, throttled).
      **NOT in the original plan - added on user instruction, and it is the right call:**
      the advisory says outright that the morning-after send is a *launch default to A/B
      test*, so the cadence is a business decision, not an engineering constant.
      Configurable: `enabled`, `firstSendLocalHour`, `firstSendDelayDays`,
      `reminderEnabled`, `reminderAfterDays`, `giveUpAfterDays`, `batchSize`.
- [x] **`enabled` DEFAULTS TO FALSE**, and is checked **before invitations are created**,
      not just before they are sent - otherwise switching it on later would fire a backlog
      of stale emails at once. A job that mails real customers is turned on deliberately by
      a person, never merely by deploying the code that contains it.
- [x] **Verified:** `tsc` 0 · 28/28 unit tests · both settings routes registered and
      guarded (401) · defaults correct in the DB · job is a **no-op while disabled** and
      runs clean when enabled · idempotent across two consecutive runs (no duplicate
      invitations) · no invitation for a future-dated tour.
- [ ] Any new env var is a **three-file change** (`env.validate.ts` + both backend `.env`
      examples). *Not needed: the cadence lives in the DB, not the environment - which is
      the point of making it dashboard-controlled.*
- [x] **DASH-11 the cadence SCREEN** - `components/settings/review-requests-form.tsx`, a
      new **Reviews** tab in admin settings (`/settings?tab=reviews`) holding the cadence
      form above the existing platform-reviews form.
      **Gap found on review: the endpoints existed with no UI**, so the master switch was
      only reachable by a hand-rolled `PATCH`. "Dashboard-controlled" was true of the API
      and false of the dashboard.
      - Composed from the settings form kit (`SettingsCard` / `TextField` / `CheckboxField`
        / `SettingsCardSkeleton`) per the reusable-UI rule - nothing hand-rolled.
      - `reviews` was **aliased** to `integrations` and is now a real tab; the alias had to
        be **removed** because `EntityTabs` resolves aliases *before* it looks the value up,
        so leaving it would have made the new tab unreachable by URL. Legacy
        `?tab=reviews` links still land on the platform-reviews form they were written for.
      - Save confirmation states the resulting state in words ("Review requests are ON -
        customers will be emailed") rather than a generic "Settings saved". A switch that
        mails real customers should not confirm ambiguously.
      - A plain-English summary line reads the seven numbers back as one sentence; the
        fields are individually clear and collectively hard to hold in your head.
      - `z.number()` + `valueAsNumber`, **not** `z.coerce.number()` - zod 4 types a coerced
        input as `unknown`, which no longer satisfies the resolver's form type.
- [x] **Verified (DASH-11):** `tsc` 0 errors · `eslint` 0 errors. The one remaining warning
      (`react-hooks/incompatible-library` on argless `watch()`) is **pre-existing repo-wide**
      - baseline-checked against `reviews-form.tsx` and `site-info-form.tsx`, which trip it
      too, and argless `watch()` is already the pattern in 3 other components.

> **LIVE-STATE DRIFT, found while verifying DASH-11 - RESOLVED 2026-07-22.** The `enabled`
> *column default* is `false` and always was, but the `default` **row** in the dev DB read
> `enabled = true`, left on after the incident below. 31 invitations sat `sentAt`-stamped
> with `remindedAt` NULL, which would have sent **31 reminders around 2026-07-27**: 30 to
> `@demo.islandtours.test` (hard bounces, sender reputation) and 1 to a real address.
>
> Closed on user instruction, in two steps:
>
> 1. `enabled = false`. Takes effect with no restart - `run()` calls `cadence()` fresh each
>    invocation and returns before `createInvitations`/`sendFirstTouch`/the reminder branch.
> 2. All 31 invitations **revoked** (`revokedAt` + `suppressedReason`), not deleted, so the
>    ledger still records that they happened. Pausing alone was not enough: re-enabling
>    would have released the whole batch at once, since by then every `sentAt` is far past
>    the reminder interval.
>
> Verified with the service's own `WHERE` clauses, not an eyeball: `first_touch_due = 0`,
> `reminders_due = 0`. Written straight to the DB, so the `DISABLED` line the service logs
> on a flip is absent - state correct, audit line missing. Later flips go through the tab.
>
> **INCIDENT, recorded honestly.** During testing the job sent **31 real Resend API
> calls**. Every recipient was an `@demo.islandtours.test` demo-seed address on an RFC 2606
> reserved TLD that never resolves, plus the founder's own address which received and
> confirmed the email. No third party was mailed, but the sending domain took ~30 hard
> bounces. Root cause: the job had no master switch and `RESEND_API_KEY` is live in `.env`.
> The `enabled = false` default above exists because of this and prevents recurrence.

### 2c. The review page (FE) · **COMPLETE 2026-07-22** (FE-12 deferred, see below)

- [x] **FE-1a** `app/(frontend)/[locale]/review/[token]/page.tsx`.
      Mirrors the cancel page exactly: `generateStaticParams` returning one
      placeholder (Cache Components needs a prerendered entry and real tokens are
      unguessable runtime credentials), `robots: noindex`, `connection()` + Suspense +
      a section-mirroring skeleton, `MountReveal` on the streamed card.
      Server resolver `lib/api/public/review-invitation.ts` is **deliberately NOT
      `'use cache'`** - it is keyed by a single-use credential whose whole job is to stop
      being valid, so a cached "still valid" answer would keep a spent token looking
      usable for a whole `cacheLife`.
- [x] **FE-1b** Step 1 commits on star press via `startReview`; steps 2/3/3b each save
      independently on blur or tap via `enrichReview`. A guest who taps one star and closes
      the tab has still left a countable review, which is the entire point of the design.
- [x] **FE-1c** Step 4 is shown to **every** guest on the same basis, whatever they scored.
      On a low score the private recovery prompt appears **alongside** it, never instead.
      *Sentiment-gating a third-party invitation is review gating: it breaches Trustpilot's
      guidelines and is the conduct AGCM fined Trustpilot 4 million euro over (PS12962).*
      Step 4 hides itself entirely until `NEXT_PUBLIC_TRUSTPILOT_REVIEW_URL` exists
      (Phase 6) - a dead invitation is worse than none.
- [x] **FE-1d** `reviewSubmit` copy added to **all 7 locale dictionaries** (32 keys each),
      real translations rather than EN placeholders. Motion from `lib/motion.ts`
      (`springPop`), press-only `whileTap` scaling **down**, no `whileHover` anywhere.
- [x] **Verified live** against a running backend and a real booking, with the built
      frontend (`next start`): page renders the tour name, guest first name, hero image,
      step-1 header and hint; `noindex` present; an unknown token renders the
      "no longer valid" state rather than erroring.
      **Compliance path verified end to end:** a **2-star** review with a critical comment
      submitted through the real endpoints is stored **in full** (`rating 2`,
      `reviewerType FRIENDS`, comment intact) and enters the normal `PENDING` queue - the
      private feedback channel did **not** divert or suppress it. Test rows cleaned up.
- [ ] **FE-12** "Leave a review" entry point for completed bookings.
      **DEFERRED, with reason - there is no surface to attach it to.**
      `app/(login)/[locale]/bookings` is a lookup *form*, not a booking list, and it routes
      straight to the thank-you page for a single booking. The only candidate host is the
      TYP, and putting the review token there would mean exposing a single-use credential
      on a page reachable with just `publicRef`, weakening the token model for a secondary
      entry point. **The email is the primary and sufficient channel.** Revisit when a real
      account booking-list exists (see `project_customer_accounts`).

---

## Phase 3 - Dashboard moderation module (DASH) · **COMPLETE 2026-07-22**

- [x] **DASH-1** `types/review.ts` - `Review`, `AdminReview`, `ReviewModerationLogEntry`,
      query params, payloads, plus the `MODERATABLE_STATUSES` const. Hand-written mirror
      per 02-EXTRACTION-SPEC §3.3, with a header saying so: a backend rename fails
      **silently** here because nothing type-checks across the wire (exactly what happened
      in Phase 1 with `operatorResponse`).
- [x] **DASH-2** `lib/api/reviews.ts` over `apiFetch`.
      **Every mutating call also fires `revalidateReviewWrite(tourId)`** - the automatic
      mapping cannot derive the tour id from a top-level `/reviews/:id` path, and that
      granular tag is what refreshes the tour page's rating and star chart. Bulk approve
      busts **once per affected tour**, since one selection can span many.
- [x] **DASH-3** `hooks/reviews/use-reviews.ts` - `reviewKeys` factory (scoped
      admin/operator so the two queues never share a cache entry),
      `placeholderData: keepPreviousData`, invalidate root + detail on every mutation,
      plus `useReviewHistory` (only fetches when the sheet opens) and
      `usePendingReviewCount` (`limit: 1`, only `total` is read).
- [x] **DASH-7** `REVIEW_STATUS` in `components/common/status-maps.ts`.
      **HELD is `info`, not `danger`:** it means "needs a second look", not "rejected" - a
      parked review must not read on screen as one that was thrown out.
- [x] **DASH-4a** `reviews-list-view.tsx` - `useTableState`; **Pending is a filter
      DEFAULT, not a hard exclusion** (the cancellations-queue idiom), so history stays one
      dropdown away. **Role picks the ENDPOINT, not the filter:** an operator hits
      `/reviews/operator`, scoped server-side *after* the query params, so no filter
      combination can widen it. Client-side scoping would be a suggestion; server-side is a
      rule.
- [x] **DASH-4b** `reviews-table.tsx` - `DataTable` with search + status + rating filters,
      row click opens the sheet, and a bulk **Approve selected** gated on `APPROVE_REVIEW`.
      Empty state names the likely cause (queue clear, or the request schedule switched off
      in Settings) rather than just saying "no reviews".
- [x] **DASH-4c** `review-columns.tsx` - the **7 columns** `loading.tsx` already presumed:
      select, rating, reviewer, tour, status, submitted, actions. Open flags get their own
      marker beside the status, because a flag never changes the status and would otherwise
      be invisible in the list.
- [x] **DASH-4d** `review-detail-sheet.tsx` - content, photos, the verification chain
      (booking ref -> tour -> operator), the response box (LD37: platform-authored, and
      once published it renders as read-only with "cannot be edited"), and the **audit
      trail inline** rather than behind another click, because "who changed this and why"
      is the question moderation exists to answer.
- [x] **DASH-4e** `review-moderate-dialog.tsx` - approve / hold / reject with per-status
      copy. **Rejection grounds are a CLOSED LIST, not free text**, and there is
      deliberately no "negative" or "bad for business" option: a moderator cannot type
      "1 star, hurts the tour" into a dropdown. Carries the line "A low score is never a
      ground for rejection."
- [x] **DASH-4f** `review-delete-dialog.tsx` - requires a documented ground (the backend
      enforces it too) and says plainly that **rejecting is almost always the right action
      instead**, since deleting destroys the content while rejecting keeps it inspectable.
- [x] **DASH-5** `app/(app)/reviews/page.tsx` - the 8-line stub replaced with a sync server
      shell + list view. **No `lg:p-8`** (the layout wrapper adds it).
- [x] **DASH-6** Nav entry under **Operate** (`VIEW_REVIEWS`, `StarIcon`), the
      "blocked on A2" comment replaced with a shipped note, and `PendingReviewsBadge` added
      to `NAV_BADGES`. The badge filters on `PENDING` to **match the page's own default** -
      a badge promising work the page does not show is worse than no badge.
- [x] **DASH-8** Operator-shaped view: same screen, `/reviews/operator` endpoint, no
      approve/reject/delete in the row menu (gated actions are **absent, never disabled**),
      plus a footer line explaining that publishing decisions sit with Island Tours and
      reviews are never removed for being negative.
- [x] **RBAC**: list `VIEW_REVIEWS` · moderation + response + bulk `APPROVE_REVIEW` ·
      delete `DELETE_REVIEW`. (Theme tags and feature are built on the backend under
      `EDIT_REVIEW`; the dashboard UI for them lands with the Phase 4 theme chips.)
- [x] **Verified:** dashboard `tsc` 0 · `eslint` 0 · `next build` exit 0 with `/reviews`
      prerendered · `GET /reviews/admin` reachable and guarded (401) · **`lib/cache-tags.ts`
      still byte-identical across both repos** (the cross-repo contract holds).

---

## Phase 4 - Tour-page display completion (FE) · **COMPLETE 2026-07-22**

- [x] **FE-3** Clickable star chart (LD31): a bar sets the `rating` filter and refetches
      page 1, with an active-filter chip and a clear affordance.
      Each bar is a real `<button aria-pressed>`; clicking the active bar clears it, so the
      chart is its own toggle. Zero-count bars are disabled - a filter that can only ever
      return nothing should not be offered. Verified: 5 bars render as buttons, and
      `?rating=3` returns `[3]` only while `?rating=4` returns 0 on the same tour.
- [x] **FE-4a** Sort control gated at >= 10 of the tour's OWN reviews (LD30).
      **EXECUTED early in Phase 0** - once `ownReviewCount` existed the gate was two lines,
      and leaving it ungated alongside a borrowed LD11 count would have been a live bug.
      Star chart likewise gated at >= 3 (LD31).
- [x] **FE-4b** Filter bar at >= 20 reviews (LD30) - the theme chips ARE the filter bar,
      gated on `ownReviewCount >= 20`. **Not visible in demo data:** the busiest seeded tour
      has 14 approved reviews, so nothing currently clears the gate. The gate and the
      filtering are separately verified (backend filter below); what is unverified is only
      how the chip row looks on screen.
- [x] **FE-5** Per-card "Verified booking" badge + tooltip: "This guest booked and paid
      through Island Tours. We only publish reviews from real bookings."
      Native `title` rather than a hand-rolled popover - it is a compliance disclosure, so
      it must survive with no JS, and the full Omnibus text has its own page (FE-11).
      Verified: 11 badges on the reference tour (10 cards + the preview strip).
- [x] **FE-7a** LD11 fallback copy: "New on Island Tours. This tour is run by {operator},
      rated {x.x} across {n} reviews."
      Verified rendered on a 0-review tour: *"New on Island Tours. This tour is run by Miss
      Ann Boat Trips, rated 4.8 across 39 reviews."*
- [x] **FE-7b** Low-volume copy. **The spec as written was unreachable, and hid a live bug.**
      `resolveRatingSource` returns `source: 'tour'` only at `tourCount >= 3`, so
      "1-2 reviews showing the tour's own rating" is impossible by construction - a
      `source === 'tour' && count <= 2` test can never fire. The state that DOES exist is
      1-2 reviews whose operator is not established enough to lend a rating: reviews to
      show, no qualifying rating. That case rendered `rating ?? 0` as a literal **"0.0"**
      next to a star, so a tour with two five-star reviews advertised itself as zero-rated.
      Resolved by keying the state off `source === 'none' && ownReviewCount > 0` and
      rendering the count copy with **no star and no number** - LD11 declined to show a
      rating, and printing an honest two-review average anyway is the exact thing the
      3-review threshold exists to prevent. Copy changed to stand alone
      ("{count} early reviews", not "from {count} early reviews") in all 7 locales.
      **Open question for the master:** whether LD11 should instead expose a tour's own
      1-2-review average under "early reviews" framing. That is a decision, not a bug -
      flagged, not silently taken.
- [x] **FE-7b (cont.)** 0 reviews and no fallback → **no section at all**, and the nav tab
      is dropped in the same condition. A tab scrolling to a missing anchor is worse than
      no tab; the divider above it goes too, so the page does not end on a stray hairline.
- [x] **FE-8** Travel month and guest type on each card.
      Built from `travelMonth`/`travelYear` (when the tour was TAKEN), never `createdAt` -
      a review written six months late would otherwise claim the wrong season, which is the
      one thing this line is read for. Guest type is absent on ~20% of reviews by design
      (it is the optional step in the submit flow), so the line degrades to the month alone.
      Verified: all 4 guest types plus the null case render on the reference tour.
- [x] **FE-10** Photo strip gated on `photoCount >= 3` and made a snap carousel.
      The gate counts **reviews with photos, not photos**: one guest's three snapshots are
      one opinion, and a strip implies several. Hidden while a filter is active - it is
      aggregated from the loaded page, so it would silently become "photos matching this
      filter" under a heading that says otherwise. `photoCount` is a new summary field.
- [x] **FE-2** `Product` + `Offer` + `AggregateRating` + `Review` JSON-LD, server-rendered.
      Pure builder in `lib/seo/tour-review-jsonld.ts` so the emission rules are testable in
      one place. **Verified both directions**, which is the part that matters:
      - 14-review tour → 1 block, `reviewCount: 14` (the tour's OWN), 10 `Review` entries
        matching exactly the 10 cards rendered, `Offer` at the converted display price.
      - LD11 fallback tour → **0 blocks**. Marking a borrowed operator rating up as the
        tour's `aggregateRating` would tell Google 4.8-from-39 about a product with no
        reviews - review fraud under both Google's policy and the Omnibus regime.
      Reviews with an empty body are excluded (a rating is not a review). Serialized with
      `<` escaped, so review text cannot close the script tag. Nothing attaches to
      `Organization` / `LocalBusiness`.
- [x] **FE-9** Theme chips above the cards from `themeTags`, filtering the list.
      **Deviates from the plan's "filtering client-side"** - deliberately. The star filter
      already round-trips, and two filter mechanisms cannot combine: a client-side theme
      filter would only ever see the pages loaded so far, so "Great guide" would mean
      something different at each scroll depth and the count beside it would be a lie.
      Added `themeTag` to `ListReviewsQueryDto` + a `has` (exact-element) clause, and
      `themes[]` facets to the summary. Verified: exact match returns only tagged reviews,
      the prefix `Great` returns **0** (proving it is not a prefix match), star+theme
      combine, and a 61-char tag is a 400.
- [x] **FE-9 data** `themeTags` and `reviewerType` were **empty on all 137 approved reviews**
      - the demo seed never set either, so both features would have shipped invisible.
      Added to `prisma/demo/reviews.ts` from a fixed vocabulary (free-text tags only group
      by exact match, so a seed inventing a phrase per review renders a chip bar reading "1"
      on every chip) and backfilled the existing 150 rows in place rather than re-seeding.
- [x] **FE-11** **APPROVED (D3)** "How we handle reviews" explainer at
      `/{locale}/reviews-policy`, linked from the reviews sub-line.
      Reuses `LegalPageShell` for chrome, but is flagged in-file as **platform-authored, not
      handover copy** (its six siblings are verbatim from `public/Legal Pages` and change
      only through Denley). Every claim maps to enforced behaviour, including §6 disclosing
      the LD11 borrowed rating - the one place a displayed rating is not the tour's own and
      so the one most needing disclosure.
- [x] **Verified (Phase 4):** backend `tsc` + `eslint` 0 · frontend `tsc` + `eslint` 0 ·
      `next build` green, **891 pages** (868 + the new route x 7 locales) · summary returns
      `themes` + `photoCount` · all four filter behaviours checked against the live API ·
      both JSON-LD directions checked on real pages.
- [x] **Stale-cache guard.** `getTourReviewSummary` is `'use cache'` with a `days` lifetime,
      so a cached entry written before this phase - or a frontend deployed ahead of the
      backend - hands back an object with `themes`/`photoCount` simply absent. Consumers
      call `.length`/`.map` on them, which is a TypeError, not a missing chip bar. Both are
      now defaulted at the loader boundary.

---

## Phase 5 - LD32 translation

- [ ] **D6** Provider decision recorded.
- [ ] **BE-10a** `POST /reviews/:id/translate` (admin) + automatic translate-on-approve
      filling `ReviewTranslation` for the other 6 locales with `isMachineTranslated = true`.
- [ ] **BE-10b** BullMQ job: batched, cached, never re-translating an unchanged source.
- [ ] **FE-6a** Per-card "Translated by …" label + **show-original toggle**.
- [ ] **FE-6b** Translate in place. No indexable per-review translation URLs.

---

## Phase 6 - Trustpilot platform layer

- [ ] One `island.tours` business profile, service reviews only.
- [ ] Trustpilot Invitations API fired from **our** step 4, never Trustpilot's parallel
      automation.
- [ ] Tour and operator carried as **private tags** for internal analytics; public display
      stays platform-level.
- [ ] **Neutral invitation for every customer.** No sentiment routing. **No incentives**
      (Trustpilot bans them even where EU law would allow a disclosed one).
- [ ] Frequency cap: once per customer per quarter; never double-send.
- [ ] Footer mini-badge + checkout trust area. **Never a tour page.**
- [ ] Claim Google **store ratings** past ~100 eligible reviews at >= 3.5 stars.
- [ ] **FE-13** **NOT approved (D3)** - optional and volume-gated per Requirements §6.2. Homepage attributed tour-quote strip, volume-gated (e.g. >= 50
      approved tour reviews); every quote names and links its tour.

---

## Phase 7 - Depth and operator partnership

- [ ] Traveler-type filter (past the 20-review LD30 gate).
- [ ] With-photos filter.
- [ ] Language filter.
- [ ] Photo-forward cards.
- [ ] AI review summaries + AI theme chips at 30 reviews per tour (LD28, LD29 Tier 3).
- [ ] Helpful votes re-enabled with identity binding.
- [ ] **DASH-9** Operator analytics: rating trend, review velocity, theme breakdown, plus
      the eligibility metrics the nightly job already computes.
- [ ] **LD37 switch**: platform-authored → moderated operator-authored responses.

---

## Test pass (run when the module is complete)

### Backend unit

- [ ] LD11 resolution table (3 / 10 / 4.0 boundaries).
- [ ] `recomputeAggregates` writes rating, count, distribution, photo count, timestamp.
- [ ] Banned-word screen.
- [ ] Moderation state machine including `HELD`.
- [ ] Audit-log row written on every transition, including delete.

### Backend e2e (test DB `island_tours_test`; provision users via the Better Auth internal adapter)

- [ ] Booking gate: not the owner → 403.
- [ ] Booking gate: wrong status → 400.
- [ ] Booking gate: before the experience date (in the snapshotted timezone) → 400.
- [ ] Booking gate: duplicate booking → 409.
- [ ] Token lifecycle: valid → used → dead (404).
- [ ] Operator cannot delete or unpublish any review.
- [ ] Operator cannot read another operator's reviews.
- [ ] Only `APPROVED` + `source = NATIVE` records reach any aggregate.
- [ ] Bulk moderate.

### Job

- [ ] Send window resolves correctly per destination timezone (Curaçao, Aruba, Sint Maarten).
- [ ] Suppression matrix: cancelled / forfeited / operator-cancelled / no-show → no send.
- [ ] Idempotency: run the job twice → exactly one invitation.
- [ ] Reminder fires once and never after `completedAt`.

### Dashboard e2e (Playwright)

- [ ] Queue defaults to pending, history one dropdown away.
- [ ] Approve / hold / reject, with the rejection reason enforced.
- [ ] Bulk approve.
- [ ] RBAC: an operator sees no approve/reject buttons.
- [ ] Pending badge count is correct.

### Frontend

- [ ] Threshold rendering at 0 / 1-2 / 3-9 / 10-19 / 20+ reviews.
- [ ] Clickable star chart filters the list.
- [ ] Submission flow completes from step 1 alone.

### Compliance

- [ ] A 1-star review is published and visible on the tour page.
- [ ] The Trustpilot step is shown on every score, with the recovery prompt additive.
- [ ] No Trustpilot element appears anywhere on a tour page.
- [ ] The verification sub-line links to the explainer.
