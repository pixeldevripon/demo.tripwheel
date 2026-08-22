---
name: operators-module-security
description: Security findings from Tour Operator module review — June 2026. Key patterns, confirmed vulnerabilities, and secure designs to reuse.
type: project
---

# Operators Module Security Review — June 2026

## Confirmed Vulnerabilities

### HIGH: Cross-operator payment config read (no ownership on GET)
- `GET /:id/stripe-config` and `GET /:id/mollie-config` require `MANAGE_OPERATOR_PAYMENTS`
- `TOUR_OPERATOR` role holds `MANAGE_OPERATOR_PAYMENTS`
- `getStripeConfig` and `getMollieConfig` in `operators.service.ts` have no ownership check — only `findOne(operatorId)` to confirm existence
- Any authenticated TOUR_OPERATOR can read masked payment config (last 4 chars) of ANY operator
- Fix: add `assertOwnerOrAdmin(operator, requestingUserId, requestingUserRole)` to both GET payment config methods, same as the PATCH variants

### HIGH: Cross-operator profile read (VIEW_OPERATOR_PROFILE too broad)
- `GET /:id` and `GET /:id/company-info`, `GET /:id/social-media` require `VIEW_OPERATOR_PROFILE`
- `TOUR_OPERATOR` holds `VIEW_OPERATOR_PROFILE`
- Any TOUR_OPERATOR can enumerate and read any other operator's profile and company info by guessing/iterating UUIDs
- This is intentional UX for some read cases but should be documented as accepted risk or access-gated

### MEDIUM: Account enumeration on POST /operators (MANAGE_OPERATORS only)
- ConflictException leaks `"A user with email ${email} already exists"` — but endpoint is admin-only (MANAGE_OPERATORS)
- Lower risk because only admins reach it; acceptable as-is but should be noted

### MEDIUM: XSS via operator name in HTML invite email
- `operatorInviteTemplate` interpolates `name` directly into HTML: `Hi ${name},`
- Name is provided by admin at creation time — low external risk, but if name contains `<script>` or HTML tags, the email HTML is malformed/injectable
- `CreateOperatorDto.name` has `@MinLength(2)` and `@IsString()` but no `@MaxLength()` or sanitization
- Fix: HTML-escape `name` before interpolation in the template

### LOW: Missing `select:` on `update()` response
- `operators.service.ts update()` calls `prisma.operator.update({ where, data: dto })` with no `select:` clause
- Returns full Operator row including `cancellationRate90d`, `totalBookings`, `forceMajeurePardons`, `aggregatesUpdatedAt` — internal platform metrics not intended for API consumers
- Should add `select:` to match `findOne`'s explicit field list

### LOW: Missing `MaxLength` on free-text DTO fields
- `CreateOperatorDto.name` — no `@MaxLength()`
- `OperatorQueryDto.search` — no `@MaxLength()`
- `UpdateOperatorCompanyInfoDto` fields (companyName, companyCountry, companyCity, companyPhone) — no `@MaxLength()`
- `UpdateOperatorSocialMediaDto` URL fields — `@IsString()` but no `@IsUrl()` or `@MaxLength()`
- Could be used for DoS (very large payloads) or DB field overflow

### LOW: Proxy middleware does not verify session role for dashboard admin routes
- `proxy.ts guardDashboard` only checks `sessionData.session` exists, not the role
- A USER (traveler) with a valid session could access `/dashboard/` routes in the browser; backend enforces RBAC but dashboard pages would render
- Frontend RBAC is presentational only (correct by design) but no middleware role gate is present

## Confirmed Secure Patterns

### ADMIN hook bypass via seed is acceptable
- Seed creates user with default role, then does direct `prisma.user.update({ role: ADMIN })` bypassing the hook
- The hook only blocks ADMIN at **creation** time via `createUser` — it does not intercept Prisma direct updates
- This is the documented and correct pattern for seed-only admin bootstrap

### Invite-via-reset branch (request === undefined) is sound
- Better Auth `sendResetPassword` callback receives `request` as the HTTP request object
- Server-initiated (no HTTP context) calls arrive with `request = undefined`
- No attacker path to forge server-initiated context via HTTP; the only caller is `auth.api.requestPasswordReset` called internally from `OperatorsService.create`
- Attacker calling `/api/auth/forget-password` directly always carries an HTTP request

### Throwaway password + emailVerified:true is sound
- Throwaway password is 24 random bytes (base64url), never transmitted
- Only path to authenticate is via the invite link (password reset token, 1hr expiry)
- `emailVerified: true` is intentional — admin-vouched; no email token bypass
- `requireEmailVerification: true` would block login if set to false but the flag is correct here
- `revokeSessionsOnPasswordReset: true` means any old sessions are killed on invite acceptance

### Role escalation to ADMIN is blocked at two layers
- Layer 1: `user.role.input = false` in Better Auth config — role cannot be set via API request body
- Layer 2: `databaseHooks.user.create.before` throws if `role === Role.ADMIN`
- Layer 3: `MANAGE_OPERATORS` is required for operator creation; no operator endpoint sets `role` field

### Encryption of payment secrets is correct
- AES-256-GCM with 96-bit IV, proper auth tag, `ENCRYPTION_KEY` validated at startup via `env.validate.ts`
- Response masking shows only last 4 chars — appropriate

### `assertOwnerOrAdmin` correctly applied to all PATCH sub-resource endpoints
- `updateCompanyInfo`, `updateSocialMedia`, `updateStripeConfig`, `updateMollieConfig` all call `assertOwnerOrAdmin`
- The helper correctly blocks USER role entirely, allows TOUR_OPERATOR only for own record

**Why:** Recording to avoid re-reviewing these areas in future sessions and to track the known gap (GET payment config ownership).
**How to apply:** When reviewing future operator sub-resource endpoints, always verify GET variants have ownership checks identical to their PATCH counterparts.
