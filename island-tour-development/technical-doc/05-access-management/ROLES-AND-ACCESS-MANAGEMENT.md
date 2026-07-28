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
| Tours | `CREATE_TRIP` | `EDIT_TRIP` | `DELETE_TRIP` / `MANAGE_TRIPS` (admin). **Publishing is always Island Tours' (conflict #1, 2026-07-28)**: operators hold NO `MANAGE_TRIPS`; they `submit-for-review` (`EDIT_TRIP`, same readiness bar as publish) and pause/archive their own tours (downward = safe); publish/unpause/restore/approve/reject are `MANAGE_TRIPS`. `approvalStatus` gates publish (`NOT_SUBMITTED/PENDING/APPROVED/REJECTED`; LIVE implies APPROVED - an admin publish stamps it); reject requires an actionable note the operator sees |
| Attributes dictionary | `MANAGE_SYSTEM` | `MANAGE_SYSTEM` | `MANAGE_SYSTEM` |
| Availability | `EDIT_TRIP` (own) | `EDIT_TRIP` | `MANAGE_TRIPS` (admin override) |
| Bookings | — | — | `VIEW_BOOKINGS` / `MANAGE_BOOKINGS`; **`VIEW_BOOKING_FINANCIALS` (conflict #7, 2026-07-28) shapes the PROJECTION, not the route**: without it a seat reads the MANIFEST (lead name, party size, date/time, pickup, phone) with amounts, payment/refund/settlement state and traveler email nulled - held by ADMIN/EDITOR/STAFF and `TOUR_OPERATOR` (owners/managers), inside the operator-seat ceiling so a field-staff designation can omit it; `GUIDE` deliberately lacks it. **A traveler always sees the money on their OWN booking** (row ownership, not the role grant - granting it to `USER` would leak through the customer-hat union onto any staff seat that has ever booked). The four money-by-nature sibling surfaces (`/customers`, `/payments`, `/settlements`, `/analytics/dashboard`) require it ON TOP of their own permission, or a field-guide designation would read the same amounts back through them; cancelling a CONFIRMED booking (refund execution) is admin-only - operators file `POST /bookings/:id/report-cancellation` (`EDIT_BOOKING`, own bookings) and the admin executes (`cancelledBy=OPERATOR`, full refund) or dismisses; a pending report holds the settlement payout |
| Reviews | (traveler, booking-gated) | operator response | `MODERATE_REVIEWS` (admin) |
| Operators | `CREATE_OPERATOR` | `EDIT_OPERATOR_PROFILE` | `MANAGE_OPERATORS` |
| Settings | — | `MANAGE_SETTINGS` | `MANAGE_SETTINGS` |
| Users | — | — | `MANAGE_USERS` (list/read too - `VIEW_USERS` is the operator-scoped `/customers` surface, never the unscoped list) |
| Media | `UPLOAD_MEDIA` | `UPLOAD_MEDIA` (scoped) | `MANAGE_MEDIA`; reads need `VIEW_MEDIA` (travelers hold no media permission). **Scoping is by OPERATOR context (conflict #6 stage 2, 2026-07-28)**: rows carry `operatorId` (stamped at upload, backfilled from the uploader's operator/seat link); owner + every team seat share ONE library; `MANAGE_MEDIA` platform roles see everything; platform uploads have `operatorId = null` |
| Settlements | — | — | reads `VIEW_PAYMENTS` (operator = own rows); mark-paid/mark-unpaid `MANAGE_PAYMENTS` (admin-only, excluded from the platform-staff ceiling alongside `MANAGE_BOOKINGS`) |

## Commercial permissions (master §7)

The tier economy replaces the slot economy, so slot permissions are **removed**
(`MANAGE_SLOTS` and any slot override). The role model must support:

- **Operator self-service:** an operator picks their own commission tier in the dashboard, subject
  to eligibility validation and the 30-day tier lock (no special permission beyond owning the tour;
  enforced in the service). Tier changes and Spotlight requests are **owner-account-only**: a team
  seat that resolves to the operator via `resolveOperatorId` is still rejected - the tiers service
  compares the caller's userId against the operator's owner `userId` (admins bypass).
  See [../02-architecture/COMMERCIAL-MODEL.md](../02-architecture/COMMERCIAL-MODEL.md).
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
