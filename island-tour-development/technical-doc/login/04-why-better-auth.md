# Why Better Auth for the Island Tours Login (engine decision)

> Companion to `01-login-design-summary.md`, `02-login-reconciliation.md`, and
> `03-login-implementation-plan.md`. This doc makes the standalone case for keeping the platform on
> **Better Auth** rather than migrating to Supabase Auth or another managed auth service (Auth0,
> Clerk, WorkOS, AWS Cognito, Firebase Auth, Stytch).
>
> Context: the login proposal (`island-tours-login-design-spec.md`, v0.1) was written assuming
> **Supabase Auth**. The platform is actually built on **Better Auth `^1.6.9`**. The proposal is a
> non-binding draft ("the master wins"); `CLAUDE.md` rules 12 and 14 lock Better Auth. This doc
> explains why that lock is also the right security and engineering decision.

---

## TL;DR

**Better Auth is the best fit for the spec's security bar. Do not switch.**

1. **Every security requirement the spec defines is achievable on Better Auth** - there is no defined
   requirement only a managed service can meet.
2. **The requirements that carry the real security weight are app-layer controls** (enumeration
   resistance, rate limiting, audit, step-up, session hygiene) that you build regardless of engine.
   A managed service does not remove that work; it only moves where credentials are stored.
3. **Switching costs are large** (identity forks out of our Postgres, RBAC rebuilt, every
   authenticated feature re-touched, vendor lock-in + per-MAU cost, PII leaves our DB) **and buy no
   security we cannot otherwise get.**
4. **Better Auth is not hand-rolled crypto** - it is a mature, maintained library that ships password
   hashing, TOTP, and session management. The spec's "no custom crypto" goal is already satisfied.

---

## 1. What "security defined in the spec" actually asks for

The spec's security model is a set of controls, not a vendor. Mapped to where each is satisfied:

| Spec security requirement | Better Auth covers it? | What a managed service would add |
|---|---|---|
| No account enumeration (identical message / status / timing) | Yes - app layer | Nothing; engine-agnostic, you build + test it either way |
| Rate limiting, escalating delays, per-account / per-IP caps, lockout | Yes - Better Auth limiter + NestJS throttler + Redis | Parity; already built |
| Central rate-limit / lockout store (not in-memory) | Yes - `secondaryStorage` (Redis) | Parity |
| Password rules (12+ chars, no composition, no rotation) | Yes - `minPasswordLength: 12` today | Already NIST-aligned |
| Compromised-credential screening | Yes - HaveIBeenPwned range-API hook (small) | Auth0 / Clerk ship breached-password detection built in (a convenience, not a gap) |
| TOTP 2FA + backup codes + trusted device | Yes - `twoFactor` plugin | All managed services have MFA; parity |
| Google Workspace SSO + server-side `hd` verification | Yes - `google` provider + sign-in hook | WorkOS / Auth0 excel at enterprise SAML; plain Google OIDC is trivial anywhere |
| Step-up re-auth on payout / bank / seat / tier | Yes - custom NestJS guard | Auth0 has ACR/step-up, but you still wire the gates |
| Session: fresh id per login, `__Host-` cookies, revoke-all, per-surface ceilings | Yes - config + guard | Parity |
| Auditability (`auth_audit`, 12-month retention) | Yes - table + write path in guards/hooks | Managed services give hosted audit dashboards for free |
| No SMS anywhere | Yes - policy (we simply never enable it) | Some managed services default to SMS OTP; you would have to disable it |

**Every row is a "yes" on Better Auth.** No spec requirement is managed-service-only.

---

## 2. The security insight that settles it

The rationale doc's own threat model (the 2023-2025 Booking.com partner-phishing economy) shows the
attacks that actually caused damage were **infostealer malware + session/cookie theft that defeated
2FA** (Microsoft Storm-1865 continued *after* 2FA enforcement).

The defense against that class of attack is **trusted-device management + sign-out-everywhere +
session hygiene + step-up on money actions** - all **session/app-layer** controls, which Better Auth
plus our guards handle directly. A managed auth vendor would not have prevented those breaches
either. So the security bar is met by **how sessions and step-up are managed**, not by **who hosts
the password hash.**

---

## 3. Why not Supabase Auth

The proposal names Supabase specifically. Its genuine benefits do not fit this codebase:

1. **Its headline benefit is RLS-enforced `aal2` - and we do not use RLS.** Our authorization is
   NestJS guards + service-layer checks over Prisma. Supabase's "AAL2 enforced in the database"
   only pays off if the entire data layer is rewritten to run behind Row-Level Security with
   Supabase-issued JWTs. That is a backend re-platform, not an auth feature.
2. **Two sources of truth for users.** Supabase Auth owns its own `auth.users` table and issues its
   own JWTs; `CLAUDE.md` rule 14 mandates one Prisma instance / one `DATABASE_URL` / no auth in the
   frontend.
3. **Our RBAC would be rebuilt as JWT claims + RLS policies** - discarding a working, tested,
   frontend-mirrored system.
4. **Our step-up guard replaces RLS `aal2` cleanly** - the control lives in the guard layer,
   consistent with the rest of the codebase, with none of the migration cost.

---

## 4. Why not a managed service (Auth0 / Clerk / WorkOS / Cognito / Stytch)

**What they genuinely add:** breached-password detection, anomaly / bot / adaptive MFA, SOC2 / ISO
attestations, hosted enterprise SAML, and dashboards.

**Why that does not justify a switch here:**

- **Breached-password** = one HIBP hook on Better Auth.
- **Adaptive MFA / SAML** = not in the spec's v1 (SAML is explicitly V2). Deferrable.
- **Compliance attestations** = only matter if the *business* must show a SOC2-audited auth vendor -
  a legal/commercial call, not a technical gap.
- **Dashboards** = convenient, not load-bearing.

**And the switching costs are large:**

1. **Identity forks out of our Postgres / Prisma** - violates rule 14.
2. **RBAC / guards rebuilt** around external JWT claims.
3. **Every authenticated feature re-touched** (operators, tours, bookings, wishlist, dashboard gate).
4. **Vendor lock-in + per-MAU billing** - Auth0 / Clerk price per monthly active user.
5. **PII leaves our database** - a platform holding traveler PII + payout data moves identity to a
   third party (more surface, data-residency questions).

Note: travelers do **not** use the auth engine in v1 (their `/bookings` surface is a thin,
sessionless lookup), so managed-service MAU cost would only cover operators (~25) + admins. Cheap on
MAU, yes - but it would still fork identity from the `Operator` aggregate and break the guard/RBAC
model. Not worth it.

---

## 5. When we would reconsider

Revisit this decision - and even then only as a **scoped addition for the operator/admin surfaces**,
not a full migration - if any of these become true:

1. The business needs a **formal SOC2 / ISO attestation for auth specifically.**
2. **Enterprise SAML SSO for operators** lands on the near-term roadmap (WorkOS is the natural fit).
3. There is **no in-house capacity** to implement and maintain security-critical auth correctly.
4. A genuine **multi-org model** appears (one person managing several operator accounts with an org
   switcher) - which would separately favor the Better Auth `organization` plugin over the custom
   seats table.

None of these are in the spec today.

---

## 6. Decision

**Keep the platform on Better Auth.** Build the three login surfaces on it using:

- `twoFactor` plugin (TOTP + backup codes + 30-day trusted device),
- a **custom `operator_users` table** for seats (see plan Part A / Phase 2),
- the `google` social provider + an `hd`-verification hook for admin SSO,
- Redis `secondaryStorage` for the rate limiter,
- an `auth_audit` table,
- a NestJS **step-up guard** in place of Supabase RLS `aal2`.

This meets every security requirement the spec defines, keeps identity in our own Postgres, preserves
our RBAC, honors `CLAUDE.md` rules 12 and 14, and avoids a costly migration that would buy no
security we cannot already achieve.
</content>
