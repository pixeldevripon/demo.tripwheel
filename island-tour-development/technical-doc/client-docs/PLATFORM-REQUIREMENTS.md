# Island Tours - Platform Requirements

Island Tours is a Caribbean tour and activity marketplace built on a "Built by Islanders" ethos: local curation as the ethical, locally owned alternative to the global booking sites. Travellers browse island by island, compare real tours, and book and pay instantly - there is no enquiry form and no waiting for an operator to reply. Island Tours is a reseller, not the tour provider: local operators supply the experiences, and the platform earns a commission on every booking.

The platform launches across three Caribbean islands in seven languages, with a discovery structure built for search visibility, a booking flow built for conversion, and a commercial model built so that local operators can choose how visible they want to be without the platform ever faking scarcity, inflating badges, or hiding a price.

This document describes the platform as it is intended to work: the business model, the people who use it, the pages, the booking journey, and the tools behind it.

---

## 1. Business model

Island Tours is a three-sided marketplace. Travellers discover and book. Local operators supply the tours. Island Tours takes a commission per booking, locked onto the booking record at the moment it is created so that later changes never affect money already earned. There is no auction and no limited set of "featured slots" - placement is a straightforward commercial choice from a published set of tiers, sitting on top of a single quality bar.

### 1.1 Commission tiers

Operators choose a commission tier per tour. The tier determines where the tour sits in listing order, and it also determines how much deposit the traveller pays at booking.

- **Premium - 30% commission** - ranks first.
- **Featured - 27.5%** - ranks second.
- **Boosted - 25%** - ranks third.
- **Organic - 22.5%** - ranks fourth.
- **Standard - 20%** - the default for every new tour, and the rate for operators on a negotiated 20% agreement. Ranks fifth.

Rules attached to tiers:

- Standard deliberately ranks below Organic. A 20% operator who wants to outrank other base-rate tours moves up to Organic at 22.5%.
- Within a tier, tours are ordered by a quality score recalculated nightly.
- A tier change locks the tour for **30 days**; further changes are rejected until the lock expires.
- Tiers are eligibility-gated. A tour that falls below the quality bar is notified, given a **30-day grace period**, and then automatically moved down to the highest tier it still qualifies for.
- Existing bookings always keep the commission they were booked at. Tier changes are never retroactive.
- **Tier names and percentages are never shown to travellers.** They are internal commercial logic.
- A tour with no bookable departure in the next 30 days drops out of ranked results and is not billed for its tier during that period.

### 1.2 Destination Spotlight

- A separate premium placement at **35% commission**.
- Appears in its own block on the destination page, never mixed into normal listings.
- **Maximum 3 active spotlights per destination.**
- Operators request it; Island Tours approves it manually. It is never self-serve.
- A request made when 3 are already active is rejected and queued for manual approval when a place frees up.

### 1.3 Paid placement is always labelled

Transparency is a brand pillar. Any tour appearing in a paid tier placement carries a **Sponsored** badge. There is no hidden paid placement anywhere on the platform. Editorial badges such as "Most popular" and "Locals' favorite" are awarded on merit and can never be bought.

### 1.4 Deposits by tier

The commission tier also drives the deposit percentage the traveller pays at booking, ranging from **20% to 30% in 2.5-point steps**. The operator sees this as a read-only value; they do not set it directly.

### 1.5 Affiliate program

- Run through Trackdesk.
- Affiliates earn **8% of booking value**, funded entirely out of the Island Tours commission share - operator payouts are unaffected.
- Affiliate commission is held on hold at booking and only approves once the cancellation window has closed, so cancelled bookings never pay out.
- Attribution is owned by the platform's own booking-completion event rather than a third-party pixel.
- Promo codes double as attribution identifiers.

### 1.6 Who earns what

- **The operator** earns the tour price minus the commission rate agreed for that tour.
- **Island Tours** earns the commission, out of which it funds affiliate payouts and payment processing.
- Revenue is recognised on tour completion, not at booking.

### 1.7 The four positioning pillars

- **Local curation, not an algorithmic catalogue.** Editorial picks are made by people who live on the islands.
- **Ethical conversion.** No fake urgency, no fake scarcity, no badge inflation, no dark patterns, no pre-ticked add-ons.
- **Transparency.** Total price before checkout, no hidden fees, clear cancellation terms, every claim verifiable.
- **Caribbean-proud voice.** Warm, direct, first-person plural, never corporate.

---

## 2. Destinations and languages

### 2.1 Launch destinations

Five islands exist in the system; three are live at launch, in rollout order.

- **Curaçao** - launch island, the first live destination.
- **Aruba** - second rollout.
- **Sint Maarten** - third rollout.
- **Saint Lucia** - in the pipeline, seeded but not publicly live.
- **Bahamas** - in the pipeline, seeded but not publicly live.

Destinations are grouped by region as a data attribute only; there is no "Caribbean" landing page. The structure supports unlimited expansion into other regions - Atlantic, Mediterranean, Asia, Africa - with no structural change, and supports sub-destinations (a city within an island) in future without redesign.

Launch destinations are protected: they cannot be deleted, and a destination cannot be switched off while it still has live bookable tours attached.

### 2.2 Languages

- **Seven languages from launch:** English (primary), Dutch, German, French, Spanish, Portuguese and Chinese.
- Every piece of interface copy is translated. There is no hardcoded English anywhere in the interface.
- If a translated field is missing, the English version shows in its place rather than a blank space.
- **Web addresses stay in English in all seven languages.** Only the language prefix changes. This keeps one address per page worldwide instead of seven, and matches how tourists actually search.
- The tagline "Island Tours. Built by Islanders." is a brand mark and is never translated.
- Proper nouns such as island and place names are never machine-translated.
- Translations for the six non-English languages can be generated automatically in the background once the English original is saved, and are flagged as machine-translated so an editor can review them.

### 2.3 Currency

- Prices display in **US dollars** for English and Chinese, and in **euros** for Dutch, German, French, Spanish and Portuguese.
- A **currency selector in the footer** lets the traveller override the default. The choice persists for the rest of their session.
- The currency selector never appears in the top navigation.
- Numbers are formatted for the language: `$1,234.56` for English, `€1.234,56` for Dutch and German.
- Automatic currency selection based on the visitor's country is a future roadmap item, not a launch feature.
- The currency an operator is paid in is a separate concept from the currency a traveller sees.

### 2.4 Times and dates

- Tour dates and times are always shown in the destination's local time, and labelled as local time wherever money depends on the deadline (cancellation cutoffs, balance payment deadlines).
- All deadline and transactional copy uses the **24-hour clock**.
- Copy never says "Curaçao time" - it says local time, so it stays correct as more islands go live.
- System events (payments, confirmations, reminders) are recorded against a universal clock so records stay consistent across islands, while everything a customer reads renders in island time.

---

## 3. Who uses the platform

### 3.1 Travellers

- No account is required to browse or to book. An account is created automatically on a traveller's first booking, and their sign-in details arrive by email.
- Travellers can browse and search, save tours to a wishlist, book and pay, view their bookings, cancel within the allowed window, and leave a review after the tour has happened.
- Travellers can also reach a booking without signing in, through the secure link in their confirmation email.

### 3.2 Tour operators

Operators are the local businesses supplying the tours. An operator can:

- Create and manage tour listings: photos, descriptions, pricing, inclusions, meeting points and add-ons.
- Set availability: weekly schedules, start times, seasonal closures and one-off exceptions.
- Choose the commission tier for each tour and request Destination Spotlight.
- Manage bookings for their own tours, send balance payment links, and report a traveller who did not pay the balance.
- View earnings, settlements and payout history.
- Add staff members with limited permissions.

Operators cannot create categories, activity hubs or collections; cannot set editorial badges; and cannot write or edit reviews.

### 3.3 Admins and staff

Admins run the platform. An admin can do everything an operator and a traveller can do, plus:

- Create and manage destinations, the category set, activity hubs and collections.
- Write the editorial content and FAQ blocks on every public page.
- Approve or reject Destination Spotlight requests.
- Set the "Locals' favorite" editorial flag, curate homepage and destination features, and set collection ordering.
- Moderate reviews, handle refunds and cancellations, confirm operator reports of non-payment, and grant force-majeure exemptions.
- Manage operator accounts, staff seats and permissions.

Staff members sit under an operator or under the platform with a defined role and a permission set that can never exceed the permissions of the account they belong to. Admin accounts are created by the platform itself, never by self-registration.

---

## 4. How travellers discover tours

Every island offers three parallel discovery layers plus the full catalogue. A tour belongs to exactly one destination, at least one category (one of which is its primary category), and any number of activity hubs. Whichever route a traveller takes, every tour has a single web address, so no two pages ever compete for the same search results.

### 4.1 Categories

- **19 global categories**, the same set on every island: Boat Tours & Cruises, Snorkeling, Scuba Diving, Sunset Cruises, Sightseeing, Day Trips, Off-Road Tours, Jet Ski Tours, Parasailing, Water Sports, Fishing Trips, Nature & Wildlife, Hiking, Adventure Tours, Cultural & Historical, Food & Drink, Attraction Tickets, Luxury Experiences, and Workshops & Classes.
- Categories are the search workhorse: each one owns its own editorial content about that activity on that island.
- A tour can sit in several categories where that is genuinely true - a sunset catamaran is both a boat tour and a sunset cruise.
- **Day Trips** is the one category defined by length rather than activity: roughly 6 hours or more, almost always paired with the activity category.
- **A category page only goes live once it has at least 3 published tours on that island.** Below that it is hidden from navigation, sitemaps, internal links and search results. The check runs automatically every time a tour is published or unpublished, in both directions.
- "Luxury Experiences" is the single sanctioned use of the word "luxury" on the platform. In running copy the word is banned; copy says what actually makes a tour premium - private skipper, small group, champagne.

### 4.2 Activity hubs

- A hub is anchored to a **place, a highlight or an area** - Klein Curaçao, Willemstad, the West Coast.
- Hubs carry the richest informational content on the platform: what the place is, the best time to go, how to get there, local tips, and a side-by-side comparison of the tours that go there.
- Hubs are the platform's primary paid-search landing pages.
- A hub is the only listing-type page with a full hero image, and that image must show the specific place, not a generic island shot.
- Hubs are a discovery tag only. Adding a tour to a hub never changes the tour's web address.
- Tours appear in a hub only if their category is on that hub's allowed list.

### 4.3 Collections

- A collection is anchored to a **person or an intent** - best things to do, best for couples, best for families, day trips.
- Collections cut across categories and carry editorial ranking. The order is the product.
- Collections come in two forms: a hand-picked ordered list, or a saved filter that resolves live.
- Every tour in a hand-picked collection needs a short editorial reason (maximum 20 words) explaining why it earned its place, and the collection cannot be published without one for every tour.
- **Commission never influences collection curation or order, and no Sponsored badge ever appears on a collection card.**

### 4.4 All Tours

- The full, filterable catalogue for a destination.
- A transactional utility page rather than an editorial one: it carries filters and sorting, and no long-form About content.
- Broad advertising campaigns land here; specific campaigns land on the matching category, hub or tour page.

### 4.5 Search

- Search is scoped to the current island.
- The search box sits in the navigation bar: a compact pill while the hero image is visible, expanding once the traveller scrolls.
- Typeahead suggestions appear as the traveller types, showing the same tour cards and badges as the main listings.
- Search results are not indexed by search engines and are generated fresh on every request.

### 4.6 Filters

The filter panel has six sections, and every one of them genuinely filters:

- **Price** - a slider from zero to the highest price available.
- **Duration** - four length bands, multi-select.
- **Time of day** - morning, afternoon, evening, multi-select.
- **Free cancellation window** - 24 hours, 48 hours or 72 hours.
- **Pickup available** - a toggle.
- **Ratings** - 3.0+, 4.0+ or 4.5+, hidden entirely until reviews exist.

Filter choices appear as removable pills with a "Clear all" action, and the page shows both the total available and the filtered count. Category chips in the filter row are navigation links, not filters. Filtered pages always point search engines back to the clean unfiltered address.

### 4.7 Sorting and ranking

- Listings are ordered by commission tier first, then by the nightly quality score, so a higher-paying operator gets better placement but only among tours that meet the same quality bar.
- After ranking, a diversity pass ensures **no more than two tours of the same type appear consecutively**.
- Travellers can re-sort using a small, locked set of options, including a "Locals' favorites" sort.
- The order and the badges are decided once, centrally. Listing pages never re-sort or re-badge anything on their own, so every surface agrees.

### 4.8 Badges

A tour card shows **at most one badge**, in the top-left corner.

- **Sponsored** - grey - shown on any paid-tier placement. Always shown, never hidden.
- **Most popular** - brand orange - awarded to an organic (non-paid) tour with at least 10 reviews and a rating of 4.5 or better, maximum one per category. Never awarded for commission reasons.
- **Likely to sell out** - shown only when all three conditions hold, checked daily: the tour is at least 90 days old, it has sold out at least 3 times in the past 60 days, and less than 40% of its next 30 days of capacity remains. Expected to apply to roughly 5-10% of the catalogue - the selectivity is the point. A manual override exists for launch, before any tour has 90 days of history.
- **New** - shown when a tour was published less than 30 days ago and has no reviews yet. It replaces the rating row on the card.
- **Numbered ranks 01-10** - circular badges, used only on "Best Things to Do" and "Top 10" collections. Circles mean rank; rounded rectangles mean status.
- **Locals' favorite** - a manual editorial flag set only by admins, targeting roughly 30% of the catalogue. It is never algorithmic and never linked to commission.

There is no fake urgency anywhere: no invented countdowns, no invented scarcity. Capacity messaging only ever reflects real remaining places ("Only 3 left") in the party selector.

### 4.9 Wishlist

- A heart icon on every tour card, saved without leaving the page and reflected immediately.
- A dedicated wishlist page listing everything saved, not indexed by search engines.
- The wishlist works before sign-in and carries over once the traveller has an account.

---

## 5. The pages

Two public address shapes exist: the island page, and everything below it (category, hub, collection, tour, or the full catalogue). Every address carries a language prefix and ends in a trailing slash. Tours sit flat directly under the island - there is no "/tour/" step and no nesting under a category or hub. Anything deeper is a not-found page.

### 5.1 Homepage

- **Job:** get the visitor to choose an island. One primary action, nothing else.
- Full-bleed Caribbean hero image with the locked headline "We didn't discover the Caribbean. We grew up in it." and the sub-line "Chosen by locals. Made for travelers."
- A single search field, placeholder "Which island?" - no date field on the homepage. Choosing an island navigates straight to that island's page.
- Popular quick links: Curaçao, Aruba, Sint Maarten, ordered by the admin.
- A three-column trust bar under the hero: pay as little as 20% today; free cancellation on every tour; we're locals, reachable on WhatsApp 08:00 to 20:00.
- Video carousel, social proof strip (shown only once the platform has 100 or more reviews), featured destinations, an editorial banner slot, a "Why Island Tours" block, a "Need help before booking?" block with FAQ, and the global footer.
- The homepage navigation is a reduced variant: the island selector reads "Select your island", and categories and search are hidden because there is no island context yet.

### 5.2 Destination page

- **Job:** island overview, and a route into the discovery layers or straight to a tour.
- Hero with the island image plus a search field and date field, scoped to that island and looking 12 months forward.
- Headline "{Island} tours & activities" in sentence case, with the sub-line "Tours picked by locals who know every reef, route, and sunset spot."
- Category quick links: 7 to 8 cards under the heading "Explore by type", scrolling horizontally.
- Featured tours under the heading "Locals' favorites" - two rows of three cards, drawn from the editorial Locals' favorite flag, with no numbered badges. The call to action reads "See all {Island} tours"; once the island has 20 or more published tours it includes the count, and below 20 it does not, so the page never signals scarcity.
- Instagram grid, "Need help before booking?" block with FAQ, and a 350 to 500 word "About tours in {Island}" section with exactly three sub-headings.
- Breadcrumbs sit below the hero on desktop and are hidden on mobile, replaced by a back arrow.
- No review-aggregator badge at launch, because a thin review base reads as a liability rather than a trust signal.

### 5.3 All Tours page

- **Job:** the complete filterable catalogue for the island. A transactional utility page.
- Headline "All {Island} tours & activities in {year}", where the year resolves at render time and is never hardcoded.
- An orientation line naming two locally strong tour types, editable per island.
- Page header with a static count, then the filter row (a single Filters button with an active-filter count, plus category navigation chips and sort), then the grid.
- Grid of 18 tours per page in three columns on desktop; one column on mobile with pagination after 12.
- Below the grid: pagination, then a compact trust strip of four points - free cancellation with no questions asked, pay as little as 20% today, confirmed in seconds, safe and secure checkout - plus an inline WhatsApp link.
- No long-form About block and no FAQ accordion; those belong to the destination and category pages.

### 5.4 Category page

- **Job:** the search landing page for one activity type on one island.
- Lives only once the category has at least 3 published tours on that island.
- Hero with the category headline and intro, a filter row without category chips, a single ranked grid with Sponsored and Most popular badges, that category's own About content, and related categories.
- No trust bar on category pages - a deliberate choice, not an oversight.

### 5.5 Activity hub page

- **Job:** full decision support for one place, highlight or area. The primary paid-search landing page.
- Twelve sections: hero, sticky section navigation, editorial lead, best-for and good-to-know, shared tours grid, private charters, Our Pick, comparison table, editorial deep dive, local tips, FAQ, related hubs.
- Full-bleed hero image showing the specific place, with a headline written per hub and per language (never a template), a fast-facts bar of four decision-relevant facts (duration, getting there, price from, availability), and a date picker as the hero's primary conversion element.
- The editorial lead is capped at 150 words and carries no visible heading.
- Sticky section navigation of five fixed items, appearing once the visitor scrolls past the hero.
- Our Pick shows three editorial picks - best overall, most popular, best for families - referencing tour titles, never operator names, under the line "Our honest picks, not paid placements."
- The comparison table groups tours (for example comfort trips versus adventure trips) with a frozen first column, booking buttons in the header, and rows covering what stands out, what happens on the island, meals, drinks, crossing time, boat and group size, free cancellation, and price from.
- The deep dive, local tips and related hubs sections are mandatory. FAQ carries 7 questions.
- Hub grids do rank by tier and do show the Sponsored badge. There is no trust bar.

### 5.6 Collection page

- **Job:** a curated list built around a person or an intent.
- Seven sections: navigation, a thin editorial banner (roughly 300px, text over image) carrying the persona label, headline, curation note and fast stats; a one-sentence intro capped at 30 words; the curated three-column grid with no sort and no filters; a "Need help before booking?" block; a 6-question FAQ; and a "Keep exploring" block with three other collections plus a recovery link to all island tours.
- Numbered circular badges 01 to 10 appear on "Best Things to Do" and "Top 10" collections only. Persona collections use a peach highlight on the first card instead.
- Each card carries its editorial reason under the title.
- No Sponsored badges, ever.

### 5.7 Tour detail page

- **Job:** conversion.
- Above the fold on desktop: two columns from the top - breadcrumbs, headline, meta row, gallery and quick-info badges on the left; the booking widget alone on the right, starting at headline level and sticking as the visitor scrolls.
- Headline format is "{Place}: {Tour name}", targeting 35 to 60 characters, with no operator name.
- Meta row: rating and review count, the Locals' favorite mark where it applies, and the location. Location is always shown.
- Gallery: a hero image plus four tiles, with save and share controls over the hero and a "Show all photos" action.
- Exactly three quick-info badges: duration, pickup, languages. No fourth.
- Seven content sections in fixed order, each with a visible heading, reachable from a sticky table of contents: Overview, What's Included, What to Expect, Meeting & Pickup, Important Info, Cancellation Policy, Reviews.
  - **Overview** carries a 60 to 80 word narrative, 3 to 6 highlight bullets, and an optional local tip.
  - **What's Included** is a two-column included and not-included list, with the not-included items stating whether each is a paid add-on, payable on the day, unavailable, or not permitted.
  - **What to Expect** is a numbered timeline.
  - **Meeting & Pickup** gives the meeting point with a maps link, the departure time, and an optional hotel pickup block. No embedded map.
  - **Important Info** has three parts in order: "Not suitable for" (shown only where restrictions apply), "Know before you go" (always shown), and "What to bring".
  - **Cancellation Policy** is two locked paragraphs stating the free window and what happens after it.
  - **Reviews** carries the sub-line that every review comes from a confirmed booking.
- Below the content: a muted "Supplied by {operator}" line, then two rows of related tours - more of the same activity type on the island, and more to explore on the island - three cards each, each row shown only when at least two valid tours exist.
- A demand card appears below the widget when the sell-out signal fires, reading "Likely to sell out - book today to secure your spot." Never red, never animated, not clickable.
- No per-tour FAQ section (that content lives in Important Info and the site-level Help Center) and no operator host card.

### 5.8 Checkout

- **Job:** take contact details and payment on one page.
- A single-page accordion with two sections - Contact, then Payment - alongside a persistent booking summary that is a sticky sidebar on desktop and a full-screen view on mobile.
- Contact section: first and last name as separate fields, email with a note that the confirmation goes there, country (defaulting to Curaçao) which drives phone formatting, phone, an optional pickup location dropdown defaulting to "No pickup, meet at location", and an optional special-requests field capped at 500 characters.
- Payment section: an equal radio list of methods with card selected and expanded by default; PayPal and iDEAL collapsed; Apple Pay shown only on iOS Safari and Google Pay only on Chrome and Android.
- The commit button sits inside the expanded payment method and reads "Reserve my spot - Pay {amount}" with a padlock and the exact amount.
- Below the button: a security note, a free-cancellation line, and an implied-consent line linking to terms and privacy - links, not a checkbox.
- Exactly two trust signals at the payment moment: the secure-checkout cue with the payment provider badge, and the free-cancellation line.
- The summary shows tour, party, date, time, pickup state, then Total, Pay today and Balance later, with "All taxes and fees included". Zero-value rows are hidden entirely.
- **The total price is always visible before any payment details are entered.** This is a regulatory commitment, not a conversion tactic.

### 5.9 Thank-you page

- **Job:** the single confirmation surface, where the conversion is recorded exactly once.
- Reached at an address containing an unguessable booking token, so booking pages cannot be found by guessing. It carries no language prefix and is not indexed.
- Seven sections: confirmation hero with the key details and a partially masked email plus a resend link; the booking card with payment status for the booking's payment model; "What happens next" step cards; a three-card tour upsell under "Islanders also love..."; the Island Tours apartment block with a clear ownership disclosure; an operator-first support card; and the footer.
- Upsell cards are chosen from a different category than the booked tour, rated 4.7 or higher, with availability 2 to 7 days out, limited to three.
- The confirmation email is the ticket. There is no voucher download, no QR code and no app - the booking reference plus photo ID is the check-in credential.
- Between payment and this page sits a lean processing screen that waits for the payment to settle and carries no tracking at all.

### 5.10 Search results

- Query results scoped to one island, generated fresh on each request and not indexed by search engines.

### 5.11 Help Center

- A site-level FAQ page carrying FAQ structured data for search engines and AI answers.

---

## 6. Tours and content

### 6.1 What a tour listing contains

- **Identity:** name, web address, island, one primary category plus any additional categories, any number of activity hubs, and an optional departure city.
- **Written content per language:** title, an overview of 80 to 200 words, a long description of 350 to 500 words, a short card description capped at 160 characters, 3 to 6 highlights of 5 to 15 words each, what to bring (3 to 8 points), know before you go (3 to 10 points), not suitable for (up to 6 points, hidden entirely when empty), an optional local tip, the meeting point description, and an optional note from the operator that appears in the confirmation email.
- **Included and not included lists,** where each not-included item is typed as a paid add-on, payable on site, unavailable, or not permitted.
- **Logistics:** duration (or a duration range), pickup model (included, paid add-on, or none), pickup locations with timing windows, meeting point coordinates, check-in buffer, start times, booking cutoff, and guide languages.
- **Audience and safety flags:** minimum age, fitness level, weather dependency, wheelchair accessibility, family friendliness, and suitability for beginners.
- **Media:** an ordered image gallery with one image marked as the hero and a manually set focal point on each image.
- **Add-ons:** optional paid extras, priced per person or as a flat charge, with a maximum quantity. Add-ons are never pre-ticked.

### 6.2 Pricing models

Two models exist.

- **Per person.** Priced through age bands - for example Adult (13+), Child (4-12), Infant (0-3), with youth and senior bands available. Each band has its own price, an optional strikethrough price, an age range, and a flag for whether the person participates or only spectates. All bands count toward capacity, including infants and spectators. The card and widget "from" price anchors on the default (adult) band, never on the cheapest child or senior band.
- **Whole unit.** A single price for the whole thing - a group, boat, vehicle, aircraft or package - with a single guest counter rather than age bands. Group-type units may additionally set a number of included guests and a per-extra-guest surcharge; boat, vehicle, aircraft and package charters are a flat price with no surcharge. A private whole-unit booking takes the entire departure exclusively.
- Prices always display exactly, including cents where they exist. Nothing is rounded on a money display.
- Card price labels have two forms: "from $36" for per-person, and "from $270 per group" (or per boat, per vehicle, and so on) for whole-unit. Where no price can be resolved the card reads "Price on request".
- A tour is priced in a single currency chosen by the operator; travellers see it converted into their own.

### 6.3 Availability and departures

- Operators set up **weekly recurring schedules** (a weekday, a start time, a capacity, and a validity window supporting seasonal patterns), plus **exceptions** for individual dates - add a slot, change capacity, close a slot, or close a whole date.
- From those rules the system generates concrete **departures** with their own date, time, capacity and booking count. Departures are what bookings actually claim.
- The system regenerates departures nightly across a rolling 12 months, and immediately whenever a schedule changes. It never overwrites a departure that has bookings, has been manually edited, or came from an operator's own system.
- Closing a date or slot closes it even if it already has bookings, so a partially booked date can never keep selling after the operator has closed it.
- A departure's live state is worked out at the moment it is read: sold out when full, closed once the booking cutoff has passed, otherwise open. Operator-set closures and cancellations stick.
- Booking cutoff is per tour, defaulting to 2 hours, and can be set anywhere from zero minutes up to one week. Zero-minute cutoffs are explicitly supported for operators who can handle same-moment bookings.
- A tour only appears in listings when it has at least one open departure in the next 30 days. Below that it drops out entirely - it does not occupy a position - and it is not billed for its commission tier during that period.
- The date picker shows only genuinely bookable days, auto-advances to the first month with availability, and shows a remaining-places note only when fewer than 5 places are left, in neutral grey, with no urgency wording.
- **All-sold-out recovery:** when an island has no open departure in the next 30 days for a tour, the page offers 2 to 3 same-category tours with a departure inside 7 days, under the line "These trips still have room this week." There is no notify-me form at launch.

### 6.4 Editorial content

- Admins own the About text, FAQ blocks and page headings on every destination, category, hub and collection page, in every language.
- Each page type owns its own keyword territory so no two pages compete: the island page owns island-level content, each category page owns its activity, hubs own their place, and All Tours owns filter queries with no About block at all.
- Hubs additionally carry a deep-dive section broken into named subsections and a set of titled local tips.
- Collections carry the curation note, the intro, and the per-tour rationale.
- Every editorial heading passes a banned-words check. Words like paradise, luxury, exclusive, seamless, world-class, hassle-free, magical and "don't miss out" are not used, and "discover" is not used as a sentence opener. "Luxury Experiences" as a category name is the single sanctioned exception.
- Copy uses US English throughout, a 24-hour clock in every transactional and deadline line, and never uses em dashes.

### 6.5 Publishing rules

A tour can only go live when all of the following hold:

- At least 5 images, exactly one marked as the hero.
- An English overview of 80 to 200 words.
- At least 3 highlights.
- A price - either at least one age band or a base price. Whole-unit tours additionally need a base price and a unit type.
- A free-cancellation window set. Every published tour must carry one; this is what grounds the "free cancellation on every tour" claim.
- At least one category, with exactly one marked as primary.

Tours move through draft, live, paused and archived, and can be restored. Every status change re-runs the category visibility check in both directions.

### 6.6 Media

- All images are uploaded through a shared media library rather than pasted as links.
- Every image carries alternative text, dimensions and a focal point so crops stay sensible at every size.
- Photo containers always have a neutral fallback background so a slow-loading image never leaves a white hole.

---

## 7. Booking and payment

### 7.1 The booking journey

1. The traveller opens a tour page and sees "From {price} per person", a date field, a travellers field, and a "Check availability" button, plus two trust lines.
2. They tap the date field and get a full-month calendar - two months side by side on desktop, one on mobile with swiping. Unavailable, closed, sold out and past-cutoff days are visibly disabled with a reason on hover. The calendar opens on the first month that actually has availability.
3. Choosing a date reveals the departure times for that date. Each time chip shows its status, and shows how many places are left only when fewer than 5 remain.
4. They set the party. The plus button stops at real capacity with an inline explanation, and party numbers auto-adjust if they change the date. Every band, including infants and spectators, counts toward capacity.
5. Once date, time and party are all set, the money summary appears: Total, Pay today and Balance later, with an expandable breakdown and the line "All taxes and fees included". Zero-value rows are hidden. The button becomes "Continue".
6. The traveller lands on checkout, fills in contact details and any pickup or special request, and picks a payment method.
7. They commit with "Reserve my spot - Pay {amount}". The system claims the seats with a single atomic operation - if two travellers race for the last places, exactly one wins, and the loser is returned to time selection with their date preserved.
8. Payment is taken. A lean processing screen holds until the payment settles, then forwards to the thank-you page.
9. The thank-you page confirms the booking, the confirmation email goes out, and the conversion is recorded exactly once.

Bookings are confirmed instantly on every payment model. There is no enquiry step and no 24-hour approval.

### 7.2 Payment models

Each tour declares one payment model, which is locked onto the booking at the moment it is created and never changes afterwards.

- **Operator link (the default).** The traveller pays the deposit at checkout. The operator emails a secure link for the balance, paid online before the deadline.
- **On arrival.** The traveller pays the deposit at checkout. The balance is paid in person on the day - card or cash, or cash only, set per tour.
- **Paid in full.** The traveller pays 100% at checkout. Nothing is owed later.
- **Operator collects everything.** Specified in full but **not offered at launch**; it returns in a later version once the commission-collection route is settled.

The deposit is between 20% and 30% depending on the tour's commission tier. The exact deposit amount is always shown before payment.

### 7.3 Prices, currency and the money rules

- Every total the traveller sees is calculated by the platform, not by the browser. The page never decides what anything costs.
- The price is re-quoted whenever the date, time, party, add-ons, pickup or currency changes.
- Currency conversion happens once and is locked onto the booking, so a historical booking's amounts and commission never drift when exchange rates move.
- Rates refresh regularly in the background. If no usable rate is available, a cross-currency checkout is refused rather than guessed. Public pages, by contrast, fall back to showing the tour's own currency rather than blocking.
- The traveller is charged in the currency they were shown.
- Payment methods at launch: card (inline, styled to match the site rather than a hosted page), PayPal and iDEAL. Methods are only offered where they are actually valid for the currency and the account.
- Retrying a payment never double-charges: every attempt carries a key so a repeat is recognised as the same attempt.

### 7.4 Trust lines and the two explainer modals

Inside the booking widget sit exactly two lines with green checkmarks, and nothing else:

- "Free cancellation up to {hours}h" - opens the cancellation explainer, which leads with "Plans change. No problem." and states the full-refund window in local time, plus what happens after it (including that an operator-forced cancellation always means a full refund or a free reschedule).
- "Pay only {X}% today, the rest later" - opens the deposit explainer, which leads with "Keep your plans flexible.", walks through three steps, and closes with why deposits exist - popular tours fill up, and the deposit secures the spot without paying everything upfront while supporting the local islanders running the tours.

On paid-in-full tours only the cancellation line shows. There is no "instant confirmation" line, no WhatsApp link and no "secure payment" line at the commit moment; those either duplicate signals shown elsewhere or offer an exit at exactly the wrong point.

### 7.5 Two-phase operator visibility

- **Before payment the copy is operator-agnostic.** The widget and both explainers say "you'll get a secure link to pay the rest" and never name or promote the operator.
- **After booking the operator is named deliberately.** On operator-link tours the thank-you page and confirmation email say the operator will send the balance link, so that email is expected and never mistaken for a scam.

### 7.6 Error and edge handling

- Missing date or time on a commit attempt shows an inline note above the button and highlights the missing field, rather than silently doing nothing.
- Reaching capacity shows "Only N spots left"; reaching the per-booking limit shows "Up to N travellers per booking".
- A sold-out date reads "Sold out. Try another date." and suggests the next available one.
- A card decline, a payment failure or a loading failure each show a clear message with a retry and a WhatsApp fallback.
- If a spot sells out between selecting it and paying, the traveller is returned to time selection with their date kept and their contact details still filled in.
- Errors appear inline beneath the field concerned, never as a red banner across the top, and focus returns to the first field with a problem.

---

## 8. After booking

### 8.1 The confirmation email

One template covers every tour, payment model and language. It is the traveller's ticket - there is no voucher download, no QR code and no app.

- **Subject:** "You're booked: {tour} on {date}". A booking made less than 24 hours before the tour switches to "You're booked for tomorrow" (or today) and no separate reminder follows.
- **Blocks in order:** the confirmation headline with the booking reference; the tour summary with a photo, operator name, date and time; the practical details (pickup or meeting point with a maps link, readiness note, end point, guests, duration, language, and any special request); an optional note from the operator; the payment summary; the "how to pay the rest" block; what to bring and good to know; a contact panel; the cancellation block; the sign-off; and a two-card "more experiences on this island" panel.
- **The payment summary changes per model.** Deposit models show deposit paid, balance due and total with the deadline in local time. Paid in full shows a single "Paid in full" line. Zero-value rows disappear entirely rather than showing a blank label.
- **The anti-phishing block is mandatory and must stay high in the email.** On operator-link tours it names the operator and explains they will send a secure link for the balance, followed by the locked line that Island Tours will never ask for card details by reply, text or phone, and that anything that looks off should be checked on WhatsApp first.
- **The contact panel splits responsibility deliberately:** the operator answers questions about the day; Island Tours answers questions about the booking, on WhatsApp, Monday to Sunday 08:00 to 20:00.
- **The cancel button opens a page, it never cancels on click.**
- Dates are formatted for the traveller's language, times use the 24-hour clock in every language, and every time is labelled with the island's local time.
- A calendar file can be added to the traveller's calendar from the email and from the thank-you page.
- The traveller can request the confirmation be re-sent; it only ever goes to the address stored on the booking.

### 8.2 Other emails

- **Operator booking notification.** Every confirmed booking notifies the operator, telling them what action the payment model requires (send the link, collect on arrival, or nothing owed), with the guest's contact details and a link to their dashboard.
- **Operator balance email.** On operator-link tours the operator sends the traveller a secure link for the balance. This is the only email in the whole system that ever contains a payment link.
- **Pre-tour reminder,** sent once, 24 hours before the tour in island time. It repeats the logistics, the what-to-bring list, a weather note on weather-dependent tours, and the operator's contact details. It contains no payment link, no cancellation button (the window has closed or is closing) and no balance chase. Bookings made inside that 24-hour window get no reminder because the confirmation already served as one. Cancelled bookings get none.
- **Cancellation emails.** A request generates an acknowledgement to the traveller, a notice to the operator, and a work item for the Island Tours admin. Once processed, the traveller and the operator each get a confirmation, with wording that reflects whether a refund is due.

So a normal booking generates two emails; an operator-link booking generates three.

### 8.3 Cancellation and refunds

- **One window per tour governs both free cancellation and the balance deadline.** It is set from a fixed set - 24, 48, 72 or 168 hours - and defaults to 48. Every published tour must have one.
- The deadline is always calculated as the tour start minus that window, in island time, and every place it appears says "(local time)".
- **Up to the deadline:** the traveller can cancel for a full refund of whatever they paid Island Tours. On operator-link tours they can also pay the balance.
- **After the deadline:** the booking is locked.
- **If the operator has to cancel** - unsafe conditions, for example - the traveller always gets a full refund or a free reschedule, regardless of the window.
- **The cancel flow is deliberately two-step.** The email button opens a page showing "Cancel {tour}, {date}?" with the refund amount where one applies. The traveller submits a request; an Island Tours admin processes it and confirms by email. Clicking a link never cancels anything.
- **The deadline is judged on the moment the traveller submitted the request,** never on the moment an admin got around to processing it, so admin delay never costs a traveller their refund.
- **A traveller must prove who they are before cancelling.** Simply holding the link is not enough - it shows a masked view with no personal details, and any attempt to cancel from it prompts a quick verification.
- Refund wording differs by payment model: deposit models explain that the deposit is on its way back within 3 to 5 business days and that the operator refunds any balance already paid; paid-in-full states the full payment is being returned; and a model where Island Tours took no money carries no refund line at all.
- **Missed balance payments are never handled automatically.** There is no automatic overdue state and no automatic forfeit. The operator reports non-payment, an admin confirms it, and only that confirmation forfeits the deposit and releases the place.

### 8.4 Reviews

- **Only travellers with a confirmed booking can leave a review.** The Reviews section carries the line "Every review from a confirmed booking. No exceptions."
- Reviews are moderated. Only approved reviews count toward a tour's rating, its review count or its tier eligibility.
- A review shows the reviewer's first name and last initial only, and the travel month and year rather than an exact date, along with the rating, the text and any photos.
- **Display thresholds:**
  - A rating appears on cards and pages only once a tour has **3 or more reviews**. Below that the rating row is hidden entirely, and a tour under 30 days old with no reviews shows the New badge instead.
  - Where a tour has fewer than 3 reviews but its operator has at least 10 reviews averaging 4.0 or better across all their tours, the operator's rating shows instead, explicitly labelled as coming from that host's reviews across all tours.
  - A review preview module appears above the overview once a tour has 3 or more reviews averaging 4.0 or better, showing the two most recent positive reviews. Below that it does not render at all - an empty review block would weaken the promise more than its absence.
  - The **sort control is hidden below 10 reviews** and the **filter row below 20**, because at low volumes they return nothing useful. The default order is always newest first.
  - A photo carousel activates once a tour has 3 or more reviews with photos.
- **The star distribution chart is clickable from the first review.** Clicking a star row filters the list to that rating. Since the filter row is hidden below 20 reviews, this is the main way a traveller finds critical reviews - and finding critical reviews is a deliberate design goal, not an accident.
- Reviews in other languages are machine-translated on demand and labelled as translated, with a per-card "show original" toggle.
- Homepage social proof shows the platform review aggregate, and only once the platform has 100 or more reviews.

### 8.5 Customer accounts

- **Every booking creates or links a customer account automatically.** A welcome email offers a set-password link, but setting a password is optional and nothing about the trip requires it.
- Travellers who do not want an account keep the no-account route: they reach their booking with their email plus their booking reference, or through the link in their confirmation email.
- The account area shows the traveller's bookings, their payments and their saved tours. Bookings show travellers, amount paid, balance still due, and - while inside the free window - the date up to which they can still cancel free.
- Cancellation from the account area is a two-step action with a clear statement of what happens to the money in each of four situations: already requested, still eligible, window closed, or not cancellable.
- Commission is never shown to a traveller anywhere.
- A traveller's login session lasts 24 hours. Repeated failed lookup attempts are rate-limited per email and per booking reference, and error messages never reveal whether an email exists in the system.
- Losing a booking reference is recoverable: the traveller enters their email and, if it has bookings, the references are emailed to the address on file. The response is the same either way, so the form cannot be used to discover who has booked.

---

## 9. Operator tools

Operators work in a dedicated dashboard, separate from the public site and from the admin surface. It opens on the availability screen, because closing a date that has filled up is the daily job.

### 9.1 Tours

- Create a tour with four pieces of information - name, island, category and web address - then build it out across grouped sections rather than one long form.
- **Setup:** the operational details, pricing and schedules.
- **Content:** images, highlights, what is and is not included, the itinerary, pickup points, and the practical information blocks.
- **Reach:** filter attributes, commission tier and spotlight requests, and search metadata.
- **Translations:** the six non-English languages, edited in a dedicated translation workspace rather than buried in tabs.
- A **readiness panel** sits alongside every tour, listing what is still missing before it can be published (name and category, price, 5 images, a hero image, 3 highlights, an English overview) and, separately, what is still missing before it will actually appear in listings (at least one schedule, and a capacity). Each unmet item links straight to the field that fixes it.
- Publishing is blocked until the requirements are met, and the blocking item is named. A tour that is live but not yet listed says so, and says why.

### 9.2 Availability

- A weekly schedule editor, an exceptions calendar for individual dates, bulk blackouts, and a one-tap "close today".
- Start times are managed per tour; a start time in use by a schedule cannot be removed.
- A capacity is required. Without one, no departures are generated and the tour will never be listed - the interface warns about this before it can happen.
- A freshness prompt asks operators without an automatic feed to confirm their availability is current.
- Every change is logged.

### 9.3 Bookings and payments

- A list of the operator's own bookings only, with the payment state (paid, partly paid, unpaid, refunded), the amount collected and the balance still due.
- A cancellation-request queue showing what needs attention, oldest first, with the free-cancellation window and the refund due shown as columns rather than buried in text.
- On operator-link tours the operator sends the balance payment link. On on-arrival tours they collect on the day. On paid-in-full tours nothing is owed to them by the traveller.
- Where a traveller has not paid a balance, the operator reports it; only an admin's confirmation forfeits the deposit.
- A payments view listing charges and refunds.

### 9.4 Commercial controls

- Choose the commission tier for each tour, subject to the eligibility bar and the 30-day lock. The interface shows what the tour currently qualifies for.
- Request Destination Spotlight, subject to the higher bar and admin approval.
- The deposit percentage is shown but not editable - it follows the tier.

### 9.5 Business settings and team

- Company details, social links and payout configuration. **Payout and bank details are owner-only,** even for managers on the team.
- Invite team members by email; each person gets their own login, never a shared one.
- Team members are given a **designation** - a reusable permission template - plus individual additions or removals on top.
- Team members can be suspended, which immediately ends every active session, or removed entirely.
- Seat labels (manager, staff) are organisational only; what someone can actually do comes from their designation and overrides.

### 9.6 Reporting

- A dashboard showing the operator's own figures: net earnings, what they have paid the marketplace in commission, what is owed to them, and their own off-platform takings.
- Every number is a live figure. Nothing is estimated or extrapolated, and a zero on screen means the query genuinely returned zero.
- Operators never see other operators' data.

---

## 10. Admin tools

Admins use the same dashboard, organised into groups by how often the work happens.

- **Operate (daily):** overview, bookings, cancellation requests, payments.
- **Catalog (weekly):** tours, media, translations.
- **Curate (admin, weekly):** destinations, activity hubs, categories, collections, Destination Spotlight approvals, Locals' Favourites.
- **Configure (admin, rarely):** filter attributes, operator accounts, users and staff, reviews, settings.
- **Pages:** the homepage editor and the site's standing pages.

Operators simply do not see the Curate and Configure groups. Items an operator can never use are absent, not greyed out.

### 10.1 Catalogue curation

- Create and manage destinations, the 19-category set, activity hubs and collections, each with the same editor shape: details, page content, search metadata, FAQs, and any module-specific curation.
- Hub curation covers which categories may attach, the editorial picks, the comparison table and the content sections.
- Collection curation covers the ordered tour list and the per-tour rationale required before publishing.
- Every entity's editorial copy is translated into the seven languages through a dedicated translation workspace.
- Renaming a web address issues a permanent redirect automatically; a deleted address is held for 90 days before it can be reused.

### 10.2 Editorial powers

- **Locals' Favourite** is set here and only here, never by operators, with the coverage against the roughly 30% target shown on screen.
- **Featured experiences** on the homepage cover categories and hubs only, never individual tours. A featured card whose target page would not render is silently dropped rather than shown as a dead link.
- **Homepage content** - hero, headings, editorial block, FAQs - is editable per language. Every field falls back to the built-in copy when cleared, so the homepage can never be blanked. Section order and structure stay fixed; admins change what is in a section, never whether it exists.

### 10.3 Moderation and approvals

- **Reviews** are moderated: a queue showing pending reviews first, with approve and reject actions, filters by tour, rating and status, and bulk approval.
- **Destination Spotlight requests** form a queue: pending first, approve or reject inline, with a count badge on the navigation item. Approval is refused when the destination already has 3 active spotlights.
- **Cancellation requests** form a third queue with the same shape, defaulting to what still needs attention.
- **Force-majeure pardons** let an admin mark a date range on an island - a hurricane day, for example - so operator cancellations in that window do not count against anyone's eligibility.
- Every badge on a navigation item means something genuinely needs a person. Decorative counts are not used.

### 10.4 Operators and staff

- Manage operator accounts, including onboarding status, tour counts and tier distribution.
- Manage platform staff: invite by email, assign a designation, adjust individual permissions, suspend or remove.
- Three standard platform designations exist out of the box - Operations Manager, Content Editor and Support Agent - and admins can create more.
- **Staff can never manage staff,** can never change system configuration, and can never change another person's identity or role. Those powers stay with real admin accounts.
- Nobody can suspend or remove their own account.
- Every staff action is logged with the actor.

### 10.5 Media library

- A shared library backed by a cloud media service, covering images, video and audio.
- Every media field across the whole dashboard picks from this library. Pasting a URL is not offered anywhere.
- Media carries alternative text, a focal point, a hero flag and an order; tours cap at 24 images.
- Fields restricted to one media type only offer that type.

### 10.6 Settings

- Site identity (logo, WhatsApp number, branding shown in the public header and footer).
- Global search metadata defaults.
- The platform's legal entity details, kept separate from an operator's own business details.
- Payment provider configuration, with credentials stored encrypted in the database rather than in configuration files, and a note that leaving a secret blank on edit keeps the existing one.
- Payment methods can be switched on, but a method only actually appears at checkout once it is genuinely activated with the payment provider and valid for the currency. That gate is deliberate.
- Marketing-list and review-aggregator integrations, each showing whether it is connected, in error, or not configured.

### 10.7 Platform reporting

- Platform-wide figures: commission earned, commission still pending, gross booking value, payouts due to operators, the balance flowing on operator rails that the platform does not track, cash collected and refunded, and distinct customers.
- Leaderboards by operator, destination and commission tier.
- Booking outcomes - created, committed, completed - with commit, completion, expiry and cancellation rates. This is deliberately labelled booking outcomes rather than a marketing funnel, because the platform does not store pre-booking browsing events and will not report numbers it cannot honestly produce.
- **Revenue is recognised on tour completion.** Money from confirmed but not-yet-travelled bookings is reported separately and never added to earnings.
- Every card links to the filtered list that produced it. A number nobody can act on is decoration.

---

## 11. Money flow

### 11.1 Commission

- Commission is calculated at the moment of booking and stored on the booking, in euros. It never changes afterwards - not when the operator changes tier, not when a tour is demoted, not when a rate is edited.
- Where a tour has an active Destination Spotlight at the moment of booking, that booking earns the 35% spotlight rate instead of the tier rate.
- Commission is calculated on the euro value of the booking, so a booking charged in dollars still yields a correct euro commission.
- **Commission is never shown to a traveller,** on any page, in any email, or in any data the browser can read.

### 11.2 Settlement

The four payment models are one goal with three variations: on every booking, Island Tours should end up holding exactly its commission.

- **Deposit models (operator link and on arrival) settle themselves.** The deposit the platform collects is sized to match the commission, so the platform keeps the deposit as its cut and the operator keeps the balance they collect directly. No money moves between the two. A settlement record is still written for the books.
- **Paid in full over-collects.** The platform holds 100%, keeps its commission, and pays the operator the remainder. **That payout is scheduled to release after the cancellation window has closed,** so a refunded cancellation can never leave the platform chasing money it has already paid out.
- **Operator-collects-everything under-collects** - the platform would hold nothing and still be owed commission. This is why the model is not offered at launch. When it returns, it comes with a defined route for collecting that commission.
- Every booking writes one settlement record from day one, even where nothing moves, so the ledger is ready when automated payouts arrive.
- Positive means Island Tours owes the operator; negative means the operator owes Island Tours.
- At launch, payouts are executed manually against that ledger on a schedule. The ledger is the important part; automating the execution later changes who presses the button, not the data.

### 11.3 What the platform can and cannot see

- The platform can verify every payment that runs through its own checkout.
- It cannot verify balances the operator collects on their own rails, whether by their own payment link or in cash on the day. **No surface may ever claim a booking is "all paid" on an operator-link tour** - only a paid-in-full booking may say that. Elsewhere the wording stays neutral.
- Missed balance payments are therefore a human process: the operator reports, an admin confirms.

### 11.4 Multi-currency

- Operators price their tours in one currency. Travellers see that price converted into theirs.
- Every conversion used for money is locked onto the booking at the moment of booking, along with the rate, the provider and the timestamp. Payments, the thank-you page, the confirmation email and reporting all read that stored snapshot and never fetch a fresh rate.
- Rates refresh automatically in the background.
- If no acceptable rate is available, a cross-currency checkout is refused with a clear message rather than guessed at. Public browsing pages, by contrast, fall back to showing the tour's own currency and never block.
- Refunds are recorded as their own entries in the ledger rather than by editing the original charge, so reporting cannot double-count them.

### 11.5 Affiliate payouts

- Affiliate commission is held at booking and released only once the cancellation window has closed, mirroring the same clawback-safe logic as the operator payout.
- It comes out of the platform's share and never reduces what the operator receives.

---

## 12. Trust, SEO and analytics

### 12.1 Search visibility

- Every page type owns a distinct keyword territory. The island page owns island-level content, each category page owns its activity, hubs own their place, and the All Tours page owns filter queries and carries no editorial content at all.
- Every tour has exactly one address, so no two pages compete for the same result.
- Every content page carries language alternates for all seven languages plus an English default, and each language version has its own canonical address.
- Filtered listing pages always point search engines back to the clean unfiltered address.
- A sitemap index plus per-language and per-page-type sitemaps list only published pages, excluding categories below the 3-tour threshold, with last-modified dates that update on change.
- Search results, the thank-you page, the wishlist and the booking-lookup page are all excluded from search indexing. Admin and dashboard paths are disallowed outright.
- Renaming an address issues a permanent redirect and a deleted address waits out a 90-day cooling-off period, so links and search results never silently point at unrelated content.

### 12.2 Structured data

- Breadcrumb data on every page that has breadcrumbs.
- Tour pages carry full product and offer data including accepted payment methods, minimum age, accessibility, the refund policy derived from the cancellation window, the included and excluded lists, and reviews with an aggregate rating.
- The Help Center, collections, hubs and the destination help block carry FAQ data.
- The All Tours grid carries item-list data and is rendered server-side so it is genuinely crawlable.
- Search results carry no structured data at all.

### 12.3 Conversion tracking

- **A single booking-completion event fires on the thank-you page,** feeding Google Ads, analytics and the social pixel, plus a matching server-side event for reliability.
- **The conversion value is the commission in euros, never the gross booking value.** Bidding algorithms learn from real margin.
- The event fires exactly once per booking. The safeguard is a database record set before the page renders, not browser storage, so refreshes, revisits and shared links can never double-count. A missed event is an acceptable outcome; a double count is not.
- A confirmed booking with no commission recorded is treated as corrupt data: the page shows an error and no conversion is fired. There is no silent fallback.
- Personal details used for match-rate improvement are hashed on the server before they leave, in a single pass shared across platforms.
- Advertising click identifiers and campaign parameters are captured at booking so that cancellations and refunds can be reported back and corrected.
- Other tracked moments: island selection on the homepage, tour list views and clicks, wishlist additions, related-tour clicks, searches with their result count, and successful booking lookups.
- **The operator dashboard carries no marketing analytics and no pixels** - only server-side, personal-data-free counters that feed security review rather than campaigns.

### 12.4 Consent

- Consent management is regional: denied by default in the EEA, granted in the US and Canada, through a consent platform selected before the tracking build.
- A cookie management page is part of the standing legal pages.

### 12.5 Trust signals

Trust components deliberately differ by page, and the differences are intentional rather than an inconsistency to be tidied away.

- Homepage: a three-column micro trust bar plus the full help block with FAQs.
- Destination: the full help block with FAQs.
- All Tours: a compact four-point strip plus a WhatsApp link, no payment logos and no FAQ.
- Category and hub pages: no trust bar at all.
- Collection: the help block with payment logos and the collection FAQ.
- Tour widget: two clickable trust lines, reduced to one on paid-in-full tours.
- Checkout: exactly two signals - the secure-checkout cue with the payment provider badge, and the free-cancellation line.

WhatsApp support appears where people are researching or have a problem - tour descriptions, the footer, error states, and post-purchase emails - and deliberately never at the moment of commitment.

### 12.6 Review credibility

- Reviews require a confirmed booking, with no exceptions, and the page says so.
- Only moderated, approved reviews count toward a rating.
- Ratings do not appear until there are at least 3 reviews, so one or two reviews cannot unfairly make or break a tour.
- Where a tour is too new, the operator's own rating can stand in, but only with explicit attribution.
- The star chart is clickable from the very first review, because finding critical reviews easily is a deliberate goal.
- The homepage platform-review strip stays hidden until the platform has 100 or more reviews.
- Machine-translated reviews are labelled as such with an option to see the original.

---

## 13. Non-functional requirements

### 13.1 Performance and freshness

- Public pages are pre-rendered and served from cache, with the parts that need to be fresh streamed in separately. A page never renders blank while it waits.
- Freshness targets by page: the tour detail page refreshes fastest because availability and pricing must stay current; activity hubs cache longest because their content is largely static; search is generated fresh on every request and never cached.
- **Editing content in the dashboard immediately expires the relevant public caches,** so the next visitor sees the change rather than waiting out a timer. Nightly re-ranking triggers the same refresh.
- **A backend outage must never replace a good page with a not-found page.** Pages that gate on data being found are built so that an outage causes the last good version to keep serving instead.
- Loading behaviour follows one rule everywhere: nothing under 200 milliseconds gets a loading state; between 200 and 1500 milliseconds a skeleton appears; beyond 1500 milliseconds a secondary indicator joins it; beyond 5 seconds it becomes a timeout with a retry.
- Only payment processing ever locks the interface. Nothing else blocks the whole page for a background task.

### 13.2 Accessibility and motion

- WCAG AA contrast is mandatory across every surface, with visible focus indicators.
- Reduced-motion preferences switch off every animation and transition.
- Form labels sit above fields rather than inside them as placeholders, autofill works, pasting is always allowed, and password visibility can be toggled.
- Errors appear inline beneath the field concerned and move focus there, never as a banner across the top.

### 13.3 Security and access control

- Every request passes rate limiting, then session validation, then role checks, then fine-grained permission checks, in that order.
- **Roles and permissions are decided on the server only.** No page ever sends a role, and the interface's own permission checks are cosmetic - the server enforces regardless.
- Three separate login doors that never share a page: travellers, tour operators and their staff, and Island Tours staff. Customer accounts add a fourth. A hidden address is never treated as a security measure.
- Operator accounts require a password of at least 12 characters plus a second factor on every login from an untrusted device, with trusted devices remembered for 30 days, sessions rolling over 14 days, and a re-authentication step for anything touching payouts, bank details, team management or commission tier. Text-message codes are not used anywhere on the platform.
- Island Tours staff sign in through the organisation's Google Workspace only, with the domain and an explicit allow-list both checked on the server. Staff sessions last a maximum of 12 hours, with fresh sign-in required for refunds, forfeits, capacity reductions below what is already booked, and allow-list changes.
- Error messages never reveal whether an account or a booking exists. The wording, the status and the response timing are identical either way.
- Rate limits apply per client and, on anything that sends email, per recipient too, so a caller using many addresses cannot flood one inbox.
- Suspending an account ends every one of its live sessions immediately, blocks re-entry with a clear message, and strips its permissions.
- Payment webhooks bypass session checks by design but verify the provider's signature and record every event before processing it, so a repeated delivery is harmless.
- Booking addresses use unguessable tokens and cannot be enumerated. Holding a link shows a booking exists; it never reveals who it belongs to and never permits a change.
- Every login, failed attempt, second-factor event, recovery and role change is written to an audit trail retained for 12 months.
- Media addresses supplied through the dashboard are validated on write and re-checked at render against an allow-list of hosts, so one bad entry cannot take down a page.

### 13.4 Reliability

- **Seat capacity is protected by a single atomic database operation.** When two travellers race for the last places, exactly one wins. There is no queue in front of booking, because a queue would add latency and a failure point without removing the need for that operation.
- Everything that happens after the seat and the money are settled - emails, conversion reporting, payouts, reminders, nightly recalculations - runs as a retryable background job with a defined retry pattern and a permanent record of failures. Nothing is silently dropped.
- Every background job is safe to run twice, guarded both at the queue and in the database.
- Domain events are written into the database in the same operation as the booking, then relayed to the job queue, so an event can never be lost in the gap between the two.
- Payment attempts, intent creation and booking reservation are all idempotent: a retry is recognised as the same attempt.
- Nightly jobs regenerate departures for a rolling 12 months, recompute which tours are bookable, refresh quality scores, run the tier eligibility lifecycle, and activate or expire spotlights.
- A departure that already has bookings, has been manually edited, or comes from an operator's own system is never overwritten by an automatic regeneration.

### 13.5 Hosting and operations

- The public site runs on a managed hosting platform. The backend, database and job queue run on a private server behind a secured web server with automatically renewed certificates.
- **The public site never touches the database.** It only calls the backend over a secure connection.
- The database and the job queue are reachable only from the backend and are never exposed to the internet. Only web traffic and administrative access are open.
- Deployments are automated: pushing to the main branch rebuilds and restarts the backend, applying any database changes on start. Rolling back is a single command.
- Secrets live on the server, never in the code repository, and are rotated rather than reused.
- **Database backups run nightly**, are kept for 14 days, and are copied off the server, on the principle that a server failure should not take the only backup with it - and that a backup nobody has ever restored is a hope, not a backup. Restores are tested.
- Error reporting and request tracing are in place before real booking volume, so a failed payout, email or conversion is visible rather than silent.
- A health check confirms not only that the service is running but that the database and job queue are genuinely reachable.
- The platform runs comfortably on a single well-sized server. Running more than one instance requires shared rate-limit state, shared permission state, and a guarantee that nightly jobs run in exactly one place.
