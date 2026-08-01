# Test Report Fixes - "Copy of Island Tours" (QA round, fixed 2026-08-01)

Each numbered issue below maps 1:1 to the findings in
`technical-doc/test-reports/Copy of Island Tours.pdf` (same folder, `.md` export
alongside). Per fix: what the tester saw, the root cause found in code, the
change made, and how it was verified.

---

## 1. Language switcher - "Takes a long time to switch languages"

**Root cause.** Both language selectors (navbar + footer) navigated with
`router.push()` only at the moment of the click, with no prefetch. The target
locale's route payload was fetched from the server after the click - a full
RSC roundtrip on the live site, so the UI sat dimmed for seconds.

**Fix.**

- New shared hook `frontend/lib/i18n/use-locale-switch.ts` - owns the
  path-segment swap, the `NEXT_LOCALE` cookie write, and the transition push.
- `prefetchLocales()` warms the other 6 locale variants of the current page
  **the moment the menu opens** (`router.prefetch`, Next 16). By the time the
  reader picks a language the route is in the router cache and the switch
  commits near-instantly; dynamic holes stream into their skeletons.
- Both selectors (`components/frontend/navbar/locale-selector.tsx`,
  `components/frontend/footer/footer-selectors.tsx`) now consume the hook -
  the duplicated switch logic is gone.

**Verified.** Type-check clean; the switch itself exercised in dev (587ms
commit even uncached). Note: Next only enables prefetching **in production**
(link.md: "Prefetching is only enabled in production"), so the prefetch win is
invisible on the dev server by design - on the deployed site the per-locale
static shells are prerendered and the menu-open prefetch makes the switch
commit near-instantly.

---

## 2. Mobile navbar - "Alignment issue" (globe / account / hamburger)

**Root cause.** Not a centering bug (all icons shared cy=32px) - a **size
mismatch**: globe and account icons render at 18px, but the mobile search icon
and the lucide hamburger rendered at 24px. The odd sizes read as a broken
baseline (the tester's red line). The design mockup's nav-right icons are a
uniform 18px.

**Fix (two parts).** `components/frontend/navbar/navbar.tsx`:

1. Size: mobile search icon `size-6 -> size-5`, hamburger/close
   `size={24} -> size={20}` (20px matches the optical weight of the 18px
   stroked icons beside them; mockup has no hamburger to mirror exactly).
2. The REAL vertical offender, found on re-test: the hamburger button was a
   default inline button, so its icon sat on the TEXT BASELINE - measured
   cy=29 while every other nav element centered at cy=32. Added
   `flex items-center` to the button.

**Verified.** Measured at 399px on home + destination page: every icon in the
cluster now centers at exactly cy=32.

---

## 3. Tour page "Photos from Guests" - cropped, no lightbox, not draggable

**Root cause.**

- Strip tiles were 80px **circles** (`rounded-it-full` + `object-cover`) - a
  circle crop hides roughly half of every photo.
- Tiles were plain `<div>`s - nothing opened a full-size view (only photos
  inside review cards had a per-card lightbox).
- The strip hid its scrollbar but had no mouse drag support, so on desktop it
  looked frozen. Worse: dragging over an `<img>` starts a **native HTML
  drag-and-drop**, which cancels the pointer stream - so even the existing
  drag-scroll hook could never have worked over photos.

**Fix.** All in `components/frontend/tour/tour-reviews-section.tsx` +
`hooks/use-drag-scroll.ts`:

- Strip tiles are now 4:3 rounded tiles (`aspect-[4/3] h-20 rounded-it-md`,
  same vocabulary as the review-card tiles) - minimal crop, and each is a
  button that opens the photo full-size.
- New shared `PhotoLightbox` (used by the strip AND the review cards - the
  card's old inline overlay was replaced): full image `object-contain`,
  backdrop click + Escape close, and for multi-photo sets prev/next arrow
  buttons, ArrowLeft/ArrowRight keys, and an "n / total" counter.
- `useDragScroll` now attaches to the strip and to every review-card photo
  row, and the hook gained a `dragstart` preventDefault so native image
  dragging can never kill the gesture again (this also future-proofs every
  other consumer of the hook).
- Removed `scroll-smooth` from the strip - it turned each drag-frame
  `scrollLeft` write into a competing smooth animation that the scroll-snap
  then yanked back to 0.
- New dict keys `photoPrev` / `photoNext` in all 7 locales
  (`destination.tour.reviewsSection`).

**Verified.** In-browser: drag scrolls the strip (and suppresses the click
that follows), tile click opens the lightbox, Next click -> "2 / 9",
ArrowRight -> "3 / 9", ArrowLeft -> back, Escape closes. Touch swipe is native
scrolling and was left untouched.

**Follow-up (founder, 2026-08-02).** Two revisions on review:

- Tiles back to **80px circles** (`rounded-it-full`) - the founder prefers the
  circle look; the lightbox showing the full uncropped photo answers the
  original cropping complaint. Slide + click-to-open stay exactly as built.
- The strip now shows **every** guest photo for the tour, not just those on
  the first loaded page of reviews: `TourReviewsBlock` runs a parallel
  `withPhotos: true` fetch (new param on the cached `getTourReviews` loader)
  and passes the aggregated `stripPhotos` down; the loaded-page aggregate is
  only the fallback. `PHOTO_STRIP_LIMIT` (12) moved to `lib/api/reviews.ts` -
  importing it from the 'use client' component gave the server a
  client-reference proxy instead of a number, which broke the whole section.
  Verified: 12 circle tiles render on a tour whose first page held only 2
  photos; lightbox counter reads "1 / 12".

---

## 4. Destination page - "NO bottom-padding" under Curated Collections

**Root cause.** Destination-page sections chain with **top padding only**
(`pt-11 md:pt-14` each). The section that normally closes the white zone
before the grey FAQ band is the Instagram feed (`pb-11 md:pb-16`) - but when
the feed is disabled it renders `null`, leaving the Curated Collections cards
flush against the grey band.

**Fix.**

- `components/frontend/destination/destination-collections.tsx`: the section
  now carries `pb-11 md:pb-16` and closes the white zone itself.
- `components/frontend/instagram/instagram-section.tsx`: drops its own top
  padding **only when it directly follows the collections section** via the
  Tailwind arbitrary variant `[#collections+&]:pt-0` (compiles to
  `#collections + section... { padding-top: 0 }`), so the gap stays single
  whichever subset of the two sections renders.

**Verified.** Computed `padding-bottom: 64px` on `#collections`, screenshot of
the white-to-grey transition, and the compiled sibling rule confirmed in the
served CSS.

---

## 5. Booking cancellation - no confirm prompt, no restore path

**What the audit found.** The "no confirmation prompt" half was already
covered better than the report suggests: the traveller flows never cancel on
click. The account panel opens an inline confirm strip ("Cancel {tour},
{date}? Refund {amount}" + "Yes, request cancellation" / "Keep my booking" -
the exact screen in the tester's screenshot), the email-link /cancel page is
itself a confirm card, and both only ever submit a **request** an admin
processes. The admin dashboard's "Mark cancelled" also already sits behind a
ConfirmDialog that spells out the refund verdict. The REAL gap was the second
sentence: once the flow ran, **nobody had a way back** - the traveller could
not withdraw a pending request, and the admin could not reverse an executed
cancellation.

**Fix - traveller can withdraw a pending request.**

- Backend `POST /bookings/typ/:publicRef/cancellation-request/withdraw`
  (`withdrawCancellationRequest`): same traveler-session ownership gate and
  human-pace throttle as the request; clears `utcCancellationRequestedAt`
  while the request is still pending; idempotent when nothing is pending;
  refuses once the booking is CANCELLED. Notifies the exact audience the
  request notified - admin FIRST ("do not process the earlier request"),
  traveller ack ("Your booking stands"), operator heads-up - plus a
  `BOOKING_CANCELLATION_WITHDRAWN` inbox event (platform / CANCELLATIONS /
  EDIT_BOOKING, the counter-notice to the request event).
- Frontend: new same-origin proxy `app/api/traveller/cancellation-withdraw`
  (HttpOnly session never reaches the page - same pattern as the request
  proxy), `withdrawCancellationClient`, and a "Keep my booking - withdraw the
  request" button on the account panel's requested state
  (`traveller-cancel-panel.tsx`). Dict keys `cancelWithdraw` /
  `cancelWithdrawing` in all 7 locales.

**Fix - admin can restore an executed cancellation.**

- Backend `POST /bookings/:id/restore` (`MANAGE_BOOKINGS` route gate + an
  in-service ADMIN re-check, mirroring cancel's conflict-#2 boundary):
  re-takes the seats with the same guarded conditional update the reserve
  path uses (never overbooks resold capacity; exclusive charters require the
  departure still empty), flips booking + unit items back to CONFIRMED,
  clears every cancellation stamp (incl. the operator-report pair, so the
  cancellation-rate metric stops counting it), reinstates a REVERSED
  settlement to RECORDED with its net obligation recomputed, re-sends the
  confirmation email, emits a `BOOKING_RESTORED` inbox event (operator /
  BOOKINGS) and the availability fan-out, and recomputes customer aggregates.
- Hard refusals, each with its own message: refund settled or in flight
  (money went back - rebook instead), departure already ran or was itself
  cancelled, booking forfeited (terminal by policy), seats resold, or the
  booking was only ever a hold. Restoring an already-CONFIRMED booking is an
  idempotent no-op.
- New Prisma migration `20260801130000_booking_restore_withdraw_inbox_events`
  (additive `InboxEvent` values only - applied with `migrate deploy`, no
  reset).
- Dashboard repo (`tripwheel-x-islandtours-dashboard`): "Restore booking" row
  action on CANCELLED, non-forfeited bookings (MANAGE_BOOKINGS-gated) with a
  ConfirmDialog explaining exactly what restoring does, wired through
  `bookingsDashboardApi.restore` + `useRestoreBooking`.

**Verified.** Live against the dev backend: withdraw without a session 401s;
rapid repeat hits the 1-per-10s throttle; request -> stamp set -> withdraw ->
`{ withdrawn: true }` and the DB row back to CONFIRMED with the stamp
cleared; restore without auth 401s. All three repos type-check clean.

**Security review (2026-08-01) - findings fixed before commit:**

- [High] Double-restore race: two racing restores could both pass the
  pre-transaction status check and double-count the departure's seats. Fixed
  with a guarded `updateMany({ where: { id, status: CANCELLED } })` status
  flip FIRST inside the transaction - the losing racer matches 0 rows and
  409s before touching seats.
- [Medium] Double-withdraw race could send the 3-notice trio twice. Fixed
  with the same idiom on the stamp clear; only the winning call notifies.
- [Low] Client-side locale cookie writers now append `;secure` on https
  (`use-locale-switch.ts` + the pre-existing `login-locale-switch.tsx`),
  matching the server-side setter in `proxy.ts`.
  No auth-layer findings: ownership gates, admin double-gating and the
  refund/departed/forfeited refusals were all confirmed correct.

**Code review (2026-08-01) - findings addressed before commit:**

- [Critical] An external formatter/session sweep had demoted `font-normal` /
  `font-medium` / `font-extrabold` to `font-normal` across the working tree.
  Every demotion inside this wave's files was reverted to the design-v2
  weights (reviews h2/rating/names, Instagram handle + link, cancel-strip
  copy, active locale/currency menu items). NOTE: the same sweep also touched
  `checkout-*.tsx` files outside this wave - flagged, not touched here.
- [Critical] Test coverage: 21 new unit specs for `restore` (11: role gate,
  idempotency, hold-only/forfeited/departed/refunded/race/resold/
  departure-cancelled refusals, stamp-clearing flip, settlement reinstate,
  exclusive-charter claim) and `withdrawCancellationRequest` (7: guarded
  consume + notice order, quiet-success paths, cancelled 409, session gates,
  404). Backend suite: 2193 tests / 98 suites green.
- [Minor] Dashboard `canRestore` now also requires `utcConfirmedAt` (a
  cancelled checkout hold gets no Restore action); the load-bearing inline
  focus ref in `PhotoLightbox` got a do-not-stabilize comment.
- Deferred (pre-existing, project-wide patterns - not new to this wave): the
  four `app/api/traveller/*` proxies discard the backend's refusal message
  (generic "try again" even for permanent refusals; needs an i18n decision to
  fix properly), and dashboard booking mutations type their responses as
  `BookingListItem` while the backend returns the narrower `mapBooking` shape.

