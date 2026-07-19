# Security Reviewer Memory Index

- [Operators module security patterns](operators-module-security.md) — Key findings from Tour Operator module review (June 2026)
- [Mail provider migration (SMTP->Resend)](mail_provider_migration.md) — unhandled-rejection crash in auth.instance.ts fire-and-forget hooks; cancellation-request HTML-injection now FIXED (re-checked 2026-07-19); confirmed secure patterns
- [Traveler-session flow](traveler_session_flow.md) — CRITICAL: PATCH /bookings/:id mints a session token from an unverified client-supplied email (no ownership proof) — cross-booking PII/cancellation-gate bypass; HIGH: calendar.ics leaks pickup address unmasked; CSRF gap on frontend session cookie route (2026-07-19)
