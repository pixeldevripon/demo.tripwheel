# Review Module - System Requirements

> Derived from four source docs, read in full on 2026-07-22:
> - `technical-doc/island-tours-platform-master.html` (v1.9) - **canonical, wins every conflict**
> - `technical-doc/reviews/island-tours-review-strategy.html` (advisory v0.2)
> - `technical-doc/reviews/island-tours-review-strategy-verification.html` (adversarial fact-check of v0.1)
> - `technical-doc/reviews/island-tours-review-system-build-vs-buy.html` (build vs buy)
>
> Companion docs: `REVIEW-MODULE-PLAN.md` (how we build it) and
> `REVIEW-MODULE-CHECKLIST.md` (trackable task list).

---

## 0. The one-paragraph version

Island Tours runs a **two-layer trust model**. Layer one is a **first-party,
booking-gated tour review system** that we own end to end: it powers tour pages, card
ratings, tier eligibility, quality score, and structured data. Layer two is
**Trustpilot**, used only for *platform* service reviews on one `island.tours` profile,
shown on the homepage, footer and checkout, and **never on a tour page**. The two are
never merged, never share an aggregate, and never share a surface. The build-vs-buy
research is unambiguous: there is no product to buy and no open-source system to fork,
so we build. Most of the *display* is already built; the *collection* side does not
exist at all, and that is the highest-leverage gap.

---

## 1. What the client actually wants

Stripped of the advisory prose, the client wants nine concrete things.

| # | What the client wants | Why |
|---|---|---|
| 1 | **Every review tied to a real, paid booking.** "Every review from a confirmed booking. No exceptions." | It is the differentiator for an unknown brand and the whole reason the asset is believable |
| 2 | **A post-tour review request that actually goes out.** Email the morning after, one WhatsApp reminder at 5-7 days, then stop | This does not exist today. Nothing in the platform asks a guest to review. Every locked display decision is waiting on it |
| 3 | **A one-tap review page** that commits the star rating immediately, then optionally asks for text, photos and guest type | Completion rate. A one-tap review still counts |
| 4 | **An admin moderation queue** with approve / reject / hold, a policy-only removal rule, and a full audit trail | Compliance (EU Omnibus) plus the trust promise |
| 5 | **Operators get visibility and a voice, never control.** Read their own reviews, submit a response through moderation, flag for policy review. No delete, no unpublish, no edit | If buyers suspect operators scrub bad reviews, every five-star rating becomes worthless |
| 6 | **Tour pages that sell with reviews**: preview module above the fold, meta-row rating with operator cold-start fallback, a clickable star chart, verified badge per card, photos, machine translation | This is where the booking is decided |
| 7 | **A homepage that sells platform trust, not tour trust.** Trustpilot aggregate + booking-experience quotes, gated at 100+ platform reviews | The homepage job is "choose an island", not "book this tour" |
| 8 | **Legally clean.** Disclose how we verify, publish negatives, never gate the invitation on sentiment, never blend external ratings into the tour aggregate | EU Omnibus Directive; and the same rules convert better |
| 9 | **SEO payoff.** `Product` + `AggregateRating` + `Review` JSON-LD rendered server-side from our own data, only for what is visible on the page | Review text is the unique, refreshing, long-tail content the tour page otherwise lacks |

### The one thing to do first

Close the **collection gap**. The post-tour invitation is the highest-leverage,
lowest-risk, fully additive piece of work in the entire module (advisory §12.7).

---

## 2. Locked decisions that govern this module

These come from the master and win over anything in the advisory.

| ID | Decision | Status |
|---|---|---|
| LD11 | **Provider Rating cold-start fallback.** A tour shows its own rating at >= 3 approved reviews. Below that, borrow the operator rating only if the operator has >= 10 reviews at >= 4.0 average. Otherwise show no rating | Locked |
| LD13 | Meta row: rating - badge - location, middot separators | Locked |
| LD16 | Reviews is the **seventh and final H2**, immediately before Related Tours | Locked |
| LD21 | **No per-tour FAQ.** Reviews answer suitability questions organically | Locked |
| LD28 | AI review summary **deferred to V2**, reactivates at 30 reviews on a tour | Deferred |
| LD29 | **Review preview module, three tiers.** Hidden under 3 reviews. At 3-9 reviews with aggregate >= 4.0: "What our guests say" header + two recent 4-star-plus cards. Tier 3 (AI chips) is V2 | Locked (tiers 1-2 at launch) |
| LD30 | **Sort hidden under 10 reviews, filters hidden under 20.** Default sort newest first | Locked |
| LD31 | **Star distribution chart is clickable from launch**, renders at >= 3 reviews | Locked |
| LD32 | **Review translation** via Google Translate API with a show-original toggle, cached per locale | Locked |
| LD33 | Related Tours: two independent rows, `related_tour_click` event | Locked |

### Proposed locked decisions (advisory Appendix A - not yet in the master)

| ID | Proposal | Needs |
|---|---|---|
| LD34 | Two-layer review model: first-party owns tours, Trustpilot owns platform trust, never merged | Founder approval + master diff |
| LD35 | Post-tour review request: email the morning after + one reminder at 5-7 days; tokenized progressive-disclosure page; rating required, rest optional; **neutral, non-gated** platform-review invitation | Founder approval + master diff |
| LD36 | `reviewer_type` (guest type) **collected from launch**; the consumer filter UI stays V2 | Founder approval + master diff |
| LD37 | Review response authorship: **platform-authored at launch**, moderated operator-authored from phase 4. Resolves the E.7 vs Section4_7 4.7.18 conflict | Founder approval + master diff |

> **Conflict to resolve (advisory §7.4).** Master Appendix E.7 says "operator response
> (no editing)". The canonical source Section4_7 §4.7.18 says "platform response (Island
> Tours-authored, not operator)". These contradict. Today the code implements the E.7
> reading (operator or admin can respond, with no moderation and no author label). See
> `REVIEW-MODULE-PLAN.md` §Open decisions.

---

## 3. Data model requirements (master E.7 + advisory A.1 expansion)

One record per submitted review.

| Field | Master status | In code today |
|---|---|---|
| `id` | new in A.1 | yes |
| `booking_id` unique | **LOCKED** - the verification gate, one review per booking | yes |
| `tour_id` | new in A.1 (implied by aggregates) | yes |
| `operator_id` | new in A.1 - drives LD11 Provider Rating | yes |
| `customer_id` / `user_id` | new in A.1 | yes (`userId`) |
| `tour_departure_id` | new in A.1, optional - seasonality + operator insight | **no** |
| `rating` 1-5 | **LOCKED** | yes |
| sub-ratings (value / guide / safety) | advisory phase 3 "consider", optional, never required | yes (ahead of spec) |
| `text` in original locale | **LOCKED** | yes (`ReviewTranslation.comment`) |
| `original_locale` | **LOCKED** - retained for show-original (LD32) | yes (`ReviewTranslation.locale`) |
| translation cache per locale | **LOCKED** (LD32) | table exists, **nothing populates it** |
| `travel_month`, `travel_year` | **LOCKED** - month only, privacy | yes |
| `created_at` | new in A.1 - drives newest-first (LD30) | yes |
| `reviewer_first_name`, `reviewer_last_initial` | **LOCKED** - "Ada B." only | yes |
| `reviewer_type` (couple / family / friends / solo) | LOCKED data point, **collect from launch** (LD36) | **no** |
| `photos[]` | **LOCKED** - photo carousel at >= 3 photo reviews | yes |
| `theme_tags[]` | new in A.1 - manual admin chips, pre-AI LD29 Tier 3 | **no** |
| `status` pending / approved / **held** / rejected | **LOCKED** - only approved feed aggregates | partial: no `HELD` |
| `source` enum (native + reserved import values) | new in A.1 - never blended into native aggregates | **no** |
| `verified` boolean | new in A.1 - explicit and auditable | yes (`isVerified`) |
| `response_text`, `response_author` (platform / operator), `response_at` | LOCKED with the §7.4 conflict; no editing after publish | partial: no `response_author`, no moderation, editable |
| `helpful_count` | **LOCKED, deferred to V2** | field + public increment endpoint exist (ahead of spec, and unprotected) |

**Derived, on the tour row:** `aggregate_rating`, `aggregate_review_count`,
`rating_distribution[5]`, `photo_review_count`, `aggregates_updated_at`.
**Derived, on the operator row:** `aggregate_rating`, `aggregate_review_count` (LD11 inputs).
All derive from **approved records only**.

---

## 4. Collection flow requirements (advisory §5 and §6 - the gap)

### 4.1 Trigger and schedule

| Rule | Value |
|---|---|
| Trigger | Tour completion, measured from `tour_end_datetime` in the booking's **snapshotted timezone** |
| First send | The morning after the tour, ~10:00 tour-local. **Treat as a launch default to A/B test** against day-2 / day-3 (the Journal of Marketing field study found next-day reminders *reduce* response for experience goods, more so for younger travelers) |
| Reminder | **One only**, at 5-7 days, WhatsApp where opt-in exists, else email. Then stop. Two touches maximum |
| Suppression | Never send for cancelled, forfeited, operator-cancelled, or no-show bookings. Mirrors the pre-tour reminder rules |
| Idempotency | One review per booking. The token is **single-use**; a completed review closes the invitation |
| Channels | Email primary (Resend, existing stack). WhatsApp reminder only, **requires prior opt-in captured at booking + an approved non-promotional template**. **No SMS at launch** (watch the US-traveler segment) |

### 4.2 The tokenized page (progressive disclosure)

```
STEP 1  TOUR RATING          required, one tap, COMMITS IMMEDIATELY
STEP 2  REVIEW TEXT          optional, skippable
STEP 3  PHOTOS               optional, skippable
STEP 3b GUEST TYPE           optional, one tap: Couple / Family / Friends / Solo
STEP 4  BOOKING EXPERIENCE   optional, shown to EVERYONE on the same neutral basis
        [ Leave a review on Trustpilot ]  [ No thanks ]
        if step 1 was low, ADDITIONALLY: [ Tell us privately what went wrong ]
THANK YOU + soft cross-sell
```

Same tokenized pattern as the cancellation flow (a `public_ref`-keyed page reached from
the email, no login required). **Never a payment link.**

### 4.3 The two questions, never merged

- **"How was your tour experience?"** - the first-party review. Attributed to the tour
  and the operator. Stored in our DB. Counts toward the tour rating. Steps 1-3b.
- **"How was booking with Island Tours?"** - the platform review. A **neutral**
  Trustpilot invitation. Different header, different framing, Trustpilot logo. **Never**
  touches the tour aggregate. Step 4.

### 4.4 Anti-fatigue

One invitation, one flow, one warm "how was it" moment. Frequency-cap the Trustpilot ask
to **once per customer per quarter**. Drive Trustpilot invitations from our flow, never
from Trustpilot's own parallel automation, so we never double-send.

---

## 5. Compliance requirements (non-negotiable)

> These are the requirements that changed between advisory v0.1 and v0.2. Read them
> carefully; the first one reverses a tactic.

1. **No review gating, of either kind.** Do **not** invite only happy customers to
   Trustpilot. Selective invitation breaches Trustpilot's own guidelines (sanction or
   delisting) and is the conduct the Italian AGCM fined Trustpilot 4 million euro over
   (decision PS12962). The US FTC banned it outright in 2024. **Invite every customer on
   the same neutral basis; publish every first-party review regardless of score.**
2. **A private service-recovery channel is offered *alongside* the neutral invitation,
   never instead of it.**
3. **No incentives on the Trustpilot layer.** Trustpilot bans incentivized reviews even
   though disclosed incentives are lawful under EU law.
4. **Disclose how we verify** (UCPD Art. 7(6), Omnibus). The locked sub-line "Every
   review from a confirmed booking. No exceptions." is the disclosure. Strengthen it with
   a link to a short "How we handle reviews" explainer and a per-card verified badge.
5. **Publish negatives.** Suppressing negatives while publishing positives is an unfair
   practice (Annex I 23b/23c, Arts. 6-7). It is also bad CRO: purchase likelihood peaks
   at 4.0-4.7 stars and falls toward a suspicious 5.0 (Spiegel/Northwestern 2017).
6. **Moderate on policy, not on sentiment.** Removal grounds are narrow and written
   down: fake, abusive, off-topic, or containing personal data. Never "negative" or
   "commercially inconvenient". **Every status change is audit-logged** with actor,
   timestamp and reason.
7. **Never claim false verification.** The `verified` flag and `source` enum keep this
   auditable.
8. **Label external reviews and never blend them.** Trustpilot and operator
   Tripadvisor/Google ratings never enter the tour `AggregateRating` or its markup.
9. **Privacy.** First name + last initial, travel month + year, never a full name or an
   exact date. Already locked in E.7.
10. **Jurisdiction.** The UCPD applies to practices directed at EU consumers regardless
    of where the tour runs. ITG B.V. being Netherlands-based makes the Dutch ACM the home
    regulator (Boek 6 BW arts. 6:193a-6:193j).

---

## 6. Display requirements

### 6.1 Tour page (the locked system)

| Placement | Rule |
|---|---|
| Meta row, next to the H1 | Star rating + count, LD11 Provider Rating cold-start fallback |
| Above the fold, under the gallery | LD29 preview module. **Hidden under 3 reviews.** At 3-9 reviews with aggregate >= 4.0: header + two recent 4-star-plus cards |
| Seventh and final H2 | Full Reviews section, immediately before Related Tours |
| Under the H2 | Trust sub-line "Every review from a confirmed booking. No exceptions." |
| In the section | Clickable star distribution chart from launch, renders at >= 3 reviews (LD31) |
| In the section | Sort control **hidden under 10 reviews**; filter bar **hidden under 20** (LD30). Default newest first |
| Per card | Verified-booking badge, travel month, guest type, photos, machine translation with show-original toggle (LD32) |
| Photo carousel | Activates at >= 3 photo reviews (`photo_review_count`) |
| Theme chips | Manual admin `theme_tags` at launch, AI chips at 30 reviews (LD28 / LD29 Tier 3) |
| **Never** | Any Trustpilot widget, score or badge on a tour page |

**Empty and low-volume copy:**
- 0 reviews, operator fallback active: "New on Island Tours. This tour is run by
  {operator}, rated {x.x} across {n} reviews."
- 0 reviews, no fallback: do not render an empty section or a fabricated number. Lean on
  the New badge (tour under 30 days with 0 reviews).
- 1-2 reviews: "{x.x} from {n} early reviews", no distribution chart.

**Do not** move the full reviews section higher up the page. The sticky booking widget
and the LD29 preview already keep review proof in view; burying the overview under a wall
of reviews breaks the deliberate persuasion sequence. **Do not** add a separate "Book now"
button inside the reviews section; reviews feed the always-visible widget.

### 6.2 Homepage

| Band | Rule |
|---|---|
| Micro trust bar | Locked, not review-based. Carries trust before 100 platform reviews exist |
| Social proof strip | **Trustpilot aggregate + rotating platform quotes about booking, payment and support.** Renders only at >= 100 platform reviews. Below that the band is **absent** - never a thin "based on 4 reviews" |
| Tour-quote strip | **NEW, optional, volume-gated (e.g. >= 50 approved tour reviews).** Every quote carries the tour name, a star rating, and links to that tour. Header: "What guests say about our tours" |
| Never | A generic testimonial wall that mixes tour praise and platform praise |

### 6.3 SEO / structured data

- `Product` (the tour) + `Offer` + `AggregateRating` + `Review`, rendered
  **server-side from our own data**. Never from a widget.
- Emit `AggregateRating` **only at or above the 3-review render gate**. That gate is our
  display choice, not a Google rule (Google sets no minimum).
- **Only mark up reviews that are actually visible on the page.**
- **Never** mark up the LD11 operator-rating fallback as the tour's `AggregateRating` - it
  is not the tour's rating.
- **Never** put `Review` or `AggregateRating` on `Organization` / `LocalBusiness` for
  Island Tours. The self-serving rule makes it star-ineligible, and that rule explicitly
  includes third-party widgets.
- A structured-data manual action removes rich-result eligibility only. It does not lower
  web ranking.
- Machine-translated text: keep the original available, translate in place. Do not spawn
  indexable per-review translation URLs.
- Watch-item: marking an experience up as `Product` is the industry norm and earns stars,
  but `Service` / `Event` / `TouristTrip` are not on Google's eligible list. Validate, do
  not treat as a blocker.

---

## 7. Admin and operator rights

### 7.1 Island Tours (data owner)

Moderation queue (approve / reject / hold, pending first) - view and filter by tour,
operator, rating, status, source, date, language, with-photos - link to booking, tour,
operator - trigger and refresh translation, never edit source text - tag themes - feature
and unfeature for the LD29 preview and the homepage strip - publish and unpublish **on
documented policy grounds only, with an audit log** - respond - process flags.

### 7.2 Tour operator

- **Read** their own tours' reviews and rating analytics. Never another operator's.
- **Submit a response**, which enters a moderation queue and publishes after admin
  approval. **No editing after publish.**
- **Flag** a review for policy violation. A flag is a request, never an action.
- **No delete, no unpublish, no edit of any review. Full stop.**

### 7.3 Traveler

Submit one review per booking, on a booking they own, after the experience date. View
their own reviews including pending ones. Delete their own review.

---

## 8. Trustpilot scope (the platform-trust layer)

| Question | Answer |
|---|---|
| Use Trustpilot at all? | **Yes, with discipline.** If the discipline cannot be guaranteed, skip it - a misused integration does more harm than the lift is worth |
| Primary source for tour reviews? | **Never.** Extra trust layer only |
| How many profiles? | **One**, on the `island.tours` domain. Service reviews only |
| Per-tour profiles? | **No. Emphatically.** Fragments volume into dozens of near-empty profiles |
| Per-operator profiles? | **No.** Operator reputation lives in our Provider Rating (LD11) |
| Trustpilot Product Reviews for tours? | **No at launch.** A deliberately declined option (it *can* syndicate back to our pages), redundant with the system we own. Keep open as a phase-4 option only if a paid channel demands third-party-verified tour badges |
| Tag invitations by tour/operator? | **Yes, privately.** Tag for internal analytics; display stays platform-level |
| Where do widgets go? | Homepage social proof strip (>= 100 reviews), footer mini-badge, checkout trust area. **Never a tour page** |
| Google store ratings | Claim once past ~100 eligible reviews at >= 3.5 stars (renamed from "Seller Ratings") |
| Invitation policy | **Neutral for every customer.** No sentiment gating. No incentives |

---

## 9. Build vs buy - settled

**Build first-party.** Confirmed from four research angles:

- **Nothing to buy.** Review SaaS is built for Shopify e-commerce or for hotels. The few
  with a real headless API (REVIEWS.io, Yotpo, PowerReviews, Bazaarvoice) cannot do
  tour-plus-operator attribution natively, price per booking (the wrong cost curve for a
  marketplace), and some keep a perpetual licence on review content after cancellation.
- **Nothing to fork.** No production-grade standalone open-source review system exists for
  a Node/Postgres stack in 2026. What exists is welded to a commerce platform (Medusa,
  Sylius, Shopware) or is a single-digit-star solo project.
- **Structural reason buying loses.** Verified-booking gating requires reading our booking
  graph. A drop-in widget structurally cannot. This is why Viator, GetYourGuide,
  Booking.com, Airbnb and Etsy all build first-party.
- **SEO reason buying loses.** Google's self-serving rule means widget reviews earn no
  stars. The only route to legitimate stars is server-rendered markup on the tour, from
  our own data.
- **GDPR reason.** EU customers' review text and photos in our own EU-region database is
  materially cleaner than a US SaaS under a live "Schrems three" risk.
- **Tour software is a dead end too.** FareHarbor, Rezdy, Bokun, Checkfront, TourCMS,
  Peek Pro, Ventrata and TrekkSoft expose no review content to a reseller, and the OCTO
  standard has no reviews capability at all. Google Places, Tripadvisor and Viator content
  APIs forbid storing or indexing the reviews (Tripadvisor even forbids showing them
  alongside your own).

Useful building blocks to borrow rather than write: `obscenity` (MIT, profanity, defeats
obfuscation - avoid the abandoned `bad-words`), NSFWJS (image moderation, tuned so beach
photos are not rejected), Detoxify or the TF.js toxicity model as an optional sidecar, and
OPUS-MT / LibreTranslate self-hosted vs a paid API for translation. Data-model and
moderation-workflow references: the Medusa v2 product-reviews plugin and Sylius reviews
(both MIT).

---

## 10. Benchmark - what the big OTAs do

| Platform | Verification | Invitation | Filters |
|---|---|---|---|
| Viator | Mostly verified booking, **plus an ungated Tripadvisor-account path** | Post-experience email + text | Rating, traveler type, language, keyword |
| GetYourGuide | Verified **purchaser** (some non-completers allowed) | Post-activity email + 2 reminders | Rating, traveler type, language |
| Booking.com | Verified stay | ~48h after checkout, 3-month window | Subscores, traveler type, language, period |
| Airbnb | Verified stay, double-blind 14 days | Both parties prompted | Rating, keyword, recency |
| Tripadvisor | **Open, not purchase-verified** (the outlier, widely seen as gameable) | Solicited + organic | Rating, traveler type, language, season |

**Patterns worth copying:** verified purchaser is the standard (our "confirmed booking, no
exceptions" sits at the strict, trustworthy end and is a genuine differentiator) - theme
chips and review summaries above the cards (GetYourGuide shipped consumer-facing AI review
summaries in 2026) - a timed post-experience invitation (**universal; we have none**) -
traveler-type filtering everywhere (hence: collect guest type from day one) - homepage
social proof is platform-level while tour reviews are product-level (**none** of them
dumps raw tour reviews on the homepage as brand testimonials).

---

## 11. Phased roadmap (advisory §12.6)

| Phase | Scope | Outcome |
|---|---|---|
| **1. MVP** | Expanded schema (guest type, source, verified, held, audit) - **post-tour collection flow** (email + WhatsApp reminder + tokenized page, steps 1-3b) - locked tour-page display (LD29 preview, LD11 fallback, Reviews H2, clickable star chart, translation) - admin moderation queue + audit log - verification disclosure (linked sub-line + per-card badge) | Every completed tour can produce a verified, moderated, displayed review |
| **2. Trustpilot** | One `island.tours` profile - step 4 of the collection flow with a **neutral** invitation, frequency cap and private tour/operator tagging - homepage social proof strip at 100 reviews, footer and checkout widgets - claim Google store ratings | External platform credibility, tour pages untouched |
| **3. Depth** | Traveler-type / with-photos / language filters past the LD30 gates - photo-forward cards and the >= 3 photo-review carousel - AI summaries and AI theme chips at 30 reviews (LD28) - optional subscores | The mature, high-CRO experience at volume |
| **4. Operators** | Operator dashboard: read access, response submission through moderation, flag-for-review - **switch responses from platform-authored to moderated operator-authored (LD37)** - rating trends, theme breakdown, review velocity, eligibility metrics surfaced back | Operators are partners in review quality; the Island Tours team is out of the per-review response loop |

---

## 12. Statistics, stated correctly

The verification pass corrected several mis-attributions. Use these forms if any of this
copy reaches a page or a deck.

- "96% of shoppers look for negative reviews **at least sometimes**" - PowerReviews 2021
  (not Bazaarvoice, not Baymard).
- "52% specifically seek out one-star reviews" - PowerReviews 2021. Drop the word "first".
- Reviews are "the most influential factor in purchase decisions" - PowerReviews 2023.
  Not "the number one conversion driver".
- Baymard's 95% is "relied on reviews **to learn more about products**", a UX lab
  finding, not purchase-decision reliance.
- "Shoppers who interact with review photos and video convert about twice the baseline"
  (~104% lift, PowerReviews 2022) and "about 77% seek out customer photos". Drop
  "photos beat text".
- Purchase likelihood peaks at 4.0-4.7 stars then falls toward 5.0 - Spiegel Research
  Center, Northwestern, 2017. The "+67% lift" figure is Reevoo 2012, not Northwestern.
- Trustpilot scale: roughly **350 million reviews across about 1.3 million businesses**
  (early 2026), not 200m / 900k.
- Google renamed "Seller Ratings" to **"store ratings"**.
- The "98% SMS open rate" figure is not a measured statistic. Do not cite it.
