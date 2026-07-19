# Login Design vs As-Built Codebase - Reconciliation

> Companion to `01-login-design-summary.md`. This doc compares what the login proposal
> (`island-tours-login-design-spec.md`, v0.1) **defines** against what is **already built** in the
> Island Tours codebase (Better Auth on NestJS + Prisma + Postgres). It is a gap analysis, not an
> implementation plan (see `03-login-implementation-plan.md`). For why we stay on Better Auth rather
> than Supabase / a managed service, see `04-why-better-auth.md`.
>
> As-built facts verified against `backend/src/auth/`, `backend/prisma/`, `frontend/lib/auth-client.ts`,
> and the dashboard/auth routes on July 5, 2026.

---

## 0. The headline divergence: Better Auth (built) vs Supabase Auth (proposed)

**This is the single most important reconciliation point.**

The proposal repeatedly specifies **Supabase Auth** as the engine (spec 3.6, 4.1, 8; rationale D12):
password + native TOTP MFA, `aal2` enforced through Postgres **RLS policies**, roles via a Supabase
**custom access token hook**, "no custom crypto anywhere."

The codebase is built on a completely different foundation:

| Dimension | Proposal (spec v0.1) | As-built codebase |
|---|---|---|
| Auth engine | Supabase Auth | **Better Auth `^1.6.9`** |
| Runs where | Supabase (managed) | **NestJS backend only** (`auth.instance.ts`); CLAUDE.md rule 12 |
| DB access | Postgres RLS policies | **Prisma ORM + service-layer guards** (no RLS anywhere) |
| Authz mechanism | `aal2` JWT claim checked in RLS | **`RolesGuard` + `PermissionsGuard`** reading `role` column + `ROLE_PERMISSIONS` map |
| Session store | Supabase | Better Auth `session` table (Prisma), 7-day expiry |
| Multi-tenant seats | `operator_users` table | **None** - `Operator.userId` is `@unique` (one user per operator) |

**The proposal itself is not binding on this:** it is flagged "proposal v0.1, not folded into the
master," and "where this document and the master disagree, the master wins." The master + CLAUDE.md
lock Better Auth. So the reconciliation treats Supabase as **one proposed implementation option**,
and every feature below is assessed against **what Better Auth already does / can do**. The
Better-Auth-vs-Supabase decision is analyzed in depth in the implementation plan (file 3).

**Bottom line of this doc:** almost none of the login proposal is built yet, BUT almost all of it is
**buildable on the existing Better Auth stack** without adopting Supabase. The gaps are feature gaps,
not engine gaps.

---

## 1. What is already built (the auth foundation)

These exist today and are directly reusable:

- **Better Auth instance** (`backend/src/auth/auth.instance.ts`): email+password, `disableSignUp: true`,
  `requireEmailVerification: true`, `minPasswordLength: 12`, `resetPasswordTokenExpiresIn: 3600`,
  `revokeSessionsOnPasswordReset: true`.
- **Guard chain** (global, correct order): `ThrottlerGuard -> AuthGuard -> RolesGuard -> PermissionsGuard`.
- **RBAC**: `Role` enum (`ADMIN, EDITOR, STAFF, GUIDE, TOUR_OPERATOR, USER`), ~90-value `Permission`
  enum, `ROLE_PERMISSIONS` map (`backend/src/config/roles.config.ts`), mirrored on the frontend
  (`lib/config/rbac.ts`, `useRole()`).
- **DB hooks**: block runtime `ADMIN` creation; track `hasPassword` / `passwordChangedAt`.
- **Rate limiting, two layers**: Better Auth's own per-path limiter (`/sign-in/email`,
  `/forget-password`, `/reset-password` = 5/60s) + NestJS `ThrottlerGuard` (20/s, 300/min, 3000/hr)
  with the `INTERNAL_API_SECRET` trusted-origin bypass.
- **Operator invite flow** (`operators.service.ts`): admin creates operator user, links a throwaway
  credential, fires a server-initiated password reset that routes to the invite email.
- **Booking references**: `Booking.displayRef` (`IT-2026-00042`, unique) and `Booking.publicRef`
  (uuid TYP token) already exist.
- **Frontend**: `auth-client.ts` (`signIn`, `signOut`, `useSession`), a single `/login`,
  `/forgot-password`, `/reset-password`, dashboard layout gate, security card (password only).
- **Cross-subdomain cookies**: `advanced.crossSubDomainCookies` enabled in production
  (`COOKIE_DOMAIN`).

---

## 2. Traveler surface reconciliation (`island.tours/bookings`)

| Spec feature (v1) | As-built | Gap |
|---|---|---|
| Email + booking-reference pair login | **BUILT** - `POST /bookings/lookup` (throttled, enumeration-proof) + the `/bookings` page (`traveler-login.tsx`) | None |
| Session after a successful pair match | **BUILT (2026-07-19)** - the lookup issues a 24h HMAC email-bound token (`traveler-session.util.ts`); the frontend parks it in a first-party **HttpOnly** cookie via `POST /api/traveler-session` and replays it as `X-Traveler-Session`. Checkout's contact PATCH issues the same token so the fresh booker lands verified | None |
| TYP link possession =/= identity | **BUILT (2026-07-19)** - `GET /bookings/typ/:publicRef` returns a `verified` flag; without an owning session the payload is MASKED (email `d•••@g•••.com`, last-name initial, phone last-2, pickup address + card details withheld) and the page shows a "verify it's you" card into `/bookings` (`?returnTo=` deep-return supported, shape-validated) | None |
| Cancellation is owner-only | **BUILT (2026-07-19)** - `POST .../cancellation-request` 401s without a session owning the booking's contact email; the `/cancel/{publicRef}` page routes unverified visitors through the pair login and back | None |
| No passwords / no signup for travelers | Aligned - `USER` role exists, `disableSignUp: true`, bookings auto-create guest users | None |
| Non-sequential `display_ref` | Partial - `displayRef` exists and is unique, but generation is `IT-2026-00042` (looks sequential); spec wants random within format, ambiguous chars excluded | **Change** the display_ref generator to random/non-sequential |
| Enumeration-proof responses | **BUILT** - uniform 404 body on mismatch; uniform 429 on lockout | None |
| Rate limits (5/email/15min, per-IP, per-ref) | **BUILT (2026-07-19)** - `lookup-rate-limiter.ts`: 5 fails/email/15min + 10 fails/reference/15min on top of the per-IP throttle; silent until lockout; audit log lines + lockout warn (ops smell). In-memory (single-process deploy) - move to Redis if the API scales out | None |
| "Lost your reference?" email recovery | **BUILT** - `POST /bookings/lookup/recover-reference`, always acks `{sent:true}` | None |
| Recovery endpoint own limits | **BUILT** - dedicated `@Throttle` tiers | None |
| Email-code step-up for invoices / cross-booking | Not built - **deliberately deferred (founder decision 2026-07-19)**: v1 has no invoice download or cross-booking history surface, so the session covers everything that exists. Build with those features | Deferred |
| Support-mediated email correction | Not built (admin can edit, no dedicated verified rebind flow) | Build later / procedural |
| 7 locales, ref placeholder not localized | **BUILT** - `/bookings` page + verify cards ship in all 7 locales | None |
| GA4 `login` (`method: booking_ref`) | Not built | Build with the tracking module |
| No "keep me logged in" | Aligned by omission (session token expires after 24h; HttpOnly cookie maxAge matches) | None |

**Traveler verdict (updated 2026-07-19):** core surface BUILT end to end - pair login, HttpOnly
server session, masked-vs-verified TYP, owner-only cancellation, credential rate caps, audit lines.
Remaining: non-sequential display_ref generation, GA4 login event, and the deferred email-code
step-up. Still no Better Auth involvement for travelers, per the spec.

**EXECUTED 2026-07-19 (traveler session hardening):** backend
`src/bookings/traveler-session.util.ts` (HMAC v1 token, `TRAVELER_SESSION_SECRET` env with
`BETTER_AUTH_SECRET` fallback, PII maskers), `lookup-rate-limiter.ts`, service/controller/DTO wiring
(`sessionToken` on lookup + contact-PATCH responses, `verified` + masked fields on the TYP payload,
401-gated cancellation, `X-Traveler-Session` in CORS allow-list); frontend
`app/api/traveler-session/route.ts` (HttpOnly cookie set/clear), `lib/traveler-session.server.ts`,
`storeTravelerSession` (login + checkout call sites), session-aware TYP/cancel pages,
`ThankYouVerifyNotice` card, `returnTo` deep-return on `/bookings`, 7-locale strings. Verified: 159
backend unit tests green, live smoke (masked bare link -> lookup token -> unmasked + 401/409
cancellation gate).

---

## 3. Operator portal reconciliation (`operators.island.tours`)

| Spec feature (v1) | As-built | Gap |
|---|---|---|
| Email + password (min 12, no composition/rotation) | **Built** - `emailAndPassword`, `minPasswordLength: 12` | None (matches NIST already) |
| Compromised-credential screening | Not built | **Add** (Better Auth supports a password-validation hook / HaveIBeenPwned check) |
| Per-person seats (owner / manager / staff) | **Not built** - `Operator.userId @unique` = exactly one user per operator; no `operator_users` | **Major**: add multi-seat via a **custom `operator_users` table** (recommended; `organization` plugin only if multi-operator management appears - see plan Part A) |
| Mandatory 2FA on untrusted devices | **Not built** - no `twoFactor` plugin, no TOTP fields, no UI | **Major**: add Better Auth `twoFactor` plugin |
| TOTP + backup codes | Not built | Comes with the `twoFactor` plugin (TOTP + backup codes built in) |
| White-glove enrollment (QR + key + codes) | Not built | Build UI on top of the plugin |
| Backup codes (10, single-use, regen) | Not built | Plugin provides; wire regen-under-owner-reauth |
| Device trust (30-day) + 14-day rolling session | Partial - session is global 7-day/1-day update; no per-device trust | **Change** session config + use plugin `trustDevice` (30-day built in) |
| Trusted-device + session list, "Sign out everywhere" | Not built (sessions exist in DB, no management UI) | Build UI over Better Auth session APIs |
| Password/2FA change kills all sessions + devices | Partial - `revokeSessionsOnPasswordReset: true` covers reset; not 2FA-change or trusted-device revoke | **Extend** to 2FA change + trusted-device wipe |
| Step-up re-auth (payout/bank/seat/tier) | **Not built** - no fresh-auth gate on sensitive mutations | **Build**: a step-up guard/interceptor (fresh session or fresh 2FA check) |
| Recovery: backup codes -> admin reset | Partial - admin invite/reset exists; backup-code recovery + owner-approval rules do not | Build on top of plugin + seat roles |
| Channel-separation rule | Not built | Policy in recovery service (relevant when WhatsApp lands in v1.1) |
| Anti-phishing line | Not built (copy only) | Content addition |
| Seat lifecycle (invites 7-day, resets 60-min, revoke) | Partial - reset token is 3600s (60 min, matches!); invite is a reset link (no 7-day single-use invite token); no seat revoke | Build invite/revoke on seats; reset expiry already correct |
| Split-screen layout | Not built (single generic `/login`) | Build operator login page |
| Product telemetry only | Partial - no portal analytics today anyway | Add server-side counters |

**Operator verdict:** the **credential half is built** (email+password at 12 chars already meets NIST),
but **everything that makes it "bank-grade" is missing**: 2FA, seats/roles, device trust, step-up.
These are the two biggest builds in the whole proposal. 2FA is a Better Auth plugin (`twoFactor`);
seats are a custom `operator_users` table (recommended over the `organization` plugin - see plan
Part A). Either way, no engine change required.

---

## 4. Staff surface reconciliation (`admin.island.tours`)

| Spec feature (v1) | As-built | Gap |
|---|---|---|
| Google Workspace SSO only ("Continue with Google") | **Not built** - no social/OAuth provider configured at all | **Build**: add Better Auth `google` social provider |
| No app-level passwords for admins | Partial - `ADMIN` role exists but admins currently use the same email+password login | **Change**: gate admin to Google-only |
| Server-side `hd` claim verification | Not built | **Build**: verify `hd` in a Better Auth OAuth hook (Better Auth does not check `hd` natively) |
| `admin_allowlist` (admin/support/content) | Partial - `Role` has `ADMIN` but no allowlist table or the support/content sub-roles | **Add** allowlist table + map to roles |
| 12h session; fresh SSO for destructive actions | Not built (global 7-day session) | Build per-surface session + step-up |
| Every action audit-logged | Partial - services log mutating admin actions via `Logger`, but no queryable `auth_audit` table | **Add** `auth_audit` table |
| noindex, isolated cookies + CSP | Partial - cross-subdomain cookies exist; admin subdomain/CSP not set up | Build with subdomain split |

**Staff verdict:** ~0% built. Needs Google OAuth (Better Auth supports it), an allowlist table, `hd`
verification hook, and a separate admin login surface. All feasible on Better Auth.

---

## 5. Shared / platform reconciliation

| Spec feature | As-built | Gap |
|---|---|---|
| Three subdomains, `__Host-` cookies, per-surface CSP | Partial - `crossSubDomainCookies` + `COOKIE_DOMAIN` exist; no `__Host-` prefix, no per-surface CSP, single frontend host | **Build** subdomain routing + cookie/CSP hardening |
| No account enumeration anywhere | Partial - Better Auth's generic errors help; not audited/tested for identical timing | Harden + DoD enumeration test |
| Research-grade form mechanics | Partial - existing forms are decent; not audited against the full checklist | Audit + fix |
| Central rate-limit / lockout store (not in-memory) | **Gap** - Better Auth's limiter is **in-memory by default**; no `secondaryStorage` configured; Redis exists but only for BullMQ | **Add** Better Auth `secondaryStorage` (Redis) - spec explicitly warns in-memory fails in prod |
| `auth_audit` table (12-month retention) | Not built | **Add** table + write path in guards/hooks |
| Design tokens, WCAG AA, reduced-motion | Frontend token system exists | Apply to new pages |
| Wrong-door cross-links | Not built (single login) | Build with the three pages |
| Resend for recovery/reset | **Built** - `mailService` uses Resend | Reuse |

---

## 6. Data-model reconciliation

| Spec table (proposed E.11) | As-built equivalent | Gap |
|---|---|---|
| `operator_users` (seats, roles, totp_secret, backup_codes, whatsapp_e164, status) | **None** - `Operator.userId @unique` only | Add a **custom `operator_users` table** (recommended - `operatorId` FK + `seatRole` + `status` + invite fields; keeps `Operator` as the tenant root and reuses our guards). 2FA secret/backup codes are NOT here - they come from the `twoFactor` plugin's tables. Plugin alternative deferred unless multi-operator management appears (see plan Part A) |
| `trusted_devices` | **None** | `twoFactor` plugin manages trusted devices via session flags; a dedicated table is optional |
| `auth_audit` (surface, actor, event, ip, ua) | **None** (ad-hoc `Logger` only) | Add table |
| `admin_allowlist` | **None** (`Role.ADMIN` only) | Add table |
| `display_ref` random within format | `Booking.displayRef` exists, likely sequential | Change generator |
| TOTP secret / backup codes | **None** | `twoFactor` plugin adds `twoFactor` table (secret + backupCodes) |

Existing `Booking.contactEmail/contactPhone/displayRef/publicRef` and
`Operator.contactEmail/contactPhone` already cover several spec references (E.6, E.8).

---

## 7. Gap summary by size

**Already done (reuse as-is):**
- Email+password at 12-char minimum (NIST-aligned), reset-token 60-min, revoke-on-reset.
- RBAC engine + guards + frontend mirror.
- Booking `displayRef`/`publicRef` fields; operator `contactEmail`/`contactPhone`.
- Resend transactional email; two-layer rate limiting infra; cross-subdomain cookies.

**Small / medium builds:**
- Traveler email+reference lookup endpoint + `/bookings` page + recovery + email-code step-up.
- Better Auth `secondaryStorage` (Redis) for the rate limiter.
- `auth_audit` table + write path.
- Non-sequential `display_ref` generator.
- Admin Google OAuth + `hd` verification + `admin_allowlist`.
- Enumeration/timing hardening + form-mechanics audit.
- Subdomain split, `__Host-` cookies, per-surface CSP, wrong-door links, three login pages.

**Large builds:**
- **Operator 2FA** (Better Auth `twoFactor` plugin: TOTP + backup codes + trusted device + step-up).
- **Operator multi-seat** (owner/manager/staff) via a **custom `operator_users` table**
  (recommended over the `organization` plugin - see plan Part A) - the biggest data-model change;
  today one user per operator.

**Engine decision (see file 3):** none of the above requires abandoning Better Auth. The proposal's
Supabase Auth is a substitution that would contradict CLAUDE.md rules 12/14 and the entire RLS-free,
Prisma + guard-based authorization architecture. Recommendation and full trade-off analysis are in
`03-login-implementation-plan.md`.
</content>
