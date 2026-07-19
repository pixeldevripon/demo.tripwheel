---
name: mail_provider_migration
description: Security findings from the SMTP-to-Resend email migration review (2026-07-19) — unhandled-rejection crash pattern, HTML-injection gap, secure patterns worth reusing.
type: project
---

# Email provider migration (nodemailer -> Resend SDK) — 2026-07-19

Reviewed: `backend/src/mail/mail.service.ts` rewrite, `env.validate.ts` SMTP->RESEND_API_KEY swap,
`smtp_configuration` table drop (migration `20260719105425_resend_replaces_smtp`), settings
module SMTP endpoint/DTO removal, frontend SMTP settings-card removal.

## Confirmed Critical: fire-and-forget auth email hooks can crash the whole process

`backend/src/auth/auth.instance.ts` lines 38-62 (`sendResetPassword`, `sendVerificationEmail`
hooks) call `void mailService.sendXxxEmail(...)` with no `.catch()`. `MailService.sendMail`
(mail.service.ts) throws whenever Resend errors OR `RESEND_API_KEY` is unset — and
`RESEND_API_KEY` absence is only a **boot warning**, never a hard failure
(`env.validate.ts` — the email check only `console.warn`s). A rejected, un-caught promise from a
`void`-called async function is an **unhandled promise rejection**, and Node's default behavior
(confirmed via local repro on Node v25) is to crash the process. Net effect: if
`RESEND_API_KEY` is missing/invalid, or Resend has any transient error, the *first* unverified
sign-in or password-reset request takes down the **entire backend for every user**, not just the
requester. Pre-existing pattern (this file did not change in the migration diff — same crash risk
existed with nodemailer, since old sendMail also threw), but now more likely to be tripped because
Resend absence is soft-warn-only.
- **Fix pattern for next time it's touched:** attach `.catch((err) => logger.error(...))` on every
  `void mailService.send...()` call in `auth.instance.ts`, or make `RESEND_API_KEY` a hard
  `REQUIRED` env var in production (mirroring how `INTERNAL_API_SECRET` is hard-required in prod
  per `env.validate.ts`).
- Contrast: `backend/src/bookings/bookings.service.ts` does this correctly — every mail send there
  is `await`ed inside a `try/catch` (`sendConfirmationEmail`, `sendOperatorNotification`,
  `sendCancellationRequestNotices`), explicitly documented as "money already captured, a dead
  mailbox must never fail the booking." That's the pattern to point auth.instance.ts toward.

## Confirmed: unescaped HTML injection in the cancellation-request admin email

`MailService.sendCancellationRequestEmail` (mail.service.ts ~line 243-292) is the **one** email
builder in the module that assembles HTML via raw template-literal string concatenation instead of
going through `renderEmailTemplate()` (`templates/email-template.renderer.ts`), which HTML-escapes
every substituted value (`escapeHtml` in `substitute()` and in `[EACH]` item expansion). The
traveller-supplied `reason` field (from the public, unauthenticated
`POST /bookings/typ/:publicRef/cancellation-request`, `RequestCancellationDto.reason`, max 500
chars, no escaping) is interpolated straight into an HTML `<td>` via the `row()` helper — HTML/link
injection into the internal admin notification email. Pre-existing, not introduced by this
migration (unchanged in the diff), but flagged since it's the mail module's one exception to an
otherwise-secure escaping pattern.
- **Fix pattern:** either route this email through `renderEmailTemplate` with a proper template, or
  HTML-escape every interpolated field (`details.reason`, `details.guestName`, `details.tourName`,
  etc.) before building the string.

## Secure patterns confirmed (reuse/don't re-flag)

- `renderEmailTemplate` (`templates/email-template.renderer.ts`) escapes every `{token}`
  substitution and every `[EACH]` item via `escapeHtml()` — this is the correct pattern for any new
  transactional email template.
- `MailService.sendMail` only logs `error.name`+`error.message` from Resend (never contains the API
  key) and throws only `error.name` to callers; the global `AllExceptionsFilter`
  (`backend/src/common/filters/http-exception.filter.ts`) converts any non-`HttpException` to a
  generic `"Internal server error"` client-facing message while logging the full stack
  server-side — confirmed a plain `Error` thrown from `sendMail` does NOT leak Resend internals to
  HTTP clients (booking `resendConfirmation`/`requestCancellation` endpoints included).
  `RESEND_API_KEY` is read once in the constructor from `process.env` only, client built once, never
  serialized/logged/reachable via any response — clean secret handling.
- Migration SQL (`20260719105425_resend_replaces_smtp/migration.sql`) is a clean single
  `DROP TABLE IF EXISTS "smtp_configuration"` — no destructive collateral damage. Settings
  controller/service/DTO/swagger SMTP removal was complete (grepped for orphaned
  `UpdateSMTPDto`/`SMTPResponseDto`/`getSMTP`/`prisma.sMTP` references — none found). Frontend SMTP
  settings-card removal in both `frontend/` and the extracted dashboard repo was complete (grepped
  for stray `smtp` references in source — none besides build artifacts and migration filenames).
  `backend/.env` (gitignored, never committed to git history) had the old Gmail app password
  cleanly removed and now only holds `RESEND_API_KEY`/`MAIL_FROM`.
- Switching from raw-socket SMTP (nodemailer) to an HTTPS/JSON-based provider (Resend) removes the
  classic SMTP header/CRLF-injection surface by construction — subject/to/html are JSON fields, not
  concatenated SMTP command text.

## Minor hygiene noted

- An orphaned, empty (0-byte) migration folder `20260719105059_resend_replaces_smtp` sits next to
  the real one — leftover from an aborted `prisma migrate dev` run, untracked. Should be deleted
  before commit, not a security issue.
- Gmail App Password removed from `.env` was never in git history (verified: `.env` is gitignored,
  `git log --all -- backend/.env` returns nothing) — but deleting a credential from a local file
  does not revoke it at the provider (Google). If that app password was ever used against a real
  Gmail account, rotation/revocation via Google Account App Passwords settings is still warranted
  independent of the code change.

**Why:** Captures the one real crash-class bug (unhandled rejection in fire-and-forget auth email
hooks) so it isn't rediscovered from scratch, and the escaping-renderer pattern so future email
additions can be checked against it directly.
**How to apply:** Any future review of `auth.instance.ts` or of any new `MailService` method that
builds HTML by hand (not via `renderEmailTemplate`) should re-check these two spots first.
