# Review Module - Implementation Plan

> Requirements: `REVIEW-MODULE-REQUIREMENTS.md`. Trackable tasks:
> `REVIEW-MODULE-CHECKLIST.md`.
>
> Code surveyed 2026-07-22 across all three codebases:
> - **backend** `island-tour-development/backend` (NestJS 11 + Prisma)
> - **frontend** `island-tour-development/frontend` (Next.js public site)
> - **dashboard** `tripwheel-x-islandtours-dashboard` (Next.js admin/operator)

---

## 1. Where we actually are

### Verdict in one line

The **read path is largely built and good**. The **write path does not exist**: nothing
asks a guest to review, there is no submission UI anywhere, and the dashboard reviews
page is an 8-line stub. Two silent data bugs make the tour page render a permanently
empty star chart.

### 1.1 Backend - `backend/src/reviews/` - **built, with gaps**

| Layer | File | State |
|---|---|---|
| Schema | `prisma/reviews.prisma` | `Review` + `ReviewTranslation`. `bookingId @unique`, tour/operator/user attribution, overall + 3 sub-ratings, title, `reviewerFirstName` / `reviewerInitial` / `reviewerCountry`, `travelMonth` / `travelYear`, `photos[]`, `isVerified`, `helpfulCount`, `moderationStatus`, `rejectionReason`, `operatorResponse` / `operatorRespondedAt`. Three indexes |
| Enum | `prisma/enums.prisma:431` | `ReviewModerationStatus { PENDING, APPROVED, REJECTED }` |
| Permissions | `prisma/enums.prisma:147-150` + `src/config/roles.config.ts` | `VIEW_REVIEWS`, `EDIT_REVIEW`, `DELETE_REVIEW`, `APPROVE_REVIEW` already exist and are already granted |
| Service | `src/reviews/reviews.service.ts` (490 lines) | Booking gate (owner + `CONFIRMED`/`REDEEMED` + experience passed in the snapshotted timezone + one-per-booking), public list, LD11 summary, moderation queue, moderate, respond, helpful, delete, aggregate recompute |
| Util | `src/reviews/review-display.util.ts` | `reviewerInitial`, banned-word screen, **LD11 `resolveRatingSource` implemented exactly to spec** (3 / 10 / 4.0), `roundRating`. Unit-tested |
| Controller | `src/reviews/reviews.controller.ts` | 9 routes, correct static-before-dynamic ordering, correct guards |
| Tests | `reviews.service.spec.ts`, `review-display.util.spec.ts` | Exist |

**Endpoints today**

```
POST   /reviews                 auth   create (booking-gated, starts PENDING)
GET    /reviews?tourId=…        public approved only, paginated, sort, locale
GET    /reviews/summary?tourId= public LD11 resolution + distribution + sub-averages
GET    /reviews/mine            auth
GET    /reviews/pending         APPROVE_REVIEW  moderation queue (status + tourId filter)
POST   /reviews/:id/helpful     public !!  unbounded increment
POST   /reviews/:id/response    auth   tour owner or admin, no moderation
PATCH  /reviews/:id/moderate    APPROVE_REVIEW  APPROVED | REJECTED only
DELETE /reviews/:id             auth   author or admin
GET    /reviews/:id             public (auth-aware for non-approved)
```

### 1.2 Frontend (public site) - **display built, collection absent**

| Piece | File | State |
|---|---|---|
| Preview strip (LD29) | `components/frontend/tour/tour-reviews.tsx` | Built. Two cards, stars, name, country, date, verified label, expandable text, "See all" smooth-scroll |
| Full section | `components/frontend/tour/tour-reviews-section.tsx` (344 lines) | Built. Header aggregate, histogram bars, sort select, photo strip (cap 12), cards with photos + operator response, "Show more" client pagination |
| Streaming wrappers | `components/frontend/tour/tour-reviews-blocks.tsx` | Built. `await connection()` + Suspense per section, correct under Cache Components |
| Cached loader | `lib/api/public/reviews.ts` | Built. `'use cache'`, `cacheLife('days')`, `cacheTag('reviews', 'tour:<id>')` |
| Client pager | `lib/api/reviews.ts` | Built |
| Mappers | `lib/reviews/review-view.ts` | Built. Localized date + country name |
| Types | `types/review.ts` | Built |
| Homepage social proof | `components/frontend/home/testimonials.tsx` + `backend/src/platform-reviews/` | Built. Trustpilot/Google aggregate, admin-configured, encrypted key, 12h cache, **gated at > 100 reviews**. This is the platform-trust layer and it is correct |
| Submission UI | - | **Does not exist** |
| JSON-LD | - | **Does not exist anywhere in the frontend** |

### 1.3 Dashboard - **nothing**

`app/(app)/reviews/page.tsx` is an 8-line stub with a heading. But the scaffolding is
already in place and must be reused, not re-added:

- `app/(app)/reviews/loading.tsx` already renders `ListPageSkeleton` with 7 columns and 2 filters.
- `lib/config/rbac.ts:103-107` already has all four review permissions.
- `lib/cache-tags.ts:79` already has the `'reviews'` coarse tag.
- `lib/api/cache-revalidation.ts:141` already maps `case 'reviews'` to `['reviews','tours','search']`.
- `navigations/navigations.ts:255` has a comment saying "Reviews returns with its module (blocked on A2)" and **no nav entry**. `StarIcon` is already imported.
- Missing entirely: `types/review.ts`, `lib/api/reviews.ts`, `hooks/reviews/`, `components/reviews/`.

> Not to be confused: `components/settings/reviews-form.tsx` + `lib/api/settings.ts`
> `getPlatformReviews` are the **Trustpilot/Google credential form**, a different feature.

---

## 2. Gap register

Every gap gets an ID used by the checklist.

### 2.1 Bugs in what is already built (fix first, they are cheap)

| ID | Gap | Impact |
|---|---|---|
| **BUG-1** | `recomputeAggregates()` writes only `aggregateRating` + `aggregateReviewCount`. `Tour.ratingDistribution`, `Tour.photoReviewCount` and `Tour.aggregatesUpdatedAt` are declared in `tours.prisma:94-96`, selected in `tours.service.ts:156`, typed in the DTO and consumed by the frontend histogram - and **never written by anything** | The tour page star chart renders five zero-width bars forever. The >= 3 photo-review carousel gate can never fire |
| **BUG-2** | `POST /reviews/:id/helpful` is `@Public()` and increments without any identity, cookie or IP check | Anyone can inflate any review's helpful count with a loop. Also: helpful votes are **deferred to V2** by the master, and the frontend already exposes a "Most helpful" sort option |
| **BUG-3** | The public `GET /reviews` has no `rating` filter | **LD31 says the star chart is clickable from launch.** Clicking a bar has nothing to call |
| **BUG-4** | Frontend sort select renders unconditionally | LD30: sort is hidden under 10 reviews, filters under 20 |
| **BUG-5** | Frontend never calls `GET /reviews/summary`; it takes rating/count from the tour payload | The LD11 `source: 'operator'` cold-start path is implemented in the backend and **unreachable from the page**. New tours from established operators show nothing instead of the borrowed operator rating |
| **BUG-6** | Cache-revalidation TODO at `lib/api/cache-revalidation.ts:136-140` (both repos) | A top-level `/reviews/:id` write path does not bust `tour:<tourId>`, so the tour rating goes stale for a full `cacheLife` |

### 2.2 Backend gaps

| ID | Gap |
|---|---|
| **BE-1** | No `HELD` moderation status (master requires pending / approved / **held** / rejected) |
| **BE-2** | No `reviewerType` (guest type) field or capture. LD36 wants it collected from launch |
| **BE-3** | No `source` enum (native + reserved import values) and no rule keeping non-native out of aggregates |
| **BE-4** | No `themeTags[]` for manual highlight chips |
| **BE-5** | No `departureId` link |
| **BE-6** | No `responseAuthor` enum (platform / operator), no response moderation queue, and the response is freely editable (E.7 says "no editing") |
| **BE-7** | **No moderation audit log.** Compliance requires actor + timestamp + reason on every status change |
| **BE-8** | No review flag / report entity for the operator "flag, do not remove" lever |
| **BE-9** | **No post-tour review request.** No email template, no scheduled job, no single-use token, no reminder, no suppression rules. This is the headline gap |
| **BE-10** | No LD32 machine translation. `ReviewTranslation.isMachineTranslated` exists and nothing populates it. No translate endpoint, no provider wiring |
| **BE-11** | No admin cross-tour list endpoint. `GET /reviews` requires `tourId` and returns approved only; `/reviews/pending` is status-scoped, has only `tourId` as a filter, no search, no rating/operator/photo/date filters, and no bulk action |
| **BE-12** | Moderation payloads omit tour title, operator name and booking reference, so the queue cannot be triaged |
| **BE-13** | No operator-scoped list endpoint ("my tours' reviews" + rating analytics) |
| **BE-14** | No traveler notification when a review is rejected |
| **BE-15** | No `featured` flag for the LD29 preview / homepage quote strip |
| **BE-16** | Photo upload path for review photos is unspecified (the media library is dashboard-auth'd; travelers are not admins) |

### 2.3 Dashboard gaps

| ID | Gap |
|---|---|
| **DASH-1** | No `types/review.ts` |
| **DASH-2** | No `lib/api/reviews.ts` |
| **DASH-3** | No `hooks/reviews/use-reviews.ts` |
| **DASH-4** | No `components/reviews/*` (list view, table, columns, row actions, detail sheet, moderation dialogs) |
| **DASH-5** | `app/(app)/reviews/page.tsx` is a stub |
| **DASH-6** | No nav entry + no pending-count badge |
| **DASH-7** | No `REVIEW_STATUS` entry in `components/common/status-maps.ts` |
| **DASH-8** | No operator-shaped view |
| **DASH-9** | No review analytics (rating trend, velocity, theme breakdown) |
| **DASH-10** | `case 'reviews'` needs the `tour:<id>` granular bust added |

### 2.4 Frontend gaps

| ID | Gap |
|---|---|
| **FE-1** | **No review submission page.** The tokenized progressive-disclosure flow does not exist |
| **FE-2** | No `Product` + `AggregateRating` + `Review` JSON-LD |
| **FE-3** | Star chart is not clickable (LD31 requires it from launch) |
| **FE-4** | Sort not threshold-gated; no filter bar at all (LD30) |
| **FE-5** | No per-card "Verified booking" badge in the full section |
| **FE-6** | No LD32 translate / show-original toggle |
| **FE-7** | No LD11 operator-fallback copy or empty/low-volume copy variants |
| **FE-8** | No travel month or guest type on cards |
| **FE-9** | No theme chips |
| **FE-10** | Photo strip is not gated on `photoReviewCount >= 3` |
| **FE-11** | No "How we handle reviews" explainer page for the Omnibus disclosure link |
| **FE-12** | No "leave a review" entry point on the customer bookings page |
| **FE-13** | Homepage attributed tour-quote strip does not exist |

---

## 3. Open decisions - need an answer before the phase they gate

> Per the working rule, the master arbitrates and conflicts are surfaced, never silently
> resolved. These four block work; the rest of the plan assumes the recommendation.

| # | Decision | Recommendation | Gates |
|---|---|---|---|
| **D1** | **Response authorship.** Master E.7 says operator response; canonical Section4_7 §4.7.18 says platform-authored. Code today lets any tour owner respond, unmoderated | Adopt **LD37**: platform-authored at launch (add `responseAuthor`, restrict writes to `MANAGE_EDITORIAL`/admin), moderated operator responses from phase 4. Freeze editing after publish either way | BE-6, DASH-4 |
| **D2** | **Helpful votes.** The master defers them to V2; the code ships an unprotected public increment and the UI ships a "Most helpful" sort | Remove the public endpoint and the sort option for launch, keep the column. Re-add in phase 3 with identity binding | BUG-2, FE-4 |
| **D3** | **Homepage tour-quote strip (FE-13) and the "How we handle reviews" page (FE-11)** are both **new frontend sections/pages**, and the standing rule is never to add a new frontend section without explicit approval | Ask before building. FE-11 is a compliance strengthener and probably worth approving; FE-13 is optional and volume-gated | FE-11, FE-13 |
| **D4** | **Review photo upload path.** Travelers are not dashboard users, so the existing media library cannot be reused as-is | Add a token-scoped public upload endpoint that writes to a `reviews/` Cloudinary folder, size- and mimetype-capped, with NSFWJS screening routed to the moderation queue by confidence band | BE-16, FE-1 |

Two more that can be decided later: the **first-send timing A/B** (morning-after vs day 2
vs day 3) and whether to run **self-hosted translation** (OPUS-MT / LibreTranslate) or a
paid API for LD32.

---

## 4. The plan, phase by phase

Ordering rule: fix the silent bugs, then open the collection tap, then give admins a way
to moderate what arrives, then finish the display, then the trust layer, then depth.

---

### Phase 0 - Fix what is silently broken (backend + frontend, ~half a day)

Everything here is a bug in shipped code and blocks correct behavior downstream.

1. **BUG-1** In `recomputeAggregates()`, also compute and write `ratingDistribution`
   (a `[5★,4★,3★,2★,1★]` count array from the same `groupBy` the summary endpoint already
   uses), `photoReviewCount` (`count where photos is non-empty`), and
   `aggregatesUpdatedAt`. Same transaction as the existing two writes.
2. **BUG-3** Add an optional `rating` filter to `ListReviewsQueryDto` and to the `where`
   in `list()`. This unblocks the clickable star chart.
3. **BUG-5** Call `GET /reviews/summary` from the tour page loader (a new
   `getTourReviewSummary` in `lib/api/public/reviews.ts`, `'use cache'`, same tags) and
   drive the meta row + section header from `source` / `rating` / `reviewCount` /
   `distribution`, not from the tour payload. This makes LD11 reachable.
4. **BUG-2** Per D2: remove `POST /:id/helpful` and the `helpful` sort option, or bind it
   to identity. Keep the column.
5. **BUG-6 / DASH-10** Add `tour:<tourId>` to the `case 'reviews'` branch in
   `lib/api/cache-revalidation.ts` in **both** repos (the write client knows the tourId).
   Ship the public site first if any tag changes.

**Verify:** approve a review from an API client, confirm the tour row's
`ratingDistribution` is non-zero and the public histogram renders real bars.

---

### Phase 1 - Schema and moderation backbone (backend)

1. **BE-1** Add `HELD` to `ReviewModerationStatus`. Allow it in `moderate()`. Only
   `APPROVED` feeds aggregates (already true; assert it in a test).
2. **BE-2** Add `reviewerType` enum (`COUPLE | FAMILY | FRIENDS | SOLO`), nullable, on
   the model and on `CreateReviewDto`. **Collect from launch, do not surface a filter yet.**
3. **BE-3** Add `source` enum (`NATIVE` default, plus reserved import values). Every
   aggregate query filters `source = NATIVE`. Never blend.
4. **BE-4** Add `themeTags String[]`, admin-writable only.
5. **BE-5** Add `departureId String?` with an FK to the departure, derived from the
   booking at create time.
6. **BE-6** Per D1: add `responseAuthor` enum, restrict who may write, freeze edits after
   publish (reject a second write with 409 unless admin), and add a response moderation
   state if operator authorship is enabled.
7. **BE-7** New `ReviewModerationLog` model: `reviewId`, `actorId`, `fromStatus`,
   `toStatus`, `reason`, `createdAt`. Written in the **same transaction** as every status
   change, including deletes. Never editable, never deletable.
8. **BE-8** New `ReviewFlag` model: `reviewId`, `flaggedByUserId`, `reason` enum
   (`FAKE | ABUSIVE | OFF_TOPIC | PERSONAL_DATA | NOT_A_CUSTOMER`), `note`, `status`
   (`OPEN | RESOLVED | DISMISSED`), resolution fields. Operator-writable, admin-resolvable.
9. **BE-15** Add `isFeatured Boolean @default(false)`, admin-only.
10. **BE-11 / BE-12** New `GET /reviews/admin` (`VIEW_REVIEWS`): cross-tour, all statuses,
    with `status`, `tourId`, `operatorId`, `rating`, `hasPhotos`, `locale`, `from`, `to`,
    `search` (reviewer name + comment), plus tour title, operator name and booking
    `displayRef` on each row. Add `PATCH /reviews/bulk-moderate` for bulk approve.
11. **BE-13** New `GET /reviews/operator` (operator-scoped, resolved via
    `resolveOperatorId`) returning their own tours' reviews plus a small analytics block.
12. Migration + `pnpm prisma:generate`. Backfill `source = NATIVE`, `verified = true`.

**Constraint reminders:** always `select:` in Prisma queries, log every mutating admin
action, DTO per request body, static routes before `:id` routes.

---

### Phase 2 - The collection flow (backend + frontend) - **the headline gap**

This is the piece the whole module is waiting on.

**2a. Token and submission API (backend)**

1. New `ReviewInvitation` model: `bookingId @unique`, `token` (random, non-enumerable,
   like `public_ref`), `sentAt`, `remindedAt`, `completedAt`, `revokedAt`. Single-use.
2. `GET /reviews/invitation/:token` (`@Public()`): resolves the token to a safe payload
   (tour title, hero image, tour date, guest first name). 404 on used, revoked or unknown.
3. `POST /reviews/invitation/:token` (`@Public()`): **step-1 commit**. Creates the review
   with the rating only, marks the invitation used, returns the review id. Reuses the
   existing booking gate (status, experience passed, one-per-booking), but authenticates
   by token instead of by session.
4. `PATCH /reviews/invitation/:token` : progressive enrichment (text, photos, guest type).
   Allowed only while the review is `PENDING` and only from the same token.
5. `POST /reviews/invitation/:token/photos` (D4): token-scoped upload, mimetype and size
   capped, `reviews/` folder, NSFWJS band routing.
6. Private recovery channel: `POST /reviews/invitation/:token/feedback` writes a support
   note and notifies support. **Never** substitutes for the neutral Trustpilot step.

**2b. Scheduling and email (backend)**

7. New email template `review-request.template.html`, built as a **sibling of the booking
   confirmation and pre-tour reminder** (`src/mail/templates/`), following the existing
   shell. 7 locales. Register `sendReviewRequestEmail` in `MailService`.
8. New job in `src/workers/`: hourly (not nightly, because the send is time-of-day
   anchored), selects bookings whose `tour_end_datetime` in the **snapshotted
   `tourTimeZone`** puts them at ~10:00 the following local morning, with no invitation
   sent, and whose status is not cancelled / forfeited / operator-cancelled / no-show.
   Creates the invitation and sends. Idempotent on `ReviewInvitation.bookingId`.
9. Reminder pass at 5-7 days: one only, WhatsApp where opt-in exists, else email. Then
   stop. Never fires if `completedAt` is set.
10. **Env vars**: any new secret (translation key, WhatsApp template id) is a **three-file
    change** - `env.validate.ts` plus both backend `.env` examples, same commit.

**2c. The review page (frontend)**

11. New route `app/(frontend)/[locale]/review/[token]/` - progressive disclosure exactly
    per requirements §4.2. Step 1 commits on tap. Steps 2, 3, 3b are skippable and each
    saves independently, so an abandon after step 1 still counts.
12. Step 4 is the **neutral** Trustpilot invitation shown to everyone, with the private
    recovery prompt shown **additionally** (never instead) on a low rating.
13. Dictionary strings in all 7 locales with a working `dict` fallback. Motion per the
    sitewide standard (no `whileHover`; press = `whileTap` scale down; constants from
    `lib/motion.ts`).
14. **FE-12** "Leave a review" entry point on `app/(login)/[locale]/bookings/page.tsx`
    for completed bookings, linking to the same tokenized page.

**Verify:** seed a completed booking, run the job manually, receive the email, complete
each step independently, confirm one review per booking and a dead token afterwards.

---

### Phase 3 - Dashboard moderation module

Follow the dashboard conventions exactly. The reference module is **destinations**; the
queue shape to copy is **cancellations / spotlight** (three inboxes, one pattern).

1. **DASH-1** `types/review.ts` - entity, `ReviewsQueryParams`, `PaginatedReviews`,
   `ModerateReviewPayload`, `RespondPayload`.
2. **DASH-2** `lib/api/reviews.ts` - a plain object of methods over `apiFetch`
   (`getAll`, `getById`, `moderate`, `bulkModerate`, `respond`, `remove`, `flagResolve`,
   `setThemeTags`, `feature`). Cache busting is automatic inside `apiFetch` because
   `case 'reviews'` is already mapped.
3. **DASH-3** `hooks/reviews/use-reviews.ts` - `reviewKeys` factory,
   `placeholderData: keepPreviousData` on the list, invalidate `reviewKeys.all` + the
   detail on every mutation.
4. **DASH-7** Add `REVIEW_STATUS` to `components/common/status-maps.ts`
   (pending → warning, approved → success, held → info, rejected → danger).
5. **DASH-4** `components/reviews/`:
   - `reviews-list-view.tsx` - owns `useTableState()`; default the queue to
     `status=PENDING` as a **filter default, not a hard exclusion**, exactly like
     `bookings-list-view.tsx:49`
   - `reviews-table.tsx` - `DataTable` with toolbar (search + status + rating + tour)
     and `bulkActions` (bulk approve, gated on `APPROVE_REVIEW`)
   - `review-columns.tsx` - 7 columns to match the existing `loading.tsx`: select,
     rating, reviewer, tour, status, submitted, actions
   - `review-detail-sheet.tsx` - full text, photos, booking / tour / operator links,
     moderation log, flags, response box, theme tags
   - `review-moderate-dialog.tsx` - approve / hold / reject, **rejection reason
     required**, policy-ground picker (never "negative")
   - `review-delete-dialog.tsx`
6. **DASH-5** Replace the stub page with the server shell + list view. **No `lg:p-8`.**
7. **DASH-6** Add the nav entry under **Operate** with
   `permissions: [Permission.VIEW_REVIEWS]` and `icon: StarIcon` (already imported), remove
   the "blocked on A2" comment, and add a `PendingReviewsBadge` to `NAV_BADGES` following
   `CancellationsBadge`.
8. **DASH-8** Role-shape the same screen: an operator sees only their own tours, no
   approve/reject, response + flag only.
9. RBAC gating: list on `VIEW_REVIEWS`, approve/hold/reject on `APPROVE_REVIEW`, theme
   tags and feature on `EDIT_REVIEW`, delete on `DELETE_REVIEW`. Gated actions are
   **absent, never disabled**.

---

### Phase 4 - Finish the tour-page display (frontend)

1. **FE-3** Make the star chart clickable (LD31): a bar click sets a `rating` filter and
   refetches page 1. Show an active-filter chip with a clear affordance.
2. **FE-4** Gate the sort control at >= 10 reviews and the filter bar at >= 20 (LD30).
3. **FE-5** Per-card "Verified booking" badge + the tooltip copy.
4. **FE-7** LD11 and low-volume copy variants driven by the summary endpoint's `source`.
5. **FE-8** Travel month and guest type on each card.
6. **FE-10** Gate the photo strip on `photoReviewCount >= 3` and make it a carousel.
7. **FE-2** `Product` + `Offer` + `AggregateRating` + `Review` JSON-LD, server-rendered,
   emitted **only at >= 3 approved reviews**, only for the reviews actually rendered, and
   **never** for the LD11 operator fallback.
8. **FE-11** (needs D3) "How we handle reviews" explainer + link it from the trust
   sub-line.
9. **FE-9** Theme chips above the cards, from `themeTags`, filtering client-side.

> Rule reminder: this phase **wires what the page already renders** plus the explicitly
> specced LD items. Do not invent new sections. FE-11 and FE-13 are new surfaces and need
> approval (D3).

---

### Phase 5 - LD32 translation (backend + frontend)

1. Provider decision (paid API vs self-hosted OPUS-MT / LibreTranslate).
2. `POST /reviews/:id/translate` (admin) and an automatic translate-on-approve path that
   fills `ReviewTranslation` for the other 6 locales with `isMachineTranslated = true`.
   BullMQ job, batched, cached, never re-translating an unchanged source.
3. Frontend: per-card "Translated by …" label + **show-original toggle**. Translate in
   place; no indexable per-review translation URLs.

---

### Phase 6 - Trustpilot platform layer (advisory phase 2)

The read side already exists (`platform-reviews` module + homepage `Testimonials`, gated
at > 100). What is missing is the **invitation** side.

1. One `island.tours` profile, service reviews only.
2. Trustpilot Invitations API integration, fired from **our** flow at step 4, with the
   tour and operator carried as **private tags** for internal analytics only.
3. Neutral for every customer, no sentiment routing, no incentives (compliance §5).
4. Frequency cap: once per customer per quarter. Never double-send; disable Trustpilot's
   own parallel automation.
5. Footer mini-badge and checkout trust area. **Never a tour page.**
6. Claim Google store ratings past ~100 eligible reviews at >= 3.5.
7. **FE-13** (needs D3) the attributed, volume-gated homepage tour-quote strip.

---

### Phase 7 - Depth and operator partnership (advisory phases 3-4)

Traveler-type / with-photos / language filters past the LD30 gates - photo-forward cards -
AI summaries and AI theme chips at 30 reviews (LD28) - helpful votes with identity
binding - **DASH-9** operator analytics (rating trend, review velocity, theme breakdown,
and the eligibility metrics the nightly job already computes) - the LD37 switch to
moderated operator-authored responses.

---

## 5. Cross-cutting rules this module must respect

- **Cache.** Every review mutation busts its tag. `reviews` + `tour:<id>` + `tours` +
  `search` (tour cards show the rating). `lib/cache-tags.ts` must stay byte-identical in
  both repos; if a tag is added, ship the public site first.
- **Timezone.** Review eligibility and the send schedule use the booking's snapshotted
  `tourTimeZone`, never a universal `America/Curacao` fallback.
- **Aggregates.** Only `APPROVED` and `source = NATIVE` records feed any aggregate.
- **Audit.** Every status change writes a log row in the same transaction.
- **New env var = a three-file change** in the same response.
- **No em dashes** anywhere in code, comments or UI copy.
- **Dynamic content needs a seed and a `dict` fallback** in all 7 locales.
- **Tours have no FAQs** - do not let the review work reintroduce one.
- **Frontend:** Tailwind classes only, `it-section` / `it-container`, colors tokenized and
  type metrics inline in px, `bg-it-border` on every photo container, Figma SVGs via
  `next/image`, motion from `lib/motion.ts`.
- **Dashboard:** compose the existing kit (`DataTable`, `EntityTabs`, settings fields,
  `ImageSelectorField`); never hand-roll `useReactTable`; no `lg:p-8` in pages.
- **Update the tracking docs in the same response** as the implementation work.

---

## 6. Test plan (run after the module is complete)

| Layer | What to test |
|---|---|
| Backend unit | LD11 resolution table (already covered), aggregate recompute including distribution and photo count, banned-word screen, moderation state machine including `HELD`, audit-log write on every transition |
| Backend e2e | Booking gate matrix: not owner / wrong status / before the experience date / duplicate booking. Token lifecycle: valid → used → dead. Operator cannot delete or unpublish. Operator cannot read another operator's reviews. Only `APPROVED` + `NATIVE` reach aggregates. Bulk moderate. Test DB `island_tours_test`, provision users through the Better Auth internal adapter |
| Job | Send window per timezone, suppression matrix, idempotency (run twice → one invitation), reminder fires once and never after completion |
| Dashboard e2e | Playwright: queue defaults to pending, approve / hold / reject with a required reason, bulk approve, RBAC (operator sees no approve button), pending badge count |
| Frontend | Threshold rendering at 0 / 1-2 / 3-9 / 10-19 / 20+ reviews. Clickable star chart filters. LD11 fallback copy. JSON-LD emitted only at >= 3 and only for visible reviews. Submission flow completes from step 1 alone |
| Compliance | A 1-star review is published and visible. Trustpilot step is shown on every score. No Trustpilot element on any tour page. Verification disclosure links to the explainer |
