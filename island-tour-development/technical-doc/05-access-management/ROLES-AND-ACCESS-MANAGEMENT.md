# Island Tours — Roles & Access Management

> Derived from: `CLAUDE.md` · `PROJECT_SCOPE.md` · `ARCHITECTURE_OVERVIEW.md` · `backend/src/config/roles.config.ts` · `frontend/lib/config/rbac.ts` · `frontend/navigations/navigations.ts`

---

## Table of Contents

1. [Role Overview](#1-role-overview)
2. [Role Descriptions & Responsibilities](#2-role-descriptions--responsibilities)
3. [Permission Matrix](#3-permission-matrix)
4. [Dashboard Navigation Access](#4-dashboard-navigation-access)
5. [API Endpoint Access by Role](#5-api-endpoint-access-by-role)
6. [Business Rules & Constraints per Role](#6-business-rules--constraints-per-role)
7. [Authentication Method per Role](#7-authentication-method-per-role)
8. [What Each Role Cannot Do](#8-what-each-role-cannot-do)
9. [User Creation Hierarchy & Sub-Account Management](#9-user-creation-hierarchy--sub-account-management)
10. [Missing Features — Industry-Best & Business Requirements](#10-missing-features--industry-best--business-requirements)

---

## 1. Role Overview

The platform defines **6 roles** organised in a privilege hierarchy:

```
ADMIN  ≥  EDITOR  ≥  STAFF  ≥  GUIDE
                                       \
TOUR_OPERATOR  ≥  USER  (separate tree)
```

| Role | Created by | Scope | Inherits from |
|---|---|---|---|
| `ADMIN` | Database seed only | Full platform | All roles |
| `EDITOR` | Admin only | Content + operations (no system config) | STAFF |
| `STAFF` | Admin only | Day-to-day operations | GUIDE |
| `GUIDE` | Admin only | Read-only (tours, bookings, reviews) | — |
| `TOUR_OPERATOR` | Self-registration (requires email verification) | Own trips + slot economy | USER |
| `USER` | Auto-created on first booking | Customer browsing and self-service | — |

> **Key rule:** Role assignment is always done server-side. The frontend never sends a `role` field. Role changes must go through a backend endpoint protected by `@Roles(Role.ADMIN)`.

---

## 2. Role Descriptions & Responsibilities

### ADMIN

**Who:** Platform staff with full control. Only created via the database seed script — no public sign-up.

**Primary responsibilities:**
- Full platform governance: approve/suspend/ban operators, force-pause or archive any trip
- Manage platform geography: create and edit destinations, hubs, categories
- Configure payment gateways (Stripe, Mollie, PayPal) and commission rates per slot tier
- Manage all featured slots across every category; override slot assignments when needed
- View and manage the waitlist for any slot
- Manage all users, operators, bookings, and payments across the platform
- Configure site settings (SMTP, SEO, social media, platform info)
- Access all analytics and export data
- Manage blogs, partners, enquiries, leads, and reviews

**Key privileges that only ADMIN holds:**
- `MANAGE_SYSTEM` — system-level settings
- `MANAGE_USERS` — create / update / delete user accounts
- `CREATE_USER`, `UPDATE_USER`, `DELETE_USER`
- `MANAGE_OPERATORS` — approve, reject, suspend operators
- `MANAGE_SLOTS` — override featured slot assignments
- `MANAGE_SETTINGS` — write access to platform settings
- `DELETE_DESTINATION` — seeded destinations cannot be deleted regardless; non-seeded only
- `EDIT_PAYMENT`, `DELETE_PAYMENT`, `EDIT_ORDER`
- `BULK_OPERATIONS` (shared with EDITOR)
- `EXPORT_DATA` (shared with EDITOR and TOUR_OPERATOR)

---

### EDITOR

**Who:** Internal content and operations team member. Created by admin.

**Primary responsibilities:**
- All content management: trips, blogs, destinations, hubs, activities, pickup/drop points, categories
- Manage bookings and payments
- Respond to enquiries and manage leads
- Moderate reviews
- Manage media gallery
- View analytics and export reports

**Key limits (compared to ADMIN):**
- Cannot manage system settings or platform configuration
- Cannot create, update, or delete user accounts (`MANAGE_USERS`, `CREATE_USER`, `UPDATE_USER`, `DELETE_USER` — ADMIN only)
- Cannot manage operators (approve/reject/suspend) — `MANAGE_OPERATORS` is ADMIN only
- Cannot override featured slots — `MANAGE_SLOTS` is ADMIN only
- Cannot view or change slot analytics — `VIEW_SLOT_ANALYTICS` is ADMIN only
- Cannot configure settings (`MANAGE_SETTINGS`, `VIEW_SETTINGS` — ADMIN only)

---

### STAFF

**Who:** Operational support staff. Created by admin.

**Primary responsibilities:**
- Handle bookings and payments (view, edit, cancel)
- Respond to enquiries and manage leads
- Moderate reviews
- Manage media gallery
- Create and view trips and blog posts (no edit/delete on trips)
- Manage partners
- View analytics

**Key limits (compared to EDITOR):**
- Cannot edit or delete trips (`EDIT_TRIP`, `DELETE_TRIP` — EDITOR and above)
- Cannot manage destinations, hubs, categories, activities, or pickup/drop points (all EDITOR and above)
- Cannot manage blogs (can view/create, cannot edit/delete)
- Cannot export data (`EXPORT_DATA` — EDITOR and above)
- Cannot run bulk operations (`BULK_OPERATIONS` — EDITOR and above)

---

### GUIDE

**Who:** Read-only observer role (e.g., a local tour guide who needs to see trip and booking info). Created by admin.

**Primary responsibilities:**
- View assigned trips and their schedules
- View bookings to know who is coming
- View reviews for quality awareness
- No write access to anything

**Permissions:**
- `VIEW_USERS`, `VIEW_PROFILE`, `VIEW_BOOKINGS`, `VIEW_TRIPS`, `VIEW_REVIEWS`

**Key limits:** No create, edit, or delete permission on any entity. No analytics, no media, no content management.

---

### TOUR_OPERATOR

**Who:** Tour businesses or individuals listing trips on the platform. Self-registered via Better Auth (email verification required).

**Primary responsibilities:**
- Create, edit, and manage their own trips (DRAFT → LIVE ⇄ PAUSED → ARCHIVED)
- Participate in the featured slot economy (lock, publish, join waitlist)
- View bookings for their own trips
- Manage their operator profile and payment configuration
- View their own analytics and payment history
- Upload media for their trips

**Key limits:**
- Can only manage their **own** trips — no access to other operators' trips
- `tripId` ownership is tied to `operator.id` (not `user.id`) — the service resolves this automatically
- Cannot access any platform configuration, settings, or user management
- Cannot view all-platform analytics — only their own slot analytics (`VIEW_SLOT_ANALYTICS`)
- Cannot see destination/hub/category management pages (write access)
- Cannot see the Users, Enquiries, Leads, Partners, or Settings sections

---

### USER

**Who:** End customers. Auto-created when their first booking is made — no self-registration. Credentials (email + temp password) delivered by email.

**Primary responsibilities:**
- Browse and search all live trips (public, no login required for browsing)
- Book trips and pay
- Manage their own bookings (view, cancel)
- Rate and review completed trips
- Manage their own profile

**Key limits:**
- No dashboard access beyond their own profile and order history
- Cannot create, edit, or delete any content
- Cannot upload media
- No analytics access

---

## 3. Permission Matrix

`✓` = has permission · `—` = does not have permission

| Permission | ADMIN | EDITOR | STAFF | GUIDE | TOUR_OPERATOR | USER |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **System** | | | | | | |
| `VIEW_PERMISSIONS` | ✓ | — | — | — | ✓ | — |
| `MANAGE_SYSTEM` | ✓ | — | — | — | — | — |
| **Operators** | | | | | | |
| `MANAGE_OPERATORS` | ✓ | — | — | — | — | — |
| `CREATE_OPERATOR` | ✓ | — | — | — | ✓ | — |
| `VIEW_OPERATOR_PROFILE` | ✓ | — | — | — | ✓ | — |
| `EDIT_OPERATOR_PROFILE` | ✓ | — | — | — | ✓ | — |
| `MANAGE_OPERATOR_PAYMENTS` | ✓ | — | — | — | ✓ | — |
| **Users** | | | | | | |
| `MANAGE_USERS` | ✓ | — | — | — | — | — |
| `VIEW_USERS` | ✓ | — | — | ✓ | ✓ | — |
| `CREATE_USER` | ✓ | — | — | — | — | — |
| `UPDATE_USER` | ✓ | — | — | — | — | — |
| `DELETE_USER` | ✓ | — | — | — | — | — |
| **Trips** | | | | | | |
| `MANAGE_TRIPS` | ✓ | — | — | — | ✓ | — |
| `CREATE_TRIP` | ✓ | ✓ | ✓ | — | ✓ | — |
| `VIEW_TRIPS` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `EDIT_TRIP` | ✓ | ✓ | — | — | ✓ | — |
| `DELETE_TRIP` | ✓ | ✓ | — | — | ✓ | — |
| **Featured Slots** | | | | | | |
| `MANAGE_SLOTS` | ✓ | — | — | — | — | — |
| `VIEW_SLOT_ANALYTICS` | ✓ | — | — | — | ✓ | — |
| **Content** | | | | | | |
| `CREATE_CONTENT` | ✓ | — | — | — | ✓ | — |
| `VIEW_CONTENT` | ✓ | — | — | — | ✓ | ✓ |
| `EDIT_CONTENT` | ✓ | — | — | — | ✓ | — |
| `DELETE_CONTENT` | ✓ | — | — | — | ✓ | — |
| **Destinations** | | | | | | |
| `CREATE_DESTINATION` | ✓ | ✓ | — | — | — | — |
| `VIEW_DESTINATIONS` | ✓ | ✓ | — | — | — | — |
| `EDIT_DESTINATION` | ✓ | ✓ | — | — | — | — |
| `DELETE_DESTINATION` | ✓ | ✓ | — | — | — | — |
| `MANAGE_HUBS` | ✓ | ✓ | — | — | — | — |
| **Categories** | | | | | | |
| `CREATE_CATEGORY` | ✓ | ✓ | — | — | — | — |
| `VIEW_CATEGORIES` | ✓ | ✓ | — | — | ✓ | — |
| `EDIT_CATEGORY` | ✓ | ✓ | — | — | — | — |
| `DELETE_CATEGORY` | ✓ | ✓ | — | — | — | — |
| **Activities** | | | | | | |
| `CREATE_ACTIVITY` | ✓ | ✓ | — | — | — | — |
| `VIEW_ACTIVITIES` | ✓ | ✓ | — | — | — | — |
| `EDIT_ACTIVITY` | ✓ | ✓ | — | — | — | — |
| `DELETE_ACTIVITY` | ✓ | ✓ | — | — | — | — |
| **Pickup & Drop** | | | | | | |
| `CREATE_PICKUP_DROP` | ✓ | ✓ | — | — | — | — |
| `VIEW_PICKUP_DROPS` | ✓ | ✓ | — | — | — | — |
| `EDIT_PICKUP_DROP` | ✓ | ✓ | — | — | — | — |
| `DELETE_PICKUP_DROP` | ✓ | ✓ | — | — | — | — |
| **Blogs** | | | | | | |
| `CREATE_BLOG` | ✓ | ✓ | ✓ | — | — | — |
| `VIEW_BLOGS` | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| `EDIT_BLOG` | ✓ | ✓ | — | — | — | — |
| `DELETE_BLOG` | ✓ | ✓ | — | — | — | — |
| **Bookings** | | | | | | |
| `VIEW_BOOKINGS` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `EDIT_BOOKING` | ✓ | ✓ | ✓ | — | — | — |
| `DELETE_BOOKING` | ✓ | ✓ | ✓ | — | — | — |
| **Payments** | | | | | | |
| `VIEW_PAYMENTS` | ✓ | ✓ | ✓ | — | ✓ | — |
| `EDIT_PAYMENT` | ✓ | ✓ | ✓ | — | — | — |
| `DELETE_PAYMENT` | ✓ | ✓ | ✓ | — | — | — |
| **Orders** | | | | | | |
| `VIEW_ORDERS` | ✓ | — | — | — | ✓ | ✓ |
| `EDIT_ORDER` | ✓ | — | — | — | — | — |
| **Enquiries** | | | | | | |
| `VIEW_ENQUIRIES` | ✓ | ✓ | ✓ | — | — | — |
| `DELETE_ENQUIRY` | ✓ | ✓ | ✓ | — | — | — |
| `REPLY_ENQUIRY` | ✓ | ✓ | ✓ | — | — | — |
| **Leads** | | | | | | |
| `VIEW_LEADS` | ✓ | ✓ | ✓ | — | — | — |
| `EDIT_LEAD` | ✓ | ✓ | ✓ | — | — | — |
| `DELETE_LEAD` | ✓ | ✓ | ✓ | — | — | — |
| **Reviews** | | | | | | |
| `VIEW_REVIEWS` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `EDIT_REVIEW` | ✓ | ✓ | ✓ | — | — | — |
| `DELETE_REVIEW` | ✓ | ✓ | ✓ | — | — | — |
| **Partners** | | | | | | |
| `CREATE_PARTNER` | ✓ | ✓ | ✓ | — | — | — |
| `VIEW_PARTNERS` | ✓ | ✓ | ✓ | — | — | — |
| `EDIT_PARTNER` | ✓ | ✓ | ✓ | — | — | — |
| `DELETE_PARTNER` | ✓ | ✓ | ✓ | — | — | — |
| **Media** | | | | | | |
| `UPLOAD_MEDIA` | ✓ | ✓ | ✓ | — | ✓ | — |
| `MANAGE_MEDIA` | ✓ | ✓ | ✓ | — | — | — |
| `VIEW_MEDIA` | ✓ | — | — | — | ✓ | — |
| **Profile** | | | | | | |
| `VIEW_PROFILE` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `EDIT_PROFILE` | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| **Settings** | | | | | | |
| `VIEW_SETTINGS` | ✓ | — | — | — | — | — |
| `MANAGE_SETTINGS` | ✓ | — | — | — | — | — |
| **Analytics & Data** | | | | | | |
| `VIEW_ANALYTICS` | ✓ | ✓ | ✓ | — | ✓ | — |
| `EXPORT_DATA` | ✓ | ✓ | — | — | ✓ | — |
| `BULK_OPERATIONS` | ✓ | ✓ | — | — | — | — |

---

## 4. Dashboard Navigation Access

Each dashboard section is shown or hidden based on the logged-in user's role. Sections a role cannot see are not rendered — they are filtered by the `AppSidebar` using the `ROLE_PERMISSIONS` map.

### 4.1 Navigation Sections by Role

| Dashboard Section | Sub-page | ADMIN | EDITOR | STAFF | GUIDE | TOUR_OPERATOR | USER |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Overview** | `/dashboard` | ✓ | ✓ | ✓ | — | ✓ | — |
| **Analytics** | `/dashboard/analytics` | ✓ | ✓ | ✓ | — | ✓ | — |
| **Trips** | `/dashboard/trips` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| — All Trips | `/dashboard/trips` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| — Add New Trip | `/dashboard/trips/new` | ✓ | ✓ | ✓ | — | ✓ | — |
| **Destinations** | `/dashboard/destinations` | ✓ | ✓ | — | — | — | — |
| **Hubs** | `/dashboard/hubs` | ✓ | ✓ | — | — | — | — |
| **Activities** | `/dashboard/activities` | ✓ | ✓ | — | — | — | — |
| — All Activities | `/dashboard/activities` | ✓ | ✓ | — | — | — | — |
| — Add Activity | `/dashboard/activities/new` | ✓ | ✓ | — | — | — | — |
| **Pickup & Drop** | `/dashboard/pickup-drops` | ✓ | ✓ | — | — | — | — |
| — All Points | `/dashboard/pickup-drops` | ✓ | ✓ | — | — | — | — |
| — Add Point | `/dashboard/pickup-drops/new` | ✓ | ✓ | — | — | — | — |
| **Blog** | `/dashboard/blogs` | ✓ | ✓ | ✓ | — | — | — |
| — All Posts (view only) | `/dashboard/blogs` | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| — New Post | `/dashboard/blogs/new` | ✓ | ✓ | ✓ | — | — | — |
| **Bookings** | `/dashboard/bookings` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| **Payments** | `/dashboard/payments` | ✓ | ✓ | ✓ | — | ✓ | — |
| **Users** | `/dashboard/users` | ✓ | — | — | ✓ | ✓ | — |
| — All Users | `/dashboard/users` | ✓ | — | — | ✓ | ✓ | — |
| — Add User | `/dashboard/users/new` | ✓ | — | — | — | — | — |
| **Enquiries** | `/dashboard/enquiries` | ✓ | ✓ | ✓ | — | — | — |
| **Leads** | `/dashboard/leads` | ✓ | ✓ | ✓ | — | — | — |
| **Reviews** | `/dashboard/reviews` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Partners** | `/dashboard/partners` | ✓ | ✓ | ✓ | — | — | — |
| — All Partners | `/dashboard/partners` | ✓ | ✓ | ✓ | — | — | — |
| — Add Partner | `/dashboard/partners/new` | ✓ | ✓ | ✓ | — | — | — |
| **Categories** | `/dashboard/categories` | ✓ | ✓ | — | — | — | — |
| **Media** | `/dashboard/media` | ✓ | ✓ | ✓ | — | ✓ | — |
| **My Profile** | `/dashboard/profile` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Settings** | `/dashboard/settings` | ✓ | — | — | — | — | — |
| — General | `/dashboard/settings` | ✓ | — | — | — | — | — |
| — System | `/dashboard/settings/system` | ✓ | — | — | — | — | — |

### 4.2 In-Page Action Gates

Beyond section visibility, individual actions within a page are also gated. The pattern is enforced via `useRole().can('PERMISSION')` in client components.

| UI Element | Permission Required | ADMIN | EDITOR | STAFF | GUIDE | TOUR_OPERATOR |
|---|---|:---:|:---:|:---:|:---:|:---:|
| "Add Destination" button | `CREATE_DESTINATION` | ✓ | ✓ | — | — | — |
| "Delete Destination" row action | `DELETE_DESTINATION` | ✓ | ✓ | — | — | — |
| Destination Danger Zone card | `DELETE_DESTINATION` | ✓ | ✓ | — | — | — |
| "Add Category" button | `CREATE_CATEGORY` | ✓ | ✓ | — | — | — |
| "Delete Category" row action | `DELETE_CATEGORY` | ✓ | ✓ | — | — | — |
| "Add/Edit Hub" actions | `MANAGE_HUBS` | ✓ | ✓ | — | — | — |
| "Add Trip" button | `CREATE_TRIP` | ✓ | ✓ | ✓ | — | ✓ |
| "Edit Trip" row action | `EDIT_TRIP` | ✓ | ✓ | — | — | ✓ (own only) |
| "Delete Trip" row action | `DELETE_TRIP` | ✓ | ✓ | — | — | ✓ (own only) |
| Bulk Delete button | Varies per module | ✓ | ✓ | — | — | — |
| "Add User" button | `CREATE_USER` | ✓ | — | — | — | — |
| Approve / Reject Operator | `MANAGE_OPERATORS` | ✓ | — | — | — | — |
| Override Featured Slot | `MANAGE_SLOTS` | ✓ | — | — | — | — |
| Settings links (sidebar) | `VIEW_SETTINGS` | ✓ | — | — | — | — |

---

## 5. API Endpoint Access by Role

### Public endpoints (no auth required)

```
GET  /api/v1/trips                         All live trips (browse/search)
GET  /api/v1/trips/:slug                   Trip detail
GET  /api/v1/categories                    All categories
GET  /api/v1/destinations                  All destinations
GET  /api/v1/slots/category/:categoryId    Slot states (for slot picker UI)
GET  /api/v1/slots/stream?categoryId=      SSE stream for real-time slot updates
```

### USER endpoints

```
GET/PATCH  /api/v1/profile                 Own profile
GET        /api/v1/bookings/my             Own bookings
POST       /api/v1/bookings/:id/cancel     Cancel own booking
POST       /api/v1/reviews                 Submit a review
GET        /api/v1/wishlist                Own wishlist
POST/DELETE /api/v1/wishlist/:tripId       Add/remove wishlist item
```

### TOUR_OPERATOR endpoints (includes all USER endpoints)

```
POST       /api/v1/operators/apply         Apply to become operator
GET/PATCH  /api/v1/operators/me            Own operator profile
GET        /api/v1/operators/me/slots      Own featured slot dashboard data

POST       /api/v1/trips                   Create draft trip
PATCH      /api/v1/trips/:id              Edit own trip
POST       /api/v1/trips/:id/publish       Publish trip (triggers slot hard-reserve)
POST       /api/v1/trips/:id/pause         Pause live trip (releases featured slot)
DELETE     /api/v1/trips/:id              Archive trip (releases featured slot)

POST       /api/v1/slots/:slotId/lock      Soft-lock a slot (15-min TTL)
DELETE     /api/v1/slots/:slotId/lock      Manually release soft-lock

POST       /api/v1/waitlist/join           Join waitlist for a slot
POST       /api/v1/waitlist/:id/claim      Accept waitlist offer (24-hour window)
POST       /api/v1/waitlist/:id/pass       Decline offer, keep queue position
DELETE     /api/v1/waitlist/:id            Leave queue entirely
GET        /api/v1/waitlist/my-entries     Own waitlist positions
```

### ADMIN endpoints (includes all of the above)

```
GET        /api/v1/operators               All operators list
PATCH      /api/v1/operators/:id/approve   Approve operator account
PATCH      /api/v1/operators/:id/reject    Reject operator account
PATCH      /api/v1/operators/:id/suspend   Suspend operator

GET/POST   /api/v1/destinations            List / create destinations
PATCH/DELETE /api/v1/destinations/:id      Edit / delete destination (seeded ones blocked)
GET/POST   /api/v1/categories              List / create categories (seeds 3 FeaturedSlots)
PATCH/DELETE /api/v1/categories/:id        Edit / delete category
GET/POST   /api/v1/hubs                    List / create hubs
PATCH/DELETE /api/v1/hubs/:id             Edit / delete hub

GET        /api/v1/bookings                All bookings across platform
PATCH      /api/v1/bookings/:id            Edit any booking
DELETE     /api/v1/bookings/:id            Cancel any booking

PATCH      /api/v1/slots/:slotId/override  Override slot assignment
GET        /api/v1/slots                   All slots across all categories

GET        /api/v1/users                   All users
POST       /api/v1/users                   Create user
PATCH/DELETE /api/v1/users/:id            Edit / delete user

GET/PATCH  /api/v1/settings/*             Platform settings (SMTP, SEO, payments, etc.)
```

---

## 6. Business Rules & Constraints per Role

### TOUR_OPERATOR — Trip Ownership

- `trips.operatorId` is a FK to `operators.id` — **not** `users.id`
- Controllers receive `user.id`; the service resolves it to `operator.id` via `resolveOperatorId()`
- Operators can only edit/delete/publish/pause their own trips — the service performs an ownership check on every mutating call
- Admins bypass the ownership check for any trip — `userRole === Role.ADMIN` skips `assertOwnership()`
- If a `TOUR_OPERATOR` has no operator record: 400 error
- If an `ADMIN` has no operator record: one is auto-provisioned silently (allows admins to test the creation wizard)

### TOUR_OPERATOR — Featured Slot Rules

| Action | Rule |
|---|---|
| Lock a slot | Slot must be `AVAILABLE`; creates 15-min soft-lock; publishes SSE event |
| Publish trip | Must have a valid non-expired soft-lock; conditional UPDATE guards race condition |
| Race condition loss | Server returns `409 SLOT_TAKEN`; operator redirected to recovery modal |
| Slot auto-release | Occurs when operator pauses, archives, or 90-day cap expires |
| Waitlist offer | 24-hour window to claim; passing keeps queue position; letting it expire loses position |
| Queue skip | Maximum 3 paid skips per queue entry |

### ADMIN — Destination Delete Guard

Destinations with `isSeeded = true` cannot be deleted regardless of permissions. The service throws `403 ForbiddenException` before any DB write. The UI disables the Delete button and shows a tooltip for seeded records.

### ADMIN — Category Create Side Effects

When an admin creates a category, two extra writes happen in the **same Prisma transaction**:
1. One `slug_registry` row per active destination (protects the slug namespace)
2. Exactly 3 `FeaturedSlot` rows for that category (`status: AVAILABLE`, `slotNumber: 1/2/3`)

These rows are permanent — never deleted, only their `status`/`tripId` updated.

### All Roles — Cookie Session

All authenticated requests must carry the `better-auth.session_token` cookie. The backend `AuthGuard` validates it against the shared `BETTER_AUTH_SECRET`. Role/status changes propagate within 5 minutes (`cookieCache.maxAge: 300s`).

---

## 7. Authentication Method per Role

| Role | Registration | Login |
|---|---|---|
| `USER` | Auto-created on first booking — no self-registration | Email + temporary password; can reset via forgot-password flow |
| `TOUR_OPERATOR` | Self-registration via Better Auth; email verification mandatory before activation | Email/password or Google OAuth |
| `ADMIN` | Database seed only (`signUpEmail` → `prisma.user.update({ role: ADMIN })`) | Email + password only |
| `EDITOR` | Created by admin via backend API | Email + password (no OAuth) |
| `STAFF` | Created by admin via backend API | Email + password (no OAuth) |
| `GUIDE` | Created by admin via backend API | Email + password (no OAuth) |

> GitHub OAuth is listed in `auth.instance.ts` but flagged as pending product-owner confirmation (gap G11). Not enabled at launch.

---

## 8. What Each Role Cannot Do

### USER cannot:
- Access any dashboard section (only public-facing pages)
- Create, edit, or delete any platform content
- Upload media
- See analytics or payment data
- Manage other users or bookings

### GUIDE cannot:
- Create, edit, or delete anything (strictly read-only)
- Access analytics, payments, enquiries, leads, media, or settings
- Edit their profile (no `EDIT_PROFILE`)
- See categories, destinations, or hubs in the dashboard

### STAFF cannot:
- Edit or delete trips (can only view and create)
- Manage destinations, hubs, categories, activities, or pickup/drop points
- Edit or delete blog posts (can only create and view)
- Export data or run bulk operations
- Manage users, operators, or platform settings

### EDITOR cannot:
- Manage users (create, update, delete) or change user roles
- Manage operators (approve, reject, suspend)
- Override featured slot assignments
- Configure platform settings (SMTP, payment gateways, SEO)
- Access system-level settings

### TOUR_OPERATOR cannot:
- Access or manage any other operator's trips
- Access destination, hub, activity, pickup/drop, or category management pages
- See all-platform bookings — only bookings for their own trips
- Manage platform users, enquiries, leads, or partners
- Configure any platform settings
- Assign or override featured slots beyond the normal lock/publish flow

### ADMIN cannot:
- Delete a destination with `isSeeded = true` (blocked at service level regardless of permissions)
- Change role assignments through the frontend (must use protected backend endpoint)
- Create `FeaturedSlot` rows outside of category creation (the rows are seeded in the same transaction; subsequent inserts violate the business rule)

---

## Quick Reference: Role → Dashboard Sections

```
ADMIN         → All sections (Overview, Analytics, Trips, Destinations, Hubs,
                Activities, Pickup & Drop, Blog, Bookings, Payments, Users,
                Enquiries, Leads, Reviews, Partners, Categories, Media,
                My Profile, Settings)

EDITOR        → Overview, Analytics, Trips, Destinations, Hubs, Activities,
                Pickup & Drop, Blog, Bookings, Payments, Enquiries, Leads,
                Reviews, Partners, Categories, Media, My Profile
                [No: Users, Settings]

STAFF         → Overview, Analytics, Trips (view+create only), Blog (view+create),
                Bookings, Payments, Enquiries, Leads, Reviews, Partners, Media,
                My Profile
                [No: Destinations, Hubs, Activities, Pickup & Drop, Users,
                Categories, Settings]

GUIDE         → Trips (view only), Bookings (view only), Reviews (view only),
                Users (view only), My Profile
                [No: Everything else]

TOUR_OPERATOR → Overview, Analytics, Trips (own only), Blog (view only),
                Bookings (own trips only), Payments (own only), Reviews,
                Media (upload only), My Profile
                [No: Destinations, Hubs, Activities, Pickup & Drop, Users,
                Enquiries, Leads, Partners, Categories, Settings]

USER          → My Profile only (no dashboard, uses public-facing site)
```

---

## 9. User Creation Hierarchy & Sub-Account Management

This section defines exactly **who can create which users**, what those created users are allowed to do, and how their permissions are scoped. This covers both platform-level users (created by admin) and operator-level team members (created by an operator for their own business).

---

### 9.1 User Creation Hierarchy

```
DATABASE SEED
    └── ADMIN  ──────────────────────────────────────┐
                │ creates                             │ creates (on approval)
                ▼                                     ▼
         EDITOR / STAFF / GUIDE               TOUR_OPERATOR
         (platform staff)                      (operator business)
                                                     │ invites team members (F-12)
                                                     ▼
                                         OPERATOR OWNER / MANAGER / STAFF
                                         (scoped to that operator account only)

USER   ← auto-created on first booking (no human initiates this)
```

| Who creates them | Role(s) created | Method |
|---|---|---|
| Database seed script (engineering) | `ADMIN` | `signUpEmail` + `prisma.user.update({ role: ADMIN })` — no UI, no self-registration |
| `ADMIN` only | `EDITOR`, `STAFF`, `GUIDE` | Backend endpoint `POST /api/v1/admin/staff` + invite email (F-05) |
| `ADMIN` only (on approval) | `TOUR_OPERATOR` | Operator self-registers → admin approves via `PATCH /api/v1/operators/:id/approve` |
| `ADMIN` (directly) | `TOUR_OPERATOR` | Admin can create an operator account directly, skipping the self-registration flow |
| `TOUR_OPERATOR` (OWNER role) | Operator team members | `POST /api/v1/operators/team/invite` — invite by email with a team role (F-12) |
| System (automatic) | `USER` | Created on first booking; credentials sent by email; no human trigger |

> **Hard rule:** The `ADMIN` role can **only** be assigned via a direct database operation. No API endpoint, no dashboard action, and no self-registration path can ever produce an `ADMIN` account. This is enforced at the backend — `PATCH /api/v1/admin/users/:id/role` explicitly blocks promotion to `ADMIN`.

---

### 9.2 Admin-Created Platform Users

Admins create internal staff accounts to delegate platform management responsibilities. Each staff role has a strictly defined permission ceiling.

---

#### EDITOR — Content & Operations Manager

**Created by:** ADMIN only  
**Creation method:** `POST /api/v1/admin/staff` with `{ role: "EDITOR", email, name }` → invite email sent with temporary password

**Purpose:** Full platform content management and day-to-day operations without access to system configuration or user/operator governance.

**Responsibilities:**
- Create, edit, and publish trips, blog posts, destinations, hubs, categories, activities, and pickup/drop points
- Manage bookings and payments (view, edit, cancel)
- Respond to enquiries and manage leads
- Moderate reviews
- Manage partners
- Manage the media gallery
- View analytics and export reports

**Key permissions granted:**
| Permission | Notes |
|---|---|
| `CREATE_TRIP`, `EDIT_TRIP`, `DELETE_TRIP` | Platform-wide, not scoped to an operator |
| `CREATE_DESTINATION`, `EDIT_DESTINATION`, `DELETE_DESTINATION` | Non-seeded destinations only |
| `CREATE_CATEGORY`, `EDIT_CATEGORY`, `DELETE_CATEGORY` | All categories |
| `MANAGE_HUBS` | Full hub management |
| `VIEW_BOOKINGS`, `EDIT_BOOKING`, `DELETE_BOOKING` | All bookings on the platform |
| `VIEW_PAYMENTS`, `EDIT_PAYMENT`, `DELETE_PAYMENT` | All payments |
| `VIEW_ENQUIRIES`, `DELETE_ENQUIRY`, `REPLY_ENQUIRY` | All enquiries |
| `VIEW_LEADS`, `EDIT_LEAD`, `DELETE_LEAD` | All leads |
| `VIEW_REVIEWS`, `EDIT_REVIEW`, `DELETE_REVIEW` | All reviews |
| `CREATE_BLOG`, `EDIT_BLOG`, `DELETE_BLOG` | Blog posts |
| `UPLOAD_MEDIA`, `MANAGE_MEDIA` | Full media access |
| `VIEW_ANALYTICS`, `EXPORT_DATA`, `BULK_OPERATIONS` | Analytics and data export |

**Permissions explicitly denied (ADMIN-only):**
| Permission | Why denied |
|---|---|
| `MANAGE_SYSTEM` | Cannot touch platform-level settings |
| `MANAGE_SETTINGS`, `VIEW_SETTINGS` | No access to SMTP, payment gateways, SEO config |
| `MANAGE_USERS`, `CREATE_USER`, `UPDATE_USER`, `DELETE_USER` | Cannot manage user accounts |
| `MANAGE_OPERATORS` | Cannot approve, reject, or suspend operators |
| `MANAGE_SLOTS`, `VIEW_SLOT_ANALYTICS` | No featured slot override or analytics |

---

#### STAFF — Operations Support

**Created by:** ADMIN only  
**Creation method:** Same as EDITOR — invite by email with role `"STAFF"`

**Purpose:** Handle day-to-day operational tasks (bookings, payments, enquiries, reviews) without the ability to create or modify platform structure (destinations, categories, hubs) or editorial content (trips, blogs at edit level).

**Responsibilities:**
- Handle bookings and payments (view, edit, cancel)
- Respond to enquiries and manage leads
- Moderate and manage reviews
- Manage the media gallery
- Create blog posts (cannot edit or delete existing ones)
- Create trips (cannot edit or delete)
- Manage partners
- View analytics (cannot export)

**Key permissions granted:**
| Permission | Notes |
|---|---|
| `VIEW_BOOKINGS`, `EDIT_BOOKING`, `DELETE_BOOKING` | All bookings |
| `VIEW_PAYMENTS`, `EDIT_PAYMENT`, `DELETE_PAYMENT` | All payments |
| `VIEW_ENQUIRIES`, `DELETE_ENQUIRY`, `REPLY_ENQUIRY` | All enquiries |
| `VIEW_LEADS`, `EDIT_LEAD`, `DELETE_LEAD` | All leads |
| `VIEW_REVIEWS`, `EDIT_REVIEW`, `DELETE_REVIEW` | All reviews |
| `CREATE_TRIP`, `VIEW_TRIPS` | Can create trips, but **cannot edit or delete** |
| `CREATE_BLOG`, `VIEW_BLOGS` | Can create blog posts, but **cannot edit or delete** |
| `CREATE_PARTNER`, `VIEW_PARTNERS`, `EDIT_PARTNER`, `DELETE_PARTNER` | Full partner management |
| `UPLOAD_MEDIA`, `MANAGE_MEDIA` | Full media access |
| `VIEW_ANALYTICS` | View only — no export |

**Permissions explicitly denied (EDITOR and above):**
| Permission | Why denied |
|---|---|
| `EDIT_TRIP`, `DELETE_TRIP` | Cannot modify existing trips |
| `CREATE_DESTINATION`, `EDIT_DESTINATION`, `DELETE_DESTINATION` | No destination management |
| `MANAGE_HUBS` | No hub management |
| `CREATE_CATEGORY`, `EDIT_CATEGORY`, `DELETE_CATEGORY` | No category management |
| `CREATE_ACTIVITY`, `EDIT_ACTIVITY`, `DELETE_ACTIVITY` | No activity management |
| `EDIT_BLOG`, `DELETE_BLOG` | No blog editorial control |
| `EXPORT_DATA`, `BULK_OPERATIONS` | No bulk or export operations |

---

#### GUIDE — Read-Only Observer

**Created by:** ADMIN only  
**Creation method:** Same invite flow with role `"GUIDE"`

**Purpose:** A local tour guide or external collaborator who needs visibility into trips and their bookings, but should never be able to modify anything on the platform.

**Responsibilities:**
- View assigned trips and their schedules (see F-06 for per-trip scoping, currently global)
- View bookings to prepare departure manifests
- View reviews for quality awareness
- No write access of any kind

**Permissions granted (read-only subset):**
| Permission | Notes |
|---|---|
| `VIEW_TRIPS` | See trip details and schedules |
| `VIEW_BOOKINGS` | See who is booked — currently platform-wide (scoped per trip in F-06) |
| `VIEW_REVIEWS` | Read reviews for quality awareness |
| `VIEW_USERS` | See basic user info related to bookings |
| `VIEW_PROFILE` | View own profile only |

**All other permissions are denied.** GUIDE has no create, edit, delete, analytics, media, settings, or management permissions. This is the lowest-privilege role that still has dashboard access.

> **Future scoping (F-06):** Currently a GUIDE can see all bookings and trips on the platform. F-06 will introduce `GuideAssignment` records so a GUIDE only sees the trips they are explicitly assigned to and the bookings for those trips only.

---

### 9.3 Operator-Created Team Members

A `TOUR_OPERATOR` account represents a business (e.g., a dive centre or snorkel company). In practice, that business has multiple staff members — a manager, a sales agent, a boat captain — who all need varying levels of access to the operator's dashboard.

> **Current status:** This feature (F-12) is **planned but not yet implemented**. The section below documents the intended design. Until F-12 is built, all operator accounts are single-user only.

**How it works:**  
The operator who originally registered and was approved by admin is automatically the `OWNER`. They can invite colleagues by email. Each invitation specifies a `teamRole` scoped entirely within that operator's account. Team members **cannot** cross into another operator's data under any circumstances.

---

#### OWNER — Operator Account Owner

**Created by:** Automatically assigned to the user who completed operator registration and was approved by admin.

**Scope:** Full control of their operator account.

**Responsibilities:**
- All trip management (create, edit, publish, pause, archive)
- Featured slot economy (lock slots, join waitlist)
- Manage operator profile, payment configuration, and payout settings
- Invite and manage team members (grant/revoke team roles)
- View all operator-level analytics and payment history
- Accept platform terms and commission rate changes on behalf of the business

**Permissions within the operator account:**
| Capability | Allowed |
|---|---|
| Create / edit / delete own trips | ✓ |
| Publish / pause / archive own trips | ✓ |
| Lock slots and join waitlist | ✓ |
| Manage operator profile | ✓ |
| Configure payment (Stripe/Mollie) | ✓ |
| View bookings for own trips | ✓ |
| View own analytics and revenue | ✓ |
| Invite / remove team members | ✓ |
| Change team member roles | ✓ |
| Accept terms and commission changes | ✓ (OWNER only) |

---

#### MANAGER — Operator Team Manager

**Created by:** `TOUR_OPERATOR` (OWNER role) via `POST /api/v1/operators/team/invite`  
**Creation method:** Invite by email → invited user registers or signs in → join accepted → receives `MANAGER` team role

**Purpose:** A senior staff member within the operator's business who manages day-to-day trip operations but does not control the account itself (no payment settings, no team management).

**Responsibilities:**
- Create, edit, and manage trips on behalf of the operator
- Participate in the featured slot economy (lock slots, publish trips, join waitlist)
- View bookings for the operator's trips
- Upload media for trips
- View analytics and payment history for the operator's account

**Permissions within the operator account:**
| Capability | Allowed |
|---|---|
| Create / edit trips | ✓ |
| Publish / pause / archive trips | ✓ |
| Lock slots and join waitlist | ✓ |
| View bookings for the operator's trips | ✓ |
| Upload and manage media | ✓ |
| View analytics | ✓ |
| Manage operator profile | ✗ (OWNER only) |
| Configure payment settings | ✗ (OWNER only) |
| Invite / remove team members | ✗ (OWNER only) |
| Accept terms and commission changes | ✗ (OWNER only) |

---

#### STAFF (Operator Team) — View-Only Team Member

**Created by:** `TOUR_OPERATOR` (OWNER role) via invite  

**Purpose:** A low-trust team member (e.g., a guide, boat crew, or customer service rep) who needs read-only visibility into upcoming trips and bookings for their own operational preparation.

**Responsibilities:**
- View the operator's trips and schedules
- View bookings for the operator's trips (departure manifests)
- No ability to create, modify, or publish anything

**Permissions within the operator account:**
| Capability | Allowed |
|---|---|
| View operator's trips | ✓ |
| View bookings for operator's trips | ✓ |
| Create or edit trips | ✗ |
| Publish / pause / archive trips | ✗ |
| Lock slots or join waitlist | ✗ |
| Upload media | ✗ |
| View analytics or payments | ✗ |

---

### 9.4 Cross-Cutting Rules for All Created Users

| Rule | Detail |
|---|---|
| **Role is always assigned server-side** | No frontend payload ever includes a `role` field. All role assignments go through protected backend endpoints. |
| **No self-promotion** | A user cannot escalate their own role. An EDITOR cannot make themselves an ADMIN. An operator MANAGER cannot make themselves the OWNER. |
| **Admin cannot be created via UI** | The only path to `ADMIN` is a direct database operation by an engineer. Even the `PATCH /api/v1/admin/users/:id/role` endpoint explicitly blocks promotion to `ADMIN`. |
| **Operator team roles are scoped** | An operator MANAGER has no more permission than a `TOUR_OPERATOR` on the platform level — they simply share access to the same operator account. They cannot access another operator's data. |
| **GUIDE scoping (planned)** | Admin-created GUIDEs currently see all platform trips and bookings. F-06 will scope this to explicitly assigned trips only. |
| **Deactivation vs deletion** | Admin-created staff accounts (EDITOR, STAFF, GUIDE) are deactivated (soft delete with `accountStatus: SUSPENDED`), not hard deleted, so their audit history is preserved. Hard deletion requires `MANAGE_SYSTEM`. |
| **Invite-based onboarding** | Neither admin-created platform users nor operator-invited team members set their own passwords on creation. Both flows use an invite link with a time-limited token to let the new user set their password on first access. |

---

## 10. Missing Features — Industry-Best & Business Requirements

> **Status:** These features are **not yet implemented**. Each item is classified by priority tier, the business requirement it satisfies, and what must be built (backend + frontend + schema changes where applicable).
>
> Items marked **CRITICAL** block launch readiness. Items marked **HIGH** are required for a competitive product. Items marked **MEDIUM** are industry-standard polish. Items marked **LOW** are long-term scaling features.

---

### 10.1 Authentication & Session Security

---

#### F-01 — Multi-Factor Authentication (MFA / 2FA) `CRITICAL`

**Gap:** No second factor is implemented for any role. An admin account protected only by a password is a single point of compromise for the entire platform.

**Business requirement:** ADMIN and TOUR_OPERATOR accounts hold financial data (payouts, commissions, Stripe/Mollie config). Any breach exposes operator earnings and traveler booking data.

**Industry standard:** Every major tour marketplace (Viator, GetYourGuide, Airbnb Experiences) enforces MFA for operator accounts and strongly recommends it for admin accounts.

**What to build:**

| Layer | Work |
|---|---|
| Backend | Integrate Better Auth `twoFactor()` plugin — TOTP (Google Authenticator / Authy) + backup codes |
| Backend | Add `mfaEnabled`, `mfaSecret`, `mfaBackupCodes` fields to `User` schema |
| Backend | New guard: `MfaGuard` — runs after `AuthGuard`, blocks requests if MFA is enabled but challenge not completed in the current session |
| Backend | Endpoints: `POST /api/auth/mfa/setup`, `POST /api/auth/mfa/verify`, `POST /api/auth/mfa/disable` |
| Frontend | MFA setup wizard in profile settings (QR code display + verification code input) |
| Frontend | MFA challenge screen on login flow (after password, before session granted) |
| Policy | Enforce MFA for `ADMIN` role at the guard level — not optional. Prompt on first login. |
| Policy | Make MFA opt-in but prominently encouraged for `TOUR_OPERATOR` |

---

#### F-02 — Session Management & Active Sessions Dashboard `HIGH`

**Gap:** Users have no visibility into their active sessions. An operator who logs in from 4 devices cannot see or revoke any of them. There is no idle timeout per role.

**Business requirement:** GDPR Article 32 requires "ongoing confidentiality" of user data. Financial operators need to revoke compromised sessions immediately.

**What to build:**

| Layer | Work |
|---|---|
| Schema | Add `deviceName`, `ipAddress`, `userAgent`, `lastActiveAt`, `isCurrent` to `Session` model |
| Backend | `GET /api/v1/sessions` — list all active sessions for the current user |
| Backend | `DELETE /api/v1/sessions/:id` — revoke a specific session |
| Backend | `DELETE /api/v1/sessions` — revoke all sessions except current ("sign out everywhere") |
| Backend | Session idle timeout middleware — configurable per role (`ADMIN`: 60 min, `OPERATOR`: 8 hr, `USER`: 30 days) |
| Frontend | "Active Sessions" section in profile settings — shows device, IP, location (reverse-geocoded), last active time |
| Frontend | "Sign out all other devices" button |

---

#### F-03 — Login Audit Log & Suspicious Login Detection `HIGH`

**Gap:** No record of login events. A compromised account leaves no trail. There is no alerting when a login occurs from a new country or device.

**Business requirement:** Financial platform audit requirements. Also a baseline trust signal for operators who need to know their account hasn't been accessed unauthorised.

**What to build:**

| Layer | Work |
|---|---|
| Schema | New model: `LoginEvent { id, userId, ipAddress, userAgent, country, city, status (success/failed/blocked), createdAt }` |
| Backend | Middleware hook on Better Auth `signIn` event — write `LoginEvent` row on every attempt |
| Backend | Suspicious login detection: new country or device → send email alert to account owner |
| Backend | `GET /api/v1/auth/login-history` — paginated list for the account owner |
| Frontend | "Recent login activity" table in profile settings |
| Admin panel | `GET /api/v1/admin/login-events?userId=` — admin can view any user's login history (`MANAGE_USERS` permission) |

---

#### F-04 — Password Policy per Role & Rotation `MEDIUM`

**Gap:** Current minimum is 12 characters for all users via Better Auth. No complexity rules, no rotation enforcement, no breach detection.

**What to build:**

| Layer | Work |
|---|---|
| Backend | Password strength scoring (zxcvbn or equivalent) — reject weak passwords with specific feedback |
| Backend | Have I Been Pwned (HIBP) API check on registration and password change — block known breached passwords |
| Backend | Per-role forced rotation: ADMIN must change password every 90 days; flag `passwordLastChangedAt` on `User` |
| Backend | Middleware: on ADMIN login, check `passwordLastChangedAt`; if > 90 days, redirect to change-password before granting session |
| Frontend | Password strength meter on registration and change-password forms |
| Frontend | "Your password was last changed X days ago" notice in profile |

---

### 10.2 Role & Permission Management

---

#### F-05 — Role Management UI for Internal Staff `CRITICAL`

**Gap:** EDITOR, STAFF, and GUIDE roles are defined in code but there is no admin interface to assign them. Currently the only way to give a staff member a role is via a raw backend API call or direct DB manipulation.

**Business requirement:** As the platform grows, admins need to onboard new staff members and adjust their roles without engineering intervention.

**What to build:**

| Layer | Work |
|---|---|
| Backend | `POST /api/v1/admin/staff` — create internal user with role (EDITOR, STAFF, GUIDE) — `MANAGE_USERS` permission |
| Backend | `PATCH /api/v1/admin/users/:id/role` — change role for non-ADMIN users — strict: cannot promote to ADMIN via this endpoint |
| Backend | `DELETE /api/v1/admin/users/:id` — deactivate account (soft delete, not hard delete) |
| Frontend | Staff management section under Users: list, invite by email, assign role dropdown (EDITOR / STAFF / GUIDE) |
| Frontend | Invite flow: send email with temporary password + "set your password" link |
| Schema | Add `invitedBy UUID`, `invitedAt DateTime`, `accountStatus (ACTIVE / INVITED / SUSPENDED)` to `User` |

---

#### F-06 — GUIDE Role Scoped to Assigned Trips `HIGH`

**Gap:** The current `GUIDE` role grants `VIEW_BOOKINGS` and `VIEW_TRIPS` globally — a guide can see every booking on the platform. In reality, a guide should only see trips they are explicitly assigned to.

**Business requirement:** Tour guides are hired per trip or per season. They need to see departure manifests for their tours only, not the entire platform's booking history.

**What to build:**

| Layer | Work |
|---|---|
| Schema | New join table: `GuideAssignment { id, userId, tripId, assignedBy, assignedAt, validFrom, validTo }` |
| Backend | `POST /api/v1/admin/guide-assignments` — assign a GUIDE to specific trips |
| Backend | `GuideFilter` middleware — when `userRole === GUIDE`, inject `WHERE tripId IN (guide's assigned trip IDs)` into every booking/trip query |
| Frontend | "Guide Assignments" sub-section on each trip's edit page — list and add guide users |
| Frontend | GUIDE dashboard shows only their assigned trips and corresponding bookings |

---

#### F-07 — ADMIN Sub-Roles / Departmental Permissions `MEDIUM`

**Gap:** ADMIN is binary — full access or nothing. A platform team has different departments (content, finance, operator success) who should not all have access to payment gateway config and user deletion.

**Business requirement:** Principle of least privilege. A content admin should not be able to delete users or change Stripe keys. A finance admin should not be able to publish/unpause trips.

**What to build:**

**Option A (recommended for now):** Extend the existing role enum with two new platform-staff roles:

```
FINANCE_ADMIN  — VIEW_PAYMENTS, EDIT_PAYMENT, DELETE_PAYMENT, VIEW_BOOKINGS, VIEW_ANALYTICS, EXPORT_DATA
CONTENT_ADMIN  — all EDITOR permissions + MANAGE_SETTINGS (SEO/SMTP only)
```

**Option B (long-term):** Full custom permission sets per user — a permission override table:

```prisma
model UserPermissionOverride {
  id         String     @id @default(uuid())
  userId     String
  permission Permission
  granted    Boolean    @default(true)
  grantedBy  String
  grantedAt  DateTime   @default(now())
  expiresAt  DateTime?
}
```

Option B enables time-limited elevated access (e.g., temporary MANAGE_SLOTS access to a junior admin for a specific incident).

---

#### F-08 — Time-Limited Role Assignments `MEDIUM`

**Gap:** Role assignments are permanent. Contractors, seasonal staff, or temporary elevated access (incident response) have no natural expiry.

**What to build:**

| Layer | Work |
|---|---|
| Schema | Add `roleExpiresAt DateTime?` to `User` |
| Backend | Cron job: runs hourly — finds users where `roleExpiresAt < now()`, downgrades their role to `USER` and sends a notification |
| Backend | `PATCH /api/v1/admin/users/:id/role` — accepts optional `expiresAt` param |
| Frontend | Role assignment UI shows expiry date picker with a "Permanent" toggle |

---

### 10.3 Operator Lifecycle & Verification

---

#### F-09 — Operator KYC / Document Verification `CRITICAL`

**Gap:** Operators are approved manually by admin with no structured verification. There is no document collection, no identity check, and no business verification. Any email address can become an operator after manual admin approval.

**Business requirement:** GetYourGuide and Viator require business registration documents, tax ID, and bank account verification before an operator can publish. This protects travelers from fraudulent listings and protects the platform from payment fraud and chargebacks.

**What to build:**

| Layer | Work |
|---|---|
| Schema | Extend `Operator`: `kycStatus (PENDING / SUBMITTED / APPROVED / REJECTED)`, `businessRegistrationNumber`, `taxId`, `kycDocuments JSON`, `kycReviewedAt`, `kycReviewedBy` |
| Backend | `POST /api/v1/operators/kyc` — operator submits documents (Cloudinary URLs) |
| Backend | `PATCH /api/v1/admin/operators/:id/kyc` — admin reviews and approves/rejects KYC |
| Backend | Block trip publishing until `kycStatus === APPROVED` — check in `TripsService.publish()` |
| Frontend | Operator onboarding step 3 (after profile): document upload form (business license, tax certificate, bank details) |
| Frontend | Admin operator detail page: document viewer + approve/reject KYC section |
| Notification | Email to operator when KYC is approved or rejected (with rejection reason) |

---

#### F-10 — Granular Operator Suspension States `HIGH`

**Gap:** Operators currently have two meaningful states: approved or not. There are no intermediate enforcement states for platform compliance scenarios.

**Business requirement:** Platforms need to act with proportionality — a payment dispute shouldn't permanently ban an operator; it should put them on payment hold. A content violation shouldn't block bookings; it should flag the specific trip for review.

**What to build:**

```
Operator account states:
  PENDING        → applied, not yet reviewed
  ACTIVE         → approved, can publish and receive bookings
  KYC_REQUIRED   → reapproval needed (after business change or annual review)
  PAYMENT_HOLD   → can still publish but payouts are frozen pending dispute resolution
  CONTENT_REVIEW → new trips require admin approval before going LIVE
  SUSPENDED      → cannot publish new trips; existing LIVE trips are paused
  BANNED         → account locked; all trips archived; no new registration with same email/tax ID
```

| Layer | Work |
|---|---|
| Schema | Replace `isApproved Boolean` with `operatorStatus OperatorStatus` enum |
| Backend | `PATCH /api/v1/admin/operators/:id/status` — change to any state with a required `reason` field |
| Backend | Status middleware — injected into `TripsService.create()` and `publish()` to enforce state rules |
| Backend | New `OperatorStatusHistory` model — audit trail of every status change, who changed it, and why |
| Frontend | Admin operator detail: status badge + "Change status" dropdown + reason textarea |
| Notification | Email to operator on every status change with clear explanation of what they can/cannot do |

---

#### F-11 — Operator Contract & Commission Rate Acceptance `HIGH`

**Gap:** Operators are never formally presented with the commission rates they agreed to. When admin changes rates, there is no re-acceptance flow. This creates legal ambiguity in payout disputes.

**Business requirement:** EU marketplace regulations (P2B Regulation) require platforms to inform operators of commission changes with 15-day notice. The platform needs a record of what rate was agreed and when.

**What to build:**

| Layer | Work |
|---|---|
| Schema | New model: `OperatorContractAcceptance { id, operatorId, termsVersion, commissionRates JSON, acceptedAt, ipAddress }` |
| Backend | On operator approval: send ToS + current commission rate schedule; block publishing until `acceptedAt` is set |
| Backend | When admin changes commission rates: create new "pending acceptance" record for all `ACTIVE` operators; block new trip publishing after 15 days if not accepted |
| Backend | `POST /api/v1/operators/accept-terms` — operator explicitly accepts; stores IP + timestamp |
| Frontend | Terms acceptance modal (cannot be dismissed) shown on first login after approval or after rate change |
| Frontend | "Commission & Terms" page in operator profile showing what was accepted and when |

---

#### F-12 — Multi-Seat Operator Accounts `MEDIUM`

**Gap:** One operator account = one user. A tour company with multiple staff (sales agent, operations manager, captain) must all share one login. This is insecure and makes audit logs useless.

**What to build:**

| Layer | Work |
|---|---|
| Schema | New model: `OperatorTeamMember { id, operatorId, userId, teamRole (OWNER/MANAGER/STAFF), invitedAt, joinedAt }` |
| Backend | `POST /api/v1/operators/team/invite` — owner invites by email; creates pending invitation |
| Backend | `PATCH /api/v1/operators/team/:id/role` — owner changes team member's role within the operator account |
| Backend | `DELETE /api/v1/operators/team/:id` — remove team member |
| Backend | `TripsService` ownership check: allow any team member of the same `operatorId` to manage trips |
| Frontend | "Team" section in operator settings — list members, invite by email, assign role |
| Permission mapping | OWNER can invite/remove, MANAGER can create/edit trips, STAFF can view only |

---

### 10.4 Content Moderation & Review Workflow

---

#### F-13 — Trip Content Moderation Queue `HIGH`

**Gap:** Trips go directly from `DRAFT` to `LIVE` after the operator publishes. There is a `PENDING_REVIEW` status in the `TripStatus` enum (flagged as gap G2 in `IMPLEMENTATION_GUIDE.md`) that was never implemented. No human or automated check prevents a fraudulent or policy-violating listing from going live.

**Business requirement:** Every consumer-facing marketplace (Airbnb, Viator, Booking.com) reviews new listings before they appear publicly, especially from newly onboarded operators.

**What to build:**

| Layer | Work |
|---|---|
| Backend | Implement `PENDING_REVIEW` status: on `publish()`, new operators and operators in `CONTENT_REVIEW` state go to `PENDING_REVIEW` instead of `LIVE` |
| Backend | After N approved trips, operators graduate to auto-publish (configurable threshold in settings) |
| Backend | `PATCH /api/v1/admin/trips/:id/approve` — admin approves → `LIVE`; `reject` → back to `DRAFT` with reason |
| Backend | `GET /api/v1/admin/trips?status=PENDING_REVIEW` — moderation queue |
| Frontend | Admin trips list: "Pending Review" tab with approve/reject actions in row-actions dropdown |
| Frontend | Operator trips list: `PENDING_REVIEW` status badge + "Under review — you'll be notified" message |
| Notification | Email to operator when their trip is approved or rejected |

---

#### F-14 — Review Moderation & Dispute System `HIGH`

**Gap:** Reviews can be submitted and are visible. Operators have no way to dispute a fraudulent or policy-violating review. Admins have `EDIT_REVIEW` and `DELETE_REVIEW` but there is no formal workflow.

**What to build:**

| Layer | Work |
|---|---|
| Schema | Add to `Review`: `moderationStatus (VISIBLE / FLAGGED / UNDER_REVIEW / REMOVED)`, `flaggedBy`, `flaggedAt`, `removalReason` |
| Backend | `POST /api/v1/reviews/:id/flag` — operator flags a review with a category (fake, offensive, off-topic) |
| Backend | `PATCH /api/v1/admin/reviews/:id/moderate` — admin sets `moderationStatus`; removed reviews return 404 on public pages |
| Frontend | Operator trip reviews section: "Flag this review" option on each review |
| Frontend | Admin reviews page: "Flagged" filter tab; approve/remove actions |
| Notification | Email to reviewer when their review is removed (with reason) |

---

### 10.5 Compliance & Legal

---

#### F-15 — GDPR Right to Erasure (Soft Delete for Users) `CRITICAL`

**Gap:** The platform uses soft delete (F approach) for content entities, but there is no user data erasure flow. A USER requesting account deletion under GDPR Article 17 has no path to do so, and there is no process to anonymise their personal data while preserving booking records.

**Business requirement:** GDPR applies to all EU/EEA residents. The Caribbean (Curaçao, Aruba, Sint Maarten) has its own privacy legislation (Landsverordening op de Bescherming van Persoonsgegevens) which mirrors GDPR. Non-compliance risks fines and loss of EU market access.

**What to build:**

| Layer | Work |
|---|---|
| Schema | Add `deletionRequestedAt DateTime?`, `deletedAt DateTime?`, `anonymisedAt DateTime?` to `User` |
| Backend | `POST /api/v1/me/deletion-request` — USER requests account deletion; creates 30-day cooling-off period |
| Backend | `POST /api/v1/admin/users/:id/cancel-deletion` — admin can cancel within cooling-off period |
| Backend | Scheduled job: after 30 days, run anonymisation — replace PII fields (`name → "Deleted User"`, `email → hash`, `phone → null`) but keep booking records with anonymised reference |
| Backend | `GET /api/v1/me/data-export` — DSAR (Data Subject Access Request) — returns JSON of all personal data (profile, bookings, reviews) |
| Frontend | "Delete my account" button in profile settings with 30-day notice explanation |
| Frontend | "Export my data" button generating a downloadable JSON file |

---

#### F-16 — Financial Record Retention Policy `HIGH`

**Gap:** Soft delete preserves booking records but there is no explicit retention policy enforced at the application level. There are no rules about what happens to data after a specified retention period.

**Business requirement:** EU VAT regulations require 7-year retention of transaction records. Booking records (with commission amounts) must not be deleted or anonymised within that window.

**What to build:**

| Layer | Work |
|---|---|
| Schema | Add `retentionExpiresAt DateTime` to `Booking` — set to `createdAt + 7 years` |
| Backend | Soft-delete guard for bookings: block any deletion (even admin) where `retentionExpiresAt > now()` — return 451 (Unavailable For Legal Reasons) |
| Backend | Scheduled annual job: hard-delete `Booking` records where `retentionExpiresAt < now()` AND the associated user has been anonymised |
| Admin panel | Settings section: "Data Retention Policy" — view current policy, see scheduled deletions |

---

### 10.6 Platform Control & Emergency Operations

---

#### F-17 — Emergency Kill Switch / Circuit Breaker `CRITICAL`

**Gap:** There is no mechanism to halt specific platform operations during an incident (e.g., payment gateway failure, discovered fraud, DDoS on the slot endpoint). An admin must modify code and redeploy to stop a specific flow.

**Business requirement:** Any production financial platform needs operational circuit breakers that can be toggled without a code deploy.

**What to build:**

| Layer | Work |
|---|---|
| Schema / Redis | Store feature flags in Redis (fast toggle, no DB migration): `platform:flags:bookings_enabled`, `platform:flags:slot_locking_enabled`, `platform:flags:operator_registration_enabled`, `platform:flags:new_trip_publishing_enabled` |
| Backend | `FeatureFlagService` — singleton that checks Redis flag before allowing the operation; injects `503 Service Temporarily Unavailable` with `{ code: 'FEATURE_DISABLED', message }` |
| Backend | `PATCH /api/v1/admin/platform/flags/:flag` — toggle any flag; requires `MANAGE_SYSTEM` permission; writes to Redis + persists to DB for audit |
| Backend | `PlatformFlagAudit` model — who toggled what, when, and with what reason |
| Frontend | Admin Settings → "Platform Controls" section: list of toggles with last-changed timestamp and responsible admin |
| Monitoring | Alert when any flag is toggled — Slack/email to all admin accounts immediately |

---

#### F-18 — Admin Impersonation (Support Tool) `HIGH`

**Gap:** When an operator reports a bug or a user reports a booking issue, the support team has no way to see exactly what that user sees. Debugging requires guessing from logs.

**Business requirement:** Every mature SaaS/marketplace platform has "act as user" functionality for support teams. Without it, support tickets take 10× longer to resolve.

**What to build:**

| Layer | Work |
|---|---|
| Backend | `POST /api/v1/admin/impersonate/:userId` — ADMIN only; creates a short-lived (1 hour) impersonation session token — `MANAGE_USERS` permission required |
| Backend | `POST /api/v1/admin/impersonate/exit` — terminates the impersonation session |
| Backend | All actions taken during an impersonation session are tagged with `impersonatedBy: adminId` in audit logs — impersonator cannot perform destructive actions (no delete, no payment operations) |
| Frontend | Admin user detail page: "Impersonate" button |
| Frontend | Impersonation banner (red, sticky): "You are viewing as [user name] — [Exit impersonation]" shown on every page |
| Schema | `ImpersonationSession { id, adminId, targetUserId, startedAt, endedAt, actionsLog JSON }` |

---

### 10.7 Notification & Communication

---

#### F-19 — Notification Preference Centre `HIGH`

**Gap:** The notification system (Phase 16 / gap G7 in `IMPLEMENTATION_GUIDE.md`) is entirely unimplemented. Even once built, there is no user-facing preference management. Users will receive all emails by default with no way to opt out — this violates GDPR's consent requirement for marketing emails.

**What to build:**

| Layer | Work |
|---|---|
| Schema | `NotificationPreference { id, userId, type (BOOKING_CONFIRMATION / SLOT_OFFER / MARKETING / REVIEW_RECEIVED / …), channel (EMAIL / PUSH / IN_APP), enabled Boolean }` |
| Backend | `GET /api/v1/me/notification-preferences` — list current preferences |
| Backend | `PATCH /api/v1/me/notification-preferences` — update preferences in bulk |
| Backend | Notification dispatcher: checks preferences before sending; transactional emails (booking confirmation, slot offer, password reset) cannot be disabled; marketing emails always require explicit opt-in |
| Frontend | "Notifications" section in profile settings — grouped by category with per-channel toggles |
| Admin panel | Admin can view notification logs per user for debugging delivery issues |

---

#### F-20 — In-App Notification Centre `MEDIUM`

**Gap:** Operators are notified of slot offers via email only (and optionally SSE toast). There is no persistent notification inbox. If an operator misses the email, there is no other way to find the pending offer.

**What to build:**

| Layer | Work |
|---|---|
| Schema | `Notification { id, userId, type, title, body, link, isRead Boolean, createdAt }` |
| Backend | `NotificationService.create()` — called by every event that currently sends email; writes a notification row in addition to sending email |
| Backend | `GET /api/v1/me/notifications?unread=true` — paginated; `PATCH /api/v1/me/notifications/:id/read` |
| Backend | SSE channel per user: push new notification events to the operator's open browser connection |
| Frontend | Bell icon in dashboard header: unread count badge; dropdown showing last 10 notifications; "Mark all read" |
| Frontend | "All notifications" page with filter by type and read status |

---

### 10.8 Analytics & Observability

---

#### F-21 — Per-Operator Revenue Analytics `HIGH`

**Gap:** `VIEW_ANALYTICS` is granted to TOUR_OPERATOR but no analytics are actually built for them. Operators cannot see their own earnings, booking trends, or conversion rates.

**Business requirement:** Operators on Viator and GetYourGuide get a full analytics dashboard. Without this, operators have no incentive to stay on the platform or optimise their listings.

**What to build:**

| Layer | Work |
|---|---|
| Backend | `GET /api/v1/operators/me/analytics?from=&to=` — aggregated metrics: total bookings, gross revenue, net revenue (after commission), bookings by trip, ratings trend |
| Backend | `GET /api/v1/operators/me/analytics/slot-performance` — slot fill rate, how many days the featured slot was active, comparison vs standard listing bookings |
| Frontend | Operator Overview dashboard: revenue chart (line), bookings by trip (bar), slot ROI card |
| Frontend | Date range picker (last 7 / 30 / 90 days / custom) |

---

#### F-22 — Platform-Wide Admin Analytics `HIGH`

**Gap:** Admin dashboard shows static placeholder data. No real-time or historical platform metrics are implemented.

**What to build:**

| Layer | Work |
|---|---|
| Backend | `GET /api/v1/admin/analytics/overview` — total GMV, total commission earned, active operators, new operators (last 30 days), booking conversion rate, slot fill rate across all categories |
| Backend | `GET /api/v1/admin/analytics/slots` — slot utilisation heatmap (7-day turnover data from `SlotHistory`) per category |
| Backend | `GET /api/v1/admin/analytics/operators` — top earners, operators on probation, KYC pipeline status |
| Frontend | Admin Overview: GMV card, commission card, slot fill rate donut chart, top trips table |
| Frontend | Admin Slots analytics: heatmap per category showing slot churn rate |

---

### 10.9 API Access & Integration

---

#### F-23 — Operator API Keys (Programmatic Access) `MEDIUM`

**Gap:** Operators must use the dashboard UI to manage their trips. Large operators (tour companies with 50+ trips) need to sync their inventory from their own booking systems via API, not by hand.

**What to build:**

| Layer | Work |
|---|---|
| Schema | `ApiKey { id, operatorId, name, keyHash String, prefix String (first 8 chars for display), permissions String[], lastUsedAt, expiresAt, createdAt }` |
| Backend | `POST /api/v1/operators/me/api-keys` — create key (returns plaintext once; never stored); hash stored with bcrypt |
| Backend | `DELETE /api/v1/operators/me/api-keys/:id` — revoke key |
| Backend | `ApiKeyGuard` — alternative to session cookie auth; extracts `Authorization: Bearer <key>`, validates hash, populates `request.user` |
| Backend | API keys are scoped to specific permissions at creation (e.g., `MANAGE_TRIPS` only — cannot manage slots via API key) |
| Frontend | "API Keys" section in operator settings — list keys (prefix only), create new, revoke |

---

### 10.10 Priority Summary

| ID | Feature | Priority | Affects |
|---|---|---|---|
| F-01 | Multi-Factor Authentication (MFA) | CRITICAL | All roles |
| F-05 | Role Management UI for internal staff | CRITICAL | ADMIN → EDITOR/STAFF/GUIDE |
| F-09 | Operator KYC / document verification | CRITICAL | TOUR_OPERATOR onboarding |
| F-13 | Trip content moderation queue | CRITICAL | TOUR_OPERATOR → ADMIN |
| F-15 | GDPR right to erasure | CRITICAL | USER, all roles |
| F-17 | Emergency kill switch / circuit breaker | CRITICAL | Platform operations |
| F-02 | Session management & active sessions | HIGH | All roles |
| F-03 | Login audit log & suspicious login detection | HIGH | All roles |
| F-06 | GUIDE role scoped to assigned trips | HIGH | GUIDE |
| F-10 | Granular operator suspension states | HIGH | TOUR_OPERATOR |
| F-11 | Operator contract & commission acceptance | HIGH | TOUR_OPERATOR |
| F-14 | Review moderation & dispute system | HIGH | TOUR_OPERATOR, ADMIN |
| F-16 | Financial record retention policy | HIGH | Bookings, compliance |
| F-18 | Admin impersonation | HIGH | ADMIN, support |
| F-19 | Notification preference centre | HIGH | All roles |
| F-21 | Per-operator revenue analytics | HIGH | TOUR_OPERATOR |
| F-22 | Platform-wide admin analytics | HIGH | ADMIN |
| F-04 | Password policy per role & breach detection | MEDIUM | All roles |
| F-07 | ADMIN sub-roles / departmental permissions | MEDIUM | ADMIN team |
| F-08 | Time-limited role assignments | MEDIUM | EDITOR/STAFF/GUIDE |
| F-12 | Multi-seat operator accounts | MEDIUM | TOUR_OPERATOR |
| F-20 | In-app notification centre | MEDIUM | All roles |
| F-23 | Operator API keys | MEDIUM | TOUR_OPERATOR (large operators) |
