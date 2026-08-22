# Login Design - Implementation Plan (Better Auth vs Supabase Auth + step-by-step build)

> Companion to `01-login-design-summary.md` and `02-login-reconciliation.md`. This doc answers the
> engine question first (Better Auth, which we already run, vs Supabase Auth, which the proposal
> assumes), then lays out a phased, step-by-step build. Written to be understandable by anyone,
> engineer or not. For the full standalone engine rationale (Better Auth vs Supabase / managed
> services), see `04-why-better-auth.md`.
>
> As-built facts verified July 5, 2026. Better Auth capabilities verified against the official
> Better Auth docs (v1.6.x) via Context7.

---

# PART A - The engine decision: Better Auth vs Supabase Auth

## A.0 The situation in one paragraph

The login proposal was written assuming the app runs on **Supabase Auth**. It does not. The entire
Island Tours platform already runs on **Better Auth** (version 1.6.9), living inside the NestJS
backend, storing users in our own Postgres via Prisma, with authorization done in code (NestJS
guards + a role/permission map). The proposal is a v0.1 draft that explicitly says "the master
wins," and the master + `CLAUDE.md` lock Better Auth (rule 12: "Better Auth lives on NestJS only";
rule 14: "Only one Prisma instance per process. The frontend has no `prisma/` and no
`DATABASE_URL`"). So the real question is not "how do we build the spec on Supabase" - it is **"can
Better Auth do everything the spec needs, and is there any reason to switch?"**

Short answer: **Better Auth can do all of it. There is no compelling reason to switch, and several
strong reasons not to.** The detail follows so the trade-off is fully transparent.

---

## A.1 What Better Auth already gives us (built today)

- Email + password with a **12-character minimum** (already meets the spec's NIST rule - no
  composition rules, no rotation).
- Sign-up disabled server-side; email verification required.
- Password reset with a **60-minute** token (matches the spec exactly) and
  `revokeSessionsOnPasswordReset`.
- Sessions in our own Postgres (`session` table), bearer + cookie support, cross-subdomain cookies.
- A per-path rate limiter (sign-in / forgot / reset = 5 per 60s).
- Our RBAC layer (roles + ~90 permissions + guards) sits on top and already works.

## A.2 What Better Auth CAN do via first-party plugins (not yet enabled)

Every "missing" piece in the proposal maps to a supported Better Auth plugin or option. Verified in
the official docs:

| Proposal requirement | Better Auth capability | How |
|---|---|---|
| Operator 2FA (TOTP) | **`twoFactor` plugin** | `POST /two-factor/enable` returns a `totpURI` (for the QR) + `backupCodes`; `POST /two-factor/verify-totp` validates codes (accepts +/-1 period for clock drift) |
| Backup codes (10, single-use) | **`twoFactor` plugin** | Backup codes generated at enable, regenerable; single-use enforced by the plugin |
| Trusted device (30-day) | **`twoFactor` plugin** | `verifyTotp({ trustDevice: true })` trusts the device for 30 days, refreshed on each sign-in - matches the spec's O4 exactly |
| Operator seats (owner/manager/staff) | **`organization` plugin** | Organization = operator; members = seats; roles `owner/admin/member` (rename/extend via access-control `ac`); invitations, `additionalFields`, and before/after hooks all supported |
| Admin Google SSO | **`socialProviders.google`** | `clientId` + `clientSecret`; standard OAuth |
| Traveler magic link (V2) | **`magicLink` plugin** | Supported |
| Central rate-limit / session store (not in-memory) | **`secondaryStorage`** | Point Better Auth at Redis (we already run Upstash/Redis for BullMQ) so limits + sessions survive multiple instances |
| Custom rate rules per route | **`rateLimit.customRules`** | Already used; extend for the traveler endpoint |
| Revoke everything on credential change | **`revokeSessionsOnPasswordReset`** + session APIs | Built in for reset; extend to 2FA change + trusted-device wipe |
| Extra user/session fields | **`additionalFields`** | Already used (`role`, `status`, `hasPassword`, `passwordChangedAt`) |
| Step-up re-auth | **session freshness + `twoFactor` re-verify** | Enforced in a NestJS guard on sensitive routes (payout/bank/seat/tier) |

## A.3 What Better Auth genuinely can NOT do (and the honest workarounds)

There are only a few true limits, and none is a blocker:

1. **Google `hd` (hosted-domain) claim verification is not automatic.** Better Auth signs a user in
   with Google, but it does not, by itself, reject accounts outside your Workspace domain. **Workaround:**
   verify the `hd` claim (and cross-check `admin_allowlist`) inside a Better Auth OAuth `mapProfileToUser`
   / sign-in hook, server-side. This is a few lines, and the spec already says the check must be
   server-side anyway. Not a limitation in practice.
2. **WhatsApp OTP is not a built-in channel.** Neither is it in Supabase. Both require a custom Meta
   WhatsApp Business integration. This is v1.1 in the spec regardless, so it is out of scope for the
   first build on either engine.
3. **App-level passkeys** exist as a Better Auth plugin, but the spec defers passkeys to V2 anyway
   (and cites Supabase's passkey API being experimental as the reason). No gap for v1.
4. **No managed hosted UI.** Better Auth gives APIs, not pre-built hosted login screens. We build the
   three login pages ourselves - which we want anyway, because the spec's whole point is three
   bespoke, on-brand surfaces. Supabase's hosted UI would be discarded for the same reason.

**Conclusion:** every v1 requirement is achievable on Better Auth. The only items Better Auth cannot
do out of the box (WhatsApp, passkeys) are exactly the items the spec already pushes to v1.1 / V2,
and Supabase cannot do them out of the box either.

---

## A.4 Why the proposal reached for Supabase (the steelman)

To be fair to the proposal, here is the genuine case it makes for Supabase Auth:

1. **"No custom crypto."** Supabase ships password hashing, TOTP secret storage, and MFA
   verification as managed primitives. (True - but Better Auth also ships all of these; we write no
   crypto either way. The `twoFactor` plugin stores encrypted secrets and verifies codes for us.)
2. **`aal2` enforced in the database via RLS.** Supabase's model is that even if application code is
   bypassed, Postgres Row-Level Security refuses AAL2-only rows to an AAL1 session. This is a
   real defense-in-depth benefit **for apps built on RLS**.
3. **Roles via a custom access-token hook**, checked in RLS.
4. **Small-team maintainability** - one managed vendor for auth.

## A.5 Why switching to Supabase would be costly and risky HERE

The Supabase case assumes a Supabase-shaped app. Ours is the opposite shape, and that is decisive:

1. **We do not use RLS at all.** Authorization is done in NestJS guards + service-layer checks over
   Prisma. Supabase's headline security benefit (`aal2` enforced in RLS) only pays off if the whole
   data layer is rewritten to run behind RLS with Supabase-issued JWTs. That is a re-platform of the
   entire backend, not an auth feature.
2. **Two sources of truth for users.** `CLAUDE.md` rule 14 says one Prisma instance, one
   `DATABASE_URL`, no auth in the frontend. Supabase Auth owns its own `auth.users` table and issues
   its own JWTs. We would either fork the user identity in two places or run Prisma against
   Supabase's Postgres and fight its RLS/`auth` schema - both brittle.
3. **Our RBAC would be rebuilt twice.** The `Role`/`Permission`/`ROLE_PERMISSIONS` map + four guards
   already work and are mirrored on the frontend. On Supabase this logic moves into JWT claims + RLS
   policies - a full rewrite of a working, tested system, with the frontend mirror thrown away.
4. **Every existing authenticated feature breaks during migration.** Operators, tours, bookings,
   wishlist, dashboard gating all call `auth.api.getSession(...)`. Cutting to Supabase means
   re-touching every one of them.
5. **It contradicts locked project rules.** Rules 12 ("Better Auth lives on NestJS only") and 14
   are hard rules. The proposal is a non-binding v0.1; the rules are the master.
6. **The migration buys us nothing the spec needs.** Everything in Section A.2/A.3 shows Better Auth
   already reaches every v1 target. We would pay a large, risky migration cost for zero net new
   capability.

## A.6 "What if we do NOT use Supabase Auth?"

Nothing bad happens - this is the recommended path. Concretely:

- We **keep one identity system, one user table, one session model, one RBAC layer.** The whole
  team already understands it.
- We enable the Better Auth `twoFactor` and `organization` plugins and add the `google` provider -
  additive changes, no rewrite.
- The one thing we consciously give up is Supabase's **RLS-level `aal2` enforcement**. We replace it
  with the **equivalent, appropriate-to-our-stack control**: a NestJS **step-up guard** that checks
  session freshness + a valid recent 2FA on sensitive routes (payout, bank, seat, tier). For an app
  that already does all authorization in guards/services, this is the correct layer for the control
  to live - RLS would be a foreign body.
- We follow the spec's non-negotiable safety rules (enumeration-proof responses, central rate-limit
  store, audit log, `__Host-` cookies) directly - none of these are Supabase-specific.

## A.7 Recommendation

**Stay on Better Auth. Do not adopt Supabase Auth.** Treat the spec's "Supabase" references as an
implementation assumption that is overridden by the master + CLAUDE.md. Build the three surfaces on
Better Auth using the `twoFactor`, `organization`, and `google`-provider capabilities, a Redis
`secondaryStorage`, an `auth_audit` table, and a step-up guard in place of RLS `aal2`.

If a future decision ever re-platforms the whole backend onto Supabase for other reasons, revisit -
but auth alone is not a reason to switch.

> **One decision needs founder sign-off before Phase 2:** how to model operator seats.
> **Recommended: a custom `operator_users` table** (matching the spec's E.11 names). The alternative
> is the Better Auth `organization` plugin. Recommendation and reasoning below; the plan assumes the
> **custom table**.
>
> **Why custom `operator_users` over the `organization` plugin (recommended):**
> 1. **The plugin models the wrong shape.** It is built for multi-tenant SaaS where one user belongs
>    to many organizations and switches between them (`activeOrganizationId` on the session, org
>    switcher). Our operators are single-business: a seat belongs to exactly one operator, no
>    switching, ~25 operators at launch.
> 2. **We already have the tenant root - `Operator`** (+ CompanyInfo/SocialMedia/Stripe/Mollie configs,
>    verification, eligibility, contact fields). The plugin would add a parallel `organization` table
>    that 1:1 shadows `Operator` forever, kept in sync, with permanent "which is canonical" drift risk.
> 3. **Every FK points at `operators.id`** (`trips.operatorId`, availability, bookings, tiers - rule
>    19). The plugin never becomes the real aggregate root; it is a bolt-on carried on top of
>    `Operator` indefinitely.
> 4. **It avoids a second permission system.** The plugin ships its own access-control (`ac`, org
>    roles) separate from our `Role`/`Permission` + guards. A custom `operator_users.seatRole` column
>    plugs into the existing guard pattern (resolve in `resolveOperatorId`, check in services).
> 5. **The "less code / battle-tested" edge is small and front-loaded.** 2FA secrets/backup codes live
>    on the `twoFactor` plugin (user-level), so `operator_users` needs no custom crypto - it is just
>    role/status/invitedBy/timestamps + FKs. The invite email is ours either way (Resend). Signup is
>    disabled and operators are admin-created, so the plugin would run through non-standard internal
>    APIs anyway. Member CRUD over a plain Prisma table is ~1 day and matches our module conventions.
>
> **The one thing that would flip this to the plugin:** a near-term need for one person to manage
> **multiple** operator accounts (agency-style, with an org switcher). The master does not indicate
> this (operator = single business), so today the answer is the custom table. Revisit if that
> requirement appears.

---

# PART B - Step-by-step implementation plan (on Better Auth)

Phases are ordered by dependency and risk. Each phase is independently shippable. Effort tags are
rough: S (1-2 days), M (3-5 days), L (1-2 weeks).

## Phase 0 - Foundations & decisions (S)

1. **Confirm the engine decision** (Part A) and the seats approach (organization plugin vs custom
   table) with the founder.
2. **Add Better Auth `secondaryStorage` (Redis).** Reuse `buildRedisConnection` from
   `common/utils/redis.util.ts`. This moves the rate-limiter + session cache out of per-instance
   memory (spec 8: in-memory "passes local tests and fails in production").
3. **Create the `auth_audit` table** (Prisma): `id, surface (enum traveler/operator/admin), actor
   (userId or email hash), event, ip, userAgent, createdAt`. 12-month retention.
4. **Add a tiny audit-write helper** and call it from `AuthGuard` (login success) + Better Auth
   hooks (failed login, reset, 2FA events).
5. **Enumeration + form-mechanics baseline**: document the DoD tests (identical message/status/timing;
   autocomplete attributes; paste; `inputmode`) so every subsequent page is built to them.

## Phase 1 - Traveler surface `island.tours/bookings` (M)

*No Better Auth session needed in v1 - this is a thin, rate-limited lookup over `bookings`.*

1. **Backend**: new `POST /api/v1/bookings/lookup` (`@Public`), body `{ email, reference }`. Verify
   the pair against `Booking` (match `displayRef` + `contactEmail`, case-insensitive email). On
   success mint a short-lived signed lookup token (or a scoped 24h session cookie) for the account
   area. **Enumeration-proof**: identical generic error + constant-time comparison + steady timing.
2. **Rate limits**: 5 fails/email/15min, per-IP daily cap, per-reference cap - via Better Auth
   `customRules` (now Redis-backed) or a dedicated limiter keyed in Redis.
3. **Non-sequential `display_ref`**: change the generator to random within `IT-YYYY-XXXXX`, excluding
   ambiguous characters (0/O, 1/I/L). Keep uniqueness. Migrate the generator only; existing refs stay.
4. **Recovery**: `POST /bookings/lookup/recover-reference` - always responds "if that email has
   bookings, it's on its way"; sends via Resend; own limits (1/email/min, 5/day).
5. **Email-code step-up (v1)**: for invoices + cross-booking history, require a 6-digit code emailed
   to the booking address (short-lived, 5-attempt cap). Gate those views behind it.
6. **Frontend**: `/[locale]/bookings` page (or no-locale-prefix per spec), noindex, SSR never cached,
   min chrome, card max 440px, WhatsApp link, all copy from the spec's locked set, 7 locales.
7. **Tracking**: GA4 `login` (`method: booking_ref`) on success; PII-free failure counter; lockout ->
   ops alert.

> **EXECUTED 2026-07-18 (partial - the core lookup loop is live):**
> - Item 1 DONE, simplified: `POST /api/v1/bookings/lookup` (`@Public`) verifies
>   `displayRef` + `contactEmail` (both case-insensitive) and returns
>   `{ publicRef, displayRef, destinationSlug }`; every failure is the same generic 404
>   (enumeration-proof message; constant-time comparison NOT implemented - it is a Prisma
>   lookup, timing is dominated by the query). No signed token/session was minted: success is
>   remembered CLIENT-side as the `it.travelerBooking` cookie holding the TYP path
>   (`lib/traveler-booking.ts`, 90 days) - acceptable because the TYP page itself is keyed on
>   the unguessable `publicRef`, so the cookie grants nothing the URL doesn't.
> - Item 2 PARTIAL: per-IP `@Throttle` tiers (2/10s, 6/min, 30/hr) via the existing
>   `@nestjs/throttler` setup; browser-only (the SSR internal-key bypass would skip limits).
>   No per-email / per-reference caps yet (needs Redis).
> - Item 6 PARTIAL: `/bookings` (no locale prefix, `app/(login)/bookings`) is wired to the real
>   endpoint - controlled inputs, busy state, generic `ErrorNote` on failure, success saves the
>   cookie and redirects to `/{destinationSlug}/thank-you/{publicRef}`. Copy is English-only
>   (the screens were built pre-i18n); the navbar account icon + its "My bookings" item
>   deep-link to the cookie's TYP path when present, `/bookings` otherwise.
> - Item 4 DONE (2026-07-18, same day): `POST /bookings/lookup/recover-reference` (`@Public`,
>   same human-pace per-IP throttle as resend: 1/10s, 3/min, 10/hr). Always acks
>   `{ sent: true }`; when the email has bookings it sends ONE branded notice (the shared
>   `booking-notice` shell) to the STORED contact address listing up to the 5 most recent
>   references + a TYP CTA, fire-and-forget so response timing doesn't leak whether mail went
>   out. The "Lost your reference?" panel is wired (busy state, always the generic "on its way"
>   note). Per-email caps (1/email/min, 5/day) still pending Redis.
> - NOT DONE: item 3 (non-sequential displayRef), item 5 (email-code step-up),
>   item 7 (tracking events).

## Phase 2 - Operator seats & roles (L)

*Recommended model: a custom `operator_users` table (see the sign-off callout in Part A). The
`organization`-plugin alternative is noted at the end.*

1. **Add the `operator_users` table** (Prisma, E.11 names): `id`, `operatorId` FK -> `operators.id`,
   `userId` FK -> `user.id` (unique per operator), `seatRole` enum (`owner` / `manager` / `staff`),
   `status` enum (`invited` / `active` / `suspended`), `invitedBy`, `invitedAt`, `lastLoginAt`,
   timestamps. (2FA secret/backup codes are NOT here - they live on the `twoFactor` plugin at the
   user level, Phase 3.)
2. **Migrate existing operators**: for each `Operator`, create one `operator_users` row for the
   current `Operator.userId` with `seatRole = owner`, `status = active`. One-time data migration.
   `Operator` stays the tenant root; no shadow table.
3. **Ownership resolution**: extend `resolveOperatorId` so any seat's `userId` resolves to its
   `operatorId`; keep the "no operator record -> 400" rule; expose the caller's `seatRole` for guards.
4. **Seat management** (service + operator-portal UI): invite (single-use token, 7-day, reuse the
   Resend invite email), list seats, change role, revoke (kills sessions + trusted devices
   immediately, writes an audit line). Owner seats removable only by another owner.
5. **Owner-only gates**: payout / bank / user-management / tier changes stay owner-only - enforce
   `seatRole = owner` in the service, alongside the existing `RolesGuard`/`PermissionsGuard`
   (no second permission system).
6. **RBAC note**: all seats keep the `TOUR_OPERATOR` platform `Role`; `seatRole` is the *intra-operator*
   distinction and is checked in the service, not via a new platform role.

> **EXECUTED 2026-07-19 (full phase, extended beyond the plan):** Phase 2 is built end to end,
> with two deliberate deviations and one major extension.
> - **Unified table, not operator-only:** the seats table is `staff_members` (+
>   `staff_designations`), covering BOTH operator team seats (`operatorId` set, user role
>   `TOUR_OPERATOR`) AND platform admin-side staff (`operatorId` NULL, user role `STAFF`).
>   E.11's `operator_users` shape (seatRole owner/manager/staff, status invited/active/suspended,
>   invitedBy, lastLoginAt) is preserved inside it. Schema: `backend/prisma/staff.prisma`;
>   migration `20260719180644_staff_and_designations` backfills an ACTIVE OWNER seat per existing
>   operator and seeds 3 system platform designations.
> - **Fine-grained permissions (extension):** effective set = (designation.permissions ∪
>   extraPermissions) − revokedPermissions, capped to a per-scope grant ceiling (platform ceiling
>   = ADMIN set minus MANAGE_SYSTEM/MANAGE_STAFF/MANAGE_TEAM; seat ceiling = TOUR_OPERATOR set
>   minus MANAGE_TEAM/MANAGE_OPERATOR_PAYMENTS) plus a non-revocable floor
>   (VIEW_PROFILE/EDIT_PROFILE). Single policy source `src/config/staff.config.ts`; computed by
>   the @Global `StaffPermissionsService` (60s cache, invalidated on every staff mutation) which
>   `PermissionsGuard` and `GET /users/me/permissions` now consult. A STAFF-role user WITHOUT a
>   staff record resolves to the floor only (closes the role-flip escalation path).
> - Items 2-5 as planned: `resolveOperatorId` (shared util) resolves ACTIVE seats; owner-only
>   gates kept for Stripe/Mollie payout config + seat management (`MANAGE_TEAM` sits outside the
>   seat ceiling, so only owners/admins ever hold it); operator profile/company/social accept any
>   active seat via `assertMemberOrAdmin` (still permission-gated). Seat management API:
>   `/api/v1/staff/team[...]` + designations; platform staff API: `/api/v1/staff[...]`
>   (MANAGE_STAFF, admin-only by ceiling). Invites reuse the operator invite flow (throwaway
>   credential + server-initiated reset -> invite email); suspension deletes sessions, sets
>   user.status SUSPENDED, and is enforced immediately (AuthGuard now calls getSession with
>   `disableCookieCache` and rejects SUSPENDED/DELETED; a `session.create.before` hook blocks
>   re-login with 403).
> - **NOT in scope here (per founder direction):** 2FA (Phase 3), step-up (Phase 4), Google SSO
>   (Phase 5), subdomain/cookie split (Phase 6). Staff/seat login is the existing email+password
>   door.
> - Dashboard (tripwheel-x-islandtours-dashboard): one `/team` route, role-branched (admin ->
>   platform staff + designations; operator owner -> team seats + designations) with a grouped
>   permission-matrix editor, per-member override sheet, invite dialog, suspend/resend/remove
>   actions. `RoleProvider`/sidebar now distribute the backend-computed EFFECTIVE permission set
>   (fetched in `getUserProfile`), so every existing `useRole().can()` gate honors fine-grained
>   staff grants automatically.
> - Also hardened while wiring: `GET /bookings` + `GET /bookings/:id` now require VIEW_BOOKINGS
>   (they were auth-only), with platform-wide scope for STAFF/EDITOR holders; suspended accounts
>   can no longer ride the 5-minute session cookie cache.
> - **Security + code review round (same day, both fixed):** (1) closed the role-flip escalation -
>   MANAGE_USERS/CREATE_USER/UPDATE_USER/DELETE_USER and MANAGE_OPERATOR_PAYMENTS are now outside
>   the platform-staff grant ceiling, and `PATCH /users/:id/role` additionally requires a true
>   ADMIN caller; (2) `GET /users/:id/permissions` is admin-or-self (was IDOR-readable by any
>   VIEW_PERMISSIONS holder); (3) `PATCH /users/:id(/status)` now runs the same suspension side
>   effects as the staff API (session kill + staff-row sync + cache invalidation); (4)
>   `updateTeamMember` collapsed to one validated write (was two non-atomic writes); (5) invite
>   provisioning extracted to the shared `provisionInvitedAccount` util (operators + staff use
>   one implementation); (6) permission catalog gated by VIEW_PERMISSIONS; resend-invite endpoints
>   throttled to human pace; (7) dashboard STAFF fallback is the profile floor, never the legacy
>   static STAFF list. Known limit: the permission cache is in-process - add shared invalidation
>   before any multi-instance deployment.

> **Alternative (only if multi-operator management appears):** the Better Auth `organization` plugin -
> Operator maps 1:1 to an organization, seats become members (`owner`/`admin`/`member` renamed to
> `owner`/`manager`/`staff` via access-control), invitations built in. Trade-off: a parallel
> `organization` table shadowing `Operator` and a second (plugin) permission system. Do not adopt
> unless one user needs to belong to and switch between multiple operators.

## Phase 3 - Operator 2FA (L)

1. **Enable the `twoFactor` plugin** (adds the `twoFactor` table: encrypted secret + backup codes).
2. **Enrollment flow** (white-glove): `two-factor/enable` -> show QR (from `totpURI`) + manual key +
   the 10 backup codes exactly once. Verify a first code to complete.
3. **Login flow**: after password success on an untrusted device, require `verify-totp`. On trusted
   devices (30-day, `trustDevice: true`) skip the prompt.
4. **Backup codes**: allow one-time use; regenerate under owner re-auth.
5. **Device & session management UI**: list trusted devices + active sessions; "Sign out everywhere";
   **any password or 2FA change wipes all sessions + trusted devices** (extend
   `revokeSessionsOnPasswordReset` behavior to 2FA changes).
6. **Recovery**: backup codes first, then admin-executed reset with owner approval for non-owner
   seats; **channel-separation** policy recorded now (enforced when WhatsApp arrives in v1.1).
7. **Operator login page**: split-screen layout, anti-phishing line, wrong-door cross-link to
   `/bookings`, "apply to list" link, all copy from the spec's locked set.

## Phase 4 - Step-up re-auth (M)

1. **`@StepUp()` guard/interceptor**: on payout, bank, seat-management, and tier-change routes,
   require a *fresh* session (recent auth) **and** a recent successful 2FA. If stale, return a
   challenge the frontend turns into a re-verify prompt.
2. **This is our replacement for Supabase's RLS `aal2`** - the control lives in the guard layer,
   consistent with the rest of the codebase.
3. **Audit** every step-up challenge + result.

## Phase 5 - Staff surface `admin.island.tours` (M)

1. **Add the `google` social provider** (Workspace client).
2. **`hd` verification hook**: in the OAuth sign-in hook, reject any token whose `hd` != the
   Workspace domain, server-side.
3. **`admin_allowlist` table**: `email, role (admin/support/content), addedBy, addedAt`. On login,
   the email must exist here; map its role into our `Role`/permissions.
4. **Admin login page**: single "Continue with Google" button, fine print, denied-state copy;
   noindex; linked from nowhere.
5. **Sessions**: 12h max for admin; fresh SSO (re-auth) for destructive/money actions (reuse the
   Phase 4 step-up mechanism).

### 5.1 How the super admin logs in

**Super admin = the `ADMIN` role.** There is no tier above it (ADMIN is already a strict superset of
all lower roles) and **no admin password anywhere** - staff authenticate only through Google
Workspace SSO. The flow:

1. Admin opens `admin.island.tours` (today `/staff`) and clicks **Continue with Google**.
2. Server-side, two checks run (never client-side): the Google **`hd` claim** must match the
   Workspace domain, **and** the email must exist in **`admin_allowlist`** with a role
   (`admin` / `support` / `content`).
3. Session is 12h; every login and action writes an `auth_audit` line.

**Bootstrapping (the first super admin).** You cannot add yourself to `admin_allowlist` through the
UI before you are an admin, so the first super admin is created the way the codebase already mandates
- **database seed only** (CLAUDE.md: "ADMIN role is database seed only; never created at runtime"):
- Seed the first super-admin email into `admin_allowlist` (+ the `User` row with `role = ADMIN`).
- That person logs in via Google SSO at `/staff`, then adds the rest of the staff to the allowlist
  from the admin UI.

**Hard constraint (spec open item O5).** Google SSO only succeeds if the super admin's email is a
**Google Workspace account in the org domain** (so the `hd` check passes). A super admin whose email
is not on the Workspace cannot use `/staff` at all. Confirm all staff seats live in one Workspace org
before wiring admin SSO.

**Transition safety.** Until `/staff` + Google SSO + the allowlist are built and cut over, admins
keep logging in through the existing `/login` (email+password -> `/dashboard`). Do not remove that
path first, or super admins lock themselves out.

## Phase 6 - Platform hardening: subdomains, cookies, CSP (M)

### 6.0 Decision - separate subdomains, NOT separate applications

The spec mandates three separate **URLs/subdomains** (`island.tours/bookings`,
`operators.island.tours`, `admin.island.tours`). Its stated reasons are all **runtime isolation** -
cookie scoping (`__Host-`), stricter CSP per surface, OTA convention - **none of which require
separate codebases.** So the decision:

- **Separate subdomains: required.**
- **Separate applications / codebases: not required, and not recommended.**

**Chosen approach: one codebase, host-based routing (Option A), with admin promotable to its own
deploy later (Option B).** Options considered:

| Option | What it is | Isolation | Cost |
|---|---|---|---|
| **A. One codebase, one deploy, host-based routing** | Single Next.js app; middleware routes `operators.*` / `admin.*` / public to different route groups; per-host cookies + CSP | Medium | Lowest - shared design system, API client, types |
| **B. One codebase, separate deploys per subdomain** | Same repo; admin (and maybe operator) is a separate Vercel project mapped to its subdomain | High (separate origins, CSP, WAF; independent deploys) | Low-medium |
| **C. Fully separate apps / repos** | Distinct codebases per surface | Highest | Highest - duplicated components + types drift + 3x CI/CD |

**Why A over C:** the design system (`--it-*` tokens), the Better Auth client, the API client, shared
types, and form components are used by every surface. Splitting into three codebases triplicates all
of it for a small team. Middleware can set host-only cookies and a per-host CSP from one app, which
delivers the spec's isolation without the duplication. **Admin is the natural (and only) candidate
for physical separation** (it holds the whole platform, "linked from nowhere"): if we ever want a
separate WAF, IP allowlist, or deploy cadence, promoting *just admin* to Option B from the same repo
is cheap and needs no rewrite.

Implementation:
1. **Host-based routing** in `middleware.ts`: map `operators.*` -> operator route group,
   `admin.*` -> admin route group, apex/`www` -> public site. `island.tours/bookings` is a public
   route (no session).
2. **Route groups** in the single app keep each surface's pages, layout, CSP, and login screen
   separate while sharing components.
3. Keep the door open for **Option B**: no code assumes a single deploy, so admin can later become
   its own Vercel project pointing at the same repo.

### 6.1 Better Auth cookie changes (important - current config is wrong for this)

**Problem:** the current config in `backend/src/auth/auth.instance.ts` does the OPPOSITE of the
isolation the spec wants. It enables `advanced.crossSubDomainCookies` with
`domain: process.env.COOKIE_DOMAIN ?? '.esenc.cloud'`, which **shares** the auth cookie across *all*
subdomains. That is deliberate today (so `app.` and `api.` share a session), but it means an XSS or
token theft on the operator surface could reach an admin session on a sibling subdomain - exactly
what three doors is meant to prevent.

**Target cookie model:**

| Surface | Session type | Cookie scope | Notes |
|---|---|---|---|
| Traveler `/bookings` | No Better Auth session (thin lookup) | Host-only, short-lived (24h ceiling), `__Host-` prefix | Separate cookie name; never shares with operator/admin |
| Operator portal | Better Auth session + 2FA | Host-only to `operators.island.tours` | Isolated from admin |
| Admin | Better Auth session (Google SSO) | Host-only to `admin.island.tours` | Isolated from operator; 12h ceiling |

**Changes to make:**
1. **Stop sharing the auth cookie across sibling subdomains.** Do not set a parent-domain
   (`.island.tours`) cookie for the operator and admin session cookies - use **host-only** cookies so
   `operators.` and `admin.` sessions cannot read each other. Concretely, drop the blanket
   `crossSubDomainCookies` + `COOKIE_DOMAIN` for these surfaces (or scope it only to the api<->app
   pairing that genuinely needs it, if that requirement still exists after the subdomain split).
2. **Add the `__Host-` prefix** to session cookies where the constraints allow it (`Secure`, path
   `/`, **no `Domain` attribute** - which is exactly host-only). `__Host-` and a shared `Domain` are
   mutually exclusive, so this reinforces change 1.
3. **Per-surface cookie attributes:** `httpOnly`, `Secure`, `SameSite=Lax` minimum.
4. **Fresh session id on every successful login** (session-fixation defense) - verify Better Auth
   rotates the session token on sign-in; enforce if not.
5. **Different cookie names per surface** so a browser hitting two surfaces never collides
   (e.g. `__Host-it_op_session` vs `__Host-it_admin_session` vs the traveler lookup cookie).
6. **`trustedOrigins`** must list all three subdomains (`operators.`, `admin.`, apex) so Better Auth
   accepts requests from each; keep the `INTERNAL_API_SECRET` SSR bypass working per origin.
7. **Session ceilings per surface:** operator 14-day rolling (with 30-day device trust from Phase 3),
   admin 12h - Better Auth session `expiresIn` is global, so per-surface ceilings are enforced in a
   guard/hook (shorten/deny stale admin sessions), not by a single config value.
8. **Revocation still global at the identity level:** a password/2FA change wipes all sessions +
   trusted devices (Phases 2/3) regardless of surface.

> Migration caution: changing the cookie domain invalidates existing sessions - everyone is logged
> out once. Ship this in a window where a forced re-login is acceptable, and after the operator/admin
> login surfaces exist (do not strand admins on the old shared cookie).

### 6.2 Remaining hardening

1. **Per-surface CSP** (set in middleware per host); **noindex** on `/bookings` and all admin routes.
2. **Compromised-credential screening** at password set + login (HaveIBeenPwned range API in a
   Better Auth password hook).
3. **Wrong-door cross-links** + global-footer "For operators".
4. **Enumeration/timing audit** across all three surfaces (DoD test #1) in all locales.

## Phase 7 - v1.1 / V2 (later)

- **v1.1**: WhatsApp 2FA codes (Meta authentication templates, business verification, template
  approval); enforce channel-separation in recovery; WebOTP autofill on Android.
- **V2**: operator + traveler passkeys (Better Auth `passkey` plugin, once we choose to); traveler
  magic-link sessions (`magicLink` plugin); operator NL/ES locales; admin hardware-key requirement at
  the IdP.

---

## C - Definition of Done mapping (from the spec, on Better Auth)

| Spec DoD item | Where it is satisfied |
|---|---|
| Enumeration test (message/status/timing) all surfaces, all locales | Phase 1/5/6 + tests |
| Rate limits + lockout per surface, WhatsApp path in copy | Phase 0 (Redis store) + 1 + 3 |
| Password managers autofill; correct autocomplete | Phase 1/3/5 form audit |
| OTP field: paste, numeric inputmode, `one-time-code` | Phase 3 |
| 2FA enrollment issues backup codes once; QR + manual key both work | Phase 3 (`twoFactor` plugin) |
| Step-up on payout/bank/seat/tier; audit lines | Phase 4 |
| `hd` + allowlist checked server-side; denied state | Phase 5 |
| Zero em-dashes; banned-word check | Content review (project rule) |
| Traveler renders in 7 locales; ref placeholder not localized | Phase 1 |
| `__Host-` cookies, fresh session id per login | Phase 6 |
| Codes capped at 5 attempts; WhatsApp 10-min expiry (v1.1) | Phase 3 / 7 |
| Seat revocation + password change kill sessions + trusted devices | Phase 2/3 |
| Reference-recovery cooldowns under distributed-IP test | Phase 1 |

---

## D - Risks & call-outs

1. **Seats is the biggest change** - it turns a 1:1 user-operator into a 1-operator-many-users model.
   Get the founder decision (plugin vs custom table) before starting Phase 2, and plan the data
   migration for existing operators carefully.
2. **2FA lockouts are a support cost** - white-glove enrollment + backup codes + a documented
   admin-reset path (Phase 3) are mandatory, not optional, or operators get locked out.
3. **The traveler surface does not need Better Auth sessions in v1** - keep it a thin lookup so we do
   not accidentally create real accounts for travelers (spec: no accounts, no passwords).
4. **Redis `secondaryStorage` must land first** (Phase 0) - shipping rate limits on in-memory storage
   is the documented production failure.
5. **Admin currently shares the generic `/login`** - do not remove that until the Google-only admin
   surface (Phase 5) is live, or admins lock themselves out.
6. **Cookie-domain change logs everyone out once** (Phase 6.1). The current config shares the auth
   cookie across subdomains (`domain: .esenc.cloud`); switching operator/admin to host-only
   `__Host-` cookies invalidates existing sessions. Ship it in a forced-re-login window, and only
   after the operator/admin login surfaces exist - never strand admins on the old shared cookie.
7. **Separate subdomains do not mean separate apps** (Phase 6.0). Build one codebase with host-based
   routing; keep only admin as an easy future candidate for its own deploy. Do not fork into three
   codebases.
</content>
