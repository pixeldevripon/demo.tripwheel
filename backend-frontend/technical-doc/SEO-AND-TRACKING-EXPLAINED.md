# SEO & conversion tracking, explained

**Who this is for:** you, or anyone who has to set this up, check it, or explain it — without
reading the code. Everything is in plain language. Where a fact comes from a specific file, the
file is named so an engineer can verify it, but you never need to open one.

**What it covers:** everything about how Island Tours gets found on Google (SEO), and everything
about how we tell Google Ads, Meta and GA4 that a booking happened (conversion tracking), including
every requirement in the Server-Side Ad Conversion Tracking PRD.

**Status, 2026-08-19: every part of the software this PRD asked for is built.** What is left is
account access, entering IDs, configuring the Google Tag Manager container, and testing. **Section 4**
is the checklist for exactly that, in the order it must happen. (One small SEO nice-to-have remains
open, called out in §2.6; it does not affect tracking.)

> **The one thing to do today:** request the Google Ads developer token. It takes Google 2–3
> business days, it is the only thing on the list you cannot do yourself, and cancellation
> corrections cannot go live without it. Section 4, step 2.

> **Doing the setup right now?** Use the
> **[runbook](./03-implementation/SEO-AND-TRACKING-SETUP-RUNBOOK.md)** instead — same steps as
> section 4, but as a tickable checklist with a verification command under each one and no
> explanation in the way. Come back here when you want to know *why* something works.

---

## Contents

- [1. The ten-minute picture](#1-the-ten-minute-picture)
- [2. SEO — being found on Google](#2-seo--being-found-on-google)
- [3. Tracking — proving an ad produced a booking](#3-tracking--proving-an-ad-produced-a-booking)
- [4. Setup, in the order it must happen](#4-setup-in-the-order-it-must-happen)
- [5. How to check it actually works](#5-how-to-check-it-actually-works)
- [6. When something looks wrong](#6-when-something-looks-wrong)
- [7. Glossary](#7-glossary)

---

## 1. The ten-minute picture

Two separate jobs that people often confuse:

|  | SEO | Conversion tracking |
| --- | --- | --- |
| **Question it answers** | Can people find us for free? | Did the money we spent on ads work? |
| **Who reads it** | Google's crawler | Google Ads, Meta, GA4 |
| **When it happens** | All the time, in the background | Once, the moment a booking is confirmed |
| **What breaks if it's wrong** | You rank lower, slowly | You bid on the wrong things, expensively |

The whole tracking idea in one paragraph: when someone clicks a Google ad, Google adds a code to
the web address (a *click ID*). We store it. If that person books days later, our **server** — not
their browser — works out what we actually earned on that booking and reports that number back to
Google and Meta, tagged with the click ID. So the ad platforms learn "this ad produced €41.99 of
real margin", not "something happened".

**The single most important rule in this whole document:** we report **commission**, never the tour
price. If someone books a €500 tour and we earn €100, the number we send is **100**. Reporting 500
would teach Google to chase expensive tours instead of profitable ones. This is enforced in the
code and cannot be switched off by configuration.

---

## 2. SEO — being found on Google

### 2.1 What SEO is

Google sends a program (a *crawler*) to read your site. It follows links, reads pages, and decides
two things: **should this page be in Google at all**, and **what is it about**. Everything below
either helps it answer those questions, or deliberately says "not this page".

You do not need to do anything for Google to find you. You need it to find the **right** pages,
understand them, and not be confused by near-duplicates.

### 2.2 Your web addresses, and what happens when one changes

Every tour has exactly one real address:

```
https://www.island.tours/en/curacao/klein-curacao-boat-trip
                          ↑↑  ↑↑↑↑↑↑↑ ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
                      language  island        the tour
```

**Why "exactly one" matters.** If the same tour were reachable at three addresses, Google would see
three competing pages and split your ranking between them.

**What a "slug" is.** The last part — `klein-curacao-boat-trip`. The readable name in the address.
Slugs are always English, even on the Dutch or Chinese version of the site.

**When you rename something, nothing breaks.** The old address automatically redirects to the new
one (a "301", meaning *moved permanently*), and your ranking follows the redirect. Automatic — you
do nothing.

**When you delete something, the slug is locked for 90 days** before anything else can use it. This
stops old links landing people on an unrelated page.

> Behind this is a *slug registry*: a table of every address in use per island. It exists because
> `/curacao/something` is ambiguous — "something" could be a tour, a category, an activity hub or a
> collection. It also stops two things claiming the same word.

### 2.3 Seven languages without looking like seven copies

The site runs in **English, Dutch, German, French, Spanish, Portuguese and Chinese**. The same tour
in German is `/de/curacao/klein-curacao-boat-trip/` — only the language code changes.

**The problem that creates:** to a crawler, seven pages with the same photos and the same tour look
like seven copies of one thing, and duplicate content is something Google filters out.

**The fix, called `hreflang`:** every page carries a list saying "here are my other language
versions". Google then treats them as one page in seven languages and shows the right one to the
right person. Each page also says `x-default` → English, meaning "if you don't know what language
this person wants, use English".

Automatic on every page. Nothing to configure.

### 2.4 The "canonical" — this is the real address

A canonical is a line on a page saying **"the official address for this content is X"**.

It matters most on filtered lists. When a visitor filters the All Tours page, the address grows:

```
/en/curacao/tours?sort=price&date=2026-07-01&adults=2
```

There are thousands of possible combinations. Without a canonical, Google might try to index all of
them separately and your one good listing page gets diluted. So every filtered view points at the
clean address, and all the value consolidates there.

**One deliberate exception.** A made-up address like `/en/nonsense-word/tours` shows a "not found"
page, and those pages carry **no canonical and no language list** — on purpose. Because of how the
site renders, such URLs technically answer with a success code, so declaring a canonical would tell
Google "this invented page is real and indexable". Anyone could then link to thousands of made-up
addresses on your domain and generate junk pages for free. Instead those pages say "don't index me,
but do follow my links". *If an engineer ever proposes "fixing" this, the reason is written into the
code — it should stay.*

### 2.5 Where page titles and descriptions come from

| Page | Text comes from |
| --- | --- |
| Category, hub, collection | What an admin typed, per language — falling back to `"{name} \| Island Tours"` |
| **Destination** | What an admin typed. **With nothing typed, it falls back to the sitewide default, not to the island's name** |
| Tour pages | Generated from the tour's own name and overview |
| Anything else | The defaults in Settings → SEO |

Missing translations fall back to English. Missing descriptions fall back to the page's own
editorial copy — a category's overview, a hub's lead paragraph, a tour's short description — and
only end up empty if there is nothing to fall back to.

> ⚠️ **Worth doing early: write meta titles for each destination.** Unlike every other page type,
> a destination with no authored title inherits the sitewide default — so `/en/curacao` and
> `/en/aruba` will carry the *identical* title in search results until someone fills them in. It is
> the one gap in the fallback chain, and it affects your most valuable pages.

### 2.6 Structured data — telling Google *what kind of thing* a page is

A page about a boat trip is just text to a crawler. **Structured data** is a hidden block of
machine-readable facts saying "this is a tour, it is rated 4.7 by 82 people". It is what produces
star ratings and the Home › Curaçao › Tour trail in search results.

What the site publishes today:

| Page | What it says | Why you care |
| --- | --- | --- |
| Every page | Organization, WebSite | Who you are; enables Google's site search box |
| Most pages | BreadcrumbList | The trail under your search result |
| Tour detail | TouristTrip | "This is a tour" |
| Tour detail | Product + Offer | Carries the price |
| Tour detail | Review + AggregateRating | **The star ratings — but only once that tour has at least 3 of its own approved reviews.** Below that, no stars. Not a bug |
| Destination | TouristDestination | "This is a place" |
| Any page with FAQs | FAQPage | Questions can show directly in results |

**Not built yet:** `ItemList` on the All Tours grid, which would tell Google the listing page is a
ranked list of products. Minor; tracked internally.

### 2.7 The sitemap — the list you hand to Google

`https://www.island.tours/sitemap.xml` is a machine-readable index of every page worth indexing. It
generates itself; nobody maintains it by hand.

**In it:** the homepage, each island, each island's All Tours page, every live tour, categories that
pass the ≥3 rule below, activity hubs, published collections, and published legal pages.

**Not in it:** checkout, thank-you, cancel, review, the traveller account, saved items, search
results. These are private or personal and must never be in Google.

### 2.8 robots.txt — the "please don't go in here" note

`https://www.island.tours/robots.txt` is the first file a crawler reads. The generated default
blocks the private areas and points at the sitemap.

**You can replace it entirely** in Settings → **SEO** → "Custom robots.txt". Whatever you
paste is served exactly as typed. Leave it empty to keep the safe default — which is the
recommendation unless you have a specific reason.

> ⚠️ **There is also a "Robots Meta" field on the SEO tab, and it applies to the WHOLE SITE.**
> Leave it empty unless you are certain — putting `noindex` there removes your entire site from
> Google.

> ⚠️ **"Exactly as typed" means nothing is added for you.** The generated default ends with a
> `Sitemap: https://…/sitemap.xml` line; a custom one does not, unless you type it. Paste a custom
> robots.txt without that line and you have quietly stopped advertising your sitemap. There is also
> an **"Advertise sitemap in robots.txt"** toggle on the same tab, which removes that line from the
> generated default when switched off.

> robots.txt asks crawlers not to *visit*. It is not security, and not a guarantee of staying out of
> search results. The private pages also carry a proper "noindex" instruction, which is the real
> protection. Both are in place.

### 2.9 The ≥3 rule (why some category pages don't exist)

A category page for an island only goes live once that island has **at least 3 published tours** in
it. Below that it does not exist at all — not in menus, not in the sitemap, not in search.

**Why:** a page listing one tour is a "thin" page, and Google penalises sites that produce lots of
them. Publish a third tour in a category and its page appears on its own.

### 2.10 Setting up Google Search Console

Search Console is Google's free dashboard showing what you rank for and what's broken.

1. Go to `search.google.com/search-console`, add your domain.
2. Choose the **HTML tag** verification method. Google shows a long code.
3. Copy **only the code**, not the whole tag.
4. Dashboard → Settings → **SEO** → "Search Console Verification Code" → paste → Save.
5. Back in Google, click Verify.
6. Then submit your sitemap: Sitemaps → type `sitemap.xml` → Submit.

> This is **not** the same as the `G-XXXX` Analytics ID. Different fields, different purposes.

---

## 3. Tracking — proving an ad produced a booking

### 3.1 Follow one booking end to end

This is the whole system. Everything after this section is detail.

**1. Someone clicks your Google ad.**
They land on `island.tours/en/curacao/tours?gclid=Cj0KCQ...`. That `gclid` is Google's click ID —
proof this visit came from a specific ad click.

**2. We store the click ID — but only with permission.**
The site saves it in a small file on their device (a *cookie*) that lasts 90 days. **It is only
saved if the visitor accepted marketing cookies.** If they declined, or never answered the banner,
nothing is stored — we lose the attribution, which is the correct and legal outcome.

**3. They browse, leave, come back three days later, and book.**
The cookie survives, so the click ID is still there.

**4. At booking, the click ID is written onto the booking record permanently.**
Along with the UTM tags, and never rewritten afterwards.

> **This is last-click attribution.** While someone is still browsing, a *newer* ad click replaces
> the stored one — click ad A, come back through ad B, book, and the booking is credited to **B**.
> Only at the moment of booking is the value frozen. That matches how Google and Meta report, but
> it is worth knowing before you compare their numbers to anything of your own.

**5. The booking is confirmed** (card payment succeeds, or an instant-confirm tour is booked).

**6. Our server works out what we earned.**
It takes the commission, converts it to euros, and rounds it. Say **€41.99**. This number is
calculated on the server from the booking record. The browser is never asked and never trusted.

**7. Two messages go out, at the same time, about the same booking:**
- **From our server** → straight to Meta ("Conversions API"). Reliable; ad blockers cannot stop it.
- **From the browser**, on the thank-you page → to Google Tag Manager, which passes it to Google
  Ads, GA4 and the Meta Pixel.

**8. They carry the same ID, so nothing is double-counted.**
Both messages carry the same booking reference. Meta sees two reports of one booking and merges
them. This is the *deduplication* the PRD asks for.

**9. If the booking is cancelled later, we correct it.**
A cancellation that actually loses us the commission sends a **retraction** to Google Ads and a
**refund event** to Meta. If the cancellation *keeps* our money (a kept deposit), Google Ads is left
alone — the reported value is still true — while Meta still receives a labelled refund event. See
§3.7, which explains why the two platforms are treated differently.

### 3.2 Why commission, not the tour price

The single most important rule.

| What we could report | What Google learns |
| --- | --- |
| €500 (the tour price) | "Chase expensive tours" — even at 5% margin |
| **€100 (our commission)** | **"Chase profitable tours"** |

Smart Bidding optimises toward whatever number you feed it. Feed it revenue you don't keep and it
will confidently spend your budget on your worst-margin products.

**What if the commission is missing?** That's data corruption, and the system refuses to guess. It
sends nothing to any platform, logs an error, and the thank-you page shows a notice asking the
traveller to contact you. The booking itself is fine — only our internal record is incomplete.

### 3.3 Everything is in euros

Stripe settles in both euros and dollars. If we reported raw amounts, the same booking would look
different in different reports.

So every conversion value is converted to **euros** before it is sent. Where a card payment actually
converted currency, we use **the real rate Stripe or Mollie charged**, not an estimate. Where no
conversion happened — a pay-on-arrival booking, or an operator-collected one — we use the European
Central Bank rate captured at the moment of booking. Either way the rate is saved on the booking
forever, so the number never drifts, and rounding is always to 2 decimal places the same way.

Google Ads, Meta and GA4 therefore all receive the identical euro figure for the same booking.

### 3.4 Consent — the cookie banner

**Cookiebot** shows the banner and remembers each visitor's choice. We configure it; we don't
replace it.

**Consent Mode v2** is Google's system for respecting that choice. Ours is region-aware:

| Where the visitor is | Default before they answer |
| --- | --- |
| EU, UK, Iceland, Liechtenstein, Norway | **Everything denied** |
| Everywhere else | Granted |

The defaults are set *before* the tracking scripts load, so nothing can fire early. When someone
accepts, Cookiebot tells Google, and tags start working.

**The click-ID cookie is gated on this too.** Google's own blocking can't police a cookie our site
writes itself, so our code checks consent before writing it. If someone later withdraws consent, the
cookie is **deleted**, not merely left alone.

> **One useful subtlety:** click IDs only exist on the landing page address. By the time someone
> reads the banner and clicks Accept, they've often browsed on and the click ID is gone from the
> address bar. So the site holds it in memory (not stored — memory needs no consent) and writes it
> only if consent arrives. Without that, you'd lose attribution for every *consenting* EU visitor.

### 3.5 Never counted twice

Two independent guards:

1. **Server-side:** the moment a booking is confirmed, it is stamped "reported". Two things trying
   to confirm the same booking at once — a payment webhook and the browser returning from Stripe —
   collapse to exactly one winner.
2. **Browser-side:** the thank-you page asks the server "may I report this?" and the server says yes
   **once**. Refresh the page, open it in another tab, click the link in your email a week later —
   the answer is no.

Both live in the database, never in the browser's storage, so clearing cookies can't produce a
duplicate.

### 3.6 Enhanced Conversions — better matching, no raw personal data

Google matches conversions to ad clicks more accurately if you give it the customer's email. But
sending customer emails to Google is not something you want to do casually.

So the email, phone, name and address are **scrambled one-way on our server** (hashed) before they
go anywhere. Google can compare the scrambled value to its own scrambled values, but nobody can turn
it back into an email. The raw details never leave our server.

This typically lifts match rates well above the 60% you should expect to see in the diagnostics.

### 3.7 Cancellations and refunds

| What happened | Google Ads | Meta | Why they differ |
| --- | --- | --- | --- |
| Cancelled, traveller fully refunded | **Retraction** | **Refund event** | We lost the commission — the conversion wasn't real |
| Cancelled, we kept the deposit | **Nothing** | **Refund event, tagged** | Google Ads is corrected only when money is actually lost. Meta receives the event either way, labelled so you can tell the two apart in reporting |
| Traveller didn't turn up (no-show) | **Nothing** | **Nothing** | We kept the money, and a no-show is not a cancellation at all |

**The middle row is the one that surprises people.** If a traveller cancels outside the free window
and we keep their deposit, you will see a `Refund` row appear in Meta Events Manager for a booking
you refunded nothing on. That is expected, not a fault: the event carries a
`cancellation_refund` label recording that the deposit was kept, so kept-deposit cancellations can
be told apart from real refunds in Meta reporting. Google Ads, which supports a true correction,
is deliberately left alone in that case.

The Google Ads retraction is sent **24 hours after** the cancellation, deliberately: Google must
have finished processing the original conversion before it can be adjusted. Still well inside the
PRD's 24–48 hour window.

> **Worth knowing about Meta:** Meta has no true "undo". The Refund event is the correction signal
> and it's visible in Events Manager, but Ads Manager will **not** subtract it from your Purchase
> totals. That's a Meta limitation, not a bug in our setup.

**About no-shows.** The PRD asked for no-show corrections on the assumption that a no-show means
lost revenue. In your business it doesn't — the deposit is kept, and the deposit is the commission.
So a no-show is recorded — an operator reports it, an admin confirms it — and **nothing is sent to
the ad platforms**. Correcting there would under-report revenue you genuinely earned.

What confirming it does do is stop *that booking* generating a review invitation or a "your next
adventure" email. It is scoped to the booking, not the person: the same traveller's other bookings
are unaffected, and they are not blocked from marketing generally.

### 3.8 The audit trail

Every message **our server** sends is recorded: the platform, the kind of event, the booking's ID,
the euro value, whether it succeeded or failed, and the error if it failed. That covers the Meta
conversions, the Meta refunds and the Google Ads corrections. Nothing disappears into a log file.

Two honest limits. The events sent from the **browser** — the Google Ads conversion, GA4, the Meta
Pixel — are not in this table; Tag Manager's own preview and each platform's reporting are where you
check those. And if a platform's credentials are missing, nothing is attempted and therefore nothing
is recorded, so **an empty table means "not configured" just as much as it means "nothing happened"**.

---

## 4. Setup, in the order it must happen

Each step depends on the ones before it.

> 🚨 **One thing to know before you start: the system has two halves, and they switch on at
> different times.**
>
> The **browser half** (Google Ads, GA4, the Meta Pixel) is off until step 7, so nothing reaches
> those until you deliberately enable it.
>
> The **server half** (Meta Conversions API) has no such switch. It starts sending **live, real**
> `Purchase` events to Meta the moment the Facebook Pixel ID and the Meta CAPI access token are
> both saved, in step 5 — before the container exists and before step 7.
>
> So if you want a clean start: leave the Meta CAPI access token blank until you are ready, or set
> the Test Event Code first so those events are routed to Test Events and don't count.

### Step 1 — Get access (day 1)

Ask whoever holds these to grant your accounts:

| System | Level needed |
| --- | --- |
| Google Tag Manager | Admin |
| Google Ads | Admin |
| Google Analytics 4 | Editor or Admin |
| Meta Business Manager | Pixel access + a system user |

Everything else waits on this.

### Step 2 — Request the Google Ads developer token (day 1, do this first)

**This has a 2–3 business day clock that you do not control, and it is the only such item.**

1. Google Ads → **Tools** → **API Center**.
2. Apply for a developer token. Describe the use as *"posting conversion adjustments for our own
   bookings from our own platform"*.
3. Wait for approval.

Cancellation corrections cannot go live without it. Everything else can proceed in parallel — the
code is already written and simply does nothing until the credentials exist.

### Step 3 — Set your canonical URL (two minutes, easy to miss, expensive to miss)

**Settings → SEO → "Canonical URL"** → enter your real public address, e.g.
`https://www.island.tours`. Save.

> 🚨 **Do not skip this and do not copy the greyed-out example in the field.** That address is the
> base for *every* canonical tag, *every* language alternate, your `sitemap.xml` and your
> `robots.txt`. If it is left blank, the site falls back to a **different product's domain**
> (`www.tripwheel.app`) — and you would be telling Google that every page on your site officially
> lives somewhere else. Nothing visibly breaks, which is what makes it dangerous.

### Step 4 — Collect your IDs

| Thing | Where you find it | Looks like |
| --- | --- | --- |
| GTM container ID | Tag Manager → Admin | `GTM-XXXXXXX` |
| GA4 Measurement ID | GA4 → Admin → Data Streams | `G-XXXXXXXXXX` |
| Google Ads Conversion ID + Label | Ads → Goals → Conversions (created in step 5) | `AW-123456789` / `AbC-D_efG` |
| Meta Pixel ID | Events Manager | a long number |
| Meta CAPI access token | Events Manager → Settings → Conversions API | a long string |
| Cookiebot Domain Group ID | Cookiebot admin → Settings → Your scripts (the `data-cbid` value) | a UUID |
| **Your real public domain** | You already know it | `https://www.island.tours` |

### Step 5 — Enter them in the dashboard

**Settings → SEO** (the tab is called just "SEO"): Google Tag Manager ID, Facebook Pixel ID, Google Analytics ID,
Search Console verification code.

> Both tracking IDs on this tab are load-bearing. The **Facebook Pixel ID** is read by our server to
> send conversions to Meta directly. The **Google Analytics ID** loads GA4 itself — enter it here and
> GA4 starts recording pageviews and sessions, with nothing to do in Tag Manager for that part.
>
> ⚠️ **The corollary:** because the site loads GA4, you must **not** also add a "Google tag" / GA4
> configuration tag inside the container (step 6), **and not paste a GA4 snippet into Settings →
> Scripts either.** Two configurations for one property double-count pageviews — and the Scripts
> route is worse than double-counting: those snippets run during page parse, *before* the consent
> defaults are set, so a GA4 tag pasted there would fire with no consent signal at all.

**Settings → Integration → Analytics and Tracking** — note the tab is "Integration" (singular) and the tracking settings live in its **Analytics and Tracking** sub-tab. Three cards there:

| Card | Fields |
| --- | --- |
| **Meta Conversions API** | Access Token, Test Event Code (set it for testing, then clear it) |
| **Cookiebot** | Cookiebot Domain Group ID |
| **Google Ads API** | Developer Token, Customer ID, Manager (MCC) ID *(optional)*, OAuth Client ID, OAuth Client Secret, OAuth Refresh Token, Conversion Action ID |

> 🚨 **The Cookiebot Domain Group ID is not optional, and not just about the banner.** Our code
> refuses to store an ad click ID unless Cookiebot is present *and* reports marketing consent. If
> that ID is missing, Cookiebot never loads, consent can never be granted — and **no click ID is
> ever stored, for any visitor, in any country.** Attribution is then blank worldwide, not merely
> reduced in Europe. This is the second most consequential field on the page, after the tracking
> switch in step 7.

> Two more things that trip people up. The **Meta Pixel ID is not on this tab** — it lives on the
> **SEO** tab, and the Meta card says so. And the Google Ads card is safe to fill in
> half-way: nothing fires until every field is present, so you can enter what you have and add the
> developer token when Google approves it.

> ⚠️ **Clear the Meta Test Event Code before you go live.** While it is set, events are routed to
> the Test Events tab and **do not count** as real conversions.

### Step 6 — Build the Google Tag Manager container

This is the biggest manual step and none of it is code. Full click-by-click instructions are in
`03-implementation/GTM-CONTAINER-SETUP.md`; the shape is:

**Create 7 Data Layer Variables.** Name them **exactly** as below, prefix included — the tags refer
to them by name, so a different name silently resolves to nothing:

```
dlv - event_id
dlv - booking_value
dlv - booking_currency
dlv - tour_id
dlv - tour_name
dlv - items
dlv - user_data
```

**Create 1 trigger:** a Custom Event named exactly `booking_complete`.

**Create 4 tags.** Note that **one of them does *not* use the `booking_complete` trigger** — it has
to run on every page:

1. **Conversion Linker** — trigger **All Pages / Initialization**, *not* `booking_complete`. Nothing
   to configure. It exists to capture the ad click when the visitor *lands*, so putting it on the
   thank-you page defeats its entire purpose.
2. **Google Ads Conversion** — trigger `booking_complete`. Value `{{dlv - booking_value}}`, currency
   `{{dlv - booking_currency}}`, **Transaction ID `{{dlv - event_id}}`**, and turn on **Enhanced
   Conversions** reading from `{{dlv - user_data}}`.
3. **GA4 purchase** — trigger `booking_complete`. Event name `purchase`, with `transaction_id`,
   `value`, `currency` and `items` from the matching variables, and its **Measurement ID** set to the
   same `G-` ID you entered in the dashboard.

   > **Do not add a "Google tag" / GA4 configuration tag.** The site already loads GA4 from the
   > dashboard field (step 5). Adding one here is a second configuration for the same property and
   > double-counts pageviews. The container owns the `purchase` *event* only.
   >
   > **If §5.3 shows pageviews but no `purchase`**, that is the one case where you *do* need a
   > Google tag: add one with the same ID on All Pages, and clear the Measurement ID here. Google
   > does not document this dependency clearly, so treat §5.3 as the real answer.
4. **Meta Pixel** — trigger `booking_complete`. And this one has a trap:

> 🚨 **The Meta tag must pass `eventID = {{dlv - event_id}}`.** That single setting is what tells
> Meta the browser event and our server event are the same booking. **Leave it out and every booking
> is counted twice.** It is the most common way this setup goes wrong.

Then: Admin → Container Settings → enable **consent overview**, and check each tag's built-in
consent settings (Ads tags need `ad_storage`, GA4 needs `analytics_storage`).

### Step 7 — Turn on the browser half, then REBUILD

Set `NEXT_PUBLIC_ENABLE_TRACKING=true` on the **production** frontend deployment only.

> 🚨 **This value is baked into the site when it is built. Setting it and restarting is not enough —
> the frontend must be rebuilt and redeployed.**
>
> Skip the rebuild and you get the most confusing failure in this whole document: the Tag Manager
> container loads and looks perfectly healthy, but no `booking_complete` event is ever produced, so
> every tag sits waiting for something that never arrives. It looks like a container problem and
> is not one.

> Staging must **not** have this. Staging builds look identical to production internally, so this
> explicit switch is the only thing keeping test bookings out of your real Ads/GA4/Pixel data.
> It does **not** protect the server-side Meta feed — see the warning at the top of this section.

### Step 8 — Test, then clean up

Work through **section 5** below. When every check passes, clear the Meta Test Event Code in
Settings → Integration → Analytics and Tracking — while it is set, your conversions do not count.

---

## 5. How to check it actually works

Do these in order. Each one catches a different failure.

> 🚨 **Use a brand-new test booking for every check below.** A booking's conversion can be claimed
> exactly once, and that claim is used up the first time its thank-you page is loaded — even if
> tracking was switched off at the time. So a booking created before step 7 can never fire, and you
> cannot re-run a failed check against the same booking. When something fails, fix it and then book
> again.

### 5.1 Does the event fire at all?

1. In Tag Manager, click **Preview** and enter your site address.
2. Make a real test booking.
3. On the thank-you page, the debug panel should show **one** `booking_complete` event, with the
   three `booking_complete` tags fired (Google Ads, GA4 purchase, Meta Pixel). The Conversion Linker
   fires on *every* page, not here — that is correct, not a fault.

**Nothing at all?** Check `NEXT_PUBLIC_ENABLE_TRACKING` is `true` and the GTM ID is saved in the
dashboard.

### 5.2 Is the value right?

In that same panel, click the event and read `booking_value`.

**It must be your commission, not the tour price.** A €500 tour at 20% should read about `100`. If
it shows 500, stop and get an engineer — something is badly wrong.

`booking_currency` must always be `EUR`, whatever the customer paid in.

### 5.3 Does GA4 see exactly one purchase?

1. GA4 → Admin → **DebugView**.
2. Make a test booking. One `purchase` appears.
3. **Refresh the thank-you page.** No second event. Open it in a new tab — still nothing.

That last check is the important one: it proves the once-only guard works.

### 5.4 Do both Meta messages carry the same ID?

**What you are checking is the shared ID, not a merge.** Test Events is a raw receipt log — it shows
each message as it arrives. Deduplication happens later, in Meta's reporting. Seeing two rows there
is normal and is *not* evidence of a problem.

1. Events Manager → your Pixel → **Test Events**, using the test code from Settings → Integration → Analytics and Tracking.
2. Make a test booking.
3. Open each `Purchase` row and compare the **Event ID**.

**Pass:** both rows show the *same* Event ID (it is the booking's reference).
**Fail:** the browser row has no Event ID, or a different one → the Meta tag is missing
`eventID = {{dlv - event_id}}`. Go back to step 6.

> Two practical notes. The test code is applied by our **server** only, so the server message will
> appear here reliably; to make the *browser* message show up in Test Events you have to open the
> site through Meta's own "Test browser events" flow in that same panel. And if you only ever see
> one row, check which one it is before assuming anything is broken.

**Clear the test event code when you're done — while it is set, your conversions do not count.**

> ⚠️ **Your test bookings are real conversions.** You are testing on production with tracking on, so
> each test booking becomes a genuine Google Ads conversion and a genuine GA4 purchase with a real
> euro value. Decide up front how to handle that: cancel and refund them afterwards (which also
> gives you the §5.7 test for free), or note their references so you can discount them in early
> reports. The Meta side you can neutralise with the Test Event Code; Ads and GA4 you cannot.

### 5.5 Does consent work?

1. Use a VPN set to an EU country, in a fresh private window.
2. Load the site with `?gclid=test123` on the address, and **don't touch the banner**.
3. Accept marketing cookies.

**What "working" looks like — and it is not a blank screen.** Under Consent Mode v2, denied does not
mean silent: Google's tags still send anonymous, cookieless pings, and Tag Manager's preview panel
will show them as *fired*. That is correct behaviour, not a leak. What must be true is that **no
advertising cookies are written and ad click identifiers are stripped** before consent.

The clearest thing to check, because it is unambiguous: before you accept, there must be **no
`it.attribution.v2` cookie**. After you accept, it appears and contains `test123`. Browser dev
tools → Application → Cookies.

### 5.6 Test every booking type

Four payment models confirm through different code paths, so test one of each. The internal names,
which is what an engineer will ask you for:

| Test | Internal name | Why it differs |
| --- | --- | --- |
| Deposit now, balance to the operator | `OPERATOR_LINK` | The common case |
| Pay on arrival | `ON_ARRIVAL` | Still takes a card deposit from us |
| Pay the full price to us | `PAID_IN_FULL` | We hold everything |
| Operator collects everything | `OPERATOR_FULL` | **No payment step at all** — confirms instantly at booking, with no webhook |

Do the card ones through **both Stripe and Mollie** — separate integrations, separate confirmation
paths.

Each must produce exactly one conversion with the correct euro commission.

### 5.7 Prove a cancellation corrects itself

1. Cancel a confirmed test booking with a **full refund**. Two things make this fiddly, and both
   look like failures if you don't know them:
   - **Only an admin can cancel a confirmed booking.** Operators can only *report* a cancellation.
   - **You only get a full refund if you cancel before that tour's free-cancellation cut-off.** Book
     one far enough out — cancel a booking for tomorrow and the system correctly keeps the deposit,
     which sends **no** Google Ads correction at all.
2. Meta Events Manager: a `Refund` event for that booking, within minutes.
3. Google Ads → Goals → Conversions → adjustments: **start looking after 24 hours, not at 24 hours.**
   The correction is deliberately held for 24 hours before it is even sent, because Google has to
   finish processing the original conversion before it can be adjusted — and Google then takes its
   own time to display it. Checking at hour 24 and finding nothing is expected, not a fault.

**This is the test the PRD specifically asks for.** Don't skip it.

### 5.8 After about 48 hours

Google Ads → Goals → Conversions → your conversion action → **Enhanced Conversions diagnostics**.
Match rate should be comfortably above **60%**.

---

## 6. When something looks wrong

| What you see | Most likely cause |
| --- | --- |
| **No conversions at all, but the container looks fine** | `NEXT_PUBLIC_ENABLE_TRACKING` isn't `true` — **or it is, and the frontend was never rebuilt** (step 6). The container loads either way; only the event is missing. Then check the GTM ID |
| **No click IDs / everything looks organic** | The Cookiebot Domain Group ID is missing, so consent can never be granted and no click ID is ever stored — worldwide, not just in the EU |
| **Every booking counted twice in Meta** | The Meta tag is missing `eventID = {{dlv - event_id}}` |
| A `Refund` in Meta for a booking you didn't refund | Expected. A kept-deposit cancellation still sends a labelled refund event to Meta; only Google Ads is left alone. See §3.7 |
| Values look far too big | Something is reporting the tour price instead of commission — escalate |
| No GA4 data at all | Check the Google Analytics ID is saved in Settings → SEO and is a `G-…` value — a malformed one is ignored rather than half-loaded. Then confirm the frontend was rebuilt after step 7 |
| GA4 pageviews arrive but **no `purchase`** | Either no GTM container ID is configured — the purchase event is a *container* tag, so GA4 alone gives you pageviews and nothing else — or the GA4 purchase tag's Measurement ID is unset |
| GA4 pageviews roughly doubled | You have a "Google tag" / GA4 configuration tag in the container *as well as* the dashboard ID. Remove the container one |
| No conversions from EU visitors | Expected if they declined cookies. Consent Mode fills part of this gap with modelled conversions |
| Google Ads cancellations not correcting | The Google Ads developer token or credentials aren't entered. The code is live but idle until they are. (If **Meta** refunds are also missing, it's the Meta Pixel ID / CAPI token instead — different credentials) |
| Fewer conversions than bookings | Some travellers close the tab before the thank-you page finishes loading. A known, accepted trade-off — the server-side Meta message is unaffected |
| Thank-you page shows "we need to check something" | A booking is missing its commission figure. The booking is valid and paid; the internal record isn't. Nothing was reported for it |
| A **tour** isn't in Google | Check it is live and its destination is active, then check Search Console for that URL. The ≥3 rule does **not** apply to tour pages |
| A **category page** isn't in Google | That one *is* the ≥3 rule — the category needs at least 3 published tours on that island |

**Where to look for failures:** every server-sent message is recorded in the `conversion_events`
table with its outcome, and failed background jobs are retained and visible in Bull Board rather
than silently dropped. Ask an engineer for those two — they are the ground truth when a platform's
own dashboard disagrees with you.

---

## 7. Glossary

| Term | Plain meaning |
| --- | --- |
| **Attribution** | Working out which ad or source produced a booking |
| **CBID / Domain Group ID** | Your Cookiebot account's ID. Without it the cookie banner never loads — and no click IDs are stored |
| **CAPI** | Meta's Conversions API — our server talking directly to Meta, bypassing the browser |
| **Canonical** | A line saying "this is the official address for this content" |
| **Click ID** (`gclid`, `fbclid`) | A code an ad platform adds to your address so it can recognise the click later |
| **Consent Mode v2** | Google's system for respecting cookie choices |
| **Conversion** | Something valuable happening — here, a confirmed booking |
| **Cookiebot** | The service that shows the cookie banner and remembers the answer |
| **Crawler** | The program search engines use to read websites |
| **Conversion Linker** | A Tag Manager tag that helps ad platforms recognise a returning click. No settings; it just has to exist |
| **Data Layer Variable (`dlv`)** | Tag Manager's way of reading one field out of the event our site sends. `{{dlv - booking_value}}` means "the booking_value field" |
| **Deduplication** | Making sure one booking isn't counted twice |
| **Developer token** | Google's permission slip for using the Google Ads API. Requested once, approved by Google in 2–3 days |
| **`event_id`** | The booking's unique reference, sent with both the browser and server messages. It is what lets Meta tell they are the same booking |
| **GMV** | Gross Merchandise Value — the full tour price. What we deliberately do **not** report |
| **Enhanced Conversions** | Sending scrambled customer details so Google matches conversions more accurately |
| **GA4** | Google Analytics 4 — website reporting |
| **GTM** | Google Tag Manager — one place to manage all your marketing tags |
| **Hashing** | One-way scrambling. You can check a match, but can't reverse it |
| **hreflang** | The tag telling Google which pages are language versions of each other |
| **Noindex** | An instruction telling search engines to keep a page out of results |
| **Pixel** | Meta's browser-side tracking code |
| **Retraction** | Telling Google Ads a previously reported conversion didn't hold |
| **Sitemap** | A machine-readable list of your pages for search engines |
| **Slug** | The readable part of a web address, like `klein-curacao-boat-trip` |
| **Smart Bidding** | Google automatically adjusting bids based on the values you report |
| **Transaction ID** | What Google Ads calls the booking reference. We set it to the same value as `event_id` |
| **UTM tags** | Labels you add to links to track where traffic came from |

---

## For engineers

Deeper references, all under `technical-doc/`:

| Topic | Document |
| --- | --- |
| Tracking architecture | `02-architecture/TRACKING-AND-ANALYTICS.md` |
| GTM container recipe | `03-implementation/GTM-CONTAINER-SETUP.md` |
| Setup runbook (tickable) | `03-implementation/SEO-AND-TRACKING-SETUP-RUNBOOK.md` |
| PRD status + what's open | `03-implementation/AD-CONVERSION-TRACKING-PRD-CHECKLIST.md` |
| SEO specification | `02-architecture/SEO-STRATEGY.md` |
| Currency handling | `02-architecture/FX-AND-MULTI-CURRENCY.md` |
| URL resolution and redirects | `02-architecture/{ROUTING-AND-RESOLUTION,SLUG-REGISTRY}.md` |
