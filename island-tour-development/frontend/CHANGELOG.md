# Frontend changelog

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
