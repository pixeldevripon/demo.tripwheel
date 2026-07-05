# Login Design, Research and Rationale

**Companion to island-tours-login-design-spec.md (proposal v0.1, July 3, 2026). The spec says what the three login surfaces ARE; this document carries the evidence and the decision log. Research conducted July 3, 2026: four parallel research angles (traveler flows, supplier portals, internal admin practice, login UX evidence), adversarial verification of every load-bearing claim against its primary source, and an independent red-team review of the draft (24 findings, all triaged; the material ones are folded into the spec: channel separation between 2FA and recovery, trusted-device management against cookie theft, seat lifecycle rules, recovery-endpoint limits, the operator-insider path on traveler references, support verification scripts, and the WhatsApp fallback moved to v1.1).**

---

## 1. Why three doors

Travelers, operators, and staff differ on every axis that matters to authentication: what they protect (one booking vs payout rails plus traveler PII vs the whole platform), how often they log in (once per trip vs daily vs all day), and who attacks them (opportunists vs industrial credential harvesters vs targeted attackers). Every large OTA reflects this with separate surfaces: admin.booking.com, supplier.viator.com, supplier.getyourguide.com, expediapartnercentral.com. Airbnb's shared guest/host account with a mode switch is the documented outlier, and it comes with host-security machinery Island Tours has no reason to rebuild.

## 2. What the platforms do (verified July 2026 unless dated)

### Traveler sign-in

| Platform | Model today |
|---|---|
| Booking.com | Email-first; emailed verification code as a first-class login path, password optional; passkeys in account settings. Guest bookings manageable with confirmation number plus PIN |
| Airbnb | Code-first via email or phone (text, call, or email code), password as manual alternative; Apple and Google; Facebook Login removed |
| Expedia | One Key: single email plus OTP flow for both sign-up and login |
| Klook | Account required to book; email, phone, or Google/Apple/Facebook |
| Hopper | Phone-number based, passwordless |
| Airlines/hotels | Universal no-account pattern: booking reference plus last name (PNR), itinerary number plus email (Expedia), confirmation number plus last name (Hilton, Marriott) |

The Expedia One Key result is the strongest published number in this space: merging sign-up and sign-in into one email-plus-OTP flow improved login success 19%, sign-up success 30%, and cut password-based authentication use by 92% (Expedia Group Tech, August 2023, first-party). Directionally supporting: Yahoo! JAPAN's passwordless program cut sign-in related inquiries about 25% and made authentication 2.6x faster (passkeys vs SMS, web.dev case study); KAYAK cut average sign-in/sign-up time about 50% with passkeys and stated the plan to eliminate passwords by end of 2023 (Google developers blog; the completion itself is not independently confirmed).

Implication for Island Tours: the master's email-plus-reference pair (6.4) is not a compromise; it is the industry's no-account pattern, and the industry's account pattern is converging on "email plus a code from your inbox" anyway. The confirmation email holds both halves of our pair, so the traveler experience is one glance at one email. What the airline precedent teaches is the caveat: booking references are identifiers, not secrets (CCC researchers brute-forced PNRs against common last names in 2016; Booking.com tells customers to treat its PIN "like any password"), so the protection lives in rate limiting, enumeration-proof responses, non-sequential reference generation, and an optional emailed-code step-up as accounts accumulate history.

### Operator/supplier portal auth

| Platform | Model |
|---|---|
| Booking.com Extranet | 2FA required at login (PIN via SMS or Pulse app), forced at partner registration, per-device trust, step-up prompts for sensitive actions; anti-phishing line in product ("We'll never ask you to give us any log-in info") |
| GetYourGuide supplier portal | 2FA mandatory for all account types, on every login; authenticator app (recommended) or SMS; email codes explicitly not offered; backup codes; support-mediated reset |
| FareHarbor | 2-step verification mandatory (phased rollout); SMS primary, email fallback; "remember this device" opt-in; 14-day sessions; per-user seats urged over shared logins; company recovery phone, role-gated |
| Viator supplier portal | Email plus password; documented step-up 2FA for high-risk areas (Finance tab: emailed code, 20-minute validity, 1-hour lockout) |
| Peek Pro | Payouts, tax forms, and employee access gated to admin users; dedicated MFA guide; in-help phishing education |
| Checkfront / Rezgo / Rezdy | Per-user MFA (TOTP/SMS/email variants); admin can mandate 2FA for staff; brute-force lockouts |

**The cautionary tale that anchors Section 3 of the spec:** from March 2023 onward, infostealer malware harvested hotel partners' Booking.com extranet credentials at industrial scale (SecureWorks/Vidar, per Krebs on Security, November 2024). Stolen partner access was used to message guests in-platform with fake payment requests; crime-forum posts offered up to $5,000 per hotel account (a buy offer, not a confirmed sale price); Booking.com said it "blocked 85 million fraudulent reservations over more than 1.5 million phishing attempts in 2023" (as quoted by Krebs) and told the BBC phishing targeting travelers rose 900%. Attacks continued into 2025 via malware on partner devices even after 2FA enforcement (Microsoft's Storm-1865 reporting), which is why the spec pairs 2FA with trusted-device management and sign-out-everywhere rather than treating 2FA as the finish line. Conclusion: an operator portal holding payouts and traveler PII must launch with mandatory 2FA, per-person seats, step-up on money mutations, and phishing education built in. Retrofitting security after an incident is the documented failure path.

### Internal admin practice

- NIST SP 800-63B rev 4 is final (published July 2025): no password composition rules (SHALL NOT), no periodic rotation (SHALL NOT), password managers and autofill allowed (SHALL), paste supported (SHOULD), throttling required, PSTN/SMS classed as a restricted authenticator, OTP methods not phishing-resistant, syncable passkeys acceptable at AAL2.
- OWASP: generic errors with identical status codes and timing against account enumeration; MFA as the strongest credential-stuffing defense; short admin sessions with re-auth for sensitive operations.
- Supabase (2026): native TOTP MFA enforceable in the database via the JWT `aal` claim in restrictive RLS policies; roles via the custom access token hook; built-in rate limits and auth audit logs. Passkey support is experimental ("the API may change without notice") and unavailable to SSO users, which settles "no app-level passkeys in v1".
- Google OIDC: the `hd` parameter is a UI optimization only; the returned ID token's `hd` claim must be validated server-side. IdP-enforced 2SV (passkeys/security keys) gives the whole staff phishing-resistant MFA without any app-level buildout.

## 3. Verified findings that shaped the design

1. **Passwordless email-code flows are mainstream traveler behavior and measurably outperform passwords** (Expedia +19/+30/-92; Booking.com and Airbnb both code-first). Confidence: high. Used in: traveler surface has no passwords at all; V2 step-up uses an email code, not a password.
2. **Booking references must be treated as enumerable identifiers** (CCC PNR research; Booking.com PIN guidance). Confidence: high. Used in: 2.4 security posture, non-sequential `display_ref` note.
3. **Mandatory supplier 2FA is table stakes in this exact industry** (GetYourGuide every login; FareHarbor mandatory; Booking.com enforced at registration). Confidence: high. Used in: 3.2.
4. **Credential-only partner logins are a documented catastrophe** (the 2023-2025 Booking.com partner phishing economy, Krebs/SecureWorks/Microsoft). Confidence: high. Used in: the entire operator threat model.
5. **SMS is the wrong channel here:** NIST restricts PSTN out-of-band; SMS pumping fraud is a real cost (X/Twitter's claimed ~$60M/year loss and its withdrawal of free SMS 2FA); island deliverability varies. GetYourGuide proves that mandatory 2FA with a strict channel policy works with small suppliers, but honesty requires noting its fallback IS SMS; replacing SMS with WhatsApp is our deviation, chosen for island reality, and owned as such in the spec. Confidence: high on NIST/GYG, medium on the Twitter figure (unverified company claim). Used in: no-SMS principle, TOTP-first with WhatsApp as the v1.1 fallback.
6. **WhatsApp authentication templates (one-tap and copy-code OTP buttons) are a supported Meta pattern.** Confidence: high (Meta developer docs). No public pricing-vs-SMS claim made. Used in: the v1.1 operator 2FA fallback, matching the platform's WhatsApp-first support reality; deliberately not a launch dependency because template approval and business verification are real lead times, and WhatsApp capability of the enrolled number must be validated. Note the second-order risk the red team surfaced: WhatsApp registration itself rides on SMS, so WhatsApp codes never serve as the recovery path for a WhatsApp-2FA seat (channel separation, spec 3.2.7).
7. **Daily-use B2B friction is solved with device trust and sessions, not weaker auth** (FareHarbor 14-day sessions plus remember-device; Booking.com per-device trust). Confidence: high. Used in: 30-day device trust, 14-day rolling session.
8. **Recovery design decides whether mandatory 2FA locks out the people it protects** (backup codes at GYG, backup phone at Booking, role-gated company recovery phone at FareHarbor). Confidence: high. Used in: backup codes plus WhatsApp-verified support reset.
9. **Forced account creation is a conversion killer: 19% of US online shoppers abandoned an order in the past quarter because the site wanted an account** (Baymard, current figure, September 2025 update; earlier rounds measured 24 to 26%). Confidence: high. Used in: travelers never create accounts or passwords; the pair just works.
10. **Login form mechanics are standards-grade, not taste:** labels above fields, autocomplete attributes, show-password toggle (GOV.UK removed confirm-password fields after adding it), paste-friendly `one-time-code` inputs (Goibibo cut OTP retries 25% with auto-fill). Confidence: high. Used in: shared principles 1.3.
11. **Account enumeration prevention requires identical message, status, and timing** (OWASP). Confidence: high. Used in: every recovery flow's "if that email exists" phrasing and the DoD test.
12. **Magic links are fragile where codes are robust** (corporate scanners consume one-time links, cross-browser opens break sessions; NN/g documents the app-switching cost). Confidence: medium-high. Used in: codes over links everywhere a choice existed.
13. **Social login buys little here and costs recovery clarity** (Airbnb removed Facebook Login; Apple relay addresses break support lookups; conversion-lift claims are vendor-sourced). Confidence: medium-high. Used in: exclusion 6.1.
14. **Hidden admin URLs are not a control; server-side authorization is** (OWASP security principles; Google `hd` server-side validation requirement). Confidence: high. Used in: 4.1.

## 4. Decision log

| # | Decision | Driven by |
|---|---|---|
| D1 | Three separate doors on three URLs, one design language | Finding in Section 1; OTA convention; cookie/CSP isolation |
| D2 | Traveler surface implements 6.4 verbatim: pair login, no passwords, no sign-up | Master lock; findings 1, 9 |
| D3 | Enumeration-proof responses everywhere, tested in DoD | Findings 2, 11 |
| D4 | Reference recovery by email, always-positive response | Airline/Expedia "forgot reference" convention; finding 11 |
| D5 | Traveler step-up email code deferred to v1.1 (O2) | Finding 1; v1 accounts hold single bookings; master locks the pair as credential |
| D6 | Operator: mandatory 2FA, per-person seats, roles, owner-gated payouts | Findings 3, 4 |
| D7 | Operator 2FA channels: TOTP plus backup codes in v1 (white-glove enrollment at launch scale), WhatsApp code fallback in v1.1, no SMS, no email codes | Findings 5, 6; GYG precedent on strict channels; YAGNI at 25 operators |
| D15 | Channel separation: a seat's recovery path never uses its 2FA channel | Red-team finding on WhatsApp dual-role takeover |
| D16 | Invoice and cross-booking views behind an email-code step-up from v1 | Red-team insider path: operators legitimately hold traveler email plus reference pairs |
| D8 | 30-day device trust, 14-day rolling session, step-up on money mutations | Finding 7; Viator/Peek step-up precedent |
| D9 | Recovery: backup codes, then WhatsApp-verified admin reset against E.6 `contact_phone` | Finding 8 |
| D10 | Anti-phishing line adapted from the 6.5 email line onto the portal | Finding 4; one sentence, two audiences, same platform voice |
| D11 | Admin: Google Workspace SSO only, `hd` claim plus allowlist server-side, MFA at the IdP | Findings 14, Section 2 admin research |
| D12 | Supabase-native everything, no custom crypto; RLS `aal2` and role claims | Supabase docs; small-team maintainability |
| D13 | No SMS anywhere on the platform's auth | Finding 5 |
| D14 | No app-level passkeys in v1; staff get phishing resistance via the IdP today | Supabase experimental status; NIST AAL2 satisfied at Google |

## 5. What we deliberately did not copy

- **Booking.com's SMS-first 2FA:** their scale justifies PSTN costs and their phishing history shows SMS 2FA did not stop session-theft malware anyway. TOTP plus WhatsApp fits our operators better.
- **Airbnb's single account with host mode:** elegant at their scale, but it welds the weakest consumer recovery path to the strongest attack target. Separate seats are simpler and safer at 25 tours.
- **Klook's account-required-to-book:** the exact pattern Baymard's abandonment data punishes; the platform's guest-first checkout already rejects it.
- **KAYAK-style passkey-first:** right direction, wrong year for this stack (Supabase experimental, SSO-user limitation). Revisit at V2.
- **CAPTCHA-by-default and security questions:** friction theater; NIST and OWASP both point at throttling, MFA, and monitoring instead.
- **WhatsApp OTP at launch:** right channel, wrong moment. Meta template approval and business verification are real lead times, and 25 operators can be white-glove enrolled on authenticator apps faster than the integration ships. It returns as v1.1.

## 6. Measurement plan

1. Traveler: pair-login success rate, reference-recovery volume (a proxy for email findability), lockout rate, WhatsApp-assist rate.
2. Operator: 2FA method mix (TOTP vs WhatsApp), remember-device adoption, median login time, recovery volume, step-up friction on payout changes.
3. Security: failed-attempt patterns per surface, enumeration-probe detection, audit-log review cadence (monthly), time-to-revoke on seat removal.
4. Admin: allowlist size vs actual actors, denied-login events, re-auth frequency on destructive actions.

## 7. Sources

Primary sources, verified July 3, 2026 unless noted.

- Expedia One Key identity framework: https://medium.com/expedia-group-tech/creating-one-identity-building-the-framework-for-one-key-b04054c4d22
- Airbnb login methods / Facebook removal: https://www.airbnb.com/help/article/3530 and https://www.airbnb.com/help/article/3847
- Booking.com extranet login and 2FA: https://partner.booking.com/en-gb/help/account-and-login/settings/logging-your-bookingcom-extranet
- Booking.com account security (registration 2FA, anti-phishing line): https://partner.booking.com/en-us/help/legal-security/security/securing-your-account
- Krebs on Security, partner phishing economy: https://krebsonsecurity.com/2024/11/booking-com-phishers-may-leave-you-with-reservations/
- Microsoft Storm-1865 phishing: https://www.microsoft.com/en-us/security/blog/2025/03/13/phishing-campaign-impersonates-booking-com-delivers-a-suite-of-credential-stealing-malware/
- Sekoia, "I Paid Twice": https://blog.sekoia.io/phishing-campaigns-i-paid-twice-targeting-booking-com-hotels-and-customers/
- GetYourGuide supplier 2FA: https://supply.getyourguide.support/hc/en-us/articles/13980969689117
- FareHarbor 2-step verification: https://help.fareharbor.com/hc/en-us/articles/40897681313563-2-step-verification
- Viator partner 2FA step-up: https://partnerhelp.viator.com/en/articles/289-what-actions-will-prompt-me-to-input-a-2fa-code
- Peek Pro login and MFA: https://support.peek.com/hc/en-us/articles/48457433480084-How-to-Log-Into-Peek-Pro
- Checkfront 2FA: https://support.checkfront.com/hc/en-us/articles/4686250715803
- Rezgo MFA: https://support.rezgo.com/kb/how-to-enable-two-factor-authentication-for-your-users/
- Rezdy secure sign-in: https://support.rezdy.com/hc/en-us/articles/19867756219932-Secure-Sign-In-for-Rezdy-Users
- NIST SP 800-63B-4 (final, July 2025): https://pages.nist.gov/800-63-4/sp800-63b.html and https://csrc.nist.gov/pubs/sp/800/63/b/4/final
- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP ASVS 5.0 authentication chapter: https://github.com/OWASP/ASVS/blob/master/5.0/en/0x15-V6-Authentication.md
- OWASP security principles (obscurity): https://devguide.owasp.org/en/02-foundations/03-security-principles/
- Supabase MFA: https://supabase.com/docs/guides/auth/auth-mfa
- Supabase passkeys (experimental): https://supabase.com/docs/guides/auth/passkeys
- Supabase RBAC / custom access token hook: https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac and https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
- Google OIDC hd validation: https://developers.google.com/identity/openid-connect/openid-connect
- web.dev sign-in form best practices: https://web.dev/articles/sign-in-form-best-practices
- web.dev SMS OTP form / WebOTP: https://web.dev/articles/sms-otp-form and https://web.dev/case-studies/goibibo
- Yahoo! JAPAN passwordless case study: https://web.dev/case-studies/yahoo-japan-identity
- KAYAK passkeys: https://developers.googleblog.com/how-kayak-reduced-sign-in-time-by-50-and-improved-security-with-passkeys/
- GOV.UK show-password research: https://technology.blog.gov.uk/2021/04/19/simple-things-are-complicated-making-a-show-password-option/
- NN/g passwordless tradeoffs: https://www.nngroup.com/articles/passwordless-accounts/
- NN/g login walls: https://www.nngroup.com/articles/login-walls/
- Baymard cart abandonment (19% account-creation figure, updated Sep 2025): https://baymard.com/lists/cart-abandonment-rate
- CCC PNR insecurity coverage: https://www.techspot.com/news/67625-flight-reservations-can-easily-hacked-last-name-pnr.html
- Booking.com confirmation plus PIN: https://x.com/bookingcom/status/1531606798356123650
- British Airways manage-booking reference help: https://www.britishairways.com/travel/mmbfaqs/public/en_gb
- Expedia guest booking search: https://www.expedia.com/trips/booking-search?view=SEARCH_BY_ITINERARY_NUMBER_AND_EMAIL
- Meta WhatsApp authentication templates: https://developers.facebook.com/docs/whatsapp/business-management-api/authentication-templates/
- SMS pumping context: https://commsrisk.com/elon-musk-says-twitter-lost-60mn-a-year-because-390-telcos-used-bot-accounts-to-pump-a2p-sms/

Known weak spots, stated openly: the X/Twitter ~$60M SMS-pumping figure is an unverified company claim (the withdrawal of free SMS 2FA is verified); the $5,000 partner-account figure is a crime-forum buy offer, not a confirmed sale price; Krebs notes it is unclear whether Booking.com's 2FA mandate covers legacy partners; KAYAK's password elimination is a stated plan, not an independently confirmed completion; magic-link folklore numbers (Slack, Substack) were found untraceable and are not used anywhere in this design; Viator's consumer login methods were not verifiable from primary sources this session and are not load-bearing.
