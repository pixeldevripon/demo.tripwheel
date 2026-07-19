# Staff & Teams - Complete Implementation Story

> Built 2026-07-19. Executes login doc Phase 2 (`technical-doc/login/03-login-implementation-plan.md`,
> see its EXECUTED block) and extends it with fine-grained per-person permissions.
> Backend: `island-tour-development/backend` - Dashboard: `tripwheel-x-islandtours-dashboard`.
> Security-reviewed and code-reviewed the same day; every finding fixed and re-verified live
> (section 12). Companion: `ROLES-AND-ACCESS-MANAGEMENT.md` (the base role/permission model).

---

## 1. The problem and the core design decision

The platform needed staff on **two sides**:

- **Admins** hire platform staff - support agents, content editors, operations managers - who
  work inside the marketplace dashboard with only the access they were given.
- **Tour operators** hire their own team - reservations desk, deck crew, managers - who work on
  that one operator's tours, bookings and profile, and nothing else.

Each person gets their **own login** (email + password, the existing Better Auth door - no shared
accounts), and each person's access is controlled **individually**: a reusable "Designation"
template plus per-person grant/revoke overrides.

The login doc specified an `operator_users` seats table for the operator side only. Both sides
need the exact same machinery (invites, templates, per-person permissions, suspension, audit), so
the implementation unifies them into **one model** where a single column decides the world a row
belongs to:

| `staff_members.operatorId` | Meaning | The user's platform `Role` |
|---|---|---|
| `NULL` | Platform (admin-side) staff | `STAFF` |
| set (FK to `operators.id`) | Operator team seat | `TOUR_OPERATOR` |

One table, one service, one permission engine, one dashboard page - the scope column does the
branching. The E.11 shape from the login doc (seatRole owner/manager/staff, status
invited/active/suspended, invitedBy, lastLoginAt) is preserved inside it.

---

## 2. Data layer

**Where:** `backend/prisma/staff.prisma` + `backend/prisma/enums.prisma`, applied by migration
`backend/prisma/migrations/20260719180644_staff_and_designations/migration.sql`.

### 2.1 New enums (`enums.prisma`)

```prisma
enum StaffSeatRole { OWNER MANAGER STAFF }   // intra-operator seat role (E.11)
// NOTE: MANAGER/STAFF is an ORGANIZATIONAL LABEL in v1 - selectable on the
// operator team UI and shown on the team list, but it carries no permission
// semantics: access always comes from the designation/overrides, and the
// UI copy says so explicitly ("A label shown on the team list - what this
// member can DO is set by the designation"). Real manager semantics (e.g.
// staff-seat management, step-up rules) are a later login-plan phase.
// OWNER is created only by operator create/backfill, never via the API.
// (History: the picker was briefly removed on 2026-07-19, then restored the
// same day by owner decision - with honest descriptions instead of hiding.)
enum StaffStatus   { INVITED ACTIVE SUSPENDED }
```

Plus two new `Permission` values:

- `MANAGE_STAFF` - manage platform staff + platform designations. Held by ADMIN only, and
  deliberately **outside every grant ceiling** so no staff member can ever be granted the right
  to manage staff (self-escalation guard).
- `MANAGE_TEAM` - manage an operator's own team. In the `TOUR_OPERATOR` role set (so owners hold
  it via the full role set) and ADMIN's; outside the seat ceiling, so non-owner seats can never
  be granted it (login doc: seat management is owner-only).

### 2.2 `StaffDesignation` - the permission template

```
id · operatorId (NULL = platform) · name · description · permissions Permission[]
isSystem (seeded defaults: delete/rename blocked) · createdById · timestamps
@@unique([operatorId, name]) · @@index([operatorId])
```

A designation is a named, reusable permission set: "Operations Manager", "Deck Crew". Platform
designations are admin-managed; operator-scoped ones belong to that operator's team.

**Postgres NULL gotcha, handled:** `@@unique([operatorId, name])` does not deduplicate rows where
`operatorId IS NULL` (NULLs are distinct in unique indexes). Platform-scope name uniqueness is
therefore enforced in the service (case-insensitive `findFirst` check → 409), with the DB
constraint still covering the operator scope and a `P2002` catch as the race fallback.

### 2.3 `StaffMember` - the person

```
id · userId (unique - one seat per account) · operatorId (NULL = platform staff)
seatRole (default STAFF) · designationId (SetNull on designation delete)
extraPermissions Permission[] · revokedPermissions Permission[]     ← per-person overrides
status (default INVITED) · invitedById · invitedAt · activatedAt · lastLoginAt · timestamps
Relations: user (Cascade) · operator (Cascade) · designation · invitedBy
Indexes: operatorId · status · designationId
```

Cascade rules matter for lifecycle: deleting the auth user removes the staff row; deleting an
operator removes its seats (and the service additionally deletes the seat users' accounts - see
6.4).

### 2.4 What the migration did (beyond DDL)

1. **Backfill:** every existing operator's login user became the `ACTIVE OWNER` seat of its own
   team (7 rows at migration time). Admin-owned auto-provisioned operator records were excluded -
   ADMIN accounts are never staff-managed. Going forward, `OperatorsService.create` writes the
   OWNER seat row for every new operator, so the seat model is uniform forever.
2. **Seeded 3 platform system designations** (`isSystem = true`):
   - *Operations Manager* - bookings/payments/review moderation/analytics (16 permissions)
   - *Content Editor* - catalog + editorial + media (18 permissions)
   - *Support Agent* - read-mostly support surface (13 permissions)
   None of them references the enum values added in the same migration (Postgres forbids using a
   new enum value inside the transaction that added it).

Related schema touches: `User` gained `staffMember StaffMember?` + `staffInvitesSent` relations;
`Operator` gained `staffMembers` + `staffDesignations`; `schema.prisma`'s file list comment names
`staff.prisma`.

---

## 3. The permission engine - the heart of the system

**Where:** policy in `backend/src/config/staff.config.ts`; runtime in
`backend/src/staff/staff-permissions.service.ts` (provided by the `@Global`
`staff-permissions.module.ts`).

### 3.1 The formula

A member's EFFECTIVE permissions are computed by one pure function,
`computeEffectivePermissions(parts)`:

```
(designation.permissions ∪ extraPermissions) − revokedPermissions
        ∩ CEILING (per scope)
        ∪ FLOOR
```

- **Designation** = the baseline ("she is a Support Agent").
- **extraPermissions** = individual grants on top ("...and she may approve reviews").
- **revokedPermissions** = individual removals from the template ("...but not delete bookings").
- **CEILING** = what may be granted at all, per scope (3.2). Applied at COMPUTE time, not only at
  write time - even a tampered DB row cannot re-grant an out-of-ceiling permission.
- **FLOOR** = `VIEW_PROFILE` + `EDIT_PROFILE`, always present for a non-suspended member (the
  minimum to load the dashboard shell and manage one's own profile), and **not revocable**.

Two special cases, both deliberate:

- **OWNER seats** (and the `Operator.userId` account itself) return the full `TOUR_OPERATOR`
  role set. Owners are not permission-managed; `revokedPermissions` on an owner row is ignored.
- **SUSPENDED** members return the **empty set**.

### 3.2 The ceilings (who may be granted what)

```
PLATFORM_STAFF_CEILING = ROLE_PERMISSIONS[ADMIN] minus:
  MANAGE_SYSTEM              (system administration stays with real ADMIN accounts)
  MANAGE_STAFF               (staff must never manage staff - self-escalation)
  MANAGE_TEAM                (operator-side concern)
  MANAGE_USERS, CREATE_USER, UPDATE_USER, DELETE_USER
                             (identity mutations are an escalation surface: a role flip hands
                              out an un-ceilinged static permission set; an email change
                              redirects password resets. VIEW_USERS stays grantable.)
  MANAGE_OPERATOR_PAYMENTS   (owner-only in the operators service anyway - listing it would
                              offer a permission that always 403s)

OPERATOR_SEAT_CEILING = ROLE_PERMISSIONS[TOUR_OPERATOR] minus:
  MANAGE_TEAM                (seat management is owner-only - login doc Phase 2 item 5)
  MANAGE_OPERATOR_PAYMENTS   (payout/bank config is owner-only)
```

The user-identity exclusions were added by the same-day security review (section 12) - they close
the one real escalation path found.

### 3.3 The fallback rules (what happens WITHOUT a staff row)

- `TOUR_OPERATOR` with no staff row → full role set (the operator account itself, pre-backfill or
  legacy; an operator-less user fails `resolveOperatorId` anyway).
- **`STAFF` with no staff row → the FLOOR only** - never the legacy static STAFF list from
  `roles.config.ts`. Why: otherwise anyone who could flip a user's role to STAFF would mint a
  broad-powered account without any admin ever assigning permissions. Power comes ONLY from an
  explicit designation/grant.
- Every other role (ADMIN, EDITOR, GUIDE, USER) → its static `ROLE_PERMISSIONS` set, with zero
  DB cost (short-circuit before any query).

### 3.4 The runtime service and its cache

`StaffPermissionsService.getEffectivePermissions({id, role})`:

1. Non-staff-manageable roles short-circuit to the static map (no query).
2. Otherwise one small `staff_members` read (with the designation's permissions included) feeds
   the pure function.
3. The result is cached **in-process for 60 seconds** per userId. Every staff mutation calls
   `invalidate(userId)`; designation permission edits call `invalidateAll()` (a template edit
   affects every holder). Because service and guard share ONE instance (the module is `@Global` -
   providing it anywhere else would fork the cache), changes apply on the very next request.

`hasPermissions(user, required)` returns `{granted, missing}` for the guard's error message.

**Why one pure function matters:** the guard path AND the API responses (`effectivePermissions`
echoed on every member object, section 6.1) both call `computeEffectivePermissions`, so what the
dashboard displays and what the server enforces can never drift.

**Known limit (accepted, documented):** the cache is per-process. On the current single-VPS
deployment that is correct; before the backend ever runs multi-instance, invalidation must move
to a shared store (Redis pub/sub or key check). Suspension is NOT affected by this limit - it
also deletes sessions and is re-checked live by AuthGuard on every request.

---

## 4. Enforcement on every request - the guard chain

Order (unchanged, Critical Rule): `ThrottlerGuard → AuthGuard → RolesGuard → PermissionsGuard`.

### 4.1 AuthGuard (`src/auth/guards/auth.guard.ts`) - two changes

1. `getSession` is now called with **`query: { disableCookieCache: true }`**. Better Auth's
   cookie cache serves a signed session snapshot for up to 5 minutes without touching the DB -
   which live smoke-testing proved would keep a REVOKED session working for up to 5 minutes
   after suspension. Guarded API routes now always validate against the session store.
2. Any session whose user is `SUSPENDED` or `DELETED` is rejected with 401 - a status flip bites
   even in the race window before session deletion lands, and covers bearer tokens too.

### 4.2 PermissionsGuard (`src/auth/guards/permissions.guard.ts`)

Was: synchronous lookup in the static `ROLE_PERMISSIONS[role]` map.
Now: `async`, injects `StaffPermissionsService`, and checks the required permissions against the
caller's EFFECTIVE set. Missing permissions still produce the same
`Missing permissions: X, Y` 403. Routes without `@RequirePermissions` pass untouched.

Because the whole API is permission-gated (no live `@Roles()` usage anywhere - verified), this
single guard change makes fine-grained staff permissions work across every existing module -
tours, destinations, categories, collections, media, settings, reviews - without touching any of
them.

### 4.3 Service-level scoping - `resolveOperatorId`

**Where:** `src/common/utils/operator.util.ts` (the shared util used by tours, availability,
bookings, payments, reviews, tiers, notifications; `tours.service.ts`'s private copy now
delegates to it).

Resolution order:

1. `Operator.userId` direct match → the owner account.
2. **NEW:** an ACTIVE (non-suspended) `staff_members` seat → that seat's `operatorId`. This one
   change makes every existing ownership check in the tour domain scope seats to their operator's
   rows automatically.
3. An ADMIN with neither gets an operator record auto-provisioned (unchanged, rule 19).
4. Anyone else → 400 "complete your operator registration".

So the two layers on any request are: *permission* answers "may this person do this kind of thing
at all" (guard), *scoping* answers "on whose data" (service) - independent, both server-side.

### 4.4 Owner-only vs member-level operator resources

**Where:** `src/operators/operators.service.ts`.

- `assertOwnerOrAdmin` (unchanged semantics): **payout config** - Stripe/Mollie get/update. Team
  seats, even managers, never pass. (Login doc: payout/bank is owner-only.)
- `assertMemberOrAdmin` (new): **profile-level resources** - operator detail, company info,
  social media. Passes the owner, an admin, or an ACTIVE seat *of that same operator*. The
  PermissionsGuard has already checked the fine-grained permission
  (e.g. `EDIT_OPERATOR_PROFILE`); this only pins the caller to their own operator. A seat
  without the profile permissions still gets 403 - both layers must pass (verified live).

---

## 5. The API surface

**Where:** `backend/src/staff/` following the standard module pattern
(`dto/staff.dto.ts`, `staff.swagger.ts`, `staff.service.ts`, `staff.controller.ts`,
`staff.module.ts`). Registered in `AppModule` together with the `@Global`
`StaffPermissionsModule`. Controller declares every static segment
(`permission-catalog`, `designations`, `team`, `invite`) BEFORE the dynamic `:id` routes
(NestJS matches top-to-bottom).

Base URL `http://localhost:5050/api/v1`.

### 5.1 Shared

| Route | Guard | Purpose |
|---|---|---|
| `GET /staff/permission-catalog?scope=platform\|team` | `VIEW_PERMISSIONS` | Grouped, human-labeled permission catalog **already intersected with the requested scope's ceiling**, plus the flat `ceiling` and the `base` floor. Feeds the matrix UI, so it physically cannot offer an ungrantable permission. |

### 5.2 Platform staff (admin) - all `@RequirePermissions(MANAGE_STAFF)` (ADMIN-only by ceiling)

| Route | Purpose |
|---|---|
| `GET /staff` | Paginated members list (search name/email, status + designation filters) |
| `POST /staff/invite` | Provision + invite (6.1) - body: email, name, designationId?, extraPermissions? |
| `GET /staff/:id` | One member incl. `effectivePermissions` |
| `PATCH /staff/:id` | Designation (nullable to clear) + extra/revoked overrides |
| `PATCH /staff/:id/status` | ACTIVE ⇄ SUSPENDED (7.1) - INVITED is never settable manually |
| `POST /staff/:id/resend-invite` | INVITED members only; human-pace throttled (1/10s, 3/min, 10/hr) |
| `DELETE /staff/:id` | Remove member + their login account |
| `GET/POST /staff/designations`, `PATCH/DELETE /staff/designations/:id` | Platform designation CRUD |

### 5.3 Operator team - all `@RequirePermissions(MANAGE_TEAM)` (owners + admins)

Same shapes under `/staff/team[...]` and `/staff/team/designations[...]`. Owners are
auto-resolved to their own operator; **admins must pass an explicit `operatorId`** (body on
POST/PATCH, query on GET/DELETE/resend) - `resolveTeamOperatorId` throws 400 for an admin
without it, 403 for an owner passing a foreign one, and 404 pins every `:id` to the resolved
operator (no cross-tenant reads or writes; verified by the security review and live).

Team-only extras: invites create `TOUR_OPERATOR`-role users with `seatRole` MANAGER | STAFF
(default STAFF - an organizational label only, see 2.1). **OWNER can never be created, edited,
suspended or removed through this API**; the owner is managed via the operators module.

### 5.4 Service rules enforced on every mutation

- `assertWithinCeiling` rejects any permission array containing out-of-ceiling values with an
  explicit 400 naming the offenders (defense-in-depth on top of compute-time capping).
- Designations: platform-name dedup in service + DB unique for operator scope (2.2); `isSystem`
  rows reject rename/delete (403) but allow permission edits; delete while `memberCount > 0` is
  409; designation references are validated to belong to the same scope (400 otherwise).
- Self-protection: you cannot suspend or remove your own account (400).
- Every mutating action writes a `Logger` line with the actor id.

### 5.5 Hardened alongside (pre-existing gaps found by live smoke)

- `GET /bookings` and `GET /bookings/:id` were **auth-only** (no permission requirement; service
  scoped rows by role, with STAFF falling into the traveler branch). Now both require
  `VIEW_BOOKINGS`; `isPlatformWideBookingRole()` (ADMIN/STAFF/EDITOR - one helper used by both
  `list` and `assertCanView` so the scopes can't drift) grants platform-wide read to holders;
  operators stay operator-scoped; travelers never call these routes (verified: zero frontend
  consumers - the traveler surface is the public TYP/lookup routes).

---

## 6. The invite lifecycle - step by step

### 6.1 Invite

1. Admin/owner submits the invite dialog → `POST /staff/invite` or `POST /staff/team/invite`.
2. **`provisionInvitedAccount`** (`src/common/utils/invite-provisioning.util.ts` - ONE shared
   implementation used by operator creation, platform staff and team invites; extracted by the
   code review from two near-identical copies):
   - normalizes the email (lowercase/trim), 409 if a user already exists;
   - creates the auth user with the correct role (`STAFF` or `TOUR_OPERATOR`) and
     `emailVerified: true` (admin/owner-vouched; ownership is re-proven by the invite link);
   - links a **throwaway credential**: 24 random bytes, hashed, never displayed or transmitted -
     it exists only so the reset flow has a credential account to overwrite;
   - rolls back the user if the credential link fails.
   The Better Auth `user.create.before` hook's `allowedRoles` was extended with `Role.STAFF`
   (it previously coerced unknown roles to TOUR_OPERATOR); ADMIN creation stays blocked at
   runtime.
3. The `staff_members` row is created: scope, seatRole (team: MANAGER/STAFF label, default
   STAFF - see 2.1; platform: always STAFF), status `INVITED`, designation + extraPermissions
   (ceiling-validated), `invitedById` for audit.
4. **Invite email (dynamic per audience):** the service calls
   `auth.api.requestPasswordReset({ email, redirectTo: getPortalUrl() + '/reset' })`
   server-side. The `sendResetPassword` hook in `auth.instance.ts` sees there is no originating
   HTTP request → server-initiated → and because every invite flow creates the `staff_members`
   row BEFORE firing the reset, the hook looks that row up (designation name, seatRole,
   operator company name) and picks the right copy:
   - `operatorId` NULL → **platform staff invite** (`staff-invite.template.ts`, variant
     `platform`): "You're invited to join the Island Tours team" + "as {designation}" when one
     was assigned;
   - `operatorId` set, seatRole MANAGER/STAFF → **team-seat invite** (variant `team`):
     "You're invited to join {companyName}'s team" + "as {designation or seat-role label}";
   - OWNER seat or no staff row → the original **operator-invite template** ("invited as a tour
     operator") - the business-owner case it was written for.
   Subjects are dynamic the same way; all interpolations are HTML-escaped; resend-invite goes
   through the same hook so it is automatically correct too. Fire-and-forget with `.catch`
   logging - a mail-provider outage cannot fail the invite API.
5. Any failure after user creation rolls back via `internalAdapter.deleteUser` (removes
   sessions/accounts; the staff row cascades) - no orphans.

### 6.2 Accept

6. The invitee opens the link → the **surface-matched reset screen**: platform staff land on
   `/staff/reset`, team seats and operators on `/portal/reset`
   (`StaffService.resetRedirectFor(operatorId)`; the staff base URL is derived from
   `PORTAL_URL` by swapping the `/portal` path segment - `getStaffUrl()` in
   `invite-provisioning.util.ts`, so one env var still configures the app). They set their own
   password (min 12 chars); `revokeSessionsOnPasswordReset` applies as everywhere.
7. They sign in at their door - `/staff` for platform staff, `/portal` for seats/operators.
   The two doors hit the same Better Auth backend (there is no separate staff auth system -
   the full 3-door split, 2FA and SSO are later login-plan phases); the separation is surface
   branding + noindex, never a security control.

### 6.3 Activate

8. On successful sign-in, the Better Auth `databaseHooks.session.create.after` hook stamps
   `lastLoginAt = now` and flips `INVITED → ACTIVE` (+ `activatedAt`) via two `updateMany` calls
   (no-ops for non-staff users), wrapped in try/catch so bookkeeping can never break a login.
9. The dashboard layout resolves their role + EFFECTIVE permissions (section 9) and renders
   exactly the nav and actions their grants cover.

### 6.4 Remove / operator deletion

- Removing a member deletes the login account (`internalAdapter.deleteUser` - sessions and staff
  row cascade), then invalidates the permission cache. OWNER seats are refused (403).
- Deleting an OPERATOR (operators module) now also deletes its team-seat user accounts (they are
  `TOUR_OPERATOR` users who would otherwise linger with live sessions and no operator), then the
  owner user as before.

---

## 7. Suspension - why it is immediate everywhere

### 7.1 What `PATCH .../:id/status { SUSPENDED }` does

1. `staff_members.status = SUSPENDED` (the engine now computes the empty set for them).
2. `user.status = SUSPENDED` (the account-level flag).
3. **`session.deleteMany`** - every live session dies.
4. Permission-cache `invalidate(userId)`.

### 7.2 The three independent locks that then hold

- **Existing sessions:** dead instantly - AuthGuard checks the session STORE
  (`disableCookieCache`), and the sessions are gone. (The live smoke found the cookie cache
  keeping a deleted session alive ≤5 min; that is exactly why the flag exists.)
- **Re-login:** refused by the `databaseHooks.session.create.before` hook with an
  `APIError('FORBIDDEN', 'This account has been suspended.')` - a clean 403, and safe to name
  the reason because the hook only runs AFTER the password already verified (no enumeration).
- **Belt-and-suspenders:** even with a session, AuthGuard 401s SUSPENDED/DELETED users, and the
  effective permission set of a suspended member is empty.

Reactivation (`ACTIVE`) restores `user.status`, restores the staff row, stamps `activatedAt` if
they had never logged in, and invalidates the cache. The member logs in again normally.

### 7.3 Unified with the users module (review fix)

`PATCH /users/:id/status` and the `status` field of `PATCH /users/:id` previously flipped ONLY
`user.status`. `user.service.ts` now runs the same `syncStatusSideEffects` (session kill +
staff-row mirror + cache invalidation) so the two suspension paths can never drift.

---

## 8. Live-proven data scoping (what a seat actually sees)

From the end-to-end smoke against the running backend with real logins:

| Check | Result |
|---|---|
| Invited platform staff with "Operations Manager" | `effectivePermissions` = 16 (template + floor) |
| Staff `GET /bookings` with `VIEW_BOOKINGS` granted | 200, platform-wide (total 254) |
| Same staff, `VIEW_BOOKINGS` revoked via override | 403 on the very next request |
| Staff `GET /staff` (MANAGE_STAFF gated) | 403 always (outside ceiling) |
| Owner invites seat with `MANAGE_OPERATOR_PAYMENTS` | 400 naming the permission |
| Seat (VIEW_BOOKINGS granted) `GET /bookings` | 200 but **operator-scoped: 70 rows**, identical to the owner's view, not the platform's 254 |
| Seat `GET /staff/team` | 403 (MANAGE_TEAM outside seat ceiling) |
| Seat `GET /operators/:id/stripe-config` | 403 (owner-only gate) |
| Seat `GET /operators/:id/company-info` w/o profile permission | 403 (fine-grained layer) |
| Admin `GET /staff/team` without `operatorId` | 400 |
| Suspend → existing session · re-login | 401 instantly · 403 |
| INVITED → first login | status ACTIVE, `activatedAt` + `lastLoginAt` stamped |

---

## 9. The dashboard - one page, two audiences

**Where:** `tripwheel-x-islandtours-dashboard`.

### 9.1 Effective permissions reach the UI

- `app/_actions/userActions.ts` `getUserProfile` now fetches **`GET /users/me/permissions`** in
  the same `Promise.all` as the session + `/users/me` - the backend-computed EFFECTIVE set. On a
  transient failure it stays `undefined` (never cached wrong).
- `app/(app)/layout.tsx` passes it to `DashboardShell` → `RoleProvider`
  (`contexts/role-context.tsx`) → `useRole()` exposes `{ role, permissions, can, canAny }`.
- **Consequence:** every pre-existing `useRole().can()` gate in the dashboard - add buttons, row
  deletes, danger zones, settings branches - and the sidebar's `filterNavGroups` automatically
  honor fine-grained staff grants, with zero changes to those components.
- **Fallback rule:** if the fetch fails, ADMIN/operator fall back to the static
  `lib/config/rbac.ts` mirror (correct for them); a **STAFF user falls back to the profile-only
  floor** (RoleProvider) / empty nav (app-sidebar) - never the broad legacy static STAFF list.
  The client set is cosmetic either way; the backend guards enforce regardless.
- `lib/config/rbac.ts` mirrors the backend map: `MANAGE_STAFF`/`MANAGE_TEAM` added, ADMIN holds
  both, TOUR_OPERATOR holds MANAGE_TEAM.

### 9.2 The staff login surface (`/staff/*`) - separate from the portal

The staff door has its **own three screens**, never shared with the operator portal:

- `app/(login)/staff/layout.tsx` - a dark, near-monochrome takeover shell (logo + "STAFF
  ACCESS" chip + "Island Tours staff only. Every sign-in and action is logged."), deliberately
  NOT the portal's orange split-screen. It persists across `/staff`, `/staff/forgot` and
  `/staff/reset`; navigation swaps only the card (MountReveal keyed by pathname).
- `/staff` → `staff-login.tsx`: clean sign-in card ("Use the staff account from your invite
  email" + anti-phishing line). The old Google-SSO mockup remnants were removed; SSO returns
  for real in login-plan Phase 5.
- `/staff/forgot` → `staff-forgot.tsx`, `/staff/reset` → `staff-reset.tsx`: staff-worded
  screens whose links stay inside the staff door.
- The form/card logic is shared, not duplicated: `AuthForm` takes a `variant` prop
  (`'staff'` pins the `/staff/forgot` link, the monochrome `staffBtn` and staff placeholder);
  `forgot-card.tsx` / `reset-card.tsx` hold the enumeration-proof request and
  token/expiry/success state machines once, with `operator-*`/`staff-*` components as thin
  copy/route wrappers.

### 9.3 The `/users` route (labeled "Users" - owner decision)

The management page lives at **`/users`** and is presented as **Users** in the nav and page
header (it replaced the old placeholder stub on that route; the short-lived `/team` route was
removed). `navigations/navigations.ts` adds **Users** (UserGroupIcon, Account group) gated by
`[MANAGE_STAFF, MANAGE_TEAM]` (any-of). Non-owner seats hold neither → the item never renders;
`components/staff/team-view.tsx` re-checks as the belt for hand-typed URLs. The module and its
components keep their Staff & Teams names - only the user-facing label says "Users" for now.

Role branch: `ADMIN` + `can(MANAGE_STAFF)` → **platform scope**; otherwise `can(MANAGE_TEAM)` →
**team scope**. Both render the same two tabs.

### 9.4 Components (`components/staff/`)

| File | What it does |
|---|---|
| `team-view.tsx` | Scope branch + header + Members/Designations tabs |
| `staff-members-tab.tsx` | `useTableState` (URL-synced page/limit/search/status) + `useStaffMembers` + `DataTable`; invite button; wires the sheet + dialog |
| `staff-columns.tsx` | Member (avatar/name/email), Designation (Owner label / name / "Custom permissions"), Seat (team scope), permission count, `STAFF_MEMBER_STATUS` badge (added to `components/common/status-maps.ts`: INVITED=info, ACTIVE=success, SUSPENDED=danger), last login, actions |
| `staff-row-actions.tsx` | Edit access · Resend invite (INVITED only) · Suspend/Reactivate · Remove (shared `ForceDeleteDialog`). **OWNER rows render no actions at all** |
| `staff-invite-dialog.tsx` | react-hook-form + zod (name, email), seat-role select (team scope, with honest per-option descriptions - see 2.1), designation select. Deliberately minimal - an invite is a 10-second action; fine-tuning lives in Edit access |
| `staff-member-sheet.tsx` | "Edit access": designation select + seat-role select (team scope) + the matrix showing the member's **would-be effective set**. Picking a designation resets the matrix to that template; manual ticks are saved as diffs: `extra = checked − template`, `revoked = template − checked` - the exact mirror of the backend formula (reviewer-traced, no drift) |
| `designations-tab.tsx` | Designation cards (name, System badge, description, permission/member counts), create/edit/delete; delete disabled while in use |
| `designation-dialog.tsx` | Create/edit with the matrix; System designations lock name/description but allow permission edits |
| `permission-matrix.tsx` | The shared grouped checkbox matrix fed by the catalog endpoint: per-group tri-state select-all, counts, locked (floor) permissions rendered checked + disabled. Since the catalog is ceiling-intersected server-side, the UI cannot even offer an ungrantable permission |

### 9.5 Data layer

- `types/staff.ts` - mirrors `staff.dto.ts` (ListItem/Paginated/Detail/Payload convention + label maps).
- `lib/api/staff.ts` - one client, `base(scope)` picks `/staff` vs `/staff/team`; `operatorId`
  placement (body on POST/PATCH, query on GET/DELETE/resend) matches the backend on all 12
  endpoints (reviewer-verified).
- `hooks/staff/use-staff.ts` - TanStack Query key factory (`staffKeys`), `keepPreviousData` on
  lists, toast-in-hook, invalidation per convention (designation edits invalidate everything -
  a template edit changes every holder's effective set).

---

## 10. Environment variables

**None added.** The module rides existing configuration only:

| Var | Used for | Status |
|---|---|---|
| `DATABASE_URL` | Prisma (schema + all reads/writes) | existing |
| `BETTER_AUTH_URL` / `BETTER_AUTH_SECRET` | sessions, reset tokens | existing |
| `RESEND_API_KEY` + `MAIL_FROM` | the invite email (from the same-day Resend migration). Without a key the invite API still succeeds - the mail send fails loudly in logs (`sendInBackground` catch) | existing - real key still to be set |
| `PORTAL_URL` | dashboard base embedded in invite links, read via the shared `getPortalUrl()` (trim + strip trailing junk). Default `http://localhost:3001/portal` | existing |

The 3-file env rule was not triggered because nothing new was introduced.

---

## 11. Testing & verification

- **Unit:** 113 new tests across `staff.config.spec.ts` (formula, ceilings both directions,
  floor non-revocable, owner/suspended cases), `staff-permissions.service.spec.ts` (short-
  circuits, fallbacks, real 60s TTL with fake timers, invalidation), `staff.service.spec.ts`
  (invite 409/400/rollback, operator resolution matrix, owner/self protections, suspend
  cascades, designation rules, catalog scoping - Better Auth mocked the same way as
  `operators.service.spec.ts`), `permissions.guard.spec.ts`, plus updated `user.service` /
  `tours.service` specs. **Full suite: 55 → 58 suites, 1197 tests, all green**; both repos
  `tsc --noEmit` clean; `pnpm build` clean (backend + dashboard).
- **Live end-to-end** (curl against the built backend with real admin/operator/staff/seat
  logins): the full table in section 8, both invite flows, both designation CRUDs, cleanup.
  This live pass is what surfaced the cookie-cache bypass, the permissionless bookings reads,
  and the 500-on-suspended-login - none of which unit tests alone would have caught.

---

## 12. Security & code review round (same day - all findings fixed)

Two independent reviewer agents ran after implementation.

| Sev | Finding | Fix |
|---|---|---|
| Critical | **Role-flip escalation:** `MANAGE_USERS` was inside the platform ceiling; `PATCH /users/:id/role` only blocked ADMIN assignment - a staff member granted MANAGE_USERS could flip an accomplice to `EDITOR` (broad static set, outside every ceiling) | Identity permissions (`MANAGE_USERS`/`CREATE_USER`/`UPDATE_USER`/`DELETE_USER`) excluded from the platform ceiling AND `updateUserRole` now requires `requester.role === ADMIN` (two independent layers; regression test added) |
| Critical | **IDOR:** `GET /users/:id/permissions` gated only by `VIEW_PERMISSIONS` (held by every operator) - anyone could enumerate anyone's resolved access | Admin-or-self enforced in the service (verified live: 403 cross-user, 200 self) |
| Major | `updateTeamMember` did two non-atomic writes - seatRole could commit before a designation-validation 400 | Validate-then-write-once: seatRole rides the single `applyMemberUpdate` write |
| Major | Invite provisioning duplicated near-verbatim (staff vs operators), incl. the `portalUrl` computation | Extracted `provisionInvitedAccount` + `getPortalUrl` (`common/utils/invite-provisioning.util.ts`); both services use the one implementation |
| Medium | `PATCH /users/:id(/status)` flipped only `user.status` - no session kill, no staff-row sync, no cache invalidation | `syncStatusSideEffects` in `user.service.ts` mirrors the staff API on both paths |
| Low | Permission catalog readable by any authenticated user (travelers) | `@RequirePermissions(VIEW_PERMISSIONS)` (verified live 401/403) |
| Low | Resend-invite bypasses Better Auth's per-route limiter (server-initiated) - inbox-bombing | Human-pace `@Throttle` (1/10s, 3/min, 10/hr) on both resend endpoints |
| Low | `MANAGE_OPERATOR_PAYMENTS` offered to platform staff but always 403'd downstream | Removed from the platform ceiling (honest catalog) |
| Low | Dashboard fallback could over-render UI for a narrowly-designated STAFF user | STAFF fallback = floor/empty in RoleProvider + sidebar |
| Minor | Bookings platform-read roles hardcoded twice | `isPlatformWideBookingRole()` helper used by both branches |
| Accepted | In-process permission cache (multi-instance staleness ≤60s for grant changes) | Documented pre-deployment gate: shared invalidation before scaling out |

Reviewer-confirmed sound: tenant isolation (`resolveTeamOperatorId`/`resolveMember` pinning, no
operatorId injection path), ceiling defense-in-depth, suspension mechanics, seeded designations
containing no dangerous permissions, and the backend/dashboard override-formula parity.

After fixes: full suite re-run green (one stale spec assertion updated to the NEW ceiling
policy), rebuild, and live re-smoke of every fixed path (ceiling exclusions live, catalog 403
for non-holders, cross-user permissions read 403, self read 200, admin intact at 81 permissions).

---

## 13. Achievements

- **One unified staff system for both sides** - 22 endpoints, 2 tables, 3 seeded system
  designations, all 7 existing operators backfilled as owners - executing login-doc Phase 2 and
  going beyond it with per-person fine-grained permissions.
- **A single pure permission policy** (formula + ceilings + floor) shared by guard and API, so
  display and enforcement cannot drift - and because the API was already permission-gated,
  fine-grained grants work across every existing module with a one-guard change.
- **Industry-grade lifecycle security:** invite links instead of shared passwords, throwaway
  credentials, instant suspension (session store check + session kill + login block + empty
  set), instant grant/revoke, self- and owner-protection, ceiling-capped grants at write AND
  compute time, full audit fields.
- **Three latent platform issues found and fixed** by building this: the session cookie-cache
  revocation bypass, permissionless bookings reads, and no login block for suspended accounts.
- **Complete management UX** on one role-branched `/users` page with a ceiling-aware permission
  matrix - and the whole dashboard now runs on backend-computed effective permissions.
- **Proof, not promises:** 1197 unit tests green, both repos build, and every security property
  additionally demonstrated against the live API with real logins.

## 14. What is deliberately NOT here (future phases)

Per the login plan: 2FA/TOTP + backup codes (Phase 3), step-up re-auth for sensitive actions
(Phase 4), Google Workspace SSO for the admin door (Phase 5), subdomain/cookie isolation
(Phase 6), a dashboard UI for admins browsing a specific operator's team (the API supports it
via `?operatorId=`), and Redis-backed permission-cache invalidation (required before any
multi-instance deployment).
