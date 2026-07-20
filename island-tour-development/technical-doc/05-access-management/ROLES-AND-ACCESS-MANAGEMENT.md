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
self-registers with email verification; `USER` is auto-created on first booking.
