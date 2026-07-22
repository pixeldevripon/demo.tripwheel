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
| 0 | Fix silent bugs | 6 | 0 | Not started |
| 1 | Schema + moderation backbone (BE) | 14 | 0 | Not started |
| 2 | Collection flow (BE + FE) | 17 | 0 | Not started |
| 3 | Dashboard moderation module | 14 | 0 | Not started |
| 4 | Tour-page display completion (FE) | 10 | 0 | Not started |
| 5 | LD32 translation | 5 | 0 | Not started |
| 6 | Trustpilot platform layer | 8 | 0 | Not started |
| 7 | Depth + operator partnership | 8 | 0 | Not started |
| T | Test pass | 21 | 0 | Not started |
| **Total** | | **103** | **0** | |

---

## Blocking decisions (answer before the phase they gate)

- [ ] **D1 - Response authorship.** Master E.7 (operator response) vs canonical
      Section4_7 §4.7.18 (platform-authored). Recommendation: LD37 - platform-authored at
      launch, moderated operator-authored from phase 4. **Gates BE-6, DASH-4.**
- [ ] **D2 - Helpful votes.** Master defers to V2; code ships an unprotected public
      increment and the UI ships a "Most helpful" sort. Recommendation: remove both for
      launch, keep the column. **Gates BUG-2, FE-4.**
- [ ] **D3 - New frontend surfaces.** FE-11 ("How we handle reviews" explainer page) and
      FE-13 (homepage tour-quote strip) are **new sections/pages** and need explicit
      approval before being built. **Gates FE-11, FE-13.**
- [ ] **D4 - Review photo upload path.** Travelers are not dashboard users, so the media
      library cannot be reused. Recommendation: token-scoped public upload to a `reviews/`
      folder, size/mimetype capped, NSFWJS screening. **Gates BE-16, FE-1 step 3.**
- [ ] **D5 - First-send timing.** Morning-after is the launch default; register the A/B
      against day-2 / day-3. Non-blocking.
- [ ] **D6 - Translation provider.** Paid API vs self-hosted OPUS-MT / LibreTranslate.
      Gates phase 5.
- [ ] **D7 - Master diff.** LD34 / LD35 / LD36 / LD37 need a founder-approved diff, an
      archive copy, a version bump and conflict-log entries before the master reflects
      this module.

---

## Phase 0 - Fix what is silently broken

- [ ] **BUG-1** BE `reviews.service.ts` `recomputeAggregates()` also writes
      `Tour.ratingDistribution` (`[5★,4★,3★,2★,1★]`), `Tour.photoReviewCount` and
      `Tour.aggregatesUpdatedAt`. *Today these three columns are declared, selected, typed
      and consumed - and never written, so the public star chart is permanently empty.*
- [ ] **BUG-3** BE add an optional `rating` filter to `ListReviewsQueryDto` + the `list()`
      `where`. Required by LD31 (clickable star chart from launch).
- [ ] **BUG-5** FE add `getTourReviewSummary()` to `lib/api/public/reviews.ts`
      (`'use cache'`, `cacheTag('reviews', 'tour:<id>')`) and drive the meta row + section
      header from it, so the LD11 `source: 'operator'` cold-start path becomes reachable.
- [ ] **BUG-2** (needs D2) BE remove or identity-bind `POST /reviews/:id/helpful`; FE drop
      the "Most helpful" sort option.
- [ ] **BUG-6 / DASH-10** Add `tour:<tourId>` to `case 'reviews'` in
      `lib/api/cache-revalidation.ts` in **both** repos (see the TODO at lines 136-140).
- [ ] Verify: approve a review via the API, confirm a non-zero `ratingDistribution` on the
      tour row and real histogram bars on the public page.

---

## Phase 1 - Schema and moderation backbone (BE)

- [ ] **BE-1** Add `HELD` to `ReviewModerationStatus`; accept it in `moderate()`; assert
      in a test that only `APPROVED` feeds aggregates.
- [ ] **BE-2** Add `reviewerType` enum (`COUPLE | FAMILY | FRIENDS | SOLO`), nullable, on
      the model and `CreateReviewDto`. **Collect from launch; no consumer filter yet (LD36).**
- [ ] **BE-3** Add `source` enum (`NATIVE` default + reserved import values); every
      aggregate query filters `source = NATIVE`.
- [ ] **BE-4** Add `themeTags String[]`, admin-writable only.
- [ ] **BE-5** Add `departureId String?` FK, derived from the booking at create time.
- [ ] **BE-6** (needs D1) Add `responseAuthor` enum, restrict write access, freeze edits
      after publish, add response moderation if operator authorship is enabled.
- [ ] **BE-7** New `ReviewModerationLog` (`reviewId`, `actorId`, `fromStatus`, `toStatus`,
      `reason`, `createdAt`), written in the **same transaction** as every status change
      including deletes. Never editable or deletable.
- [ ] **BE-8** New `ReviewFlag` (`reviewId`, `flaggedByUserId`, `reason` enum, `note`,
      `status`, resolution fields). Operator-writable, admin-resolvable. A flag is a
      request, never an action.
- [ ] **BE-15** Add `isFeatured Boolean @default(false)`, admin-only.
- [ ] **BE-11** New `GET /reviews/admin` (`VIEW_REVIEWS`): cross-tour, all statuses,
      filters `status`, `tourId`, `operatorId`, `rating`, `hasPhotos`, `locale`, `from`,
      `to`, `search`.
- [ ] **BE-12** Include tour title, operator name and booking `displayRef` on moderation
      payloads so the queue is triageable.
- [ ] **BE-11b** `PATCH /reviews/bulk-moderate` for bulk approve.
- [ ] **BE-13** New `GET /reviews/operator` (scoped via `resolveOperatorId`) returning own
      reviews + a small analytics block.
- [ ] Migration + `pnpm prisma:generate`; backfill `source = NATIVE`, `verified = true`.

---

## Phase 2 - The collection flow (the headline gap)

### 2a. Token and submission API (BE)

- [ ] **BE-9a** New `ReviewInvitation` model (`bookingId @unique`, non-enumerable `token`,
      `sentAt`, `remindedAt`, `completedAt`, `revokedAt`). Single-use.
- [ ] **BE-9b** `GET /reviews/invitation/:token` (`@Public()`) → safe payload (tour title,
      hero image, tour date, guest first name). 404 on used / revoked / unknown.
- [ ] **BE-9c** `POST /reviews/invitation/:token` → **step-1 commit**: creates the review
      with the rating only and marks the invitation used. Reuses the booking gate,
      authenticated by token rather than session.
- [ ] **BE-9d** `PATCH /reviews/invitation/:token` → progressive enrichment (text, photos,
      guest type) while the review is still `PENDING`.
- [ ] **BE-16** (needs D4) `POST /reviews/invitation/:token/photos` - token-scoped upload,
      mimetype and size capped, `reviews/` folder, NSFWJS band routing to the queue.
- [ ] **BE-9e** `POST /reviews/invitation/:token/feedback` - the private recovery channel.
      **Offered alongside the neutral Trustpilot step, never instead of it.**

### 2b. Scheduling and email (BE)

- [ ] **BE-9f** `review-request.template.html` as a sibling of the booking confirmation and
      pre-tour reminder templates, 7 locales, registered as
      `MailService.sendReviewRequestEmail`.
- [ ] **BE-9g** Hourly worker job: selects bookings whose `tour_end_datetime` in the
      **snapshotted `tourTimeZone`** lands at ~10:00 the following local morning, with no
      invitation yet. Idempotent on `ReviewInvitation.bookingId`.
- [ ] **BE-9h** Suppression matrix: never send for cancelled, forfeited,
      operator-cancelled or no-show bookings (mirror the pre-tour reminder rules).
- [ ] **BE-9i** Single reminder at 5-7 days: WhatsApp where opt-in exists, else email.
      Never after `completedAt`. Two touches maximum, then stop.
- [ ] **BE-9j** WhatsApp review-contact opt-in captured at booking + an approved
      non-promotional template. **No SMS at launch.**
- [ ] Any new env var is a **three-file change** (`env.validate.ts` + both backend `.env`
      examples) in the same response.

### 2c. The review page (FE)

- [ ] **FE-1a** New route `app/(frontend)/[locale]/review/[token]/`, progressive
      disclosure per requirements §4.2.
- [ ] **FE-1b** Step 1 commits on tap (a one-tap review still counts); steps 2, 3, 3b each
      save independently and are skippable.
- [ ] **FE-1c** Step 4: **neutral** Trustpilot invitation shown to **every** customer
      regardless of score. On a low rating, the private recovery prompt is shown
      **additionally**. *Sentiment-gating this step breaches Trustpilot's rules and EU law.*
- [ ] **FE-1d** All copy in 7 locales with a working `dict` fallback; motion from
      `lib/motion.ts` (no `whileHover`; press = `whileTap` scale down).
- [ ] **FE-12** "Leave a review" entry point on `app/(login)/[locale]/bookings/page.tsx`
      for completed bookings.

---

## Phase 3 - Dashboard moderation module (DASH)

- [ ] **DASH-1** `types/review.ts` (entity, `ReviewsQueryParams`, `PaginatedReviews`,
      `ModerateReviewPayload`, `RespondPayload`).
- [ ] **DASH-2** `lib/api/reviews.ts` over `apiFetch` (`getAll`, `getById`, `moderate`,
      `bulkModerate`, `respond`, `remove`, `resolveFlag`, `setThemeTags`, `feature`).
- [ ] **DASH-3** `hooks/reviews/use-reviews.ts` - `reviewKeys` factory,
      `placeholderData: keepPreviousData`, invalidate root + detail on every mutation.
- [ ] **DASH-7** `REVIEW_STATUS` map in `components/common/status-maps.ts`
      (pending → warning, approved → success, held → info, rejected → danger).
- [ ] **DASH-4a** `components/reviews/reviews-list-view.tsx` - `useTableState()`; queue
      defaults to `status=PENDING` as a **filter default, not a hard exclusion**.
- [ ] **DASH-4b** `reviews-table.tsx` - `DataTable` with toolbar (search + status + rating
      + tour) and `bulkActions` (bulk approve, gated on `APPROVE_REVIEW`).
- [ ] **DASH-4c** `review-columns.tsx` - **7 columns** to match the existing
      `loading.tsx`: select, rating, reviewer, tour, status, submitted, actions.
- [ ] **DASH-4d** `review-detail-sheet.tsx` - full text, photos, booking / tour / operator
      links, moderation log, flags, response box, theme tags.
- [ ] **DASH-4e** `review-moderate-dialog.tsx` - approve / hold / reject with a
      **required** rejection reason and a policy-ground picker. "Negative" is never a ground.
- [ ] **DASH-4f** `review-delete-dialog.tsx`.
- [ ] **DASH-5** Replace the stub `app/(app)/reviews/page.tsx` with the server shell + list
      view. **No `lg:p-8`.**
- [ ] **DASH-6** Nav entry under **Operate** (`permissions: [Permission.VIEW_REVIEWS]`,
      `icon: StarIcon` already imported); remove the "blocked on A2" comment at
      `navigations/navigations.ts:255`; add `PendingReviewsBadge` to `NAV_BADGES`.
- [ ] **DASH-8** Role-shape the same screen for operators: own tours only, no
      approve/reject, response + flag only.
- [ ] RBAC: list on `VIEW_REVIEWS`, moderation on `APPROVE_REVIEW`, theme tags and feature
      on `EDIT_REVIEW`, delete on `DELETE_REVIEW`. Gated actions **absent, never disabled**.

---

## Phase 4 - Tour-page display completion (FE)

- [ ] **FE-3** Clickable star chart (LD31): a bar sets the `rating` filter and refetches
      page 1, with an active-filter chip and a clear affordance.
- [ ] **FE-4** Gate the sort control at >= 10 reviews and the filter bar at >= 20 (LD30).
- [ ] **FE-5** Per-card "Verified booking" badge + tooltip: "This guest booked and paid
      through Island Tours. We only publish reviews from real bookings."
- [ ] **FE-7a** LD11 fallback copy: "New on Island Tours. This tour is run by {operator},
      rated {x.x} across {n} reviews."
- [ ] **FE-7b** Low-volume copy: 1-2 reviews → "{x.x} from {n} early reviews", no chart.
      0 reviews and no fallback → no empty section, lean on the New badge.
- [ ] **FE-8** Travel month and guest type on each card.
- [ ] **FE-10** Gate the photo strip on `photoReviewCount >= 3` and make it a carousel.
- [ ] **FE-2** `Product` + `Offer` + `AggregateRating` + `Review` JSON-LD, server-rendered,
      emitted **only at >= 3 approved reviews**, only for reviews actually visible, and
      **never** for the LD11 operator fallback. Never on `Organization` / `LocalBusiness`.
- [ ] **FE-9** Theme chips above the cards from `themeTags`, filtering the list.
- [ ] **FE-11** (needs D3) "How we handle reviews" explainer, linked from the trust
      sub-line - the Omnibus "how you verify" disclosure.

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
- [ ] **FE-13** (needs D3) Homepage attributed tour-quote strip, volume-gated (e.g. >= 50
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
