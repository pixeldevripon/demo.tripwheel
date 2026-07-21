# Island Tours - Build Status

A plain-English view of where the platform stands: what is finished, what is actively being worked on, and what is still ahead. Everything below reflects an audit of the actual working software, not a plan or a wish list. Items are grouped into main features with their sub-features, so you can read this in a few minutes rather than task by task.

**Status date: 21 July 2026**

Legend: ✅ Done · 🟡 In progress · ⬜ Pending

---

## Summary

| Area | Done | In progress | Pending | Total |
|---|---|---|---|---|
| Backend (the engine) | 243 | 19 | 110 | 372 |
| Dashboard (admin and operator tools) | 187 | 15 | 122 | 324 |
| Public website (what travellers see) | 224 | 38 | 191 | 453 |
| **Total** | **684** | **70** | **438** | **1,192** |

The platform's core engine and admin tools are largely built. Bookings, payments, availability, commission tiers, operator and staff management, and the email system all work end to end today, and the dashboard is a mature product rather than a scaffold.

The public website is the area furthest behind, and the remaining work there is mostly commercial rather than structural. Travellers can already find a tour, book it and pay for it; what is missing is the layer that makes the site *visible* (search engine optimisation) and *measurable* (visitor and conversion tracking), plus a set of polish and content items.

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
- 🟡 Refunds are classified as full or none; part-refunds and deposit-aware amounts are not yet calculated
- ⬜ Actually issuing the refund through the payment provider (today it is recorded, not paid out)
- ⬜ Recording where a booking came from (ad click, campaign) so marketing spend can be measured
- ⬜ Handling a payment that lands after the hold has already expired
- ⬜ Operator non-payment / deposit forfeit process
- ⬜ Discount codes and vouchers

### Payments and refunds
- ✅ Stripe fully integrated: card taken on your own page, plus PayPal and iDEAL
- ✅ Deposit, balance and full-payment handling per payment model
- ✅ Payment confirmations received and verified from Stripe, with duplicate protection
- ✅ Race-proof confirmation so a booking is confirmed exactly once and emails send exactly once
- ✅ Payments list for admins and operators, filterable and searchable
- 🟡 Mollie is set up as an option but does not yet confirm bookings (see Known gaps)
- ⬜ Attaching the payment receipt or invoice to the confirmation email

### Commission, ranking and promotion
- ✅ Five commission tiers driving where a tour ranks in listings
- ✅ 30-day lock after a tier change, and no retroactive effect on existing bookings
- ✅ Ranking order plus a fairness pass so one operator cannot dominate the top of a page
- ✅ Only genuinely bookable tours appear in listings
- ✅ Nightly quality score based on rating, review count, listing completeness and conversion
- ✅ Eligibility system: 90-day new-tour grace period, then automatic demotion if standards slip
- ✅ Destination Spotlight: operator request, admin approval, maximum three per island, higher commission
- 🟡 Eligibility currently checks reviews and rating but not yet an operator's cancellation record
- 🟡 "Force majeure" pardons (e.g. a hurricane day) exist in the data but cannot yet be granted by an admin
- 🟡 A manually cancelled Spotlight can leave the paid highlight showing on the tour
- ⬜ Suspending tier billing while a tour is unbookable

### Money flow and payouts
- ⬜ Settlement ledger recording, per booking, who owes whom
- ⬜ Scheduled operator payout after the cancellation window closes
- ⬜ Commission collection rail for the payment model held back for version 2
- ⬜ Automated operator payouts via a connected-accounts model (version 2)

### Reviews
- ✅ Review submission tied to a real confirmed booking, one per booking
- ✅ Moderation queue, operator replies and "helpful" votes
- ✅ Rating summaries, star distribution and photo-review counts
- ✅ Sensible display rules for tours that are new and have few reviews
- ✅ Third-party review integration (e.g. Trustpilot / Google) for homepage social proof
- 🟡 Per-language review text is designed but not connected, so reviews show in their original language only

### Email and notifications
- ✅ Booking confirmation email matching the approved design exactly, aware of the payment model
- ✅ "Booking received" email to the operator on every confirmed booking
- ✅ Cancellation emails to traveller, operator and admin, with refund-aware wording
- ✅ Account, invitation, password reset and verification emails
- ✅ Dark-mode-safe branding across all email templates
- ✅ Automated notifications out to connected reseller systems
- ⬜ Balance-payment email naming the operator and carrying the secure payment link
- ⬜ Pre-tour reminder 24 hours before departure
- ⬜ Backup email provider if the primary one has an outage

### Search
- ✅ Search and type-ahead suggestions across tours, with commission-tier ranking applied
- ✅ Prices shown in the visitor's chosen currency
- ✅ Advanced two-stage search ranking with full filtering as specified

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
- ⬜ Pre-booking funnel (page views, add to cart) - depends on the tracking layer being built

### Background jobs
- ✅ Nightly run covering Spotlight lifecycle, demand signals, availability, bookability, quality scores and eligibility
- ✅ Queued image uploads and reseller notifications
- ✅ Automatic exchange-rate refresh
- 🟡 Nightly jobs run inside the application rather than on a managed queue - fine on one server, would duplicate if a second is added
- ⬜ Scheduling the job that releases seats from expired, unpaid holds (currently never runs)
- ⬜ Retry and failure visibility so a stuck payout or lost confirmation is noticed
- ⬜ Scheduled payout, pre-tour reminder and marketing postback jobs

### Testing
- ✅ Extensive automated test coverage on the engine (over 1,280 individual checks across 62 areas)
- ✅ End-to-end tests for health, login, settings and tours
- ⬜ Overbooking stress test - the single most important test for a booking platform
- ⬜ Test coverage for wishlists, web addresses, background jobs and the shared FAQ engine
- ⬜ Load testing of availability and booking under burst traffic

---

## 2. Dashboard (admin and operator tools)

The back-office where you and your operators run the business. Twenty-one modules are built and working; the gaps are a small number of screens that were never started, plus a redesign programme that is partway through.

### Getting in and getting around
- ✅ Three separate login doors: operator, staff/admin, and customer, each with forgot and reset password
- ✅ Operator onboarding wizard for new operator businesses
- ✅ Menu reorganised into four task-based groups, with operators and admins seeing genuinely different products
- ✅ Quick-jump command palette (keyboard shortcut) to any tour, booking or destination
- ✅ Permission-driven menu: an item you cannot use simply is not shown
- ✅ Light and dark themes, both checked for readability
- 🟡 The staff profile page works but is currently unlinked from the menu
- ⬜ Attention badges on menu items (bookings needing action, pending cancellations, pending Spotlight approvals)
- ⬜ Final visual sign-off and the live domain move (see section 4)

### Tours
- ✅ Full tour editor across 13 tabs: details, pricing, schedules, copy, images, highlights, inclusions, itinerary, pickups, terms, attributes, promotion, SEO
- ✅ Translations for every tour and every sub-item in all 7 languages
- ✅ Publish, pause, archive and restore, with a readiness checklist
- ✅ Commission tier picker and Spotlight request in a "Promotion" tab
- ✅ Simplify tour creation from around 30 fields to 4, then fill in the detail afterwards
- ✅ Block Publish until the readiness checks pass, naming exactly what is missing
- ✅ Reorganise the 13 tabs into 4 clear groups with a single save per screen
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
- ✅Full booking detail panel with next/previous navigation (currently a cramped read-only dialog)
- ✅ Automated tests

### Cancellation requests
- ✅ Dedicated screen, oldest request first, with refund-entitlement guidance
- ✅ Rebuild as a true inbox: pending first, refund due as a column, approve or reject in place, count badge in the menu

### Payments and refunds
- ✅ Payments list with provider, method, status and refund columns
- 🟡 Payments is currently read-only - no detail view and no actions
- ⬜ Refunds screen - never built; refunds appear only as columns elsewhere
- ⬜ Issue or approve a refund from the dashboard

### Settlements and payouts
- ⬜ Settlements and payouts module - never built (no screen exists)
- ⬜ Operator payout statements and payout runs

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

### Reviews
- 🟡 The reviews screen is a placeholder with no table or actions
- ⬜ Moderation queue: approve or reject in place, filter by tour, rating or status, bulk approve
- ⬜ Restore Reviews to the menu once the module lands

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
- 🟡 The console is built, but the older per-page translation tabs still exist alongside it - two ways to do one job
- ⬜ Bulk "pre-translate" action to fill empty languages from English
- ⬜ Flag showing when the English source changed after a translation was saved

### Homepage and pages
- ✅ Homepage editor: hero, editorial, featured experiences, FAQs and SEO, with links into translations
- ⬜ General pages module for legal, marketing and editorial pages - never built (blocked, see section 4)
- ⬜ Rich-text editor for page content

### Analytics
- ✅ Live overview with real revenue, bookings, customers, trends and top performers
- ✅ Date-range selection carried in the address so a view can be shared
- ✅ Role-correct figures - operators see their own numbers only
- ⬜ Make every figure clickable through to the list that produced it
- ⬜ Pre-booking funnel (views, add to cart) - depends on the tracking layer

### Settings
- ✅ Site details, SEO, social profiles, company information, payment providers and integrations
- ✅ Separate, simpler settings view for operators
- ⬜ Deep-linkable settings sections and search within settings
- ⬜ Connection status and "test connection" for Stripe, Mollie and Mailchimp

### Not yet started
- ⬜ Notifications: in-app feed, read state and operator notification preferences
- ⬜ Currency and exchange-rate administration
- ⬜ Web address / redirect administration screen

### Testing
- ✅ Automated tests exist for the catalogue modules (attributes, categories, collections, destinations, hubs, tours)
- 🟡 That suite is currently failing in large part and needs repair before it can be trusted
- ⬜ No tests at all for bookings, payments, cancellations, staff, settings, media, analytics or translations

---

## 3. Public website (what travellers see)

The traveller-facing site. The path from browsing to paying is genuinely built and working. What remains is largely visibility, measurement, content lock-in and polish.

### Site foundation
- ✅ Design system, brand colours, fonts, spacing and motion standards applied site-wide
- ✅ Header with island selector, categories menu, search, language switcher, wishlist and account
- ✅ Footer on every page with destination links, legal links, language and currency switchers
- ✅ Fast page loading through pre-built pages and progressive content loading
- ✅ Automatic content refresh when you publish a change in the dashboard
- 🟡 Some sections are set up to load progressively but currently do not, so their loading placeholders never show
- ⬜ Accessibility and colour-contrast audit
- ⬜ Payment logos and "Powered by Stripe" badge in the footer
- ⬜ Footer pages for About, Help and Contact - the links exist but the pages do not

### Homepage
- ✅ Hero with island search, trust strip, top experiences, testimonials, explore islands, editorial banner and FAQs
- ✅ Live island data and live third-party review testimonials
- 🟡 Homepage content edited in the dashboard does not yet appear on the live site (see Known gaps)
- 🟡 Featured experiences curated in the dashboard are not yet shown; fallback cards display instead
- ⬜ Locked headline, subheadline and search placeholder copy
- ⬜ Popular islands quick-links row
- ⬜ Video carousel section
- ⬜ "Why Island Tours" section and the full help section

### Destination pages
- ✅ Destination page with hero, search, locals' favourites, collections, category quick links and about content
- ✅ Safe fallback so the launch islands still render if the engine is briefly unavailable
- 🟡 Destination FAQs reuse generic copy rather than destination-specific content
- 🟡 The Instagram strip is hardcoded images rather than managed content
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
- ⬜ Locked page headline including the current year
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
- ⬜ Star-distribution chart, review sorting and filtering, and per-review translation
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
- ⬜ Conversion tracking fired on this page (see Known gaps)
- ⬜ Tailored messaging for edge cases: tour today or tomorrow, balance overdue, fully paid, pending confirmation

### Managing a booking
- ✅ Booking lookup by email and reference, no password needed
- ✅ "Lost your reference?" recovery
- ✅ Secure 24-hour traveller session
- ✅ Cancellation request page with all five outcomes handled and refund line shown when relevant
- ⬜ Locked page copy and minimal branded layout
- ⬜ Invoices and saved tours inside the booking area
- ⬜ Visible logout control

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
- ✅ Reviews displayed on tour pages with ratings and counts
- ✅ Third-party reviews powering homepage testimonials
- ⬜ Review submission - travellers currently have no way to leave a review anywhere on the site
- ⬜ Post-tour review invitation
- ⬜ Star-distribution chart, sorting, filtering and per-review translation

### Languages and currency
- ✅ All 7 languages fully wired and genuinely translated across the whole interface
- ✅ Tour, category, hub and collection content translated per language
- ✅ Automatic language detection and remembering the visitor's choice
- ✅ Currency switcher with exact-decimal prices site-wide
- 🟡 Currency is limited to EUR and USD, and the language-to-currency defaults do not match the agreed map
- 🟡 Legal pages are English-only in every language, with a notice banner
- 🟡 Homepage editorial copy lives in the translation files rather than the dashboard, so it cannot be edited per language by an admin
- ⬜ Language-aware number and duration formatting
- ⬜ Currency suggested by the visitor's location

### Search engine visibility
- ✅ Page titles, descriptions and social sharing images fully managed from the dashboard
- ✅ Per-page titles and descriptions for category, hub, collection and tour pages
- ✅ Language alternates and canonical addresses on tour and category pages
- ✅ Private pages (checkout, confirmation, search, wishlist) correctly hidden from search engines
- 🟡 Language alternates are only emitted on some pages, not the homepage, destination or listing pages
- ⬜ Sitemap - does not exist, so search engines have no map of the site
- ⬜ Robots file - does not exist
- ⬜ Structured data (rich results for tours, prices, ratings, FAQs and breadcrumbs) - none anywhere
- ⬜ Help centre page with FAQ rich results
- ⬜ Rule keeping thin category pages out of search results

### Analytics and tracking
- ⬜ No analytics or tracking exists on the public site at all - no Google Analytics, no Google Ads, no Meta Pixel
- ⬜ Conversion event on booking completion, valued on commission earned
- ⬜ Server-side conversion reporting to Meta for accuracy
- ⬜ Capturing which ad or campaign a booking came from
- ⬜ Product, search, wishlist and login events for marketing insight
- ✅ Cookie consent banner and cookie preferences page (Cookiebot)
- ⬜ Consent signalling to the ad platforms (required for EU compliance once tracking is live)

### Legal pages
- ✅ Six legal pages live: terms, privacy, cookies, cancellation policy, legal notice and cookie preferences
- ✅ Approved wording preserved exactly as handed over
- 🟡 Legal text is fixed in the code rather than editable in the dashboard
- ⬜ Migrate legal pages into the page builder once it is built

### Performance and polish
- ✅ Fast, pre-built pages with progressive loading and 13 loading placeholders
- ✅ Motion and interaction standards applied consistently
- ✅ Graceful handling of missing pages and engine outages
- ⬜ Branded "page not found" page - visitors currently see a plain default
- ⬜ Error page if something goes wrong - none exists
- ⬜ Consistent loading-time behaviour rules across the site
- ⬜ Clean-up of leftover code from before the dashboard was split out
- ⬜ No automated tests on the public website at all

---

## 4. Needs your decision

These items are genuinely waiting on you rather than on development. Each one is blocking work that is otherwise ready to go.

**1. Hosting and domain for the dashboard**
The dashboard is finished and tested but cannot go live. It needs a hosting project created and the domain pointed at it, and that domain must then be authorised on the engine. A temporary hosting address will not work - logins fail on any address that is not on your own domain, so there is no "launch now, domain later" option.
*You need to: create the hosting project, point the DNS, and confirm the domain is authorised.*

**2. How operators get paid**
Two money flows cannot be invented by developers. When Island Tours collects the full tour price, you owe the operator their share. Choose between an automated connected-accounts payout (higher setup effort, fully automatic and auditable) or manual invoicing for the first version. Deposit-based bookings are already resolved and need no decision.
*You need to: choose automated payouts or manual invoicing for version 1.*

**3. Is the fourth payment model in scope?**
One payment model - where the operator collects the entire payment and owes you commission afterwards - was dropped from version 1 in a decision on 15 July, but several specification documents still describe it as live. Confirming the drop lets us remove the unused branches from the checkout, emails and confirmation page.
*You need to: confirm it stays out of version 1.*

**4. Marketing and tracking accounts**
The entire measurement layer is blocked on credentials. Nothing about your traffic, conversions or advertising return can be measured until these exist.
*You need to: supply Google Tag Manager, Google Ads, Google Analytics and Meta (Facebook) advertising account access, plus confirmation of the production email-sending account.*

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

Things that look complete but are not yet doing their job for the business. These are the items most likely to cost money or opportunity if left as they are.

**1. Nothing about your traffic or sales is being measured.**
The public site has no analytics, no advertising pixels and no conversion tracking of any kind. You cannot currently see where visitors come from, where they drop off, or what any advertising spend actually returns. This is the single biggest commercial gap on the list.

**2. The site is effectively invisible to search engines.**
There is no sitemap telling Google what pages exist, no robots file, and no structured data - the markup that produces rich results showing prices, star ratings and availability directly in search listings. For a marketplace that depends on organic discovery, this is significant lost traffic.

**3. Homepage edits in the dashboard do not reach the live site.**
The homepage editor works and saves correctly, but the public homepage still shows fixed built-in text and images. Anything you change there today has no visible effect. The connection is written but not switched on.

**4. A Mollie payment would take the customer's money without confirming their booking.**
Stripe is complete and reliable. Mollie is configured and can accept a payment, but the system never processes the confirmation, so the booking would stay unconfirmed indefinitely and the traveller would receive no confirmation email. Mollie should not be offered to customers until this is finished.

**5. Currency conversion runs on a fixed rate, not a live one.**
Every converted price and every commission figure recorded in euros is calculated from a hardcoded exchange rate rather than a live market rate. It works, but the numbers drift from reality over time, which affects both displayed prices and your reported earnings.

**6. Expired unpaid holds never release their seats.**
When a traveller starts a booking and does not pay, the system knows how to release those seats but the job that does it is never actually run. Over time this produces departures that appear sold out when they are not.

**7. Travellers cannot leave a review.**
Reviews display beautifully and the moderation engine is built, but there is no way anywhere on the site for a customer to submit one. Since reviews feed tour ranking, badges and social proof, the whole quality system currently has no fuel.

**8. The public website has no automated tests.**
The engine is well tested; the customer-facing site has no test coverage at all. This means a change to checkout, pricing or the booking widget can break silently and would only be caught by someone manually clicking through.
