# Island Tours - Build Status

A plain-English view of where the platform stands: what is finished, what is actively being worked on, and what is still ahead. Everything below reflects an audit of the actual working software, not a plan or a wish list. Items are grouped into main features with their sub-features, so you can read this in a few minutes rather than task by task.

**Status date: 26 July 2026**

Legend: ✅ Done · 🟡 In progress · ⬜ Pending

---

## Summary

| Area | Done | In progress | Pending | Total |
|---|---|---|---|---|
| Backend (the engine) | 288 | 18 | 75 | 381 |
| Dashboard (admin and operator tools) | 242 | 14 | 117 | 373 |
| Public website (what travellers see) | 266 | 33 | 153 | 452 |
| **Total** | **796** | **65** | **345** | **1,206** |

The platform's core engine and admin tools are largely built. Bookings, payments (Stripe **and Mollie**), refunds, availability, commission tiers, the settlements ledger with a manual mark-as-paid payout workflow, the full review system (invitations, submission, moderation, translation), operator and staff management, and the email system all work end to end today.

Since the last status (21 July), the two biggest commercial gaps on the public website closed: the site is now *visible* to search engines (sitemap, robots file, rich-result markup all live) and the *measurement* layer (tag manager, consent handling, conversion tracking, ad attribution) is fully coded - it stays dark only until the advertising accounts are supplied and connected (see "Needs your decision"). The remaining public-site work is polish, locked-copy verification and secondary marketing events rather than structure.

---

## 1. Backend (the engine)

The invisible half of the platform: the rules, data and money handling that everything else depends on.

### Foundation and security
- ✅ Core application, data structure and technical documentation of every function
- ✅ Protection against abuse and traffic floods (per-visitor request limits)
- ✅ Encrypted storage of payment credentials and other secrets
- ✅ Live production hosting, automated deployment and secure web address setup
- 🟡 Health monitoring - the system reports that it is alive, but not yet whether its database and supporting services are healthy
- ⬜ Automated nightly database backups kept off-site, with a tested restore
- ⬜ Error monitoring and alerting so failures are noticed before a customer reports them
- ⬜ Business activity log recording who changed what and when
- ⬜ Newsletter platform (Mailchimp) connection - the settings screen exists, the sending link does not

### Accounts and roles
- ✅ Login, password reset and session handling for all account types
- ✅ Three-role model (traveller, tour operator, administrator) with a full permission system
- ✅ Staff and teams: job titles, permission templates, invitations and per-person overrides
- ✅ Instant suspension - a removed staff member loses access immediately
- ✅ Traveller accounts created automatically on first booking, with a welcome and set-password email
- ⬜ Secure access keys for third-party travel agents and resellers to connect to your system

### Destinations, categories, hubs and collections
- ✅ Destinations with protection so pre-set islands cannot be deleted by accident
- ✅ 19 global tour categories, applied per island
- ✅ Activity hubs with editorial content, "our picks" and comparison tables
- ✅ Curated collections with per-tour editorial notes in every language
- ✅ Web address registry: every page gets a clean, unique, permanent address
- ✅ Automatic redirects when an address is renamed, plus a 90-day protection window on deleted ones
- 🟡 Category pages currently appear with as few as one tour; the agreed rule is a minimum of three
- ⬜ Rule enforcing which islands are live versus still in the pipeline
- ⬜ Requiring a curator's note before a collection can be published

### Tours and pricing
- ✅ Full tour creation and editing: content, images, highlights, inclusions, itinerary, pickup points, languages
- ✅ Publish, pause, archive and restore controls
- ✅ Pricing models including per-person, per-group and per-unit, with age bands and paid add-ons
- ✅ Cancellation window set per tour (24 / 48 / 72 hours or one week)
- ✅ Accessibility, fitness, minimum age and family-friendly flags
- ✅ Filterable tour attributes, with the ones the system can work out for itself kept automatic
- ✅ Automatic "from" price and "likely to sell out" demand signal
- ⬜ Safeguard against changing a tour's currency once it has priced items or bookings

### Availability and departures
- ✅ Recurring weekly schedules with start times and capacity
- ✅ Exceptions: close a date, close a single time slot, add a one-off slot, or change capacity
- ✅ Automatic generation of bookable departures on a rolling 12-month horizon
- ✅ Booking cut-off enforcement and low-availability disclosure
- ✅ Operator controls for blackouts, closing today, and per-departure capacity edits
- 🟡 A newly created schedule only opens 90 days of dates until the nightly job extends it
- ⬜ Recovery path for a tour where every departure has sold out
- ⬜ Stress testing that hundreds of simultaneous bookings can never oversell a departure
- ⬜ Calendar feed so operators can see departures in their own calendar app

### Bookings
- ✅ Full booking record with references, traveller details, party breakdown and price snapshot
- ✅ Server-controlled price quote so totals can never be tampered with from the browser
- ✅ Seat reservation that cannot oversell, even under simultaneous bookings
- ✅ Private and whole-boat exclusive bookings
- ✅ Confirmation, hold extension, expiry and cancellation flows
- ✅ Refund eligibility judged at the moment the traveller asks, not when staff get around to it
- ✅ Booking lookup by email plus reference, with abuse protection and a secure 24-hour session
- ✅ Add-to-calendar file and confirmation resend
- ✅ Guarantee that later price or tour edits never change an existing booking
- ✅ Refunds actually issued through the payment provider (Stripe and Mollie) with automatic retry, recorded as their own payment entries
- ✅ Recording where a booking came from (ad click ids and campaign tags captured at booking) so marketing spend can be measured
- ✅ Operator non-payment / deposit forfeit process: operator reports, admin confirms or dismisses, deposit kept and seats released, filterable in the bookings list
- ✅ Optional extras and paid pickup zones priced into the booking total
- 🟡 Refunds are classified as full or none; part-refunds and deposit-aware partial amounts are not calculated
- ⬜ Handling a payment that lands after the hold has already expired
- ⬜ Discount codes and vouchers (deferred by decision)

### Payments and refunds
- ✅ Stripe fully integrated: card taken on your own page, plus PayPal and iDEAL
- ✅ Deposit, balance and full-payment handling per payment model
- ✅ Payment confirmations received and verified from Stripe, with duplicate protection
- ✅ Race-proof confirmation so a booking is confirmed exactly once and emails send exactly once
- ✅ Payments list for admins and operators, filterable and searchable
- ✅ Mollie fully integrated as a second, admin-switchable payment provider - payments confirm bookings and refunds work, routed by whichever provider took the money
- ✅ The payment provider's real exchange rate is recorded on every non-euro payment, so euro figures match what actually settled
- ✅ Operators choose which provider receives their payouts (payout destination only; customers are always charged through the platform's own setup)
- ⬜ Attaching the payment receipt or invoice to the confirmation email (awaiting your decision: own PDF or provider receipt link - the providers issue no payment invoices themselves)

### Commission, ranking and promotion
- ✅ Five commission tiers driving where a tour ranks in listings
- ✅ 30-day lock after a tier change, and no retroactive effect on existing bookings
- ✅ Ranking order plus a fairness pass so one operator cannot dominate the top of a page
- ✅ Only genuinely bookable tours appear in listings
- ✅ Nightly quality score based on rating, review count, listing completeness and conversion
- ✅ Eligibility system: 90-day new-tour grace period, then automatic demotion if standards slip
- ✅ Destination Spotlight: operator request, admin approval, maximum three per island, higher commission
- ✅ Eligibility now also checks the operator's 90-day cancellation record (with a minimum sample so thin data cannot demote anyone)
- ✅ Deposit percentage always equals the commission tier - a promoted tour collects its full commission at checkout (found and fixed 25 July, with existing data repaired)
- 🟡 "Force majeure" days are honoured indirectly (admin-made cancellations never count against an operator), but there is no dedicated pardon screen
- 🟡 A Spotlight clears its paid highlight when it expires; there is no way yet to cancel a live Spotlight early
- ⬜ Suspending tier billing while a tour is unbookable

### Money flow and payouts
- ✅ Settlement ledger recording exactly what Island Tours owes each operator - one entry per paid-in-full booking (the only model where the platform holds the operator's money), written the moment it confirms; deposit bookings settle themselves and are deliberately kept out of the ledger (reworked 26 July for clarity)
- ✅ Manual, clawback-safe payout: a payout only becomes payable once the booking's cancellation window closes, and it is marked "Paid out" only when an admin confirms the bank transfer was actually made - the ledger never claims money moved when it did not
- ✅ Self-healing: settlements on cancelled bookings are reversed automatically; forfeited bookings deliberately keep theirs
- ⬜ Commission collection rail for the payment model held back for version 2
- ⬜ Automated operator payouts via a connected-accounts model (version 2)

### Reviews
- ✅ Review submission tied to a real confirmed booking, one per booking
- ✅ Moderation queue, operator replies and "helpful" votes
- ✅ Rating summaries, star distribution and photo-review counts
- ✅ Sensible display rules for tours that are new and have few reviews
- ✅ Third-party review integration (e.g. Trustpilot / Google) for homepage social proof
- ✅ Post-tour review collection: automatic invitation emails on an admin-set schedule (with a reminder), each carrying a secure personal link to a review page with star rating and photo upload
- ✅ Per-language review text: reviews are machine-translated into the other languages automatically, with a "show original" option on the site

### Email and notifications
- ✅ Booking confirmation email matching the approved design exactly, aware of the payment model
- ✅ "Booking received" email to the operator on every confirmed booking
- ✅ Cancellation emails to traveller, operator and admin, with refund-aware wording
- ✅ Account, invitation, password reset and verification emails
- ✅ Dark-mode-safe branding across all email templates
- ✅ Automated notifications out to connected reseller systems
- ✅ Review invitation email with a reminder variant
- ⬜ Balance-payment email naming the operator and carrying the secure payment link (held deliberately - awaiting your decision)
- 🟡 Pre-tour reminder 24 hours before departure - the scheduling machinery is live; the email itself waits on your approval of its content
- ⬜ Backup email provider if the primary one has an outage

### Search
- ✅ Search and type-ahead suggestions across tours, with commission-tier ranking applied
- ✅ Prices shown in the visitor's chosen currency
- ⬜ Advanced two-stage search ranking as specified - current search is straightforward matching plus the tier ranking

### Media
- ✅ Media library with upload, signed direct upload, metadata editing and bulk delete
- ✅ All web image, video and audio formats supported
- ✅ Automatic image optimisation and sizing

### Content management
- ✅ Site settings: branding, SEO defaults, social profiles, company details, payment configuration
- ✅ Homepage content management (hero, editorial, featured experiences, FAQs) in all languages
- ✅ "Top Island Experiences" curation, restricted to categories and hubs
- ⬜ General page builder for legal, marketing and editorial pages (blocked, see section 4)

### Analytics
- ✅ Single dashboard data feed covering revenue, bookings, customers and trends
- ✅ Revenue shown differently to admins (commission) and operators (their net) with no cross-operator leakage
- ✅ Correct handling of refunds, mixed currencies, and guest bookings
- ✅ Honest reporting: no invented numbers, and unavailable figures are removed rather than faked
- ✅ Payout figures read the settlements ledger directly, so the analytics overview and the Settlements page always show the same number (fixed 25 July after they diverged)
- ⬜ Pre-booking funnel (page views, add to cart) - depends on visitor analytics being switched on

### Background jobs
- ✅ Nightly run covering Spotlight lifecycle, demand signals, availability, bookability, quality scores and eligibility
- ✅ Queued image uploads and reseller notifications
- ✅ Automatic exchange-rate refresh, now with a real market-rate source (European Central Bank) built in
- ✅ Seats from expired, unpaid holds are released automatically every minute
- ✅ Reliable delivery layer: booking confirmations, operator notices, conversion reporting and refunds all run as retried background jobs, recorded in the database first so nothing is lost if a send fails
- ✅ Hourly settlement self-heal sweep (voids obligations on cancelled bookings) and the pre-tour reminder scheduling
- 🟡 Nightly jobs run inside the application rather than on a managed queue - fine on one server, would duplicate if a second is added
- 🟡 Failed background jobs are kept for inspection, but there is no admin screen showing them yet
- ⬜ Marketing postback job (reporting cancellations back to the ad platforms)

### Testing
- ✅ Extensive automated test coverage on the engine (over 1,600 individual checks across 76 areas)
- ✅ End-to-end tests for health, login, settings, tours and reviews
- ⬜ Overbooking stress test - the single most important test for a booking platform
- ⬜ Test coverage for wishlists, web addresses, the nightly job pipeline and the shared FAQ engine
- ⬜ Load testing of availability and booking under burst traffic

---

## 2. Dashboard (admin and operator tools)

The back-office where you and your operators run the business. Twenty-four modules are built and working - Reviews, Settlements and Customers all landed this week; the gaps are a small number of screens that were never started, plus a redesign programme that is partway through.

### Getting in and getting around
- ✅ Three separate login doors: operator, staff/admin, and customer, each with forgot and reset password
- ✅ Operator onboarding wizard for new operator businesses
- ✅ Menu reorganised into four task-based groups, with operators and admins seeing genuinely different products
- ✅ Quick-jump command palette (keyboard shortcut) to any tour, booking or destination
- ✅ Permission-driven menu: an item you cannot use simply is not shown
- ✅ Light and dark themes, both checked for readability
- 🟡 The staff profile page works but is currently unlinked from the menu
- 🟡 Attention badges on menu items: live counts for pending reviews and pending cancellations; bookings-needing-action and Spotlight badges still to come
- ⬜ Final visual sign-off and the live domain move (see section 4)

### Tours
- ✅ Full tour editor across 13 tabs: details, pricing, schedules, copy, images, highlights, inclusions, itinerary, pickups, terms, attributes, promotion, SEO
- ✅ Translations for every tour and every sub-item in all 7 languages
- ✅ Publish, pause, archive and restore, with a readiness checklist
- ✅ Commission tier picker and Spotlight request in a "Promotion" tab
- ✅ Simplify tour creation from around 30 fields to 4, then fill in the detail afterwards
- ✅ Block Publish until the readiness checks pass, naming exactly what is missing
- ✅ Reorganise the 13 tabs into 4 clear groups with a single save per screen
- ✅ Every price field labelled in the tour's own pricing currency - no hardcoded currency symbols anywhere
- ✅ Switching a tour's currency asks for confirmation and explains that the numbers stay as entered
- ✅ Paid pickup zones with their own prices, managed on the Pickups tab
- ⬜ Faster bulk schedule creation (a 7-day, 3-time schedule is currently slow to save)

### Destinations, categories, hubs and collections
- ✅ Full create, edit and delete for all four, with translations, page content, SEO and FAQs
- ✅ Hub curation tools: allowed categories, our picks, comparison tables, content sections
- ✅ Collection tour management with per-tour editorial notes per language
- ✅ Delete protection on pre-set destinations
- ✅ Consistent editor layout across all four modules (planned redesign)
- ✅ Point the per-entity translation tabs at the central translation console

### Bookings
- ✅ Bookings list with search, filters, pagination and correct currency display
- ✅ Cancel action, permission-gated and limited to valid booking states
- ✅ Commission column visible to admins only
- ✅ Full booking detail panel (slide-out) with next/previous navigation and refund status
- ✅ Non-payment reporting and forfeit handling: operator reports, admin confirms or dismisses, with matching status filters ("Non-payment reported", "Forfeited")
- ✅ Automated tests

### Cancellation requests
- ✅ Dedicated screen, oldest request first, with refund-entitlement guidance
- ✅ Rebuild as a true inbox: pending first, refund due as a column, approve or reject in place, count badge in the menu

### Payments and refunds
- ✅ Payments list with provider, method, status and refund columns
- ✅ Row actions on every payment (26 July): jump to the booking, copy the booking or payment reference, open the charge directly in Stripe or Mollie, and retry a failed refund - each with the right permissions
- ✅ Refund statuses read correctly everywhere (26 July): once a refund settles, both the refund entry and the original charge show "Refunded" - a refunded charge never shows a green "Succeeded" again
- ✅ Refunds are issued automatically by the engine on approved cancellations and shown on bookings, payments and settlements
- 🟡 A dedicated refunds oversight screen and a payment detail panel are still to build
- ⬜ Manually issue a refund outside the cancellation flow (deliberately not offered yet)

### Settlements and payouts
- ✅ Settlements screen reworked (26 July) to be self-describing on both sides: every row is a paid-in-full booking showing the booking total, the commission Island Tours keeps, and the payout owed the operator, with plain-words statuses (Payout due / Paid out / Reversed) and a what-happens-next line on every row
- ✅ Manual "Mark as paid" action for admins (with a confirmation step and an undo): a payout shows "Paid out" only after you confirm the bank transfer was actually made; rows only become payable once the cancellation window closes and never while a cancellation request is pending
- ✅ Searchable by booking reference, filterable by status and date, and - for admins - by operator
- ✅ Operators see the same ledger scoped to themselves, worded from their side: "Due to you from Island Tours" and "Paid to you" - no guessing
- ✅ The analytics "payouts due" figure and this screen always match (same ledger)
- ⬜ Operator payout statements (a per-operator statement view or export)

### Operators
- ✅ Full operator management including company details, social profiles and payment configuration
- ✅ Operator invitation and onboarding

### Staff and teams
- ✅ Complete staff module: invitations, job titles, permission templates and per-person overrides
- ✅ One model covering both your own staff and operator team members
- ✅ Safeguards preventing anyone from granting themselves more access than they have
- ✅ Suspension and status lifecycle surfaced beyond the list view

### Customers
- ✅ Customer login door, own bookings, own payments and profile management
- ✅ Customers directory for the business side: every traveller with booking history, a one-click "Ask for review" action, and bulk email
- ✅ "Leave a review" action on the customer's own bookings list

### Reviews
- ✅ Moderation queue: approve, hold or reject in place, filter by tour, rating or status, bulk approve (pending items shown first by default)
- ✅ Reviews back in the menu, with a live pending-count badge
- ✅ Review analytics panel inside Statistics (volume, ratings, response coverage)
- ✅ Automated tests for the moderation queue

### Promotion and curation
- ✅ Spotlight approval queue for admins, with the three-per-island cap enforced
- ✅ "Locals' favourites" curation screen, admin-only and never set by operators
- ✅ Featured experiences curation inside the homepage module
- ✅ Turn Spotlight into a true inbox with a pending-count badge
- ✅ Show locals' favourites coverage against the roughly 30% editorial target

### Media library
- ✅ Full library with direct upload, metadata editing, grid and list views, bulk actions
- ✅ Infinite scrolling (the earlier 100-item ceiling is resolved)
- ✅ Every image field across the dashboard uses the shared picker, never a pasted link
- ⬜ "Used by" indicator so you can see where an image is used before deleting it
- ⬜ Tagging and server-side filtering

### Translations
- ✅ Central translation console with an overview matrix and a per-language workspace
- ✅ The console is now the single way to translate - the older per-page translation tabs have been removed
- ✅ Console coverage extended to page content, island About sections and SEO fields
- ⬜ Bulk "pre-translate" action to fill empty languages from English (the translation engine now exists - reviews already use it - but the bulk action does not)
- ⬜ Flag showing when the English source changed after a translation was saved

### Homepage and pages
- ✅ Homepage editor: hero, editorial, featured experiences, FAQs and SEO, with links into translations
- ⬜ General pages module for legal, marketing and editorial pages - never built (blocked, see section 4)
- ⬜ Rich-text editor for page content

### Analytics
- ✅ Live overview with real revenue, bookings, customers, trends and top performers
- ✅ Refund figures included (26 July): a "Refunded to travellers" total on the admin overview, and the Recent Activity feed now also lists the latest cancellations (who cancelled, refund owed or not) and the latest refunds with their live status - a stuck refund is visible at a glance
- ✅ Date-range selection carried in the address so a view can be shared
- ✅ Role-correct figures - operators see their own numbers only
- ⬜ Make every figure clickable through to the list that produced it
- ⬜ Pre-booking funnel (views, add to cart) - depends on the tracking layer

### Settings
- ✅ Site details, SEO, social profiles, company information, payment providers and integrations
- ✅ Marketing credentials managed in Settings: Google Tag Manager container, Cookiebot consent ID, Meta conversion API (with test code), Google Translate
- ✅ Review invitation schedule (when the ask email goes out, and the reminder)
- ✅ Instagram feed management (account, posts and videos, layout) feeding the public site
- ✅ WhatsApp and FAQ host photo/video managed by admins
- ✅ Separate, simpler settings view for operators, including their payout-provider choice
- ⬜ Deep-linkable settings sections and search within settings
- ⬜ Connection status and "test connection" for Stripe, Mollie and Mailchimp

### Not yet started
- ⬜ Notifications: in-app feed, read state and operator notification preferences
- ⬜ Currency and exchange-rate administration
- ⬜ Web address / redirect administration screen

### Testing
- ✅ Automated tests exist for the catalogue modules (attributes, categories, collections, destinations, hubs, tours) and now the review moderation queue
- 🟡 The older catalogue suite carries checked-in failures and needs repair before it can be trusted
- ⬜ No tests at all for bookings, payments, cancellations, settlements, staff, settings, media, analytics or translations

---

## 3. Public website (what travellers see)

The traveller-facing site. The path from browsing to paying is genuinely built and working. What remains is largely visibility, measurement, content lock-in and polish.

### Site foundation
- ✅ Design system, brand colours, fonts, spacing and motion standards applied site-wide
- ✅ Header with island selector, categories menu, search, language switcher, wishlist and account
- ✅ Footer on every page with destination links, legal links, language and currency switchers
- ✅ Fast page loading through pre-built pages and progressive content loading
- ✅ Automatic content refresh when you publish a change in the dashboard
- ✅ Progressive-loading behaviour cleaned up so sections either genuinely stream with their placeholders or render instantly
- ⬜ Accessibility and colour-contrast audit
- ⬜ Payment logos and "Powered by Stripe" badge in the footer
- ⬜ Footer pages for About, Help and Contact - the links exist but the pages do not

### Homepage
- ✅ Hero with island search, trust strip, top experiences, testimonials, explore islands, editorial banner and FAQs
- ✅ Live island data and live third-party review testimonials
- ✅ Homepage content edited in the dashboard now appears on the live site - copy, hero image and FAQs, in all 7 languages
- ✅ Featured experiences curated in the dashboard are shown, with sensible fallbacks and island-linked editorial cards
- ⬜ Locked headline, subheadline and search placeholder copy verification
- ⬜ Popular islands quick-links row
- ⬜ Video carousel section
- ⬜ "Why Island Tours" section and the full help section

### Destination pages
- ✅ Destination page with hero, search, locals' favourites, collections, category quick links and about content
- ✅ Safe fallback so the launch islands still render if the engine is briefly unavailable
- ✅ Destination FAQs are destination-specific, managed in the dashboard
- ✅ Real About-section copy for every island, managed in the dashboard
- ✅ The Instagram strip is managed content (account and posts chosen in Settings)
- ⬜ Locked headline and subheadline copy
- ⬜ Destination description at the agreed length and structure
- ⬜ Full help section
- ⬜ Loading placeholder on first visit to a not-yet-built island page

### Tour listing and filters
- ✅ "All tours" page with pagination, empty state, filter bar and filter panel
- ✅ Sorting locked to three options, with locals' favourites as the default
- ✅ Category chips linking through to category pages
- ✅ Filters for category, price, rating, duration, free cancellation and pickup
- ✅ Filter choices held in the web address, so a filtered view can be shared or bookmarked
- 🟡 The date control appears but does not yet filter by availability
- 🟡 Price slider uses a fixed maximum rather than one derived from your catalogue
- 🟡 Free-cancellation filter is a simple toggle rather than the agreed 24 / 48 / 72 hour choice
- ⬜ Date, guests and time-of-day filters
- ✅ Page headline (and browser title) including the current year, resolved automatically
- ⬜ Locked grid density (18 per page desktop, 12 on mobile)
- ⬜ Applied-filter pills with "clear all", and a live count on the Apply button
- ⬜ Ranking transparency tooltip on the results count

### Tour detail page
- ✅ Full tour page: gallery, header, meeting and pickup, sectioned content, reviews, related tours
- ✅ Every tour page pre-built for speed and search engines
- ✅ Save and share actions
- ✅ Sticky booking widget alongside the content
- 🟡 The three quick-info badges and the review preview module are not confirmed against the locked design
- ⬜ Sticky section navigation down the page
- ⬜ "Supplied by {operator}" line
- ⬜ Cancellation policy written out in the locked wording
- ✅ Star-distribution chart, review sorting and filtering (traveller type, photos, language), and per-review translation with a "show original" toggle
- ⬜ Two separate related-tour rows
- ⬜ "Likely to sell out" demand card

### Tour cards (used on every listing)
- ✅ One shared card used everywhere, fully clickable, with wishlist heart and badges
- ✅ Consistent grid across the whole site
- ✅ Per-person versus per-group price wording
- 🟡 Badge colour hierarchy and the "one badge per card" rule are not confirmed
- ⬜ Photo carousel on desktop cards with a final description slide
- ⬜ Language-aware duration and number formatting
- ⬜ Rating row hidden until a tour has at least three reviews, with a "New" badge instead
- ⬜ Pickup wording driven by whether pickup is included, paid or unavailable
- ⬜ "Price on request" fallback for unpriced tours

### Booking and checkout
- ✅ Booking widget: date picker, time slots, traveller selection, age bands, spectators, live price
- ✅ Live availability against real departures, and live server-quoted totals
- ✅ Prices update instantly when the visitor changes currency
- ✅ Cancellation and deposit information modals
- ✅ Checkout with contact details, country and phone, pickup selection, and a persistent booking summary
- ✅ Tour repriced in the shopper's chosen currency at checkout
- 🟡 The widget trust lines are not confirmed against the locked two-line design
- ⬜ "Only N left" scarcity note on date cells
- ⬜ Booking cut-off and 12-month-ahead limits shown in the calendar
- ⬜ "These trips still have room" suggestions when everything is sold out
- ⬜ Locked error messages throughout the widget and checkout
- ⬜ Single-page accordion checkout layout
- ⬜ Special requests field, marketing opt-in notice and locked payment-step trust lines
- ⬜ Handling the case where a slot sells out during checkout
- ⬜ Mobile full-screen booking summary

### Payment
- ✅ Card payment taken inline on your own checkout page (Stripe)
- ✅ PayPal and iDEAL redirect payments
- ✅ Payment methods shown only when eligible
- ✅ Processing page that waits for confirmation before showing the result
- 🟡 The payment-method list is built but not confirmed against the locked presentation
- ⬜ Klarna, Apple Pay and Google Pay
- ⬜ Duplicate-charge protection on retry
- ⬜ Locked "processing" loading state

### Confirmation (thank-you page)
- ✅ Confirmation page with tour, date, party, reference, payment status and next steps
- ✅ Three privacy-aware views depending on whether the visitor is verified
- ✅ Add to calendar, resend confirmation email, support card and cross-sell
- ✅ Manage-booking header with a cancel link when eligible
- ✅ Conversion tracking fired on this page, valued on commission earned, exactly once per booking (goes live when tracking is switched on)
- ⬜ Tailored messaging for edge cases: tour today or tomorrow, balance overdue, fully paid, pending confirmation

### Managing a booking
- ✅ Booking lookup by email and reference, no password needed
- ✅ "Lost your reference?" recovery
- ✅ Secure 24-hour traveller session
- ✅ Cancellation request page with all five outcomes handled and refund line shown when relevant
- ✅ Visible logout control in the account menu
- ⬜ Locked page copy and minimal branded layout
- ⬜ Invoices and saved tours inside the booking area

### Customer accounts
- 🟡 A lightweight account menu links to bookings only
- ⬜ Full customer account area - built in the dashboard, not yet linked from the public site
- ⬜ Wishlist and invoices surfaced inside the account area

### Search
- ✅ Search results page with pagination and language-aware page titles
- ✅ Header search with type-ahead suggestions, shared with the destination search
- 🟡 Type-ahead behaviour built, but the locked grouping and placeholder rules are unconfirmed
- ⬜ Filters and sorting on search results
- ⬜ Empty-state recovery with popular searches and category links

### Wishlist
- ✅ Wishlist page, heart control on every tour card, works for signed-out visitors too
- ⬜ Wishlist tracking event for marketing

### Reviews
- ✅ Reviews displayed on tour pages with ratings and counts, photo-forward cards, star-distribution chart, sorting, depth filters and per-review translation
- ✅ Third-party reviews powering homepage testimonials
- ✅ Review submission: a secure personal review page (star rating, text, photo upload) reached from the invitation email - no login needed
- ✅ Post-tour review invitation sent automatically on your schedule, with a reminder, plus a manual "ask for review" from the dashboard

### Languages and currency
- ✅ All 7 languages fully wired and genuinely translated across the whole interface
- ✅ Tour, category, hub and collection content translated per language
- ✅ Automatic language detection and remembering the visitor's choice
- ✅ Currency switcher with exact-decimal prices site-wide
- ✅ Currency suggested by the visitor's location on first visit (a stored choice is never overwritten)
- ✅ Homepage editorial copy is dashboard-managed per language
- 🟡 Currency is limited to EUR and USD
- 🟡 Legal pages are English-only in every language, with a notice banner
- ⬜ Language-aware number and duration formatting

### Search engine visibility
- ✅ Page titles, descriptions and social sharing images fully managed from the dashboard
- ✅ Per-page titles and descriptions for category, hub, collection and tour pages
- ✅ Language alternates and canonical addresses on tour and category pages
- ✅ Private pages (checkout, confirmation, search, wishlist) correctly hidden from search engines
- ✅ Language alternates on the homepage, island pages, listing pages, tour pages, search and legal pages (all 7 languages)
- ✅ Sitemap covering every page type in every language, with last-modified dates, refreshed automatically
- ✅ Robots file (public pages allowed, private surfaces blocked, sitemap declared)
- ✅ Structured data for rich results: organisation, site search, breadcrumbs, FAQs, destinations, tours with prices, ratings and reviews
- ⬜ Help centre page with FAQ rich results
- 🟡 Thin category pages are kept out of the sitemap; the pages themselves still render from one tour upward

### Analytics and tracking
- ✅ Tag-management layer built in: the container ID is entered once in dashboard Settings and loads sitewide (kept off until you switch tracking on)
- ✅ Conversion event on booking completion, valued on commission earned, fired exactly once per booking
- ✅ Server-side conversion reporting to Meta with privacy-safe hashed matching, retried automatically and de-duplicated against the browser event
- ✅ Capturing which ad or campaign a booking came from (Google and Meta click ids plus campaign tags, remembered for 90 days)
- ✅ Consent signalling to the ad platforms (EU/UK visitors start denied, elsewhere granted - the EU-compliant default)
- ✅ Cookie consent banner and cookie preferences page (Cookiebot)
- 🟡 The whole layer waits on the advertising accounts: enter the tag manager container, pixel and consent IDs, configure the four tags per the prepared guide, and switch tracking on
- ⬜ Product, search, wishlist and login events for marketing insight

### Legal pages
- ✅ Six legal pages live: terms, privacy, cookies, cancellation policy, legal notice and cookie preferences
- ✅ Approved wording preserved exactly as handed over
- 🟡 Legal text is fixed in the code rather than editable in the dashboard
- ⬜ Migrate legal pages into the page builder once it is built

### Performance and polish
- ✅ Fast, pre-built pages with progressive loading and 13 loading placeholders
- ✅ Motion and interaction standards applied consistently
- ✅ Graceful handling of missing pages and engine outages
- ✅ Branded, translated "page not found" page with recovery links
- ✅ Branded error page if something goes wrong
- 🟡 Clean-up of leftover code from before the dashboard was split out - the mock data file and old component clutter are gone; a final sweep remains
- 🟡 First automated tests on the public website (tour review display); broad coverage of booking and checkout still missing
- ⬜ Consistent loading-time behaviour rules across the site

---

## 4. Needs your decision

These items are genuinely waiting on you rather than on development. Each one is blocking work that is otherwise ready to go.

**1. Hosting and domain for the dashboard**
The dashboard is finished and tested but cannot go live. It needs a hosting project created and the domain pointed at it, and that domain must then be authorised on the engine. A temporary hosting address will not work - logins fail on any address that is not on your own domain, so there is no "launch now, domain later" option.
*You need to: create the hosting project, point the DNS, and confirm the domain is authorised.*

**2. How the payout money physically moves**
Decided and built (26 July): payouts are manual for now. The settlements screen shows exactly which payouts are due and ready; you make the bank transfer yourself and click "Mark as paid" on the row, which updates the operator's view instantly. The open question for version 2 remains whether to automate this via connected-account payouts (Stripe Connect). Deposit-based bookings are self-settling and need no decision.
*You need to: confirm manual transfers against the ledger for version 1, or ask for the connected-accounts build.*

**3. Is the fourth payment model in scope?**
One payment model - where the operator collects the entire payment and owes you commission afterwards - was dropped from version 1 in a decision on 15 July, but several specification documents still describe it as live. Confirming the drop lets us remove the unused branches from the checkout, emails and confirmation page.
*You need to: confirm it stays out of version 1.*

**4. Marketing and tracking accounts**
The measurement layer is now fully built and waiting: consent handling, the conversion event, server-side Meta reporting and ad-click attribution are all live code, switched off. It stays dark until the accounts exist and are connected.
*You need to: create/supply the Google Tag Manager, Google Ads, GA4 and Meta accounts; enter the container ID, pixel ID and Cookiebot ID in dashboard Settings; configure the four tags in Tag Manager following the prepared guide (`GTM-CONTAINER-SETUP.md`); then ask for tracking to be switched on in production.*

**4b. Two email decisions**
Two emails are held on your word: the invoice/receipt attached to the confirmation email (own PDF vs a payment-provider receipt link - the providers issue no invoices themselves), and the pre-tour reminder (its scheduling machinery is already live; only the content needs your approval).
*You need to: pick the invoice approach, and approve the reminder email content.*

**5. Production secrets**
Two shared keys are only set in the example files, not in the real live environments. Without them, published dashboard changes may not appear on the public site promptly, and internal page requests get rate-limited.
*You need to: set both keys on the engine, the public site and the dashboard.*

**6. Category page headlines**
Nineteen categories across three islands and seven languages need a headline strategy: one uniform template ("Tours in Curaçao") or a keyword-matched headline per category ("Sunset cruises in Curaçao"). This has real search-visibility consequences and is the last open item on the founder decision list.
*You need to: choose uniform or per-category headlines.*

**7. Editorial pages system**
The page builder for legal, marketing and editorial pages cannot start until two things are settled: whether custom pages sit directly under the language prefix (which risks a clash with island addresses) or under a namespace such as /legal/ (which changes six live, search-indexed addresses), and confirmation to proceed with the recommended rich-text editor.
*You need to: confirm the address structure - the recommendation is to keep existing addresses - and approve the editor choice.*

**8. Operator sign-up: open or invite-only?**
The documents disagree on whether tour operators register themselves or are invited by an admin. This changes onboarding, vetting and the purpose of the "apply" page.
*You need to: choose self-registration or admin invitation.*

**9. Two Cloudinary accounts in use**
Media is currently split across two separate image-hosting accounts. Existing images keep working, but new uploads land in one account and older assets sit in the other.
*You need to: decide whether to consolidate into one account or leave the split as is.*

**10. Smaller product calls**
- Keep or remove the weather widget in the dashboard header
- Confirm the operator two-factor authentication approach and which languages the operator portal launches in
- Category pages currently show at one tour minimum; confirm the move to a three-tour minimum
- A final visual sign-off pass on the dashboard is owed and cannot be done by a developer

---

## 5. Known gaps worth flagging

Things that look complete but are not yet doing their job for the business. Five of the eight gaps flagged on 21 July are now closed (search-engine visibility, homepage publishing, Mollie confirmation, expired-hold seat release, and review submission). What remains:

**1. The measurement layer is built but switched off.**
Analytics, conversion tracking, consent handling and ad attribution are all live code, but nothing is measured until the advertising accounts are supplied, the IDs are entered in Settings, the Tag Manager container is configured (a step-by-step guide is prepared), and tracking is switched on. Until then you still cannot see traffic sources or advertising return.

**2. Live exchange rates exist but production still runs on the fixed rate.**
A real market-rate source (European Central Bank) is built, and every actual payment now records the payment provider's true exchange rate. But the engine's default setting still points at the fixed rate - one production setting (`FX_PROVIDER=ecb`) needs flipping, after which displayed conversions follow the market.

**3. Two shared production keys are still unset.**
Without them, published dashboard changes may not appear on the public site promptly, and internal page requests get rate-limited. Same item as "Needs your decision" #5 - it costs nothing but a deployment edit.

**4. Payments in the dashboard have basic actions but no detail screen.**
Refunds execute automatically on approved cancellations, every payment row now has actions (jump to booking, open in Stripe/Mollie, retry a failed refund), and refund statuses read correctly everywhere. Still missing: a payment detail panel and a refunds oversight view; a refund outside the cancellation flow still means the provider's own dashboard.

**5. The public website's automated test coverage is thin.**
The engine has over 1,600 automated checks; the customer-facing site has only its first few. A change to checkout, pricing or the booking widget can still break silently and would only be caught by someone manually clicking through.

**6. No off-site database backups or error alerting yet.**
The platform runs reliably, but there is no automated nightly backup kept off the server and no alerting that notices a failure before a customer reports it. Cheap insurance that is still unbought.
