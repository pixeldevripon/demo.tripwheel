---
name: project_change_email_flow_security
description: Better Auth two-mailbox change-email flow (commit e7d2081) — confirmed secure design + one unescaped-name HTML-injection bug in the confirmation template family
type: project
---

Reviewed 2026-07-28: the Better Auth change-email flow (backend `src/auth/auth.instance.ts`,
`src/mail/mail.service.ts` + `templates/email-verification.template.ts` +
`templates/change-email-confirmation.template.ts`, `test/auth.e2e-spec.ts`; dashboard
`components/profile/change-email-dialog.tsx` + `hooks/profile/use-email-change-landing.ts`),
all part of commit `e7d2081` ("per-door login enforcement, multi-hat accounts, email change,
hidden system admin").

**Confirmed secure / no action needed:**
- `decodeJwtPayloadUnsafe()` in `auth.instance.ts` is display-only (picks email copy variant by
  `requestType`); the actual token is always verified by better-auth's own `jwtVerify` before any
  email mutation happens. Tampering the unverified decode cannot forge a change.
- `callbackURL` open-redirect: better-auth 1.6.9's `originCheck`/`originCheckMiddleware`
  (`node_modules/better-auth/dist/api/middlewares/origin-check.mjs`) validates callbackURL against
  `trustedOrigins` on BOTH the POST `/change-email` (global `originCheckMiddleware`) and the GET
  `/verify-email` click-through (per-route `use: [originCheck(...)]`, which does NOT skip GET like
  the global one does). So the two-mailbox flow's redirect target is always trustedOrigins-gated —
  confirmed by reading the vendored source, not just trusting the code comment.
- Dashboard's `use-email-change-landing.ts`: toasts render as plain text via sonner (no
  `dangerouslySetInnerHTML`); `pending`/`currentEmail` interpolated into toast copy are
  app-controlled, not URL-reflected; storing the pending new-email string in localStorage is fine
  (not a credential).
- `test/auth.e2e-spec.ts` new click-through test correctly exercises the old-inbox confirmation
  link with NO session cookie (mail-client scenario) and asserts the email is untouched until both
  links are opened; taken-email enumeration-safety (silent fake 200) is also asserted.

**Bug found — HIGH, still open as of this review:**
`changeEmailConfirmationTemplate` (`backend/src/mail/templates/change-email-confirmation.template.ts:26`)
builds the greeting as `` name ? `Hi ${name},` : undefined `` — **not** escaped — while
`authEmailShell` (`auth-email-shell.ts:55`) interpolates `greeting` raw into the HTML body with no
escaping of its own (each template is individually responsible). Every sibling template
(`email-verification.template.ts:28`, `customer-welcome.template.ts:25`,
`operator-invite.template.ts:22`, `staff-invite.template.ts:49`) correctly does
`escapeHtml(name)`; `change-email-confirmation.template.ts` and `hat-added.template.ts:61` do not.
`user.name` is `@IsString()` with no `@MaxLength` (`src/users/dto/user.dto.ts`), so any
authenticated user can set it to `<img src=x onerror=...>` or arbitrary markup, then trigger
`sendChangeEmailConfirmationEmail` — HTML/script injection into the account's own change-email
confirmation inbox (self-XSS primarily, but same bug lets the user break the email's layout/inject
fake links, and `hat-added.template.ts`'s `name` comes from an admin-supplied `dto.name` when
inviting an existing email — same missing-escape bug there but admin-trusted input, lower priority).
Fix: `escapeHtml(name)` in both call sites, matching the established pattern.

**How to apply:** any NEW auth/mail template added to `src/mail/templates/` must be checked against
this specific pattern — `escapeHtml()` on every user-controlled string passed into
`authEmailShell`'s `greeting`/`paragraphs`, since the shell does not escape for you. Grep
`name ? \`Hi ${name}` across templates as a quick regression check.
