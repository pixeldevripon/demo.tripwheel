# Island Tours, Login Design Spec (travelers, operators, admins)

**Status: proposal v0.1 (July 3, 2026). Not folded into the master. Where this document and the master disagree, the master wins. Note on scope: the master locks the traveler login model (6.4: email plus booking reference at island.tours/bookings, rate-limited, accounts auto-created at booking) and explicitly places operator and admin tooling out of its scope (0.3). Section 2 of this spec therefore implements a locked decision; Sections 3 and 4 fill a gap the master deliberately leaves open.**

---

## 0. Architecture: three doors, one design language

Three audiences, three different jobs, three different threat models. They never share a login page.

| Surface | URL | Who | Auth model |
|---|---|---|---|
| Your bookings | island.tours/bookings | Travelers | Email plus booking reference (master 6.4, locked) |
| Operator portal | operators.island.tours | Tour operators and their staff | Email plus password, mandatory 2FA |
| Staff | admin.island.tours | Island Tours team | Google Workspace SSO only |

Separate subdomains for operator and admin are the OTA and SaaS convention (admin.booking.com, supplier.viator.com, supplier.getyourguide.com, expediapartnercentral.com) and give cookie isolation (`__Host-` scoped cookies) plus stricter CSP per surface. A hidden URL is never treated as a security control; authorization is always server-side.

## 1. Shared principles (all three surfaces)

1. **No account enumeration, anywhere.** Identical generic error message, identical HTTP status, consistent response timing whether an account exists or not (OWASP). Recovery flows respond with "if that email exists, it's on its way" phrasing.
2. **No SMS, anywhere.** NIST SP 800-63B-4 (final, July 2025) classes PSTN/SMS as a restricted authenticator; SMS pumping fraud is a documented cost sink; Caribbean SMS deliverability is variable. Channels used instead: authenticator app (TOTP), WhatsApp codes, email.
3. **Form mechanics bundle (research-grade, applies to every form):** labels above fields, never placeholder-as-label; correct autocomplete attributes (`email`, `current-password`, `new-password`, `one-time-code`); `inputmode="numeric"` on code fields; paste always allowed; show-password toggle (reverts to hidden on submit); no confirm-password field; submit inside a real form so password managers and autofill work.
4. **Rate limiting and throttling** per NIST: escalating delays on failures, hard per-account and per-IP caps, silent to the user until the lockout state (then a warm lockout message with the WhatsApp path). CAPTCHA (hCaptcha) only behind an abuse threshold, never by default.
5. **Password rules where passwords exist (operator only):** minimum 12 characters, no composition rules, no periodic rotation, compromised-credential screening at set and login, password managers and paste explicitly supported (NIST SHALL requirements).
6. **Auditability:** every login, failed attempt, 2FA event, recovery, and role change writes an audit line (actor, surface, event, ip, device, timestamp). Extends the audit-line pattern the eligibility spec already uses.
7. **Design tokens per master section 3**; WCAG AA; `prefers-reduced-motion` respected; brand voice per section 4 ("Submit" and "Customer support" never appear; WhatsApp is the human fallback everywhere).
8. **Locales:** traveler surface ships in all seven locales through next-intl. Operator portal ships EN with NL and ES on the roadmap (O3). Admin is EN.

## 2. Traveler: Your bookings (island.tours/bookings)

### 2.1 Job, model, entry points

**Job:** get a traveler from a confirmation email or the footer to their booking with near-zero friction. This is not a classic account login: there are no passwords and no sign-up. The email-plus-reference pair (6.4) is the industry-standard no-account pattern (airlines: PNR plus last name; Expedia: itinerary number plus email; Booking.com: confirmation number plus PIN), with one structural advantage: both halves of our pair arrive in the same confirmation email, so possession of the email inbox is the real credential.

Entry points: confirmation and reminder emails ("Manage your booking"), the global footer link, the TYP account pointer, WhatsApp support sending the link. Direct navigation is secondary.

| Item | Value |
|---|---|
| URL | island.tours/bookings (no locale prefix, matching the TYP posture; locale via Accept-Language, switchable on page) |
| Indexing | noindex, follow; excluded from sitemaps |
| Rendering | SSR, never cached |
| Session | 24-hour cookie after successful login; logout link in the account area |

### 2.2 Layout

Minimal takeover chrome (checkout family, not the browse family): logo top-left linking home, "WhatsApp us" top-right, centered card (max 440px) on the off-white background, micro footer with legal links and the "Built by Islanders." sign-off small. No nav, no search, no distractions.

Card, top to bottom: H1, one-line sub, email field, reference field with helper, primary button, "Lost your reference?" link, quiet operator cross-link at the bottom of the page.

### 2.3 Copy (proposed locked set, EN source)

| Slot | Copy |
|---|---|
| H1 | "Your bookings" |
| Sub | "Log in with the email you booked with and your booking reference." |
| Email label | "Email" |
| Reference label | "Booking reference" |
| Reference placeholder | "IT-2026-K3M9P" |
| Reference helper | "Top of your confirmation email." |
| Primary button | "Show my bookings" |
| Lost link | "Lost your reference?" |
| Lost panel header | "We'll email it to you" |
| Lost panel button | "Email me my reference" |
| Lost panel result (always, no enumeration) | "If that email has bookings with us, the reference is on its way." |
| Error (pair mismatch, generic) | "That email and reference don't match. Check your confirmation email, or WhatsApp us and we'll fix it." |
| Lockout | "Too many tries. Wait 15 minutes, or WhatsApp us and we'll help you in." |
| Operator cross-link | "Tour operator? Log in to the operator portal →" |

### 2.4 Security posture

1. Rate limits (proposal): 5 failed pair attempts per email per 15 minutes with escalating delays, per-IP daily cap, per-reference cap; all silent until lockout. Limits live in a central store (8), never in serverless memory.
2. `display_ref` generation note: random within the IT-2026-XXXXX format, never sequential, ambiguous characters excluded, mirroring the `public_ref` non-enumerable posture (E.8). References are treated as identifiers, not secrets (airline PNR research shows why), which is exactly why the pair, the rate limits, and the enumeration rules do the protecting together.
3. The lookup never returns partial matches or confirms that an email exists.
4. **Reference-recovery endpoint has its own limits:** one send per email per minute, 5 per day, per-IP caps, CAPTCHA behind the abuse threshold. Protects both travelers and the transactional domain's sending reputation.
5. **The insider path is closed in v1:** operators legitimately see traveler emails and full references (LD4 makes the reference the check-in credential), so the pair alone must not open everything. Viewing or managing the single booking works with the pair; **invoices and cross-booking history require a 6-digit email code step-up from v1.** This narrows O2 to timing of the broader step-up, not whether PII gets the extra gate.
6. **Support never grants access on chat alone.** The lockout script: support verifies booking facts, then triggers a code or link to the booking email; identity is proven by inbox possession, not by conversation.
7. **Booking-email correction** (typo at checkout) is support-mediated: verify against booking facts plus payment context, rebind, audit line, confirmation to the new address. Without this, one typo means permanent lockout.
8. Session: fresh session ID issued on every successful login (fixation defense), 24-hour ceiling, logout always visible.

### 2.5 Tracking

GA4 `login` with `method: booking_ref` on success; silent failure counter (no PII, never the reference itself in the dataLayer). Lockout fires an ops alert, not an analytics event.

## 3. Operator portal (operators.island.tours)

### 3.1 Job and threat model

**Job:** daily availability management (the availability spec expects non-API operators in the portal ideally daily, closing dates that fill up), bookings, tier selection, payouts. The threat model is not hypothetical: Booking.com partner credentials were industrially harvested from March 2023 on (SecureWorks/Vidar per Krebs), buy offers up to $5,000 per hotel account circulated on crime forums, and stolen extranet access was used to scam guests through trusted in-platform messages. Booking.com reported blocking 85 million fraudulent reservations across more than 1.5 million phishing attempts in 2023. An operator account here exposes traveler PII and payout rails; it gets bank-grade treatment with island-grade warmth.

### 3.2 Auth model

1. **Per-person seats, never shared logins.** `operator_users` (3.6) with roles: owner, manager, staff. Payout and bank changes are owner-only and always step-up re-authenticated plus email-notified.
2. **Email plus password** (rules per 1.5), then **mandatory 2FA on every login on untrusted devices**. The two closest comparables both mandate 2FA for all supplier logins (GetYourGuide: every login, authenticator or SMS, explicitly no email codes; FareHarbor: mandatory rollout, SMS primary). Booking.com enforces 2FA at partner registration. Two deviations from those precedents are deliberate and ours to own: trusted devices skip the every-login prompt (daily-use reality), and SMS is replaced entirely (1.2).
3. **2FA channels, phased. v1: authenticator app (TOTP) plus backup codes, with white-glove enrollment during operator onboarding** (at launch scale every operator gets a guided setup anyway). **v1.1: WhatsApp code as the fallback channel** via Meta authentication templates (one-tap or copy-code); requires template approval and business verification, so it is scheduled work, not a launch dependency. WhatsApp capability of the target number is validated at enrollment. Never SMS, never email codes. Codes delivered over WhatsApp are valid 10 minutes; any code is invalidated after 5 failed attempts.
4. **Backup codes** (10, single-use, shown once at enrollment, regenerate under owner re-auth).
5. **Device trust: "Remember this device for 30 days"** (opt-in checkbox at the 2FA step), rolling 14-day session, biometric-gated persistence reserved for a future mobile app. Daily-use friction is solved with device trust, never with fewer factors (FareHarbor, Booking.com pattern). Because the documented post-2FA attack path is session and trust-cookie theft via malware, device trust comes with management: the portal settings list trusted devices and active sessions, offer "Sign out everywhere", and every password or 2FA change invalidates all sessions and trusted devices.
6. **Step-up re-auth** (fresh 2FA) for: payout details, bank changes, user management, tier changes. Mirrors Viator's finance-tab step-up and Peek's admin-gated payout edits.
7. **Recovery, assuming lost phones and tiny teams:** backup codes first; then a support reset executed by an admin with an audit line, owner approval required for non-owner resets. **Channel separation rule: the recovery channel must differ from the seat's 2FA channel.** A seat using WhatsApp codes (v1.1) never gets a WhatsApp-based reset; support verifies through the registered `contact_email` plus a callback to `contact_phone` (E.6), and one compromised WhatsApp account must never defeat both the factor and the reset path. No security questions, ever.
8. **Anti-phishing line on the login page and in the portal footer,** the 6.5 anti-fraud line adapted: "We'll never ask for your password or codes by email, text, or phone." Operators learn the sentence travelers already get.

### 3.3 Layout

Split screen. Left panel (desktop only): brand image or gradient, the wordmark, one line of purpose copy, the anti-phishing line pinned at the bottom. Right panel: the form card, max 400px. Mobile: form only, anti-phishing line under the card. The portal is a workplace: calm, fast, zero marketing.

### 3.4 Copy (proposed locked set, EN source)

| Slot | Copy |
|---|---|
| H1 | "Operator portal" |
| Sub | "Manage your tours, availability, and bookings." |
| Brand panel H2 (desktop left panel) | "Your tours, availability, and bookings. One place, every day." |
| Brand panel sub | "Close a date in one tap, keep your content current, and see every booking the moment it lands." (the one-tap close is the specced availability action; "content" is the founder-chosen container for photos, prices, and copy, July 3, 2026) |
| Email label / Password label | "Email" / "Password" |
| Show password | "Show" / "Hide" |
| Forgot link | "Forgot your password?" |
| Primary button | "Log in" |
| Reset result (always) | "If that email has an operator account, a reset link is on its way." |
| 2FA header | "Enter your code" |
| 2FA sub (TOTP) | "The 6-digit code from your authenticator app." |
| 2FA code field label | "6-digit code" |
| 2FA WhatsApp link (v1.1) | "Send the code to WhatsApp instead" |
| 2FA WhatsApp sub (v1.1) | "Code sent to the WhatsApp number ending in {last2}." |
| Backup link | "Use a backup code" |
| Backup sub | "Enter one of your backup codes." |
| Remember checkbox | "Remember this device for 30 days" |
| 2FA button | "Verify" |
| Resend (v1.1, WhatsApp state only, after 30s timer) | "Send a new code" |
| Error (credentials, generic) | "That email and password don't match." |
| Error (TOTP code) | "That code didn't work. Your app makes a new one every 30 seconds, try the newest." |
| Error (WhatsApp code, v1.1) | "That code didn't work. WhatsApp codes are valid for 10 minutes." |
| Error (backup code) | "That backup code didn't work. Each one works once." |
| Lockout | "Too many tries. Wait 15 minutes, or WhatsApp us from your registered number." |
| Anti-phishing line | "We'll never ask for your password or codes by email, text, or phone." |
| Traveler cross-link | "Looking for your booking? Go to island.tours/bookings →" |
| Apply link | "New here? Apply to list your tours →" |

### 3.5 States and seat lifecycle

Credentials → 2FA (untrusted device) → portal. Additional states: WhatsApp code sent (v1.1), backup code entry, locked, password reset requested, reset form, expired reset link, seat invited (first login sets password plus enrolls 2FA in one flow; enrollment shows QR plus manual key plus backup codes).

Lifecycle rules a dev will ask about, settled here:

- **Invites:** single-use token, 7-day validity; expired invites offer a re-send by the inviter; inviting an email that already holds a seat surfaces the existing seat instead of creating a duplicate.
- **Reset links:** single-use, 60-minute validity; completing a reset does not bypass 2FA; a password change invalidates every other session and trusted device and sends a notification email to the seat.
- **Revocation:** removing a seat kills its active sessions and trusted devices immediately (not at next request) and writes an audit line. Owner seats can only be removed by another owner.
- **Seat email change:** owner-approved, re-verifies the new address before it becomes the login identifier, audit-logged.

### 3.6 Data model (proposed E.11, auth)

| Table | Fields (summary) |
|---|---|
| `operator_users` | id, operator_id FK, email unique, role enum owner/manager/staff, password_hash, totp_secret nullable, totp_enrolled_at, whatsapp_e164 nullable (2FA fallback channel, defaults from E.6 `contact_phone` for the owner seat), backup_codes_hash[], status invited/active/suspended, last_login_at |
| `trusted_devices` | id, operator_user_id FK, device_hash, trusted_until, created_ip |
| `auth_audit` | id, surface enum traveler/operator/admin, actor (user id or email hash), event enum, ip, user_agent, created_at. Retention 12 months |

Implementation: Supabase Auth (password plus native TOTP MFA); `aal2` enforced for portal routes through restrictive RLS policies (`auth.jwt()->>'aal' = 'aal2'`); roles injected via the custom access token hook and checked in RLS. No custom crypto anywhere.

### 3.7 Tracking

No marketing analytics on the portal (no GA4, no pixels). Product telemetry only: login success/failure counters, 2FA method mix, recovery volume, all server-side and PII-free. These feed the security review, not campaigns.

## 4. Staff (admin.island.tours)

### 4.1 Model

1. **Google Workspace SSO only. No passwords exist at the application level.** One button: "Continue with Google". MFA, passkeys, and session policy are enforced once, at the IdP (Google 2SV with security keys or passkeys for staff), which is where NIST's phishing-resistance preference is satisfied without app-level buildout. Supabase-native passkeys stay off the table while the API is experimental.
2. **Server-side authorization, twice:** the Google `hd` claim is verified server-side against the Workspace domain (the parameter alone is client-modifiable, per Google's own docs), then the email must exist in `admin_allowlist` with a role. UI checks count for nothing; every admin query runs behind restrictive RLS on the role claim.
3. **Sessions:** 12-hour maximum, fresh SSO for destructive or money-adjacent actions (forfeit confirmation, refunds, capacity below `booked_count`, allowlist changes).
4. **Every action is audit-logged** (the master already expects actor-stamped audit lines in eligibility and availability admin flows; this generalizes it).
5. noindex plus no public links; the subdomain isolates cookies and CSP. Obscurity is a courtesy, not a control.

### 4.2 Layout and copy

Minimal, quiet, near-monochrome within the token set (the one surface with no marketing job). Small wordmark, centered card:

| Slot | Copy |
|---|---|
| Header | "Staff access" |
| Button | "Continue with Google" |
| Fine print | "Island Tours staff only. Every login and action is logged." |
| Denied (post-auth, specific is safe here) | "This Google account doesn't have staff access. Ask an admin to add you." |

### 4.3 Data model

`admin_allowlist`: email, role enum admin/support/content, added_by, added_at. Plus `auth_audit` (3.6).

## 5. Wrong-door routing

Separate URLs with one quiet cross-link each way (the OTA convention): traveler page links to the operator portal at the bottom; the operator portal links to island.tours/bookings; the global footer carries "For operators" next to "Manage your booking". The admin surface is linked from nowhere.

## 6. Explicit exclusions (v1)

- **No social login.** Travelers have no accounts to link (the pair is the credential); operators are business seats where Google/Facebook buttons add recovery ambiguity (Airbnb dropped Facebook Login entirely; Apple relay emails break support flows).
- **No SMS OTP anywhere** (1.2).
- **No app-level passkeys in v1.** Staff get phishing resistance via the Google IdP today; traveler and operator passkeys are V2 once Supabase support leaves experimental status.
- **No CAPTCHA by default**, only behind abuse thresholds.
- **No security questions, no forced password rotation, no composition rules, ever.**
- **No "keep me logged in" on the traveler surface** (24h session is the ceiling; the page holds PII and invoices).

## 7. V2 roadmap

1. Traveler step-up email code for multi-booking accounts (O2), then optional magic-link sessions for returning multi-bookers, keeping the pair as the universal fallback.
2. Operator passkeys (Supabase GA), WebOTP autofill for WhatsApp codes on Android, operator mobile app with biometric session.
3. Admin: hardware-key requirement at the IdP once the team grows past 10; SAML SSO only if an enterprise IdP ever replaces Workspace.
4. Operator portal NL and ES locales (O3).

## 8. Build notes and Definition of Done

Build: Supabase Auth for operator (password plus TOTP MFA plus RLS aal2) and admin (Google OAuth plus allowlist plus custom claims); the traveler pair check is a thin rate-limited endpoint over bookings (no Supabase Auth user needed in v1). Resend sends the reference-recovery and reset emails on the transactional subdomain (6.5 infrastructure). WhatsApp codes (v1.1) via Meta authentication templates (one-tap or copy-code), pending template approval and business verification. Rate limits and lockout counters live in one central store (Postgres or Upstash Redis), never in serverless instance memory: a per-instance limiter passes local tests and fails in production.

DoD:

1. Enumeration test passes on all three surfaces: identical message, status code, and timing for existing vs non-existing identifiers, in every locale.
2. Rate limits and lockouts verified per surface; lockout copy renders the WhatsApp path.
3. Password managers autofill both operator fields and the traveler email on first render (autocomplete attributes verified in Safari, Chrome, Firefox, iOS, Android).
4. OTP field accepts paste, `inputmode` numeric, `autocomplete="one-time-code"` verified on iOS.
5. 2FA enrollment flow issues backup codes exactly once and the QR plus manual key both work against Google Authenticator, 1Password, and Apple Passwords.
6. Step-up re-auth fires on every payout, bank, seat, and tier mutation; audit lines written and queryable.
7. `hd` claim and allowlist checked server-side (test with a spoofed hd parameter); denied state renders.
8. All copy passes the LD9 banned-word check and the em-dash check (zero em-dashes).
9. Traveler surface renders in all seven locales; reference format placeholder never localized.
10. Session cookies `__Host-` prefixed, httpOnly, SameSite=Lax minimum, secure; a fresh session ID is issued on every successful login.
11. Codes capped at 5 attempts each; WhatsApp codes (v1.1) expire at 10 minutes; both verified by test.
12. Seat revocation and password change kill active sessions and trusted devices immediately; verified with a live session in a second browser.
13. Reference-recovery endpoint honors its cooldowns and caps under a distributed-IP test.

## 9. Master fold-in map (proposed diffs, applied only after akkoord)

| Master section | Proposed change |
|---|---|
| 2.1 page-type table | Add row: Your bookings, island.tours/bookings (traveler account area entry) |
| 2.5 rendering table | Add row: /bookings SSR never cached |
| 5.11 area | New subsection or standalone canonical spec reference for the three login surfaces |
| 6.4 | Unchanged (this spec implements it); add pointer to this spec as deep source |
| Appendix E | New E.11 auth tables (3.6, 4.3); E.8 note: `display_ref` random within format, never sequential |
| Appendix F build map | Add row: Login surfaces, master 6.4 plus this spec |
| 0.3 scope | Optionally narrow "operator/admin tooling out of scope" to exclude auth, which this spec now covers |

## Open items for founder confirmation

| # | Item | Proposal |
|---|---|---|
| O1 | Operator 2FA rollout | v1: TOTP plus backup codes with white-glove enrollment; v1.1: WhatsApp code fallback (Meta template approval); never SMS, never email codes |
| O2 | Traveler step-up scope | Invoice and cross-booking views require the email-code step-up from v1 (2.4.5); broader every-login step-up stays v1.1 |
| O3 | Operator portal locales | EN v1; NL and ES on roadmap |
| O4 | Device trust duration | 30 days remember-device, 14-day rolling session |
| O5 | Google Workspace | Confirm all staff seats live in one Workspace org with enforced 2SV (passkeys or security keys) |

*Companion documents: island-tours-login-research-and-rationale.md (evidence and decision log), island-tours-login-pages.html (interactive mockup, sample data).*
