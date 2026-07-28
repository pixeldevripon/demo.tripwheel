---
name: confirmed_secure_password_change_flow
description: 2026-07-28 review of the two-step (verify-password then email-confirm) password-change feature - what's solid, and the two real gaps found
metadata:
  type: project
---

Reviewed `backend/src/users/user.service.ts` (`requestPasswordChange` / `confirmPasswordChange`),
`user.controller.ts`, `dto/user.dto.ts`, `prisma/user.prisma` (`PasswordChangeRequest`), the
`20260728050649_password_change_confirmation` migration, the mail template, and the dashboard's
`app/_actions/userActions.ts` + `components/profile/confirm-password-change-client.tsx` +
`app/(app)/profile/confirm-password-change/page.tsx`.

**Solid, worth reusing:**
- Token: `randomBytes(32)` (256-bit), stored only as `sha256` hex (`hashToken`), raw token never
  persisted. New password is pre-hashed with Better Auth's own `ctx.password.hash` at request time
  and parked - the credential account is untouched until confirm.
- Single-use consumption is a guarded `deleteMany({ where: { id } })` + `count === 0` check before
  applying - the same atomic-consume idiom as [[pattern_atomic_consume_updateMany]], just
  delete-based instead of update-based. Concurrent double-clicks correctly can't both apply.
- Uniform `BadRequestException` for unknown/expired/already-used token - no oracle.
- Failed `verifyPassword` never sends an email and never spends the request budget (checked before
  `targetLimiter.consume`) - correct ordering, matches the in-code comment's stated intent.
- `RequestPasswordChangeDto` has no `email`/`userId` field - actor id/email always come from the
  session (`@AuthenticatedUser()`), never the body; `confirmPasswordChange` resolves `userId` from
  the token row, never the body. No IDOR surface on either step.
- Re-requesting correctly invalidates the previous link (upsert keyed on unique `userId` overwrites
  `tokenHash`, so the old hash no longer matches any row). `userId` and `tokenHash` are both unique
  in the schema/migration - no cross-user collision possible.
- Session revocation on confirm calls `ctx.internalAdapter.deleteSessions` (ALL sessions, including
  the confirmer's own) - correct given the design intent.
- Confirm endpoint's `@Throttle` (3/10s, 10/60s, 40/3600s) plus 256-bit token entropy makes
  token-guessing infeasible regardless of the rate limit.
- Email template escapes the name (`escapeHtml`) and never includes the new password or raw token
  outside the link; `confirmUrl` host comes from `dashboardAppBase()` (server env var
  `PORTAL_URL`), not attacker-influenced - no open-redirect vector.

**Two real gaps found (see [[pattern_better_auth_native_endpoints_bypass]] for #1):**
1. **Critical**: Better Auth's native `POST /api/auth/change-password` is still mounted (the
   catch-all in `auth.controller.ts` doesn't exempt it) and bypasses this entire two-step design -
   session + currentPassword is enough there, applied immediately, no email step.
2. **High (functional, undermines the documented "no session needed" design)**: the dashboard's
   `app/(app)/profile/confirm-password-change/page.tsx` sits inside the `(app)` route group, whose
   `layout.tsx` calls `getDashboardSession` and `redirect('/portal')` for anyone without a session -
   before the page (and its `?token=` query string) ever renders. Next's `redirect()` drops the
   query string, so a recipient opening the link on a device with no active dashboard session (the
   scenario the backend JSDoc explicitly designs for - "the link is routinely opened on a device
   with no dashboard session") gets bounced to login and the token is lost, not merely deferred.
   Fix: move that page (and its client component) to a route group with no auth-gating layout.

**Minor/informational noted, not blocking:** `timingSafeEqual` imported in `user.service.ts` but
never used (dead import - the actual lookup is a `findUnique` on a sha256 hash via a unique DB
index, so a manual constant-time compare isn't needed here, but the unused import should be
removed or explained); failed `verifyPassword` attempts on the *request* endpoint have no
dedicated per-account brute-force limiter (only the generous global `ThrottlerGuard` - 300/min
applies), unlike this same codebase's own `LookupRateLimiter`/`TargetRateLimiter` pattern used
elsewhere for exactly this kind of credential-guessing surface.
