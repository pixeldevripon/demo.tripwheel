# 02D - Domain Move Runbook

> **From** `islandtours.esenc.cloud` + `dashboard.islandtours.esenc.cloud` + `api.islandtours.esenc.cloud`
> **To** `island.tours` (public) + `dashboard.tripwheel.io` (admin) + `api.tripwheel.io` (backend)
>
> This is the step-by-step for the decision `02C` already made. **`02C` is the reasoning; this is the
> order of operations.** Read `02C` §4A first if you have not - especially the 2026-07-17 correction,
> which found the checkout hiding behind a shared helper.
>
> **Prerequisite: Phase 9 green and the dashboard cut over on the interim topology.** Do not attempt
> the domain move and the repo split in one window. If auth breaks you must know which one did it.

---

## 0. The one-paragraph version

Today all three hosts share `.islandtours.esenc.cloud`, so one cookie covers everything and nothing
special is needed. After the move, `dashboard.tripwheel.io` and `api.tripwheel.io` still share
`.tripwheel.io` (cookies keep working, untouched), but `island.tours` becomes a **different
registrable domain** from the API - so its cookies are third-party and Safari/Firefox drop them.
**One Better Auth instance cannot emit cookies for two registrable domains** (`cookies/index.mjs:22`,
verified in source). The fix is not a cookie fix: the public site stops using cookies and uses a
**bearer token** instead, which the backend already supports (`bearer()`, `auth.instance.ts:177`).
The dashboard changes nothing.

**Why this is cheap:** the public site never reads the session server-side - not by luck, but because
its `'use cache'` static shell *cannot* be per-user, so auth was always client-only. The dashboard
must read it server-side (`guardDashboard`, `getUserProfile`). That asymmetry is the whole design.

---

## 1. The flow, before and after

### Today (interim, working)

```
browser ──cookie Domain=.islandtours.esenc.cloud──┐
  islandtours.esenc.cloud (public)   ─────────────┤
  dashboard.islandtours.esenc.cloud  ─────────────┼──> api.islandtours.esenc.cloud
                                                  │      one cookie, same-site, all three
  dashboard's OWN Next server reads the cookie ───┘      (proxy.ts guard + layout getUserProfile)
```

### After the move

```
  island.tours (public)
     │  Authorization: Bearer <token from localStorage>     NO COOKIE. Cross-site is irrelevant.
     └────────────────────────────────────────────────> api.tripwheel.io
                                                              │
  dashboard.tripwheel.io                                      │  same session row in Postgres
     │  cookie Domain=.tripwheel.io  (same-site) ─────────────┘
     └── its own Next server still reads that cookie   <- unchanged, still HttpOnly
```

**The token IS the session token** - the bearer plugin lifts it out of the `Set-Cookie` the backend
was already producing and re-emits it as a `set-auth-token` header. Same DB row, same role, same
guards. **Transport swap, not an auth redesign.** Business logic cannot break.

---

## 2. Order of operations

**Ship in this order. Each step is safe to sit in indefinitely; only step 6 is a cutover.**

### Step 1 - Code the public site's bearer support (no domains involved)

Four files, all in the public repo. Do this first, on the CURRENT domains, where cookies still work
and bearer is simply redundant-but-harmless.

**1a. `lib/auth-client.ts`** - global capture + send:

```ts
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL,
  fetchOptions: {
    onSuccess: (ctx) => {
      const t = ctx.response.headers.get('set-auth-token');
      if (t) localStorage.setItem('bearer_token', t);
    },
    auth: { type: 'Bearer', token: () => localStorage.getItem('bearer_token') || '' },
  },
});
```

Both hooks are **global**, so a session refresh that re-issues a token is captured with no
per-call-site handling. `useSession()` keeps working - it routes through this client.

**1b. Factor `publicAuthHeaders()`** once, then apply it at the three raw-`fetch` surfaces:

| File | Line | Serves |
|---|---|---|
| **`lib/api/fetch.ts`** | **:29** | **`bookings.ts` (the ENTIRE checkout) + `availability.ts`** |
| `lib/api/wishlist.ts` | :16 | wishlist |
| `lib/api/categories.ts` | :86 | category personalisation |

> **`fetch.ts` is the one that matters and the one `02C` originally missed.** Its callers inherit
> the cookie without ever naming `credentials: 'include'`, so a grep for the literal does not find
> them. Migrating this one file carries `/bookings/quote`, `POST /bookings`, `/bookings/:id`,
> `checkout-form`, `checkout-processing`, `thank-you`, `cancel-request-card`, and availability
> with it.

**Both transports work at once.** Sending `Authorization` while cookies still flow is harmless -
the backend resolves either to the same session. That is what makes this step independently
shippable and independently revertible.

**Validation:** on the current domains, sign in, clear cookies, confirm the app still works off the
bearer token alone. If it does, the domain move is de-risked before you touch DNS.

### Step 2 - Delete the dashboard's leftovers from the public repo (`02` §10 step 10)

**Verified 2026-07-17: these are DUPLICATED, not moved.** Both repos currently serve them:

- `app/(login)/portal`, `app/(login)/staff`
- `components/frontend/login/{operator-login,operator-forgot,operator-reset,operator-two-factor,staff-login}.tsx`

Under the target topology an operator who resets a password at `island.tours` is at the wrong
origin. Delete the **public** copies; the dashboard repo already has them.

**Keep `app/(login)/apply` and `app/(login)/bookings`** - traveler-facing, genuinely public.

> **DO NOT delete `lib/api/fetch.ts`** while removing dashboard code. It looks dashboard-shaped
> (most importers are dashboard clients) but `bookings.ts` and `availability.ts` need it. Deleting
> it takes the checkout with it.

### Step 3 - CSP on `island.tours` (do it BEFORE the move, not after)

A bearer token in `localStorage` is **not HttpOnly**. Any XSS on `island.tours` exfiltrates it.
**The CSP is the actual control, not a hardening nice-to-have** - it is the entire compensating
mechanism for the security property being given up. Ship it first, verify it blocks inline script
(§6 check 11), and only then move domains.

Scope the risk honestly: the public session grants wishlist + booking lookup. It is USER-role; it
cannot reach operator endpoints - roles are server-side. The dashboard, the higher-privilege
surface, keeps HttpOnly cookies.

### Step 4 - DNS + certs, no traffic yet

Stand up `island.tours`, `dashboard.tripwheel.io`, `api.tripwheel.io`. Leave the old hosts serving.

### Step 5 - Backend env (the whole backend change: two vars, zero code)

```
COOKIE_DOMAIN=.tripwheel.io
CORS_ORIGINS=https://island.tours,https://dashboard.tripwheel.io
```

`CORS_ORIGINS` feeds **both** CORS (`main.ts:43`) **and** Better Auth `trustedOrigins`
(`auth.instance.ts:17`). Miss a host and you get either a CORS failure or an origin rejection -
which look nothing alike, and neither says "you forgot an env var".

**This invalidates every existing session** (the cookie domain changes). Everyone signs in again,
once. Schedule it, and tell operators.

### Step 6 - Cut over, public first

1. Deploy the public site to `island.tours` (bearer already live from step 1).
2. Deploy the dashboard to `dashboard.tripwheel.io`. **Zero code change** - it is same-site with
   `api.tripwheel.io`, so cookies, HttpOnly, and `guardDashboard` all behave exactly as today.
3. Point the old hosts at the new ones with 301s.
4. Update the dashboard's `REVALIDATE_TARGET_URL` -> `https://island.tours/api/revalidate`, and
   `NEXT_PUBLIC_BACKEND_URL` -> `https://api.tripwheel.io`. **`NEXT_PUBLIC_*` are inlined at build
   time - this needs a REDEPLOY, not a restart.**

### Step 7 - Verify on real hostnames in a real Safari

**Nothing here is reproducible on localhost.** `localhost:3000` -> `localhost:5050` is same-site,
and `crossSubDomainCookies.enabled` is gated on `NODE_ENV === 'production'`. The dev environment
cannot fail the way production will.

Run `02C` §6, all 15. **Checks 2 and 3 are the acceptance criteria** (Safari with ITP, Firefox with
TCP - session persists across reload). **Check 14 is the one that will bite**: no surviving
`credentials: 'include'` on any public path. And add:

| # | Check | Why |
|---|---|---|
| 16 | **Complete a real booking end-to-end in Safari** (quote -> POST -> thank-you -> cancel) | The `fetch.ts` surface `02C` missed. If step 1b was done wrong, Chrome passes and Safari cannot buy. |
| 17 | Hub trips panel + availability sync in Safari | Same helper |

---

## 3. Rollback

| Step | Rollback |
|---|---|
| 1-3 | Revert. Cookies still work on the current domains; bearer is additive. |
| 5 | Restore `COOKIE_DOMAIN`/`CORS_ORIGINS`. Sessions invalidate again. |
| 6 | DNS back. Old hosts stay live until you are certain. |

The only irreversible act is time: step 5 signs everyone out, twice if you roll back.

---

## 4. The three costs, accepted knowingly

| # | Cost | Control |
|---|---|---|
| 1 | Public token is **not HttpOnly** | **CSP (step 3).** Bounded to USER role; dashboard keeps HttpOnly. |
| 2 | **Safari ITP caps script-writable storage at ~7 days** without first-party interaction - a dormant traveler is silently signed out | UX degradation, not a break. Acceptable for a wishlist. **Verify (§6 check 12); do not assume.** |
| 3 | Operator reset/forgot on the public site | Step 2 deletes them. |

**Bonus, not a cost:** bearer is CSRF-immune. An attacker cannot read `localStorage` cross-origin,
so the public site loses its CSRF surface entirely.

---

## 5. What does NOT change

| Concern | Why |
|---|---|
| **Dashboard auth** | Same-site with the API. Cookies, HttpOnly, `guardDashboard`, `getUserProfile` - all unchanged. **Zero dashboard code in this whole document.** |
| **RBAC / roles / permissions** | Server-side. Bearer carries the same session token from the same row. |
| **SSR data fetching** (`lib/api/public/*`) | `x-internal-api-key`, server-to-server, no cookies. Cross-domain is irrelevant. |
| **`disableSignUp: true`**, auto-user-on-first-booking | Untouched. |
| **Cache revalidation (`02B`)** | **Unrelated.** That is *process* separation; it applies on any domain topology. Solving one does not solve the other - they only look related. |
