# SEO & tracking setup — runbook

**What this is:** the ordered list of actions to get SEO and conversion tracking live. Tick as you
go. No explanation — for *why* any of it works, read
[`../SEO-AND-TRACKING-EXPLAINED.md`](../SEO-AND-TRACKING-EXPLAINED.md).

**Before you start:** all the software is built and deployed. Nothing here is a code change.

| | |
| --- | --- |
| **Total hands-on time** | ~3 hours, plus a 2–3 day wait on Google and a 14-day monitoring tail |
| **Start today, whatever else you do** | Step 2 — it has an external clock and blocks step 9 |
| **You can stop safely after** | Any step. Nothing is half-armed except as flagged in step 5 |

---

## Where each step happens

**Nothing in this runbook is a code change.** Every step is either a form in your own dashboard or
clicking in someone else's website. The only exception is step 7, which needs whoever deploys the
frontend.

| Step | You do it in | Who |
| --- | --- | --- |
| 1 Access | Google + Meta account settings | Stakeholder |
| 2 Developer token | `ads.google.com` → Tools → API Center | You |
| 3 Canonical URL | **Your dashboard** → Settings → SEO | You |
| 4 Collect IDs | Google + Meta + Cookiebot dashboards | You |
| 5 Enter IDs | **Your dashboard** → Settings → SEO / Integration | You |
| 6 GTM container | **`tagmanager.google.com`** — clicking, not code | You |
| 7 Enable + rebuild | Hosting env vars, then a **redeploy** | Developer / whoever deploys |
| 8 Test | Your live site + GTM Preview + GA4 + Meta | You |
| 9 Cancellation test | Your dashboard (admin) + Ads + Meta | You |
| 10 Deliverables | Ads diagnostics, a screen recording, a doc | You |
| 11 SEO housekeeping | `search.google.com/search-console` + your dashboard | You |

---

## The five things that go wrong

Read these once. Each has burned someone.

| | |
| --- | --- |
| 1 | **`NEXT_PUBLIC_ENABLE_TRACKING` is inlined at build time.** Setting it without rebuilding leaves the container loading and looking healthy while no event ever fires. Step 7. |
| 2 | **No Cookiebot ID = no click IDs stored, worldwide.** Not an EU-only degradation. Step 5. |
| 3 | **The Meta tag must pass `eventID`.** Omit it and every booking counts twice. Step 6. |
| 4 | **The server-side Meta feed is NOT gated on the tracking flag.** It goes live in step 5, two steps early. |
| 5 | **Your test bookings are real conversions.** Step 8. |

---

## Step 1 — Get access · *stakeholder · blocks everything*

> **Where:** each platform's own account settings. Whoever owns the accounts invites you.

- [ ] **Google Tag Manager** — `tagmanager.google.com` → Admin → User Management → **admin**
- [ ] **Google Ads** — `ads.google.com` → Tools → Access and security → **admin**
- [ ] **Google Analytics 4** — `analytics.google.com` → Admin → Property access management →
      **editor or admin**
- [ ] **Meta Business Manager** — `business.facebook.com` → Business settings → **Pixel access + a
      system user**

> **Verify:** you can open all four dashboards yourself.

---

## Step 2 — Request the Google Ads developer token · *do this first, today*

> **Where:** `ads.google.com`, in your browser. A form on Google's site — nothing to install.
> You need the **manager (MCC) account**, not a child account; API Center only appears there.

- [ ] `ads.google.com` → **Tools** (spanner icon) → **API Center**
- [ ] Apply for a developer token. Describe the use as: *posting conversion adjustments for our own
      bookings from our own platform.*
- [ ] Note the token somewhere safe when it arrives.

> **Why first:** Google takes 2–3 business days and you cannot shorten it. Step 9 is blocked until
> it lands. Everything else proceeds in parallel.
>
> **Verify:** the request shows as submitted/pending in API Center.

---

## Step 3 — Fix the canonical URL · *2 minutes · currently wrong on production*

> **Where: YOUR OWN dashboard** — `dashboard.tripwheel.app` (or wherever you run the admin) →
> **Settings** → **SEO** tab. One text field.

- [ ] **Settings → SEO → "Canonical URL"** → enter `https://www.island.tours` (your real public
      address). Save.

> As of 2026-08-19 production has `https://islandtours.example` — a placeholder. Until this is
> fixed, every canonical tag, every language alternate and the entire sitemap tell Google your pages
> live on a domain you do not own.
>
> **Do not** copy the greyed-out example text in the field; it is not your domain either.
>
> **Verify:**
> ```bash
> curl -s https://www.island.tours/en/curacao | grep -o '<link rel="canonical"[^>]*>'
> curl -s https://www.island.tours/sitemap.xml | grep -o '<loc>[^<]*</loc>' | head -3
> ```
> Both must show your real domain.

---

## Step 4 — Collect the IDs

> **Where:** four different websites. This step is pure copy-paste into a notepad — you enter them
> in step 5. Nothing is configured yet.

| | Where to get it | Shape |
| --- | --- | --- |
| - [ ] GTM container ID | Tag Manager → Admin | `GTM-XXXXXXX` |
| - [ ] GA4 Measurement ID | GA4 → Admin → Data Streams | `G-XXXXXXXXXX` |
| - [ ] Meta Pixel ID | Meta Events Manager | a long number |
| - [ ] Meta CAPI access token | Events Manager → Settings → Conversions API | a long string |
| - [ ] Meta test event code | Events Manager → Test Events | short code |
| - [ ] Cookiebot Domain Group ID | Cookiebot admin → Settings → Your scripts (`data-cbid`) | a UUID |
| - [ ] Google Ads Conversion ID + Label | Created in step 6 | `AW-…` / `AbC-D_efG` |

---

## Step 5 — Enter them in the dashboard · *the server-side feed goes LIVE here*

> **Where: YOUR OWN dashboard** → **Settings**. Two different tabs, and the tracking settings are in
> a **sub-tab** of the second one, which is easy to miss.

**Settings → SEO** *(top-level tab called just "SEO")*

- [ ] Google Tag Manager ID
- [ ] Google Analytics ID — *this is what switches GA4 on; see step 6 note*
- [ ] Facebook Pixel ID
- [ ] Search Console Verification Code *(step 11)*

**Settings → Integration → Analytics and Tracking** *(the tab is "Integration", singular; then pick
the "Analytics and Tracking" sub-tab — three cards there)*

- [ ] **Meta Conversions API** → Access Token
- [ ] **Meta Conversions API** → Test Event Code *(set it now; you clear it in step 8)*
- [ ] **Cookiebot** → Cookiebot Domain Group ID
- [ ] **Google Ads API** → the 7 fields, once your token from step 2 is approved

> 🚨 **Saving the Pixel ID + CAPI token starts live Meta events immediately.** The server-side feed
> has no tracking flag. Set the **Test Event Code first** so those events land in Test Events and do
> not count.
>
> 🚨 **The Cookiebot ID is not cosmetic.** Without it no ad click ID is ever stored, for any visitor
> in any country, and Google Ads attribution returns nothing.
>
> The Google Ads card is safe to fill in half-way — nothing fires until every field is present.
>
> **Verify:** each card shows a "connected"/configured indicator.

---

## Step 6 — Build the GTM container

> **Where: `tagmanager.google.com`, in your browser. NOT in the code.** Every item in this step is
> clicking in Google's web interface. Nothing in this repository changes, nothing is deployed, and
> no developer is needed. Our side already sends the data; this step is telling Google what to do
> with it.

Full recipe with screenshots-level detail: [`GTM-CONTAINER-SETUP.md`](./GTM-CONTAINER-SETUP.md).

### 6a. The 7 variables

Sign in → select your container → **Variables** in the left sidebar → scroll to **User-Defined
Variables** → **New** → **Variable Configuration** → choose **Data Layer Variable**.

🚨 **Each one asks for TWO different names and they are not the same.** This is the single easiest
thing to get wrong here:

| Field in GTM | What to type | Why |
| --- | --- | --- |
| **Data Layer Variable Name** *(inside the config)* | `event_id` | The actual key our site sends. Get this wrong and the variable is permanently empty |
| **Variable name** *(the title at the top)* | `dlv - event_id` | Just a label, but the tags refer to it as `{{dlv - event_id}}`, so the prefix must match |

Repeat for all seven — Data Layer Variable Name on the left, variable title on the right:

- [ ] `event_id` → name it `dlv - event_id`
- [ ] `booking_value` → name it `dlv - booking_value`
- [ ] `booking_currency` → name it `dlv - booking_currency`
- [ ] `tour_id` → name it `dlv - tour_id`
- [ ] `tour_name` → name it `dlv - tour_name`
- [ ] `items` → name it `dlv - items`
- [ ] `user_data` → name it `dlv - user_data`

> Leave **Data Layer Version** at its default (Version 2) and **Set Default Value** unticked.

### 6b. The 1 trigger

**Triggers** in the left sidebar → **New** → **Trigger Configuration** → **Custom Event**.

- [ ] **Event name:** `booking_complete` — exactly, lowercase, with the underscore
- [ ] Leave it on **All Custom Events**
- [ ] Name the trigger `booking_complete`

### 6c. The 4 tags

**Tags** in the left sidebar → **New** for each.

- [ ] **Conversion Linker** — trigger **All Pages / Initialization** *(not `booking_complete`)*
- [ ] **Google Ads Conversion** — trigger `booking_complete`; Value `{{dlv - booking_value}}`,
      Currency `{{dlv - booking_currency}}`, **Transaction ID `{{dlv - event_id}}`**, Enhanced
      Conversions from `{{dlv - user_data}}`
- [ ] **GA4 purchase** — trigger `booking_complete`; event name `purchase`; params
      `transaction_id`, `value`, `currency`, `items`; **Measurement ID** = your `G-` ID
- [ ] **Meta Pixel** — trigger `booking_complete`; **`eventID = {{dlv - event_id}}`**

### 6d. Container settings

- [ ] Admin → Container Settings → enable **consent overview**
- [ ] Check each tag's built-in consent settings (Ads needs `ad_storage`, GA4 needs
      `analytics_storage`)

> 🚨 **Do NOT add a "Google tag" / GA4 configuration tag** — and do not paste a GA4 snippet into
> Settings → Scripts either. The site loads GA4 from the dashboard field in step 5; a second
> configuration doubles your pageviews, and the Scripts route additionally runs *before* the consent
> defaults, so it would fire with no consent signal.
>
> 🚨 **The Meta `eventID` is the whole deduplication contract.** Without it every booking is counted
> twice — once from the browser, once from our server.
>
> - [ ] **Publish the container.** Nothing takes effect while it is a draft.

---

## Step 7 — Turn on the browser half, then REBUILD · *needs a developer*

> **Where: NOT a dashboard.** This is an environment variable on the frontend deployment, followed by
> a rebuild. On Vercel: Project → Settings → Environment Variables → Production. On the VPS: the
> frontend's `.env.production`, then rebuild the container/app. **This is the one step you cannot do
> from any admin screen** — ask whoever deploys.

- [ ] Set `NEXT_PUBLIC_ENABLE_TRACKING=true` on the **production** frontend only
- [ ] **Rebuild and redeploy the frontend**

> 🚨 The value is inlined at build time. Restarting is not enough. Skip the rebuild and you get the
> most misleading failure available: the container loads and looks perfectly healthy while no
> `booking_complete` is ever produced.
>
> Staging must **not** have this flag.
>
> **Verify:** on a live page, dev tools → Network → filter `gtm.js` and `gtag/js` — both load.

---

## Step 8 — Test · *use a FRESH booking for every check*

> **Where:** your live public site (to make the bookings), plus four viewers —
> **GTM Preview** (`tagmanager.google.com` → Preview), **GA4 DebugView**
> (`analytics.google.com` → Admin → DebugView), **Meta Test Events**
> (`business.facebook.com` → Events Manager → Test Events), and your browser's dev tools.

> A booking's conversion can be claimed once, and the claim is used up the first time its thank-you
> page loads — even with tracking off. You cannot re-run a failed check on the same booking.
>
> 🚨 **These are real conversions.** Decide now: refund them after (which also gives you step 9 for
> free), or note the references to discount them in early reports.

- [ ] **8.1 Event fires** — GTM Preview: exactly one `booking_complete`; the three
      `booking_complete` tags fired *(Conversion Linker fires on every page, not here — correct)*
- [ ] **8.2 Value is right** — `booking_value` is your **commission**, not the tour price. A €500
      tour at 20% ≈ `100`. `booking_currency` is always `EUR`
- [ ] **8.3 GA4** — DebugView shows one `purchase`. **Refresh the thank-you page: no second event.**
      Open in a new tab: still nothing
- [ ] **8.4 Meta** — Events Manager → Test Events: both `Purchase` rows carry the **same Event ID**.
      *Two rows is normal; Test Events is a receipt log, not the dedup verdict*
- [ ] **8.5 Consent** — EU VPN, private window, land with `?gclid=test123`. Before accepting: **no
      `it.attribution.v2` cookie**. After accepting: it appears containing `test123`
- [ ] **8.6 All four payment models** — `OPERATOR_LINK` (deposit), `ON_ARRIVAL`, `PAID_IN_FULL`,
      `OPERATOR_FULL` (instant, no payment step). Card ones through **both Stripe and Mollie**
- [ ] **Clear the Meta Test Event Code** — while set, conversions do not count

> **If 8.3 shows pageviews but no `purchase`:** that is the one case needing a Google tag. Add one
> with the same `G-` ID on All Pages and clear the Measurement ID on the GA4 purchase tag.

---

## Step 9 — Prove a cancellation corrects itself · *needs step 2 approved*

> **Where:** cancel in **your own dashboard** (Bookings → the booking → Mark cancelled — admin only),
> then check **Meta Events Manager** and **`ads.google.com` → Goals → Conversions**.

- [ ] Cancel a confirmed test booking with a **full refund**
- [ ] Meta Events Manager: a `Refund` event appears within minutes
- [ ] Google Ads → Goals → Conversions → adjustments: check **after** 24 hours

> Two traps: only an **admin** can cancel a confirmed booking, and you only get a full refund if you
> cancel **before that tour's free-cancellation cut-off** — cancel one for tomorrow and the deposit
> is correctly kept, which sends **no** Ads correction at all.
>
> The retraction is deliberately held 24 hours before being sent, then Google takes its own time.
> Nothing at hour 24 is expected, not a fault.

---

## Step 10 — Deliverables & monitoring

> **Where:** `ads.google.com` for the diagnostic; any screen recorder for the walkthrough; this repo
> for the event-reference doc; and the database / Bull Board for monitoring (ask an engineer to run
> the query or give you access).

- [ ] ~48h after step 8: `ads.google.com` → Goals → Conversions → your conversion action →
      **Enhanced Conversions diagnostics** → match rate **>60%**
- [ ] Record the stakeholder walkthrough (where each event lands in Ads, Meta, GA4)
- [ ] Write the event reference (`TRACKING-EVENT-REFERENCE.md`) — *PRD deliverable, still open*
- [ ] 14 days: daily check of the failed-job set and `conversion_events` for `FAILED` rows

```sql
-- anything rejected by a platform
SELECT platform, kind, status, error, "createdAt"
FROM conversion_events WHERE status = 'FAILED'
ORDER BY "createdAt" DESC LIMIT 20;
```

---

## Step 11 — SEO housekeeping

> **Where:** `search.google.com/search-console` for the first two, then **your own dashboard** →
> Settings → SEO for the rest. The destination titles are in each destination's own page-content
> editor, not in Settings.

- [ ] `search.google.com/search-console` → add the domain → **HTML tag** method → paste **only the
      code** into your dashboard → Settings → SEO → "Search Console Verification Code" → Save →
      back in Google, click **Verify**
- [ ] Search Console → **Sitemaps** → enter `sitemap.xml` → Submit
- [ ] **Write a meta title for each destination.** Unlike every other page type, a destination with
      no authored title inherits the sitewide default — so `/en/curacao` and `/en/aruba` share one
      title until you do
- [ ] Leave **"Robots Meta"** empty unless certain — it applies site-wide, and `noindex` there
      removes the whole site from Google
- [ ] If you paste a **custom robots.txt**, re-add `Sitemap:` yourself and note it also replaces all
      ten Disallow lines

---

## If something looks wrong

| Symptom | Cause |
| --- | --- |
| No conversions, container looks fine | Step 7 rebuild skipped |
| Everything looks organic, no click IDs | Cookiebot ID missing (step 5) |
| Every booking twice in Meta | `eventID` missing on the Meta tag (step 6) |
| GA4 pageviews roughly doubled | A GA4 config tag in the container as well as the dashboard ID |
| No GA4 data at all | ID not saved, or not a valid `G-…`, or step 7 rebuild skipped |
| GA4 pageviews but no `purchase` | No GTM container ID configured (the purchase event is a container tag), or the GA4 purchase tag's Measurement ID is unset |
| `Refund` in Meta for a booking you didn't refund | Expected — kept-deposit cancellations still send a labelled refund to Meta; only Ads is left alone |
| Ads cancellations not correcting | Developer token / Ads credentials not entered |
| Values far too big | Reporting tour price instead of commission — **escalate to an engineer** |
| Thank-you page shows "we need to check something" | That booking is missing its commission figure. Valid and paid; the internal record is not. Nothing was reported for it |

Ground truth when a platform dashboard disagrees with you: the `conversion_events` table and the
retained failed jobs in Bull Board.
