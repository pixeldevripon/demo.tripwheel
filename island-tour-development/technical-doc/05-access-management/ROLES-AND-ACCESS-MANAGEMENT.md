# Roles & access management

> **Canonical source:** master §1 (roles), §7 (commercial actions the role model must support).
> The platform's RBAC: roles, how they are created, the guard chain, and the permission map.
> Slot-economy permissions are removed; commercial-tier and editorial permissions are added.

## Roles

| Role | Created by | Key capability |
|---|---|---|
| `USER` | Auto on first booking (customer account, 2026-07-20) | Browse, book, review, wishlist; customer dashboard at `/account` - OWN bookings + payments (`VIEW_BOOKINGS`/`VIEW_PAYMENTS`, self-scoped server-side), profile, cancellation requests. See `technical-doc/customers/CUSTOMER-ACCOUNTS.md` |
| `TOUR_OPERATOR` | Self-registration (email verify) | Create/manage own tours, pick commission tier, manage availability, view own bookings |
| `ADMIN` | Database seed only | Full platform: destinations, categories, hubs, collections, attributes dictionary, operator approval, Spotlight approval, force-majeure pardons, settings |
| `EDITOR` | Admin (designed, not launch-active) | Content management; no system config, user management, or commercial approvals |
| `STAFF` | Admin (designed, not launch-active) | Operational support; read-only content, manage inquiries |
| `GUIDE` | Admin (designed, not launch-active) | Read-only (tours, bookings, reviews) |

**Active at launch:** `USER`, `TOUR_OPERATOR`, `ADMIN`. `EDITOR`/`STAFF`/`GUIDE` are modeled for
future use. Operators inherit all `USER` capabilities; admins inherit all `USER` + `TOUR_OPERATOR`
capabilities.

## Hard rules

1. **ADMIN is a strict superset.** `ROLE_PERMISSIONS[ADMIN]` must include every permission granted
   to any lower role. Re-check whenever the `Permission` enum is extended.
2. **Roles are set server-side only.** Role changes happen only through endpoints guarded by
   `@Roles(Role.ADMIN)`. The frontend never sends a `role` field.
3. **RBAC stays in sync.** `backend/src/config/roles.config.ts` (source of truth) and the frontend
   `lib/config/rbac.ts` mirror must match exactly.

## Guard chain (do not reorder)

```
ThrottlerGuard   → rate limits before any DB work
AuthGuard        → validates session cookie/Bearer; populates request.user
RolesGuard       → checks @Roles() metadata
PermissionsGuard → checks @RequirePermissions() metadata
```

Use `@RequirePermissions()` on endpoints, not `@Roles()` on individual routes.

## Permission map (per module)

| Module | Create | Edit | Delete / Manage |
|---|---|---|---|
| Destinations | `CREATE_DESTINATION` | `EDIT_DESTINATION` | `DELETE_DESTINATION` |
| Categories | `CREATE_CATEGORY` | `EDIT_CATEGORY` | `DELETE_CATEGORY` |
| Hubs | `MANAGE_HUBS` | `MANAGE_HUBS` | `MANAGE_HUBS` |
| Collections | `CREATE_COLLECTION` | `EDIT_COLLECTION` | `DELETE_COLLECTION` |
| Tours | `CREATE_TRIP` | `EDIT_TRIP` | `DELETE_TRIP` / `MANAGE_TRIPS` (admin) |
| Attributes dictionary | `MANAGE_SYSTEM` | `MANAGE_SYSTEM` | `MANAGE_SYSTEM` |
| Availability | `EDIT_TRIP` (own) | `EDIT_TRIP` | `MANAGE_TRIPS` (admin override) |
| Bookings | — | — | `VIEW_BOOKINGS` / `MANAGE_BOOKINGS` |
| Reviews | (traveler, booking-gated) | operator response | `MODERATE_REVIEWS` (admin) |
| Operators | `CREATE_OPERATOR` | `EDIT_OPERATOR_PROFILE` | `MANAGE_OPERATORS` |
| Settings | — | `MANAGE_SETTINGS` | `MANAGE_SETTINGS` |
| Users | — | — | `MANAGE_USERS` |
| Media | `UPLOAD_MEDIA` | — | `MANAGE_MEDIA` |

## Commercial permissions (master §7)

The tier economy replaces the slot economy, so slot permissions are **removed**
(`MANAGE_SLOTS` and any slot override). The role model must support:

- **Operator self-service:** an operator picks their own commission tier in the dashboard, subject
  to eligibility validation and the 30-day tier lock (no special permission beyond owning the tour;
  enforced in the service). See [../02-architecture/COMMERCIAL-MODEL.md](../02-architecture/COMMERCIAL-MODEL.md).
- **Spotlight approval (admin):** Destination Spotlight is request → admin approve, max 3 per
  destination. Permission: `MANAGE_OPERATORS` / `MANAGE_SYSTEM` (admin-only).
- **Force-majeure pardons (admin):** exclude operator cancellations within a date range +
  destination from the eligibility cancellation metric. Permission: `MANAGE_SYSTEM`.

## Ownership rule for tours

`trips.operatorId` is a FK to `operators.id`, not `users.id`. Controllers pass `user.id`; the
service resolves it to `operator.id` (`resolveOperatorId`) before any write or ownership check.
Admins bypass the ownership check (manage any operator's tour) and are auto-provisioned an operator
record on first tour create. See [../03-implementation/TRIP-MODULE.md](../03-implementation/TRIP-MODULE.md).

## Authentication

Better Auth lives on the NestJS backend only (the frontend never runs `betterAuth()`). ADMIN is
seed-only (email + password); `EDITOR`/`STAFF`/`GUIDE` would be admin-created; `TOUR_OPERATOR`
is admin-invited (set-password email); `USER` is auto-created on first booking. Public sign-up
is disabled (`disableSignUp: true`).

### Login doors (2026-07-27)

Every user type signs in through its own URL, all hitting the same `/api/auth/sign-in/email`:

| Door | URL | Who |
|---|---|---|
| Traveler | dashboard app `/account` | customer hat (any account with customer rows, or role USER) |
| Operator | dashboard app `/portal` | operator link, team seat, or role TOUR_OPERATOR |
| Staff | dashboard app `/staff` | platform staff (role STAFF / staff row with no operator) |
| System Admin | separate admin app (tripwheel-app) `/login` | role ADMIN |

Enforcement is server-side: the client sends `x-login-surface` (`account|portal|staff|admin`);
the `session.create.before` hook rejects a missing/unknown header and any door the account has
no hat for (code `WRONG_LOGIN_SURFACE`, revealed only AFTER the password verified - enumeration-
safe). The entered door is stamped on `Session.surface`. ADMIN passes every door (superset rule).
An advisory `POST /api/v1/auth/login-precheck` (public, throttled like sign-in) powers the login
pages' friendly wrong-door messages; it fails open and cannot bypass the hook. The header must be
listed in the backend CORS `allowedHeaders` (`main.ts`) or browsers block the preflight.

The dashboard shapes its VIEW by `session.surface` (`isCustomerView` in `lib/rbac-utils.ts`):
an `/account`-minted session gets the traveler shell (bookings/payments/profile only), any other
surface the staff/operator shell, and surface-less legacy sessions fall back to role. Multi-hat
accounts can re-stamp their own session to another surface they hold via
`GET/PATCH /api/v1/auth/session-surface` (validated against the same hat derivation; purely
presentational - `RolesGuard`/`PermissionsGuard` never read `Session.surface`).

### One account, many hats (2026-07-27)

One `User` row per email, one password. Staff/operator invites for an existing email ATTACH the
identity (`provisionOrAttachAccount`): role elevates by precedence (never downgrades), a
credentialed account gets a "you've been added" email (no set-password link) and an ACTIVE seat,
and rollback never deletes a pre-existing account. Bookings by staff/operator emails attach
customer rows and open the `/account` door for them; the effective-permission engine unions
`Role.USER`'s self-scoped set when customer rows exist. Email changes go ONLY through the
verified Better Auth change-email flow (confirmation to the current inbox, then verification to
the new one) - `PATCH /users/:id` has no email field.

### Hidden internal-management admin

A second `Role.ADMIN` account flagged `User.isSystemAccount` (seeded from optional
`SYSTEM_ADMIN_EMAIL`/`SYSTEM_ADMIN_PASSWORD`): same powers as the visible admin, but excluded
from `GET /users`, `GET /users/:id` and the staff list's synthesized system-admin rows, and
immune to every admin mutation path. Held by the internal management department; the visible
`admin@islandtours.com` is what gets handed over to the client (they rotate its password and
email via the self-service flows).
