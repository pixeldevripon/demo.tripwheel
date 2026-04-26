# Island Tours — Project Scope

Island Tours is a complete tour and travel management marketplace application. Tour operators can join as a tour operator by signing up and they can create and list their trips. They can feature their trips by giving a cut-off commission to Island Tours. Users can book a trip and pay for it.

---

## Roles & Authentication

The platform has three roles: **USER (Customer)**, **TOUR_OPERATOR**, and **ADMIN**. Each role has a distinct authentication flow.

### Authentication by Role

| Role | Sign-up Method | Login Method |
|---|---|---|
| USER / Customer | No self-registration. Credentials (email + temporary password) are auto-generated and emailed when a booking is made. | Email + password only. User can change credentials via forgot/reset password. |
| TOUR_OPERATOR | Self-registration via Better Auth — email/password with mandatory email verification, plus social login (Google). | Email/password or social login (Google) via Better Auth. |
| ADMIN | Created by database seeding only. No public sign-up. | Email + password only. |

> **Note:** The email notification provider is TBD and will be configured separately. The system is designed with a pluggable mail service (Nodemailer-compatible).

---

## User Role (Customer)

Users gain access only after making a booking. Their credentials are created automatically and delivered via email.

**Authentication**
- Login with email and temporary password provided on first booking
- Change password via forgot password / reset password flow
- No social login for customers

**Trip Discovery**
- Browse and search all live trips
- Filter trips by category, price, date, location, and rating
- View trip detail pages (description, photos, schedules, operator info, reviews)
- Add trips to wishlist

**Booking & Payments**
- Book a trip (selects a specific trip schedule/departure date)
- Pay for the trip via available payment gateways (Stripe, Mollie, or PayPal — whichever admin has enabled)
- View all personal bookings
- Cancel a booking (subject to cancellation policy)

**Post-Trip**
- Rate and review a completed trip
- Chat with the tour operator (chat system design TBD)

---

## Tour Operator Role

Tour operators are businesses or individuals who list trips on the platform.

**Authentication**
- Self-registration via Better Auth
- Email/password sign-up with mandatory email verification before activation
- Social login via Google and GitHub
- Login via credentials or social login

**All User (Customer) Features**
Tour operators inherit all customer features — they can browse, search, filter, wishlist, book, and pay for trips listed by other operators. They can rate and review other operators' trips.

**Trip Management (Own Trips)**
- Create and list trips (details, photos via Cloudinary, pricing, schedules)
- Trips are created as **DRAFT** first, then published as **LIVE**
- Each trip supports multiple scheduled departures (dates) with individual capacity limits
- Edit live trips (title, description, photos, pricing update immediately)
- Pause a live trip (removes from public listing, releases featured slot if held)
- Archive a trip (permanent removal from public listing, releases featured slot if held)

**Featured Slot System**
- When publishing a trip, the operator chooses between a **Standard listing** or a **Featured listing**
- Featured listings require selecting one of 3 available slots per trip category
- Slot tiers and commissions per booking:
  - Slot 1 — best placement (hero carousel, top pin) — 22% platform commission
  - Slot 2 — mid placement — 25% platform commission
  - Slot 3 — lowest featured placement — 30% platform commission
  - Standard listing — no placement boost — 20% platform commission
- **Soft-lock:** Selecting a slot reserves it for 15 minutes while the operator completes the creation wizard. If not published within 15 minutes, the lock is released automatically.
- **Hard-reserve:** Publishing the trip before the TTL expires converts the soft-lock to a hard-reserve (held for up to 90 days)
- **Race condition:** If two operators publish on the same slot simultaneously, the first HTTP request wins. The losing operator sees a recovery modal and can pick a different slot, publish as standard, or join the waitlist.
- **Slot expiry:** After 90 days, the slot is automatically released and offered to the next person in the waitlist.
- If all 3 slots in a category are taken, the operator can publish as a standard listing, or join the **Waitlist** for a preferred slot.

**Waitlist**
- FIFO queue per slot per category
- When a slot becomes available, the next operator in queue receives a **24-hour offer window** to claim it
- If the offer is not claimed within 24 hours, it passes to the next in queue
- Operators can skip ahead in the queue by paying a fee (maximum 3 paid skips per queue entry)

**Dashboard**
- View all own trips (with status: DRAFT, LIVE, PAUSED, ARCHIVED)
- View all bookings for own trips
- Cancel bookings
- View featured slot status and waitlist position (if any)
- See pending slot offer banners with countdown timer

---

## Admin Role

Admins are created by database seeding. There is no public admin registration.

**Seeded credentials:** `email: admin@islandtours.com` / `password: [set in seed script]`

**All Customer Features**
Admins inherit all customer features — browse, search, wishlist, book, pay, review, and chat.

**Platform Management**
- Manage tour operators (view, approve, suspend, ban accounts)
- Manage all trips (view, force-pause, force-archive any trip)
- Manage trip categories (create, edit, delete — seeding 3 featured slots per new category automatically)
- Manage featured slots (view all slots across all categories, override slot assignments if needed)
- View and manage the waitlist per slot

**Booking & Payment Oversight**
- View all bookings across the platform
- Cancel any booking
- View payment transaction history

**Payment Gateway Configuration**
- Enable or disable payment methods: Stripe, Mollie, PayPal
- Configure commission rates per slot tier (default: 20% standard, 22% / 25% / 30% featured)

**Notification Configuration**
- Enable or disable notification types (email, push) from admin panel

**Overview Dashboard**
- Total trips (by status), tour operators, bookings, and revenue
- Recent bookings, payments, and cancellations
- Notification feed
- Platform health (slot fill rate, waitlist depth)

---

## Trip Lifecycle

```
DRAFT → LIVE → PAUSED → ARCHIVED
              ↑_____↓ (operator can pause/unpause a live trip)
```

- **DRAFT**: Created but not yet published. Not visible to customers. Operator can edit freely.
- **LIVE**: Published and visible to customers. Content edits (title, description, photos, pricing) save immediately. Changing the category of a live trip that holds a featured slot requires releasing the slot first.
- **PAUSED**: Operator-paused. Not visible to customers. Featured slot (if held) is released automatically and offered to the waitlist.
- **ARCHIVED**: Permanently removed from public listing. Featured slot (if held) is released automatically.

---

## Trip Schedules

Each trip listing can have multiple scheduled departures (e.g., the same boat tour offered every Saturday). Each schedule has:
- Departure date and time
- Capacity (max bookings)
- Current booking count
- Status (available, full, completed, cancelled)

A BullMQ background job activates a **pre-booking window 24 hours before departure** — this can trigger last-minute price adjustments, "last-minute availability" badges, or block new bookings depending on configuration.

---

## Featured Slot System — Technical Summary

- Every trip **category** has exactly **3 FeaturedSlot rows**, created when the category is seeded. These rows are never deleted — only their status and assignment are updated.
- Slot statuses: `AVAILABLE → SOFT_LOCKED (15 min TTL) → HARD_RESERVED (up to 90 days) → AVAILABLE`
- All slot timing is enforced by **BullMQ delayed jobs** stored in Redis (survive server restarts, cancellable)
- Real-time slot status updates are pushed to connected operator browsers via **Server-Sent Events (SSE)**
- Commission rates are stored on the Booking record at the time of booking (so historical bookings reflect the rate that was in effect, even if rates change later)

---

## Payment System

- Supported gateways: **Stripe**, **Mollie**, **PayPal**
- Admin can enable or disable any gateway from the admin panel
- Payments are tied to bookings
- Refunds on cancellation are handled per-gateway

---

## Notification System

| Event | Recipient(s) | Channel |
|---|---|---|
| Trip booked | User, Tour Operator, Admin | Email + Push |
| Booking cancelled | User, Tour Operator, Admin | Email + Push |
| Featured slot offer available | Tour Operator | Email + Push |
| Slot offer expired (no action taken) | Tour Operator | Email |
| Slot TTL expired mid-wizard | Tour Operator | In-app toast / SSE event |
| Pre-departure window activated (24h before) | Tour Operator | Email |
| Account credentials created | User (new customer) | Email |
| Password reset | User / Tour Operator | Email |

- Email notifications are sent via a pluggable email provider (Nodemailer-compatible — provider TBD)
- Push notifications via a push provider (TBD — Firebase or equivalent)
- Admin can enable or disable any notification type from the admin panel

---

## Chat System

- Users can chat with tour operators
- Tour operators can chat with users
- Admins can chat with tour operators
- **Technical design for the chat system is deferred** and will be specified in a separate design document before implementation.

---

## Image Uploads

- Trip photos are uploaded and managed via **Cloudinary**
- Tour operator profile photos via Cloudinary
- Admin can remove images that violate platform policy

---

## Edge Cases the System Must Handle

| ID | Scenario | Behavior |
|---|---|---|
| EC-01 | All 3 slots in a category are taken | Show estimated wait times per slot; offer waitlist join per slot |
| EC-02 | Two operators publish on the same slot simultaneously | First HTTP request wins; loser gets recovery modal (pick again / standard / waitlist) |
| EC-03 | Operator is mid-wizard when their 15-min TTL expires | SSE event detects expiry; operator is returned to slot picker step with a toast |
| EC-04 | Operator edits a LIVE trip | Warning banner: "Changes save immediately to the live listing" |
| EC-05 | 24 hours before a scheduled departure | BullMQ job activates pre-booking window (last-minute badge, optional booking block) |
| EC-06 | Operator pauses or archives a trip holding a featured slot | Slot is released automatically; waitlist offer flow triggered for next in queue |