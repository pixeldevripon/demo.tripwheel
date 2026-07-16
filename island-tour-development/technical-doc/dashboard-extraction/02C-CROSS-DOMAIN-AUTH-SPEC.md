# Phase 2C - Cross-Domain Auth Specification (Better Auth)

> How to serve **`island.tours`** (public), **`dashboard.tripwheel.io`** (admin) and
> **`api.tripwheel.io`** (backend) from one Better Auth instance.
>
> **VERDICT: yes, this topology is viable.** 3 files on the public site, 2 env vars, zero backend
> code, dashboard untouched. **The complete change set is §4A** - read that first; §2-3 are the
> reasoning behind it.
>
> **Sequencing: this is a separate project from the dashboard split.** The interim topology (§1)
> needs no auth changes at all, so do the split there first and move domains afterwards. Nothing in
> this document blocks Phases 1-9 of `06`.

---

## 0. Evidence base

Analysis is grounded in the **installed** Better Auth (`better-auth@^1.6.9`), read directly from
`backend/node_modules/better-auth/dist/`, plus the current docs via context7.

| Claim | Source | Confidence |
|---|---|---|
| Cookie `domain` is resolved from a static string or the baseURL hostname | `dist/cookies/index.mjs:22` | **verified (source read)** |
| Cookie defaults: `sameSite: 'lax'`, `httpOnly: true`, `secure` per prefix, `path: '/'` | `dist/cookies/index.mjs:30-36` | **verified** |
| `crossSubDomainCookies.enabled` without `domain` throws unless baseURL is a dynamic config | `dist/cookies/index.mjs:23` | **verified** |
| The cookie getter is re-created per request when cross-subdomain is enabled | `dist/context/helpers.mjs:136-138` | **verified** |
| `isDynamicBaseURLConfig` = an object with an `allowedHosts` array | `dist/utils/url.mjs:107-109` | **verified** |
| `bearer()` emits `set-auth-token` + adds it to `Access-Control-Expose-Headers` | plugin source via context7 | **verified** |
| **`bearer()` is ALREADY ENABLED in this backend** | `backend/src/auth/auth.instance.ts:177` | **verified** |
| Whether `resolved.options.baseURL` is a per-request string under a dynamic config | not traced end-to-end | **INFERRED - must be proven by test (§6)** |

---

## 1. Interim topology (current decision, 2026-07-17)

| Role | Host |
|---|---|
| Public site | `islandtours.esenc.cloud` |
| Dashboard | `dashboard.islandtours.esenc.cloud` |
| Backend | `api.islandtours.esenc.cloud` |

**All three share `.islandtours.esenc.cloud`.** Everything is same-site. The `.islandtours.esenc.cloud`
cookie covers all three. `credentials: 'include'` works from both frontends. `guardDashboard` can read
the cookie.

**This requires zero changes.** `auth.instance.ts:196` already defaults `COOKIE_DOMAIN` to
`.islandtours.esenc.cloud`, and the comment at `:182-195` already documents exactly this design,
including why the scope is the project apex rather than the bare `.esenc.cloud` (cookie-tossing blast
radius). The existing setup is correct for this topology.

**Config to confirm at split time:**

| Var | Value |
|---|---|
| Backend `COOKIE_DOMAIN` | `.islandtours.esenc.cloud` (the current default) |
| Backend `CORS_ORIGINS` | `https://islandtours.esenc.cloud,https://dashboard.islandtours.esenc.cloud` |
| Dashboard `COOKIE_DOMAIN` | `.islandtours.esenc.cloud` (for `clearSessionCookies` in `proxy.ts:126`) |
| Dashboard `NEXT_PUBLIC_BACKEND_URL` | `https://api.islandtours.esenc.cloud` |

> `CORS_ORIGINS` feeds **both** `main.ts:43` (CORS) and `auth.instance.ts:17` (Better Auth
> `trustedOrigins`). One var, two consumers. Miss a host and you get either a CORS failure or a Better
> Auth origin rejection, which look nothing alike.

---

## 2. The target, and why it is hard

| Role | Host | Registrable domain |
|---|---|---|
| Public site | `island.tours` | **island.tours** |
| Dashboard | `dashboard.tripwheel.io` | **tripwheel.io** |
| Backend | `api.tripwheel.io` | **tripwheel.io** |

- `dashboard.tripwheel.io` -> `api.tripwheel.io` is **same-site**. Cookies work.
- `island.tours` -> `api.tripwheel.io` is **cross-site**. Cookies are third-party: **blocked in Safari
  (ITP) and Firefox (TCP) today**, degrading in Chrome.

### 2.1 Who actually needs what (this is the crux)

Two different requirements, and conflating them is why the naive fix fails:

| | Public site (`island.tours`) | Dashboard (`dashboard.tripwheel.io`) |
|---|---|---|
| Browser must **send** credentials to the API | **yes** - `wishlist.ts:16`, `categories.ts:86` use `credentials: 'include'` | yes |
| **Its own server** must **read** the session cookie | **NO** - verified: `getSessionCookie` appears only at `proxy.ts:87`, inside `guardDashboard`. Public auth is client-side only (`wishlist-provider.tsx:63` `useSession()`). | **YES** - `guardDashboard` (`proxy.ts:87`) **and** the layout's `getUserProfile(cookie)` via `headers()` |

**The public site never reads the cookie server-side. The dashboard must.** That asymmetry is the whole
design space.

### 2.2 Why "just add `api.island.tours`" does not work

The intuitive fix - give each frontend a same-site API hostname - runs into a hard limit in the
installed library.

`dist/cookies/index.mjs:22`:

```js
const domain = crossSubdomainEnabled
  ? options.advanced?.crossSubDomainCookies?.domain || (baseURLString ? new URL(baseURLString).hostname : void 0)
  : void 0;
```

There are exactly two outcomes, and **neither satisfies both legs**:

| Config | Resulting cookie `Domain` | Public leg | Dashboard leg |
|---|---|---|---|
| `domain: '.tripwheel.io'` (static) | always `.tripwheel.io` | **broken** - the browser rejects a `.tripwheel.io` cookie from `api.island.tours` (a host may only set cookies for itself or a parent) | works |
| `domain` omitted + dynamic `baseURL` | `new URL(baseURL).hostname`, i.e. `api.tripwheel.io` / `api.island.tours` | works (same-site, host-scoped, and the public server never reads it) | **broken** - `Domain=api.tripwheel.io` is invisible to `dashboard.tripwheel.io`, so `guardDashboard` and `getUserProfile` see nothing |

Note the second row's failure mode precisely: the browser **would still send** the cookie to
`api.tripwheel.io` (cookies are matched against the request target, not the page origin), so the
*data* calls work. But the **dashboard's own Next server** cannot see it, so the route guard and the
layout's auth gate both fail. Login would appear to succeed and then bounce.

**Conclusion: one Better Auth instance cannot emit cookies for two registrable domains.** `domain` is a
single value resolved from a closure over `options`. There is no per-request parent-domain derivation.

---

## 3. Options

| # | Option | New hosts | Backend change | Cookie stays HttpOnly | Verdict |
|---|---|---|---|---|---|
| **C** | **Bearer token for the public site** | none | **none - already enabled** | public: no · dashboard: yes | **Recommended** |
| **A** | Two API hostnames + two auth instances | `api.island.tours` | contained | yes, both | Recommended if C's XSS trade is unacceptable |
| **B** | Public site proxies `/api/*` through its own origin | none | none | yes | Viable, worst latency |
| **D** | Partitioned cookies (CHIPS) | none | small | yes | **Rejected** |
| **E** | Do nothing | none | none | n/a | **Not viable** |

### Option C - Bearer token for the public site (recommended)

**The backend is already configured for this.** `auth.instance.ts:177`:

```js
plugins: [
  bearer(), // enables Authorization: Bearer <token> alongside cookie auth
  ...
]
```

**How it works** (verified in the plugin source): on any response carrying a session `Set-Cookie`, the
plugin's `after` hook extracts the token and adds:
- `set-auth-token: <token>` response header
- `set-auth-token` to `Access-Control-Expose-Headers` (so cross-origin JS may read it)

The client stores it and sends `Authorization: Bearer <token>`. **No cookie is involved, so third-party
cookie blocking is irrelevant.**

| | |
|---|---|
| Public site | bearer token, no cookies |
| Dashboard | unchanged - cookies, `.tripwheel.io`, `guardDashboard` intact |
| Backend | `CORS_ORIGINS` += `https://island.tours`. **Nothing else.** |
| New hostnames | none |
| New deployments | none |

**Why this is now the recommendation** (and a correction - an earlier draft of `02` §1.2 called Option
A "the cheap correct one"; reading `cookies/index.mjs` disproved that):

1. The plugin is **already enabled**. Zero backend change.
2. The public site **already does not read the session server-side** (verified §2.1), so it loses
   nothing by giving up cookies. This is the fact that makes C cheap and A expensive.
3. No new hostname, no cert, no second deployment, no proxy hop, no `Set-Cookie` rewriting.
4. The dashboard - the higher-privilege surface - **keeps HttpOnly cookies**. The security downgrade is
   confined to the lower-privilege surface.

**The real cost, stated plainly:** a bearer token in `localStorage` is **not** `HttpOnly` and is
exfiltratable by any XSS on `island.tours`. That is a genuine downgrade from the current cookie.
Scope it honestly: the public session grants wishlist and booking-lookup, not admin. It does not grant
dashboard access - roles are enforced server-side and a USER token cannot reach operator endpoints.

**Mitigations (all required if C is chosen):**

| # | Mitigation |
|---|---|
| 1 | A strict CSP on `island.tours` - this is the actual control. XSS is the whole threat model. |
| 2 | Short session TTL + refresh for the public site |
| 3 | Store the token in memory with a refresh-on-load, if the UX cost of losing it on reload is acceptable. `localStorage` is the pragmatic default; memory is the stronger one. |
| 4 | Never store anything else sensitive in `localStorage` |
| 5 | Revoke on sign-out server-side, not just by clearing storage |

**Frontend work (public repo):** `lib/auth-client.ts` gains an `onSuccess` hook reading
`set-auth-token`; `wishlist.ts` and `categories.ts` swap `credentials: 'include'` for an
`Authorization` header. Roughly two files.

### Option A - Two API hostnames, two auth instances

For when HttpOnly everywhere is non-negotiable.

```
island.tours            → api.island.tours    → auth instance #1, COOKIE_DOMAIN=.island.tours
dashboard.tripwheel.io  → api.tripwheel.io    → auth instance #2, COOKIE_DOMAIN=.tripwheel.io
                              both → the same NestJS app → the same Postgres → the same session table
```

Because `domain` is baked into a closure at instance construction (§2.2), **two domains require two
instances.** Two shapes:

| Shape | How | Cost |
|---|---|---|
| **A-i** Two deployments | Same image, two env sets, two hostnames | Simple to reason about. Doubles the deploy surface. |
| **A-ii** Two instances in one process | `auth.instance.ts` exports `authForHost(host)` returning one of two `betterAuth()` instances; the guard picks by `Host` | One deployment. **A contained but real backend change** - and `auth.instance.ts` is currently a single exported `auth` consumed across `AuthModule`, guards, and `getUserProfile`. |

Sessions live in Postgres, so both instances share them. A traveler gets an `.island.tours` cookie; an
operator gets a `.tripwheel.io` cookie. Both resolve against the same session table.

Also needed: `baseURL: { allowedHosts: ['api.tripwheel.io', 'api.island.tours'], protocol: 'https' }`
(`dist/utils/url.mjs:107`), `trustedOrigins` covering both, DNS + cert for `api.island.tours`, and
ingress routing both hostnames.

**Verdict:** correct, keeps HttpOnly everywhere, and costs a hostname, a cert, and either a second
deployment or a backend refactor of the auth singleton. Choose it only if C's XSS trade is rejected.

### Option B - Proxy `/api/*` through `island.tours`

Next rewrite: `island.tours/api/*` -> `api.tripwheel.io/api/*`. Cookies become first-party to
`island.tours`.

**The catch that makes this worse than it looks:** the backend sets `Domain=.tripwheel.io`, and that
`Set-Cookie` traverses the proxy unchanged. The browser **rejects** it - `island.tours` cannot set a
`.tripwheel.io` cookie. So the proxy must **rewrite the `Set-Cookie` domain** on every auth response.
That is fiddly, easy to get subtly wrong, and puts the public Next app on the auth-critical path.

It also proxies the **entire public data plane** (every wishlist/search/category call), adding a hop to
each.

**Verdict:** viable, no new hostname, but the most moving parts and the worst latency.

### Option D - Partitioned cookies (CHIPS) - rejected

`advanced.defaultCookieAttributes: { sameSite: 'none', secure: true, partitioned: true }`.

Rejected because CHIPS partitions a cookie **per top-level site**, which is the opposite of what is
needed - and Safari's ITP still blocks third-party cookies regardless. It trades a deterministic
failure for a browser-dependent one, which is worse: it would work in Chrome during testing and fail
for Safari users in production.

---

## 4. Recommendation

**Option C.** The plugin is already on, the public site already has no server-side session read, and it
needs zero new infrastructure. The security downgrade is real, bounded to the low-privilege surface,
and mitigable by CSP.

**Fallback: Option A-i** (two deployments) if HttpOnly everywhere is a hard requirement.

**Sequencing:** this is independent of the dashboard split. **Do the split on the interim
`.islandtours.esenc.cloud` topology first**, where auth needs no changes at all, and treat the domain
move as its own project.

---

## 4A. Direct answer: can we run `island.tours` + `dashboard.tripwheel.io` + `api.tripwheel.io`?

**Yes. No business logic changes, no backend code changes, dashboard untouched.**

### 4A.1 Why it is cheap: the public site is already client-only for auth

The enabling fact, and it is architectural rather than lucky-in-detail:

> `lib/api/wishlist.ts:1-4` - *"Client-side wishlist API (authenticated; sends the Better Auth cookie).
> The wishlist is a per-user, dynamic resource, so it is always fetched in the browser - **never in the
> cached server shell**."*

The public site is built on a `'use cache'` static shell (see `RENDERING-REVALIDATION-REVIEW.md`). A
cached shell **cannot** be per-user, so per-user data was already pushed to the browser by design.
Consequently **nothing on the public server ever wants the session cookie** - verified: `getSessionCookie`
appears only at `proxy.ts:87` inside `guardDashboard`.

The caching architecture made the domain split easy as a side effect.

### 4A.2 The complete change set

| Where | Change | Size |
|---|---|---|
| **Backend** | `CORS_ORIGINS` += `https://island.tours` (feeds CORS **and** `trustedOrigins`) | 1 env var |
| **Backend** | `COOKIE_DOMAIN` = `.tripwheel.io` | 1 env var |
| **Backend** | `bearer()` plugin | **already enabled**, `auth.instance.ts:177` |
| **Public** | `lib/auth-client.ts` - global token capture + send (4A.3) | ~10 lines |
| **Public** | `lib/api/wishlist.ts:16` - `credentials:'include'` -> `Authorization` header | 1 line |
| **Public** | `lib/api/categories.ts:86` - same | 1 line |
| **Dashboard** | none - same-site with `api.tripwheel.io`, cookies + HttpOnly + `guardDashboard` unchanged | 0 |

**Three files on the public site. Two env vars. Zero backend code.**

### 4A.3 The client pattern (verified against current Better Auth docs)

Both hooks are **global**, so a session refresh that re-issues a token is captured automatically -
no per-call-site handling:

```ts
// public repo: lib/auth-client.ts
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL,
  fetchOptions: {
    onSuccess: (ctx) => {                                    // captures on ANY response
      const t = ctx.response.headers.get('set-auth-token');
      if (t) localStorage.setItem('bearer_token', t);
    },
    auth: { type: 'Bearer', token: () => localStorage.getItem('bearer_token') || '' },
  },
});
```

`useSession()` keeps working unchanged - it routes through the same client.

The two raw `fetch` call sites (`wishlist.ts`, `categories.ts`) do **not** go through `authClient`, so
they need the header applied directly. Factor a small `publicAuthHeaders()` helper rather than
duplicating.

### 4A.4 Why business logic cannot break

**Bearer carries the same session token value from the same DB row.** The plugin's `after` hook reads
the token out of the `Set-Cookie` header the backend was already producing and re-emits it as
`set-auth-token` (verified in plugin source). Server-side, `Authorization: Bearer <token>` resolves to
the identical session.

Therefore unchanged: roles, permissions, RBAC, `disableSignUp: true`, auto-user-creation on first
booking, wishlist semantics, booking flow, every guard. **This is a transport swap, not an auth
redesign.**

Note the sign-in mechanics: the backend still sets a `Domain=.tripwheel.io` cookie on sign-in. The
browser will treat it as third-party in an `island.tours` context and may drop it. **Harmless** - the
plugin extracts the token server-side *before* the response leaves, so the header is populated
regardless of what the browser does with the cookie.

**Bonus: bearer is CSRF-immune.** An attacker cannot read `localStorage` cross-origin, so the public
site loses its CSRF surface entirely.

### 4A.5 The three costs to accept knowingly

| # | Cost | Assessment |
|---|---|---|
| 1 | **The public token is not `HttpOnly`.** Any XSS on `island.tours` exfiltrates it. | The real cost. **A strict CSP is the control, not a nice-to-have.** Bounded: USER-role only, cannot reach operator endpoints; the dashboard keeps HttpOnly. |
| 2 | **Safari ITP caps script-writable storage at ~7 days without first-party interaction.** A traveler who does not visit for a week is silently signed out. | A UX degradation, not a break, and arguably acceptable for a wishlist. **Verify (§6 check 12) rather than assume** - the cap's exact trigger conditions depend on ITP's classification of the site. |
| 3 | **Operator password-reset currently lives on the public site** (`components/frontend/login/operator-forgot.tsx`, `operator-reset.tsx`). | Under this topology an operator would reset at `island.tours` and sign in at `dashboard.tripwheel.io`. These surfaces must move to the dashboard with `portal`/`staff` - which `02` §3.4 already schedules. **Do not let them get stranded on the public site.** |

### 4A.6 Audit before cutover: every authenticated browser call on the public site

| Call site | Today | After |
|---|---|---|
| `lib/api/wishlist.ts:16` | `credentials: 'include'` | `Authorization: Bearer` |
| `lib/api/categories.ts:86` | `credentials: 'include'` | `Authorization: Bearer` |
| `components/frontend/wishlist-provider.tsx:63` | `useSession()` | unchanged (client config) |
| `components/frontend/login/auth-form.tsx` | `authClient` | unchanged (client config) |
| `components/frontend/login/operator-forgot.tsx`, `operator-reset.tsx` | `authClient` | **moves to the dashboard** (cost 3) |
| `app/(login)/apply`, `app/(login)/bookings` | traveler-facing | verify auth usage |
| `lib/api/public/*` (SSR) | `x-internal-api-key`, server-to-server | **unaffected** |

This table is the checklist. **A missed `credentials: 'include'` fails silently on Safari only.**

### 4A.7 On the branding split

`island.tours` for travelers, `tripwheel.io` for the platform is a normal SaaS shape (Shopify runs the
same split: merchant storefront on its own domain, admin on `shopify.com`). It also **reinforces**
`03` §2.1's argument for a distinct admin palette: the admin tool should be visibly a different
product so nobody mistakes production for a preview.

---

## 5. What does NOT change

| Concern | Why unaffected |
|---|---|
| **Server-to-server SSR** (`lib/api/public/fetch.ts`) | `import 'server-only'` + `x-internal-api-key`. No cookies. Cross-domain is irrelevant. |
| **Cache revalidation** (`02B`) | **Process** separation, not domain. Two Next apps = two caches on any host. `02B` applies in full regardless of which option is chosen here. **These are unrelated problems that look related.** |
| **Dashboard auth** | Same-site with the API under every option. Unchanged. |
| **RBAC** | Server-side. A bearer token carries the same session and the same role. |
| **`disableSignUp: true`** | Public self-registration is off (`auth.instance.ts:33`). Users are auto-created on first booking. Unchanged. |

---

## 6. Verification (before any domain move)

The trap, restated because it is the reason this document exists: **localhost cannot reproduce any of
this.** `localhost:3000` -> `localhost:5050` is same-site, and
`crossSubDomainCookies.enabled` is gated on `NODE_ENV === 'production'` (`auth.instance.ts:195`), so
the cross-subdomain path is **off in dev entirely**. Every check below requires real hostnames.

| # | Check | Blocks |
|---|---|---|
| 1 | **Prove or disprove the one inferred claim (§0):** does `resolved.options.baseURL` resolve per-request under a dynamic config? Set `allowedHosts`, omit `domain`, hit two hostnames, inspect `Set-Cookie`. | Option A viability |
| 2 | Sign in on `island.tours` in **Safari** with ITP on -> session persists across reload | C |
| 3 | Same in **Firefox** with Total Cookie Protection | C |
| 4 | Wishlist add/remove/list on Safari | C |
| 5 | `set-auth-token` is readable cross-origin (confirm `Access-Control-Expose-Headers`) | C |
| 6 | Sign out revokes **server-side**, not just local storage | C |
| 7 | Dashboard login on `dashboard.tripwheel.io` still works, cookie scoped `.tripwheel.io` | all |
| 8 | `guardDashboard` reads the cookie; malformed cookie -> `/portal` + cleared | all |
| 9 | `getUserProfile` resolves the role server-side | all |
| 10 | A public USER token **cannot** reach an operator endpoint | all |
| 11 | CSP on `island.tours` blocks inline script | C |
| 12 | **Safari ITP 7-day script-writable storage cap** - does a token in `localStorage` survive a week of no visits? (cost 2, §4A.5) | C |
| 13 | Session **refresh** re-issues `set-auth-token` and the global `onSuccess` captures it (§4A.3) | C |
| 14 | Every call site in the §4A.6 audit table migrated - **no surviving `credentials: 'include'` on the public site** | C |
| 15 | Operator reset/forgot flows have moved to the dashboard (cost 3) | C |

Checks 2 and 3 are the acceptance criteria. **They are the exact scenario that is silently broken
today and that no dev environment will ever surface.**

Check 14 is the one most likely to be missed: a stray `credentials: 'include'` fails **only on Safari,
only in production**, and looks like an intermittent bug rather than a config error.

---

## 7. Summary

| # | Finding |
|---|---|
| 0 | **The answer to "can we run `island.tours` + `dashboard.tripwheel.io` + `api.tripwheel.io`?" is YES.** 3 files on the public site, 2 env vars, zero backend code, dashboard untouched. Full change set in **§4A**. |
| 1 | The **interim topology needs no changes**. All three hosts share `.islandtours.esenc.cloud`; the existing config already targets it. |
| 2 | **One Better Auth instance cannot emit cookies for two registrable domains.** `domain` is one static value or the API hostname (`cookies/index.mjs:22`). Verified in source. |
| 3 | **"Just add `api.island.tours`" does not work alone** - it fixes the public leg and breaks the dashboard's server-side cookie read. This corrects the earlier recommendation in `02` §1.2. |
| 4 | The asymmetry that decides everything: **the public site never reads the session server-side; the dashboard must.** This is not an accident - the public site's `'use cache'` static shell cannot be per-user, so auth was already client-only by design (§4A.1). |
| 5 | **`bearer()` is already enabled** (`auth.instance.ts:177`). The escape hatch is built and unused. |
| 6 | **Recommended: Option C** - bearer for public, cookies for dashboard. Zero backend change, zero new hosts. |
| 7 | **Business logic cannot break**: bearer carries the same session token from the same DB row. Transport swap, not auth redesign. Bonus: the public site becomes CSRF-immune. |
| 8 | Three costs to accept knowingly (§4A.5): the public token is **not HttpOnly** (CSP is the control); **Safari ITP's ~7-day storage cap** may sign out dormant travelers; **operator reset/forgot must move** off the public site. |
| 9 | Fallback: **Option A-i**, two deployments, if HttpOnly everywhere is required. |
| 10 | **Cache revalidation (`02B`) is unrelated** and applies regardless. Do not assume solving one solves the other. |
| 11 | **Nothing here is verifiable on localhost.** Every check needs real hostnames and a real Safari. The highest-risk miss is a stray `credentials: 'include'` (§4A.6). |
