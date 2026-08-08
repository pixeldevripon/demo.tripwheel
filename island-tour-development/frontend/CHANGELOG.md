# Frontend changelog

## 2026-08-08 — Search results screen rebuilt to the client mockup (mck-12)

The client's own render of `/search` (mck-12, supplied as screenshots — the HTML
is still not in this repo) turned out to be a different screen from the one we
had shipped, not a restyle of it. Three things changed shape.

### The head states the outcome

Was: a static `h1` reading **"Search"**, with a small grey count line beneath it.
It told a traveller who had just searched nothing they did not already know.

Now: a scope pill, then the `h1` **"12 results for “boat”"** / **"No results for
“boat”"**, then one line saying what to do next — on zero with a date, *"Nothing
matches this search on 25 Aug."*, which names the constraint instead of shrugging.

The `h1` therefore **moved out of the prerendered shell** into the streamed
section: it carries the result count, which no prerender can know. The page is
`noindex`, so no crawler needs it in the shell, and the skeleton holds its place.

**The island is the pill, not the heading.** Both had been tried and each was
wrong on its own: a separate removable "Curaçao ✕" chip read as a stray filter
and offered an escape to an all-islands search the spec does not have, while
folding it into the sentence *and* keeping a chip said it twice. The mockup
splits it — scope above, result sentence below — and that is now enforced by a
test.

### The recovery block became a section, not a card

Was: a centred bordered card holding a few pill links.

Now: a full-bleed tinted band carrying, in the mockup's order — kicker and
heading with **"See all 25 Curaçao tours →"** pinned right; the removable date
chip and its sentence; the inline **Popular searches** run; the category/hub tile
rail; and the island's **Locals' favorites** grid, so the band ends on something
bookable rather than another list of links.

**"Drop the date and 12 “boat” tours come back"** is a real second search, not a
guess — the section re-runs the query without the date and prints the count it
gets. When that count is **0 the whole line is withheld**: it promises tours come
back, and a link straight back to the same empty page is worse than no link.

**Popular searches is the hero panel's list, from the same function.** The
requirement is that this line *exactly represents* the curated search items, and
the two had already disagreed: the band led with a hub then jumped to the lead
collection before naming a single activity type, while the hero panel listed
hubs, then activity types, then collections — same island, same moment, two
answers to "what is popular here". `buildDiscoveryLinks()` is now the one place
that decides, and both surfaces call it. Curated `SEARCH_PANEL` wins outright,
the hero's curated row is the second choice, and the automatic fallback is hubs →
activity types → collections. Without that fallback the group renders empty on
**every island today**, because nothing is curated yet. Each entry is gated on
its target page rendering upstream, so a link that cannot open is never listed.

**The chosen date travels with the traveller.** Every link out of the band —
popular searches, the tile rail, the "See all" links, and each Locals' favorites
card — carries `?date=`. Without it the date they picked was dropped at the door:
they landed on a listing showing every departure, re-picked the same date, and
the site looked like it had forgotten. The one link deliberately left bare is the
date-drop chip, since removing the date is its whole purpose.

### Reuse, rather than a second copy of everything

The band mounts the site's real components: `ExploreTypesRail` was **extracted**
from `DestinationExploreTypes` so both surfaces share one carousel, and
`SectionHead` (kicker + `h2` + optional right action) replaces the third
hand-written copy of that markup. The tile fallback background is now a prop —
the default `bg-it-bg` is invisible against the band's `bg-it-surface`, which is
exactly what it looked like: a title and a tour count floating over nothing.

### Kept against the mockup

**The toolbar stays hidden on zero results**, which mck-12 does not do. A filter
row over an empty grid offers to sort nothing and narrow nothing. Because that
would otherwise trap anyone whose filter emptied the page, the band leads with
`Clear all filters` whenever one is active. The toolbar's own *"{shown} of
{total} tours"* counter is off on this page (new `showCount` prop) — the heading
is the count, and the mockup's own annotation says so.

### Also

- `Only 1 match`, not `Only 1 matches` — the plural was showing on any 1-result
  search.
- 39 new unit tests over the two new components and the shared link builder,
  covering each state and, as much, what each state must *withhold*.
- Nine dictionary keys added and four removed across all seven locales;
  `DICTIONARY_VERSION` bumped.

## 2026-08-02 — Wave 3: tour detail, listings, SEO output

~56 components, 6 routes and the SEO libs. Two subagents; every finding verified
against source (and against the backend, for the sanitization claims) before any
change.

### Fixed — security

**Path traversal from a URL segment into a backend request made as the trusted
SSR origin.** Next decodes dynamic route params and does not strip dot segments,
so `GET /en/%2E%2E%2F%2E%2E%2Ftours` gives a page `params.destination ===
'../../tours'`. Interpolated raw into a backend path, the WHATWG URL parser
inside `fetch` **resolves** it — relocating a request that carries
`x-internal-api-key` to an endpoint the visitor chose. With enough segments it
leaves `/api/v1` entirely and reaches `/api/auth/*`.

Sized honestly: the internal key grants only a *throttle exemption*, and only on
routes without their own `@Throttle`, so no data is disclosed today. What it did
give an anonymous visitor was full control of path **and query** on those calls
— the segment is appended before `buildQuery` — issued outside the global rate
limiter. And it falsified the premise the whole trusted-origin design rests on:
that this caller is our own infrastructure. The next backend route that trusts
the internal key for anything beyond throttling would have been remotely
exploitable with no frontend change.

Fixed in two layers, because "remember to encode" had already failed across ~15
call sites while `pages.ts` and the booking readers got it right: `seg()` at
every interpolated segment, and `assertBackendUrl()` in the fetch layer as the
backstop for the next one that forgets.

> The guard's first draft was wrong, and its own test caught it. Checking only
> "does the resolved URL still start with the base" passes
> `/destinations/slug/../../tours`, which lands on `<base>/tours` — inside the
> base, having fetched a completely different endpoint. It now rejects dot
> segments outright: what matters is not where the path lands but that the
> caller did not choose it.

**Every non-existent URL answered 200 with a self-referencing canonical and a
seven-locale hreflang cluster.** `generateMetadata` runs before the page's
`notFound()`, and under `cacheComponents` the shell has already flushed, so the
status is 200 regardless — the comment claiming otherwise was wrong. Anyone
could link to `/{locale}/{spam-phrase}/tours` and hand a crawler the strongest
possible "this is a real, indexable page" signal, on our domain, for free. Ten
call sites now return `NOT_FOUND_METADATA` (`index: false`, no canonical, no
alternates); `follow: true`, because it is indexing we refuse, not crawling.

### Fixed — correctness

**A hub could print a price in the wrong currency.** `deriveDisplayRate` derives
the FX rate from Our Picks and the comparison groups — both *editorial* and
optional. A hub with tours but neither yields no rate at all, and the helper
answered with the identity rate under the *shopper's* currency: a $120 tour
rendering **"From €120"** as the first price on the page, while the trips grid
below showed the correctly converted figure. It now reports `converted`, and the
pill is dropped rather than printed — a missing pill is strictly better than a
wrong price. The same guard was applied to the collection hero, which has the
identical shape.

**"Clear all" in the filter modal did not clear.** It reset price to the static
`[0, 560]` rather than the destination's real ceiling. Above 560,
`filtersToTourQuery` still sent `maxPrice=560` — so clearing the filters left
every tour over $560 hidden and the badge still read 1. Below 560 the slider
handle rendered off its track. `ToursFilterBar.clearAll` had always been correct,
which is what gave it away.

**A pending category could be silently dropped.** `currentState.categories` read
the server prop while every other consumer read the optimistic set. Toggle a
category, then change sort before the round-trip lands, and the href rebuilt
from the pre-toggle list — losing the selection and its chip.

### Also

`LAUNCH_DESTINATION_SLUGS` was declared identically in three route files; it is
the build-time prerender fallback, so drift there fails *only* on a build where
the backend is down — invisible until production. `CategoryTrustStrip` was 54
lines with zero importers (its dictionary keys are now unused and can be pruned
separately).

### Verified sound — do not "simplify" these

- **Review text is never HTML.** The `dangerouslySetInnerHTML` in
  `tour-reviews-blocks.tsx` is the JSON-LD block, not review content; every
  render of review text is a bare JSX expression. Full census: 4 real sinks, all
  safe.
- **JSON-LD cannot be broken out of.** Both emitters do
  `JSON.stringify(...).replace(/</g, '\\u003c')`, so neither `</script` nor
  `<!--` can be formed.
- **The Pages sanitizer is a real allowlist**, applied on create *and* update,
  with per-CSS-property `allowedStyles` and `allowProtocolRelative: false`.
- **The catch-all route is the safest of the routes** — it already encodes its
  slug, and its redirect target cannot start with `/` or contain `.`.
- **The image allowlist is five exact hostnames**, no wildcards; `dangerouslyAllowSVG`
  is paired with its full CSP + sandbox + attachment mitigation.
- **Search reflection is clean** — `q` reaches only an escaped `<title>` on a
  `noindex` page and escaped JSX text.

### Still open

Admin custom scripts run on the tokenized routes (`/review/<token>`,
`/cancel/*`, `*/thank-you/*`, receipts, `/checkout/processing`) because they
mount in the root layout. The write-path allowlist is genuinely strict and
React drops `on*` props, so this is a *reach* problem, not an injection one: a
compromised vendor CDN could read a review write-token from `location.pathname`.
Fixing it means moving the mount off those subtrees, which changes the
once-per-document guarantee — a product decision, and it lands alongside the
existing GA4 `page_location` item.

## 2026-08-02 — Wave 2 follow-up: URL input hardening

**`quote` and `departure` are now shape-checked before they leave the page.**
Both were read raw from the query string, so a stale or hand-edited
`?quote=junk` failed at the backend's `@IsUUID()` and the checkout relayed that
message verbatim — a traveller reading "quoteId must be a UUID" on the page
where they are about to pay. Both are optional to the flow (reserve recomputes
regardless of `quoteId`), so discarding a malformed one is strictly better than
forwarding it.

The matcher is deliberately **version-agnostic**, unlike the v4-strict
`UUID_SHAPE` that guards the client idempotency key we mint ourselves. Departure
ids are backend-generated (Prisma `@default(uuid())`); version-pinning them here
would mean a future Prisma default silently rejecting every real id — a far
worse failure than the malformed input being filtered out.

**Party counts must now be whole numbers.** `Number.isFinite` accepted `2.5`,
which reached the backend's `@IsInt()` and came back as another validator string
rendered at the traveller.

**`SectionBadge` and `Collapse` moved to `checkout-fields.tsx`**, which is that
file's stated job. They were stateless presentation sitting below a 950-line
component. `checkout-form` is now 937 lines, down from 1054 before the wave.

### Still open — needs product input, not code

**Back from the thank-you page lands on a live checkout that will book again.**
After a successful booking the history is `[…, checkout, TYP]`, so Back returns
to a checkout whose query selection is still valid and which renders a complete,
empty contact form. Filling it in reserves a second booking and charges a second
time. The app already knows this happened — `it.justBooked` is set for 15
minutes — but the checkout never reads it.

Not fixed here because the fix is an interstitial ("you just booked this — view
your booking"), which needs new copy in all seven locales **and** a deliberate
"book another" escape so a genuine repeat booking is not blocked. That is a
product decision about the flow, not a refactor.

## 2026-08-02 — Wave 2: checkout, payment and the booking widget

Same two subagents, same verify-before-fix discipline, over ~7,000 lines: the 9
checkout components, the 17-file booking widget, the 797-line booking store,
both PSP integrations and the processing route.

**The headline refutations matter as much as the fixes.** Price integrity is
clean end-to-end — `ReserveBookingDto` carries no price, deposit, discount or
coupon field, `forbidNonWhitelisted` turns a smuggled one into a 400, and the
charge reads from the persisted booking. Both PSP components are PAN-free. The
booking store has **no persistence middleware at all** (only two sessionStorage
keys, no PII, no price, no token), and `hydrateSelection` is a genuine
validating deserializer. No open redirect. No PII in the dataLayer.

### Fixed — money display

**Checkout put the currency symbol on the WRONG SIDE in 5 of 7 locales.**
`formatCheckoutMoney` built `${symbol}${amount}` by hand. `Intl` renders EUR as
`1.750,00 €` in de/fr/es and `€ 1.750,00` in nl/pt — and the same is true of
USD (`120 $` in de/fr/es), so a "dollar always leads" assumption is wrong in
exactly the locales the euro rule is wrong in. The booking card showed **both
spellings at once**: its price header used the hand-rolled version, the
alternatives row directly beneath used `formatPriceFrom`.

Fixed by deleting the hand-rolled formatter and delegating to `formatPriceFrom`
— `formatPriceFrom`, not `formatMoney`, so the cents behaviour is **unchanged**
(whole amounts stay bare per the founder rule). `TourBookingData` now carries
the currency CODE instead of a glyph; the `currencySymbol` prop turned out to be
pure redundancy, since `currency: Currency` was already threaded beside it in
half the components. The widget's `money()` was a verbatim copy of the same
function and now routes here too.

*Still divergent, deliberately:* a whole total reads `$1,750` at checkout and
`$1,750.00` on the thank-you page, because the TYP uses `formatMoney`. That is a
product decision about the funnel's cents rule, not a formatting accident.
`thank-you-summary.tsx`'s claim to use "the canonical formatter, same as
checkout" is now literally false and should be resolved with it.

### Fixed — security

**A declined charge leaked a 30-minute seat hold on every retry.** The client
idempotency key was minted fresh on every mount of `CheckoutForm`. A failed
charge deliberately leaves the booking `ON_HOLD` with its seats claimed so the
traveller can retry — then bounces back to `?payment=failed`, which **remounts
the form with a new UUID**. Continue therefore reserved a *second* booking and
claimed the party's seats again. Two declines on an 8-seat boat left 9 of 8
seats held, and the third attempt was refused for a departure that was actually
empty. Reserve is `@Public`, so this needed no account and no card.

The key is now persisted per tour and reused on a `?payment=failed` return
(shape-checked on the way back out of client-writable storage), and cleared the
moment a booking confirms so a reused id can never outlive its booking.

**The Pay button could promise less than the charge.** `payToday` is client
arithmetic, refreshed from `POST /bookings/quote` only when a priced pickup zone
is chosen — and that re-quote swallowed its failures and kept the previous
totals. `reserve` then recomputed server-side *with* the pickup and charged
more. The backend returns the authoritative figure on the payment intent and the
frontend was discarding it; the CTA now renders that.

### Still open — needs a decision

**`/checkout/processing?ref={publicRef}` puts a booking capability into GA4's
`page_location`.** This is a **fifth** tokenized route, and Wave 1's remediation
note enumerated only four — so the planned fix would have shipped and still
leaked. It is also the landing point for every non-inline PSP redirect.

Worth stating plainly: this cannot be fixed frontend-only. The other four routes
carry their token in the URL **path**, which cannot be scrubbed without breaking
the page, so a `page_location` override in the GTM container is the only real
remedy. The processing route alone could be scrubbed via `replaceState`, but
that would break refresh-resume on a page the traveller reaches *after paying*.

## 2026-08-02 — Wave 1 audit: traveller auth and private surface

A full code-quality and security review of the traveller auth/private surface,
run by two specialised subagents (`frontend-code-reviewer`,
`frontend-security-reviewer` in `.claude/agents/`), with every reported finding
verified against source before any change was made.

**Scope reviewed:** `app/(login)/**`, `/{locale}/traveller` + receipt,
`/review/[token]`, `/cancel/[publicRef]`, `thank-you/[publicRef]`, all seven
`app/api/**` route handlers, `proxy.ts`, the traveler-session and
traveler-booking libs, and the `login` / `traveller` / `review` / `cancel` /
`thank-you` component trees.

**Result:** 4 correctness defects and 4 security defects fixed. Build, lint and
typecheck clean; 216 unit tests added and passing.

---

### Added — a unit test runner

The app had Playwright and nothing else, so there was nowhere for a unit test to
live. Added **Vitest + Testing Library + jsdom** (`vitest.config.ts`,
`vitest.setup.ts`, `pnpm test`).

*Why Vitest, not Jest:* the backend is Jest because NestJS is, but this app is
ESM-first, path-aliased and full of `.tsx` — the exact setup Jest needs a
transform stack and a `moduleNameMapper` to survive. Vitest reads the same
`tsconfig.json` paths through `vite-tsconfig-paths`, so there is no second copy
of the alias config to drift.

It does **not** replace Playwright. Async Server Components, `'use cache'`
semantics, PPR boundaries and the real cookie jar are only honest in `e2e/`; the
two runners are kept apart by `exclude`.

---

### Fixed — correctness

**Object URLs were revoked while their tiles were still on screen**
`components/frontend/review/review-photo-uploader.tsx`

The cleanup effect listed `pending` as a dependency, so its teardown fired on
every *append*, not just unmount. Picking a second photo while the first was
still uploading ran the cleanup captured over `[A]` and revoked A's preview —
a broken image mid-upload, on exactly the slow connection the optimistic preview
exists to cover.

*Why it was necessary:* the failure only appears with overlapping uploads, which
is the normal case on a phone, and it looks like a failed upload to the guest.
Now unmount-only, reading through a ref; `accept()`'s `finally` already revoked
each batch on the normal path.

**The account area formatted money by the listing rule**
`components/frontend/traveller/traveller-format.ts`

`money()` delegated to `formatPriceFrom` — the listing "From" formatter, which
renders whole amounts bare — while every other money surface uses `formatMoney`.
A booking total read `$1,750` on `/traveller` and `$1,750.00` on the thank-you
page one click away, and **the printable receipt dropped cents** on any whole
amount.

*Why it was necessary:* this is a documented invariant, not a preference.
`thank-you-summary.tsx` already records the identical bug being fixed once
("a 1750 total rendered as `$1750` … while every other surface showed
`$1,750.00`"). A receipt is a financial document.

**`/cancel` could build a protocol-relative URL**
`app/(frontend)/[locale]/cancel/[publicRef]/page.tsx`

`` `/${booking.destinationSlug}/thank-you/…` `` was unguarded, where
`destinationSlug` is `typ.island ?? ''` and `island` is nullable. An empty slug
yields `//thank-you/{ref}` — which the browser reads as protocol-relative and
resolves to `http://thank-you/{ref}`, navigating the traveller **off-site**
rather than 404ing. Used four times on that page and twice more in
`CancelRequestCard`; every sibling call site already guarded.

Fixed via `travelerBookingPath`, which was moved to the new
`lib/traveler-booking.shared.ts` — `lib/traveler-booking.ts` declares itself
client-only (`document.cookie`), and a Server Component must not import it. This
mirrors the existing `traveler-session.server.ts` / `.shared.ts` split. The old
export is re-exported, so no caller changed.

**The payment-method label was built twice and had already drifted**
receipt page ↔ `traveller-payments-list.tsx`

Both defined `capitalize` verbatim, then composed the label differently. With a
brand and no last4 the receipt rendered `Visa ··` — its `.trim()` stripped the
trailing space but not the separator — while the ledger correctly rendered
`Visa`. The receipt is linked directly off a ledger row, so a traveller sees
both. Now one `paymentMethodLabel()`; both local copies deleted.

---

### Fixed — security

**`/api/debug/errors` served the whole cross-user error buffer**
`app/api/debug/errors/route.ts` — *High, precondition `NEXT_PUBLIC_ERROR_DEBUG=1`*

With the flag on, a `GET` with no `digest` returned entries from a
**process-global** ring buffer holding the last 50 errors from every visitor on
that instance — with no same-origin check, no secret and no rate limit. Each
entry carries the request URL, and on this site URLs *are* credentials:
`/{locale}/review/<token>` is a **write** token (it authorizes submitting a
review as that guest), and `/cancel/<publicRef>`, `…/thank-you/<publicRef>` and
`/traveller/receipt/<paymentId>` are booking view capabilities. Polling the
endpoint would harvest them.

*Why it was necessary:* the digest-less branch had **no legitimate caller** —
`error-debug-panel.tsx` returns early without a digest and always sends one. It
was pure attack surface. Now requires a digest and passes `isSameOrigin`; the
panel is unaffected.

> Still open, operational: the file claims the flag can be turned off in the
> deploy environment without a code change. `NEXT_PUBLIC_*` is inlined at
> **build** time, so that may require a rebuild. Worth verifying before relying
> on it during an incident. Better still, delete the diagnostic — the file
> headers already say to.

**Traveller writes collapsed the backend throttle into one platform-wide bucket**
the three `app/api/traveller/*` POST proxies — *Medium, cross-user DoS*

These proxies correctly avoid `lib/api/public/fetch` so a user-triggered write
does not borrow the internal key's throttle exemption. But that also meant they
could not forward `x-real-client-ip`, which the backend honours **only**
alongside a valid internal key. So `getTracker` fell through to `req.ip` — this
app's single egress address, identical for every traveller.

The backend routes carry `@Throttle({ short: 1/10s, medium: 3/min, long: 10/hr })`.
Net effect: **ten cancellation requests per hour for the entire platform.** Any
traveller with a valid session could fire one every ~6 minutes and hold the
bucket exhausted, while everyone else's request failed inside their
free-cancellation window — surfaced to them as a generic error, with no hint to
retry. Missing that deadline is direct financial harm. The backend's own
diagnostic warning only fires for *trusted* callers, so these 429s were silent
on both sides.

Fixed with `lib/api/visitor-throttle.ts`, following the one call site that
already got this right (`claimConversionPush`).

*The subtlety that makes this safe, and why the fix is scoped:* the backend's
`skipIf` is `isTrustedInternalOrigin(ctx) && !hasOwnThrottleOverride(ctx)`. On a
route that declares its own `@Throttle()`, the key **cannot** bypass — it only
re-keys the bucket per visitor. On a route without one, the same key **removes**
rate limiting entirely. So this was applied to the three POST mutations only;
`GET /traveller/contact` and `GET /date-change-options` have no override and
deliberately keep sharing the egress bucket. That distinction is documented at
both the helper and each call site.

**Sign-out left the account page in the client router cache**
`account-menu.tsx`, `traveller-session-row.tsx` — *Low*

On an account-gated path the handler awaited `signOutTraveller()` (which does
correctly delete the HttpOnly cookie) then called `router.replace(…)` — not
`router.refresh()`. The already-fetched `/{locale}/traveller` flight payload,
containing the full booking and payment list, stayed in the in-memory router
cache: log out on a shared machine, next person presses Back, reads everything
with no credential. `replace()` navigates; only `refresh()` evicts.

**Client-readable identity cookies carried no `Secure` flag**
`lib/traveler-booking.ts` — *Low*

`it.travelerBooking` holds `{email, ref, path}` — the traveller's email plus
their booking's public ref. It and its two siblings were written with
`path`/`max-age`/`samesite` only, so any `http://` request to this host attaches
them in cleartext (no HSTS header is set). These cookies authorize nothing —
that part of the design is correct and was verified — but they are PII plus a
view capability.

All six writes now go through one `writeCookie()` helper that adds `secure` when
the page is on https. Conditional because a `secure` cookie is silently dropped
on plain http, which would break local dev.

---

### Changed — design-quality findings (no behaviour change)

Every item below is a DRY/SOLID/composition finding. None alters what renders;
242 tests, build, lint and typecheck all pass unchanged.

**One definition per fact.** New shared helpers, each replacing 2–14 copies:

| Helper | Replaced | Why it mattered |
|---|---|---|
| `lib/api/backend-url.ts` `BACKEND_API_BASE` | 14 copies of the same env read | one rename applied thirteen times is a silent prod bug |
| `lib/booking-ics.ts` `bookingIcsUrl()` | 2 | the component copy **had no `encodeURIComponent`** |
| `traveller-format.bookingMetaLine()` | 3 | hero and card show the same booking, stacked |
| `traveller-groups.freeWindowOpen()` | 3 | all three render in ONE expanded card; disagreeing = contradicting itself |
| `traveller-format.onArrivalLine()` / `payBalanceLine()` | 2 each | money copy |
| `traveller-format.paymentMethodLabel()` | 2 (already drifted) | |
| `traveler-session.shared.PUBLIC_REF_SHAPE` | 3, under 2 names | a tightening had to be remembered three times |
| `cancel-card-shell.ts` | 5 copies of an unnamed shadow literal | the four cancel states must look identical |
| `thank-you/booking-ref-pill.tsx` | 2 byte-identical blocks | |
| `thank-you-recommendation` `RecLink` | 2 blocks differing by `0.98` vs `0.99` | the external-vs-internal routing rule was the duplicated fact |

`DEPARTURE_ID_SHAPE` is deliberately its own constant despite being identical to
`PUBLIC_REF_SHAPE` today — a departure id is a different kind of value that
merely happens to match, and collapsing them would couple the two formats.

**Dependency direction.** `paymentChipFor` moved from `traveller-booking-card`
to `traveller-chip`, where everything it uses already lived — the hero was
importing a *card* module to get a *chip*. `traveller-next-trip` no longer reads
`process.env`; it was the only component in the repo that knew the backend's
origin.

**Purity.** `traveller-view`'s tab state was mirrored from a prop through an
effect, which commits one render showing the stale tab — a visible flash of the
wrong list on every paginate. Now the adjust-during-render form. The local copy
is still needed: `selectTab` uses `history.replaceState`, so state and prop
legitimately diverge.

**Composition.** The booking panel's pickup and meeting-point rows were a
26-line verbatim copy differing in three values; the branch was already resolved
above the JSX. Now one row.

**Contract.** `requestBookingCancellation` now delegates to
`requestCancellationClient` instead of re-posting the same body to the same
route. Two copies of one contract, reached from different surfaces, so the next
field added would have 400'd at runtime from whichever caller was not under
test. Only the failure convention (throw vs boolean) differs, which is what the
wrapper is now for.

**Docs that actively misled.** Two orphaned docblocks that contradicted the
block immediately below them (`SIGNED_OUT_BAND`, `EMAIL_SHAPE`); a pointer to a
`beforeFiles` rewrite in `next.config.ts`, which has no `rewrites` at all — the
rewrite is in `proxy.ts`. In a codebase this comment-driven, a stale comment is
a defect. Also: the receipt skeleton promised "the live page's EXACT frame
classes" while spelling the same width two ways (`max-w-[780px]` vs
`max-w-195`) — that is how a skeleton drifts into a CLS bug.

### Explicitly considered and NOT changed

**The four traveller proxies were not merged into a generic helper.** They share
the two things that matter — `isSameOrigin` and `getTravelerSessionToken` — and
genuinely differ on verb, response shape, cache-busting and `no-store`. A
parameterised `proxyTraveller()` would need arguments for all of it and would be
harder to audit than four flat handlers, which is the wrong trade for a route
replaying a 24-hour all-bookings credential. Only the shared *facts* were
extracted.

**Tokenized URLs still reach GTM/GA4.** `<GoogleTagManager />` wraps the whole
`(frontend)` tree, so GA4's automatic `page_view` sends `page_location` —
including the review write-token and booking refs — on the tokenized pages. This
is real and worth fixing, but the obvious fix (dropping analytics from those
routes) would break `booking_complete` conversion tracking on the TYP, which is
core business logic. The right fix is a `page_location` override that rewrites
`/review/*`, `/cancel/*`, `*/thank-you/*` and `/traveller/receipt/*` to a
token-free path, and it needs a product decision plus GTM container config.
**Left open deliberately.**

**The two payment decision trees were NOT merged.** The review called the
next-trip hero's `payLine` a duplicate of the payment box's tree. Read side by
side they are not: the box additionally handles terminated, requested and refund
states the hero never renders, and it emits money ROWS interleaved with notes
rather than one sentence. A shared `paymentLine()` would need parameters for all
of that — the same over-parameterised helper rejected for the route handlers.
Only the two arms that ARE the same fact (`onArrivalLine`, `payBalanceLine`)
were extracted.

**A pair-login still overwrites a live HISTORY-scoped session.** Verified
present, and the direction is a downgrade, never an escalation. It is documented
and covered by an existing test asserting the behaviour is intentional ("a fresh
pair-login or OTP is a deliberate sign-in and must take effect"). Not changed
without a product call.

---

### Verified sound (do not "simplify" these)

- `exp` is **milliseconds** on both sides of the traveler-session token. Swept
  every other expiry interpretation in the app — no second instance of that bug
  class. Now pinned by a test.
- The HttpOnly session reaches client JS by **no** path — checked props, RSC
  payloads, `dangerouslySetInnerHTML`, `localStorage`, query strings, analytics.
- `isSameOrigin` is correct, including the two ALLOW branches. `sec-fetch-site:
  none` cannot be produced by any browser primitive on a POST; the header-less
  case is a scripted client, which can already set its own cookies.
- Every per-traveller cached read is keyed on the session token **as a function
  argument** and tagged with a hash of it; every mutation busts the tag before
  responding.
- The `/bookings` `returnTo` allowlist is fail-closed and rejects `//evil.com`.
- Referer does not leak the review token: modern browsers default to
  `strict-origin-when-cross-origin`. (An explicit `Referrer-Policy` header would
  pin this rather than depend on the default — cheap hardening, not yet done.)
