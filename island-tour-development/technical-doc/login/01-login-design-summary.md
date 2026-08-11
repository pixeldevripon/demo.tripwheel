# Island Tours Login Design - Detailed Summary

> Summarized from `technical-doc/login/island-tours-login-design-spec.md` (proposal v0.1) and
> `technical-doc/login/island-tours-login-research-and-rationale.md`. The third companion file,
> `island-tours-login-pages.html`, is the interactive mockup that visualizes every screen
> described below with sample data.
>
> Companion docs in this folder: `02-login-reconciliation.md` (spec vs as-built),
> `03-login-implementation-plan.md` (phased build), `04-why-better-auth.md` (engine decision),
> `../bookings/05-traveler-booking-session-story.md` (the as-built traveler-session flow, end to end).

**Status:** Proposal v0.1, dated July 3, 2026. Not yet folded into the master doc. Where it
disagrees with the master, the master wins.

> **AMENDED 2026-07-20 - customer accounts (founder decision).** "No passwords for travelers"
> and the three-doors model are RELAXED, not replaced: the passwordless pair-login stays the
> primary traveler path, but every booking now auto-creates an optional `Role.USER` account
> (welcome email + set-password link) and the dashboard app gains a FOURTH door, `/account`,
> where customers see their own bookings, payments and profile. Full design + invariants:
> `technical-doc/customers/CUSTOMER-ACCOUNTS.md`.

- **Section 2 (traveler)** implements an already-locked master decision (6.4).
- **Sections 3 & 4 (operator + admin)** fill a gap the master deliberately left out of scope (0.3).

---

## Core architecture: three doors, one design language

Three audiences with three different jobs, threat models, and login frequencies. They **never share
a login page** - each on its own subdomain for cookie isolation (`__Host-` cookies) and per-surface
CSP.

| Surface | URL | Who | Auth model |
|---|---|---|---|
| Your bookings | `island.tours/bookings` | Travelers | Email + booking reference (no password, no signup) |
| Operator portal | `operators.island.tours` | Operators + staff | Email + password + mandatory 2FA |
| Staff | `admin.island.tours` | Island Tours team | Google Workspace SSO only |

This mirrors the OTA/SaaS convention (admin.booking.com, supplier.viator.com, etc.). A hidden URL is
never treated as a security control - **authorization is always server-side**.

---

## Shared principles (all three surfaces)

1. **No account enumeration anywhere** - identical error message, HTTP status, and response timing
   whether or not an account exists (OWASP). Recovery flows always say "if that email exists, it's
   on its way."
2. **No SMS anywhere** - NIST SP 800-63B-4 (final July 2025) classes SMS as restricted; plus
   SMS-pumping fraud and poor Caribbean deliverability. Channels used instead: authenticator app
   (TOTP), WhatsApp codes, email.
3. **Research-grade form mechanics** - labels above fields (never placeholder-as-label), correct
   `autocomplete` attributes, `inputmode="numeric"` on code fields, paste always allowed,
   show-password toggle, no confirm-password field, real `<form>` so password managers work.
4. **Rate limiting per NIST** - escalating delays, per-account and per-IP caps, silent until
   lockout, then a warm message pointing to WhatsApp. CAPTCHA (hCaptcha) only above an abuse
   threshold.
5. **Password rules (operator only)** - min 12 chars, no composition rules, no rotation,
   compromised-credential screening, password managers/paste supported.
6. **Auditability** - every login, failed attempt, 2FA event, recovery, and role change writes an
   audit line.
7. **Design tokens per master; WCAG AA; `prefers-reduced-motion`**; brand voice ("Submit"/"Customer
   support" never appear; WhatsApp is the human fallback).
8. **Locales** - traveler surface in all 7 locales; operator EN (NL/ES on roadmap); admin EN only.

---

## 1. Traveler surface (`island.tours/bookings`)

- **Model:** email + booking reference pair - the industry no-account pattern (airline PNR + last
  name, Expedia itinerary + email). Key insight: **both halves arrive in the same confirmation
  email**, so inbox possession is the real credential.
- **Not a classic login:** no passwords, no signup. Entry points are confirmation/reminder emails,
  footer, TYP pointer, WhatsApp.
- **Page:** noindex, SSR never cached, 24h session cookie, minimal checkout-style chrome, centered
  card (max 440px).
- **Security posture:**
  - References are **identifiers, not secrets** (airline PNR brute-force research proves this) - so
    protection comes from rate limits + enumeration-proof responses + non-sequential `display_ref`
    generation (format `IT-2026-XXXXX`, ambiguous chars excluded).
  - Rate limits: 5 failed attempts/email/15 min, per-IP daily cap, per-reference cap, all silent
    until lockout.
  - Recovery endpoint has its own limits (1 send/email/min, 5/day).
  - **Insider path closed:** operators legitimately see traveler emails + references, so the pair
    alone manages a single booking, but **invoices and cross-booking history require a 6-digit
    email-code step-up from v1**.
  - Support never grants access on chat alone; booking-email typo correction is support-mediated.
- **Tracking:** GA4 `login` with `method: booking_ref`; PII-free; lockout fires an ops alert, not an
  analytics event.

---

## 2. Operator portal (`operators.island.tours`)

- **Threat model is real, not hypothetical:** the doc anchors on the 2023-2025 Booking.com
  partner-credential phishing economy (infostealer malware, up to $5,000/account on crime forums,
  85M fraudulent reservations blocked, attacks continuing past 2FA via session/cookie theft).
  Conclusion: launch with bank-grade security, not retrofit after an incident.
- **Auth model:**
  - **Per-person seats** (`operator_users`, roles: owner/manager/staff). Payout/bank changes are
    owner-only + step-up + email-notified.
  - **Email + password, then mandatory 2FA on every login on untrusted devices.**
  - **2FA channels phased:** v1 = TOTP + backup codes (white-glove enrollment at launch scale);
    **v1.1 = WhatsApp codes** (Meta auth templates, gated on template approval + business
    verification). Never SMS, never email codes.
  - **Backup codes:** 10, single-use, shown once, regenerate under owner re-auth.
  - **Device trust:** "Remember this device 30 days" + 14-day rolling session; trusted-device list +
    "Sign out everywhere"; any password/2FA change kills all sessions and trusted devices (defends
    against cookie theft).
  - **Step-up re-auth** for payout, bank, user management, tier changes.
  - **Recovery:** backup codes first, then admin-executed reset. **Channel separation rule:**
    recovery channel must differ from the seat's 2FA channel (a WhatsApp-2FA seat never gets a
    WhatsApp reset). No security questions ever.
  - **Anti-phishing line** on login + footer: "We'll never ask for your password or codes by email,
    text, or phone."
- **Layout:** split screen (brand panel left, form card max 400px right). Calm workplace, zero
  marketing.
- **Seat lifecycle settled:** invites (single-use, 7-day), reset links (single-use, 60-min, doesn't
  bypass 2FA), immediate revocation, owner-approved email changes.
- **Data model (proposed E.11):** `operator_users`, `trusted_devices`, `auth_audit` (12-month
  retention). Built on **Supabase Auth** (password + native TOTP MFA), `aal2` enforced via RLS,
  roles via custom access token hook. **No custom crypto.**
- **Tracking:** no marketing analytics; server-side PII-free product telemetry only.

---

## 3. Staff surface (`admin.island.tours`)

- **Google Workspace SSO only** - one button, "Continue with Google". No app-level passwords.
  MFA/passkeys/session policy enforced at the IdP (Google 2SV with security keys/passkeys).
- **Server-side authorization twice:** verify the Google `hd` claim server-side (the parameter alone
  is client-modifiable), then check the email against `admin_allowlist` with a role. Every query
  runs behind RLS.
- **Sessions:** 12h max, fresh SSO for destructive/money actions.
- **Data model:** `admin_allowlist` (email, role admin/support/content) + shared `auth_audit`.

---

## Cross-cutting decisions

- **Wrong-door routing:** each surface has one quiet cross-link; admin is linked from nowhere.
- **Explicit v1 exclusions:** no social login, no SMS OTP, no app-level passkeys (Supabase passkeys
  still experimental), no default CAPTCHA, no security questions / rotation / composition rules, no
  "keep me logged in" on the traveler surface.
- **V2 roadmap:** traveler magic-link sessions for multi-bookers; operator passkeys + mobile app
  biometrics; admin hardware-key requirement past 10 staff; operator NL/ES locales.

---

## The research backing (rationale doc)

Conducted July 3, 2026: four parallel research angles + adversarial verification of every
load-bearing claim against primary sources + a red-team review (24 findings triaged; material ones
folded in: channel separation, trusted-device management, seat lifecycle, recovery limits, insider
path, support scripts, WhatsApp moved to v1.1).

Key evidence:
- **Expedia One Key** (first-party): merging signup+signin into email+OTP improved login success
  **+19%**, signup **+30%**, cut password use **-92%**.
- **Baymard:** 19% of US shoppers abandoned an order because the site wanted an account - justifies
  no-account travelers.
- **NIST SP 800-63B-4** (final July 2025): no composition rules, no rotation, allow password
  managers + paste, SMS restricted.
- Booking.com/GetYourGuide/FareHarbor/Viator all confirm mandatory supplier 2FA + step-up + device
  trust as table stakes.

**Stated weak spots (intellectual honesty):** the Twitter ~$60M SMS-pumping figure and $5,000/account
price are unverified claims; KAYAK's password elimination is a stated plan not confirmed; magic-link
folklore numbers were untraceable and deliberately unused.

---

## Feature matrix - everything this doc defines

Every feature the proposal specifies, by surface, with the phase it is scheduled for. This is what
the doc *defines*; it is not a statement of what is already built in the codebase (see the separate
reconciliation doc).

### Phase legend - what each stage means

| Phase | Meaning | When | Examples |
|---|---|---|---|
| **v1** | **Launch scope.** Everything required to go live. The platform does not open to operators/travelers without these. | At launch | Traveler pair login, operator email+password, operator TOTP 2FA + backup codes, admin Google SSO, enumeration-proof responses, audit log |
| **v1.1** | **Fast-follow.** Built shortly after launch. Deliberately deferred from v1 because it has external lead times (vendor approval, integrations) but is not needed to open the doors. | Weeks after launch | WhatsApp 2FA codes (needs Meta template approval + business verification), WebOTP autofill |
| **V2** | **Later roadmap.** Genuine future work, revisited once the platform is established or a dependency matures. Not scheduled against launch. | Later | Passkeys (traveler + operator), traveler magic-link sessions, admin hardware-key requirement, operator NL/ES locales, SAML |
| **Excluded** | **Deliberately not built, ever (in the current design).** Rejected on evidence, not just deferred. | Never | SMS as any factor, social login buttons, default CAPTCHA, security questions, forced password rotation, composition rules, "keep me logged in" on the traveler surface |

The ordering logic: **v1** proves the product is safe to launch; **v1.1** removes the launch
dependencies that would have slowed v1; **V2** is upside once the basics are proven; **Excluded** is
what the research says to avoid.

### Traveler surface (`island.tours/bookings`)

| Feature | Phase |
|---|---|
| Email + booking-reference pair login (no password, no signup) | v1 |
| noindex, SSR never cached, 24h session cookie | v1 |
| Minimal takeover chrome, centered card (max 440px), WhatsApp link | v1 |
| Non-sequential `display_ref` generation (`IT-2026-XXXXX`, ambiguous chars excluded) | v1 |
| Enumeration-proof responses (identical message/status/timing) | v1 |
| Rate limits: 5 fails/email/15min, per-IP daily cap, per-reference cap, silent until lockout | v1 |
| "Lost your reference?" recovery by email, always-positive response | v1 |
| Recovery endpoint limits (1 send/email/min, 5/day, per-IP) | v1 |
| Email-code step-up for invoices + cross-booking history (insider-path defense) | v1 |
| Support-mediated booking-email typo correction (rebind + audit) | v1 |
| All 7 locales; reference placeholder never localized | v1 |
| GA4 `login` event (`method: booking_ref`), PII-free; lockout -> ops alert | v1 |
| Optional magic-link sessions for returning multi-bookers | V2 |
| "Keep me logged in" on traveler surface | Excluded |

### Operator portal (`operators.island.tours`)

| Feature | Phase |
|---|---|
| Email + password login (min 12 chars, no composition rules, no rotation) | v1 |
| Compromised-credential screening at set + login | v1 |
| Per-person seats with roles (owner / manager / staff) | v1 |
| Mandatory 2FA on every login on untrusted devices | v1 |
| 2FA channel: authenticator app (TOTP) + backup codes | v1 |
| White-glove 2FA enrollment during onboarding (QR + manual key + backup codes) | v1 |
| Backup codes (10, single-use, shown once, regen under owner re-auth) | v1 |
| Device trust ("Remember this device 30 days") + 14-day rolling session | v1 |
| Trusted-device + active-session list, "Sign out everywhere" | v1 |
| Password/2FA change invalidates all sessions + trusted devices | v1 |
| Step-up re-auth for payout, bank, seat management, tier changes | v1 |
| Recovery: backup codes -> admin-executed reset (owner-approved for non-owner) | v1 |
| Channel-separation rule (recovery channel != seat's 2FA channel) | v1 |
| Anti-phishing line on login page + portal footer | v1 |
| Seat lifecycle: invites (7-day), reset links (60-min), immediate revocation, email change | v1 |
| Split-screen layout (brand panel + form card max 400px) | v1 |
| Product telemetry only (no GA4/pixels); server-side, PII-free | v1 |
| 2FA fallback channel: WhatsApp codes (Meta auth templates) | v1.1 |
| Operator portal NL + ES locales | V2 |
| Operator passkeys + mobile app biometric session | V2 |
| SMS as any factor or channel | Excluded |
| Email codes as a 2FA channel | Excluded |

### Staff surface (`admin.island.tours`)

| Feature | Phase |
|---|---|
| Google Workspace SSO only ("Continue with Google", no app passwords) | v1 |
| Server-side `hd` claim verification against the Workspace domain | v1 |
| `admin_allowlist` role check (admin / support / content) | v1 |
| 12h max session; fresh SSO for destructive / money-adjacent actions | v1 |
| Every action audit-logged | v1 |
| noindex, no public links, isolated cookies + CSP | v1 |
| Hardware-key requirement at the IdP (once team > 10) | V2 |
| SAML SSO (only if an enterprise IdP ever replaces Workspace) | V2 |

### Shared / platform-wide

| Feature | Phase |
|---|---|
| Three separate subdomains, `__Host-` cookies, per-surface CSP | v1 |
| No account enumeration on any surface (verified in DoD) | v1 |
| Research-grade form mechanics (labels, autocomplete, paste, show-password, real form) | v1 |
| Central rate-limit / lockout store (Postgres or Upstash Redis), never in-memory | v1 |
| `auth_audit` table (actor/surface/event/ip/device/ts), 12-month retention | v1 |
| Design tokens per master, WCAG AA, `prefers-reduced-motion` | v1 |
| Wrong-door cross-links (traveler <-> operator; admin linked from nowhere) | v1 |
| Resend transactional email for recovery + reset (existing 6.5 infra) | v1 |
| App-level passkeys (traveler + operator) | V2 |
| Social login (Google/Facebook buttons) | Excluded |
| CAPTCHA by default (only behind abuse threshold) | Excluded |
| Security questions / forced rotation / composition rules | Excluded |

---

## Open items needing founder confirmation

| # | Item | Proposal |
|---|---|---|
| O1 | Operator 2FA rollout | v1 TOTP + backup codes; v1.1 WhatsApp fallback |
| O2 | Traveler step-up scope | Invoice/cross-booking behind email-code step-up from v1 |
| O3 | Operator locales | EN v1; NL/ES roadmap |
| O4 | Device trust duration | 30-day device trust, 14-day session |
| O5 | Google Workspace | Confirm all staff in one org with enforced 2SV |

---

**Bottom line:** a well-researched, standards-grounded proposal for three separate, purpose-built
login surfaces - passwordless friction-free for travelers, bank-grade-with-warmth for operators,
IdP-delegated for staff - built on Supabase Auth + Google SSO with no custom crypto, enumeration-proof
everywhere, and SMS-free by principle. It's a proposal awaiting founder sign-off (5 open items), not
yet locked into the master.
</content>
</invoke>
