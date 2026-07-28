# 02D - Domain Move Runbook (v2, 2026-07-28)

> **From** `islandtours.tripwheel.app` (public) + `dashboard.tripwheel.app` (admin) + `api.tripwheel.app` (backend)
> **To** `island.tours` (public) + `dashboard.tripwheel.app` (admin) + `api.tripwheel.app` (backend)
>
> **v2 REWRITE.** The v1 runbook (2026-07-19) staged a bearer-token migration on the public site
> (02C Option C). That migration is **no longer needed**: the public frontend has since dropped
> Better Auth entirely in favour of the HMAC traveler session (first-party cookie + header
> transport). See the **ADDENDUM at the top of `02C-CROSS-DOMAIN-AUTH-SPEC.md`** for the full
> reasoning and the code-level verification (2026-07-28). v1 is preserved in git history.
>
> **TLD note:** earlier docs said `tripwheel.io`; production is `tripwheel.app`. This runbook uses
> `.app` throughout. If the real apex differs, substitute consistently - the *shape* (public site
> on its own registrable domain, dashboard + API sharing another) is what matters.

---

## 0. The one-paragraph version

There is no auth migration in this move. The public site has **zero Better Auth**: traveler
identity is a backend-issued HMAC token stored in a **first-party HttpOnly cookie set by the
public app's own origin** (`POST /api/traveler-session` → `it.travelerSession`) and sent to the
API as the **`x-traveler-session` header**; the wishlist is a cookie-based no-login feature on the
frontend origin. Neither transport crosses a site boundary, so third-party cookie blocking is
irrelevant. The dashboard stays same-site with the API (`.tripwheel.app`) and keeps its HttpOnly
Better Auth cookies untouched. The whole move is **~4 env values across three apps, zero code**,
plus real-hostname verification.

---

## 1. The flow, before and after

### Today (shared apex, working)

```
  islandtours.tripwheel.app (public) ──x-traveler-session header──┐
     └─ its own origin sets it.travelerSession (first-party)      ├──> api.tripwheel.app
  dashboard.tripwheel.app ──Better Auth cookie .tripwheel.app─────┘
     └─ its own Next server reads that cookie (guard + layout)
```

### After the move

```
  island.tours (public) ──x-traveler-session header───────────────┐   CORS origin: island.tours
     └─ its own origin sets it.travelerSession (first-party,      ├──> api.tripwheel.app
        unaffected by the domain - the app sets its own cookie)   │
  dashboard.tripwheel.app ──Better Auth cookie .tripwheel.app─────┘   same-site, unchanged
```

**Nothing about auth changes shape.** The only cookie that stops flowing is the optional
attribution ride-along (§4), which was never load-bearing.

---

## 2. Preflight - confirm the assumptions still hold

Run these before touching DNS. Each one guards a claim this runbook depends on.

| # | Check | Expected | Guards |
|---|---|---|---|
| P1 | `grep -rn "createAuthClient" frontend/lib frontend/components frontend/app` | **no hits** | "public site has no Better Auth" - if this ever reappears (e.g. full customer accounts), STOP and re-read 02C §4A: the bearer plan becomes relevant again |
| P2 | `frontend/app/(login)/` contains **only** `[locale]/bookings` | yes | no operator doors stranded on the public origin |
| P3 | `grep -rn "credentials: 'include'" frontend/lib` | only `lib/api/fetch.ts` | the attribution leg is the single residual (§4) |
| P4 | Backend `main.ts` CORS `allowedHeaders` includes `X-Traveler-Session` + `X-Login-Surface` | yes (`main.ts:68-76`) | cross-origin preflights for traveler calls and sign-in |
| P5 | Admin settings → `canonicalUrl` | `https://island.tours` | sitemap, JSON-LD, canonicals, robots (the SEO base URL is this setting, NOT an env var) |
| P6 | `df -h` on the build host | ≥15 GB free | the build itself (see the disk trap in project memory) |

---

## 3. Order of operations

**Each step is safe to sit in indefinitely; only step 5 is a cutover.**

### Step 1 - DNS + cert for `island.tours`, no traffic yet

Stand up `island.tours` pointing at the (new) public-site deployment target. Leave
`islandtours.tripwheel.app` serving. Nothing user-visible changes.

### Step 2 - Backend env (the whole backend change: three vars, zero code)

```bash
# ADD the new origin; KEEP the old one until step 6 (both serve during transition)
CORS_ORIGINS=https://island.tours,https://islandtours.tripwheel.app,https://dashboard.tripwheel.app

# Email links (TYP, /bookings, cancel page, review requests) + the backend→frontend
# cache-revalidation target. Embedded verbatim in emails - no trailing slash.
ISLAND_TOURS_URL=https://island.tours

# Dashboard/API leg only - the public site never sees this cookie.
# ALREADY correct in production (confirmed 2026-07-28) - confirm, don't change.
COOKIE_DOMAIN=.tripwheel.app
```

**`CORS_ORIGINS` has THREE consumers, and missing one origin produces three different-looking
failures:**

| Consumer | Where | Failure if the origin is missing |
|---|---|---|
| CORS middleware | `main.ts:43` | every browser API call from `island.tours` blocked |
| Better Auth `trustedOrigins` | `auth.instance.ts:17` | origin rejection on any auth call (looks nothing like a CORS error) |
| **`assertAllowedRedirect`** | **`payments.service.ts:1129`** | **checkout dies**: Stripe/Mollie payment-intent creation 400s with "Return URL origin is not allowed" - the return/cancel URLs are validated against this same list |

The third one is the trap: it is server-side validation, so it fails even for browsers that
tolerate lax CORS, and it fails at the *payment* step, not at page load.

Restart the backend. **No sessions are invalidated** - `COOKIE_DOMAIN` was already the
`.tripwheel.app` apex on this topology; if it was previously unset or different, dashboard users
sign in once more.

### Step 3 - Deploy the public site to `island.tours`

**Zero code change.** Its env is domain-agnostic:

- `NEXT_PUBLIC_BACKEND_URL=https://api.tripwheel.app` - unchanged
- `REVALIDATE_SECRET` - unchanged (the bridge authenticates by secret, not origin)
- `INTERNAL_API_SECRET` - unchanged (SSR trusted-origin bypass; server-to-server)

> `NEXT_PUBLIC_*` values are inlined at **build** time. If any of them ever do change, that is a
> REDEPLOY, not a restart.

### Step 4 - Dashboard repo env

```bash
REVALIDATE_TARGET_URL=https://island.tours/api/revalidate
```

Miss this and every dashboard write **silently** stops busting the public site's cache - no error
anyone sees, just pages that never update. The POSTs 401/timeout in the dashboard logs only.

(`NEXT_PUBLIC_BACKEND_URL` in the dashboard stays `https://api.tripwheel.app` - unchanged.)

### Step 5 - Cut over

1. `island.tours` goes live (it already works - steps 2-4 made it a first-class origin).
2. **301 redirect** `islandtours.tripwheel.app/*` → `https://island.tours/*` at the
   infra/proxy level (SEO: preserves link equity; the sitemap/canonicals already say
   `island.tours` per preflight P5).
3. Update the GTM container / tracking config if any trigger filters on hostname.

### Step 6 - Drain and tighten

After the 301 has been live long enough that traffic on the old host is crawlers only
(check access logs; typically 2-4 weeks):

- Remove `https://islandtours.tripwheel.app` from `CORS_ORIGINS`.
- Keep the 301 itself indefinitely (it is free and protects old email links predating
  `ISLAND_TOURS_URL`).

### Step 7 - Verify on real hostnames, in a real Safari

**Nothing in this runbook is testable on localhost** - `localhost:3000` → `localhost:5050` is
same-site, so the cross-site path literally does not execute in dev. Safari (ITP) and Firefox
(Total Cookie Protection) are the acceptance browsers; Chrome passing proves nothing.

| # | Check | Browser | Guards |
|---|---|---|---|
| V1 | **Complete a real booking end-to-end**: widget quote → reserve → contact → pay (card AND a redirect method: iDEAL/PayPal or Mollie hosted) → `/payment/processing` poll → TYP renders unmasked | Safari + Firefox | the whole revenue path; the redirect methods additionally exercise `assertAllowedRedirect` with the new origin |
| V2 | `/bookings` traveler login (email + booking ref) → booking management view; reload → still authenticated | Safari | HMAC session cookie set + replayed on the new origin |
| V3 | Cancel-request flow from the booking view | Safari | header-transport mutation path |
| V4 | Wishlist add/remove/resolve; survives reload | Safari | `it.wishlist` first-party cookie |
| V5 | Dashboard login at `dashboard.tripwheel.app`; guard redirects + `getUserProfile` role resolution | any | the untouched leg actually is untouched |
| V6 | Dashboard edit (e.g. tour name) → public page on `island.tours` updates within its tag lifetime | any | `REVALIDATE_TARGET_URL` (step 4) |
| V7 | Trigger a booking email; every link in it points at `island.tours` | n/a | `ISLAND_TOURS_URL` (step 2) |
| V8 | A public traveler token **cannot** reach any operator/admin endpoint | any | privilege boundary |
| V9 | `https://island.tours/sitemap.xml` + a page's canonical + JSON-LD all say `island.tours` | n/a | preflight P5 actually took effect |

V1 and V2 in Safari are the acceptance criteria. They are the exact scenarios the old
(cookie-based) architecture would have silently failed, and the reason this runbook exists.

---

## 4. Decision, not migration: the residual `credentials: 'include'`

`frontend/lib/api/fetch.ts:41` still sends `credentials: 'include'` on client-side
booking/availability calls. Per `bookings.controller.ts:63` this is **optional attribution only**
(`userId` / `cancelledBy` when a Better Auth session happens to ride along - e.g. an operator
logged into the dashboard on the shared apex making a test booking). After the move the cookie is
`SameSite=Lax` on a different registrable domain, so it stops flowing from `island.tours` in
**every** browser, deterministically. Bookings degrade to guest attribution. **Nothing breaks.**

Choose one, knowingly:

- **Accept the loss** (recommended) - the traveler HMAC session is the real identity on this
  surface; staff test-bookings become guest-attributed, which is arguably more realistic.
- **Delete the line** for cleanliness - one-line diff, removes a dead transport.

Do NOT try to "fix" it with `SameSite=None` - that reintroduces the third-party cookie problem
02C §3 Option D already rejected (Safari blocks it regardless).

---

## 5. Security posture (current architecture, verified 2026-07-28)

This is *stronger* than the v1 plan it replaced (bearer token in `localStorage`):

| Property | How |
|---|---|
| Traveler token unreadable by page JS at rest | `HttpOnly` + `Secure` (prod) + `SameSite=Lax` first-party cookie, 24h TTL (`app/api/traveler-session/route.ts`) |
| Cookie-planting / forced-logout CSRF on the token route | `Sec-Fetch-Site` check with Origin-host fallback + strict `v1.<payload>.<sig>` shape validation |
| API CSRF | token travels as a custom header → forces CORS preflight → cross-site attacker cannot attach it |
| Forgery | HMAC-signed, email-bound; the backend is the sole verifier - a forged cookie renders a masked page, nothing else |
| Blast radius | one traveler's bookings for 24h; not an account, cannot reach operator/admin endpoints |
| High-privilege surface | dashboard keeps HttpOnly Better Auth cookies, same-site with the API |

**Residual hardening (recommended, not blocking):** a strict CSP on `island.tours`. The token
transits JS memory briefly (lookup/checkout response → POST into the cookie route), so XSS timed
to that window could grab a 24h single-booking token. CSP is cheap defence-in-depth; it is no
longer the load-bearing control it would have been under the v1 bearer plan.

---

## 6. Rollback

| Step | Rollback |
|---|---|
| 1 | Remove DNS. Nothing depended on it. |
| 2 | Restore the previous env values, restart. (Keeping `island.tours` in `CORS_ORIGINS` while rolled back is harmless.) |
| 3-4 | Redeploy previous env. The apps are domain-agnostic; there is no code to revert. |
| 5 | Point DNS/301 back at `islandtours.tripwheel.app`. Old host stays live until step 6, so this is instant. |

There is no session-invalidation cost anywhere in this runbook (unlike v1's step 5). The only
one-way door is SEO: once crawlers have re-indexed `island.tours`, flapping back and forth burns
crawl trust - do step 5 once, deliberately.

---

## 7. What does NOT change

| Concern | Why |
|---|---|
| **Public-site auth** | HMAC traveler session: first-party cookie + header. Domain-agnostic by construction. |
| **Dashboard auth** | Same-site with the API under `.tripwheel.app`. Cookies, HttpOnly, guard, layout - untouched. Zero dashboard code in this document. |
| **RBAC / roles / permissions** | Server-side, unchanged. |
| **SSR data fetching** (`lib/api/public/*`) | `x-internal-api-key`, server-to-server, no cookies. |
| **Stripe/Mollie webhooks** | Point at `api.tripwheel.app` - unchanged. |
| **Cache revalidation mechanics** (`02B`) | Process separation, not domain. Only the *target URL* changes (step 4). |
| **Currency/locale/consent cookies** | First-party on the frontend origin, wherever it lives. |
